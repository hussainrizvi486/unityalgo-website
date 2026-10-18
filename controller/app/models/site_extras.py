"""Tables that hang off a site: its backup history and its custom domains."""
import uuid
from datetime import datetime
from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
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


class SiteMetric(Base):
    __tablename__ = 'site_metrics'
    __table_args__ = (Index('ix_site_metrics_site_ts', 'site_id', 'ts'),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    site_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('sites.id', ondelete='CASCADE'))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    cpu_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    memory_mb: Mapped[float | None] = mapped_column(Float, nullable=True)
    storage_mb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    healthy: Mapped[bool] = mapped_column(Boolean, default=True)
    response_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    users: Mapped[int | None] = mapped_column(Integer, nullable=True)


class SiteTrial(Base):
    __tablename__ = 'site_trials'
    __table_args__ = (UniqueConstraint('user_id', 'plan_id'),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    plan_id: Mapped[str] = mapped_column(String(64))
    site_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
