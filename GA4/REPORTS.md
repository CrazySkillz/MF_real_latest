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
4. the user either downloads immediately or enables scheduling and saves the report

## Standard Templates

Current standard template types:

- `Overview`
- `KPIs`
- `Benchmarks`
- `Ad Comparison`
- `Insights`

These are single-focus report presets.

## Custom Report

Current custom sections:

- `Overview`
- `KPIs Snapshot`
- `Benchmarks Snapshot`
- `Ad Comparison`
- `Insights`

Important meaning:

- custom reports are section-composition reports
- future work should preserve section-based composition

## Naming And Description

Both standard and custom reports support:

- report name
- optional description

## Generate And Download Behavior

Current behavior:

- new unscheduled reports generate and download immediately
- those ad hoc downloads are not automatically saved into the report library
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
- reports are an output view of the latest refreshed GA4 campaign state

## Current-State Note

The current implementation is only partially aligned with that ideal.

Aligned:

- ad hoc GA4 downloads are rendered client-side from live GA4 page state
- once the tab inputs are refreshed, on-demand GA4 downloads reflect the refreshed values
- scheduled report storage, snapshots, and email sending are real backend features

Important caveats:

- saved report configurations do not have their own recompute job
- scheduled/server-generated PDF output is strongest for `KPIs` and `Benchmarks`
- for some other report types in the shared scheduler path, the generated PDF is still lightweight compared with the richer client-side GA4 PDF renderer
- the shared scheduler and report-link helper still contain legacy LinkedIn-oriented infrastructure details
