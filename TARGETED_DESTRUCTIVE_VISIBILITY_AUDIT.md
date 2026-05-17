# Targeted Production-Ready Destructive/Visibility Audit

## Purpose

Track the remaining production-readiness work for destructive and visibility paths.

This audit covers user-visible data loss, hidden records, scheduler side effects, report delivery visibility, alert/notification lifecycle, and destructive cascades.

Rule: do not mark an item complete unless the route/job/storage path has been traced end to end and validated.

Trust rule: do not mark a source family, scheduler path, or destructive/visibility subsystem complete until add/create, edit/update, delete/deactivate, refresh/scheduler/reprocess, visible list/modal display, totals/recompute, and existing damaged-data cleanup have been traced or explicitly marked out of scope.

Last updated: 2026-05-17 after the notification lifecycle targeted pass, KPI progress scope validation, KPI analytics/read route access guards, KPI progress write fail-closed guard, LinkedIn campaign-specific KPI refresh fallback removal validated in Render logs, Benchmark update route scope hardening, campaign Benchmark edit-format regression guard, exact Benchmark history cleanup on Benchmark delete, Benchmark history write fail-closed guard, Benchmark history/analytics read-route access guards, report test-send Mailgun HTTP API alignment, report test-send missing-campaign fail-closed hardening, orphaned scheduled-report disablement validated in Render logs, direct report snapshot ownership hardening, scheduled report snapshot bookkeeping hardening, legacy Meta/Google Ads report update ownership immutability, production validation of plain transactional report emails with PDF attachments, Google Sheets campaign source route access hardening, CSV revenue/spend source-type edit guards, Google Sheets revenue additivity/source-window/UI-stability hardening, Google Sheets spend additivity/source-window/UI-stability hardening, and Google Sheets spend auto-refresh source identity hardening.

Current reconciliation note: the two previous outstanding-task lists now describe the same audit queue. KPI analytics/read route guards, Benchmark route isolation, Benchmark history cleanup, Benchmark history/analytics read guards, and Report routes/scheduler safety have been completed for the targeted scope. The next active subsystem is Source edit/delete and normalized-record cleanup.

Existing damaged-data note: the Google Sheets spend auto-refresh source-identity fix prevents new duplicate Google Sheets spend sources from being created by refresh. It does not silently delete already-persisted duplicate spend sources. Existing duplicate cleanup must be a separate targeted cleanup after proving the exact duplicate grouping key and affected source IDs.

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
- Legacy Meta/Google Ads report update routes preserve the persisted report campaign identity and ignore ownership/platform identity fields from request bodies.
- Platform report delete returns `404` when no report row is actually deleted.
- Legacy LinkedIn report update/delete routes enforce report ownership and `platformType=linkedin`.
- Scheduled reports deduplicate report rows before processing.
- Scheduled reports skip/fail closed when the campaign no longer exists.
- Scheduled reports with a proven missing campaign have scheduling disabled so orphaned reports do not keep recurring through future scheduler ticks, including already-skipped send-event retries.
- Scheduled report email delivery uses the detected provider at send time, including Mailgun HTTP API when Mailgun API credentials exist.
- Platform report test-send uses the same report ownership guard and Mailgun HTTP API-compatible configuration path as scheduled report delivery instead of requiring Mailgun SMTP credentials.
- Platform report test-send and scheduled report delivery use a plain transactional report-email payload with the generated PDF attached, and test-send reports Mailgun delivery-event failures instead of treating API acceptance as final delivery.
- Report test-send now fails closed if the resolved report has no campaign or the campaign lookup fails, matching scheduled-send missing-campaign behavior.
- Direct report snapshot JSON/PDF routes now verify that the snapshot campaign/platform still matches the owned report before returning the snapshot or generated PDF.
- Scheduled report snapshots are created only after a successful scheduled send, preventing failed sends from creating misleading sent/downloadable snapshot rows.
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
- Generic KPI progress writes now require the caller's expected layer scope, verify it against the persisted KPI row before inserting progress or updating `currentValue`, and storage refuses progress writes for missing KPI rows.
- Generic KPI latest-period and analytics read routes are guarded by `ensureKpiAccess` before reading period/progress/analytics storage.
- LinkedIn campaign-specific KPI refresh no longer substitutes aggregate campaign metrics when the selected LinkedIn campaign has no current metric rows; it skips that KPI to preserve metric accuracy and avoid misleading orphan refresh logs.
- Benchmark platform routes now reject reserved campaign-layer platform values, and Benchmark update routes keep `campaignId`/`platformType` immutable from the persisted row.
- Campaign-level Benchmark edit forms now normalize persisted numeric values for display without changing saved values: `count` values remove decimal suffixes and currency values use thousands separators.
- Individual Benchmark deletion now removes only the selected Benchmark's history rows in the same transaction before deleting that Benchmark, preventing orphaned Benchmark history without broad cleanup.
- Benchmark history writes now fail closed if the linked Benchmark row no longer exists, preventing scheduler or legacy callers from creating orphan history rows.
- Benchmark history and analytics read routes are guarded by `ensureBenchmarkAccess` before reading history or analytics storage.
- Google Sheets campaign source routes now require campaign access before detecting columns, reading unique values, auto-mapping, saving mappings, reading mappings, previewing/processing spend Sheets data, or updating connection platform selections. Connection updates also verify the `connectionId` belongs to the requested campaign before mutation.
- CSV revenue and spend process/edit routes now verify that an existing `sourceId` belongs to a CSV source before updating it, preventing CSV endpoints from rewriting a same-campaign Google Sheets/CRM/connector source.
- Google Sheets spend auto-refresh now passes the active spend source row into reprocessing and includes its stable `sourceId` in the process payload, preventing refresh from entering add mode and creating duplicate Google Sheets spend sources.
- Google Sheets spend process now fails closed when an edit/refresh `sourceId` is supplied but no active Google Sheets spend source matches it, preventing stale source IDs from silently creating new sources.
- Google Sheets spend duplicate inspection is read-only and groups active Google Sheets spend sources by exact saved sheet/mapping identity before any cleanup is attempted.
- Google Sheets spend duplicate cleanup requires explicit confirmation, keeps the oldest source in each exact duplicate group, soft-deactivates only the duplicate source IDs from those groups, deletes only normalized spend records tied to those duplicate source IDs, and recalculates campaign spend.
- Google Sheets spend hard-delete cleanup requires explicit confirmation and purges only inactive Google Sheets spend sources that match an active source signature and have zero remaining spend records.
- Google Sheets GA4 revenue add mode now creates a new additive revenue source instead of replacing an existing source by matching the same Google Sheets connection; edit/refresh mode updates only by stable `sourceId`.
- Imported GA4 revenue-to-date and revenue-breakdown endpoints now use the same source-backed record window as the Revenue Sources modal unless an explicit campaign `startDate` is configured, preventing card/source provenance drift.
- Add Revenue Google Sheets setup now silently refreshes connection state and uses the shared Google Sheets auth component without transient `Checking connection...` text that causes modal body jumps.
- Google Sheets GA4 spend add mode now creates a new additive spend source instead of replacing an existing source by matching the same Google Sheets connection; edit/refresh mode updates only by stable `sourceId`.
- Imported GA4 spend-breakdown and spend recalculation now use the same source-backed record window as the Spend Sources modal unless an explicit campaign `startDate` is configured, preventing Total Spend/source provenance drift.
- Add Spend Google Sheets setup now silently refreshes connection state and preserves stable content instead of showing transient `Checking connected Google Sheets...` or `Loading...` text that causes modal body jumps.

## Current Status By Subsystem

- Notification lifecycle and alert visibility: code audit is complete for the targeted scope. In-app bell visibility, single dismiss, clear-all, mark-read scoping, KPI/Benchmark delete hiding, campaign delete hiding, alert recreation, non-breach hiding, missing-campaign fail-closed behavior, duplicate active alert suppression, non-breaching alert hiding, orphan/cross-campaign hiding, and email-alert missing-campaign/numeric parsing boundaries have been traced and hardened. Ongoing production validation remains listed under Runtime Validation Required.
- KPI/Benchmark campaign-vs-platform route isolation: code-audited for the targeted scope. Generic platform KPI routes fail closed for campaign-layer values, generic KPI latest-period/analytics reads are access-guarded, generic KPI progress writes verify caller layer scope and fail closed for missing KPI rows, Benchmark update routes preserve persisted `campaignId`/`platformType`, Benchmark deletion cleans exact matching history rows, Benchmark history writes fail closed for missing Benchmark rows, and Benchmark history/analytics reads are access-guarded.
- KPI refresh scheduler safety: LinkedIn campaign-specific KPI refresh now skips missing selected LinkedIn campaign metrics instead of falling back to aggregate metrics.
- Report update/delete/scheduler/send visibility: code-audited for the targeted scope. Platform report update/delete/snapshot/test-send routes are ownership-guarded, direct snapshot JSON/PDF routes verify snapshot/report campaign-platform consistency, legacy Meta/Google Ads report updates cannot change report campaign/platform identity, scheduled delivery is deduplicated and campaign-existence guarded, orphaned scheduled reports are disabled after missing-campaign proof even when an existing skipped send event is found, scheduled snapshot creation now occurs only after successful delivery, test-send accepts Mailgun HTTP API configuration, test-send fails closed for missing campaigns, and report email delivery now uses the validated transactional PDF-attachment payload.
- Source edit/delete and normalized-record cleanup: started. Google Sheets campaign source read/update/helper routes are access-guarded and connection mutations verify campaign membership. CSV revenue/spend process/edit routes now refuse non-CSV `sourceId` updates. Google Sheets GA4 revenue/spend add/edit/refresh identity is hardened so add mode creates an additive source and edit/refresh mode updates only by `sourceId`; spend auto-refresh now passes that `sourceId` instead of creating duplicate sources. Google Sheets spend duplicate cleanup is restricted to exact duplicate groups and hard-delete purge is restricted to inactive zero-record duplicates. Other source families still require review.
- Campaign/client delete cascades: partially hardened; final table-by-table pass still required.
- Legacy route/schema/storage cleanup: not started and must remain last.

## Reconciled Outstanding Subsystems

- Notification lifecycle: in-app notification creation/read/dismiss/clear/delete, scheduler creation, duplicate suppression, non-breach hiding, orphan/cross-campaign hiding, missing-campaign fail-closed behavior, and email-alert stale-row checks are code-audited for the targeted scope. Remaining work is production runtime observation only.
- KPI/Benchmark route isolation: code-audited for the targeted scope. KPI platform-route reserved-value guard, generic KPI analytics/read guards, generic KPI progress scope validation and missing-row guard, Benchmark update scope immutability, Benchmark delete history cleanup, Benchmark history write existence checks, and Benchmark history/analytics read guards are complete.
- Report routes and scheduler: code-audited for the targeted scope. Platform report update/delete/snapshot/test-send ownership guards, direct snapshot JSON/PDF ownership consistency checks, legacy LinkedIn update/delete ownership guards, legacy Meta/Google Ads update ownership immutability, scheduled-send dedupe, missing-campaign skip, orphaned scheduled-report disablement, test-send missing-campaign fail-closed behavior, stale failed retry, scheduled snapshot-after-send bookkeeping, Mailgun HTTP API send/test-send alignment, delivery-status-aware test-send, and the transactional PDF-attachment email payload are complete. Legacy Meta/Google Ads report routes remain intentionally documented as legacy shared routes because their table has no persisted platform discriminator; do not remove or redesign them until Meta/Google Ads report UX is refined.
- Source delete/edit flows: started. Google Sheets source route access, connection ownership checks, CSV source-type edit guards, GA4 revenue/spend add/edit/refresh source identity, read-only Google Sheets spend duplicate inspection, confirmed Google Sheets spend duplicate cleanup, and inactive zero-record hard-delete purge are complete for the targeted pass; HubSpot, Salesforce, Shopify, LinkedIn, Meta, Google Ads, and Custom Integration still need the same route-by-route check.
- Campaign/client delete cascades: partially hardened, but final table-by-table destructive-scope pass remains outstanding.
- Legacy/stale routes and schema cleanup: not started and must remain last.

## Remaining Ordered Queue

1. Continue Source edit/delete flows and normalized-record cleanup, starting with the next unverified source family.
2. Complete final campaign/client delete cascade table-by-table pass.
3. Review legacy/stale routes and schema/storage cleanup only after proving reachability and production data dependency.

## Outstanding

- KPI routes: generic platform KPI route reserved-value guard, generic KPI analytics/read route guards, generic KPI progress scope validation, and missing-row progress write guard are complete. No remaining KPI route-isolation gaps are known from the targeted pass.
- Benchmark routes: platform Benchmark routes now reject campaign-layer platform values, Benchmark update routes preserve persisted `campaignId`/`platformType`, Benchmark deletion cleans up only exact matching history rows, Benchmark history writes require an existing Benchmark row, and Benchmark history/analytics read routes use `ensureBenchmarkAccess`. No remaining Benchmark route-isolation gaps are known from the targeted pass.
- Report routes: code-audited for the targeted scope. Platform report test-send now follows the same Mailgun HTTP API-compatible path as scheduled sends, sends the generated PDF attachment using the validated transactional payload, reports provider delivery-event failures, and fails closed if the resolved report has no valid campaign. Direct report snapshot JSON/PDF routes fail closed when snapshot campaign/platform metadata does not match the owned report. Legacy Meta/Google Ads report updates preserve persisted report ownership. Scheduled sends create snapshot rows only after successful delivery, and orphaned scheduled reports are disabled after missing-campaign proof. No remaining report destructive/visibility gap is known from this targeted pass.
- Source delete/edit flows: Google Sheets source routes are guarded for campaign access and connection ownership, CSV revenue/spend edit routes refuse non-CSV source IDs, Google Sheets GA4 revenue/spend add/edit/refresh paths now preserve additive source behavior by updating existing records only through `sourceId`, duplicate spend cleanup is guarded by exact duplicate grouping plus explicit confirmation, and hard-delete purge is limited to inactive zero-record duplicates. Continue review for HubSpot, Salesforce, Shopify, LinkedIn, Meta, Google Ads, and Custom Integration delete/edit routes. Confirm each route only mutates the intended campaign/source/platform records.
- Client delete cascade: trace all child campaign records, reports, KPIs, benchmarks, notifications, alerts, sources, snapshots, send events, and email audit rows.
- Campaign delete cascade: complete a final table-by-table scoping pass for all child rows.
- Platform-specific disconnect/delete routes: review GA4, Google Sheets, HubSpot, Salesforce, Shopify, LinkedIn, Meta, Google Ads, and Custom Integration disconnect routes.
- Scheduler jobs: review auto-refresh, alert checks, report scheduler, KPI/Benchmark recompute, source refresh, and notification creation jobs for campaign/platform scoping.
- KPI Refresh orphan logs: observed `[KPI Refresh] ... campaign not found` after report scheduler orphan logs stopped; fixed for the LinkedIn campaign-specific KPI refresh path by skipping missing selected campaign metrics instead of using aggregate fallback. Render validation confirmed the unsafe `Using aggregate metrics for campaign-specific KPI` log no longer appears.
- Legacy LinkedIn and shared report storage: prove which legacy routes are still reachable before removing or further guarding them.
- Legacy ownerless data: verify old records without modern owner/campaign metadata cannot be exposed, mutated, or deleted across users/clients.
- Email/report audit history: decide and enforce whether `email_alert_events`, `report_send_events`, and `report_snapshots` are preserved, soft-hidden, or deleted during campaign/client deletion.
- Source normalized records: confirm deleting one revenue/spend source deletes only that source's records and cannot clear unrelated totals/latest-day records/platform metrics.
- Google Sheets spend duplicate cleanup: inspect active `google_sheets` spend sources by campaign, connection, spreadsheet, tab, spend/date/campaign mapping, selected values, and amount history; keep one confirmed valid source per exact duplicate group; deactivate only confirmed duplicates; remove only normalized spend records tied to those duplicate source IDs; then recalculate campaign spend totals.
- Visibility filters: confirm UI lists exclude soft-hidden records while preserving auditability in storage.
- Schema/storage cleanup: last step only, after all route/job dependencies are proven.

## Runtime Validation Required

- Notification lifecycle: monitor Render logs after deploy for unexpected repeated `Created alert`, `Alert sent for KPI`, `Alert sent for Benchmark`, `Error checking KPI alerts`, or `Error checking Benchmark alerts` entries.
- Report scheduler orphan validation: Render logs confirmed `[Report Scheduler] ... Campaign not found` stopped repeating after orphaned schedules were disabled.
- KPI refresh fallback validation: Render logs confirmed the unsafe `Using aggregate metrics for campaign-specific KPI` message no longer appears; remaining `No ads found for LinkedIn campaign` messages are informational lookup misses, not aggregate fallback writes.
- Render scheduler timing and repeated job behavior.
- Mailgun delivery and recipient inbox delivery for any future email-template or provider-routing change.
- Production database state for legacy ownerless records.
- Historical records created before these fixes.
- Reachability of stale routes from deployed UI/API usage.

## Regression Guards

- `server/kpi-route-isolation-regression.test.ts`
- `server/benchmark-route-isolation-regression.test.ts`
- `server/campaign-benchmark-ui-regression.test.ts`
- `server/endpoint-auth-audit.test.ts`
- `server/report-email-regression.test.ts`
- `server/revenue-additivity.test.ts`
- `server/spend-source-additivity.test.ts`
- `server/latest-day-revenue-regression.test.ts`
- `server/ga4-ui-regression.test.ts`
