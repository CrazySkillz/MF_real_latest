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
- `Executive Summary` = executive narrative, risk, health, and strategic recommendation layer based on connected-source data.

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
- Paid-media Top of Funnel and Mid Funnel blocks appear only when connected sources provide impressions or clicks.
- Revenue, spend, ROI, ROAS, CPA, CPC, CTR, and CVR display unavailable when required aggregate inputs are missing.
- Platform Performance lists only main Connected Platforms from `performanceSummary.sources`.
- Financial child inputs do not appear as separate platform rows.
- Campaign Health is based only on available aggregate inputs.
- Risk Assessment distinguishes analytics-only source concentration from paid-media spend concentration.
- KPI Progress and Benchmark Comparison continue to use campaign-level KPI/Benchmark records and should not be rewritten unless their current values are proven stale.

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
- Build Platform Performance from endpoint rows derived from the aggregate.
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
- Keep KPI Progress and Benchmark Comparison stable unless a traced bug requires a narrow fix.
- Add regression coverage for GA4-only unavailable paid-media metrics and multi-source available metrics.

Root cause:

- The backend response now includes aggregate availability through `performanceSummary.totals`, but `client/src/pages/executive-summary.tsx` still rendered Executive Overview current-value surfaces from legacy `metrics` fields and hard-coded paid-media labels.
- In GA4-only campaigns, the tab could therefore display paid-media-style impressions, clicks, CTR, CPC, ROAS, ROI, or funnel copy as available values even when the aggregate correctly marked those metrics unavailable.
- The smallest safe fix is frontend-only for this commit: keep the response contract stable, keep the existing layout, and choose visible Overview metrics from aggregate availability while leaving health, risk, recommendations, KPI progress, and benchmark comparison to their planned commits.

Completed:

- Added frontend aggregate availability helpers for the Executive Overview tab.
- Switched the top funnel, mid funnel, bottom funnel, funnel story, and key metric cards to render aggregate-backed available values or `Unavailable`.
- GA4-only campaigns now prefer web analytics metrics such as users or sessions when paid-media impressions or clicks are unavailable.
- Left KPI Progress, Benchmark Comparison, health, risk, and Strategic Recommendations unchanged for their planned commits.
- Added regression coverage that proves the Overview tab uses `performanceSummary.totals` availability and no longer renders the legacy hard-coded impressions, clicks, or revenue expressions.

Files changed:

- `client/src/pages/executive-summary.tsx`
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

Status: Not started.

Goal:

- Ensure executive health and risk labels are based on available aggregate inputs and compatible history.

Scope:

- Update health scoring so unavailable metrics are not treated as failures.
- Update risk assessment so GA4-only is not called a single advertising-platform risk.
- Use compatible `metrics.performanceSummary` snapshots for trajectory only when available.
- Add regression coverage for unavailable inputs, analytics-only sources, and incompatible snapshots.

Why this is third:

- Health and risk are executive-facing summaries; they must not imply precision when the source inputs are unavailable.

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
- strategic recommendations are generated only from valid metric/source combinations
- paid-media budget reallocation requires comparable main paid-media sources
- historical trajectory uses compatible aggregate snapshots only
- current values stay synchronized with source updates
- regression coverage proves GA4-only, paid multi-source, financial child-source exclusion, recommendation gating, and access guard behavior
- documentation matches the implemented behavior

## Current Status

Not production ready. Commits 1 and 2 are completed locally, but health/risk scoring, trajectory compatibility, recommendation gating, and refresh stability remain outstanding.

Proven:

- Documentation requires Campaign DeepDive subsections to aggregate main Connected Platform metrics at the campaign level.
- The other completed DeepDive subsections use the shared `/api/campaigns/:id/outcome-totals` and `performanceSummary` aggregate pattern.
- Executive Summary still uses its existing endpoint, but Commit 1 now composes current metrics and source rows from the shared `performanceSummary` aggregate.
- Commit 2 now makes the Executive Overview tab choose visible current metrics from `performanceSummary.totals` availability.
- Executive Summary still has health/risk assumptions and recommendation assumptions that need later commits.
- Commit 1 replaced the endpoint's `storage.getCampaign(id)` campaign lookup with the standard campaign access guard.
- GA4-only campaigns are still at risk of showing paid-media recommendations until Commit 4 is completed.

Partially reviewed:

- Executive Summary frontend rendering.
- Executive Summary backend endpoint.
- Executive Summary helper functions.
- Relationship to `performanceSummary` and compatible snapshots.

Unverified:

- Full deployed GA4-only behavior.
- Live multi-platform behavior.
- Complete historical trajectory behavior.
- Complete frontend regression coverage.
- Future standalone platforms beyond the current shared aggregate contract.
