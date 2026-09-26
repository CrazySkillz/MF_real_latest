# GA4 Overview CSV Revenue Production-Readiness Evidence

Last updated: 2026-09-13 (Europe/Amsterdam)

Certified application revision: `b2fd97a9af8b51a5cea88a6f88b2b3e0c8a4b6cc` on `main`. Evidence is recorded through that exact deployed commit, including the CSV edit-entry, replacement-file mapping reset, source-card layout, picker delete control, and additive-file action/copy corrections.

## Anti-Overclaim Status

Current decision: the documented CSV Revenue contract is clean-certified at exact deployed application commit `b2fd97a9af8b51a5cea88a6f88b2b3e0c8a4b6cc`. The user completed the eight-step disposable-campaign browser lifecycle for two separate additive files, source display and totals, pencil/re-upload replacement with deliberate remapping, individual deletion, and baseline restoration. The Add Revenue picker trash button itself was not the delete entry point used in that run, so that specific click remains locally proven rather than manually deployed-validated; it uses the same already validated exact-source delete handler and public route and does not create a separate analytics contract.

The browser guard passed all 36 focused CSV Revenue tests, TypeScript validation, and the production build. Production `/api/health` returned HTTP 200 with exact evidence commit `a9f7bc49b3213a73241ff7fd9520def82fd577c4` at `2026-09-13T08:23:28.357Z`. An authorized headless browser check completed at `2026-09-13T08:04:10.075Z`: the oversized warning rendered, the upload step stayed open, and zero preview requests reached the server. A cross-owner check completed at `2026-09-13T08:25:12.414Z`: source list, total, preview, process, and delete all returned privacy-preserving HTTP 404, and the foreign campaign's CSV source/record state was unchanged.

At `2026-09-13T08:46:08.199Z`, the user accepted both remaining limitations for the prior limited decision:

- direct requests above 10 MiB are rejected before mutation but render HTTP 500; the supported GA4 browser flow blocks them before making a request;
- rollback is proven by focused transaction tests, but no deployed fault injection was performed because no safe production hook exists.

That acceptance is not being used as clean evidence. Both former limitations are now closed by current evidence below. Zero required certification steps remain for the current corrections.

## Scope

Included:

- GA4 Overview -> Revenue -> Upload CSV;
- preview, mapping, full-file import, exact campaign filtering, optional Date mapping, and source naming;
- edit from retained rows, campaign-selection edit, re-upload replacement, and individual delete;
- file/row bounds, malformed/ambiguous structures, amounts, dates, and campaign currency;
- campaign ownership, source ownership, additive-source behavior, duplicate requests, overlapping edits, transactions, rollback, and post-commit response semantics;
- active source list, source breakdown, all-mapped-record totals, daily rows, Total Revenue, Profit, ROAS, ROI, CPA non-effect, KPI/Benchmark current values, alerts, Campaign DeepDive financial consumers, and scheduled report reads;
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
- With no Date column, the selected positive revenue is stored as one undated cumulative snapshot on the campaign's latest completed reporting day.
- `server/auto-refresh-scheduler.ts` selects Google Sheets and provider sources by explicit source type and does not select `csv` or call a CSV reprocessor.
- The UI says both `Requires manual re-upload to update` and `CSV data won't auto-update`.

Therefore source-refresh scheduler behavior is inapplicable. Scheduled KPI/Benchmark/report jobs remain applicable only as downstream readers of already-materialized CSV records; they do not alter CSV source rows.

## Supported Input Contract

### File and structural limits

- Upload middleware accepts CSV MIME types or a `.csv` filename and caps the file at 10 MiB. The deployed GA4 browser guard applies the same bound before preview and again before process submission.
- The browser preview/import flow supports at most 5,000 non-empty logical data rows and displays that bound.
- The process endpoint independently caps GA4 CSV parsing at 50,000 non-empty logical data rows as a defensive API bound.
- The strict GA4 parser counts logical records, so embedded newlines inside quoted fields do not create false row-limit failures.
- The parser accepts UTF-8 with an optional BOM, CRLF/LF/CR line endings, comma/semicolon/tab/pipe delimiters, escaped quotes, delimiters in quoted fields, and newlines in quoted fields.
- It rejects non-UTF-8 replacement/binary characters, ambiguous header delimiters, unclosed/illegal quotes, blank or duplicate headers, header-only files, and rows whose column count differs from the header.
- Over-limit files fail; they are not partially parsed or silently truncated.

The shared 10 MiB Multer bound is established from configuration. Deployed commit `c71677a0` translates `LIMIT_FILE_SIZE` to HTTP 413 only when an early multipart `platformContext=ga4` field proves GA4 scope. The GA4 client submits that field before the file; non-GA4 clients retain their previous field order and error path. Authenticated deployed preview and process requests both returned HTTP 413 with `File too large`, and exact database state before and after both requests was identical.

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
| Add source insert succeeds, record insert fails | Transaction rolls back new source | Mocked exact-method test; production engine rollback semantics additionally proven on replacement |
| Edit source update fails | No record deletion or insertion | Mocked transaction test |
| Edit record deletion fails | Source metadata and last-good records roll back | Mocked transaction test |
| Edit replacement insertion fails | Source metadata and last-good records roll back | Mocked exact-method test plus exact production PostgreSQL method/savepoint proof |
| Concurrent identical add in one server runtime | SHA-256 request/file fingerprint returns 409 to the duplicate while the first is in flight | Static route guard plus deployed simultaneous `200/409` proof |
| Overlapping edit/delete | Expected mapping plus active/campaign/type/context predicate makes the stale writer fail before record deletion | Mocked stale update, static SQL guard, and deployed overlapping edit `200/409` proof |
| Cross-campaign damaged row references the same source ID | Replacement deletes only records matching both source and campaign; unrelated damaged row is retained for explicit review | Static storage guard; target inventory currently has no such row |
| Post-commit recompute rejects quickly | Committed source result remains a success; error is logged; direct source reads are current and derived caches retry on later readers/jobs | Exact route guard plus focused post-commit response regression |

Boundaries: the in-memory duplicate guard is intentionally limited to one server runtime and one in-flight request. Persistent sequential replay protection would require an explicit idempotency contract and is not inferred. It remains outside clean certification unless the deployed topology or product contract requires it.

## Downstream Propagation Matrix

| Consumer | CSV Revenue effect | Current evidence |
| --- | --- | --- |
| Source list | Exact active source and materialized amount | Exact deployed `c71677a0` lifecycle |
| Imported revenue to date | Adds the exact active CSV aggregate once | Exact deployed `c71677a0` lifecycle |
| Total Revenue | Native selected GA4 financial revenue + active imported CSV revenue | Deployed reconciliation plus local formula-preserving regression |
| Profit | Increases by the exact CSV revenue delta when spend is fixed | Deployed source/total inputs plus local formula-preserving regression |
| ROAS | Recomputed from updated revenue / unchanged spend | Deployed configured KPI reconciliation plus local regression |
| ROI | Recomputed from `(revenue - spend) / spend` | Deployed configured KPI reconciliation plus local regression |
| CPA | Unchanged because CSV Revenue does not change spend or conversions | Deployed configured KPI reconciliation plus local regression |
| Revenue source selector | Exact source ID is available to campaign KPI/Benchmark configuration | Deployed configured-consumer evidence plus local guard |
| Campaign KPI/Benchmark current value | `getCampaignMetricTotals` reads active source-backed total/breakdown and recomputes selected financial values | Deployed configured KPI/Benchmark reconciliation plus local regression |
| Alerts/notifications | Later KPI/Benchmark evaluation reads the recomputed/source-backed value; CSV mutation invalidates notification queries | Exact source-backed job/client trace and focused regression; no production alert was induced |
| Performance/Executive Summary | Uses the same campaign financial totals | Deployed financial input reconciliation plus local regression |
| Financial Analysis | Reads GA4 source breakdown through the report/screen aggregate | Deployed breakdown reconciliation plus local regression |
| Campaign DeepDive and scheduled PDF | Scheduler resolves UI-aligned campaign totals and source breakdown before artifact creation | Existing deployed report snapshots plus current production-data PDF and scheduled-PDF regressions |
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
10. The deployed 10 MiB limit safely rejects an oversized file before mutation, but Multer's `LIMIT_FILE_SIZE` error has no HTTP status and the shared global handler therefore renders it as HTTP 500. The smallest safe server correction wraps only the two revenue CSV routes, returns the existing `{ message }` error shape with HTTP 413 only when an already-parsed multipart field proves `platformContext=ga4`, and forwards every other upload error unchanged. The GA4 client places that marker before its file; non-GA4 multipart order remains unchanged. The shared upload configuration, spend routes, formulas, and normal response contracts are untouched.
11. The CSV edit prefill unconditionally selected `csv_map`, so the Revenue Sources pencil bypassed the upload/re-upload step. The localized correction changes only that initial CSV edit step to `csv`; successful preview still advances to `csv_map`, and retained mapping state is unchanged.
12. Selecting a replacement file cleared its column choices and campaign-value selection but did not clear the retained platform campaign crosswalk. The localized correction adds the missing crosswalk reset to the replacement file input only, so each newly selected file requires deliberate campaign remapping while unrelated source state and API behavior remain unchanged.
13. The Revenue Sources modal rendered CSV through its generic one-row layout, placing the filename in the heading and the type below it. CSV now opts into the existing Shopify/Google Sheets single-source breakdown layout: `CSV` and its edit action remain in the heading, while the persisted filename, same-sized source total, and existing delete action share the detail row.
14. The Add Revenue picker showed `Uploaded` for an active CSV source but exposed no removal action. It now shows a confirmed trash action beside that status when exactly one active campaign/platform-scoped CSV source exists. The handler re-reads current sources before deletion and requires the same exact ID; multiple-source state fails closed and directs the user to Revenue Sources instead of guessing or deleting a group.
15. The picker allowed another CSV through the clickable card but did not explain that this creates a separate additive source rather than replacing the uploaded file. In add mode it now shows `Add another file` beside `Uploaded` and explicitly warns that each additional file contributes to Total Revenue; it directs replacements to the existing Revenue Sources pencil. The additive action is suppressed in edit mode so it cannot be mislabeled while a source ID is retained.

Files changed for these fixes/evidence:

- `client/src/components/AddRevenueWizardModal.tsx`
- `server/routes-oauth.ts`
- `server/storage.ts`
- `server/utils/csv.ts`
- `server/csv-revenue-certification.test.ts`
- `server/csv-revenue-transaction.test.ts`
- `server/csv-revenue-production-rollback-runner.test.ts`
- `server/csv-revenue-damaged-data-inventory.test.ts`
- `scripts/csv-revenue-inventory-readonly.ts`
- `scripts/csv-revenue-deployed-authorized-validation.ts`
- `scripts/csv-revenue-production-rollback-validation.ts`
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
- GA4 direct oversized-request correction committed as `c71677a06cb924c758cb374e1cfe8e3fabc9032f`: the six-file CSV packet passed 37/37; the exact campaign-access-before-upload assertion passed; `npm run check` passed; and `npm run build` passed with 3,470 modules transformed. The wrapper is limited to the two revenue CSV routes, recognizes only an early `platformContext=ga4` plus Multer `LIMIT_FILE_SIZE`, returns HTTP 413 with the existing `{ message }` shape, and forwards all other errors unchanged.
- Rollback validation guards passed 6/6 and `npm run check` passed after the validation-only runner was added and strengthened.
- Final current CSV packet: 7 files, 38/38 tests passed.
- Final deployed-runner assertions passed 3/3 and `npm run check` passed after requiring HTTP 413 for both oversized endpoints, exact before/after database equality, and distinct source-count evidence.
- CSV edit-entry correction on 2026-09-13: the CSV certification and validation suites passed 19/19; the new regression proves edit initialization enters `csv` while successful preview still advances to `csv_map`; `npm run check` and the production build passed with 3,470 modules transformed. The later eight-step deployed browser lifecycle entered replacement through the pencil and completed re-upload.
- Replacement-file mapping reset on 2026-09-13: the CSV certification and validation suites passed 20/20; the focused regression proves the replacement file input clears both selected campaign values and the retained platform campaign crosswalk before mapping; `npm run check` and the production build passed with 3,470 modules transformed. The later eight-step deployed browser lifecycle deliberately remapped the replacement file.
- CSV source-card layout correction on 2026-09-13: the CSV certification, GA4 UI/source lifecycle, and adjacent Shopify layout packet passed 79/79; `npm run check` and the production build passed with 3,470 modules transformed. The renderer reuses the existing source total and edit/delete handlers; no API, persistence, calculation, or other source layout changed. The later eight-step deployed browser lifecycle confirmed both filenames and individual amounts in Revenue Sources.
- Add Revenue picker CSV delete control on 2026-09-13: the CSV certification, revenue-source delete transaction, GA4 UI, and source-lifecycle packet passed 74/74; `npm run check` and the production build passed with 3,470 modules transformed. The control uses the existing individual-delete route, revalidates one exact CSV source before mutation, and refuses ambiguous multi-source deletion. Its exact picker-click path remains locally proven; the deployed lifecycle used the Revenue Sources delete entry point backed by the same handler and route.
- Add Revenue picker additive-file action/copy on 2026-09-13: the same focused CSV/delete/UI/source-lifecycle packet passed 74/74; `npm run check` and the production build passed with 3,470 modules transformed. The link invokes the existing add step only when `isEditing` is false, and the warning distinguishes additive files from pencil/re-upload replacement. No import, total, delete, or API behavior changed. Commit `b2fd97a9af8b51a5cea88a6f88b2b3e0c8a4b6cc` is deployed, and the later eight-step browser lifecycle confirmed the action, warning, and additive behavior.
- The adjacent Google Ads CSV and Meta packet passed 67/71. Its four failures are stale static expectations already absent from committed `HEAD`: the platform enum now includes `custom_integration`, campaign filtering is intentionally optional, the mapping condition also includes GA4, and Create Campaign uses a recorded dynamic back step. None intersects this correction; they were not edited.
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

Final certification scan: `2026-09-13T09:47:18.456Z`, inside `BEGIN TRANSACTION READ ONLY`, followed by `ROLLBACK`.

- 57 campaigns, 19 GA4 CSV source definitions, 1 active source, and 19 linked records were scanned.
- Active-source, currency, record-currency, retained-amount, retained-date, duplicate-active-source, orphan, cross-campaign, wrong-type, mapping, stored/materialized-total, dated-row-loss, and duplicate-record findings were all zero.
- The same five pre-existing inactive legacy groups retained the same 17 records. No new inactive record group or cleanup candidate was created.
- The final deployed run added and deleted three exact temporary sources. It moved the target campaign from 5 to 8 inactive zero-record definitions while restoring active source IDs, active revenue, and active record count exactly to `[]`, `0`, and `0`. This matches the certified soft-delete-source/hard-delete-record contract and does not affect live reads.

## Manual Deployed Evidence

Historical only:

- On 2026-07-12, an older CSV implementation had user-confirmed add/edit/filter/delete behavior and one invalid-file no-mutation check.
- Exact current working-tree strict parsing, optional full-file import, complete value discovery, currency/precision bounds, duplicate guard, overlap predicate, post-commit behavior, and current report propagation were not part of that deployed artifact.

Current artifact:

- Production `/api/health` returned HTTP 200 with exact application commit `b2fd97a9af8b51a5cea88a6f88b2b3e0c8a4b6cc` at `2026-09-13T13:52:01.115Z`.
- On that artifact, the user reported all eight disposable-campaign browser steps passed: the first CSV contributed `$300`; `Add another file` and its additive Total Revenue warning were present; the second separate CSV contributed `$700`; the two sources displayed separately and contributed `$1,000` together; pencil/re-upload replaced the first source with a deliberately remapped `$400` file rather than adding a third source; the combined contribution became `$1,100`; deleting the `$700` source left `$400`; and deleting the replacement source restored the pre-test baseline.
- This is manual deployed evidence for multi-file add, additive totals, source-list display, pencil/re-upload replacement, mapping reset, Revenue Sources deletion, and cleanup. The Add Revenue picker trash button was not used in those eight steps and is not classified as manually deployed-validated.

- Production `/api/health` returned HTTP 200 with exact application commit `c71677a06cb924c758cb374e1cfe8e3fabc9032f` at `2026-09-13T09:32:29.658Z`.
- The final authorized deployed run completed at `2026-09-13T09:46:37.481Z` against that exact commit with all 26 checks passing and no fatal error.
- Authenticated direct preview and process requests above 10 MiB each returned HTTP 413 with `{ "message": "File too large" }`. Exact database snapshots immediately before and after both requests were identical.
- The same run reconfirmed full preview beyond row 25, filtered dated add, daily materialization, edit without re-upload, re-upload replacement, snapshot materialization, source-list/breakdown/total propagation, unchanged spend, `200/409` overlap and duplicate protection, 5,000/50,000 row limits, malformed/amount/date/currency/no-positive rejection, exact cleanup, and baseline restoration.
- The evidence helper initially labeled joined record rows as source count during the temporary state. It did not affect the exact before/after equality or any application assertion. The helper now uses distinct source IDs; its focused assertions pass 3/3 and TypeScript validation passes.

- Production deployment of exact commit `5329fe2516afaf64963be0826f2aaa05967486e8` was confirmed through `/api/health` at `2026-09-13T06:07:51.426Z`.
- A temporary dated CSV source was added through the deployed browser, its edit modal was opened, and the exact temporary source was subsequently deleted by the user.
- The edit screenshot showed `date` and `amount` retained but an initially unmapped `description` header displayed with blank values. This is failed deployed evidence for that edit-preview state, not clean lifecycle evidence.
- Root cause: `csvStoredRevenueRows` intentionally retains mapped fields, while the client used the broader original `csvHeaders` list when reconstructing the no-file edit preview.
- The localized client correction was committed as `8735e778ba843c89e506717c3430040458b50ef7`; production `/api/health` confirmed that exact SHA at `2026-09-13T06:41:44.600Z`.
- After a hard refresh, the user repeated the temporary add/edit/delete flow on `8735e778` and confirmed that the no-file edit preview showed only retained `date` and `amount`; the blank `description` header no longer appeared. The temporary source was deleted.
- Authorized target campaign: `eee3e654-b736-4e8e-86ec-1050e4d905c0`; run completed at `2026-09-13T07:12:34.990Z` against exact SHA `8735e778ba843c89e506717c3430040458b50ef7`.
- Proven through authenticated deployed API plus read-only database before/after evidence: all 30 preview rows including campaign values after row 25; exact campaign-filtered dated add; daily records; campaign-selection edit without re-upload; exact-source replacement by re-upload; no-date snapshot materialization; revenue-to-date delta; unchanged spend; source-list/breakdown value parity; over-5,000 UI row rejection; over-50,000 process-row rejection; ambiguous structure, amount, date, currency, and no-positive-row rejection without mutation; simultaneous identical add `200/409`; overlapping edit `200/409`; exact-source cleanup and baseline restoration.
- The source-list assertion initially reported a validation-helper false negative because it omitted the existing `lastTotalRevenue` field. The captured source row and breakdown row both contained `75`; the helper now reads that field and passes TypeScript validation. No application contract or response changed.
- On the earlier artifact, the 10 MiB request was rejected without mutation but returned HTTP 500 with `File too large`; that historical failure led to the localized correction.
- The GA4-only browser guard rejects files above the same 10 MiB bound before both preview and process fetches. All 36 focused CSV Revenue tests, `npm run check`, and `npm run build` passed locally. Deployed validation against exact commit `db9f7448` rendered `CSV file is too large`, stayed on the upload step, and issued zero preview requests.
- The route-local HTTP 413 correction is deployed and passed authenticated preview/process no-mutation validation on exact commit `c71677a0`.
- Unauthenticated campaign access was rejected. On exact deployed commit `a9f7bc49`, an authorized owner requested a different owner's source list, total, preview, process, and delete paths; all returned HTTP 404, and read-only database state before and after was identical.
- KPI, Benchmark, and report endpoints returned HTTP 200 on the disposable campaign, which has zero configured consumers. Configured-value propagation was therefore proven separately on the existing production campaign below rather than inferred from empty responses.
- A separate existing production campaign supplied non-destructive configured-consumer evidence. Its active $600 GA4 CSV source predates eight GA4 KPIs, two GA4 Benchmarks, three scheduled GA4 reports, and 145 immutable report snapshots.
- At `2026-09-13T08:35:33.764Z`, authorized read-only deployed checks returned HTTP 200 for source list, breakdown, all-mapped-record total, KPI, Benchmark, and report endpoints. The CSV source was exactly $600 in the source list, deployed breakdown, and internal source-keyed breakdown; the complete imported-source sum reconciled exactly into Total Revenue.
- Configured Revenue (`98682.82`), ROAS (`35.76`), ROI (`3475.79`), and CPA (`8`) KPI values reconciled to their current inputs. CPA used spend and conversions rather than revenue. The configured revenue Benchmark (`102026.47`) matched the value captured in the latest sent Benchmark report snapshot.
- Overview, Ads, and Benchmark reports each had an existing sent event and immutable snapshot after the CSV source was connected. The CSV source/record count and revenue were identical before and after the entire check. The deployed PDF route was not requested because it runs KPI/Benchmark preflight writes.
- At `2026-09-13T08:43:15.527Z`, the exact current Benchmark PDF builder was run locally against production data with every database connection forced to `default_transaction_read_only=on`. It produced a valid 7,980-byte PDF whose parsed text contained the Revenue Benchmark value (`102026.47`) already reconciled to the imported-source total containing the exact $600 CSV source. Database state was identical before and after. A broader Overview PDF attempt failed closed because current provider sections were unavailable; it also made no writes. This is local production-data evidence, not a deployed HTTP-route claim.
- At `2026-09-13T09:15:55.408Z`, the exact `DatabaseStorage.replaceGa4CsvRevenueSourceWithRecords` implementation at `0e8108bbb0ac5832136f78109c4e2b7facf3a580` ran against the production PostgreSQL engine. A temporary last-good source and record were seeded only inside an outer transaction; the exact replacement ran in a nested savepoint and hit deterministic PostgreSQL `23502` on replacement-record insertion after the source update and old-record deletion. The savepoint rollback restored the original source mapping, name, record identity, and `123.45` revenue before the outer transaction was deliberately rolled back. Post-run checks found zero temporary sources, zero temporary records, and byte-for-byte unchanged target-campaign CSV state.
- An initial numeric-overflow fault attempt did not trigger because the production column accepted the deliberately wider value. Its explicit unexpected-success guard rolled back the outer transaction. No data committed. The deterministic not-null fault was then used; the application-level maximum-revenue guard remains independently proven.
- This proves the exact application storage method plus the production transaction engine without adding or exposing a deployed failure hook and without mutating any existing source.

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

Final certification decision:

> CSV Revenue is clean-certified for the documented GA4 scope on application commit `b2fd97a9af8b51a5cea88a6f88b2b3e0c8a4b6cc`. The exact deployed lifecycle, separate additive-file behavior, pencil/re-upload replacement, strict oversized preview/process HTTP 413 responses, no-mutation and cleanup checks, production PostgreSQL rollback/last-good-data behavior, ownership boundaries, source totals, downstream KPI/Benchmark/report evidence, and final read-only inventory are supported by current evidence. CSV remains manual; source-refresh scheduler behavior is inapplicable. Zero certification steps remain. The picker trash button's exact click is locally proven rather than manually deployed-validated; its underlying exact-source delete handler and route are deployed-validated through Revenue Sources. The five explicitly documented inactive legacy record groups remain excluded from active reads and were not modified; persistent cross-runtime idempotency and email-provider delivery remain outside the supported CSV source contract.
