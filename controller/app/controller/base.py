"""Shared CRUD behaviour for the resource controllers."""

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.errors import ConflictError, NotFoundError, ValidationError
from app.services.activity_logger import ActivityLogger
from app.validators import Validator


class BaseController:
    """One controller instance per request, bound to one session.

    Subclasses declare `model`, `resource_name`, `writable_fields` and
    `required_on_create`, then implement `clean()` to validate a payload into
    model attributes.
    """

    model = None
    resource_name = "resource"
    writable_fields = ()
    required_on_create = ()
    immutable_after_create = ()
    order_by = None

    def __init__(self, session, config=None, actor=None):
        self.session = session
        self.settings = config or settings
        self.validator = Validator
        self.actor = actor
        # Writes on its own session so failure logs survive a rolled-back
        # operation -- see app/services/activity_logger.py.
        self.activity = ActivityLogger(actor=actor)

    # ------------------------------------------------------------------
    # payload handling
    # ------------------------------------------------------------------
    def clean(self, data, partial):
        raise NotImplementedError

    def check_payload(self, data, partial):
        """Structural checks every resource shares, run before field coercion."""
        self.validator.payload(data)
        self.validator.no_unknown_fields(data, self.writable_fields)
        if partial:
            locked = [name for name in self.immutable_after_create if name in data]
            if locked:
                raise self.validation_error_for_locked(locked)
        else:
            self.validator.required_fields(data, self.required_on_create)
        return data

    def validation_error_for_locked(self, locked):
        return ValidationError(
            f"Field(s) cannot be changed after creation: {', '.join(locked)}",
            field=locked[0],
        )

    # ------------------------------------------------------------------
    # queries
    # ------------------------------------------------------------------
    def base_query(self):
        return select(self.model)

    def paginate(self, stmt, limit, offset):
        """Return (rows, total) for a statement, counting before slicing."""
        total = self.session.scalar(select(func.count()).select_from(stmt.subquery()))
        order = self.order_by if self.order_by is not None else self.model.created_at.desc()
        rows = self.session.scalars(
            stmt.order_by(order).limit(limit).offset(offset)
        ).all()
        return rows, total

    def get(self, resource_id):
        resource_id = self.validator.uuid(resource_id, f"{self.resource_name}_id")
        instance = self.session.get(self.model, resource_id)
        if instance is None:
            raise NotFoundError(
                f"{self.resource_name.capitalize()} '{resource_id}' not found"
            )
        return instance

    # ------------------------------------------------------------------
    # writes
    # ------------------------------------------------------------------
    def create(self, data):
        values = self.clean(data, partial=False)
        values = self.apply_defaults(values)
        instance = self.model(**values)
        self.session.add(instance)
        self.flush(self.conflict_message(values))
        return instance

    def update(self, resource_id, data):
        instance = self.get(resource_id)
        values = self.clean(data, partial=True)
        self.before_update(instance, values)
        for field, value in values.items():
            setattr(instance, field, value)
        self.flush(self.conflict_message(values))
        return instance

    def delete(self, resource_id, force=False):
        instance = self.get(resource_id)
        self.before_delete(instance, force)
        self.session.delete(instance)
        self.session.flush()
        return instance

    def flush(self, conflict_message):
        """Flush, translating a unique/FK violation into a 409."""
        try:
            self.session.flush()
        except IntegrityError:
            self.session.rollback()
            raise ConflictError(conflict_message)

    # ------------------------------------------------------------------
    # hooks
    # ------------------------------------------------------------------
    def apply_defaults(self, values):
        return values

    def before_update(self, instance, values):
        pass

    def before_delete(self, instance, force):
        pass

    def conflict_message(self, values):
        return f"That {self.resource_name} conflicts with an existing record"
