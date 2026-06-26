# GA4 Insights Production Readiness

## Purpose

This file is the durable production-readiness status map for the whole GA4 `Insights` tab.

Use this file when asked whether the `Insights` tab is robust, accurate, logical, production-ready, or suitable as a template for another platform.

Do not infer whole-tab readiness from a focused subsection tracker such as `GA4/INSIGHTS_WHAT_TO_INVESTIGATE_NEXT_PRODUCTION_READINESS.md`.

## Current Overall Status

Status: Partially production-ready, not fully production-ready as a whole tab.

Reason:

- the tab contains several different section types with different source windows and confidence levels
- some sections are exact financial or daily-fact summaries
- some sections are directional investigation guidance
- Commit 1 resolved the previously stale `Executive Financials` and `Trends` copy; remaining blockers are findings completeness visibility, `Data Summary` average labeling, and report parity validation
- report output is implemented through separate live-download and scheduled-PDF paths, so report parity must be checked separately

The GA4 `Insights` tab can be used as a future-platform template only after the section-specific rules below are followed. Do not copy the current implementation blindly.

## Root Cause Of Prior Confusion

Earlier production-readiness work certified narrower slices, especially `What to investigate next`, after grouped findings, invalid target checks, evidence labels, history-aware copy, and non-causal recommendations were implemented and validated.

That did not certify the whole tab.

The whole tab also includes `Executive financials`, `Trends`, `Data Summary`, tracker cards, and report/export rendering. Those sections have separate source windows and separate risks.

Future reviews must state the exact scope:

- whole `Insights` tab
- `What to investigate next` only
- `Trends` only
- report output only
- live UI only

## Section Status Map

### Executive Financials

Status: Ready for current code scope.

Proven:

- `Spend` is derived from active spend-source totals.
- `Revenue` is `GA4 native revenue + imported revenue`.
- `Profit`, `ROAS`, and `ROI` derive from those values.
- Pipeline Proxy is excluded from confirmed revenue calculations.
- source provenance is shown in the shared `Sources used` footer.

Resolved in Commit 1:

- live UI copy now states that total revenue uses GA4 native revenue plus imported revenue sources.

Template rule:

- future platforms may copy the additive financial model only if the UI copy states the exact source model and source provenance is visible.

### Trends

Status: Mostly ready for daily-fact trend display, with deployment validation requirements.

Proven:

- Trends reads completed persisted GA4 daily rows from `/api/campaigns/:id/ga4-daily`.
- daily rows are campaign-scoped, property-scoped, and filtered through the saved GA4 campaign scope.
- `Data through`, `Latest imported day`, `Reporting timezone`, `Last refreshed`, and `Expected refresh` expose freshness context.
- history gating is mode-specific:
  - `Daily`: 2 completed daily rows
  - `7d`: 14 completed daily rows
  - `30d`: 60 completed daily rows
  - `Monthly`: 2 calendar months
- today's intraday GA4 data is excluded from Trends until it becomes a completed reporting day.

Resolved in Commit 1:

- live UI copy now states that `7d` and `30d` show rolling totals for non-rate metrics and weighted averages for rates.

Not locally verifiable:

- deployed GA4 scheduler timing
- real GA4 Data API processing latency
- enough live daily history for 7d, 30d, and monthly modes

Template rule:

- future platforms may copy the Trends pattern only when they have persisted daily facts, completed-day cutoff logic, source/campaign/property scoping, and explicit freshness metadata.

### Data Summary

Status: Directional context only; not production-ready as exact executive decision math.

Proven:

- it gives a compact at-a-glance summary from currently available campaign values.
- financial values use the same `financialRevenue` and `financialSpend` variables as Executive Financials.
- channel breakdown is derived from GA4 acquisition breakdown rows.

Current risk:

- per-day averages divide total values by available GA4 daily-history days.
- that is reasonable for true daily GA4 facts but can be misleading when revenue includes imported to-date or snapshot-style sources.
- channel rows are scaled to match the current top-line totals, so the section is normalized display context rather than raw channel-source truth.

Template rule:

- future platforms should either remove these averages, label them as directional, or compute them only from true daily source rows with matching windows.

### Insight Tracker Cards

Status: Mostly ready, with one completeness visibility gap.

Proven:

- `Total insights` counts generated insight items.
- `High priority` counts high-severity insight items.
- `Needs attention` counts medium-severity insight items.

Gap:

- the live findings list currently renders only the first 12 insights. If more than 12 are generated, the counters can include hidden items without a visible `+ N more` note.

Template rule:

- future platforms should either render all findings or show an explicit hidden-count indicator.

### What To Investigate Next

Status: Ready as rule-based executive investigation guidance, not causal diagnosis.

Proven:

- findings are grouped by type.
- invalid KPI and Benchmark targets are flagged before performance conclusions.
- cards show data basis and confidence.
- intro copy is history-aware.
- recommendation wording is non-causal and framed as checks.
- local regression coverage and user validation exist for the hardening pass.

Limits:

- findings are rule-based, not causal.
- revenue and channel observations can still be GA4-attributed rather than full-funnel imported-revenue attribution.
- current live UI shows only the first 12 findings.

Template rule:

- future platforms may copy this pattern only as explainable recommendation guidance with evidence labels and conservative wording.

### Reports And Exports

Status: Partially reviewed, not fully certified as complete parity with live UI.

Proven:

- live-download Insights output includes the main Insights subsections and grouped/evidence-aware findings.
- scheduled PDF output has dedicated Insights rendering with freshness metadata and grouped/evidence-aware findings.

Gaps:

- scheduled PDF uses a separate server-side findings builder, not the same live frontend `insights` array.
- report output should be validated separately after each live UI logic change.

Template rule:

- future platforms should avoid separate divergent report-side logic when possible. If a separate renderer exists, it needs its own parity tests.

## Required Fix Queue Before Whole-Tab Production-Ready

1. Done in Commit 1: fix `Executive Financials` copy so it states the additive revenue model.
2. Done in Commit 1: fix `Trends` copy so 7d/30d non-rate metrics are described as rolling totals, while rate metrics are weighted averages.
3. Pending Commit 2: add a hidden-count indicator when more than 12 findings exist, or remove the 12-item cap.
4. Pending Commit 3: rework or relabel `Data Summary` averages so imported snapshot/to-date revenue is not presented as an exact daily average.
5. In progress by commit: add focused regression guards for each item above in the commit that fixes it.
6. Pending Commit 4: revalidate live-download and scheduled PDF output after those fixes.

## Required Commit Plan

Use this commit plan to finish the tab. Do not mark the whole tab production-ready until Commit 4 is complete and validated.

### Commit 1: Insights Copy Accuracy

Status: Implemented and locally validated. Pending user validation.

Scope:

- fix `Executive Financials` UI copy so it states `Revenue = GA4 native revenue + imported revenue` when both exist
- fix `Trends` UI copy so non-rate `7d` and `30d` metrics are described as rolling window totals, while rate metrics are described as weighted averages
- update live-download and scheduled-report copy if either path contains the same misleading wording

Regression guards:

- assert `Executive Financials` no longer says imported revenue is used only when GA4 revenue is missing
- assert the `Trends` description does not call 7d/30d non-rate metrics rolling daily averages
- assert the replacement copy mentions rolling totals and weighted averages

Validation:

- focused GA4 Insights regression tests
- `npm run check`
- `git diff --check`

Production-readiness status after this commit: still partially production-ready.

### Commit 2: Findings Completeness Visibility

Status: Pending.

Scope:

- add a visible `+ N more insights` indicator when the live `What to investigate next` section renders only the first 12 findings, or remove the 12-item cap
- keep grouping, severity ordering, data basis, confidence labels, and non-causal recommendation wording unchanged
- align live-download and scheduled-report output if they hide additional findings

Regression guards:

- assert generated finding counts and visible finding counts cannot silently disagree
- assert the hidden-count indicator appears when more findings exist than are rendered, if the cap remains
- assert grouped rendering and existing evidence labels remain intact

Validation:

- focused GA4 Insights regression tests
- `npm run check`
- `git diff --check`

Production-readiness status after this commit: still partially production-ready.

### Commit 3: Data Summary Accuracy

Status: Pending.

Scope:

- remove, rework, or clearly relabel `Data Summary` per-day averages that divide total financial values by available GA4 daily-history days
- ensure imported snapshot/to-date revenue is not presented as an exact daily average
- preserve exact financial totals from `Executive Financials`
- preserve channel/source/campaign/property scoping
- align live-download and scheduled-report Data Summary output with the live UI decision

Regression guards:

- assert imported/to-date revenue is not labeled as exact daily average math
- assert `Executive Financials` totals remain additive and unchanged
- assert report output does not reintroduce the old exact-average wording

Validation:

- focused GA4 Insights regression tests
- cross-tab financial consistency tests
- `npm run check`
- `git diff --check`

Production-readiness status after this commit: still partially production-ready until report parity and docs promotion are complete.

### Commit 4: Report Parity And Production-Readiness Promotion

Status: Pending.

Scope:

- revalidate live-download Insights output against the live UI sections
- revalidate scheduled PDF Insights output against the live UI sections, or document any intentionally different server-rendered behavior
- update this file from `Partially production-ready` to `Production-ready` only after Commit 1, Commit 2, and Commit 3 are implemented and validated
- update `GA4/INSIGHTS.md`, `GA4/README.md`, and any focused tracker docs needed to reflect the final status

Regression guards:

- assert live-download report output preserves corrected financial, trend, Data Summary, and findings-completeness wording
- assert scheduled PDF output preserves corrected financial, trend, Data Summary, and findings-completeness wording, or explicitly documents and tests a justified difference

Validation:

- focused GA4 Insights regression tests
- GA4 UI regression tests
- report-output regression tests
- `npm run check`
- `git diff --check`
- manual UI validation of the live Insights tab
- manual validation of downloaded and scheduled/report-generated Insights output where locally or deployably available

Production-readiness status after this commit: production-ready for the current GA4 Insights code scope, subject only to normal external runtime caveats such as live GA4 API processing, deployed scheduler execution, and deployed email/report delivery evidence.

## Stable Future Answer After Commit 4

If Commit 1 through Commit 4 are implemented, regression-covered, and validated, then the durable answer should be:

`GA4 Insights is production-ready as a GA4 platform tab and future-platform template for the current code scope. It remains subject to normal external runtime caveats for live GA4 API processing, deployed scheduler execution, and deployed report delivery evidence.`

That answer should not change in a future chat unless code changes, docs change, validation fails, new source requirements are added, or deployed evidence contradicts the documented assumptions.

## Proven Locally In Current Audit

Commands run:

- `npm test -- --run server/ga4-insights-regression.test.ts server/ga4-ui-regression.test.ts server/ga4-cross-tab-consistency.test.ts server/outcome-totals-ga4-fallback-regression.test.ts server/ga4-reporting-timezone-regression.test.ts`
- `npm run check`

Result:

- targeted GA4 regression checks passed
- TypeScript check passed

What those checks prove:

- known GA4 Insights wiring and regression guards still pass
- timezone/freshness UI strings are still present
- cross-tab calculation helpers still align for covered metrics
- current code compiles

What those checks do not prove:

- deployed scheduler execution
- live GA4 API data latency or correctness
- complete report parity for every possible custom report configuration
- visual correctness in a browser
- every future platform-source template requirement

## Future Platform Template Gate

A future source such as Meta, Google Ads, LinkedIn, or Custom Integration should not copy GA4 Insights until it has:

- a scoped source identity model
- persisted daily facts or an explicit no-history limitation
- completed-day cutoff semantics
- source/campaign/account/property scoping
- source-backed financial provenance
- window-compatible averages
- explicit freshness metadata
- evidence/confidence labels on recommendations
- non-causal recommendation language
- live UI and report-output parity tests

Until those exist, GA4 Insights should be used as a pattern reference, not a drop-in production-ready template.
