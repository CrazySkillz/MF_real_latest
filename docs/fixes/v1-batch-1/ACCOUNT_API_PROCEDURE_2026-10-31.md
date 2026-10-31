# Combined account/API acceptance procedure

## First packet status and later evidence

This first packet is complete within the evidence below. The subsequent
[source-access packet](SOURCE_ACCESS_PROCEDURE_2026-10-31.md) now proves actual
owner report-card visibility and foreign absence for a separate fixture, and
closes V1-034. Current Batch 1 counts are **8 CLOSED / 12 OPEN**. The first
fixture's unconfirmed owner reappearance is retained as a historical limitation;
do not repeat these completed checks.

**The three API passes and exact database cleanup are complete. Report owner
visibility remains unverified.** The user reported `PASS_OWNER`, `PASS_FOREIGN`
and supplied the complete [PASS_RECHECK result](validation-2026-10-31/user-account-recheck-8bacbb31.json)
with 15 passing rechecks. The user confirmed the report was hidden in Promo's
original account; when asked about reappearance in the second account, they
answered "No, or I didn't check". Do not infer a positive card-visibility result.

The [production deletion rehearsal](validation-2026-10-31/account-cleanup-2026-10-31T09-04-22-883Z.json)
verified the exact seven IDs, their second-account ownership, zero values,
encrypted synthetic credential, detached parent/child links and absence from
the pre-test baseline, then rolled back. The [commit](validation-2026-10-31/account-cleanup-2026-10-31T09-05-14-966Z.json)
repeated all guards and removed exactly those seven rows; every outside row in
the seven tables had the same count/hash within the transaction. A fresh
[read-only connection](validation-2026-10-31/account-baseline-2026-10-31T09-05-53-625Z.json)
and [receipt comparison](validation-2026-10-31/account-cleanup-verified-8bacbb31.json)
prove all seven IDs absent, original table IDs preserved and the three protected
campaign identities/statuses unchanged. No provider connection, campaign row,
runtime code, schema or scheduler was changed by this cleanup.

V1-002, V1-003 and V1-053 meet their original acceptance boundaries. At this first
packet's completion Batch 1 was **7 CLOSED / 13 OPEN**. V1-006 remains open for actual
process-restart and broader attribution acceptance; V1-052 remains open for
notification/persistent-state transitions, with later Reports evidence linked above. These
completed API checks must not be repeated to fill those distinct gaps.

[Final rehearsal](validation-2026-10-31/account-bundle-verified.json): **81 API
assertions, 9 exact-cleanup cases and 3 report-cache visibility checks pass**.
The original report checks stopped at `localVisibleReports` and missed the final
`storedScheduledReports` filter. They are not evidence of a rendered report card.
The user subsequently reported the fixture missing from the scheduled list.
[Corrected rehearsal](validation-2026-10-31/account-bundle-report-correction.json)
reproduces that failure with `schedule:null`, then verifies the exact paused
fixture with empty-recipient schedule metadata through the actual access, merge
and final scheduled-list filters. It passes the same 81 API checks, two additional
fixture guards and nine cleanup cases. Six altered-fixture cases fail without
requests or writes. Only audit scripts changed; deployed application code did not.
Wrong-origin/unknown-account execution makes no request. Repeating a completed
pass creates no duplicate; a lost create response stops all retry requests.
The isolated PostgreSQL schema/database were removed and its server stopped.

This is the first executable combined portion of package A in the
[complete close-out ledger](CONSOLIDATED_CLOSEOUT_2026-10-31.md). Finding counts
are **7 CLOSED / 13 OPEN** after the bounded closures above.

## Exact coverage and remaining limits

| Finding | This grouped session covers | Still separate |
| --- | --- | --- |
| V1-002 | CLOSED: user-operated positive/foreign API checks plus independently verified stored scope/encryption and cleanup. | Existing unowned-row inventory remains unassigned; no provider validity or unrelated global consumer is certified. |
| V1-003 | Last missing Trends ownership branch: second account 404, owner no-keywords 400. | Trend-provider value correctness is separate. Owner preflight with configured keywords stops before the Trends request. |
| V1-006 | Actual owned model/journey/touchpoint create, model/journey edit, zero-value attribution, persistence across reload/account switch; foreign existing-row read/edit/delete/calculate/child-insert denial. | Render process restart is not performed; broader campaign-linked attribution and set-default behavior retain their existing local evidence and live limits. No current Attribution page is invented. |
| V1-052 | Foreign-account report absence confirmed; exact browser fixture removal passed. Positive owner reappearance was not confirmed. | Positive report-card visibility, actual late notifications and remaining persistent-state surfaces remain open. Ordinary sign-out/Clients checks already passed. |
| V1-053 | Two invalid-input requests per limiter, including caller `isTestMode:true`, show configured OAuth/LinkedIn/import headers and counting without invoking a provider. | Distributed load/capacity and all infrastructure rate-limiter properties are not inferred. Stop on low quota or any unexpected status. |

V1-034 transfer, V1-054 retained LinkedIn/Meta child updates and V1-075 positive
connector-spend acceptance remain explicitly open. They are not exercised by
global attribution edits. Their positive fixtures require additional exact scope;
in particular, connector spend calls the GA4 derived-value path after save, so a
blank draft cannot be assumed to exercise a successful complete spend lifecycle.
Do not write test spend into Promo or the provider-validation campaign to avoid
preparing that fixture. Their local ownership/atomicity coverage is retained.

## Temporary data boundary

The browser script creates exactly seven detached database rows:

- one zero Metrics row;
- one zero Performance row;
- one disconnected generic Integration containing an explicitly synthetic marker;
- one inactive, nondefault Attribution Model;
- one abandoned, zero-value Customer Journey;
- one Touchpoint with no campaign;
- one zero-value Attribution Result with no campaign.

The unique `B1_ACCESS_<UUID>` marker is used wherever the schema has a marker
field. The Performance table has no marker column: its returned UUID, exact
second-account owner, date, all-zero fields and exclusion from the independently
captured baseline are mandatory cleanup guards. Missing response acknowledgments
stop the procedure; the agent must inspect a partial run before any retry.

A single paused browser-only report is added to `marketpulse_reports`, linked to
Batch 1 Provider Check solely to exercise the existing Reports access guard.
It has no backend report ID, recipients or download URL. Its local schedule
metadata exists solely to satisfy the displayed scheduled-card filter; status
stays Paused and no backend schedule is created. Do not use its Resume, Edit or
Download buttons. The final
browser pass removes only that ID after checking its marker, campaign and state.
Other browser report entries are preserved. The small audit manifest remains
under its distinct localStorage key for continuity until cleanup is verified.

## Route and storage trace

- `server/routes-oauth.ts`: exact global GET/POST handlers authenticate and parse
  the schema before `storage.create*`; Metrics/Performance/Integrations queries
  pass the actor. These generic APIs have no campaign-financial or provider side
  effect. Integrations force `connected:false`, encrypt supplied synthetic text,
  and redact it on response.
- Attribution GET/POST/PATCH/DELETE/calculate handlers check actor or existing
  parent before mutation. Current `server/storage.ts` persists the model/journey,
  locks parents for touchpoint/calculation, and preserves identities on edits.
  The detached fixture can affect only test-owner attribution state; zero values
  and no campaign links prevent campaign financial propagation.
- Trends checks campaign access before its missing-keywords return and before
  dynamically loading the provider. The owner preflight checks the current
  configuration. The second-account request is expected to stop at access denial.
- OAuth `/api/auth/hubspot/connect` and LinkedIn `/api/linkedin/campaigns` use
  deliberately missing required input; their handlers return 400 before provider
  code. Import preview uses the random run UUID as a nonexistent campaign and
  returns 404 at campaign access before upload processing. Each limiter receives
  only two requests. Header checks do not saturate it or require a 429.
- `/reports?campaignId=...` is registered in `client/src/App.tsx`. The actual
  `reportStorage` reader, `hasCampaignReportAccess`, `localVisibleReports`, merge
  and final `storedScheduledReports` filter were executed locally with the corrected
  fixture. The user's visible page
  check remains necessary because local fixtures do not operate deployed Clerk.

## One manual session, three passes

Use the same normal browser/profile for every pass. The same script is reused:
[manual-account-bundle.js](validation-2026-10-31/manual-account-bundle.js).

To copy it, run this in PowerShell before each console pass:

```powershell
Get-Content -Raw 'C:\Users\me\Documents\MF_real_latest\docs\fixes\v1-batch-1\validation-2026-10-31\manual-account-bundle.js' | Set-Clipboard
```

1. Sign in with the **second account** at `https://marketforensics.onrender.com/`.
   Press F12, choose Console, paste and press Enter. Expect `PASS_OWNER`.
   Open `https://marketforensics.onrender.com/reports?campaignId=36631f9f-5f32-4ae6-8d20-d8430abb364c`.
   Confirm the paused report whose name starts `B1_ACCESS_` is visible.
   For the already completed owner pass with the original invisible fixture,
   run the corrected script once while still on this Reports page. Expect
   `PASS_REPORT_READY`; it updates only the exact existing browser fixture and
   dispatches the page's existing `reportAdded` event. It creates no rows and
   makes no API requests. Repeating this repair does not duplicate the fixture.
2. Sign out and sign in with **Promo's original account**. Run the same script
   again. Expect `PASS_FOREIGN`. Open the same Reports address. The `B1_ACCESS_`
   report must be absent, including while the page loads.
3. Sign out and return to the **second account**. Open the same Reports address
   and confirm the test report is visible again. Run the same script once more.
   Expect `PASS_RECHECK`; it removes the browser-only report. Copy this final
   JSON result into chat so its exact seven IDs can be independently checked and
   cleaned up. Also report the three visual outcomes: visible / hidden / visible.

If any pass reports `CHECK_REQUIRED`, `INCOMPLETE`, a low quota or a configured
Trends warning, stop and copy that result. Do not repeatedly run the creation
phase. No production provider consent, import, test email, real report generation
or campaign edit belongs in this procedure.

## Agent verification and exact cleanup

Independent baseline: [read-only receipt](validation-2026-10-31/account-baseline-2026-10-31T04-59-37-473Z.json).
Current baseline contains the previously recorded 4 Metrics / 7 Performance /
5 Integrations rows and no attribution fixtures. Three retained campaign identities
and active states were checked without returning credential values.

After all user outcomes:

1. Save the exact `PASS_RECHECK` JSON as a new receipt. Preserve the user's visual
   answers separately as user-reported evidence; do not claim agent observation.
2. Run `account-production-check.cjs cleanup BASELINE_FILE MANIFEST_FILE`.
   This selects/locks only the seven IDs, proves their owner/marker/zero values,
   encrypted synthetic credential shape, inactive/default state, no campaign
   links, exact child counts and absence from the pre-test baseline. It rehearses
   all seven deletes and **rolls back**. No broad fixture-pattern deletion exists.
3. Inspect the receipt. Only a matching passing dry-run receipt can authorize
   `account-production-check.cjs cleanup BASELINE_FILE MANIFEST_FILE DRY_RUN_FILE --commit`.
   The command repeats every guard and requires the exact baseline/manifest hashes.
   Deletes are in one transaction; hashes/counts of every outside-scope row in
   all seven tables must remain identical. Any failed guard rolls back.
4. Independently read back the seven IDs and retained campaign identities. Only
   then record cleanup complete. Remove only the audit manifest key when safe;
   never clear all browser storage.

These commands do not retire any historical credential, alter a provider connection,
delete a campaign or reuse the earlier 223-record cleanup approval. They remove
only the temporary fixtures created by this procedure. A failed/partial run is
not eligible for the success-only cleanup command without a separate exact review.

## Validation artifacts

- [Manual procedure](validation-2026-10-31/manual-account-bundle.js)
- [Current-handler/current-storage PostgreSQL rehearsal](validation-2026-10-31/rehearse-account-bundle.cjs)
- [Credential-isolated local runner](validation-2026-10-31/run-account-rehearsal.cjs)
- [Exact transaction/cleanup guards](validation-2026-10-31/account-fixture-cleanup.cjs)
- [Read-only production baseline and guarded cleanup entry point](validation-2026-10-31/account-production-check.cjs)
- [Final local results and source hashes](validation-2026-10-31/account-bundle-verified.json)

The local harness uses synthetic identity and blocked external networking. Its
quota headers are simulated from the current actual limiter configuration/skip
functions, not a claim about live middleware transport. No runtime edit or new
application dependency was made, so a deployment/full application rebuild is
not required for this acceptance preparation.
