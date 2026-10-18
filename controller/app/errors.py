from .status_codes import (
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
    HTTP_409_CONFLICT,
    HTTP_422_UNPROCESSABLE_ENTITY,
    HTTP_500_INTERNAL_SERVER_ERROR,
    HTTP_502_BAD_GATEWAY,
    HTTP_503_SERVICE_UNAVAILABLE,
)


class ApiError(Exception):
    """Base error raised by controllers and rendered as a JSON response."""

    status_code = HTTP_400_BAD_REQUEST

    def __init__(self, message, status_code=None, field=None):
        super().__init__(message)
        self.message = message
        self.field = field
        if status_code is not None:
            self.status_code = status_code

    def to_dict(self):
        body = {"error": self.message}
        if self.field:
            body["field"] = self.field
        return body


class ValidationError(ApiError):
    status_code = HTTP_422_UNPROCESSABLE_ENTITY


class NotFoundError(ApiError):
    status_code = HTTP_404_NOT_FOUND


class ConflictError(ApiError):
    status_code = HTTP_409_CONFLICT


class NodeUnreachableError(ApiError):
    """A worker node could not be reached or authenticated over SSH."""

    status_code = HTTP_502_BAD_GATEWAY


class DependencyMissingError(ApiError):
    """A required external tool (pg_dump, docker, ...) isn't available."""

    status_code = HTTP_500_INTERNAL_SERVER_ERROR


class DatabaseUnreachableError(ApiError):

    status_code = HTTP_503_SERVICE_UNAVAILABLE


class BackupError(ApiError):
    """A tenant database backup or restore failed."""

    status_code = HTTP_500_INTERNAL_SERVER_ERROR


class UnauthorizedError(ApiError):
    """Missing or invalid credentials."""

    status_code = HTTP_401_UNAUTHORIZED


class ForbiddenError(ApiError):
    """Authenticated, but not allowed to do this."""

    status_code = HTTP_403_FORBIDDEN


class ConfigurationError(ApiError):

    status_code = HTTP_500_INTERNAL_SERVER_ERROR


class QueryExecutionError(ApiError):

    status_code = HTTP_400_BAD_REQUEST


class ProxyConfigurationError(ApiError):

    status_code = HTTP_502_BAD_GATEWAY
