#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import time
import urllib.parse
import urllib.request


PROPERTY_ID = os.environ.get("GA4_SEED_PROPERTY_ID", "542352127")
MEASUREMENT_ID = os.environ.get("GA4_SEED_MEASUREMENT_ID", "G-5N95YKGP04")
API_SECRET = os.environ.get("GA4_SEED_API_SECRET", "sO4a9KMPSE-d2EkRe_uxqg")
TIMESTAMP_SAFETY_OFFSET_MICROS = 60 * 1_000_000

CAMPAIGNS = [
    {"name": "yesop_brand_search", "source": "google", "medium": "cpc", "sessions": 80, "engaged_sessions": 58, "purchases": 8, "revenue": 2425.00},
    {"name": "yesop_prospecting", "source": "linkedin", "medium": "paid_social", "sessions": 55, "engaged_sessions": 32, "purchases": 3, "revenue": 725.00},
    {"name": "yesop_retargeting", "source": "google", "medium": "display", "sessions": 35, "engaged_sessions": 25, "purchases": 6, "revenue": 1290.00},
    {"name": "yesop_email_nurture", "source": "newsletter", "medium": "email", "sessions": 30, "engaged_sessions": 23, "purchases": 4, "revenue": 860.00},
    {"name": "yesop_paid_social", "source": "facebook", "medium": "paid_social", "sessions": 45, "engaged_sessions": 27, "purchases": 4, "revenue": 980.00},
]


def parse_args():
    parser = argparse.ArgumentParser(description="Seed GA4 Measurement Protocol test traffic with per-run metric variation.")
    parser.add_argument("--log-dir", default="logs/ga4-seed-runs", help="Directory for per-run JSON seed logs.")
    parser.add_argument("--event-date", help="UTC event date (YYYY-MM-DD), for completed-day UI validation.")
    parser.add_argument("--campaign", action="append", choices=[campaign["name"] for campaign in CAMPAIGNS])
    return parser.parse_args()


def build_run_campaigns(run_started):
    run_seed = int(run_started.timestamp())
    varied = []
    for idx, campaign in enumerate(CAMPAIGNS):
        session_factor = 0.85 + (((run_seed // 60) + idx * 7) % 31) / 100
        purchase_factor = 0.80 + (((run_seed // 60) + idx * 11) % 41) / 100
        revenue_factor = 0.75 + (((run_seed // 60) + idx * 13) % 51) / 100
        sessions = max(1, round(campaign["sessions"] * session_factor))
        purchases = min(sessions, max(1, round(campaign["purchases"] * purchase_factor)))
        engaged_sessions = min(sessions, max(purchases, round(campaign["engaged_sessions"] * session_factor)))
        varied.append({
            **campaign,
            "_seed_index": idx,
            "base_sessions": campaign["sessions"],
            "base_engaged_sessions": campaign["engaged_sessions"],
            "base_purchases": campaign["purchases"],
            "base_revenue": campaign["revenue"],
            "sessions": sessions,
            "engaged_sessions": engaged_sessions,
            "purchases": purchases,
            "revenue": round(campaign["revenue"] * revenue_factor, 2),
            "variation": {
                "session_factor": round(session_factor, 2),
                "purchase_factor": round(purchase_factor, 2),
                "revenue_factor": round(revenue_factor, 2),
            },
        })
    return varied


def send_events(client_id, events):
    url = (
        "https://www.google-analytics.com/mp/collect?"
        + urllib.parse.urlencode({"measurement_id": MEASUREMENT_ID, "api_secret": API_SECRET})
    )
    payload = {
        "client_id": client_id,
        "events": events,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    urllib.request.urlopen(req, timeout=20).read()


def validate_events(client_id, events):
    url = (
        "https://www.google-analytics.com/debug/mp/collect?"
        + urllib.parse.urlencode({"measurement_id": MEASUREMENT_ID, "api_secret": API_SECRET})
    )
    payload = {
        "client_id": client_id,
        "validation_behavior": "ENFORCE_RECOMMENDATIONS",
        "events": events,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    response = json.loads(urllib.request.urlopen(req, timeout=20).read() or b"{}")
    messages = response.get("validationMessages", [])
    if messages:
        raise RuntimeError(f"GA4 strict payload validation failed: {json.dumps(messages)}")


def build_session_identity(campaign_index, session_index, event_day_start_micros=None):
    timestamp_micros = event_day_start_micros + ((campaign_index * 1000 + session_index) * 1_000_000) \
        if event_day_start_micros else (time.time_ns() // 1000) - TIMESTAMP_SAFETY_OFFSET_MICROS
    session_id = timestamp_micros // 1_000_000
    client_id = f"{555000000 + campaign_index * 10000 + session_index}.{session_id}"
    return client_id, session_id, timestamp_micros


def build_page_location(campaign):
    return "https://mock.mimosaas.test/landing?" + urllib.parse.urlencode({
        "utm_campaign": campaign["name"],
    })


def build_session_events(campaign, session_id, page_location, is_engaged, purchase_value=None, transaction_id=None, timestamp_micros=None):
    timestamp_micros = timestamp_micros or (time.time_ns() // 1000) - TIMESTAMP_SAFETY_OFFSET_MICROS
    base_params = {
        "session_id": session_id,
        "session_number": 1,
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

    events = [
        {
            "name": "campaign_details",
            "timestamp_micros": timestamp_micros,
            "params": {
                "session_id": session_id,
                "session_number": 1,
                "engagement_time_msec": 1,
                "campaign_id": campaign["name"],
                "campaign": campaign["name"],
                "source": campaign["source"],
                "medium": campaign["medium"],
            },
        },
        {
            "name": "page_view",
            "timestamp_micros": timestamp_micros + 1000,
            "params": base_params,
        },
    ]
    if is_engaged:
        events.append({
            "name": "page_view",
            "timestamp_micros": timestamp_micros + 2000,
            "params": {
                **base_params,
                "page_location": page_location.replace("/landing?", "/pricing?"),
                "page_title": f"Mock pricing page - {campaign['name']}",
            },
        })
    if purchase_value is not None and transaction_id:
        events.append({
            "name": "purchase",
            "timestamp_micros": timestamp_micros + 3000,
            "params": {
                **base_params,
                "currency": "USD",
                "value": purchase_value,
                "transaction_id": transaction_id,
                "items": [
                    {
                        "item_id": "mock_subscription",
                        "item_name": "Mock SaaS Subscription",
                        "quantity": 1,
                        "price": purchase_value,
                    }
                ],
            },
        })
    return events


def main():
    args = parse_args()
    run_started = dt.datetime.now(dt.timezone.utc)
    event_date = dt.date.fromisoformat(args.event_date) if args.event_date else None
    if event_date and event_date > run_started.date():
        raise ValueError("--event-date cannot be in the future")
    event_day_start_micros = int(
        dt.datetime.combine(event_date, dt.time(12), tzinfo=dt.timezone.utc).timestamp() * 1_000_000
    ) if event_date else None
    run_id = run_started.strftime("%Y%m%d%H%M%S")
    run_campaigns = build_run_campaigns(run_started)
    if args.campaign:
        selected_campaigns = set(args.campaign)
        run_campaigns = [campaign for campaign in run_campaigns if campaign["name"] in selected_campaigns]
    sent = 0
    summaries = []

    for campaign in run_campaigns:
        campaign_index = campaign["_seed_index"]
        client_id, session_id, timestamp_micros = build_session_identity(
            campaign_index, 0, event_day_start_micros
        )
        validate_events(client_id, build_session_events(
            campaign,
            session_id,
            build_page_location(campaign),
            True,
            1.0,
            f"validation-{run_id}-{campaign['name']}",
            timestamp_micros,
        ))

    for campaign in run_campaigns:
        campaign_index = campaign["_seed_index"]
        campaign_summary = {
            "name": campaign["name"],
            "sessions": campaign["sessions"],
            "engaged_sessions": 0,
            "purchases": 0,
            "revenue": 0.0,
            "variation": campaign["variation"],
        }
        for i in range(campaign["sessions"]):
            client_id, session_id, timestamp_micros = build_session_identity(
                campaign_index, i, event_day_start_micros
            )
            will_purchase = i < campaign["purchases"]
            is_engaged = i < campaign["engaged_sessions"] or will_purchase
            page_location = build_page_location(campaign)

            if is_engaged:
                campaign_summary["engaged_sessions"] += 1

            purchase_value = None
            transaction_id = None
            if will_purchase:
                purchase_value = round(campaign["revenue"] / campaign["purchases"], 2)
                if i == campaign["purchases"] - 1:
                    purchase_value = round(campaign["revenue"] - campaign_summary["revenue"], 2)
                campaign_summary["purchases"] += 1
                campaign_summary["revenue"] += purchase_value
                transaction_id = f"mock-{run_id}-{campaign['name']}-{i}"

            events = build_session_events(
                campaign,
                session_id,
                page_location,
                is_engaged,
                purchase_value,
                transaction_id,
                timestamp_micros,
            )
            send_events(client_id, events)
            sent += len(events)

            time.sleep(0.03)
        summaries.append(campaign_summary)

    total_sessions = sum(summary["sessions"] for summary in summaries)
    total_engaged = sum(summary["engaged_sessions"] for summary in summaries)
    total_purchases = sum(summary["purchases"] for summary in summaries)
    total_revenue = sum(summary["revenue"] for summary in summaries)
    print(f"Sent {sent} GA4 mock events across {len(run_campaigns)} campaigns.")
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

    selected_scope = [campaign["name"] for campaign in run_campaigns]
    selected_summaries = [s for s in summaries if s["name"] in selected_scope]
    output = {
        "run_id": run_id,
        "run_started_utc": run_started.isoformat(),
        "event_date_utc": event_date.isoformat() if event_date else None,
        "property_id": PROPERTY_ID,
        "measurement_id": MEASUREMENT_ID,
        "selected_scope": {
            "campaigns": selected_scope,
            "sessions": sum(s["sessions"] for s in selected_summaries),
            "engaged_sessions": sum(s["engaged_sessions"] for s in selected_summaries),
            "purchases": sum(s["purchases"] for s in selected_summaries),
            "revenue": round(sum(s["revenue"] for s in selected_summaries), 2),
        },
        "totals": {
            "sessions": total_sessions,
            "engaged_sessions": total_engaged,
            "purchases": total_purchases,
            "revenue": round(total_revenue, 2),
            "events_sent": sent,
        },
        "campaigns": summaries,
    }
    log_dir = Path(args.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / f"ga4_seed_{run_id}.json"
    log_path.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"Seed log written to {log_path}")


if __name__ == "__main__":
    main()
