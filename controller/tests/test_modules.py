import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.errors import ValidationError
from app.routes.site import parse_modules
from app.services.frappe_service import DOMAIN_SCRIPT, INSTALL_SCRIPT, FrappeService


def service(setup=None):
    site = SimpleNamespace(
        id='00000000-0000-0000-0000-000000000009', image='i', db_password='b', admin_password='a', domain='m.example.test',
        port=30009, app_names=['erpnext'], memory_limit_mb=4096, cpu_limit=2.0,
    )
    with patch('app.services.frappe_service.SSHService'):
        return FrappeService(site, SimpleNamespace(dial_host='h', cpu_cores=4), SimpleNamespace(), setup, None)


class ModuleTests(unittest.TestCase):
    def test_module_names_are_validated_and_deduplicated(self):
        self.assertEqual(parse_modules(None), [])
        self.assertEqual(parse_modules(''), [])
        self.assertEqual(parse_modules([' Manufacturing ', 'Selling', 'Manufacturing']), ['Manufacturing', 'Selling'])
        for bad in ('Selling', [''], ['; rm -rf /'], [1], ['x' * 61], ['Ok'] * 0 + [None], ['a'] * 101):
            with self.assertRaises(ValidationError):
                parse_modules(bad)

    def test_domain_script_follows_the_agreed_logic(self):
        compile(DOMAIN_SCRIPT, 'domain-script', 'exec')
        order = [
            "frappe.db.set_value('Module Def', {}, 'restrict_to_domain', '')",
            "DEFAULT_DOMAIN = 'Subscription'",
            "frappe.db.exists('Domain', DEFAULT_DOMAIN)",
            "frappe.db.set_value('Module Def', module, 'restrict_to_domain', DEFAULT_DOMAIN)",
            "settings = frappe.get_doc('Domain Settings')",
            "settings.set('active_domains', [])",
            "settings.append('active_domains', {'domain': DEFAULT_DOMAIN})",
            "frappe.db.commit()",
        ]
        positions = [DOMAIN_SCRIPT.index(step) for step in order]
        self.assertEqual(positions, sorted(positions), 'the steps run in the agreed order')

    def test_applying_modules_passes_them_and_reports_unknown_names(self):
        target = service()
        with patch.object(target, '_in_site', return_value='noise\nMODULES_MISSING=["Nope"]\n') as run:
            self.assertEqual(target.apply_modules(['Selling', 'Nope']), ['Nope'])
        self.assertEqual(run.call_args.args[0], DOMAIN_SCRIPT)
        self.assertEqual(json.loads(run.call_args.kwargs['MODULES']), ['Selling', 'Nope'])
        with patch.object(target, '_in_site', return_value='no marker'):
            with self.assertRaises(RuntimeError):
                target.apply_modules([])

    def test_creation_runs_the_domain_step_only_when_modules_were_chosen(self):
        self.assertIn("os.environ.get('MODULES')", INSTALL_SCRIPT)
        base = {'company_name': 'c', 'country': 'x', 'currency': 'USD', 'coa_type': 'standard', 'owner_email': 'a@b.co', 'owner_password': 'p' * 12}
        env = service({**base, 'modules': ['Selling', 'Stock']}).compose()['services']['create-site']['environment']
        self.assertEqual(json.loads(env['MODULES']), ['Selling', 'Stock'])
        self.assertIn('frappe.db.set_value', env['DOMAIN_SCRIPT'])
        plain = service({**base, 'modules': []}).compose()['services']['create-site']['environment']
        self.assertNotIn('MODULES', plain); self.assertNotIn('DOMAIN_SCRIPT', plain)
        self.assertNotIn('MODULES', service().compose()['services']['create-site']['environment'])


if __name__ == '__main__':
    unittest.main()
