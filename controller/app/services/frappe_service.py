"""Generate an isolated Compose stack following frappe/frappe_docker services."""
import json
import shlex
from app.services.ssh_service import SSHService

INSTALL_SCRIPT = '''import os, pathlib, subprocess
site = os.environ['SITE_NAME']
if not pathlib.Path('sites', site, 'site_config.json').exists():
    subprocess.run(['bench', 'new-site', site, '--mariadb-user-host-login-scope=%', '--db-root-username=root', '--db-root-password=' + os.environ['DB_PASSWORD'], '--admin-password=' + os.environ['ADMIN_PASSWORD'], '--install-app', 'erpnext', '--set-default'], check=True)
for app in json.loads(os.environ['SITE_APPS']):
    if app != 'erpnext':
        subprocess.run(['bench', '--site', site, 'install-app', app], check=True)
subprocess.run(['bench', '--site', site, 'migrate'], check=True)
subprocess.run(['bench', '--site', site, 'enable-scheduler'], check=True)
'''.replace('import os,', 'import json, os,')

class FrappeService:
    def __init__(self, site, server, settings):
        self.site, self.server, self.settings = site, server, settings
        self.ssh = SSHService(server, settings)
        self.path = '/opt/unityalgo/frappe/' + str(site.id)
        self.project = 'frappe-' + str(site.id)

    def compose(self):
        volumes = ['sites:/home/frappe/frappe-bench/sites', 'logs:/home/frappe/frappe-bench/logs']
        def app(command=None, memory='512m'):
            value = {'image': self.site.image, 'restart': 'unless-stopped', 'volumes': volumes, 'mem_limit': memory, 'cpus': 0.5}
            if command:
                value['command'] = command
            return value
        services = {
            'db': {'image': 'mariadb:11.8', 'restart': 'unless-stopped', 'mem_limit': '1024m', 'cpus': 0.5,
                   'command': ['--character-set-server=utf8mb4', '--collation-server=utf8mb4_unicode_ci', '--skip-character-set-client-handshake'],
                   'environment': {'MARIADB_ROOT_PASSWORD': self.site.db_password.replace('$', '$$')}, 'volumes': ['db-data:/var/lib/mysql'],
                   'healthcheck': {'test': ['CMD', 'healthcheck.sh', '--connect', '--innodb_initialized'], 'interval': '5s', 'timeout': '5s', 'retries': 24}},
            'redis-cache': {'image': 'redis:6.2-alpine', 'restart': 'unless-stopped', 'mem_limit': '256m', 'cpus': 0.25, 'command': ['redis-server','--maxmemory','192mb','--maxmemory-policy','allkeys-lru'], 'healthcheck': {'test': ['CMD','redis-cli','ping'], 'interval': '5s', 'timeout': '5s', 'retries': 12}},
            'redis-queue': {'image': 'redis:6.2-alpine', 'restart': 'unless-stopped', 'mem_limit': '256m', 'cpus': 0.25, 'volumes': ['redis-data:/data'], 'healthcheck': {'test': ['CMD','redis-cli','ping'], 'interval': '5s', 'timeout': '5s', 'retries': 12}},
            'backend': app(memory='1024m'), 'frontend': app(['nginx-entrypoint.sh'], '128m'),
            'websocket': app(['node', '/home/frappe/frappe-bench/apps/frappe/socketio.js'], '256m'),
            'queue-short': app(['bench','worker','--queue','short,default']),
            'queue-long': app(['bench','worker','--queue','long,default,short']),
            'scheduler': app(['bench','schedule'], '256m'),
            'configurator': app(['ls -1 apps > sites/apps.txt && bench set-config -g db_host db && bench set-config -gp db_port 3306 && bench set-config -g redis_cache redis://redis-cache:6379 && bench set-config -g redis_queue redis://redis-queue:6379 && bench set-config -g redis_socketio redis://redis-queue:6379 && bench set-config -gp socketio_port 9000']),
            'create-site': app(['python','-c',INSTALL_SCRIPT], '1024m'),
        }
        services['configurator'].update({'entrypoint': ['bash','-c'], 'restart': 'no', 'profiles': ['setup']})
        # Compose interpolates dollar signs even in JSON. Preserve literal
        # password characters instead of expanding the worker's environment.
        services['create-site'].update({'restart': 'no', 'profiles': ['setup'], 'environment': {'SITE_NAME': self.site.domain, 'SITE_APPS': json.dumps(self.site.app_names), 'DB_PASSWORD': self.site.db_password.replace('$', '$$'), 'ADMIN_PASSWORD': self.site.admin_password.replace('$', '$$')}})
        services['frontend']['environment'] = {'BACKEND':'backend:8000', 'SOCKETIO':'websocket:9000', 'FRAPPE_SITE_NAME_HEADER': self.site.domain}
        services['frontend']['ports'] = [f'{self.server.dial_host}:{self.site.port}:8080']
        return {'services': services, 'volumes': {name:{} for name in ['sites','logs','db-data','redis-data']}}

    def prepare(self):
        result = self.ssh.run('docker compose version --short && docker info --format {{.ServerVersion}}')
        if not result.ok:
            raise RuntimeError('Docker Compose is not available on the assigned worker.')
        with self.ssh.connect() as client:
            # No secrets are shell arguments or customer-visible log output.
            result = self.ssh._exec(client, 'install -d -m 700 ' + shlex.quote(self.path), timeout=30)
            if not result.ok:
                raise RuntimeError('Could not create the site deployment directory.')
            with client.open_sftp() as sftp:
                with sftp.open(self.path + '/compose.json', 'w') as file:
                    file.write(json.dumps(self.compose()))
                sftp.chmod(self.path + '/compose.json', 0o600)

    def run(self, arguments, timeout=1800):
        command = 'umask 077; docker compose -p ' + shlex.quote(self.project) + ' -f ' + shlex.quote(self.path + '/compose.json') + ' ' + ' '.join(shlex.quote(arg) for arg in arguments)
        # Drain output on the worker rather than filling Paramiko's channel buffer.
        result = self.ssh.run(command + ' >> ' + shlex.quote(self.path + '/provision.log') + ' 2>&1', timeout=timeout)
        if not result.ok:
            raise RuntimeError('The Docker provisioning step failed. The server administrator can inspect the protected provision.log.')

    def healthy(self):
        script = "import urllib.request; r=urllib.request.urlopen('http://frontend:8080/api/method/ping',timeout=10); assert r.status==200"
        try:
            self.run(['exec','-T','backend','python','-c',script], timeout=20)
            return True
        except RuntimeError:
            return False
