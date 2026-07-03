# GA4 Overview Validation Runner

## Purpose

`client/public/ga4-overview-validation-runner.js` is a validation-only browser helper for GA4 Overview readiness evidence packets.

It standardizes the repeated before/after endpoint checks used for source lifecycle validation. It does not change analytics behavior, source persistence, calculations, scheduler behavior, ownership checks, reports, or UI rendering.

## Safety Boundary

Read-only functions:

- `GA4OverviewValidation.snapshot(config)`
- `GA4OverviewValidation.before(label, config)`
- `GA4OverviewValidation.after(label, config)`

Explicit mutation helpers:

- `GA4OverviewValidation.refreshSpend({ campaignId, sourceId })`
- `GA4OverviewValidation.refreshRevenue({ campaignId, sourceId })`

The helper does not delete sources. Delete/deactivate validation still requires deleting through the deployed UI, then running `after(...)`.

The output summarizes pass/fail, totals, source counts, and target-source presence. It does not print full endpoint rows.

## Load In A Logged-In Deployed Browser Session

After the helper is deployed, open the app while logged in and run:

```js
await import('/ga4-overview-validation-runner.js');
GA4OverviewValidation.help();
```

## Standard Pattern

1. Run `before(...)`.
2. Perform exactly one UI/provider action.
3. Run `after(...)`.
4. Confirm the visible UI card/source modal matches the endpoint summary.
5. Paste the `after(...)` output and the UI confirmation.

## Examples

Google Sheets spend add/import:

```js
await GA4OverviewValidation.before('2g-alt-tab-add', {
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID'
});

// Import exactly one controlled Google Sheets spend source in the UI.

await GA4OverviewValidation.after('2g-alt-tab-add', {
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID',
  expectedSpendDelta: 507.70,
  expectedSpendSourceCountDelta: 1,
  expectRevenueUnchanged: true
});
```

Google Sheets spend edit/update:

```js
await GA4OverviewValidation.before('2g-alt-tab-edit', {
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID'
});

// Edit the same source in the UI.

await GA4OverviewValidation.after('2g-alt-tab-edit', {
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID',
  expectedSpendDelta: 198.75,
  expectedSpendSourceCountDelta: 0,
  expectRevenueUnchanged: true
});
```

Google Sheets spend refresh/reprocess:

```js
await GA4OverviewValidation.before('2g-alt-tab-refresh', {
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID'
});

await GA4OverviewValidation.refreshSpend({
  campaignId: 'CAMPAIGN_ID',
  sourceId: 'SPEND_SOURCE_ID'
});

await GA4OverviewValidation.after('2g-alt-tab-refresh', {
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID',
  targetFamily: 'spend',
  targetSourceId: 'SPEND_SOURCE_ID',
  targetShouldExist: true,
  expectedSpendDelta: 300,
  expectedSpendSourceCountDelta: 0,
  expectRevenueUnchanged: true
});
```

Google Sheets spend delete/deactivate:

```js
await GA4OverviewValidation.before('2g-alt-tab-delete', {
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID',
  targetSourceId: 'SPEND_SOURCE_ID'
});

// Delete the source in the UI.

await GA4OverviewValidation.after('2g-alt-tab-delete', {
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID',
  targetFamily: 'spend',
  targetSourceId: 'SPEND_SOURCE_ID',
  targetShouldExist: false,
  expectedSpendDelta: -807.70,
  expectedSpendSourceCountDelta: -1,
  expectRevenueUnchanged: true
});
```

## Certification Rule

This runner is evidence collection tooling only. A passing runner output is not production-readiness proof by itself. The corresponding UI confirmation, source-family lifecycle scope, downstream caveats, and `GA4/OVERVIEW_PRODUCTION_READINESS.md` status still control the readiness claim.
