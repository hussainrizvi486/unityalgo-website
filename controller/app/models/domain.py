import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DomainMapping(Base):
    """One hostname routed to one tenant's current deployment.

    The relationship that matters is `domain -> deployment`, not `domain ->
    server`: a tenant can carry several domains (its platform subdomain, plus
    any number of verified custom domains) that must all keep working when the
    tenant moves nodes. Moving a tenant only ever rewrites `deployment_id` on
    the rows that already exist here -- the domains and DNS never change.

    `deployment_id` is nullable because the platform domain is reserved at
    tenant-create time, before any deployment exists to point it at.
    """

    __tablename__ = "domain_mappings"

    DOMAIN_TYPES = ("platform", "custom")
    STATUSES = ("pending", "active", "disabled")
    SSL_STATUSES = ("none", "pending", "active", "failed")

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    # SET NULL, not CASCADE: a deployment being torn down (stop/redeploy/
    # migrate) must not destroy the domain reservation, only unroute it until
    # the next deployment claims it.
    deployment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("deployments.id", ondelete="SET NULL"), nullable=True
    )

    domain: Mapped[str] = mapped_column(String(255), nullable=False)
    domain_type: Mapped[str] = mapped_column(String(20), default="platform")
    status: Mapped[str] = mapped_column(String(20), default="pending")
    ssl_status: Mapped[str] = mapped_column(String(20), default="none")

    verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="domains")
    deployment: Mapped[Optional["Deployment"]] = relationship("Deployment")

    __table_args__ = (
        UniqueConstraint("domain", name="uq_domain_mappings_domain"),
        Index("ix_domain_mappings_tenant_id", "tenant_id"),
        Index("ix_domain_mappings_deployment_id", "deployment_id"),
        Index("ix_domain_mappings_type_status", "domain_type", "status"),
    )

    @property
    def is_routable(self):
        """Whether the edge proxy should have a live route for this domain.

        Deliberately checks the deployment's *current* status, not just
        whether one is attached: stop()/start() reuse the same deployment row
        (flipping it between "live" and "stopped"), so routability tracks that
        automatically without stop/start having to touch domain rows at all.
        """
        return (
            self.status == "active"
            and self.deployment_id is not None
            and self.deployment is not None
            and self.deployment.status == "live"
        )

    def __repr__(self):
        return f"<DomainMapping {self.domain} ({self.domain_type}) status={self.status}>"
