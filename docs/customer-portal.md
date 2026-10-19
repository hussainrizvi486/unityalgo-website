# Customer portal and Frappe site hosting

## Features and routes

- `/dashboard`: customer summary, site counts, and application count.
- `/dashboard/app-store`: searchable, category-filtered applications from `AppCatalog`.
- `/dashboard/sites`: owned site list, refresh, and creation link.
- `/dashboard/sites/new`: site name, address, administrator password, and application selection.
- `/dashboard/sites/<id>`: installation stages, progress, status, assigned server, and retry after a cleaned-up failure.
- `/dashboard/settings`: Profile, Sessions, and Security tabs. Existing profile, password, and address routes still work.
- `/admin/apps`: create and edit application catalogue records.
- `/admin/servers`: opt a worker into Frappe provisioning using its existing settings form.

The dashboard header has a notification bell with an unread count, per-notification read controls, and mark-all-read. Provisioning events are persisted, with a controller callback and a polling fallback.

## Database ownership and deployment

The website (Drizzle) owns `AppCatalog`, `LoginSession`, and `Notification`. Alembic owns the `sites` infrastructure table (`Site` model) and the `frappe_enabled` column on `server_nodes`. The site owner is a foreign key to the shared Prisma `User` table; its assigned server is a foreign key to `server_nodes`. Credentials use the controller's existing encrypted column type and never appear in site API responses.

Apply both migrations:

```sh
npm run db:baseline   # only on a database that predates Drizzle and already has the website tables
npm run db:migrate    # the website's tables first: on a new database this creates them all
cd controller
python main.py migrate   # then the controller's, which link to the website's User and Subscription
```

The order matters. On a new database, running the controller's migration first stops with a message to run `npm run db:migrate`.

Restart Next.js, the controller API, and the Celery worker after deployment. Existing customer cookies without a tracked session id require a fresh sign-in. Admin authentication is unchanged. Customer session checks include database revocation and expiration, and every customer action uses the shared guard. Password changes revoke other sessions; password resets revoke all sessions.

## Enable real site provisioning

1. Configure a dedicated base domain in `controller/.env` using `FRAPPE_SITE_DOMAIN`. Point its wildcard DNS at the existing Caddy proxy, with ports 80/443 available for HTTPS. Do not reuse a base domain that already hosts conflicting tenant addresses.
2. Register an active proxy node and a healthy worker in `/admin/servers`. The worker needs Docker Engine, the Compose v2 plugin, and an SSH account that can run Docker and write `/opt/unityalgo/frappe`.
3. Check **Allow Frappe site provisioning** on suitable workers. Existing nodes are opted out by default. Collect current hardware and health information using the existing connection/check actions.
4. Keep the controller API and Celery worker running with Redis configured. Run the existing health sweep through Celery Beat to maintain worker health information.
5. Set `PLATFORM_INTERNAL_URL` to the internal Next.js address for completion notifications. The callback uses the existing `CONTROLLER_INTERNAL_API_KEY`; the Next.js handler reloads authoritative site state and verifies ownership before recording a notification.

Configuration:

```dotenv
FRAPPE_SITE_DOMAIN=<your-dedicated-site-domain>
FRAPPE_IMAGE=frappe/erpnext:v15.123.0
FRAPPE_AVAILABLE_APPS=erpnext
FRAPPE_PORT_START=30000
FRAPPE_PORT_END=31999
FRAPPE_CUSTOMER_SITE_LIMIT=3
PLATFORM_INTERNAL_URL=http://127.0.0.1:3000
```

Each site reserves 6 GB of memory and ten container slots, including installation headroom. Placement uses current allocations, not cached counters, and excludes inactive, unhealthy, proxy, and non-Frappe workers. Frappe sites and UnityCommerce deployments share capacity accounting and the placement lock. Disk checks also reserve headroom for sites assigned to a worker. Customer requests use an idempotency key, and the reservation commits before a job is published.

## Application packages

The migration seeds Lending, FBR Integration, and Point of Sale. Point of Sale is provided by ERPNext. The standard image contains Frappe and ERPNext; it does not contain third-party Lending or FBR packages. Build and publish a compatible custom image, set `FRAPPE_IMAGE` and `FRAPPE_AVAILABLE_APPS`, then enable the matching catalogue entries in `/admin/apps`. FBR also needs its actual package name, which is deliberately not guessed. Image configuration is controlled by operators, not customer form input.

Reference: [official Frappe Docker composition](https://github.com/frappe/frappe_docker/blob/main/compose.yaml) and [custom image setup](https://github.com/frappe/frappe_docker/blob/main/docs/02-setup/02-build-setup.md).

## Provisioning and recovery

The Celery task downloads images, starts MariaDB and Redis, configures the shared site volume, creates the Frappe site, installs approved applications, starts backend/frontend/workers/scheduler/websocket, checks the application endpoint, and adds its address to the existing Caddy configuration.

Each site has its own Compose project, private network, database, Redis instances, and persistent volumes. Only the frontend port is published. Worker deployment files and logs are protected; customer responses omit passwords, connection credentials, host ports, and IPs.

A provisioning error attempts to stop the project's containers without deleting data volumes. A successful cleanup makes the site retryable. Incomplete cleanup or a hard worker timeout moves it to `cleanup_required` and retains capacity. An administrator must investigate the protected deployment log before recovering that state. The customer cannot force-release potentially running infrastructure. Backups and lifecycle teardown for Frappe sites require a separate operational policy before production use.

## Verification

```sh
node --import tsx scripts/test-customer-portal.mts
cd controller
python -m unittest discover -s tests -v
```

The TypeScript integration test runs against localhost using isolated temporary users and cleans them up. It checks dynamic catalogue data, dashboard routes, notification ownership/read status, CSRF, and rejected legacy/revoked/expired sessions. Python tests check worker eligibility, capacity, ownership, idempotency, queue failures, and mocked provisioning/cleanup. All SSH, Docker, Celery publishing and Caddy changes in those tests are mocked. No real Frappe site is created by the test suite.
