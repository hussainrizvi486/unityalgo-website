"""add billing_records, operations, activity_logs; drop provisioning_logs

Revision ID: 9c4e18b7a250
Revises: 7f3a2c9d1e60
Create Date: 2026-08-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "9c4e18b7a250"
down_revision: Union[str, Sequence[str], None] = "7f3a2c9d1e60"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- billing_records ----------------------------------------------
    op.create_table(
        "billing_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # SET NULL: deleting a storefront must never destroy billing history.
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("invoice_number", sa.String(length=50), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column("issued_at", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("paid_at", sa.Date(), nullable=True),
        sa.Column("payment_method", sa.String(length=50), nullable=True),
        sa.Column("payment_reference", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("invoice_number"),
    )
    op.create_index(
        "ix_billing_records_customer_id", "billing_records", ["customer_id"]
    )
    op.create_index("ix_billing_records_tenant_id", "billing_records", ["tenant_id"])
    op.create_index("ix_billing_records_status", "billing_records", ["status"])

    # -- operations -----------------------------------------------------
    # No FKs to tenants/servers/customers on purpose: these rows are written
    # from an autonomous session (so failure logs survive a rollback) and must
    # outlive the subject they describe.
    op.create_table(
        "operations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("kind", sa.String(length=50), nullable=False),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column(
            "status", sa.String(length=20), nullable=False, server_default="in_progress"
        ),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("server_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("billing_record_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("tenant_slug", sa.String(length=63), nullable=True),
        sa.Column("server_name", sa.String(length=100), nullable=True),
        sa.Column("customer_name", sa.String(length=255), nullable=True),
        sa.Column("actor", sa.String(length=100), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("step_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_operations_kind", "operations", ["kind"])
    op.create_index("ix_operations_category", "operations", ["category"])
    op.create_index("ix_operations_status", "operations", ["status"])
    op.create_index("ix_operations_created_at", "operations", ["created_at"])
    op.create_index("ix_operations_tenant_id", "operations", ["tenant_id"])
    op.create_index("ix_operations_server_id", "operations", ["server_id"])
    op.create_index("ix_operations_customer_id", "operations", ["customer_id"])

    # -- activity_logs ----------------------------------------------------
    op.create_table(
        "activity_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("operation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("step_name", sa.String(length=150), nullable=False),
        sa.Column("step_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("server_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("billing_record_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("tenant_slug", sa.String(length=63), nullable=True),
        sa.Column("server_name", sa.String(length=100), nullable=True),
        sa.Column("customer_name", sa.String(length=255), nullable=True),
        sa.Column("actor", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_activity_logs_operation_id", "activity_logs", ["operation_id"])
    op.create_index("ix_activity_logs_category", "activity_logs", ["category"])
    op.create_index("ix_activity_logs_status", "activity_logs", ["status"])
    op.create_index("ix_activity_logs_created_at", "activity_logs", ["created_at"])
    op.create_index("ix_activity_logs_tenant_id", "activity_logs", ["tenant_id"])
    op.create_index("ix_activity_logs_server_id", "activity_logs", ["server_id"])
    op.create_index("ix_activity_logs_customer_id", "activity_logs", ["customer_id"])
    op.create_index(
        "ix_activity_logs_billing_record_id", "activity_logs", ["billing_record_id"]
    )

    # -- retire provisioning_logs -------------------------------------
    # Superseded by activity_logs, which carries the same data plus operation
    # grouping, structured details and per-step timing.
    op.drop_table("provisioning_logs")


def downgrade() -> None:
    op.create_table(
        "provisioning_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("step_name", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.drop_table("activity_logs")
    op.drop_table("operations")
    op.drop_table("billing_records")
