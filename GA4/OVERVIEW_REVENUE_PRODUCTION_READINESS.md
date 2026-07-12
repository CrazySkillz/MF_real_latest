# GA4 Overview Revenue Production Readiness

## Mandatory Anti-Overclaim Rule

Apply `AGENTS.md`, `ARCHITECTURE_USER_JOURNEY.md`, `PRODUCTION_READINESS.md`, `GA4/README.md`, `GA4_DEVELOPMENT_WORKFLOW.md`, `GA4/OVERVIEW.md`, `GA4/OVERVIEW_PRODUCTION_READINESS.md`, `GA4/FINANCIAL_SOURCES.md`, and `GA4/REFRESH_AND_PROCESSING.md` before using this file as readiness evidence.

A previous production-ready statement is not evidence. A passing test suite is not evidence for a path the tests do not cover. Historical packets retain their exact campaign, property, source, mapping, date, value, and validation boundaries. Do not generalize them to another file, mapping, campaign, scheduler run, provider condition, downstream consumer, or negative case.

This file accepts only evidence independently traced for Google Sheets Revenue or Upload CSV Revenue. Spend, Shopify, HubSpot, Salesforce, GA4-native revenue, Meta, LinkedIn, Google Ads, Manual revenue, KPI, Benchmark, Reports, and every other source family are not substitute proof. A downstream consumer is evidence only when the value path from the named Google Sheets or CSV revenue source is explicitly traced to that consumer.

Current Commit 12 completed the final CSV-only rerun and documentation audit. After that commit, the user confirmed the deployed invalid-file test also passed: the upload showed an error, created no source, and left Total Revenue and Total Spend unchanged. Upload CSV Revenue is clean-certified for the validated documented scope. Google Sheets Revenue remains on hold and is not clean-certified.

## Purpose

This is the component readiness file for GA4 Overview imported revenue from:

- Google Sheets Revenue
- Upload CSV Revenue

It separates these two source families from whole-Overview and spend certification. It records the current implementation, historical bounded evidence, known destructive boundaries, missing negative cases, and the work required before either source can receive a clean-certification claim.

## Current Status

- **Google Sheets Revenue is not clean-certified.** Current Commit 4 locally closes the tested GA4 deterministic mapping/date/row validation boundary for foreground and scheduler reprocessing. Add/edit and scheduler replacement remain non-transactional, automatic updates rely on the daily external refresh path rather than bounded source-family polling, open Overview revenue queries refetch only every ten minutes, and deployed provider/failure/idempotency evidence is incomplete.
- **Upload CSV Revenue is clean-certified for the validated documented scope.** Current Commit 2 locally closes deterministic validation; Current Commit 3 makes GA4 CSV add/edit replacement transactional; Current Commit 7 makes exact-source deletion transactional; Current Commit 8 covers CSV downstream propagation; Current Commit 9 supplies read-only target inventory; Current Commit 10 supplies deployed normal add/repeated-edit/delete evidence plus the later user-confirmed invalid-file no-mutation result; and Current Commit 12 retraced the full path and reran the bounded evidence.
- **Current Commit 12 CSV certification decision: passed after the final deployed invalid-file confirmation.** The bounded eight-file final packet passed 44/44, runner syntax and `npm run check` passed, and the refreshed target inventory found no active/reconciliation damage. One broader nine-file run passed 50/51; its only failure was an unrelated stale Campaign Financial Analysis static expectation that omits the current Custom Integration spend term. No CSV test failed. Console-runner output, raw source IDs, and exact deployed Profit/ROAS/ROI/CPA values were not supplied; they are excluded from this bounded claim rather than represented as evidence.
- **All further Google Sheets Revenue coverage is on hold.** Do not start new Google Sheets Revenue transaction, polling, provider/OAuth, scheduler, inventory, downstream propagation, or deployed-validation work until the user explicitly resumes it. Existing bounded evidence remains recorded but is not extended by Current Commit 8.
- Current Commit 7 has user-confirmed deployed UI validation for the normal exact-source deletion flow. No exact campaign, source ID/type, before/after amount, or injected-failure output was supplied for this documentation packet, so deployed rollback remains unproven.
- Current Commit 1 was documentation only. Current Commits 2 through 4, 7, and the CSV-only portions of 8 and 9 are bounded source fixes/evidence and do not certify either source.

## Explicit Scope

### Included

- GA4 Overview imported revenue contributed by active `ga4`-context Google Sheets and CSV revenue sources.
- `Total Revenue` only to the extent it consumes those imported values.
- Revenue Sources modal/list and revenue breakdown provenance for those sources.
- Add/import, edit/update, refresh/reprocess applicability, delete/deactivate, source display, totals/recomputation, validation failure, rollback, and damaged-data risk.
- Profit, ROAS, and ROI only as downstream formulas consuming the traced imported-revenue contribution. CPA is inventoried because it appears beside the financial cards, but imported revenue does not supply its conversion input.
- Current local route, storage, scheduler, frontend-query, and focused-test evidence.
- Historical deployed packets only within the exact boundaries restated below.

### Excluded

- Google Sheets Spend and CSV Spend. Their implementation, tests, and deployed packets are not Revenue proof.
- Shopify, HubSpot, Salesforce, GA4-native revenue, Meta, LinkedIn, Google Ads, Manual revenue, Custom Integration, and every other source family.
- KPI, Benchmark, Insights, Ad Comparison, notifications, Reports, report snapshots/PDFs, scheduled/test email, and inbox delivery unless a new source-specific packet traces Google Sheets or CSV Revenue into the exact consumer.
- Provider behavior, OAuth durability, production database health, and deployed timing outside an explicitly recorded packet.
- Any claim that the broader Overview or another source is production-ready.

## Revenue-Specific Root-Cause And Evidence-Gap Analysis

The current gaps are implementation and evidence gaps, not merely missing wording:

- Google Sheets Revenue is included in `runDailyAutoRefreshOnce`, but the bounded `GOOGLE_SHEETS_SPEND_REFRESH_INTERVAL_MINUTES` timer calls only the spend source-family runner. Revenue therefore has daily external refresh participation but no bounded low-latency Revenue-only provider poll.
- Open GA4 Overview queries for `/revenue-to-date`, `/revenue-sources`, and `/revenue-breakdown` each use a ten-minute refetch interval. Mutation success handlers refetch immediately, but an external sheet edit processed outside the browser does not meet the intended low-latency contract.
- Before Current Commit 3, CSV edit updated source metadata and deleted old records before inserting replacements, while add created its source separately. Current Commit 3 moves validated GA4 CSV add/edit source and record replacement into one scoped database transaction; non-GA4 CSV behavior is unchanged.
- Google Sheets add/edit performs source create/update, old-record deletion, and new-record insertion as separate operations. The scheduler helper independently deletes old records before inserting refreshed records. Neither path is transactional.
- In Google Sheets Revenue and other still-non-transactional paths, a failure after old-record deletion can remove the last valid stored source value. GA4 CSV now has local rollback evidence, but deployed PostgreSQL rollback remains unproven.
- Before Current Commit 2, CSV Date choices included Revenue, Campaign, and non-date columns, and the server did not reject those role collisions. Current Commit 2 filters only the GA4 CSV Date chooser, clears stale invalid Date selections, and repeats authoritative collision validation on the server before mutation.
- Before Current Commit 2, CSV positive-revenue rows with blank, invalid, or numeric mapped dates could be counted but omitted from persisted daily records. CSV now rejects the whole request before mutation.
- Before Current Commit 4, Google Sheets exposed every header as a Date choice and its foreground and scheduler paths could count positive rows whose blank, invalid, or numeric mapped dates were omitted from daily persistence. Current Commit 4 filters only the GA4 Date chooser and rejects role collisions, empty/no-positive selections, and any undated selected positive revenue before source/record mutation in both paths.
- Before Current Commit 7, the current UI's shared individual revenue-source delete verified campaign ownership and optional platform context, but source deactivation and record deletion were separate writes. Current Commit 7 repeats the active source/campaign/context boundary inside one transaction and deletes only records matching that source and campaign. The legacy bulk-delete route has no current frontend caller and remains outside this exact-source fix.
- Before Current Commit 9, the existing read-only Overview source-damage endpoint reported generic orphan, inactive-source-record, duplicate-source, and context findings, but it omitted retained CSV rows from mapping analysis and could not prove CSV stored-row completeness, expected-versus-materialized totals, dated-row loss, or duplicate materialized row grains. Current Commit 9 adds only that CSV-specific assessment to the existing campaign-access-guarded GET route; it adds no cleanup or mutation path.
- Existing tests are useful local/static guards, but they do not prove rollback, provider-failure retention, automatic timing, repeated-refresh idempotency, or complete source-specific downstream propagation.
- Historical deployed lifecycle packets prove only the exact interactions recorded. They do not satisfy the new automatic-update, transactional retention, deterministic mapping/date validation, or complete negative-case requirements.

## Complete Value Inventory

| Value or state | Source of truth / transformation | Visible or downstream use | Current boundary |
| --- | --- | --- | --- |
| Revenue source identity | `revenue_sources.id`, campaign ID, `sourceType`, `platformContext`, active state | Source edit/delete, scheduler stable identity, provenance list | Campaign-owned active lookup is locally traced; atomic lifecycle is unproven. |
| Source configuration | `displayName`, currency, serialized `mappingConfig`, selected connection/tab/columns/filter values | Edit prefill, scheduler reprocess, source subtitles | GA4 CSV validation and transactional rollback are locally covered; Google Sheets and deployed behavior remain unproven. |
| CSV retained input | `csvStoredRevenueRows`, headers, sample rows, row count, stored role columns | Edit without re-upload and re-aggregation | Current shape is traced; completeness for large/legacy files and damaged configs is unproven. |
| Selected positive row total | Sum of positive parsed Revenue values after exact selected campaign filtering | Intended source revenue-to-date | CSV now rejects dated divergence before mutation; Google Sheets can still diverge. |
| Daily revenue records | `revenue_records` grouped by normalized mapped date | Range totals, breakdown, downstream aggregate inputs | GA4 CSV rejects invalid dated rows and replaces records transactionally; Google Sheets omission/replacement remain open. |
| Snapshot record | One record dated yesterday UTC when no Date column is mapped | Revenue-to-date style imported total | Locally traced; full negative/deployed reconciliation is not current evidence. |
| Imported revenue-to-date | `getRevenueTotalForRange` over active `ga4` sources and records | `/revenue-to-date`, GA4 Overview imported revenue | Active-source join is traced; source-specific end-to-end automation is incomplete. |
| Revenue breakdown | `getRevenueBreakdownBySource` over active sources/records | `/revenue-breakdown`, source amounts, Total Revenue composition | Local aggregation is traced; full Google Sheets/CSV propagation matrix is unproven. |
| Revenue source list | Active sources enriched with lifetime breakdown amounts | `/revenue-sources`, Revenue Sources modal | Local route/query and CSV read-only inventory logic are traced; the bounded target-database result is recorded below. |
| Total Revenue | Selected scoped GA4-native financial revenue plus imported GA4-context revenue | Overview Total Revenue | Only the imported Google Sheets/CSV contribution is in scope; native revenue is excluded as proof. |
| Profit | `Total Revenue - Total Spend` | Overview financial card | Only the imported-revenue input edge is in scope; Spend proof is excluded. |
| ROAS | `Total Revenue / Total Spend` | Overview financial card | Same boundary as Profit. |
| ROI | `(Total Revenue - Total Spend) / Total Spend` | Overview financial card | Same boundary as Profit. |
| CPA | Total Spend divided by conversions from the selected GA4 financial source | Overview financial card | Inventoried for adjacency only; Google Sheets/CSV Revenue does not provide conversions. |
| Recompute/cache state | Source mutation response plus query invalidation/refetch and heavier derived recompute | Open Overview and possible downstream consumers | Immediate user mutation refetch is traced; external automatic convergence and source-specific downstream parity are unproven. |

## Google Sheets Revenue End-To-End Trace

1. `client/src/components/AddRevenueWizardModal.tsx` previews through `POST /api/campaigns/:id/revenue/sheets/preview` and submits the selected connection and mapping to `POST /api/campaigns/:id/revenue/sheets/process`.
2. The process route checks campaign access, validates the request envelope and shared revenue mapping shape, resolves a campaign Google Sheets connection, refreshes/retries credentials where possible, and fetches the selected spreadsheet/tab range.
3. Rows are optionally filtered by selected campaign values. Positive values in the mapped Revenue column are summed. Valid mapped dates are normalized into `dailyRevenueMap`; blank/invalid mapped dates are not added to that map.
4. Add mode creates a new additive `google_sheets` revenue source. Edit/refresh mode requires the supplied active source ID to match the campaign, context, and source type, then updates that source.
5. The route deletes all old records for the source and inserts dated records when at least one valid date exists, otherwise one yesterday-UTC snapshot record when the total is positive. These writes are not transactional.
6. Storage totals and breakdowns inner-join records to active campaign/context sources. The API exposes those values through `/revenue-to-date`, `/revenue-breakdown`, and `/revenue-sources`.
7. GA4 Overview adds imported revenue to the independently selected GA4-native financial revenue and uses the result in Total Revenue, Profit, ROAS, and ROI. Mutation success invalidates/refetches revenue queries.
8. The daily external scheduler enumerates active `google_sheets` revenue sources across supported contexts, reads saved mapping configuration, and reprocesses the same stable source. Its helper deletes old records before inserting refreshed records and then updates `lastSyncedAt`; failure retention is not transactional.
9. The dedicated bounded source-family interval invokes Google Sheets Spend only. There is no equivalent bounded Google Sheets Revenue interval. An already-open Overview independently waits up to its ten-minute revenue query interval unless a foreground focus/reconnect or explicit mutation invalidation causes an earlier fetch.

Historical bounded evidence, not current clean certification:

- Campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, source `dd5dc470-814d-42b9-af19-4b53ac7d08f8`: add/import on `2026-07-01` recorded `$30,300` for the target source and `$30,900` imported total with the existing `$600` CSV source preserved.
- The same campaign/source edit recorded stable source identity, `$54,200` target revenue, `$54,800` imported total, two sources, no duplicate ID, and unchanged `$600` CSV revenue.
- Run-now evidence at `2026-07-01T17:10:02.050Z`, reconciled at `2026-07-01T17:12:49.833Z`, recorded `$84,500` target revenue, `$85,100` imported total, the same source ID, and the `$600` CSV source preserved.
- Delete evidence for disposable source `32661325-d2a5-404f-a898-2c84e4275809` at `2026-07-01T18:28:32.608Z` recorded HTTP `200`, `$31,000` removed, imported revenue returning to `$600`, and the CSV source preserved.
- These packets do not record automatic low-latency polling, transactional rollback, provider failure retention, repeated-refresh idempotency, every mapping/date shape, or complete downstream propagation.

## Upload CSV Revenue End-To-End Trace

1. `client/src/components/AddRevenueWizardModal.tsx` uploads a file to `POST /api/campaigns/:id/revenue/csv/preview`, renders returned headers/sample rows, and submits the file plus mapping to `POST /api/campaigns/:id/revenue/csv/process`.
2. Preview enforces campaign access, a bounded line count, and shared CSV parsing. It returns raw headers and samples; the GA4 Revenue wizard now filters Date choices by role, header, and sampled values while the server remains authoritative.
3. Process enforces campaign access, parses the shared revenue mapping, requires a Revenue column for GA4 context, reads the new file or saved rows for an existing CSV source, and verifies an edit target is an active campaign-owned CSV source in the requested context.
4. Rows are optionally filtered by exact selected campaign values. Current Commit 2 validates exact positive-row totals and rejects blank, invalid, or numeric mapped dates for any selected positive row.
5. GA4 role collisions, empty/no-positive selections, and invalid dated selections fail before source mutation. Current Commit 3 prepares the complete replacement record set, then atomically creates/updates the campaign-owned GA4 CSV source, deletes only its records, and inserts the replacements.
6. The route persists normalized stored CSV rows and mapping metadata for later edit. CSV has no provider scheduler refresh; edit/re-upload or stored-row processing is its reprocess path.
7. The same storage, API, Overview total, provenance, formula, and mutation-refetch paths described above consume the materialized CSV records.

Historical bounded evidence, not current clean certification:

- Campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, `30days`: baseline source `d4421cb9-8298-4d96-8697-c82ef5f0b7b5` contributed `$600`.
- Add/import at `2026-07-01T13:36:15.567Z` created source `8ba9a131-526c-4e59-a751-c91b92d78b8b` at `$600`, producing `$1,200` imported total with two active CSV sources and unchanged spend state.
- Edit/update preserved source `8ba9a131-526c-4e59-a751-c91b92d78b8b`, changed it to `$1,200`, preserved the original `$600` source, and recorded `$1,800` imported total with source/breakdown parity.
- Delete/deactivate at `2026-07-01T14:18:22.136Z` removed the `$1,200` disposable source, preserved source `d4421cb9-8298-4d96-8697-c82ef5f0b7b5` at `$600`, and returned imported total/breakdown to `$600`.
- The packet does not retain a complete independent mapping/date fixture description sufficient to generalize deterministic Date behavior. It does not prove rollback, invalid-input no-mutation, unusual file shapes, or complete downstream propagation.

## Downstream Propagation Matrix

| Consumer | Expected Google Sheets/CSV Revenue propagation | Current evidence | Status |
| --- | --- | --- | --- |
| `revenue_records` | Exact selected positive rows materialize without loss or duplication | GA4 CSV validation and transactional replacement are locally covered; Google Sheets omission/replacement and deployed CSV evidence remain open | Partially proven |
| `/revenue-to-date` | Equals active source lifetime records in scope | Local storage/route trace plus bounded historical packets | Partially proven |
| `/revenue-breakdown` | Target source amount and total reconcile with revenue-to-date | Local trace plus exact historical packets above | Partially proven |
| `/revenue-sources` | Stable active source identity, type, metadata, and amount | Local trace plus exact historical packets above | Partially proven |
| Open Overview Total Revenue | Imported delta appears once and combines with independently selected native revenue | Direct mutation refetch and bounded historical UI packets; ten-minute external polling gap remains | Partially proven |
| Profit / ROAS / ROI | Recompute from the same Total Revenue after source mutation | Formula/input wiring traced; no current source-specific complete automation packet | Unproven |
| CPA | Must not change from revenue-only mutation except through unrelated inputs | Revenue does not supply conversions; no source-specific immutability packet | Unproven |
| Revenue Sources modal/list | Shows the target source once with exact amount and removes it after delete | Bounded historical packets only | Partially proven |
| Scheduler refresh | Same Google Sheets source ID replaces records once and converges to endpoints/UI | Daily wiring traced; automatic mutation/timing/failure/idempotency packet absent | Unproven |
| KPI / Benchmark / notifications | If in scope later, exact imported-revenue delta reaches persisted/displayed values once | Generic wiring or other-source evidence is rejected | Unproven |
| Reports / PDF / email | If in scope later, generated artifact uses the exact post-mutation source-backed value | Other source/report packets are rejected | Unproven |
| Campaign DeepDive / aggregate consumers | Source-backed imported revenue remains scoped and reconciled | No current Google Sheets/CSV Revenue-specific complete packet | Unproven |

## Lifecycle Matrix

| Lifecycle path | Google Sheets Revenue | Upload CSV Revenue | Required closure |
| --- | --- | --- | --- |
| Add/import | Additive source identity traced; historical exact packet exists; source/record write is non-transactional | Validated GA4 source creation and record insertion share one scoped transaction locally | Deployed add/reconciliation remains required |
| Edit/update | Stable source-ID guard traced; update/delete/insert is non-transactional | Active campaign-owned GA4 CSV source update/delete/insert share one transaction locally | Deployed same-source replacement remains required |
| Refresh/reprocess | Daily scheduler and run-now helper use stable source ID; bounded Revenue-only polling absent | No provider scheduler; edit/re-upload or stored-row processing is the applicable reprocess path | Automatic Google Sheets mutation/timing/failure/idempotency evidence; explicit CSV applicability test |
| Delete/deactivate | Current UI shared exact-source route is transactional and campaign/context scoped locally; normal deployed UI deletion user-confirmed | Same shared exact-source transaction and bounded UI confirmation | Forced-failure deployed rollback remains required; legacy bulk route is excluded |
| Source modal/list | Active source/list queries and historical UI packets traced | Active source/list queries and historical UI packets traced | Automated source-specific add/edit/delete provenance parity |
| Totals/recomputation | Storage active joins and immediate user-mutation refetch traced; external refetch is ten minutes | Same totals path and immediate user-mutation refetch | Exact record/source/to-date/breakdown/Overview/formula parity |
| Validation failure | GA4 role/date/row guards now fail before foreground or scheduler revenue source/record mutation for the local fixtures | GA4 role/date/row guards now fail before mutation for the local fixtures | Deployed negative/provider packets remain required |
| Rollback | No transaction restores old source metadata/records after materialization failure | No transaction restores old source metadata/records after materialization failure | Forced-failure tests proving last valid value retention |
| Damaged-data risk | Orphan records, active zero-record sources, partial replacement, duplicate records, and stale mapping metadata are possible | Local read-only checks cover active zero-record sources, inactive-source records, proven CSV missing/cross-campaign/wrong-type source links, incomplete retained mapping metadata, stored-total mismatch, dated-row loss, duplicate row grains, and suspicious duplicate active sources | Bounded target scan recorded; rerun after relevant data/code changes and before any separate cleanup plan |

## Negative-Case Matrix

| Negative case | Google Sheets Revenue | Upload CSV Revenue | Current status |
| --- | --- | --- | --- |
| Inaccessible campaign | Campaign access checks traced | Campaign access middleware traced | Locally guarded, not a full lifecycle proof |
| Wrong/missing source ID on edit | Active campaign/context/type match required | Active campaign/context/type match required | Locally guarded |
| Wrong source family | Requires `google_sheets` target | Requires `csv` target | Locally guarded |
| Missing/invalid connection or provider auth | Error responses traced before row mutation | Not applicable | Provider retention after prior valid value unproven |
| Missing Revenue column | Shared mapping requires it for GA4 | Shared mapping requires it for GA4 | Locally guarded |
| Revenue column equals Campaign column | Rejected before foreground or scheduler revenue source/record mutation for GA4 | Rejected before mutation for GA4 | Locally guarded |
| Date column equals Revenue/Campaign column | Filtered/cleared in GA4 UI and rejected before foreground or scheduler revenue source/record mutation | Filtered/cleared in GA4 UI and rejected by server before mutation | Locally guarded |
| Non-date Date column | Sampled non-date columns are hidden; forged invalid values fail before foreground or scheduler revenue source/record mutation | Sampled non-date columns are hidden; forged invalid values are rejected before mutation | Local fixtures only |
| Blank/invalid date among positive rows | Whole GA4 request fails before foreground or scheduler revenue source/record mutation | Whole GA4 CSV request is rejected before mutation | Locally guarded |
| No positive selected rows | Rejected before foreground or scheduler revenue source/record mutation | Rejected before mutation | Locally guarded |
| Mixed valid/invalid dated rows | Whole GA4 request fails before foreground or scheduler revenue source/record mutation | Whole GA4 CSV request is rejected before mutation | Locally guarded |
| Record insert failure | Old records may already be deleted | Forced add/edit insertion failures roll back source and records locally | CSV locally proven; deployed CSV and Google Sheets unproven |
| Source metadata update failure | Partial or stale state possible | Source update/create and record replacement share one transaction | Transaction boundary locally guarded; deployed failure unproven |
| Repeated identical refresh | `onConflictDoNothing` exists, but delete/reinsert idempotency and failure boundary are not proven | Reprocess replacement idempotency not proven | Unproven |
| Concurrent refresh/edit/delete | No source-scoped transaction/lock proven | No transaction/lock proven | Unproven |
| Delete failure between writes | Forced record-delete failure rolls back source deactivation locally | Same shared transaction | Local transaction mock only; deployed failure remains unproven |
| Unrelated source mutation | Transaction scope preserves unrelated source and cross-campaign rows locally | Same shared transaction | Local transaction mock only; deployed preservation remains unproven |

## Automated Test Plan Before Provider/UI Validation

Implement and run source-specific automation before requesting deployed evidence:

1. CSV parser/mapping tests for exact campaign filtering, Revenue/Campaign/Date role uniqueness, Date option classification, non-date rejection, blank/invalid mixed-row rejection, no-positive-row rejection, and no mutation on every validation failure.
2. CSV transaction tests that force source update, old-record deletion, and record insertion failures and prove the prior source metadata and records remain exact.
3. Google Sheets mapping tests for the same role/date/row rules using provider fixtures, including snapshot and dated modes.
4. Google Sheets manual and scheduler transaction tests that force provider fetch, source update, deletion, and insertion failures and prove last-valid-value retention.
5. Repeated-refresh and concurrent-attempt tests proving stable source ID, no duplicate records, exact totals, and one successful replacement.
6. Delete transaction tests proving campaign/source ownership, context, exact-source removal, rollback, and unrelated-source preservation.
7. Revenue-only polling tests proving the bounded timer includes Google Sheets Revenue and excludes CSV and every other source family.
8. Open-Overview query tests proving revenue-to-date, sources, and breakdown refetch within the intended low-latency window without background content jumps.
9. Google Sheets/CSV Revenue-specific propagation tests covering records, source list, to-date, breakdown, Total Revenue, Profit, ROAS, ROI, CPA immutability, and any downstream consumer included in the final claim.
10. Read-only damaged-data inventory tests before any cleanup action.

## Current Automated Evidence And Its Exact Limits

Current relevant local/static guards include:

- `server/revenue-additivity.test.ts`: Google Sheets Revenue add mode creates an additive source rather than replacing by connection. It does not prove transactionality, row validity, provider timing, or deployed behavior.
- `server/ga4-auto-refresh-regression.test.ts`: the daily scheduler enumerates Google Sheets Revenue, excludes CSV snapshots from provider refresh, and exposes a scoped run-now validation trigger. It does not prove successful automatic timing, provider mutation, retention, or idempotency.
- `server/source-safety-regression.test.ts`: CSV process rejects a non-CSV edit target, preview access ordering is guarded, and individual revenue delete checks ownership before record deletion. It does not prove atomic replacement/delete or mapping/date correctness.
- `server/ga4-source-lifecycle-recompute-regression.test.ts`: source mutation response/recompute ordering has static coverage. It does not prove database rollback or complete downstream value parity.
- `server/ga4-ui-regression.test.ts`: active Google Sheets/CSV status and stable Google Sheets chooser behavior have UI-source guards. It does not prove numeric lifecycle correctness.
- `server/latest-day-revenue-regression.test.ts`: revenue endpoint date semantics have local coverage. It is not source-specific lifecycle, negative-case, or rollback proof.
- `server/csv-revenue-validation.test.ts`: Current Commit 2 dynamically covers exact campaign filtering, dated-total reconciliation, blank/invalid/numeric date accounting, and empty/no-positive rows, and statically guards GA4-only UI filtering plus server validation ordering before mutation. It does not prove transactionality, deployed behavior, every CSV shape, or downstream value propagation.
- `server/csv-revenue-transaction.test.ts`: Current Commit 3 forces source-update, old-record-delete, edit replacement-insert, and add replacement-insert failures; it verifies exact prior-state retention and no orphan add source. This is mocked local transaction-boundary evidence, not deployed PostgreSQL evidence.
- `server/google-sheets-revenue-validation.test.ts`: Current Commit 4 dynamically covers exact filtered dated and snapshot fixtures plus blank/invalid/numeric dates, and statically guards GA4-only Date filtering and fail-before-mutation ordering in foreground and scheduler paths. It does not prove provider behavior, transactionality, deployed behavior, every sheet shape, or downstream value propagation.
- `server/revenue-source-delete-transaction.test.ts`: Current Commit 7 forces source-deactivation and record-deletion failures, verifies rollback, and proves the successful mock transaction preserves an unrelated source plus a cross-campaign row. Static route/storage guards repeat campaign, active-source, platform-context, source-ID, and record-campaign scoping. This is local mocked transaction evidence, not deployed PostgreSQL evidence.
- `server/csv-revenue-downstream-propagation.test.ts`: Current Commit 8 dynamically proves an exact filtered CSV delta enters Total Revenue, Profit, ROAS, and ROI once while CPA remains unchanged, and statically links the GA4 CSV transaction to active campaign/context source totals, breakdown, source-list amounts, Overview formulas, and post-mutation query refresh. It is local CSV-only automation; it does not add Google Sheets evidence or deployed numeric proof.
- `server/csv-revenue-damaged-data-inventory.test.ts`: Current Commit 9 dynamically proves clean reconciliation, active zero-record, inactive-source-record, proven CSV missing/cross-campaign/wrong-type source-link, incomplete retained mapping, stored-total mismatch, dated-row loss, duplicate row-grain, and non-GA4/non-CSV exclusion behavior. It also statically guards the campaign-access and read-only/no-cleanup endpoint boundary. It does not inspect a target database or authorize cleanup.
- `server/csv-revenue-deployed-validation-runner.test.ts`: Current Commit 10 statically guards the validation runner version, compact active CSV source identity/amount capture, exact target amount and amount-delta checks, stable before/after source state, revenue-to-date/breakdown parity, unchanged-spend default, GET-only inventory behavior, explicit known-inactive boundary, and no automatic cleanup. It is validation tooling evidence only; it does not perform the deployed UI actions.

Current Commit 2 local validation on `2026-07-12`: the focused test passed 5/5; the adjacent seven-file packet passed 100/100; `npm run check` passed. The broad source-safety file passed all 80 non-Instagram assertions, including the CSV Revenue guard, and failed its seven unrelated Instagram assertions. These results are local code evidence only.

Current Commit 3 local validation on `2026-07-12`: the focused validation/rollback packet passed 2 files and 10/10 tests; the adjacent eight-file packet passed 105/105; `npm run check` passed. Forced failures use a transactional mock and do not substitute for deployed PostgreSQL evidence.

Current Commits 2 and 3 deployed UI validation on `2026-07-12`: the user confirmed the normal browser flow passed after deployment. No exact campaign/property, file identity, mapping, source ID, record count, before/after amount, or injected-failure output was supplied for this documentation packet. This confirms only the user-observed normal UI flow; forged-request rejection, rollback under forced failure, exact reconciliation, and unrelated-source preservation remain bounded to local automation or unproven deployed evidence as stated above.

Current Commit 4 local validation on `2026-07-12`: the focused test passed 5/5; the adjacent eight-file revenue/scheduler/UI packet passed 98/98; `npm run check` passed. Provider calls, deployed UI behavior, and transaction rollback were not exercised.

Current Commit 7 local validation on `2026-07-12`: the focused transaction/lifecycle/Shopify packet passed 3 files and 29/29 tests; the adjacent nine-file Revenue lifecycle/UI/calculation packet passed 110/110; `npm run check` passed. The exact individual-delete assertions also passed inside the broader source-safety and HubSpot files. Those broad files still contain seven pre-existing unrelated Instagram failures and two pre-existing unrelated HubSpot formatting/helper assertions respectively; they are not Current Commit 7 failures.

Current Commit 7 deployed UI validation on `2026-07-12`: the user confirmed the normal browser deletion flow passed after deployment. The requested validation boundary was source removal persisting after reload, the expected Total Revenue decrease, and preservation of unrelated revenue sources. No raw numeric/source-ID packet or forced database failure was supplied, so this records user-confirmed normal UI behavior only and does not replace the local rollback tests.

Current Commit 8 CSV-only local validation on `2026-07-12`: the focused downstream propagation test passed 6/6; the adjacent ten-file CSV lifecycle/cross-tab/UI/financial-math packet passed 204/204; `npm run check` passed. No production runtime code changed. Google Sheets Revenue coverage was explicitly excluded and remains on hold.

Current Commit 9 CSV-only validation on `2026-07-12`: the focused inventory test passed 4/4; the adjacent six-file CSV lifecycle/source-inventory packet passed 29/29; `npm run check` passed. The configured target-database read-only scan completed at `2026-07-12T10:49:40.451Z` and returned 4 campaigns, 22 GA4 CSV sources, 21 linked records, and 5 finding groups. All 5 groups were inactive sources retaining 17 records; no active or reconciliation finding was returned. No cleanup path was added and no data was mutated.

Current Commit 10 local validation on `2026-07-12`: `node --check client/public/ga4-overview-validation-runner.js` passed; the focused/adjacent six-file CSV validation packet passed 25/25; `npm run check` passed. Only static browser validation support, focused regression coverage, and documentation changed. These local results alone claim no deployed lifecycle evidence; the later bounded UI confirmation is recorded separately below.

Current Commit 10 deployed UI validation on `2026-07-12`: the user confirmed the normal documented CSV lifecycle passed after deployment. The `Alpha` add showed `$150`; the same source changed to `$1,250` for `Alpha + Beta`, returned to `$150` for `Alpha`, never duplicated, then disappeared on delete. Total Revenue returned to its original value and Total Spend remained unchanged. The user subsequently confirmed the invalid CSV test passed: an error appeared, no revenue source was created, and Total Revenue and Total Spend remained unchanged. No browser-runner output, campaign/property/source IDs, endpoint-parity output, or exact deployed Profit/ROAS/ROI/CPA values were supplied; those items are not claimed as deployed evidence.

Current Commit 12 final CSV-only rerun on `2026-07-12`: the end-to-end CSV path was retraced from the GA4 Revenue wizard mapping and campaign-guarded process route through fail-before-mutation validation, campaign/type/context-scoped transactional source-and-record replacement, active-source to-date/breakdown/source-list reads, derived financial recomputation, read-only damage inventory, and transactional exact-source deletion. The bounded eight-file packet passed 44/44, `node --check client/public/ga4-overview-validation-runner.js` passed, and `npm run check` passed. The attempted broader nine-file packet passed 50/51; the sole failure was outside CSV Revenue in `server/campaign-financial-analysis-regression.test.ts`, whose static expected platform-spend expression omits the current `custom?.spend` term. The refreshed target-database scan at `2026-07-12T11:40:50.064Z` covered 4 campaigns, 23 GA4 CSV sources, and 21 linked records. It returned the same five known inactive-source record groups and no active-source, mapping, total, date, duplicate-row, orphan, cross-campaign, or wrong-type finding. Compared with Current Commit 9, one additional inactive zero-record CSV source is consistent with the validated create/delete lifecycle and does not feed live totals. No cleanup was applied or warranted. After the commit, the user confirmed the deployed invalid-file no-mutation test passed. Final decision: Upload CSV Revenue is clean-certified for the validated documented scope; Google Sheets Revenue remains on hold.

## Current Commit Queue

Use isolated commits in this order:

| Current Commit | Scope | Status / gate |
| --- | --- | --- |
| 1 | This documentation baseline | Documentation-only baseline; does not certify runtime behavior |
| 2 | CSV Revenue deterministic mapping/date/row validation | Implemented, locally validated, and normal UI flow user-confirmed; deployed negative cases remain Current Commit 10 evidence |
| 3 | CSV Revenue transactional add/edit replacement | Implemented, locally validated, and normal UI flow user-confirmed; deployed stable-source replacement remains Current Commit 10 evidence; forced database failure remains local rollback evidence because the normal UI has no safe failure-injection control |
| 4 | Google Sheets Revenue deterministic mapping/date/row validation | Implemented and locally validated; deployed/provider negatives remain Current Commit 11 evidence |
| 5 | Google Sheets Revenue transactional manual/scheduler replacement | On hold with Google setup/provider work |
| 6 | Bounded Google Sheets Revenue-only polling and Overview revenue refetch | On hold with Google setup/provider work |
| 7 | Transactional revenue source delete | Implemented, locally validated, and normal deployed UI flow user-confirmed for the current shared individual-source route |
| 8 | Google Sheets/CSV Revenue-specific downstream propagation automation | CSV-only portion implemented and locally validated; Google Sheets portion on hold |
| 9 | Read-only damaged-data inventory | CSV-only campaign-guarded automation, local validation, target-database scan, and no-cleanup assessment complete; Google Sheets inventory on hold; no cleanup applied |
| 10 | Deployed CSV lifecycle/reconciliation evidence | Normal add/repeated-edit/delete lifecycle and invalid-file no-mutation user-confirmed; console-runner, source-ID, endpoint-parity, and exact deployed derived-card packets were not supplied and are excluded from the claim |
| 11 | Deployed Google Sheets automatic mutation/failure/OAuth durability evidence | On hold |
| 12 | Final certification rerun and documentation update | CSV-only rerun completed and final invalid-file confirmation received; Upload CSV Revenue clean-certified for the validated documented scope; Google Sheets remains on hold |

## Proven Locally

- The frontend calls the Revenue CSV and Google Sheets preview/process routes and refetches imported revenue queries after a successful user mutation.
- Both process routes enforce campaign access and validate a shared revenue mapping envelope.
- Edit targets are checked against the campaign and expected source type/context.
- Google Sheets add mode is additive; edit/refresh mode uses a stable source ID.
- CSV has no independent provider scheduler path; Google Sheets Revenue participates in the daily external refresh path.
- Storage totals and breakdowns join revenue records to active campaign/context revenue sources.
- The individual delete route resolves a campaign-owned active source and checks the requested context before mutation.
- The open Overview imported revenue-to-date, sources, and breakdown queries currently refetch every ten minutes.
- GA4 CSV Revenue add/edit source and record replacement is transactional; Google Sheets replacement remains non-transactional.
- GA4 CSV Revenue Date choices now exclude the selected Revenue/Campaign roles and sampled non-date columns; stale invalid Date selections are cleared.
- The GA4 CSV Revenue server path rejects role collisions, empty/no-positive selections, and blank/invalid/numeric dated positive rows before source mutation.
- GA4 CSV Revenue add/edit now scopes source update/create, exact-source record deletion, and replacement insertion to one database transaction; forced add/edit insertion failures retain the last valid state locally.
- The GA4 Google Sheets Revenue Date chooser excludes selected role columns and sampled non-date columns, and clears stale invalid Date selections.
- GA4 Google Sheets Revenue foreground and scheduler paths reject role collisions, empty/no-positive selections, and blank/invalid/numeric dated positive rows before source or record mutation.
- The current UI shared individual revenue-source delete transaction rechecks the active source ID, campaign, and platform context; source deactivation and exact campaign/source record deletion roll back together locally.
- Normal deployed exact-source deletion behavior is user-confirmed for Current Commit 7; the confirmation has no archived numeric/source-ID or forced-failure packet.
- CSV Revenue locally propagates its exact filtered delta once through the active campaign/GA4 source-backed total, breakdown, source list, Total Revenue, Profit, ROAS, and ROI paths; CPA remains spend divided by conversions and does not change with revenue.
- The existing campaign-access-guarded Overview source-damage GET route now reports CSV-only source/record counts and exact candidate IDs for active zero-record sources, inactive-source records, proven CSV missing/cross-campaign/wrong-type source links, incomplete retained mapping metadata, stored-total mismatch, dated-row loss, duplicate materialized row grains, and suspicious duplicate active sources. It never cleans or mutates data.
- The static deployed-browser helper now records compact active CSV source IDs/amounts, exact target presence and amount changes, source-count and total deltas, revenue endpoint parity, unchanged spend, and the documented read-only inventory boundary. The helper itself performs no source mutation; add/edit/delete remain deliberate UI actions.

## Partially Proven

- Historical add/edit/delete endpoint and UI reconciliation for the exact CSV sources, campaign, property, amounts, and timestamps recorded above.
- Historical Google Sheets add/edit/run-now/delete reconciliation for the exact sources, campaign, property, amounts, and timestamps recorded above.
- Stable source identity and preservation of the specifically named counterpart source within those packets.
- Immediate query refresh after a successful foreground source mutation.
- Daily scheduler wiring for active Google Sheets Revenue sources.

## Unproven

- Clean certification for Google Sheets Revenue.
- Deployed CSV Revenue negative-case behavior and unusual/unlisted file, header, date, and mapping shapes beyond the local fixtures.
- Deployed/provider proof of Google Sheets Revenue fail-before-mutation behavior and unusual/unlisted sheet, tab, header, mapping, filter, and date shapes beyond the local fixtures.
- Atomic Google Sheets add/edit/scheduler replacement behavior.
- Deployed PostgreSQL rollback evidence for the current UI shared individual revenue-source delete; the uncalled legacy bulk-delete route remains non-transactional and excluded.
- Deployed PostgreSQL proof of GA4 CSV add/edit rollback and last-valid-value retention.
- Google Sheets last-valid-value retention after provider, source-update, record-delete, or record-insert failure.
- Repeated-refresh idempotency and concurrent operation safety.
- Bounded Google Sheets Revenue-only automatic polling and already-open Overview convergence within the intended low-latency window.
- Exact automatic Google Sheets provider mutation propagation through source, records, endpoints, Overview, and every claimed downstream consumer.
- Console-runner endpoint-parity output, raw source IDs, and exact deployed Profit/ROAS/ROI/CPA values beyond the bounded UI confirmation; these are excluded from the current CSV claim and require fresh evidence if separately claimed.
- Unlisted files, delimiters, encodings, duplicate headers, locale numbers, ambiguous dates, large-file boundaries, sheets, tabs, mappings, filters, campaigns, properties, and currencies.
- Future target-database changes after the recorded Current Commit 9 read-only scan.

## Not Locally Verifiable

- Live Google Sheets contents, permissions, API availability, provider latency, quota behavior, OAuth consent state, refresh-token renewal, revocation, and durability beyond the observed period.
- Deployed scheduler execution at the configured time and future low-latency timer execution.
- Production database contents after the recorded scan or outside the CSV-only Current Commit 9 boundary.
- Browser rendering and already-open-page convergence under deployed runtime conditions.
- Provider acceptance, generated artifact content, or delivery for any downstream report/email path unless separately captured.
- Future provider, infrastructure, database, or code behavior.

## Damaged-Data Inventory And Cleanup Boundary

Prior non-transactional behavior may have persisted damaged or ambiguous state. Current Commit 9 implements these CSV-only checks in `/api/campaigns/:id/ga4-overview/source-damage-inventory`, by campaign and source ID:

- active GA4 CSV sources with zero records;
- inactive GA4 CSV sources that still retain records;
- proven CSV records whose source is missing, belongs to another campaign, or has the wrong source type;
- suspicious duplicate active GA4 CSV sources or duplicate source/date/sub-campaign record grains;
- retained CSV row totals that differ from the effective materialized lifetime total;
- dated retained CSV rows whose selected positive revenue has a blank/invalid date;
- active CSV mapping configs missing complete stored rows, headers, row count, or unique Revenue/Campaign/Date role metadata needed for a safe edit.

Google Sheets inventory, connection metadata, scheduler metadata, and `lastSyncedAt` checks remain on hold and are not Current Commit 9 CSV evidence.

Current Commit 9 inventory is read-only, campaign-access guarded, excludes non-GA4 CSV and every non-CSV family from its CSV result, and returns `automaticCleanupAllowed: false`. Missing legacy retained rows are reported as incomplete rather than guessed. Do not deactivate, delete, merge, rewrite, backfill, or invent dates/allocations during inventory. Any cleanup requires a separate targeted plan listing exact campaign IDs, source IDs, record IDs/counts, the proven damage rule, expected before/after totals, rollback, and unrelated-source checks.

Target-database result recorded at `2026-07-12T10:49:40.451Z`:

- scanned 4 campaigns, 22 GA4 CSV sources, and 21 records linked to those sources;
- 2 active GA4 CSV sources were present, and neither produced an active-source, retained-mapping, stored-total, dated-loss, duplicate-row, orphan, cross-campaign, or wrong-type finding;
- campaign `73eaa049-edb4-4852-9321-76d7924fc725` had four inactive sources retaining 16 records:
  - source `a9f8f8b7-24d6-4a15-87ba-e16faa202823`: record `aca7e3e8-c5d5-40e9-b604-22e838473c72`;
  - source `7b751b6d-d43d-4be3-970e-8559492d86ad`: record `1accda7f-72a0-40cf-bb3a-9fba8c9c1322`;
  - source `33e1de1d-5426-4d5c-ab29-6c0fe076fe87`: records `b5c659ed-e6ad-449a-b0b8-e0cd5c2a9ee0`, `8233dd99-0b10-4bb0-9092-fde096866009`, `a9beec79-4cbb-4803-aaa0-8dca11df0f02`, `24448855-2a51-4d1f-8158-8321cf102d6c`, `a933b19d-8d61-4baf-807b-694d7054f3cd`, `c7151fe0-35b1-4b85-8c95-b31e789ba476`, and `5a19c0f5-7313-4e93-a455-0b06d7ce7619`;
  - source `24416e0b-a65d-45cb-86d4-68a69d4473a9`: records `cee5f6f9-9fd3-4954-844b-5fc164476b5a`, `aa06734b-1712-4841-9703-79d71ba9e040`, `51e54c4f-be48-4766-b3f1-792d4fff2a5b`, `2150514f-d62d-4342-b84f-10d61bf7f367`, `86c115cb-27e8-4c97-b778-a11de9bbb53d`, `e444161a-727e-469a-8286-80a8b94c747c`, and `2dae6a49-331f-419d-aac5-be212fd1e1f8`;
- campaign `79e0bbf4-c990-4595-9b31-e245aee8156a` had inactive source `d87ca77c-d995-49ae-8d8e-7c9500d33fd6` retaining record `7faf7eb5-a493-47a1-81bb-2538dbb17387`;
- these inactive rows are excluded from live revenue totals by the existing active-source joins. Their creation history cannot be proven from persisted rows alone, although the state is consistent with the previously non-transactional deactivate/delete boundary fixed prospectively by Current Commit 7;
- cleanup assessment: no cleanup is required for current numeric correctness. The smallest no-side-effect decision is to leave the inactive history untouched. If storage hygiene cleanup is later requested, it must be a separate exact campaign/source/record-scoped transactional commit with before/after total and unrelated-source checks.

Current Commit 12 read-only rescan at `2026-07-12T11:40:50.064Z`:

- 4 campaigns, 23 GA4 CSV sources, 2 active CSV sources, and 21 linked CSV records;
- the same 5 inactive-source record groups retained the same 17 records;
- no active-source zero-record, orphan, cross-campaign, wrong-type, incomplete-mapping, stored-total, dated-loss, or duplicate-row finding was returned;
- compared with the Current Commit 9 scan, one additional inactive zero-record source remained after the validated disposable-source delete; it is excluded from live totals and needs no numeric cleanup;
- no cleanup or other data mutation was performed.

## External Provider/Deployed Validation Gates

After the automated gates pass and the fixes are deployed:

- CSV: follow `GA4/OVERVIEW_VALIDATION_RUNNER.md` Current Commit 10 procedure and capture exact campaign/property, durable fixture identity, headers, role mappings, selected campaign values, Date mode, source ID/count, target amount, to-date, breakdown, inventory, Total Revenue, Profit, ROAS, ROI, CPA, and unrelated-source values before and after invalid import, add, two same-source edits, and delete.
- Google Sheets: capture exact campaign/property, source/connection/spreadsheet/tab identity, non-secret mapping, selected campaign values, Date mode, before values, one controlled sheet mutation, automatic processing without run-now or reload, elapsed timing, stable source ID, exact delta, record/source/to-date/breakdown/Overview/formula parity, and unrelated-source stability.
- Google Sheets provider/materialization failure retention remains a separate on-hold provider gate. CSV forced database insertion failure is locally transaction-tested; the deployed UI has no safe failure-injection control, and Current Commit 10 must not add one merely to manufacture browser evidence.
- Prove repeated automatic refresh produces no duplicate source or records and no total drift.
- Prove OAuth renewal/durability and reconnect behavior without treating a manual repaired run as automatic durability evidence.
- Record each packet independently. Do not combine a CSV action, Google Sheets action, another source family, or downstream artifact into one ambiguous pass.

## Certification Gate

Each source may be called clean-certified only when its own applicable gates are satisfied:

- Current Commits 2 through 9 are implemented and their focused automated suites pass;
- Current Commit 10 produces the bounded deployed CSV packet for Upload CSV Revenue, and Current Commit 11 produces the bounded deployed provider packet for Google Sheets Revenue;
- the complete value, lifecycle, negative-case, rollback, damaged-data, automatic-timing, and downstream matrices contain no assumed or merely sampled path inside the requested claim;
- no open source-specific defect can lose, duplicate, silently omit, misdate, broaden, or stale the revenue value;
- production inventory findings are either clean or resolved by a separately proven cleanup;
- Current Commit 12 reruns the full certification evidence and updates this document without importing evidence from excluded source families.

Current Commit 12 completed the CSV-only rerun, and the later user-confirmed invalid-file no-mutation result closes the applicable Current Commit 10 deployed UI gate for the bounded CSV claim. Google Sheets Current Commit 11 remains on hold.

Any new defect immediately lowers the affected source/path to unproven until root cause, query shape, ordering, limits, merge keys, fallback behavior, downstream propagation, negative cases, and deployed evidence are re-established.

## Stable Response For Future Chats

Use only when the question is limited to GA4 Overview Google Sheets Revenue and Upload CSV Revenue:

Upload CSV Revenue is clean-certified for the validated documented scope. The evidence includes deterministic fail-before-mutation validation, transactional add/edit/delete, local downstream propagation, refreshed target inventory with no active/reconciliation damage, deployed `$150` / `$1,250` / `$150` add/repeated-edit/delete behavior without duplicates, Revenue baseline restoration, unchanged Spend, and user-confirmed invalid-file error/no-source/no-metric-change behavior. Console-runner output, raw source IDs, exact deployed Profit/ROAS/ROI/CPA values, unlisted CSV shapes, and future code/data changes are not claimed without fresh evidence. Google Sheets Revenue remains on hold and is not clean-certified. Spend and all other source families are excluded as proof.
