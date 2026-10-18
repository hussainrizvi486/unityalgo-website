
import re
import uuid
from decimal import Decimal, InvalidOperation

from .errors import ValidationError


class Validator:
    SLUG_RE = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
    EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    HOSTNAME_RE = re.compile(
        r"^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?"
        r"(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$"
    )
    IPV4_RE = re.compile(r"^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$")

    @staticmethod
    def string(value, field, max_length=None, allow_empty=False):
        if not isinstance(value, str):
            raise ValidationError(f"'{field}' must be a string", field=field)
        value = value.strip()
        if not value and not allow_empty:
            raise ValidationError(f"'{field}' must not be empty", field=field)
        if max_length is not None and len(value) > max_length:
            raise ValidationError(
                f"'{field}' must be at most {max_length} characters", field=field
            )
        return value

    @staticmethod
    def integer(value, field, minimum=None, maximum=None):
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValidationError(f"'{field}' must be an integer", field=field)
        if minimum is not None and value < minimum:
            raise ValidationError(f"'{field}' must be >= {minimum}", field=field)
        if maximum is not None and value > maximum:
            raise ValidationError(f"'{field}' must be <= {maximum}", field=field)
        return value

    @staticmethod
    def boolean(value, field):
        if not isinstance(value, bool):
            raise ValidationError(f"'{field}' must be a boolean", field=field)
        return value

    @staticmethod
    def decimal(value, field, minimum=None, maximum=None):
        if isinstance(value, bool) or not isinstance(value, (int, float, str, Decimal)):
            raise ValidationError(f"'{field}' must be a number", field=field)
        try:
            parsed = Decimal(str(value))
        except InvalidOperation:
            raise ValidationError(f"'{field}' must be a number", field=field)
        if minimum is not None and parsed < Decimal(str(minimum)):
            raise ValidationError(f"'{field}' must be >= {minimum}", field=field)
        if maximum is not None and parsed > Decimal(str(maximum)):
            raise ValidationError(f"'{field}' must be <= {maximum}", field=field)
        return parsed

    @staticmethod
    def uuid(value, field):
        if isinstance(value, uuid.UUID):
            return value
        try:
            return uuid.UUID(str(value))
        except (ValueError, AttributeError, TypeError):
            raise ValidationError(f"'{field}' must be a valid UUID", field=field)

    @classmethod
    def slug(cls, value, field, max_length=63):
        value = cls.string(value, field, max_length=max_length).lower()
        if not cls.SLUG_RE.match(value):
            raise ValidationError(
                f"'{field}' may only contain lowercase letters, digits and hyphens",
                field=field,
            )
        return value

    @classmethod
    def email(cls, value, field, max_length=255):
        value = cls.string(value, field, max_length=max_length)
        if not cls.EMAIL_RE.match(value):
            raise ValidationError(
                f"'{field}' must be a valid email address", field=field
            )
        return value

    @classmethod
    def hostname(cls, value, field, max_length=255):
        value = cls.string(value, field, max_length=max_length).lower()
        if not cls.HOSTNAME_RE.match(value):
            raise ValidationError(f"'{field}' must be a valid domain name", field=field)
        return value

    @classmethod
    def ip_address(cls, value, field, max_length=45):
        value = cls.string(value, field, max_length=max_length)
        match = cls.IPV4_RE.match(value)
        if match:
            if all(0 <= int(octet) <= 255 for octet in match.groups()):
                return value
            raise ValidationError(f"'{field}' is not a valid IPv4 address", field=field)
        # Anything else is accepted as an IPv6 literal or resolvable hostname.
        if ":" in value or cls.HOSTNAME_RE.match(value):
            return value
        raise ValidationError(
            f"'{field}' must be an IP address or hostname", field=field
        )

    @classmethod
    def choice(cls, value, field, choices):
        value = cls.string(value, field)
        if value not in choices:
            raise ValidationError(
                f"'{field}' must be one of: {', '.join(sorted(choices))}", field=field
            )
        return value

    @staticmethod
    def payload(data):
        """Reject anything that is not a JSON object body."""
        if not isinstance(data, dict):
            raise ValidationError("Request body must be a JSON object")
        return data

    @staticmethod
    def no_unknown_fields(data, allowed):
        unknown = sorted(set(data) - set(allowed))
        if unknown:
            raise ValidationError(f"Unknown field(s): {', '.join(unknown)}")

    @staticmethod
    def required_fields(data, required):
        missing = [name for name in required if data.get(name) is None]
        if missing:
            raise ValidationError(
                f"Missing required field(s): {', '.join(missing)}", field=missing[0]
            )
