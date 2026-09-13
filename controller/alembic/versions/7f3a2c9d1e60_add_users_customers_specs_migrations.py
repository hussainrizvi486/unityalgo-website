"""add admin_users, customers, server specs, tenant backups/migrations

Revision ID: 7f3a2c9d1e60
Revises: 2b7c4e91d3a0
Create Date: 2026-08-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "7f3a2c9d1e60"
down_revision: Union[str, Sequence[str], None] = "2b7c4e91d3a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- admin_users --------------------------------------------------
    op.create_table(
        "admin_users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="admin"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.UniqueConstraint("username"),
        sa.UniqueConstraint("email"),
    )

    # -- customers ------------------------------------------------------
    op.create_table(
        "customers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("company", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.UniqueConstraint("email"),
    )

    # -- tenants.customer_id ---------------------------------------------
    op.add_column(
        "tenants",
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_tenants_customer_id", "tenants", "customers", ["customer_id"], ["id"]
    )

    # -- server_nodes spec columns ----------------------------------------
    op.add_column("server_nodes", sa.Column("cpu_cores", sa.Integer(), nullable=True))
    op.add_column(
        "server_nodes", sa.Column("disk_total_gb", sa.Integer(), nullable=True)
    )
    op.add_column(
        "server_nodes", sa.Column("disk_used_gb", sa.Integer(), nullable=True)
    )
    op.add_column(
        "server_nodes", sa.Column("os_name", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "server_nodes",
        sa.Column("kernel_version", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "server_nodes", sa.Column("architecture", sa.String(length=30), nullable=True)
    )
    op.add_column(
        "server_nodes",
        sa.Column("docker_version", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "server_nodes",
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "server_nodes",
        sa.Column("last_check_status", sa.String(length=30), nullable=True),
    )

    # -- tenant_backups -----------------------------------------------
    op.create_table(
        "tenant_backups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "node_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("server_nodes.id"),
            nullable=True,
        ),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("reason", sa.String(length=50), nullable=False, server_default="manual"),
        sa.Column("backup_path", sa.String(length=500), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # -- tenant_migrations ----------------------------------------------
    op.create_table(
        "tenant_migrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "from_node_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("server_nodes.id"),
            nullable=True,
        ),
        sa.Column(
            "to_node_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("server_nodes.id"),
            nullable=False,
        ),
        sa.Column(
            "backup_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenant_backups.id"),
            nullable=True,
        ),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("tenant_migrations")
    op.drop_table("tenant_backups")

    for column in (
        "last_check_status",
        "last_checked_at",
        "docker_version",
        "architecture",
        "kernel_version",
        "os_name",
        "disk_used_gb",
        "disk_total_gb",
        "cpu_cores",
    ):
        op.drop_column("server_nodes", column)

    op.drop_constraint("fk_tenants_customer_id", "tenants", type_="foreignkey")
    op.drop_column("tenants", "customer_id")

    op.drop_table("customers")
    op.drop_table("admin_users")
