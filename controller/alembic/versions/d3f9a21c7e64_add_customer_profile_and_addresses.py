"""add customer profile fields and addresses table

Revision ID: d3f9a21c7e64
Revises: c5e8f2a4b917
Create Date: 2026-08-15

Expands the Customer record into proper personal/contact/business/other
sections, and moves addresses out into their own one-to-many table (a
customer can have several -- billing, shipping, home, office) instead of
being flat columns on the customer itself. All new customer columns are
nullable, so no backfill is needed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "d3f9a21c7e64"
down_revision: Union[str, Sequence[str], None] = "c5e8f2a4b917"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- customers: new profile fields + updated_at --------------------
    op.add_column("customers", sa.Column("first_name", sa.String(length=120), nullable=True))
    op.add_column("customers", sa.Column("last_name", sa.String(length=120), nullable=True))
    op.add_column("customers", sa.Column("job_title", sa.String(length=120), nullable=True))
    op.add_column("customers", sa.Column("alternate_phone", sa.String(length=50), nullable=True))
    op.add_column("customers", sa.Column("website", sa.String(length=255), nullable=True))
    op.add_column("customers", sa.Column("tax_id", sa.String(length=100), nullable=True))
    op.add_column("customers", sa.Column("industry", sa.String(length=120), nullable=True))
    op.add_column("customers", sa.Column("company_size", sa.String(length=20), nullable=True))
    op.add_column("customers", sa.Column("preferred_currency", sa.String(length=3), nullable=True))
    op.add_column("customers", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column(
        "customers",
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # -- addresses --------------------------------------------------------
    op.create_table(
        "addresses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("address_type", sa.String(length=20), nullable=False, server_default="billing"),
        sa.Column("label", sa.String(length=100), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("line1", sa.String(length=255), nullable=False),
        sa.Column("line2", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("state", sa.String(length=120), nullable=True),
        sa.Column("postal_code", sa.String(length=30), nullable=True),
        sa.Column("country", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_addresses_customer_id", "addresses", ["customer_id"])


def downgrade() -> None:
    op.drop_index("ix_addresses_customer_id", table_name="addresses")
    op.drop_table("addresses")

    op.drop_column("customers", "updated_at")
    op.drop_column("customers", "notes")
    op.drop_column("customers", "preferred_currency")
    op.drop_column("customers", "company_size")
    op.drop_column("customers", "industry")
    op.drop_column("customers", "tax_id")
    op.drop_column("customers", "website")
    op.drop_column("customers", "alternate_phone")
    op.drop_column("customers", "job_title")
    op.drop_column("customers", "last_name")
    op.drop_column("customers", "first_name")
