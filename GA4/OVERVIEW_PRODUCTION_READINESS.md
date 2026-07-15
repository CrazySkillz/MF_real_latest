# GA4 Overview Production Readiness

## Mandatory Anti-Overclaim Rule

This file is the canonical production-readiness record for the complete GA4 `Overview` section.

A previous readiness statement, passing test suite, or source-family certification is not proof for the complete Overview. A clean certification requires current evidence for every included visible value, fallback, source lifecycle, negative case, production-data boundary, and downstream consumer.

## Fresh Audit Identity

- Audit date: `2026-07-15`
- Branch: `main`
- Audited baseline commit: `d5d143ea` (`Document GA4 Shopify production readiness`)
- Audit type: fresh strict no-overclaim production-readiness audit
- Runtime changes in this audit: none
- Test changes in this audit: none
- Data mutations in this audit: none
- Documentation changed by this audit: this file only
- Worktree rule: unrelated pre-existing modifications and untracked files were preserved and are not audit output

Required references reviewed for this audit include `AGENTS.md`, `ARCHITECTURE_USER_JOURNEY.md`, `PRODUCTION_READINESS.md`, `GA4/README.md`, `GA4_DEVELOPMENT_WORKFLOW.md`, `GA4/OVERVIEW.md`, `GA4/FINANCIAL_SOURCES.md`, `GA4/REFRESH_AND_PROCESSING.md`, the GA4 Overview revenue/spend source-family readiness files, GA4 KPI/Benchmark/alert/Ad Comparison/Reports/timezone readiness files, Overview validation-runner documentation, and the Campaign DeepDive readiness trackers.

## Current Status

**GA4 Overview is not production-ready and is not clean-certified at commit `d5d143ea`.**

The earlier clean-certified answer is retracted. Current code and target-database evidence contain confirmed correctness defects, enabled-but-unproven source paths, stale or misleading failure/zero behavior, incomplete downstream proof, production-data damage, and a red source-family regression run.

This status applies to the complete included Overview scope below. It does not revoke a narrower source-family certification where that source's own exact scope remains proven, but no narrow certification can make the complete Overview ready while shared totals, fallbacks, other active sources, or downstream consumers remain unsafe.

The durable answer is:

`No. GA4 Overview is not production-ready or clean-certified at commit d5d143ea. The fresh July 15 audit found incompatible windows, zero/failure ambiguity, unscoped and stale spend fallbacks, visible on-hold source paths, production-data damage, incomplete downstream evidence, and three failing source-family regression guards. No runtime fix or cleanup was performed during the audit.`

## Scope

### Included

This audit includes the complete GA4 Overview value and lifecycle surface:

- campaign, client, owner, selected GA4 property, and saved GA4 campaign-filter scope
- Summary cards: Sessions, Users, Conversions, Engagement Rate, and Conversion Rate
- Revenue & Financial cards: Total Revenue, Pipeline Proxy, Total Spend, Profit, ROAS, ROI, and CPA
- GA4 native revenue and all imported revenue that can enter GA4 Total Revenue
- all active spend sources that can enter GA4 Total Spend, even when their separate provider readiness is excluded
- Revenue Sources, Spend Sources, and Pipeline Proxy source modals
- Campaign Breakdown
- Landing Pages
- Conversion Events
- add, edit, delete/deactivate, refresh/reprocess, scheduler, display, totals, and existing-data boundaries
- loading, empty, error, stale, missing, valid-zero, and unavailable states
- browser-generated GA4 report values and scheduled/server GA4 report values
- Overview-originated propagation into KPIs, Benchmarks, alerts/notifications, Ad Comparison, Insights, Reports, and Campaign DeepDive

### Excluded Source-Family Audits

The user explicitly excluded these as standalone provider/component certification projects:

- Google Ads spend provider readiness
- the previously scoped standalone Google Sheets/CSV spend component readiness project
- unrelated non-GA4 platform sections except where their persisted rows can contaminate GA4 Overview or an included downstream value

These exclusions do **not** exclude their effect on GA4 Total Spend, Profit, ROAS, ROI, CPA, source provenance, KPIs, Benchmarks, Insights, Reports, or Campaign DeepDive. If an excluded provider can feed an included value, its boundary, failure behavior, and contamination risk remain in scope.

### Valid Safe Exclusions

| Exclusion | Why it is safe to exclude from this certification | Boundary still included |
| --- | --- | --- |
| Dormant Shopify OAuth | The current GA4 chooser exposes the certified Admin API token flow; OAuth is shown only when server OAuth configuration is complete. | Shopify Admin API values and shared totals remain included. |
| Non-GA4 revenue contexts | Revenue reads explicitly filter `platform_context = ga4` and treat legacy null as GA4; LinkedIn and other explicit contexts are excluded from GA4 revenue totals. | Null-context legacy rows remain included because code treats them as GA4. |
| Provider delivery for future unrequested emails | Provider/inbox behavior cannot be inferred for future sends. | Any recorded or specifically claimed Overview report value remains included. |
| Future platforms not registered in the current product | They cannot feed current values. | Existing retained rows from hidden/deferred source types are not future platforms and are not safely excluded. |

### Unsafe Would-Be Exclusions

The following cannot be deferred out of complete Overview certification because they are visible, enabled, retained, or currently contribute to included values:

- Google Sheets Revenue and Google Sheets Spend
- Upload CSV Spend with the optional no-date mode
- active legacy Manual spend/revenue sources
- active legacy Salesforce revenue and Pipeline Proxy sources
- retained Meta/LinkedIn/custom spend sources because spend storage reads have no GA4 platform-context filter
- Google Ads spend values once configured, even though Google Ads provider readiness is excluded
- any source with no materialized rows when Overview falls back to cached `campaign.spend`
- Campaign DeepDive scheduled report visibility/delivery when a complete downstream readiness claim is requested

## Dynamic Visible-Value Inventory

This inventory was derived from current render code, query code, API routes, storage joins, shared formulas, scheduled/server report code, and downstream aggregate consumers. Static documentation alone was not used as proof.

| Visible value or state | Current source and transform | Window/scope | Current status |
| --- | --- | --- | --- |
| Sessions | `overviewTotalsSource.sessions` with fallback render to latest daily row | persisted daily lookback first; then campaign-lifetime to-date; then hard-coded 90-day breakdown | Blocked by incompatible fallback windows and unlabeled source/window changes. |
| Users | Same source hierarchy as Sessions, but daily users are summed across days | same mixed hierarchy | Formula is traced; UI tooltip incorrectly says `Unique GA4 users` even when daily users are additive and not cross-day deduplicated. |
| Conversions | Same coherent Summary source object | same mixed hierarchy | Locally covered, but inherits window/freshness and error-state blockers. |
| Engagement Rate | Daily rate only when greater than zero; otherwise to-date rate, then engaged sessions/sessions, then latest daily metric | can switch away from the chosen Summary source | Confirmed source-coherence and valid-zero defect. |
| Conversion Rate | Summary conversions divided by Summary sessions | source chosen by Summary hierarchy | Formula is correct when inputs are valid; inherits mixed-window/freshness/error blockers. |
| GA4 native financial revenue | `selectGA4FinancialTotalsSource` selects the candidate with the highest revenue from to-date, daily, and breakdown totals | campaign lifetime, configured daily lookback, and 90-day breakdown are compared | Confirmed incompatible-window maximum; not safely labeled to the user. |
| Financial conversions | Taken from the same object selected for native financial revenue | same selected incompatible candidate | Source pairing is locally correct; selection contract is not production-safe. |
| Imported revenue | Active GA4/null-context `revenue_records` joined to active sources, aggregated to date | `1900-01-01` through today | Platform scoping is traced; source-family lifecycle and target-data completeness are not complete. |
| Total Revenue | selected GA4 native revenue + imported revenue | mixes selected native window with imported lifetime | Additivity is tested; window meaning and active source safety block certification. |
| Revenue source count | imported source rows plus GA4 native only when native revenue is greater than zero | current loaded values | A configured native revenue metric with a valid zero is omitted from source count/provenance. |
| Pipeline Proxy | Combined successful HubSpot/Salesforce proxy responses | current-stage cached/on-demand provider data | Correctly excluded from confirmed revenue, but Salesforce request omits `platformContext=ga4` and server may fall back across GA4/LinkedIn/Meta candidates. |
| Total Spend | spend breakdown total when truthy, else cached `campaign.spend`, but only when a source definition is visible | all active campaign spend sources; no GA4 platform filter | Confirmed platform-boundary and stale-cache defects. |
| Profit | Total Revenue - Total Spend | same financial inputs | Hidden unless both numeric values are greater than zero, which incorrectly hides valid loss/zero-revenue cases. |
| ROAS | Total Revenue / Total Spend | same financial inputs | Shows unavailable when revenue is valid zero; incorrectly says it needs revenue. |
| ROI | (Total Revenue - Total Spend) / Total Spend | same financial inputs | Shows unavailable instead of `-100%` when spend is positive and revenue is valid zero. |
| CPA | Total Spend / financial conversions | spend plus conversions from selected native financial candidate | Formula is covered; source window, spend boundary, failure, and zero-state blockers remain. |
| Revenue Sources modal | merged source definitions and revenue breakdown rows | active GA4/null-context revenue sources | Shopify freshness is shown; Google Sheets/CSV/HubSpot freshness is not consistently shown. Errors silently become an empty list. |
| Spend Sources modal | merged unscoped active source definitions and spend breakdown rows | all active campaign spend sources | Can show and total retained source types from other platform contexts. Errors silently become an empty list. |
| Pipeline Proxy modal | successful HubSpot/Salesforce source entries | selected source configs | Salesforce cross-context fallback remains unsafe. |
| Campaign Breakdown | GA4 acquisition rows plus exact mapped imported campaign revenue | selected property, saved campaign filter, hard-coded 90 days | Row allocation protections are locally covered; live provider completeness and total-window parity remain unproven. |
| Landing Pages | GA4 rows with exact-key same-scope conversion supplementation | selected property/filter, hard-coded 90 days, API limit 50, UI renders 20 | Exact-key behavior is locally covered; request failure is rendered as `No ... available`, not error. |
| Conversion Events | GA4 event rows with exact event-name supplementation | selected property/filter, hard-coded 90 days, API limit 50, UI renders 25 | Exact-match behavior is locally covered; request failure is rendered as empty/unavailable. |
| Overview GA4 error banner | only the `ga4-daily` query error | daily query | Breakdown, to-date, landing-page, conversion-event, revenue, and spend failures are not represented by this banner. |
| Freshness | daily endpoint returns `refreshIsStale`, dates, warning, and expected refresh | persisted daily path | Used in Insights/Trends, not presented beside Overview Summary/financial values. |
| Browser GA4 report output | client-side report builder reads loaded Overview values | loaded browser state | Inherits every live Overview source, zero, failure, and freshness defect. |
| Scheduled/server GA4 report output | server rebuilds Summary/financial/source sections | server route/storage/provider inputs | Narrow formula tests pass; current production data and complete provider/deployed parity are not proven. |
| Direct Overview comparisons/deltas | none rendered in Overview | not applicable | No direct comparison value exists to certify. Trends/deltas appear only in downstream Insights/Campaign DeepDive and are audited there. |

## Dynamic Source-Family Inventory

### Current chooser exposure

| Family | New GA4 setup exposure | Readiness consequence |
| --- | --- | --- |
| Shopify Revenue | visible | Narrow Admin API token certification exists; shared Overview remains blocked. |
| HubSpot Revenue | visible | Narrow certification history exists; current broad regression guard is red and shared Overview remains blocked. |
| Google Sheets Revenue | visible | On hold, nontransactional replacement/failure-retention and automatic refresh evidence incomplete; cannot be excluded. |
| CSV Revenue | visible | Bounded dated-import certification exists; does not certify all Overview paths. |
| Salesforce Revenue | hidden for new v1 setup | Existing active rows remain readable and can feed totals/proxy; production inventory contains one active null-context source. |
| Manual Revenue | hidden | Existing sources remain supported by storage; must be inventoried before safe exclusion. |
| Google Ads Spend | visible | Standalone provider audit excluded, but values feed included Total Spend and derived values. |
| Google Sheets Spend | visible | On hold and lacks durable OAuth/polling/failure evidence; cannot be excluded. |
| CSV Spend | visible | Dated path has evidence; optional no-date mode remains enabled and unproven. |
| Manual Spend | hidden | Existing active rows remain included in GA4 totals. |
| LinkedIn/Meta Spend | hidden for new GA4 setup | Retained rows are not filtered by GA4 platform context and therefore are a contamination risk. |

### Target-database active source snapshot

Read-only aggregate queries were run against the configured target database on `2026-07-15`. No tokens, source identifiers, campaign identifiers, mappings, or secrets were printed or changed.

The target contained 65 campaigns, 35 campaigns with an active GA4 connection, and 35 active GA4 connections.

Active revenue sources on those GA4-connected campaigns:

| Platform context | Source type | Active sources | Linked records | Stored total |
| --- | ---: | ---: | ---: | ---: |
| GA4 | CSV | 2 | 4 | 1,500.00 |
| GA4 | Google Sheets | 2 | 4 | 45,500.00 |
| GA4 | HubSpot | 11 | 15 | 93,200.00 |
| GA4 | Shopify | 1 | 1 | 0.00 |
| legacy null, treated as GA4 | Salesforce | 1 | 180 | 6,000.00 |
| LinkedIn, excluded by revenue context filter | HubSpot | 2 | 2 | 20,000.00 |

Active spend sources on those GA4-connected campaigns:

| Stored platform context | Source type | Active sources | Linked records | Stored total |
| --- | ---: | ---: | ---: | ---: |
| legacy null | ad_platforms | 1 | 90 | 14,129.73 |
| legacy null | CSV | 3 | 6 | 2,000.00 |
| legacy null | Google Sheets | 3 | 4 | 1,197.50 |
| legacy null | Manual | 3 | 8 | 520.00 |

All three active CSV spend sources have a populated date-column mapping in the inspected configuration. That proves only the current active production rows; the enabled no-date product path remains unproven.

All two active Google Sheets revenue sources and all three active Google Sheets spend sources lacked a recorded success/freshness timestamp in the inspected mapping fields. None recorded `refreshStatus=failed`; absence of failure status is not proof of freshness.

## End-to-End Trace

| Path | Current trace | Result |
| --- | --- | --- |
| UI scope | `ga4-metrics.tsx` -> campaign query -> selected property -> saved campaign filter | Campaign/property intent is explicit. |
| GA4 daily | `/ga4-daily` -> reporting-timezone window -> stored rows -> due-day provider backfill -> upsert -> response freshness | Access and selected property are guarded; production freshness is not established. |
| GA4 to-date | `/ga4-to-date` -> selected connection -> campaign start/created date through prior UTC day -> live provider | Campaign lifetime does not match hard-coded 90-day Overview table window or every connection lookback. |
| Breakdown | `/ga4-breakdown` -> `getAcquisitionBreakdown` -> client aggregation/render | Selected property/filter and 90-day window are explicit. |
| Landing Pages | `/ga4-landing-pages` -> provider report -> exact-key supplement -> client first 20 rows | Exact-match safety covered; failure visibility is not. |
| Conversion Events | `/ga4-conversion-events` -> provider report -> exact-event supplement -> client first 25 rows | Exact-match safety covered; failure visibility is not. |
| Revenue | setup/refresh -> `revenue_sources`/`revenue_records` -> active GA4-context joins -> totals/breakdown/modal | Platform context is guarded; all family lifecycles and damaged-data boundaries are not. |
| Spend | setup/refresh -> `spend_sources`/`spend_records` -> unscoped active joins -> totals/breakdown/modal | No GA4 context filter; cached campaign fallback can replace missing records. |
| Delete | UI source modal -> campaign/source delete route -> deactivate/delete rows -> invalidation/recompute | Route ownership checks are locally present; every active source family has not been revalidated end to end. |
| Browser report | loaded Overview values -> client PDF composition | Directly inherits loaded-value defects. |
| Scheduled report | report scheduler/test/manual snapshot -> server GA4 PDF builder -> source reads/formulas | Narrow guards pass; complete live parity remains unproven. |

## Downstream Propagation Matrix

| Consumer | Overview-originated dependency | Current evidence | Status |
| --- | --- | --- | --- |
| Overview cards/tables | direct | current code trace plus focused tests | Blocked by confirmed defects. |
| Source modals | revenue/spend/proxy provenance and lifecycle | code trace; partial family evidence | Not complete. |
| KPIs | Revenue, Sessions, Users, Conversions, Engagement Rate, Conversion Rate, ROAS, ROI, CPA | current client formulas plus separate KPI readiness history | Narrow tests pass, but unsafe Overview inputs can propagate; not certified as part of this audit. |
| Benchmarks | same financial and GA4 current values | current client/server paths plus separate Benchmark readiness history | Narrow tests pass, but unsafe inputs can propagate. |
| Alerts/notifications | persisted KPI/Benchmark breaches and source refresh failures | separate lifecycle docs/tests | Current Overview source mixes and failures have not all been proven. |
| Ad Comparison | Total Revenue, GA4 native revenue, source provenance | client props and server report path | Prior readiness has deferred scheduled/server PDF evidence and does not cover current shared source defects. |
| Insights | Summary, financial values, availability, CPA, freshness | current page formulas and focused parity tests | Inherits unsafe source/window/error semantics; current Insights worktree is also independently modified and excluded from this audit output. |
| GA4 Reports | browser and server values, KPIs, Benchmarks, source provenance | report tests and prior deployed packets | Named Campaign DeepDive visibility defer and future variant evidence remain; unsafe Overview inputs block complete parity. |
| Campaign DeepDive Performance Summary | source-aware aggregate and fallback values | tracker says revenue/spend/scheduler paths are partially reviewed | Not complete. |
| Campaign DeepDive Budget & Financial | aggregate revenue/spend/ROI/ROAS/CPA | local and limited deployed evidence | Live source-refresh validation remains outstanding. |
| Campaign DeepDive Platform Comparison | GA4 parent revenue and aggregate financial totals | GA4-only evidence exists | Live multi-source validation remains outstanding. |
| Campaign DeepDive Trend Analysis | daily aggregate, snapshots, deltas | local code/tests | Final live historical validation remains outstanding. |
| Campaign DeepDive Executive Summary | aggregate financial and health values | local/deployed history | Inherits current aggregate/source defects and future source gates. |
| Campaign DeepDive Custom Report | aggregate, KPI, Benchmark, Trend and report sections | local rendering tests | Deployed scheduled email/attachment value evidence remains outstanding. |

## Lifecycle Matrix

| Lifecycle | Proven | Unproven or failed |
| --- | --- | --- |
| GA4 connect/select | campaign access, selected property, one primary in current target snapshot | future token/provider behavior; three 30-day connections conflict with 90-day table window |
| GA4 refresh/on-demand backfill | route and scheduler logic, refresh-token material present | no current provider call was made; all stored daily campaign maxima are older than yesterday |
| Revenue add | guarded routes and active GA4-context joins | Google Sheets complete failure/rollback path; hidden legacy paths |
| Revenue edit/refresh | HubSpot/Shopify/CSV have bounded evidence | Google Sheets is on hold; current HubSpot broad guard is red |
| Revenue delete/deactivate | ownership and active-source exclusion tests | complete active-family browser/provider rerun not current |
| Spend add | CSV/Google Sheets/Google Ads routes exist | Google Sheets and excluded provider correctness cannot be inferred; no-date CSV enabled |
| Spend edit/refresh | some stable-source tests exist | no complete GA4 platform filter; Google Sheets automatic mutation evidence incomplete |
| Spend delete/deactivate | ownership guard and active join behavior | cached `campaign.spend` can remain a misleading fallback when records are absent |
| Scheduler/reprocess | local paths and selected deployed packets exist | every active source family, normal timer execution, and exact downstream parity are not currently proven |
| Existing-data cleanup | narrower Shopify/CSV/KPI cleanups have documented boundaries | current orphan spend and spend-cache drift have no reviewed cleanup boundary |

## Confirmed Blockers

### B1. Incompatible Summary, table, and financial windows

`dateRange` is hard-coded to 90 days, while `GA4_DAILY_LOOKBACK_DAYS` comes from the active connection and is 30 or 90. The target database has 3 active 30-day connections and 32 active 90-day connections. Summary can therefore use 30-day daily totals while Campaign Breakdown, Landing Pages, and Conversion Events use 90 days. The to-date route uses campaign lifetime. Financial native revenue then selects the highest-revenue candidate across these incompatible windows. Overview does not clearly label this mixed-window/max contract.

### B2. Engagement Rate can leave the chosen Summary source

The Summary source may be daily, but a valid daily engagement rate of zero is treated as missing. Code then falls through to to-date or latest-day values. This violates the documented coherent Summary-source rule and conflates zero with absence.

### B3. Users provenance is misleading

When daily facts win, Users is the sum of daily user rows and is not a cross-day deduplicated unique-user count. The visible tooltip says `Unique GA4 users for the selected campaign scope.`

### B4. Failures become zero or empty data

Spend-to-date, imported revenue, source lists, revenue/spend breakdowns, diagnostics, Landing Pages, Conversion Events, and Pipeline Proxy often return client fallback zero, empty array, or null on HTTP/JSON failure. Only the daily query drives the Overview GA4 error banner. Executives can therefore see `$0`, no sources, or `No ... available` when the real state is a request/provider failure.

### B5. Valid zero financial results are shown as unavailable

With positive spend and valid zero revenue, Profit should be negative spend, ROAS should be `0x`, and ROI should be `-100%`. Current rendering hides Profit and shows ROAS/ROI as unavailable with `needs revenue`. A configured GA4 revenue metric at zero can also disappear from source count/provenance.

### B6. Spend is not GA4 platform scoped and can use stale cache

`getSpendSources`, `getSpendTotalForRange`, and `getSpendBreakdownBySource` filter campaign and active state but not GA4 `platform_context`. GA4 Overview therefore consumes every active campaign spend source. If breakdown total is zero, client code falls back to `campaign.spend`.

Target evidence:

- 6 GA4-connected campaigns have active spend sources.
- 5 of 6 have cached `campaign.spend` different from the materialized active-record total.
- aggregate absolute drift is 21,571.73 in stored campaign currencies.
- 2 active sources have zero materialized records but nonzero cached spend: 507.70 and 120.00.

### B7. Visible Google Sheets paths are on hold but feed included totals

Google Sheets Revenue and Spend are visible in the GA4 source choosers. Their canonical component docs retain incomplete transactional replacement/failure retention, durable OAuth, automatic polling, and deployed mutation evidence. Current target rows also lack recorded success/freshness timestamps. A visible active source cannot be treated as a harmless deferred exclusion.

### B8. Hidden/legacy sources still affect current values

Salesforce and Manual setup cards are hidden, but retained active records remain readable. The target includes one active legacy null-context Salesforce revenue source with 180 records totaling 6,000.00 and three active legacy Manual spend sources totaling 520.00. Hidden creation UI does not make retained data safe or certified.

### B9. Salesforce Pipeline Proxy can cross platform context

The client does not pass `platformContext=ga4` to the Salesforce proxy endpoint. The endpoint searches GA4, LinkedIn, and Meta candidates when context is absent and can fall back to the newest candidate when no exact GA4-scope match is found. The client can then associate endpoint data with an eligible GA4 source definition.

### B10. Daily freshness is not proven for the current target

The target snapshot has 35 active access-token connections. All have refresh-token material and expired `expires_at` metadata, so provider refresh may be possible but was not invoked during this read-only audit. Only 9 campaigns have persisted daily rows, 26 have none, and every stored campaign's latest date is older than yesterday (`2026-01-03` through `2026-07-12`). On-demand backfill may repair this, but no live provider call or deployed browser proof was run. Overview does not display the returned stale warning beside its Summary/financial cards.

### B11. Baseline source-family regression suite was red; resolved by Current Commit 1

The broad rerun produced 3 failures and 49 passes across the three isolated files:

- HubSpot inventory guard uses an over-wide route slice and now includes a later Shopify cleanup mutation.
- HubSpot source-modal guard rejects the substring `Sync`, which is present in the `lastSyncedAt` freshness field, not as a user refresh action.
- Shopify tags guard expects a one-line expression that current code implements across multiple lines; the visible chooser and runtime tag handling are present.

These were stale/brittle tests rather than runtime defects. Root-cause tracing also found a second copy of the same over-wide inventory slice in `server/hubspot-revenue-damaged-data-inventory.test.ts`; it was outside the original three-file packet but failed for the same reason.

Current Commit 1 bounded both inventory guards at the immediately following Shopify inventory route, replaced the broad `Sync` substring check with rendered action-title/text checks, and made the Shopify tags assertion whitespace-tolerant while retaining the exact tags branch. No runtime or data-path file changed. The original three-file source-family packet passed 52 tests, the expanded duplicate-guard packet passed 50 tests, the 15-file focused Overview packet passed 146 tests, and `npm run check` passed. B11 is closed; B1 through B10 and B12 remain open.

### B12. Complete downstream proof is absent

Separate readiness files contain historical certifications, local-only claims, or named deferred validations. Current Campaign DeepDive trackers still identify partial revenue/spend/scheduler review, live source-refresh gaps, live multi-source gaps, live historical Trend validation, and deployed scheduled Custom Report evidence. Those cannot be converted into complete Overview downstream proof by reference.

## Production Data Condition

Production data may already mislead Overview and is partly damaged.

### Confirmed damage or misleading state

- 568,233 orphan spend rows belong to GA4-connected campaigns and have no matching `spend_sources` row:
  - 376,251 `linkedin_api` rows across 5 campaigns, totaling 46,025,813.63
  - 191,982 `meta_api` rows across 2 campaigns, totaling 70,014,594.50
- These orphan rows are currently excluded from Overview totals by the inner join to active source definitions, but they are damaged/unbounded persisted history and have no reviewed cleanup boundary.
- Across the whole target database, orphan spend row count is 4,044,066.
- 414 revenue records and 906 spend records on GA4-connected campaigns belong to inactive sources. Current active joins exclude them; no cleanup is implied.
- 2 active spend sources have no records while Overview can use nonzero cached campaign spend.
- 5 of 6 campaigns with active spend sources have materialized-vs-cached drift.

### Clean checks in this snapshot

- orphan revenue records: 0
- revenue record/source campaign mismatches: 0
- spend record/source campaign mismatches: 0
- duplicate GA4 daily campaign/property/date keys: 0
- daily rows without a matching active property: 0
- campaigns with no primary or multiple primary GA4 connections: 0
- invalid/future revenue or spend dates in the inspected GA4-connected set: 0
- mixed active-source currencies per inspected campaign: 0
- active revenue sources with zero records: 0

Coarse grouping found same-campaign/source-type/display-name clusters for Google Sheets and HubSpot revenue, but no active sources had byte-identical complete mapping configurations. These are review candidates, not proven duplicates, and must not be deleted automatically.

### Cleanup rule

No cleanup was run. The forward read/display defects must be fixed first. A future cleanup must be dry-run-first, owner/campaign/source scoped, and must prove why each orphan or drifted row is safe to change. The 568,233 GA4-campaign orphan rows must not be generalized to the 4,044,066 whole-database rows without separate platform/tenant evidence.

## Negative-Case Matrix

| Case | Required behavior | Current result |
| --- | --- | --- |
| Campaign access denied | fail closed | Proven on traced endpoints. |
| Missing property/connection | explicit unavailable/reconnect state | Mostly guarded; several secondary queries silently return null/empty. |
| Provider/token failure | retain stable data with explicit stale/error provenance | Daily path can retain rows with warning; Overview does not surface warning, and other paths often show zero/empty. |
| Valid zero Sessions/Conversions/Revenue | preserve zero as a value | Engagement and financial render paths conflate zero with missing. |
| Incompatible windows | reject, normalize, or clearly label | Current code selects/falls back across 30/90/lifetime windows. |
| Source with no materialized records | unavailable/fail closed | Spend can use cached campaign value. |
| Inactive source | exclude from total | Proven by active joins. |
| Orphan record | exclude and inventory | Excluded by inner join; large damaged inventory remains. |
| Foreign spend context | exclude from GA4 | Not implemented in shared spend reads. |
| Hidden legacy source | either migrate, explicitly support, or fail closed | Retained rows still contribute. |
| Table request failure | explicit error, not empty truth | Landing Pages and Conversion Events render empty-state copy. |
| Pipeline source context mismatch | fail closed | Salesforce can fall back across contexts. |

## Validation Evidence

### Passed during this audit

- `npm run check`
  - result: passed
- focused Overview/downstream regression run:
  - 15 test files passed
  - 146 tests passed
  - included GA4 UI/filter, revenue additivity, financial rules/source parity, spend additivity, latest-day spend, source lifecycle recompute, Insights/report parity, outcome totals, Performance Summary, Trend Analysis, and report email guards
- `server/shopify-ga4-disconnect-transaction.test.ts`
  - 7 tests passed in the isolated source-family run
- read-only target-database aggregate inventory
  - completed without data mutation or secret output

### Failed during this audit

- `server/hubspot-revenue-ga4-overview-regression.test.ts`
  - 24 passed, 2 failed
- `server/latest-day-revenue-regression.test.ts`
  - 18 passed, 1 failed
- combined with `server/shopify-ga4-disconnect-transaction.test.ts`
  - 1 file passed, 2 files failed; 49 tests passed, 3 failed

### Passed after Current Commit 1

- original three-file source-family packet
  - 3 files passed; 52 tests passed
- expanded packet including the duplicate HubSpot damaged-data inventory guard
  - 3 files passed; 50 tests passed
- focused Overview/downstream regression run
  - 15 files passed; 146 tests passed
- `npm run check`
  - passed
- code/data boundary
  - test assertions and this readiness record changed; no runtime, schema, API, scheduler, or data mutation path changed

### What passing tests do not prove

- current live GA4 values for all 35 connections
- provider refresh/token behavior for current expired metadata
- correctness of the mixed 30/90/lifetime window contract
- correct failure/valid-zero UI behavior identified above
- exact completeness of every active revenue/spend source lifecycle
- safe cleanup boundaries for orphan or drifted production rows
- current deployed browser pixel/text behavior
- all scheduled report/provider/inbox variants
- complete downstream parity across every configured source mix

## Current Commit Queue

Current Commit 0 is this documentation-only baseline. It lowers the status, records the dynamic inventories, and makes no runtime or data change.

### Current Commit 1 — Repair stale source-family regression guards — complete

Completed on `2026-07-15` as a test-only correction.

- bound the HubSpot inventory test to the actual read-only handler instead of a later route marker that now includes Shopify cleanup code
- replace the broad `Sync` substring prohibition with action-specific refresh/reprocess assertions
- update the Shopify tags guard to accept the current multiline exact logic
- rerun the 3-file source-family packet, the 15-file focused packet, and TypeScript

This commit closes B11 only. It does not make Overview production-ready.

### Current Commit 2 — Define one explicit Overview window/source contract — next

This is the smallest safe next runtime commit.

- resolve 30-day connection lookback versus hard-coded 90-day table queries
- stop selecting maximum revenue across incompatible lifetime/daily/breakdown windows unless that behavior becomes an explicitly labeled product contract
- keep Summary metrics coherent, including Engagement Rate and valid zero
- correct Users provenance copy
- cover 30-day and 90-day connections, zero values, negative adjustments, and provider-empty fallbacks

### Current Commit 3 — Fail closed on request errors and preserve valid zeros

- distinguish loading, unavailable, stale, error, and valid zero for every Overview query
- do not turn failed revenue/spend requests into `$0`
- do not turn failed Landing Pages/Conversion Events requests into legitimate empty data
- render valid zero Profit/ROAS/ROI semantics correctly
- keep stable cached content visible during background refresh where available

### Current Commit 4 — Scope GA4 spend and remove stale cached fallback

- add an explicit GA4 spend context contract through UI, routes, storage, schedulers, reports, and aggregates
- define the bounded treatment of legacy null-context sources before filtering or migration
- stop substituting `campaign.spend` when an active source has no materialized rows
- add cross-platform contamination, source-without-records, delete, and recompute tests

### Current Commit 5 — Resolve visible on-hold source paths

Choose and document one safe product decision for each on-hold path:

- complete Google Sheets transactional replacement, last-good failure retention, durable OAuth, automatic polling, freshness, and deployed mutation proof; or
- hide/disable the path and fail closed so it cannot feed totals until certified

Apply the same rule to optional no-date CSV Spend. Leaving an enabled path on hold is not acceptable for complete certification.

### Current Commit 6 — Reconcile retained legacy sources

- inventory every active null-context Manual, Salesforce, ad-platform, and other retained source
- prove source identity and intended GA4 ownership
- migrate, explicitly support, or deactivate only within an exact reviewed boundary
- pass Salesforce Pipeline Proxy context explicitly and fail closed on mismatch

### Current Commit 7 — Complete source-family lifecycle evidence

For every enabled family that can feed Overview, cover add, edit, delete, refresh/reprocess, scheduler, modal display, totals, downstream recompute, failure retention, and damaged-data boundary. Reuse narrow HubSpot/Shopify/CSV evidence only after current tests and shared inputs pass.

### Current Commit 8 — Production freshness/provider evidence

- run bounded deployed validation for representative 30-day and 90-day GA4 connections
- prove token refresh, on-demand backfill, scheduled refresh, stale warning, reconnect, provider-empty, and delayed-processing behavior
- surface Overview freshness without implying provider completeness
- record exact campaign/property/window evidence without secrets

### Current Commit 9 — Production inventory and bounded cleanup

- rerun owner/campaign/source-scoped inventory after forward fixes
- classify all orphan, inactive, duplicate-candidate, no-record, and cache-drift rows
- apply only reviewed exact candidates
- rerun post-apply inventory and record counts/skips

### Current Commit 10 — Complete downstream propagation and deployed UI evidence

- automate and manually verify the complete propagation matrix across KPIs, Benchmarks, alerts/notifications, Ad Comparison, Insights, Reports, and every named Campaign DeepDive subsection
- verify browser and scheduled/server artifacts use the same source/window/failure semantics
- complete named deployed report/Trend/multi-source evidence relevant to the claimed scope
- rerun all matrices and update this file only after evidence is current

Estimated remaining work: a minimum of 9 bounded engineering/evidence commits or packets (`Current Commit 2` through `10`). The count will increase if Google Sheets is completed rather than temporarily hidden/fail-closed, or if production cleanup separates into multiple independently reviewed batches.

## UI Validation Requirement

UI validation is still necessary before final certification, but it is not the next step. Current defects are already proven from code and production data, so browser validation now would only confirm known unsafe behavior.

After the forward fixes and automated tests pass, UI validation must cover:

- 30-day and 90-day connection windows and visible labels
- valid zero and negative financial outcomes
- provider/query failures without false zeros or false empty tables
- stale daily data and reconnect behavior
- each enabled source add/edit/delete/refresh path
- legacy-source migration/deactivation effects
- source modal counts, labels, freshness, and totals
- browser report values
- scheduled/server report attachment values and delivery state
- all included downstream surfaces for the same controlled campaign/source mix

## Final Certification Gate

GA4 Overview may be called clean-certified only when all of the following are true at the same current commit and target-data state:

- every row in the dynamic value inventory is proven or explicitly unavailable/fail-closed
- one compatible, labeled window/source contract is used for each visible metric
- valid zero, missing, stale, loading, and failure states are distinct
- every enabled/retained source that can feed an included total has complete lifecycle proof
- GA4 spend is platform scoped and no stale cache can substitute for missing materialized records
- all confirmed blockers are fixed and regression-covered
- focused and broad source-family tests are green
- production inventory is rerun and every mutation has an exact reviewed boundary
- deployed provider/freshness/browser evidence is current
- the full downstream propagation matrix is current and passes
- no named downstream validation relevant to the claimed scope remains open
- this canonical file is updated with exact evidence and no contradictory clean-ready statement remains

Until then, the required answer is **not production-ready**.
