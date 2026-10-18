from flask import Blueprint

from app.controller.server import ServerController
from app.errors import NotFoundError
from app.services.proxy_configuration_service import ProxyConfigurationService
from app.status_codes import HTTP_200_OK

from .base import BaseView


class ProxyInfoView(BaseView):

    controller_class = ServerController

    def get(self):
        with self.session() as session:
            proxy = self.controller(session).proxy_node()
            if proxy is None:
                return self.ok({"registered": False}, HTTP_200_OK)
            body = {
                "registered": True,
                "name": proxy.name,
                "ip_address": proxy.ip_address,
            }
        return self.ok(body, HTTP_200_OK)


class ProxySyncView(BaseView):

    controller_class = ServerController

    def post(self):
        with self.session() as session:
            proxy = self.controller(session).proxy_node()
            if proxy is None:
                raise NotFoundError("No proxy node is registered")
            document = ProxyConfigurationService(self.settings).sync_all(session)
            route_count = len(document["apps"]["http"]["servers"]["srv0"]["routes"])
        return self.ok({"status": "synced", "route_count": route_count}, HTTP_200_OK)


class ProxyVerifyView(BaseView):

    controller_class = ServerController

    def get(self):
        with self.session() as session:
            result = ProxyConfigurationService(self.settings).verify(session)
        return self.ok(result, HTTP_200_OK)


class ProxyRoutes:
    url_prefix = "/api/v1/proxy"

    @classmethod
    def blueprint(cls, db=None, config=None):
        bp = Blueprint("proxy", __name__, url_prefix=cls.url_prefix)
        kw = {"db": db, "config": config}
        bp.add_url_rule("/info", view_func=ProxyInfoView.as_view("info", **kw))
        bp.add_url_rule(
            "/sync", view_func=ProxySyncView.as_view("sync", **kw), methods=["POST"]
        )
        bp.add_url_rule("/verify", view_func=ProxyVerifyView.as_view("verify", **kw))
        return bp
