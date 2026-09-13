"""Link tenants to subscriptions: one storefront per subscription.

`tenants.subscription_id` has existed since b8c2f5e71a04, but nothing stopped
two tenants pointing at the same subscription -- which would mean one paid
plan silently funding two storefronts. A partial unique index makes the
one-to-one real while still allowing many tenants with no subscription yet
(NULLs are distinct in a Postgres unique index, but the WHERE clause keeps the
index small and states the intent).

Also backfills `tenants.user_id` from the subscription for any row that has a
subscription but no user, so the two columns cannot disagree.

Revision ID: e7b41dc9f083
Revises: d4a17c9b62f3
"""

import sqlalchemy as sa
from alembic import op

revision = "e7b41dc9f083"
down_revision = "d4a17c9b62f3"
branch_labels = None
depends_on = None


def upgrade():
    # Any pre-existing duplicate would make the index creation fail with a
    # message that names the table but not the fix, so check for it first.
    conn = op.get_bind()
    duplicates = conn.exec_driver_sql(
        """
        SELECT subscription_id, count(*) AS n
        FROM tenants
        WHERE subscription_id IS NOT NULL
        GROUP BY subscription_id
        HAVING count(*) > 1
        """
    ).fetchall()
    if duplicates:
        listed = ", ".join(f"{row[0]} ({row[1]} tenants)" for row in duplicates)
        raise RuntimeError(
            "Cannot enforce one tenant per subscription: these subscriptions are "
            f"already shared by more than one tenant — {listed}. Repoint or clear "
            "the extras before running this migration."
        )

    # The subscription is the source of truth for who the customer is.
    op.execute(
        """
        UPDATE tenants t
           SET user_id = s."userId"
          FROM "Subscription" s
         WHERE t.subscription_id = s.id
           AND (t.user_id IS NULL OR t.user_id <> s."userId")
        """
    )

    op.create_index(
        "uq_tenants_subscription_id",
        "tenants",
        ["subscription_id"],
        unique=True,
        postgresql_where=sa.text("subscription_id IS NOT NULL"),
    )


def downgrade():
    op.drop_index("uq_tenants_subscription_id", table_name="tenants")
