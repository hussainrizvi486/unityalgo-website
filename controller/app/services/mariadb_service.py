import re
import time

import pymysql

from app.errors import DatabaseUnreachableError, QueryExecutionError
from app.services.query_values import jsonable


class MariaDBService:
    def connect(self, host, port, username, password, sslmode="disable", connect_timeout=10, read_timeout=None):
        try:
            return pymysql.connect(
                host=host, port=port, user=username, password=password,
                connect_timeout=connect_timeout, read_timeout=read_timeout or connect_timeout,
                ssl={'check_hostname': False} if sslmode and sslmode != 'disable' else None,
            )
        except pymysql.MySQLError as exc:
            raise DatabaseUnreachableError(f"Could not connect to {host}:{port}: {exc}") from exc

    def test(self, host, port, database_name, username, password, sslmode="disable"):
        conn = self.connect(host, port, username, password, sslmode)
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT VERSION()")
                (version,) = cur.fetchone()
                cur.execute("SHOW GRANTS")
                grants = ' '.join(row[0].upper() for row in cur.fetchall())
        except pymysql.MySQLError as exc:
            raise DatabaseUnreachableError(f"{host}:{port} connected but the check failed: {exc}") from exc
        finally:
            conn.close()
        full = 'ALL PRIVILEGES ON *.*' in grants and 'GRANT OPTION' in grants
        return version if full else (
            f"{version} -- warning: this account does not hold ALL PRIVILEGES ... WITH GRANT OPTION on *.*, "
            "which Frappe needs to create a database and user per site."
        )


    SYSTEM_SCHEMAS = ('information_schema', 'mysql', 'performance_schema', 'sys')

    _LIFTS_READ_ONLY = re.compile(r'^\s*(?:/\*.*?\*/\s*)*(?:SET|START|BEGIN|COMMIT|ROLLBACK|XA)\b', re.IGNORECASE | re.DOTALL)

    def use_database(self, conn, database_name):
        if database_name and database_name.lower() not in self.SYSTEM_SCHEMAS:
            conn.select_db(database_name)

    def _schema_filter(self, database_name):
        if database_name and database_name.lower() not in self.SYSTEM_SCHEMAS:
            return '= %s', (database_name,)
        marks = ', '.join(['%s'] * len(self.SYSTEM_SCHEMAS))
        return f'NOT IN ({marks})', self.SYSTEM_SCHEMAS

    def introspect(self, host, port, database_name, username, password, sslmode, timeout_seconds=30):
        conn = self.connect(host, port, username, password, sslmode, read_timeout=timeout_seconds)
        where, params = self._schema_filter(database_name)
        try:
            with conn.cursor() as cur:
                cur.execute('START TRANSACTION READ ONLY')
                cur.execute(
                    f"""SELECT table_schema, table_name, table_type, COALESCE(table_rows, 0),
                               COALESCE(data_length, 0) + COALESCE(index_length, 0)
                        FROM information_schema.tables
                        WHERE table_schema {where}
                        ORDER BY table_schema, table_name""", params)
                tables = [
                    {
                        'schema': schema, 'name': name,
                        'kind': 'view' if kind == 'VIEW' else 'table',
                        'estimated_rows': int(rows), 'size_bytes': int(size),
                        'columns': [], 'indexes': [], 'foreign_keys': [],
                    }
                    for schema, name, kind, rows, size in cur.fetchall()
                ]
                index = {(t['schema'], t['name']): t for t in tables}

                cur.execute(
                    f"""SELECT table_schema, table_name, column_name, ordinal_position, column_type,
                               is_nullable, column_default, column_key
                        FROM information_schema.columns
                        WHERE table_schema {where}
                        ORDER BY table_schema, table_name, ordinal_position""", params)
                for schema, table, column, position, ctype, nullable, default, key in cur.fetchall():
                    target = index.get((schema, table))
                    if target is not None:
                        target['columns'].append({
                            'name': column, 'position': position, 'type': ctype, 'nullable': nullable == 'YES',
                            'default': default, 'is_primary_key': key == 'PRI',
                        })

                cur.execute(
                    f"""SELECT table_schema, table_name, index_name, non_unique, index_type,
                               GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ', ')
                        FROM information_schema.statistics
                        WHERE table_schema {where}
                        GROUP BY table_schema, table_name, index_name, non_unique, index_type
                        ORDER BY table_schema, table_name, index_name""", params)
                for schema, table, name, non_unique, itype, columns in cur.fetchall():
                    target = index.get((schema, table))
                    if target is not None:
                        unique = 'UNIQUE ' if not non_unique else ''
                        target['indexes'].append({'name': name, 'definition': f'{unique}{itype} ({columns})'})

                cur.execute(
                    f"""SELECT table_schema, table_name, constraint_name, referenced_table_schema, referenced_table_name,
                               GROUP_CONCAT(column_name ORDER BY ordinal_position SEPARATOR ', '),
                               GROUP_CONCAT(referenced_column_name ORDER BY ordinal_position SEPARATOR ', ')
                        FROM information_schema.key_column_usage
                        WHERE table_schema {where} AND referenced_table_name IS NOT NULL
                        GROUP BY table_schema, table_name, constraint_name, referenced_table_schema, referenced_table_name
                        ORDER BY table_schema, table_name, constraint_name""", params)
                for schema, table, name, ref_schema, ref_table, columns, ref_columns in cur.fetchall():
                    target = index.get((schema, table))
                    if target is not None:
                        target['foreign_keys'].append({
                            'name': name,
                            'definition': f'FOREIGN KEY ({columns}) REFERENCES {ref_schema}.{ref_table} ({ref_columns})',
                        })
            return {'database': database_name, 'tables': tables}
        except pymysql.MySQLError as exc:
            raise DatabaseUnreachableError(f"Could not read the schema of {host}:{port}: {exc}") from exc
        finally:
            try:
                conn.rollback()
            except pymysql.MySQLError:
                pass
            conn.close()

    def execute_query(self, host, port, database_name, username, password, sslmode, sql,
                      timeout_seconds=30, max_rows=500, allow_writes=False):
        conn = self.connect(host, port, username, password, sslmode, read_timeout=timeout_seconds + 5)
        started = time.monotonic()
        try:
            with conn.cursor() as cur:
                self.use_database(conn, database_name)
                cur.execute(f'SET SESSION max_statement_time = {float(timeout_seconds)}')
                conn.autocommit(True)
                if not allow_writes:
                    if self._LIFTS_READ_ONLY.match(sql):
                        raise QueryExecutionError(
                            'This connection is read-only. SET and transaction statements are blocked so they '
                            'cannot undo that; allow writes on the connection to run them.')
                    cur.execute('SET SESSION TRANSACTION READ ONLY')
                try:
                    cur.execute(sql)
                except pymysql.MySQLError as exc:
                    raise QueryExecutionError(str(exc.args[-1] if exc.args else exc).strip()) from exc
                duration_ms = int((time.monotonic() - started) * 1000)
                if cur.description is None:
                    return {'kind': 'status', 'affected_rows': cur.rowcount, 'duration_ms': duration_ms}
                columns = [column[0] for column in cur.description]
                rows = cur.fetchmany(max_rows + 1)
                truncated = len(rows) > max_rows
                rows = rows[:max_rows]
                return {
                    'kind': 'rows', 'columns': columns,
                    'rows': [[jsonable(cell) for cell in row] for row in rows],
                    'row_count': len(rows), 'truncated': truncated, 'duration_ms': duration_ms,
                }
        finally:
            conn.close()


FRAPPE_DB_NAME = re.compile(r'^_[0-9a-f]{16}$')


def remove_site_database(host, port, username, password, name, sslmode="disable"):
    if not FRAPPE_DB_NAME.fullmatch(name or ''):
        raise ValueError('Refusing to drop a database that is not a Frappe site database.')
    conn = MariaDBService().connect(host, port, username, password, sslmode, read_timeout=600)
    removed = []
    try:
        with conn.cursor() as cur:
            cur.execute("SHOW DATABASES LIKE %s", (name,))
            if cur.fetchone():
                cur.execute(f"DROP DATABASE `{name}`")
                removed.append('database')
            # Frappe creates a login with the same name, for any host ('%' by default).
            cur.execute("SELECT host FROM mysql.user WHERE user = %s", (name,))
            for (user_host,) in cur.fetchall():
                cur.execute("DROP USER %s@%s", (name, user_host))
                removed.append(f'user@{user_host}')
        conn.commit()
    finally:
        conn.close()
    return removed
