"""Entrypoint for the isolated WebSocket service.

    python ws_terminal_main.py

Serves two features that both need a socket the browser opens directly:

    /ws/terminal/<server_id>            interactive SSH shell   (app/terminal)
    /ws/stream/logs/<deployment_id>     live container logs     (app/streams)
    /ws/stream/stats/<deployment_id>    live container metrics  (app/streams)

One process rather than two: they share an auth root (a short-lived HS256
grant minted by the Next.js admin panel), a systemd unit and an nginx
upstream, and neither holds meaningful state. A second service would double
the deployment surface to gain nothing.

Deliberately separate from the main gunicorn app (main.py serve) -- see
app/terminal/__init__.py. Never bind this to a public interface directly;
WS_TERMINAL_HOST defaults to loopback-only for exactly that reason.
"""

import logging

from websockets.sync.server import serve

from app.config import settings
from app.streams import handler as stream_handler
from app.terminal import handler as terminal_handler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ws_service")

TERMINAL_PREFIX = "/ws/terminal/"


def _route_of(request):
    """Which feature owns this path, decided once and stashed on the socket.

    `process_request` and the connection handler receive the same connection
    object, so the routing decision made before the handshake is the one the
    handler acts on -- the path is never parsed twice and cannot disagree
    with itself between the two.
    """
    path = request.path.split("?", 1)[0]
    if path.startswith(TERMINAL_PREFIX):
        return terminal_handler
    if path.startswith(stream_handler.PATH_PREFIX):
        return stream_handler
    return None


def process_request(connection, request):
    module = _route_of(request)
    if module is None:
        return terminal_handler._reject(404, "Not found")
    connection.ws_route = module
    return module.process_request(connection, request)


def handle_connection(ws):
    module = getattr(ws, "ws_route", None)
    if module is None:
        # Unreachable: process_request rejects an unknown path before the
        # handshake completes.
        ws.close(code=1011, reason="internal error")
        return
    module.handle_connection(ws)


def main():
    logger.info(
        "ws service listening on %s:%s (terminal + log/metric streams)",
        settings.ws_terminal_host,
        settings.ws_terminal_port,
    )
    with serve(
        handle_connection,
        settings.ws_terminal_host,
        settings.ws_terminal_port,
        process_request=process_request,
    ) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()
