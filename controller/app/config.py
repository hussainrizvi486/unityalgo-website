
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
        self.postgres_sslmode = self._str("POSTGRES_SSLMODE", "prefer")
        self.postgres_connect_timeout = self._int("POSTGRES_CONNECT_TIMEOUT", 10)
        self.db_echo = self._bool("DB_ECHO", False)
        self.db_pool_size = self._int("DB_POOL_SIZE", 5)
        self.db_max_overflow = self._int("DB_MAX_OVERFLOW", 10)
        self.db_pool_recycle = self._int("DB_POOL_RECYCLE", 1800)
        self.database_url = self._database_url()
        self.backup_dir = self._str(
            "BACKUP_DIR", str(BASE_DIR / "backups")
        )
        self.pg_bin_dir = self._str("PG_BIN_DIR", "")

        # -- Redis / Celery ----------------------------------------------
        self.redis_url = self._str("REDIS_URL", "redis://localhost:6379/0")
        self.celery_broker_url = self._str("CELERY_BROKER_URL", self.redis_url)
        self.celery_result_backend = self._str("CELERY_RESULT_BACKEND", self.redis_url)

        self.celery_task_time_limit = self._int("CELERY_TASK_TIME_LIMIT", 900)
        self.celery_task_soft_time_limit = self._int("CELERY_TASK_SOFT_TIME_LIMIT", 840)
        # SSH/IO-bound, not CPU-bound -- a low concurrency is plenty.
        self.celery_worker_concurrency = self._int("CELERY_WORKER_CONCURRENCY", 2)
        # Dev/test convenience: runs tasks inline with no broker at all.
        self.celery_task_always_eager = self._bool("CELERY_TASK_ALWAYS_EAGER", False)

        self.encryption_key = self._str("ENCRYPTION_KEY", "")

        # -- Webhooks from the main platform ------------------------------
        self.webhook_secret = self._str("WEBHOOK_SECRET", "change-me")
        self.webhook_signature_header = self._str("WEBHOOK_SIGNATURE_HEADER", "X-Signature")

        self.controller_internal_api_key = self._str("CONTROLLER_INTERNAL_API_KEY", "")

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
        self.default_plan_tier = self._str("DEFAULT_PLAN_TIER", "launch")

        self.tenant_db_host = self._str("TENANT_DB_HOST", "") or None
        self.tenant_db_port = self._int("TENANT_DB_PORT", self.postgres_port)
        self.tenant_db_sslmode = self._str("TENANT_DB_SSLMODE", "require")
        self.tenant_migrate_image = self._str("TENANT_MIGRATE_IMAGE", "") or None
        self.tenant_migrate_image_suffix = self._str(
            "TENANT_MIGRATE_IMAGE_SUFFIX", "-migrate"
        )
        self.tenant_migrate_command = self._str(
            "TENANT_MIGRATE_COMMAND", "node scripts/migrate.mjs"
        )
        self.tenant_migrate_probe = self._str(
            "TENANT_MIGRATE_PROBE", "scripts/migrate.mjs"
        )
        self.tenant_migrate_timeout = self._int("TENANT_MIGRATE_TIMEOUT", 600)
        self.tenant_migrate_on_provision = self._bool("TENANT_MIGRATE_ON_PROVISION", True)
        self.tenant_create_admin_script = self._str(
            "TENANT_CREATE_ADMIN_SCRIPT", "scripts/create-admin.mjs"
        )
        self.tenant_media_driver = self._str("TENANT_MEDIA_DRIVER", "local")
        raw_dns = self._str("TENANT_DNS_SERVERS", "1.1.1.1,8.8.8.8")
        self.tenant_dns_servers = [s.strip() for s in raw_dns.split(",") if s.strip()]

        self.tenant_port_range_start = self._int("TENANT_PORT_RANGE_START", 20000)
        self.tenant_port_range_end = self._int("TENANT_PORT_RANGE_END", 29999)
        self.port_reuse_cooldown_seconds = self._int("PORT_REUSE_COOLDOWN_SECONDS", 300)
        self.node_memory_reserve_mb = self._int("NODE_MEMORY_RESERVE_MB", 1024)
        self.frappe_image = self._str("FRAPPE_IMAGE", "frappe/erpnext:v15.123.0")
        self.frappe_site_domain = self._str("FRAPPE_SITE_DOMAIN", "").strip().lower()
        self.frappe_site_links = self._str("FRAPPE_SITE_LINKS", "auto").strip().lower()
        self.frappe_available_apps = [app.strip() for app in self._str("FRAPPE_AVAILABLE_APPS", "erpnext").split(",") if app.strip()]
        self.frappe_port_start = self._int("FRAPPE_PORT_START", 30000)
        self.frappe_port_end = self._int("FRAPPE_PORT_END", 31999)
        self.frappe_default_vcpu = float(self._str("FRAPPE_DEFAULT_VCPU", "2"))
        self.frappe_default_ram_mb = self._int("FRAPPE_DEFAULT_RAM_MB", 4096)
        self.frappe_default_storage_gb = self._int("FRAPPE_DEFAULT_STORAGE_GB", 10)
        self.frappe_enforce_capacity = self._bool("FRAPPE_ENFORCE_CAPACITY", True)
        # CPU is shared: reserved vCPUs may exceed physical cores by this factor.
        self.frappe_cpu_overcommit = float(self._str("FRAPPE_CPU_OVERCOMMIT", "2"))
        # How often seats and storage are measured against each site's plan.
        self.site_audit_interval_seconds = self._int("SITE_AUDIT_INTERVAL_SECONDS", 900)
        # How often the scheduler looks for sites whose backup is due.
        self.site_backup_sweep_seconds = self._int("SITE_BACKUP_SWEEP_SECONDS", 1800)
        self.site_trial_sweep_seconds = self._int("SITE_TRIAL_SWEEP_SECONDS", 600)
        self.site_trial_warning_days = self._int("SITE_TRIAL_WARNING_DAYS", 3)
        self.site_metrics_interval_seconds = self._int("SITE_METRICS_INTERVAL_SECONDS", 300)
        self.site_metrics_retention_days = self._int("SITE_METRICS_RETENTION_DAYS", 30)
        self.frappe_domains_per_site = self._int("FRAPPE_DOMAINS_PER_SITE", 5)
        self.app_scan_interval_seconds = self._int("APP_SCAN_INTERVAL_SECONDS", 21600)
        self.github_token = self._str("GITHUB_TOKEN", "") or None
        import re as _re
        tag = _re.search(r':v?(\d+)\.', self.frappe_image)
        configured = [int(part) for part in self._str("FRAPPE_COMPATIBLE_MAJORS", "").replace(" ", "").split(",") if part.isdigit()]
        self.frappe_compatible_majors = configured or ([int(tag.group(1))] if tag else [])
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

        self.tenant_network = self._str(
            "TENANT_NETWORK", os.getenv("TRAEFIK_NETWORK") or "web_network"
        )

        # -- Traefik edge proxy (superseded by the Caddy edge; see docs/) ---
        self.traefik_network = self._str("TRAEFIK_NETWORK", "web_network")
        self.traefik_cert_resolver = self._str("TRAEFIK_CERT_RESOLVER", "myresolver")
        self.traefik_entrypoint = self._str("TRAEFIK_ENTRYPOINT", "websecure")

        self.platform_domain = self._str("PLATFORM_DOMAIN", self.base_domain)
        self.proxy_admin_port_default = self._int("PROXY_ADMIN_PORT_DEFAULT", 2019)
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

        self.backup_schedule_enabled = self._bool("BACKUP_SCHEDULE_ENABLED", False)
        self.backup_schedule_interval_seconds = self._int(
            "BACKUP_SCHEDULE_INTERVAL_SECONDS", 86400
        )
        self.backup_retention_count = self._int("BACKUP_RETENTION_COUNT", 7)

        self.ws_terminal_host = self._str("WS_TERMINAL_HOST", "127.0.0.1")
        self.ws_terminal_port = self._int("WS_TERMINAL_PORT", 8765)
        self.ws_terminal_idle_timeout_seconds = self._int(
            "WS_TERMINAL_IDLE_TIMEOUT_SECONDS", 900
        )
        self.ws_stream_idle_timeout_seconds = self._int(
            "WS_STREAM_IDLE_TIMEOUT_SECONDS", 1800
        )

        self.query_console_timeout_seconds = self._int("QUERY_CONSOLE_TIMEOUT_SECONDS", 30)
        self.query_console_max_rows = self._int("QUERY_CONSOLE_MAX_ROWS", 500)

        # -- API behaviour -------------------------------------------------
        self.default_page_size = self._int("DEFAULT_PAGE_SIZE", 50)
        self.max_page_size = self._int("MAX_PAGE_SIZE", 200)

        if self.is_production:
            self._assert_production_safe()

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
        if not self.controller_internal_api_key:
            raise ConfigError(
                "CONTROLLER_INTERNAL_API_KEY is not set. Every /api/v1/* endpoint "
                "is protected by it alone, so the API refuses to serve without one. "
                'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )

    @property
    def site_links_direct(self):
        if self.frappe_site_links in ("direct", "domain"):
            return self.frappe_site_links == "direct"
        return not self.is_production

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
        if self.tenant_migrate_image:
            return self.tenant_migrate_image
        suffix = self.tenant_migrate_image_suffix
        repo, sep, tag = runtime_image.rpartition(":")
        if not sep or "/" in tag:
            return f"{runtime_image}:latest{suffix}"
        return f"{repo}:{tag}{suffix}"

    def tenant_database_url(self, tenant):
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
