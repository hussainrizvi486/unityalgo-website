"""Shared Celery task base class."""

from app.services.activity_logger import ActivityLogger
from app.tasks.celery_app import celery_app


class DBTask(celery_app.Task):
    """Base class for every task in this package.

    `on_failure` is the one non-obvious piece: Celery's *hard* time limit
    (`CELERY_TASK_TIME_LIMIT`) SIGKILLs the worker process outright, so the
    `except Exception` inside `ActivityLogger.operation()` never runs -- the
    task just vanishes mid-step. Without this override, a killed task leaves
    its Operation stuck at `in_progress` forever, and the frontend's poll
    loop (which stops only on a terminal status) never terminates.
    `on_failure` runs in the *parent* worker process and reliably fires even
    after a SIGKILL, so it's the actual backstop.
    """

    abstract = True

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        operation_id = kwargs.get("operation_id")
        if operation_id:
            ActivityLogger().finish_operation(operation_id, "failed", error=exc)
