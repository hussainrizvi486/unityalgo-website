from app.tasks.celery_app import celery_app


@celery_app.task(name='system.heartbeat', ignore_result=True)
def heartbeat():
    """Does nothing. Its publication by Celery Beat is what the admin status page watches."""
