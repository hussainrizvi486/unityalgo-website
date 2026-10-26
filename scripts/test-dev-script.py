"""Tests for dev.py's process manager, using throwaway fake services (no Postgres, Redis, Node or controller needed).

    python3 scripts/test-dev-script.py
"""
import os
import socket
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import dev  # noqa: E402


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def server_cmd(port: int) -> list:
    return [sys.executable, "-u", "-c", f"import http.server,socketserver as s;print('hello from fake',flush=True);s.TCPServer.allow_reuse_address=True;s.TCPServer(('127.0.0.1',{port}),http.server.SimpleHTTPRequestHandler).serve_forever()"]


def wait_for(condition, timeout=15.0, step=0.1):
    end = time.time() + timeout
    while time.time() < end:
        value = condition()
        if value:
            return value
        time.sleep(step)
    return None


class Harness(unittest.TestCase):
    def setUp(self):
        self._state = tempfile.TemporaryDirectory()
        self.state = Path(self._state.name)
        self.sup = None
        self.thread = None
        self._backoff, self._max = dev.backoff, dev.MAX_FAST_FAILURES
        dev.backoff = lambda failures: 0.1
        self.addCleanup(self.cleanup)

    def cleanup(self):
        dev.backoff, dev.MAX_FAST_FAILURES = self._backoff, self._max
        if self.sup:
            self.sup.stopping.set()
        if self.thread:
            self.thread.join(timeout=20)
        self._state.cleanup()

    def boot(self, *specs, names=None):
        self.sup = dev.Supervisor({s.name: s for s in specs}, self.state, echo=False)
        self.thread = threading.Thread(target=self.sup.run, args=(names or [s.name for s in specs],), daemon=True)
        self.thread.start()
        self.assertTrue(wait_for(lambda: dev.running_manager(self.state)), "the manager answers on its control socket")

    def row(self, name):
        reply = dev.ask(self.state, "status")
        return next(r for r in reply["data"] if r["name"] == name)


class ProcessManagerTests(Harness):
    def test_starts_a_service_and_reports_it_running_only_when_its_port_answers(self):
        port = free_port()
        self.boot(dev.Spec("fake", server_cmd(port), Path.cwd(), port=port))
        self.assertTrue(wait_for(lambda: self.row("fake")["state"] == "running"))
        self.assertTrue(dev.port_open(port))
        row = self.row("fake")
        self.assertTrue(row["pid"] and row["listening"])
        self.assertIn("hello from fake", (self.state / "logs" / "fake.log").read_text())

    def test_restart_gives_a_new_process_and_stop_frees_the_port(self):
        port = free_port()
        self.boot(dev.Spec("fake", server_cmd(port), Path.cwd(), port=port))
        wait_for(lambda: self.row("fake")["state"] == "running")
        first = self.row("fake")["pid"]
        reply = dev.ask(self.state, "restart", ["fake"])
        self.assertTrue(reply["ok"])
        self.assertTrue(wait_for(lambda: self.row("fake")["state"] == "running" and self.row("fake")["pid"] != first))
        dev.ask(self.state, "stop", ["fake"])
        self.assertTrue(wait_for(lambda: not dev.port_open(port)), "stopping releases the port")
        self.assertEqual(self.row("fake")["state"], "stopped")
        self.assertTrue(dev.ask(self.state, "start", ["fake"])["ok"])
        self.assertTrue(wait_for(lambda: self.row("fake")["state"] == "running"))

    def test_a_crashing_service_is_restarted_then_given_up_on_loudly(self):
        dev.MAX_FAST_FAILURES = 3
        self.boot(dev.Spec("crasher", [sys.executable, "-c", "import sys;print('boom');sys.exit(3)"], Path.cwd()))
        self.assertTrue(wait_for(lambda: self.row("crasher")["state"] == "failed"), "stops retrying after repeated quick crashes")
        row = self.row("crasher")
        self.assertEqual(row["exit"], 3)
        self.assertIn("crashed 3 times", row["note"])
        self.assertGreaterEqual(row["restarts"], 2)
        self.assertIn("boom", (self.state / "logs" / "crasher.log").read_text())
        # An operator fixing it and starting again works: the counter is reset.
        dev.ask(self.state, "start", ["crasher"])
        self.assertTrue(wait_for(lambda: self.row("crasher")["state"] in ("restarting", "starting", "failed")))

    def test_a_busy_port_blocks_the_start_with_a_reason_and_clears_when_freed(self):
        port = free_port()
        squatter = socket.socket()
        squatter.bind(("127.0.0.1", port))
        squatter.listen(1)
        try:
            self.boot(dev.Spec("fake", server_cmd(port), Path.cwd(), port=port))
            self.assertEqual(self.row("fake")["state"], "blocked")
            self.assertIn(f"port {port} is already in use", self.row("fake")["note"])
        finally:
            squatter.close()
        dev.ask(self.state, "restart", ["fake"])
        self.assertTrue(wait_for(lambda: self.row("fake")["state"] == "running"), "starts once the port is free")

    def test_a_missing_requirement_waits_and_starts_when_it_appears(self):
        flag = self.state / "ready"
        port = free_port()
        spec = dev.Spec("late", server_cmd(port), Path.cwd(), port=port, requires=[lambda: None if flag.exists() else "the flag file is missing"])
        self.boot(spec)
        self.assertEqual(self.row("late")["state"], "blocked")
        self.assertEqual(self.row("late")["note"], "the flag file is missing")
        flag.write_text("x")
        self.assertTrue(wait_for(lambda: self.row("late")["state"] == "running", timeout=20))

    def test_a_service_that_is_already_provided_is_left_alone(self):
        self.boot(dev.Spec("redis", ["sleep", "60"], Path.cwd(), skip_if=lambda: "already running"))
        self.assertEqual(self.row("redis")["state"], "external")
        self.assertIsNone(self.row("redis")["pid"])

    def test_stopping_kills_children_that_would_keep_the_port(self):
        port = free_port()
        # The service starts a grandchild that holds the port, the way `next dev` and Celery do.
        parent = f"import subprocess,sys,time;subprocess.Popen({server_cmd(port)!r});time.sleep(300)"
        self.boot(dev.Spec("parent", [sys.executable, "-c", parent], Path.cwd(), port=port))
        self.assertTrue(wait_for(lambda: dev.port_open(port)))
        dev.ask(self.state, "stop", ["parent"])
        self.assertTrue(wait_for(lambda: not dev.port_open(port)), "the grandchild is stopped with its parent")

    def test_down_stops_everything_and_removes_the_socket(self):
        port = free_port()
        self.boot(dev.Spec("fake", server_cmd(port), Path.cwd(), port=port))
        wait_for(lambda: self.row("fake")["state"] == "running")
        dev.ask(self.state, "down")
        self.assertTrue(wait_for(lambda: dev.running_manager(self.state) is None, timeout=20))
        self.assertFalse(dev.port_open(port))
        self.assertFalse((self.state / "control.sock").exists())

    def test_unknown_service_and_bad_commands_get_clear_errors(self):
        self.boot(dev.Spec("fake", ["sleep", "60"], Path.cwd()))
        reply = dev.ask(self.state, "restart", ["nope"])
        self.assertFalse(reply["ok"])
        self.assertIn("unknown service", reply["error"])
        self.assertFalse(dev.ask(self.state, "explode")["ok"])

    def test_only_the_chosen_services_are_started(self):
        self.boot(dev.Spec("a", ["sleep", "60"], Path.cwd()), dev.Spec("b", ["sleep", "60"], Path.cwd()), names=["a"])
        self.assertTrue(wait_for(lambda: self.row("a")["state"] in ("starting", "running")))
        self.assertEqual(self.row("b")["state"], "skipped")


class HelperTests(unittest.TestCase):
    def test_state_lives_outside_the_project(self):
        # Inside the project, Next.js (Turbopack) reads the control socket, crashes every page with a 500, and rebuilds on every log line.
        self.assertNotIn(dev.ROOT, dev.STATE_DIR.parents)
        self.assertLess(len(str(dev.STATE_DIR / "control.sock")), 100, "unix socket paths are limited to ~104 bytes")


    def test_dotenv_parsing(self):
        with tempfile.NamedTemporaryFile("w", suffix=".env", delete=False) as handle:
            handle.write('# comment\nA=1\nexport B="two words"\nC=\'x\'\nD=value # trailing\nE=a=b\n\nnot a line\n=bad\nF="quoted # kept"\n')
        values = dev.load_dotenv(Path(handle.name))
        os.unlink(handle.name)
        self.assertEqual(values, {"A": "1", "B": "two words", "C": "x", "D": "value", "E": "a=b", "F": "quoted # kept"})
        self.assertEqual(dev.load_dotenv(Path("/does/not/exist")), {})

    def test_service_selection(self):
        specs = dev.build_specs({})
        self.assertEqual(dev.resolve_names([], specs), list(specs))
        self.assertEqual(dev.resolve_names(["backend"], specs), ["controller", "terminal", "worker", "beat", "billing"])
        self.assertEqual(dev.resolve_names(["web", "web", "beat"], specs), ["web", "beat"])
        with self.assertRaises(SystemExit):
            dev.resolve_names(["nope"], specs)

    def test_real_service_table_matches_how_the_stack_runs_today(self):
        specs = dev.build_specs({"CONTROLLER_PORT": "9001", "WS_TERMINAL_PORT": "9002", "WEB_PORT": "9003", "REDIS_URL": "redis://localhost:6390/0"})
        self.assertEqual((specs["controller"].port, specs["terminal"].port, specs["web"].port, specs["redis"].port), (9001, 9002, 9003, 6390))
        self.assertEqual(specs["controller"].env["APP_PORT"], "9001")
        self.assertEqual(specs["web"].command[:3], ["npx", "next", "dev"])
        self.assertEqual(specs["billing"].command, ["npm", "run", "billing:worker", "--", "--watch"])
        self.assertEqual([specs[n].command[-1] for n in ("controller", "worker", "beat")], ["serve", "worker", "beat"])
        self.assertEqual(dev.build_specs({})["controller"].port, 8000)
        self.assertEqual(dev.build_specs({})["terminal"].port, 8765)

    def test_human_durations_and_endpoints(self):
        self.assertEqual([dev.human(5), dev.human(125), dev.human(3725)], ["5s", "2m05s", "1h02m"])
        self.assertEqual(dev.endpoint("redis://localhost:6390/0", 6379), ("localhost", 6390))
        self.assertEqual(dev.endpoint("postgresql://u:p@db.example.com/x", 5432), ("db.example.com", 5432))

    def test_status_table_renders_every_state(self):
        rows = [{"name": n, "state": s, "pid": 1, "uptime": "1s", "restarts": 0, "port": 80, "listening": True, "note": "", "exit": None}
                for n, s in (("a", "running"), ("b", "failed"), ("c", "external"), ("d", "weird"))]
        table = dev.render_status(rows)
        self.assertEqual(len(table.splitlines()), 5)
        self.assertIn("failed", table)


if __name__ == "__main__":
    unittest.main(verbosity=2)
