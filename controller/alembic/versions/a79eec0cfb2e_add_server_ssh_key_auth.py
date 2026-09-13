"""add server_nodes ssh key auth

Revision ID: a79eec0cfb2e
Revises: a1c9d47e6b32
Create Date: 2026-08-18

ssh_key_encrypted: Fernet ciphertext of a pasted private key, same encryption
as DatabaseConnection.password_encrypted. Decrypted in-memory per SSH
connection, never written to disk on the controller.

ssh_auth_method: explicit choice between ssh_password and ssh_key_encrypted,
rather than inferring from which column happens to be non-null -- lets the
edit UI unambiguously clear the other credential when switching methods.
Backfilled from the old implicit "password wins if present" reading so
already-registered nodes keep behaving the same way.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a79eec0cfb2e"
down_revision: Union[str, Sequence[str], None] = "a1c9d47e6b32"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "server_nodes", sa.Column("ssh_key_encrypted", sa.Text(), nullable=True)
    )
    op.add_column(
        "server_nodes",
        sa.Column(
            "ssh_auth_method",
            sa.String(length=20),
            nullable=False,
            server_default="password",
        ),
    )
    op.execute(
        "UPDATE server_nodes SET ssh_auth_method = 'key' "
        "WHERE ssh_password IS NULL AND ssh_key_path IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column("server_nodes", "ssh_auth_method")
    op.drop_column("server_nodes", "ssh_key_encrypted")
