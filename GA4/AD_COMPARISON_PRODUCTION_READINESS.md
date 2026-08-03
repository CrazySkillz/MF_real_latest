# GA4 Ad Comparison Production Readiness

<!-- ga4-ad-comparison-certification-status: UNVERIFIED -->

## Controlling Current Status

**Status: UNVERIFIED. Ad Comparison is not currently certified production-ready.**

This is the only reusable current-status answer in this document. The June 27,
2026 conclusion below is historical and revoked. It had no exact certified Git
SHA, complete dependency boundary, machine-readable invalidation gate, or
complete current value/negative-state inventory. Direct dependencies changed
after that review.

Audit baseline:

- audit opened: 2026-08-03
- baseline Git SHA: `b91d096831bc04504ca7a3cae4191d28c8fa89ee`
- certification status: `UNVERIFIED`; certified SHA: none
- production writes, provider refreshes, report sends, and cleanup: not
  performed
- unrelated dirty worktree changes: excluded and preserved

### Finite validation plan

1. Freeze the revision, configuration, surface, source, and consumer boundary.
2. Trace every value through provider/source query, persistence, API,
   post-fetch transforms, live rendering, browser PDF, and scheduled PDF.
3. Trace auth, tenant/property/platform isolation and every applicable source
   lifecycle, refresh, recompute, failure, and delete path.
4. Fix all Critical and Major findings with the smallest safe changes and
   focused real-path regressions.
5. Run focused and affected tests, TypeScript, production build, deterministic
   scheduled-PDF validation, and safe read-only deployed checks.
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
- live UI, browser-generated GA4 Ads PDF, and scheduled/server GA4 Ads PDF
- active GA4/null-context HubSpot, Shopify, Google Sheets, CSV, retained
  Salesforce, and retained legacy revenue only where they directly supply Ad
  Comparison
- connection/source add, edit, delete, refresh/reprocess, recompute, and
  scheduler behavior only where it changes an Ad Comparison input
- report ownership/campaign consistency and scheduled generation only where
  required to build the direct Ads PDF consumer

Excluded:

- Campaign DeepDive Platform Comparison and every non-GA4 Ad Comparison
- Insights, KPI, Benchmark, alert, notification, general Report-library, email
  delivery, and unrelated Overview surfaces except a shared direct producer
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
| Imported row revenue | Exact saved campaign-value totals | Compare only when identity, active materialization, currency, and window align |
| Row total revenue | Native plus eligible imported amount | No ambiguity, stale fallback, or proportional allocation |
| Unallocated revenue | Authoritative imported total minus eligible match | Non-negative residual; never guessed |
| Revenue/session | Row total revenue / sessions | Rank only when numerator and denominator share scope |
| Leader cards | `selectGA4AdComparisonCards` | Best uses selected metric; Efficient requires traffic; Attention requires volume |
| Chart/table/totals | Normalized comparison rows | Same rows, metric, and state across direct consumers |
| Revenue Breakdown | Native plus exact active materialized sources and residual | Exact source ID/config/value; no same-type config borrowing |

### Route, storage, lifecycle, and consumer inventory

Direct reads:

- authenticated GA4 connection/property resolution
- `GET /api/campaigns/:id/ga4-breakdown`
- `GET /api/campaigns/:id/ga4-to-date`
- `GET /api/campaigns/:id/revenue-to-date`
- `GET /api/campaigns/:id/revenue-sources`
- `GET /api/campaigns/:id/revenue-breakdown`
- direct report/snapshot PDF routes and the report scheduler only where they
  invoke `buildGA4ScheduledPdfAttachment`

Direct persistence:

- `ga4_connections` by exact campaign/property/active state
- campaign owner/client identity and `ga4CampaignFilter`
- `revenue_sources` by campaign/active state/GA4-or-null context
- `revenue_records` by campaign/source/date and optional sub-campaign identity
- report/snapshot/send-event rows only for report/campaign consistency and
  scheduled artifact generation

Applicable lifecycle:

- Ad Comparison persists no independent metric rows and has no independent
  add/edit/delete/scheduler. It recomputes when the tab/report renders.
- GA4 connection add/delete and campaign filter/property selection change native
  scope.
- Each imported family can add, edit, delete/deactivate, and refresh/reprocess
  where supported. The exact campaign/context source and records must update
  atomically and retain last-good data on failure.
- Browser PDF is an authenticated in-memory consumer. Scheduled PDF is a
  deterministic server consumer of saved report/campaign configuration and must
  fail closed before a successful snapshot/artifact is represented.

Documented direct consumers:

- `client/src/pages/ga4-ad-comparison.tsx`
- browser Ads PDF rendering in `client/src/pages/ga4-metrics.tsx`
- scheduled/server Ads PDF rendering in
  `server/ga4-scheduled-report-pdf.ts`

No KPI, Benchmark, Insight, alert, notification, Campaign DeepDive, or general
Report-library value is a documented direct Ad Comparison consumer.

### Revision dependency boundary at audit open

- `client/src/pages/ga4-ad-comparison.tsx`
- `client/src/pages/ga4-metrics.tsx`
- `shared/ga4-ad-comparison-cards.ts`
- `shared/ga4-financial-source.ts`
- `shared/schema.ts`
- `server/analytics.ts`
- `server/routes-oauth.ts`
- `server/storage.ts`
- `server/ga4-scheduled-report-pdf.ts`
- `server/report-scheduler.ts`
- `server/report-email-service.ts`
- `package.json` and production deployment/revision configuration

The final record must pin exact hashes for the post-fix boundary. Any change to
an input invalidates a later positive certification until evidence is updated.

### Initial finding queue

| ID | Severity | Root cause and effect | Status |
|---|---|---|---|
| AC-01 | Critical | GA4 acquisition requests order high-cardinality rows by sessions and apply a 2,000-row default limit without paging. Aggregate totals can stay correct while lower-volume campaigns lose rows, revenue, conversions, and rank. | Confirmed; fix required |
| AC-02 | Major | The UI is fixed to 30 completed GA4 days, but imported campaign totals are source-specific/to-date with no common-window proof. Adding them creates a misleading mixed-window comparison. | Confirmed; fail-closed fix required |
| AC-03 | Major | Live Ad Comparison receives only loading state. Breakdown/revenue failures, stale values, unavailable sources, and missing native revenue can render as plausible zero/normal results. | Confirmed; fix required |
| AC-04 | Major | Direct consumers diverge: live can borrow same-type mapping config; scheduled imported windows differ; scheduled All Campaigns stops at 20; Ads PDFs do not fail closed for required input failures. | Confirmed; fix required |
| AC-05 | Major | Positive-only fallbacks discard valid zero/negative values; stale config can allocate without materialized evidence; live Salesforce can invent a subtotal absent from saved campaign totals. | Confirmed; fix required |
| AC-06 | Minor | All Campaigns colors first/last session-sorted rows green/red even when another metric is selected, implying a ranking the table does not perform. | Confirmed; fix after blockers |

No clean certification is permitted until AC-01 through AC-05 are closed,
validation passes, the final boundary is recorded, and production-only gates are
passed. Otherwise the machine status remains `UNVERIFIED`.

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
