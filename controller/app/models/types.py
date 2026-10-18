
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.services import crypto


class EncryptedString(TypeDecorator):
    """Text column holding Fernet ciphertext, transparent to the ORM."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return crypto.encrypt(str(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return crypto.decrypt(value)
