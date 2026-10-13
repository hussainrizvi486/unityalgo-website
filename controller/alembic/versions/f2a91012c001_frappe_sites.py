"""Frappe sites and explicit Frappe-capable workers."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision = 'f2a91012c001'
down_revision = 'b5d2e91a7c33'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('server_nodes', sa.Column('frappe_enabled', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table('sites',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('User.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('request_key', sa.String(36), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('slug', sa.String(48), nullable=False, unique=True),
        sa.Column('domain', sa.String(255), nullable=False, unique=True),
        sa.Column('server_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('server_nodes.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('port', sa.Integer(), nullable=False),
        sa.Column('memory_limit_mb', sa.Integer(), nullable=False, server_default='6144'),
        sa.Column('container_slots', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('image', sa.String(255), nullable=False),
        sa.Column('app_names', postgresql.JSONB(), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='queued'),
        sa.Column('progress', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('admin_password', sa.Text(), nullable=False),
        sa.Column('db_password', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('user_id','request_key'), sa.UniqueConstraint('server_id','port'))
    for column in ('user_id','server_id','status'):
        op.create_index('ix_sites_' + column, 'sites', [column])

def downgrade():
    op.drop_table('sites')
    op.drop_column('server_nodes', 'frappe_enabled')
