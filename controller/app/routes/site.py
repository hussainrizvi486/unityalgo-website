"""Private API for customer Frappe sites. Ownership comes from the Next.js guard."""

import json
import re
import secrets
import uuid
from datetime import timedelta
from flask import Blueprint
from sqlalchemy import select, text, func
from sqlalchemy.orm import joinedload
from app.routes.base import BaseView
from app.errors import ValidationError, ConflictError, NotFoundError
from app.models.site import Site, STEP_FLOW
from app.models.platform import PlatformUser
from app.models.database_connection import DatabaseConnection
from app.models.site_extras import SiteBackup, SiteDomain
from app.models.activity import Operation
from app.models.server import ServerNode
from app.models.deployment import Deployment
from app.controller.server import ServerController
from app.services.site_runtime import build_service
from app.services.port_allocator import allocate_port
from app.services.crypto import encrypt
from app.services.trials import (
    describe as describe_trial,
    MAX_TRIAL_DAYS,
    begin as begin_trial,
    used_plan_ids,
    release_if_unused,
)

SLUG = re.compile(r"^[a-z][a-z0-9-]{2,47}$")
EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$")
CURRENCY = re.compile(r"^[A-Z]{3,10}$")
COA_TYPES = ("standard", "numbered")
RESERVED_SLUGS = frozenset(
    "www admin api app apps mail smtp imap ftp ns ns1 ns2 cloud dashboard portal support status billing blog docs help login register root test demo unityalgo erp erpnext frappe caddy proxy".split()
)

STEP_KEYS = [key for key, _ in STEP_FLOW]


def slug_problem(slug, session=None):
    """Return a customer-facing reason the slug cannot be used, or None."""
    if not SLUG.fullmatch(slug) or slug.endswith("-") or "--" in slug:
        return "Use 3–48 lowercase letters, numbers and single hyphens, starting with a letter."
    if slug in RESERVED_SLUGS:
        return "This site name is reserved. Choose another."
    if session is not None and session.scalar(select(Site.id).where(Site.slug == slug)):
        return "This site name is already taken."
    return None


def build_steps(site):
    failed = site.status in ("failed", "cleanup_required")
    if site.status in (
        "ready",
        "stopping",
        "stopped",
        "restarting",
        "deactivated",
        "restoring",
        "updating",
    ):
        current = len(STEP_FLOW)
    elif failed:
        current = (
            STEP_KEYS.index(site.failed_step) if site.failed_step in STEP_KEYS else 0
        )
    else:
        current = (
            STEP_KEYS.index(site.status) if site.status in STEP_KEYS else 0
        )  # 'assigned' and 'queued' are still the first step
    result = []
    for index, (key, label) in enumerate(STEP_FLOW):
        if index < current:
            state = "done"
        elif index == current:
            state = "failed" if failed else "active"
        else:
            state = "pending"
        result.append({"key": key, "label": label, "state": state})
    return result

NO_CAPACITY = ("We're at full capacity right now, so we can't create new sites. We're adding servers and will open "
               "site creation again shortly. Please check back soon.")
HOSTING_UNAVAILABLE = 'Site hosting is not ready yet. Please contact support.'


def fits_site(
    server, slots, used_mb, reserved_sites, settings, need=None, used_cpu=0.0
):

    if not (
        server.is_active
        and server.role == "worker"
        and server.frappe_enabled
        and server.last_check_status == "ok"
        and slots + 10 <= server.max_containers
    ):
        return False
    
    max_sites = getattr(server, "max_sites", None)
    if max_sites is not None and reserved_sites >= max_sites:
        return False
    if not need or not settings.frappe_enforce_capacity:
        return True
    if (
        used_mb + need["ram_mb"] + settings.node_memory_reserve_mb
        > server.max_memory_mb
    ):
        return False
    if (
        server.cpu_cores is None
        or used_cpu + need["cpu"] > server.cpu_cores * settings.frappe_cpu_overcommit
    ):
        return False
    if server.disk_total_gb is None or server.disk_used_gb is None:
        return False
    return server.disk_total_gb - server.disk_used_gb >= need["storage_gb"]


def used_cpu(session, server_id):
    """vCPUs already reserved by active sites on a worker."""
    return float(
        session.scalar(
            select(func.coalesce(func.sum(Site.cpu_limit), 0.0)).where(
                Site.server_id == server_id, Site.status.in_(Site.ACTIVE_STATUSES)
            )
        )
        or 0.0
    )


def site_need(site):
    return {
        "ram_mb": site.memory_limit_mb,
        "cpu": site.cpu_limit,
        "storage_gb": site.storage_limit_gb,
    }


def site_url(site):
    from app.config import settings

    if settings.site_links_direct:
        return f"http://{site.server.dial_host}:{site.port}"
    return f"https://{site.domain}"


def serialize(site):
    return {
        "id": str(site.id),
        "name": site.name,
        "slug": site.slug,
        "domain": site.domain,
        "url": site_url(site),
        "server_id": str(site.server_id),
        "server_name": site.server.name,
        "status": site.status,
        "progress": site.progress,
        "message": site.message,
        "apps": site.app_names,
        "db_server": site.db_server.name if site.db_server_id else None,
        "plan_id": site.plan_id,
        "plan_name": site.plan_name,
        "owner_email": site.owner_email,
        "activity": site.activity,
        "resources": {
            "vcpu": site.cpu_limit,
            "ram_mb": site.memory_limit_mb,
            "storage_gb": site.storage_limit_gb,
            "users": site.user_limit,
        },
        "limits": {
            "state": site.limit_state,
            "user_count": site.user_count,
            "storage_used_mb": site.storage_used_mb,
            "audited_at": site.audited_at.isoformat() if site.audited_at else None,
        },
        "backup": {
            "schedule": site.backup_schedule,
            "retention": site.backup_retention,
            "last_at": site.last_backup_at.isoformat() if site.last_backup_at else None,
        },
        "attempt": site.attempt,
        "error": site.error,
        "steps": build_steps(site),
        "trial": describe_trial(site),
        "created_at": site.created_at.isoformat(),
        "updated_at": site.updated_at.isoformat(),
    }


def owned_site(session, site_id, user_id):
    try:
        identifier = uuid.UUID(str(site_id))
    except ValueError:
        raise NotFoundError("Site not found.")
    site = session.scalar(
        select(Site)
        .options(joinedload(Site.server))
        .where(Site.id == identifier, Site.user_id == user_id)
    )
    if not site:
        raise NotFoundError("Site not found.")
    return site


class SitesView(BaseView):
    def get(self):
        user_id = self.str_arg("user_id")
        if not user_id:
            raise ValidationError("user_id is required.")
        with self.session() as session:
            sites = session.scalars(
                select(Site)
                .options(joinedload(Site.server))
                .where(Site.user_id == user_id)
                .order_by(Site.created_at.desc())
            ).all()
            return self.ok({"results": [serialize(site) for site in sites]})

    def plan_resources(self, data):
        """vCPU, RAM, storage and seat limit the plan grants, falling back to the platform defaults."""

        def number(key, default, low, high, cast):
            value = data.get(key)
            if value in (None, ""):
                return default
            try:
                value = cast(value)
            except (TypeError, ValueError):
                raise ValidationError(f"{key} must be a number.")
            if not low <= value <= high:
                raise ValidationError(f"{key} must be between {low} and {high}.")
            return value

        return {
            "cpu": number(
                "plan_vcpu", self.settings.frappe_default_vcpu, 0.25, 64, float
            ),
            "ram_mb": number(
                "plan_ram_mb", self.settings.frappe_default_ram_mb, 768, 262144, int
            ),
            "storage_gb": number(
                "plan_storage_gb",
                self.settings.frappe_default_storage_gb,
                1,
                10000,
                int,
            ),
            "user_limit": number("plan_user_limit", None, 1, 100000, int),
        }

    @staticmethod
    def pick_db_server(session, requested):
        query = select(DatabaseConnection).where(
            DatabaseConnection.engine == "mariadb", DatabaseConnection.role == "cluster"
        )
        if requested:
            try:
                query = query.where(DatabaseConnection.id == uuid.UUID(str(requested)))
            except ValueError:
                raise ValidationError("Choose a valid database server.")
            found = session.scalar(query)
            if not found:
                raise ValidationError(
                    "That database server is not an available MariaDB cluster."
                )
            return found
        return session.scalar(query.where(DatabaseConnection.is_default.is_(True)))

    def post(self):
        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError("Request body must be an object.")
        
        name, slug = (
            str(data.get("name", "")).strip(),
            str(data.get("slug", "")).strip().lower(),
        )
        try:
            request_key = str(uuid.UUID(str(data.get("request_key", ""))))
        except ValueError:
            raise ValidationError("A valid request_key is required.")
        if not name or len(name) > 100:
            raise ValidationError("Enter a site name of up to 100 characters.")
        problem = slug_problem(slug)
        if problem:
            raise ValidationError(problem)
        setup = {
            "company_name": str(data.get("company_name", "")).strip(),
            "country": str(data.get("country", "")).strip(),
            "currency": str(data.get("currency", "")).strip().upper(),
            "coa_type": str(data.get("coa_type", "")).strip().lower(),
            "owner_email": str(data.get("owner_email", "")).strip().lower(),
            "owner_password": str(data.get("owner_password", "")),
        }
        if not setup["company_name"] or len(setup["company_name"]) > 100:
            raise ValidationError("Enter a company name of up to 100 characters.")
        if not setup["country"] or len(setup["country"]) > 100:
            raise ValidationError("Choose a country.")
        
        if not CURRENCY.fullmatch(setup["currency"]):
            raise ValidationError("Choose a currency.")
        
        if setup["coa_type"] not in COA_TYPES:
            raise ValidationError("Chart of accounts must be standard or numbered.")
        
        if not EMAIL.fullmatch(setup["owner_email"]) or len(setup["owner_email"]) > 254:
            raise ValidationError("Enter a valid email address for the site owner.")
        if len(setup["owner_password"]) < 12 or len(setup["owner_password"]) > 128:
            raise ValidationError("Password must be 12–128 characters.")
        
        resources = self.plan_resources(data)
        plan_id, plan_name = (
            str(data.get("plan_id", "")).strip(),
            str(data.get("plan_name", "")).strip(),
        )
        if not plan_id or len(plan_id) > 64 or not plan_name or len(plan_name) > 100:
            raise ValidationError("Choose a plan.")
        
        trial_days = data.get("trial_days")
        if trial_days not in (None, ""):
            if (
                not isinstance(trial_days, int)
                or isinstance(trial_days, bool)
                or not 1 <= trial_days <= MAX_TRIAL_DAYS
            ):
                raise ValidationError(
                    f"A trial lasts between 1 and {MAX_TRIAL_DAYS} days."
                )
        else:
            trial_days = None
        password = secrets.token_urlsafe(24)
        apps = data.get("app_names", [])
        if not isinstance(apps, list) or not all(
            isinstance(app, str)
            and re.fullmatch(r"[a-z][a-z0-9_]*", app)
            and app in self.settings.frappe_available_apps
            for app in apps
        ):
            raise ValidationError(
                "An application is not available on the platform yet."
            )
        if not self.settings.frappe_site_domain:
            raise ConflictError("Site hosting is not configured yet.")
        with self.session() as session:
            # Serialises automatic placement with UnityCommerce placement too.
            session.execute(text("SET LOCAL lock_timeout = '5s'"))
            session.execute(
                text(
                    "SELECT pg_advisory_xact_lock(hashtext('customer-site-placement'))"
                )
            )
            existing = session.scalar(
                select(Site)
                .options(joinedload(Site.server))
                .where(
                    Site.user_id == data.get("user_id"), Site.request_key == request_key
                )
            )
            if existing:
                return self.ok(serialize(existing))
            
            user = session.get(PlatformUser, data.get("user_id"))
            if not user or user.role != "CUSTOMER":
                raise ValidationError("Customer not found.")
            if slug_problem(slug, session):
                raise ConflictError("This site name is already taken.")
            if not ServerController(session, self.settings).proxy_node():
                raise ConflictError(
                    "A proxy server must be configured before creating sites."
                )
            db_server = self.pick_db_server(session, data.get("db_server_id"))
            server = None
            # Lock before recomputing load. Cached counters never drive placement.
            candidates = session.scalars(
                select(ServerNode)
                .where(
                    ServerNode.is_active.is_(True),
                    ServerNode.role == "worker",
                    ServerNode.frappe_enabled.is_(True),
                    ServerNode.last_check_status == "ok",
                )
                .order_by(ServerNode.max_memory_mb.desc())
                .with_for_update()
            ).all()
            load = ServerController(session, self.settings).node_load()
            for node in candidates:
                row = session.execute(
                    select(load.c.containers, load.c.used_mb).where(
                        load.c.server_id == node.id
                    )
                ).first()
                slots, used = row if row else (0, 0)
                reserved_sites = session.scalar(
                    select(func.count())
                    .select_from(Site)
                    .where(
                        Site.server_id == node.id, Site.status.in_(Site.ACTIVE_STATUSES)
                    )
                )

                if fits_site(
                    node,
                    slots,
                    used,
                    reserved_sites,
                    self.settings,
                    resources
                    and {
                        "ram_mb": resources["ram_mb"],
                        "cpu": resources["cpu"],
                        "storage_gb": resources["storage_gb"],
                    },
                    used_cpu(session, node.id),
                ):
                    server = node
                    break

            if not server:
                from app.services.activity_logger import ActivityLogger
                if not candidates:
                    workers = session.scalars(select(ServerNode).where(ServerNode.role == 'worker')).all()
                    ActivityLogger().event('deployment', 'site.create', 'No healthy worker for a new site', status='warning',
                                           message='; '.join(f'{node.name}: status={node.last_check_status or "not checked"}, active={node.is_active}, frappe_enabled={node.frappe_enabled}' for node in workers) or 'No worker servers are registered.')
                    raise ConflictError(HOSTING_UNAVAILABLE)
                ActivityLogger().event('deployment', 'site.create', 'No capacity for a new site', status='warning',
                                       message='No healthy worker could take %d MB RAM, %g vCPU, %d GB storage (full or at its site limit).' % (resources['ram_mb'], resources['cpu'], resources['storage_gb']))
                raise ConflictError(NO_CAPACITY)
            
            port = allocate_port(session, self.settings, server, self.settings.frappe_port_start, self.settings.frappe_port_end)
            site = Site(
                db_server_id=db_server.id if db_server else None,
                user_id=user.id,
                request_key=request_key,
                name=name,
                slug=slug,
                domain=f"{slug}.{self.settings.frappe_site_domain}",
                server_id=server.id,
                port=port,
                memory_limit_mb=resources["ram_mb"],
                cpu_limit=resources["cpu"],
                storage_limit_gb=resources["storage_gb"],
                user_limit=resources["user_limit"],
                image=self.settings.frappe_image,
                plan_id=plan_id,
                plan_name=plan_name,
                owner_email=setup["owner_email"],
                app_names=list(dict.fromkeys(["erpnext", *apps])),
                admin_password=password,
                db_password=secrets.token_urlsafe(32),
                status="queued",
                progress=0,
                message="Waiting for a provisioning worker.",
            )
            session.add(site)
            session.flush()
            if trial_days:
                begin_trial(session, site, trial_days)
                
            ServerController(session, self.settings).refresh_capacity(server)
            identifier = str(site.id)
        # Commit the reservation before the worker can consume the job.
        from app.tasks.site_tasks import provision_site_task

        try:
            provision_site_task.apply_async(
                args=[identifier],
                kwargs={"setup": encrypt(json.dumps(setup), self.settings)},
                task_id=identifier,
                retry=False,
            )
        except Exception:
            with self.session() as session:
                site = session.get(Site, uuid.UUID(identifier))
                if site and site.status == "queued":
                    server = session.get(ServerNode, site.server_id)
                    release_if_unused(session, site)
                    session.delete(site)
                    session.flush()
                    ServerController(session, self.settings).refresh_capacity(server)
            raise ConflictError(
                "The provisioning queue is unavailable right now. Nothing was created; please try again shortly."
            )
        with self.session() as session:
            return self.ok(
                serialize(owned_site(session, identifier, data["user_id"])), 201
            )


class SiteDetailView(BaseView):
    def get(self, site_id):
        with self.session() as session:
            return self.ok(
                serialize(owned_site(session, site_id, self.str_arg("user_id")))
            )


class SiteRetryView(BaseView):
    def post(self, site_id):
        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError("Request body must be an object.")
        with self.session() as session:
            session.execute(text("SET LOCAL lock_timeout = '5s'"))
            session.execute(
                text(
                    "SELECT pg_advisory_xact_lock(hashtext('customer-site-placement'))"
                )
            )
            site = owned_site(session, site_id, data.get("user_id"))
            if site.status != "failed":
                raise ConflictError("Only a failed, cleaned-up site can be retried.")
            server = session.scalar(
                select(ServerNode)
                .where(ServerNode.id == site.server_id)
                .with_for_update()
            )
            load = ServerController(session, self.settings).node_load()
            row = session.execute(
                select(load.c.containers, load.c.used_mb).where(
                    load.c.server_id == server.id
                )
            ).first()
            slots, used = row if row else (0, 0)
            reserved_sites = session.scalar(
                select(func.count())
                .select_from(Site)
                .where(
                    Site.server_id == server.id, Site.status.in_(Site.ACTIVE_STATUSES)
                )
            )
            if not fits_site(
                server,
                slots,
                used,
                reserved_sites,
                self.settings,
                site_need(site),
                used_cpu(session, server.id),
            ):
                raise ConflictError("The assigned server is not available for a retry.")
            site.status, site.progress, site.message = (
                "queued",
                0,
                "Waiting for a provisioning worker.",
            )
            site.error = site.failed_step = None
            site.attempt += 1
            ServerController(session, self.settings).refresh_capacity(server)
        from app.tasks.site_tasks import provision_site_task

        try:
            provision_site_task.apply_async(args=[site_id], retry=False)
        except Exception:
            with self.session() as session:
                site = owned_site(session, site_id, data.get("user_id"))
                site.status, site.message = (
                    "failed",
                    "The provisioning queue is unavailable.",
                )
                ServerController(session, self.settings).refresh_capacity(
                    session.get(ServerNode, site.server_id)
                )
            raise ConflictError("The provisioning queue is unavailable.")
        return self.ok({"queued": True}, 202)


def has_room(session, site, settings):
    server = session.get(ServerNode, site.server_id)
    load = ServerController(session, settings).node_load()
    row = session.execute(
        select(load.c.containers, load.c.used_mb).where(load.c.server_id == server.id)
    ).first()
    slots, used = row if row else (0, 0)
    reserved = session.scalar(
        select(func.count())
        .select_from(Site)
        .where(Site.server_id == server.id, Site.status.in_(Site.ACTIVE_STATUSES))
    )
    return fits_site(
        server,
        slots,
        used,
        reserved,
        settings,
        site_need(site),
        used_cpu(session, server.id),
    )


class SiteActionView(BaseView):

    # status the site must be in, and the marker/status set while the action runs
    TRANSITIONS = {
        "stop": (("ready",), "stopping", None),
        "start": (("stopped",), "restarting", None),
        "restart": (("ready",), "restarting", None),
        "backup": (("ready",), None, "backup"),
        "deactivate": (("ready", "stopped"), "stopping", None),
        "reactivate": (("deactivated",), "restarting", None),
    }

    enforce_trial = True

    def find(self, session, site_id, data):
        return owned_site(session, site_id, data.get("user_id"))

    def post(self, site_id, action):
        if action not in self.TRANSITIONS:
            raise NotFoundError("Unknown action.")
        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError("Request body must be an object.")
        allowed, transient, activity = self.TRANSITIONS[action]
        with self.session() as session:
            session.execute(text("SET LOCAL lock_timeout = '5s'"))
            site = self.find(session, site_id, data)
            site = session.scalar(
                select(Site)
                .where(Site.id == site.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if site.activity:
                raise ConflictError(
                    "Another operation is already running on this site."
                )
            if site.status not in allowed:
                raise ConflictError(
                    f"The site cannot be {action}ed while it is {site.status.replace('_', ' ')}."
                )
            origin = site.status
            if (
                action in ("start", "reactivate")
                and self.enforce_trial
                and site.trial_ends_at
                and site.trial_expired_at
            ):
                raise ConflictError(
                    "Your free trial has ended. Subscribe to this plan to use your site again."
                )
            if action == "reactivate" and not has_room(session, site, self.settings):
                raise ConflictError(
                    "The server does not have room to reactivate this site right now. Please try again later or contact support."
                )
            if transient:
                site.status, site.message = (
                    transient,
                    {
                        "stopping": "Stopping the site…"
                        if action == "stop"
                        else "Deactivating the site…",
                        "restarting": "Restarting the site…"
                        if action != "reactivate"
                        else "Reactivating the site…",
                    }[transient],
                )
            if activity:
                site.activity, site.message = activity, "Creating a backup…"
            site.error = None
        from app.tasks.site_tasks import site_action_task

        try:
            site_action_task.apply_async(args=[site_id, action, origin], retry=False)
        except Exception:
            with self.session() as session:
                site = self.find(session, site_id, data)
                site.status = origin if transient else site.status
                site.activity = None
            raise ConflictError(
                "The background queue is unavailable. Try again shortly."
            )
        return self.ok({"queued": True}, 202)


class SiteDeleteView(BaseView):

    DELETABLE = ("ready", "stopped", "deactivated", "failed")

    def post(self, site_id):
        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError("Request body must be an object.")
        with self.session() as session:
            session.execute(text("SET LOCAL lock_timeout = '5s'"))
            site = owned_site(session, site_id, data.get("user_id"))
            if str(data.get("confirm", "")).strip().lower() != site.slug:
                raise ValidationError("Type the site name exactly to confirm deletion.")
            site = session.scalar(
                select(Site)
                .where(Site.id == site.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if site.activity:
                raise ConflictError(
                    "Another operation is already running on this site."
                )
            if site.status not in self.DELETABLE:
                raise ConflictError(
                    f"A site that is {site.status.replace('_', ' ')} cannot be deleted yet."
                )
            previous = site.status
            site.status, site.message, site.error = (
                "deleting",
                "Deleting the site and its data…",
                None,
            )
        return queue_delete(self, site_id, previous, False)


def queue_delete(view, site_id, previous, force):
    from app.tasks.site_tasks import delete_site_task

    try:
        delete_site_task.apply_async(
            args=[site_id, previous], kwargs={"force": force}, retry=False
        )
    except Exception:
        with view.session() as session:
            site = session.get(Site, uuid.UUID(site_id))
            if site:
                site.status = previous
        raise ConflictError("The background queue is unavailable. Try again shortly.")
    return view.ok({"queued": True}, 202)


class AdminSitesView(BaseView):
    """GET /admin: every customer's site, for the admin panel."""

    def get(self):
        with self.session() as session:
            rows = session.execute(
                select(Site, PlatformUser.email)
                .options(joinedload(Site.server), joinedload(Site.db_server))
                .join(PlatformUser, PlatformUser.id == Site.user_id)
                .order_by(Site.created_at.desc())
            ).all()
            return self.ok(
                {
                    "results": [
                        dict(
                            serialize(site),
                            owner_account_email=email,
                            user_id=site.user_id,
                        )
                        for site, email in rows
                    ]
                }
            )


class AdminSiteForceDeleteView(BaseView):
    """POST /admin/<id>/force-delete: remove a site from any state, pressing past failing steps."""

    def post(self, site_id):
        with self.session() as session:
            site = session.scalar(
                select(Site).where(Site.id == uuid.UUID(str(site_id))).with_for_update()
            )
            if not site:
                raise NotFoundError("Site not found.")
            if site.status == "deleting":
                raise ConflictError("This site is already being deleted.")
            previous = site.status
            site.status, site.message, site.error = (
                "deleting",
                "An administrator is removing this site.",
                None,
            )
            site.activity = None
        return queue_delete(self, str(site_id), previous, True)


class SiteChangePlanView(BaseView):

    def post(self, site_id):
        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError("Request body must be an object.")
        resources = SitesView.plan_resources(self, data)
        plan_id, plan_name = (
            str(data.get("plan_id", "")).strip(),
            str(data.get("plan_name", "")).strip(),
        )
        if not plan_id or not plan_name:
            raise ValidationError("Choose a plan.")
        with self.session() as session:
            session.execute(text("SET LOCAL lock_timeout = '5s'"))
            site = owned_site(session, site_id, data.get("user_id"))
            site = session.scalar(
                select(Site)
                .where(Site.id == site.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if site.activity:
                raise ConflictError(
                    "Another operation is already running on this site."
                )
            if site.status != "ready":
                raise ConflictError(
                    "A site can change plan while it is running. Start it first."
                )
            if site.plan_id == plan_id:
                raise ConflictError("The site is already on this plan.")
            if (
                resources["user_limit"] is not None
                and site.user_count is not None
                and site.user_count > resources["user_limit"]
            ):
                raise ConflictError(
                    f"You have {site.user_count} active users and {plan_name} allows {resources['user_limit']}. Disable some users first."
                )
            # Only the growth beyond what this site already holds has to fit on its server.
            server = session.scalar(
                select(ServerNode)
                .where(ServerNode.id == site.server_id)
                .with_for_update()
            )
            load = ServerController(session, self.settings).node_load()
            row = session.execute(
                select(load.c.containers, load.c.used_mb).where(
                    load.c.server_id == server.id
                )
            ).first()
            slots, used = row if row else (0, 0)
            need = {
                "ram_mb": resources["ram_mb"],
                "cpu": resources["cpu"],
                "storage_gb": resources["storage_gb"],
            }
            if not fits_site(
                server,
                max(0, slots - site.container_slots),
                used - site.memory_limit_mb,
                0,
                self.settings,
                need,
                used_cpu(session, server.id) - site.cpu_limit,
            ):
                raise ConflictError(
                    f"The server does not have room for {plan_name} right now. Please try again later or contact support."
                )
            if data.get("dry_run") is True:
                return self.ok({"eligible": True})
            site.status, site.message, site.error = (
                "restarting",
                f"Applying {plan_name}…",
                None,
            )
            origin = "ready"
        from app.tasks.site_tasks import change_plan_task

        plan = {"id": plan_id, "name": plan_name, **resources}
        try:
            change_plan_task.apply_async(args=[site_id, plan, origin], retry=False)
        except Exception:
            with self.session() as session:
                owned_site(session, site_id, data.get("user_id")).status = origin
            raise ConflictError(
                "The background queue is unavailable. Try again shortly."
            )
        return self.ok({"queued": True}, 202)


class SiteResetPasswordView(BaseView):
    """POST /<id>/reset-password. Body: user_id, new_password. Sets the site owner's password."""

    def post(self, site_id):
        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError("Request body must be an object.")
        password = str(data.get("new_password", ""))
        if not 12 <= len(password) <= 128:
            raise ValidationError("Password must be 12–128 characters.")
        with self.session() as session:
            site = owned_site(session, site_id, data.get("user_id"))
            if site.status != "ready" or site.activity:
                raise ConflictError("The site must be running to reset its password.")
            if not site.owner_email:
                raise ConflictError("This site has no owner account on record.")
            service, email, slug = (
                build_service(session, site),
                site.owner_email,
                site.slug,
            )
        try:
            service.set_owner_password(email, password)
        except Exception:
            raise ConflictError(
                "The password could not be changed right now. Check that the site is running and try again."
            )
        from app.services.activity_logger import ActivityLogger

        ActivityLogger().event(
            "deployment",
            "site.reset_password",
            "Owner password reset",
            message="The site owner reset their password",
            tenant_slug=slug,
        )
        return self.ok({"ok": True})


def domain_info(row):
    return {
        "id": str(row.id),
        "domain": row.domain,
        "status": row.status,
        "error": row.error,
        "tls_status": row.tls_status,
        "verified_at": row.verified_at.isoformat() if row.verified_at else None,
    }


def domain_instructions(session, settings, site):
    proxy = ServerController(session, settings).proxy_node()
    return {"target": site.domain, "proxy_ips": [proxy.ip_address] if proxy else []}


def resync_proxy(settings):
    """Rebuild Caddy's routes from the database. Returns False when Caddy could not be updated."""
    from app.db import database
    from app.services.proxy_configuration_service import ProxyConfigurationService

    try:
        with database.session() as session:
            ProxyConfigurationService(settings).sync_all(session)
        return True
    except Exception:
        return False


class SiteDomainsView(BaseView):
    """GET /<id>/domains lists a site's custom domains; POST adds one (Body: user_id, domain)."""

    INSTALLED = (
        "ready",
        "stopped",
        "stopping",
        "restarting",
        "restoring",
        "updating",
        "deactivated",
    )

    def get(self, site_id):
        from app.services.custom_domains import probe_certificate

        with self.session() as session:
            site = owned_site(session, site_id, self.str_arg("user_id"))
            rows = session.scalars(
                select(SiteDomain)
                .where(SiteDomain.site_id == site.id)
                .order_by(SiteDomain.created_at)
            ).all()
            for row in rows:
                if row.status == "active" and row.tls_status != "active":
                    row.tls_status = (
                        "active"
                        if probe_certificate(row.domain, timeout=3)
                        else "pending"
                    )
            return self.ok(
                {
                    "results": [domain_info(row) for row in rows],
                    **domain_instructions(session, self.settings, site),
                    "limit": self.settings.frappe_domains_per_site,
                }
            )

    def post(self, site_id):
        from app.services.custom_domains import validate_domain

        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError("Request body must be an object.")
        domain, problem = validate_domain(
            data.get("domain"), self.settings.frappe_site_domain
        )
        if problem:
            raise ValidationError(problem)
        with self.session() as session:
            site = owned_site(session, site_id, data.get("user_id"))
            if site.status not in self.INSTALLED:
                raise ConflictError(
                    "Add a domain once your site has finished installing."
                )
            count = session.scalar(
                select(func.count())
                .select_from(SiteDomain)
                .where(SiteDomain.site_id == site.id)
            )
            if count >= self.settings.frappe_domains_per_site:
                raise ConflictError(
                    f"A site can have up to {self.settings.frappe_domains_per_site} custom domains."
                )
            if session.scalar(
                select(SiteDomain.id).where(SiteDomain.domain == domain)
            ) or session.scalar(select(Site.id).where(Site.domain == domain)):
                raise ConflictError("This domain is already in use.")
            row = SiteDomain(site_id=site.id, domain=domain, status="pending")
            session.add(row)
            session.flush()
            return self.ok(
                {
                    **domain_info(row),
                    **domain_instructions(session, self.settings, site),
                },
                201,
            )


class SiteDomainDetailView(BaseView):

    def post(self, site_id, domain_id):
        from datetime import datetime, timezone
        from app.services.custom_domains import check_dns

        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError("Request body must be an object.")
        with self.session() as session:
            site = owned_site(session, site_id, data.get("user_id"))
            row = self.row(session, site, domain_id)
            ips = domain_instructions(session, self.settings, site)["proxy_ips"]
            ok, reason = check_dns(row.domain, site.domain, ips)
            row.last_checked_at = datetime.now(timezone.utc)
            if not ok:
                row.status, row.error = "pending", reason
                return self.ok(domain_info(row))
            row.status, row.error, row.verified_at, row.tls_status = (
                "active",
                None,
                datetime.now(timezone.utc),
                "pending",
            )
        if not resync_proxy(self.settings):
            with self.session() as session:
                row = session.get(SiteDomain, uuid.UUID(str(domain_id)))
                row.status, row.error, row.verified_at = (
                    "pending",
                    "DNS is correct, but we could not update routing just now. Verify again in a moment.",
                    None,
                )
                return self.ok(domain_info(row))
        with self.session() as session:
            return self.ok(
                domain_info(session.get(SiteDomain, uuid.UUID(str(domain_id))))
            )

    def delete(self, site_id, domain_id):
        with self.session() as session:
            site = owned_site(session, site_id, self.str_arg("user_id"))
            session.delete(self.row(session, site, domain_id))
        resync_proxy(self.settings)
        return self.no_content()

    @staticmethod
    def row(session, site, domain_id):
        try:
            identifier = uuid.UUID(str(domain_id))
        except ValueError:
            raise NotFoundError("Domain not found.")
        row = session.scalar(
            select(SiteDomain).where(
                SiteDomain.id == identifier, SiteDomain.site_id == site.id
            )
        )
        if not row:
            raise NotFoundError("Domain not found.")
        return row


class SiteUsageView(BaseView):
    def find(self, session, site_id):
        return owned_site(session, site_id, self.str_arg("user_id"))

    def get(self, site_id):
        with self.session() as session:
            site = self.find(session, site_id)
            if site.status not in ("ready", "stopped"):
                raise ConflictError("Usage is available once the site is running.")
            service = build_service(session, site)
        try:
            return self.ok(service.usage())
        except Exception:
            raise ConflictError("Usage could not be read from the server right now.")


class SiteMetricsView(BaseView):

    def find(self, session, site_id):
        return owned_site(session, site_id, self.str_arg("user_id"))

    def get(self, site_id):
        from app.services.site_metrics import metrics_payload

        with self.session() as session:
            site = self.find(session, site_id)
            payload = metrics_payload(
                session,
                site,
                self.str_arg("range", "24h"),
                self.settings.site_metrics_interval_seconds,
            )
            first_reading = (
                payload["summary"]["samples"] == 0 and site.status == "ready"
            )
            identifier = str(site.id)
        if first_reading:
            try:
                from app.tasks.metrics_tasks import collect_metrics_task

                collect_metrics_task.apply_async(args=[[identifier]], retry=False)
            except Exception:
                pass
        return self.ok(payload)


class AdminSiteMetricsView(SiteMetricsView):
    """GET /admin/<id>/metrics?range=. The same readings, for any site."""

    def find(self, session, site_id):
        return site_by_id(session, site_id)


class SiteTrialsView(BaseView):

    def get(self):
        user_id = self.str_arg("user_id")
        if not user_id:
            raise ValidationError("user_id is required.")
        with self.session() as session:
            return self.ok({"used_plan_ids": used_plan_ids(session, user_id)})


class SiteTrialConvertView(BaseView):

    def post(self):
        data = self.json_body()
        if not isinstance(data, dict) or not data.get("user_id"):
            raise ValidationError("user_id is required.")
        from app.tasks.trial_tasks import expire_trials_task

        try:
            expire_trials_task.apply_async(
                kwargs={
                    "user_id": str(data["user_id"]),
                    "plan_id": str(data["plan_id"]) if data.get("plan_id") else None,
                },
                retry=False,
            )
        except Exception:
            raise ConflictError(
                "The background queue is unavailable. The trial will end at the next scheduled check."
            )
        return self.ok({"queued": True}, 202)


class AdminSiteTrialView(BaseView):

    def post(self, site_id):
        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError("Request body must be an object.")
        end = bool(data.get("end"))
        days = data.get("days")
        if not end and (
            not isinstance(days, int)
            or isinstance(days, bool)
            or not 1 <= days <= MAX_TRIAL_DAYS
        ):
            raise ValidationError(
                f"Extend a trial by between 1 and {MAX_TRIAL_DAYS} days."
            )
        from app.services import trials

        with self.session() as session:
            site = site_by_id(session, site_id)
            if site.trial_ends_at is None:
                raise ConflictError("This site is not on a free trial.")
            if end:
                site.trial_ends_at = trials.now()
            else:
                site.trial_ends_at = max(trials.now(), site.trial_ends_at) + timedelta(
                    days=days
                )
                site.trial_warned = False
                revive = site.trial_expired_at is not None
                site.trial_expired_at = None
        from app.tasks.trial_tasks import handle

        if end:
            handle(site_id)  # switch it off now rather than at the next sweep
        elif revive:
            with self.session() as session:
                site = site_by_id(session, site_id)
                if (
                    site.status == "deactivated"
                    and not site.activity
                    and has_room(session, site, self.settings)
                ):
                    site.status, site.message, site.error = (
                        "restarting",
                        "Your trial was extended. Reactivating your site…",
                        None,
                    )
                    revived = True
                else:
                    revived = False
            if revived:
                from app.tasks.site_tasks import site_action_task

                site_action_task.apply_async(
                    args=[site_id, "reactivate", "deactivated"], retry=False
                )
        with self.session() as session:
            return self.ok(serialize(site_by_id(session, site_id)))


class SiteBackupsView(BaseView):
    def get(self, site_id):
        with self.session() as session:
            site = owned_site(session, site_id, self.str_arg("user_id"))
            schedule = {
                "schedule": site.backup_schedule,
                "retention": site.backup_retention,
                "last_at": site.last_backup_at.isoformat()
                if site.last_backup_at
                else None,
            }
            if site.status != "ready":
                return self.ok({"results": [], "available": False, **schedule})
            kinds = dict(
                session.execute(
                    select(SiteBackup.stamp, SiteBackup.kind).where(
                        SiteBackup.site_id == site.id
                    )
                ).all()
            )
            service = build_service(session, site)
        try:
            sets = service.backup_sets()
        except Exception:
            raise ConflictError(
                "Backups could not be listed from the server right now."
            )
        return self.ok(
            {
                "results": [
                    dict(group, kind=kinds.get(group["stamp"], "manual"))
                    for group in sets
                ],
                "available": True,
                **schedule,
            }
        )


class SiteBackupSettingsView(BaseView):
    """POST /<id>/backup-settings. Body: user_id, schedule (off|daily|weekly), retention (1-30)."""

    def post(self, site_id):
        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError("Request body must be an object.")
        schedule = str(data.get("schedule", ""))
        if schedule not in ("off", "daily", "weekly"):
            raise ValidationError("Schedule must be off, daily or weekly.")
        try:
            retention = int(data.get("retention", 7))
        except (TypeError, ValueError):
            raise ValidationError("Keep between 1 and 30 backups.")
        if not 1 <= retention <= 30:
            raise ValidationError("Keep between 1 and 30 backups.")
        with self.session() as session:
            site = owned_site(session, site_id, data.get("user_id"))
            site.backup_schedule, site.backup_retention = schedule, retention
            return self.ok({"schedule": schedule, "retention": retention})


class SiteRestoreView(BaseView):

    def post(self, site_id):
        import re

        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError("Request body must be an object.")
        stamp = str(data.get("stamp", ""))
        if not re.fullmatch(r"\d{8}_\d{6}", stamp):
            raise ValidationError("Choose a backup to restore.")
        with self.session() as session:
            session.execute(text("SET LOCAL lock_timeout = '5s'"))
            site = owned_site(session, site_id, data.get("user_id"))
            if str(data.get("confirm", "")).strip().lower() != site.slug:
                raise ValidationError(
                    "Type the site name exactly to confirm the restore."
                )
            site = session.scalar(
                select(Site)
                .where(Site.id == site.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if site.activity:
                raise ConflictError(
                    "Another operation is already running on this site."
                )
            if site.status != "ready":
                raise ConflictError("Start the site before restoring a backup.")
            site.status, site.message, site.error = (
                "restoring",
                "Restoring your backup. The site is offline until it finishes…",
                None,
            )
        from app.tasks.site_tasks import restore_site_task

        try:
            restore_site_task.apply_async(args=[site_id, stamp, "ready"], retry=False)
        except Exception:
            with self.session() as session:
                owned_site(session, site_id, data.get("user_id")).status = "ready"
            raise ConflictError(
                "The background queue is unavailable. Try again shortly."
            )
        return self.ok({"queued": True}, 202)


class SiteBackupDownloadView(BaseView):
    def get(self, site_id, name):
        from flask import Response

        with self.session() as session:
            site = owned_site(session, site_id, self.str_arg("user_id"))
            if site.status != "ready":
                raise ConflictError("Start the site before downloading a backup.")
            service = build_service(session, site)
        try:
            chunks = service.stream_backup(name)
            first = next(chunks, b"")
        except ValueError:
            raise ValidationError("Invalid backup name.")
        except Exception:
            raise ConflictError("The backup could not be read from the server.")

        def body():
            yield first
            yield from chunks

        return Response(
            body(),
            headers={
                "Content-Type": "application/octet-stream",
                "Content-Disposition": f'attachment; filename="{name}"',
                "Cache-Control": "private, no-store",
            },
        )


def site_by_id(session, site_id):
    try:
        identifier = uuid.UUID(str(site_id))
    except ValueError:
        raise NotFoundError("Site not found.")
    site = session.scalar(
        select(Site)
        .options(joinedload(Site.server), joinedload(Site.db_server))
        .where(Site.id == identifier)
    )
    if not site:
        raise NotFoundError("Site not found.")
    return site


class AdminSiteActionView(SiteActionView):

    enforce_trial = False

    def find(self, session, site_id, data):
        return site_by_id(session, site_id)


class AdminSiteUsageView(SiteUsageView):
    def find(self, session, site_id):
        return site_by_id(session, site_id)


class AdminSiteDetailView(BaseView):
    """GET /admin/<id>: one site with everything an operator needs to diagnose it."""

    def get(self, site_id):
        with self.session() as session:
            site = site_by_id(session, site_id)
            owner = session.get(PlatformUser, site.user_id)
            domains = session.scalars(
                select(SiteDomain)
                .where(SiteDomain.site_id == site.id)
                .order_by(SiteDomain.created_at)
            ).all()
            backups = session.scalars(
                select(SiteBackup)
                .where(SiteBackup.site_id == site.id)
                .order_by(SiteBackup.stamp.desc())
                .limit(30)
            ).all()
            operations = session.scalars(
                select(Operation)
                .where(
                    Operation.tenant_slug == site.slug, Operation.kind.like("site.%")
                )
                .order_by(Operation.started_at.desc())
                .limit(25)
            ).all()
            server = site.server
            db = site.db_server
            return self.ok(
                {
                    "site": dict(
                        serialize(site),
                        owner_account_email=owner.email if owner else None,
                        user_id=site.user_id,
                    ),
                    "server": {
                        "id": str(server.id),
                        "name": server.name,
                        "ip_address": server.ip_address,
                        "port": site.port,
                        "memory_mb": server.max_memory_mb,
                        "cpu_cores": server.cpu_cores,
                        "status": server.last_check_status,
                    },
                    "database": {"name": db.name, "host": db.host, "engine": db.engine}
                    if db
                    else None,
                    "domains": [domain_info(row) for row in domains],
                    "backups": [
                        {
                            "stamp": row.stamp,
                            "kind": row.kind,
                            "created_at": row.created_at.isoformat(),
                        }
                        for row in backups
                    ],
                    "operations": [
                        {
                            "id": str(op.id),
                            "kind": op.kind,
                            "label": op.label,
                            "status": op.status,
                            "started_at": op.started_at.isoformat()
                            if op.started_at
                            else None,
                            "duration_ms": op.duration_ms,
                            "error": (op.error_message or "")
                            .strip()
                            .splitlines()[-1][:300]
                            if op.error_message
                            else None,
                        }
                        for op in operations
                    ],
                }
            )


class AdminQueueStatusView(BaseView):

    def get(self):
        import redis
        from app.tasks.celery_app import celery_app

        try:
            workers = len(celery_app.control.ping(timeout=1.5) or [])
        except Exception:
            workers = 0
        try:
            waiting = int(
                redis.Redis.from_url(
                    self.settings.celery_broker_url or self.settings.redis_url
                ).llen("tenant_ops")
            )
        except Exception:
            waiting = None
        with self.session() as session:
            pending = session.scalar(
                select(func.count())
                .select_from(Site)
                .where(
                    Site.status.in_(("queued", "deleting")) | Site.activity.isnot(None)
                )
            )
        return self.ok(
            {"workers": workers, "waiting": waiting, "sites_waiting": pending}
        )


class AdminSystemStatusView(BaseView):
    def get(self):
        from app.services.system_status import collect

        with self.session() as session:
            return self.ok(collect(self.settings, session))


class SiteCapabilitiesView(BaseView):
    def get(self):
        accepting, reason = self.site_availability()
        return self.ok({'apps': self.settings.frappe_available_apps, 'configured': bool(self.settings.frappe_site_domain),
                        'domain_suffix': self.settings.frappe_site_domain, 'accepting': accepting,
                        'unavailable_reason': reason})

    def accepting_sites(self):
        return self.site_availability()[0]

    def site_availability(self):
        """Can any server take another site? Health, container slots and the per-server site limit only: whether
        a particular plan fits is checked when the site is created."""
        with self.session() as session:
            nodes = session.scalars(select(ServerNode).where(ServerNode.is_active.is_(True), ServerNode.role == 'worker',
                                                             ServerNode.frappe_enabled.is_(True), ServerNode.last_check_status == 'ok')).all()
            if not nodes:
                return False, HOSTING_UNAVAILABLE
            load = ServerController(session, self.settings).node_load()
            for node in nodes:
                row = session.execute(
                    select(load.c.containers, load.c.used_mb).where(
                        load.c.server_id == node.id
                    )
                ).first()
                slots, used = row if row else (0, 0)
                reserved = session.scalar(
                    select(func.count())
                    .select_from(Site)
                    .where(
                        Site.server_id == node.id, Site.status.in_(Site.ACTIVE_STATUSES)
                    )
                )
                if fits_site(node, slots, used, reserved, self.settings):
                    return True, None
        return False, NO_CAPACITY


class SiteSlugCheckView(BaseView):
    def get(self):
        slug = (self.str_arg("slug") or "").strip().lower()
        with self.session() as session:
            problem = slug_problem(slug, session)
        return self.ok({"slug": slug, "available": problem is None, "reason": problem})


class SiteRoutes:
    @classmethod
    def blueprint(cls, db=None, config=None):
        bp = Blueprint("sites", __name__, url_prefix="/api/v1/sites")
        for path, view, name in [
            ("", SitesView, "collection"),
            ("/capabilities", SiteCapabilitiesView, "capabilities"),
            ("/check-slug", SiteSlugCheckView, "check_slug"),
            ("/<site_id>", SiteDetailView, "detail"),
            ("/<site_id>/retry", SiteRetryView, "retry"),
            ("/trials", SiteTrialsView, "trials"),
            ("/trials/convert", SiteTrialConvertView, "trial_convert"),
            ("/admin/<site_id>/trial", AdminSiteTrialView, "admin_trial"),
            ("/<site_id>/usage", SiteUsageView, "usage"),
            ("/<site_id>/metrics", SiteMetricsView, "metrics"),
            ("/admin/<site_id>/metrics", AdminSiteMetricsView, "admin_metrics"),
            ("/<site_id>/domains", SiteDomainsView, "domains"),
            ("/<site_id>/domains/<domain_id>", SiteDomainDetailView, "domain_detail"),
            (
                "/<site_id>/domains/<domain_id>/verify",
                SiteDomainDetailView,
                "domain_verify",
            ),
            ("/<site_id>/backups", SiteBackupsView, "backups"),
            ("/<site_id>/backup-settings", SiteBackupSettingsView, "backup_settings"),
            ("/<site_id>/restore", SiteRestoreView, "restore"),
            ("/<site_id>/backups/<name>", SiteBackupDownloadView, "backup_download"),
            ("/<site_id>/actions/<action>", SiteActionView, "action"),
            ("/<site_id>/delete", SiteDeleteView, "delete"),
            ("/<site_id>/change-plan", SiteChangePlanView, "change_plan"),
            ("/<site_id>/reset-password", SiteResetPasswordView, "reset_password"),
            ("/admin", AdminSitesView, "admin_list"),
            ("/admin/queue", AdminQueueStatusView, "admin_queue"),
            ("/admin/system", AdminSystemStatusView, "admin_system"),
            (
                "/admin/<site_id>/force-delete",
                AdminSiteForceDeleteView,
                "admin_force_delete",
            ),
            ("/admin/<site_id>", AdminSiteDetailView, "admin_detail"),
            ("/admin/<site_id>/actions/<action>", AdminSiteActionView, "admin_action"),
            ("/admin/<site_id>/usage", AdminSiteUsageView, "admin_usage"),
        ]:
            bp.add_url_rule(path, view_func=view.as_view(name, db=db, config=config))
        return bp
