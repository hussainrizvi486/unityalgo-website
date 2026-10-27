"""Customer-owned Frappe sites; Alembic owns this infrastructure table."""
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.models.types import EncryptedString

STEP_FLOW = [
    ('pulling', 'Prepare environment'),
    ('configuring', 'Configure services'),
    ('installing', 'Set up your company and apps'),
    ('starting', 'Start and check health'),
    ('routing', 'Go live'),
]

class Site(Base):
    __tablename__ = 'sites'
    __table_args__ = (UniqueConstraint('user_id', 'request_key'), UniqueConstraint('server_id', 'port'))
    ACTIVE_STATUSES = ('queued', 'assigned', 'pulling', 'configuring', 'installing', 'starting', 'routing', 'ready', 'stopping', 'stopped', 'restarting', 'restoring', 'updating', 'deleting', 'cleanup_required')
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(ForeignKey('User.id', ondelete='RESTRICT'), index=True)
    request_key: Mapped[str] = mapped_column(String(36))
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(48), unique=True)
    domain: Mapped[str] = mapped_column(String(255), unique=True)
    server_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('server_nodes.id', ondelete='RESTRICT'), index=True)
    port: Mapped[int] = mapped_column(Integer)
    memory_limit_mb: Mapped[int] = mapped_column(Integer, default=6144)
    container_slots: Mapped[int] = mapped_column(Integer, default=10)
    image: Mapped[str] = mapped_column(String(255))
    app_names: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(30), default='queued', index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str] = mapped_column(Text, default='Waiting for a provisioning worker.')
    db_server_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey('database_connections.id', ondelete='RESTRICT'), nullable=True, index=True)
    cpu_limit: Mapped[float] = mapped_column(Float, default=2.0, server_default='2')
    storage_limit_gb: Mapped[int] = mapped_column(Integer, default=10, server_default='10')
    user_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    user_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    storage_used_mb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    limit_state: Mapped[str | None] = mapped_column(String(20), nullable=True)
    audited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    backup_schedule: Mapped[str] = mapped_column(String(10), default='off', server_default='off')
    backup_retention: Mapped[int] = mapped_column(Integer, default=7, server_default='7')
    last_backup_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Counts provisioning attempts (1 = first). Notifications and emails dedupe on it.
    attempt: Mapped[int] = mapped_column(Integer, default=1, server_default='1')
    # Background work on a running site, e.g. 'backup'. NULL when idle.
    activity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    plan_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    trial_expired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    trial_warned: Mapped[bool] = mapped_column(Boolean, default=False, server_default='false')
    plan_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    owner_email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    failed_step: Mapped[str | None] = mapped_column(String(30), nullable=True)
    admin_password: Mapped[str] = mapped_column(EncryptedString)
    # The customer's own ERP login (never the Administrator's), so "Access site" can sign them in. NULL on older sites.
    erp_user_password: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    db_password: Mapped[str] = mapped_column(EncryptedString)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    server = relationship('ServerNode')
    db_server = relationship('DatabaseConnection', foreign_keys=[db_server_id])
