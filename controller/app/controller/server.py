import io
from datetime import datetime, timezone

import paramiko
from sqlalchemy import func, select, text, union_all, literal

from app.controller.base import BaseController
from app.errors import ConflictError, NodeUnreachableError, ValidationError
from app.models.activity import ActivityLog, Operation
from app.models.deployment import Deployment
from app.models.server import ServerNode, Tenant
from app.models.site import Site
from app.services import crypto
from app.services.ssh_service import SSHService


class ServerController(BaseController):
    """CRUD and capacity planning for worker VPS nodes."""

    model = ServerNode
    resource_name = "server"
    ROLES = ServerNode.ROLES

    # used_memory_mb / active_containers are deliberately absent: they are a
    # cache derived from deployments (see refresh_capacity) and must not be
    # settable through the API.
    writable_fields = (
        "name",
        "ip_address",
        "private_ip",
        "role",
        "proxy_admin_port",
        "ssh_port",
        "ssh_user",
        "ssh_key_path",
        "ssh_password",
        "ssh_key",
        "ssh_auth_method",
        "max_memory_mb",
        "max_containers",
        "max_sites",
        "is_active",
        "frappe_enabled",
    )
    SSH_AUTH_METHODS = ("password", "key")
    # DSA/DSSKey was removed from paramiko itself as of 5.0 (pinned in
    # requirements.txt) -- RSA/Ed25519/ECDSA is the full supported set.
    SSH_KEY_CLASSES = (paramiko.RSAKey, paramiko.Ed25519Key, paramiko.ECDSAKey)
    required_on_create = ("name", "ip_address")

    def clean(self, data, partial):
        self.check_payload(data, partial)
        v = self.validator
        values = {}
        if "frappe_enabled" in data:
            if not isinstance(data["frappe_enabled"], bool):
                raise ValidationError('frappe_enabled must be a boolean.')
            values["frappe_enabled"] = data["frappe_enabled"]

        if "name" in data:
            values["name"] = v.string(data["name"], "name", max_length=100)
        if "ip_address" in data:
            values["ip_address"] = v.ip_address(data["ip_address"], "ip_address")
        if "private_ip" in data:
            values["private_ip"] = (
                None
                if not data["private_ip"]
                else v.ip_address(data["private_ip"], "private_ip")
            )
        if "role" in data:
            values["role"] = v.choice(data["role"], "role", self.ROLES)
        if "proxy_admin_port" in data:
            values["proxy_admin_port"] = (
                None
                if data["proxy_admin_port"] is None
                else v.integer(
                    data["proxy_admin_port"], "proxy_admin_port", minimum=1, maximum=65535
                )
            )
        if "ssh_port" in data:
            values["ssh_port"] = v.integer(
                data["ssh_port"], "ssh_port", minimum=1, maximum=65535
            )
        if "ssh_user" in data:
            values["ssh_user"] = v.string(data["ssh_user"], "ssh_user", max_length=50)
        if "ssh_key_path" in data:
            values["ssh_key_path"] = (
                None
                if data["ssh_key_path"] is None
                else v.string(data["ssh_key_path"], "ssh_key_path", max_length=255)
            )
        if "ssh_password" in data:
            values["ssh_password"] = (
                None
                if data["ssh_password"] is None
                else v.string(data["ssh_password"], "ssh_password", max_length=255)
            )
        if "ssh_auth_method" in data:
            values["ssh_auth_method"] = v.choice(
                data["ssh_auth_method"], "ssh_auth_method", self.SSH_AUTH_METHODS
            )
        # An empty/omitted key on update means "keep the existing one" -- only
        # validate+encrypt+store when non-empty content was actually sent.
        if data.get("ssh_key"):
            raw = v.string(data["ssh_key"], "ssh_key", max_length=16384)
            self._validate_private_key(raw)
            values["ssh_key_encrypted"] = crypto.encrypt(raw, self.settings)
        if "max_memory_mb" in data:
            values["max_memory_mb"] = v.integer(
                data["max_memory_mb"], "max_memory_mb", minimum=0
            )
        if "max_containers" in data:
            values["max_containers"] = v.integer(
                data["max_containers"], "max_containers", minimum=0
            )
        if "max_sites" in data:
            # Blank clears the limit; otherwise a whole number, where 0 means "no new sites".
            values["max_sites"] = None if data["max_sites"] in (None, "") else v.integer(
                data["max_sites"], "max_sites", minimum=0
            )
        if "is_active" in data:
            values["is_active"] = v.boolean(data["is_active"], "is_active")
        return values

    def _validate_private_key(self, raw):
        """Parse-check pasted key content at submit time, not first-connect time.

        Passphrase-protected keys are out of scope for v1 (no passphrase
        field); a protected key fails every class below and surfaces the
        same "not recognized" error as garbage input.
        """
        for key_class in self.SSH_KEY_CLASSES:
            try:
                key_class.from_private_key(io.StringIO(raw))
                return
            except paramiko.SSHException:
                continue
        raise ValidationError(
            "'ssh_key' is not a recognized unencrypted private key "
            "(RSA, Ed25519, and ECDSA are supported; passphrase-protected "
            "keys are not)",
            field="ssh_key",
        )

    def before_update(self, instance, values):
        if "ssh_auth_method" in values:
            if values["ssh_auth_method"] == "password":
                values.setdefault("ssh_key_encrypted", None)
            else:
                values.setdefault("ssh_password", None)

    def apply_defaults(self, values):
        values.setdefault("ssh_user", self.settings.ssh_user)
        values.setdefault("ssh_port", self.settings.ssh_port)
        values.setdefault("ssh_key_path", self.settings.ssh_key_path)
        values.setdefault("ssh_auth_method", "password")
        values.setdefault("role", "worker")
        # Without a distinct private address, tenant ports are published on
        # whatever `ip_address` is. Fine for a private/local network; on a
        # public VPS set private_ip explicitly.
        values.setdefault("private_ip", values.get("ip_address"))
        # Only fall back to the global dev password when key auth wasn't
        # explicitly chosen -- otherwise a server created with a pasted key
        # ends up with a stored password it was never meant to have.
        if self.settings.ssh_password and values["ssh_auth_method"] == "password":
            values.setdefault("ssh_password", self.settings.ssh_password)
        return values

    # ------------------------------------------------------------------
    # SSH operations
    # ------------------------------------------------------------------
    def ssh(self, server):
        return SSHService(server, self.settings)

    def log_context(self, server):
        return {"server_id": server.id, "server_name": server.name}

    def check_connection(self, server_id):
        """Connect over SSH and report identity, OS and Docker availability."""
        server = self.get(server_id)
        report = self.ssh(server).check()
        report["node"] = {"id": str(server.id), "name": server.name}
        return report

    # ------------------------------------------------------------------
    def create(self, data):
        """Register a worker node, logging each stage."""
        requested = data.get("name") if isinstance(data, dict) else None
        with self.activity.operation(
            "server.create", f"Server registration: {requested or 'new node'}",
            category="server",
        ) as op:
            op.ok("Server registration started", message=f"Requested name: {requested}")

            values = self.clean(data, partial=False)
            op.ok(
                "Server details validated",
                message=f"{values['name']} at {values['ip_address']}",
                details={"name": values["name"], "ip_address": values["ip_address"]},
            )

            values = self.apply_defaults(values)
            op.ok(
                "Connection settings resolved",
                message=(
                    f"{values['ssh_user']}@{values['ip_address']}:{values['ssh_port']} "
                    f"({'password' if values.get('ssh_password') else 'key'} auth)"
                ),
                details={
                    "ssh_user": values["ssh_user"],
                    "ssh_port": values["ssh_port"],
                    "auth_method": "password" if values.get("ssh_password") else "key",
                    "max_memory_mb": values.get("max_memory_mb"),
                    "max_containers": values.get("max_containers"),
                },
            )

            server = self.model(**values)
            self.session.add(server)
            self.flush(self.conflict_message(values))

            op.bind(**self.log_context(server))
            op.ok(
                "Server record created",
                message=f"Server id {server.id}",
                details={"server_id": str(server.id)},
            )
            op.ok(
                "Registration completed",
                message="Run Connect to collect specs, then Install Docker if needed",
            )
            return server

    def connect(self, server_id, recorder=None):
        """Full connect flow for a registered node: SSH in, collect hardware
        and OS specs, persist them. This is what "connecting" a server means
        for the platform -- after this the node's specs are up to date for
        capacity planning and the admin dashboard.

        `recorder` lets a surrounding operation (e.g. bootstrap) absorb these
        steps into its own timeline instead of opening a nested operation.
        """
        server = self.get(server_id)
        if recorder is not None:
            return self._connect_steps(server, recorder)

        with self.activity.operation(
            "server.connect", f"Server connect: {server.name}",
            category="server", **self.log_context(server),
        ) as op:
            return self._connect_steps(server, op)

    def _connect_steps(self, server, op):
        ssh = self.ssh(server)
        op.started(
            "Connecting to server",
            message=f"SSH {server.ssh_user}@{server.ip_address}:{server.ssh_port}",
            details={"auth_method": ssh.auth_method},
        )
        try:
            specs = ssh.collect_specs()
        except NodeUnreachableError as exc:
            server.last_checked_at = datetime.now(timezone.utc)
            server.last_check_status = "unreachable"
            self.session.flush()
            op.fail("Server connection failed", exc)
            raise

        op.ok(
            "Server connection established",
            message=f"{specs['os_name']} ({specs['architecture']})",
        )
        op.ok(
            "Hardware and OS specs collected",
            message=(
                f"{specs['cpu_cores']} vCPU, {specs['memory_total_mb']}MB RAM, "
                f"{specs['disk_used_gb']}/{specs['disk_total_gb']}GB disk"
            ),
            details=specs,
        )

        server.cpu_cores = specs["cpu_cores"]
        if specs["memory_total_mb"]:
            server.max_memory_mb = specs["memory_total_mb"]
        server.disk_total_gb = specs["disk_total_gb"]
        server.disk_used_gb = specs["disk_used_gb"]
        server.os_name = specs["os_name"]
        server.kernel_version = specs["kernel_version"]
        server.architecture = specs["architecture"]
        server.docker_version = specs["docker_version"]
        server.last_checked_at = datetime.now(timezone.utc)
        server.last_check_status = "ok" if specs["docker_installed"] else "docker_missing"
        self.session.flush()

        if specs["docker_installed"]:
            op.ok("Docker environment verified", message=specs["docker_version"])
        else:
            op.warn(
                "Docker not installed",
                message="Run Install Docker before provisioning tenants here",
            )
        op.ok("Server specifications stored")
        return server, specs

    def bootstrap(self, server_id):
    
        server = self.get(server_id)
        with self.activity.operation(
            "server.bootstrap", f"Docker installation: {server.name}",
            category="server", **self.log_context(server),
        ) as op:
            op.ok(
                "Docker installation started",
                message=f"{server.ssh_user}@{server.ip_address}",
            )

            def on_step(label, result):
                detail = {
                    "command": result.command,
                    "exit_code": result.exit_code,
                    "stdout_tail": result.stdout[-500:] if result.stdout else None,
                }
                if result.ok:
                    op.ok(label, message=f"exit {result.exit_code}", details=detail)
                else:
                    op.step(
                        label, status="failed",
                        message=f"exit {result.exit_code}",
                        error=result.stderr or result.stdout or "command failed",
                        details=detail,
                    )

            results = self.ssh(server).bootstrap_docker(on_step=on_step)
            ok = all(r.ok for r in results)
            if not ok:
                failed = next(r for r in results if not r.ok)
                op.step(
                    "Docker installation failed",
                    status="failed",
                    message=failed.command,
                    error=failed.stderr or failed.stdout,
                )
            else:
                op.ok("Docker installed and enabled")

            _, specs = self.connect(server_id, recorder=op)
            op.ok(
                "Bootstrap completed",
                message=specs.get("docker_version") or "Docker not detected",
            )
            return {
                "steps": [r.to_dict() for r in results],
                "ok": ok,
                "specs": specs,
            }

    def bootstrap_caddy(self, server_id):
        """Installs and starts Caddy on a role='proxy' node. Assumes Docker
        is already installed (run bootstrap() first, same as any worker)."""
        server = self.get(server_id)
        with self.activity.operation(
            "server.bootstrap_caddy", f"Caddy installation: {server.name}",
            category="server", **self.log_context(server),
        ) as op:
            op.ok(
                "Caddy installation started",
                message=f"{server.ssh_user}@{server.ip_address}",
            )

            def on_step(label, result):
                detail = {
                    "command": result.command,
                    "exit_code": result.exit_code,
                    "stdout_tail": result.stdout[-500:] if result.stdout else None,
                }
                if result.ok:
                    op.ok(label, message=f"exit {result.exit_code}", details=detail)
                else:
                    op.step(
                        label, status="failed",
                        message=f"exit {result.exit_code}",
                        error=result.stderr or result.stdout or "command failed",
                        details=detail,
                    )

            results = self.ssh(server).bootstrap_caddy(on_step=on_step)
            ok = all(r.ok for r in results)
            if ok:
                op.ok("Caddy installed and running")
            else:
                failed = next(r for r in results if not r.ok)
                op.step(
                    "Caddy installation failed",
                    status="failed",
                    message=failed.command,
                    error=failed.stderr or failed.stdout,
                )
            return {"steps": [r.to_dict() for r in results], "ok": ok}

    def apply_firewall_lockdown(self, server_id):
        """Restricts this worker's tenant port range to the registered
        proxy's IP only, via the DOCKER-USER chain. Opt-in, explicit action
        -- not run automatically during bootstrap, since it changes what's
        reachable on a node that may already be serving live traffic.
        """
        server = self.get(server_id)
        if server.role != "worker":
            raise ConflictError(
                "Firewall lockdown applies to worker nodes, restricting them "
                "to proxy-only tenant traffic -- this node isn't a worker"
            )
        proxy = self.proxy_node()
        if proxy is None:
            raise ConflictError(
                "No proxy node is registered yet; lock down after Caddy is "
                "set up, or every tenant port on this node loses all access"
            )

        with self.activity.operation(
            "server.firewall_lockdown", f"Firewall lockdown: {server.name}",
            category="server", **self.log_context(server),
        ) as op:
            op.ok(
                "Lockdown started",
                message=f"Restricting ports {self.settings.tenant_port_range_start}-"
                f"{self.settings.tenant_port_range_end} to {proxy.ip_address}",
            )

            def on_step(label, result):
                if result.ok:
                    op.ok(label, message=f"exit {result.exit_code}")
                else:
                    op.step(
                        label, status="failed",
                        error=result.stderr or result.stdout or "command failed",
                    )

            results = self.ssh(server).apply_tenant_port_firewall(
                proxy.ip_address,
                self.settings.tenant_port_range_start,
                self.settings.tenant_port_range_end,
                on_step=on_step,
            )
            ok = all(r.ok for r in results)
            if ok:
                op.ok(
                    "Firewall lockdown applied",
                    message=f"Only {proxy.ip_address} can reach tenant ports on "
                    f"{server.name} now",
                )
            else:
                failed = next(r for r in results if not r.ok)
                op.step(
                    "Firewall lockdown failed",
                    status="failed",
                    error=failed.stderr or failed.stdout,
                )
            return {"steps": [r.to_dict() for r in results], "ok": ok}

    def containers(self, server_id, all_containers=False):
        server = self.get(server_id)
        return self.ssh(server).docker_ps(all_containers=all_containers)

    def conflict_message(self, values):
        name = values.get("name")
        if name:
            return f"A server node named '{name}' already exists"
        return "A server node with those details already exists"

    # ------------------------------------------------------------------
    def list(self, is_active=None, role=None, limit=50, offset=0):
        stmt = self.base_query()
        if is_active is not None:
            stmt = stmt.where(ServerNode.is_active.is_(is_active))
        if role is not None:
            stmt = stmt.where(
                ServerNode.role == self.validator.choice(role, "role", self.ROLES)
            )
        return self.paginate(stmt, limit, offset)

    def tenant_count(self, server):
        return self.session.scalar(
            select(func.count()).select_from(Tenant).where(Tenant.node_id == server.id)
        )

    def before_delete(self, server, force):
        """Refuse to delete a node that still runs deployments.

        `Deployment.server_id` is ON DELETE RESTRICT, so the rows must be torn
        down (not just detached) before the node can go. With `force` we mark
        the deployments removed and detach the legacy tenant pointer -- the
        containers themselves are unreachable once the node is gone.
        """
        active = self.deployment_count(server)
        if self.session.scalar(select(func.count()).select_from(Site).where(Site.server_id == server.id)):
            raise ConflictError('Frappe sites are assigned to this server. Recover or relocate those sites before removing the server.')
        if active:
            if not force:
                raise ConflictError(
                    f"Server node still runs {active} deployment(s); "
                    "migrate them or retry with ?force=true"
                )
            now = datetime.now(timezone.utc)
            self.session.execute(
                Deployment.__table__.update()
                .where(
                    Deployment.server_id == server.id,
                    Deployment.status.in_(Deployment.ACTIVE_STATUSES),
                )
                .values(status="removed", stopped_at=now, port_released_at=now)
            )

        # RESTRICT covers historical rows too, so repoint every remaining
        # deployment off the node before it is deleted.
        self.session.execute(
            Deployment.__table__.delete().where(Deployment.server_id == server.id)
        )
        self.session.execute(
            Tenant.__table__.update()
            .where(Tenant.node_id == server.id)
            .values(node_id=None, container_id=None)
        )

    def list_logs(self, server_id, limit=50, offset=0):
        server = self.get(server_id)
        stmt = select(ActivityLog).where(ActivityLog.server_id == server.id)
        total = self.session.scalar(select(func.count()).select_from(stmt.subquery()))
        rows = self.session.scalars(
            stmt.order_by(ActivityLog.created_at.desc(), ActivityLog.step_index.desc())
            .limit(limit)
            .offset(offset)
        ).all()
        return rows, total

    def list_operations(self, server_id, limit=20, offset=0):
        server = self.get(server_id)
        stmt = select(Operation).where(Operation.server_id == server.id)
        total = self.session.scalar(select(func.count()).select_from(stmt.subquery()))
        rows = self.session.scalars(
            stmt.order_by(Operation.started_at.desc()).limit(limit).offset(offset)
        ).all()
        return rows, total

    def node_load(self):
        """Per-node load derived from live deployments.

        `ServerNode.active_containers` / `used_memory_mb` are a cache refreshed
        by refresh_capacity(); placement reads the deployments table directly so
        a stale cache can never cause an overcommit.
        """
        allocations = union_all(
            select(Deployment.server_id.label('server_id'), Deployment.memory_limit_mb.label('memory'), literal(1).label('slots')).where(Deployment.status.in_(Deployment.ACTIVE_STATUSES)),
            select(Site.server_id.label('server_id'), Site.memory_limit_mb.label('memory'), Site.container_slots.label('slots')).where(Site.status.in_(Site.ACTIVE_STATUSES)),
        ).subquery()
        return (
            select(
                allocations.c.server_id.label("server_id"),
                func.sum(allocations.c.slots).label("containers"),
                func.coalesce(func.sum(allocations.c.memory), 0).label("used_mb"),
            )
            .group_by(allocations.c.server_id)
            .subquery()
        )

    def available_node(self, required_memory_mb=None):
        """Pick the least-loaded active worker node with room for a container."""
        required = required_memory_mb or self.settings.tenant_memory_limit_mb
        self.session.execute(text("SELECT pg_advisory_xact_lock(hashtext('customer-site-placement'))"))
        reserve = self.settings.node_memory_reserve_mb
        load = self.node_load()
        # OUTER JOIN + COALESCE: a node with no deployments must still be
        # eligible, and an inner join would silently exclude every empty node.
        containers = func.coalesce(load.c.containers, 0)
        used_mb = func.coalesce(load.c.used_mb, 0)
        free_mb = ServerNode.max_memory_mb - reserve - used_mb

        stmt = (
            select(ServerNode)
            .outerjoin(load, load.c.server_id == ServerNode.id)
            .where(
                ServerNode.is_active.is_(True),
                # Never place a storefront on the edge proxy.
                ServerNode.role == "worker",
                containers < ServerNode.max_containers,
                free_mb >= required,
            )
            .order_by(free_mb.desc(), containers.asc())
            .limit(1)
        )
        return self.session.scalars(stmt).first()

    def proxy_node(self):
        """The registered Caddy edge node, if any.

        Only one is expected in practice today; returns the first active one
        if somehow more than one is registered. None means Phase 2 routing
        isn't set up yet -- callers must treat that as "stay on IP:PORT",
        not as an error.
        """
        return self.session.scalars(
            select(ServerNode)
            .where(ServerNode.role == "proxy", ServerNode.is_active.is_(True))
            .order_by(ServerNode.created_at.asc())
            .limit(1)
        ).first()

    def capacity_report(self, required_memory_mb=None):
        """Per-node placement math, and why each node was or wasn't eligible.

        Used to turn "no node available" into an actionable message instead of
        making an operator go read the placement query.
        """
        required = required_memory_mb or self.settings.tenant_memory_limit_mb
        reserve = self.settings.node_memory_reserve_mb
        load = self.node_load()
        rows = self.session.execute(
            select(
                ServerNode,
                func.coalesce(load.c.containers, 0),
                func.coalesce(load.c.used_mb, 0),
            ).outerjoin(load, load.c.server_id == ServerNode.id)
        ).all()

        report = []
        for server, containers, used_mb in rows:
            free_mb = (server.max_memory_mb or 0) - reserve - int(used_mb or 0)
            reasons = []
            if not server.is_active:
                reasons.append("node is inactive")
            if server.role != "worker":
                reasons.append(f"role is '{server.role}', not 'worker'")
            if containers >= (server.max_containers or 0):
                reasons.append(
                    f"container slots full ({containers}/{server.max_containers})"
                )
            if free_mb < required:
                reasons.append(
                    f"only {free_mb}MB free (needs {required}MB): "
                    f"{server.max_memory_mb}MB total - {reserve}MB reserved "
                    f"- {int(used_mb)}MB allocated"
                )
            report.append(
                {
                    "server": server,
                    "name": server.name,
                    "eligible": not reasons,
                    "reasons": reasons,
                    "free_mb": free_mb,
                    "containers": int(containers),
                }
            )
        return report

    def placement_error(self, required_memory_mb=None):
        """A ConflictError explaining why no node could take a container."""
        required = required_memory_mb or self.settings.tenant_memory_limit_mb
        report = self.capacity_report(required)
        if not report:
            return ConflictError(
                "No server nodes are registered. Register a worker node first."
            )
        detail = "; ".join(
            f"{row['name']}: {', '.join(row['reasons'])}"
            for row in report
            if not row["eligible"]
        )
        return ConflictError(
            f"No worker node has room for a {required}MB container. {detail}"
        )

    def refresh_capacity(self, server):
        """Recompute the cached counters from live deployments."""
        load = self.node_load()
        containers, used_mb = self.session.execute(select(load.c.containers, load.c.used_mb).where(load.c.server_id == server.id)).first() or (0, 0)
        server.active_containers = int(containers or 0)
        server.used_memory_mb = int(used_mb or 0)
        self.session.flush()
        return server

    def deployment_count(self, server):
        """Active deployments on a node -- the real 'is it in use' signal."""
        return self.session.scalar(select(func.count()).select_from(Site).where(Site.server_id == server.id)) + self.session.scalar(
            select(func.count())
            .select_from(Deployment)
            .where(
                Deployment.server_id == server.id,
                Deployment.status.in_(Deployment.ACTIVE_STATUSES),
            )
        )
