from flask import Blueprint

from app.controller.log import LogController
from app.serializers import ActivityLogSerializer, OperationSerializer
from app.status_codes import HTTP_200_OK

from .base import BaseView


class LogBaseView(BaseView):
    controller_class = LogController
    serializer_class = ActivityLogSerializer


class LogListView(LogBaseView):
    """/api/v1/logs -- flat activity feed."""

    def get(self):
        """?category=&status=&tenant_id=&server_id=&customer_id=&operation_id=&q="""
        limit, offset = self.pagination()
        with self.session() as session:
            rows, total = self.controller(session).list(
                category=self.str_arg("category"),
                status=self.str_arg("status"),
                tenant_id=self.str_arg("tenant_id"),
                server_id=self.str_arg("server_id"),
                customer_id=self.str_arg("customer_id"),
                billing_record_id=self.str_arg("billing_record_id"),
                operation_id=self.str_arg("operation_id"),
                search=self.str_arg("q"),
                limit=limit,
                offset=offset,
            )
            body = self.page(self.dump_many(rows), total, limit, offset)
        return self.ok(body, HTTP_200_OK)


class OperationListView(LogBaseView):
    """/api/v1/logs/operations -- grouped processes."""

    def get(self):
        limit, offset = self.pagination()
        with self.session() as session:
            rows, total = self.controller(session).list_operations(
                kind=self.str_arg("kind"),
                category=self.str_arg("category"),
                status=self.str_arg("status"),
                tenant_id=self.str_arg("tenant_id"),
                server_id=self.str_arg("server_id"),
                customer_id=self.str_arg("customer_id"),
                search=self.str_arg("q"),
                limit=limit,
                offset=offset,
            )
            body = self.page(
                OperationSerializer.dump_many(rows), total, limit, offset
            )
        return self.ok(body, HTTP_200_OK)


class OperationDetailView(LogBaseView):
    """/api/v1/logs/operations/<id> -- operation plus its ordered steps."""

    def get(self, operation_id):
        with self.session() as session:
            ctrl = self.controller(session)
            operation = ctrl.get_operation(operation_id)
            steps = ctrl.operation_steps(operation_id)
            body = OperationSerializer.dump(operation, steps=steps)
        return self.ok(body, HTTP_200_OK)


class LogRoutes:
    url_prefix = "/api/v1/logs"

    @classmethod
    def blueprint(cls, db=None, config=None):
        bp = Blueprint("logs", __name__, url_prefix=cls.url_prefix)
        bp.add_url_rule(
            "", view_func=LogListView.as_view("collection", db=db, config=config)
        )
        bp.add_url_rule(
            "/operations",
            view_func=OperationListView.as_view("operations", db=db, config=config),
        )
        bp.add_url_rule(
            "/operations/<operation_id>",
            view_func=OperationDetailView.as_view(
                "operation_detail", db=db, config=config
            ),
        )
        return bp
