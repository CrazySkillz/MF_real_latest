# GA4 Insights Production Readiness

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## Purpose

This file is the canonical production-readiness source of truth for the whole GA4 `Insights` tab.

Use this file when asked whether GA4 Insights is robust, accurate, logical, production-ready, or suitable as a template for another platform source such as Meta, Google Ads, LinkedIn, or a custom integration.

This file also consolidates the completed `What to investigate next` hardening history. There is no separate `What to investigate next` production-readiness tracker anymore.

## Durable Future Answer

GA4 Insights is production-ready for the current GA4 code scope.

This answer should stay the same in future chats unless one of these changes:

- the relevant code changes
- validation fails
- source requirements change
- deployed evidence contradicts this document
- a new platform/source is being assessed instead of the existing GA4 implementation

Normal external caveats remain:

- live GA4 API processing latency cannot be proven from local code
- deployed scheduler execution must be verified in the deployed environment
- deployed report/email delivery evidence must be verified from deployed runs or provider evidence

## How To Use This File In A New Chat

Read in this order:

1. `Durable Future Answer`
2. `Current Scope`
3. `Section Production-Readiness Map`
4. `Validation Evidence`
5. `Future Platform Template`

When applying this to another platform source, do not copy GA4 implementation details blindly. Copy the section contracts and gates, then prove the new platform satisfies each gate with its own source model, scoping model, daily-history model, and report-output path.

## Current Scope

This certification applies to the current GA4 Insights tab for:

- live UI rendering
- downloaded Insights report output
- scheduled Insights PDF output
- current GA4 campaign/property/source scoping
- current GA4 daily-history and to-date data model
- current KPI and Benchmark context consumed by Insights

This certification does not automatically certify:

- Meta Insights
- Google Ads Insights
- LinkedIn Insights
- custom-upload Insights
- any future platform copied from this pattern
- provider-side delivery of scheduled emails
- live GA4 API behavior outside what the code and local tests can prove

## Root Cause Of Prior Confusion

Earlier reviews certified narrower slices and later questions were asked about broader scope.

The main mismatch was scope:

- the `What to investigate next` subsection was hardened first
- the whole Insights tab also includes Executive Financials, Trends, Data Summary, tracker cards, and report/export output
- those sections use different data windows and different confidence levels
- a focused subsection certification was not the same as whole-tab production readiness

This file fixes that documentation problem by keeping one whole-tab source of truth.

## Non-Negotiable Accuracy Rules

GA4 Insights must preserve:

- campaign scoping
- client scoping
- GA4 property scoping
- selected GA4 campaign/source scoping
- campaign reporting timezone behavior
- KPI and Benchmark calculations
- financial source provenance
- report output parity where executive-facing copy or meaning is duplicated

Do not change calculations, attribution, source ownership, scheduler behavior, or report behavior unless a traced root cause proves a bug in that exact path.

## Data Path Summary

Primary live UI path:

`GA4 source connection -> persisted GA4 daily/to-date facts -> API response -> frontend Insights model -> live Insights sections`

Report path:

`same campaign/source data model -> report renderer -> downloaded PDF or scheduled PDF output`

Important meaning:

- live UI and reports may have separate renderer code, but they must preserve the same executive-facing meaning
- report output needs its own regression guards when live UI copy or finding logic changes
- Trends history is completed-day history, not today's intraday activity
- same-day GA4 Measurement Protocol events can update Overview or to-date values before they become completed Trends rows

## Section Production-Readiness Map

### 1. Executive Financials

Status: Production-ready for current GA4 code scope.

User-facing role:

- executive financial health summary for the selected GA4 campaign

Inputs:

- active spend-source totals
- GA4 native revenue
- imported revenue sources when connected
- selected campaign/client/source scope

Current logic:

- `Spend` comes from active spend-source totals
- `Revenue` is GA4 native revenue plus imported revenue sources when present
- `Profit` derives from revenue minus spend
- `ROAS` and `ROI` derive from the same spend and revenue values
- Pipeline Proxy is excluded from confirmed revenue calculations
- copy is conditional on actual connected spend and revenue sources
- source provenance appears in the shared `Sources used` footer
- date-range/freshness metadata is not shown in this section because Trends owns that context

Proven locally:

- source copy no longer claims imported revenue or source-backed spend when those sources are absent
- financial wording is aligned across live UI and report output where relevant
- additive revenue model is regression-covered

Partially reviewed / environment dependent:

- live source values depend on deployed refresh/import state

Not locally verifiable:

- provider-side GA4 processing latency
- deployed import/scheduler timing

Future-platform template rule:

- copy this section only when the new platform has source-backed spend and revenue provenance
- do not show a financial total unless its source set can be named
- do not append freshness/date-range copy to Executive Financials unless that platform's product design explicitly makes this section the freshness owner

### 2. Trends

Status: Production-ready for current GA4 code scope, with deployment freshness caveats.

User-facing role:

- completed-history trend view for selected GA4 campaign metrics

Inputs:

- persisted GA4 daily facts
- selected GA4 property
- selected GA4 campaign/source scope
- campaign reporting timezone
- refresh timestamps

Current logic:

- `Daily` shows completed day-by-day values
- `7d` and `30d` show rolling totals for non-rate metrics and weighted averages for rates
- `Monthly` compares calendar months
- today's intraday data is excluded from Trends until it becomes a completed reporting day
- missing GA4 rows are not synthesized as zero-value days
- `Completed-day cutoff` shows the latest reporting day allowed into Trends
- `Latest imported day` shows the latest persisted daily row actually visible
- `Reporting timezone` comes from campaign configuration
- `Last refreshed` and `Expected refresh` explain freshness
- report-rendered Trends chart follows the live UI visual contract for the data it renders

History gates:

- `Daily`: at least 2 completed daily rows
- `7d`: at least 14 completed daily rows
- `30d`: at least 60 completed daily rows
- `Monthly`: at least 2 calendar months

Proven locally:

- copy accurately describes rolling totals and weighted averages
- freshness labels distinguish completed cutoff from latest imported row
- report chart style is aligned with the live UI chart contract
- local regression tests cover the corrected wording and report rendering contract

Partially reviewed / environment dependent:

- scheduler execution and persisted daily-row freshness depend on deployed jobs
- enough live history for 7d, 30d, and Monthly modes depends on elapsed completed days

Not locally verifiable:

- exact GA4 processing latency after Measurement Protocol seed runs
- deployed scheduler timing without deployed logs

Future-platform template rule:

- copy this section only if the new platform has persisted daily facts or a clearly stated no-history limitation
- every platform must define completed-day cutoff semantics before showing trend history
- every platform must expose freshness metadata instead of implying data is current when it may be delayed

### 3. Data Summary

Status: Production-ready for current GA4 code scope as contextual summary.

User-facing role:

- compact operational context before deeper findings

Inputs:

- current campaign values
- financial revenue and spend values shared with Executive Financials
- GA4 acquisition/channel breakdown rows

Current logic:

- financial values use the same top-line financial model as Executive Financials
- mixed-source financial values are shown as totals, not exact per-day averages
- channel rows are normalized display context, not raw source-detail truth

Proven locally:

- old exact daily-average wording was removed for mixed-source/to-date financial values
- live UI, live-download, and scheduled PDF output use source/window-neutral labels
- regression tests cover the corrected wording

Partially reviewed / environment dependent:

- row values depend on current imported and GA4 source data freshness

Not locally verifiable:

- provider processing latency for newest GA4 rows

Future-platform template rule:

- do not label a value as an average unless every contributing source has compatible daily rows and the same time window
- if values are mixed-source snapshots or to-date totals, label them as totals or context, not exact averages

### 4. Insight Tracker Cards

Status: Production-ready for current GA4 code scope.

User-facing role:

- quick count of generated findings by priority

Inputs:

- generated Insights finding list
- severity classification
- visible finding cap state

Current logic:

- `Total insights` counts generated insight items
- `High priority` counts high-severity insight items
- `Needs attention` counts medium-severity insight items
- when findings are capped, the UI and reports disclose hidden findings with `+ N more insights`

Proven locally:

- hidden-count visibility is regression-covered
- grouped rendering and evidence labels remain covered

Partially reviewed / environment dependent:

- actual counts depend on current campaign configuration, KPI/Benchmark state, and imported data

Not locally verifiable:

- none beyond live data availability

Future-platform template rule:

- either render all findings or disclose any cap clearly
- tracker cards must derive from the same finding list that users can inspect

### 5. What To Investigate Next

Status: Production-ready as rule-based executive investigation guidance, not causal diagnosis.

User-facing role:

- prioritized, explainable next checks for marketing users and executives

Inputs:

- setup/configuration state
- GA4 completed daily history
- GA4 to-date values
- spend and revenue source state
- saved KPI targets
- saved Benchmark targets
- channel and campaign observations

Current logic:

- findings are grouped by investigation type
- invalid KPI or Benchmark values are flagged as configuration issues before performance conclusions
- cards show data basis and confidence
- intro copy is history-aware
- recommendation wording is conservative and non-causal
- report output preserves grouped findings, evidence metadata, and `Recommended check:` wording

Current groups:

- `Data setup issues`
- `Targets off track`
- `Trend signals`
- `Revenue and spend checks`
- `Informational context`

Completed hardening now consolidated here:

- grouped findings by type
- invalid KPI/Benchmark configuration detection
- data-basis and confidence labels
- history-aware trend intro copy
- non-causal recommendation wording
- live UI and report-output regression coverage

Proven locally:

- grouped UI rendering is regression-covered
- invalid percent targets above 100% are flagged before normal behind-target logic
- non-positive invalid count/currency/ratio/percent targets are handled as configuration issues where applicable
- history-aware copy changes based on available completed daily rows
- reports preserve the action intro, grouping, data basis, confidence, and recommendation label

Partially reviewed / environment dependent:

- actual finding set depends on campaign configuration and live imported data state

Not locally verifiable:

- whether a recommendation identifies the real-world root cause; recommendations are intentionally not causal proof

Future-platform template rule:

- use this pattern only as explainable investigation guidance
- every recommendation must identify its data basis and confidence
- do not claim causality unless the rule directly proves a setup/configuration issue

### 6. Reports And Exports

Status: Production-ready for current GA4 code scope.

User-facing role:

- executive-ready downloadable and scheduled report representation of Insights

Inputs:

- same campaign/source data model used by Insights
- live-download report renderer
- scheduled PDF renderer

Current logic:

- report output preserves corrected Executive Financials copy
- report output preserves Trends freshness context and UI-aligned chart styling
- report output preserves Data Summary wording
- report output preserves grouped/evidence-aware findings and hidden-finding counts

Known implementation difference:

- scheduled PDF uses a separate server-side findings builder rather than the live frontend `insights` array
- this is retained, but parity-sensitive copy and evidence behavior are regression-covered
- scheduled PDF Trends rendering currently uses the server-supported sessions trend rather than persisting a user-selected live metric/mode

Proven locally:

- report parity regression checks passed for the corrected executive-facing copy and evidence behavior
- UI-aligned Trends chart styling is regression-covered for report output

Partially reviewed / environment dependent:

- generated PDF visual inspection in deployed environment
- scheduled job execution in deployed environment

Not locally verifiable:

- provider-side email delivery confirmation

Future-platform template rule:

- avoid separate divergent report-side logic when possible
- if a separate renderer exists, it must have parity tests for all executive-facing copy, metric meaning, freshness labels, and hidden/capped content disclosure

## Completed Whole-Tab Fix Queue

The following fixes are complete and included in the current production-ready status:

1. Executive Financials source copy is conditional on actual connected spend and revenue sources.
2. Executive Financials no longer shows date-range clutter owned by Trends.
3. Trends copy accurately describes rolling totals for non-rate metrics and weighted averages for rates.
4. Trends freshness labels distinguish completed cutoff, latest imported day, reporting timezone, last refresh, and expected refresh.
5. Report-rendered Trends chart is aligned with the live UI visual contract.
6. Findings capped by the UI or report output disclose hidden count with `+ N more insights`.
7. Data Summary no longer labels mixed-source/to-date financial totals as exact per-day averages.
8. `What to investigate next` is grouped, evidence-labeled, history-aware, and non-causal.
9. Invalid KPI/Benchmark configuration is surfaced before normal performance conclusions.
10. Live UI, live-download report, and scheduled PDF output have focused regression guards for corrected executive-facing behavior.

## Validation Evidence

Locally run checks from the completed hardening pass:

- `npm test -- --run server/ga4-insights-report-parity-regression.test.ts server/ga4-insights-copy-accuracy-regression.test.ts server/ga4-insights-data-summary-accuracy-regression.test.ts server/ga4-insights-findings-completeness-regression.test.ts`
- `npm test -- --run server/ga4-insights-data-summary-accuracy-regression.test.ts server/ga4-insights-copy-accuracy-regression.test.ts server/ga4-insights-findings-completeness-regression.test.ts server/ga4-insights-regression.test.ts server/ga4-ui-regression.test.ts server/ga4-cross-tab-consistency.test.ts server/outcome-totals-ga4-fallback-regression.test.ts server/ga4-financial-rules.test.ts`
- `npm run check`
- `git diff --check` on scoped documentation/code changes

User validation reported passed for the Commit 1-4 Insights production-readiness hardening pass.

These checks prove:

- corrected Executive Financials wording is covered
- corrected Trends wording is covered
- Data Summary total/average wording is covered
- finding completeness visibility is covered
- grouped findings, data-basis/confidence labels, and `Recommended check:` wording are covered
- report-output parity for corrected executive-facing behavior is covered
- current TypeScript code compiles for the checked state

These checks do not prove:

- live GA4 API processing latency
- deployed scheduler execution
- deployed email delivery
- visual correctness in every browser/PDF renderer without a deployed/manual visual pass
- production readiness of future non-GA4 platforms

## Future Platform Template

Use this section as the template for refining Meta, Google Ads, LinkedIn, or other platform Insights sections.

A future platform is not production-ready until every gate below is answered with platform-specific evidence.

### Platform Identity Gate

The future platform must define:

- platform name
- source/account/property/customer ID
- selected campaign/ad set/ad group/source scope
- client ownership boundary
- campaign ownership boundary
- API route ownership guard
- storage/read/write boundary

Required answer format:

`This platform's Insights data is scoped by [client], [campaign], [platform source/account/property], and [selected source campaign/ad group/etc]. It does not include unrelated platform data.`

### Financial Gate

The future platform must define:

- spend source
- revenue source
- whether revenue is native, imported, or additive
- whether Pipeline Proxy or estimated values are excluded
- how profit, ROAS, and ROI are derived
- visible source provenance copy

Required answer format:

`Spend comes from [source]. Revenue comes from [source set]. Profit/ROAS/ROI derive from those same values. The UI names those sources and does not imply unavailable sources are connected.`

### Daily History Gate

The future platform must define:

- whether persisted daily facts exist
- completed-day cutoff rule
- reporting timezone rule
- latest imported day rule
- missing-row behavior
- required history thresholds for each trend mode

Required answer format:

`Trends use completed daily rows through [cutoff rule]. Missing source rows are [not synthesized / explicitly synthesized with reason]. Freshness is shown with [labels].`

### Metric Window Gate

The future platform must define:

- which values are to-date totals
- which values are daily rows
- which values are rolling-window totals
- which values are weighted rates
- which values are averages
- which mixed-source values cannot be averaged safely

Required answer format:

`The UI labels each metric by its actual window. Mixed-source totals are not labeled as averages unless every source has compatible daily rows.`

### Recommendation Evidence Gate

The future platform must define:

- finding categories
- data basis labels
- confidence labels
- invalid configuration handling
- non-causal wording rules
- history-aware copy rules

Required answer format:

`Recommendations are checks, not causal claims, unless a setup/configuration rule directly proves the issue. Each card shows basis and confidence.`

### Report Parity Gate

The future platform must define:

- live UI renderer
- download renderer
- scheduled report renderer
- any intentionally different report behavior
- regression tests covering parity-sensitive copy and metric meaning

Required answer format:

`Report output preserves the live UI's executive-facing meaning for financials, trends, summary labels, findings, evidence labels, and capped-content disclosure.`

### Validation Gate

The future platform must provide:

- focused unit/regression tests
- UI path validation
- report output validation
- source scoping validation
- ownership/access validation
- freshness/scheduler validation where applicable
- clear separation of proven, partially reviewed, and not locally verifiable items

Required answer format:

`Proven: [...]. Partially reviewed: [...]. Not locally verifiable: [...].`

## Future Platform Readiness Checklist

Before calling another platform's Insights tab production-ready, confirm:

- source identity and scoping are proven
- financial provenance is visible and accurate
- daily-history semantics are defined
- freshness labels are visible where history is used
- metric windows are labeled correctly
- mixed-source totals are not mislabeled as exact averages
- invalid KPI/Benchmark configuration is handled before performance conclusions
- recommendations are evidence-labeled and non-causal
- capped findings disclose hidden counts
- live UI and report output preserve the same executive-facing meaning
- tests cover the platform-specific implementation
- deployed-only behavior is separated from locally proven behavior

## Stable Response For Future Chats

If no relevant code, docs, data-source requirements, or validation evidence changed, answer:

`GA4 Insights is production-ready for the current GA4 code scope. The canonical reference is GA4/INSIGHTS_PRODUCTION_READINESS.md. It can be used as a template for other platform sources only by applying the Future Platform Template gates in that file and proving each gate for the new source.`
