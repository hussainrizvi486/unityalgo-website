"""Verifies the short-lived stream token minted by the Next.js admin panel.

Deliberately a near-copy of app/terminal/auth.py's `resolve_terminal_grant`
in shape, but bound to a *deployment* rather than a server and carrying its
own purpose string, so a token minted to watch one storefront's logs cannot
be replayed to open a root shell on the node that hosts it.

The signature check itself is imported, not reimplemented -- see
app/terminal/auth.verify_hs256.
"""

import time

from app.config import settings
from app.terminal.auth import verify_hs256

# Distinct from TERMINAL_TOKEN_PURPOSE. A grant is only ever accepted for the
# action it was minted for.
STREAM_TOKEN_PURPOSE = "controller-stream"

_CLOCK_SKEW_SECONDS = 30

# What a grant may watch. Anything else is rejected before the handshake.
STREAM_KINDS = ("logs", "stats")


class StreamGrant:
    """What the audit log needs to attribute the stream to a real admin."""

    def __init__(self, admin_email, deployment_id, kind):
        self.admin_email = admin_email
        self.deployment_id = deployment_id
        self.kind = kind

    def __repr__(self):
        return (
            f"<StreamGrant admin={self.admin_email} "
            f"deployment={self.deployment_id} kind={self.kind}>"
        )


def resolve_stream_grant(token, deployment_id, kind):
    """Token -> a grant snapshot, or None if it does not authorise this stream."""
    if not token or kind not in STREAM_KINDS:
        return None

    payload = verify_hs256(token, settings.session_signing_secret)
    if not payload:
        return None

    if payload.get("purpose") != STREAM_TOKEN_PURPOSE:
        return None

    # Bound to one deployment: a grant for tenant A's container must not tail
    # tenant B's logs, which would leak another customer's order data.
    if str(payload.get("deploymentId")) != str(deployment_id):
        return None

    # A logs grant must not be reused to stream stats, and vice versa. Cheap
    # to enforce, and keeps the token's meaning exactly what it says.
    if payload.get("kind") != kind:
        return None

    now = time.time()
    exp = payload.get("exp")
    if not isinstance(exp, (int, float)) or now > exp + _CLOCK_SKEW_SECONDS:
        return None

    nbf = payload.get("nbf")
    if isinstance(nbf, (int, float)) and now < nbf - _CLOCK_SKEW_SECONDS:
        return None

    return StreamGrant(
        admin_email=payload.get("adminEmail") or "unknown",
        deployment_id=str(payload.get("deploymentId")),
        kind=kind,
    )
