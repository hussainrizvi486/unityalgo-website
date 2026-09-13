# UnityCommerce Controller — Progress & Reference

**Purpose of this file:** a single source of truth for what exists, what works,
and what's next — written so an agent picking up this repo cold can get
productive in one read instead of re-deriving state from the codebase or chat
history. Everything in here (schema, routes, settings) was pulled live from
the running system, not from memory — regenerate the dumps below with the
commands shown if this file goes stale.

Last verified: 2026-08-16, alembic head `a1c9d47e6b32`.

---

## 1. What this system is

Multi-tenant control plane for Next.js ecommerce storefronts. It provisions
one Docker container per tenant onto a fleet of worker VPS nodes over SSH, and
tracks everything (servers, tenants, deployments, domains, billing, activity)
in Postgres.

**Stack:** Python 3.14, Flask (sync, not FastAPI/async — deviated from an
earlier spec), SQLAlchemy 2.0 + psycopg2, Alembic, Paramiko (SSH), Docker CLI
over SSH (no Docker SDK, no exposed Docker socket).

**Architecture pattern**, applied consistently everywhere — read one instance
of each to understand the whole codebase:
- `app/models/*.py` — SQLAlchemy 2.0 `Mapped[]` models. All imported in
  `app/models/__init__.py` (required for relationship string-refs to resolve).
- `app/controller/*.py` — business logic. All inherit `BaseController`
  (`app/controller/base.py`): generic `create/update/delete/get/paginate`
  driven by `model`, `writable_fields`, `clean()`, `apply_defaults()`,
  `before_update()`, `before_delete()`, `conflict_message()`. Constructor is
  always `(session, config=None, actor=None)`.
- `app/services/*.py` — infra: `SSHService`, `DockerService`,
  `PostgresService`, `ActivityLogger`.
- `app/routes/*.py` — JSON API. Flask `MethodView` + a `XRoutes` class with
  `classmethod blueprint(db, config)`.
- `app/admin/*.py` + `app/templates/admin/**` — server-rendered admin panel
  (Jinja2, Tailwind CDN via CSS-variable tokens — `bg-page`, `text-fg`,
  `border-line`, `bg-brand-solid`, etc., themed for light/dark).
- `app/serializers.py` — one `BaseSerializer` subclass per model.

**Local dev topology** (Multipass VMs on the Mac):
| VM | IP | role | notes |
|---|---|---|---|
| test-server-1 | 192.168.252.2 | worker | `ubuntu`/`123` password SSH |
| test-server-2 | 192.168.252.3 | worker | same creds; **clock drifts hard when stopped >1 day — resync with `sudo date -u -s "$(date -u +'%Y-%m-%d %H:%M:%S')"` or apt/TLS fail with confusing errors** |
| test-proxy-1 | 192.168.252.4 | proxy | same creds; runs Caddy (`docker run --network host`), admin API on `127.0.0.1:2019` reached only via SSH tunnel — see §5 |

Controller's own Postgres + all tenant databases live on a **DigitalOcean
managed Postgres cluster** (not local) — `.env` has the real credentials.

---

## 2. Database schema (live, as of the migration chain below)

Regenerate with:
```bash
./env/bin/python -c "
from app.db import database
from sqlalchemy import text
with database.engine.connect() as c:
    tables = [r[0] for r in c.execute(text(\"select tablename from pg_tables where schemaname='public' and tablename != 'alembic_version' order by 1\"))]
    for t in tables:
        print(f'### {t}')
        for row in c.execute(text(f\"select column_name, data_type from information_schema.columns where table_name='{t}' order by ordinal_position\")):
            print(' ', row)
"
```

### Migration chain (alembic)
```
1a9aa42edf5d  create server_nodes, tenants, provisioning_log (root)
2b7c4e91d3a0  add ssh_password to server_nodes
7f3a2c9d1e60  add admin_users, customers, server hw specs, tenant_backups, tenant_migrations
9c4e18b7a250  add billing_records, operations, activity_logs; DROP provisioning_logs
a7d1c4e90b21  add deployments table, server_nodes.role/private_ip; backfill from tenants
b4f6a1d0c8e3  add tenants.jwt_secret; backfill
c5e8f2a4b917  add domain_mappings; backfill from assigned_subdomain/custom_domain  ← HEAD
```

### Core tables

**`server_nodes`** — a worker or proxy VPS.
`id, name(uniq), ip_address, private_ip, role('worker'|'proxy'), ssh_port,
ssh_user, ssh_key_path, ssh_password, max_memory_mb, used_memory_mb(cache),
max_containers, active_containers(cache), is_active, cpu_cores, disk_total_gb,
disk_used_gb, os_name, kernel_version, architecture, docker_version,
last_checked_at, last_check_status, created_at`

**`tenants`** — one storefront account.
`id, tenant_slug(uniq), customer_email, customer_id→customers, plan_tier,
status('pending'|'active'|'paused'|'terminated'), memory_limit_mb,
cpu_limit_cores, db_name, db_user, db_password, jwt_secret, created_at,
updated_at`
Plus **legacy write-through columns** (see §3): `node_id→server_nodes`,
`container_id`, `assigned_subdomain`, `custom_domain` — kept in sync by
`TenantController` but the source of truth is now `deployments` /
`domain_mappings`. Slated to drop in a future "Phase 4" cleanup.

**`deployments`** — one running (or historical) container. **This is the
tenant→server relationship now**, not a column on `tenants`.
`id, tenant_id→tenants(CASCADE), server_id→server_nodes(RESTRICT),
application, image, container_name, container_id, port(host port, unique per
server), container_port, status('pending'|'deploying'|'health_checking'|
'live'|'stopped'|'draining'|'failed'|'removed'), health_status, health_message,
last_health_at, memory_limit_mb, cpu_limit_cores(snapshotted at deploy time),
created_at, updated_at, started_at, stopped_at, port_released_at`
Partial unique index: at most one `status='live'` row per tenant.

**`domain_mappings`** — one hostname → one deployment. Many can point at the
same tenant.
`id, tenant_id→tenants(CASCADE), deployment_id→deployments(SET NULL, nullable),
domain(uniq, lowercased), domain_type('platform'|'custom'),
status('pending'|'active'|'disabled'), ssl_status('none'|'pending'|'active'|
'failed'), verified_at, last_synced_at, created_at, updated_at`
`is_routable` (model property, not a column) = `status=='active' AND
deployment_id is not None AND deployment.status=='live'` — this is why
stop()/start() need zero domain-specific code (see §3).

**`customers`** — billing/account owner.
`id, name, email(uniq), company, phone, is_active, created_at`

**`billing_records`** — manual invoices/charges.
`id, customer_id→customers(CASCADE), tenant_id→tenants(SET NULL, nullable),
invoice_number(uniq, auto "INV-YYYY-NNNN"), description, amount, currency,
status('draft'|'pending'|'paid'|'overdue'|'refunded'|'cancelled'),
period_start, period_end, issued_at, due_date, paid_at, payment_method,
payment_reference, notes, created_at, updated_at`

**`operations`** + **`activity_logs`** — structured, step-by-step logging.
**Deliberately have NO foreign keys** to tenant/server/customer — written on
an *autonomous session* (`ActivityLogger`, commits immediately, independent of
the caller's transaction) so failure logs survive a rollback. Denormalized
label columns (`tenant_slug`, `server_name`, etc.) keep entries readable after
the subject is deleted.
`operations`: `id, kind, category, label, status, tenant_id, server_id,
customer_id, billing_record_id, tenant_slug, server_name, customer_name,
actor, error_message, step_count, duration_ms, started_at, completed_at,
created_at`
`activity_logs`: same subject columns + `operation_id, action, step_name,
step_index, status, message, details(jsonb), error_message, duration_ms,
actor, created_at`

**`admin_users`** — logs into `/admin` (distinct from a tenant's own
storefront admin, which lives in the tenant's own DB via `create-admin.mjs`).
`id, username(uniq), email(uniq), password_hash, role, is_active,
last_login_at, created_at`

**`tenant_backups`**, **`tenant_migrations`** — pg_dump snapshots and
migration audit trail. `node_id`/`from_node_id`/`to_node_id` here are
historical snapshots, intentionally never dropped even as `tenants.node_id`
gets phased out.

---

## 3. Key design decisions (read this before changing lifecycle code)

**Tenant data lives in the controller's own Postgres, not on worker nodes.**
Worker nodes only run the stateless Next.js container. A tenant "migration"
never copies data — it just points a new container at the same
`tenant_db_<slug>` database. `create_backup()` is a safety snapshot, not a
transfer mechanism.

**`deployment_id` is the only thing that changes on migrate.** Domains and DNS
never change — `DomainController.repoint_all(tenant, deployment)` rewrites
`deployment_id` on every one of a tenant's domain rows. This is the entire
point of the `domain_mappings` table.

**`is_routable` derives from the deployment's live status, not a cached
flag.** stop()/start() reuse the *same* deployment row (flip `status` between
`live`↔`stopped`) rather than creating a new one, so routability tracks
automatically — **zero domain code runs in stop() or start()**. Only
provision()/migrate() (which create a *new* deployment) call `repoint_all()`.

**migrate() is blue/green, deploy-before-teardown.** New deployment created
and health-checked *before* the old one is touched. If the new deploy fails,
the tenant is still serving on the old node — verified live (a target-node
failure left the tenant fully functional on the source node).

**Legacy tenant columns (`node_id`, `container_id`, `assigned_subdomain`,
`custom_domain`) are a write-through cache, not the source of truth.**
`TenantController.sync_legacy_pointers()` keeps them matching the current live
deployment/platform domain after every provision/migrate/start. ~20 read
sites (serializer, admin views, templates) still depend on them. Do not remove
without migrating those sites first.

**`BaseController.flush()` rolls back the WHOLE transaction on
`IntegrityError`**, not a savepoint. Port allocation therefore uses
`pg_advisory_xact_lock` (serializes concurrent provisions per-node) with the
`UniqueConstraint(server_id, port)` as backstop — verified under real
concurrent load, got distinct ports.

**One shared `tenant_environment()` builder** in `DeploymentController` feeds
`deploy()`, `run_db_migrations()`, and `create_store_admin()` identical env
vars (`DATABASE_URL`, `JWT_SECRET`, `MEDIA_DRIVER`, `NODE_ENV`). This exists
*because* it didn't before: someone wired `JWT_SECRET` into only the migrate
container, using a function that regenerated a new random secret every call —
the deployed app crashed with "JWT_SECRET must be set in production" and any
redeploy would have silently invalidated every session. Fixed: `jwt_secret` is
now a stable per-tenant DB column (like `db_password`), generated once.

**Schema migrations run from a SEPARATE image**, not the runtime one. The
Dockerfile's `runner` stage (what tenants actually run) is a Next.js
standalone build with no `scripts/` or `drizzle/`. Migrations run
`node scripts/migrate.mjs` in a throwaway container from the `migrate` stage
— tag convention `<runtime-tag>-migrate` (`TENANT_MIGRATE_IMAGE_SUFFIX`),
overridable via `TENANT_MIGRATE_IMAGE`. Running it as a separate one-shot job
(not from an app replica) also means concurrent app starts can't race for the
migration lock. `TENANT_MIGRATE_ON_PROVISION=true` runs it automatically
before the app container starts.

**Capacity accounting is real now, was previously dead.**
`server_nodes.active_containers`/`used_memory_mb` used to never be
incremented anywhere — `available_node()` picked nodes almost arbitrarily.
Now derived from live `deployments` rows via `ServerController.node_load()` /
`refresh_capacity()`, with `NODE_MEMORY_RESERVE_MB` headroom subtracted
(`max_memory_mb` comes from raw `free -m`, i.e. total physical RAM).
`placement_error()` gives an actionable reason ("only 175MB free, needs
256MB: 943MB total - 256MB reserved - 512MB allocated") instead of a bare
"no node available."

**Secrets over SSH stdin, never argv.** `SSHService._exec`/`DockerService.
run_once` support `stdin_data=`. Storefront admin passwords are piped in via
`read -r ADMIN_PW; exec node create-admin.mjs "$ADMIN_EMAIL" "$ADMIN_PW"` —
anything in a command string is visible in the node's process table (`ps`)
for the life of the process; stdin isn't.

**Connection retries are real, not cosmetic.** Both the SQLAlchemy engine
(`app/db.py`, a `do_connect` event listener) and `PostgresService`'s admin
connections retry transient failures (DNS blips, connection refused) with
backoff `(0.5, 1, 2, 4, 8)`s, but fail immediately on config errors (bad
password) rather than waiting 15s to say so. This exists because the
controller's own DB is a managed instance reached by hostname over the
internet — **a home router can fail to resolve one specific domain
(`ondigitalocean.com`) while resolving everything else fine** (diagnosed live
by bypassing the router and querying `1.1.1.1`/`8.8.8.8` directly — they
resolved instantly). That's a router-level DNS/cache issue, not something
retry logic fixes if it lasts >15s; the real fix is pointing the Mac's DNS at
a public resolver.

**Tenant containers get `--dns 1.1.1.1 --dns 8.8.8.8`**
(`TENANT_DNS_SERVERS`) for the same reason — independent of whatever the
worker node's own resolver chain does.

---

## 4. What's done (Phase 1 + DomainMapping)

- [x] `Deployment` model — tenant→deployment→server, host port, one-live-per-tenant constraint
- [x] Host port publishing (`docker run -p <private_ip>:<port>:3000`) — refuses to bind `0.0.0.0`
- [x] `TENANT_DB_HOST`/`TENANT_DB_SSLMODE` — fixed containers pointing `DATABASE_URL` at the controller's own `localhost`
- [x] Port allocation: advisory-lock serialized, unique-constraint backstop, verified under concurrency
- [x] Real capacity accounting (`node_load`, `refresh_capacity`, `placement_error`)
- [x] `TenantController` fully refactored onto deployments (stop/start/resize/stats/logs/provision/migrate/before_delete)
- [x] Redeploy action (same node+port, pulls latest image) — admin + API
- [x] DB-migration action (separate migrate-stage image, pull→probe→run) — admin + API
- [x] Storefront admin seeding (`create-admin.mjs`, password via stdin) — admin + API
- [x] `jwt_secret` — stable per-tenant, unified env-var builder
- [x] `DomainMapping` model + full CRUD + tenant integration (create reserves platform domain, provision/migrate repoint) — verified live including auto stop/start routability
- [x] Admin UI: Deployments/Domains cards on tenant detail, Redeploy/DB-migrate/Store-admin/Domain buttons
- [x] Activity logging on every multi-step flow (autonomous session, survives rollback — verified)
- [x] `ServerNode.role`/`private_ip` columns (used by `available_node()` to exclude `role != 'worker'`, and by `ServerController.proxy_node()` to find the edge proxy)

## 5. Phase 2 — Caddy edge proxy + DNS domain connector (done, HTTP-only)

Built and verified live against 3 local Multipass VMs (`test-server-1`,
`test-server-2` as workers, `test-proxy-1` as the edge). A tenant now routes
through `http://<domain>` via Caddy, not just `IP:PORT`.

- [x] `ServerNode.proxy_admin_port` column; `ServerController.proxy_node()` (first active `role='proxy'` node)
- [x] `SSHService.bootstrap_caddy()` — `caddy:2-alpine` in Docker with `--network host`, native JSON config (no `--adapter` flag)
- [x] `CaddyAdminClient` (`app/services/caddy_admin_client.py`) — Paramiko `direct-tcpip` tunnel to Caddy's admin API (`127.0.0.1:2019`, never exposed publicly), stdlib `http.client` with `.sock` swapped to the tunneled channel
- [x] `ProxyConfigurationService` (`app/services/proxy_configuration_service.py`) — **always full-resync**, not partial upserts: `sync_all()` rebuilds Caddy's entire config from every `DomainController.routable()` mapping and `POST /load`s it. Simpler than the original partial `add_route`/`remove_route` design and has no partial-update drift risk, since Celery already keeps this off the request thread. `verify()` diffs live config vs. expected for a "Verify config" admin action.
- [x] `HealthCheckService` — probes `curl` **from the proxy node** (not the worker, not the controller), backoff `[1,2,3,3,3,5,5,5,8,8]` (~45s worst case), gates `provision()`/`migrate()` before a deployment goes live or a route gets pushed
- [x] Wired into `TenantController`: `provision()`/`migrate()` health-check-then-sync (health check happens *before* the old deployment is torn down in `migrate()`, preserving blue/green safety); `stop()`/`start()` re-sync so Caddy reacts to lifecycle changes
- [x] Domain DNS connector — `DomainController.verify_and_activate()` resolves the domain via stdlib `socket.getaddrinfo()` and compares against the proxy's public IP; rejects with the actual resolved IPs if it doesn't match yet. Replaces the honor-system "Activate" button for non-platform domains. Admin UI: DNS instructions banner + "Verify DNS" button on the tenant Domains card. `activate()`/`verify_and_activate()`/`disable()`/`delete()` all trigger an immediate `ProxyConfigurationService.sync_all()` (`DomainController._sync_proxy()`) — a domain goes live or disappears from Caddy the moment the action completes, not on the next unrelated provision/migrate/stop/start.
- [x] `DOCKER-USER` iptables lockdown (`SSHService.apply_tenant_port_firewall()`) — opt-in per worker, admin action with a confirm dialog. Uses `-m conntrack --ctorigdstport` (not `--dport`, which never matches post-DNAT) and an `ESTABLISHED,RELATED` allow rule first (`DOCKER-USER` sees both directions of `FORWARD` traffic, so an allow rule scoped only to the proxy's source IP blocks the container's response and breaks the handshake). Applied and verified on both local worker VMs.
- [x] New routes: `GET/POST /api/v1/proxy/{info,sync,verify}`, `POST /api/v1/domains/<id>/verify`, `POST /api/v1/servers/<id>/{bootstrap-caddy,lockdown}`
- [x] Admin UI: `role` selector on New Server, Caddy/sync/verify actions + lockdown action on Server detail, DNS connector on Tenant Domains card

**Verified live end-to-end** (2026-08-16), through the real running Flask
process + a real admin session, not just direct controller calls: tenant
`hyphen` served correctly through the proxy (`curl -H "Host:
hyphen.unityalgo.com" http://<proxy-ip>/` → 200) while direct access to its
worker's published port timed out (firewall lockdown active on both
workers); `ProxyConfigurationService.verify()` reports `in_sync: true` with
the live route count matching exactly. Also drove the full DNS-connector
cycle through the actual `/api/v1/*` routes (add domain → reject unresolved
→ verify with DNS pointed at the proxy → route appears in Caddy and serves
real traffic with zero manual sync → delete → route disappears), which
caught and fixed the `_sync_proxy()` gap above (originally `activate`/
`verify_and_activate`/`disable`/`delete` only touched the DB row).

**Deliberately out of scope** (same reasoning as `docs/proxy-edge-architecture.md`):
- **TLS** — stays HTTP-only; no real public domain/ACME access available here, and the doc itself recommends staying HTTP-only until routing is proven solid. `PROXY_ENABLE_TLS` config flag exists, defaulted off.
- **Real wildcard DNS record registration** — one-time action on the domain registrar, outside this app.
- **Platform domain format** — `PLATFORM_DOMAIN` defaults to `BASE_DOMAIN` (still `slug.unityalgo.com`); the original spec's `slug.unity-commerce.unityalgo.com` was never confirmed as wanted, so nothing changed by default.

Full original design detail (route JSON shape, local-testing recipe with
dnsmasq): `docs/proxy-edge-architecture.md` — note its partial `add_route`/
`remove_route` API and blocking-Flask-request concern were both superseded
by the simpler always-full-resync approach above once Celery existed.

---

## 5a. Live routes (regenerate: `./env/bin/python main.py routes`)

<details><summary>JSON API (/api/v1/*)</summary>

```
GET,POST              /api/v1/tenants                          create/list tenants
DELETE,GET,PATCH,PUT  /api/v1/tenants/<id>                      tenant CRUD
GET                   /api/v1/tenants/slug/<slug>
PATCH                 /api/v1/tenants/<id>/status
POST                  /api/v1/tenants/<id>/provision
POST                  /api/v1/tenants/<id>/redeploy
POST                  /api/v1/tenants/<id>/db-migrate
POST                  /api/v1/tenants/<id>/store-admin
POST                  /api/v1/tenants/<id>/stop
POST                  /api/v1/tenants/<id>/start
POST                  /api/v1/tenants/<id>/resize
POST                  /api/v1/tenants/<id>/migrate
GET                   /api/v1/tenants/<id>/migrations
GET                   /api/v1/tenants/<id>/stats
GET                   /api/v1/tenants/<id>/container-logs
GET                   /api/v1/tenants/<id>/logs
GET,POST              /api/v1/tenants/<id>/backups
GET                   /api/v1/tenants/<id>/backups/<backup_id>
POST                  /api/v1/tenants/<id>/backups/<backup_id>/restore
GET,POST              /api/v1/tenants/<id>/domains
POST                  /api/v1/create/tenant                     (legacy alias)

GET,POST              /api/v1/servers
DELETE,GET,PATCH,PUT  /api/v1/servers/<id>
GET,POST              /api/v1/servers/<id>/check
POST                  /api/v1/servers/<id>/connect
POST                  /api/v1/servers/<id>/bootstrap
POST                  /api/v1/servers/<id>/bootstrap-caddy         (role='proxy' only)
POST                  /api/v1/servers/<id>/lockdown                (role='worker' only; DOCKER-USER iptables)
GET                   /api/v1/servers/<id>/containers

DELETE,GET            /api/v1/domains/<id>
POST                  /api/v1/domains/<id>/activate                (platform domains only, no DNS check)
POST                  /api/v1/domains/<id>/verify                  (custom domains: real DNS check, activates on match)
POST                  /api/v1/domains/<id>/disable

GET                   /api/v1/proxy/info                           registered proxy's public IP, for DNS setup instructions
POST                  /api/v1/proxy/sync                           full resync: rebuild Caddy config from every routable domain
GET                   /api/v1/proxy/verify                         diff live Caddy config vs. expected

GET,POST              /api/v1/customers
DELETE,GET,PATCH,PUT  /api/v1/customers/<id>

GET,POST              /api/v1/billing
DELETE,GET,PATCH,PUT  /api/v1/billing/<id>
GET                   /api/v1/billing/<id>/history

GET                   /api/v1/logs
GET                   /api/v1/logs/operations
GET                   /api/v1/logs/operations/<id>

GET,POST              /api/v1/users
DELETE,GET,PATCH,PUT  /api/v1/users/<id>
POST                  /api/v1/auth/login
POST                  /api/v1/auth/logout
GET                   /api/v1/auth/me

GET                   /health
GET                   /ping
```
</details>

<details><summary>Admin panel (/admin/*)</summary>

```
GET,POST  /admin/login, /admin/logout
GET       /admin/                                    dashboard

GET       /admin/tenants
GET,POST  /admin/tenants/new
GET       /admin/tenants/<id>
POST      /admin/tenants/<id>/provision
POST      /admin/tenants/<id>/redeploy
POST      /admin/tenants/<id>/db-migrate
POST      /admin/tenants/<id>/store-admin
POST      /admin/tenants/<id>/stop
POST      /admin/tenants/<id>/start
POST      /admin/tenants/<id>/resize
POST      /admin/tenants/<id>/migrate
POST      /admin/tenants/<id>/backup
POST      /admin/tenants/<id>/backups/<backup_id>/restore
POST      /admin/tenants/<id>/domains                (add custom)
POST      /admin/tenants/<id>/domains/<id>/activate
POST      /admin/tenants/<id>/domains/<id>/disable
POST      /admin/tenants/<id>/domains/<id>/delete
POST      /admin/tenants/<id>/delete

GET       /admin/servers
GET,POST  /admin/servers/new
GET       /admin/servers/<id>
POST      /admin/servers/<id>/connect
POST      /admin/servers/<id>/bootstrap
POST      /admin/servers/<id>/toggle-active
POST      /admin/servers/<id>/delete

GET       /admin/customers, /admin/customers/new, /admin/customers/<id>, .../delete
GET       /admin/billing, /admin/billing/new, /admin/billing/<id>, .../edit, .../mark-paid, .../delete
GET       /admin/logs, /admin/logs/operations/<id>
GET       /admin/users, /admin/users/new, .../toggle-active, .../delete
```
</details>

---

## 6. Settings reference

Every setting lives in `app/config.py` / `.env` — grep there for the
authoritative current list + defaults. Notable groups:

- **DB**: `DATABASE_URL` (controller's own, needs `postgresql+psycopg2://`
  — async drivers rejected), `POSTGRES_SSLMODE=require` (managed PG),
  `DB_POOL_RECYCLE`, `POSTGRES_CONNECT_TIMEOUT`
- **Tenant DB**: `TENANT_DB_HOST`/`PORT`/`SSLMODE` — **must not be
  `localhost`**, that's a container resolving to itself
- **Ports**: `TENANT_PORT_RANGE_START/END` (20000-20099 locally),
  `PORT_REUSE_COOLDOWN_SECONDS`, `NODE_MEMORY_RESERVE_MB`
- **Migrations**: `TENANT_MIGRATE_IMAGE(_SUFFIX)`, `TENANT_MIGRATE_COMMAND`,
  `TENANT_MIGRATE_PROBE`, `TENANT_MIGRATE_ON_PROVISION`
- **DNS**: `TENANT_DNS_SERVERS=1.1.1.1,8.8.8.8`
- **SSH**: `SSH_USER/PASSWORD/KEY_PATH`, `SSH_HOST_KEY_POLICY=auto` (trusts
  unknown host keys — fine for churny local VMs, not for prod)
- **Domain**: `BASE_DOMAIN` (currently `unityalgo.com`)

---

## 7. Known issues / gotchas for whoever picks this up

- **Local Multipass VM clocks drift badly when stopped >1 day** → apt/TLS
  fail with confusing "not valid yet" errors. Fix: `sudo date -u -s "$(date -u +'%Y-%m-%d %H:%M:%S')"` on the VM.
- **User's home router intermittently fails DNS for `ondigitalocean.com`
  specifically** while other domains resolve fine. Confirmed via direct
  `1.1.1.1`/`8.8.8.8` queries. Retries paper over blips <15s; longer outages
  need the user to point their Mac's DNS at a public resolver.
- **`docker run` can create a container then fail during network setup**,
  leaving a stopped orphan with the same name — `run_container()` force-
  removes any same-named container first specifically because of this.
- **A node stopped while it still has live deployments will leave orphaned
  containers on disk** (with `restart:always`) that resurrect when the node
  restarts, even though the controller's `teardown()` already freed the DB
  row (it's designed to do that when the node is unreachable, rather than
  leak the port forever). Found one exactly this way after restarting
  `test-server-2` after a long stop. No automated sweep for this yet — check
  manually after restarting a long-stopped node.
- **`server_nodes.max_memory_mb` is set from raw `free -m`** (total physical
  RAM) — `NODE_MEMORY_RESERVE_MB` exists specifically so placement doesn't
  schedule a node into OOM, but it's a fixed default (1024 prod / 256 local),
  not dynamic.
- The storefront image used for testing
  (`ghcr.io/unityalgo/unity-commerce`) requires its `-migrate` tag to be
  built and pushed separately — the `latest` tag alone cannot run migrations.
