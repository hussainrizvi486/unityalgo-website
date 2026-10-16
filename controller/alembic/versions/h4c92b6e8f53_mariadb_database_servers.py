"""MariaDB database servers for Frappe sites.

database_connections gains an `engine`, so MariaDB servers register next to the
PostgreSQL ones. The "one default" rule becomes one default *per engine*, and a
site can record which server holds its database (NULL = the MariaDB container
bundled with the site, as before).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'h4c92b6e8f53'
down_revision = 'g3b81a5d7e42'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('database_connections', sa.Column('engine', sa.String(20), nullable=False, server_default='postgres'))
    op.drop_index('database_connections_single_default_idx', table_name='database_connections')
    op.create_index('database_connections_single_default_idx', 'database_connections', ['engine'],
                    unique=True, postgresql_where=sa.text('is_default = true'))
    op.add_column('sites', sa.Column('db_server_id', UUID(as_uuid=True), nullable=True))
    # RESTRICT: detaching a site from the server its data lives on would point it nowhere.
    op.create_foreign_key('sites_db_server_id_fkey', 'sites', 'database_connections', ['db_server_id'], ['id'], ondelete='RESTRICT')
    op.create_index('ix_sites_db_server_id', 'sites', ['db_server_id'])


def downgrade():
    op.drop_index('ix_sites_db_server_id', table_name='sites')
    op.drop_constraint('sites_db_server_id_fkey', 'sites', type_='foreignkey')
    op.drop_column('sites', 'db_server_id')
    op.drop_index('database_connections_single_default_idx', table_name='database_connections')
    op.create_index('database_connections_single_default_idx', 'database_connections', ['is_default'],
                    unique=True, postgresql_where=sa.text('is_default = true'))
    op.drop_column('database_connections', 'engine')
