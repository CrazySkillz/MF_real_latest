# Campaign DeepDive Executive Summary Production Readiness

## Purpose

Track the outstanding work required to make the Campaign DeepDive `Executive Summary` section production ready.

The intended product behavior is:

- `Connected Platforms` shows which campaign-scoped main data sources are attached.
- `Executive Summary` uses only metrics currently available from those connected main sources.
- If only GA4 is connected, Executive Summary uses only GA4-capable metrics such as sessions, users, conversions, revenue, engagement, and valid campaign financial totals where available.
- Revenue and spend sources connected inside a platform, such as Salesforce, HubSpot, Shopify, CSV, or Google Sheets imports inside GA4, are platform child inputs. Users do not connect these as separate main `Connected Platforms`; they can only feed financial totals through the parent platform/campaign financial path.
- As main Connected Platforms such as GA4, LinkedIn, Meta, Google Ads, Google Sheets, Custom Integration, TikTok, Instagram, and future integrations are connected, their available metrics must be automatically included in the executive narrative without double-counting.
- Campaign DeepDive subsections should fetch and aggregate main metrics from all main sources shown in the campaign `Connected Platforms` section. They should not require users to create duplicate revenue/spend inputs inside Campaign DeepDive for child systems already configured within a parent platform.
- The section should provide a marketing-executive-ready campaign-wide narrative and recommendation layer, not another platform-specific drilldown.

## Required Architecture

Preserve the documented split in `ARCHITECTURE_USER_JOURNEY.md`:

- `Connected Platforms` = source-level campaign inputs.
- `View Detailed Analytics` = platform-specific drilldown.
- `Campaign DeepDive` = campaign-wide cross-platform analysis.
- `Executive Summary` = executive narrative, risk, trajectory, funnel, and strategic recommendation layer based on connected-source data.

Do not turn Executive Summary into another platform-specific page.
Do not duplicate aggregation logic across tabs.
Do not invent unavailable metrics for sources that do not provide them.
Do not display platform child revenue/spend inputs as separate main platforms.
Do not produce paid-media recommendations when no connected main paid-media source provides the required spend, click, impression, conversion, or revenue inputs.

## Current Root Cause

`client/src/pages/executive-summary.tsx` fetches `/api/campaigns/:id/executive-summary`.

`server/routes-oauth.ts` builds that endpoint through a separate legacy aggregation path instead of consuming the shared connected-source aggregate used by the other Campaign DeepDive subsections.

Current implementation issues:

- the endpoint independently fetches LinkedIn, Meta, GA4, Custom Integration, and canonical spend/revenue data
- source inclusion is hard-coded instead of driven by `performanceSummary.sources`
- totals for impressions, clicks, and conversions are manually summed from LinkedIn, Meta, and Custom Integration, while GA4 is mostly treated as a separate website analytics display block
- GA4 is explicitly assigned `spend: 0`, `revenue: 0`, `roas: 0`, and `roi: 0` in the platform display model even when the shared aggregate can contain GA4/campaign revenue and financial totals
- paid-media labels such as `Impressions`, `Clicks`, `CTR`, `CPC`, and paid-media recommendations can render even when GA4 is the only connected main source
- before Commit 1, the endpoint read the campaign with `storage.getCampaign(id)` instead of using the standard campaign access guard
- historical trajectory uses legacy comparison data and conversion-derived revenue estimates instead of compatible aggregate snapshots
- Google Ads and future generic main sources can be missed unless they are manually added to this endpoint
- platform child revenue/spend inputs can affect totals without clear aggregate provenance

The issue is an aggregation contract problem, not a single-card display bug.

## Existing Relevant Paths

- `client/src/pages/executive-summary.tsx`
  - Current Executive Summary page and tab UI.
  - Renders Executive Overview and Strategic Recommendations.
  - Assumes the endpoint returns already-composed metrics, platform rows, risk, recommendations, KPI progress, and benchmark comparison.

- `server/routes-oauth.ts`
  - Contains `/api/campaigns/:id/executive-summary`.
  - Contains `/api/campaigns/:id/outcome-totals`, which returns `performanceSummary`.
  - Contains snapshot comparison routes used by other DeepDive sections.

- `server/utils/executive-summary-helpers.ts`
  - Current helper functions for health scoring, risk assessment, and strategic recommendations.
  - Currently assumes paid-media-style platform inputs and zero-valued missing metrics.

- `server/utils/performance-summary-aggregate.ts`
  - Current connected-source aggregate helper.
  - Contains source identity, capabilities, included metrics, excluded metric reasons, financial totals, and derived metrics.

- `server/scheduler.ts`
  - Scheduler snapshots include `metrics.performanceSummary`.
  - Compatible snapshot reads should use the same aggregate version before comparing historical values.

- `server/storage.ts`
  - Storage-layer access for campaign sources, GA4, LinkedIn, Meta, Google Ads, revenue, spend, Custom Integration, KPIs, Benchmarks, and snapshots.

## Production-Ready Target Contract

Executive Summary should consume one campaign-level aggregate contract.

The safest fix is to reuse `/api/campaigns/:id/outcome-totals` and `outcomeTotals.performanceSummary` as the source-of-truth for current connected-source metrics.

The Executive Summary response should include:

- campaign ID and selected period
- connected main sources included in the executive summary
- source capabilities and included metrics
- excluded metrics with reasons
- source freshness metadata
- aggregate current totals
- per-source main platform breakdown
- KPI and Benchmark progress from campaign-level records
- risk assessment based only on available inputs
- health score based only on available inputs
- strategic recommendations generated only from valid metric/source combinations
- historical trajectory only from compatible aggregate snapshots, when enough history exists

Preferred approach:

- Keep the existing `/api/campaigns/:id/executive-summary` endpoint so the frontend route contract remains stable.
- Inside that endpoint, resolve campaign access with `ensureCampaignAccess`.
- Compose Executive Summary from `performanceSummary.sources` and `performanceSummary.totals`.
- Exclude `category: "financial"` sources from main platform rows.
- Use financial child inputs only as provenance or contributors to aggregate spend/revenue totals, not as main Connected Platforms.
- Preserve the existing response shape where possible, adding metadata if needed for unavailable reasons and aggregate version.
- Keep API composition in `server/routes-oauth.ts`.
- Keep persistence reads in `server/storage.ts`.
- Keep tab rendering in `client/src/pages/executive-summary.tsx`.
- Move reusable Executive Summary aggregate formatting into `server/utils/executive-summary-helpers.ts` only if it keeps the route smaller without introducing a new architecture.

## Source Capability Rules

### GA4

Available when connected and campaign-scoped:

- users
- sessions
- pageviews or screen page views where available
- conversions
- engagement rate or bounce-rate-derived engagement where already supported
- revenue as the GA4/campaign financial path supports it
- ROI/ROAS only when valid campaign revenue and spend are both available from the aggregate

Not available:

- ad impressions
- ad clicks
- ad spend as a GA4-native platform metric
- CPC
- CPM
- CTR
- paid-media CPA from GA4 alone unless required campaign spend and conversion inputs are available through the aggregate
- paid-media platform optimization or reallocation recommendations

### Paid Media Sources

Examples:

- LinkedIn Ads
- Meta Ads
- Google Ads
- future TikTok/Instagram ad sources

Available when connected, campaign-scoped, and refreshed:

- impressions
- clicks
- spend
- conversions
- attributed revenue where the source has a validated revenue path
- CTR, CPC, CPM, CPA, ROAS, and ROI only when required inputs are available

Not available:

- sessions or users unless explicitly provided as web analytics metrics

### Custom Integration

Available metrics depend on the mapped custom source fields.

Rules:

- include only mapped metrics that are present and campaign-scoped
- do not assume Custom Integration is a paid-media source unless it provides spend, clicks, or impressions
- do not double-count Custom Integration web metrics when GA4 is the primary web analytics source unless explicitly configured as non-overlapping

### Platform Child Revenue/Spend Inputs

Examples:

- HubSpot inside GA4
- Salesforce inside GA4
- Shopify inside GA4
- CSV revenue/spend imports inside GA4
- Google Sheets revenue/spend imports inside GA4
- LinkedIn or Meta spend imported inside GA4

Rules:

- may feed campaign financial totals through the parent platform/campaign financial path
- must not appear as separate main platforms
- must not create paid-media recommendation eligibility unless the ad platform is connected as its own main Connected Platform
- may be referenced as financial provenance if a future Executive Summary UI section explicitly displays source inputs

## Aggregation Rules

- Aggregate only sources connected to the current campaign.
- Aggregate only metrics that are available from each connected source.
- Preserve unavailable as unavailable, not zero.
- Use zero only when a connected source supports the metric and the actual value is zero.
- Paid-media metrics such as impressions, clicks, spend, and paid conversions can be additive across non-overlapping paid platforms.
- GA4 should be treated as the primary web analytics source when connected.
- Spend should use the aggregate campaign spend rule already proven in `/outcome-totals`.
- Revenue should use the aggregate campaign revenue rule already proven in `/outcome-totals`.
- ROAS, ROI, CPA, CPC, CTR, CPM, and CVR should be derived only when their numerator and denominator are available and valid.
- Health, risk, and recommendations must not penalize missing unavailable metrics as failed metrics.
- Do not use Pipeline Proxy data for Executive Summary totals.

## Tab Requirements

### Executive Overview

Target behavior:

- Uses `performanceSummary.totals` for current metrics.
- Shows only connected-source-available funnel stages.
- GA4-only campaigns show a web analytics/outcome funnel, not a paid-media funnel.
- The Marketing Funnel Performance chart should make the active path explicit: reach metric -> engagement metric -> conversions -> revenue. For GA4-only campaigns this should read as users/sessions/conversions/revenue; for paid-media campaigns it can read as impressions/clicks/conversions/revenue when those metrics are available.
- The separate Campaign Story paragraph should not render below the funnel because it duplicates values already shown in the narrative, funnel, and key metric cards.
- Paid-media Top of Funnel and Mid Funnel blocks appear only when connected sources provide impressions or clicks.
- Revenue, spend, ROI, ROAS, CPA, CPC, CTR, and CVR display unavailable when required aggregate inputs are missing.
- Platform detail belongs in the dedicated Platform Comparison subsection; Executive Summary should not render the duplicate Platform Performance card.
- Financial child inputs do not appear as separate platform rows.
- Campaign Grade and Health Score are not shown in the Executive Summary UI because the score/grade model is a product-defined heuristic, not a direct connected-source metric.
- The narrative Executive Summary paragraph should not use hidden grade/score logic. It should state factual available connected-source ROI/ROAS inputs from the same `performanceSummary` aggregate used by the visible Executive Overview metrics, plus current Risk Level and 7-day snapshot trajectory state.
- Risk Assessment distinguishes analytics-only source concentration from paid-media spend concentration.
- KPI Progress and Benchmark Comparison use campaign-level records for rows and targets, but current values must come from mapped live `performanceSummary.totals` aggregate metrics. Unmapped or unavailable current values are excluded from Executive Summary instead of falling back to saved current snapshots.

Executive trajectory and risk rules:

- Campaign Grade and Health Score should not render in the Executive Summary UI. The backend response may still include them to preserve the existing API contract, but the executive-facing surface should not ask users to interpret a heuristic score as an analytics fact.
- The visible Executive Summary paragraph is generated in the page from the same `performanceSummary` object used by the ROI/ROAS cards. It should not render stale `ceoSummary` ROI/ROAS values from a different endpoint aggregate, and it should not say `performing exceptionally`, `strong results`, or `recommend increased investment` from hidden score/grade logic.
- `7-Day Snapshot Trajectory` compares available revenue from compatible `metrics.performanceSummary` snapshots: latest snapshot versus roughly seven days earlier. `Accelerating` means revenue increased by more than 10%; `Declining` means revenue decreased by more than 10%; otherwise `Stable`. If compatible history is missing, the UI shows `Not enough history`.
- Risk Level starts as `Low`. It becomes `High` when available `ROI < 0%` or a connected-source data freshness warning is high severity. It becomes `Medium` when available `ROAS < 1x`, one paid advertising platform is the only paid source, one paid platform has more than 70% spend share, compatible trajectory is declining by more than 15%, one or more aggregate-backed KPI rows are below 70% of target, one or more Benchmark rows are below 70% of benchmark, or connected-source data freshness has a medium-severity warning. GA4-only analytics is not a paid-platform concentration risk.
- Risk Assessment must clearly state what was checked and must not imply that every possible campaign risk was evaluated. Low-risk empty states should say no configured risk factors were identified from available connected-source inputs, not that the whole campaign is operating within acceptable parameters.
- Risk Assessment checked inputs should visibly disclose available ROI, available ROAS, paid-platform concentration, compatible 7-day trajectory state, and that budget pacing is handled in Budget & Financial Analysis until a shared pacing signal is available in Executive Summary.
- Budget pacing issues remain in Budget & Financial Analysis and do not raise Executive Summary Risk Level until a shared campaign pacing contract is added to this endpoint.

Required regression coverage:

- GA4-only campaign renders GA4-capable metrics only.
- GA4-only campaign does not show paid-media clicks, impressions, CTR, CPC, CPM, or paid-media CPA as zero-valued available metrics.
- GA4-only campaign lists Google Analytics as the main source and does not list child revenue/spend inputs as platforms.
- Multi-paid-source campaign still renders comparable paid-media metrics.
- Missing aggregate inputs render unavailable states, not zeros.

### Strategic Recommendations

Target behavior:

- Recommendations use `performanceSummary.sources`, source categories, included metrics, and aggregate metric availability.
- Paid-media budget reallocation requires at least two comparable main paid-media sources with valid spend and efficiency inputs.
- Paid-media scaling recommendations require available spend, revenue, ROI/ROAS, and non-declining compatible trajectory where applicable.
- GA4-only campaigns do not produce paid-media budget reallocation, paid creative optimization, or platform diversification recommendations framed as ad-spend advice.
- GA4-only campaigns may produce web/outcome recommendations when sessions, users, conversions, revenue, or CVR are available.
- If inputs are insufficient, the tab should show a clear no-recommendations or insufficient-source-coverage state.
- Recommendation scenarios and projected impacts must state assumptions and avoid claims based on unavailable metrics.

Required regression coverage:

- GA4-only campaign produces no paid-media recommendation.
- GA4-only campaign can produce web/outcome guidance only from available GA4 metrics.
- One paid-media source does not produce reallocation guidance.
- Two comparable paid-media sources can produce reallocation guidance when values support it.
- Revenue-without-spend avoids paid efficiency claims.
- Spend-without-revenue avoids ROAS/ROI claims.

## Backend Tasks

- Add campaign access guarding to `/api/campaigns/:id/executive-summary`.
- Reuse or compose the shared `/outcome-totals` aggregate logic for the endpoint.
- Replace hard-coded LinkedIn, Meta, GA4, and Custom Integration current-value aggregation with `performanceSummary.totals`.
- Replace hard-coded platform display construction with rows derived from `performanceSummary.sources`.
- Exclude financial child sources from main platform rows.
- Preserve the current response shape where safe, but add aggregate metadata and unavailable reasons if needed.
- Update `server/utils/executive-summary-helpers.ts` so health, risk, and recommendations use available-input semantics instead of zero fallback semantics.
- Ensure Google Ads and future `platformSources` appear automatically once they are present in `performanceSummary.sources`.
- Ensure child revenue/spend inputs feed only aggregate financial totals and provenance.

## Historical And Snapshot Tasks

- Replace legacy trajectory comparison with compatible `metrics.performanceSummary.version` snapshot comparison.
- Do not compare against legacy snapshots that lack `metrics.performanceSummary`.
- Show no trajectory when compatible history is unavailable.
- Do not estimate current or previous revenue from conversions when aggregate revenue is unavailable.
- Keep manual and scheduler snapshot creation on the existing `aggregateCampaignMetrics` path.

## Frontend Tasks

- Keep the existing Executive Summary route and tab layout.
- Remove hard-coded paid-media-only labels where the aggregate says the metric is unavailable.
- Render unavailable states for unavailable aggregate metrics.
- Keep platform-level metric comparison in Platform Comparison; do not duplicate those rows in Executive Summary.
- Do not render the separate Campaign Story paragraph below the funnel.
- Update Executive Overview funnel wording for GA4-only and analytics-only cases.
- Update Strategic Recommendations empty states and explanatory copy.
- Remove visible demo controls from the production page if final production-readiness scope includes UI consistency with the other DeepDive subsections.
- Refetch current values while visible and on window focus, matching Performance Summary, Budget & Financial Analysis, and Platform Comparison.

## Testing Plan

Targeted tests to add or update:

- Executive Summary endpoint or helper test for GA4-only campaign.
- Executive Summary endpoint or helper test for multi-paid-source campaign.
- Executive Summary endpoint or helper test proving child financial inputs do not appear as main platform rows.
- Executive Summary endpoint or helper test proving paid-media recommendations require valid paid-media inputs.
- Executive Summary endpoint or helper test proving health score ignores unavailable metrics instead of treating them as zero.
- Executive Summary snapshot compatibility test for trajectory.
- UI regression proving GA4-only pages do not render unavailable paid-media metrics as available zeroes.
- Access guard regression proving the route uses campaign access checks.

Validation commands after implementation:

- `npm test -- server/executive-summary-regression.test.ts`
- targeted scheduler/snapshot regression tests if trajectory logic changes
- `npm run check`
- `npm run build`

## Bundled Implementation Plan

Use this sequence to keep commits small enough to validate safely.

Do not start a later commit until the current commit has targeted regression coverage and its documented validation has passed.

### Commit 1: Aggregate Contract And Access Guard

Status: Completed locally.

Goal:

- Make the Executive Summary endpoint consume the same connected-source aggregate contract used by the other Campaign DeepDive sections.

Scope:

- Completed: Guarded `/api/campaigns/:id/executive-summary` with `ensureCampaignAccess`.
- Completed: Built a `performanceSummary` aggregate inside the endpoint using the shared `buildPerformanceSummaryAggregate` helper.
- Completed: Resolved current revenue, spend, conversions, impressions, clicks, ROI, ROAS, CTR, CVR, CPC, and CPA from `performanceSummary.totals`.
- Completed: Resolved main platform display rows from `performanceSummary.sources`.
- Completed: Excluded `category: "financial"` from main platform rows.
- Completed: Added `performanceSummary` and `metadata.aggregateVersion` to the response as additive fields.
- Completed: Added regression coverage for the access guard, aggregate current values, main source rows, financial child-source exclusion, and the GA4 zero-row regression risk.
- Completed follow-up: Meta daily rows and Meta freshness warnings are now gated by a real connected main Meta platform, so stale legacy Meta rows do not appear in GA4-only Executive Summary validation.
- Completed follow-up: Exact GA4-context revenue-source breakdowns are passed into the aggregate as `revenueSources`, so financial child-source provenance can appear in `performanceSummary.sources` when active child revenue sources exist.

Files changed:

- `server/routes-oauth.ts`
- `server/executive-summary-regression.test.ts`

Validation:

- Passed: `npm test -- server/executive-summary-regression.test.ts`
- Passed: `npm run check`
- Passed: `npm run build` after rerunning outside the sandbox because the first sandboxed Vite/esbuild build failed with `spawn EPERM`.
- Follow-up validation passed after connected-platform GA4 source alignment: `npm test -- server/executive-summary-regression.test.ts`, `npm run check`, and `npm run build` after rerunning outside the sandbox because the first sandboxed Vite/esbuild build failed with `spawn EPERM`.
- Follow-up validation passed: `npm test -- server/executive-summary-regression.test.ts`
- Follow-up validation passed: `npm run check`
- Follow-up validation passed: `npm run build` after rerunning outside the sandbox because the first sandboxed Vite/esbuild build failed with `spawn EPERM`.
- User validation passed: GA4-only Executive Summary no longer returned stale Meta/Facebook freshness warnings, and active financial child-source provenance appeared in `performanceSummary.sources` with `category: "financial"`.

Why this is first:

- Every visible Executive Summary tab depends on the backend response. The response must be source-correct before UI copy or recommendation logic can be trusted.

### Commit 2: Executive Overview Tab

Status: Completed locally.

Goal:

- Make Executive Overview display only connected-source-available metrics.

Scope:

- Render aggregate-backed metrics and unavailable states.
- Make the funnel source-capability aware.
- Make GA4-only campaigns show web analytics/outcome metrics instead of paid-media assumptions.
- Keep KPI Progress and Benchmark Comparison stable unless a traced bug requires a narrow fix; traced stale-source issues now require both sections to use the shared aggregate for current values when records map to available aggregate metrics.
- Add regression coverage for GA4-only unavailable paid-media metrics and multi-source available metrics.

Root cause:

- The backend response now includes aggregate availability through `performanceSummary.totals`, but `client/src/pages/executive-summary.tsx` still rendered Executive Overview current-value surfaces from legacy `metrics` fields and hard-coded paid-media labels.
- In GA4-only campaigns, the tab could therefore display paid-media-style impressions, clicks, CTR, CPC, ROAS, ROI, or funnel copy as available values even when the aggregate correctly marked those metrics unavailable.
- The smallest safe fix for the initial Overview values was frontend-only: keep the response contract stable, keep the existing layout, and choose visible Overview metrics from aggregate availability while leaving health, risk, recommendations, KPI progress, and benchmark comparison to their planned commits.

Completed:

- Added frontend aggregate availability helpers for the Executive Overview tab.
- Switched the top funnel, mid funnel, bottom funnel, and key metric cards to render aggregate-backed available values or `Unavailable`; the separate Campaign Story paragraph has been removed from the UI.
- GA4-only campaigns now prefer web analytics metrics such as users or sessions when paid-media impressions or clicks are unavailable.
- Left KPI Progress, Benchmark Comparison, health, risk, and Strategic Recommendations unchanged in the initial Overview commit; KPI Progress and Benchmark Comparison were later corrected after stale saved current values were traced.
- Added regression coverage that proves the Overview tab uses `performanceSummary.totals` availability and no longer renders the legacy hard-coded impressions, clicks, or revenue expressions.
- Follow-up root cause: the Overview tab was reading the aggregate correctly, but `/api/campaigns/:id/executive-summary` still prepared GA4 and financial aggregate inputs with a simpler path than `/api/campaigns/:id/outcome-totals`. That caused users, sessions, conversions, revenue, ROAS, and ROI to diverge from the shared DeepDive aggregate source truth.
- Follow-up completed: Executive Summary now resolves GA4 current values through the same GA4 source-truth path, keeps persisted GA4 daily rows as fallback, and uses to-date spend/revenue financial provenance when building the aggregate.
- Follow-up correction: the user-facing Connected Platforms GA4 card uses `/api/campaigns/:id/ga4-metrics` and `ga4Service.getMetricsWithAutoRefresh`; Executive Summary now uses that same connected-platform metric source for GA4 users, sessions, and conversions instead of the separate acquisition/simulation path.
- Source-of-truth correction: the Executive Summary page now fetches `/api/campaigns/:id/outcome-totals` directly and uses `outcomeTotals.performanceSummary` for visible Executive Overview metrics, matching the proven connected-source aggregate consumed by the other Campaign DeepDive subsections.
- Removed the Executive Summary period dropdown and fixed the page's aggregate request to the daily connected-source `90days` window so visible records are no longer changed by a local subsection date selector.
- Funnel clarity correction: Marketing Funnel Performance now labels the active connected-source path and asks the business question each stage answers: whether enough people reached the campaign/site, whether they engaged through clicks or sessions, and whether visits became conversions and revenue.
- User validation passed: Executive Overview conversion display now shows the exact connected-source count and regression coverage proves the value is not hard-coded.
- UI simplification: Campaign Grade and Health Score were removed from the visible Executive Overview because they were heuristic score/grade fields rather than direct connected-source metrics.
- Narrative correction: the visible Executive Summary paragraph now renders factual ROI/ROAS from the same `performanceSummary` aggregate used by the visible metric cards, plus Risk Level and 7-day snapshot trajectory state, instead of rendering stale endpoint `ceoSummary` values.
- UI simplification: the Campaign Story paragraph was removed because it duplicated narrative, funnel, and key metric values.
- UI simplification: the Platform Performance card was removed because it duplicated the dedicated Platform Comparison subsection and could show misleading paid-media-style row status labels for GA4-only campaigns.
- KPI Progress source-of-truth correction: KPI current values now use only the same live `performanceSummary.totals` aggregate as the visible Executive Summary metric cards. Unmapped or unavailable KPI current values are excluded from Executive Summary KPI Progress instead of silently falling back to saved KPI progress/current values.
- KPI Progress rendering correction: the Executive Summary page now recalculates mapped KPI current values, progress percentages, and statuses from the same page-level `performanceSummary` object used by the visible metric cards, so it cannot drift from `/api/campaigns/:id/outcome-totals`.
- KPI Progress UI correction: Executive Summary KPI progress bars and status labels now follow the campaign-level KPI status scheme: `Above Target` in green when more than 5% above target, `On Track` in blue when within +/-5% of target, and `Below Target` in red when more than 5% below target. Priority badges such as `medium` no longer render beside KPI names.
- KPI Progress freshness correction: campaign-level KPI create, update, and delete actions now invalidate the campaign Executive Summary query so Executive Summary KPI Progress refetches the campaign KPI list/targets after KPI changes in the same app session.
- Benchmark Comparison source-of-truth correction: campaign-level Benchmark records now define Executive Summary Benchmark Comparison rows and targets, but `Yours` current values use only mapped live `performanceSummary.totals` aggregate values. Unmapped or unavailable benchmark current values are excluded instead of falling back to saved Benchmark `currentValue` snapshots.
- Benchmark Comparison freshness correction: campaign-level Benchmark create, update, and delete actions now invalidate the campaign Executive Summary query so Benchmark Comparison refetches the campaign Benchmark list/targets after Benchmark changes in the same app session.
- Benchmark Comparison UI correction: Executive Summary Benchmark Comparison now follows the campaign-level Benchmark color buckets: green for `On Track` at 90% or more of benchmark, yellow for `Needs Attention` from 70% to under 90%, and red for `Behind` below 70%.
- Benchmark Comparison frontend correction: the visible Executive Summary page now recalculates Benchmark Comparison `Yours`, delta, and status from the same page-level `performanceSummary` object used by the visible metric cards, so it cannot render stale endpoint benchmark values after `/api/campaigns/:id/outcome-totals` has the current aggregate.
- User validation passed: campaign-level Benchmark create/update changes feed Executive Summary Benchmark Comparison through the campaign Executive Summary refetch path, while visible `Yours` values remain sourced from the live connected-source aggregate.
- KPI Progress saved-history correction was superseded by removing saved progress/current fallback reads from Executive Summary KPI Progress.

Files changed:

- `client/src/pages/executive-summary.tsx`
- `client/src/pages/campaign-detail.tsx`
- `server/executive-summary-regression.test.ts`
- `ARCHITECTURE_USER_JOURNEY.md`
- `GA4/README.md`
- `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md`

Validation:

- Passed: `npm test -- server/executive-summary-regression.test.ts`
- Passed: `npm run check`
- Passed: `npm run build` after rerunning outside the sandbox because the first sandboxed Vite/esbuild build failed with `spawn EPERM`.

Why this is second:

- It fixes the primary visible current-value surface before recommendations consume those values.

### Commit 3: Health, Risk, And Trajectory

Status: Completed.

Goal:

- Ensure executive health and risk labels are based on available aggregate inputs and compatible history.

Scope:

- Update health scoring so unavailable metrics are not treated as failures.
- Update risk assessment so GA4-only is not called a single advertising-platform risk.
- Use compatible `metrics.performanceSummary` snapshots for trajectory only when available.
- Add regression coverage for unavailable inputs, analytics-only sources, and incompatible snapshots.

Root cause:

- Health and risk received numeric zeroes for unavailable aggregate metrics, so missing CTR, ROAS, ROI, or CVR could be scored as poor performance instead of ignored as unavailable.
- Historical trajectory used legacy `totalConversions` comparison snapshots and estimated revenue from the current revenue-per-conversion ratio, which could mix incompatible snapshot contracts.

Completed:

- Health scoring now uses only aggregate metrics marked available and normalizes the score across available weights.
- Risk assessment now ignores unavailable ROI/ROAS instead of treating them as zero-value performance risks.
- Low-risk explanation now says no significant risk factors were identified from available connected-source inputs, rather than broadly claiming the campaign is performing well.
- GA4-only analytics sources are not treated as a single advertising-platform concentration risk.
- Trajectory is calculated only from compatible `metrics.performanceSummary` snapshots with matching aggregate versions and available revenue values.
- The trajectory UI labels this as a 7-day snapshot trajectory and clarifies that it comes from compatible aggregate snapshots, not from the removed date selector.
- New campaigns without enough compatible snapshot history show `Not enough history` instead of hiding the trajectory area.
- Added helper and route regression coverage for unavailable inputs, GA4-only risk, and incompatible legacy trajectory inputs.

Files changed:

- `server/utils/executive-summary-helpers.ts`
- `server/routes-oauth.ts`
- `server/executive-summary-regression.test.ts`
- `server/executive-summary-helpers-regression.test.ts`
- `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md`

Validation:

- Passed: `npm test -- server/executive-summary-regression.test.ts server/executive-summary-helpers-regression.test.ts`
- Passed: `npm run check`
- Passed: `npm run build` after rerunning outside the sandbox because the first sandboxed Vite/esbuild build failed with `spawn EPERM`.
- Latest UI simplification validation passed with the same focused regression, TypeScript, whitespace, and production build checks. The regression now asserts that Campaign Grade, Health Score, Campaign Story, Platform Performance, Website Analytics Only, and row-level paid-media status labels do not render in Executive Overview.
- KPI Progress aggregate-source regression now asserts mapped KPI aliases such as Total Users, Revenue, Total Conversions, and ROAS resolve to `performanceSummary.totals`, and saved progress/current fallback reads are not used.
- KPI Progress frontend regression now asserts the rendered KPI current value/status path uses page-level aggregate values instead of stale `executiveSummary.kpiProgress` current/status fields for mapped KPI metrics.
- KPI Progress UI regression now asserts Executive Summary uses campaign-level KPI status labels and red/blue/green progress bar colors, and does not render KPI priority badges beside metric names.
- KPI Progress freshness regression now asserts the Executive Summary endpoint reads campaign-level KPIs through `storage.getCampaignKPIs(id)` and campaign-level KPI create/update/delete success handlers invalidate the campaign Executive Summary query.
- Benchmark Comparison regression now asserts the Executive Summary endpoint reads campaign-level Benchmarks through `storage.getCampaignBenchmarks(id)`, uses only mapped aggregate values for `Yours`, does not read saved Benchmark `currentValue`, and campaign-level Benchmark create/update/delete success handlers invalidate the campaign Executive Summary query.
- Benchmark Comparison UI regression now asserts Executive Summary uses the same green/yellow/red status buckets as campaign-level Benchmarks.
- Benchmark Comparison frontend regression now asserts the rendered Benchmark Comparison values and status are recalculated from page-level aggregate values rather than stale endpoint `benchmarkComparison` current/status fields.
- User validation passed for the Benchmark Comparison feed/refetch path from campaign-level Benchmarks into Executive Summary.
- Best live validation path: use a newly connected mock-live GA4 campaign to prove the initial Executive Summary state. Current connected-source metrics should populate immediately from GA4, while `7-Day Snapshot Trajectory` should show `Not enough history` until compatible `performanceSummary` snapshots exist for both the latest point and roughly seven days earlier. Existing mock campaigns can prove UI wiring, but they may already have legacy or seeded snapshot history that is less useful for validating the new-campaign trajectory state.
- Timing rationale: Risk Level should populate immediately from current available connected-source inputs because it is a current-state risk assessment. Trajectory should use a 7-day snapshot window because 1-2 day comparisons are too noisy for an executive signal, while 30-day comparisons are too slow for an at-a-glance Executive Summary. Outstanding live validation remains: connect a new mock-live GA4 campaign and confirm current values and Risk Level populate immediately, while `7-Day Snapshot Trajectory` shows `Not enough history` until compatible snapshot history exists.

Why this is third:

- Health and risk are executive-facing summaries; they must not imply precision when the source inputs are unavailable.

### Commit 3A: Risk Assessment Production Readiness

Status: Completed.

Goal:

- Make the Risk Assessment section clear, bounded, and complete enough for executive use.

Scope:

- Replace broad low-risk copy such as `Campaign is operating within acceptable parameters` with precise wording: no configured risk factors were identified from available connected-source inputs.
- Add visible context for what Risk Assessment checked: available ROI, available ROAS, paid-platform concentration, and compatible 7-day trajectory when enough history exists.
- Decide and document whether KPI misses should raise Risk Level, appear as risk factors, or remain only in KPI Progress.
- Decide and document whether Benchmark misses should raise Risk Level, appear as risk factors, or remain only in Benchmark Comparison.
- Decide and document whether data freshness warnings should raise Risk Level or appear as separate risk factors.
- Decide and document whether budget pacing issues from Budget & Financial Analysis should raise Risk Level or stay in that subsection.
- Add regression coverage for low-risk copy, checked-input disclosure, KPI risk behavior, Benchmark risk behavior, stale-data risk behavior, and unavailable-input behavior.

Root cause:

- Commit 3 corrected unavailable-input handling and GA4-only concentration risk, but it did not define the full production-ready scope of Risk Assessment. The current low-risk UI can therefore sound broader than the backend logic proves.

Implemented:

- The API now returns `risk.checkedInputs` so the UI can show what Risk Assessment checked and what was unavailable or handled elsewhere.
- Low-risk UI copy now says no configured risk factors were identified from available connected-source inputs, instead of saying the campaign is operating within acceptable parameters.
- KPI rows below 70% of target add a medium risk factor.
- Benchmark rows below 70% of benchmark add a medium risk factor.
- Data freshness warnings add risk factors; high-severity freshness warnings raise Risk Level to high.
- Budget pacing remains explicitly out of Executive Summary Risk Assessment and belongs in Budget & Financial Analysis until a shared pacing signal is available.

Why this comes before recommendations:

- Strategic Recommendations should not consume or repeat a risk interpretation until the Risk Assessment section clearly defines which risk signals are in scope.

### Commit 4: Strategic Recommendations

Status: Not started.

Goal:

- Make recommendations source-capability safe.

Scope:

- Generate paid-media recommendations only from comparable paid-media main sources.
- Generate GA4/web recommendations only from available web/outcome metrics.
- Suppress ROAS, ROI, CPA, CPC, CTR, CPM, and CVR claims when required inputs are unavailable.
- Add regression coverage for GA4-only, one paid source, two paid sources, spend-without-revenue, and revenue-without-spend cases.

Why this is fourth:

- Recommendation logic is the highest-risk business interpretation layer and should only be changed after current values, health, risk, and history are source-correct.

### Commit 5: Refresh Stability And UI Consistency

Status: Not started.

Goal:

- Keep Executive Summary synchronized with source updates and avoid transient misleading content.

Scope:

- Refetch aggregate-backed Executive Summary values while visible and on window focus.
- Keep prior aggregate data during refetch where safe.
- Avoid flashing legacy or empty fallback content before aggregate-backed content is ready.
- Align tab presentation and production controls with the other DeepDive sections.
- Add regression coverage for query key, refetch behavior, and no paid-media fallback flash.

Why this is fifth:

- Once values are correct, refresh behavior must preserve trust during source updates and page reloads.

### Commit 6: Docs And Final Validation

Status: Not started.

Goal:

- Finalize documentation and prove the current Executive Summary scope is production ready.

Scope:

- Update `ARCHITECTURE_USER_JOURNEY.md` and GA4 docs if implementation clarifies Executive Summary behavior.
- Update this tracker with completed evidence for each commit.
- Run targeted Executive Summary tests.
- Run related scheduler/snapshot tests if historical trajectory changed.
- Run `npm run check`.
- Run `npm run build`.

Why this is last:

- Documentation should match the implemented behavior, and final validation should cover all previously changed paths together.

## Production-Ready Acceptance Criteria

Executive Summary is production ready only when:

- every visible current metric is sourced from the shared connected-source aggregate or a proven compatible contract
- every main platform row represents a main Connected Platform source from the aggregate contract
- platform child revenue/spend inputs do not appear as separate main platforms
- GA4-only campaigns show only GA4-capable metrics
- paid-media metrics require connected paid-media source inputs
- missing metrics are unavailable, not silently zeroed
- health and risk scoring account for unavailable inputs
- Risk Assessment clearly states what configured risk factors were checked and does not imply complete campaign safety when no configured risk factors fire
- Risk Assessment has explicit product rules and regression coverage for KPI misses, Benchmark misses, data freshness warnings, and budget pacing risk
- strategic recommendations are generated only from valid metric/source combinations
- paid-media budget reallocation requires comparable main paid-media sources
- historical trajectory uses compatible aggregate snapshots only
- current values stay synchronized with source updates
- regression coverage proves GA4-only, paid multi-source, financial child-source exclusion, recommendation gating, and access guard behavior
- documentation matches the implemented behavior

## Current Status

Not production ready. Commits 1, 2, 3, and 3A are completed, but recommendation gating and refresh stability remain outstanding.

Proven:

- Documentation requires Campaign DeepDive subsections to aggregate main Connected Platform metrics at the campaign level.
- The other completed DeepDive subsections use the shared `/api/campaigns/:id/outcome-totals` and `performanceSummary` aggregate pattern.
- Executive Summary still uses its existing endpoint, but Commit 1 now composes current metrics and source rows from the shared `performanceSummary` aggregate.
- Commit 2 now makes the Executive Overview tab choose visible current metrics from `performanceSummary.totals` availability.
- Commit 3 now makes health, risk, and trajectory use aggregate availability and compatible `performanceSummary` snapshots.
- Commit 3A now makes Risk Assessment bounded and explicit: it shows checked inputs, uses aggregate-backed KPI and Benchmark misses as risk factors, includes data freshness warnings as risk factors, and documents budget pacing as handled in Budget & Financial Analysis.
- Commit 1 replaced the endpoint's `storage.getCampaign(id)` campaign lookup with the standard campaign access guard.
- GA4-only campaigns are still at risk of showing paid-media recommendations until Commit 4 is completed.
- Risk Assessment currently proves the configured backend rules: available ROI below 0%, available ROAS below 1x, paid-platform concentration, compatible 7-day revenue decline, aggregate-backed KPI rows below 70% of target, Benchmark rows below 70% of benchmark, and connected-source data freshness warnings. Budget pacing remains in Budget & Financial Analysis until Executive Summary has a shared pacing input.

Partially reviewed:

- Executive Summary frontend rendering.
- Executive Summary backend endpoint.
- Executive Summary helper functions.
- Relationship to `performanceSummary` and compatible snapshots.

Unverified:

- Full deployed GA4-only behavior.
- Live multi-platform behavior.
- New mock-live GA4 validation for the initial no-history state: current metrics and Risk Level should populate immediately, while `7-Day Snapshot Trajectory` should show `Not enough history`.
- Complete historical trajectory behavior in deployed/live data after compatible snapshots exist for the latest point and roughly seven days earlier.
- Complete frontend regression coverage.
- Future standalone platforms beyond the current shared aggregate contract.
