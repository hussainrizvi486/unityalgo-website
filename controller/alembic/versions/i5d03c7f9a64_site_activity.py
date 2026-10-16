"""Sites: a background activity marker (e.g. an in-progress backup)."""
from alembic import op
import sqlalchemy as sa

revision = 'i5d03c7f9a64'
down_revision = 'h4c92b6e8f53'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('sites', sa.Column('activity', sa.String(20), nullable=True))

def downgrade():
    op.drop_column('sites', 'activity')
