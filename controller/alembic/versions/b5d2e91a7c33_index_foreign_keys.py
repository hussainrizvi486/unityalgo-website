"""Index the controller's unindexed foreign keys.

Postgres never indexes a foreign key for you. Nine of the controller's were
bare, and these are the tables that actually grow: every backup, migration and
deployment accumulates for the life of the fleet.

The cost is worst on the parent side. Retiring a worker node scanned
`tenants`, `tenant_backups` and `tenant_migrations` in full — twice for the
last, since it references server_nodes as both source and destination.
Deleting a database connection scanned `tenant_db_migrations` twice for the
same reason.

Revision ID: b5d2e91a7c33
Revises: a3f7b1c8d204
"""

from alembic import op

revision = "b5d2e91a7c33"
down_revision = "a3f7b1c8d204"
branch_labels = None
depends_on = None

# (index name, table, column)
INDEXES = (
    ("ix_tenant_backups_node_id", "tenant_backups", "node_id"),
    ("ix_tenant_backups_tenant_id", "tenant_backups", "tenant_id"),
    ("ix_tenant_db_migrations_from_connection_id", "tenant_db_migrations", "from_connection_id"),
    ("ix_tenant_db_migrations_to_connection_id", "tenant_db_migrations", "to_connection_id"),
    ("ix_tenant_migrations_backup_id", "tenant_migrations", "backup_id"),
    ("ix_tenant_migrations_from_node_id", "tenant_migrations", "from_node_id"),
    ("ix_tenant_migrations_tenant_id", "tenant_migrations", "tenant_id"),
    ("ix_tenant_migrations_to_node_id", "tenant_migrations", "to_node_id"),
    ("ix_tenants_node_id", "tenants", "node_id"),
)


def upgrade():
    for name, table, column in INDEXES:
        op.create_index(name, table, [column])


def downgrade():
    for name, table, _ in reversed(INDEXES):
        op.drop_index(name, table_name=table)
