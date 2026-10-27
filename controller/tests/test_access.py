import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.services.frappe_service import ROLES_SCRIPT, FrappeService


def service():
    site = SimpleNamespace(
        id='00000000-0000-0000-0000-00000000000a', image='i', db_password='b', admin_password='a', domain='m.example.test',
        port=30010, app_names=['erpnext'], memory_limit_mb=4096, cpu_limit=2.0,
    )
    with patch('app.services.frappe_service.SSHService'):
        target = FrappeService(site, SimpleNamespace(dial_host='10.0.0.5', cpu_cores=4), SimpleNamespace(), None, None)
    target.ssh = MagicMock()
    return target


def reply(stdout, ok=True):
    return SimpleNamespace(ok=ok, stdout=stdout, stderr='', exit_code=0 if ok else 7)


class AccessTests(unittest.TestCase):
    def test_a_successful_login_returns_the_session_id_and_sends_credentials_on_stdin_only(self):
        target = service()
        target.ssh.run.return_value = reply('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nSet-Cookie: sid=abc123; Expires=x; HttpOnly\r\nSet-Cookie: user_id=a%40b.co\r\n\r\n{"message":"Logged In"}')
        self.assertEqual(target.login_sid('a@b.co', 'p@ss w&rd=1'), 'abc123')
        command = target.ssh.run.call_args.args[0]
        self.assertIn('http://10.0.0.5:30010/api/method/login', command)
        self.assertNotIn('p@ss', command)
        self.assertEqual(target.ssh.run.call_args.kwargs['stdin_data'], 'usr=a%40b.co&pwd=p%40ss+w%26rd%3D1')

    def test_a_refused_login_or_a_guest_session_gives_nothing(self):
        for body in (
            'HTTP/1.1 401 UNAUTHORIZED\r\nSet-Cookie: sid=Guest\r\n\r\n{}',
            'HTTP/1.1 200 OK\r\nSet-Cookie: sid=Guest; Path=/\r\n\r\n{}',
            'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n',
        ):
            target = service()
            target.ssh.run.return_value = reply(body)
            self.assertIsNone(target.login_sid('a@b.co', 'x' * 12), body)

    def test_an_unreachable_site_is_an_error_not_a_refusal(self):
        target = service()
        target.ssh.run.return_value = reply('', ok=False)
        with self.assertRaises(RuntimeError):
            target.login_sid('a@b.co', 'x' * 12)

    def test_the_roles_step_leaves_the_customer_with_exactly_the_plans_roles(self):
        self.assertIn("user.set('roles', [])", ROLES_SCRIPT)
        self.assertNotIn("user.append('roles', {'role': 'System Manager'", ROLES_SCRIPT)


class DatabaseServerTests(unittest.TestCase):
    def test_a_site_uses_the_default_cluster_else_the_oldest_one_else_its_own_container(self):
        from app.routes.site import SitesView
        default, oldest = object(), object()
        session = MagicMock()
        session.scalar.side_effect = [default]
        self.assertIs(SitesView.pick_db_server(session, None), default)
        session.scalar.side_effect = [None, oldest]
        self.assertIs(SitesView.pick_db_server(session, None), oldest)
        session.scalar.side_effect = [None, None]
        self.assertIsNone(SitesView.pick_db_server(session, None))


if __name__ == '__main__':
    unittest.main()
