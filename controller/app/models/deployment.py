import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Deployment(Base):
    """One running (or historical) tenant application on one worker node.

    A tenant no longer points at a server directly -- it points at deployments,
    and the deployment owns the server, the host port and the container. That
    indirection is what makes migration a matter of standing up a second
    deployment and repointing, rather than mutating the tenant in place.

    Rows are never deleted: they are the deployment history, and their ports
    stay reserved until teardown marks them `removed`.
    """

    __tablename__ = "deployments"

    STATUSES = (
        "pending",          # row created, nothing run yet
        "deploying",        # docker run in flight
        "health_checking",  # container up, waiting for the app to answer
        "live",             # serving traffic
        "stopped",          # container exists but is not running (tenant paused)
        "draining",         # superseded, still routable during a flip
        "failed",           # deploy or health check failed
        "removed",          # container gone, port released
    )
    HEALTH_STATUSES = ("unknown", "healthy", "unhealthy")
    # Statuses that still occupy a port / count against node capacity. A
    # stopped tenant keeps its slot so start() can bring the same one back.
    ACTIVE_STATUSES = (
        "pending", "deploying", "health_checking", "live", "stopped", "draining",
    )
    # The tenant's current slot, running or not.
    CURRENT_STATUSES = ("live", "stopped", "health_checking")

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    # RESTRICT: a node with deployments on it must be drained, not deleted.
    server_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("server_nodes.id", ondelete="RESTRICT"), nullable=False
    )

    application: Mapped[str] = mapped_column(String(50), default="storefront")
    # Snapshotted, not read from settings, so redeploying an old deployment
    # reproduces what actually ran.
    image: Mapped[str] = mapped_column(String(255), nullable=False)
    container_name: Mapped[str] = mapped_column(String(128), nullable=False)
    container_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Host port published on the node -- what the edge proxy dials.
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    container_port: Mapped[int] = mapped_column(Integer, default=3000)

    status: Mapped[str] = mapped_column(String(20), default="pending")
    health_status: Mapped[str] = mapped_column(String(20), default="unknown")
    health_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_health_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Snapshotted so capacity accounting stays correct after a plan change.
    memory_limit_mb: Mapped[int] = mapped_column(Integer, nullable=False)
    cpu_limit_cores: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    stopped_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Set at teardown; a cooldown keeps the port out of the pool for a while so
    # a new tenant can't inherit connections aimed at the old container.
    port_released_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="deployments")
    server: Mapped["ServerNode"] = relationship(
        "ServerNode", back_populates="deployments"
    )

    __table_args__ = (
        UniqueConstraint("server_id", "port", name="uq_deployments_server_port"),
        # At most one live deployment per tenant. Blue/green still works: the
        # replacement sits in health_checking while the old one is live, and
        # the flip happens inside one transaction.
        Index(
            "uq_deployments_live_per_tenant",
            "tenant_id",
            unique=True,
            postgresql_where=text("status = 'live'"),
        ),
        Index("ix_deployments_tenant_status", "tenant_id", "status"),
        Index("ix_deployments_server_status", "server_id", "status"),
    )

    @property
    def is_active(self):
        return self.status in self.ACTIVE_STATUSES

    @property
    def upstream(self):
        """host:port the edge proxy should dial. Needs `server` loaded."""
        host = self.server.private_ip or self.server.ip_address
        return f"{host}:{self.port}"

    def __repr__(self):
        return (
            f"<Deployment {self.container_name} port={self.port} "
            f"status={self.status}>"
        )
