"""Read-only access to the activity log and grouped operations."""

from sqlalchemy import func, or_, select

from app.controller.base import BaseController
from app.errors import NotFoundError
from app.models.activity import CATEGORIES, STATUSES, ActivityLog, Operation


class LogController(BaseController):
    """Queries for the centralized Logs page and operation timelines."""

    model = ActivityLog
    resource_name = "log"
    CATEGORIES = CATEGORIES
    STATUSES = STATUSES

    # Read-only: log rows are written by ActivityLogger, never by the API.
    writable_fields = ()

    def clean(self, data, partial):  # pragma: no cover - never written via API
        raise NotImplementedError("Activity logs are append-only")

    # ------------------------------------------------------------------
    def list(self, category=None, status=None, tenant_id=None, server_id=None,
             customer_id=None, billing_record_id=None, operation_id=None,
             search=None, limit=100, offset=0):
        stmt = select(ActivityLog)
        v = self.validator

        if category:
            stmt = stmt.where(
                ActivityLog.category == v.choice(category, "category", self.CATEGORIES)
            )
        if status:
            stmt = stmt.where(
                ActivityLog.status == v.choice(status, "status", self.STATUSES)
            )
        if tenant_id:
            stmt = stmt.where(ActivityLog.tenant_id == v.uuid(tenant_id, "tenant_id"))
        if server_id:
            stmt = stmt.where(ActivityLog.server_id == v.uuid(server_id, "server_id"))
        if customer_id:
            stmt = stmt.where(
                ActivityLog.customer_id == v.uuid(customer_id, "customer_id")
            )
        if billing_record_id:
            stmt = stmt.where(
                ActivityLog.billing_record_id
                == v.uuid(billing_record_id, "billing_record_id")
            )
        if operation_id:
            stmt = stmt.where(
                ActivityLog.operation_id == v.uuid(operation_id, "operation_id")
            )
        if search:
            like = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    ActivityLog.step_name.ilike(like),
                    ActivityLog.message.ilike(like),
                    ActivityLog.action.ilike(like),
                    ActivityLog.error_message.ilike(like),
                    ActivityLog.tenant_slug.ilike(like),
                    ActivityLog.server_name.ilike(like),
                    ActivityLog.customer_name.ilike(like),
                )
            )

        total = self.session.scalar(select(func.count()).select_from(stmt.subquery()))
        rows = self.session.scalars(
            stmt.order_by(ActivityLog.created_at.desc(), ActivityLog.step_index.desc())
            .limit(limit)
            .offset(offset)
        ).all()
        return rows, total

    # ------------------------------------------------------------------
    def list_operations(self, kind=None, category=None, status=None, tenant_id=None,
                        server_id=None, customer_id=None, search=None,
                        limit=50, offset=0):
        stmt = select(Operation)
        v = self.validator

        if kind:
            stmt = stmt.where(Operation.kind == kind)
        if category:
            stmt = stmt.where(
                Operation.category == v.choice(category, "category", self.CATEGORIES)
            )
        if status:
            stmt = stmt.where(
                Operation.status == v.choice(status, "status", self.STATUSES)
            )
        if tenant_id:
            stmt = stmt.where(Operation.tenant_id == v.uuid(tenant_id, "tenant_id"))
        if server_id:
            stmt = stmt.where(Operation.server_id == v.uuid(server_id, "server_id"))
        if customer_id:
            stmt = stmt.where(Operation.customer_id == v.uuid(customer_id, "customer_id"))
        if search:
            like = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Operation.label.ilike(like),
                    Operation.kind.ilike(like),
                    Operation.tenant_slug.ilike(like),
                    Operation.server_name.ilike(like),
                )
            )

        total = self.session.scalar(select(func.count()).select_from(stmt.subquery()))
        rows = self.session.scalars(
            stmt.order_by(Operation.started_at.desc()).limit(limit).offset(offset)
        ).all()
        return rows, total

    def get_operation(self, operation_id):
        operation_id = self.validator.uuid(operation_id, "operation_id")
        operation = self.session.get(Operation, operation_id)
        if operation is None:
            raise NotFoundError(f"Operation '{operation_id}' not found")
        return operation

    def operation_steps(self, operation_id):
        """The ordered timeline for one operation."""
        operation_id = self.validator.uuid(operation_id, "operation_id")
        return self.session.scalars(
            select(ActivityLog)
            .where(ActivityLog.operation_id == operation_id)
            .order_by(ActivityLog.step_index.asc(), ActivityLog.created_at.asc())
        ).all()

    # ------------------------------------------------------------------
    def counts_by_status(self):
        return dict(
            self.session.execute(
                select(ActivityLog.status, func.count()).group_by(ActivityLog.status)
            ).all()
        )

    def counts_by_category(self):
        return dict(
            self.session.execute(
                select(ActivityLog.category, func.count()).group_by(ActivityLog.category)
            ).all()
        )

    def recent_operations(self, limit=10):
        return self.session.scalars(
            select(Operation).order_by(Operation.started_at.desc()).limit(limit)
        ).all()

    def recent(self, limit=10):
        return self.session.scalars(
            select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit)
        ).all()
