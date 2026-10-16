"""Turning query-result cells into values the JSON encoder accepts, for every database engine."""

import uuid
from datetime import date, datetime, time as time_type, timedelta
from decimal import Decimal


def jsonable(value):
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
    if isinstance(value, timedelta):
        return str(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (bytes, memoryview)):
        return bytes(value).hex()
    if isinstance(value, (list, tuple)):
        return [jsonable(item) for item in value]
    if isinstance(value, dict):
        return {key: jsonable(item) for key, item in value.items()}
    return str(value)
