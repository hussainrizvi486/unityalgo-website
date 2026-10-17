"""App rollouts: whether the app comes from a repository or already ships in the platform image."""
from alembic import op
import sqlalchemy as sa

revision = 'p2e7a0f1c3d1'
down_revision = 'o1d69edf0a0b'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('app_rollouts', sa.Column('source', sa.String(10), nullable=False, server_default='github'))


def downgrade():
    op.drop_column('app_rollouts', 'source')
