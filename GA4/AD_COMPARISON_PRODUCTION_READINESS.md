# GA4 Ad Comparison Production Readiness

<!-- ga4-ad-comparison-certification-status: PRODUCTION_READY -->

## Controlling Current Status

**Status: PRODUCTION_READY for certified runtime boundary
`4be16c54c550a45dbf3104313c820ea47b453604` and the recorded
dependency/configuration boundary.
The defined live-tab section is included in the final combined GA4
certification.**

The current revalidation audited every recorded dependency changed since the
prior machine record. The exact Ad Comparison query, cumulative route, saved
import boundary, property/filter scope, native aggregation/ranking, and
imported-source provenance renderer passed their protected regressions and
authenticated production parity checks.

The current-version boundary, TypeScript, and production build pass.
Authenticated exact-SHA validation proves property `542352127`, the saved
three-campaign filter, the `2026-07-02` through `2026-08-27` completed-day
window, all reviewed provider aggregates, all five materialized revenue sources,
and rendered UI parity. The validation database transaction was read-only and
rolled back with zero application mutations. Prior `PRODUCTION_READY` records are historical only.

This is the only reusable current-status answer in this document. The June 27,
2026 conclusion below is historical and revoked. It had no exact certified Git
SHA, complete dependency boundary, machine-readable invalidation gate, or
complete current value/negative-state inventory.

Audit baseline:

- audit opened: 2026-08-03
- baseline Git SHA: `b91d096831bc04504ca7a3cae4191d28c8fa89ee`
- certification status: `UNVERIFIED`; escaped rolling-window runtime SHA:
  `1c410e271961638d80088b69a14eb874df90b881`; corrected local runtime SHA:
  `6a38cc4d76b4710a55c4c916e5119963ce6de169`
- production writes, provider refreshes, report sends, and cleanup: not
  performed
- unrelated dirty worktree changes: excluded and preserved

Historical final review for `83d12427`:

- reviewed implementation SHA:
  `6a38cc4d76b4710a55c4c916e5119963ce6de169`
- exact corrected deployed and production-evidence SHA:
  `83d124278647f3d2ccbe74b20f39c853dc0c8b44`
- assessment: AC-09 was fixed in the historical boundary reviewed at that time
- historical certification: `PRODUCTION_READY` for exact deployed revision
  `83d124278647f3d2ccbe74b20f39c853dc0c8b44`

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
  initial-import start through the latest completed reporting day
- sessions, users, conversions, conversion rate, native GA4 revenue, imported
  revenue provenance, Revenue Breakdown, summary totals, leader cards, chart,
  and All Campaigns table
- the live Ad Comparison tab only
- every active materialized revenue source returned for the same campaign and
  GA4-or-legacy-null platform context, including the reviewed HubSpot, Shopify,
  Google Sheets, CSV, retained Salesforce, and retained legacy families
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
| Native row revenue | GA4 totalRevenue, with purchaseRevenue compatibility fallback | Same import-to-latest-completed row scope; valid zero/negative retained |
| Imported source revenue | Exact materialized source breakdown | Source-to-date provenance only; excluded from native ranking |
| Row revenue | Native GA4 row revenue | No imported merge, stale fallback, invented row, or proportional allocation |
| Revenue/session | Native row revenue / sessions | Numerator and denominator share the same property/filter/window |
| Leader cards | `selectGA4AdComparisonLeaderCards` | Render only with at least two rows; Best uses selected metric; Efficient requires traffic; Attention requires volume and avoids duplicating Best when another row ties the lowest exact rate |
| Chart | Selected-metric sort of normalized rows | Show at most the top 10; never change underlying table order |
| Selected-metric summary | Normalized comparison rows | Sum the selected metric; conversion rate uses aggregate conversions / aggregate sessions |
| Campaigns Compared | Normalized comparison rows | Exact normalized row count |
| All Campaigns | Sessions-descending normalized rows | Same native row values regardless of dropdown selection |
| Revenue Breakdown | Import-to-latest-completed native row sum plus separate materialized source-to-date rows | Exact source ID/value; no same-type/config fallback or combined total |
| Loading/empty/stale/unavailable | Query state plus current-property verification | Previous-property rows are blocked; verified empty differs from failure; last-good data requires an explicit stale warning |

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
  `GA4/REFRESH_AND_PROCESSING.md`, and `GA4-MANUAL-TEST-PLAN.md`
- `shared/ga4-ad-comparison-cards.ts`
- `shared/ga4-financial-source.ts`
- `shared/schema.ts`
- `server/analytics.ts`
- `server/routes-oauth.ts`
- `server/storage.ts`
- `server/utils/reporting-timezone.ts`
- `server/ga4-ad-comparison-accumulation-regression.test.ts`
- `package.json` and production deployment/revision configuration

The machine record lists the complete post-fix boundary and pins every
dependency hash for the positive certification. Any listed dependency or
production-configuration change invalidates the certification.

### Audit findings

| ID | Severity | Root cause and effect | Status |
|---|---|---|---|
| AC-01 | Critical | GA4 acquisition requests ordered high-cardinality rows by sessions and applied a 2,000-row limit without paging. | Fixed: page to provider `rowCount`; fail closed on incomplete/changed/oversized pagination |
| AC-02 | Major | Native GA4 rows were combined with source-to-date imported totals. | Fixed: ranking/table/chart/totals use native rows for one common window; imported values are separate source-to-date provenance |
| AC-03 | Major | Failure/stale/unavailable inputs could render as plausible zero/normal output. | Fixed: explicit loading/ready/stale/unavailable states |
| AC-05 | Major | Positive-only/config/ambiguous Salesforce fallbacks could omit valid zero or invent allocation. | Fixed: exact materialized amounts, valid zero retained, no definition/config value fallback or invented allocation |
| AC-06 | Minor | Static first/last table colors implied a ranking unrelated to the selected metric. | Fixed: misleading row colors removed |
| AC-07 | Major | React Query previous-property placeholder rows could appear under a newly selected property. | Fixed: placeholder rows are excluded until current-property data is verified |
| AC-08 | Major | Imported display state followed the revenue-total query instead of the source-breakdown query rendered by Ad Comparison. | Fixed: state derives from exact source definitions plus rendered breakdown response |
| AC-09 | Critical | Ad Comparison conflated the 30-day initial import depth with a permanent rolling display window, so older valid campaign values fell out after day 30 and rankings/totals diverged from the campaign accumulation contract. | Fixed locally in `6a38cc4d`: isolated server-resolved saved-import-boundary query through the campaign-timezone latest completed day; deployment/live parity remains a certification gate |
| AC-10 | Major | Active imported sources with no exact materialized amount were filtered out, so the table could claim there were no additional sources instead of showing the source as unavailable. | Fixed in `defce198` and present in certified runtime `b8c73621`: render the source as `Unavailable`, retain valid zero and other exact values, and suppress unavailable-source subsections; current regression and exact-SHA live available-source/UI evidence pass |

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
5. **Commit 5 — invalidate the escaped rolling-window certification**
   - `ef5f089c`
   - Added the fixed-boundary rule to the machine gate and marked AC-09 and the
     controlling record `UNVERIFIED` before changing runtime behavior.
6. **Commit 6 — isolate and fix the cumulative live-tab path**
   - `6a38cc4d76b4710a55c4c916e5119963ce6de169`
   - Added the server-resolved import-to-date window, exact completed end date,
     isolated live-tab query, fail-closed states, UI provenance labels, and
     focused production-path regressions without changing Overview or Reports.

### Local validation evidence

Passed:

- AC-09 focused packet: 4 files / 38 tests
- affected security, source lifecycle, UI, cross-tab, property-scope, and
  destructive-safety packet: 11 files / 305 tests after aligning one expected
  structural assertion with the isolated query
- `npm run check` -> passed
- `npm run build` -> passed
- `npm run check:ga4-ad-comparison-certification` -> passed before the positive
  envelope while machine status was intentionally `UNVERIFIED`; the final
  positive-envelope run also passed
- `GA4_AD_COMPARISON_EXPECTED_SHA=83d12427... npx tsx --env-file=.env scripts/ga4-ad-comparison-live-readonly.ts`
  -> passed against the deployed authenticated API and rendered live tab
- final tab-only packet: 9 files, 294 tests
- focused real paths: 7 files, 207 tests
- affected HubSpot direct-consumer guards: 2 files, 8 tests
- auth/property/source lifecycle/destructive-safety packet: 10 files,
  200 passed before one structural assertion was updated; that updated file
  then passed 10/10
- `npm run check`
- `npm run build`
- certification checker and its 10-test gate packet after the final evidence
  update

The broader audit also exercised Reports-owned PDF paths. Those results remain
historical supporting evidence and are not part of this tab-only certification.

Commands and exact results:

- `vitest run --pool forks server/ga4-filter.test.ts server/ga4-ad-comparison-card-logic.test.ts server/ga4-ui-regression.test.ts server/ga4-cross-tab-consistency.test.ts server/ga4-source-lifecycle-recompute-regression.test.ts server/source-safety-regression.test.ts server/endpoint-auth-audit.test.ts server/ga4-primary-connection-scope-regression.test.ts server/ga4-ad-comparison-certification-gate.test.ts`
  -> 9 files / 294 tests passed for the final live-tab-only boundary
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
  -> 1 file / 10 tests passed
- `npm run check:ga4-ad-comparison-certification` -> passed after final
  machine-record update

Broader repository run:

- 361 suites / 1,333 tests
- 335 suites and 1,303 tests passed; 26 suites / 30 tests failed
- two affected HubSpot assertion failures were updated and passed separately
  (8/8); the other 28 reported failures are in pre-existing unrelated Google
  Ads, Meta, TikTok, and Instagram work visible in the dirty worktree and were
  not modified

### Historical production-only gates for `83d12427`

- deployed corrected revision: passed; `/api/health` returned exact SHA
  `83d124278647f3d2ccbe74b20f39c853dc0c8b44`
- authentication boundary: passed; the cumulative endpoint returned `401`
  without authentication
- authenticated provider/window packet: passed for exact property `542352127`,
  `Europe/Amsterdam`, saved start `2026-07-02`, latest completed day
  `2026-08-02`, 32 inclusive days, and the exact three-value saved filter
- provider completeness and values: passed; 24 acquisition rows aggregated to
  `yesop_retargeting` 43 sessions / USD 7,380.11, `yesop_paid_social` 34 /
  USD 5,637.46, and `yesop_email_nurture` 33 / USD 5,261.82
- active source inventory: passed by the prior unchanged read-only five-source
  packet; imported provenance remains separate and valid zero is retained
- live tab parity: passed; the rendered tab showed the exact start/end labels,
  every saved campaign row, and the import-to-date revenue label
- persistence safety: passed; the validator used a read-only database
  transaction and rolled it back; no source, campaign, report, scheduler, or
  analytics row was changed
- tab-only boundary revision: passed; Overview and Reports retain their existing
  paths and remain outside this certification

These gates certify only historical revision `83d12427`; they do not certify the
current candidate.

### Current exact-SHA gates for certified runtime `b8c73621`

- certified runtime deployment: passed; `/api/health` returned exact SHA
  `b8c7362121593502955d41e522d32396a963fdcc`; relative to `12789c1e`, the
  runtime changes only the established campaign-access guard on outcome totals
- provider/window: passed for property `542352127`, `Europe/Amsterdam`, saved
  start `2026-07-02`, completed end `2026-08-20`, 50 inclusive days, exact
  three-value filter, and 33 provider rows
- reviewed native aggregates: `yesop_retargeting` 60 sessions / 60 users / 60
  conversions / USD 13,674; `yesop_paid_social` 45 / 45 / 45 / USD 10,691.80;
  `yesop_email_nurture` 47 / 47 / 47 / USD 9,907.20
- campaign UI parity: passed; all three saved campaigns and exact window labels
  rendered
- imported source inventory/UI: passed; five active USD sources matched exact
  materialized breakdown values (Shopify 99.99, HubSpot 4,000/7,000/5,100, CSV
  600) and every source label rendered
- AC-10 unavailable state: committed regression passed; not live-mutated because
  every current production source is materialized and available
- focused real-path regressions: 4 files / 51 tests passed
- affected Ad-only regressions: 10 files / 236 tests passed
- Ad-relevant source lifecycle safety: 15/15 selected tests passed; 72 unrelated
  tests were skipped by name filter, including the explicitly deferred platform
  paths
- changed dependencies since the prior machine record: all four were audited;
  their diffs are confined to separate Campaign DeepDive exact-date comparison
  and Overview/KPI/Benchmark cumulative-validation paths, and none changes the
  cumulative Ad Comparison endpoint or live renderer
- persistence safety: passed; read-only transaction rolled back; temporary
  authentication-session cleanup was requested in the validator's `finally`

All required local and exact-SHA production gates pass for the defined live-tab
boundary. The machine record is `PRODUCTION_READY` for certified runtime
boundary `b8c7362121593502955d41e522d32396a963fdcc` and the recorded normalized
dependency hashes. This section result is included in the final combined GA4
certification.

<!-- /ga4-ad-comparison-current-status -->

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## Purpose

This file is the canonical production-readiness source of truth for the GA4 `Ad Comparison` tab.

Use this file when asked whether GA4 Ad Comparison is robust, accurate, logical, production-ready, or suitable as a template for another platform source such as Meta, Google Ads, LinkedIn, TikTok, Instagram, or a custom integration.

Use `GA4/AD_COMPARISON.md` for the functional description of what the tab is and how it should behave.

## Archived June 27 Review (Revoked)

The June review mixed the live tab with Reports-owned output and used an
older model that merged exact imported revenue into comparison rows. It is
superseded by the controlling August certification and functional contract
above. It provides no current scope, formula, status, blocker, or remaining
evidence claim.

Historical live-tab improvements retained from that workstream:

- `f0ea65b1`: narrowed then-current source-created row eligibility
- `c630cc7b`: decoupled the All Campaigns table from dropdown sorting
- `b34dce2c`: made close leader-card rates explainable to two decimals
- `cbcd956c`: removed the empty descriptor gap above All Campaigns

The Reports-owned commit `d6ce76fc` is intentionally not an Ad Comparison
tab criterion. PDFs, downloads, saved reports, snapshots, scheduling,
delivery, and report-library behavior belong exclusively to the Reports
audit. There is no deferred Reports item in the current Ad Comparison tab
certification.

Non-blocking live-tab improvement retained for future consideration:

- add a visible `Campaign-row comparison` label if user research shows the
  current tab name is misleading

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

Every platform should define stable normalized comparison rows before cards,
charts, summaries, and tables render.

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

### 6. Declare Downstream Consumers Separately

For each platform, inventory downstream consumers without expanding the
live-tab certification boundary.

Reports-owned output must be validated under that platform's Reports audit.
It does not gate the live tab unless it changes a shared live-tab dependency.

### 7. Add Regression Coverage

At minimum, add tests for:

- selected metric controls only the intended card
- efficiency card excludes ineligible rows
- attention card ignores low-signal rows
- exact revenue/spend attribution is included only when safe
- unmatched revenue/spend stays visible but unallocated
- source scoping excludes unrelated campaigns/accounts
- loading, valid zero, empty, stale, and unavailable/failure states fail closed

## Historical Stable Response (Do Not Reuse)

This was the June 27 reusable response. It is revoked. Use only the controlling
current status at the top of this file. Reports status is not an input to the
live-tab certification.
