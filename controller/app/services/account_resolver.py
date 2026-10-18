
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.errors import ConflictError, NotFoundError, ValidationError
from app.models.platform import PlatformSubscription, PlatformUser
from app.models.server import Tenant

TENANT_PRODUCT = "unity_commerce"

UNUSABLE_SUBSCRIPTION_STATUSES = frozenset({"CANCELED"})


class ResolvedAccount:

    __slots__ = ("user", "subscription", "plan")

    def __init__(self, user=None, subscription=None, plan=None):
        self.user = user
        self.subscription = subscription
        self.plan = plan

    def apply_to(self, values):
        """Overwrite the denormalized columns with the resolved truth."""
        if self.user is not None:
            values["user_id"] = self.user.id
            values["customer_email"] = self.user.email
        if self.subscription is not None:
            values["subscription_id"] = self.subscription.id
        if self.plan is not None:
            values["plan_tier"] = self.plan.slug
        return values


def _load_user(session, user_id):
    user = session.get(PlatformUser, user_id)
    if user is None:
        raise NotFoundError(f"Customer {user_id} was not found")
    return user


def _load_subscription(session, subscription_id):
    subscription = session.execute(
        select(PlatformSubscription)
        .options(
            joinedload(PlatformSubscription.user),
            joinedload(PlatformSubscription.plan),
        )
        .where(PlatformSubscription.id == subscription_id)
    ).unique().scalar_one_or_none()
    if subscription is None:
        raise NotFoundError(f"Subscription {subscription_id} was not found")
    return subscription


def _assert_unclaimed(session, subscription_id, exclude_tenant_id):
    stmt = select(Tenant).where(Tenant.subscription_id == subscription_id)
    if exclude_tenant_id is not None:
        stmt = stmt.where(Tenant.id != exclude_tenant_id)
    existing = session.execute(stmt).scalars().first()
    if existing is not None:
        raise ConflictError(
            f"Subscription {subscription_id} already belongs to tenant "
            f"'{existing.tenant_slug}'"
        )


def resolve_account(session, values, *, tenant=None):
    has_subscription = "subscription_id" in values
    has_user = "user_id" in values

    subscription_id = values.get("subscription_id") if has_subscription else (
        tenant.subscription_id if tenant is not None else None
    )
    user_id = values.get("user_id") if has_user else (
        tenant.user_id if tenant is not None else None
    )

    if subscription_id is None:
        if user_id is None:
            return ResolvedAccount()
        return ResolvedAccount(user=_load_user(session, user_id))

    subscription = _load_subscription(session, subscription_id)

    if subscription.productId != TENANT_PRODUCT:
        raise ValidationError(
            f"Subscription {subscription_id} is for {subscription.productId}, and only "
            f"{TENANT_PRODUCT} subscriptions have storefronts"
        )
    if subscription.status in UNUSABLE_SUBSCRIPTION_STATUSES:
        raise ValidationError(
            f"Subscription {subscription_id} is {subscription.status.lower()} and "
            "cannot be given a storefront"
        )
    if user_id is not None and user_id != subscription.userId:
        raise ValidationError(
            "user_id does not own this subscription — a tenant's customer is "
            "whoever holds the subscription funding it"
        )

    _assert_unclaimed(session, subscription_id, tenant.id if tenant is not None else None)

    return ResolvedAccount(
        user=subscription.user,
        subscription=subscription,
        plan=subscription.plan,
    )
