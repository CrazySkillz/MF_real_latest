#!/usr/bin/env python3
import datetime as dt
import json
import time
import urllib.parse
import urllib.request


MEASUREMENT_ID = "G-5N95YKGP04"
API_SECRET = "sO4a9KMPSE-d2EkRe_uxqg"

CAMPAIGNS = [
    {"name": "yesop_brand_search", "source": "google", "medium": "cpc", "sessions": 80, "engaged_sessions": 58, "purchases": 8, "revenue": 2425.00},
    {"name": "yesop_prospecting", "source": "linkedin", "medium": "paid_social", "sessions": 55, "engaged_sessions": 32, "purchases": 3, "revenue": 725.00},
    {"name": "yesop_retargeting", "source": "google", "medium": "display", "sessions": 35, "engaged_sessions": 25, "purchases": 6, "revenue": 1290.00},
    {"name": "yesop_email_nurture", "source": "newsletter", "medium": "email", "sessions": 30, "engaged_sessions": 23, "purchases": 4, "revenue": 860.00},
    {"name": "yesop_paid_social", "source": "facebook", "medium": "paid_social", "sessions": 45, "engaged_sessions": 27, "purchases": 4, "revenue": 980.00},
]


def send_event(client_id, event_name, params):
    url = (
        "https://www.google-analytics.com/mp/collect?"
        + urllib.parse.urlencode({"measurement_id": MEASUREMENT_ID, "api_secret": API_SECRET})
    )
    payload = {
        "client_id": client_id,
        "events": [
            {
                "name": event_name,
                "params": params,
            }
        ],
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    urllib.request.urlopen(req, timeout=20).read()


def main():
    run_started = dt.datetime.now(dt.timezone.utc)
    run_id = run_started.strftime("%Y%m%d%H%M%S")
    run_start = int(run_started.timestamp())
    sent = 0
    summaries = []

    for campaign_index, campaign in enumerate(CAMPAIGNS):
        campaign_summary = {
            "name": campaign["name"],
            "sessions": campaign["sessions"],
            "engaged_sessions": 0,
            "purchases": 0,
            "revenue": 0.0,
        }
        for i in range(campaign["sessions"]):
            session_id = run_start + (campaign_index * 10000) + i
            client_id = f"555{campaign_index + 1}.{run_id}{i + 1:03d}"
            will_purchase = i < campaign["purchases"]
            is_engaged = i < campaign["engaged_sessions"] or will_purchase
            page_location = (
                "https://mock.mimosaas.test/landing?"
                + urllib.parse.urlencode(
                    {
                        "utm_source": campaign["source"],
                        "utm_medium": campaign["medium"],
                        "utm_campaign": campaign["name"],
                    }
                )
            )

            base_params = {
                "session_id": session_id,
                "engagement_time_msec": 22000 if is_engaged else 3000,
                "page_location": page_location,
                "page_title": f"Mock landing page - {campaign['name']}",
                "source": campaign["source"],
                "medium": campaign["medium"],
                "campaign": campaign["name"],
                "campaign_id": campaign["name"],
            }
            if is_engaged:
                base_params["session_engaged"] = "1"
                campaign_summary["engaged_sessions"] += 1

            send_event(client_id, "page_view", base_params)
            sent += 1

            # Use a second page_view for engaged sessions. This is a standard
            # GA4 engagement signal and avoids sending user_engagement events
            # that some test properties may accidentally count as conversions.
            if is_engaged:
                send_event(
                    client_id,
                    "page_view",
                    {
                        **base_params,
                        "page_location": page_location.replace("/landing?", "/pricing?"),
                        "page_title": f"Mock pricing page - {campaign['name']}",
                    },
                )
                sent += 1

            if will_purchase:
                purchase_value = round(campaign["revenue"] / campaign["purchases"], 2)
                if i == campaign["purchases"] - 1:
                    purchase_value = round(campaign["revenue"] - campaign_summary["revenue"], 2)
                campaign_summary["purchases"] += 1
                campaign_summary["revenue"] += purchase_value
                send_event(
                    client_id,
                    "purchase",
                    {
                        **base_params,
                        "currency": "USD",
                        "value": purchase_value,
                        "transaction_id": f"mock-{run_id}-{campaign['name']}-{i}",
                        "items": [
                            {
                                "item_id": "mock_subscription",
                                "item_name": "Mock SaaS Subscription",
                                "quantity": 1,
                                "price": purchase_value,
                            }
                        ],
                    },
                )
                sent += 1

            time.sleep(0.03)
        summaries.append(campaign_summary)

    total_sessions = sum(summary["sessions"] for summary in summaries)
    total_engaged = sum(summary["engaged_sessions"] for summary in summaries)
    total_purchases = sum(summary["purchases"] for summary in summaries)
    total_revenue = sum(summary["revenue"] for summary in summaries)
    print(f"Sent {sent} GA4 mock events across {len(CAMPAIGNS)} campaigns.")
    print(
        "Expected batch totals: "
        f"sessions={total_sessions}, "
        f"engaged_sessions={total_engaged}, "
        f"purchases={total_purchases}, "
        f"revenue=${total_revenue:.2f}"
    )
    print("Campaign totals:")
    for summary in summaries:
        print(
            f"- {summary['name']}: "
            f"sessions={summary['sessions']}, "
            f"engaged_sessions={summary['engaged_sessions']}, "
            f"purchases={summary['purchases']}, "
            f"revenue=${summary['revenue']:.2f}"
        )


if __name__ == "__main__":
    main()
