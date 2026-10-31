# Remaining Batch 1 acceptance after spend-security closure

Current status: **15 CLOSED / 5 OPEN**. All twenty original code corrections are
implemented. No remaining requirement is waived by this note. The read-only
evidence below changed no production state. Subsequent isolated investigation
reproduced the credential/publication defect and produced the
[localized storage correction](CREDENTIAL_PUBLICATION_2026-10-31.md), with its own
validation/release boundary. No live provider configuration, campaign data or
refresh cadence was changed for these checks. This is not complete Batch 1 or
whole-app production-readiness certification.

## New evidence

- [V1-075 acceptance](SPEND_SECURITY_ACCEPTANCE_2026-10-31.md) closes the original
  spend security finding after live API acceptance, exact cleanup, fresh historical
  inventory and twelve real PostgreSQL reader checks.
- [Callback receipt](validation-2026-10-31-remaining/public-oauth-denials.json):
  25 anonymous missing/invalid/repeated-invalid callback requests returned the
  expected denials. This includes configured Google/Sheets, HubSpot, Salesforce,
  Shopify, LinkedIn and Meta branches; no real authorization code or cookie was
  used. Google Ads' next invalid-state check received **429**, so execution stopped.
  The final repeated-invalid Google Ads case was not run in that attempt. An HTTP 200 error popup counts as a denial only
  when it contains the expected error and no success event.
- The public callback script initially exceeded the shared **ten OAuth requests
  per IP per fifteen minutes** limit. Existing connections/data were not changed;
  new OAuth starts from that IP could be temporarily blocked. The user was informed
  that the window should end about 15:27 Amsterdam time. No bypass, quota reset
  or config change was attempted. The revised script caps limited routes at
  eight requests and stops when a returned remaining quota falls below two.
  [Four fake-transport safety checks](validation-2026-10-31-remaining/callback-budget.json)
  prove the bounded plan and immediate low-quota/429 stop. The revised plan has
  not been rerun in full against production. After the original window expired,
  an explicit two-request mode ran only the unfinished Google Ads cases at 16:01
  Amsterdam. [Both pass](validation-2026-10-31-remaining/public-oauth-denials-2026-10-31T15-01-49-213Z.json).
  The combined inventory now covers all 27 anonymous denial cases. This does not
  establish valid signed-state replay or authenticated session acceptance.
- [Read-only publication evidence](validation-2026-10-31-remaining/provider-publication-2026-10-31T14-18-44-822Z.json):
  all five exact test connections remain active, encrypted and without plaintext
  credential fields. The 14:00 Amsterdam work completed at 14:11:03, on attempt
  one with no recorded error and no invalidation. HubSpot, Salesforce, Shopify and
  Sheets source-sync timestamps fall within this run. The current executive
  snapshot remains aligned. These are observed continuity facts; they are not
  captured OAuth renewal exchanges or reconnect/revocation tests.
- Naive database timestamp fields in the newer receipt are returned as stored
  text, avoiding local `pg` timezone conversion on Windows. Earlier metadata-only
  receipts must not be used to assert an exact UTC expiry instant. No production
  timestamp or application behavior was changed.

## Exact outstanding boundaries

| Finding | Proven | Still not proven / concrete boundary |
| --- | --- | --- |
| V1-008 | Explicit-key/verified-TLS startup enforcement, current connected-field compatibility, approved obsolete plaintext/ciphertext cleanup, saved-key custody and local export restore. | Independent recovery remains under Batch 8 V1-016. The user has no second computer; a paid Render database is neither approved nor required. A fresh remote recovery environment and secure independent key retrieval have not been prepared or tested. Do not repeat key-saving or local restoration questions. |
| V1-054 | Actual owner/foreign LinkedIn edit acceptance and independent state check; retained exact legacy Meta handler/storage tests. | Live positive legacy Meta row-update acceptance cannot run because `meta_kpis` and `meta_benchmarks` are absent. The fresh production inventory reconfirms absence. Do not create those tables to manufacture acceptance. Current Meta UI uses shared KPI/Benchmark paths; legacy API branches remain guarded and tested locally, not represented as deployed positives. |
| V1-078 | Current production signing correction, configured real OAuth successes, signature negatives and all 27 anonymous callback denial cases across the original and bounded follow-up receipts. | Valid-state/session/replay acceptance remains. The signed-state verifiers are stateless and accept an otherwise-valid state again; a nonce in the payload does not itself consume it. This packet does not prove valid authorization-code replay rejection. |
| V1-088 | Ten real-PG migration/renewal interleavings, zero obsolete plaintext/public-fallback credentials, actual first connections/imports and observed scheduled continuity. The credential-only publication defect is corrected and deployed as `5f0ffe96`, with 6,959 passing current tests and hosted CI. Read-only post-release evidence shows one Sheets expiry advancement with unchanged sources/work/snapshots. | Controlled real renewal/reconnect acceptance across configured providers remains. The metadata comparison did not capture a provider exchange. Application metadata endpoints can renew credentials and therefore are not read-only diagnostics. |
| V1-123 | Exact resource/customer policy and three hydration revocation controls locally; configured Promo grant/continuity; real GA4 and Sheets customer consent/imports. | Deployed exact-resource denial/revocation and worker behavior need a disposable, precisely bounded grant fixture. Revoking the shared Google authorization is unsafe because other campaigns use it. No protected grant, token or provider authorization was changed. |

Release verification of the credential correction is complete. The next work is
a consolidated provider/grant acceptance procedure with exact cleanup. The
user's completed initial consent/import and account checks must not be repeated.
No new manual procedure is represented as ready by this note. Independent recovery
and absent legacy Meta tables remain explicit external limitations; they are not
resolved by another passing local test suite or a tracker status change.
