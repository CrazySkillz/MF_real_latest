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

Important clarification:

- some campaigns may not have GA4-native revenue available at all
- in those cases, users may rely entirely on imported external revenue sources
- the GA4 revenue metric is optional to the overall campaign revenue model; external revenue import is a valid primary path

### Latest Day Revenue

Intended behavior:

- `Latest Day Revenue` should show the previous day's total revenue for the campaign across all applicable revenue sources

Current-state note:

- parts of the current implementation still use a narrower report-day-based approach
- that implementation detail should not be treated as the design template

## Spend Computation

### Total Spend

`Total Spend` is computed only from explicit active spend sources attached to the campaign.

Spend is not imported from the GA4 API by default.

### Latest Day Spend

Intended behavior:

- `Latest Day Spend` should show the previous day's total spend for the campaign across all applicable spend sources

Current-state note:

- parts of the current implementation still use narrower date-selection logic
- that implementation detail should not be treated as the design template

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

When the user clicks `+` on the `Total Revenue` card:

1. the revenue-source modal opens
2. the user sees these six options
3. selecting an option starts a source-specific workflow

Important meaning:

- these are six distinct user journeys
- they are not six labels pointing to one generic "add revenue" action
- future development should preserve the source-specific flow for each option

### Revenue Workflow Meaning

- `Shopify`, `HubSpot`, and `Salesforce` are connection + attribution/mapping workflows, not simple value entry
- `Google Sheets` and `CSV` are preview + mapping + import workflows
- `Manual` is a direct campaign revenue-entry workflow

Production direction note:

- `Manual` is being retained during the current GA4 validation/manual-testing phase
- after the full GA4 user-journey test pass is complete, the intended production direction is to remove `Manual` entirely
- the reason is data-quality and data-integrity protection: unrestricted manual revenue entry creates avoidable provenance, duplication, and audit-risk issues

Executive-UX note:

- these workflows are logical for enterprise users who need source provenance and campaign attribution
- however, CRM and ecommerce flows are still configuration-heavy and may feel too technical for some marketing executives without analyst support
- if this is improved later, the priority should be reducing setup friction without weakening attribution accuracy or source provenance

## Revenue Source 1: Shopify Journey

The user journey is:

1. user clicks `+` on `Total Revenue`
2. the modal opens and the user selects `Shopify`
3. if Shopify OAuth is not already authenticated, the user is taken through the Shopify connection step inside the flow
4. once connected, the Shopify revenue wizard opens
5. the user configures how Shopify order revenue should be attributed to this campaign
6. the user selects the campaign field / attribution field used to match Shopify data to this campaign
7. the user selects the matching value or values for this campaign
8. the user confirms the mapping and import settings
9. the system saves a Shopify revenue source for this campaign
10. the system materializes normalized revenue records for the matched Shopify orders
11. campaign financial values are recomputed and the GA4 cards/source rows refetch

Important meaning:

- Shopify is an attribution workflow
- the user is not entering a single total; they are defining how Shopify order revenue should belong to this campaign

## Revenue Source 2: HubSpot Journey

The user journey is:

1. user clicks `+` on `Total Revenue`
2. the modal opens and the user selects `HubSpot`
3. if HubSpot is not yet authenticated, the flow triggers HubSpot OAuth first
4. once authenticated, the HubSpot revenue wizard opens
5. the user chooses the HubSpot campaign property used to identify matching records
6. the user selects the matching property value or values for this campaign
7. the user chooses the HubSpot revenue property
8. the user chooses the date field / lookback window used for the import
9. optionally, the user configures pipeline-related settings if that path is enabled
10. the system saves a HubSpot revenue source with the mapping configuration
11. the system materializes normalized revenue records for the matched HubSpot records
12. campaign financial values are recomputed and the GA4 cards/source rows refetch

Important meaning:

- HubSpot is a CRM mapping workflow
- the user maps HubSpot deal revenue into this campaign rather than typing a single value
- the HubSpot `Date field` is logically necessary in the current model because it decides which HubSpot deal date property is used when including/reporting revenue
- `Close Date` is the default for finance-style won-revenue reporting
- `Last Modified Date` is useful when the user wants revenue tied to recently updated deals
- `Created Date` is useful when the user wants revenue tied to when opportunities first entered HubSpot
- the `Reconnect` action on the first HubSpot screen should render in a stable header/action area, not inside the main source-choice card or a shifting scroll region

## Revenue Source 3: Salesforce Journey

The user journey is:

1. user clicks `+` on `Total Revenue`
2. the modal opens and the user selects `Salesforce`
3. if Salesforce is not yet authenticated, the flow triggers Salesforce OAuth first
4. once authenticated, the Salesforce revenue wizard opens
5. the user chooses the Salesforce campaign/attribution field used to identify matching opportunities
6. the user selects the matching value or values for this campaign
7. the user chooses the Salesforce revenue field
8. the user chooses the date field / lookback window used for import
9. optional pipeline settings can be configured where supported
10. the system validates the mapping and currency requirements
11. the system saves a Salesforce revenue source with the mapping configuration
12. the system materializes normalized revenue records for the matched Salesforce opportunities
13. campaign financial values are recomputed and the GA4 cards/source rows refetch

Important meaning:

- Salesforce is a CRM opportunity-mapping workflow
- this path is sensitive because it can include currency validation and attribution-field matching
- in edit mode, Salesforce revenue must preserve the existing revenue `sourceId` all the way through the save request so the system updates the existing source instead of creating an additive duplicate
- Salesforce review-step `Total Revenue (to date)` should prefer fresh preview data from the current edit session over stored `lastTotalRevenue` values from the previous save

## Revenue Source 4: Google Sheets Journey

The user journey is:

1. user clicks `+` on `Total Revenue`
2. the modal opens and the user selects `Google Sheets`
3. the user enters the Google Sheets connection chooser step
4. if no suitable sheet connection exists yet, the user connects a Google Sheet / tab first
5. once a connection is selected, the system loads a sheet preview
6. the user selects the revenue column
7. the user can optionally select a campaign column and matching campaign value or values
8. the user can optionally select a date column
9. the user confirms the mapping and runs the import
10. the system saves a Google Sheets revenue source with the mapping configuration
11. the system materializes normalized revenue records from the sheet rows
12. campaign financial values are recomputed and the GA4 cards/source rows refetch

Important meaning:

- Google Sheets is a connected-sheet preview and mapping workflow
- the preview step is part of the source-selection journey, not a separate admin flow
- if the user selects a date column, the source behaves like daily revenue history
- if the user does not select a date column, the source behaves like a revenue snapshot / revenue-to-date import
- the date column supports daily-history behavior; it does not itself create automatic daily syncing
- Google Sheets refreshability comes from the connected sheet source, while the date column controls date granularity
- if a campaign column is selected and matching values are available, at least one campaign value must be selected before import
- Google Sheets revenue edit should keep `Update revenue` disabled until a meaningful edit is made
- the UI should make this daily-history vs snapshot distinction explicit so users understand the downstream effect on latest-day and trend-style views

## Revenue Source 5: CSV Journey

The user journey is:

1. user clicks `+` on `Total Revenue`
2. the modal opens and the user selects `Upload CSV`
3. the user uploads a CSV file
4. the system generates a CSV preview
5. the user selects the revenue column
6. the user selects the campaign column
7. the user selects one or more campaign values to keep for this campaign
8. the user can optionally select a date column
9. the user confirms the mapping and runs the import
10. the system saves a CSV revenue source with the mapping configuration
11. the system materializes normalized revenue records from the kept CSV rows
12. campaign financial values are recomputed and the GA4 cards/source rows refetch

Important meaning:

- CSV is a structured import workflow, not a simple file attachment
- without a date column, the import behaves more like a revenue-to-date snapshot
- with a date column, the source behaves more like daily revenue history
- a date column supports daily-history calculations and latest-day/trend-style views; it does not make CSV auto-refreshing
- because CSV is manual, updates require re-upload rather than automatic refresh
- CSV should be treated as a one-time or occasional import, not an auto-syncing source
- if a campaign column is selected and matching values are available, at least one campaign value must be selected before import
- the UI should make it explicit that CSV updates require manual re-upload
- CSV revenue edit should reopen directly into the mapping screen when the stored imported dataset is available
- if only campaign-value selection changes, CSV revenue should recalculate without forcing a re-upload
- if structural mappings change, such as revenue column, conversion value column, campaign column, date column, or value-source mode, re-upload is still required
- `Update revenue` should remain disabled until a meaningful edit is made

## Revenue Source 6: Manual Journey

The user journey is:

1. user clicks `+` on `Total Revenue`
2. the modal opens and the user selects `Manual`
3. the user enters the manual revenue step
4. the user enters a revenue amount
5. the system saves a manual revenue source for the campaign
6. the system materializes a revenue record for that manual entry
7. campaign financial values are recomputed and the GA4 cards/source rows refetch

Important meaning:

- `Manual` is a direct value-entry workflow
- unlike CRM and sheet-based options, it is not an attribution or import mapping process
- it behaves more like a manually maintained revenue snapshot and is best treated as a higher-friction, less automated path
- it should be treated as a temporary validation/testing path rather than a long-term production workflow

## The Six `Total Spend +` Options

Spend source options:

1. `LinkedIn Ads`
2. `Meta / Facebook`
3. `Google Ads`
4. `Google Sheets`
5. `Upload CSV`
6. `Manual`

When the user clicks `+` on the `Total Spend` card:

1. the spend-source modal opens
2. the user sees these six options
3. selecting an option starts a source-specific workflow

### Spend Workflow Meaning

- `LinkedIn Ads`, `Meta / Facebook`, and `Google Ads` are connector-based spend workflows with campaign selection inside the modal
- `Google Sheets` and `CSV` are preview + mapping + import workflows
- `Manual` is a direct spend-entry workflow

Production direction note:

- `Manual` is being retained during the current GA4 validation/manual-testing phase
- after the full GA4 user-journey test pass is complete, the intended production direction is to remove `Manual` entirely
- the reason is data-quality and data-integrity protection: unrestricted manual spend entry creates avoidable provenance, duplication, and audit-risk issues

Important meaning:

- these are six distinct spend-source journeys
- they are not six labels pointing to one generic "add spend" action
- some ad-platform paths support `Test mode` so users can validate the flow with mock data before using live connector data

## Spend Source 1: LinkedIn Ads Journey

The user journey is:

1. user clicks `+` on `Total Spend`
2. the modal opens and the user selects `LinkedIn Ads`
3. if LinkedIn Ads is not connected yet, the panel shows two paths:
4. the user can connect a real LinkedIn Ads account through OAuth
5. or the user can enable `Test mode` and load mock LinkedIn campaign data immediately
6. for the real path, after OAuth the user selects a LinkedIn ad account
7. the system fetches a LinkedIn spend preview for the connected ad account
8. the user sees a campaign list with spend, impressions, and clicks
9. the user selects one or more LinkedIn campaigns to include
10. the user clicks `Import spend`
11. the system saves a LinkedIn spend source for the campaign
12. the system materializes spend records and recomputes campaign financial values
13. the GA4 cards and source rows refetch

Important meaning:

- LinkedIn spend is a campaign-selection workflow, not a freeform value entry flow
- `Test mode` is intentionally available here so users can validate the full selection/import flow with mock campaigns

## Spend Source 2: Meta / Facebook Journey

The user journey is:

1. user clicks `+` on `Total Spend`
2. the modal opens and the user selects `Meta / Facebook`
3. if Meta is not connected yet, the panel shows two paths
4. the user can connect a real Meta account through OAuth
5. or the user can enable `Test mode`
6. when the account is connected, the system fetches available Meta daily-metrics data and groups it by campaign
7. the user sees a campaign list with spend, impressions, and clicks
8. the user selects one or more Meta campaigns to include
9. the user clicks `Import spend`
10. the system saves a Meta/Facebook spend source with campaign-selection breakdown metadata
11. the system materializes spend records and recomputes campaign financial values
12. the GA4 cards and source rows refetch

Important current-state note:

- `Test mode` is an explicit supported path for Meta spend in this modal
- the import flow is campaign-selection-based, but the selected total is currently persisted through the manual spend-processing route with `ad_platforms` metadata
- future changes should preserve the visible user journey while improving backend specialization only if needed

## Spend Source 3: Google Ads Journey

The user journey is:

1. user clicks `+` on `Total Spend`
2. the modal opens and the user selects `Google Ads`
3. if Google Ads is not connected yet, the panel shows two paths
4. the user can connect a real Google Ads account through OAuth
5. or the user can enable `Test mode`
6. once connected, the system fetches Google Ads daily-metrics data and groups it by campaign
7. the user sees a campaign list with spend, impressions, and clicks
8. the user selects one or more Google Ads campaigns to include
9. the user clicks `Import spend`
10. the system saves a Google Ads spend source with campaign-selection breakdown metadata
11. the system materializes spend records and recomputes campaign financial values
12. the GA4 cards and source rows refetch

Important current-state note:

- `Test mode` is supported here and is intended for validating the full import flow with mock Google Ads data
- like the Meta flow, the selected total is currently persisted through the manual spend-processing route with `ad_platforms` metadata

## Spend Source 4: Google Sheets Journey

The user journey is:

1. user clicks `+` on `Total Spend`
2. the modal opens and the user selects `Google Sheets`
3. the user enters the Google Sheets connection chooser step
4. if no suitable spend-purpose sheet connection exists yet, the user connects a Google Sheet / tab first
5. the user selects the connected sheet/tab
6. the system loads a preview of the sheet headers and sample rows
7. the user selects the spend column
8. the user can optionally select a campaign identifier column and one or more campaign values
9. the user confirms the mapping and runs the import
10. the system saves a Google Sheets spend source with the mapping configuration
11. the system materializes spend records and recomputes campaign financial values
12. the GA4 cards and source rows refetch

Important current-state note:

- the visible spend flow is a preview + mapping + import workflow
- in the current spend UI, Google Sheets is treated as a spend-to-date import flow rather than a user-configured daily-date mapping flow
- Google Sheets spend is eligible for scheduled auto-refresh after setup
- if the user selects a campaign identifier column and matching values are available, at least one campaign value must be selected before import

## Spend Source 5: CSV Journey

The user journey is:

1. user clicks `+` on `Total Spend`
2. the modal opens and the user selects `Upload CSV`
3. the user uploads a CSV file
4. the system generates a preview of headers and sample rows
5. the user selects the spend column
6. the user can optionally select a campaign identifier column and one or more campaign values
7. the user confirms the mapping and runs the import
8. the system saves a CSV spend source with the mapping configuration
9. the system materializes spend records and recomputes campaign financial values
10. the GA4 cards and source rows refetch

Important meaning:

- CSV spend is a structured import workflow, not a file attachment
- the visible flow behaves like a spend-to-date snapshot import
- CSV spend does not auto-refresh on a schedule
- once a CSV spend source has been imported with the persisted edit payload, edit mode can recalculate from the stored imported dataset when the user changes only campaign-value selection
- if the user changes mapped columns or the original stored dataset is not available, re-upload is still required

## Spend Source 6: Manual Journey

The user journey is:

1. user clicks `+` on `Total Spend`
2. the modal opens and the user selects `Manual`
3. the user enters the manual spend step
4. the user types a spend amount
5. the user saves the amount
6. the system saves a manual spend source for the campaign
7. the system materializes a spend record and recomputes campaign financial values
8. the GA4 cards and source rows refetch

Important meaning:

- `Manual` is a direct spend-entry workflow
- it behaves like a manually maintained snapshot, not a refreshable connector
- the current UI explicitly positions it as best suited for testing/manual fallback rather than automated ongoing sync
- it should be treated as a temporary validation/testing path rather than a long-term production workflow

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

### Edit Meaning By Source Type

- connector-based revenue or spend sources should reopen their source-specific flow rather than exposing a raw total-field edit
- `Google Sheets` edit should reopen the connection/mapping flow for that sheet source
- `Google Sheets` spend edit should keep `Update spend` disabled until the user makes a meaningful change
- `Google Sheets` spend edit should allow recalculation when the user changes selected campaign values, mapped columns, or the selected sheet connection
- `CSV` spend edit should reopen the mapping flow
- if only campaign-value selection changes and the stored import dataset is available, `Update spend` should recalculate without forcing a re-upload
- if mapped columns change or the original stored dataset is unavailable, `CSV` spend edit should require re-upload
- `CSV` spend edit should keep `Update spend` disabled until the user makes a meaningful change
- `Salesforce` revenue edit must update the existing revenue source and replace that source's materialized records rather than creating a second additive source row
- for CRM edit flows, stable source identity is required: the existing `sourceId` must survive modal -> wizard -> save payload -> save route
- review-step totals in CRM edit flows should refresh from the current preview inputs and should not let stale saved totals override fresh preview totals
- `Manual` edit should overwrite the saved snapshot amount and then recompute downstream values

### Campaign Filter Meaning For CSV And Google Sheets

- if the user selects a campaign identifier column and one or more campaign values, only matching rows should contribute to this campaign
- if a campaign identifier column is selected and matching values are available, import should be blocked until at least one campaign value is chosen
- if the user does not apply that filter, the imported source is treated as wholly belonging to this campaign

### Refreshable Vs Snapshot Behavior

- `HubSpot`, `Salesforce`, `Shopify`, and eligible `Google Sheets` revenue sources are refreshable connector-style sources
- `Google Sheets` spend is a refreshable source after setup
- `LinkedIn Ads` spend is connector-based and refreshable through the platform refresh pipeline
- `Meta / Facebook` and `Google Ads` spend currently use connected-platform selection flows, but their current persisted spend handling is still more snapshot-like than a fully specialized connector pipeline
- `Upload CSV` revenue is a manual snapshot source and requires re-upload for updates
- `Upload CSV` spend is a manual snapshot source for import cadence, but spend-source edit can recalculate from the stored imported dataset when only campaign-value selection changes
- `Manual` revenue/spend is a manual snapshot source and requires direct manual updates
- planned production direction: remove `Manual` after the current GA4 validation cycle is complete

### Financial Source-Of-Truth Hierarchy

1. the user completes a source-specific add or edit flow
2. the system saves or updates the source definition and mapping configuration
3. the system materializes normalized revenue or spend records from that source
4. campaign financial totals are recomputed from those records and any applicable native GA4 revenue
5. the GA4 Overview cards and financial source rows refetch from the recomputed state

Important meaning:

- the cards themselves are never the source of truth
- source definitions and normalized records are the source of truth

## Critical Computation Rules

- the card is never the source of truth
- source definitions plus normalized records are the source of truth
- recomputation must happen after add, edit, delete, and eligible auto-refresh operations
- downstream KPI, benchmark, ad comparison, insights, and report values must use the recomputed financial state

## Current-State Note

The current implementation is intentionally hybrid:

- GA4 native revenue can coexist with imported revenue
- spend is always explicit and source-backed
- manual and CSV flows behave more like snapshot inputs than auto-refreshing connectors
- some users may have no GA4-native revenue and rely entirely on imported external revenue sources

Planned production direction:

- `Manual` is currently retained to support testing and validation
- once the full GA4 manual-user-journey pass is complete, `Manual` should be removed from production revenue and spend source options
- `CSV` may still remain as a structured manual import path, but unrestricted direct manual entry should not remain a general production option

Future work must preserve financial provenance and recomputation accuracy.
