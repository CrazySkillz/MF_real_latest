# Custom Integration Connected Platform Production-Ready Tracker

## Purpose

Track the work required to make Custom Integration production-ready as a campaign-scoped connected platform.

This tracker is intentionally modeled on the Google Sheets production-ready tracker and must use the Google Sheets analytics section as the layout template for Custom Integration analytics.

Target integration:

- `Custom Integration`

Primary runtime surface:

- `client/src/pages/custom-integration-analytics.tsx`

Primary layout template:

- `client/src/pages/google-sheets-data.tsx`

Shared implementation contract:

- `CONNECTED_PLATFORM_SECTION_TEMPLATES.md`

## Non-Negotiable Layout Rule

Custom Integration analytics must use the Google Sheets analytics section layout, adapted only where the source model is different.

Required Custom Integration tab order:

1. Overview
2. Summary
3. KPIs
4. Benchmarks
5. Insights
6. Reports

Google Sheets has no Ad Comparison tab. Custom Integration should also omit Ad Comparison unless the Custom Integration source later stores explicit ad-level rows. If that happens, the tracker must document the deviation first.

Required Google Sheets layout mapping:

| Google Sheets layout element | Custom Integration equivalent |
| --- | --- |
| `View Data From` selector | Import/source selector or status. Default should be latest validated Custom Integration import. |
| `Sheet Data` status row | `Custom Data` status row showing import source, import timestamp, and validation state. |
| `Spreadsheet Data` card | `Imported Data` card showing the normalized metrics and source/provenance fields from the selected import. |
| Overview financial cards | Same card pattern, with unavailable reasons when revenue/spend/pipeline values are missing. |
| Summary tab | Same summary layout using Custom Integration metric groups. |
| KPI section | Same section layout and source-backed current-value behavior as Google Sheets. |
| Benchmark section | Same section layout and source-backed current-value behavior as Google Sheets. |
| Insights tab | Same evidence-first layout: summary cards, Performance, and What to do next. |
| Reports tab | Same reports layout and saved-source behavior as Google Sheets. |

Do not keep the current Custom Integration page as a separate purple/blue design pattern. The final implementation should visually and behaviorally match the Google Sheets analytics shell.

## Root Cause Analysis

Custom Integration is not missing. It already has a connection and analytics page. The root issue is that it was built as a PDF/email/webhook metric ingestion feature first, not as a production-ready connected-platform analytics section.

Current code confirms:

- `shared/schema.ts` defines `customIntegrations` and `customIntegrationMetrics`.
- `server/storage.ts` includes Custom Integration connection and metric helpers.
- `server/routes-oauth.ts` includes connect, fetch, upload, webhook/email ingest, transfer, and disconnect routes.
- `client/src/App.tsx` routes `/campaigns/:id/custom-integration-analytics` to `CustomIntegrationAnalytics`.
- `client/src/pages/custom-integration-analytics.tsx` renders the current Custom Integration analytics page.
- Generic platform KPI, Benchmark, and Report routes already support `/api/platforms/:platformType/...`.

Primary root causes:

- Layout drift: Custom Integration currently has `Overview`, `KPIs`, `Benchmarks`, and `Reports`; Google Sheets has `Overview`, `Summary`, `KPIs`, `Benchmarks`, `Insights`, and `Reports`.
- Source contract ambiguity: Custom Integration imports have file/email/webhook provenance, but the analytics UI does not expose a Google-Sheets-style selected source/status row that explains what data powers the page.
- Metric adapter gap: Current values are read directly from `metricsData` in the page instead of through a source-backed metric adapter with units, formatting, availability, source labels, and unavailable reasons.
- Silent zero risk: KPI and Benchmark metric selection uses `metricsData?.metric || 0`, which can turn missing metrics into `0`. Google Sheets now treats missing values as unavailable with reasons.
- Saved object scope risk: KPIs, Benchmarks, and Reports save current values but are not proven to re-resolve from a stable Custom Integration source scope after later imports.
- Insights gap: There is no production-ready Custom Integration Insights tab using source-backed evidence and next-action rules.
- Route reachability gap: `custom-integration-analytics.tsx` calls `/api/custom-integration-by-id/:id`, but no matching route was found in `server/routes-oauth.ts` during this review.
- Duplicate route risk: `server/routes-oauth.ts` contains more than one `/api/custom-integration/:campaignId/upload-pdf` registration path, which must be audited before production-ready claims.
- Lifecycle gap: `deleteCustomIntegration(campaignId)` deletes the connection row, but this review did not prove that disconnect removes or disables associated `custom_integration_metrics` rows.
- Aggregate/scheduler risk: `server/scheduler.ts` and aggregate routes consume latest Custom Integration metrics, but the end-to-end aggregate contract has not been revalidated against the planned source-backed adapter.

Business impact:

- A marketing executive could see KPI, Benchmark, Report, or Insight values without a clear source label.
- A missing imported metric could appear as `0`, which is materially different from unavailable.
- A new import could make saved KPI/Benchmark/Report values stale or ambiguous unless saved source semantics are defined.
- The Custom Integration page does not yet provide the same trust, explainability, or layout consistency as the Google Sheets section.

## Current Code/Path Inventory

Frontend:

- `client/src/pages/custom-integration-analytics.tsx`
  - Current Custom Integration analytics page.
  - Fetches connection, latest metrics, platform KPIs, platform Benchmarks, and platform Reports.
  - Renders Overview, KPIs, Benchmarks, and Reports.
  - Includes PDF upload from the Overview empty state.
- `client/src/pages/campaigns.tsx`
  - Exposes Custom Integration in Create Campaign.
  - Uses the existing campaign-scoped PDF upload and email-forwarding setup routes during campaign creation.
- `client/src/App.tsx`
  - Routes `/campaigns/:id/custom-integration-analytics`.
  - Also routes `/integrations/:id/analytics`, which depends on the missing by-ID endpoint noted above.
- `client/src/pages/campaign-detail.tsx`
  - Uses Custom Integration as a connected platform and campaign aggregate source.

Backend:

- `server/routes-oauth.ts`
  - `/api/custom-integration/connect`
  - `/api/custom-integration/:campaignId`
  - `/api/custom-integration/:campaignId/changes`
  - `/api/custom-integration/:campaignId/metrics`
  - `/api/custom-integration/:campaignId/upload-pdf`
  - `/api/webhook/custom-integration/:token`
  - `/api/email/inbound/:token`
  - `/api/custom-integration/:campaignId/connect`
  - `/api/custom-integration/:campaignId`
  - `/api/custom-integration/transfer`
  - Generic platform KPI, Benchmark, and Report routes under `/api/platforms/:platformType/...`
- `server/storage.ts`
  - `getCustomIntegration`
  - `getCustomIntegrationById`
  - `getCustomIntegrationByToken`
  - `getAllCustomIntegrations`
  - `createCustomIntegration`
  - `deleteCustomIntegration`
  - `getCustomIntegrationMetrics`
  - `getAllCustomIntegrationMetrics`
  - `createCustomIntegrationMetrics`
  - `getLatestCustomIntegrationMetrics`
  - generic platform KPI, Benchmark, and Report storage helpers
- `server/scheduler.ts`
  - Reads latest Custom Integration metrics for campaign snapshots and performance summary data.

Shared schema:

- `shared/schema.ts`
  - `customIntegrations`
  - `customIntegrationMetrics`
  - shared `kpis`, `benchmarks`, and report tables used by generic platform routes

Existing docs/tests:

- `TESTING_CUSTOM_INTEGRATION.md`
- `run-custom-integration-migration.js`
- `migrations/make_custom_integration_email_nullable.sql`
- `server/source-safety-regression.test.ts`
- `server/performance-summary-aggregate.test.ts`
- `server/performance-summary-scheduler-regression.test.ts`

## Evidence Status

Proven from local code review:

- Custom Integration has a campaign-scoped connection table.
- Custom Integration has a metric table with imported metrics and provenance fields.
- The campaign route to Custom Integration analytics exists.
- Generic platform KPI, Benchmark, and Report routes are campaign-access guarded.
- Latest Custom Integration metrics are used in scheduler and campaign aggregate paths.

Partially reviewed:

- PDF upload, webhook upload, email inbound, and transfer flows exist, but duplicate route registration and lifecycle side effects need focused review.
- Create Campaign email-forwarding setup creates the Custom Integration row and generated forwarding email, but the current wizard does not show the generated email address to the user after setup.
- KPI, Benchmark, and Report create/edit/delete paths exist through generic platform routes, but source-backed current-value behavior is not production-ready.
- Campaign aggregate paths include Custom Integration, but source availability and unavailable reasons are not fully normalized.

Unverified:

- Browser validation for the current Custom Integration page.
- `/integrations/:id/analytics` route because the page calls a by-ID API route that was not found.
- Full disconnect cleanup for existing imported metric rows.
- Scheduled report output and snapshots for Custom Integration.
- Whether all import paths write identical normalized metric shapes and provenance.
- End-to-end Mailgun/SendGrid inbound delivery for generated forwarding emails in the deployed environment.
- Whether existing persisted Custom Integration KPI, Benchmark, or Report rows contain damaged/stale current values from prior silent-zero behavior.

## Production-Ready Target Contract

Custom Integration is production-ready only when all of the following are true:

- The campaign has an active Custom Integration source only when the user explicitly connects Custom Integration for that campaign.
- The connection identity is stable and campaign-scoped.
- The visible analytics page clearly states which Custom Integration import/source powers the displayed values.
- Imported metrics include source labels, import timestamp, import method, and validation state where available.
- Overview, Summary, KPIs, Benchmarks, Insights, Reports, scheduler snapshots, and Campaign DeepDive all read through the same Custom Integration metric adapter.
- Missing metrics render unavailable with reasons, not zeroes.
- Saved KPIs, Benchmarks, and Reports persist enough source scope to resolve current values correctly after later imports.
- Report downloads and scheduled reports use the same source-backed values visible in the UI.
- Disconnect, transfer, upload, webhook, email inbound, scheduler, and report paths preserve campaign ownership and do not leak or reuse another campaign's data.
- Email-forwarding setup shows the generated forwarding email address and copy action before users are expected to send PDF reports by email.
- Custom Integration aggregate participation is explicit: it may provide web analytics, email/newsletter, paid-media-like, revenue, spend, or conversion values only when those exact fields exist in the selected validated import.

## Custom Integration Metric Adapter Contract

Before UI changes, implement or document a local adapter with these responsibilities:

- `platformKey`: `custom_integration`
- `platformLabel`: `Custom Integration`
- `analyticsRoute`: `/campaigns/:id/custom-integration-analytics`
- `sourceScope`: stable selected source identity, at minimum integration ID plus source mode such as `latest_validated_import`
- `sourceLabel`: user-visible import label, such as PDF filename, email subject, webhook source, or latest import timestamp
- `sourceRows`: normalized metric rows or field list from the selected import
- `metricTemplates`: available KPI/Benchmark templates for Custom Integration metrics
- `currentValueResolver`: resolves each metric key from the selected source scope
- `metricAvailability`: available/unavailable state and reason for each metric
- `formatMetricValue`: unit-aware formatting for counts, currency, percentages, durations, and ratios
- `revenueAvailability`: true only when imported revenue exists and is source-backed
- `spendAvailability`: true only when imported spend exists and is source-backed
- `reportSections`: Overview, Summary, KPIs, Benchmarks, Insights, Reports
- `queryKeys`: all queries invalidated by import, connect, disconnect, transfer, KPI/Benchmark/Report mutation, and scheduler refresh

Rules:

- Missing values must not become `0`.
- Parsed PDF confidence warnings must not be hidden if they affect trust in metrics.
- Saved objects must not depend on whichever import is accidentally latest unless the saved source mode explicitly means latest validated import.
- Generated report snapshots must represent the values at generation time.

## Implementation Strategy

### Commit 1: Documentation And Source Contract

Goal:

- Establish this tracker and the Custom Integration production-ready contract before runtime changes.

Tasks:

- Record current code/path inventory.
- Confirm Google Sheets analytics layout is the required Custom Integration layout template.
- Define the Custom Integration adapter contract and source-scope rules.

Validation:

- Confirm this file exists.
- Confirm it names `client/src/pages/google-sheets-data.tsx` as the layout template.
- Confirm it lists the required Custom Integration tab order.

Status:

- Planned by this tracker.

### Commit 2: Route And Lifecycle Audit

Goal:

- Remove route ambiguity before UI work depends on unstable endpoints.

Tasks:

- Verify or add the `/api/custom-integration-by-id/:id` route if `/integrations/:id/analytics` remains supported.
- Audit duplicate `/api/custom-integration/:campaignId/upload-pdf` route registrations and keep one canonical path.
- Verify connect, disconnect, transfer, manual upload, webhook, and email inbound ownership checks.
- Decide whether disconnect should delete metrics, mark them inactive, or keep historical imports hidden from active analytics.

Validation:

- Regression tests for by-ID route access, upload route behavior, disconnect cleanup boundary, and transfer ownership.

Status:

- Completed in Commit 2 implementation pass.
- Root cause: the Custom Integration analytics page had a by-ID route caller without a backend route, the manual PDF upload route was registered twice, public token ingest routes enumerated integrations before matching tokens, and disconnect left imported metric rows able to feed stale analytics.
- Fixes: added campaign-guarded `/api/custom-integration-by-id/:id`, kept one canonical campaign-scoped upload route, made first PDF upload create the connection when needed, switched token ingest to direct token lookup, and made disconnect delete Custom Integration metric rows with the connection.
- Regression evidence: `server/source-safety-regression.test.ts` covers by-ID access, single upload route, token lookup, and disconnect metric cleanup.
- Local validation: `npm test -- server/source-safety-regression.test.ts`, `npm run check`, and `npm test -- server/legacy-route-reachability-regression.test.ts server/performance-summary-scheduler-regression.test.ts server/performance-summary-aggregate.test.ts` passed.

### Commit 3: Metric Adapter And Availability Rules

Goal:

- Create the source-backed resolver that all Custom Integration sections use.

Tasks:

- Build a Custom Integration metric registry for users, sessions, pageviews, bounce rate, emails delivered, open rate, CTR, CTOR, list growth, impressions, clicks, conversions, leads, spend, revenue, ROI, and ROAS where inputs exist.
- Add unit/type metadata and unavailable reasons.
- Replace direct `metricsData?.metric || 0` current-value logic with adapter resolution.
- Define confidence/provenance handling from parsed imports.
- Add parser regression coverage for known Custom Integration PDF report text before trusting imported values downstream.
- Preserve extracted-field presence after upload so missing PDF metrics stay unavailable after reload instead of becoming database-default `0`.
- Persist or return parser trust metadata (`confidence`, `warnings`, `requiresReview`, `extractedFields`) through the latest metrics path, not only the immediate upload/webhook response.
- Apply the same missing-field and review-required behavior to manual upload, webhook upload, and inbound email parsing.
- Keep revenue, ROI, and ROAS unavailable unless the selected import explicitly extracts the required revenue and spend inputs.

Validation:

- Unit tests prove missing metrics return unavailable, not `0`.
- Unit tests prove percent, count, currency, duration, and ratio formatting.
- Parser regression tests cover at least one known report shape, one no-metrics PDF/text case, and one partial email/ad-only report shape.
- Upload/reload regression proves absent PDF fields are still unavailable after storage and `/api/custom-integration/:campaignId/metrics` reload.
- Route parity regression proves manual upload, webhook, and inbound email preserve the same availability and trust metadata.

Status:

- Commit 3 completed.
- Root cause fixed so far: Custom Integration KPI and Benchmark forms directly read `metricsData?.metric || 0`, so a missing imported metric could be saved, displayed, and scored as a real `0`.
- Root cause fixed in follow-up pass: parsed PDF insert paths omitted missing fields, allowing nullable metric columns with database defaults to reload as `0`; the no-metrics parser fallback also fabricated legacy zeros. Manual upload, webhook upload, and inbound email now use the same normalizer and store missing parsed metrics as `null` while preserving real extracted zero values; no-metrics parses keep metric fields absent.
- Root cause fixed in final Commit 3 pass: parser confidence/warning metadata was returned only in immediate upload/webhook responses and was lost after reload because `custom_integration_metrics` had no persisted parser trust field; plain `Users:` labels were also not matched by the parser.
- Fixes completed: added a nullable `parser_metadata` JSON column and migration; persisted parser confidence, warnings, extracted field count, and review-required state through every parsed PDF ingest path; `/api/custom-integration/:campaignId/metrics` now returns that metadata with the latest metrics row; the Custom Integration Overview shows an import review warning after reload when parser metadata requires review; parser validation now applies website-required warnings only when website analytics fields are present; plain `Users:` labels are extracted.
- Regression evidence: `server/source-safety-regression.test.ts` guards against reintroducing zero-filled Custom Integration KPI/Benchmark metric selection, verifies unavailable metrics are excluded from visible scoring, verifies parsed PDF imports use null-preserving storage across manual upload, webhook upload, and inbound email, verifies no-metrics parses do not assign fake legacy zeros, and verifies parser metadata schema/migration/UI coverage.
- Parser evidence: `server/pdf-parser-regression.test.ts` covers a known mixed report, an email-only partial report, and a no-metrics report.
- Local validation completed for final Commit 3 pass: `npm test -- server/source-safety-regression.test.ts server/pdf-parser-regression.test.ts` and `npm run check` passed.
- User validation passed for Commit 3 after the Render database migration was applied.
- Deferred by tracker scope: Reports, scheduled reports, Insights, Summary, and full Google Sheets layout parity remain in later commits.
- Gate cleared for Commit 4 after applying the parser metadata migration.

### Commit 4: Google Sheets Layout Shell

Goal:

- Rebuild the Custom Integration analytics shell to match Google Sheets layout.

Tasks:

- Add the Google Sheets tab order: Overview, Summary, KPIs, Benchmarks, Insights, Reports.
- Replace the current Custom Integration-only visual pattern with the Google Sheets page layout pattern.
- Add the `Custom Data` status row equivalent to Google Sheets `Sheet Data`.
- Add an `Imported Data` card equivalent to Google Sheets `Spreadsheet Data`.
- Keep upload/connect actions in the source/status area, not as a separate competing analytics design.

Validation:

- Browser validation confirms tab order, page stability, source/status row, and imported-data card.

Status:

- Completed in Commit 4 implementation pass.
- Root cause: Custom Integration still used the older four-tab analytics shell (`Overview`, `KPIs`, `Benchmarks`, `Reports`) and kept PDF upload inside the empty-state card, while the Google Sheets template uses the source/status area plus six tabs (`Overview`, `Summary`, `KPIs`, `Benchmarks`, `Insights`, `Reports`) and a data provenance card inside Overview.
- Fixes: added the Google Sheets tab order, added a `Custom Data` status row with latest import label, validation state, and PDF upload action, moved upload out of the empty-state card, added an `Imported Data` provenance card, and added lightweight Summary and Insights shell content based on existing source availability and parser status.
- Regression evidence: `server/source-safety-regression.test.ts` verifies the Custom Integration tab order, status row, imported-data card, Summary/Insights content targets, and upload button placement.
- Local validation: `npm test -- server/source-safety-regression.test.ts server/pdf-parser-regression.test.ts` and `npm run check` passed.

### Commit 5: Overview And Summary

Goal:

- Make Custom Integration Overview and Summary source-backed and explainable.

Tasks:

- Overview cards use adapter values only.
- Revenue, spend, ROI, and ROAS show unavailable reasons until required imported fields exist.
- Summary tab groups available Custom Integration metrics using the same page structure as Google Sheets.
- Imported Data shows provenance and normalized values without implying unsupported metrics.

Validation:

- Tests and browser validation for available metrics, unavailable metrics, import provenance, and source labels.

### Commit 6: KPIs

Goal:

- Bring Custom Integration KPIs to Google Sheets behavior and shared connected-platform contract.

Tasks:

- Use the Google Sheets KPI section layout.
- Use a template grid with source-backed current values.
- Disable unavailable templates with reasons.
- Persist Custom Integration source scope in existing KPI configuration fields.
- Re-resolve current values from the saved source scope when rendering.
- Keep alerts, edit, delete, and query invalidation behavior intact.

Validation:

- Regression tests for create/edit/delete, source-backed current values, unavailable reasons, saved-source behavior, and no silent zeroes.

### Commit 7: Benchmarks

Goal:

- Bring Custom Integration Benchmarks to Google Sheets behavior and shared connected-platform contract.

Tasks:

- Use the Google Sheets Benchmark section layout.
- Use source-backed current values from the adapter.
- Persist saved source scope.
- Exclude unavailable Benchmarks from scoring and show reasons.
- Preserve edit/delete/alert behavior.

Validation:

- Regression tests for progress calculation, unavailable handling, saved-source behavior, and report-consumer values.

### Commit 8: Insights

Goal:

- Add a production-ready Custom Integration Insights tab.

Tasks:

- Use the Google Sheets Insights layout.
- Generate Performance insights only from available source-backed metrics.
- Generate What to do next from evidence-backed rules, not generic advice.
- Show confidence/provenance warnings where import quality affects trust.
- Do not create paid-media or revenue recommendations unless Custom Integration imported the required fields.

Validation:

- Regression tests for High priority, Needs attention, Performance, What to do next, unavailable inputs, and confidence warnings.

### Commit 9: Reports And Scheduled Reports

Goal:

- Make Custom Integration Reports source-backed and scheduler-safe.

Tasks:

- Use the Google Sheets Reports section layout.
- Report templates include Overview, Summary, KPIs, Benchmarks, Insights, and Custom.
- Downloaded reports use adapter-resolved values.
- Scheduled reports snapshot the same source-backed values visible in the UI.
- Report create/edit/delete/test-send paths preserve campaign and platform scope.

Validation:

- Regression tests for report values, custom report sections, schedule validation, snapshot consistency, and platform access guards.

### Commit 10: Campaign Aggregates And DeepDive

Goal:

- Ensure Custom Integration contributes to campaign-level analytics only through the shared aggregate contract.

Tasks:

- Verify `/outcome-totals`, Executive Summary, Performance Summary, Platform Comparison, Trend Analysis, and scheduler snapshots consume Custom Integration through the same normalized source contract.
- Add unavailable reasons for unsupported aggregate fields.
- Prevent Custom Integration from being treated as a GA4 replacement unless the imported fields actually support web analytics outcomes.

Validation:

- Regression tests for aggregate availability, source labels, scheduler snapshots, and no double counting.

### Commit 11: Existing Data And Cleanup Boundary

Goal:

- Handle existing saved records without inventing values.

Tasks:

- Detect KPI/Benchmark/Report rows that have Custom Integration current values but no resolvable source scope.
- Fail closed as unavailable until edited/resaved, or add a narrowly scoped self-heal only when exact source identity can be proven.
- Audit existing imported metrics created by duplicate or legacy upload paths.

Validation:

- Regression tests prove legacy rows do not silently show stale or zero-filled values.

### Commit 12: Final Evidence Pass

Goal:

- Confirm production readiness with evidence.

Required evidence:

- Local regression coverage.
- Browser validation for connect, import, Overview, Summary, KPIs, Benchmarks, Insights, Reports, disconnect, and reconnect.
- Manual upload validation with a known PDF.
- Webhook/email inbound validation if those paths remain supported.
- Scheduled report validation if scheduling is exposed.
- Documentation updated with final status, known boundaries, and validation results.

### Deferred Follow-Up: Email Forwarding Usability

Goal:

- Make the existing `Set Up Email Forwarding` path usable for non-technical users.

Root cause:

- The backend returns `campaignEmail` from `/api/custom-integration/:campaignId/connect`, but Create Campaign currently only shows a success toast and does not display the generated forwarding address.

Safe timing:

- This can be deferred until after the remaining layout/analytics commits because Manual Upload already supports immediate data import and the email-forwarding connection row is created correctly.
- It must be completed before Custom Integration is called production-ready.

Smallest expected fix:

- After email-forwarding setup, show `Forward PDF reports to: <campaignEmail>` with a copy button.
- Validate deployed Mailgun/SendGrid inbound routing for that generated address before marking email forwarding production-ready.

## Validation Matrix

Before Custom Integration can be called production-ready, validate:

- Create/connect Custom Integration from campaign setup and campaign detail.
- Import metrics by manual PDF upload.
- PDF parser fixture tests prove extracted fields, missing fields, and low-confidence imports are handled deterministically.
- Import metrics by webhook and inbound email, if retained.
- Email-forwarding setup displays the generated forwarding address and copy action.
- Open Custom Integration analytics from Connected Platforms.
- Overview shows only source-backed metrics.
- Summary exists and uses the same source-backed metrics.
- KPIs create, edit, delete, alert, and refresh correctly.
- Benchmarks create, edit, delete, alert, and refresh correctly.
- Insights explain Performance and What to do next from evidence.
- Reports download the same values shown in the UI.
- Scheduled reports send/snapshot only valid campaign-scoped values.
- Disconnect/reconnect does not leave active stale analytics.
- Campaign DeepDive aggregate values match the normalized Custom Integration source contract.
- Missing fields show unavailable reasons and never silently become `0`.
- Parser confidence and warning metadata remains visible or available after reload when it affects trust in imported metrics.

## Production-Ready Exit Criteria

Custom Integration is production-ready when:

- This tracker is updated with completed status for every commit above.
- The Custom Integration analytics page uses the Google Sheets analytics layout.
- Every visible metric has a source label or unavailable reason.
- KPIs, Benchmarks, Reports, Insights, scheduler snapshots, and campaign aggregates use the same adapter-resolved values.
- All add, edit, delete, import, transfer, disconnect, scheduler, and report lifecycle paths have been traced and validated.
- Existing damaged/stale records are either safely resolved from exact source data or fail closed as unavailable.
