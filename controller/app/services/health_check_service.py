"""Probes a deployment from the proxy node's own vantage point.

Deliberately not probed from the worker (validates the app, not the path
traffic actually takes) or from the controller/Mac (not in the request path
at all) -- only the proxy validates the thing that matters: can it reach and
get a healthy response from this deployment.
"""

import time

from app.config import settings as default_settings
from app.services.ssh_service import SSHService

RETRY_BACKOFF_SECONDS = (1, 2, 3, 3, 3, 5, 5, 5, 8, 8)  # ~45s worst case


class HealthCheckService:
    def __init__(self, config=None):
        self.settings = config or default_settings

    def probe(self, proxy, deployment, path="/"):
        """True once `deployment.upstream` answers 2xx/3xx from the proxy's
        own network position, retried with backoff. False if it never does."""
        ssh = SSHService(proxy, self.settings)
        for delay in (0, *RETRY_BACKOFF_SECONDS):
            if delay:
                time.sleep(delay)
            if self._attempt(ssh, deployment, path):
                return True
        return False

    def probe_once(self, proxy, deployment, path="/"):
        """Single-attempt variant of probe(), no retry/backoff.

        For the periodic fleet-wide health sweep (app/tasks/health_tasks.py):
        probe()'s ~45s worst case is fine for gating one new deployment at
        provision/migrate time, but not affordable per-domain across a whole
        fleet every few minutes -- a transient miss here just gets caught on
        the next sweep cycle anyway.
        """
        return self._attempt(SSHService(proxy, self.settings), deployment, path)

    def _attempt(self, ssh, deployment, path):
        timeout = self.settings.proxy_health_check_timeout_seconds
        url = f"http://{deployment.upstream}{path}"
        command = (
            f"curl -s -o /dev/null -w '%{{http_code}}' --max-time {timeout} '{url}'"
        )
        result = ssh.run(command, timeout=timeout + 5)
        code = result.stdout.strip()
        return result.ok and code.isdigit() and 200 <= int(code) < 400
