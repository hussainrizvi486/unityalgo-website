"""Tenant database provisioning and backup/restore.

Tenant data lives in PostgreSQL, never on the worker nodes -- those run only
the stateless storefront container. Migrating a tenant between *nodes*
therefore never moves data.

Which PostgreSQL is decided per tenant. Historically there was exactly one
(the controller's own, from settings.postgres_*); now a tenant may instead be
assigned to a registered cluster (app/models/database_connection.py). Every
operation here is parameterised by a ClusterTarget so the same code path
serves both, and a tenant with no assigned cluster transparently gets the
legacy one.

Moving a tenant *between clusters* does move data -- see
TenantController.migrate_database.
"""

import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
from psycopg2 import sql

from app.config import settings
# Same retry policy as the SQLAlchemy engine -- defined once in app.db.
from app.db import CONNECT_BACKOFF_SECONDS, is_transient_connection_error
from app.errors import BackupError, DatabaseUnreachableError, DependencyMissingError

CANDIDATE_BIN_DIRS = (
    "/opt/homebrew/opt/libpq/bin",
    "/usr/local/opt/libpq/bin",
    "/opt/homebrew/opt/postgresql@16/bin",
    "/usr/lib/postgresql/16/bin",
)


class ClusterTarget:
    """Everything needed to administer one PostgreSQL instance.

    Exists so PostgresService never reads connection details from global
    config: the same methods work against the legacy controller database or
    any registered cluster, decided by the caller.
    """

    __slots__ = (
        "host", "port", "user", "password", "sslmode",
        "maintenance_db", "connect_timeout", "worker_host", "label",
    )

    def __init__(self, host, port, user, password, sslmode, maintenance_db,
                 connect_timeout=10, worker_host=None, label=None):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.sslmode = sslmode
        self.maintenance_db = maintenance_db
        self.connect_timeout = connect_timeout
        # Address a tenant *container* uses; frequently differs from `host`.
        self.worker_host = worker_host or host
        self.label = label or f"{host}:{port}"

    @classmethod
    def from_settings(cls, config):
        """The controller's own database -- the pre-cluster default."""
        return cls(
            host=config.postgres_host,
            port=config.postgres_port,
            user=config.postgres_user,
            password=config.postgres_password,
            sslmode=config.postgres_sslmode,
            maintenance_db=config.postgres_db,
            connect_timeout=config.postgres_connect_timeout,
            # TENANT_DB_HOST is the pre-cluster equivalent of
            # DatabaseConnection.host_from_worker.
            worker_host=config.tenant_db_host,
            label="default cluster",
        )

    @classmethod
    def from_connection(cls, connection, password, config):
        """A registered cluster. `password` is already decrypted."""
        return cls(
            host=connection.host,
            port=connection.port,
            user=connection.username,
            password=password,
            sslmode=connection.sslmode,
            maintenance_db=connection.database_name,
            connect_timeout=config.postgres_connect_timeout,
            worker_host=connection.worker_host,
            label=connection.name,
        )

    def __repr__(self):
        return f"<ClusterTarget {self.label} {self.host}:{self.port}>"


class PostgresService:
    """Administers one PostgreSQL instance as the admin/superuser.

    `target` selects which instance; omitting it keeps the historical
    behaviour of using the controller's own database.
    """

    def __init__(self, config=None, target=None):
        self.settings = config or settings
        self.target = target or ClusterTarget.from_settings(self.settings)

    # ------------------------------------------------------------------
    def _find_binary(self, name):
        if self.settings.pg_bin_dir:
            candidate = Path(self.settings.pg_bin_dir) / name
            if candidate.exists():
                return str(candidate)
        found = shutil.which(name)
        if found:
            return found
        for directory in CANDIDATE_BIN_DIRS:
            candidate = Path(directory) / name
            if candidate.exists():
                return str(candidate)
        raise DependencyMissingError(
            f"'{name}' was not found on PATH or in the known PostgreSQL "
            f"client install locations. Install the PostgreSQL client tools "
            f"(e.g. `brew install libpq`) or set PG_BIN_DIR."
        )

    def _connection(self, dbname=None, autocommit=True):
        """Admin connection, retried through transient network failures.

        A managed database is reached over the internet, so a momentary DNS or
        routing blip is normal. Without retries a single hiccup aborts a whole
        provisioning run partway through.
        """
        target = dbname or self.target.maintenance_db
        last_error = None

        for attempt, delay in enumerate(CONNECT_BACKOFF_SECONDS, start=1):
            try:
                conn = psycopg2.connect(
                    host=self.target.host,
                    port=self.target.port,
                    user=self.target.user,
                    password=self.target.password,
                    dbname=target,
                    sslmode=self.target.sslmode,
                    connect_timeout=self.target.connect_timeout,
                )
            except psycopg2.OperationalError as exc:
                last_error = exc
                if (
                    not is_transient_connection_error(exc)
                    or attempt == len(CONNECT_BACKOFF_SECONDS)
                ):
                    break
                time.sleep(delay)
            else:
                conn.autocommit = autocommit
                return conn

        raise DatabaseUnreachableError(
            f"Could not connect to '{self.target.label}' at "
            f"{self.target.host}:{self.target.port}/{target} "
            f"after {len(CONNECT_BACKOFF_SECONDS)} attempt(s): "
            f"{str(last_error).strip()}"
        ) from last_error

    def _admin_connection(self, autocommit=True):
        return self._connection(autocommit=autocommit)

    def _pg_env(self, password):
        """Environment for pg_dump / pg_restore.

        PGSSLMODE matters for managed Postgres, which refuses unencrypted
        connections -- without it a backup fails where the app connects fine.
        """
        return {
            "PGPASSWORD": password,
            "PGSSLMODE": self.target.sslmode,
            "PGCONNECT_TIMEOUT": str(self.target.connect_timeout),
            "PATH": "/usr/bin:/bin",
        }

    # ------------------------------------------------------------------
    # provisioning
    # ------------------------------------------------------------------
    def create_database(self, tenant):
        """CREATE ROLE + CREATE DATABASE for a tenant. Idempotent.

        Uses a bare connect/close rather than `with connection:` -- psycopg2's
        connection context manager wraps statements in an implicit
        transaction even when autocommit is on, and CREATE/DROP DATABASE
        cannot run inside one.
        """
        conn = self._admin_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM pg_roles WHERE rolname = %s", (tenant.db_user,)
                )
                if cur.fetchone() is None:
                    cur.execute(
                        sql.SQL("CREATE ROLE {} WITH LOGIN PASSWORD %s").format(
                            sql.Identifier(tenant.db_user)
                        ),
                        (tenant.db_password,),
                    )
                else:
                    cur.execute(
                        sql.SQL("ALTER ROLE {} WITH LOGIN PASSWORD %s").format(
                            sql.Identifier(tenant.db_user)
                        ),
                        (tenant.db_password,),
                    )

                cur.execute(
                    "SELECT 1 FROM pg_database WHERE datname = %s", (tenant.db_name,)
                )
                if cur.fetchone() is None:
                    cur.execute(
                        sql.SQL("CREATE DATABASE {} OWNER {}").format(
                            sql.Identifier(tenant.db_name),
                            sql.Identifier(tenant.db_user),
                        )
                    )
                cur.execute(
                    sql.SQL("GRANT ALL PRIVILEGES ON DATABASE {} TO {}").format(
                        sql.Identifier(tenant.db_name), sql.Identifier(tenant.db_user)
                    )
                )
        finally:
            conn.close()

        # PostgreSQL 15+ leaves a new database's `public` schema owned by
        # whichever role ran CREATE DATABASE (the admin), not the database's
        # own owner -- so the tenant role has no CREATE privilege in it until
        # we hand the schema over explicitly. Must run against the tenant's
        # own database, not the admin one.
        tenant_conn = self._connection(dbname=tenant.db_name)
        try:
            with tenant_conn.cursor() as cur:
                cur.execute(
                    sql.SQL("ALTER SCHEMA public OWNER TO {}").format(
                        sql.Identifier(tenant.db_user)
                    )
                )
        finally:
            tenant_conn.close()
        return True

    def drop_database(self, tenant):
        conn = self._admin_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(
                        sql.Identifier(tenant.db_name)
                    )
                )
                cur.execute(
                    sql.SQL("DROP ROLE IF EXISTS {}").format(
                        sql.Identifier(tenant.db_user)
                    )
                )
        finally:
            conn.close()
        return True

    def database_exists(self, tenant):
        conn = self._admin_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM pg_database WHERE datname = %s", (tenant.db_name,)
                )
                return cur.fetchone() is not None
        finally:
            conn.close()

    # ------------------------------------------------------------------
    # backup / restore
    # ------------------------------------------------------------------
    def backup_path_for(self, tenant, when=None):
        when = when or datetime.now(timezone.utc)
        directory = Path(self.settings.backup_dir) / tenant.tenant_slug
        directory.mkdir(parents=True, exist_ok=True)
        stamp = when.strftime("%Y%m%dT%H%M%SZ")
        return directory / f"{tenant.tenant_slug}-{stamp}.dump"

    def backup_database(self, tenant, destination=None):
        """`pg_dump -F c` the tenant's database. Returns (path, size_bytes)."""
        pg_dump = self._find_binary("pg_dump")
        destination = Path(destination) if destination else self.backup_path_for(tenant)
        destination.parent.mkdir(parents=True, exist_ok=True)

        result = subprocess.run(
            [
                pg_dump,
                "-h", self.target.host,
                "-p", str(self.target.port),
                "-U", tenant.db_user,
                "-F", "c",
                "-f", str(destination),
                tenant.db_name,
            ],
            env=self._pg_env(tenant.db_password),
            capture_output=True,
            text=True,
            timeout=600,
        )
        if result.returncode != 0:
            raise BackupError(
                f"pg_dump failed for tenant '{tenant.tenant_slug}': "
                f"{result.stderr.strip() or 'unknown error'}"
            )
        return destination, destination.stat().st_size

    def restore_database(self, tenant, backup_path):
        """`pg_restore --clean` the tenant's database from a backup file."""
        pg_restore = self._find_binary("pg_restore")
        backup_path = Path(backup_path)
        if not backup_path.exists():
            raise BackupError(f"Backup file not found: {backup_path}")

        # No --no-owner: the dump records the tenant role as each object's
        # owner, and restoring as the admin (a superuser) can reassign to it.
        # Dropping --no-owner is what keeps restored tables owned by the
        # tenant instead of by the admin connection that ran the restore.
        result = subprocess.run(
            [
                pg_restore,
                "-h", self.target.host,
                "-p", str(self.target.port),
                "-U", self.target.user,
                "-d", tenant.db_name,
                "--clean", "--if-exists",
                str(backup_path),
            ],
            env=self._pg_env(self.target.password),
            capture_output=True,
            text=True,
            timeout=600,
        )
        # pg_restore exits 1 on warnings (e.g. "role does not exist" for
        # ownership statements) even when the data restored fine, so only
        # treat it as fatal when nothing was written at all.
        if result.returncode != 0 and "errors ignored on restore" not in result.stderr:
            raise BackupError(
                f"pg_restore failed for tenant '{tenant.tenant_slug}': "
                f"{result.stderr.strip() or 'unknown error'}"
            )
        return True
