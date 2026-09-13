import secrets
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload, selectinload

from app.controller.base import BaseController
from app.controller.deployment import DeploymentController
from app.controller.domain import DomainController
from app.controller.server import ServerController
from app.errors import (
    ApiError,
    BackupError,
    ConflictError,
    NodeUnreachableError,
    NotFoundError,
    ValidationError,
)
from app.models.activity import ActivityLog, Operation
from app.models.backup import TenantBackup
from app.models.migration import TenantMigration
from app.models.platform import PlatformSubscription
from app.models.server import Tenant
from app.services import account_resolver
from app.services.docker_service import DockerService
from app.services.health_check_service import HealthCheckService
from app.models.database_connection import DatabaseConnection
from app.models.db_migration import TenantDatabaseMigration
from app.services import cluster_resolver
from app.services.postgres_service import PostgresService
from app.services.proxy_configuration_service import ProxyConfigurationService


class TenantController(BaseController):
    """CRUD and lifecycle transitions for tenant storefronts."""

    model = Tenant
    resource_name = "tenant"
    STATUSES = ("pending", "active", "paused", "terminated")

    writable_fields = (
        "tenant_slug",
        "customer_email",
        "user_id",
        "subscription_id",
        "database_connection_id",
        "plan_tier",
        "status",
        "node_id",
        "container_id",
        "assigned_subdomain",
        "custom_domain",
        "db_name",
        "db_user",
        "db_password",
        "jwt_secret",
        "memory_limit_mb",
        "cpu_limit_cores",
    )
    # customer_email and plan_tier are derived from the subscription when one
    # is given (see account_resolver), so neither is required up front -- the
    # check that at least one identity source exists is in apply_defaults.
    required_on_create = ("tenant_slug",)
    # The slug drives the subdomain, database name and container name, so it is
    # fixed once the tenant record exists.
    immutable_after_create = ("tenant_slug",)
    # Set False to create a tenant without picking a worker node for it.
    auto_assign_node = True

    def __init__(self, session, config=None, actor=None):
        super().__init__(session, config, actor)
        self.servers = ServerController(session, config, actor)
        self.deployments = DeploymentController(session, config, actor)
        self.domains = DomainController(session, config, actor)

    def base_query(self):
        """Eager-load everything TenantSerializer touches.

        The serializer reads `live_deployment` (which walks `deployments`),
        `domains` and `database_connection` for every row, so a plain
        select(Tenant) turned a 20-tenant listing into 40-odd queries.
        selectinload issues one extra query per relationship regardless of
        row count, which keeps a listing flat at ~5 queries instead of 2N+3.

        selectinload rather than joinedload: these are collections, and a
        LEFT JOIN would multiply the tenant rows by their deployments and
        domains before de-duplication, which is slower and interacts badly
        with LIMIT/OFFSET pagination.
        """
        return select(Tenant).options(
            selectinload(Tenant.deployments),
            selectinload(Tenant.domains),
            selectinload(Tenant.database_connection),
            # The account side is scalar many-to-one, so joinedload folds it
            # into the same statement rather than adding a round trip each.
            joinedload(Tenant.user),
            joinedload(Tenant.subscription).joinedload(PlatformSubscription.plan),
        )

    def clean(self, data, partial):
        self.check_payload(data, partial)
        v = self.validator
        values = {}

        if "tenant_slug" in data:
            values["tenant_slug"] = v.slug(data["tenant_slug"], "tenant_slug", 63)
        if "customer_email" in data:
            values["customer_email"] = v.email(data["customer_email"], "customer_email")
        # user_id / subscription_id are cuid strings owned by the platform's
        # Prisma tables, not uuids -- validated by the FK, not parsed here.
        if "user_id" in data:
            values["user_id"] = data["user_id"] or None
        if "subscription_id" in data:
            values["subscription_id"] = data["subscription_id"] or None
        if "database_connection_id" in data:
            values["database_connection_id"] = (
                None
                if not data["database_connection_id"]
                else v.uuid(data["database_connection_id"], "database_connection_id")
            )
        if "plan_tier" in data:
            values["plan_tier"] = v.string(data["plan_tier"], "plan_tier", max_length=50)
        if "status" in data:
            values["status"] = v.choice(data["status"], "status", self.STATUSES)
        if "node_id" in data:
            values["node_id"] = (
                None if data["node_id"] is None else v.uuid(data["node_id"], "node_id")
            )
        if "container_id" in data:
            values["container_id"] = (
                None
                if data["container_id"] is None
                else v.string(data["container_id"], "container_id", max_length=128)
            )
        if "assigned_subdomain" in data:
            values["assigned_subdomain"] = v.hostname(
                data["assigned_subdomain"], "assigned_subdomain"
            )
        if "custom_domain" in data:
            values["custom_domain"] = (
                None
                if data["custom_domain"] is None
                else v.hostname(data["custom_domain"], "custom_domain")
            )
        if "db_name" in data:
            values["db_name"] = v.string(data["db_name"], "db_name", max_length=63)
        if "db_user" in data:
            values["db_user"] = v.string(data["db_user"], "db_user", max_length=63)
        if "db_password" in data:
            values["db_password"] = v.string(
                data["db_password"], "db_password", max_length=255
            )
        if "jwt_secret" in data:
            values["jwt_secret"] = v.string(
                data["jwt_secret"], "jwt_secret", max_length=255
            )
        if "memory_limit_mb" in data:
            values["memory_limit_mb"] = v.integer(
                data["memory_limit_mb"], "memory_limit_mb", minimum=64
            )
        if "cpu_limit_cores" in data:
            values["cpu_limit_cores"] = v.decimal(
                data["cpu_limit_cores"], "cpu_limit_cores", minimum="0.01", maximum="9.99"
            )
        return values

    def apply_defaults(self, values):
        """Derive everything a webhook shouldn't have to send."""
        # Who this store belongs to, and on what plan. Resolved first: it
        # rewrites customer_email and plan_tier from the linked subscription,
        # and the defaults below assume those are settled.
        account = account_resolver.resolve_account(self.session, values)
        account.apply_to(values)

        if not values.get("customer_email"):
            raise ValidationError(
                "A tenant needs an owner: pass subscription_id (preferred), or "
                "user_id, or customer_email"
            )
        values.setdefault("plan_tier", self.settings.default_plan_tier)

        slug = values["tenant_slug"]
        values.setdefault("assigned_subdomain", self.settings.subdomain_for(slug))
        values.setdefault("db_name", self.settings.db_name_for(slug))
        values.setdefault("db_user", self.settings.db_user_for(slug))
        values.setdefault("db_password", self.generate_password())
        values.setdefault("jwt_secret", self.generate_password())
        values.setdefault("status", "pending")
        values.setdefault("memory_limit_mb", self.settings.tenant_memory_limit_mb)

        if values.get("node_id") is not None:
            # Fail early rather than on the FK violation, so the caller gets a 404.
            self.servers.get(values["node_id"])
        elif self.auto_assign_node:
            node = self.servers.available_node(values.get("memory_limit_mb"))
            if node is not None:
                values["node_id"] = node.id

        # Which cluster holds this tenant's data. Resolved once, at creation:
        # after the database exists, changing it means moving data, which is
        # migrate_database()'s job, not an attribute update.
        if values.get("database_connection_id") is not None:
            self._require_cluster(values["database_connection_id"])
        else:
            default = cluster_resolver.default_cluster(self.session)
            if default is not None:
                values["database_connection_id"] = default.id
        return values

    def _require_cluster(self, connection_id):
        """Load a registered cluster, refusing non-cluster connections.

        A query-console entry ('external') has read credentials but no
        authority to CREATE DATABASE, so provisioning onto one would fail
        partway through with a permissions error.
        """
        connection = self.session.get(DatabaseConnection, connection_id)
        if connection is None:
            raise NotFoundError(f"Database cluster {connection_id} was not found")
        if not connection.is_cluster:
            raise ValidationError(
                f"'{connection.name}' is registered as an external connection, not a "
                "cluster, so tenants cannot be provisioned onto it."
            )
        return connection

    def before_update(self, tenant, values):
        if values.get("node_id") is not None:
            self.servers.get(values["node_id"])
        # Re-resolve when any part of the account link is being touched, so an
        # update cannot leave the tenant pointing at one customer while its
        # subscription belongs to another.
        if {"subscription_id", "user_id", "customer_email"} & values.keys():
            account_resolver.resolve_account(self.session, values, tenant=tenant).apply_to(values)
        # Reassigning the cluster by attribute would leave the tenant pointing
        # at an instance where its database does not exist.
        if (
            "database_connection_id" in values
            and values["database_connection_id"] != tenant.database_connection_id
        ):
            raise ValidationError(
                "A tenant's database cluster cannot be changed directly — its data "
                "would be left behind. Use the database migration endpoint instead."
            )

    def before_delete(self, tenant, force):
        """A tenant with a live container is refused unless forced -- removing
        the row first would orphan the container on the worker node.

        With `force`, the containers are actually torn down (and their ports
        released) rather than abandoned, since the deployment rows cascade away
        with the tenant.
        """
        deployment = self.deployments.current_for(tenant)
        if deployment is not None and not force:
            raise ConflictError(
                "Tenant still has a running container; terminate it first or "
                "retry with ?force=true"
            )
        if force:
            nodes = set()
            for row in list(tenant.deployments):
                if row.status != "removed":
                    nodes.add(row.server_id)
                    try:
                        self.deployments.teardown(row)
                    except NodeUnreachableError:
                        # Node gone; the cascade removes the row regardless.
                        pass
            for server_id in nodes:
                self.servers.refresh_capacity(self.servers.get(server_id))

    def conflict_message(self, values):
        return (
            "A tenant with that slug, subdomain or custom domain already exists"
        )

    # ------------------------------------------------------------------
    def list(
        self,
        status=None,
        node_id=None,
        plan_tier=None,
        user_id=None,
        subscription_id=None,
        limit=50,
        offset=0,
    ):
        stmt = self.base_query()
        if status is not None:
            stmt = stmt.where(
                Tenant.status == self.validator.choice(status, "status", self.STATUSES)
            )
        if node_id is not None:
            stmt = stmt.where(Tenant.node_id == self.validator.uuid(node_id, "node_id"))
        if plan_tier is not None:
            stmt = stmt.where(Tenant.plan_tier == plan_tier)
        # Backs "which stores does this customer have?" on the platform's user
        # page. cuid strings, so matched as-is rather than parsed as uuids.
        if user_id is not None:
            stmt = stmt.where(Tenant.user_id == user_id)
        if subscription_id is not None:
            stmt = stmt.where(Tenant.subscription_id == subscription_id)
        return self.paginate(stmt, limit, offset)

    def get_by_slug(self, slug):
        tenant = self.session.scalars(
            self.base_query().where(Tenant.tenant_slug == str(slug).lower())
        ).first()
        if tenant is None:
            raise NotFoundError(f"Tenant '{slug}' not found")
        return tenant

    def set_status(self, tenant_id, status):
        tenant = self.get(tenant_id)
        tenant.status = self.validator.choice(status, "status", self.STATUSES)
        self.session.flush()
        return tenant

    @staticmethod
    def generate_password(length=32):
        return secrets.token_urlsafe(length)

    # ------------------------------------------------------------------
    # deployment access
    # ------------------------------------------------------------------
    def live_deployment(self, tenant, required=True):
        """The deployment currently serving this tenant.

        Replaces the old `if not tenant.node_id or not tenant.container_id`
        guards; the error message is unchanged so API behaviour is identical.
        """
        deployment = self.deployments.live_for(tenant)
        if deployment is None and required:
            raise ConflictError("Tenant has no running container")
        return deployment

    def deployment_node(self, deployment):
        return self.servers.get(deployment.server_id)

    def sync_legacy_pointers(self, tenant, deployment=None):
        """Keep `tenant.node_id` / `container_id` matching the live deployment.

        Write-through cache for Phases 1-3 only: the columns still back the
        serializer, admin views and templates. Phase 4 drops them along with
        this method.
        """
        if deployment is None:
            deployment = self.deployments.live_for(tenant)
        tenant.node_id = deployment.server_id if deployment else None
        tenant.container_id = deployment.container_id if deployment else None
        self.session.flush()
        return tenant

    def log_context(self, tenant):
        """Subject fields attached to every log row for this tenant."""
        deployment = self.deployments.live_for(tenant)
        return {
            "tenant_id": tenant.id,
            "tenant_slug": tenant.tenant_slug,
            "user_id": tenant.user_id,
            "server_id": deployment.server_id if deployment else tenant.node_id,
        }

    def _log(self, tenant, step_name, status, message=None, **kw):
        """One-off event (no surrounding operation)."""
        return self.activity.event(
            "tenant", f"tenant.{step_name}", step_name, status=status,
            message=message, **self.log_context(tenant), **kw,
        )

    # ------------------------------------------------------------------
    def create(self, data):
        """Create a tenant record, logging each stage of the process."""
        requested_slug = data.get("tenant_slug") if isinstance(data, dict) else None
        label = f"Tenant creation: {requested_slug or 'new tenant'}"
        with self.activity.operation(
            "tenant.create", label, category="tenant",
            tenant_slug=requested_slug if isinstance(requested_slug, str) else None,
        ) as op:
            op.ok("Tenant creation started", message=f"Requested slug: {requested_slug}")

            values = self.clean(data, partial=False)
            # apply_defaults resolves the customer and plan from the linked
            # subscription, so the "validated" step below is logged after it --
            # before it, plan_tier and customer_email may not exist yet.
            values = self.apply_defaults(values)
            op.ok(
                "Tenant information validated",
                message=f"Slug '{values['tenant_slug']}' on plan '{values['plan_tier']}'",
                details={
                    "tenant_slug": values["tenant_slug"],
                    "plan_tier": values["plan_tier"],
                    "customer_email": values["customer_email"],
                    "user_id": values.get("user_id"),
                    "subscription_id": values.get("subscription_id"),
                },
            )

            op.ok(
                "Subdomain and database credentials generated",
                message=values["assigned_subdomain"],
                details={
                    "assigned_subdomain": values["assigned_subdomain"],
                    "db_name": values["db_name"],
                    "db_user": values["db_user"],
                    "memory_limit_mb": values.get("memory_limit_mb"),
                },
            )

            if values.get("node_id"):
                node = self.servers.get(values["node_id"])
                op.ok(
                    "Worker node assigned",
                    message=f"{node.name} ({node.ip_address})",
                    server_id=node.id, server_name=node.name,
                    details={"node_id": str(node.id), "node_name": node.name},
                )
            else:
                # Say *why* now -- otherwise the operator only finds out at
                # provision time, with no clue which limit was hit.
                reason = self.servers.placement_error(
                    values.get("memory_limit_mb")
                ).message
                op.warn("No worker node assigned", message=reason)

            tenant = self.model(**values)
            self.session.add(tenant)
            self.flush(self.conflict_message(values))

            op.bind(**self.log_context(tenant))
            op.ok(
                "Tenant record created",
                message=f"Tenant id {tenant.id}",
                details={"tenant_id": str(tenant.id), "status": tenant.status},
            )

            self.domains.ensure_platform_mapping(tenant, recorder=op)

            op.ok(
                "Tenant setup completed",
                message="Pending provisioning -- run Provision to deploy the container",
            )
            return tenant

    # ------------------------------------------------------------------
    # provisioning / lifecycle
    # ------------------------------------------------------------------
    def provision(self, tenant_id, server_id=None, operation_id=None):
        """First-time provisioning: create the tenant's database, reserve a
        deployment slot (node + host port) and start its container.

        Every stage is logged as its own step so the operation timeline shows
        exactly how far it got before any failure.
        """
        tenant = self.get(tenant_id)
        target_id = server_id or tenant.node_id
        node = self.servers.get(target_id) if target_id else None
        label = f"Tenant provisioning: {tenant.tenant_slug}"

        with self.activity.operation(
            "tenant.provision", label, category="deployment",
            operation_id=operation_id,
            **self.log_context(tenant),
            server_name=node.name if node else None,
        ) as op:
            op.ok("Provisioning started", message=f"Tenant '{tenant.tenant_slug}'")

            if self.deployments.live_for(tenant):
                raise ConflictError(
                    "Tenant is already provisioned; use start/stop/resize/migrate"
                )
            if node is None:
                # Try once more at provision time -- capacity may have freed up
                # since the tenant record was created.
                node = self.servers.available_node(tenant.memory_limit_mb)
                if node is None:
                    raise self.servers.placement_error(tenant.memory_limit_mb)
                op.ok(
                    "Worker node assigned at provision time",
                    message=f"{node.name} ({node.ip_address})",
                )

            op.ok(
                "Target server resolved",
                message=f"{node.name} ({node.ip_address}:{node.ssh_port})",
                details={"node_id": str(node.id), "ip_address": node.ip_address},
            )

            # -- connectivity ------------------------------------------
            op.started(
                "Connecting to server", message=f"SSH {node.ssh_user}@{node.ip_address}"
            )
            check = self.servers.ssh(node).check()
            op.ok(
                "Server connection established",
                message=f"{check['user']}@{check['hostname']} -- {check['os']}",
                details=check,
            )

            if not check["docker_installed"]:
                raise NodeUnreachableError(
                    f"Docker is not installed on node '{node.name}'. "
                    "Run Install Docker on the server page first."
                )
            op.ok(
                "Docker environment verified",
                message=check["docker_version"],
                details={"docker_version": check["docker_version"]},
            )

            # -- database -----------------------------------------------
            op.started("Creating tenant database", message=tenant.db_name)
            cluster_resolver.service_for_tenant(self.session, tenant, self.settings).create_database(tenant)
            op.ok(
                "Tenant database ready",
                message=f"{tenant.db_name} (owner {tenant.db_user})",
                details={"db_name": tenant.db_name, "db_user": tenant.db_user},
            )

            # -- deployment slot (node + host port) ---------------------
            deployment = self.deployments.create_for(tenant, node, recorder=op)

            # -- schema ---------------------------------------------------
            # Must complete before the app starts, or the storefront boots
            # against an empty database and 500s on every request.
            if self.settings.tenant_migrate_on_provision:
                self.deployments.run_db_migrations(
                    deployment, tenant, recorder=op, server=node
                )
            else:
                op.warn(
                    "Schema migration skipped",
                    message="TENANT_MIGRATE_ON_PROVISION is off; run it manually",
                )

            # -- image + container --------------------------------------
            self.deployments.deploy(deployment, tenant, recorder=op)

            # -- proxy health gate (Phase 2) -----------------------------
            # Only runs when a proxy is registered; otherwise behaves exactly
            # as before this existed (reachable at IP:PORT only). A failure
            # here raises -- the container stays running on the worker for
            # `docker logs` debugging, and the deployment never reaches
            # status='live', so `is_routable` stays correctly False with no
            # special-casing needed anywhere else.
            proxy = self.servers.proxy_node()
            if proxy is not None:
                op.started(
                    "Health-checking through proxy",
                    message=f"Probing {deployment.upstream} from {proxy.name}",
                )
                if not HealthCheckService(self.settings).probe(proxy, deployment):
                    raise NodeUnreachableError(
                        f"'{tenant.tenant_slug}' did not become healthy through "
                        f"the proxy within the retry window; its container is "
                        f"still running on {node.name} for inspection "
                        f"(docker logs {deployment.container_name})"
                    )
                op.ok("Deployment is healthy", message=deployment.upstream)

            self.deployments.mark_live(deployment, recorder=op)

            tenant.status = "active"
            self.sync_legacy_pointers(tenant, deployment)
            self.servers.refresh_capacity(node)
            self.domains.repoint_all(tenant, deployment, recorder=op)

            if proxy is not None:
                ProxyConfigurationService(self.settings).sync_all(self.session, recorder=op)

            op.ok(
                "Tenant setup completed",
                message=(
                    f"{tenant.tenant_slug} reachable at {deployment.upstream} "
                    f"on {node.name}"
                ),
                details={
                    "upstream": deployment.upstream,
                    "deployment_id": str(deployment.id),
                    "container_id": deployment.container_id,
                    "host_port": deployment.port,
                    "primary_domain": tenant.primary_domain,
                },
            )
            return tenant

    def stop(self, tenant_id):
        """Suspend a tenant: stop its container, leave the database intact."""
        tenant = self.get(tenant_id)
        with self.activity.operation(
            "tenant.stop", f"Stop tenant: {tenant.tenant_slug}",
            category="tenant", **self.log_context(tenant),
        ) as op:
            op.ok("Stop requested")
            deployment = self.deployments.live_for(tenant)
            if deployment is None:
                raise ConflictError("Tenant has no running container to stop")
            op.started("Stopping container", message=deployment.container_name)
            self.deployments.stop(deployment, recorder=op)
            tenant.status = "paused"
            self.session.flush()
            # No health-gating needed -- this is an existing deployment being
            # stopped, not a new one being promoted. is_routable already goes
            # False the moment deployment.status flips off 'live'; this just
            # makes the proxy's actual config catch up to that.
            if self.servers.proxy_node() is not None:
                ProxyConfigurationService(self.settings).sync_all(self.session, recorder=op)
            op.ok("Tenant stopped", message=f"{tenant.tenant_slug} is now paused")
            return tenant

    def start(self, tenant_id):
        """Resume a stopped tenant, or (re)create its container if missing."""
        tenant = self.get(tenant_id)
        with self.activity.operation(
            "tenant.start", f"Start tenant: {tenant.tenant_slug}",
            category="tenant", **self.log_context(tenant),
        ) as op:
            op.ok("Start requested")
            deployment = self.deployments.current_for(tenant)
            if deployment is None:
                raise ConflictError(
                    "Tenant has no deployment to start; provision it first"
                )
            op.started(
                "Starting container", message=deployment.container_name
            )
            self.deployments.start(deployment, tenant, recorder=op)
            tenant.status = "active"
            self.sync_legacy_pointers(tenant, deployment)
            if self.servers.proxy_node() is not None:
                ProxyConfigurationService(self.settings).sync_all(self.session, recorder=op)
            op.ok(
                "Tenant started",
                message=f"{tenant.tenant_slug} is now active at {deployment.upstream}",
            )
            return tenant

    def redeploy(self, tenant_id, pull=True, image=None, operation_id=None):
        """Recreate the tenant's container from the current image and config.

        Use this to roll out a new image build, apply changed environment, or
        repair a container that drifted from its spec. Keeps the same node and
        host port. If the tenant has never been provisioned, this falls through
        to provision() so the button always does the sensible thing.
        """
        tenant = self.get(tenant_id)
        deployment = self.deployments.current_for(tenant)
        if deployment is None:
            return self.provision(tenant_id, operation_id=operation_id)

        with self.activity.operation(
            "tenant.redeploy", f"Redeploy tenant: {tenant.tenant_slug}",
            category="deployment", operation_id=operation_id, **self.log_context(tenant),
        ) as op:
            op.ok(
                "Redeploy requested",
                message=f"{deployment.container_name} on {deployment.upstream}",
                details={
                    "deployment_id": str(deployment.id),
                    "image": deployment.image,
                    "pull": pull,
                },
            )
            self.deployments.redeploy(
                deployment, tenant, recorder=op, pull=pull, image=image
            )
            self.deployments.mark_live(deployment, recorder=op)

            tenant.status = "active"
            self.sync_legacy_pointers(tenant, deployment)
            op.ok(
                "Redeploy completed",
                message=f"{tenant.tenant_slug} running at {deployment.upstream}",
                details={"upstream": deployment.upstream},
            )
            return tenant

    def run_db_migrations(self, tenant_id, operation_id=None):
        """Create/upgrade this tenant's database schema.

        Separate from migrate(), which moves the container between nodes.
        """
        tenant = self.get(tenant_id)
        deployment = self.deployments.current_for(tenant)
        if deployment is None:
            raise ConflictError(
                "Tenant has no deployment; provision it before running migrations"
            )

        with self.activity.operation(
            "tenant.db_migrate", f"Database migration: {tenant.tenant_slug}",
            category="database", operation_id=operation_id, **self.log_context(tenant),
        ) as op:
            op.ok(
                "Database migration requested",
                message=f"{tenant.db_name} on {self.settings.tenant_db_host}",
                details={"db_name": tenant.db_name, "image": deployment.image},
            )
            self.deployments.run_db_migrations(deployment, tenant, recorder=op)
            op.ok(
                "Schema is up to date",
                message=f"{tenant.tenant_slug} database ready",
            )
            return tenant

    def create_store_admin(self, tenant_id, email, password, name=None, operation_id=None):
        """Create a storefront admin login for this tenant's own app.

        Distinct from AdminUser, which signs into *this* controller panel.
        """
        email = self.validator.email(email, "email")
        password = self.validator.string(password, "password", max_length=255)
        if len(password) < 8:
            raise ValidationError(
                "'password' must be at least 8 characters", field="password"
            )
        if name:
            name = self.validator.string(name, "name", max_length=255)

        tenant = self.get(tenant_id)
        deployment = self.deployments.current_for(tenant)
        if deployment is None:
            raise ConflictError(
                "Tenant has no deployment; provision it before creating a "
                "storefront admin"
            )

        with self.activity.operation(
            "tenant.create_store_admin",
            f"Storefront admin: {tenant.tenant_slug}",
            category="tenant", operation_id=operation_id, **self.log_context(tenant),
        ) as op:
            op.ok(
                "Storefront admin requested",
                message=email,
                details={"email": email, "database": tenant.db_name},
            )
            self.deployments.create_store_admin(
                deployment, tenant, email, password, name=name, recorder=op
            )
            op.ok(
                "Storefront admin ready",
                message=f"{email} can sign in to {tenant.tenant_slug}",
            )
            return tenant

    def resize(self, tenant_id, memory_limit_mb=None, cpu_limit_cores=None):
        """Change a tenant's resource caps, live-applying to its container
        when one is running."""
        if memory_limit_mb is None and cpu_limit_cores is None:
            raise ValidationError("Provide memory_limit_mb and/or cpu_limit_cores")

        tenant = self.get(tenant_id)
        before = {
            "memory_limit_mb": tenant.memory_limit_mb,
            "cpu_limit_cores": str(tenant.cpu_limit_cores),
        }
        with self.activity.operation(
            "tenant.resize", f"Resize tenant: {tenant.tenant_slug}",
            category="tenant", **self.log_context(tenant),
        ) as op:
            op.ok("Resize requested", details={"from": before})

            if memory_limit_mb is not None:
                tenant.memory_limit_mb = self.validator.integer(
                    memory_limit_mb, "memory_limit_mb", minimum=64
                )
            if cpu_limit_cores is not None:
                tenant.cpu_limit_cores = self.validator.decimal(
                    cpu_limit_cores, "cpu_limit_cores", minimum="0.01", maximum="9.99"
                )
            after = {
                "memory_limit_mb": tenant.memory_limit_mb,
                "cpu_limit_cores": str(tenant.cpu_limit_cores),
            }
            op.ok("New limits validated", details={"from": before, "to": after})

            deployment = self.deployments.live_for(tenant)
            if deployment is not None:
                op.started("Applying limits to running container")
                self.deployments.update_resources(
                    deployment,
                    memory_limit_mb=tenant.memory_limit_mb,
                    cpu_limit_cores=tenant.cpu_limit_cores,
                    recorder=op,
                )
                # Node capacity is summed from deployments, so a resize moves it.
                self.servers.refresh_capacity(self.deployment_node(deployment))
            else:
                op.warn(
                    "No running container",
                    message="Limits saved; they apply the next time the container starts",
                )

            self.session.flush()
            op.ok("Resize completed", details=after)
            return tenant

    def stats(self, tenant_id):
        """Live CPU/memory usage from the container's node."""
        tenant = self.get(tenant_id)
        deployment = self.live_deployment(tenant)
        node = self.deployment_node(deployment)
        return DockerService(node, self.settings).stats(deployment.container_name)

    def logs(self, tenant_id, tail=200):
        tenant = self.get(tenant_id)
        deployment = self.live_deployment(tenant)
        node = self.deployment_node(deployment)
        return DockerService(node, self.settings).logs(
            deployment.container_name, tail=tail
        )

    # ------------------------------------------------------------------
    # backups
    # ------------------------------------------------------------------
    def create_backup(self, tenant_id, reason="manual", recorder=None, operation_id=None):
        """Dump the tenant database. `recorder` lets a surrounding operation
        (e.g. a migration) absorb these steps into its own timeline; called
        top-level (no recorder), this opens its own Operation so a standalone
        backup is Celery- and progress-poll-able like every other action."""
        tenant = self.get(tenant_id)

        if recorder is not None:
            return self._run_backup(tenant, reason, recorder)

        with self.activity.operation(
            "tenant.backup", f"Backup tenant: {tenant.tenant_slug}",
            category="backup", operation_id=operation_id, **self.log_context(tenant),
        ) as op:
            return self._run_backup(tenant, reason, op)

    def _run_backup(self, tenant, reason, recorder):
        backup = TenantBackup(
            tenant_id=tenant.id, node_id=tenant.node_id, status="running", reason=reason
        )
        self.session.add(backup)
        self.session.flush()

        recorder.started("Backing up tenant database", message=tenant.db_name)

        try:
            path, size = cluster_resolver.service_for_tenant(
                self.session, tenant, self.settings
            ).backup_database(tenant)
        except BackupError as exc:
            backup.status = "failed"
            backup.error_message = str(exc)
            backup.completed_at = datetime.now(timezone.utc)
            self.session.flush()
            recorder.fail("Database backup failed", exc)
            raise

        backup.status = "success"
        backup.backup_path = str(path)
        backup.size_bytes = size
        backup.completed_at = datetime.now(timezone.utc)
        self.session.flush()

        recorder.ok(
            "Database backup completed",
            message=f"{size or 0} bytes",
            details={
                "backup_id": str(backup.id),
                "path": str(path),
                "size_bytes": size,
                "reason": reason,
            },
        )
        return backup

    def list_backups(self, tenant_id, limit=50, offset=0):
        tenant = self.get(tenant_id)
        stmt = select(TenantBackup).where(TenantBackup.tenant_id == tenant.id)
        total = self.session.scalar(select(func.count()).select_from(stmt.subquery()))
        rows = self.session.scalars(
            stmt.order_by(TenantBackup.created_at.desc()).limit(limit).offset(offset)
        ).all()
        return rows, total

    def get_backup(self, tenant_id, backup_id):
        tenant = self.get(tenant_id)
        backup_id = self.validator.uuid(backup_id, "backup_id")
        backup = self.session.get(TenantBackup, backup_id)
        if backup is None or backup.tenant_id != tenant.id:
            raise NotFoundError(f"Backup '{backup_id}' not found for this tenant")
        return backup

    def restore_backup(self, tenant_id, backup_id, operation_id=None):
        tenant = self.get(tenant_id)
        with self.activity.operation(
            "tenant.restore", f"Restore backup: {tenant.tenant_slug}",
            category="backup", operation_id=operation_id, **self.log_context(tenant),
        ) as op:
            backup = self.get_backup(tenant_id, backup_id)
            op.ok(
                "Backup located",
                message=f"{backup.created_at:%Y-%m-%d %H:%M} ({backup.size_bytes or 0} bytes)",
                details={"backup_id": str(backup.id), "path": backup.backup_path},
            )
            if backup.status != "success" or not backup.backup_path:
                raise ConflictError("Only a successful backup can be restored")

            op.started("Restoring database", message=tenant.db_name)
            cluster_resolver.service_for_tenant(
                self.session, tenant, self.settings
            ).restore_database(tenant, backup.backup_path)
            self.session.flush()
            op.ok("Database restored", message=f"{tenant.db_name} from backup {backup.id}")
            return tenant

    # ------------------------------------------------------------------
    # migration
    # ------------------------------------------------------------------
    def migrate(self, tenant_id, target_node_id, backup_first=True, operation_id=None):
        """Move a tenant's container to a different node.

        Tenant data lives in the controller's own Postgres, not on the worker
        node, so there is nothing to copy -- the target node just needs its
        own copy of the container pointed at the same database. `backup_first`
        still takes a pg_dump snapshot as a safety net before touching
        anything.
        """
        tenant = self.get(tenant_id)
        target = self.servers.get(target_node_id)
        # The deployment, not the legacy tenant pointer, is the truth about
        # where this tenant currently runs.
        current = self.deployments.current_for(tenant)
        source_id = current.server_id if current else None
        if source_id == target.id:
            raise ConflictError("Tenant is already on that node")

        source = self.servers.get(source_id) if source_id else None
        migration = TenantMigration(
            tenant_id=tenant.id,
            from_node_id=source_id,
            to_node_id=target.id,
            status="pending",
            started_at=datetime.now(timezone.utc),
        )
        self.session.add(migration)
        self.session.flush()

        label = (
            f"Tenant migration: {tenant.tenant_slug} "
            f"{source.name if source else 'unassigned'} -> {target.name}"
        )
        with self.activity.operation(
            "tenant.migrate", label, category="migration",
            operation_id=operation_id, **self.log_context(tenant),
        ) as op:
            op.ok(
                "Migration started",
                message=label,
                details={
                    "migration_id": str(migration.id),
                    "from_node": source.name if source else None,
                    "to_node": target.name,
                    "backup_first": backup_first,
                },
            )
            try:
                if backup_first:
                    migration.status = "backing_up"
                    self.session.flush()
                    backup = self.create_backup(
                        tenant_id, reason="migration", recorder=op
                    )
                    migration.backup_id = backup.id
                    self.session.flush()
                else:
                    op.warn("Backup skipped", message="backup_first was not set")

                # Stand the replacement up on the target BEFORE touching the
                # source, so a failure on the target leaves the tenant serving.
                migration.status = "transferring"
                self.session.flush()
                old_deployment = self.deployments.current_for(tenant)
                new_deployment = self.deployments.create_for(
                    tenant, target, recorder=op
                )
                op.bind(server_id=target.id, server_name=target.name)
                self.deployments.deploy(new_deployment, tenant, recorder=op)

                # -- proxy health gate (Phase 2) -------------------------
                # Checked BEFORE tearing down the old deployment -- this is
                # the actual safety guarantee blue/green migration exists
                # for: a failure here leaves the tenant serving from the
                # untouched source, not a half-migrated gap.
                proxy = self.servers.proxy_node()
                if proxy is not None:
                    op.started(
                        "Health-checking new deployment through proxy",
                        message=f"Probing {new_deployment.upstream} from {proxy.name}",
                    )
                    if not HealthCheckService(self.settings).probe(proxy, new_deployment):
                        raise NodeUnreachableError(
                            f"New deployment on {target.name} did not become "
                            f"healthy through the proxy; leaving "
                            f"'{tenant.tenant_slug}' on "
                            f"{source.name if source else 'its current node'}"
                        )
                    op.ok("New deployment is healthy", message=new_deployment.upstream)

                # Retire the old slot, then promote -- in that order, because
                # only one deployment per tenant may be 'live' at a time.
                migration.status = "restoring"
                self.session.flush()
                if old_deployment is not None:
                    op.started(
                        "Removing container from source node",
                        message=source.name if source else "unknown",
                    )
                    self.deployments.teardown(old_deployment, recorder=op)

                self.deployments.mark_live(new_deployment, recorder=op)

                tenant.status = "active"
                self.sync_legacy_pointers(tenant, new_deployment)
                if source:
                    self.servers.refresh_capacity(source)
                self.servers.refresh_capacity(target)
                # Domains and DNS never change on a migration -- only which
                # deployment (and therefore which upstream) they point at.
                self.domains.repoint_all(tenant, new_deployment, recorder=op)

                if proxy is not None:
                    ProxyConfigurationService(self.settings).sync_all(
                        self.session, recorder=op
                    )

                migration.status = "completed"
                migration.completed_at = datetime.now(timezone.utc)
                self.session.flush()
                op.ok(
                    "Migration completed",
                    message=(
                        f"Now running on {target.name} "
                        f"({new_deployment.upstream})"
                    ),
                    details={
                        "container_id": new_deployment.container_id,
                        "node": target.name,
                        "upstream": new_deployment.upstream,
                        "primary_domain": tenant.primary_domain,
                    },
                )
            except ApiError as exc:
                # Broad on purpose: any application-level failure here (a port
                # race, a bad target role, an unreachable node, a failed
                # backup...) must leave the migration row as 'failed', not
                # stuck at whatever in-progress status it last had. Narrower
                # (NodeUnreachableError, BackupError)-only handling missed
                # ConflictError, e.g. from create_for()'s port allocation.
                migration.status = "failed"
                migration.error_message = str(exc)
                migration.completed_at = datetime.now(timezone.utc)
                self.session.flush()
                raise
        return tenant, migration

    def list_migrations(self, tenant_id, limit=50, offset=0):
        tenant = self.get(tenant_id)
        stmt = select(TenantMigration).where(TenantMigration.tenant_id == tenant.id)
        total = self.session.scalar(select(func.count()).select_from(stmt.subquery()))
        rows = self.session.scalars(
            stmt.order_by(TenantMigration.created_at.desc()).limit(limit).offset(offset)
        ).all()
        return rows, total

    def list_logs(self, tenant_id, limit=50, offset=0):
        tenant = self.get(tenant_id)
        stmt = select(ActivityLog).where(ActivityLog.tenant_id == tenant.id)
        total = self.session.scalar(select(func.count()).select_from(stmt.subquery()))
        rows = self.session.scalars(
            stmt.order_by(ActivityLog.created_at.desc(), ActivityLog.step_index.desc())
            .limit(limit)
            .offset(offset)
        ).all()
        return rows, total

    def list_operations(self, tenant_id, limit=20, offset=0):
        """Grouped processes (create/provision/migrate/...) for this tenant."""
        tenant = self.get(tenant_id)
        stmt = select(Operation).where(Operation.tenant_id == tenant.id)
        total = self.session.scalar(select(func.count()).select_from(stmt.subquery()))
        rows = self.session.scalars(
            stmt.order_by(Operation.started_at.desc()).limit(limit).offset(offset)
        ).all()
        return rows, total

    # ------------------------------------------------------------------
    # database cluster migration
    # ------------------------------------------------------------------
    def migrate_database(self, tenant_id, target_connection_id, operation_id=None):
        """Move a tenant's *data* to a different PostgreSQL cluster.

        Unlike migrate() -- which moves the container and copies nothing --
        this has to physically move the database, so it is dump/restore
        rather than a repoint:

            dump from source -> create role+database on target
            -> restore -> repoint the tenant -> redeploy the container
            -> drop the source database

        Ordered so the source is never destroyed until the tenant is
        verifiably serving from the target. If any step before the switch
        fails, the tenant is still running untouched against the source and
        the migration is simply marked failed.

        The source database is dropped last and only on success; the dump
        file is kept either way, since after the drop it is the only copy of
        the pre-move state.
        """
        tenant = self.get(tenant_id)
        target = self._require_cluster(target_connection_id)

        if tenant.database_connection_id == target.id:
            raise ConflictError(f"Tenant is already on cluster '{target.name}'")

        record = TenantDatabaseMigration(
            tenant_id=tenant.id,
            from_connection_id=tenant.database_connection_id,
            to_connection_id=target.id,
            status="pending",
            started_at=datetime.now(timezone.utc),
        )
        self.session.add(record)
        self.session.flush()

        source_service = cluster_resolver.service_for_tenant(self.session, tenant, self.settings)
        target_service = PostgresService(
            config=self.settings,
            target=cluster_resolver.target_for_connection(target, self.settings),
        )
        source_label = source_service.target.label

        with self.activity.operation(
            "tenant.migrate_database",
            f"Tenant database migration: {tenant.tenant_slug} -> {target.name}",
            category="database",
            tenant_id=tenant.id,
            tenant_slug=tenant.tenant_slug,
            operation_id=operation_id,
        ) as op:
            op.ok(
                "Migration planned",
                message=f"{source_label} -> {target.name}",
                details={"from": source_label, "to": target.name, "db_name": tenant.db_name},
            )

            try:
                # -- 1. dump from the source ----------------------------
                record.status = "backing_up"
                self.session.flush()
                op.started("Dumping database from source cluster", message=tenant.db_name)
                path, size = source_service.backup_database(tenant)
                record.backup_path = str(path)
                record.size_bytes = size
                self.session.flush()
                op.ok("Dump complete", message=f"{size} bytes", details={"path": str(path)})

                # -- 2. create the database on the target ---------------
                record.status = "restoring"
                self.session.flush()
                op.started("Creating database on target cluster", message=target.name)
                target_service.create_database(tenant)
                op.ok("Target database ready", message=tenant.db_name)

                # -- 3. restore into it ---------------------------------
                op.started("Restoring into target cluster", message=tenant.db_name)
                target_service.restore_database(tenant, record.backup_path)
                op.ok("Restore complete", message=tenant.db_name)

                # -- 4. repoint, then redeploy so the container picks up
                #       the new DSN. Until the redeploy lands, the running
                #       container is still talking to the source.
                record.status = "switching"
                self.session.flush()
                tenant.database_connection_id = target.id
                self.session.flush()
                op.ok("Tenant repointed", message=target.name)

                deployment = self.deployments.live_for(tenant)
                if deployment is not None:
                    op.started("Redeploying container against the new cluster")
                    self.redeploy(tenant.id, operation_id=operation_id)
                    op.ok("Container redeployed")
                else:
                    op.ok("No live deployment — container will use the new cluster on next provision")

            except Exception as exc:
                record.status = "failed"
                record.error_message = str(exc)
                record.completed_at = datetime.now(timezone.utc)
                # Roll the pointer back so the tenant keeps serving from the
                # source, which is still intact at every failure point.
                tenant.database_connection_id = record.from_connection_id
                self.session.flush()
                op.fail("Database migration failed", exc)
                raise

            # -- 5. only now is it safe to drop the source ---------------
            try:
                op.started("Dropping database on the source cluster", message=source_label)
                source_service.drop_database(tenant)
                op.ok("Source database dropped", message=source_label)
            except Exception as exc:
                # The move itself succeeded; a leftover database on the old
                # cluster is a cleanup task, not a failed migration.
                op.warn(
                    "Source database could not be dropped — remove it manually",
                    message=str(exc),
                    details={"cluster": source_label, "db_name": tenant.db_name},
                )

            record.status = "completed"
            record.completed_at = datetime.now(timezone.utc)
            self.session.flush()
            return tenant, record

    def list_db_migrations(self, tenant_id, limit=20, offset=0):
        tenant = self.get(tenant_id)
        stmt = select(TenantDatabaseMigration).where(
            TenantDatabaseMigration.tenant_id == tenant.id
        )
        total = self.session.scalar(select(func.count()).select_from(stmt.subquery()))
        rows = self.session.scalars(
            stmt.order_by(TenantDatabaseMigration.created_at.desc()).limit(limit).offset(offset)
        ).all()
        return rows, total
