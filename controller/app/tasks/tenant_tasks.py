"""Celery tasks wrapping TenantController's long-running methods.

Each task just opens a session and calls the same controller method the
synchronous admin/API routes used to call directly -- no controller logic
changes, no new progress-reporting mechanism. `operation_id` is minted by
the route *before* the task is enqueued (see app/routes/tenant.py), so the
202 response can hand the caller an id to poll immediately; the task resumes
recording steps against that same row via ActivityLogger.operation().

`stop`/`start`/`resize` deliberately have no task here -- they're single
fast SSH commands and stay synchronous.
"""

from app.config import settings
from app.controller.tenant import TenantController
from app.db import database
from app.tasks.base import DBTask
from app.tasks.celery_app import celery_app


@celery_app.task(bind=True, base=DBTask, name="tenant.provision")
def provision_tenant_task(self, tenant_id, operation_id, server_id=None, actor=None):
    with database.session() as session:
        TenantController(session, settings, actor=actor).provision(
            tenant_id, server_id=server_id, operation_id=operation_id
        )


@celery_app.task(bind=True, base=DBTask, name="tenant.redeploy")
def redeploy_tenant_task(self, tenant_id, operation_id, pull=True, image=None, actor=None):
    with database.session() as session:
        TenantController(session, settings, actor=actor).redeploy(
            tenant_id, pull=pull, image=image, operation_id=operation_id
        )


@celery_app.task(bind=True, base=DBTask, name="tenant.db_migrate")
def run_db_migrations_task(self, tenant_id, operation_id, actor=None):
    with database.session() as session:
        TenantController(session, settings, actor=actor).run_db_migrations(
            tenant_id, operation_id=operation_id
        )


@celery_app.task(bind=True, base=DBTask, name="tenant.create_store_admin")
def create_store_admin_task(self, tenant_id, operation_id, email, password, name=None, actor=None):
    with database.session() as session:
        TenantController(session, settings, actor=actor).create_store_admin(
            tenant_id, email=email, password=password, name=name, operation_id=operation_id
        )


@celery_app.task(bind=True, base=DBTask, name="tenant.migrate")
def migrate_tenant_task(self, tenant_id, operation_id, target_node_id, backup_first=True, actor=None):
    with database.session() as session:
        TenantController(session, settings, actor=actor).migrate(
            tenant_id, target_node_id, backup_first=backup_first, operation_id=operation_id
        )


@celery_app.task(bind=True, base=DBTask, name="tenant.migrate_database")
def migrate_tenant_database_task(self, tenant_id, operation_id, target_connection_id, actor=None):
    """Move a tenant's data to another cluster.

    Queued rather than synchronous because it is a dump + restore of the whole
    tenant database, which is unbounded in duration.
    """
    with database.session() as session:
        TenantController(session, settings, actor=actor).migrate_database(
            tenant_id, target_connection_id, operation_id=operation_id
        )


@celery_app.task(bind=True, base=DBTask, name="tenant.backup")
def create_backup_task(self, tenant_id, operation_id, reason="manual", actor=None):
    with database.session() as session:
        TenantController(session, settings, actor=actor).create_backup(
            tenant_id, reason=reason, operation_id=operation_id
        )


@celery_app.task(bind=True, base=DBTask, name="tenant.restore")
def restore_backup_task(self, tenant_id, operation_id, backup_id, actor=None):
    with database.session() as session:
        TenantController(session, settings, actor=actor).restore_backup(
            tenant_id, backup_id, operation_id=operation_id
        )
