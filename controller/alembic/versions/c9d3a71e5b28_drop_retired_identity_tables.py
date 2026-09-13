"""Drop the controller's retired identity tables.

Run this only AFTER `npm run migrate:controller-identity -- --apply` has moved
the data into the shared platform tables and it has been verified. It is
destructive and the downgrade recreates the structure but not the rows.

  admin_users      -> gone; admins are Role.ADMIN on the shared "User" table
  customers        -> "User" (role = CUSTOMER)
  addresses        -> "Address"
  billing_records  -> "BillingRecord"

`tenants.customer_id` goes too — `tenants.user_id`, added in b8c2f5e71a04,
replaces it.

Revision ID: c9d3a71e5b28
Revises: b8c2f5e71a04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "c9d3a71e5b28"
down_revision = "b8c2f5e71a04"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()

    # Refuse to destroy data that has not been migrated yet: if any customer
    # row has no matching User, the backfill has not been run (or not
    # completed) and dropping now would lose it.
    unmigrated = connection.execute(
        sa.text(
            """
            SELECT count(*) FROM customers c
            WHERE NOT EXISTS (
                SELECT 1 FROM "User" u WHERE lower(u.email) = lower(c.email)
            )
            """
        )
    ).scalar()
    if unmigrated:
        raise RuntimeError(
            f"{unmigrated} customer row(s) have no matching User. "
            "Run `npm run migrate:controller-identity -- --apply` first."
        )

    # The constraint name differs between installs depending on whether it was
    # created implicitly by SQLAlchemy or named explicitly in an earlier
    # migration, so resolve it from the catalog rather than guessing.
    constraint_name = connection.execute(
        sa.text(
            """
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
            WHERE t.relname = 'tenants'
              AND c.contype = 'f'
              AND a.attname = 'customer_id'
            """
        )
    ).scalar()
    if constraint_name:
        op.drop_constraint(constraint_name, "tenants", type_="foreignkey")
    op.drop_column("tenants", "customer_id")

    op.drop_table("billing_records")
    op.drop_table("addresses")
    op.drop_table("customers")
    op.drop_table("admin_users")


def downgrade():
    """Recreates the structure only — the rows are not recoverable here."""
    op.create_table(
        "admin_users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(80), nullable=False, unique=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="admin"),
        sa.Column("is_active", sa.Boolean, server_default=sa.true()),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "customers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("company", sa.String(255)),
        sa.Column("phone", sa.String(50)),
        sa.Column("is_active", sa.Boolean, server_default=sa.true()),
        sa.Column("first_name", sa.String(120)),
        sa.Column("last_name", sa.String(120)),
        sa.Column("job_title", sa.String(120)),
        sa.Column("alternate_phone", sa.String(50)),
        sa.Column("website", sa.String(255)),
        sa.Column("tax_id", sa.String(100)),
        sa.Column("industry", sa.String(120)),
        sa.Column("company_size", sa.String(20)),
        sa.Column("preferred_currency", sa.String(3)),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "addresses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("address_type", sa.String(20), server_default="billing"),
        sa.Column("label", sa.String(120)),
        sa.Column("is_default", sa.Boolean, server_default=sa.false()),
        sa.Column("line1", sa.String(255), nullable=False),
        sa.Column("line2", sa.String(255)),
        sa.Column("city", sa.String(120)),
        sa.Column("state", sa.String(120)),
        sa.Column("postal_code", sa.String(30)),
        sa.Column("country", sa.String(120)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "billing_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="SET NULL")),
        sa.Column("invoice_number", sa.String(50), nullable=False, unique=True),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), server_default="USD"),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("period_start", sa.Date),
        sa.Column("period_end", sa.Date),
        sa.Column("issued_at", sa.Date),
        sa.Column("due_date", sa.Date),
        sa.Column("paid_at", sa.Date),
        sa.Column("payment_method", sa.String(50)),
        sa.Column("payment_reference", sa.String(255)),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.add_column("tenants", sa.Column("customer_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("tenants_customer_id_fkey", "tenants", "customers", ["customer_id"], ["id"])
