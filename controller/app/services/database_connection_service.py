"""Connects to and queries an arbitrary, admin-registered PostgreSQL database.

Distinct from PostgresService (app/services/postgres_service.py), which only
ever talks to the control-plane database this app already owns, using fixed,
hardcoded statements. This service connects to whatever host/credentials an
operator registers and runs whatever SQL they type -- there is no statement
filtering (by design, per product decision: the console behaves like a raw
psql prompt). Safety here is about clean error handling and never leaking
credentials, not restricting what SQL can run.
"""

import time
import uuid
from datetime import date, datetime, time as time_type
from decimal import Decimal

import psycopg2

from app.errors import DatabaseUnreachableError, QueryExecutionError


def _jsonable(value):
    """Coerce one query-result cell into something the JSON encoder handles.

    psycopg2 hands back native Python types straight from the wire (Decimal
    for NUMERIC, memoryview for bytea, UUID, date/time, ...) -- several of
    which aren't JSON-serializable by default and would otherwise crash the
    query endpoint with an opaque 500 on the first NUMERIC or bytea column.
    """
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date, time_type)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (bytes, memoryview)):
        return bytes(value).hex()
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    return str(value)


class DatabaseConnectionService:
    def _connect(self, host, port, database_name, username, password, sslmode, connect_timeout=10):
        """A single connection attempt -- no retry/backoff.

        Unlike PostgresService._connection() (which retries transient errors
        for unattended provisioning flows), this backs an interactive "test
        now" button: the operator wants a fast yes/no, not up to ~15s of
        silent retries before an answer.
        """
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
        """Connects and confirms the server actually answers a query.
        Returns the server's version string on success."""
        conn = self._connect(host, port, database_name, username, password, sslmode)
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT version()")
                (version,) = cur.fetchone()
            return version
        finally:
            conn.close()

    # System schemas are noise in a browser: nobody opens this to read
    # pg_catalog. Excluded from every introspection query below.
    _SYSTEM_SCHEMAS = ("pg_catalog", "information_schema", "pg_toast")

    def introspect(
        self, host, port, database_name, username, password, sslmode,
        timeout_seconds=30,
    ):
        """Describe the database: tables, columns, keys and indexes.

        Four catalog queries, not four per table. A database with a few hundred
        tables would otherwise take a few hundred round trips to draw one
        sidebar; the results are stitched together in Python instead.

        Runs READ ONLY -- introspection has no business writing, and saying so
        to the engine costs nothing.
        """
        conn = self._connect(host, port, database_name, username, password, sslmode)
        conn.autocommit = False
        try:
            with conn.cursor() as cur:
                cur.execute(f"SET statement_timeout = {int(timeout_seconds * 1000)}")
                cur.execute("SET TRANSACTION READ ONLY")

                # reltuples is the planner's estimate, not a count: an exact
                # COUNT(*) per table would read every table on the server.
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
        """Runs one SQL statement.

        Three guardrails. A server-side `statement_timeout`, so a slow or
        hanging query can't block the request forever. A row cap, so a
        `SELECT *` against a huge table doesn't pull millions of rows into
        memory and the browser -- it fetches `max_rows + 1` to detect
        truncation without a separate COUNT(*).

        And, unless `allow_writes` is set, a Postgres READ ONLY transaction.
        That is deliberately not a check on the SQL text: inspecting the
        leading keyword misses `WITH ... DELETE`, `SELECT ... INTO`, and
        anything hidden behind a comment or a function call. Handing the
        decision to the engine means the guarantee holds for statements
        nobody thought to enumerate. Writes still run unrestricted on a
        connection an admin has opted in.

        Returns {"kind": "rows", columns, rows, row_count, truncated,
        duration_ms} for a SELECT-like statement, or {"kind": "status",
        affected_rows, duration_ms} for INSERT/UPDATE/DELETE/DDL, based on
        whether the cursor produced a result set (cur.description is None
        for the latter).
        """
        conn = self._connect(host, port, database_name, username, password, sslmode)
        # A read-only run needs a real transaction to mark READ ONLY; a
        # writable one autocommits, matching a raw psql session.
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
                    "rows": [[_jsonable(cell) for cell in row] for row in rows],
                    "row_count": len(rows),
                    "truncated": truncated,
                    "duration_ms": duration_ms,
                }
        finally:
            if not allow_writes:
                # Nothing to keep: the transaction exists only to hold the
                # READ ONLY flag.
                try:
                    conn.rollback()
                except psycopg2.Error:
                    pass
            conn.close()
