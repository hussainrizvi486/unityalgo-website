"""Application configuration.

Every credential and tunable lives in the environment (loaded from `.env` in
development). Nothing in the codebase should hardcode a host, password or
secret -- read it off the `settings` singleton exported at the bottom.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent


class ConfigError(RuntimeError):
    """Raised when the environment is missing or misconfigured."""


class Settings:
    def __init__(self, env_file=None):
        self.base_dir = BASE_DIR
        self.env_file = Path(env_file) if env_file else BASE_DIR / ".env"
        load_dotenv(self.env_file, override=False)

        # -- Flask app ----------------------------------------------------
        self.app_name = self._str("APP_NAME", "unitycommerce-controller")
        self.app_env = self._str("APP_ENV", "development")
        self.app_host = self._str("APP_HOST", "0.0.0.0")
        self.app_port = self._int("APP_PORT", 6000)
        self.app_debug = self._bool("APP_DEBUG", False)
        self.secret_key = self._str("SECRET_KEY", "change-me")
        self.session_lifetime_seconds = self._int("SESSION_LIFETIME_SECONDS", 60 * 60 * 12)

        # -- PostgreSQL ---------------------------------------------------
        self.postgres_host = self._str("POSTGRES_HOST", "localhost")
        self.postgres_port = self._int("POSTGRES_PORT", 5450)
        self.postgres_user = self._str("POSTGRES_USER", "postgres")
        self.postgres_password = self._str("POSTGRES_PASSWORD", "postgres")
        self.postgres_db = self._str("POSTGRES_DB", "postgres")
        # Applies to the admin psycopg2 connections and pg_dump/pg_restore used
        # for tenant provisioning and backups (the SQLAlchemy engine takes its
        # own sslmode from DATABASE_URL). Managed Postgres needs 'require';
        # 'prefer' is libpq's default and works with a plain local server.
        self.postgres_sslmode = self._str("POSTGRES_SSLMODE", "prefer")
        self.postgres_connect_timeout = self._int("POSTGRES_CONNECT_TIMEOUT", 10)
        self.db_echo = self._bool("DB_ECHO", False)
        self.db_pool_size = self._int("DB_POOL_SIZE", 5)
        self.db_max_overflow = self._int("DB_MAX_OVERFLOW", 10)
        # Reconnect pooled connections older than this. Keeps them well inside
        # a managed provider's idle timeout and means fewer DNS lookups.
        self.db_pool_recycle = self._int("DB_POOL_RECYCLE", 1800)
        self.database_url = self._database_url()
        # Where tenant pg_dump backups are written, and where to find the
        # pg_dump/pg_restore/psql client binaries (Homebrew's libpq is
        # keg-only, so it's usually not on PATH).
        self.backup_dir = self._str(
            "BACKUP_DIR", str(BASE_DIR / "backups")
        )
        self.pg_bin_dir = self._str("PG_BIN_DIR", "")

        # -- Redis / Celery ----------------------------------------------
        self.redis_url = self._str("REDIS_URL", "redis://localhost:6379/0")
        self.celery_broker_url = self._str("CELERY_BROKER_URL", self.redis_url)
        self.celery_result_backend = self._str("CELERY_RESULT_BACKEND", self.redis_url)

        # -- Celery workers ------------------------------------------------
        # Hard kill (SIGKILL) vs SoftTimeLimitExceeded -- soft gives a task a
        # chance to fail cleanly; hard is the backstop when it doesn't.
        self.celery_task_time_limit = self._int("CELERY_TASK_TIME_LIMIT", 900)
        self.celery_task_soft_time_limit = self._int("CELERY_TASK_SOFT_TIME_LIMIT", 840)
        # SSH/IO-bound, not CPU-bound -- a low concurrency is plenty.
        self.celery_worker_concurrency = self._int("CELERY_WORKER_CONCURRENCY", 2)
        # Dev/test convenience: runs tasks inline with no broker at all.
        self.celery_task_always_eager = self._bool("CELERY_TASK_ALWAYS_EAGER", False)

        # -- Credential encryption -----------------------------------------
        # Encrypts secrets that hold live credentials to third-party systems
        # (see app/services/crypto.py) -- currently just DatabaseConnection
        # passwords. Checked lazily, not here, so installs that never touch
        # that feature don't need it set. Generate one with:
        #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
        self.encryption_key = self._str("ENCRYPTION_KEY", "")

        # -- Webhooks from the main platform ------------------------------
        self.webhook_secret = self._str("WEBHOOK_SECRET", "change-me")
        self.webhook_signature_header = self._str("WEBHOOK_SIGNATURE_HEADER", "X-Signature")

        # -- Service-to-service auth --------------------------------------
        # The shared secret the UnityAlgo Next.js server presents on every
        # /api/v1/* call (see app/api_auth.py). This is the only protection
        # on endpoints that can SSH into production nodes and destroy tenant
        # containers, so it is required in every environment -- there is no
        # safe default to fall back to.
        self.controller_internal_api_key = self._str("CONTROLLER_INTERNAL_API_KEY", "")

        # -- Session signing ----------------------------------------------
        # Shared with the Next.js app (its SESSION_SECRET) so the WebSocket
        # terminal can verify the short-lived, purpose-scoped access tokens
        # that app mints for an already-authenticated admin. Falls back to
        # SECRET_KEY only so a controller with no terminal in use still boots.
        self.session_signing_secret = self._str("SESSION_SECRET", "") or self.secret_key

        # -- Tenant provisioning defaults ---------------------------------
        self.base_domain = self._str("BASE_DOMAIN", "unityalgo.com")
        self.tenant_image = self._str(
            "TENANT_IMAGE", "ghcr.io/unityalgo/unitycommerce-template:latest"
        )
        self.tenant_container_port = self._int("TENANT_CONTAINER_PORT", 3000)
        self.tenant_memory_limit_mb = self._int("TENANT_MEMORY_LIMIT_MB", 256)
        self.tenant_cpu_limit_cores = self._str("TENANT_CPU_LIMIT_CORES", "0.50")
        self.tenant_db_prefix = self._str("TENANT_DB_PREFIX", "tenant_db_")
        self.tenant_user_prefix = self._str("TENANT_USER_PREFIX", "user_")
        # Only used for a tenant created without a subscription; normally
        # plan_tier is a cache of the linked Plan's slug.
        self.default_plan_tier = self._str("DEFAULT_PLAN_TIER", "launch")

        # Address a tenant container uses to reach Postgres. MUST NOT default
        # to postgres_host: that is the controller's own view ("localhost"),
        # which a container on a remote node resolves to *itself*.
        self.tenant_db_host = self._str("TENANT_DB_HOST", "") or None
        self.tenant_db_port = self._int("TENANT_DB_PORT", self.postgres_port)
        # Managed Postgres (DigitalOcean, RDS, ...) rejects unencrypted
        # connections, and Node's pg driver does NOT negotiate TLS unless the
        # DSN asks for it. Default to require; set 'disable' for a plain local
        # Postgres.
        self.tenant_db_sslmode = self._str("TENANT_DB_SSLMODE", "require")
        # Schema migrations run from a SEPARATE image built from the
        # Dockerfile's `migrate` stage. The `runner` stage is a Next.js
        # standalone build and deliberately contains no scripts/ or drizzle/.
        # Keeping them apart means several app replicas starting at once cannot
        # race for the migration lock.
        self.tenant_migrate_image = self._str("TENANT_MIGRATE_IMAGE", "") or None
        self.tenant_migrate_image_suffix = self._str(
            "TENANT_MIGRATE_IMAGE_SUFFIX", "-migrate"
        )
        # Plain JS, production deps only -- not `npm run db:migrate`, which
        # needs drizzle-kit and is local-development only.
        self.tenant_migrate_command = self._str(
            "TENANT_MIGRATE_COMMAND", "node scripts/migrate.mjs"
        )
        self.tenant_migrate_probe = self._str(
            "TENANT_MIGRATE_PROBE", "scripts/migrate.mjs"
        )
        self.tenant_migrate_timeout = self._int("TENANT_MIGRATE_TIMEOUT", 600)
        # Run migrations automatically during provisioning, before the app
        # container starts.
        self.tenant_migrate_on_provision = self._bool("TENANT_MIGRATE_ON_PROVISION", True)
        # Storefront admin seeding. Ships in the same `migrate` stage as
        # migrate.mjs; usage is: create-admin.mjs <email> <password> [name]
        self.tenant_create_admin_script = self._str(
            "TENANT_CREATE_ADMIN_SCRIPT", "scripts/create-admin.mjs"
        )
        # Passed to every tenant process (app, migrate, admin seeding) as
        # MEDIA_DRIVER. Storefront-specific, not read by the controller itself.
        self.tenant_media_driver = self._str("TENANT_MEDIA_DRIVER", "local")
        # Resolvers passed to tenant containers via `docker run --dns`. The
        # managed database is reached by hostname over the internet, and
        # relying solely on the node's own resolver chain means a blip there
        # (a VPN reconnect, a flaky upstream) takes every tenant down with it.
        # Public resolvers are a second, independent path.
        raw_dns = self._str("TENANT_DNS_SERVERS", "1.1.1.1,8.8.8.8")
        self.tenant_dns_servers = [s.strip() for s in raw_dns.split(",") if s.strip()]

        # -- Host port allocation for tenant containers --------------------
        # Below Linux's default ephemeral range (32768-60999) so an allocated
        # port can never collide with an outbound socket on the node.
        self.tenant_port_range_start = self._int("TENANT_PORT_RANGE_START", 20000)
        self.tenant_port_range_end = self._int("TENANT_PORT_RANGE_END", 29999)
        # Keep a released port out of the pool briefly so a new tenant cannot
        # inherit keep-alive connections aimed at the old container.
        self.port_reuse_cooldown_seconds = self._int("PORT_REUSE_COOLDOWN_SECONDS", 300)
        # Headroom left for the OS: max_memory_mb comes from `free -m`, i.e.
        # total physical RAM, so placing against it unreserved invites OOM.
        self.node_memory_reserve_mb = self._int("NODE_MEMORY_RESERVE_MB", 1024)
        self.frappe_image = self._str("FRAPPE_IMAGE", "frappe/erpnext:v16.50.0")
        self.frappe_site_domain = self._str("FRAPPE_SITE_DOMAIN", "").strip().lower()
        self.frappe_available_apps = [app.strip() for app in self._str("FRAPPE_AVAILABLE_APPS", "erpnext").split(",") if app.strip()]
        self.frappe_port_start = self._int("FRAPPE_PORT_START", 30000)
        self.frappe_port_end = self._int("FRAPPE_PORT_END", 31999)
        self.frappe_customer_site_limit = self._int("FRAPPE_CUSTOMER_SITE_LIMIT", 3)
        if not (1 <= self.frappe_port_start <= self.frappe_port_end < 32768):
            raise ConfigError('Frappe ports must be below the Linux ephemeral range (32768).')
        if self.frappe_site_domain:
            import re
            if not re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', self.frappe_site_domain) or '..' in self.frappe_site_domain or len(self.frappe_site_domain) > 200:
                raise ConfigError('FRAPPE_SITE_DOMAIN must be a valid base domain without a protocol or path.')
        self.platform_internal_url = self._str("PLATFORM_INTERNAL_URL", "http://127.0.0.1:3000")

        # -- Worker nodes (SSH / Docker) ----------------------------------
        self.ssh_user = self._str("SSH_USER", "root")
        self.ssh_port = self._int("SSH_PORT", 22)
        self.ssh_key_path = self._str("SSH_KEY_PATH", "~/.ssh/id_controller_dev")
        # Fallback password for nodes registered without their own.
        self.ssh_password = self._str("SSH_PASSWORD", "")
        self.ssh_timeout = self._int("SSH_TIMEOUT", 10)
        self.ssh_command_timeout = self._int("SSH_COMMAND_TIMEOUT", 30)
        # 'auto' trusts unknown host keys (local VMs churn); 'reject' does not.
        self.ssh_host_key_policy = self._str("SSH_HOST_KEY_POLICY", "auto")
        self.docker_socket = self._str("DOCKER_SOCKET", "unix://var/run/docker.sock")

        # Docker network tenant containers join on their node. Falls back to
        # the old TRAEFIK_NETWORK name so existing .env files keep working.
        self.tenant_network = self._str(
            "TENANT_NETWORK", os.getenv("TRAEFIK_NETWORK") or "web_network"
        )

        # -- Traefik edge proxy (superseded by the Caddy edge; see docs/) ---
        self.traefik_network = self._str("TRAEFIK_NETWORK", "web_network")
        self.traefik_cert_resolver = self._str("TRAEFIK_CERT_RESOLVER", "myresolver")
        self.traefik_entrypoint = self._str("TRAEFIK_ENTRYPOINT", "websecure")

        # -- Caddy edge proxy ------------------------------------------------
        # Defaults to base_domain so subdomain_for() is unchanged unless this
        # is set explicitly -- kept distinct because the original spec wanted
        # a different suffix (slug.unity-commerce.unityalgo.com) than what's
        # actually live today (slug.unityalgo.com); not resolved, not forced.
        self.platform_domain = self._str("PLATFORM_DOMAIN", self.base_domain)
        # Caddy's own admin API default; ServerNode.proxy_admin_port overrides
        # this per-node when set.
        self.proxy_admin_port_default = self._int("PROXY_ADMIN_PORT_DEFAULT", 2019)
        # Real ACME/wildcard cert issuance needs a public domain + DNS
        # provider access -- stays HTTP-only until that's actually available.
        self.proxy_enable_tls = self._bool("PROXY_ENABLE_TLS", False)
        self.proxy_health_check_timeout_seconds = self._int(
            "PROXY_HEALTH_CHECK_TIMEOUT_SECONDS", 5
        )

        # -- Periodic health-check sweep (Celery Beat) -----------------------
        self.health_check_interval_seconds = self._int(
            "HEALTH_CHECK_INTERVAL_SECONDS", 300
        )
        self.health_check_probe_timeout_seconds = self._int(
            "HEALTH_CHECK_PROBE_TIMEOUT_SECONDS", 5
        )

        # -- Scheduled tenant backups (Celery Beat) -------------------------
        # Off by default: a fleet-wide pg_dump sweep is real load on both the
        # controller host and every database cluster, so it is opted into
        # rather than started by an upgrade.
        self.backup_schedule_enabled = self._bool("BACKUP_SCHEDULE_ENABLED", False)
        self.backup_schedule_interval_seconds = self._int(
            "BACKUP_SCHEDULE_INTERVAL_SECONDS", 86400
        )
        # How many scheduled dumps to keep per tenant. Only ever prunes
        # reason="scheduled" rows -- a backup taken before a migration, a
        # resize or a delete is evidence for that operation and is never
        # deleted by a timer.
        self.backup_retention_count = self._int("BACKUP_RETENTION_COUNT", 7)

        # -- SSH terminal (separate WebSocket service, ws_terminal_main.py) --
        # Loopback-only by default -- only reachable through nginx's
        # /ws/terminal/ location block, never exposed directly.
        self.ws_terminal_host = self._str("WS_TERMINAL_HOST", "127.0.0.1")
        self.ws_terminal_port = self._int("WS_TERMINAL_PORT", 8765)
        self.ws_terminal_idle_timeout_seconds = self._int(
            "WS_TERMINAL_IDLE_TIMEOUT_SECONDS", 900
        )
        # Live log/metric streams share the same process and port. Their
        # timeout is separate and shorter: a terminal is idle while someone
        # reads output, but a stream that has produced nothing for this long
        # is a tab someone left open.
        self.ws_stream_idle_timeout_seconds = self._int(
            "WS_STREAM_IDLE_TIMEOUT_SECONDS", 1800
        )

        # -- Database connection query console ------------------------------
        # Server-side guardrails on the ad-hoc query console (Databases page):
        # a slow/hanging query shouldn't block the request forever, and a
        # `SELECT *` against a huge table shouldn't try to load millions of
        # rows into memory and the browser. Neither restricts *what* SQL can
        # run (that's intentionally unrestricted) -- just how long/how much.
        self.query_console_timeout_seconds = self._int("QUERY_CONSOLE_TIMEOUT_SECONDS", 30)
        self.query_console_max_rows = self._int("QUERY_CONSOLE_MAX_ROWS", 500)

        # -- API behaviour -------------------------------------------------
        self.default_page_size = self._int("DEFAULT_PAGE_SIZE", 50)
        self.max_page_size = self._int("MAX_PAGE_SIZE", 200)

        if self.is_production:
            self._assert_production_safe()

    # ------------------------------------------------------------------
    # env readers
    # ------------------------------------------------------------------
    @staticmethod
    def _str(key, default=None):
        value = os.getenv(key)
        if value is None or value.strip() == "":
            if default is None:
                raise ConfigError(f"Required environment variable '{key}' is not set")
            return default
        return value.strip()

    @classmethod
    def _int(cls, key, default):
        raw = os.getenv(key)
        if raw is None or raw.strip() == "":
            return default
        try:
            return int(raw.strip())
        except ValueError:
            raise ConfigError(f"Environment variable '{key}' must be an integer, got {raw!r}")

    @classmethod
    def _bool(cls, key, default):
        raw = os.getenv(key)
        if raw is None or raw.strip() == "":
            return default
        return raw.strip().lower() in ("1", "true", "yes", "on")

    # ------------------------------------------------------------------
    def _database_url(self):
        """Prefer an explicit DATABASE_URL, else assemble one from the parts."""
        url = os.getenv("DATABASE_URL", "").strip()
        if not url:
            return (
                f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
                f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
            )
        if "+asyncpg" in url or "+aiopg" in url:
            raise ConfigError(
                "DATABASE_URL uses an async driver, but this controller runs on "
                "sync SQLAlchemy + psycopg2. Use 'postgresql+psycopg2://...'."
            )
        return url

    def _assert_production_safe(self):
        weak = [
            name
            for name, value in (
                ("SECRET_KEY", self.secret_key),
                ("WEBHOOK_SECRET", self.webhook_secret),
            )
            if value in ("change-me", "", "secret")
        ]
        if weak:
            raise ConfigError(
                f"Refusing to start in production with default {', '.join(weak)}"
            )

    def assert_api_key_configured(self):
        """The API key gate is the whole of this service's access control.

        Enforced at app assembly rather than in __init__ so that CLI
        subcommands which never serve HTTP (migrate, config, sshcheck) still
        run on an install that has not set it yet.
        """
        if not self.controller_internal_api_key:
            raise ConfigError(
                "CONTROLLER_INTERNAL_API_KEY is not set. Every /api/v1/* endpoint "
                "is protected by it alone, so the API refuses to serve without one. "
                'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )

    @property
    def is_production(self):
        return self.app_env.lower() in ("production", "prod")

    def subdomain_for(self, slug):
        return f"{slug}.{self.platform_domain}"

    def db_name_for(self, slug):
        return f"{self.tenant_db_prefix}{slug}".replace("-", "_")[:63]

    def db_user_for(self, slug):
        return f"{self.tenant_user_prefix}{slug}".replace("-", "_")[:63]

    def migrate_image_for(self, runtime_image):
        """The migrate-stage image paired with a runtime image.

        Explicit TENANT_MIGRATE_IMAGE wins; otherwise the tag gets the
        configured suffix, so `repo:1.0.0` -> `repo:1.0.0-migrate`.
        """
        if self.tenant_migrate_image:
            return self.tenant_migrate_image
        suffix = self.tenant_migrate_image_suffix
        # Split on the tag separator, being careful not to mistake the port in
        # a registry host (e.g. registry:5000/img) for a tag.
        repo, sep, tag = runtime_image.rpartition(":")
        if not sep or "/" in tag:
            # Untagged means :latest -- suffix the implied tag, not the repo
            # name, or we would point at a completely different repository.
            return f"{runtime_image}:latest{suffix}"
        return f"{repo}:{tag}{suffix}"

    def tenant_database_url(self, tenant):
        """DSN handed to a tenant container.

        Uses TENANT_DB_HOST, which is the address of the controller's Postgres
        *as seen from a worker node* -- not `postgres_host`, which is the
        controller's own local view.
        """
        host = self.tenant_db_host
        if not host:
            raise ConfigError(
                "TENANT_DB_HOST is not set. Tenant containers run on remote "
                "nodes and cannot reach the controller's Postgres via "
                f"'{self.postgres_host}'. Set TENANT_DB_HOST to an address the "
                "worker nodes can reach."
            )
        url = (
            f"postgresql://{tenant.db_user}:{tenant.db_password}"
            f"@{host}:{self.tenant_db_port}/{tenant.db_name}"
        )
        if self.tenant_db_sslmode and self.tenant_db_sslmode.lower() != "disable":
            url += f"?sslmode={self.tenant_db_sslmode}"
        return url

    def safe_database_url(self):
        """The DSN with the password masked, for logs and error messages."""
        if "@" not in self.database_url:
            return self.database_url
        scheme, _, rest = self.database_url.partition("://")
        creds, _, host = rest.partition("@")
        user = creds.split(":")[0]
        return f"{scheme}://{user}:***@{host}"

    def __repr__(self):
        return f"<Settings env={self.app_env} db={self.safe_database_url()}>"


settings = Settings()
