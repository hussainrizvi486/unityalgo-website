import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TenantBackup(Base):
    """A point-in-time database dump for one tenant.

    Taken before a destructive operation (migration, resize, delete) so it can
    be restored on failure, on demand from the admin panel, or on a timer by
    app/tasks/backup_tasks.py.

    `reason` matters beyond bookkeeping: retention pruning only ever removes
    reason="scheduled" rows, so a backup that is the record of an operation is
    never deleted by a timer.
    """

    __tablename__ = "tenant_backups"

    STATUSES = ("pending", "running", "success", "failed")

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    node_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("server_nodes.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="pending")
    reason: Mapped[str] = mapped_column(String(50), default="manual")
    # migration, resize, manual, pre_delete, scheduled
    backup_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="backups")
