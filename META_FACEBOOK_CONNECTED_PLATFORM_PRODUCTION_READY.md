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

Meta Commit 14 has been implemented locally. Local validation passed; user/browser validation is pending.

Verified current foundations:

- Meta appears in the Create Campaign wizard through `SimpleMetaAuth`.
- Meta appears in the campaign `Connected Platforms` section through `SimpleMetaAuth`.
- Meta OAuth and test-mode connection routes exist.
- Meta connection and daily metrics tables exist.
- Meta selected-campaign storage exists through `selectedCampaignIds`.
- Meta analytics, KPI, Benchmark, Report, scheduler, and revenue routes exist.
- `AddRevenueWizardModal` already has `platformContext: "meta"` support.
- Commit 4 replaced the Campaign Overview `Facebook Ads` percentage-split placeholder metrics with source-backed values from `performanceSummary.sources[].id === "meta"`.
- Commit 5 scopes visible Meta analytics, daily metrics, and Campaign Overview Meta aggregate totals to saved selected Meta campaign IDs.
- Commit 6 gates Meta attributed revenue in the shared aggregate behind Meta revenue tracking and fixes an unscoped Meta revenue read in Executive Summary.
- Commit 7 adds a Google Ads-style Meta Overview Total Revenue card, plus/add action, Sources link, source provenance, edit/delete source behavior, and the shared revenue wizard entry point for Meta-attributed revenue.
- Commit 8 aligns the Meta Overview initial loading state with the app-level `Loading...` fallback to avoid refresh layout jumps.
- Commit 9 makes Meta scheduler/manual refresh fail closed when selected Meta campaign IDs are missing instead of refreshing all campaigns in the ad account.
- Commit 10 makes live Meta scheduler refresh use true daily insight rows and preserves Meta daily-row metadata during upsert.
- Commit 11 cleans current-campaign Meta-owned daily metric rows and Meta scheduler spend rows during disconnect/reconnect without deleting user-created Meta revenue sources, KPIs, Benchmarks, or reports.
- Commit 12 moves Meta KPI and Benchmark lifecycle behavior onto the shared platform-scoped KPI/Benchmark storage pattern and maps revenue-dependent current values to imported Meta attributed revenue.
- Commit 13 moves Meta report cards to the shared platform-report route, persists scheduler-compatible schedule fields, and makes legacy Meta report send/preview routes fail closed instead of returning placeholder success.
- Commit 14 preserves Meta revenue import context through the shared revenue wizard, Sheets, HubSpot, Salesforce, scheduler refresh paths, and makes the legacy direct Meta CSV route fail closed instead of returning placeholder import success.

Verified production-readiness gaps:

- `SimpleMetaAuth` only exposes the test-mode connection action in the visible UI. The live OAuth route exists server-side, but the current UI path does not provide the same live OAuth entry pattern used by hardened sources.
- Commit 2 fixed the Create Campaign/Connected Platforms test-mode setup path that allowed finalizing without selected Meta campaign IDs.
- Commit 3 browser validation was recorded as semi-validated: the Meta add-source path works, but the connection-success transition is not smooth and remains a future UX follow-up.
- Commit 5 replaced the visible Meta analytics test-mode route's separate all-campaign mock generator with persisted selected Meta daily rows.
- `server/meta-scheduler.ts` filters by `selectedCampaignIds` when present, but falls back to all campaigns when selected IDs are absent. Production behavior should fail closed after the connection flow requires explicit selection.
- Live scheduler daily refresh is implemented locally with `getCampaignDailyInsights`, but still requires deployed/production-like evidence before calling live scheduler refresh production-ready.
- `storage.upsertMetaDailyMetrics` now updates `metaCampaignName` and preserves GA4 attribution metadata on conflict in the reviewed path.
- `server/utils/meta-revenue.ts` still contains a legacy CSV helper that returns totals without materializing shared revenue records. The visible wizard uses the shared CSV import route, and the legacy direct Meta CSV route now fails closed instead of returning placeholder import success.
- Legacy Meta report send and preview routes now return unavailable instead of fake success or placeholder preview output.
- Meta report create/list/edit/delete now uses the shared platform-report storage path locally; browser validation passed for the implemented Commit 13 path.

Unverified from local code review so far:

- Whether final campaign creation transfers a draft Meta connection to the real campaign in every Create Campaign path.
- Whether cancelled Create Campaign setup cleans up draft Meta connections and daily rows.
- Whether Meta disconnect should delete, deactivate, or hide stale Meta daily rows, spend records, and Meta-scoped revenue sources.
- Whether scheduled Meta reports successfully send source-backed PDFs in a deployed or production-like environment.
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
- `GET /api/platforms/meta/benchmarks?campaignId=:campaignId`
- `POST /api/platforms/meta/benchmarks`
- `PUT /api/platforms/meta/benchmarks/:benchmarkId`
- `DELETE /api/platforms/meta/benchmarks/:benchmarkId`
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
- [x] Completed locally: Create Campaign confirm Back clears the selected connector before returning to platform selection, so it does not re-enter the OAuth/auth page.
- [x] Completed locally: regression coverage added in `server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] User/browser validation passed for the explicit Meta campaign selection flow.

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

- [x] Completed locally: traced `SimpleMetaAuth` usage in `client/src/pages/campaign-detail.tsx`.
- [x] Completed locally: added `invalidateMetaConnectedPlatformQueries` to refresh Connected Platforms, Meta analytics, outcome totals, Executive Summary, Trend Analysis, KPI, Benchmark, report, and data-source query caches.
- [x] Completed locally: replaced the Meta add-source `window.location.reload()` success behavior with targeted query invalidation.
- [x] Completed locally: regression coverage added in `server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] User/browser semi-validation recorded: add-source path works, but connection-success transition smoothness remains a future UX follow-up.

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

- [x] Completed locally: removed the Facebook percentage-split placeholder calculations from `client/src/pages/campaign-detail.tsx`.
- [x] Completed locally: Campaign Overview `Facebook Ads` metrics now read from `performanceSummary.sources[].id === "meta"`.
- [x] Completed locally: preserved the existing Google Ads, LinkedIn, GA4, and Google Sheets card paths.
- [x] Completed locally: regression coverage added in `server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] User/browser validation passed.

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

- [x] Completed locally: `GET /api/meta/:campaignId/analytics` now requires saved selected Meta campaign IDs before returning source metrics.
- [x] Completed locally: Meta test-mode analytics reads persisted selected Meta daily rows instead of the separate unscoped mock generator.
- [x] Completed locally: live Meta analytics filters fetched Meta campaigns to saved selected campaign IDs before fetching insights and computing summary totals.
- [x] Completed locally: `GET /api/meta/:campaignId/daily-metrics` filters rows to saved selected Meta campaign IDs and returns empty metrics when selection is missing.
- [x] Completed locally: `GET /api/meta/:campaignId/insights/daily` rejects unselected Meta campaign IDs and uses persisted rows for test-mode daily charts.
- [x] Completed locally: Campaign Overview Meta aggregate totals in `/api/campaigns/:id/outcome-totals` now use selected Meta rows/campaigns.
- [x] Completed locally: Connected Platforms treats Meta as connected only when a non-spend-only Meta connection has saved selected campaign IDs.
- [x] Completed locally: regression coverage added in `server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] User/browser validation passed.

### Meta Commit 6: Aggregate And Revenue Semantics Hardening

Goal:

- Prevent wrong ROAS/ROI by making Meta source and revenue meanings explicit.

Root cause:

- `/api/campaigns/:id/executive-summary` read Meta revenue with `getRevenueTotalForRange(id, metaStart, metaEnd)` and no `platformContext: "meta"`, so non-Meta imported revenue could be presented as Meta attributed revenue.
- `server/utils/performance-summary-aggregate.ts` included Meta `attributedRevenue` whenever Meta was connected, instead of following the LinkedIn pattern where attributed revenue is included only when platform-scoped revenue tracking is proven.

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

- [x] Completed locally: `GET /api/campaigns/:id/outcome-totals` now passes Meta attributed revenue, ROAS, and ROI to the aggregate only when `resolveMetaRevenueContext` confirms Meta revenue tracking.
- [x] Completed locally: `GET /api/campaigns/:id/executive-summary` now reads Meta revenue through `getRevenueTotalForRange(id, metaStart, metaEnd, "meta")`.
- [x] Completed locally: `performanceSummary.sources[].id === "meta"` now excludes `attributedRevenue` and records an unavailable reason until Meta revenue tracking is proven.
- [x] Completed locally: regression coverage added in `server/performance-summary-aggregate.test.ts` and `server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/meta-production-regression.test.ts server/performance-summary-aggregate.test.ts`.
- [x] Local validation passed: `npm run check`.
- [ ] User/browser validation pending.

### Meta Commit 7: Overview Total Revenue Source Management

Root cause analysis:

- The Meta Overview already had a visible `Configure Revenue Tracking` button, but it had no click handler and did not open any wizard or source-management UI.
- The shared `AddRevenueWizardModal` already supports `platformContext: "meta"`, and the shared revenue-source endpoints already support `platformContext=meta`; the missing piece was wiring the Meta Overview to those existing paths.
- The Meta Overview rendered an older active/not-configured revenue block instead of the Google Ads production-ready Total Revenue card pattern with a plus action and Sources provenance.
- The shared wizard invalidated only broad Meta revenue caches, so a newly added Meta revenue source could leave the Overview card stale if the Meta page was mounted.

#### Configure Revenue Tracking Link

Strategy:

- Replace the inert `Configure Revenue Tracking` button with the existing Total Revenue card plus action.
- The plus action opens `AddRevenueWizardModal` with `platformContext="meta"`.
- Do not add a new endpoint, route, or revenue framework.

#### Total Revenue Card

Strategy:

- Add an always-visible Meta Overview `Total Revenue` card.
- Show `Not connected` until a Meta-scoped revenue source exists.
- Show `Sources (n)` when Meta revenue sources exist.
- Add a Meta Revenue Sources dialog showing source label, source type, selected attribution value count, last source total, edit action, and delete action.
- Delete uses the existing shared campaign revenue-source delete endpoint.

#### Google Ads Revenue Import Pattern

Strategy:

- Reuse the Google Ads UI pattern for source-backed attributed revenue.
- Reuse existing source types supported by the shared wizard: HubSpot, Salesforce, Shopify, Google Sheets, CSV, and existing shared source patterns.
- Keep imports Meta-scoped by passing `platformContext="meta"`.
- Total Revenue, ROAS, ROI, and Profit use imported Meta attributed revenue only.
- Do not mix old Meta revenue-summary values into the imported Total Revenue card.

Files changed:

- `client/src/pages/meta-analytics.tsx`
- `client/src/components/AddRevenueWizardModal.tsx`
- `server/meta-production-regression.test.ts`
- `META_FACEBOOK_CONNECTED_PLATFORM_PRODUCTION_READY.md`

Validation:

- Open Meta Overview with no Meta revenue source.
- Confirm the Total Revenue card appears and shows `Not connected`.
- Click the plus action and confirm the shared revenue wizard opens.
- Add a Meta revenue source through CSV, Google Sheets, HubSpot, Salesforce, or Shopify.
- Confirm Total Revenue updates in the Meta Overview.
- Confirm `Sources (1)` appears.
- Open `Sources`, confirm the source amount and provenance are shown.
- Edit the source and confirm Total Revenue refreshes.
- Delete the source and confirm Total Revenue returns to `Not connected`.
- Confirm Google Ads, GA4, and LinkedIn revenue behavior is unchanged.

Status:

- [x] Completed locally: Meta Overview now has the Google Ads-style Total Revenue card with plus/add action.
- [x] Completed locally: Meta Overview now opens the shared revenue wizard with `platformContext="meta"`.
- [x] Completed locally: Meta Overview now fetches `revenue-sources?platformContext=meta` and `revenue-totals?platformContext=meta&dateRange=90days`.
- [x] Completed locally: Meta Overview now has a Sources dialog with source provenance, edit, and delete actions.
- [x] Completed locally: shared wizard Meta cache refresh now invalidates/refetches Meta revenue source and 90-day total queries.
- [x] Local validation passed: `npm test -- server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/google-ads-revenue-overview-ui.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] User/browser validation passed.

### Meta Commit 8: Overview Loading Stability

Root cause analysis:

- On a hard refresh, the app-level lazy/auth fallback first showed a centered `Loading...` screen.
- After the Meta page bundle mounted but before `/api/meta/:campaignId/analytics` resolved, `client/src/pages/meta-analytics.tsx` rendered a different page-specific loading layout with `Navigation`, `Sidebar`, and `Loading Meta analytics...`.
- That second loading layout moved the loading indicator to a different part of the page, creating the visible jump.

Strategy:

- Change only the Meta analytics initial `isLoading` branch.
- Match the app/Google Ads centered `Loading...` fallback.
- Do not change loaded Meta page layout, data fetching, revenue behavior, routing, or other platform pages.

Files changed:

- `client/src/pages/meta-analytics.tsx`
- `server/meta-production-regression.test.ts`
- `META_FACEBOOK_CONNECTED_PLATFORM_PRODUCTION_READY.md`

Validation:

- Refresh the Meta Overview page.
- Confirm it shows one centered `Loading...` state.
- Confirm it does not switch to `Loading Meta analytics...`.
- Confirm the loaded Meta Overview page appears normally after data loads.

Status:

- [x] Completed locally: Meta initial loading now uses the centered app-style `Loading...` layout.
- [x] Completed locally: regression coverage asserts the Meta loading branch does not render `Navigation`, `Sidebar`, or `Loading Meta analytics`.
- [x] Local validation passed: `npm test -- server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] User/browser validation passed.

### Meta Commit 9: Scheduler Selected-Campaign Fail-Closed

Goal:

- Prevent scheduled and manual Meta refresh from broadening to all ad-account campaigns when selected Meta campaign IDs are missing.

Root cause analysis:

- `generateMockMetaData` filtered by `selectedCampaignIds` only when selected IDs were present; otherwise it generated all Meta mock campaigns.
- `fetchRealMetaData` filtered live campaigns only when selected IDs were present; otherwise it refreshed all campaigns returned by the ad account.
- Because the Create Campaign and Connected Platforms flows now require explicit selected campaign IDs, refresh without a saved selection is an invalid state and must fail closed.
- The smallest safe fix is to skip refresh when selected IDs are missing or invalid, without changing daily live API shape, KPI behavior, Benchmark behavior, report behavior, disconnect/reconnect behavior, or OAuth behavior in the same commit.

Tasks:

- Audit the selected-campaign boundary in `server/meta-scheduler.ts`.
- Normalize saved selected Meta campaign IDs.
- Skip refresh when selected IDs are missing or invalid.
- Ensure test-mode mock refresh does not fall back to all mock campaigns.
- Ensure live refresh does not fall back to all ad-account campaigns.

Validation:

- Trigger `/api/meta/:campaignId/refresh` for a test-mode Meta connection.
- Confirm new daily rows are written only for selected campaigns.
- Confirm Campaign Overview and Meta Overview update from the same rows.
- Confirm scheduler skips or fails closed when selected campaign IDs are missing.
- Confirm unrelated campaigns are unchanged.

Status:

- [x] Completed locally: `refreshMetaDataForCampaign` now skips refresh when the Meta connection has no selected campaign IDs.
- [x] Completed locally: test-mode mock generation now skips instead of generating all mock campaigns when selected IDs are missing.
- [x] Completed locally: live refresh now skips instead of refreshing all ad-account campaigns when selected IDs are missing.
- [x] Completed locally: selected IDs are normalized and invalid selected-ID JSON fails closed.
- [x] Completed locally: regression coverage added in `server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] User/browser validation passed.

### Meta Commit 10: Scheduler Live Daily Row And Upsert Hardening

Goal:

- Make live Meta scheduler refresh persist true daily source-backed rows and preserve row metadata correctly.

Root cause analysis:

- Live refresh currently calls aggregate `getCampaignInsights` for a 90-day range and stores one row at the range end date.
- `MetaGraphAPIClient.getCampaignDailyInsights` already existed and was the correct helper for true daily rows, but the scheduler previously did not use it in the reviewed path.
- `storage.upsertMetaDailyMetrics` updates numeric fields on conflict but does not update `metaCampaignName`, `ga4Revenue`, or `ga4UtmName`.
- These are related scheduler/data materialization issues, but they are separate from selected-campaign fail-closed safety and should be handled in their own small commit.

Tasks:

- Replace live aggregate daily-window storage with true `getCampaignDailyInsights` rows where the helper supports it.
- Preserve selected campaign scoping from Meta Commit 9.
- Persist `metaCampaignName` for live refresh rows.
- Update `storage.upsertMetaDailyMetrics` conflict behavior for safe metadata fields.
- Confirm spend record writes remain campaign-scoped and do not duplicate misleading spend rows.
- Preserve existing test-mode behavior.

Validation:

- Trigger `/api/meta/:campaignId/refresh` for a live or production-like Meta connection when available.
- Confirm rows are daily rows, not one aggregate 90-day row.
- Confirm selected campaign IDs still scope the refresh.
- Confirm campaign names are preserved after update.
- Confirm test-mode refresh behavior remains unchanged.

Status:

- [x] Completed locally: live Meta scheduler refresh now calls `getCampaignDailyInsights` for true daily rows.
- [x] Completed locally: live refresh rows now include `metaCampaignName`.
- [x] Completed locally: live refresh rows use each insight's `dateStart` or `dateStop` instead of storing one aggregate end-date row.
- [x] Completed locally: `storage.upsertMetaDailyMetrics` now updates `metaCampaignName` on conflict.
- [x] Completed locally: `storage.upsertMetaDailyMetrics` now preserves existing `ga4Revenue` and `ga4UtmName` when refreshed rows do not include GA4 attribution.
- [x] Completed locally: selected campaign scoping from Meta Commit 9 is preserved.
- [x] Completed locally: regression coverage added in `server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] User/browser validation passed.

### Meta Commit 11: Disconnect, Reconnect, And Stale Data Safety

Goal:

- Ensure Meta lifecycle changes do not leave visible stale or cross-campaign data.

Root cause analysis:

- Both Meta disconnect endpoints call `storage.deleteMetaConnection`.
- Meta reconnect paths also call `storage.deleteMetaConnection` before creating the new connection.
- Before this commit, `storage.deleteMetaConnection` deleted only the `meta_connections` row.
- Meta-owned rows written by the scheduler, specifically `meta_daily_metrics` and `spend_records` with `spendSourceId = "meta_daily_metrics"` or `sourceType = "meta_api"`, could remain after disconnect/reconnect.
- The smallest safe cleanup is limited to current-campaign Meta-owned metric materialization. User-created Meta revenue sources, KPIs, Benchmarks, and reports are not deleted in this commit.

Tasks:

- Trace both Meta delete endpoints.
- Decide the smallest safe cleanup behavior for current-campaign Meta rows and spend records.
- Preserve user-created revenue sources, KPIs, Benchmarks, reports, and notifications until their lifecycle paths are traced separately.
- Ensure reconnect uses the same cleanup path before creating the new connection.
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

- [x] Completed locally: `storage.deleteMetaConnection` now runs in a transaction.
- [x] Completed locally: Meta disconnect/reconnect now deletes current-campaign `meta_daily_metrics` rows.
- [x] Completed locally: Meta disconnect/reconnect now deletes current-campaign Meta scheduler spend rows from `spend_records`.
- [x] Completed locally: cleanup is limited to Meta-owned metric materialization and does not delete Meta revenue sources, KPIs, Benchmarks, or reports.
- [x] Completed locally: both Meta delete endpoints and test-mode reconnect use the same storage cleanup path.
- [x] Completed locally: regression coverage added in `server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] User/browser validation passed.

### Meta Commit 12: KPI And Benchmark Production Hardening

Goal:

- Make Meta KPI and Benchmark creation, edit, delete, and current values source-backed and campaign-scoped.

Root cause analysis:

- The Meta KPI tab called `/api/platforms/meta/kpis/:campaignId`, but the server returned wrapped `{ kpis }` data while the page checked for an array.
- The Meta KPI create/update routes accepted the generic UI payload (`metric`, `unit`, `description`, alert fields) but persisted through the older `meta_kpis` table, which requires `metricType` and `startDate` and does not preserve the same fields as the shared KPI pattern.
- The Meta Benchmark tab used the campaign benchmark route with `platform=meta`, which was intercepted by the older Meta-specific benchmark route instead of the shared platform benchmark route used by Google Ads.
- Meta revenue-dependent KPI/Benchmark current values still had conversion-value wording and did not consistently use the imported Meta attributed revenue values shown in the Overview Total Revenue section.
- Specific-campaign KPI/Benchmark current-value selection looked for flat campaign fields, but the Meta analytics page supplies nested `campaign` and `totals` objects.
- The smallest safe fix is to keep the existing Meta UI surface, move Meta KPI persistence to the shared platform KPI storage path, move Meta Benchmark requests to the shared platform Benchmark routes, and map revenue metrics to imported Meta attributed revenue without changing reports, scheduler, disconnect/reconnect, or OAuth behavior.

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

- [x] Completed locally: Meta KPI read/create/update/delete now use shared platform-scoped KPI storage with `platformType = "meta"` while preserving campaign access checks.
- [x] Completed locally: Meta Benchmark read/create/update/delete now use shared platform-scoped Benchmark routes from the Meta page.
- [x] Completed locally: Meta KPI and Benchmark cards, edit prefill, and current values resolve from the same source-backed Meta summary values as the Overview.
- [x] Completed locally: Total Revenue, ROAS, ROI, Profit, and Profit Margin KPI/Benchmark values use imported Meta attributed revenue when a Meta revenue source exists.
- [x] Completed locally: Meta KPI/Benchmark modals now label revenue-gated metrics as requiring a Meta revenue source, not a conversion value.
- [x] Completed locally: specific-campaign KPI/Benchmark selectors now resolve nested Meta campaign rows through `campaign.id` and `totals`.
- [x] Completed locally: regression coverage added in `server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] User/browser validation passed.

### Meta Commit 13: Report And Scheduled Report Safety

Goal:

- Make Meta reports production-safe instead of returning placeholder success.

Root cause analysis:

- The Meta Reports tab used the legacy `/api/meta/reports` routes, which persisted to the older `meta_reports` table instead of the shared platform-report path used by Google Ads and LinkedIn.
- The visible Meta Reports query expected an array, but the legacy Meta list route returned `{ reports }`, so saved report rows could fail to render as cards.
- Scheduled Meta report payloads kept UI-only fields such as `emailRecipients` and 12-hour `scheduleTime`; the shared scheduler expects `scheduleRecipients`, 24-hour `scheduleTime`, `scheduleTimeZone`, and numeric schedule day fields.
- The legacy direct send route returned `success: true` with `Report sent successfully` even though the route had no real send implementation.
- The legacy preview route returned placeholder preview text instead of source-backed output or a clear unavailable state.
- The smallest safe fix is to move the Meta report card lifecycle to `/api/platforms/meta/reports`, normalize scheduled payload fields to the existing shared scheduler contract, and make the legacy Meta send/preview routes fail closed. This does not change Meta scheduler refresh, disconnect/reconnect, revenue import, live OAuth, GA4 behavior, LinkedIn behavior, or Google Ads behavior.

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

- [x] Completed locally: Meta report list/create/update/delete now use `/api/platforms/meta/reports` and the shared platform report table.
- [x] Completed locally: scheduled Meta report payloads now persist `scheduleRecipients`, 24-hour `scheduleTime`, browser `scheduleTimeZone`, and numeric schedule day fields.
- [x] Completed locally: Meta report edit mode reads saved shared report schedule fields back into the modal.
- [x] Completed locally: legacy `/api/meta/reports/:reportId/send` returns unavailable instead of fake send success.
- [x] Completed locally: legacy `/api/meta/reports/:reportId/preview` returns unavailable instead of placeholder preview text.
- [x] Completed locally: regression coverage added in `server/meta-production-regression.test.ts` and `server/legacy-route-reachability-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/meta-production-regression.test.ts server/legacy-route-reachability-regression.test.ts server/report-email-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] User/browser validation passed.

### Meta Commit 14: Meta Attributed Revenue Import Parity

Goal:

- Make Meta imported revenue follow the same source-management pattern as GA4, LinkedIn, and Google Ads if Meta revenue is included in production scope.

Root cause analysis:

- The Meta Overview Total Revenue card and shared `AddRevenueWizardModal` already used `platformContext="meta"`, and CSV/Shopify already used the shared revenue-source path.
- The Salesforce and HubSpot save routes accepted `platformContext: "meta"` at validation time, but then normalized any non-LinkedIn and non-Google-Ads value back to `ga4`, so Meta CRM revenue imports could be saved as GA4 revenue sources.
- The Google Sheets revenue preview/process lookup did not map Meta to `meta_revenue`, so the first connection lookup used the GA4 revenue purpose before falling back.
- `server/auto-refresh-scheduler.ts` refreshed CRM revenue only for GA4 and Google Ads, so Meta HubSpot/Salesforce revenue sources would not be refreshed by the existing scheduler path.
- `AddRevenueWizardModal` invalidated the legacy Meta report cache key after Meta revenue imports even though Commit 13 moved Meta reports to `/api/platforms/meta/reports`.
- The legacy direct `POST /api/meta/:campaignId/revenue/csv` route called `processMetaRevenueCSV`, which returns totals but does not materialize shared `revenueSources` or `revenueRecords`. Current UI does not call that route; the visible CSV wizard uses `/api/campaigns/:campaignId/revenue/csv/process` with `platformContext=meta`.
- The smallest safe fix is to preserve Meta context in the existing shared provider paths and make the legacy direct Meta CSV route fail closed. This does not add a new revenue framework, change GA4/LinkedIn/Google Ads contracts, or alter Meta report scheduling, disconnect/reconnect, or live OAuth behavior.

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

- [x] Completed locally: Google Sheets revenue preview/process now maps Meta imports to `meta_revenue`.
- [x] Completed locally: HubSpot and Salesforce revenue save routes preserve `platformContext: "meta"` instead of collapsing Meta to GA4.
- [x] Completed locally: Meta CRM revenue sources are included in the existing auto-refresh CRM revenue context list.
- [x] Completed locally: Meta revenue import cache invalidation now targets the shared Meta report cache key.
- [x] Completed locally: legacy direct Meta CSV import now returns unavailable instead of placeholder success.
- [x] Completed locally: regression coverage added in `server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/meta-production-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/google-ads-revenue-hubspot-flow.test.ts server/google-ads-revenue-salesforce-flow.test.ts server/google-ads-revenue-sheets-flow.test.ts server/google-ads-revenue-shopify-flow.test.ts server/google-ads-revenue-csv-flow.test.ts server/google-ads-revenue-scheduler-flow.test.ts server/ga4-auto-refresh-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [ ] User/browser validation pending.

### Meta Commit 15: Final Production-Readiness Regression And Documentation

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

- Meta Commit 14 user/browser validation.
- Meta Commit 15 final production-readiness regression and documentation.

Outstanding evidence:

- Meta Commit 6 user/browser validation is pending.
- Meta Commit 14 user/browser validation is pending.
- Meta Commit 3 transition smoothness remains a future UX follow-up.
- Live OAuth evidence is not available locally.

## Current Handoff

The next smallest safest step after local Commit 14 validation is a user/browser pass for Meta attributed revenue imports. After that, proceed to Meta Commit 15: final production-readiness regression and documentation. Commit 15 should not introduce new feature behavior; it should prove the implemented local/test-mode paths and record any remaining live-OAuth caveats.
