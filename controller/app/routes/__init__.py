from .base import BaseView
from .dashboard import DashboardRoutes
from .database_connection import DatabaseConnectionRoutes
from .domain import DomainRoutes
from .health import HealthRoutes
from .log import LogRoutes
from .proxy import ProxyRoutes
from .server import ServerRoutes
from .site import SiteRoutes
from .tenant import LegacyRoutes, TenantRoutes

ALL_ROUTES = (
    HealthRoutes,
    ServerRoutes,
    SiteRoutes,
    TenantRoutes,
    DomainRoutes,
    LogRoutes,
    DashboardRoutes,
    DatabaseConnectionRoutes,
    ProxyRoutes,
    LegacyRoutes,
)

__all__ = [
    "BaseView",
    "HealthRoutes",
    "ServerRoutes",
    "TenantRoutes",
    "DomainRoutes",
    "LogRoutes",
    "DashboardRoutes",
    "DatabaseConnectionRoutes",
    "ProxyRoutes",
    "LegacyRoutes",
    "ALL_ROUTES",
]
