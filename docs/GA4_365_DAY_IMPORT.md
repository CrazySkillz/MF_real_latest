# New-campaign GA4 historical import

Local implementation and validation: 19 November 2026. This document does not
certify a deployed version or a real Google property import.

## User behavior

In `Create Campaign -> GA4 -> Configure`, `Historical data` offers `Last 30 days`
(the existing default) and `Last 365 days`. Campaign discovery uses that chosen
period. The selected GA4 property and campaign names still restrict all imports;
this does not import unrelated property traffic. Configure and Confirm show the
saved start date.

The start is the selection date in the campaign reporting timezone minus the
chosen number of calendar days. For example, choosing 365 on 19 November 2026
sets 19 November 2025 as the fixed start. With completed-day reporting, the first
import ends on 18 November 2026 and covers 365 days. The existing current-day
policy, when enabled, can additionally include today's provisional data. This
preserves the established date policy rather than changing it for existing
campaigns. Leap years, daylight saving, and timezone midnight are covered by tests.

`Create Campaign` uses the existing durable background initial-import path.
Subsequent daily processing retains that start and appends later dates; it does
not discard the oldest dates to maintain a rolling year. Partial/missing provider
evidence remains unavailable. Explicit, verified zero days remain recorded zeros.

History depth can change only on an unaccepted draft. After Create is accepted,
including failed imports awaiting retry, history is locked in both the route and
the storage transaction. Same-property reconnects preserve the saved annual
start. Existing campaigns are not automatically extended, refreshed, or migrated.

## Downstream effects

| Surface | Contract and validation |
| --- | --- |
| GA4 Overview | Summary and Campaign Breakdown, Landing Pages, and Conversion Events retain the fixed import scope. Annual worker/provider fixtures check common dates, reconciliation, exact native period totals, atomic publication, and failure behavior. Read-route tests check the saved annual publication. |
| GA4 Ad Comparison | The saved annual window matches the synchronized Overview rows and totals. The real route is exercised with an annual saved publication. |
| GA4 Insights | Data Summary, findings, and financial inputs use the same saved-history contracts. Daily, 7d, 30d, and Monthly Trends are browser-tested across six metrics, including annual boundaries, zeros, and partial months. Monthly remains capped at 12 displayed calendar months; month navigation reaches earlier imported data. |
| GA4 KPIs / Benchmarks | Real recompute and saved-report consumer tests cover annual current values, distinct period users/sessions, native rates, target conclusions, and unavailable inputs. Historical depth does not manufacture historical target evaluations. |
| Performance Summary | Annual saved-publication tests check cumulative traffic and outcome totals; existing browser replays check values, loading order, and exact-date comparison behavior. Recent Movement continues comparing cumulative totals at exact cutoffs. |
| Budget & Financial Analysis | Existing calculation and browser regression cases pass. Native GA4 revenue follows the saved import boundary. Imported Revenue/Spend retain their own existing eligible-record rules; no historical spend is invented or allocated. |
| Trend Analysis | Current cumulative totals and chart/comparison windows keep their separate meanings. Existing 7/14/30/90-day behavior, missing evidence, currency, and financial cases are regression-tested. |
| Executive Summary | Shared annual current-value inputs and existing risk/funnel/trajectory behavior are covered by route, database, and browser tests. Missing compatible historical snapshots remain unavailable; a year of traffic does not fabricate a year of executive snapshots. |
| GA4 reports / downstream reports | The saved GA4 PDF path accepts 365-day connections and uses the complete saved publication. Existing KPI/Benchmark report parity tests pass. Full Campaign Diagnostics Reports lifecycle review remains deferred; no email or scheduled report was executed. |

Engagement rate and session conversion rate keep native/weighted semantics.
Distinct users and exact-period sessions are not obtained by adding daily
distinct counts. Financial source scope, currency, and unavailable-data rules
remain unchanged.

## Implementation boundary

- UI: `client/src/pages/campaigns.tsx` adds the new-campaign selector and saved
  date; `GA4ConnectionFlow.tsx` preserves the saved depth on reconnect;
  `ga4-metrics.tsx` accepts a configured annual connection.
- API: `server/routes-oauth.ts` validates/saves the choice, returns saved metadata,
  supports annual discovery, and admits annual saved connections to readers.
- Storage: `server/storage.ts` extends the existing OAuth commit contract with an
  optional depth and rejects locked annual-history changes inside the existing
  campaign transaction. Concurrent Create/history-change tests prove serialization
  and rollback. No new tables, migrations, or schema defaults were introduced.
- Consumers: `server/ga4-scheduled-report-pdf.ts` and
  `server/utils/campaign-current-values.ts` add 365 to existing allowlists only.
- No scheduler implementation, schedule configuration, financial formula,
  provider-refresh service, or existing campaign data was changed by this task.

## Evidence and limits

The evidence folder is `audit-temp/ga4-year-import/`. It retains the pre-task
tracked-file hashes, exact before copies, JSON test reports, browser results,
build/typecheck output, and local database logs. Earlier failed test attempts are
retained for audit; `verification-tests.json` selects each file's latest result.

- 689 passing automated cases across 36 test files, including annual publication,
  existing 30-day behavior, access/scope guards, missing/zero data, rates, failures,
  retry behavior, scheduler startup rules, and database concurrency. No skipped
  cases remain in this consolidated packet.
- Six browser creation scenarios cover accepted close/reopen, failed import Back
  navigation, explicit retry, lost-response recovery, the annual selection, and
  reset to the existing 30-day default.
- Browser replays cover Performance Summary (16 cases), Budget & Financial
  Analysis (5), Trend Analysis (8), and Executive Summary (16), using saved test
  responses and blocked external requests. Existing Promo presentation/values
  are asserted against the saved fixtures.
- TypeScript and production build pass. Diff whitespace checks pass.
- All database writes were confined to a disposable PostgreSQL database on
  `127.0.0.1`; no production database or Google Analytics request was used.

This is local compatibility evidence, not blanket production-readiness approval.
Real-property annual availability, quotas, latency, provider retention, a hosted
fresh-campaign import, and its natural subsequent scheduled run remain unverified.
No deployed version or existing app data was changed. Existing source lifecycle,
notification delivery, and report delivery paths were not recertified by this task.
