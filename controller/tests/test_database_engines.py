import unittest
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pymysql

from app.errors import QueryExecutionError, ValidationError
from app.services.database_connection_service import DatabaseConnectionService, PostgresDatabase
from app.services.query_values import jsonable
from app.services.mariadb_service import MariaDBService


class FakeCursor:
    def __init__(self, results=None, description=None, error=None):
        self.results, self.executed, self.description, self.error = list(results or []), [], description, error
        self.rowcount = 3

    def __enter__(self): return self
    def __exit__(self, *a): return False

    def execute(self, sql, params=None):
        self.executed.append((' '.join(sql.split()), params))
        if self.error and not sql.startswith('SET'):
            raise self.error

    def fetchall(self): return self.results.pop(0)
    def fetchmany(self, n): return self.results[0][:n]


def fake_connection(cursor):
    conn = MagicMock()
    conn.cursor.return_value = cursor
    return conn


class MariaDBConsoleTests(unittest.TestCase):
    def run_query(self, sql, cursor=None, **kwargs):
        cursor = cursor or FakeCursor(results=[[]], description=[('a',)])
        conn = fake_connection(cursor)
        with patch.object(MariaDBService, 'connect', return_value=conn):
            result = MariaDBService().execute_query('h', 3306, 'mysql', 'u', 'p', 'disable', sql, **kwargs)
        return result, cursor, conn

    def test_a_read_only_run_sets_a_read_only_session_before_the_statement(self):
        result, cursor, conn = self.run_query('SELECT 1')
        statements = [sql for sql, _ in cursor.executed]
        self.assertIn('SET SESSION TRANSACTION READ ONLY', statements)
        self.assertLess(statements.index('SET SESSION TRANSACTION READ ONLY'), statements.index('SELECT 1'))
        self.assertTrue(any(sql.startswith('SET SESSION max_statement_time') for sql in statements))
        conn.autocommit.assert_called_with(True)
        self.assertEqual(result['kind'], 'rows')

    def test_set_and_transaction_statements_are_refused_so_they_cannot_lift_read_only(self):
        for sql in ('SET SESSION TRANSACTION READ WRITE', 'set @@session.tx_read_only = 0', '  /* x */ START TRANSACTION',
                    'BEGIN', 'COMMIT', 'ROLLBACK', 'XA START 1'):
            with self.subTest(sql), self.assertRaises(QueryExecutionError):
                self.run_query(sql)

    def test_writes_run_without_the_read_only_flag_or_the_statement_check(self):
        _, cursor, conn = self.run_query('SET @a = 1', cursor=FakeCursor(description=None), allow_writes=True)
        statements = [sql for sql, _ in cursor.executed]
        self.assertNotIn('SET SESSION TRANSACTION READ ONLY', statements)
        self.assertIn('SET @a = 1', statements)

    def test_rows_are_capped_and_flagged_truncated(self):
        rows = [(i,) for i in range(5)]
        result, _, _ = self.run_query('SELECT a FROM t', cursor=FakeCursor(results=[rows], description=[('a',)]), max_rows=3)
        self.assertEqual((result['row_count'], result['truncated']), (3, True))

    def test_a_statement_that_returns_no_rows_reports_affected_rows(self):
        result, _, _ = self.run_query('UPDATE t SET a = 1', cursor=FakeCursor(description=None), allow_writes=True)
        self.assertEqual((result['kind'], result['affected_rows']), ('status', 3))

    def test_engine_errors_become_query_errors_with_the_servers_message(self):
        cursor = FakeCursor(description=[('a',)], error=pymysql.err.OperationalError(1792, 'Cannot execute statement in a READ ONLY transaction'))
        with self.assertRaisesRegex(QueryExecutionError, 'READ ONLY'):
            self.run_query('CREATE DATABASE x', cursor=cursor)

    def test_a_default_database_is_selected_unless_it_is_a_system_schema(self):
        _, _, conn = self.run_query('SELECT 1')
        conn.select_db.assert_not_called()                   # 'mysql' is a system schema
        conn = fake_connection(FakeCursor(results=[[]], description=[('a',)]))
        with patch.object(MariaDBService, 'connect', return_value=conn):
            MariaDBService().execute_query('h', 3306, 'shop', 'u', 'p', 'disable', 'SELECT 1')
        conn.select_db.assert_called_once_with('shop')

    def test_result_cells_that_json_cannot_hold_are_converted(self):
        self.assertEqual(jsonable(timedelta(hours=1, minutes=2)), '1:02:00')


class MariaDBSchemaTests(unittest.TestCase):
    def test_the_catalog_is_assembled_into_tables_columns_indexes_and_keys(self):
        cursor = FakeCursor(results=[
            [('shop', 'orders', 'BASE TABLE', 10, 100), ('shop', 'v_orders', 'VIEW', 0, 0)],
            [('shop', 'orders', 'id', 1, 'int(11)', 'NO', None, 'PRI'), ('shop', 'orders', 'user_id', 2, 'int(11)', 'YES', None, 'MUL')],
            [('shop', 'orders', 'user_idx', 1, 'BTREE', 'user_id')],
            [('shop', 'orders', 'fk_user', 'shop', 'users', 'user_id', 'id')],
        ])
        conn = fake_connection(cursor)
        with patch.object(MariaDBService, 'connect', return_value=conn):
            schema = MariaDBService().introspect('h', 3306, 'shop', 'u', 'p', 'disable')
        orders = next(t for t in schema['tables'] if t['name'] == 'orders')
        self.assertEqual([t['kind'] for t in schema['tables']], ['table', 'view'])
        self.assertTrue(orders['columns'][0]['is_primary_key'])
        self.assertEqual([c['nullable'] for c in orders['columns']], [False, True])
        # non_unique = 1, so the index is not marked UNIQUE
        self.assertEqual(orders['indexes'], [{'name': 'user_idx', 'definition': 'BTREE (user_id)'}])
        self.assertEqual(orders['foreign_keys'][0]['definition'], 'FOREIGN KEY (user_id) REFERENCES shop.users (id)')
        self.assertEqual(cursor.executed[0][0], 'START TRANSACTION READ ONLY')
        self.assertEqual(cursor.executed[1][1], ('shop',))   # one named database: only that one is read

    def test_a_system_database_shows_every_user_database_on_the_server(self):
        where, params = MariaDBService()._schema_filter('mysql')
        self.assertTrue(where.startswith('NOT IN'))
        self.assertEqual(params, MariaDBService.SYSTEM_SCHEMAS)
        self.assertEqual(MariaDBService()._schema_filter('shop'), ('= %s', ('shop',)))


class EngineDispatchTests(unittest.TestCase):

    def setUp(self):
        self.service = DatabaseConnectionService()

    def test_each_engine_is_handled_by_its_own_driver(self):
        self.assertIsInstance(self.service.driver('mariadb'), MariaDBService)
        self.assertIsInstance(self.service.driver('postgres'), PostgresDatabase)
        with self.assertRaises(ValidationError):
            self.service.driver('oracle')

    def test_test_introspect_and_query_are_routed_by_engine(self):
        args = ('h', 3306, 'db', 'u', 'p', 'disable')
        for engine, driver_class in (('mariadb', MariaDBService), ('postgres', PostgresDatabase)):
            with self.subTest(engine), patch.object(driver_class, 'test', return_value='v') as test, \
                    patch.object(driver_class, 'introspect', return_value={'tables': []}) as introspect, \
                    patch.object(driver_class, 'execute_query', return_value={'kind': 'status'}) as query:
                self.assertEqual(self.service.test(engine, *args), 'v')
                self.service.introspect(engine, *args, timeout_seconds=5)
                self.service.execute_query(engine, *args, 'SELECT 1', max_rows=3)
                test.assert_called_once_with(*args)
                introspect.assert_called_once_with(*args, timeout_seconds=5)
                query.assert_called_once_with(*args, 'SELECT 1', max_rows=3)

    def test_connect_uses_the_right_driver_and_picks_the_default_database_only_for_mariadb(self):
        conn = MagicMock()
        with patch.object(MariaDBService, 'connect', return_value=conn) as connect:
            self.assertIs(self.service.connect('mariadb', 'h', 3306, 'shop', 'u', 'p', 'disable'), conn)
            connect.assert_called_once_with('h', 3306, 'u', 'p', 'disable', connect_timeout=10)
            conn.select_db.assert_called_once_with('shop')
        with patch('app.services.database_connection_service.psycopg2.connect', return_value=conn) as pg:
            self.assertIs(self.service.connect('postgres', 'h', 5432, 'shop', 'u', 'p', 'prefer'), conn)
            self.assertEqual(pg.call_args.kwargs['dbname'], 'shop')


if __name__ == '__main__':
    unittest.main()
