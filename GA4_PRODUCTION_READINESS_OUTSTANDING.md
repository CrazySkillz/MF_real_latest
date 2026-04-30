# GA4 Production Readiness Outstanding Issues

## Fixed Production Blockers

1. GA4 connection mutation endpoints now require campaign access checks:
   - `POST /api/ga4/connect-token`
   - `POST /api/ga4/connect-service-account`
   - `POST /api/auth/ga4/connect`
   - `POST /api/ga4/oauth-exchange`
   - `POST /api/ga4/transfer-connection`

2. GA4 `Run Refresh` and its mock-refresh backend endpoint have been removed.

3. Benchmark route shadowing is narrowed so non-Meta benchmark requests pass through to canonical benchmark handlers, generic benchmark `PATCH` is supported for non-Meta records, and the active campaign benchmark GET is campaign-access protected.

## Remaining Production Blockers

1. Scheduled/server-generated GA4 standard reports do not fully match the standard report templates for KPI and Benchmark reports.

## Required Production Validation

1. Complete real GA4 validation against a live GA4 property:
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

3. Insights recommendations are rule-based and directional, not causal proof.

4. Report email timing still depends on shared scheduler/email infrastructure.
