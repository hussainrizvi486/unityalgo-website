"""Durable Frappe provisioning, with explicit cleanup and failure states."""
import json
import time
import uuid
import urllib.request
from sqlalchemy import select
from app.config import settings
from app.db import database
from app.models.site import Site
from app.models.server import ServerNode
from app.services.frappe_service import FrappeService
from app.services.proxy_configuration_service import ProxyConfigurationService
from app.tasks.celery_app import celery_app

class SiteTask(celery_app.Task):
    abstract = True
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        if args:
            update(args[0], 'cleanup_required', 0, 'Provisioning was interrupted. Contact support to check the reserved resources.')
            try:
                notify_site_task.delay(args[0])
            except Exception:
                pass

def update(site_id, status, progress, message):
    with database.session() as session:
        site = session.get(Site, uuid.UUID(site_id))
        if site:
            site.status, site.progress, site.message = status, progress, message
            from app.controller.server import ServerController
            ServerController(session, settings).refresh_capacity(session.get(ServerNode, site.server_id))

@celery_app.task(bind=True, base=SiteTask, name='site.provision', soft_time_limit=2300, time_limit=2400)
def provision_site_task(self, site_id):
    with database.session() as session:
        site = session.scalar(select(Site).where(Site.id == uuid.UUID(site_id)).with_for_update())
        if not site or site.status != 'queued':
            return
        site.status, site.progress, site.message = 'assigned', 5, 'The assigned server is preparing your site.'
        server = session.get(ServerNode, site.server_id)
        service = FrappeService(site, server, settings)
        # Snapshot values before closing the ORM session (its commit expires rows).
        service.site = type('SiteSnapshot', (), {key: getattr(site, key) for key in ['id','domain','port','image','app_names','admin_password','db_password']})()
        service.server = type('ServerSnapshot', (), {key: getattr(server, key) for key in ['id','name','ip_address','private_ip','ssh_port','ssh_user','ssh_key_path','ssh_key_encrypted','ssh_password','ssh_auth_method']})()
        service.server.dial_host = server.dial_host
        from app.services.ssh_service import SSHService
        service.ssh = SSHService(service.server, settings)
    try:
        service.prepare()
        update(site_id, 'pulling', 15, 'Downloading the Frappe and ERPNext images.')
        service.run(['pull'])
        service.run(['up','-d','--wait','--wait-timeout','180','db','redis-cache','redis-queue'])
        update(site_id, 'configuring', 35, 'Configuring the database and background services.')
        service.run(['run','--rm','configurator'])
        update(site_id, 'installing', 55, 'Creating your Frappe site and installing the selected applications.')
        service.run(['run','--rm','create-site'])
        update(site_id, 'starting', 80, 'Starting the application and checking its health.')
        service.run(['up','-d','backend','frontend','websocket','queue-short','queue-long','scheduler'])
        for _ in range(36):
            if service.healthy():
                break
            time.sleep(5)
        else:
            raise RuntimeError('The application did not become healthy.')
        update(site_id, 'routing', 90, 'Connecting your site address to the application.')
        with database.session() as session:
            ProxyConfigurationService(settings).sync_all(session)
        update(site_id, 'ready', 100, 'Your site is ready. Sign in as Administrator using the password you chose.')
    except Exception:
        # Never release capacity while containers might still be running.
        try:
            service.run(['down','--remove-orphans'], timeout=120)
            update(site_id, 'failed', 0, 'Site provisioning failed. The containers were stopped and your data volumes were preserved. You can retry or contact support.')
        except Exception:
            update(site_id, 'cleanup_required', 0, 'Site provisioning failed and cleanup could not finish. Contact support; server capacity remains reserved.')
        with database.session() as session:
            try:
                ProxyConfigurationService(settings).sync_all(session)
            except Exception:
                pass
    # Notification delivery has its own retry lifecycle and cannot fail provisioning.
    try:
        notify_site_task.delay(site_id)
    except Exception:
        pass  # Customer status polling also persists the terminal notification.

@celery_app.task(bind=True, name='site.notify', autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def notify_site_task(self, site_id):
    with database.session() as session:
        site = session.get(Site, uuid.UUID(site_id))
        if not site:
            return
        payload = json.dumps({'site_id':site_id,'user_id':site.user_id}).encode()
    req = urllib.request.Request(settings.platform_internal_url.rstrip('/') + '/api/internal/site-events', data=payload,
          headers={'Content-Type':'application/json', 'X-Controller-Key':settings.controller_internal_api_key}, method='POST')
    with urllib.request.urlopen(req, timeout=15) as response:
        if response.status != 200:
            raise RuntimeError('Site event could not be delivered.')
