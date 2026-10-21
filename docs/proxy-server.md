# Proxy server (Caddy)

The proxy server is the one public entry point for customer sites and, optionally, for the platform's own website. Visitors
connect to it on ports 80 and 443. It terminates HTTPS and forwards each request to the right worker VM (or to the website).

This page explains how it works, how to set it up, and how to fix the problems that actually came up during the first
deployment.

- [How it works](#how-it-works)
- [What lives where](#what-lives-where)
- [How routes reach Caddy](#how-routes-reach-caddy)
- [HTTPS certificates](#https-certificates)
- [Setup, step by step](#setup-step-by-step)
- [Settings reference](#settings-reference)
- [Verifying it](#verifying-it)
- [Day-to-day operation](#day-to-day-operation)
- [Troubleshooting](#troubleshooting)
- [Security notes](#security-notes)

## How it works

```
                      Internet
                         |
          DNS: cloud.<domain> and *.cloud.<domain>  ->  proxy VM public IP
                         |
                  +--------------+      SSH tunnel to 127.0.0.1:2019
                  |  Proxy VM    |<--------------------------------+
                  |  Caddy :80   |                                 |
                  |        :443  |                         +---------------+
                  +------+-------+                         |  Controller   |
        host-based       |                                 |  (API, worker,|
        routing          |                                 |   beat)       |
        +----------------+------------------+              +-------+-------+
        |                                   |                      |
        v                                   v                      v
  Worker VM :30000      Worker VM :30001      Web server :2424   Postgres
  site-a (Frappe)       site-b (Frappe)       (Next.js portal)   (sites, domains,
                                                                 servers = the routes)
```

Key points:

- **Caddy holds no routing data of its own.** The routes are rows in the controller's database. The controller reads them,
  builds one JSON config for Caddy, and pushes it.
- **The push is a full replacement.** Every sync loads the entire config, so anything you add to Caddy by hand (a site block in
  the Caddyfile, a route through the admin API) is removed at the next sync. Everything that must keep being served has to be
  described to the controller (see [Platform website routes](#platform-website-routes)).
- **Pushing is safe while traffic flows.** Caddy applies the new config without dropping connections.

## What lives where

| Thing | Where | Notes |
|---|---|---|
| Customer site routes | `sites` table (`domain`, `port`, `server_id`) plus `server_nodes` (the worker's address) | One route per site: `host -> worker-ip:port` |
| Custom domains | `site_domains` table, `status = active` | Added to the same route as extra hosts once verified |
| Storefront tenants | `domain_mappings` and `deployments` tables | Same idea for the tenant product |
| Platform website routes | Controller `.env` (`PROXY_PLATFORM_*`) | Not stored in the database |
| Caddy's bootstrap config | `/etc/caddy/Caddyfile` on the proxy VM | Only opens the admin API |
| Caddy's last loaded config | `/var/lib/caddy/.config/caddy/autosave.json` | Written by Caddy itself; used by `--resume` |
| Issued HTTPS certificates | `/var/lib/caddy/.local/share/caddy/` | Back this up; keep it across rebuilds |

## How routes reach Caddy

1. Something changes a route (a site finishes deploying, is deleted, a domain is added, and so on).
2. The controller reads the tables above and renders Caddy's JSON config
   (`app/services/proxy_configuration_service.py`).
3. It opens an SSH connection to the proxy VM and tunnels to Caddy's admin API on `127.0.0.1:2019`.
4. It sends `POST /load` with the new config. Caddy applies it live and saves it to `autosave.json`.

### What triggers a sync

| Event | Sync |
|---|---|
| A site reaches the final "routing" step of deployment | yes |
| A site is deleted | yes |
| A custom domain is added, verified or removed | yes |
| A storefront tenant is started, stopped or removed | yes |
| The 5-minute health sweep finds Caddy's routes differ from the database | yes, it reloads them |
| You call `POST /api/v1/proxy/sync` | yes (manual) |

The health-sweep repair matters after a Caddy restart: if Caddy comes back with only its bootstrap config, the routes return
within one sweep even if nothing else triggers a sync.

### Which sites get a route

Only sites in these states are routed: `routing`, `ready`, `stopping`, `stopped`, `restarting`, `restoring`, `updating`.
A site still in `pulling`, `configuring`, `installing` or `starting` has no route yet; it gets one at the routing step.

### The generated config

A small example of what the controller loads (one route per site, with its custom domains as extra hosts):

```json
{
  "admin": { "listen": "127.0.0.1:2019" },
  "apps": {
    "tls": { "automation": { "policies": [ { "issuers": [ { "module": "acme", "email": "admin@example.com" } ] } ] } },
    "http": {
      "servers": {
        "srv0": {
          "listen": [":443"],
          "routes": [
            { "@id": "platform-ws",
              "match": [ { "host": ["cloud.example.com"], "path": ["/ws/*"] } ],
              "handle": [ { "handler": "reverse_proxy",
                            "upstreams": [ { "dial": "10.0.0.5:8765" } ],
                            "transport": { "protocol": "http", "read_timeout": 0 } } ] },
            { "@id": "platform-web",
              "match": [ { "host": ["cloud.example.com"] } ],
              "handle": [ { "handler": "encode", "encodings": { "zstd": {}, "gzip": {} }, "prefer": ["zstd", "gzip"] },
                          { "handler": "reverse_proxy", "upstreams": [ { "dial": "10.0.0.5:2424" } ] } ] },
            { "@id": "site-<site-id>",
              "match": [ { "host": ["acme.cloud.example.com", "erp.acme.com"] } ],
              "handle": [ { "handler": "reverse_proxy", "upstreams": [ { "dial": "192.168.252.2:30000" } ] } ] }
          ]
        }
      }
    }
  }
}
```

The `tls` block appears only when `PROXY_ACME_EMAIL` is set. With `PROXY_ENABLE_TLS=false` the server listens on `:80` only.

### Platform website routes

The platform's own website (and the controller's WebSocket service for the admin terminal) can be served by the same Caddy.
Because the controller replaces the whole config, these are described in the controller's `.env`, not in the Caddyfile:

- `PROXY_PLATFORM_HOSTS` — the host names (for example `cloud.example.com`).
- `PROXY_PLATFORM_UPSTREAM` — where the Next.js app listens (`ip:port`).
- `PROXY_PLATFORM_WS_UPSTREAM` — where the controller's WebSocket service listens; requests under `/ws/*` go here, with no
  read timeout so a terminal or log stream can stay open.

Leave all three empty if the website is served by a different Caddy or host.

## HTTPS certificates

Caddy gets a certificate for every host name in a route, automatically, using Let's Encrypt over plain HTTP (port 80) or
TLS (port 443). Nothing is configured per site.

How an issuance goes:

1. A route with a new host name is loaded.
2. Caddy first tests the challenge against Let's Encrypt's **staging** server (so mistakes do not use up the real rate
   limits), then requests the real certificate.
3. Let's Encrypt connects to the **IP that the name resolves to, in public DNS**, on port 80 and expects Caddy to answer.
4. On success the certificate is stored and used from then on; renewal is automatic.

Requirements for it to work:

- The name resolves, in public DNS, to the proxy VM's public IP.
- Ports 80 and 443 reach Caddy from the internet (VPS provider firewall and `ufw`).
- Caddy can reach `acme-v02.api.letsencrypt.org` outbound.

### Failed issuance backs off

After repeated failures Caddy retries only every 2 hours. If you fix DNS or a firewall, restart Caddy (with `--resume`, so it
keeps its routes) to retry immediately; see [Troubleshooting](#troubleshooting).

### DNS and caching

Let's Encrypt's resolvers cache records, so a DNS change you made minutes ago may still look old to them. The log line shows
which IP they reached: `161.97.104.116: Invalid response ... 404` means they hit that IP, which is not the proxy.

## Setup, step by step

The proxy VM needs Caddy installed (the package, or the Docker alternative at the end), SSH access for the controller, and
the public ports open.

### 1. DNS

Point the site domain at the proxy VM's public IP. Both records are needed; the wildcard does **not** cover the bare name.

| Type | Name | Value |
|---|---|---|
| A | `cloud` | proxy VM public IP |
| A | `*.cloud` | proxy VM public IP |

(Substitute your own `FRAPPE_SITE_DOMAIN` for `cloud.<domain>`.) Customers' own domains point at the proxy as a CNAME to
their site name, or an A record to the proxy's IP.

Check from anywhere:

```bash
dig @8.8.8.8 +short cloud.example.com
dig @8.8.8.8 +short test.cloud.example.com     # both must print the proxy IP
```

### 2. Firewall

On the proxy VM:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow OpenSSH
```

Do **not** open 2019 (Caddy's admin API); the controller reaches it through SSH.

Also open the same ports at your VPS provider's network firewall, if it has one.

Make sure nothing else listens on 80 or 443 (see the `address already in use` entry under Troubleshooting).

On each worker VM, allow the proxy's IP to reach the site ports (30000-31999 by default):

```bash
sudo ufw allow from <proxy-ip> to any port 30000:31999 proto tcp
```

The controller's "Firewall lockdown" action restricts the *tenant* port range (`TENANT_PORT_RANGE_*`, default 20000-29999) to
the proxy. It does not cover the Frappe site ports, so add the rule above for those.

If the platform website or the WebSocket service runs on another machine, allow the proxy's IP to reach them (for example
ports 2424 and 8765) and close them to everyone else.

### 3. Caddy's bootstrap config

Replace `/etc/caddy/Caddyfile` with exactly this. Do not add site blocks.

```
{
        admin 127.0.0.1:2019
        email admin@example.com
}
```

### 4. Keep the routes across a Caddy restart

Edit the systemd unit so Caddy resumes the last config the controller loaded:

```bash
sudo systemctl edit caddy
```

```
[Service]
ExecStart=
ExecStart=/usr/bin/caddy run --environ --config /etc/caddy/Caddyfile --resume
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart caddy
sudo systemctl status caddy --no-pager | head
```

Without `--resume`, a restart brings Caddy back with only the Caddyfile, and the routes stay missing until the next sync
(within about 5 minutes via the health sweep).

### 5. Controller settings

In `controller/.env`:

```
FRAPPE_SITE_DOMAIN=cloud.example.com
PROXY_ENABLE_TLS=true
PROXY_ACME_EMAIL=admin@example.com

# Optional: serve the platform website through this proxy
PROXY_PLATFORM_HOSTS=cloud.example.com
PROXY_PLATFORM_UPSTREAM=<web-server-ip>:2424
PROXY_PLATFORM_WS_UPSTREAM=<controller-ip>:8765
```

Restart the API and the worker afterwards:

```bash
sudo systemctl restart controller controller-worker
```

If the WebSocket service runs on a different machine from the API, set `WS_TERMINAL_HOST` on it to an address the proxy can
reach (`0.0.0.0` or a private IP), not the default `127.0.0.1`.

In the website's `.env`, set `PLATFORM_PUBLIC_URL=https://cloud.example.com` and
`NEXT_PUBLIC_CONTROLLER_WS_URL=wss://cloud.example.com`, then rebuild the website (the second value is fixed at build time).

### 6. Register the proxy server

In **Admin -> Servers**, add the proxy VM with role `proxy`, its IP address, and the SSH login the controller should use. Skip
the "Bootstrap Caddy" button if Caddy is already installed; that button installs a Docker-based Caddy instead (see below).

### 7. Push the routes

From the machine running the controller:

```bash
KEY=<your CONTROLLER_INTERNAL_API_KEY>
curl -s -H "X-Controller-Key: $KEY" http://127.0.0.1:8000/api/v1/proxy/info
curl -s -X POST -H "X-Controller-Key: $KEY" http://127.0.0.1:8000/api/v1/proxy/sync
curl -s -H "X-Controller-Key: $KEY" http://127.0.0.1:8000/api/v1/proxy/verify
```

(Use the port your API actually listens on, for example `8100`.) You should see `"registered": true`, then
`"status": "synced"` with a route count, then `"in_sync": true`.

## Settings reference

| Setting | Default | Meaning |
|---|---|---|
| `FRAPPE_SITE_DOMAIN` | empty | Base domain for customer sites; a site is `slug.<this>`. Site creation is disabled when empty. |
| `PROXY_ENABLE_TLS` | `false` | `true`: Caddy listens on `:443` and obtains certificates. `false`: plain `:80` (local testing). |
| `PROXY_ACME_EMAIL` | empty | Contact email carried into the loaded config for Let's Encrypt. |
| `PROXY_ADMIN_PORT_DEFAULT` | `2019` | Caddy's admin API port on the proxy VM. A server can override it. |
| `PROXY_PLATFORM_HOSTS` | empty | Host names for the platform website (comma separated). |
| `PROXY_PLATFORM_UPSTREAM` | empty | `ip:port` of the Next.js app. |
| `PROXY_PLATFORM_WS_UPSTREAM` | empty | `ip:port` of the WebSocket service, for `/ws/*`. |
| `HEALTH_CHECK_INTERVAL_SECONDS` | `300` (5 minutes) | How often the sweep checks proxy drift and reloads routes. |

Controller API endpoints (need `X-Controller-Key`):

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/proxy/info` | Whether a proxy is registered, and its name and IP |
| `POST /api/v1/proxy/sync` | Rebuild the config from the database and load it into Caddy |
| `GET /api/v1/proxy/verify` | Compare the routes the controller expects with what Caddy has |

## Verifying it

On the proxy VM:

```bash
# Is Caddy listening, and who owns the ports?
sudo ss -ltnp | grep -E ':(80|443|2019)\b'

# The routes Caddy has right now
curl -s localhost:2019/config/apps/http/servers/srv0/routes | grep -o '"dial":"[^"]*"'

# The certificates it has issued
sudo find /var/lib/caddy -path '*certificates*' -name '*.crt'

# Live log (issuance, errors)
sudo journalctl -u caddy -f
```

From any other machine:

```bash
curl -I http://cloud.example.com        # 308 redirect to https means DNS and port 80 reach Caddy
curl -I https://cloud.example.com       # your website's headers, with a valid certificate
```

After a restart, the routes should still be listed (that proves `--resume` works):

```bash
sudo systemctl restart caddy && sleep 3
curl -s localhost:2019/config/apps/http/servers/srv0/routes | grep -o '"dial":"[^"]*"'
```

## Day-to-day operation

- **A new site appears by itself.** The controller adds its route at the routing step; the certificate is requested
  immediately and normally takes a few seconds.
- **Custom domains.** A customer adds a domain on the site page and creates the DNS record shown. After the controller
  verifies the record, the domain joins the site's route and gets its own certificate.
- **Changing the website upstream or hosts.** Edit the `PROXY_PLATFORM_*` settings, restart the API and worker, and run
  `POST /api/v1/proxy/sync`.
- **Restarting Caddy** is safe with `--resume`. Without it, run a sync afterwards.
- **Rebuilding the proxy VM.** Restore `/var/lib/caddy/.local/share/caddy` if you can (avoids re-issuing certificates), install
  Caddy, repeat steps 3 and 4, and run a sync. Certificates are obtained again if you did not keep the old ones.
- **Do not hand-edit Caddy's config.** Any change you make through the admin API or a Caddyfile site block is overwritten by
  the next sync.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Sync fails with `listening on :443: bind: address already in use` | Another process owns 443: usually a Docker container with a published port, a second Caddy, or nginx/apache | `sudo ss -ltnp \| grep -E ':(80\|443)\b'` and `docker ps` to find it; stop it (`docker stop <name>`, `docker update --restart=no <name>`), then sync again |
| `verify` says `in_sync: false`, `actual_route_count: 0` | Caddy has only its bootstrap config (no sync yet, or it restarted without `--resume`) | Run `POST /api/v1/proxy/sync`; add `--resume` to the unit |
| Sync error: could not open a tunnel to Caddy's admin API | SSH access to the proxy fails, or Caddy's admin API is not on `127.0.0.1:2019` | Check the server's SSH details in Admin -> Servers; confirm the Caddyfile still has `admin 127.0.0.1:2019` |
| `curl: ... tlsv1 alert internal error` | Caddy has no certificate for that name yet | Read the Caddy log for the ACME error (rows below) |
| ACME log: `Invalid response from http://<name>/.well-known/...: 404` and an IP that is not the proxy | The name still resolves to another server for Let's Encrypt | Fix the record (bare `cloud` needs its own A record; the wildcard does not cover it); wait for the TTL; confirm with `dig @8.8.8.8` |
| ACME log: `Timeout during connect` or `Connection refused` | Port 80 is blocked | Open 80 and 443 in `ufw` and at the VPS provider; test `curl -I http://<name>` from outside |
| ACME log: `retrying_in: 7200` | Caddy is backing off after repeated failures | After fixing the cause, `sudo systemctl restart caddy` (with `--resume`) to retry now |
| ACME log: `too many failed authorizations` | Let's Encrypt rate limit after many failures | Wait about an hour |
| Routes disappear after `systemctl restart caddy` | The unit does not use `--resume` | Apply step 4; run a sync |
| `dig` on the proxy VM returns an old IP but other machines are right | That VM's resolver cache | `sudo resolvectl flush-caches`; it does not affect Let's Encrypt |
| `curl` to the site works but shows another site's content | Two A records for the name, or a stale cache | Keep exactly one A record per name |
| Website loads but the admin terminal fails | `NEXT_PUBLIC_CONTROLLER_WS_URL` still points at the development address, or the WebSocket upstream is unreachable from the proxy | Set it to `wss://<your host>` and rebuild the website; open the WebSocket port to the proxy and set `WS_TERMINAL_HOST` accordingly |

Useful diagnostics together:

```bash
sudo journalctl -u caddy -n 80 --no-pager | grep -iE "obtain|challenge|error"
curl -s localhost:2019/config/apps/tls | head -c 400; echo
curl -s localhost:2019/config/apps/http/servers/srv0 | head -c 900; echo
curl -sI https://acme-v02.api.letsencrypt.org/directory | head -3     # can the VM reach Let's Encrypt?
```

## Security notes

- The admin API (port 2019) can change everything Caddy does. It listens on `127.0.0.1` only and is reached through SSH; keep
  it closed in every firewall.
- The controller needs SSH access to the proxy VM. Use a key where you can, and a dedicated account.
- The controller API stays on the loopback address of the machine running it. Only the website calls it, with
  `CONTROLLER_INTERNAL_API_KEY`.
- Restrict the worker site ports, the website's port and the WebSocket port to the proxy's IP, so visitors can only arrive
  through Caddy.
- Back up `/var/lib/caddy/.local/share/caddy`; it holds the certificates' private keys.

## Alternative: Caddy in Docker

The "Bootstrap Caddy" button on a `proxy` server installs Caddy in Docker instead of the package. It runs:

```bash
sudo install -m 0755 -d /etc/caddy/config /etc/caddy/data
echo '{"admin":{"listen":"127.0.0.1:2019"}}' | sudo tee /etc/caddy/config/caddy.json
docker rm -f caddy 2>/dev/null
docker run -d --name caddy --network host --restart unless-stopped \
  -v /etc/caddy/config:/config -v /etc/caddy/data:/data \
  caddy:2-alpine caddy run --config /config/caddy.json
```

Everything else on this page is the same. Run only **one** of the two: a Docker Caddy and a package Caddy on the same VM fight
over ports 80 and 443. That container is started without `--resume`, so after a restart it has only its bootstrap config until the next sync (the health sweep reloads the routes within a few minutes). Certificates are kept in `/etc/caddy/data`.
