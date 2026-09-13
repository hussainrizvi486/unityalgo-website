"""add server_nodes.proxy_admin_port

Revision ID: a1c9d47e6b32
Revises: f18b6c2a9d05
Create Date: 2026-08-15

Caddy's admin API port on a role='proxy' node, reached over an SSH tunnel
(Paramiko direct-tcpip), never exposed publicly. Nullable -- NULL means the
settings default (PROXY_ADMIN_PORT_DEFAULT, Caddy's own default of 2019)
applies, so no backfill is needed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1c9d47e6b32"
down_revision: Union[str, Sequence[str], None] = "f18b6c2a9d05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "server_nodes", sa.Column("proxy_admin_port", sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("server_nodes", "proxy_admin_port")
