
import socket
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from app.controller.base import BaseController
from app.errors import ConflictError, NotFoundError
from app.models.deployment import Deployment
from app.models.domain import DomainMapping
from app.models.server import ServerNode, Tenant


class DomainController(BaseController):
    model = DomainMapping
    resource_name = "domain"
    DOMAIN_TYPES = DomainMapping.DOMAIN_TYPES
    STATUSES = DomainMapping.STATUSES
    SSL_STATUSES = DomainMapping.SSL_STATUSES

    writable_fields = ("tenant_id", "domain")
    required_on_create = ("tenant_id", "domain")

    def base_query(self):
        return select(DomainMapping).options(joinedload(DomainMapping.deployment))

    def clean(self, data, partial):
        self.check_payload(data, partial)
        v = self.validator
        values = {}
        if "tenant_id" in data:
            values["tenant_id"] = v.uuid(data["tenant_id"], "tenant_id")
        if "domain" in data:
            values["domain"] = v.hostname(data["domain"], "domain")
        if "status" in data:
            values["status"] = v.choice(data["status"], "status", self.STATUSES)
        return values

    def apply_defaults(self, values):
        values.setdefault("domain_type", "custom")
        values.setdefault("status", "pending")
        values.setdefault("ssl_status", "none")
        tenant = self._require_tenant(values["tenant_id"])

        live = self.session.scalars(
            select(Deployment).where(
                Deployment.tenant_id == tenant.id, Deployment.status == "live"
            )
        ).first()
        if live:
            values.setdefault("deployment_id", live.id)
        return values

    def before_delete(self, mapping, force):
        if mapping.domain_type == "platform" and not force:
            raise ConflictError(
                "The platform domain cannot be deleted directly; delete the "
                "tenant, or retry with ?force=true"
            )

    def delete(self, resource_id, force=False):
        instance = super().delete(resource_id, force)
        self._sync_proxy()
        return instance

    def conflict_message(self, values):
        domain = values.get("domain")
        return f"Domain '{domain}' is already mapped to a tenant"

    def _require_tenant(self, tenant_id):
        tenant = self.session.get(Tenant, tenant_id)
        if tenant is None:
            raise NotFoundError(f"Tenant '{tenant_id}' not found")
        return tenant

    def list_for_tenant(self, tenant_id, limit=50, offset=0):
        tenant_id = self.validator.uuid(tenant_id, "tenant_id")
        total = self.session.scalar(
            select(func.count())
            .select_from(DomainMapping)
            .where(DomainMapping.tenant_id == tenant_id)
        )
        rows = self.session.scalars(
            self.base_query()
            .where(DomainMapping.tenant_id == tenant_id)
            .order_by(DomainMapping.created_at.asc())
            .limit(limit)
            .offset(offset)
        ).all()
        return rows, total

    def platform_for(self, tenant):
        return self.session.scalars(
            self.base_query().where(
                DomainMapping.tenant_id == tenant.id,
                DomainMapping.domain_type == "platform",
            )
        ).first()

    def get_by_domain(self, domain):
        mapping = self.session.scalars(
            self.base_query().where(DomainMapping.domain == domain.strip().lower())
        ).first()
        if mapping is None:
            raise NotFoundError(f"Domain '{domain}' not found")
        return mapping

    def routable(self, limit=1000):
        rows = self.session.scalars(self.base_query().limit(limit)).all()
        return [r for r in rows if r.is_routable]

    def ensure_platform_mapping(self, tenant, recorder=None):
        """Reserve the tenant's platform subdomain. Idempotent."""
        existing = self.platform_for(tenant)
        if existing:
            return existing

        domain = self.settings.subdomain_for(tenant.tenant_slug)
        mapping = DomainMapping(
            tenant_id=tenant.id, domain=domain, domain_type="platform",
            status="pending", ssl_status="none",
        )
        self.session.add(mapping)
        try:
            self.session.flush()
        except IntegrityError as exc:
            self.session.rollback()
            raise ConflictError(f"Platform domain '{domain}' is already in use") from exc

        if recorder:
            recorder.ok("Platform domain reserved", message=domain)
        return mapping

    def repoint_all(self, tenant, deployment, recorder=None):
        mappings = self.session.scalars(
            select(DomainMapping).where(DomainMapping.tenant_id == tenant.id)
        ).all()
        for mapping in mappings:
            mapping.deployment_id = deployment.id if deployment else None
            mapping.status = "active" if deployment else "pending"
            mapping.last_synced_at = datetime.now(timezone.utc)
        self.session.flush()
        if recorder and mappings:
            recorder.ok(
                "Domains repointed",
                message=(
                    f"{len(mappings)} domain(s) -> "
                    f"{deployment.upstream if deployment else 'unrouted'}"
                ),
                details={"domains": [m.domain for m in mappings]},
            )
        return mappings

    def activate(self, mapping_id):
        mapping = self.get(mapping_id)
        if mapping.deployment_id is None:
            raise ConflictError(
                "This domain has no deployment to route to yet; provision "
                "the tenant first"
            )
        mapping.status = "active"
        mapping.verified_at = datetime.now(timezone.utc)
        self.session.flush()
        self._sync_proxy()
        return mapping

    def verify_and_activate(self, mapping_id):
        mapping = self.get(mapping_id)
        if mapping.domain_type == "platform":
            raise ConflictError("The platform domain doesn't need DNS verification")
        if mapping.deployment_id is None:
            raise ConflictError(
                "This domain has no deployment to route to yet; provision "
                "the tenant first"
            )

        proxy = self.session.scalars(
            select(ServerNode).where(
                ServerNode.role == "proxy", ServerNode.is_active.is_(True)
            )
        ).first()
        if proxy is None:
            raise ConflictError(
                "No proxy node is registered yet; DNS can't be verified "
                "until domain routing is set up"
            )

        try:
            resolved = {
                info[4][0] for info in socket.getaddrinfo(mapping.domain, None)
            }
        except socket.gaierror as exc:
            raise ConflictError(
                f"Could not resolve '{mapping.domain}': {exc}"
            ) from exc

        if proxy.ip_address not in resolved:
            raise ConflictError(
                f"'{mapping.domain}' does not point at {proxy.ip_address} yet "
                f"(currently resolves to {', '.join(sorted(resolved)) or 'nothing'})"
            )

        mapping.status = "active"
        mapping.verified_at = datetime.now(timezone.utc)
        self.session.flush()
        self._sync_proxy()
        return mapping

    def disable(self, mapping_id):
        mapping = self.get(mapping_id)
        if mapping.domain_type == "platform":
            raise ConflictError("The platform domain cannot be disabled")
        mapping.status = "disabled"
        self.session.flush()
        self._sync_proxy()
        return mapping

    def _sync_proxy(self):
        from app.services.proxy_configuration_service import ProxyConfigurationService

        proxy = self.session.scalars(
            select(ServerNode).where(
                ServerNode.role == "proxy", ServerNode.is_active.is_(True)
            )
        ).first()
        if proxy is not None:
            ProxyConfigurationService(self.settings).sync_all(self.session)
