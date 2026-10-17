"""Turning stored readings into what the monitoring charts show."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.models.site_extras import SiteMetric

RANGES = {'1h': timedelta(hours=1), '6h': timedelta(hours=6), '24h': timedelta(hours=24), '7d': timedelta(days=7), '30d': timedelta(days=30)}
MAX_POINTS = 120


def _average(values):
    values = [v for v in values if v is not None]
    return sum(values) / len(values) if values else None


def _round(value, digits=1):
    return None if value is None else round(value, digits)


def bucketed(rows, span, interval_seconds):
    """Average readings into at most MAX_POINTS evenly spaced buckets, so a month does not send thousands of points.

    A bucket is `up` for the share of its readings that answered a health check (1 = all of them).
    """
    width = max(interval_seconds, span.total_seconds() / MAX_POINTS)
    groups = {}
    for row in rows:
        groups.setdefault(int(row.ts.timestamp() // width), []).append(row)
    points = []
    for key in sorted(groups):
        group = groups[key]
        points.append({
            't': datetime.fromtimestamp((key + 0.5) * width, timezone.utc).isoformat(),
            'cpu': _round(_average([r.cpu_percent for r in group])),
            'memory_mb': _round(_average([r.memory_mb for r in group]), 0),
            'storage_mb': _round(_average([r.storage_mb for r in group]), 0),
            'response_ms': _round(_average([r.response_ms for r in group]), 0),
            'users': _round(_average([r.users for r in group]), 0),
            'up': round(sum(1 for r in group if r.healthy) / len(group), 3),
        })
    return points


def summarize(rows):
    if not rows:
        return {'samples': 0, 'uptime_percent': None, 'cpu_avg': None, 'cpu_peak': None, 'memory_avg_mb': None, 'memory_peak_mb': None,
                'response_avg_ms': None, 'response_peak_ms': None, 'storage_mb': None, 'outages': 0}
    cpu = [r.cpu_percent for r in rows if r.cpu_percent is not None]
    memory = [r.memory_mb for r in rows if r.memory_mb is not None]
    response = [r.response_ms for r in rows if r.response_ms is not None]
    storage = [r.storage_mb for r in rows if r.storage_mb is not None]
    # An outage is a run of failed checks, however long: two failures in a row are one outage.
    outages, previous = 0, True
    for row in rows:
        if not row.healthy and previous:
            outages += 1
        previous = row.healthy
    return {
        'samples': len(rows),
        'uptime_percent': round(100 * sum(1 for r in rows if r.healthy) / len(rows), 2),
        'cpu_avg': _round(_average(cpu)), 'cpu_peak': _round(max(cpu)) if cpu else None,
        'memory_avg_mb': _round(_average(memory), 0), 'memory_peak_mb': round(max(memory)) if memory else None,
        'response_avg_ms': _round(_average(response), 0), 'response_peak_ms': round(max(response)) if response else None,
        'storage_mb': storage[-1] if storage else None,
        'outages': outages,
    }


def metrics_payload(session, site, range_name, interval_seconds):
    """Everything the charts need for one site over `range_name`."""
    span = RANGES.get(range_name, RANGES['24h'])
    since = datetime.now(timezone.utc) - span
    rows = session.scalars(select(SiteMetric).where(SiteMetric.site_id == site.id, SiteMetric.ts >= since).order_by(SiteMetric.ts)).all()
    return {
        'range': range_name if range_name in RANGES else '24h',
        'interval_seconds': interval_seconds,
        'points': bucketed(rows, span, interval_seconds),
        'summary': summarize(rows),
        'limits': {'memory_mb': site.memory_limit_mb, 'cpu_percent': round((site.cpu_limit or 0) * 100), 'storage_mb': (site.storage_limit_gb or 0) * 1024,
                   'users': site.user_limit},
        'running': site.status == 'ready',
        'last_sample_at': rows[-1].ts.isoformat() if rows else None,
    }
