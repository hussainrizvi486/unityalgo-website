"""Scheduled tenant backups (Celery Beat -- see app/tasks/celery_app.py).

Backups already existed, but only as an operator action or as a safety step
inside a migration/resize. Nothing took one on a timer, so a tenant that was
never migrated had no recovery point at all.

This composes the existing pieces rather than reimplementing them: the dump
itself is TenantController.create_backup(), the same call the Backup button
makes, so a scheduled backup is indistinguishable from a manual one except
for its `reason` -- and therefore restorable through the same
restore_backup() path with no special cases.

Off unless BACKUP_SCHEDULE_ENABLED is set. See app/config.py for why.
"""

from pathlib import Path

from sqlalchemy import select

from app.config import settings
from app.controller.tenant import TenantController
from app.db import database
from app.models.backup import TenantBackup
from app.models.server import Tenant
from app.services.activity_logger import ActivityLogger
from app.tasks.base import DBTask
from app.tasks.celery_app import celery_app

SCHEDULED_REASON = "scheduled"


@celery_app.task(base=DBTask, name="app.tasks.backup_tasks.scheduled_backup_sweep")
def scheduled_backup_sweep():
    """Back up every active tenant, then prune old scheduled dumps.

    Each tenant gets its own session and its own commit. A fleet-wide sweep
    that shared one transaction would roll the whole night's work back
    because one node was unreachable, and would hold a single long
    transaction open across dozens of pg_dumps.
    """
    activity = ActivityLogger(actor="backup-sweep")

    with database.session() as session:
        tenant_ids = list(
            session.scalars(
                select(Tenant.id).where(Tenant.status == "active").order_by(Tenant.created_at)
            ).all()
        )

    if not tenant_ids:
        return {"tenants": 0, "backed_up": 0, "failed": 0, "pruned": 0}

    backed_up = failed = pruned = 0
    for tenant_id in tenant_ids:
        try:
            with database.session() as session:
                controller = TenantController(session, settings, actor="backup-sweep")
                controller.create_backup(tenant_id, reason=SCHEDULED_REASON)
            backed_up += 1
        except Exception as exc:  # noqa: BLE001 -- one bad tenant must not end the sweep
            failed += 1
            # create_backup's own Operation already recorded the failure with
            # full context; this is the fleet-level counterpart so the sweep
            # itself is visible in the Activity Log as a single event.
            activity.event(
                "backup", "backup.scheduled_failed", "Scheduled backup failed",
                status="failed", tenant_id=tenant_id, error=exc,
            )
            continue

        try:
            with database.session() as session:
                pruned += _prune(session, tenant_id, settings.backup_retention_count)
        except Exception as exc:  # noqa: BLE001 -- pruning must never lose a fresh backup
            activity.event(
                "backup", "backup.prune_failed", "Backup pruning failed",
                status="warning", tenant_id=tenant_id, error=exc,
            )

    activity.event(
        "backup", "backup.sweep_completed", "Scheduled backup sweep completed",
        status="success" if failed == 0 else "warning",
        details={
            "tenants": len(tenant_ids),
            "backed_up": backed_up,
            "failed": failed,
            "pruned": pruned,
        },
    )
    return {
        "tenants": len(tenant_ids),
        "backed_up": backed_up,
        "failed": failed,
        "pruned": pruned,
    }


def _prune(session, tenant_id, keep):
    """Drop all but the newest `keep` scheduled backups for one tenant.

    Deletes the dump file as well as the row -- a row-only delete would leave
    the controller host filling up with orphaned pg_dump output that nothing
    references any more.

    Only touches reason="scheduled". Backups taken before a migration, resize
    or delete are the record of that operation and are left alone; so are
    failed rows, which carry the error message and no file.
    """
    if keep < 1:
        return 0

    stale = session.scalars(
        select(TenantBackup)
        .where(
            TenantBackup.tenant_id == tenant_id,
            TenantBackup.reason == SCHEDULED_REASON,
            TenantBackup.status == "success",
        )
        .order_by(TenantBackup.created_at.desc())
        .offset(keep)
    ).all()

    removed = 0
    for backup in stale:
        if backup.backup_path:
            try:
                Path(backup.backup_path).unlink(missing_ok=True)
            except OSError:
                # The row is still deleted: a dump we cannot remove is a disk
                # problem to chase separately, not a reason to keep an
                # unbounded backup history in the database.
                pass
        session.delete(backup)
        removed += 1

    return removed
