# Connected Platform Section Templates

## Purpose

This file is the master implementation contract for reusable connected-platform sections.

Use it before adding or refining KPIs, Benchmarks, Reports, Total Revenue, or Pipeline Proxy for any future source integration, including Custom Integration.

The goal is to prevent partial "follow GA4" implementations. A future platform section is not complete when it merely has similar backend support or similar labels. It is complete only when it matches the required template behavior below, with source-specific metric adapters and explicit documented deviations.

## Template Sources

Use these source templates:

- KPIs: GA4 implementation in `client/src/pages/ga4-metrics.tsx`.
- Benchmarks: GA4 implementation in `client/src/pages/ga4-metrics.tsx`.
- Reports: GA4 implementation in `client/src/pages/ga4-metrics.tsx`.
- Total Revenue card and revenue import process: Meta implementation in `client/src/pages/meta-analytics.tsx` plus `client/src/components/AddRevenueWizardModal.tsx`.
- Pipeline Proxy source import choice and wizard behavior: Meta-pattern shared CRM implementation in `client/src/components/HubSpotRevenueWizard.tsx` and `client/src/components/SalesforceRevenueWizard.tsx`.

Why Meta is the Total Revenue/Pipeline Proxy template:

- Meta is a paid-media source and its revenue model is closer to future ad-platform integrations than GA4.
- Meta Total Revenue uses platform-scoped attributed revenue sources, not broad GA4 web revenue.
- Meta keeps Pipeline Proxy separate from confirmed Total Revenue and derived ROI/ROAS.

## Required Rule

When a future integration says "use the GA4 KPI/Benchmark/Reports pattern," that means:

- Use the full GA4 section and modal behavior.
- Change only platform-specific labels, metrics, query keys, icons, unavailable reasons, and source-backed current-value adapters.
- Do not omit fields, buttons, modal sections, edit/delete behavior, alert behavior, or schedule behavior unless the platform tracker documents the deviation before implementation.

When a future integration says "use the Meta revenue pattern," that means:

- Use a platform-scoped Total Revenue card with a `+` import action.
- Use `AddRevenueWizardModal` with the correct `platformContext`.
- Use platform campaign mapping for paid-media attribution when imported source values may not equal provider campaign IDs.
- Keep Pipeline Proxy separate from confirmed revenue and derived metrics.

Create Campaign wizard rules:

- `Back` must always return to the immediately previous screen/step for that exact wizard path.
- Source setup completed while the campaign is still a draft must be labeled `Ready` or `Selected`, not `Connected`.
- `Connected` is reserved for finalized campaigns after the final `Create Campaign` action succeeds.

## Root Cause This File Prevents

The TikTok implementation required repeated follow-up prompts because the work treated GA4 as a loose reference instead of a required section contract.

The repeated defects were:

- KPI create modal initially missed GA4 fields and behavior.
- Benchmark create modal initially missed GA4 fields and behavior.
- Current Value was not initially populated from the selected source-backed metric.
- No-default-template behavior had to be corrected after the modal shipped.
- Number formatting and metric units had to be corrected after the modal shipped.
- Revenue-dependent templates had to be disabled after the modal shipped.
- Reports initially lacked the full GA4 report modal structure and custom report behavior.
- Report actions, edit mode, delete confirmation, custom report collapsed state, and disabled submit behavior needed follow-up fixes.

Future integrations must start from this file so one implementation pass can cover the complete section contract.

## Platform Adapter Contract

Each future platform must define a small adapter before implementing these sections.

Required adapter fields:

- `platformKey`: stable API/platform key, such as `meta`, `google_ads`, `instagram`, `tiktok`, or `custom_integration`.
- `platformLabel`: visible label, such as `Meta/Facebook Ads`.
- `analyticsRoute`: platform analytics page route.
- `metricTemplates`: list of KPI/Benchmark templates available for the platform.
- `currentValueResolver`: function or local helper that maps each metric template to the current source-backed value.
- `metricAvailability`: map of available/unavailable states and reasons.
- `revenueAvailability`: whether platform-scoped attributed revenue exists.
- `spendAvailability`: whether platform-scoped spend exists.
- `queryKeys`: all queries that must be invalidated/refetched after create, update, delete, refresh, or import.
- `reportSections`: Overview, KPIs, Benchmarks, Ad Comparison, Insights, and any approved platform-specific sections.
- `sourceRows`: persisted selected source rows that back the visible metrics.
- `sourceScope`: when a platform has selectable sub-sources, properties, accounts, spreadsheets, tabs, datasets, or views, the stable selected source identity that backs a saved KPI, Benchmark, or Report.

Adapter rules:

- Current values must come from persisted selected source rows or validated platform-scoped financial rows.
- If the analytics page has a dropdown or selector for active sub-source/dataset analysis, saved KPI, Benchmark, and Report rows must persist the selected source scope at create/update time and continue resolving from that saved scope after the selector changes.
- Page-level selectors may control live Overview/Summary/Insights analysis, but they must not silently change the source scope of existing saved KPI, Benchmark, Report, scheduled report, alert, or snapshot records.
- Revenue-dependent metrics must remain unavailable until platform-scoped attributed revenue exists.
- Spend-dependent metrics must remain unavailable until platform-scoped spend exists.
- Missing current values must render unavailable or blank with a reason; do not write or display invented zeroes.
- Do not use unscoped campaign totals, another platform, generic splits, placeholder rows, or broad account-level data.

## Section Shell Template

Platform analytics pages that implement these sections should use this tab order unless the tracker documents a source-specific exception:

1. Overview
2. KPIs
3. Benchmarks
4. Ad Comparison
5. Insights
6. Reports

Section shell requirements:

- Tabs use the same visual pattern as GA4.
- The active tab must not reset unexpectedly after modal actions.
- Loading states should avoid replacing stable content with layout-jumping text.
- Empty states must be explicit and not present missing metrics as zero.
- All platform-specific values must be campaign-scoped.

## KPI Section Template

Source template:

- `client/src/pages/ga4-metrics.tsx`
- Anchor labels: `Key Performance Indicators`, `Create KPI`, `Create New KPI`, `Select KPI Template`, `Enable alerts for this KPI`.

### KPI Section Layout

Required elements:

- Header: `Key Performance Indicators`.
- Supporting copy tailored to the platform.
- Top-right `Create KPI` button with `Plus` icon.
- Summary cards:
  - Total KPIs
  - Above Target
  - On Track
  - Below Target
  - Avg. Progress
- Empty state when no KPIs exist.
- KPI cards when rows exist.

KPI card requirements:

- Metric icon.
- KPI name.
- Metric badge.
- Optional description.
- Current value panel.
- Target value panel.
- Progress label and progress bar.
- Status text.
- Edit action where supported.
- Delete action where supported.

### KPI Create/Edit Modal

The modal must follow GA4 field order and behavior:

1. Dialog title:
   - Create mode: `Create New KPI`.
   - Edit mode: `Edit KPI`.
2. Dialog description:
   - Tailored to the platform, for example `Set up a key performance indicator for <Platform>.`
3. `Select KPI Template` panel:
   - Two-column template grid.
   - Templates tailored to platform metrics.
   - `Create Custom KPI` option.
   - No metric selected by default in create mode unless the user intentionally opened a specific template.
   - Edit mode may prefill saved values.
4. `KPI Name *`.
5. `Description`.
   - Textarea.
   - Character counter.
   - Maximum length follows the GA4 pattern unless a platform-specific limit is documented.
6. Current/Target/Unit row:
   - `Current Value`
   - `Target Value *`
   - `Unit`
7. `Priority`.
8. Alert section:
   - `Enable alerts for this KPI`
   - Notification helper copy.
   - Alert threshold when enabled.
   - Alert condition when enabled.
   - Alert frequency when enabled.
   - Email notification option and recipients when enabled.
9. Footer actions:
   - Cancel.
   - Create KPI or Update KPI.
   - Disabled until required fields are valid.

### KPI Template Behavior

Required behavior:

- Template click sets name, metric key, unit, description, and source-backed current value.
- Target value remains user-entered; do not auto-fill target from current value.
- Custom KPI clears template selection and requires user-entered name, unit, and values.
- No template is selected by default when opening a blank create modal.
- Switching templates updates name, metric, unit, description, and current value predictably.

Current Value rules:

- Current Value must be sourced from the platform adapter's current source-backed value.
- Current Value for count metrics must use thousands separators.
- Currency values must use the campaign currency or documented platform currency.
- Percent values must be formatted as percentages.
- Ratio values such as ROAS must use `x` or the platform's ratio unit.
- If unavailable, leave blank or render unavailable with reason; do not insert `0`.

Revenue/spend gating:

- Revenue, ROI, and ROAS templates are disabled until platform-scoped attributed revenue exists.
- CPA, CPC, CPM, ROI, and ROAS templates are disabled until platform-scoped spend exists when spend is required.
- Disabled templates must show a clear reason, such as `Requires <Platform>-scoped attributed revenue.`

Number formatting:

- Current Value is displayed in the correct unit format.
- Target Value formats while typing where the platform supports it.
- Values normalize on blur.
- Count values use `count`.
- Currency values use currency formatting.
- Percent values preserve decimal precision.

### KPI Validation Checklist

Before a KPI section is considered complete:

- Create button exists and matches GA4 placement.
- Modal field order matches GA4.
- No default template selection in create mode.
- Template selection populates Current Value from source-backed current values.
- Missing current values do not become zero.
- Revenue-dependent templates are disabled until platform-scoped revenue exists.
- Spend-dependent templates are disabled until platform-scoped spend exists.
- Target Value formats correctly while typing and on blur.
- Alerts match GA4 behavior.
- Create, edit, and delete refresh visible rows and dependent aggregate/report consumers.
- Regression test asserts the modal fields, disabled template behavior, and source-backed current-value resolver.

## Benchmark Section Template

Source template:

- `client/src/pages/ga4-metrics.tsx`
- Anchor labels: `Performance Benchmarks`, `Create Benchmark`, `Create New Benchmark`, `Select Benchmark Template`, `Enable alerts for this Benchmark`.

### Benchmark Section Layout

Required elements:

- Header: `Performance Benchmarks`.
- Supporting copy tailored to the platform.
- Top-right `Create Benchmark` button with `Plus` icon.
- Summary cards:
  - Total Benchmarks
  - On Track
  - Needs Attention
  - Behind
  - Avg. Progress
- Empty state when no Benchmarks exist.
- Benchmark cards when rows exist.

Benchmark card requirements:

- Metric icon.
- Benchmark name.
- Metric badge.
- Optional description.
- Optional industry/context label if available.
- Current value panel.
- Benchmark value panel.
- Progress label and progress bar.
- Status text.
- Edit action where supported.
- Delete action where supported.

### Benchmark Create/Edit Modal

The modal must follow GA4 field order and behavior:

1. Dialog title:
   - Create mode: `Create New Benchmark`.
   - Edit mode: `Edit Benchmark`.
2. Dialog description:
   - Tailored to the platform.
3. `Select Benchmark Template` panel:
   - Two-column template grid.
   - Templates tailored to platform metrics.
   - `Create Custom Benchmark` option.
   - No metric selected by default in create mode unless the user intentionally opened a specific template.
4. `Benchmark Name *`.
5. `Description`.
   - Textarea.
   - Character counter.
6. Current/Benchmark/Unit row:
   - `Current Value`
   - `Benchmark Value *`
   - `Unit`
7. Alert section:
   - `Enable alerts for this Benchmark`
   - Notification helper copy.
   - Alert threshold when enabled.
   - Alert condition when enabled.
   - Alert frequency when enabled where supported.
   - Email notification option and recipients when enabled.
8. Footer actions:
   - Cancel.
   - Create Benchmark or Update Benchmark.
   - Disabled until required fields are valid.

### Benchmark Template Behavior

Required behavior:

- Template click sets name, metric key, unit, description, and source-backed current value.
- Benchmark value remains user-entered unless an approved industry benchmark lookup exists for that exact metric and industry.
- Custom Benchmark clears template selection and requires user-entered name, unit, and values.
- No template is selected by default when opening a blank create modal.
- Switching templates updates name, metric, unit, description, and current value predictably.

Current Value rules:

- Current Value must come from the same platform adapter used for KPI current values.
- Missing current values must stay unavailable or blank with a reason.
- Do not use saved benchmark current-value snapshots when a live source-backed value is available.
- Do not substitute aggregate all-platform values for platform-specific values.

Revenue/spend gating:

- Revenue, ROI, and ROAS templates are disabled until platform-scoped attributed revenue exists.
- Cost metrics are disabled until platform-scoped spend and required denominators exist.
- Disabled templates must show clear reasons.

Number formatting:

- Current Value, Benchmark Value, and Alert Threshold must use the selected metric unit.
- Benchmark Value formats while typing where supported.
- Values normalize on blur.

### Benchmark Validation Checklist

Before a Benchmark section is considered complete:

- Create button exists and matches GA4 placement.
- Modal field order matches GA4.
- No default template selection in create mode.
- Template selection populates Current Value from source-backed current values.
- Missing current values do not become zero.
- Revenue-dependent templates are disabled until platform-scoped revenue exists.
- Spend-dependent templates are disabled until platform-scoped spend exists.
- Benchmark Value formats correctly while typing and on blur.
- Alerts match GA4 behavior.
- Create, edit, and delete refresh visible rows and dependent aggregate/report consumers.
- Regression test asserts the modal fields, disabled template behavior, and source-backed current-value resolver.

## Reports Section Template

Source template:

- `client/src/pages/ga4-metrics.tsx`
- Anchor labels: `Report Type`, `Standard Templates`, `Custom Report`, `Choose Template`, `Schedule Automated Reports`, `Generate & Download Report`, `Schedule Report`, `Update Report`.

### Reports Tab Layout

Required elements:

- Header: `<Platform> Reports`.
- Supporting copy tailored to the platform.
- `Create Report` button with `Plus` icon.
- Empty state when no reports exist.
- Report cards when rows exist.

Report card actions:

- Download button with `Download` icon.
- Edit icon button with `Pencil` icon.
- Delete icon button with `Trash2` icon.
- Delete must open a confirmation popup.
- Delete route must report true success/failure based on the row actually removed.

### Report Modal

The modal must follow GA4 structure:

1. Dialog title: `Report Type`.
2. Top selector cards:
   - `Standard Templates`
   - `Custom Report`
3. Standard mode:
   - `Choose Template`.
   - Template cards for Overview, KPIs, Benchmarks, Ad Comparison, Insights.
   - Template cards include icon, title, description, and chips.
   - No report template is selected by default in create mode unless explicitly documented.
   - Submit disabled until a template is selected.
4. Custom mode:
   - `Custom Report`.
   - Section list includes Overview, KPIs, Benchmarks, Ad Comparison, Insights.
   - Sections are collapsed by default.
   - No sections/options selected by default in create mode.
   - Expanding a section shows options from that section.
   - KPI section shows current platform KPI rows so users can select which KPIs to include.
   - Benchmark section shows current platform Benchmark rows so users can select which Benchmarks to include.
5. Report details:
   - Report Name.
   - Description optional.
6. Schedule section:
   - `Schedule Automated Reports` checkbox.
   - Frequency.
   - Day of week/month/quarter timing when relevant.
   - Time.
   - Time zone display.
   - Email recipients required only when schedule is enabled.
7. Footer actions:
   - Cancel.
   - Create mode, unscheduled: `Generate & Download Report` with `Download` icon.
   - Create mode, scheduled: `Schedule Report`.
   - Edit mode: `Update Report`.
   - Edit mode update disabled until something changes.

### Report Data Rules

Reports must use source-backed current values:

- Overview report uses the platform Overview values.
- KPI report uses platform KPI rows plus source-backed current values.
- Benchmark report uses platform Benchmark rows plus source-backed current values.
- Ad Comparison report uses platform selected campaign/ad rows that are actually supported by the source contract.
- Insights report uses available source-backed metrics and unavailable reasons.
- Custom reports include only selected sections/subsections and selected KPI/Benchmark rows.

Report generation must not:

- Use placeholder metrics.
- Use stale saved KPI/Benchmark current values when source-backed current values are available.
- Use another platform's revenue, spend, or campaign rows.
- Create sent/downloadable snapshots for failed scheduled sends.
- Send scheduled reports when the campaign/source scope is missing or invalid.

### Reports Validation Checklist

Before a Reports section is considered complete:

- Reports tab exists in the standard tab order.
- Create Report opens the GA4-style Report Type modal.
- Standard Templates and Custom Report selector cards exist.
- No default selection in create mode unless explicitly documented.
- Submit is disabled until a valid selection exists.
- Unscheduled create says `Generate & Download Report`.
- Scheduled create says `Schedule Report`.
- Edit mode says `Update Report`.
- Edit mode update is disabled until something changes.
- Custom Report sections are collapsed by default.
- Custom Report starts with no selected values.
- KPI and Benchmark custom report sections show current platform rows.
- Report cards use Download/Pencil/Trash action icons.
- Delete has confirmation.
- Browser PDF output uses latest source-backed values.
- Scheduled report path fails closed on missing campaign/source scope.
- Failed scheduled sends do not create misleading snapshots.
- Regression tests cover create/edit/delete/download/scheduled-send behavior.

## Total Revenue Card Template

Source template:

- `client/src/pages/meta-analytics.tsx`
- `client/src/components/AddRevenueWizardModal.tsx`

Use Meta, not GA4, as the template for paid-media platform Total Revenue.

### Card Layout

Required card behavior:

- Card title: `Total Revenue`.
- Top-right `+` action.
- `+` opens `AddRevenueWizardModal`.
- Modal is launched with the platform's exact `platformContext`.
- If platform-scoped attributed revenue exists, show formatted revenue.
- If no platform-scoped attributed revenue exists, show `Not connected` or `Unavailable` with clear copy.
- If one or more active platform revenue sources exist, show `Sources (#)`.
- `Sources (#)` opens a revenue source dialog.

Revenue source dialog requirements:

- Title: `<Platform> Revenue Sources`.
- Description: `Sources contributing to <Platform> Total Revenue.`
- Each source row shows source label, source type, selected attribution count when available, and last total revenue when available.
- Each source row has edit and delete actions.
- Delete opens confirmation.
- Delete removes only the selected platform-scoped revenue source.
- Delete triggers refetch/recompute of Total Revenue, ROI, ROAS, KPI current values, Benchmark current values, Insights, Reports, scheduled report inputs, and aggregate consumers.

### Revenue Import Process

The shared revenue wizard must support:

- CSV.
- Google Sheets.
- HubSpot.
- Salesforce.
- Shopify.
- Manual only if the platform explicitly supports manual attributed revenue.

Google Sheets revenue import requirements:

- Google Sheets used inside a platform revenue wizard is a child financial source unless the user explicitly connected Google Sheets as the main campaign platform.
- Spreadsheet discovery and tab discovery may reuse any valid campaign Google Sheets OAuth token when no purpose-specific token row exists.
- Token reuse is allowed only for Google Drive/Sheets discovery metadata. The final selected connection must still be persisted with the exact platform revenue purpose, such as `meta_revenue`, `google_ads_revenue`, `instagram_revenue`, or `tiktok_revenue`.
- The required UI flow is: choose Google Sheets, authenticate or reuse an existing valid Google token, select spreadsheet, select tab, connect the tab, return to the Google Sheets chooser with that tab selected, then let the user click `Next` to preview/map columns.
- Do not auto-advance directly from tab selection to the mapping screen unless the source-specific tracker explicitly documents that deviation.
- The connected-tab chooser must display the user-facing sheet/tab name when `sheetName` exists. Do not show raw spreadsheet IDs or generated `Spreadsheet <id>` labels in place of the tab name.
- Regression coverage must guard spreadsheet discovery token reuse, tab discovery token reuse, the post-connect `Next` step, and clean tab-name display.

Paid-media platform mapping rules:

- Imported source values often use campaign names, codes, or CRM fields instead of provider campaign IDs.
- Paid-media platforms must provide campaign mapping when imported revenue rows need attribution to selected provider campaigns.
- Mapping options must come only from the campaign's selected connected platform campaign scope.
- Do not expose unselected provider campaigns as mapping targets.
- Do not allocate unmapped revenue by spend, clicks, impressions, or generic campaign split.

Post-import refresh rules:

- Invalidate/refetch platform revenue totals.
- Invalidate/refetch platform revenue sources.
- Invalidate/refetch platform analytics data.
- Invalidate/refetch platform KPIs.
- Invalidate/refetch platform Benchmarks.
- Invalidate/refetch platform Reports.
- Invalidate/refetch connected-platform status where relevant.
- Invalidate/refetch Campaign DeepDive aggregate consumers where relevant.
- Keep source modal content stable; avoid layout-jumping intermediate loading text.

### Total Revenue Safety Rules

- Total Revenue must use platform-scoped attributed revenue only.
- Revenue from GA4, another ad platform, unscoped CRM/ecommerce rows, or generic campaign rows must not unlock platform Total Revenue.
- ROI and ROAS must remain unavailable until platform-scoped attributed revenue and platform-scoped spend both exist.
- Pipeline Proxy must not be included in confirmed Total Revenue.
- Missing revenue must not render as `$0.00` unless the source is connected and exact platform-scoped revenue is proven to be zero.

## Pipeline Proxy Template

Source template:

- Meta-pattern CRM flow in `HubSpotRevenueWizard.tsx` and `SalesforceRevenueWizard.tsx`.

### Pipeline Proxy Meaning

Pipeline Proxy is an early signal for long sales cycles.

It is not confirmed revenue.

It must remain separate from:

- Total Revenue.
- ROI.
- ROAS.
- Revenue-dependent KPI current values.
- Revenue-dependent Benchmark current values.
- Confirmed revenue reports.
- Campaign DeepDive confirmed financial totals.

### Pipeline Proxy Wizard Behavior

CRM revenue wizards must offer the same choice as the Meta-pattern shared CRM flow:

- `Total Revenue + Pipeline (Proxy)`
- `Total Revenue only (no Pipeline card)`

If the user chooses `Total Revenue + Pipeline (Proxy)`:

- The wizard must ask for the open pipeline stage to use as the proxy.
- The proxy value must come from mapped source records in that selected stage.
- The source config must persist enough stage and total metadata for the platform Overview card to render without calling a GA4-only endpoint.

If the user chooses `Total Revenue only (no Pipeline card)`:

- No Pipeline Proxy card should count that source as configured.
- Only confirmed revenue should feed Total Revenue.

### Pipeline Proxy Card Rules

For future paid-media platforms:

- Show the Pipeline Proxy card if the platform design includes it.
- The card should render `Not configured` when no eligible CRM source is configured.
- The card may show `$0.00` when Pipeline Proxy is configured but the current selected stage total is exactly zero.
- The card may show `Sources (#)` for positive contributing sources.
- The card must open a read-only source dialog unless edit behavior is explicitly implemented.
- The card must not call GA4-only HubSpot/Salesforce pipeline endpoints unless those endpoints have been generalized and validated for the platform.

## Insights And Ad Comparison Expectations

These sections are not the main focus of this template file, but KPI/Benchmark/Report output depends on them.

Ad Comparison rules:

- Use the platform's persisted selected campaign/ad rows only.
- If ad-level source identifiers do not exist, compare the supported source level, such as selected campaign rows.
- Do not show old unavailable placeholders when supported campaign-level comparison rows exist.
- Use visual charts/graphs where they add business value, but charts must use the same source-backed rows as tables and callouts.

Insights rules:

- Use source-backed metrics and explicit unavailable reasons.
- Revenue guidance must respect platform-scoped attributed revenue availability.
- Do not create budget or revenue recommendations from unavailable metrics.

## Regression Requirements

Every new platform using these sections must include tests that enforce the template contract.

Minimum regression coverage:

- KPI section:
  - Create button exists.
  - Modal has required fields and alert section.
  - No default selected template.
  - Current Value populates from source-backed metric on template selection.
  - Revenue/spend templates are disabled when unavailable.
  - Number formatting helpers are present and used.

- Benchmark section:
  - Create button exists.
  - Modal has required fields and alert section.
  - No default selected template.
  - Current Value populates from source-backed metric on template selection.
  - Revenue/spend templates are disabled when unavailable.
  - Benchmark Value formats while typing and on blur.

- Reports section:
  - GA4-style Report Type modal exists.
  - Standard Templates and Custom Report selector cards exist.
  - Submit labels switch between `Generate & Download Report`, `Schedule Report`, and `Update Report`.
  - Custom Report starts with no selections and collapsed sections.
  - Edit mode disables Update Report until a change exists.
  - Delete confirmation exists.
  - Report output uses source-backed values.
  - Scheduled report path fails closed on invalid campaign/source scope.

- Total Revenue:
  - Card has `+` action.
  - Wizard uses correct `platformContext`.
  - Source dialog has edit/delete and delete confirmation.
  - Import/delete invalidates/refetches platform analytics, KPIs, Benchmarks, Reports, and aggregate consumers.
  - Revenue-dependent values do not unlock from unscoped revenue.

- Pipeline Proxy:
  - Wizard offers `Total Revenue + Pipeline (Proxy)` and `Total Revenue only`.
  - Pipeline Proxy remains separate from confirmed revenue.
  - Card renders configured/not configured states correctly.

## Implementation Workflow

For future integrations:

1. Read `AGENTS.md`.
2. Read `ARCHITECTURE_USER_JOURNEY.md`.
3. Read this file.
4. Read the platform tracker.
5. Identify the platform adapter fields before writing UI.
6. Copy the complete GA4 section behavior for KPIs, Benchmarks, and Reports.
7. Copy the Meta revenue import behavior for Total Revenue and Pipeline Proxy.
8. Implement the platform-specific current-value resolver.
9. Add regression tests that assert this template contract.
10. Validate with targeted tests and `npm run check`.

Do not implement a partial KPI, Benchmark, or Reports section and rely on browser screenshots to discover missing GA4 parity. If a platform cannot support a required field or behavior, document that deviation in the platform tracker before implementation.
