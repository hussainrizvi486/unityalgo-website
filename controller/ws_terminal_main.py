
import logging

from websockets.sync.server import serve

from app.config import settings
from app.streams import handler as stream_handler
from app.terminal import handler as terminal_handler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ws_service")

TERMINAL_PREFIX = "/ws/terminal/"


def _route_of(request):
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
