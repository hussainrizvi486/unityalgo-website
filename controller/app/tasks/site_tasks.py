"""Durable Frappe provisioning, with explicit cleanup and failure states."""

import json
import time
from datetime import datetime, timedelta, timezone
import uuid
import urllib.request
from sqlalchemy import select, update as update_table
from app.config import settings
from app.db import database
from app.services.crypto import decrypt
from app.services.activity_logger import ActivityLogger, format_exception
from app.models.site import Site, STEP_FLOW
from app.models.site_extras import SiteBackup
from app.models.server import ServerNode
from app.services import trials
from app.services.site_runtime import build_service
from app.services.mariadb_service import remove_site_database
from app.services.frappe_service import SetupUnavailable
from app.services.proxy_configuration_service import ProxyConfigurationService
from app.tasks.celery_app import celery_app


class SiteTask(celery_app.Task):
    abstract = True

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        if args:
            update(
                args[0],
                "cleanup_required",
                0,
                "Provisioning was interrupted. Contact support to check the reserved resources.",
            )
            notify(args[0], "failed")


def update(site_id, status, progress, message, **extra):
    with database.session() as session:
        site = session.get(Site, uuid.UUID(site_id))
        if site:
            site.status, site.progress, site.message = status, progress, message
            for key, value in extra.items():
                setattr(site, key, value)
            from app.controller.server import ServerController

            ServerController(session, settings).refresh_capacity(
                session.get(ServerNode, site.server_id)
            )


@celery_app.task(
    bind=True,
    base=SiteTask,
    name="site.provision",
    soft_time_limit=3300,
    time_limit=3400,
)
def provision_site_task(self, site_id, setup=None):
    with database.session() as session:
        site = session.scalar(
            select(Site).where(Site.id == uuid.UUID(site_id)).with_for_update()
        )
        if not site or site.status != "queued":
            return

        site.status, site.progress, site.message = (
            "assigned",
            5,
            "The assigned server is preparing your site.",
        )
        service = build_service(
            session, site, json.loads(decrypt(setup, settings)) if setup else None
        )
    current = ["assigned"]
    succeeded = False

    def step(status, progress, message):
        current[0] = status
        update(site_id, status, progress, message)
        if status == "installing":
            notify(site_id, "milestone")

    notify(site_id, "started")
    try:
        with ActivityLogger().operation(
            "site.provision",
            f"Site provisioning: {service.site.slug}",
            category="deployment",
            tenant_slug=service.site.slug,
            server_name=service.server.name,
        ) as op:
            op.ok(
                "Provisioning started",
                message=f"{service.site.domain} on {service.server.name}",
                details={"port": service.site.port, "apps": service.site.app_names},
            )
            service.prepare()
            op.ok("Deployment folder and Compose file prepared")
            step("pulling", 15, "Downloading the AlgoSuite platform.")
            op.ok("pulling", message="Downloading the AlgoSuite platform.")
            service.run(["pull"])
            service.run(
                [
                    "up",
                    "-d",
                    "--wait",
                    "--wait-timeout",
                    "180",
                    *service.infrastructure(),
                ]
            )
            step("configuring", 35, "Configuring the database and background services.")
            op.ok(
                "configuring",
                message="Configuring the database and background services.",
            )
            service.run(["run", "--rm", "configurator"])
            step(
                "installing",
                55,
                "Creating your site and installing the selected applications.",
            )
            op.ok(
                "installing",
                message="Creating your site and installing the selected applications.",
            )
            service.run(["run", "--rm", "create-site"], timeout=2700)
            step("starting", 80, "Starting the application and checking its health.")
            op.ok(
                "starting", message="Starting the application and checking its health."
            )
            service.run(
                [
                    "up",
                    "-d",
                    "backend",
                    "frontend",
                    "websocket",
                    "queue-short",
                    "queue-long",
                    "scheduler",
                ]
            )
            for _ in range(36):
                if service.healthy():
                    break
                time.sleep(5)
            else:
                raise RuntimeError("The application did not become healthy.")
            try:
                service.apply_limits(service.site.user_limit)
                op.ok(
                    "Plan seat limit applied",
                    message=str(service.site.user_limit or "unlimited"),
                )
            except Exception as exc:
                op.warn("Seat limit not applied yet", message=str(exc)[:300])
            step("routing", 90, "Connecting your site address to the application.")
            op.ok("routing", message="Connecting your site address to the application.")
            with database.session() as session:
                ProxyConfigurationService(settings).sync_all(session)
            update(
                site_id,
                "ready",
                100,
                "Your site is ready. Sign in with the email and password you chose.",
                error=None,
                failed_step=None,
            )
            with database.session() as session:
                trials.activated(session, uuid.UUID(site_id))
            succeeded = True
            try:
                service.scrub_setup()
            except Exception:
                pass
    except Exception as failure:
        label = dict(STEP_FLOW).get(current[0], "deployment")
        reason = f'Deployment stopped at "{label}". '
        if isinstance(failure, SetupUnavailable):
            reason = str(failure) + " "
        cleaned = True
        try:
            service.run(["down", "--remove-orphans"], timeout=120)
        except Exception as cleanup_error:
            cleaned = False
            ActivityLogger().event(
                "deployment",
                "site.provision",
                "Cleanup failed",
                status="failed",
                message="docker compose down failed",
                error=format_exception(cleanup_error),
                tenant_slug=service.site.slug,
                server_name=service.server.name,
            )
        if cleaned:
            update(
                site_id,
                "failed",
                0,
                "Site provisioning failed. The containers were stopped and your data volumes were preserved. You can retry or contact support.",
                error=reason + "Your data was preserved.",
                failed_step=current[0],
            )
        else:
            update(
                site_id,
                "cleanup_required",
                0,
                "Site provisioning failed and cleanup could not finish. Contact support; server capacity remains reserved.",
                error=reason + "Support needs to check the server.",
                failed_step=current[0],
            )
        with database.session() as session:
            try:
                ProxyConfigurationService(settings).sync_all(session)
            except Exception:
                pass
    # Notification delivery has its own retry lifecycle and cannot fail provisioning.
    notify(site_id, "ready" if succeeded else "failed")


class SiteActionTask(celery_app.Task):
    abstract = True

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        site_id, action, origin = (list(args) + [None, None, None])[:3]
        if not site_id:
            return
        with database.session() as session:
            site = session.get(Site, uuid.UUID(site_id))
            if not site:
                return
            if action == "backup":
                site.activity = None
            elif site.status in ("stopping", "restarting"):
                site.status = (
                    origin
                    if origin in ("ready", "stopped", "deactivated")
                    else ("stopped" if action == "start" else "ready")
                )
                site.error = (
                    f"Could not {action} the site. Try again, or contact support."
                )


@celery_app.task(
    bind=True,
    base=SiteActionTask,
    name="site.action",
    soft_time_limit=1700,
    time_limit=1800,
)
def site_action_task(self, site_id, action, origin=None):
    with database.session() as session:
        site = session.get(Site, uuid.UUID(site_id))
        if not site:
            return
        service = build_service(session, site)
        slug, previous = service.site.slug, site.status
    logger = ActivityLogger()
    try:
        with logger.operation(
            f"site.{action}",
            f"Site {action}: {slug}",
            category="deployment",
            tenant_slug=slug,
            server_name=service.server.name,
        ) as op:
            if action == "stop":
                service.stop()
                update(
                    site_id,
                    "stopped",
                    100,
                    "The site is stopped. Start it again whenever you like.",
                    error=None,
                )
            elif action == "deactivate":
                service.stop()
                update(
                    site_id,
                    "deactivated",
                    100,
                    "The site is deactivated. Its data is kept; reactivate it to use it again.",
                    error=None,
                )
                sync_proxy()
            elif action in ("start", "restart", "reactivate"):
                service.restart() if action == "restart" else service.start()
                for _ in range(36):
                    if service.healthy():
                        break
                    time.sleep(5)
                else:
                    raise RuntimeError("The application did not become healthy.")
                update(site_id, "ready", 100, "Your site is ready.", error=None)
                if action == "reactivate":
                    sync_proxy()
            elif action == "backup":
                output, _ = run_backup(service, site_id, "manual")
                update(
                    site_id,
                    previous,
                    100,
                    "Backup completed.",
                    error=None,
                    activity=None,
                )
            op.ok(f"{action} completed")
            if action == "backup":
                op.ok("bench backup output", details={"output": output[-4000:]})
    except Exception:
        # Containers may be in any state after a failed stop/start; report what is true.
        if action == "backup":
            update(
                site_id,
                previous,
                100,
                "The last backup failed.",
                error="The backup could not be completed. Try again, or contact support.",
                activity=None,
            )
        else:
            failed_to = (
                origin
                if origin in ("ready", "stopped", "deactivated")
                else ("ready" if action in ("stop", "restart") else "stopped")
            )
            update(
                site_id,
                failed_to,
                100,
                f"The site could not be {action}ed."
                if action != "stop"
                else "The site could not be stopped.",
                error=f"Could not {action} the site. Try again, or contact support.",
            )
        raise


@celery_app.task(bind=True, name="site.delete", soft_time_limit=1700, time_limit=1800)
def delete_site_task(self, site_id, previous_status, force=False):
    """Permanently delete a site and everything it owns. The route has set status 'deleting'."""
    with database.session() as session:
        site = session.get(Site, uuid.UUID(site_id))
        if not site:
            return
        service = build_service(session, site)
        slug, server_id = service.site.slug, site.server_id
        drop_database = bool(site.db_server_id) and previous_status in (
            "ready",
            "stopped",
            "stopping",
            "restarting",
        )
    try:
        with ActivityLogger().operation(
            "site.delete",
            f"Site deletion: {slug}",
            category="deployment",
            tenant_slug=slug,
            server_name=service.server.name,
        ) as op:
            problems = service.destroy(drop_database, force=force)
            for problem in problems:
                op.warn("Step failed (forced past it)", message=problem[:500])
            if drop_database and service.database_name and service.external_db:
                db = service.external_db
                try:
                    removed = remove_site_database(
                        db["controller_host"],
                        db["port"],
                        db["user"],
                        db["password"],
                        service.database_name,
                        db.get("sslmode", "disable"),
                    )
                    if removed:
                        op.warn(
                            "bench left the database behind; removed it directly",
                            message=", ".join(removed),
                        )
                    else:
                        op.ok("Database dropped", message=service.database_name)
                except Exception as exc:
                    if not force:
                        raise
                    op.warn(
                        "Could not verify the database was dropped",
                        message=str(exc)[:300],
                    )
            with database.session() as session:
                site = session.get(Site, uuid.UUID(site_id))
                if site:
                    trials.release_if_unused(session, site)
                    session.delete(site)
                    session.flush()
                    from app.controller.server import ServerController

                    ServerController(session, settings).refresh_capacity(
                        session.get(ServerNode, server_id)
                    )
            with database.session() as session:
                try:
                    ProxyConfigurationService(settings).sync_all(session)
                except Exception:
                    op.warn(
                        "Proxy sync failed",
                        message="The route disappears at the next sync.",
                    )
            op.ok("Site deleted")
    except Exception:
        update(
            site_id,
            "cleanup_required",
            0,
            "The site could not be fully deleted. Contact support; nothing more was removed.",
            error="Deletion stopped part-way. Support needs to finish removing this site.",
        )
        raise


def limit_state(site, user_count, storage_mb):
    """'ok', 'users', 'storage' or 'both', from the latest measurements against the plan."""
    over_users = (
        site.user_limit is not None
        and user_count is not None
        and user_count > site.user_limit
    )
    over_storage = storage_mb is not None and storage_mb > site.storage_limit_gb * 1024
    return (
        "both"
        if over_users and over_storage
        else "users"
        if over_users
        else "storage"
        if over_storage
        else "ok"
    )


@celery_app.task(name="site.audit_limits", soft_time_limit=1500, time_limit=1700)
def audit_limits_task(site_ids=None):
    with database.session() as session:
        query = select(Site).where(Site.status == "ready", Site.activity.is_(None))
        if site_ids is not None:
            query = query.where(Site.id.in_([uuid.UUID(i) for i in site_ids]))
        sites = [(str(site.id), site.slug) for site in session.scalars(query)]
    for site_id, slug in sites:
        try:
            with database.session() as session:
                site = session.get(Site, uuid.UUID(site_id))
                if not site or site.status != "ready" or site.activity:
                    continue
                service = build_service(session, site)
            users, usage = service.count_users(), service.usage()
            with database.session() as session:
                site = session.get(Site, uuid.UUID(site_id))
                if not site:
                    continue
                site.user_count, site.storage_used_mb = users, usage["storage_mb"]
                site.limit_state = limit_state(site, users, usage["storage_mb"])
                site.audited_at = datetime.now(timezone.utc)
                limit = site.user_limit
            # The seat-limit script is the enforcement; put it back if a customer removed it.
            if limit is not None:
                service.apply_limits(limit)
        except Exception as exc:
            ActivityLogger().event(
                "health",
                "site.audit",
                "Limit audit failed",
                status="warning",
                message=str(exc)[:300],
                tenant_slug=slug,
            )


KEEP = {"scheduled": None, "safety": 2}


def run_backup(service, site_id, kind):
    before = {group["stamp"] for group in service.backup_sets()}
    output = service.backup()
    fresh = [
        group["stamp"]
        for group in service.backup_sets()
        if group["stamp"] not in before
    ]
    with database.session() as session:
        site = session.get(Site, uuid.UUID(site_id))
        for stamp in fresh:
            session.add(SiteBackup(site_id=site.id, stamp=stamp, kind=kind))
        site.last_backup_at = datetime.now(timezone.utc)
        keep = KEEP.get(kind)
        if kind == "scheduled":
            keep = site.backup_retention
        stale = []
        if keep is not None:
            rows = session.scalars(
                select(SiteBackup)
                .where(SiteBackup.site_id == site.id, SiteBackup.kind == kind)
                .order_by(SiteBackup.stamp.desc())
            ).all()
            stale = rows[keep:]
            stale_stamps = [row.stamp for row in stale]
            for row in stale:
                session.delete(row)
    if stale:
        service.delete_backup_sets(stale_stamps)
    return output, fresh


@celery_app.task(name="site.scheduled_backups", soft_time_limit=3000, time_limit=3300)
def scheduled_backups_task(site_ids=None):
    interval = {"daily": timedelta(days=1), "weekly": timedelta(days=7)}
    now = datetime.now(timezone.utc)
    with database.session() as session:
        query = select(Site).where(
            Site.status == "ready",
            Site.activity.is_(None),
            Site.backup_schedule != "off",
        )
        if site_ids is not None:
            query = query.where(Site.id.in_([uuid.UUID(i) for i in site_ids]))
        candidates = [
            str(site.id)
            for site in session.scalars(query)
            if site.last_backup_at is None
            or now - site.last_backup_at >= interval[site.backup_schedule]
        ]
    for site_id in candidates:
        with database.session() as session:
            claimed = session.execute(
                update_table(Site)
                .where(
                    Site.id == uuid.UUID(site_id),
                    Site.status == "ready",
                    Site.activity.is_(None),
                )
                .values(activity="backup")
            ).rowcount
            if not claimed:
                continue
            site = session.get(Site, uuid.UUID(site_id))
            service, slug, schedule = (
                build_service(session, site),
                site.slug,
                site.backup_schedule,
            )
        try:
            with ActivityLogger().operation(
                "site.scheduled_backup",
                f"Scheduled backup: {slug}",
                category="deployment",
                tenant_slug=slug,
                server_name=service.server.name,
            ) as op:
                _, fresh = run_backup(service, site_id, "scheduled")
                op.ok("Backup completed", details={"stamps": fresh})
        except Exception:
            # Try again in a couple of hours rather than on every sweep.
            with database.session() as session:
                site = session.get(Site, uuid.UUID(site_id))
                if site:
                    site.last_backup_at = (
                        datetime.now(timezone.utc)
                        - interval[schedule]
                        + timedelta(hours=2)
                    )
        finally:
            with database.session() as session:
                site = session.get(Site, uuid.UUID(site_id))
                if site:
                    site.activity = None


@celery_app.task(bind=True, name="site.restore", soft_time_limit=3400, time_limit=3500)
def restore_site_task(self, site_id, stamp, origin="ready"):
    with database.session() as session:
        site = session.get(Site, uuid.UUID(site_id))
        if not site:
            return
        service = build_service(session, site)
        slug, user_limit = service.site.slug, site.user_limit

    def settle():
        for _ in range(60):
            if service.healthy():
                return
            time.sleep(5)
        raise RuntimeError("The application did not become healthy.")

    safety = None
    try:
        with ActivityLogger().operation(
            "site.restore",
            f"Backup restore: {slug} from {stamp}",
            category="deployment",
            tenant_slug=slug,
            server_name=service.server.name,
        ) as op:
            _, made = run_backup(service, site_id, "safety")
            safety = made[0] if made else None
            op.ok("Safety backup taken", message=safety or "none")
            service.restore(stamp)
            op.ok("Backup restored and site migrated")
            service.start()
            settle()
            service.apply_limits(
                user_limit
            )  # the restored database carries the old seat-limit script
            update(site_id, "ready", 100, "Your backup has been restored.", error=None)
    except Exception:
        recovered = False
        if safety:
            try:
                service.restore(safety)
                service.start()
                settle()
                service.apply_limits(user_limit)
                recovered = True
            except Exception:
                recovered = False
        if recovered:
            update(
                site_id,
                "ready",
                100,
                "The restore failed and your previous data was put back.",
                error="The backup could not be restored. Your site was returned to how it was before.",
            )
        else:
            update(
                site_id,
                "stopped",
                100,
                "The restore failed.",
                error="The restore failed and the site could not be returned to its previous state. It has been stopped; contact support, your safety backup is kept.",
            )
        raise


def sync_proxy():
    with database.session() as session:
        try:
            ProxyConfigurationService(settings).sync_all(session)
        except Exception:
            pass  # The next sync, or the next sweep, corrects it.


class PlanChangeRefused(RuntimeError):
    """The new plan cannot hold the site as it is today (e.g. more users than its seats)."""


@celery_app.task(
    bind=True, name="site.change_plan", soft_time_limit=1700, time_limit=1800
)
def change_plan_task(self, site_id, plan, origin):
    with database.session() as session:
        site = session.get(Site, uuid.UUID(site_id))
        if not site:
            return
        service = build_service(session, site)
        slug = service.site.slug
        old = {
            "memory_limit_mb": site.memory_limit_mb,
            "cpu_limit": site.cpu_limit,
            "storage_limit_gb": site.storage_limit_gb,
            "user_limit": site.user_limit,
        }
    new = {
        "memory_limit_mb": plan["ram_mb"],
        "cpu_limit": plan["cpu"],
        "storage_limit_gb": plan["storage_gb"],
        "user_limit": plan["user_limit"],
    }

    def point_snapshot_at(values):
        for key, value in values.items():
            setattr(service.site, key, value)

    def settle():
        for _ in range(36):
            if service.healthy():
                return
            time.sleep(5)
        raise RuntimeError("The application did not become healthy.")

    try:
        with ActivityLogger().operation(
            "site.change_plan",
            f"Plan change: {slug} to {plan['name']}",
            category="deployment",
            tenant_slug=slug,
            server_name=service.server.name,
        ) as op:
            users = service.count_users()
            if plan["user_limit"] is not None and users > plan["user_limit"]:
                raise PlanChangeRefused(
                    f"You have {users} active users and {plan['name']} allows {plan['user_limit']}. Disable some users first, or pick a larger plan."
                )
            point_snapshot_at(new)
            service.rewrite_compose()
            op.ok("Container limits updated", details=new)
            service.start()  # recreates the containers whose limits changed
            settle()
            service.apply_limits(plan["user_limit"])
            op.ok("Seat limit applied", message=str(plan["user_limit"] or "unlimited"))
            update(
                site_id,
                "ready",
                100,
                f"Your site is now on {plan['name']}.",
                error=None,
                plan_id=plan["id"],
                plan_name=plan["name"],
                **new,
            )
    except PlanChangeRefused as refused:
        update(site_id, origin, 100, "The plan was not changed.", error=str(refused))
    except Exception:
        try:
            point_snapshot_at(old)
            service.rewrite_compose()
            service.start()
        except Exception:
            pass
        update(
            site_id,
            "ready" if origin == "ready" else origin,
            100,
            "The plan could not be changed.",
            error="The plan change failed and was rolled back. Try again, or contact support.",
        )
        raise


def notify(site_id, event, **extra):
    """Queue a customer notification; delivery has its own retries and never fails provisioning."""
    try:
        if extra:
            notify_site_task.delay(site_id, event, extra)
        else:
            notify_site_task.delay(site_id, event)
    except Exception:
        pass


@celery_app.task(
    bind=True,
    name="site.notify",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=5,
)
def notify_site_task(self, site_id, event="status", extra=None):
    with database.session() as session:
        site = session.get(Site, uuid.UUID(site_id))
        if not site:
            return
        payload = json.dumps(
            {
                "site_id": site_id,
                "user_id": site.user_id,
                "event": event,
                **(extra or {}),
            }
        ).encode()
    req = urllib.request.Request(
        settings.platform_internal_url.rstrip("/") + "/api/internal/site-events",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Controller-Key": settings.controller_internal_api_key,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        if response.status != 200:
            raise RuntimeError("Site event could not be delivered.")
