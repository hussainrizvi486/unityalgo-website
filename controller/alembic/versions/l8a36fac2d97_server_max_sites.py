"""Servers: a maximum number of customer (Frappe) sites each may host."""
from alembic import op
import sqlalchemy as sa

revision = 'l8a36fac2d97'
down_revision = 'k7f25e9b1c86'
branch_labels = None
depends_on = None

def upgrade():
    # NULL means no limit; 0 stops new sites landing on the server without taking it out of service.
    op.add_column('server_nodes', sa.Column('max_sites', sa.Integer(), nullable=True))

def downgrade():
    op.drop_column('server_nodes', 'max_sites')
