# GA4 sampled daily-presence check — test release

## Confirmed boundary

Colombian Coffee initial import (campaign `0dd4770a-1610-4c12-983a-cd51d61ddffc`) failed on 13 November 2026 at 19:46:42 UTC with `GA4_DATA_QUALITY_UNAVAILABLE: sampling`. Existing live logs show the daily series completed at 19:46:35.687, followed by two request dispatches and then the sampling rejection. Tracing the sequential scheduler path identifies the second `daily_presence` request: date dimension, selected `campaignName` filter, conversions and totalRevenue. Connection and campaign discovery had already succeeded (16 names). No tester credentials or new provider requests were used for this investigation.

The quality guard correctly rejected sampled data. The missing behavior was recovery of this date-presence query using smaller unsampled ranges. The response is used only to discover dates with activity, never to calculate figures. The scheduler rejects activity dates lacking complete daily metrics before persistence; existing overview reconciliation and initial-import verification remain mandatory.

## Localized change

Only `getTrendsDailyPresenceWithToken` in `server/analytics.ts` changes. When sampling is the **only** quality restriction, bisect an explicit multi-day range. Every child passes the unchanged shared quality gate. Date ranges are disjoint and cover the entire parent. Only the union of returned dates is consumed; the original daily figures are returned untouched. No totals, distinct users, rates, currency or attribution definitions change.

Fail closed on a sampled single day, any other quality restriction, incomplete rows, mismatched currency, out-of-chunk dates, provider failure, cancellation or deadline. Each presence query retains its original 120-second deadline through all children; both presence checks share a 64-request subdivision cap. A subsequent request's existing transient retries remain separately bounded. No schema, storage, scheduler, UI, permissions or financial-source changes.

The existing Insights Trends read-only caller shares this method. Its exact scope, zero-day guards and normal two-request behavior are covered. A limited diagnostic logs property, dates and metric names when subdivision begins; no tokens, filter values or returned amounts are logged by this new diagnostic.

## Verification

Synthetic provider fixtures cover sampled second-query recovery, all 31 days, sampled traffic presence, unchanged daily inputs, genuine zero data, single-day failure, other restrictions, partial child failure, currency, pagination, dates, request cap, cancellation, shared deadline, and continued rejection of sampled totals/distinct users. Existing pipeline regression now includes daily-presence failure and proves saved figures and downstream publication stay protected.

Local focused coverage: 553 distinct cases pass across the targeted suites; the two cancellation cases initially exposed error-type masking, which was corrected and retested. TypeScript passes. Required GitHub checks and hosted verification must pass before deployment is considered complete; evidence is retained under `audit-temp/ga4-sampling-release/`.

## Boundaries

Test app deployment only. No live app change, refresh or database query. No access to Colombian Coffee credentials. This does not prove GA4 will return unsampled responses for every smaller range, or that subsequent reports for this property will be unsampled. Single-day sampling or another sampled aggregate remains blocked rather than publishing estimates. Actual Colombian Coffee completion requires a later authorized client retry; it is not claimed by these synthetic tests.
