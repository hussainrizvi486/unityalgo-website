from flask import Blueprint

from app.controller.domain import DomainController
from app.serializers import DomainMappingSerializer
from app.status_codes import HTTP_200_OK, HTTP_201_CREATED

from .base import BaseView


class DomainBaseView(BaseView):
    controller_class = DomainController
    serializer_class = DomainMappingSerializer


class TenantDomainListView(DomainBaseView):
    """/api/v1/tenants/<tenant_id>/domains -- collection, scoped to one tenant."""

    def get(self, tenant_id):
        limit, offset = self.pagination()
        with self.session() as session:
            rows, total = self.controller(session).list_for_tenant(
                tenant_id, limit=limit, offset=offset
            )
            body = self.page(self.dump_many(rows), total, limit, offset)
        return self.ok(body, HTTP_200_OK)

    def post(self, tenant_id):
        """Add a custom domain. Body: {"domain": "shop.customer.com"}."""
        payload = self.json_body()
        payload["tenant_id"] = tenant_id
        with self.session() as session:
            mapping = self.controller(session).create(payload)
            body = self.dump(mapping)
        return self.ok(body, HTTP_201_CREATED)


class DomainDetailView(DomainBaseView):
    """/api/v1/domains/<id>."""

    def get(self, domain_id):
        with self.session() as session:
            body = self.dump(self.controller(session).get(domain_id))
        return self.ok(body, HTTP_200_OK)

    def delete(self, domain_id):
        """?force=true also removes a platform domain."""
        force = self.bool_arg("force", default=False)
        with self.session() as session:
            self.controller(session).delete(domain_id, force=force)
        return self.no_content()


class DomainActivateView(DomainBaseView):
    """POST /api/v1/domains/<id>/activate -- no-DNS-check activate, for the
    platform domain only (already pointed at us by construction)."""

    def post(self, domain_id):
        with self.session() as session:
            body = self.dump(self.controller(session).activate(domain_id))
        return self.ok(body, HTTP_200_OK)


class DomainVerifyView(DomainBaseView):
    """POST /api/v1/domains/<id>/verify -- real DNS-ownership check for a
    custom domain, activating it in the same step on success."""

    def post(self, domain_id):
        with self.session() as session:
            body = self.dump(self.controller(session).verify_and_activate(domain_id))
        return self.ok(body, HTTP_200_OK)


class DomainDisableView(DomainBaseView):
    """POST /api/v1/domains/<id>/disable"""

    def post(self, domain_id):
        with self.session() as session:
            body = self.dump(self.controller(session).disable(domain_id))
        return self.ok(body, HTTP_200_OK)


class DomainRoutes:
    """Builds the /api/v1/domains blueprint, plus the nested tenant list."""

    url_prefix = "/api/v1/domains"

    @classmethod
    def blueprint(cls, db=None, config=None):
        bp = Blueprint("domains", __name__, url_prefix=cls.url_prefix)
        bp.add_url_rule(
            "/<domain_id>",
            view_func=DomainDetailView.as_view("detail", db=db, config=config),
        )
        bp.add_url_rule(
            "/<domain_id>/activate",
            view_func=DomainActivateView.as_view("activate", db=db, config=config),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<domain_id>/disable",
            view_func=DomainDisableView.as_view("disable", db=db, config=config),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<domain_id>/verify",
            view_func=DomainVerifyView.as_view("verify", db=db, config=config),
            methods=["POST"],
        )
        return bp
