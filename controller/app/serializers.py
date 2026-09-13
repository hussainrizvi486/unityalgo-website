"""Model -> JSON-safe dict conversion."""


class BaseSerializer:
    @staticmethod
    def iso(value):
        return value.isoformat() if value is not None else None

    @classmethod
    def dump(cls, instance, **options):
        raise NotImplementedError

    @classmethod
    def dump_many(cls, instances, **options):
        return [cls.dump(instance, **options) for instance in instances]


class ServerSerializer(BaseSerializer):
    @classmethod
    def dump(cls, server, include_secrets=False, **options):
        max_memory = server.max_memory_mb or 0
        used_memory = server.used_memory_mb or 0
        data = {
            "id": str(server.id),
            "name": server.name,
            "ip_address": server.ip_address,
            "ssh_port": server.ssh_port,
            "ssh_user": server.ssh_user,
            "ssh_key_path": server.ssh_key_path,
            "ssh_auth_method": server.ssh_auth_method,
            "has_ssh_password": bool(server.ssh_password),
            # Key content is never returned under any option, unlike
            # ssh_password -- there is no legitimate API use for handing a
            # private key back to a client.
            "has_ssh_key": bool(server.ssh_key_encrypted),
            "max_memory_mb": server.max_memory_mb,
            "used_memory_mb": server.used_memory_mb,
            "available_memory_mb": max_memory - used_memory,
            "max_containers": server.max_containers,
            "active_containers": server.active_containers,
            "role": server.role,
            "private_ip": server.private_ip,
            "proxy_admin_port": server.proxy_admin_port,
            "is_active": server.is_active,
            "specs": {
                "cpu_cores": server.cpu_cores,
                "disk_total_gb": server.disk_total_gb,
                "disk_used_gb": server.disk_used_gb,
                "os_name": server.os_name,
                "kernel_version": server.kernel_version,
                "architecture": server.architecture,
                "docker_version": server.docker_version,
            },
            "last_checked_at": cls.iso(server.last_checked_at),
            "last_check_status": server.last_check_status,
            "created_at": cls.iso(server.created_at),
        }
        # The SSH password is write-only unless a caller explicitly asks for it.
        if include_secrets:
            data["ssh_password"] = server.ssh_password
        return data


class TenantSerializer(BaseSerializer):
    @classmethod
    def dump(cls, tenant, include_secrets=False, **options):
        data = {
            "id": str(tenant.id),
            "tenant_slug": tenant.tenant_slug,
            "customer_email": tenant.customer_email,
            # Identity moved to the platform's shared "User" table; the old
            # customer_id column was dropped with the controller's own
            # customers table.
            "user_id": tenant.user_id,
            "subscription_id": tenant.subscription_id,
            # A cache of the linked plan's slug (app/services/account_resolver.py).
            "plan_tier": tenant.plan_tier,
            # The account this store belongs to, resolved through the
            # subscription. Null when the tenant predates the link or was
            # created without one -- the UI shows customer_email alone then.
            "customer": (
                {
                    "id": tenant.user.id,
                    "name": tenant.user.display_name,
                    "email": tenant.user.email,
                    "company": tenant.user.company,
                }
                if tenant.user is not None
                else None
            ),
            "subscription": (
                {
                    "id": tenant.subscription.id,
                    "status": tenant.subscription.status,
                    "store_name": tenant.subscription.storeName,
                    "plan": (
                        {
                            "id": tenant.subscription.plan.id,
                            "name": tenant.subscription.plan.name,
                            "slug": tenant.subscription.plan.slug,
                            "price_amount": tenant.subscription.plan.priceAmount,
                            "price_unit": tenant.subscription.plan.priceUnit,
                        }
                        if tenant.subscription.plan is not None
                        else None
                    ),
                }
                if tenant.subscription is not None
                else None
            ),
            "status": tenant.status,
            "node_id": str(tenant.node_id) if tenant.node_id else None,
            "database_connection_id": (
                str(tenant.database_connection_id) if tenant.database_connection_id else None
            ),
            # Null name means the tenant is on the legacy default cluster,
            # which has no database_connections row.
            "database_cluster": (
                tenant.database_connection.name if tenant.database_connection else None
            ),
            "container_id": tenant.container_id,
            "assigned_subdomain": tenant.assigned_subdomain,
            "custom_domain": tenant.custom_domain,
            "db_name": tenant.db_name,
            "db_user": tenant.db_user,
            "memory_limit_mb": tenant.memory_limit_mb,
            "cpu_limit_cores": (
                float(tenant.cpu_limit_cores)
                if tenant.cpu_limit_cores is not None
                else None
            ),
            "created_at": cls.iso(tenant.created_at),
            "updated_at": cls.iso(tenant.updated_at),
        }
        # The live deployment is where the tenant actually runs; node_id and
        # container_id above are a legacy mirror of it (dropped in Phase 4).
        deployment = tenant.live_deployment
        data["deployment"] = (
            DeploymentSerializer.dump(deployment) if deployment else None
        )
        data["upstream"] = deployment.upstream if deployment else None
        data["domains"] = DomainMappingSerializer.dump_many(tenant.domains)
        data["primary_domain"] = tenant.primary_domain
        # db_password stays out of API responses unless a caller explicitly asks
        # for it (the provisioning pipeline needs it to build the container env).
        if include_secrets:
            data["db_password"] = tenant.db_password
            data["jwt_secret"] = tenant.jwt_secret
        return data


class BackupSerializer(BaseSerializer):
    @classmethod
    def dump(cls, backup, **options):
        return {
            "id": str(backup.id),
            "tenant_id": str(backup.tenant_id),
            "node_id": str(backup.node_id) if backup.node_id else None,
            "status": backup.status,
            "reason": backup.reason,
            "backup_path": backup.backup_path,
            "size_bytes": backup.size_bytes,
            "error_message": backup.error_message,
            "created_at": cls.iso(backup.created_at),
            "completed_at": cls.iso(backup.completed_at),
        }


class MigrationSerializer(BaseSerializer):
    @classmethod
    def dump(cls, migration, **options):
        return {
            "id": str(migration.id),
            "tenant_id": str(migration.tenant_id),
            "from_node_id": str(migration.from_node_id) if migration.from_node_id else None,
            "to_node_id": str(migration.to_node_id),
            "backup_id": str(migration.backup_id) if migration.backup_id else None,
            "status": migration.status,
            "error_message": migration.error_message,
            "created_at": cls.iso(migration.created_at),
            "started_at": cls.iso(migration.started_at),
            "completed_at": cls.iso(migration.completed_at),
        }


class DeploymentSerializer(BaseSerializer):
    @classmethod
    def dump(cls, deployment, **options):
        return {
            "id": str(deployment.id),
            "tenant_id": str(deployment.tenant_id),
            "server_id": str(deployment.server_id),
            "application": deployment.application,
            "image": deployment.image,
            "container_name": deployment.container_name,
            "container_id": deployment.container_id,
            "port": deployment.port,
            "container_port": deployment.container_port,
            "status": deployment.status,
            "health_status": deployment.health_status,
            "health_message": deployment.health_message,
            "memory_limit_mb": deployment.memory_limit_mb,
            "cpu_limit_cores": (
                float(deployment.cpu_limit_cores)
                if deployment.cpu_limit_cores is not None
                else None
            ),
            "created_at": cls.iso(deployment.created_at),
            "started_at": cls.iso(deployment.started_at),
            "stopped_at": cls.iso(deployment.stopped_at),
            "last_health_at": cls.iso(deployment.last_health_at),
        }


class DomainMappingSerializer(BaseSerializer):
    @classmethod
    def dump(cls, mapping, **options):
        return {
            "id": str(mapping.id),
            "tenant_id": str(mapping.tenant_id),
            "deployment_id": str(mapping.deployment_id) if mapping.deployment_id else None,
            "domain": mapping.domain,
            "domain_type": mapping.domain_type,
            "status": mapping.status,
            "ssl_status": mapping.ssl_status,
            "is_routable": mapping.is_routable,
            "upstream": mapping.deployment.upstream if mapping.deployment else None,
            "verified_at": cls.iso(mapping.verified_at),
            "last_synced_at": cls.iso(mapping.last_synced_at),
            "created_at": cls.iso(mapping.created_at),
            "updated_at": cls.iso(mapping.updated_at),
        }


class ActivityLogSerializer(BaseSerializer):
    @classmethod
    def dump(cls, log, **options):
        return {
            "id": str(log.id),
            "operation_id": str(log.operation_id) if log.operation_id else None,
            "category": log.category,
            "action": log.action,
            "step_name": log.step_name,
            "step_index": log.step_index,
            "status": log.status,
            "message": log.message,
            "details": log.details,
            "error_message": log.error_message,
            "duration_ms": log.duration_ms,
            "tenant_id": str(log.tenant_id) if log.tenant_id else None,
            "server_id": str(log.server_id) if log.server_id else None,
            "customer_id": str(log.customer_id) if log.customer_id else None,
            "billing_record_id": (
                str(log.billing_record_id) if log.billing_record_id else None
            ),
            "tenant_slug": log.tenant_slug,
            "server_name": log.server_name,
            "customer_name": log.customer_name,
            "actor": log.actor,
            "created_at": cls.iso(log.created_at),
        }


class OperationSerializer(BaseSerializer):
    @classmethod
    def dump(cls, operation, steps=None, **options):
        data = {
            "id": str(operation.id),
            "kind": operation.kind,
            "category": operation.category,
            "label": operation.label,
            "status": operation.status,
            "step_count": operation.step_count,
            "duration_ms": operation.duration_ms,
            "error_message": operation.error_message,
            "tenant_id": str(operation.tenant_id) if operation.tenant_id else None,
            "server_id": str(operation.server_id) if operation.server_id else None,
            "customer_id": str(operation.customer_id) if operation.customer_id else None,
            "tenant_slug": operation.tenant_slug,
            "server_name": operation.server_name,
            "customer_name": operation.customer_name,
            "actor": operation.actor,
            "started_at": cls.iso(operation.started_at),
            "completed_at": cls.iso(operation.completed_at),
        }
        if steps is not None:
            data["steps"] = ActivityLogSerializer.dump_many(steps)
        return data


class BillingRecordSerializer(BaseSerializer):
    @classmethod
    def dump(cls, record, **options):
        return {
            "id": str(record.id),
            "customer_id": str(record.customer_id),
            "tenant_id": str(record.tenant_id) if record.tenant_id else None,
            "invoice_number": record.invoice_number,
            "description": record.description,
            "amount": float(record.amount) if record.amount is not None else None,
            "currency": record.currency,
            "status": record.status,
            "period_start": cls.iso(record.period_start),
            "period_end": cls.iso(record.period_end),
            "issued_at": cls.iso(record.issued_at),
            "due_date": cls.iso(record.due_date),
            "paid_at": cls.iso(record.paid_at),
            "payment_method": record.payment_method,
            "payment_reference": record.payment_reference,
            "notes": record.notes,
            "created_at": cls.iso(record.created_at),
            "updated_at": cls.iso(record.updated_at),
        }


class AddressSerializer(BaseSerializer):
    @classmethod
    def dump(cls, address, **options):
        return {
            "id": str(address.id),
            "customer_id": str(address.customer_id),
            "address_type": address.address_type,
            "label": address.label,
            "is_default": address.is_default,
            "line1": address.line1,
            "line2": address.line2,
            "city": address.city,
            "state": address.state,
            "postal_code": address.postal_code,
            "country": address.country,
            "created_at": cls.iso(address.created_at),
            "updated_at": cls.iso(address.updated_at),
        }


class CustomerSerializer(BaseSerializer):
    @classmethod
    def dump(cls, customer, **options):
        return {
            "id": str(customer.id),
            "name": customer.name,
            "email": customer.email,
            "company": customer.company,
            "phone": customer.phone,
            "is_active": customer.is_active,
            "first_name": customer.first_name,
            "last_name": customer.last_name,
            "job_title": customer.job_title,
            "alternate_phone": customer.alternate_phone,
            "website": customer.website,
            "tax_id": customer.tax_id,
            "industry": customer.industry,
            "company_size": customer.company_size,
            "preferred_currency": customer.preferred_currency,
            "notes": customer.notes,
            "addresses": AddressSerializer.dump_many(customer.addresses),
            "created_at": cls.iso(customer.created_at),
            "updated_at": cls.iso(customer.updated_at),
        }


class DatabaseConnectionSerializer(BaseSerializer):
    @classmethod
    def dump(cls, connection, **options):
        # password_encrypted (and any decrypted form of it) is never returned,
        # under any option -- unlike ServerNode.ssh_password / Tenant.db_password,
        # there is no legitimate API use for handing this back to a client.
        return {
            "id": str(connection.id),
            "name": connection.name,
            "host": connection.host,
            "port": connection.port,
            "database_name": connection.database_name,
            "username": connection.username,
            "has_password": bool(connection.password_encrypted),
            "sslmode": connection.sslmode,
            "notes": connection.notes,
            "role": connection.role,
            "host_from_worker": connection.host_from_worker,
            "is_default": connection.is_default,
            "allow_writes": connection.allow_writes,
            "last_tested_at": cls.iso(connection.last_tested_at),
            "last_test_status": connection.last_test_status,
            "last_test_message": connection.last_test_message,
            "created_at": cls.iso(connection.created_at),
            "updated_at": cls.iso(connection.updated_at),
        }


class UserSerializer(BaseSerializer):
    @classmethod
    def dump(cls, user, **options):
        # password_hash is never returned, under any option -- there is no
        # legitimate API use for it, unlike the write-only secrets elsewhere.
        return {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "last_login_at": cls.iso(user.last_login_at),
            "created_at": cls.iso(user.created_at),
        }


class DatabaseMigrationSerializer(BaseSerializer):
    """A tenant's move between database clusters."""

    @classmethod
    def dump(cls, migration, **options):
        return {
            "id": str(migration.id),
            "tenant_id": str(migration.tenant_id),
            "from_connection_id": (
                str(migration.from_connection_id) if migration.from_connection_id else None
            ),
            # None means the legacy default cluster, which has no row of its own.
            "from_cluster": (
                migration.from_connection.name if migration.from_connection else None
            ),
            "to_connection_id": str(migration.to_connection_id),
            "to_cluster": migration.to_connection.name if migration.to_connection else None,
            "status": migration.status,
            "size_bytes": migration.size_bytes,
            "error_message": migration.error_message,
            "created_at": cls.iso(migration.created_at),
            "started_at": cls.iso(migration.started_at),
            "completed_at": cls.iso(migration.completed_at),
        }
