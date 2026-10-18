"""Shared Celery task base class."""

from app.services.activity_logger import ActivityLogger
from app.tasks.celery_app import celery_app


class DBTask(celery_app.Task):

    abstract = True

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        operation_id = kwargs.get("operation_id")
        if operation_id:
            ActivityLogger().finish_operation(operation_id, "failed", error=exc)
