# TikTok Connected Platform Production-Ready Tracker

## Purpose

Track the work required to create and refine a TikTok connected platform integration to production level for both supported user paths:

- Initial campaign creation through the `Create Campaign` flow.
- Adding TikTok later from the campaign `Connected Platforms` section.

This tracker exists so TikTok follows the same source-backed connected-platform pattern used by GA4, LinkedIn, Google Ads, Meta/Facebook, Instagram, and Campaign DeepDive.

No runtime code has been implemented in this tracker commit. This file is the implementation contract and sequencing plan.

## Commit Tracker

This table is the single source of truth for what is done, pending, validated, and deferred. If a future finding requires splitting or adding a commit, the new subcommit must be added here before implementation starts.

| Commit | Scope | Status | Runtime/UI exposure |
| --- | --- | --- | --- |
| 1 | Documentation, root cause, and acceptance contract | Done locally in this tracker | None |
| 2A | TikTok provider/API source-contract research refresh | Done locally in this tracker | None |
| 2B | Local code-path trace and implementation boundary confirmation | Done locally in this tracker | None |
| 2C | TikTok schema/storage field contract design | Done locally in this tracker | None |
| 2D | Test-mode versus live-mode boundary | Done locally in this tracker | None |
| 2E | Commit 2 validation docs and no-runtime closeout | Done locally in this tracker | None |
| 3A | `tiktok_connections` schema/storage foundation | Pending | Backend storage only |
| 3B | `tiktok_daily_metrics` schema/storage foundation | Pending | Backend storage only |
| 3C | startup migration/table-existence coverage | Pending | Backend startup only |
| 3D | schema-derived campaign/client delete cascade coverage | Pending | Destructive-path guard only |
| 3E | Commit 3 validation docs | Pending | None |
| 4A | read-only TikTok connection/status route | Pending | Backend route only |
| 4B | backend test-mode connection route requiring selected TikTok campaigns | Pending | Backend route only |
| 4C | backend selected-campaign update route for an existing connection | Pending | Backend route only |
| 4D | backend campaign-list/selector contract | Pending | Backend route only |
| 4E | backend disconnect route and storage cleanup proof | Pending | Backend lifecycle route |
| 4F | Commit 4 backend contract finalization docs | Pending | None |
| 5A | Create Campaign TikTok platform option | Pending | Create Campaign UI option |
| 5B | Create Campaign TikTok test setup using backend source contract | Pending | Create Campaign setup |
| 5C | Create Campaign selected-campaign finalization guard | Pending | Create Campaign finalization |
| 5D | Create Campaign query invalidation after successful TikTok setup | Pending | Cache behavior |
| 5E | Create Campaign regression and validation docs | Pending | None |
| 6A | Connected Platforms status endpoint includes TikTok from source contract | Pending | Backend status payload |
| 6B | Connected Platforms TikTok card with no placeholder metrics | Pending | Connected Platforms UI |
| 6C | Connected Platforms add-source setup flow | Pending | Connected Platforms setup |
| 6D | Connected Platforms success/error/empty states and query invalidation | Pending | Connected Platforms UI state |
| 6E | Connected Platforms disconnect UI route mapping | Pending | Connected Platforms lifecycle |
| 6F | Commit 6 regression and validation docs | Pending | None |
| 7A | TikTok analytics route shell and campaign-access guard | Pending | TikTok analytics route |
| 7B | TikTok analytics daily metrics endpoint | Pending | Backend analytics data |
| 7C | TikTok Overview tab from persisted selected daily rows only | Pending | Analytics UI |
| 7D | TikTok Campaign Breakdown from selected campaign rows only | Pending | Analytics UI |
| 7E | TikTok Ad Comparison and Insights source-backed tab parity | Pending | Analytics UI |
| 7F | TikTok unavailable/error/freshness states | Pending | Analytics UI state |
| 7G | Commit 7 regression and validation docs | Pending | None |
| 8A | TikTok aggregate resolver reads only selected `tiktok_daily_metrics` rows | Pending | Campaign DeepDive backend aggregate |
| 8B | `/outcome-totals` source composition accepts TikTok through `platformSources` | Pending | Campaign DeepDive aggregate |
| 8C | `/executive-summary` uses same TikTok source composition | Pending | Campaign DeepDive aggregate |
| 8D | scheduler snapshot input uses same TikTok aggregate contract | Pending | Background snapshots |
| 8E | no-double-counting guard for TikTok plus other paid sources | Pending | Aggregate safety |
| 8F | Commit 8 regression and validation docs | Pending | None |
| 9A | TikTok spend source identity uses `tiktok_api` and `platformContext="tiktok"` | Pending | Spend import path |
| 9B | TikTok attributed revenue import identity uses `platformContext="tiktok"` only | Pending | Revenue import path |
| 9C | selected TikTok campaign mapping for imported revenue | Pending | Revenue attribution |
| 9D | TikTok revenue-dependent metric gating across Overview, KPIs, Benchmarks, Insights, and reports | Pending | Financial/current-value paths |
| 9E | Commit 9 regression and validation docs | Pending | None |
| 10A | TikTok KPI current-value source contract | Pending | KPI backend/UI |
| 10B | TikTok Benchmark current-value source contract | Pending | Benchmark backend/UI |
| 10C | TikTok alert/notification refresh behavior | Pending | Visibility path |
| 10D | Commit 10 regression and validation docs | Pending | None |
| 11A | TikTok platform report routes/cards use shared platform-report pattern | Pending | Reports UI/backend |
| 11B | browser PDF/export uses latest TikTok source-backed values | Pending | Report exports |
| 11C | scheduled TikTok reports fail closed and snapshot only successful sends | Pending | Scheduled reports |
| 11D | Campaign DeepDive Custom Report includes TikTok through shared aggregate only | Pending | Campaign reports |
| 11E | Commit 11 regression and validation docs | Pending | None |
| 12A | manual TikTok refresh route writes selected rows only | Pending | Refresh route |
| 12B | TikTok scheduler refresh skips missing, stale, unselected, or invalid sources | Pending | Background refresh |
| 12C | refresh failures preserve previous valid rows and freshness state | Pending | Refresh safety |
| 12D | Commit 12 regression and validation docs | Pending | None |
| 13A | disconnect cleanup removes only current campaign TikTok-owned rows | Pending | Destructive path |
| 13B | reconnect clears stale TikTok rows before new selected-scope writes | Pending | Lifecycle behavior |
| 13C | selected-campaign change cleanup and no stale-row resurrection | Pending | Lifecycle behavior |
| 13D | existing damaged-data cleanup plan, if stale rows are proven | Pending | Data cleanup plan only |
| 13E | Commit 13 regression and validation docs | Pending | None |
| 14A | local/test-mode Create Campaign browser validation | Pending | Validation only |
| 14B | local/test-mode Connected Platforms browser validation | Pending | Validation only |
| 14C | local TikTok-only Campaign DeepDive validation | Pending | Validation only |
| 14D | local GA4 plus TikTok validation | Pending | Validation only |
| 14E | local multi-paid-source no-double-counting validation | Pending | Validation only |
| 14F | final local evidence update | Pending | Documentation only |
| 15A | live OAuth start/callback/provider campaign discovery validation | Deferred | Live provider only |
| 15B | live TikTok reporting refresh validation | Deferred | Live provider only |
| 15C | deployed scheduled report/live-source evidence | Deferred | Live/deployed only |
| 15D | final live OAuth production-readiness update | Deferred | Documentation only |

## Required Product Rule

`Connected Platforms` is the source of truth.

TikTok must be treated as a campaign-scoped main paid-media connected source only after the user explicitly connects the source and selects the TikTok advertiser account and TikTok campaigns that should feed the campaign. Campaign DeepDive, KPIs, Benchmarks, Custom Reports, scheduled reports, and the TikTok analytics page must consume TikTok through persisted selected TikTok source rows and the shared connected-source aggregate contract, not through placeholder values, generic campaign-level estimates, unscoped Google Sheets rows, unscoped revenue, Meta/Instagram placement rows, or broad account-level TikTok data.

## Current Status

TikTok is not currently implemented as a first-class campaign-scoped connected platform.

The current codebase has only generic or adjacent TikTok references:

- `shared/schema.ts` includes `tiktok_ads` as a Google Sheets multi-platform selector option.
- `client/src/components/GoogleSheetsDatasetsView.tsx` includes `tiktok_ads` as a Google Sheets dataset/platform label.
- `client/src/components/GuidedColumnMapping.tsx` recognizes column values containing `tiktok` for display inference.
- `client/src/components/modals/integration-modal.tsx` has legacy generic integration modal label/icon/token copy for `tiktok`.
- `client/src/pages/campaign-detail.tsx` maps a legacy campaign platform ID `tiktok` to `TikTok Ads`, but there is no first-class TikTok source card, setup flow, connection status route, analytics path, or source-backed metrics.
- `server/routes-oauth.ts` has `tiktok_ads` keyword matching for Google Sheets platform filtering.
- `server/performance-summary-aggregate.test.ts` proves the generic future `platformSources` aggregate contract can consume a TikTok-shaped source if a validated resolver supplies it.
- Mock CSV/sample data contains TikTok rows, but those are not a campaign-scoped TikTok connected platform.

No current local proof exists for TikTok:

- no `tiktok_connections` table
- no `tiktok_daily_metrics` table
- no TikTok storage methods
- no TikTok OAuth route
- no TikTok test-mode connection route
- no selected TikTok campaign persistence
- no TikTok Campaign Creation flow
- no TikTok Connected Platforms add-source flow
- no TikTok analytics route/page
- no TikTok aggregate resolver
- no TikTok scheduler refresh
- no TikTok KPI/Benchmark/report platform parity
- no TikTok disconnect/reconnect cleanup

## Root Cause Analysis

The TikTok gap is a missing source-contract implementation, not a single broken UI entry.

TikTok appears in a few generic labels and mock/source-import helpers, but those references do not establish campaign-scoped source identity, selected advertiser/campaign scope, persisted daily facts, source freshness, revenue/spend provenance, KPI/Benchmark current values, report output, scheduler refresh, lifecycle cleanup, or Campaign DeepDive aggregate participation.

The production risk is that TikTok could be surfaced too early as a platform tile or source label while values are still coming from:

- mock CSV rows
- generic campaign fields
- Google Sheets platform labels
- legacy generic integrations
- account-wide provider reports
- another paid-media source
- imported revenue without TikTok platform context

That would violate the architecture rule that platform-specific analytics must remain scoped to the source configuration selected when the platform was connected to the campaign.

The smallest safe path is to build TikTok the same way Instagram was tracked and hardened:

1. document the source contract before runtime changes
2. add schema/storage foundations without UI exposure
3. add backend connection/status/test-selection routes
4. expose Create Campaign and Connected Platforms flows only after backend scope exists
5. add analytics and aggregate participation from persisted selected rows only
6. add revenue/spend/KPI/Benchmark/report/scheduler/destructive paths as separately validated lifecycle commits
7. defer live OAuth/provider validation until provider credentials and deployed evidence are available

## Existing Relevant Paths

Current TikTok-adjacent paths:

- `shared/schema.ts`
  - Google Sheets platform option contains `tiktok_ads`.
  - No first-class TikTok connection or daily metric schema exists.

- `client/src/components/GoogleSheetsDatasetsView.tsx`
  - Google Sheets dataset selector includes TikTok as a spreadsheet platform label.
  - This is not a TikTok connected platform.

- `client/src/components/GuidedColumnMapping.tsx`
  - Infers `TikTok` from source values containing `tiktok`.
  - This is column-mapping display logic only.

- `client/src/components/modals/integration-modal.tsx`
  - Legacy generic integration modal supports a `tiktok` label/icon.
  - This does not create campaign-scoped TikTok analytics.

- `client/src/pages/campaign-detail.tsx`
  - Legacy platform ID display map includes `tiktok`.
  - No TikTok source card, query, setup form, analytics path, or metrics resolver exists.

- `server/routes-oauth.ts`
  - `getPlatformKeywords` maps `tiktok_ads` to TikTok keywords for Google Sheets matching.
  - No TikTok connected-platform API routes exist.

- `server/utils/performance-summary-aggregate.ts`
  - Generic `platformSources` can accept future main Connected Platforms.
  - TikTok still needs its own campaign-scoped resolver before this contract can be used.

- `server/performance-summary-aggregate.test.ts`
  - Test-only TikTok-shaped aggregate source proves the aggregate helper can add a future TikTok source without tab rewiring.
  - It does not prove any TikTok connection, storage, refresh, or source accuracy.

Pattern paths to follow:

- `client/src/pages/campaigns.tsx`
- `client/src/pages/campaign-detail.tsx`
- existing platform analytics pages for Google Ads, Meta, and Instagram
- `server/routes-oauth.ts`
- `server/storage.ts`
- `server/scheduler.ts`
- existing platform schedulers such as `server/google-ads-scheduler.ts`, `server/meta-scheduler.ts`, and Instagram scheduler wiring
- `server/utils/performance-summary-aggregate.ts`
- `shared/schema.ts`

## Commit 2 Root Cause And Source-Contract Trace

Root cause:

- The first tracker pass proved TikTok is absent as a first-class connected platform, but it did not yet define the provider/API boundary or the exact future schema/storage fields tightly enough to begin safe implementation.
- Without this Commit 2 trace, the next schema commit could accidentally store account-wide reports, mix TikTok with Google Sheets labels, borrow Meta/Instagram rows, or create a source shape that cannot feed Campaign DeepDive through `platformSources`.
- The safest fix is documentation-only: freeze the intended TikTok source contract before adding tables, routes, UI, scheduler behavior, or OAuth.

### Commit 2A: Provider/API Research Findings

Official TikTok references reviewed for planning:

- TikTok API for Business authentication docs: `https://ads.tiktok.com/gateway/docs/index?doc_id=1738373164380162`
- TikTok API for Business reporting dimensions docs: `https://ads.tiktok.com/gateway/docs/index?doc_id=1751443956638721`
- TikTok API for Business reporting metrics docs: `https://business-api.tiktok.com/gateway/docs/index?doc_id=1751443967255553`
- TikTok Ads Manager reporting metrics overview: `https://ads.tiktok.com/help/article/all-metrics?lang=en`
- TikTok estimated metrics overview: `https://ads.tiktok.com/help/article/what-are-estimated-metrics?lang=en`

Planning conclusions:

- Authentication should use TikTok API for Business OAuth, but live OAuth remains deferred until Commit 15.
- TikTok OAuth can return advertiser access through advertiser-account authorization. The implementation must store the advertiser account selected by the user and must not treat every authorized advertiser as campaign scope.
- TikTok reporting for this product should use campaign-level daily rows. The safe reporting dimensions for the initial source contract are `advertiser_id`, `campaign_id`, and `stat_time_day`.
- TikTok reporting docs also support lower levels such as ad group and ad, but those should not be part of the first production slice unless a later commit explicitly adds them.
- Current paid-media base metrics should be limited to metrics with clear source-backed semantics: impressions, clicks, spend/cost, conversions where returned by the selected report, CTR, CPC, CPM, CPA, CVR, and video metrics where the API returns them for the selected report.
- TikTok reporting docs state unsupported or meaningless query combinations can return unavailable values. The implementation must preserve unavailable states and reasons instead of converting those values to zero.
- Some TikTok Ads Manager metrics can be estimated, delayed, or privacy-limited. The app must not present estimated or delayed TikTok metrics as exact financial proof without preserving provider provenance.
- TikTok ROAS/revenue fields, including onsite or shop-related fields, must not be used as business revenue until the exact field, attribution window, campaign scope, and user-facing label are validated. Until then, revenue-dependent app metrics remain unavailable unless a TikTok-scoped attributed revenue source is imported.

### Commit 2B: Local Code-Path Trace

Current local TikTok references remain adjacent only:

- `shared/schema.ts` contains `tiktok_ads` in Google Sheets platform options.
- `client/src/components/GoogleSheetsDatasetsView.tsx` contains a Google Sheets TikTok label.
- `client/src/components/GuidedColumnMapping.tsx` can infer a display label from text containing `tiktok`.
- `client/src/components/modals/integration-modal.tsx` contains a legacy generic TikTok integration label/icon/token description.
- `client/src/pages/campaign-detail.tsx` maps a legacy campaign platform ID `tiktok` to `TikTok Ads`.
- `server/routes-oauth.ts` maps `tiktok_ads` to platform keywords for Google Sheets matching.
- `server/performance-summary-aggregate.test.ts` contains a test-only future TikTok-shaped `platformSources` source.

Confirmed absent local first-class paths:

- no TikTok platform option in `client/src/pages/campaigns.tsx`
- no TikTok connection component
- no TikTok Connected Platforms status entry
- no TikTok analytics page
- no TikTok API routes
- no TikTok storage methods
- no TikTok scheduler
- no TikTok KPI, Benchmark, or Report parity path

Implementation boundary:

- Do not reuse `integration-modal.tsx` for TikTok production setup.
- Do not treat Google Sheets `tiktok_ads` labels as a main TikTok platform connection.
- Do not wire TikTok into Campaign DeepDive until a campaign-scoped resolver reads selected persisted TikTok rows.
- Do not add live OAuth in local Commit 3 or Commit 4 unless explicitly requested.

### Commit 2C: Future `tiktok_connections` Field Contract

Future table purpose:

- Store one active TikTok source contract for a campaign.
- Scope every TikTok read/write to the campaign and selected TikTok advertiser/campaign IDs.
- Preserve enough provider and freshness metadata for analytics, scheduler, disconnect/reconnect, and reports to fail closed.

Required fields:

- `id`
- `campaignId`
- `advertiserId`
- `advertiserName`
- `selectedCampaignIds`
- `selectedCampaignNames` or `selectedCampaignMetadata`
- `accessToken`
- `refreshToken` only if required by the current TikTok OAuth mode
- `encryptedTokens`
- `method`
- `isActive`
- `spendOnly`
- `sourceContractVersion`
- `reportingDimensions`
- `reportingMetrics`
- `lastRefreshAt`
- `lastError`
- `connectedAt`
- `createdAt`
- `updatedAt`

Required field semantics:

- `selectedCampaignIds` must be a non-empty JSON array before TikTok is considered connected.
- `advertiserId` must be saved and checked on every refresh/report pull.
- `method` should distinguish `test_mode` from `oauth`.
- `sourceContractVersion` should start as `tiktok_campaign_daily_v1`.
- `reportingDimensions` should initially be `["advertiser_id", "campaign_id", "stat_time_day"]`.
- `reportingMetrics` should record the exact requested TikTok metric fields used by the implementation.
- `lastError` should support freshness warnings without overwriting previous valid rows.

### Commit 2D: Future `tiktok_daily_metrics` Field Contract

Future table purpose:

- Store selected TikTok campaign daily facts.
- Feed TikTok analytics, Campaign Overview, Campaign DeepDive, KPI/Benchmark current values, Insights, Reports, scheduler snapshots, and disconnect/reconnect validation from the same persisted rows.

Required fields:

- `id`
- `campaignId`
- `advertiserId`
- `tiktokCampaignId`
- `tiktokCampaignName`
- `date`
- `impressions`
- `clicks`
- `spend`
- `currency`
- `conversions`
- `videoViews`
- `engagements`
- `ctr`
- `cpc`
- `cpm`
- `cpa`
- `cvr`
- `rawMetrics`
- `metricAvailability`
- `isEstimated`
- `sourceContractVersion`
- `isSimulated`
- `lastSyncedAt`
- `createdAt`
- `updatedAt`

Required row semantics:

- Unique logical key should be campaign ID, advertiser ID, TikTok campaign ID, date, and source contract version.
- Reads must filter by the active connection's selected TikTok campaign IDs.
- Rows outside the selected campaign list must not appear in analytics or aggregate output.
- Derived values such as CTR, CPC, CPM, CPA, and CVR may be stored for display convenience, but aggregate calculations must be able to recompute them from base metrics.
- `rawMetrics` and `metricAvailability` preserve provider-specific unavailable values and estimated/delayed metric notes.
- `isSimulated` must be true for test-mode rows and must not be confused with live provider evidence.

### Commit 2E: Test-Mode Versus Live-Mode Boundary

Test mode:

- May use deterministic simulated advertiser and campaign IDs.
- Must require explicit selected TikTok campaign IDs.
- Must write rows through the same storage methods as live mode.
- Must set `method="test_mode"` and `isSimulated=true`.
- Must never call live provider APIs.
- Can prove local source-contract behavior, aggregate participation, no-double-counting, reports, scheduler gating, and disconnect/reconnect.

Live mode:

- Must use TikTok OAuth/provider authorization.
- Must discover advertiser accounts through the authorized advertiser account path.
- Must discover campaigns for the selected advertiser account.
- Must refresh reports from TikTok using selected advertiser/campaign/date scope only.
- Must preserve provider metric names, unavailable values, delay/estimated semantics, and currency.
- Remains deferred until Commit 15 and cannot be called production-ready from local test-mode evidence.

## Production-Ready Target Contract

TikTok is production-ready only when all of the following are true:

- The campaign has a persisted TikTok source tied to the correct campaign.
- The source stores the selected TikTok advertiser account and selected TikTok campaigns.
- The source is scoped to the current owner, client, campaign, and platform.
- TikTok appears in `Connected Platforms` only after a valid connection and selected-campaign state exists.
- TikTok metrics come only from persisted selected TikTok daily rows.
- TikTok analytics filters rows by the selected TikTok campaign IDs saved in the source contract.
- Campaign DeepDive consumes TikTok through `performanceSummary.platformSources`.
- Missing TikTok metrics render unavailable with reasons, not invented zeroes.
- Zero appears only when TikTok supports the metric and the persisted source value is actually zero.
- Revenue, ROI, ROAS, profit, and revenue-dependent recommendations remain unavailable until a TikTok-scoped attributed revenue source exists.
- TikTok spend comes from TikTok persisted rows or TikTok-scoped spend sources only.
- TikTok imported revenue uses only `platformContext="tiktok"` and exact selected TikTok campaign IDs or explicit source-value-to-TikTok-campaign mappings.
- Scheduler refresh writes the same selected TikTok rows consumed by UI, aggregate, KPIs, Benchmarks, Insights, and reports.
- Disconnect/reconnect affects only the current campaign's TikTok source and TikTok-scoped rows.
- Scheduled reports fail closed when the campaign/source boundary cannot be verified.
- Live OAuth/provider behavior is not called production-ready until deployed or production-like provider evidence exists.

## Source Capability Rules

TikTok may provide, after source-backed validation:

- impressions
- clicks
- spend/cost
- conversions where the selected reporting objective/event supports it
- video views and video engagement metrics where the reporting API returns them
- campaign/ad group/ad identifiers and names
- CTR, CPC, CPM, CPA, CVR, ROAS, and ROI only when required inputs are available
- attributed revenue only when an explicit TikTok-scoped revenue source or validated TikTok conversion-value path exists

TikTok must not provide:

- GA4 users
- GA4 sessions
- GA4 pageviews
- web analytics conversion rate unless explicitly backed by web analytics inputs
- Meta/Facebook or Instagram placement rows
- Google Ads conversion value
- LinkedIn revenue
- generic campaign revenue without TikTok source provenance
- Google Sheets TikTok-labeled rows as a main connected platform unless they are explicitly imported through a TikTok-scoped source path
- placeholder campaign-level percentage splits
- account-wide TikTok metrics outside the selected campaign scope

Current provider-planning notes from official TikTok material:

- TikTok Business API reporting supports dimensions such as `advertiser_id`, `campaign_id`, `adgroup_id`, and `ad_id`.
- TikTok help material defines common ad metrics such as cost/spend, impressions, CTR, CVR, cost per conversion, and ROAS.
- Some TikTok metrics may be estimated, delayed, objective-specific, or privacy-limited. Implementation must preserve provider semantics and unavailable reasons rather than forcing complete metric coverage.

## No-Double-Counting Rules

- TikTok is a separate main paid-media source from Meta/Facebook and Instagram.
- TikTok spend must be additive with LinkedIn, Google Ads, Meta, and Instagram only when each platform is connected as its own main source and rows are campaign-scoped.
- TikTok must not consume Meta/Facebook or Instagram placement rows.
- TikTok imported revenue must not reuse GA4, LinkedIn, Google Ads, Meta, or Instagram revenue rows.
- TikTok campaign-level attributed revenue may be shown only when source values exactly match selected TikTok campaign IDs or are explicitly mapped to selected TikTok campaign IDs.
- Unmapped TikTok revenue must not be allocated by spend, clicks, impressions, campaign name similarity, conversion count, or any generic split.
- Canonical campaign spend sources must not double-count TikTok platform spend. If canonical spend overrides platform spend in the shared aggregate, the aggregate response must preserve source provenance and source-level TikTok spend detail separately.
- Google Sheets rows labeled TikTok remain Google Sheets/source-import data unless explicitly saved as TikTok-scoped spend or revenue records through the TikTok source contract.
- Campaign DeepDive must include TikTok once. TikTok must not appear both as a main platform and as a financial child source row.
- Reports and scheduler snapshots must use the same source composition as `/api/campaigns/:campaignId/outcome-totals`.

## Implementation Roadmap

### Commit 1: Documentation, Root Cause, And Acceptance Contract

Goal:

- Establish the TikTok production-ready checklist before code changes.

Subcommits:

- 1A: Read required architecture, GA4 workflow, and connected-platform trackers.
- 1B: Trace current TikTok code/docs references and prove absence of first-class source paths.
- 1C: Create this tracker with root cause, current inventory, target contract, capability rules, no-double-counting rules, roadmap, and validation plan.

Validation:

- Confirm this file exists.
- Confirm no runtime code changed.
- Confirm current TikTok status is documented as absent/unimplemented, not production-ready.

Status:

- [x] Required reading complete for documentation planning.
- [x] Current TikTok absence traced locally.
- [x] Tracker created locally.
- [ ] User review complete.

### Commit 2: Provider Research And Local Design Trace

Goal:

- Finalize the TikTok source contract before schema or route changes.

Subcommits:

- 2A: Refresh official TikTok API/provider docs for OAuth scopes, advertiser discovery, campaign discovery, reporting dimensions, metric names, date windows, pagination, rate limits, and token refresh.
- 2B: Trace Create Campaign, Connected Platforms, aggregate, scheduler, KPI, Benchmark, report, revenue, spend, and delete paths that TikTok will need to follow.
- 2C: Document exact future `tiktok_connections` fields.
- 2D: Document exact future `tiktok_daily_metrics` fields.
- 2E: Document test-mode versus live-mode boundary.

Validation:

- Provider field names are documented with official-source references.
- Live OAuth remains explicitly deferred unless the user asks to implement it.
- No runtime exposure exists.

Status:

- [x] Commit 2A provider/API research refreshed from official TikTok API for Business and TikTok Ads Manager documentation.
- [x] Commit 2B local code-path trace confirmed TikTok is still adjacent-only and not a first-class connected platform.
- [x] Commit 2C future `tiktok_connections` field contract documented.
- [x] Commit 2D future `tiktok_daily_metrics` field contract documented.
- [x] Commit 2E test-mode versus live-mode boundary documented.
- [x] No runtime code changed.
- [ ] User review complete.

### Commit 3: Schema And Storage Foundation

Goal:

- Add TikTok persistence without exposing TikTok in UI or aggregate outputs.

Subcommits:

- 3A: Add `tiktok_connections` with campaign ID, advertiser ID/name, selected campaign IDs, tokens or encrypted token payload, method, active state, freshness, selected-scope version, and timestamps.
- 3B: Add `tiktok_daily_metrics` with campaign ID, TikTok advertiser ID, TikTok campaign ID/name, date, impressions, clicks, spend, conversions, video metrics where supported, source metadata, and timestamps.
- 3C: Add insert schemas/types and storage methods in `server/storage.ts`.
- 3D: Add startup migration/table-existence coverage consistent with Instagram.
- 3E: Add campaign/client delete cascade coverage for new campaign-scoped TikTok tables.

Validation:

- Schema/type check passes.
- Storage methods are campaign-scoped.
- Campaign/client delete guard includes TikTok tables.
- No UI or aggregate path can show TikTok yet.

### Commit 4: Backend Source Contract Routes

Goal:

- Create backend-only TikTok connection lifecycle routes before UI exposure.

Subcommits:

- 4A: Add read-only `GET /api/tiktok/:campaignId/connection`.
- 4B: Add test-mode `POST /api/tiktok/:campaignId/connect-test` requiring a non-empty selected TikTok campaign list.
- 4C: Add `PATCH /api/tiktok/:campaignId/selected-campaigns` requiring an active campaign-scoped TikTok connection.
- 4D: Add `GET /api/tiktok/:campaignId/campaigns` returning only selected/test-discoverable TikTok campaign choices.
- 4E: Add `DELETE /api/tiktok/:campaignId/connection` with campaign-access guard and TikTok-scoped cleanup.
- 4F: Add route regression coverage and closeout docs.

Validation:

- Routes fail closed without campaign access.
- Test-mode connect cannot save empty selected campaigns.
- Selected-campaign updates clear stale selected-scope rows only for the current campaign.
- Disconnect removes TikTok from connection status and does not touch other platforms.

### Commit 5: Create Campaign Flow

Goal:

- Allow TikTok setup during initial campaign creation only after backend source validation exists.

Subcommits:

- 5A: Add TikTok to the Create Campaign platform list.
- 5B: Add TikTok test setup UI using the backend source contract.
- 5C: Block final campaign activation unless TikTok connection exists with selected campaign IDs.
- 5D: Invalidate connected-platform, outcome totals, Executive Summary, Trend Analysis, KPI, Benchmark, report, and source queries after successful finalization.
- 5E: Add focused regression and validation docs.

Validation:

- Create Campaign -> TikTok -> select account/campaigns -> finalize works in test mode.
- Failed/cancelled TikTok setup does not mark the campaign source connected.
- Finalized campaign shows TikTok in Connected Platforms only after source contract is valid.

### Commit 6: Connected Platforms Add-Source Flow

Goal:

- Add TikTok later from Campaign Overview `Connected Platforms` using the same source contract.

Subcommits:

- 6A: Add TikTok status to `/api/campaigns/:id/connected-platforms`.
- 6B: Add a TikTok card with no placeholder metrics.
- 6C: Add TikTok setup modal/form using the backend source contract.
- 6D: Add success, error, empty selected-campaign, and invalidation behavior.
- 6E: Wire disconnect action to TikTok backend delete route.
- 6F: Add focused regression and validation docs.

Validation:

- Existing campaign -> Connected Platforms -> Add TikTok -> select account/campaigns works.
- Connected Platforms does not show fake TikTok metrics before persisted rows exist.
- Disconnect hides TikTok and clears only current-campaign TikTok data.

### Commit 7: TikTok Analytics Page

Goal:

- Add platform-specific TikTok analytics from selected persisted rows only.

Subcommits:

- 7A: Add TikTok analytics route shell and campaign-access guard.
- 7B: Add daily metrics endpoint filtered by selected TikTok campaign IDs.
- 7C: Add Overview tab cards from selected daily rows.
- 7D: Add Campaign Breakdown from selected TikTok campaign rows.
- 7E: Add Ad Comparison and Insights parity using source-backed TikTok rows.
- 7F: Add unavailable, no-row, stale, and error states.
- 7G: Add focused regression and validation docs.

Validation:

- TikTok analytics route fails closed when not connected.
- TikTok Overview values match persisted selected rows.
- Campaign Breakdown excludes unselected TikTok campaign rows.
- Missing metrics show unavailable reasons.

### Commit 8: Campaign DeepDive Aggregate Participation

Goal:

- Feed TikTok into all Campaign DeepDive sections through the shared connected-source aggregate contract.

Subcommits:

- 8A: Add `buildTikTokPlatformSourceForAggregate` reading only selected `tiktok_daily_metrics`.
- 8B: Pass TikTok into `/api/campaigns/:campaignId/outcome-totals` via `platformSources`.
- 8C: Reuse the same TikTok source composition in `/api/campaigns/:campaignId/executive-summary`.
- 8D: Add TikTok scheduler snapshot input using the same source contract.
- 8E: Add no-double-counting regression for TikTok plus Google Ads, Meta, LinkedIn, Instagram, and GA4.
- 8F: Add focused validation docs.

Validation:

- TikTok-only campaign shows paid-media metrics in Performance Summary, Platform Comparison, Trend Analysis, Executive Summary, and Custom Report only where available.
- GA4 plus TikTok combines GA4 web/outcome metrics with TikTok paid-media metrics without inventing GA4 ad metrics.
- TikTok appears once in `performanceSummary.sources`.

### Commit 9: Revenue, Spend, ROI, And ROAS

Goal:

- Make TikTok financial metrics source-scoped and unavailable until proven.

Subcommits:

- 9A: Add TikTok spend source identity and platform context.
- 9B: Add TikTok attributed revenue source identity and platform context.
- 9C: Add exact selected TikTok campaign ID mapping or explicit source-value mapping for imported revenue.
- 9D: Gate revenue, profit, ROI, ROAS, CPA, and financial insights behind valid TikTok spend plus TikTok-scoped revenue where required.
- 9E: Add source-modal, edit/delete, scheduler refresh, and no-damaged-data validation docs.

Validation:

- TikTok spend-only campaign shows spend and non-revenue paid-media metrics, with revenue/ROI/ROAS unavailable.
- TikTok with valid attributed revenue shows revenue, profit, ROI, and ROAS from TikTok context only.
- GA4, LinkedIn, Google Ads, Meta, or Instagram revenue cannot unlock TikTok revenue metrics.
- Unmapped TikTok revenue does not populate per-campaign rows.

### Commit 10: KPI, Benchmark, Alerts, And Notifications

Goal:

- Align TikTok platform-level and campaign-level current values with the source-backed aggregate.

Subcommits:

- 10A: Map TikTok KPI current values to selected TikTok metrics and aggregate totals.
- 10B: Map TikTok Benchmark current values to selected TikTok metrics and aggregate totals.
- 10C: Ensure KPI/Benchmark create/update/delete refreshes alert checks and visible queries.
- 10D: Add regression coverage and validation docs.

Validation:

- TikTok KPI/Benchmark rows use current source-backed TikTok values.
- Revenue-dependent TikTok KPIs remain unavailable until TikTok revenue exists.
- Alerts are campaign/platform scoped and do not recreate unrelated notifications.

### Commit 11: Reports And Scheduled Reports

Goal:

- Make TikTok report output source-backed and scheduler-safe.

Subcommits:

- 11A: Add TikTok platform reports through the shared platform-report route pattern.
- 11B: Generate browser PDFs from latest TikTok source-backed values.
- 11C: Ensure scheduled TikTok reports verify campaign/source validity before snapshot/send bookkeeping.
- 11D: Ensure Campaign DeepDive Custom Report includes TikTok only through `performanceSummary`.
- 11E: Add regression coverage and validation docs.

Validation:

- TikTok standard report create/edit/delete works only for the current campaign/source.
- Browser PDF values match TikTok analytics and `/outcome-totals`.
- Scheduled reports do not create sent/downloadable snapshots on failed sends.
- Campaign DeepDive Custom Report includes TikTok values only when TikTok is connected and available.

### Commit 12: Refresh And Scheduler

Goal:

- Keep TikTok data fresh without stale or unscoped writes.

Subcommits:

- 12A: Add manual TikTok refresh route writing selected rows only.
- 12B: Add scheduler refresh that skips missing campaign, missing source, missing token, empty selected campaigns, or invalid scope.
- 12C: Preserve previous valid rows on refresh failure and update freshness/failure metadata.
- 12D: Add regression coverage and validation docs.

Validation:

- Manual refresh updates the same rows consumed by TikTok analytics and Campaign DeepDive.
- Scheduler refresh preserves selected-campaign filtering.
- Failed refresh does not overwrite real metrics with zeroes.
- Stale TikTok data produces freshness warnings.

### Commit 13: Disconnect, Reconnect, And Damaged Data

Goal:

- Prove destructive and lifecycle paths are campaign-scoped and stale-data safe.

Subcommits:

- 13A: Disconnect deletes or deactivates only current-campaign TikTok connection, daily rows, and TikTok-scoped financial child rows.
- 13B: Reconnect clears stale TikTok rows before new selected-scope writes.
- 13C: Selected-campaign changes clear stale rows outside the new selected TikTok scope.
- 13D: Add cleanup plan only if existing damaged TikTok records are proven after forward paths are fixed.
- 13E: Add regression coverage and validation docs.

Validation:

- Disconnect one campaign's TikTok source without affecting another campaign or platform.
- Reconnect does not resurrect stale TikTok metrics.
- Selected-campaign changes cannot leave old campaign rows visible.

### Commit 14: Final Local Evidence

Goal:

- Prove local/test-mode production readiness for the implemented source-backed TikTok path.

Subcommits:

- 14A: Create Campaign browser validation.
- 14B: Connected Platforms add-source browser validation.
- 14C: TikTok-only Campaign DeepDive validation.
- 14D: GA4 plus TikTok validation.
- 14E: multi-paid-source no-double-counting validation.
- 14F: final tracker evidence update.

Validation:

- Targeted TikTok regression suite passes.
- `npm run check` passes.
- `npm run build` passes when relevant UI paths are changed.
- Browser validation evidence is recorded in this tracker.

### Commit 15: Deferred Live OAuth And Provider Validation

Goal:

- Validate real TikTok provider behavior after local/test-mode implementation is stable and credentials/environment are available.

Subcommits:

- 15A: Live OAuth start/callback/token refresh validation.
- 15B: Advertiser and campaign discovery validation.
- 15C: Live reporting refresh validation with selected TikTok campaigns.
- 15D: Deployed scheduled-report/live-source evidence.
- 15E: final live production-readiness update.

Validation:

- Live OAuth connect succeeds in deployed or production-like environment.
- Live selected TikTok campaign rows match TikTok Ads Manager/reporting output for the same date window.
- Live scheduler refresh updates selected rows only.
- Scheduled reports are received with source-backed TikTok values.

Status:

- Deferred until explicitly requested and provider credentials/evidence are available.

## Validation Matrix

### Create Campaign Flow

- [ ] Start a new campaign.
- [ ] Select TikTok during campaign creation.
- [ ] Connect with approved test mode.
- [ ] Select TikTok advertiser account.
- [ ] Select TikTok campaigns.
- [ ] Finalize campaign.
- [ ] Confirm TikTok appears in Connected Platforms for that campaign only.
- [ ] Confirm `/api/campaigns/:campaignId/outcome-totals` includes TikTok only after persisted selected rows exist.
- [ ] Confirm Campaign DeepDive uses only available TikTok metrics.

### Connected Platforms Flow

- [ ] Open an existing campaign.
- [ ] Add TikTok from Connected Platforms.
- [ ] Connect with approved test mode.
- [ ] Select TikTok advertiser account and campaigns.
- [ ] Confirm Connected Platforms updates without fake metrics.
- [ ] Confirm TikTok analytics link appears only after analytics route/data contract exists.
- [ ] Confirm Campaign DeepDive sections update through the shared aggregate.

### Analytics Flow

- [ ] TikTok Overview values match selected persisted daily rows.
- [ ] Campaign Breakdown excludes unselected TikTok campaigns.
- [ ] Ad Comparison rankings use real selected TikTok rows, not hardcoded campaigns.
- [ ] Insights avoid revenue/ROAS/ROI claims until TikTok revenue exists.
- [ ] No-row state is unavailable, not zero-filled.

### Multi-Source Flow

- [ ] GA4 plus TikTok keeps GA4 web metrics and TikTok paid-media metrics separate.
- [ ] TikTok plus Google Ads adds paid-media metrics without duplicate platform rows.
- [ ] TikTok plus Meta/Facebook does not borrow Meta rows.
- [ ] TikTok plus Instagram does not borrow Instagram placement rows.
- [ ] Canonical spend source behavior does not double-count TikTok platform spend.

### Financial Flow

- [ ] TikTok spend-only campaign has no revenue/ROI/ROAS.
- [ ] TikTok attributed revenue source unlocks revenue/ROI/ROAS only for TikTok.
- [ ] Exact selected TikTok campaign ID mapping populates per-campaign revenue.
- [ ] Unmapped revenue remains aggregate-only or unavailable according to the implemented source contract.
- [ ] GA4/LinkedIn/Google Ads/Meta/Instagram revenue does not unlock TikTok financial metrics.

### Scheduler, Reports, And Lifecycle Flow

- [ ] Manual refresh updates selected persisted TikTok rows.
- [ ] Scheduler refresh fails closed on missing or invalid TikTok source state.
- [ ] Scheduled snapshots include TikTok through `performanceSummary`.
- [ ] Browser PDFs use latest TikTok source-backed values.
- [ ] Scheduled report failed sends do not create misleading sent snapshots.
- [ ] Disconnect hides TikTok and removes only current-campaign TikTok rows.
- [ ] Reconnect cannot resurrect stale TikTok rows.

## Production-Ready Exit Criteria

TikTok can be marked locally/test-mode production-ready only when:

- Create Campaign TikTok setup is validated.
- Connected Platforms TikTok add-source setup is validated.
- TikTok analytics reads selected persisted rows only.
- Campaign DeepDive consumes TikTok through the shared aggregate contract.
- TikTok revenue/spend/ROI/ROAS use TikTok-scoped provenance only.
- KPI and Benchmark current values use source-backed TikTok values.
- Insights and Reports do not invent unavailable metrics.
- Scheduler refresh and scheduler snapshots use the same selected-source contract as the UI.
- Disconnect/reconnect is campaign-scoped and stale-data safe.
- Regression coverage protects the critical lifecycle paths.
- Local/browser validation evidence is recorded.

Live TikTok OAuth/provider production readiness remains deferred until Commit 15 evidence is recorded.

## Relevant Documentation

- `AGENTS.md`
- `ARCHITECTURE_USER_JOURNEY.md`
- `GA4/README.md`
- `GA4_DEVELOPMENT_WORKFLOW.md`
- `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_BUDGET_FINANCIAL_ANALYSIS_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_PLATFORM_COMPARISON_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_CUSTOM_REPORT_PRODUCTION_READY.md`
- `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `META_FACEBOOK_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `INSTAGRAM_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- TikTok Business API reporting documentation
- TikTok Ads Manager metric documentation

## Latest Validation

- Commit 1 documentation was created locally.
- Commit 2 provider/source-contract documentation was created locally.
- `git status --short` was checked before editing, as required.
- Current TikTok code-path inventory was traced with local search.
- No runtime code was changed.
- Live OAuth/provider validation is deferred.
