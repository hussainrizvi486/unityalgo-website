
from celery import Celery

from app.config import settings

celery_app = Celery(
    settings.app_name,
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.tasks.tenant_tasks",
        "app.tasks.health_tasks",
        "app.tasks.backup_tasks",
        "app.tasks.site_tasks",
        "app.tasks.app_tasks",
        "app.tasks.metrics_tasks",
        "app.tasks.trial_tasks",
    ],
)

def _beat_schedule():
    schedule = {
        "health-check-sweep": {
            "task": "app.tasks.health_tasks.health_check_sweep",
            "schedule": settings.health_check_interval_seconds,
        },
    }
    schedule["site-scheduled-backups"] = {
        "task": "site.scheduled_backups",
        "schedule": settings.site_backup_sweep_seconds,
    }
    schedule["site-limit-audit"] = {
        "task": "site.audit_limits",
        "schedule": settings.site_audit_interval_seconds,
    }
    schedule["site-metrics"] = {
        "task": "site.collect_metrics",
        "schedule": settings.site_metrics_interval_seconds,
    }
    schedule["site-trials"] = {
        "task": "site.expire_trials",
        "schedule": settings.site_trial_sweep_seconds,
    }
    schedule["app-version-scan"] = {
        "task": "apps.scan",
        "schedule": settings.app_scan_interval_seconds,
    }
    if settings.backup_schedule_enabled:
        schedule["scheduled-backup-sweep"] = {
            "task": "app.tasks.backup_tasks.scheduled_backup_sweep",
            "schedule": settings.backup_schedule_interval_seconds,
        }
    return schedule


celery_app.conf.update(
    task_time_limit=settings.celery_task_time_limit,
    task_soft_time_limit=settings.celery_task_soft_time_limit,
    worker_concurrency=settings.celery_worker_concurrency,
    task_always_eager=settings.celery_task_always_eager,
    task_track_started=True,
    task_default_queue="tenant_ops",
    worker_hijack_root_logger=False,
    beat_schedule=_beat_schedule(),
)
