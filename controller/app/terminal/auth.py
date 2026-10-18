
import base64
import hashlib
import hmac
import json
import time

from app.config import settings

TERMINAL_TOKEN_PURPOSE = "controller-terminal"

# Tolerance for clock skew between the Next.js host and this one.
_CLOCK_SKEW_SECONDS = 30


def b64url_decode(segment):
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def verify_hs256(token, secret):
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError:
        return None

    try:
        header = json.loads(b64url_decode(header_b64))
    except Exception:
        return None

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
    if not token:
        return None

    payload = verify_hs256(token, settings.session_signing_secret)
    if not payload:
        return None

    if payload.get("purpose") != TERMINAL_TOKEN_PURPOSE:
        return None

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
