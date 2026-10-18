
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

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

    __tablename__ = "Product"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    label: Mapped[str] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(Text)
    isActive: Mapped[bool] = mapped_column(Boolean)

    def __repr__(self):
        return f"<PlatformProduct {self.id}>"


class PlatformPlan(Base):

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

    __tablename__ = "Subscription"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(Text, primary_key=True)
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
