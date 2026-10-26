#!/usr/bin/env python3
"""
One command to run, watch and control everything this project needs in development.

    python3 dev.py                  start the whole stack and stay attached (same as `up`)
    python3 dev.py up -d            start it in the background and return
    python3 dev.py status           what is running, on which port, for how long
    python3 dev.py restart web      restart one service (or `all`)
    python3 dev.py stop worker      stop one service        (start <name> brings it back)
    python3 dev.py logs controller -f   follow a service's output (no name: all of them)
    python3 dev.py down             stop everything and the manager itself
    python3 dev.py doctor           check the machine is ready, with a fix for each problem
    python3 dev.py migrate          apply the website's migrations, then the controller's

The platform is not one server. Besides the Next.js site there is the Python controller API, its
Celery worker and scheduler, the SSH terminal service and the billing worker; they need Postgres
and Redis. Forgetting one produces a confusing partial failure, so this manager starts the right
ones in the right order, restarts a crashed one with a back-off (and says so loudly), refuses to
start on a busy port, and stops all of it, including the child processes `next dev` and Celery
leave behind, when you quit.

While attached you can type commands: status, restart <name>, stop <name>, start <name>,
logs <name>, help, quit. Output of every service is also kept in log files (`dev.py logs`); they live outside the project, in
~/.local/state/unityalgo-dev/.

Services: web, controller, terminal, worker, beat, billing. Groups: backend (everything except
web), all. Standard library only, Python 3.8+, macOS and Linux (on Windows use WSL).
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

ROOT = Path(__file__).resolve().parent
CONTROLLER = ROOT / "controller"
# The manager's socket, pid and logs live OUTSIDE the project. Inside it, Next.js (Turbopack) tries to read the socket and
# crashes every page with a 500, and log files that grow on every line would trigger rebuilds.
STATE_DIR = Path(os.environ.get("XDG_STATE_HOME") or Path.home() / ".local" / "state") / "unityalgo-dev" / hashlib.sha1(str(ROOT).encode()).hexdigest()[:10]
VENV_PYTHON = CONTROLLER / "env" / "bin" / "python"

MAX_FAST_FAILURES = 5          # crashes in a row (each within a minute of starting) before giving up
STABLE_SECONDS = 60            # a process that lived this long starts the count again
STOP_GRACE_SECONDS = 8         # SIGTERM first, SIGKILL after this
LOG_ROTATE_BYTES = 5 * 1024 * 1024
RING_LINES = 400


def backoff(failures: int) -> float:
    """Seconds to wait before restarting after this many quick crashes in a row."""
    return min(30, 2 ** failures)


# --------------------------------------------------------------------------- terminal output

def _tty() -> bool:
    return sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def paint(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _tty() else text


COLORS = {"web": "34", "controller": "32", "terminal": "35", "worker": "33", "beat": "31", "billing": "36", "redis": "90"}


# --------------------------------------------------------------------------- environment

def load_dotenv(path: Path) -> dict:
    """Parse a .env file: KEY=VALUE, optional `export`, quotes, comments. Never raises on a bad line."""
    values: dict = {}
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return values
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        key, sep, value = line.partition("=")
        key = key.strip()
        if not sep or not key.replace("_", "").isalnum():
            continue
        value = value.strip()
        if value[:1] in "\"'" and value.count(value[0]) >= 2:
            value = value[1:value.index(value[0], 1)]
        else:
            hash_at = value.find(" #")
            value = (value[:hash_at] if hash_at != -1 else value).strip()
        values[key] = value
    return values


def project_env() -> dict:
    """What the services see: the shell's variables win, then the website's .env fills in the rest."""
    return {**load_dotenv(ROOT / ".env"), **os.environ, "PYTHONUNBUFFERED": "1"}


def port_open(port: int, host: str = "127.0.0.1", timeout: float = 0.4) -> bool:
    """True when something accepts connections on the port. On this machine a connect that hangs also means
    "taken": nothing listening answers at once with a refusal, while a busy listener with a full queue goes quiet."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except socket.timeout:
        return host in ("127.0.0.1", "localhost", "::1")
    except OSError:
        return False


def port_holders(port: int) -> list:
    """Process ids listening on a port, when lsof is available."""
    if not shutil.which("lsof"):
        return []
    result = subprocess.run(["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"], capture_output=True, text=True)
    return [int(p) for p in result.stdout.split() if p.isdigit()]


def endpoint(url: str, default_port: int) -> tuple:
    parsed = urllib.parse.urlparse(url)
    return parsed.hostname or "localhost", parsed.port or default_port


def is_local(host: str) -> bool:
    return host in ("localhost", "127.0.0.1", "::1", "0.0.0.0")


def human(seconds: float) -> str:
    seconds = int(seconds)
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        return f"{seconds // 60}m{seconds % 60:02d}s"
    return f"{seconds // 3600}h{(seconds % 3600) // 60:02d}m"


# --------------------------------------------------------------------------- service definitions

@dataclass
class Spec:
    name: str
    command: list
    cwd: Path
    port: Optional[int] = None
    env: dict = field(default_factory=dict)
    # Each returns a reason the service cannot start yet, or None. Re-checked while it waits.
    requires: list = field(default_factory=list)
    # Returns a reason the service is not needed (it is already provided elsewhere), or None.
    skip_if: Optional[Callable] = None
    description: str = ""


def need_venv() -> Optional[str]:
    if VENV_PYTHON.exists():
        return None
    return "controller virtualenv missing: cd controller && python3 -m venv env && env/bin/pip install -r requirements.txt"


def need_node_modules() -> Optional[str]:
    return None if (ROOT / "node_modules").exists() else "node_modules missing: run npm install"


def need_redis() -> Optional[str]:
    host, port = endpoint(project_env().get("REDIS_URL", "redis://localhost:6379/0"), 6379)
    return None if port_open(port, host if host != "localhost" else "127.0.0.1") else f"Redis is not reachable at {host}:{port}"


def build_specs(env: Optional[dict] = None) -> "collections.OrderedDict[str, Spec]":
    env = env or project_env()
    controller_port = int(env.get("CONTROLLER_PORT") or 8000)
    terminal_port = int(env.get("WS_TERMINAL_PORT") or 8765)
    web_port = int(env.get("WEB_PORT") or 3000)
    redis_host, redis_port = endpoint(env.get("REDIS_URL", "redis://localhost:6379/0"), 6379)
    py = str(VENV_PYTHON)
    # The controller reads the website's DATABASE_URL, as scripts/controller-local.mjs always did.
    controller_env = {"APP_PORT": str(controller_port)}
    specs = [
        Spec("redis", ["redis-server", "--port", str(redis_port), "--save", "", "--appendonly", "no"], ROOT, port=redis_port,
             skip_if=lambda: ("already running" if port_open(redis_port, "127.0.0.1") else
                              None if is_local(redis_host) and shutil.which("redis-server") else "remote or redis-server not installed"),
             description="Redis for Celery, started only when nothing is listening"),
        Spec("web", ["npx", "next", "dev", "-p", str(web_port)], ROOT, port=web_port, requires=[need_node_modules],
             description="Next.js website and admin"),
        Spec("controller", [py, "-u", "main.py", "serve"], CONTROLLER, port=controller_port, env=controller_env, requires=[need_venv],
             description="Python controller API"),
        Spec("terminal", [py, "-u", "ws_terminal_main.py"], CONTROLLER, port=terminal_port, env=controller_env, requires=[need_venv],
             description="SSH terminal WebSocket service"),
        Spec("worker", [py, "-u", "main.py", "worker"], CONTROLLER, env=controller_env, requires=[need_venv, need_redis],
             description="Celery worker: provisioning, backups, installs"),
        Spec("beat", [py, "-u", "main.py", "beat"], CONTROLLER, env=controller_env, requires=[need_venv, need_redis],
             description="Celery scheduler: exactly one may run"),
        Spec("billing", ["npm", "run", "billing:worker", "--", "--watch"], ROOT, requires=[need_node_modules],
             description="Billing worker: applies Paddle events, finishes paid sites"),
    ]
    return collections.OrderedDict((s.name, s) for s in specs)


GROUPS = {"backend": ["controller", "terminal", "worker", "beat", "billing"], "all": []}


def resolve_names(wanted: list, specs: dict) -> list:
    """Service names from the command line: names, groups, or nothing for everything."""
    if not wanted or wanted == ["all"]:
        return list(specs)
    names = []
    for item in wanted:
        group = GROUPS.get(item)
        for name in (group if group else [item]):
            if name not in specs:
                raise SystemExit(f"unknown service '{item}'. Choose from: {', '.join(specs)}, backend, all")
            if name not in names:
                names.append(name)
    return names


# --------------------------------------------------------------------------- the supervisor

class Service:
    """Runtime state of one managed process."""

    def __init__(self, spec: Spec):
        self.spec = spec
        self.proc: Optional[subprocess.Popen] = None
        self.pgid: Optional[int] = None
        self.state = "stopped"
        self.desired = "stopped"
        self.note = ""
        self.started_at = 0.0
        self.restarts = 0
        self.fast_failures = 0
        self.next_start = 0.0
        self.last_exit: Optional[int] = None
        self.ring: collections.deque = collections.deque(maxlen=RING_LINES)
        self.log_file = None


class Supervisor:
    def __init__(self, specs: dict, state_dir: Path, echo: bool = True):
        self.specs = specs
        self.state_dir = Path(state_dir)
        self.logs = self.state_dir / "logs"
        self.socket_path = self.state_dir / "control.sock"
        self.pid_file = self.state_dir / "supervisor.pid"
        self.echo = echo
        self.services = {name: Service(spec) for name, spec in specs.items()}
        self.lock = threading.RLock()
        self.print_lock = threading.Lock()
        self.stopping = threading.Event()
        self.width = max(len(n) for n in specs) if specs else 8
        self._server: Optional[socket.socket] = None

    # ---- output -------------------------------------------------------------------------
    def say(self, text: str, name: str = "dev") -> None:
        """A line from the manager itself, in the log of `name` and on screen."""
        self._emit(self.services.get(name), f"[dev] {text}", name=name)

    def _emit(self, svc: Optional[Service], line: str, name: Optional[str] = None) -> None:
        name = name or (svc.spec.name if svc else "dev")
        if svc is not None:
            svc.ring.append(line)
            if svc.log_file:
                try:
                    svc.log_file.write(line + "\n")
                    svc.log_file.flush()
                except (OSError, ValueError):
                    pass
        # The manager's own lines always reach stdout, which is supervisor.log in the state directory when it runs in the background.
        if self.echo or svc is None:
            prefix = paint(f"{name:<{self.width}} │ ", COLORS.get(name, "0"))
            with self.print_lock:
                print(prefix + line, flush=True)

    # ---- starting and stopping ----------------------------------------------------------
    def _blocker(self, svc: Service) -> Optional[str]:
        spec = svc.spec
        for check in spec.requires:
            reason = check()
            if reason:
                return reason
        if spec.port and port_open(spec.port):
            holders = port_holders(spec.port)
            return f"port {spec.port} is already in use" + (f" by pid {', '.join(map(str, holders))}" if holders else "")
        return None

    def _spawn(self, svc: Service) -> None:
        spec = svc.spec
        self.logs.mkdir(parents=True, exist_ok=True)
        path = self.logs / f"{spec.name}.log"
        if svc.log_file:
            svc.log_file.close()
        if path.exists() and path.stat().st_size > LOG_ROTATE_BYTES:
            path.replace(path.with_suffix(".log.1"))
        svc.log_file = open(path, "a", encoding="utf-8")
        env = {**project_env(), **spec.env}
        svc.proc = subprocess.Popen(
            spec.command, cwd=str(spec.cwd), env=env, stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, start_new_session=True,
        )
        svc.pgid = svc.proc.pid
        svc.started_at = time.time()
        svc.state = "starting"
        svc.note = ""
        self.say(f"started (pid {svc.proc.pid})" + (f", waiting for port {spec.port}" if spec.port else ""), spec.name)
        threading.Thread(target=self._pump, args=(svc, svc.proc), daemon=True).start()

    def _pump(self, svc: Service, proc: subprocess.Popen) -> None:
        assert proc.stdout is not None
        for raw in iter(proc.stdout.readline, b""):
            self._emit(svc, raw.decode("utf-8", "replace").rstrip("\r\n"))
        proc.stdout.close()

    def start(self, name: str) -> str:
        with self.lock:
            svc = self.services[name]
            svc.desired = "running"
            svc.fast_failures = 0
            svc.next_start = 0.0
            if svc.proc and svc.proc.poll() is None:
                return f"{name} is already running"
            reason = svc.spec.skip_if() if svc.spec.skip_if else None
            if reason:
                svc.state, svc.note, svc.desired = "external", reason, "stopped"
                self.say(f"not started: {reason}", name)
                return f"{name}: {reason}"
            blocker = self._blocker(svc)
            if blocker:
                svc.state, svc.note = "blocked", blocker
                self.say(f"waiting: {blocker}", name)
                return f"{name} is waiting: {blocker}"
            self._spawn(svc)
            return f"{name} starting"

    def stop(self, name: str) -> str:
        with self.lock:
            svc = self.services[name]
            svc.desired = "stopped"
            proc, pgid = svc.proc, svc.pgid
        if proc is None or proc.poll() is not None:
            with self.lock:
                svc.state, svc.proc = "stopped", None
            return f"{name} is not running"
        self._terminate(proc, pgid, svc.spec.port)
        with self.lock:
            svc.proc, svc.state, svc.note = None, "stopped", ""
        self.say("stopped", name)
        return f"{name} stopped"

    def restart(self, name: str) -> str:
        self.stop(name)
        return self.start(name)

    def _terminate(self, proc: subprocess.Popen, pgid: Optional[int], port: Optional[int]) -> None:
        """Stop a process and everything it started. `next dev` and Celery leave children that keep the port."""
        def signal_group(sig: int) -> None:
            try:
                os.killpg(pgid, sig) if pgid else proc.send_signal(sig)
            except (ProcessLookupError, PermissionError):
                pass
        signal_group(signal.SIGTERM)
        deadline = time.time() + STOP_GRACE_SECONDS
        while time.time() < deadline and proc.poll() is None:
            time.sleep(0.1)
        if proc.poll() is None:
            signal_group(signal.SIGKILL)
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                pass
        # Children outside the group that still hold the port, but only ones that belong to this service's group.
        if port and pgid:
            for pid in port_holders(port):
                try:
                    if os.getpgid(pid) == pgid:
                        os.kill(pid, signal.SIGKILL)
                except (ProcessLookupError, PermissionError):
                    pass

    def _reap(self, svc: Service) -> None:
        """A crashed service can leave children holding its port, which would block the restart."""
        if svc.spec.port and svc.pgid:
            for pid in port_holders(svc.spec.port):
                try:
                    if os.getpgid(pid) == svc.pgid:
                        os.kill(pid, signal.SIGKILL)
                except (ProcessLookupError, PermissionError):
                    pass

    # ---- the watch loop -----------------------------------------------------------------
    def tick(self) -> None:
        now = time.time()
        for name, svc in self.services.items():
            with self.lock:
                if svc.proc is not None and svc.proc.poll() is not None:
                    self._exited(svc, now)
                if svc.desired != "running":
                    continue
                if svc.proc is not None:
                    if svc.state == "starting":
                        ready = port_open(svc.spec.port) if svc.spec.port else now - svc.started_at > 2
                        if ready:
                            svc.state, svc.note = "running", ""
                            self.say(f"ready{f' on port {svc.spec.port}' if svc.spec.port else ''}", name)
                        elif svc.spec.port and now - svc.started_at > 120:
                            svc.note = f"still not listening on port {svc.spec.port} after 2 minutes"
                    continue
                if svc.state in ("restarting", "blocked") and now >= svc.next_start:
                    blocker = self._blocker(svc)
                    if blocker:
                        if svc.note != blocker:
                            self.say(f"waiting: {blocker}", name)
                        svc.state, svc.note, svc.next_start = "blocked", blocker, now + 5
                    else:
                        svc.restarts += 1 if svc.state == "restarting" else 0
                        self._spawn(svc)

    def _exited(self, svc: Service, now: float) -> None:
        code = svc.proc.returncode if svc.proc else None
        svc.last_exit, svc.proc = code, None
        self._reap(svc)
        if svc.desired != "running":
            svc.state = "stopped"
            return
        lived = now - svc.started_at
        svc.fast_failures = 0 if lived > STABLE_SECONDS else svc.fast_failures + 1
        if svc.fast_failures >= MAX_FAST_FAILURES:
            svc.state, svc.desired = "failed", "stopped"
            svc.note = f"crashed {MAX_FAST_FAILURES} times in a row (last exit code {code}); fix the error above, then `start {svc.spec.name}`"
            self.say(svc.note, svc.spec.name)
            return
        delay = backoff(svc.fast_failures)
        svc.state, svc.next_start = "restarting", now + delay
        svc.note = f"exited with code {code}; restarting in {delay}s"
        self.say(svc.note, svc.spec.name)

    # ---- reporting ----------------------------------------------------------------------
    def status(self) -> list:
        now = time.time()
        rows = []
        with self.lock:
            for name, svc in self.services.items():
                alive = svc.proc is not None and svc.proc.poll() is None
                port = svc.spec.port
                rows.append({
                    "name": name, "state": svc.state, "pid": svc.proc.pid if alive else None,
                    "uptime": human(now - svc.started_at) if alive else "",
                    "restarts": svc.restarts, "port": port, "listening": bool(port and port_open(port)),
                    "note": svc.note or svc.spec.description, "exit": svc.last_exit,
                })
        return rows

    def tail(self, name: str, count: int = 30) -> list:
        with self.lock:
            return list(self.services[name].ring)[-count:]

    # ---- commands (shared by the socket and the keyboard) -------------------------------
    def handle(self, command: str, args: list) -> dict:
        try:
            if command == "ping":
                return {"ok": True, "data": os.getpid()}
            if command == "status":
                return {"ok": True, "data": self.status()}
            if command == "down":
                self.stopping.set()
                return {"ok": True, "data": "shutting down"}
            if command in ("start", "stop", "restart"):
                names = resolve_names(args, self.specs)
                action = getattr(self, command)
                return {"ok": True, "data": [action(n) for n in names]}
            if command == "tail":
                return {"ok": True, "data": self.tail(args[0], int(args[1]) if len(args) > 1 else 30)}
            return {"ok": False, "error": f"unknown command '{command}'"}
        except (KeyError, SystemExit, IndexError, ValueError) as error:
            return {"ok": False, "error": str(error) or "bad request"}

    # ---- control socket -----------------------------------------------------------------
    def serve_control(self) -> None:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        if self.socket_path.exists():
            self.socket_path.unlink()
        server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        server.bind(str(self.socket_path))
        os.chmod(self.socket_path, 0o600)
        server.listen(8)
        server.settimeout(0.5)
        self._server = server
        self.pid_file.write_text(str(os.getpid()))
        threading.Thread(target=self._accept, daemon=True).start()

    def _accept(self) -> None:
        while not self.stopping.is_set():
            try:
                conn, _ = self._server.accept()  # type: ignore[union-attr]
            except socket.timeout:
                continue
            except OSError:
                return
            threading.Thread(target=self._serve_one, args=(conn,), daemon=True).start()

    def _serve_one(self, conn: socket.socket) -> None:
        with conn:
            try:
                data = b""
                while not data.endswith(b"\n"):
                    chunk = conn.recv(65536)
                    if not chunk:
                        break
                    data += chunk
                request = json.loads(data or b"{}")
                response = self.handle(request.get("cmd", ""), request.get("args", []))
            except (ValueError, OSError) as error:
                response = {"ok": False, "error": str(error)}
            try:
                conn.sendall((json.dumps(response) + "\n").encode())
            except OSError:
                pass

    # ---- lifecycle ----------------------------------------------------------------------
    def run(self, names: list, interactive: bool = False) -> int:
        self.serve_control()
        if threading.current_thread() is threading.main_thread():
            for sig in (signal.SIGINT, signal.SIGTERM):
                signal.signal(sig, self._on_signal)
        self.say(f"starting {', '.join(names)}")
        for name in names:
            self.start(name)
        for name in self.services:
            if name not in names:
                self.services[name].state = "skipped"
        if interactive:
            threading.Thread(target=self._keyboard, daemon=True).start()
            self.say("type `status`, `restart <name>`, `logs <name>`, `help`; Ctrl-C stops everything")
        try:
            while not self.stopping.is_set():
                self.tick()
                time.sleep(0.4)
        finally:
            self.shutdown()
        return 0

    def _on_signal(self, *_: object) -> None:
        if self.stopping.is_set():
            self.say("forcing everything to stop")
            for svc in self.services.values():
                if svc.pgid and svc.proc and svc.proc.poll() is None:
                    try:
                        os.killpg(svc.pgid, signal.SIGKILL)
                    except OSError:
                        pass
            os._exit(130)
        self.stopping.set()

    def shutdown(self) -> None:
        self.say("shutting down…")
        for name in reversed(list(self.services)):
            svc = self.services[name]
            if svc.proc is not None and svc.proc.poll() is None:
                self.stop(name)
        for svc in self.services.values():
            if svc.log_file:
                svc.log_file.close()
        try:
            if self._server:
                self._server.close()
            self.socket_path.unlink(missing_ok=True)
            self.pid_file.unlink(missing_ok=True)
        except OSError:
            pass
        self.say("done")

    def _keyboard(self) -> None:
        for raw in sys.stdin:
            parts = raw.split()
            if not parts:
                continue
            command, args = parts[0].lower(), parts[1:]
            if command in ("q", "quit", "exit", "down"):
                self.stopping.set()
                return
            if command in ("h", "help", "?"):
                print("commands: status | restart <name|all> | stop <name|all> | start <name|all> | logs <name> [n] | quit", flush=True)
            elif command in ("s", "status"):
                print(render_status(self.status()), flush=True)
            elif command in ("r", "restart", "start", "stop"):
                command = "restart" if command == "r" else command
                for line in self.handle(command, args).get("data", []) or []:
                    print(f"[dev] {line}", flush=True)
            elif command == "logs" and args:
                reply = self.handle("tail", args[:2])
                print("\n".join(reply.get("data", [])) if reply["ok"] else reply["error"], flush=True)
            else:
                print("unknown command; type `help`", flush=True)


# --------------------------------------------------------------------------- client side

def render_status(rows: list) -> str:
    glyph = {"running": ("●", "32"), "starting": ("◐", "33"), "restarting": ("↻", "33"), "blocked": ("…", "33"),
             "failed": ("✗", "31"), "stopped": ("○", "90"), "external": ("◇", "36"), "skipped": ("-", "90")}
    out = [f"{'SERVICE':<11}{'STATE':<13}{'PID':<8}{'UPTIME':<9}{'RESTARTS':<10}{'PORT':<19}NOTE"]
    for row in rows:
        mark, colour = glyph.get(row["state"], ("?", "0"))
        state = paint(f"{mark} {row['state']}".ljust(13), colour)       # pad first: colour codes have no width
        port = f":{row['port']}{'' if row['listening'] else ' (closed)'}" if row["port"] else ""
        out.append(f"{row['name']:<11}{state}{str(row['pid'] or ''):<8}{row['uptime']:<9}{row['restarts']:<10}{port:<19}{row['note']}")
    return "\n".join(out)


def ask(state_dir: Path, command: str, args: Optional[list] = None, timeout: float = 30) -> Optional[dict]:
    """Send a command to a running manager. None when there is none."""
    path = Path(state_dir) / "control.sock"
    if not path.exists():
        return None
    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    client.settimeout(timeout)
    try:
        client.connect(str(path))
        client.sendall((json.dumps({"cmd": command, "args": args or []}) + "\n").encode())
        data = b""
        while not data.endswith(b"\n"):
            chunk = client.recv(65536)
            if not chunk:
                break
            data += chunk
        return json.loads(data)
    except (OSError, ValueError):
        return None
    finally:
        client.close()


def running_manager(state_dir: Path) -> Optional[int]:
    reply = ask(state_dir, "ping", timeout=2)
    return reply["data"] if reply and reply.get("ok") else None


# --------------------------------------------------------------------------- doctor, migrate, logs

def doctor() -> int:
    env = project_env()
    problems = 0

    def report(ok: Optional[bool], label: str, fix: str = "") -> None:
        nonlocal problems
        mark = paint("✓", "32") if ok else paint("!", "33") if ok is None else paint("✗", "31")
        print(f"  {mark} {label}" + (f"\n      {fix}" if fix and not ok else ""))
        if ok is False:
            problems += 1

    print("Tools")
    report(sys.version_info >= (3, 8), f"Python {sys.version.split()[0]}", "Python 3.8 or newer is needed")
    for tool, fix in (("node", "install Node.js 20+"), ("npm", "install Node.js (includes npm)")):
        report(bool(shutil.which(tool)), tool, fix)
    report(shutil.which("redis-server") is not None or port_open(6379) or None, "redis-server (or Redis already running)", "brew install redis")
    report(shutil.which("lsof") is not None or None, "lsof (names whoever holds a busy port)", "")

    print("Project")
    report((ROOT / "node_modules").exists(), "node_modules installed", "run: npm install")
    report(VENV_PYTHON.exists(), "controller virtualenv", "run: cd controller && python3 -m venv env && env/bin/pip install -r requirements.txt")
    report((ROOT / ".env").exists(), "website .env", "copy .env.example to .env and fill it in")
    report((CONTROLLER / ".env").exists(), "controller .env", "copy controller/.env.example to controller/.env")
    for var in ("DATABASE_URL", "SESSION_SECRET", "CONTROLLER_INTERNAL_API_KEY"):
        report(bool(env.get(var)), f"{var} is set", f"set {var} in .env")

    print("Services it depends on")
    url = env.get("DATABASE_URL", "")
    if url:
        host, port = endpoint(url, 5432)
        up = port_open(port, "127.0.0.1" if host == "localhost" else host)
        report(up, f"Postgres reachable at {host}:{port}", "start it: docker compose up -d postgres")
        compose = (ROOT / "docker-compose.yml")
        if compose.exists() and '"5440:5432"' in compose.read_text() and port != 5440 and is_local(host):
            report(False, f"DATABASE_URL uses port {port} but docker-compose.yml publishes Postgres on 5440", "change the port in DATABASE_URL to 5440 (or edit the compose file)")
    redis_host, redis_port = endpoint(env.get("REDIS_URL", "redis://localhost:6379/0"), 6379)
    report(port_open(redis_port, "127.0.0.1" if redis_host == "localhost" else redis_host) or None, f"Redis reachable at {redis_host}:{redis_port}",
           "not needed to start; `dev.py up` starts a local one when redis-server is installed")

    print("Ports")
    for name, spec in build_specs(env).items():
        if spec.port and name != "redis":
            holders = port_holders(spec.port) if port_open(spec.port) else []
            report(not port_open(spec.port), f":{spec.port} free for {name}", f"in use{' by pid ' + ', '.join(map(str, holders)) if holders else ''}: stop it, or run `dev.py status` if it is this manager")
    print()
    print(paint("Ready." if not problems else f"{problems} problem{'s' if problems != 1 else ''} to fix.", "32" if not problems else "31"))
    return 1 if problems else 0


def migrate() -> int:
    env = project_env()
    steps = [("website (Drizzle)", ["npm", "run", "db:migrate"], ROOT),
             ("controller (Alembic)", [str(VENV_PYTHON), "main.py", "migrate"], CONTROLLER)]
    if not VENV_PYTHON.exists():
        print(need_venv())
        return 1
    url = env.get("DATABASE_URL", "")
    if url:
        host, port = endpoint(url, 5432)
        if not port_open(port, "127.0.0.1" if host == "localhost" else host):
            print(f"Postgres is not reachable at {host}:{port}. Start it (docker compose up -d postgres) and retry.")
            return 1
    for label, command, cwd in steps:     # the website's tables first: the controller's reference them
        print(paint(f"== {label}", "1"))
        if subprocess.run(command, cwd=str(cwd), env={**env, **({"APP_PORT": "8000"} if cwd == CONTROLLER else {})}).returncode != 0:
            print(paint(f"{label} failed; stopping.", "31"))
            return 1
    print(paint("Migrations applied.", "32"))
    return 0


def show_logs(state_dir: Path, names: list, count: int, follow: bool) -> int:
    logs = Path(state_dir) / "logs"
    files = {n: logs / f"{n}.log" for n in (names or [p.stem for p in sorted(logs.glob("*.log"))])}
    files = {n: p for n, p in files.items() if p.exists()}
    if not files:
        print("No logs yet. Start the stack with: python3 dev.py up")
        return 1
    width = max(len(n) for n in files)
    many = len(files) > 1

    def prefixed(name: str, line: str) -> str:
        return (paint(f"{name:<{width}} │ ", COLORS.get(name, "0")) if many else "") + line

    positions = {}
    for name, path in files.items():
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()[-count:]
        print("\n".join(prefixed(name, line) for line in lines))
        positions[name] = path.stat().st_size
    if not follow:
        return 0
    try:
        while True:
            for name, path in files.items():
                size = path.stat().st_size
                if size < positions[name]:
                    positions[name] = 0           # rotated
                if size > positions[name]:
                    with open(path, "r", encoding="utf-8", errors="replace") as handle:
                        handle.seek(positions[name])
                        for line in handle.read().splitlines():
                            print(prefixed(name, line), flush=True)
                    positions[name] = size
            time.sleep(0.3)
    except KeyboardInterrupt:
        return 0


# --------------------------------------------------------------------------- command line

def start_infrastructure(env: dict) -> None:
    """Bring up Postgres in Docker when it is local, wanted and not running. It is left running on exit."""
    url = env.get("DATABASE_URL", "")
    if not url:
        return
    host, port = endpoint(url, 5432)
    if not is_local(host) or port_open(port, "127.0.0.1"):
        return
    if not shutil.which("docker") or not (ROOT / "docker-compose.yml").exists():
        print(paint(f"Postgres is not reachable at {host}:{port} and Docker is not available to start it.", "33"))
        return
    print(paint(f"Postgres is not reachable at {host}:{port}; starting it with docker compose…", "33"))
    subprocess.run(["docker", "compose", "up", "-d", "postgres"], cwd=str(ROOT))
    for _ in range(60):
        if port_open(port, "127.0.0.1"):
            return
        time.sleep(1)
    print(paint(f"Postgres still is not reachable at :{port}. Check `docker compose ps` and DATABASE_URL.", "31"))


def cmd_up(args: argparse.Namespace, state_dir: Path) -> int:
    pid = running_manager(state_dir)
    if pid:
        print(f"Already running (manager pid {pid}). Use `python3 dev.py status`, or `python3 dev.py down` first.")
        return 1
    specs = build_specs()
    names = [n for n in resolve_names(args.services, specs) if n not in (args.skip or [])]
    if args.detach:
        state_dir.mkdir(parents=True, exist_ok=True)
        log = open(state_dir / "supervisor.log", "a")
        command = [sys.executable, str(Path(__file__).resolve()), "_serve", *names]
        if args.no_infra:
            command.insert(3, "--no-infra")
        subprocess.Popen(command, cwd=str(ROOT), stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        for _ in range(100):
            if running_manager(state_dir):
                time.sleep(2)
                print(render_status(ask(state_dir, "status")["data"]))   # type: ignore[index]
                print(f"\nRunning in the background (logs: {state_dir / 'logs'}).\n`python3 dev.py logs -f` to watch, `python3 dev.py down` to stop.")
                return 0
            time.sleep(0.1)
        print(f"The manager did not start. See {state_dir / 'supervisor.log'}")
        return 1
    return serve(names, state_dir, echo=True, interactive=sys.stdin.isatty(), infra=not args.no_infra)


def serve(names: list, state_dir: Path, echo: bool, interactive: bool, infra: bool = True) -> int:
    if infra:
        start_infrastructure(project_env())
    return Supervisor(build_specs(), state_dir, echo=echo).run(names, interactive=interactive)


def send(state_dir: Path, command: str, services: list) -> int:
    reply = ask(state_dir, command, services)
    if reply is None:
        print("Nothing is running. Start it with: python3 dev.py up")
        return 1
    if not reply["ok"]:
        print(reply["error"])
        return 1
    for line in reply["data"] if isinstance(reply["data"], list) else [reply["data"]]:
        print(line)
    return 0


def main(argv: Optional[list] = None) -> int:
    if os.name == "nt":
        print("dev.py needs macOS, Linux or WSL. On Windows, run it inside WSL.")
        return 1
    parser = argparse.ArgumentParser(prog="dev.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--state-dir", default=str(STATE_DIR), help=argparse.SUPPRESS)
    sub = parser.add_subparsers(dest="command", metavar="command")
    up = sub.add_parser("up", help="start services and stay attached (default)")
    up.add_argument("services", nargs="*", help="names or groups (default: all)")
    up.add_argument("-d", "--detach", action="store_true", help="run in the background")
    up.add_argument("--skip", nargs="*", help="services to leave out")
    up.add_argument("--no-infra", action="store_true", help="do not start Postgres in Docker")
    sub.add_parser("status", help="show every service")
    for name, text in (("start", "start a stopped service"), ("stop", "stop a service"), ("restart", "restart a service")):
        sub.add_parser(name, help=text).add_argument("services", nargs="+")
    sub.add_parser("down", help="stop everything and the manager")
    logs = sub.add_parser("logs", help="show or follow service output")
    logs.add_argument("services", nargs="*")
    logs.add_argument("-n", "--lines", type=int, default=40)
    logs.add_argument("-f", "--follow", action="store_true")
    sub.add_parser("doctor", help="check the machine is ready")
    sub.add_parser("migrate", help="apply website then controller migrations")
    hidden = sub.add_parser("_serve")
    hidden.add_argument("--no-infra", action="store_true")
    hidden.add_argument("services", nargs="*")
    args = parser.parse_args(argv)
    state_dir = Path(args.state_dir)

    command = args.command or "up"
    if command == "up":
        if args.command is None:
            args = up.parse_args([])
        return cmd_up(args, state_dir)
    if command == "_serve":
        return serve(args.services, state_dir, echo=False, interactive=False, infra=not args.no_infra)
    if command == "status":
        reply = ask(state_dir, "status")
        if reply is None:
            print("Nothing is running. Start it with: python3 dev.py up")
            return 1
        print(render_status(reply["data"]))
        return 0
    if command in ("start", "stop", "restart"):
        return send(state_dir, command, args.services)
    if command == "down":
        if running_manager(state_dir) is None:
            print("Nothing is running.")
            return 0
        ask(state_dir, "down", timeout=5)
        for _ in range(150):
            if running_manager(state_dir) is None:
                print("Everything stopped.")
                return 0
            time.sleep(0.1)
        print(f"The manager is taking long to stop; check {state_dir / 'supervisor.log'}")
        return 1
    if command == "logs":
        return show_logs(state_dir, args.services, args.lines, args.follow)
    if command == "doctor":
        return doctor()
    if command == "migrate":
        return migrate()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
