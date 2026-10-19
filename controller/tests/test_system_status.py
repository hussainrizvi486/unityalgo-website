import time
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from app.services import system_status
from app.tasks.celery_app import BEAT_KEY, HEARTBEAT_SECONDS


class BeatTests(unittest.TestCase):
    def test_recent_heartbeat_is_alive(self):
        client = MagicMock()
        client.get.return_value = str(time.time() - 10)
        status = system_status.beat_status(client)
        self.assertTrue(status['alive'])
        client.get.assert_called_with(BEAT_KEY)

    def test_old_or_missing_heartbeat_is_not(self):
        client = MagicMock()
        client.get.return_value = str(time.time() - HEARTBEAT_SECONDS * 4)
        self.assertFalse(system_status.beat_status(client)['alive'])
        client.get.return_value = None
        self.assertFalse(system_status.beat_status(client)['alive'])
        self.assertFalse(system_status.beat_status(None)['alive'])


class RedisTests(unittest.TestCase):
    def test_unreachable_redis_is_reported_not_raised(self):
        with patch('app.services.system_status.redis.Redis.from_url') as factory:
            factory.return_value.ping.side_effect = ConnectionError('refused')
            info, client = system_status.redis_status(SimpleNamespace(celery_broker_url='redis://x', redis_url='redis://x'))
        self.assertFalse(info['ok'])
        self.assertIn('refused', info['error'])
        self.assertIsNone(client)


class WorkerTests(unittest.TestCase):
    def test_task_arguments_never_leave_the_controller(self):
        inspector = MagicMock()
        inspector.ping.return_value = {'w1': {'ok': 'pong'}}
        inspector.stats.return_value = {'w1': {'pid': 1, 'total': {'a': 2, 'b': 3}, 'pool': {'max-concurrency': 2, 'processes': [1, 2]}}}
        inspector.active.return_value = {'w1': [{'id': 't1', 'name': 'site.provision', 'args': ['secret-site-id', {'setup': 'ENCRYPTED'}], 'time_start': 1.0}]}
        inspector.reserved.return_value = {'w1': []}
        with patch('app.services.system_status.celery_app.control.inspect', return_value=inspector):
            workers, error = system_status.workers_status()
        self.assertIsNone(error)
        self.assertEqual(workers[0]['processed'], 5)
        self.assertEqual(workers[0]['running'][0]['name'], 'site.provision')
        self.assertNotIn('ENCRYPTED', str(workers))

    def test_no_worker_answering_is_an_empty_list(self):
        inspector = MagicMock()
        inspector.ping.return_value = None
        inspector.stats.return_value = inspector.active.return_value = inspector.reserved.return_value = None
        with patch('app.services.system_status.celery_app.control.inspect', return_value=inspector):
            self.assertEqual(system_status.workers_status(), ([], None))


if __name__ == '__main__':
    unittest.main()
