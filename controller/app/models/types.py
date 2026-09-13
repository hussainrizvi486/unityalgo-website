"""Column types that encrypt at rest.

`EncryptedString` stores Fernet ciphertext in the database and hands plaintext
to the application, so a column can be encrypted without touching the code that
reads it. That matters here: `Tenant.db_password`, `Tenant.jwt_secret` and
`ServerNode.ssh_password` are read from a dozen places -- provisioning, the
Postgres service, the SSH service, the deployment env -- and rewriting each of
them is a much larger change, with a much larger chance of missing one, than
changing the column type once.

The key is `ENCRYPTION_KEY`, the same one `DatabaseConnection.password_encrypted`
and `ServerNode.ssh_key_encrypted` already use. It lives outside the database,
which is what makes a leaked dump useless on its own.

Two consequences worth knowing:

  * Losing ENCRYPTION_KEY makes these columns unrecoverable. They are live
    credentials, not hashes -- the application has to be able to replay them --
    so there is no way to have both recoverability and encryption at rest.
  * A value cannot be matched with a SQL WHERE clause any more. Fernet is
    randomised, so the same plaintext encrypts differently every time. None of
    these three columns is ever queried by value, which is why they are
    eligible for this treatment and, say, an email address is not.
"""

from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.services import crypto


class EncryptedString(TypeDecorator):
    """Text column holding Fernet ciphertext, transparent to the ORM."""

    impl = Text
    # The type is deterministic in shape even though the values are not, so
    # SQLAlchemy may cache statements compiled against it.
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return crypto.encrypt(str(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return crypto.decrypt(value)
