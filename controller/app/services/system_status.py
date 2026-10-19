import time
from datetime import datetime, timedelta, timezone
import redis
from sqlalchemy import select
from app.models.site import Site
from app.tasks.celery_app import BEAT_KEY, HEARTBEAT_SECONDS, celery_app

QUEUES = ('tenant_ops',)
IN_PROGRESS = ('queued', 'assigned', 'pulling', 'configuring', 'installing', 'starting', 'routing', 'deleting', 'restarting', 'stopping', 'restoring', 'updating')
STUCK_AFTER = {'queued': timedelta(minutes=3)}
STUCK_DEFAULT = timedelta(minutes=30)


def _redis(settings):
    return redis.Redis.from_url(settings.celery_broker_url or settings.redis_url, socket_timeout=2, socket_connect_timeout=2)


def redis_status(settings):
    client = _redis(settings)
    try:
        started = time.perf_counter()
        client.ping()
        latency = round((time.perf_counter() - started) * 1000, 1)
        info = client.info()
        return {
            'ok': True, 'latency_ms': latency, 'version': info.get('redis_version'), 'memory': info.get('used_memory_human'),
            'clients': info.get('connected_clients'), 'uptime_seconds': info.get('uptime_in_seconds'), 'error': None,
        }, client
    except Exception as error:
        return {'ok': False, 'latency_ms': None, 'version': None, 'memory': None, 'clients': None, 'uptime_seconds': None, 'error': str(error)[:300]}, None


def workers_status():
    """Every running Celery worker. Task arguments are left out: a provisioning task carries the site's encrypted setup."""
    try:
        inspector = celery_app.control.inspect(timeout=1.5)
        ping = inspector.ping() or {}
        stats = inspector.stats() or {}
        active = inspector.active() or {}
        reserved = inspector.reserved() or {}
    except Exception as error:
        return [], str(error)[:300]
    workers = []
    for name in sorted(ping):
        info = stats.get(name, {})
        pool = info.get('pool', {})
        workers.append({
            'name': name,
            'pid': info.get('pid'),
            'concurrency': pool.get('max-concurrency'),
            'processes': len(pool.get('processes', []) or []),
            'processed': sum((info.get('total') or {}).values()),
            'running': [
                {'id': task.get('id'), 'name': task.get('name'), 'started_at': task.get('time_start')}
                for task in active.get(name, [])
            ],
            'reserved': len(reserved.get(name, [])),
        })
    return workers, None


def beat_status(client):
    if client is None:
        return {'alive': False, 'last_seen_seconds': None, 'interval_seconds': HEARTBEAT_SECONDS}
    try:
        raw = client.get(BEAT_KEY)
    except Exception:
        raw = None
    if raw is None:
        return {'alive': False, 'last_seen_seconds': None, 'interval_seconds': HEARTBEAT_SECONDS}
    age = max(0, int(time.time() - float(raw)))
    return {'alive': age <= HEARTBEAT_SECONDS * 3, 'last_seen_seconds': age, 'interval_seconds': HEARTBEAT_SECONDS}


def stuck_sites(session):
    now = datetime.now(timezone.utc)
    rows = session.execute(select(Site.id, Site.slug, Site.status, Site.updated_at, Site.message).where(Site.status.in_(IN_PROGRESS))).all()
    result = []
    for row in rows:
        age = now - row.updated_at
        result.append({
            'id': str(row.id), 'slug': row.slug, 'status': row.status, 'message': row.message,
            'age_seconds': int(age.total_seconds()), 'stuck': age > STUCK_AFTER.get(row.status, STUCK_DEFAULT),
        })
    return sorted(result, key=lambda site: -site['age_seconds'])


def collect(settings, session):
    redis_info, client = redis_status(settings)
    waiting = {}
    if client is not None:
        for name in QUEUES:
            try:
                waiting[name] = int(client.llen(name))
            except Exception:
                waiting[name] = None
    workers, worker_error = workers_status() if redis_info['ok'] else ([], 'Redis is not reachable.')
    return {
        'redis': redis_info,
        'queues': [{'name': name, 'waiting': count} for name, count in waiting.items()],
        'workers': workers,
        'worker_error': worker_error,
        'beat': beat_status(client),
        'sites': stuck_sites(session),
        'checked_at': datetime.now(timezone.utc).isoformat(),
    }
