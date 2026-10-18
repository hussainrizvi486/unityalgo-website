
from decimal import Decimal

from sqlalchemy import func, select

from app.config import settings as default_settings
from app.controller.log import LogController
from app.models.platform import PlatformBillingRecord, PlatformUser
from app.models.server import ServerNode, Tenant


class DashboardController:
    def __init__(self, session, config=None, actor=None):
        self.session = session
        self.settings = config or default_settings
        self.actor = actor

    def summary(self):
        session = self.session

        server_count = session.scalar(select(func.count()).select_from(ServerNode))
        active_servers = session.scalar(
            select(func.count())
            .select_from(ServerNode)
            .where(ServerNode.is_active.is_(True))
        )
        tenant_count = session.scalar(select(func.count()).select_from(Tenant))
        tenant_by_status = dict(
            session.execute(
                select(Tenant.status, func.count()).group_by(Tenant.status)
            ).all()
        )
        customer_count = session.scalar(
            select(func.count())
            .select_from(PlatformUser)
            .where(PlatformUser.role == "CUSTOMER")
        )

        outstanding = session.scalar(
            select(func.coalesce(func.sum(PlatformBillingRecord.amount), 0)).where(
                PlatformBillingRecord.status.in_(("PENDING", "OVERDUE"))
            )
        ) or Decimal("0")

        logs = LogController(session, self.settings)
        recent_operations = logs.recent_operations(limit=8)
        recent_logs = logs.recent(limit=10)

        return {
            "server_count": server_count,
            "active_servers": active_servers,
            "tenant_count": tenant_count,
            "tenant_by_status": tenant_by_status,
            "customer_count": customer_count,
            "outstanding_balance": float(outstanding),
            "recent_operations": recent_operations,
            "recent_logs": recent_logs,
        }
