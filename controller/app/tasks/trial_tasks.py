"""Free trials: warn before one ends, switch the site off when it does, and carry on if the owner subscribed."""
import uuid
from datetime import timedelta
from sqlalchemy import select
from app.config import settings
from app.db import database
from app.models.site import Site
from app.services import trials
from app.tasks.celery_app import celery_app
from app.tasks.site_tasks import notify


def handle(site_id, user_id=None):
    """Bring one trial site up to date. Returns what happened, for the log and the tests."""
    from app.routes.site import has_room
    queue = None
    with database.session() as session:
        site = session.scalar(select(Site).where(Site.id == uuid.UUID(site_id)).with_for_update())
        if site is None or site.trial_ends_at is None:
            return 'none'
        subscribed = trials.has_subscription(session, site.user_id, site.plan_id)
        current = trials.now()
        if subscribed:
            # They paid for the plan: the site is theirs for good, and comes back if the trial had already switched it off.
            was_off = site.trial_expired_at is not None
            site.trial_ends_at = site.trial_expired_at = None
            site.trial_warned = False
            if was_off and site.status == 'deactivated' and not site.activity and has_room(session, site, settings):
                site.status, site.message, site.error = 'restarting', 'Welcome back. Reactivating your site…', None
                queue = (site_id, 'reactivate', 'deactivated')
            result = 'converted'
        elif site.trial_expired_at is None and site.trial_ends_at <= current:
            if site.activity or site.status not in ('ready', 'stopped'):
                return 'waiting'              # busy right now; the next sweep tries again
            origin = site.status
            site.trial_expired_at = current
            site.status, site.message, site.error = 'stopping', 'Your free trial has ended. Switching the site off…', None
            queue = (site_id, 'deactivate', origin)
            result = 'expired'
        elif not site.trial_warned and site.trial_expired_at is None and site.trial_ends_at - current <= timedelta(days=settings.site_trial_warning_days):
            site.trial_warned = True
            result = 'warned'
        else:
            return 'none'
    if queue:
        from app.tasks.site_tasks import site_action_task
        try:
            site_action_task.apply_async(args=list(queue), retry=False)
        except Exception:
            # Put it back so the next sweep tries again rather than leaving the site half-switched.
            with database.session() as session:
                site = session.get(Site, uuid.UUID(site_id))
                if site and result == 'expired':
                    site.status, site.trial_expired_at, site.message = queue[2], None, 'Your site is ready.'
                elif site:
                    site.status = 'deactivated'
            return 'queue_unavailable'
    if result == 'expired':
        notify(site_id, 'trial_ended')
    elif result == 'warned':
        notify(site_id, 'trial_ending')
    elif result == 'converted':
        notify(site_id, 'trial_converted')
    return result


@celery_app.task(name='site.expire_trials', soft_time_limit=280, time_limit=300)
def expire_trials_task(user_id=None, plan_id=None):
    """Sweep trial sites (Celery Beat, and straight after a customer subscribes). Narrowed to one customer/plan when given."""
    with database.session() as session:
        ids = [str(site.id) for site in trials.due(session, user_id, plan_id)]
    outcome = {}
    for site_id in ids:
        try:
            outcome[site_id] = handle(site_id)
        except Exception:
            outcome[site_id] = 'error'
    return outcome
