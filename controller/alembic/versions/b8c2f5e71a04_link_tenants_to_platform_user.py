"""Link tenants to the shared platform User/Subscription tables.

Part of folding the controller into the UnityAlgo platform: identity now
lives in one place (Prisma-owned "User"), so a tenant points at a User rather
than at the controller's own `customers` row.

The FKs cross migration-tool boundaries -- "User" and "Subscription" are
owned by Prisma, `tenants` by Alembic -- which Postgres does not care about.
The ownership convention is documented in controller/README.md.

`customer_id` is left in place here rather than dropped: the data migration
(scripts/migrate-controller-customers.ts) needs both columns populated at
once to correlate old rows with new ones. A follow-up migration drops it
along with the retired tables once the backfill is verified.

Revision ID: b8c2f5e71a04
Revises: a79eec0cfb2e
"""

from alembic import op
import sqlalchemy as sa

revision = "b8c2f5e71a04"
down_revision = "a79eec0cfb2e"
branch_labels = None
depends_on = None


def upgrade():
    # Both nullable: a tenant created before the merge has no User yet, and
    # the backfill script is what fills these in.
    op.add_column("tenants", sa.Column("user_id", sa.Text(), nullable=True))
    op.add_column("tenants", sa.Column("subscription_id", sa.Text(), nullable=True))

    op.create_foreign_key(
        "tenants_user_id_fkey",
        "tenants",
        "User",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "tenants_subscription_id_fkey",
        "tenants",
        "Subscription",
        ["subscription_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index("tenants_user_id_idx", "tenants", ["user_id"])

    # BillingRecord.tenantId is a soft reference from the Prisma side (Prisma
    # cannot model a relation to a table it does not own), so the constraint
    # is declared here where `tenants` lives.
    op.create_foreign_key(
        "BillingRecord_tenantId_fkey",
        "BillingRecord",
        "tenants",
        ["tenantId"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint("BillingRecord_tenantId_fkey", "BillingRecord", type_="foreignkey")
    op.drop_index("tenants_user_id_idx", table_name="tenants")
    op.drop_constraint("tenants_subscription_id_fkey", "tenants", type_="foreignkey")
    op.drop_constraint("tenants_user_id_fkey", "tenants", type_="foreignkey")
    op.drop_column("tenants", "subscription_id")
    op.drop_column("tenants", "user_id")
