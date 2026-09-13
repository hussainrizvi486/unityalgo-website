"""Make database_connections usable as tenant-hosting clusters.

Until now every tenant database lived on the one Postgres the controller
itself runs on (settings.postgres_*), and `database_connections` was a
separate, unrelated list of databases for the ad-hoc query console.

This turns that table into a registry of *clusters* a tenant can be
provisioned onto, so tenants can be spread across clusters and moved between
them.

Three additions:

  role              'cluster' — we hold admin credentials and can CREATE
                    DATABASE on it, so tenants can live here.
                    'external' — query-console target only (the old
                    behaviour, and the default so existing rows are
                    unchanged).
  host_from_worker  The cluster's address *as seen from a worker node*. The
                    controller's own view of a host is frequently not
                    reachable from a tenant container on a remote node —
                    this is the per-cluster equivalent of TENANT_DB_HOST.
  is_default        Which cluster new tenants land on when none is chosen.

`tenants.database_connection_id` is nullable on purpose: NULL means "the
legacy global cluster from settings", so every existing tenant keeps working
untouched and can be adopted onto an explicit cluster later.

Revision ID: d4a17c9b62f3
Revises: c9d3a71e5b28
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "d4a17c9b62f3"
down_revision = "c9d3a71e5b28"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "database_connections",
        sa.Column("role", sa.String(20), nullable=False, server_default="external"),
    )
    op.add_column("database_connections", sa.Column("host_from_worker", sa.String(255), nullable=True))
    op.add_column(
        "database_connections",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("database_connections_role_idx", "database_connections", ["role"])

    op.add_column(
        "tenants",
        sa.Column("database_connection_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "tenants_database_connection_id_fkey",
        "tenants",
        "database_connections",
        ["database_connection_id"],
        ["id"],
        # RESTRICT, not SET NULL: silently detaching a tenant from the cluster
        # its data actually lives on would point it back at the legacy global
        # cluster, where its database does not exist.
        ondelete="RESTRICT",
    )
    op.create_index("tenants_database_connection_id_idx", "tenants", ["database_connection_id"])

    # Audit trail + state machine for moving a tenant between clusters,
    # mirroring tenant_migrations (which does the same for worker nodes).
    op.create_table(
        "tenant_db_migrations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "from_connection_id",
            UUID(as_uuid=True),
            sa.ForeignKey("database_connections.id"),
            nullable=True,
        ),
        sa.Column(
            "to_connection_id",
            UUID(as_uuid=True),
            sa.ForeignKey("database_connections.id"),
            nullable=False,
        ),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("backup_path", sa.Text(), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("tenant_db_migrations_tenant_id_idx", "tenant_db_migrations", ["tenant_id"])

    # A default is only meaningful for a cluster, and only one may hold it.
    op.create_index(
        "database_connections_single_default_idx",
        "database_connections",
        ["is_default"],
        unique=True,
        postgresql_where=sa.text("is_default = true"),
    )


def downgrade():
    op.drop_index("database_connections_single_default_idx", table_name="database_connections")
    op.drop_index("tenant_db_migrations_tenant_id_idx", table_name="tenant_db_migrations")
    op.drop_table("tenant_db_migrations")
    op.drop_index("tenants_database_connection_id_idx", table_name="tenants")
    op.drop_constraint("tenants_database_connection_id_fkey", "tenants", type_="foreignkey")
    op.drop_column("tenants", "database_connection_id")
    op.drop_index("database_connections_role_idx", table_name="database_connections")
    op.drop_column("database_connections", "is_default")
    op.drop_column("database_connections", "host_from_worker")
    op.drop_column("database_connections", "role")
