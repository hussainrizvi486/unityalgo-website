
import time

from app.config import settings as default_settings
from app.services.ssh_service import SSHService

RETRY_BACKOFF_SECONDS = (1, 2, 3, 3, 3, 5, 5, 5, 8, 8)  # ~45s worst case


class HealthCheckService:
    def __init__(self, config=None):
        self.settings = config or default_settings

    def probe(self, proxy, deployment, path="/"):
        ssh = SSHService(proxy, self.settings)
        for delay in (0, *RETRY_BACKOFF_SECONDS):
            if delay:
                time.sleep(delay)
            if self._attempt(ssh, deployment, path):
                return True
        return False

    def probe_once(self, proxy, deployment, path="/"):
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
