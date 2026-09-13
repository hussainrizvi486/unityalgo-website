"""Encrypt the three credentials still held in plaintext.

`tenants.db_password`, `tenants.jwt_secret` and `server_nodes.ssh_password`
were the last secrets stored in the clear, protected only by the API serializer
omitting them from responses. Anyone with a database dump had them. They now
hold Fernet ciphertext, keyed by ENCRYPTION_KEY, which is the same protection
`database_connections.password_encrypted` and `server_nodes.ssh_key_encrypted`
already had.

The columns keep their names. `EncryptedString` (app/models/types.py) encrypts
on write and decrypts on read, so the dozen places that read `tenant.db_password`
are unchanged -- a much smaller and safer change than rewriting each call site.

Widened to TEXT first: a Fernet token for a 43-character token_urlsafe(32)
password is around 180 characters, and String(255) leaves no room for a longer
value or a future key rotation format.

This migration reads ENCRYPTION_KEY and fails loudly without it, which is
correct -- silently leaving credentials in plaintext is the outcome worth
avoiding. Downgrade decrypts back, so it is reversible while the key is held.

Revision ID: a3f7b1c8d204
Revises: f1c8a2d5e930
"""

import sqlalchemy as sa
from alembic import op

from app.services import crypto

revision = "a3f7b1c8d204"
down_revision = "f1c8a2d5e930"
branch_labels = None
depends_on = None

# (table, column, nullable)
TARGETS = (
    ("tenants", "db_password", False),
    ("tenants", "jwt_secret", False),
    ("server_nodes", "ssh_password", True),
)


def _rewrite(connection, table, column, transform):
    """Apply `transform` to every non-null value in one column.

    Row by row rather than a single UPDATE: the transform is Fernet, which has
    no SQL equivalent, and these tables hold tens of rows, not millions.
    """
    rows = connection.execute(
        sa.text(f'SELECT id, "{column}" FROM {table} WHERE "{column}" IS NOT NULL')
    ).fetchall()
    for row_id, value in rows:
        connection.execute(
            sa.text(f'UPDATE {table} SET "{column}" = :v WHERE id = :id'),
            {"v": transform(value), "id": row_id},
        )
    return len(rows)


def upgrade():
    connection = op.get_bind()
    for table, column, nullable in TARGETS:
        # Widen before writing: ciphertext does not fit the old String(255).
        op.alter_column(
            table, column,
            existing_type=sa.String(length=255),
            type_=sa.Text(),
            existing_nullable=nullable,
        )
        _rewrite(connection, table, column, crypto.encrypt)


def downgrade():
    connection = op.get_bind()
    for table, column, nullable in TARGETS:
        _rewrite(connection, table, column, crypto.decrypt)
        op.alter_column(
            table, column,
            existing_type=sa.Text(),
            type_=sa.String(length=255),
            existing_nullable=nullable,
        )
