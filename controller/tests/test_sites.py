import unittest
from types import SimpleNamespace
from unittest.mock import patch, MagicMock
from sqlalchemy.dialects import postgresql
from app.routes.site import fits_site, owned_site, serialize
from app.errors import NotFoundError
from app.services.frappe_service import FrappeService
from app.controller.server import ServerController
from app.models.site import Site
from app.models.platform import PRISMA_OWNED_TABLES

class SiteProvisioningTests(unittest.TestCase):
    def setUp(self):
        self.node = SimpleNamespace(is_active=True, role='worker', frappe_enabled=True, last_check_status='ok', max_containers=30, max_memory_mb=16384, disk_total_gb=80, disk_used_gb=20)
        self.settings = SimpleNamespace(node_memory_reserve_mb=1024)

    def test_capacity_reserves_full_stack(self):
        self.assertTrue(fits_site(self.node, 10, 6144, 1, self.settings))
        self.assertFalse(fits_site(self.node, 21, 6144, 1, self.settings))
        self.assertFalse(fits_site(self.node, 10, 12000, 1, self.settings))

    def test_only_healthy_opted_in_workers(self):
        for field, value in [('is_active',False), ('role','proxy'), ('frappe_enabled',False), ('last_check_status','unreachable')]:
            with patch.object(self.node, field, value):
                self.assertFalse(fits_site(self.node, 0, 0, 0, self.settings))

    def test_disk_reservations_and_unknown_capacity(self):
        self.assertFalse(fits_site(self.node, 0, 0, 6, self.settings))
        self.node.disk_used_gb = None
        self.assertFalse(fits_site(self.node, 0, 0, 0, self.settings))

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
