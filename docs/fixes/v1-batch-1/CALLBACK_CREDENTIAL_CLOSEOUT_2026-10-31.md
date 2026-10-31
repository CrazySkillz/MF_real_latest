# Callback and credential close-out evidence, October 31

This packet adds a reproduced callback correction and credential lifecycle
evidence to the existing Batch 1 acceptance record. It does not waive the four
remaining external acceptance boundaries or certify the whole application.

## Reproduced callback defect and minimal correction

The LinkedIn and Meta OAuth callbacks call `ensureCampaignAccess`. For a missing
session or foreign campaign, that helper sends the 401/404 JSON response and
returns `null`. Each callback then tried to send its own HTML denial; its catch
block tried another response. Real Express HTTP execution reproduced
`ERR_HTTP_HEADERS_SENT` in all four denial cases. Existing mock-response tests
did not reproduce the native response object's already-sent state.

The only runtime changes are two `if (res.headersSent) return;` guards in
`server/routes-oauth.ts`, immediately after the access helper. The first denial
response remains authoritative. Successful callbacks and the fallback branch for
an access helper returning without a response retain their existing behavior.
No schema, credential, provider permission, campaign, calculation, publication,
refresh schedule or report-delivery change is included.

`server/v1-batch1-oauth-callback-lifecycle.test.ts` executes the exact current
callbacks, signing helpers, campaign-access helper and retry helper over real
loopback HTTP. Controlled synthetic provider transport and connection storage
cover both providers' owner success, foreign/signed-out denial, missing signing
key, tampered state, fresh-code reconnect and rejection of a consumed code.

- [Before correction](validation-2026-10-31-closeout/before.json): 12 cases,
  4 reproduced denial failures, 8 passes.
- [Focused validation](validation-2026-10-31-closeout/focused.json): 138 tests
  pass, including all 12 new HTTP cases and existing access, security configuration,
  HubSpot/Salesforce rotation and Shopify renewal regressions.
- [Typecheck exit](validation-2026-10-31-closeout/typecheck-exit.json): passes.
  Client/server builds and the KPI gate also pass. The complete suite passes
  6,971 tests in 400 files, with zero failures or skips; see the
  [validation summary](validation-2026-10-31-closeout/validation-summary.json).

The consumed-code response is a controlled provider contract, not a captured
real-provider exchange. It proves the application's error propagation and lack
of additional connection writes. It does not prove real-provider replay
acceptance or make signed states single-use. The reconnect case likewise proves
the callback's application behavior, not a real provider grant rotation.

## Ten credential readers: replacement, deletion and process restart

[The isolated PostgreSQL procedure](validation-2026-10-31-closeout/credential-lifecycle.cjs)
executes the actual ten affected getter bodies and token vault against real
PostgreSQL, using current schema column definitions and synthetic credentials.
For every getter it checks:

- ordinary legacy encryption clears its supported plaintext fields;
- an intervening encrypted renewal is not overwritten;
- an intervening plaintext change prevents stale migration, then migrates on
  the next read;
- an intervening deletion is not undone;
- delete/reinsert replacement under a new row ID survives the stale reader.

Every case checks the foreign connection and all noncredential fields. A separate
Node process then reads and decrypts each retained replacement after the writer
process has exited. [All 60 checks pass](validation-2026-10-31-closeout/credential-lifecycle.json),
and the exact temporary schema is removed and its absence checked. No production
database, real credential, provider client or `.env` is loaded.

The [first fixture attempt](validation-2026-10-31-closeout/credential-lifecycle-fixture-failure.json)
incorrectly expected three migrated token fields for every provider. Shopify's
legacy path only migrates its access token; Meta migrates access/refresh tokens.
The fixture was corrected to the actual contracts. Application code was not
changed to satisfy this test. Its failed receipt is retained.

This establishes persisted migration safety across those replacement/deletion
interleavings and a fresh local process. It does not certify a Render restart,
real provider reconnect, independent recovery, or every provider analytics path.

## Acceptance limits retained

The existing deployed OAuth/import, permission, account isolation, renewal,
historical cleanup and publication receipts remain valid within their recorded
scope; no completed user test or cleanup was repeated.

| Finding | Boundary that this packet does not complete |
| --- | --- |
| V1-008 | Independent saved-key recovery, already owned by Batch 8 V1-016. Do not repeat the postponed key prompt. |
| V1-054 | Positive deployed legacy Meta updates: both obsolete tables are absent. No production schema was created to manufacture a positive result. |
| V1-078 | Real valid authorization-code replay acceptance. Synthetic consumed-code rejection and session denial are explicitly different evidence. |
| V1-088 | Real reconnect and remaining provider-specific renewal/hosted restart acceptance. Shared Shopify authorization must not be rotated as though its scope were only the disposable app campaign. |

The current count remains **16 CLOSED / 4 OPEN**. Local evidence is not converted
into external acceptance. No further manual Console or saved-key instruction is
requested by this packet.

## Release verification

The runtime correction and regression test are committed and pushed as
`357e950fcf03d02c93465cd602eda119f08cf7f6`, independently confirmed on remote main.
The [full-suite receipt](validation-2026-10-31-closeout/full-suite.json) records
exit zero and removal of its temporary notification database. The isolated
PostgreSQL cluster started for this validation was then stopped successfully.
[Hosted workflow 41221686468](https://github.com/CrazySkillz/MF_real_latest/actions/runs/41221686468)
completed successfully, including the current-version suite, KPI gate and retained
deferred-source checks. [Independent release observation](validation-2026-10-31-closeout/release-2026-10-31T17-02-04-759Z.json)
confirms the successful hosted job and healthy Render runtime at the exact commit.
Render first reported that revision healthy at 16:55 UTC and remained healthy
in subsequent observations. These are public health/revision checks, not a new
authenticated provider or user-browser acceptance session.
