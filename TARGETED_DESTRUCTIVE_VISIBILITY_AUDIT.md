# Targeted Production-Ready Destructive/Visibility Audit

## Purpose

Track the remaining production-readiness work for destructive and visibility paths.

This audit covers user-visible data loss, hidden records, scheduler side effects, report delivery visibility, alert/notification lifecycle, and destructive cascades.

Rule: do not mark an item complete unless the route/job/storage path has been traced end to end and validated.

Trust rule: do not mark a source family, scheduler path, or destructive/visibility subsystem complete until add/create, edit/update, delete/deactivate, refresh/scheduler/reprocess, visible list/modal display, totals/recompute, and existing damaged-data cleanup have been traced or explicitly marked out of scope.

Last updated: 2026-05-17 after the notification lifecycle targeted pass, KPI progress scope validation, KPI analytics/read route access guards, KPI progress write fail-closed guard, LinkedIn campaign-specific KPI refresh fallback removal validated in Render logs, Benchmark update route scope hardening, campaign Benchmark edit-format regression guard, exact Benchmark history cleanup on Benchmark delete, Benchmark history write fail-closed guard, Benchmark history/analytics read-route access guards, report test-send Mailgun HTTP API alignment, report test-send missing-campaign fail-closed hardening, orphaned scheduled-report disablement validated in Render logs, direct report snapshot ownership hardening, scheduled report snapshot bookkeeping hardening, legacy Meta/Google Ads report update ownership immutability, production validation of plain transactional report emails with PDF attachments, Google Sheets campaign source route access hardening, CSV revenue/spend source-type edit guards, Google Sheets revenue additivity/source-window/UI-stability hardening, Google Sheets spend additivity/source-window/UI-stability hardening, Google Sheets spend auto-refresh source identity hardening, CRM/ecommerce revenue source edit/refresh source-ID fail-closed guards for HubSpot, Salesforce, and Shopify, post-deploy validation that CRM/ecommerce source updates do not create duplicate source rows, CRM/ecommerce connection delete membership guards, individual revenue source delete campaign/source ownership regression coverage, stale CRM/ecommerce revenue-source scheduler skips, LinkedIn spend edit/refresh source-ID preservation, LinkedIn revenue cleanup HubSpot pipeline scope guarding, and LinkedIn disconnect route fail-closed guards.

Current reconciliation note: use the single authoritative outstanding queue in this file. Older partial lists are superseded. KPI analytics/read route guards, Benchmark route isolation, Benchmark history cleanup, Benchmark history/analytics read guards, Report routes/scheduler safety, Google Sheets source safety, CSV source-type edit guards, CRM/ecommerce source edit/refresh `sourceId` guards, and CRM/ecommerce connection-delete membership guards have been completed for the targeted scope. The active subsystem is Source edit/delete and normalized-record cleanup.

Existing damaged-data note: the Google Sheets spend auto-refresh source-identity fix prevents new duplicate Google Sheets spend sources from being created by refresh. The duplicate inspector/cleanup/purge endpoints are intentionally narrow: cleanup soft-deactivates only exact duplicate groups, and purge hard-deletes only inactive zero-record duplicates that match an active source signature. Any skipped inactive rows remain preserved until their record dependencies are proven safe to remove.

Latest production validation note: after deploy, Total Spend source count remained stable after refresh. The deployed campaign did not include a LinkedIn spend source, so the LinkedIn spend in-place refresh path is code/test validated but not yet live-data exercised. LinkedIn source-flow boundaries are code/test complete for the current targeted scope; when a real LinkedIn spend source exists, refresh should still be observed once to confirm in-place provider data update.

## Execution Method

Work through this audit by subsystem, not by isolated symptoms.

For each subsystem:

- define the destructive or visibility invariant before editing
- trace frontend caller, API route, storage method, scheduler path, and UI read path where applicable
- implement only the smallest confirmed fix
- add or update the narrowest regression guard available
- validate the fixed path and one adjacent same-subsystem path
- update this tracker immediately after validation

Efficiency rule:

- batch by subsystem for tracing, but commit only coherent targeted fixes
- do not jump between source families unless the current family is marked done or explicitly blocked
- every source-family pass must check the same lifecycle shape: add/save, edit/update, delete/disconnect, refresh/scheduler, source-modal display, totals/recompute, and existing damaged-data cleanup
- if a lifecycle path is not implemented for that source family, mark it explicitly as out of scope rather than leaving it ambiguous
- avoid adding cleanup endpoints until the forward path is fixed and the damaged-record boundary is proven

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
- HubSpot, Salesforce, and Shopify revenue save/refresh endpoints now fail closed when edit or scheduler mode supplies a stale, wrong-campaign, wrong-context, or wrong-source-type `sourceId`, preventing source duplication or cross-source mutation.
- HubSpot, Salesforce, and Shopify connection delete routes now verify that a supplied `connectionId` belongs to the requested campaign before deactivating it, preventing cross-campaign connection deletion.
- The direct `Total Revenue -> Sources -> delete` route proves the revenue source belongs to the requested campaign before deactivating the source and deleting normalized records tied to that source ID.
- The external auto-refresh scheduler classifies stale HubSpot, Salesforce, and Shopify revenue-source `404` responses as skipped stale sources instead of failed reprocesses, preserving fail-closed behavior without noisy false failure logs.
- LinkedIn spend edit and auto-refresh mode now pass and validate the stable spend `sourceId`, update only that active `linkedin_api` source, and fail closed if the source is stale, wrong-campaign, inactive, or not a LinkedIn spend source.
- LinkedIn revenue cleanup clears HubSpot pipeline proxy configuration only when the saved HubSpot mapping is explicitly `platformContext=linkedin`, preventing LinkedIn cleanup from mutating GA4 HubSpot pipeline proxy state.
- LinkedIn disconnect routes require campaign access before deleting a connection, delete only by `campaignId`, and return `404` when no connection row is deleted.
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
- Source edit/delete and normalized-record cleanup: started. Google Sheets campaign source read/update/helper routes are access-guarded and connection mutations verify campaign membership. CSV revenue/spend process/edit routes now refuse non-CSV `sourceId` updates. Google Sheets GA4 revenue/spend add/edit/refresh identity is hardened so add mode creates an additive source and edit/refresh mode updates only by `sourceId`; spend auto-refresh now passes that `sourceId` instead of creating duplicate sources. Google Sheets spend duplicate cleanup is restricted to exact duplicate groups and hard-delete purge is restricted to inactive zero-record duplicates. HubSpot, Salesforce, and Shopify revenue save/refresh endpoints now validate supplied `sourceId` against campaign, platform context, and source type before mutation, their connection delete routes verify the connection belongs to the requested campaign before deactivation, the direct source-delete route proves campaign/source ownership before deleting source records, scheduler stale-source 404s are skipped as stale sources rather than false failed reprocesses, and LinkedIn spend/edit/refresh/disconnect/revenue-cleanup source boundaries are code/test complete for the targeted scope. Remaining Meta, Google Ads, Custom Integration, and remaining CSV/source-upload read/delete paths still require review.
- Campaign/client delete cascades: partially hardened; final table-by-table pass still required.
- Legacy route/schema/storage cleanup: not started and must remain last.

## Reconciled Outstanding Subsystems

- Notification lifecycle: in-app notification creation/read/dismiss/clear/delete, scheduler creation, duplicate suppression, non-breach hiding, orphan/cross-campaign hiding, missing-campaign fail-closed behavior, and email-alert stale-row checks are code-audited for the targeted scope. Remaining work is production runtime observation only.
- KPI/Benchmark route isolation: code-audited for the targeted scope. KPI platform-route reserved-value guard, generic KPI analytics/read guards, generic KPI progress scope validation and missing-row guard, Benchmark update scope immutability, Benchmark delete history cleanup, Benchmark history write existence checks, and Benchmark history/analytics read guards are complete.
- Report routes and scheduler: code-audited for the targeted scope. Platform report update/delete/snapshot/test-send ownership guards, direct snapshot JSON/PDF ownership consistency checks, legacy LinkedIn update/delete ownership guards, legacy Meta/Google Ads update ownership immutability, scheduled-send dedupe, missing-campaign skip, orphaned scheduled-report disablement, test-send missing-campaign fail-closed behavior, stale failed retry, scheduled snapshot-after-send bookkeeping, Mailgun HTTP API send/test-send alignment, delivery-status-aware test-send, and the transactional PDF-attachment email payload are complete. Legacy Meta/Google Ads report routes remain intentionally documented as legacy shared routes because their table has no persisted platform discriminator; do not remove or redesign them until Meta/Google Ads report UX is refined.
- Source delete/edit flows: started. Google Sheets source route access, connection ownership checks, CSV source-type edit guards, GA4 revenue/spend add/edit/refresh source identity, read-only Google Sheets spend duplicate inspection, confirmed Google Sheets spend duplicate cleanup, inactive zero-record hard-delete purge, HubSpot/Salesforce/Shopify revenue save/refresh `sourceId` fail-closed guards, HubSpot/Salesforce/Shopify connection delete membership guards, direct GA4-context revenue source delete campaign/source ownership, stale CRM/ecommerce source scheduler skips, LinkedIn spend edit/refresh `sourceId` preservation, LinkedIn revenue cleanup HubSpot pipeline context guarding, and LinkedIn disconnect fail-closed campaign-scope guards are complete for the targeted pass. Remaining Meta, Google Ads, Custom Integration, and remaining CSV/source-upload read/delete paths still need the same route-by-route check.
- Campaign/client delete cascades: partially hardened, but final table-by-table destructive-scope pass remains outstanding.
- Legacy/stale routes and schema cleanup: not started and must remain last.

## Authoritative Outstanding Queue

1. Ad-platform source-flow pass.
   Scope: Meta and Google Ads spend/revenue source read, edit, delete, disconnect, refresh, and scheduler paths.
   Goal: prove ad-platform source actions cannot mutate unrelated campaign/platform records and cannot create duplicate source rows during refresh.
   Fast execution order: Meta, then Google Ads.

2. Remaining CSV/source-upload and Custom Integration pass.
   Scope: CSV read/delete/upload preview paths not already covered by source-type edit guards, plus Custom Integration connect/disconnect/source mutation routes.
   Goal: prove uploads and custom source actions are campaign-scoped and only delete/update their own records.
   Fast execution order: CSV/source-upload first because it shares current source modal patterns, then Custom Integration.

3. Campaign/client delete cascade pass.
   Scope: campaign delete and client delete across child tables.
   Goal: table-by-table proof that deleting one campaign/client removes or hides only that campaign/client's rows, including sources, normalized records, KPIs, Benchmarks, notifications, reports, snapshots, send events, and email audit rows.

4. Legacy/stale route and schema/storage cleanup.
   Scope: old report/source/platform routes, ownerless data behavior, and unused schema/storage paths.
   Goal: remove or guard only code proven unused or unsafe; this stays last because stale-code cleanup has the highest accidental data-risk.

## Next Step

The next safest smallest step is item 1: audit Meta source-flow routes before Google Ads because Meta uses the same ad-platform family patterns and should expose shared risks first.

## Runtime Validation Required

- Notification lifecycle: monitor Render logs after deploy for unexpected repeated `Created alert`, `Alert sent for KPI`, `Alert sent for Benchmark`, `Error checking KPI alerts`, or `Error checking Benchmark alerts` entries.
- Report scheduler orphan validation: Render logs confirmed `[Report Scheduler] ... Campaign not found` stopped repeating after orphaned schedules were disabled.
- KPI refresh fallback validation: Render logs confirmed the unsafe `Using aggregate metrics for campaign-specific KPI` message no longer appears; remaining `No ads found for LinkedIn campaign` messages are informational lookup misses, not aggregate fallback writes.
- Source refresh validation: Total Spend source count remained stable after the latest source-identity deploy. LinkedIn spend in-place refresh still needs live-data observation when an active LinkedIn spend source exists.
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
- `server/source-safety-regression.test.ts`
- `server/latest-day-revenue-regression.test.ts`
- `server/ga4-ui-regression.test.ts`
