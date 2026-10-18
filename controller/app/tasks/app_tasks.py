import time
import uuid
from datetime import datetime, timezone
from sqlalchemy import delete, select
from app.config import settings
from app.db import database
from app.models.app_rollout import AppRollout, AppRolloutSite, SiteApp
from app.models.site import Site
from app.services.github_account import current_token
from app.services.activity_logger import ActivityLogger, redact
from app.services.site_runtime import build_service
from app.tasks.celery_app import celery_app
from app.tasks.site_tasks import notify, run_backup

LOG_LIMIT = 24000


def now():
    return datetime.now(timezone.utc)


def mark(row_id, message=None, **fields):
    """Update a site's rollout row and append a line to its log."""
    with database.session() as session:
        row = session.get(AppRolloutSite, uuid.UUID(row_id))
        if not row:
            return
        for key, value in fields.items():
            setattr(row, key, value)
        if message:
            row.log = ((row.log or '') + '[%s] %s\n' % (now().strftime('%H:%M:%S'), redact(message)))[-LOG_LIMIT:]


def settle_rollout(rollout_id):
    """Close the rollout once none of its sites is still waiting or running."""
    with database.session() as session:
        rollout = session.scalar(select(AppRollout).where(AppRollout.id == rollout_id).with_for_update())
        if not rollout:
            return
        states = [row.status for row in rollout.sites]
        if any(state in ('pending', 'running') for state in states):
            rollout.status = 'running'
            return
        done = states.count('success')
        rollout.status = 'completed' if done == len(states) else ('failed' if done == 0 else 'partial')
        rollout.finished_at = now()


def record_app(session, site_id, name, info):
    row = session.scalar(select(SiteApp).where(SiteApp.site_id == site_id, SiteApp.app_name == name))
    if not row:
        row = SiteApp(site_id=site_id, app_name=name)
        session.add(row)
    row.version, row.commit, row.branch, row.scanned_at = info.get('version'), info.get('commit'), info.get('branch'), now()


class RolloutTask(celery_app.Task):
    abstract = True

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        if not args:
            return
        with database.session() as session:
            row = session.get(AppRolloutSite, uuid.UUID(args[0]))
            if not row or row.status not in ('pending', 'running'):
                return
            row.status, row.error, row.finished_at = 'failed', 'The update was interrupted before it finished.', now()
            site = session.get(Site, row.site_id)
            if site and site.status == 'updating':
                site.status, site.message = 'stopped', 'An update was interrupted. Start the site to continue.'
                site.error = 'An application update was interrupted. Start the site, or contact support.'
            rollout_id = row.rollout_id
        settle_rollout(rollout_id)


@celery_app.task(bind=True, base=RolloutTask, name='apps.rollout_site', soft_time_limit=3300, time_limit=3500)
def rollout_site_task(self, row_id):
    with database.session() as session:
        row = session.get(AppRolloutSite, uuid.UUID(row_id))
        if not row or row.status != 'pending':
            return
        rollout = row.rollout
        spec = {'app': rollout.app_name, 'url': rollout.repo_url, 'branch': rollout.branch, 'commit': rollout.target_commit,
                'version': rollout.target_version, 'action': rollout.action, 'private': rollout.private,
                'bundled': rollout.source == 'image', 'customer': (rollout.created_by or '').startswith('customer:')}
        rollout_id = rollout.id
        site = session.scalar(select(Site).where(Site.id == row.site_id).with_for_update())
        if site is None or site.status != 'ready' or site.activity:
            row.status, row.finished_at = 'skipped', now()
            row.error = 'The site was not running, or was busy with another operation. Retry when it is idle.'
            skipped = True
        else:
            skipped = False
            site.status, site.error = 'updating', None
            site.message = {'install': f'Installing {rollout.app_name}.', 'uninstall': f'Removing {rollout.app_name}.'}.get(rollout.action, 'Updating an application.') + ' The site may be briefly unavailable…'
            row.status, row.started_at, row.step, row.progress = 'running', now(), 'Preparing', 5
            service = build_service(session, site)
            slug, user_limit, previous_image, site_id = site.slug, site.user_limit, site.image, str(site.id)
    if skipped:
        settle_rollout(rollout_id)
        return

    app, commit = spec['app'], spec['commit']
    bundled = spec['bundled']
    removing = spec['action'] == 'uninstall'
    in_place = bundled or removing          # these change the site's data but not its image
    state = {'switched': False, 'touched': False, 'backup': None, 'image': None}
    def progress(percent, step, message=None):
        mark(row_id, message or step, step=step, progress=percent)

    def wait_healthy(minutes=6):
        for _ in range(minutes * 12):
            if service.healthy():
                return
            time.sleep(5)
        raise RuntimeError('The application did not become healthy.')

    try:
        with ActivityLogger().operation('site.app_rollout', f'App {spec["action"]}: {app} on {slug}', category='deployment', tenant_slug=slug, server_name=service.server.name) as op:
            mark(row_id, operation_id=uuid.UUID(str(op.operation_id)))
            progress(10, 'Reading what the site runs now')
            before = service.installed_apps().get(app)
            effective = 'update' if before else 'install'
            if removing and not before:
                raise RuntimeError(f'{app} is not installed on this site, so there is nothing to remove.')
            if not removing and effective != spec['action']:
                raise RuntimeError(f'{app} is already installed on this site; use an update.' if before else f'{app} is not installed on this site, so there is nothing to update; install it first.')
            mark(row_id, from_version=(before or {}).get('version'), from_commit=(before or {}).get('commit'))
            op.ok('Current state', message=f'{app}: ' + (f"{before.get('version')} @ {(before.get('commit') or '')[:8]}" if before else 'not installed'))
            if not removing and before and before.get('commit') == commit:
                with database.session() as session:
                    site = session.get(Site, uuid.UUID(site_id))
                    site.status, site.message = 'ready', 'Your site is ready.'
                    record_app(session, site.id, app, before)
                mark(row_id, f'{app} is already at this version.', status='success', step='Already up to date', progress=100, to_version=before.get('version'), to_commit=commit, finished_at=now())
                op.ok('Already up to date')
            else:
                progress(20, 'Taking a safety backup')
                _, made = run_backup(service, site_id, 'safety')
                state['backup'] = made[0] if made else None
                mark(row_id, backup_stamp=state['backup'])
                op.ok('Safety backup taken', message=state['backup'] or 'none')

                if removing:
                    progress(40, 'Removing the app')
                    state['touched'] = True
                    service.uninstall_app(app)
                    op.ok('App removed')
                    progress(80, 'Restarting the site')
                    service.restart()
                    wait_healthy()
                    if app in service.installed_apps():
                        raise RuntimeError(f'{app} is still installed on the site after the removal.')
                    with database.session() as session:
                        site = session.get(Site, uuid.UUID(site_id))
                        site.status, site.message, site.error = 'ready', 'Your site is ready.', None
                        site.app_names = [name for name in (site.app_names or []) if name != app]
                        session.execute(delete(SiteApp).where(SiteApp.site_id == site.id, SiteApp.app_name == app))
                    mark(row_id, f'{app} removed.', status='success', step='Done', progress=100, finished_at=now())
                    op.ok('Removal completed')
                elif bundled:
                    progress(40, 'Installing the app')
                    state['touched'] = True
                    service.install_bundled_app(app)
                    op.ok('App installed')
                    progress(80, 'Restarting the site')
                    service.restart()
                    wait_healthy()
                    after = service.installed_apps().get(app)
                    if not after:
                        raise RuntimeError(f'{app} is not installed on the site after the install.')
                    with database.session() as session:
                        site = session.get(Site, uuid.UUID(site_id))
                        site.status, site.message, site.error = 'ready', 'Your site is ready.', None
                        site.app_names = list(dict.fromkeys([*(site.app_names or []), app]))
                        record_app(session, site.id, app, {**after, 'branch': None})
                    mark(row_id, f'{app} installed.', status='success', step='Done', progress=100,
                         to_version=after.get('version'), to_commit=after.get('commit') or commit, finished_at=now())
                    op.ok('Install completed')
                else:
                    state['image'] = service.image_tag(now().strftime('%Y%m%d%H%M%S'))
                    progress(30, 'Building the new version (the site keeps running)', f'Building image {state["image"]} from {spec["url"]} @ {commit[:8]}')
                    token = None
                    if spec['private']:
                        with database.session() as session:
                            token, _, _ = current_token(session, settings)
                        if not token:
                            raise RuntimeError('This repository is private and no GitHub account is connected. Connect one in the App Store.')
                    service.build_app_image(app, spec['url'], spec['branch'], commit, state['image'], token=token)
                    op.ok('Image built', message=state['image'])

                    progress(60, 'Switching to the new version')
                    service.use_image(state['image'])
                    state['switched'] = True
                    service.run(['stop', *service.APP_SERVICES], timeout=300)
                    service.run(['up', '-d', '--wait', '--wait-timeout', '180', *service.infrastructure()], timeout=400)

                    progress(70, 'Installing the app' if effective == 'install' else 'Migrating the site')
                    state['touched'] = True
                    service.apply_app_change(app, effective)
                    op.ok('Site migrated')

                    progress(88, 'Starting the site')
                    service.start()
                    wait_healthy()
                    after = service.installed_apps().get(app)
                    if not after:
                        raise RuntimeError(f'{app} is not installed on the site after the update.')
                    if after.get('commit') and after['commit'] != commit:
                        raise RuntimeError(f'{app} is at {after["commit"][:8]}, not the requested {commit[:8]}.')
                    with database.session() as session:
                        site = session.get(Site, uuid.UUID(site_id))
                        site.image, site.status, site.message, site.error = state['image'], 'ready', 'Your site is ready.', None
                        site.app_names = list(dict.fromkeys([*(site.app_names or []), app]))
                        record_app(session, site.id, app, {**after, 'branch': spec['branch']})
                    mark(row_id, f'{app} {effective}ed at {commit[:8]}.', status='success', step='Done', progress=100,
                         to_version=after.get('version') or spec['version'], to_commit=after.get('commit') or commit, finished_at=now())
                    op.ok('Update completed')
                    try:
                        service.discard_images(keep=state['image'])
                    except Exception:
                        pass
    except Exception as exc:
        changed = state['switched'] or (in_place and state['touched'])
        recovered = not changed
        if changed:
            try:
                if state['switched']:
                    service.use_image(previous_image)
                if state['touched'] and state['backup']:
                    mark(row_id, 'Putting the previous data back from the safety backup.')
                    service.restore(state['backup'])
                service.start()
                wait_healthy()
                service.apply_limits(user_limit)
                recovered = True
            except Exception as rollback_exc:
                mark(row_id, 'Rollback failed: %s' % str(rollback_exc)[:600])
        try:
            if state['image']:
                service.discard_images(keep=previous_image)
        except Exception:
            pass
        reason = redact(str(exc))[-2500:]
        with database.session() as session:
            site = session.get(Site, uuid.UUID(site_id))
            if recovered:
                site.status, site.message = 'ready', 'Your site is ready.'
                site.error = (f'{app} could not be {"removed" if removing else "installed"}. Your site was returned to how it was.' if spec['customer'] else None)
            else:
                site.status, site.message = 'stopped', 'An application update failed and the site could not be restored.'
                site.error = 'An application update failed. The site has been stopped; contact support. A safety backup is kept.'
            if site.image != previous_image:
                site.image = previous_image
        mark(row_id, 'Failed: ' + reason[:600], status='failed', error=reason, rolled_back=bool(changed and recovered),
             step='Failed' + (' — rolled back' if changed and recovered else ''), finished_at=now())
        settle_rollout(rollout_id)
        if spec['customer']:
            notify(site_id, 'app_removal_failed' if removing else 'app_failed', app=app)
        raise
    if spec['customer']:
        notify(site_id, 'app_removed' if removing else 'app_installed', app=app)
    settle_rollout(rollout_id)


@celery_app.task(name='apps.scan', soft_time_limit=3000, time_limit=3300)
def scan_apps_task(site_ids=None):
    with database.session() as session:
        query = select(Site).where(Site.status == 'ready', Site.activity.is_(None))
        if site_ids is not None:
            query = query.where(Site.id.in_([uuid.UUID(i) for i in site_ids]))
        sites = [(str(site.id), site.slug) for site in session.scalars(query)]
    for site_id, slug in sites:
        try:
            with database.session() as session:
                site = session.get(Site, uuid.UUID(site_id))
                if not site or site.status != 'ready' or site.activity:
                    continue
                service = build_service(session, site)
            found = service.installed_apps()
            with database.session() as session:
                existing = {row.app_name: row for row in session.scalars(select(SiteApp).where(SiteApp.site_id == uuid.UUID(site_id)))}
                for name, info in found.items():
                    record_app(session, uuid.UUID(site_id), name, info)
                for name, row in existing.items():
                    if name not in found:
                        session.delete(row)
        except Exception as exc:
            ActivityLogger().event('health', 'site.app_scan', 'App version scan failed', status='warning', message=str(exc)[:300], tenant_slug=slug)
