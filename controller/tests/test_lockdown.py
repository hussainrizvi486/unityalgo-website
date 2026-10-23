import unittest
from types import SimpleNamespace
from unittest.mock import patch, MagicMock
from app.controller.server import ServerController
class LockdownTests(unittest.TestCase):
    def test_lockdown_covers_frappe_ports(self):
        settings = SimpleNamespace(tenant_port_range_start=20000, tenant_port_range_end=29999, frappe_port_start=30000, frappe_port_end=31999)
        ctrl = ServerController.__new__(ServerController)
        ctrl.settings = settings
        server = SimpleNamespace(role='worker', name='w', id='1')
        ctrl.get = lambda _id: server
        ctrl.proxy_node = lambda: SimpleNamespace(ip_address='9.9.9.9')
        ctrl.log_context = lambda s: {}
        op = MagicMock(); cm = MagicMock(); cm.__enter__.return_value = op; cm.__exit__.return_value = False
        ctrl.activity = SimpleNamespace(operation=lambda *a, **k: cm)
        ssh = MagicMock(); ssh.apply_tenant_port_firewall.return_value = [SimpleNamespace(ok=True)]
        ctrl.ssh = lambda s: ssh
        try: ctrl.apply_firewall_lockdown('1')
        except Exception as e: pass
        args = ssh.apply_tenant_port_firewall.call_args.args
        self.assertEqual(args[0], '9.9.9.9'); self.assertEqual((args[1], args[2]), (20000, 31999))
if __name__ == '__main__':
    unittest.main()
