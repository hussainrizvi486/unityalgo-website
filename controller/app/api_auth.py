"""Service-to-service auth for the JSON API.

The controller is no longer a user-facing application. It has no login, no
session cookies and no admin_users table: the only thing that talks to
`/api/v1/*` is the UnityAlgo Next.js server, which authenticates its admins
itself (Role.ADMIN on the shared `User` table) and then calls this API on
their behalf from Server Actions.

So the gate here is a single shared secret rather than a login system. It is
sent server-to-server only and must never reach a browser -- see
lib/controller-client.ts on the Next.js side, which reads it from the
environment inside Server Actions.

Because a static bearer token is the *entire* protection on every
infrastructure-mutating endpoint in this service, the process refuses to
start without one (see Settings.controller_internal_api_key) rather than
silently defaulting to an open API. Bind the service to localhost or a
private network in addition to this.

Gated by Flask endpoint name, not URL string-matching: the app runs with
`url_map.strict_slashes = False` (see ApiRouter.configure), so a path-prefix
check would mis-handle a legitimate trailing-slash variant of a route.
"""

import hmac

from flask import request

from .errors import UnauthorizedError

# Liveness probes stay open so a load balancer or the Next.js health check
# can reach them without holding the shared secret. They expose no data.
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
        # compare_digest keeps the check constant-time, so a caller cannot
        # recover the key one byte at a time by timing failed requests.
        if not presented or not hmac.compare_digest(presented, expected_key):
            raise UnauthorizedError("Invalid or missing controller API key")
        return None
