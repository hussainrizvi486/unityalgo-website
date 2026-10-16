"""App Store: installed app versions per site, and rollouts of app updates."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'm9b47cbed0e8'
down_revision = 'l8a36fac2d97'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('site_apps',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('site_id', UUID(as_uuid=True), sa.ForeignKey('sites.id', ondelete='CASCADE'), nullable=False),
        sa.Column('app_name', sa.String(100), nullable=False),
        sa.Column('version', sa.String(64), nullable=True),
        sa.Column('commit', sa.String(40), nullable=True),
        sa.Column('branch', sa.String(120), nullable=True),
        sa.Column('scanned_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('site_id', 'app_name'))
    op.create_index('ix_site_apps_site_id', 'site_apps', ['site_id'])
    op.create_index('ix_site_apps_app_name', 'site_apps', ['app_name'])

    op.create_table('app_rollouts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('app_name', sa.String(100), nullable=False),
        sa.Column('repo_url', sa.String(255), nullable=False),
        sa.Column('branch', sa.String(120), nullable=False),
        sa.Column('target_commit', sa.String(40), nullable=False),
        sa.Column('target_version', sa.String(64), nullable=True),
        sa.Column('action', sa.String(10), nullable=False),
        sa.Column('status', sa.String(12), nullable=False, server_default='running'),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_app_rollouts_app_name', 'app_rollouts', ['app_name'])

    op.create_table('app_rollout_sites',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('rollout_id', UUID(as_uuid=True), sa.ForeignKey('app_rollouts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('site_id', UUID(as_uuid=True), sa.ForeignKey('sites.id', ondelete='CASCADE'), nullable=False),
        sa.Column('site_slug', sa.String(48), nullable=False),
        sa.Column('status', sa.String(10), nullable=False, server_default='pending'),
        sa.Column('step', sa.String(200), nullable=True),
        sa.Column('progress', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('from_version', sa.String(64), nullable=True),
        sa.Column('from_commit', sa.String(40), nullable=True),
        sa.Column('to_version', sa.String(64), nullable=True),
        sa.Column('to_commit', sa.String(40), nullable=True),
        sa.Column('backup_stamp', sa.String(32), nullable=True),
        sa.Column('rolled_back', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('log', sa.Text(), nullable=True),
        sa.Column('operation_id', UUID(as_uuid=True), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('rollout_id', 'site_id'))
    op.create_index('ix_app_rollout_sites_rollout_id', 'app_rollout_sites', ['rollout_id'])
    op.create_index('ix_app_rollout_sites_site_id', 'app_rollout_sites', ['site_id'])


def downgrade():
    op.drop_table('app_rollout_sites')
    op.drop_table('app_rollouts')
    op.drop_table('site_apps')
