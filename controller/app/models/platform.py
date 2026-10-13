"""Read-only mappings of the platform's Prisma-owned tables.

The platform (Next.js) and the controller share one database, with Prisma
owning the PascalCase tables and Alembic the snake_case ones — see
controller/README.md. These classes let the controller *read* a few of
Prisma's tables through the ORM and, more importantly, let SQLAlchemy resolve
foreign keys that point at them: without `User` present in this MetaData,
`ForeignKey("User.id")` on `tenants` cannot be constructed at all.

Three rules keep this safe:

1. **Alembic must never manage these tables.** alembic/env.py filters them
   out of autogenerate via PRISMA_OWNED_TABLES below. Without that filter,
   `makemigration` would emit DDL to alter or drop tables Prisma owns.
2. **Read-only from here.** Writes go through the Next.js app, which owns the
   business rules for them. Nothing in the controller writes these.
3. **Mirror the minimum.** Every column listed here is one that has to be
   kept in sync with schema.prisma by hand. Only the handful the controller
   genuinely reads are mapped; a column added on the Prisma side that is not
   here simply is not visible, which is harmless. Adding columns to the
   mirror is only worth it when the controller actually needs them.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

# Consulted by alembic/env.py. Every table Prisma owns belongs here, not just
# the ones mapped below -- autogenerate compares against the live database, so
# an unmapped Prisma table would otherwise look like one to DROP.
PRISMA_OWNED_TABLES = frozenset({
    "AppCatalog", "LoginSession", "Notification", "EmailAccount", "Currency", "PaddleEvent", "leads",
    "User",
    "Product",
    "Subscription",
    "SubscriptionAddOn",
    "Plan",
    "AddOn",
    "Address",
    "BillingRecord",
    "SupportTicket",
    "Comment",
    "EmailVerification",
    "Post",
    "contact_list",
    "_prisma_migrations",
})


class PlatformUser(Base):
    """Prisma's `User` — the one identity table for the whole platform.

    Mapped so `tenants.user_id` can be a real foreign key and so the dashboard
    can count customers through the ORM. Named PlatformUser rather than User
    to make it obvious at the call site that this is not a controller-owned
    model.
    """

    __tablename__ = "User"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    email: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(Text)
    name: Mapped[Optional[str]] = mapped_column(Text)
    firstName: Mapped[Optional[str]] = mapped_column(Text)
    lastName: Mapped[Optional[str]] = mapped_column(Text)
    company: Mapped[Optional[str]] = mapped_column(Text)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    @property
    def display_name(self):
        full = " ".join(filter(None, (self.firstName, self.lastName))).strip()
        return self.name or full or self.email

    def __repr__(self):
        return f"<PlatformUser {self.email} role={self.role}>"


class PlatformProduct(Base):
    """Prisma's `Product` — was an enum, promoted to a table.

    Mapped read-only so `Plan.productId` / `Subscription.productId` can be real
    foreign keys and so the controller can read a product's label without
    hard-coding it.
    """

    __tablename__ = "Product"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    label: Mapped[str] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(Text)
    isActive: Mapped[bool] = mapped_column(Boolean)

    def __repr__(self):
        return f"<PlatformProduct {self.id}>"


class PlatformPlan(Base):
    """Prisma's `Plan` — a purchasable tier of one product.

    Mapped so a tenant's plan can be resolved through its subscription rather
    than trusting the free-text `tenants.plan_tier` string, which is now a
    cache of `Plan.slug` rather than an independently-entered value.
    """

    __tablename__ = "Plan"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    productId: Mapped[str] = mapped_column(ForeignKey("Product.id"))
    name: Mapped[str] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(Text)
    # Null price means "custom quote" on the platform side.
    priceAmount: Mapped[Optional[float]] = mapped_column(Float)
    priceUnit: Mapped[str] = mapped_column(String(32))
    userLimit: Mapped[Optional[int]] = mapped_column(Integer)
    isActive: Mapped[bool] = mapped_column(Boolean)

    def __repr__(self):
        return f"<PlatformPlan {self.productId}/{self.slug}>"


class PlatformSubscription(Base):
    """Prisma's `Subscription` — a customer's plan for one product.

    This is the join that ties a tenant to both a person and a plan: a tenant
    is the infrastructure realisation of one UnityCommerce subscription.
    """

    __tablename__ = "Subscription"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    # Real ForeignKeys so `joinedload` can walk subscription -> user/plan in a
    # single statement when serializing tenants. The constraints themselves
    # are Prisma's; these declarations only tell SQLAlchemy how to join.
    userId: Mapped[str] = mapped_column(ForeignKey("User.id"))
    planId: Mapped[str] = mapped_column(ForeignKey("Plan.id"))
    productId: Mapped[str] = mapped_column(ForeignKey("Product.id"))
    status: Mapped[str] = mapped_column(String(32))
    storeName: Mapped[Optional[str]] = mapped_column(Text)

    user: Mapped["PlatformUser"] = relationship("PlatformUser", viewonly=True)
    plan: Mapped["PlatformPlan"] = relationship("PlatformPlan", viewonly=True)

    def __repr__(self):
        return f"<PlatformSubscription {self.id} {self.productId} {self.status}>"


class PlatformBillingRecord(Base):
    """Prisma's `BillingRecord` — used for the dashboard's outstanding total."""

    __tablename__ = "BillingRecord"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    userId: Mapped[str] = mapped_column(Text)
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32))

    def __repr__(self):
        return f"<PlatformBillingRecord {self.id} {self.status} {self.amount}>"
