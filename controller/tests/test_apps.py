import json
import unittest
import urllib.error
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from flask import Flask
from sqlalchemy import delete, select, text
from app.config import settings
from app.db import database
from app.errors import ApiError, ValidationError
from app.models.app_rollout import AppRollout, AppRolloutSite, SiteApp
from app.models.server import ServerNode
from app.models.site import Site
from app.routes.apps import AppRoutes
from app.routes.github import GithubRoutes
from app.models.app_rollout import GithubAccount
from app.services.frappe_service import FrappeService
from app.services.github_service import GitHubClient, assess_compatibility, branch_major, order_branches, parse_repo_url, range_allows, toml_frappe_range
from app.tasks import app_tasks

SHA_OLD, SHA_NEW = 'a' * 40, 'b' * 40


class GitHubParsingTests(unittest.TestCase):
    def test_only_github_repository_addresses_are_accepted(self):
        self.assertEqual(parse_repo_url('https://github.com/frappe/hrms'), ('frappe', 'hrms'))
        self.assertEqual(parse_repo_url('https://github.com/frappe/hrms.git/'), ('frappe', 'hrms'))
        for bad in ('http://github.com/frappe/hrms', 'https://gitlab.com/a/b', 'https://github.com/frappe', 'git@github.com:a/b.git', 'https://github.com/a/b/tree/main', '', 'https://github.com/a/b;rm -rf /'):
            with self.assertRaises(ValidationError, msg=bad):
                parse_repo_url(bad)

    def test_version_ranges(self):
        self.assertTrue(range_allows('>=15.0.0-dev,<16.0.0', 15))
        self.assertFalse(range_allows('>=15.0.0-dev,<16.0.0', 16))
        self.assertTrue(range_allows('>=16.50.0,<17.0.0', 16))        # a bound inside the major still admits it
        self.assertFalse(range_allows('>=17.0.0-dev,<18.0.0', 16))
        self.assertTrue(range_allows('~=15.2', 15))
        self.assertTrue(range_allows('', 99))

    def test_branch_names_claim_a_major(self):
        self.assertEqual(branch_major('version-15'), 15)
        self.assertEqual(branch_major('version-16-hotfix'), 16)
        self.assertIsNone(branch_major('develop'))

    def test_compatibility_prefers_the_declared_range_over_the_branch_name(self):
        self.assertEqual(assess_compatibility('develop', '>=15,<16', [15])['status'], 'compatible')
        self.assertEqual(assess_compatibility('version-15', '>=15,<16', [16])['status'], 'incompatible')
        self.assertEqual(assess_compatibility('version-15', None, [15])['status'], 'compatible')
        self.assertEqual(assess_compatibility('version-14', None, [15])['status'], 'incompatible')
        self.assertEqual(assess_compatibility('develop', None, [15])['status'], 'unknown')

    def test_pyproject_range_is_read_from_the_bench_table(self):
        text_ = '[tool.bench.frappe-dependencies]\nfrappe = ">=15.0.0,<16.0.0"\n'
        self.assertEqual(toml_frappe_range(text_), '>=15.0.0,<16.0.0')
        self.assertIsNone(toml_frappe_range('[project]\nname = "x"\n'))
        self.assertIsNone(toml_frappe_range('not toml ['))

    def test_branches_list_default_first_then_releases_newest_first(self):
        names = ['feature/x', 'mergify/bp/y', 'version-14', 'develop', 'version-16', 'version-15']
        self.assertEqual(order_branches(names, 'develop'), ['develop', 'version-16', 'version-15', 'version-14', 'feature/x', 'mergify/bp/y'])


class FakeGitHub:
    def __init__(self, routes):
        self.routes, self.requests = routes, []

    def __call__(self, request, timeout=None):
        url = request.full_url
        self.requests.append(url)
        for fragment, body in self.routes.items():
            if fragment in url:
                payload = body if isinstance(body, str) else json.dumps(body)
                return MagicMock(__enter__=lambda s: MagicMock(read=lambda: payload.encode()), __exit__=lambda *a: False)
        raise urllib.error.HTTPError(url, 404, 'not found', {}, None)


def repo_routes(**overrides):
    routes = {
        '/repos/o/shop/branches': [{'name': 'develop'}, {'name': 'version-15'}],
        '/repos/o/shop/commits/': {'sha': SHA_NEW, 'commit': {'message': 'fix: thing\n\nbody', 'committer': {'date': '2026-01-01T00:00:00Z'}, 'author': {'name': 'A'}}},
        '/git/trees/': {'tree': [{'path': 'shop', 'type': 'tree'}, {'path': 'docs', 'type': 'tree'}, {'path': 'README.md', 'type': 'blob'}]},
        '/shop/hooks.py': 'app_name = "shop"\napp_title = "Shop"\napp_description = "Sell things"\napp_publisher = "Me"\n',
        '/pyproject.toml': '[tool.bench.frappe-dependencies]\nfrappe = ">=15.0.0,<16.0.0"\n',
        '/shop/__init__.py': '__version__ = "15.1.0"\n',
        '/repos/o/shop': {'private': False, 'archived': False, 'default_branch': 'develop', 'description': 'A shop', 'stargazers_count': 3, 'license': {'spdx_id': 'MIT'}, 'html_url': 'https://github.com/o/shop'},
    }
    routes.update(overrides)
    return routes


class GitHubInspectTests(unittest.TestCase):
    def inspect(self, branch=None, majors=(15,), **overrides):
        fake = FakeGitHub(repo_routes(**overrides))
        return GitHubClient(majors=list(majors), opener=fake).inspect('https://github.com/o/shop', branch)

    def test_details_branches_and_compatibility_are_fetched(self):
        info = self.inspect('version-15')
        self.assertEqual((info['app_name'], info['title'], info['version'], info['branch']), ('shop', 'Shop', '15.1.0', 'version-15'))
        self.assertEqual(info['commit']['sha'], SHA_NEW)
        self.assertEqual(info['commit']['message'], 'fix: thing')
        self.assertEqual(info['branches'], ['develop', 'version-15'])
        self.assertEqual(info['compatibility']['status'], 'compatible')

    def test_the_default_branch_is_used_when_none_is_given(self):
        self.assertEqual(self.inspect()['branch'], 'develop')

    def test_an_app_for_another_frappe_version_is_reported_incompatible(self):
        self.assertEqual(self.inspect(majors=(16,))['compatibility']['status'], 'incompatible')

    def test_unknown_branch_private_and_archived_repositories_and_non_apps_are_refused(self):
        with self.assertRaisesRegex(ValidationError, 'does not exist'):
            self.inspect('nope')
        with self.assertRaisesRegex(ValidationError, 'is private'):
            self.inspect(**{'/repos/o/shop': {'private': True}})
        with self.assertRaisesRegex(ValidationError, 'archived'):
            self.inspect(**{'/repos/o/shop': {'private': False, 'archived': True}})
        with self.assertRaisesRegex(ValidationError, 'not look like a Frappe app'):
            self.inspect(**{'/git/trees/': {'tree': [{'path': 'src', 'type': 'tree'}]}, '/hooks.py': ''})

    def test_a_missing_repository_and_github_limits_give_readable_errors(self):
        client = GitHubClient(opener=FakeGitHub({}))
        with self.assertRaisesRegex(ApiError, 'could not find'):
            client.inspect('https://github.com/o/missing')

        def limited(request, timeout=None):
            raise urllib.error.HTTPError(request.full_url, 403, 'rate', {}, None)
        with self.assertRaisesRegex(ApiError, 'limiting'):
            GitHubClient(opener=limited).inspect('https://github.com/o/shop')


class RolloutTestCase(unittest.TestCase):
    def setUp(self):
        self.customer = 'apps-test-' + uuid.uuid4().hex
        self.server = uuid.uuid4()
        with database.session() as session:
            session.execute(text('INSERT INTO "User" (id,email,"passwordHash",role,"createdAt","updatedAt") VALUES (:id,:email,:password,\'CUSTOMER\',now(),now())'),
                            {'id': self.customer, 'email': self.customer + '@example.test', 'password': 'test-only'})
            session.add(ServerNode(id=self.server, name=self.customer, ip_address='127.0.0.1', role='worker', frappe_enabled=True, is_active=True))
        self.sites = {}

    def tearDown(self):
        with database.session() as session:
            session.execute(delete(AppRollout).where(AppRollout.app_name == 'shop'))
            session.execute(delete(Site).where(Site.user_id == self.customer))
            session.execute(delete(ServerNode).where(ServerNode.id == self.server))
            session.execute(text('DELETE FROM "User" WHERE id=:id'), {'id': self.customer})

    def make_site(self, slug, status='ready', installed=None, activity=None, image='frappe/erpnext:v15.123.0'):
        with database.session() as session:
            site = Site(user_id=self.customer, request_key=str(uuid.uuid4()), name=slug, slug=slug, domain=slug + '.example.test', server_id=self.server,
                        port=30000 + len(self.sites), image=image, app_names=['erpnext'], status=status, activity=activity, admin_password='x', db_password='x')
            session.add(site)
            session.flush()
            if installed:
                session.add(SiteApp(site_id=site.id, app_name='shop', **installed))
            self.sites[slug] = str(site.id)
        return self.sites[slug]


class RolloutApiTests(RolloutTestCase):
    def setUp(self):
        super().setUp()
        config = SimpleNamespace(**vars(settings))
        config.frappe_compatible_majors = [15]
        flask = Flask(__name__)
        flask.register_blueprint(AppRoutes.blueprint(db=database, config=config))
        flask.register_error_handler(ApiError, lambda error: (error.to_dict(), error.status_code))
        self.client = flask.test_client()
        self.info = {'repo_url': 'https://github.com/o/shop', 'app_name': 'shop', 'branch': 'version-15', 'version': '15.1.0',
                     'commit': {'sha': SHA_NEW}, 'compatibility': {'status': 'compatible', 'reason': ''}}
        patches = [patch('app.routes.apps.GitHubClient.inspect', side_effect=lambda *a, **k: self.info),
                   patch('app.routes.apps.GitHubClient.commit', return_value={'sha': SHA_NEW}),
                   patch('app.routes.apps.GitHubClient.compare', return_value={'ahead_by': 4}),
                   patch('app.tasks.app_tasks.rollout_site_task.apply_async')]
        self.queue = [p.start() for p in patches][3]
        self.patches = patches

    def tearDown(self):
        for p in self.patches:
            p.stop()
        super().tearDown()

    def roll(self, **body):
        data = {'app_name': 'shop', 'repo_url': 'https://github.com/o/shop', 'branch': 'version-15', 'action': 'update', 'all_sites': True}
        data.update(body)
        return self.client.post('/api/v1/apps/rollouts', json=data)

    def test_installations_list_every_site_with_its_version_and_whether_it_can_take_a_rollout(self):
        self.make_site('old-one', installed={'version': '15.0.0', 'commit': SHA_OLD})
        self.make_site('current', installed={'version': '15.1.0', 'commit': SHA_NEW})
        self.make_site('bare')
        self.make_site('off', status='stopped')
        body = self.client.post('/api/v1/apps/installations', json={'app_name': 'shop', 'repo_url': 'https://github.com/o/shop', 'branch': 'version-15'}).json
        rows = {r['slug']: r for r in body['results'] if r['slug'] in self.sites}
        self.assertEqual(rows['old-one']['installed']['commits_behind'], 4)
        self.assertFalse(rows['old-one']['installed']['up_to_date'])
        self.assertTrue(rows['current']['installed']['up_to_date'])
        self.assertIsNone(rows['bare']['installed'])
        self.assertTrue(rows['bare']['eligible'])
        self.assertFalse(rows['off']['eligible'])
        self.assertIn('stopped', rows['off']['reason'])

    def test_update_all_picks_only_ready_sites_that_run_an_older_version(self):
        self.make_site('stale', installed={'version': '15.0.0', 'commit': SHA_OLD})
        self.make_site('fresh', installed={'version': '15.1.0', 'commit': SHA_NEW})
        self.make_site('bare')
        self.make_site('asleep', status='stopped', installed={'version': '15.0.0', 'commit': SHA_OLD})
        response = self.roll()
        self.assertEqual(response.status_code, 202, response.json)
        self.assertEqual([s['site_slug'] for s in response.json['sites']], ['stale'])
        self.assertEqual(response.json['target_commit'], SHA_NEW)
        self.assertEqual(self.queue.call_count, 1)

    def test_only_the_chosen_sites_are_rolled_out(self):
        for slug in ('a-site', 'b-site', 'c-site'):
            self.make_site(slug, installed={'version': '15.0.0', 'commit': SHA_OLD})
        response = self.roll(all_sites=False, site_ids=[self.sites['a-site'], self.sites['c-site']])
        self.assertEqual(response.status_code, 202, response.json)
        self.assertEqual([s['site_slug'] for s in response.json['sites']], ['a-site', 'c-site'])

    def test_selection_is_validated_against_what_each_site_runs(self):
        self.make_site('has-it', installed={'version': '15.0.0', 'commit': SHA_OLD})
        self.make_site('lacks-it')
        self.make_site('asleep', status='stopped', installed={'version': '15.0.0', 'commit': SHA_OLD})
        self.assertEqual(self.roll(all_sites=False, site_ids=[self.sites['lacks-it']]).status_code, 422)             # cannot update what is not there
        self.assertEqual(self.roll(all_sites=False, site_ids=[self.sites['has-it']], action='install').status_code, 422)
        self.assertEqual(self.roll(all_sites=False, site_ids=[self.sites['asleep']]).status_code, 409)
        self.assertEqual(self.roll(all_sites=False, site_ids=[]).status_code, 422)
        self.assertEqual(self.roll(all_sites=False, site_ids=['not-a-uuid']).status_code, 422)
        self.assertEqual(self.roll(all_sites=False, site_ids=[str(uuid.uuid4())]).status_code, 422)
        self.assertEqual(self.queue.call_count, 0)

    def test_install_goes_to_sites_without_the_app(self):
        self.make_site('has-it', installed={'version': '15.0.0', 'commit': SHA_OLD})
        self.make_site('lacks-it')
        response = self.roll(action='install')
        slugs = {s['site_slug'] for s in response.json['sites']}
        self.assertIn('lacks-it', slugs)
        self.assertNotIn('has-it', slugs)

    def test_incompatible_unverified_and_stale_requests_are_refused(self):
        self.make_site('stale', installed={'version': '15.0.0', 'commit': SHA_OLD})
        self.info['compatibility'] = {'status': 'incompatible', 'reason': 'Needs Frappe 14.'}
        self.assertEqual(self.roll().status_code, 422)
        self.info['compatibility'] = {'status': 'unknown', 'reason': 'Not declared.'}
        self.assertEqual(self.roll().status_code, 422)
        self.assertEqual(self.roll(allow_unverified=True).status_code, 202)
        self.assertEqual(self.roll(commit=SHA_OLD, allow_unverified=True).status_code, 409)       # the branch moved since the page loaded
        self.info['app_name'] = 'other'
        self.assertEqual(self.roll(allow_unverified=True).status_code, 422)
        self.assertEqual(self.roll(app_name='frappe').status_code, 422)                           # the framework is not an App Store app
        self.assertEqual(self.roll(action='remove').status_code, 422)

    def test_a_site_in_a_running_rollout_cannot_be_picked_again(self):
        self.make_site('stale', installed={'version': '15.0.0', 'commit': SHA_OLD})
        self.assertEqual(self.roll().status_code, 202)
        again = self.roll(all_sites=False, site_ids=[self.sites['stale']])
        self.assertEqual(again.status_code, 409)
        self.assertIn('already running', again.json['error'])

    def test_unqueueable_sites_are_failed_instead_of_waiting_forever_and_can_be_retried(self):
        self.make_site('stale', installed={'version': '15.0.0', 'commit': SHA_OLD})
        self.queue.side_effect = OSError('redis down')
        response = self.roll()
        detail = self.client.get('/api/v1/apps/rollouts/' + response.json['id']).json
        self.assertEqual(detail['status'], 'failed')
        self.assertEqual(detail['sites'][0]['status'], 'failed')
        self.queue.side_effect = None
        retry = self.client.post(f'/api/v1/apps/rollouts/{response.json["id"]}/retry')
        self.assertEqual(retry.json, {'queued': 1})
        self.assertEqual(self.client.get('/api/v1/apps/rollouts/' + response.json['id']).json['status'], 'running')
        self.assertEqual(self.client.post(f'/api/v1/apps/rollouts/{response.json["id"]}/retry').status_code, 409)   # nothing left to retry

    def test_history_lists_rollouts_newest_first_and_unknown_ids_404(self):
        self.make_site('stale', installed={'version': '15.0.0', 'commit': SHA_OLD})
        self.roll()
        history = self.client.get('/api/v1/apps/rollouts?app_name=shop').json['results']
        self.assertEqual(history[0]['counts']['pending'], 1)
        self.assertEqual(self.client.get('/api/v1/apps/rollouts/' + str(uuid.uuid4())).status_code, 404)
        self.assertEqual(self.client.get('/api/v1/apps/rollouts/nope').status_code, 404)


class FakeService:
    APP_SERVICES = ['backend']

    def __init__(self, site_image, installed, fail_at=None):
        self.site = SimpleNamespace(image=site_image)
        self.server = SimpleNamespace(name='test-worker')
        self.calls, self.installed, self.fail_at, self.discarded = [], installed, fail_at, []
        self.health = True

    def _step(self, name):
        self.calls.append(name)
        if self.fail_at == name:
            raise RuntimeError(f'{name} exploded with password=hunter2')

    def installed_apps(self):
        self._step('installed_apps')
        return dict(self.installed)

    def image_tag(self, stamp):
        return 'unityalgo-site-test:' + stamp

    def build_app_image(self, *args, **kwargs):
        self._step('build')

    def use_image(self, image):
        self.calls.append('use_image:' + image)
        self.site.image = image

    def run(self, arguments, timeout=0):
        self.calls.append('run:' + arguments[0])

    def infrastructure(self):
        return ['db']

    def apply_app_change(self, app, action):
        self._step('apply:' + action)
        if action == 'update':
            self.installed['shop'] = {'version': '15.1.0', 'commit': SHA_NEW, 'branch': 'version-15'}
        else:
            self.installed['shop'] = {'version': '15.1.0', 'commit': SHA_NEW, 'branch': 'version-15'}

    def start(self):
        self._step('start')

    def healthy(self):
        return self.health

    def restore(self, stamp):
        self.calls.append('restore:' + stamp)

    def apply_limits(self, limit):
        self.calls.append('limits')

    def install_bundled_app(self, app):
        self._step('bundled:' + app)
        self.installed[app] = {'version': '1.0.0', 'commit': None, 'branch': None}

    def restart(self):
        self._step('restart')

    def uninstall_app(self, app):
        self._step('uninstall:' + app)
        self.installed.pop(app, None)

    def discard_images(self, keep=None):
        self.discarded.append(keep)


class RolloutTaskTests(RolloutTestCase):
    def prepare(self, site_status='ready', installed=True, action='update', fail_at=None, activity=None):
        site_id = self.make_site('task-site', status=site_status, activity=activity,
                                 installed={'version': '15.0.0', 'commit': SHA_OLD, 'branch': 'version-15'} if installed else None)
        with database.session() as session:
            rollout = AppRollout(app_name='shop', repo_url='https://github.com/o/shop', branch='version-15', target_commit=SHA_NEW, target_version='15.1.0', action=action)
            session.add(rollout)
            session.flush()
            row = AppRolloutSite(rollout_id=rollout.id, site_id=uuid.UUID(site_id), site_slug='task-site')
            session.add(row)
            session.flush()
            self.row_id, self.rollout_id = str(row.id), rollout.id
        state = {'shop': {'version': '15.0.0', 'commit': SHA_OLD, 'branch': 'version-15'}} if installed else {}
        self.service = FakeService('frappe/erpnext:v15.123.0', state, fail_at)
        self.patches = [patch('app.tasks.app_tasks.build_service', return_value=self.service),
                        patch('app.tasks.app_tasks.run_backup', return_value=('ok', ['20260101_000000'])),
                        patch('app.tasks.app_tasks.time.sleep')]
        for p in self.patches:
            p.start()
        self.addCleanup(lambda: [p.stop() for p in self.patches])
        return site_id

    def run_task(self):
        app_tasks.rollout_site_task.run(self.row_id)

    def row(self):
        with database.session() as session:
            row = session.get(AppRolloutSite, uuid.UUID(self.row_id))
            session.expunge(row)
            return row

    def site(self, site_id):
        with database.session() as session:
            site = session.get(Site, uuid.UUID(site_id))
            session.expunge(site)
            return site

    def rollout(self):
        with database.session() as session:
            rollout = session.get(AppRollout, self.rollout_id)
            session.expunge(rollout)
            return rollout

    def test_a_successful_update_swaps_the_image_migrates_and_records_the_new_version(self):
        site_id = self.prepare()
        self.run_task()
        row, site = self.row(), self.site(site_id)
        self.assertEqual((row.status, row.progress, row.to_commit, row.to_version, row.backup_stamp), ('success', 100, SHA_NEW, '15.1.0', '20260101_000000'))
        self.assertEqual((site.status, site.error), ('ready', None))
        self.assertTrue(site.image.startswith('unityalgo-site-test:'))
        self.assertLess(self.service.calls.index('build'), self.service.calls.index([c for c in self.service.calls if c.startswith('use_image')][0]))   # the live site is not touched until the build works
        self.assertIn('apply:update', self.service.calls)
        self.assertEqual(self.rollout().status, 'completed')
        with database.session() as session:
            record = session.scalar(select(SiteApp).where(SiteApp.site_id == uuid.UUID(site_id), SiteApp.app_name == 'shop'))
            self.assertEqual(record.commit, SHA_NEW)

    def test_an_install_adds_the_app_to_the_site(self):
        site_id = self.prepare(installed=False, action='install')
        self.run_task()
        self.assertEqual(self.row().status, 'success')
        self.assertIn('apply:install', self.service.calls)
        self.assertIn('shop', self.site(site_id).app_names)

    def test_a_site_already_at_the_target_commit_is_left_alone(self):
        self.prepare()
        self.service.installed['shop']['commit'] = SHA_NEW
        self.run_task()
        self.assertEqual(self.row().status, 'success')
        self.assertNotIn('build', self.service.calls)
        self.assertEqual(self.row().step, 'Already up to date')

    def test_a_busy_or_stopped_site_is_skipped_not_forced(self):
        for kwargs in ({'site_status': 'stopped'}, {'activity': 'backup'}):
            with self.subTest(kwargs):
                self.tearDown(); self.setUp()
                self.prepare(**kwargs)
                self.run_task()
                self.assertEqual(self.row().status, 'skipped')
                self.assertEqual(self.service.calls, [])
                self.assertEqual(self.rollout().status, 'failed')

    def test_the_requested_action_must_match_what_the_site_has(self):
        self.prepare(installed=False, action='update')
        with self.assertRaises(RuntimeError):
            self.run_task()
        self.assertEqual(self.row().status, 'failed')
        self.assertIn('not installed', self.row().error)
        self.assertNotIn('build', self.service.calls)

    def test_a_failed_build_leaves_the_running_site_alone(self):
        site_id = self.prepare(fail_at='build')
        with self.assertRaises(RuntimeError):
            self.run_task()
        row, site = self.row(), self.site(site_id)
        self.assertEqual((row.status, row.rolled_back), ('failed', False))
        self.assertEqual((site.status, site.image), ('ready', 'frappe/erpnext:v15.123.0'))
        self.assertFalse([c for c in self.service.calls if c.startswith(('use_image', 'run:'))])
        self.assertNotIn('hunter2', row.error)             # secrets never reach the stored error
        self.assertEqual(self.rollout().status, 'failed')

    def test_a_failed_migration_puts_back_the_old_image_and_the_old_data(self):
        site_id = self.prepare(fail_at='apply:update')
        with self.assertRaises(RuntimeError):
            self.run_task()
        row, site = self.row(), self.site(site_id)
        self.assertEqual((row.status, row.rolled_back), ('failed', True))
        self.assertEqual((site.status, site.image), ('ready', 'frappe/erpnext:v15.123.0'))
        self.assertIn('restore:20260101_000000', self.service.calls)
        self.assertIn('use_image:frappe/erpnext:v15.123.0', self.service.calls)
        self.assertEqual(self.service.discarded[-1], 'frappe/erpnext:v15.123.0')      # the failed image is removed

    def test_a_site_that_cannot_be_recovered_is_stopped_and_says_so(self):
        site_id = self.prepare(fail_at='apply:update')
        self.service.health = False
        with self.assertRaises(RuntimeError):
            self.run_task()
        site = self.site(site_id)
        self.assertEqual(site.status, 'stopped')
        self.assertIn('safety backup', site.error)
        self.assertFalse(self.row().rolled_back)

    def test_a_private_repository_is_built_with_the_connected_account_or_fails_clearly(self):
        self.prepare()
        with database.session() as session:
            session.get(AppRollout, self.rollout_id).private = True
        with patch('app.tasks.app_tasks.current_token', return_value=(None, None, None)):
            with self.assertRaises(RuntimeError):
                self.run_task()
        self.assertIn('no GitHub account is connected', self.row().error)
        self.assertEqual(self.site(self.sites['task-site']).status, 'ready')
        self.tearDown(); self.setUp()
        self.prepare()
        with database.session() as session:
            session.get(AppRollout, self.rollout_id).private = True
        seen = []
        self.service.build_app_image = lambda *args, **kwargs: seen.append(kwargs.get('token'))
        with patch('app.tasks.app_tasks.current_token', return_value=(TOKEN_OK, 'account', None)):
            self.run_task()
        self.assertEqual(seen, [TOKEN_OK])
        self.assertEqual(self.row().status, 'success')
        self.assertNotIn(TOKEN_OK, (self.row().log or '') + (self.row().error or ''))

    def test_a_partial_rollout_is_reported_as_partial(self):
        self.prepare()
        with database.session() as session:
            other = self.make_site('other-site', installed={'version': '15.0.0', 'commit': SHA_OLD})
            session.add(AppRolloutSite(rollout_id=self.rollout_id, site_id=uuid.UUID(other), site_slug='other-site', status='failed', error='x'))
        self.run_task()
        self.assertEqual(self.rollout().status, 'partial')


TOKEN_OK = 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'


class GithubAccountTests(unittest.TestCase):
    def setUp(self):
        with database.session() as session:
            self.saved = [(row.login, row.name, row.avatar_url, row.html_url, row.scopes, row.token, row.connected_by) for row in session.scalars(select(GithubAccount))]
            session.execute(delete(GithubAccount))
        config = SimpleNamespace(**vars(settings))
        config.github_token = None
        flask = Flask(__name__)
        flask.register_blueprint(GithubRoutes.blueprint(db=database, config=config))
        flask.register_error_handler(ApiError, lambda error: (error.to_dict(), error.status_code))
        self.client = flask.test_client()
        self.account = {'login': 'octo', 'name': 'Octo Cat', 'avatar_url': 'https://a/x.png', 'html_url': 'https://github.com/octo', 'scopes': 'repo', 'rate_limit': '5000', 'rate_remaining': '4999'}

    def tearDown(self):
        with database.session() as session:
            session.execute(delete(GithubAccount))
            for login, name, avatar, html, scopes, token, by in self.saved:
                session.add(GithubAccount(login=login, name=name, avatar_url=avatar, html_url=html, scopes=scopes, token=token, connected_by=by))

    def test_nothing_is_connected_to_begin_with(self):
        self.assertEqual(self.client.get('/api/v1/github/account').json['connected'], False)
        self.assertEqual(self.client.get('/api/v1/github/repositories').json, {'results': [], 'connected': False})

    def test_connecting_checks_the_token_with_github_and_stores_it_encrypted(self):
        with patch('app.routes.github.GitHubClient.account', return_value=self.account):
            response = self.client.put('/api/v1/github/account', json={'token': TOKEN_OK, 'connected_by': 'admin@example.test'})
            self.assertEqual(response.status_code, 200, response.json)
            self.assertNotIn(TOKEN_OK, json.dumps(response.json))              # the token is never echoed back
            status = self.client.get('/api/v1/github/account').json
        self.assertEqual((status['connected'], status['source'], status['login'], status['rate_remaining']), (True, 'account', 'octo', '4999'))
        with database.session() as session:
            stored = session.execute(text('SELECT token FROM github_accounts')).scalar()
            self.assertNotIn(TOKEN_OK, stored)
            self.assertEqual(session.scalar(select(GithubAccount)).token, TOKEN_OK)

    def test_connecting_again_replaces_the_account_and_disconnect_removes_it(self):
        with patch('app.routes.github.GitHubClient.account', return_value=self.account):
            self.client.put('/api/v1/github/account', json={'token': TOKEN_OK})
            self.client.put('/api/v1/github/account', json={'token': TOKEN_OK[:-1] + 'X'})
        with database.session() as session:
            self.assertEqual(len(session.scalars(select(GithubAccount)).all()), 1)
        self.assertEqual(self.client.delete('/api/v1/github/account').status_code, 204)
        self.assertEqual(self.client.get('/api/v1/github/account').json['connected'], False)

    def test_bad_tokens_are_refused_before_and_after_asking_github(self):
        for bad in ('', 'short', 'has spaces in it and is long enough yes', 'x' * 300):
            self.assertEqual(self.client.put('/api/v1/github/account', json={'token': bad}).status_code, 422, bad)
        with patch('app.routes.github.GitHubClient.account', side_effect=ApiError('GitHub rejected the saved token. Reconnect your GitHub account.', 502)):
            rejected = self.client.put('/api/v1/github/account', json={'token': TOKEN_OK})
        self.assertEqual(rejected.status_code, 422)
        self.assertIn('rejected', rejected.json['error'])
        with database.session() as session:
            self.assertIsNone(session.scalar(select(GithubAccount)))

    def test_a_revoked_token_shows_as_a_problem_not_as_a_crash(self):
        with patch('app.routes.github.GitHubClient.account', return_value=self.account):
            self.client.put('/api/v1/github/account', json={'token': TOKEN_OK})
        with patch('app.routes.github.GitHubClient.account', side_effect=ApiError('GitHub rejected the saved token. Reconnect your GitHub account.', 502)):
            status = self.client.get('/api/v1/github/account').json
        self.assertTrue(status['connected'])
        self.assertIn('rejected', status['problem'])

    def test_repositories_are_listed_for_the_picker(self):
        with patch('app.routes.github.GitHubClient.account', return_value=self.account):
            self.client.put('/api/v1/github/account', json={'token': TOKEN_OK})
        listing = [{'full_name': 'octo/private-app', 'private': True}]
        with patch('app.routes.github.GitHubClient.repositories', return_value=listing):
            self.assertEqual(self.client.get('/api/v1/github/repositories').json, {'results': listing, 'connected': True})


class PrivateRepositoryTests(unittest.TestCase):
    def test_a_private_repository_needs_a_token_and_is_read_through_the_api(self):
        private = repo_routes(**{'/repos/o/shop': {'private': True, 'archived': False, 'default_branch': 'develop', 'html_url': 'https://github.com/o/shop'}})
        with self.assertRaisesRegex(ValidationError, 'is private'):
            GitHubClient(majors=[15], opener=FakeGitHub(private)).inspect('https://github.com/o/shop')
        fake = FakeGitHub(private)
        info = GitHubClient(token=TOKEN_OK, majors=[15], opener=fake).inspect('https://github.com/o/shop')
        self.assertTrue(info['private'])
        self.assertEqual(info['app_name'], 'shop')
        self.assertFalse([url for url in fake.requests if 'raw.githubusercontent.com' in url])      # raw.* cannot see private files
        self.assertTrue([url for url in fake.requests if '/contents/shop/hooks.py' in url or '/shop/hooks.py' in url])

    def test_the_token_is_only_ever_sent_to_the_github_api(self):
        seen = []

        def opener(request, timeout=None):
            seen.append((request.full_url, request.get_header('Authorization')))
            return FakeGitHub(repo_routes())(request, timeout)
        GitHubClient(majors=[15], opener=opener).inspect('https://github.com/o/shop')
        self.assertTrue(all(auth is None for _, auth in seen))
        seen.clear()
        GitHubClient(token=TOKEN_OK, majors=[15], opener=opener).inspect('https://github.com/o/shop')
        self.assertTrue(all(auth == 'Bearer ' + TOKEN_OK for url, auth in seen if url.startswith('https://api.github.com')))
        self.assertTrue(all(auth is None for url, auth in seen if not url.startswith('https://api.github.com')))

    def test_a_rejected_token_and_a_hidden_repository_say_different_things(self):
        def rejected(request, timeout=None):
            raise urllib.error.HTTPError(request.full_url, 401, 'bad', {}, None)
        with self.assertRaisesRegex(ApiError, 'Reconnect'):
            GitHubClient(token=TOKEN_OK, opener=rejected).inspect('https://github.com/o/shop')
        with self.assertRaisesRegex(ApiError, 'connect a GitHub account'):
            GitHubClient(opener=FakeGitHub({})).inspect('https://github.com/o/shop')
        with self.assertRaisesRegex(ApiError, 'cannot see it'):
            GitHubClient(token=TOKEN_OK, opener=FakeGitHub({})).inspect('https://github.com/o/shop')

    def test_the_token_never_enters_the_image_or_a_command_line(self):
        class Recorder:
            def __init__(self):
                self.commands, self.files = [], {}

            def connect(self):
                outer = self

                class Sftp:
                    def __enter__(s): return s
                    def __exit__(s, *a): return False
                    def mkdir(s, path): pass
                    def chmod(s, path, mode): outer.files.setdefault(path, {})['mode'] = mode
                    def open(s, path, mode): return Handle(path)

                class Handle:
                    def __init__(h, path): h.path = path
                    def __enter__(h): return h
                    def __exit__(h, *a): return False
                    def write(h, content): outer.files.setdefault(h.path, {})['content'] = content

                class Client:
                    def __enter__(c): return c
                    def __exit__(c, *a): return False
                    def open_sftp(c): return Sftp()
                return Client()

            def run(self, command, timeout=None):
                self.commands.append(command)
                return SimpleNamespace(ok=True, exit_code=0, stdout='', stderr='')
        site = SimpleNamespace(id='00000000-0000-0000-0000-0000000000aa', image='frappe/erpnext:v15.123.0', db_password='b', admin_password='a', domain='e.example.test', port=30010, app_names=['erpnext'])
        with patch('app.services.frappe_service.SSHService'):
            service = FrappeService(site, SimpleNamespace(dial_host='h'), SimpleNamespace())
        service.ssh = recorder = Recorder()
        service.build_app_image('shop', 'https://github.com/o/shop', 'main', SHA_NEW, 'tag:1', token=TOKEN_OK)
        self.assertFalse([c for c in recorder.commands if TOKEN_OK in c])                              # not on any command line
        dockerfile = next(f['content'] for path, f in recorder.files.items() if path.endswith('Dockerfile.app'))
        self.assertNotIn(TOKEN_OK, dockerfile)
        self.assertIn('COPY --chown=frappe:frappe src apps/shop', dockerfile)
        self.assertNotIn('git clone', dockerfile)
        secret = next(path for path in recorder.files if path.endswith('.gh-token'))
        self.assertEqual(recorder.files[secret]['mode'], 0o600)
        self.assertTrue([c for c in recorder.commands if secret in c and c.startswith('rm -f')])        # removed again, even before the build
        self.assertLess(next(i for i, c in enumerate(recorder.commands) if c.startswith('rm -f')), next(i for i, c in enumerate(recorder.commands) if c.startswith('docker build')))


class CustomerInstallApiTests(RolloutTestCase):
    """A customer installing an app from the catalogue onto one of their own sites."""

    def setUp(self):
        super().setUp()
        config = SimpleNamespace(**vars(settings))
        config.frappe_compatible_majors = [15]
        config.frappe_available_apps = ['erpnext', 'lending']
        flask = Flask(__name__)
        flask.register_blueprint(AppRoutes.blueprint(db=database, config=config))
        flask.register_error_handler(ApiError, lambda error: (error.to_dict(), error.status_code))
        self.client = flask.test_client()
        self.info = {'repo_url': 'https://github.com/o/shop', 'app_name': 'shop', 'branch': 'version-15', 'version': '15.1.0',
                     'commit': {'sha': SHA_NEW}, 'compatibility': {'status': 'compatible', 'reason': ''}, 'private': False}
        self.patches = [patch('app.routes.apps.GitHubClient.inspect', side_effect=lambda *a, **k: self.info),
                        patch('app.tasks.app_tasks.rollout_site_task.apply_async')]
        self.queue = [p.start() for p in self.patches][1]

    def tearDown(self):
        for p in self.patches:
            p.stop()
        super().tearDown()

    def install(self, site_id, **body):
        data = {'user_id': self.customer, 'app_name': 'lending', 'source': 'image'}
        data.update(body)
        return self.client.post(f'/api/v1/apps/sites/{site_id}', json=data)

    def test_an_app_that_ships_in_the_image_is_queued_for_that_site_only(self):
        mine, other = self.make_site('mine'), self.make_site('other')
        response = self.install(mine)
        self.assertEqual(response.status_code, 202, response.json)
        self.assertEqual(self.queue.call_count, 1)
        with database.session() as session:
            rollout = session.get(AppRollout, uuid.UUID(response.json['rollout_id']))
            self.assertEqual((rollout.source, rollout.action, rollout.created_by, [r.site_slug for r in rollout.sites]), ('image', 'install', f'customer:{self.customer}', ['mine']))
            self.assertEqual(session.scalars(select(AppRolloutSite).where(AppRolloutSite.site_id == uuid.UUID(other))).all(), [])

    def test_a_repository_app_is_inspected_and_pinned_to_the_commit_seen(self):
        site_id = self.make_site('mine')
        response = self.install(site_id, app_name='shop', source='github', repo_url='https://github.com/o/shop', branch='version-15')
        self.assertEqual(response.status_code, 202, response.json)
        with database.session() as session:
            rollout = session.get(AppRollout, uuid.UUID(response.json['rollout_id']))
            self.assertEqual((rollout.source, rollout.target_commit, rollout.repo_url), ('github', SHA_NEW, 'https://github.com/o/shop'))

    def test_only_apps_that_work_with_this_platform_are_installable(self):
        site_id = self.make_site('mine')
        self.assertEqual(self.install(site_id, app_name='unlisted').status_code, 422)           # not in the image
        self.assertEqual(self.install(site_id, app_name='frappe').status_code, 422)             # the framework itself
        self.assertEqual(self.install(site_id, source='ftp').status_code, 422)
        self.info['compatibility'] = {'status': 'unknown', 'reason': 'Not declared.'}
        self.assertEqual(self.install(site_id, app_name='shop', source='github', repo_url='x').status_code, 422)   # customers do not get "install anyway"
        self.info['compatibility'] = {'status': 'incompatible', 'reason': 'Needs Frappe 14.'}
        self.assertEqual(self.install(site_id, app_name='shop', source='github', repo_url='x').json['error'], 'Needs Frappe 14.')
        self.assertEqual(self.queue.call_count, 0)

    def test_it_must_be_the_customers_own_idle_site_without_the_app(self):
        busy = self.make_site('busy', activity='backup')
        stopped = self.make_site('stopped', status='stopped')
        has = self.make_site('has-it', installed={'version': '1.0.0', 'commit': None})
        mine = self.make_site('mine')
        self.assertEqual(self.install(mine, user_id='somebody-else').status_code, 404)
        self.assertEqual(self.install(busy).status_code, 409)
        self.assertEqual(self.install(stopped).status_code, 409)
        self.assertEqual(self.install(has, app_name='shop', source='github', repo_url='x').status_code, 409)
        self.assertEqual(self.install(mine).status_code, 202)
        self.assertEqual(self.install(mine).status_code, 409)                                   # a second click while the first is queued

    def test_an_unqueueable_install_is_refused_instead_of_left_waiting(self):
        site_id = self.make_site('mine')
        self.queue.side_effect = OSError('redis down')
        response = self.install(site_id)
        self.assertEqual(response.status_code, 409)
        self.assertIn('queue is unavailable', response.json['error'])

    def test_the_site_reports_what_it_runs_and_whether_it_can_take_an_install(self):
        site_id = self.make_site('mine', installed={'version': '1.2.3', 'commit': SHA_OLD, 'branch': 'version-15'})
        body = self.client.get(f'/api/v1/apps/sites/{site_id}?user_id={self.customer}').json
        names = {a['app_name']: a for a in body['apps']}
        self.assertEqual(names['shop']['version'], '1.2.3')
        self.assertIn('erpnext', names)
        self.assertTrue(body['can_install'])
        self.assertEqual(self.client.get(f'/api/v1/apps/sites/{site_id}?user_id=somebody-else').status_code, 404)

    def remove(self, site_id, app='shop', user=None):
        return self.client.delete(f'/api/v1/apps/sites/{site_id}?user_id={user or self.customer}&app_name={app}')

    def test_removing_an_installed_app_queues_a_removal_for_that_site(self):
        site_id = self.make_site('mine', installed={'version': '1.0.0', 'commit': None})
        response = self.remove(site_id)
        self.assertEqual(response.status_code, 202, response.json)
        with database.session() as session:
            rollout = session.get(AppRollout, uuid.UUID(response.json['rollout_id']))
            self.assertEqual((rollout.action, rollout.created_by), ('uninstall', f'customer:{self.customer}'))

    def test_only_apps_that_are_installed_and_not_part_of_the_site_can_be_removed(self):
        site_id = self.make_site('mine')
        self.assertEqual(self.remove(site_id).status_code, 409)                         # not installed
        self.assertEqual(self.remove(site_id, app='erpnext').status_code, 422)          # part of the site
        self.assertEqual(self.remove(site_id, app='frappe').status_code, 422)
        self.assertEqual(self.remove(site_id, user='somebody-else').status_code, 404)
        busy = self.make_site('busy', activity='backup', installed={'version': '1.0.0', 'commit': None})
        self.assertEqual(self.remove(busy).status_code, 409)
        self.assertEqual(self.queue.call_count, 0)


class CustomerInstallTaskTests(RolloutTaskTests):
    """The worker side: an app that ships in the image is installed without building anything."""

    def bundled(self, **kwargs):
        site_id = self.prepare(installed=False, action='install', **kwargs)
        with database.session() as session:
            rollout = session.get(AppRollout, self.rollout_id)
            rollout.source, rollout.created_by = 'image', f'customer:{self.customer}'
        return site_id

    def test_a_bundled_app_is_installed_and_the_site_restarted_without_a_build(self):
        site_id = self.bundled()
        with patch('app.tasks.app_tasks.notify') as notify:
            self.run_task()
        self.assertEqual(self.row().status, 'success')
        self.assertIn('bundled:shop', self.service.calls)
        self.assertIn('restart', self.service.calls)
        self.assertFalse([c for c in self.service.calls if c in ('build',) or c.startswith('use_image')])
        self.assertIn('shop', self.site(site_id).app_names)
        notify.assert_called_with(site_id, 'app_installed', app='shop')

    def test_a_failed_bundled_install_puts_the_data_back_and_tells_the_customer(self):
        site_id = self.bundled(fail_at='bundled:shop')
        with patch('app.tasks.app_tasks.notify') as notify, self.assertRaises(RuntimeError):
            self.run_task()
        row, site = self.row(), self.site(site_id)
        self.assertEqual((row.status, row.rolled_back), ('failed', True))
        self.assertIn('restore:20260101_000000', self.service.calls)
        self.assertEqual(site.status, 'ready')
        self.assertIn('could not be installed', site.error)
        notify.assert_called_with(site_id, 'app_failed', app='shop')

    def removal(self, **kwargs):
        site_id = self.prepare(installed=True, action='uninstall', **kwargs)
        with database.session() as session:
            rollout = session.get(AppRollout, self.rollout_id)
            rollout.source, rollout.created_by = 'image', f'customer:{self.customer}'
            session.get(Site, uuid.UUID(site_id)).app_names = ['erpnext', 'shop']
        return site_id

    def test_removing_an_app_takes_a_backup_removes_it_and_forgets_it(self):
        site_id = self.removal()
        with patch('app.tasks.app_tasks.notify') as notify:
            self.run_task()
        self.assertEqual(self.row().status, 'success')
        self.assertIn('uninstall:shop', self.service.calls)
        self.assertEqual(self.site(site_id).app_names, ['erpnext'])
        with database.session() as session:
            self.assertIsNone(session.scalar(select(SiteApp).where(SiteApp.site_id == uuid.UUID(site_id), SiteApp.app_name == 'shop')))
        notify.assert_called_with(site_id, 'app_removed', app='shop')

    def test_a_failed_removal_restores_the_data_and_keeps_the_app(self):
        site_id = self.removal(fail_at='uninstall:shop')
        with patch('app.tasks.app_tasks.notify') as notify, self.assertRaises(RuntimeError):
            self.run_task()
        self.assertEqual(self.row().rolled_back, True)
        self.assertIn('restore:20260101_000000', self.service.calls)
        self.assertEqual(self.site(site_id).app_names, ['erpnext', 'shop'])
        self.assertIn('could not be removed', self.site(site_id).error)
        notify.assert_called_with(site_id, 'app_removal_failed', app='shop')

    def test_removing_an_app_that_is_not_there_fails_without_touching_the_site(self):
        self.prepare(installed=False, action='uninstall')
        with patch('app.tasks.app_tasks.notify'), self.assertRaises(RuntimeError):
            self.run_task()
        self.assertNotIn('uninstall:shop', self.service.calls)
        self.assertNotIn('backup', ' '.join(self.service.calls))

    def test_an_admin_started_failure_is_not_phrased_for_a_customer(self):
        site_id = self.prepare(installed=False, action='install', fail_at='build')
        with patch('app.tasks.app_tasks.notify') as notify, self.assertRaises(RuntimeError):
            self.run_task()
        self.assertIsNone(self.site(site_id).error)
        notify.assert_not_called()


if __name__ == '__main__':
    unittest.main()
