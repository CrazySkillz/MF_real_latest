# GA4 Overview Production Readiness History

## Purpose

This ledger preserves the chronological Current Commit 0-18 queue and its UI-validation record moved from the canonical readiness index on `2026-08-01`.

Use [`OVERVIEW_PRODUCTION_READINESS.md`](./OVERVIEW_PRODUCTION_READINESS.md) for the current certification decision and active Commit 19 gate. Use [`OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md`](./OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md) for detailed inventories, traces, blockers, and validation evidence.

The moved content below is preserved verbatim so chronology and bounded completion claims remain auditable.

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

### Current Commit 18 — Remaining non-scheduler downstream parity and final certification — deployed 30-day metric correction closed; downstream/edge evidence open

- Rerun repaired KPI/Benchmark/provider-validation comparisons and prove browser report, historical Trend, and live multi-source downstream combinations use the same scoped Overview values.
- Reconcile every non-scheduler acceptance result with the code and canonical documents.
- Root cause confirmed before implementation: `campaign-current-values.ts` converts failed financial reads and missing selected source IDs to zero, so KPI/Benchmark/alert refresh can overwrite a last-known value with a misleading `0`. Separately, `/outcome-totals` catches GA4/provider and imported-revenue failures, while `buildPerformanceSummaryAggregate(...)` treats connection/presence as availability; Campaign DeepDive, browser Custom Report, Executive Summary, Platform Comparison, and compatible Trend consumers can therefore receive partial or false-zero values marked available. The Commit 18 baseline also exposed one stale guard that omits the already-supported Custom Integration spend term.
- Smallest safe implementation boundary: add backward-compatible availability flags to the existing aggregate input, propagate unavailable selected source reads as `null` so existing KPI/Benchmark update loops skip them, and require successful GA4/last-good plus imported-revenue reads before the combined downstream revenue metric is available. Preserve successful values, valid zero, source ordering, formulas, response fields, query shapes, campaign/platform scope, Trend compatibility version, and all scheduler cadence/data writes.
- Production boundary: no provider call, reconnect, source edit/delete, cleanup, snapshot write, or other production mutation is authorized or performed by this implementation.
- Local implementation: `/outcome-totals` now carries explicit GA4 and imported-revenue availability into the existing aggregate; the shared Performance Summary aggregate keeps connected sources visible but excludes unavailable metrics; and campaign KPI/Benchmark current-value calculation returns `null` for failed reads, disconnected/missing GA4, or a missing selected source ID. Existing refresh loops already skip `null`, preserving the last-known value. Successful source-backed zero, source order, formulas, query shapes, public response fields, campaign scope, and persistence behavior are unchanged.
- Local evidence: the final focused/downstream packet passed 12 files / 104 tests. The relevant alert and source-lifecycle packet passed `campaign-alert-current-value-regression`, `ga4-kpi-duplicate-alert-regression`, `alert-email-regression`, and `ga4-source-lifecycle-recompute-regression`; three unrelated stale scheduler/navigation string guards remain outside this diff. TypeScript and the production build passed.
- Current evidence classification: implementation/deployment and the existing 30-day Summary-to-daily parity packet are **proven**; browser Custom Report/Executive Summary, historical Trend, live multi-source, and unavailable/last-good production fixtures **require external validation**. Commit 18 remains open, and GA4 Overview remains not clean-certified.
- Rejected deployed follow-up: commit `4141614e` switched Summary to live Campaign Breakdown aggregate totals. After deployment, the user observed that Overview values changed and did not match the intended scheduler-backed values. That deployed validation failed, so the aggregate-Summary conclusion and any associated readiness claim are withdrawn.
- Corrective root cause: browser and scheduled Summary were pointed at the wrong source. Separately, the daily provider query requested conversion/revenue supplementation only when the entire window had no outcome values, so an individual traffic day missing those fields remained incomplete when another day already had outcomes.
- Corrective smallest safe boundary: use only the successful scheduler-compatible daily response for Summary; keep Campaign Breakdown independent; query the compatible campaign-name supplement only when at least one traffic day is missing conversion or revenue; and fill only the missing fields for the exact date. Preserve populated daily fields, property/filter/window scope, financial ordering, API shapes, scheduler cadence, source records, and production data.
- Corrective local evidence: the regression-first packet failed at the browser source, scheduled source, tooltip, and partial-day supplementation boundaries before runtime changes. The final scheduler/Overview/financial/report/downstream packet passed 9 files / 117 tests. TypeScript and the production build passed.
- Corrective deployed evidence: commit `e857c15d` deployed. On `2026-08-01`, the existing `GA4 single` / `ga4_mock` rendered Summary showed 866 Sessions, 867 daily-summed Users, 110 Conversions, 68.4% Engagement Rate, and 12.7% Conversion Rate. A same-session authenticated request to `/api/campaigns/8aa735ee-c02f-41e2-bb1f-7c3f43bb9458/ga4-daily?days=30&propertyId=542352127` returned the identical totals and `refreshIsStale: false`. The bounded metric-correction follow-up is **proven and closed**. This evidence validates deployed UI-to-scheduler-backed daily parity for that existing 30-day scope; it does not independently reproduce the platform's `sessionCampaignName`/`pageLocation` fallback and conversion supplementation inside one GA4 report UI, prove delayed-event processing finality, or prove a timer-fired scheduler cycle.
- Completion: no applicable non-scheduler blocker remains unproven; only then may the bounded non-scheduler Overview receive a clean-certification decision.
- Certification statement after every Commit 11–18 requirement passes at the same deployed commit and production-data state: **GA4 Overview is clean-certified and production-ready for the documented non-scheduler Overview scope.** Explicitly excluded scheduler paths remain unproven and must stay named in every status.

Explicit exclusions from Commits 11–18: timer/startup refresh proof; scheduled email/PDF/snapshot validation; post-scheduler-cycle inventory; unauthorized production mutation; unrelated tabs/platforms and architectural refactoring. Excluded work remains unproven and is not silently certified.
Estimated remaining work: Current Commit 8 external provider/scheduler evidence, Current Commit 9 post-cycle inventory/authorized cleanup decision, and the explicitly deferred downstream evidence gates. The count will increase if Google Sheets is re-enabled rather than retained as continuity-only, or if broader production cleanup separates into multiple independently reviewed batches.

### Current Commit 19 — Enforce the 30-day-only production scope — committed and pushed; deployment validation pending

- Root cause: the two GA4 property setup surfaces still defaulted to 90 days and exposed 30/60/90, while both persistence APIs accepted all three values and silently coerced missing/invalid input to 90. Connection-read responses therefore also treated retained non-30 rows as usable, which could not support a truthful 30-day-only release boundary.
- Smallest safe implementation: expose and submit only 30 days in the existing setup flows; explicitly reject missing/60/90 persistence requests after campaign access but before provider/storage/in-memory mutation; expose only 30-day configured connections to Overview consumers; return an explicit unsupported state for retained non-30 rows; and add a client-side 30-day usability guard.
- Production-data boundary: no production connection, campaign, source, record, metric, token, property selection, or saved lookback was edited, migrated, reconnected, deleted, or rewritten. Existing non-30 rows remain retained and outside the release scope.
- Local evidence: the regression-first guard failed 3/3 before implementation and passed 3/3 afterward. The final focused/adjacent packet passed 3 files / 49 tests; TypeScript and the production build passed.
- Commit/push evidence: `ba2e4329` was pushed to `origin/main` for Render auto-deployment.
- Remaining evidence: deployment, one existing 30-day UI/value check, and one direct unsupported persistence request proving rejection before mutation. Current Commit 19 is not closed and does not certify Overview.

## UI Validation Requirement

Current Commit 1 does **not** require a separate UI validation pass. Commit `56bfdced` changed only static regression tests and this readiness document; it did not change the client bundle, server runtime, API behavior, calculations, persistence, schedulers, or rendered UI. Its proportionate validation is the green source-family packets, the 15-file focused packet, TypeScript, and staged/committed file-boundary review recorded above. A Render deployment of this commit has no new user-visible behavior to validate.

This narrow decision does not waive UI validation for later runtime commits or final Overview certification.

Current Commit 2's required bounded UI smoke validation passed after `5cff21ad` deployed. The evidence is limited to the configured campaign/window and downloaded report checked by the user; it does not substitute for the broader provider/freshness/source/downstream validation below.

Current Commit 3's first deployed UI check exposed the over-broad global banner and therefore did not pass closeout. Banner follow-up `a0b205b5` deployed, and the user-confirmed one-refresh validation passed with the incorrect banner gone. This closes only the bounded Current Commit 3 packet; it does not prove unobserved failure-injection or valid-zero production fixtures and does not certify the complete Overview while later blockers remain.

Current Commit 4's bounded deployed UI check passed on `2026-07-30`: Total Spend and the Sources list agreed and remained correct after one refresh. A campaign containing an explicit non-GA4 spend source or an active GA4 source with no records is still required before claiming the contamination and zero-record production cases; do not invent those fixtures or infer them from the ordinary validated campaign.

After the forward fixes and automated tests pass, UI validation must cover:

- the supported 30-day connection window and visible labels; future 60/90-day options remain excluded until a later release
- valid zero and negative financial outcomes
- provider/query failures without false zeros or false empty tables
- stale daily data and reconnect behavior
- each enabled source add/edit/delete/refresh path
- legacy-source migration/deactivation effects
- source modal counts, labels, freshness, and totals
- browser report values
- scheduled/server report attachment values and delivery state
- all included downstream surfaces for the same controlled campaign/source mix

<!-- END MOVED HISTORY CONTENT -->
