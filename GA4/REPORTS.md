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

## Custom Report

Current custom sections:

- `Overview`
- `KPIs Snapshot`
- `Benchmarks Snapshot`
- `Ad Comparison`
- `Insights`

Intended future pattern:

- the custom-report builder should show each major GA4 tab as a parent section
- under each parent section, the user should be able to select specific subsections to include
- example:
  - `Overview`
    - `Summary`
    - `Revenue & Financial`
    - `Campaign Breakdown`
    - `Landing Pages`
    - `Conversion Events`
- the same subsection-selection model should apply to the other GA4 tabs where that granularity is useful
- expected examples by tab:
  - `KPIs`
    - show the campaign's KPI list so users can tick specific KPIs to include
    - optionally include the KPI `Executive snapshot`
  - `Benchmarks`
    - show the campaign's benchmark list so users can tick specific benchmarks to include
    - optionally include the Benchmark `Executive snapshot`
  - `Ad Comparison`
    - `Top summary cards`
    - `Ranked comparison chart`
    - `All Campaigns`
    - `Revenue Breakdown`
  - `Insights`
    - `Executive summary`
    - `Executive financials`
    - `Data Summary`
    - `Trends`
    - `What changed, what to do next`
- this would let users build a truly tailored executive report rather than only toggling whole top-level tab sections on or off

Important meaning:

- custom reports are section-composition reports
- custom reports store report configuration, not frozen analytics values
- actual report values should come from refreshed GA4 tab inputs when the report is generated or sent
- future work should preserve section-based composition

Current-state note:

- the current implementation only exposes top-level section checkboxes
- it does not yet expose nested subsection checkboxes under each tab
- it does not yet expose KPI-by-KPI or benchmark-by-benchmark selection inside the custom report flow
- this should be treated as a future enhancement to the custom-report builder, not the current behavior

## Naming And Description

Both standard and custom reports support:

- report name
- optional description

## Generate And Download Behavior

Current behavior:

- creating a new unscheduled report surfaces a `Generate & Download report` link/action so the user can download it immediately
- those ad hoc downloads do not necessarily create a persistent library entry
- existing saved reports can also be downloaded again

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

## Backend Report Model

The current backend supports:

- campaign-scoped platform report records
- schedule validation
- scheduled email sending
- report snapshots
- test-send behavior

Current implementation detail:

- GA4 reports use `/api/platforms/google_analytics/reports`
- under the hood they currently reuse the shared platform report storage model based on `linkedin_reports`

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

Important caveats:

- saved report configurations do not have their own recompute job
- ad hoc client-side GA4 report generation is currently richer than the shared scheduled/server-rendered path
- the current `Ad Comparison` report output reflects the current GA4 comparison implementation, which is campaign-row comparison rather than true ad/creative-level reporting
- scheduled/server-generated PDF output is strongest for `KPIs` and `Benchmarks`
- for some other report types in the shared scheduler path, the generated PDF is still lightweight compared with the richer client-side GA4 PDF renderer
- the shared scheduler and report-link helper still contain legacy LinkedIn-oriented infrastructure details

## Report Library Meaning

The report list should be treated as a library of saved report configurations and scheduled reports.

It should not be treated as a historical archive of every ad hoc report ever generated and downloaded.
