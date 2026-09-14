# GA4 Overview Spend Targeted Post-Deployment Recertification — 2026-09-14

## Decision

`CLEAN-CERTIFIED / PRODUCTION_READY` for the bounded GA4 Overview Spend implementation at deployed runtime:

- commit: `002a7caae7cc01b5a815799f8ddc05a2f9e0fe86`
- included sources: Google Sheets Spend and CSV Spend
- target: Campaign2, recorded only as campaign hash `d9c8a3b7c4d0`
- currency: USD
- Google Ads: `NOT CONFIGURED / EXCLUDED`

This is a targeted delta recertification, not a full restart or recertification of another GA4 area. It preserves the prior Spend certification and carries forward its evidence only for paths proven unchanged by the reviewed commit delta.

No Revenue implementation or Revenue evidence was used as Spend evidence. No existing certificate, certified test contract, certified section, or `APP_PRODUCTION_READINESS.md` was modified.

## Delta boundary

Reviewed range:

- certified Spend boundary: `2c2140da`
- deployed delta head: `002a7caae7cc01b5a815799f8ddc05a2f9e0fe86`

Changed application files in this range:

- `client/src/components/AddSpendWizardModal.tsx`
- `client/src/components/SimpleGoogleSheetsAuth.tsx`
- `client/src/index.css`
- `client/src/pages/ga4-metrics.tsx`
- `server/routes-oauth.ts`
- `server/storage.ts`

New Spend regression files in this range:

- `server/ga4-spend-edit-entry-regression.test.ts`
- `server/google-sheets-ga4-spend-disconnect-transaction.test.ts`

The trace confirmed:

- CSV and Google Sheets processing, validation, replacement, total aggregation, date materialization, currency enforcement, scheduler refresh, and canonical downstream Spend formulas were not changed.
- The server-side behavior added by the delta is the GA4 Google Sheets Spend disconnect route and its storage transaction.
- The remaining application changes are localized Spend UI behavior: first-step edit entry, source labels, stable dialog layout, hidden sheet-list scrollbar with retained scrolling, add-another controls, delete controls, explicit full-file CSV mapping, and saved/selected filename visibility.
- No Revenue file was changed in the reviewed delta.

## Current automated evidence

Targeted Spend-only regression run:

```text
Test Files  8 passed (8)
Tests       53 passed (53)
```

Files run:

- `server/ga4-spend-edit-entry-regression.test.ts` — 10 passed
- `server/ga4-spend-scope-regression.test.ts` — 7 passed
- `server/csv-spend-validation.test.ts` — 14 passed
- `server/ga4-overview-spend-readiness.test.ts` — 8 passed
- `server/spend-source-transaction.test.ts` — 4 passed
- `server/ga4-overview-spend-transaction.test.ts` — 4 passed
- `server/google-sheets-ga4-spend-disconnect-transaction.test.ts` — 4 passed
- `server/ga4-overview-spend-downstream.test.ts` — 2 passed

Additional gates:

- `npm run check` — passed
- `npm run build` — passed
- `git diff --check` — passed

No Google Ads test was run.

## Deployed read-only reconciliation evidence

The existing read-only Spend validator ran against the exact deployed SHA and Campaign2. It used an authenticated, temporary session, a read-only database transaction, and rollback/revocation cleanup.

Result:

- status: passed
- active source count: 2
- breakdown source count: 2
- Google Sheets Spend: `$300.00`
- CSV Spend: `$38.00`
- Total Spend: `$338.00`
- source IDs remained stable across observation
- CSV mapping remained unchanged across automatic observation
- natural Google Sheets refresh observed after 140 seconds
- valid currency and stored dates
- zero cross-campaign records
- zero orphan records
- zero inactive-source records
- zero duplicate source/date rows
- zero duplicate active-source signatures
- unauthenticated access denied
- cross-owner access denied

This validates current source-list/total reconciliation, ownership, campaign isolation, currency, dates, stable identity, duplicate prevention, Google Sheets automatic refresh, and CSV scheduler exclusion without business-data mutation.

## Deployed UI delta evidence

New evidence runner:

- `scripts/ga4-overview-spend-ui-delta-readonly.ts`

The runner checked the deployed Campaign2 UI while blocking every application mutation except the non-persisting CSV preview endpoint. It compared stable campaign Spend state before and after.

Passed checks:

- Spend Sources shows `CSV` above `csv_spend_updated.csv`.
- Spend Sources shows `Google Sheets` above the saved tab `Client_ROI_Summary`.
- Google Sheets pencil opens at the first source-specific wizard stage and shows the saved sheet/tab.
- CSV pencil opens at the first source-specific wizard stage and shows the current filename.
- CSV edit retains the current filename after mapping Back navigation.
- A newly selected two-column CSV retains `spend-delta-preview.csv` after mapping Back navigation.
- `None — import the full file` is available for the optional campaign identifier.
- Google Sheets shows `Connected | Add another sheet` and its disconnect control.
- CSV shows `Uploaded | Add another file` and its remove control.
- `Add another sheet` reaches the spreadsheet picker for `B2B`.
- the Spend tab list has a hidden scrollbar, retains `overflow-y: auto`, and responds to mouse-wheel scrolling.
- opening/closing Spend Sources and Add Spend source produced no measured page-position shift.
- one CSV preview request occurred; zero unexpected mutation attempts occurred.
- stable campaign Spend state was unchanged after the run.

The validator initially needed timing/locator corrections for asynchronous controls, a dynamic modal heading, explicit spreadsheet selection, and the wizard's two-stage Back path. These were validation-runner issues only; no application change or business-data mutation resulted. The final run passed.

## Transactional delete evidence

The new Google Sheets disconnect path was traced end to end:

`Spend Add modal -> DELETE /api/campaigns/:id/ga4/google-sheets-spend/disconnect -> campaign access middleware -> storage transaction -> Total Spend recalculation -> GA4 KPI/Benchmark recompute`

Proven boundaries:

- targets only active Google Sheets Spend sources for the exact campaign and GA4/legacy-null context
- deletes records only for the exact campaign and targeted source IDs
- preserves another platform's Spend source
- preserves another campaign's source, records, and connection
- preserves Google Sheets connections still referenced by active Revenue sources
- preserves non-Spend-purpose connections
- deactivates and clears only unshared Spend-purpose connections
- verifies affected source/connection counts and rolls back on mismatches or failures
- regression coverage forces failure independently at source, record, and connection stages and proves full rollback
- the campaign route is access guarded and invokes existing canonical Spend and downstream recomputation after success

The deployed destructive confirmation was deliberately not clicked because Campaign2 now contains the user's real Google Sheets Spend source. The production behavior claim for this destructive path is based on the exact deployed implementation trace, transaction regression, route guard, and successful build—not on a destructive live mutation of the user's source.

## Unchanged evidence carried forward

The prior bounded Spend validation remains the evidence source for unchanged paths:

- additive Google Sheets and CSV creation
- stable-source edit and transactional replacement
- manual CSV replacement
- Google Sheets mapping/currency failure preserving last-good data
- CSV currency failure preserving last-good data
- exact individual-source deletion and cleanup
- downstream canonical Spend propagation through daily financials, KPI, Benchmark, snapshots, reports, and PDF

The current diff and current regression gates confirm those producer/consumer contracts were not modified. Revenue evidence was not substituted for any Spend evidence.

## Exclusions and remaining steps

Excluded:

- Google Ads behavior, configuration, tests, modification, and readiness claims
- Revenue behavior and Revenue evidence
- destructive execution of the new bulk Google Sheets disconnect against the user's live Campaign2 source
- a full recertification of unrelated GA4 sections

No blocking Spend correction remains from this targeted delta review. A direct deployed destructive click-through may be performed later only on an empty disposable campaign with exact cleanup; it is not claimed by this record and is not safe to perform on Campaign2 merely to add evidence.
