
from app.config import settings as default_settings
from app.errors import ProxyConfigurationError
from app.services.caddy_admin_client import CaddyAdminClient
from sqlalchemy import select, text
from sqlalchemy.orm import joinedload
from app.models.site import Site
from app.models.site_extras import SiteDomain


class ProxyConfigurationService:
    def __init__(self, config=None):
        self.settings = config or default_settings

    def render_config(self, session):
        from app.controller.domain import DomainController

        routable = DomainController(session, self.settings).routable()
        routes = []
        for mapping in routable:
            routes.append(
                {
                    "@id": f"domain-{mapping.id}",
                    "match": [{"host": [mapping.domain]}],
                    "handle": [
                        {
                            "handler": "reverse_proxy",
                            "upstreams": [{"dial": mapping.deployment.upstream}],
                        }
                    ],
                }
            )
        for site in session.scalars(select(Site).options(joinedload(Site.server)).where(Site.status.in_(['routing', 'ready', 'stopping', 'stopped', 'restarting', 'restoring', 'updating']))):
            hosts = [site.domain, *session.scalars(select(SiteDomain.domain).where(SiteDomain.site_id == site.id, SiteDomain.status == 'active').order_by(SiteDomain.domain))]
            routes.append({
                '@id': f'site-{site.id}', 'match': [{'host': hosts}],
                'handle': [{'handler': 'reverse_proxy', 'upstreams': [{'dial': f'{site.server.dial_host}:{site.port}'}]}],
            })
        listen = [":443"] if self.settings.proxy_enable_tls else [":80"]
        return {
            "admin": {"listen": "127.0.0.1:2019"},
            "apps": {
                "http": {
                    "servers": {
                        "srv0": {
                            "listen": listen,
                            "routes": routes,
                        }
                    }
                }
            },
        }

    def sync_all(self, session, recorder=None):
        from app.controller.server import ServerController
        session.execute(text("SELECT pg_advisory_xact_lock(hashtext('proxy-route-sync'))"))
        proxy = ServerController(session, self.settings).proxy_node()
        if proxy is None:
            if recorder:
                recorder.warn(
                    "No proxy node registered",
                    message="Tenant reachable at IP:PORT only -- register a "
                    "role='proxy' server to enable domain routing",
                )
            return None

        document = self.render_config(session)
        CaddyAdminClient(proxy, self.settings).load(document)
        if recorder:
            recorder.ok(
                "Proxy routes synced",
                message=f"{len(document['apps']['http']['servers']['srv0']['routes'])} "
                f"route(s) on {proxy.name}",
            )
        return document

    def verify(self, session):
        from app.controller.server import ServerController

        proxy = ServerController(session, self.settings).proxy_node()
        if proxy is None:
            return {"in_sync": None, "message": "No proxy node registered"}

        expected = self.render_config(session)
        expected_routes = expected["apps"]["http"]["servers"]["srv0"]["routes"]
        expected_ids = {route["@id"] for route in expected_routes}

        try:
            actual = CaddyAdminClient(proxy, self.settings).get_config(
                "apps/http/servers/srv0/routes"
            )
        except ProxyConfigurationError:
            actual = None
        actual_routes = actual or []
        actual_ids = {route.get("@id") for route in actual_routes if route.get("@id")}

        return {
            "in_sync": expected_ids == actual_ids,
            "expected_route_count": len(expected_ids),
            "actual_route_count": len(actual_ids),
            "missing": sorted(expected_ids - actual_ids),
            "extra": sorted(actual_ids - expected_ids),
        }
