"""Talks to Caddy's admin API on a role='proxy' node.

The admin API binds 127.0.0.1:2019 on the proxy node and is never exposed
publicly. Reached the same way DockerService reaches a node's Docker CLI --
over SSH -- but here via a Paramiko `direct-tcpip` channel (genuinely new to
this codebase; confirmed unused anywhere else) rather than `exec_command`,
since this needs to speak HTTP, not run a shell command. No new dependency:
stdlib `http.client` with its socket swapped for the tunnel channel.
"""

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
        """One SSH connection + tunneled HTTP connection, per call -- matches
        how every other SSH-backed service in this codebase already works
        (no connection pooling exists anywhere else either)."""
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
            # Port must be explicit: Caddy's admin API checks the request's
            # Host header against its configured origins (default includes
            # the port, e.g. "127.0.0.1:2019") -- a bare "127.0.0.1" Host
            # header (what HTTPConnection sends without an explicit port)
            # gets rejected with "host not allowed".
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
        """GET /config/<path> -- the live config Caddy is currently running.

        Caddy's config routes are subtree-based and 307-redirect a bare
        `/config` (no trailing slash) to `/config/` -- http.client doesn't
        follow redirects on its own, so the trailing slash is mandatory here,
        not cosmetic.
        """
        return self._request("GET", f"/config/{path}")

    def load(self, document):
        """POST /load -- replaces the entire running config in one call.

        The only write operation this client needs: ProxyConfigurationService
        always renders and pushes the full desired-state document rather than
        doing partial route upserts (see the plan's simplification note).
        """
        return self._request("POST", "/load", body=document)
