"""Monitoring: sample every running site on a schedule and keep the readings for the charts."""
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from sqlalchemy import delete, select
from app.config import settings
from app.db import database
from app.models.site import Site
from app.models.site_extras import SiteMetric
from app.services.activity_logger import ActivityLogger
from app.services.site_runtime import build_service
from app.tasks.celery_app import celery_app

WORKERS = 4


def sample(service):
    healthy, response_ms = service.probe()
    reading = {'healthy': healthy, 'response_ms': response_ms}
    try:
        usage = service.usage()
        reading.update(cpu_percent=usage['cpu_percent'], memory_mb=usage['memory_mb'], storage_mb=usage['storage_mb'])
    except Exception:
        pass
    return reading


def record(site_id, reading, users):
    with database.session() as session:
        session.add(SiteMetric(site_id=uuid.UUID(site_id), users=users, **reading))


@celery_app.task(name='site.collect_metrics', soft_time_limit=280, time_limit=300)
def collect_metrics_task(site_ids=None):
    with database.session() as session:
        query = select(Site).where(Site.status == 'ready')
        if site_ids is not None:
            query = query.where(Site.id.in_([uuid.UUID(i) for i in site_ids]))
        jobs = [(str(site.id), site.slug, site.user_count, build_service(session, site)) for site in session.scalars(query)]

    def work(job):
        site_id, slug, users, service = job
        try:
            record(site_id, sample(service), users)
        except Exception as exc:
            ActivityLogger().event('health', 'site.metrics', 'Metrics sample failed', status='warning', message=str(exc)[:300], tenant_slug=slug)

    if jobs:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            list(pool.map(work, jobs))
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.site_metrics_retention_days)
    with database.session() as session:
        session.execute(delete(SiteMetric).where(SiteMetric.ts < cutoff))
