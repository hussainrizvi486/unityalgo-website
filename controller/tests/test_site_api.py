"""Local database integration tests. SSH, Docker, Caddy and Celery are mocked."""
import json
import uuid
import unittest
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from flask import Flask
from sqlalchemy import delete, select, text
from app.db import database
from app.config import settings
from app.models.site import Site
from app.models.server import ServerNode
from app.routes.site import SiteRoutes, fits_site
from app.errors import ApiError
from app.tasks.site_tasks import provision_site_task, site_action_task, delete_site_task, audit_limits_task, limit_state, change_plan_task, restore_site_task, scheduled_backups_task, run_backup

class SiteApiTests(unittest.TestCase):
    def setUp(self):
        self.customer = 'portal-test-' + uuid.uuid4().hex
        self.worker = uuid.uuid4()
        config = SimpleNamespace(**vars(settings))
        config.frappe_site_domain = 'sites.example.test'
        # Pin what the tests depend on instead of inheriting a developer's .env.
        config.frappe_enforce_capacity = True
        config.frappe_cpu_overcommit = 2.0
        config.frappe_default_ram_mb, config.frappe_default_vcpu, config.frappe_default_storage_gb = 4096, 2.0, 10
        config.frappe_available_apps = ['erpnext','lending']
        self.config = config
        app = Flask(__name__)
        app.register_blueprint(SiteRoutes.blueprint(db=database,config=config))
        app.register_error_handler(ApiError,lambda error: (error.to_dict(),error.status_code))
        self.client = app.test_client()
        with database.session() as session:
            self.defaults=[row[0] for row in session.execute(text("SELECT id FROM database_connections WHERE engine='mariadb' AND is_default")).all()]
            session.execute(text("UPDATE database_connections SET is_default=false WHERE engine='mariadb'"))
        with database.session() as session:
            session.execute(text('INSERT INTO "User" (id,email,"passwordHash",role,"createdAt","updatedAt") VALUES (:id,:email,:password,\'CUSTOMER\',now(),now())'),{'id':self.customer,'email':self.customer+'@example.test','password':'test-only'})
            session.add(ServerNode(id=self.worker,name=self.customer,ip_address='127.0.0.1',role='worker',frappe_enabled=True,is_active=True,last_check_status='ok',max_memory_mb=8192,max_containers=10,disk_total_gb=80,disk_used_gb=10,cpu_cores=4))
        self.proxy = patch('app.routes.site.ServerController.proxy_node',return_value=SimpleNamespace(name='test-proxy'))
        self.proxy.start()
        # No worker is reachable from the tests: nothing else is listening on any port.
        self.ssh = patch('app.services.port_allocator.SSHService')
        self.node = self.ssh.start().return_value
        self.node.listening_ports.return_value = set()
        self.node.port_in_use.return_value = False
        self.queue = patch('app.tasks.site_tasks.provision_site_task.apply_async')
        self.queue_mock = self.queue.start()
        self.other_queues = [patch(f'app.tasks.site_tasks.{task}.apply_async') for task in
                             ('site_action_task', 'change_plan_task', 'delete_site_task', 'restore_site_task')]
        self.other_queue_mocks = {name: queue.start() for name, queue in zip(('action', 'plan', 'delete', 'restore'), self.other_queues)}
        self.placement = patch('app.routes.site.fits_site', side_effect=lambda node, *args: node.id == self.worker and fits_site(node, *args))
        self.placement.start()

    def tearDown(self):
        self.queue.stop(); self.proxy.stop(); self.ssh.stop()
        for queue in self.other_queues:
            queue.stop()
        self.placement.stop()
        with database.session() as session:
            for identifier in self.defaults:
                session.execute(text("UPDATE database_connections SET is_default=true WHERE id=:i"),{'i':identifier})
        with database.session() as session:
            session.execute(delete(Site).where(Site.user_id == self.customer))
            session.execute(delete(ServerNode).where(ServerNode.id == self.worker))
            session.execute(text('DELETE FROM "User" WHERE id=:id'),{'id':self.customer})

    @staticmethod
    def mock_snapshot(service, site_json):
        """build_service is mocked; give the mock the plain values the real snapshot carries."""
        mocked = service.return_value
        mocked.site = SimpleNamespace(slug=site_json['slug'], domain=site_json['domain'], port=30000, app_names=['erpnext'])
        mocked.server = SimpleNamespace(name='test-worker')

    def create(self, **overrides):
        data={'user_id':self.customer,'name':'Test workspace','slug':'portal-'+uuid.uuid4().hex[:12], 'request_key':str(uuid.uuid4()),'app_names':['erpnext'],'company_name':'Acme Ltd','country':'Pakistan','currency':'PKR','coa_type':'numbered','owner_email':'owner@example.test','owner_password':'Owner-password-123','plan_id':'plan-1','plan_name':'Starter'}
        data.update(overrides)
        return self.client.post('/api/v1/sites',json=data),data

    def test_reservation_idempotency_and_owner_isolation(self):
        response,data=self.create()
        self.assertEqual(response.status_code,201,response.json)
        site=response.json
        self.assertEqual(site['server_id'],str(self.worker))
        self.assertNotIn('admin_password',site)
        self.assertNotIn('db_password',site)
        duplicate=self.client.post('/api/v1/sites',json=data)
        self.assertEqual(duplicate.status_code,200)
        self.assertEqual(duplicate.json['id'],site['id'])
        self.assertEqual(self.queue_mock.call_count,1)
        inaccessible=self.client.get('/api/v1/sites/'+site['id']+'?user_id=another-customer')
        self.assertEqual(inaccessible.status_code,404)
        exhausted,_=self.create()
        self.assertEqual(exhausted.status_code,409)

    def test_rejects_unavailable_app_before_reservation(self):
        response,_=self.create(app_names=['unapproved_package'])
        self.assertEqual(response.status_code,422)
        self.assertFalse(self.queue_mock.called)

    def test_rejects_invalid_wizard_fields(self):
        for override in ({'owner_email':'nope'},{'coa_type':'custom'},{'currency':'x'},{'company_name':''},{'owner_password':'short'},{'plan_id':''},{'country':''}):
            response,_=self.create(**override)
            self.assertEqual(response.status_code,422,override)
        self.assertFalse(self.queue_mock.called)

    def test_wizard_answers_are_encrypted_in_queue_and_not_returned(self):
        response,_=self.create()
        self.assertEqual(response.status_code,201,response.json)
        blob=self.queue_mock.call_args.kwargs['kwargs']['setup']
        self.assertNotIn('Owner-password-123',blob)
        self.assertNotIn('owner_password',json.dumps(response.json))
        self.assertEqual(response.json['plan_name'],'Starter')

    def test_site_uses_default_mariadb_server_else_bundled(self):
        from app.models.database_connection import DatabaseConnection
        from app.services import crypto
        with database.session() as session:
            previous=[row[0] for row in session.execute(text("SELECT id FROM database_connections WHERE engine='mariadb' AND is_default")).all()]
            session.execute(text("UPDATE database_connections SET is_default=false WHERE engine='mariadb'"))
        first,_=self.create()
        self.assertEqual(first.status_code,201)
        self.assertIsNone(first.json['db_server'])
        with database.session() as session:
            db=DatabaseConnection(engine='mariadb',role='cluster',is_default=True,name='test-maria-'+self.customer,host='192.168.252.1',port=3306,database_name='mysql',username='u',password_encrypted=crypto.encrypt('p',self.config),sslmode='disable')
            session.add(db); session.flush(); db_id=db.id; db_name=db.name
        try:
            with database.session() as session:
                session.execute(text("DELETE FROM sites WHERE user_id=:u"),{'u':self.customer})
            second,_=self.create()
            self.assertEqual(second.status_code,201,second.json)
            self.assertEqual(second.json['db_server'],db_name)
        finally:
            with database.session() as session:
                session.execute(text("DELETE FROM sites WHERE user_id=:u"),{'u':self.customer})
                session.execute(text("DELETE FROM database_connections WHERE id=:i"),{'i':db_id})
                for identifier in previous:
                    session.execute(text("UPDATE database_connections SET is_default=true WHERE id=:i"),{'i':identifier})

    def make_ready(self):
        response,_=self.create()
        with database.session() as session:
            session.execute(text("UPDATE sites SET status='ready',progress=100 WHERE id=:i"),{'i':response.json['id']})
        return response.json

    def act(self, site, action):
        return self.client.post(f"/api/v1/sites/{site['id']}/actions/{action}",json={'user_id':self.customer})

    def test_stop_start_restart_state_rules(self):
        site=self.make_ready()
        self.assertEqual(self.act(site,'start').status_code,409)   # not stopped
        stopped=self.act(site,'stop')
        self.assertEqual(stopped.status_code,202)
        current=self.client.get(f"/api/v1/sites/{site['id']}?user_id={self.customer}").json
        self.assertEqual(current['status'],'stopping')
        self.assertEqual(self.act(site,'restart').status_code,409)  # mid-transition
        self.assertEqual(self.act(site,'explode').status_code,404)

    def test_backup_marks_activity_and_blocks_a_second_one(self):
        site=self.make_ready()
        self.assertEqual(self.act(site,'backup').status_code,202)
        current=self.client.get(f"/api/v1/sites/{site['id']}?user_id={self.customer}").json
        self.assertEqual((current['status'],current['activity']),('ready','backup'))
        self.assertEqual(self.act(site,'backup').status_code,409)

    def test_action_task_updates_state_and_recovers_from_failure(self):
        site=self.make_ready()
        get=lambda: self.client.get(f"/api/v1/sites/{site['id']}?user_id={self.customer}").json
        with patch('app.tasks.site_tasks.build_service') as build:
            self.mock_snapshot(build,site)
            site_action_task.run(site['id'],'stop')
            self.assertEqual(get()['status'],'stopped')
            build.return_value.stop.assert_called_once()
            build.return_value.healthy.return_value=True
            site_action_task.run(site['id'],'start')
            self.assertEqual(get()['status'],'ready')
            build.return_value.backup.side_effect=RuntimeError('disk full')
            with database.session() as session:
                session.execute(text("UPDATE sites SET activity='backup' WHERE id=:i"),{'i':site['id']})
            with self.assertRaises(RuntimeError):
                site_action_task.run(site['id'],'backup')
            after=get()
            self.assertEqual((after['status'],after['activity']),('ready',None))
            self.assertIn('backup',after['error'].lower())
        with database.session() as session:
            session.execute(text("DELETE FROM activity_logs WHERE tenant_slug=:s"),{'s':site['slug']})
            session.execute(text("DELETE FROM operations WHERE tenant_slug=:s"),{'s':site['slug']})

    def test_usage_and_backup_routes_use_the_site_service_and_enforce_ownership(self):
        site=self.make_ready()
        with patch('app.routes.site.build_service') as build:
            build.return_value.usage.return_value={'cpu_percent':1.5,'memory_mb':300,'memory_limit_mb':4000,'storage_mb':900}
            build.return_value.backup_sets.return_value=[{'stamp':'20261015_213552','size_bytes':10,'created_at':1.0,'files':[{'name':'a-database.sql.gz','type':'database','size_bytes':10}]}]
            build.return_value.stream_backup.return_value=iter([b'abc',b'def'])
            url=f"/api/v1/sites/{site['id']}"
            self.assertEqual(self.client.get(url+f"/usage?user_id={self.customer}").json['storage_mb'],900)
            listed=self.client.get(url+f"/backups?user_id={self.customer}").json
            self.assertEqual((listed['available'],listed['results'][0]['files'][0]['name'],listed['results'][0]['kind']),(True,'a-database.sql.gz','manual'))
            download=self.client.get(url+f"/backups/a-database.sql.gz?user_id={self.customer}")
            self.assertEqual((download.status_code,download.data),(200,b'abcdef'))
            self.assertIn('attachment',download.headers['Content-Disposition'])
            for path in ('/usage','/backups','/backups/a-database.sql.gz'):
                self.assertEqual(self.client.get(url+path+'?user_id=someone-else').status_code,404,path)

    def delete(self, site, confirm=None, user=None):
        return self.client.post(f"/api/v1/sites/{site['id']}/delete",json={'user_id':user or self.customer,'confirm':site['slug'] if confirm is None else confirm})

    def test_delete_needs_the_exact_name_ownership_and_a_stable_state(self):
        site=self.make_ready()
        self.assertEqual(self.delete(site,confirm='wrong').status_code,422)
        self.assertEqual(self.delete(site,user='someone-else').status_code,404)
        self.assertEqual(self.delete(site).status_code,202)
        self.assertEqual(self.client.get(f"/api/v1/sites/{site['id']}?user_id={self.customer}").json['status'],'deleting')
        self.assertEqual(self.delete(site).status_code,409)           # already deleting
        self.assertEqual(self.act(site,'stop').status_code,409)

    def test_delete_task_removes_the_site_and_frees_the_name(self):
        site=self.make_ready()
        self.assertEqual(self.delete(site).status_code,202)
        with patch('app.tasks.site_tasks.build_service') as build, patch('app.tasks.site_tasks.ProxyConfigurationService'):
            self.mock_snapshot(build,site)
            build.return_value.destroy.return_value=[]
            delete_site_task.run(site['id'],'ready')
            build.return_value.destroy.assert_called_once_with(False,force=False)
        self.assertEqual(self.client.get(f"/api/v1/sites/{site['id']}?user_id={self.customer}").status_code,404)
        again,_=self.create(slug=site['slug'])
        self.assertEqual(again.status_code,201)
        with database.session() as session:
            session.execute(text("DELETE FROM activity_logs WHERE tenant_slug=:s"),{'s':site['slug']})
            session.execute(text("DELETE FROM operations WHERE tenant_slug=:s"),{'s':site['slug']})

    def test_failed_delete_is_reported_not_lost(self):
        site=self.make_ready()
        self.delete(site)
        with patch('app.tasks.site_tasks.build_service') as build:
            self.mock_snapshot(build,site)
            build.return_value.destroy.side_effect=RuntimeError('docker down failed')
            with self.assertRaises(RuntimeError):
                delete_site_task.run(site['id'],'ready')
        after=self.client.get(f"/api/v1/sites/{site['id']}?user_id={self.customer}").json
        self.assertEqual(after['status'],'cleanup_required')
        with database.session() as session:
            session.execute(text("DELETE FROM activity_logs WHERE tenant_slug=:s"),{'s':site['slug']})
            session.execute(text("DELETE FROM operations WHERE tenant_slug=:s"),{'s':site['slug']})

    def test_admin_lists_every_site_and_force_deletes_a_stuck_one(self):
        site=self.make_ready()
        with database.session() as session:
            session.execute(text("UPDATE sites SET status='cleanup_required' WHERE id=:i"),{'i':site['id']})
        listed=self.client.get('/api/v1/sites/admin').json['results']
        mine=[row for row in listed if row['id']==site['id']][0]
        self.assertEqual(mine['owner_account_email'],self.customer+'@example.test')
        self.assertEqual(self.delete(site).status_code,409)            # customers cannot delete a stuck site
        self.assertEqual(self.client.post(f"/api/v1/sites/admin/{site['id']}/force-delete").status_code,202)
        with patch('app.tasks.site_tasks.build_service') as build, patch('app.tasks.site_tasks.ProxyConfigurationService'):
            self.mock_snapshot(build,site)
            build.return_value.destroy.return_value=['remove containers and volumes: boom']
            delete_site_task.run(site['id'],'cleanup_required',force=True)
            build.return_value.destroy.assert_called_once_with(False,force=True)
        self.assertEqual(self.client.get(f"/api/v1/sites/{site['id']}?user_id={self.customer}").status_code,404)
        with database.session() as session:
            session.execute(text("DELETE FROM activity_logs WHERE tenant_slug=:s"),{'s':site['slug']})
            session.execute(text("DELETE FROM operations WHERE tenant_slug=:s"),{'s':site['slug']})

    def roomy(self):
        """The stock test worker holds a single site; let several fit."""
        with database.session() as session:
            session.execute(text('UPDATE server_nodes SET max_containers=100 WHERE id=:i'),{'i':self.worker})

    def test_plan_resources_are_saved_and_exposed(self):
        self.roomy()
        response,_=self.create(plan_vcpu=1,plan_ram_mb=2048,plan_storage_gb=10,plan_user_limit=5)
        self.assertEqual(response.status_code,201,response.json)
        self.assertEqual(response.json['resources'],{'vcpu':1.0,'ram_mb':2048,'storage_gb':10,'users':5})
        defaults,_=self.create()
        self.assertEqual(defaults.json['resources']['ram_mb'],self.config.frappe_default_ram_mb)

    def test_invalid_plan_resources_are_rejected(self):
        for override in ({'plan_vcpu':0},{'plan_ram_mb':100},{'plan_storage_gb':0},{'plan_user_limit':'many'}):
            response,_=self.create(**override)
            self.assertEqual(response.status_code,422,override)

    def test_a_plan_bigger_than_the_worker_is_refused_with_a_clear_reason(self):
        for override in ({'plan_ram_mb':16384},{'plan_vcpu':16},{'plan_storage_gb':500}):
            response,_=self.create(**override)
            self.assertEqual(response.status_code,409,override)
            self.assertIn('full capacity',response.json['error'])      # one plain message for customers; the detail is logged
        self.assertFalse(self.queue_mock.called)

    def test_cpu_already_reserved_by_other_sites_counts(self):
        self.config.frappe_cpu_overcommit=1
        self.roomy()
        small=dict(plan_ram_mb=1024)          # keep RAM out of the way so only CPU decides
        self.assertEqual(self.create(plan_vcpu=3,**small)[0].status_code,201)
        self.assertEqual(self.create(plan_vcpu=2,**small)[0].status_code,409)   # 3 + 2 > 4 cores
        self.assertEqual(self.create(plan_vcpu=1,**small)[0].status_code,201)

    def test_capacity_checks_can_be_switched_off_for_a_small_dev_vm(self):
        self.config.frappe_enforce_capacity=False
        self.assertEqual(self.create(plan_ram_mb=65536,plan_vcpu=32)[0].status_code,201)

    def test_limit_state_reports_seats_and_storage_overages(self):
        site=SimpleNamespace(user_limit=5,storage_limit_gb=10)
        self.assertEqual(limit_state(site,5,10240),'ok')
        self.assertEqual(limit_state(site,6,100),'users')
        self.assertEqual(limit_state(site,1,10241),'storage')
        self.assertEqual(limit_state(site,9,99999),'both')
        self.assertEqual(limit_state(SimpleNamespace(user_limit=None,storage_limit_gb=10),500,1),'ok')   # unlimited seats

    def test_audit_records_usage_and_reinstalls_the_seat_script(self):
        site=self.make_ready()
        with database.session() as session:
            session.execute(text("UPDATE sites SET user_limit=2,storage_limit_gb=1 WHERE id=:i"),{'i':site['id']})
        with patch('app.tasks.site_tasks.build_service') as build:
            self.mock_snapshot(build,site)
            build.return_value.count_users.return_value=3
            build.return_value.usage.return_value={'cpu_percent':0,'memory_mb':1,'memory_limit_mb':1,'storage_mb':2048}
            audit_limits_task.run(site_ids=[site['id']])      # never touch other sites in the dev database
            build.return_value.apply_limits.assert_called_once_with(2)
        after=self.client.get(f"/api/v1/sites/{site['id']}?user_id={self.customer}").json
        self.assertEqual(after['limits']['state'],'both')
        self.assertEqual((after['limits']['user_count'],after['limits']['storage_used_mb']),(3,2048))
        self.assertIsNotNone(after['limits']['audited_at'])

    PLAN=dict(plan_id='plan-2',plan_name='Growth',plan_vcpu=2,plan_ram_mb=4096,plan_storage_gb=30,plan_user_limit=25)

    def change_plan(self,site,**overrides):
        body=dict(self.PLAN,user_id=self.customer); body.update(overrides)
        return self.client.post(f"/api/v1/sites/{site['id']}/change-plan",json=body)

    def get(self,site):
        return self.client.get(f"/api/v1/sites/{site['id']}?user_id={self.customer}").json

    def test_change_plan_preflight_does_not_queue_or_change_limits(self):
        site = self.make_ready()
        result = self.change_plan(site, dry_run=True)
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.json['eligible'])
        unchanged = self.get(site)
        self.assertEqual(unchanged['status'], 'ready')
        self.assertEqual(unchanged['plan_id'], 'plan-1')
        self.assertEqual(self.change_plan(site, dry_run=True, user_id='someone-else').status_code, 404)
        self.assertEqual(self.change_plan(site, dry_run=True, plan_ram_mb=65536).status_code, 409)

    def test_change_plan_rules(self):
        site=self.make_ready()
        self.assertEqual(self.change_plan(site,plan_id='plan-1').status_code,409)            # already on it
        with database.session() as session:
            session.execute(text("UPDATE sites SET user_count=9 WHERE id=:i"),{'i':site['id']})
        refused=self.change_plan(site,plan_user_limit=5)
        self.assertEqual(refused.status_code,409); self.assertIn('9 active users',refused.json['error'])
        self.assertEqual(self.change_plan(site,plan_ram_mb=65536).status_code,409)            # server too small
        self.assertEqual(self.get(site)['status'],'ready')                                    # nothing changed
        self.assertEqual(self.change_plan(site,user_id='someone-else').status_code,404)
        self.assertEqual(self.change_plan(site).status_code,202)
        self.assertEqual(self.get(site)['status'],'restarting')
        self.assertEqual(self.change_plan(site,plan_id='plan-3').status_code,409)             # busy

    def run_change(self,site,plan,origin='ready'):
        with patch('app.tasks.site_tasks.build_service') as build:
            self.mock_snapshot(build,site)
            build.return_value.healthy.return_value=True
            build.return_value.count_users.return_value=3
            change_plan_task.run(site['id'],plan,origin)
            return build.return_value

    def cleanup_logs(self,site):
        with database.session() as session:
            session.execute(text("DELETE FROM activity_logs WHERE tenant_slug=:s"),{'s':site['slug']})
            session.execute(text("DELETE FROM operations WHERE tenant_slug=:s"),{'s':site['slug']})

    def test_change_plan_task_applies_limits_and_records_the_new_plan(self):
        site=self.make_ready()
        self.assertEqual(self.change_plan(site).status_code,202)
        service=self.run_change(site,{'id':'plan-2','name':'Growth','cpu':2.0,'ram_mb':4096,'storage_gb':30,'user_limit':25})
        service.rewrite_compose.assert_called_once(); service.apply_limits.assert_called_once_with(25)
        after=self.get(site)
        self.assertEqual((after['status'],after['plan_name']),('ready','Growth'))
        self.assertEqual(after['resources'],{'vcpu':2.0,'ram_mb':4096,'storage_gb':30,'users':25})
        self.cleanup_logs(site)

    def test_change_plan_task_refuses_a_plan_with_too_few_seats(self):
        site=self.make_ready()
        before=self.get(site)
        self.assertEqual(self.change_plan(site).status_code,202)
        service=self.run_change(site,{'id':'plan-2','name':'Tiny','cpu':1.0,'ram_mb':1024,'storage_gb':5,'user_limit':2})
        service.rewrite_compose.assert_not_called()                  # refused before touching anything
        after=self.get(site)
        self.assertEqual(after['status'],'ready')
        self.assertIn('3 active users',after['error'])
        self.assertEqual((after['plan_name'],after['resources']),(before['plan_name'],before['resources']))
        self.cleanup_logs(site)

    def test_a_failed_plan_change_rolls_the_containers_back(self):
        site=self.make_ready()
        before=self.get(site)
        self.assertEqual(self.change_plan(site).status_code,202)
        with patch('app.tasks.site_tasks.build_service') as build:
            self.mock_snapshot(build,site)
            svc=build.return_value; svc.count_users.return_value=1
            svc.start.side_effect=[RuntimeError('compose failed'),None]       # applying fails, the rollback start works
            with self.assertRaises(RuntimeError):
                change_plan_task.run(site['id'],{'id':'plan-2','name':'Growth','cpu':2.0,'ram_mb':4096,'storage_gb':30,'user_limit':25},'ready')
            self.assertEqual(svc.rewrite_compose.call_count,2)               # new limits, then the old ones back
            self.assertEqual(svc.start.call_count,2)
        after=self.get(site)
        self.assertEqual(after['status'],'ready')
        self.assertIn('rolled back',after['error'])
        self.assertEqual((after['plan_id'],after['resources']),(before['plan_id'],before['resources']))   # the old plan, untouched
        self.cleanup_logs(site)

    def test_reset_password_validates_checks_ownership_and_never_logs_the_secret(self):
        site=self.make_ready()
        url=f"/api/v1/sites/{site['id']}/reset-password"
        post=lambda **b:self.client.post(url,json=dict({'user_id':self.customer,'new_password':'A-new-password-123'},**b))
        self.assertEqual(post(new_password='short').status_code,422)
        self.assertEqual(post(user_id='someone-else').status_code,404)
        with patch('app.routes.site.build_service') as build:
            self.assertEqual(post().status_code,200)
            build.return_value.set_owner_password.assert_called_once_with('owner@example.test','A-new-password-123')
            build.return_value.set_owner_password.side_effect=RuntimeError('bench failed with A-new-password-123')
            failed=post()
            self.assertEqual(failed.status_code,409)
            self.assertNotIn('A-new-password-123',str(failed.json))     # the service error is never echoed to the customer
        with database.session() as session:
            session.execute(text("UPDATE sites SET status='stopped' WHERE id=:i"),{'i':site['id']})
        self.assertEqual(post().status_code,409)                         # needs a running site
        with database.session() as session:
            session.execute(text("DELETE FROM activity_logs WHERE action='site.reset_password' AND tenant_slug=:s"),{'s':site['slug']})

    def test_deactivate_frees_capacity_and_reactivate_needs_room(self):
        self.roomy()
        site=self.make_ready()
        self.assertEqual(self.act(site,'deactivate').status_code,202)
        self.assertEqual(self.get(site)['status'],'stopping')
        with patch('app.tasks.site_tasks.build_service') as build, patch('app.tasks.site_tasks.ProxyConfigurationService') as proxy:
            self.mock_snapshot(build,site)
            site_action_task.run(site['id'],'deactivate','ready')
            proxy.return_value.sync_all.assert_called_once()              # its route disappears
        self.assertEqual(self.get(site)['status'],'deactivated')
        self.assertEqual(self.act(site,'stop').status_code,409)           # nothing to stop; reactivate first
        self.assertEqual(self.create(plan_ram_mb=6000,plan_vcpu=2)[0].status_code,201)
        self.assertEqual(self.act(site,'reactivate').status_code,409)     # ... so there is no room to come back
        self.assertEqual(self.get(site)['status'],'deactivated')
        with database.session() as session:
            session.execute(text("DELETE FROM sites WHERE user_id=:u AND status<>'deactivated'"),{'u':self.customer})
        with patch('app.tasks.site_tasks.build_service') as build, patch('app.tasks.site_tasks.ProxyConfigurationService') as proxy:
            self.mock_snapshot(build,site); build.return_value.healthy.return_value=True
            self.assertEqual(self.act(site,'reactivate').status_code,202)
            site_action_task.run(site['id'],'reactivate','deactivated')
            proxy.return_value.sync_all.assert_called_once()
        self.assertEqual(self.get(site)['status'],'ready')
        self.cleanup_logs(site)

    def test_a_failed_reactivation_leaves_the_site_deactivated(self):
        site=self.make_ready()
        with database.session() as session:
            session.execute(text("UPDATE sites SET status='deactivated' WHERE id=:i"),{'i':site['id']})
        self.assertEqual(self.act(site,'reactivate').status_code,202)
        with patch('app.tasks.site_tasks.build_service') as build:
            self.mock_snapshot(build,site); build.return_value.start.side_effect=RuntimeError('boom')
            with self.assertRaises(RuntimeError):
                site_action_task.run(site['id'],'reactivate','deactivated')
        self.assertEqual(self.get(site)['status'],'deactivated')
        self.cleanup_logs(site)

    def sets(self,*stamps):
        return [{'stamp':st,'size_bytes':1,'created_at':float(i),'files':[]} for i,st in enumerate(stamps)]

    def test_backup_settings_are_validated_and_owned(self):
        site=self.make_ready()
        url=f"/api/v1/sites/{site['id']}/backup-settings"
        post=lambda **b:self.client.post(url,json=dict({'user_id':self.customer,'schedule':'daily','retention':5},**b))
        for bad in ({'schedule':'hourly'},{'retention':0},{'retention':31},{'retention':'many'}):
            self.assertEqual(post(**bad).status_code,422,bad)
        self.assertEqual(post(user_id='someone-else').status_code,404)
        self.assertEqual(post().status_code,200)
        after=self.get(site)
        self.assertEqual((after['backup']['schedule'],after['backup']['retention']),('daily',5))

    def restore(self,site,**overrides):
        body={'user_id':self.customer,'stamp':'20261015_213552','confirm':site['slug']}; body.update(overrides)
        return self.client.post(f"/api/v1/sites/{site['id']}/restore",json=body)

    def test_restore_route_rules(self):
        site=self.make_ready()
        self.assertEqual(self.restore(site,stamp='../etc').status_code,422)
        self.assertEqual(self.restore(site,confirm='wrong').status_code,422)
        self.assertEqual(self.restore(site,user_id='someone-else').status_code,404)
        self.assertEqual(self.get(site)['status'],'ready')                  # nothing changed so far
        self.assertEqual(self.restore(site).status_code,202)
        self.assertEqual(self.get(site)['status'],'restoring')
        self.assertEqual(self.restore(site).status_code,409)                # already restoring
        self.assertEqual(self.act(site,'backup').status_code,409)

    def run_restore(self,site,service_setup):
        with patch('app.tasks.site_tasks.build_service') as build:
            self.mock_snapshot(build,site)
            svc=build.return_value; svc.healthy.return_value=True
            service_setup(svc)
            try:
                restore_site_task.run(site['id'],'20261015_213552','ready')
            except RuntimeError:
                pass
            return svc

    def test_restore_takes_a_safety_backup_first_and_reapplies_the_seat_limit(self):
        site=self.make_ready(); self.restore(site)
        def setup(svc):
            svc.backup_sets.side_effect=[self.sets('20260101_000000'),self.sets('20260101_000000','20261016_100000')]
        svc=self.run_restore(site,setup)
        order=[c[0] for c in svc.method_calls if c[0] in ('backup','restore','start','apply_limits')]
        self.assertEqual(order,['backup','restore','start','apply_limits'])
        svc.restore.assert_called_once_with('20261015_213552')
        after=self.get(site)
        self.assertEqual(after['status'],'ready'); self.assertIsNone(after['error'])
        with database.session() as session:
            kinds=[r[0] for r in session.execute(text("SELECT kind FROM site_backups WHERE site_id=:i"),{'i':site['id']}).all()]
        self.assertEqual(kinds,['safety'])
        self.cleanup_logs(site)

    def test_a_failed_restore_puts_the_previous_data_back(self):
        site=self.make_ready(); self.restore(site)
        def setup(svc):
            svc.backup_sets.side_effect=[[],self.sets('20261016_100000')]
            svc.restore.side_effect=[RuntimeError('bench restore failed'),None]    # the real one fails, the rollback works
        svc=self.run_restore(site,setup)
        self.assertEqual([c.args[0] for c in svc.restore.call_args_list],['20261015_213552','20261016_100000'])
        after=self.get(site)
        self.assertEqual(after['status'],'ready')
        self.assertIn('returned to how it was',after['error'])
        self.cleanup_logs(site)

    def test_a_restore_that_cannot_be_rolled_back_stops_the_site_rather_than_serving_broken_data(self):
        site=self.make_ready(); self.restore(site)
        def setup(svc):
            svc.backup_sets.side_effect=[[],self.sets('20261016_100000')]
            svc.restore.side_effect=RuntimeError('restore failed twice')
        self.run_restore(site,setup)
        after=self.get(site)
        self.assertEqual(after['status'],'stopped')
        self.assertIn('safety backup is kept',after['error'])
        self.cleanup_logs(site)

    def test_retention_prunes_only_that_kind_and_manual_backups_are_kept(self):
        site=self.make_ready()
        with database.session() as session:
            session.execute(text("UPDATE sites SET backup_retention=2 WHERE id=:i"),{'i':site['id']})
            for stamp,kind in (('20260101_000000','scheduled'),('20260102_000000','scheduled'),('20260103_000000','manual'),('20260104_000000','safety')):
                session.execute(text("INSERT INTO site_backups (id,site_id,stamp,kind) VALUES (gen_random_uuid(),:i,:s,:k)"),{'i':site['id'],'s':stamp,'k':kind})
        svc=MagicMock()
        svc.backup.return_value='ok'
        svc.backup_sets.side_effect=[self.sets('20260101_000000','20260102_000000','20260103_000000','20260104_000000'),
                                     self.sets('20260101_000000','20260102_000000','20260103_000000','20260104_000000','20260105_000000')]
        _,fresh=run_backup(svc,site['id'],'scheduled')
        self.assertEqual(fresh,['20260105_000000'])
        svc.delete_backup_sets.assert_called_once_with(['20260101_000000'])       # newest two scheduled kept (…02, …05)
        with database.session() as session:
            left=sorted(r[0] for r in session.execute(text("SELECT stamp FROM site_backups WHERE site_id=:i"),{'i':site['id']}).all())
        self.assertEqual(left,['20260102_000000','20260103_000000','20260104_000000','20260105_000000'])
        self.assertIsNotNone(self.get(site)['backup']['last_at'])

    def test_the_scheduler_backs_up_only_due_idle_running_sites(self):
        self.roomy()
        small=dict(plan_ram_mb=1024,plan_vcpu=0.5)
        due=self.create(**small)[0].json; notdue=self.create(**small)[0].json; weekly=self.create(**small)[0].json
        for s_,sched,last in ((due,'daily',None),(notdue,'daily','now()'),(weekly,'off',None)):
            with database.session() as session:
                session.execute(text("UPDATE sites SET status='ready',backup_schedule=:sc,last_backup_at="+(last or 'NULL')+" WHERE id=:i"),{'sc':sched,'i':s_['id']})
        ids=[due['id'],notdue['id'],weekly['id']]
        with patch('app.tasks.site_tasks.build_service') as build:
            self.mock_snapshot(build,due)
            build.return_value.backup_sets.side_effect=[[],self.sets('20261016_020000')]
            build.return_value.backup.return_value='ok'
            scheduled_backups_task.run(site_ids=ids)
            self.assertEqual(build.return_value.backup.call_count,1)             # only the due one
        self.assertIsNotNone(self.get(due)['backup']['last_at'])
        self.assertIsNone(self.get(due)['activity'])                             # claim released
        with database.session() as session:
            self.assertEqual(session.execute(text("SELECT kind FROM site_backups WHERE site_id=:i"),{'i':due['id']}).scalar(),'scheduled')
        self.cleanup_logs(due)

    def test_a_failing_scheduled_backup_backs_off_instead_of_retrying_every_sweep(self):
        site=self.make_ready()
        with database.session() as session:
            session.execute(text("UPDATE sites SET backup_schedule='daily' WHERE id=:i"),{'i':site['id']})
        with patch('app.tasks.site_tasks.build_service') as build:
            self.mock_snapshot(build,site)
            build.return_value.backup_sets.return_value=[]
            build.return_value.backup.side_effect=RuntimeError('disk full')
            scheduled_backups_task.run(site_ids=[site['id']])
        after=self.get(site)
        self.assertIsNone(after['activity'])
        self.assertIsNotNone(after['backup']['last_at'])                         # pushed forward: retried in ~2h, not at the next sweep
        with patch('app.tasks.site_tasks.build_service') as build:
            scheduled_backups_task.run(site_ids=[site['id']])
            build.return_value.backup.assert_not_called()
        self.cleanup_logs(site)

    def dom(self,site,method='post',path='',**body):
        url=f"/api/v1/sites/{site['id']}/domains{path}"
        if method=='get': return self.client.get(url+f"?user_id={body.get('user_id',self.customer)}")
        if method=='delete': return self.client.delete(url+f"?user_id={body.get('user_id',self.customer)}")
        return self.client.post(url,json=dict({'user_id':self.customer},**body))

    def test_custom_domain_lifecycle(self):
        site=self.make_ready()
        with patch('app.routes.site.ServerController.proxy_node',return_value=SimpleNamespace(ip_address='203.0.113.7')):
            for bad in ('', 'nodots', 'evil.'+self.config.frappe_site_domain, '10.0.0.1'):
                self.assertEqual(self.dom(site,domain=bad).status_code,422,bad)
            self.assertEqual(self.dom(site,domain='erp.acme.com',user_id='someone-else').status_code,404)
            added=self.dom(site,domain='ERP.Acme.com')
            self.assertEqual(added.status_code,201,added.json)
            self.assertEqual((added.json['domain'],added.json['status']),('erp.acme.com','pending'))
            self.assertEqual(added.json['proxy_ips'],['203.0.113.7']); self.assertEqual(added.json['target'],site['domain'])
            self.assertEqual(self.dom(site,domain='erp.acme.com').status_code,409)           # already used
            did=added.json['id']
            with patch('app.services.custom_domains.check_dns',return_value=(False,'points elsewhere')), patch('app.routes.site.resync_proxy') as resync:
                pending=self.dom(site,path=f'/{did}/verify').json
                self.assertEqual((pending['status'],pending['error']),('pending','points elsewhere'))
                resync.assert_not_called()                                                    # never routed before DNS proves it
            with patch('app.services.custom_domains.check_dns',return_value=(True,None)), patch('app.routes.site.resync_proxy',return_value=False):
                failed=self.dom(site,path=f'/{did}/verify').json
                self.assertEqual(failed['status'],'pending'); self.assertIn('routing',failed['error'])   # DNS fine, Caddy refused
            with patch('app.services.custom_domains.check_dns',return_value=(True,None)), patch('app.routes.site.resync_proxy',return_value=True) as resync:
                active=self.dom(site,path=f'/{did}/verify').json
                self.assertEqual((active['status'],active['tls_status']),('active','pending'))
                resync.assert_called_once()
            with patch('app.services.custom_domains.probe_certificate',return_value=True):
                listed=self.dom(site,method='get').json
            self.assertEqual((listed['results'][0]['status'],listed['results'][0]['tls_status']),('active','active'))
            self.assertEqual(self.dom(site,method='delete',path=f'/{did}',user_id='someone-else').status_code,404)
            with patch('app.routes.site.resync_proxy') as resync:
                self.assertEqual(self.dom(site,method='delete',path=f'/{did}').status_code,204)
                resync.assert_called_once()                                                   # the route is withdrawn
            self.assertEqual(self.dom(site,method='get').json['results'],[])

    def test_domain_limit_and_cross_site_uniqueness(self):
        self.roomy(); self.config.frappe_domains_per_site=2
        first=self.make_ready(); second=self.create(plan_ram_mb=1024,plan_vcpu=0.5)[0].json
        with database.session() as session:
            session.execute(text("UPDATE sites SET status='ready' WHERE id=:i"),{'i':second['id']})
        with patch('app.routes.site.ServerController.proxy_node',return_value=SimpleNamespace(ip_address='203.0.113.7')):
            self.assertEqual(self.dom(first,domain='a.example.org').status_code,201)
            self.assertEqual(self.dom(first,domain='b.example.org').status_code,201)
            self.assertEqual(self.dom(first,domain='c.example.org').status_code,409)          # limit
            self.assertEqual(self.dom(second,domain='a.example.org').status_code,409)         # one owner per domain
            self.assertEqual(self.dom(second,domain=first['domain']).status_code,422)         # a platform address is never a custom domain

    def test_domains_wait_until_the_site_is_installed(self):
        response,_=self.create()
        with patch('app.routes.site.ServerController.proxy_node',return_value=SimpleNamespace(ip_address='203.0.113.7')):
            self.assertEqual(self.dom(response.json,domain='erp.acme.com').status_code,409)

    def test_the_proxy_routes_every_active_custom_domain_and_only_those(self):
        import inspect
        from app.services import proxy_configuration_service as module
        source=inspect.getsource(module)
        self.assertIn("SiteDomain.status == 'active'",source)
        self.assertIn("'host': hosts",source)

    def test_admin_detail_gathers_everything_an_operator_needs(self):
        site=self.make_ready()
        with database.session() as session:
            session.execute(text("INSERT INTO site_backups (id,site_id,stamp,kind) VALUES (gen_random_uuid(),:i,'20261015_101010','scheduled')"),{'i':site['id']})
            session.execute(text("INSERT INTO site_domains (id,site_id,domain,status) VALUES (gen_random_uuid(),:i,'erp.acme.example','active')"),{'i':site['id']})
        self.act(site,'stop')
        with patch('app.tasks.site_tasks.build_service') as build:
            self.mock_snapshot(build,site)
            site_action_task.run(site['id'],'stop','ready')
        detail=self.client.get(f"/api/v1/sites/admin/{site['id']}").json
        self.assertEqual(detail['site']['owner_account_email'],self.customer+'@example.test')
        self.assertEqual(detail['server']['id'],str(self.worker))
        self.assertEqual([d['domain'] for d in detail['domains']],['erp.acme.example'])
        self.assertEqual([(b['stamp'],b['kind']) for b in detail['backups']],[('20261015_101010','scheduled')])
        self.assertEqual(detail['operations'][0]['kind'],'site.stop')
        self.assertEqual(self.client.get('/api/v1/sites/admin/not-a-uuid').status_code,404)
        self.cleanup_logs(site)

    def test_admin_actions_work_on_any_customers_site_and_obey_the_same_rules(self):
        site=self.make_ready()
        admin=lambda action:self.client.post(f"/api/v1/sites/admin/{site['id']}/actions/{action}",json={})
        self.assertEqual(admin('start').status_code,409)                 # same state rules as the customer's
        self.assertEqual(admin('explode').status_code,404)
        self.assertEqual(admin('stop').status_code,202)                  # no ownership needed
        self.assertEqual(self.get(site)['status'],'stopping')
        self.assertEqual(admin('restart').status_code,409)
        self.assertEqual(self.client.post("/api/v1/sites/admin/00000000-0000-0000-0000-000000000000/actions/stop",json={}).status_code,404)

    def test_admin_usage_uses_the_site_service(self):
        site=self.make_ready()
        with patch('app.routes.site.build_service') as build:
            build.return_value.usage.return_value={'cpu_percent':1,'memory_mb':2,'memory_limit_mb':3,'storage_mb':4}
            self.assertEqual(self.client.get(f"/api/v1/sites/admin/{site['id']}/usage").json['storage_mb'],4)

    def set_max_sites(self,value):
        with database.session() as session:
            session.execute(text('UPDATE server_nodes SET max_sites=:v WHERE id=:i'),{'v':value,'i':self.worker})

    def test_a_server_stops_taking_sites_at_its_site_limit_and_customers_are_told_why(self):
        self.roomy(); small=dict(plan_ram_mb=1024,plan_vcpu=0.5)
        self.set_max_sites(2)
        first=self.create(**small)[0]; second=self.create(**small)[0]
        self.assertEqual((first.status_code,second.status_code),(201,201))
        third=self.create(**small)[0]
        self.assertEqual(third.status_code,409)
        self.assertIn('full capacity',third.json['error'])
        self.assertIn('check back',third.json['error'])
        self.assertFalse(self.client.get('/api/v1/sites/capabilities').json['accepting'])
        # a deleted site frees its place
        with database.session() as session:
            session.execute(text("DELETE FROM sites WHERE id=:i"),{'i':first.json['id']})
        self.assertTrue(self.client.get('/api/v1/sites/capabilities').json['accepting'])
        self.assertEqual(self.create(**small)[0].status_code,201)

    def test_no_limit_means_unlimited_and_zero_means_none(self):
        self.roomy(); small=dict(plan_ram_mb=1024,plan_vcpu=0.25)
        self.set_max_sites(None)
        self.assertTrue(self.client.get('/api/v1/sites/capabilities').json['accepting'])
        for _ in range(3): self.assertEqual(self.create(**small)[0].status_code,201)      # no per-customer cap any more
        self.set_max_sites(0)
        self.assertFalse(self.client.get('/api/v1/sites/capabilities').json['accepting'])
        self.assertEqual(self.create(**small)[0].status_code,409)

    def test_the_site_limit_holds_even_when_the_dev_capacity_checks_are_off(self):
        self.roomy(); self.config.frappe_enforce_capacity=False
        self.set_max_sites(0)
        self.assertEqual(self.create(plan_ram_mb=1024)[0].status_code,409)

    def test_a_deactivated_site_does_not_count_and_cannot_come_back_into_a_full_server(self):
        self.roomy(); small=dict(plan_ram_mb=1024,plan_vcpu=0.5)
        self.set_max_sites(1)
        site=self.create(**small)[0].json
        with database.session() as session:
            session.execute(text("UPDATE sites SET status='deactivated' WHERE id=:i"),{'i':site['id']})
        self.assertEqual(self.create(**small)[0].status_code,201)        # the deactivated site freed the only place
        self.assertEqual(self.act(site,'reactivate').status_code,409)    # ... so it has to wait for room

    def test_queue_status_says_when_nothing_is_processing_operations(self):
        with patch('app.tasks.celery_app.celery_app.control.ping',return_value=[]):
            down=self.client.get('/api/v1/sites/admin/queue').json
        self.assertEqual(down['workers'],0)
        with patch('app.tasks.celery_app.celery_app.control.ping',return_value=[{'celery@host':{'ok':'pong'}}]):
            up=self.client.get('/api/v1/sites/admin/queue').json
        self.assertEqual(up['workers'],1)
        self.assertIn('sites_waiting',up)
        with patch('app.tasks.celery_app.celery_app.control.ping',side_effect=OSError('broker down')):
            self.assertEqual(self.client.get('/api/v1/sites/admin/queue').json['workers'],0)   # an unreachable broker counts as no worker

    def test_a_trial_plan_starts_a_trial_once_per_customer(self):
        from app.models.site_extras import SiteTrial
        plan = 'trial-plan-' + uuid.uuid4().hex[:6]
        small = {'plan_vcpu': 0.5, 'plan_ram_mb': 768, 'plan_storage_gb': 1}      # three sites must fit on the test worker
        with database.session() as session:
            session.execute(text('UPDATE server_nodes SET max_containers = 40 WHERE id = :id'), {'id': self.worker})
        try:
            first, _ = self.create(plan_id=plan, trial_days=14, **small)
            self.assertEqual(first.status_code, 201, first.json)
            self.assertEqual((first.json['trial']['days_left'], first.json['trial']['expired']), (14, False))
            again, _ = self.create(plan_id=plan, trial_days=14, **small)
            self.assertEqual(again.status_code, 409)
            self.assertIn('already used the free trial', again.json['error'])
            paid, _ = self.create(plan_id=plan, **small)                         # no trial requested: an ordinary site
            self.assertEqual(paid.status_code, 201)
            self.assertIsNone(paid.json['trial'])
        finally:
            with database.session() as session:
                session.execute(delete(SiteTrial).where(SiteTrial.user_id == self.customer))

    def test_trial_length_is_validated_and_a_failed_queue_gives_the_trial_back(self):
        from app.models.site_extras import SiteTrial
        for days in (0, -3, 5000, 'many', True):
            self.assertEqual(self.create(plan_id='plan-v', trial_days=days)[0].status_code, 422, days)
        self.queue_mock.side_effect = OSError('redis down')
        failed, _ = self.create(plan_id='plan-q', trial_days=7, plan_vcpu=0.5, plan_ram_mb=768, plan_storage_gb=1)
        self.assertEqual(failed.status_code, 409)
        self.queue_mock.side_effect = None
        with database.session() as session:
            self.assertEqual(session.scalars(select(SiteTrial).where(SiteTrial.user_id == self.customer)).all(), [])
        self.assertEqual(self.create(plan_id='plan-q', trial_days=7, plan_vcpu=0.5, plan_ram_mb=768, plan_storage_gb=1)[0].status_code, 201)       # and they can still use it
        with database.session() as session:
            session.execute(delete(SiteTrial).where(SiteTrial.user_id == self.customer))

    def test_slug_check(self):
        taken,_=self.create(slug='taken-'+uuid.uuid4().hex[:8])
        self.assertEqual(taken.status_code,201)
        check=lambda slug:self.client.get('/api/v1/sites/check-slug?slug='+slug).json
        self.assertFalse(check(taken.json['slug'])['available'])
        self.assertFalse(check('admin')['available'])
        self.assertFalse(check('A!')['available'])
        self.assertTrue(check('free-'+uuid.uuid4().hex[:8])['available'])

    def test_parallel_requests_do_not_overcommit_worker(self):
        def request_site(_index):
            with self.client.application.test_client() as client:
                return client.post('/api/v1/sites', json={'user_id': self.customer, 'name': 'Concurrent test', 'slug': 'parallel-' + uuid.uuid4().hex[:12], 'request_key': str(uuid.uuid4()), 'app_names': [], 'company_name': 'Acme Ltd', 'country': 'Pakistan', 'currency': 'PKR', 'coa_type': 'standard', 'owner_email': 'owner@example.test', 'owner_password': 'Owner-password-123', 'plan_id': 'plan-1', 'plan_name': 'Starter'}).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(request_site, [0, 1])), [201, 409])

    SMALL = {'plan_vcpu': 0.25, 'plan_ram_mb': 768, 'plan_storage_gb': 1}

    def port_of(self, response):
        self.assertEqual(response.status_code, 201, response.json)
        with database.session() as session:
            return session.scalar(select(Site.port).where(Site.id == uuid.UUID(response.json['id'])))

    def test_ports_in_use_by_other_processes_are_skipped(self):
        start = self.config.frappe_port_start
        self.node.listening_ports.return_value = {start, start + 1}
        response, _ = self.create(**self.SMALL)
        self.assertEqual(self.port_of(response), start + 2)

    def test_port_taken_after_the_listing_is_skipped(self):
        start = self.config.frappe_port_start
        self.node.port_in_use.side_effect = lambda port: port == start
        response, _ = self.create(**self.SMALL)
        self.assertEqual(self.port_of(response), start + 1)

    def test_a_port_given_to_one_site_is_never_given_to_another(self):
        self.roomy()
        first, _ = self.create(**self.SMALL)
        second, _ = self.create(**self.SMALL)
        self.assertNotEqual(self.port_of(first), self.port_of(second))

    def test_no_free_port_is_reported_clearly(self):
        start = self.config.frappe_port_start
        self.config.frappe_port_end = start
        self.node.listening_ports.return_value = {start}
        try:
            response, _ = self.create(**self.SMALL)
        finally:
            self.config.frappe_port_end = settings.frappe_port_end
        self.assertEqual(response.status_code, 409)
        self.assertIn('No free port is available', response.json['error']['message'] if isinstance(response.json.get('error'), dict) else str(response.json))

    def test_parallel_requests_get_different_ports(self):
        self.roomy()
        def request_site(_index):
            with self.client.application.test_client() as client:
                response = client.post('/api/v1/sites', json={'user_id': self.customer, 'name': 'Ports', 'slug': 'ports-' + uuid.uuid4().hex[:12], 'request_key': str(uuid.uuid4()), 'app_names': [], 'company_name': 'Acme Ltd', 'country': 'Pakistan', 'currency': 'PKR', 'coa_type': 'standard', 'owner_email': 'owner@example.test', 'owner_password': 'Owner-password-123', 'plan_id': 'plan-1', 'plan_name': 'Starter', **self.SMALL})
                return response.status_code, (response.json or {}).get('id')
        with ThreadPoolExecutor(max_workers=5) as pool:
            results = list(pool.map(request_site, range(5)))
        self.assertEqual([code for code, _ in results], [201] * 5)
        with database.session() as session:
            ports = [session.scalar(select(Site.port).where(Site.id == uuid.UUID(site_id))) for _, site_id in results]
        self.assertEqual(len(set(ports)), 5)

    def test_queue_failure_releases_the_reservation(self):
        self.queue_mock.side_effect=RuntimeError('Queue unavailable')
        response,data=self.create()
        self.assertEqual(response.status_code,409)
        with database.session() as session:
            self.assertEqual(session.scalar(text("SELECT count(*) FROM sites WHERE slug=:s"),{'s':data['slug']}),0)
        # the same name is immediately usable again
        self.queue_mock.side_effect=None
        again,_=self.create(slug=data['slug'])
        self.assertEqual(again.status_code,201,again.json)

    def test_retry_bumps_attempt_and_missing_setup_is_explained(self):
        from app.services.frappe_service import SetupUnavailable
        response,_=self.create()
        site_id=response.json['id']
        self.assertEqual(response.json['attempt'],1)
        with patch('app.tasks.site_tasks.build_service') as build, patch('app.tasks.site_tasks.notify_site_task.delay'):
            self.mock_snapshot(build,response.json)
            build.return_value.prepare.side_effect=SetupUnavailable('The site setup details are no longer available. Delete this site and create it again.')
            provision_site_task.run(site_id)
        failed=self.client.get(f'/api/v1/sites/{site_id}?user_id={self.customer}').json
        self.assertEqual(failed['status'],'failed')
        self.assertIn('create it again',failed['error'])
        self.assertEqual(self.client.post(f'/api/v1/sites/{site_id}/retry',json={'user_id':self.customer}).status_code,202)
        self.assertEqual(self.client.get(f'/api/v1/sites/{site_id}?user_id={self.customer}').json['attempt'],2)
        with database.session() as session:
            session.execute(text("DELETE FROM activity_logs WHERE tenant_slug=:s"),{'s':response.json['slug']})
            session.execute(text("DELETE FROM operations WHERE tenant_slug=:s"),{'s':response.json['slug']})

    def test_a_dead_worker_does_not_leave_a_site_stuck(self):
        site=self.make_ready()
        self.assertEqual(self.act(site,'stop').status_code,202)
        site_action_task.on_failure(RuntimeError('worker lost'),'t',[site['id'],'stop'],{},None)
        after=self.client.get(f"/api/v1/sites/{site['id']}?user_id={self.customer}").json
        self.assertEqual(after['status'],'ready')
        self.assertEqual(self.act(site,'backup').status_code,202)
        site_action_task.on_failure(RuntimeError('worker lost'),'t',[site['id'],'backup'],{},None)
        self.assertIsNone(self.client.get(f"/api/v1/sites/{site['id']}?user_id={self.customer}").json['activity'])

    def test_stopped_sites_keep_their_proxy_route(self):
        import inspect
        from app.services import proxy_configuration_service
        source=inspect.getsource(proxy_configuration_service)
        for status in ('stopping','stopped','restarting'):
            self.assertIn(f"'{status}'",source)

    def test_pipeline_ready_and_notification(self):
        response,_=self.create()
        site_id=response.json['id']
        with patch('app.tasks.site_tasks.build_service') as service, patch('app.tasks.site_tasks.ProxyConfigurationService') as proxy, patch('app.tasks.site_tasks.notify_site_task.delay') as notify:
            self.mock_snapshot(service, response.json)
            service.return_value.healthy.return_value=True
            provision_site_task.run(site_id)
            result=self.client.get('/api/v1/sites/'+site_id+'?user_id='+self.customer)
            self.assertEqual(result.json['status'],'ready')
            self.assertEqual(result.json['progress'],100)
            proxy.return_value.sync_all.assert_called_once()
            notify.assert_any_call(site_id, 'started')
            notify.assert_any_call(site_id, 'milestone')
            notify.assert_called_with(site_id, 'ready')
            self.assertEqual([step['state'] for step in result.json['steps']], ['done'] * 5)
            service.return_value.scrub_setup.assert_called_once()
            service.return_value.run.assert_any_call(['run','--rm','create-site'])

    def test_failed_cleanup_retains_capacity(self):
        response,_=self.create()
        site_id=response.json['id']
        with patch('app.tasks.site_tasks.build_service') as service, patch('app.tasks.site_tasks.ProxyConfigurationService'), patch('app.tasks.site_tasks.notify_site_task.delay'):
            self.mock_snapshot(service, response.json)
            service.return_value.run.side_effect=RuntimeError('SSH unavailable')
            provision_site_task.run(site_id)
            result=self.client.get('/api/v1/sites/'+site_id+'?user_id='+self.customer)
            self.assertEqual(result.json['status'],'cleanup_required')
            self.assertIn('Deployment stopped', result.json['error'])
            with database.session() as session:
                from app.models.activity import Operation, ActivityLog
                from sqlalchemy import select
                slug = result.json['slug']
                op = session.scalar(select(Operation).where(Operation.kind == 'site.provision', Operation.tenant_slug == slug))
                self.assertEqual(op.status, 'failed')
                self.assertIn('Traceback', op.error_message)
                self.assertIn('SSH unavailable', op.error_message)
                step = session.scalar(select(ActivityLog).where(ActivityLog.operation_id == op.id, ActivityLog.status == 'failed'))
                self.assertIn('Traceback', step.details['traceback'])
                session.execute(text('DELETE FROM activity_logs WHERE operation_id=:i'), {'i': op.id})
                session.execute(text('DELETE FROM operations WHERE id=:i'), {'i': op.id})
            retried=self.client.post('/api/v1/sites/'+site_id+'/retry',json={'user_id':self.customer})
            self.assertEqual(retried.status_code,409)

    def test_successful_cleanup_allows_retry(self):
        response, _ = self.create()
        site_id = response.json['id']
        with patch('app.tasks.site_tasks.build_service') as service, patch('app.tasks.site_tasks.ProxyConfigurationService'), patch('app.tasks.site_tasks.notify_site_task.delay'):
            self.mock_snapshot(service, response.json)
            service.return_value.run.side_effect = [RuntimeError('Pull failed'), None]
            provision_site_task.run(site_id)
        result = self.client.get('/api/v1/sites/' + site_id + '?user_id=' + self.customer)
        self.assertEqual(result.json['status'], 'failed')
        self.assertEqual(result.json['steps'][0]['state'], 'failed')
        retry = self.client.post('/api/v1/sites/' + site_id + '/retry', json={'user_id': self.customer})
        self.assertEqual(retry.status_code, 202)

if __name__ == '__main__':
    unittest.main()
