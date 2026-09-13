"""Per-connection handler for /ws/stream/<kind>/<deployment_id>.

Mirrors app/terminal/handler.py: `process_request` is the auth gate that runs
before the handshake, so an unauthorised caller never gets an open socket,
and the resolved grant is stashed on the connection for the handler to read
back.

The deployment is resolved to its container name and its node here, inside a
session that closes before streaming starts -- a stream can stay open for
minutes and must not hold a database connection for its lifetime.
"""

import time
import uuid
from urllib.parse import unquote

from websockets.datastructures import Headers
from websockets.http11 import Response

from app.config import settings
from app.db import database
from app.errors import NodeUnreachableError
from app.models.deployment import Deployment
from app.models.server import ServerNode
from app.services.activity_logger import ActivityLogger
from app.streams import docker_stream
from app.streams.auth import STREAM_KINDS, resolve_stream_grant

PATH_PREFIX = "/ws/stream/"


def _reject(status_code, reason):
    return Response(status_code, reason, Headers({"Content-Type": "text/plain"}), reason.encode())


def _extract_token(path):
    """The grant travels as ?token=... -- browsers cannot set headers on a
    WebSocket handshake. Acceptable because the token is single-purpose,
    bound to one deployment and expires in ~60s."""
    if "?" not in path:
        return None
    for pair in path.split("?", 1)[1].split("&"):
        key, _, value = pair.partition("=")
        if key == "token":
            return unquote(value)
    return None


def _extract_route(path):
    """/ws/stream/<kind>/<deployment_id> -> (kind, uuid), or (None, None)."""
    clean = path.split("?", 1)[0]
    parts = [p for p in clean.strip("/").split("/") if p]
    if len(parts) != 4 or parts[0] != "ws" or parts[1] != "stream":
        return None, None
    kind = parts[2]
    if kind not in STREAM_KINDS:
        return None, None
    try:
        return kind, uuid.UUID(parts[3])
    except ValueError:
        return None, None


def process_request(connection, request):
    kind, deployment_id = _extract_route(request.path)
    if kind is None:
        return _reject(404, "Not found")

    grant = resolve_stream_grant(_extract_token(request.path), deployment_id, kind)
    if grant is None:
        return _reject(401, "Unauthorized")

    with database.session() as session:
        deployment = session.get(Deployment, deployment_id)
        if deployment is None:
            return _reject(404, "Deployment not found")
        server = session.get(ServerNode, deployment.server_id)
        if server is None or not server.is_active:
            return _reject(404, "Node not found or inactive")
        # Detach what the handler needs; the session closes here.
        connection.stream_container = deployment.container_name
        connection.stream_server_id = server.id
        connection.stream_tenant_id = deployment.tenant_id

    connection.stream_grant = grant
    return None  # proceed with the handshake


def handle_connection(ws):
    grant = getattr(ws, "stream_grant", None)
    container = getattr(ws, "stream_container", None)
    server_id = getattr(ws, "stream_server_id", None)
    if grant is None or container is None or server_id is None:
        # Unreachable -- process_request rejects first -- but never stream
        # from an unauthenticated connection.
        ws.close(code=1011, reason="internal error")
        return

    with database.session() as session:
        server = session.get(ServerNode, server_id)
    if server is None:
        ws.close(code=1008, reason="node no longer exists")
        return

    command = (
        docker_stream.logs_command(container)
        if grant.kind == "logs"
        else docker_stream.stats_command(container)
    )

    activity = ActivityLogger(actor=grant.admin_email)
    activity.event(
        "stream", f"stream.{grant.kind}_open", f"Live {grant.kind} stream opened",
        server_id=server.id, server_name=server.name,
        tenant_id=getattr(ws, "stream_tenant_id", None),
        details={"container": container},
    )

    started = time.monotonic()
    status, error, frames = "success", None, 0
    try:
        frames = docker_stream.run_stream(
            ws, server, command, settings,
            idle_timeout=settings.ws_stream_idle_timeout_seconds,
        )
    except NodeUnreachableError as exc:
        status, error = "failed", exc
    except Exception as exc:  # noqa: BLE001 -- one stream must not kill the service
        status, error = "failed", exc
    finally:
        activity.event(
            "stream", f"stream.{grant.kind}_close", f"Live {grant.kind} stream closed",
            status=status, error=error,
            server_id=server.id, server_name=server.name,
            tenant_id=getattr(ws, "stream_tenant_id", None),
            details={"container": container, "frames": frames},
            duration_ms=int((time.monotonic() - started) * 1000),
        )
