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
- Unavailable clicks and impressions use concise executive-facing copy, `Unavailable from connected sources`; detailed source-specific unavailable reasons remain in the aggregate/API for diagnostics.
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
- Risk Assessment must clearly state which executive risk categories were evaluated and must not imply that every possible campaign risk was evaluated. Low-risk empty states should say no configured risk factors were identified from available connected-source inputs, not that the whole campaign is operating within acceptable parameters.
- Risk Assessment should use an executive-facing `Risk inputs` list, not technical checked-input cards. The list should show KPI Risk, Benchmark Risk, Data Freshness, ROI / ROAS Risk, 7-Day Trend Risk, and Paid Platform Concentration Risk.
- Risk Assessment visible risk-input values and KPI/Benchmark risk counts must be derived from the same page-level `performanceSummary` aggregate used by the visible Executive Summary cards, KPI Progress, and Benchmark Comparison. They must not display stale ROI/ROAS or saved KPI/Benchmark values from the `/executive-summary` endpoint when `/outcome-totals` has newer aggregate values.
- Risk Assessment should render a fixed executive-facing `Risk inputs` list with six rows: KPI Risk, Benchmark Risk, Data Freshness, ROI / ROAS Risk, 7-Day Trend Risk, and Paid Platform Concentration Risk. Rows that cannot be assessed should remain visible with `Not Applicable` or `Not Enough History` status so executives can see what was considered and why it did not affect risk.
- Risk Assessment input freshness depends on both `/api/campaigns/:id/executive-summary` and `/api/campaigns/:id/outcome-totals`. Both queries should refetch whenever the Executive Summary page mounts and when the browser window regains focus so KPI/Benchmark records, freshness warnings, trajectory state, paid-source rows, and live aggregate values can update after source or campaign changes.
- Budget pacing issues remain in Budget & Financial Analysis and do not raise Executive Summary Risk Level until a shared campaign pacing contract is added to this endpoint.

Required regression coverage:

- GA4-only campaign renders GA4-capable metrics only.
- GA4-only campaign does not show paid-media clicks, impressions, CTR, CPC, CPM, or paid-media CPA as zero-valued available metrics.
- GA4-only campaign lists Google Analytics as the main source and does not list child revenue/spend inputs as platforms.
- Multi-paid-source campaign still renders comparable paid-media metrics.
- Missing aggregate inputs render unavailable states, not zeros.

### Pre-Commit 4 Source Data And Refresh Map

After Commit 4, the implemented Executive Summary sections use these source paths:

| Executive Summary section | Source data | Refresh behavior |
| --- | --- | --- |
| Executive Summary paragraph | campaign name, page-level `performanceSummary` ROI/ROAS, Risk Level, and compatible snapshot trajectory | refetches `/executive-summary` and `/outcome-totals` on mount and window focus |
| 7-Day Snapshot Trajectory | compatible `metrics.performanceSummary` snapshots returned through `/executive-summary` | updates after compatible snapshots exist and `/executive-summary` refetches |
| Marketing Funnel Performance | page-level `/outcome-totals.performanceSummary.totals` | updates when `/outcome-totals` refetches |
| Key Metrics cards | page-level `/outcome-totals.performanceSummary.totals` | updates when `/outcome-totals` refetches |
| KPI Progress | campaign KPI rows from `/executive-summary`; current values from page-level `performanceSummary.totals` | KPI create/update/delete invalidates Executive Summary; page refetch updates rows and aggregate values |
| Benchmark Comparison | campaign Benchmark rows from `/executive-summary`; current values from page-level `performanceSummary.totals` | Benchmark create/update/delete invalidates Executive Summary; page refetch updates rows and aggregate values |
| Risk Assessment | fixed six risk inputs: KPI Risk, Benchmark Risk, Data Freshness, ROI / ROAS Risk, 7-Day Trend Risk, Paid Platform Concentration Risk | refetches `/executive-summary` and `/outcome-totals` on mount and window focus |
| Strategic Recommendations | `/executive-summary.recommendations` generated from `performanceSummary` source categories and aggregate metric availability; Website Outcomes visible values render from page-level `performanceSummary.totals` | refetches with `/executive-summary` and `/outcome-totals` on mount, window focus, and the active-tab interval; paid-media guidance requires paid-source and financial metric availability |

Root cause for Commit 4:

- The Executive Overview, funnel, KPI Progress, Benchmark Comparison, and Risk Assessment sections have been moved to the shared aggregate/source-aware pattern.
- Strategic Recommendations now use source-capability gating so GA4-only campaigns do not receive paid-media recommendations and recommendation claims do not use unavailable metrics.

### Strategic Recommendations

Target behavior:

- Recommendations use `performanceSummary.sources`, source categories, included metrics, and aggregate metric availability.
- Paid-media budget reallocation requires at least two comparable main paid-media sources with valid spend and efficiency inputs.
- Paid-media scaling recommendations require available spend, revenue, ROI/ROAS, and non-declining compatible trajectory where applicable.
- GA4-only campaigns do not produce paid-media budget reallocation, paid creative optimization, or platform diversification recommendations framed as ad-spend advice.
- GA4-only campaigns may produce web/outcome recommendations when sessions, users, conversions, revenue, or CVR are available.
- GA4-only web/outcome recommendations should show the actual available metrics: users, sessions, conversions, revenue, and conversion rate.
- GA4-only web/outcome recommendations should interpret the metrics, not only list them. Example: `Revenue is $88,893 from 392 conversions.`
- GA4-only web/outcome recommendations should state whether quality can be judged against an available KPI or Benchmark target. If no target exists, say the metric cannot be judged yet.
- GA4-only web/outcome recommendations should tie the recommendation to campaign goals before any paid spend decision. Example: `Before increasing paid spend, confirm whether this conversion rate and revenue are acceptable against campaign goals.`
- GA4-only web/outcome recommendations should give a clear next action. Example: `Next action: compare CVR and revenue against KPI/Benchmark targets, then inspect landing pages or conversion paths if below target.`
- GA4-only web/outcome recommendations must keep the paid-media boundary clear: do not recommend budget increases, ROAS, CPA, CPC, CTR, CPM, or channel allocation unless a paid-media source is connected.
- If inputs are insufficient, the tab should show a clear no-recommendations or insufficient-source-coverage state.
- Recommendation scenarios and projected impacts must state assumptions and avoid claims based on unavailable metrics.

Required regression coverage:

- GA4-only campaign produces no paid-media recommendation.
- GA4-only campaign can produce web/outcome guidance only from available GA4 metrics.
- GA4-only web/outcome guidance includes available metric values and states whether KPI/Benchmark targets exist for interpretation.
- GA4-only web/outcome guidance gives a specific next action without making paid-media claims.
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
- Executive-facing wording correction: unavailable clicks and impressions now render `Unavailable from connected sources` in the compact cards while raw aggregate unavailable reasons remain available for diagnostics.
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
- Add visible context for the six executive risk inputs: KPI Risk, Benchmark Risk, Data Freshness, ROI / ROAS Risk, 7-Day Trend Risk, and Paid Platform Concentration Risk.
- Decide and document whether KPI misses should raise Risk Level, appear as risk factors, or remain only in KPI Progress.
- Decide and document whether Benchmark misses should raise Risk Level, appear as risk factors, or remain only in Benchmark Comparison.
- Decide and document whether data freshness warnings should raise Risk Level or appear as separate risk factors.
- Decide and document whether budget pacing issues from Budget & Financial Analysis should raise Risk Level or stay in that subsection.
- Add regression coverage for low-risk copy, risk-input disclosure, KPI risk behavior, Benchmark risk behavior, stale-data risk behavior, and unavailable-input behavior.

Root cause:

- Commit 3 corrected unavailable-input handling and GA4-only concentration risk, but it did not define the full production-ready scope of Risk Assessment. The current low-risk UI can therefore sound broader than the backend logic proves.

Implemented:

- The API still returns `risk.checkedInputs` for compatibility, but the visible UI now renders the fixed six-row `Risk inputs` list instead of technical checked-input cards.
- Low-risk UI copy now says no configured risk factors were identified from available connected-source inputs, instead of saying the campaign is operating within acceptable parameters.
- KPI rows below 70% of target add a medium risk factor.
- Benchmark rows below 70% of benchmark add a medium risk factor.
- Data freshness warnings add risk factors; high-severity freshness warnings raise Risk Level to high.
- Visible Risk Assessment ROI/ROAS risk inputs, KPI risk counts, and Benchmark risk counts now use the page-level `performanceSummary` aggregate, matching the Executive Summary metric cards, KPI Progress, and Benchmark Comparison.
- The visible Risk Assessment list now uses the six executive risk inputs instead of technical checked-input cards, and it shows `Not Applicable` or `Not Enough History` where an input cannot currently affect risk.
- The Executive Summary page now explicitly refetches both `/executive-summary` and `/outcome-totals` on mount and window focus, so Risk Assessment updates when its upstream campaign records or connected-source aggregate inputs change before the user returns to the page.
- Budget pacing remains explicitly out of Executive Summary Risk Assessment and belongs in Budget & Financial Analysis until a shared pacing signal is available.

Why this comes before recommendations:

- Strategic Recommendations should not consume or repeat a risk interpretation until the Risk Assessment section clearly defines which risk signals are in scope.

### Commit 4: Strategic Recommendations

Status: Completed.

Goal:

- Make recommendations source-capability safe.

Scope:

- Generate paid-media recommendations only from comparable paid-media main sources.
- Generate GA4/web recommendations only from available web/outcome metrics.
- Suppress ROAS, ROI, CPA, CPC, CTR, CPM, and CVR claims when required inputs are unavailable.
- Add regression coverage for GA4-only, one paid source, two paid sources, spend-without-revenue, and revenue-without-spend cases.

Implemented behavior:

- The Executive Summary endpoint passes aggregate metric availability and source counts into `generateRecommendations`.
- Paid-media budget reallocation now requires at least two comparable paid-media rows with spend, revenue, and ROAS.
- Paid-media scaling, optimization, and diversification now require a connected paid-media source plus available spend, revenue, ROAS, ROI, and total spend.
- GA4-only campaigns can receive web/outcome guidance from available web analytics and outcome metrics, but cannot receive paid-media budget, platform, or ROAS/ROI claims.
- GA4-only web/outcome guidance is framed as an executive diagnostic: review whether website users or sessions are becoming conversions and revenue before making paid-media budget decisions.
- GA4-only web/outcome guidance includes the available aggregate users, sessions, conversions, revenue, and CVR values when those metrics are available, so the recommendation is tied to visible connected-source data.
- Fix 1 target awareness is implemented: GA4-only web/outcome guidance now states whether KPI or Benchmark targets exist for CVR, revenue, and conversions. If no target exists, it says quality cannot be judged yet.
- Recommendation visible values now render Website Outcomes `Expected Impact` metrics from the same page-level `performanceSummary` aggregate used by the Executive Summary cards, KPI Progress, Benchmark Comparison, and Risk Assessment. This prevents backend `/executive-summary` recommendation values from drifting from the visible page values.
- Fix 2 interpretation text is implemented: GA4-only web/outcome guidance now states live outcomes plainly, such as `Revenue is $88,893 from 392 conversions` and `Conversion rate is 4.7%`, without judging whether those values are good or bad unless targets are available.
- Fix 3 target comparison and next action is implemented: GA4-only web/outcome guidance now compares mapped CVR, revenue, and conversion KPI/Benchmark targets when they exist, and gives a next action to inspect landing pages/conversion paths when any mapped target is below target.
- Fix 4 regression and documentation hardening is implemented: coverage now explicitly guards GA4-only with targets, GA4-only without targets, paid-media guidance blocked, and missing GA4/web inputs remaining unavailable.
- Website Outcomes `Expected Impact` now renders as bullet points so executives can scan available data, interpretation, target check, and next action separately.
- `Timeframe` is retained because it tells executives when the recommendation should be reviewed or acted on. For GA4-only Website Outcomes, `Next 7 days` means this is a near-term diagnostic review, not a budget pacing period.
- `Investment Required` is retained because it clarifies whether the recommendation needs budget. For GA4-only Website Outcomes, it should say analysis only and explain that paid-media budget or channel recommendations require a connected paid-media source.
- Strategic Recommendations are executive-ready in the current implemented scope: paid-media recommendations require paid-media source capability and required financial inputs, while GA4-only campaigns receive factual web/outcome guidance with live values, target context, a clear next action, readable bullets, timeframe, investment requirement, assumptions, and disclaimers.
- Strategic Recommendations update from the same refresh path as the rest of Executive Summary. `/api/campaigns/:id/executive-summary` recomputes recommendation eligibility from current source capability, aggregate metric availability, KPI target availability, Benchmark target availability, and trajectory inputs. The page also fetches `/api/campaigns/:id/outcome-totals` and renders Website Outcomes values from page-level `performanceSummary.totals`, so updated connected-source values are reflected after the page mounts or regains focus. This is refetch-based synchronization, not a live push stream while the tab remains idle.
- Spend-without-revenue and revenue-without-spend states suppress paid efficiency claims instead of treating missing inputs as zero.

Remaining executive-grade recommendation hardening:

- All remaining fixes must keep this as web/outcome guidance only; do not add paid-media budget, ROAS, CPA, CPC, CTR, CPM, or channel allocation advice unless a paid-media source is connected.

Why this is fourth:

- Recommendation logic is the highest-risk business interpretation layer and should only be changed after current values, health, risk, and history are source-correct.

### Commit 5: Refresh Stability And UI Consistency

Status: Completed.

Goal:

- Keep Executive Summary synchronized with source updates and avoid transient misleading content.

Scope:

- Refetch aggregate-backed Executive Summary values while visible and on window focus.
- Keep prior aggregate data during refetch where safe.
- Avoid flashing legacy or empty fallback content before aggregate-backed content is ready.
- Align tab presentation and production controls with the other DeepDive sections.
- Add regression coverage for query key, refetch behavior, and no paid-media fallback flash.

Implemented behavior:

- The Executive Summary page now refetches both `/api/campaigns/:id/executive-summary` and `/api/campaigns/:id/outcome-totals` every 60 seconds while the page is active.
- Background polling is disabled with `refetchIntervalInBackground: false`, so the page does not keep polling while hidden.
- The page continues to refetch both queries on mount and window focus.
- The page does not switch to `isFetching`-based loading UI, so an ordinary background refetch keeps the current rendered aggregate-backed content visible instead of flashing an empty or legacy fallback state.
- Regression coverage now guards the two query keys, mount/focus refetching, visible-tab polling, background polling disablement, and absence of `isFetching` loading replacement.

Why this is fifth:

- Once values are correct, refresh behavior must preserve trust during source updates and page reloads.

### Commit 6: Docs And Final Validation

Status: Completed.

Goal:

- Finalize documentation and prove the current Executive Summary scope is production ready.

Scope:

- Update `ARCHITECTURE_USER_JOURNEY.md` and GA4 docs if implementation clarifies Executive Summary behavior.
- Update this tracker with completed evidence for each commit.
- Run targeted Executive Summary tests.
- Run related scheduler/snapshot tests if historical trajectory changed.
- Run `npm run check`.
- Run `npm run build`.

Implemented behavior:

- Final tracker status now reflects Commits 1, 2, 3, 3A, 4, 5, and 6 as completed for the implemented Executive Summary scope.
- User validation passed for the Commit 5 active-tab refresh behavior: Network filtering confirmed `/executive-summary` and `/outcome-totals` refresh behavior with the corrected DevTools regex filter.
- No additional scheduler/snapshot code changed in Commit 6; scheduler/snapshot behavior remains covered by the earlier compatible trajectory work and should be revalidated only if trajectory logic changes again.
- Final validation evidence is recorded in the Current Status section.

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
- Risk Assessment clearly states the six configured executive risk inputs and does not imply complete campaign safety when no configured risk factors fire
- Risk Assessment has explicit product rules and regression coverage for KPI misses, Benchmark misses, data freshness warnings, and budget pacing risk
- strategic recommendations are generated only from valid metric/source combinations
- paid-media budget reallocation requires comparable main paid-media sources
- historical trajectory uses compatible aggregate snapshots only
- current values stay synchronized with source updates
- regression coverage proves GA4-only, paid multi-source, financial child-source exclusion, recommendation gating, and access guard behavior
- documentation matches the implemented behavior

## Current Status

Production-ready by local code path review, regression coverage, build validation, and user validation for the implemented connected-source aggregate pattern. Executive Summary now follows the same future-proofing pattern as the other Campaign DeepDive subsections: current sections consume the shared connected-source aggregate, and future or refined main Connected Platforms must enter through the documented aggregate contract before being marked production-ready for that source. Google Ads has separate local/test-mode Connected Platforms evidence through Commit 24 in `GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md`; Commit 25 fixes local live-OAuth campaign selection before first metrics import. Live OAuth deployed or production-like evidence remains separate. Executive Summary is ready to consume Google Ads through the same aggregate pattern for the validated source path.

### Executive Summary Status Map

Use this section first when resuming Executive Summary work.

| Category | Status | Meaning |
| --- | --- | --- |
| Executive Summary implementation | Complete | The subsection follows the shared connected-source aggregate pattern used by the other Campaign DeepDive subsections. |
| Connected-source aggregate future-proofing | Complete | `/executive-summary`, `/outcome-totals`, scheduler snapshots, KPI/Benchmark mapping, Risk inputs, and Strategic Recommendations are guarded for normalized main Connected Platform sources. |
| Deployed validation evidence log | Evidence tracking only | This records QA evidence for real deployed source mixes. It is not an open implementation blocker. |
| Future Connected Platform acceptance gate | Standing rule | Every new or refined main source must pass this checklist before that source is called production-ready in Executive Summary. |
| Google Ads Connected Platforms refinement | Separate source work | Google Ads local/test-mode source proof passed through Commit 24 in `GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md`; Commit 25 fixes local live-OAuth campaign selection; live OAuth deployed evidence remains outstanding. This does not block Executive Summary as an aggregate consumer for the validated local/test-mode path. |

Do not treat the deployed evidence log, the future-source acceptance gate, or Google Ads source refinement as unfinished Executive Summary implementation work. They are separate follow-up categories.

### Completed UI Responsiveness And Tab Parity Fix

Root cause:

- Executive Summary blocked the full page loading state on both `/executive-summary` and the secondary `/outcome-totals` request.
- This made refreshes feel slower than necessary because `/executive-summary` already includes a compatible `performanceSummary` fallback, while `/outcome-totals` is used to align visible current values when it arrives.
- Executive Summary also used a custom full-width two-column tab grid, while Performance Summary uses the standard `TabsList` layout.

Fix:

- Executive Summary now leaves the full-page skeleton only while campaign data or `/executive-summary` is loading.
- `/outcome-totals` continues to refetch and feed the page-level aggregate values, but it no longer blocks initial Executive Summary rendering.
- Executive Summary tabs now use the default `TabsList` layout to match Performance Summary.
- Executive Summary now stores the active tab in the URL hash, so refreshing on `Strategic Recommendations` reloads that tab instead of resetting to `Executive Overview`.

### Completed Production-Readiness Work For Connected Platform Expansion

Root cause:

- `/outcome-totals` already supports normalized `platformSources` such as Google Ads through `buildPerformanceSummaryAggregate`.
- `/executive-summary` built a separate aggregate composition and did not pass `platformSources`, so backend-driven Executive Summary sections could miss sources that visible current-value cards received from `/outcome-totals`.

Completed first fix:

- `/executive-summary` now builds a normalized Google Ads `platformSources` row and passes `platformSources: [googleAds]` into `buildPerformanceSummaryAggregate`.
- A refined Google Ads Connected Platform source can now contribute to Executive Summary endpoint source rows, aggregate paid-media totals, KPI/Benchmark metric mapping, paid-platform concentration risk, paid-media recommendation eligibility, and data freshness warnings when connected and available.

Completed next fix:

- Google Ads source composition is now shared by `/outcome-totals` and `/executive-summary` through one route-level helper, so selected Google Ads campaigns, daily rows, paid metrics, attributed revenue, and freshness date are derived the same way in both endpoints.
- This reduces the current drift risk without changing response shapes or refactoring the broader route pipeline.
- User validation passed: with the DevTools regex filter `/executive-summary|outcome-totals/`, `google_ads` appeared in both responses for a Google Ads-connected campaign.

Completed endpoint regression fix:

- Regression coverage now proves a normalized connected Google Ads-style source reaches the Executive Summary response surfaces: `performanceSummary.sources`, visible `platforms`, paid-source count, and paid-media recommendation eligibility.
- The regression also guards the route wiring that passes `platformSources: [googleAds]` into the aggregate and returns `platforms`, `platformsWithData`, and Google Ads data-accuracy metadata from the endpoint.
- Root cause found during regression: paid sources expose `attributedRevenue`, but aggregate revenue availability only counted metric name `revenue`; this could block paid-media recommendation eligibility even when attributed revenue, spend, ROI, and ROAS were present.
- Fix: aggregate revenue availability now treats connected source `attributedRevenue` as a valid revenue source while preserving existing metric names and response shape.

Completed Executive Summary future-proofing checklist:

- [x] Generic future-source regression: prove any normalized `platformSources` source can feed Executive Summary aggregate sources, platform rows, KPI/Benchmark mapping, Risk inputs, and Strategic Recommendation eligibility without a source-specific UI branch.
- [x] Remaining aggregate-composition sharing: reduce the remaining duplicated source composition between `/outcome-totals` and `/executive-summary` beyond the already shared Google Ads source-builder slice.
- [x] Scheduler snapshot parity: confirm scheduler snapshots use the same aggregate/source set as Executive Summary so `7-Day Snapshot Trajectory` works with future or refined main Connected Platforms.
- [x] Deployed validation checklist documented: record the acceptance evidence needed for GA4-only, GA4 plus a refined Google Ads source, and GA4 plus multiple paid-media sources. Scenario evidence remains unchecked until real deployed or production-like validation is recorded, but the Executive Summary implementation work is complete.
- [x] Future-platform acceptance rule documented and regression-guarded: every new or refined main Connected Platform must pass the checklist below before that platform is marked production-ready in Executive Summary.

Separate source work: Google Ads Connected Platforms refinement

- [x] Google Ads-specific local/test-mode metrics, attribution, source UI, and metric correctness have source-level proof recorded in `GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md` through Commit 24.
- [ ] Google Ads live OAuth connect/select/refresh still needs deployed or production-like evidence before the live OAuth path is treated as production-ready; Commit 25 fixes the local campaign-selection-before-refresh blocker.
- [x] The Executive Summary work above future-proofs aggregate consumption so the validated Google Ads source path can plug into Executive Summary using the same pattern as Budget & Financial Analysis and the other aggregate-backed DeepDive subsections.

Completed generic future-source regression fix:

- Regression coverage now uses a fake future paid-media source, not Google Ads, to prove normalized `platformSources` can feed Executive Summary aggregate totals, visible platform rows, KPI/Benchmark-compatible metrics, Risk inputs, and paid-media recommendation eligibility without a source-specific UI/backend branch.

Completed shared aggregate entry-point fix:

- `/outcome-totals` and `/executive-summary` now call the same route-level aggregate wrapper instead of calling `buildPerformanceSummaryAggregate` directly.
- The wrapper centralizes generic main-platform source composition through `mainPlatformSources`, so future refined sources can be added to one source-composition path before entering the shared aggregate contract.
- Endpoint-specific metric fetching remains local to each route to avoid a broad refactor; this fix only removes the drift-prone aggregate entry-point/source-list duplication.

Completed scheduler snapshot parity fix:

- Scheduler snapshots now pass the already-fetched Google Ads rows into snapshot `performanceSummary` as a normalized `platformSources` source, and Google Ads spend contributes to the scheduler fallback spend total.
- This keeps compatible snapshot trajectory inputs aligned with the live Executive Summary aggregate source pattern for the current refined paid-source path. Each future platform still must be explicitly wired into scheduler snapshots under the future-platform acceptance rule before that platform is marked production-ready.

Future Connected Platform acceptance gate:

This is a standing rule for future or refined main Connected Platforms, not an open Executive Summary implementation task. Before a new or refined main Connected Platform is marked production-ready in Executive Summary, it must prove all of the following:

- [ ] shared aggregate contract: the source provides normalized source identity, category, capabilities, included metrics, excluded metric reasons, current metric values, and freshness metadata.
- [ ] `/outcome-totals`: the source appears in `performanceSummary.sources` and contributes only the metrics it can actually provide.
- [ ] `/executive-summary`: the source appears in endpoint `performanceSummary.sources`, visible platform rows, data-accuracy metadata where applicable, and aggregate-backed current values.
- [ ] scheduler snapshots: scheduled and manual snapshots store the source in `metrics.performanceSummary` so compatible 7-day trajectory has the same source set as live Executive Summary.
- [ ] KPI/Benchmark mapping: mapped KPI and Benchmark rows use live aggregate current values and do not fall back to saved stale current values.
- [ ] Risk inputs: Risk Assessment uses the source only for applicable risks and shows unavailable or not-applicable inputs honestly.
- [ ] Strategic Recommendations: recommendation eligibility is based on source capability and aggregate metric availability, with no paid-media claims unless spend, revenue, ROI, and ROAS are available from appropriate sources.
- [ ] regression coverage: source-specific and generic aggregate regressions cover `/outcome-totals`, `/executive-summary`, scheduler snapshots, risk, KPI/Benchmark mapping, and recommendations.
- [ ] deployed validation evidence: the source has been validated in a deployed or production-like campaign with the expected connected-source mix.

Deployed validation checklist and evidence log:

This section is an acceptance evidence log for deployed source mixes, not an additional Executive Summary implementation fix. The Executive Summary code path is production-ready for the implemented connected-source aggregate pattern; each future or refined source still needs its own evidence here before that source mix is marked validated in a deployed environment.

- [ ] GA4-only campaign: `/executive-summary` and `/outcome-totals` both return `200`; `performanceSummary.sources` includes `ga4`; it does not include paid-media sources; visible Executive Summary metrics match GA4-supported aggregate values.
- [ ] GA4 plus refined Google Ads campaign: both endpoints return `200`; `performanceSummary.sources` includes `ga4` and `google_ads`; Google Ads contributes only available paid-media metrics; GA4 remains the web analytics source; paid recommendations appear only when spend, revenue, ROI, and ROAS are available.
- [ ] GA4 plus multiple paid-media sources: both endpoints return `200`; each connected paid source appears once in `performanceSummary.sources`; totals do not double-count GA4 web metrics or financial child inputs; Risk inputs and Strategic Recommendations reflect the paid-source mix.
- [ ] Scheduler evidence: after compatible snapshots exist, `metrics.performanceSummary.version` matches the live aggregate version and `7-Day Snapshot Trajectory` uses compatible snapshot revenue values; new campaigns without enough history show `Not enough history`.
- [ ] KPI/Benchmark evidence: campaign-level KPI and Benchmark rows update Executive Summary rows/targets, while current values come from live `performanceSummary.totals`.
- [ ] Evidence recorded: capture the campaign/source mix, request names, key response terms searched, expected values observed, date validated, and validator.

Evidence log:

- Not yet completed.

Proven:

- Documentation requires Campaign DeepDive subsections to aggregate main Connected Platform metrics at the campaign level.
- The other completed DeepDive subsections use the shared `/api/campaigns/:id/outcome-totals` and `performanceSummary` aggregate pattern.
- Executive Summary still uses its existing endpoint, but Commit 1 now composes current metrics and source rows from the shared `performanceSummary` aggregate.
- Commit 2 now makes the Executive Overview tab choose visible current metrics from `performanceSummary.totals` availability.
- Commit 3 now makes health, risk, and trajectory use aggregate availability and compatible `performanceSummary` snapshots.
- Commit 3A now makes Risk Assessment bounded and explicit: it shows the six executive `Risk inputs`, uses aggregate-backed KPI and Benchmark misses as risk factors, includes data freshness warnings as risk factors, and documents budget pacing as handled in Budget & Financial Analysis.
- Commit 4 now makes Strategic Recommendations source-capability safe: paid-media guidance requires paid-media main sources and available spend/revenue/ROI/ROAS, while GA4-only campaigns can only receive web/outcome guidance from available web analytics and outcome metrics.
- Executive Summary currently refetches both `/executive-summary` and `/outcome-totals` on mount, window focus, and a 60-second active-tab interval so visible aggregate-backed sections update after upstream inputs change.
- Strategic Recommendations are now executive-ready in implemented scope: they are source-capability gated, avoid unavailable paid-media claims, show live web/outcome values for GA4-only recommendations, compare mapped KPI/Benchmark targets when available, present the expected impact as bullets, and keep timeframe, investment requirement, assumptions, and disclaimers visible.
- Strategic Recommendations will update when their inputs update and the Executive Summary data refetches. Current connected-source metrics come from `performanceSummary.totals`; paid-media eligibility comes from current main source capability; target context comes from campaign KPI/Benchmark records; and recommendation copy is recomputed by the endpoint plus finalized with page-level aggregate values in the UI.
- Commit 5 now adds refresh stability: both Executive Summary queries poll every 60 seconds only while the page is active, and regression coverage guards against `isFetching`-based fallback flashes during background refetch.
- Commit 6 now records final documentation and validation evidence for the completed Executive Summary implementation scope.
- User validation passed for active-tab refresh behavior after using the DevTools regex filter `/executive-summary|outcome-totals/`.
- Follow-up parity fix now passes Google Ads as a normalized `platformSources` source into `/executive-summary`, matching the `/outcome-totals` aggregate pattern for the first current future-source gap.
- Follow-up shared-composition fix now uses the same Google Ads aggregate source builder in `/outcome-totals` and `/executive-summary`, preventing the two endpoints from deriving Google Ads totals differently.
- Follow-up endpoint regression now proves a normalized Google Ads-style source appears in Executive Summary aggregate sources, platform rows, paid-source count, and recommendation eligibility when connected.
- These Google Ads-related Executive Summary tasks are aggregate-pattern future-proofing only; Google Ads platform-specific refinement remains separate from Executive Summary production readiness.
- Commit 1 replaced the endpoint's `storage.getCampaign(id)` campaign lookup with the standard campaign access guard.
- GA4-only campaigns are no longer eligible for paid-media recommendations unless a main paid-media platform is connected and required paid financial inputs are available.
- Risk Assessment currently proves the configured backend rules: available ROI below 0%, available ROAS below 1x, paid-platform concentration, compatible 7-day revenue decline, aggregate-backed KPI rows below 70% of target, Benchmark rows below 70% of benchmark, and connected-source data freshness warnings. Budget pacing remains in Budget & Financial Analysis until Executive Summary has a shared pacing input.

Reviewed implementation scope:

- Executive Summary frontend rendering for the implemented connected-source aggregate path.
- Executive Summary backend endpoint.
- Executive Summary helper functions.
- Relationship to `performanceSummary` and compatible snapshots.

Final local validation:

- Passed: `npm test -- server/executive-summary-regression.test.ts server/executive-summary-helpers-regression.test.ts`
- Passed: `git diff --check`
- Passed: `npm run check`
- Passed: `npm run build`

Not covered by local implementation validation:

- Additional deployed GA4-only variants beyond the user-validated active-tab refresh behavior.
- Live multi-platform source mixes.
- New mock-live GA4 validation for the initial no-history state: current metrics and Risk Level should populate immediately, while `7-Day Snapshot Trajectory` should show `Not enough history`.
- Complete historical trajectory behavior in deployed/live data after compatible snapshots exist for the latest point and roughly seven days earlier.
- Complete frontend regression coverage beyond the targeted Executive Summary guards and user-validated flows.
- Future standalone platforms beyond the current shared aggregate contract require the future-platform acceptance gate before that specific source is called production-ready in Executive Summary.
