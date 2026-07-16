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

Current Commit 2 was committed and pushed as `5cff21ad`, deployed, and passed the user-confirmed bounded UI smoke validation on `2026-07-16`. The validation covered one configured campaign/window, consistent visible window labels, Users provenance copy, campaign-to-date financial labeling, and downloaded Overview report parity; it does not prove all 30/60/90 live provider variants. Current Commit 3 deployed as `7b162083`, but its first UI check failed closeout because an over-broad global error aggregator displayed a generic red warning for initial hidden/optional request failures. The smallest follow-up is implemented and still needs deployment validation. B6-B10 and B12 remain open, so the complete Overview status remains not production-ready.

The durable answer is:

`No. GA4 Overview is not production-ready or clean-certified. Commit 1 repaired stale regression guards, Commit 2 (5cff21ad) fixed and deployed the coherent window/source contract with bounded UI smoke validation, and Commit 3 locally fixes failure-versus-zero rendering and Overview report fail-closed behavior. Unscoped/stale spend, visible on-hold paths, retained legacy sources, freshness/provider proof, production-data cleanup, and complete downstream evidence remain open.`

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
| Sessions | configured-lookback persisted daily totals; same-window breakdown response when daily rows are absent | selected connection's 30/60/90 completed-day lookback | Commit 2 bounded deployed smoke passed for one configured window; full 30/60/90 provider evidence remains open. Commit 3 distinguishes failed fallback requests from successful zero/empty responses locally. |
| Users | Same source hierarchy as Sessions; users are additive across daily or fallback breakdown rows | configured completed-day lookback | Commit 2 deployed tooltip smoke passed; broader provider variants remain open. |
| Conversions | Same coherent Summary source object | configured completed-day lookback | Commit 3 locally renders unavailable instead of zero only when no successful or last-good Summary source exists. |
| Engagement Rate | engaged sessions divided by sessions from the selected Summary source | configured completed-day lookback | Valid zero is preserved and no campaign-to-date/latest-day cross-source fallback remains. |
| Conversion Rate | Summary conversions divided by Summary sessions | source chosen by Summary hierarchy | Formula is correct when inputs are valid; inherits mixed-window/freshness/error blockers. |
| GA4 native financial revenue | ordered complete-source selection: campaign-to-date provider, persisted daily where available to the caller, then configured-lookback breakdown only when earlier candidates are absent | campaign-to-date section with explicitly ordered fallbacks | Maximum selection is removed; zero/negative are valid and provider-empty objects fall through. Commit 3 locally makes missing required revenue inputs unavailable instead of `$0`. |
| Financial conversions | Taken from the same object selected for native financial revenue | same ordered financial candidate | Source pairing and selection order are locally covered. |
| Imported revenue | Active GA4/null-context `revenue_records` joined to active sources, aggregated to date | `1900-01-01` through today | Platform scoping is traced; source-family lifecycle and target-data completeness are not complete. |
| Total Revenue | selected GA4 native revenue + imported revenue | mixes selected native window with imported lifetime | Additivity is tested; window meaning and active source safety block certification. |
| Revenue source count | imported source rows plus GA4 native only when native revenue is greater than zero | current loaded values | A configured native revenue metric with a valid zero is omitted from source count/provenance. |
| Pipeline Proxy | Combined successful HubSpot/Salesforce proxy responses | current-stage cached/on-demand provider data | Correctly excluded from confirmed revenue, but Salesforce request omits `platformContext=ga4` and server may fall back across GA4/LinkedIn/Meta candidates. |
| Total Spend | spend breakdown total when truthy, else cached `campaign.spend`, but only when a source definition is visible | all active campaign spend sources; no GA4 platform filter | Confirmed platform-boundary and stale-cache defects. |
| Profit | Total Revenue - Total Spend | same financial inputs | Commit 3 locally renders the loss when revenue is valid zero and both configured inputs are available. |
| ROAS | Total Revenue / Total Spend | same financial inputs | Commit 3 locally renders `0.00x` for positive spend and valid zero revenue; only missing/zero spend blocks the ratio. |
| ROI | (Total Revenue - Total Spend) / Total Spend | same financial inputs | Commit 3 locally renders `-100%` for positive spend and valid zero revenue. |
| CPA | Total Spend / financial conversions | spend plus conversions from selected native financial candidate | Formula is covered; source window, spend boundary, failure, and zero-state blockers remain. |
| Revenue Sources modal | merged source definitions and revenue breakdown rows | active GA4/null-context revenue sources | Commit 3 locally distinguishes source-list failure from an empty source set and retains last-good rows during background failure. Freshness gaps remain. |
| Spend Sources modal | merged unscoped active source definitions and spend breakdown rows | all active campaign spend sources | Commit 3 locally distinguishes source-list failure from empty; platform contamination remains B6. |
| Pipeline Proxy modal | successful HubSpot/Salesforce source entries | selected source configs | Salesforce cross-context fallback remains unsafe. |
| Campaign Breakdown | GA4 acquisition rows plus exact mapped imported campaign revenue | selected property/filter and configured 30/60/90 completed-day lookback | Row allocation and local window parity are covered; live provider completeness remains unproven. |
| Landing Pages | GA4 rows with exact-key same-scope conversion supplementation | selected property/filter and configured completed-day lookback; API limit 50, UI renders 20 | Commit 3 locally separates initial loading, successful empty rows, last-good data after refetch failure, and unavailable error. |
| Conversion Events | GA4 event rows with exact event-name supplementation | selected property/filter and configured completed-day lookback; API limit 50, UI renders 25 | Commit 3 locally applies the same explicit state contract. |
| Overview request warning | combined error state for connection, GA4, table, revenue, spend, source-list, and configured Pipeline Proxy queries | affected request set | Commit 3 locally distinguishes last-successful cached content from inputs with no usable data. |
| Freshness | daily endpoint returns `refreshIsStale`, dates, warning, and expected refresh | persisted daily path | Used in Insights/Trends, not presented beside Overview Summary/financial values. |
| Browser GA4 report output | client-side report builder reads loaded Overview values | loaded browser state | Commit 3 locally refuses an Overview PDF when a selected subsection lacks required inputs; broader downstream/deployed parity remains open. |
| Scheduled/server GA4 report output | server rebuilds Summary/financial/source sections | server route/storage/provider inputs | Commit 3 locally makes selected Overview subsections fail closed on required provider/storage failures while retaining optional unselected-section fallbacks. Current production/deployed parity remains unproven. |
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
| GA4 to-date | `/ga4-to-date` -> selected connection -> campaign start/created date through prior UTC day -> live provider | Used for the explicitly labeled campaign-to-date financial contract, not as a configured-lookback Summary fallback. |
| Breakdown | `/ga4-breakdown` -> `getAcquisitionBreakdown` -> client aggregation/render | Selected property/filter and configured 30/60/90-day window are explicit. |
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
| GA4 connect/select | campaign access, selected property, one primary in current target snapshot; configured window parity fixed by Commit 2 | future token/provider behavior and full deployed 30/60/90 provider variants |
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

### B1. Incompatible Summary, table, and financial windows — resolved by Current Commit 2

The root cause was a page-level hard-coded `90days` request combined with connection-specific daily lookback and a maximum-revenue selector spanning campaign-to-date, daily, and breakdown candidates. Current Commit 2 derives every Overview live-table request from the selected connection's validated 30/60/90-day setting, excludes intraday `today` from Landing Pages and Conversion Events, labels Summary/tables as completed-day lookback and financials as campaign-to-date, and replaces maximum selection with a fixed complete-source order. Browser and scheduled report builders now use the same contract. Commit `5cff21ad` deployed and the bounded UI smoke passed for one configured campaign/window; full 30/60/90 provider validation remains in Current Commit 8.

### B2. Engagement Rate can leave the chosen Summary source — resolved by Current Commit 2

The root cause was a positive-value availability test and a separate Engagement Rate fallback chain. Current Commit 2 uses row/response presence for source availability, adds `engagedSessions` to the same-window acquisition fallback, and derives Engagement Rate only from the selected Summary source. Zero is retained as a valid rate.

### B3. Users provenance is misleading — resolved by Current Commit 2

The root cause was copy that described additive daily/breakdown totals as unique. The tooltip now says that GA4 users are summed for the selected window and that the same user may appear on more than one day or breakdown row.

### B4. Failures become zero or empty data — resolved locally by Current Commit 3

The root cause was that Overview query functions caught HTTP/JSON failures and returned successful-looking `0`, `[]`, `null`, or empty objects. React Query therefore had no error state, the renderer could not distinguish failure from valid zero/empty data, and browser/scheduled report builders could export the same false values. Current Commit 3 throws on HTTP failure, malformed JSON, and `success:false`; retains last-successful React Query data during background failure; renders explicit loading, unavailable, error, and successful-empty states; gates configured Pipeline Proxy requests to relevant saved sources; and makes selected browser/scheduled Overview report subsections fail closed when required data is unavailable. No endpoint response shape, storage method, schema, provider query, or persisted data changed.

The first deployed UI check found a presentation-only follow-up in the page-wide banner. `overviewDataHasError` combined every request error, including hidden Diagnostics and the duplicate connection-list request, and rendered the generic initial-load warning even though visible sections already owned their own `Unavailable` state. The bounded follow-up removes hidden/duplicate requests from banner eligibility, keeps initial failures section-local, and shows the page-wide warning only on the Overview tab when a failed visible request is retaining last-successful data. Request error detection, visible unavailable states, valid-zero behavior, and report fail-closed gates are unchanged.

### B5. Valid zero financial results are shown as unavailable — resolved locally by Current Commit 3

The root cause was positive-value render gating (`financialRevenue > 0`) rather than input availability. Current Commit 3 gates financial cards on successful/last-good input availability instead: with positive spend and valid zero revenue, Profit is negative spend, ROAS is `0.00x`, and ROI is `-100%`. Missing/zero spend still blocks ROAS/ROI denominators, and CPA still requires positive conversions. Commit 2 already preserved configured zero/negative native financial candidates and GA4 revenue provenance.

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

Current Commit 1 (`56bfdced`) bounded both inventory guards at the immediately following Shopify inventory route, replaced the broad `Sync` substring check with rendered action-title/text checks, and made the Shopify tags assertion whitespace-tolerant while retaining the exact tags branch. No runtime or data-path file changed. The original three-file source-family packet passed 52 tests, the expanded duplicate-guard packet passed 50 tests, the 15-file focused Overview packet passed 146 tests, and `npm run check` passed. B11 is closed. Current Commit 2 later closed B1-B3 and passed its bounded deployed UI smoke; Current Commit 3 closes B4-B5 locally. B6-B10 and B12 remain open.

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
| Provider/token failure | retain stable data with explicit stale/error provenance | Commit 3 locally retains last-successful client data with an error warning and marks inputs unavailable when no last-good value exists; provider/token and deployed failure injection remain open. |
| Valid zero Sessions/Conversions/Revenue | preserve zero as a value | Commit 2 preserves Summary/financial-source zero; Commit 3 locally preserves zero/empty response semantics and renders zero-revenue Profit/ROAS/ROI correctly. |
| Incompatible windows | reject, normalize, or clearly label | Commit 2 fixed configured completed-day Summary/tables and labeled campaign-to-date financials; bounded deployed smoke passed, while full 30/60/90 provider evidence remains open. |
| Source with no materialized records | unavailable/fail closed | Spend can use cached campaign value. |
| Inactive source | exclude from total | Proven by active joins. |
| Orphan record | exclude and inventory | Excluded by inner join; large damaged inventory remains. |
| Foreign spend context | exclude from GA4 | Not implemented in shared spend reads. |
| Hidden legacy source | either migrate, explicitly support, or fail closed | Retained rows still contribute. |
| Table request failure | explicit error, not empty truth | Commit 3 locally renders explicit unavailable errors and retains last-successful table rows on background refresh failure. |
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

### Passed after Current Commit 2

- commit `5cff21ad` pushed to `main` and deployed through Render
- user-confirmed bounded UI smoke passed for one configured campaign/window and downloaded Overview report
- focused Overview/downstream packet: 15 files; 142 tests
- focused GA4 financial/filter/UI/HubSpot/outcome packet: 5 files; 89 tests
- `npm run check` and `npm run build` passed

### Passed locally after Current Commit 3

- focused Overview/downstream packet: 15 files; 144 tests
- focused failure/source/report packet: 3 files; 60 tests
- HubSpot Pipeline Proxy scope guard: 1 file; 26 tests
- `npm run check` and `npm run build` passed
- first deployed UI check of `7b162083` exposed the over-broad global banner and did not pass closeout
- bounded banner follow-up reran the 15-file / 144-test packet, `npm run check`, and `npm run build` successfully; follow-up deployment validation remains pending

### What passing tests do not prove

- current live GA4 values for all 35 connections
- provider refresh/token behavior for current expired metadata
- all live 30/60/90 provider variants beyond the one-window Commit 2 smoke
- deployed failure/valid-zero UI behavior introduced by Current Commit 3
- exact completeness of every active revenue/spend source lifecycle
- safe cleanup boundaries for orphan or drifted production rows
- current deployed browser pixel/text behavior
- all scheduled report/provider/inbox variants
- complete downstream parity across every configured source mix

## Current Commit Queue

Current Commit 0 is this documentation-only baseline. It lowers the status, records the dynamic inventories, and makes no runtime or data change.

### Current Commit 1 — Repair stale source-family regression guards — complete

Implemented on `2026-07-15`, then committed and pushed to `main` on `2026-07-16` as `56bfdced`. This was a test-and-documentation-only correction.

- bound the HubSpot inventory test to the actual read-only handler instead of a later route marker that now includes Shopify cleanup code
- replace the broad `Sync` substring prohibition with action-specific refresh/reprocess assertions
- update the Shopify tags guard to accept the current multiline exact logic
- rerun the 3-file source-family packet, the 15-file focused packet, and TypeScript

This commit closes B11 only. It does not make Overview production-ready.

### Current Commit 2 — Define one explicit Overview window/source contract — complete

Implemented, committed, and pushed to `main` on `2026-07-16` as `5cff21ad`, then deployed through Render.

- resolve 30-day connection lookback versus hard-coded 90-day table queries
- stop selecting maximum revenue across incompatible lifetime/daily/breakdown windows unless that behavior becomes an explicitly labeled product contract
- keep Summary metrics coherent, including Engagement Rate and valid zero
- correct Users provenance copy
- cover 30-day, 60-day, and 90-day connections, zero values, negative adjustments, and provider-empty fallbacks

Local validation:

- focused Overview/downstream packet: 15 files passed; 142 tests passed
- focused GA4 financial/filter/UI/HubSpot/outcome packet: 5 files passed; 89 tests passed
- `npm run check`: passed
- `npm run build`: passed outside the restricted sandbox after the sandboxed build could not spawn esbuild (`EPERM`)
- the full repository suite was also run and remains red outside this packet; representative failures assert Google Ads fallback and scheduler-call strings that are absent from `HEAD`, while both Current Commit 2 packets pass. No globally green-suite claim is made.
- no schema migration, dependency, persisted-data mutation, or API response field removal was introduced

Deployed validation:

- user-confirmed bounded UI smoke passed for one configured campaign/window
- Summary, Campaign Breakdown, Landing Pages, and Conversion Events showed the same configured completed-day label
- the Users tooltip used the additive-users provenance copy
- Revenue & Financial was labeled campaign-to-date
- the downloaded Overview report matched the observed screen values
- this did not prove separate live 30/60/90 provider campaigns, failure injection, valid-zero/negative production fixtures, or scheduled/server delivery variants; those remain in later gates

Current Commit 2 closes B1-B3. Overview remains not production-ready.

### Current Commit 3 — Fail closed on request errors and preserve valid zeros — deployed; banner follow-up awaiting deployment

- throw on HTTP failure, malformed JSON, and `success:false` for connection, GA4, revenue, spend, source-list, breakdown, table, and configured Pipeline Proxy queries
- distinguish initial loading, successful zero/empty, last-successful data after background failure, and unavailable-without-cache states
- do not turn failed revenue/spend requests into `$0` or failed Landing Pages/Conversion Events requests into legitimate empty data
- render valid zero-revenue Profit/ROAS/ROI semantics correctly
- query Pipeline Proxy only for configured active CRM proxy sources and preserve saved/last-good content on provider failure
- fail closed for selected browser and scheduled/server Overview report subsections when required inputs fail
- preserve route shapes, storage/provider formulas, selected property/campaign scope, source mutations, scheduler timing, and persisted data

Local validation:

- focused Overview/downstream packet: 15 files passed; 144 tests passed
- focused failure/source/report packet: 3 files passed; 60 tests passed
- HubSpot Pipeline Proxy scope guard: 1 file passed; 26 tests passed
- `npm run check` and `npm run build`: passed
- no schema migration, dependency, API response removal, provider-query change, source mutation, or persisted-data mutation was introduced

Current Commit 3 runtime behavior deployed as `7b162083`. The first UI check did not close validation because of the over-broad global banner. The bounded banner follow-up is implemented; deployment and one-refresh UI validation remain pending.

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

Estimated remaining work after the Current Commit 3 implementation: a minimum of 7 bounded engineering/evidence commits or packets (`Current Commit 4` through `10`), plus Current Commit 3 follow-up deployment/UI validation. The count will increase if Google Sheets is completed rather than temporarily hidden/fail-closed, or if production cleanup separates into multiple independently reviewed batches.

## UI Validation Requirement

Current Commit 1 does **not** require a separate UI validation pass. Commit `56bfdced` changed only static regression tests and this readiness document; it did not change the client bundle, server runtime, API behavior, calculations, persistence, schedulers, or rendered UI. Its proportionate validation is the green source-family packets, the 15-file focused packet, TypeScript, and staged/committed file-boundary review recorded above. A Render deployment of this commit has no new user-visible behavior to validate.

This narrow decision does not waive UI validation for later runtime commits or final Overview certification.

Current Commit 2's required bounded UI smoke validation passed after `5cff21ad` deployed. The evidence is limited to the configured campaign/window and downloaded report checked by the user; it does not substitute for the broader provider/freshness/source/downstream validation below.

Current Commit 3's first deployed UI check exposed the over-broad global banner and therefore did not pass closeout. After the bounded follow-up deploys, validation is one normal Overview refresh: the incorrect generic initial-load banner must be absent, while any genuinely failed visible section remains `Unavailable` and valid data remains visible. This validation proves only Current Commit 3; it does not certify the complete Overview while later blockers remain.

After the forward fixes and automated tests pass, UI validation must cover:

- 30-day, 60-day, and 90-day connection windows and visible labels
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
