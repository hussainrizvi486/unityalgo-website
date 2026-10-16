"""Sites: a per-attempt counter, so notifications and emails dedupe on a stable id."""
from alembic import op
import sqlalchemy as sa

revision = 'j6e14d8a0b75'
down_revision = 'i5d03c7f9a64'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('sites', sa.Column('attempt', sa.Integer(), nullable=False, server_default='1'))

def downgrade():
    op.drop_column('sites', 'attempt')
