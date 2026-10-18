
import re
import time
import traceback
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

from app.models.activity import ActivityLog, Operation


def _uuid_or_none(value):
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None


_SECRET_FLAG = re.compile(r"(--[\w-]*(?:password|passwd|secret|token|api-key)[\w-]*[= ])(\S+)", re.I)
_SECRET_ASSIGN = re.compile(r"((?:password|passwd|secret|token)['\"]?\s*[:=]\s*['\"]?)([^\s'\",}]+)", re.I)


_GITHUB_TOKEN = re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b")


def redact(text):
    """Hide passwords and tokens in text headed for the log (command flags and key=value pairs)."""
    if not text:
        return text
    text = _GITHUB_TOKEN.sub("[redacted]", str(text))
    text = _SECRET_FLAG.sub(r"\1[redacted]", text)
    return _SECRET_ASSIGN.sub(r"\1[redacted]", text)


def redact_value(value):
    if isinstance(value, str):
        return redact(value)
    if isinstance(value, dict):
        return {key: redact_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [redact_value(item) for item in value]
    return value


def format_exception(exc):
    """Full "Type: message" plus traceback, including chained causes."""
    return "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)).strip()


class OperationRecorder:
    """Records steps against one Operation. Yielded by ActivityLogger.operation()."""

    def __init__(self, logger, operation_id, context):
        self.logger = logger
        self.operation_id = operation_id
        self.context = context
        self.step_index = 0
        self._step_started = time.monotonic()

    # ------------------------------------------------------------------
    def step(self, step_name, status="success", message=None, details=None,
             error=None, action=None, **context):
        """Record one step. Returns the created log row's id."""
        self.step_index += 1
        now = time.monotonic()
        duration_ms = int((now - self._step_started) * 1000)
        self._step_started = now

        merged = {**self.context, **{k: v for k, v in context.items() if v is not None}}
        resolved_action = action or merged.pop("action", None) or "system.event"
        resolved_category = merged.pop("category", None) or "system"

        return self.logger.write(
            category=resolved_category,
            action=resolved_action,
            operation_id=self.operation_id,
            step_index=self.step_index,
            step_name=step_name,
            status=status,
            message=message,
            details=details,
            error=error,
            duration_ms=duration_ms,
            **merged,
        )

    def started(self, step_name, message=None, **kw):
        return self.step(step_name, status="in_progress", message=message, **kw)

    def ok(self, step_name, message=None, **kw):
        return self.step(step_name, status="success", message=message, **kw)

    def warn(self, step_name, message=None, **kw):
        return self.step(step_name, status="warning", message=message, **kw)

    def fail(self, step_name, error, message=None, **kw):
        return self.step(
            step_name, status="failed", message=message, error=str(error), **kw
        )

    def bind(self, **context):
        """Attach subject info discovered mid-operation (e.g. the new tenant id)."""
        self.context.update({k: v for k, v in context.items() if v is not None})
        self.logger.update_operation(self.operation_id, **self.context)


class ActivityLogger:

    def __init__(self, db=None, actor=None):
        if db is None:
            from app.db import database as default_db

            db = default_db
        self.db = db
        self.actor = actor

    # ------------------------------------------------------------------
    @staticmethod
    def _subject_columns(context):
        """Split loose kwargs into the log table's subject columns."""
        return {
            "tenant_id": _uuid_or_none(context.get("tenant_id")),
            "server_id": _uuid_or_none(context.get("server_id")),
            "customer_id": _uuid_or_none(context.get("customer_id")),
            "billing_record_id": _uuid_or_none(context.get("billing_record_id")),
            "tenant_slug": context.get("tenant_slug"),
            "server_name": context.get("server_name"),
            "customer_name": context.get("customer_name"),
        }

    def write(self, category="system", action="system.event", step_name="event",
              status="success", message=None, details=None, error=None,
              operation_id=None, step_index=0, duration_ms=None, **context):
        """Write a single standalone log row and commit it."""
        row = ActivityLog(
            operation_id=_uuid_or_none(operation_id),
            category=category,
            action=action,
            step_name=step_name,
            step_index=step_index,
            status=status,
            message=redact(message),
            details=redact_value(details),
            error_message=redact(str(error)) if error else None,
            duration_ms=duration_ms,
            actor=context.get("actor") or self.actor,
            **self._subject_columns(context),
        )
        with self.db.session() as session:
            session.add(row)
            session.flush()
            row_id = row.id
            if row.operation_id is not None:
                op = session.get(Operation, row.operation_id)
                if op is not None:
                    op.step_count = (op.step_count or 0) + 1
        return row_id

    # ------------------------------------------------------------------
    def start_operation(self, kind, label, category=None, **context):
        operation = Operation(
            kind=kind,
            category=category or kind.split(".")[0],
            label=label,
            status="in_progress",
            actor=context.get("actor") or self.actor,
            started_at=datetime.now(timezone.utc),
            **self._subject_columns(context),
        )
        with self.db.session() as session:
            session.add(operation)
            session.flush()
            return operation.id

    def update_operation(self, operation_id, **context):
        subjects = self._subject_columns(context)
        with self.db.session() as session:
            op = session.get(Operation, _uuid_or_none(operation_id))
            if op is None:
                return
            for field, value in subjects.items():
                if value is not None:
                    setattr(op, field, value)

    def finish_operation(self, operation_id, status, error=None, started_monotonic=None):
        with self.db.session() as session:
            op = session.get(Operation, _uuid_or_none(operation_id))
            if op is None:
                return
            op.status = status
            op.error_message = redact(str(error)) if error else None
            op.completed_at = datetime.now(timezone.utc)
            if started_monotonic is not None:
                op.duration_ms = int((time.monotonic() - started_monotonic) * 1000)

    # ------------------------------------------------------------------
    @contextmanager
    def operation(self, kind, label, category=None, operation_id=None, **context):
        started = time.monotonic()
        resolved_category = category or kind.split(".")[0]
        if operation_id is None:
            operation_id = self.start_operation(
                kind, label, category=resolved_category, **context
            )
        recorder = OperationRecorder(
            self,
            operation_id,
            dict(context, action=kind, category=resolved_category),
        )
        try:
            yield recorder
        except Exception as exc:
            full = format_exception(exc)
            recorder.step(
                "Operation failed",
                status="failed",
                message=f"{type(exc).__name__}: {str(exc).splitlines()[0][:200] if str(exc) else ''}",
                error=full,
                details={"exception": type(exc).__name__, "traceback": full},
            )
            self.finish_operation(
                operation_id, "failed", error=full, started_monotonic=started
            )
            raise
        else:
            self.finish_operation(operation_id, "success", started_monotonic=started)

    def event(self, category, action, step_name, status="success", **kw):
        return self.write(
            category=category, action=action, step_name=step_name, status=status, **kw
        )
