# Campaign edit access: October 30 checkpoint

**Status: locally verified; signed-in rejection results confirmed by the user.** No new defect was
reproduced in the bounded edit checks below. Application runtime, schema,
connections, schedules and production data were not changed. Only regression
coverage and validation records were added. Batch 1 remains open.

## Current journey and exact boundary

All Campaigns -> card pencil -> Save Changes in `client/src/pages/campaigns.tsx`
sends `PATCH /api/campaigns/:id`. The registered route in
`server/routes-oauth.ts` calls `ensureCampaignAccess` before edit validation or
storage. That helper obtains the Clerk actor, reads the stored campaign and
returns 401 for no actor or 404 for a missing, unowned or foreign campaign.
The internal-refresh exception requires the process-random token and a loopback
connection; a caller-supplied fake header does not authorize the request.

The edit route checks a supplied client ID against the actor's clients, validates
with `insertCampaignSchema.partial()`, and removes any supplied owner ID. The
schema excludes record IDs. A permitted same-owner client move remains supported.
Changing GA4 currency/filter/timezone uses the existing daily invalidation writer;
an ordinary rename uses `storage.updateCampaign`. Neither writer changed here.

The existing storage rename branch locks the campaign, compares the resubmitted
fields and preserves publication work for name-only changes. The prior
PostgreSQL tests in `ga4-refresh-input-invalidation-postgres.test.ts` cover full-form
renames, active workers, real input changes and deletion races. Those tests and
storage are unchanged from the passing deployed-commit CI; no new PostgreSQL run
or independent financial reconciliation is claimed in this packet.

## Local HTTP matrix

The new `server/v1-campaign-edit-access.test.ts` registers the real Express routes
on loopback with synthetic Clerk actors and storage. The six tested paths are:

| Path | Anonymous/foreign actor | Owned edit |
|---|---|---|
| Campaign PATCH | 401/404 before writes, even with forged identities | Allowed; owner and record identity preserved |
| Retained LinkedIn connection PATCH | 401/404 before writes | Allowed; campaign and record identity preserved |
| Retained legacy Meta KPI PATCH | 401/404 before writes | Allowed; campaign and record identity preserved |
| Shared Meta KPI PATCH | 401/404 before writes | Allowed; campaign and record identity preserved |
| Retained legacy Meta Benchmark PATCH | 401/404 before writes | Allowed; campaign and record identity preserved |
| Shared Benchmark PATCH | 401/404 before writes | Allowed; campaign and record identity preserved |

Additional cases cover foreign-client rejection, same-owner client moves,
missing/unowned campaigns, the forged internal header, and the deliberately
invalid manual-check payload for owner/foreign/anonymous actors. The retained
Meta/LinkedIn paths are access checks only; their deferred provider functionality
is not enabled or certified. This is not every update/delete route in the app.

## Evidence and live handoff

- [Validation summary and hashes](validation-2026-10-30/campaign-edit-access-validation.json):
  26 new HTTP cases plus 100 existing access/initial-import checks pass, 126 total,
  zero failed/skipped; TypeScript passes. Source comparison against deployed
  `02bb9ad2` shows no runtime difference.
- Command: `npx --no-install vitest run server/v1-campaign-edit-access.test.ts server/v1-batch1-access-regression.test.ts server/ga4-initial-import-route.test.ts`.
  `DATABASE_URL` was empty. No provider or live session was used.
- [Deployed anonymous check](validation-2026-10-30/campaign-edit-anonymous.json):
  exact commit and healthy production response, then 401 for the invalid-name
  campaign PATCH. This does not establish a signed-in actor's edit permissions.
- [Manual command](validation-2026-10-30/manual-campaign-edit-check.js) was run
  with the user's two logins. Its object-valued name cannot pass the tested schema.
  The user explicitly [confirmed both expected results](validation-2026-10-30/user-campaign-edit-access.json):
  owner 400 `Invalid campaign data`; second account 404 `Campaign not found`.
  No valid edit was requested. These authenticated results are user-reported;
  session identities and responses were not independently observed. Valid live
  edit success and the retained child-update routes are not certified by this probe.

The user previously declined browser automation and chose manual steps. No access
to their browser, credentials or session was attempted. Prior completed read/list
checks remain recorded separately and need not be repeated. V1-054's retained
child-update acceptance, other account/session paths and the remaining Batch 1
requirements stay open; finding counts are unchanged.
