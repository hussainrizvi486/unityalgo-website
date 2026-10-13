"""Local database integration tests. SSH, Docker, Caddy and Celery are mocked."""
import json
import uuid
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch
from flask import Flask
from sqlalchemy import delete, text
from app.db import database
from app.config import settings
from app.models.site import Site
from app.models.server import ServerNode
from app.routes.site import SiteRoutes, fits_site
from app.errors import ApiError
from app.tasks.site_tasks import provision_site_task

class SiteApiTests(unittest.TestCase):
    def setUp(self):
        self.customer = 'portal-test-' + uuid.uuid4().hex
        self.worker = uuid.uuid4()
        config = SimpleNamespace(**vars(settings))
        config.frappe_site_domain = 'sites.example.test'
        config.frappe_available_apps = ['erpnext','lending']
        self.config = config
        app = Flask(__name__)
        app.register_blueprint(SiteRoutes.blueprint(db=database,config=config))
        app.register_error_handler(ApiError,lambda error: (error.to_dict(),error.status_code))
        self.client = app.test_client()
        with database.session() as session:
            session.execute(text('INSERT INTO "User" (id,email,"passwordHash",role,"createdAt","updatedAt") VALUES (:id,:email,:password,\'CUSTOMER\',now(),now())'),{'id':self.customer,'email':self.customer+'@example.test','password':'test-only'})
            session.add(ServerNode(id=self.worker,name=self.customer,ip_address='127.0.0.1',role='worker',frappe_enabled=True,is_active=True,last_check_status='ok',max_memory_mb=8192,max_containers=10,disk_total_gb=80,disk_used_gb=10))
        self.proxy = patch('app.routes.site.ServerController.proxy_node',return_value=SimpleNamespace(name='test-proxy'))
        self.proxy.start()
        self.queue = patch('app.tasks.site_tasks.provision_site_task.apply_async')
        self.queue_mock = self.queue.start()
        self.placement = patch('app.routes.site.fits_site', side_effect=lambda node, *args: node.id == self.worker and fits_site(node, *args))
        self.placement.start()

    def tearDown(self):
        self.queue.stop(); self.proxy.stop()
        self.placement.stop()
        with database.session() as session:
            session.execute(delete(Site).where(Site.user_id == self.customer))
            session.execute(delete(ServerNode).where(ServerNode.id == self.worker))
            session.execute(text('DELETE FROM "User" WHERE id=:id'),{'id':self.customer})

    def create(self, **overrides):
        data={'user_id':self.customer,'name':'Test workspace','slug':'portal-'+uuid.uuid4().hex[:12], 'admin_password':'Test-password-12345','request_key':str(uuid.uuid4()),'app_names':['erpnext']}
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

    def test_parallel_requests_do_not_overcommit_worker(self):
        def request_site(_index):
            with self.client.application.test_client() as client:
                return client.post('/api/v1/sites', json={'user_id': self.customer, 'name': 'Concurrent test', 'slug': 'parallel-' + uuid.uuid4().hex[:12], 'admin_password': 'Test-password-12345', 'request_key': str(uuid.uuid4()), 'app_names': []}).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(request_site, [0, 1])), [201, 409])

    def test_queue_failure_is_visible_and_retryable(self):
        self.queue_mock.side_effect=RuntimeError('Queue unavailable')
        response,_=self.create()
        self.assertEqual(response.status_code,201)
        self.assertEqual(response.json['status'],'failed')
        self.queue_mock.side_effect=None
        retried=self.client.post('/api/v1/sites/'+response.json['id']+'/retry',json={'user_id':self.customer})
        self.assertEqual(retried.status_code,202)

    def test_pipeline_ready_and_notification(self):
        response,_=self.create()
        site_id=response.json['id']
        with patch('app.tasks.site_tasks.FrappeService') as service, patch('app.tasks.site_tasks.ProxyConfigurationService') as proxy, patch('app.tasks.site_tasks.notify_site_task.delay') as notify:
            service.return_value.healthy.return_value=True
            provision_site_task.run(site_id)
            result=self.client.get('/api/v1/sites/'+site_id+'?user_id='+self.customer)
            self.assertEqual(result.json['status'],'ready')
            self.assertEqual(result.json['progress'],100)
            proxy.return_value.sync_all.assert_called_once()
            notify.assert_called_once_with(site_id)
            service.return_value.run.assert_any_call(['run','--rm','create-site'])

    def test_failed_cleanup_retains_capacity(self):
        response,_=self.create()
        site_id=response.json['id']
        with patch('app.tasks.site_tasks.FrappeService') as service, patch('app.tasks.site_tasks.ProxyConfigurationService'), patch('app.tasks.site_tasks.notify_site_task.delay'):
            service.return_value.run.side_effect=RuntimeError('SSH unavailable')
            provision_site_task.run(site_id)
            result=self.client.get('/api/v1/sites/'+site_id+'?user_id='+self.customer)
            self.assertEqual(result.json['status'],'cleanup_required')
            retried=self.client.post('/api/v1/sites/'+site_id+'/retry',json={'user_id':self.customer})
            self.assertEqual(retried.status_code,409)

    def test_successful_cleanup_allows_retry(self):
        response, _ = self.create()
        site_id = response.json['id']
        with patch('app.tasks.site_tasks.FrappeService') as service, patch('app.tasks.site_tasks.ProxyConfigurationService'), patch('app.tasks.site_tasks.notify_site_task.delay'):
            service.return_value.run.side_effect = [RuntimeError('Pull failed'), None]
            provision_site_task.run(site_id)
        result = self.client.get('/api/v1/sites/' + site_id + '?user_id=' + self.customer)
        self.assertEqual(result.json['status'], 'failed')
        retry = self.client.post('/api/v1/sites/' + site_id + '/retry', json={'user_id': self.customer})
        self.assertEqual(retry.status_code, 202)

if __name__ == '__main__':
    unittest.main()
