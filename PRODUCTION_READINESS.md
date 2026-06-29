# Production Readiness Checklist


## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## 1. Purpose

This document is the mandatory reusable production-readiness checklist for this repository.

Use it to audit, refine, validate, and certify analytics-sensitive sections and sources across GA4, Meta, Google Ads, LinkedIn, Google Sheets, Custom Uploads, and future sources.

This document does not replace platform-specific or section-specific production-readiness docs. It defines the general checklist those docs must apply. Platform and section docs remain the durable source of truth for the specific implementation, current status, validation evidence, caveats, and reusable source-specific template.

The goal is to prevent incomplete readiness claims. A section or source is production-ready only when the visible values, source paths, fallback paths, lifecycle paths, downstream propagation paths, tests, docs, and validation evidence are all traced or explicitly classified as not locally verifiable.
Durable certification carry-forward rule: when a section-specific readiness doc records a production-ready status with a complete value inventory, downstream propagation matrix, lifecycle matrix, negative cases, tests, docs, and deployed/provider evidence where required, that certification remains the stable answer in future chats and on later dates absent code changes, provider/config changes, failed validation, contradictory evidence, newly reported bugs, or changed requirements. A changed calendar date alone does not invalidate a completed certification.

Reusable-template rule: a certified section can be used as an implementation and audit template for another platform or source, but never as proof that the target platform or source is production-ready. The target must receive its own value inventory, source/scoping trace, lifecycle trace, downstream propagation matrix, tests, deployed/provider evidence where required, and section-specific readiness documentation.

## 2. When To Use This Document

Read and apply this document before:

- any production-readiness audit
- any analytics-sensitive feature refinement
- any request to certify a section, tab, source, or platform as production-ready
- any work that adds, copies, or adapts a data source
- any work that changes revenue, spend, conversions, attribution, source scoping, downstream reports, alerts, notifications, schedulers, or snapshots
- any future-platform implementation using GA4 or another existing platform as a template
- any post-bugfix readiness update where a prior readiness claim may need revision

Do not use this document as permission to broaden a task. If the user requests a narrow fix, first perform the root-cause trace, make the smallest safe fix, and document which broader readiness paths remain unreviewed.

## 3. Required Reading Order

For production-readiness work, read in this order:

1. `AGENTS.md`
2. `ARCHITECTURE_USER_JOURNEY.md`
3. `PRODUCTION_READINESS.md`
4. the platform entry doc, such as `GA4/README.md`
5. the relevant platform development workflow doc, such as `GA4_DEVELOPMENT_WORKFLOW.md`
6. the section functional doc, such as `GA4/OVERVIEW.md`, `GA4/KPIS.md`, or equivalent
7. the section production-readiness doc, such as `GA4/OVERVIEW_PRODUCTION_READINESS.md`, if one exists
8. source-specific docs for revenue, spend, refresh, scheduler, reports, or downstream consumers when the section touches those paths
9. the exact code paths, tests, and docs referenced by the target section

If no section-specific production-readiness doc exists, create or update one only when the user asks for durable readiness documentation or when the audit would otherwise be lost.

## 4. Non-Negotiable Production-Readiness Rules

- If you cannot produce the complete value inventory and downstream propagation matrix, you must not call the section production-ready.
- A passing test suite is not enough. Only claim readiness if the test suite covers the traced value paths or you explicitly list uncovered paths as not locally verifiable.
- A completed or proposed fix queue is not evidence of production readiness. It only makes the section or source eligible for certification after the full checklist is rerun against the implemented code.
- A previous readiness claim is not evidence. Re-verify the actual current code path before repeating it.
- If a new bug is found after a production-ready claim, immediately mark the affected value path as unproven until the root cause and missing coverage are fixed.
- For every fetched metric path, prove query dimensions, filters, ordering, limits, fallback query shape, merge keys, exact-match rules, negative cases, and downstream consumers before calling it ready.
- Do not describe a path as production-ready when coverage proves only a happy path or only one fallback shape.
- Do not use "overclaimed readiness" as an explanation without adding a concrete prevention rule, regression test, and documentation update.
- Do not infer readiness from adjacent sections.
- Do not infer scheduler safety from UI safety.
- Do not infer delete safety from add or edit safety.
- Do not infer source-modal correctness from total-card correctness.
- Do not infer report correctness from live UI correctness.
- Do not infer deployed/provider readiness from local code review.
- Do not call a value correct unless its source, scope, date window, fallback behavior, formula, and downstream consumers are identified.
- Do not allocate financial values into rows unless exact row-level matching keys exist and the product contract explicitly allows it.
- Do not combine incompatible source windows by taking per-metric maximums unless the product contract explicitly says to do so and the behavior is labeled.
- Do not change code until root cause is confirmed and the smallest safe fix queue is identified.
- Preserve existing architecture, scoping, response shapes, scheduler behavior, alert behavior, notification behavior, report behavior, and source ownership rules unless the traced bug is in that exact path.

Every readiness answer must separate:

- proven locally
- partially reviewed
- not locally verifiable
- recommended fixes
- deferred deployed/provider validation

## 5. Complete Value Inventory Checklist

Create a complete inventory before claiming readiness.

Inventory every visible and downstream value in the target scope:

- summary cards
- financial cards
- health/status cards
- tables and row-level columns
- source modals and provenance rows
- filters, date-range labels, and selected-source labels
- report output values, including browser downloads and scheduled/server-generated output
- KPI and Benchmark current values that read from the section
- Insights, Ad Comparison, Campaign DeepDive, alerts, notifications, scheduler snapshots, and exports that read from the section
- empty, zero, unavailable, loading, stale, and fallback states

For each value, record:

- display location and label
- internal variable, response field, or schema field
- source platform and source family
- API route, query key, service, storage call, and provider query
- persisted table or external provider source
- row grain, such as campaign, ad, page, event, source, day, or account
- date window and timezone rule
- client, campaign, platform, account/property/customer, and selected source scope
- formula, including numerator and denominator for derived metrics
- fallback order and fallback scope
- zero, null, unavailable, and missing-data semantics
- whether the value is native, imported, derived, allocated, or exact matched
- source modal or provenance reconciliation
- downstream consumers
- test coverage and validation evidence
- status: proven, partially reviewed, not locally verifiable, or blocked by a confirmed bug

Readiness is blocked if any executive-facing value in scope has no source path, date window, scope, formula, fallback rule, or downstream consumer classification.

## 6. End-to-End Trace Checklist

Trace each value through the full path that applies to it:

- source setup or campaign setup
- saved source configuration and selected platform scope
- preview payloads and save payloads
- persisted records and mapping/config metadata
- provider query, import, refresh, or upload parser
- storage method and ownership checks
- API route and response shape
- frontend query, merge, fallback, and derived calculation layer
- visible render
- source modal or provenance display
- edit, update, delete, deactivate, reconnect, and refresh lifecycle
- scheduler or background job path
- report, export, snapshot, and email output path
- KPI, Benchmark, Insight, Ad Comparison, Campaign DeepDive, alert, and notification propagation path where applicable

For each lifecycle path, document whether it is:

- proven by local code trace and tests
- partially reviewed but not fully traced
- not locally verifiable without provider/deployed access
- not implemented by product design
- broken and assigned to the fix queue

## 7. Financial Metric Checklist

Apply this checklist to revenue, spend, profit, ROAS, ROI, CPA, pipeline, budget, and any financial proxy:

- identify every native platform financial source
- identify every imported revenue source
- identify every imported spend source
- prove active-source-only inclusion rules
- prove deleted, inactive, orphaned, or stale records are excluded
- prove source modal totals reconcile to card totals
- prove exact campaign/source/property/account scoping
- prove the date window and timezone used by each financial input
- prove the conversion source used for CPA
- prove pipeline, opportunity, lead, forecast, or proxy values are separated from confirmed revenue unless explicitly designed otherwise
- prove imported revenue is added only once
- prove spend is not inferred from web analytics sources that do not provide spend
- prove Profit, ROAS, ROI, and CPA derive from the same authoritative source set shown to the user
- prove report output and downstream consumers use the same financial model or document the intentional difference
- prove source add, edit, delete, refresh, scheduler, and existing damaged-data boundaries for each financial source family

If previous bugs could have persisted bad financial records, fix the forward path first, then perform a read-only production data inventory before any cleanup.

## 8. Table And Row-Level Metric Checklist

For every table, record:

- table purpose
- row grain
- row source
- date range
- platform and campaign scope
- filters and sort behavior
- every column's source and formula
- whether row totals are expected to reconcile to top cards
- why row totals may not reconcile, such as deduplicated users, multi-touch rows, or different grain
- whether revenue or spend appears at row level
- whether financial values are native, imported, exact matched, or intentionally absent
- whether fallback rows can be added or only existing rows can be supplemented
- whether fallback values require exact row-level keys
- empty, zero, unavailable, and loading behavior

Do not allocate campaign-level revenue, spend, conversions, or users into row-level tables unless exact row-level identifiers exist and the product contract explicitly says that allocation is allowed.

## 9. Fallback And Attribution Checklist

For every fallback or attribution path, prove:

- why fallback is needed
- when fallback is allowed
- when fallback is forbidden
- which source scope it stays inside
- which fields it can supplement
- which fields it cannot overwrite
- whether it can add rows or only supplement existing exact rows
- exact matching keys
- null and zero behavior
- date-window compatibility
- downstream effects
- test coverage for both fallback and non-fallback cases

Fallbacks must not broaden from a selected campaign, source, account, property, customer, sheet, upload, or platform context into unrelated data.

## 10. Downstream Propagation Checklist

Build a downstream propagation matrix for every authoritative value.

At minimum, classify whether each value feeds:

- the live section UI
- source modals
- KPIs
- Benchmarks
- Ad Comparison or platform comparison sections
- Insights
- Reports
- browser-generated downloads
- scheduled/server-generated reports
- Campaign DeepDive aggregates
- Executive Summary
- alerts
- notifications
- scheduler snapshots
- exports
- external emails or webhooks

For each consumer, record:

- the field or variable consumed
- whether the consumer uses the same source/window as the originating section
- whether any difference is intentional and documented
- whether values are recomputed, cached, snapshotted, or read live
- whether tests cover the propagation path
- whether deployed/provider validation is required

No readiness claim is complete without this matrix.

## 11. Test Coverage Checklist

Tests must map to the traced value paths.

For each test, record:

- command
- file names
- behavior covered
- source path covered
- fallback path covered
- downstream consumer covered
- negative case covered
- what the test does not prove

Required test classes where relevant:

- source scoping and ownership checks
- metric formula and source hierarchy checks
- row-level exact-match and no-allocation checks
- financial additivity and active-source checks
- source lifecycle checks
- scheduler and refresh checks
- report parity checks
- downstream propagation checks
- zero, null, unavailable, and missing-data checks

A passing compile or test run is evidence only for the paths it covers.

## 12. Documentation Checklist

Documentation must align with code implementation.

Update or create the relevant docs so future sessions can recover the same answer:

- platform README or entry doc
- section functional doc
- section production-readiness doc
- source-specific docs, if financial/source behavior changed
- refresh, scheduler, reporting, or downstream docs when those paths changed

Each readiness doc should state:

- current status
- scope included
- scope excluded
- complete value inventory summary
- downstream propagation matrix summary
- exact fixes completed
- root causes fixed
- files changed
- validation commands and results
- proven locally
- partially reviewed
- not locally verifiable
- deferred deployed/provider validation
- stable future answer
- future-platform replication rules

Do not let docs claim production readiness when the code path, tests, or validation evidence do not support it.

## 13. Validation Checklist

Before finalizing a readiness claim, validate:

- the exact reported bug or audit finding
- the fixed flow
- neighboring flows that share the same source, endpoint, storage method, calculation, or response shape
- downstream consumers in the propagation matrix
- source modal/provenance reconciliation
- report output when values appear in reports
- scheduler/refresh behavior where values are refreshed or snapshotted
- auth, ownership, campaign, platform, and source boundaries
- no unrelated files were changed
- docs match the final implementation
- the full production-readiness checklist has been rerun after the fixes were implemented, not just planned

Separate validation into:

- local automated validation
- local manual validation
- production-like/deployed validation
- provider validation
- not locally verifiable items

If provider or deployed evidence is required, do not convert it into a local production-ready claim. Mark it as an external validation gate.

## 14. Commit Checklist

Before committing:

- inspect `git status --short`
- identify unrelated dirty files and leave them untouched
- review the unstaged diff for only intended files
- run `git diff --check` for changed docs or code
- run targeted tests only when code changed
- stage only files for the current fix or documentation update
- confirm staged diff contains only intended files
- commit one logical fix or documentation update at a time
- record the commit hash

Do not mix broad cleanup, formatting churn, unrelated docs, or speculative refactors into a production-readiness commit.

## 15. Required Final Answer Format

A production-readiness final answer must include:

- status: production-ready, not production-ready, partially reviewed, or blocked
- scope reviewed
- proven locally
- partially reviewed
- not locally verifiable
- recommended fixes or completed fixes
- certification gate result: whether completed fixes made the section production-ready or only eligible for certification
- validation commands and results
- documentation updated
- commit hash, if committed
- exact stable future answer, if readiness is certified

If the section is not production-ready, say that directly and list the smallest safe fix queue. If the section is production-ready only for current local code scope, say that and keep deployed/provider caveats separate.

## 16. Reusable One-Shot Production-Readiness Prompt

Copy this prompt into a new chat and replace the bracketed values. Use it for one platform, source, tab, or section at a time.

```text
Continue in C:\Users\me\Documents\MF_real_latest.

Task:
Do a comprehensive root-cause and production-readiness audit for [PLATFORM/SOURCE] [TAB/SECTION].

Goal:
Determine whether [PLATFORM/SOURCE] [TAB/SECTION] is production-ready for the current code scope. If it is not production-ready, identify the exact smallest safe fix queue. Do not implement code changes until the audit proves the root cause of each issue and identifies the smallest safe fix queue. After the fix queue is agreed or explicitly requested, implement one fix at a time with minimal diffs and validation.

Read first, in this order:
1. AGENTS.md
2. ARCHITECTURE_USER_JOURNEY.md
3. PRODUCTION_READINESS.md
4. [PLATFORM README OR ENTRY DOC]
5. [PLATFORM DEVELOPMENT WORKFLOW DOC, IF ONE EXISTS]
6. [TAB/SECTION FUNCTIONAL DOC]
7. [TAB/SECTION PRODUCTION_READINESS DOC, IF ONE EXISTS]
8. [SOURCE/FINANCIAL/REFRESH/REPORTING DOCS IF THE SECTION TOUCHES MONEY, SOURCES, SCHEDULERS, REPORTS, ALERTS, OR NOTIFICATIONS]

Constraints:
- Do not touch unrelated dirty files.
- Preserve existing architecture, route ownership, storage conventions, shared contracts, campaign scoping, platform scoping, source ownership, scheduler behavior, alert behavior, notification behavior, report behavior, and existing API response shapes.
- Do not reopen unrelated sections unless this section directly consumes one of their values.
- Do not infer readiness from adjacent sections.
- Do not implement speculative fixes.
- Do not change code until root cause is confirmed.
- Prefer the smallest safe fix with the fewest files and lines changed.

Mandatory readiness rules:
- If you cannot produce the complete value inventory and downstream propagation matrix, you must not call the section production-ready.
- A passing test suite is not enough. Only claim readiness if the test suite covers the traced value paths or you explicitly list uncovered paths as not locally verifiable.
- A completed or proposed fix queue is not evidence of production readiness. It only makes the section or source eligible for certification after the full checklist is rerun against the implemented code.
- A previous readiness claim is not evidence. Re-verify the actual current code path before repeating it.
- If a new bug is found after a production-ready claim, mark the affected path unproven until the root cause, missing coverage, and documentation are fixed.
- For every fetched metric path, prove query dimensions, filters, ordering, limits, fallback query shape, merge keys, exact-match rules, negative cases, and downstream consumers before calling it ready.
- Do not describe a path as production-ready when coverage proves only a happy path or only one fallback shape.
- Do not use "overclaimed readiness" as an explanation without adding a concrete prevention rule, regression test, and documentation update.
Audit requirements:
1. Build a complete value inventory for every visible and downstream value in [TAB/SECTION].
   Include cards, tables, row-level columns, modals, source provenance, filters, date-range labels, report values, KPI/Benchmark values, Insights values, Ad Comparison/platform comparison values, Campaign DeepDive values, alerts, notifications, scheduler snapshots, exports, empty states, zero states, unavailable states, and loading/stale states.

2. For every value, record:
   - display location and label
   - internal variable or response field
   - API route and frontend query key
   - service/storage/provider source
   - persisted table or external provider source
   - row grain
   - date window and timezone
   - client/campaign/platform/account/property/customer/source scope
   - formula and dependencies
   - fallback order and fallback scope
   - zero/null/unavailable semantics
   - whether it is native, imported, derived, allocated, or exact matched
   - downstream consumers
   - test coverage
   - validation status: proven, partially reviewed, not locally verifiable, or broken

3. Build the complete downstream propagation matrix.
   For each authoritative value, trace whether it feeds:
   - live UI
   - source modals
   - KPIs
   - Benchmarks
   - Ad Comparison or platform comparison
   - Insights
   - Reports
   - browser downloads
   - scheduled/server-generated reports
   - Campaign DeepDive aggregates
   - Executive Summary
   - alerts
   - notifications
   - scheduler snapshots
   - exports
   - external emails or webhooks

4. Trace the end-to-end path for each value:
   - setup or source connection
   - saved configuration and selected scope
   - preview/save payloads
   - persisted records and mapping metadata
   - provider query/import/refresh/upload parser
   - storage method and ownership checks
   - API route and response shape
   - frontend query and merge layer
   - final render
   - source modal/provenance
   - edit/update/delete/deactivate/reconnect
   - scheduler/refresh path
   - report/export/snapshot/email path
   - downstream consumers

5. For financial metrics, prove:
   - native revenue source
   - imported revenue source set
   - spend source set
   - active-source-only inclusion
   - source modal reconciliation
   - date window and timezone
   - conversion source for CPA
   - Profit, ROAS, ROI, and CPA formulas
   - pipeline/proxy exclusion from confirmed revenue unless explicitly designed otherwise
   - no duplicate inclusion
   - no allocation without exact row-level identifiers
   - add/edit/delete/refresh/scheduler lifecycle per source family
   - existing damaged-data inventory if prior bugs may have persisted bad records

6. For tables, prove:
   - row grain
   - row scope
   - date range
   - column source and formula
   - row-total reconciliation expectations
   - exact-match rules for row-level supplements
   - no campaign-level allocation into row-level values unless explicitly designed and labeled

7. For fallback and attribution, prove:
   - why fallback exists
   - when it is allowed
   - when it is forbidden
   - exact scope boundary
   - fields it may supplement
   - fields it may not overwrite
   - whether it may add rows
   - exact matching keys
   - tests for fallback and non-fallback cases

8. Compare implementation against documentation.
   Update documentation only after code behavior is proven. The docs must align with the code implementation and must clearly separate proven local readiness from deployed/provider caveats.

9. Produce a findings report before coding.
   Clearly separate:
   - proven production-ready paths
   - partially reviewed paths
   - not locally verifiable paths
   - confirmed bugs
   - recommended fixes
   - external deployed/provider validation gates

10. If fixes are required, organize them into the smallest safe commit queue.
    For each proposed commit, state:
    - root cause
    - files to change
    - exact behavior preserved
    - exact behavior changed
    - tests to run
    - documentation to update
    - downstream propagation checks

Implementation rules:
- Implement only after the audit identifies the exact smallest safe fix.
- Fix one root cause at a time.
- Do not refactor.
- Do not change unrelated behavior.
- Do not broaden scopes.
- Do not change response shapes unless the traced root cause requires it.
- Add or update focused regression coverage when the bug is analytics-sensitive and repeatable.

Validation rules:
- Run targeted tests that cover the changed value paths.
- Run type/check commands when code changed and the repository normally requires them.
- Run git diff checks for changed files.
- Do not run broad or unrelated tests unless needed by the changed path.
- If this is documentation-only, run only documentation validation such as git diff --check unless code changed accidentally.

Required final answer:
- Status: [production-ready / not production-ready / partially reviewed / blocked]
- Scope reviewed
- Complete value inventory summary
- Downstream propagation matrix summary
- Proven locally
- Partially reviewed
- Not locally verifiable
- Fixes implemented or proposed
- Certification gate result: whether completed fixes made the section production-ready or only eligible for certification
- Tests and validation run
- Documentation updated
- Commit hash, if committed
- Stable future answer, if and only if readiness is certified
```
