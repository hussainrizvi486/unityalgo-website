# Controller — infrastructure API

The Python half of the UnityAlgo platform. It provisions and manages the
infrastructure behind UnityCommerce storefronts: worker VPS nodes, one Docker
container per tenant, a Caddy edge proxy, domain routing, backups and node
migrations — all over SSH.

It is an **internal API only**. It has no login, no session cookies and no UI
of its own: the admin screens live in the Next.js app at `/admin/servers`,
`/admin/tenants` and `/admin/logs`, and reach this service server-to-server.

## Running it

```bash
cd controller
python3 -m venv env && source env/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then fill in the values below
python main.py migrate        # apply Alembic migrations
python main.py serve          # API on :8000
```

Two more processes are needed for the full feature set:

```bash
python main.py worker          # Celery worker — provisioning, migrations, backups
python main.py beat            # Celery beat — periodic health sweep
python ws_terminal_main.py     # WebSocket SSH terminal (:8765)
```

Celery requires Redis (`REDIS_URL`). Without a worker running, the queued
operations (provision, redeploy, migrate, backup) will be accepted but never
progress past `pending`.

### Starting everything at once

Because a missing process shows up as a *partial* failure rather than an
obvious one — the terminal service being down makes the "Connect" button on
`/admin/servers/<id>` do nothing at all — there is one command that runs the
whole stack from the repo root:

```bash
npm run dev:all     # Next.js :3000 + controller :8000 + terminal :8765 + Celery worker
```

It refuses to start if a port is already taken, warns and continues without
the worker if Redis is unreachable, prefixes each process's output, and stops
everything on Ctrl-C.

## Configuration

Everything loads through `app/config.py`. The ones that matter most:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | **Must point at the same Postgres as the Next.js app.** One database for the whole platform. |
| `CONTROLLER_INTERNAL_API_KEY` | The shared secret protecting every `/api/v1/*` route. Required — the service refuses to start without it. Must match the Next.js app's value. |
| `SESSION_SECRET` | Shared with the Next.js app so the terminal service can verify the grants it mints. |
| `TENANT_DB_HOST` | Postgres address **as seen from a worker node** — never `localhost`, or tenant containers will try to reach a database on themselves. |
| `REDIS_URL` | Celery broker/backend. |

`python main.py config` prints the resolved settings with secrets masked.

## Database ownership

The platform runs on **one Postgres database with two schema owners**. Neither
tool knows about the other's tables, and Postgres does not care — but a
contributor might, so the convention is:

| Owner | Naming | Tables |
|---|---|---|
| **Drizzle** (`db/schema.ts`) | `PascalCase` | `User`, `Subscription`, `Plan`, `AddOn`, `Address`, `BillingRecord`, `SupportTicket`, `Comment`, `Post`, … |
| **Alembic** (`controller/alembic/`) | `snake_case` | `server_nodes`, `tenants`, `deployments`, `domain_mappings`, `tenant_backups`, `tenant_migrations`, `operations`, `activity_logs`, `database_connections` |

Rules of thumb:

- **Anything about people, billing or the product catalogue → the website (Drizzle).**
- **Anything about infrastructure → Alembic.**
- Foreign keys may cross the boundary. `tenants.user_id → "User"(id)` and
  `BillingRecord.tenantId → tenants(id)` both exist today; declare each one in
  whichever tool owns the table carrying the column.
- Never have both tools manage the same table.

### Reading the website's tables from Python

`app/models/platform.py` maps a few website-owned tables **read-only**
(`PlatformUser`, `PlatformSubscription`, `PlatformBillingRecord`). They exist
for two reasons: so `ForeignKey("User.id")` on `tenants` can be constructed at
all (SQLAlchemy cannot reference a table absent from its MetaData), and so the
dashboard can count customers through the ORM instead of raw SQL.

Two things keep this safe, and both matter:

1. **`alembic/env.py` filters them out of autogenerate** via `include_object`
   and `PRISMA_OWNED_TABLES`. Without it, `makemigration` would emit DDL
   against tables The website (Drizzle) owns — altering the mirrored ones (the mirror is
   deliberately partial, so it would "helpfully" drop columns) and dropping the
   ten it does not mirror. An end-to-end check asserts this filter is still
   wired up.
2. **Nothing in the controller writes them.** Writes go through the Next.js
   app, which owns the business rules.

The mirror is hand-maintained against `db/schema.ts` (the constant is still called `PRISMA_OWNED_TABLES`, a name from before the move to Drizzle). Keep it to the minimum
the controller genuinely reads: a website column that is not mirrored is simply
invisible here, which is harmless, whereas every mirrored column is one more
thing to keep in sync.

### A note on using the website's ORM from Python

Using an ORM for the website's tables from Python was considered and rejected. It would
not have solved the foreign-key problem — a second client does not put `User`
into SQLAlchemy's MetaData — while adding a second connection pool, an
async-first API to a deliberately sync service, and a Node build step, all for
what amounted to two queries.

`drizzle.__drizzle_migrations` and `alembic_version` coexist as separate ledgers. Run
both on deploy:

```bash
npm run db:migrate                    # from the repo root
python main.py migrate               # from controller/
```

## Database clusters

Tenant databases do not all have to live on the controller's own PostgreSQL.
`database_connections` is a registry of instances, each with one of two roles:

- **`cluster`** — admin credentials are held, so `CREATE DATABASE` works and
  tenants can be hosted here. One may be marked `is_default`, which is where
  new tenants land.
- **`external`** — query-console target only. Tenants can never be
  provisioned onto one; the API rejects it rather than failing halfway
  through with a permissions error.

Credentials are Fernet-encrypted at rest (`ENCRYPTION_KEY` is required to
register any connection) and are never returned by the API in any form.

A tenant's cluster is chosen at creation and stored on
`tenants.database_connection_id`. `NULL` means the legacy cluster from
`POSTGRES_*` — so tenants created before this feature keep working untouched.
`app/services/cluster_resolver.py` is the single place that resolves which
instance a tenant's data is on; everything (provisioning, backup, restore,
teardown, the container's `DATABASE_URL`) goes through it.

**`host_from_worker`** matters: a tenant container runs on a remote node and
usually cannot reach the database at the same address the controller uses.
Set it per cluster — it is the per-cluster equivalent of `TENANT_DB_HOST`.

### Moving a tenant between clusters

Unlike a node migration (which copies nothing, because the data was never on
the node), moving clusters physically moves the database:

```
dump from source → create role+database on target → restore
→ repoint tenant → redeploy container → drop source
```

`POST /api/v1/tenants/<id>/migrate-database` queues this on Celery; the
history is in `tenant_db_migrations`. The source is dropped **only** after
the tenant is verifiably repointed, and any failure before that rolls the
pointer back so the tenant keeps serving from the untouched source. The dump
file is kept either way — after the drop it is the only copy of the pre-move
state.

Changing `database_connection_id` as a plain attribute update is rejected;
it would strand the data on the old cluster.

## Identity

There is exactly one user table: the website's `User`, with a `role` of `ADMIN` or
`CUSTOMER`. The controller used to keep its own `admin_users`, `customers`,
`addresses` and `billing_records`; those were merged into the platform tables
and dropped (`scripts/migrate-controller-customers.ts`, then Alembic
`c9d3a71e5b28`).

### Tenants, customers and plans

A tenant is the infrastructure realisation of **one UnityCommerce
subscription**, and the subscription is what ties it to both a person and a
plan:

```
User ──< Subscription >── Plan          (website)
              │
              │ tenants.subscription_id  (unique)
              ▼
           tenants                       (Alembic)
```

Three columns on `tenants` are therefore **caches, not independent facts**:

| Column | Derived from |
|---|---|
| `user_id` | `Subscription.userId` |
| `customer_email` | `User.email` |
| `plan_tier` | `Plan.slug` |

`app/services/account_resolver.py` is the only place that sets them. Every
create and update runs through it, so the API cannot be made to store a tenant
whose email names one person and whose `user_id` names another. It rejects:

- a subscription already claimed by another tenant (also enforced by the
  partial unique index `uq_tenants_subscription_id`) — one plan must not
  silently fund two storefronts;
- a subscription for any product other than UnityCommerce;
- a `CANCELED` subscription;
- a `user_id` that is not the subscription's owner;
- a tenant with no owner at all.

A tenant may still be created with just a `customer_email` and no
subscription — an admin standing a store up before billing exists. It simply
has no plan and no account behind it, and both the tenant page and the
customer picker say so. Attaching a subscription later rewrites the three
cached columns to match.

`GET /api/v1/tenants?user_id=<cuid>` is the reverse lookup, which backs the
Storefronts section on `/admin/users/<id>`.

## Auth model

- `/api/v1/*` — static shared secret (`CONTROLLER_INTERNAL_API_KEY`), sent as
  `X-Controller-Key` or `Authorization: Bearer`. Compared in constant time.
  This is the **only** thing protecting endpoints that can SSH into production
  nodes, so bind the service to loopback or a private network too.
- `/health`, `/ping` — open, so probes work without the key.
- **WebSocket terminal** — the one exception. A browser cannot be given the
  API key, so the Next.js admin panel mints a JWT signed with the shared
  `SESSION_SECRET`, scoped to a single server id and expiring in 60 seconds
  (`mintTerminalTokenAction` → `app/terminal/auth.py`).

## Logging

Two layers, deliberately:

1. **Business audit trail** — `operations` (one row per end-to-end process)
   and `activity_logs` (the steps within it), written by
   `app/services/activity_logger.py` on an autonomous session so a failed
   operation's diagnostics survive the rollback. Surfaced at `/admin/logs`.
2. **Process logs** — gunicorn access/error to stdout; capture them with
   whatever supervises the process.
