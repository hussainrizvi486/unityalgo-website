"""add ssh_password to server_nodes

Revision ID: 2b7c4e91d3a0
Revises: 1a9aa42edf5d
Create Date: 2026-08-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2b7c4e91d3a0"
down_revision: Union[str, Sequence[str], None] = "1a9aa42edf5d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "server_nodes",
        sa.Column("ssh_password", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("server_nodes", "ssh_password")
