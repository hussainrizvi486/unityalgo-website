
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
                pass
        session.delete(backup)
        removed += 1

    return removed
