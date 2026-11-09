# Spend publication follow-up and recovery timing

Scope: the two failures observed during PR #11 live acceptance. This is not a new analytics certification.

- Total Spend saved EUR 4.89 correctly, but publication completed after the browser's two-minute fast follow-up expired. Extend only the existing just-saved, campaign/property-scoped follow-up to the pipeline's 15-minute deadline. It still follows only running/delayed work, stops fast checks after publication, retains last-good displayed values, and respects background-tab and failed-query behavior.
- Durable recovery set the process busy flag without updating the start timestamp used by the health monitor. Record the batch start at that same boundary. Preserve the existing failure flags, alert criteria, completion evidence, schedule, and ownership checks.
- Application paths changed: `AddSpendWizardModal.onProcessed` in `client/src/pages/ga4-metrics.tsx`; batch entry in `recoverInterruptedGA4Refreshes` in `server/ga4-daily-scheduler.ts`.
- No formulas, aggregation, import data, credentials, schema, mappings, or source-selection behavior changed. No damaged-data cleanup is needed: the observed saved and displayed amount matched Google Ads.

Validation: both browser fixture variants reproduced stale Spend after a 125-second publication delay before the fix. Both recovery timing cases also failed before the fix. The five focused files passed 370 tests; after narrowing the scheduler edit to the timestamp only, the affected recovery and monitor files passed 286 tests. Coverage includes publication retention, actual page/query cache, legacy snapshots, missing versus zero spend, failed reads, scope isolation, recovery ownership, genuine recorded failures, and overdue-run detection. Provider/database boundaries in local tests are synthetic.

Hosted acceptance and release evidence must be recorded separately after deployment. These checks do not certify unrelated report/source lifecycle paths or prove the next natural scheduled run.
