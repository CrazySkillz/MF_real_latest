# GA4 Overview Revenue Production Readiness

## Mandatory Anti-Overclaim Rule

Apply `AGENTS.md`, `ARCHITECTURE_USER_JOURNEY.md`, `PRODUCTION_READINESS.md`, `GA4/README.md`, `GA4_DEVELOPMENT_WORKFLOW.md`, `GA4/OVERVIEW.md`, `GA4/OVERVIEW_PRODUCTION_READINESS.md`, `GA4/FINANCIAL_SOURCES.md`, and `GA4/REFRESH_AND_PROCESSING.md` before using this file as readiness evidence.

A previous production-ready statement is not evidence. A passing test suite is not evidence for a path the tests do not cover. Historical packets retain their exact campaign, property, source, mapping, date, value, and validation boundaries. Do not generalize them to another file, mapping, campaign, scheduler run, provider condition, downstream consumer, or negative case.

This file accepts only evidence independently traced for Google Sheets Revenue or Upload CSV Revenue. Spend, Shopify, HubSpot, Salesforce, GA4-native revenue, Meta, LinkedIn, Google Ads, Manual revenue, KPI, Benchmark, Reports, and every other source family are not substitute proof. A downstream consumer is evidence only when the value path from the named Google Sheets or CSV revenue source is explicitly traced to that consumer.

Current controlling whole-tab decision: **GA4 Overview is PRODUCTION_READY for certified runtime boundary `12789c1ebb92dd6a905a9f2f0f877f0bc6a90627`; the enabled Upload CSV Revenue source retains its exact-source certification inside that recorded boundary.** Evidence-only deployment `e175ac5c` does not change production runtime code. Source `d4421cb9-8298-4d96-8697-c82ef5f0b7b5` remains materialized, USD, and `$600`. Google Sheets Revenue is available in setup but is not configured in the certified target, so its independent future provider lifecycle remains excluded rather than silently certified.

## Purpose

This is the component readiness file for GA4 Overview imported revenue from:

- Google Sheets Revenue
- Upload CSV Revenue

It separates these two source families from whole-Overview and spend certification. It records the current implementation, historical bounded evidence, known destructive boundaries, missing negative cases, and the work required before either source can receive a clean-certification claim.

## Current Status

- **Google Sheets Revenue is enabled but excluded from the current configured-source certification.** Foreground add/edit and scheduler refresh remain campaign/source-scoped, currency-guarded, and transactional. A future Google Sheets Revenue source needs its own provider packet before its boundary can be added.
- **Upload CSV Revenue is clean-certified for the current enabled source and the previously validated bounded CSV lifecycle.** The deployed import boundary rejects a supplied currency that differs from the campaign, persists normalized campaign currency, distinguishes valid zero from missing materialization, and preserves authoritative aggregate totals by record presence.
- **Current Commit 12 CSV certification decision is historical only.** Its deployed invalid-file packet and local evidence remain useful within their exact revision boundary and do not certify the current code or current persisted state.
- **The prior Google Sheets Revenue hold is superseded.** Current Commit 21 restores setup without modifying existing production sources. Re-enablement does not close the remaining source-family evidence gates.
- Current Commit 7 has user-confirmed deployed UI validation for the normal exact-source deletion flow. Rollback remains deterministically transaction-tested because the normal UI intentionally has no unsafe database-failure injection control; this is not represented as an observed production failure.
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

## Revenue-Specific Root-Cause And Future Google Sheets Evidence-Gap Analysis

The enabled CSV source is closed inside the exact Overview boundary. The remaining items below apply to a future Google Sheets Revenue source and must not be read as blockers for the current configured source set:

- Google Sheets Revenue is included in `runDailyAutoRefreshOnce`, but the bounded `GOOGLE_SHEETS_SPEND_REFRESH_INTERVAL_MINUTES` timer calls only the spend source-family runner. Revenue therefore has daily external refresh participation but no bounded low-latency Revenue-only provider poll.
- Open GA4 Overview queries for `/revenue-to-date`, `/revenue-sources`, and `/revenue-breakdown` each use a ten-minute refetch interval. Mutation success handlers refetch immediately, but an external sheet edit processed outside the browser does not meet the intended low-latency contract.
- Before Current Commit 3, CSV edit updated source metadata and deleted old records before inserting replacements, while add created its source separately. Current Commit 3 moves validated GA4 CSV add/edit source and record replacement into one scoped database transaction; non-GA4 CSV behavior is unchanged.
- Historical Google Sheets foreground add/edit performed source create/update, old-record deletion, and new-record insertion separately. Current code routes GA4 foreground add/edit through `replaceRevenueSourceWithRecords(...)`, and Whole-Overview Commit 17 routes scheduler replacement through the same exact-source transaction.
- Current Google Sheets foreground and scheduler provider/validation failures occur before replacement; transaction failures roll back source metadata and records together. A future configured source still needs its bounded deployed provider/failure packet before independent source-family certification.
- Before Current Commit 2, CSV Date choices included Revenue, Campaign, and non-date columns, and the server did not reject those role collisions. Current Commit 2 filters only the GA4 CSV Date chooser, clears stale invalid Date selections, and repeats authoritative collision validation on the server before mutation.
- Before Current Commit 2, CSV positive-revenue rows with blank, invalid, or numeric mapped dates could be counted but omitted from persisted daily records. CSV now rejects the whole request before mutation.
- Before Current Commit 4, Google Sheets exposed every header as a Date choice and its foreground and scheduler paths could count positive rows whose blank, invalid, or numeric mapped dates were omitted from daily persistence. Current Commit 4 filters only the GA4 Date chooser and rejects role collisions, empty/no-positive selections, and any undated selected positive revenue before source/record mutation in both paths.
- Before Current Commit 7, the current UI's shared individual revenue-source delete verified campaign ownership and optional platform context, but source deactivation and record deletion were separate writes. Current Commit 7 repeats the active source/campaign/context boundary inside one transaction and deletes only records matching that source and campaign. The legacy bulk-delete route has no current frontend caller and remains outside this exact-source fix.
- Before Current Commit 9, the existing read-only Overview source-damage endpoint reported generic orphan, inactive-source-record, duplicate-source, and context findings, but it omitted retained CSV rows from mapping analysis and could not prove CSV stored-row completeness, expected-versus-materialized totals, dated-row loss, or duplicate materialized row grains. Current Commit 9 adds only that CSV-specific assessment to the existing campaign-access-guarded GET route; it adds no cleanup or mutation path.
- Existing tests and exact-source transactions prove the deterministic rollback/fail-before-mutation contract. They do not generalize automatic timing, provider behavior, or mapping shapes for a future Google Sheets Revenue source.
- Historical deployed lifecycle packets prove only their recorded interactions. Current CSV certification additionally uses exact current source ID, materialization, USD provenance, and Total Revenue reconciliation; future Google Sheets provider evidence remains separate.

## Complete Value Inventory

| Value or state | Source of truth / transformation | Visible or downstream use | Current boundary |
| --- | --- | --- | --- |
| Revenue source identity | `revenue_sources.id`, campaign ID, `sourceType`, `platformContext`, active state | Source edit/delete, scheduler stable identity, provenance list | Exact enabled CSV source `d4421cb9-8298-4d96-8697-c82ef5f0b7b5` is current and certified; Google Sheets add/edit uses the same guarded atomic source identity but a future source remains excluded. |
| Source configuration | `displayName`, currency, serialized `mappingConfig`, selected connection/tab/columns/filter values | Edit prefill, scheduler reprocess, source subtitles | CSV campaign-currency and transactional replacement are deployed. Google Sheets setup is deployed and guarded; a future configured source still needs its provider packet. |
| CSV retained input | `csvStoredRevenueRows`, headers, sample rows, row count, stored role columns | Edit without re-upload and re-aggregation | The exact current source retained $600 USD materialization and the bounded dated CSV lifecycle; unusual/legacy file shapes remain excluded. |
| Selected positive row total | Sum of positive parsed Revenue values after exact selected campaign filtering | Intended source revenue-to-date | CSV rejects dated divergence before mutation. Google Sheets uses the same GA4 validation before atomic replacement; future provider data remains outside the current source boundary. |
| Daily revenue records | `revenue_records` grouped by normalized mapped date | Range totals, breakdown, downstream aggregate inputs | GA4 CSV and Google Sheets process paths validate first and replace the exact source and records transactionally. |
| Snapshot record | One record dated the latest completed reporting day when no Date column is mapped | Revenue-to-date style imported total | Scoped code path is covered; the certified current CSV source is materialized and USD without generalizing to unlisted mapping shapes. |
| Imported revenue-to-date | `getRevenueTotalForRange` over active `ga4` sources and records | `/revenue-to-date`, GA4 Overview imported revenue | Exact current CSV contribution is $600 USD; the five-source imported total is $16,799.99 USD. |
| Revenue breakdown | `getRevenueBreakdownBySource` over active sources/records | `/revenue-breakdown`, source amounts, Total Revenue composition | Exact CSV source amount/list/to-date parity passed; no Google Sheets Revenue source is configured in the target. |
| Revenue source list | Active sources enriched with lifetime materialized breakdown amounts | `/revenue-sources`, Revenue Sources modal | Exact CSV source appears once at $600; missing materialization is unavailable and a materialized zero remains $0. |
| Total Revenue | Selected scoped GA4-native financial revenue plus imported GA4-context revenue | Overview Total Revenue | Exact CSV contribution is included once in current release-candidate Total Revenue `$72,766.69 USD`; native revenue and other source families are independently evidenced by the whole-Overview record. |
| Profit | `Total Revenue - Total Spend` | Overview financial card | The certified exact CSV contribution flows through the shared Total Revenue input; Spend proof remains owned by the whole-Overview boundary. |
| ROAS | `Total Revenue / Total Spend` | Overview financial card | Same exact-source/whole-Overview boundary as Profit. |
| ROI | `(Total Revenue - Total Spend) / Total Spend` | Overview financial card | Same exact-source/whole-Overview boundary as Profit. |
| CPA | Total Spend divided by conversions from the selected GA4 financial source | Overview financial card | Inventoried for adjacency only; Google Sheets/CSV Revenue does not provide conversions. |
| Recompute/cache state | Source mutation response plus query invalidation/refetch and bounded derived recompute | Open Overview and downstream consumers | Current CSV source/total parity passed. Google Sheets foreground mutation invalidates immediately and scheduler replacement preserves stable identity; generalized future-provider timing remains excluded. |

## Google Sheets Revenue End-To-End Trace

1. `client/src/components/AddRevenueWizardModal.tsx` previews through `POST /api/campaigns/:id/revenue/sheets/preview` and submits the selected connection and mapping to `POST /api/campaigns/:id/revenue/sheets/process`.
2. The process route checks campaign access, validates the request envelope and shared revenue mapping shape, resolves a campaign Google Sheets connection, refreshes/retries credentials where possible, and fetches the selected spreadsheet/tab range.
3. Rows are optionally filtered by selected campaign values. Positive values in the mapped Revenue column are summed. Valid mapped dates are normalized into `dailyRevenueMap`; blank/invalid mapped dates are not added to that map.
4. Add mode creates a new additive `google_sheets` revenue source. Edit/refresh mode requires the supplied active source ID to match the campaign, context, and source type, then updates that source.
5. After validation, the GA4 path calls `replaceRevenueSourceWithRecords(...)`, which creates or updates only the exact campaign/context/type source and replaces its records in one transaction. It inserts dated records when a Date column is mapped, otherwise one latest-completed-day snapshot when the total is positive.
6. Storage totals and breakdowns inner-join records to active campaign/context sources. The API exposes those values through `/revenue-to-date`, `/revenue-breakdown`, and `/revenue-sources`.
7. GA4 Overview adds imported revenue to the independently selected GA4-native financial revenue and uses the result in Total Revenue, Profit, ROAS, and ROI. Mutation success invalidates/refetches revenue queries.
8. The external scheduler enumerates active `google_sheets` revenue sources across supported contexts, reads saved mapping configuration, fetches and validates provider data before mutation, and calls `replaceRevenueSourceWithRecords(...)` for the same stable source. Source freshness and replacement records commit together; provider or transaction failure retains the last-good rows.
9. The dedicated bounded source-family interval invokes Google Sheets Spend only. There is no equivalent bounded Google Sheets Revenue interval. An already-open Overview independently waits up to its ten-minute revenue query interval unless a foreground focus/reconnect or explicit mutation invalidation causes an earlier fetch.

Historical bounded Google Sheets evidence; no Google Sheets Revenue source is configured in the current certification:

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

Historical bounded CSV evidence, supplemented by the current exact-source/USD reconciliation above:

- Campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, `30days`: baseline source `d4421cb9-8298-4d96-8697-c82ef5f0b7b5` contributed `$600`.
- Add/import at `2026-07-01T13:36:15.567Z` created source `8ba9a131-526c-4e59-a751-c91b92d78b8b` at `$600`, producing `$1,200` imported total with two active CSV sources and unchanged spend state.
- Edit/update preserved source `8ba9a131-526c-4e59-a751-c91b92d78b8b`, changed it to `$1,200`, preserved the original `$600` source, and recorded `$1,800` imported total with source/breakdown parity.
- Delete/deactivate at `2026-07-01T14:18:22.136Z` removed the `$1,200` disposable source, preserved source `d4421cb9-8298-4d96-8697-c82ef5f0b7b5` at `$600`, and returned imported total/breakdown to `$600`.
- The packet does not retain a complete independent mapping/date fixture description sufficient to generalize deterministic Date behavior. It does not prove rollback, invalid-input no-mutation, unusual file shapes, or complete downstream propagation.

## Downstream Propagation Matrix

| Consumer | Expected Google Sheets/CSV Revenue propagation | Current evidence | Status |
| --- | --- | --- | --- |
| `revenue_records` | Exact selected positive rows materialize without loss or duplication | Exact enabled CSV rows are materialized and USD; CSV and Google Sheets replacements share the scoped transaction helper | Passed for current CSV; future Google Sheets provider data excluded |
| `/revenue-to-date` | Equals active source lifetime records in scope | Exact CSV source is $600 and included once in imported total $16,799.99 | Passed for current CSV |
| `/revenue-breakdown` | Target source amount and total reconcile with revenue-to-date | Exact CSV amount, source ID, source list, and imported total reconcile | Passed for current CSV |
| `/revenue-sources` | Stable active source identity, type, metadata, and amount | Exact current CSV source appears once at $600 USD | Passed for current CSV |
| Open Overview Total Revenue | Imported contribution appears once and combines with independently selected native revenue | Exact CSV contribution is included in `$72,766.69` Total Revenue; foreground mutation invalidates immediately | Passed for current CSV |
| Profit / ROAS / ROI | Recompute from the same Total Revenue after source mutation | Shared release-candidate Overview formulas consume the reconciled total and preserve valid-zero semantics | Passed inside exact Overview boundary |
| CPA | Must not change from revenue-only mutation except through unrelated inputs | Revenue does not supply conversions; CPA uses conversions paired with native financial revenue | Structurally guarded inside exact Overview boundary |
| Revenue Sources modal/list | Shows the target source once with exact amount and removes it after delete | Exact CSV source appears once at $600; bounded add/edit/delete packets preserve unrelated sources | Passed for current CSV |
| Scheduler refresh | Same Google Sheets source ID atomically replaces records and converges to endpoints/UI | Scheduler fetches and validates before exact-source transaction; no Google Sheets Revenue source is configured in the release-candidate target | Future Google Sheets gate |
| KPI / Benchmark / notifications | Exact imported-revenue contribution enters shared current-value inputs once | Whole-Overview deterministic propagation uses the same imported total; separate tab/notification certifications are not implied | Passed as Overview input propagation |
| Reports / PDF / email | Browser Overview output uses the exact source-backed value; scheduled delivery is separate | Browser Overview report parity passed; scheduled PDF/email delivery is excluded | Browser passed; scheduled excluded |
| Campaign DeepDive / aggregate consumers | Source-backed imported revenue remains scoped and reconciled | Exact current imported total feeds the guarded aggregate packet without cross-context substitution | Passed as Overview input propagation |

## Lifecycle Matrix

| Lifecycle path | Google Sheets Revenue | Upload CSV Revenue | Required closure |
| --- | --- | --- | --- |
| Add/import | Deployed chooser/API uses campaign/type/context validation and one additive source/record transaction; no source is configured in the target | Exact current source plus bounded add packet; source and records share one scoped transaction | CSV passed; future Google Sheets provider packet required |
| Edit/update | Explicit stable source ID is rechecked and source metadata/records replace atomically | Active campaign-owned GA4 CSV source update and records share the same transaction | CSV passed; future Google Sheets provider packet required |
| Refresh/reprocess | Scheduler validates provider rows then atomically replaces the same source ID | No provider scheduler; edit/re-upload or stored-row processing is the applicable reprocess path | CSV applicability closed; generalized future Google Sheets timing remains excluded |
| Delete/deactivate | Shared exact-source route is transactional and campaign/context scoped | Same shared exact-source transaction and bounded deployed confirmation | Covered for current/bounded paths; future source instances require fresh validation |
| Source modal/list | Current chooser is deployed; future source list uses materialized amounts | Exact current CSV source/list/to-date parity passed | CSV passed; future Google Sheets source excluded |
| Totals/recomputation | Active joins, exact-source replacement, immediate mutation invalidation, and bounded recompute | Exact CSV amount reconciles through imported and Total Revenue | Passed for current CSV |
| Validation failure | GA4 role/date/row/currency guards fail before foreground or scheduler source/record mutation | GA4 role/date/row/currency guards fail before mutation | Deterministically guarded; unsafe production failure injection not required |
| Rollback | Source metadata and records commit in one transaction; forced failure retains last-good state | Same scoped transaction and rollback behavior | Locally proven transaction contract; current CSV persistence reconciled |
| Damaged-data risk | Exact-source transaction prevents partial replacement; read-only inventory reports suspicious states without cleanup | Current CSV target inventory is clean for active-source/materialization/currency scope | No cleanup authorized; rerun after relevant boundary changes |

## Negative-Case Matrix

| Negative case | Google Sheets Revenue | Upload CSV Revenue | Current status |
| --- | --- | --- | --- |
| Inaccessible campaign | Campaign access checks traced | Campaign access middleware traced | Fails closed on both current paths |
| Wrong/missing source ID on edit | Active campaign/context/type match required inside the transaction | Active campaign/context/type match required inside the transaction | Fails closed before replacement |
| Wrong source family | Requires `google_sheets` target | Requires `csv` target | Fails closed before replacement |
| Missing/invalid connection or provider auth | Provider failure returns before the exact-source transaction | Not applicable | Last-good Google Sheets rows are retained; future live provider packet excluded |
| Missing Revenue column | Shared mapping requires it for GA4 | Shared mapping requires it for GA4 | Rejected before mutation |
| Revenue column equals Campaign column | Rejected before foreground or scheduler source/record transaction | Rejected before mutation | Rejected before mutation |
| Date column equals Revenue/Campaign column | Filtered/cleared in UI and rejected before foreground or scheduler transaction | Filtered/cleared in UI and rejected by server before mutation | Rejected before mutation |
| Non-date Date column | Sampled non-date columns are hidden; forged invalid values fail before foreground or scheduler transaction | Sampled non-date columns are hidden; forged invalid values are rejected before mutation | Deterministic fixtures pass; future provider shapes excluded |
| Blank/invalid date among positive rows | Whole GA4 request fails before foreground or scheduler transaction | Whole GA4 CSV request is rejected before mutation | Last-good state retained |
| No positive selected rows | Rejected before foreground or scheduler transaction | Rejected before mutation | Last-good state retained |
| Mixed valid/invalid dated rows | Whole GA4 request fails before foreground or scheduler transaction | Whole GA4 CSV request is rejected before mutation | Last-good state retained |
| Record insert failure | Exact-source transaction rolls back metadata and records | Forced add/edit insertion failures roll back source and records | Transaction contract proven; unsafe production injection not required |
| Source metadata update failure | Exact-source transaction rolls back metadata and records | Source update/create and record replacement share one transaction | Transaction contract proven |
| Repeated identical refresh | Exact-source replacement removes the prior materialization and inserts one replacement set in the same transaction | Reprocess replaces the same source rows | Stable identity/no-append contract proven |
| Concurrent refresh/edit/delete | Transaction rechecks active campaign/context/type source identity before replacement | Same scoped transaction guard | Conflicting/stale target fails closed |
| Delete failure between writes | Forced record-delete failure rolls back source deactivation | Same shared transaction | Transaction rollback contract proven; unsafe production injection not required |
| Unrelated source mutation | Transaction scope preserves unrelated source and cross-campaign rows | Same shared transaction | Current CSV and historical Google Sheets packets preserve unrelated sources |

## Regression Plan For Future Boundary Changes

Retain and rerun source-specific automation before certifying a future Google Sheets Revenue source, a new CSV variant, or any relevant dependency change:

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

Historical Current Commits 2 and 3 deployed UI validation on `2026-07-12`: the user confirmed the normal browser flow passed after deployment. No exact campaign/property, file identity, mapping, source ID, record count, before/after amount, or injected-failure output was supplied for that packet. The later exact current CSV source/amount/USD/Total Revenue reconciliation supplements, but does not rewrite, this bounded historical record.

Current Commit 4 local validation on `2026-07-12`: the focused test passed 5/5; the adjacent eight-file revenue/scheduler/UI packet passed 98/98; `npm run check` passed. Provider calls, deployed UI behavior, and transaction rollback were not exercised.

Current Commit 7 local validation on `2026-07-12`: the focused transaction/lifecycle/Shopify packet passed 3 files and 29/29 tests; the adjacent nine-file Revenue lifecycle/UI/calculation packet passed 110/110; `npm run check` passed. The exact individual-delete assertions also passed inside the broader source-safety and HubSpot files. Those broad files still contain seven pre-existing unrelated Instagram failures and two pre-existing unrelated HubSpot formatting/helper assertions respectively; they are not Current Commit 7 failures.

Current Commit 7 deployed UI validation on `2026-07-12`: the user confirmed the normal browser deletion flow passed after deployment. The requested validation boundary was source removal persisting after reload, the expected Total Revenue decrease, and preservation of unrelated revenue sources. No raw numeric/source-ID packet or forced database failure was supplied, so this records user-confirmed normal UI behavior only and does not replace the local rollback tests.

Current Commit 8 CSV-only local validation on `2026-07-12`: the focused downstream propagation test passed 6/6; the adjacent ten-file CSV lifecycle/cross-tab/UI/financial-math packet passed 204/204; `npm run check` passed. No production runtime code changed. Google Sheets Revenue coverage was explicitly excluded and remains on hold.

Current Commit 9 CSV-only validation on `2026-07-12`: the focused inventory test passed 4/4; the adjacent six-file CSV lifecycle/source-inventory packet passed 29/29; `npm run check` passed. The configured target-database read-only scan completed at `2026-07-12T10:49:40.451Z` and returned 4 campaigns, 22 GA4 CSV sources, 21 linked records, and 5 finding groups. All 5 groups were inactive sources retaining 17 records; no active or reconciliation finding was returned. No cleanup path was added and no data was mutated.

Current Commit 10 local validation on `2026-07-12`: `node --check client/public/ga4-overview-validation-runner.js` passed; the focused/adjacent six-file CSV validation packet passed 25/25; `npm run check` passed. Only static browser validation support, focused regression coverage, and documentation changed. These local results alone claim no deployed lifecycle evidence; the later bounded UI confirmation is recorded separately below.

Current Commit 10 deployed UI validation on `2026-07-12`: the user confirmed the normal documented CSV lifecycle passed after deployment. The `Alpha` add showed `$150`; the same source changed to `$1,250` for `Alpha + Beta`, returned to `$150` for `Alpha`, never duplicated, then disappeared on delete. Total Revenue returned to its original value and Total Spend remained unchanged. The user subsequently confirmed the invalid CSV test passed: an error appeared, no revenue source was created, and Total Revenue and Total Spend remained unchanged. No browser-runner output, campaign/property/source IDs, endpoint-parity output, or exact deployed Profit/ROAS/ROI/CPA values were supplied; those items are not claimed as deployed evidence.

Current Commit 12 final CSV-only rerun on `2026-07-12`: the end-to-end CSV path was retraced from the GA4 Revenue wizard mapping and campaign-guarded process route through fail-before-mutation validation, campaign/type/context-scoped transactional source-and-record replacement, active-source to-date/breakdown/source-list reads, derived financial recomputation, read-only damage inventory, and transactional exact-source deletion. The bounded eight-file packet passed 44/44, `node --check client/public/ga4-overview-validation-runner.js` passed, and `npm run check` passed. The attempted broader nine-file packet passed 50/51; the sole failure was outside CSV Revenue in `server/campaign-financial-analysis-regression.test.ts`, whose static expected platform-spend expression omits the current `custom?.spend` term. The refreshed target-database scan at `2026-07-12T11:40:50.064Z` covered 4 campaigns, 23 GA4 CSV sources, and 21 linked records. It returned the same five known inactive-source record groups and no active-source, mapping, total, date, duplicate-row, orphan, cross-campaign, or wrong-type finding. Compared with Current Commit 9, one additional inactive zero-record CSV source is consistent with the validated create/delete lifecycle and does not feed live totals. No cleanup was applied or warranted. After the commit, the user confirmed the deployed invalid-file no-mutation test passed. Historical decision at that revision: Upload CSV Revenue was clean-certified for the validated documented scope; Google Sheets Revenue was on hold. Current Commit 21 supersedes only that hold.

## Current Commit Queue

Use isolated commits in this order:

| Current Commit | Scope | Status / gate |
| --- | --- | --- |
| 1 | This documentation baseline | Documentation-only baseline; does not certify runtime behavior |
| 2 | CSV Revenue deterministic mapping/date/row validation | Implemented, locally validated, and normal UI flow user-confirmed; deployed negative cases remain Current Commit 10 evidence |
| 3 | CSV Revenue transactional add/edit replacement | Implemented, locally validated, and normal UI flow user-confirmed; deployed stable-source replacement remains Current Commit 10 evidence; forced database failure remains local rollback evidence because the normal UI has no safe failure-injection control |
| 4 | Google Sheets Revenue deterministic mapping/date/row validation | Implemented and locally validated; deployed/provider negatives remain Current Commit 11 evidence |
| 5 | Google Sheets Revenue transactional manual/scheduler replacement | Atomic replacement implemented; deployed provider-failure packet open |
| 6 | Bounded Google Sheets Revenue-only polling and Overview revenue refetch | Open; current automatic refresh is daily and Overview refetch is ten minutes |
| 7 | Transactional revenue source delete | Implemented, locally validated, and normal deployed UI flow user-confirmed for the current shared individual-source route |
| 8 | Google Sheets/CSV Revenue-specific downstream propagation automation | CSV portion implemented and validated; Google Sheets portion open |
| 9 | Read-only damaged-data inventory | CSV scan complete; Google Sheets-specific inventory open; no cleanup applied |
| 10 | Deployed CSV lifecycle/reconciliation evidence | Normal add/repeated-edit/delete lifecycle and invalid-file no-mutation user-confirmed; console-runner, source-ID, endpoint-parity, and exact deployed derived-card packets were not supplied and are excluded from the claim |
| 11 | Deployed Google Sheets automatic mutation/failure/OAuth durability evidence | Resumed; open |
| 12 | Final certification rerun and documentation update | CSV-only rerun completed and final invalid-file confirmation received; Upload CSV Revenue clean-certified for the validated documented scope; Google Sheets certification remains open |

## Proven Locally

- The frontend calls the Revenue CSV and Google Sheets preview/process routes and refetches imported revenue queries after a successful user mutation.
- Both process routes enforce campaign access and validate a shared revenue mapping envelope.
- Edit targets are checked against the campaign and expected source type/context.
- Google Sheets add mode is additive; edit/refresh mode uses a stable source ID.
- CSV has no independent provider scheduler path; Google Sheets Revenue participates in the daily external refresh path.
- Storage totals and breakdowns join revenue records to active campaign/context revenue sources.
- The individual delete route resolves a campaign-owned active source and checks the requested context before mutation.
- The open Overview imported revenue-to-date, sources, and breakdown queries currently refetch every ten minutes.
- GA4 CSV Revenue and GA4 Google Sheets Revenue foreground add/edit source-and-record replacement use the scoped transaction helper; Whole-Overview Commit 17 also routes Google Sheets scheduler replacement through that helper.
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

Google Sheets inventory, connection metadata, scheduler metadata, and `lastSyncedAt` checks remain open and are not Current Commit 9 CSV evidence.

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

## Future Google Sheets Provider/Deployed Validation Gates

Whole-Overview Current Commit 5 (`5da5f41c`) historically hid new GA4 Google Sheets Revenue setup. Current Commit 21 superseded that temporary policy and deployed the restored chooser/API path without changing saved production data. Because no Google Sheets Revenue source is configured in the release-candidate target, the gates below apply to a future source and do not block the current Overview release-candidate decision.

For a future source-family certification:

- CSV: follow `GA4/OVERVIEW_VALIDATION_RUNNER.md` Current Commit 10 procedure and capture exact campaign/property, durable fixture identity, headers, role mappings, selected campaign values, Date mode, source ID/count, target amount, to-date, breakdown, inventory, Total Revenue, Profit, ROAS, ROI, CPA, and unrelated-source values before and after invalid import, add, two same-source edits, and delete.
- Google Sheets: capture exact campaign/property, source/connection/spreadsheet/tab identity, non-secret mapping, selected campaign values, Date mode, before values, one controlled sheet mutation, automatic processing without run-now or reload, elapsed timing, stable source ID, exact delta, record/source/to-date/breakdown/Overview/formula parity, and unrelated-source stability.
- Google Sheets provider/materialization failure retention remains a separate provider gate. CSV forced database insertion failure is locally transaction-tested; the deployed UI has no safe failure-injection control, and no unsafe control should be added merely to manufacture browser evidence.
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

Current Commit 12 completed the CSV-only rerun, and the later user-confirmed invalid-file no-mutation result closes the applicable Current Commit 10 deployed UI gate for the bounded CSV claim. At historical runtime `8ba694060411a2a05663a4915652767e4e3ba713`, the CSV source retained exact ID `d4421cb9-8298-4d96-8697-c82ef5f0b7b5`, `$600`, USD source/record parity, and inclusion in imported revenue `$16,799.99` and Total Revenue `$69,332.69`. The certified `12789c1e` whole-Overview boundary retains that exact `$600` source contribution inside current Total Revenue `$72,766.69`. Google Sheets Current Commit 11 remains outside the current configured-source certification.

Any new defect immediately lowers the affected source/path to unproven until root cause, query shape, ordering, limits, merge keys, fallback behavior, downstream propagation, negative cases, and deployed evidence are re-established.

## Stable Response For Future Chats

Use only when the question is limited to GA4 Overview Google Sheets Revenue and Upload CSV Revenue:

Upload CSV Revenue is clean-certified for the validated documented scope. The evidence includes deterministic fail-before-mutation validation, transactional add/edit/delete, local downstream propagation, refreshed target inventory with no active/reconciliation damage, deployed `$150` / `$1,250` / `$150` add/repeated-edit/delete behavior without duplicates, Revenue baseline restoration, unchanged Spend, and user-confirmed invalid-file error/no-source/no-metric-change behavior. Console-runner output, raw source IDs, exact deployed Profit/ROAS/ROI/CPA values, unlisted CSV shapes, and future code/data changes are not claimed without fresh evidence. Google Sheets Revenue is re-enabled but not clean-certified. Spend and all other source families are excluded as proof.
