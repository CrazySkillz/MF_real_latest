# Batch 4: Files, Sheets and Custom Integration

[Release index](../../V1_RELEASE_READINESS.md) · [Finding checklist](../../audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md)

This is the detailed home for this batch's assigned findings. Read the required repository references first, then the release index, checklist and this record. Documentation records evidence; verify actual current code before changing behavior. Original audit paths and line numbers describe the recorded baseline, not an assertion that the defect remains unchanged.

## Current Batch 4 status

**IN PROGRESS.** Ten corrections are VERIFIED LOCALLY: V1-040/041/065/066/067/070/071/072/073/126. Fourteen findings still need implementation; all 24 release acceptances remain OPEN. V1-072 is uncommitted and undeployed. The earlier nine corrections are deployed in `eb3fca00`; public checks pass, with authenticated import/provider acceptance still open. No provider call or production-data cleanup was performed.

## Retained CSV Revenue correction checkpoint (October 23)

**V1-072: VERIFIED LOCALLY; release acceptance OPEN.** The correction is uncommitted on base `eb3fca00f62dd8229b12a972956fc06e026281a2`. This protects the existing shared CSV API; LinkedIn, Instagram, Meta and TikTok provider-functional work remains deferred.

**Confirmed root cause:** `POST /api/campaigns/:id/revenue/csv/preview` and `/process` used the non-strict parser outside GA4. Its limit counted the header and stopped parsing, silently dropping data row 50,000; a physical-line precheck also rejected valid multiline fields. The non-GA4 process branch updated/created a source and deleted its records before validating conversion values or inserting replacement records. Invalid conversion edits returned 400 after data loss, and insert failure could leave partial state. The existing shared wizard sends this context and source ID from `client/src/components/AddRevenueWizardModal.tsx:1507,1604`; retained API accessibility is not evidence of configured provider support.

**Minimal correction:** `server/routes-oauth.ts:4752,4778,5167` now uses the existing complete strict parser for every CSV Revenue context: at most 50,000 data rows; oversized input returns 413 and malformed structure returns 400 before mutation. Preview response shape and the non-GA4 25-row sample remain unchanged. Exact campaign/type/context/active-source checks precede replacement. Empty selected revenue or conversion-value sets reject before writes. Existing daily/snapshot and exact active-campaign attribution records are prepared first, then saved with their source through `server/storage.ts:2999`'s existing transaction. Expected mapping comparison rejects concurrent stale edits with 409; a transaction-held parent lock prevents recreation after campaign deletion. The larger route diff removes the old separate mutations and duplicated record insertion; no new architecture, schema, dependency, schedule or UI was introduced.

**Trace and lifecycle boundary:** File bytes -> complete parser -> selected rows -> retained raw mapping plus existing daily/snapshot and exact-campaign records -> atomic save -> existing recompute call -> wizard invalidation. `getRevenueSources`, `getRevenueTotalForRange` and `getRevenueBreakdownBySource` retain campaign/context/active-source/date filters and aggregate-versus-detail deduplication. The guarded `/revenue-sources` and `/revenue-totals` readers consume those methods. Actual handler-to-PostgreSQL add, re-upload edit, selection-only edit, source/breakdown/total reconciliation, unrelated-campaign retention, rejected edit, insert rollback and concurrent edit/deletion cases pass. Source deletion remains the existing guarded `deleteRevenueSourceWithRecords` path and is not newly certified here. CSV is a manually replaced snapshot, with no provider reconnect or scheduled file reread. Existing scheduler/downstream GA4 regression checks are supporting evidence, not full non-GA4 report/KPI/Benchmark/notification certification.

**Validation:** [29 new tests pass](validation-2026-10-23-retained-csv/verified-route.json), including 12 actual PostgreSQL cases. [Wider packet](validation-2026-10-23-retained-csv/final.json): **534 tests, 516 passed, 18 failed, zero skipped**. [Assessment](validation-2026-10-23-retained-csv/assessment.json) preserves every failed ID, evidence and release impact; all 18 match previously recorded failure boundaries and remain OPEN, with no waiver. Five use incomplete GA4 transaction mocks, one asserts a stale Spend recompute count, two assert stale Google Ads validator/UI strings, and ten are retained-source safety assertions. No new failing identity remains. Two CSV structural assertions were updated after this correction removed the unsafe separate mutations; an adjacent Google Ads assertion now requires atomic replacement. Behavior is independently checked in the new route/database tests.

The first [reproduction](validation-2026-10-23-retained-csv/before.json) records 14 failing defect cases, one passing median case and ten PostgreSQL cases not yet enabled. The final packet enables all PostgreSQL cases. TypeScript initially caught direct Map iteration incompatible with the existing compiler target; the loop now retains the original `Array.from(...entries())` pattern. The 534-test packet precedes only that compatibility change; all 29 new cases were rerun afterward and [TypeScript/server build pass](validation-2026-10-23-retained-csv/verified-build-checks.json). [File hashes](validation-2026-10-23-retained-csv/candidate-manifest.json) distinguish those checkpoints. [Fixture cleanup](validation-2026-10-23-retained-csv/fixture-cleanup.json) found zero remaining schemas, other clients or advisory locks; the isolated localhost cluster was stopped. No production/Ptomo access, provider call or application migration occurred.

**Unvalidated and historical-data boundary:** No deployed/browser acceptance, full provider/source certification, hosted-load result or historical repair is claimed. This does not normalize every retained non-GA4 amount/date/currency variant; their existing formulas and parsing remain subject to their own acceptance. LinkedIn connection/session updates and downstream recompute still occur after the source transaction and their failure recovery is not certified by source/record atomicity. Truncated or previously erased CSV data cannot be reconstructed from missing retained rows: exact original files and a separately reviewed source inventory are required before repair. No automatic cleanup or guessed backfill was added.

**Reusable safeguard:** Complete parsing, validation before mutation, scoped atomic replacement, expected mapping comparison, parent survival and rollback/concurrency regressions reuse existing GA4 patterns. CSV's manual cadence, 50,000-row cap, positive-value handling, date fallback and LinkedIn conversion median are source-specific; future providers still require independent permission, metric, attribution, date, pagination and quota validation.

## Sheets Spend deployment verification (October 23)

At 04:05 Europe/Amsterdam (02:05 UTC), three read-only `/api/health` responses independently confirmed `eb3fca00f62dd8229b12a972956fc06e026281a2`, `nodeEnv=production` and successful readiness. The homepage and `/health` returned 200; signed-out `/api/campaigns` returned 401. The GA4 scheduler is registered and healthy with the existing 08:00/14:00/20:00 Amsterdam configuration and `runOnStartup=false`. Its next run is October 23 at 08:00 Amsterdam, through October 22; it reports no completed natural run since deployment. [Recorded observations](deployment-2026-10-23-sheets-spend/public-verification.json) and [read-only checker](deployment-2026-10-23-sheets-spend/verify-public.cjs).

This proves the deployed revision and listed public checks only. Authenticated imports, real provider values, natural refresh completion, hosted load/recovery and complete source/downstream acceptance remain open. No campaign read/mutation, upload, cleanup, manual refresh or provider failure was triggered. The nine corrections verified at this deployment checkpoint are deployed; the later V1-072 correction above is not included.

## Sheets Spend commit checkpoint (October 23)

The authorized fixes, tests and validation documentation are committed in `b650b63150f2d38522c7f85c1f1fd2bee6d8b610`. [Commit verification](validation-2026-10-23-sheets-spend/commit-checkpoint.json) binds all five runtime/test files to the previously validated candidate. The dated validation manifests retain their original pre-commit state. No schema, dependency or environment-setting change is included. Tests were not repeated because committed content matches the tested files. The subsequent public deployment checks above pass; full release acceptance remains open.

## Sheets Spend correction checkpoint (October 23)

V1-041 and V1-070 now have localized forward corrections on base `e635fe50`. The changes are **committed in `b650b631` and deployed in `eb3fca00`; public deployment checks pass, with source/provider acceptance still open**. All 37 new tests pass, including nine real PostgreSQL cases; required release acceptance remains OPEN. No production/Ptomo reads, imports, refreshes or cleanup were performed.

| Finding | Root cause and correction | Exact changed boundary |
|---|---|---|
| V1-041 | Fixed `A1:ZZ5000` reads silently discarded later rows/columns; permissive parsing accepted partial numbers and converted nonnumeric selections to zero. Preview/process now read exact-tab metadata and reuse the existing complete Revenue chunk reader: full-width 5,000-row chunks, maximum 50,000 grid rows including the header, fail closed above that bound or on any failed chunk. Existing 15-second per-request deadlines cover metadata, values and body reads. Validate header identity, selected amounts, GA4 dates and currency before materialization; preserve explicit zero with its date, reject missing-only selections, reject total overflow. | `server/routes-oauth.ts`: `POST /api/campaigns/:id/spend/sheets/preview`, `/process`, `readGoogleSheetsRevenueChunks`; existing validators in `server/utils/csv.ts`. |
| V1-070 | Duplicate signatures omitted platform/currency and empty arrays hid singular selections. Cleanup did separate unguarded writes; purge separately checked record count before deletion. Inspection now distinguishes exact context, currency, mapping and selected values. Deactivation requires matching nonempty normalized record sets, including campaign/date/currency/attribution; incomplete/conflicting scopes are skipped. Both mutation routes require the current read-only `inspectionToken`. Storage rechecks every inspected source/record inside one transaction and rolls back all removals together. | `server/routes-oauth.ts`: `getGoogleSheetsSpendDuplicateGroups`, guarded duplicate GET, `/cleanup`, `/purge-inactive`; `server/storage.ts`: `getGoogleSheetsSpendCleanupState`, `cleanupGoogleSheetsSpendDuplicates`, optional maintenance lock timeout on the existing refresh-input transaction. |

**Import contract and trace:** `AddSpendWizardModal.tsx` sends the connection, selected columns, currency and singular/array campaign values to the existing preview/process endpoints. Add remains additive; edit/refresh preserve the source ID and saved selection. `reprocessGoogleSheetsSpendWithDetails` already calls that same process endpoint with the expected source mapping and refresh ownership; it reports rejected imports as failures. Complete rows feed the existing source mapping, sample/count provenance and dated/snapshot Spend records, then existing campaign recompute calls. GA4's existing atomic replacement, source ownership, expected mapping and parent/lease guards remain. Chunk token renewal receives the same ownership input; a successful fallback connection repair is retained for subsequent chunk renewal. No scheduler schedule or frontend layout changed.

Selected amounts use the existing CSV financial contract: nonnegative finite numbers, at most two decimals, valid comma grouping, amount/combined total at most 9,999,999,999.99, and `$` only for USD. Locale-ambiguous, exponential, negative and overprecision values are rejected, rather than rounded or guessed. Blank amount cells do not contribute; an entirely blank/unmatched selection cannot overwrite saved data with zero. Explicit numeric zero is accepted and retains its mapped date. Mapped GA4 dates must use the existing deterministic ISO date/timestamp syntax; no-date mapping retains the completed-day snapshot contract. Future-dated rows stay materialized but are excluded from the GA4 completed-day returned total. Preview checks completeness and header identity; it has no selected mapping and does not claim selected-amount validation.

**Cleanup contract and reachability:** The duplicate endpoints remain campaign-access guarded. Repository caller search found no current UI or background caller; no new UI, automatic cleanup or source removal was introduced. GET remains read-only and adds `inspectionToken`, `cleanupEligible` and inactive candidate IDs. POST now requires `confirm:true` plus that token from a fresh inspection. This intentional maintenance-API safety requirement means old confirmation-only requests return 400. A changed inspection returns 409; changes between route validation and storage are independently rejected. Duplicate sources are deactivated, not hard-deleted. Purge retains its explicitly destructive purpose and accepts only inspected inactive, zero-record sources with an exact active scope match; re-inspect after deactivation. Unconfigured/deferred platform scopes are not cleanup candidates. Existing unrelated legacy storage methods were not removed.

The transaction locks the existing campaign and fences writes to the two Spend tables so legacy inserts cannot race the record check. Campaign/table lock waits are bounded to three seconds; maintenance statements have a ten-second timeout. These locks are used only by explicit cleanup/purge, never ordinary preview/save/refresh. They can briefly contend with other Spend writes; hosted-load acceptance remains open. If cleanup commits but the subsequent downstream recompute fails, the error response reports `cleanupApplied:true`; it does not claim the cleanup rolled back.

**Validation and evidence:** See [assessment and each classified failure](validation-2026-10-23-sheets-spend/assessment.json), [validated file hashes](validation-2026-10-23-sheets-spend/candidate-manifest.json), [corrected baseline reproduction](validation-2026-10-23-sheets-spend/before-corrected-fixture.json), [final targeted results](validation-2026-10-23-sheets-spend/verified.json), [TypeScript/server build](validation-2026-10-23-sheets-spend/verified-build-checks.json) and [fixture cleanup](validation-2026-10-23-sheets-spend/fixture-cleanup.json). **Final targeted packet: 544 tests: 530 passed, 14 failed, zero skipped. All 37 new tests pass, including nine actual PostgreSQL cases.** Each failure has the same identity and failure boundary as the previous full checkpoint: eight incomplete transaction fixtures and six structural assertions. They remain open, with exact IDs and release impact in the assessment; no failure is waived. TypeScript and server build pass. The earlier whole-suite 179 failures and CI gate remain open; this is not a new full-suite run. Both disposable local databases have zero remaining fixture schemas, other client connections or advisory locks; the test cluster was stopped.

The baseline reproduction executed actual current handlers/scheduler/helper code: 19 of 22 assertions failed, including 5,001 data rows importing only 4,999, malformed amounts accepted, false-zero writes and cross-platform/currency grouping. An earlier three-case test-parameter mistake is retained in `before.json` and corrected in the named baseline; those harness failures are not product defects. The first final packet exposed a five-second test-budget failure caused by repeatedly extracting the same code from the large route file while compilation ran. Test-only extraction caching removes that redundant work; no assertion or timeout was relaxed. Its failed result remains recorded and is superseded only by the final rerun.

**Lifecycle / downstream evidence and limits:**

| Boundary | Current evidence |
|---|---|
| Add, edit, scheduler reprocess, recovery | Actual registered handlers and scheduler body run against controlled provider responses; actual PostgreSQL replacement/read cases reconcile selected records and source totals. Valid data recovers after invalid refreshes; no partial import replaces last-good data. |
| Completeness / unavailable / zero / currency / dates | Boundary and beyond-ZZ tests, late-chunk failure, stalled metadata/value/body requests, invalid amounts, header collisions, overflow, exact selection, explicit zero and missing selection are exercised. Saved-source metadata and records are compared before/after failures. |
| Ownership / late changes / delete / cleanup | Existing PostgreSQL financial ownership/input-invalidation packet is rerun. New cleanup tests cover denied access, stale tokens, route-to-storage edits, foreign child corruption, multi-source rollback, exact purge, concurrent legacy inserts and bounded busy-campaign waits. Cleanup source-total/breakdown reads reconcile after removal. |
| Source modal / visible totals / full publication | Persisted mapping/provenance and source/breakdown/total reads are checked. Recompute invocation ordering is checked at the handler boundary. Rendered modal/cards, KPI/Benchmark/Insights/alerts/reports and natural deployed publication are not newly certified by these fixtures. |
| Reconnect / cancellation / general deletion | Token repair/renewal and owned late-write guards are checked within fixtures. Real customer OAuth/cancel/reconnect, independent delete/disconnect acceptance and their existing failing tests remain open. |
| Existing damaged records | No data cleanup was executed. Truncated/invalid sources require source-authoritative comparison and exact scoped refresh/re-import after deployment. A successful future refresh may correct records, but historical reports/snapshots are not silently rewritten. Different record sets remain skipped by duplicate cleanup; they require a separate reviewed correction plan. |

**Reusable safeguards:** Read the complete declared source range or fail before replacing data; validate selected raw values before permissive parsing; distinguish measured zero from no selected evidence; carry saved selection, source identity and ownership through refresh and token renewal. Destructive maintenance needs a fresh inspected state, exact record equivalence, atomic changes and insert-race protection. The Sheets grid cap, formatted cells, generated headers, dollar symbol and ISO-date rules are source-specific assumptions. Each future provider still needs independent permissions, metric meaning, attribution, dates, pagination and quota validation. No framework, dependency, schema or environment-setting change was introduced.

## Sheets Revenue deployment verification (October 23)

At 00:32 Europe/Amsterdam (October 22, 22:32 UTC), three read-only `/api/health` responses independently confirmed `e635fe50b6009bd003e8aa2f82d8c3fe84026cc4`, `nodeEnv=production`, and readiness. The homepage and `/health` returned 200; signed-out `/api/campaigns` returned 401. GA4 scheduler registration is healthy with the existing 08:00/14:00/20:00 Amsterdam configuration and `runOnStartup=false`. Its next run is October 23 at 08:00 Amsterdam, through October 22; no natural run has completed since this deployment. [Recorded observations](deployment-2026-10-23-sheets-revenue/public-verification.json) and [read-only checker](deployment-2026-10-23-sheets-revenue/verify-public.cjs).

This proves the deployed revision and listed public checks only. Authenticated imports, real Google values, natural refresh completion, hosted load/recovery and full source/downstream acceptance remain open. No upload, campaign mutation, manual refresh or provider failure was triggered. At this deployment checkpoint, Sheets Spend V1-041/070 was next. Its subsequent local correction checkpoint above now supersedes that implementation status.

## Sheets Revenue commit checkpoint (October 23)

The requested fixes, tests and documentation are committed in `ace32e7bd9521c451fe12ba2a05f1445c0001a63`. [Commit verification](validation-2026-10-23-sheets-revenue/commit-checkpoint.json) confirms all five committed runtime/test files match the validated candidate. No schema, dependency or environment-setting change is included. The dated validation manifests retain their original pre-commit state. The subsequent public deployment checks above pass; required release acceptance remains open.

## Sheets Revenue correction checkpoint (October 23)

The authorized next group, V1-065/066/067, is implemented and verified locally. [Assessment and classified failures](validation-2026-10-23-sheets-revenue/assessment.json), [candidate hashes](validation-2026-10-23-sheets-revenue/candidate-manifest.json), [pre-fix reproductions](validation-2026-10-23-sheets-revenue/before.json), [final targeted result](validation-2026-10-23-sheets-revenue/verified-final.json), [TypeScript/server build](validation-2026-10-23-sheets-revenue/final-build-checks.json) and [fixture cleanup](validation-2026-10-23-sheets-revenue/fixture-cleanup.json).

| Finding | Root cause and smallest correction | Exact changed boundary | Local evidence |
|---|---|---|---|
| V1-065 | Header-keyed row objects silently overwrite repeated names. Preview/save now reject collisions after trimming and generated `Column N` names, before constructing row objects. Refresh uses the same normalization and rejection. | `server/routes-oauth.ts`: Sheets Revenue preview/process; `server/auto-refresh-scheduler.ts`: `reprocessGoogleSheetsRevenue` | Repeated Revenue/Campaign headers, whitespace collisions and generated-name collisions reject. Valid trimmed/generated headers survive preview, save and refresh. Actual PostgreSQL records remain unchanged on invalid edit/refresh. |
| V1-066 | Amount syntax allowed `$`, then parsers stripped it without comparing that symbol to currency. Existing currency resolution/mismatch checks now precede amount validation; the existing selected-row validator rejects `$` for any resolved currency except USD. | Both paths above; `server/utils/google-sheets-revenue-amount.ts`: `findInvalidGoogleSheetsRevenueAmountRows` | EUR-dollar edit/refresh rejects before replacement; plain EUR and dollar USD succeed. Malformed numeric rejection and the configured-currency mismatch response remain intact. No FX conversion or relabelling. |
| V1-067 | Refresh ignored singular `campaignValue`, and its materializer did not normalize stored array values as save/validation did. Refresh now uses normalized non-empty arrays first, otherwise the saved singular value, throughout validation and materialization; a campaign column with no selection fails closed. | `server/auto-refresh-scheduler.ts`: `reprocessGoogleSheetsRevenue`, used by the daily pipeline, Revenue loop and validation entry | Selected 10 stays 10 beside unrelated 90, including singular-only/empty-array fallback, array precedence and whitespace. Invalid unselected rows are excluded. Stable source ID, expected mapping and refresh ownership options remain intact. Actual add/edit/refresh persistence reconciles to source breakdown and total reads. |

**Trace and propagation:** `AddRevenueWizardModal.tsx` opens `/revenue/sheets/preview`, sends mapped columns/currency and both selection forms to `/revenue/sheets/process`, then refreshes source/financial queries. The routes and scheduler fetch exact-tab metadata and existing bounded row ranges; provider, range, token and timeout behavior are unchanged. Normalized rows feed dated or snapshot `revenue_records` and `mappingConfig.campaignValueRevenueTotals`. Existing `replaceRevenueSourceWithRecords` keeps atomic replacement, campaign/type/context/stable-ID checks, expected mapping comparison and surviving-parent/refresh-ownership guards. Storage source-list, breakdown and total consumers retain their contracts. The new PostgreSQL cases execute the actual registered save handler and scheduler body into actual storage, then reconcile the persisted records and source/total reads. Authentication and provider replies are isolated fixtures; the full server middleware/browser/provider journey is not claimed.

**Validation:** 29 new tests pass, including three handler-to-PostgreSQL lifecycle cases. The full targeted packet has **407 tests: 398 passed, nine failed, zero skipped**. Each failure retains its existing stable test ID, classification and release impact in the assessment; none is waived. They are five incomplete disconnect mocks, two Google Ads source-text guards and two downstream source-text guards. Actual persistence/ownership tests provide separate evidence for their tested boundaries, not closure of those failures. The whole 179-failure regression baseline and CI gate remain open; no new whole-suite run is claimed. One neighboring scheduler fixture needed its campaign-currency read stubbed after currency validation moved earlier; its original no-write/warning assertions remain. Initial PostgreSQL setup used an incompatible local fixture and did not execute its database cases; the final packet uses a fresh test-only cluster on `127.0.0.1:55444`. Both fixture databases have zero leftover schemas, connections or advisory locks, and the cluster was stopped. TypeScript and server build pass; no frontend/runtime contract, dependency, schema or environment-setting change was introduced.

**Lifecycle and release limits:** Add, edit, refresh, stable identity, bad-input retention and persisted total/source reads are proven within the fixtures. Existing delete/disconnect, reconnect/OAuth, real scheduled timing, browser flows, quotas and full downstream KPI/Benchmark/Insights/report/alert publication are not newly certified. This corrects the forward path only. A successful future refresh can re-materialize a source with its still-saved exact selection; already-published historical snapshots are not repaired. Duplicate-header or currency-damaged sources require a read-only inventory and source-authoritative correction/re-import plan before cleanup. No production/Ptomo reads or mutations occurred. Existing numeric syntax, positive-row materialization and zero/negative amount policies are otherwise unchanged; these three fixes are not whole-source certification.

**Reusable safeguards:** Validate normalized header identity before object construction, validate currency before permissive numeric parsing, and apply the same saved selection in validation and materialization. Keep atomic stable-source replacement and last-good retention. The sheet's formatted cells, generated column names, USD-only dollar handling and saved singular/array fields are provider/workflow assumptions; future providers still require independent permissions, metric, attribution, date, pagination and quota validation. No new framework was added.

## Deployment verification (October 22)

At 21:53 UTC, three read-only checks independently confirmed live revision `44132830b668283d37d40cb874687c2c5861ad0e`, `nodeEnv=production` and successful readiness. The homepage and `/health` returned 200; signed-out `/api/campaigns` returned 401. The GA4 scheduler is registered with 08:00/14:00/20:00 Europe/Amsterdam and `runOnStartup=false`. Its next run is October 23 at 08:00 Amsterdam, through October 22; no natural run has completed since this deployment. [Recorded public evidence](deployment-2026-10-22/public-verification.json) and [read-only checker](deployment-2026-10-22/verify-public.cjs).

This confirms deployment and the listed public checks only. It does not validate authenticated imports, Google provider values, the next refresh, hosted load or recovery. No campaign mutation, upload, manual refresh, provider failure or cleanup was triggered. All 24 release acceptances remain open. At this October 22 checkpoint, Sheets Revenue V1-065/066/067 was next; the October 23 correction checkpoint above supersedes that implementation status.

## Commit checkpoint (October 22)

The user authorized commit and push. [Commit evidence](validation-2026-10-22/commit-checkpoint.json) verifies all nine committed runtime/test files against the validated manifest. Runtime commit: `c38062825a88c7265f323cb2990f713ddc040e18`. No schema, dependency or environment-setting change is included. Validation was not repeated because committed content matches the tested files. The subsequent deployment checks above confirm the public boundary; required release acceptance remains open. The original dated manifests describe their pre-commit validation state.

## First correction checkpoint — October 22

The user authorized Batch 4 while the deployed Batch 3 revision awaits its first natural refresh. Batch 3's pending October 23 08:00 Amsterdam observation remains separate; these tests do not depend on that run.

| Finding | Confirmed current root cause and correction | Exact changed path | Proven local boundary / remaining limit |
|---|---|---|---|
| V1-040 | Spend used the non-strict parser, counting the header against the row limit and accepting partial numeric strings. Preview/process now use the existing strict parser; validate mapped headers, selected amounts, deterministic dates, currency symbols and combined numeric bounds before replacement. Uploaded preview metadata comes from the file; selection-only edits retain the stored preview. | `server/routes-oauth.ts`: `POST /api/campaigns/:id/spend/csv/preview` and `/process`; existing helpers in `server/utils/csv.ts` | Actual handlers retain all 50,000 data rows; reject row 50,001, duplicate/blank headers, wrong widths, malformed amounts, negative adjustments, EUR-dollar mismatch, invalid/ambiguous dates and overflow without a write. Exact singular/array campaign filters, USD thousands, valid edits, legacy undated edits, retained unmapped preview columns and neighboring Revenue checks pass. No claim of live UI/deployed acceptance or historical repair. |
| V1-071 | GA4 Revenue's validator accepted signed amounts that its positive-only materializer omitted. The validator now rejects negative selected amounts; the response explicitly states that negative CSV adjustments are unsupported. Native GA4 refund handling is unchanged. | `server/utils/csv.ts`: `isSupportedGa4CsvRevenueAmount`; `server/routes-oauth.ts`: Revenue CSV process validation error | `100` plus `-10`, `-$10` or `$-10` rejects before source replacement; positive selected Revenue and an unselected negative row retain the correct result. No silently invented allocation/netting. Existing affected sources require a read-only inventory and targeted re-upload/correction plan. |
| V1-073 | `writeGA4RefreshInputChange` locked campaign rows but ignored a missing result, allowing orphan writes after deletion. It now requires every distinct requested campaign to survive the transaction's parent lock before invoking the writer. Ordinary campaign updates preserve their existing `undefined` result when cancellation/deletion wins; owned-refresh errors remain errors. | `server/storage.ts`: `writeGA4RefreshInputChange`, `updateCampaign`, `updateCampaignWithGA4DailyInvalidation` | Real local PostgreSQL proves rejection with and without the durable-work table, multi-parent all-or-nothing checks, a save waiting behind a committed campaign deletion, no orphan source/record and an unrelated-campaign control. Cancellation/activation races and existing ownership/invalidation/recovery suites pass. No database migration or live orphan cleanup was performed. |
| V1-126 | One IP's shared five-request budget made five office users' previews consume every save allowance. Verified Clerk users now have separate five-preview/five-save budgets per five minutes; anonymous requests retain the shared IP budget. | `server/middleware/rateLimiter.ts`: `importRateLimiter` | Local HTTP tests prove five same-IP users can preview and save, each sixth preview/save is denied with retry information, and submitted user IDs cannot obtain an authenticated budget. Clerk identity is a fixture; live Clerk/proxy behavior, multiple-instance quota sharing and realistic full-import workload remain acceptance checks. |

**Input policy:** GA4 CSV Revenue and CSV Spend reject selected negative adjustments before any mutation. Plain numbers/US-style separators with at most two decimal places are supported; `$` requires USD. Zero rows beside positive rows preserve the correct total. An all-zero/blank selection still rejects under the existing no-positive-rows contract and is not published as an available zero source. The source reference is updated in [GA4 financial sources](../../../GA4/FINANCIAL_SOURCES.md). No other provider's amount policy is changed.

**Validation evidence:** [runner](validation-2026-10-22/run-tests.cjs), [parent defect reproduction](validation-2026-10-22/parent-before.json), [shared safeguard regression result](validation-2026-10-22/foundation-after.json), [CSV defect reproductions](validation-2026-10-22/csv-before.json), [CSV post-fix result](validation-2026-10-22/csv-final.json), [TypeScript/server build](validation-2026-10-22/checkpoint-build-checks.json). The shared-safeguard run passed 344/344 tests. The initial [foundation run](validation-2026-10-22/foundation-before.json) includes a local fixture-database startup failure; it is not counted as parent-defect proof. The subsequent parent reproduction has 57 passes and three confirmed defect failures. CSV reproduction has four controls passing and 20 defect failures. The CSV intermediate run has 72/73 passes: its one failing transaction assertion still expected a direct `db.transaction` call, although the current wrapper owns that transaction. The assertion was corrected to follow the wrapper and parent guard, retaining source/type/campaign and delete/insert ordering checks; actual PostgreSQL tests verify behavior independently.

**Final focused validation:** [357/357 database/lifecycle/import-budget checks](validation-2026-10-22/parent-final.json) and [73/73 CSV checks](validation-2026-10-22/csv-final.json) pass, together 430 tests. [Final TypeScript and server build](validation-2026-10-22/final-build-checks.json) pass. The first full run exposed two real compatibility regressions in ordinary campaign updates after cancellation: the new parent guard threw instead of returning `undefined`. The two update methods now preserve their documented return contract without running a source writer or recreating a campaign. The original cancellation tests were retained unchanged and pass; the missing-parent currency-update path is also checked. This correction required a second full run, rather than dismissing either failure as a baseline.

**Full regression result:** [4,488 tests: 4,309 passed, 179 failed, zero skipped](validation-2026-10-22/full-suite-final.json). [Failure reconciliation](validation-2026-10-22/failure-reconciliation.json) retains every failed identity, classification and release impact: no new failing identity or suite error remains. One previous failure now passes because the obsolete CSV transaction assertion was corrected and behavior independently checked; the other 179 and the separate CI-only gate remain open. The final full run used the [recorded candidate](validation-2026-10-22/candidate-manifest.json). After it, two catch branches were adjusted solely to preserve the pre-existing `CSV_TOO_LARGE` error-code field, and the route test now asserts that field; [all 73 CSV checks passed again](validation-2026-10-22/csv-response-final.json), followed by [TypeScript/server build](validation-2026-10-22/response-contract-build-checks.json). This is a focused follow-up, not a third whole-suite run. [Final candidate hashes](validation-2026-10-22/response-contract-manifest.json) distinguish the two snapshots.

**Fixture cleanup:** [Both local test databases](validation-2026-10-22/fixture-cleanup.json) have zero remaining fixture schemas, other client connections or advisory locks. Tests used only `127.0.0.1:55443`, stripped application credentials and blocked outbound network. The test-only PostgreSQL cluster was stopped after verification. [Documentation checks](validation-2026-10-22/documentation-check.json) validate the two main records, eight batch records and all 130 unique finding IDs. No application migration or production cleanup was executed.

**Limits and remaining work:** These are forward-path corrections, not whole-source certification. No browser test, deployed upload, provider comparison, existing-damaged-import inventory or production cleanup is claimed. Source delete/reconnect/scheduler/report behavior outside the listed tests is not newly certified. All findings retain release acceptance OPEN.

**Reusable safeguards:** Future imports can reuse the existing strict parser, validation-before-replacement sequence, transaction-held parent lock and authenticated workflow budgets. Reuse the boundary, malformed-input, unrelated-campaign, cancellation-race and retry-limit regression cases. The 50,000-row CSV cap, accepted number/date syntax and positive-only import policy are CSV-specific assumptions, not provider guarantees. Every new provider still needs its own permission, metric, attribution, currency, date, pagination and quota validation; no provider or framework was added here.

| Remaining implementation group | Finding IDs |
|---|---|
| Standalone Sheets scope, zero state, formulas and downstream reports | V1-051, V1-108, V1-112, V1-113, V1-114 |
| Custom Integration parser/publication, transfers, XLSX bounds/selection and metric meaning | V1-028, V1-029, V1-031, V1-102, V1-103, V1-111, V1-120 |
| Retained manual-Spend and cross-source transfer safeguards | V1-068, V1-069 |

The next implementation group is standalone Sheets (V1-051/108/112/113/114), followed by the remaining groups above. V1-072 is verified locally and awaits commit/deployment. The earlier nine corrections are deployed in `eb3fca00`; acceptance remains open. Four-provider functional work remains deferred; shared retained-route safety remains required. No completion estimate or additional exclusion is inferred.

## Scope and acceptance

Strict complete file/range/column/numeric/currency, metric meaning and worksheet contracts, explicit aggregation/denominators through goals/reports, bounded expanded/aggregate input work, signed-adjustment policy, truthful validation/error/zero publication, exact transfer/cleanup/source provenance, saved selection and dates preserved on refresh/report generation, surviving-parent/atomic replacement. CSV Revenue, CSV Spend, Sheets Revenue, Sheets Spend, standalone Sheets and Custom Integration remain distinct sub-batches with their own acceptance.

For each included source, cover create/edit/delete/reconnect/refresh/list/totals, negative cases and downstream propagation. Preserve the existing architecture. Historical-data cleanup requires its own read-only inventory and separately reviewed scope. A locally passing fix does not close required deployed/provider acceptance.

## Dependencies

Preserve [Batch 1](../v1-batch-1/README.md) ownership, input and sender safeguards and [Batch 2](../v1-batch-2/README.md) lifecycle contracts. Align source/date/currency behavior with [Batch 3](../v1-batch-3/README.md); validate all [Batch 7](../v1-batch-7/README.md) consumers and [Batch 8](../v1-batch-8/README.md) workload/operational gates.

## Reference and evidence entry points

These records retain their own dates and verification limits. Use the current fix evidence above and below when it supersedes an original finding.

- [Custom import contracts and entry points](../../audits/v1-2026-10-19/CUSTOM_IMPORT_AND_PUBLIC_ENTRYPOINTS.md)
- [CSV Revenue and final-write boundary](../../audits/v1-2026-10-19/CSV_REVENUE_AND_PARENT_WRITE_TRACE.md)
- [Standalone Sheets and retained writes](../../audits/v1-2026-10-19/ACCOUNT_SHEETS_AND_RETAINED_WRITES.md)
- [Sheets/Custom value propagation](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md)
- [HTTP/database import workload](../../audits/v1-2026-10-19/HTTP_DATABASE_PILOT.md)

## Finding checklist

| Finding | Severity | Fix status | Release acceptance |
|---|---|---|---|
| [V1-028](#v1-028) | P1 | OPEN | OPEN |
| [V1-029](#v1-029) | P1 | OPEN | OPEN |
| [V1-031](#v1-031) | P1 | OPEN | OPEN |
| [V1-040](#v1-040) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-041](#v1-041) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-051](#v1-051) | P1 | OPEN | OPEN |
| [V1-065](#v1-065) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-066](#v1-066) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-067](#v1-067) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-068](#v1-068) | P1 | OPEN | OPEN |
| [V1-069](#v1-069) | P1 | OPEN | OPEN |
| [V1-070](#v1-070) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-071](#v1-071) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-072](#v1-072) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-073](#v1-073) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-102](#v1-102) | P1 | OPEN | OPEN |
| [V1-103](#v1-103) | P1 | OPEN | OPEN |
| [V1-108](#v1-108) | P1 | OPEN | OPEN |
| [V1-111](#v1-111) | P1 | OPEN | OPEN |
| [V1-112](#v1-112) | P1 | OPEN | OPEN |
| [V1-113](#v1-113) | P1 | OPEN | OPEN |
| [V1-114](#v1-114) | P1 | OPEN | OPEN |
| [V1-120](#v1-120) | P1 | OPEN | OPEN |
| [V1-126](#v1-126) | P1 | VERIFIED LOCALLY | OPEN |

## Findings

Original evidence below is retained verbatim except relative link destinations. For implemented findings, use the correction and current-status sections to distinguish fixed forward paths from remaining release acceptance.

### V1-028

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed parser reproductions):

`services/custom-integration-file-parser.ts:82-105` uses non-strict 5,000-row CSV limit: 5,001 data rows become 4,999, confidence100, reviewfalse. Permissive numeric parsing accepts malformed amounts, sums mixed currency and misreads decimal-comma values. Duplicate CSV/XLSX Spend headers100/7 become14 through overwrite plus repeated header iteration217–229, also confidence100. Schema765 has no currency/report-period contract; UI/report currency formatting uses USD. Exact fixtures recorded. Separate GA4 financial CSV parser is not implicated by these cases.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-029

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed publication and fallback paths):

Custom imports persist and publish review-required metrics; latest-reader storage5780 has no validation-state filter. UI2806 labels Needs review but creates `latest_validated_import` scope; metric resolver still supplies KPI/Benchmark values. Scheduled report575-729 reads same row without validation gate or imported-period filter. Report financial builder498-538 turns failed revenue total read into an available zero when source exists (fixture). Webhook review URL has no registered page. Prevent unvalidated/failed reads from masquerading as validated period values; validate downstream artifacts.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-031

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained API reproduction):

`POST /api/custom-integration/transfer`, routes34100-34206: same source/destination deletes connection and metrics yet returns success; ordinary transfer copies without parser metadata/import timestamp and performs copy/delete nonatomically. Exact fixture confirms destructive same-ID outcome and omitted fields. No current frontend caller found, but route remains registered. Validate distinct owner-bound source/destination, atomic failure/retry and metadata preservation before retaining or excluding it.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-040

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN. See the [current correction checkpoint](#first-correction-checkpoint--october-22).

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed GA4 CSV Spend corruption):

`routes-oauth.ts:6545-6553` accepts up to50,005 approximate lines but non-strict parser stops at50,000 including header. Exact route fixture uploads50,000 data rows and persists49,999 with success. Same route's `aggregateCsvSpendRows` accepts malformed `12oops` as12; Revenue CSV's strict validator is absent. Validate whole-file completeness, amount/header/date/currency contract and source/downstream parity; existing damaged imports need read-only inventory.

**Implementation / validation:** The forward-path correction in `c3806282` is VERIFIED LOCALLY in the [October 22 checkpoint](#first-correction-checkpoint--october-22), including exact paths, reproduction, regression evidence and limitations. Deployed/provider, complete downstream lifecycle and historical-data acceptance remain OPEN.

### V1-041

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed GA4 Sheets Spend corruption):

Routes6765/6905 fetch fixed `A1:ZZ5000` without completeness check; exact processing fixture with5,001 data rows persists4,999 and returns success. Permissive parseNum accepts12oops; entirely nonnumeric selected amounts write measured zero. Fetches lack abort signal. Auto-refresh reuses this route. Independent Revenue chunking safeguards do not cover Spend. Reject partial/invalid data and validate refresh/recovery/source totals.

**Implementation / validation:** Forward correction VERIFIED LOCALLY in the [October 23 Sheets Spend checkpoint](#sheets-spend-correction-checkpoint-october-23). Committed in `b650b631` on base `e635fe50` and deployed in `eb3fca00`; public checks pass, while required source/provider acceptance remains open. See exact changed paths, failing/fixed/neighbor/PostgreSQL checks, intentional maintenance-API change and remaining provider/lifecycle/historical-data gates there. Release acceptance remains OPEN.

### V1-051

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained Sheets completeness/scope gap):

Main GET21785/21987 and `auto-refresh-scheduler.ts:813` read A1:Z1000. Exact refresh fixture caches999 rows as fresh without completeness check; page warns but aggregate consumers sum cached rows. Composite lookup can substitute another tab21834 and summary can broaden unmatched campaign to all rows22330. Scope/date/partial-data contracts must be enforced or effectively excluded.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-065

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Sheets header data loss):

`routes-oauth.ts:5609–5620` duplicate headers overwrite earlier values before validation. Exact GA4 Revenue process fixture `[Revenue,Revenue]`/`[100,7]` persists7. Strict CSV Revenue's duplicate-header rejection does not cover Sheets.

**Implementation / validation:** Forward correction verified locally in the [October 23 Sheets Revenue checkpoint](#sheets-revenue-correction-checkpoint-october-23). Committed in `ace32e7b`, deployed in `e635fe50`; public deployment checks pass, required source/provider acceptance remains open. See the exact root cause, changed paths, failing/fixed/neighbor/persistence tests and remaining lifecycle/provider/historical-data limits there. Release acceptance remains OPEN.

### V1-066

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Sheets currency mislabel):

Sheets Revenue amount helper accepts `$`; process1456 strips it while5719–5731 checks only configured currency. Exact EUR fixture persists `$100` as100EUR without conversion. Malformed12oops control correctly rejects; preserve that existing syntax validation.

**Implementation / validation:** Forward correction verified locally in the [October 23 Sheets Revenue checkpoint](#sheets-revenue-correction-checkpoint-october-23). Committed in `ace32e7b`, deployed in `e635fe50`; public deployment checks pass, required source/provider acceptance remains open. See the exact root cause, changed paths, failing/fixed/neighbor/persistence tests and remaining lifecycle/provider/historical-data limits there. Release acceptance remains OPEN.

### V1-067

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed refresh scope expansion):

`auto-refresh-scheduler.ts:587–626` ignores stored singular campaignValue, although Revenue save5442 accepts and preserves it. Exact refresh fixture changes selected10 into all-rows100; array-selection control stays10. Restore exact saved selection across save/preview/refresh and all downstream values; inventory potentially damaged sources separately.

**Implementation / validation:** Forward correction verified locally in the [October 23 Sheets Revenue checkpoint](#sheets-revenue-correction-checkpoint-october-23). Committed in `ace32e7b`, deployed in `e635fe50`; public deployment checks pass, required source/provider acceptance remains open. See the exact root cause, changed paths, failing/fixed/neighbor/persistence tests and remaining lifecycle/provider/historical-data limits there. Release acceptance remains OPEN.

### V1-068

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained manual Spend bypass/failure):

`routes-oauth.ts:5953,6010–6189` accepts caller sourceType; GA4 manual rejection is bypassed with sourceType=csv, persisting100 as CSV without a file. Non-GA4 insert failure is swallowed and returns success. Three exact handler cases include the normal GA4 rejection control. Enforce supported source creation paths and atomic truthful outcomes; do not silently delete existing records.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-069

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained transfer loss):

`routes-oauth.ts:33549,33626,33665`: GA4 and LinkedIn same-campaign transfer deletes newly copied and original connections but reports success. Sheets copy omits tab/purpose/auth-method/service-account/mappings/cache; GA4 forces access_token method. Three exact handler fixtures prove deletion/omissions. No current frontend caller found; retained API remains reachable.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-070

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed cleanup crosses source context):

`routes-oauth.ts:1571–1610,2520` groups Sheets Spend duplicates without platform/currency, reads all contexts and deletes all but earliest. Exact fixture deactivates legitimate LinkedIn EUR source beside GA4 USD using same mapping. Non-atomic delete steps and no expected-state check compound risk. Must prove exact damaged boundary before permitting cleanup; no live cleanup performed.

**Implementation / validation:** Forward correction VERIFIED LOCALLY in the [October 23 Sheets Spend checkpoint](#sheets-spend-correction-checkpoint-october-23). Committed in `b650b631` on base `e635fe50` and deployed in `eb3fca00`; public checks pass, while required source/provider acceptance remains open. See exact changed paths, failing/fixed/neighbor/PostgreSQL checks, intentional maintenance-API change and remaining provider/lifecycle/historical-data gates there. Release acceptance remains OPEN.

### V1-071

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN. See the [current correction checkpoint](#first-correction-checkpoint--october-22).

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed silent signed-amount omission):

GA4 CSV Revenue amount validator `utils/csv.ts:43` accepts−10 but aggregate105 and route4998 drop it. Exact handler saves100 from selected100/−10 with success. Define imported adjustment policy explicitly; accept/reconcile or reject unsupported amounts before mutation. Raw mapping retains the negative while records do not; every downstream total can therefore diverge from the uploaded file.

**Implementation / validation:** The forward-path correction in `c3806282` is VERIFIED LOCALLY in the [October 22 checkpoint](#first-correction-checkpoint--october-22), including exact paths, reproduction, regression evidence and limitations. Deployed/provider, complete downstream lifecycle and historical-data acceptance remain OPEN.

### V1-072

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN. See the [retained CSV correction checkpoint](#retained-csv-revenue-correction-checkpoint-october-23).

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained CSV loss/truncation):

`routes-oauth.ts:4813,5154–5178`: non-GA4 Revenue CSV accepts50,000 rows but saves49,999; LinkedIn conversion-value edit updates source and deletes old records before returning400 for invalid replacement. Both exact-handler fixtures reproduced. Validate before mutation and replace atomically within the existing storage architecture.

### V1-073

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN. See the [current correction checkpoint](#first-correction-checkpoint--october-22).

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed isolated PostgreSQL parent-write gap):

`storage.ts:1256–1262,2832`: ordinary GA4 input wrapper ignores an empty campaign lock query and commits child writes after parent deletion. Exact methods against isolated schema reproduce zero parents/one source/one record; existing-parent control passes. Current source schema lacks campaign FKs. Durable-table/deployed-schema/other-source variants remain required. Reject vanished parents at final write and verify all caller lifecycles.

**Implementation / validation:** The forward-path correction in `c3806282` is VERIFIED LOCALLY in the [October 22 checkpoint](#first-correction-checkpoint--october-22), including exact paths, reproduction, regression evidence and limitations. Deployed/provider, complete downstream lifecycle and historical-data acceptance remain OPEN.

### V1-102

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed bounded resource-budget gap):

`server/services/custom-integration-file-parser.ts:371–399` synchronously inflates all ZIP entries without expanded/aggregate limits. A14,046-byte fixture expands12,584,919 bytes including unused padding and succeeds; no exhaustion was induced. Mailgun33943 parses arbitrary attachment count before signature; manual upload28186 correctly authorizes first. [Boundary and acceptance](../../audits/v1-2026-10-19/CUSTOM_IMPORT_AND_PUBLIC_ENTRYPOINTS.md). Protect expanded/cell/attachment work independently of compressed per-file size.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-103

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed XLSX selection ambiguity):

`server/services/custom-integration-file-parser.ts:344–367` selects the first archive worksheet, ignoring workbook visible order/hidden state. Identical worksheets/workbook yield Spend10 versus200 solely from ZIP entry order; hidden200 is accepted with confidence100/reviewfalse. [Actual parser cases](../../audits/v1-2026-10-19/xlsx-boundary-reproductions.json). Define explicit supported worksheet selection and reject ambiguity before downstream publication.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-108

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed measured-zero state loss):

`routes-oauth.ts:25238–25258`, `tiktok-analytics.tsx:839` require positive Revenue for source availability. Exact case with an existing source and measured0 returns null/source-required. [Paid evidence](../../audits/v1-2026-10-19/RETAINED_PAID_VALUE_BOUNDARIES.md). Standalone Sheets `google-sheets-data.tsx:979–987,1130,1165` independently shows valid0 Revenue/Spend as Not connected and blocks derived values/options; [four zero/negative cases and positive control](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Distinguish zero, absent source and failed read before computing loss/zero ROAS.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-111

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Custom financial failure-to-value):

`custom-integration-analytics.tsx:641–672,735–760,3094,3131,3185–3202` converts failed/malformed Revenue totals to0 and derives availability from a separate successful source list. Actual query/transform cases show confirmed Revenue0/Spend100/ROAS0/ROI−100 after a failed Revenue request; failed external Spend can present imported100 as the complete total. [Evidence and zero control](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Preserve error/partial/stale state through financial cards and source-backed consumers.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-112

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Sheets ratio-consumer divergence):

`google-sheets-data.tsx:1479–1517` builds KPI/Benchmark options from raw summed metrics, ignoring server summaryValue. Spend190/Clicks110/CPC rows1+9 gives Summary1.72727 but options10 and actual browser PDF$10. Scheduled cached summary `report-scheduler.ts:3474–3522` also sums arbitrary metric/identifier columns. [Exact helpers and rendered artifact](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Preserve one verified aggregation contract through Summary, goals, Insights and every report; server refresh/alert propagation remains open.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-113

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Sheets scheduled report scope mismatch):

`auto-refresh-scheduler.ts:865–881` caches unfiltered rows; `report-scheduler.ts:3474–3522,3572–3707` selects a connection but ignores its selected campaign values and report date window. Actual PDF labelled campaignA/October2026 printsSpend100 including campaignB/2020Spend90; mappedA amount is10. [PDF, fixture and scope controls](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Enforce saved selection and actual date coverage before generation, send or snapshot; do not silently apply an arbitrary date column.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-114

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Sheets summary formula ambiguity):

`routes-oauth.ts:21722–21781` uses first matching financial header and unweighted rate averages. Actual helper cases choose Budget1000 before actual Spend100 (ROAS0.2 instead of2 for Revenue200), and unequal-impression CTR rows1%/100% produce50.5% instead of count-derived1.9802%. [Exact cases](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Define explicit metric/denominator mappings, fail closed on ambiguity and preserve bounded/undefined rates; column order must not redefine actual spend.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-120

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Custom metric meaning change):

`server/services/custom-integration-file-parser.ts:28,35–41,217–264` aliases sent→delivered, opens count→open rate, exit rate→bounce rate and new subscribers→list growth. Exact CSV1000/50/20/30 becomes those four fields with confidence100/reviewfalse; client displays opens50 as50.00%. [All28-field evidence and boundaries](../../audits/v1-2026-10-19/CUSTOM_IMPORT_AND_PUBLIC_ENTRYPOINTS.md). Require supported metric definitions/denominators or reject ambiguous mappings before publication; historical correction needs exact original source evidence.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-126

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN. See the [current correction checkpoint](#first-correction-checkpoint--october-22).

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed modest-load onboarding blocker):

`middleware/rateLimiter.ts:44–59` shares five imports/IP/five minutes across preview and save. Revenue wizard1507/1604 needs both; handlers4698/4735 share the bucket. [Actual HTTP/DB five-user fixture](../../audits/v1-2026-10-19/HTTP_DATABASE_PILOT.md): five valid previews succeed, all five saves429/retryAfter300, no sources written. Preserve abuse limits while accommodating authenticated users/workflow; no production traffic used.

**Implementation / validation:** The forward-path correction in `c3806282` is VERIFIED LOCALLY in the [October 22 checkpoint](#first-correction-checkpoint--october-22), including exact paths, reproduction, regression evidence and limitations. Deployed/provider, complete downstream lifecycle and historical-data acceptance remain OPEN.
