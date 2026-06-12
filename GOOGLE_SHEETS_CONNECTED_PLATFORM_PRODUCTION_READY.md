# Google Sheets Connected Platform Production-Ready Tracker

## Purpose

Track the work required to refine Google Sheets into a production-ready campaign-scoped connected platform.

This tracker covers Google Sheets in two distinct roles:

- Main connected platform: a campaign-level Google Sheets source selected through Create Campaign or Connected Platforms and viewed through Google Sheets analytics.
- Child financial source: Google Sheets used inside another platform's revenue or spend wizard, such as GA4, Meta, Google Ads, LinkedIn, Instagram, or TikTok attributed revenue.

These roles must stay separate. A Google Sheets tab used as TikTok attributed revenue, GA4 revenue, or ad-platform spend must not automatically become a main Google Sheets connected platform source.

## Target Integration Name

The target integration for this tracker is:

- `Google Sheets`

This is not the `Custom Integration` tracker. The Custom Integration instruction only applies when the target source is Custom Integration. However, because Google Sheets already has runtime code and known connection paths, the first Google Sheets step still must be a root-cause/code-path inventory and implementation roadmap before any runtime change.

## Required Template References

Future Google Sheets work must explicitly use:

- `CONNECTED_PLATFORM_SECTION_TEMPLATES.md`
- GA4 template for KPIs, Benchmarks, and Reports.
- Meta template for Total Revenue and Pipeline Proxy behavior.

Required source rules:

- Use source-backed metrics only.
- Do not use placeholders.
- Do not use generic campaign splits.
- Do not use unscoped values.
- Missing metrics must render unavailable with reasons.
- Live OAuth/provider validation must be tracked as a separate deferred commit if real Google OAuth validation is not available during local implementation.

Strict template enforcement rule:

- For every remaining Google Sheets KPI, Benchmark, Report, Total Revenue, Pipeline Proxy, refresh, scheduler, lifecycle, and final-readiness commit, `CONNECTED_PLATFORM_SECTION_TEMPLATES.md` is the implementation contract, not a loose reference.
- Before a section commit is marked complete, the relevant template checklist items must be traced item by item.
- Each applicable item must be one of:
  - implemented and regression-covered,
  - implemented and locally/browser validated where code regression coverage is not practical,
  - explicitly documented as an intentional Google Sheets-specific deviation with the reason and replacement behavior.
- Do not mark a section complete when the implementation only matches labels, rough layout, or backend support. Completion requires the required template behavior, source-specific metric adapter, formatting, unavailable reasons, alert behavior, edit/delete behavior, query refresh behavior, and report/schedule behavior where applicable.
- Regression tests must enforce every required template behavior that can be asserted from local source or API behavior. A test that only proves the old implementation is absent is not sufficient.
- Any item that cannot be validated locally must remain listed as pending browser/provider validation and must not be described as production-ready.

## Current Status

Google Sheets already exists in the codebase, but it has not yet been reviewed and hardened as a production-ready connected platform under the reusable section-template contract.

Current implementation foundations observed:

- `shared/schema.ts` defines `google_sheets_connections` with campaign ID, spreadsheet ID, sheet name, purpose, token fields, primary/active flags, column mappings, platform labels, cached data, and refresh timestamps.
- `server/routes-oauth.ts` includes Google Sheets OAuth exchange, sheet selection, multiple-tab selection, campaign source listing, source preview, connection list, primary selection, raw data analytics, and manual refresh routes.
- `server/storage.ts` includes Google Sheets connection CRUD and campaign cleanup behavior.
- `server/auto-refresh-scheduler.ts` refreshes Google Sheets revenue/spend child sources and raw Google Sheets cached data.
- `server/google-sheets-token-scheduler.ts` refreshes Google Sheets OAuth tokens.
- `client/src/components/GoogleSheetsConnectionFlow.tsx` and `client/src/components/SimpleGoogleSheetsAuth.tsx` provide Google Sheets connection UI.
- `client/src/pages/google-sheets-data.tsx` renders the Google Sheets analytics surface with Overview, Summary, KPIs, Benchmarks, Insights, Reports, and Connection Details.
- `client/src/pages/google-sheets-analytics/GoogleSheetsKpiModal.tsx`, `GoogleSheetsBenchmarkModal.tsx`, and `GoogleSheetsReportModal.tsx` provide Google Sheets-specific KPI, Benchmark, and Report modals.

Current risk:

- The existing Google Sheets implementation predates the reusable connected-platform section contract.
- Benchmark and Report modals are Google Sheets-specific and not yet proven to match the full GA4 template; the Commit 6 KPI scope has passed browser validation for the implemented Google Sheets dynamic-metric KPI behavior.
- Google Sheets analytics uses dynamic sheet columns, which is valid, but production readiness requires explicit source-backed current-value resolution and unavailable reasons instead of generic numeric-column assumptions.
- Google Sheets can be a main platform or a child financial source, so source identity must be tightened before aggregate participation, revenue, ROI, ROAS, KPI, Benchmark, Insights, or Reports are trusted.

## Root Cause Analysis

The root issue is not that Google Sheets is absent. It is already partially implemented. The root issue is that the existing implementation has not been normalized against the same production-ready connected-source contract now used for GA4, LinkedIn, Google Ads, Meta/Facebook, Instagram, and TikTok.

Specific root causes to address:

- Source role ambiguity: `google_sheets_connections` can represent a main campaign source, a revenue child source, a spend child source, or a legacy shared connection. Those roles can be confused unless purpose/platform context is enforced at every read and render boundary.
- Template drift: Google Sheets Benchmark and Report modals do not yet prove full GA4 template parity, including template panels, field order, no default selections, source-backed current values, alert behavior, edit mode, delete confirmation, custom reports, and scheduled report semantics. Commit 6 KPI behavior is validated for the implemented Google Sheets dynamic-metric scope, while any broader final-readiness checklist reconciliation remains governed by the strict template enforcement rule.
- Dynamic metric ambiguity: Google Sheets can contain arbitrary columns. A numeric column should not automatically become a trusted executive metric unless it is selected/mapped and tied to the active campaign/source scope.
- Aggregate participation: Google Sheets now feeds the shared Campaign DeepDive connected-source aggregate contract locally, with browser/API validation passed for the child financial source exclusion path.
- Revenue and pipeline risk: Google Sheets may contain revenue or pipeline-like values, but Total Revenue, ROI, ROAS, and Pipeline Proxy must follow the Meta pattern and remain separate from arbitrary sheet metrics.
- Refresh/lifecycle risk: token refresh, raw data refresh, child revenue/spend refresh, delete, reconnect, and primary-tab changes must all preserve the same source identity and not resurrect stale rows or cached data.

## Production-Ready Target Contract

Google Sheets is production-ready only when all of the following are true:

- The campaign has an active main Google Sheets connection only when the user explicitly selected Google Sheets as a campaign connected platform.
- The selected spreadsheet, selected tab(s), purpose, mappings, and active/primary state are persisted and campaign-scoped.
- Google Sheets child connections used by another platform's revenue/spend wizard do not appear as main Connected Platforms unless Google Sheets was explicitly connected as a main platform.
- Google Sheets analytics reads only active, campaign-scoped, selected Google Sheets connection rows.
- Metrics shown in Overview, KPIs, Benchmarks, Insights, Reports, and Campaign DeepDive are sourced from selected sheet rows and mapped/detected metric columns for that connection.
- Missing or unmapped metrics render unavailable with reasons, not zero-filled conclusions.
- Total Revenue is available only when an explicit Google Sheets revenue mapping is configured for the Google Sheets platform context or the platform-specific child context being used.
- ROI and ROAS remain unavailable until both confirmed revenue and spend are available from the same approved Google Sheets source scope.
- Pipeline Proxy is separate from confirmed revenue and does not feed ROI, ROAS, KPI current values, Benchmark current values, Reports confirmed revenue, or Campaign DeepDive confirmed financial totals.
- Refresh and scheduler paths update the same source-backed records consumed by UI and reports.
- Delete, disconnect, reconnect, and primary-tab changes affect only the current campaign's Google Sheets records.
- Live OAuth/provider behavior is validated separately before being called production-ready.

## Source Capability Rules

Google Sheets may provide:

- Custom numeric metrics from selected active sheet rows.
- Spend when a mapped spend column is explicitly selected for the Google Sheets source scope.
- Revenue when a mapped revenue column is explicitly selected for the Google Sheets source scope.
- Conversions, leads, impressions, clicks, sessions, users, or other metrics only when those columns exist and are selected/mapped for the campaign source.
- Derived metrics such as CTR, CPC, CPM, conversion rate, ROI, and ROAS only when all required source-backed inputs exist in the same approved source scope.
- Pipeline Proxy only from an explicitly configured pipeline/proxy mapping.

Google Sheets must not provide:

- Paid-media metrics from another main platform unless those values are physically present in the selected sheet rows and explicitly mapped for Google Sheets.
- Revenue from another platform's attributed revenue child source unless the active Google Sheets platform scope explicitly owns that source.
- Campaign-wide generic totals from unrelated sources.
- Placeholder campaign splits.
- Unscoped values from inactive, deleted, stale, or child-only sheet connections.
- ROI or ROAS from Pipeline Proxy.

## No-Double-Counting Rules

Google Sheets has the highest double-counting risk because it can import data about other platforms.

Required rules:

- A Google Sheets row used as a child revenue source for TikTok, Meta, Google Ads, LinkedIn, Instagram, or GA4 must stay inside that parent platform's financial path.
- A child financial Google Sheets connection must not appear as a separate main Google Sheets source in Campaign DeepDive.
- If Google Sheets is also connected as a main platform, only the explicitly selected main Google Sheets tabs/mappings may feed the main Google Sheets aggregate.
- The same Google Sheets connection/source ID must not contribute both as main Google Sheets revenue and as another platform's attributed revenue unless the user intentionally creates two separately scoped source records.
- Spend, revenue, ROI, and ROAS must be scoped by `purpose`, `platformContext`, source ID, campaign ID, and active status.
- Cached raw sheet data must not resurrect deleted source values after source deletion or reconnect.

## Existing Code/Path Inventory

Schema and storage:

- `shared/schema.ts`
  - `googleSheetsConnections`
  - `GOOGLE_SHEETS_PLATFORM_OPTIONS`
  - shared `spendSources`, `spendRecords`, `revenueSources`, and `revenueRecords`
- `server/storage.ts`
  - Google Sheets connection CRUD
  - campaign delete cleanup for Google Sheets connections
  - source and financial record helpers used by child revenue/spend flows

Backend routes and jobs:

- `server/routes-oauth.ts`
  - `/api/google-sheets/oauth-exchange`
  - `/api/google-sheets/:spreadsheetId/sheets`
  - `/api/google-sheets/select-spreadsheet`
  - `/api/google-sheets/select-spreadsheet-multiple`
  - `/api/campaigns/:id/google-sheets-connections`
  - `/api/campaigns/:id/google-sheets-data`
  - `/api/campaigns/:id/google-sheets-refresh`
  - `/api/campaigns/:id/revenue/sheets/preview`
  - `/api/campaigns/:id/revenue/sheets/process`
  - `/api/campaigns/:id/spend/sheets/preview`
  - `/api/campaigns/:id/spend/sheets/process`
  - `/api/campaigns/:id/data-sources`
  - Google Sheets transfer and legacy helper routes that need reachability review before production-ready claims
- `server/auto-refresh-scheduler.ts`
  - Google Sheets revenue reprocess
  - Google Sheets spend reprocess
  - raw Google Sheets data cache refresh
- `server/google-sheets-token-scheduler.ts`
  - OAuth token refresh

Frontend paths:

- `client/src/components/GoogleSheetsConnectionFlow.tsx`
- `client/src/components/SimpleGoogleSheetsAuth.tsx`
- `client/src/components/UploadAdditionalDataModal.tsx`
- `client/src/components/GoogleSheetsDatasetsView.tsx`
- `client/src/pages/google-sheets-data.tsx`
- `client/src/pages/google-sheets-analytics/GoogleSheetsKpiModal.tsx`
- `client/src/pages/google-sheets-analytics/GoogleSheetsBenchmarkModal.tsx`
- `client/src/pages/google-sheets-analytics/GoogleSheetsReportModal.tsx`
- shared revenue wizard paths in `client/src/components/AddRevenueWizardModal.tsx`

Regression files already touching Google Sheets:

- `server/source-safety-regression.test.ts`
- `server/endpoint-auth-audit.test.ts`
- `server/ga4-ui-regression.test.ts`
- `server/ga4-auto-refresh-regression.test.ts`
- `server/google-ads-revenue-sheets-flow.test.ts`
- `server/google-ads-revenue-wizard-context.test.ts`
- `server/revenue-additivity.test.ts`
- `server/utils/googleSheetsSelection.test.ts`

## Commit Bundling Rule

Subcommits below are the validation checklist. Git commits should bundle by parent commit/risk boundary after the subcommits in that parent are complete and validated.

Do not bundle across a new runtime exposure boundary. Source identity, Create Campaign/Connected Platforms, analytics, aggregate, KPI/Benchmark, Reports, revenue/pipeline, refresh/scheduler, lifecycle, and live OAuth validation should remain separate parent bundles.

## Implementation Roadmap

### Commit 1: Documentation, Inventory, And Acceptance Contract

Goal:

- Establish the Google Sheets production-readiness contract before code changes.

Subcommits:

- 1A: Required docs and template references reviewed.
- 1B: Current Google Sheets code/path inventory recorded.
- 1C: Main-platform versus child-source distinction documented.
- 1D: Source capability, no-double-counting, validation, and deferred live OAuth rules documented.

Validation:

- Confirm this file exists.
- Confirm it explicitly references `CONNECTED_PLATFORM_SECTION_TEMPLATES.md`.
- Confirm it states GA4 is the KPI/Benchmark/Reports template.
- Confirm it states Meta is the Total Revenue/Pipeline Proxy template.
- Confirm it says Google Sheets is not Custom Integration.

Status:

- [x] Created locally.

### Commit 2: Main Platform Versus Child Source Identity

Goal:

- Prevent child revenue/spend Google Sheets connections from being treated as main Google Sheets connected platforms.

Subcommits:

- 2A: Trace `google_sheets_connections.purpose`, `platforms`, `columnMappings`, and active/primary semantics.
- 2B: Define the main Google Sheets connection eligibility rule.
- 2C: Define child revenue/spend eligibility and exclusion from main Connected Platforms.
- 2D: Harden Connected Platforms status and analytics path rules if needed.
- 2E: Add regression coverage for main Google Sheets versus child-source isolation.

Validation:

- Campaign with Google Sheets as main source shows Google Sheets connected.
- Campaign with only Google Sheets child revenue/spend source does not show Google Sheets as a main connected platform.
- Connected Platforms route exposes no misleading analytics path for child-only Google Sheets.

Status:

- [x] Completed locally for the Connected Platforms main-platform status boundary: child-only Google Sheets revenue/spend connections no longer expose `connected: true`, an analytics path, or a connected timestamp as a main Google Sheets platform.
- [x] Regression guard added in `server/source-safety-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/source-safety-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] User/browser validation passed for Commit 2.
- [x] Follow-up browser-reported revenue import hardening completed:
  - Spreadsheet discovery now reuses a valid campaign Google Sheets token when no purpose-specific revenue token row exists.
  - Tab discovery now uses the same token-reuse boundary, so selecting a spreadsheet can load tabs for platform revenue import.
  - The revenue wizard keeps the original flow: selected tab returns to the Google Sheets chooser, then the user clicks `Next` to preview/map columns.
  - The revenue chooser displays the selected tab name, such as `ROI_ROAS_Calculations`, instead of raw spreadsheet IDs or `spreadsheetId - tab` labels.
- [x] Follow-up commits pushed:
  - `a5220546 fix: reuse Google Sheets tokens for revenue picker`
  - `15540ae7 fix: reuse Google Sheets tokens for tab picker`
  - `c8243ee9 fix: advance Google Sheets revenue wizard after tab selection`
  - `ab5a91ac fix: keep Google Sheets revenue flow on Next step`
  - `2281ad36 fix: show Google Sheets tab name in revenue chooser`
- [x] Follow-up local validation passed after the fixes: `npm test -- server/source-safety-regression.test.ts`.
- [x] Follow-up local validation passed after the fixes: `npm run check`.
- [ ] Remaining Google Sheets source-identity hardening beyond the Connected Platforms status boundary is tracked in later revenue/spend, refresh, and lifecycle commits.

### Commit 3: Create Campaign And Connected Platforms Setup

Goal:

- Make Google Sheets setup use one campaign-scoped source contract in both user paths.

Subcommits:

- 3A: Trace Create Campaign Google Sheets flow and draft-to-final campaign behavior.
- 3B: Trace adding Google Sheets later from Connected Platforms.
- 3C: Require selected spreadsheet/tab and explicit source purpose before final connection state.
- 3D: Preserve stable UI states and avoid layout-jumping connection text.
- 3E: Add setup/invalidation regression coverage.
- 3F: Expose the add-another-tab path from Google Sheets analytics after `View Detailed Analytics`.
- 3G: Reset inherited scroll position when Google Sheets analytics opens from `View Detailed Analytics`.
- 3H: Stabilize the Google Sheets analytics top layout while connections and sheet data load.
- 3I: Keep the Google Sheets analytics header action row width stable while `Open in Sheets` becomes available.
- 3J: Ensure Google Sheets analytics `Add Dataset` appends new tabs without replacing existing tabs.

Validation:

- Create Campaign -> Google Sheets -> select spreadsheet/tab -> finalize campaign.
- Existing campaign -> Connected Platforms -> add Google Sheets -> select spreadsheet/tab.
- Existing campaign -> Google Sheets -> `View Detailed Analytics` -> `Add Dataset` -> select another tab without replacing existing tabs.
- Existing campaign -> Google Sheets -> `View Detailed Analytics` opens at the top of Google Sheets analytics instead of inheriting the campaign page scroll position.
- Existing campaign -> Google Sheets -> `View Detailed Analytics` keeps the header, sheet selector area, and tab bar stable while data loads.
- Existing campaign -> Google Sheets -> `View Detailed Analytics` and browser refresh keep the title/action row stable when `Open in Sheets` becomes available.
- Existing campaign -> Google Sheets -> `View Detailed Analytics` -> `Add Dataset` preserves the existing tab and adds the newly selected tab.
- Failed/cancelled setup does not leave a connected main source.
- Connected Platforms, analytics, and aggregate queries refetch after successful setup.

Status:

- [x] Completed locally for the setup-flow boundary:
  - Create Campaign Google Sheets setup now explicitly uses `selectionMode="replace"` with the main-platform `general` Google Sheets purpose.
  - Connected Platforms Google Sheets setup now explicitly uses `selectionMode="append"` with the main-platform `general` Google Sheets purpose.
  - Connected Platforms setup persists `google-sheets` into the campaign platform list after a successful selected-tab connection.
  - Connected Platforms setup invalidates campaign, connected-platform, and Google Sheets connection status queries after the platform list is updated.
  - Google Sheets analytics now exposes the existing `Add Dataset` flow from the page header so users can add another tab after `View Detailed Analytics`.
  - Google Sheets analytics resets inherited route scroll before paint so the page opens at the header, not mid-spreadsheet.
  - Google Sheets analytics reserves the sheet selector/active-source area and no longer renders a pre-tab skeleton grid that disappears after load.
  - Google Sheets analytics reserves the `Open in Sheets` action slot and prevents header text/actions from wrapping during initial load or browser refresh.
  - Google Sheets analytics `Add Dataset` now uses append mode through the shared Google Sheets auth modal so existing tabs are preserved.
- [x] Regression guards added in `server/source-safety-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/source-safety-regression.test.ts server/endpoint-auth-audit.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] Commit 3F local validation passed: `npm test -- server/source-safety-regression.test.ts server/endpoint-auth-audit.test.ts`.
- [x] Commit 3F local validation passed: `npm run check`.
- [x] Commit 3H local validation passed: `npm test -- server/source-safety-regression.test.ts server/endpoint-auth-audit.test.ts`.
- [x] Commit 3H local validation passed: `npm run check`.
- [x] Commit 3I local validation passed: `npm test -- server/source-safety-regression.test.ts server/endpoint-auth-audit.test.ts`.
- [x] Commit 3I local validation passed: `npm run check`.
- [x] Commit 3J local validation passed: `npm test -- server/source-safety-regression.test.ts server/endpoint-auth-audit.test.ts`.
- [x] Commit 3J local validation passed: `npm run check`.
- [x] Browser validation passed after deploy for Create Campaign, Connected Platforms setup, Google Sheets analytics `View Detailed Analytics`, stable page transition/refresh, and `Add Dataset` append paths.

### Commit 4: Source-Backed Google Sheets Analytics Contract

Goal:

- Make Google Sheets Overview/Summary metrics explicitly source-backed and unavailable-safe.

Subcommits:

- 4A: Define the Google Sheets metric adapter from selected connection rows and mapped/detected columns.
- 4B: Preserve dynamic custom metrics while requiring campaign-scoped selected rows.
- 4C: Replace any unscoped or heuristic values that can appear as executive metrics.
- 4D: Document approved source-specific exception for Google Sheets tab order if `Summary` remains separate from `Ad Comparison`.
- 4E: Add regression coverage for no-placeholder/no-unscoped metric rendering.

Validation:

- Selected sheet values match Overview/Summary cards.
- Empty or unmapped sheets render unavailable reasons.
- Deleted/inactive connections do not contribute.
- Child-only revenue/spend sheets do not populate main Google Sheets analytics.

Status:

- [x] Completed locally for the main-source analytics scoping boundary:
  - Google Sheets analytics now requests `scope=main` for the connection list used by the sheet selector.
  - The `scope=main` connection list returns only active, non-pending, campaign-level Google Sheets rows whose purpose is blank/legacy or `general`, and only when the campaign is explicitly configured with Google Sheets as a main platform.
  - The `/api/campaigns/:id/google-sheets-data` route resolves combined and single-sheet reads from the same main-source connection set.
  - Child revenue/spend Google Sheets rows are excluded from main Google Sheets analytics reads.
- [x] Regression guards added in `server/source-safety-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/source-safety-regression.test.ts server/endpoint-auth-audit.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] Browser validation passed after deploy for selected-tab values, combined view, child-source exclusion, and empty/unmapped sheet handling.
  - Main Google Sheets tabs render as the Google Sheets analytics source.
  - Combined view stays scoped to main Google Sheets tabs.
  - A Meta campaign with Google Sheets revenue imported as a child source does not expose that child sheet as main Google Sheets analytics, including direct navigation to `/campaigns/:id/google-sheets-data`.
  - Empty or unmapped Google Sheets analytics states do not display child revenue/spend values as main Google Sheets metrics.

### Commit 5: Campaign DeepDive Aggregate Participation

Goal:

- Feed Google Sheets into Campaign DeepDive through the shared connected-source aggregate contract only.

Subcommits:

- 5A: Build or verify a Google Sheets platform-source resolver.
- 5B: Add Google Sheets to `/outcome-totals` only when it is an active main source.
- 5C: Add Google Sheets to Executive Summary and scheduler snapshot inputs through the same source contract if supported.
- 5D: Include unavailable metric reasons for unmapped or unsupported metrics.
- 5E: Add no-double-counting regression coverage.

Validation:

- Google Sheets-only campaign appears once in `performanceSummary.sources`.
- GA4 plus Google Sheets keeps GA4 and Google Sheets values separate.
- Google Sheets child revenue/spend sources do not appear as separate main sources.
- Unavailable paid-media-only metrics remain unavailable.

Status:

- [x] Completed locally for the shared Campaign DeepDive aggregate boundary:
  - Root cause: the shared aggregate helper already accepted generic main-platform sources, but the Google Sheets main source was never built or passed into `/api/campaigns/:id/outcome-totals`, Executive Summary, or scheduler/manual snapshot inputs.
  - Root cause: `storage.getGoogleSheetsConnections()` did not return persisted `cachedData` or `lastDataRefreshAt`, so aggregate callers could not compute source-backed Google Sheets metrics from already-refreshed selected sheet rows.
  - Added a Google Sheets aggregate source resolver that uses only active main Google Sheets connections for campaigns whose platform list includes Google Sheets.
  - The resolver reads persisted cached rows plus column mappings only; aggregate paths do not call live Google APIs.
  - Child revenue/spend purposes remain excluded from main Google Sheets aggregate source rows.
  - Revenue, spend, ROI, and ROAS remain excluded from this main Google Sheets aggregate source until the dedicated financial-source commits are implemented.
  - `/outcome-totals`, Executive Summary, and scheduler/manual snapshot performance summaries now pass Google Sheets through the shared generic source contract.
- [x] Regression guards added in `server/google-sheets-aggregate-source.test.ts` and `server/source-safety-regression.test.ts`.
- [x] Neighboring Campaign DeepDive aggregate regression guard updated in `server/campaign-financial-analysis-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/google-sheets-aggregate-source.test.ts server/source-safety-regression.test.ts server/performance-summary-scheduler-regression.test.ts server/executive-summary-regression.test.ts server/instagram-connected-platforms-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/campaign-performance-overview-regression.test.ts server/performance-summary-insights-regression.test.ts server/platform-comparison-regression.test.ts server/campaign-financial-analysis-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] Browser/API validation passed after deploy for the user-confirmed child-only revenue/spend exclusion path:
  - Direct `/api/campaigns/:id/outcome-totals` validation on a Meta campaign with Google Sheets revenue imported as a child source did not expose `id: "google_sheets"` as a main `performanceSummary.sources` row.
  - This confirms the child revenue sheet is not displayed as a main Google Sheets Campaign DeepDive analytics source.
- Additional optional live evidence, not a Commit 5 blocker:
  - A separate main Google Sheets campaign should appear once in `performanceSummary.sources` when one is available for live validation.
  - A campaign with both GA4 and Google Sheets should keep those source rows separate when one is available for live validation.

### Commit 6: KPI Section GA4 Template Parity

Goal:

- Make Google Sheets KPIs follow the full GA4 KPI section and modal contract with a dynamic Google Sheets metric adapter.

Subcommits:

- 6A: Replace/align KPI section layout with GA4 pattern.
- 6B: Add GA4-style Create/Edit KPI modal field order.
- 6C: Use no default template/metric selection in create mode.
- 6D: Populate Current Value from selected Google Sheets source-backed metric only.
- 6E: Format units and values correctly for dynamic sheet metrics.
- 6F: Keep KPI financial-looking sheet columns source-backed without treating them as confirmed campaign financial rollups.
- 6G: Add alert, edit, delete, and query-refresh parity.
- 6H: Add regression coverage for the full template contract.

Validation:

- Create KPI button matches GA4 placement and behavior.
- Modal fields match GA4 order.
- Current Value updates from selected sheet metric.
- Missing metrics do not become zero.
- Revenue/Spend/ROI/ROAS columns are selectable when they are explicit numeric columns in the selected main Google Sheets source; this does not mark them as confirmed campaign financial rollups.

Status:

- [x] Completed locally for the Google Sheets KPI section boundary:
  - Root cause: the Google Sheets KPI section predated the GA4 KPI template and used a plain metric dropdown plus editable `currentValue`, allowing KPI values to drift from selected Google Sheets source rows.
  - Root cause: KPI card rendering fell back to saved KPI `currentValue` when a sheet metric was missing, which could show stale or zero-like conclusions instead of an unavailable state.
  - Added a Google Sheets KPI metric adapter derived only from the already scoped Google Sheets analytics summary for the selected main sheet view.
  - KPI creation/update now requires a selected mapped Google Sheets metric with a source-backed current value.
  - KPI current value is read-only in the modal and populated from the selected metric adapter.
  - Explicit numeric sheet columns such as Revenue, Spend, ROI, and ROAS are selectable as source-backed Google Sheets KPI metrics without feeding Campaign DeepDive confirmed financial totals.
  - Existing KPI rows whose metric is missing render as unavailable and are excluded from KPI summary scoring instead of falling back to saved values.
  - KPI section now follows the GA4-style header, Create KPI action, summary tracker, edit/delete controls, immediate alert-frequency default, and alert settings layout.
  - Follow-up root cause: the Google Sheets KPI performance tracker and KPI cards still used local pre-template status buckets/card markup after the source-backed KPI adapter was added.
  - Follow-up fix: Google Sheets KPI tracker now uses the same GA4 `+/-5%` target banding and shared KPI math helpers, and KPI cards now follow the GA4 icon/header, current/target panel, progress bar, and target-delta pattern.
- [x] Regression guard added in `server/source-safety-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/source-safety-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] Browser validation passed after deploy for the implemented Commit 6 Google Sheets KPI scope:
  - Create KPI opens the Google Sheets KPI modal with mapped metric tiles instead of the old metric dropdown.
  - No `Timeframe` field appears in the KPI modal.
  - The KPI Name field is not auto-focused/highlighted by default when the modal opens.
  - Metric tiles do not show inline `Current value` text.
  - Selecting a metric tile still populates the read-only Current Value field from the selected source-backed Google Sheets metric.
  - Current Value and Target Value formatting displays thousands separators.
  - Explicit numeric financial-looking sheet columns such as Revenue, Spend, ROI, and ROAS are selectable as Google Sheets KPI metrics without feeding Campaign DeepDive confirmed financial totals.
  - Financial-looking KPI units infer correctly from the selected sheet column name, so Revenue uses `$` instead of `count`.
  - KPI performance tracker uses the GA4 `+/-5%` threshold labels and banding for Above Target, On Track, and Below Target.
  - KPI cards follow the GA4 card pattern with icon/header, metric badge, Current/Target panels, progress bar, and above/below target delta text.
  - The Google Sheets analytics page no longer exposes a page-level horizontal scrollbar from the sidebar/content flex layout.
  - Alert settings and create/edit/delete behavior remain on the existing Google Sheets platform KPI routes.

### Commit 7: Benchmark Section GA4 Template Parity

Goal:

- Make Google Sheets Benchmarks follow the full GA4 Benchmark section and modal contract with a dynamic Google Sheets metric adapter.

Subcommits:

- 7A: Replace/align Benchmark section layout with GA4 pattern.
- 7B: Add GA4-style Create/Edit Benchmark modal field order.
- 7C: Use no default template/metric selection in create mode.
- 7D: Populate Current Value from selected Google Sheets source-backed metric only.
- 7E: Format Benchmark Value while typing and on blur.
- 7F: Keep financial-looking Benchmark sheet columns source-backed without treating them as confirmed campaign financial rollups.
- 7G: Add alert, edit, delete, and query-refresh parity.
- 7H: Trace every applicable Benchmark checklist item in `CONNECTED_PLATFORM_SECTION_TEMPLATES.md` and document implemented items or intentional Google Sheets-specific deviations.
- 7I: Add regression coverage that enforces every applicable Benchmark template behavior, including modal field order, no default selection, source-backed current value, number formatting, unavailable reasons, alert behavior, edit/delete controls, and query refresh.

Validation:

- Create Benchmark button matches GA4 placement and behavior.
- Modal fields match GA4 order.
- Current Value updates from selected sheet metric.
- Current Value and Benchmark Value format according to the template.
- Missing metrics do not become zero.
- Explicit numeric financial-looking sheet columns such as Revenue, Spend, ROI, and ROAS are selectable as Google Sheets Benchmark metrics when the selected main sheet provides source-backed values; this does not mark them as confirmed campaign financial rollups.
- Regression test fails if any locally assertable Benchmark template behavior is missing.
- Any Benchmark template item not validated in code/browser must remain documented as pending or as an intentional deviation.

Status:

- [x] Completed locally for the Google Sheets Benchmark section boundary:
  - Root cause: the Google Sheets Benchmark section still used the pre-template dropdown/modal and simple `Actual / Benchmark / Variance` cards, while the GA4 Benchmark template requires metric tiles, source-backed current values, summary tracker cards, progress bars, status text, and edit/delete card controls.
  - Root cause: Benchmark create/update accepted a manually editable or saved `currentValue`, so stale values could persist when the selected Google Sheets metric was unavailable.
  - Added a Google Sheets Benchmark metric adapter using the same selected main Google Sheets summary values as the KPI adapter.
  - Benchmark creation/update now requires a selected mapped Google Sheets metric with a source-backed current value.
  - Benchmark Current Value is read-only in the modal and populated from the selected metric adapter.
  - Benchmark Value formats while typing and on blur.
  - Google Sheets Benchmark tracker now follows the GA4 summary cards and thresholds: `On Track` is `90% or more of benchmark`, `Needs Attention` is `70% to under 90% of benchmark`, and `Behind` is `below 70% of benchmark`.
  - Benchmark cards now follow the GA4 icon/header, metric badge, Current/Benchmark panel, progress bar, performance delta, alert indicator, edit action, and delete confirmation pattern.
  - Existing Benchmark rows whose metric is missing render as unavailable and are excluded from Benchmark summary scoring instead of falling back to saved current values.
  - Explicit numeric sheet columns such as Revenue, Spend, ROI, and ROAS are selectable as source-backed Google Sheets Benchmark metrics without feeding Campaign DeepDive confirmed financial totals.
  - Alert settings keep the existing Google Sheets platform Benchmark routes and use the GA4 immediate default for new Benchmark alerts.
  - Intentional Google Sheets-specific deviation: free-form `Create Custom Benchmark` is not exposed in this Commit 7 scope because Google Sheets Benchmark current values must be source-backed from selected sheet columns; adding a manual-current Benchmark path would violate the source-backed rule.
  - Follow-up root cause: Google Sheets Benchmark create/update normalized `benchmarkValue` and source-backed `currentValue` to numbers, but the shared Benchmark insert schema expects decimal fields as strings, causing the backend to reject creates with `Invalid benchmark data`.
  - Follow-up fix: Google Sheets Benchmark payloads now send `benchmarkValue`, `currentValue`, and alert threshold as schema-compatible decimal strings.
  - Follow-up root cause: edit mode copied stored Benchmark decimal strings directly into the form, so count metrics such as Customers displayed `140.00` instead of the logical whole-count value `140`.
  - Follow-up fix: Google Sheets Benchmark edit-prefill now formats count/integer Benchmark and alert-threshold values without meaningless `.00` suffixes.
- [x] Regression guard added in `server/source-safety-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/source-safety-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] Browser validation passed after deploy for the implemented Commit 7 Google Sheets Benchmark scope:
  - Create Benchmark opens the Google Sheets Benchmark modal with mapped metric tiles instead of the old metric dropdown.
  - Current Value is read-only and populated from the selected source-backed Google Sheets metric.
  - Benchmark Value accepts formatted numeric input and saves without the `Invalid benchmark data` error.
  - Edit mode displays count/integer Benchmark values logically, for example Customers `140` instead of `140.00`.
  - Benchmark tracker uses GA4 `90% / 70%` thresholds and labels.
  - Benchmark cards follow the GA4 icon/header, metric badge, Current/Benchmark panels, progress bar, performance delta, edit action, and delete confirmation pattern.

### Commit 8: Reports Section GA4 Template Parity

Goal:

- Make Google Sheets Reports follow the full GA4 Reports section, custom report, and scheduled report contract.

Subcommits:

- 8A: Align Reports tab layout and Create Report action with GA4.
- 8B: Align Report Type modal with GA4 Standard Templates and Custom Report sections.
- 8C: Start create mode with no selected template/section.
- 8D: Make custom sections collapsed by default.
- 8E: Show current Google Sheets KPI and Benchmark rows inside Custom Report options.
- 8F: Use `Generate & Download Report`, `Schedule Report`, and `Update Report` labels correctly.
- 8G: Disable Update Report until something changes in edit mode.
- 8H: Ensure browser PDFs and scheduled PDFs use latest source-backed values.
- 8I: Add scheduled-send fail-closed and no-fake-snapshot regression coverage.
- 8J: Trace every applicable Reports checklist item in `CONNECTED_PLATFORM_SECTION_TEMPLATES.md` and document implemented items or intentional Google Sheets-specific deviations.
- 8K: Add regression coverage that enforces every applicable Reports template behavior, including report type modal structure, no default selected template/section, custom section collapse state, KPI/Benchmark source-backed row inclusion, create/update/download/schedule labels, disabled Update behavior, delete confirmation, PDF value source, scheduled-send fail-closed behavior, and no misleading snapshots.

Validation:

- Create, edit, delete, download, and schedule report flows match GA4 behavior.
- Report cards use Download/Pencil/Trash icons and delete confirmation.
- Report output uses selected Google Sheets current values, KPI rows, and Benchmark rows.
- Scheduled reports do not send or snapshot when campaign/source scope is invalid.
- Regression test fails if any locally assertable Reports template behavior is missing.
- Any Reports template item not validated in code/browser must remain documented as pending or as an intentional deviation.

Status:

- [x] Completed locally for the Google Sheets Reports section boundary:
  - Root cause: the Google Sheets Reports tab and modal predated the strict GA4 Reports template, so create mode could reuse stale form/config state, custom reports used a flat metric/KPI/Benchmark picker instead of collapsed sections, and the tab did not expose the required Download/Pencil/Trash card action pattern.
  - Root cause: scheduled Google Sheets report payloads sent UI values such as `monday` and `9:00 AM`, while the shared platform report route validates `scheduleDayOfWeek` as `0-6`, `scheduleTime` as `HH:MM`, and requires `scheduleTimeZone`.
  - Root cause: scheduled/server report output could fall through generic report behavior instead of proving Google Sheets source-backed output from current sheet rows.
  - Reports tab header now reads `Google Sheets Reports`; Create Report resets edit state, report type, custom configuration, expanded sections, validation errors, and edit snapshot state.
  - Report cards now expose Download, Pencil edit, and Trash delete-confirmation actions.
  - Report modal keeps `Report Type`, `Standard Templates`, `Custom Report`, and `Choose Template` anchors; create mode starts with no selected report template.
  - Standard templates include Overview, KPIs, Benchmarks, Insights, and an explicit disabled Ad Comparison unavailable state because Google Sheets rows are not ad-level entities.
  - Custom Report now uses collapsed-by-default sections for Overview, KPIs, Benchmarks, Ad Comparison, and Insights; KPI and Benchmark sections list current Google Sheets platform rows.
  - Footer labels are `Generate & Download Report`, `Schedule Report`, and `Update Report`; create submit is disabled until a template or custom section is selected, and edit Update is disabled until a value changes.
  - Scheduled report create/update now sends schedule fields in the shared route contract shape and includes the browser IANA time zone.
  - Browser/download PDF generation uses the current loaded Google Sheets metric adapter plus current KPI/Benchmark rows instead of saved KPI/Benchmark current values.
  - Scheduled/test/direct snapshot PDF generation now uses a Google Sheets-specific source-backed builder from cached sheet rows and current platform KPI/Benchmark rows; Google Sheets reports are included in scheduler selection and fail closed when source-backed output cannot be built.
  - Intentional Google Sheets-specific deviation: Ad Comparison remains visible but disabled/unavailable until a source contract supplies ad-level rows; this is documented in the UI and covered by regression.
- [x] Regression guard added in `server/source-safety-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/source-safety-regression.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] Browser validation passed after deploy for the implemented Commit 8 Google Sheets Reports scope:
  - Google Sheets Reports header renders as `Google Sheets Reports`.
  - Create Report opens with no standard template selected by default.
  - Standard Templates show Overview, KPIs, Benchmarks, disabled Ad Comparison, and Insights.
  - Custom Report sections are collapsed by default and no section/row is selected by default.
  - KPI and Benchmark custom sections show the current Google Sheets platform rows.
  - Generate & Download is disabled until a template or custom selection is made and creates a PDF from current sheet values.
  - Scheduled report creation saves without schedule validation errors.
  - Edit mode keeps Update Report disabled until a value changes.
  - Report cards show Download, Pencil edit, and Trash delete-confirmation actions.

### Commit 9: Total Revenue And Pipeline Proxy Meta Pattern

Goal:

- Make Google Sheets confirmed revenue and Pipeline Proxy follow the Meta pattern without confusing arbitrary sheet revenue columns with attributed revenue.

Subcommits:

- 9A: Define when a Google Sheets revenue column is confirmed Total Revenue.
- 9B: Add/align Total Revenue card with `+` source action where Google Sheets platform revenue is supported.
- 9C: Use `AddRevenueWizardModal` or existing shared source flow with the correct Google Sheets platform scope.
- 9D: Keep Pipeline Proxy separate from confirmed revenue.
- 9E: Ensure ROI/ROAS require confirmed revenue plus spend from the same approved source scope.
- 9F: Add source dialog edit/delete and post-delete recompute/refetch coverage.
- 9G: Add no-double-counting tests for Google Sheets main revenue versus child platform revenue.

Validation:

- Revenue column alone does not unlock ROI/ROAS unless explicitly mapped as confirmed Google Sheets revenue.
- Pipeline Proxy does not feed Total Revenue, ROI, ROAS, KPIs, Benchmarks, Reports, or Campaign DeepDive confirmed financial totals.
- Deleting a revenue source clears the card and downstream current values.

Status:

- [ ] Pending.

### Commit 10: Refresh, Scheduler, Token, And Cache Safety

Goal:

- Ensure refresh paths update the same scoped values used by the UI, aggregate, KPIs, Benchmarks, and Reports.

Subcommits:

- 10A: Trace Google Sheets token refresh scheduler.
- 10B: Trace raw data cache refresh for main Google Sheets sources.
- 10C: Trace revenue/spend child source reprocess.
- 10D: Fail closed on missing campaign/source/connection ownership.
- 10E: Preserve previous valid values on provider/API failure.
- 10F: Prevent stale cached data from resurrecting deleted source values.
- 10G: Add scheduler and refresh regression coverage.

Validation:

- Manual refresh updates visible source-backed values.
- Scheduler refresh updates the same source scope.
- Failed refresh records unavailable/freshness state without zeroing trusted values.
- Deleted source values do not return from cache.

Status:

- [ ] Pending.

### Commit 11: Disconnect, Delete, Reconnect, And Damaged Data Safety

Goal:

- Make Google Sheets lifecycle paths campaign-scoped and stale-data safe.

Subcommits:

- 11A: Trace connection delete and source delete routes.
- 11B: Ensure delete only affects current campaign/source rows.
- 11C: Ensure reconnect starts from selected current spreadsheet/tab/mapping state.
- 11D: Ensure primary-tab changes recompute dependent values and do not mix old/new tabs.
- 11E: Add a damaged-data cleanup plan only if stale/duplicate rows are proven.
- 11F: Add lifecycle regression coverage.

Validation:

- Delete one Google Sheets connection and confirm unrelated campaign/platform sources remain.
- Reconnect and confirm stale cached rows do not appear.
- Primary selection changes visible metrics only to the selected active connection.

Status:

- [ ] Pending.

### Commit 12: Final Local Regression And Evidence

Goal:

- Prove local/test-mode Google Sheets production readiness for the implemented source-backed scope.

Subcommits:

- 12A: Run targeted Google Sheets source safety tests.
- 12B: Run shared revenue/spend source tests.
- 12C: Run Campaign DeepDive aggregate tests after Google Sheets aggregate wiring.
- 12D: Run KPI/Benchmark/Report section template regression tests that enforce every locally assertable applicable item from `CONNECTED_PLATFORM_SECTION_TEMPLATES.md`.
- 12E: Run `npm run check`.
- 12F: Record browser validation evidence for Create Campaign and Connected Platforms paths.
- 12G: Reconcile the final Google Sheets implementation against `CONNECTED_PLATFORM_SECTION_TEMPLATES.md` item by item and leave no applicable item unmarked. Each item must be implemented, regression-covered, browser/provider-validated, or documented as an intentional Google Sheets-specific deviation.

Validation:

- All targeted tests pass.
- Browser validation confirms main Google Sheets connected platform behavior.
- Child-source no-double-counting validation passes.
- Final readiness documentation includes the item-by-item template compliance trace for KPIs, Benchmarks, Reports, Total Revenue, and Pipeline Proxy.
- Google Sheets is not marked locally production-ready if any applicable template behavior remains unimplemented, unvalidated, or undocumented.

Status:

- [ ] Pending.

### Commit 13: Live Google OAuth/Provider Validation

Goal:

- Validate live Google OAuth, Drive/Sheets discovery, token refresh, provider API fetch, and deployed scheduler behavior.

Subcommits:

- 13A: Live OAuth start/callback validation.
- 13B: Spreadsheet discovery validation.
- 13C: Tab selection and mapping validation.
- 13D: Token refresh validation.
- 13E: Raw data refresh validation.
- 13F: Scheduled report/provider evidence.
- 13G: Final live-readiness documentation update.

Validation:

- Live Google OAuth connects in deployed or production-like environment.
- Selected spreadsheet/tab rows match Google Sheets for the same range.
- Token refresh succeeds.
- Scheduler refresh updates scoped cached rows.
- Scheduled reports using Google Sheets values are received and match current app values.

Status:

- [ ] Deferred until real Google OAuth/provider validation evidence is available, if not available during implementation.

## Validation Matrix

Create Campaign:

- [ ] Select Google Sheets during campaign creation.
- [ ] Connect OAuth or approved test connection.
- [ ] Select spreadsheet and tab.
- [ ] Finalize campaign.
- [ ] Confirm Google Sheets appears as a main Connected Platform only for that campaign.
- [ ] Confirm Google Sheets analytics opens with selected source-backed values.

Connected Platforms:

- [ ] Add Google Sheets to an existing campaign.
- [ ] Select spreadsheet and tab.
- [ ] Confirm Connected Platforms updates without fake metrics.
- [ ] Confirm child revenue/spend Google Sheets does not appear as a main platform.

Analytics:

- [x] Overview/Summary values match selected sheet rows for the Commit 4 main-source analytics scope.
- [x] Empty or unmapped main Google Sheets analytics states do not populate from child revenue/spend sheets.
- [x] Direct navigation to Google Sheets analytics for a child-only revenue/spend campaign does not show child sheet rows as main Google Sheets analytics.
- [x] KPIs use current source-backed values for the Commit 6 Google Sheets KPI scope.
- [x] Commit 6 KPI browser validation passed after deploy for metric tiles, no Timeframe field, no default field focus, no tile-level current-value text, read-only source-backed Current Value, formatted Current/Target values, financial-looking KPI unit inference, GA4 `+/-5%` performance tracker thresholds, GA4-pattern KPI cards, and no page-level horizontal scrollbar.
- [x] Benchmarks use current source-backed values for the Commit 7 Google Sheets Benchmark scope.
- [x] Commit 7 Benchmark browser validation passed after deploy for metric tiles, read-only source-backed Current Value, successful Create Benchmark save, count edit-prefill formatting, GA4 `90% / 70%` tracker thresholds, and GA4-pattern Benchmark cards.
- [ ] Insights and Reports use current source-backed values.
- [ ] Reports and scheduled reports use latest values.

DeepDive:

- [x] Local regression: Google Sheets appears once in shared aggregate when connected as main source.
- [x] Local regression: Google Sheets child financial sources do not appear as main sources.
- [x] Local regression: GA4 plus Google Sheets keeps main Google Sheets metrics separate and does not unlock revenue, spend, ROI, or ROAS from the main Google Sheets source.
- [x] Browser/API validation: child-only Google Sheets revenue/spend sources do not appear as main Campaign DeepDive Google Sheets sources after deploy.
- Additional optional live evidence, not a Commit 5 blocker: main Google Sheets source display and GA4 plus Google Sheets source separation.

Lifecycle:

- [ ] Delete removes only current campaign Google Sheets source.
- [ ] Reconnect does not resurrect stale cached rows.
- [ ] Token refresh and data refresh preserve source scope.

## Production-Ready Exit Criteria

Google Sheets can be marked locally production-ready only when:

- Main-platform and child-source roles are isolated.
- Create Campaign and Connected Platforms setup paths are validated.
- Analytics values come only from selected active Google Sheets source rows.
- KPIs, Benchmarks, and Reports follow the GA4 template contract.
- Total Revenue and Pipeline Proxy follow the Meta template contract where supported.
- Every applicable item in `CONNECTED_PLATFORM_SECTION_TEMPLATES.md` has been traced and marked implemented, regression-covered, browser/provider-validated, or documented as an intentional Google Sheets-specific deviation.
- Regression coverage enforces every locally assertable required template behavior instead of only checking for high-level labels or absence of old UI.
- Campaign DeepDive consumes Google Sheets only through the shared aggregate contract.
- Missing metrics render unavailable with reasons.
- Refresh/scheduler/lifecycle paths are source-scoped and stale-data safe.
- Regression coverage protects the critical paths.
- Live OAuth/provider validation is either completed or explicitly deferred.

## Relevant Documentation

- `AGENTS.md`
- `ARCHITECTURE_USER_JOURNEY.md`
- `GA4/README.md`
- `GA4_DEVELOPMENT_WORKFLOW.md`
- `CONNECTED_PLATFORM_SECTION_TEMPLATES.md`
- `GA4/OVERVIEW.md`
- `GA4/KPIS.md`
- `GA4/BENCHMARKS.md`
- `GA4/REPORTS.md`
- `GA4/FINANCIAL_SOURCES.md`
- `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `META_FACEBOOK_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `INSTAGRAM_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `TIKTOK_CONNECTED_PLATFORM_PRODUCTION_READY.md`

## Latest Validation

- Tracker guard update: remaining Google Sheets section commits must treat `CONNECTED_PLATFORM_SECTION_TEMPLATES.md` as a strict checklist, trace every applicable item, and add regression coverage for every locally assertable required behavior before any section can be marked complete.
- Commit 1 tracker created locally after reading required project guidance and tracing current Google Sheets code paths.
- Commit 2 Connected Platforms source-identity slice completed locally: main Google Sheets platform status now uses the campaign-level Google Sheets eligibility flag instead of any active Google Sheets connection.
- Commit 2 validation passed locally: `npm test -- server/source-safety-regression.test.ts`.
- Commit 2 validation passed locally: `npm run check`.
- Commit 2 user/browser validation passed.
- Google Sheets revenue import follow-up fixes completed after browser validation:
  - Revenue spreadsheet picker reuses existing campaign Google Sheets tokens for discovery when purpose-specific token rows are absent.
  - Revenue tab picker reuses existing campaign Google Sheets tokens for tab discovery under the same boundary.
  - Revenue tab connection returns to the chooser with the selected tab and preserves the user-clicked `Next` step.
  - Revenue chooser labels selected tabs by `sheetName` and no longer shows raw spreadsheet IDs when a tab name exists.
- Follow-up validation passed locally: `npm test -- server/source-safety-regression.test.ts`.
- Follow-up validation passed locally: `npm run check`.
- Commit 3 setup-flow bundle completed locally:
  - Create Campaign Google Sheets setup uses explicit `replace` mode and main-platform `general` purpose.
  - Connected Platforms Google Sheets setup uses explicit `append` mode and main-platform `general` purpose.
  - Connected Platforms setup updates the campaign platform list with `google-sheets`.
  - Setup query invalidation covers campaign, connected-platform, and Google Sheets connection status queries.
  - Commit 3F exposes `Add Dataset` from the Google Sheets analytics header after `View Detailed Analytics`, reusing the existing append-mode dataset flow.
- Commit 3 validation passed locally: `npm test -- server/source-safety-regression.test.ts server/endpoint-auth-audit.test.ts`.
- Commit 3 validation passed locally: `npm run check`.
- Commit 3F validation passed locally: `npm test -- server/source-safety-regression.test.ts server/endpoint-auth-audit.test.ts`.
- Commit 3F validation passed locally: `npm run check`.
- Commit 3 browser validation passed after deploy:
  - Create Campaign Google Sheets setup works.
  - Connected Platforms Google Sheets setup works.
  - `View Detailed Analytics` opens the Google Sheets analytics page without unstable top-content jumps.
  - Browser refresh keeps the Google Sheets analytics header stable.
  - `Add Dataset` appends the new selected tab and preserves existing tabs.
- Commit 4 main-source analytics scoping completed locally:
  - Google Sheets analytics connection picker requests the main-source scope.
  - Google Sheets analytics API reads only campaign-level main Google Sheets rows, excluding child revenue/spend rows.
- Commit 4 validation passed locally: `npm test -- server/source-safety-regression.test.ts server/endpoint-auth-audit.test.ts`.
- Commit 4 validation passed locally: `npm run check`.
- Commit 4 browser validation passed after deploy:
  - Selected main Google Sheets tab values match the Google Sheets analytics Overview/Summary surface.
  - Combined view remains scoped to selected main Google Sheets tabs.
  - Child-only Google Sheets revenue/spend sheets do not populate main Google Sheets analytics.
  - Direct navigation to `/campaigns/:id/google-sheets-data` for a Meta campaign with Google Sheets revenue imported as a child source does not expose that child sheet as a main Google Sheets dataset.
  - Empty or unmapped Google Sheets analytics states remain unavailable/empty instead of showing unscoped child-source values.
- Commit 5 Campaign DeepDive aggregate participation completed locally:
  - Google Sheets was missing from the main-platform source composition for `/outcome-totals`, Executive Summary, and scheduler/manual snapshot performance summaries.
  - Google Sheets connection reads now include cached sheet rows and last-refresh metadata for aggregate-only use.
  - Main Google Sheets aggregate metrics are built only from active campaign-level `general` or legacy Google Sheets connections on campaigns configured with Google Sheets as a main platform.
  - Child revenue/spend Google Sheets sources remain excluded from main Google Sheets aggregate rows.
  - Revenue, spend, ROI, and ROAS remain unavailable from this main-source aggregate path pending the dedicated financial-source commits.
- Commit 5 validation passed locally: `npm test -- server/google-sheets-aggregate-source.test.ts server/source-safety-regression.test.ts server/performance-summary-scheduler-regression.test.ts server/executive-summary-regression.test.ts server/instagram-connected-platforms-regression.test.ts`.
- Commit 5 neighboring DeepDive validation passed locally: `npm test -- server/campaign-performance-overview-regression.test.ts server/performance-summary-insights-regression.test.ts server/platform-comparison-regression.test.ts server/campaign-financial-analysis-regression.test.ts`.
- Commit 5 validation passed locally: `npm run check`.
- Commit 5 browser/API validation passed after deploy for the direct child-source safety path:
  - A Meta campaign with Google Sheets revenue imported as a child source did not expose `id: "google_sheets"` as a main `performanceSummary.sources` row from `/api/campaigns/:id/outcome-totals`.
  - This confirms the child revenue sheet remains a child financial source and is not shown as main Google Sheets Campaign DeepDive analytics.
- Commit 6 Google Sheets KPI GA4-template parity completed locally:
  - Google Sheets KPI current values now come from a source-backed metric adapter built from selected main Google Sheets analytics summary data.
  - The KPI modal uses mapped metric tiles, no default metric selection, and a read-only current value populated by the selected source-backed metric.
  - Google Sheets KPI cards no longer fall back to saved KPI `currentValue` when the selected sheet metric is missing.
  - Explicit numeric sheet columns such as Revenue, Spend, ROI, and ROAS are selectable for Google Sheets KPIs, but remain unavailable from the main aggregate financial path until the dedicated financial-source commits.
  - KPI create/edit/delete UI behavior remains on the existing platform KPI routes.
- Commit 6 validation passed locally: `npm test -- server/source-safety-regression.test.ts`.
- Commit 6 validation passed locally: `npm run check`.
- Commit 6 browser validation passed after deploy:
  - KPI modal shows mapped Google Sheets metric tiles, not the old `Metric Source` dropdown.
  - `Timeframe` is removed from the KPI modal.
  - Opening the KPI modal does not auto-highlight the KPI Name field.
  - Metric tiles do not show inline `Current value` text.
  - Selecting a metric tile populates the read-only Current Value field from the selected source-backed Google Sheets metric.
  - Current Value and Target Value use thousands separators.
  - Revenue, Spend, ROI, and ROAS sheet columns are selectable as Google Sheets KPI metrics when numeric.
  - Revenue infers `$` instead of `count` for KPI unit display.
  - Google Sheets analytics content fits the page without a page-level horizontal scrollbar.
- Commit 6 GA4 KPI pattern follow-up completed locally:
  - Root cause: Google Sheets KPI tracker/card rendering still used local pre-template status buckets and card markup instead of the GA4 `CONNECTED_PLATFORM_SECTION_TEMPLATES.md` KPI pattern.
  - KPI performance tracker now uses the same GA4 `+/-5%` target banding and shared KPI math helpers.
  - KPI cards now use the GA4 icon/header, metric badge, Current/Target panels, progress label/bar, and above/below target delta text.
- Commit 6 GA4 KPI pattern follow-up validation passed locally: `npm test -- server/source-safety-regression.test.ts`.
- Commit 6 GA4 KPI pattern follow-up validation passed locally: `npm run check`.
- Commit 6 GA4 KPI pattern follow-up browser validation passed after deploy:
  - KPI performance tracker displays the GA4 `+/-5%` threshold labels for Above Target, On Track, and Below Target.
  - KPI cards display in the GA4 card pattern with icon/header, metric badge, Current/Target panels, progress bar, and above/below target delta text.
- Commit 7 Google Sheets Benchmark GA4-template parity completed locally:
  - Root cause: Google Sheets Benchmark tracker/card/modal rendering still used local pre-template dropdown, manual/saved current values, and `Actual / Benchmark / Variance` cards instead of the GA4 `CONNECTED_PLATFORM_SECTION_TEMPLATES.md` Benchmark pattern.
  - Benchmark current values now come from a source-backed metric adapter built from selected main Google Sheets analytics summary data.
  - The Benchmark modal uses mapped metric tiles, no default metric selection, a read-only Current Value populated by the selected source-backed metric, formatted Benchmark Value input, and the GA4 immediate alert-frequency default.
  - Benchmark performance tracker now uses the GA4 `90% / 70%` Benchmark thresholds and labels.
  - Benchmark cards now use the GA4 icon/header, metric badge, Current/Benchmark panels, progress label/bar, performance delta, edit action, and delete confirmation pattern.
  - Existing Benchmark rows whose mapped metric is missing render as unavailable and are excluded from scoring instead of falling back to saved current values.
  - Explicit numeric sheet columns such as Revenue, Spend, ROI, and ROAS are selectable for Google Sheets Benchmarks, but remain unavailable from the main aggregate financial path until the dedicated financial-source commits.
  - Intentional source-specific deviation: free-form manual `Create Custom Benchmark` is not exposed in this Google Sheets scope because current values must stay source-backed from selected sheet columns.
- Commit 7 validation passed locally: `npm test -- server/source-safety-regression.test.ts`.
- Commit 7 validation passed locally: `npm run check`.
- Commit 7 Benchmark create-payload follow-up completed locally:
  - Root cause: the frontend sent Benchmark decimal fields as numbers while the shared Benchmark schema requires strings.
  - Fix: Google Sheets Benchmark create/update payloads now send Benchmark Value, Current Value, and alert threshold as decimal strings.
- Commit 7 Benchmark create-payload follow-up validation passed locally: `npm test -- server/source-safety-regression.test.ts`.
- Commit 7 Benchmark create-payload follow-up validation passed locally: `npm run check`.
- Commit 7 Benchmark edit-prefill formatting follow-up completed locally:
  - Root cause: edit mode copied stored decimal strings directly into the form, so count metrics such as Customers displayed `140.00` instead of `140`.
  - Fix: Google Sheets Benchmark edit-prefill now formats count/integer Benchmark and alert-threshold values without meaningless `.00` suffixes.
- Commit 7 Benchmark edit-prefill formatting follow-up validation passed locally: `npm test -- server/source-safety-regression.test.ts`.
- Commit 7 Benchmark edit-prefill formatting follow-up validation passed locally: `npm run check`.
- Commit 7 browser validation passed after deploy:
  - Benchmark modal uses mapped Google Sheets metric tiles and source-backed Current Value.
  - Create Benchmark saves successfully without `Invalid benchmark data`.
  - Edit Benchmark displays count/integer values logically, for example Customers `140` instead of `140.00`.
  - Benchmark tracker and cards match the GA4 Benchmark template pattern.
