# Google Ads Connected Platform Production-Ready Tracker

## Purpose

Track the work required to refine the Google Ads integration to production level for both supported user paths:

- Initial campaign creation through the `Create Campaign` flow.
- Adding Google Ads later from the campaign `Connected Platforms` section.

This tracker exists so Google Ads follows the same connected-source aggregate pattern used by GA4, LinkedIn, and Campaign DeepDive.

## Required Product Rule

`Connected Platforms` is the source of truth.

Google Ads must be treated as a campaign-scoped main paid-media connected source. Only the selected Google Ads customer account and selected Google Ads campaigns should feed the campaign. Campaign DeepDive, KPIs, Benchmarks, Custom Reports, scheduled reports, and platform analytics should consume Google Ads through source-backed Google Ads rows and the shared connected-source aggregate contract, not through placeholder values or generic campaign-level estimates.

## Current Status

Not production-ready yet.

Google Ads is partially scaffolded:

- OAuth and test-mode connection routes exist.
- Google Ads daily metric storage exists.
- A Google Ads analytics page exists.
- A Google Ads aggregate helper exists in `server/routes-oauth.ts`.
- Scheduler snapshot support already includes Google Ads source rows.

However, production readiness is blocked until the implementation removes placeholder metrics, enables both user connection paths safely, defines revenue semantics, proves disconnect/reconnect cleanup, and adds source-specific regression coverage.

## Root Cause Analysis

The current risk is not one isolated bug. It is a source-contract and lifecycle-hardening gap:

- The Create Campaign flow still treats Google Ads as `Coming Soon`, so users cannot connect Google Ads during initial campaign creation.
- The existing Connected Platforms flow can render `GoogleAdsConnectionFlow`, but it still needs the same production hardening now proven for LinkedIn.
- Some visible Google Ads campaign overview values are generated from generic campaign-level percentage splits instead of source-backed Google Ads rows.
- Google Ads revenue has two possible inputs, native Google Ads `conversionValue` and optional GA4-attributed `ga4Revenue`; the production rules need to be explicit so ROI/ROAS do not mix incompatible meanings.
- Scheduler and aggregate paths already include Google Ads, but they need source-specific validation for selected-campaign filtering, freshness, unavailable metrics, disconnect/reconnect safety, and report parity.
- Google Ads must not be marked production-ready just because the shared Campaign DeepDive architecture is ready for future sources.

## Existing Relevant Paths

- `client/src/components/GoogleAdsConnectionFlow.tsx`
  - Google Ads OAuth and test-mode connection UI.

- `client/src/pages/campaigns.tsx`
  - Create Campaign wizard and current Google Ads `Coming Soon` gate.

- `client/src/pages/campaign-detail.tsx`
  - Campaign Overview, Connected Platforms UI, and current placeholder Google Ads card values.

- `client/src/pages/google-ads-analytics.tsx`
  - Google Ads analytics tabs, KPIs, Benchmarks, Ad Comparison, Insights, and Reports.

- `server/routes-oauth.ts`
  - Google Ads OAuth routes, connection routes, selected-campaign routes, refresh routes, revenue enrichment, and Campaign DeepDive aggregate routes.

- `server/storage.ts`
  - Google Ads connection and daily metric persistence.

- `server/google-ads-scheduler.ts`
  - Google Ads refresh behavior for test-mode and live OAuth connections.

- `server/scheduler.ts`
  - Campaign DeepDive snapshot construction that already includes Google Ads source rows.

- `shared/schema.ts`
  - `googleAdsConnections` and `googleAdsDailyMetrics`.

## Production-Ready Target Contract

Google Ads is production-ready only when all of the following are true:

- The campaign has a persisted Google Ads source tied to the correct campaign.
- The source stores the selected Google Ads customer account and selected Google Ads campaigns.
- The source is scoped to the current client and campaign.
- Google Ads appears in `Connected Platforms` only after a valid connection/import state exists.
- Source-backed Google Ads daily rows are the only Google Ads values used in Campaign DeepDive and reports.
- Campaign DeepDive consumes Google Ads through the shared aggregate contract.
- Missing Google Ads metrics render as unavailable with a reason, not as invented zeroes or placeholder estimates.
- Spend, impressions, clicks, conversions, CTR, CPC, CPM, CPA, and related paid-media metrics come from Google Ads rows.
- Revenue, ROI, and ROAS use clear revenue semantics:
  - Google Ads `conversionValue` may represent Google Ads conversion value when configured in Google Ads.
  - `ga4Revenue` may be used only after explicit GA4 attribution enrichment.
  - If no valid revenue input exists, revenue-dependent metrics must be unavailable.
- Scheduler refresh updates the same source-backed values used by the UI.
- Disconnect/reconnect only affects the current campaign's Google Ads source and related Google Ads-scoped records.

## Source Capability Rules

Google Ads may provide:

- impressions
- clicks
- spend
- conversions
- conversion value
- video views
- search impression share
- CTR, CPC, CPM, CPA, ROAS, and ROI when required inputs are available
- GA4-attributed revenue only after explicit enrichment and mapping

Google Ads should not provide:

- GA4 users
- GA4 sessions
- GA4 pageviews
- GA4 conversion rate unless explicitly backed by web analytics inputs
- revenue borrowed from unrelated sources
- campaign-level placeholder totals from disconnected platforms

## Implementation Plan

### Commit 1: Documentation And Acceptance Contract

Goal:

- Establish the Google Ads production-ready checklist before code changes.

Tasks:

- Create this tracker.
- Link it from the Campaign DeepDive production-ready status documentation.
- Document validation evidence required for both Create Campaign and Connected Platforms flows.

Validation:

- Tracker clearly lists root cause, source contract, implementation commits, and open validation items.

Status:

- [x] Tracker created.
- [x] Linked from `CAMPAIGN_DEEPDIVE_PRODUCTION_READY_STATUS.md`.
- [x] Validation evidence required for both Create Campaign and Connected Platforms flows documented below.

### Commit 2: Enable Google Ads In Create Campaign Flow

Goal:

- Allow Google Ads to be connected during initial campaign creation.

Tasks:

- Remove Google Ads from the Create Campaign `Coming Soon` gate.
- Reuse `GoogleAdsConnectionFlow` instead of creating a new flow.
- Ensure failed or cancelled Google Ads setup does not leave a misleading connected source.
- Ensure campaign creation cannot finalize Google Ads as connected unless the connection contract is valid.

Validation:

- Create a new campaign.
- Select Google Ads in the Create Campaign flow.
- Connect with OAuth or test mode.
- Select Google Ads customer account and campaigns.
- Finalize campaign.
- Confirm Connected Platforms shows Google Ads for that campaign only.

Status:

- [ ] Pending.

### Commit 3: Connected Platforms Add-Source Hardening

Goal:

- Make adding Google Ads later from Connected Platforms use the same source contract as Create Campaign.

Tasks:

- Trace the existing `GoogleAdsConnectionFlow` usage in `client/src/pages/campaign-detail.tsx`.
- Ensure successful connection invalidates Connected Platforms, outcome totals, Executive Summary, Trend Analysis, KPI, Benchmark, and report queries.
- Ensure selected Google Ads campaigns are saved and used by refresh/aggregate paths.
- Ensure Google Ads does not show source-backed metrics until rows exist.

Validation:

- Open an existing campaign.
- Add Google Ads from Connected Platforms.
- Connect with OAuth or test mode.
- Select campaigns.
- Confirm Campaign DeepDive sees Google Ads only where the source supplies metrics.

Status:

- [ ] Pending.

### Commit 4: Remove Placeholder Google Ads Metrics

Goal:

- Stop showing invented Google Ads values in campaign overview cards.

Tasks:

- Remove Google Ads percentage-split calculations from `client/src/pages/campaign-detail.tsx`.
- Use source-backed Google Ads daily metrics or a shared aggregate-backed current source value.
- Show unavailable states when no Google Ads rows exist.
- Preserve unrelated Facebook/Meta behavior unless explicitly fixed separately.

Validation:

- Google Ads disconnected: no Google Ads metrics appear as connected-source values.
- Google Ads connected with no rows: metrics show unavailable or zero only where zero is a real source value.
- Google Ads test mode: card values match Google Ads daily rows.

Status:

- [ ] Pending.

### Commit 5: Define Google Ads Revenue Semantics

Goal:

- Prevent wrong ROI/ROAS by making revenue meaning explicit.

Tasks:

- Decide and document where `conversionValue` is displayed as Google Ads conversion value.
- Decide and document where `ga4Revenue` is displayed as GA4-attributed revenue.
- Ensure revenue, ROI, and ROAS are unavailable when neither source is valid.
- Avoid mixing Google Ads conversion value and GA4-attributed revenue in one unlabeled metric.

Validation:

- Google Ads with spend but no revenue value: ROI/ROAS unavailable.
- Google Ads with native conversion value: values are labeled as Google Ads conversion value.
- Google Ads with GA4 enrichment: values are labeled as GA4-attributed revenue.

Status:

- [ ] Pending.

### Commit 6: Campaign DeepDive Aggregate Parity

Goal:

- Prove Google Ads feeds Campaign DeepDive through the shared aggregate contract.

Tasks:

- Validate `/api/campaigns/:campaignId/outcome-totals` includes Google Ads once when connected.
- Validate `/api/campaigns/:campaignId/executive-summary` consumes the same Google Ads source composition.
- Validate Performance Summary, Budget & Financial Analysis, Platform Comparison, Trend Analysis, Executive Summary, and Custom Report use the same source-backed Google Ads values where applicable.

Validation:

- Google Ads-only campaign.
- GA4 + Google Ads campaign.
- Google Ads disconnected campaign.
- Google Ads connected with selected-campaign filtering.

Status:

- [ ] Pending.

### Commit 7: Disconnect And Reconnect Cleanup

Goal:

- Prevent stale Google Ads data after disconnect/reconnect.

Tasks:

- Trace `DELETE /api/google-ads/:campaignId/connection`.
- Confirm the route is campaign-access guarded.
- Ensure disconnect removes or excludes only current campaign Google Ads data.
- Ensure reconnect starts from the new selected customer/campaign contract.
- Add a safe cleanup or ignore rule for old Google Ads rows if needed.

Validation:

- Connect Google Ads.
- Confirm Google Ads values appear.
- Disconnect Google Ads.
- Confirm Google Ads disappears from Connected Platforms and Campaign DeepDive.
- Reconnect Google Ads.
- Confirm old rows do not appear unless they belong to the active selected source.

Status:

- [ ] Pending.

### Commit 8: Scheduler And Refresh Hardening

Goal:

- Make scheduled refresh update the same source-backed rows used by the UI.

Tasks:

- Verify `server/google-ads-scheduler.ts` uses selected campaign IDs.
- Verify daily metric writes are upserts, not duplicates.
- Verify scheduler skips or fails closed when connection state is invalid.
- Verify `server/scheduler.ts` snapshots include Google Ads only when the source is active.

Validation:

- Manual refresh updates Google Ads rows.
- Scheduler refresh updates the same rows.
- Selected-campaign filtering is preserved after refresh.
- Snapshot rows match current Google Ads source totals.

Status:

- [ ] Pending.

### Commit 9: Google Ads Analytics Page Parity

Goal:

- Make Google Ads analytics tabs production-safe.

Tasks:

- Audit Overview, KPIs, Benchmarks, Ad Comparison, Insights, and Reports.
- Ensure each tab uses Google Ads daily rows or validated aggregate values.
- Ensure revenue-dependent sections use the revenue semantics from Commit 5.
- Ensure no hidden mock/default values appear as production source values.

Validation:

- Test-mode data populates tabs consistently.
- No-data state is explicit.
- KPI and Benchmark current values match source-backed Google Ads metrics.
- Reports include latest Google Ads values.

Status:

- [ ] Pending.

### Commit 10: Regression Coverage And Final Docs

Goal:

- Prove Google Ads cannot regress into placeholder or stale-data behavior.

Tasks:

- Add regression tests for Create Campaign connection availability.
- Add regression tests for Connected Platforms add-source path.
- Add regression tests for selected-campaign filtering.
- Add regression tests for aggregate source inclusion/exclusion.
- Add regression tests for disconnect/reconnect stale-data safety.
- Add regression tests for revenue unavailable/value semantics.
- Update final production-readiness documentation.

Validation:

- Local regression suite passes.
- User validates test-mode flow.
- Deployed OAuth or production-like evidence is recorded before marking live OAuth production-ready.

Status:

- [ ] Pending.

## Validation Evidence Required

Before Google Ads is marked production-ready, record evidence for:

- Create Campaign -> Google Ads -> OAuth or test-mode connect -> select campaigns -> finalize campaign.
- Existing campaign -> Connected Platforms -> Add Google Ads -> OAuth or test-mode connect -> select campaigns.
- Google Ads-only Campaign DeepDive values.
- GA4 + Google Ads blended Campaign DeepDive values.
- Google Ads disconnected state.
- Google Ads disconnect/reconnect stale-data safety.
- Selected-campaign filtering.
- Google Ads scheduler refresh.
- Custom Report PDF values.
- Revenue, ROI, and ROAS behavior with and without valid revenue inputs.

## Relevant Documentation

- `AGENTS.md`
- `ARCHITECTURE_USER_JOURNEY.md`
- `GA4/README.md`
- `GA4/FINANCIAL_SOURCES.md`
- `GA4_DEVELOPMENT_WORKFLOW.md`
- `CAMPAIGN_DEEPDIVE_PRODUCTION_READY_STATUS.md`
- `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md`

## Latest Validation

No Google Ads production-ready validation has been recorded yet.

