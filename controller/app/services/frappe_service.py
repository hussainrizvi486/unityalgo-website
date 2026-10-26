"""Generate an isolated Compose stack following frappe/frappe_docker services."""

import json
import shlex
from app.services.ssh_service import SSHService

INSTALL_SCRIPT = """import json, os, pathlib, subprocess, sys
site = os.environ['SITE_NAME']

def run(label, command):
    # check=True would raise CalledProcessError, whose message is the whole command line: for new-site that
    # carries the database and admin passwords, and this output is stored in the logs. Report only what failed.
    result = subprocess.run(command)
    if result.returncode != 0:
        sys.exit('bench %s failed with exit status %d' % (label, result.returncode))

if not pathlib.Path('sites', site, 'site_config.json').exists():
    run('new-site', ['bench', 'new-site', site, '--mariadb-user-host-login-scope=%', '--db-host=' + os.environ['DB_HOST'], '--db-port=' + os.environ['DB_PORT'], '--db-root-username=' + os.environ['DB_USER'], '--db-root-password=' + os.environ['DB_PASSWORD'], '--admin-password=' + os.environ['ADMIN_PASSWORD'], '--install-app', 'erpnext', '--set-default'])
for app in json.loads(os.environ['SITE_APPS']):
    if app != 'erpnext':
        run('install-app ' + app, ['bench', '--site', site, 'install-app', app])
run('migrate', ['bench', '--site', site, 'migrate'])
if os.environ.get('SETUP_JSON'):
    # The image's bare `python` is the system interpreter; frappe lives in the bench virtualenv.
    run('setup wizard', ['env/bin/python', '-c', os.environ['WIZARD_SCRIPT']])
if os.environ.get('MODULES'):
    run('modules', ['env/bin/python', '-c', os.environ['DOMAIN_SCRIPT']])
if os.environ.get('ROLES'):
    run('roles', ['env/bin/python', '-c', os.environ['ROLES_SCRIPT']])
run('enable-scheduler', ['bench', '--site', site, 'enable-scheduler'])
"""

WIZARD_SCRIPT = """import datetime, json, os, re
import frappe
from frappe.geo.country_info import get_country_info
setup = json.loads(os.environ['SETUP_JSON'])
# Run from sites/ like the bench CLI does: Frappe resolves its log directory as ../logs.
os.chdir('sites')
frappe.init(site=os.environ['SITE_NAME'], sites_path='.')
frappe.connect()
try:
    if not frappe.is_setup_complete():
        from frappe.desk.page.setup_wizard.setup_wizard import setup_complete
        info = get_country_info(setup['country']) or {}
        name = setup['company_name']
        abbr = ''.join(word[0] for word in re.findall(r'[A-Za-z0-9]+', name))[:5].upper() or name[:3].upper()
        year = datetime.date.today().year
        result = setup_complete({
            'language': 'English', 'country': setup['country'],
            'timezone': (info.get('timezones') or ['UTC'])[0], 'currency': setup['currency'],
            'full_name': setup['owner_email'].split('@')[0].replace('.', ' ').replace('_', ' ').title() or 'Owner',
            'email': setup['owner_email'], 'password': setup['owner_password'],
            'company_name': name, 'company_abbr': abbr,
            'chart_of_accounts': 'Standard with Numbers' if setup['coa_type'] == 'numbered' else 'Standard',
            'fy_start_date': '%d-01-01' % year, 'fy_end_date': '%d-12-31' % year,
            'bank_account': 'Bank Account',
        })
        frappe.db.commit()
        # setup_complete reports failure in its return value instead of raising.
        if not isinstance(result, dict) or result.get('status') != 'ok':
            frappe.db.rollback()
            errors = frappe.get_all('Error Log', fields=['method', 'error'], order_by='creation desc', limit=1)
            print('SETUP WIZARD FAILED: %r' % (result,))
            for entry in errors:
                print('Frappe error log (%s):\\n%s' % (entry.method, entry.error))
            raise SystemExit(1)
finally:
    frappe.destroy()
"""

DOMAIN_SCRIPT = """import json, os
import frappe
os.chdir('sites')
frappe.init(site=os.environ['SITE_NAME'], sites_path='.')
frappe.connect()
try:
    modules = json.loads(os.environ.get('MODULES') or '[]')
    frappe.db.set_value('Module Def', {}, 'restrict_to_domain', '')
    DEFAULT_DOMAIN = 'Subscription'
    if not frappe.db.exists('Domain', DEFAULT_DOMAIN):
        frappe.get_doc({'doctype': 'Domain', 'domain': DEFAULT_DOMAIN}).insert(ignore_permissions=True)
    missing = []
    for module in modules:
        # Setting a module that does not exist changes nothing; report it so the operator can fix the name.
        if not frappe.db.exists('Module Def', module):
            missing.append(module)
            continue
        frappe.db.set_value('Module Def', module, 'restrict_to_domain', DEFAULT_DOMAIN)
    settings = frappe.get_doc('Domain Settings')
    settings.set('active_domains', [])
    settings.append('active_domains', {'domain': DEFAULT_DOMAIN})
    settings.save(ignore_permissions=True)
    frappe.db.commit()
    print('MODULES_MISSING=' + json.dumps(missing))
finally:
    frappe.destroy()
"""

ROLES_SCRIPT = """import json, os
import frappe
os.chdir('sites')
frappe.init(site=os.environ['SITE_NAME'], sites_path='.')
frappe.connect()
try:
    roles = json.loads(os.environ.get('ROLES') or '[]')
    owner = json.loads(os.environ['SETUP_JSON'])['owner_email']
    for role in roles:
        if not frappe.db.exists('Role', role):
            frappe.get_doc({'doctype': 'Role', 'role_name': role, 'desk_access': 1}).insert(ignore_permissions=True)
    # The customer's own administrator account gets every role the plan allows; nothing it already has is taken away.
    user = frappe.get_doc('User', owner)
    have = {row.role for row in user.roles}
    for role in roles:
        if role not in have:
            user.append('roles', {'role': role})
    user.save(ignore_permissions=True)
    frappe.db.commit()
    print('ROLES_ASSIGNED=' + json.dumps(roles))
finally:
    frappe.destroy()
"""

LIMITS_SCRIPT = """import os
import frappe
os.chdir('sites')
frappe.init(site=os.environ['SITE_NAME'], sites_path='.')
frappe.connect()
try:
    NAME = 'AlgoSuite plan seat limit'
    limit = int(os.environ.get('USER_LIMIT') or 0)
    if limit:
        code = (
            'if doc.enabled and doc.user_type == "System User" and doc.name not in ("Administrator", "Guest"):\\n'
            '    others = frappe.get_all("User", filters={"enabled": 1, "user_type": "System User", '
            '"name": ["not in", ["Administrator", "Guest", doc.name]]}, pluck="name")\\n'
            '    if len(others) >= %d:\\n'
            '        frappe.throw("Your plan allows up to %d users. Disable a user or change your plan to add more.")\\n'
        ) % (limit, limit)
        doc = frappe.get_doc('Server Script', NAME) if frappe.db.exists('Server Script', NAME) else frappe.new_doc('Server Script')
        doc.update({'name': NAME, 'script_type': 'DocType Event', 'reference_doctype': 'User',
                    'doctype_event': 'Before Validate', 'script': code, 'disabled': 0})
        doc.save(ignore_permissions=True)
    elif frappe.db.exists('Server Script', NAME):
        frappe.delete_doc('Server Script', NAME, ignore_permissions=True)
    frappe.db.commit()
finally:
    frappe.destroy()
"""

# Counts enabled system users, for the periodic limit audit.
COUNT_USERS_SCRIPT = """import os
import frappe
os.chdir('sites')
frappe.init(site=os.environ['SITE_NAME'], sites_path='.')
frappe.connect()
try:
    print('USERS=%d' % len(frappe.get_all('User', filters={'enabled': 1, 'user_type': 'System User', 'name': ['not in', ['Administrator', 'Guest']]})))
finally:
    frappe.destroy()
"""


APPS_SCRIPT = """import importlib, os, subprocess
os.chdir('sites')
import frappe
frappe.init(site=os.environ['SITE_NAME'], sites_path='.')
frappe.connect()
try:
    for app in frappe.get_installed_apps():
        try:
            version = getattr(importlib.import_module(app), '__version__', '') or ''
        except Exception:
            version = ''
        def git(*arguments):
            result = subprocess.run(['git', '-C', os.path.join('..', 'apps', app), *arguments], capture_output=True, text=True)
            return result.stdout.strip() if result.returncode == 0 else ''
        print('APP=%s|%s|%s|%s' % (app, version, git('rev-parse', 'HEAD'), git('rev-parse', '--abbrev-ref', 'HEAD')))
finally:
    frappe.destroy()
"""

APP_DOCKERFILE = """FROM {base}
USER frappe
WORKDIR /home/frappe/frappe-bench
RUN set -eux; \\
    if [ -d apps/{app}/.git ]; then \\
        git -C apps/{app} remote set-url origin {url}; \\
    else \\
        rm -rf apps/{app}; git clone --depth 1 --branch {branch} {url} apps/{app}; \\
    fi; \\
    git -C apps/{app} fetch --depth 1 origin {commit}; \\
    git -C apps/{app} checkout --force {commit}; \\
    if env/bin/python -m pip --version >/dev/null 2>&1; then env/bin/python -m pip install --quiet -e apps/{app}; else uv pip install --quiet --python env/bin/python -e apps/{app}; fi; \\
    (echo frappe; ls -1 apps | grep -vx frappe) > sites/apps.txt; \\
    bench build --app {app}; \\
    rm -rf /home/frappe/built-assets; cp -a sites/assets /home/frappe/built-assets
"""

APP_DOCKERFILE_LOCAL = """FROM {base}
USER frappe
WORKDIR /home/frappe/frappe-bench
RUN rm -rf apps/{app}
COPY --chown=frappe:frappe src apps/{app}
RUN set -eux; \\
    if env/bin/python -m pip --version >/dev/null 2>&1; then env/bin/python -m pip install --quiet -e apps/{app}; else uv pip install --quiet --python env/bin/python -e apps/{app}; fi; \\
    (echo frappe; ls -1 apps | grep -vx frappe) > sites/apps.txt; \\
    bench build --app {app}; \\
    rm -rf /home/frappe/built-assets; cp -a sites/assets /home/frappe/built-assets
"""


class SetupUnavailable(RuntimeError):
    """The wizard answers were never saved on the worker, so a retry cannot continue."""


class FrappeService:
    def __init__(self, site, server, settings, setup=None, external_db=None):
        self.site, self.server, self.settings = site, server, settings
        self.setup = setup
        self.external_db = external_db
        self.ssh = SSHService(server, settings)
        self.path = "/opt/unityalgo/frappe/" + str(site.id)
        self.project = "frappe-" + str(site.id)

    WEIGHTS = {
        "backend": 0.30,
        "queue-long": 0.12,
        "queue-short": 0.08,
        "scheduler": 0.05,
        "websocket": 0.05,
        "frontend": 0.03,
        "redis-cache": 0.05,
        "redis-queue": 0.04,
        "db": 0.28,
    }
    MIN_MB = {
        "backend": 512,
        "queue-long": 256,
        "queue-short": 192,
        "scheduler": 128,
        "websocket": 128,
        "frontend": 64,
        "redis-cache": 96,
        "redis-queue": 96,
        "db": 384,
    }

    def allocation(self):
        """{service: (memory MB, vCPUs)} for the site's plan."""
        total_mb = getattr(self.site, "memory_limit_mb", None) or 4096
        total_cpu = getattr(self.site, "cpu_limit", None) or 2.0
        weights = {
            k: v
            for k, v in self.WEIGHTS.items()
            if not (k == "db" and self.external_db)
        }
        scale = sum(weights.values())
        return {
            name: (
                max(self.MIN_MB[name], int(total_mb * weight / scale)),
                round(max(0.1, total_cpu * weight / scale), 2),
            )
            for name, weight in weights.items()
        }

    SETUP_MIN_MB = 1536
    SETUP_MIN_CPUS = 2.0

    def setup_resources(self, allocation):
        """Memory and CPU for the one-off configurator and create-site containers.

        They run before the application services start, when only the database and Redis are up, so they can use
        the whole plan rather than the backend's few-percent share. Installing ERPNext on a fraction of a core
        takes far longer than the provisioning time budget.
        """
        idle = [value for name, value in allocation.items() if name not in ("db", "redis-cache", "redis-queue")]
        memory = max(self.SETUP_MIN_MB, sum(mb for mb, _ in idle))
        cpus = max(self.SETUP_MIN_CPUS, sum(cpu for _, cpu in idle))
        cores = getattr(self.server, "cpu_cores", None)
        if isinstance(cores, int) and cores > 0:
            cpus = min(cpus, float(cores))
        return int(memory), round(cpus, 2)

    def compose(self):
        volumes = [
            "sites:/home/frappe/frappe-bench/sites",
            "logs:/home/frappe/frappe-bench/logs",
        ]

        def app(command=None, memory="512m"):
            value = {
                "image": self.site.image,
                "restart": "unless-stopped",
                "volumes": volumes,
                "mem_limit": memory,
                "cpus": 0.5,
            }
            if command:
                value["command"] = command
            return value

        services = {
            "db": {
                "image": "mariadb:11.8",
                "restart": "unless-stopped",
                "mem_limit": "1024m",
                "cpus": 0.5,
                "command": [
                    "--character-set-server=utf8mb4",
                    "--collation-server=utf8mb4_unicode_ci",
                    "--skip-character-set-client-handshake",
                ],
                "environment": {
                    "MARIADB_ROOT_PASSWORD": self.site.db_password.replace("$", "$$")
                },
                "volumes": ["db-data:/var/lib/mysql"],
                "healthcheck": {
                    "test": [
                        "CMD",
                        "healthcheck.sh",
                        "--connect",
                        "--innodb_initialized",
                    ],
                    "interval": "5s",
                    "timeout": "5s",
                    "retries": 24,
                },
            },
            "redis-cache": {
                "image": "redis:6.2-alpine",
                "restart": "unless-stopped",
                "mem_limit": "256m",
                "cpus": 0.25,
                "command": [
                    "redis-server",
                    "--maxmemory",
                    "192mb",
                    "--maxmemory-policy",
                    "allkeys-lru",
                ],
                "healthcheck": {
                    "test": ["CMD", "redis-cli", "ping"],
                    "interval": "5s",
                    "timeout": "5s",
                    "retries": 12,
                },
            },
            "redis-queue": {
                "image": "redis:6.2-alpine",
                "restart": "unless-stopped",
                "mem_limit": "256m",
                "cpus": 0.25,
                "volumes": ["redis-data:/data"],
                "healthcheck": {
                    "test": ["CMD", "redis-cli", "ping"],
                    "interval": "5s",
                    "timeout": "5s",
                    "retries": 12,
                },
            },
            "backend": app(memory="1024m"),
            "frontend": app(["nginx-entrypoint.sh"], "128m"),
            "websocket": app(
                ["node", "/home/frappe/frappe-bench/apps/frappe/socketio.js"], "256m"
            ),
            "queue-short": app(["bench", "worker", "--queue", "short,default"]),
            "queue-long": app(["bench", "worker", "--queue", "long,default,short"]),
            "scheduler": app(["bench", "schedule"], "256m"),
            "configurator": app(
                [
                    "ls -1 apps > sites/apps.txt && bench set-config -g db_host db && bench set-config -gp db_port 3306 && bench set-config -g redis_cache redis://redis-cache:6379 && bench set-config -g redis_queue redis://redis-queue:6379 && bench set-config -g redis_socketio redis://redis-queue:6379 && bench set-config -gp socketio_port 9000 && bench set-config -gp server_script_enabled 1"
                ]
            ),
            "create-site": app(["python", "-c", INSTALL_SCRIPT], "1024m"),
        }
        db_host = self.external_db["host"] if self.external_db else "db"
        db_port = int(self.external_db["port"]) if self.external_db else 3306
        services["configurator"]["command"] = [
            services["configurator"]["command"][0]
            .replace(
                "bench set-config -g db_host db",
                "bench set-config -g db_host " + shlex.quote(db_host),
            )
            .replace(
                "bench set-config -gp db_port 3306",
                "bench set-config -gp db_port %d" % db_port,
            )
        ]
        if self.external_db:
            del services["db"]
        allocation = self.allocation()
        for name, (memory_mb, cpus) in allocation.items():
            if name in services:
                services[name]["mem_limit"], services[name]["cpus"] = (
                    f"{memory_mb}m",
                    cpus,
                )
        services["redis-cache"]["command"][2] = (
            f"{int(allocation['redis-cache'][0] * 0.7)}mb"
        )
        setup_mb, setup_cpus = self.setup_resources(allocation)
        for name in ("configurator", "create-site"):
            services[name]["mem_limit"], services[name]["cpus"] = (
                f"{setup_mb}m",
                setup_cpus,
            )
        services["configurator"].update(
            {"entrypoint": ["bash", "-c"], "restart": "no", "profiles": ["setup"]}
        )
        db = self.external_db or {
            "host": "db",
            "port": 3306,
            "user": "root",
            "password": self.site.db_password,
        }
        environment = {
            "SITE_NAME": self.site.domain,
            "SITE_APPS": json.dumps(self.site.app_names),
            "DB_HOST": db["host"],
            "DB_PORT": str(db["port"]),
            "DB_USER": db["user"],
            "DB_PASSWORD": db["password"].replace("$", "$$"),
            "ADMIN_PASSWORD": self.site.admin_password.replace("$", "$$"),
        }
        if self.setup:
            environment.update(
                {
                    "SETUP_JSON": json.dumps(self.setup).replace("$", "$$"),
                    "WIZARD_SCRIPT": WIZARD_SCRIPT.replace("$", "$$"),
                }
            )
            if self.setup.get("modules"):
                environment.update(
                    {
                        "MODULES": json.dumps(self.setup["modules"]).replace("$", "$$"),
                        "DOMAIN_SCRIPT": DOMAIN_SCRIPT.replace("$", "$$"),
                    }
                )
            if self.setup.get("roles"):
                environment.update(
                    {
                        "ROLES": json.dumps(self.setup["roles"]).replace("$", "$$"),
                        "ROLES_SCRIPT": ROLES_SCRIPT.replace("$", "$$"),
                    }
                )
        services["create-site"].update(
            {"restart": "no", "profiles": ["setup"], "environment": environment}
        )
        services["frontend"]["environment"] = {
            "BACKEND": "backend:8000",
            "SOCKETIO": "websocket:9000",
            "FRAPPE_SITE_NAME_HEADER": self.site.domain,
        }
        services["frontend"]["ports"] = [
            f"{self.server.dial_host}:{self.site.port}:8080"
        ]
        return {
            "services": services,
            "volumes": {
                name: {} for name in ["sites", "logs", "db-data", "redis-data"]
            },
        }

    def infrastructure(self):
        """Long-running backing services to start before the one-off setup containers."""
        return (
            ["redis-cache", "redis-queue"]
            if self.external_db
            else ["db", "redis-cache", "redis-queue"]
        )

    def prepare(self):
        result = self.ssh.run(
            "docker compose version --short && docker info --format {{.ServerVersion}}"
        )
        if not result.ok:
            raise RuntimeError(
                "Docker Compose is not available on the assigned worker."
            )
        with self.ssh.connect() as client:
            path, user = shlex.quote(self.path), shlex.quote(self.server.ssh_user)
            result = self.ssh._sudo_exec(
                client,
                f'sh -c "mkdir -p {path} && chown -R {user} {path} && chmod 700 {path}"',
                timeout=30,
            )
            if not result.ok:
                raise RuntimeError("Could not create the site deployment directory.")
            with client.open_sftp() as sftp:
                if self.setup is None:
                    self.setup = self._saved_setup(sftp)
                if self.setup is None:
                    raise SetupUnavailable(
                        "The site setup details are no longer available. Delete this site and create it again."
                    )
                self._write_compose(sftp)

    def _write_compose(self, sftp):
        with sftp.open(self.path + "/compose.json", "w") as file:
            file.write(json.dumps(self.compose()))
        sftp.chmod(self.path + "/compose.json", 0o600)

    def _saved_setup(self, sftp):
        """On retry the wizard answers are only on the worker; read them back."""
        try:
            with sftp.open(self.path + "/compose.json", "r") as file:
                saved = json.loads(file.read())
            raw = saved["services"]["create-site"]["environment"].get("SETUP_JSON")
            return json.loads(raw.replace("$$", "$")) if raw else None
        except (OSError, KeyError, ValueError):
            return None

    def scrub_setup(self):
        """Drop the owner's password from the worker once the wizard has finished."""
        self.setup = None
        with self.ssh.connect() as client:
            with client.open_sftp() as sftp:
                self._write_compose(sftp)

    def run(self, arguments, timeout=1800):
        command = (
            "umask 077; docker compose -p "
            + shlex.quote(self.project)
            + " -f "
            + shlex.quote(self.path + "/compose.json")
            + " "
            + " ".join(shlex.quote(arg) for arg in arguments)
        )
        # Drain output on the worker rather than filling Paramiko's channel buffer.
        result = self.ssh.run(
            command + " >> " + shlex.quote(self.path + "/provision.log") + " 2>&1",
            timeout=timeout,
        )
        if not result.ok:
            tail = self.ssh.run(
                "tr '\\r' '\\n' < "
                + shlex.quote(self.path + "/provision.log")
                + " | grep -v -E '\\[=*[ =>]*\\] *[0-9]+%|^ *$' | tail -c 4000",
                timeout=20,
            )
            raise RuntimeError(
                "The Docker provisioning step failed (exit %s): docker compose %s\n--- provision.log (last 4000 bytes) ---\n%s"
                % (
                    result.exit_code,
                    " ".join(arguments[:4]),
                    (tail.stdout or tail.stderr or "(empty)").strip(),
                )
            )

    APP_SERVICES = [
        "backend",
        "frontend",
        "websocket",
        "queue-short",
        "queue-long",
        "scheduler",
    ]

    def _compose_cmd(self, arguments):
        return (
            "docker compose -p "
            + shlex.quote(self.project)
            + " -f "
            + shlex.quote(self.path + "/compose.json")
            + " "
            + " ".join(shlex.quote(a) for a in arguments)
        )

    def rewrite_compose(self):
        self.setup = None
        with self.ssh.connect() as client, client.open_sftp() as sftp:
            self._write_compose(sftp)

    def set_owner_password(self, email, password):
        """Set a Frappe user's password. It travels over stdin, never as a command-line argument."""
        command = self._compose_cmd(
            [
                "exec",
                "-T",
                "-e",
                "SITE_NAME=" + self.site.domain,
                "-e",
                "OWNER=" + email,
                "backend",
                "bash",
                "-c",
                'read -r PW && bench --site "$SITE_NAME" set-password "$OWNER" "$PW" --logout-all-sessions',
            ]
        )
        result = self.ssh.run(command, timeout=120, stdin_data=password + "\n")
        if not result.ok:
            raise RuntimeError(
                "Could not set the password (exit %s): %s"
                % (result.exit_code, (result.stderr or result.stdout).strip()[-400:])
            )

    def stop(self):
        self.run(["stop"], timeout=300)

    def start(self):
        self.run(
            ["up", "-d", "--wait", "--wait-timeout", "180", *self.infrastructure()],
            timeout=400,
        )
        self.run(["up", "-d", *self.APP_SERVICES], timeout=400)

    def restart(self):
        self.run(["restart", *self.APP_SERVICES], timeout=400)

    def destroy(self, drop_database, force=False):
        problems = []

        def attempt(label, action):
            try:
                action()
            except Exception as exc:
                if not force:
                    raise
                problems.append(f"{label}: {exc}")

        if drop_database:
            attempt("read database name", self._remember_database_name)
            attempt(
                "drop database",
                lambda: self.run(
                    [
                        "run",
                        "--rm",
                        "--entrypoint",
                        "bash",
                        "create-site",
                        "-c",
                        'if [ -f "sites/$SITE_NAME/site_config.json" ]; then '
                        'bench drop-site "$SITE_NAME" --force --no-backup --db-root-username "$DB_USER" --db-root-password "$DB_PASSWORD"; fi',
                    ],
                    timeout=600,
                ),
            )
        attempt(
            "remove containers and volumes",
            lambda: self.run(["down", "-v", "--remove-orphans"], timeout=300),
        )
        try:
            self.discard_images()
        except Exception:
            pass
        attempt("remove deploy folder", lambda: self._remove_folder())
        return problems

    database_name = None

    def _remember_database_name(self):
        command = self._compose_cmd(
            [
                "run",
                "--rm",
                "-T",
                "--entrypoint",
                "bash",
                "create-site",
                "-c",
                'cat "sites/$SITE_NAME/site_config.json" 2>/dev/null || true',
            ]
        )
        result = self.ssh.run(command, timeout=120)
        try:
            self.database_name = json.loads(
                result.stdout[result.stdout.index("{") : result.stdout.rindex("}") + 1]
            ).get("db_name")
        except ValueError:
            self.database_name = None

    def _remove_folder(self):
        result = self.ssh.run_sudo("rm -rf " + shlex.quote(self.path), timeout=60)
        if not result.ok:
            raise RuntimeError("Could not remove the deploy folder.")

    def exec_output(self, arguments, timeout=120):
        """Run a command in the backend container and return its output (not the provision log)."""
        result = self.ssh.run(
            self._compose_cmd(["exec", "-T", "backend", *arguments]), timeout=timeout
        )
        if not result.ok:
            raise RuntimeError(
                "Command failed (exit %s): %s"
                % (result.exit_code, (result.stderr or result.stdout).strip()[-1500:])
            )
        return result.stdout

    def _in_site(self, script, **env):
        """Run a Python script in the backend container, inside the site's bench environment."""
        variables = [
            f"{key}={value}"
            for key, value in {"SITE_NAME": self.site.domain, **env}.items()
        ]
        return self.exec_output(
            ["env", *variables, "env/bin/python", "-c", script], timeout=300
        )

    def apply_modules(self, modules):
        """Make exactly these modules visible through the site's domain settings. Installs nothing. Returns the unknown names."""
        output = self._in_site(DOMAIN_SCRIPT, MODULES=json.dumps(list(modules)))
        line = next((row for row in (output or "").splitlines() if row.startswith("MODULES_MISSING=")), None)
        if line is None:
            raise RuntimeError("The modules could not be applied on the site.")
        return json.loads(line.split("=", 1)[1])

    def apply_limits(self, user_limit):
        self.exec_output(["bench", "set-config", "-gp", "server_script_enabled", "1"])
        self._in_site(LIMITS_SCRIPT, USER_LIMIT=user_limit or "")

    def count_users(self):
        out = self._in_site(COUNT_USERS_SCRIPT)
        for line in out.splitlines():
            if line.startswith("USERS="):
                return int(line[6:])
        raise RuntimeError("Could not read the user count.")

    def backup(self):
        """Database dump plus public and private files, kept on the site's volume."""
        return self.exec_output(
            ["bench", "--site", self.site.domain, "backup", "--with-files"],
            timeout=1500,
        )

    def list_backups(self):
        folder = "sites/%s/private/backups" % self.site.domain
        out = self.exec_output(
            [
                "find",
                folder,
                "-maxdepth",
                "1",
                "-type",
                "f",
                "-printf",
                "%f\\t%s\\t%T@\\n",
            ]
        )
        items = []
        for line in out.splitlines():
            name, _, rest = line.partition("\t")
            size, _, stamp = rest.partition("\t")
            if name and size.isdigit():
                items.append(
                    {
                        "name": name,
                        "size_bytes": int(size),
                        "created_at": float(stamp or 0),
                    }
                )
        return sorted(items, key=lambda item: item["created_at"], reverse=True)

    STAMP = __import__("re").compile(r"^(\d{8}_\d{6})-")

    def backup_sets(self):
        sets = {}
        for item in self.list_backups():
            match = self.STAMP.match(item["name"])
            if not match:
                continue
            kind = (
                "database"
                if item["name"].endswith("database.sql.gz")
                else "private-files"
                if item["name"].endswith("private-files.tar")
                else "files"
                if item["name"].endswith("files.tar")
                else "config"
                if item["name"].endswith("site_config_backup.json")
                else "other"
            )
            group = sets.setdefault(
                match.group(1),
                {
                    "stamp": match.group(1),
                    "files": [],
                    "size_bytes": 0,
                    "created_at": 0,
                },
            )
            group["files"].append(
                {"name": item["name"], "type": kind, "size_bytes": item["size_bytes"]}
            )
            group["size_bytes"] += item["size_bytes"]
            group["created_at"] = max(group["created_at"], item["created_at"])
        return sorted(sets.values(), key=lambda group: group["stamp"], reverse=True)

    def restore(self, stamp):
        group = next((g for g in self.backup_sets() if g["stamp"] == stamp), None)
        if not group:
            raise RuntimeError("That backup no longer exists.")
        by_type = {f["type"]: f["name"] for f in group["files"]}
        if "database" not in by_type:
            raise RuntimeError(
                "That backup has no database dump, so it cannot be restored."
            )
        folder = "sites/%s/private/backups/" % self.site.domain
        flags = ""
        for kind, flag in (
            ("files", "--with-public-files"),
            ("private-files", "--with-private-files"),
        ):
            if kind in by_type:
                flags += " %s %s" % (flag, shlex.quote(folder + by_type[kind]))
        self.run(["stop", *self.APP_SERVICES], timeout=300)
        self.run(
            ["up", "-d", "--wait", "--wait-timeout", "180", *self.infrastructure()],
            timeout=400,
        )
        self.run(
            [
                "run",
                "--rm",
                "--entrypoint",
                "bash",
                "create-site",
                "-c",
                'set -e; bench --site "$SITE_NAME" restore %s%s --db-root-username "$DB_USER" --db-root-password "$DB_PASSWORD" --force; '
                'bench --site "$SITE_NAME" migrate'
                % (shlex.quote(folder + by_type["database"]), flags),
            ],
            timeout=1700,
        )

    def delete_backup_sets(self, stamps):
        """Remove whole backup sets from the site's volume."""
        for stamp in stamps:
            if not __import__("re").fullmatch(r"\d{8}_\d{6}", stamp):
                raise ValueError("Invalid backup stamp.")
            self.exec_output(
                [
                    "bash",
                    "-c",
                    "rm -f sites/%s/private/backups/%s-*"
                    % (shlex.quote(self.site.domain), stamp),
                ]
            )

    def stream_backup(self, name):
        """Yield a backup file's bytes. `name` must be a bare file name."""
        import re

        if not re.fullmatch(r"[A-Za-z0-9._-]+", name) or name.startswith("."):
            raise ValueError("Invalid backup name.")
        command = self._compose_cmd(
            [
                "exec",
                "-T",
                "backend",
                "cat",
                "sites/%s/private/backups/%s" % (self.site.domain, name),
            ]
        )
        with self.ssh.connect() as client:
            _, stdout, _ = client.exec_command(command, timeout=3600)
            while True:
                chunk = stdout.read(65536)
                if not chunk:
                    break
                yield chunk
            if stdout.channel.recv_exit_status() != 0:
                raise RuntimeError("The backup file could not be read completely.")

    def usage(self):
        """Live CPU, memory and disk figures for the site's containers."""
        prefix = self.project + "-"
        stats = self.ssh.run(
            "docker stats --no-stream --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'",
            timeout=60,
        )
        cpu = memory = limit = 0.0
        for line in stats.stdout.splitlines():
            name, _, rest = line.partition("\t")
            if not name.startswith(prefix):
                continue
            cpu_text, _, mem_text = rest.partition("\t")
            cpu += float(cpu_text.strip("%") or 0)
            used, _, cap = mem_text.partition(" / ")
            memory += _to_mb(used)
            limit += _to_mb(cap)
        volumes = " ".join(
            "/var/lib/docker/volumes/%s_%s/_data" % (self.project, name)
            for name in ("sites", "db-data")
            if name != "db-data" or not self.external_db
        )
        storage = 0
        sized = self.ssh.run_sudo("du -sm " + volumes, timeout=60)
        for line in sized.stdout.splitlines():
            head = line.split("\t")[0]
            storage += int(head) if head.isdigit() else 0
        return {
            "cpu_percent": round(cpu, 2),
            "memory_mb": round(memory),
            "memory_limit_mb": round(limit),
            "storage_mb": storage,
        }

    # -- app management (App Store) ---------------------------------------------
    def installed_apps(self):
        found = {}
        for line in self._in_site(APPS_SCRIPT).splitlines():
            if line.startswith("APP="):
                name, version, commit, branch = (
                    line[4:].split("|") + ["", "", "", ""]
                )[:4]
                found[name] = {
                    "version": version or None,
                    "commit": commit or None,
                    "branch": branch if branch and branch != "HEAD" else None,
                }
        return found

    def image_tag(self, stamp):
        return "unityalgo-site-%s:%s" % (self.site.id, stamp)

    def build_app_image(self, app, repo_url, branch, commit, tag, token=None):
        import re

        if not (
            re.fullmatch(r"[a-z][a-z0-9_]*", app)
            and re.fullmatch(
                r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo_url
            )
            and re.fullmatch(r"[A-Za-z0-9._/-]+", branch)
            and re.fullmatch(r"[0-9a-f]{40}", commit)
        ):
            raise RuntimeError("Refusing to build from unvalidated repository details.")
        context = self.path + "/build"
        if token:
            self._clone_private(repo_url, branch, commit, context, token)
            template = APP_DOCKERFILE_LOCAL
        else:
            template = APP_DOCKERFILE
        dockerfile = template.format(
            base=shlex.quote(self.site.image),
            app=shlex.quote(app),
            url=shlex.quote(repo_url),
            branch=shlex.quote(branch),
            commit=commit,
        )
        with self.ssh.connect() as client, client.open_sftp() as sftp:
            try:
                sftp.mkdir(context)
            except OSError:
                pass
            with sftp.open(self.path + "/Dockerfile.app", "w") as file:
                file.write(dockerfile)
        log = shlex.quote(self.path + "/build.log")
        command = "docker build -f %s -t %s %s > %s 2>&1" % (
            shlex.quote(self.path + "/Dockerfile.app"),
            shlex.quote(tag),
            shlex.quote(context),
            log,
        )
        try:
            result = self.ssh.run(command, timeout=1700)
        finally:
            if token:
                self.ssh.run("rm -rf %s" % shlex.quote(context + "/src"), timeout=60)
        if not result.ok:
            tail = self.ssh.run(
                "tr '\\r' '\\n' < %s | grep -v -E '^ *$' | tail -c 4000" % log,
                timeout=20,
            )
            raise RuntimeError(
                "Could not build the app image (exit %s):\n--- build.log (last 4000 bytes) ---\n%s"
                % (result.exit_code, (tail.stdout or tail.stderr or "(empty)").strip())
            )

    def _clone_private(self, repo_url, branch, commit, context, token):
        secret, askpass = self.path + "/.gh-token", self.path + "/.gh-askpass"
        with self.ssh.connect() as client, client.open_sftp() as sftp:
            try:
                sftp.mkdir(context)
            except OSError:
                pass
            for name, content, mode in (
                (secret, token, 0o600),
                (
                    askpass,
                    '#!/bin/sh\ncase "$1" in Username*) echo x-access-token;; *) cat %s;; esac\n'
                    % shlex.quote(secret),
                    0o700,
                ),
            ):
                with sftp.open(name, "w") as file:
                    file.write(content)
                sftp.chmod(name, mode)
        src = shlex.quote(context + "/src")
        env = "GIT_ASKPASS=%s GIT_TERMINAL_PROMPT=0" % shlex.quote(askpass)
        script = (
            "set -e; rm -rf %(src)s; %(env)s git clone --depth 1 --branch %(branch)s %(url)s %(src)s; "
            "cd %(src)s; %(env)s git fetch --depth 1 origin %(commit)s; git checkout --force %(commit)s; git remote set-url origin %(url)s"
        )
        try:
            result = self.ssh.run(
                script
                % {
                    "src": src,
                    "env": env,
                    "branch": shlex.quote(branch),
                    "url": shlex.quote(repo_url),
                    "commit": commit,
                },
                timeout=900,
            )
        finally:
            self.ssh.run(
                "rm -f %s %s" % (shlex.quote(secret), shlex.quote(askpass)), timeout=30
            )
        if not result.ok:
            raise RuntimeError(
                "Could not fetch the private repository (exit %s): %s"
                % (result.exit_code, (result.stderr or result.stdout).strip()[-1500:])
            )

    def use_image(self, image):
        """Point the site's containers at `image`; they pick it up when next (re)created."""
        self.site.image = image
        self.rewrite_compose()

    def apply_app_change(self, app, action):
        change = (
            'bench --site "$SITE_NAME" install-app %s' % shlex.quote(app)
            if action == "install"
            else 'bench --site "$SITE_NAME" migrate'
        )
        self.run(
            [
                "run",
                "--rm",
                "--no-deps",
                "--entrypoint",
                "bash",
                "create-site",
                "-c",
                'set -e; cp -a /home/frappe/built-assets/. sites/assets/; (echo frappe; ls -1 apps | grep -vx frappe) > sites/apps.txt; %s; bench --site "$SITE_NAME" clear-cache'
                % change,
            ],
            timeout=1700,
        )

    def install_bundled_app(self, app):
        self.run(
            [
                "run",
                "--rm",
                "--no-deps",
                "--entrypoint",
                "bash",
                "create-site",
                "-c",
                'set -e; bench --site "$SITE_NAME" install-app %s; bench --site "$SITE_NAME" clear-cache'
                % shlex.quote(app),
            ],
            timeout=1700,
        )

    def uninstall_app(self, app):
        self.run(
            [
                "run",
                "--rm",
                "--no-deps",
                "--entrypoint",
                "bash",
                "create-site",
                "-c",
                'set -e; bench --site "$SITE_NAME" uninstall-app %s --yes --no-backup; bench --site "$SITE_NAME" clear-cache'
                % shlex.quote(app),
            ],
            timeout=1700,
        )

    def discard_images(self, keep=None):
        """Remove this site's app images except `keep`. Never touches the shared base image."""
        repository = shlex.quote("unityalgo-site-%s" % self.site.id)
        keep_filter = (" | grep -v -x %s" % shlex.quote(keep)) if keep else ""
        self.ssh.run(
            'docker images --format "{{.Repository}}:{{.Tag}}" %s%s | xargs -r docker image rm'
            % (repository, keep_filter),
            timeout=120,
        )

    def probe(self):
        url = "http://%s:%d/api/method/ping" % (self.server.dial_host, int(self.site.port))
        try:
            result = self.ssh.run(
                "curl -s -o /dev/null -m 10 -w '%%{http_code} %%{time_total}' %s" % shlex.quote(url),
                timeout=20,
            )
        except Exception:
            return False, None
        code, _, seconds = (result.stdout or "").strip().partition(" ")
        if code != "200":
            return False, None
        try:
            return True, round(float(seconds) * 1000)
        except ValueError:
            return True, None

    def healthy(self):
        """Quiet probe: no provision.log writes and no log tailing on a failed poll."""
        script = "import urllib.request; r=urllib.request.urlopen('http://frontend:8080/api/method/ping',timeout=10); assert r.status==200"
        try:
            return self.ssh.run(
                self._compose_cmd(["exec", "-T", "backend", "python", "-c", script]),
                timeout=30,
            ).ok
        except Exception:
            return False


def _to_mb(text):
    """'151.2MiB' / '1GiB' / '512kB' -> megabytes."""
    text = text.strip()
    units = {
        "kib": 1 / 1024,
        "kb": 1 / 1000,
        "mib": 1,
        "mb": 1,
        "gib": 1024,
        "gb": 1000,
        "b": 1 / 1048576,
    }
    for unit in sorted(units, key=len, reverse=True):
        if text.lower().endswith(unit):
            try:
                return float(text[: -len(unit)]) * units[unit]
            except ValueError:
                return 0.0
    return 0.0
