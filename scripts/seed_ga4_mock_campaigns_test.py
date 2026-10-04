import datetime as dt
import unittest

from scripts.seed_ga4_mock_campaigns import build_page_location, build_session_events, build_session_identity, resolve_seed_context


class SeedGA4MockCampaignsTest(unittest.TestCase):
    def test_landing_page_location_is_within_ga4_parameter_limit(self):
        location = build_page_location({"name": "yesop_email_nurture"})

        self.assertLessEqual(len(location), 100)
        self.assertIn("utm_campaign=yesop_email_nurture", location)

    def test_backdated_session_id_matches_event_timestamp(self):
        client_id, session_id, timestamp_micros = build_session_identity(2, 7, 1_780_000_000_000_000, 123456789)

        self.assertEqual(session_id, timestamp_micros // 1_000_000)
        self.assertEqual(client_id, f"123456789002007.{session_id}")

    def test_repeated_runs_use_different_client_ids(self):
        first, _, _ = build_session_identity(1, 4, 1_780_000_000_000_000, 123456789)
        second, _, _ = build_session_identity(1, 4, 1_780_000_000_000_000, 987654321)

        self.assertNotEqual(first, second)

    def test_every_backdated_campaign_stays_on_the_requested_reporting_day(self):
        event_day_start_micros = int(dt.datetime(2026, 10, 3, 12, tzinfo=dt.timezone.utc).timestamp() * 1_000_000)

        _, _, timestamp_micros = build_session_identity(4, 99, event_day_start_micros)

        event_time = dt.datetime.fromtimestamp(timestamp_micros / 1_000_000, tz=dt.timezone.utc)
        self.assertEqual(event_time.date(), dt.date(2026, 10, 3))
        self.assertLess(event_time.hour, 20)

    def test_campaign_details_precedes_session_page_views(self):
        campaign = {
            "name": "yesop_paid_social",
            "source": "facebook",
            "medium": "paid_social",
        }
        events = build_session_events(
            campaign,
            123456789,
            "https://mock.mimosaas.test/landing?utm_campaign=yesop_paid_social",
            True,
            98.50,
            "transaction-1",
            currency="EUR",
        )

        self.assertEqual([event["name"] for event in events], [
            "campaign_details", "page_view", "page_view", "purchase",
        ])
        self.assertEqual(events[0]["params"]["campaign"], "yesop_paid_social")
        self.assertEqual(events[0]["params"]["source"], "facebook")
        self.assertEqual(events[0]["params"]["medium"], "paid_social")
        self.assertTrue(all(event["params"]["session_id"] == 123456789 for event in events))
        self.assertEqual(events[1]["params"]["page_title"], "Mock landing page - yesop_paid_social")
        self.assertIn("/pricing?", events[2]["params"]["page_location"])
        self.assertEqual(events[3]["params"]["transaction_id"], "transaction-1")
        self.assertEqual(events[3]["params"]["currency"], "EUR")
        self.assertEqual([event["timestamp_micros"] for event in events], sorted(
            event["timestamp_micros"] for event in events
        ))

    def test_purchase_requires_currency(self):
        with self.assertRaisesRegex(ValueError, "currency is required"):
            build_session_events(
                {"name": "yesop_paid_social", "source": "facebook", "medium": "paid_social"},
                123456789,
                "https://mock.mimosaas.test/landing?utm_campaign=yesop_paid_social",
                True,
                98.50,
                "transaction-1",
            )

    def test_seed_context_uses_campaign_timezone_and_currency(self):
        event_date, _, currency, event_day_start = resolve_seed_context(
            "2026-10-03",
            "Europe/Amsterdam",
            "eur",
            dt.datetime(2026, 10, 4, 8, tzinfo=dt.timezone.utc),
        )

        self.assertEqual(event_date, dt.date(2026, 10, 3))
        self.assertEqual(currency, "EUR")
        self.assertEqual(event_day_start.isoformat(), "2026-10-03T10:00:00+00:00")

    def test_seed_context_rejects_current_reporting_day(self):
        with self.assertRaisesRegex(ValueError, "must be completed"):
            resolve_seed_context(
                "2026-10-04",
                "Europe/Amsterdam",
                "EUR",
                dt.datetime(2026, 10, 4, 8, tzinfo=dt.timezone.utc),
            )


if __name__ == "__main__":
    unittest.main()
