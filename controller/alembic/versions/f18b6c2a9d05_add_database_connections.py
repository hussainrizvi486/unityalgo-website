"""add database_connections table

Revision ID: f18b6c2a9d05
Revises: d3f9a21c7e64
Create Date: 2026-08-15

Registered PostgreSQL connections an operator can test and run ad-hoc SQL
against from the admin panel. Standalone (no FK to tenants/servers) -- meant
to point at arbitrary Postgres instances, not just infrastructure this
controller already manages. password_encrypted holds Fernet ciphertext, never
a plaintext password (see app/services/crypto.py).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "f18b6c2a9d05"
down_revision: Union[str, Sequence[str], None] = "d3f9a21c7e64"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "database_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("host", sa.String(length=255), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False, server_default="5432"),
        sa.Column("database_name", sa.String(length=255), nullable=False),
        sa.Column("username", sa.String(length=255), nullable=False),
        sa.Column("password_encrypted", sa.Text(), nullable=False),
        sa.Column("sslmode", sa.String(length=20), nullable=False, server_default="prefer"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_test_status", sa.String(length=20), nullable=True),
        sa.Column("last_test_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("name", name="uq_database_connections_name"),
    )


def downgrade() -> None:
    op.drop_table("database_connections")
