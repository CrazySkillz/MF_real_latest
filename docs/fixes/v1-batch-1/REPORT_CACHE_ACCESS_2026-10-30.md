# Reports cache access: October 30 follow-up

**Locally corrected and validated; prepared for publication, not deployed.** Batch 1 and
V1-052 remain OPEN. No production occurrence is claimed. The separately completed
[campaign edit rejection check](CAMPAIGN_EDIT_ACCESS_2026-10-30.md) remains passed
within its stated local and user-reported boundaries.

## Root cause and exact route

Campaign Overview's Campaign Diagnostics launcher opens
`/reports?campaignId=:id`. `client/src/pages/reports.tsx` reads that URL parameter,
fetches the campaign through the guarded `GET /api/campaigns/:id`, and separately
loads saved report metadata from `reportStorage`'s `marketpulse_reports` browser
storage. The local reader and visible-list filter previously trusted the URL
campaign ID before the campaign-access request succeeded.

Consequently, a different signed-in user on the same browser who can reach the
Reports route could see locally saved report names, campaign metadata and saved
schedule/recipient details by reopening the first user's report URL, even when
the campaign API rejected access. This is a browser-cache boundary; it does not
show that the server returned another owner's reports. The user's empty second
account normally encounters WelcomeGate and does not establish this other case.

## Localized correction

Only five added/four removed runtime lines in `client/src/pages/reports.tsx`:

- Require the existing campaign response's ID to match the URL campaign ID
  before loading browser-saved reports.
- Re-evaluate the loading effect when that access result changes.
- Apply the same condition when rendering local reports, so previously loaded
  component state cannot appear before the effect clears it.

The existing account-specific QueryClient and keyed app subtree remain unchanged.
They prevent a prior actor's successful campaign response from being reused by
the next actor. `App`, `clientContext` and query defaults were compared with their
October 20 versions: their account-boundary logic is unchanged. Prior isolated
[Chromium checks](browser-after.json) and current query-library checks remain
bounded fixture evidence, not deployed Clerk transition proof.

The local-storage format, stored records, server routes, ownership rules,
report generation, scheduling, email delivery and analytics calculations are
unchanged. No local or production saved report is deleted or migrated. This
prevents ordinary application display; it does not encrypt or erase records
available to someone inspecting the same browser's raw storage.

## Validation

- New `server/v1-report-cache-access.test.ts` executes the actual component
  loading effect/final local-list filter and actual report-storage reader with
  synthetic storage. [Before correction](validation-2026-10-30/report-cache-before.json):
  four failing isolation cases, three passing neighboring cases.
- [After correction](validation-2026-10-30/report-cache-after.json): all seven
  cases pass; 170/170 total across five access, cache, configuration and report
  regression files, zero failed/skipped. Cases cover missing/loading/denied and
  mismatched campaign responses, no URL context, retained component rows,
  permitted reports for each campaign, storage events, listener cleanup and no
  storage writes.
- One existing source assertion in `server/custom-report-regression.test.ts`
  now expects the access gate; its other report checks are retained.
- [TypeScript](validation-2026-10-30/report-cache-typecheck.log) and
  [client/server build](validation-2026-10-30/report-cache-build.log) pass.
  The build retains its normal import/chunk warnings. PowerShell records
  esbuild's stderr output as NativeCommandError text, but both builds completed
  and the command returned exit zero.

These tests do not mount the complete Reports page or independently operate
Clerk. No live campaign, account session, provider, email or database was used.
The user [confirmed all three ordinary sign-out/account-switch outcomes](validation-2026-10-30/user-signout-access.json):
Promo stayed hidden after signing out and pressing Back, the second account saw
neither the original clients nor Promo, and the owner could reopen Promo after
signing back in. Screens and sessions were not independently observed. This
check concerns the already deployed sign-in boundary; it does not validate the
separately unpublished Reports correction. Other browser-history/cache modes,
remaining persistent/module state, real signed-in report acceptance and deployment
of this correction are not certified by this packet. Finding counts remain
116 OPEN / 10 DEFERRED / 4 CLOSED.
