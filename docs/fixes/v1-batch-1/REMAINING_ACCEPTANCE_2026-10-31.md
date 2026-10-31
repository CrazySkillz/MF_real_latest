# Remaining Batch 1 acceptance after spend-security closure

## Current execution priority: sufficient production readiness

The user subsequently clarified: the app must be sufficient for production,
without unnecessary tasks. **Cancel the proposed manual HubSpot reconnect.**
No reconnect result was supplied and none is claimed. The preparation captured
only a read-only baseline; it did not change a connection or import data.

All twenty original code corrections are implemented. The credential-overwrite
defect has exact-getter PostgreSQL race/replacement/restart evidence and real
provider renewal observations. Another manual HubSpot consent is additional
provider-lifecycle assurance, not a response to a newly observed failure. Do not
repeat it or the completed initial imports/account checks merely to increase
coverage or close a checklist label.

Separate the four remaining evidence limits from confirmed unfixed defects:

| Evidence limit | Immediate production-focused disposition |
| --- | --- |
| V1-008 recovery dependency | Keep backup/key recovery under its existing Batch 8 V1-016 release decision. It is not another immediate Batch 1 request. Saved custody/local restore do not prove independent key recovery. |
| V1-054 legacy Meta positive update | No positive test against absent legacy tables is required for the currently enabled GA4-first journey. Do not create those tables. Retained access/identity guards and existing tests remain mandatory; legacy functionality is not certified. |
| V1-078 real valid-code replay | Retain as unverified assurance, separate from the deployed rejection of the original public-signing-secret exploit. No new session, real code capture or manual callback replay is requested now. Reassess if a concrete weakness or relevant flow change is found. |
| V1-088 additional reconnect/renewal/hosted-restart combinations | Defer additional manual provider permutations. Reuse the real connections/imports, live renewal observations, isolated races and process-restart evidence. Do not rotate a shared grant to manufacture coverage. Reassess on an observed connection failure or credential-path change. |

This changes execution priority, not test results. The earlier **16 CLOSED /
4 OPEN** counts describe the broader formal acceptance standard; they do not
mean four known code defects remain. Do not turn the unperformed checks into
PASS or use this scope decision as whole-app production certification. Core
security, tenant isolation, correct enabled flows, data integrity and recovery
remain release concerns. Continue only with a confirmed unresolved defect or an
essential enabled-flow/recovery gate, using existing evidence before adding work.

The user has no immediate action from this record. The earlier reconnect/replay
"next work" statements below are superseded by this execution priority.

Current status: **16 CLOSED / 4 OPEN**. All twenty original code corrections are
implemented. No remaining requirement is waived by this note. The earlier read-only
observations changed no production state. The later provider/permission packet
records normal credential renewal and its exact temporary-fixture cleanup separately.
Subsequent isolated investigation
reproduced the credential/publication defect and produced the
[localized storage correction](CREDENTIAL_PUBLICATION_2026-10-31.md), with its own
validation/release boundary. No live provider configuration, campaign data or
refresh cadence was changed for these checks. This is not complete Batch 1 or
whole-app production-readiness certification.

## New evidence

- [Final security boundary check](FINAL_SECURITY_BOUNDARIES_2026-10-31.md):
  both deployed LinkedIn/Meta callbacks reject states signed with the original
  public fallback, including repeated use. Five bounded anonymous requests,
  no real code or session; the initial Meta checker wording mismatch and its
  corrected completion are retained. This is not valid-code replay evidence.
  No further manual request is issued; all four external conditions remain OPEN.

- [Callback and credential follow-up](CALLBACK_CREDENTIAL_CLOSEOUT_2026-10-31.md):
  four native Express denial failures reproduced, two callback guards correct
  them, and all 138 focused tests pass. Sixty isolated real-PostgreSQL checks
  cover ten getters through credential replacement/deletion and a fresh local
  process. Synthetic provider replay/reconnect is not live provider acceptance;
  a local restart is not a Render restart. The external limits below remain.

- [Saved-key check prepared](SAVED_KEY_CHECK_2026-10-31.md): the existing downloaded
  archive passes its hash/scope check; sixteen synthetic decryption safeguards and
  the exact hidden-input wrapper pass. The user objected to this interruption;
  they were told not to run it now. Do not repeat the request. Actual key retrieval
  remains unverified under Batch 8 V1-016, not an additional immediate Batch 1 task.
  The prepared check reads no live database or provider.

- [Provider/permission acceptance](PROVIDER_PERMISSION_ACCEPTANCE_2026-10-31.md)
  closes V1-123 with deployed resource denials, 21 production-database policy and
  hydration checks, traced worker callers and verified exact fixture cleanup.
  Ten live provider reads pass; GA4/HubSpot/Salesforce renewal evidence is retained
  with unchanged selected publication metadata. Five fresh signed-state callbacks
  without a session are denied. No repeat of these user checks is needed.

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
| V1-078 | Current signing correction, real OAuth successes, 27 anonymous denial cases, and five fresh valid-state/no-session callback denials. | Valid authorization-code replay remains. Signed-state verifiers are stateless; a nonce does not itself consume the state. The successful session-denial packet is not code-replay proof. |
| V1-088 | Ten real-PG migration interleavings, both credential cleanups, initial connections/imports, scheduled continuity and deployed `5f0ffe96`. Two live reads for each of five providers pass. GA4/HubSpot/Salesforce renewals and earlier Sheets expiry advancement preserve selected publication metadata. | Reconnect and remaining provider-specific renewal/restart evidence. No provider exchange secrets were captured. Shopify renewal is not established by its successful read or inferred from the absent expiry column. |
| V1-123 — CLOSED | Deployed resource denials; 21 policy/hydration checks against production PostgreSQL with rollback; traced current worker callers; prior real GA4/Sheets consent/import and Promo continuity. Exact fixture removed with fresh READ ONLY absence proof. | No remaining gate for the original shared-credential tenant boundary. Real worker revocation was not induced on a protected grant; Google Ads functionality remains postponed. Full scheduler/provider analytics readiness is not inferred. |

Release verification of the credential correction is complete. The next work is
a remaining reconnect/replay procedure. Recovery remains under Batch 8 V1-016
and is not requested for immediate execution. The
user's completed initial consent/import and account checks must not be repeated.
The completed provider/grant packet must not be repeated. Independent recovery
and absent legacy Meta tables remain explicit external limitations; they are not
resolved by another passing local test suite or a tracker status change.
