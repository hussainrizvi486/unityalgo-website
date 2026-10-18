
import json
import socket
import threading
import time

import paramiko
from websockets.exceptions import ConnectionClosed

from app.services.ssh_service import SSHService

RECV_POLL_SECONDS = 1.0


def run_session(ws, server, settings, on_activity=None):
    """Blocks for the lifetime of one terminal session (open -> close)."""
    ssh = SSHService(server, settings)
    with ssh.connect() as client:
        channel = client.invoke_shell(term="xterm-256color")
        channel.settimeout(RECV_POLL_SECONDS)
        _pump(ws, channel, settings.ws_terminal_idle_timeout_seconds, on_activity)


def _pump(ws, channel, idle_timeout, on_activity):
    last_activity = [time.monotonic()]
    stop = threading.Event()

    def touch():
        last_activity[0] = time.monotonic()
        if on_activity:
            on_activity()

    def from_channel():
        while not stop.is_set() and not channel.closed:
            try:
                data = channel.recv(4096)
            except socket.timeout:
                if time.monotonic() - last_activity[0] > idle_timeout:
                    stop.set()
                    _safe_close(ws, 1000, "idle timeout")
                    return
                continue
            except (OSError, paramiko.SSHException):
                break
            if not data:  # remote side closed the shell
                break
            touch()
            try:
                ws.send(data)
            except ConnectionClosed:
                break
        stop.set()
        _safe_close(ws, 1000, "ssh session ended")

    reader = threading.Thread(target=from_channel, daemon=True)
    reader.start()

    try:
        while not stop.is_set():
            try:
                message = ws.recv(timeout=RECV_POLL_SECONDS)
            except TimeoutError:
                if time.monotonic() - last_activity[0] > idle_timeout:
                    break
                continue
            except ConnectionClosed:
                break
            touch()
            if isinstance(message, str) and message.startswith('{"resize"'):
                try:
                    cols, rows = json.loads(message)["resize"]
                    channel.resize_pty(width=cols, height=rows)
                except (ValueError, KeyError, TypeError):
                    pass  # malformed control frame -- ignore, don't crash the session
            else:
                channel.send(message)
    finally:
        stop.set()
        channel.close()
        reader.join(timeout=2)


def _safe_close(ws, code, reason):
    try:
        ws.close(code=code, reason=reason)
    except Exception:
        pass  # already closed from the other side -- fine
