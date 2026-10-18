
import time

import psycopg2

from app.errors import DatabaseUnreachableError, QueryExecutionError, ValidationError
from app.services.mariadb_service import MariaDBService
from app.services.query_values import jsonable


class PostgresDatabase:

    def connect(self, host, port, database_name, username, password, sslmode, connect_timeout=10):
        try:
            return psycopg2.connect(
                host=host,
                port=port,
                dbname=database_name,
                user=username,
                password=password,
                sslmode=sslmode,
                connect_timeout=connect_timeout,
            )
        except psycopg2.OperationalError as exc:
            raise DatabaseUnreachableError(
                f"Could not connect to {host}:{port}/{database_name}: {str(exc).strip()}"
            ) from exc

    def test(self, host, port, database_name, username, password, sslmode):
        conn = self.connect(host, port, database_name, username, password, sslmode)
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT version()")
                (version,) = cur.fetchone()
            return version
        finally:
            conn.close()

    _SYSTEM_SCHEMAS = ("pg_catalog", "information_schema", "pg_toast")

    def introspect(
        self, host, port, database_name, username, password, sslmode,
        timeout_seconds=30,
    ):
        conn = self.connect(host, port, database_name, username, password, sslmode)
        conn.autocommit = False
        try:
            with conn.cursor() as cur:
                cur.execute(f"SET statement_timeout = {int(timeout_seconds * 1000)}")
                cur.execute("SET TRANSACTION READ ONLY")

                cur.execute(
                    """
                    SELECT n.nspname, c.relname, c.relkind,
                           GREATEST(c.reltuples, 0)::bigint,
                           pg_total_relation_size(c.oid)
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE c.relkind IN ('r', 'p', 'v', 'm')
                      AND n.nspname NOT IN %s
                    ORDER BY n.nspname, c.relname
                    """,
                    (self._SYSTEM_SCHEMAS,),
                )
                tables = [
                    {
                        "schema": schema,
                        "name": name,
                        "kind": {"r": "table", "p": "table", "v": "view", "m": "materialized view"}[kind],
                        "estimated_rows": int(rows),
                        "size_bytes": int(size),
                        "columns": [],
                        "indexes": [],
                        "foreign_keys": [],
                    }
                    for schema, name, kind, rows, size in cur.fetchall()
                ]
                index = {(t["schema"], t["name"]): t for t in tables}

                cur.execute(
                    """
                    SELECT c.table_schema, c.table_name, c.column_name, c.ordinal_position,
                           c.data_type, c.is_nullable, c.column_default,
                           c.character_maximum_length
                    FROM information_schema.columns c
                    WHERE c.table_schema NOT IN %s
                    ORDER BY c.table_schema, c.table_name, c.ordinal_position
                    """,
                    (self._SYSTEM_SCHEMAS,),
                )
                for schema, table, column, position, dtype, nullable, default, maxlen in cur.fetchall():
                    target = index.get((schema, table))
                    if target is None:
                        continue
                    target["columns"].append({
                        "name": column,
                        "position": position,
                        "type": f"{dtype}({maxlen})" if maxlen else dtype,
                        "nullable": nullable == "YES",
                        "default": default,
                        "is_primary_key": False,
                    })

                # Primary keys, flagged onto the columns already collected.
                cur.execute(
                    """
                    SELECT n.nspname, t.relname, a.attname
                    FROM pg_index i
                    JOIN pg_class t ON t.oid = i.indrelid
                    JOIN pg_namespace n ON n.oid = t.relnamespace
                    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
                    WHERE i.indisprimary AND n.nspname NOT IN %s
                    """,
                    (self._SYSTEM_SCHEMAS,),
                )
                for schema, table, column in cur.fetchall():
                    target = index.get((schema, table))
                    if target is None:
                        continue
                    for col in target["columns"]:
                        if col["name"] == column:
                            col["is_primary_key"] = True

                cur.execute(
                    """
                    SELECT n.nspname, t.relname, c.conname,
                           pg_get_constraintdef(c.oid)
                    FROM pg_constraint c
                    JOIN pg_class t ON t.oid = c.conrelid
                    JOIN pg_namespace n ON n.oid = t.relnamespace
                    WHERE c.contype = 'f' AND n.nspname NOT IN %s
                    ORDER BY n.nspname, t.relname, c.conname
                    """,
                    (self._SYSTEM_SCHEMAS,),
                )
                for schema, table, name, definition in cur.fetchall():
                    target = index.get((schema, table))
                    if target is not None:
                        target["foreign_keys"].append({"name": name, "definition": definition})

                cur.execute(
                    """
                    SELECT schemaname, tablename, indexname, indexdef
                    FROM pg_indexes
                    WHERE schemaname NOT IN %s
                    ORDER BY schemaname, tablename, indexname
                    """,
                    (self._SYSTEM_SCHEMAS,),
                )
                for schema, table, name, definition in cur.fetchall():
                    target = index.get((schema, table))
                    if target is not None:
                        target["indexes"].append({"name": name, "definition": definition})

            return {"database": database_name, "tables": tables}
        finally:
            try:
                conn.rollback()
            except psycopg2.Error:
                pass
            conn.close()

    def execute_query(
        self, host, port, database_name, username, password, sslmode, sql,
        timeout_seconds=30, max_rows=500, allow_writes=False,
    ):
        conn = self.connect(host, port, database_name, username, password, sslmode)
        conn.autocommit = bool(allow_writes)
        started = time.monotonic()
        try:
            with conn.cursor() as cur:
                cur.execute(f"SET statement_timeout = {int(timeout_seconds * 1000)}")
                if not allow_writes:
                    cur.execute("SET TRANSACTION READ ONLY")
                try:
                    cur.execute(sql)
                except psycopg2.Error as exc:
                    raise QueryExecutionError(str(exc).strip()) from exc
                duration_ms = int((time.monotonic() - started) * 1000)

                if cur.description is None:
                    return {
                        "kind": "status",
                        "affected_rows": cur.rowcount,
                        "duration_ms": duration_ms,
                    }

                columns = [col.name for col in cur.description]
                rows = cur.fetchmany(max_rows + 1)
                truncated = len(rows) > max_rows
                rows = rows[:max_rows]
                return {
                    "kind": "rows",
                    "columns": columns,
                    "rows": [[jsonable(cell) for cell in row] for row in rows],
                    "row_count": len(rows),
                    "truncated": truncated,
                    "duration_ms": duration_ms,
                }
        finally:
            if not allow_writes:
                try:
                    conn.rollback()
                except psycopg2.Error:
                    pass
            conn.close()


class DatabaseConnectionService:

    def __init__(self):
        self._drivers = {"postgres": PostgresDatabase(), "mariadb": MariaDBService()}

    def driver(self, engine):
        try:
            return self._drivers[engine]
        except KeyError:
            raise ValidationError(f"Unsupported database engine: {engine!r}") from None

    def connect(self, engine, host, port, database_name, username, password, sslmode, connect_timeout=10):
        """An open connection, using the right driver for the engine. The caller closes it."""
        driver = self.driver(engine)
        if engine == "mariadb":
            conn = driver.connect(host, port, username, password, sslmode, connect_timeout=connect_timeout)
            driver.use_database(conn, database_name)
            return conn
        return driver.connect(host, port, database_name, username, password, sslmode, connect_timeout)

    def test(self, engine, host, port, database_name, username, password, sslmode):
        return self.driver(engine).test(host, port, database_name, username, password, sslmode)

    def introspect(self, engine, host, port, database_name, username, password, sslmode, timeout_seconds=30):
        return self.driver(engine).introspect(
            host, port, database_name, username, password, sslmode, timeout_seconds=timeout_seconds,
        )

    def execute_query(self, engine, host, port, database_name, username, password, sslmode, sql, **limits):
        return self.driver(engine).execute_query(host, port, database_name, username, password, sslmode, sql, **limits)
