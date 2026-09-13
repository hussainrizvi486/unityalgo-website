"""Celery application instance.

No Flask app-context wrapping needed here -- this codebase has no
Flask-SQLAlchemy binding (app/db.py's Database is a plain engine/sessionmaker
singleton), so a task opens `database.session()` exactly like an HTTP
request does. `include=` lists task modules explicitly rather than relying
on autodiscovery, matching this repo's existing explicit-registration style
(see ALL_ROUTES in app/routes/__init__.py).
"""

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
    ],
)

def _beat_schedule():
    """Periodic tasks, assembled rather than declared inline.

    The backup sweep is conditional: registering it unconditionally and
    relying on the task to no-op would still wake a worker on every tick,
    and would make `celery inspect scheduled` claim a schedule the operator
    never turned on.
    """
    schedule = {
        "health-check-sweep": {
            "task": "app.tasks.health_tasks.health_check_sweep",
            "schedule": settings.health_check_interval_seconds,
        },
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
    # Requires a `celery beat` process running (python main.py beat) --
    # ticks land on the same tenant_ops queue and are picked up by the
    # existing worker, no separate queue/worker needed for this.
    beat_schedule=_beat_schedule(),
)
