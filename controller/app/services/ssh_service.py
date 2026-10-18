
import io
import json
import socket
import time
from contextlib import contextmanager
from pathlib import Path

import paramiko

from app.config import settings
from app.errors import NodeUnreachableError
from app.services import crypto


class CommandResult:
    """One remote command's outcome."""

    def __init__(self, command, exit_code, stdout, stderr):
        self.command = command
        self.exit_code = exit_code
        self.stdout = stdout.strip()
        self.stderr = stderr.strip()

    @property
    def ok(self):
        return self.exit_code == 0

    @property
    def missing_binary(self):
        """127 is the shell's "command not found"."""
        return self.exit_code == 127

    def to_dict(self):
        return {
            "command": self.command,
            "exit_code": self.exit_code,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "ok": self.ok,
        }

    def __repr__(self):
        return f"<CommandResult {self.command!r} exit={self.exit_code}>"


class SSHService:

    def __init__(self, server, config=None):
        self.server = server
        self.settings = config or settings

    # ------------------------------------------------------------------
    @property
    def host(self):
        return self.server.ip_address

    @property
    def port(self):
        return self.server.ssh_port or self.settings.ssh_port

    @property
    def username(self):
        return self.server.ssh_user or self.settings.ssh_user

    @property
    def password(self):
        return self.server.ssh_password or self.settings.ssh_password or None

    @property
    def key_path(self):
        raw = self.server.ssh_key_path or self.settings.ssh_key_path
        if not raw:
            return None
        path = Path(raw).expanduser()
        return str(path) if path.exists() else None

    @property
    def key_content(self):
        """Decrypted pasted key content, in-memory only -- never written to disk."""
        if not self.server.ssh_key_encrypted:
            return None
        return crypto.decrypt(self.server.ssh_key_encrypted, self.settings)

    @property
    def auth_method(self):
        method = getattr(self.server, "ssh_auth_method", None)
        if method == "key" and (self.key_content or self.key_path):
            return "key"
        if method == "password" and self.password:
            return "password"
        # Legacy/incomplete data: fall back to whichever credential exists.
        if self.password:
            return "password"
        if self.key_content or self.key_path:
            return "key"
        return "none"

    def _load_pkey(self):
        content = self.key_content
        for key_class in (paramiko.RSAKey, paramiko.Ed25519Key, paramiko.ECDSAKey):
            try:
                return key_class.from_private_key(io.StringIO(content))
            except paramiko.SSHException:
                continue
        raise NodeUnreachableError(
            f"Stored SSH key for '{self.server.name}' could not be parsed"
        )

    def host_key_policy(self):
        if self.settings.ssh_host_key_policy == "reject":
            return paramiko.RejectPolicy()
        # Local VMs are rebuilt constantly, so their host keys churn.
        return paramiko.AutoAddPolicy()

    # ------------------------------------------------------------------
    @contextmanager
    def connect(self):
        if self.auth_method == "none":
            raise NodeUnreachableError(
                f"Node '{self.server.name}' has neither an SSH password nor a "
                "readable key file configured"
            )

        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(self.host_key_policy())
        try:
            pkey = self._load_pkey() if (self.auth_method == "key" and self.key_content) else None
            self._connect_with_retry(client, pkey)
            yield client
        except paramiko.AuthenticationException:
            raise NodeUnreachableError(
                f"SSH authentication failed for {self.username}@{self.host}:{self.port} "
                f"using {self.auth_method} auth"
            )
        except (paramiko.SSHException, socket.error, OSError) as exc:
            raise NodeUnreachableError(
                f"Cannot reach {self.username}@{self.host}:{self.port} -- {exc}"
            )
        finally:
            client.close()

    CONNECT_ATTEMPTS = 3
    CONNECT_BACKOFF_SECONDS = (1.0, 3.0)

    def _connect_with_retry(self, client, pkey):
        for attempt in range(self.CONNECT_ATTEMPTS):
            try:
                client.connect(
                    hostname=self.host,
                    port=self.port,
                    username=self.username,
                    password=self.password,
                    pkey=pkey,
                    key_filename=self.key_path if (self.auth_method == "key" and not pkey) else None,
                    look_for_keys=self.auth_method == "key",
                    allow_agent=self.auth_method == "key",
                    timeout=self.settings.ssh_timeout,
                    auth_timeout=self.settings.ssh_timeout,
                )
                return
            except (paramiko.SSHException, socket.error, OSError):
                if attempt == self.CONNECT_ATTEMPTS - 1:
                    raise
                time.sleep(self.CONNECT_BACKOFF_SECONDS[min(attempt, len(self.CONNECT_BACKOFF_SECONDS) - 1)])

    def run(self, command, timeout=None, stdin_data=None):
        with self.connect() as client:
            return self._exec(client, command, timeout, stdin_data=stdin_data)

    def run_many(self, commands, timeout=None):
        """Run several commands over a single connection."""
        with self.connect() as client:
            return [self._exec(client, command, timeout) for command in commands]

    def _exec(self, client, command, timeout=None, stdin_data=None):
        stdin, stdout, stderr = client.exec_command(
            command, timeout=timeout or self.settings.ssh_command_timeout
        )
        if stdin_data is not None:
            stdin.write(stdin_data)
            stdin.flush()
            stdin.channel.shutdown_write()
        exit_code = stdout.channel.recv_exit_status()
        return CommandResult(
            command,
            exit_code,
            stdout.read().decode("utf-8", "replace"),
            stderr.read().decode("utf-8", "replace"),
        )

    def _sudo_exec(self, client, command, timeout=None):
        if self.password:
            stdin, stdout, stderr = client.exec_command(
                f"sudo -S -p '' -- {command}",
                timeout=timeout or self.settings.ssh_command_timeout,
            )
            stdin.write(self.password + "\n")
            stdin.flush()
        else:
            _, stdout, stderr = client.exec_command(
                f"sudo -n -- {command}",
                timeout=timeout or self.settings.ssh_command_timeout,
            )
        exit_code = stdout.channel.recv_exit_status()
        return CommandResult(
            command,
            exit_code,
            stdout.read().decode("utf-8", "replace"),
            stderr.read().decode("utf-8", "replace"),
        )

    def run_sudo(self, command, timeout=None):
        with self.connect() as client:
            return self._sudo_exec(client, command, timeout)

    def check(self):
        """Phase-1 acceptance probe: identity, OS and Docker availability."""
        whoami, hostname, uname, docker = self.run_many(
            ["whoami", "hostname", "uname -sr", "docker --version"]
        )
        return {
            "reachable": True,
            "host": self.host,
            "port": self.port,
            "auth_method": self.auth_method,
            "user": whoami.stdout,
            "hostname": hostname.stdout,
            "os": uname.stdout,
            "docker_installed": docker.ok,
            "docker_version": docker.stdout if docker.ok else None,
            "docker_error": None
            if docker.ok
            else (docker.stderr or "docker not found"),
        }

    def port_in_use(self, port):
        result = self.run(f"ss -ltnH 'sport = :{int(port)}'")
        return result.ok and bool(result.stdout.strip())

    def listening_ports(self):
        """All TCP ports currently listening on the node."""
        result = self.run(
            "ss -ltnH | awk '{print $4}' | sed 's/.*://' | sort -un"
        )
        if not result.ok:
            return set()
        return {int(p) for p in result.stdout.split() if p.isdigit()}

    def collect_specs(self):
        """Hardware/OS facts for the node, used by ServerController.connect()."""
        cpu, mem, disk, os_release, kernel, arch, docker = self.run_many(
            [
                "nproc",
                "free -m | awk '/Mem:/ {print $2}'",
                "df -BG / | awk 'NR==2 {print $2\" \"$3}'",
                '. /etc/os-release && echo "$PRETTY_NAME"',
                "uname -r",
                "uname -m",
                "docker --version",
            ]
        )
        disk_total = disk_used = None
        if disk.ok and disk.stdout:
            parts = disk.stdout.replace("G", "").split()
            if len(parts) == 2 and all(p.isdigit() for p in parts):
                disk_total, disk_used = int(parts[0]), int(parts[1])

        return {
            "cpu_cores": int(cpu.stdout) if cpu.ok and cpu.stdout.isdigit() else None,
            "memory_total_mb": (
                int(mem.stdout) if mem.ok and mem.stdout.isdigit() else None
            ),
            "disk_total_gb": disk_total,
            "disk_used_gb": disk_used,
            "os_name": os_release.stdout if os_release.ok else None,
            "kernel_version": kernel.stdout if kernel.ok else None,
            "architecture": arch.stdout if arch.ok else None,
            "docker_installed": docker.ok,
            "docker_version": docker.stdout if docker.ok else None,
        }

    def update_server(self, on_step=None):
        steps = [("Updating the packages", "sudo apt-get update -y"), ("Upgrading the packages", "sudo apt upgrade -y")]
        results = []
        
        with self.connect() as client:
            for label, command in steps:
                result = self._sudo_exec(client, command)
                results.append(result)
                if on_step:
                    on_step(label, result)
                if not result.ok:
                    break

        return results

    def bootstrap_docker(self, on_step=None):
        steps = [
            ("Refreshing package index", "sudo apt-get update -y"),
            (
                "Installing prerequisites",
                "env DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl",
            ),
            ("Creating keyrings directory", "install -m 0755 -d /etc/apt/keyrings"),
            (
                "Downloading Docker's GPG key",
                "curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc",
            ),
            ("Setting key permissions", "chmod a+r /etc/apt/keyrings/docker.asc"),
            (
                "Adding Docker apt repository",
                "sh -c 'echo \"deb [arch=$(dpkg --print-architecture) "
                "signed-by=/etc/apt/keyrings/docker.asc] "
                "https://download.docker.com/linux/ubuntu "
                '$(. /etc/os-release && echo \\"${UBUNTU_CODENAME:-$VERSION_CODENAME}\\") stable" '
                "> /etc/apt/sources.list.d/docker.list'",
            ),
            ("Refreshing package index", "apt-get update -y"),
            (
                "Installing Docker Engine",
                "env DEBIAN_FRONTEND=noninteractive apt-get install -y "
                "docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin",
            ),
            ("Enabling Docker service", "systemctl enable --now docker"),
            (
                f"Adding '{self.username}' to docker group",
                f"usermod -aG docker {self.username}",
            ),
            (
                f"Creating '{self.settings.tenant_network}' network",
                f"sh -c 'docker network inspect {self.settings.tenant_network} >/dev/null 2>&1 "
                f"|| docker network create {self.settings.tenant_network}'",
            ),
        ]
        results = []
        with self.connect() as client:
            for label, command in steps:
                result = self._sudo_exec(client, command)
                results.append(result)
                if on_step:
                    on_step(label, result)
                if not result.ok:
                    break
        return results

    def bootstrap_caddy(self, on_step=None):
        steps = [
            (
                "Creating Caddy config/data directories",
                "install -m 0755 -d /etc/caddy/config /etc/caddy/data",
            ),
            (
                "Writing bootstrap admin-API config",
                "sh -c 'echo \"{\\\"admin\\\":{\\\"listen\\\":\\\"127.0.0.1:2019\\\"}}\" "
                "> /etc/caddy/config/caddy.json'",
            ),
            (
                "Removing any existing Caddy container",
                "sh -c 'docker rm -f caddy >/dev/null 2>&1 || true'",
            ),
            (
                "Starting Caddy",
                "docker run -d --name caddy --network host --restart unless-stopped "
                "-v /etc/caddy/config:/config -v /etc/caddy/data:/data "
                "caddy:2-alpine caddy run --config /config/caddy.json",
            ),
            ("Verifying Caddy is running", "docker exec caddy caddy version"),
        ]
        results = []
        with self.connect() as client:
            for label, command in steps:
                result = self._sudo_exec(client, command)
                results.append(result)
                if on_step:
                    on_step(label, result)
                if not result.ok:
                    break
        return results

    def apply_tenant_port_firewall(self, proxy_ip, port_start, port_end, on_step=None):
        marker = "controller-tenant-port-lockdown"
        port_range = f"{port_start}:{port_end}"
        established_rule = (
            f"-m conntrack --ctstate ESTABLISHED,RELATED "
            f"-m comment --comment {marker} -j RETURN"
        )
        drop_rule = (
            f"-p tcp -m conntrack --ctorigdstport {port_range} "
            f"-m comment --comment {marker} -j DROP"
        )
        allow_rule = (
            f"-p tcp -m conntrack --ctorigdstport {port_range} -s {proxy_ip} "
            f"-m comment --comment {marker} -j RETURN"
        )

        def remove_step(rule):
            return f"sh -c 'while iptables -D DOCKER-USER {rule} 2>/dev/null; do :; done'"

        steps = [
            (
                "Ensuring DOCKER-USER chain exists",
                "sh -c 'iptables -N DOCKER-USER 2>/dev/null || true'",
            ),
            ("Removing any previous established-traffic rule", remove_step(established_rule)),
            ("Removing any previous deny-by-default rule", remove_step(drop_rule)),
            ("Removing any previous proxy-allow rule", remove_step(allow_rule)),
            ("Adding deny-by-default rule", f"iptables -I DOCKER-USER {drop_rule}"),
            (
                f"Allowing proxy ({proxy_ip}) through",
                f"iptables -I DOCKER-USER {allow_rule}",
            ),
            (
                "Allowing established/related traffic through",
                f"iptables -I DOCKER-USER {established_rule}",
            ),
        ]
        results = []
        with self.connect() as client:
            for label, command in steps:
                result = self._sudo_exec(client, command)
                results.append(result)
                if on_step:
                    on_step(label, result)
                if not result.ok:
                    break
        return results

    def docker_ps(self, all_containers=False):
        """Containers on the node, parsed from `docker ps --format '{{json .}}'`."""
        flags = "-a " if all_containers else ""
        result = self.run(f"docker ps {flags}--format '{{{{json .}}}}'")
        if result.missing_binary:
            raise NodeUnreachableError(
                f"Docker is not installed on node '{self.server.name}'"
            )
        if not result.ok:
            raise NodeUnreachableError(
                f"docker ps failed on '{self.server.name}': "
                f"{result.stderr or result.stdout or 'unknown error'}"
            )
        containers = []
        for line in result.stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                containers.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return containers
