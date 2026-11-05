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
| Automatic operational monitoring | Read-only checker prepared and tested. No recurring monitor or alert delivery has been activated yet. | Approve the additional Render monitor cost, enable failure notifications, and verify a controlled alert. |
| Automated release checks | Existing calculation and lifecycle tests retained; TypeScript and application build checks added to the test workflow. | Verify the GitHub run for the exact proposed release. |
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

The proposed Render monitor runs every ten minutes (`*/10 * * * *`, UTC). It makes only two anonymous GET requests: `/api/health` and `/health/scheduler`. It receives no database or provider credentials and never starts a refresh or changes data.

It checks the deployed revision, response freshness, recorded job failures, stopped/overdue timers, unexpectedly changed refresh hours, long-running jobs and completion evidence for the explicitly configured test campaign. Campaign-local slots use the existing timezone utility. A 20-minute completion allowance accommodates the existing 15-minute attempt deadline and scheduling overhead. The monitoring interval adds up to ten minutes before detection, plus any platform execution delay.

`passed` means the configured operational checks passed. `pending` means a refresh is running within its allowance. `failed` exits with code 1. Missing cached completion evidence is reported as **unconfirmed**, not proof that data was lost. The current health endpoint exposes process-local completion observations; persistence and provider reconciliation remain separate checks.

The config currently covers one test campaign in Europe/Amsterdam. Add/remove campaign hashes and their actual saved timezones when the monitored campaign set changes, and update the expected commit when an approved app revision is deployed. This is not automatic discovery of every client. A monitor hosted on Render also does not independently detect a complete Render outage.

Render bills cron jobs by active execution time, with a **$1 monthly minimum per job**, excluding tax and other usage. Failed runs can generate email notifications when the service/workspace notification destination and failure settings are enabled. Configuration and actual alert receipt must both be verified before calling alerts active. [Cron billing](https://render.com/docs/cronjobs), [notification settings](https://render.com/docs/notifications).

## Remaining acceptance boundaries

- The first scheduled completion on the hosted test revision is pending.
- Recurring monitoring, notification receipt and independent external uptime monitoring are pending.
- Browser error reporting, continuous provider-versus-app reconciliation and performance thresholds are not installed by this change.
- Minimum backup recovery evidence is historical; independent-machine recovery and a current production point-in-time restore drill are not newly proven.
- The current release is GA4-first. Broader platform and section certification remains governed by the existing readiness matrices; this checklist does not replace them.

The [scheduler correction record](fixes/ga4-campaign-timezone-schedule-2026-11-05.md) contains the three-fix release boundary and detailed test evidence. The [GA4 development workflow](../GA4_DEVELOPMENT_WORKFLOW.md) remains the engineering reference.
