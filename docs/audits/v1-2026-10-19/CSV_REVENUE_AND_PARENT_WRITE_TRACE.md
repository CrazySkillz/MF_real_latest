# CSV Revenue and final-write parent boundary

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`. Evidence: [six exact-handler cases](csv-revenue-reproductions.json), [runner](csv-revenue-reproductions.cjs), [two real PostgreSQL cases](ga4-parent-delete-race.json), [database runner](ga4-parent-delete-race.cjs). No production records, provider calls or runtime files changed.

## Current CSV contract

`routes-oauth.ts:4735–5274` registers import limiter, campaign authorization and upload parsing before the handler. GA4 adds a process-local in-flight hash of campaign/mapping/file bytes; this only prevents simultaneously identical requests in one process. It is not durable idempotency for a lost response or multiple replicas. Separate file additions are intentionally additive, so a future retry contract must distinguish retry-one from add-another.

The GA4 branch invokes strict `parseCsvText` and validates mapped columns, distinct date/campaign/revenue columns, selected amounts/currency and positive-row dates before mutation. The parser rejects binary/replacement characters, unclosed quotes, ambiguous delimiters, blank/duplicate headers, unequal row widths and more than50,000 data rows. Exact duplicate-header and `$`-in-EUR handler controls reject before storage. Exact campaign selection excludes the unselected900 and saves selected100.

The edit-without-file branch requires full stored raw rows or a sample proven to contain the full original row count. Changing mode or mapped columns requires re-upload. It retains raw amount/date/campaign values and full source metadata; a25-row sample alone is not silently treated as the full file. Existing source must belong to the campaign and matching CSV/platform context. GA4 edits pass expected mapping text to atomic storage; an empty expected mapping string does not enable the SQL expected-state predicate. That legacy case and simultaneous edits remain an additional regression gate.

Selected rows aggregate by date and optional exact campaign mapping. Undated GA4 files materialize at the campaign-timezone latest completed day; dated current/future rows remain stored while the response's visible total excludes dates after that cutoff. Mapping totals preserve whole imported-file provenance. Save returns source ID, total/visible amount, row count, kept rows, currency, mode and date. Recompute after GA4 commit is caught/logged; successful save does not prove every downstream reader has republished. Source modal, cards, KPI/Benchmark/history, Insights, diagnostics and browser/server artifacts still need the full mutation-to-render acceptance matrix.

## V1-071: accepted negative adjustments silently disappear

`utils/csv.ts:43–54` accepts signed finite amounts. Aggregation105–109 and route4988–5000 then skip all nonpositive rows. An exact GA4 process fixture with100 and−10 returns success, `rowCount:2`, `keptRows:1`, total100 and persists100. The negative is retained in raw mapping metadata but absent from materialized records. This is a silent semantic change, regardless of whether the eventual supported import policy accepts refunds or rejects them. No claim is made that the native-negative rule in `GA4/FINANCIAL_SOURCES.md:89` automatically specifies every imported source's refund policy. The import contract must explicitly accept/reconcile signed adjustments or reject unsupported selected rows; it must not silently drop them. Existing affected files require a read-only inventory before cleanup.

## V1-072: retained contexts validate too late and truncate

Non-GA4 CSV Revenue passes non-strict parser mode at4813. The50,000 cap includes the header in that mode; a50,000-data-row fixture returns success with49,999/49,999 revenue. This is separate from the already reproduced Spend and Custom parser defects.

For a LinkedIn conversion-value edit, the route updates source metadata and deletes existing records at5154–5174 before checking whether any valid conversion values remain at5178. The exact fixture starts with55 in materialized records, submits a replacement containing0 and receives400 after both mutations and with no records left. Failure preserves neither the prior source mapping nor the prior materialization. Ordinary non-GA4 revenue replacement also separates delete and insert. Scope exclusion has not been accepted or enforced, so these retained paths remain release obligations.

## V1-073: ordinary GA4 input writes do not require a surviving parent

`storage.ts:1256–1262 writeGA4RefreshInputChange` selects matching campaign rows `FOR UPDATE` but ignores an empty result before calling the write callback. `replaceGa4CsvRevenueSourceWithRecords:2832–2900` uses that wrapper. The guarded derived/publication writers are different: `writeGA4DerivedChange:1318+` explicitly rejects a missing campaign. Their guarantees do not transfer to ordinary input writes.

The current `shared/schema.ts:214–240` defines source/record campaign IDs without campaign foreign keys; no corresponding campaign FK was found in tracked migration SQL/startup DDL. A campaign access check at upload start cannot protect a later save after deletion finishes.

An isolated PostgreSQL schema preserves the relevant not-null/no-FK constraints. Exact current wrapper and CSV storage method execute after a fixture parent has been deleted, reproducing the completed interleaving between request authorization and final save: zero parents, one committed source and one committed100 revenue record. Existing-parent control commits normally. The supported ordinary-save branch with no durable work table is exercised; deployed schema, an installed work table, full HTTP upload and other source writers were not exercised. Those variants remain required. Parent existence/ownership at final write and concurrent deletion must be verified for every wrapper caller rather than assuming a row-lock query proves existence.

The test used only `127.0.0.1:55442/notifications_test`, rejected application DATABASE_URL, created and removed a unique schema, and stopped the audit PostgreSQL instance afterward. Initial sandbox process-token failure and default-port start failure were harness/environment issues; the explicit existing audit port succeeded. No product failure is inferred from those startup errors.
