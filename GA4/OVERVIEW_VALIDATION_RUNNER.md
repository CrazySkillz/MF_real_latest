# GA4 Overview Validation Runner

## Purpose

`client/public/ga4-overview-validation-runner.js` is a validation-only browser helper for GA4 Overview readiness evidence packets.

It standardizes the repeated before/after endpoint checks used for source lifecycle validation. It does not change analytics behavior, source persistence, calculations, scheduler behavior, ownership checks, reports, or UI rendering.

## Safety Boundary

Read-only functions:

- `GA4OverviewValidation.snapshot(config)`
- `GA4OverviewValidation.before(label, config)`
- `GA4OverviewValidation.after(label, config)`
- `GA4OverviewValidation.overviewPack(config)`
- `GA4OverviewValidation.sourceDamageInventory({ campaignId })`
- `GA4OverviewValidation.hubspotInventory({ campaignId })`
- `GA4OverviewValidation.hubspotProvenance({ campaignId, expectedPipelineEnabled: false })`
- `GA4OverviewValidation.hubspotPipelineProxy(config)`
- `GA4OverviewValidation.hubspotProxyTransitionBefore(config)`
- `GA4OverviewValidation.hubspotProxyTransitionAfter(config)`
- `GA4OverviewValidation.hubspotPropagationBefore(config)`
- `GA4OverviewValidation.hubspotPropagationAfter(config)`
- `GA4OverviewValidation.googleSheetsVariantPack(config)`

Explicit mutation helpers:

- `GA4OverviewValidation.refreshSpend({ campaignId, sourceId })`
- `GA4OverviewValidation.refreshRevenue({ campaignId, sourceId })`
- `GA4OverviewValidation.reportPack({ campaignId, reportId, createSnapshot: true })` creates a report snapshot only when `createSnapshot: true` is passed
- `GA4OverviewValidation.reportPack({ campaignId, reportId, sendTest: true })` sends a real test email only when `sendTest: true` is passed

The helper does not delete sources. Delete/deactivate validation still requires deleting through the deployed UI, then running `after(...)`.

The output summarizes pass/fail, totals, source counts, and target-source presence. It does not print full endpoint rows.

## Load In A Logged-In Deployed Browser Session

After the helper is deployed, open the app while logged in and run:

```js
await import('/ga4-overview-validation-runner.js?v=2026-07-04.7');
GA4OverviewValidation.help();
```

## One-Command Overview Pack

For repeatable Overview endpoint validation, use:

```js
await GA4OverviewValidation.overviewPack({
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID'
});
```

This checks the core Overview endpoint family, GA4 daily freshness state, native GA4 endpoint health, source-backed revenue/spend endpoint health, source counts, and compact financial totals. It does not inspect UI pixels, PDF text, or future inbox delivery outside recorded packets.

For saved report snapshot/PDF smoke validation, use:

```js
await GA4OverviewValidation.reportPack({
  campaignId: 'CAMPAIGN_ID',
  reportId: 'REPORT_ID',
  createSnapshot: true
});
```

For Current Commit 3 read-only source-damage inventory, use:

```js
await GA4OverviewValidation.sourceDamageInventory({
  campaignId: 'CAMPAIGN_ID'
});
```

This calls a campaign-access-guarded GET route and returns source/record IDs only for suspicious groups. It does not clean, deactivate, recompute, refresh, or send anything.

For Current Commit 4.6 read-only HubSpot GA4 Overview inventory, run before and after deployed Current Commit 4.5 HubSpot provider lifecycle validation:

```js
await GA4OverviewValidation.hubspotInventory({
  campaignId: 'CAMPAIGN_ID',
  stage: '4.6-before-4.5-hubspot-provider-validation'
});

await GA4OverviewValidation.hubspotInventory({
  campaignId: 'CAMPAIGN_ID',
  stage: '4.6-after-4.5-hubspot-provider-validation'
});
```

This calls the same campaign-access-guarded GET route and summarizes HubSpot-only zero-record, orphan-record, duplicate-active-source, source/mapping context, and Pipeline Proxy scope candidates. It does not create, refresh, delete, clean, recompute, certify provider behavior, or prove other campaigns.

For Current Commit 4.7a read-only HubSpot provenance evidence after add/import or edit/update, use:

```js
await GA4OverviewValidation.hubspotProvenance({
  campaignId: 'CAMPAIGN_ID',
  stage: '4.7a-hubspot-provenance-after-add-or-edit',
  expectedPipelineEnabled: false
});
```

This records non-secret endpoint provenance for the active HubSpot account, active GA4 HubSpot revenue source, saved mapping fields, selected campaign values, revenue/date fields, Pipeline Proxy setting, source record count, source revenue, and source-modal expected label/value data. It does not expose OAuth tokens/secrets, refresh HubSpot, create/edit/delete sources, clean records, recompute metrics, inspect rendered pixels, or prove other campaigns.

For Current Commit 4.8a read-only HubSpot scheduler/provider propagation comparison automation, capture a baseline before a controlled HubSpot provider change:

```js
await GA4OverviewValidation.hubspotPropagationBefore({
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID',
  label: '4.8-hubspot-provider-propagation',
  expectedPipelineEnabled: false
});
```

Then make exactly one controlled HubSpot provider change outside this runner, let the existing scheduler/provider path complete, and compare the after-state:

```js
await GA4OverviewValidation.hubspotPropagationAfter({
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID',
  label: '4.8-hubspot-provider-propagation',
  expectedPipelineEnabled: false,
  expectedHubspotRevenueDelta: 1000
});
```

This helper is read-only. It does not trigger the scheduler, call HubSpot, create/edit/delete sources, recompute metrics, send reports, or mutate provider/source data. It compares the same active HubSpot source ID, active revenue/spend source IDs, HubSpot source revenue delta, overall revenue delta, spend unchanged state, inventory findings, and provenance state. A passing packet proves only the configured provider-change packet and does not certify Pipeline Proxy, other campaigns, alternate mappings, Reports, KPI/Benchmark, emails, or future provider mutations.

Recorded deployed Current Commit 4.8b evidence: runner `2026-07-04.3` returned `overallPass: true` on `2026-07-04T11:19:09.927Z` for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127` with label `4.8b-after-provenance-fix`. The controlled Total Revenue-only packet showed HubSpot source revenue delta `-$100`, total revenue delta `-$100`, spend delta `$0`, unchanged HubSpot record count, the same active HubSpot source, and clear inventory/provenance checks. This closes only that exact controlled HubSpot scheduler/provider propagation packet; Pipeline Proxy, other campaigns, alternate mappings, Reports, KPI/Benchmark, emails, sandbox provider mutation automation, and future provider changes remain unproven.

For Current Commit 4.9 read-only HubSpot Pipeline Proxy validation after configuring `Total Revenue + Pipeline (Proxy)`, use:

```js
await GA4OverviewValidation.hubspotPipelineProxy({
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID',
  stage: '4.9-hubspot-pipeline-proxy',
  expectedConfirmedRevenueTotal: 7600, // source-backed revenue breakdown total, excluding native GA4 revenue
  expectedPipelineTotalToDate: 1234.56,
  expectedSelectedValues: ['HUBSPOT_CAMPAIGN_VALUE'],
  expectedPipelineStageLabel: 'PIPELINE_STAGE_LABEL'
});
```

This helper is read-only. It does not call HubSpot, call the live `/pipeline-proxy` route, trigger scheduler, recompute, create/edit/delete sources, or mutate records. It selects the active pipeline-enabled HubSpot source by default; pass `sourceId` if more than one active pipeline-enabled HubSpot source exists. It validates persisted Pipeline Proxy provenance plus Overview confirmed-revenue separation: active GA4 HubSpot source, saved selected values, selected stage, positive proxy total, value-total sum, proxy values within selected values, expected source-backed confirmed revenue breakdown total excluding native GA4 revenue, and proof that the proxy total was not added into that confirmed revenue total. Explicit campaign mappings saved by the HubSpot wizard can satisfy the Pipeline Proxy scope check when the CRM value maps to the campaign saved GA4 campaign value. The selected-source packet is not blocked only because a different active HubSpot source has older non-pipeline mapping provenance; global server provenance remains informational in the output. Local static tests guard the live proxy endpoint saved-selected-values/stage scoping and the GA4 page separation of Pipeline Proxy from confirmed financial revenue. A deployed pass closes only that configured campaign/source/proxy packet.

If the Revenue Sources modal shows a HubSpot row with `$0.00` while Pipeline Proxy is configured, that row can be the pipeline-only source-management entry: confirmed revenue is `$0`, while the Pipeline Proxy card carries the early-signal amount. The row should be labeled `Pipeline Proxy only` and should not be deleted or re-imported unless the user intentionally wants to remove that source configuration.

Recorded deployed Current Commit 4.9b evidence: runner `2026-07-04.6` returned `overallPass: true` on `2026-07-04T12:52:07.447Z` for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127`. Selected source `d4ad51ef-85fe-4b67-bbd5-854900be3dee` was the only active pipeline-enabled HubSpot source, used `platformContext: ga4`, selected `yesop_brand_search`, stage `Contract Sent`, and proxy total `$5,000`. Confirmed source-backed revenue stayed `$7,600` and `revenueWithPipelineWouldBe` was `$12,600`, proving Pipeline Proxy was not added into confirmed revenue. Inventory passed with no HubSpot findings or Pipeline Proxy scope mismatches. `serverProvenancePass: false` was informational for the global all-HubSpot provenance packet and did not block the selected-source pass. This closes only that configured Pipeline Proxy packet.

For Current Commit 4.10 read-only HubSpot proxy-to-confirmed transition automation, capture the proxy baseline before moving exactly one controlled deal out of the configured Pipeline Proxy stage:

```js
await GA4OverviewValidation.hubspotProxyTransitionBefore({
  campaignId: '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458',
  propertyId: '542352127',
  label: '4.10-hubspot-proxy-to-confirmed-transition',
  sourceId: 'd4ad51ef-85fe-4b67-bbd5-854900be3dee',
  expectedPipelineTotalBefore: 5000,
  expectedConfirmedRevenueBefore: 7600,
  expectedPipelineStageLabel: 'Contract Sent',
  expectedSelectedValues: ['yesop_brand_search']
});
```

Then move that one HubSpot deal from `Contract Sent` to the closed revenue state outside this runner, wait for the existing scheduler/provider path to finish, and compare the after-state. If the deal amount is not `$5,000`, change the deltas and totals to the exact controlled amount:

```js
await GA4OverviewValidation.hubspotProxyTransitionAfter({
  campaignId: '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458',
  propertyId: '542352127',
  label: '4.10-hubspot-proxy-to-confirmed-transition',
  sourceId: 'd4ad51ef-85fe-4b67-bbd5-854900be3dee',
  expectedProxyDelta: -5000,
  expectedConfirmedRevenueDelta: 5000,
  expectedCombinedRevenueAndProxyDelta: 0,
  expectedPipelineTotalAfter: 0,
  expectedConfirmedRevenueAfter: 12600,
  expectedPipelineStageLabel: 'Contract Sent',
  expectedSelectedValues: ['yesop_brand_search']
});
```

Root cause/gap: 4.9b proved static Pipeline Proxy provenance and confirmed-revenue exclusion, but it did not prove the lifecycle handoff when the same provider deal leaves the proxy stage and becomes confirmed revenue. The 4.10 helper is read-only and compares the selected pipeline source, proxy delta, confirmed source-backed revenue delta, combined proxy-plus-confirmed conservation, spend unchanged state, active source revenue delta, source IDs, and HubSpot inventory findings. It does not call HubSpot, trigger scheduler, post `save-mappings`, mutate records, inspect rendered pixels, or certify Campaign Breakdown, Reports, KPI/Benchmark, emails, other campaigns, alternate mappings, or future provider mutations.

Recorded deployed Current Commit 4.10b evidence: runner `2026-07-04.7` returned `overallPass: true` for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127` / source `d4ad51ef-85fe-4b67-bbd5-854900be3dee` after one controlled `$5,000` HubSpot deal moved from `Contract Sent` to closed/won and the existing scheduler/provider path completed. The before packet had proxy `$5,000`, confirmed source-backed revenue `$7,600`, selected value `yesop_brand_search`, and spend `$498.75`. The after packet had proxy `$0`, confirmed source-backed revenue `$12,600`, selected-source revenue `$5,000`, selected value `yesop_brand_search`, and spend `$498.75`. Encoded checks all passed, including source/provenance presence, same selected pipeline source, same revenue/spend source IDs, clear HubSpot findings, proxy delta `-$5,000`, confirmed revenue delta `+$5,000`, combined proxy-plus-confirmed delta `$0`, active source revenue delta `+$5,000`, and spend delta `$0`. This closes only that configured transition packet; Campaign Breakdown, Reports, KPI/Benchmark, emails, other campaigns, alternate mappings, sandbox provider mutation automation, future provider changes, and other HubSpot configurations remain unproven.

For Current Commit 2g Google Sheets mapping variant validation, use the read-only variant pack after controlled fixture sources already exist:

```js
await GA4OverviewValidation.googleSheetsVariantPack({
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID',
  variants: [
    {
      label: 'spend-date-column',
      family: 'spend',
      sourceId: 'SPEND_SOURCE_ID',
      expectedAmount: 807.70,
      expectedDateColumn: true,
      expectedCampaignColumn: true,
      expectedMinimumRowCount: 1
    }
  ]
});
```

This validates deployed source endpoints, compact totals, source identity, amount, active state, duplicate Google Sheets signatures, and persisted mapping metadata for the configured fixture variants. It does not create sources, refresh sheets, delete sources, inspect UI pixels, or prove unlisted mapping shapes.

Recorded deployed Current Commit 2g evidence: runner `2026-07-03.4` returned `overallPass: true` on `2026-07-03T21:09:01.553Z` for the configured Google Sheets spend fixture on campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`; UI Total Spend/source-modal parity was user-confirmed at `$678.95`. This closes that fixture only.

See `GA4/OVERVIEW_AUTOMATED_VALIDATION.md` for the accelerated validation workflow and Playwright wrapper.

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
