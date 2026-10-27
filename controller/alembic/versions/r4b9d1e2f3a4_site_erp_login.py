"""The customer's own ERP login, kept encrypted so "Access site" can sign them in."""
from alembic import op
import sqlalchemy as sa

revision = 'r4b9d1e2f3a4'
down_revision = 'q3f8b1c2d4e5'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('sites', sa.Column('erp_user_password', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('sites', 'erp_user_password')
