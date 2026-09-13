"""Database engine, session lifecycle and migration commands."""

import time
from contextlib import contextmanager

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from .config import settings

# Waits between connection attempts; the length is the attempt count.
CONNECT_BACKOFF_SECONDS = (0.5, 1, 2, 4, 8)

# Connection failures worth retrying. Everything else (bad password, missing
# database, permission denied) is a configuration error retrying cannot fix.
#
# DNS entries matter most in practice: a managed database is reached by name
# over the internet, and on a laptop the resolver briefly stops answering every
# time a VPN reconnects -- which would otherwise fail a request outright.
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


def is_transient_connection_error(exc):
    message = str(exc).lower()
    return any(signature in message for signature in TRANSIENT_CONNECT_ERRORS)


class Database:
    """Owns the engine and hands out sessions.

    A single instance is created at import time (`database` below); tests can
    build their own against a different `Settings`.
    """

    def __init__(self, config=None):
        self.settings = config or settings
        self.engine = create_engine(
            self.settings.database_url,
            echo=self.settings.db_echo,
            pool_pre_ping=True,
            pool_size=self.settings.db_pool_size,
            max_overflow=self.settings.db_max_overflow,
            # Recycle before a managed provider's idle timeout closes them, and
            # so a pooled connection is reused rather than re-resolved.
            pool_recycle=self.settings.db_pool_recycle,
            connect_args={"connect_timeout": self.settings.postgres_connect_timeout},
        )
        self._install_connect_retry()
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)

    def _install_connect_retry(self):
        """Retry transient failures when opening a NEW pooled connection.

        `pool_pre_ping` only validates connections that already exist; it does
        nothing when creating one fails. Without this, a single DNS blip during
        a VPN reconnect surfaces as a 500 on whatever request happened to need
        a fresh connection.
        """

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
