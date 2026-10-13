"""Private API for customer Frappe sites. Ownership comes from the Next.js guard."""
import re
import secrets
import uuid
from flask import Blueprint, request
from sqlalchemy import select, text, func
from sqlalchemy.orm import joinedload
from app.routes.base import BaseView
from app.errors import ValidationError, ConflictError, NotFoundError
from app.models.site import Site
from app.models.platform import PlatformUser
from app.models.server import ServerNode
from app.models.deployment import Deployment
from app.controller.server import ServerController

SLUG = re.compile(r'^[a-z][a-z0-9-]{2,47}$')

def fits_site(server, slots, used_mb, reserved_sites, settings):
    return (server.is_active and server.role == 'worker' and server.frappe_enabled
            and server.last_check_status == 'ok'
            and slots + 10 <= server.max_containers
            and used_mb + 6144 + settings.node_memory_reserve_mb <= server.max_memory_mb
            and server.disk_total_gb is not None and server.disk_used_gb is not None
            and server.disk_total_gb - server.disk_used_gb >= (reserved_sites + 1) * 10)

def serialize(site):
    return {'id': str(site.id), 'name': site.name, 'slug': site.slug, 'domain': site.domain,
            'server_id': str(site.server_id), 'server_name': site.server.name,
            'status': site.status, 'progress': site.progress, 'message': site.message,
            'apps': site.app_names, 'created_at': site.created_at.isoformat(),
            'updated_at': site.updated_at.isoformat()}

def owned_site(session, site_id, user_id):
    try:
        identifier = uuid.UUID(str(site_id))
    except ValueError:
        raise NotFoundError('Site not found.')
    site = session.scalar(select(Site).options(joinedload(Site.server)).where(Site.id == identifier, Site.user_id == user_id))
    if not site:
        raise NotFoundError('Site not found.')
    return site

class SitesView(BaseView):
    def get(self):
        user_id = self.str_arg('user_id')
        if not user_id:
            raise ValidationError('user_id is required.')
        with self.session() as session:
            sites = session.scalars(select(Site).options(joinedload(Site.server)).where(Site.user_id == user_id).order_by(Site.created_at.desc())).all()
            return self.ok({'results': [serialize(site) for site in sites]})

    def post(self):
        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError('Request body must be an object.')
        name, slug = str(data.get('name', '')).strip(), str(data.get('slug', '')).strip().lower()
        password = str(data.get('admin_password', ''))
        try:
            request_key = str(uuid.UUID(str(data.get('request_key', ''))))
        except ValueError:
            raise ValidationError('A valid request_key is required.')
        if not name or len(name) > 100 or not SLUG.fullmatch(slug) or slug.endswith('-'):
            raise ValidationError('Use a name and a 3–48 character slug starting with a letter, containing letters, numbers and internal hyphens.')
        if len(password) < 12 or len(password) > 128:
            raise ValidationError('Administrator password must be 12–128 characters.')
        apps = data.get('app_names', [])
        if not isinstance(apps, list) or not all(isinstance(app, str) and re.fullmatch(r'[a-z][a-z0-9_]*', app) and app in self.settings.frappe_available_apps for app in apps):
            raise ValidationError('An application is not available in the configured Frappe image.')
        if not self.settings.frappe_site_domain:
            raise ConflictError('Frappe site hosting is not configured yet.')
        with self.session() as session:
            # Serialises automatic placement with UnityCommerce placement too.
            session.execute(text("SET LOCAL lock_timeout = '5s'"))
            session.execute(text("SELECT pg_advisory_xact_lock(hashtext('customer-site-placement'))"))
            existing = session.scalar(select(Site).options(joinedload(Site.server)).where(Site.user_id == data.get('user_id'), Site.request_key == request_key))
            if existing:
                return self.ok(serialize(existing))
            user = session.get(PlatformUser, data.get('user_id'))
            if not user or user.role != 'CUSTOMER':
                raise ValidationError('Customer not found.')
            if session.scalar(select(func.count()).select_from(Site).where(Site.user_id == user.id, Site.status.in_(Site.ACTIVE_STATUSES))) >= self.settings.frappe_customer_site_limit:
                raise ConflictError('Your account has reached its site limit. Contact support for additional sites.')
            if session.scalar(select(Site.id).where(Site.slug == slug)):
                raise ConflictError('This site address is already in use.')
            if not ServerController(session, self.settings).proxy_node():
                raise ConflictError('A proxy server must be configured before creating Frappe sites.')
            server = None
            # Lock before recomputing load. Cached counters never drive placement.
            candidates = session.scalars(select(ServerNode).where(ServerNode.is_active.is_(True), ServerNode.role == 'worker', ServerNode.frappe_enabled.is_(True), ServerNode.last_check_status == 'ok').order_by(ServerNode.max_memory_mb.desc()).with_for_update()).all()
            load = ServerController(session, self.settings).node_load()
            for node in candidates:
                row = session.execute(select(load.c.containers, load.c.used_mb).where(load.c.server_id == node.id)).first()
                slots, used = row if row else (0, 0)
                reserved_sites = session.scalar(select(func.count()).select_from(Site).where(Site.server_id == node.id, Site.status.in_(Site.ACTIVE_STATUSES)))
                if fits_site(node, slots, used, reserved_sites, self.settings):
                    server = node
                    break
            if not server:
                raise ConflictError('No healthy Frappe worker has enough memory, container capacity and disk space. Please try later or contact support.')
            used_ports = set(session.scalars(select(Site.port).where(Site.server_id == server.id))) | set(session.scalars(select(Deployment.port).where(Deployment.server_id == server.id, Deployment.status.in_(Deployment.ACTIVE_STATUSES))))
            port = next((port for port in range(self.settings.frappe_port_start, self.settings.frappe_port_end + 1) if port not in used_ports), None)
            if not port:
                raise ConflictError('No site ports are available on this server.')
            site = Site(user_id=user.id, request_key=request_key, name=name, slug=slug, domain=f'{slug}.{self.settings.frappe_site_domain}', server_id=server.id, port=port,
                        image=self.settings.frappe_image, app_names=list(dict.fromkeys(['erpnext', *apps])), admin_password=password,
                        db_password=secrets.token_urlsafe(32), status='queued', progress=0, message='Waiting for a provisioning worker.')
            session.add(site)
            session.flush()
            ServerController(session, self.settings).refresh_capacity(server)
            identifier = str(site.id)
        # Commit the reservation before the worker can consume the job.
        from app.tasks.site_tasks import provision_site_task
        try:
            provision_site_task.apply_async(args=[identifier], task_id=identifier, retry=False)
        except Exception:
            with self.session() as session:
                site = session.get(Site, uuid.UUID(identifier))
                if site.status == 'queued':
                    site.status, site.message = 'failed', 'The provisioning queue is unavailable. Retry when the worker is available.'
                    ServerController(session, self.settings).refresh_capacity(session.get(ServerNode, site.server_id))
        with self.session() as session:
            return self.ok(serialize(owned_site(session, identifier, data['user_id'])), 201)

class SiteDetailView(BaseView):
    def get(self, site_id):
        with self.session() as session:
            return self.ok(serialize(owned_site(session, site_id, self.str_arg('user_id'))))

class SiteRetryView(BaseView):
    def post(self, site_id):
        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError('Request body must be an object.')
        with self.session() as session:
            session.execute(text("SET LOCAL lock_timeout = '5s'"))
            session.execute(text("SELECT pg_advisory_xact_lock(hashtext('customer-site-placement'))"))
            site = owned_site(session, site_id, data.get('user_id'))
            if site.status != 'failed':
                raise ConflictError('Only a failed, cleaned-up site can be retried.')
            server = session.scalar(select(ServerNode).where(ServerNode.id == site.server_id).with_for_update())
            load = ServerController(session, self.settings).node_load()
            row = session.execute(select(load.c.containers, load.c.used_mb).where(load.c.server_id == server.id)).first()
            slots, used = row if row else (0, 0)
            reserved_sites = session.scalar(select(func.count()).select_from(Site).where(Site.server_id == server.id, Site.status.in_(Site.ACTIVE_STATUSES)))
            if not fits_site(server, slots, used, reserved_sites, self.settings):
                raise ConflictError('The assigned server is not available for a retry.')
            site.status, site.progress, site.message = 'queued', 0, 'Waiting for a provisioning worker.'
            ServerController(session, self.settings).refresh_capacity(server)
        from app.tasks.site_tasks import provision_site_task
        try:
            provision_site_task.apply_async(args=[site_id], retry=False)
        except Exception:
            with self.session() as session:
                site = owned_site(session, site_id, data.get('user_id'))
                site.status, site.message = 'failed', 'The provisioning queue is unavailable.'
                ServerController(session, self.settings).refresh_capacity(session.get(ServerNode, site.server_id))
            raise ConflictError('The provisioning queue is unavailable.')
        return self.ok({'queued': True}, 202)

class SiteCapabilitiesView(BaseView):
    def get(self):
        return self.ok({'apps': self.settings.frappe_available_apps, 'configured': bool(self.settings.frappe_site_domain)})

class SiteRoutes:
    @classmethod
    def blueprint(cls, db=None, config=None):
        bp = Blueprint('sites', __name__, url_prefix='/api/v1/sites')
        for path, view, name in [('', SitesView, 'collection'), ('/capabilities', SiteCapabilitiesView, 'capabilities'), ('/<site_id>', SiteDetailView, 'detail'), ('/<site_id>/retry', SiteRetryView, 'retry')]:
            bp.add_url_rule(path, view_func=view.as_view(name, db=db, config=config))
        return bp
