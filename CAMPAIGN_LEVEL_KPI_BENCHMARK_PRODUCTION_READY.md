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
- [ ] Commit 2: Alert correctness. Campaign-level KPI alerts must use the same fresh connected-platform-derived current value shown in KPI cards.
- [ ] Commit 2: Alert correctness. Campaign-level Benchmark alerts must use the same fresh connected-platform-derived current value shown in Benchmark cards.
- [ ] Commit 3: Scheduler alignment. Scheduler/source-refresh jobs must refresh or reconcile campaign-level KPI and Benchmark current values after GA4, revenue, or spend data changes.
- [ ] Commit 3: Scheduler alignment. Add regression coverage proving scheduler refresh does not leave campaign-level KPI/Benchmark current values stale.
- [ ] Commit 4: Regression and final validation. Add tests proving connected-platform totals feed campaign-level KPI and Benchmark current values after source updates.
- [ ] Commit 4: Regression and final validation. Run targeted tests, `npm run check`, and `npm run build`.

## Completed

- [x] Campaign-level KPI visible cards compute current values from calculation config and connected-platform totals.
- [x] Campaign-level Benchmark visible cards and summary compute current values from calculation config and connected-platform totals.
- [x] Campaign-level KPI/Benchmark CRUD routes are separated from platform-level KPI/Benchmark routes.
- [x] Campaign-level KPI/Benchmark modals follow the connected-platform current-value pattern in create/edit flows.

## Validation Standard

Before marking this tracker complete:

- Update a connected-platform value and confirm campaign-level KPI current values change without creating a new KPI.
- Update a connected-platform value and confirm campaign-level Benchmark current values change without creating a new Benchmark.
- Confirm KPI and Benchmark alerts evaluate against the refreshed current value.
- Confirm scheduler/source refresh keeps campaign-level values aligned.
- Confirm campaign-level rows cannot be updated or deleted by platform-level routes, and platform-level rows cannot be updated or deleted by campaign-level routes.
