
import shlex
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from app.controller.base import BaseController
from app.errors import ConflictError, NodeUnreachableError, NotFoundError
from app.services import cluster_resolver
from app.models.deployment import Deployment
from app.models.server import ServerNode
from app.services.docker_service import DockerService
from app.services.port_allocator import allocate_port
from app.services.ssh_service import SSHService


class DeploymentController(BaseController):
    model = Deployment
    resource_name = "deployment"
    STATUSES = Deployment.STATUSES
    ACTIVE_STATUSES = Deployment.ACTIVE_STATUSES

    writable_fields = ()

    def clean(self, data, partial):  # pragma: no cover - not API-writable
        raise NotImplementedError(
            "Deployments are created by the provisioning pipeline, not directly"
        )

    def base_query(self):
        return select(Deployment).options(joinedload(Deployment.server))

    def live_for(self, tenant):
        """The tenant's currently-serving deployment, or None."""
        return self.session.scalars(
            self.base_query()
            .where(Deployment.tenant_id == tenant.id, Deployment.status == "live")
            .limit(1)
        ).first()

    def require_live(self, tenant):
        deployment = self.live_for(tenant)
        if deployment is None:
            raise ConflictError("Tenant has no running container")
        return deployment

    def current_for(self, tenant):
        return self.session.scalars(
            self.base_query()
            .where(
                Deployment.tenant_id == tenant.id,
                Deployment.status.in_(Deployment.CURRENT_STATUSES),
            )
            .order_by(Deployment.created_at.desc())
            .limit(1)
        ).first()

    def latest_for(self, tenant):
        """Most recent deployment regardless of status (incl. failed)."""
        return self.session.scalars(
            self.base_query()
            .where(Deployment.tenant_id == tenant.id)
            .order_by(Deployment.created_at.desc())
            .limit(1)
        ).first()

    def list_for_tenant(self, tenant_id, limit=20, offset=0):
        tenant_id = self.validator.uuid(tenant_id, "tenant_id")
        total = self.session.scalar(
            select(func.count())
            .select_from(Deployment)
            .where(Deployment.tenant_id == tenant_id)
        )
        rows = self.session.scalars(
            self.base_query()
            .where(Deployment.tenant_id == tenant_id)
            .order_by(Deployment.created_at.desc())
            .limit(limit)
            .offset(offset)
        ).all()
        return rows, total

    def node_for(self, deployment):
        node = self.session.get(ServerNode, deployment.server_id)
        if node is None:
            raise NotFoundError(f"Server '{deployment.server_id}' not found")
        return node

    def allocate_port(self, server, probe=True):
        return allocate_port(
            self.session,
            self.settings,
            server,
            self.settings.tenant_port_range_start,
            self.settings.tenant_port_range_end,
            probe=probe,
        )

    def create_for(
        self, tenant, server, recorder=None, image=None, application="storefront"
    ):
        """Reserve a deployment row + host port for `tenant` on `server`."""
        if server.role != "worker":
            raise ConflictError(
                f"Node '{server.name}' has role '{server.role}'; tenant "
                "containers can only run on worker nodes"
            )
        self.session.execute(text("SELECT pg_advisory_xact_lock(hashtext('customer-site-placement'))"))
        from app.controller.server import ServerController
        load = ServerController(self.session, self.settings).node_load()
        slots, used = self.session.execute(select(load.c.containers, load.c.used_mb).where(load.c.server_id == server.id)).first() or (0, 0)
        if slots >= server.max_containers or used + tenant.memory_limit_mb + self.settings.node_memory_reserve_mb > server.max_memory_mb:
            raise ConflictError('The worker does not have capacity for this deployment.')

        deployment_id = uuid.uuid4()
        port = self.allocate_port(server)
        deployment = Deployment(
            id=deployment_id,
            tenant_id=tenant.id,
            server_id=server.id,
            application=application,
            image=image or self.settings.tenant_image,
            container_name=f"tenant_{tenant.tenant_slug}_{str(deployment_id)[:8]}",
            port=port,
            container_port=self.settings.tenant_container_port,
            status="pending",
            memory_limit_mb=tenant.memory_limit_mb,
            cpu_limit_cores=tenant.cpu_limit_cores,
        )
        self.session.add(deployment)
        try:
            self.session.flush()
        except IntegrityError as exc:
            self.session.rollback()
            raise ConflictError(
                f"Port {port} on '{server.name}' was taken concurrently"
            ) from exc

        if recorder:
            recorder.ok(
                "Deployment slot reserved",
                message=f"{server.name} port {port}",
                details={
                    "deployment_id": str(deployment.id),
                    "server": server.name,
                    "host_port": port,
                    "container_name": deployment.container_name,
                },
            )
        return deployment

    def tenant_environment(self, tenant, **extra):
        env = {
            "DATABASE_URL": cluster_resolver.tenant_dsn(self.session, tenant, self.settings),
            "JWT_SECRET": tenant.jwt_secret,
            "MEDIA_DRIVER": self.settings.tenant_media_driver,
            "NODE_ENV": "production",
        }
        env.update({k: v for k, v in extra.items() if v is not None})
        return env

    def container_spec(self, deployment, tenant, server):
        return {
            "name": deployment.container_name,
            "image": deployment.image,
            "network": self.settings.tenant_network,
            "mem_limit": f"{deployment.memory_limit_mb}m",
            "nano_cpus": int(float(deployment.cpu_limit_cores or 0.5) * 1_000_000_000),
            "restart_policy": {"Name": "always"},
            "host_port": deployment.port,
            "container_port": deployment.container_port,
            "bind_ip": server.dial_host,
            "dns": self.settings.tenant_dns_servers,
            "environment": self.tenant_environment(
                tenant,
                TENANT_ID=tenant.tenant_slug,
                PORT=str(deployment.container_port),
            ),
            "labels": {
                "unitycommerce.tenant": tenant.tenant_slug,
                "unitycommerce.deployment": str(deployment.id),
                "unitycommerce.managed": "true",
            },
        }

    def deploy(self, deployment, tenant, recorder=None):
        """Pull the image if needed and start the container."""
        server = self.node_for(deployment)
        docker = DockerService(server, self.settings)
        spec = self.container_spec(deployment, tenant, server)

        deployment.status = "deploying"
        self.session.flush()

        if docker.image_exists(deployment.image):
            if recorder:
                recorder.ok("Docker image already present", message=deployment.image)
        else:
            if recorder:
                recorder.started("Downloading Docker image", message=deployment.image)
            docker.pull_image(deployment.image)
            if recorder:
                recorder.ok(
                    "Docker image download completed",
                    message=deployment.image,
                    details={"digest": docker.image_digest(deployment.image)},
                )

        if recorder:
            recorder.started(
                "Creating container",
                message=deployment.container_name,
                details={
                    "host_port": deployment.port,
                    "container_port": deployment.container_port,
                    "bind_ip": spec["bind_ip"],
                    "memory": spec["mem_limit"],
                },
            )
        container_id = docker.run_container(spec)

        deployment.container_id = container_id
        deployment.started_at = datetime.now(timezone.utc)
        deployment.status = "health_checking"
        self.session.flush()

        state = docker.inspect(deployment.container_name) or {}
        if not state.get("Running"):
            deployment.status = "failed"
            deployment.health_status = "unhealthy"
            deployment.health_message = (
                f"Container is not running (state: {state.get('Status', 'unknown')})"
            )
            self.session.flush()
            raise NodeUnreachableError(
                f"Container '{deployment.container_name}' exited immediately "
                f"on '{server.name}' (state: {state.get('Status', 'unknown')})"
            )

        if recorder:
            recorder.ok(
                "Container running",
                message=f"{container_id[:12]} on {server.dial_host}:{deployment.port}",
                details={"container_id": container_id, "upstream": deployment.upstream},
            )
        return deployment

    def redeploy(self, deployment, tenant, recorder=None, pull=True, image=None):
        server = self.node_for(deployment)
        docker = DockerService(server, self.settings)

        if image and image != deployment.image:
            if recorder:
                recorder.ok(
                    "Image changed",
                    message=f"{deployment.image} -> {image}",
                    details={"from": deployment.image, "to": image},
                )
            deployment.image = image

        deployment.status = "deploying"
        self.session.flush()

        if pull:
            if recorder:
                recorder.started("Pulling image", message=deployment.image)
            docker.pull_image(deployment.image)
            if recorder:
                recorder.ok(
                    "Image up to date",
                    message=deployment.image,
                    details={"digest": docker.image_digest(deployment.image)},
                )

        if recorder:
            recorder.started(
                "Recreating container",
                message=deployment.container_name,
                details={
                    "host_port": deployment.port,
                    "upstream": deployment.upstream,
                },
            )
        deployment.container_id = docker.run_container(
            self.container_spec(deployment, tenant, server)
        )
        deployment.started_at = datetime.now(timezone.utc)
        deployment.status = "health_checking"
        self.session.flush()

        state = docker.inspect(deployment.container_name) or {}
        if not state.get("Running"):
            deployment.status = "failed"
            deployment.health_status = "unhealthy"
            deployment.health_message = (
                f"Container is not running (state: {state.get('Status', 'unknown')})"
            )
            self.session.flush()
            raise NodeUnreachableError(
                f"Container '{deployment.container_name}' exited immediately "
                f"on '{server.name}' (state: {state.get('Status', 'unknown')})"
            )

        if recorder:
            recorder.ok(
                "Container recreated",
                message=f"{deployment.container_id[:12]} on {deployment.upstream}",
                details={"container_id": deployment.container_id},
            )
        return deployment

    def run_db_migrations(self, deployment, tenant, recorder=None, server=None):
        server = server or self.node_for(deployment)
        docker = DockerService(server, self.settings)
        runtime_image = deployment.image
        image = self.settings.migrate_image_for(runtime_image)
        probe = self.settings.tenant_migrate_probe
        command = self.settings.tenant_migrate_command

        if recorder:
            recorder.started("Pulling migrate image", message=image)
        try:
            docker.pull_image(image, timeout=self.settings.tenant_migrate_timeout)
        except NodeUnreachableError as exc:
            raise ConflictError(
                f"Could not pull the migrate image '{image}': {exc}. Build and "
                f"push it with:  docker build --target migrate -t {image} .  "
                "(the runtime image is built with --target runner and cannot "
                "run migrations)."
            ) from exc
        if recorder:
            recorder.ok("Migrate image ready", message=image)

        if not docker.file_exists_in_image(image, probe):
            raise ConflictError(
                f"Image '{image}' has no '{probe}', so it is the runner stage, "
                "not the migrate stage. Build and push the migrate image: "
                f"docker build --target migrate -t {image} . && docker push {image}"
            )

        if recorder:
            recorder.started(
                "Running database migrations",
                message=f"{command} ({image})",
                details={"image": image, "database": tenant.db_name},
            )
        result = docker.run_once(
            image,
            command,
            environment=self.tenant_environment(tenant),
            timeout=self.settings.tenant_migrate_timeout,
        )
        # migrate.mjs explains its own failures, so surface its output verbatim.
        output = "\n".join(p for p in (result.stdout, result.stderr) if p).strip()
        if not result.ok:
            raise ConflictError(
                f"Database migration failed for '{tenant.tenant_slug}' "
                f"(exit {result.exit_code}): "
                f"{output[-600:] or 'no output from the migration script'}"
            )
        if recorder:
            recorder.ok(
                "Database migrations applied",
                message=f"{tenant.db_name} is up to date",
                details={
                    "image": image,
                    "command": command,
                    "output": output[-2000:],
                },
            )
        return result

    def create_store_admin(
        self, deployment, tenant, email, password, name=None, recorder=None, server=None
    ):
        server = server or self.node_for(deployment)
        docker = DockerService(server, self.settings)
        image = self.settings.migrate_image_for(deployment.image)
        script = self.settings.tenant_create_admin_script

        if not docker.image_exists(image):
            if recorder:
                recorder.started("Pulling migrate image", message=image)
            docker.pull_image(image, timeout=self.settings.tenant_migrate_timeout)
        if not docker.file_exists_in_image(image, script):
            raise ConflictError(
                f"Image '{image}' has no '{script}'. The admin seeding script "
                "ships in the Dockerfile's `migrate` stage -- build and push "
                f"that stage: docker build --target migrate -t {image} ."
            )

        if recorder:
            recorder.started(
                "Creating storefront admin",
                message=email,
                details={"email": email, "name": name},  # never the password
            )

        inner = (
            f"read -r ADMIN_PW; exec node {shlex.quote(script)} "
            f'"$ADMIN_EMAIL" "$ADMIN_PW"'
        )
        if name:
            inner += ' "$ADMIN_NAME"'
        environment = self.tenant_environment(
            tenant, ADMIN_EMAIL=email, ADMIN_NAME=name
        )

        result = docker.run_once(
            image,
            f"sh -c {shlex.quote(inner)}",
            environment=environment,
            timeout=self.settings.tenant_migrate_timeout,
            stdin_data=password + "\n",
        )
        output = "\n".join(p for p in (result.stdout, result.stderr) if p).strip()
        # Defensive: never let the password reach the log, whatever the script echoes.
        output = output.replace(password, "***")
        if not result.ok:
            raise ConflictError(
                f"Could not create the storefront admin for "
                f"'{tenant.tenant_slug}' (exit {result.exit_code}): "
                f"{output[-600:] or 'no output from the script'}"
            )
        if recorder:
            recorder.ok(
                "Storefront admin created",
                message=email,
                details={"email": email, "output": output[-1000:]},
            )
        return result

    def mark_live(self, deployment, recorder=None):
        deployment.status = "live"
        deployment.health_status = "healthy"
        deployment.last_health_at = datetime.now(timezone.utc)
        try:
            self.session.flush()
        except IntegrityError as exc:
            self.session.rollback()
            raise ConflictError(
                "Another deployment for this tenant already went live "
                "concurrently; retry the operation"
            ) from exc
        if recorder:
            recorder.ok("Deployment is live", message=deployment.upstream)
        return deployment

    def teardown(self, deployment, recorder=None, force=True):
        if deployment.status == "removed":
            return deployment
        server = self.node_for(deployment)
        try:
            DockerService(server, self.settings).remove(
                deployment.container_name, force=force
            )
            if recorder:
                recorder.ok("Container removed", message=deployment.container_name)
        except NodeUnreachableError as exc:
            if recorder:
                recorder.warn(
                    "Could not remove container",
                    message=f"{exc} -- releasing the port anyway",
                )

        deployment.status = "removed"
        deployment.stopped_at = datetime.now(timezone.utc)
        deployment.port_released_at = datetime.now(timezone.utc)
        self.session.flush()
        return deployment

    def stop(self, deployment, recorder=None):
        server = self.node_for(deployment)
        DockerService(server, self.settings).stop(deployment.container_name)
        deployment.status = "stopped"
        deployment.stopped_at = datetime.now(timezone.utc)
        self.session.flush()
        if recorder:
            recorder.ok("Container stopped", message=deployment.container_name)
        return deployment

    def start(self, deployment, tenant, recorder=None):
        """Start an existing container, recreating it if it has gone missing."""
        server = self.node_for(deployment)
        docker = DockerService(server, self.settings)
        if docker.exists(deployment.container_name):
            docker.start(deployment.container_name)
            if recorder:
                recorder.ok("Container started", message=deployment.container_name)
        else:
            if recorder:
                recorder.warn(
                    "Container missing",
                    message="Recreating it from the deployment spec",
                )
            deployment.container_id = docker.run_container(
                self.container_spec(deployment, tenant, server)
            )
        deployment.status = "live"
        deployment.started_at = datetime.now(timezone.utc)
        self.session.flush()
        return deployment

    def update_resources(
        self, deployment, memory_limit_mb=None, cpu_limit_cores=None, recorder=None
    ):
        if memory_limit_mb is not None:
            deployment.memory_limit_mb = memory_limit_mb
        if cpu_limit_cores is not None:
            deployment.cpu_limit_cores = cpu_limit_cores
        server = self.node_for(deployment)
        DockerService(server, self.settings).update_resources(
            deployment.container_name,
            deployment.memory_limit_mb,
            float(deployment.cpu_limit_cores),
        )
        self.session.flush()
        if recorder:
            recorder.ok(
                "Container limits updated",
                message=f"{deployment.memory_limit_mb}MB / {deployment.cpu_limit_cores} vCPU",
            )
        return deployment
