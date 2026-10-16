# GA4 processing performance and data alignment backlog

Recorded: 2026-10-16

Code baseline: `1e4fdbc56339b1c1bffa3389a914adbbbbeae5c2`

Status: A1 scheduled-refresh deadline correction implemented on 2026-10-16; remaining A1 work, B1 and P1-P7 are outstanding. Deployment and live validation of this correction are pending.

## Scope and evidence

This records the seven previously proposed performance improvements as P1-P7, the data alignment issue as A1, and the subsequently identified Benchmark history issue as B1. These are work items, not a count of small patches needed to complete GA4 readiness.

Current-behavior findings below come from the application code. Existing project documents remain implementation constraints, not evidence that a path works. Production timing, deployed environment variables, provider responses, and affected production records were not measured in this review.

User-directed order, updated 2026-10-16: finalize the GA4 processing/reporting approach in A1 first; address B1 next. P1-P7 remain deferred. Faster imports cannot make Google finish processing sooner. P1 is the smallest isolated performance candidate; the other performance changes require separate design and validation.

## A1 - Align GA4, Revenue, and Spend by processing readiness

Status: open; the scheduled-refresh deadline correction below is implemented locally following user authorization. Broader publication alignment and reporting notes remain outstanding. The revised recommendation below supersedes the earlier default holdback proposal.

### Confirmed code behavior

| Path | What the code currently checks or does |
| --- | --- |
| [Reporting dates](../server/utils/reporting-timezone.ts), `getLatestCompleteReportingDate` | Returns yesterday in the campaign reporting timezone. This establishes that a calendar day ended, not that Google finished processing it. |
| [Daily scheduler](../server/ga4-daily-scheduler.ts), `refreshAllGA4DailyMetrics` | Fetches daily metrics, validates coverage and provider presence, and reconciles Overview breakdowns with daily totals. Different reports can agree while all still contain provisional data. |
| [Financial totals](../server/utils/campaign-current-values.ts), `getCampaignMetricTotalsForEndDate` | Can select fresh provider cumulative totals or persisted daily candidates. Availability and numeric validity do not establish provider finalization. External source totals use their existing cumulative range through the requested end date. |
| [Snapshot writer](../server/utils/financial-daily-snapshot-writer.ts), `writeFinancialDailySnapshotIfReady` | Requires the current import-to-yesterday window, checks availability, currency and spend reconciliation, and calls the readiness assessor. It does not apply a processing-age policy. |
| [Readiness assessor](../server/utils/financial-daily-snapshot-readiness.ts), `assessFinancialDailySnapshotReadiness` | Checks campaign, reporting date, currency, contract, successful refreshes, completion after the reporting day closed, and required inputs. It does not establish that GA4 attribution has settled. |
| [Snapshot API](../server/routes-oauth.ts), `/api/campaigns/:id/financial-daily-snapshot` | Checks campaign access and a completed calendar-date boundary, then retrieves the latest saved financial snapshot at or before that date. |
| [Snapshot storage](../server/storage.ts), `getLatestFinancialDailySnapshot` | Selects by campaign, snapshot type and reporting date, then validates the contract. |
| [Overview UI](../client/src/pages/ga4-metrics.tsx), `overviewFinancialInputs` | Calculates Overview financial ratios from the saved financial snapshot. Website metrics and other details have separate queries; not every consumer is pinned to one publication generation. |

The current scheduler already re-fetches recent dates and updates the same reporting date's financial snapshot after successful validation. The gap is that successful refresh plus matching dates does not establish Google processing completion, and the reviewed Overview path does not explicitly distinguish provisional provider figures. This establishes a risk; it does not prove that every current production value is wrong.

Example: a day's external Spend is EUR 1,000, but GA4 has so far processed only 50 of the eventual 100 conversions. CPA temporarily shows EUR 20 instead of EUR 10 even though both inputs have the same date. ROAS/ROI are affected when their revenue input is incomplete; a ratio using two complete external financial inputs is not automatically wrong because GA4 conversions are delayed.

Google states that processing can take 24-48 hours, reports can change during processing, and key-event attribution credit can change for up to 12 days. Typical availability is not a guarantee. A fixed 48-hour wait or two identical responses cannot prove that all future revisions are finished. [Google: Data freshness](https://support.google.com/analytics/answer/11198161?hl=en)

### Revised recommendation: timely results with explicit uncertainty

1. **Retain the existing repeated updates through the previous day.** Use the user's stated 08:00, 14:00 and 20:00 schedule. Local code accepts multiple configured hours; production configuration and run success have not been independently checked. Do not add a default rule hiding Tuesday's figures until a later day. This is a change of recommendation, not a new recalculation mechanism: repeated updates already exist.
2. **Distinguish import success from processing completion.** Track the reporting date and actual successful refresh time. Mark recent GA4-dependent figures as provisional without claiming knowledge of Google's internal processing state. External Revenue/Spend may also be revised. Define the status policy before implementation; elapsed time or matching responses alone must not create a "Google finalized" claim.
3. **Validate the comparison's common scope and cutoff.** Keep campaign, property/filter, currency and reporting-timezone boundaries consistent. Verify that source day boundaries agree; matching date strings alone is insufficient across timezones. Treat missing or failed inputs separately from valid provisional values.
4. **Expose coherent updates.** Website metrics, financial inputs and dependent ratios should represent the same published refresh. Retain the previous valid publication when a required stage fails; with no valid publication show unavailable rather than zero. The reviewed writes and UI queries are separate, so consistency across them still needs validation. A schema version is not a data publication identity.
5. **Make freshness understandable.** Proposed wording: "Data through Tuesday. Updated Wednesday 14:05. GA4 figures may change." The timestamp must reflect a successful publication, not merely a scheduled start. A provisional label explains uncertainty; it does not mathematically correct an inflated CPA caused by incomplete conversions.
6. **Keep reconciling recent days.** Preserve the existing lookback refresh (90 days by default) while this issue is addressed. Do not reduce it to a new window under A1. Any later optimization belongs to P6 and must preserve correction coverage and explicit historical reprocessing.
7. **Define downstream use before completion.** Trace affected KPIs, Benchmarks, trends, executive summaries, alerts, comparisons, exports and scheduled reports. Carry freshness/status into those consumers; decide how provisional data affects automated recommendations and breach alerts before changing their behavior. Preserve sent report/audit history. B1 is queued separately immediately after A1 is finalized.

Preserve existing financial range semantics: the current code can include external source history earlier than the initial GA4 import. Do not silently truncate that history as part of a maturity fix. Document and validate start dates and attribution scope for each comparison; incompatible ranges require an explicit product decision or an unavailable comparison.

This keeps recent results available and makes revisions explicit. It does not eliminate temporary distortion when GA4 is incomplete. A processing holdback remains an alternative reporting policy, not the current default recommendation. Neither policy guarantees permanently final Google attribution.

### Baseline code review of the proposed note (2026-10-16)

The rolling import behavior already exists. A note describing it does not require a new refresh engine. The complete proposed note, however, needs accurate metadata wiring and the following status handling; a text replacement alone does not establish those guarantees.

1. **Freshness checks only the first scheduled time.** `getGA4DailySchedulerConfig` sorts `hours` and sets `hour = hours[0]`. The `/ga4-daily` route passes only `schedulerConfig.hour` to `getExpectedDailyRefreshAt`. `resolveGA4DailyFreshness` can therefore consider an 08:05 success current all day, even after later updates are missed. The route also sets `providerRefreshWarning` to null rather than passing a later scheduler failure. The scheduler itself supports multiple hours; the status calculation does not track each expected run.
2. **The existing timestamp covers GA4 daily storage, not the whole dashboard.** `/ga4-daily` derives `lastUpdated` from stored daily-row timestamps and exposes `lastCompletedRefreshAt` when its coverage check passes. The financial snapshot separately has `recordedAt`. The UI's current Data freshness section displays the GA4 timestamp; the proposed all-results note must not reuse it as proof that Revenue/Spend and every downstream stage finished.
3. **A partial refresh can leave different sections on different updates.** Daily facts and GA4 Overview tables are committed together before the financial snapshot is written. A blocked financial stage retains its previous snapshot. `/financial-daily-snapshot` returns the latest valid saved snapshot at or before the requested date, and the UI accepts its available inputs without a same-refresh check. Independent five-/ten-minute polling can also expose different update times temporarily. Financial CPA itself uses spend and conversions from one financial snapshot; this finding is about consistency with separately displayed website metrics. This is a code-confirmed possible state, not an observed production incident.
4. **Use actual metadata for the note.** For GA4 Overview, use the persisted import start and latest stored reporting date, not the clock's expected yesterday if a run was missed. Keep reporting timezone distinct from scheduler timezone. The daily API currently returns the scheduler timezone and first expected time, but not its full configured hours array. Expose/reuse the appropriate scoped metadata rather than hardcoding production settings. Use separate section update times or an explicitly verified common update; explain stale or mismatched sections instead of implying the entire page refreshed together.

Local verification: executed the existing `getExpectedDailyRefreshAt` and `resolveGA4DailyFreshness` functions directly using Node's TypeScript stripping, without database or provider access. Used Tuesday `2026-10-13`, timezone `Europe/Amsterdam`, first configured hour 08:00 and a Wednesday 08:05 successful refresh:

| Check time on Wednesday | Scenario | Actual `refreshIsStale` |
| --- | --- | --- |
| 09:00 | 08:05 success | `false` |
| 14:30 | No update after 08:05 | `false` |
| 20:30 | No update after 08:05 | `false` |
| 14:30 | No successful refresh timestamp | `true` |

The latter scheduled runs were not represented by that baseline status calculation. The correction below checks every configured deadline. Distinguishing a running refresh from a failed/missed one still requires separate campaign-specific run evidence; the existing stale flag does not establish the cause.

Review boundary: scheduler -> daily/Overview persistence -> financial snapshot writer/readiness -> read endpoints -> Overview queries/rendering. Other saved historical outputs, every provider lifecycle and production executions are not certified here. B1 remains the separately queued next issue. That initial review made no application changes; subsequent implementation is recorded below.

### Implemented correction: check every configured refresh deadline (2026-10-16)

- **Root cause:** `/ga4-daily` used only the first configured hour. The alert freshness helper ignored `GA4_DAILY_REFRESH_HOURS` and used the legacy single hour. An earlier successful update could therefore remain current after a later scheduled refresh was missed.
- **Changed paths:** [reporting-timezone.ts](../server/utils/reporting-timezone.ts) now has a schedule-aware deadline selector using the existing timezone conversion. [routes-oauth.ts](../server/routes-oauth.ts), `/api/campaigns/:id/ga4-daily`, and [ga4-alert-current-value.ts](../server/utils/ga4-alert-current-value.ts), `resolveStoredGA4TrafficFreshness`, use that selector. Existing response fields and the single-hour date helper remain compatible.
- **Behavior:** for a configured 08:00/14:00/20:00 schedule, an 08:05 saved update is stale once 14:00 is due. A saved 14:05 update is current until 20:00 is due. Before the first run, the first upcoming deadline remains pending. Actual configured hours, minutes and scheduler timezone are used; production settings are not hardcoded.
- **Preserved boundaries:** campaign access, selected property, reporting date window, provider coverage exceptions, source values, metric formulas, storage writes and scheduler execution are unchanged. Missing reporting dates remain due at the first scheduled hour. The route still reads stored facts without contacting GA4 or writing records.
- **Downstream trace:** the existing `refreshIsStale` field feeds GA4 connection freshness, KPI/Benchmark traffic-input checks, Performance Summary and Trend Analysis warnings, and alert freshness decisions. Existing consumer-specific handling, including Insights coverage exceptions, is retained. The scalar freshness result is not evidence that financial snapshots share the same refresh.
- **Tests:** 25 new behavioral checks pass: 20 in [ga4-refresh-status-regression.test.ts](../server/ga4-refresh-status-regression.test.ts) and five actual HTTP route cases in [ga4-kpi-real-path-parity-regression.test.ts](../server/ga4-kpi-real-path-parity-regression.test.ts). Cases cover both later deadlines, stored success timestamps, pending first runs, invalid/duplicate schedule values, legacy single-hour fallback, configured minutes, daylight saving changes, failure warnings, unchanged totals and read-only API behavior. Six of the first ten reproduction cases failed before the runtime correction.
- **Regression comparison:** six relevant test files ran: 128 passed, 17 failed. An isolated checkout of baseline `1e4fdbc56339b1c1bffa3389a914adbbbbeae5c2` ran the five existing files: 103 passed, the exact same 17 test names failed. No added failures in this packet. Existing failures: 14 in KPI real-path parity, one reporting-cutoff source assertion, one Insights source assertion and one notification visibility source assertion. These are recorded, not fixed or waived by this task. Local reports: `audit-temp/ga4-refresh-status-results.json` and `audit-temp/ga4-refresh-status-baseline-results.json`.
- **Remaining/unverified:** this correction keeps the existing current/stale contract. A still-running or failed later run with no new saved timestamp remains stale; it does not introduce distinct pending/running/failed/success job states or propagate campaign-specific failure reasons. That requires scoped run evidence rather than the process-global scheduler status. Financial partial-refresh alignment, explicit reporting wording, live database/provider validation, deployed environment settings and production UI validation remain outstanding. The full repository suite was not run. No production-readiness claim is made.

### Implementation boundaries and required validation

- Work inside existing `shared/schema.ts`, `server/storage.ts`, `server/routes-oauth.ts`, scheduler/service files and existing pages. Review any schema migration or response extension separately; preserve established consumers.
- Add a reproduction where partial GA4 data passes the current same-date/reconciliation gates. Verify that the latest successful result remains visible with provisional status and is revised after a later successful run.
- Verify one common cutoff and publication across all visible inputs, including when one source is a day behind, a refresh fails, a campaign is new, or the latest saved financial snapshot is older than the website snapshot.
- Cover zero activity, missing data, late conversions, revised attribution, refunds/spend adjustments, provider authentication failure and quota failure. Preserve the distinction between unavailable and zero.
- Cover timezone differences, daylight-saving boundaries, initial import dates, currency mismatches, property/campaign filters and tenant access.
- Verify source add, edit, delete/deactivate and scheduled refresh; source lists; recomputed totals; concurrency; restart; and campaign deletion while work is pending.
- Verify coherent publication on retries and partial writes. Preserve previous valid data and avoid duplicate alert/email side effects.
- Assess persisted snapshots that may already contain provisional numbers. Rebuild only from exact scoped source data; never silently erase history or invent missing allocations.
- Existing test entry points include `server/financial-daily-snapshot-readiness.test.ts`, `server/financial-daily-snapshot-writer.test.ts`, `server/ga4-daily-scheduler-regression.test.ts`, `server/ga4-reporting-timezone-regression.test.ts` and `server/ga4-overview-scheduler-snapshot-regression.test.ts`. Their presence is not evidence that the new policy is covered.

## B1 - Update an existing Benchmark history entry after a later refresh

Status: queued after A1 is finalized, per the user's instruction. No runtime fix implemented.

- **Confirmed code finding:** [ga4-kpi-benchmark-jobs.ts](../server/ga4-kpi-benchmark-jobs.ts), `runGA4DailyKPIAndBenchmarkJobs`, updates the Benchmark current value each run. It records history only when no entry for the reporting date already exists; the reviewed branch does not update the existing entry. The neighboring KPI branch does update an existing same-date progress entry.
- **Example:** Wednesday's 08:00 run saves a Tuesday Benchmark value of EUR 20. A later successful run changes the current value to EUR 10, while Tuesday's existing history entry can remain EUR 20.
- **Next investigation:** trace history storage/update methods, unique identity, scope markers and actual consumers before editing. Verify campaign/platform/Benchmark/date ownership, duplicate-entry handling and derived variance/rating fields. Do not rewrite unrelated history or sent report artifacts.
- **Validation required:** repeated runs for the same reporting date, changed values, unchanged values, failed imports, duplicate history, other dates/Benchmarks/tenants and neighboring KPI behavior. Existing damaged history requires a separately proven correction boundary.

## Deferred performance improvements

### P1 - Reuse the daily-series response

- **Evidence:** `refreshAllGA4DailyMetrics` fetches the daily series, then filtered-campaign validation calls `getTrendsDailyPresenceWithToken` in [analytics.ts](../server/analytics.ts), which fetches the series again.
- **Proposal:** reuse the already fetched result in this caller while retaining the other presence queries, auth recovery, currency, filter and completeness checks. Preserve existing callers and signatures where possible.
- **Validation:** prove one fewer equivalent provider query with unchanged values and failure behavior for filtered/unfiltered campaigns, zero days, missing rows, auth refresh and partial provider failures.
- **Risk:** reusing a response from a different property, filter, date window or currency would corrupt results. Scope identity must match exactly.

### P2 - Batch daily-row persistence inside the existing transaction

- **Evidence:** [storage.ts](../server/storage.ts), `replaceGA4DailyMetricsWindow`, awaits an insert for each day after deleting the replacement range; the Overview snapshot is written in the same transaction.
- **Proposal:** use a bulk insert, with bounded chunks only if database parameter limits require it. Preserve validation, delete scope and the transaction containing the Overview snapshot.
- **Validation:** identical rows/values for normal, empty and boundary windows; complete rollback on failure; no changes outside the campaign/property/date window; no partial Overview publication.

### P3 - Remove unrelated campaigns from each other's critical path

- **Evidence:** [ga4-daily-scheduler.ts](../server/ga4-daily-scheduler.ts), `runGA4DailyRefreshPipelineForTrigger`, awaits the global financial-source stage before the GA4 stage. GA4 campaigns/connections are also processed sequentially.
- **Proposal:** allow bounded progress for independent campaigns within the existing scheduler structure. Keep each campaign's financial/GA4 validation and downstream publication dependencies intact. Account for shared properties and provider quotas.
- **Validation:** a slow or failed source in campaign A must not prevent campaign B from finishing; campaign A must not publish mixed data. Cover bounded concurrency, tenant scope, retries and source deletion.
- **Dependency:** A1 publication rules must remain enforceable; do not parallelize writes to the same campaign/window without ownership protection.

### P4 - Make initial import recoverable without a long HTTP request

- **Evidence:** draft activation in [routes-oauth.ts](../server/routes-oauth.ts) awaits `refreshAllGA4DailyMetrics({ campaignId, includeTargetDraft: true })`; [campaigns.tsx](../client/src/pages/campaigns.tsx) awaits that request.
- **Proposal:** persist the import work and expose its status through the existing campaign flow. Keep the campaign pending until required validation succeeds; do not mark empty/unverified analytics ready merely to return faster.
- **Validation:** browser close, repeated Create, request timeout, process restart, retry, failed auth, cancellation/deletion and eventual success; no duplicate campaigns/imports or cross-user status exposure.
- **Dependency:** implement recovery/idempotency with P5 before relying on detached work. An in-memory promise alone is insufficient. This is a workflow change, not a small speed patch.

### P5 - Recover scheduled work and bound provider waits

- **Evidence:** [ga4-daily-scheduler.ts](../server/ga4-daily-scheduler.ts) schedules in-process timers and uses a process-global busy flag. The reviewed daily-report fetch in [analytics.ts](../server/analytics.ts) has no explicit cancellation deadline; stage wrappers annotate failures rather than imposing deadlines. An auth retry exists, but is not a general transient-error recovery policy.
- **Proposal:** persist due/in-progress/completed work and recover it with scoped leases/idempotency in the current job/storage structure. Add cancellable request deadlines, bounded transient retries and quota-aware backoff. Preserve the existing auth-refresh behavior.
- **Validation:** missed scheduled slot, restart mid-job, competing workers, hung requests, 429/5xx, permanent auth failure, lease expiry and campaign deletion. A timed-out request must not keep mutating after another worker takes ownership.
- **Boundary:** startup repair already exists for some missing/inconsistent snapshots. Inspect and reuse it; do not assume it recovers every interrupted job. Actual deployed scheduling hours and replica count remain unverified.

### P6 - Refresh recent corrections without repeatedly rebuilding all history

- **Evidence:** `GA4_DAILY_LOOKBACK_DAYS` defaults to 90 in [ga4-daily-scheduler.ts](../server/ga4-daily-scheduler.ts); scheduled work also requests cumulative Overview data.
- **Proposal:** use a recent correction window for additive daily facts, fill known coverage gaps, and schedule deeper historical reconciliation separately. Preserve necessary cumulative provider queries for metrics that cannot be reconstructed safely from daily rows.
- **Validation:** initial import, missing dates, revisions inside/outside the routine window, source configuration changes, historical reconciliation and consistent Overview totals. Unique users must not be computed by summing daily users.
- **Dependency:** choose windows together with A1. Reducing the lookback must not remove correction coverage or turn missing history into zeros.

### P7 - Show a completed publication promptly

- **Evidence:** [ga4-metrics.tsx](../client/src/pages/ga4-metrics.tsx) polls the main daily metrics every five minutes and several Overview/snapshot queries every ten minutes. Other source queries have different intervals.
- **Proposal:** prefer lightweight publication-status/version polling and coordinated query invalidation through the existing query layer. Consider an existing notification mechanism only if suitable; no new service is required by this backlog.
- **Validation:** finished data appears promptly, all related cards use the same publication, previous valid content stays visible during refresh, errors preserve stale-state labeling, and idle pages do not create excessive requests.
- **Boundary:** faster browser polling only reduces display lag after publication. It cannot fix provider processing delays or failed imports.

## Review coverage and remaining uncertainty

- **Traced for this analysis:** calendar cutoff, scheduled daily refresh/publication sequence, financial input selection, financial snapshot writer/readiness checks, snapshot retrieval, and Overview financial consumption. Performance call sites above were inspected, not production-profiled.
- **Partially reviewed:** separate live/fallback financial paths and other consumers in `ga4-metrics.tsx`. The financial snapshot writer can obtain a newer provider response than the earlier daily import; matching dates alone do not prove matching source generations.
- **Outstanding:** exhaustive downstream value/consumer inventory; every source lifecycle; scheduler restart/concurrency tests; source completeness guarantees; persisted-data impact assessment; end-to-end validation; production timings and environment configuration.
- No production-readiness claim is made. The targeted local freshness-function execution is recorded above; no full suite, database integration test or production validation was run. Reinspect the current branch before implementing any item; the anchors above describe the recorded baseline.
