# GA4 Production Readiness Outstanding Issues


## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## Fixed Production Blockers

1. GA4 connection mutation endpoints now require campaign access checks:
   - `POST /api/ga4/connect-token`
   - `POST /api/ga4/connect-service-account`
   - `POST /api/auth/ga4/connect`
   - `POST /api/ga4/oauth-exchange`
   - `POST /api/ga4/transfer-connection`

2. GA4 `Run Refresh` and its mock-refresh backend endpoint have been removed.

3. Benchmark route shadowing is narrowed so non-Meta benchmark requests pass through to canonical benchmark handlers, generic benchmark `PATCH` is supported for non-Meta records, and the active campaign benchmark GET is campaign-access protected.

4. Scheduled/server-generated GA4 standard KPI and Benchmark reports now render their KPI/Benchmark sections instead of only rendering those sections for custom reports.

## Remaining Production Blockers

None currently listed from the production-readiness scan. Continue with the required production validation below.

## Latest Readiness Review

Overview-specific update on 2026-06-28:

- GA4 Overview is production-ready for the current GA4 code scope.
- The durable source of truth is `GA4/OVERVIEW_PRODUCTION_READINESS.md`.
- Remaining Overview caveats are deployed/provider validation gates, not known local code blockers.

Reviewed on 2026-05-10:

- GA4 readiness docs still list no known production blockers.
- `npm run check` passed.
- `npm run test` passed: 26 test files, 259 tests.
- No runtime code changes were required by this review.

Current conclusion:

- GA4 Overview is production-ready for the current GA4 code scope.
- GA4 is ready for final real-account validation.
- This does not replace the required deployed validation against live GA4, scheduler, revenue/spend sources, and scheduled report delivery.

## Required Production Validation

1. Complete real GA4 validation against a live GA4 property. This is deployed/provider evidence, not a known local Overview code blocker:
   - campaign creation
   - OAuth connect
   - property selection
   - campaign-value selection
   - Overview
   - KPIs
   - Benchmarks
   - Ad Comparison
   - Insights
   - Reports

2. Validate deployed scheduler behavior:
   - GA4 daily refresh
   - external revenue/spend refresh
   - KPI recompute
   - Benchmark recompute
   - report generation and email attachment delivery

## Documented Limitations To Accept Or Improve Later

1. GA4 refresh is split across multiple jobs rather than one consolidated GA4 orchestrator.

2. Ad Comparison is currently campaign-row comparison, not true ad/creative-level analytics.

3. Insights use a rule-based engine. UI/report copy now frames outputs as recommended checks, not causal proof.

4. Report email timing still depends on shared scheduler/email infrastructure.

5. The production build still reports large frontend chunks.
   Mitigation completed: large route pages are lazy-loaded from `client/src/App.tsx`, which reduced the main app chunk from about 2.46 MB to about 729 KB without changing analytics/page internals.
   Validation completed: `npm run check`, `npm run build`, `npm run test`, and post-deploy route smoke testing passed for Home, Campaigns, Campaign Detail, GA4, LinkedIn, Meta, Google Ads, Google Sheets, Reports, and Notifications.
   Remaining warning: Vite still reports chunks over 500 KB, mainly the reduced app entry plus `charts-vendor` and `pdf-vendor`.
   Future chunk work should be optional and separate from GA4/template integration work. Do not mix it with analytics logic, platform page refactors, source-flow changes, or chart/report behavior changes.
