# Consolidated final API acceptance

Prepared, locally rehearsed; live acceptance is pending. This packet covers the
remaining owned default/campaign-linked attribution, whitelist edit/reload, and
two retained connector-spend aliases (V1-006/030/075). It is not the remaining
provider-renewal/resource-revocation or independent recovery check.

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
`5d27ee86-1c1a-4d96-864f-598dbbb0f3ca`. The checked generated script was copied
to the clipboard and the single second-account run requested. Acceptance and
cleanup are pending; do not seed again or mark these findings closed.

Execution order: finish release gate and verify deployed revision; run
`live.cjs seed-rehearsal` (always rolls back), then `live.cjs seed`; give the user
the generated `manual.js` for their second-account Console once. After a passing
result, independently run `inspect`, `cleanup-rehearsal`, then `cleanup`.
`cleanup-partial` is for a stopped test only and retains the same exact scope
checks. No full campaign deletion or unrelated cleanup route is used.

The runtime follow-up found during this rehearsal is documented in
[connector context follow-up](CONNECTOR_CONTEXT_FOLLOWUP_2026-10-31.md).
