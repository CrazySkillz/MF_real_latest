# GA4 Financial Sources

## Purpose

This file defines how GA4 `Total Revenue`, `Total Spend`, and related financial values are populated, updated, recomputed, and displayed.

This is a sensitive area.

## Total Revenue And Total Spend Pattern

The `+` buttons on `Total Revenue` and `Total Spend` are source-management entry points.

They are not inline edit controls.

Required pattern:

1. user clicks `+`
2. a source-specific workflow opens
3. the user completes source-specific setup, mapping, or entry
4. the system saves a source definition
5. the system materializes normalized records tied to that source
6. derived campaign values are recomputed
7. GA4 card queries refetch
8. the cards and source rows repopulate from the updated state

## Revenue Computation

### Total Revenue

`Total Revenue = GA4 native revenue + imported revenue`

Where:

- GA4 native revenue comes from this campaign's GA4 scope
- imported revenue comes from active GA4-context revenue sources attached to this campaign

### Latest Day Revenue

`Latest Day Revenue` uses:

- the most recent complete GA4 revenue day
- plus imported dated revenue records for the same relevant day when available

## Spend Computation

### Total Spend

`Total Spend` is computed only from explicit active spend sources attached to the campaign.

Spend is not imported from the GA4 API by default.

### Latest Day Spend

`Latest Day Spend` is driven by materialized spend records for the relevant day.

This includes:

- daily imported spend rows
- snapshot-style records where a source does not provide daily history

## Derived Financial Metrics

The following are derived outputs:

- `Profit = Revenue - Spend`
- `ROAS = Revenue / Spend`
- `ROI = (Revenue - Spend) / Spend`
- `CPA = Spend / Conversions`

If spend or revenue is missing, downstream metrics may be blocked or call out missing prerequisites.

## The Six `Total Revenue +` Options

Revenue source options:

1. `Shopify`
2. `HubSpot`
3. `Salesforce`
4. `Google Sheets`
5. `Upload CSV`
6. `Manual`

### Revenue Workflow Meaning

- `Shopify`, `HubSpot`, and `Salesforce` are attribution and mapping workflows, not simple value entry
- `Google Sheets` and `CSV` are structured import workflows
- `Manual` is a direct campaign revenue-entry workflow

## The Six `Total Spend +` Options

Spend source options:

1. `LinkedIn Ads`
2. `Meta / Facebook`
3. `Google Ads`
4. `Google Sheets`
5. `Upload CSV`
6. `Manual`

### Spend Workflow Meaning

- connected ad-platform options import spend for the campaign from the linked source
- `Google Sheets` and `CSV` import spend records
- `Manual` creates a direct spend source for the campaign

## Source Rows Under The Cards

The rows under `Total Revenue` and `Total Spend` are provenance and audit rows.

They show which sources contribute to the totals.

Important meaning:

- edit/delete actions operate on source definitions and their records
- they do not directly edit the total card value

## Edit And Delete Pattern

The required pattern is:

1. user edits or deletes a source row
2. the source definition and/or materialized records are updated
3. campaign financial values are recomputed
4. the cards and provenance rows repopulate from the new state

## Critical Computation Rules

- the card is never the source of truth
- source definitions plus normalized records are the source of truth
- recomputation must happen after add, edit, delete, and eligible auto-refresh operations
- downstream KPI, benchmark, insights, and report values must use the recomputed financial state

## Current-State Note

The current implementation is intentionally hybrid:

- GA4 native revenue can coexist with imported revenue
- spend is always explicit and source-backed
- manual and CSV flows behave more like snapshot inputs than auto-refreshing connectors

Future work must preserve financial provenance and recomputation accuracy.
