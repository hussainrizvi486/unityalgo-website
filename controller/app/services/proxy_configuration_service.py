"""Builds and pushes the Caddy edge config from `domain_mappings`.

Always a full rebuild-and-push, not partial route upserts: `sync_all()` is
called after every provision/migrate/stop/start, and since those already run
inside a Celery task (no Flask-request blocking concern), doing the simplest
possible thing -- render the whole desired state, POST /load it -- trades a
little efficiency for having no partial-update drift to debug. This is also
exactly what a partial API would have to be checked against anyway.
"""

from app.config import settings as default_settings
from app.errors import ProxyConfigurationError
from app.services.caddy_admin_client import CaddyAdminClient
from sqlalchemy import select, text
from sqlalchemy.orm import joinedload
from app.models.site import Site


class ProxyConfigurationService:
    def __init__(self, config=None):
        self.settings = config or default_settings

    def render_config(self, session):
        """The full desired-state Caddy JSON document: one route per
        currently-routable domain (DomainController.routable() already
        implements that exact filter)."""
        # Imported lazily: app.controller.tenant imports this service (to
        # sync routes after provision/migrate/stop/start), and the
        # controller package's __init__.py eagerly imports every controller
        # -- a module-level import here would be a circular import back into
        # a package that's still mid-initialization.
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
        for site in session.scalars(select(Site).options(joinedload(Site.server)).where(Site.status.in_(['routing', 'ready']))):
            routes.append({
                '@id': f'site-{site.id}', 'match': [{'host': [site.domain]}],
                'handle': [{'handler': 'reverse_proxy', 'upstreams': [{'dial': f'{site.server.dial_host}:{site.port}'}]}],
            })
        # Caddy's automatic HTTPS: listening on :443 with hostname-matched
        # routes and no explicit TLS connection policy is enough for Caddy to
        # provision/manage certs for every route host itself (Let's Encrypt
        # via ACME) -- it also transparently keeps :80 open to redirect to
        # HTTPS and to serve the ACME HTTP-01 challenge. No separate "tls"
        # app config needed for the default case.
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
        """Push the full desired-state config to the registered proxy.

        No-ops (with a warning, not an error) when no proxy is registered --
        tenants without Phase 2 set up keep working at IP:PORT exactly as
        before this existed.
        """
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
        """Diff the proxy's live config against what render_config() says it
        should be -- backs the admin-facing "Verify config" action."""
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
            # Nothing has ever been loaded yet (path doesn't exist) -- a
            # legitimate "nothing routed" state, not a real error here.
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
