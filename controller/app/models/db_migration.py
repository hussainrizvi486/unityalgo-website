
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.database_connection import DatabaseConnection
    from app.models.server import Tenant

# Ordered: a migration walks forward through these, or stops at 'failed'.
STATUSES = ("pending", "backing_up", "restoring", "switching", "completed", "failed")


class TenantDatabaseMigration(Base):
    __tablename__ = "tenant_db_migrations"

    STATUSES = STATUSES

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_connection_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("database_connections.id"), nullable=True
    )
    to_connection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("database_connections.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(30), default="pending")
    backup_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="db_migrations")
    from_connection: Mapped[Optional["DatabaseConnection"]] = relationship(
        "DatabaseConnection", foreign_keys=[from_connection_id]
    )
    to_connection: Mapped["DatabaseConnection"] = relationship(
        "DatabaseConnection", foreign_keys=[to_connection_id]
    )

    def __repr__(self):
        return f"<TenantDatabaseMigration tenant={self.tenant_id} status={self.status}>"
