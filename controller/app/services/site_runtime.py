from app.config import settings
from app.models.database_connection import DatabaseConnection
from app.models.server import ServerNode
from app.services.crypto import decrypt
from app.services.frappe_service import FrappeService
from app.services.ssh_service import SSHService

SITE_FIELDS = ['id', 'slug', 'domain', 'port', 'image', 'app_names', 'admin_password', 'db_password', 'memory_limit_mb', 'cpu_limit', 'storage_limit_gb', 'user_limit']
SERVER_FIELDS = ['id', 'name', 'cpu_cores', 'ip_address', 'private_ip', 'ssh_port', 'ssh_user', 'ssh_key_path', 'ssh_key_encrypted', 'ssh_password', 'ssh_auth_method']


def build_service(session, site, setup=None):
    server = session.get(ServerNode, site.server_id)
    external_db = None
    if site.db_server_id:
        connection = session.get(DatabaseConnection, site.db_server_id)
        external_db = {'host': connection.host_from_worker or connection.host, 'port': connection.port,
                       'user': connection.username, 'password': decrypt(connection.password_encrypted, settings),
                       'controller_host': connection.host, 'sslmode': connection.sslmode}
    service = FrappeService(site, server, settings, setup, external_db)
    # Snapshot values before the ORM session closes (its commit expires rows).
    service.site = type('SiteSnapshot', (), {key: getattr(site, key) for key in SITE_FIELDS})()
    service.server = type('ServerSnapshot', (), {key: getattr(server, key) for key in SERVER_FIELDS})()
    service.server.dial_host = server.dial_host
    service.ssh = SSHService(service.server, settings)
    return service
