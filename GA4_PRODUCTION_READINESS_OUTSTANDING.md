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

No blocker remains inside the exact GA4 Overview boundary clean-certified on `2026-08-10`: deployed runtime `8ba694060411a2a05663a4915652767e4e3ba713`, campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, the supported 30-completed-day model, and the recorded enabled USD source set. Google Ads, obsolete campaigns, future configurations, future 60/90-day options, startup-triggered refresh, and scheduled report delivery remain outside that decision rather than silently passing.

## Latest Readiness Review

Overview-specific update on 2026-08-10:

- GA4 Overview is clean-certified and production-ready for the exact revision/configuration/data boundary above.
- The durable source of truth is `GA4/OVERVIEW_PRODUCTION_READINESS.md`.
- Native GA4 revenue was `$52,532.70 USD`; five materialized imported sources remained `$16,799.99 USD`; Total Revenue remained `$69,332.69 USD`.
- The exact target GA4 timer run, OAuth durability, enabled source identity/provenance, reviewed retained-source disposition, and deterministic/read-only reconciliation passed.
- Process-wide failures from obsolete campaigns are not represented as globally healthy and are excluded from the target certification.

Historical Overview status on 2026-07-30:

- Current Commits 1-7 were closed for their documented bounded packets; this included the exact `$400` deletion, resulting `$14,045.83` Total Spend, and post-delete inventory evidence.
- Whole-Overview Current Commits 8-10 were still open at that date. This historical status is superseded by the 2026-08-10 controlling decision.

Reviewed on 2026-05-10:

- GA4 readiness docs still list no known production blockers.
- `npm run check` passed.
- `npm run test` passed: 26 test files, 259 tests.
- No runtime code changes were required by this review.

Current conclusion:

- GA4 Overview is clean-certified and production-ready only for the exact documented revision, configuration, campaign/property, source set, and production-data state.
- Separate GA4 tabs retain their own controlling readiness status; Overview certification does not certify Reports, KPI, Benchmark, Ad Comparison, or Insights revisions.
- Any change inside the listed Overview dependency/configuration boundary invalidates the certification until reviewed.

## Broader GA4 Production Validation Outside The Certified Overview Boundary

1. Complete real GA4 validation for other properties/configurations and separately controlled tabs. The exact certified Overview fixture is already closed:
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
