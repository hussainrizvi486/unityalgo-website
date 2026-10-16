"""Tables that hang off a site: its backup history and its custom domains."""
import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class SiteBackup(Base):
    __tablename__ = 'site_backups'
    __table_args__ = (UniqueConstraint('site_id', 'stamp'),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('sites.id', ondelete='CASCADE'), index=True)
    stamp: Mapped[str] = mapped_column(String(32))
    kind: Mapped[str] = mapped_column(String(12), default='manual')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SiteDomain(Base):
    __tablename__ = 'site_domains'
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('sites.id', ondelete='CASCADE'), index=True)
    domain: Mapped[str] = mapped_column(String(253), unique=True)
    status: Mapped[str] = mapped_column(String(12), default='pending')
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tls_status: Mapped[str | None] = mapped_column(String(12), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
