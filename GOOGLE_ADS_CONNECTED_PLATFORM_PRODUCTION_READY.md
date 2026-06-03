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

Commit 10 user validation passed.

Google Ads is locally production-ready for the implemented source-backed test-mode path after Commit 10 regression coverage. Live OAuth should still be validated in a deployed or production-like environment before calling the live OAuth path production-ready.

Implemented foundations:

- OAuth and test-mode connection routes exist.
- Google Ads daily metric storage exists.
- Google Ads is available in both Create Campaign and Connected Platforms.
- Google Ads analytics tabs use source-backed daily rows or validated aggregate values.
- A Google Ads aggregate helper exists in `server/routes-oauth.ts`.
- Scheduler snapshot support includes selected Google Ads source rows.
- Google Ads Reports use the platform-report path and scheduled reports are discoverable by `server/report-scheduler.ts`.

## Root Cause Analysis

The original risk was not one isolated bug. It was a source-contract and lifecycle-hardening gap:

- Create Campaign originally treated Google Ads as `Coming Soon`, so users could not connect Google Ads during initial campaign creation. This was fixed in Commit 2.
- Connected Platforms could render `GoogleAdsConnectionFlow`, but it needed source-contract hardening and cache invalidation parity. This was fixed through Commits 3 and 10.
- Some visible Google Ads campaign overview values were generated from generic campaign-level percentage splits instead of source-backed Google Ads rows. This was fixed in Commit 4.
- Google Ads revenue has two possible inputs, native Google Ads `conversionValue` and optional GA4-attributed `ga4Revenue`; the production rules had to be explicit so ROI/ROAS do not mix incompatible meanings. This was fixed in Commit 5.
- Scheduler and aggregate paths needed source-specific validation for selected-campaign filtering, freshness, unavailable metrics, disconnect/reconnect safety, and report parity. This was covered through Commits 6, 7, 8, 9, and 10.
- Google Ads must not be marked production-ready just because the shared Campaign DeepDive architecture is ready for future sources; it needs its own source-level proof, tracked here.

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
- [x] User validation passed for Commit 1.

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

- [x] Completed locally: Google Ads removed from the Create Campaign `Coming Soon` gate.
- [x] Completed locally: Create Campaign step 3 now reuses `GoogleAdsConnectionFlow`.
- [x] Completed locally: Google Ads is added to the draft campaign's connected platform list only after `GoogleAdsConnectionFlow` reports connection success.
- [x] Completed locally: Google Ads campaign selection now defaults to no selected campaigns and removes the unsafe import-all skip action.
- [x] User validation passed for Commit 2.

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

- [x] Completed locally: traced existing Google Ads add-source rendering in `client/src/pages/campaign-detail.tsx`.
- [x] Completed locally: successful Google Ads add-source now invalidates Connected Platforms, Google Ads connection/metrics, outcome totals, Executive Summary, Trend Analysis, KPI, Benchmark, and Google Ads report queries.
- [x] Completed locally: selected Google Ads campaigns remain persisted by `GoogleAdsConnectionFlow` through `/api/google-ads/:campaignId/selected-campaigns`.
- [x] User validation passed for Commit 3.

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

- [x] Completed locally: removed placeholder Google Ads percentage-split calculations and hard-coded CTR/CPC from `client/src/pages/campaign-detail.tsx`.
- [x] Completed locally: Google Ads campaign overview metrics now read from `/api/campaigns/:campaignId/outcome-totals?dateRange=30days` via `performanceSummary.sources[].id === "google_ads"`.
- [x] Completed locally: when Google Ads is connected but no source-backed aggregate rows exist, the row uses zero values instead of invented campaign-level estimates.
- [x] User validation passed for Commit 4.

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

- [x] Completed locally: Google Ads analytics labels now distinguish native Google Ads conversion value from verified business revenue.
- [x] Completed locally: shared aggregate and scheduler Google Ads source rows expose `conversionValue`, `ga4AttributedRevenue`, `attributedRevenue`, and preserved `revenueSemantics.attributedRevenueSource` without changing existing response fields.
- [x] Completed locally: `attributedRevenue` now uses one source consistently: GA4-attributed revenue when present, otherwise native Google Ads conversion value, otherwise zero/unavailable.
- [x] User validation passed for Commit 5.

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

- [x] Completed locally: `/api/campaigns/:campaignId/outcome-totals` builds Google Ads through `buildGoogleAdsPlatformSourceForAggregate(...)` and passes it into the shared `performanceSummary` aggregate via `mainPlatformSources: { googleAds }`.
- [x] Completed locally: `/api/campaigns/:campaignId/executive-summary` uses the same Google Ads source helper and shared `performanceSummary` aggregate composition.
- [x] Completed locally: added regression coverage proving Google Ads aggregates as one source-backed paid-media platform with impressions, clicks, spend, conversions, attributed revenue, ROAS, ROI, CTR, and CVR derived from the shared aggregate contract.
- [x] User validation passed for Commit 6.

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

- [x] Completed locally: traced `DELETE /api/google-ads/:campaignId/connection`; it remains campaign-access guarded and fails closed when no Google Ads connection row is deleted.
- [x] Completed locally: deleting a Google Ads connection now also removes only that campaign's Google Ads daily metric rows.
- [x] Completed locally: reconnect paths clear campaign-scoped Google Ads daily metric rows before creating the new source connection, so old rows cannot seed the new source contract.
- [x] Completed locally: Google Ads daily metrics route now returns an empty metrics list when no active Google Ads connection exists.
- [x] Completed locally: Google Ads daily metrics route now applies the active connection's selected-campaign filter, matching the Performance Summary aggregate after disconnect/reconnect.
- [x] Completed locally: added regression coverage for disconnect cleanup, reconnect cleanup, and stale-row exclusion in the daily metrics route.
- [x] User validation passed for Commit 7.

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

- [x] Completed locally: traced `server/google-ads-scheduler.ts`; test-mode and live refresh both preserve selected Google Ads campaign filtering.
- [x] Completed locally: confirmed Google Ads daily metric writes use upsert conflict handling on `campaign_id`, `google_campaign_id`, and `date`.
- [x] Completed locally: Google Ads scheduler now skips spend-only helper connections and missing campaign rows before any mock or live refresh can write daily metrics.
- [x] Completed locally: traced `server/scheduler.ts`; snapshots filter Google Ads daily rows by selected campaign IDs and mark Google Ads connected only when the active source is not spend-only.
- [x] Completed locally: added regression coverage for scheduler fail-closed behavior before Google Ads refresh writes.
- [x] User validation passed for Commit 8.

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

- [x] Completed locally: audited Overview, KPI, Benchmark, Ad Comparison, Insights, and Reports entry points in `client/src/pages/google-ads-analytics.tsx`.
- [x] Completed locally: removed the Overview header actions `Match GA4 Revenue` and `Refresh Data`; Google Ads Overview now relies on source-backed daily metrics and scheduled/manual source refresh paths instead of ad-hoc tab buttons.
- [x] Completed locally: Google Ads report cards and edit mode now normalize missing or legacy report types to valid Google Ads report types instead of falling back to Campaign DeepDive `performance_summary`.
- [x] Completed locally: Google Ads Reports now save, list, update, and delete through `/api/platforms/google_ads/reports`, matching the GA4 platform-report pattern instead of the legacy Meta report route.
- [x] Completed locally: scheduled Google Ads report payloads now persist `scheduleRecipients`, 24-hour `scheduleTime`, and browser `scheduleTimeZone`, so clicking `Schedule Report` creates a real report card and backend scheduled-report record.
- [x] Completed locally: in the Google Ads Reports tab, enabling scheduling changes the modal action to `Schedule Report`; submitting it saves the report through `/api/platforms/google_ads/reports` with recipients, time, and time zone for scheduler processing.
- [x] Completed locally: the report scheduler now discovers `google_ads` platform reports alongside LinkedIn and GA4 reports.
- [x] Completed locally: added regression coverage preventing Google Ads Reports from reintroducing Campaign DeepDive report-type fallbacks.
- [x] Completed locally: added regression coverage preventing Google Ads Reports from falling back to legacy Meta report storage and preventing scheduled Google Ads reports from being omitted by scheduler discovery.
- [x] User validation passed for Commit 9.

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

- [x] Completed locally: added regression coverage for Create Campaign and Connected Platforms Google Ads entry points.
- [x] Completed locally: fixed the Connected Platforms success invalidation to refresh `/api/platforms/google_ads/reports` instead of the old Meta report query.
- [x] Completed locally: added regression coverage for selected-campaign filtering across UI, API, aggregate, scheduler, and snapshot paths.
- [x] Completed locally: added regression coverage for disconnect/reconnect stale-data safety.
- [x] Completed locally: added regression coverage for Google Ads revenue semantics.
- [x] Completed locally: updated final production-readiness documentation.
- [x] User validation passed for Commit 10.

## Optional Google Ads Attributed Revenue Import Plan

### Scope

This section tracks the optional Google Ads attributed revenue import implementation. Commits 12, 13, 14, 15, and 16 are now implemented locally for storage/read-side isolation, backend aggregate revenue semantics, shared revenue wizard context plumbing, CSV revenue import, and Google Sheets revenue import; the visible `Total Revenue` card, CRM/ecommerce source imports, downstream KPI/Benchmark/report consumers, scheduler downstream semantics, and runtime seeded-data API validation remain pending.

Goal:

- Add a Google Ads Analytics `Total Revenue` card that follows the GA4 and LinkedIn source-management pattern.
- Reuse the existing GA4/LinkedIn revenue import wizard pattern for HubSpot, Salesforce, Shopify, Google Sheets, and CSV upload.
- Treat imported Google Ads revenue as explicit Google Ads-attributed revenue, not generic campaign revenue and not native Google Ads conversion value.
- Preserve the existing source/import/storage architecture and avoid creating a new reporting or revenue framework.

### Production-Ready Checklist

Use this checklist as the source of truth for what is complete. A checked item is complete for the scope written on that line. Unchecked items are the next implementation work.

- [x] Commit 11: Revenue import documentation and acceptance contract.
  Validation: user validation passed.
- [x] Commit 12: Revenue platform context and storage/read-side isolation.
  Validation: local regression passed; user validation passed for the implemented read-side scope.
- [x] Commit 13: Google Ads backend revenue semantics read model.
  Validation: local regression and type check passed; user validated the no-imported-revenue backend response.
- [x] Commit 14: Shared revenue wizard support for Google Ads context.
  Validation: local regression and type check passed; user validation passed for the implemented wizard-context scope.
- [x] Commit 15: CSV Google Ads attributed revenue import context.
  Validation: local regression and type check passed.
- [x] Commit 16: Google Sheets Google Ads attributed revenue flow.
  Validation: local regression and type check passed.
- [x] Commit 17: HubSpot Google Ads attributed revenue flow.
  Validation: local regression and type check passed.
- [x] Commit 18: Salesforce Google Ads attributed revenue flow.
  Validation: local regression and type check passed.
- [ ] Commit 19: Shopify Google Ads attributed revenue flow.
- [ ] Commit 20: Google Ads Overview `Total Revenue` card, `+` action, and `Sources` modal.
- [ ] Commit 21: KPI, Benchmark, Insights, and report semantics.
- [ ] Commit 22: Scheduler, refresh, snapshot, disconnect/reconnect, and selected-campaign safety.
- [ ] Commit 23: Final regression coverage and production-ready evidence.

Deferred validation is not a failed validation. For example, CSV add/edit/delete browser validation belongs to Commit 20 because the visible Google Ads `Total Revenue` entry point does not exist yet.

### Root Cause Analysis

Current Google Ads revenue behavior is source-backed for Google Ads daily rows, but it is not yet source-backed for optional imported business revenue.

Confirmed current gaps:

- `client/src/pages/google-ads-analytics.tsx` calculates Google Ads Overview `summary.roas` and `summary.roi` from native Google Ads `conversionValue / spend`; it has no Google Ads-scoped `Total Revenue` source card, `+` action, `Sources` link, or source-provenance modal.
- Before Commit 13, `buildGoogleAdsPlatformSourceForAggregate(...)` in `server/routes-oauth.ts` set `attributedRevenue` from GA4-attributed revenue when present, otherwise native Google Ads `conversionValue`; Commit 13 replaces that backend aggregate behavior with imported Google Ads-scoped attributed revenue only.
- Before Commit 14, the shared revenue-source frontend context plumbing allowed `ga4`, `linkedin`, and `meta`, not `google_ads`; Commit 14 extends the shared modal/provider wizard prop path and Google Sheets purpose plumbing while leaving backend write/import validation deferred to the source-family commits.
- Before Commit 15, the shared CSV revenue wizard submitted `platformContext="google_ads"`, but `/api/campaigns/:id/revenue/csv/process` still used the general write parser that accepts only `ga4`, `linkedin`, and `meta`; Commit 15 adds a CSV-only parser that accepts `google_ads` without opening the other source-family write paths.
- Before Commit 16, the shared Google Sheets revenue wizard could carry `platformContext="google_ads"` and purpose `google_ads_revenue`, but `/api/campaigns/:id/revenue/sheets/preview` and `/api/campaigns/:id/revenue/sheets/process` still used the general write validator and mapped Google Ads to the GA4 `revenue` Sheets purpose; Commit 16 adds a Sheets-only validator/purpose mapping and fail-closed source-ID handling.
- Before Commit 17, the shared HubSpot revenue wizard could carry `platformContext="google_ads"`, but `/api/campaigns/:id/hubspot/save-mappings` still used the general write validator and collapsed every non-LinkedIn context to GA4; Commit 17 adds a HubSpot-only validator/context mapping and keeps HubSpot Pipeline Proxy Google Ads lookup explicit-only.
- Before Commit 18, the shared Salesforce revenue wizard could carry `platformContext="google_ads"`, but `/api/campaigns/:id/salesforce/save-mappings` still used the general write validator and collapsed every non-LinkedIn context to GA4; Commit 18 adds a Salesforce-only validator/context mapping and keeps Salesforce Pipeline Proxy Google Ads lookup explicit-only.
- Before Commit 12, `server/storage.ts` supported `getRevenueSources(..., platformContext)` and `getRevenueBreakdownBySource(..., platformContext)` mostly generically, but `getRevenueTotalForRange(...)` hard-coded the non-GA4 branch to `linkedin`; Commit 12 fixes this storage/read-side gap.
- `server/auto-refresh-scheduler.ts` reprocesses Shopify and Google Sheets across `ga4`, `linkedin`, and `meta`, while the source loop for HubSpot and Salesforce currently reprocesses only `ga4`; Commits 17 and 18 confirm the HubSpot/Salesforce reprocess payloads can carry `platformContext` and stable `sourceId`, but scheduler context selection remains deferred to Commit 22.
- `shared/schema.ts` has `revenue_sources.platform_context` as free text, so a table migration is not expected just to store `google_ads`; however TypeScript unions, zod validation, route filters, UI props, and scheduler context lists must be updated consistently.
- Existing `revenue_records.subCampaignUrn` is LinkedIn-named. It may be reusable for provider campaign IDs, but using it for Google Ads campaign IDs is unverified. The first implementation should support campaign-level Google Ads attributed revenue before attempting Google Ads campaign-row revenue attribution.

Exact root cause:

- The reusable GA4/LinkedIn revenue import system is present. Commit 12 admits Google Ads on the storage/read side, Commit 13 makes the shared backend aggregate read model use only Google Ads-scoped imported revenue for Google Ads business `attributedRevenue`, Commit 14 adds shared wizard context plumbing, Commit 15 admits Google Ads only on the CSV import write path, Commit 16 admits Google Ads only on the Google Sheets revenue import path, Commit 17 admits Google Ads only on the HubSpot import write path, and Commit 18 admits Google Ads only on the Salesforce import write path. The remaining root cause is that the Shopify write/import flow, visible financial UI, scheduler downstream semantics, KPIs, Benchmarks, and reports still have not been made Google Ads-attributed-revenue aware.

### Required GA4/LinkedIn Pattern For Google Ads

The Google Ads implementation should copy the GA4/LinkedIn source pattern, changing only the platform context and Google Ads-specific labels/semantics:

- `Total Revenue` is a source-management card, not a manual value editor.
- The `+` action opens the existing shared revenue wizard with `platformContext="google_ads"`.
- The source picker supports the same relevant options:
  - `Shopify`
  - `HubSpot`
  - `Salesforce`
  - `Google Sheets`
  - `Upload CSV`
- New direct `Manual` revenue creation should not be exposed.
- Existing stored manual revenue rows, if any are later found with `platformContext="google_ads"`, should be treated as legacy continuity data and not silently deleted.
- Each source saves a source definition in `revenue_sources` with `platformContext="google_ads"` and materializes normalized rows in `revenue_records`.
- Multiple active Google Ads revenue sources are additive.
- The `Sources (n)` link counts and lists only active `platformContext="google_ads"` revenue sources.
- Source edit/delete actions operate on source definitions and their materialized records, not directly on the card value.
- Add/edit/delete must preserve campaign access and source ownership checks.
- Stable `sourceId` must survive edit and scheduler refresh so refresh updates the existing source instead of creating duplicates.
- Google Ads imported revenue must remain scoped to the current MimoSaaS campaign and the selected Google Ads source context. It must not broaden to unrelated Google Ads account/campaign data.
- HubSpot/Salesforce Pipeline Proxy, if carried through the shared CRM wizard, remains a separate early-signal card/value and must not be added to `Total Revenue`, `ROAS`, `ROI`, or `Profit`.

### Required Revenue Semantics

- Without imported Google Ads-attributed revenue:
  - show native Google Ads `Conversion Value` separately
  - do not label native conversion value as `Total Revenue`
  - business `Total Revenue`, `ROAS`, `ROI`, and `Profit` should be unavailable/not connected
  - any conversion-value efficiency display must be labeled as conversion-value efficiency, not business revenue
- With imported Google Ads-attributed revenue:
  - `Total Revenue`, `ROAS`, `ROI`, and `Profit` use imported Google Ads-attributed revenue
  - native Google Ads `Conversion Value` remains visible separately
  - imported attributed revenue and native conversion value must not be added together

### Likely Files And Endpoints

Frontend:

- `client/src/pages/google-ads-analytics.tsx`
  - Add `Total Revenue` card, `+` action, `Sources (n)` link, source dialog, and imported-revenue-aware ROAS/ROI/Profit display.
  - Keep native `Conversion Value` card/copy separate.
- `client/src/components/AddRevenueWizardModal.tsx`
  - Add `platformContext="google_ads"` support, Google Ads-specific title/copy, invalidation/refetch keys, and `google_ads_revenue` Google Sheets purpose.
- `client/src/components/HubSpotRevenueWizard.tsx`
- `client/src/components/SalesforceRevenueWizard.tsx`
- `client/src/components/ShopifyRevenueWizard.tsx`
  - Extend platform-context types and preserve GA4/LinkedIn behavior.

Backend/API:

- `server/routes-oauth.ts`
  - Keep the completed read-side Google Ads revenue parser separate from write/import validation until provider-specific Google Ads source commits are implemented.
  - Extend write/import validation to include `google_ads` only after each source family no longer falls back to GA4 semantics.
  - Existing shared endpoints likely involved:
    - `GET /api/campaigns/:id/revenue-sources?platformContext=google_ads`
    - `DELETE /api/campaigns/:id/revenue-sources/:sourceId`
    - `DELETE /api/campaigns/:id/revenue-sources?platformContext=google_ads`
    - `GET /api/campaigns/:id/revenue-totals?platformContext=google_ads`
    - CSV preview/process endpoints using `platformContext`
    - Google Sheets revenue preview/process endpoints using `platformContext`
    - HubSpot/Salesforce/Shopify save-mapping endpoints using `platformContext`
  - Add a Google Ads revenue context helper or localized equivalent for aggregate/KPI/Benchmark/report consumers.
  - Update `buildGoogleAdsPlatformSourceForAggregate(...)` so imported Google Ads attributed revenue is preferred for business `attributedRevenue`, while native `conversionValue` remains separate.
- `server/storage.ts`
  - Extend revenue-source platform-context types to `ga4 | linkedin | meta | google_ads`.
  - Fix `getRevenueTotalForRange(...)` so non-GA4 contexts filter by the requested context, not only `linkedin`.
- `server/auto-refresh-scheduler.ts`
  - Include `google_ads` in refreshable revenue source context loops.
  - Confirm HubSpot/Salesforce reprocess no longer skips non-GA4 contexts when Google Ads CRM sources are enabled.
- `server/scheduler.ts`
  - Update scheduled snapshot Google Ads revenue semantics to use imported Google Ads revenue when available and keep `conversionValue` separate.
- `server/google-ads-scheduler.ts`
  - Preserve selected-campaign daily metric refresh behavior. Do not write imported business revenue into native Google Ads `conversionValue`.
- `shared/schema.ts`
  - Update TypeScript/zod contracts if needed; no table change is expected unless a provider-campaign ID column beyond `subCampaignUrn` is required.

Unverified:

- Per-Google-Ads-campaign revenue breakdown support is unverified. The first implementation should support campaign-level Google Ads attributed revenue before adding Google Ads campaign-row revenue attribution.
- Existing production data cleanup is unverified. Do not deactivate, delete, or rewrite any Google Ads-scoped revenue records unless a separate inspector proves the damaged-record boundary.
- Live OAuth remains unverified in a deployed/production-like environment and is separate from this optional revenue-import plan.

### Safe Reuse From GA4 And LinkedIn

Safe to reuse:

- `AddRevenueWizardModal` as the shared source chooser and flow host.
- Existing source types: HubSpot, Salesforce, Shopify, Google Sheets, Upload CSV.
- Existing `revenue_sources` and `revenue_records` persistence model.
- Existing guarded revenue source delete route after confirming it remains campaign-scoped for `google_ads`.
- Existing source list/provenance modal pattern from LinkedIn `Total Revenue`.
- Existing provider-specific save/materialization routes, if extended only by `platformContext="google_ads"` and validated end to end.
- Existing Campaign DeepDive aggregate contract, with Google Ads still represented as one main paid-media source.

Must be Google Ads-specific:

- UI labels and copy: `Google Ads attributed revenue`, not generic revenue and not native conversion value.
- Revenue semantics in Google Ads Overview, Insights, KPIs, Benchmarks, reports, aggregate, and scheduler snapshots.
- Selected Google Ads campaign scoping.
- Source invalidation keys for Google Ads analytics, Google Ads KPIs, Google Ads Benchmarks, Google Ads reports, Campaign DeepDive, Executive Summary, Trend Analysis, and Connected Platforms.
- Disconnect/reconnect and selected-campaign replacement handling for Google Ads-scoped child revenue sources.

### Follow-On Implementation Commits

These commits are the proposed implementation track after completed Google Ads Commit 10. They are not implemented yet unless their status is later marked complete.

#### Commit 11: Revenue Import Documentation And Acceptance Contract

Goal:

- Record the Google Ads attributed revenue import root cause, implementation strategy, source semantics, and validation plan before code changes.

Tasks:

- Update this tracker with the corrected GA4/LinkedIn-template implementation sequence.
- Mark optional Google Ads revenue import as not yet implemented.
- Keep Commit 10 source-backed test-mode readiness separate from live OAuth and optional imported revenue readiness.

Validation:

- Confirm this tracker clearly separates native Google Ads conversion value from imported Google Ads attributed revenue.
- Confirm no code behavior changed.

Status:

- [x] Completed locally: this tracker now records the Google Ads attributed revenue import strategy and corrected commit sequence.
- [x] User validation passed.

#### Commit 12: Revenue Platform Context And Storage Isolation

Goal:

- Let the existing source system safely store and read Google Ads-scoped revenue sources without leaking GA4, LinkedIn, or Meta revenue.

Tasks:

- Extend storage platform-context typing and read-side backend validation to include `google_ads`.
- Do not globally enable write/import validators yet; HubSpot and Salesforce save routes currently collapse non-LinkedIn contexts to GA4 and must be made Google Ads-specific in their later provider commits.
- Update `server/storage.ts` revenue methods so `getRevenueSources`, `getRevenueTotalForRange`, and `getRevenueBreakdownBySource` all filter by `google_ads` correctly.
- Confirm `/api/campaigns/:id/revenue-sources?platformContext=google_ads` and `/api/campaigns/:id/revenue-totals?platformContext=google_ads` are campaign-access guarded through the existing route pattern.
- Include Google Ads-scoped revenue sources in `/api/campaigns/:id/all-data-sources` without changing GA4, LinkedIn, or Meta behavior.
- Preserve Google Ads delete cleanup isolation by using `google_ads_revenue` instead of falling back to GA4 `revenue` Google Sheets purpose.
- Add focused regression coverage proving GA4, LinkedIn, Meta, and Google Ads revenue sources remain isolated.

Validation:

- `GET /api/campaigns/:id/revenue-sources?platformContext=google_ads` returns only Google Ads-scoped sources.
- `GET /api/campaigns/:id/revenue-totals?platformContext=google_ads` sums only Google Ads-scoped records.
- GA4, LinkedIn, and Meta revenue totals remain unchanged with the same seeded data.

Status:

- [x] Completed locally: `server/storage.ts` now supports `google_ads` as a revenue platform context and `getRevenueTotalForRange` filters non-GA4 totals by the requested context instead of hard-coding LinkedIn.
- [x] Completed locally: revenue read endpoints now accept `platformContext=google_ads` through a read-only parser; mutating import/write validators remain deferred to the later Google Ads-specific source commits.
- [x] Completed locally: `/api/campaigns/:id/all-data-sources` includes Google Ads revenue sources when they exist, and last-source cleanup maps Google Ads sheets cleanup to `google_ads_revenue`.
- [x] Completed locally: focused regression coverage added in `server/google-ads-revenue-platform-context.test.ts`.
- [x] Local validation passed: `npm test -- server/google-ads-revenue-platform-context.test.ts`.
- [x] User validation passed for the implemented storage/read-side isolation scope.
- [ ] Future/deferred validation: seeded Google Ads revenue rows in a runtime API flow after source write paths are enabled.

#### Commit 13: Google Ads Revenue Semantics Read Model

Goal:

- Add the backend read semantics before exposing a visible `Total Revenue` action.

Tasks:

- Add a Google Ads revenue context helper or localized equivalent using `getRevenueTotalForRange(..., "google_ads")`.
- Update `buildGoogleAdsPlatformSourceForAggregate(...)` so:
  - `conversionValue` remains native Google Ads conversion value.
  - `importedAttributedRevenue` or equivalent records the Google Ads-scoped imported revenue total.
  - business `attributedRevenue` uses imported Google Ads revenue when present.
  - native conversion value is not mixed into imported revenue.
- Preserve response compatibility where existing consumers expect Google Ads `conversionValue`, `ga4AttributedRevenue`, or `revenueSemantics`.

Validation:

- Google Ads with spend and no imported revenue keeps business revenue unavailable while preserving native conversion value separately.
- Google Ads with imported attributed revenue uses imported revenue for business revenue semantics.
- Imported revenue plus native conversion value are not added together.
- Campaign DeepDive aggregate includes Google Ads once.

Status:

- [x] Completed locally: `buildGoogleAdsPlatformSourceForAggregate(...)` now reads `getRevenueTotalForRange(..., "google_ads")` for imported Google Ads-attributed revenue.
- [x] Completed locally: native Google Ads `conversionValue` and GA4-matched revenue remain separate diagnostic fields and no longer populate business `attributedRevenue`.
- [x] Completed locally: Google Ads aggregate `includedMetrics` includes `attributedRevenue` only when imported Google Ads-scoped revenue exists; otherwise the source exposes an explicit unavailable reason.
- [x] Completed locally: focused regression coverage updated for Google Ads backend revenue semantics and aggregate availability behavior.
- [x] Local validation passed: `npm test -- server/google-ads-production-regression.test.ts server/performance-summary-aggregate.test.ts server/google-ads-revenue-platform-context.test.ts server/campaign-financial-analysis-regression.test.ts server/executive-summary-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] User validation passed: `/api/campaigns/:id/outcome-totals?dateRange=30days` showed Google Ads connected with `attributedRevenue: 0`, `importedAttributedRevenue: 0`, and `revenueSemantics.attributedRevenueSource: "unavailable"` when no Google Ads-scoped imported revenue source exists.
- [ ] Future/deferred validation: seeded Google Ads revenue rows in a runtime API flow after source write paths are enabled.
- [ ] Future/deferred work: Scheduler/report/KPI/Benchmark semantic updates are covered in later commits.

#### Commit 14: Shared Revenue Wizard Support For Google Ads Context

Goal:

- Make the existing GA4/LinkedIn revenue wizard capable of opening in Google Ads context without changing visible Google Ads Overview behavior yet.

Tasks:

- Extend `AddRevenueWizardModal` and provider wizard platform-context types to include `google_ads`.
- Add Google Ads-specific wizard title/copy where the shared modal already supports contextual copy.
- Add Google Ads-specific cache invalidation/refetch keys.
- Add `google_ads_revenue` as the Google Sheets revenue purpose.
- Preserve GA4, LinkedIn, and Meta modal behavior.

Validation:

- Type check passes.
- GA4 revenue wizard copy and behavior remain unchanged.
- LinkedIn revenue wizard copy, source chooser, and Back behavior remain unchanged.
- Google Ads context can be passed through the modal and provider wizards without type or validation failure.

Status:

- [x] Completed locally: `AddRevenueWizardModal` now accepts `platformContext="google_ads"` and uses Google Ads-specific select-step title/copy.
- [x] Completed locally: HubSpot, Salesforce, and Shopify revenue wizard prop types now accept `google_ads` so the shared modal can pass context through without TypeScript failure.
- [x] Completed locally: Google Ads-specific revenue cache invalidation/refetch keys were added to the shared revenue change path.
- [x] Completed locally: Google Sheets revenue setup can carry `google_ads_revenue` purpose through the frontend helper and existing backend Google Sheets purpose allowlists.
- [x] Completed locally: focused regression coverage added in `server/google-ads-revenue-wizard-context.test.ts`.
- [x] Local validation passed: `npm test -- server/google-ads-revenue-wizard-context.test.ts server/google-ads-revenue-platform-context.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] User validation passed for the implemented Commit 14 scope.
- [ ] Future/deferred validation: runtime UI validation when the Google Ads `Total Revenue` entry point is added in Commit 20.
- [ ] Future/deferred work: remaining source-family write/import validation is covered in Commits 16-19.

#### Commit 15: CSV Google Ads Attributed Revenue Flow

Goal:

- Prove the simplest manual import source family end to end before adding broader provider complexity.

Tasks:

- Extend/validate CSV revenue preview and process paths with `platformContext="google_ads"`.
- Ensure CSV creates or updates a Google Ads-scoped revenue source by stable `sourceId`.
- Ensure CSV materializes only Google Ads-scoped revenue records for the current campaign.
- Preserve the GA4/LinkedIn CSV flow and no-manual-source rule.

Validation:

- Add a CSV Google Ads revenue source.
- Edit the same CSV source and confirm the same source ID updates.
- Delete the CSV source and confirm only that source's records are removed/deactivated.
- Confirm GA4 and LinkedIn revenue totals do not change.

Status:

- [x] Completed locally: `/api/campaigns/:id/revenue/csv/process` now uses a CSV-only platform-context parser that accepts `google_ads`.
- [x] Completed locally: the general `zPlatformContext` write validator remains limited to `ga4`, `linkedin`, and `meta`, so Google Sheets, HubSpot, Salesforce, Shopify, and manual revenue writes remain deferred.
- [x] Completed locally: existing CSV source edit guards still require campaign ownership, `sourceType="csv"`, matching `platformContext`, and stable `sourceId` record replacement.
- [x] Completed locally: focused regression coverage added in `server/google-ads-revenue-csv-flow.test.ts`.
- [x] Local validation passed: `npm test -- server/google-ads-revenue-csv-flow.test.ts server/google-ads-revenue-wizard-context.test.ts server/google-ads-revenue-platform-context.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] Commit 15 validated for the implemented local automated scope.
- [ ] Future/deferred validation: CSV add/edit/delete browser validation through the Google Ads `Total Revenue` card is covered in Commit 20.

#### Commit 16: Google Sheets Google Ads Attributed Revenue Flow

Goal:

- Add the refreshable Google Sheets revenue source path for Google Ads.

Tasks:

- Extend/validate Google Sheets chooser, preview, mapping, process, edit, and delete paths with `platformContext="google_ads"` and purpose `google_ads_revenue`.
- Preserve stable source identity in edit/refresh mode.
- Preserve stable modal content during Google Sheets connection checks.
- Ensure dated rows populate daily records only when a date column is mapped.

Validation:

- Add a Google Sheets Google Ads revenue source.
- Edit the same source and confirm the same source ID updates.
- Delete the source and confirm only that source's records are removed/deactivated.
- Confirm GA4, LinkedIn, and Meta Google Sheets revenue sources do not appear in Google Ads `Sources`.
- Confirm no transient Google Sheets loading text causes modal body jumps.

Status:

- [x] Completed locally: `/api/campaigns/:id/revenue/sheets/preview` now uses a Google-Sheets-revenue-specific platform-context validator that accepts `google_ads`.
- [x] Completed locally: `/api/campaigns/:id/revenue/sheets/process` now uses the same Sheets-specific validator and maps `platformContext="google_ads"` to Google Sheets purpose `google_ads_revenue`.
- [x] Completed locally: Google Ads Sheets imports remain revenue-only; native Google Ads conversion value is not used as imported attributed revenue.
- [x] Completed locally: edit/refresh mode now fails closed when a supplied `sourceId` does not resolve to an active `google_sheets` revenue source for the requested campaign/platform context.
- [x] Completed locally: existing OAuth, callback, tab-selection, single-tab revenue guard, frontend purpose propagation, and scheduler direct-source refresh paths were traced and left in the existing pattern.
- [x] Completed locally: focused regression coverage added in `server/google-ads-revenue-sheets-flow.test.ts`.
- [x] Local validation passed: `npm test -- server/google-ads-revenue-sheets-flow.test.ts server/google-ads-revenue-csv-flow.test.ts server/google-ads-revenue-wizard-context.test.ts server/google-ads-revenue-platform-context.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] Commit 16 validated for the implemented local automated scope.
- [ ] Future/deferred validation: Google Ads Sheets add/edit/delete browser validation through the Google Ads `Total Revenue` card is covered in Commit 20.

#### Commit 17: HubSpot Google Ads Attributed Revenue Flow

Goal:

- Add HubSpot deal revenue attribution for Google Ads using the existing GA4/LinkedIn CRM pattern.

Tasks:

- Extend/validate HubSpot connect/status, Crosswalk, revenue mapping, save, edit, delete, and reprocess payloads with `platformContext="google_ads"`.
- Preserve selected HubSpot campaign values as the campaign attribution boundary.
- If Pipeline Proxy is exposed, keep it separate from confirmed Total Revenue and revenue-derived metrics.
- Preserve stable `sourceId` in edit and scheduler refresh mode.

Validation:

- Add a HubSpot Google Ads revenue source.
- Edit the same source and confirm the same source ID updates.
- Delete the source and confirm only Google Ads-scoped HubSpot revenue records are removed/deactivated.
- Confirm GA4 and LinkedIn HubSpot revenue sources remain isolated.
- Confirm Pipeline Proxy, if configured, is not included in Total Revenue, ROAS, ROI, or Profit.

Status:

- [x] Completed locally: `/api/campaigns/:id/hubspot/save-mappings` now uses a HubSpot-revenue-specific platform-context validator that accepts `google_ads`.
- [x] Completed locally: HubSpot save mapping now maps `platformContext="google_ads"` to persisted `platformContext="google_ads"` instead of falling back to GA4.
- [x] Completed locally: Google Ads HubSpot imports remain revenue-only; native Google Ads conversion value is not used as imported attributed revenue.
- [x] Completed locally: edit mode still fails closed when a supplied `sourceId` does not resolve to a HubSpot revenue source for the requested campaign/platform context.
- [x] Completed locally: HubSpot Pipeline Proxy remains separate from confirmed revenue and includes Google Ads sources only when `platformContext=google_ads` is explicitly requested.
- [x] Completed locally: frontend modal/wizard payloads and scheduler reprocess helper payloads were traced for `platformContext`, `sourceId`, selected values, and Pipeline Proxy fields.
- [x] Completed locally: focused regression coverage added in `server/google-ads-revenue-hubspot-flow.test.ts`.
- [x] Local validation passed: `npm test -- server/google-ads-revenue-hubspot-flow.test.ts server/google-ads-revenue-sheets-flow.test.ts server/google-ads-revenue-csv-flow.test.ts server/google-ads-revenue-wizard-context.test.ts server/google-ads-revenue-platform-context.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] Commit 17 validated for the implemented local automated scope.
- [ ] Future/deferred validation: HubSpot add/edit/delete browser validation through the Google Ads `Total Revenue` card is covered in Commit 20.
- [ ] Future/deferred validation: HubSpot scheduler context-loop validation is covered in Commit 22.

#### Commit 18: Salesforce Google Ads Attributed Revenue Flow

Goal:

- Add Salesforce opportunity revenue attribution for Google Ads using the existing GA4/LinkedIn CRM pattern.

Tasks:

- Extend/validate Salesforce connect/status, Crosswalk, revenue mapping, save, edit, delete, and reprocess payloads with `platformContext="google_ads"`.
- Preserve selected Salesforce opportunity values as the campaign attribution boundary.
- Preserve selected Salesforce date field through preview, save, and refresh.
- If Pipeline Proxy is exposed, keep it separate from confirmed Total Revenue and revenue-derived metrics.
- Preserve stable `sourceId` in edit and scheduler refresh mode.

Validation:

- Add a Salesforce Google Ads revenue source.
- Edit the same source and confirm the same source ID updates.
- Delete the source and confirm only Google Ads-scoped Salesforce revenue records are removed/deactivated.
- Confirm GA4 and LinkedIn Salesforce revenue sources remain isolated.
- Confirm Pipeline Proxy, if configured, is not included in Total Revenue, ROAS, ROI, or Profit.

Status:

- [x] Completed locally: `/api/campaigns/:id/salesforce/save-mappings` now uses a Salesforce-revenue-specific platform-context validator that accepts `google_ads`.
- [x] Completed locally: Salesforce save mapping now maps `platformContext="google_ads"` to persisted `platformContext="google_ads"` instead of falling back to GA4.
- [x] Completed locally: Google Ads Salesforce imports remain revenue-only; native Google Ads conversion value is not used as imported attributed revenue.
- [x] Completed locally: edit mode still fails closed when a supplied `sourceId` does not resolve to a Salesforce revenue source for the requested campaign/platform context.
- [x] Completed locally: Salesforce Pipeline Proxy remains separate from confirmed revenue and includes Google Ads sources only when `platformContext=google_ads` is explicitly requested.
- [x] Completed locally: frontend modal/wizard payloads and scheduler reprocess helper payloads were traced for `platformContext`, `sourceId`, selected values, date field, and Pipeline Proxy fields.
- [x] Completed locally: focused regression coverage added in `server/google-ads-revenue-salesforce-flow.test.ts`.
- [x] Local validation passed: `npm test -- server/google-ads-revenue-salesforce-flow.test.ts server/google-ads-revenue-hubspot-flow.test.ts server/google-ads-revenue-sheets-flow.test.ts server/google-ads-revenue-csv-flow.test.ts server/google-ads-revenue-wizard-context.test.ts server/google-ads-revenue-platform-context.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] Commit 18 validated for the implemented local automated scope.
- [ ] Future/deferred validation: Salesforce add/edit/delete browser validation through the Google Ads `Total Revenue` card is covered in Commit 20.
- [ ] Future/deferred validation: Salesforce scheduler context-loop validation is covered in Commit 22.

#### Commit 19: Shopify Google Ads Attributed Revenue Flow

Goal:

- Add Shopify order revenue attribution for Google Ads using the existing GA4/LinkedIn ecommerce pattern.

Tasks:

- Extend/validate Shopify connection method handling, attribution field/value selection, revenue review, save, edit, delete, and reprocess payloads with `platformContext="google_ads"`.
- Preserve Shopify OAuth callback rules and Admin API token behavior.
- Preserve stable `sourceId` in edit and scheduler refresh mode.
- Keep Shopify revenue-to-date semantics and do not expose conversion-value source selection.

Validation:

- Add a Shopify Google Ads revenue source.
- Edit the same source and confirm the same source ID updates.
- Delete the source and confirm only Google Ads-scoped Shopify revenue records are removed/deactivated.
- Confirm GA4 and LinkedIn Shopify revenue sources remain isolated.
- Confirm Shopify Review shows enough source-value revenue detail to verify attribution before saving.

Status:

- [ ] Pending implementation.
- [ ] Validation pending.

#### Commit 20: Google Ads Overview Total Revenue Card And Sources Modal

Goal:

- Expose the visible Google Ads `Total Revenue` card only after the source context, read semantics, wizard support, and source families have been proven.

Tasks:

- Add `Total Revenue` to Google Ads Overview.
- Add `+` action that opens `AddRevenueWizardModal` with `platformContext="google_ads"`.
- Add `Sources (n)` link based only on active Google Ads-scoped revenue sources.
- Add a Google Ads source dialog with edit/delete actions using existing guarded source routes.
- Show native Google Ads `Conversion Value` separately.
- Add `Profit`, `ROAS`, and `ROI` display only when imported Google Ads attributed revenue is present.

Validation:

- Google Ads Overview with no imported revenue shows `Total Revenue` as not connected/unavailable, not `$0` business revenue.
- Clicking `+` opens the shared source chooser scoped to Google Ads.
- `Sources (n)` lists only Google Ads-scoped active revenue sources.
- Multiple active Google Ads revenue sources sum additively.
- Editing/deleting one source updates the count and Total Revenue without affecting GA4, LinkedIn, or Meta sources.

Status:

- [ ] Pending implementation.
- [ ] Validation pending.

#### Commit 21: KPIs, Benchmarks, Insights, And Reports

Goal:

- Align downstream Google Ads consumers with the new source semantics.

Tasks:

- Update Google Ads KPI and Benchmark current-value mapping so revenue-dependent metrics use imported Google Ads attributed revenue only.
- Update Google Ads Insights financial copy and rules to distinguish native conversion value from imported-revenue business efficiency.
- Update Google Ads report payloads/PDF/scheduled report paths to include the same revenue semantics and source provenance.
- Preserve report response shapes.

Validation:

- Google Ads ROI/ROAS KPIs remain unavailable or blocked without imported attributed revenue.
- After importing Google Ads revenue, KPI/Benchmark current values match the Overview cards.
- Google Ads Insights does not describe conversion value as business revenue.
- Standard and scheduled Google Ads reports show Total Revenue only when Google Ads attributed revenue exists.

Status:

- [ ] Pending implementation.
- [ ] Validation pending.

#### Commit 22: Scheduler, Refresh, Snapshot, And Disconnect/Reconnect Safety

Goal:

- Keep imported Google Ads revenue fresh and prevent stale revenue after source lifecycle changes.

Tasks:

- Extend `server/auto-refresh-scheduler.ts` context loops to include Google Ads for refreshable source families.
- Confirm HubSpot, Salesforce, Shopify, and eligible Google Sheets refresh pass stable `sourceId` and `platformContext="google_ads"`.
- Update `server/scheduler.ts` snapshots to store the same Google Ads revenue semantics used by the aggregate.
- On Google Ads disconnect/reconnect or selected-campaign replacement, fail closed for existing Google Ads-scoped child revenue sources until the attribution boundary is revalidated.
- Deactivate/delete only the current campaign's Google Ads-scoped revenue sources/records when cleanup is explicitly required and the boundary is proven.

Validation:

- Auto-refresh updates the same Google Ads revenue source ID instead of creating duplicates.
- Scheduler snapshots show Google Ads imported attributed revenue only when an active Google Ads revenue source exists.
- Disconnect Google Ads and confirm Google Ads revenue, ROI, ROAS, and Profit disappear without affecting GA4/LinkedIn/Meta revenue.
- Reconnect Google Ads and confirm stale prior Google Ads revenue does not reappear until a valid source is added/refreshed.
- Changing selected Google Ads campaigns does not silently reuse revenue from an invalid prior attribution boundary.

Status:

- [ ] Pending implementation.
- [ ] Validation pending.

#### Commit 23: Regression Coverage And Final Evidence

Goal:

- Prove Google Ads attributed revenue import is isolated and production-safe for the implemented local/test-mode path.

Tasks:

- Add or confirm regression coverage for platform-context isolation.
- Add or confirm regression coverage for each source family: CSV, Google Sheets, HubSpot, Salesforce, Shopify.
- Add or confirm regression coverage for multiple Google Ads revenue sources.
- Add or confirm regression coverage for native conversion value versus imported attributed revenue semantics.
- Add or confirm regression coverage for source delete, disconnect/reconnect, selected-campaign replacement, scheduler refresh, aggregate, KPI/Benchmark, Insights, and Reports.
- Update this tracker with validation evidence.

Validation:

- Targeted tests pass.
- Type check passes if touched code requires it.
- Manual UI validation passes for source add/edit/delete and downstream Google Ads cards.
- Live OAuth remains separate and still needs deployed/production-like evidence.

Status:

- [ ] Pending implementation.
- [ ] Validation pending.

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
- Google Ads `Total Revenue` card `+` action opens the Google Ads-scoped revenue wizard.
- Google Ads `Sources (n)` lists only Google Ads-scoped sources.
- CSV, Google Sheets, HubSpot, Salesforce, and Shopify Google Ads revenue add/edit/delete flows.
- Multiple Google Ads revenue sources sum additively without changing GA4, LinkedIn, or Meta revenue.
- Native Google Ads conversion value remains separate from imported Google Ads attributed revenue.

## Relevant Documentation

- `AGENTS.md`
- `ARCHITECTURE_USER_JOURNEY.md`
- `GA4/README.md`
- `GA4/FINANCIAL_SOURCES.md`
- `GA4_DEVELOPMENT_WORKFLOW.md`
- `CAMPAIGN_DEEPDIVE_PRODUCTION_READY_STATUS.md`
- `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `LINKEDIN_REVENUE_IMPORT_PRODUCTION_READY.md`

## Latest Validation

- User validation passed for Commit 1.
- User validation passed for Commit 2.
- User validation passed for Commit 3.
- User validation passed for Commit 4.
- User validation passed for Commit 5.
- User validation passed for Commit 6.
- User validation passed for Commit 7.
- User validation passed for Commit 8.
- User validation passed for Commit 9.
- User validation passed for Commit 10.
- User validation passed for Commit 11 documentation and acceptance contract.
- User validation passed for Commit 12 implemented storage/read-side isolation scope.
- User validation passed for Commit 13 no-imported-revenue backend read semantics path.
- User validation passed for Commit 14 implemented wizard-context scope.
- Commit 15 validated for the CSV Google Ads attributed revenue parser/import-path guard local automated scope.
- Commit 16 validated for the Google Sheets Google Ads attributed revenue parser/import-path guard local automated scope.
- Commit 17 validated for the HubSpot Google Ads attributed revenue parser/import-path guard local automated scope.
- Commit 18 validated for the Salesforce Google Ads attributed revenue parser/import-path guard local automated scope.
