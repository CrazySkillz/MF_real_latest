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

**GA4 Overview is not production-ready and is not clean-certified at the current local Commit 18 state.**

Commit 17's bounded forward implementation deployed as `36676deb`; the user confirmed the existing GA4 campaign's Total Revenue, Total Spend, and Revenue/Spend source lists remained unchanged. That closes only the bounded forward/no-visible-regression packet. Provider-cycle rollback evidence and the eight-source disposition remain external/open, and no production cleanup is authorized.

Commit 18's fail-closed downstream correction is locally implemented and validated, but it is not yet committed, deployed, or externally validated. Therefore it cannot yet close the final non-scheduler parity queue or support clean certification.

The earlier clean-certified answer is retracted. Commits 1–15 close only their documented bounded packets. Commit 16's persisted-window correction is deployed and closed for the user-confirmed existing 30-day connection only; 60/90-day variants, observed automatic token renewal, and post-publish seven-day durability remain unproven. Enabled-but-unproven source paths, incomplete external and downstream proof, retained production-data cleanup, and named scheduler exclusions still block complete certification.

This status applies to the complete included Overview scope below. It does not revoke a narrower source-family certification where that source's own exact scope remains proven, but no narrow certification can make the complete Overview ready while shared totals, fallbacks, other active sources, or downstream consumers remain unsafe.

Commits 1–15 retain only their documented bounded closures. Commit 16 deployed as `747192ff`. The user queried the authenticated connection response for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127` and confirmed `lookbackDays` is `30`; this proves that the deployed client contract receives the saved 30-day window and explains the correction from the previous erroneous 90-day fallback. It does not prove a 60/90-day fixture, provider-value parity, automatic token-expiry advancement, or seven-day durability. B7-B8, B10, and B12 remain open, so the complete Overview status remains not production-ready.

The durable answer is:

`No. GA4 Overview is not production-ready or clean-certified. Commits 1–16 are closed only for their documented bounded packets. Commit 16 proves the deployed saved 30-day contract, not 60/90-day variants or OAuth durability. Commits 17–18, unavailable edge fixtures, retained-source/data disposition, final downstream proof, and named scheduler exclusions remain open or unproven.`

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
- any retained active legacy Manual spend/revenue source until exact inventory and reviewed deletion/disposition; GA4 Manual create/edit is blocked
- active legacy Salesforce revenue and Pipeline Proxy sources
- retained Meta/LinkedIn/custom spend sources because spend storage reads have no GA4 platform-context filter
- Google Ads spend values once configured, even though Google Ads provider readiness is excluded
- Campaign DeepDive scheduled report visibility/delivery when a complete downstream readiness claim is requested

## Dynamic Visible-Value Inventory

This inventory was derived from current render code, query code, API routes, storage joins, shared formulas, scheduled/server report code, and downstream aggregate consumers. Static documentation alone was not used as proof.

| Visible value or state | Current source and transform | Window/scope | Current status |
| --- | --- | --- | --- |
| Sessions | Sum of persisted GA4 daily rows fetched for the exact selected property and saved campaign filter | selected connection's 30/60/90 completed-day lookback | Corrective Commit 18 follow-up restores the scheduler-backed source locally; deployed value validation remains open. |
| Users | Sum of persisted daily `totalUsers` rows for the exact selected property/filter | configured completed-day lookback | Explicitly a sum of daily users, not a cross-day deduplicated user count; deployed value validation remains open. |
| Conversions | Same coherent Summary source object | configured completed-day lookback | Commit 3 locally renders unavailable instead of zero only when no successful or last-good Summary source exists. |
| Engagement Rate | engaged sessions divided by sessions from the selected Summary source | configured completed-day lookback | Valid zero is preserved and no campaign-to-date/latest-day cross-source fallback remains. |
| Conversion Rate | Summary conversions divided by Summary sessions | source chosen by Summary hierarchy | Formula is correct when inputs are valid; inherits mixed-window/freshness/error blockers. |
| GA4 native financial revenue | ordered complete-source selection: campaign-to-date provider, persisted daily where available to the caller, then configured-lookback breakdown only when earlier candidates are absent | campaign-to-date section with explicitly ordered fallbacks | Maximum selection is removed; zero/negative are valid and provider-empty objects fall through. Commit 3 locally makes missing required revenue inputs unavailable instead of `$0`. |
| Financial conversions | Taken from the same object selected for native financial revenue | same ordered financial candidate | Source pairing and selection order are locally covered. |
| Imported revenue | Active GA4/null-context `revenue_records` joined to active sources, aggregated to date | `1900-01-01` through today | Platform scoping is traced; source-family lifecycle and target-data completeness are not complete. |
| Total Revenue | selected GA4 native revenue + imported revenue | mixes selected native window with imported lifetime | Additivity is tested; window meaning and active source safety block certification. |
| Revenue source count | active imported source rows plus GA4 native when a native revenue metric is configured or the ordered native value is non-zero | current loaded values | Configured native valid-zero and negative values retain GA4-native provenance. Deployed missing/zero/negative fixture evidence remains Commit 15. |
| Pipeline Proxy | Same-scope active HubSpot/Salesforce source plus successful endpoint value or same-scope saved fallback | current-stage cached/on-demand provider data | Correctly excluded from confirmed revenue. GA4 requests `platformContext=ga4`; both CRM selectors fail closed when no exact campaign/source scope matches. |
| Total Spend | scoped materialized spend breakdown; scoped source-backed lifetime total is the fallback only when breakdown data is absent | active `ga4` plus legacy null-context spend sources for the selected campaign | Commit 4 deployed validation confirms Total Spend agrees with the Spend Sources list and remains correct after refresh for the observed campaign. Foreign-context and active-source-with-zero-record production fixtures remain open. |
| Profit | Total Revenue - Total Spend | same financial inputs | Commit 3 locally renders the loss when revenue is valid zero and both configured inputs are available. |
| ROAS | Total Revenue / Total Spend | same financial inputs | Commit 3 locally renders `0.00x` for positive spend and valid zero revenue; only missing/zero spend blocks the ratio. |
| ROI | (Total Revenue - Total Spend) / Total Spend | same financial inputs | Commit 3 locally renders `-100%` for positive spend and valid zero revenue. |
| CPA | Total Spend / financial conversions | spend plus conversions from selected native financial candidate | Formula is covered; source window, spend boundary, failure, and zero-state blockers remain. |
| Revenue Sources modal | merged source definitions and revenue breakdown rows | active GA4/null-context revenue sources | Commit 3 locally distinguishes source-list failure from an empty source set and retains last-good rows during background failure. Freshness gaps remain. |
| Spend Sources modal | merged GA4-scoped active source definitions and spend breakdown rows | active `ga4` plus legacy null-context spend sources | Commit 3 distinguishes failure from empty; Commit 4 enforces the source boundary and passed bounded deployed total/list parity. |
| Pipeline Proxy modal | positive same-scope HubSpot/Salesforce provider entries | selected source configs | Cross-context fallback is blocked; deployed same-scope positive-value evidence remains Commit 15. |
| Campaign Breakdown | GA4 acquisition rows plus exact mapped imported campaign revenue | selected property/filter and configured 30/60/90 completed-day lookback | Row allocation and local window parity are covered; live provider completeness remains unproven. |
| Landing Pages | GA4 rows with exact-key same-scope conversion supplementation | selected property/filter and configured completed-day lookback; API limit 50, UI renders 20 | Commit 3 locally separates initial loading, successful empty rows, last-good data after refetch failure, and unavailable error. |
| Conversion Events | GA4 event rows with exact event-name supplementation | selected property/filter and configured completed-day lookback; API limit 50, UI renders 25 | Commit 3 locally applies the same explicit state contract. |
| Overview request warning | combined error state for connection, GA4, table, revenue, spend, source-list, and configured Pipeline Proxy queries | affected request set | Commit 3 locally distinguishes last-successful cached content from inputs with no usable data. |
| Freshness | daily endpoint returns `refreshIsStale`, provider coverage, latest activity, warning, and expected refresh | persisted daily path | Normal detail is stable in Connection Details; the Overview header does not insert late success text, while actual stale/provider failures retain an explicit warning. |
| Browser GA4 report output | client-side report builder reads loaded Overview values | loaded browser state | Commit 3 locally refuses an Overview PDF when a selected subsection lacks required inputs; broader downstream/deployed parity remains open. |
| Scheduled/server GA4 report output | server rebuilds Summary/financial/source sections | server route/storage/provider inputs | Commit 3 locally makes selected Overview subsections fail closed on required provider/storage failures while retaining optional unselected-section fallbacks. Current production/deployed parity remains unproven. |
| Direct Overview comparisons/deltas | none rendered in Overview | not applicable | No direct comparison value exists to certify. Trends/deltas appear only in downstream Insights/Campaign DeepDive and are audited there. |

## Dynamic Source-Family Inventory

### Current chooser exposure

| Family | New GA4 setup exposure | Readiness consequence |
| --- | --- | --- |
| Shopify Revenue | visible | Narrow Admin API token certification exists; shared Overview remains blocked. |
| HubSpot Revenue | visible | Narrow certification history exists; current broad regression guard is red and shared Overview remains blocked. |
| Google Sheets Revenue | hidden for new GA4 setup; deployed UI confirmed | Current Commit 5 blocks new UI and direct-API creation. Existing exact-source edit/continuity remains enabled and unproven. |
| CSV Revenue | visible | Bounded dated-import certification exists; does not certify all Overview paths. |
| Salesforce Revenue | hidden for new v1 setup | Existing active rows remain readable and can feed totals/proxy; production inventory contains one active null-context source. |
| Manual Revenue | blocked for create/edit; exact delete retained | Not a supported GA4 source. The owner-scoped inventory found none; any future retained row requires exact reviewed deletion. |
| Google Ads Spend | visible | Standalone provider audit excluded, but values feed included Total Spend and derived values. |
| Google Sheets Spend | hidden for new GA4 setup; deployed UI confirmed | Current Commit 5 blocks new UI, omitted-context, and direct GA4 API creation. Existing exact-source edit/continuity remains enabled and unproven. |
| CSV Spend | visible | New GA4 sources require a Date column in UI and API. Existing undated sources are retained only for continuity and remain unproven. |
| Manual Spend | blocked for create/edit; exact delete retained | The exact `Summer splash` `$400` source was deleted on `2026-07-30`; post-delete inventory and `$14,045.83` Total Spend passed. Any other retained row remains lifecycle/disposition work. |
| LinkedIn/Meta Spend | hidden for new GA4 setup | Explicit foreign contexts are excluded from GA4 totals. Existing orphan scheduler rows remain separately inventoried production-data cleanup work and are not visible source-backed totals. |

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

All three active CSV spend sources have a populated date-column mapping in the inspected configuration. Current Commit 5 locally disables new no-date GA4 creation; any already-undated saved source remains an unproven continuity row for later inventory.

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
| Spend | setup/refresh -> `spend_sources`/`spend_records` -> active GA4/legacy-null joins -> totals/breakdown/modal | Commit 4 scopes the full browser/server path and passed bounded deployed total/list/refresh parity. The active-source-with-zero-record production fixture remains unproven. |
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
| GA4 connect/select | campaign access, selected property, one primary in current target snapshot; configured window parity fixed by Commit 2; deployed 30-day scope passed | future token/provider behavior and deployed 60/90-day provider variants |
| GA4 refresh/on-demand backfill | route and scheduler logic, refresh-token material present, and deployed 30-day provider coverage/activity evidence | current timer-fired and on-demand trigger evidence; no suitable live 90-day fixture in the validated account |
| Revenue add | guarded routes and active GA4-context joins | Google Sheets complete failure/rollback path; hidden legacy paths |
| Revenue edit/refresh | HubSpot/Shopify/CSV have bounded evidence | Google Sheets is on hold; current HubSpot broad guard is red |
| Revenue delete/deactivate | ownership and active-source exclusion tests | complete active-family browser/provider rerun not current |
| Spend add | CSV/Google Sheets/Google Ads routes exist | Google Sheets and excluded provider correctness cannot be inferred; no-date CSV enabled |
| Spend edit/refresh | stable-source tests plus Commit 4 context-write/self-heal guards | Google Sheets automatic mutation evidence remains incomplete |
| Spend delete/deactivate | ownership, platform-scoped source resolution, active join behavior, and zero-record handling | complete active-family deployed rerun remains open |
| Scheduler/reprocess | local paths and selected deployed packets exist | every active source family, normal timer execution, and exact downstream parity are not currently proven |
| Existing-data cleanup | narrower Shopify/CSV/KPI cleanups have documented boundaries | current orphan spend and spend-cache drift have no reviewed cleanup boundary |

## Confirmed Blockers

### B1. Incompatible Summary, table, and financial windows — resolved by Current Commit 2

The root cause was a page-level hard-coded `90days` request combined with connection-specific daily lookback and a maximum-revenue selector spanning campaign-to-date, daily, and breakdown candidates. Current Commit 2 derives every Overview live-table request from the selected connection's validated 30/60/90-day setting, excludes intraday `today` from Landing Pages and Conversion Events, labels Summary/tables as completed-day lookback and financials as campaign-to-date, and replaces maximum selection with a fixed complete-source order. Browser and scheduled report builders now use the same contract. Commit `5cff21ad` deployed and the bounded UI smoke passed for one configured campaign/window; the later Current Commit 8 packet passed deployed 30-day evidence, while 60-day and live 90-day provider variants remain unproven.

### B2. Engagement Rate can leave the chosen Summary source — resolved by Current Commit 2

The root cause was a positive-value availability test and a separate Engagement Rate fallback chain. Current Commit 2 uses row/response presence for source availability, adds `engagedSessions` to the same-window acquisition fallback, and derives Engagement Rate only from the selected Summary source. Zero is retained as a valid rate.

### B3. Summary source and Users provenance — corrective Current Commit 18 follow-up implemented locally

The product contract is scheduler-backed completed-day metrics. Commit `4141614e` incorrectly changed browser and scheduled Summary to the separate live Campaign Breakdown aggregate, which made deployed values differ from the persisted daily dataset. The corrective follow-up restores Summary to the successful `/ga4-daily` response for the exact property, saved campaign filter, and saved completed-day window. Users remains explicitly labeled as the sum of daily `totalUsers`, not cross-day unique users. Deployment and same-campaign scheduler/UI validation remain required.

### B4. Failures become zero or empty data — resolved by Current Commit 3

The root cause was that Overview query functions caught HTTP/JSON failures and returned successful-looking `0`, `[]`, `null`, or empty objects. React Query therefore had no error state, the renderer could not distinguish failure from valid zero/empty data, and browser/scheduled report builders could export the same false values. Current Commit 3 throws on HTTP failure, malformed JSON, and `success:false`; retains last-successful React Query data during background failure; renders explicit loading, unavailable, error, and successful-empty states; gates configured Pipeline Proxy requests to relevant saved sources; and makes selected browser/scheduled Overview report subsections fail closed when required data is unavailable. No endpoint response shape, storage method, schema, provider query, or persisted data changed.

The first deployed UI check found a presentation-only follow-up in the page-wide banner. `overviewDataHasError` combined every request error, including hidden Diagnostics and the duplicate connection-list request, and rendered the generic initial-load warning even though visible sections already owned their own `Unavailable` state. The bounded follow-up removes hidden/duplicate requests from banner eligibility, keeps initial failures section-local, and shows the page-wide warning only on the Overview tab when a failed visible request is retaining last-successful data. Request error detection, visible unavailable states, valid-zero behavior, and report fail-closed gates are unchanged.

### B5. Valid zero financial results are shown as unavailable — resolved by Current Commit 3

The root cause was positive-value render gating (`financialRevenue > 0`) rather than input availability. Current Commit 3 gates financial cards on successful/last-good input availability instead: with positive spend and valid zero revenue, Profit is negative spend, ROAS is `0.00x`, and ROI is `-100%`. Missing/zero spend still blocks ROAS/ROI denominators, and CPA still requires positive conversions. Commit 2 already preserved configured zero/negative native financial candidates and GA4 revenue provenance.

### B6. Spend is not GA4 platform scoped and can use stale cache — resolved by Current Commit 4

The root cause was shared spend reads that filtered campaign and active state but not `platform_context`, GA4 browser calls that omitted `platformContext=ga4`, and truthy fallback selection that treated a valid zero breakdown as absent and substituted denormalized `campaign.spend`. The same unscoped reads reached GA4 reports, KPI/Benchmark jobs, cleanup helpers, notifications, outcome totals, and the GA4-backed Executive Summary aggregate.

Current Commit 4 adds an optional shared spend-context predicate. Explicit `ga4` reads include rows tagged `ga4` plus legacy null-context rows; every other explicit context remains exact-match; callers that omit context retain the existing all-context behavior. New and edited GA4 spend sources store `ga4` explicitly, while a legacy null-context source self-heals only when that exact source is edited. No bulk migration or persisted-data cleanup is performed. The GA4 browser, delete route, reports, jobs, notifications, and aggregates now pass the GA4 context, and valid zero materialized spend no longer falls through to `campaign.spend`.

The original target evidence motivating the fix remains:

- 6 GA4-connected campaigns have active spend sources.
- 5 of 6 have cached `campaign.spend` different from the materialized active-record total.
- aggregate absolute drift is 21,571.73 in stored campaign currencies.
- 2 active sources have zero materialized records but nonzero cached spend: 507.70 and 120.00.

### B7. Retained Google Sheets paths are on hold and feed included totals

Current Commit 5 removes Google Sheets Revenue and Spend from new GA4 source setup and rejects new direct-API creation, but deliberately does not mutate or deactivate saved sources. Current Commit 6 completed their exact owner-scoped inventory without mutating them. Their canonical component docs retain incomplete transactional replacement/failure retention, durable OAuth, automatic polling, and deployed mutation evidence. Current target rows also lack recorded success/freshness timestamps. Those retained rows remain open under Current Commit 7 and cannot be treated as certified.

### B8. Hidden/legacy sources still affect current values

Salesforce and Manual setup cards are hidden, but retained active records remain readable. The original audit target snapshot included one active legacy null-context Salesforce revenue source with 180 records totaling 6,000.00 and three active legacy Manual spend sources totaling 520.00; this is historical baseline evidence, not the later owner-scoped production inventory. Hidden creation UI does not make retained data safe or certified.

Current Commit 6 adds campaign- and owner-access-guarded read-only retained-source inventories. The completed owner-scoped production result lists every active retained/null-context source ID, stored and normalized context, sanitized mapping identity, record count, and amount and explicitly forbids automatic cleanup. The user confirmed source `570de6df-d49a-40c3-9a78-1a61a55394b1` was unwanted legacy Manual Spend and deleted only that exact source on `2026-07-30`. Total Spend became `$14,045.83`; the post-delete inventory confirmed the source absent, only the unchanged Google Ads source remained for `Summer splash`, and the owner-wide retained-source count fell from nine to eight.

### B9. Salesforce Pipeline Proxy cross-context fallback — fixed; positive deployed fixture unavailable

Root cause: the GA4 client omitted `platformContext=ga4`; the endpoint treated absent/invalid context as permission to search GA4, LinkedIn, and Meta, then selected the newest source when no exact GA4-scope match existed. Current Commit 6 passes GA4 explicitly, requires one supported explicit context for every caller, searches only that context, rejects mapping-context mismatches, and returns `404` rather than substituting another source when no exact scoped source exists. Local regression coverage passes and the code is deployed. The completed owner-scoped inventory found no active retained Salesforce source among the owner's active GA4 campaigns, so a Salesforce UI check was not applicable.

### B10. Daily freshness is not proven for the current target

The target snapshot has 35 active access-token connections. All have refresh-token material and expired `expires_at` metadata, so provider refresh may be possible but was not invoked during this read-only audit. Only 9 campaigns have persisted daily rows, 26 have none, and every stored campaign's latest date is older than yesterday (`2026-01-03` through `2026-07-12`). On-demand backfill may repair this, but no live provider call or deployed browser proof was run.

Confirmed root cause: `/ga4-daily` already returned expected refresh, last completed refresh, latest stored day, oldest due missing day, provider warning, and stale state. Overview ignored those fields and its Connection Details `Last updated` used a breakdown/metrics request timestamp, so an old persisted daily boundary could look freshly updated merely because a request completed. The validation runner retained only the boolean/date subset and could not distinguish no refresh from rows returned, provider-empty, or failed refresh. Three route-level GA4 provider callers also included every generic `403` in their auth classifier, causing permission failures to attempt token refresh.

Smallest safe local fix: retain every existing calculation and storage path; add only backward-compatible `/ga4-daily` refresh-attempt outcome fields; render latest stored/expected-through state and a stale warning in Overview; use `lastCompletedRefreshAt` in Connection Details; extend the existing compact validation packet without exposing raw provider errors; and remove generic `403` from the three duplicated auth classifiers while retaining confirmed 401/unauthenticated/invalid-credential/invalid-grant signals. No query dimensions, aggregation formulas, source writes, scheduler timing, token schema, campaign scope, or response field was removed or renamed.

Commit 8 follow-up production RCA on `2026-07-30`: campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, and its exact three-value saved scope had 20 persisted rows. Nineteen provider-returned rows were rewritten together at `2026-07-30T11:54Z`, but their latest activity date remained `2026-07-12` while the expected completed-day boundary was `2026-07-29`. The deployed UI showed the non-failure delayed wording, and the active connection retained encrypted access, refresh, and client-secret material. Separately, `/health/scheduler` showed the newly deployed process started at `2026-07-30T13:36:52.677Z`, startup refresh disabled, zero runs for that process, and the next scheduled run at `2026-07-31T03:00:00.000Z`. This proves the warning was not evidence of a reconnect failure: the contract incorrectly equated the latest returned activity row with provider coverage, while the current process had not yet reached its scheduled run.

Smallest safe follow-up: a successful `/ga4-daily` provider query now records `providerCoverageThroughDate = dataThroughDate` and a separate completion timestamp only after the provider result and persisted reread succeed. Freshness uses that coverage without inserting absent days or changing any returned metric. Connection Details renders `Checked through ...; latest activity ...`; an actual provider/storage failure retains the Overview warning. The remaining core `getTimeSeriesData` generic `403` classifier was removed, refresh persistence remains inside the refresh-error boundary, and the post-refresh provider retry remains outside it so permission/provider failures cannot be relabeled as reconnect. Campaign/property/filter inputs, aggregation, response compatibility, scheduler timing, and stored metric rows are unchanged.

Deployed coverage/activity validation passed after `950c5091`: the user confirmed `Checked through 2026-07-29; latest activity 2026-07-12`, no false delayed warning, and unchanged campaign/property scope. UI-stability RCA then confirmed that the header rendered before the separate `/ga4-daily` query and conditionally inserted this normal success summary several seconds later, resizing the card. Because Connection Details already retains the same status, the smallest safe UI fix removes only the duplicate normal header block. The stale/failure warning, data query, metrics, stored rows, coverage response, and campaign scope are unchanged. Commit `c26d2768` deployed, and the user confirmed the header stayed stable and the late text did not appear. The bounded UI-stability follow-up is closed.

Remaining Current Commit 8 read-only investigation on `2026-07-30` used only `SELECT` transactions and `/health/scheduler`; no application GA4 endpoint was called because `/ga4-daily`, provider-validation, and manual scheduler routes can refresh tokens or persist rows. Owner-scoped inventory found three active, primary, non-empty 90-day connections (`myGA4`, `another1`, and `insta3`), but each uses property `yesop`, which `isYesopMockProperty(...)` explicitly classifies as simulated. The other relevant 90-day row, `Summer splash`, has an empty Property ID and correctly fails closed. Therefore no suitable live 90-day fixture exists in the validated account without creating, editing, or reconnecting production data, which was explicitly prohibited.

At `2026-07-30T15:14:09.442Z`, deployed `/health/scheduler` reported a healthy current process started at `2026-07-30T15:07:27.669Z`, `started=true`, `timerScheduled=true`, UTC `03:00`, `runOnStartup=false`, next run `2026-07-31T03:00:00.000Z`, `lastRunStatus=idle`, no error, and `totalScheduledRuns=0`. Stored-row timestamps include historical updates near configured schedule times, but rows do not persist trigger identity, so they are not timer-fired proof. Current timer-fired behavior remains unproven until a post-run health capture records `lastRunTrigger=scheduled`, `lastRunStatus=success`, and an incremented `totalScheduledRuns`.

The `2026-07-29` reconnect incident does not close B10. Read-only target metadata proved campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127` still used connection `6649d4b6-66b0-49ea-9a56-4724c53ca9e4`, created at `2026-07-11T07:19:33.983Z` before the documented switch from Google OAuth Testing to In production later that day. Reconnect classification deployed as `efaa6f60`; the post-publish GA4 consent flow then completed, and the user confirmed on `2026-07-30` that GA4 connected, the intended campaign selection and metrics loaded, and the state remained correct after refresh. Automatic renewal and more-than-seven-day durability remain open.

### B11. Baseline source-family regression suite was red; resolved by Current Commit 1

The broad rerun produced 3 failures and 49 passes across the three isolated files:

- HubSpot inventory guard uses an over-wide route slice and now includes a later Shopify cleanup mutation.
- HubSpot source-modal guard rejects the substring `Sync`, which is present in the `lastSyncedAt` freshness field, not as a user refresh action.
- Shopify tags guard expects a one-line expression that current code implements across multiple lines; the visible chooser and runtime tag handling are present.

These were stale/brittle tests rather than runtime defects. Root-cause tracing also found a second copy of the same over-wide inventory slice in `server/hubspot-revenue-damaged-data-inventory.test.ts`; it was outside the original three-file packet but failed for the same reason.

Current Commit 1 (`56bfdced`) bounded both inventory guards at the immediately following Shopify inventory route, replaced the broad `Sync` substring check with rendered action-title/text checks, and made the Shopify tags assertion whitespace-tolerant while retaining the exact tags branch. No runtime or data-path file changed. The original three-file source-family packet passed 52 tests, the expanded duplicate-guard packet passed 50 tests, the 15-file focused Overview packet passed 146 tests, and `npm run check` passed. B11 is closed. Current Commit 2 later closed B1-B3, Current Commit 3 closed B4-B5, and Current Commit 4 closed B6 for their bounded deployed packets. B7-B10 and B12 remain open.

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
- 2 active spend sources have no records while their campaigns retain nonzero cached spend. Commit 4 prevents GA4 Overview from displaying that cache, but the production zero-record fixture and persisted drift remain for later validation/inventory/cleanup review.
- 5 of 6 campaigns with active spend sources have materialized-vs-cached drift; Commit 4 removes the GA4 read dependency but does not mutate or certify those stored caches.

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

### Current Commit 9 owner-scoped refresh (`2026-07-30`)

The transaction at `2026-07-30T15:44:40.022Z` used `BEGIN READ ONLY` and covered all 10 active GA4 campaigns for the validated owner, 73 revenue sources, and 93 spend sources. It changed nothing.

- orphan revenue: 0
- orphan spend: 4 groups / 325,478 rows
- record/source campaign mismatches: 0 revenue and 0 spend
- inactive-source records: 0 revenue and 45 spend groups / 885 rows; active joins already exclude them
- exact duplicate-signature candidates: 0
- active sources with zero records: 0
- unexpected active platform contexts: 0
- materialized-versus-cached spend drift: 2 campaigns

The four orphan groups are `linkedin_daily_metrics` / `linkedin_api` and `meta_daily_metrics` / `meta_api` for each of `myGA4` and `Summer splash`. A second read-only density check at `2026-07-30T16:07:51.727Z` found the `myGA4` LinkedIn group had grown from 43,194 to 43,254 rows, proving an active producer rather than static legacy residue.

Root cause: both platform schedulers first persisted their returned data in the canonical LinkedIn/Meta daily tables, then appended the same daily window to generic `spend_records` under pseudo source IDs. No matching `spend_sources` definition exists, and `spend_records` has no applicable uniqueness constraint, so each scheduler run appended more orphan copies. Overview generic spend reads inner-join active source definitions, while LinkedIn and Meta analytics read their canonical daily tables, so these pseudo-source writes are redundant and excluded from current visible totals.

The smallest forward fix removes only the two test-mode and two live pseudo-source write blocks. Canonical daily persistence, provider calls, campaign scoping, refresh state, and the existing cached `campaign.spend` updates remain unchanged. The two cache-drift findings are retained because `campaign.spend` has broader LinkedIn/Meta scheduler and Dashboard/campaign-list consumers; resolving that boundary is separate work. No existing production record was deleted or updated.

Immediate deployed validation: commit `57036ebc` was pushed to `main` and deployed. A second full `BEGIN READ ONLY` inventory at `2026-07-30T16:35:49.623Z` covered the same 10 owner campaigns with active GA4 connections, 73 revenue sources, and 93 spend sources. It returned the same four orphan groups and 325,538 rows as the final pre-deploy density check at `2026-07-30T16:07:51.727Z`; all other clean/inactive classifications remained unchanged. This proves no immediate post-deploy growth and no deployment-startup write. It does not yet prove the first timer-fired LinkedIn/Meta scheduler cycle, because both schedulers wait four hours after process startup before their first run.

### Cleanup rule

No cleanup was run. The forward producer is deployed and immediate no-growth validation passed; the same read-only inventory must run once more after the first four-hour scheduler cycle before the forward path is closed. Any later cleanup must be separately authorized, dry-run-first, owner/campaign/source scoped, and must prove why each exact row is safe to change. Neither the earlier 568,233 GA4-campaign snapshot nor the Current Commit 9 owner-scoped result may be generalized to the 4,044,066 whole-database rows without separate platform/tenant evidence.

## Negative-Case Matrix

| Case | Required behavior | Current result |
| --- | --- | --- |
| Campaign access denied | fail closed | Proven on traced endpoints. |
| Missing property/connection | explicit unavailable/reconnect state | Mostly guarded; several secondary queries silently return null/empty. |
| Provider/token failure | retain stable data with explicit stale/error provenance | Commit 3 locally retains last-successful client data with an error warning and marks inputs unavailable when no last-good value exists; provider/token and deployed failure injection remain open. |
| Valid zero Sessions/Conversions/Revenue | preserve zero as a value | Commit 2 preserves Summary/financial-source zero; Commit 3 locally preserves zero/empty response semantics and renders zero-revenue Profit/ROAS/ROI correctly. |
| Incompatible windows | reject, normalize, or clearly label | Commit 2 fixed configured completed-day Summary/tables and labeled campaign-to-date financials; bounded deployed smoke passed, while full 30/60/90 provider evidence remains open. |
| Source with no materialized records | return source-backed zero without stale substitution | Commit 4 returns zero and retains the configured source identity; production fixture evidence remains open. |
| Inactive source | exclude from total | Proven by active joins. |
| Orphan record | exclude and inventory | Excluded by inner join; large damaged inventory remains. |
| Foreign spend context | exclude from GA4 | Commit 4 excludes explicit non-GA4 contexts from GA4 reads; production fixture evidence remains open. |
| Hidden legacy source | either migrate, explicitly support, or fail closed | GA4 Manual create/edit is blocked and exact deletion is retained; every other retained contributor still requires lifecycle proof or explicit disposition under Commit 17. |
| Table request failure | explicit error, not empty truth | Commit 3 locally renders explicit unavailable errors and retains last-successful table rows on background refresh failure. |
| Pipeline source context mismatch | fail closed | HubSpot and Salesforce selectors require exact platform/campaign scope and return unavailable on mismatch; deployed same-scope positive evidence remains Commit 15. |

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

### Current Commit 3 validation

- focused Overview/downstream packet: 15 files; 144 tests
- focused failure/source/report packet: 3 files; 60 tests
- HubSpot Pipeline Proxy scope guard: 1 file; 26 tests
- `npm run check` and `npm run build` passed
- first deployed UI check of `7b162083` exposed the over-broad global banner and did not pass closeout
- banner follow-up `a0b205b5` reran the 15-file / 144-test packet, `npm run check`, and `npm run build` successfully
- user-confirmed deployed one-refresh follow-up validation passed: the incorrect banner was gone
- this bounded validation did not exercise synthetic request failures or a valid-zero production fixture

### Current Commit 4 validation

- focused affected-consumer packet: 8 files passed; 80 tests passed
- expanded spend/lifecycle/scheduler/report packet: 11 files passed; 129 tests passed
- focused Commit 4 regression guard: 6 tests passed
- `npm run check`: passed
- `npm run build`: passed outside the restricted sandbox after the sandboxed build could not spawn esbuild (`EPERM`)
- the broad `server/source-safety-regression.test.ts` run has seven pre-existing Instagram route-slice failures; the Commit 4 spend-delete and Custom Integration scope assertions pass. No globally green-suite claim is made.
- no schema migration, dependency, API response-field removal, provider query, scheduler cadence, bulk data migration, or persisted-data cleanup was introduced
- committed and pushed as `7c54da65`, then deployed through Render
- user-confirmed bounded deployed validation passed on `2026-07-30`: Total Spend agreed with the Spend Sources list and remained correct after refresh
- a live foreign-context fixture and a live active-source-with-zero-record fixture remain unverified

### GA4 reconnect incident and local classifier validation (`2026-07-29`)

- read-only target connection metadata confirmed the affected credential predates the Google OAuth publishing-status change; no tokens were read, printed, refreshed, or mutated
- focused reconnect classifier: 1 file / 6 tests passed
- adjacent GA4 OAuth/UI packet: 4 files / 62 tests passed
- `npm run check`: passed
- `npm run build`: passed
- `git diff --check`: passed
- **PROVEN:** GA4 `403`, transient token-endpoint failure, server/storage failure, and post-refresh provider failure no longer become `requiresReauthorization`; Google `invalid_grant` still does
- **PROVEN:** `efaa6f60` deployed; the post-publish consent flow connected GA4, loaded the intended campaign metrics, and remained correct after refresh
- **REQUIRES EXTERNAL VALIDATION:** automatic token renewal and more-than-seven-day credential durability
- no schema, stored token, OAuth scope, connection ownership, API response shape, provider query, scheduler, analytics value, or persisted data changed

### GA4 reconnect campaign-picker selection count (`2026-07-29`)

- root cause: the picker counter and save path used the raw persisted filter length, while row checks used only campaign names returned for the newly selected property; a stale hidden name could therefore display as selected and be re-saved
- smallest fix: derive the counter, button label, and saved values from the intersection of the visible property campaign list and the selected filter; preserve manual selections when GA4 returns no list
- **PROVEN:** 3 focused selection tests and the 50-test adjacent GA4 UI/refresh packet passed locally
- **PROVEN:** `6d32514a` deployed; the user confirmed the intended campaign selection/count, correct metrics, and persistence after refresh
- no API, schema, provider query, persisted data, analytics calculation, campaign ownership, OAuth, scheduler, or unrelated source behavior changed

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

### Current Commit 3 — Fail closed on request errors and preserve valid zeros — complete

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

Current Commit 3 runtime behavior deployed as `7b162083`. The first UI check did not close validation because of the over-broad global banner. Banner follow-up `a0b205b5` deployed and the user-confirmed one-refresh validation passed with the incorrect banner gone. The bounded Current Commit 3 packet is closed; unobserved failure-injection and valid-zero production fixtures are not claimed.

### Current Commit 4 — Scope GA4 spend and remove stale cached fallback — complete

- added an optional storage context to spend source, single-source, total, and breakdown reads
- explicit GA4 reads include `platform_context='ga4'` plus legacy `NULL`; other contexts match exactly; omitted context preserves existing generic all-platform callers
- GA4 Overview queries, source deletion, scheduled report output, KPI/Benchmark jobs, cleanup helpers, notifications, outcome totals, campaign-current values, and GA4-backed Executive Summary aggregation now pass the GA4 context
- new/edited GA4 sources persist `ga4` explicitly; legacy null sources are accepted and self-heal only on an exact edit
- valid zero breakdown is authoritative; scoped spend-to-date is materialized-source-backed and no GA4 financial path substitutes `campaign.spend`
- generic scheduler and auto-refresh all-source reads remain unscoped by design
- focused contamination, legacy-null, zero/cache, delete, downstream, and scheduler-side-effect guards were added

Commit `7c54da65` deployed and the user-confirmed bounded UI validation passed on `2026-07-30`: Total Spend agreed with the Spend Sources list and remained correct after refresh. This closes B6 for the observed packet. It does not prove the foreign-context or active-source-with-zero-record production fixtures, close B7-B10 or B12, or make Overview production-ready.

### Current Commit 5 — Resolve visible on-hold source paths — complete for the bounded packet

Root cause: the GA4 add-source UI exposed Google Sheets Revenue, Google Sheets Spend, and optional no-date CSV Spend even though their readiness gates were still open; hiding a card alone was insufficient because the process APIs accepted direct creation requests.

Smallest safe decision implemented:

- new Google Sheets Revenue and Spend setup is hidden only for GA4; non-GA4 contexts are unchanged
- the server rejects new GA4 Google Sheets creation and new spend creation with omitted context before provider reads or source mutation
- new GA4 CSV Spend requires a Date column in both UI and API; a dated existing source cannot be converted to undated
- existing Google Sheets and already-undated CSV sources remain readable/editable/deletable by exact source ID; no persisted row, total, connection, scheduler, response shape, or calculation was changed
- retained-source inventory is closed under Current Commit 6; retained-source lifecycle certification remains open under Current Commit 7

Local validation: 4 focused files / 60 tests passed, plus the expanded seven-file run passed 149 relevant tests. Seven unrelated pre-existing Instagram source-safety slice assertions remained red. `npm run check` and `npm run build` passed. Commit `5da5f41c` deployed, and the user confirmed Google Sheets is absent from both new GA4 Revenue and Spend source choosers. No CSV upload was performed; the dated-only UI/API guard remains automated evidence, not a separately observed deployed CSV packet.

### Current Commit 6 — Reconcile retained legacy sources — complete

Root cause:

- GA4 was the only traced Salesforce Pipeline Proxy client that omitted platform context
- the server defaulted missing/invalid context to a cross-platform search and could select the newest non-matching source
- the existing inventory normalized null context to GA4 and did not separately expose retained/null-context sources for exact ownership review

Smallest safe fix:

- GA4 and its validation script pass `platformContext=ga4`
- Salesforce Pipeline Proxy requires an explicit supported context, searches only that context, rejects mapping-context mismatches, and fails closed when no exact campaign/source scope matches
- the existing campaign-access-guarded GET inventory now reports active retained/null-context sources with exact source identity and sanitized mapping evidence
- the inventory is read-only and returns `automaticCleanupAllowed: false`; no source, record, total, schema, scheduler, or response field was removed or mutated
- the follow-up owner-scoped batch GET reads only the signed-in owner's active GA4 campaigns and only records linked to retained source IDs, avoiding repeated campaign-by-campaign requests and the known high-volume orphan-record tables

Local validation: the original 5 focused files / 65 tests passed, the relevant Salesforce and Custom Integration assertions passed in the broader source-safety suite, `npm run check` passed, and the production build passed. The owner-scoped batch follow-up adds one focused guard; its 2-file packet passes 10 tests and TypeScript. Seven unrelated pre-existing Instagram route-slice assertions remain red.

Deployed bounded evidence for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` passed on `2026-07-30`. The read-only inventory returned zero retained Revenue sources and four active legacy-null Spend sources: three CSV sources totaling 2,000.00 and one Google Sheets source totaling 698.75. The generic damage summary returned zero orphan, inactive-source-record, duplicate-active-source, or unexpected-context findings. The user confirmed the Spend Sources modal showed the same four names and amounts and that they reconciled exactly to Total Spend 2,698.75.

The owner-scoped batch production result then returned `success: true`, `readonly: true`, `ownerScopedBatchComplete: true`, and `automaticCleanupAllowed: false`. It covered all 10 active GA4 campaigns owned by the signed-in user: seven had no retained sources, and three contained nine retained sources:

- `Summer splash`: legacy-null Google Ads Spend with 90 records totaling 14,045.83 and Manual Spend with one record totaling 400.00
- `myGA4`: two distinct Google Sheets Revenue sources, with different source IDs, mapping hashes, and connection IDs, totaling 15,200.00 and 30,300.00; plus one legacy-null Google Sheets Spend source with two records totaling 498.75
- `ga4_mock`: the four previously UI-reconciled Spend sources totaling 2,698.75

`retainedSourceInventoryPass: false` means retained sources exist; it does not by itself classify them as valid or damaged. The later user review confirmed the `Summer splash` Manual Spend source was unwanted. Git history shows Manual Spend was visible when this null-context row was created on `2026-03-15` and was hidden on `2026-04-23`; hiding the card did not remove the saved source. On `2026-07-30`, the user deleted only that exact `$400` source. Total Spend became `$14,045.83`, and the read-only post-delete inventory at `2026-07-30T12:35:24.839Z` confirmed the source absent, `Summer splash` retained only its 90-record Google Ads source totaling `$14,045.83`, and the owner-wide retained-source count fell from nine to eight. The other eight sources were unchanged and retain their prior unproven lifecycle status. This closes Current Commit 6's bounded inventory/cleanup packet without certifying those retained sources.

### Current Commit 7 — Complete source-family lifecycle evidence — complete for the bounded packet

Confirmed root cause for the first bounded fix: spend add/edit/delete already recomputes GA4 KPI and Benchmark values on the server, but the GA4 page invalidated only its Spend-card queries. Revenue mutations already invalidate KPI, Benchmark, Reports, and Notifications. Therefore mounted downstream spend consumers could remain stale until a reload even after the server held correct values.

Smallest safe local fix:

- add the four existing GA4 downstream cache invalidations to spend process success and single-source delete success
- preserve every calculation, API route/response, source write, campaign/platform guard, scheduler, and refetch interval
- add a regression guard covering both spend success paths
- repair two stale CSV downstream guards so they assert the current materialized-source and financial-formula code instead of removed formatting/marker text

The remaining root cause was separate metadata update, old-record deletion, and replacement insertion commits in retained Manual Revenue/Spend, Salesforce Revenue, Google Sheets Revenue/Spend, and LinkedIn/ad-platform Spend paths. A mid-write failure could remove last-good materialized values or leave source and connection metadata inconsistent.

Smallest safe completion:

- add campaign-, platform-, source-type-, and source-ID-scoped transactional replacement helpers in the existing storage layer
- use them only for GA4 ad-platform Spend, retained Google Sheets Revenue/Spend, and LinkedIn Spend; GA4 Manual Revenue/Spend are blocked instead of replaced
- include Salesforce connection mapping, source metadata, old-record deletion, and replacement records in one transaction
- fail closed when a LinkedIn refresh without a stable source ID finds multiple active GA4 LinkedIn Spend sources
- preserve response shapes, calculations, recompute order, source additivity, campaign access, and non-GA4 branches

Manual financial-source follow-up root cause and fix: the GA4 choosers hid new Manual Revenue and Manual Spend, but both shared process APIs still accepted authenticated GA4 manual create/edit requests and both retained-source modals still exposed Edit. The smallest safe fix rejects GA4 Manual Revenue and rejects only Spend requests whose explicit or legacy-omitted normalized context is `ga4` and effective source type is `manual`, before any source or record mutation. Both GA4 source modals suppress Edit only for Manual sources and preserve the existing exact campaign/context-scoped Delete actions. Google Ads and other legitimate spend imports that reuse the spend endpoint remain unchanged.

Empty-property follow-up root cause and fix: production read-only evidence confirmed `Summer splash` had one active OAuth placeholder whose `property_id` was empty. `/api/ga4/check-connection/:campaignId` treated any active row as connected, while the GA4 page required a selectable Property ID before leaving `ga4ContentInitializing`; those conditions made the six skeleton cards permanent. The smallest safe fix filters empty Property IDs before reporting a usable connection and independently filters them in the client. When saved financial sources exist without a usable GA4 property, the page renders only the Overview path, marks GA4 metrics/tables unavailable, hides new-source controls, and preserves the existing exact campaign-scoped source review/removal actions. Valid non-empty-property connections, source totals, calculations, delete scope, response fields, schedulers, and non-GA4 paths are unchanged. The code fix itself performed no reconnect, source edit, deletion, or other production-data mutation; the later user-authorized exact deletion is recorded below.

Local evidence for the empty-property follow-up: seven focused files pass 59 tests; TypeScript and the production build pass. Deployed UI validation on `2026-07-30` confirmed the empty-property state no longer rendered permanent skeletons, kept GA4 metrics unavailable, exposed the persisted Spend Sources cleanup path, showed the `$400` Manual source without Edit, and preserved exact Delete.

Local evidence: the earlier 12-file retained-source lifecycle packet passed 104 tests. The Manual financial-source follow-up focused packet passes 54 tests across six files; TypeScript and the production build also pass. The exact deployed deletion then reduced Total Spend to `$14,045.83`; the post-delete inventory confirmed the Manual source absent and all other retained sources unchanged. Current Commit 7 is closed for this bounded packet. Production failure injection remains unsafe and is not claimed.

### Current Commit 8 — Production freshness/provider evidence — deployed; remaining external evidence required

- deployed 30-day validation passed; representative live 90-day validation remains blocked by the absence of a suitable non-simulated fixture in the validated account
- prove token refresh, on-demand backfill, scheduled refresh, stale warning, reconnect, provider-empty, and delayed-processing behavior
- surface Overview freshness without implying provider completeness
- record exact campaign/property/window evidence without secrets

Local implementation evidence before the follow-up: the four-file focused GA4 freshness/auth/lifecycle/provider-validation packet passed 27 tests; the expanded seven-file scheduler/refresh packet passed 48 tests; `npm run check`, validation-runner syntax, `git diff --check`, and the production build passed. The follow-up adds direct pure-function coverage for successful coverage with older activity and retained provider-failure staleness, plus direct daily time-series tests for initial/post-refresh generic `403`, transient token failure, storage failure, and confirmed `invalid_grant`. Its two-file focused packet passes 23 tests; its expanded seven-file scheduler/refresh packet passes 55 tests; TypeScript, validation-runner syntax, `git diff --check`, and the production build pass. The validation runner now also records `providerCoverageThroughDate` and states that current coverage neither invents zero rows nor proves GA4 processing finality. Commits `950c5091` and `c26d2768` are deployed; the 30-day coverage/activity and UI-stability checks passed. Current Commit 8 remains open for a suitable live 90-day provider packet, timer-fired scheduled refresh, the remaining safe stale/provider-empty/on-demand evidence, and durable token evidence. No synthetic production failure injection is authorized.

### Current Commit 9 — Production inventory and bounded cleanup — deployed; scheduled-cycle proof pending

- complete: owner/campaign/source-scoped `BEGIN READ ONLY` inventory covering 10 campaigns, 73 revenue sources, and 93 spend sources
- complete: classification of orphan, inactive, mismatch, duplicate-candidate, no-record, unexpected-context, and cache-drift results
- complete and deployed: commit `57036ebc` removes the redundant LinkedIn/Meta pseudo-source scheduler writes that actively created the four orphan groups
- complete: immediate post-deploy `BEGIN READ ONLY` inventory matched the final pre-deploy 325,538-row boundary with no new group or row
- next: rerun the same read-only inventory after the first four-hour LinkedIn/Meta scheduler cycle
- not authorized or performed: deletion/update of existing orphan rows, inactive-source rows, sources, connections, or cached campaign spend
- later only with explicit authorization: exact cleanup dry run, reviewed apply, and post-apply inventory with counts/skips

Local evidence: the 3-test Current Commit 9 guard, 2 LinkedIn scheduler guards, and 2 targeted Meta persistence/disconnect guards pass. `npm run check`, `git diff --check`, and the production build pass. The wider pre-existing Meta/source-safety packets still contain unrelated stale assertion failures outside this change; they are not presented as passing evidence for Commit 9.

### Current Commit 10 — Complete downstream propagation and deployed UI evidence — closed for bounded code/browser parity packet

Root cause confirmed on `2026-07-30`:

- scheduled/manual Campaign DeepDive aggregates read GA4 financial revenue, conversions, imported revenue, and spend from a 90-day subset while Overview, KPI, Benchmark, alert, and outcome-current-value paths use the shared ordered campaign-to-date financial contract
- Trend snapshot SQL joined active financial sources but did not restrict their `platform_context`, allowing foreign-context rows into a GA4 aggregate on a multi-platform campaign
- Performance Summary treated revenue as available only when it was positive, so valid zero revenue with positive spend incorrectly produced unavailable ROAS/ROI instead of `0` and `-100%`
- the existing regression packet checked the shared selector in Overview/outcome/current-value paths but did not guard the scheduler consumer

Smallest safe implementation:

- export and reuse the existing `getCampaignMetricTotals(campaignId, true)` helper in the existing scheduler aggregate path; no endpoint, storage, schema, provider-query, or response shape was added
- retain the existing 90-day engagement and paid-platform windows, but read persisted GA4 financial sources campaign-to-date with explicit `platformContext="ga4"`
- add the same GA4 platform-context predicate to Trend financial source joins
- determine ROAS/ROI availability from source presence plus non-zero spend, preserving valid zero/negative revenue
- bump only the Performance Summary compatibility marker to `performance_summary_aggregate_v2`; current consumers already compare versions dynamically, so old incompatible snapshots are ignored rather than mixed

Local proof: `npm run check` and the production build passed. The final 12-file Commit 10 downstream packet passed 118/118 tests, including Performance Summary, scheduler parity, ordered GA4 financial selection, outcome totals, KPI, Benchmark, alerts, Custom Reports, report email, and Insights/report parity. A separate wider packet passed 136 assertions but retained three unrelated pre-existing stale assertions (one Campaign Financial Analysis source-string assertion and two notification-navigation assertions); an extended legacy packet also exposed stale scheduler/validation-runner assertions outside the touched paths. Those failures are not presented as Commit 10 failures or passing evidence. `git diff --check` passed for every Commit 10 code and documentation file. No production data was created, reconnected, edited, deleted, refreshed, or cleaned up.

Deployed proof and closure boundary:

- commit `ec265895` was pushed to `main` and deployed
- on existing campaign `GA4 single` / `ga4_mock`, the user confirmed Campaign DeepDive Performance Summary Total Spend equals GA4 Overview Total Spend
- on the same campaign, the user confirmed Budget & Financial Analysis → ROI & ROAS Total Revenue equals GA4 Overview Total Revenue
- Performance Summary currently has no Total Revenue card; no nonexistent control is claimed as validation, and adding that card would be a separate UI change
- Current Commit 10 is closed for its implementation, regression, build, deployment, and bounded browser-value comparison
- scheduled snapshot/attachment values, historical Trend behavior, live multi-source variants, valid-zero/negative production fixtures, and unobserved downstream surfaces remain external evidence gates; closure does not upgrade them to proven

### Current Commit 11 — Pipeline Proxy campaign-scope fail-closed — closed for bounded implementation/deployed fail-closed packet

- Root cause: the frontend uses `sorted[0]`, and the HubSpot Pipeline Proxy API uses `candidates[0]`, when no saved CRM source matches the configured GA4 campaign scope. Without an explicit no-match return, the HubSpot route can also continue with connection-level mapping data. A wrong API result can overwrite a correct same-scope client fallback.
- Fix: remove the frontend fallback and replace the HubSpot API fallback/connection continuation with an explicit `404` on no scoped match; preserve successful same-scope endpoint values, same-scope saved fallback, provider aggregation, campaign access, and confirmed-revenue exclusion. The already-correct Salesforce fail-closed selector remains unchanged.
- Completion: both HubSpot API selection and client saved-source selection fail closed on mismatched scope, while same-scope HubSpot and Salesforce behavior passes focused regression coverage.
- Local implementation: the client returns only `sorted.find(sourceMatchesGa4Scope) || null`; the HubSpot API returns `404` when no scoped saved source matches; the Salesforce selector is unchanged.
- Local evidence: the exact Commit 11 guard passed 1/1; HubSpot pagination and retained-source reconciliation passed 9/9; TypeScript and the production build passed; `git diff --check` passed. The full HubSpot file still has nine pre-existing obsolete runner-version assertions assigned to Commit 14, and an extended Google Ads packet exposed five unrelated stale platform assertions; neither failure set intersects this selector change.
- Deployed evidence: commit `9ac3fea9` was pushed to `main` and deployed. The user opened an existing GA4 Overview and confirmed Pipeline Proxy rendered `Unavailable` rather than a saved value from an unusable/non-matching scope. This passes the deployed fail-closed case; deployed same-scope positive-value behavior remains unproven for final Commit 18 reconciliation. No API shape, storage/schema, provider query, calculation, source record, connection, token, scheduler, or production data was changed.

### Current Commit 12 — Financial unavailable-versus-valid-zero contract — closed for bounded implementation/deployed configured-value packet

- Root cause: `financialRevenueAvailable` and `financialSpendAvailable` prove only that their requests resolved; they do not prove that a campaign-scoped source/capability exists. Total Revenue, Total Spend, ROAS, ROI, CPA, and browser Overview report preflight can therefore accept plausible zero/empty output when the financial input is actually unavailable, while Profit separately uses the stronger metric gates.
- Fix boundary: require the existing `revenueMetricAvailable` and `spendMetricAvailable` capability/source decisions in the corresponding financial availability flags. This reuses the established gates across financial cards and browser Overview report preflight without changing formulas, financial-source order, API contracts, storage/schema, provider queries, or persistence.
- Completion: missing revenue or spend is unavailable; valid source-backed zero remains numeric, including zero revenue with positive spend producing negative-spend Profit, `0.00x` ROAS, and `-100%` ROI; negative revenue remains numeric.
- Local implementation: `financialRevenueAvailable` now requires `revenueMetricAvailable`, and `financialSpendAvailable` now requires `spendMetricAvailable`. Existing render and browser-report preflight consumers inherit the same decision.
- Local evidence: the focused GA4 UI, financial-rule, and financial-source parity packet passed 46/46; TypeScript and the production build passed; `git diff --check` passed.
- Deployed evidence: commit `152a7dd3` was pushed to `main` and deployed. On existing campaign `GA4 single` / `ga4_mock`, the user confirmed Total Revenue and Total Spend still displayed their correct configured values. This closes the bounded implementation and configured-value regression packet; deployed missing-source and source-backed valid-zero/negative edge fixtures remain unproven and stay assigned to Commit 15. No formulas, source selection/order, API response, storage/schema, provider query, persistence, scheduler, connection, token, or production data changed.

### Current Commit 13 — Ordered financial-source validation parity — closed for bounded deployed validation-path packet

- Root cause: the browser validation runner's shared KPI/Benchmark/portability helper reduces provider, daily, and breakdown candidates to the largest revenue; its report helper duplicates the same maximum-revenue rule; and the Benchmark provider-validation route reduces provider and persisted-daily candidates by maximum GA4 revenue. These read-only evidence paths can therefore disagree with the live Overview's first-complete-candidate contract and produce false validation comparisons.
- Fix boundary: make the runner choose the first present candidate with finite revenue and conversions in provider → persisted daily → breakdown order, reuse that helper in report validation, and make the Benchmark comparison route use the already-imported shared ordered selector through shape-preserving wrappers. Do not change provider queries, visible Overview calculations, API response shapes, persistence, or production data.
- Completion: first complete candidate wins even when later revenue is larger; incomplete candidates fall through; valid zero/negative remains authoritative; provider queries and response shapes remain unchanged.
- Local implementation: runner version `2026-07-30.10` preserves missing revenue/conversion fields until candidate validation, chooses provider → persisted daily → breakdown by first complete candidate, and reuses that selector for report validation. The Benchmark comparison route passes shape-preserving provider/daily wrappers through `selectGA4FinancialTotalsSource`; its existing response payload remains unchanged.
- Local evidence: the focused financial-source parity, Benchmark provider-validation, and GA4 UI packet passed 44/44; runner syntax, TypeScript, production build, and `git diff --check` passed. Independent functional cases prove first-candidate zero/negative retention and incomplete-candidate fallthrough. The later Commit 14 baseline found eleven version-only failures across three legacy runner test files, including the nine in the HubSpot Overview file; those stale guards did not contradict the functional evidence.
- Deployed evidence: commit `d353383e` was pushed to `main`, Render served runner `2026-07-30.10`, and the authenticated read-only comparison on existing campaign `GA4 single` / `ga4_mock` returned `success: true`, `provider: live_provider_success`, provider revenue `$34,705.93`, persisted-daily revenue `$34,705.94`, and selected revenue `$34,705.93`. The lower provider value winning proves ordered provider-first selection rather than maximum revenue. This closes the bounded validation-path parity packet only; no visible Overview calculation, provider request shape, endpoint response shape, storage/schema, persistence, scheduler, connection, token, or production data changed.

### Current Commit 14 — Regression and documentation alignment — closed at pushed commit `f8b51e31`

- Root cause: eleven assertions across three legacy runner test files hard-coded `2026-07-12.6`; the readiness queue counted only the nine assertions in the HubSpot Overview file and omitted the CSV/deep-inventory copies. One GA4 spend guard still required the pre-Commit-10 unscoped aggregate scheduler call. Canonical documents also mixed historical pre-fix statements with current behavior and still described pending Commit 13 deployment, cross-context Salesforce fallback, late Overview-header freshness text, and highest-revenue selection.
- Fix boundary: update only the eleven exact runner-version guards and the one obsolete scheduler assertion; add explicit negative assertions forbidding the old HubSpot/Salesforce/frontend fallback and source-presence-only financial availability; preserve the existing Commit 13 ordered-selector guards. Align canonical Overview, validation, financial-source, and refresh documentation without changing application runtime code.
- Local evidence: the final focused/adjacent packet passed 9 files and 95 tests; `npm run check`, runner syntax, the production build, and scoped `git diff --check` passed. All eleven obsolete version assertions now match runner `2026-07-30.10`; the corrected aggregate-scheduler guard requires GA4 scope while preserving generic auto-refresh behavior; Commit 11–12 negative guards and Commit 13 ordered-selector guards pass together.
- Completion boundary: implementation and local validation are complete and commit `f8b51e31` was pushed to `main` on `2026-07-31`. Because no runtime file changed, no visual UI validation was required. Historical evidence remains distinguishable from current behavior.
- Side-effect boundary: no client/server runtime, API response, provider query, formula, storage/schema, persistence, scheduler implementation, connection, token, or production data is changed. Commit 14 itself requires no visual UI validation because it changes only tests and documentation.

### Current Commit 15 — Deployed UI and financial edge-state validation — bounded packet closed at pushed commit `e0f8baf2`

- Root cause: the visible GA4 Overview correctly requests `spend-to-date`, `spend-sources`, and `spend-breakdown` with `platformContext=ga4`, but the validation runner omitted that parameter in seven calls across its generic snapshot, KPI/Benchmark, report, and Google Sheets packs. A Commit 15 packet could therefore include explicit foreign-platform spend and falsely claim GA4 card/source/report parity.
- Safest fix: runner `2026-07-31.11` adds `platformContext=ga4` only to those seven spend reads. The existing regression guard now requires scoped runner reads and forbids the prior unscoped forms.
- Local evidence: the new guard failed against runner `2026-07-30.10` with 1/6 failures and passed 6/6 after the correction. The final focused/adjacent packet passed 11 files and 117 tests; TypeScript, runner syntax, the production build, and scoped `git diff --check` passed.
- Deployed scope evidence: commit `03930b1c` served runner `2026-07-31.11`. The authenticated `GA4 single` / `ga4_mock` pack reached all 14 endpoints and required no reauthorization, proving the corrected runner asset and scoped endpoint family were live. It reported `spendToDate: 0` versus `spendBreakdownTotal: 2698.75`; therefore its `overallPass: true` is not accepted as financial parity evidence.
- Follow-up root cause: the spend-to-date API returns `spendToDate`, but `buildTotals` searched only `totalSpend`, `spend`, `total`, and `amount`. The shared numeric parser also converted `null` to numeric zero, and `overviewPack` checked endpoint status without requiring financial total presence/parity.
- Follow-up safest fix: runner `2026-07-31.12` recognizes `spendToDate`, makes the shared numeric parser preserve absent values as `null`, and requires all four imported financial totals plus revenue/spend to-date-to-breakdown parity before `overallPass`. Valid numeric zero remains authoritative.
- Follow-up local evidence: the new guard failed 1/7 against runner `2026-07-31.11` and passed 7/7 after the correction. A functional runner-parser test proves `spendToDate: 2698.75` is retained, missing remains `null`, and valid zero remains numeric. The final focused/adjacent packet passed 11 files and 119 tests; TypeScript, runner syntax, the production build, and scoped `git diff --check` passed.
- Deployed parity evidence: follow-up commit `e0f8baf2` served runner `2026-07-31.12`. The authenticated packet on `GA4 single` / `ga4_mock` at `2026-07-31T12:45:47.407Z` passed all 14 endpoints with no reauthorization request, Revenue `16700 = 16700`, Spend `2698.75 = 2698.75`, and `overallPass: true`.
- Completion boundary: the bounded parser/parity implementation and deployed packet are closed. Wrong/same-scope Pipeline Proxy, missing revenue, valid zero/negative production values, browser report value parity, provider/query failure, zero-record source, and foreign-context fixtures were not available in this packet and remain explicitly unproven for final Commit 18 reconciliation.
- Side-effect boundary: no visible Overview calculation, API handler/response, storage/schema, provider query, scheduler, connection contract, token logic, or production data was changed by the Commit 15 code. The runner's authenticated GET calls retain the existing bounded provider/token/daily persistence documented in `GA4/OVERVIEW_VALIDATION_RUNNER.md`; it is not a database-read-only inventory.
- Use safe existing fixtures only. Do not create, reconnect, edit, delete, or rewrite production data to manufacture evidence. Unavailable fixtures remain explicitly unproven.

### Current Commit 16 — Live window and OAuth durability evidence — bounded 30-day saved-window fix closed

- Root cause: `lookbackDays` was correctly persisted when a GA4 property was selected, and the Overview client already knew how to use it, but both authenticated connection responses omitted that field. The client therefore defaulted affected 30/60-day connections to 90 days. The validation runner independently defaulted to 30 days and did not compare its requested window with the saved connection, so a pass could cover a different window from the UI.
- Safest fix: both existing campaign-access-guarded connection responses add sanitized `lookbackDays`; the status response used by Commit 16 also adds `method`, `hasRefreshCredential`, and `tokenExpiresAt`. Raw access tokens, refresh tokens, and client secrets remain excluded, and all pre-existing response fields remain unchanged. The existing Overview selector now receives the saved window without client restructuring. Runner `2026-07-31.13` derives all Overview requests from that saved 30/60/90-day value and fails closed on an absent or mismatched configured window.
- OAuth evidence boundary: `commit16Pack(...)` compares token expiry before and after three existing live-provider GET reads and reports `tokenExpiryAdvancedDuringPack` only when persisted expiry actually advances. It never infers post-publish seven-day durability from `connectedAt`, because a legacy connection record can predate a later reconnect. That durability remains `requires_external_validation`.
- Mutation boundary: the code fix changes no saved campaign/source/property/window/token or analytics record. `commit16Pack(...)` does not call `/ga4-daily`, so it cannot backfill daily rows; a provider GET may perform the application's existing automatic access-token renewal and persist only the renewed encrypted token/expiry when required. It does not create, reconnect, edit, delete, or rescope production data.
- Local evidence: the final focused/adjacent packet passed 11 files / 219 tests, including connection scope, configured-window, raw-secret exclusion, no-daily-write, reconnect classification, automatic refresh, live-property, cross-tab, financial parity, and runner-version coverage. Runner syntax, TypeScript, the production build, and scoped `git diff --check` passed.
- Deployed evidence: commit `747192ff` was pushed and deployed. The authenticated connection response for existing campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127` returned `lookbackDays: 30`. This closes the bounded saved-window response/UI-source correction and confirms the changed metrics are expected 30-day values rather than the previous erroneous 90-day fallback.
- Evidence boundary: no live 60/90-day fixture was available or manufactured; provider-value parity was not independently compared in this check. No token-expiry advancement was observed, and survival beyond the former seven-day Testing-token window remains `requires_external_validation`.
- Completion: the bounded saved-window implementation is closed. OAuth automatic-renewal observation and seven-day durability remain external gates, not inferred completion evidence.

### Current Commit 17 — Retained-source lifecycle and production-data disposition — bounded forward implementation closed; external evidence/disposition open

- Prove exact add/import, edit/replace, delete/deactivate, refresh/reprocess, source-modal, totals, and recompute behavior for every retained source that can contribute, or obtain a separately reviewed scoped disposition.
- Record an explicit decision for existing orphan/inactive rows and cached-spend drift. No cleanup is authorized by this queue.
- Root cause confirmed before implementation: foreground GA4 Google Sheets Revenue/Spend and ad-platform Spend replacements use the existing transactional storage helpers, and Revenue deletion is transactional, but three retained-source lifecycle paths still split one logical replacement/deletion across independent writes. `reprocessGoogleSheetsRevenue(...)` deletes old revenue records, inserts replacements, then updates source freshness separately; the Google Ads/Meta scheduler deletes old spend records before inserting replacements; and the individual Spend delete route deactivates the source before deleting its records. A failure between those operations can erase last-good records or leave source/record state inconsistent.
- Smallest safe implementation boundary: reuse the existing campaign/source/type/context-scoped transaction helpers for the two scheduler replacements; add the Spend equivalent of `deleteRevenueSourceWithRecords(...)` and use it only in the existing individual Spend delete route. Preserve source identity, provider queries, selected campaign IDs, mapping configuration, calculations, recompute order, response shapes, scheduler cadence, and non-GA4 context behavior.
- Local implementation: `reprocessGoogleSheetsRevenue(...)` now commits source freshness and exact replacement records through `replaceRevenueSourceWithRecords(...)`; Google Ads/Meta scheduler records use `replaceSpendRecordsForSource(...)`; and the existing individual Spend delete route uses `deleteSpendSourceWithRecords(...)`. The new Spend helpers recheck active source ID, campaign, source type where applicable, and platform context inside the transaction; GA4 continues to include its documented legacy-null context boundary. No public API response or metric formula changed.
- Local evidence: focused transaction tests prove exact same-campaign deletion, rollback on forced Spend record-delete failure, exact scheduler replacement without source-metadata changes, and rollback retaining last-good Spend records on forced insert failure. Lifecycle guards require atomic Google Sheets Revenue and ad-platform Spend scheduler writes and reject the prior split writes. The adjacent 6-file packet passed 46/46; the broader 10-file lifecycle/source-family packet passed 71/71; TypeScript passed.
- Production-data disposition for this implementation: do not delete, deactivate, reconnect, edit, migrate, or clean any production source or record. Existing orphan rows remain excluded and retained pending separate authorization; inactive-source records remain excluded; cached `campaign.spend` drift remains ignored by GA4 Overview and is not rewritten. The eight-source owner inventory remains the exact review boundary.
- Deployed evidence: commit `36676deb` deployed, and the user confirmed the existing GA4 campaign's Total Revenue, Total Spend, and Revenue/Spend source lists remained unchanged. This closes the bounded forward implementation/no-visible-regression packet. It does not inject a database failure, prove a timer-fired provider replacement, or disposition the eight retained sources.
- Remaining boundary: the bounded forward implementation is closed, but provider-cycle rollback evidence and retained-source disposition remain open. The eight retained sources are not silently certified or cleaned; any cleanup follows read-only dry run, exact owner/campaign/source boundary, explicit authorization, reviewed apply, and post-apply inventory.

### Current Commit 18 — Remaining non-scheduler downstream parity and final certification — bounded fail-closed implementation complete locally; deployment/evidence open

- Rerun repaired KPI/Benchmark/provider-validation comparisons and prove browser report, historical Trend, and live multi-source downstream combinations use the same scoped Overview values.
- Reconcile every non-scheduler acceptance result with the code and canonical documents.
- Root cause confirmed before implementation: `campaign-current-values.ts` converts failed financial reads and missing selected source IDs to zero, so KPI/Benchmark/alert refresh can overwrite a last-known value with a misleading `0`. Separately, `/outcome-totals` catches GA4/provider and imported-revenue failures, while `buildPerformanceSummaryAggregate(...)` treats connection/presence as availability; Campaign DeepDive, browser Custom Report, Executive Summary, Platform Comparison, and compatible Trend consumers can therefore receive partial or false-zero values marked available. The Commit 18 baseline also exposed one stale guard that omits the already-supported Custom Integration spend term.
- Smallest safe implementation boundary: add backward-compatible availability flags to the existing aggregate input, propagate unavailable selected source reads as `null` so existing KPI/Benchmark update loops skip them, and require successful GA4/last-good plus imported-revenue reads before the combined downstream revenue metric is available. Preserve successful values, valid zero, source ordering, formulas, response fields, query shapes, campaign/platform scope, Trend compatibility version, and all scheduler cadence/data writes.
- Production boundary: no provider call, reconnect, source edit/delete, cleanup, snapshot write, or other production mutation is authorized or performed by this implementation.
- Local implementation: `/outcome-totals` now carries explicit GA4 and imported-revenue availability into the existing aggregate; the shared Performance Summary aggregate keeps connected sources visible but excludes unavailable metrics; and campaign KPI/Benchmark current-value calculation returns `null` for failed reads, disconnected/missing GA4, or a missing selected source ID. Existing refresh loops already skip `null`, preserving the last-known value. Successful source-backed zero, source order, formulas, query shapes, public response fields, campaign scope, and persistence behavior are unchanged.
- Local evidence: the final focused/downstream packet passed 12 files / 104 tests. The relevant alert and source-lifecycle packet passed `campaign-alert-current-value-regression`, `ga4-kpi-duplicate-alert-regression`, `alert-email-regression`, and `ga4-source-lifecycle-recompute-regression`; three unrelated stale scheduler/navigation string guards remain outside this diff. TypeScript and the production build passed.
- Current evidence classification: local bounded implementation is **proven**; deployment and rendered/API parity are **unproven**; browser Custom Report/Executive Summary, historical Trend, live multi-source, and unavailable production fixtures **require external validation**. Commit 18 remains open, and GA4 Overview remains not clean-certified.
- Rejected deployed follow-up: commit `4141614e` switched Summary to live Campaign Breakdown aggregate totals. After deployment, the user observed that Overview values changed and did not match the intended scheduler-backed values. That deployed validation failed, so the aggregate-Summary conclusion and any associated readiness claim are withdrawn.
- Corrective root cause: browser and scheduled Summary were pointed at the wrong source. Separately, the daily provider query requested conversion/revenue supplementation only when the entire window had no outcome values, so an individual traffic day missing those fields remained incomplete when another day already had outcomes.
- Corrective smallest safe boundary: use only the successful scheduler-compatible daily response for Summary; keep Campaign Breakdown independent; query the compatible campaign-name supplement only when at least one traffic day is missing conversion or revenue; and fill only the missing fields for the exact date. Preserve populated daily fields, property/filter/window scope, financial ordering, API shapes, scheduler cadence, source records, and production data.
- Corrective local evidence: the regression-first packet failed at the browser source, scheduled source, tooltip, and partial-day supplementation boundaries before runtime changes. The final scheduler/Overview/financial/report/downstream packet passed 9 files / 117 tests. TypeScript and the production build passed.
- Corrective status: the bounded implementation is **proven locally** and **unproven in deployment**. It requires deployment followed by one existing-campaign scheduler run and confirmation that Overview Summary equals the returned completed-day daily totals. No production reconnect, rescope, source edit/delete, or cleanup is required.
- Completion: no applicable non-scheduler blocker remains unproven; only then may the bounded non-scheduler Overview receive a clean-certification decision.
- Certification statement after every Commit 11–18 requirement passes at the same deployed commit and production-data state: **GA4 Overview is clean-certified and production-ready for the documented non-scheduler Overview scope.** Explicitly excluded scheduler paths remain unproven and must stay named in every status.

Explicit exclusions from Commits 11–18: timer/startup refresh proof; scheduled email/PDF/snapshot validation; post-scheduler-cycle inventory; unauthorized production mutation; unrelated tabs/platforms and architectural refactoring. Excluded work remains unproven and is not silently certified.
Estimated remaining work: Current Commit 8 external provider/scheduler evidence, Current Commit 9 post-cycle inventory/authorized cleanup decision, and the explicitly deferred downstream evidence gates. The count will increase if Google Sheets is re-enabled rather than retained as continuity-only, or if broader production cleanup separates into multiple independently reviewed batches.

## UI Validation Requirement

Current Commit 1 does **not** require a separate UI validation pass. Commit `56bfdced` changed only static regression tests and this readiness document; it did not change the client bundle, server runtime, API behavior, calculations, persistence, schedulers, or rendered UI. Its proportionate validation is the green source-family packets, the 15-file focused packet, TypeScript, and staged/committed file-boundary review recorded above. A Render deployment of this commit has no new user-visible behavior to validate.

This narrow decision does not waive UI validation for later runtime commits or final Overview certification.

Current Commit 2's required bounded UI smoke validation passed after `5cff21ad` deployed. The evidence is limited to the configured campaign/window and downloaded report checked by the user; it does not substitute for the broader provider/freshness/source/downstream validation below.

Current Commit 3's first deployed UI check exposed the over-broad global banner and therefore did not pass closeout. Banner follow-up `a0b205b5` deployed, and the user-confirmed one-refresh validation passed with the incorrect banner gone. This closes only the bounded Current Commit 3 packet; it does not prove unobserved failure-injection or valid-zero production fixtures and does not certify the complete Overview while later blockers remain.

Current Commit 4's bounded deployed UI check passed on `2026-07-30`: Total Spend and the Sources list agreed and remained correct after one refresh. A campaign containing an explicit non-GA4 spend source or an active GA4 source with no records is still required before claiming the contamination and zero-record production cases; do not invent those fixtures or infer them from the ordinary validated campaign.

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
