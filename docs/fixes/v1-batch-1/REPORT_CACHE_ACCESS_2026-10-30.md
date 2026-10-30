# Reports cache access: October 30 follow-up

**Deployed as `7e413779`; full local checks pass. The hosted failure is reproduced
as a browser-test timing defect; the test-only correction passes locally, with
hosted revalidation pending below.**
Batch 1 and V1-052 remain OPEN. No production occurrence is claimed. The separately completed
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
check concerns the earlier deployed sign-in boundary; it does not validate the
subsequently published Reports correction. Other browser-history/cache modes,
remaining persistent/module state and real signed-in report acceptance
are not certified by this packet. Finding counts remain
116 OPEN / 10 DEFERRED / 4 CLOSED.

## Publication and full-suite follow-up

- Commit `7e413779680901598e07f5ddf84990a78fde0115` was pushed to `origin/main`.
  [Deployed verification](validation-2026-10-30/report-cache-deployed.json) confirms
  that exact healthy production revision and three anonymous GET denials.
- [Public client verification](validation-2026-10-30/report-cache-client.json)
  matches the deployed Reports JavaScript to the locally tested build after
  normalizing only hashed JS/CSS asset filenames. No browser session was used.
- GitHub [run 41063705622](https://github.com/CrazySkillz/MF_real_latest/actions/runs/41063705622/job/124089580772)
  failed at `Run npm run test:current-version`; setup and certification passed.
  Its deferred-source step was skipped. [Failure receipt](validation-2026-10-30/report-cache-hosted-failed.json)
  preserves this result; exact failed-test identities remain unknown. The public
  log API requires authentication. Automatic approval review rejected an attempt
  to obtain the log using a locally stored GitHub credential before execution;
  no credential was read. The user was asked for the Failed Tests section and,
  after reporting confusion, which screen the linked GitHub page shows.
- The [complete isolated local reproduction](validation-2026-10-30/report-cache-full-local.json)
  finished at 13:58 UTC: **396 files, 6,870 tests passed, zero failures**.
  The actual current-version command exited zero; no blocking, deferred or
  unhandled failure was waived. Both loopback PostgreSQL fixture databases
  started and ended empty, all fixture connections closed, the cluster stopped,
  and tracked-file hashes remained unchanged during the run. Production
  credentials were excluded and external Node networking blocked by the existing
  runner. [Final test output](validation-2026-10-30/report-cache-full-local.log)
  is retained with full-log and execution-receipt hashes in the summary.

The initial local pass did not explain or supersede the failed hosted run.
The subsequent user-provided error and targeted reproduction below establish
its cause. No application correction, test removal or readiness closure was made.

## October 30 hosted-test timing correction

The user supplied the [failure detail](validation-2026-10-30/report-timing-hosted-failure-detail.json):
`server/ga4-ad-comparison-download-browser.test.ts`, the `published-sources`
scenario, expected `Generate & Download Report` to be disabled but found it enabled
with `aria-busy="false"`. No downloads, page errors or refresh errors occurred;
three financial snapshot requests had been made. This locates the failure before
the first download, in the initial pending-state assertion.

This fixture mounts `client/src/pages/ga4-metrics.tsx`, not the campaign Reports
page changed in `7e413779`. Neither that GA4 page nor this fixture changed in that
commit. Its simulated replacement financial reads used a fixed 900 ms delay.
Waiting for three requests only proves those requests started; it does not prove
they remain pending after navigation and opening the report modal. If they finish
first, the actual page correctly clears `ga4PublicationDisplayPending` and enables
the button. The test then incorrectly demands a transient state that already ended.

A temporary copy of the unchanged test inserted a 1,500 ms delay immediately
after the three-request checkpoint. The [before result](validation-2026-10-30/report-timing-before.json)
reproduces the identical enabled-button failure, with no query errors or downloads.
The copy was removed without changing the original. Repeating that same diagnostic
delay after correction [passes](validation-2026-10-30/report-timing-after.json):
the button is disabled until explicit response release, then the existing full
download/failure/recovery journey completes. Each probe selects one scenario and
intentionally skips the other eleven; these are not twelve-scenario pass claims.

Only `server/ga4-ad-comparison-download-browser.test.ts` changes: five added and
three removed lines. The published-source case reuses the existing financial
response promise, allows its first snapshot through, holds replacement reads
through the disabled/no-download assertions, then releases them and checks that
the button becomes enabled. The earlier 300/600 ms source/status ordering remains
to exercise overlapping reads. The original `finally` releases pending promises
on failure. The separate background-read scenario retains its original behavior.
No assertion is removed; no automatic retry or test exclusion is added.

The [complete focused packet](validation-2026-10-30/report-timing-regressions.json)
passes **86/86 checks in two files, zero failed/skipped**: all twelve browser
download scenarios plus the 74 neighboring publication checks. The intentionally
delayed probe is separate and is not added to that non-overlapping total.
[TypeScript](validation-2026-10-30/report-timing-typecheck.log) also passes.
The [validation receipt](validation-2026-10-30/report-timing-validation.json)
records the source hashes and reproduction boundary. Hosted CI is pending. No app
runtime, API, data, scheduler, provider or PDF calculation changes are included.
Batch 1 and V1-052 remain open for their separate remaining acceptance.
