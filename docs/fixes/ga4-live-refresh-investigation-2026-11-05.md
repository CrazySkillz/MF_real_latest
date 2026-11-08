# GA4 live refresh investigation — November 5, 2026

## Subsequent resolution

The investigation below is historical. The three application corrections are
[deployed](ga4-live-release-2026-11-05.md). At the user's explicit request, the
five named obsolete campaigns were [backed up and deleted](obsolete-campaign-cleanup-2026-11-05.md)
on November 5 at 17:21 Amsterdam. Their linked records are absent, five deletion
audit events are retained, and unrelated campaigns are preserved. The old
pending/deletion-restriction wording below records the earlier investigation;
it does not describe the current disposition.

## Finding

At deployed revision `9744d9a6df2c319890c0a9ebd596ce7400aad67c`, the global
20:00 Europe/Amsterdam refresh on November 4 reported failure. This does not
mean every campaign failed. The three active GA4 campaigns with existing,
matching-owner clients completed their work independently. Five other active
campaigns have missing clients and no saved Google credentials; their current
configuration reproduces five `daily_series:TOKEN_EXPIRED` failures before any
Google request or daily-metric replacement.

This is the same configuration pattern already recorded under “Global scheduler
warning: bounded disposition” in
[the November 1 launch assessment](v1-batch-8/LAUNCH_ACCEPTANCE_2026-11-01.md).
It is not evidence that the separate local `GA4_REFRESH_WORK_OWNERSHIP_LOST`
restart failure occurred on production.

## Current production evidence

TLS-verified database SELECTs ran inside an enforced `REPEATABLE READ READ ONLY`
transaction, against the previously recorded production-target fingerprint.
No application storage getters, provider requests, forced refreshes, credential
renewals, deployment or production mutations were invoked by this investigation.

| Current campaign | Campaign hash | November 4 20:00 slot completed, Amsterdam | Saved data through |
| --- | --- | --- | --- |
| Promo | `b85505d40a0a` | 20:07:02 | 2026-11-03 |
| V1 Batch 5 Test | `de4775c3b435` | 20:07:26 | 2026-11-03 |
| Batch 1 Provider Check | `156b23ba019e` | 20:10:10 | 2026-11-03 |

All three also have completed work for the November 4 08:00 and 14:00 slots:
nine completed work rows, one attempt per row, no recorded error. Their latest
Overview/daily rows match the November 3 completed-day boundary. The live
health endpoint independently contains all three 20:00 aligned-completion
markers. These are execution/publication facts, not a new numerical or
whole-section accuracy certification.

| Historical active candidate | Campaign hash | Existing client | Saved access/refresh/encrypted credentials |
| --- | --- | --- | --- |
| ga4_brand | `213c38df8cc3` | None | None |
| ga_rev | `415fc7116099` | None | None |
| new_brand | `0e71b0d33b9f` | None | None |
| testeds | `64d466c2b5e9` | None | None |
| yesy | `7190ba435657` | None | None |

These five records date from January–February 2026. Each has an active OAuth
connection and no campaign filter, so it remains an ordinary global-refresh
candidate and is ineligible for durable native recovery. No historical data
or status was deleted, paused or rewritten.

## Code trace and reproduction

1. `server/storage.ts:getCampaigns` returns saved campaigns.
2. `server/utils/campaign-scheduler-eligibility.ts` filters campaign status;
   it does not exclude these missing-client historical rows.
3. The scheduled orchestration in `server/ga4-daily-scheduler.ts` processes the
   ordinary candidates and then the eligible durable-work campaigns.
4. `refreshAllGA4DailyMetrics` resolves the exact saved active connection.
   OAuth connections are not hydrated from service-account credentials.
5. `server/analytics.ts:getTimeSeriesData` throws `TOKEN_EXPIRED` when that
   connection has no access token, before a provider call.
6. The scheduler records `daily_series:TOKEN_EXPIRED`, skips daily replacement,
   and returns a failed candidate. The global wrapper reduces each failure to
   `GA4 daily refresh failed for 1 campaign(s)` and joins those messages.
7. Independent successful campaigns still publish their completion markers;
   the overall run remains failed when any candidate failed.

Six offline diagnostic tests passed against the real scheduler and analytics
code, using the sanitized read-only inventory and mocked storage/network
boundaries: five per-campaign cases and one combined case. They prove the
missing-credential failure, zero metric replacements, zero token writes and
zero network requests. Production timers were not invoked by those tests.

Ignored local receipts are in `.local-test/`: `live-refresh-diagnosis-inventory.json`,
`live-refresh-campaign-boundaries.json`, `live-refresh-diagnosis-tests.json`,
and `live-refresh-investigation-final-health.json`. The reusable read-only
diagnostic is `investigate-live-refresh.cjs`.

## Limits and disposition

- Public health retains aggregate failure text, not the individual historical
  campaign error logs. Exact historical event attribution remains inferred from
  the eight-candidate inventory, three completed publications, five reproduced
  failures and matching aggregate count. Render event logs were not obtained.
- This investigation does not certify all stored historical values, source
  lifecycles, reports, or future refreshes. Global scheduler health remains failed.
- The local restart-recovery error remains a separate unresolved issue. There
  is no production evidence of that exact error in the inspected health/work.
- The previously tested ROAS presentation correction is still local; no release
  was performed here.
- No application runtime code changed during this investigation. Do not remove
  safeguards, reconnect, delete or broadly retire historical records to make a
  health indicator green. Any historical disposition needs an exact separately
  reviewed target/ownership/retention boundary.

The next technical investigation is the isolated local restart-recovery error.
