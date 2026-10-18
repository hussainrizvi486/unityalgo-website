
import http.client
import json
from contextlib import contextmanager

from app.config import settings as default_settings
from app.errors import NodeUnreachableError, ProxyConfigurationError
from app.services.ssh_service import SSHService


class CaddyAdminClient:
    def __init__(self, server, config=None):
        self.server = server
        self.settings = config or default_settings
        self.ssh = SSHService(server, self.settings)

    @property
    def admin_port(self):
        return self.server.proxy_admin_port or self.settings.proxy_admin_port_default

    @contextmanager
    def _connection(self):
        with self.ssh.connect() as client:
            transport = client.get_transport()
            try:
                channel = transport.open_channel(
                    "direct-tcpip",
                    ("127.0.0.1", self.admin_port),
                    ("127.0.0.1", 0),
                    timeout=self.settings.ssh_timeout,
                )
            except Exception as exc:
                raise NodeUnreachableError(
                    f"Could not open a tunnel to Caddy's admin API on "
                    f"'{self.server.name}': {exc}"
                ) from exc
            conn = http.client.HTTPConnection("127.0.0.1", self.admin_port)
            conn.sock = channel
            try:
                yield conn
            finally:
                conn.close()

    def _request(self, method, path, body=None):
        payload = json.dumps(body).encode() if body is not None else None
        headers = {"Content-Type": "application/json"} if payload else {}
        with self._connection() as conn:
            conn.request(method, path, body=payload, headers=headers)
            response = conn.getresponse()
            raw = response.read()
        if response.status >= 400:
            message = raw.decode("utf-8", "replace").strip() or response.reason
            raise ProxyConfigurationError(
                f"Caddy admin API {method} {path} on '{self.server.name}' "
                f"returned {response.status}: {message}"
            )
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw.decode("utf-8", "replace")

    def get_config(self, path=""):
        return self._request("GET", f"/config/{path}")

    def load(self, document):
        return self._request("POST", "/load", body=document)
