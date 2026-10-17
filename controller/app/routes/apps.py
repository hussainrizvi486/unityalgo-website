"""App Store API: inspect GitHub apps, see what each site runs, and roll versions out to chosen sites.

Admin-only in practice: the Next.js admin pages are the only callers. Customers never reach these routes.
"""
import uuid
from datetime import datetime, timezone
from flask import Blueprint
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload
from app.routes.base import BaseView
from app.errors import ValidationError, ConflictError, NotFoundError
from app.models.app_rollout import AppRollout, AppRolloutSite, SiteApp
from app.models.site import Site
from app.services.github_account import current_token
from app.services.github_service import GitHubClient, APP_NAME, parse_repo_url

PROTECTED_APPS = frozenset({'frappe'})     # the framework itself is part of the platform image, not an App Store app
ACTIONS = ('install', 'update')
REQUIRED_HOLD = ('pending', 'running')


def iso(value):
    return value.isoformat() if value else None


def github(view):
    """A GitHub client using the connected account (or GITHUB_TOKEN), or anonymous access when neither exists."""
    with view.session() as session:
        token, _, _ = current_token(session, view.settings)
    return GitHubClient(token, view.settings.frappe_compatible_majors)


def app_name_arg(data):
    name = str(data.get('app_name', '')).strip()
    if not APP_NAME.fullmatch(name):
        raise ValidationError('Enter the Frappe app name (lowercase letters, numbers and underscores).')
    if name in PROTECTED_APPS:
        raise ValidationError('The Frappe framework is managed by the platform image and cannot be changed here.')
    return name


def site_state(site, installed, busy):
    """Why a site can or cannot take a rollout right now."""
    if busy:
        reason = 'Another app rollout is already running on this site.'
    elif site.status == 'ready' and not site.activity:
        reason = None
    elif site.activity:
        reason = 'The site is busy with another operation.'
    elif site.status == 'stopped':
        reason = 'The site is stopped. Start it first.'
    else:
        reason = f'The site is {site.status.replace("_", " ")}.'
    return {'eligible': reason is None, 'reason': reason}


def serialize_row(row, with_log=False):
    data = {'id': str(row.id), 'site_id': str(row.site_id), 'site_slug': row.site_slug, 'status': row.status, 'step': row.step,
            'progress': row.progress, 'from_version': row.from_version, 'from_commit': row.from_commit, 'to_version': row.to_version,
            'to_commit': row.to_commit, 'backup_stamp': row.backup_stamp, 'rolled_back': row.rolled_back, 'error': row.error,
            'operation_id': str(row.operation_id) if row.operation_id else None, 'started_at': iso(row.started_at), 'finished_at': iso(row.finished_at)}
    if with_log:
        data['log'] = row.log
    return data


def serialize_rollout(rollout, detail=False):
    rows = rollout.sites
    counts = {state: sum(1 for row in rows if row.status == state) for state in ('pending', 'running', 'success', 'failed', 'skipped')}
    data = {'id': str(rollout.id), 'app_name': rollout.app_name, 'repo_url': rollout.repo_url, 'branch': rollout.branch,
            'target_commit': rollout.target_commit, 'target_version': rollout.target_version, 'action': rollout.action, 'source': rollout.source,
            'status': rollout.status, 'note': rollout.note, 'created_by': rollout.created_by, 'created_at': iso(rollout.created_at),
            'finished_at': iso(rollout.finished_at), 'site_count': len(rows), 'counts': counts}
    if detail:
        data['sites'] = [serialize_row(row, with_log=True) for row in rows]
    return data


class AppInspectView(BaseView):
    """POST /inspect. Body: repo_url, branch?. Reads the repository's details, branches, latest commit and Frappe compatibility."""
    def post(self):
        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError('Request body must be an object.')
        return self.ok(github(self).inspect(str(data.get('repo_url', '')), data.get('branch')))


class AppInstallationsView(BaseView):
    """POST /installations. Body: app_name, repo_url?, branch?. Every site with what it runs of the app and whether it can take a rollout.

    With a repository, also says how far behind the branch head each distinct installed commit is.
    """
    def post(self):
        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError('Request body must be an object.')
        app = app_name_arg(data)
        with self.session() as session:
            rows = {row.site_id: row for row in session.scalars(select(SiteApp).where(SiteApp.app_name == app))}
            busy = set(session.scalars(select(AppRolloutSite.site_id).join(AppRollout).where(AppRollout.app_name == app, AppRolloutSite.status.in_(REQUIRED_HOLD))))
            sites = session.scalars(select(Site).options(joinedload(Site.server)).where(Site.status.notin_(('failed', 'deleting', 'cleanup_required', 'queued'))).order_by(Site.slug)).all()
            results = []
            for site in sites:
                installed = rows.get(site.id)
                results.append({'id': str(site.id), 'slug': site.slug, 'name': site.name, 'domain': site.domain, 'status': site.status,
                                'owner_email': site.owner_email, 'plan_name': site.plan_name, 'server_name': site.server.name if site.server else None,
                                'image': site.image,
                                'installed': {'version': installed.version, 'commit': installed.commit, 'branch': installed.branch, 'scanned_at': iso(installed.scanned_at)} if installed else None,
                                **site_state(site, installed, site.id in busy)})
        behind = {}
        if data.get('repo_url'):
            owner, repo = parse_repo_url(str(data['repo_url']))
            head = None
            try:
                head = github(self).commit(owner, repo, str(data.get('branch') or '').strip() or 'HEAD')['sha']
            except Exception:
                head = None
            if head:
                client = github(self)
                for commit in {item['installed']['commit'] for item in results if item['installed'] and item['installed']['commit']}:
                    if commit == head or len(behind) >= 8:
                        continue
                    comparison = client.compare(owner, repo, commit, head)
                    if comparison:
                        behind[commit] = comparison.get('ahead_by')
                for item in results:
                    installed = item['installed']
                    if installed:
                        installed['up_to_date'] = installed['commit'] == head if installed['commit'] else None
                        installed['commits_behind'] = behind.get(installed['commit']) if installed['commit'] != head else 0
        return self.ok({'app_name': app, 'results': results})


class AppSummaryView(BaseView):
    """GET /summary. For every app: how many sites run it and how many are on each commit (the App Store list view)."""
    def get(self):
        with self.session() as session:
            rows = session.execute(select(SiteApp.app_name, SiteApp.commit, func.count()).group_by(SiteApp.app_name, SiteApp.commit)).all()
        summary = {}
        for name, commit, count in rows:
            entry = summary.setdefault(name, {'sites': 0, 'commits': {}})
            entry['sites'] += count
            entry['commits'][commit or ''] = count
        return self.ok({'results': summary})


class AppScanView(BaseView):
    """POST /scan. Queues a read of the installed apps on every running site."""
    def post(self):
        from app.tasks.app_tasks import scan_apps_task
        try:
            scan_apps_task.apply_async(retry=False)
        except Exception:
            raise ConflictError('The background queue is unavailable. Try again shortly.')
        return self.ok({'queued': True}, 202)


class AppRolloutsView(BaseView):
    def get(self):
        app = self.str_arg('app_name')
        limit = self.int_arg('limit', 20, minimum=1, maximum=100)
        with self.session() as session:
            query = select(AppRollout).options(joinedload(AppRollout.sites)).order_by(AppRollout.created_at.desc()).limit(limit)
            if app:
                query = query.where(AppRollout.app_name == app)
            return self.ok({'results': [serialize_rollout(r) for r in session.scalars(query).unique()]})

    def post(self):
        """Body: app_name, repo_url, branch, action (install|update), site_ids (list) or all_sites (true), note?, commit?, allow_unverified?, created_by?"""
        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError('Request body must be an object.')
        app = app_name_arg(data)
        action = str(data.get('action', ''))
        if action not in ACTIONS:
            raise ValidationError('Choose whether to install or update the app.')
        note = str(data.get('note') or '').strip()[:500] or None
        info = github(self).inspect(str(data.get('repo_url', '')), data.get('branch'))
        if info['app_name'] != app:
            raise ValidationError(f'This repository contains the app "{info["app_name"]}", not "{app}".')
        compatibility = info['compatibility']
        if compatibility['status'] == 'incompatible':
            raise ValidationError(compatibility['reason'])
        if compatibility['status'] == 'unknown' and not data.get('allow_unverified'):
            raise ValidationError(compatibility['reason'] + ' Confirm to continue anyway.')
        commit = info['commit']['sha']
        if data.get('commit') and data['commit'] != commit:
            raise ConflictError('The branch has new commits since you opened this page. Check for updates and try again.')

        wanted = data.get('site_ids')
        if not data.get('all_sites') and (not isinstance(wanted, list) or not wanted):
            raise ValidationError('Choose at least one site, or roll out to all sites.')
        if wanted is not None and not isinstance(wanted, list):
            raise ValidationError('Sites must be a list.')
        with self.session() as session:
            installed = {row.site_id: row for row in session.scalars(select(SiteApp).where(SiteApp.app_name == app))}
            busy = set(session.scalars(select(AppRolloutSite.site_id).join(AppRollout).where(AppRollout.app_name == app, AppRolloutSite.status.in_(REQUIRED_HOLD))))
            candidates = session.scalars(select(Site).where(Site.status.notin_(('failed', 'deleting', 'cleanup_required', 'queued')))).all()
            chosen = []
            if data.get('all_sites'):
                for site in candidates:
                    has = site.id in installed
                    if site_state(site, None, site.id in busy)['eligible'] and (has if action == 'update' else not has):
                        if action == 'update' and installed[site.id].commit == commit:
                            continue            # already at the target; nothing to roll out
                        chosen.append(site)
            else:
                try:
                    ids = {uuid.UUID(str(value)) for value in wanted}
                except ValueError:
                    raise ValidationError('A selected site is not valid.')
                by_id = {site.id: site for site in candidates}
                for site_id in ids:
                    site = by_id.get(site_id)
                    if not site:
                        raise ValidationError('A selected site no longer exists.')
                    state = site_state(site, None, site_id in busy)
                    if not state['eligible']:
                        raise ConflictError(f'{site.slug}: {state["reason"]}')
                    has = site_id in installed
                    if action == 'update' and not has:
                        raise ValidationError(f'{site.slug} does not have {app} installed, so it cannot be updated. Install it instead.')
                    if action == 'install' and has:
                        raise ValidationError(f'{site.slug} already has {app} installed. Update it instead.')
                    chosen.append(site)
            if not chosen:
                raise ValidationError('There are no sites to roll this out to. Every matching site is already at this version, busy, or not running.')
            rollout = AppRollout(app_name=app, repo_url=info['repo_url'], branch=info['branch'], target_commit=commit, target_version=info['version'],
                                 action=action, note=note, private=bool(info.get('private')), created_by=str(data.get('created_by') or '')[:100] or None)
            session.add(rollout)
            session.flush()
            for site in sorted(chosen, key=lambda item: item.slug):
                previous = installed.get(site.id)
                session.add(AppRolloutSite(rollout_id=rollout.id, site_id=site.id, site_slug=site.slug, status='pending', step='Waiting in the queue',
                                           from_version=previous.version if previous else None, from_commit=previous.commit if previous else None))
            session.flush()
            row_ids = [str(row.id) for row in rollout.sites]
            rollout_id = str(rollout.id)
        self.enqueue(rollout_id, row_ids)
        with self.session() as session:
            return self.ok(serialize_rollout(session.scalar(select(AppRollout).options(joinedload(AppRollout.sites)).where(AppRollout.id == uuid.UUID(rollout_id))), detail=True), 202)

    @staticmethod
    def enqueue(rollout_id, row_ids):
        """Hand each site to the worker. Sites that could not be queued are marked failed so nothing waits forever."""
        from app.db import database
        from app.tasks.app_tasks import rollout_site_task, settle_rollout
        unqueued = []
        for row_id in row_ids:
            try:
                rollout_site_task.apply_async(args=[row_id], retry=False)
            except Exception:
                unqueued.append(row_id)
        if unqueued:
            with database.session() as session:
                for row_id in unqueued:
                    row = session.get(AppRolloutSite, uuid.UUID(row_id))
                    row.status, row.error, row.finished_at = 'failed', 'The background queue is unavailable. Retry when the worker is running.', datetime.now(timezone.utc)
            settle_rollout(uuid.UUID(rollout_id))


class AppRolloutDetailView(BaseView):
    def get(self, rollout_id):
        with self.session() as session:
            rollout = load_rollout(session, rollout_id)
            return self.ok(serialize_rollout(rollout, detail=True))


class AppRolloutRetryView(BaseView):
    """POST /rollouts/<id>/retry. Re-queues the sites that failed or were skipped. Sites that succeeded are not touched."""
    def post(self, rollout_id):
        with self.session() as session:
            rollout = load_rollout(session, rollout_id)
            again = [row for row in rollout.sites if row.status in ('failed', 'skipped')]
            if not again:
                raise ConflictError('No site in this rollout needs a retry.')
            for row in again:
                row.status, row.error, row.step, row.progress, row.finished_at, row.rolled_back = 'pending', None, 'Waiting in the queue', 0, None, False
                row.log = (row.log or '') + '--- retry ---\n'
            rollout.status, rollout.finished_at = 'running', None
            row_ids, rid = [str(row.id) for row in again], str(rollout.id)
        AppRolloutsView.enqueue(rid, row_ids)
        return self.ok({'queued': len(row_ids)}, 202)


def load_rollout(session, rollout_id):
    try:
        key = uuid.UUID(rollout_id)
    except ValueError:
        raise NotFoundError('Rollout not found.')
    rollout = session.scalar(select(AppRollout).options(joinedload(AppRollout.sites)).where(AppRollout.id == key))
    if not rollout:
        raise NotFoundError('Rollout not found.')
    return rollout


class SiteAppsView(BaseView):
    """The apps on one of a customer's sites, and installing another from the catalogue.

    GET  /sites/<id>?user_id=            what the site runs and whether it can take an install right now
    POST /sites/<id> {user_id, app_name, source, repo_url?, branch?}   queue an install on that one site

    The website decides who may install what (and charges for paid apps) before calling this; the controller still checks
    the site belongs to the user, is idle, and that the app is installable and works with this platform's Frappe.
    """
    def installed(self, session, site):
        rows = {row.app_name: row for row in session.scalars(select(SiteApp).where(SiteApp.site_id == site.id))}
        names = set(rows) | set(site.app_names or [])
        return rows, names

    def busy(self, session, site):
        return bool(session.scalar(select(AppRolloutSite.id).where(AppRolloutSite.site_id == site.id, AppRolloutSite.status.in_(REQUIRED_HOLD)).limit(1)))

    def get(self, site_id):
        from app.routes.site import owned_site
        with self.session() as session:
            site = owned_site(session, site_id, self.str_arg('user_id'))
            rows, names = self.installed(session, site)
            reason = site_state(site, None, self.busy(session, site))['reason']
            return self.ok({
                'apps': [{'app_name': name, 'version': rows[name].version if name in rows else None, 'branch': rows[name].branch if name in rows else None}
                         for name in sorted(names)],
                'can_install': reason is None, 'reason': reason,
            })

    def post(self, site_id):
        from app.routes.site import owned_site
        data = self.json_body()
        if not isinstance(data, dict):
            raise ValidationError('Request body must be an object.')
        user_id = str(data.get('user_id') or '')
        app = app_name_arg(data)
        source = str(data.get('source') or '')
        if source not in ('image', 'github'):
            raise ValidationError('Choose where the app comes from.')
        info = None
        if source == 'image':
            if app not in self.settings.frappe_available_apps:
                raise ValidationError('That application is not available on this platform yet.')
        else:
            info = github(self).inspect(str(data.get('repo_url', '')), data.get('branch'))
            if info['app_name'] != app:
                raise ValidationError(f'This repository contains the app "{info["app_name"]}", not "{app}".')
            compatibility = info['compatibility']
            if compatibility['status'] != 'compatible':
                raise ValidationError(compatibility['reason'] if compatibility['status'] == 'incompatible'
                                      else 'This application has not been verified against your site\'s Frappe version yet.')
        with self.session() as session:
            site = owned_site(session, site_id, user_id)
            reason = site_state(site, None, self.busy(session, site))['reason']
            if reason:
                raise ConflictError(reason)
            _, names = self.installed(session, site)
            if app in names:
                raise ConflictError('This application is already installed on your site.')
            rollout = AppRollout(
                app_name=app, source=source, action='install', created_by=f'customer:{user_id}'[:100],
                repo_url=info['repo_url'] if info else '', branch=info['branch'] if info else '',
                target_commit=info['commit']['sha'] if info else '', target_version=info['version'] if info else None,
                private=bool(info and info.get('private')),
            )
            session.add(rollout)
            session.flush()
            row = AppRolloutSite(rollout_id=rollout.id, site_id=site.id, site_slug=site.slug, status='pending', step='Waiting in the queue')
            session.add(row)
            session.flush()
            row_id, rollout_id = str(row.id), str(rollout.id)
        AppRolloutsView.enqueue(rollout_id, [row_id])
        with self.session() as session:
            if session.get(AppRolloutSite, uuid.UUID(row_id)).status == 'failed':
                # Nothing is going to run it, and the customer should hear that now rather than watch a site that never changes.
                raise ConflictError('The background queue is unavailable. Try again shortly.')
        return self.ok({'rollout_id': rollout_id, 'queued': True}, 202)

    PROTECTED_SITE_APPS = frozenset({'frappe', 'erpnext'})

    def delete(self, site_id):
        """DELETE /sites/<id>?user_id=&app_name=  remove an app from the site. Its data on this site is deleted; a backup is kept."""
        from app.routes.site import owned_site
        user_id = self.str_arg('user_id') or ''
        app = app_name_arg({'app_name': self.str_arg('app_name') or ''})
        if app in self.PROTECTED_SITE_APPS:
            raise ValidationError('This application is part of the site itself and cannot be removed.')
        with self.session() as session:
            site = owned_site(session, site_id, user_id)
            reason = site_state(site, None, self.busy(session, site))['reason']
            if reason:
                raise ConflictError(reason)
            _, names = self.installed(session, site)
            if app not in names:
                raise ConflictError('This application is not installed on your site.')
            rollout = AppRollout(app_name=app, source='image', action='uninstall', created_by=f'customer:{user_id}'[:100], repo_url='', branch='', target_commit='')
            session.add(rollout)
            session.flush()
            row = AppRolloutSite(rollout_id=rollout.id, site_id=site.id, site_slug=site.slug, status='pending', step='Waiting in the queue')
            session.add(row)
            session.flush()
            row_id, rollout_id = str(row.id), str(rollout.id)
        AppRolloutsView.enqueue(rollout_id, [row_id])
        with self.session() as session:
            if session.get(AppRolloutSite, uuid.UUID(row_id)).status == 'failed':
                raise ConflictError('The background queue is unavailable. Try again shortly.')
        return self.ok({'rollout_id': rollout_id, 'queued': True}, 202)

class AppRoutes:
    @classmethod
    def blueprint(cls, db=None, config=None):
        bp = Blueprint('apps', __name__, url_prefix='/api/v1/apps')
        for path, view, name in [('/inspect', AppInspectView, 'inspect'), ('/installations', AppInstallationsView, 'installations'),
                                 ('/scan', AppScanView, 'scan'), ('/sites/<site_id>', SiteAppsView, 'site_apps'), ('/summary', AppSummaryView, 'summary'), ('/rollouts', AppRolloutsView, 'rollouts'),
                                 ('/rollouts/<rollout_id>', AppRolloutDetailView, 'rollout'), ('/rollouts/<rollout_id>/retry', AppRolloutRetryView, 'rollout_retry')]:
            bp.add_url_rule(path, view_func=view.as_view(name, db=db, config=config))
        return bp
