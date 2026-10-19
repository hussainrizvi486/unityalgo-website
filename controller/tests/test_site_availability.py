import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.routes.site import SiteCapabilitiesView, HOSTING_UNAVAILABLE, NO_CAPACITY


class SiteAvailabilityTests(unittest.TestCase):
    def availability(self, nodes, fits=True):
        db = MagicMock()
        session = db.session.return_value.__enter__.return_value
        session.scalars.return_value.all.return_value = nodes
        session.execute.return_value.first.return_value = (0, 0)
        session.scalar.return_value = 0
        view = SiteCapabilitiesView(db=db, config=SimpleNamespace())
        with patch('app.routes.site.fits_site', return_value=fits):
            return view.site_availability()

    def test_missing_healthy_worker_is_not_reported_as_full_capacity(self):
        self.assertEqual(self.availability([]), (False, HOSTING_UNAVAILABLE))

    def test_healthy_but_full_worker_reports_capacity(self):
        self.assertEqual(self.availability([SimpleNamespace(id='worker')], fits=False), (False, NO_CAPACITY))

    def test_healthy_worker_with_room_accepts_sites(self):
        self.assertEqual(self.availability([SimpleNamespace(id='worker')]), (True, None))
