"""Live container log and metric streaming over WebSocket.

Shares the process and the auth root of the SSH terminal (app/terminal) --
same entrypoint, same systemd unit, same nginx upstream, same short-lived
HS256 grant minted by the Next.js admin panel. Only the grant's purpose and
the thing it is bound to differ: a terminal grant names a server, a stream
grant names a deployment.

Read-only by construction: nothing here ever sends a byte to the remote
side, so unlike the terminal there is no shell to escape from. `docker logs`
and `docker stats` are the entire surface.
"""
