"""Monitoring: bucketing and summary of readings, the sampler, and the metrics endpoint. SSH and Docker are mocked."""
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from flask import Flask
from sqlalchemy import delete, select

from app.db import database
from app.errors import ApiError
from app.models.site_extras import SiteMetric
from app.routes.site import SiteRoutes
from app.services.site_metrics import MAX_POINTS, RANGES, bucketed, summarize
from app.tasks import metrics_tasks
from tests.test_apps import RolloutTestCase

NOW = datetime.now(timezone.utc)


def reading(minutes_ago, cpu=10.0, memory=500.0, healthy=True, response=40, storage=300, users=2):
    return SimpleNamespace(ts=NOW - timedelta(minutes=minutes_ago), cpu_percent=cpu, memory_mb=memory, healthy=healthy,
                           response_ms=response if healthy else None, storage_mb=storage, users=users)


class BucketingTests(unittest.TestCase):
    def test_a_long_range_is_averaged_down_to_a_bounded_number_of_points(self):
        rows = [reading(minutes) for minutes in range(0, 30 * 24 * 60, 5)]            # a month of 5-minute readings
        points = bucketed(rows, RANGES['30d'], 300)
        self.assertLessEqual(len(points), MAX_POINTS + 1)
        self.assertGreater(len(points), 50)

    def test_a_short_range_keeps_every_reading(self):
        rows = [reading(minutes) for minutes in range(0, 60, 5)]
        self.assertEqual(len(bucketed(rows, RANGES['1h'], 300)), len(rows))

    def test_a_bucket_averages_its_readings_and_reports_the_share_that_answered(self):
        rows = [reading(1, cpu=10, healthy=True), reading(1, cpu=30, healthy=False)]
        (point,) = bucketed(rows, RANGES['1h'], 3600)
        self.assertEqual(point['cpu'], 20.0)
        self.assertEqual(point['up'], 0.5)

    def test_no_readings_means_no_points(self):
        self.assertEqual(bucketed([], RANGES['24h'], 300), [])


class SummaryTests(unittest.TestCase):
    def test_uptime_peaks_averages_and_outages(self):
        rows = [reading(50, cpu=10), reading(40, cpu=90, healthy=False), reading(30, cpu=70, healthy=False), reading(20, cpu=20),
                reading(10, healthy=False), reading(0, cpu=30, memory=800)]
        summary = summarize(rows)
        self.assertEqual(summary['samples'], 6)
        self.assertEqual(summary['uptime_percent'], 50.0)
        self.assertEqual(summary['outages'], 2)                 # two failures in a row are one outage
        self.assertEqual(summary['cpu_peak'], 90.0)
        self.assertEqual(summary['memory_peak_mb'], 800)

    def test_an_empty_window_has_no_figures_rather_than_zeros(self):
        summary = summarize([])
        self.assertEqual((summary['samples'], summary['uptime_percent'], summary['cpu_peak']), (0, None, None))


class SamplerTests(unittest.TestCase):
    def test_a_site_that_answers_is_recorded_with_its_stats(self):
        service = MagicMock()
        service.probe.return_value = (True, 42)
        service.usage.return_value = {'cpu_percent': 12.5, 'memory_mb': 700, 'storage_mb': 1200, 'memory_limit_mb': 2048}
        result = metrics_tasks.sample(service)
        self.assertEqual((result['healthy'], result['response_ms']), (True, 42))
        self.assertEqual((result['cpu_percent'], result['memory_mb'], result['storage_mb']), (12.5, 700, 1200))

    def test_a_site_that_does_not_answer_is_recorded_as_down(self):
        service = MagicMock()
        service.probe.return_value = (False, None)
        service.usage.side_effect = RuntimeError('docker unreachable')
        result = metrics_tasks.sample(service)
        self.assertEqual(result, {'healthy': False, 'response_ms': None})


class MetricsEndpointTests(RolloutTestCase):
    def setUp(self):
        super().setUp()
        flask = Flask(__name__)
        flask.register_blueprint(SiteRoutes.blueprint(db=database, config=SimpleNamespace(site_metrics_interval_seconds=300)))
        flask.register_error_handler(ApiError, lambda error: (error.to_dict(), error.status_code))
        self.client = flask.test_client()

    def tearDown(self):
        with database.session() as session:
            session.execute(delete(SiteMetric).where(SiteMetric.site_id.in_([uuid.UUID(i) for i in self.sites.values()])))
        super().tearDown()

    def add(self, site_id, minutes_ago, **kwargs):
        with database.session() as session:
            session.add(SiteMetric(site_id=uuid.UUID(site_id), ts=NOW - timedelta(minutes=minutes_ago), **kwargs))

    def test_the_owner_gets_points_summary_and_limits(self):
        site_id = self.make_site('metric-site')
        for minutes in (50, 40, 30):
            self.add(site_id, minutes, cpu_percent=20, memory_mb=600, storage_mb=900, healthy=True, response_ms=50)
        self.add(site_id, 20, healthy=False)
        body = self.client.get(f'/api/v1/sites/{site_id}/metrics?user_id={self.customer}&range=1h').json
        self.assertEqual(body['range'], '1h')
        self.assertEqual(len(body['points']), 4)
        self.assertEqual(body['summary']['uptime_percent'], 75.0)
        self.assertEqual(body['limits']['memory_mb'], 6144)
        self.assertTrue(body['running'])

    def test_someone_elses_site_is_not_found_but_the_admin_route_reads_any_site(self):
        site_id = self.make_site('metric-site-2')
        self.assertEqual(self.client.get(f'/api/v1/sites/{site_id}/metrics?user_id=somebody-else').status_code, 404)
        self.assertEqual(self.client.get(f'/api/v1/sites/admin/{site_id}/metrics?range=7d').json['range'], '7d')

    def test_an_unknown_range_falls_back_to_a_day(self):
        site_id = self.make_site('metric-site-3')
        self.assertEqual(self.client.get(f'/api/v1/sites/{site_id}/metrics?user_id={self.customer}&range=forever').json['range'], '24h')

    def test_a_ready_site_with_no_readings_asks_for_one(self):
        site_id = self.make_site('metric-site-4')
        with patch('app.tasks.metrics_tasks.collect_metrics_task.apply_async') as queue:
            body = self.client.get(f'/api/v1/sites/{site_id}/metrics?user_id={self.customer}').json
        self.assertEqual(body['summary']['samples'], 0)
        queue.assert_called_once()

    def test_the_collector_records_a_reading_for_each_running_site_and_prunes_old_ones(self):
        ready = self.make_site('collect-ready')
        self.make_site('collect-stopped', status='stopped')
        self.add(ready, 60 * 24 * 40, healthy=True)                                   # older than the 30-day retention
        service = MagicMock()
        service.probe.return_value = (True, 30)
        service.usage.return_value = {'cpu_percent': 5, 'memory_mb': 300, 'storage_mb': 100, 'memory_limit_mb': 1024}
        with patch.object(metrics_tasks, 'build_service', return_value=service):
            metrics_tasks.collect_metrics_task.run(site_ids=list(self.sites.values()))
        with database.session() as session:
            rows = session.scalars(select(SiteMetric).where(SiteMetric.site_id == uuid.UUID(ready))).all()
            stopped = session.scalars(select(SiteMetric).where(SiteMetric.site_id == uuid.UUID(self.sites['collect-stopped']))).all()
        self.assertEqual(len(rows), 1)                    # the new reading; the 40-day-old one is gone
        self.assertEqual(rows[0].cpu_percent, 5)
        self.assertEqual(stopped, [])                     # a stopped site is not sampled


class ProbeTests(unittest.TestCase):
    def service(self, stdout='', error=None):
        from app.services.frappe_service import FrappeService
        site = SimpleNamespace(id='00000000-0000-0000-0000-0000000000bb', image='i', db_password='b', admin_password='a', domain='e.example.test', port=30011, app_names=['erpnext'])
        with patch('app.services.frappe_service.SSHService'):
            service = FrappeService(site, SimpleNamespace(dial_host='10.0.0.5'), SimpleNamespace())
        service.ssh = MagicMock()
        service.ssh.run.side_effect = error
        service.ssh.run.return_value = SimpleNamespace(stdout=stdout)
        return service

    def test_a_200_is_up_and_carries_the_request_time_in_milliseconds(self):
        service = self.service('200 0.0421')
        self.assertEqual(service.probe(), (True, 42))
        self.assertIn('http://10.0.0.5:30011/api/method/ping', service.ssh.run.call_args.args[0])

    def test_anything_else_is_down(self):
        self.assertEqual(self.service('502 0.01').probe(), (False, None))
        self.assertEqual(self.service('000 0.00').probe(), (False, None))
        self.assertEqual(self.service('', error=OSError('ssh down')).probe(), (False, None))


if __name__ == '__main__':
    unittest.main()
