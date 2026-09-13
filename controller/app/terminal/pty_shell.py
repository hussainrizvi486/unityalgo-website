"""Opens an interactive PTY over SSH and pumps bytes to/from a WebSocket.

Reuses SSHService's existing auth resolution as-is (app/services/ssh_service.py)
-- its connect() context manager already resolves password vs. pasted-key
auth transparently, so this works identically for both without any new auth
code. The only genuinely new piece is invoke_shell() -- SSHService is
exec-only everywhere else in this codebase (one-shot exec_command() calls
that buffer full output), and an interactive terminal needs a real PTY.

Control-frame convention: xterm.js sends raw keystrokes as text frames and
resize notifications as a small JSON text frame recognizable by its `{"`
prefix -- terminal input a user could type never starts a frame with that
exact sequence, so a cheap prefix check is enough to disambiguate without
a second WebSocket subprotocol/framing layer.
"""

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
