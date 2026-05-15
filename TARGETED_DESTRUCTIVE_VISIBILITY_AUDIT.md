# Targeted Production-Ready Destructive/Visibility Audit

## Purpose

Track the remaining production-readiness work for destructive and visibility paths.

This audit covers user-visible data loss, hidden records, scheduler side effects, report delivery visibility, alert/notification lifecycle, and destructive cascades.

Rule: do not mark an item complete unless the route/job/storage path has been traced end to end and validated.

Last updated: 2026-05-15 after the notification lifecycle targeted pass, KPI progress scope validation, Benchmark update route scope hardening, campaign Benchmark edit-format regression guard, exact Benchmark history cleanup on Benchmark delete, Benchmark history write fail-closed guard, and Benchmark history/analytics read-route access guards.

## Execution Method

Work through this audit by subsystem, not by isolated symptoms.

For each subsystem:

- define the destructive or visibility invariant before editing
- trace frontend caller, API route, storage method, scheduler path, and UI read path where applicable
- implement only the smallest confirmed fix
- add or update the narrowest regression guard available
- validate the fixed path and one adjacent same-subsystem path
- update this tracker immediately after validation

Subsystem order:

1. Notification lifecycle and alert visibility.
2. KPI/Benchmark campaign-vs-platform route isolation.
3. Report update/delete/scheduler/send visibility.
4. Source edit/delete and normalized-record cleanup.
5. Campaign/client delete cascades.
6. Legacy route/schema/storage cleanup only after reachability is proven.

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
- Orphaned or cross-campaign KPI/Benchmark performance-alert notifications are hidden from the bell/list while their history remains preserved.
- Notification visibility rules are aligned between the database path and in-memory fallback path.
- KPI/Benchmark performance-alert notifications are hidden when their linked row no longer breaches its alert threshold.
- Duplicate visible KPI/Benchmark performance-alert notifications are collapsed to one active bell row per linked KPI/Benchmark while history remains preserved.
- KPI/Benchmark alert creation jobs now fail closed when the linked campaign is missing, and KPI alert creation resolves existing rows instead of creating alerts for non-breaching KPIs.
- Campaign-level KPI/Benchmark alert creation now uses one active unresolved alert per linked KPI/Benchmark, matching GA4 behavior and preventing repeated creation logs for the same active breach.
- KPI/Benchmark email alert lifecycle now fails closed when the linked campaign is missing and parses formatted numeric values consistently before sending email, updating `lastAlertSent`, or writing alert audit state.
- Generic platform KPI routes now reject reserved campaign-layer platform values before read/create/update/delete, preventing platform KPI endpoints from mutating campaign-level KPI rows.
- Generic KPI progress writes now require the caller's expected layer scope and verify it against the persisted KPI row before inserting progress or updating `currentValue`.
- Benchmark platform routes now reject reserved campaign-layer platform values, and Benchmark update routes keep `campaignId`/`platformType` immutable from the persisted row.
- Campaign-level Benchmark edit forms now normalize persisted numeric values for display without changing saved values: `count` values remove decimal suffixes and currency values use thousands separators.
- Individual Benchmark deletion now removes only the selected Benchmark's history rows in the same transaction before deleting that Benchmark, preventing orphaned Benchmark history without broad cleanup.
- Benchmark history writes now fail closed if the linked Benchmark row no longer exists, preventing scheduler or legacy callers from creating orphan history rows.
- Benchmark history and analytics read routes are guarded by `ensureBenchmarkAccess` before reading history or analytics storage.

## Current Status By Subsystem

- Notification lifecycle and alert visibility: code audit is complete for the targeted scope. In-app bell visibility, single dismiss, clear-all, mark-read scoping, KPI/Benchmark delete hiding, campaign delete hiding, alert recreation, non-breach hiding, missing-campaign fail-closed behavior, duplicate active alert suppression, non-breaching alert hiding, orphan/cross-campaign hiding, and email-alert missing-campaign/numeric parsing boundaries have been traced and hardened. Ongoing production validation remains listed under Runtime Validation Required.
- KPI/Benchmark campaign-vs-platform route isolation: partially hardened. Generic platform KPI routes fail closed for campaign-layer values, generic KPI progress writes now verify caller layer scope before mutating `currentValue`, and Benchmark update routes now preserve persisted `campaignId`/`platformType` instead of accepting caller-supplied scope changes. Remaining KPI analytics/read and Benchmark history/analytics/delete-side-effect paths still require the listed route-isolation pass.
- Report update/delete/scheduler/send visibility: partially hardened; final pass still required.
- Source edit/delete and normalized-record cleanup: not started.
- Campaign/client delete cascades: partially hardened; final table-by-table pass still required.
- Legacy route/schema/storage cleanup: not started and must remain last.

## Reconciled Outstanding Subsystems

- Notification lifecycle: in-app notification creation/read/dismiss/clear/delete, scheduler creation, duplicate suppression, non-breach hiding, orphan/cross-campaign hiding, missing-campaign fail-closed behavior, and email-alert stale-row checks are code-audited for the targeted scope. Remaining work is production runtime observation only.
- KPI/Benchmark route isolation: still active. KPI platform-route reserved-value guard, generic KPI progress scope validation, Benchmark update scope immutability, Benchmark delete history cleanup, Benchmark history write existence checks, and Benchmark history/analytics read guards are complete; generic KPI analytics/read paths remain outstanding.
- Report routes and scheduler: still active. Some platform and legacy LinkedIn report ownership guards are complete, but the remaining scheduler/update/delete/test-send pass is outstanding.
- Source delete/edit flows: not started.
- Campaign/client delete cascades: partially hardened, but final table-by-table destructive-scope pass remains outstanding.
- Legacy/stale routes and schema cleanup: not started and must remain last.

## Outstanding

- KPI routes: generic platform KPI route reserved-value guard and generic KPI progress scope validation are complete. Still confirm generic KPI analytics/read paths, route-specific update/delete paths, alert side effects, and any legacy platform KPI callers cannot mutate/delete across campaign-vs-platform boundaries.
- Benchmark routes: platform Benchmark routes now reject campaign-layer platform values, Benchmark update routes preserve persisted `campaignId`/`platformType`, Benchmark deletion cleans up only exact matching history rows, Benchmark history writes require an existing Benchmark row, and Benchmark history/analytics read routes use `ensureBenchmarkAccess`. No remaining Benchmark route-isolation gaps are known from the targeted pass.
- Report routes: complete final check of remaining report scheduler/update/delete/test-send paths for stale legacy callers and cross-campaign report IDs.
- Source delete/edit flows: review CSV, Google Sheets, HubSpot, Salesforce, Shopify, LinkedIn, Meta, Google Ads, and Custom Integration delete/edit routes. Confirm each route only mutates the intended campaign/source/platform records.
- Client delete cascade: trace all child campaign records, reports, KPIs, benchmarks, notifications, alerts, sources, snapshots, send events, and email audit rows.
- Campaign delete cascade: complete a final table-by-table scoping pass for all child rows.
- Platform-specific disconnect/delete routes: review GA4, Google Sheets, HubSpot, Salesforce, Shopify, LinkedIn, Meta, Google Ads, and Custom Integration disconnect routes.
- Scheduler jobs: review auto-refresh, alert checks, report scheduler, KPI/Benchmark recompute, source refresh, and notification creation jobs for campaign/platform scoping.
- Legacy LinkedIn and shared report storage: prove which legacy routes are still reachable before removing or further guarding them.
- Legacy ownerless data: verify old records without modern owner/campaign metadata cannot be exposed, mutated, or deleted across users/clients.
- Email/report audit history: decide and enforce whether `email_alert_events`, `report_send_events`, and `report_snapshots` are preserved, soft-hidden, or deleted during campaign/client deletion.
- Source normalized records: confirm deleting one revenue/spend source deletes only that source's records and cannot clear unrelated totals/latest-day records/platform metrics.
- Visibility filters: confirm UI lists exclude soft-hidden records while preserving auditability in storage.
- Schema/storage cleanup: last step only, after all route/job dependencies are proven.

## Runtime Validation Required

- Notification lifecycle: monitor Render logs after deploy for unexpected repeated `Created alert`, `Alert sent for KPI`, `Alert sent for Benchmark`, `Error checking KPI alerts`, or `Error checking Benchmark alerts` entries.
- Render scheduler timing and repeated job behavior.
- Mailgun delivery and recipient inbox delivery.
- Production database state for legacy ownerless records.
- Historical records created before these fixes.
- Reachability of stale routes from deployed UI/API usage.

## Regression Guards

- `server/kpi-route-isolation-regression.test.ts`
- `server/benchmark-route-isolation-regression.test.ts`
- `server/campaign-benchmark-ui-regression.test.ts`
