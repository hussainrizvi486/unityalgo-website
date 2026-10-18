
import hmac

from flask import request

from .errors import UnauthorizedError

EXEMPT_ENDPOINTS = {"health.health", "health.ping"}


def _extract_token(req):
    """Accept either `Authorization: Bearer <token>` or `X-Controller-Key`."""
    header = req.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[len("Bearer "):].strip()
    return req.headers.get("X-Controller-Key", "").strip()


def register_api_auth(app, expected_key):
    @app.before_request
    def enforce_api_auth():
        if not request.path.startswith("/api/v1/"):
            return None
        if request.endpoint in EXEMPT_ENDPOINTS:
            return None

        presented = _extract_token(request)
        if not presented or not hmac.compare_digest(presented, expected_key):
            raise UnauthorizedError("Invalid or missing controller API key")
        return None
