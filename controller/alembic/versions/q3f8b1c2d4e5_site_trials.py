"""Free trials: when a site's trial ends, and which customers have used which plan's trial."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'q3f8b1c2d4e5'
down_revision = 'p2e7a0f1c3d1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('sites', sa.Column('trial_ends_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('sites', sa.Column('trial_expired_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('sites', sa.Column('trial_warned', sa.Boolean(), nullable=False, server_default='false'))
    op.create_index('ix_sites_trial_ends_at', 'sites', ['trial_ends_at'])
    op.create_table('site_trials',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', sa.String(64), nullable=False),
        sa.Column('plan_id', sa.String(64), nullable=False),
        sa.Column('site_id', UUID(as_uuid=True), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        # Set when the trial site first became usable. A trial whose site never got that far is given back.
        sa.Column('activated_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('user_id', 'plan_id'))
    op.create_index('ix_site_trials_user_id', 'site_trials', ['user_id'])


def downgrade():
    op.drop_table('site_trials')
    op.drop_index('ix_sites_trial_ends_at', 'sites')
    op.drop_column('sites', 'trial_warned')
    op.drop_column('sites', 'trial_expired_at')
    op.drop_column('sites', 'trial_ends_at')
