"""Free trials: starting one, telling when it ends, and what ends it.

A plan can offer a trial (the website decides that and passes `trial_days` when a site is created). The site runs normally
until `trial_ends_at`. If its owner has subscribed to the plan by then the trial simply ends and the site carries on;
if not, the site is deactivated and cannot be used until they subscribe.
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy import delete, select, text, update
from sqlalchemy.exc import IntegrityError
from app.errors import ConflictError
from app.models.site import Site
from app.models.site_extras import SiteTrial

MAX_TRIAL_DAYS = 365


def now():
    return datetime.now(timezone.utc)


def has_subscription(session, user_id, plan_id):
    """Whether the customer holds an active paid subscription to this plan. Subscriptions are the website's table, read here."""
    return session.execute(
        text('SELECT 1 FROM "Subscription" WHERE "userId" = :user AND "planId" = :plan AND status = \'ACTIVE\' LIMIT 1'),
        {'user': user_id, 'plan': plan_id},
    ).first() is not None


def used_plan_ids(session, user_id):
    return sorted(session.scalars(select(SiteTrial.plan_id).where(SiteTrial.user_id == user_id)))


def begin(session, site, days):
    """Make `site` a trial of `days` days, once per customer per plan. Raises ConflictError when they have had it."""
    try:
        with session.begin_nested():
            session.add(SiteTrial(user_id=site.user_id, plan_id=site.plan_id, site_id=site.id))
            session.flush()
    except IntegrityError:
        raise ConflictError('You have already used the free trial of this plan. Subscribe to it to create another site.') from None
    site.trial_ends_at = now() + timedelta(days=days)
    site.trial_expired_at = None
    site.trial_warned = False


def activated(session, site_id):
    session.execute(update(SiteTrial).where(SiteTrial.site_id == site_id, SiteTrial.activated_at.is_(None)).values(activated_at=now()))


def release_if_unused(session, site):
    """A trial site that never became usable (it failed and was deleted) gives the trial back."""
    session.execute(delete(SiteTrial).where(SiteTrial.site_id == site.id, SiteTrial.activated_at.is_(None)))


def describe(site):
    """What the customer is shown about a trial, or None for a site that is not on one."""
    if site.trial_ends_at is None:
        return None
    remaining = site.trial_ends_at - now()
    return {
        'ends_at': site.trial_ends_at.isoformat(),
        'expired': site.trial_expired_at is not None or remaining.total_seconds() <= 0,
        'days_left': max(0, -(-int(remaining.total_seconds()) // 86400)) if remaining.total_seconds() > 0 else 0,
        'plan_id': site.plan_id,
    }


def due(session, user_id=None, plan_id=None):
    query = select(Site).where(Site.trial_ends_at.isnot(None))
    if user_id:
        query = query.where(Site.user_id == user_id)
    if plan_id:
        query = query.where(Site.plan_id == plan_id)
    return session.scalars(query).all()
