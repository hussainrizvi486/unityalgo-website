"""The database check that runs when the API server, worker or scheduler starts."""
import copy
import io
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import patch
from app.config import settings
from app.db import Database, diagnose_connection_error
from main import ControllerCLI


def unreachable():
    config = copy.copy(settings)
    config.database_url = 'postgresql://nobody:secret@127.0.0.1:1/missing'
    config.postgres_connect_timeout = 1
    return Database(config)


class DiagnosisTests(unittest.TestCase):
    def test_each_kind_of_failure_gets_its_own_advice(self):
        cases = {
            'FATAL:  password authentication failed for user "x"': 'username or password',
            'FATAL:  database "foo" does not exist': 'no database with that name',
            'FATAL:  role "bob" does not exist': 'user in DATABASE_URL does not exist',
            'connection to server at "localhost", port 5432 failed: Connection refused': 'Nothing is accepting connections',
            'could not translate host name "nope" to address: Name or service not known': 'could not be resolved',
            'FATAL:  no pg_hba.conf entry for host': 'pg_hba.conf',
            'FATAL:  sorry, too many connections already': 'out of connections',
        }
        for message, expected in cases.items():
            self.assertIn(expected, diagnose_connection_error(Exception(message)), message)

    def test_an_unknown_failure_still_says_something(self):
        self.assertIn('does not recognise', diagnose_connection_error(Exception('something odd')))


class MigrationOrderTests(unittest.TestCase):
    def test_controller_migrations_wait_for_the_website_tables(self):
        from unittest.mock import patch
        from app.db import Database, MigrationOrderError
        database = Database(copy.copy(settings))
        with patch.object(Database, 'missing_website_tables', return_value=['User']), patch('app.db.command.upgrade') as upgrade:
            with self.assertRaises(MigrationOrderError) as caught:
                database.migrate()
        self.assertIn('npm run db:migrate', str(caught.exception))
        upgrade.assert_not_called()

    def test_the_cli_explains_instead_of_a_traceback(self):
        from unittest.mock import patch
        from app.db import MigrationOrderError
        cli = ControllerCLI(db=unreachable())
        err = io.StringIO()
        with patch.object(cli.db, 'migrate', side_effect=MigrationOrderError('run the website migrations first')), redirect_stderr(err):
            self.assertEqual(cli.migrate(), 1)
        self.assertIn('website migrations first', err.getvalue())

    def test_the_local_database_has_the_website_tables(self):
        from app.db import database
        self.assertEqual(database.missing_website_tables(), [])


class StartupCheckTests(unittest.TestCase):
    def test_a_reachable_database_passes(self):
        from app.db import database
        ok, lines = database.startup_check()
        self.assertTrue(ok, lines)
        self.assertIn('Database connection OK', lines[0])

    def test_no_connection_is_left_open_for_forked_workers(self):
        from app.db import database
        database.startup_check()
        self.assertEqual(database.engine.pool.checkedin(), 0)

    def test_the_password_is_never_printed(self):
        with patch('app.db.CONNECT_BACKOFF_SECONDS', (0.0,)):
            ok, lines = unreachable().startup_check()
        self.assertFalse(ok)
        text = '\n'.join(lines)
        self.assertNotIn('secret', text)
        self.assertIn('FAILED', lines[0])
        self.assertIn('diagnosis:', text)

    def run_cli(self, mode):
        out, err = io.StringIO(), io.StringIO()
        with patch('app.db.CONNECT_BACKOFF_SECONDS', (0.0,)), patch.dict('os.environ', {'DB_STARTUP_CHECK': mode}):
            cli = ControllerCLI(db=unreachable())
            with redirect_stdout(out), redirect_stderr(err):
                code = cli.check_database('worker')
        return code, err.getvalue()

    def test_an_unreachable_database_stops_startup(self):
        code, message = self.run_cli('strict')
        self.assertEqual(code, 1)
        self.assertIn('was not started', message)

    def test_warn_mode_starts_anyway(self):
        code, message = self.run_cli('warn')
        self.assertIsNone(code)
        self.assertIn('starting the worker anyway', message)

    def test_the_check_can_be_switched_off(self):
        code, message = self.run_cli('off')
        self.assertIsNone(code)
        self.assertEqual(message, '')


if __name__ == '__main__':
    unittest.main()
