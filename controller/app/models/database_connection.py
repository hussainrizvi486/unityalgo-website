
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

SSL_MODES = ("disable", "allow", "prefer", "require", "verify-ca", "verify-full")
ROLES = ("cluster", "external")
ENGINES = ("postgres", "mariadb")


class DatabaseConnection(Base):
    __tablename__ = "database_connections"

    SSL_MODES = SSL_MODES
    ROLES = ROLES
    ENGINES = ENGINES

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # 'postgres' hosts UnityCommerce tenants; 'mariadb' hosts Frappe sites.
    engine: Mapped[str] = mapped_column(String(20), default="postgres", server_default="postgres")
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, default=5432)
    database_name: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    # Fernet ciphertext (base64 text), never the plaintext password.
    password_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    sslmode: Mapped[str] = mapped_column(String(20), default="prefer")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    role: Mapped[str] = mapped_column(String(20), default="external")
    host_from_worker: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_writes: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    last_tested_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_test_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    last_test_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def is_cluster(self):
        return self.role == "cluster"

    @property
    def worker_host(self):
        """Address a tenant container should use to reach this cluster."""
        return self.host_from_worker or self.host

    def __repr__(self):
        return f"<DatabaseConnection {self.role} {self.name} {self.host}:{self.port}/{self.database_name}>"
