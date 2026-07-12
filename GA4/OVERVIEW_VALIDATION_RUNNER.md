# GA4 Overview Validation Runner

## Purpose

`client/public/ga4-overview-validation-runner.js` is a validation-only browser helper for GA4 Overview readiness evidence packets.

It standardizes the repeated before/after endpoint checks used for source lifecycle validation. It does not change analytics behavior, source persistence, calculations, scheduler behavior, ownership checks, reports, or UI rendering.

## Safety Boundary

Read-only functions:

- `GA4OverviewValidation.snapshot(config)`
- `GA4OverviewValidation.before(label, config)`
- `GA4OverviewValidation.after(label, config)`
- `GA4OverviewValidation.csvRevenueBefore(label, config)`
- `GA4OverviewValidation.csvRevenueAfter(label, config)`
- `GA4OverviewValidation.csvRevenueInventory(config)`
- `GA4OverviewValidation.overviewPack(config)`
- `GA4OverviewValidation.sourceDamageInventory({ campaignId })`
- `GA4OverviewValidation.hubspotInventory({ campaignId })`
- `GA4OverviewValidation.hubspotProvenance({ campaignId, expectedPipelineEnabled: false })`
- `GA4OverviewValidation.hubspotPipelineProxy(config)`
- `GA4OverviewValidation.hubspotProxyTransitionBefore(config)`
- `GA4OverviewValidation.hubspotProxyTransitionAfter(config)`
- `GA4OverviewValidation.hubspotPropagationBefore(config)`
- `GA4OverviewValidation.hubspotPropagationAfter(config)`
- `GA4OverviewValidation.hubspotCampaignBreakdownBefore(config)`
- `GA4OverviewValidation.hubspotCampaignBreakdownAfter(config)`
- `GA4OverviewValidation.hubspotReportValuePack(config)`
- `GA4OverviewValidation.hubspotKpiBenchmarkValuePack(config)`
- `GA4OverviewValidation.hubspotOtherCampaignPortabilityPack(config)`
- `GA4OverviewValidation.hubspotAlternateMappingMatrixPack(config)`
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
await import('/ga4-overview-validation-runner.js?v=2026-07-12.1');
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

## Current Commit 10 CSV Revenue Deployed Lifecycle Packet

Use one disposable source named `csv10-revenue.csv` and this exact fixture:

```csv
Date,Campaign,Revenue
2026-07-01,Alpha,100
2026-07-02,Alpha,50
2026-07-03,Beta,1100
```

For the rejection check, use `csv10-revenue-invalid.csv`, whose second Alpha date is `invalid`. Map Revenue, Campaign, and Date, and select only `Alpha`. The invalid copy must be rejected; the valid copy totals `$150` for Alpha. Selecting Alpha plus Beta on edit totals `$1,250`.

Set the deployed campaign/property IDs after loading the runner:

```js
const campaignId = 'CAMPAIGN_ID';
const propertyId = 'PROPERTY_ID';
```

Run the read-only inventory before and after the lifecycle. For a campaign with no known inactive CSV findings:

```js
await GA4OverviewValidation.csvRevenueInventory({ campaignId, expectedInactiveSourceIds: [] });
```

If the Current Commit 9 inventory recorded known inactive source IDs for this exact campaign, pass only that documented ID list. Any unexpected active/reconciliation finding still fails.

Invalid import, expected no mutation:

```js
await GA4OverviewValidation.csvRevenueBefore('csv10-invalid', { campaignId, propertyId });
// Attempt the invalid CSV import through Total Revenue -> + -> Upload CSV.
await GA4OverviewValidation.csvRevenueAfter('csv10-invalid', {
  campaignId,
  propertyId,
  expectRevenueUnchanged: true,
  expectedRevenueDelta: 0,
  expectedRevenueSourceCountDelta: 0
});
```

Valid Alpha add, expected `$150` and one new source:

```js
await GA4OverviewValidation.csvRevenueBefore('csv10-add', { campaignId, propertyId });
// Import the valid fixture through the UI with Alpha selected.
const added = await GA4OverviewValidation.snapshot({ campaignId, propertyId });
console.table(added.revenue.csvSources);
const sourceId = added.revenue.csvSources.find((row) => row.displayName === 'csv10-revenue.csv' && row.amount === 150).sourceId;
await GA4OverviewValidation.csvRevenueAfter('csv10-add', {
  campaignId,
  propertyId,
  targetSourceId: sourceId,
  targetShouldExist: true,
  expectedTargetAmount: 150,
  expectedRevenueDelta: 150,
  expectedRevenueSourceCountDelta: 1
});
```

First same-source edit, select Alpha plus Beta and expect `$1,250` without a new source:

```js
await GA4OverviewValidation.csvRevenueBefore('csv10-edit-1', { campaignId, propertyId, targetSourceId: sourceId });
// Edit this source through Total Revenue -> Sources and select Alpha plus Beta.
await GA4OverviewValidation.csvRevenueAfter('csv10-edit-1', {
  campaignId,
  propertyId,
  targetSourceId: sourceId,
  targetShouldExistBefore: true,
  targetShouldExist: true,
  expectedTargetAmount: 1250,
  expectedTargetAmountDelta: 1100,
  expectedRevenueDelta: 1100,
  expectedRevenueSourceCountDelta: 0
});
```

Second same-source edit, return to Alpha only and expect `$150` with the same source ID/count:

```js
await GA4OverviewValidation.csvRevenueBefore('csv10-edit-2', { campaignId, propertyId, targetSourceId: sourceId });
// Edit the same source and return to Alpha only.
await GA4OverviewValidation.csvRevenueAfter('csv10-edit-2', {
  campaignId,
  propertyId,
  targetSourceId: sourceId,
  targetShouldExistBefore: true,
  targetShouldExist: true,
  expectedTargetAmount: 150,
  expectedTargetAmountDelta: -1100,
  expectedRevenueDelta: -1100,
  expectedRevenueSourceCountDelta: 0
});
```

Delete through `Total Revenue -> Sources`, expecting exact baseline restoration:

```js
await GA4OverviewValidation.csvRevenueBefore('csv10-delete', { campaignId, propertyId, targetSourceId: sourceId });
// Delete this exact CSV source through the UI.
await GA4OverviewValidation.csvRevenueAfter('csv10-delete', {
  campaignId,
  propertyId,
  targetSourceId: sourceId,
  targetShouldExistBefore: true,
  targetShouldExist: false,
  expectedRevenueDelta: -150,
  expectedRevenueSourceCountDelta: -1
});
await GA4OverviewValidation.csvRevenueInventory({ campaignId, expectedInactiveSourceIds: [] });
```

For every stage, record the visible `Total Revenue`, `Profit`, `ROAS`, `ROI`, and `CPA` cards plus the Revenue Sources modal. Total Revenue and Profit must move by the exact CSV delta, ROAS/ROI must recompute from unchanged spend, CPA must remain unchanged, the source amount/count must match the runner, and delete must restore the baseline. A runner pass without these visible checks is endpoint evidence only, not complete Current Commit 10 UI evidence.

All three CSV functions are evidence-only. `csvRevenueBefore`/`csvRevenueAfter` perform GET requests and localStorage baseline comparison; `csvRevenueInventory` is GET-only. The actual add/edit/delete actions are performed deliberately through the deployed UI.

Recorded deployed Current Commit 10 UI evidence on `2026-07-12`: the user confirmed the normal fixture lifecycle passed. Adding `Alpha` showed `$150`; editing the same source to `Alpha + Beta` showed `$1,250` without a duplicate; editing it back to `Alpha` showed `$150` without a duplicate; deleting it removed the source and restored the original Total Revenue; Total Spend remained unchanged throughout. No invalid-file result, runner output, campaign/property/source IDs, endpoint-parity or inventory packet, or exact Profit/ROAS/ROI/CPA values were supplied. This is bounded normal UI lifecycle evidence, not the complete runner packet described above.

Current Commit 12 certification rerun outcome on `2026-07-12`: the CSV-only bounded local packet passed 44/44, the runner syntax check passed, and TypeScript passed. A refreshed read-only target-database scan covered 4 campaigns, 23 GA4 CSV sources, and 21 linked records; it found only the same five known inactive-source record groups, with no active/reconciliation damage and no cleanup performed. Upload CSV Revenue was not clean-certified because this document's deployed invalid-file no-mutation and complete runner/source-ID/endpoint-parity/derived-card packet was not supplied. Google Sheets Revenue remains on hold.

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

Current Commit 4.10c note: HubSpot Review Settings campaign-mapping visibility is a UI display guard, not a runner packet. Root cause: Crosswalk mappings were already present in `selectedCampaignMappings` and preview/save payloads, but Review Settings did not render them. The fix renders the selected CRM value to mapped platform campaign pair before save and is guarded locally by `npm test -- server/hubspot-revenue-ga4-overview-regression.test.ts`; deployed UI confirmation remains optional separate evidence and is not a blocker to the current HubSpot revenue production-ready decision.

Current Commit 4.10d note: HubSpot Revenue Sources mapped-campaign subtitles and zero-proxy edit Review Settings suppression are UI display guards, not runner packets. Root causes: the Revenue Sources modal parsed source `mappingConfig` but rendered the generic `HubSpot` type label, and HubSpot edit-mode Review Settings rendered Pipeline Proxy whenever `pipelineEnabled` was true even when the effective unchanged proxy amount was `$0.00` after conversion to confirmed revenue. Local guards live in `server/hubspot-revenue-ga4-overview-regression.test.ts`; deployed UI confirmation remains optional separate evidence and is not a blocker to the current HubSpot revenue production-ready decision.

For Current Commit 4.11 read-only HubSpot Campaign Breakdown exact mapped-revenue transition automation, capture the row baseline before the controlled provider/source transition:

```js
await import('/ga4-overview-validation-runner.js?v=2026-07-05.2');

await GA4OverviewValidation.hubspotCampaignBreakdownBefore({
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID',
  label: '4.11-hubspot-campaign-breakdown-transition',
  targetCampaignName: 'MAPPED_GA4_CAMPAIGN_ROW',
  unchangedCampaignNames: ['UNRELATED_GA4_CAMPAIGN_ROW'],
  expectedTargetRevenueBefore: 7000,
  expectedTargetHubspotRevenueBefore: 7000
});
```

Then make exactly one controlled HubSpot/provider change outside this runner, let the existing scheduler/provider path finish, and compare the after-state:

```js
await GA4OverviewValidation.hubspotCampaignBreakdownAfter({
  campaignId: 'CAMPAIGN_ID',
  propertyId: 'PROPERTY_ID',
  label: '4.11-hubspot-campaign-breakdown-transition',
  targetCampaignName: 'MAPPED_GA4_CAMPAIGN_ROW',
  unchangedCampaignNames: ['UNRELATED_GA4_CAMPAIGN_ROW'],
  expectedTargetRevenueDelta: 5000,
  expectedTargetHubspotRevenueDelta: 5000,
  expectedTargetRevenueAfter: 12000,
  expectedTargetHubspotRevenueAfter: 12000
});
```

This helper is read-only. It does not call HubSpot, trigger scheduler, create/edit/delete sources, recompute metrics, send reports, or mutate records. It mirrors the GA4 Overview Campaign Breakdown merge by fetching `campaign`, `ga4-breakdown`, `revenue-sources`, `revenue-breakdown`, and the read-only HubSpot inventory, then comparing the visible row formula: GA4 native row revenue plus exact mapped imported revenue from `campaignValueRevenueTotals` and saved `campaignMappings`. A passing packet proves only the configured campaign/property/date-range row transition and named unchanged rows. It does not certify Reports, KPI/Benchmark, emails, other campaigns, alternate mappings, or future provider mutations. If the provider transition already happened before the `Before` packet was captured, automated 4.11 proof is still pending; start a new controlled transition or fixture so the runner has a real baseline.

Recorded deployed Current Commit 4.11 evidence: runner `2026-07-04.8` returned `overallPass: true` on `2026-07-04T17:10:58.316Z` for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127`, date range `30days`. The after packet used target row `yesop_retargeting`, named unchanged row `yesop_email_nurture`, and selected GA4 campaign values `yesop_email_nurture`, `yesop_retargeting`, and `yesop_paid_social`. Checks passed for baseline presence, endpoints, read-only boundary, inventory, target row presence before/after, clear HubSpot findings, target native revenue unchanged, unchanged row stability, target displayed revenue delta `+$100`, and target HubSpot revenue delta `+$100`. HubSpot findings were empty, including no zero-record, orphan-record, duplicate-active-source, GA4 context mismatch, or Pipeline Proxy scope-mismatch candidates. This closes only that configured Campaign Breakdown mapped-row packet; Reports, KPI/Benchmark, emails, other campaigns, alternate mappings, other Campaign Breakdown rows, and future provider mutations remain separate evidence.

Recorded deployed Current Commit 4.12 evidence: runner `2026-07-04.9` returned `overallPass: true` for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127` / report `c5a9ea60-3c0f-4809-98bf-7a5a0b118f9f` (`GA4 Overview Report`). Checks passed for endpoints, read-only boundary, report resolution, report platform, overview revenue inclusion, Campaign Breakdown inclusion, HubSpot inventory, clear HubSpot findings, HubSpot revenue presence, imported-revenue inclusion, target row presence, snapshot endpoint, PDF endpoint, PDF content type/bytes, and expected target HubSpot revenue. The packet recorded report financial revenue `$44,864.15`, imported revenue `$16,700`, HubSpot revenue `$16,100`, pipeline proxy total `$0`, and target row `yesop_retargeting` HubSpot revenue `$16,100`. This closes only that configured GA4 Overview report value packet; KPI/Benchmark, emails, other campaigns, alternate mappings, other report variants, PDF text/pixel inspection, scheduler delivery, and future provider mutations remain separate evidence.

For Current Commit 4.13 read-only HubSpot KPI/Benchmark value propagation validation, first make sure the GA4 campaign has the KPI and Benchmark rows you want to prove. Then run:

```js
await import('/ga4-overview-validation-runner.js?v=2026-07-05.2');

await GA4OverviewValidation.hubspotKpiBenchmarkValuePack({
  campaignId: '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458',
  propertyId: '542352127',
  requiredKpiMetrics: ['Revenue', 'ROAS', 'ROI', 'CPA'],
  requiredBenchmarkMetrics: ['revenue', 'roas', 'roi', 'cpa'],
  expectedFinancialRevenue: 44864.15,
  expectedHubspotRevenueForFinancials: 16100
});
```

This helper is read-only: it uses GET endpoints only, does not create KPI/Benchmark rows, does not refresh providers, does not call HubSpot, does not trigger scheduler, does not recompute metrics, does not send alerts/emails, and does not mutate source data. It mirrors the GA4 Overview financial formula used by KPI/Benchmark live values: selected GA4 native revenue plus active imported revenue, with Pipeline Proxy excluded. Version `2026-07-04.11` fixes the runner comparison boundary so required metrics are matched using the same metric/template fields the UI badges use, and formatted current values such as `44,864.15` can be parsed; this is validation-only and does not change KPI/Benchmark runtime behavior. If one of the required KPI/Benchmark rows does not exist, the packet should fail that row-present check; create the missing row through the normal UI or remove it from the required list and do not claim that metric. A pass proves only the configured GA4 KPI/Benchmark value packet; alert delivery, emails, other campaigns, alternate mappings, other KPI/Benchmark metrics, and future provider mutations remain separate evidence.

Recorded 4.13 deployed mismatch before the persisted-job fix: if the packet shows `actualCurrentValue: 35317.57` and `expectedCurrentValue: 44864.15`, do not change the expected values. That output proves the KPI/Benchmark endpoint rows are using GA4 to-date native revenue `$18,617.57` plus imported revenue `$16,700`, while Overview uses breakdown native revenue `$28,164.15` plus imported revenue `$16,700`. The local runtime fix is in `server/ga4-kpi-benchmark-jobs.ts`: persisted GA4 KPI/Benchmark financial metrics now use the same highest-native-revenue financial candidate model as Overview, with Pipeline Proxy still excluded. Existing deployed rows will update only after the fixed recompute path runs; use the existing campaign-scoped GA4 refresh endpoint or wait for scheduler/source recompute before rerunning this read-only helper.

HubSpot revenue production-ready conclusion: after deployed Current Commit 4.16 evidence, HubSpot GA4 Overview revenue is production-ready for the validated documented section. The exception list for future reference is explicit and not a blocker for that decision: every possible HubSpot mapping, raw HubSpot provider-object audit, raw daily-row date audit, every report/KPI/email variant, and future provider changes.
Remaining active HubSpot clean-certification queue after deployed 4.16 alternate-mapping evidence:

1. No active HubSpot Current Commit remains for the configured evidence packets. New mappings, raw-provider validation, raw daily-row validation, untested report/KPI/email variants, or future provider mutations require new scoped evidence packets, but they are not blockers to the current HubSpot revenue production-ready decision.

Current Commit 4.13 local automation and the persisted-job financial-source runtime fix are implemented, regression-covered, deployed, recomputed, and validated for the configured Revenue KPI/Benchmark packet. The deployed helper returned `overallPass: true`; endpoint, read-only, KPI endpoint, Benchmark endpoint, inventory, clear HubSpot findings, HubSpot revenue presence, imported-revenue inclusion, required row presence, required row value matches, financial revenue match, and HubSpot revenue match checks all passed. Current Commit 4.14 adds local regression coverage that scheduled/test report emails attach the GA4 PDF built from the same HubSpot-aware report payload, and deployed email/PDF evidence is user-confirmed for the configured GA4 Overview Report packet: the PDF was attached/openable and matched the HubSpot-aware GA4 report values. Exact provider delivery-event IDs are not recorded in this repo. These close only their configured packets. Current Commit 4.15 deployed evidence is user-captured for the two supplied campaign/property entries: original campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127` with HubSpot revenue `$16,100` and additional campaign `61bf28cb-74b0-4beb-9afe-fd02f2f285c6` / property `498536418` with HubSpot revenue `$8,000`; `overallPass: true`, all campaign packets passed, and no active/revenue HubSpot source IDs overlapped across campaigns. Other unlisted campaigns, alternate mappings, other KPI/Benchmark metrics, other report/email variants, future sends, and future provider mutations remain separate evidence. Current Commit 4.16 deployed evidence was user-captured with runner `2026-07-05.2` on `2026-07-05T06:53:32.454Z`: packet-level `overallPass: true`, `variantCount: 1`, and `allVariantPacketsPass: true`. The pasted output did not expand `variants[0]`, so this records the configured one-variant packet only and does not claim unlisted mappings, raw HubSpot provider objects, raw daily row dates, untested report/KPI/email variants, or future provider changes.

For Current Commit 4.15 read-only HubSpot other-campaign portability validation, use the latest runner after the additional campaign has an already-created HubSpot revenue source:

```js
await import('/ga4-overview-validation-runner.js?v=2026-07-05.2');

await GA4OverviewValidation.hubspotOtherCampaignPortabilityPack({
  campaigns: [
    {
      label: 'original-validated-campaign',
      campaignId: '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458',
      propertyId: '542352127',
      expectedHubspotRevenueForFinancials: 16100,
      expectedSelectedValues: ['yesop_brand_search', 'LI_B2B_SaaS_US_Q1 - Deal 3', 'LI_Enterprise_ABN_Q2']
    },
    {
      label: 'additional-campaign-under-test',
      campaignId: 'OTHER_CAMPAIGN_ID',
      propertyId: 'OTHER_PROPERTY_ID',
      expectedHubspotRevenueForFinancials: 1234.56,
      expectedSelectedValues: ['OTHER_HUBSPOT_VALUE']
    }
  ]
});
```

This helper is read-only: it uses GET endpoints only, does not create/edit/delete sources, does not refresh providers, does not call HubSpot, does not trigger scheduler, does not recompute metrics, does not send reports/emails, and does not mutate source data. Each campaign entry must provide `expectedHubspotRevenueForFinancials` and `expectedSelectedValues`; otherwise the packet fails by design. A pass proves only the supplied campaign/property entries, their expected HubSpot selected values/totals, and cross-campaign HubSpot source-ID separation returned by deployed endpoints. It does not prove unlisted campaigns, alternate mappings, raw database rows, HubSpot provider objects, Reports, KPI/Benchmark, emails, or future provider mutations.

For Current Commit 4.16 read-only HubSpot alternate-mapping matrix validation, use the latest runner after each variant source already exists and after any edit/update source-ID stability evidence has been captured:

```js
await import('/ga4-overview-validation-runner.js?v=2026-07-05.2');

await GA4OverviewValidation.hubspotAlternateMappingMatrixPack({
  variants: [
    {
      label: 'dealname-amount-closedate-single',
      campaignId: 'CAMPAIGN_ID',
      propertyId: 'PROPERTY_ID',
      expectedSourceId: 'HUBSPOT_SOURCE_ID',
      expectedCampaignProperty: 'dealname',
      expectedSelectedValues: ['HUBSPOT_SELECTED_VALUE'],
      expectedRevenueProperty: 'amount',
      expectedDateField: 'closedate',
      expectedDailyMaterialization: 'selected_date_field_v1',
      expectedHubspotRevenue: 8000,
      expectedRecordCount: 2,
      expectedPipelineEnabled: false
    }
  ]
});
```

This helper is read-only and strict. It uses GET endpoints only and does not create/edit/delete sources, refresh providers, call HubSpot, trigger scheduler, recompute metrics, send reports/emails, or mutate source data. It validates persisted HubSpot source provenance, daily materialization metadata, and revenue-breakdown totals for each supplied variant; it does not inspect raw daily row dates. A variant fails if expected campaign property, selected values/count, revenue property, date field, daily materialization, source ID, or HubSpot revenue are missing/mismatched. Source-ID stability is proven only when `expectedSourceId` comes from a separate before/after edit check. A pass proves only the configured variant rows; unlisted mappings, raw HubSpot provider objects, rendered pixels, Reports, KPI/Benchmark, emails, and future provider mutations remain unproven. Recorded deployed Current Commit 4.16 evidence: runner `2026-07-05.2` returned packet-level `overallPass: true` on `2026-07-05T06:53:32.454Z`, `variantCount: 1`, and `allVariantPacketsPass: true`. The pasted output did not expand `variants[0]`, so this closes only the configured one-variant packet and does not add raw provider, raw daily-row, untested report/KPI/email-variant, or future-provider proof.

## Shopify Current Commit 6 Deployed Cache/Refetch Packet

Recorded deployed Shopify Current Commit 6 evidence was captured after commit `3a2323da` deployed using the browser watcher packet, not a stored `GA4OverviewValidation` helper. The user ran the watcher around a Shopify Admin API token edit/re-import on campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`; the result returned `overallPass: true`, `endpointsOk: true`, `shopifySourcePresent: true`, `shopifyBreakdownPresent: true`, and observed revenue, KPI, Benchmark, Reports, and Notifications refetch checks passed. The packet captured `47` watched calls, Total Revenue `$16,899.98`, Shopify breakdown `$199.98`, `1` active Shopify source, `7` KPI rows, `2` Benchmark rows, `3` Reports, and `5` Notifications.

This closes only deployed downstream cache/refetch behavior for the validated Admin API token Shopify edit/re-import path. It does not create or replace a reusable runner helper, and it does not prove report snapshot/PDF content, KPI/Benchmark row-value parity, notification row value content, email provider acceptance, delivered-email/inbox receipt, OAuth, other campaigns/mappings, or future provider changes. The script-reported `shopifySourceTotal: 0` was a source-row amount parser limitation; source presence and Shopify breakdown `$199.98` are the trusted evidence for this packet.

Current Commit 6a is locally regression-covered by `server/shopify-downstream-content-regression.test.ts` for Shopify downstream value/content: scheduled GA4 PDF text includes Shopify source revenue and combined Total Revenue, GA4 KPI/Benchmark current rows persist the Shopify-backed revenue value, and `/api/notifications` returns recomputed Shopify-backed alert metadata. Deployed Current Commit 6a is closed only for the validated Admin API token campaign/report/email packet after commit `ae72bbd4` deployed: the value/content browser validation was user-confirmed complete, the GA4 report PDF was opened/downloaded and showed Shopify revenue plus the same Total Revenue as the endpoint packet, and the report email was actually delivered with the report attached. Do not treat the Current Commit 6 watcher packet as proof for these value/content paths.

Current Commit 8 is deployed-validated for the user-confirmed second Shopify Admin API token campaign/mapping packet: Shopify revenue appeared in GA4 Overview, Total Revenue included Shopify revenue, Revenue Sources and Revenue Breakdown matched, inventory stayed clean, Shopify source IDs did not overlap with the first campaign, and unrelated spend/revenue stayed unchanged. Local guards in `server/shopify-revenue-regression.test.ts` prove every Shopify order-reading path uses the paginated reader, and the save path remains campaign-access guarded, campaign-connection scoped, source-ID scoped, platform-context scoped, exact mapping scoped, revenue-record scoped, and recompute scoped. This closes Shopify Admin API token GA4 Overview revenue clean certification for the validated scope. OAuth remains deferred and excluded. Real >250 matching-order provider evidence remains excluded until a Shopify test store/window with more than 250 matching orders is available. Future Shopify/API/provider changes are future revalidation triggers, not current blockers.

Future-reference boundary: the Shopify Admin API token clean certification also includes the previously recorded source lifecycle packets, startup-fired scheduler packet, downstream value/content packet, delivered report-email evidence, and mapped-campaign Revenue Sources subtitle guard. It still excludes Shopify OAuth, future report/email variants or sends, revenue-changing scheduler provider mutation proof, optional strict normal wall-clock scheduler timing, and any non-Shopify source family such as Google Ads spend.

For Current Commit 4.12 read-only HubSpot Reports value propagation validation, use:

```js
await import('/ga4-overview-validation-runner.js?v=2026-07-05.2');

await GA4OverviewValidation.hubspotReportValuePack({
  campaignId: '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458',
  propertyId: '542352127',
  reportId: 'c5a9ea60-3c0f-4809-98bf-7a5a0b118f9f',
  targetCampaignName: 'yesop_retargeting',
  expectedTargetHubspotRevenue: 16100,
  requirePdf: true
});
```

This helper is read-only: it uses GET endpoints only, does not create snapshots, does not send emails, does not call HubSpot, does not trigger scheduler, and does not recompute provider data. Use `expectedHubspotRevenueForFinancials` only when you know the total HubSpot contribution across all active HubSpot revenue source rows, not just the target mapped row. It mirrors the GA4 scheduled/server report value formulas for Total Revenue, Revenue Sources, and mapped Campaign Breakdown values, then optionally checks an existing snapshot/PDF by GET. If no snapshot exists, first capture separate report snapshot evidence deliberately, then rerun this helper with `snapshotId` or `requirePdf: true`. A pass proves only the configured GA4 report value packet; KPI/Benchmark, emails, other campaigns, alternate mappings, and future provider mutations remain separate evidence.

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
