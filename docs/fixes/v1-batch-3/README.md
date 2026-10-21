# Batch 3: Native GA4 query and financial contracts

[Release index](../../V1_RELEASE_READINESS.md) · [Finding checklist](../../audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md)

This is the detailed home for this batch's assigned findings. Read the required repository references first, then the release index, checklist and this record. Documentation records evidence; verify actual current code before changing behavior. Original audit paths and line numbers describe the recorded baseline, not an assertion that the defect remains unchanged.

## Current Batch 3 status

**IN PROGRESS — local commit checkpoint based on `aee04e508f0761ac2a9f53724393676a1bda7110`; not pushed or deployed.** Five localized corrections (V1-032/033/035/036/087) and the native GA4 portion of V1-025 pass the [546-check regression packet](validation-2026-10-21/currency-cache-final.json), including real isolated PostgreSQL and an intercepted rendered-browser fixture. Full-suite and build results are recorded below. No deployment, production-data change or release acceptance is claimed. All 10 release items remain open.

**Precision follow-up: V1-079 is VERIFIED LOCALLY for the documented forward paths.** Fractional credit now survives goals, history, snapshots, diagnostics and report rendering. Release acceptance remains OPEN. The [current candidate manifest](validation-2026-10-21-goal-precision/candidate-manifest.json) and [assessment](validation-2026-10-21-goal-precision/assessment.json) supersede earlier hashes; see [V1-079](#v1-079).

The four remaining implementation paths are source-aware recovery (V1-011), diagnostic/provider timeout/cancellation and late-write safety (the rest of V1-025), shared-property concurrency (V1-089) and provider-quality metadata (V1-090). V1-079 still requires deployed/provider and historical-data acceptance; do not confuse the locally verified forward correction with whole-source certification.

**Local commit boundary:** The 71 runtime/test/migration files match the final validated manifest. This checkpoint includes those fixes, both precision migrations, the four updated audit records and the three dated validation packets. Historical assessments retain their original pre-commit status. Production database compatibility, backup and a rollback that preserves fractional values must be verified before an auto-deploying push. No additional runtime changes or production actions were made while preparing the commit.

## Current validation boundary

**Latest downstream-precision checkpoint: 4,300 tests; 4,119 passed, 181 failed, zero skipped.** No newly failing identity. Every unresolved failure retains its original ID/classification in the [reconciliation](validation-2026-10-21-goal-precision/failure-reconciliation.json); none is waived. [Full results](validation-2026-10-21-goal-precision/full-suite-final.json), [assessment](validation-2026-10-21-goal-precision/assessment.json) and [candidate hashes](validation-2026-10-21-goal-precision/candidate-manifest.json) identify the tested content included in this local commit checkpoint.

The [precision coverage subset](validation-2026-10-21-goal-precision/precision-coverage.json) has **588 passing tests**, extracted from that full run; this is not an additional run. [Startup](validation-2026-10-21-goal-precision/startup-results.json): 11 scenarios pass, including repeated boot after fractional writes. [TypeScript and production builds](validation-2026-10-21-goal-precision/build-checks.json) pass. [Cleanup](validation-2026-10-21-goal-precision/cleanup.json) confirms zero fixture schemas/connections and the stopped local PostgreSQL process.

The intermediate full run found 36 additional failures: 19 fixed-scale string expectations, 16 obsolete source assertions and one missing extracted-fixture binding. All are individually classified and now pass, with ownership, rollback, stale-work, target, currency and mismatch expectations retained. The rendered-page fixture also needed its goal-list query invalidated after changing fixture data; that corrected browser test passes. The only runtime adjustment during the final full run preserved the shared report formatter's existing count suffix and grouping; the subsequent [171-test report packet](validation-2026-10-21-goal-precision/report-unit-contract-verified.json) and final production builds cover that adjustment. This is a bounded follow-up, not another full-suite run. During that validation run, production, Ptomo and provider accounts were untouched; no commit, push, deployment, email send or historical repair occurred. The subsequent local commit does not extend the validation boundary.

### Earlier provider/storage precision checkpoint (superseded)

**Earlier precision continuation (October 21): V1-079 was IN PROGRESS at this checkpoint.** [Assessment](validation-2026-10-21-precision/assessment.json), [candidate hashes](validation-2026-10-21-precision/candidate-manifest.json), [full results](validation-2026-10-21-precision/full-suite-final.json) and [failure reconciliation](validation-2026-10-21-precision/failure-reconciliation.json) describe that earlier checkpoint; use the current downstream-precision packet above for present implementation status.

- Full run: **4,268 tests; 4,086 passed, 182 failed, zero skipped**. One failure expected the old integer parser and was corrected with a test-only assertion update; the separately rerun [17-test parser/behavior packet](validation-2026-10-21-precision/parser-assertion-corrected.json) passes. The full run had already loaded the old assertion. **181 unresolved failures remain**, with their original IDs/classifications and no new unresolved failure. This reconciliation is not a second all-green full-suite run; no failure is waived and no fresh CI run is claimed.
- [Final targeted packet](validation-2026-10-21-precision/precision-final-targeted.json): **552 passed, 1 failed, zero skipped**. The remaining `TEST-e2588426cf` structural scheduler assertion is part of those 181 open failures. New precision/provider/database/financial/browser checks pass. [Startup](validation-2026-10-21-precision/startup-results.json): 10 isolated scenarios pass. [TypeScript and production builds](validation-2026-10-21-precision/build-checks.json): all pass; existing bundle-size/sourcemap warnings remain.
- The runtime was unchanged after the final full run started. Only the obsolete parser assertion was subsequently updated and checked separately. [Fixture cleanup](validation-2026-10-21-precision/cleanup.json) confirms zero leftover schemas/connections and the stopped localhost test database. Ptomo, production data/configuration and provider accounts were untouched.
- Reproduction scripts and credential-stripping runners are retained in this new evidence folder. Use a new output folder for later candidates; preserve both this checkpoint and the earlier checkpoint below. No commit, push, deployment or historical-data repair was performed.

### Earlier checkpoint before the precision continuation

**Earlier local result:** 4,240 tests, **4,059 passed, 181 failed, zero skipped**, with **zero newly failing identities** relative to the prior 182-failure suite. `TEST-65b981daca` now passes locally after correcting its obsolete writer/scheduler source assertions, backed by behavioral ownership/publication checks. The other 181 retain their original IDs and classifications: 10 source-extraction, 53 fixture-contract, 73 structural-assertion, 37 behavior-with-incomplete-fixture and 8 fixture-binding failures. All remain open; none is waived. The separate `TEST-f323e48c9f` browser CI failure remains unverified because no new CI run was performed, even though that browser test passes locally.

- Candidate identity and reproducible evidence: [file hashes](validation-2026-10-21/candidate-manifest.json), [assessment](validation-2026-10-21/assessment.json), [final full suite](validation-2026-10-21/full-suite-verified.json), [failure-by-failure reconciliation](validation-2026-10-21/failure-reconciliation.json), [TypeScript/build exit status](validation-2026-10-21/build-checks.json), [fixture cleanup](validation-2026-10-21/cleanup.json). These identify the local candidate, not a pushed or deployed revision.
- Tests strip application credentials, leave `DATABASE_URL` blank and use only synthetic responses plus isolated localhost PostgreSQL schemas. The browser test renders the actual GA4 page but stubs unrelated authentication/setup components and intercepts requests. No new customer consent, Google API quota/reconciliation, Ptomo edit, production migration, historical cleanup or email delivery was performed.
- The 546-check targeted packet covers the fixed query/helper paths, real API currency ownership checks, saved financial reads/writes, native/history invalidation, rollback, stale-work rejection, refund rendering, cache invalidation, failed refresh and recovery. Existing tests for neighboring source edits/deletion, ownership, initial import, filters and same-currency publication also run. This does not establish every source lifecycle or downstream artifact's acceptance.
- TypeScript and both production builds pass. The client chunk-size and node-cron sourcemap warnings remain recorded; these are not silently treated as repaired. Current local/CI failures retain their individual release impact in the reconciliation. V1-012 remains open.

Both isolated fixture databases have zero remaining test schemas and zero other client connections; the test-only PostgreSQL process on `127.0.0.1:55443` was stopped. No runtime files changed after the final full-suite run began. The two new regression test files and all other candidate runtime/test files are included in the manifest, with raw and LF-normalized hashes.

The evidence folder includes the credential-stripping [test runner](validation-2026-10-21/run-tests.cjs) and [build-check runner](validation-2026-10-21/run-build-checks.cjs). The final full suite used `node docs/fixes/v1-batch-3/validation-2026-10-21/run-tests.cjs full-suite-verified --local-pg server` with two Vitest workers. The final build runner uses `NODE_ENV=production`; the earlier compilation with `NODE_ENV=test` is retained separately in `test-env-*` logs and does not establish the production-mode result. These dated runners write into this evidence folder; use a new dated output location for a later candidate rather than overwriting this checkpoint. PostgreSQL URLs are restricted by the test harnesses to their named localhost fixture databases.

**Next implementation boundaries:** Six bounded corrections are verified locally (V1-032/033/035/036/079/087). V1-089 needs shared-property dispatch/cancellation evidence; V1-090 needs provider-quality availability/provenance handling; V1-011 and the rest of V1-025 need source-aware recovery and cancellation through existing services. All Batch 3 release acceptance remains OPEN.

**Reusable safeguards verified here:** completeness must use provider row counts and stable dimension identity; parameter matching must respect value boundaries and encoding; zero, missing and signed revenue are distinct; currency is part of persisted/current-read/cache identity; deadline and owner cancellation must reach optional queries as well as primary requests. These are contracts to independently validate for future providers, not proof that GA4 metric/attribution/precision/pagination/quota rules transfer unchanged. No new provider or framework was introduced.

## Scope and acceptance

Exact query/row keys/completeness, provider-quality metadata, attribution/precision, bounded property concurrency and abort behavior; correct source-ID fallback contract; explicit zero/negative/refund and currency-edit history policy; source-aware recovery. Preserve current valid GA4 consumer guards. Reconcile native facts through all displays/artifacts, not just totals.

For each included source, cover create/edit/delete/reconnect/refresh/list/totals, negative cases and downstream propagation. Preserve the existing architecture. Historical-data cleanup requires its own read-only inventory and separately reviewed scope. A locally passing fix does not close required deployed/provider acceptance.

## Dependencies

Preserve [Batch 1](../v1-batch-1/README.md) security and [Batch 2](../v1-batch-2/README.md) discovery/reconnect/startup contracts. Trace financial inputs from [Batches 4](../v1-batch-4/README.md), [5](../v1-batch-5/README.md) and [6](../v1-batch-6/README.md) through [Batch 7](../v1-batch-7/README.md) goals, diagnostics, alerts and reports. [Batch 8](../v1-batch-8/README.md) retains full acceptance and operations.

## Reference and evidence entry points

These records retain their own dates and verification limits. Use the current fix evidence above and below when it supersedes an original finding.

- [GA4 query and value trace](../../audits/v1-2026-10-19/GA4_QUERY_AND_VALUE_TRACE.md)
- [GA4 precision and provider scope](../../audits/v1-2026-10-19/GA4_PROVIDER_PRECISION_AND_SCOPE.md)
- [Financial contracts](../../audits/v1-2026-10-19/FINANCIAL_CONTRACT_AND_ONBOARDING_TRACE.md)
- [Campaign currency edit](../../audits/v1-2026-10-19/CAMPAIGN_CURRENCY_EDIT.md)
- [Financial source design](../../../GA4/FINANCIAL_SOURCES.md)
- [Processing/alignment backlog](../../GA4_PROCESSING_AND_ALIGNMENT_BACKLOG.md)

## Finding checklist

| Finding | Severity | Fix status | Release acceptance |
|---|---|---|---|
| [V1-011](#v1-011) | P1 | OPEN | OPEN |
| [V1-025](#v1-025) | P1 | IN PROGRESS | OPEN |
| [V1-032](#v1-032) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-033](#v1-033) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-035](#v1-035) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-036](#v1-036) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-079](#v1-079) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-087](#v1-087) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-089](#v1-089) | P1 | OPEN | OPEN |
| [V1-090](#v1-090) | P1 | OPEN | OPEN |

## Findings

Original evidence below is retained verbatim except relative link destinations. For implemented findings, use the correction and current-status sections to distinguish fixed forward paths from remaining release acceptance.

### V1-011

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: bounded implementation, required gate open):

Durable ownership/restart recovery in `ga4-daily-scheduler.ts:639–712` rejects active external Revenue/Spend sources and external connections. CRM/Sheets/Ads/Shopify campaigns retain ordinary refresh paths. Native-only P5 acceptance does not prove their cross-worker edits, retry, cancellation and restart safety.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-025

**Severity:** P1. **Fix status:** IN PROGRESS. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed timeout gap):

`googleAdsClient.ts:65-136` Axios client and token calls have no explicit request timeout; `utils/salesforce-pagination.ts:33` fetch has no signal/deadline. **Native GA4** `analytics.ts:1392-1604` total/supplemental queries also bypass requestReport and use direct fetch without signal (exact-service fixture). `auto-refresh-scheduler.ts:231` Promise.race stops waiting without cancelling its promise. A local HTTP timeout does not prove provider work stopped. Trace each caller, add bounded cancellation within existing paths and verify no late stale writes.

**Current correction (uncommitted):** `GoogleAnalytics4Service.requestReport` now supplies the existing 120-second signal when a caller omits one. The three `getTotalsWithRevenue` query functions use that helper, including total, conversion/revenue and per-date reconciliation requests. Timeout, cancellation and exhausted transient errors propagate through the optional supplement/UTM branches. Parsing an aborted response body no longer substitutes an empty object. Existing bounded retry limits, currency validation, metric fallback and formulas are retained.

**Evidence:** [Before](validation-2026-10-21/timeout-before.json): the four newly covered native branches failed 20 header/body/error-body/cancel/retry assertions. [Native API and query packet](validation-2026-10-21/timeout-currency-after.json): 168 passed. The actual cancellation test also exercises native fetch against a deliberately stalled localhost HTTP server. Provider responses, clocks and OAuth values are isolated fixtures; this is not a Google quota or production cancellation experiment.

**Scheduler cancellation correction:** A real scheduler abort uses a plain `Error`, not necessarily an `AbortError`. Three optional native branches still swallowed that reason in the [additional pre-fix packet](validation-2026-10-21/currency-cancel-before.json). The catch now also checks its owning signal's aborted state. All four native branches propagate that cancellation in the [final targeted packet](validation-2026-10-21/currency-cache-final.json); existing native timeout/retry and refresh-ownership checks also pass.

**Still open:** Google Ads Axios calls, Salesforce pagination and the `withTimeout` promise race around LinkedIn in `auto-refresh-scheduler.ts:1098` are not corrected here. Current-code review also confirms direct fetch in native `getOverviewDimensionDiagnostics` (`analytics.ts`, invoked conditionally from the breakdown route at `routes-oauth.ts:13663`); the total-query correction does not cover that diagnostic API path. LinkedIn functionality remains deferred, but retained shared-job late-write safety is still required. Remaining diagnostic/provider cancellation/late-write paths and deployed cancellation need validation. This finding is only partially implemented and cannot be marked fully verified.

### V1-032

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed GA4 attribution fixture):

`analytics.ts:2361-2449` Insights landing coverage uses CONTAINS for UTM source/medium. `google` matches `google_ads`; exact-service fixture selects60 sessions from40 actual landing sessions. Route13736 and UI2155 use this branch. UI5135-5143 currently withholds channel analysis when totals differ from daily data; this prevents that fixture's wrong summary but leaves incorrect API output and missing Insights. Native Overview scheduler passes this option false. Require exact parameter matching and no-overlap/total reconciliation tests.

**Current correction (uncommitted):** `analytics.ts`, `getAcquisitionBreakdown` / `utmValueExpression`, now uses escaped `FULL_REGEXP` values with query-parameter start/end boundaries for UTM source and medium, following the existing campaign-filter pattern. Raw, percent-encoded and plus-encoded variants and case behavior are preserved. The `google`/`google_ads` fixture now produces 40 sessions, not 60. No metric allocation, merge key, response shape or UI layout changed.

**Evidence:** [Query reproduction packet](validation-2026-10-21/acquisition-before.json), [passing query packet](validation-2026-10-21/acquisition-corrected.json), and [test source](../../../server/v1-batch3-acquisition.test.ts). Tests evaluate the actual generated filters against source prefixes, encoded spaces/plus signs, regex metacharacters, longer medium values and different parameter names. The conversion-total rejection control remains. The existing `ga4-filter.test.ts` non-additive session scenario still passes: a full-window provider aggregate is not assumed to equal the sum of dated channel queries. The current `ga4-metrics.tsx` `insightsChannelBreakdownMatchesDaily` guard still requires the selected rows to reconcile to imported daily sessions/conversions before recommendation use.

**Limits:** Actual Google filtering and all Insights/recommendation/PDF combinations still require independent provider/rendered acceptance. The older test name describing a visible Data Summary channel table is historical: current `GA4/INSIGHTS.md` and code exclude that table from Data Summary; the API remains a recommendation input. This correction does not certify those downstream sections.

### V1-033

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed GA4 completeness gap):

Acquisition `analytics.ts:1839-1883` accepts missing/nonfinite rowCount or rowCount<=first-page size. Exact-service fixture accepts a full bounded page with absent rowCount without another request or incomplete status. Pagination sorts only sessions, with no stable dimension tie-breaker. This is not evidence of an observed truncated Google response; it is a failed completeness guarantee for new/large properties. Validate malformed/full/tied/changed pages through callers and publication.

**Current correction (uncommitted):** Acquisition `completeReportRows` rejects nonempty reports with absent, invalid, fractional, negative or too-small counts, changing/missing counts on later pages, duplicate dimension keys, empty required pages and overrun. Session ordering now includes every requested dimension as a stable case-sensitive tie-breaker. The existing 100,000-row bound and pagination-error propagation through fallback callers remain. A genuinely empty response may omit zero `rowCount`, consistent with Protobuf JSON; nonempty missing-count pages are never inferred complete.

**Evidence:** The [new service tests](../../../server/v1-batch3-acquisition.test.ts) fail on the pre-fix service and pass after the correction; [query packet](validation-2026-10-21/acquisition-corrected.json): 139 passed, including existing filters, discovery, deadlines and OAuth controls. Three existing success fixtures supplied absent or incorrectly hard-coded counts; those fixtures now state their actual row counts without changing metric values or expected outcomes. Negative missing-count tests remain separate.

The first [full-suite run](validation-2026-10-21/full-suite.json) found 19 additional failures in `ga4-shared-daily-traffic.test.ts`: its success fixture emitted duplicate dimension tuples instead of provider-style grouped rows. The fixture now preserves campaign identity, groups by the actual requested dimension tuple and weights rate metrics by sessions. All original expectations remain; deliberate duplicate injection still tests rejection. The [corrected fixture packet](validation-2026-10-21/fixture-regressions.json) passed 99 checks and the [combined packet](validation-2026-10-21/currency-cache-final.json) passed 546. These were investigated fixture failures, not discarded test campaigns or waived completeness controls.

**Provider contract checked:** Google's [RunReportResponse](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/RunReportResponse) defines total row count independently of page size; [OrderBy](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/OrderBy) defines dimension ordering. [ProtoJSON defaults](https://protobuf.dev/programming-guides/json/#presence-and-default-values) explain omitted zero fields. Live large/tied-page behavior and changing provider data remain external acceptance, not proven by these fixtures. Other provider-quality flags are V1-090 and remain open.

### V1-035

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed financial contract reproduction):

`storage.ts:3120-3130` retries revenue completeness against all-date `getRevenueBreakdownBySource`, which returns `sourceId`; `utils/revenue-record-total.ts:20-29` recognizes only `revenueSourceId`. A valid source materialized outside the requested completed-day window still throws incomplete. Exact storage/helper fixture confirms mismatch. Fix exact contract and validate dated zero/pending/current-day data through all consumers, without treating missing records as measured zero.

**Current correction (uncommitted):** `utils/revenue-record-total.ts` now recognizes the actual breakdown `sourceId` after the existing flat/nested `revenueSourceId` forms. `storage.getRevenueTotalForRange` still reads dated, active, campaign-owned GA4/legacy-context rows and calls the all-date fallback only for missing materialization. The fallback proves source existence; it does not add future records or their IDs to the dated total. SQL filters, aggregation grain and both currency checks are unchanged.

**Evidence:** [Pre-fix financial packet](validation-2026-10-21/financial-before-corrected.json) reproduces the failure for zero, positive and negative future materialization. [Regression source](../../../server/v1-batch3-revenue-contracts.test.ts) executes the actual storage method and helper; missing, invalid and unrelated source IDs still fail. Additional actual PostgreSQL coverage is in [the input/invalidation tests](../../../server/ga4-refresh-input-invalidation-postgres.test.ts): dated versus future records, signed/zero values, another campaign, deliberately cross-campaign record ownership and currency mismatch. The source-definition/display contracts continue to distinguish pending-for-totals from never-materialized data.

**Limits:** No existing production records were read or repaired. Provider/source-modal and every downstream artifact still require deployed acceptance; passing this small shared contract does not certify imported-source families or their refresh paths.

### V1-036

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed code/document contradiction):

`utils/campaign-cumulative-financials.ts:41-126` and shared schema994-1044 reject negative revenue/components, while shared GA4 financial selector accepts them and `GA4/FINANCIAL_SOURCES.md:89` requires valid negative revenue remain authoritative. Outcome route15929 invokes rejecting helper before response/publication. Fixture accepts−10 upstream then throws downstream; zero control passes. Resolve exact negative/refund policy and propagate consistently; do not silently clamp.

**Current correction (uncommitted):** `utils/campaign-cumulative-financials.ts` accepts finite signed native/imported revenue and uses the existing `parseGA4FinancialNumber` so null, blank, boolean and nonfinite inputs cannot become measured zero. `shared/schema.ts` has a revenue-specific signed-money branch derived from the existing strict monetary contract. Spend and conversions remain nonnegative; precision bounds, availability, provenance, campaign/date/currency identity and component reconciliation remain enforced. Public shapes and arithmetic are unchanged. This aligns the current implementation with the signed revenue policy in `GA4/FINANCIAL_SOURCES.md` rather than clamping refunds away.

**Evidence:** [Pre-fix financial packet](validation-2026-10-21/financial-before-corrected.json): 15 product/contract assertions fail after correcting an initial table-parameter fixture error. The [financial packet](validation-2026-10-21/financial-after.json) then passed 114 checks and exposed a pre-existing stale source-text test (`TEST-65b981daca`): the writer now spreads `cumulative.snapshot` with `writeInput` to preserve ownership, and the GA4 scheduler also passes `writeInputFor`. Both obsolete expectations in that test now match the actual guarded calls. Behavioral writer and PostgreSQL tests independently verify ownership, stale-work rejection and the preserved signed snapshot. Tests cover negative native/imported components with positive/negative/zero totals, unchanged profit/ROAS/ROI/CPA formulas, unavailable/provenance/currency controls, gated snapshot writing and exact-date comparison derivation. The [rendered-page test](../../../server/ga4-publication-browser.test.ts) also renders a verified `-$15.00` refund after currency recovery.

**Downstream boundary:** The shared schema is used by storage insert/read, financial readiness and alert/comparison consumers; `financial-daily-snapshot-writer` and `financial-daily-comparison` now preserve the same signed input. Overview/Insights financial cards read that saved input. End-to-end provider refund reconciliation, all goals/alerts and actual downloaded/scheduled reports remain acceptance work; other Batch 7 findings are not closed by this correction.

### V1-079

**Downstream correction, October 21 (current candidate):** The first precision checkpoint below was partial. This continuation traces the supplied GA4 number through platform and campaign goals, persisted current values, rolling progress, Benchmark history, period/alert observations, snapshots and report output. Release acceptance remains OPEN; no production data or saved customer history was rewritten.

**Root causes and localized corrections:**

- `ga4-kpi-benchmark-jobs.ts` rounded conversion inputs and current/history values; `campaign-current-values.ts` also rejected fractional saved facts using integer-only validation. Conversion inputs/current values/rolling averages now retain their numeric precision. Session/user/pageview validation, monetary/percentage calculation precision, target/threshold conventions, source scope and availability guards remain unchanged.
- Shared observed-value fields used fixed-scale NUMERIC and truncated credits below 0.01. [Migration 0026](../../../migrations/0026_goal_observed_value_precision.sql) widens only 11 observed fields in six existing tables to unconstrained NUMERIC; Drizzle/JSON still return strings. Finite checks reject Infinity/-Infinity/NaN. Targets, reference values, variance and money columns retain their prior types. Earlier startup DDL now uses NUMERIC for the same KPI/progress fields, preventing restart from narrowing them again. No table, endpoint or parallel framework was added.
- GA4/live-goal, Campaign Diagnostics, campaign goal/card, alert-message and report formatters rounded conversion credit to whole counts or two/three decimals. Existing formatters now use the small shared `formatConversionCredit` function in `shared/metric-math.ts` for conversion/count observations. Valid whole-number counts still display as before; observed-value form formatting is separate from target normalization. Significant digits keep small nonzero credit visible.
- Independently summed decimal conversions could fail exact-equality publication checks because of IEEE-754 addition order. `conversionCreditsMatch` permits only a term-count-scaled floating-point error bound for finite nonnegative values. It never equates zero with nonzero. Provider selection, scheduler, saved daily/Overview reconciliation and Insights channel comparisons use it at independently summed boundaries; exact same-publication financial checks remain exact. Tests distinguish 0.1+0.2 from a genuine mismatch and verify that a real mismatch withholds publication.

| Lifecycle / downstream path | Exact implementation and evidence | Boundary |
|---|---|---|
| Import / refresh / replacement | Existing service/provider tests plus actual daily scheduler tests, including arbitrary-decimal and true-mismatch cases; earlier primary/supplement, date, filter, currency and pagination fixtures retained | Synthetic provider replies; no new live Google attribution claim |
| Platform KPI/Benchmark creation and edit inputs | `ga4-metrics.tsx` current-value prefill/formatters and `resolveGA4KpiLiveValue`; actual rendered cards preserve 0.000075 alongside whole session counts | Isolated intercepted page; unrelated auth/setup components stubbed |
| Daily current values, same-day correction and rolling history | `runGA4DailyKPIAndBenchmarkJobs` tests exercise 0.75/0.000075/integer, fractional CPA, current writes, same-day progress/history replacement and alert resolver; campaign-goal calculation configs covered too | Current target/alert policy and data-sufficiency gates preserved |
| PostgreSQL current/history/alert/period persistence | `v1-batch3-conversion-postgres.test.ts` runs actual storage create/update/read/JSON, other-campaign controls, progress edits, Benchmark history, alert values and period fields; migration preservation/repeat/rollback/nonfinite tests | Isolated schema; historical lost credit is not reconstructed |
| Restart and concurrency | Current startup packet runs the actual startup callback with real PostgreSQL, workers/providers stubbed, including restart after fractional writes and concurrent boot | Production lock duration/volume and live rollback remain unverified |
| Outcome totals / snapshots / diagnostics | Existing routes, aggregate scheduler, financial comparison writer and Executive Summary helper retain fractional numbers; campaign cards/goal forms, performance/recent movement, trend, executive and report formatters preserve observations | No change to attribution, currency, date windows, eligibility or formulas |
| Reports / downloads / schedules | Actual browser report handler creates real jsPDF bytes retaining credit; actual scheduled report builder prints Summary, breakdown, landing/event, KPI, Benchmark and CPA values from one saved publication | Scheduled drawing text captured in fixture; provider acceptance/inbox delivery and layout at every extreme value are not certified |
| Alerts / notifications | Actual saved-value alert resolver retains fractional observations; real notification formatter bodies preserve them; current alert rows retain NUMERIC strings | No emails sent; thresholds and alert sufficiency remain existing policy |
| Delete / disconnect / cancellation | No precision-specific destructive behavior added. Existing ownership/publication/delete/cancel regression suites are rerun; old worker invalidation must still reject writes | No live deletion, cancellation or cleanup performed |

**Recovery and exclusions:** Already rounded history cannot be repaired from rounded values. Required acceptance includes a read-only production inventory by exact owner/campaign/property/date, provider re-fetch comparison where available, and a separately reviewed repair scope. Preserve report/audit artifacts as historical evidence. `ga4-kpi-damaged-data-cleanup.ts` remains a legacy financial-window reconstruction tool, not a fractional-credit repair; its supported real-provider guard skips that repair path and it was not run. The retained `client/src/lib/ga4-client.ts` metric-fetch methods have no current caller found; `TokenExpiryWarning.tsx` uses only its token-expiry getter. Active GA4 analytics callers use the server service. Other providers' precision, demo generated counts, attribution-model experiments and standalone performance-data tables are not silently changed or certified here.

**Required deployment checks:** Before release, identify the exact deployed commit/configuration; inspect the two fact/snapshot columns and 11 observed goal columns for expected types and existing nonfinite data; measure migration lock requirements against actual table sizes; verify a provider-backed fractional publication through its saved goals/history and browser/scheduled artifact. Test restore and a compatible application rollback. An old `server/index.ts` can narrow KPI/progress columns again on restart, so rolling back to an older application without preserving the widening is unsafe once fractions are stored. Do not downcast or round data as a rollback strategy. Local transaction rollback tests are not production backup/restore proof.

**Documentation alignment:** Older count descriptions in GA4 goal documents concern whole-number goals/session counts; fractional observed GA4 credit is now an explicit exception. The type contracts keep numeric GA4 facts and string goal observations. This is a reusable precision/propagation safeguard, not authority to copy GA4 permissions, metric meanings, attribution, date windows, pagination or quotas into another provider.

**Current verification:** See the current validation boundary above and the new `validation-2026-10-21-goal-precision` evidence folder. Earlier checkpoints below are retained as dated before/after evidence, not the current completion statement.

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed fractional conversion truncation):

`analytics.ts:106,108,1448,1502,3344,3392`: parseInt discards fractional conversion credit, including campaignName event-scope supplement. Four service/helper cases:0.75→0, integer control preserved. Daily schema is INTEGER; detail paths preserve decimals. Scheduler reconciliation may reject publication, so incorrect saved publication is not inferred. Define and independently validate provider attribution/precision through daily facts, denominators and artifacts.

**Earlier provider/storage checkpoint, before the downstream correction above:** `server/analytics.ts` truncated native totals, primary/supplemental daily queries, date merges, the acquisition rebuild's zero test/supplement, comparison reports and retained metrics responses. Fractional primary credit could be mistaken for zero and replaced by different supplemental credit for that same date. Those conversion parsers now use the existing floating-number pattern; dimension filters, windows, merge keys, metric fallback and count parsing for sessions/users/event counts are unchanged. The comparison-report methods have no current route caller found; they are retained service paths, not a new UI validation entry point.

`shared/schema.ts` now uses `doublePrecision` for `ga4DailyMetrics.conversions` and `metricSnapshots.totalConversions`, retaining the existing JavaScript/JSON number contract without imposing a fixed decimal scale. `server/storage.ts` no longer rounds financial/executive snapshot conversion columns away from their already-fractional JSON inputs. Other providers' daily conversion columns are unchanged; the later migration 0026 above widens shared observed goal/history fields. The exact existing `upsertGA4DailyMetrics`, transactional `replaceGA4DailyMetricsWindow`, scoped read and snapshot methods remain in place.

**Migration:** [0025_ga4_fractional_conversions.sql](../../../migrations/0025_ga4_fractional_conversions.sql) is in `server/index.ts`'s existing transactional startup manifest, before worker registration/readiness. It widens only the two named integer columns, rejects unexpected types and skips already-widened columns on restart. The isolated database tests prove preservation of zero and the maximum prior INTEGER value, decimal round-trip, repeated execution without another table rewrite and transaction rollback to the original schema. [Actual startup tests](validation-2026-10-21-precision/startup-results.json) also exercise fresh/historical/concurrent/repeated startup and fail-closed readiness with workers/providers stubbed. A real deployment would require table locks for the first widening; production volume, lock duration and rollback are not certified by these fixtures. Do not downcast fractional rows to INTEGER or infer historical fractional credit from rounded values.

**Before/after evidence:** [Provider reproductions](validation-2026-10-21-precision/provider-before.json): 9 failures, 3 passing controls. [Storage reproductions](validation-2026-10-21-precision/storage-before.json): 3 fractional INTEGER insert failures, 1 snapshot rounding failure, 2 passing integer controls, plus 1 expected missing-migration failure before the new file existed. [First passing correction packet](validation-2026-10-21-precision/precision-first-after.json): 402 passed. [Extended packet](validation-2026-10-21-precision/precision-targeted.json): 549 passed, 1 still-open structural scheduler assertion expecting the absent `const storageStartDate =` source text; it does not invalidate the separate actual scheduler executions and is not waived.

**Additional type-widening guard:** [Three negative fixtures](validation-2026-10-21-precision/nonfinite-before.json) showed that widening alone would newly accept `Infinity`, `-Infinity` and `NaN`. The migration and shared schema now add scoped finite-value checks to both widened columns. These reject nonfinite values at the database boundary, including direct inserts; ordinary finite integer/fractional values retain their prior signs and number contract. This guard was added before considering the candidate validated. Earlier build/startup/manifest artifacts are retained as `before-finite-*`; the final checkpoint must cover the constraints too.

| Path | Current evidence and limit |
|---|---|
| Provider parsing/merges | [Actual service tests](../../../server/v1-batch3-conversion-precision.test.ts): 0, 0.75, 0.000075, 2 and 2.125; primary credit wins over supplement, unmatched dates excluded, campaign/property/currency/date contracts retained. Not live Google attribution verification. |
| Daily persistence/read/replacement | [Actual PostgreSQL tests](../../../server/v1-batch3-conversion-postgres.test.ts): fraction round-trip and numeric JSON; other campaign/property retained; invalid/wrong-scope replacement rejected; failed insert rolls back the prior fractional row. No production history rewritten. |
| Scheduler publication | [Shared-traffic tests](../../../server/ga4-shared-daily-traffic.test.ts): actual provider parsers, acquisition merge and scheduler publish 31.5 total/0.5 daily credit in both UTM-financial and event-supplement branches; detail reports/storage are controlled fixtures. Existing mismatch/ownership/deadline tests are replayed. The later correction above adds bounded floating-point reconciliation. |
| Financial denominator and snapshots | [Cumulative-financial tests](../../../server/campaign-cumulative-financials.test.ts) preserve fractional CPA denominators; actual financial/executive/aggregate snapshot columns match their JSON credit. This proves the resolver for supplied authoritative inputs, not every upstream caller. |
| Browser Overview | [Intercepted actual-page test](../../../server/ga4-publication-browser.test.ts) renders 0.75 after a publication refresh while retaining its currency/refund/stale-data checks. Authentication/provider responses are fixtures; this is not Ptomo/live acceptance. |
| Goals, reports, diagnostics and arbitrary-decimal propagation | **Incomplete at this earlier checkpoint; corrected and locally checked in the current packet above.** Wider release acceptance remains open, with [Batch 7](../v1-batch-7/README.md) owning their wider section acceptance. |

**Earlier remaining boundaries, now corrected in the forward path above:** KPI/Benchmark jobs and live/template helpers; fixed-scale observed goal/history fields; outcome/validation totals; aggregate snapshots; browser/server PDF and diagnostic count formatters; independently summed decimal reconciliation. No persisted customer history or report artifacts were repaired. The retained legacy cleanup tool still must not be used as a fractional-credit repair.

The scheduler currently compares conversion totals with exact numeric equality (`ga4-daily-scheduler.ts:519–522`). The tested binary-exact fractions do not prove arbitrary decimals summed in different orders; investigate representational error and true provider mismatches separately. Do not round provider values or relax reconciliation to hide a real attribution mismatch. Google's [traffic-source scopes](https://support.google.com/analytics/answer/11080067?hl=en) distinguish session attribution from fractional event attribution; the [metric header contract](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/MetricHeader) carries metric data types. These were rechecked for this continuation; the existing session-to-event fallback semantics and conversion/key-event provider compatibility still need independent validation.

**Historical-data and release boundary:** Widening preserves existing integers; it cannot recover credit already discarded. No production rows were inspected or repaired. A separate read-only inventory must establish affected campaign/property/date and downstream-history boundaries before any exact-provider re-fetch/repair plan. No synthetic residuals, blanket history rewrite or new source framework is authorized. The reusable lesson is to preserve provider metric types through every storage/denominator/formatting boundary; future providers need their own attribution, precision and quota validation. V1-079 forward precision paths are now verified locally as documented above; Batch 3 remains incomplete and uncommitted, and release acceptance remains OPEN.

### V1-087

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed currency-edit propagation defect):

Current Campaigns Edit sends currency415–433; API9167–9172 invalidates daily history for filter/timezone changes but omits currency. Ordinary storage698–708 retains rows, daily response9543–9606 has no currency identity, and Insights Revenue trends use current-currency formatter1502/9636. Fixture USD100 survives EUR edit and formats€100; filter/timezone controls select invalidation. Separate Overview/report currency guards remain. Enforce safe currency-edit/history semantics and test all consumers before release.

**Current correction (uncommitted):** The current `PATCH /api/campaigns/:id` includes currency changes in the existing GA4 daily/Overview invalidation decision. The existing transactional storage path removes only the edited campaign's native daily/Overview facts, invalidates old work authority and preserves monetary source/history records. Ordinary `storage.updateCampaign` also compares currency under the existing campaign lock, so a concurrent edit whose earlier route read chose the ordinary path cannot retain old native facts. Same-currency edits retain daily data. `getLatestFinancialDailySnapshot` withholds a historical snapshot whose currency differs from the current campaign; the historical row is retained, not converted.

**Additional current-code contradiction found and corrected:** The original evidence's broad reference to existing Overview currency protection was insufficient. The saved financial read and cached financial/native cards could reuse old amounts with a new formatter. `ga4-metrics.tsx` now includes campaign currency in native daily/Insights/diagnostics/breakdown/Ad Comparison/landing/event/to-date and financial snapshot query identities. Placeholder reuse requires the same campaign, property/window as applicable, and currency. The financial card additionally checks the snapshot currency. Same-currency refreshes still retain their last data with the existing stale/update indicators; a currency change withholds incompatible figures until a valid replacement exists.

**Validation:** [Real local API packet](validation-2026-10-21/timeout-currency-after.json): changed/unchanged/omitted currency and another customer's refusal. [Additional reproduction](validation-2026-10-21/currency-cancel-before.json) demonstrated missing ordinary-write invalidation, stale financial read and relabelled cached cards. [Final combined packet](validation-2026-10-21/currency-cache-final.json): 546 passed, zero skipped, including transactional rollback, another campaign, old worker rejection, history preservation, stale-route ordinary writes, same-currency preservation and actual rendered Overview cache/failure/recovery. The browser fixture intercepts every request, blocks non-fixture hosts and permits only GET; it is not a live Google or Ptomo edit.

The next [full-suite run](validation-2026-10-21/full-suite-final.json) exposed 27 in-scope test failures: 23 extracted fixtures lacked `campaignCurrency` (and some snapshot currency), and four exact-source assertions expected the pre-fix cache keys. The five affected test files now supply currency context and require currency-scoped keys; all original timing/date/property/entry-point assertions remain. The placeholder test adds explicit wrong-currency rejection. An older-date fixture also needed currency when replacing the entire nested snapshot. These diagnoses and subsequent results are retained in the failure reconciliation; the tests were not skipped or their safety expectations weakened.

**Release/data boundary:** No historical financial values will be converted or deleted by inference. Previously persisted mixed-currency daily history, if any, needs its own read-only inventory and explicit repair scope. Provider-refresh recovery in the new currency and every downstream monetary artifact remain required acceptance.

### V1-089

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed provider dispatch fan-out):

`analytics.ts:2358` unbounded per-channel Promise.all reaches12 concurrent provider calls for one Insights reader and24 for two in exact-service fixtures. Official Standard GA4 Core limit is10/property; no property queue/quota metadata request found, GA4 HTTP limiter is imported but unmounted. No real quota exhaustion or tester load claimed. Bound shared-property work and validate quota/retry/cancellation/recovery under the agreed load envelope.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-090

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed provider-quality metadata loss):

`analytics.ts:1392–1604,1732–2573,3044–3433` accepts flagged provider totals/acquisition/daily fixtures but drops sampling, other-row, truncation, metric-restriction, threshold and empty-reason metadata. Eight cases prove the service boundary; no flagged full publication or live occurrence claimed. Numeric reconciliation alone cannot recover dropped quality evidence. Define exact availability/provenance handling and validate every affected consumer.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.
