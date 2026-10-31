# Consolidated final API acceptance

Completed: all 18 deployed checks pass and all nine disposable rows have been
removed with independent read-only verification. V1-006 and V1-030 are CLOSED
within their original security/persistence boundaries. The two retained
connector-spend aliases also pass their owned live save/readback checks;
V1-075 retains its historical/downstream acceptance. This packet does not prove
provider renewal/resource revocation, independent recovery, or whole-source
analytics correctness.

The [18-check script](validation-2026-10-31-final-api/manual-template.js) uses the
second account once. It edits only a new random-ID draft campaign and its six
fixture rows. It creates one zero-value attribution result, one spend source,
and one dated spend row. The spend aliases create EUR 0.01 then replace it with
EUR 0.02 in this disposable draft. It calls no provider, sends no email, changes
no existing campaign, and adds no schedule, refresh work or metric snapshot.
The draft has no GA4 filter or provider connection; its two attribution models
are inactive. Initial readback refuses existing/default models or nonzero spend.
It prints no credentials and stores no browser fixtures.

[Rehearsal](validation-2026-10-31-final-api/rehearsal.json) executes the actual
current route/storage bodies against current-schema isolated PostgreSQL tables.
All 18 API assertions pass. Thirteen grouped guards cover seed rollback/commit,
wrong origin/account, foreign writes, cleanup rollback, six changed-field
refusals, unknown campaign dependents, and exact final deletion preserving a
second owner's fixture. Cleanup identifies only the manifest's six initial
rows plus the three exact generated dependent rows. Changed identity, nonzero
attribution, changed amounts or unplanned dependents stop the transaction.
The isolated schema is removed. This is local evidence, not live acceptance.

[Live preflight](validation-2026-10-31-final-api/preflight.json) uses a pinned
production database target and verified TLS, checks the hashed second-owner
identity/client, confirms no existing owner attribution models, and finds all
three protected campaigns active. The [production seed rehearsal](validation-2026-10-31-final-api/seed-rehearsal.json)
passed: six inserted fixture rows rolled back, outside-row hashes unchanged,
absence read back. After [the exact release passed](validation-2026-10-31-final-api/release.json),
[six fixture rows were committed](validation-2026-10-31-final-api/seed.json) at
13:17 UTC with outside-row hashes unchanged. The manifest is run
`72859c4e-f955-48a2-b0a6-5c63f4cd387d`, draft
`5d27ee86-1c1a-4d96-864f-598dbbb0f3ca`. The user supplied the complete
[PASS_FINAL_API result](validation-2026-10-31-final-api/user-result.json), including
all 18 passing assertions. Do not seed or request this test again.

## Independent verification and cleanup

[Inspection](validation-2026-10-31-final-api/inspect.json) verified the exact
owner/client, inactive models, default selection, zero-value linked result,
final sender list, EUR 0.02 dated source/record, draft currency and all dependent
tables. Returned result/source IDs match the user's JSON; the generated spend
record is `393aea93-1ca5-45c5-8682-1c173b7712c0`.

[Cleanup rehearsal](validation-2026-10-31-final-api/cleanup-rehearsal.json) rolled
back all nine deletes and retained the outside-row hashes. The
[commit](validation-2026-10-31-final-api/cleanup.json) at 13:28 UTC removed only
those same nine rows, preserving hashes of all other campaign, custom-integration,
attribution-model, journey and touchpoint rows. The cleanup also rejects unknown
campaign dependents; it calls no provider or ordinary campaign deletion route.

A [fresh connection](validation-2026-10-31-final-api/verify-cleanup.json), with
an enforced READ ONLY transaction, independently verified all nine IDs absent,
all campaign-linked dependents absent, no remaining fixture attribution model,
and all three protected campaigns retaining their preflight active status.
The first independent checker attempt encountered a UUID/text comparison error
in its additional exact-ID SELECT; its
[failed receipt](validation-2026-10-31-final-api/verify-cleanup-type-check-failure.json)
is retained. Explicitly casting IDs to text corrected that read-only checker.
No deletion was retried, and no application code changed during cleanup.

## Findings closed and limits retained

| Finding | Evidence and disposition |
| --- | --- |
| V1-006 | CLOSED for the original anonymous/global access, fabricated read data and process-memory persistence defects. Prior actual two-account positive/foreign checks and stored-state verification combine with this deployed owner-default/linked-result acceptance and the [two separate process persistence test](validation-2026-10-31-final/attribution-process-restart.json). The latter uses current storage bodies and PostgreSQL; it is not a Render restart. Existing attribution formulas, configuration, pagination and all downstream analytics remain outside this security closure and are not certified. |
| V1-030 | CLOSED for the ignored sender-list update. Actual deployed replacement, explicit clear, replacement again and reload pass; the final stored list is independently verified. [Current PostgreSQL tests](../../../server/v1-batch1-postgres-regression.cjs) cover omission preservation, newly allowed publication and removed-sender rejection through the publication transaction. Automatic email import remains disabled under the user's V1-004 exclusion: no deployed signed sender was accepted, and that acceptance remains mandatory before re-enabling email import. |
| V1-075 | Owned add/replacement through both aliases, scoped source list/total, exact dated persistence and unchanged campaign currency pass live. Current local currency/ownership/materialization negatives and hosted anonymous denials remain. Historical orphan/downstream disposition is still OPEN; this packet does not certify every connector platform, source lifecycle or derived consumer. |

The application remains on the previously tested/deployed `adc5a6fe`. This
receipt/documentation update adds no runtime change, provider call, schedule
change or additional production data beyond removal of the exact test fixture.
The [completion check](validation-2026-10-31-final-api/completion.json) reconciles
all 20 Batch 1 statuses and all 130 queue rows against the ledger, verifies local
evidence links and unchanged runtime hashes, and scans this packet for private
environment values without printing them.

Execution order: finish release gate and verify deployed revision; run
`live.cjs seed-rehearsal` (always rolls back), then `live.cjs seed`; give the user
the generated `manual.js` for their second-account Console once. After a passing
result, independently run `inspect`, `cleanup-rehearsal`, then `cleanup`.
`cleanup-partial` is for a stopped test only and retains the same exact scope
checks. No full campaign deletion or unrelated cleanup route is used.

The runtime follow-up found during this rehearsal is documented in
[connector context follow-up](CONNECTOR_CONTEXT_FOLLOWUP_2026-10-31.md).
