import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, text
from app.errors import ConflictError, NodeUnreachableError
from app.models.deployment import Deployment
from app.models.site import Site
from app.services.ssh_service import SSHService

log = logging.getLogger(__name__)

MAX_CONFIRMATIONS = 50


def database_ports(session, server, cooldown_seconds=0):
    """Ports on `server` that the platform itself has allocated or only just released."""
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=cooldown_seconds)
    sites = session.scalars(select(Site.port).where(Site.server_id == server.id))
    deployments = session.scalars(
        select(Deployment.port).where(
            Deployment.server_id == server.id,
            Deployment.status.in_(Deployment.ACTIVE_STATUSES) | (Deployment.port_released_at > cutoff),
        )
    )
    return set(sites) | set(deployments)


def allocate_port(session, settings, server, low, high, *, probe=True, ssh=None):
    # One allocation at a time per server; the lock is released when the caller commits.
    session.execute(text('SELECT pg_advisory_xact_lock(hashtext(:key))'), {'key': f'port-alloc:{server.id}'})
    taken = database_ports(session, server, getattr(settings, 'port_reuse_cooldown_seconds', 0))

    held_elsewhere = set()
    node = None
    if probe:
        try:
            node = ssh or SSHService(server, settings)
            held_elsewhere = set(node.listening_ports())
        except NodeUnreachableError as error:
            log.warning('Port probe skipped for %s: %s', server.name, error)
            node = None

    confirmations = 0
    for port in range(low, high + 1):
        if port in taken or port in held_elsewhere:
            continue
        if node is not None and confirmations < MAX_CONFIRMATIONS:
            confirmations += 1
            try:
                if node.port_in_use(port):
                    held_elsewhere.add(port)
                    continue
            except NodeUnreachableError:
                node = None
        return port

    raise ConflictError(
        f"No free port is available on server '{server.name}' in the range {low}-{high}: "
        f'{len(taken)} are allocated to sites and services and {len(held_elsewhere - taken)} are in use by other '
        'processes. Free a port, widen the port range, or add a server.'
    )
