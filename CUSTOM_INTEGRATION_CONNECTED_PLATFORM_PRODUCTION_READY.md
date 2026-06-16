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
| Reports tab | Same GA4-style report card, modal, custom-section picker, saved-source, and scheduled-report behavior used by connected-platform Reports. |

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

Primary root causes addressed by this tracker:

- Layout drift was resolved by matching the Google Sheets tab structure.
- Source contract ambiguity was resolved with source/status surfaces and source-backed metric resolution.
- Silent zero risk was resolved by treating missing imported metrics as unavailable with reasons.
- Saved object scope risk was resolved for KPIs, Benchmarks, Reports, and scheduled PDFs.
- Insights were made evidence-backed using source-backed metrics and unavailable reasons.
- Route reachability, duplicate upload registration, and disconnect stale-data risks were resolved in Commit 2.
- Aggregate/scheduler availability risk was resolved in Commit 10 through the shared aggregate contract.
- Email-forwarding UI usability was resolved in Commit 12 by displaying the generated forwarding address after setup.
- Create Campaign wizard confusion was resolved by treating Custom Integration setup as draft `Ready` state until the final `Create Campaign` action completes, and by making Confirm Back return to the prior setup screen.
- Remaining production evidence risk: deployed browser validation and live inbound email-provider delivery still need proof.

Business impact:

- KPI, Benchmark, Report, Insight, and aggregate values now fail closed when source evidence is missing.
- Missing imported metrics are presented as unavailable instead of real `0` values.
- Saved KPI/Benchmark/Report values are tied to saved Custom Integration source scope.
- The remaining business-readiness work is deployed validation, especially manual PDF upload, scheduled reports if exposed, and live inbound email forwarding.

## Current Code/Path Inventory

Frontend:

- `client/src/pages/custom-integration-analytics.tsx`
  - Current Custom Integration analytics page.
  - Fetches connection, latest metrics, platform KPIs, platform Benchmarks, and platform Reports.
  - Renders Overview, Summary, KPIs, Benchmarks, Insights, and Reports.
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
- Latest Custom Integration metrics are used in scheduler and campaign aggregate paths through the shared aggregate contract.
- Commit 10 proves campaign aggregates, Campaign DeepDive consumers, and scheduler snapshots only advertise Custom Integration metrics when the imported field exists.
- Commit 11 proves saved Custom Integration KPI, Benchmark, and Report rows fail closed when saved source scope is missing or disconnected.
- Commit 12 proves the email-forwarding setup UI displays the generated forwarding address with a copy action after setup.
- Create Campaign now keeps pre-final Custom Integration setup labeled as ready/selected instead of connected, and Confirm Back returns to the previous Custom Integration setup screen.

Partially reviewed:

- PDF upload, webhook upload, email inbound, and transfer flows exist; local regression covers route ownership, but deployed provider delivery still needs validation.
- Email-forwarding setup creates the Custom Integration row and generated forwarding email, and the UI now displays the address after setup; live inbound delivery still needs deployed provider validation.
- KPI create/edit/delete paths now use source-backed current values after Commit 6. Benchmark create/edit/delete paths now use source-backed current values after Commit 7. Report create/edit/delete paths now use source-backed values and scheduler-safe payloads after Commit 9.
- Campaign aggregate paths include Custom Integration with normalized source availability and unavailable reasons after Commit 10.

Unverified:

- Browser validation for the current Custom Integration page.
- Deployed disconnect/reconnect browser validation.
- End-to-end Mailgun/SendGrid scheduled delivery evidence for Custom Integration in the deployed environment.
- Whether all import paths write identical normalized metric shapes and provenance.
- End-to-end Mailgun/SendGrid inbound delivery for generated forwarding emails in the deployed environment.
- Production database audit for legacy Custom Integration imported metrics or damaged saved rows.

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
- In Create Campaign, Custom Integration source setup must not display as `Connected` until the final `Create Campaign` action succeeds; draft setup should be shown as `Ready` or `Selected`.
- In Create Campaign, Back from Confirm must return to the immediately previous setup screen, not jump back to platform selection.
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
- User validation passed for Commit 4 after deployed browser review.

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

Status:

- Completed in Commit 5 implementation pass.
- Root cause: Overview and Summary still rendered raw `metricsData` groups directly, so available groups were decided by ad hoc field checks and financial metrics could disappear instead of showing a source-backed unavailable reason.
- Fixes: added a source-backed Overview group registry, routed Overview and Summary metric cards through `resolveCustomIntegrationMetric`, kept revenue, spend, ROI, and ROAS visible with unavailable reasons when required imported fields are missing, and added a source-backed metric count to the Imported Data card.
- Regression evidence: `server/source-safety-regression.test.ts` verifies the Overview/Summary group registry, adapter resolution, source labels, unavailable financial reasons, and no reintroduction of raw revenue checks.
- Local validation: `npm test -- server/source-safety-regression.test.ts server/pdf-parser-regression.test.ts` and `npm run check` passed.
- User validation passed for Commit 5 after browser review.
- Deferred by tracker scope: KPIs, Benchmarks, Insights, Reports, scheduled reports, campaign aggregates, and existing-data cleanup remain in later commits.

### Commit 6: KPIs

Goal:

- Bring Custom Integration KPIs to Google Sheets behavior and shared connected-platform contract.

Tasks:

- Use the Google Sheets KPI section layout.
- Use a template grid with source-backed current values.
- Disable unavailable templates with reasons.
- Persist Custom Integration source scope in existing KPI configuration fields.
- Re-resolve current values from the saved source scope when rendering.
- Match Google Sheets KPI card layout and performance tracker thresholds.
- Remove non-Google-Sheets fields from the KPI modal/card where they created layout drift.
- Preserve metric units and count formatting in create/edit mode.
- Disable edit-mode `Update KPI` until a saved KPI actually changes.
- Keep alerts, edit, delete, and query invalidation behavior intact.

Validation:

- Regression tests for create/edit/delete, source-backed current values, unavailable reasons, saved-source behavior, and no silent zeroes.

Status:

- Completed and user-validated for Commit 6.
- Root cause: Custom Integration KPI creation/editing and KPI cards had drifted from the Google Sheets KPI pattern. The modal could select source metrics without a stable saved source scope, cards could show stale saved current values, tracker thresholds used a separate Custom Integration pattern, count units/target formatting were inconsistent, and edit mode allowed unchanged `Update KPI` submissions.
- Fixes: KPI creation now uses a Google-Sheets-style template grid, disables unavailable imported metrics with resolver reasons, makes Current Value read-only for source-backed templates, stores the active Custom Integration source scope in `calculationConfig.sourceScope`, re-resolves KPI card and edit-modal current values from that scope, excludes unavailable KPIs from tracker scoring, matches Google Sheets KPI cards, uses the same +/-5% tracker thresholds, removes the modal `Timeframe` field and card timeframe display, hides metric-tile source text, preserves missing count units as `count`, formats count targets without unnecessary decimals, prevents the analytics header from flashing the generic campaign fallback on refresh, and disables `Update KPI` until something changes.
- Runtime commits included in Commit 6 scope: `1b6d3730` source-backed KPIs, `71551e7f` KPI modal simplification, `b790c962` KPI card/threshold parity, `7187824c` KPI modal unit/formatting, `3a37c036` header fallback flash fix, and `2a067e39` unchanged edit-submit disablement.
- Regression evidence: `server/source-safety-regression.test.ts` verifies source-backed KPI templates, disabled unavailable templates, read-only source-backed current values, saved source scope, edit-modal resolver prefill, blocked KPI scoring, Google Sheets card/threshold parity, modal field cleanup, unit/target formatting, no generic header fallback, and disabled unchanged edit-mode updates.
- Local validation: `npm test -- server/source-safety-regression.test.ts server/pdf-parser-regression.test.ts`, `npm run check`, and targeted `git diff --check` passed during the Commit 6 implementation passes.
- User validation passed for Commit 6 after deployed browser review.
- Deferred by tracker scope: Benchmarks, Insights, Reports, scheduled reports, campaign aggregates, and existing-data cleanup remain in later commits.

### Commit 7: Benchmarks

Goal:

- Bring Custom Integration Benchmarks to Google Sheets behavior and shared connected-platform contract.

Tasks:

- Use the Google Sheets Benchmark section layout.
- Use source-backed current values from the adapter.
- Persist saved source scope.
- Exclude unavailable Benchmarks from scoring and show reasons.
- Use a metric-tile Benchmark template selector instead of the old metric dropdown.
- Match Google Sheets Benchmark cards and tracker thresholds.
- Remove unused modal metadata fields that do not support the source-backed Benchmark flow.
- Normalize platform Benchmark decimal payloads before server validation.
- Disable edit-mode `Update Benchmark` until a saved Benchmark actually changes.
- Preserve edit/delete/alert behavior.

Validation:

- Regression tests for progress calculation, unavailable handling, saved-source behavior, and report-consumer values.

Status:

- Completed and user-validated for Commit 7.
- Root cause: Custom Integration Benchmarks had the same source-backed accuracy requirements as Google Sheets, but the section still mixed old Custom Integration UI behavior with generic Benchmark behavior. The initial Commit 7 implementation fixed cards, progress scoring, saved source scope, and current-value resolution, but the modal still used the old metric dropdown. Follow-up validation found extra unused modal metadata fields, server-side decimal validation rejecting numeric Benchmark payloads, and edit mode allowing unchanged `Update Benchmark` submissions.
- Fixes: Benchmark creation now uses a Google-Sheets-style metric tile selector, disables unavailable imported metrics with resolver reasons, makes Current Value read-only for source-backed templates, stores the active Custom Integration source scope in `calculationConfig.sourceScope`, re-resolves Benchmark card and edit-modal current values from that saved source, excludes unavailable Benchmarks from tracker scoring, matches Google Sheets Benchmark card layout and 90%/70% progress thresholds, removes modal-only `Industry`, `Source`, `Period`, `Benchmark Type`, `Confidence Level`, and orphaned competitor fields, normalizes `benchmarkValue`, `currentValue`, and `alertThreshold` before platform Benchmark route validation, and disables `Update Benchmark` until something changes.
- Runtime commits included in Commit 7 scope: `f7021c4c` source-backed Benchmarks, `b4a2a4e2` Benchmark modal metric tiles, `28bdb85f` Benchmark modal simplification, `dfbbe9a3` platform Benchmark decimal normalization, and `9aad2a9d` unchanged edit-submit disablement.
- Regression evidence: `server/source-safety-regression.test.ts` verifies source-backed Benchmark templates, disabled unavailable templates, read-only source-backed current values, saved source scope, Google Sheets Benchmark card/threshold parity, modal field cleanup, decimal normalization before platform Benchmark validation, and disabled unchanged edit-mode updates.
- Local validation: `npm test -- server/source-safety-regression.test.ts server/pdf-parser-regression.test.ts`, `npm test -- server/source-safety-regression.test.ts`, `npm run check`, and targeted `git diff --check` passed during the Commit 7 implementation passes.
- User validation passed for Commit 7 after deployed browser review.
- Deferred by tracker scope: Insights, Reports, scheduled reports, campaign aggregates, and existing-data cleanup remain in later commits.

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

Status:

- Completed and user-validated for Commit 8.
- Root cause: the Custom Integration Insights tab only showed import status, so it did not produce Google-Sheets-style `Performance` or `What to do next` sections from source-backed metrics.
- Fixes: added source-backed Insights generation from the validated Custom Integration metric resolver, added summary cards for `Total insights`, `High priority`, and `Needs attention`, added evidence-backed `Performance` findings, added `What to do next` recommendations tied to those findings, surfaced import quality/parser warning context, and prevented ROI/ROAS/revenue guidance unless required source fields exist.
- Runtime commit included in Commit 8 scope: `047dfb3d` source-backed Custom Integration Insights.
- Regression evidence: `server/source-safety-regression.test.ts` verifies source-backed Insights, parser review warnings, high-priority/needs-attention summary values, Performance, What to do next, revenue/spend unavailable handling, and no generic budget guidance.
- Local validation: `npm test -- server/source-safety-regression.test.ts server/pdf-parser-regression.test.ts`, `npm run check`, and targeted `git diff --check` passed.
- User validation passed for Commit 8 after deployed browser review.
- Deferred by tracker scope: Reports, scheduled reports, campaign aggregates, and existing-data cleanup remain in later commits.

### Commit 9: Reports And Scheduled Reports

Goal:

- Make Custom Integration Reports source-backed and scheduler-safe.

Tasks:

- Use the GA4 Reports section layout and interaction pattern within the Custom Integration analytics shell.
- Report templates include Overview, Summary, KPIs, Benchmarks, Insights, and Custom.
- Downloaded reports use adapter-resolved values.
- Scheduled reports snapshot the same source-backed values visible in the UI.
- Report create/edit/delete/test-send paths preserve campaign and platform scope.

Validation:

- Regression tests for report values, custom report sections, schedule validation, snapshot consistency, and platform access guards.

Status:

- Completed and user-validated for Commit 9.
- Root cause: Custom Integration Reports used the generic platform report route, but the page-level PDF download still read raw/stored values and scheduled report payloads sent UI values such as `9:00 AM` without `scheduleTimeZone`, while the shared backend route requires `HH:MM`, IANA time zone, and normalized schedule fields.
- Root cause: the report scheduler did not include `custom-integration` in scheduled platform selection and had no Custom Integration source-backed PDF builder, so scheduled/test/snapshot output could fall through generic stored-row behavior or skip the platform entirely.
- Root cause: the Custom Integration Reports UI drifted from the GA4 Reports template by using two-column standard report tiles, a separate custom-report accordion layout, purple report cards, an extra `Back to Standard Reports` link, and a redundant Overview checkbox inside the custom section picker.
- Root cause: saved scheduled Custom Integration reports could be missed by the Reports tab when existing rows used the alternate `custom_integration` platform id while the page queried `custom-integration`; new report forms also defaulted to `draft` instead of active report rows.
- Fixes: Custom Integration Report modal now follows GA4: `Report Type`, `Standard Templates`, `Custom Report`, `Choose Template`, full-width template rows with chips, and a GA4-style Custom Report section picker for Overview, Summary, KPIs, Benchmarks, and Insights.
- Fixes: Custom Report starts with all sections collapsed, has no default custom selections, removed the redundant Overview checkbox/helper copy, and removed the non-GA4 `Back to Standard Reports` link.
- Fixes: Reports tab cards now follow the GA4 card pattern with title, optional description, report type pill, schedule metadata, last-sent date, created date, and Download/Edit/Delete actions for scheduled and unscheduled reports.
- Fixes: downloaded Custom Integration reports now use the source-backed metric resolver, current KPI/Benchmark resolver, unavailable reasons, and source/provenance labels instead of raw metric fields or saved KPI/Benchmark current-value snapshots.
- Fixes: scheduled report create/update now persists Custom Integration source scope in report `configuration`, sends normalized schedule fields, includes browser time zone, and disables edit-mode `Update Report` until something changes.
- Fixes: Custom Integration reports now default to active rows, and platform report listing accepts both `custom-integration` and `custom_integration` ids so scheduled report cards appear in the Reports tab.
- Fixes: scheduled/test/snapshot PDF generation now has a Custom Integration source-backed builder using the latest imported metric row plus current platform KPI/Benchmark rows; missing source-backed output fails closed instead of creating misleading snapshots.
- Runtime commits included in Commit 9 scope: `a9bc030b`, `40ebe66a`, `f8ad6a4f`, `6f958e6e`, and `2a5f7362`.
- Regression evidence: `server/source-safety-regression.test.ts` verifies the Custom Integration Reports modal anchors, GA4-style report cards, scheduled card visibility support, no extra modal back link, collapsed custom section picker, no redundant Overview selector, source-backed report values, saved source scope, schedule payload normalization, edit-prefill/update-disabled behavior, scheduler inclusion, source-backed builder, summary report allowance, and snapshot fail-closed guard.
- Local validation: `npm test -- server/source-safety-regression.test.ts`, `npm run check`, and targeted `git diff --check` passed.
- User validation passed for Commit 9 after deployed browser review.
- Deferred by tracker scope: existing-data cleanup, email-forwarding live delivery, and full final production-readiness evidence remain in later commits.

### Commit 10: Campaign Aggregates And DeepDive

Goal:

- Ensure Custom Integration contributes to campaign-level analytics only through the shared aggregate contract.

Tasks:

- Verify `/outcome-totals`, Executive Summary, Performance Summary, Platform Comparison, Trend Analysis, and scheduler snapshots consume Custom Integration through the same normalized source contract.
- Add unavailable reasons for unsupported aggregate fields.
- Prevent Custom Integration from being treated as a GA4 replacement unless the imported fields actually support web analytics outcomes.

Validation:

- Regression tests for aggregate availability, source labels, scheduler snapshots, and no double counting.

Status:

- Completed and user-validated for Commit 10.
- Root cause: campaign aggregate callers treated Custom Integration as a web analytics source whenever a metrics row existed, and the aggregate adapter advertised all Custom Integration fields as available even when the import did not contain those fields. That could make missing users, sessions, pageviews, impressions, conversions, spend, or revenue look like real `0` values in Campaign DeepDive, Executive Summary, Platform Comparison, Trend Analysis, and scheduler snapshots.
- Fixes: Custom Integration aggregate availability is now field-aware, missing fields produce unavailable reasons, `/outcome-totals` and Executive Summary only use Custom Integration as `webAnalyticsProvider` when GA4 is not primary and the import contains users/sessions/pageviews, Custom Integration spend participates in campaign spend fallback when imported, and scheduler snapshots use the same Custom Integration aggregate field gating.
- Runtime commit included in Commit 10 scope: `dc215900` campaign aggregate and scheduler gating.
- Regression evidence: `server/performance-summary-aggregate.test.ts` verifies missing Custom Integration fields stay unavailable and Custom Integration web analytics requires an explicit web-provider caller; `server/performance-summary-scheduler-regression.test.ts` verifies scheduler web-provider gating; `server/source-safety-regression.test.ts` verifies `/outcome-totals` and Executive Summary route gating.
- Local validation: `npm test -- server/performance-summary-aggregate.test.ts`, `npm test -- server/performance-summary-scheduler-regression.test.ts`, `npm test -- server/source-safety-regression.test.ts`, `npm test -- server/executive-summary-regression.test.ts`, `npm test -- server/platform-comparison-regression.test.ts`, `npm test -- server/trend-analysis-aggregate.test.ts`, `npm test -- server/custom-report-regression.test.ts`, `npm run check`, and targeted `git diff --check` passed.
- User validation passed for Commit 10 after deployed browser review.
- Deferred by tracker scope: existing-data cleanup, email-forwarding usability/live delivery, and final production-readiness evidence remain in later commits.

### Commit 11: Existing Data And Cleanup Boundary

Goal:

- Handle existing saved records without inventing values.

Tasks:

- Detect KPI/Benchmark/Report rows that have Custom Integration current values but no resolvable source scope.
- Fail closed as unavailable until edited/resaved, or add a narrowly scoped self-heal only when exact source identity can be proven.
- Audit existing imported metrics created by duplicate or legacy upload paths.

Validation:

- Regression tests prove legacy rows do not silently show stale or zero-filled values.

Status:

- Completed and user-validated for Commit 11.
- Root cause: saved Custom Integration KPI, Benchmark, and Report rows could still resolve current values from the latest import when their saved source scope was missing or no longer matched the connected Custom Integration source. That could make old rows look valid while actually reading the wrong import.
- Fixes: KPI and Benchmark cards now require saved Custom Integration source scope before resolving source-backed current values; saved report downloads fail closed when report source scope is missing or disconnected; scheduled Custom Integration PDF generation now requires valid report source scope and marks KPI/Benchmark rows unavailable when their saved source scope is missing or mismatched.
- Runtime commit included in Commit 11 scope: `b2fdf8d3` saved source-scope guard.
- Regression evidence: `server/source-safety-regression.test.ts` verifies missing saved source scope, disconnected source scope, saved report download fail-closed behavior, and scheduled report row fail-closed behavior.
- Local validation: `npm test -- server/source-safety-regression.test.ts`, `npm run check`, and targeted `git diff --check` passed.
- User validation passed for Commit 11 after deployed browser review.
- Boundary: Commit 11 fixed forward safety for saved rows. It did not perform a production database cleanup or duplicate-import audit; that remains part of the final evidence pass unless a separate cleanup is explicitly requested.

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

Status:

- Local Commit 12 implementation and regression pass completed; deployed browser validation is pending.
- Root cause: `/api/custom-integration/:campaignId/connect` returned `campaignEmail`, but Create Campaign and Campaign Detail ignored it. Create Campaign moved to confirmation without showing the address; Campaign Detail immediately reloaded after setup, so users had no usable forwarding address.
- Fixes: Create Campaign now stores the returned forwarding email, shows `Forward PDF reports to` with a copy button on the confirmation step, and clears that state for manual PDF uploads/reset. Campaign Detail now stores and displays the returned forwarding email with a copy button and no longer reloads immediately after email-forwarding setup.
- Regression evidence: `server/source-safety-regression.test.ts` verifies Create Campaign and Campaign Detail both consume `campaignEmail`, display the forwarding address, expose copy actions, and keep the Campaign Detail email-forwarding success path on-page.
- Local validation: `npm test -- server/source-safety-regression.test.ts`, `npm test -- server/source-safety-regression.test.ts server/pdf-parser-regression.test.ts server/performance-summary-aggregate.test.ts server/performance-summary-scheduler-regression.test.ts server/executive-summary-regression.test.ts server/platform-comparison-regression.test.ts server/trend-analysis-aggregate.test.ts server/custom-report-regression.test.ts server/legacy-route-reachability-regression.test.ts`, `npm run check`, and targeted `git diff --check` passed.
- Pending validation: deployed browser validation for the full Commit 12 matrix, manual PDF upload with a known PDF, scheduled report behavior if exposed, and live Mailgun/SendGrid inbound forwarding delivery.

### Deferred Follow-Up: Email Forwarding Usability

Goal:

- Make the existing `Set Up Email Forwarding` path usable for non-technical users.

Root cause:

- The backend returns `campaignEmail` from `/api/custom-integration/:campaignId/connect`, but Create Campaign currently only shows a success toast and does not display the generated forwarding address.

Safe timing:

- UI usability was completed in Commit 12.
- Live inbound provider validation must still be completed before email forwarding is called production-ready.

Smallest expected fix:

- After email-forwarding setup, show `Forward PDF reports to: <campaignEmail>` with a copy button. Completed in Commit 12.
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
