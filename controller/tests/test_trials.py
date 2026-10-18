import unittest
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from flask import Flask
from sqlalchemy import delete, text

from app.db import database
from app.errors import ApiError, ConflictError
from app.models.site import Site
from app.models.site_extras import SiteTrial
from app.routes.site import SiteRoutes
from app.services import trials
from app.tasks import trial_tasks
from tests.test_apps import RolloutTestCase

NOW = datetime.now(timezone.utc)


class TrialTestCase(RolloutTestCase):
    def setUp(self):
        super().setUp()
        config = SimpleNamespace(site_trial_warning_days=3, frappe_site_domain='x.test')
        flask = Flask(__name__)
        flask.register_blueprint(SiteRoutes.blueprint(db=database, config=config))
        flask.register_error_handler(ApiError, lambda error: (error.to_dict(), error.status_code))
        self.client = flask.test_client()
        self.plan = 'plan-' + uuid.uuid4().hex[:8]
        self.queue = patch('app.tasks.site_tasks.site_action_task.apply_async')
        self.queued = self.queue.start()
        self.notify = patch('app.tasks.trial_tasks.notify')
        self.notified = self.notify.start()
        self.subscribed = patch('app.services.trials.has_subscription', return_value=False)
        self.subscription = self.subscribed.start()
        self.room = patch('app.routes.site.has_room', return_value=True)
        self.room.start()

    def tearDown(self):
        for p in (self.queue, self.notify, self.subscribed, self.room):
            p.stop()
        with database.session() as session:
            session.execute(delete(SiteTrial).where(SiteTrial.user_id == self.customer))
        super().tearDown()

    def trial_site(self, slug, ends_in_days, status='ready', **fields):
        site_id = self.make_site(slug, status=status)
        with database.session() as session:
            site = session.get(Site, uuid.UUID(site_id))
            site.plan_id, site.plan_name = self.plan, 'Starter'
            site.trial_ends_at = NOW + timedelta(days=ends_in_days)
            for key, value in fields.items():
                setattr(site, key, value)
        return site_id

    def site(self, site_id):
        with database.session() as session:
            site = session.get(Site, uuid.UUID(site_id))
            session.expunge(site)
            return site


class TrialLifecycleTests(TrialTestCase):
    def test_a_site_whose_trial_has_ended_and_whose_owner_has_not_subscribed_is_switched_off(self):
        site_id = self.trial_site('ended', -1)
        self.assertEqual(trial_tasks.handle(site_id), 'expired')
        site = self.site(site_id)
        self.assertEqual(site.status, 'stopping')
        self.assertIsNotNone(site.trial_expired_at)
        self.queued.assert_called_once_with(args=[site_id, 'deactivate', 'ready'], retry=False)
        self.notified.assert_called_once_with(site_id, 'trial_ended')

    def test_a_stopped_site_is_deactivated_too_and_remembers_it_was_stopped(self):
        site_id = self.trial_site('ended-stopped', -1, status='stopped')
        trial_tasks.handle(site_id)
        self.queued.assert_called_once_with(args=[site_id, 'deactivate', 'stopped'], retry=False)

    def test_a_trial_still_running_is_left_alone_until_it_is_close_to_ending(self):
        site_id = self.trial_site('plenty', 10)
        self.assertEqual(trial_tasks.handle(site_id), 'none')
        self.queued.assert_not_called()
        self.notified.assert_not_called()

    def test_the_customer_is_warned_once_when_the_end_is_near(self):
        site_id = self.trial_site('nearly', 2)
        self.assertEqual(trial_tasks.handle(site_id), 'warned')
        self.assertEqual(trial_tasks.handle(site_id), 'none')                          # not again on the next sweep
        self.notified.assert_called_once_with(site_id, 'trial_ending')
        self.assertTrue(self.site(site_id).trial_warned)

    def test_subscribing_before_the_end_keeps_the_site_for_good(self):
        self.subscription.return_value = True
        site_id = self.trial_site('paid', 1)
        self.assertEqual(trial_tasks.handle(site_id), 'converted')
        site = self.site(site_id)
        self.assertIsNone(site.trial_ends_at)
        self.assertEqual(site.status, 'ready')
        self.queued.assert_not_called()

    def test_subscribing_after_the_site_was_switched_off_brings_it_back(self):
        self.subscription.return_value = True
        site_id = self.trial_site('late', -3, status='deactivated', trial_expired_at=NOW - timedelta(days=2))
        self.assertEqual(trial_tasks.handle(site_id), 'converted')
        self.assertEqual(self.site(site_id).status, 'restarting')
        self.queued.assert_called_once_with(args=[site_id, 'reactivate', 'deactivated'], retry=False)

    def test_a_busy_site_is_switched_off_at_the_next_sweep_not_mid_operation(self):
        site_id = self.trial_site('busy', -1, activity='backup')
        self.assertEqual(trial_tasks.handle(site_id), 'waiting')
        self.assertIsNone(self.site(site_id).trial_expired_at)
        self.queued.assert_not_called()

    def test_an_unavailable_queue_leaves_the_site_as_it_was_for_the_next_sweep(self):
        self.queued.side_effect = OSError('redis down')
        site_id = self.trial_site('queue-down', -1)
        self.assertEqual(trial_tasks.handle(site_id), 'queue_unavailable')
        site = self.site(site_id)
        self.assertEqual((site.status, site.trial_expired_at), ('ready', None))

    def test_the_sweep_covers_every_trial_site_and_can_be_narrowed_to_one_customer(self):
        a, b = self.trial_site('sweep-a', -1), self.trial_site('sweep-b', 10)
        outcome = trial_tasks.expire_trials_task.run(user_id=self.customer, plan_id=self.plan)
        self.assertEqual((outcome[a], outcome[b]), ('expired', 'none'))
        self.assertEqual(trial_tasks.expire_trials_task.run(user_id='nobody'), {})

    def test_what_the_customer_sees(self):
        site = SimpleNamespace(trial_ends_at=NOW + timedelta(days=2, hours=3), trial_expired_at=None, plan_id='p')
        self.assertEqual((trials.describe(site)['days_left'], trials.describe(site)['expired']), (3, False))
        site.trial_ends_at = NOW - timedelta(hours=1)
        self.assertEqual((trials.describe(site)['days_left'], trials.describe(site)['expired']), (0, True))
        self.assertIsNone(trials.describe(SimpleNamespace(trial_ends_at=None)))

    def test_the_subscription_check_reads_the_customers_active_subscription_to_that_plan(self):
        self.subscribed.stop()
        try:
            with database.session() as session:
                plan = session.execute(text('SELECT id, "productId" FROM "Plan" LIMIT 1')).first()
                session.execute(text('INSERT INTO "Subscription" (id,"userId","planId","productId",status,"startedAt","createdAt","updatedAt","cancelAtPeriodEnd") VALUES (:id,:u,:p,:prod,\'ACTIVE\',now(),now(),now(),false)'),
                                {'id': 'trial-test-' + uuid.uuid4().hex[:8], 'u': self.customer, 'p': plan[0], 'prod': plan[1]})
            with database.session() as session:
                self.assertTrue(trials.has_subscription(session, self.customer, plan[0]))
                self.assertFalse(trials.has_subscription(session, self.customer, 'another-plan'))
                self.assertFalse(trials.has_subscription(session, 'someone-else', plan[0]))
                session.execute(text('UPDATE "Subscription" SET status = \'CANCELED\' WHERE "userId" = :u'), {'u': self.customer})
            with database.session() as session:
                self.assertFalse(trials.has_subscription(session, self.customer, plan[0]))
        finally:
            with database.session() as session:
                session.execute(text('DELETE FROM "Subscription" WHERE "userId" = :u'), {'u': self.customer})
            self.subscribed.start()


class TrialOnceTests(TrialTestCase):
    def test_each_customer_gets_each_plans_trial_once(self):
        site_id = self.make_site('first')
        with database.session() as session:
            site = session.get(Site, uuid.UUID(site_id))
            site.plan_id = self.plan
            trials.begin(session, site, 14)
            self.assertIsNotNone(site.trial_ends_at)
        other = self.make_site('second')
        with database.session() as session:
            site = session.get(Site, uuid.UUID(other))
            site.plan_id = self.plan
            with self.assertRaises(ConflictError):
                trials.begin(session, site, 14)
        with database.session() as session:
            self.assertEqual(trials.used_plan_ids(session, self.customer), [self.plan])

    def test_a_trial_site_that_never_became_usable_gives_the_trial_back(self):
        site_id = self.make_site('failed-start')
        with database.session() as session:
            site = session.get(Site, uuid.UUID(site_id))
            site.plan_id = self.plan
            trials.begin(session, site, 14)
        with database.session() as session:
            trials.release_if_unused(session, session.get(Site, uuid.UUID(site_id)))
        with database.session() as session:
            self.assertEqual(trials.used_plan_ids(session, self.customer), [])

    def test_a_trial_that_was_used_stays_used_when_the_site_is_deleted(self):
        site_id = self.make_site('used')
        with database.session() as session:
            site = session.get(Site, uuid.UUID(site_id))
            site.plan_id = self.plan
            trials.begin(session, site, 14)
        with database.session() as session:
            trials.activated(session, uuid.UUID(site_id))
        with database.session() as session:
            trials.release_if_unused(session, session.get(Site, uuid.UUID(site_id)))
        with database.session() as session:
            self.assertEqual(trials.used_plan_ids(session, self.customer), [self.plan])

    def test_the_customer_can_ask_which_trials_they_have_used(self):
        site_id = self.make_site('asked')
        with database.session() as session:
            site = session.get(Site, uuid.UUID(site_id))
            site.plan_id = self.plan
            trials.begin(session, site, 5)
        self.assertEqual(self.client.get(f'/api/v1/sites/trials?user_id={self.customer}').json, {'used_plan_ids': [self.plan]})
        self.assertEqual(self.client.get('/api/v1/sites/trials').status_code, 422)


class TrialAccessTests(TrialTestCase):
    def test_a_customer_cannot_switch_on_a_site_whose_trial_has_ended_but_an_admin_can(self):
        site_id = self.trial_site('locked', -2, status='deactivated', trial_expired_at=NOW - timedelta(days=1))
        refused = self.client.post(f'/api/v1/sites/{site_id}/actions/reactivate', json={'user_id': self.customer})
        self.assertEqual(refused.status_code, 409)
        self.assertIn('trial has ended', refused.json['error'])
        allowed = self.client.post(f'/api/v1/sites/admin/{site_id}/actions/reactivate', json={})
        self.assertEqual(allowed.status_code, 202, allowed.json)

    def test_a_site_that_is_not_a_trial_is_unaffected(self):
        site_id = self.make_site('normal', status='deactivated')
        response = self.client.post(f'/api/v1/sites/{site_id}/actions/reactivate', json={'user_id': self.customer})
        self.assertEqual(response.status_code, 202, response.json)

    def test_the_site_reports_its_trial_to_its_owner(self):
        site_id = self.trial_site('shown', 5)
        body = self.client.get(f'/api/v1/sites/{site_id}?user_id={self.customer}').json
        self.assertEqual((body['trial']['days_left'], body['trial']['expired']), (5, False))
        self.assertIsNone(self.client.get(f'/api/v1/sites/{self.make_site("plain")}?user_id={self.customer}').json['trial'])

    def test_an_admin_can_extend_a_trial_and_that_brings_an_ended_site_back(self):
        site_id = self.trial_site('extend', -2, status='deactivated', trial_expired_at=NOW - timedelta(days=1))
        body = self.client.post(f'/api/v1/sites/admin/{site_id}/trial', json={'days': 7}).json
        self.assertFalse(body['trial']['expired'])
        self.assertGreaterEqual(body['trial']['days_left'], 6)
        self.queued.assert_called_once_with(args=[site_id, 'reactivate', 'deactivated'], retry=False)

    def test_an_admin_can_end_a_trial_now(self):
        site_id = self.trial_site('end-now', 20)
        self.client.post(f'/api/v1/sites/admin/{site_id}/trial', json={'end': True})
        self.assertEqual(self.site(site_id).status, 'stopping')
        self.queued.assert_called_once_with(args=[site_id, 'deactivate', 'ready'], retry=False)

    def test_trial_changes_are_validated(self):
        site_id = self.trial_site('valid', 5)
        self.assertEqual(self.client.post(f'/api/v1/sites/admin/{site_id}/trial', json={'days': 0}).status_code, 422)
        self.assertEqual(self.client.post(f'/api/v1/sites/admin/{site_id}/trial', json={'days': 9999}).status_code, 422)
        self.assertEqual(self.client.post(f'/api/v1/sites/admin/{self.make_site("not-trial")}/trial', json={'days': 3}).status_code, 409)

    def test_subscribing_asks_for_the_customers_trials_to_be_checked_now(self):
        with patch('app.tasks.trial_tasks.expire_trials_task.apply_async') as sweep:
            response = self.client.post('/api/v1/sites/trials/convert', json={'user_id': self.customer, 'plan_id': self.plan})
        self.assertEqual(response.status_code, 202)
        sweep.assert_called_once_with(kwargs={'user_id': self.customer, 'plan_id': self.plan}, retry=False)


if __name__ == '__main__':
    unittest.main()
