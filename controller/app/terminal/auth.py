"""Verifies the short-lived terminal access token minted by the Next.js app.

Every other controller endpoint is reached server-to-server, so it can be
protected by the static internal API key (app/api_auth.py). The browser SSH
terminal is the one exception: a WebSocket cannot be proxied through a Next.js
Server Action, so the browser connects here directly and the static key must
never be sent to it.

Instead, `/admin/servers/<id>/terminal` on the Next.js side -- which already
has a verified `unityalgo_admin_session` and a Role.ADMIN check -- mints a
single-use-ish JWT scoped to one server id and expiring in ~60 seconds, and
the browser presents that. It is signed with SESSION_SECRET, shared with the
Next.js app, so both sides trust the same root without this service needing
any notion of users or logins.

Verified here with a hand-rolled HS256 check rather than a JWT library, to
avoid adding a dependency for ~30 lines: `jose` (Next.js) and this agree on
compact-serialisation HS256, which is fully specified.
"""

import base64
import hashlib
import hmac
import json
import time

from app.config import settings

# A token is only accepted for the specific action it was minted for, so a
# token leaked from one context cannot be replayed against another.
TERMINAL_TOKEN_PURPOSE = "controller-terminal"

# Tolerance for clock skew between the Next.js host and this one.
_CLOCK_SKEW_SECONDS = 30


def b64url_decode(segment):
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def verify_hs256(token, secret):
    """Return the decoded payload, or None if the token is not valid.

    Public because the log/metric stream service (app/streams/auth.py) needs
    exactly this check against exactly this secret. Two copies of a signature
    verifier is how one of them ends up missing the alg-downgrade guard.
    """
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError:
        return None

    try:
        header = json.loads(b64url_decode(header_b64))
    except Exception:
        return None

    # Reject anything that is not HS256 explicitly. Accepting the token's own
    # `alg` blindly is the classic JWT downgrade bug ("alg": "none").
    if header.get("alg") != "HS256":
        return None

    expected = hmac.new(
        secret.encode("utf-8"),
        f"{header_b64}.{payload_b64}".encode("ascii"),
        hashlib.sha256,
    ).digest()

    try:
        presented = b64url_decode(signature_b64)
    except Exception:
        return None

    if not hmac.compare_digest(expected, presented):
        return None

    try:
        return json.loads(b64url_decode(payload_b64))
    except Exception:
        return None


def resolve_terminal_grant(token, server_id):
    """Token -> a grant snapshot, or None if it does not authorise this server.

    Full shell access on a production node is the most privileged thing this
    service exposes, so every claim is checked: signature, purpose, expiry,
    and that the token was minted for *this* server rather than another.
    """
    if not token:
        return None

    payload = verify_hs256(token, settings.session_signing_secret)
    if not payload:
        return None

    if payload.get("purpose") != TERMINAL_TOKEN_PURPOSE:
        return None

    # The token is bound to one server; a grant for node A must not open a
    # shell on node B.
    if str(payload.get("serverId")) != str(server_id):
        return None

    now = time.time()
    exp = payload.get("exp")
    if not isinstance(exp, (int, float)) or now > exp + _CLOCK_SKEW_SECONDS:
        return None

    nbf = payload.get("nbf")
    if isinstance(nbf, (int, float)) and now < nbf - _CLOCK_SKEW_SECONDS:
        return None

    return _TerminalGrant(
        admin_email=payload.get("adminEmail") or "unknown",
        server_id=str(payload.get("serverId")),
    )


class _TerminalGrant:
    """What the audit log needs to attribute the session to a real admin."""

    def __init__(self, admin_email, server_id):
        self.admin_email = admin_email
        self.server_id = server_id

    def __repr__(self):
        return f"<TerminalGrant admin={self.admin_email} server={self.server_id}>"
