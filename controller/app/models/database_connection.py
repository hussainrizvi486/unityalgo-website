"""A registered PostgreSQL instance.

Serves two roles, distinguished by `role`:

  'cluster'   We hold admin credentials for it and can CREATE DATABASE, so
              tenants can be provisioned onto it and moved between clusters.
  'external'  Query-console target only -- an arbitrary Postgres (a replica,
              a third-party database) we can connect to and read from but do
              not provision onto. This is the default, and what every row in
              this table was before clusters existed.

Credentials are encrypted at rest (see app/services/crypto.py), not just
encrypted the way ServerNode.ssh_password / Tenant.db_password now are
are today -- this table holds live credentials to third-party databases, a
materially bigger blast radius than the controller's own tenant secrets.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

SSL_MODES = ("disable", "allow", "prefer", "require", "verify-ca", "verify-full")
ROLES = ("cluster", "external")


class DatabaseConnection(Base):
    __tablename__ = "database_connections"

    SSL_MODES = SSL_MODES
    ROLES = ROLES

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, default=5432)
    # Named database_name (not `database`) to keep it unambiguous everywhere
    # it's referenced -- model attribute, serializer key, query params.
    database_name: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[str] = mapped_column(String(255), nullable=False)
    # Fernet ciphertext (base64 text), never the plaintext password.
    password_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    sslmode: Mapped[str] = mapped_column(String(20), default="prefer")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    role: Mapped[str] = mapped_column(String(20), default="external")
    # The cluster's address as seen from a worker node. A tenant container
    # runs on a remote host, so the address the controller uses to reach the
    # database is frequently not one the container can resolve. Falls back to
    # `host` when unset.
    host_from_worker: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Where new tenants are provisioned when no cluster is chosen. A partial
    # unique index enforces at most one.
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    # Whether the query console may run statements that modify data. Off by
    # default: the console exists to inspect, and writing to a production
    # cluster should be a deliberate act. Enforced by running read-only
    # statements inside a Postgres READ ONLY transaction, so the engine
    # rejects the write rather than a keyword check that could be worked
    # around with `WITH ... DELETE` or `SELECT ... INTO`.
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
