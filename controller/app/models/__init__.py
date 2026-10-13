"""Import every mapped class here so SQLAlchemy can resolve the string-based
forward references used in relationship() type hints (e.g. Tenant.customer),
and so Alembic's autogenerate sees the full schema from one import.
"""

from app.models.activity import ActivityLog, Operation
from app.models.backup import TenantBackup
from app.models.base import Base
from app.models.database_connection import DatabaseConnection
from app.models.db_migration import TenantDatabaseMigration
from app.models.deployment import Deployment
from app.models.domain import DomainMapping
from app.models.migration import TenantMigration
from app.models.platform import (
    PRISMA_OWNED_TABLES,
    PlatformBillingRecord,
    PlatformSubscription,
    PlatformUser,
)
from app.models.server import ServerNode, Tenant
from app.models.site import Site

__all__ = [
    "Base",
    "ServerNode",
    "Tenant",
    "Deployment",
    "DomainMapping",
    "DatabaseConnection",
    "TenantDatabaseMigration",
    "PlatformUser",
    "PlatformSubscription",
    "PlatformBillingRecord",
    "PRISMA_OWNED_TABLES",
    "TenantBackup",
    "TenantMigration",
    "Operation",
    "ActivityLog",
]
