"""add deployments table, server node role/private_ip; backfill deployments

Revision ID: a7d1c4e90b21
Revises: 9c4e18b7a250
Create Date: 2026-08-09

Phase 1 of the edge-proxy architecture: a tenant's running application becomes
a first-class `Deployment` row owning the server, host port and container, so
the edge proxy has something concrete to dial.
"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "a7d1c4e90b21"
down_revision: Union[str, Sequence[str], None] = "9c4e18b7a250"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PORT_RANGE_START = 20000


def upgrade() -> None:
    # -- server_nodes: role + private_ip -------------------------------
    op.add_column(
        "server_nodes",
        sa.Column("role", sa.String(length=20), nullable=False, server_default="worker"),
    )
    op.add_column(
        "server_nodes", sa.Column("private_ip", sa.String(length=45), nullable=True)
    )
    # Local/private-only fleets have no separate private address; default it to
    # the address we already know so `dial_host` is never NULL in practice.
    op.execute("UPDATE server_nodes SET private_ip = ip_address WHERE private_ip IS NULL")
    op.create_index("ix_server_nodes_role", "server_nodes", ["role"])

    # -- deployments ----------------------------------------------------
    op.create_table(
        "deployments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "server_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("server_nodes.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "application", sa.String(length=50), nullable=False, server_default="storefront"
        ),
        sa.Column("image", sa.String(length=255), nullable=False),
        sa.Column("container_name", sa.String(length=128), nullable=False),
        sa.Column("container_id", sa.String(length=128), nullable=True),
        sa.Column("port", sa.Integer(), nullable=False),
        sa.Column("container_port", sa.Integer(), nullable=False, server_default="3000"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column(
            "health_status", sa.String(length=20), nullable=False, server_default="unknown"
        ),
        sa.Column("health_message", sa.Text(), nullable=True),
        sa.Column("last_health_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("memory_limit_mb", sa.Integer(), nullable=False),
        sa.Column("cpu_limit_cores", sa.Numeric(3, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stopped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("port_released_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("server_id", "port", name="uq_deployments_server_port"),
    )
    # Partial unique index: at most one LIVE deployment per tenant. Written by
    # hand because autogenerate does not emit postgresql_where.
    op.create_index(
        "uq_deployments_live_per_tenant",
        "deployments",
        ["tenant_id"],
        unique=True,
        postgresql_where=sa.text("status = 'live'"),
    )
    op.create_index("ix_deployments_tenant_status", "deployments", ["tenant_id", "status"])
    op.create_index("ix_deployments_server_status", "deployments", ["server_id", "status"])

    # -- backfill: one live deployment per already-provisioned tenant ----
    # Ports are assigned deterministically per node so existing tenants get a
    # stable slot. NOTE: their containers were started without a published
    # port, so each needs one redeploy before the edge can reach it.
    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            """
            SELECT id, node_id, container_id, tenant_slug,
                   memory_limit_mb, cpu_limit_cores, created_at
            FROM tenants
            WHERE node_id IS NOT NULL AND container_id IS NOT NULL
            ORDER BY node_id, created_at
            """
        )
    ).mappings().all()

    next_port = {}
    for row in rows:
        port = next_port.get(row["node_id"], PORT_RANGE_START)
        next_port[row["node_id"]] = port + 1
        connection.execute(
            sa.text(
                """
                INSERT INTO deployments (
                    id, tenant_id, server_id, application, image, container_name,
                    container_id, port, container_port, status, health_status,
                    memory_limit_mb, cpu_limit_cores, created_at, updated_at
                ) VALUES (
                    :id, :tenant_id, :server_id, 'storefront', :image, :container_name,
                    :container_id, :port, :container_port, 'live', 'unknown',
                    :memory_limit_mb, :cpu_limit_cores, :created_at, now()
                )
                """
            ),
            {
                "id": uuid.uuid4(),
                "tenant_id": row["id"],
                "server_id": row["node_id"],
                "image": "legacy:unknown",
                "container_name": f"tenant_{row['tenant_slug']}",
                "container_id": row["container_id"],
                "port": port,
                "container_port": 3000,
                "memory_limit_mb": row["memory_limit_mb"] or 256,
                "cpu_limit_cores": row["cpu_limit_cores"] or 0.50,
                "created_at": row["created_at"],
            },
        )


def downgrade() -> None:
    op.drop_table("deployments")
    op.drop_index("ix_server_nodes_role", table_name="server_nodes")
    op.drop_column("server_nodes", "private_ip")
    op.drop_column("server_nodes", "role")
