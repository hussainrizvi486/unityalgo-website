"""Site wizard: plan, owner email, failure details.

Company, currency and chart-of-accounts choices and the owner password are
deliberately not stored here; they are handed to Frappe's setup wizard.
"""
from alembic import op
import sqlalchemy as sa

revision = 'g3b81a5d7e42'
down_revision = 'f2a91012c001'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('sites', sa.Column('plan_id', sa.String(64), nullable=True))
    op.add_column('sites', sa.Column('plan_name', sa.String(100), nullable=True))
    op.add_column('sites', sa.Column('owner_email', sa.String(254), nullable=True))
    op.add_column('sites', sa.Column('error', sa.Text(), nullable=True))
    op.add_column('sites', sa.Column('failed_step', sa.String(30), nullable=True))

def downgrade():
    for column in ('failed_step', 'error', 'owner_email', 'plan_name', 'plan_id'):
        op.drop_column('sites', column)
