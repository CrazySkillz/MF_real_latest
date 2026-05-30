# LinkedIn Connected Platform Production-Ready Tracker

## Purpose

Track the work required to refine the LinkedIn integration to production level for both supported user paths:

- Initial campaign creation through the `Create Campaign` flow.
- Adding LinkedIn later from the campaign `Connected Platforms` section.

This tracker exists so LinkedIn follows the same connected-source aggregate pattern used by GA4 and Campaign DeepDive.

## Required Product Rule

`Connected Platforms` is the source of truth.

LinkedIn must be treated as a campaign-scoped main paid-media connected source. Only the selected LinkedIn ad account and selected LinkedIn campaigns should feed the campaign. Campaign DeepDive, KPIs, Benchmarks, Custom Reports, and scheduled reports should consume LinkedIn through the shared connected-source aggregate contract, not through placeholder values or separate one-off calculations.

## Current Root Cause

LinkedIn has partial implementation, but it is not yet proven production-ready.

The current risk is not one isolated UI bug. It is a source-contract and lifecycle-hardening gap:

- LinkedIn can be connected during campaign creation and from an existing campaign, but both paths need to prove they persist the same campaign-scoped source/import contract.
- Some UI paths can still risk showing placeholder or derived LinkedIn values instead of source-backed imported values.
- LinkedIn import, refresh, revenue, spend, and scheduler paths need to prove they update the same records consumed by the shared Campaign DeepDive aggregate.
- LinkedIn paid-media metrics must not be invented when the selected source does not provide them.
- LinkedIn revenue and ROI/ROAS must only appear when valid LinkedIn-attributed revenue and spend inputs are available.
- Disconnect, reconnect, failed import, stale data, and scheduler refresh paths need explicit validation.

## Existing Relevant Paths

- `client/src/components/LinkedInConnectionFlow.tsx`
  - Main LinkedIn connection flow used by campaign creation and existing campaign source addition.

- `client/src/pages/campaigns.tsx`
  - Create Campaign wizard and draft campaign lifecycle.

- `client/src/pages/campaign-detail.tsx`
  - Campaign Overview and Connected Platforms UI.

- `server/routes-oauth.ts`
  - LinkedIn OAuth routes, import routes, connection checks, disconnect routes, campaign aggregate routes, and Campaign DeepDive endpoints.

- `server/storage.ts`
  - LinkedIn connection, import session, campaign, source, KPI, Benchmark, and snapshot persistence.

- `server/linkedin-scheduler.ts`
  - LinkedIn scheduled refresh behavior.

- `server/utils/performance-summary-aggregate.ts`
  - Shared connected-source aggregate helper that Campaign DeepDive sections should consume.

- `server/utils/linkedin-revenue.ts`
  - LinkedIn revenue attribution helper.

- `server/validation/linkedin-metrics.ts`
  - LinkedIn metric validation.

## Production-Ready Target Contract

LinkedIn is production-ready only when all of the following are true:

- The campaign has a persisted LinkedIn source tied to the correct campaign.
- The source stores the selected LinkedIn ad account and selected LinkedIn campaigns.
- The source is scoped to the current client and campaign.
- The source appears in `Connected Platforms` only after a valid connection/import state exists.
- Imported LinkedIn metrics are the only LinkedIn values used in Campaign DeepDive and reports.
- Campaign DeepDive consumes LinkedIn through the shared aggregate contract.
- Missing LinkedIn metrics render as unavailable with a reason, not as zero unless zero is a real source value.
- Revenue, ROI, and ROAS require valid LinkedIn spend plus valid linked revenue or attributed revenue.
- Scheduler refresh updates the same source-backed values used by the UI.
- Disconnect/reconnect only affects the current campaign's LinkedIn source and related LinkedIn-scoped records.

## Source Capability Rules

LinkedIn may provide:

- impressions
- clicks
- spend
- conversions
- leads
- attributed revenue, only when validated
- CTR, CPC, CPM, CPA, ROAS, and ROI, only when required inputs are available

LinkedIn should not provide:

- GA4 users
- GA4 sessions
- GA4 pageviews
- web analytics conversion rate unless explicitly backed by web analytics inputs
- revenue borrowed from unrelated sources
- campaign-level totals from disconnected platforms

## Implementation Plan

### Commit 1: Documentation And Acceptance Contract

Goal:

- Establish the LinkedIn production-ready checklist before code changes.

Tasks:

- Create this tracker.
- Link it from the Campaign DeepDive production-ready status documentation when implementation starts.
- Document validation evidence required for both Create Campaign and Connected Platforms flows.

Validation:

- Tracker clearly lists source contract, implementation commits, and open validation items.

Status:

- [x] Tracker created.
- [x] Linked from `CAMPAIGN_DEEPDIVE_PRODUCTION_READY_STATUS.md`.
- [x] Validation evidence required for both Create Campaign and Connected Platforms flows documented below.
- [x] User validation passed for Commit 1.

### Commit 2: Shared LinkedIn Aggregate Builder

Goal:

- Make every campaign-wide consumer use one LinkedIn source composition path.

Tasks:

- Trace current LinkedIn aggregate construction in `/api/campaigns/:campaignId/outcome-totals`.
- Extract or refine the smallest reusable helper for building LinkedIn aggregate input.
- Reuse the helper where Campaign DeepDive or reports need LinkedIn current totals.
- Preserve existing API response shapes.

Validation:

- GA4-only campaign remains unchanged.
- LinkedIn-only campaign includes LinkedIn once in `performanceSummary.sources`.
- GA4 + LinkedIn campaign includes both sources once.
- Disconnected LinkedIn does not appear.

Status:

- [x] Completed locally: shared `buildLinkedInPlatformSourceForAggregate` helper added in `server/routes-oauth.ts`.
- [x] Completed locally: `/api/campaigns/:campaignId/outcome-totals` uses the shared LinkedIn aggregate helper.
- [x] Completed locally: `/api/campaigns/:campaignId/executive-summary` uses the same LinkedIn aggregate helper.
- [x] Completed locally: regression guards updated to prevent the two routes from drifting back to separate LinkedIn composition paths.
- [x] User validation passed for Commit 2.

### Commit 3: Create Campaign LinkedIn Flow Hardening

Goal:

- Make LinkedIn connected during initial campaign creation persist the same production source contract as later source addition.

Tasks:

- Trace the draft campaign lifecycle in `client/src/pages/campaigns.tsx`.
- Confirm LinkedIn connection cannot finalize as active unless the selected ad account/campaign import state is valid.
- Confirm cancelled or failed LinkedIn connection does not leave a misleading connected source.
- Confirm final campaign creation invalidates and refreshes campaign source queries.

Validation:

- Create a new campaign.
- Select LinkedIn in the Create Campaign flow.
- Connect or use approved test-mode data.
- Select LinkedIn ad account and campaigns.
- Finalize campaign.
- Confirm Connected Platforms shows LinkedIn with the selected source context.
- Confirm `/api/campaigns/:campaignId/outcome-totals` includes LinkedIn.

Status:

- [x] Completed locally: Create Campaign activation now explicitly blocks LinkedIn finalization unless the LinkedIn import completion callback has fired.
- [x] Completed locally: final campaign activation invalidates campaign, Connected Platforms, outcome totals, Executive Summary, and LinkedIn import query caches.
- [x] Completed locally: regression coverage added for the LinkedIn Create Campaign activation guard and source-query invalidations.
- [x] User validation passed for Commit 3 using LinkedIn test data flow.

### Commit 4: Connected Platforms Add-Source Hardening

Goal:

- Make adding LinkedIn later from Connected Platforms use the same production source contract.

Tasks:

- Trace the LinkedIn add-source flow in `client/src/pages/campaign-detail.tsx`.
- Ensure the existing campaign flow reuses `LinkedInConnectionFlow` without producing a separate source shape.
- Ensure successful import invalidates Connected Platforms, outcome totals, Campaign DeepDive, KPI, Benchmark, and report queries.
- Ensure the LinkedIn card does not show source-backed metrics until import has completed.

Validation:

- Open an existing campaign.
- Add LinkedIn from Connected Platforms.
- Select account and campaigns.
- Confirm Connected Platforms updates without fake metrics.
- Confirm Campaign DeepDive sections include LinkedIn where the source supplies metrics.

Status:

- [x] Completed locally: existing-campaign LinkedIn imports now run the parent import-complete callback before redirecting to LinkedIn analytics.
- [x] Completed locally: Connected Platforms LinkedIn import now invalidates Connected Platforms, LinkedIn connection/session/metrics, outcome totals, Executive Summary, Trend Analysis, KPI, and Benchmark query caches.
- [x] Completed locally: regression coverage added for existing-campaign LinkedIn import invalidation before redirect.

### Commit 5: Remove Placeholder LinkedIn Metrics

Goal:

- Prevent fake or distribution-derived LinkedIn values from appearing as production data.

Tasks:

- Audit LinkedIn display values in Campaign Overview and Connected Platforms.
- Replace placeholder values with imported LinkedIn values or explicit unavailable states.
- Keep UI behavior scoped to LinkedIn only.

Validation:

- Before LinkedIn import, no fake LinkedIn impressions, clicks, spend, conversions, revenue, ROI, or ROAS appear.
- After LinkedIn import, displayed values match imported source values.

Status:

- [ ] Pending.

### Commit 6: Revenue, Spend, And Derived Metric Hardening

Goal:

- Make LinkedIn financial metrics accurate and source-scoped.

Tasks:

- Confirm LinkedIn spend comes from LinkedIn import or LinkedIn refresh records.
- Confirm LinkedIn revenue uses only LinkedIn-attributed revenue or a LinkedIn-scoped revenue source.
- Confirm ROI and ROAS only render when spend and revenue are valid.
- Confirm missing revenue does not create fake zero-value financial conclusions.

Validation:

- LinkedIn spend-only campaign shows spend and paid-media metrics but no revenue-derived ROI/ROAS.
- LinkedIn campaign with valid attributed revenue shows revenue, ROI, and ROAS.
- GA4 revenue does not get incorrectly assigned to LinkedIn.

Status:

- [ ] Pending.

### Commit 7: Scheduler And Freshness Hardening

Goal:

- Make LinkedIn refresh update the same values consumed by the UI and reports.

Tasks:

- Trace `server/linkedin-scheduler.ts`.
- Ensure scheduled refresh is campaign-scoped.
- Ensure refresh failures do not overwrite valid existing metrics with misleading zeroes.
- Ensure stale LinkedIn data produces freshness warnings.
- Ensure scheduler uses stable source identifiers for spend/revenue refresh behavior.

Validation:

- Successful refresh updates latest LinkedIn aggregate values.
- Failed refresh keeps previous valid values and records failure state.
- Stale data warning appears when appropriate.

Status:

- [ ] Pending.

### Commit 8: Campaign DeepDive And Custom Report Parity

Goal:

- Ensure every Campaign DeepDive subsection consumes LinkedIn from the shared connected-source aggregate.

Tasks:

- Confirm LinkedIn is included where supported in:
  - Performance Summary
  - Budget & Financial Analysis
  - Platform Comparison
  - Trend Analysis
  - Executive Summary
  - Custom Report browser PDFs
  - Custom Report scheduled PDFs
- Ensure unsupported metrics are hidden or marked unavailable.

Validation:

- GA4-only campaign remains GA4-only.
- LinkedIn-only campaign shows paid-media metrics only.
- GA4 + LinkedIn campaign aggregates both sources without double-counting.
- Custom Report selected sections render latest LinkedIn-backed values.

Status:

- [ ] Pending.

### Commit 9: Destructive And Visibility Path Hardening

Goal:

- Make LinkedIn disconnect, reconnect, and damaged-state behavior safe.

Tasks:

- Confirm disconnect is campaign-scoped.
- Confirm disconnect removes LinkedIn from Connected Platforms and aggregate outputs.
- Confirm disconnect does not delete unrelated GA4, revenue, spend, KPI, Benchmark, or report records.
- Confirm reconnect creates or reuses only valid LinkedIn-scoped records.
- Add a cleanup plan only if existing damaged LinkedIn records are proven.

Validation:

- Disconnect LinkedIn from one campaign.
- Confirm unrelated campaigns and sources are unchanged.
- Reconnect LinkedIn and confirm aggregate values return from the new valid source state.

Status:

- [ ] Pending.

### Commit 10: Regression Coverage And Final Evidence

Goal:

- Prove LinkedIn production readiness with tests and deployed validation.

Tasks:

- Add regression coverage for:
  - Create Campaign with LinkedIn.
  - Add LinkedIn later from Connected Platforms.
  - LinkedIn-only campaign.
  - GA4 + LinkedIn campaign.
  - LinkedIn spend with no revenue.
  - LinkedIn revenue with valid attribution.
  - stale LinkedIn data.
  - disconnect and reconnect.
  - Custom Report PDF output.
  - scheduled report output.
- Record deployed validation evidence after mock-live LinkedIn testing.

Validation:

- Tests pass locally.
- Deployed LinkedIn mock-live campaign values match Connected Platforms and Campaign DeepDive.

Status:

- [ ] Pending.

## Validation Checklist

### Create Campaign Flow

- [ ] Start a new campaign.
- [ ] Select LinkedIn during campaign creation.
- [ ] Authenticate or use approved mock-live test connection.
- [ ] Select LinkedIn ad account.
- [ ] Select LinkedIn campaigns.
- [ ] Complete import.
- [ ] Finalize campaign.
- [ ] Confirm LinkedIn appears in Connected Platforms.
- [ ] Confirm LinkedIn appears in `/api/campaigns/:campaignId/outcome-totals`.
- [ ] Confirm Campaign DeepDive uses only available LinkedIn metrics.

### Connected Platforms Flow

- [ ] Open an existing campaign.
- [ ] Add LinkedIn from Connected Platforms.
- [ ] Authenticate or use approved mock-live test connection.
- [ ] Select LinkedIn ad account.
- [ ] Select LinkedIn campaigns.
- [ ] Complete import.
- [ ] Confirm Connected Platforms updates.
- [ ] Confirm Campaign DeepDive sections update.
- [ ] Confirm Custom Report output updates.

### Multi-Source Flow

- [ ] Connect GA4 and LinkedIn to the same campaign.
- [ ] Confirm GA4 contributes web analytics and outcome metrics.
- [ ] Confirm LinkedIn contributes paid-media metrics.
- [ ] Confirm financial child inputs do not appear as separate main platforms.
- [ ] Confirm no double-counting.

## Production-Ready Exit Criteria

LinkedIn can be marked production-ready only after:

- Create Campaign flow is validated.
- Connected Platforms add-source flow is validated.
- Shared aggregate includes LinkedIn correctly.
- Campaign DeepDive sections consume LinkedIn through the shared aggregate.
- Custom Report browser and scheduled PDFs include LinkedIn-backed latest values.
- Scheduler refresh behavior is safe.
- Disconnect/reconnect behavior is safe.
- Regression tests cover the critical lifecycle paths.
- Deployed mock-live validation evidence is recorded.

## Relevant Documentation

- `AGENTS.md`
- `ARCHITECTURE_USER_JOURNEY.md`
- `GA4/README.md`
- `GA4_DEVELOPMENT_WORKFLOW.md`
- `CAMPAIGN_DEEPDIVE_PRODUCTION_READY_STATUS.md`
- `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_BUDGET_FINANCIAL_ANALYSIS_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_PLATFORM_COMPARISON_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_CUSTOM_REPORT_PRODUCTION_READY.md`
