# GA4 Overview Spend Validation Packet — 2026-09-13

## Decision

**Overall clean-certification status: CLEAN-CERTIFIED — BOUNDED TO GA4 OVERVIEW GOOGLE SHEETS SPEND AND CSV SPEND.**

The Spend release candidate passes its focused automated, type-check, and production-build gates. Production runtime SHA `cc2273c560b41c21c6b6fc19f77f4261e7bc2667` passes read-only inventory, reconciliation, access control, isolated source lifecycles, a Google Sheets provider-transport failure with exact last-good preservation, a value-changing natural Sheets refresh, CSV manual replacement, and exact downstream KPI/Benchmark/alert/snapshot/report/PDF propagation. The accepted run restored Campaign2 exactly, and an independent read-only postflight confirmed the restoration.

This packet does not revoke, reopen, overwrite, invalidate, or recertify any earlier certification. Existing Revenue implementations were consulted only as architectural patterns; no Revenue implementation, Revenue test contract, Revenue evidence, or existing certificate was changed or counted as Spend evidence. `GA4/certifications/ga4-overview.json`, `GA4/OVERVIEW_PRODUCTION_READINESS.md`, and `GA4/OVERVIEW_SPEND_PRODUCTION_READINESS.md` remain unchanged.

**Google Ads: NOT CONFIGURED / EXCLUDED.** No Google Ads route, implementation, source, data, or dedicated test was tested or modified, and this packet makes no Google Ads readiness claim.

## Exact Scope

Included:

- GA4 Overview Google Sheets Spend
- GA4 Overview Upload CSV Spend
- add, edit, delete, and source-list paths
- Total Spend and source-count reconciliation
- currency, dates, stable identity, ownership, and campaign isolation
- transactional source/record replacement and bounded duplicate prevention
- Google Sheets automatic refresh and last-good-data guards
- CSV manual-refresh-only behavior
- downstream propagation of the canonical Spend value

Excluded:

- all Google Ads behavior and readiness
- all Revenue readiness and Revenue evidence
- modification or recertification of any protected implementation, test contract, readiness document, or certificate
- writing or changing an external Google Sheet cell (the configured product OAuth scope is read-only)
- production add/edit/delete mutation of the currently retained sources
- production UI pixel/layout certification

## Complete Existing Flow Trace

1. `client/src/components/AddSpendWizardModal.tsx` previews and maps CSV or Google Sheets data. Add mode submits no source ID; edit/manual refresh submits the retained source ID. CSV refresh is user-triggered only.
2. `server/routes-oauth.ts` authenticates the caller, verifies campaign access, validates the selected connection/mapping/data, creates exact daily or snapshot records, and calls the existing storage replacement methods.
3. `server/storage.ts` owns source and record persistence. Reads and deletes are campaign-, active-source-, source-ID-, and platform-context-scoped. Replacement occurs in one database transaction.
4. The GA4 Overview reads the active GA4 source list, spend-to-date value, and spend breakdown. The read path uses the completed reporting-day boundary and requires one campaign currency.
5. `client/src/pages/ga4-metrics.tsx` reconciles the source-backed breakdown into Total Spend and the Spend Sources modal, and invalidates/refetches affected campaign queries after mutations.
6. Google Sheets automatic refresh runs through `server/auto-refresh-scheduler.ts`, which reuses the same Sheets process/replacement path with the existing source ID. CSV has no scheduler path and changes only through a manual process request.
7. The canonical GA4 Spend value is consumed by `server/ga4-kpi-benchmark-jobs.ts`, `server/campaign-current-values.ts`, alert current-value resolution, report snapshot generation, scheduled PDF generation, and GA4 report/summary consumers.

## Confirmed Root Causes Before Editing

These are confirmed code-path defects. They are not represented as proof that every defect had already produced a deployed incident.

1. CSV and Google Sheets requests could supply a GA4 currency different from the owning campaign. That value could be persisted and subsequently make scoped reads fail the single-currency contract.
2. Google Sheets refresh trusted saved mapped header names without proving that each still existed exactly once. A renamed, missing, or duplicated Spend/Date/Campaign header could reach aggregation and replace last-good records with misleading output, including a zero snapshot.
3. Server validation did not completely reject selected campaign values without a campaign column or a Spend/Campaign role collision. The Sheets UI also exposed already-selected role columns as conflicting choices.
4. A legacy Google Sheets Spend source with null platform context could be passed by the scheduler as undefined context and enter a different, non-GA4 process branch, even though legacy null is read as GA4 elsewhere.
5. CSV edit replacement checked campaign/type/active state but not the requested platform context at transaction time, and its record deletion predicate did not independently include campaign ID.

## Smallest Safe Corrections

- `server/routes-oauth.ts`: fail closed before mutation for GA4 currency mismatch, campaign-filter asymmetry, duplicate mapping roles, and missing/duplicated saved Sheets headers. GA4 records use the campaign currency.
- `server/storage.ts`: bind CSV edit replacement to campaign, source type, active state, and platform context inside the transaction; bind record replacement to both source ID and campaign ID.
- `server/auto-refresh-scheduler.ts`: normalize only legacy missing Spend context to `ga4` before invoking the unchanged source refresh path.
- `client/src/components/AddSpendWizardModal.tsx`: remove already-selected Spend, Date, and Campaign columns from conflicting Google Sheets role selectors.
- New Spend-only tests cover the corrected route/storage/scheduler/UI contracts, transaction rollback and stable identity, and deterministic downstream Spend propagation.
- A new read-only production validator inventories and reconciles only CSV/Google Sheets Spend, access boundaries, integrity, and natural refresh behavior.

The runtime correction commit did not delete or rewrite a production source or mutate a production business row. The later authorized validation changed only disposable Campaign2 fixtures and restored them as documented below. No dependency, schema, response shape, field meaning, architecture, Revenue implementation, or Google Ads implementation changed.

## Evidence Matrix

| Requirement | Current evidence | Status / boundary |
| --- | --- | --- |
| Add | Add-mode transactional rollback is runtime-tested for Google Sheets; CSV add follows the same tested transaction and existing add branch. Historical production evidence is not reused as current-revision proof. | Local release-candidate evidence; current-revision deployed add remains open. |
| Edit/manual replacement | Runtime transaction tests prove stable CSV source ID, same-campaign record replacement, and rollback; Sheets edit rollback is also proven. | Passed locally; deployed corrective revision remains open. |
| Delete | Exact route/storage trace proves access check plus campaign/source/context-scoped atomic source-and-record delete. No retained production source was deleted. | Code trace and protected neighboring contract; current-revision deployed delete remains open. |
| Source list | Production API returned the same four hashed source IDs as the breakdown, all in allowed source types. Local UI trace consumes that list/breakdown. | Production API passed; current UI was not pixel-certified. |
| Total/source count | Production source sum, breakdown sum, and spend-to-date were exactly `$2,759.75`; source count and breakdown count were both `4`. | Passed for the recorded target campaign and deployed SHA only. |
| Currency | Target campaign and all returned rows were `USD`; database scan found no mismatch. New routes fail before mutation with `SPEND_CURRENCY_MISMATCH`. | Production inventory plus local negative guard passed. |
| Dates | Completed reporting end was `2026-09-12`; database scan found no invalid stored Spend dates. CSV retains strict mapped-date validation before mutation. | Passed for current target data and local contract. |
| Stable identity | Source hashes remained unchanged across the natural-refresh observation. CSV edit and Sheets refresh reuse the exact source ID. | Passed within the tested/observed boundaries. |
| Ownership/isolation | Unauthenticated and cross-owner endpoint requests were denied. Database scan found `0` orphan, cross-campaign, or inactive-source records. | Passed for the recorded target and read paths. |
| Transactional replacement | CSV and Sheets rollback tests prove source/record changes roll back together. Storage predicates now include the exact campaign and context boundaries. | Passed locally. |
| Duplicate prevention | Target scan found `0` duplicate source/date rows and `0` duplicate active source signatures. Edit/refresh preserves identity rather than inserting a replacement source. | Passed within stable edit/refresh scope. Deliberate repeated add-mode imports remain additive by product design; no global uniqueness claim is made. |
| Sheets automatic refresh | Earlier evidence proved stable no-change refresh. The final strengthened Campaign2 packet then switched only the temporary source's selected provider campaign value; the natural scheduler fetched the existing provider sheet and changed that same source from `$180.20` to `$1,103.00` in `170` observed seconds. Total Spend changed by exactly `$922.80`, source count stayed `2`, source identity stayed stable, and CSV stayed unchanged. | Passed for the exact deployed scheduler/provider/mapping boundary. No generalized cadence SLA or external-cell-write claim. |
| Sheets last-good data | Provider/preview errors occur before replacement; new header/currency/role failures also occur before replacement; transaction failures roll back. The Campaign2 packet temporarily pointed only its disposable Spend connection at a nonexistent spreadsheet; the deployed refresh returned failure and preserved the exact source, records, totals, and downstream state, then succeeded after guarded restoration. | Passed locally and in the isolated deployed provider-transport boundary. |
| CSV manual refresh | Scheduler trace/test contains no CSV processing path. During Sheets automatic observation, all CSV mapping hashes remained unchanged. | Passed for architecture and observed non-participation. |
| Downstream Spend | Deterministic runtime tests propagate Spend `250` to ROAS `4`, ROI `300`, CPA `5`, and the performance summary's canonical Spend input. In Campaign2, deployed source totals of `$193.20`, `$1,116.00`, and `$2,116.00` produced exact persisted KPI/Benchmark CPA values of `$7.73`, `$44.64`, and `$84.64`; snapshot Benchmark values and generated report PDFs matched. A `$64.64` alert threshold created at `$44.64` and resolved at `$84.64`. | Passed for Google Sheets and CSV source changes through the deployed persisted consumers and shared scheduled-PDF builder. Scheduled email delivery was not invoked or claimed. |

## Production Read-Only Evidence

Exact deployed SHA verified: `a3b12e952488fe7760a3fb0faa3c7c9918bfc7e0`.

Target identifiers are represented only by hashes:

- campaign `fc734ddaf728`
- client `613d89abb175`
- owner `1900b95d7361`

Final zero-wait inventory on `2026-09-13`:

| Source hash | Type | Display label | Spend |
| --- | --- | --- | ---: |
| `a96b7317e082` | CSV | `spend.csv` | `$200.00` |
| `2101335b97a5` | CSV | `Test_rev_spend.csv` | `$550.00` |
| `33bfc32196d4` | CSV | `Test_spend_alpha.csv` | `$1,250.00` |
| `58aecd0c85fb` | Google Sheets | `Google Sheets` | `$759.75` |

Reconciliation and integrity:

- source count `4`; breakdown count `4`
- exact source/breakdown/to-date total `$2,759.75 USD`
- completed reporting end `2026-09-12`
- orphan records `0`
- cross-campaign records `0`
- inactive-source records `0`
- invalid dates `0`
- currency mismatches `0`
- duplicate source/date rows `0`
- duplicate active source signatures `0`
- unauthenticated access denied
- cross-owner access denied
- database transaction was read-only and rolled back

Automatic-refresh observation:

- Scheduler health reported the Google Sheets Spend timer enabled with a configured one-minute interval.
- The first bounded `100`-second observation did **not** see a completed refresh and was treated as a failed observation, not as success.
- A follow-up observation with a `180`-second ceiling saw the same retained Sheets source advance from `2026-09-13T19:26:36.446Z` to `2026-09-13T19:28:34.147Z`, detected `20` seconds after that observation began.
- The source IDs, count, exact total, and CSV mapping hashes remained stable. A final zero-wait inventory later saw the same Sheets source at `2026-09-13T19:33:33.842Z`.
- The connection record was `74` days old. This is connection-age evidence only, not proof of refresh-token age or automatic OAuth renewal.
- Because the provider amount did not change, this proves a successful natural refresh completion and stable replacement, not provider-value-change propagation.
- No `60`- or `75`-second completion SLA is claimed; the two recorded completed refresh timestamps were about `118` seconds apart.

The validator created a temporary authentication session solely to exercise protected GET endpoints, revoked it in `finally`, performed no business-data writes, and rolled back its read-only database transaction.

## Local Validation Evidence

Focused Spend and protected-neighbor regression run:

- `9` files passed
- `99` tests passed
- includes `14` new Spend-specific assertions and `85` existing neighboring assertions
- no Google Ads-specific test file was run

Passing files:

- `server/ga4-overview-spend-readiness.test.ts`
- `server/ga4-overview-spend-transaction.test.ts`
- `server/ga4-overview-spend-downstream.test.ts`
- `server/csv-spend-validation.test.ts`
- `server/spend-source-transaction.test.ts`
- `server/ga4-auto-refresh-regression.test.ts`
- `server/ga4-source-lifecycle-recompute-regression.test.ts`
- `server/ga4-spend-scope-regression.test.ts`
- `server/spend-and-template-gates.test.ts`

Additional gates:

- `npm run check`: passed
- `npm run build`: passed
- protected `server/google-sheets-aggregate-source.test.ts`: `10` passed and the same `2` pre-existing Revenue UI expectation failures remained; no new failure appeared, and neither the protected test nor Revenue implementation was modified

The broad aggregate-source file is not claimed as a passing suite. Its two failures are not Spend evidence and were not fixed, reopened, or invalidated.

## Authorized Campaign2 Lifecycle Evidence

Target: Campaign2 (`d9c8a3b7c4d0`), deployed SHA `f13238114b703119e93d4ae8006bc79284912994`, currency `USD`, reporting timezone `Europe/Amsterdam`, completed end date `2026-09-12`.

Safety baseline:

- `0` active Spend sources, `0` Spend records, and `$0` campaign Spend
- `0` GA4 KPIs, `0` GA4 Benchmarks, `0` KPI alerts, and `0` notifications
- no existing Spend-purpose Google Sheets connection
- the existing Revenue-purpose connection was not modified or counted as Spend evidence; the product's existing append flow created a separate temporary Spend-purpose connection

Final accepted lifecycle run:

- all `30` named checks passed with no failure
- Google Sheets add materialized one dated `$180.20` source; edit preserved its source ID
- a missing mapped header returned `SHEET_MAPPING_CHANGED` and preserved the exact last-good source and records
- a forged Sheets currency returned `SPEND_CURRENCY_MISMATCH` and preserved last-good data
- CSV preview returned the exact three headers and four rows
- CSV add filtered to `$5.00`; edit without re-upload changed the same source to `$11.00`; manual re-upload replaced that source with `$13.00`
- a forged CSV currency returned `SPEND_CURRENCY_MISMATCH` and preserved last-good data
- source list, breakdown, spend-to-date, daily financials, and campaign Spend reconciled at every accepted transition
- the combined temporary state was exactly `2` sources and `$193.20`
- natural Google Sheets refresh completed in `120` observed seconds with the same source ID and `$180.20` value
- the CSV mapping and records remained unchanged during the scheduler observation
- CSV and Sheets delete routes returned success, deactivated only their exact source, removed its records, and removed the dedicated Spend connection from active use
- cleanup removed only the validator-created inactive audit rows and connection so Campaign2 returned exactly to its original source, record, connection, campaign-Spend, alert, and notification structure

Two preliminary executions are excluded from passing evidence: the first completed cleanup but hit a local result-reporting variable typo; the second proved the product's soft-delete behavior but used an incorrect hard-delete test expectation. Both runs restored Campaign2 before the final corrected run. The final run above is the accepted packet.

## Authorized Campaign2 Downstream And Provider-Failure Evidence

Target: Campaign2 (`d9c8a3b7c4d0`), deployed SHA `cc2273c560b41c21c6b6fc19f77f4261e7bc2667`, currency `USD`, completed end date `2026-09-12`.

The accepted isolated run passed all `18` checks:

- A disposable Google Sheets Spend connection and source materialized `$180.20`; a disposable CSV source materialized `$13.00`; every source-list, breakdown, spend-to-date, daily-financial, and campaign value reconciled at `$193.20`.
- Only the disposable Spend connection's spreadsheet ID was temporarily replaced with a nonexistent provider ID. The deployed source-scoped refresh failed closed and preserved the exact last-good source, records, and totals. Restoring that one connection field made the same refresh path succeed.
- Only the disposable Sheets source's selected provider campaign value was switched. The final strengthened natural scheduler run completed in `170` observed seconds, retained the same Sheets source ID and two-source count, left CSV unchanged, and changed Sheets Spend from `$180.20` to `$1,103.00`; combined Spend became `$1,116.00`, an exact `$922.80` Sheets delta.
- A CSV manual replacement retained the same CSV source ID and changed CSV Spend from `$13.00` to `$1,013.00`; combined Spend became `$2,116.00`, an exact `$1,000.00` CSV delta.
- The live GA4 financial denominator was `25` conversions. Persisted KPI, persisted Benchmark, immutable Benchmark snapshot content, report output, and PDF output matched exact CPA values of `$7.73`, `$44.64`, and `$84.64` at the three Spend states.
- An in-app KPI alert was created at CPA `$44.64` against threshold `$64.64`, then resolved/read at CPA `$84.64`. Email notifications were disabled and no email was sent.
- The deployed manual snapshot and snapshot-download routes execute the same GA4 PDF builder used by scheduled reports. This proves the shared scheduled-PDF value builder, not scheduler timing or email delivery.
- Cleanup removed only the disposable Spend sources/records/connection, KPI/progress/alert/period, Benchmark/history, report/snapshots/send events, email audit rows, and notification. Every fixture-specific residue count was `0`; Campaign Spend returned to `$0`; the four original Revenue-purpose connection rows, Revenue facts, and all `29` GA4 daily facts were unchanged.
- A separate read-only postflight confirmed `0` Spend sources, `0` Spend records, `$0` Spend, `0` GA4 KPIs, `0` GA4 Benchmarks, `0` alerts/notifications, and the unchanged original connection inventory.

One intermediate strengthened run is excluded from passing evidence. Its product checks passed and its parent-table cleanup completed, but its new restoration assertion compared raw Revenue refresh metadata and regenerated record IDs while the normal Revenue scheduler ran concurrently. The validator was corrected to compare protected Revenue business facts while still checking every temporary fixture by exact ID; the final run above then passed all product, zero-residue, protected-fact, and connection-structure checks.

## Certification Boundary And Remaining Steps

No blocking step remains inside the requested Google Sheets Spend and CSV Spend scope. The correct status is **clean-certified for the documented GA4 Overview Spend boundary at runtime SHA `cc2273c560b41c21c6b6fc19f77f4261e7bc2667`**.

Explicit exclusions and future evidence boundaries:

1. The product's Google Sheets OAuth contract is read-only, so the validator did not write an external Sheet cell. The value-changing automatic refresh used two existing live provider campaign selections on the disposable source. No external-write capability or claim is introduced.
2. The single final `170`-second observation is not a scheduler SLA or proof of every future provider timing condition.
3. Scheduled email orchestration, inbox delivery, and provider delivery confirmation were not invoked and are not required or claimed for this Spend subsection. Only the shared scheduled-PDF value builder was exercised through deployed snapshot routes.
4. Unlisted Sheet layouts, CSV shapes, currencies, campaigns, future provider behavior, and future code revisions remain outside this bounded certification.
5. Existing Revenue implementations/evidence and every prior certificate remain untouched and retain their prior status. This packet certifies only Spend; it does not recertify the whole GA4 Overview.
6. Google Ads remains **NOT CONFIGURED / EXCLUDED** with no testing, modification, or readiness claim.
