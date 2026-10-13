"""Customer-owned Frappe sites; Alembic owns this infrastructure table."""
import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.models.types import EncryptedString

class Site(Base):
    __tablename__ = 'sites'
    __table_args__ = (UniqueConstraint('user_id', 'request_key'), UniqueConstraint('server_id', 'port'))
    ACTIVE_STATUSES = ('queued', 'assigned', 'pulling', 'configuring', 'installing', 'starting', 'routing', 'ready', 'cleanup_required')
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
    admin_password: Mapped[str] = mapped_column(EncryptedString)
    db_password: Mapped[str] = mapped_column(EncryptedString)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    server = relationship('ServerNode')
