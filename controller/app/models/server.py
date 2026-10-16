import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.types import EncryptedString


class ServerNode(Base):
    __tablename__ = "server_nodes"

    ROLES = ("worker", "proxy")

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    # 'worker' hosts tenant containers; 'proxy' runs the edge. Placement must
    # never pick a proxy node -- see ServerController.available_node().
    role: Mapped[str] = mapped_column(String(20), default="worker", nullable=False)
    # Address tenant ports are published on and the edge dials. Falls back to
    # ip_address when unset (fine for local/private-only networks).
    private_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    # Caddy's admin API port on a role='proxy' node, reached over an SSH
    # tunnel -- never exposed publicly. NULL means the settings default
    # (proxy_admin_port_default, Caddy's own default of 2019) applies.
    proxy_admin_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ssh_port: Mapped[int] = mapped_column(Integer, default=22)
    ssh_user: Mapped[str] = mapped_column(String(50), default="root")
    ssh_key_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Fernet ciphertext of a pasted private key -- same encryption as
    # DatabaseConnection.password_encrypted (app/services/crypto.py). Decrypted
    # in-memory per SSH connection; never written to disk on the controller.
    ssh_key_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Password auth for local/dev worker VMs. Never returned by the API, and
    # Fernet-encrypted at rest (app/models/types.py) like the key beside it --
    # the serializer gating it out of responses was the only protection it had.
    ssh_password: Mapped[Optional[str]] = mapped_column(EncryptedString, nullable=True)
    # Explicit choice between ssh_password and ssh_key_encrypted, rather than
    # inferring from which column is non-null -- lets the edit UI unambiguously
    # clear the other credential when switching methods.
    ssh_auth_method: Mapped[str] = mapped_column(String(20), default="password", nullable=False)
    max_memory_mb: Mapped[int] = mapped_column(Integer, default=32768)
    used_memory_mb: Mapped[int] = mapped_column(Integer, default=0)
    max_containers: Mapped[int] = mapped_column(Integer, default=50)
    active_containers: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    frappe_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # Most customer sites this server may host. None = no limit; 0 = take no new sites.
    max_sites: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Hardware/OS specs, collected over SSH when the node is connected
    # (see ServerController.connect / SSHService.collect_specs).
    cpu_cores: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    disk_total_gb: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    disk_used_gb: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    os_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    kernel_version: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    architecture: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    docker_version: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_check_status: Mapped[Optional[str]] = mapped_column(
        String(30), nullable=True
    )  # ok, unreachable, docker_missing

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    tenants: Mapped[list["Tenant"]] = relationship("Tenant", back_populates="node")
    deployments: Mapped[List["Deployment"]] = relationship(
        "Deployment", back_populates="server"
    )

    @property
    def dial_host(self):
        """Address the edge proxy uses to reach containers on this node."""
        return self.private_ip or self.ip_address


class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_slug: Mapped[str] = mapped_column(String(63), unique=True, nullable=False)
    customer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    # Identity lives in the platform's shared "User" table (Prisma-owned);
    # the controller's own `customers` table was retired in c9d3a71e5b28.
    #
    # Real foreign keys: "User" and "Subscription" are mapped read-only in
    # app/models/platform.py purely so SQLAlchemy can resolve these. The
    # constraints themselves were created in Alembic b8c2f5e71a04; Alembic is
    # kept from managing the target tables by the include_object filter in
    # alembic/env.py.
    user_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("User.id", ondelete="SET NULL"), nullable=True
    )
    subscription_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("Subscription.id", ondelete="SET NULL"), nullable=True
    )
    # Which registered cluster this tenant's database lives on. NULL means
    # the legacy global cluster configured in settings (POSTGRES_*), which is
    # where every tenant lived before clusters were introduced.
    database_connection_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("database_connections.id", ondelete="RESTRICT"), nullable=True
    )
    plan_tier: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default="pending"
    )  # pending, active, paused, terminated
    node_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("server_nodes.id"), nullable=True
    )
    container_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    assigned_subdomain: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    custom_domain: Mapped[Optional[str]] = mapped_column(
        String(255), unique=True, nullable=True
    )
    db_name: Mapped[str] = mapped_column(String(63), nullable=False)
    db_user: Mapped[str] = mapped_column(String(63), nullable=False)
    # Encrypted at rest (app/models/types.py). The ORM still hands plaintext to
    # every caller, so provisioning, the Postgres service and the deployment
    # environment are unaffected.
    db_password: Mapped[str] = mapped_column(EncryptedString, nullable=False)
    # Signs the storefront's own auth tokens. Generated once at creation and
    # never regenerated -- rotating it on every deploy would invalidate every
    # signed-in session and any outstanding signed link.
    jwt_secret: Mapped[str] = mapped_column(EncryptedString, nullable=False)
    memory_limit_mb: Mapped[int] = mapped_column(Integer, default=256)
    cpu_limit_cores: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), default=Decimal("0.50")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    node: Mapped[Optional["ServerNode"]] = relationship(
        "ServerNode", back_populates="tenants"
    )
    database_connection: Mapped[Optional["DatabaseConnection"]] = relationship(
        "DatabaseConnection"
    )
    # Read-only views of the platform account that owns this tenant and the
    # subscription funding it. TenantController.base_query joinedloads both,
    # plus the subscription's plan, since the serializer names all three.
    user: Mapped[Optional["PlatformUser"]] = relationship("PlatformUser", viewonly=True)
    subscription: Mapped[Optional["PlatformSubscription"]] = relationship(
        "PlatformSubscription", viewonly=True
    )
    backups: Mapped[List["TenantBackup"]] = relationship(
        "TenantBackup", back_populates="tenant", cascade="all, delete-orphan"
    )
    db_migrations: Mapped[List["TenantDatabaseMigration"]] = relationship(
        "TenantDatabaseMigration",
        back_populates="tenant",
        cascade="all, delete-orphan",
        order_by="TenantDatabaseMigration.created_at.desc()",
    )
    migrations: Mapped[List["TenantMigration"]] = relationship(
        "TenantMigration", back_populates="tenant", cascade="all, delete-orphan"
    )
    deployments: Mapped[List["Deployment"]] = relationship(
        "Deployment",
        back_populates="tenant",
        cascade="all, delete-orphan",
        order_by="Deployment.created_at.desc()",
    )
    domains: Mapped[List["DomainMapping"]] = relationship(
        "DomainMapping",
        back_populates="tenant",
        cascade="all, delete-orphan",
        order_by="DomainMapping.created_at.asc()",
    )

    @property
    def live_deployment(self):
        """The deployment currently serving traffic, if any.

        Replaces reading `tenant.node_id` / `tenant.container_id` directly --
        those remain as a write-through cache only until Phase 4 drops them.
        """
        return next((d for d in self.deployments if d.status == "live"), None)

    @property
    def primary_domain(self):
        """The domain that should appear in "your store is live at" messaging.

        An active custom domain wins over the platform subdomain; replaces the
        `tenant.custom_domain or tenant.assigned_subdomain` expression that
        read the legacy columns directly.
        """
        custom = next(
            (d for d in self.domains if d.domain_type == "custom" and d.status == "active"),
            None,
        )
        if custom:
            return custom.domain
        platform = next((d for d in self.domains if d.domain_type == "platform"), None)
        return platform.domain if platform else self.assigned_subdomain
