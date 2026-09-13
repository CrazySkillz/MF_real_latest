# GA4 Overview Spend Validation Packet — 2026-09-13

## Decision

**Overall clean-certification status: PENDING — NOT CLEAN-CERTIFIED.**

The Spend release candidate passes its focused automated, type-check, and production-build gates and is deployed as `a77342289492440b628e5b72b9f5d16b88d51750`. That exact revision passes a read-only target-campaign inventory, reconciliation, access-control, and natural Google Sheets refresh observation. Current-revision production lifecycle mutation, provider-failure injection, and controlled provider-value downstream propagation remain open.

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
- production provider-value mutation
- production provider-failure injection
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

No source was deleted or rewritten. No production business row was mutated. No dependency, schema, response shape, field meaning, architecture, Revenue implementation, or Google Ads implementation changed.

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
| Sheets automatic refresh | A natural scheduler observation advanced the retained Sheets source `lastSyncedAt` while source IDs, source count, CSV mappings, and exact total remained stable. | Passed for one current provider/no-value-change observation; no exact cadence SLA or provider-value-delta claim. |
| Sheets last-good data | Provider/preview errors occur before replacement; new header/currency/role failures also occur before replacement; transaction failures roll back. | Passed by local trace/tests. A deployed provider-failure injection remains open. |
| CSV manual refresh | Scheduler trace/test contains no CSV processing path. During Sheets automatic observation, all CSV mapping hashes remained unchanged. | Passed for architecture and observed non-participation. |
| Downstream Spend | Deterministic runtime tests propagate Spend `250` to ROAS `4`, ROI `300`, CPA `5`, and the performance summary's canonical Spend input. Static trace covers KPI/Benchmark jobs, current-value resolution, alerts, snapshots, reports, and scheduled PDFs. | Passed locally for the canonical Spend input; a deployed controlled source-value mutation remains open. |

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

## Remaining Steps Before Clean Certification

Completed after the initial packet: the exact candidate was committed, pushed, deployed, and verified at full SHA `a77342289492440b628e5b72b9f5d16b88d51750`. The `180`-second validator passed after observing a natural refresh in `50` seconds, with the exact `$2,759.75` total, four stable source IDs, unchanged CSV mappings, clean integrity checks, and denied unauthenticated/cross-owner access.

Still required:

1. In an authorized disposable campaign or isolated staging fixture, execute add, edit/manual refresh, and delete for both source families and reconcile source list, source count, records, Total Spend, dates, and stable IDs after every transition.
2. Inject a Google Sheets provider/mapping failure in that isolated boundary and prove the previous source, records, total, and downstream values remain unchanged.
3. Make a controlled mapped Google Sheets Spend value change and a controlled CSV manual refresh, then prove the exact delta reaches Overview, KPI/Benchmark current values, alerts, snapshots, reports, and scheduled PDF inputs without cross-campaign leakage.
4. Record the final SHA and evidence in a new certification artifact. Do not overwrite or recertify a protected artifact without explicit permission.

Until these four gates are closed, the accurate status is **deployed read boundary healthy; clean certification pending**.
