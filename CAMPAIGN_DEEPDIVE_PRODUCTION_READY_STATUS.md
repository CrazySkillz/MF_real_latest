# Campaign DeepDive Production-Ready Status

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

## Current Conclusion

The Campaign DeepDive architecture is mostly correct.

The implementation now follows the shared connected-source aggregate pattern: Connected Platforms is the source of truth, and Campaign DeepDive subsections consume the available metrics from connected campaign sources instead of inventing values or using disconnected platform data.

The remaining work is validation hardening and source-specific proof, not a full redesign.

## Current Production-Ready Status

Campaign DeepDive is production-ready locally for the implemented connected-source aggregate contract and the current GA4/current-source scope, with the outstanding validation items below.

The remaining items can wait until mock-live historical data and refined integrations such as LinkedIn or Meta are available.

LinkedIn refinement is tracked separately in `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md`. That tracker is the source-specific acceptance plan for bringing LinkedIn to the same production standard as GA4 through both the Create Campaign flow and the campaign Connected Platforms add-source flow.

## Outstanding Validation Items

### 1. Trend Analysis Historical Validation

Status: pending mock-live historical data.

Why it remains open:

- Trend Analysis depends on historical daily rows and compatible aggregate snapshots.
- Current code wiring and regression coverage prove the aggregate path, but full historical accuracy requires controlled daily data across multiple days.

When to complete:

- After connecting a mock-live GA4 account or other controlled source with enough daily history.

Expected proof:

- Trend Analysis uses only connected-source metrics.
- Day-over-day, 7-day, and longer trend comparisons use compatible `trend_analysis_aggregate_v1` data.
- GA4-only campaigns show GA4-capable trend metrics only.
- Paid-media trend metrics remain unavailable until a connected paid-media source supplies them.

### 2. Multi-Source Deployed Validation

Status: pending refined multi-source integrations.

Why it remains open:

- The shared aggregate contract is designed to accept future/refined main Connected Platforms.
- A source such as LinkedIn, Meta, Google Ads, TikTok, or another integration still needs its own source-level readiness proof before its values can be trusted.

When to complete:

- After integrations such as LinkedIn or Meta are refined and connected through Connected Platforms.
- For LinkedIn specifically, follow `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md` before treating LinkedIn values as production-ready connected-source inputs.

Expected proof:

- `/api/campaigns/:campaignId/outcome-totals` returns each connected main source once in `performanceSummary.sources`.
- Each source contributes only metrics it actually supports.
- Financial child inputs remain child inputs and do not appear as separate main platforms.
- Performance Summary, Budget & Financial Analysis, Platform Comparison, Executive Summary, Trend Analysis, and Custom Report consume the same connected-source source mix where applicable.
- No subsection falls back to stale, disconnected, hardcoded, or zero-filled platform values.

### 3. Scheduled Custom Report Email Evidence

Status: pending real scheduled send evidence.

Why it remains open:

- Local implementation and regression coverage prove scheduled Campaign DeepDive PDF body rendering.
- Actual scheduled email delivery depends on deployed runtime email infrastructure.
- Provider acceptance is not the same as inbox receipt.

When to complete:

- This can be completed now with GA4-only data, or later after LinkedIn/Meta are added.
- If completed after another integration is added, the evidence proves that exact connected-source mix.

Expected proof:

- Create a scheduled Campaign DeepDive Custom Report.
- Select known Campaign DeepDive report type and tabs.
- Wait for the saved scheduled time in the saved browser time zone.
- Confirm the email is received by the configured recipient.
- Confirm the attached PDF includes selected section body content, not just section names.
- Confirm PDF values match the current app values at send time.
- Record the connected-source mix active at send time, such as GA4-only or GA4 + LinkedIn.

## Subsection Status Map

| Subsection | Current status | Source-of-truth path | Remaining item |
| --- | --- | --- | --- |
| Performance Summary | Production-ready locally for the registered aggregate path and future `platformSources` contract | `/api/campaigns/:campaignId/outcome-totals` -> `performanceSummary` | Future source-specific validation when new integrations are refined |
| Budget & Financial Analysis | Production-ready locally after regression correction | `/api/campaigns/:campaignId/outcome-totals` -> `performanceSummary` plus campaign budget/start/end metadata | Live/source-refresh validation as real integrations are exercised |
| Platform Comparison | Production-ready locally and Render-validated for GA4-only | `/api/campaigns/:campaignId/outcome-totals` -> `performanceSummary.sources` | Live multi-platform validation |
| Trend Analysis | Aggregate-backed locally; historical accuracy validation pending | `/api/campaigns/:campaignId/trend-analysis` -> `trend_analysis_aggregate_v1` | Mock-live historical data validation |
| Executive Summary | Production-ready locally as an aggregate consumer | `/api/campaigns/:campaignId/executive-summary` plus `/outcome-totals` | Future source-mix deployed validation and source-specific acceptance gates |
| Custom Report | Production-ready locally for browser/PDF composition | `/reports?campaignId=...`, `/outcome-totals`, `/executive-summary`, `/trend-analysis` | Real scheduled email evidence |

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

New integrations should not require a Campaign DeepDive redesign. They should enter through the existing connected-source aggregate contract.

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

## Latest Local Validation

Passed locally on 2026-05-30:

- `npm test -- server/campaign-financial-analysis-regression.test.ts`
- `npm test -- server/performance-summary-aggregate.test.ts server/campaign-performance-overview-regression.test.ts server/campaign-financial-analysis-regression.test.ts server/platform-comparison-regression.test.ts server/trend-analysis-aggregate.test.ts server/trend-analysis-overview-regression.test.ts server/executive-summary-regression.test.ts server/executive-summary-helpers-regression.test.ts server/custom-report-regression.test.ts server/performance-summary-scheduler-regression.test.ts`
- `npm run check`
- `git diff --check`

## Final Readiness Statement

The current Campaign DeepDive implementation is architecturally aligned with the connected-source aggregate pattern.

The remaining work is:

1. historical validation for Trend Analysis,
2. deployed multi-source validation after integrations such as LinkedIn or Meta are refined,
3. deployed scheduled Custom Report email evidence.

These are validation and source-readiness tasks. They do not require a Campaign DeepDive redesign unless a future integration fails the shared aggregate contract.
