# GA4 Bug Queue

## Purpose

This file turns the known GA4 review findings into a prioritized fix queue.

Use it to:

- sequence GA4 stabilization work safely
- fix one issue at a time
- attach regression checks to every fix
- distinguish true bugs from current-state caveats and future enhancements

This queue should be used together with:

- `AGENTS.md`
- `ARCHITECTURE_USER_JOURNEY.md`
- `GA4/README.md`
- `GA4_DEVELOPMENT_WORKFLOW.md`
- `GA4-MANUAL-TEST-PLAN.md`

## Priority Rules

- `P0` = fix first; high regression or trust risk
- `P1` = important correctness or workflow issue
- `P2` = lower-risk bug or product inconsistency
- `P3` = current-state gap or enhancement to schedule later

## Working Queue

The items below are ordered in the recommended execution order.

Keep the severity labels, but work from top to bottom unless a specific retest or blocker requires reprioritization.

### 1. Campaign can be finalized as active without a successful source connection

Status: `Done`

- Fixed with:
  - backend draft -> active activation guard
  - final wizard button gating
  - removal of the `Skip — connect later` path from the campaign wizard
- Manual result:
  - valid GA4-connected campaign creation still works
  - invalid skip/bypass path is removed
  - campaign entry flow still works
  - `View Detailed Analytics` path still works

- Severity: `P0`
- Area: `Campaign creation / Campaign Management / GA4 entry flow`
- Affected docs:
  - `ARCHITECTURE_USER_JOURNEY.md`
  - `GA4/README.md`
- Expected behavior:
  - final `Create Campaign` should finalize the campaign only after at least one valid connected or intentionally supported data path exists
- Current behavior:
  - campaign can become `Active` even if no source was actually connected successfully
- Why this matters:
  - it breaks the product contract that active campaigns are analytics-ready
  - it creates empty campaigns that appear valid
- Root cause area:
  - campaign wizard finalization flow
  - campaign activation logic
- Required regression checks:
  - create campaign with valid GA4 connection -> campaign becomes active
  - attempt to finalize without a valid source -> campaign should remain draft or block finalization
  - intentionally supported manual/import path still works if designed to allow activation
  - Campaign Management list still shows status correctly
  - campaign click-through to Overview still works for valid campaigns

### 2. `Latest Day Spend` does not follow the intended previous-day all-sources rule

Status: `Done`

- Fixed with:
  - GA4 Overview now reads the previous day only for `Latest Day Spend`
  - `/api/campaigns/:id/spend-daily` now filters out snapshot-style spend sources for latest-day calculation
- Manual result:
  - adding, editing, and deleting snapshot-style spend sources updates `Total Spend` correctly
  - `Latest Day Spend` no longer changes just because a new manual spend value is added today
- Automated result:
  - `npm test -- server/latest-day-spend-regression.test.ts`
  - passed: `1` file, `2` tests

- Severity: `P0`
- Area: `GA4 Overview / Financial computation`
- Affected docs:
  - `GA4/OVERVIEW.md`
  - `GA4/FINANCIAL_SOURCES.md`
- Expected behavior:
  - `Latest Day Spend` should show the previous day's total spend for the campaign across all applicable spend sources
- Current behavior:
  - current implementation uses narrower date-selection logic (`today` else `yesterday`)
- Why this matters:
  - this is a visible executive-facing card
  - it undermines trust in financial freshness
- Root cause area:
  - GA4 Overview latest-day spend selection logic
  - spend-record date query logic
- Required regression checks:
  - Overview `Latest Day Spend`
  - Insights financial row
  - KPI and Benchmark values that depend on spend
  - Reports values if they surface latest-day financials
  - `Run Refresh` should not create inconsistent latest-day values

### 3. `Latest Day Revenue` does not cleanly match the intended previous-day all-sources rule

Status: `Done`

- Fixed with:
  - GA4 Overview now reads the previous day only for `Latest Day Revenue`
  - both `/api/campaigns/:id/revenue-daily` handlers now filter out snapshot-style revenue sources for latest-day calculation
- Manual result:
  - adding, editing, and deleting snapshot-style revenue sources updates `Total Revenue` correctly
  - `Latest Day Revenue` no longer changes just because a new manual revenue value is added today
- Automated result:
  - `npm test -- server/latest-day-revenue-regression.test.ts`
  - passed: `1` file, `2` tests

- Severity: `P0`
- Area: `GA4 Overview / Financial computation`
- Affected docs:
  - `GA4/OVERVIEW.md`
  - `GA4/FINANCIAL_SOURCES.md`
- Expected behavior:
  - `Latest Day Revenue` should show the previous day's total revenue for the campaign across all applicable revenue sources
- Current behavior:
  - parts of the current implementation still use a narrower report-day-based approach
- Why this matters:
  - this is a visible executive-facing card
  - downstream financial interpretation depends on it
- Root cause area:
  - GA4 Overview latest-day revenue selection logic
  - imported daily revenue merge logic
- Required regression checks:
  - Overview `Latest Day Revenue`
  - Insights financial row
  - KPI and Benchmark values that depend on revenue
  - Reports values if they surface latest-day financials
  - mixed-source revenue scenarios

### 4. GA4 KPI alert notifications still use LinkedIn-style destination URLs

Status: `Done`

- Fixed with:
  - GA4 KPI notifications now build GA4-specific action URLs instead of LinkedIn links
  - KPI alert generation no longer excludes GA4 KPIs just because their status is `tracking` rather than `active`
  - `Create KPI` now opens with a clean empty form state instead of leaking values from the previous KPI
- Manual result:
  - breached GA4 KPI alerts now appear in the bell / Notifications center
  - clicking the notification routes to the GA4 KPI tab for the campaign
  - `Create KPI` opens blank after editing another KPI
- Automated result:
  - `npm test -- server/ga4-kpi-regression.test.ts`
  - passed: `1` file, `3` tests

- Severity: `P1`
- Area: `GA4 KPIs / Notifications`
- Affected docs:
  - `GA4/KPIS.md`
- Expected behavior:
  - GA4 KPI notifications should deep-link to the correct GA4 destination for that campaign
- Current behavior:
  - shared KPI notification helper still builds LinkedIn analytics action URLs
- Why this matters:
  - alert navigation is incorrect
  - users can be sent to the wrong place from the bell/notifications center
- Root cause area:
  - KPI notification helper
  - alert action URL generation
- Required regression checks:
  - KPI alert creation
  - notification bell entry
  - Notifications page navigation
  - LinkedIn notifications should not regress

### 5. Immediate post-refresh benchmark alert checks are not fully mirrored in the auto-refresh path

Status: `Done`

- Fixed with:
  - immediate auto-refresh now runs benchmark alert checks after KPI alert checks
  - GA4 benchmark current values now refresh on same-day reruns before alert checks read them
  - `Run refresh` now refetches notifications immediately so new benchmark alerts appear in the bell without waiting for the poll interval
- Manual result:
  - benchmark notifications are created and visible through the bell / Notifications center
  - benchmark notifications route to the GA4 `Benchmarks` tab for the campaign
  - benchmark executive snapshot and card states stay aligned
- Automated result:
  - `npm test -- server/ga4-benchmark-regression.test.ts`
  - passed: `1` file, `3` tests

- Severity: `P1`
- Area: `GA4 Benchmarks / Refresh and processing`
- Affected docs:
  - `GA4/BENCHMARKS.md`
  - `GA4/REFRESH_AND_PROCESSING.md`
- Expected behavior:
  - after Overview-driving data updates, benchmark values should recompute and benchmark alerts should be checked in the same post-refresh flow
- Current behavior:
  - benchmark recomputation exists, but immediate benchmark alert checks are not mirrored as completely as KPI alert checks
- Why this matters:
  - refreshed benchmark state can be visible before alerting catches up
  - notifications may lag or be inconsistent
- Root cause area:
  - auto-refresh scheduler
  - benchmark alert trigger sequence
- Required regression checks:
  - `Run Refresh`
  - Benchmark current values
  - Benchmark Executive snapshot
  - benchmark notifications
  - KPI alerts should still work

### 6. GA4 post-refresh KPI path still depends partly on a legacy generic KPI refresh helper

Status: `Done`

- Fixed with:
  - GA4 immediate post-refresh path no longer calls the legacy LinkedIn-only `refreshKPIsForCampaign` helper
  - GA4 KPI jobs now refresh stored `currentValue` on same-day reruns before history dedupe skips a new point
  - `Run refresh` mock data now advances the injected GA4 day on rerun so KPI cards receive a real changed input during QA
  - KPI `Avg. Progress` now uses bounded per-card progress instead of uncapped over-target attainment
  - Benchmark edit modal now shows the same live current value as the benchmark card
- Manual result:
  - `Run refresh` updates KPI cards again
  - KPI executive snapshot remains coherent after refresh
  - KPI `Avg. Progress` looks consistent with card progress bars
  - Benchmark edit modal current value matches the card value
- Automated result:
  - `npm test -- server/ga4-kpi-benchmark-summary-regression.test.ts`
  - passed: `1` file, `3` tests

- Severity: `P1`
- Area: `GA4 KPIs / Refresh and processing`
- Affected docs:
  - `GA4/KPIS.md`
  - `GA4/REFRESH_AND_PROCESSING.md`
- Expected behavior:
  - GA4 KPI recomputation and alerting should run through a clean GA4-aware post-refresh path
- Current behavior:
  - current flow is split between GA4-specific jobs and a legacy generic helper
- Why this matters:
  - increases risk of drift between visible KPI values and stored/current alert state
  - raises regression risk in future GA4 fixes
- Root cause area:
  - auto-refresh scheduler
  - generic KPI refresh helper usage
- Required regression checks:
  - KPI current values after `Run Refresh`
  - KPI Executive snapshot
  - KPI alerts and notifications
  - Benchmark behavior must not regress

### 7. GA4 `Landing Pages` and `Conversion Events` copy is misleading relative to actual campaign scoping

- Severity: `P1`
- Area: `GA4 Overview`
- Affected docs:
  - `GA4/OVERVIEW.md`
- Expected behavior:
  - copy should make clear these tables are scoped to the GA4 property and GA4 campaign selection used for this app campaign
- Current behavior:
  - UI copy suggests broad “across all campaigns” behavior
- Why this matters:
  - users can misunderstand table scope and trust the wrong interpretation
- Root cause area:
  - GA4 Overview labels/microcopy
- Required regression checks:
  - table copy in Overview
  - no change to data scoping behavior
  - no layout regressions on the GA4 Overview page

### 8. `Ad Comparison` tab is still implemented as campaign comparison rather than true ad/creative comparison

- Severity: `P2`
- Area: `GA4 Ad Comparison`
- Affected docs:
  - `GA4/AD_COMPARISON.md`
- Expected behavior:
  - longer-term intent is ad/creative-level comparison
- Current behavior:
  - tab compares campaign rows, not ads/creatives
- Why this matters:
  - current tab meaning does not match the label perfectly
- Root cause area:
  - current tab data model
  - available GA4 comparison inputs
- Required regression checks:
  - selected metric changes
  - summary cards
  - chart ranking
  - All Campaigns table
  - Revenue Breakdown

### 9. `Ad Comparison` revenue selector behavior is narrower than likely user expectation

- Severity: `P2`
- Area: `GA4 Ad Comparison / Financial attribution`
- Affected docs:
  - `GA4/AD_COMPARISON.md`
- Expected behavior:
  - if `Revenue` is selected, users are likely to expect all applicable campaign revenue sources
- Current behavior:
  - row-level comparison currently only has GA4-attributed revenue
- Why this matters:
  - label expectation and row-level source model do not fully match
- Root cause area:
  - comparison row attribution model
- Required regression checks:
  - revenue ranking
  - summary cards
  - Revenue Breakdown
  - no double-counting across imported sources

### 10. Scheduled/server-rendered GA4 reports are less complete than the live ad hoc renderer

- Severity: `P2`
- Area: `GA4 Reports`
- Affected docs:
  - `GA4/REPORTS.md`
- Expected behavior:
  - scheduled and downloaded reports should be consistently faithful to the selected GA4 report content
- Current behavior:
  - scheduled/server-generated output is strongest for KPIs and Benchmarks and lighter for some other sections
- Why this matters:
  - users may get richer output when downloading manually than when receiving scheduled reports
- Root cause area:
  - shared report scheduler renderer
  - GA4 report payload/rendering parity
- Required regression checks:
  - ad hoc download
  - scheduled report creation/edit
  - scheduled PDF content
  - report library entries

### 11. Custom report builder only supports top-level section toggles, not nested subsection selection

- Severity: `P3`
- Area: `GA4 Reports / Custom Report`
- Affected docs:
  - `GA4/REPORTS.md`
- Expected behavior:
  - users should be able to select subsections under each major tab
- Current behavior:
  - current builder only exposes top-level section checkboxes
- Why this matters:
  - limits executive report tailoring
- Root cause area:
  - custom report UI model
  - report configuration schema
- Required regression checks:
  - custom report UI
  - saved report config
  - ad hoc download
  - scheduled report generation

### 12. `Dashboard` still needs refinement as a polished client-level overview layer

- Severity: `P3`
- Area: `Client Dashboard / App shell`
- Affected docs:
  - `ARCHITECTURE_USER_JOURNEY.md`
- Expected behavior:
  - Dashboard should be the clear client-level overview layer
- Current behavior:
  - hierarchy exists, but Dashboard still needs refinement
- Why this matters:
  - this is architectural cleanup, not the next GA4 stabilization blocker
- Required regression checks:
  - client navigation
  - Dashboard routing
  - Campaigns entry path

### 13. Freestyle Chat is still in progress

- Severity: `P3`
- Area: `Campaign-level analytics / future GA4-adjacent work`
- Affected docs:
  - `ARCHITECTURE_USER_JOURNEY.md`
- Expected behavior:
  - users should be able to run prompts/queries against campaign data for insights
- Current behavior:
  - still in progress
- Why this matters:
  - should be preserved as intended architecture, but is not the next production GA4 blocker
- Required regression checks:
  - campaign context scope
  - no interference with platform-specific analytics

## Severity View

- `P0`
  - 1. campaign finalization gating
  - 2. `Latest Day Spend`
  - 3. `Latest Day Revenue`
- `P1`
  - 4. KPI notification URL routing
  - 5. benchmark post-refresh alert path
  - 6. GA4 KPI post-refresh cleanup
  - 7. misleading Overview table copy
- `P2`
  - 8. Ad Comparison is still campaign-comparison-based
  - 9. Ad Comparison revenue selector expectation gap
  - 10. scheduled/server-rendered report completeness gap
- `P3`
  - 11. custom report subsection selection gap
  - 12. Dashboard refinement
  - 13. Freestyle Chat still in progress

## Per-Fix Rule

For every bug in this queue:

1. confirm expected behavior from the docs
2. trace the root cause in code
3. implement the smallest safe fix
4. run the targeted regression checks listed above
5. use `GA4-MANUAL-TEST-PLAN.md` for retest coverage
6. do not move to the next bug until the current one is verified
