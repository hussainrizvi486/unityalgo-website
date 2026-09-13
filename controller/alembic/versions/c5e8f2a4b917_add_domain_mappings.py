"""add domain_mappings; backfill from tenants.assigned_subdomain/custom_domain

Revision ID: c5e8f2a4b917
Revises: b4f6a1d0c8e3
Create Date: 2026-08-12

Domain -> deployment is now a first-class row instead of two scalar columns on
Tenant, so a tenant can carry more than one domain and so migrating a tenant
between nodes only ever rewrites `deployment_id`, never the domain or DNS.

`tenants.assigned_subdomain` / `custom_domain` are NOT dropped here -- they
stay as a write-through cache (kept in sync by TenantController) until the
~20 remaining read sites are migrated off them in a later revision.
"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "c5e8f2a4b917"
down_revision: Union[str, Sequence[str], None] = "b4f6a1d0c8e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "domain_mappings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "deployment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("deployments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("domain", sa.String(length=255), nullable=False),
        sa.Column(
            "domain_type", sa.String(length=20), nullable=False, server_default="platform"
        ),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("ssl_status", sa.String(length=20), nullable=False, server_default="none"),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("domain", name="uq_domain_mappings_domain"),
    )
    op.create_index("ix_domain_mappings_tenant_id", "domain_mappings", ["tenant_id"])
    op.create_index(
        "ix_domain_mappings_deployment_id", "domain_mappings", ["deployment_id"]
    )
    op.create_index(
        "ix_domain_mappings_type_status", "domain_mappings", ["domain_type", "status"]
    )

    # -- backfill: one platform mapping per tenant, one custom mapping for
    # tenants that already had a custom_domain set. deployment_id points at
    # the tenant's current live deployment when one exists.
    connection = op.get_bind()
    tenants = connection.execute(
        sa.text(
            """
            SELECT t.id, t.assigned_subdomain, t.custom_domain,
                   (SELECT d.id FROM deployments d
                    WHERE d.tenant_id = t.id AND d.status = 'live'
                    LIMIT 1) AS live_deployment_id
            FROM tenants t
            """
        )
    ).mappings().all()

    for row in tenants:
        has_deployment = row["live_deployment_id"] is not None
        connection.execute(
            sa.text(
                """
                INSERT INTO domain_mappings
                    (id, tenant_id, deployment_id, domain, domain_type, status,
                     ssl_status, created_at, updated_at)
                VALUES
                    (:id, :tenant_id, :deployment_id, :domain, 'platform', :status,
                     'none', now(), now())
                """
            ),
            {
                "id": uuid.uuid4(),
                "tenant_id": row["id"],
                "deployment_id": row["live_deployment_id"],
                "domain": row["assigned_subdomain"].lower(),
                "status": "active" if has_deployment else "pending",
            },
        )
        if row["custom_domain"]:
            connection.execute(
                sa.text(
                    """
                    INSERT INTO domain_mappings
                        (id, tenant_id, deployment_id, domain, domain_type, status,
                         ssl_status, created_at, updated_at)
                    VALUES
                        (:id, :tenant_id, :deployment_id, :domain, 'custom', :status,
                         'none', now(), now())
                    """
                ),
                {
                    "id": uuid.uuid4(),
                    "tenant_id": row["id"],
                    "deployment_id": row["live_deployment_id"],
                    "domain": row["custom_domain"].lower(),
                    "status": "active" if has_deployment else "pending",
                },
            )


def downgrade() -> None:
    op.drop_table("domain_mappings")
