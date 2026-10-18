"""Base class for the API views."""

from flask import jsonify, request
from flask.views import MethodView

from app.config import settings
from app.db import database
from app.errors import ValidationError


class BaseView(MethodView):

    controller_class = None
    serializer_class = None
    init_every_request = False

    def __init__(self, db=None, config=None):
        self.db = db or database
        self.settings = config or settings

    # ------------------------------------------------------------------
    def session(self):
        return self.db.session()

    def actor(self):
        return "api"

    def controller(self, session, controller_class=None):
        cls = controller_class or self.controller_class
        return cls(session, self.settings, actor=self.actor())

    def dump(self, instance, **options):
        return self.serializer_class.dump(instance, **options)

    def dump_many(self, instances, **options):
        return self.serializer_class.dump_many(instances, **options)

    def json_body(self):
        body = request.get_json(silent=True)
        if body is None:
            raise ValidationError("Request body must be valid JSON")
        return body

    def bool_arg(self, name, default=None):
        """Read an optional boolean query parameter."""
        raw = request.args.get(name)
        if raw is None:
            return default
        lowered = raw.strip().lower()
        if lowered in ("true", "1", "yes"):
            return True
        if lowered in ("false", "0", "no"):
            return False
        raise ValidationError(f"'{name}' must be true or false", field=name)

    def int_arg(self, name, default, minimum=None, maximum=None):
        raw = request.args.get(name)
        if raw is None:
            return default
        try:
            value = int(raw)
        except ValueError:
            raise ValidationError(f"'{name}' must be an integer", field=name)
        if minimum is not None and value < minimum:
            raise ValidationError(f"'{name}' must be >= {minimum}", field=name)
        if maximum is not None and value > maximum:
            raise ValidationError(f"'{name}' must be <= {maximum}", field=name)
        return value

    def str_arg(self, name, default=None):
        value = request.args.get(name)
        return value if value not in (None, "") else default

    def pagination(self):
        limit = self.int_arg(
            "limit", self.settings.default_page_size,
            minimum=1, maximum=self.settings.max_page_size,
        )
        offset = self.int_arg("offset", 0, minimum=0)
        return limit, offset

    @staticmethod
    def ok(body, status=200):
        return jsonify(body), status

    @staticmethod
    def no_content():
        return "", 204

    @staticmethod
    def page(items, total, limit, offset):
        return {
            "count": len(items),
            "total": total,
            "limit": limit,
            "offset": offset,
            "results": items,
        }
