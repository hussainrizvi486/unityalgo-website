from flask import Blueprint

from app.controller.database_connection import DatabaseConnectionController
from app.errors import ValidationError
from app.serializers import DatabaseConnectionSerializer
from app.status_codes import HTTP_200_OK, HTTP_201_CREATED

from .base import BaseView


class DatabaseConnectionBaseView(BaseView):
    controller_class = DatabaseConnectionController
    serializer_class = DatabaseConnectionSerializer


class DatabaseConnectionListView(DatabaseConnectionBaseView):
    """/api/v1/database-connections -- collection."""

    def get(self):
        limit, offset = self.pagination()
        with self.session() as session:
            rows, total = self.controller(session).list(limit=limit, offset=offset)
            body = self.page(self.dump_many(rows), total, limit, offset)
        return self.ok(body, HTTP_200_OK)

    def post(self):
        payload = self.json_body()
        with self.session() as session:
            body = self.dump(self.controller(session).create(payload))
        return self.ok(body, HTTP_201_CREATED)


class DatabaseConnectionDetailView(DatabaseConnectionBaseView):
    """/api/v1/database-connections/<id>."""

    def get(self, connection_id):
        with self.session() as session:
            body = self.dump(self.controller(session).get(connection_id))
        return self.ok(body, HTTP_200_OK)

    def patch(self, connection_id):
        payload = self.json_body()
        with self.session() as session:
            body = self.dump(self.controller(session).update(connection_id, payload))
        return self.ok(body, HTTP_200_OK)

    put = patch

    def delete(self, connection_id):
        with self.session() as session:
            self.controller(session).delete(connection_id)
        return self.no_content()


class DatabaseConnectionTestAdhocView(DatabaseConnectionBaseView):

    def post(self):
        payload = self.json_body()
        if not isinstance(payload, dict):
            raise ValidationError("Request body must be a JSON object")
        with self.session() as session:
            version = self.controller(session).test_adhoc(payload)
        return self.ok({"status": "success", "version": version}, HTTP_200_OK)


class DatabaseConnectionTestSavedView(DatabaseConnectionBaseView):
    """POST /api/v1/database-connections/<id>/test -- re-test a saved connection."""

    def post(self, connection_id):
        with self.session() as session:
            version = self.controller(session).test_saved(connection_id)
        return self.ok({"status": "success", "version": version}, HTTP_200_OK)


class DatabaseConnectionQueryView(DatabaseConnectionBaseView):

    def post(self, connection_id):
        payload = self.json_body()
        if not isinstance(payload, dict) or not payload.get("sql"):
            raise ValidationError("'sql' is required", field="sql")
        with self.session() as session:
            result = self.controller(session).execute_query(connection_id, payload["sql"])
        return self.ok(result, HTTP_200_OK)


class DatabaseConnectionSchemaView(DatabaseConnectionBaseView):

    def get(self, connection_id):
        with self.session() as session:
            result = self.controller(session).introspect(connection_id)
        return self.ok(result, HTTP_200_OK)


class DatabaseConnectionRoutes:
    url_prefix = "/api/v1/database-connections"

    @classmethod
    def blueprint(cls, db=None, config=None):
        bp = Blueprint("database_connections", __name__, url_prefix=cls.url_prefix)
        kw = {"db": db, "config": config}
        bp.add_url_rule(
            "", view_func=DatabaseConnectionListView.as_view("collection", **kw)
        )
        bp.add_url_rule(
            "/test",
            view_func=DatabaseConnectionTestAdhocView.as_view("test_adhoc", **kw),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<connection_id>",
            view_func=DatabaseConnectionDetailView.as_view("detail", **kw),
        )
        bp.add_url_rule(
            "/<connection_id>/test",
            view_func=DatabaseConnectionTestSavedView.as_view("test_saved", **kw),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<connection_id>/query",
            view_func=DatabaseConnectionQueryView.as_view("query", **kw),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<connection_id>/schema",
            view_func=DatabaseConnectionSchemaView.as_view("schema", **kw),
            methods=["GET"],
        )
        return bp
