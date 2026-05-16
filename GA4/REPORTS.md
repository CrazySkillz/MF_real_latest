# GA4 Reports

## Purpose

This file defines the GA4 `Reports` tab and the current report-creation, download, scheduling, and report-output model.

## Reports Tab Structure

The current GA4 `Reports` tab contains:

- `Create Report`
- existing saved reports for this campaign
- schedule metadata when scheduling is enabled
- `Download`, `Edit`, and `Delete` actions

## Report Library Behavior

The current list shows:

- report name
- optional description
- report type
- schedule timing when enabled
- last sent date when available
- created date

Delete behavior:

- deleting a saved report should remove only that report record
- the delete route must return failure when no report row was actually deleted
- deleting one campaign's saved report must not mutate reports belonging to another campaign or platform context

## Create Report Entry Flow

1. user opens the GA4 `Reports` tab
2. user clicks `Create Report`
3. the modal offers:
   `Standard Templates`
   `Custom Report`
4. if the user is creating a new unscheduled report, the flow presents a `Generate & Download report` action
5. the user can either download immediately or enable scheduling and save the report

## Standard Templates

Current standard template types:

- `Overview`
- `KPIs`
- `Benchmarks`
- `Ad Comparison`
- `Insights`

These are single-focus report presets.

Expected meaning:

- `Overview` should represent the GA4 Overview reporting layer
- `KPIs` should represent the KPI reporting layer
- `Benchmarks` should represent the Benchmark reporting layer
- `Ad Comparison` should represent the comparison reporting layer
- `Insights` should represent the insight/reporting narrative layer

Current standard-template output rule:

- each standard template PDF should mirror the same tab substance and section order as the corresponding live GA4 tab as closely as the current PDF renderer allows
- `Overview` should follow the live Overview order
- in `Overview` report output, `Campaign Breakdown` should use the column label `Revenue` because it can include exact campaign-matched imported revenue
- in `Overview` report output, `Landing Pages` and `Conversion Events` should use `GA4 Revenue` because those table rows remain GA4-native only
- `KPIs` should follow the live KPI order
- `Benchmarks` should follow the live Benchmark order
- `Ad Comparison` should follow the live Ad Comparison order
- `Insights` should follow the live Insights order

## Custom Report

Current custom sections:

- `Overview`
- `KPIs`
- `Benchmarks`
- `Ad Comparison`
- `Insights`

Current custom subsection model:

- `Overview`
  - `Summary`
  - `Revenue & Financial`
  - `Campaign Breakdown`
  - `Landing Pages`
  - `Conversion Events`
- `KPIs`
  - specific KPI items only
- `Benchmarks`
  - specific benchmark items only
- `Ad Comparison`
  - `Best Performing / Most Efficient / Needs Attention`
  - `Top Campaigns`
  - `All Campaigns`
  - `Revenue Breakdown`
- `Insights`
  - `Executive Financials`
  - `Trends`
  - `Data Summary`
  - `What to investigate next`

Important meaning:

- custom reports are section-composition reports
- custom reports store report configuration, not frozen analytics values
- actual report values should come from refreshed GA4 tab inputs when the report is generated or sent
- future work should preserve section-based composition
- top-level custom sections are parent headers, not checkboxes
- subsection checkboxes default to unchecked for new custom reports
- KPI and Benchmark selection is item-based
- subsection picker layout is presentation only; saved report meaning comes from the checked subsection keys and selected KPI/Benchmark ids

Custom report output order rule:

- the custom report PDF should print major sections in this order:
  `Overview -> KPIs -> Benchmarks -> Ad Comparison -> Insights`
- within a selected section, the PDF should print the chosen subsections in that section's built-in subsection order
- custom report output should not invent a separate report-only ordering model unless the saved configuration explicitly stores one in the future

## Naming And Description

Both standard and custom reports support:

- report name
- optional description

## Generate And Download Behavior

Current behavior:

- creating a new unscheduled report surfaces a `Generate & Download report` link/action so the user can download it immediately
- those ad hoc downloads do not necessarily create a persistent library entry
- existing saved reports can also be downloaded again
- custom-report generation should require at least one selected section before download
- the modal should remain open if generation fails so the user can correct the issue

Important meaning:

- ad hoc output and saved report management are related but distinct workflows

## Scheduled Reports

When scheduling is enabled, users can configure:

- frequency: `daily`, `weekly`, `monthly`, `quarterly`
- weekly day
- monthly day
- quarterly timing
- time
- email recipients

The UI uses the user's time zone.

Important meaning:

- scheduled delivery timing should be interpreted in the user's saved time zone, not raw server time
- scheduled reports are production-visible outputs and must be guarded by campaign/platform ownership checks
- before sending a campaign-scoped scheduled report, the scheduler must verify that the campaign still exists
- if the campaign is missing, the scheduler must not create a report snapshot, recompute GA4 KPI/Benchmark state, generate/send the email, or update report `lastSentAt`
- if the campaign is proven missing, the scheduler should disable only that orphaned report's schedule so it does not keep retrying on future ticks, including when a previous skipped send event already exists
- report test-send must also fail closed when the resolved report has no valid campaign so stale helper-level callers cannot send orphaned reports
- direct report snapshot JSON/PDF routes must verify both report access and snapshot/report campaign-platform consistency before returning snapshot data or a generated PDF
- scheduler report selection must deduplicate report rows by report ID before due checks because the shared report table can be reached through legacy and platform-specific storage paths
- scheduled send events remain the audit/idempotency layer for each `reportId + scheduledKey`
- scheduled report snapshots represent successfully sent artifacts; failed scheduled sends should update `report_send_events` only and must not create a misleading sent/downloadable snapshot
- scheduled and test-send report emails must include the generated PDF attachment; the email body is delivery scaffolding, not the report content
- report emails should remain plain transactional messages with simple subject/body text and no marketing banner, dashboard CTA, or styled report body because Gmail deliverability rejected the richer report-email payload
- Mailgun/API acceptance is not proof of inbox delivery; when provider delivery events are available, test-send and scheduler diagnostics must distinguish accepted, delivered, failed, and pending delivery states

## Backend Report Model

The current backend supports:

- campaign-scoped platform report records
- schedule validation
- scheduled email sending
- report snapshots
- scheduled attachment generation

Current implementation detail:

- GA4 reports use `/api/platforms/google_analytics/reports`
- under the hood they currently reuse the shared platform report storage model based on `linkedin_reports`
- active GA4 report library actions should use the platform report routes, not stale campaign-level KPI report routes
- stale campaign-level report route/UI code should not be treated as a current product surface unless a current caller is traced first

## Reports Refresh Pattern

The intended pattern after daily auto-refresh is:

1. `Overview` refreshes first
2. `KPIs`, `Benchmarks`, `Ad Comparison`, and `Insights` refresh from those inputs
3. report outputs reflect that refreshed state when the report is generated, downloaded, or sent

Important meaning:

- reports should not maintain a separate stale analytics copy
- `Reports` sits at the end of the GA4 dependency chain:
  `Overview -> KPIs -> Benchmarks -> Ad Comparison -> Insights -> Reports`
- reports are an output view of the latest refreshed GA4 campaign state
- editing a report changes report configuration, scheduling, and delivery settings; it does not directly edit stored campaign metrics

## Current-State Note

The current implementation is only partially aligned with that ideal.

Aligned:

- ad hoc GA4 downloads are rendered client-side from live GA4 page state
- once the tab inputs are refreshed, on-demand GA4 downloads reflect the refreshed values
- scheduled report storage, snapshots, and email sending are real backend features
- server-side scheduled/test-send GA4 PDF generation now exists for:
  - `Overview`
  - `KPIs`
  - `Benchmarks`
  - `Ad Comparison`
  - `Insights`
  - `Custom`
- `Custom` server-side rendering reuses those same section renderers and respects the saved selected sections/subsections
- standard-template and custom-report PDFs should now be evaluated for section parity against the live tab, not against older lightweight cover-page output
- report delete status now reflects whether a row was actually deleted
- scheduled delivery skips or fails closed when a campaign-scoped report no longer has a valid campaign
- scheduled delivery deduplicates report rows before due checks
- scheduled report email delivery uses the configured email provider detected at send time; if Mailgun API credentials are present, scheduled reports use the Mailgun HTTP API instead of falling back to unauthenticated SMTP
- platform report test-send uses the same ownership guard and Mailgun HTTP API-compatible configuration path as scheduled report delivery
- scheduled/test-send report emails use a plain transactional `MimoSaaS report attached` payload and attach the generated PDF as the primary report artifact
- platform report test-send verifies Mailgun delivery status when the provider exposes events and returns failure when the provider later rejects the accepted message
- scheduled send events keep one audit/idempotency row per `reportId + scheduledKey`; successful rows must not display stale errors from earlier failed email audit rows
- a stale failed scheduled send with no `sentAt` can retry once after the underlying provider issue is fixed; if that retry fails, it is marked as a retry failure and does not loop every scheduler tick

Important caveats:

- saved report configurations do not have their own recompute job
- the current `Ad Comparison` report output reflects the current GA4 comparison implementation, which is campaign-row comparison rather than true ad/creative-level reporting
- the shared scheduler and report-link helper still contain legacy LinkedIn-oriented infrastructure details
- email delivery timing/provider behavior still depends on scheduler execution and runtime email infrastructure, but the GA4 attachment path is no longer intentionally header-only for standard templates or `Custom`
- provider acceptance alone must not be shown to users as successful delivery when the provider subsequently reports a failed delivery event

## Report Library Meaning

The report list should be treated as a library of saved report configurations and scheduled reports.

It should not be treated as a historical archive of every ad hoc report ever generated and downloaded.
