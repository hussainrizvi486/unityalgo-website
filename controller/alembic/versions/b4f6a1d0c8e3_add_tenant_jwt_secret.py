"""add tenants.jwt_secret

Revision ID: b4f6a1d0c8e3
Revises: a7d1c4e90b21
Create Date: 2026-08-11

The storefront app signs its own auth tokens and needs a stable per-tenant
secret. Previously nothing generated one, so the deployed app crashed with
"JWT_SECRET must be set in production." Added nullable, backfilled for any
existing rows, then set NOT NULL -- safe regardless of whether tenants exist
at migration time.
"""
import secrets
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b4f6a1d0c8e3"
down_revision: Union[str, Sequence[str], None] = "a7d1c4e90b21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenants", sa.Column("jwt_secret", sa.String(length=255), nullable=True)
    )

    connection = op.get_bind()
    tenant_ids = connection.execute(
        sa.text("SELECT id FROM tenants WHERE jwt_secret IS NULL")
    ).scalars().all()
    for tenant_id in tenant_ids:
        connection.execute(
            sa.text("UPDATE tenants SET jwt_secret = :secret WHERE id = :id"),
            {"secret": secrets.token_urlsafe(48), "id": tenant_id},
        )

    op.alter_column("tenants", "jwt_secret", nullable=False)


def downgrade() -> None:
    op.drop_column("tenants", "jwt_secret")
