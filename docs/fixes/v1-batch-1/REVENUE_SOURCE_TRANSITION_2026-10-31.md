# Revenue source and total consistency during processing

## Scope and cause

The Google Sheets initial import saved EUR 31,000 correctly. While its owned
publication job ran, Revenue Sources showed the new amount alongside Total
Revenue EUR 32,099.32. HubSpot/Salesforce showed red pending messages and the
independently requested native GA4 row disappeared temporarily. Approximately
176 seconds later, the job completed and the user confirmed EUR 63,099.32,
Pipeline Proxy EUR 3,251, native GA4 EUR 31,313.37 and no pending messages.

This is separate from the already deployed midnight status correction. The
source endpoint/merge rendered current materialized records and mapping totals;
the card rendered `financial_daily`. Those independent generations could not
form a consistent breakdown. No lost source records or incorrect saved import
amounts were found in the bounded read-only evidence.

## Exact trace and change

Existing source save/refresh -> source definition and normalized records ->
owned refresh work -> `writeFinancialDailySnapshotIfReady` -> guarded
`storage.upsertFinancialDailySnapshot` -> owned `/financial-daily-snapshot` ->
GA4 Overview card and Revenue Sources.

- The writer uses the existing scoped `getRevenueSources` and
  `getRevenueBreakdownBySource` methods for the same completed date. The existing
  breakdown selects aggregate versus attributed records without double counting.
  Only matching source IDs, currencies, finite amounts and an exact cent-level
  reconciliation permit display metadata. Native revenue is the already verified
  native input, not an allocated residual.
- Optional `revenuePublication.display` stores native revenue, source amounts and
  whitelisted presentation fields beside the existing total. Source hashes,
  publication version checks, ownership, leases and write transactions retain
  their existing checks. No schema migration, new endpoint or response-field
  removal is involved; existing receipt readers ignore the optional addition.
- The page reads these amounts and the total from one response. Current source
  definitions still control management. New definitions show a dash rather than
  an unpublished amount or invented zero. Removed source contributions remain
  read-only until the snapshot updates. Changed source hashes disable stale
  controls; edit/removal uses current mapping configuration, and obsolete CRM
  detail rows cannot remove a replacement selection.
- Normal pending work no longer emits red warnings. Genuine processing failure
  remains explicit. Confirmed zero, refunds and future-day exclusions retain
  their distinct meaning. CRM itemization is shown only when it reconciles to
  the displayed source contribution.
- Existing snapshots are not rewritten or backfilled. For a legacy receipt,
  the page may retain an already verified matching breakdown keyed by campaign,
  currency and snapshot identity. A reopened page without verifiable historical
  provenance shows unknown contributions as dashes until the next valid response;
  it does not fabricate the old amounts. The next normal snapshot writes the
  durable display metadata.
- Before the first financial snapshot exists, verified native GA4 detail remains
  reachable while Total Revenue explicitly stays unavailable. Once a total is
  displayed, its snapshot controls the breakdown. Campaign and currency guards
  prevent carrying a verified legacy display into a different scope.

## Boundaries preserved

| Path | Treatment |
| --- | --- |
| Provider preview, add/edit, source materialization | Unchanged; display metadata is captured after existing financial readiness checks. |
| Source removal and CRM item removal | Same routes and scopes; current configuration is used, stale retained controls are disabled. |
| Source modal/count/native row | Uses the displayed snapshot, with active new definitions retained for management. |
| Total Revenue, Spend, Profit, ROI, ROAS, CPA | Same financial snapshot inputs and formulas. |
| Pipeline Proxy | Same current-stage queries, selection and calculation; never part of confirmed revenue. |
| Refresh/scheduler/recovery | Same processing order, cadence, retries and leases. No idle 15/30-second polling introduced. |
| KPI/Benchmark, Insights, comparisons, reports, alerts | Existing inputs, calculations, publication gates and invalidations unchanged. |
| Existing data | No manual production writes or cleanup. Scoped read-only baseline records EUR 63,099.32 through October 30. |

## Validation and remaining limits

The new snapshot-writer regression failed before the implementation because no
matching display breakdown was saved. Isolated real-page browser tests exercise
pending imports, independently delayed publication, reloads, zero/refunds, native
read failures, midnight, source/CRM item deletion, failed deletion, changed
mapping selection, legacy snapshots and future-date exclusion. Real PostgreSQL
tests verify persistence retains the prior display during a saved edit and
publishes the new display with its total, alongside existing ownership,
concurrency, rollback, currency and completed-work guards.

Validation receipts are under `validation-2026-10-31/revenue-consistency-*`.
The initial wider browser run had one fixture failure: its simulated disconnect
changed source definitions without advancing its simulated financial snapshot.
The fixture now models both, and the full affected run passed. Three older
source-text assertions encoded the superseded display; those assertions were
updated, and the adjacent packet passed. They are structural guards, not a
substitute for the executable browser/database checks.

The scheduled-publication browser regression also detected loss of native-only
source access before the first financial snapshot. That initial-view regression
was corrected and the full refresh/failure/hidden-tab test passed afterward.

The [validation ledger](validation-2026-10-31/revenue-consistency-validation.json)
records **371 unique selected passing checks**, with the corrected reruns
superseding the explicitly retained earlier initial-view failure. This includes
88 real PostgreSQL checks, the actual Overview and publication browser flows,
financial writer/contract checks, adjacent Spend/CRM checks and the report
download guard. Selected-test packets exclude unrelated cases by name; the
ledger does not count those exclusions as passes. The disposable database is
stopped. [TypeScript and both production builds](validation-2026-10-31/revenue-consistency-approved-build-checks.json)
pass, as does the KPI certification metadata gate. The report fixture's generated
tracked PDF was restored and is not part of this change.

## Deployment and scoped live verification

Runtime commit `fa7792872539f1bd6fd75cf8174a49a9a55218ee` is pushed to `main`
and served by Render. The public health endpoint identifies that exact commit;
the deployed GA4 page matches the normalized, locally tested production build.
The first [GitHub run](https://github.com/CrazySkillz/MF_real_latest/actions/runs/41154267734)
ran 6,794 tests: 6,789 passed and five failed. The log identifies one missing
storage mock method, one receipt assertion without the new optional display,
and three source-text assertions expecting the former render/edit expressions.
The five affected test files now reflect the new contract, including explicit
saved-native/source contribution assertions; all **266 checks** in those files
pass in [the local rerun](validation-2026-10-31/revenue-consistency-hosted-contracts.json).
No additional runtime change was required. The full
[hosted rerun](https://github.com/CrazySkillz/MF_real_latest/actions/runs/41155357151)
for test-only commit `5a4f8daf0bd54e1355fdca29ca2bd6f4a9bf66d3` passed the KPI
metadata gate, current-version suite and retained deferred checks. The
[final publication receipt](validation-2026-10-31/publication-2026-10-31T01-37-04-243Z.json)
records `PASS` for the hosted results, exact deployed runtime and compiled GA4
page. The verifier also confirms that only tests and documentation differ
between the deployed runtime and the tested follow-up commit.

The [initial comparison](validation-2026-10-31/revenue-consistency-data-comparison.json)
retains its `REVIEW_DIFFERENCES` result: source connection timestamps and work
bookkeeping advanced during an existing background refresh. At that point,
imported records and financial snapshots were unchanged. It is not presented
as proof that every database field remained unchanged.

The [completed live verification](validation-2026-10-31/revenue-consistency-live-data-verification.json)
then proves that the exact disposable campaign's job completed without error,
the source hashes still match, and its new persisted display reconciles to the
same snapshot's Total Revenue. Native GA4 revenue advanced from EUR 31,313.37
to EUR 32,930.02. The EUR 1,616.65 difference explains the entire Total Revenue
change, from EUR 63,099.32 to EUR 64,715.97. The imported records are identical:
HubSpot EUR 0, Salesforce EUR 0, Shopify EUR 785.95, Sheets EUR 31,000.
The checks used enforced read-only transactions; they did not trigger a refresh
or make provider requests. This verifies the actual saved publication result,
not observation of the transition inside the user's authenticated browser.

This is a bounded processing-display fix, not certification of all provider
lifecycles, global scheduler health, report delivery or Batch 1. The agent does
not operate the user's personal browser or perform a live re-import.

## User confirmation

Recorded October 31 at 04:07 UTC: after the deployed-fix instructions, the user
replied **"yes, confirmed"**. The live display check is now user-confirmed in
addition to the automated browser, database and hosted evidence above. This
confirmation does not assert that another import/edit was performed or close
the remaining Batch 1 renewal, reconnect, revocation and operations checks.
