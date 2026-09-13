"""Gate the query console's write access per connection.

The console runs whatever SQL it is given -- that is the point of it -- but
running an UPDATE against a production cluster should be a deliberate act, not
a side effect of having the page open. `allow_writes` defaults to false, and a
connection stays read-only until an admin opts it in.

Enforcement is a Postgres READ ONLY transaction rather than inspecting the SQL:
the engine rejects the write itself, so `WITH ... DELETE`, `SELECT ... INTO`
and anything else that a keyword check would miss is covered too.

Revision ID: f1c8a2d5e930
Revises: e7b41dc9f083
"""

import sqlalchemy as sa
from alembic import op

revision = "f1c8a2d5e930"
down_revision = "e7b41dc9f083"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "database_connections",
        sa.Column(
            "allow_writes",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade():
    op.drop_column("database_connections", "allow_writes")
