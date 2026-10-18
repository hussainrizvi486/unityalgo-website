
import time

from app.config import settings
from app.terminal.auth import verify_hs256

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

    if str(payload.get("deploymentId")) != str(deployment_id):
        return None

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
