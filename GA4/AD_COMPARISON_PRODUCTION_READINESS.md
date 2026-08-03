# GA4 Ad Comparison Production Readiness

<!-- ga4-ad-comparison-certification-status: PRODUCTION_READY -->

## Controlling Current Status

**Status: PRODUCTION_READY. The live GA4 Ad Comparison tab is clean-certified at `635b65c1db35a39a6f1466cab0cc1dceab04db31`.**

This is the only reusable current-status answer in this document. The June 27,
2026 conclusion below is historical and revoked. It had no exact certified Git
SHA, complete dependency boundary, machine-readable invalidation gate, or
complete current value/negative-state inventory. Direct dependencies changed
after that review.

Audit baseline:

- audit opened: 2026-08-03
- baseline Git SHA: `b91d096831bc04504ca7a3cae4191d28c8fa89ee`
- certification status: `PRODUCTION_READY`; certified SHA:
  `635b65c1db35a39a6f1466cab0cc1dceab04db31`
- production writes, provider refreshes, report sends, and cleanup: not
  performed
- unrelated dirty worktree changes: excluded and preserved

Final local review:

- reviewed implementation SHA:
  `08ea74af0344538259cd34ff1d8487492f4c8253`
- exact deployed and production-evidence SHA:
  `635b65c1db35a39a6f1466cab0cc1dceab04db31`
- assessment: all identified Critical and Major implementation findings are
  closed locally; Minor AC-06 is also closed
- certification: `PRODUCTION_READY`; the exact deployed revision, live provider,
  source inventory, authorization, calculations, rendered tab values, focused
  tests, TypeScript, production build, dependency hashes, and certification gate
  pass for the boundary below

### Finite validation plan

1. Freeze the revision, configuration, surface, source, and consumer boundary.
2. Trace every value through provider/source query, persistence, API,
   post-fetch transforms, and every live tab surface.
3. Trace auth, tenant/property/platform isolation and every applicable source
   lifecycle, refresh, recompute, failure, and delete path.
4. Fix all Critical and Major findings with the smallest safe changes and
   focused real-path regressions.
5. Run focused and affected tests, TypeScript, production build, and safe
   read-only deployed checks.
6. Record the final revision/dependency hashes, evidence, and production-only
   gates in the canonical and machine-readable records.
7. Commit and push the minimum focused packets, then stop when the defined local
   criteria pass and no Critical or Major finding remains.

### Certification boundary

Included:

- GA4 platform-level Ad Comparison for one authorized app campaign, one selected
  active GA4 property, that campaign's saved GA4 campaign filter, and the fixed
  last 30 completed GA4 days
- sessions, users, conversions, conversion rate, native GA4 revenue, imported
  revenue attribution, Revenue Breakdown, summary totals, leader cards, chart,
  and All Campaigns table
- the live Ad Comparison tab only
- active GA4/null-context HubSpot, Shopify, Google Sheets, CSV, retained
  Salesforce, and retained legacy revenue only where they directly supply Ad
  Comparison
- connection/source add, edit, delete, refresh/reprocess, recompute, and
  scheduler behavior only where it changes an Ad Comparison input

Excluded:

- Campaign DeepDive Platform Comparison and every non-GA4 Ad Comparison
- Insights, KPI, Benchmark, alert, notification, unrelated Overview surfaces,
  and every Reports-owned PDF, download, saved-report, snapshot, scheduler,
  delivery, and report-library path
- spend, Profit, ROAS, ROI, CPA, Pipeline Proxy, landing pages, channels,
  devices, countries, and conversion-event detail
- semantic native/imported business-revenue deduplication, which the product
  warns about but cannot prove from the stored records

### Complete value and calculation inventory

| Value | Production path | Required invariant |
|---|---|---|
| Sessions | GA4 acquisition rows -> campaign aggregation | Sum every exact-scope row; never silently truncate |
| Users | Same acquisition rows | Same window/property/filter as sessions |
| Conversions | Same acquisition rows | Same window/property/filter as sessions |
| Conversion rate | conversions / sessions * 100 | Zero only for a proven zero denominator; unavailable otherwise |
| Native row revenue | GA4 totalRevenue, with purchaseRevenue compatibility fallback | Same 30-day row scope; valid zero/negative retained |
| Imported source revenue | Exact materialized source breakdown | Source-to-date provenance only; excluded from 30-day ranking |
| Row revenue | Native GA4 row revenue | No imported merge, stale fallback, invented row, or proportional allocation |
| Revenue/session | Native row revenue / sessions | Numerator and denominator share the same property/filter/window |
| Leader cards | `selectGA4AdComparisonLeaderCards` | Best uses selected metric; Efficient requires traffic; Attention requires volume |
| Chart/table/totals | Normalized comparison rows | Same rows, metric, and state across all live tab surfaces |
| Revenue Breakdown | 30-day native row sum plus separate materialized source-to-date rows | Exact source ID/value; no same-type/config fallback or combined total |

### Route, storage, lifecycle, and consumer inventory

Direct reads:

- authenticated GA4 connection/property resolution
- `GET /api/campaigns/:id/ga4-breakdown`
- `GET /api/campaigns/:id/revenue-sources`
- `GET /api/campaigns/:id/revenue-breakdown`

Direct persistence:

- `ga4_connections` by exact campaign/property/active state
- campaign owner/client identity and `ga4CampaignFilter`
- `revenue_sources` by campaign/active state/GA4-or-null context
- `revenue_records` by campaign/source/date and optional sub-campaign identity

Applicable lifecycle:

- Ad Comparison persists no independent metric rows and has no independent
  add/edit/delete/scheduler. It recomputes when the tab renders.
- GA4 connection add/delete and campaign filter/property selection change native
  scope.
- Each imported family can add, edit, delete/deactivate, and refresh/reprocess
  where supported. The exact campaign/context source and records must update
  atomically and retain last-good data on failure.
Documented live tab consumers:

- `client/src/pages/ga4-ad-comparison.tsx`
- live data preparation in `client/src/pages/ga4-metrics.tsx`

No KPI, Benchmark, Insight, alert, notification, Campaign DeepDive, or Reports
value is inside the Ad Comparison tab certification boundary.

### Reviewed revision dependency boundary

- `client/src/pages/ga4-ad-comparison.tsx`
- `client/src/pages/ga4-metrics.tsx`
- `GA4/README.md`, `GA4/FINANCIAL_SOURCES.md`,
  and `GA4/REFRESH_AND_PROCESSING.md`
- `shared/ga4-ad-comparison-cards.ts`
- `shared/ga4-financial-source.ts`
- `shared/schema.ts`
- `server/analytics.ts`
- `server/routes-oauth.ts`
- `server/storage.ts`
- `package.json` and production deployment/revision configuration

The machine record lists the complete post-fix boundary. Hashes remain null
while status is `UNVERIFIED`; a later positive certification must pin every
hash. Any input change invalidates a later positive certification.

### Audit findings

| ID | Severity | Root cause and effect | Status |
|---|---|---|---|
| AC-01 | Critical | GA4 acquisition requests ordered high-cardinality rows by sessions and applied a 2,000-row limit without paging. | Fixed: page to provider `rowCount`; fail closed on incomplete/changed/oversized pagination |
| AC-02 | Major | 30-day GA4 rows were combined with source-to-date imported totals. | Fixed: ranking/table/chart/totals use native 30-day rows; imported values are separate source-to-date provenance |
| AC-03 | Major | Failure/stale/unavailable inputs could render as plausible zero/normal output. | Fixed: explicit loading/ready/stale/unavailable states |
| AC-05 | Major | Positive-only/config/ambiguous Salesforce fallbacks could omit valid zero or invent allocation. | Fixed: exact materialized amounts, valid zero retained, no definition/config value fallback or invented allocation |
| AC-06 | Minor | Static first/last table colors implied a ranking unrelated to the selected metric. | Fixed: misleading row colors removed |
| AC-07 | Major | React Query previous-property placeholder rows could appear under a newly selected property. | Fixed: placeholder rows are excluded until current-property data is verified |
| AC-08 | Major | Imported display state followed the revenue-total query instead of the source-breakdown query rendered by Ad Comparison. | Fixed: state derives from exact source definitions plus rendered breakdown response |

Historical AC-04 concerned Reports-owned browser/scheduled PDF parity. It was
fixed in the broader implementation commit but is outside this tab-only
certification; it is neither an Ad Comparison blocker nor deferred Ad
Comparison work.

### Focused audit commit sequence

The initial August 3 audit was delivered to `main` as the following ordered,
focused commits. This sequence is implementation history; the controlling
status above supersedes the `UNVERIFIED` state recorded at that time.

1. **Commit 1 — revoke the stale certification**
   - `9ee477d110b9b6a21876b9f1652ccbbfb93e6a43`
   - Replaced the reusable historical production-ready claim with the current
     revision-specific `UNVERIFIED` status before implementation work began.
2. **Commit 2 — add the automated certification gate**
   - `ce09149ca87cca15eabf989867ae109cee63959a`
   - Added the machine-readable certification record, checker, package command,
     and focused gate tests so stale or internally inconsistent certification
     evidence fails automatically.
3. **Commit 3 — make Ad Comparison fail closed**
   - `08ea74af0344538259cd34ff1d8487492f4c8253`
   - Closed the live-tab findings with the minimum runtime and focused
     regression changes: complete GA4 pagination, aligned 30-day/native versus
     source-to-date/imported semantics, exact valid-zero provenance, explicit
     unavailable/stale states, and current-property isolation. The same commit
     also changed Reports-owned PDF paths outside this certification boundary.
4. **Commit 4 — record audit evidence and align documentation**
   - `82369cf5213887944a5b84fdd093f49892f373dd`
   - Recorded the reviewed SHA, dependency and consumer boundaries, commands and
     results, finding disposition, production checks, and remaining external
     gates across the canonical and machine-readable records. It deliberately
     retained `UNVERIFIED` because the deployed revision and live parity packet
     do not yet satisfy certification requirements.

### Local validation evidence

Passed:

- final tab-only packet: 9 files, 293 tests
- focused real paths: 7 files, 207 tests
- affected HubSpot direct-consumer guards: 2 files, 8 tests
- auth/property/source lifecycle/destructive-safety packet: 10 files,
  200 passed before one structural assertion was updated; that updated file
  then passed 10/10
- `npm run check`
- `npm run build`
- certification checker and its 7-test gate packet after the final evidence
  update

The broader audit also exercised Reports-owned PDF paths. Those results remain
historical supporting evidence and are not part of this tab-only certification.

Commands and exact results:

- `vitest run --pool forks server/ga4-filter.test.ts server/ga4-ad-comparison-card-logic.test.ts server/ga4-ui-regression.test.ts server/ga4-cross-tab-consistency.test.ts server/ga4-source-lifecycle-recompute-regression.test.ts server/source-safety-regression.test.ts server/endpoint-auth-audit.test.ts server/ga4-primary-connection-scope-regression.test.ts server/ga4-ad-comparison-certification-gate.test.ts`
  -> 9 files / 293 tests passed for the final live-tab-only boundary
- `vitest run --pool forks server/ga4-filter.test.ts server/ga4-ad-comparison-card-logic.test.ts server/ga4-ui-regression.test.ts server/ga4-cross-tab-consistency.test.ts server/report-email-regression.test.ts server/shopify-downstream-content-regression.test.ts server/ga4-source-lifecycle-recompute-regression.test.ts`
  -> 7 files / 207 tests passed
- `vitest run --pool forks server/endpoint-auth-audit.test.ts server/ga4-primary-connection-scope-regression.test.ts server/ga4-source-lifecycle-recompute-regression.test.ts server/latest-day-revenue-regression.test.ts server/source-safety-regression.test.ts server/csv-revenue-downstream-propagation.test.ts server/google-sheets-revenue-validation.test.ts server/hubspot-revenue-ga4-overview-regression.test.ts server/shopify-revenue-regression.test.ts server/shopify-revenue-transaction.test.ts`
  -> 9 files passed; 1 file had one stale source assertion, which was updated
  and then passed 10/10
- `vitest run --pool forks server/hubspot-mapping-downstream-matrix.test.ts server/hubspot-stale-revenue-authority.test.ts`
  -> 2 files / 8 tests passed
- `npm run check` -> passed
- `npm run build` -> passed
- `vitest run --pool forks --reporter=json --outputFile=C:\tmp\ga4-ad-comparison-full-suite.json`
  -> 1,303/1,333 tests passed; failure separation recorded below
- `vitest run --pool forks server/ga4-ad-comparison-certification-gate.test.ts`
  -> 1 file / 7 tests passed
- `npm run check:ga4-ad-comparison-certification` -> passed after final
  machine-record update

Broader repository run:

- 361 suites / 1,333 tests
- 335 suites and 1,303 tests passed; 26 suites / 30 tests failed
- two affected HubSpot assertion failures were updated and passed separately
  (8/8); the other 28 reported failures are in pre-existing unrelated Google
  Ads, Meta, TikTok, and Instagram work visible in the dirty worktree and were
  not modified

### Production-only gates

- deployed runtime and boundary revision: passed on 2026-08-03; local and
  GitHub `main` resolved to `635b65c1db35a39a6f1466cab0cc1dceab04db31`,
  and production `/api/health` returned the same exact SHA
- live GA4 provider packet: passed read-only for campaign hash `fc734ddaf728`;
  authenticated property `542352127`, `Europe/Amsterdam`, the exact three-value
  saved campaign filter, `totalRevenue`, seven acquisition dimensions, and all
  21 provider rows matched the live values; unauthenticated access returned 401
- active source inventory: passed read-only for five active GA4-context sources;
  source and record currencies are USD, dates and materialized aggregate versus
  sub-campaign rows were inventoried, valid zero was retained, and the storage
  path correctly avoided double-counting paired aggregate/sub-campaign records
- live tab parity: passed; leader cards, All Campaigns rows, Revenue Breakdown,
  95 sessions, three campaigns, USD 16,088.36 native GA4 revenue, and imported
  USD 0/600/4,000/5,100/7,000 source-to-date values matched the authenticated
  provider and storage packet
- tab-only boundary revision: passed; Reports-owned PDFs, downloads, saved
  reports, snapshots, scheduling, delivery, and report-library paths are
  excluded and owned by the Reports certification

All included tab-only gates pass. The machine status is `PRODUCTION_READY` for
the exact certified SHA and pinned dependency hashes. Any listed dependency or
production-configuration change invalidates this certification.

<!-- /ga4-ad-comparison-current-status -->

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## Purpose

This file is the canonical production-readiness source of truth for the GA4 `Ad Comparison` tab.

Use this file when asked whether GA4 Ad Comparison is robust, accurate, logical, production-ready, or suitable as a template for another platform source such as Meta, Google Ads, LinkedIn, TikTok, Instagram, or a custom integration.

Use `GA4/AD_COMPARISON.md` for the functional description of what the tab is and how it should behave.

## Historical Future-Reference Rule (Revoked)

This section formerly instructed later audits to reuse the June 27 conclusion.
That instruction is revoked. The direct dependencies changed and the controlling
status above supersedes every statement in this historical section.

## Historical Durable Future Answer (Revoked)

The June 27, 2026 audit recorded a positive answer with one deferred scheduled
PDF artifact. That answer is retained only as history; it certifies no current
revision and must not be quoted as the current status.

## Historical June 27, 2026 Scope

This audit applies to the current GA4 Ad Comparison implementation for:

- live UI rendering
- browser-generated GA4 report PDF output
- scheduled/server-generated GA4 report PDF output, locally validated with deployed artifact evidence deferred
- current GA4 campaign/property/source scoping
- exact campaign-matched imported revenue behavior
- current campaign-row comparison model
- current shared leader-card selector
- current All Campaigns table behavior

This audit does not automatically certify:

- provider-side scheduled email delivery
- live GA4 API behavior outside what the code and local tests can prove
- the full lifecycle of every source edit/delete/refresh path outside the Ad Comparison call chain
- future platform implementations

This audit does not reopen the global GA4 Reports production-readiness status. Reports remains production-ready except for its documented deferred validations. The Ad Comparison scheduled/server PDF item below is aligned with the Mailgun-dependent deployed email/PDF validation path.

## Historical Deferred Validation

### Deployed Scheduled/Server PDF Revenue-Provenance Evidence

Status: Deferred until Mailgun is properly configured.

What is already fixed and locally validated:

- scheduled/server Ad Comparison PDF rendering uses the same revenue-provenance concepts as live/browser output
- scheduled/server output includes the relevant imported-source provenance concepts from Commit 2
- local regression tests for scheduled/report output passed
- shared leader-card selector behavior remains covered
- typecheck passed

What remains deferred:

- trigger a deployed scheduled/test-send GA4 report after Mailgun is configured
- open the delivered/generated PDF artifact
- confirm the Ad Comparison section includes the expected revenue-provenance rows from Commit 2
- confirm the delivered/generated artifact matches the live tab/browser PDF meaning for the same campaign data
- record the evidence in this file

Why it is deferred:

- local code can prove the render path and regression contract
- final deployed artifact evidence depends on the deployed email/PDF path and Mailgun configuration
- provider/API acceptance is not the same as actual delivered attachment evidence

This is the only remaining Ad Comparison validation item.

## Root Cause Analysis And Resolution

### Prior confusion: readiness scope drift

Root cause:

Earlier reviews certified narrower slices, especially the shared leader-card selector and imported-revenue row adjustment, while later questions asked about whole-tab production readiness. That created repeated changes in the answer.

Resolution:

This file now treats production readiness as the whole current GA4 Ad Comparison scope: row eligibility, leader cards, table behavior, revenue provenance, browser PDF, scheduled/server PDF, validation evidence, and external runtime caveats.

### Commit 1: Scope Source-Created Rows To The Current Campaign

Commit: `f0ea65b1 Scope GA4 Ad Comparison rows to current campaign`

Root cause:

The live/ad-hoc Ad Comparison parent path could derive source-created row eligibility from GA4 campaign filters saved on other campaigns in the same client. That allowed exact imported revenue rows to appear under the wrong current campaign scope.

Smallest safe fix:

- derive source-created row eligibility from the current campaign's saved GA4 campaign filter only
- preserve exact revenue matching semantics
- preserve GA4 calculations, KPI/Benchmark behavior, alerts, notifications, scheduler behavior, API ownership, and source/campaign/property scoping

Status: Fixed and validated.

### Commit 2: Add Scheduled PDF Revenue-Provenance Parity

Commit: `d6ce76fc Align GA4 scheduled Ad Comparison revenue provenance`

Root cause:

Scheduled/server PDF output adjusted comparison-row revenue but did not fully render the same revenue-provenance meaning as the live tab and browser-generated PDF.

Smallest safe fix:

- extend the scheduled/server Ad Comparison render path with the existing revenue-provenance concepts
- preserve the shared selector
- preserve scheduled metric default behavior
- do not change live layout, scheduler ownership, email delivery semantics, KPI/Benchmark behavior, alerts, or notifications

Status: Fixed and locally validated. Deployed scheduled/server PDF artifact evidence is deferred until Mailgun is properly configured.

### Dropdown-controlled All Campaigns table

Commit: `c630cc7b Decouple GA4 Ad Comparison table from metric dropdown`

Root cause:

The live All Campaigns table and browser PDF All Campaigns table were rendered from the dropdown-sorted row list. After the subtitle was removed, the table still implied dropdown control and row order could follow the selected metric.

Smallest safe fix:

- live All Campaigns table renders from stable `comparisonRows`
- browser PDF All Campaigns table renders from stable `comparisonRows`
- the metric dropdown continues to control leader cards, chart ranking, and selected-metric summary only

Status: Fixed and validated.

### Leader-card close-rate explainability

Commit: `b34dce2c Clarify GA4 Ad Comparison card conversion rates`

Root cause:

Leader-card selection already used exact numeric conversion rates, but card details displayed conversion rate to one decimal. Close values such as `34 / 273 = 12.45%` and `25 / 200 = 12.50%` both appeared as `12.5%`, making correct decisions look contradictory.

Smallest safe fix:

- keep selector logic unchanged
- add a GA4 Ad Comparison card-only two-decimal percent formatter
- use that formatter in live cards, browser PDF cards, and scheduled/server PDF cards
- add regression coverage for the exact close-rate case

Status: Fixed and validated.

### All Campaigns title spacing

Commit: `cbcd956c Tighten GA4 Ad Comparison table spacing`

Root cause:

After the All Campaigns description line was removed, the card still forced `CardContent className="p-6"`, which reintroduced top padding and left a blank descriptor gap under the title.

Smallest safe fix:

- keep the optional revenue-provenance description behavior
- use tighter header padding when that description is absent
- restore zero top padding on the table content
- add a regression guard against returning to `p-6`

Status: Fixed and validated.

## Section Production-Readiness Map

### 1. Entity Definition And User Meaning

Status: Production-ready for current documented semantics.

Proven locally:

- current implementation and docs define the tab as campaign-row comparison
- docs explicitly prohibit interpreting the output as true ad, creative, ad group, or keyword analytics

Production condition:

- keep the campaign-row meaning explicit until the implementation actually supports lower-level ad entities

### 2. Source Scope And Row Eligibility

Status: Production-ready for current GA4 code scope.

Proven locally:

- source-created rows are scoped to the current campaign's saved GA4 campaign filter
- another same-client campaign's saved GA4 filter does not authorize source-created rows in the current campaign
- scheduled/server path uses the current campaign's saved GA4 filter

Not locally verifiable:

- whether historical deployed production data contains stale/damaged mappings from earlier defects

### 3. Normalized Comparison Rows

Status: Production-ready for current GA4 code scope.

Proven locally:

- comparison outputs consume normalized row values
- conversion rate is row conversions divided by row sessions
- zero-session rows can be represented when exact imported revenue creates a source-backed row
- row normalization runs after current-campaign source scope is enforced

### 4. Exact Imported Revenue Matching

Status: Production-ready for the traced Ad Comparison paths.

Proven locally:

- exact campaign-matched imported revenue can be included in adjusted comparison rows
- mapped external-revenue rows with zero GA4 sessions can win `Best Performing` when selected metric is `Revenue`
- zero-session mapped-revenue rows cannot win efficiency cards because efficiency requires sessions
- one-cent residuals after exact matched external revenue are treated as rounding reconciliation
- live unallocated external revenue is based on imported-source residuals, not `Total Revenue - GA4 campaign-row revenue`

Not locally verifiable:

- deployed customer source data quality
- existing persisted damaged mappings, if any

### 5. Leader Cards

Status: Production-ready for current campaign-row semantics.

Proven locally:

- live tab, browser-generated PDF, and scheduled/server PDF call the shared selector in `shared/ga4-ad-comparison-cards.ts`
- `Best Performing` follows the selected metric where selected metric state is available
- scheduled/server PDF uses `sessions` as the explicit default metric because report config does not persist the live dropdown state
- `Most Efficient` uses highest conversion rate among rows with sessions
- `Needs Attention` uses lowest conversion rate among meaningful-volume rows
- low-signal rows are ignored when meaningful-volume rows exist
- close conversion-rate decisions use exact numeric rates and card details show two-decimal CR

### 6. Metric Selector And Summary Cards

Status: Production-ready for current local code scope.

Proven locally:

- supported metrics are `Sessions`, `Users`, `Conversions`, `Revenue`, and `Conversion Rate`
- `Revenue` renders as `Total Revenue (All Sources)`
- `Conversion Rate` renders as `Overall Conversion Rate`
- overall conversion rate is total conversions divided by total sessions
- users remain explicitly caveated because GA4 users are non-additive across rows
- metric dropdown controls leader cards, chart ranking, and selected-metric summary, but not the All Campaigns table order

### 7. All Campaigns Table

Status: Production-ready for current GA4 code scope.

Proven locally:

- table row values come from adjusted normalized rows
- table order is stable and not controlled by the metric dropdown
- revenue means GA4 campaign-row revenue plus exact campaign-matched imported revenue
- unallocated external revenue is computed from imported-source residuals only
- `Total Revenue (All Sources)` is the final summary row
- no `Full comparison sorted by ...` subtitle remains
- no blank descriptor gap remains under the `All Campaigns` title when no provenance description is rendered

### 8. Revenue Breakdown

Status: Production-ready for current GA4 code scope, with deployed scheduled/server PDF artifact evidence deferred.

Proven locally:

- live revenue breakdown uses source-level GA4 revenue rather than rounded comparison-row sums
- active imported sources can show source amounts
- exact source campaign-value subtotals can be shown as indented provenance rows
- one-cent source residuals are not business-significant unallocated revenue
- scheduled/server PDF revenue-provenance parity code and local regression coverage are in place

Deferred validation:

- deployed scheduled/server PDF attachment must be checked after Mailgun is configured

### 9. Reports And Exports

Status: Production-ready for current GA4 code scope, with deployed scheduled/server PDF artifact evidence deferred.

Proven locally:

- browser-generated PDF uses the current parent-page Ad Comparison model
- scheduled/server PDF uses the shared leader-card selector
- scheduled/server PDF adjusts comparison rows with exact imported revenue
- scheduled/server PDF provenance parity is implemented and locally regression-covered

Not locally verifiable until Mailgun is configured:

- delivered/generated deployed scheduled/server PDF attachment content
- provider-side email delivery or inbox receipt

### 10. Refresh And Recompute

Status: Production-ready for the current Ad Comparison design, with normal external runtime caveats.

Proven locally:

- current tab has no dedicated Ad Comparison background job
- Ad Comparison refreshes indirectly from GA4 breakdown and revenue-source inputs
- no new scheduler is required for the current design

Not locally verifiable:

- live GA4 API processing latency
- deployed scheduler execution timing

## Proven Locally

The following are proven by code trace and targeted regression tests from the June 27, 2026 post-fix audit:

- current GA4 Ad Comparison is campaign-row comparison, not true ad-level analytics
- live, browser PDF, and scheduled/server PDF leader cards use the shared selector
- leader-card selector behavior is covered for selected metric, efficiency, meaningful-volume attention, zero-session revenue rows, and close exact-CR cases
- browser-generated report output shares the current parent-page Ad Comparison model
- source-created rows are gated to the current campaign's saved GA4 campaign filter
- exact campaign-matched imported revenue can be included in adjusted comparison rows
- unallocated external revenue comes from imported-source residuals only
- one-cent residuals are treated as rounding reconciliation
- live/ad-hoc Revenue Breakdown uses source-level GA4 revenue instead of rounded comparison-row sums
- scheduled/server PDF revenue-provenance parity is implemented and locally covered
- summary conversion-rate label is `Overall Conversion Rate`
- card CR details use two-decimal formatting in live, browser PDF, and scheduled/server PDF output
- All Campaigns is not sorted by the metric dropdown
- All Campaigns compact-title spacing is guarded
- the current tab has no dedicated Ad Comparison scheduler

## Deferred Or Not Locally Verifiable

The following cannot be proven from local code alone:

- live GA4 processing latency and provider-side data availability
- whether deployed customer data currently contains historical stale/damaged source mappings
- deployed scheduler execution timing
- deployed scheduled/server PDF attachment content until Mailgun is configured
- provider/API acceptance becoming actual inbox delivery

Only `Deployed Scheduled/Server PDF Revenue-Provenance Evidence` remains as a deferred Ad Comparison validation item.

## Historical Completed Fix Queue

### Commit 1: Scope Source-Created Rows To The Current Campaign

Status: Complete.

Closed blocker:

- live/ad-hoc source-created row scope could broaden beyond the current campaign

Validation:

```bash
npm test -- server/ga4-ad-comparison-card-logic.test.ts server/ga4-ui-regression.test.ts
npm run check
```

### Commit 2: Add Scheduled PDF Revenue-Provenance Parity

Status: Complete locally. Deployed artifact evidence deferred until Mailgun is properly configured.

Closed code blocker:

- scheduled/server PDF revenue provenance was not in full parity with live/ad-hoc meaning

Validation:

```bash
npm test -- server/ga4-ad-comparison-card-logic.test.ts server/ga4-ui-regression.test.ts
npm test -- server/ga4-cross-tab-consistency.test.ts server/report-email-regression.test.ts
npm run check
```

### Commit 3: Update Production-Ready Status After Validation

Status: Complete. This documentation update records the settled production-ready answer with the single Mailgun-dependent deferred validation isolated.

Required outcome:

- durable future answer is production-ready for current GA4 code scope
- closed blockers remain documented as root-cause history
- deferred deployed scheduled/server PDF evidence is isolated and tied to Mailgun configuration

## Validation Evidence

### Commit 1 / Commit 2 readiness validation

Commands run during the Ad Comparison fix sequence:

```bash
npm test -- server/ga4-ad-comparison-card-logic.test.ts server/ga4-ui-regression.test.ts
npm test -- server/ga4-cross-tab-consistency.test.ts server/report-email-regression.test.ts
npm run check
```

Results recorded during this workstream:

- Ad Comparison selector/UI regression tests passed
- report/consistency regression tests passed
- TypeScript check passed

### Dropdown/table independence validation after commit `c630cc7b`

Commands:

```bash
npm test -- server/ga4-ad-comparison-card-logic.test.ts server/ga4-ui-regression.test.ts
npm run check
npm test -- server/ga4-cross-tab-consistency.test.ts server/report-email-regression.test.ts
```

Result:

- passed 31 focused selector/UI tests in that run
- passed typecheck
- passed 128 report/consistency tests
- verified live and browser PDF All Campaigns tables render from stable `comparisonRows`, not dropdown-sorted rows

### Card-precision validation after commit `b34dce2c`

Commands:

```bash
npm test -- server/ga4-ad-comparison-card-logic.test.ts server/ga4-ui-regression.test.ts
npm run check
npm test -- server/ga4-cross-tab-consistency.test.ts server/report-email-regression.test.ts
```

Result:

- passed 32 focused selector/UI tests
- included the exact close-rate case where `34 / 273 = 12.45%` and `25 / 200 = 12.50%`
- verified live, browser PDF, and scheduled/server PDF card details use two-decimal CR formatting
- passed typecheck
- passed 128 report/consistency tests

### All Campaigns spacing validation after commit `cbcd956c`

Commands:

```bash
npm test -- server/ga4-ui-regression.test.ts
npm run check
git diff --check -- client/src/pages/ga4-ad-comparison.tsx server/ga4-ui-regression.test.ts
```

Result:

- passed 26 UI regression tests
- passed typecheck
- whitespace check passed
- verified the live All Campaigns card uses compact header/content spacing when the provenance description is absent

## Deferred Validation Procedure

Complete this after Mailgun is properly configured:

1. Generate a deployed scheduled/test-send GA4 report that includes Ad Comparison.
2. Open the delivered/generated PDF attachment.
3. Compare Ad Comparison revenue provenance against the live tab and browser-generated PDF for the same campaign data.
4. Confirm the scheduled/server PDF includes expected Commit 2 provenance, including applicable GA4 revenue, imported source rows, source campaign-value provenance rows, unallocated external revenue when present, and total revenue.
5. Confirm provider delivery evidence or actual inbox receipt; do not treat raw provider/API acceptance alone as delivery proof.
6. Update this file with the exact date, campaign/source mix, report ID if available, artifact checked, and result.

## Recommended Non-Blocking Improvements

These are useful future improvements but are not production blockers for current GA4 Ad Comparison:

- consider saving the Ad Comparison selected metric in report config so scheduled reports can use the user's selected metric instead of the documented `sessions` default
- consider adding a visible `Campaign-row comparison` label if user research shows the `Ad Comparison` tab name is misleading
- add lifecycle-specific source edit/delete/refresh tests when source lifecycle code is next touched
- add a lightweight visual smoke check for long campaign names and mobile layout if frontend screenshot tooling is already being used

## Future Platform Template

Use this sequence when refining Meta, Google Ads, LinkedIn, TikTok, Instagram, or another platform's Ad Comparison tab.

### 1. Define The Compared Entity

State exactly what the tab compares:

- campaign rows
- ad group rows
- ad rows
- creative rows
- keyword rows
- unavailable for this source

Do not use `Ad Comparison` wording to imply a lower-level entity than the source actually provides.

### 2. Prove Platform Scope

Before calculating rows, prove:

- campaign access is checked
- platform connection belongs to the campaign
- selected platform campaigns/accounts/properties are respected
- child revenue/spend sources are platform-context scoped
- unrelated rows in the same account/property are excluded

### 3. Build Normalized Rows

Every platform should define stable normalized comparison rows before cards, charts, tables, and reports render.

Recommended common fields:

- `id` when available
- `name`
- sessions, clicks, impressions, or the platform's primary traffic metric
- conversions
- spend when available
- revenue when safely attributable
- conversion rate or equivalent efficiency metric
- CPA, ROAS, or ROI when the source supports them

If a metric is unavailable, mark it unavailable instead of filling zero.

### 4. Define Financial Attribution

For each platform, document:

- native revenue meaning
- imported revenue meaning
- exact source mapping fields
- unmatched revenue behavior
- spend source behavior
- whether proportional allocation is forbidden or explicitly designed

For GA4, proportional allocation is forbidden.

### 5. Define Leader Cards From Available Metrics

Leader cards must be metric-safe for the source.

GA4 pattern:

- `Best Performing`: selected metric leader
- `Most Efficient`: highest conversion rate among session rows
- `Needs Attention`: lowest conversion rate among meaningful-volume rows

Paid-media pattern may differ, but must be explicit. Do not copy GA4 session-based logic blindly into paid-media sources if clicks, spend, or impressions are the real source metrics.

### 6. Keep Report Output In Parity

For each platform, verify:

- live tab and report output use the same normalized rows
- leader cards use the same selector
- table rows use the same row values
- source provenance is represented consistently
- report default metric is explicit when live UI state is not saved
- scheduled reports do not use stale or separately recomputed card logic

### 7. Add Regression Coverage

At minimum, add tests for:

- selected metric controls only the intended card
- efficiency card excludes ineligible rows
- attention card ignores low-signal rows
- exact revenue/spend attribution is included only when safe
- unmatched revenue/spend stays visible but unallocated
- report output uses the same selector as the live tab
- source scoping excludes unrelated campaigns/accounts
- scheduled/server output matches live/ad-hoc source-provenance meaning

## Historical Stable Response (Do Not Reuse)

This was the June 27 reusable response. It is revoked. Use only the controlling
current status at the top of this file. General Reports status is not an input
except for the direct Ads PDF generation path.
