# GA4 live release — November 5, 2026

## Current result

The user-authorized three-fix release is live at https://app.mimosaas.app.
There is no remaining deployment task for these three corrections.

| Correction | Live status |
| --- | --- |
| ROAS decimal display rounding, including the existing Overview PDF renderers | Deployed |
| Startup discovery recognizing a newer successful publication instead of requesting superseded work | Deployed; production restart preserved the checked publications |
| 08:00, 14:00 and 20:00 scheduling/freshness in each campaign's saved timezone | Deployed; next observed Amsterdam slot is 20:00 |

[PR 3](https://github.com/CrazySkillz/MF_real_latest/pull/3) merged as
`706a7bacb04cf1b7802ab4279c6f1f6935337d29`. Render automatically deployed it as
`dep-dbm9jhqvcj2c738ag2ig`, live at **16:02:32 Amsterdam** (15:02:32 UTC).
The merge tree exactly matches tested head `ee9a2e6d`; all six changed application
files match the already exercised hosted test revision `5ed8e816`.

## Evidence

- Required PR validation and final merged-revision validation both passed:
  **7,409 tests in 417 files, zero failed/skipped**, TypeScript, production build
  and the certification check. Final run:
  [42049134027](https://github.com/CrazySkillz/MF_real_latest/actions/runs/42049134027).
  The separately selected deferred step passed its 45 selected tests; its 166
  filtered tests are not skips in the full 7,409-test run.
- GitHub's required check/admin protection and Render `checksPass` remained in
  force. Production was deployed automatically once, with no manual bypass.
- TLS-verified `REPEATABLE READ READ ONLY` database comparisons found identical
  hashes in **27 data sets**: nine tables for each of the three configured live
  campaigns (`b85505d40a0a`, `de4775c3b435`, `156b23ba019e`). These include saved
  campaign settings, daily metrics, Overview, metric snapshots, revenue/spend
  sources and records, and refresh work. Daily rows and totals were unchanged.
- All **51** production environment values and the service configuration matched
  their before-deploy fingerprints. No schema, storage, dependency, migration,
  provider mapping or production environment change was included.
- Live health reports the exact released commit. Scheduler startup restored the
  three actual 14:00 completion records through November 4. It reports zero
  bootstrap runs, no new error, and next run `2026-11-05T19:00:00Z` (20:00 Amsterdam).
- An isolated browser loaded the production sign-in page with HTTP 200 and no
  page errors. The served GA4 asset `ga4-metrics-lJv4ldlM.js` contains the corrected
  ROAS formatter. No authenticated user session was exercised in this release.
- Existing monitor `crn-dbm6oql6e07s73bar4eg` now uses revision `f7da1179`, deploy
  `dep-dbm9lpajnfac738r8sug`, with the new live commit as its expected revision.
  Its program, dependencies, ten-minute schedule, monitored campaigns and failure
  email configuration are unchanged. Verification run
  `crn-dbm6oql6e07s73bar4eg-1793891146` reported **passed** for both live and test at
  15:06:39 UTC; Render recorded the run as successful at 15:06:51 UTC. The prior user-confirmed failure-email receipt remains the email
  delivery evidence; no extra intentional failure/email was generated.
- The hosted test app remains on `5ed8e816`, healthy. Its natural 14:00 Amsterdam
  completion and restart-preservation evidence remain valid for this identical
  application runtime.

## Boundaries and remaining issues

The five historical campaigns with missing clients/Google credentials were
subsequently deleted at the user's explicit request, after backup and a verified
restore/deletion rehearsal. See the
[cleanup record](obsolete-campaign-cleanup-2026-11-05.md). The other 32 campaigns
remain, the three monitored campaigns' checked values are unchanged, and live
health is healthy/idle. No application deployment was needed for that cleanup.
The monitor continues to report future recorded failures.

The first natural post-release production slot is 20:00 Amsterdam; it has not
occurred at this verification. Automated tests cover other timezones and DST;
actual multi-zone production execution, new authenticated report downloads,
provider reconciliation and whole-platform recertification were not performed.
This release preserves the scope of prior evidence and does not guarantee every
future provider value. No client data was rewritten by verification scripts.

Previous compatible application artifact: `dep-dblgd8tbedkc73a9i4ig`, commit
`9744d9a6`. Recheck its retention/configuration compatibility before any incident
rollback. No rollback or restore was executed.

Local receipts are in `.local-test/live-release.json`, `live-before.json`,
`live-after.json`, `live-browser.json`, `render-release-state.json` and the
downloaded CI job logs. Environment receipts contain fingerprints, not secrets.

Root causes and exact paths remain in the
[timezone/rounding correction record](ga4-campaign-timezone-schedule-2026-11-05.md)
and [restart recovery record](ga4-restart-recovery-2026-11-05.md).
