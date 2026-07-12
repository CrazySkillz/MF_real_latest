# GA4 Overview Revenue Production Readiness

## Mandatory Anti-Overclaim Rule

Apply `AGENTS.md`, `ARCHITECTURE_USER_JOURNEY.md`, `PRODUCTION_READINESS.md`, `GA4/README.md`, `GA4_DEVELOPMENT_WORKFLOW.md`, `GA4/OVERVIEW.md`, `GA4/OVERVIEW_PRODUCTION_READINESS.md`, `GA4/FINANCIAL_SOURCES.md`, and `GA4/REFRESH_AND_PROCESSING.md` before using this file as readiness evidence.

A previous production-ready statement is not evidence. A passing test suite is not evidence for a path the tests do not cover. Historical packets retain their exact campaign, property, source, mapping, date, value, and validation boundaries. Do not generalize them to another file, mapping, campaign, scheduler run, provider condition, downstream consumer, or negative case.

This file accepts only evidence independently traced for Google Sheets Revenue or Upload CSV Revenue. Spend, Shopify, HubSpot, Salesforce, GA4-native revenue, Meta, LinkedIn, Google Ads, Manual revenue, KPI, Benchmark, Reports, and every other source family are not substitute proof. A downstream consumer is evidence only when the value path from the named Google Sheets or CSV revenue source is explicitly traced to that consumer.

Neither Google Sheets Revenue nor Upload CSV Revenue is clean-certified by this commit.

## Purpose

This is the component readiness file for GA4 Overview imported revenue from:

- Google Sheets Revenue
- Upload CSV Revenue

It separates these two source families from whole-Overview and spend certification. It records the current implementation, historical bounded evidence, known destructive boundaries, missing negative cases, and the work required before either source can receive a clean-certification claim.

## Current Status

- **Google Sheets Revenue is not clean-certified.** Current Commit 4 locally closes the tested GA4 deterministic mapping/date/row validation boundary for foreground and scheduler reprocessing. Add/edit and scheduler replacement remain non-transactional, automatic updates rely on the daily external refresh path rather than bounded source-family polling, open Overview revenue queries refetch only every ten minutes, and deployed provider/failure/idempotency evidence is incomplete.
- **Upload CSV Revenue is not clean-certified.** Current Commit 2 locally closes the tested deterministic validation boundary. Current Commit 3 commits GA4 CSV source metadata and replacement records in one campaign/type/context-scoped transaction, with forced add/edit insertion-failure rollback tests. The user confirmed the deployed normal UI flow passed after Commits 2 and 3, but no exact numeric/source-ID or forced-failure packet was recorded; deployed negative/failure evidence and complete downstream propagation remain unproven.
- Current Commit 1 was documentation only. Current Commits 2 through 4 are bounded source fixes and do not certify either source.

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
- Revenue source delete first verifies campaign ownership and optional platform context, but source deactivation and record deletion are separate writes. A failure between them can leave a deactivated source with records or an incomplete cleanup result.
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
| Revenue source list | Active sources enriched with lifetime breakdown amounts | `/revenue-sources`, Revenue Sources modal | Local route/query is traced; damaged/orphan inventory is unproven. |
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
| Delete/deactivate | Shared ownership/context guard applies; deactivation and record deletion are separate writes | Same shared route and same non-atomic boundary | Transactional exact-source delete plus unrelated-source preservation |
| Source modal/list | Active source/list queries and historical UI packets traced | Active source/list queries and historical UI packets traced | Automated source-specific add/edit/delete provenance parity |
| Totals/recomputation | Storage active joins and immediate user-mutation refetch traced; external refetch is ten minutes | Same totals path and immediate user-mutation refetch | Exact record/source/to-date/breakdown/Overview/formula parity |
| Validation failure | GA4 role/date/row guards now fail before foreground or scheduler revenue source/record mutation for the local fixtures | GA4 role/date/row guards now fail before mutation for the local fixtures | Deployed negative/provider packets remain required |
| Rollback | No transaction restores old source metadata/records after materialization failure | No transaction restores old source metadata/records after materialization failure | Forced-failure tests proving last valid value retention |
| Damaged-data risk | Orphan records, active zero-record sources, partial replacement, duplicate records, and stale mapping metadata are possible | Same, plus incomplete stored rows and date-loss mismatches | Read-only inventory by campaign/source ID before any cleanup |

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
| Delete failure between writes | Deactivated source and remaining records possible | Same | Unproven |
| Unrelated source mutation | Historical packets preserved one named CSV/GS counterpart | Historical packets preserved named counterpart | Bounded historical evidence only |

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

Current Commit 2 local validation on `2026-07-12`: the focused test passed 5/5; the adjacent seven-file packet passed 100/100; `npm run check` passed. The broad source-safety file passed all 80 non-Instagram assertions, including the CSV Revenue guard, and failed its seven unrelated Instagram assertions. These results are local code evidence only.

Current Commit 3 local validation on `2026-07-12`: the focused validation/rollback packet passed 2 files and 10/10 tests; the adjacent eight-file packet passed 105/105; `npm run check` passed. Forced failures use a transactional mock and do not substitute for deployed PostgreSQL evidence.

Current Commits 2 and 3 deployed UI validation on `2026-07-12`: the user confirmed the normal browser flow passed after deployment. No exact campaign/property, file identity, mapping, source ID, record count, before/after amount, or injected-failure output was supplied for this documentation packet. This confirms only the user-observed normal UI flow; forged-request rejection, rollback under forced failure, exact reconciliation, and unrelated-source preservation remain bounded to local automation or unproven deployed evidence as stated above.

Current Commit 4 local validation on `2026-07-12`: the focused test passed 5/5; the adjacent eight-file revenue/scheduler/UI packet passed 98/98; `npm run check` passed. Provider calls, deployed UI behavior, and transaction rollback were not exercised.

## Current Commit Queue

Use isolated commits in this order:

| Current Commit | Scope | Status / gate |
| --- | --- | --- |
| 1 | This documentation baseline | Documentation-only baseline; does not certify runtime behavior |
| 2 | CSV Revenue deterministic mapping/date/row validation | Implemented, locally validated, and normal UI flow user-confirmed; deployed negative cases remain Current Commit 10 evidence |
| 3 | CSV Revenue transactional add/edit replacement | Implemented, locally validated, and normal UI flow user-confirmed; deployed forced-failure retention remains Current Commit 10 evidence |
| 4 | Google Sheets Revenue deterministic mapping/date/row validation | Implemented and locally validated; deployed/provider negatives remain Current Commit 11 evidence |
| 5 | Google Sheets Revenue transactional manual/scheduler replacement | Next |
| 6 | Bounded Google Sheets Revenue-only polling and Overview revenue refetch | Pending |
| 7 | Transactional revenue source delete | Pending |
| 8 | Google Sheets/CSV Revenue-specific downstream propagation automation | Pending fixes above |
| 9 | Read-only damaged-data inventory | Pending; no cleanup in this commit |
| 10 | Deployed CSV lifecycle/reconciliation evidence | Pending automated gates and deployment |
| 11 | Deployed Google Sheets automatic mutation/failure/OAuth durability evidence | Pending automated gates, deployment, and provider access |
| 12 | Final certification rerun and documentation update | Blocking final gate; do not pre-write the result |

## Proven Locally

- The frontend calls the Revenue CSV and Google Sheets preview/process routes and refetches imported revenue queries after a successful user mutation.
- Both process routes enforce campaign access and validate a shared revenue mapping envelope.
- Edit targets are checked against the campaign and expected source type/context.
- Google Sheets add mode is additive; edit/refresh mode uses a stable source ID.
- CSV has no independent provider scheduler path; Google Sheets Revenue participates in the daily external refresh path.
- Storage totals and breakdowns join revenue records to active campaign/context revenue sources.
- The individual delete route resolves a campaign-owned active source and checks the requested context before mutation.
- The open Overview imported revenue-to-date, sources, and breakdown queries currently refetch every ten minutes.
- GA4 CSV Revenue add/edit source and record replacement is transactional; Google Sheets replacement and shared source delete remain non-transactional.
- GA4 CSV Revenue Date choices now exclude the selected Revenue/Campaign roles and sampled non-date columns; stale invalid Date selections are cleared.
- The GA4 CSV Revenue server path rejects role collisions, empty/no-positive selections, and blank/invalid/numeric dated positive rows before source mutation.
- GA4 CSV Revenue add/edit now scopes source update/create, exact-source record deletion, and replacement insertion to one database transaction; forced add/edit insertion failures retain the last valid state locally.
- The GA4 Google Sheets Revenue Date chooser excludes selected role columns and sampled non-date columns, and clears stale invalid Date selections.
- GA4 Google Sheets Revenue foreground and scheduler paths reject role collisions, empty/no-positive selections, and blank/invalid/numeric dated positive rows before source or record mutation.

## Partially Proven

- Historical add/edit/delete endpoint and UI reconciliation for the exact CSV sources, campaign, property, amounts, and timestamps recorded above.
- Historical Google Sheets add/edit/run-now/delete reconciliation for the exact sources, campaign, property, amounts, and timestamps recorded above.
- Stable source identity and preservation of the specifically named counterpart source within those packets.
- Immediate query refresh after a successful foreground source mutation.
- Daily scheduler wiring for active Google Sheets Revenue sources.

## Unproven

- Clean certification for either source.
- Deployed CSV Revenue negative-case behavior and unusual/unlisted file, header, date, and mapping shapes beyond the local fixtures.
- Deployed/provider proof of Google Sheets Revenue fail-before-mutation behavior and unusual/unlisted sheet, tab, header, mapping, filter, and date shapes beyond the local fixtures.
- Atomic Google Sheets add/edit/scheduler replacement and shared revenue source delete behavior.
- Deployed PostgreSQL proof of GA4 CSV add/edit rollback and last-valid-value retention.
- Google Sheets last-valid-value retention after provider, source-update, record-delete, or record-insert failure.
- Repeated-refresh idempotency and concurrent operation safety.
- Bounded Google Sheets Revenue-only automatic polling and already-open Overview convergence within the intended low-latency window.
- Exact automatic Google Sheets provider mutation propagation through source, records, endpoints, Overview, and every claimed downstream consumer.
- Complete source-specific propagation for CSV Revenue.
- Unlisted files, delimiters, encodings, duplicate headers, locale numbers, ambiguous dates, large-file boundaries, sheets, tabs, mappings, filters, campaigns, properties, and currencies.
- Production data health outside an exact read-only inventory.

## Not Locally Verifiable

- Live Google Sheets contents, permissions, API availability, provider latency, quota behavior, OAuth consent state, refresh-token renewal, revocation, and durability beyond the observed period.
- Deployed scheduler execution at the configured time and future low-latency timer execution.
- Production database contents and damaged rows without an authorized read-only inventory.
- Browser rendering and already-open-page convergence under deployed runtime conditions.
- Provider acceptance, generated artifact content, or delivery for any downstream report/email path unless separately captured.
- Future provider, infrastructure, database, or code behavior.

## Damaged-Data Inventory And Cleanup Boundary

Prior non-transactional behavior may have persisted damaged or ambiguous state. The read-only inventory must check, by campaign and source ID:

- active Google Sheets/CSV sources with zero records or zero materialized total despite a positive saved/expected mapping total;
- inactive sources that still retain records;
- records whose source is missing, belongs to another campaign, or has the wrong source type/context;
- duplicate active sources or duplicated daily records created by repeated attempts;
- source mapping totals that differ from materialized lifetime totals;
- dated mappings where stored selected positive rows include blank/invalid dates or where persisted daily totals omit those rows;
- CSV mapping configs missing complete stored rows/headers/role metadata needed for a safe edit;
- Google Sheets sources missing stable connection, spreadsheet, tab, Revenue column, campaign filter, or Date mapping metadata;
- stale `lastSyncedAt` or source metadata inconsistent with the last valid record set.

Inventory is read-only Current Commit 9. Do not deactivate, delete, merge, rewrite, backfill, or invent dates/allocations during inventory. Any cleanup requires a separate targeted plan listing exact campaign IDs, source IDs, record IDs/counts, the proven damage rule, expected before/after totals, rollback, and unrelated-source checks.

## External Provider/Deployed Validation Gates

After the automated gates pass and the fixes are deployed:

- CSV: capture exact campaign/property, file hash or durable fixture identity, headers, role mappings, selected campaign values, Date mode, source IDs, source/record counts, to-date, breakdown, Overview, formula values, and unrelated-source values before and after invalid import, add, same-source edit, repeated edit, and delete.
- Google Sheets: capture exact campaign/property, source/connection/spreadsheet/tab identity, non-secret mapping, selected campaign values, Date mode, before values, one controlled sheet mutation, automatic processing without run-now or reload, elapsed timing, stable source ID, exact delta, record/source/to-date/breakdown/Overview/formula parity, and unrelated-source stability.
- Force a provider or materialization failure after a previously valid value and prove the prior source metadata and records remain unchanged.
- Prove repeated automatic refresh produces no duplicate source or records and no total drift.
- Prove OAuth renewal/durability and reconnect behavior without treating a manual repaired run as automatic durability evidence.
- Record each packet independently. Do not combine a CSV action, Google Sheets action, another source family, or downstream artifact into one ambiguous pass.

## Certification Gate

Neither source may be called clean-certified until:

- Current Commits 2 through 9 are implemented and their focused automated suites pass;
- Current Commits 10 and 11 produce bounded deployed packets satisfying the gates above;
- the complete value, lifecycle, negative-case, rollback, damaged-data, automatic-timing, and downstream matrices contain no assumed or merely sampled path inside the requested claim;
- no open source-specific defect can lose, duplicate, silently omit, misdate, broaden, or stale the revenue value;
- production inventory findings are either clean or resolved by a separately proven cleanup;
- Current Commit 12 reruns the full certification evidence and updates this document without importing evidence from excluded source families.

Any new defect immediately lowers the affected source/path to unproven until root cause, query shape, ordering, limits, merge keys, fallback behavior, downstream propagation, negative cases, and deployed evidence are re-established.

## Stable Response For Future Chats

Use only when the question is limited to GA4 Overview Google Sheets Revenue and Upload CSV Revenue:

Google Sheets Revenue and Upload CSV Revenue are not yet clean-certified. Current Commits 2 and 3 have local automation plus user-confirmed normal CSV browser-flow validation, without an exact numeric/source-ID or forced-failure deployed packet. Current Commit 4 locally closes the tested GA4 Google Sheets deterministic role/date/row validation boundary in foreground and scheduler paths. Remaining blockers include deployed CSV negative/failure evidence, Google Sheets transactional replacement and deployed/provider evidence, missing bounded Google Sheets Revenue-only polling, ten-minute open-Overview revenue refetch, shared delete transactionality, incomplete idempotency tests, incomplete damaged-data inventory, and incomplete source-specific downstream/deployed evidence. Spend and all other source families are excluded as proof. The exact next task is Current Commit 5 — Google Sheets Revenue transactional manual/scheduler replacement.
