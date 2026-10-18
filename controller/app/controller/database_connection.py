"""CRUD + test/query actions for registered PostgreSQL connections."""

from datetime import datetime, timezone

from app.controller.base import BaseController
from app.errors import DatabaseUnreachableError
from app.models.database_connection import DatabaseConnection
from app.services import crypto
from app.services.database_connection_service import DatabaseConnectionService


from sqlalchemy import func, select
from app.errors import ConflictError, ValidationError
from app.models.server import Tenant
from app.models.site import Site

class DatabaseConnectionController(BaseController):
    model = DatabaseConnection
    resource_name = "database connection"
    SSL_MODES = DatabaseConnection.SSL_MODES

    writable_fields = (
        "engine",
        "name",
        "host",
        "port",
        "database_name",
        "username",
        "password",
        "sslmode",
        "notes",
        "role",
        "host_from_worker",
        "is_default",
        "allow_writes",
    )
    required_on_create = ("name", "host", "database_name", "username", "password")

    def __init__(self, session, config=None, actor=None):
        super().__init__(session, config, actor)
        self.service = DatabaseConnectionService()

    def clean(self, data, partial):
        self.check_payload(data, partial)
        v = self.validator
        values = {}

        if "engine" in data:
            values["engine"] = v.choice(data["engine"], "engine", DatabaseConnection.ENGINES)
        if "name" in data:
            values["name"] = v.string(data["name"], "name", max_length=255)
        if "host" in data:
            values["host"] = v.string(data["host"], "host", max_length=255)
        if "port" in data:
            values["port"] = v.integer(data["port"], "port", minimum=1, maximum=65535)
        if "database_name" in data:
            values["database_name"] = v.string(
                data["database_name"], "database_name", max_length=255
            )
        if "username" in data:
            values["username"] = v.string(data["username"], "username", max_length=255)
        if data.get("password"):
            values["password_encrypted"] = crypto.encrypt(
                v.string(data["password"], "password", max_length=255), self.settings
            )
        if "sslmode" in data:
            values["sslmode"] = v.choice(data["sslmode"], "sslmode", self.SSL_MODES)
        if "role" in data:
            values["role"] = v.choice(data["role"], "role", DatabaseConnection.ROLES)
        if "host_from_worker" in data:
            values["host_from_worker"] = (
                None
                if not data["host_from_worker"]
                else v.string(data["host_from_worker"], "host_from_worker", max_length=255)
            )
        if "is_default" in data:
            values["is_default"] = bool(data["is_default"])
        if "allow_writes" in data:
            values["allow_writes"] = bool(data["allow_writes"])
        if "notes" in data:
            values["notes"] = (
                None if data["notes"] is None else v.string(data["notes"], "notes", allow_empty=True)
            )
        return values

    @staticmethod
    def _engine_defaults(values):
        mariadb = values.get("engine") == "mariadb"
        values.setdefault("port", 3306 if mariadb else 5432)
        values.setdefault("sslmode", "disable" if mariadb else "prefer")
        return values

    def conflict_message(self, values):
        return "A database connection with that name already exists"

    # ------------------------------------------------------------------
    def list(self, limit=50, offset=0):
        return self.paginate(self.base_query(), limit, offset)

    def _record_test_result(self, connection_id, status, message):
        from app.db import database

        with database.session() as autonomous_session:
            connection = autonomous_session.get(DatabaseConnection, connection_id)
            if connection is None:
                return
            connection.last_tested_at = datetime.now(timezone.utc)
            connection.last_test_status = status
            connection.last_test_message = message

    def test_saved(self, connection_id):
        """Re-test an already-registered connection."""
        connection = self.get(connection_id)
        password = crypto.decrypt(connection.password_encrypted, self.settings)
        try:
            version = self.service.test(
                connection.engine, connection.host, connection.port, connection.database_name,
                connection.username, password, connection.sslmode,
            )
        except DatabaseUnreachableError as exc:
            self._record_test_result(connection.id, "failed", str(exc))
            raise
        self._record_test_result(connection.id, "success", version)
        return version

    def test_adhoc(self, data):
        """Test connection params before the row even exists yet."""
        v = self.validator
        engine = v.choice(data.get("engine", "postgres"), "engine", DatabaseConnection.ENGINES)
        host = v.string(data.get("host"), "host", max_length=255)
        port = v.integer(data.get("port", 3306 if engine == "mariadb" else 5432), "port", minimum=1, maximum=65535)
        database_name = v.string(data.get("database_name"), "database_name", max_length=255)
        username = v.string(data.get("username"), "username", max_length=255)
        password = v.string(data.get("password"), "password", max_length=255)
        sslmode = v.choice(data.get("sslmode", "disable" if engine == "mariadb" else "prefer"), "sslmode", self.SSL_MODES)
        return self.service.test(engine, host, port, database_name, username, password, sslmode)

    def execute_query(self, connection_id, sql):
        connection = self.get(connection_id)
        sql = self.validator.string(sql, "sql")
        password = crypto.decrypt(connection.password_encrypted, self.settings)

        self.activity.event(
            category="database",
            action="database.query",
            step_name="execute",
            message=f"Query run against {connection.name}",
            details={
                "connection_id": str(connection.id),
                "connection": connection.name,
                "engine": connection.engine,
                "allow_writes": connection.allow_writes,
                "sql": sql[:2000],
            },
        )

        return self.service.execute_query(
            connection.engine, connection.host, connection.port, connection.database_name,
            connection.username, password, connection.sslmode, sql,
            timeout_seconds=self.settings.query_console_timeout_seconds,
            max_rows=self.settings.query_console_max_rows,
            allow_writes=connection.allow_writes,
        )

    def introspect(self, connection_id):
        connection = self.get(connection_id)
        password = crypto.decrypt(connection.password_encrypted, self.settings)
        schema = self.service.introspect(
            connection.engine, connection.host, connection.port, connection.database_name,
            connection.username, password, connection.sslmode,
            timeout_seconds=self.settings.query_console_timeout_seconds,
        )
        return {**schema, "engine": connection.engine}

    # ------------------------------------------------------------------
    def apply_defaults(self, values):
        values = self._engine_defaults(super().apply_defaults(values))
        self._guard_default(values)
        return values

    def before_update(self, connection, values):
        if "engine" in values and values["engine"] != connection.engine:
            raise ValidationError("A connection's engine cannot be changed. Register a new connection instead.")
        self._guard_default(values, current=connection)

    def _guard_default(self, values, current=None):
        if not values.get("is_default"):
            return

        role = values.get("role") or (current.role if current else "external")
        if role != "cluster":
            raise ValidationError(
                "Only a connection with role 'cluster' can be the default for new tenants and sites."
            )

        engine = values.get("engine") or (current.engine if current else "postgres")
        stmt = select(DatabaseConnection).where(
            DatabaseConnection.is_default.is_(True), DatabaseConnection.engine == engine
        )
        if current is not None:
            stmt = stmt.where(DatabaseConnection.id != current.id)
        for previous in self.session.scalars(stmt).all():
            previous.is_default = False
        self.session.flush()

    def before_delete(self, connection, force):
        """Refuse while tenants still live on it -- their data is there."""
        count = self.session.scalar(
            select(func.count()).select_from(Tenant).where(
                Tenant.database_connection_id == connection.id
            )
        )
        sites = self.session.scalar(
            select(func.count()).select_from(Site).where(Site.db_server_id == connection.id)
        )
        if sites:
            raise ConflictError(
                f"{sites} Frappe site(s) still have their database on '{connection.name}'."
            )
        if count:
            raise ConflictError(
                f"{count} tenant(s) still have their database on '{connection.name}'. "
                "Migrate them to another cluster first."
            )
