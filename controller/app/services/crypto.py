"""Encryption at rest for credentials the application has to replay.

Used by every stored secret on the controller side: DatabaseConnection
passwords and ServerNode SSH keys call encrypt/decrypt directly, while
Tenant.db_password, Tenant.jwt_secret and ServerNode.ssh_password go through
the EncryptedString column type (app/models/types.py), which calls into here on
every read and write.

Those last three were plaintext until migration a3f7b1c8d204, protected only by
the API serializer omitting them from responses -- which did nothing for anyone
holding a database dump. Response-gating is still in place; it is now the
second layer rather than the only one.

These are encrypted rather than hashed because the application has to present
them to a third party (a Postgres server, an SSH daemon, a storefront signing
its own tokens). Losing ENCRYPTION_KEY makes them unrecoverable; that is the
unavoidable cost of the guarantee.

ENCRYPTION_KEY is validated lazily, here, not at app boot -- installs that
never touch this feature don't need it set.
"""

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings as default_settings
from app.errors import ConfigurationError


def _fernet(config=None):
    settings = config or default_settings
    if not settings.encryption_key:
        raise ConfigurationError(
            "ENCRYPTION_KEY is not set. Generate one with: python -c "
            "\"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\" "
            "and set it in .env."
        )
    try:
        return Fernet(settings.encryption_key.encode())
    except (ValueError, TypeError) as exc:
        raise ConfigurationError(f"ENCRYPTION_KEY is not a valid Fernet key: {exc}") from exc


def encrypt(value, config=None):
    return _fernet(config).encrypt(value.encode()).decode()


def decrypt(token, config=None):
    try:
        return _fernet(config).decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise ConfigurationError(
            "Could not decrypt a stored credential -- ENCRYPTION_KEY may have "
            "changed since it was encrypted."
        ) from exc
