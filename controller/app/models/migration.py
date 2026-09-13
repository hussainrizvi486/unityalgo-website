import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TenantMigration(Base):
    """Audit trail + state machine for moving a tenant between nodes."""

    __tablename__ = "tenant_migrations"

    STATUSES = (
        "pending",
        "backing_up",
        "transferring",
        "restoring",
        "completed",
        "failed",
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    from_node_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("server_nodes.id"), nullable=True
    )
    to_node_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("server_nodes.id"), nullable=False
    )
    backup_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("tenant_backups.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="pending")
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="migrations")
