"""Database engine, session lifecycle and migration commands."""

import time
from contextlib import contextmanager

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from .config import settings

# Waits between connection attempts; the length is the attempt count.
CONNECT_BACKOFF_SECONDS = (0.5, 1, 2, 4, 8)

TRANSIENT_CONNECT_ERRORS = (
    "could not translate host name",
    "temporary failure in name resolution",
    "name or service not known",
    "nodename nor servname provided",
    "could not connect to server",
    "connection refused",
    "connection timed out",
    "timeout expired",
    "network is unreachable",
    "no route to host",
    "server closed the connection unexpectedly",
    "too many connections",
    "the database system is starting up",
)


CONNECTION_DIAGNOSES = (
    (("password authentication failed",),
     "The database rejected the username or password. Check the user and password in DATABASE_URL (or POSTGRES_USER / POSTGRES_PASSWORD)."),
    (("no password supplied",),
     "The database wants a password and none was given. Add it to DATABASE_URL (or POSTGRES_PASSWORD)."),
    (("role", "does not exist"),
     "The database user in DATABASE_URL does not exist on that server. Create the role or correct the username."),
    (("database", "does not exist"),
     "The server is reachable but has no database with that name. Create it (createdb) or correct the database name in DATABASE_URL."),
    (("pg_hba.conf",),
     "The server refused this machine or user (pg_hba.conf). Allow the controller's address on the database server, or connect with SSL if the server requires it."),
    (("server does not support ssl",),
     "The server does not support SSL but the connection asked for it. Set sslmode=disable (or prefer) in DATABASE_URL."),
    (("ssl",),
     "The SSL handshake failed. If the server requires SSL add sslmode=require to DATABASE_URL; if it has none, use sslmode=disable."),
    (("could not translate host name",),
     "The database host name could not be resolved. Check the host in DATABASE_URL, your DNS and any VPN."),
    (("name or service not known",),
     "The database host name could not be resolved. Check the host in DATABASE_URL, your DNS and any VPN."),
    (("temporary failure in name resolution",),
     "The database host name could not be resolved. Check the host in DATABASE_URL, your DNS and any VPN."),
    (("connection refused",),
     "Nothing is accepting connections at that host and port. Check PostgreSQL is running (for example `docker compose up -d db`) and that the host and port in DATABASE_URL are right."),
    (("timeout expired",),
     "The database host did not answer in time. Check the host and port, that PostgreSQL is running, and that a firewall is not blocking the port."),
    (("connection timed out",),
     "The database host did not answer in time. Check the host and port, that PostgreSQL is running, and that a firewall is not blocking the port."),
    (("network is unreachable",),
     "There is no network route to the database host. Check your network or VPN."),
    (("no route to host",),
     "There is no network route to the database host. Check your network or VPN."),
    (("too many connections",),
     "The server is out of connections. Lower DB_POOL_SIZE or raise max_connections on the database."),
    (("starting up",),
     "PostgreSQL is still starting or recovering. Wait a moment and start the controller again."),
)


def diagnose_connection_error(exc):
    """One plain sentence on why a connection failed and how to fix it."""
    message = str(exc).lower()
    for needles, advice in CONNECTION_DIAGNOSES:
        if all(needle in message for needle in needles):
            return advice
    return "The connection failed for a reason this check does not recognise. The database error is shown above."


def is_transient_connection_error(exc):
    message = str(exc).lower()
    return any(signature in message for signature in TRANSIENT_CONNECT_ERRORS)


class Database:

    def __init__(self, config=None):
        self.settings = config or settings
        self.engine = create_engine(
            self.settings.database_url,
            echo=self.settings.db_echo,
            pool_pre_ping=True,
            pool_size=self.settings.db_pool_size,
            max_overflow=self.settings.db_max_overflow,
            pool_recycle=self.settings.db_pool_recycle,
            # gssencmode: libpq probes Kerberos first, which crashes a forked worker on macOS (SIGSEGV).
            connect_args={"connect_timeout": self.settings.postgres_connect_timeout, "gssencmode": "disable"},
        )
        self._install_connect_retry()
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)

    def _install_connect_retry(self):

        @event.listens_for(self.engine, "do_connect")
        def _connect_with_retry(dialect, conn_rec, cargs, cparams):
            last_error = None
            for attempt, delay in enumerate(CONNECT_BACKOFF_SECONDS, start=1):
                try:
                    return dialect.connect(*cargs, **cparams)
                except Exception as exc:
                    last_error = exc
                    if (
                        not is_transient_connection_error(exc)
                        or attempt == len(CONNECT_BACKOFF_SECONDS)
                    ):
                        raise
                    time.sleep(delay)
            raise last_error  # pragma: no cover - loop always returns or raises

    @contextmanager
    def session(self):
        session = self.session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def check_connection(self):
        """True when the configured Postgres is reachable."""
        try:
            with self.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return True
        except SQLAlchemyError:
            return False

    def startup_check(self):
        target = self.settings.safe_database_url()
        try:
            with self.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
                current = MigrationContext.configure(connection).get_current_revision()
            # A connection left open here would be inherited by every worker process forked afterwards.
            self.engine.dispose()
        except Exception as exc:  # any driver error: the point is to explain it
            self.engine.dispose()
            detail = str(getattr(exc, "orig", None) or exc).strip().splitlines()
            return False, [
                f"Database connection FAILED: {target}",
                f"  error:     {detail[0] if detail else type(exc).__name__}",
                f"  diagnosis: {diagnose_connection_error(exc)}",
            ]
        lines = [f"Database connection OK: {target}"]
        try:
            head = ScriptDirectory.from_config(self.alembic_config()).get_current_head()
        except Exception:
            head = None
        if head and current != head:
            lines.append(
                f"  warning: the schema is at {current or 'no revision'} but the code expects {head}. "
                "Run `python main.py migrate`."
            )
        return True, lines

    def alembic_config(self):
        config = Config(str(self.settings.base_dir / "alembic.ini"))
        config.set_main_option("sqlalchemy.url", self.settings.database_url)
        config.set_main_option("script_location", str(self.settings.base_dir / "alembic"))
        return config

    def migrate(self, revision="head"):
        command.upgrade(self.alembic_config(), revision)

    def rollback(self, revision="-1"):
        command.downgrade(self.alembic_config(), revision)

    def make_migration(self, message):
        command.revision(self.alembic_config(), message=message, autogenerate=True)

    def current_revision(self):
        command.current(self.alembic_config(), verbose=True)

    def __repr__(self):
        return f"<Database url={self.settings.safe_database_url()}>"


database = Database()


def get_session():
    """Module-level shortcut: `with get_session() as session: ...`"""
    return database.session()


def migrate():
    database.migrate()
