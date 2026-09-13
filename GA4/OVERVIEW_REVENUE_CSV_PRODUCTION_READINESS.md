# GA4 Overview CSV Revenue Production-Readiness Evidence

Last updated: 2026-09-13 (Europe/Amsterdam)

Base revision: `ffb12f8d7c316be757f8490e5ede9298cdebf8a` on `main`, plus the uncommitted CSV-only working-tree changes listed below.

## Anti-Overclaim Status

Current decision: **not clean-certified; the corrected artifact passed the reversible deployed CSV packet, but the new GA4 browser size guard is only locally proven, the direct 10 MiB API path still returns HTTP 500, and cross-owner, forced-failure, configured KPI/Benchmark, and report/PDF evidence remain open**.

The current uncommitted browser guard passed all 36 focused CSV Revenue tests, TypeScript validation, and the production build. Production `/api/health` returned HTTP 200 with evidence commit `ffb12f8d7c316be757f8490e5ede9298cdebf8a` at `2026-09-13T07:46:09.889Z`; that deployment does not yet include the browser guard.

One certification gate remains:

1. resolve or explicitly accept the deployed 10 MiB HTTP 500 behavior and obtain the still-open cross-owner, forced-failure, configured KPI/Benchmark, and report/PDF evidence listed below.

Do not describe CSV Revenue as clean-certified until the remaining gate is closed.

## Scope

Included:

- GA4 Overview -> Revenue -> Upload CSV;
- preview, mapping, full-file import, exact campaign filtering, optional Date mapping, and source naming;
- edit from retained rows, campaign-selection edit, re-upload replacement, and individual delete;
- file/row bounds, malformed/ambiguous structures, amounts, dates, and campaign currency;
- campaign ownership, source ownership, additive-source behavior, duplicate requests, overlapping edits, transactions, rollback, and post-commit response semantics;
- active source list, source breakdown, source-to-date totals, daily rows, Total Revenue, Profit, ROAS, ROI, CPA non-effect, KPI/Benchmark current values, alerts, Campaign DeepDive financial consumers, and scheduled report reads;
- current persisted GA4 CSV source/record integrity through a read-only transaction.

Excluded and unchanged:

- Google Sheets, HubSpot, Salesforce, Shopify, manual revenue, and CSV revenue for non-GA4 platform contexts;
- GA4 provider formulas and native GA4 revenue selection;
- spend-source behavior;
- public response field names and shapes;
- `APP_PRODUCTION_READINESS.md`;
- email-provider acceptance/delivery and deployed generated-artifact contents;
- permanent cleanup of inactive legacy rows;
- multi-runtime/process-wide duplicate coordination and persistent retry idempotency.

## Product And Scheduler Contract

CSV Revenue is a **manual source**.

- Users add or replace CSV data through the Revenue wizard.
- Selecting a Date column changes materialization grain to daily rows; it does not make the file refreshable.
- With no Date column, the selected positive revenue is stored as a source-to-date snapshot on the campaign's latest completed reporting day.
- `server/auto-refresh-scheduler.ts` selects Google Sheets and provider sources by explicit source type and does not select `csv` or call a CSV reprocessor.
- The UI says both `Requires manual re-upload to update` and `CSV data won't auto-update`.

Therefore source-refresh scheduler behavior is inapplicable. Scheduled KPI/Benchmark/report jobs remain applicable only as downstream readers of already-materialized CSV records; they do not alter CSV source rows.

## Supported Input Contract

### File and structural limits

- Upload middleware accepts CSV MIME types or a `.csv` filename and caps the file at 10 MiB. The uncommitted GA4 browser guard applies the same bound before preview and again before process submission.
- The browser preview/import flow supports at most 5,000 non-empty logical data rows and displays that bound.
- The process endpoint independently caps GA4 CSV parsing at 50,000 non-empty logical data rows as a defensive API bound.
- The strict GA4 parser counts logical records, so embedded newlines inside quoted fields do not create false row-limit failures.
- The parser accepts UTF-8 with an optional BOM, CRLF/LF/CR line endings, comma/semicolon/tab/pipe delimiters, escaped quotes, delimiters in quoted fields, and newlines in quoted fields.
- It rejects non-UTF-8 replacement/binary characters, ambiguous header delimiters, unclosed/illegal quotes, blank or duplicate headers, header-only files, and rows whose column count differs from the header.
- Over-limit files fail; they are not partially parsed or silently truncated.

The shared 10 MiB Multer bound is locally established from configuration. The deployed direct API renders its rejection as HTTP 500; the GA4 browser guard that prevents the normal product flow from reaching that shared error is locally proven but not yet deployed-validated.

### Mapping and selection

- Revenue is required.
- Campaign identifier is optional. With no campaign mapping, every valid positive-revenue row is imported.
- When Campaign is mapped, at least one value is required and matching is exact, trimmed, and case-sensitive.
- Initial GA4 preview exposes all rows within the supported 5,000-row browser bound for complete campaign-value search.
- Edit mode reconstructs preview/search rows from the complete retained `csvStoredRevenueRows`, not the old 25-row sample.
- Revenue, Campaign, and Date roles must reference existing headers and cannot collide.
- Mapping validation completes before source mutation.

### Amounts and currency

- Blank, zero, negative, and non-numeric amounts do not contribute revenue.
- Selected nonblank amounts must be complete plain/US-grouped numbers with no more than two decimal places.
- Partial numeric text, scientific notation, locale-ambiguous decimal grouping, space grouping, unsupported symbols, and values outside the `numeric(12,2)` per-source bound are rejected before mutation.
- `$` is accepted only for a USD campaign; non-USD campaigns must use symbol-free values.
- The request mapping currency must equal the campaign currency.
- Persisted source and record currencies are forced to the campaign currency.
- Source-backed GA4 reads independently fail closed on active record/source currency mismatch.
- The selected aggregate is capped at `9,999,999,999.99`, preserving the database's two-decimal revenue boundary and deterministic cents.

### Dates

- Date is optional.
- Selected positive-revenue rows accept only `YYYY-MM-DD` or an ISO-style timestamp whose leading date is a valid calendar date.
- Slash dates, natural-language dates, impossible dates/times, numeric serials, blank dates, and arbitrary parseable strings are rejected as invalid or ambiguous before mutation.
- When Date is mapped, aggregate records are materialized per normalized date; optional attribution detail rows do not double-count because readers prefer the aggregate record grain.
- Future valid date keys may be retained, but to-date/Overview reads include them only once the requested/current date window reaches them.

## End-To-End Trace

### Upload/add

1. `AddRevenueWizardModal.tsx` opens the existing campaign-scoped Revenue flow and posts the file to `/api/campaigns/:id/revenue/csv/preview`.
2. `requireCampaignAccessParamId` runs before Multer parsing; unauthenticated, missing, ownerless, and cross-owner campaigns fail closed.
3. GA4 preview uses strict parsing and returns the existing `fileName`, `headers`, `sampleRows`, and `rowCount` shape.
4. The process route validates platform context, mapping JSON, role existence/collisions, campaign selection, strict amounts, strict dates, campaign currency, positive rows, and the aggregate ceiling before storage.
5. `replaceGa4CsvRevenueSourceWithRecords` inserts a new active `csv`/`ga4` source and normalized records explicitly marked `sourceType: csv` inside one database transaction.
6. Revenue sources remain additive. A distinct completed add is a separate source by design.
7. A best-effort derived-value recompute follows commit. A fast recompute failure is logged without falsely returning an import failure after the source transaction already committed.
8. The client invalidates/refetches the source, total, breakdown, daily, GA4 breakdown, KPI, Benchmark, notification, outcome, executive-summary, trend, and report query families.

### Edit and re-upload

- A campaign-selection-only edit can reprocess the complete retained normalized rows without a new file.
- Structural role or value-mode changes without a file fail closed and require re-upload.
- Selecting a new file clears stale file-specific selections and rebuilds the complete supported preview.
- Edit replaces only the exact active GA4 CSV source and only same-campaign records.
- The update predicate includes the mapping configuration read before processing. A concurrent edit/delete that changes the source first causes `CSV_REVENUE_SOURCE_CHANGED`/HTTP 409 before old records are deleted.

### Delete

- The individual delete route proves campaign access, loads the exact campaign/source, verifies optional platform context, and deactivates the source plus deletes only same-campaign records in one transaction.
- A missing/stale source returns 404 and changes nothing.
- A transaction failure rolls back source and record changes.
- A fast post-commit derived recompute failure is logged while the response still accurately reports the committed delete.
- Inactive source definitions and retained legacy records are excluded from live totals by the active-source inner join.

### Source list, totals, and daily reads

- `/api/campaigns/:id/revenue-sources?platformContext=ga4` returns active campaign-scoped definitions and merges materialized source amounts without converting a real zero to unavailable.
- `/api/campaigns/:id/revenue-to-date?platformContext=ga4` and `/revenue-breakdown` join source and records on source ID while requiring both campaign IDs, active source status, GA4/null context, date window, materialization completeness, and campaign currency integrity.
- `/api/campaigns/:id/revenue-daily` includes CSV only when the retained mapping has a Date column; snapshot CSV sources do not pretend to be daily history.
- Aggregate records are selected over same-source attribution-detail rows, preventing double counting.

## Transaction, Duplicate, Overlap, And Last-Good Matrix

| Case | Current behavior | Evidence boundary |
| --- | --- | --- |
| Invalid preview/mapping/amount/date/currency/total | Fails before storage mutation | Dynamic parser/validator tests plus route-order guards |
| Add source insert succeeds, record insert fails | Transaction rolls back new source | Mocked transaction test |
| Edit source update fails | No record deletion or insertion | Mocked transaction test |
| Edit record deletion fails | Source metadata and last-good records roll back | Mocked transaction test |
| Edit replacement insertion fails | Source metadata and last-good records roll back | Mocked transaction test |
| Concurrent identical add in one server runtime | SHA-256 request/file fingerprint returns 409 to the duplicate while the first is in flight | Static route guard; deployed concurrency still open |
| Overlapping edit/delete | Expected mapping plus active/campaign/type/context predicate makes the stale writer fail before record deletion | Mocked stale update plus static SQL guard; deployed overlap still open |
| Cross-campaign damaged row references the same source ID | Replacement deletes only records matching both source and campaign; unrelated damaged row is retained for explicit review | Static storage guard; target inventory currently has no such row |
| Post-commit recompute rejects quickly | Committed source result remains a success; error is logged; direct source reads are current and derived caches retry on later readers/jobs | Static route guard; injected deployed failure not exposed |

Boundaries: the in-memory duplicate guard is intentionally limited to one server runtime and one in-flight request. Persistent sequential replay protection would require an explicit idempotency contract and is not inferred. It remains outside clean certification unless the deployed topology or product contract requires it.

## Downstream Propagation Matrix

| Consumer | CSV Revenue effect | Current evidence |
| --- | --- | --- |
| Source list | Exact active source and materialized amount | Local route/storage guards; deployed current artifact open |
| Imported revenue to date | Adds the exact active CSV aggregate once | Dynamic/local |
| Total Revenue | Native selected GA4 financial revenue + active imported CSV revenue | Dynamic/local |
| Profit | Increases by the exact CSV revenue delta when spend is fixed | Dynamic/local |
| ROAS | Recomputed from updated revenue / unchanged spend | Dynamic/local |
| ROI | Recomputed from `(revenue - spend) / spend` | Dynamic/local |
| CPA | Unchanged because CSV Revenue does not change spend or conversions | Dynamic/local |
| Revenue source selector | Exact source ID is available to campaign KPI/Benchmark configuration | Static/local |
| Campaign KPI/Benchmark current value | `getCampaignMetricTotals` reads active source-backed total/breakdown and recomputes selected financial values | Local regression packet |
| Alerts/notifications | Later KPI/Benchmark evaluation reads the recomputed/source-backed value; CSV mutation invalidates notification queries | Local trace; deployed alert recreation open |
| Performance/Executive Summary | Uses the same campaign financial totals | Local regression packet |
| Financial Analysis | Reads GA4 source breakdown through the report/screen aggregate | Local regression packet |
| Campaign DeepDive and scheduled PDF | Scheduler resolves UI-aligned campaign totals and source breakdown before artifact creation | Local scheduled-PDF regression; deployed artifact open |
| Email delivery | May carry a report that consumed CSV values, but provider acceptance/delivery is not CSV-source certification evidence | Excluded/unvalidated |

## Confirmed Root Causes And Localized Fixes

1. The old raw-line `+5` guards and parser break condition could reject quoted newlines, accept inconsistent effective caps, and silently truncate before processing. GA4 CSV now uses an exact strict logical-record parser.
2. Malformed quote state, duplicate/blank headers, mixed row widths, ambiguous delimiters, non-UTF-8 replacement data, partial/locale amounts, over-precision, and ambiguous dates could be silently interpreted. GA4 CSV now rejects them before mutation.
3. The frontend required a Campaign mapping even though the server/product contract supports importing the full file. Campaign scope is now optional end to end.
4. Campaign values were discovered from only the first 25 rows, including retained edit previews. The supported preview and retained-row edit paths now expose the complete bounded value set.
5. GA4 CSV replacement deleted records by source ID without also requiring campaign ID. The transaction now uses both keys.
6. Two overlapping edits had no compare-and-swap boundary. The route reads the exact source before processing and the transaction requires the same mapping configuration.
7. Simultaneous identical add requests could create two additive sources. One-runtime in-flight fingerprinting now rejects the duplicate with 409.
8. A quick derived recompute rejection after commit could return HTTP 500 even though upload/delete had committed. CSV-only post-commit recompute failures now log while preserving accurate mutation success.
9. The deployed edit modal rebuilt retained rows from mapped fields only but continued to display every original CSV header. That exposed blank, unusable choices such as an initially unmapped `description` column. GA4 edit mode now limits a no-file retained preview to the fields actually retained; re-upload continues to expose the new file's full headers.
10. The deployed 10 MiB limit safely rejects an oversized file before mutation, but Multer's `LIMIT_FILE_SIZE` error has no HTTP status and the shared global handler therefore renders it as HTTP 500. Changing that shared pre-body boundary would affect excluded upload paths, so the smallest safe fix adds GA4-only browser guards before both preview and process requests. The direct API response remains unchanged and unclean.

Files changed for these fixes/evidence:

- `client/src/components/AddRevenueWizardModal.tsx`
- `server/routes-oauth.ts`
- `server/storage.ts`
- `server/utils/csv.ts`
- `server/csv-revenue-certification.test.ts`
- `server/csv-revenue-transaction.test.ts`
- `server/csv-revenue-damaged-data-inventory.test.ts`
- `scripts/csv-revenue-inventory-readonly.ts`
- `scripts/csv-revenue-deployed-authorized-validation.ts`
- this document

No GA4 formula, other revenue-source implementation, public response shape, or `APP_PRODUCTION_READINESS.md` was changed.

## Current Local Evidence

### Proven locally

- Required reference documents were read in mandated order before edits.
- Base branch/revision: `main` / `51f04fe2e25b01ba79e4d20383f33f9ed7f3a092`.
- Pre-change focused baseline: 7 files, 49/49 tests passed.
- Final clean focused packet on 2026-09-13: 17 files, 119/119 tests passed.
- Final CSV core packet after the amount/currency precision guard: 4 files, 26/26 tests passed.
- Final post-provenance CSV transaction/downstream packet: 3 files, 22/22 tests passed.
- `npm run check`: passed after final code changes.
- `npm run build`: passed after final code changes; Vite transformed 3,470 modules and the server bundle completed.
- Follow-up edit-preview correction on 2026-09-13: focused CSV packet passed 15/15, `npm run check` passed, and the production build passed with 3,470 modules transformed.
- The authorized deployed validation runner passed `npm run check` before execution and again after its evidence-field normalization correction.
- Broad source-safety packet: all CSV preview/process and individual revenue-delete ownership assertions passed. The file overall passed 78/88 and failed 10 unrelated stale Instagram/Google Ads/static-shape assertions.
- Expanded adjacent packet: 137/138 tests passed. The sole failure is an unrelated stale Salesforce static expectation in `latest-day-revenue-regression.test.ts`; `git show HEAD` proves its expected string was already absent from the base modal, and the CSV diff does not touch Salesforce behavior.

Passing focused files:

- `csv-revenue-certification.test.ts`
- `csv-revenue-validation.test.ts`
- `csv-revenue-transaction.test.ts`
- `csv-revenue-downstream-propagation.test.ts`
- `csv-revenue-damaged-data-inventory.test.ts`
- `csv-revenue-deployed-validation-runner.test.ts`
- `revenue-source-delete-transaction.test.ts`
- `ga4-auto-refresh-regression.test.ts`
- `google-sheets-revenue-amount-validation.test.ts` (adjacent shared-helper non-regression)
- `overview-revenue-materialization-regression.test.ts`
- `overview-revenue-currency-total-regression.test.ts`
- `campaign-current-value-financial-source-regression.test.ts`
- `campaign-financial-analysis-regression.test.ts`
- `performance-summary-scheduler-regression.test.ts`
- `performance-summary-scheduled-pdf.test.ts`
- `ga4-financial-source-parity.test.ts`
- `ga4-financial-rules.test.ts`

Local tests use dynamic pure-function and mocked transaction coverage plus static source-path guards. They are not a substitute for deployed PostgreSQL concurrency, browser, or generated-artifact evidence.

### Current target-database read-only evidence

Command: `npx tsx --env-file=.env scripts/csv-revenue-inventory-readonly.ts`

Final scan: `2026-09-12T23:08:08.851Z` (`2026-09-13` Europe/Amsterdam), inside `BEGIN TRANSACTION READ ONLY`, followed by `ROLLBACK`.

- 57 campaigns scanned.
- 11 GA4 CSV source definitions.
- 1 active GA4 CSV source.
- 19 records linked to GA4 CSV sources.
- Active-source findings: zero.
- Supplemental active currency, record-currency, retained-amount, retained-date, and duplicate-source findings: zero.
- No active zero-record source, incomplete retained mapping, stored/materialized total mismatch, dated-row loss, duplicate record grain, orphan record, cross-campaign record, or wrong-source-type record was found.
- Five known inactive sources retain 17 records: `a9f8f8b7-24d6-4a15-87ba-e16faa202823` (1), `7b751b6d-d43d-4be3-970e-8559492d86ad` (1), `33e1de1d-5426-4d5c-ab29-6c0fe076fe87` (7), `24416e0b-a65d-45cb-86d4-68a69d4473a9` (7), and `d87ca77c-d995-49ae-8d8e-7c9500d33fd6` (1).

Those inactive rows are excluded from live reads by the active-source join. Their existence is still a persisted-data finding, so the inventory's overall `pass` is false. No active analytics discrepancy was found.

Final post-deployed-test scan: `2026-09-13T06:47:42.852Z`, inside `BEGIN TRANSACTION READ ONLY`, followed by `ROLLBACK`.

- 57 campaigns, 13 GA4 CSV source definitions, 1 active source, and 19 linked records were scanned.
- Active-source, currency, record-currency, retained-amount, retained-date, duplicate-active-source, orphan, cross-campaign, wrong-type, mapping, stored/materialized-total, dated-row-loss, and duplicate-record findings were all zero.
- The same five pre-existing inactive legacy groups retained the same 17 records; no new inactive record group was created.
- Compared with the pre-test scan, the two controlled add/delete runs left two inactive zero-record source definitions, while the active count and linked-record count returned to their exact pre-test values. This matches the current soft-delete-source/hard-delete-record contract and does not affect live reads.
- No cleanup was performed or authorized.

Final post-automated-validation scan: `2026-09-13T07:13:41.188Z`, inside `BEGIN TRANSACTION READ ONLY`, followed by `ROLLBACK`.

- 57 campaigns, 16 GA4 CSV source definitions, 1 active source, and 19 linked records were scanned.
- Active-source and supplemental findings remained zero; the same five pre-existing inactive groups retained the same 17 records.
- The authorized automated run added and then deleted three exact temporary sources. It moved the target campaign from 2 to 5 inactive zero-record definitions while restoring its active source IDs, active revenue, and active record count exactly to `[]`, `0`, and `0`.
- Global active source and linked-record counts remained exactly at their pre-test values. No new inactive record group or cleanup candidate was created.

## Manual Deployed Evidence

Historical only:

- On 2026-07-12, an older CSV implementation had user-confirmed add/edit/filter/delete behavior and one invalid-file no-mutation check.
- Exact current working-tree strict parsing, optional full-file import, complete value discovery, currency/precision bounds, duplicate guard, overlap predicate, post-commit behavior, and current report propagation were not part of that deployed artifact.

Current artifact:

- Production deployment of exact commit `5329fe2516afaf64963be0826f2aaa05967486e8` was confirmed through `/api/health` at `2026-09-13T06:07:51.426Z`.
- A temporary dated CSV source was added through the deployed browser, its edit modal was opened, and the exact temporary source was subsequently deleted by the user.
- The edit screenshot showed `date` and `amount` retained but an initially unmapped `description` header displayed with blank values. This is failed deployed evidence for that edit-preview state, not clean lifecycle evidence.
- Root cause: `csvStoredRevenueRows` intentionally retains mapped fields, while the client used the broader original `csvHeaders` list when reconstructing the no-file edit preview.
- The localized client correction was committed as `8735e778ba843c89e506717c3430040458b50ef7`; production `/api/health` confirmed that exact SHA at `2026-09-13T06:41:44.600Z`.
- After a hard refresh, the user repeated the temporary add/edit/delete flow on `8735e778` and confirmed that the no-file edit preview showed only retained `date` and `amount`; the blank `description` header no longer appeared. The temporary source was deleted.
- Authorized target campaign: `eee3e654-b736-4e8e-86ec-1050e4d905c0`; run completed at `2026-09-13T07:12:34.990Z` against exact SHA `8735e778ba843c89e506717c3430040458b50ef7`.
- Proven through authenticated deployed API plus read-only database before/after evidence: all 30 preview rows including campaign values after row 25; exact campaign-filtered dated add; daily records; campaign-selection edit without re-upload; exact-source replacement by re-upload; no-date snapshot materialization; revenue-to-date delta; unchanged spend; source-list/breakdown value parity; over-5,000 UI row rejection; over-50,000 process-row rejection; ambiguous structure, amount, date, currency, and no-positive-row rejection without mutation; simultaneous identical add `200/409`; overlapping edit `200/409`; exact-source cleanup and baseline restoration.
- The source-list assertion initially reported a validation-helper false negative because it omitted the existing `lastTotalRevenue` field. The captured source row and breakdown row both contained `75`; the helper now reads that field and passes TypeScript validation. No application contract or response changed.
- The 10 MiB request was rejected without mutation but returned HTTP 500 with `File too large`; size-limit error rendering therefore fails clean certification.
- The uncommitted GA4-only browser guard rejects files above the same 10 MiB bound before both preview and process fetches. All 36 focused CSV Revenue tests, `npm run check`, and `npm run build` passed locally; deployed browser validation is still required.
- Unauthenticated campaign access was rejected. Cross-owner evidence remains unvalidated because no separate non-owner identity was authorized.
- KPI, Benchmark, and report endpoints returned HTTP 200, but the disposable campaign has zero configured KPIs, Benchmarks, and reports. Configured-value propagation and current report/PDF content therefore remain unvalidated rather than inferred.
- No deployed forced database failure hook exists; transactional rollback remains local mocked evidence unless an approved safe staging failure injection is provided.

## Damaged-Data And Cleanup Boundary

The inventory is read-only and returns exact source/record candidates. It never deactivates, deletes, merges, rewrites, backfills, or invents dates/allocations.

No cleanup is authorized. The five inactive legacy groups do not affect active totals and must not be removed without a separate targeted plan containing exact campaign/source/record boundaries, before/after totals, rollback, and unrelated-source checks.

## Certification Gate

CSV Revenue can receive a stable clean-certification answer only when the exact committed/deployed artifact has passed:

- normal add with and without campaign filtering;
- complete campaign-value discovery beyond the first 25 rows;
- dated daily materialization and snapshot behavior;
- edit without re-upload and replacement by re-upload;
- malformed structure, amount/date/currency, 10 MiB, 5,000-row UI, and no-positive-row no-mutation cases;
- simultaneous identical add and overlapping edit behavior on the deployed topology;
- exact campaign/cross-owner rejection;
- source list, to-date total, breakdown, Total Revenue, Profit, ROAS, ROI, CPA non-effect, KPI/Benchmark, and report/PDF propagation;
- exact-source delete and restoration to the pre-test baseline;
- final deployed read-only inventory with no new active or inactive damage created by the test.

Until then, the stable answer is:

> CSV Revenue is not clean-certified. Evidence commit `ffb12f8d` passed the reversible deployed lifecycle, negative, concurrency, totals, and cleanup packet, and final inventory found no new active or record-level damage. The uncommitted GA4 browser size guard is locally proven, but the direct oversized-file API response remains HTTP 500; cross-owner, deployed forced rollback, configured KPI/Benchmark propagation, and current report/PDF content also remain unvalidated.
