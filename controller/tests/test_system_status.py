import time
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from app.services import system_status
from app.tasks.celery_app import BEAT_KEY, HEARTBEAT_SECONDS


class BeatTests(unittest.TestCase):
    def test_recent_heartbeat_is_alive(self):
        client = MagicMock()
        client.get.return_value = str(time.time() - 10)
        status = system_status.beat_status(client)
        self.assertTrue(status["alive"])
        client.get.assert_called_with(BEAT_KEY)

    def test_old_or_missing_heartbeat_is_not(self):
        client = MagicMock()
        client.get.return_value = str(time.time() - HEARTBEAT_SECONDS * 4)
        self.assertFalse(system_status.beat_status(client)["alive"])
        client.get.return_value = None
        self.assertFalse(system_status.beat_status(client)["alive"])
        self.assertFalse(system_status.beat_status(None)["alive"])


class RedisTests(unittest.TestCase):
    def test_unreachable_redis_is_reported_not_raised(self):
        with patch("app.services.system_status.redis.Redis.from_url") as factory:
            factory.return_value.ping.side_effect = ConnectionError("refused")
            info, client = system_status.redis_status(
                SimpleNamespace(celery_broker_url="redis://x", redis_url="redis://x")
            )
        self.assertFalse(info["ok"])
        self.assertIn("refused", info["error"])
        self.assertIsNone(client)


class WorkerTests(unittest.TestCase):
    def test_task_arguments_never_leave_the_controller(self):
        inspector = MagicMock()
        inspector.ping.return_value = {"w1": {"ok": "pong"}}
        inspector.stats.return_value = {
            "w1": {
                "pid": 1,
                "total": {"a": 2, "b": 3},
                "pool": {"max-concurrency": 2, "processes": [1, 2]},
            }
        }
        inspector.active.return_value = {
            "w1": [
                {
                    "id": "t1",
                    "name": "site.provision",
                    "args": ["secret-site-id", {"setup": "ENCRYPTED"}],
                    "time_start": 1.0,
                }
            ]
        }
        inspector.reserved.return_value = {"w1": []}
        with patch(
            "app.services.system_status.celery_app.control.inspect",
            return_value=inspector,
        ):
            workers, error = system_status.workers_status()
        self.assertIsNone(error)
        self.assertEqual(workers[0]["processed"], 5)
        self.assertEqual(workers[0]["running"][0]["name"], "site.provision")
        self.assertNotIn("ENCRYPTED", str(workers))

    def test_no_worker_answering_is_an_empty_list(self):
        inspector = MagicMock()
        inspector.ping.return_value = None
        inspector.stats.return_value = inspector.active.return_value = (
            inspector.reserved.return_value
        ) = None
        with patch(
            "app.services.system_status.celery_app.control.inspect",
            return_value=inspector,
        ):
            self.assertEqual(system_status.workers_status(), ([], None))


if __name__ == "__main__":
    unittest.main()


class ProxyConfigTests(unittest.TestCase):
    def render(self, **overrides):
        from app.services.proxy_configuration_service import ProxyConfigurationService

        values = dict(
            proxy_enable_tls=True,
            proxy_platform_hosts=[],
            proxy_platform_upstream="",
            proxy_platform_ws_upstream="",
            proxy_acme_email="",
        )
        values.update(overrides)
        service = ProxyConfigurationService(SimpleNamespace(**values))
        with patch("app.controller.domain.DomainController") as domains:
            domains.return_value.routable.return_value = []
            session = MagicMock()
            session.scalars.return_value = []
            return service.render_config(session)

    def test_nothing_extra_by_default(self):
        document = self.render()
        self.assertEqual(document["apps"]["http"]["servers"]["srv0"]["routes"], [])
        self.assertNotIn("tls", document["apps"])

    def test_the_platform_website_and_its_websocket_are_served(self):
        document = self.render(
            proxy_platform_hosts=["cloud.example.com"],
            proxy_platform_upstream="10.0.0.5:3000",
            proxy_platform_ws_upstream="10.0.0.5:8765",
        )
        routes = document["apps"]["http"]["servers"]["srv0"]["routes"]
        self.assertEqual(
            [route["@id"] for route in routes], ["platform-ws", "platform-web"]
        )
        self.assertEqual(routes[0]["match"][0]["path"], ["/ws/*"])
        self.assertEqual(routes[0]["handle"][0]["transport"]["read_timeout"], 0)
        self.assertEqual(
            routes[1]["handle"][-1]["upstreams"], [{"dial": "10.0.0.5:3000"}]
        )

    def test_the_acme_contact_email_is_carried_into_the_loaded_config(self):
        document = self.render(proxy_acme_email="ops@example.com")
        self.assertEqual(
            document["apps"]["tls"]["automation"]["policies"][0]["issuers"][0]["email"],
            "ops@example.com",
        )
