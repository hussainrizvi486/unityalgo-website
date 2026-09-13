from flask import Blueprint

from app.controller.dashboard import DashboardController
from app.serializers import ActivityLogSerializer, OperationSerializer
from app.status_codes import HTTP_200_OK

from .base import BaseView


class DashboardSummaryView(BaseView):
    """/api/v1/dashboard/summary -- fleet counts, billing, recent activity."""

    controller_class = DashboardController

    def get(self):
        with self.session() as session:
            summary = self.controller(session).summary()
            body = {
                **summary,
                "recent_operations": OperationSerializer.dump_many(
                    summary["recent_operations"]
                ),
                "recent_logs": ActivityLogSerializer.dump_many(summary["recent_logs"]),
            }
        return self.ok(body, HTTP_200_OK)


class DashboardRoutes:
    url_prefix = "/api/v1/dashboard"

    @classmethod
    def blueprint(cls, db=None, config=None):
        bp = Blueprint("dashboard", __name__, url_prefix=cls.url_prefix)
        bp.add_url_rule(
            "/summary",
            view_func=DashboardSummaryView.as_view("summary", db=db, config=config),
            methods=["GET"],
        )
        return bp
