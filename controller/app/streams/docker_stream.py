"""Pumps a long-running `docker logs -f` / `docker stats --stream` to a socket.

The existing DockerService.logs()/stats() are one-shot: they run the command,
wait for it to exit, and return the buffered output. Neither can be used here
-- `docker logs -f` never exits, so `SSHService.run()` would block forever and
return nothing.

So this opens the SSH channel itself, exactly the way pty_shell.py does for
the terminal, and reads as output arrives. It reuses SSHService.connect() for
auth resolution (password vs. pasted key), so it works on every node the rest
of the controller already reaches, with no new credential handling.

One direction only. The socket is never read from, and nothing is ever sent
to the remote shell -- these two commands are the entire surface.
"""

import json
import shlex
import socket
import time

import paramiko
from websockets.exceptions import ConnectionClosed

from app.services.ssh_service import SSHService

RECV_POLL_SECONDS = 1.0

# `docker logs -f` replays history before it starts following. Without a cap
# a container that has been up for a month would dump a month of output into
# the browser before the first live line arrived.
DEFAULT_TAIL = 200


def logs_command(container_name, tail=DEFAULT_TAIL):
    # 2>&1 because container stderr is where most application errors go, and
    # a log viewer that silently drops them is worse than no log viewer.
    return (
        f"docker logs --tail {int(tail)} --follow --timestamps "
        f"{shlex.quote(container_name)} 2>&1"
    )


def stats_command(container_name):
    # --no-trunc keeps the container id readable; the JSON format matches what
    # DockerService.stats() already returns for the one-shot case, so the
    # browser can render a live frame and a polled frame with the same code.
    return (
        f"docker stats --no-trunc --format '{{{{json .}}}}' "
        f"{shlex.quote(container_name)}"
    )


def run_stream(ws, server, command, settings, idle_timeout, on_line=None):
    """Blocks for the lifetime of one stream (open -> close).

    Returns the number of frames sent, which the caller records in the audit
    log so an empty stream is distinguishable from one that never opened.
    """
    ssh = SSHService(server, settings)
    with ssh.connect() as client:
        channel = client.get_transport().open_session()
        channel.settimeout(RECV_POLL_SECONDS)
        channel.exec_command(command)
        try:
            return _pump(ws, channel, idle_timeout, on_line)
        finally:
            try:
                channel.close()
            except Exception:  # noqa: BLE001 -- already closed is fine
                pass


def _pump(ws, channel, idle_timeout, on_line):
    sent = 0
    # Idle, not total: a busy container streaming steadily for an hour is
    # working as intended, while one that has produced nothing for the whole
    # window is a tab someone left open. Reset on every chunk received.
    last_data = time.monotonic()
    buffer = b""
    # One close at the end, carrying why. Closing inside the loop and again
    # on the way out means the reason the client sees is whichever call
    # happened to land last.
    reason = "stream ended"

    while True:
        if time.monotonic() - last_data > idle_timeout:
            reason = "stream idle timeout"
            break

        try:
            data = channel.recv(8192)
        except socket.timeout:
            # No output yet. Not an error -- a healthy idle container is
            # silent, and stats emits roughly once a second.
            if channel.exit_status_ready() and not channel.recv_ready():
                break
            continue
        except (OSError, paramiko.SSHException):
            break

        if not data:  # remote command ended
            break

        last_data = time.monotonic()

        # Send whole lines only. A partial line would render as a torn log
        # entry, and for stats it would be unparseable JSON.
        buffer += data
        *lines, buffer = buffer.split(b"\n")
        for line in lines:
            text = line.decode("utf-8", errors="replace").rstrip("\r")
            if not text:
                continue
            try:
                ws.send(text)
            except ConnectionClosed:
                return sent
            sent += 1
            if on_line:
                on_line()

    # Flush a trailing partial line so the last entry is not swallowed.
    if buffer.strip():
        try:
            ws.send(buffer.decode("utf-8", errors="replace").rstrip("\r"))
            sent += 1
        except ConnectionClosed:
            pass

    _safe_close(ws, 1000, reason)
    return sent


def parse_stats_line(line):
    """`docker stats --format json` line -> dict, or None if unparseable.

    Exposed for tests and for any caller that wants the parsed frame rather
    than the raw text the socket carries.
    """
    try:
        return json.loads(line)
    except (json.JSONDecodeError, TypeError):
        return None


def _safe_close(ws, code, reason):
    try:
        ws.close(code=code, reason=reason)
    except Exception:  # noqa: BLE001 -- already closed from the other side
        pass
