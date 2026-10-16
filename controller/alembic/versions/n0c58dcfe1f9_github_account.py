"""App Store: the connected GitHub account, and whether a rollout's repository is private."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'n0c58dcfe1f9'
down_revision = 'm9b47cbed0e8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('github_accounts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('login', sa.String(100), nullable=False),
        sa.Column('name', sa.String(200), nullable=True),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('html_url', sa.String(300), nullable=True),
        sa.Column('scopes', sa.String(300), nullable=True),
        sa.Column('token', sa.Text(), nullable=False),          # Fernet ciphertext
        sa.Column('connected_by', sa.String(100), nullable=True),
        sa.Column('connected_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.add_column('app_rollouts', sa.Column('private', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('app_rollouts', 'private')
    op.drop_table('github_accounts')
