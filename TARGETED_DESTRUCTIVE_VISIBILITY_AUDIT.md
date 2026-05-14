# Targeted Production-Ready Destructive/Visibility Audit

## Purpose

Track the remaining production-readiness work for destructive and visibility paths.

This audit covers user-visible data loss, hidden records, scheduler side effects, report delivery visibility, alert/notification lifecycle, and destructive cascades.

Rule: do not mark an item complete unless the route/job/storage path has been traced end to end and validated.

## Proven Complete

- Campaign notifications are soft-hidden, not broadly hard-deleted, when a campaign is deleted.
- KPI and Benchmark delete flows soft-hide related notifications instead of hard-deleting notification history.
- Dismissed alerts can retrigger when the underlying breach still exists.
- Campaign-level KPI alert creation creates visible notifications consistently.
- Platform report update/delete routes enforce report ownership and platform type.
- Platform report delete returns `404` when no report row is actually deleted.
- Legacy LinkedIn report update/delete routes enforce report ownership and `platformType=linkedin`.
- Scheduled reports deduplicate report rows before processing.
- Scheduled reports skip/fail closed when the campaign no longer exists.
- Scheduled report email delivery uses the detected provider at send time, including Mailgun HTTP API when Mailgun API credentials exist.
- Stale failed scheduled report sends with no `sentAt` can retry once safely.
- Sent scheduled report rows do not show stale old failure errors.
- Shared `deleteNotification(id)` now soft-hides notifications instead of hard-deleting them.
- Resolved KPI alert notifications are hidden from the bell/list while their history remains preserved.

## Outstanding

- Source delete/edit flows: review CSV, Google Sheets, HubSpot, Salesforce, Shopify, LinkedIn, Meta, Google Ads, and Custom Integration delete/edit routes. Confirm each route only mutates the intended campaign/source/platform records.
- Notification lifecycle: review `dismiss`, `clear all`, `mark read`, alert resolution, alert recreation, KPI delete, Benchmark delete, campaign delete, and client delete end to end.
- Client delete cascade: trace all child campaign records, reports, KPIs, benchmarks, notifications, alerts, sources, snapshots, send events, and email audit rows.
- Campaign delete cascade: complete a final table-by-table scoping pass for all child rows.
- Platform-specific disconnect/delete routes: review GA4, Google Sheets, HubSpot, Salesforce, Shopify, LinkedIn, Meta, Google Ads, and Custom Integration disconnect routes.
- KPI routes: confirm campaign-level and platform-level KPI routes cannot mutate/delete each other's records, alerts, notifications, or progress rows.
- Benchmark routes: confirm campaign-level and platform-level Benchmark routes cannot mutate/delete each other's records, alerts, notifications, or history rows.
- Report routes: complete final check of remaining report scheduler/update/delete/test-send paths for stale legacy callers and cross-campaign report IDs.
- Scheduler jobs: review auto-refresh, alert checks, report scheduler, KPI/Benchmark recompute, source refresh, and notification creation jobs for campaign/platform scoping.
- Legacy LinkedIn and shared report storage: prove which legacy routes are still reachable before removing or further guarding them.
- Legacy ownerless data: verify old records without modern owner/campaign metadata cannot be exposed, mutated, or deleted across users/clients.
- Email/report audit history: decide and enforce whether `email_alert_events`, `report_send_events`, and `report_snapshots` are preserved, soft-hidden, or deleted during campaign/client deletion.
- Source normalized records: confirm deleting one revenue/spend source deletes only that source's records and cannot clear unrelated totals/latest-day records/platform metrics.
- Visibility filters: confirm UI lists exclude soft-hidden records while preserving auditability in storage.
- Schema/storage cleanup: last step only, after all route/job dependencies are proven.

## Runtime Validation Required

- Render scheduler timing and repeated job behavior.
- Mailgun delivery and recipient inbox delivery.
- Production database state for legacy ownerless records.
- Historical records created before these fixes.
- Reachability of stale routes from deployed UI/API usage.
