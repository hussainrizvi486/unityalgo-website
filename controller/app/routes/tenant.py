from flask import Blueprint, request

from app.controller.tenant import TenantController
from app.errors import ConflictError, ValidationError
from app.serializers import (
    ActivityLogSerializer,
    BackupSerializer,
    DatabaseMigrationSerializer,
    MigrationSerializer,
    TenantSerializer,
)
from app.services.activity_logger import ActivityLogger
from app.status_codes import HTTP_200_OK, HTTP_201_CREATED, HTTP_202_ACCEPTED
from app.tasks.tenant_tasks import (
    create_backup_task,
    create_store_admin_task,
    migrate_tenant_task,
    migrate_tenant_database_task,
    provision_tenant_task,
    redeploy_tenant_task,
    restore_backup_task,
    run_db_migrations_task,
)

from .base import BaseView
from .domain import TenantDomainListView


class TenantBaseView(BaseView):
    controller_class = TenantController
    serializer_class = TenantSerializer

    def start_async(self, kind, label, category, task, task_kwargs, **log_context):
        """Mint an Operation row synchronously, enqueue the Celery task that
        will record steps against it, and hand the caller both ids right
        away -- this is what makes a 202 response pollable before the task
        has even started running."""
        operation_id = ActivityLogger(actor=self.actor()).start_operation(
            kind, label, category=category, **log_context
        )
        result = task.delay(operation_id=str(operation_id), actor=self.actor(), **task_kwargs)
        return self.ok(
            {"operation_id": str(operation_id), "task_id": result.id}, HTTP_202_ACCEPTED
        )


class TenantListView(TenantBaseView):
    """/api/v1/tenants -- collection."""

    def get(self):
        """List tenants.

        ?status=active&node_id=<uuid>&plan_tier=launch&user_id=<cuid>
        &subscription_id=<cuid>
        """
        limit, offset = self.pagination()
        with self.session() as session:
            rows, total = self.controller(session).list(
                status=self.str_arg("status"),
                node_id=self.str_arg("node_id"),
                plan_tier=self.str_arg("plan_tier"),
                user_id=self.str_arg("user_id"),
                subscription_id=self.str_arg("subscription_id"),
                limit=limit,
                offset=offset,
            )
            body = self.page(self.dump_many(rows), total, limit, offset)
        return self.ok(body, HTTP_200_OK)

    def post(self):
        """Create a pending tenant and assign it a node.

        Minimum body: {"tenant_slug": "store1", "subscription_id": "<cuid>"} --
        the customer and plan are read from the subscription. A tenant with no
        subscription yet is allowed if it names its owner some other way
        ({"user_id": ...} or {"customer_email": ...}).

        Subdomain and database credentials are generated when omitted.
        """
        payload = self.json_body()
        with self.session() as session:
            tenant = self.controller(session).create(payload)
            body = self.dump(tenant)
        return self.ok(body, HTTP_201_CREATED)


class TenantDetailView(TenantBaseView):
    """/api/v1/tenants/<id> -- single tenant."""

    def get(self, tenant_id):
        """?include_secrets=true also returns the generated db_password."""
        include_secrets = self.bool_arg("include_secrets", default=False)
        with self.session() as session:
            tenant = self.controller(session).get(tenant_id)
            body = self.dump(tenant, include_secrets=include_secrets)
        return self.ok(body, HTTP_200_OK)

    def patch(self, tenant_id):
        payload = self.json_body()
        with self.session() as session:
            body = self.dump(self.controller(session).update(tenant_id, payload))
        return self.ok(body, HTTP_200_OK)

    put = patch

    def delete(self, tenant_id):
        """?force=true deletes even when a container is still recorded."""
        force = self.bool_arg("force", default=False)
        with self.session() as session:
            self.controller(session).delete(tenant_id, force=force)
        return self.no_content()


class TenantSlugView(TenantBaseView):
    """/api/v1/tenants/slug/<slug> -- lookup by the slug the storefront uses."""

    def get(self, slug):
        with self.session() as session:
            body = self.dump(self.controller(session).get_by_slug(slug))
        return self.ok(body, HTTP_200_OK)


class TenantStatusView(TenantBaseView):
    """/api/v1/tenants/<id>/status -- lifecycle shortcut."""

    def patch(self, tenant_id):
        payload = self.json_body()
        if not isinstance(payload, dict) or "status" not in payload:
            raise ValidationError("'status' is required", field="status")
        with self.session() as session:
            tenant = self.controller(session).set_status(tenant_id, payload["status"])
            body = self.dump(tenant)
        return self.ok(body, HTTP_200_OK)


class TenantProvisionView(TenantBaseView):
    """/api/v1/tenants/<id>/provision -- first-time: create DB + container.

    Runs on Celery -- returns 202 with {operation_id, task_id} immediately;
    poll GET /api/v1/logs/operations/<operation_id> for progress.
    """

    def post(self, tenant_id):
        with self.session() as session:
            controller = self.controller(session)
            tenant = controller.get(tenant_id)
            if controller.deployments.live_for(tenant):
                raise ConflictError(
                    "Tenant is already provisioned; use start/stop/resize/migrate"
                )
            return self.start_async(
                "tenant.provision",
                f"Tenant provisioning: {tenant.tenant_slug}",
                "deployment",
                provision_tenant_task,
                {"tenant_id": str(tenant.id)},
                **controller.log_context(tenant),
            )


class TenantRedeployView(TenantBaseView):
    """/api/v1/tenants/<id>/redeploy -- recreate the container in place.

    Body (all optional): {"pull": true, "image": "ghcr.io/...:tag"}. Falls
    through to the provision task if the tenant was never deployed, so this
    action always does the sensible thing. Runs on Celery -- 202 response.
    """

    def post(self, tenant_id):
        payload = request.get_json(silent=True) or {}
        with self.session() as session:
            controller = self.controller(session)
            tenant = controller.get(tenant_id)
            log_context = controller.log_context(tenant)
            if controller.deployments.current_for(tenant) is None:
                return self.start_async(
                    "tenant.provision",
                    f"Tenant provisioning: {tenant.tenant_slug}",
                    "deployment",
                    provision_tenant_task,
                    {"tenant_id": str(tenant.id)},
                    **log_context,
                )
            return self.start_async(
                "tenant.redeploy",
                f"Redeploy tenant: {tenant.tenant_slug}",
                "deployment",
                redeploy_tenant_task,
                {
                    "tenant_id": str(tenant.id),
                    "pull": payload.get("pull", True),
                    "image": payload.get("image"),
                },
                **log_context,
            )


class TenantDbMigrateView(TenantBaseView):
    """/api/v1/tenants/<id>/db-migrate -- create/upgrade the tenant schema.

    Distinct from /migrate, which moves the container to another node.
    Runs on Celery -- 202 response.
    """

    def post(self, tenant_id):
        with self.session() as session:
            controller = self.controller(session)
            tenant = controller.get(tenant_id)
            if controller.deployments.current_for(tenant) is None:
                raise ConflictError(
                    "Tenant has no deployment; provision it before running migrations"
                )
            return self.start_async(
                "tenant.db_migrate",
                f"Database migration: {tenant.tenant_slug}",
                "database",
                run_db_migrations_task,
                {"tenant_id": str(tenant.id)},
                **controller.log_context(tenant),
            )


class TenantStoreAdminView(TenantBaseView):
    """/api/v1/tenants/<id>/store-admin -- seed a storefront login.

    Body: {"email": "...", "password": "...", "name": "optional"}. Runs on
    Celery -- 202 response.
    """

    def post(self, tenant_id):
        payload = self.json_body()
        if not isinstance(payload, dict):
            raise ValidationError("Request body must be a JSON object")
        with self.session() as session:
            controller = self.controller(session)
            tenant = controller.get(tenant_id)
            if controller.deployments.current_for(tenant) is None:
                raise ConflictError(
                    "Tenant has no deployment; provision it before creating a "
                    "storefront admin"
                )
            email = controller.validator.email(payload.get("email"), "email")
            password = controller.validator.string(
                payload.get("password"), "password", max_length=255
            )
            if len(password) < 8:
                raise ValidationError(
                    "'password' must be at least 8 characters", field="password"
                )
            return self.start_async(
                "tenant.create_store_admin",
                f"Storefront admin: {tenant.tenant_slug}",
                "tenant",
                create_store_admin_task,
                {
                    "tenant_id": str(tenant.id),
                    "email": email,
                    "password": password,
                    "name": payload.get("name"),
                },
                **controller.log_context(tenant),
            )


class TenantStopView(TenantBaseView):
    """/api/v1/tenants/<id>/stop -- suspend: stop the container."""

    def post(self, tenant_id):
        with self.session() as session:
            body = self.dump(self.controller(session).stop(tenant_id))
        return self.ok(body, HTTP_200_OK)


class TenantStartView(TenantBaseView):
    """/api/v1/tenants/<id>/start -- resume, or recreate if missing."""

    def post(self, tenant_id):
        with self.session() as session:
            body = self.dump(self.controller(session).start(tenant_id))
        return self.ok(body, HTTP_200_OK)


class TenantResizeView(TenantBaseView):
    """/api/v1/tenants/<id>/resize -- change memory/CPU caps, live if running."""

    def post(self, tenant_id):
        payload = self.json_body()
        with self.session() as session:
            tenant = self.controller(session).resize(
                tenant_id,
                memory_limit_mb=payload.get("memory_limit_mb"),
                cpu_limit_cores=payload.get("cpu_limit_cores"),
            )
            body = self.dump(tenant)
        return self.ok(body, HTTP_200_OK)


class TenantStatsView(TenantBaseView):
    """/api/v1/tenants/<id>/stats -- live CPU/memory usage."""

    def get(self, tenant_id):
        with self.session() as session:
            stats = self.controller(session).stats(tenant_id)
        return self.ok(stats or {}, HTTP_200_OK)


class TenantLogsView(TenantBaseView):
    """/api/v1/tenants/<id>/container-logs -- tail of the container's stdout."""

    def get(self, tenant_id):
        tail = self.int_arg("tail", 200, minimum=1, maximum=5000)
        with self.session() as session:
            logs = self.controller(session).logs(tenant_id, tail=tail)
        return self.ok({"logs": logs}, HTTP_200_OK)


class TenantMigrateView(TenantBaseView):
    """/api/v1/tenants/<id>/migrate -- move the container to another node.

    Runs on Celery -- 202 response. The target node is resolved and checked
    synchronously (cheap, DB-only) so an obviously-doomed request still fails
    fast instead of becoming a 202 that immediately fails in the worker.
    """

    def post(self, tenant_id):
        payload = self.json_body()
        if not isinstance(payload, dict) or not payload.get("target_node_id"):
            raise ValidationError("'target_node_id' is required", field="target_node_id")
        backup_first = payload.get("backup_first", True)
        if not isinstance(backup_first, bool):
            raise ValidationError("'backup_first' must be a boolean", field="backup_first")
        with self.session() as session:
            controller = self.controller(session)
            tenant = controller.get(tenant_id)
            target = controller.servers.get(payload["target_node_id"])
            current = controller.deployments.current_for(tenant)
            if current is not None and current.server_id == target.id:
                raise ConflictError("Tenant is already on that node")
            return self.start_async(
                "tenant.migrate",
                f"Tenant migration: {tenant.tenant_slug} -> {target.name}",
                "migration",
                migrate_tenant_task,
    migrate_tenant_database_task,
                {
                    "tenant_id": str(tenant.id),
                    "target_node_id": str(target.id),
                    "backup_first": backup_first,
                },
                **controller.log_context(tenant),
            )


class TenantDatabaseMigrateView(TenantBaseView):
    """/api/v1/tenants/<id>/migrate-database -- move data to another cluster.

    Distinct from /migrate (which moves the container between nodes and copies
    nothing) and from /db-migrate (which runs schema migrations in place).
    Runs on Celery -- 202 response -- since it dumps and restores the whole
    tenant database.
    """

    def post(self, tenant_id):
        payload = self.json_body()
        if not isinstance(payload, dict) or not payload.get("target_connection_id"):
            raise ValidationError(
                "'target_connection_id' is required", field="target_connection_id"
            )
        with self.session() as session:
            controller = self.controller(session)
            tenant = controller.get(tenant_id)
            # Resolved synchronously so an invalid or non-cluster target fails
            # fast with a 4xx instead of becoming a 202 that dies in the worker.
            target = controller._require_cluster(payload["target_connection_id"])
            if tenant.database_connection_id == target.id:
                raise ConflictError(f"Tenant is already on cluster '{target.name}'")
            return self.start_async(
                "tenant.migrate_database",
                f"Tenant database migration: {tenant.tenant_slug} -> {target.name}",
                "database",
                migrate_tenant_database_task,
                {
                    "tenant_id": str(tenant.id),
                    "target_connection_id": str(target.id),
                },
                **controller.log_context(tenant),
            )


class TenantDatabaseMigrationListView(TenantBaseView):
    """/api/v1/tenants/<id>/db-migrations -- cluster migration history."""

    def get(self, tenant_id):
        limit, offset = self.pagination()
        with self.session() as session:
            rows, total = self.controller(session).list_db_migrations(
                tenant_id, limit=limit, offset=offset
            )
            body = self.page(
                DatabaseMigrationSerializer.dump_many(rows), total, limit, offset
            )
        return self.ok(body, HTTP_200_OK)


class TenantMigrationListView(TenantBaseView):
    """/api/v1/tenants/<id>/migrations -- migration history."""

    def get(self, tenant_id):
        limit, offset = self.pagination()
        with self.session() as session:
            rows, total = self.controller(session).list_migrations(
                tenant_id, limit=limit, offset=offset
            )
            body = self.page(MigrationSerializer.dump_many(rows), total, limit, offset)
        return self.ok(body, HTTP_200_OK)


class TenantBackupListView(TenantBaseView):
    """/api/v1/tenants/<id>/backups -- list, or trigger a new pg_dump backup."""

    def get(self, tenant_id):
        limit, offset = self.pagination()
        with self.session() as session:
            rows, total = self.controller(session).list_backups(
                tenant_id, limit=limit, offset=offset
            )
            body = self.page(BackupSerializer.dump_many(rows), total, limit, offset)
        return self.ok(body, HTTP_200_OK)

    def post(self, tenant_id):
        """Trigger a pg_dump backup now. No request body required. Runs on
        Celery -- 202 response."""
        with self.session() as session:
            controller = self.controller(session)
            tenant = controller.get(tenant_id)
            return self.start_async(
                "tenant.backup",
                f"Backup tenant: {tenant.tenant_slug}",
                "backup",
                create_backup_task,
                {"tenant_id": str(tenant.id), "reason": "manual"},
                **controller.log_context(tenant),
            )


class TenantBackupDetailView(TenantBaseView):
    """/api/v1/tenants/<id>/backups/<backup_id>"""

    def get(self, tenant_id, backup_id):
        with self.session() as session:
            body = BackupSerializer.dump(
                self.controller(session).get_backup(tenant_id, backup_id)
            )
        return self.ok(body, HTTP_200_OK)


class TenantBackupRestoreView(TenantBaseView):
    """/api/v1/tenants/<id>/backups/<backup_id>/restore -- runs on Celery,
    202 response. The backup is looked up and checked synchronously (cheap,
    DB-only) so restoring a failed/missing backup fails fast."""

    def post(self, tenant_id, backup_id):
        with self.session() as session:
            controller = self.controller(session)
            tenant = controller.get(tenant_id)
            backup = controller.get_backup(tenant_id, backup_id)
            if backup.status != "success" or not backup.backup_path:
                raise ConflictError("Only a successful backup can be restored")
            return self.start_async(
                "tenant.restore",
                f"Restore backup: {tenant.tenant_slug}",
                "backup",
                restore_backup_task,
                {"tenant_id": str(tenant.id), "backup_id": str(backup.id)},
                **controller.log_context(tenant),
            )


class TenantLogListView(TenantBaseView):
    """/api/v1/tenants/<id>/logs -- provisioning/lifecycle audit trail."""

    def get(self, tenant_id):
        limit, offset = self.pagination()
        with self.session() as session:
            rows, total = self.controller(session).list_logs(
                tenant_id, limit=limit, offset=offset
            )
            body = self.page(ActivityLogSerializer.dump_many(rows), total, limit, offset)
        return self.ok(body, HTTP_200_OK)


class LegacyTenantCreateView(TenantListView):
    """Deprecated alias for the original URL. Use POST /api/v1/tenants."""

    def get(self):
        raise ValidationError("Use GET /api/v1/tenants")


class LegacyRoutes:
    """Keeps the pre-refactor tenant-creation URL alive."""

    @classmethod
    def blueprint(cls, db=None, config=None):
        bp = Blueprint("legacy", __name__)
        bp.add_url_rule(
            "/api/v1/create/tenant",
            view_func=LegacyTenantCreateView.as_view(
                "create_tenant", db=db, config=config
            ),
            methods=["POST"],
        )
        return bp


class TenantRoutes:
    """Builds the tenants blueprint."""

    url_prefix = "/api/v1/tenants"

    @classmethod
    def blueprint(cls, db=None, config=None):
        bp = Blueprint("tenants", __name__, url_prefix=cls.url_prefix)
        bp.add_url_rule(
            "", view_func=TenantListView.as_view("collection", db=db, config=config)
        )
        bp.add_url_rule(
            "/slug/<slug>",
            view_func=TenantSlugView.as_view("by_slug", db=db, config=config),
        )
        bp.add_url_rule(
            "/<tenant_id>/status",
            view_func=TenantStatusView.as_view("status", db=db, config=config),
        )
        bp.add_url_rule(
            "/<tenant_id>/provision",
            view_func=TenantProvisionView.as_view("provision", db=db, config=config),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<tenant_id>/redeploy",
            view_func=TenantRedeployView.as_view("redeploy", db=db, config=config),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<tenant_id>/db-migrate",
            view_func=TenantDbMigrateView.as_view("db_migrate", db=db, config=config),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<tenant_id>/store-admin",
            view_func=TenantStoreAdminView.as_view("store_admin", db=db, config=config),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<tenant_id>/stop",
            view_func=TenantStopView.as_view("stop", db=db, config=config),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<tenant_id>/start",
            view_func=TenantStartView.as_view("start", db=db, config=config),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<tenant_id>/resize",
            view_func=TenantResizeView.as_view("resize", db=db, config=config),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<tenant_id>/stats",
            view_func=TenantStatsView.as_view("stats", db=db, config=config),
            methods=["GET"],
        )
        bp.add_url_rule(
            "/<tenant_id>/container-logs",
            view_func=TenantLogsView.as_view("container_logs", db=db, config=config),
            methods=["GET"],
        )
        bp.add_url_rule(
            "/<tenant_id>/migrate-database",
            view_func=TenantDatabaseMigrateView.as_view("migrate_database", db=db, config=config),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<tenant_id>/db-migrations",
            view_func=TenantDatabaseMigrationListView.as_view("db_migrations", db=db, config=config),
            methods=["GET"],
        )
        bp.add_url_rule(
            "/<tenant_id>/migrate",
            view_func=TenantMigrateView.as_view("migrate", db=db, config=config),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<tenant_id>/migrations",
            view_func=TenantMigrationListView.as_view("migrations", db=db, config=config),
            methods=["GET"],
        )
        bp.add_url_rule(
            "/<tenant_id>/backups",
            view_func=TenantBackupListView.as_view("backups", db=db, config=config),
            methods=["GET", "POST"],
        )
        bp.add_url_rule(
            "/<tenant_id>/domains",
            view_func=TenantDomainListView.as_view("domains", db=db, config=config),
            methods=["GET", "POST"],
        )
        bp.add_url_rule(
            "/<tenant_id>/backups/<backup_id>",
            view_func=TenantBackupDetailView.as_view(
                "backup_detail", db=db, config=config
            ),
            methods=["GET"],
        )
        bp.add_url_rule(
            "/<tenant_id>/backups/<backup_id>/restore",
            view_func=TenantBackupRestoreView.as_view(
                "backup_restore", db=db, config=config
            ),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<tenant_id>/logs",
            view_func=TenantLogListView.as_view("logs", db=db, config=config),
            methods=["GET"],
        )
        bp.add_url_rule(
            "/<tenant_id>",
            view_func=TenantDetailView.as_view("detail", db=db, config=config),
        )
        return bp
