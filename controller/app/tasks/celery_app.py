
from celery import Celery
from celery.signals import before_task_publish, worker_process_init

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
        "app.tasks.system_tasks",
    ],
)

HEARTBEAT_SECONDS = 30
BEAT_KEY = "controller:beat:last"


def _beat_schedule():
    schedule = {
        "health-check-sweep": {
            "task": "app.tasks.health_tasks.health_check_sweep",
            "schedule": settings.health_check_interval_seconds,
        },
    }
    schedule["system-heartbeat"] = {
        "task": "system.heartbeat",
        "schedule": HEARTBEAT_SECONDS,
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


@worker_process_init.connect
def _fresh_database_connections(**_kwargs):
    """Each forked worker opens its own connections; sharing the parent's corrupts the protocol and crashes tasks."""
    from app.db import database

    database.engine.dispose(close=False)


@before_task_publish.connect
def _note_beat_alive(headers=None, **_kwargs):
    """Runs in the process that publishes a task. Only Beat publishes the heartbeat, so this records that Beat is alive."""
    if (headers or {}).get("task") != "system.heartbeat":
        return
    import time

    import redis

    try:
        client = redis.Redis.from_url(settings.celery_broker_url or settings.redis_url, socket_timeout=2, socket_connect_timeout=2)
        client.set(BEAT_KEY, str(time.time()), ex=600)
    except Exception:
        pass
