
import json
import shlex
import socket
import time

import paramiko
from websockets.exceptions import ConnectionClosed

from app.services.ssh_service import SSHService

RECV_POLL_SECONDS = 1.0

DEFAULT_TAIL = 200


def logs_command(container_name, tail=DEFAULT_TAIL):
    return (
        f"docker logs --tail {int(tail)} --follow --timestamps "
        f"{shlex.quote(container_name)} 2>&1"
    )


def stats_command(container_name):
    return (
        f"docker stats --no-trunc --format '{{{{json .}}}}' "
        f"{shlex.quote(container_name)}"
    )


def run_stream(ws, server, command, settings, idle_timeout, on_line=None):
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
    last_data = time.monotonic()
    buffer = b""
    reason = "stream ended"

    while True:
        if time.monotonic() - last_data > idle_timeout:
            reason = "stream idle timeout"
            break

        try:
            data = channel.recv(8192)
        except socket.timeout:
            if channel.exit_status_ready() and not channel.recv_ready():
                break
            continue
        except (OSError, paramiko.SSHException):
            break

        if not data:  # remote command ended
            break

        last_data = time.monotonic()

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
    try:
        return json.loads(line)
    except (json.JSONDecodeError, TypeError):
        return None


def _safe_close(ws, code, reason):
    try:
        ws.close(code=code, reason=reason)
    except Exception:  # noqa: BLE001 -- already closed from the other side
        pass
