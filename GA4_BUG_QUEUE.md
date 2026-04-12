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

Status: `Done`

- Fixed with:
  - copy-only update to the `Landing Pages` and `Conversion Events` subtitles so they describe the real campaign-scoped GA4 behavior
- Manual result:
  - updated subtitles display correctly in `Overview`
  - both tables still load normally
  - no layout regressions were observed
  - no data or scoping behavior changed

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

Status: `Done`

- Resolution:
  - no code change was made
  - current behavior was reviewed and confirmed to be correct for the current GA4 implementation
  - this was reclassified as a naming/product-language consideration rather than a functional bug
- Manual result:
  - tab behavior is correct for comparing the GA4 campaigns selected for the connected GA4 property
  - current scoping and calculations behave as expected
- Current decision:
  - keep the `Ad Comparison` title for now
  - avoid renaming at this stage to prevent unnecessary UI/documentation ripple effects and possible inconsistencies

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

Status: `Done`

- Resolution:
  - no code change was made
  - current behavior was reviewed and confirmed to be internally consistent with the current GA4 comparison model
  - this was reclassified as a later product/attribution decision rather than a current bug fix
- Manual/product conclusion:
  - row-level comparison currently uses GA4 campaign-attributed revenue only
  - imported revenue is available only at the total/source-breakdown level
  - changing dropdown `Revenue` to mean all-source revenue would require a deliberate attribution model to avoid fake precision or double-counting
- Current decision:
  - keep the current implementation for now
  - preserve the existing disclosure that imported revenue cannot currently be split by campaign
  - treat any future change here as a scoped enhancement, not a stabilization fix

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

Status: `Done`

- Resolution:
  - no code change was made
  - current behavior was reviewed and confirmed to be a client-vs-server report-rendering parity gap, not a localized stabilization bug
  - this was reclassified as a later reporting enhancement
- Product/technical conclusion:
  - the client-side GA4 report renderer is already richer for `Overview`, `Ad Comparison`, `Insights`, and custom compositions
  - the shared scheduled/server-rendered path is currently strongest for `KPIs` and `Benchmarks`
  - closing the gap would require broader GA4-specific server-renderer work rather than a small safe bug fix
- Current decision:
  - keep the current implementation for now
  - preserve the existing documentation caveat in `GA4/REPORTS.md`
  - treat scheduled/ad hoc report parity as a later enhancement, not part of the current stabilization pass

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

Status: `Done`

- Resolution:
  - no code change was made
  - current behavior was reviewed and confirmed to be a deliberate top-level-only report composition model, not a localized bug
  - this was reclassified as a later product enhancement
- Product/technical conclusion:
  - the current custom-report UI, saved configuration shape, and report renderer all support only top-level section toggles
  - subsection selection would require coordinated work across the custom-report UI, configuration model, ad hoc renderer, and likely scheduled/server renderer
- Current decision:
  - keep the current implementation for now
  - preserve the existing documentation note in `GA4/REPORTS.md`
  - treat subsection selection as a later report-builder enhancement, not part of the current stabilization pass

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

Status: `Done`

- Resolution:
  - no code change was made
  - current behavior was reviewed and confirmed to be a known current-state refinement area rather than a stabilization bug
- Current decision:
  - keep the current implementation for now
  - preserve the current architecture and routing documented in `ARCHITECTURE_USER_JOURNEY.md`
  - treat Dashboard polish/refinement as later product work, not part of the current GA4 stabilization pass

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

Status: `Done`

- Resolution:
  - no code change was made
  - current behavior was reviewed and confirmed to be an in-progress product surface rather than a stabilization bug
- Current decision:
  - keep the current implementation for now
  - preserve the intended campaign-scoped chat architecture documented in `ARCHITECTURE_USER_JOURNEY.md`
  - treat Freestyle Chat completion as later feature work, not part of the current GA4 stabilization pass

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

### 14. CSV spend edit should support campaign-value remapping without forced re-upload, and `Update spend` should only enable after a real edit

Status: `Done`

- Resolution:
  - CSV spend imports now persist enough imported-row data to support later recalculation from stored data
  - CSV spend edit can recalculate without re-upload when only campaign-value selection changes and the stored dataset is available
  - `Update spend` is disabled on initial open and only enables after a meaningful change
- Current decision:
  - keep this behavior as the intended CSV spend edit model for newly imported CSV spend sources
  - if mapped columns change or the stored import dataset is unavailable, re-upload is still required

- Severity: `P1`
- Area: `GA4 Spend sources / CSV edit workflow`
- Affected docs:
  - `GA4/FINANCIAL_SOURCES.md`
  - `GA4-MANUAL-TEST-PLAN.md`
- Expected behavior:
  - users can reopen a CSV spend source, change campaign-value selection, and recalculate without forcing a re-upload when the original stored dataset is available
  - `Update spend` should remain disabled until a meaningful edit is made
- Current behavior:
  - resolved
- Why this mattered:
  - re-upload-only editing was too restrictive for the intended spend-source workflow
  - an always-enabled `Update spend` button incorrectly implied there were unsaved changes
- Root cause area:
  - CSV spend import persistence
  - CSV spend edit-mode button state
- Required regression checks:
  - create a CSV spend source and reopen it in edit mode
  - confirm `Update spend` is initially disabled
  - change selected campaign values and confirm `Update spend` enables
  - restore the original selection and confirm `Update spend` disables again

### 15. Google Sheets spend import should require campaign values when a campaign identifier column is selected, and `Update spend` should only enable after a real edit

Status: `Done`

- Resolution:
  - Google Sheets spend import now blocks the unsafe case where a campaign identifier column is selected but no campaign values are chosen
  - Google Sheets spend edit now keeps `Update spend` disabled until a meaningful change is made
- Current decision:
  - keep this behavior as the intended Google Sheets spend import/edit model

- Severity: `P1`
- Area: `GA4 Spend sources / Google Sheets workflow`
- Affected docs:
  - `GA4/FINANCIAL_SOURCES.md`
  - `GA4-MANUAL-TEST-PLAN.md`
- Expected behavior:
  - if a Google Sheets campaign identifier column is selected and matching values are available, import should require at least one selected campaign value
  - `Update spend` should remain disabled until a meaningful edit is made
- Current behavior:
  - resolved
- Why this mattered:
  - importing an entire sheet while appearing to use a campaign filter was a data-integrity risk
  - an always-enabled `Update spend` button incorrectly implied there were unsaved changes
- Root cause area:
  - Google Sheets spend import validation
  - Google Sheets spend edit-mode button state
- Required regression checks:
  - select a campaign identifier column and confirm `Import spend` is blocked until a campaign value is chosen
  - create a Google Sheets spend source and reopen it in edit mode
  - confirm `Update spend` is initially disabled
  - change selected campaign values and confirm `Update spend` enables
  - restore the original selection and confirm `Update spend` disables again

### 16. CSV revenue import should require campaign values when a campaign column is selected, and the CSV revenue mapping step should not crash

Status: `Done`

- Resolution:
  - CSV revenue import now keeps `Import revenue` disabled until at least one campaign value is selected when a campaign column is chosen
  - the CSV revenue mapping step no longer throws the runtime error caused by calling a helper before initialization
- Current decision:
  - keep this behavior as the intended CSV revenue import model

- Severity: `P1`
- Area: `GA4 Revenue sources / CSV workflow`
- Affected docs:
  - `GA4/FINANCIAL_SOURCES.md`
  - `GA4-MANUAL-TEST-PLAN.md`
- Expected behavior:
  - if a CSV revenue campaign column is selected and matching values are available, import should require at least one selected campaign value
  - opening the CSV revenue mapping step should not crash
  - selecting a date column should enable daily-history behavior, not automatic refresh
- Current behavior:
  - resolved
- Why this mattered:
  - importing an entire CSV while appearing to use a campaign filter was a data-integrity risk
  - the runtime error blocked Journey 8 revenue testing entirely
- Root cause area:
  - CSV revenue import button state
  - CSV revenue mapping-step helper initialization order
- Required regression checks:
  - upload a CSV revenue file and click `Next`
  - confirm the mapping step opens without a runtime error
  - select a campaign column and confirm `Import revenue` is blocked until a campaign value is chosen
  - select one or more campaign values and confirm `Import revenue` enables

### 17. CSV revenue edit should support safe campaign-value remapping without forced re-upload, and `Update revenue` should only enable after a real edit

Status: `Done`

- Resolution:
  - CSV revenue edit now reopens directly into the mapping screen when stored preview/import data is available
  - CSV revenue can recalculate without re-upload when only campaign-value selection changes
  - structural mapping changes still require re-upload
  - `Update revenue` is disabled on initial open and only enables after a meaningful change
- Current decision:
  - keep this behavior as the intended CSV revenue edit model for newly imported CSV revenue sources

- Severity: `P1`
- Area: `GA4 Revenue sources / CSV edit workflow`
- Affected docs:
  - `GA4/FINANCIAL_SOURCES.md`
  - `GA4-MANUAL-TEST-PLAN.md`
- Expected behavior:
  - users can reopen a CSV revenue source, change campaign-value selection, and recalculate without forcing a re-upload when the original stored dataset is available
  - `Update revenue` should remain disabled until a meaningful edit is made
- Current behavior:
  - resolved
- Why this mattered:
  - re-upload-only editing was too restrictive for the intended revenue-source workflow
  - an always-enabled `Update revenue` button incorrectly implied there were unsaved changes
  - a blank edit state prevented the CSV revenue flow from matching CSV spend behavior
- Root cause area:
  - CSV revenue import persistence
  - CSV revenue edit-mode initialization
  - CSV revenue edit-mode button state
- Required regression checks:
  - create a CSV revenue source and reopen it in edit mode
  - confirm the mapping screen opens with preview loaded
  - confirm `Update revenue` is initially disabled
  - change selected campaign values and confirm `Update revenue` enables
  - restore the original selection and confirm `Update revenue` disables again

### 18. Google Sheets revenue should require campaign values when a campaign column is selected, and `Update revenue` should only enable after a real edit

Status: `Done`

- Resolution:
  - Google Sheets revenue import now keeps `Import revenue` disabled until at least one campaign value is selected when a campaign column is chosen
  - the mapping step now blocks the same unsafe case with a validation message
  - the Date column was moved underneath the top Campaign/Revenue mapping row with no logic changes
  - Google Sheets revenue edit now restores the saved date column and keeps `Update revenue` disabled until a meaningful change is made
- Current decision:
  - keep this behavior as the intended Google Sheets revenue import/edit model

- Severity: `P1`
- Area: `GA4 Revenue sources / Google Sheets workflow`
- Affected docs:
  - `GA4/FINANCIAL_SOURCES.md`
  - `GA4-MANUAL-TEST-PLAN.md`
- Expected behavior:
  - if a Google Sheets revenue campaign column is selected and matching values are available, import should require at least one selected campaign value
  - selecting a date column should enable daily-history behavior, not automatic syncing by itself
  - `Update revenue` should remain disabled until a meaningful edit is made
- Current behavior:
  - resolved
- Why this mattered:
  - importing an entire sheet while appearing to use a campaign filter was a data-integrity risk
  - the previous layout made the date-field placement less clear than the core Campaign/Revenue mapping row
  - an always-enabled `Update revenue` button incorrectly implied there were unsaved changes
- Root cause area:
  - Google Sheets revenue import button state
  - Google Sheets revenue mapping-step validation
  - Google Sheets revenue edit-mode button state
- Required regression checks:
  - select a campaign column and confirm `Import revenue` is blocked until a campaign value is chosen
  - select one or more campaign values and confirm `Import revenue` enables
  - create a Google Sheets revenue source and reopen it in edit mode
  - confirm `Update revenue` is initially disabled
  - change selected campaign values and confirm `Update revenue` enables
  - restore the original selection and confirm `Update revenue` disables again

### 19. HubSpot revenue wizard first-screen and review UX needed stabilization

Status: `Done`

- Resolution:
  - `Reconnect` was moved into a stable header/action area on the first HubSpot screen
  - the first HubSpot screen no longer uses the unnecessary vertical scrollbar behavior from the shared scroll body
  - the HubSpot `Date field` copy now explains what it actually controls in the current revenue model
  - `Save Mappings` now shows a single `Total Revenue (to date)` display and preloads the computed amount before save
- Current decision:
  - keep the current HubSpot revenue logic
  - treat these changes as UI/summary stabilization only, not a change to mapping or save behavior

- Severity: `P1`
- Area: `GA4 Revenue sources / HubSpot wizard UX`
- Affected docs:
  - `GA4/FINANCIAL_SOURCES.md`
  - `GA4-MANUAL-TEST-PLAN.md`
- Expected behavior:
  - the first HubSpot screen should feel stable and intentional, without delayed Reconnect rendering or unnecessary scrollbar behavior
  - the Date field should be understandable to users as the HubSpot date property that controls which deals count in the revenue total
  - `Save Mappings` should show one `Total Revenue (to date)` value and it should display the computed amount before save
- Current behavior:
  - resolved
- Why this mattered:
  - delayed action rendering and extra scroll behavior made the first HubSpot screen feel broken
  - the Date field meaning was not clear enough for users
  - duplicate/blank revenue summary states reduced trust in the final review step
- Root cause area:
  - HubSpot wizard action placement
  - shared scroll-container behavior on the first step
  - HubSpot review-summary preview path
- Required regression checks:
  - confirm `Reconnect` renders immediately in the header on the first HubSpot screen
  - confirm the first HubSpot screen does not show an unnecessary vertical scrollbar
- confirm the Date field copy clearly explains its purpose
- confirm `Save Mappings` shows one `Total Revenue (to date)` value with the computed amount before save

### 20. Salesforce revenue edit flow must preserve source identity and refresh review totals from fresh preview data

Status: `Done`

- Resolution:
  - Salesforce edit mode now passes the existing revenue `sourceId` through the revenue modal into the Salesforce wizard and into the save request payload
  - the Salesforce save route now updates/replaces the existing revenue source and its records in edit mode instead of creating a second additive source row
  - Salesforce review-step `Total Revenue (to date)` now refreshes from current preview inputs and prefers fresh preview totals over stale stored `lastTotalRevenue`
- Current decision:
  - keep Salesforce create behavior additive for brand-new sources
  - keep Salesforce edit behavior update-in-place for existing sources
  - treat stable `sourceId` propagation and fresh-preview review precedence as required template behavior for future CRM-style edit flows

- Severity: `P1`
- Area: `GA4 Revenue sources / Salesforce edit workflow`
- Affected docs:
  - `GA4/FINANCIAL_SOURCES.md`
  - `GA4-MANUAL-TEST-PLAN.md`
- Expected behavior:
  - editing an existing Salesforce revenue source should update that existing source, not create a second micro copy/source row
  - changing selected deal values in edit mode should update the final review-step `Total Revenue (to date)` before save
- Current behavior:
  - resolved
- Why this mattered:
  - stale review totals reduced trust in the final review step
  - missing `sourceId` in the edit save payload caused the backend to take the create-new-source branch
  - the Total Revenue card then showed an added Salesforce micro copy/source entry instead of updating the edited amount
- Root cause area:
  - Salesforce edit save payload omitted `sourceId`
  - Salesforce save route therefore fell into the additive create branch
  - review total precedence/caching allowed stored `lastTotalRevenue` to override fresh preview data
- Required regression checks:
  - open an existing Salesforce revenue source in edit mode
  - change selected deal values and confirm the final review total updates before save
  - save the edit and confirm the existing Salesforce source row updates in place
  - confirm no second Salesforce micro copy/source row is added under `Total Revenue`

### 21. GA4 blocked KPI/Benchmark UI and Journey 9 revenue-deletion expectations needed cleanup

Status: `Done`

- Resolution:
  - removed the obsolete `Manage Connected Platforms` CTA from blocked KPI and blocked Benchmark sections on the GA4 page
  - aligned blocked Benchmark card copy with the KPI blocked-state pattern
  - corrected the manual plan so deleting imported revenue does not imply `Total Revenue = 0` when GA4 native revenue still exists
  - updated CRM warning expectations so the main double-counting banner is checked on the first `Source` step, not only later in the Revenue step
- Current decision:
  - keep blocked-state logic and scoring exclusion unchanged
  - keep `Total Revenue = 0` as a valid expectation only when both GA4 native revenue and imported revenue are absent

- Severity: `P1`
- Area: `GA4 KPIs / Benchmarks / Manual test expectations`
- Affected docs:
  - `GA4-MANUAL-TEST-PLAN.md`
  - `GA4/FINANCIAL_SOURCES.md`
- Expected behavior:
  - blocked KPI/Benchmark cards should explain missing inputs without obsolete navigation CTAs
  - blocked Benchmark cards should use the same paused-until-restored wording pattern as blocked KPI cards
  - Journey 9 should distinguish between deleting imported revenue and deleting all revenue inputs, including GA4 native revenue
- Current behavior:
  - resolved
- Why this mattered:
  - the old CTA pointed to a path that is no longer part of the product journey
  - blocked Benchmark copy was inconsistent with blocked KPI copy
  - the old Journey 9 wording could incorrectly imply that GA4 native revenue was removable through source deletion
- Root cause area:
  - stale blocked-state UI copy on the GA4 page
  - stale manual-plan assumptions about the revenue model
- Required regression checks:
  - remove all spend sources and confirm blocked KPI/Benchmark cards show no `Manage Connected Platforms` CTA
  - confirm blocked Benchmark cards use `Missing: Spend. This Benchmark is paused until inputs are restored.`
  - delete imported revenue sources while GA4 native revenue still exists and confirm `Total Revenue` stays above zero
  - verify `Total Revenue = 0` is only expected when GA4 native revenue is absent too

### 22. Insights financial provenance and Google Sheets spend chooser UI needed cleanup

Status: `Done`

- Resolution:
  - removed repeated per-card microcopy under the Insights `Executive financials` cards
  - kept provenance in the shared `Sources used` area instead of repeating it under `Spend`, `Revenue`, `Profit`, `ROAS`, and `ROI`
  - fixed Revenue provenance so it lists the full active revenue source set instead of only the first imported/manual source
  - removed the obsolete in-flow `Remove` action from the Google Sheets spend chooser
  - hid the redundant footer `Next` button in the Google Sheets spend connect substate while preserving progression once a real sheet/tab is being selected
- Current decision:
  - keep provenance consolidated in shared source-footer areas for future financial-card surfaces
  - keep Google Sheets spend chooser actions minimal: `Connect Google Sheets` or `Change sheet/tab`, but no redundant `Remove`/`Next` clutter in the connect substate

- Severity: `P2`
- Area: `GA4 Insights / Google Sheets spend chooser`
- Affected docs:
  - `GA4/INSIGHTS.md`
  - `GA4/FINANCIAL_SOURCES.md`
  - `GA4-MANUAL-TEST-PLAN.md`
- Expected behavior:
  - Insights `Executive financials` should present financial values cleanly and keep provenance in one shared footer
  - Revenue provenance should reflect the full active revenue-source set used in the total
  - Google Sheets spend chooser should avoid redundant controls while preserving the real connect/select/import path
- Current behavior:
  - resolved
- Why this mattered:
  - repeated per-card provenance created unnecessary UI noise in an executive-facing section
  - showing only one revenue source in shared provenance under-described the actual revenue model
  - obsolete chooser actions made the Google Sheets spend flow look busier and less intentional than needed
- Root cause area:
  - hardcoded per-card financial microcopy in Insights
  - Revenue provenance using a narrower active-source reference than the full revenue source set
  - Google Sheets spend chooser rendering obsolete action controls in the connect state
- Required regression checks:
  - confirm Insights `Executive financials` shows no repeated per-card provenance copy
  - confirm `Sources used` Revenue lists the full active source set
  - confirm Google Sheets spend connect substate shows no `Remove` button
  - confirm Google Sheets spend connect substate shows no redundant footer `Next`
  - confirm real sheet/tab selection still progresses normally

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
  - 14. CSV spend edit recalculation and dirty-state guard
  - 15. Google Sheets spend validation and dirty-state guard
  - 16. CSV revenue validation and runtime guard
  - 17. CSV revenue edit recalculation and dirty-state guard
  - 18. Google Sheets revenue validation, layout, and dirty-state guard
  - 19. HubSpot wizard UX stabilization
  - 20. Salesforce edit source-identity and review-total refresh
  - 21. blocked-state UI and Journey 9 revenue-model cleanup
  - 23. GA4 KPI notification current-value and duplicate-row stabilization
  - 24. CRM Pipeline Proxy Overview visibility and provenance stabilization
- `P2`
  - 8. Ad Comparison is still campaign-comparison-based
  - 9. Ad Comparison revenue selector expectation gap
  - 10. scheduled/server-rendered report completeness gap
  - 22. Insights provenance and Google Sheets spend chooser cleanup
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

## 23. GA4 KPI notification current-value and duplicate-row stabilization

- Severity: `P1`
- Area: `GA4 KPIs / Notifications`
- Affected docs:
  - `GA4/KPIS.md`
  - `GA4/REFRESH_AND_PROCESSING.md`
  - `GA4-MANUAL-TEST-PLAN.md`
- Expected behavior:
  - GA4 KPI notifications should show the same current value as the live GA4 KPI card for that KPI
  - old resolved KPI alerts should not remain visible in the active bell/feed
  - duplicate active GA4 KPI rows for the same campaign + metric should not emit competing active alerts
- Current behavior:
  - resolved
- Why this mattered:
  - users could see a stale `3550` KPI alert while the live card correctly showed `72660`
  - duplicate GA4 KPI rows created competing alerts for the same metric
  - the bell could continue showing stale client-cached notifications after the server had already resolved them
- Root cause area:
  - stored GA4 KPI alert snapshots in mock/test mode were refreshed from DB daily rows only instead of the same baseline-plus-refresh total model used by the live GA4 cards
  - KPI alert supersession operated per `kpiId`, while duplicate GA4 KPI rows existed for the same campaign + metric
  - the bell relied on cached notification data long enough to show already-resolved alerts
- Required regression checks:
  - confirm a breached GA4 KPI alert current value matches the live KPI card current value
  - confirm only the newest GA4 KPI row for a duplicate campaign + metric emits the active alert
  - confirm older superseded KPI alerts are hidden from `/api/notifications`
  - confirm reopening the bell shows current server state and does not linger on resolved KPI alerts

## 24. CRM Pipeline Proxy Overview visibility and provenance stabilization

- Severity: `P1`
- Area: `GA4 Overview / CRM revenue sources`
- Affected docs:
  - `GA4/OVERVIEW.md`
  - `GA4/FINANCIAL_SOURCES.md`
  - `GA4/REFRESH_AND_PROCESSING.md`
  - `GA4-MANUAL-TEST-PLAN.md`
- Expected behavior:
  - a saved active HubSpot or Salesforce revenue source using `Total Revenue + Pipeline (Proxy)` shows a separate Overview `Pipeline Proxy` card
  - the card shows provider, selected stage, amount, and selected/contributing campaign values where available
  - the card remains separate from confirmed `Total Revenue` and downstream financial/KPI/Benchmark/Ad Comparison/Insights/Reports calculations
  - deleting or deactivating the associated CRM revenue source removes the Pipeline Proxy card
- Current behavior:
  - resolved
- Why this mattered:
  - users could save a valid Pipeline Proxy source and still see no `Pipeline Proxy` card in Overview
  - the card visibility was too dependent on the separate proxy endpoint returning a fresh `success` response
  - source provenance needed to stay visible so users can understand which CRM source, stage, and campaign values produced the proxy signal
- Root cause area:
  - Overview render gating used endpoint success as the only card trigger instead of also honoring the active saved CRM source config
- Required regression checks:
  - save Salesforce or HubSpot with `Total Revenue + Pipeline (Proxy)` and confirm the Overview card appears
  - confirm the card still appears when the active source has saved Pipeline Proxy config but the endpoint/cache path has not returned fresh data yet
  - confirm provider, stage, amount, and selected/contributing values display where available
  - confirm revenue-only mode does not show the card
  - delete the CRM revenue source and confirm the card disappears
