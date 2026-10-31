# Final Batch 1 security boundary check, October 31

All twenty original code corrections are implemented. The current acceptance
ledger remains **16 CLOSED / 4 OPEN**. This check adds deployed evidence; it
does not waive an acceptance condition or certify the whole app.

## Original public signing-secret regression

The [bounded checker](validation-2026-10-31-final-boundaries/public-signing-regression.cjs)
extracts the original LinkedIn/Meta signing functions from audit baseline
`777aae6f` and the current functions from `server/routes-oauth.ts`. In production
mode with no configured secret, the old functions accept a state signed with the
public development fallback. The current functions reject that state when a
non-public synthetic key is configured and fail closed when the production key
is absent. [Both isolated reproductions pass](validation-2026-10-31-final-boundaries/public-signing-2026-10-31T17-23-06-223Z.json).

Deployed runtime `357e950fcf03d02c93465cd602eda119f08cf7f6` rejected the forged
state twice for each provider. Requests used no session, real authorization code,
real campaign ID or provider credential. The success condition requires an error
popup event, the verifier's expected denial reason and no success event; HTTP 200
alone is insufficient.

- [Initial receipt](validation-2026-10-31-final-boundaries/public-signing-2026-10-31T17-19-23-541Z.json):
  both LinkedIn denials passed. The first Meta assertion failed because the
  checker incorrectly expected `Invalid state`; the exact Meta verifier uses
  `Tampered state` for a signature mismatch. The unsuccessful receipt is retained.
- The checker was corrected to require the exact reason returned by the current
  isolated verifier, and local reproduction was rerun. No runtime code changed.
- [Meta-only completion](validation-2026-10-31-final-boundaries/public-signing-2026-10-31T17-23-25-739Z.json):
  both denials pass. The completed LinkedIn requests were not repeated. Five
  callback requests were made in total; none returned 429. The receipts retain
  the observed remaining-quota headers. No limiter reset or bypass was used.

This proves rejection of the original public-key forgery and its repeated use.
It does **not** prove replay handling for a valid provider authorization code,
single-use state consumption or a real provider reconnect. Existing nonce/state
verification is stateless. The V1-078 acceptance requirement is not closed by
substituting invalid signatures for valid-code replay.

## Evidence reused, without repeating completed work

The [latest runtime packet](CALLBACK_CREDENTIAL_CLOSEOUT_2026-10-31.md) records the
two-line native Express callback correction, 138 focused passes, 60 isolated
credential lifecycle checks, **6,971/6,971 full-suite passes**, successful builds,
typecheck and KPI gate. [Hosted CI and Render deployment](validation-2026-10-31-closeout/release-2026-10-31T17-02-04-759Z.json)
also pass for that runtime. This additional packet changes documentation and the
standalone diagnostic only; it does not change application code, calculations,
campaign records, credentials, schedules or hosting settings.

The [legacy Meta rehearsal](validation-2026-10-31-source-access/legacy-rehearsal/rehearsal.json)
already exercises actual retained handlers/storage with isolated PostgreSQL,
including valid edits, immutable identities and foreign denials. It is not a
deployed positive update: the two legacy tables are absent in the production
inventory. Creating obsolete production tables simply to produce a passing
test would change the product and is not warranted.

## Exact remaining conditions; no new manual request

| Finding | Remaining condition | Current execution limit |
| --- | --- | --- |
| V1-008 | Shared independent key/backup recovery evidence under Batch 8 V1-016. | Saved-key custody and same-machine restore are recorded; independent key retrieval/restoration is not verified. The user postponed the prepared key check. Do not ask for it again or treat a synthetic key as the saved production key. |
| V1-054 | Deployed positive acceptance for the retained legacy Meta update branches. | `meta_kpis` and `meta_benchmarks` are absent. Retain the existing isolated proof and the documented deployment limit; do not create the tables or claim a live positive. |
| V1-078 | Valid provider authorization-code replay evidence. | Available live evidence covers initial consent, invalid signatures and fresh signed-state denial without a session. No authenticated browser/session or unused provider code is available to this agent. Do not impersonate a user or substitute synthetic replay for provider acceptance. |
| V1-088 | Remaining real reconnect/provider-specific renewal and hosted-restart evidence. | Initial connections, natural renewal observations, publication continuity and isolated replacement/restart checks are complete. A shared provider grant must not be rotated or revoked merely because the app campaign is a test fixture. |

The user chose manual browser operation and now requests no further questions.
No additional login, clipboard script, saved key, paid database or second computer
is requested here. These external conditions remain explicitly unresolved; no
already completed account/import/cleanup test needs repeating. Whole-app release
remains NO-GO. Changing tracker labels cannot supply the missing evidence.
