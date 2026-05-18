# Campaign-Level KPI/Benchmark Production Ready Tracker

## Purpose

Track the remaining production-readiness work for campaign-level KPIs and Benchmarks.

This is campaign-level architecture, not GA4-specific architecture. GA4 is the first connected platform being validated against this standard. LinkedIn, Meta, Google Ads, Google Sheets, Custom Integration, and future integrations must follow the same campaign-level rules.

## Source-Of-Truth Rule

Campaign-level KPI and Benchmark current values must be fed by connected-platform metrics for the campaign.

For a GA4-only campaign, campaign-level current values must match the connected GA4/campaign financial values already shown in the campaign and GA4 detail views:

- `Revenue` uses Total Revenue.
- `Conversions` uses Total Conversions.
- `Users` uses Total Users.
- `Sessions` uses Total Sessions.
- `Conversion Rate` uses Total Conversions and Total Sessions.
- `ROAS` and `ROI` use Total Revenue and Total Spend.
- `CPA` uses Total Spend and Total Conversions.

When connected-platform values change, campaign-level KPI and Benchmark current values must update from those connected-platform values. Do not add a separate selectable-source model or fallback path that can drift from connected-platform metrics.

## Outstanding Production-Ready Tasks

- [x] Commit 1: Visible Benchmark correctness. Campaign-level Benchmark cards and summary must compute current values from connected-platform totals, not stale saved `currentValue`.
- [x] Commit 2: Alert correctness. Campaign-level KPI alerts must use the same fresh connected-platform-derived current value shown in KPI cards.
- [x] Commit 2: Alert correctness. Campaign-level Benchmark alerts must use the same fresh connected-platform-derived current value shown in Benchmark cards.
- [x] Commit 3: Scheduler alignment. Scheduler/source-refresh jobs must refresh or reconcile campaign-level KPI and Benchmark current values after GA4, revenue, or spend data changes.
- [x] Commit 3: Scheduler alignment. Add regression coverage proving scheduler refresh does not leave campaign-level KPI/Benchmark current values stale.
- [ ] Commit 4: Regression and final validation. Add tests proving connected-platform totals feed campaign-level KPI and Benchmark current values after source updates.
- [ ] Commit 4: Regression and final validation. Run targeted tests, `npm run check`, and `npm run build`.

## Completed

- [x] Campaign-level KPI visible cards compute current values from calculation config and connected-platform totals.
- [x] Campaign-level Benchmark visible cards and summary compute current values from calculation config and connected-platform totals.
- [x] Campaign-level KPI and Benchmark alert checks resolve current values from connected-platform totals before evaluating thresholds.
- [x] GA4 scheduler/source-refresh recompute paths reconcile persisted campaign-level KPI and Benchmark current values from connected-platform totals.
- [x] Campaign-level KPI/Benchmark CRUD routes are separated from platform-level KPI/Benchmark routes.
- [x] Campaign-level KPI/Benchmark modals follow the connected-platform current-value pattern in create/edit flows.

## Alert Correctness Root Cause

Campaign-level cards calculate current values from `calculationConfig` and connected-platform totals, but alert jobs previously evaluated the persisted `currentValue` field directly. That could make an alert fire, suppress, or display a value that did not match the campaign KPI/Benchmark card after connected GA4, revenue, or spend data changed.

Campaign-level KPI and Benchmark alert jobs must resolve the fresh connected-platform-derived current value before threshold evaluation. Platform-level KPI/Benchmark alerts must keep their existing platform-specific value path.

## Scheduler Alignment Root Cause

The shared GA4 downstream recompute job was already called after GA4 daily refresh, on-demand GA4 refresh, scheduled report pre-send refresh, and external revenue/spend source auto-refresh. That job refreshed platform-level GA4 KPI and Benchmark persisted `currentValue` fields, but it did not reconcile campaign-level KPI and Benchmark rows. Campaign-level cards and alerts could therefore show fresh connected-platform-derived values while the persisted campaign-level `currentValue` fields remained stale after scheduler/source-refresh changes.

The fix keeps scheduler ownership in the existing GA4 recompute path and adds a campaign-level reconciliation step that updates only campaign-level KPI and Benchmark rows with `calculationConfig`, using the same connected-platform total resolver as the alert path.

## Validation Standard

Before marking this tracker complete:

- Update a connected-platform value and confirm campaign-level KPI current values change without creating a new KPI.
- Update a connected-platform value and confirm campaign-level Benchmark current values change without creating a new Benchmark.
- Confirm KPI and Benchmark alerts evaluate against the refreshed current value.
- Confirm scheduler/source refresh keeps campaign-level values aligned.
- Confirm campaign-level rows cannot be updated or deleted by platform-level routes, and platform-level rows cannot be updated or deleted by campaign-level routes.
