
import time
import uuid
from urllib.parse import unquote

from websockets.datastructures import Headers
from websockets.http11 import Response

from app.config import settings
from app.db import database
from app.errors import NodeUnreachableError
from app.models.server import ServerNode
from app.services.activity_logger import ActivityLogger
from app.terminal import pty_shell
from app.terminal.auth import resolve_terminal_grant


def _reject(status_code, reason):
    return Response(status_code, reason, Headers({"Content-Type": "text/plain"}), reason.encode())


def _extract_token(path):
    if "?" not in path:
        return None
    query = path.split("?", 1)[1]
    for pair in query.split("&"):
        key, _, value = pair.partition("=")
        if key == "token":
            return unquote(value)
    return None


def _extract_server_id(path):
    # /ws/terminal/<server_id> -- strip any query string first.
    clean_path = path.split("?", 1)[0]
    parts = [p for p in clean_path.strip("/").split("/") if p]
    if len(parts) != 3 or parts[0] != "ws" or parts[1] != "terminal":
        return None
    try:
        return uuid.UUID(parts[2])
    except ValueError:
        return None


def process_request(connection, request):
    """Auth + server-resolution gate, run before the WS handshake completes."""
    server_id = _extract_server_id(request.path)
    if server_id is None:
        return _reject(404, "Not found")

    grant = resolve_terminal_grant(_extract_token(request.path), server_id)
    if grant is None:
        return _reject(401, "Unauthorized")

    with database.session() as session:
        server = session.get(ServerNode, server_id)
        if server is None or not server.is_active:
            return _reject(404, "Server not found or inactive")
        connection.terminal_server_id = server.id
        connection.terminal_server_name = server.name

    connection.terminal_grant = grant
    return None  # None = proceed with the handshake


def handle_connection(ws):
    """The actual per-connection handler, called after a successful handshake."""
    grant = getattr(ws, "terminal_grant", None)
    server_id = getattr(ws, "terminal_server_id", None)
    if grant is None or server_id is None:
        ws.close(code=1011, reason="internal error")
        return

    activity = ActivityLogger(actor=grant.admin_email)
    with database.session() as session:
        server = session.get(ServerNode, server_id)
    if server is None:
        ws.close(code=1008, reason="server no longer exists")
        return

    activity.event(
        "terminal", "terminal.session_open", "SSH terminal opened",
        server_id=server.id, server_name=server.name,
    )
    started = time.monotonic()
    status, error = "success", None
    try:
        pty_shell.run_session(ws, server, settings)
    except NodeUnreachableError as exc:
        status, error = "failed", exc
    except Exception as exc:  # noqa: BLE001 -- must not crash the service for other sessions
        status, error = "failed", exc
    finally:
        activity.event(
            "terminal", "terminal.session_close", "SSH terminal closed",
            status=status, error=error,
            server_id=server.id, server_name=server.name,
            duration_ms=int((time.monotonic() - started) * 1000),
        )
