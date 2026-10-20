# GA4 provider precision and attribution scope

Revision: `777aae6f6353e998d60b635d3e66b413093117c2`. Source review and deterministic provider-shaped responses; no Google API or customer data used. This extends the [query trace](GA4_QUERY_AND_VALUE_TRACE.md).

## Current provider meaning versus current implementation

Google distinguishes user-, session- and event-scoped attribution. Session/user dimensions use last-click rules; event-scoped dimensions use the selected reporting attribution model and can assign fractional credit. Their documented example includes fractional event credit. These scopes cannot be treated as interchangeable merely because campaign text matches. [Google's traffic-source scope documentation](https://support.google.com/analytics/answer/11080067?hl=en), checked2026-10-19.

The current API schema defines campaignName as event-scoped campaign information, totalUsers as distinct users, keyEvents as key-event counts and totalRevenue as revenue including refunds. The app still requests the legacy `conversions` name in many queries, with keyEvents fallback in some detail paths. This documentation check does not prove the legacy alias's availability for every live configuration; that remains a provider acceptance check. [Google Data API schema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema), checked2026-10-19.

## V1-079: conversion precision is discarded

`server/analytics.ts:3044–3428` requests session-filtered daily metrics, optionally exact page-location fallback, then a separate campaignName-filtered event-scope conversion/revenue supplement when positive-traffic rows have zero conversions or revenue. Daily parsing3344 and supplemental parsing3392 use parseInt. The shared daily financial merge106/108 also uses parseInt; total/supplemental-total parsing1448/1502 has the same pattern. Acquisition rows2521 and landing/conversion detail paths instead retain numeric fractional values. `shared/schema.ts:161` and startup `index.ts:445` declare daily conversions INTEGER.

[Four exact-code cases](ga4-conversion-precision-reproductions.json), [runner](ga4-conversion-precision-reproductions.cjs): primary conversion0.75 becomes0; event-scope supplemental0.75 becomes0; the daily merge similarly returns0; integer2 remains2. The event-scope fixture verifies that the generated supplemental filter is campaignName. This proves silent truncation for accepted provider-shaped input, not the values currently returned by a specific customer's property. The supported attribution/precision contract must preserve provider meaning or explicitly reject unsupported fractional results before presenting a successful numeric result.

## Publication and consumer boundary

The native scheduler `ga4-daily-scheduler.ts:398–436` passes the same-attempt daily series into presence checking. `analytics.ts:3434–3488` adds present dates but does not restore the discarded conversion fractions. The normalization helper `shared/ga4-insights.ts:227` accepts finite nonnegative decimal conversions; it therefore cannot detect that truncation already occurred.

There is a material downstream guard: scheduler488–535 compares daily summed conversions to acquisition and event-detail totals before `replaceGA4DailyMetricsWindow` at574. If detail totals preserve0.75 while daily facts contain0, publication fails; a full-history retry may run once, and failure preserves the previous publication. Consequently this fixture is **not** evidence that the normal scoped scheduler published a truncated value. Incorrect service output can instead make an otherwise valid property fail refresh/reconciliation. The direct time-series route13187 returns the parsed series without that publication gate. The unfiltered/retained variants, source mixtures and exact real provider response need separate acceptance. Do not weaken reconciliation to make the numbers agree.

The existing Overview Users card6857 includes a tooltip explicitly saying it sums daily users and can count the same person on several days. That currently visible contract differs from distinct-period totalUsers and is documented in code; it is not reported here as a newly proven unique-user display defect. Every other card/report/KPI label and fallback still needs its own semantic check.

The zero-triggered event-scope fallback also needs a deliberate attribution decision. A legitimate session-scope zero is not by itself proof of missing data, and event-scope credit can differ. This is a required semantic gate under V1-014/079 rather than a claim that every fallback result is wrong. Preserve exact selected campaign scope and provider semantics; compare raw query evidence, daily facts, detail rows, financial conversion denominators, targets and artifacts for every supported attribution configuration.
