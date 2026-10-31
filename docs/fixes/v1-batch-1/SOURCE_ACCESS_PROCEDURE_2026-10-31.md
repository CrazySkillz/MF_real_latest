# Consolidated transfer, source-edit and report visibility acceptance

Status: **both live account passes and exact cleanup complete**. The user's
[full result](validation-2026-10-31-source-access/user-source-foreign-6302ecc4.json)
contains all 16 passing checks. Independent database verification confirmed the
expected edit, unchanged LinkedIn parent/ID and exact owned integration transfer.
Application code, provider credentials and refresh schedules were not edited.
V1-034 now closes within its original authorization boundary: Batch 1 is
**8 CLOSED / 12 OPEN**. V1-052 and V1-054 remain open within the limits below.

## Completed live cleanup and acceptance

The [cleanup rehearsal](validation-2026-10-31-source-access/cleanup-2026-10-31T09-47-34-563Z.json)
verified all five exact IDs, owners, draft status, expected edited state, absent
provider credentials and zero unplanned dependents, then rolled back. The
[committed cleanup](validation-2026-10-31-source-access/cleanup-2026-10-31T09-48-15-395Z.json)
repeated those guards and removed only those five rows. Other rows in the three
touched tables were unchanged within that transaction. The [fresh read-only check](validation-2026-10-31-source-access/verify-2026-10-31T09-49-19-623Z.json)
proves all five IDs absent and all three protected campaign identities/statuses
intact. The user's browser result also records exact paused-report removal.

| Finding | Evidence now complete | Remaining boundary |
| --- | --- | --- |
| V1-034 | CLOSED: normal owned draft creation previously passed; current owned transfer succeeds; actual foreign source/destination and magic-ID parents are denied. The connect route remains blocked by the approved automatic-email-import exclusion. Stored scope independently checked. | Batch 4 transfer-copy/data correctness is not recertified by an empty test transfer. No email feature is re-enabled. |
| V1-054 | Live valid LinkedIn name edit preserves record/parent IDs despite supplied replacements; foreign edit is denied and the saved state remains correct. | Absent legacy Meta tables cannot supply positive deployed row-update acceptance. Their guarded handlers/storage pass the retained isolated tests; no schema or functionality was added. |
| V1-052 | The actual owner Reports page displayed this exact fixture; the settled foreign page hid it. | The earlier fixture's owner reappearance remains historically unverified. Notifications and remaining persistent-state transitions still require their own evidence. No additional user account pass is needed for this completed packet. |

## Exact scope and evidence

- [Manifest](validation-2026-10-31-source-access/manifest.json), run
  `6302ecc4-0b0a-4caf-90e2-0cfcb5cae0bd`: three new draft campaigns, one
  credential-free LinkedIn connection and one disabled synthetic Custom
  Integration. Two drafts belong to the second account; the foreign draft belongs
  to Promo's original account. Existing campaign IDs are expressly excluded.
- [Browser script](validation-2026-10-31-source-access/manual-source-bundle.js):
  9 owner assertions and 7 foreign-account assertions. It edits only the test
  LinkedIn display name, attempts supplied-ID/parent replacement, verifies denied
  foreign/magic transfer parents, and transfers the test integration between its
  owner's two drafts. No real provider calls or source imports are made.
- The browser-only report has an exact generated ID, a paused schedule and no
  recipients, backend report ID or download URL. The owner pass requires its actual
  name to appear on the Reports page. The foreign pass waits for the settled
  `Reports unavailable` state, checks absence and removes only that exact fixture.
- [Local rehearsal](validation-2026-10-31-source-access/rehearsal.json): 16 account
  assertions and 10 fixture/cleanup checks pass against current route/storage
  bodies, isolated PostgreSQL and the real Reports component in Chromium. Synthetic
  Clerk identity and routed transport are explicitly not production auth evidence.
  Checks include partial-run cancellation, unexpected changes/dependents, active
  campaign refusal, last-delete rollback and five unrelated rows preserved.
- [Production rollback seed](validation-2026-10-31-source-access/seed-2026-10-31T09-33-26-925Z.json)
  and [committed exact seed](validation-2026-10-31-source-access/seed-2026-10-31T09-34-02-309Z.json)
  pass. A separate connection then passed [cancellation rehearsal with rollback](validation-2026-10-31-source-access/cancel-2026-10-31T09-34-46-773Z.json).
  **The five fixtures have now been removed by the completed cleanup above.** These transactions
  verify that other rows in the three touched tables are unchanged by the operation.
  They do not claim unrelated concurrent scheduler activity stopped.

Production target is verified by the established SHA-256 database fingerprint;
TLS certificate verification stays enabled. Existing clients/owners and all three
protected active campaign identities are checked. No secrets are emitted. No
schema changes or user-defined table triggers are involved.

## Legacy Meta limitation

The initial seven-record plan stopped during its first table snapshot with
`42P01`, before inserts. A subsequent [read-only inventory](validation-2026-10-31-source-access/inventory-2026-10-31T09-31-49-354Z.json)
proved `meta_kpis` and `meta_benchmarks` absent and every proposed ID in existing
tables absent. No tables were created. The original 20-check local rehearsal and
its source are preserved under [legacy-rehearsal](validation-2026-10-31-source-access/legacy-rehearsal/rehearsal.json).
Those legacy branch tests remain local-only; do not treat them as deployed positive
acceptance or silently re-enable deferred Meta functionality. This packet alone
does not close all V1-054 or V1-052 acceptance.

## Paths traced and background-job boundary

- V1-034: `POST /api/custom-integration/transfer` in `server/routes-oauth.ts` checks
  both campaign owners; `storage.transferCustomIntegration` locks both campaigns,
  verifies owners/currency/source uniqueness and an empty destination, then moves
  scoped records transactionally. These fixtures contain no metrics or receipts.
  Automatic email connect/import routes remain release-disabled. The synthetic
  token cannot import into a draft campaign; no email sender is configured.
- V1-054 subset: `PATCH /api/linkedin/update/:campaignId` checks campaign ownership
  and strips supplied parent/ID fields; `storage.updateLinkedInConnection` also
  preserves those fields. Its input-change wrapper finds no GA4 refresh work or
  GA4 filter for these new custom drafts, so it creates no refresh work. The
  LinkedIn scheduler rejects draft campaigns before contacting providers.
- V1-052 subset: `client/src/pages/reports.tsx` only loads the local report for an
  accessible campaign and requires scheduled/paused status plus schedule metadata.
  The exact real component and final filter were exercised locally. Notifications,
  other persistent-state surfaces and deferred functionality remain separate.

## Completed user procedure: same browser/profile, two passes

Retained for audit; do not repeat this procedure against the now-removed fixtures.

1. Sign in with the **second account**. Open
   https://marketforensics.onrender.com/reports?campaignId=36631f9f-5f32-4ae6-8d20-d8430abb364c
   and wait for the Reports page. Paste the reviewed browser script into F12 →
   Console and press Enter. Expected: `PASS_SOURCE_OWNER`; the test report is
   visible. The script checks visibility itself.
2. Sign out and sign in with **Promo's original account**. Open the same URL and
   run the same script. Expected: `PASS_SOURCE_FOREIGN`. Copy its full JSON result
   to the agent. The script checks the settled hidden report and removes its exact
   browser-only fixture. No third account pass is required.

Stop on `CHECK_REQUIRED` or `INCOMPLETE` and report the result; do not re-import,
repeat mutations, delete the draft campaigns manually or change their status.
The script refuses a partial repeat and preserves a nonsecret local progress
record. A completed-pass repeat issues no duplicate writes.

## Agent verification and cleanup

Save the user's full JSON without alteration. From the repository root, use
`node docs/fixes/v1-batch-1/validation-2026-10-31-source-access/production.cjs` with:

- `cleanup <user-receipt-path>`: requires all 16 reported passes, exact run/IDs,
  final edited state and zero unplanned dependents; rehearses exact deletion and
  rolls back. Inspect the receipt before proceeding.
- `cleanup --commit <dry-receipt-path> <same-user-receipt-path>`: binds the exact
  manifest, target and user receipt; deletes only the five fixture IDs.
- `verify`: fresh read-only exact absence check and protected campaign identity
  check. Record results before closing any finding.
- If interrupted, `cancel` rehearses cleanup allowing only original/expected edited
  LinkedIn names and either planned integration parent; every other scope/data guard
  remains. `cancel --commit <cancellation-dry-receipt-path>` removes only those five
  IDs after review. It is not evidence of successful account acceptance. Unexpected
  values/dependents require separate exact investigation, never broad deletion.

The local test schema was dropped by the harness. Its newly created empty test
database was removed and the local PostgreSQL instance stopped after rehearsal.

Remaining Batch 1 inventory and cross-batch boundaries stay in the
[consolidated ledger](CONSOLIDATED_CLOSEOUT_2026-10-31.md).
