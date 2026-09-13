"""Flask application assembly: blueprints, error handlers, configuration."""

from flask import Flask, jsonify
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from werkzeug.exceptions import HTTPException

from .api_auth import register_api_auth
from .config import settings
from .db import database
from .errors import ApiError
from .routes import ALL_ROUTES
from .status_codes import HTTP_500_INTERNAL_SERVER_ERROR, HTTP_503_SERVICE_UNAVAILABLE


class ApiRouter:
    def __init__(self, config=None, db=None):
        self.settings = config or settings
        self.db = db or database
        self.app = Flask(
            self.settings.app_name,
            static_folder=str(self.settings.base_dir / "app" / "static"),
        )
        self.settings.assert_api_key_configured()
        self.configure()
        self.register_routes()
        register_api_auth(self.app, self.settings.controller_internal_api_key)
        self.register_error_handlers()

    def configure(self):
        # No session cookie config: this service has no login and issues no
        # cookies. SECRET_KEY is kept only because Flask requires one for
        # its own internals (e.g. flashing, itsdangerous helpers).
        self.app.config.update(
            SECRET_KEY=self.settings.secret_key,
            JSON_SORT_KEYS=False,
            ENV=self.settings.app_env,
        )
        # Treat /api/v1/servers and /api/v1/servers/ as the same route instead
        # of 308-redirecting API clients.
        self.app.url_map.strict_slashes = False

    def register_routes(self):
        for routes in ALL_ROUTES:
            self.app.register_blueprint(
                routes.blueprint(db=self.db, config=self.settings)
            )

    def register_error_handlers(self):
        app = self.app

        @app.errorhandler(ApiError)
        def handle_api_error(error):
            return jsonify(error.to_dict()), error.status_code

        @app.errorhandler(HTTPException)
        def handle_http_error(error):
            return jsonify({"error": error.description}), error.code

        @app.errorhandler(SQLAlchemyError)
        def handle_database_error(error):
            app.logger.exception("database error")
            if isinstance(error, OperationalError):
                return (
                    jsonify({"error": "Database unavailable"}),
                    HTTP_503_SERVICE_UNAVAILABLE,
                )
            return jsonify({"error": "Database error"}), HTTP_500_INTERNAL_SERVER_ERROR

    def run(self, host=None, port=None, debug=None):
        self.app.run(
            host=host or self.settings.app_host,
            port=port or self.settings.app_port,
            debug=self.settings.app_debug if debug is None else debug,
        )

    def routes(self):
        """(methods, rule, endpoint) for every registered route."""
        listing = []
        for rule in self.app.url_map.iter_rules():
            methods = sorted(
                m for m in rule.methods if m not in ("HEAD", "OPTIONS")
            )
            listing.append((",".join(methods), str(rule), rule.endpoint))
        return sorted(listing, key=lambda row: row[1])

    def __repr__(self):
        return f"<ApiRouter {self.settings.app_name} routes={len(self.app.url_map._rules)}>"


def create_app(config=None, db=None):
    """WSGI entrypoint: `gunicorn 'app.router:create_app()'`"""
    return ApiRouter(config=config, db=db).app


# Module-level instance so `from app.router import api_router` keeps working.
api_router = ApiRouter()
