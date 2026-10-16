"""Site resources and limits, backup schedule and history, custom domains."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'k7f25e9b1c86'
down_revision = 'j6e14d8a0b75'
branch_labels = None
depends_on = None


def upgrade():
    # What the site's plan allows. cpu/ram are applied to the containers; storage and users are audited.
    op.add_column('sites', sa.Column('cpu_limit', sa.Float(), nullable=False, server_default='2'))
    op.add_column('sites', sa.Column('storage_limit_gb', sa.Integer(), nullable=False, server_default='10'))
    op.add_column('sites', sa.Column('user_limit', sa.Integer(), nullable=True))
    # Latest audit of those limits.
    op.add_column('sites', sa.Column('user_count', sa.Integer(), nullable=True))
    op.add_column('sites', sa.Column('storage_used_mb', sa.Integer(), nullable=True))
    op.add_column('sites', sa.Column('limit_state', sa.String(20), nullable=True))
    op.add_column('sites', sa.Column('audited_at', sa.DateTime(timezone=True), nullable=True))
    # Scheduled backups.
    op.add_column('sites', sa.Column('backup_schedule', sa.String(10), nullable=False, server_default='off'))
    op.add_column('sites', sa.Column('backup_retention', sa.Integer(), nullable=False, server_default='7'))
    op.add_column('sites', sa.Column('last_backup_at', sa.DateTime(timezone=True), nullable=True))

    op.create_table('site_backups',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('site_id', UUID(as_uuid=True), sa.ForeignKey('sites.id', ondelete='CASCADE'), nullable=False),
        # bench's timestamp prefix, e.g. 20261015_213552: groups the database, files and config of one backup
        sa.Column('stamp', sa.String(32), nullable=False),
        sa.Column('kind', sa.String(12), nullable=False, server_default='manual'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('site_id', 'stamp'))
    op.create_index('ix_site_backups_site_id', 'site_backups', ['site_id'])

    op.create_table('site_domains',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('site_id', UUID(as_uuid=True), sa.ForeignKey('sites.id', ondelete='CASCADE'), nullable=False),
        sa.Column('domain', sa.String(253), nullable=False, unique=True),
        sa.Column('status', sa.String(12), nullable=False, server_default='pending'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_checked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('tls_status', sa.String(12), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_index('ix_site_domains_site_id', 'site_domains', ['site_id'])


def downgrade():
    op.drop_table('site_domains')
    op.drop_table('site_backups')
    for column in ('last_backup_at', 'backup_retention', 'backup_schedule', 'audited_at', 'limit_state',
                   'storage_used_mb', 'user_count', 'user_limit', 'storage_limit_gb', 'cpu_limit'):
        op.drop_column('sites', column)
