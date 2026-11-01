# Task 3: minimum recovery and compatible rollback

**Status: COMPLETE for minimum launch scope — compatibility and actual saved-key
retrieval/decryption pass.** This is the minimum launch recovery
review, not a full disaster-recovery certification. No runtime fix was required.
No database, secret store, provider account or private hosting dashboard was
accessed; no deploy, restore, key change or live write was performed.

## Evidence reused and checked

The [read-only reconciliation](validation-2026-11-01-recovery/evidence-2026-11-01T12-19-10-737Z.json)
and its [checker](validation-2026-11-01-recovery/check-evidence.cjs) establish:

| Boundary | Result and limit |
| --- | --- |
| Downloaded database backup | Existing October 29 receipt has all 71 tables / 5,903,996 rows matching the restored COPY bytes. This proves restoration of that snapshot; it is not a new backup or a current-state/hosted-permission restoration. No repeat restore was run. |
| Protected backup copy | Existing authenticated archive recovery is proven under the same Windows profile. Its DPAPI-protected archive key is distinct from the application's provider-token encryption key. Off-machine/profile-loss recovery is not claimed. |
| Current runtime | Anonymous `/api/health` returns 200, production mode and `0a42aac893b56e471246a75f3a4a0a5423e846e3`. Later commits change documentation only. Existing 258 focused checks, type/build results and hosted CI are reused; recorded source hashes match exactly. |
| Prior revision compatibility | `9848ef9c997f23a3dac558080f41a6c5b09e05f1` has identical Git objects for startup, storage, token vault, all shared contracts, all migrations, client, package/lock files and Render configuration. Both revisions have successful deployment/CI receipts. The only runtime difference is four request-array validation expressions; no database down-migration or data conversion is required. |
| Application-key custody | The actual saved copy authenticated all 16 populated fields in seven archived containers at 12:51:54 UTC on November 1. One intentionally empty container is not counted as authentication evidence. Earlier hidden-input control characters were resolved using right-click Paste. No running/local key was substituted as proof of the saved copy. [Actual redacted result](../v1-batch-1/validation-2026-10-31-remaining/saved-key-recovery-2026-11-01T12-51-54-212Z.json). |

The first checker attempt stopped locally because it normalized CRLF before
comparing hashes originally recorded from raw bytes. Comparing the original
bytes passes; neither application files nor evidence expectations were relaxed.
The stopped attempt made no network request. The final pass made one anonymous
health request and no other live request.

## Recovery target and incident-only procedure

The currently healthy **`0a42aac893b56e471246a75f3a4a0a5423e846e3`** is the
known-good baseline to retain for recovery from a future regression. It includes
production Clerk support, ownership guards, fractional-value handling and all
three recent parser/email/collection corrections. It is already deployed;
deploying it again merely to exercise a button is not required now.

The prior `9848ef9c` is data/schema compatible, but removes the early collection
rejection guard. It is an incident-specific fallback, not an equally protected
launch baseline. The October 22 `d259bab9` recovery branch is historical evidence
only and must not be used as the current production fallback: it predates the
later access, provider and production-sign-in changes.

For a future incident, the operator procedure is:

1. Identify the bad release and compare its code, schema and configuration delta
   with the baseline. This assessment does not pre-approve unknown future migrations.
2. In the existing Render service's Deploys page, identify the successful deploy
   for the exact baseline SHA. Confirm its artifact is still retained and its
   production Clerk/domain/encryption configuration matches the intended recovery.
   Do not choose an earlier development-Clerk deploy based only on a green status.
3. Only when recovery is needed, use **Rollback** for that exact deploy. Render
   reuses its artifact and service-specific environment; environment groups and
   custom domains have different retention behavior. Inspect any intervening
   configuration changes before acting. Dashboard rollback disables autodeploys.
   These details are from [Render's rollback documentation](https://render.com/docs/rollbacks),
   checked November 1. No rollback was executed during this review.
4. Preserve the current database, production owner IDs, provider connections and
   encryption key. A code rollback does not require restoring October 29 data
   over newer writes. That snapshot predates the ownership cutover and subsequent
   connection changes; actual data recovery would require isolated restoration
   and reconciliation before reconnecting a running app or jobs.
5. Check the recovered commit/health, ordinary production sign-in and exact
   campaign access. Check the affected regression only; do not repeat every import.
   Resume automatic deployment after the offending code/configuration is corrected.

A hosted rollback drill, future artifact retention, rebuilt-host recovery and
independent-machine key recovery are not claimed by the local comparison. No live drill,
hosting purchase, second computer or repeated database restoration is added to
the immediate queue. The minimum code/schema compatibility evidence is now
recorded, and the actual saved-copy check below completes the final Task 3 dependency.

## Saved-key completion and remaining scope limits

The user completed the [offline saved-key check](../v1-batch-1/SAVED_KEY_CHECK_2026-10-31.md).
The final result authenticates all sixteen fields from the unchanged, hash-verified
archive using the retained recovery copy. The missing-console-output correction
passes eleven synthetic controls; a failed attempt's boolean diagnostic identified
control characters in the hidden input. Right-click Paste resolved the failure.
No key was read by the agent, normalized to force a pass, rotated or saved by the helper.

### Later launch baseline — November 1, 17:32 Amsterdam

The final launch runtime is `b2bfe6cc5bd5151d42ad000a153620ec984d7360`.
The [final reconciliation](validation-2026-11-01-launch/minimum-launch-reconciliation-2026-11-01T16-32-56-808Z.json)
verifies its healthy deployment and passing exact-commit CI. Relative to the
`0a42aac8` baseline above, the only runtime change is the GA4 auth component's
explicit service-account choice; the other changed code file is its isolated
browser test. Storage, schema, migrations, token handling, dependencies and
hosting configuration are unchanged. Retain `b2bfe6cc` as the current recovery
baseline for future changes. Returning to `0a42aac8` would remove that visible
alternative, so it is not an equivalent onboarding release. No rollback or
new restore was run, and the existing evidence is not reopened.

No Task 3 steps remain for the minimum launch scope. The pass covers these archived
credentials, not current provider validity, every historical credential, a rebuilt
host, independent-machine recovery or a full disaster-recovery exercise. The
October 29 snapshot still predates the production ownership cutover; the incident
procedure above preserves newer live writes. Task 4's minimum assisted-onboarding
decision is now complete in the linked launch reconciliation and reuses this
evidence without reopening Tasks 1–3 or adding speculative code changes.
Broader formal finding counts are unchanged.
