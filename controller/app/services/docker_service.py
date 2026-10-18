
import json
import shlex

from app.config import settings
from app.errors import NodeUnreachableError
from app.services.ssh_service import SSHService


class DockerService:
    """Runs `docker` on one ServerNode over SSH for one tenant container."""

    def __init__(self, server, config=None):
        self.server = server
        self.settings = config or settings
        self.ssh = SSHService(server, self.settings)

    # ------------------------------------------------------------------
    @staticmethod
    def _swap_limit_mb(memory_mb):
        """docker update rejects memory > memory-swap, so always widen swap."""
        return max(memory_mb * 2, memory_mb + 128)

    def _run_or_raise(self, command, action):
        result = self.ssh.run(command)
        if result.missing_binary:
            raise NodeUnreachableError(
                f"Docker is not installed on node '{self.server.name}'"
            )
        if not result.ok:
            raise NodeUnreachableError(
                f"docker {action} failed on '{self.server.name}': "
                f"{result.stderr or result.stdout or 'unknown error'}"
            )
        return result

    # ------------------------------------------------------------------
    def run_container(self, spec):
        if self.exists(spec["name"]):
            self.remove(spec["name"], force=True)

        memory_mb = int(str(spec["mem_limit"]).rstrip("m"))
        cpus = spec["nano_cpus"] / 1_000_000_000

        args = [
            "docker", "run", "-d",
            "--name", spec["name"],
            "--network", spec["network"],
            "--memory", f"{memory_mb}m",
            "--memory-swap", f"{self._swap_limit_mb(memory_mb)}m",
            "--cpus", f"{cpus:.2f}",
            "--restart", spec.get("restart_policy", {}).get("Name", "unless-stopped"),
        ]
        if spec.get("host_port"):
            bind_ip = spec.get("bind_ip")
            if not bind_ip:
                raise NodeUnreachableError(
                    f"Refusing to publish a tenant port on node "
                    f"'{self.server.name}' without an explicit bind address -- "
                    "binding 0.0.0.0 would expose it on every interface"
                )
            container_port = spec.get("container_port", 3000)
            args += ["-p", f"{bind_ip}:{spec['host_port']}:{container_port}"]
        for dns in spec.get("dns", []):
            args += ["--dns", dns]
        for key, value in spec.get("environment", {}).items():
            args += ["-e", f"{key}={value}"]
        for key, value in spec.get("labels", {}).items():
            args += ["-l", f"{key}={value}"]
        args.append(spec["image"])

        command = " ".join(shlex.quote(a) for a in args)
        result = self._run_or_raise(command, "run")
        return result.stdout.strip()

    def file_exists_in_image(self, image, path):
        result = self.ssh.run(
            f"docker run --rm --entrypoint sh {shlex.quote(image)} "
            f"-c {shlex.quote(f'test -e {path}')}"
        )
        return result.ok

    def run_once(self, image, command, environment=None, timeout=300, stdin_data=None):
        args = ["docker", "run", "--rm", "--network", self.settings.tenant_network]
        if stdin_data is not None:
            args.append("-i")
        for dns in self.settings.tenant_dns_servers:
            args += ["--dns", dns]
        for key, value in (environment or {}).items():
            args += ["-e", f"{key}={value}"]
        args.append(image)
        rendered = " ".join(shlex.quote(a) for a in args) + f" {command}"

        result = self.ssh.run(rendered, timeout=timeout, stdin_data=stdin_data)
        if result.missing_binary:
            raise NodeUnreachableError(
                f"Docker is not installed on node '{self.server.name}'"
            )
        return result

    def image_exists(self, image):
        """True when the image is already present in the node's local store."""
        result = self.ssh.run(f"docker image inspect {shlex.quote(image)}")
        if result.missing_binary:
            raise NodeUnreachableError(
                f"Docker is not installed on node '{self.server.name}'"
            )
        return result.ok

    def pull_image(self, image, timeout=600):
        """Download an image onto the node. Slow, so it gets a long timeout."""
        result = self.ssh.run(f"docker pull {shlex.quote(image)}", timeout=timeout)
        if result.missing_binary:
            raise NodeUnreachableError(
                f"Docker is not installed on node '{self.server.name}'"
            )
        if not result.ok:
            raise NodeUnreachableError(
                f"docker pull {image} failed on '{self.server.name}': "
                f"{result.stderr or result.stdout or 'unknown error'}"
            )
        return result

    def image_digest(self, image):
        result = self.ssh.run(
            f"docker image inspect --format '{{{{.Id}}}}' {shlex.quote(image)}"
        )
        return result.stdout.strip() if result.ok else None

    def image_size(self, image):
        result = self.ssh.run(
            f"docker image inspect --format '{{{{.Size}}}}' {shlex.quote(image)}"
        )
        if result.ok and result.stdout.strip().isdigit():
            return int(result.stdout.strip())
        return None

    def inspect(self, name):
        result = self.ssh.run(f"docker inspect --format '{{{{json .State}}}}' {shlex.quote(name)}")
        if not result.ok:
            return None
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            return None

    def exists(self, name):
        return self.inspect(name) is not None

    def stop(self, name, timeout=10):
        self._run_or_raise(
            f"docker stop -t {int(timeout)} {shlex.quote(name)}", "stop"
        )

    def start(self, name):
        self._run_or_raise(f"docker start {shlex.quote(name)}", "start")

    def restart(self, name, timeout=10):
        self._run_or_raise(
            f"docker restart -t {int(timeout)} {shlex.quote(name)}", "restart"
        )

    def remove(self, name, force=True):
        flag = "-f " if force else ""
        result = self.ssh.run(f"docker rm {flag}{shlex.quote(name)}")
        # "No such container" is fine -- the end state (gone) is what we want.
        if not result.ok and "No such container" not in result.stderr:
            raise NodeUnreachableError(
                f"docker rm failed on '{self.server.name}': {result.stderr}"
            )

    def update_resources(self, name, memory_mb, cpu_cores):
        """Live-resize a running container's memory and CPU limits."""
        swap_mb = self._swap_limit_mb(memory_mb)
        command = (
            f"docker update --memory {memory_mb}m --memory-swap {swap_mb}m "
            f"--cpus {float(cpu_cores):.2f} {shlex.quote(name)}"
        )
        self._run_or_raise(command, "update")

    def stats(self, name):
        """One-shot resource usage snapshot (no streaming)."""
        result = self.ssh.run(
            f"docker stats --no-stream --format '{{{{json .}}}}' {shlex.quote(name)}"
        )
        if not result.ok:
            raise NodeUnreachableError(
                f"docker stats failed on '{self.server.name}': {result.stderr}"
            )
        try:
            return json.loads(result.stdout.strip().splitlines()[-1])
        except (json.JSONDecodeError, IndexError):
            return None

    def logs(self, name, tail=200):
        result = self.ssh.run(f"docker logs --tail {int(tail)} {shlex.quote(name)} 2>&1")
        return result.stdout
