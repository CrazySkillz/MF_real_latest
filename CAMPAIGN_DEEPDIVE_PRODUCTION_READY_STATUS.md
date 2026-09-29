# Campaign DeepDive Production-Ready Status

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## Purpose

This file is the top-level production-readiness status for the Campaign DeepDive section.

It summarizes the current implementation status across:

- Performance Summary
- Budget & Financial Analysis
- Platform Comparison
- Trend Analysis
- Executive Summary
- Custom Report

Use this file first for the Campaign DeepDive readiness picture, then follow the linked subsection trackers for detail.

Notifications is not a Campaign DeepDive subsection or launcher. It is a global, owner-scoped main-navigation surface that aggregates active alerts across campaigns. Campaign-scoped KPI and Benchmark alerts can appear there and deep-link back to their campaign analytics cards, but their readiness, lifecycle, email, and retention contracts are controlled by `NOTIFICATIONS_CERTIFICATION_2026-09-21.md`, `APP_PRODUCTION_READINESS.md`, and `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` rather than by a Campaign DeepDive subsection certificate.

## Current Conclusion

The Campaign DeepDive architecture is mostly correct.

The implementation now follows the shared connected-source aggregate pattern: Connected Platforms is the source of truth, and Campaign DeepDive subsections consume the available metrics from connected campaign sources instead of inventing values or using disconnected platform data.

The remaining work is validation hardening and source-specific proof, not a full redesign.

Scheduler alignment update (2026-09-28): active real GA4 campaigns now use one ordered daily publication cycle for mapped financial refresh, synchronized GA4 Overview data, KPI/Benchmark recompute, Trend financial history, Performance Summary/Budget aggregate history, Executive Summary trajectory, campaign alerts, and exact-date scheduled-report readiness. A failed obsolete or unrelated campaign does not block a successfully refreshed campaign from completing its own downstream stages; the overall run still records the failure and skips the unsafe global alert sweep. Report readiness is persisted on the exact Executive Summary daily snapshot and restored after a server restart. The code default is `03:00 UTC`, subject to deployment environment overrides. This implementation change requires proportionate deployed validation and does not broaden any historical subsection certificate.

Performance Summary certification reconciliation (2026-08-26): Performance Summary is **PRODUCTION_READY** for exact certified runtime boundary `12789c1ebb92dd6a905a9f2f0f877f0bc6a90627` and its recorded GA4-only deployed configuration. GA4 traffic current values accumulate from the saved initial-import boundary through the latest completed reporting day; refreshed KPI/Benchmark current values feed Campaign Health, Top Priority Action, and Recommended Actions; Key Outcomes uses those current connected-source values; and Recent Movement alone uses exact-date historical comparisons for yesterday, seven days earlier, and the same calendar date one month earlier. Render deployed evidence-only commit `e175ac5c` without production runtime changes, preserving the certified runtime. Exact values, focused validation, deployed evidence, and exclusions are recorded in `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_PRODUCTION_READY.md`.

Performance Summary current-runtime reconciliation (2026-09-29): deployed runtime `1e066496567f6a81535473373d63da9910be153f` has a bounded authenticated, read-only Campaign3 pass for the aligned `2026-09-28` cutoff. Key Outcomes, Campaign Health, Top Priority Action, Recommended Actions, and all three Recent Movement selections reconciled to their page-consumed APIs and source totals. The previous completed day resolved to `2026-09-27`, seven completed days earlier to `2026-09-21`, and the previous-month cutoff to `2026-08-28`; every required exact-date endpoint returned HTTP 200. The run produced no JavaScript page errors or application writes and left the relevant persistence fingerprint unchanged. Instagram and TikTok were not configured for Campaign3 and contributed no values. This is not a whole-section recertification: failure and stale states, other campaign/source configurations, lifecycle and tenant-isolation paths, and scheduled-PDF parity remain open. Exact values and the current source-contract corrections are recorded in `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_PRODUCTION_READY.md`.

Budget & Financial Analysis reconciliation (2026-09-27): deployed revision
`39fe902a6b94c461ff26fe2181806b35d7f4100e` renders one executive financial page
rather than multiple visible tabs. Financial
Position, conditional Paid Media Efficiency, Allocation & Sources, and return/source
guidance consume the cumulative aggregate and financial provenance. Budget Position,
burn, pacing, budget guidance, and Budget report equivalents additionally consume the
separate `budget_pacing_v1` Spend derivative introduced at `4298cfda`, containing only
verified dated Spend inside the selected budget period. Budget dates do not filter
aggregate Revenue, Total Spend, Profit, ROI, ROAS, CPA, or provenance. Campaign3 browser
facts, page-consumed API values, formulas, and rendered values passed an authenticated
read-only reconciliation on the exact deployed revision; the focused financial suite
passed 61/61 tests and TypeScript passed. Other source families, metadata mutation and
tenant-isolation gates, plus deployed Budget report recertification remain open; the
2026-09-19 certificate is historical.

Trend Analysis reconciliation (updated 2026-09-27): the historical certified runtime
`7dc72dc8` (deployed within documentation-only successor `59526846`) rendered one
comprehensive Executive View rather than five visible tabs. The current GA4-only view
retains that structure, but later scheduler-only daily-read, current-value fallback,
exact-date financial derivation, fixed-layout, CPA-color, no-activity-copy,
anomaly-warning, and verified-currency changes require renewed whole-page certification. GA4-only
traffic totals remain cumulative from the saved initial-import boundary through the
latest completed reporting day. The browser defaults to 7 days; its `7/14/30/90-day` selector changes exact cumulative
comparison dates and chart windows, not the current totals. The current browser accepts
only complete scheduler-stored daily windows and uses scheduler-written zero rows for
completed no-activity dates; it does not create zeros or call live GA4 coverage. Browser
and scheduled Trend report consumers expose one `Executive View`,
normalize legacy Trend selections, and use exact calendar dates within the authoritative
GA4 boundary; the shared PDF renderer uses its separate fixed 30-day window. The current
contract and evidence status are recorded in `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`;
`CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_CERTIFICATION_2026-09-20.md` is historical. Deployed
revision `9393d9de` has bounded Campaign3 UI evidence for the current financial values
and reconciled EUR ROAS guidance; it is not a replacement whole-section certificate.

Custom Report reconciliation (2026-08-28): Campaign DeepDive -> Custom Report is
**PRODUCTION_READY** for the GA4-first scope at deployed runtime commit
`41ec6015b4aae0090e834294a5355c06fbccaa34`. Production evidence covers campaign/client/
owner/platform isolation, create/edit/delete, schedule/reschedule/disable, browser and
scheduled immutable PDFs, selected-section body content, scheduler deduplication,
Mailgun delivery confirmation, inbox receipt, and accurate send bookkeeping. Disabled or
unconfigured Google Ads, Meta, Instagram, TikTok, future source mixes, and other email
providers are not certified by this evidence. Exact values and artifact hashes are in
`CAMPAIGN_DEEPDIVE_CUSTOM_REPORT_PRODUCTION_READY.md`.

## Current Implementation And Certification Status

Do not use this top-level file as a whole-Campaign-DeepDive production certification. Each subsection and source remains bounded by its own exact-SHA readiness evidence. The latest preserved Performance Summary certificate applies only to exact runtime `ee6e11eb` and its recorded scope; earlier runtime `12789c1e` remains historical evidence. Deployed runtime `1e066496` has a bounded Campaign3 `2026-09-28` pass covering all three Recent Movement options and remains `RECERTIFICATION_PENDING` for the whole section; other source mixes do not inherit that evidence.

Trend Analysis is **RECERTIFICATION_PENDING** for the current implementation. Its bounded PASS remains historical evidence only for the exact GA4-first `Campaign2` runtime recorded in `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_CERTIFICATION_2026-09-20.md`. Current focused tests, a dated read-only `Campaign3` check, and bounded deployed Campaign3 UI evidence at `9393d9de` are recorded in `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`; they do not replace whole-section certification. Future/refined source mixes still require their own source-specific proof.

The remaining source-specific validation items can wait until future/refined live/deployed integration evidence is available. LinkedIn source-specific validation passed on 2026-05-31 and is tracked in `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md`. Google Ads local source-specific validation passed through Commit 29 on 2026-06-04 and is tracked in `GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md`. Meta/Facebook local source-specific code/test validation and Commit 15 browser smoke passed on 2026-06-04 and are tracked in `META_FACEBOOK_CONNECTED_PLATFORM_PRODUCTION_READY.md`; Commit 18 browser validation, live OAuth, and deployed scheduled-report evidence remain separate. Instagram Commit 1 documentation validation and Commit 2 API/source-contract validation passed, Commit 3 schema/storage foundation is implemented, Commit 4A-4F backend-only contract work is pushed and validation passed, Commit 5A Create Campaign option, Commit 5B test setup path, Commit 5C finalization guard, Commit 5D query invalidation, and Commit 5E Create Campaign closeout validation passed by connecting to the Instagram test account. Instagram Commit 6A Connected Platforms backend status, Commit 6B card shell, Commit 6C add-source setup, Commit 6D state/invalidation, and Commit 6E Connected Platforms closeout validation passed by connecting to the Instagram test account; Commit 6F Connected Platforms disconnect UI mapping validation passed by disconnecting Instagram from Connected Platforms; Commit 7A Campaign Overview source-status boundary, Commit 7B unavailable metric state, Commit 7C source-backed daily-row metric read, and Commit 7D Campaign Overview validation closeout passed by connecting to the Instagram test account; Commit 8A Instagram analytics route shell, Commit 8B daily metrics endpoint, Commit 8C Overview tab, Commit 8D Campaign Breakdown tab, Commit 8E unavailable/error/freshness states, and Commit 8F guarded analytics link/validation closeout validation passed by connecting to the Instagram test account; Commit 9A Instagram aggregate source builder, Commit 9B aggregate source composition, Commit 9C Meta/Facebook plus Instagram no-double-counting guard, Commit 9D Campaign DeepDive aggregate route wiring, and Commit 9E aggregate validation closeout validation passed by connecting to the Instagram test account; Commit 10A Instagram financial platform-context allowlist, Commit 10B spend source identity guard, Commit 10C revenue source identity guard, and Commit 10D revenue/spend validation closeout validation passed by connecting to the Instagram test account and running focused regression checks; Commit 11A-11F refresh and scheduler foundation validation passed through `npm run check` plus the focused regression suite; Commit 12A-12F validation passed for lifecycle, test data, core metrics, and Campaign DeepDive source-backed inclusion; Commit 13A Instagram KPI current-value source contract, Commit 13B Instagram Benchmark current-value source contract, Commit 13C Instagram analytics tab shell cleanup, Commit 13D Instagram KPI tab management UI parity, Commit 13E Instagram test-mode missing daily-row self-heal, Commit 13F Instagram Create KPI modal parity, Commit 13G Instagram Create KPI modal input constraints, Commit 13H Instagram analytics connection loading-state stability, Commit 13I Instagram Overview metrics loading-state stability, Commit 13J Instagram Benchmark tab management UI parity, Commit 13K Instagram Ad Comparison selected-campaign UI parity, and Commit 13L Instagram Insights tab source-backed UI parity are pushed with user validation pending; Commit 13M Instagram Insights missing-data and revenue-readiness guidance is implemented locally; the startup migration correction for Commit 5C is pushed, and source-specific planning is tracked in `INSTAGRAM_CONNECTED_PLATFORM_PRODUCTION_READY.md`.

Instagram revenue import is now explicitly planned as Commit 13N-A through 13N-E before report work and before Commit 14 final validation, because final Instagram production-readiness evidence should include the same explicit, source-scoped revenue attribution path proven for LinkedIn. Commit 13N-A shared revenue wizard Instagram context foundation, Commit 13N-B Instagram Overview revenue source controls, and Commit 13N-C Instagram Overview financial metrics are done, pushed, and user-validated. Commit 13N-D Instagram KPI/Benchmark/Insights revenue current values and Commit 13N-E revenue lifecycle invalidation/regression closeout are implemented locally with user validation pending.

LinkedIn refinement is tracked separately in `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md`. That tracker records the source-specific acceptance proof for LinkedIn through both the Create Campaign flow and the campaign Connected Platforms add-source flow. LinkedIn revenue-import validation is complete in `LINKEDIN_REVENUE_IMPORT_PRODUCTION_READY.md`.

## Pre-Google Ads Handoff

LinkedIn is validated as production-ready for the current supported implementation scope before Google Ads refinement began.

- LinkedIn is not an open Campaign DeepDive blocker.
- LinkedIn should remain the reference pattern for source-scoped paid-media aggregation, unavailable-metric handling, disconnect/reconnect cleanup, and attributed-revenue isolation.
- Google Ads local refinement is tracked separately in `GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md` and has passed local source-specific proof through Commit 29.
- Do not treat the Google Ads live OAuth path as production-ready until deployed or production-like OAuth connect/select/refresh evidence is recorded.

## Remaining Cross-Section And Future-Source Validation Items

These items do not reopen the bounded Performance Summary certification above.
They belong to other subsection boundaries or to source mixes that were not part
of the certified GA4-only Performance Summary packet.

### 1. Trend Analysis Current Revalidation And Future Sources

Status: **RECERTIFICATION_PENDING** for the current GA4-first Trend implementation. The exact audited boundary at application runtime `7dc72dc8` remains a historical bounded PASS; future/refined main-source mixes remain separate source-specific work. The earlier `cd35bba1` boundary is also historical.

Current regression, read-only, and bounded deployed UI evidence:

- current values use the fixed initial-import boundary through the latest completed reporting day
- all `7/14/30/90-day` selections use exact comparison dates and exact calendar chart windows
- current financial values prefer a compatible snapshot and otherwise use authoritative persisted performance-summary totals
- exact financial comparison prefers a compatible snapshot and can use the existing scoped read-only GA4/source derivation; an unreconstructable baseline fails closed without hiding the current value
- verified GA4 report currency is saved in the Overview snapshot and is required for reconciled ROAS guidance
- complete scheduler-stored daily windows are required; scheduler-written no-activity dates remain explicit zeros
- the mounted page makes no live GA4 coverage request and does not manufacture missing dates
- browser and scheduled report consumers normalize legacy selections to one Executive View

Still required for a new source mix:

- prove each added main source's scope, capabilities, daily rows, currency, freshness, derived metrics, and missing-data behavior
- repeat live UI, report, snapshot, and downstream parity for that exact source mix

### 2. Multi-Source Deployed Validation

Status: LinkedIn validation passed on 2026-05-31; Google Ads local/test-mode validation passed on 2026-06-04; Meta/Facebook local code/test validation and Commit 15 browser smoke passed on 2026-06-04; Meta Commit 18 browser validation, future/refined source mixes, Google Ads live OAuth evidence, and Meta live OAuth evidence remain source-specific validation work.

Why it remains open:

- The shared aggregate contract is designed to accept future/refined main Connected Platforms.
- A source such as Instagram, TikTok, or another future/refined integration still needs its own source-level readiness proof before its values can be trusted. Google Ads and Meta have local/test-mode source proof recorded, but live OAuth still needs deployed or production-like evidence.
- LinkedIn has its source-specific validation recorded in `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md`.

When to complete:

- After integrations such as TikTok or other future/refined sources are connected through Connected Platforms, or after Google Ads/Meta live OAuth is validated in a deployed or production-like environment.
- For LinkedIn specifically, use `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md` as the completed source-specific validation record.

Expected proof:

- `/api/campaigns/:campaignId/outcome-totals` returns each connected main source once in `performanceSummary.sources`.
- Each source contributes only metrics it actually supports.
- Financial child inputs remain child inputs and do not appear as separate main platforms.
- Performance Summary, Budget & Financial Analysis, Platform Comparison, Executive Summary, Trend Analysis, and Custom Report consume the same connected-source source mix where applicable.
- No subsection falls back to stale, disconnected, hardcoded, or zero-filled platform values.

### 3. Scheduled Custom Report Email Evidence

Status: completed for the GA4-first scope on 2026-08-28 at deployed runtime commit
`41ec6015b4aae0090e834294a5355c06fbccaa34`.

Proven:

- one due scheduled key produced exactly one send event and one linked immutable snapshot
- the attached PDF contained real selected-section body content and current aggregate values
- the scheduled attachment exactly matched its stored snapshot artifact
- Mailgun recorded `delivery_status=delivered` with provider response and delivery timestamps
- the user confirmed inbox receipt at the only authorized recipient
- the original report schedule was restored and `lastSentAt` remained accurate

Boundary:

- provider acceptance alone was not treated as delivery
- the evidence applies only to the tested GA4-first source mix and configured Mailgun path
- future source mixes and other email providers require their own evidence

## Subsection Status Map

| Subsection | Current status | Source-of-truth path | Remaining item |
| --- | --- | --- | --- |
| Performance Summary | **BOUNDED CAMPAIGN3 PASS / RECERTIFICATION_PENDING** at deployed `1e066496`; prior exact-runtime certificates preserved as historical | `/api/campaigns/:campaignId/outcome-totals` -> `performanceSummary`, aligned cumulative GA4 Summary inputs, exact-cutoff native/imported Revenue and Spend, refreshed KPI/Benchmark targets, and exact-date Recent Movement reads | Campaign3's `2026-09-28` current view and all three Recent Movement selections are reconciled; Instagram and TikTok were not configured and are outside this evidence; validate negative states, other campaign/source mixes, lifecycle and tenant isolation, and current scheduled-PDF parity |
| Budget & Financial Analysis | **BOUNDED CURRENT-REVISION PASS / RECERTIFICATION_PENDING** at deployed `39fe902a...`; prior exact-runtime certificate preserved as historical | `/api/campaigns/:campaignId/outcome-totals` -> `performanceSummary`, `financialInputs`, and compatible `budgetPacing`, plus campaign `budget`, `pacingStartDate`, and `pacingEndDate` | Campaign3's configured visible page is reconciled; validate other source families, metadata mutation and tenant isolation, then recertify deployed one-off/snapshot/scheduled Budget report parity |
| Platform Comparison | Production-ready locally and Render-validated for GA4-only | `/api/campaigns/:campaignId/outcome-totals` -> `performanceSummary.sources` | Live multi-platform validation |
| Trend Analysis | **RECERTIFICATION_PENDING** for the current implementation; the `7dc72dc8` `Campaign2` certificate is historical; `9393d9de` has bounded Campaign3 UI evidence | read-only `/ga4-daily` scheduler history + persisted-only `/outcome-totals.performanceSummary` + exact-date financial snapshot/read-only derivation + `/trend-analysis` daily aggregate; no live coverage request | Complete whole-page certification for the current combined GA4-first revision; repeat source-specific validation for future/refined main-source mixes; positive paid-media and multi-source panels remain unverified |
| Executive Summary | **RECERTIFICATION_PENDING** for the current Marketing Funnel and Recommended Actions presentation; prior exact-runtime certificate preserved as historical | `/api/campaigns/:campaignId/executive-summary` plus `/outcome-totals` | Revalidate the current combined page, Bottom of Funnel, and Recommended Actions after the duplicate-card, Benchmark-copy, scope-note, and category-subtitle changes; data/formula/eligibility/report paths are unchanged; future source mixes retain source-specific gates |
| Custom Report | **RECERTIFICATION_PENDING** for the changed Budget report value path; prior GA4-first runtime evidence preserved as historical | `/reports?campaignId=...`, `/outcome-totals` including `budgetPacing`, immutable report snapshots, scheduled delivery audit | Recertify current deployed Budget one-off/snapshot/scheduled artifact and delivery parity; revalidate future/refined source mixes or other email providers |

## Future Integration Rule

As more integrations are added in Connected Platforms, Campaign DeepDive should aggregate their data only after each integration supplies the shared contract inputs:

- campaign-scoped source identity
- source label and category
- capabilities
- included metrics
- excluded metrics and unavailable reasons
- current metric totals
- freshness metadata
- scheduler snapshot inputs where historical or scheduled sections depend on them
- regression coverage
- deployed validation evidence for the tested source mix

New integrations should not require a Campaign DeepDive redesign. They should enter through the existing connected-source aggregate contract. Google Ads local/test-mode validation against this rule is tracked in `GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md`; Meta/Facebook local/test-mode validation is tracked in `META_FACEBOOK_CONNECTED_PLATFORM_PRODUCTION_READY.md`; Instagram planning and future validation are tracked in `INSTAGRAM_CONNECTED_PLATFORM_PRODUCTION_READY.md`. Live OAuth evidence remains separate.

## Relevant Documentation

- `AGENTS.md`
- `ARCHITECTURE_USER_JOURNEY.md`
- `GA4/README.md`
- `GA4/REPORTS.md`
- `GA4_DEVELOPMENT_WORKFLOW.md`
- `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_BUDGET_FINANCIAL_ANALYSIS_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_PLATFORM_COMPARISON_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_CUSTOM_REPORT_PRODUCTION_READY.md`
- `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `META_FACEBOOK_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `INSTAGRAM_CONNECTED_PLATFORM_PRODUCTION_READY.md`

## Relevant Implementation Files

- `server/routes-oauth.ts`
- `server/utils/performance-summary-aggregate.ts`
- `server/utils/trend-analysis-aggregate.ts`
- `server/report-scheduler.ts`
- `client/src/pages/campaign-performance.tsx`
- `client/src/pages/financial-analysis.tsx`
- `client/src/pages/platform-comparison.tsx`
- `client/src/pages/trend-analysis.tsx`
- `client/src/pages/executive-summary.tsx`
- `client/src/pages/reports.tsx`

## Relevant Regression Files

- `server/performance-summary-aggregate.test.ts`
- `server/campaign-performance-overview-regression.test.ts`
- `server/campaign-financial-analysis-regression.test.ts`
- `server/platform-comparison-regression.test.ts`
- `server/trend-analysis-aggregate.test.ts`
- `server/trend-analysis-overview-regression.test.ts`
- `server/executive-summary-regression.test.ts`
- `server/executive-summary-helpers-regression.test.ts`
- `server/custom-report-regression.test.ts`
- `server/performance-summary-scheduler-regression.test.ts`

## Historical Local Validation

Passed locally on 2026-05-30:

- `npm test -- server/campaign-financial-analysis-regression.test.ts`
- `npm test -- server/performance-summary-aggregate.test.ts server/campaign-performance-overview-regression.test.ts server/campaign-financial-analysis-regression.test.ts server/platform-comparison-regression.test.ts server/trend-analysis-aggregate.test.ts server/trend-analysis-overview-regression.test.ts server/executive-summary-regression.test.ts server/executive-summary-helpers-regression.test.ts server/custom-report-regression.test.ts server/performance-summary-scheduler-regression.test.ts`
- `npm run check`
- `git diff --check`

Meta/Facebook source-specific final regression passed locally on 2026-06-04:

- `npm test -- server/meta-production-regression.test.ts server/performance-summary-aggregate.test.ts server/performance-summary-scheduler-regression.test.ts server/source-safety-regression.test.ts server/trend-analysis-aggregate.test.ts server/trend-analysis-overview-regression.test.ts server/executive-summary-regression.test.ts server/executive-summary-helpers-regression.test.ts server/platform-comparison-regression.test.ts server/custom-report-regression.test.ts server/report-email-regression.test.ts server/kpi-route-isolation-regression.test.ts server/benchmark-route-isolation-regression.test.ts server/linkedin-connected-platform-flow-regression.test.ts server/linkedin-create-campaign-flow-regression.test.ts server/linkedin-disconnect-regression.test.ts server/linkedin-revenue-isolation.test.ts server/linkedin-scheduler-regression.test.ts server/google-ads-production-regression.test.ts server/google-ads-report-regression.test.ts server/google-ads-revenue-platform-context.test.ts server/google-ads-revenue-overview-ui.test.ts server/google-ads-revenue-kpi-benchmark-ui.test.ts server/google-ads-revenue-scheduler-flow.test.ts server/ga4-auto-refresh-regression.test.ts server/ga4-financial-rules.test.ts server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts`

## Final Readiness Statement

The current Campaign DeepDive implementation is architecturally aligned with the connected-source aggregate pattern.

This statement describes architectural and implementation alignment only. It is not a current whole-section production-ready certification.

The remaining work is source-specific deployed validation for Google Ads live OAuth,
Meta live OAuth, and future/refined integrations such as TikTok. The GA4-first Custom
Report scheduled-delivery evidence is complete and is not an open item.

These are validation and source-readiness tasks. They do not require a Campaign DeepDive redesign unless a future integration fails the shared aggregate contract.

## 2026-07-30 Historical Commit 10 Status — Superseded For Trend Analysis

Commit `ec265895` deployed the downstream parity correction. On existing campaign `GA4 single` / `ga4_mock`, Performance Summary Total Spend matched GA4 Overview Total Spend, and Budget & Financial Analysis → ROI & ROAS Total Revenue matched GA4 Overview Total Revenue. Scheduled/manual Campaign DeepDive aggregates follow the ordered connected-source GA4 financial contract, explicit GA4 financial-source context, valid-zero/negative ROAS/ROI semantics, and `performance_summary_aggregate_v2` compatibility. This historical packet was later superseded for Performance Summary by the exact `12789c1e` certification record; its exclusions remain historical context and do not override the current bounded Performance Summary status.
