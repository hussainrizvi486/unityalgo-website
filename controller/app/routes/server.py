from flask import Blueprint

from app.controller.server import ServerController
from app.serializers import ServerSerializer
from app.status_codes import HTTP_200_OK, HTTP_201_CREATED

from .base import BaseView


class ServerBaseView(BaseView):
    controller_class = ServerController
    serializer_class = ServerSerializer


class ServerListView(ServerBaseView):
    """/api/v1/servers -- collection."""

    def get(self):
        """List worker nodes. ?is_active=true&limit=50&offset=0"""
        limit, offset = self.pagination()
        is_active = self.bool_arg("is_active")
        with self.session() as session:
            rows, total = self.controller(session).list(
                is_active=is_active, limit=limit, offset=offset
            )
            body = self.page(self.dump_many(rows), total, limit, offset)
        return self.ok(body, HTTP_200_OK)

    def post(self):
        """Register a worker VPS node."""
        payload = self.json_body()
        with self.session() as session:
            server = self.controller(session).create(payload)
            body = self.dump(server)
        return self.ok(body, HTTP_201_CREATED)


class ServerDetailView(ServerBaseView):
    """/api/v1/servers/<id> -- single node."""

    def get(self, server_id):
        """?include_secrets=true also returns the stored ssh_password."""
        include_secrets = self.bool_arg("include_secrets", default=False)
        with self.session() as session:
            server = self.controller(session).get(server_id)
            body = self.dump(server, include_secrets=include_secrets)
        return self.ok(body, HTTP_200_OK)

    def patch(self, server_id):
        """Partial update -- only the fields present in the body are written."""
        payload = self.json_body()
        with self.session() as session:
            body = self.dump(self.controller(session).update(server_id, payload))
        return self.ok(body, HTTP_200_OK)

    put = patch

    def delete(self, server_id):
        """?force=true detaches any tenants still pointing at this node."""
        force = self.bool_arg("force", default=False)
        with self.session() as session:
            self.controller(session).delete(server_id, force=force)
        return self.no_content()


class ServerCheckView(ServerBaseView):
    """/api/v1/servers/<id>/check -- SSH reachability probe."""

    def post(self, server_id):
        with self.session() as session:
            body = self.controller(session).check_connection(server_id)
        return self.ok(body, HTTP_200_OK)

    get = post


class ServerConnectView(ServerBaseView):
    """/api/v1/servers/<id>/connect -- SSH in, collect and persist specs."""

    def post(self, server_id):
        with self.session() as session:
            server, specs = self.controller(session).connect(server_id)
            body = self.dump(server)
            body["specs_collected"] = specs
        return self.ok(body, HTTP_200_OK)


class ServerBootstrapView(ServerBaseView):
    """/api/v1/servers/<id>/bootstrap -- install Docker via apt over SSH."""

    def post(self, server_id):
        with self.session() as session:
            body = self.controller(session).bootstrap(server_id)
        return self.ok(body, HTTP_200_OK)


class ServerBootstrapCaddyView(ServerBaseView):
    """/api/v1/servers/<id>/bootstrap-caddy -- install+start Caddy over SSH
    (a role='proxy' node; assumes Docker is already installed)."""

    def post(self, server_id):
        with self.session() as session:
            body = self.controller(session).bootstrap_caddy(server_id)
        return self.ok(body, HTTP_200_OK)


class ServerLockdownView(ServerBaseView):
    """/api/v1/servers/<id>/lockdown -- restrict this worker's tenant port
    range to the registered proxy's IP only (DOCKER-USER chain)."""

    def post(self, server_id):
        with self.session() as session:
            body = self.controller(session).apply_firewall_lockdown(server_id)
        return self.ok(body, HTTP_200_OK)


class ServerContainerView(ServerBaseView):
    """/api/v1/servers/<id>/containers -- `docker ps` over SSH."""

    def get(self, server_id):
        """?all=true includes stopped containers."""
        all_containers = self.bool_arg("all", default=False)
        with self.session() as session:
            containers = self.controller(session).containers(
                server_id, all_containers=all_containers
            )
        return self.ok({"count": len(containers), "results": containers}, HTTP_200_OK)


class ServerRoutes:
    """Builds the servers blueprint."""

    url_prefix = "/api/v1/servers"

    @classmethod
    def blueprint(cls, db=None, config=None):
        bp = Blueprint("servers", __name__, url_prefix=cls.url_prefix)
        bp.add_url_rule(
            "", view_func=ServerListView.as_view("collection", db=db, config=config)
        )
        bp.add_url_rule(
            "/<server_id>/check",
            view_func=ServerCheckView.as_view("check", db=db, config=config),
        )
        bp.add_url_rule(
            "/<server_id>/connect",
            view_func=ServerConnectView.as_view("connect", db=db, config=config),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<server_id>/bootstrap",
            view_func=ServerBootstrapView.as_view("bootstrap", db=db, config=config),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<server_id>/bootstrap-caddy",
            view_func=ServerBootstrapCaddyView.as_view(
                "bootstrap_caddy", db=db, config=config
            ),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<server_id>/lockdown",
            view_func=ServerLockdownView.as_view("lockdown", db=db, config=config),
            methods=["POST"],
        )
        bp.add_url_rule(
            "/<server_id>/containers",
            view_func=ServerContainerView.as_view("containers", db=db, config=config),
        )
        bp.add_url_rule(
            "/<server_id>",
            view_func=ServerDetailView.as_view("detail", db=db, config=config),
        )
        return bp
