# Credential renewal must preserve published analytics

Status: localized correction implemented; all **6,959 current-version tests in
399 files pass, zero failures/skips**. TypeScript, production build, the required
GA4 KPI gate and the exact candidate's hosted workflow pass. [Render is verified
healthy on the exact commit](validation-2026-10-31-remaining/release.json).
This correction does not close V1-088's real renewal/reconnect requirement or the
other remaining Batch 1 findings.

## Root cause and exact path

Ordinary credential renewal saves for GA4, Google Sheets, HubSpot, Salesforce and
Shopify used `storage.writeGA4RefreshInputChange`. After saving the credentials,
that helper invalidated every campaign work identity, released active leases and
cleared the executive snapshot's alignment note. It did this even when the
provider identity, selected data and source amounts had not changed. Consequently
a metadata/connection read that renewed credentials could disrupt the published
view and scheduled work. Worker saves with an explicit refresh scope already used
a separate ownership-checked branch and did not take this ordinary-save path.

The [before reproduction](validation-2026-10-31-remaining/credential-only-before.json)
contains ten failing real PostgreSQL cases: running and completed work for each
of the five providers. Each successful token-only save changed work state that
should have remained unchanged. No live token was refreshed to reproduce this.

Paths traced: GA4 token update; Sheets route/token-scheduler save; HubSpot refresh;
Salesforce refresh (which also supplies its instance URL); Shopify offline refresh
(which stores expiry metadata in connection `mappingConfig`); the common storage
input-change transaction; durable work invalidation; executive alignment clearing.

## Small correction inside the existing transaction

Only `server/storage.ts` changes runtime behavior. The existing parent lock,
transaction, encrypted credential merge and returned connection shape are retained.
An optional final predicate on the private input-change helper distinguishes
credential-only writes **after** their locked connection read/write. All existing
callers without that predicate retain their exact previous invalidation behavior.
Public storage signatures, API contracts, schemas and scheduler cadence are unchanged.

- GA4's dedicated token method has no source-configuration fields.
- Sheets and HubSpot require a nonempty update containing only token, secret and
  expiry fields. Cache, mapping and identity changes continue to invalidate.
- Salesforce also permits an instance URL only when it equals the current row's
  URL inside the transaction. A different instance invalidates normally.
- Shopify permits token fields and mapping changes restricted to
  `accessTokenExpiresAt`, `refreshTokenExpiresAt` and `tokenUpdatedAt`. The remaining
  parsed configuration must match the current row exactly. Selected values,
  scopes, shop identity, malformed/nonobject mappings and other edits still
  invalidate. No financial mapping is silently treated as a credential field.
- Existing worker lease/connection fences are unchanged. This does not authorize
  a stale worker to overwrite rotated credentials or publish after a source edit.

## Validation and limits

[Current focused result](validation-2026-10-31-remaining/credential-only-after.json):
**257 passed / zero failed / zero skipped**. The 24 added assertions cover the ten
reported cases, five genuine configuration-change controls, the actual Salesforce
renewal handler with unchanged/changed instance URLs, and seven Shopify metadata
and configuration cases. Existing stale-token/lease, rollback, foreign-parent,
source-save, retry and neighboring financial-source controls are included.

The first complete run had one test-fixture failure: its new GA4 deactivation
control needed the real `ga4_overview_snapshots` table, which the fixture had not
created. [Failure retained](validation-2026-10-31-remaining/credential-only-fixture-failure.json).
Adding that schema table to the isolated fixture produced the passing run above;
production behavior was not relaxed. An initial sandboxed test launch was blocked
by process-spawn permissions before tests ran; the authorized local run supplied
the actual before/after evidence.

The full suite runs with CI's two loopback test databases, a sanitized process
environment, blocked external networking and preservation of existing PDF
artifacts. It removes only the notification database it creates. No production
rows, credentials or provider grants were changed to test this correction.

The [first full run](validation-2026-10-31-remaining/renewal-full-suite-fixture-failures.json)
finished with 6,956 passing and three failing tests. Two publication-recovery
fixtures used an expiry-only update to simulate a configuration change. They now
change the OAuth client identity and retain every invalidation, recovery, total
and unrelated-campaign assertion. Credential-only preservation is covered by the
new tests above. The reopened-page browser fixture changed its simulated server
publication before its initial reads settled; the initial financial response
could therefore already contain the newly published amount. It now waits for
those reads before testing the scheduled transition. Both the old-value and
new-value assertions remain, including the intermediate 30-second check. No
application UI, schedule, response or calculation was changed for either fixture.

[Both affected files](validation-2026-10-31-remaining/renewal-affected.json) pass
**138 tests, zero failures/skips**. TypeScript also passes after these test changes.
The four-file runtime/test candidate was committed as `5f0ffe96` and pushed to
`batch1-credential-publication-20261031` for hosted checks in parallel with the
local full-suite rerun. [The rerun](validation-2026-10-31-remaining/renewal-full-suite.json)
passed all 6,959 tests. [Hosted workflow 41212567147](https://github.com/CrazySkillz/MF_real_latest/actions/runs/41212567147)
also passed, including its retained deferred-source step. Main was advanced to
the same `5f0ffe96302aad0abee45c1c23f1a38bb77d2dce` only after both results.
The runner removed its temporary notification database; the isolated local
PostgreSQL cluster was stopped without removing its existing database or files.

The evidence verifier initially decoded PowerShell's UTF-16LE KPI log as UTF-8.
It now detects the byte-order marker for evidence reads and secret scanning.
The original passing log is preserved; no application check was waived or rerun
to conceal a failure. [Candidate verification](validation-2026-10-31-remaining/candidate.json)
checks the test counts, source hashes, all twenty Batch 1 statuses, the 130-finding
queue, relative documentation links and absence of local secret values.

[Post-release read-only comparison](validation-2026-10-31-remaining/post-release.json)
finds identical source values/sync metadata, work rows and snapshots for the exact
test campaign. All five connections retain their identities, active state and
encrypted/no-plaintext flags. Sheets' stored expiry advanced from
`2026-10-31 14:08:00.616` to `2026-10-31 16:13:28.514`. That is consistent with a
natural renewal while publication remained unchanged; no provider exchange was
captured, and no reconnect or other-provider renewal is inferred. The initial
comparison incorrectly expected expiry to stay fixed; its
[recorded failure and correction](validation-2026-10-31-remaining/post-release-initial-comparison.json)
separate this exact expiry advancement from the unchanged financial evidence.

Not proven by local tests: an actual renewed credential/reconnect on the deployed
release, all deferred providers' credential behavior, remote key recovery, or
whole-app production readiness. Existing unrelated source lifecycle/analytics
gates remain as recorded in the consolidated ledger.
