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
- KPI, Benchmark, and Report modals are Google Sheets-specific and not yet proven to match the full GA4 template.
- Google Sheets analytics uses dynamic sheet columns, which is valid, but production readiness requires explicit source-backed current-value resolution and unavailable reasons instead of generic numeric-column assumptions.
- Google Sheets can be a main platform or a child financial source, so source identity must be tightened before aggregate participation, revenue, ROI, ROAS, KPI, Benchmark, Insights, or Reports are trusted.

## Root Cause Analysis

The root issue is not that Google Sheets is absent. It is already partially implemented. The root issue is that the existing implementation has not been normalized against the same production-ready connected-source contract now used for GA4, LinkedIn, Google Ads, Meta/Facebook, Instagram, and TikTok.

Specific root causes to address:

- Source role ambiguity: `google_sheets_connections` can represent a main campaign source, a revenue child source, a spend child source, or a legacy shared connection. Those roles can be confused unless purpose/platform context is enforced at every read and render boundary.
- Template drift: Google Sheets KPI, Benchmark, and Report modals do not yet prove full GA4 template parity, including template panels, field order, no default selections, source-backed current values, alert behavior, edit mode, delete confirmation, custom reports, and scheduled report semantics.
- Dynamic metric ambiguity: Google Sheets can contain arbitrary columns. A numeric column should not automatically become a trusted executive metric unless it is selected/mapped and tied to the active campaign/source scope.
- Aggregate uncertainty: Google Sheets has a platform analytics page, but it has not yet been proven as a main source in the shared Campaign DeepDive connected-source aggregate contract.
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

Validation:

- Create Campaign -> Google Sheets -> select spreadsheet/tab -> finalize campaign.
- Existing campaign -> Connected Platforms -> add Google Sheets -> select spreadsheet/tab.
- Existing campaign -> Google Sheets -> `View Detailed Analytics` -> `Add Dataset` -> select another tab without replacing existing tabs.
- Existing campaign -> Google Sheets -> `View Detailed Analytics` opens at the top of Google Sheets analytics instead of inheriting the campaign page scroll position.
- Existing campaign -> Google Sheets -> `View Detailed Analytics` keeps the header, sheet selector area, and tab bar stable while data loads.
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
- [x] Regression guards added in `server/source-safety-regression.test.ts`.
- [x] Local validation passed: `npm test -- server/source-safety-regression.test.ts server/endpoint-auth-audit.test.ts`.
- [x] Local validation passed: `npm run check`.
- [x] Commit 3F local validation passed: `npm test -- server/source-safety-regression.test.ts server/endpoint-auth-audit.test.ts`.
- [x] Commit 3F local validation passed: `npm run check`.
- [x] Commit 3H local validation passed: `npm test -- server/source-safety-regression.test.ts server/endpoint-auth-audit.test.ts`.
- [x] Commit 3H local validation passed: `npm run check`.
- [ ] Browser validation pending after deploy for Create Campaign, Connected Platforms setup, and Google Sheets analytics `Add Dataset` paths.

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

- [ ] Pending.

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

- [ ] Pending.

### Commit 6: KPI Section GA4 Template Parity

Goal:

- Make Google Sheets KPIs follow the full GA4 KPI section and modal contract with a dynamic Google Sheets metric adapter.

Subcommits:

- 6A: Replace/align KPI section layout with GA4 pattern.
- 6B: Add GA4-style Create/Edit KPI modal field order.
- 6C: Use no default template/metric selection in create mode.
- 6D: Populate Current Value from selected Google Sheets source-backed metric only.
- 6E: Format units and values correctly for dynamic sheet metrics.
- 6F: Keep revenue-dependent KPI metrics unavailable until confirmed Google Sheets-scoped revenue exists.
- 6G: Add alert, edit, delete, and query-refresh parity.
- 6H: Add regression coverage for the full template contract.

Validation:

- Create KPI button matches GA4 placement and behavior.
- Modal fields match GA4 order.
- Current Value updates from selected sheet metric.
- Missing metrics do not become zero.
- Revenue/ROI/ROAS are disabled unless source-backed revenue and spend are available.

Status:

- [ ] Pending.

### Commit 7: Benchmark Section GA4 Template Parity

Goal:

- Make Google Sheets Benchmarks follow the full GA4 Benchmark section and modal contract with a dynamic Google Sheets metric adapter.

Subcommits:

- 7A: Replace/align Benchmark section layout with GA4 pattern.
- 7B: Add GA4-style Create/Edit Benchmark modal field order.
- 7C: Use no default template/metric selection in create mode.
- 7D: Populate Current Value from selected Google Sheets source-backed metric only.
- 7E: Format Benchmark Value while typing and on blur.
- 7F: Keep revenue-dependent Benchmark metrics unavailable until confirmed Google Sheets-scoped revenue exists.
- 7G: Add alert, edit, delete, and query-refresh parity.
- 7H: Add regression coverage for the full template contract.

Validation:

- Create Benchmark button matches GA4 placement and behavior.
- Modal fields match GA4 order.
- Current Value updates from selected sheet metric.
- Missing metrics do not become zero.
- Revenue/ROI/ROAS are disabled unless source-backed revenue and spend are available.

Status:

- [ ] Pending.

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

Validation:

- Create, edit, delete, download, and schedule report flows match GA4 behavior.
- Report cards use Download/Pencil/Trash icons and delete confirmation.
- Report output uses selected Google Sheets current values, KPI rows, and Benchmark rows.
- Scheduled reports do not send or snapshot when campaign/source scope is invalid.

Status:

- [ ] Pending.

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
- 12D: Run KPI/Benchmark/Report section template regression tests.
- 12E: Run `npm run check`.
- 12F: Record browser validation evidence for Create Campaign and Connected Platforms paths.

Validation:

- All targeted tests pass.
- Browser validation confirms main Google Sheets connected platform behavior.
- Child-source no-double-counting validation passes.

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

- [ ] Overview/Summary values match selected sheet rows.
- [ ] Missing mapped metrics show unavailable reasons.
- [ ] KPIs, Benchmarks, Insights, and Reports use current source-backed values.
- [ ] Reports and scheduled reports use latest values.

DeepDive:

- [ ] Google Sheets appears once in shared aggregate when connected as main source.
- [ ] Google Sheets child financial sources do not appear as main sources.
- [ ] GA4 plus Google Sheets does not double-count revenue, spend, or conversions.

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
