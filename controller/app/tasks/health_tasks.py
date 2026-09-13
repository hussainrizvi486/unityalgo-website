"""Periodic fleet health sweep (Celery Beat -- see app/tasks/celery_app.py).

Passive-only for v1: findings are logged to the Activity Log (visible
immediately in the existing Logs page, filterable by category="health") and
ServerNode.last_checked_at/last_check_status get refreshed. No
email/Slack/webhook alerting -- there's no outbound-notification
infrastructure anywhere in this codebase, and building one is out of scope
here.

Every check here composes existing, already-verified building blocks rather
than reimplementing them -- see each helper's docstring for what it reuses.
"""

import socket
from datetime import datetime, timezone

from sqlalchemy import select

from app.config import settings
from app.controller.domain import DomainController
from app.controller.server import ServerController
from app.db import database
from app.errors import NodeUnreachableError
from app.models.domain import DomainMapping
from app.models.server import ServerNode
from app.services.activity_logger import ActivityLogger
from app.services.health_check_service import HealthCheckService
from app.services.proxy_configuration_service import ProxyConfigurationService
from app.services.ssh_service import SSHService
from app.tasks.base import DBTask
from app.tasks.celery_app import celery_app


@celery_app.task(base=DBTask, name="app.tasks.health_tasks.health_check_sweep")
def health_check_sweep():
    activity = ActivityLogger(actor="health-sweep")
    with database.session() as session:
        _check_servers(session, activity)
        _check_proxy_and_domains(session, activity)


def _check_servers(session, activity):
    """SSH-reachability probe for every active server.

    Deliberately uses SSHService.check() directly, not
    ServerController.connect()/_connect_steps() -- that flow also collects
    full hardware specs (6+ extra remote commands), which a sweep running
    across a whole fleet every few minutes doesn't need and shouldn't pay
    for repeatedly. last_checked_at/last_check_status are the same two
    fields the UI already reads; this task is just a lighter way to refresh
    them than the heavier operator-triggered "Connect & refresh specs" flow.
    """
    servers = session.scalars(
        select(ServerNode).where(ServerNode.is_active.is_(True))
    ).all()
    for server in servers:
        ssh = SSHService(server, settings)
        now = datetime.now(timezone.utc)
        try:
            ssh.check()
        except NodeUnreachableError as exc:
            server.last_checked_at = now
            server.last_check_status = "unreachable"
            activity.event(
                "health", "health.server_unreachable", "Server unreachable",
                status="failed", server_id=server.id, server_name=server.name,
                error=str(exc),
            )
        else:
            server.last_checked_at = now
            server.last_check_status = "ok"
    session.flush()


def _check_proxy_and_domains(session, activity):
    proxy = ServerController(session, settings).proxy_node()
    if proxy is None:
        return  # Phase 2 routing not set up -- nothing to check here.

    # DNS resolution doesn't require SSH-ing into the proxy at all, so it
    # stays useful even when the proxy itself is unreachable.
    _check_domain_dns(session, activity, proxy)

    # _check_proxy_sync and _check_upstreams both SSH into the proxy (admin
    # API tunnel / curl-from-proxy respectively) -- if the proxy itself is
    # down, both would raise the same NodeUnreachableError. One clear
    # finding beats crashing the whole sweep over an unreachable proxy.
    try:
        _check_proxy_sync(session, activity)
        _check_upstreams(session, activity, proxy)
    except NodeUnreachableError as exc:
        activity.event(
            "health", "health.proxy_unreachable", "Proxy node unreachable",
            status="failed", server_id=proxy.id, server_name=proxy.name,
            error=str(exc),
        )


def _check_proxy_sync(session, activity):
    """Reuses ProxyConfigurationService.verify() as-is -- already
    read-only/side-effect-free, exactly the reusable piece for this."""
    result = ProxyConfigurationService(settings).verify(session)
    if result["in_sync"] is False:
        activity.event(
            "health", "health.proxy_drift", "Proxy routes out of sync",
            status="warning",
            details={"missing": result["missing"], "extra": result["extra"]},
        )


def _check_domain_dns(session, activity, proxy):
    """Read-only DNS check for active custom domains.

    Reuses the socket.getaddrinfo/proxy-IP-match *pattern* from
    DomainController.verify_and_activate (app/controller/domain.py) -- not
    that method itself, which has activation side effects and raises rather
    than returning. Platform domains are skipped: they're pointed at us by
    construction and never DNS-verified in the first place.
    """
    active_customs = session.scalars(
        select(DomainMapping).where(
            DomainMapping.domain_type == "custom",
            DomainMapping.status == "active",
        )
    ).all()
    for mapping in active_customs:
        try:
            resolved = {
                info[4][0] for info in socket.getaddrinfo(mapping.domain, None)
            }
        except socket.gaierror as exc:
            activity.event(
                "health", "health.dns_unresolvable", "Domain no longer resolves",
                status="warning",
                details={"domain": mapping.domain, "error": str(exc)},
            )
            continue
        if proxy.ip_address not in resolved:
            activity.event(
                "health", "health.dns_mismatch", "Domain no longer points at proxy",
                status="warning",
                details={
                    "domain": mapping.domain,
                    "expected": proxy.ip_address,
                    "resolved": sorted(resolved),
                },
            )


def _check_upstreams(session, activity, proxy):
    """Single-attempt upstream reachability per routable domain.

    Uses HealthCheckService.probe_once() (new), not probe() -- probe()'s
    ~45s retry/backoff is for gating one new deployment at provision/migrate
    time and must not change; a sweep can't afford that per domain across a
    whole fleet every few minutes. One transient miss just gets caught on
    the next cycle.
    """
    health = HealthCheckService(settings)
    for mapping in DomainController(session, settings).routable():
        if not health.probe_once(proxy, mapping.deployment):
            activity.event(
                "health", "health.upstream_unreachable", "Domain upstream unreachable",
                status="failed",
                details={"domain": mapping.domain, "upstream": mapping.deployment.upstream},
            )
