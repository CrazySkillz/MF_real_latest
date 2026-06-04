# Meta/Facebook Connected Platform Production-Ready Tracker

## Purpose

Track the work required to refine the Meta/Facebook Ads integration to production level for both supported user paths:

- Initial campaign creation through the `Create Campaign` flow.
- Adding Meta/Facebook later from the campaign `Connected Platforms` section.

This tracker exists so Meta/Facebook follows the same connected-source aggregate pattern used by GA4, LinkedIn, Google Ads, and Campaign DeepDive.

## Required Product Rule

`Connected Platforms` is the source of truth.

Meta/Facebook must be treated as a campaign-scoped main paid-media connected source. Only the selected Meta ad account and selected Meta campaigns should feed the campaign. Campaign DeepDive, KPIs, Benchmarks, Custom Reports, scheduled reports, and the Meta analytics page should consume Meta through source-backed Meta rows and the shared connected-source aggregate contract, not through placeholder values, generic campaign-level estimates, or unscoped imported revenue.

## Current Status

Meta/Facebook is not production-ready yet.

This tracker is the planning and implementation artifact. Several Meta paths already exist, but they have not been hardened to the same production-ready standard as LinkedIn and Google Ads. The current implementation is best described as partially implemented and partly test/demo oriented.

Meta Commit 2 has been implemented locally. Local validation passed; user/browser validation is pending.

Verified current foundations:

- Meta appears in the Create Campaign wizard through `SimpleMetaAuth`.
- Meta appears in the campaign `Connected Platforms` section through `SimpleMetaAuth`.
- Meta OAuth and test-mode connection routes exist.
- Meta connection and daily metrics tables exist.
- Meta selected-campaign storage exists through `selectedCampaignIds`.
- Meta analytics, KPI, Benchmark, Report, scheduler, and revenue routes exist.
- `AddRevenueWizardModal` already has `platformContext: "meta"` support.

Verified production-readiness gaps:

- `SimpleMetaAuth` only exposes the test-mode connection action in the visible UI. The live OAuth route exists server-side, but the current UI path does not provide the same live OAuth entry pattern used by hardened sources.
- Commit 2 fixed the Create Campaign/Connected Platforms test-mode setup path that allowed finalizing without selected Meta campaign IDs.
- The campaign overview card for `Facebook Ads` in `client/src/pages/campaign-detail.tsx` still uses percentage-split placeholder values from generic campaign totals. Google Ads has already been moved to source-backed values; Meta has not.
- `GET /api/meta/:campaignId/analytics` returns all mock campaigns in test mode from `generateMetaMockData`; selected-campaign filtering was not verified in that visible analytics response.
- `server/meta-scheduler.ts` filters by `selectedCampaignIds` when present, but falls back to all campaigns when selected IDs are absent. Production behavior should fail closed after the connection flow requires explicit selection.
- Live scheduler daily refresh is not yet production-proven. The reviewed code calls aggregate `getCampaignInsights` for a daily window instead of using the existing `getCampaignDailyInsights` helper for true daily rows.
- `storage.upsertMetaDailyMetrics` updates core numeric fields but does not update `metaCampaignName`, `ga4Revenue`, or `ga4UtmName` on conflict in the reviewed path.
- One performance-summary path reads Meta revenue through `getRevenueTotalForRange(id, metaStart, metaEnd)` without `platformContext: "meta"`. That can mix generic or GA4 revenue into Meta attributed revenue. A newer outcome-totals path uses `resolveMetaRevenueContext`, so active caller ownership must be traced before fixing.
- `server/utils/meta-revenue.ts` has a CSV processor that returns totals but does not materialize revenue records in the shared revenue-source storage path. Its own comment says storage integration is a placeholder.
- Meta report send and preview routes currently contain TODO behavior while returning success or placeholder preview output. That is not production-ready for report behavior.
- KPI, Benchmark, report, disconnect, reconnect, scheduler, and source-list lifecycle safety are implemented in parts, but not yet proven end to end.

Unverified from local code review so far:

- Whether final campaign creation transfers a draft Meta connection to the real campaign in every Create Campaign path.
- Whether cancelled Create Campaign setup cleans up draft Meta connections and daily rows.
- Whether Meta disconnect should delete, deactivate, or hide stale Meta daily rows, spend records, and Meta-scoped revenue sources.
- Whether Meta KPI and Benchmark current values use the same source-backed values shown in the Meta analytics page.
- Whether scheduled reports discover, snapshot, send, and audit Meta reports through the same guarded report framework as other production-ready sources.
- Live OAuth behavior in a deployed or production-like environment.

## Existing Relevant Paths

Client:

- `client/src/components/SimpleMetaAuth.tsx`
  - Meta connection UI used by both Create Campaign and Connected Platforms.

- `client/src/pages/campaigns.tsx`
  - Create Campaign wizard and draft campaign lifecycle.

- `client/src/pages/campaign-detail.tsx`
  - Campaign Overview, Connected Platforms UI, source list display, revenue wizard launch, and current placeholder Facebook card values.

- `client/src/pages/meta-analytics.tsx`
  - Meta Overview, campaign table, KPIs, Benchmarks, Insights, and Reports page.

- `client/src/pages/meta-analytics/MetaKpiModal.tsx`
  - Meta KPI create/edit UI.

- `client/src/pages/meta-analytics/MetaBenchmarkModal.tsx`
  - Meta Benchmark create/edit UI.

- `client/src/pages/meta-analytics/MetaReportModal.tsx`
  - Meta Report create/edit UI.

- `client/src/components/AddRevenueWizardModal.tsx`
  - Shared revenue-source wizard with existing `platformContext: "meta"` support.

Server:

- `server/routes-oauth.ts`
  - Meta OAuth, test connection, connection status, selected campaigns, analytics, daily metrics, refresh, KPI, Benchmark, Report, revenue, Connected Platforms, and outcome totals routes.

- `server/storage.ts`
  - Meta connection, Meta daily metrics, Meta KPI, Meta Benchmark, Meta Report, revenue source, revenue record, spend source, and spend record persistence.

- `server/meta-scheduler.ts`
  - Meta test-mode and live refresh behavior.

- `server/services/meta-graph-api.ts`
  - Meta Graph API client.

- `server/utils/metaMockData.ts`
  - Meta mock analytics generator.

- `server/utils/meta-revenue.ts`
  - Meta revenue context and partial CSV revenue processing.

- `server/utils/performance-summary-aggregate.ts`
  - Shared connected-source aggregate helper.

- `server/auto-refresh-scheduler.ts`
  - Existing refreshable revenue context and ad-platform spend refresh logic.

Shared/schema:

- `shared/schema.ts`
  - `metaConnections`, `metaDailyMetrics`, `metaKpis`, `metaBenchmarks`, and `metaReports`.

Existing endpoints likely involved:

- `POST /api/auth/meta/connect`
- `GET /api/auth/meta/callback`
- `GET /api/campaigns/:campaignId/meta/connection`
- `DELETE /api/campaigns/:campaignId/meta/connection`
- `POST /api/meta/:campaignId/connect-test`
- `GET /api/meta/:campaignId/connection`
- `DELETE /api/meta/:campaignId/connection`
- `POST /api/meta/transfer-connection`
- `GET /api/meta/:campaignId/campaigns`
- `PATCH /api/meta/:campaignId/selected-campaigns`
- `GET /api/meta/:campaignId/analytics`
- `GET /api/meta/:campaignId/daily-metrics`
- `POST /api/meta/:campaignId/refresh`
- `GET /api/meta/:campaignId/revenue/summary`
- `POST /api/meta/:campaignId/revenue/manual`
- `POST /api/meta/:campaignId/revenue/csv`
- `GET /api/platforms/meta/kpis/:campaignId`
- `POST /api/platforms/meta/kpis`
- `PATCH /api/platforms/meta/kpis/:kpiId`
- `DELETE /api/platforms/meta/kpis/:kpiId`
- `GET /api/campaigns/:id/benchmarks/evaluated?platform=meta`
- `POST /api/campaigns/:id/benchmarks`
- `PATCH /api/benchmarks/:benchmarkId`
- `DELETE /api/benchmarks/:benchmarkId`
- `GET /api/meta/reports?campaignId=:campaignId`
- `POST /api/meta/reports`
- `PATCH /api/meta/reports/:reportId`
- `DELETE /api/meta/reports/:reportId`
- `POST /api/meta/reports/:reportId/send`
- `GET /api/meta/reports/:reportId/preview`
- `GET /api/campaigns/:id/connected-platforms`
- `GET /api/campaigns/:id/outcome-totals`
- `GET /api/campaigns/:id/revenue-sources?platformContext=meta`
- `GET /api/campaigns/:id/revenue-totals?platformContext=meta`
- `GET /api/campaigns/:id/revenue-to-date?platformContext=meta`

## Production-Ready Target Contract

Meta/Facebook is production-ready only when all of the following are true:

- The campaign has a persisted Meta source tied to the correct campaign.
- The source stores the selected Meta ad account and selected Meta campaigns.
- The source is scoped to the current client and campaign.
- Meta appears in `Connected Platforms` only after a valid connection and campaign selection state exists.
- Source-backed Meta daily rows are the only Meta values used in Campaign Overview, Campaign DeepDive, reports, KPIs, and Benchmarks.
- Campaign DeepDive consumes Meta through the shared aggregate contract.
- Missing Meta metrics render as unavailable with a reason, not as invented zeroes or placeholder estimates.
- Spend, impressions, reach, clicks, conversions, video views, CTR, CPC, CPM, CPP, frequency, CPA, conversion rate, ROAS, and ROI use only valid source-backed inputs.
- Meta attributed revenue uses only Meta-scoped revenue sources or explicitly mapped Meta attribution, not generic campaign revenue.
- Scheduler refresh updates the same source-backed values used by the UI.
- Disconnect and reconnect only affect the current campaign's Meta source and related Meta-scoped records.
- Test mode follows the same source contract as live mode.
- Live OAuth is validated in a deployed or production-like environment before the live OAuth path is called production-ready.

## Source Capability Rules

Meta may provide:

- impressions
- reach
- clicks
- spend
- conversions
- video views
- post engagement
- link clicks
- CTR
- CPC
- CPM
- CPP
- frequency
- cost per conversion
- conversion rate
- native Meta conversion value only when explicitly configured and labeled
- imported Meta attributed revenue only when a Meta-scoped revenue source exists
- ROAS and ROI only when valid Meta spend and valid Meta attributed revenue exist

Meta should not provide:

- GA4 users
- GA4 sessions
- GA4 pageviews
- GA4 revenue unless explicitly labeled as GA4-attributed and mapped to Meta
- LinkedIn revenue
- Google Ads conversion value
- generic campaign revenue without Meta source provenance
- placeholder campaign-level percentage splits

## Reuse Versus Meta-Specific Work

Safe to reuse:

- The LinkedIn and Google Ads connected-source production-ready pattern.
- The shared `Connected Platforms` status pattern.
- The shared `performanceSummary.sources` aggregate contract.
- The Google Ads pattern for replacing placeholder campaign card values with source-backed values.
- The LinkedIn and Google Ads pattern for explicit selected-campaign persistence.
- Existing `revenueSources` and `revenueRecords` storage patterns for platform-scoped imported revenue.
- Existing HubSpot, Salesforce, Shopify, Google Sheets, and CSV revenue wizard flows through `platformContext`.
- Existing scheduler fail-closed and campaign-access guard patterns.
- Existing KPI, Benchmark, and report guard patterns where already proven for other platforms.

Must be Meta-specific:

- Meta OAuth scopes, callback behavior, token lifetime, and app credentials.
- Meta ad account selection and campaign IDs.
- Meta Graph API campaign, insights, daily insights, demographic, geographic, placement, ad set, and ad calls.
- Meta mock/test campaign IDs and names.
- Meta daily metric field semantics, including reach, frequency, CPP, post engagement, and link clicks.
- Meta selected-campaign filtering for test mode and live mode.
- Meta campaign mapping for imported attributed revenue.
- Meta report templates and Meta KPI/Benchmark metric definitions.

Do not add:

- A new reporting framework.
- A new revenue framework.
- A new source storage framework.
- Parallel frontend source-management patterns.
- New broad abstractions unless a specific later commit proves they are required.

## Implementation Plan

### Meta Commit 1: Documentation And Acceptance Contract

Goal:

- Establish the Meta/Facebook production-ready checklist before code changes.

Tasks:

- Create this tracker.
- Document the root cause and exact high-risk code paths.
- Define the production-ready source contract and validation evidence required.

Validation:

- Confirm this file lists the known source-contract gaps.
- Confirm both Create Campaign and Connected Platforms paths are covered.
- Confirm each later commit has a simple validation checklist.

Status:

- [x] Tracker created locally.
- [ ] User review complete.

### Meta Commit 2: Create Campaign Meta Flow Hardening

Goal:

- Make Meta connected during initial campaign creation persist the same source contract as later source addition.

Tasks:

- Trace the draft campaign lifecycle in `client/src/pages/campaigns.tsx`.
- Reuse `SimpleMetaAuth` but harden it instead of creating a new flow.
- Add a live OAuth entry if credentials are configured and keep test mode clearly labeled.
- Remove or block `Skip (import all)` for production-source setup.
- Require explicit campaign selection before Meta is finalized as connected.
- Make test-mode campaign listing return test campaigns without calling the live Graph API.
- Confirm failed, cancelled, or no-campaign paths do not leave a misleading connected source.
- Confirm draft-to-real campaign transfer is scoped and safe.

Validation:

- Create a new campaign.
- Select Meta/Facebook in the Create Campaign flow.
- Connect with test mode.
- Select one Meta campaign.
- Finalize campaign.
- Confirm Connected Platforms shows Meta connected.
- Confirm `/api/campaigns/:campaignId/connected-platforms` shows Meta connected for that campaign only.
- Confirm `/api/meta/:campaignId/connection` returns the selected ad account.
- Confirm `/api/meta/:campaignId/campaigns` works in test mode.

Status:

- [x] Completed locally: `GET /api/meta/:campaignId/campaigns` now returns test-mode campaigns from the same mock campaign IDs used by the scheduler instead of calling the live Graph API with a test token.
- [x] Completed locally: `SimpleMetaAuth` defers test-mode mock row seeding until after campaign selection is saved.
- [x] Completed locally: `SimpleMetaAuth` no longer finalizes Meta setup when campaigns fail to load, when no campaigns exist, or through `Skip (import all)`.
- [x] Completed locally: selected Meta campaign saves reject empty selections.
- [x] Completed locally: test-mode mock daily rows are generated after selected campaign IDs are saved, using those selected IDs.
- [x] Completed locally: regression coverage added in `server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [ ] User/browser validation pending.

### Meta Commit 3: Connected Platforms Add-Source Hardening

Goal:

- Make adding Meta later from Connected Platforms use the same source contract as Create Campaign.

Tasks:

- Trace `SimpleMetaAuth` usage in `client/src/pages/campaign-detail.tsx`.
- Replace page reload success behavior with targeted query invalidation, matching the Google Ads/LinkedIn pattern.
- Ensure successful connection invalidates Connected Platforms, outcome totals, Executive Summary, Trend Analysis, Meta analytics, KPI, Benchmark, and report queries.
- Ensure Meta is not marked connected until a valid connection and selected-campaign state exists.

Validation:

- Open an existing campaign.
- Add Meta from Connected Platforms.
- Connect with test mode.
- Select one Meta campaign.
- Confirm the Connected Platforms card updates without a full page reload.
- Confirm the Meta analytics link appears only for the connected campaign.

Status:

- [ ] Not started.

### Meta Commit 4: Remove Placeholder Facebook Metrics

Goal:

- Stop showing invented Facebook values in campaign overview cards.

Tasks:

- Remove Facebook percentage-split calculations from `client/src/pages/campaign-detail.tsx`.
- Read Meta card metrics from `performanceSummary.sources[].id === "meta"` or the same verified source-backed aggregate used by Campaign DeepDive.
- Show unavailable or zero only when the source-backed response proves that is the correct value.
- Preserve unrelated platform behavior.

Validation:

- Meta disconnected: Facebook card does not show connected source metrics.
- Meta connected with no rows: values are unavailable or zero only where zero is a real source value.
- Meta test mode with selected campaigns: card values match selected Meta source rows.
- Google Ads, LinkedIn, GA4, and Google Sheets cards still render as before.

Status:

- [ ] Not started.

### Meta Commit 5: Selected Campaign Scoping And Analytics Route Parity

Goal:

- Ensure every visible Meta analytics path respects selected Meta campaign IDs.

Tasks:

- Apply selected-campaign filtering to `GET /api/meta/:campaignId/analytics`.
- Apply selected-campaign filtering to test mode and live mode consistently.
- Confirm `GET /api/meta/:campaignId/daily-metrics` returns only the current campaign's selected Meta source rows.
- Confirm campaign tables, overview totals, charts, and breakdowns use the same filtered rows.
- Fail closed when selected campaign IDs are required but missing after a completed setup.

Validation:

- Connect Meta test mode.
- Select one Meta campaign.
- Confirm Meta Overview totals include only that selected campaign.
- Confirm Meta campaign table shows only selected campaigns or clearly marks selected-scope rows.
- Change selected campaigns and refresh.
- Confirm totals change only to the new selected scope.

Status:

- [ ] Not started.

### Meta Commit 6: Aggregate And Revenue Semantics Hardening

Goal:

- Prevent wrong ROAS/ROI by making Meta source and revenue meanings explicit.

Tasks:

- Audit all Meta aggregate callers, especially `GET /api/campaigns/:id/outcome-totals`.
- Fix any Meta revenue total calls that omit `platformContext: "meta"`.
- Ensure `performanceSummary.sources[].id === "meta"` includes only Meta source metrics.
- Keep native Meta conversion value separate from imported Meta attributed revenue.
- Ensure ROAS, ROI, and profit use imported Meta attributed revenue only when it exists and is labeled.
- Add source provenance and unavailable reasons.

Validation:

- Meta connected with spend but no imported Meta revenue: Meta spend metrics show; revenue-dependent metrics are unavailable or clearly zero with unavailable semantics.
- Meta connected with Meta-scoped imported revenue: Total Revenue, ROAS, ROI, and Profit use that attributed revenue.
- GA4-only revenue does not unlock Meta attributed revenue.
- LinkedIn revenue does not unlock Meta attributed revenue.
- Google Ads revenue does not unlock Meta attributed revenue.

Status:

- [ ] Not started.

### Meta Commit 7: Scheduler And Refresh Hardening

Goal:

- Make scheduled and manual Meta refresh update the same source-backed rows consumed by the UI.

Tasks:

- Audit `server/meta-scheduler.ts` test-mode and live-mode refresh.
- Use selected campaign IDs in both test and live refresh.
- Replace aggregate daily-window calls with true daily insights where live Graph API supports it.
- Persist `lastRefreshAt` consistently.
- Preserve campaign names on insert and update.
- Confirm spend record writes are campaign-scoped and do not duplicate misleading spend rows.
- Fail closed when the Meta connection or selected campaign state is invalid.

Validation:

- Trigger `/api/meta/:campaignId/refresh` for a test-mode Meta connection.
- Confirm new daily rows are written only for selected campaigns.
- Confirm Campaign Overview and Meta Overview update from the same rows.
- Confirm scheduler skips or fails closed when the connection is missing.
- Confirm unrelated campaigns are unchanged.

Status:

- [ ] Not started.

### Meta Commit 8: Disconnect, Reconnect, And Stale Data Safety

Goal:

- Ensure Meta lifecycle changes do not leave visible stale or cross-campaign data.

Tasks:

- Trace both Meta delete endpoints.
- Decide the smallest safe cleanup behavior for current-campaign Meta rows, spend records, revenue sources, KPIs, Benchmarks, reports, and notifications.
- Preserve historical records only where the existing product pattern expects historical retention.
- Ensure reconnect overwrites only the current campaign's Meta connection and selected-campaign state.
- Add targeted cleanup only after the stale-data boundary is proven.

Validation:

- Connect Meta test mode and confirm rows exist.
- Disconnect Meta.
- Confirm Connected Platforms no longer shows Meta connected.
- Confirm Campaign Overview no longer shows Meta source metrics.
- Reconnect Meta with a different selected campaign.
- Confirm only the new selected campaign feeds visible Meta totals.
- Confirm unrelated campaigns are unchanged.

Status:

- [ ] Not started.

### Meta Commit 9: KPI And Benchmark Production Hardening

Goal:

- Make Meta KPI and Benchmark creation, edit, delete, and current values source-backed and campaign-scoped.

Tasks:

- Trace `MetaKpiModal`, `MetaBenchmarkModal`, and their server routes.
- Confirm create/update/delete all enforce campaign access.
- Confirm current values are populated from the same Meta source-backed aggregate as the Overview.
- Confirm revenue-dependent KPI/Benchmark metrics use Meta attributed revenue only.
- Confirm alert recreation and notification visibility behavior follows existing destructive/visibility rules.

Validation:

- Create a Meta KPI from a source-backed metric.
- Confirm the KPI card appears and current value matches Meta Overview.
- Edit the KPI and confirm the current value remains correct.
- Delete the KPI and confirm only that KPI is removed.
- Repeat for a Meta Benchmark.
- Confirm unrelated campaign KPIs and Benchmarks are unchanged.

Status:

- [ ] Not started.

### Meta Commit 10: Report And Scheduled Report Safety

Goal:

- Make Meta reports production-safe instead of returning placeholder success.

Tasks:

- Trace Meta report create, edit, delete, preview, and send routes.
- Remove or disable fake send success until an actual send path exists.
- Ensure preview output is generated from source-backed Meta data or clearly unavailable.
- Confirm scheduled report discovery includes Meta only through valid campaign-scoped reports.
- Confirm scheduled snapshots represent successful sent artifacts only.
- Guard direct report output by report access and campaign-platform consistency.

Validation:

- Create a Meta report.
- Preview it and confirm it uses source-backed Meta values.
- Attempt send only if a real send path is available.
- Confirm fake send success is not shown.
- Delete the report and confirm only that report is removed.
- Confirm scheduler does not process reports for missing campaigns.

Status:

- [ ] Not started.

### Meta Commit 11: Meta Attributed Revenue Import Parity

Goal:

- Make Meta imported revenue follow the same source-management pattern as GA4, LinkedIn, and Google Ads if Meta revenue is included in production scope.

Tasks:

- Replace placeholder Meta CSV revenue processing with shared `revenueSources` and `revenueRecords` storage.
- Ensure HubSpot, Salesforce, Shopify, Google Sheets, and CSV all pass `platformContext: "meta"`.
- Support multiple Meta revenue sources.
- Support source provenance in the Sources list.
- Support add, edit, delete, and refresh where applicable.
- Add explicit source-value-to-Meta-campaign mapping when imported data does not contain Meta campaign IDs.
- Ensure Total Revenue, ROAS, ROI, and Profit use summed Meta attributed revenue only.

Validation:

- Add Meta attributed revenue from CSV.
- Confirm the Meta source appears in Sources.
- Confirm Total Revenue uses the imported Meta attributed revenue.
- Add a second Meta revenue source and confirm totals sum.
- Edit one source and confirm totals update.
- Delete one source and confirm totals update.
- Confirm GA4, LinkedIn, and Google Ads revenue totals are unchanged.

Status:

- [ ] Not started.

### Meta Commit 12: Final Production-Readiness Regression And Documentation

Goal:

- Prove the implemented Meta source-backed path is production-ready for the validated local/test-mode scope.

Tasks:

- Run the complete Meta regression suite created during earlier commits.
- Run shared production regression tests that cover Campaign DeepDive, aggregate behavior, scheduler behavior, source safety, KPI/Benchmark behavior, and report behavior.
- Update this tracker with validation evidence and any remaining live-OAuth caveats.
- Link this tracker from relevant status documentation only after implementation starts.

Validation:

- Run the Meta test suite introduced by the implementation commits.
- Run `npm run check`.
- Perform a browser pass for Create Campaign test mode.
- Perform a browser pass for Connected Platforms add-source test mode.
- Confirm no GA4, LinkedIn, Google Ads, or Google Sheets regression is introduced.

Status:

- [ ] Not started.

## Validation Evidence Required Before Production-Ready Claim

Must be proven locally:

- Create Campaign Meta connection path.
- Connected Platforms Meta add-source path.
- Selected Meta campaign scoping.
- Source-backed Campaign Overview Meta card.
- Meta analytics Overview and campaign tables.
- Meta KPI create/edit/delete.
- Meta Benchmark create/edit/delete.
- Meta report create/edit/delete/preview behavior.
- Meta scheduler/manual refresh behavior.
- Meta disconnect/reconnect behavior.
- Meta revenue semantics if attributed revenue is included in scope.
- Existing GA4 behavior unchanged.
- Existing LinkedIn behavior unchanged.
- Existing Google Ads behavior unchanged.

Must be proven in deployed or production-like environment before live OAuth is called production-ready:

- Meta OAuth start route.
- Meta OAuth callback route.
- Token exchange.
- Ad account discovery.
- Campaign discovery.
- Live selected-campaign import.
- Live scheduler refresh.

## Outstanding

Outstanding required implementation work:

- Meta Commit 3 through Meta Commit 12.

Outstanding evidence:

- Meta Commit 2 user/browser validation is pending.
- Live OAuth evidence is not available locally.

## Current Handoff

The next smallest safest implementation step after Meta Commit 2 validation is Meta Commit 3: harden adding Meta/Facebook from Connected Platforms. That commit should focus on replacing the page reload success behavior with targeted query invalidation and should not change source metrics, KPI, Benchmark, report, scheduler, or revenue behavior yet.
