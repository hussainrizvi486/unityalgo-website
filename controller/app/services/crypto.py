
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
