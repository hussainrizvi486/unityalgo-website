"""Resolves which PostgreSQL instance a given tenant's data lives on.

One place decides this, so every caller -- provisioning, backup, restore,
teardown, the DSN handed to a container -- agrees. Getting it wrong means
creating a database on one cluster and pointing the container at another, so
it is worth centralising rather than repeating the `if tenant.cluster else
default` check at each call site.
"""

from app.config import settings as default_settings
from app.errors import ConfigurationError, NotFoundError
from app.models.database_connection import DatabaseConnection
from app.services.crypto import decrypt
from app.services.postgres_service import ClusterTarget, PostgresService


def target_for_connection(connection, config=None):
    """ClusterTarget for a registered cluster, decrypting its password."""
    config = config or default_settings
    return ClusterTarget.from_connection(
        connection, decrypt(connection.password_encrypted, config), config
    )


def target_for_tenant(session, tenant, config=None):
    """Which instance holds this tenant's database.

    A tenant with no assigned cluster uses the controller's own database --
    where every tenant lived before clusters existed -- so existing tenants
    keep working without a backfill.
    """
    config = config or default_settings

    if tenant.database_connection_id is None:
        return ClusterTarget.from_settings(config)

    connection = session.get(DatabaseConnection, tenant.database_connection_id)
    if connection is None:
        # The FK is ONDELETE RESTRICT, so this should be unreachable; if it
        # ever happens, failing loudly beats silently provisioning onto the
        # wrong instance.
        raise NotFoundError(
            f"Tenant '{tenant.tenant_slug}' references database cluster "
            f"{tenant.database_connection_id}, which no longer exists."
        )
    return target_for_connection(connection, config)


def service_for_tenant(session, tenant, config=None):
    """PostgresService bound to the tenant's own cluster."""
    return PostgresService(config=config, target=target_for_tenant(session, tenant, config))


def default_cluster(session):
    """The cluster new tenants are provisioned onto, or None for the legacy one."""
    return (
        session.query(DatabaseConnection)
        .filter(
            DatabaseConnection.engine == "postgres",
            DatabaseConnection.role == "cluster",
            DatabaseConnection.is_default.is_(True),
        )
        .one_or_none()
    )


def tenant_dsn(session, tenant, config=None):
    """The DATABASE_URL handed to the tenant's container.

    Uses the cluster's worker-facing address: a container on a remote node
    generally cannot reach the database by the same host the controller uses.
    """
    config = config or default_settings
    target = target_for_tenant(session, tenant, config)

    if not target.worker_host:
        raise ConfigurationError(
            f"No worker-reachable address is configured for '{target.label}'. "
            "Tenant containers run on remote nodes and cannot reach it via the "
            "controller's own address. Set the cluster's 'host as seen from "
            "workers', or TENANT_DB_HOST for the default cluster."
        )

    dsn = (
        f"postgresql://{tenant.db_user}:{tenant.db_password}"
        f"@{target.worker_host}:{target.port}/{tenant.db_name}"
    )
    if target.sslmode and target.sslmode.lower() != "disable":
        dsn += f"?sslmode={target.sslmode}"
    return dsn
