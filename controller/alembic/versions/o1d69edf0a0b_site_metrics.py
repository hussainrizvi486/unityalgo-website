"""Monitoring: periodic readings of each running site."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'o1d69edf0a0b'
down_revision = 'n0c58dcfe1f9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('site_metrics',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('site_id', UUID(as_uuid=True), sa.ForeignKey('sites.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ts', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('cpu_percent', sa.Float(), nullable=True),
        sa.Column('memory_mb', sa.Float(), nullable=True),
        sa.Column('storage_mb', sa.Integer(), nullable=True),
        sa.Column('healthy', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('response_ms', sa.Integer(), nullable=True),
        sa.Column('users', sa.Integer(), nullable=True))
    op.create_index('ix_site_metrics_site_ts', 'site_metrics', ['site_id', 'ts'])


def downgrade():
    op.drop_table('site_metrics')
