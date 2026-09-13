# Caddy Edge Layer + Deployment Model — Implementation Plan

Status: **proposed, not started**
Migration head at time of writing: `9c4e18b7a250`

---

## 1. Context

Today the controller can provision a tenant container onto a worker VPS, but **no
public traffic can reach it**. There is no edge layer, and the containers are not
reachable from off-node. This plan introduces a dedicated Caddy proxy tier and the
data model (`Deployment`, `DomainMapping`) needed to drive it, so that:

```
Internet -> *.unity-commerce.unityalgo.com (wildcard DNS) -> Caddy VPS -> worker VPS IP:PORT -> Next.js
```

The controller stays a **control plane only** — it configures Caddy via the Admin
API and never sits in the request path.

---

## 2. What the current code actually does (verified)

Five findings that shape everything below. All were confirmed by reading the code
and probing the live VMs.

| # | Finding | Impact |
|---|---|---|
| 1 | `DockerService.run_container` emits **no `-p` / publish flag** ([docker_service.py:42-75](../app/services/docker_service.py#L42-L75)). `ss -ltn` on test-server-1 shows only port 22. | An external Caddy **physically cannot reach** a tenant container. This is the core blocker. |
| 2 | Traefik is referenced but **never deployed**. `container_spec` writes Traefik labels; nothing installs or runs Traefik. | There is no working edge to migrate off. We are building it for the first time — the Caddy decision is unconstrained. |
| 3 | `container_spec` builds `DATABASE_URL` from `settings.postgres_host` = **`localhost:5450`** ([tenant.py:290-294](../app/controller/tenant.py#L290-L294)). | Every remote container gets a DB URL pointing at *itself*. Invisible today because nothing probes the app; **health checks will fail 100% of deployments** the moment they land. Must fix in Phase 1. |
| 4 | `settings.subdomain_for('acme')` returns **`acme.unityalgo.com`**, but the spec's wildcard is `*.unity-commerce.unityalgo.com`. | Spec/code conflict. Needs a distinct `PLATFORM_DOMAIN` setting. |
| 5 | `ServerNode.active_containers` / `used_memory_mb` are **never incremented anywhere**. | `available_node()` placement is effectively arbitrary — it always picks the same node. Placement starts mattering now. |

Additional landmines:

- **`BaseController.flush()` calls `session.rollback()`** on `IntegrityError`
  ([base.py:111-117](../app/controller/base.py#L111-L117)) — that aborts the *whole*
  transaction, not a savepoint. Port-allocation retries **must** use
  `session.begin_nested()`, or a port conflict silently discards the tenant row.
- **Container name is one-per-tenant** (`f"tenant_{slug}"`), and `run_container`
  force-removes a same-named container. A blue/green redeploy on the same node would
  kill the live container before the new one is up.
- **No HTTP client in `requirements.txt`** — use stdlib `http.client`.
- `docker inspect .State.Running` is currently a **warning, not a failure**
  ([tenant.py:416-424](../app/controller/tenant.py#L416-L424)), then reports
  "Tenant setup completed". That is a lie and must become a hard failure.

---

## 3. Data model

### New — `app/models/deployment.py`

```
Deployment
  id, tenant_id (CASCADE), server_id (RESTRICT)
  application, image, container_name, container_id
  port              <- host port, NOT NULL
  container_port    <- default 3000
  status            pending|deploying|health_checking|live|draining|failed|removed
  health_status     unknown|healthy|unhealthy
  health_message, last_health_at
  memory_limit_mb, cpu_limit_cores   <- snapshotted at deploy time
  created_at, updated_at, started_at, stopped_at, port_released_at

  UniqueConstraint(server_id, port)
  partial unique index on tenant_id WHERE status='live'
```

The **partial unique index** enforces "one live container per tenant" while still
allowing blue/green (new sits in `health_checking` while old is `live`; the flip
happens in one transaction).

### New — `app/models/domain.py`

```
DomainMapping
  id, tenant_id (CASCADE), deployment_id (SET NULL, nullable)
  domain (UNIQUE, lowercased), domain_type platform|custom
  status pending|active|disabled
  ssl_status none|pending|active|failed
  verified_at, last_synced_at, created_at, updated_at
```

`deployment_id` is nullable because the platform domain is reserved at tenant-create
time, before any deployment exists. Migration then becomes a single
`UPDATE domain_mappings SET deployment_id = <new>` — that is the whole
"domain and DNS never change" story.

### `ServerNode` additions

`role` (`worker|proxy`, default `worker`), `private_ip`, `proxy_admin_port`.

A role discriminator beats a separate `ProxyNode` table: it reuses every SSH
credential field, the connect/specs flow, the activity-log `server_id` subject, and
the entire admin server page for free.

### Legacy `Tenant` columns — keep as write-through cache, drop in Phase 4

`node_id`, `container_id`, `assigned_subdomain`, `custom_domain` are all per-deployment
or per-domain facts that no longer belong on `Tenant`. But 27 read sites across
serializers, admin views and templates depend on them.

**Decision:** `DeploymentController` writes through to them during Phases 1–3, so
nothing downstream breaks while the model lands. Phase 4 drops the columns and updates
the ~5 remaining call sites. Add these properties so the eventual drop is a one-token
change:

```python
Tenant.live_deployment   -> the status='live' Deployment, or None
Tenant.primary_domain    -> active custom domain, else platform domain
```

`primary_domain` replaces the `tenant.custom_domain or tenant.assigned_subdomain`
expression that currently appears at [tenant.py:279](../app/controller/tenant.py#L279)
and [:430](../app/controller/tenant.py#L430).

---

## 4. Key design decisions

### Port allocation — DB is the only authority

Range **20000–29999** (below Linux's ephemeral range 32768–60999, so it can never
collide with an outbound socket). `Deployment.port` + `UniqueConstraint(server_id, port)`.

Allocation takes `pg_advisory_xact_lock(hashtext('port-alloc:<server_id>'))` to
serialize concurrent provisions on the same node; the unique constraint is the
backstop, with retries inside `session.begin_nested()` (**not** `BaseController.flush()`).

Ports are never freed by deleting rows — deployment rows are the audit trail.
"Released" = `status='removed'` plus a `port_released_at` cooldown (default 300s) so a
new tenant can't inherit a port a browser still holds a keep-alive to.

### Bind to the private interface, never `0.0.0.0`

```
docker run -p <private_ip>:<host_port>:<container_port> ...
```

If a node has a public IP and no `private_ip` set, **refuse to publish** — hard gate,
not a warning.

### Firewall: `DOCKER-USER`, not UFW

Docker's `-p` inserts DNAT rules in `nat/PREROUTING` that are evaluated **before**
UFW's `INPUT` chain. `ufw deny 20000:29999/tcp` does *nothing* to a published container
port. The only correct place is the `DOCKER-USER` chain. This is the single most likely
way to accidentally expose thousands of tenant ports to the internet.

### Caddy Admin API over an SSH tunnel

The admin API binds `127.0.0.1:2019` on the proxy node and is never exposed. The
controller opens a Paramiko `direct-tcpip` channel and speaks HTTP over it with stdlib
`http.client` (assign the channel to `conn.sock`, bypassing `conn.connect()`).

No new dependency, no new credential, no new exposed port, and it reuses the
`ServerNode.ssh_*` fields exactly as `DockerService` already does. This is still one
connection carrying an API call — not per-tenant Caddyfile editing — so the spec's
intent holds.

### Idempotency: `@id` tags + full-config sync

Every route carries `"@id": f"tenant-{mapping.id}"` (keyed on the **DomainMapping**,
not the tenant — one domain, one route).

| method | Caddy call |
|---|---|
| `add_route` | `DELETE /id/tenant-<id>` (tolerate 404) then `POST .../routes` = upsert |
| `update_route` | `PATCH /id/tenant-<id>`, falling back to `add_route` on 404 |
| `remove_route` | `DELETE /id/tenant-<id>`, tolerating not-found |
| `sync_routes` | `POST /load` with the whole rendered document |
| `verify` | `GET /config/`, diff against rendered — returns `{missing, extra, mismatched}` |

`render_config()` owns the entire document (including TLS policies), because
`POST /load` replaces everything. **DB is desired state**; the fast-path add/update/remove
calls exist only to avoid a full reload per tenant, and `sync_routes()` must always be a
no-op in effect. `verify()` is the assertion that this holds.

### Health checks probe **from the proxy node**

| probe origin | validates app | validates the path traffic takes |
|---|---|---|
| worker (`curl localhost:PORT`) | yes | no — misses firewall / bind / private-IP errors |
| controller (Mac) | yes | no — controller isn't in the request path by design |
| **proxy node** | **yes** | **yes** |

Only the proxy vantage point would catch a wrong `DOCKER-USER` rule or a bad bind
address. Fall back to the worker when no proxy is registered (Phase 1). Retry with
backoff `[1,2,3,3,3,5,5,5,8,8]` (~45s worst case), accepting `200 <= code < 400`.

**Health strictly gates the route push** — an unhealthy deployment never gets a Caddy
route, and the container is left running so `docker logs` still works for debugging.

### Capacity becomes derived, not stored

`available_node()` is rewritten as an `OUTER JOIN` over live deployments with
`COALESCE` (essential — an empty node must not be excluded), filtered to
`role='worker'` and `last_check_status='ok'`. `refresh_capacity(server)` recomputes
`active_containers`/`used_memory_mb` after every deploy/teardown so the UI stops
showing `0/50` for a full node. Both fields come out of `ServerController.writable_fields`.

Also add `NODE_MEMORY_RESERVE_MB` (default 1024) — `max_memory_mb` is set from
`free -m`, i.e. total physical RAM with no OS headroom.

---

## 5. Controller structure

New `DeploymentController` and `DomainController`; `TenantController` becomes an
orchestrator (it is already 798 lines / 25 public methods).

- **DeploymentController** — port allocation, container spec, docker run/stop/remove,
  health probing, capacity refresh. Knows nothing about domains or Caddy.
- **DomainController** — domain generation/validation, `DomainMapping` CRUD, calls
  `ProxyConfigurationService`. Knows nothing about Docker.
- **TenantController** — orchestration, activity operations, backups, the tenant record.

Composed exactly as it already composes `ServerController`/`CustomerController`.

The 14 methods that read `node_id`/`container_id` get a mechanical rewrite via two shims:

```python
dep  = self.live_deployment(tenant)      # raises the same ConflictError message
node = self.deployment_node(dep)
DockerService(node, self.settings).X(dep.container_name)
```

Identical error messages, status codes and activity-log step names, so nothing
downstream changes. Order: `stats`/`logs` → `stop`/`start`/`resize` → `log_context` →
`before_delete` → `container_spec` → `provision` → `migrate` → `create` → `list`.

**`migrate()` becomes blue/green** — deploy new, health check, repoint domains, *then*
tear down the old. Today it removes from the source first and creates on the target
after ([tenant.py:713-747](../app/controller/tenant.py#L713-L747)), which guarantees an
outage window and is unrecoverable if the target run fails.

---

## 6. Phases

Each phase ends in something demonstrable.

### Phase 1 — Reachable containers *(required; no proxy yet)*
`Deployment` model + migration + backfill; `DeploymentController`; `run_container`
publishing; `ServerNode.role`/`private_ip`; **`TENANT_DB_HOST` fix**; capacity fix;
per-deployment container names; mechanical refactor of read-only + simple lifecycle methods.

**Demo:** two tenants on one node with distinct ports, both reachable at `IP:PORT`
from the Mac; node picker shows real container counts.

### Phase 2 — Caddy edge, HTTP only *(required)*
`DomainMapping` + migration + backfill; `bootstrap_caddy`/`bootstrap_proxy`;
`CaddyAdminClient` (SSH tunnel); `ProxyConfigurationService`; `HealthCheckService`;
`provision()` rewritten as the full spec flow with health gating;
`POST /api/v1/proxy/sync` + `/verify`.

**Demo:** tenant live at `http://acme.unity-commerce.unityalgo.com/` through the proxy;
wipe Caddy's config and restore it with one sync call; a deliberately broken tenant
never gets a route.

### Phase 3 — Migration, remaining refactor, lockdown *(required)*
Blue/green `migrate()`; deployment-aware `ServerController.before_delete`;
`apply_tenant_port_firewall` (`DOCKER-USER`) + admin action to reapply.

**Demo:** migrate a tenant between VMs under continuous `curl` with no downtime and an
unchanged URL; ports unreachable from anywhere but the proxy.

### Phase 4 — TLS + legacy cleanup *(deferrable weeks, not forever)*
Wildcard DNS-01 issuer (or `internal` locally); drop the four legacy `Tenant` columns;
update serializer, admin views, 3 templates; new admin pages for deployments/domains;
delete all `traefik_*` settings and label code.

### Phase 5 — Custom domains + on-demand TLS *(genuinely deferrable)*
`POST /api/v1/tenants/<id>/domains`; DNS ownership verification; the on-demand TLS
`ask` endpoint. **Without that endpoint, anyone pointing DNS at your proxy can burn
your ACME rate limit** — it is mandatory before on-demand TLS is enabled.

---

## 7. Local test topology

| VM | IP | role |
|---|---|---|
| test-server-1 | 192.168.252.2 | worker |
| test-server-2 | 192.168.252.3 | worker (migration target) |
| **test-proxy-1** | **192.168.252.4** | **proxy (to create)** |
| Mac host | 192.168.252.1 | controller + Postgres |

Required local config: `TENANT_DB_HOST=192.168.252.1`, `PLATFORM_DOMAIN=unity-commerce.unityalgo.com`,
`PROXY_ENABLE_TLS=false`, small port range (20000–20099).

Postgres on the Mac must listen on the bridge (`listen_addresses`, `pg_hba.conf` for
`192.168.252.0/24`). **Verify with `nc -vz 192.168.252.1 5450` from a VM before
deploying anything**, or a DB-connectivity failure will masquerade as a health-check failure.

**Wildcard DNS locally:** `/etc/hosts` can't do wildcards. Use dnsmasq +
`/etc/resolver/unity-commerce.unityalgo.com`. Caveat: `/etc/resolver` is honored by
`getaddrinfo` (curl, browsers) but **`dig`/`nslookup` bypass it** — verify with
`dscacheutil -q host -a name ...`.

Simplest first smoke test, no DNS at all:
`curl -H 'Host: acme.unity-commerce.unityalgo.com' http://192.168.252.4/`

**TLS:** stay HTTP through Phase 3, then `tls internal`. When something breaks you want
to know whether it's routing or certificates.

### Verification sequence
1. Two tenants → distinct ports → `curl IP:PORT` works. Two concurrent provisions → no duplicate port.
2. Bootstrap proxy → curl with `Host:` header → then via dnsmasq.
3. `add_route` 3× → exactly one route in `GET /config/.../routes`.
4. **Recovery:** nuke Caddy config (`POST /load` with `{}`), repair with one sync call.
5. **Health gate:** break the tenant → deployment ends `failed`, **no route exists**.
6. **Migration:** continuous curl during migrate → all 200s, URL unchanged.
7. **Firewall:** curl from Mac times out; from proxy succeeds; site still loads.

---

## 8. Open decisions

1. **Platform domain.** Existing `assigned_subdomain` rows are `acme.unityalgo.com`,
   spec wants `acme.unity-commerce.unityalgo.com`. Rewrite the suffix during backfill,
   or route both generations? (DomainMapping handles both natively.)
2. **Sync execution.** Everything is synchronous inside the Flask request. Provision
   already does SSH + `docker pull`; adding ~45s of health retries makes it a
   multi-minute blocking call. `REDIS_URL`/`CELERY_*` exist in config but **Celery is not
   installed and there is no tasks module** — that config is aspirational.
   Recommendation: stay synchronous, cap retries, raise the server timeout.
3. **Third VM.** Phase 2 needs `test-proxy-1` created locally.
