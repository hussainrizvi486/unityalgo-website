import unittest
from types import SimpleNamespace
from unittest.mock import patch, MagicMock
from sqlalchemy.dialects import postgresql
from app.routes.site import fits_site, owned_site
from app.errors import NotFoundError
from app.services.frappe_service import FrappeService
from app.controller.server import ServerController
from app.models.site import Site
from app.models.platform import PRISMA_OWNED_TABLES

class SiteProvisioningTests(unittest.TestCase):
    def setUp(self):
        self.node = SimpleNamespace(is_active=True, role='worker', frappe_enabled=True, last_check_status='ok', max_containers=30, max_memory_mb=16384, disk_total_gb=80, disk_used_gb=20)
        self.settings = SimpleNamespace(node_memory_reserve_mb=1024, frappe_enforce_capacity=True, frappe_cpu_overcommit=2.0)
        self.node.cpu_cores = 4

    def test_open_links_use_the_worker_address_locally_and_the_domain_in_production(self):
        from app.routes.site import site_url
        site = SimpleNamespace(domain='acme.cloud.example.test', port=30007, server=SimpleNamespace(dial_host='192.168.252.2'))
        for mode, env, expected in (('auto', 'development', 'http://192.168.252.2:30007'), ('auto', 'production', 'https://acme.cloud.example.test'),
                                    ('direct', 'production', 'http://192.168.252.2:30007'), ('domain', 'development', 'https://acme.cloud.example.test')):
            with self.subTest(mode=mode, env=env), patch('app.config.settings.frappe_site_links', mode), patch('app.config.settings.app_env', env):
                self.assertEqual(site_url(site), expected)

    def test_capacity_reserves_container_slots(self):
        self.assertTrue(fits_site(self.node, 10, 6144, 1, self.settings))
        self.assertFalse(fits_site(self.node, 21, 6144, 1, self.settings))

    def test_site_limit_per_server(self):
        self.node.max_sites = 2
        self.assertTrue(fits_site(self.node, 0, 0, 1, self.settings))          # one hosted, room for another
        self.assertFalse(fits_site(self.node, 0, 0, 2, self.settings))         # at its limit
        self.node.max_sites = 0
        self.assertFalse(fits_site(self.node, 0, 0, 0, self.settings))         # 0 = takes none
        self.node.max_sites = None
        self.assertTrue(fits_site(self.node, 0, 0, 500, self.settings))        # blank = no limit

    def test_resource_requirements_are_enforced_when_given(self):
        need = {'ram_mb': 4096, 'cpu': 2, 'storage_gb': 30}
        self.assertTrue(fits_site(self.node, 0, 0, 0, self.settings, need, 0))
        self.assertFalse(fits_site(self.node, 0, 12000, 0, self.settings, need, 0))        # RAM
        self.assertFalse(fits_site(self.node, 0, 0, 0, self.settings, need, 7))            # CPU 7+2 > 4*2
        self.assertFalse(fits_site(self.node, 0, 0, 0, self.settings, dict(need, storage_gb=70), 0))  # disk 60 free
        self.node.cpu_cores = None
        self.assertFalse(fits_site(self.node, 0, 0, 0, self.settings, need, 0))            # unknown CPU is not guessed
        self.settings.frappe_enforce_capacity = False
        self.assertTrue(fits_site(self.node, 0, 12000, 0, self.settings, need, 99))

    def test_only_healthy_opted_in_workers(self):
        for field, value in [('is_active',False), ('role','proxy'), ('frappe_enabled',False), ('last_check_status','unreachable')]:
            with patch.object(self.node, field, value):
                self.assertFalse(fits_site(self.node, 0, 0, 0, self.settings))

    def test_external_mariadb_replaces_bundled_database(self):
        site = SimpleNamespace(id='00000000-0000-0000-0000-000000000002', image='frappe/erpnext:v16.50.0', db_password='bundled-secret', admin_password='a', domain='two.sites.example.test', port=30001, app_names=['erpnext'])
        server = SimpleNamespace(dial_host='10.0.0.2')
        external = {'host': '192.168.252.1', 'port': 3306, 'user': 'frappe_admin', 'password': 'ext-$ecret'}
        with patch('app.services.frappe_service.SSHService'):
            service = FrappeService(site, server, SimpleNamespace(), None, external)
            bundled = FrappeService(site, server, SimpleNamespace())
        services = service.compose()['services']
        self.assertNotIn('db', services)
        self.assertNotIn('db', service.infrastructure())
        env = services['create-site']['environment']
        self.assertEqual((env['DB_HOST'], env['DB_PORT'], env['DB_USER']), ('192.168.252.1', '3306', 'frappe_admin'))
        self.assertEqual(env['DB_PASSWORD'], 'ext-$$ecret')
        self.assertNotIn('bundled-secret', str(services))
        self.assertIn('db_host 192.168.252.1', services['configurator']['command'][0])
        self.assertIn('db', bundled.compose()['services'])
        self.assertEqual(bundled.compose()['services']['create-site']['environment']['DB_HOST'], 'db')

    def test_backup_stream_fails_loudly_when_the_file_cannot_be_read(self):
        class Channel:
            def recv_exit_status(self): return 1
        class Stdout:
            channel = Channel()
            def __init__(self): self.sent = False
            def read(self, size):
                if self.sent: return b''
                self.sent = True
                return b'partial'
        class Client:
            def exec_command(self, *a, **k): return None, Stdout(), None
        class Connect:
            def __enter__(self): return Client()
            def __exit__(self, *a): return False
        site = SimpleNamespace(id='00000000-0000-0000-0000-000000000003', domain='x.example.test')
        with patch('app.services.frappe_service.SSHService'):
            service = FrappeService(site, SimpleNamespace(), SimpleNamespace())
        service.ssh = SimpleNamespace(connect=lambda: Connect())
        chunks = service.stream_backup('a-database.sql.gz')
        self.assertEqual(next(chunks), b'partial')
        with self.assertRaises(RuntimeError):
            next(chunks)
        with self.assertRaises(ValueError):
            next(service.stream_backup('../etc/passwd'))

    def test_mariadb_require_really_requests_tls(self):
        import pymysql
        from app.services.mariadb_service import MariaDBService
        with patch('app.services.mariadb_service.pymysql.connect', side_effect=pymysql.MySQLError('stop')) as connect:
            with self.assertRaises(Exception):
                MariaDBService().connect('h', 3306, 'u', 'p', 'require')
            self.assertTrue(connect.call_args.kwargs['ssl'])
            with self.assertRaises(Exception):
                MariaDBService().connect('h', 3306, 'u', 'p', 'disable')
            self.assertIsNone(connect.call_args.kwargs['ssl'])

    def test_plan_resources_become_docker_limits(self):
        def build(memory_mb, cpu, external=None):
            site = SimpleNamespace(id='00000000-0000-0000-0000-000000000006', image='i', db_password='b', admin_password='a', domain='r.example.test', port=30006, app_names=['erpnext'], memory_limit_mb=memory_mb, cpu_limit=cpu)
            with patch('app.services.frappe_service.SSHService'):
                return FrappeService(site, SimpleNamespace(dial_host='h'), SimpleNamespace(), None, external)
        service = build(8192, 4)
        services = service.compose()['services']
        runtime = [name for name in FrappeService.WEIGHTS if name in services]
        total_mb = sum(int(services[name]['mem_limit'][:-1]) for name in runtime)
        total_cpu = sum(services[name]['cpus'] for name in runtime)
        self.assertLessEqual(total_mb, 8192 + 16)          # the plan's RAM is the ceiling
        self.assertGreater(total_mb, 8192 * 0.9)
        self.assertAlmostEqual(total_cpu, 4, delta=0.2)
        self.assertGreater(int(services['backend']['mem_limit'][:-1]), int(services['frontend']['mem_limit'][:-1]))
        # without a bundled database its share goes to the other services, not nowhere
        external = build(8192, 4, {'host': 'h', 'port': 3306, 'user': 'u', 'password': 'p'}).compose()['services']
        self.assertNotIn('db', external)
        self.assertGreater(int(external['backend']['mem_limit'][:-1]), int(services['backend']['mem_limit'][:-1]))
        # a small plan still gives every service a workable floor, and redis stays under its own limit
        small = build(768, 0.25).compose()['services']
        self.assertGreaterEqual(int(small['backend']['mem_limit'][:-1]), 512)
        cache_limit = int(small['redis-cache']['mem_limit'][:-1])
        self.assertLess(int(small['redis-cache']['command'][2][:-2]), cache_limit)

    def service_with(self, listing):
        site = SimpleNamespace(id='00000000-0000-0000-0000-000000000007', image='i', db_password='b', admin_password='a', domain='b.example.test', port=30007, app_names=['erpnext'])
        with patch('app.services.frappe_service.SSHService'):
            service = FrappeService(site, SimpleNamespace(dial_host='h'), SimpleNamespace(), None, {'host': 'h', 'port': 3306, 'user': 'u', 'password': 'topsecret'})
        service.list_backups = MagicMock(return_value=listing)
        service.run = MagicMock()
        return service

    FILES = [
        {'name': '20261015_213552-b_example_test-database.sql.gz', 'size_bytes': 100, 'created_at': 5.0},
        {'name': '20261015_213552-b_example_test-files.tar', 'size_bytes': 10, 'created_at': 6.0},
        {'name': '20261015_213552-b_example_test-private-files.tar', 'size_bytes': 20, 'created_at': 7.0},
        {'name': '20261015_213552-b_example_test-site_config_backup.json', 'size_bytes': 1, 'created_at': 5.5},
        {'name': '20261014_010000-b_example_test-database.sql.gz', 'size_bytes': 90, 'created_at': 1.0},
        {'name': 'not-a-backup.txt', 'size_bytes': 1, 'created_at': 9.0},
    ]

    def test_backup_files_are_grouped_into_sets_newest_first(self):
        sets = self.service_with(self.FILES).backup_sets()
        self.assertEqual([group['stamp'] for group in sets], ['20261015_213552', '20261014_010000'])
        newest = sets[0]
        self.assertEqual(sorted(file['type'] for file in newest['files']), ['config', 'database', 'files', 'private-files'])
        self.assertEqual((newest['size_bytes'], newest['created_at']), (131, 7.0))

    def test_restore_names_only_files_from_the_workers_own_listing_and_hides_secrets(self):
        service = self.service_with(self.FILES)
        service.restore('20261015_213552')
        commands = [call.args[0] for call in service.run.call_args_list]
        self.assertEqual(commands[0][0], 'stop')                          # application containers stopped first
        script = commands[-1][-1]
        self.assertIn('20261015_213552-b_example_test-database.sql.gz', script)
        self.assertIn('--with-public-files', script); self.assertIn('--with-private-files', script)
        self.assertIn('--force', script); self.assertIn('migrate', script)
        self.assertNotIn('topsecret', script)                              # credentials come from the container's env
        with self.assertRaises(RuntimeError):
            service.restore('20200101_000000')                             # not in the listing: refused
        with self.assertRaises(RuntimeError):
            self.service_with([self.FILES[1]]).restore('20261015_213552')  # no database dump: refused

    def test_deleting_backup_sets_rejects_anything_but_a_timestamp(self):
        service = self.service_with(self.FILES)
        service.exec_output = MagicMock()
        service.delete_backup_sets(['20261014_010000'])
        self.assertIn('20261014_010000-*', service.exec_output.call_args.args[0][-1])
        for bad in ('../x', '2026', '20261014_010000; rm -rf /', '*'):
            with self.assertRaises(ValueError):
                service.delete_backup_sets([bad])

    def test_a_transient_ssh_login_failure_is_retried_but_a_real_one_is_not_hidden(self):
        import paramiko
        from app.services.ssh_service import SSHService
        node = SimpleNamespace(name='n', ip_address='1.2.3.4', private_ip=None, ssh_port=22, ssh_user='u', ssh_key_path=None,
                               ssh_key_encrypted=None, ssh_password='p', ssh_auth_method='password', dial_host='1.2.3.4')
        settings = SimpleNamespace(ssh_timeout=5, ssh_command_timeout=5, ssh_host_key_policy='auto')
        with patch('app.services.ssh_service.paramiko.SSHClient') as client_class, patch('app.services.ssh_service.time.sleep') as sleep:
            client = client_class.return_value
            client.connect.side_effect = [paramiko.AuthenticationException('blip'), paramiko.SSHException('busy'), None]
            with SSHService(node, settings).connect() as connected:
                self.assertIs(connected, client)
            self.assertEqual(client.connect.call_count, 3)
            self.assertEqual(sleep.call_count, 2)
            # still failing after every attempt: reported as unreachable, never swallowed
            client.connect.reset_mock(); client.connect.side_effect = paramiko.AuthenticationException('bad password')
            from app.errors import NodeUnreachableError
            with self.assertRaises(NodeUnreachableError):
                with SSHService(node, settings).connect():
                    pass
            self.assertEqual(client.connect.call_count, 3)

    def test_domain_validation(self):
        from app.services.custom_domains import validate_domain
        suffix = 'cloud.unityalgo.com'
        self.assertEqual(validate_domain(' ERP.Acme.com. ', suffix), ('erp.acme.com', None))
        for bad in ('', 'acme', 'http://acme.com', 'acme.com/path', '10.0.0.1', 'a..com', '-x.com', 'x' * 70 + '.com',
                    suffix, 'evil.' + suffix, 'foo bar.com'):
            domain, problem = validate_domain(bad, suffix)
            self.assertIsNone(domain, bad); self.assertTrue(problem, bad)

    def test_dns_check_accepts_a_cname_to_the_site_or_an_a_record_to_the_proxy_and_explains_everything_else(self):
        import dns.resolver
        from app.services.custom_domains import check_dns

        class Record:
            def __init__(self, text, target=None): self.text, self.target = text, target
            def __str__(self): return self.text

        def resolver(answers):
            class R:
                lifetime = 0
                def resolve(self, name, kind):
                    value = answers.get(kind)
                    if isinstance(value, Exception): raise value
                    if value is None: raise dns.resolver.NoAnswer()
                    return value
            return R()
        site, proxy = 'acme.cloud.unityalgo.com', ['203.0.113.7']
        self.assertEqual(check_dns('erp.acme.com', site, proxy, resolver({'CNAME': [Record('x', 'acme.cloud.unityalgo.com.')]})), (True, None))
        self.assertEqual(check_dns('erp.acme.com', site, proxy, resolver({'A': [Record('203.0.113.7')]})), (True, None))
        ok, why = check_dns('erp.acme.com', site, proxy, resolver({'A': [Record('198.51.100.9')]}))
        self.assertFalse(ok); self.assertIn('198.51.100.9', why); self.assertIn(site, why)
        ok, why = check_dns('erp.acme.com', site, proxy, resolver({'A': dns.resolver.NXDOMAIN()}))
        self.assertFalse(ok); self.assertIn('does not exist', why)
        ok, why = check_dns('erp.acme.com', site, proxy, resolver({'CNAME': [Record('x', 'other.example.com.')], 'A': None}))
        self.assertFalse(ok); self.assertIn('no address record', why)
        import dns.exception
        ok, why = check_dns('erp.acme.com', site, proxy, resolver({'CNAME': dns.exception.Timeout(), 'A': dns.exception.Timeout()}))
        self.assertFalse(ok); self.assertIn('Try again', why)

    def test_secrets_are_redacted_before_they_reach_the_activity_log(self):
        from app.services.activity_logger import redact, redact_value
        leaked = "Command '['bench', 'new-site', 'x', '--db-root-password=hunter2', '--admin-password=s3cret!', '--db-host=h']' returned non-zero exit status 1."
        cleaned = redact(leaked)
        for secret in ('hunter2', 's3cret!'):
            self.assertNotIn(secret, cleaned)
        self.assertIn('--db-host=h', cleaned)                                   # harmless flags stay readable
        self.assertNotIn('abc123', redact('connecting with password=abc123 and token: zzz999'))
        self.assertNotIn('zzz999', redact('connecting with password=abc123 and token: zzz999'))
        self.assertEqual(redact_value({'output': 'x --db-root-password=p1', 'n': 3}), {'output': 'x --db-root-password=[redacted]', 'n': 3})
        self.assertIsNone(redact(None)); self.assertIsNone(redact_value(None))

    def test_the_install_script_reports_failures_without_echoing_the_command(self):
        import subprocess, sys, tempfile, os
        from app.services.frappe_service import INSTALL_SCRIPT
        with tempfile.TemporaryDirectory() as workdir:
            # a stand-in `bench` that always fails, as a missing database login would
            fake = os.path.join(workdir, 'bench'); open(fake, 'w').write('#!/bin/sh\nexit 1\n'); os.chmod(fake, 0o755)
            env = dict(os.environ, PATH=workdir + os.pathsep + os.environ['PATH'], SITE_NAME='x.test', SITE_APPS='[]', DB_HOST='h', DB_PORT='3306',
                       DB_USER='root', DB_PASSWORD='hunter2-db', ADMIN_PASSWORD='s3cret-admin')
            result = subprocess.run([sys.executable, '-c', INSTALL_SCRIPT], cwd=workdir, env=env, capture_output=True, text=True)
        output = result.stdout + result.stderr
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('bench new-site failed', output)
        self.assertNotIn('hunter2-db', output); self.assertNotIn('s3cret-admin', output)

    def test_drop_site_is_called_with_flags_it_accepts_and_failures_are_not_hidden(self):
        site = SimpleNamespace(id='00000000-0000-0000-0000-000000000008', image='i', db_password='b', admin_password='a', domain='z.example.test', port=30008, app_names=['erpnext'])
        with patch('app.services.frappe_service.SSHService'):
            service = FrappeService(site, SimpleNamespace(dial_host='h'), SimpleNamespace(), None, {'host': 'h', 'port': 3306, 'user': 'u', 'password': 'pw'})
        service.run = MagicMock(); service.ssh = SimpleNamespace(run_sudo=lambda command, timeout=None: SimpleNamespace(ok=True), run=lambda *a, **k: SimpleNamespace(stdout='{"db_name": "_0123456789abcdef"}', ok=True))
        service.destroy(True)
        script = service.run.call_args_list[0].args[0][-1]
        self.assertIn('bench drop-site', script)
        for unsupported in ('--db-host', '--db-port'):
            self.assertNotIn(unsupported, script)                      # drop-site rejects these, and the old `|| true` hid that
        self.assertNotIn('|| true', script)
        self.assertEqual(service.database_name, '_0123456789abcdef')   # remembered for the verification afterwards

    def test_only_frappe_site_databases_can_ever_be_dropped(self):
        from app.services.mariadb_service import remove_site_database
        for bad in ('mysql', 'information_schema', 'sys', 'my_app_db', '_short', '_0123456789ABCDEF', 'x`; DROP DATABASE mysql; --', '', None):
            with self.assertRaises(ValueError, msg=repr(bad)):
                remove_site_database('h', 3306, 'u', 'p', bad)         # refused before any connection is made

    def test_delete_verifies_the_external_database_and_finishes_the_job(self):
        from app.services import mariadb_service
        fake_conn = MagicMock(); cursor = fake_conn.cursor.return_value.__enter__.return_value
        cursor.fetchone.return_value = ('_0123456789abcdef',)              # the database is still there
        cursor.fetchall.return_value = [('%',)]                            # ... and so is its login
        with patch.object(mariadb_service.MariaDBService, 'connect', return_value=fake_conn):
            removed = mariadb_service.remove_site_database('h', 3306, 'u', 'p', '_0123456789abcdef')
        self.assertEqual(removed, ['database', 'user@%'])
        executed = [call.args[0] for call in cursor.execute.call_args_list]
        self.assertIn('DROP DATABASE `_0123456789abcdef`', executed)
        self.assertTrue(any(statement.startswith('DROP USER') for statement in executed))
        cursor.fetchone.return_value = None; cursor.fetchall.return_value = []   # bench already did it: nothing to remove
        with patch.object(mariadb_service.MariaDBService, 'connect', return_value=fake_conn):
            self.assertEqual(mariadb_service.remove_site_database('h', 3306, 'u', 'p', '_0123456789abcdef'), [])

    def test_engine_cannot_change_after_registration(self):
        from app.controller.database_connection import DatabaseConnectionController
        from app.errors import ValidationError
        controller = DatabaseConnectionController.__new__(DatabaseConnectionController)
        existing = SimpleNamespace(engine='postgres', role='cluster')
        with self.assertRaises(ValidationError):
            controller.before_update(existing, {'engine': 'mariadb'})
        controller.before_update(existing, {'engine': 'postgres'})

    def test_destroy_drops_the_external_database_without_secrets_on_the_command_line(self):
        site = SimpleNamespace(id='00000000-0000-0000-0000-000000000004', image='i', db_password='b', admin_password='a', domain='d.example.test', port=30003, app_names=['erpnext'])
        with patch('app.services.frappe_service.SSHService'):
            service = FrappeService(site, SimpleNamespace(dial_host='h'), SimpleNamespace(), None, {'host': 'h', 'port': 3306, 'user': 'u', 'password': 'topsecret'})
        service.run = MagicMock()
        service.ssh = SimpleNamespace(run_sudo=lambda command, timeout=None: SimpleNamespace(ok=True),
                                      run=lambda *a, **k: SimpleNamespace(stdout='{"db_name": "_0123456789abcdef"}', ok=True))
        self.assertEqual(service.destroy(True), [])
        commands = [call.args[0] for call in service.run.call_args_list]
        self.assertIn('drop-site', ' '.join(commands[0]))
        self.assertNotIn('topsecret', ' '.join(' '.join(c) for c in commands))
        self.assertEqual(commands[1][:2], ['down', '-v'])

    def test_destroy_force_continues_past_failures_but_normal_stops(self):
        site = SimpleNamespace(id='00000000-0000-0000-0000-000000000005', image='i', db_password='b', admin_password='a', domain='e.example.test', port=30004, app_names=['erpnext'])
        with patch('app.services.frappe_service.SSHService'):
            service = FrappeService(site, SimpleNamespace(dial_host='h'), SimpleNamespace())
        service.run = MagicMock(side_effect=RuntimeError('boom'))
        service.ssh = SimpleNamespace(run_sudo=lambda command, timeout=None: SimpleNamespace(ok=True))
        with self.assertRaises(RuntimeError):
            service.destroy(False)
        problems = service.destroy(False, force=True)
        self.assertEqual(len(problems), 1)
        self.assertIn('remove containers', problems[0])

    def test_ownership_filter_and_missing_site(self):
        session = MagicMock()
        session.scalar.return_value = None
        with self.assertRaises(NotFoundError):
            owned_site(session, '00000000-0000-0000-0000-000000000001', 'customer-a')
        query = str(session.scalar.call_args.args[0].compile(dialect=postgresql.dialect(), compile_kwargs={'literal_binds':True}))
        self.assertIn("sites.user_id = 'customer-a'", query)
        with self.assertRaises(NotFoundError):
            owned_site(session, 'bad-id', 'customer-a')

    def test_compose_isolates_data_and_credentials(self):
        site = SimpleNamespace(id='00000000-0000-0000-0000-000000000001', image='frappe/erpnext:v16.50.0', db_password='test-db-secret', admin_password='test-admin-secret', domain='one.sites.example.test', port=30000, app_names=['erpnext'])
        server = SimpleNamespace(dial_host='10.0.0.2')
        compose = FrappeService(site, server, self.settings).compose()
        services = compose['services']
        self.assertEqual(services['frontend']['ports'], ['10.0.0.2:30000:8080'])
        self.assertEqual(services['frontend']['environment']['FRAPPE_SITE_NAME_HEADER'],site.domain)
        self.assertNotIn('ports', services['db'])
        self.assertNotIn('ports', services['redis-queue'])
        self.assertNotIn(site.admin_password,str(services['create-site']['command']))
        self.assertEqual(services['create-site']['environment']['ADMIN_PASSWORD'],site.admin_password)
        for name in ['backend','frontend','websocket','queue-short','queue-long','scheduler']:
            self.assertIn('sites:/home/frappe/frappe-bench/sites',services[name]['volumes'])
        self.assertEqual(set(compose['volumes']), {'sites','logs','db-data','redis-data'})
        site.admin_password = 'Test-${PASSWORD}-$$-literal'
        escaped = FrappeService(site, server, self.settings).compose()['services']['create-site']['environment']['ADMIN_PASSWORD']
        self.assertEqual(escaped, site.admin_password.replace('$', '$$'))

    def test_frappe_and_commerce_share_capacity(self):
        query = str(ServerController(None,self.settings).node_load().select().compile(dialect=postgresql.dialect()))
        self.assertIn('UNION ALL',query)
        self.assertIn('deployments',query)
        self.assertIn('sites.container_slots',query)
        self.assertIn('cleanup_required',Site.ACTIVE_STATUSES)

    def test_alembic_leaves_portal_tables_alone(self):
        self.assertTrue({'AppCatalog','LoginSession','Notification'} <= PRISMA_OWNED_TABLES)

if __name__ == '__main__':
    unittest.main()
