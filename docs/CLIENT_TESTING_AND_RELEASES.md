# Client testing and releases

Use the hosted test app to check changes before releasing the same reviewed code to clients.

- Test app: https://marketforensics-test.onrender.com
- Live app: https://marketforensics.onrender.com
- Test branch: `test/hosted-20261105`; automatic app deployment is off.

## Current work

Status on November 5, 2026:

| Task | Status | Next action |
| --- | --- | --- |
| Automatic database backups | Production Render screen confirms a 3-day recovery window. Historical backup restoration and saved encryption-key recovery have separate evidence. | Retain those records; a database backup and its encryption key are both needed for recovery. |
| Hosted test app and separate database | Deployed. All 65 restored tables matched; all 65 remained unchanged across the hosted restart check. | Use the online test app; the laptop can be off. |
| ROAS rounding, restart recovery, campaign timezone scheduling | Deployed to test revision `5ed8e816adfed6e7174c9687a0c9e18df01bb34d`. Not released to the live app. | Verify the natural 14:00 Amsterdam refresh, then review the exact live release. |
| Automatic operational monitoring | Active on Render every ten minutes for the hosted test app. First scheduled check passed. Controlled failure email received by the user; normal command and schedule restored. | Maintain the explicit campaign/revision configuration when an approved test deployment changes. |
| Automated release checks — item 1 COMPLETE | Five outdated assertions corrected. CSV upload-test timing failure reproduced and corrected in the test only. Full GitHub run on `2e250e0c`: 7,399 current-release tests passed, zero failed/skipped; TypeScript and build passed. | Continue with item 2: verify the hosted 14:00 Amsterdam refresh. |
| Numerical accuracy | Existing section/source evidence and regression tests remain the starting point. An uptime check cannot establish metric accuracy. | For each change, compare the affected values and downstream reports against their source using identical scope, dates, timezone, currency and definitions. |

## Workflow after client feedback

1. Record the page, client/campaign, selected dates, expected result and actual result. Attach a screenshot or report if useful; do not include passwords or provider tokens.
2. Reproduce the problem in the test app. Use synthetic fixtures for automated edge cases and the separately connected test campaign for provider checks. Never point automated mutation tests at the live database.
3. Make one scoped correction. Run the relevant calculation, source-lifecycle and downstream tests, plus TypeScript and build checks. Add a regression test for a confirmed analytics defect.
4. Deploy the reviewed revision to the test app. Confirm the original problem is fixed and neighboring values still agree with the same source scope and reporting period.
5. After acceptance, release only that reviewed change set to the live app. Record its commit, check the affected page and source values, and confirm refresh health. Keep the compatible previous release available for recovery.

A passing GitHub run is a release requirement, not automatic permission to publish. Branch protection and a mandatory deployment gate have not been verified or configured by this work.

If validation fails, hold the release and investigate. Do not overwrite client data to make a test pass. A code rollback and a database restore are different recovery actions; follow the existing [recovery procedure](fixes/v1-batch-8/MINIMUM_RECOVERY_2026-11-01.md) before either.

## Monitor configuration

Run the checker manually with:

```text
node --import tsx scripts/check-hosted-health.ts scripts/hosted-test-monitor.json
```

The [Render monitor](https://dashboard.render.com/cron/crn-dbm6oql6e07s73bar4eg) runs every ten minutes (`*/10 * * * *`, UTC), independently of the laptop. It makes only two anonymous GET requests: `/api/health` and `/health/scheduler`. It receives no database or provider credentials and never starts a refresh or changes data. Its source revision is `0fafdbc53eeac0a67f411b1b1891020139c81a01`; the web app remains on `5ed8e816adfed6e7174c9687a0c9e18df01bb34d`. Automatic deployment is off for both services.

It checks the deployed revision, response freshness, recorded job failures, stopped/overdue timers, unexpectedly changed refresh hours, long-running jobs and completion evidence for the explicitly configured test campaign. Campaign-local slots use the existing timezone utility. A 20-minute completion allowance accommodates the existing 15-minute attempt deadline and scheduling overhead. The monitoring interval adds up to ten minutes before detection, plus any platform execution delay.

`passed` means the configured operational checks passed. `pending` means a refresh is running within its allowance. `failed` exits with code 1. Missing cached completion evidence is reported as **unconfirmed**, not proof that data was lost. The current health endpoint exposes process-local completion observations; persistence and provider reconciliation remain separate checks.

The config currently covers one test campaign in Europe/Amsterdam. Add/remove campaign hashes and their actual saved timezones when the monitored campaign set changes, and update the expected commit when an approved app revision is deployed. This is not automatic discovery of every client. A monitor hosted on Render also does not independently detect a complete Render outage.

Render bills cron jobs by active execution time, with a **$1 monthly minimum per job**, excluding tax and other usage. Failed runs can generate email notifications when the service/workspace notification destination and failure settings are enabled. Configuration and actual alert receipt must both be verified before calling alerts active. [Cron billing](https://render.com/docs/cronjobs), [notification settings](https://render.com/docs/notifications).

Activation evidence on November 5: the 11:50 UTC scheduled run passed at 11:51:21 UTC. The labelled `MONITOR_ALERT_TEST` run failed intentionally at 11:57:17 UTC; the normal command and ten-minute schedule were restored and read back at 11:57:22 UTC. The user confirmed receiving the Render email. The next normal scheduled check passed at 12:01:26 UTC. Workspace email delivery was already enabled; only this monitor's failure-notification override was changed. No application or database was modified by the alert test. Local validation covered 49 focused tests, the standalone monitor typecheck, application typecheck/build and a read-only hosted check.

## Release check investigation

[GitHub run 42021280068](https://github.com/CrazySkillz/MF_real_latest/actions/runs/42021280068) tested `0fafdbc53eeac0a67f411b1b1891020139c81a01`. TypeScript, build and the KPI certification gate passed. The current-version suite reported 411 passing files and 6 failing files (7,393 passing tests, 6 failing tests). This is a failed release check, not release approval.

- Four source-inspection assertions required the old ROAS `toFixed(2)` expression: `csv-revenue-downstream-propagation`, `ga4-ui-regression`, `google-ads-spend-lifecycle-downstream`, and `google-sheets-revenue-downstream-propagation`. The deployed test correction uses `toLocaleString` for decimal rounding. Those four assertions now require the intended expression; the actual-output rounding and unavailable-value tests remain unchanged.
- `ga4-scheduler-observability-regression` required the global alert condition without the new `!opts.scheduledWindow` guard. The campaign-timezone correction added that guard; the separate scheduler regression already checks it. This assertion now matches that confirmed guard while retaining the campaign/access and failed-refresh checks.
- `ga4-financial-import-retry-browser` timed out at the disabled **Next** button while reopening a spend CSV import. The timing boundary is now reproduced: reopening mounts an upload input, then the existing open/reset effect changes its key and replaces it. Playwright's direct buffer upload can finish against the detached old input without returning an error. Its change event does not reach the mounted React input, so `csvFile` stays empty and Next remains disabled. The original CI failure did not include a DOM trace; the controlled local reproduction establishes this matching failure mechanism rather than claiming an unavailable recording of that CI event.

The correction changes only the upload interaction in `server/ga4-financial-import-retry-browser.test.ts`: click the labelled, visible **Upload file (CSV)** control and supply the file through its `filechooser` event. The normal click waits for an actionable control and retries detachment; the direct upload did not perform those checks. No fixed sleep, retry waiver, increased test timeout, skipped case or weaker success assertion was added. [Playwright action checks](https://playwright.dev/docs/actionability), [file-picker pattern](https://playwright.dev/docs/input#upload-files).

Exact traced boundary: test reopen -> actual `AddSpendWizardModal` open/reset effect -> `csvInputKey` replacement -> test file selection -> `csvFile` -> Next eligibility -> mocked CSV preview/process endpoints. The negative control successfully wrote one file to a detached element while the live Next button stayed disabled; only the two original/retry process requests existed and their shared request ID represented one saved import. The corrected picker then completed a distinct new import. Revenue and spend browser cases retain checks for lost response, same-ID reload retry, cleared session state, new-ID next import, no duplicate save and no page/external-request errors. This is browser-fixture evidence, not a new production import or storage certification.

Local correction evidence: both original browser cases pass; a forced stale-input negative control reproduces the original disabled-Next symptom; recovery through the corrected picker passes; four complete spend retry sequences pass (two normal and two with 8x browser CPU throttling). The exploratory direct-upload stress probe also encountered a separate 5-second combobox-action timeout under throttling; that artificial short timeout was not used in the retained tests, and is not counted as a CSV Next reproduction. Receipts remain in `.local-test/csv-retry-fixed-tests.json`, `csv-retry-probe-race.json`, `csv-retry-probe-race-recover.json`, and `csv-retry-probe-chooser.json`.

Before the CSV test correction, [run 42024047152](https://github.com/CrazySkillz/MF_real_latest/actions/runs/42024047152) passed on `d12cb9b4`; the CSV case itself was unchanged in that run, demonstrating that the failure was intermittent. Final full validation for the test-only correction **passed** in [run 42027034703](https://github.com/CrazySkillz/MF_real_latest/actions/runs/42027034703), revision `2e250e0c9e54795c22d79942a8855bbc05baa1c7`: **7,399 tests in 417 files, zero failed/skipped**, TypeScript, application build and the KPI certification gate. The separate non-blocking deferred-source step reported 52 passed / 171 skipped under its existing scope rules; no new exclusion was introduced. The current-release suite finished at 13:32:58 Amsterdam on November 5. This closes item 1; it does not replace the pending natural scheduled-refresh check or certify untested provider configurations.

Validation after the five one-line test corrections: 451 tests passed, zero failed or skipped, across the five corrected files plus the actual-output ROAS, scheduler, refresh-pipeline and monitor tests. No app runtime code changed. The full GitHub suite must pass on the proposed release revision; this targeted run does not replace that requirement.

No tests were removed, skipped or relaxed to conceal these failures. The production app was not deployed or changed.

## Remaining acceptance boundaries

- The first scheduled completion on the hosted test revision is pending.
- Recurring test-app monitoring and notification receipt are verified. Production monitoring and independent external uptime monitoring remain outside this activation.
- Item 1 is complete: the reproduced CSV test timing failure is corrected and full current-release CI passed. No application runtime change or deployment was needed for this test-only correction.
- Browser error reporting, continuous provider-versus-app reconciliation and performance thresholds are not installed by this change.
- Minimum backup recovery evidence is historical; independent-machine recovery and a current production point-in-time restore drill are not newly proven.
- The current release is GA4-first. Broader platform and section certification remains governed by the existing readiness matrices; this checklist does not replace them.

The [scheduler correction record](fixes/ga4-campaign-timezone-schedule-2026-11-05.md) contains the three-fix release boundary and detailed test evidence. The [GA4 development workflow](../GA4_DEVELOPMENT_WORKFLOW.md) remains the engineering reference.
