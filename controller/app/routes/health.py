from flask import Blueprint

from app.status_codes import HTTP_200_OK, HTTP_503_SERVICE_UNAVAILABLE

from .base import BaseView


class PingView(BaseView):
    """Liveness -- answers without touching the database."""

    def get(self):
        return self.ok({"message": "working"}, HTTP_200_OK)


class HealthView(BaseView):
    """Readiness -- reports whether Postgres is reachable."""

    def get(self):
        db_ok = self.db.check_connection()
        body = {
            "status": "ok" if db_ok else "degraded",
            "app": self.settings.app_name,
            "environment": self.settings.app_env,
            "database": "up" if db_ok else "down",
        }
        return self.ok(body, HTTP_200_OK if db_ok else HTTP_503_SERVICE_UNAVAILABLE)


class HealthRoutes:
    @classmethod
    def blueprint(cls, db=None, config=None):
        bp = Blueprint("health", __name__)
        bp.add_url_rule("/ping", view_func=PingView.as_view("ping", db=db, config=config))
        bp.add_url_rule(
            "/health", view_func=HealthView.as_view("health", db=db, config=config)
        )
        return bp
