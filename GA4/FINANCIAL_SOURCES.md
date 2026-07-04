# GA4 Financial Sources

## Purpose

This file defines how GA4 `Total Revenue`, `Total Spend`, and related financial values are populated, updated, recomputed, and displayed.

This is a sensitive area.

## Total Revenue And Total Spend Pattern

The `+` buttons on `Total Revenue` and `Total Spend` are source-management entry points.

They are not inline edit controls.

GA4 platform-level `Total Revenue` and `Total Spend` are source-of-truth financial values for downstream campaign financial analysis. Campaign DeepDive Budget & Financial Analysis consumes those source-backed totals through the aggregate contract and must not override or filter them with budget pacing metadata.

Required pattern:

1. user clicks `+`
2. a source-specific workflow opens
3. the user completes source-specific setup, mapping, or entry
4. the system saves a source definition
5. the system materializes normalized records tied to that source
6. derived campaign values are recomputed
7. GA4 card queries refetch
8. the cards and source modal provenance repopulate from the updated state

Visible Overview layout:

- `Revenue` subsection:
  - `Total Revenue`
  - `Pipeline Proxy` when configured
- `Spend` subsection:
  - `Total Spend`
- `Performance` subsection:
  - `Profit`
  - `ROAS`
  - `ROI`
  - `CPA`

This layout is presentation-only. It must not change financial source-of-truth, source modal provenance, edit/delete behavior, or calculations.

Production-readiness note: GA4 Overview financial-source behavior is production-ready for the current GA4 code scope. The durable Overview readiness and future-platform template source is `GA4/OVERVIEW_PRODUCTION_READINESS.md`.

Campaign DeepDive financial provenance rule:

- Budget & Financial Analysis may use the shared campaign aggregate for totals such as revenue, spend, ROAS, ROI, CPA, and CVR
- detailed financial input rows must come from explicit GA4 financial provenance, not from the high-level `performanceSummary.sources` list
- `/api/campaigns/:id/outcome-totals.financialInputs.revenue` should include native GA4 revenue plus active GA4-context revenue breakdown rows
- `/api/campaigns/:id/outcome-totals.financialInputs.spend` should include active spend breakdown rows
- current `/api/campaigns/:id/outcome-totals.performanceSummary` financial values should use the same selected GA4 native financial revenue/conversion source as the GA4 Overview financial cards, while the top-level `/outcome-totals.ga4` response may still represent the requested date-range GA4 view
- this keeps Campaign DeepDive aligned with the GA4 `Total Revenue -> Sources` and `Total Spend -> Sources` modal provenance while still avoiding duplicate setup or showing child inputs as main Connected Platforms
- imported spend labels inside GA4, such as Google Sheets or LinkedIn spend imports, are not connected ad platforms; they can feed total spend, ROI, and ROAS, but Budget Allocation should only show allocation sources after a spend-capable ad platform is connected in `Connected Platforms`
- Budget & Financial Insights should use aggregate financial metrics for ROAS, ROI, CPA, spend, budget utilization, CTR, CVR, CPC, and CPM; source-performance and reallocation insights should use only spend-capable main connected sources, not GA4 child spend labels
- Budget & Financial trend indicators should compare current aggregate values only against compatible snapshot `metrics.performanceSummary` data with the same aggregate version; legacy top-level snapshot totals must not be mixed into current aggregate comparisons

## Revenue Computation

### Total Revenue

`Total Revenue = selected scoped GA4 native financial revenue + imported revenue`

Where:

- GA4 native revenue comes from this campaign's GA4 scope and uses the same selected scoped GA4 financial source as Overview: the most complete native revenue total across to-date, daily, and breakdown totals, with conversions kept on that same selected source for CPA
- imported revenue comes from active GA4-context revenue sources attached to this campaign

Important clarification:

- some campaigns may not have GA4-native revenue available at all
- in those cases, users may rely entirely on imported external revenue sources
- the GA4 revenue metric is optional to the overall campaign revenue model; external revenue import is a valid primary path
- when GA4 native revenue exists, refresh should update the GA4-native aggregated revenue amount for the campaign's selected GA4 scope
- imported `Total Revenue` is a to-date total and includes source-backed revenue records through the current UTC day; no separate previous-day revenue card is rendered in the current GA4 Overview UI
- imported `Total Revenue`, `Revenue Breakdown`, and the `Revenue Sources` modal must use the same active source-backed revenue record window so the card total and source provenance cannot drift
- native GA4 daily backfill rows belong in `ga4_daily_metrics`; they must not be mirrored into imported `revenue_records` with a synthetic source ID such as `ga4_daily_metrics`
- if old synthetic `revenue_records` rows with `revenue_source_id = 'ga4_daily_metrics'` are found, cleanup must target only the proven orphan row IDs and must not delete active imported CRM, ecommerce, CSV, Google Sheets, manual, or other source-backed revenue rows
- Budget & Financial Analysis pacing metadata, including campaign start and end dates entered from the Budget Pacing & Burn Rate card, must not filter GA4 `Total Revenue`, `Revenue Breakdown`, or the `Revenue Sources` modal. Those platform-level revenue values are source-backed and must include all active revenue-source records to date.
- the `GA4 Revenue` source entry in the `Total Revenue` source modal should show that full aggregated GA4 amount, not a partial or single-day figure
- for GA4 `Ad Comparison`, external revenue may be added into campaign rows only when the source saves real campaign-identifying values that match GA4 campaign rows exactly
- for GA4 `Overview -> Campaign Breakdown`, the same exact campaign-matched rule applies, so that table's column label should be `Revenue`, not `GA4 Revenue`
- `Overview -> Landing Pages` and `Overview -> Conversion Events` remain GA4-native row views and should keep the `GA4 Revenue` label
- any external revenue that cannot be matched safely must remain visible as `Unallocated External Revenue`, not proportionally distributed
- in GA4 `Ad Comparison`, unallocated external revenue is computed from imported-source revenue minus exact matched external revenue; do not infer it from `Total Revenue - GA4 campaign-row revenue`
- one-cent residuals after exact matched external revenue are rounding reconciliation and should not appear as standalone unallocated revenue
- in the GA4 `Ad Comparison` Revenue Breakdown table, a source may show an indented per-campaign subsection from its saved exact `campaignValueRevenueTotals`
- in the GA4 `Ad Comparison` Revenue Breakdown table, `GA4 Revenue` should use the source-level GA4 financial total, not the sum of rounded comparison rows
- that subsection should use the stored source values directly and should not be duplicated by a separate standalone unallocated row when the same amount is already represented there

Production-readiness note: GA4 Ad Comparison financial-source behavior is production-ready for the current GA4 code scope. The only deferred validation is deployed scheduled/server PDF revenue-provenance evidence after Mailgun is properly configured; see `GA4/AD_COMPARISON_PRODUCTION_READINESS.md`.

### Previous-Day Revenue Records

Current UI behavior:

- the GA4 Overview does not render a separate previous-day revenue card in this app version
- previous-day revenue records may still exist for validation, refresh, and possible future versions

Internal endpoint behavior:

- use the previous complete UTC day selected by the server-side daily endpoint
- include every active revenue source that has real daily revenue records for that day
- do not add GA4-native daily revenue into this endpoint; GA4-native revenue remains visible in GA4 metrics and `Total Revenue`
- do not invent daily values for snapshot-only sources that have no record on that date

Important clarification:

- snapshot-style imported revenue must still contribute to `Total Revenue`
- but it must not populate previous-day revenue just because the source materialized a cumulative or revenue-to-date record on `yesterday (UTC)`
- only true daily-history sources should populate previous-day revenue records
- practical examples of snapshot-style revenue for this rule include:
  - existing stored `Manual` revenue snapshots
  - CRM-style cumulative revenue imports that were saved without true dated daily rows
  - CSV or Google Sheets revenue imports without a real date column

## Spend Computation

### Total Spend

`Total Spend` is computed only from explicit active spend sources attached to the campaign.

Spend is not imported from the GA4 API by default.

Imported `Total Spend`, `Spend Breakdown`, and the `Spend Sources` modal must use the same active source-backed spend record window so the card total and source provenance cannot drift.

Budget & Financial Analysis pacing metadata, including campaign start and end dates entered from the Budget Pacing & Burn Rate card, must not filter GA4 `Total Spend`, `Spend Breakdown`, or the `Spend Sources` modal. Those platform-level spend values are source-backed and must include all active spend-source records to date.

Google Sheets spend add mode is additive. Creating a new Google Sheets spend source must not reuse or overwrite an existing source just because the same Google Sheets connection or tab is selected. Edit/refresh mode may update an existing source only when the stable spend `sourceId` is explicitly passed.

Google Sheets revenue and spend setup must keep the modal visually stable. Do not show transient placeholder text such as `Checking Google connection`, `Checking connection...`, `Checking connected Google Sheets...`, or `Loading...` while switching into the Google Sheets chooser, going Back, or changing sheet selections.

### Previous-Day Spend Records

Current UI behavior:

- the GA4 Overview does not render a separate previous-day spend card in this app version
- previous-day spend records may still exist for validation, refresh, and possible future versions

Previous-day spend is driven by materialized spend records for the relevant day.

This includes:

- daily imported spend rows
- snapshot-style records where a source does not provide daily history

Internal endpoint behavior:

- use the previous complete UTC day selected by the server-side daily endpoint
- include every active spend source that has real daily spend records for that day
- exclude ad-platform demo/test-mode sources marked with `testMode: true`
- this exclusion is limited to explicit demo/test-mode imports; real connector or CSV/Google Sheets spend remains eligible when it has a record on that date
- do not invent a latest-day value when no record exists for that date

## Derived Financial Metrics

The following are derived outputs:

- `Profit = Revenue - Spend`
- `ROAS = Revenue / Spend`
- `ROI = (Revenue - Spend) / Spend`
- `CPA = Spend / Conversions`

If spend or revenue is missing, downstream metrics may be blocked or call out missing prerequisites.

Pipeline Proxy rule:

- Pipeline Proxy is a separate Revenue subsection card when HubSpot or Salesforce `Total Revenue + Pipeline (Proxy)` is configured
- it should show the card title, amount, and a compact `Sources` action
- clicking `Sources` should open a read-only Pipeline Proxy sources modal with source provider, provider proxy amount, selected CRM stage label, and selected/contributing campaign values where available
- the Pipeline Proxy `Sources` action should count and show only provider entries with a positive proxy amount; configured providers with `$0.00` proxy should not inflate the source count
- each Pipeline Proxy source value should render on its own line as `Stage: <stage label> | <campaign value>`
- Overview should render it from the active CRM revenue source configuration and enrich it with endpoint data when available; it must not disappear solely because the separate proxy endpoint is stale
- if both HubSpot and Salesforce are active with Pipeline Proxy for the same GA4 campaign, the single Overview Pipeline Proxy card should aggregate both exact proxy totals
- when multiple CRM providers contribute, modal provenance should render as separate provider entries rather than one flattened merged sentence
- HubSpot Pipeline Proxy must use only the HubSpot wizard's saved selected campaign values and selected stage; it must not broaden to GA4 campaign filter values and must never fall back to confirmed `lastTotalRevenue`
- the Overview `Pipeline Proxy` card is display-only; users manage the underlying CRM source from `Total Revenue`, not from the proxy card itself
- it is not included in `Total Revenue`, `Profit`, `ROAS`, `ROI`, `CPA`, KPIs, Benchmarks, Ad Comparison, Insights, or Reports

Pipeline Proxy selection model:

- the campaign/crosswalk values selected in the CRM wizard define which CRM records belong to the current MimoSaaS campaign
- in revenue-only mode, Crosswalk values should represent confirmed/won revenue values only
- in `Total Revenue + Pipeline (Proxy)` mode, Crosswalk must allow selecting both confirmed/won campaign values and eligible open-stage campaign values needed for Pipeline Proxy
- the Pipeline Proxy stage is then applied as a second filter to those same selected CRM records
- confirmed/won records from the selected campaign values contribute to `Total Revenue`
- open records from the selected campaign values that are currently in the selected Pipeline Proxy stage contribute to the separate `Pipeline Proxy` card
- Pipeline Proxy is an early signal only; it must never be added into confirmed revenue or performance calculations

Example:

- if the user selects `yesop_brand_search` and `yesop_prospecting` as campaign values, those two values define the eligible CRM deal/opportunity set for this MimoSaaS campaign
- if the user then selects `Proposal/Price Quote` as the Pipeline Proxy stage, the proxy amount includes only open CRM records for `yesop_brand_search` or `yesop_prospecting` that are currently in `Proposal/Price Quote`
- closed/won CRM records for `yesop_brand_search` or `yesop_prospecting` remain part of `Total Revenue`
- open CRM records in other stages, or records for other campaign values, do not contribute to this Pipeline Proxy amount
- if `yesop_prospecting` exists only as an open `Proposal/Price Quote` record, Proxy mode must still make it selectable so the user can include it in Pipeline Proxy

## The Five `Total Revenue +` Options

Revenue source options:

1. `Shopify`
2. `HubSpot`
3. `Salesforce`
4. `Google Sheets`
5. `Upload CSV`

Visible source-picker helper text:

- `Google Sheets`: `Import revenue from a connected Google Sheets tab`
- `Upload CSV`: `Import revenue from a CSV. Requires manual re-upload to update.`

Visible source-picker status badges:

- Shopify, HubSpot, and Salesforce should show `Connected` only when the relevant live connection and/or active source state proves the source is usable for the current campaign/platform context; Salesforce may show `Reconnect required` when an active saved source exists but live OAuth is not currently durable
- Google Sheets should show `Connected` when an active Google Sheets revenue source exists for the current campaign and platform context
- Upload CSV should show `Uploaded` when an active CSV revenue source exists for the current campaign and platform context
- these badges describe saved/imported source state for the current campaign/platform context, not merely a provider-level OAuth token

When the user clicks `+` on the `Total Revenue` card:

1. the revenue-source modal opens
2. the user sees these five options
3. selecting an option starts a source-specific workflow

Important meaning:

- these are five distinct user journeys
- they are not six labels pointing to one generic "add revenue" action
- future development should preserve the source-specific flow for each option
- direct `Manual` revenue entry is no longer selectable for new source creation
- existing stored manual revenue sources must still render, continue contributing to totals, and remain editable/deletable until explicitly removed

### Revenue Workflow Meaning

- `Shopify`, `HubSpot`, and `Salesforce` are connection + attribution/mapping workflows, not simple value entry
- `Google Sheets` and `CSV` are preview + mapping + import workflows
- Crosswalk/value-selection stages should not render a redundant `Selected Campaigns label` field or disabled text input; selected count, selected rows, and review-step summaries are the supported selection indicators
- disconnecting HubSpot, Salesforce, or Shopify must only deactivate the connection that belongs to the current campaign; a supplied connection ID from another campaign must fail closed and must not affect that other campaign
- deleting a revenue source from `Total Revenue -> Sources` must first verify that the source belongs to the current campaign; normalized revenue records may be deleted only for that verified source ID
- deleting a spend source from `Total Spend -> Sources` must first verify that the source belongs to the current campaign; normalized spend records may be deleted only for that verified source ID

Production direction note:

- new direct `Manual` revenue entry has been removed from the production revenue-source picker
- the reason is data-quality and data-integrity protection: unrestricted manual revenue entry creates avoidable provenance, duplication, and audit-risk issues
- existing stored manual revenue sources are still supported for continuity until the user edits or removes them

Executive-UX note:

- these workflows are logical for enterprise users who need source provenance and campaign attribution
- however, CRM and ecommerce flows are still configuration-heavy and may feel too technical for some marketing executives without analyst support
- if this is improved later, the priority should be reducing setup friction without weakening attribution accuracy or source provenance

## Revenue Source 1: Shopify Journey

The user journey is:

1. user clicks `+` on `Total Revenue`
2. the modal opens and the user selects `Shopify`
3. if Shopify is not already authenticated, the user is taken through the Shopify connection step inside the flow using OAuth or an Admin API token
4. once connected, the Shopify revenue wizard opens
5. the user configures how Shopify order revenue should be attributed to this campaign
6. the user selects the campaign field / attribution field used to match Shopify data to this campaign
7. the user selects the matching value or values for this campaign
8. the user confirms the mapping and import settings and clicks `Import revenue`
9. the system saves a Shopify revenue source for this campaign
10. the system materializes normalized revenue records for the matched Shopify orders
11. campaign financial values are recomputed and the GA4 cards/source modal provenance refetches

Important meaning:

- Shopify is an attribution workflow
- the user is not entering a single total; they are defining how Shopify order revenue should belong to this campaign
- Shopify attribution keys include `UTM Campaign`, `UTM Source`, `UTM Medium`, `Discount code`, and `Tags`; tags are matched as exact individual Shopify order tags and are useful for no-card admin validation because Shopify order tags can be edited directly in Shopify Admin
- Shopify revenue edit mode should open on the saved `Review Settings` screen with the saved attribution key, selected Shopify values, revenue metric, and any saved campaign mappings populated
- Shopify `Review Settings` should show revenue breakdown rows as campaign/value label plus amount only; do not append order-count text such as `(1 order)` to those amount rows
- Shopify revenue edit mode should preserve the saved Shopify connection method on the first screen; token/Admin API connections should not fall back to showing OAuth when navigating back
- if an older Shopify Admin API token connection is missing persisted connection-method metadata, Shopify status should recover the method from the stored token behavior so edit mode still reopens with `Admin API token` selected
- the Admin API token field should be masked in the UI; tokens are credentials and should not be displayed as plain text while typing or pasting
- Shopify OAuth must not infer or guess its callback URL from request host, browser origin, or Render proxy headers. Shopify requires the OAuth `redirect_uri` to exactly match the callback URL whitelisted in the Shopify app. Production Shopify OAuth should resolve from `SHOPIFY_REDIRECT_URI` first because it is the exact callback URL intended to match Shopify's allowed redirection URL. If it is not configured, the app may fall back to `APP_BASE_URL`, then `RENDER_EXTERNAL_URL`, using `/api/auth/shopify/callback`, then `SHOPIFY_APP_BASE_URL`.
- `SHOPIFY_REDIRECT_URI` must be preserved exactly after whitespace trim. Do not strip or add a trailing slash because Shopify compares the complete `redirect_uri` against the app's allowed redirection URL.
- OAuth connection success does not prove Shopify Orders API access. If Shopify returns protected-customer-data 403 when reading orders, keep OAuth selected and show a protected-data approval message; do not switch users to Admin API token automatically.
- The Admin API token path is separate from Shopify OAuth. If GA4 Shopify works through `Admin API token`, that does not prove Shopify OAuth is configured correctly, because the token path posts directly to `/api/shopify/connect` and does not use a Shopify OAuth `redirect_uri`.
- both the inner Shopify `Back` button and the modal header `Back` button should move one step at a time through the Shopify flow and preserve selected Shopify values when the attribution field has not changed; if the attribution field changes, stale values and campaign mappings should be cleared before reloading the matching-value step
- Shopify order reads used for attribution values, preview, save, and auto-recalculation should follow Shopify pagination and must fail clearly rather than silently saving partial revenue when an extreme page limit is exceeded
- Shopify revenue edit saves should carry the existing revenue `sourceId` through the modal, wizard, and save route so the exact source being edited is updated instead of another active Shopify source
- Shopify scheduled refresh should use active Shopify revenue source mappings as the source of truth and pass the stable revenue `sourceId` so refresh updates the existing source instead of creating or updating the wrong Shopify source

## Revenue Source 2: HubSpot Journey

The user journey is:

1. user clicks `+` on `Total Revenue`
2. the modal opens and the user selects `HubSpot`
3. if HubSpot is not yet authenticated, the flow triggers HubSpot OAuth first
4. once authenticated, the HubSpot revenue wizard opens
5. the user chooses the HubSpot campaign property used to identify matching records
6. the user selects the matching property value or values for this campaign
7. if `Total Revenue + Pipeline (Proxy)` is selected, the user chooses the HubSpot pipeline/deal stage to apply to those selected campaign values
8. the user chooses the HubSpot revenue property
9. the user chooses the date field / lookback window used for the import
10. the final `Review Settings` step shows confirmed Total Revenue, selected deal values, any selected platform campaign mapping, and Pipeline Proxy stage/amount separately
11. the user clicks `Import revenue`
12. the system saves a HubSpot revenue source with the mapping configuration
13. the system materializes normalized revenue records for the matched HubSpot records
14. campaign financial values are recomputed and the GA4 cards/source modal provenance refetches

Important meaning:

- HubSpot is a CRM mapping workflow
- the user maps HubSpot deal revenue into this campaign rather than typing a single value
- adding a new HubSpot source should create an additional source; editing an existing HubSpot source should update only that selected source
- the HubSpot `Date field` is logically necessary in the current model because it decides which HubSpot deal date property is used when including/reporting revenue
- `Close Date` is the default for finance-style won-revenue reporting
- `Last Modified Date` is useful when the user wants revenue tied to recently updated deals
- `Created Date` is useful when the user wants revenue tied to when opportunities first entered HubSpot
- in GA4, confirmed HubSpot revenue should materialize as true daily rows by each matched deal's selected `Date field`, rather than as one synthetic snapshot row
- HubSpot date fields must be normalized before daily materialization because HubSpot may return date properties as either ISO/date strings or epoch-millisecond strings
- HubSpot confirmed-revenue refresh should resolve legacy `closedwon`-only mappings to the current HubSpot pipeline Closed Won stage IDs before materializing daily rows, so custom pipelines do not silently drop won deals during scheduled refresh
- if the user chooses `Total Revenue + Pipeline (Proxy)`, Pipeline Proxy should appear separately in Overview as an early-stage signal with its selected stage label and must not be added into Total Revenue
- if the user chooses `Total Revenue + Pipeline (Proxy)`, the confirmed/won HubSpot revenue portion still remains eligible for previous-day revenue records when it has true daily rows; only the open Pipeline Proxy amount is excluded
- the Pipeline Proxy stage filters the already selected HubSpot campaign values; it does not create a separate campaign-selection path
- HubSpot edit-mode `Review Settings` should show the saved Pipeline Proxy amount immediately while saved settings are unchanged; it should not flash an empty placeholder before live preview returns; if the effective proxy amount is known and zero in unchanged edit mode after selected deals become confirmed revenue, hide the Pipeline Proxy summary so the review reads like confirmed Total Revenue rather than showing a `$0.00` early signal
- the final `Review Settings` step should show Pipeline Proxy stage and amount; the import action should be labeled `Import revenue`
- when editing an existing HubSpot revenue source, the review action should be labeled `Update revenue` and remain disabled until the user makes a meaningful setting change
- the `Review Settings` subtitle should say `Confirm these details before saving. Revenue will be treated as revenue-to-date for this campaign.`
- the `Review Settings` details card should not repeat a second heading such as `Review HubSpot revenue settings`
- the `Review Settings` details card should keep `Selected deal(s)` directly under `Total Revenue (to date)` so the confirmed revenue and selected deals read as one continuous summary
- `Selected deal(s)` should list each selected HubSpot value on its own line with the amount that will be imported for that selected deal/value when preview data provides it
- when a selected HubSpot value is mapped to a GA4/paid-platform campaign in Crosswalk, `Review Settings` must show that mapping before save using the same `selectedCampaignMappings` state that preview/save uses; hiding this mapping is a display bug, not evidence that the mapping was lost
- in the GA4 Overview `Revenue Sources` modal, HubSpot rows should show the mapped platform campaign name under `HubSpot (Deals)` when saved `campaignMappings` provide one; if no mapping is saved, fall back to the source type label `HubSpot`
- HubSpot imported revenue should enter Campaign Breakdown only through exact saved `campaignMappings`; the recorded deployed 4.11 evidence proves one `yesop_retargeting` mapped-row delta and does not prove other rows, other campaigns, or alternate mappings
- HubSpot-backed GA4 report values should use the same source-backed financial total and exact mapped Campaign Breakdown formula; Current Commit 4.12 locally guards that report value path but deployed report evidence remains pending
- the first HubSpot `Source` step should show `Connected to: <account>` above the main double-counting warning, with `Reconnect` as the related action
- HubSpot account display should prefer the friendly HubSpot account name and must not show raw `Portal <id>` or generic `HubSpot account` text in the wizard
- the HubSpot `Review Settings` summary should not repeat the account row; account context belongs on the first `Source` step
- the HubSpot review step should label selected CRM records as `Selected deal(s)`, not generic selected values
- the HubSpot Crosswalk step should not show a manual `Refresh values` button; values load as part of the existing wizard progression
- the `Reconnect` action on the first HubSpot screen should render in a stable header/action area, not inside the main source-choice card or a shifting scroll region
- the main double-counting warning should appear on the first `Source` step so users see it before proceeding through the wizard
- HubSpot OAuth should request offline access / refresh capability so the connection can survive access-token expiry after connect or reconnect
- in GA4 `Total Revenue only` mode, the Crosswalk unique-values list should show only values backed by confirmed/Closed Won deals so users cannot select open-stage-only values that would contribute `$0` to confirmed revenue

## Revenue Source 3: Salesforce Journey

The user journey is:

1. user clicks `+` on `Total Revenue`
2. the modal opens and the user selects `Salesforce`
3. if Salesforce is not yet authenticated, the flow triggers Salesforce OAuth first
4. once authenticated, the Salesforce revenue wizard opens
5. the user chooses the Salesforce campaign/attribution field used to identify matching opportunities
6. the user selects the matching value or values for this campaign
7. if `Total Revenue + Pipeline (Proxy)` is selected, the user chooses the Salesforce Opportunity stage to apply to those selected campaign values
8. the user chooses the Salesforce revenue field
9. the user chooses the date field / lookback window used for import
10. the final `Review Settings` step shows confirmed Total Revenue separately from Pipeline Proxy stage and amount
11. the user clicks `Import revenue`
12. the system validates the mapping and currency requirements
13. the system saves a Salesforce revenue source with the mapping configuration
14. the system materializes normalized revenue records for the matched Salesforce opportunities
15. campaign financial values are recomputed and the GA4 cards/source modal provenance refetches

Important meaning:

- Salesforce is a CRM opportunity-mapping workflow
- this path is sensitive because it can include currency validation and attribution-field matching
- in edit mode, Salesforce revenue must preserve the existing revenue `sourceId` all the way through the save request so the system updates the existing source instead of creating an additive duplicate
- Salesforce review-step `Total Revenue (to date)` should prefer fresh preview data from the current edit session over stored `lastTotalRevenue` values from the previous save
- Salesforce review-step `Total Revenue (to date)` must use the preview endpoint's full matched total, not the limited sample rows shown in the preview table
- Salesforce edit mode must default missing legacy `dateField` values back to `CloseDate` so external Close Date changes materialize onto the expected previous-day revenue date
- Salesforce edit mode may enable `Update revenue` after a successful live preview only when the current Salesforce preview total differs from the saved source total, because external Salesforce value/date changes still need a safe manual re-materialization path
- Salesforce confirmed revenue uses the saved attribution values plus the selected date field and treats opportunities as won when Salesforce returns `IsWon = true` or the stage name starts with `Closed Won`, so Review Settings, save/materialization, scheduler refresh, and previous-day revenue records stay aligned for orgs with custom Closed Won stage labels
- the first Salesforce `Source` step should show `Total Revenue + Pipeline (Proxy)` above `Total Revenue only (no Pipeline card)` and default to the pipeline option in new connect mode
- if the user chooses `Total Revenue + Pipeline (Proxy)`, Pipeline Proxy should appear separately in Overview as an early-stage signal with its selected stage label and must not be added into Total Revenue
- the Pipeline Proxy stage filters the already selected Salesforce campaign/opportunity values; it does not create a separate campaign-selection path
- the final `Review Settings` step should show Pipeline Proxy stage and amount; the import action should be labeled `Import revenue`
- when editing an existing Salesforce revenue source, the review action should be labeled `Update revenue` and remain disabled until the user makes a meaningful setting change or the current Salesforce preview total differs from the saved source total
- the `Review Settings` subtitle should say `Confirm these details before saving. Revenue will be treated as revenue-to-date for this campaign.`
- the `Review Settings` details card should not repeat a second heading such as `Review Salesforce revenue settings`
- the Salesforce review step should label selected CRM records as `Selected opportunity(ies)`, not generic selected values
- `Selected opportunity(ies)` should list each selected Salesforce value on its own line with the amount that will be imported for that selected opportunity/value when preview data provides it
- the Salesforce Crosswalk step should not show a manual `Refresh values` button; values load as part of the existing wizard progression
- the main double-counting warning should appear on the first `Source` step so users see it before proceeding through the wizard
- if Salesforce is disconnected in edit mode, the review step should still show the saved Pipeline Proxy stage and saved proxy amount until live preview becomes available again
- if a saved Salesforce revenue source exists but live OAuth is down, the `Add revenue source` chooser should show `Reconnect required` rather than `Not connected`
- if Salesforce is disconnected, the wizard should still show the persisted Salesforce org/account label instead of `—`

- Salesforce status recovery should attempt refresh-token recovery before source-selection surfaces fall back to `Reconnect required`
- Salesforce callback/save behavior must reject a reconnect that returns no durable refresh token and no existing stored refresh token to preserve; the app must not silently save another short-lived connection
- if reconnect diagnostics show `scope: 'api'`, `hasReturnedRefreshToken: false`, and `hasExistingRefreshToken: false`, the root cause is the Salesforce Connected App OAuth configuration rather than later token loss in the app
- the Salesforce Connected App should include at least these selected OAuth scopes:
  - `Manage user data via APIs (api)`
  - `Perform requests at any time (refresh_token, offline_access)`
  - `Access the identity URL service (id, profile, email, address, phone)`
  - `Manage user data via Web browsers (web)`
- the Salesforce Connected App should use a durable refresh token policy, preferably `Refresh token is valid until revoked`
- for cloud-hosted environments like Render, the Salesforce Connected App IP relaxation should be permissive enough to avoid cloud IP churn breaking reconnect stability; `Relax IP restrictions` is the most stable option
- if a fragile older Salesforce revenue source was created before durable refresh-token issuance was fixed, the user should create a new Salesforce revenue source from the durable connection rather than continue relying on that older fragile source

Production validation:

- opening `Total Revenue -> Sources -> Salesforce edit` should show the saved `Total Revenue (to date)` immediately and must not flash a misleading `$0.00`
- without changing settings and without a changed live Salesforce total, `Update revenue` should remain disabled
- after a meaningful wizard setting change, or after the live Salesforce preview total differs from the saved source total, `Update revenue` should become enabled

## Revenue Source 4: Google Sheets Journey

The user journey is:

1. user clicks `+` on `Total Revenue`
2. the modal opens and the user selects `Google Sheets`
3. the user enters the Google Sheets connection chooser step
4. if no suitable sheet connection exists yet, the user connects a Google Sheet / tab first
5. once a connection is selected, the user clicks `Next` and the system loads a sheet preview
6. the `Map sheet columns` screen opens
7. the user selects the `Revenue` column from a direct dropdown
8. the user can optionally select a date column for daily revenue tracking
9. the user can optionally select a campaign identifier column and matching campaign value or values
10. the user confirms the mapping and runs the import
11. the system saves a Google Sheets revenue source with the mapping configuration
12. the system materializes normalized revenue records from the sheet rows
13. campaign financial values are recomputed and the GA4 cards/source modal provenance refetches

Important meaning:

- Google Sheets is a connected-sheet preview and mapping workflow
- the preview step is part of the source-selection journey, not a separate admin flow
- the visible mapping screen should follow the same pattern as Google Sheets spend: value-column dropdown first, optional date column second, then campaign identifier and campaign value controls
- the mapping screen title should be `Map sheet columns` in new-source mode
- if the user selects a date column, the source behaves like daily revenue history
- if the user does not select a date column, the source behaves like a revenue snapshot / revenue-to-date import
- the date column supports daily-history behavior; it does not itself create automatic daily syncing
- Google Sheets refreshability comes from the connected sheet source, while the date column controls date granularity
- if a campaign column is selected and matching values are available, at least one campaign value must be selected before import
- creating a new Google Sheets revenue source from `Total Revenue -> + -> Google Sheets` must create a new additive revenue source even if it uses the same Google Sheets connection or tab as an existing source
- edit mode and scheduler refresh are the only Google Sheets revenue paths that should update an existing source, and they must do so by stable `sourceId`
- Google Sheets revenue edit should keep `Update revenue` disabled until a meaningful edit is made
- Google Sheets revenue edit chooser should not show the outer header `Back` button; users either continue with `Next`, use `Change sheet/tab`, cancel, or close
- in Google Sheets revenue edit mode, changing the selected sheet/tab must update the existing revenue source by stable `sourceId`; it must not create a second additive Google Sheets revenue source
- in Google Sheets revenue edit mode, selecting or connecting a different sheet/tab must clear stale mapped columns, campaign search, and selected campaign values from the previous sheet before previewing the new sheet/tab
- the UI should make this daily-history vs snapshot distinction explicit so users understand the downstream effect on latest-day and trend-style views

## Revenue Source 5: CSV Journey

The user journey is:

1. user clicks `+` on `Total Revenue`
2. the modal opens and the user selects `Upload CSV`
3. the user uploads a CSV file
4. the system generates a CSV preview
5. the user selects the revenue column
6. the user can optionally select a date column for daily revenue tracking
7. the user selects the campaign column
8. the user selects one or more campaign values to keep for this campaign
9. the user confirms the mapping and runs the import
10. the system saves a CSV revenue source with the mapping configuration
11. the system materializes normalized revenue records from the kept CSV rows
12. campaign financial values are recomputed and the GA4 cards/source modal provenance refetches

Important meaning:

- CSV is a structured import workflow, not a simple file attachment
- CSV revenue is imported as a revenue-to-date source in the normal GA4 UI
- CSV revenue can materialize daily revenue records when a date column is mapped; if no date column is selected, it remains a revenue-to-date snapshot-style source
- because CSV is manual, updates require re-upload rather than automatic refresh
- CSV should be treated as a one-time or occasional import, not an auto-syncing source
- the CSV upload/re-upload helper text should list only the required primary column as `Required columns: Revenue`; optional campaign mapping is handled on the mapping screen
- the CSV revenue mapping screen should show `Revenue`, optional `Date column`, optional campaign identifier/value controls, preview table, and action buttons
- if a campaign column is selected and matching values are available, at least one campaign value must be selected before import
- the UI should make it explicit that CSV updates require manual re-upload
- CSV revenue edit should reopen directly into the mapping screen when the stored imported dataset is available
- CSV revenue edit upload/re-upload screen should not show the outer header `Back` button; users either upload and continue, cancel, or close
- if only campaign-value selection changes, CSV revenue should recalculate without forcing a re-upload
- if structural mappings change, such as revenue column, conversion value column, date column, campaign column, or value-source mode, re-upload is still required
- when a replacement CSV is selected in edit mode, stale saved prefill, campaign search, and selected campaign values from the previous CSV must be cleared before the new preview/mapping is shown
- `Update revenue` should remain disabled until a meaningful edit is made
- CSV revenue preview and process endpoints must enforce normal campaign access checks before reading, previewing, processing, updating, or materializing uploaded data
- CSV revenue process/edit must verify that any provided existing `sourceId` is an active CSV revenue source for the requested campaign and platform context before updating records
- deleting a CSV revenue source must follow the shared source-delete rule: prove campaign/source ownership first, then delete only normalized revenue records tied to that verified source ID

## Revenue Source 6: Existing Stored Manual Revenue

Current production-state rule:

- new direct `Manual` revenue creation is no longer exposed in the GA4 production revenue-source picker
- existing stored `Manual` revenue sources must still render, continue contributing to totals, and remain editable/deletable until explicitly removed

Important meaning:

- `Manual` revenue is now a continuity/edit path for previously stored sources, not a normal new-source GA4 creation journey
- existing stored `Manual` is a direct value-entry workflow
- unlike CRM and sheet-based options, it is not an attribution or import mapping process
- it behaves more like a manually maintained revenue snapshot and is best treated as a higher-friction, less automated path
- it should be treated as a temporary validation/testing path rather than a long-term production workflow

## The Five `Total Spend +` Options

Spend source options:

1. `LinkedIn Ads`
2. `Meta / Facebook`
3. `Google Ads`
4. `Google Sheets`
5. `Upload CSV`

When the user clicks `+` on the `Total Spend` card:

1. the spend-source modal opens
2. the user sees these five options
3. selecting an option starts a source-specific workflow

### Spend Workflow Meaning

- `LinkedIn Ads`, `Meta / Facebook`, and `Google Ads` are connector-based spend workflows with campaign selection inside the modal
- `Google Sheets` and `CSV` are preview + mapping + import workflows

Production direction note:

- new direct `Manual` spend entry has been removed from the production spend-source picker
- the reason is data-quality and data-integrity protection: unrestricted manual spend entry creates avoidable provenance, duplication, and audit-risk issues
- existing stored manual spend sources are still supported for continuity until the user edits or removes them

Important meaning:

- these are five distinct spend-source journeys
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
13. the GA4 cards and source modal provenance refetches

Important meaning:

- LinkedIn spend is a campaign-selection workflow, not a freeform value entry flow
- `Test mode` is intentionally available here so users can validate the full selection/import flow with mock campaigns

## Spend Source 2: Meta / Facebook Journey

The user journey is:

1. user clicks `+` on `Total Spend`
2. the modal opens and the user selects `Meta / Facebook`
3. when `VITE_ENABLE_AD_PLATFORM_TEST_MODE` is not enabled, the panel shows the real OAuth connection path
4. when `VITE_ENABLE_AD_PLATFORM_TEST_MODE=true`, the panel shows Meta test mode only and hides the real OAuth path
5. when the account is connected, the system fetches available Meta daily-metrics data and groups it by campaign
6. the user sees a campaign list with spend, impressions, and clicks
7. the user selects one or more Meta campaigns to include
8. the user clicks `Import spend`
9. the system saves a Meta/Facebook spend source with campaign-selection breakdown metadata
10. the system materializes spend records and recomputes campaign financial values
11. the GA4 cards and source modal provenance refetches

Important current-state note:

- the GA4 Overview spend modal hides Meta test mode by default; set `VITE_ENABLE_AD_PLATFORM_TEST_MODE=true` only for demos while real Meta ad-account setup is in progress
- if `VITE_ENABLE_AD_PLATFORM_TEST_MODE=true`, the modal should use Meta test mode only and should not show the real Meta OAuth path
- if an older Meta test-mode connection exists for the campaign, the modal should treat it as not connected unless `VITE_ENABLE_AD_PLATFORM_TEST_MODE=true`
- when `VITE_ENABLE_AD_PLATFORM_TEST_MODE=true`, a connected Meta account with no campaigns can be switched to test mode from the no-campaigns state for demo validation
- real Meta API errors must be surfaced to the user and must not silently fall back to generated mock campaigns in the spend flow
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
12. the GA4 cards and source modal provenance refetches

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
8. the date column is prefilled when the sheet has a date-like header such as `Date`; the user can keep it, choose another date column, or choose `None`
9. the user can optionally select a campaign identifier column and one or more campaign values
10. the user confirms the mapping and runs the import
11. the system saves a Google Sheets spend source with the mapping configuration
12. the system materializes spend records and recomputes campaign financial values
13. the GA4 cards and source modal provenance refetches

Important current-state note:

- the visible spend flow is a preview + mapping + import workflow
- Google Sheets spend can materialize daily records when a date column is mapped; if no date column is selected, it remains a spend-to-date snapshot-style source
- when the sheet preview contains a date-like header such as `Date`, the spend mapping screen should prefill the date column with that header instead of defaulting to `None`
- Google Sheets spend auto-refresh re-reads the saved sheet/tab and replaces the stored Google Sheets spend source amount from the latest matching sheet rows; it must not create a duplicate source or add the refreshed value on top of the old value
- Google Sheets spend auto-refresh must pass the existing spend source `sourceId` into the process route so refresh updates that exact source instead of running add mode
- Google Sheets spend process must fail closed when a supplied edit/refresh `sourceId` does not resolve to an active Google Sheets spend source; it must not fall back to creating a new source
- Google Sheets spend duplicate cleanup must start with the read-only duplicate inspector; do not deactivate/delete duplicate sources until the exact sheet/mapping duplicate groups and affected source IDs are proven
- confirmed duplicate cleanup may soft-deactivate only duplicate Google Sheets spend sources from exact duplicate groups, delete only records tied to those duplicate source IDs, and then recalculate campaign spend
- hard-delete cleanup may purge only inactive Google Sheets spend sources that match an active source signature and have zero remaining spend records
- if a campaign identifier and campaign values are mapped, auto-refresh includes only rows matching those selected campaign values
- the date column controls daily spend history; auto-refresh still sums all matching rows for `Total Spend`, while latest-day style views use dated records
- Google Sheets spend is eligible for scheduled auto-refresh after setup
- editing an existing Google Sheets spend source should open from the saved mapping without auto-running a live sheet preview; saved spend/date/campaign columns and selected campaign values should remain visible without reconnecting, and new/updated mappings should preserve lightweight preview metadata so full column/value choices can repopulate in edit mode
- if the user selects a campaign identifier column and matching values are available, at least one campaign value must be selected before import
- the connect substate should progress through `Connect Google Sheets`; it should not render a redundant footer `Next` button before a connected sheet/tab is actually being selected
- when no spend-purpose sheet connection is currently listed, the Google Sheets spend flow should render the auth component directly rather than showing a duplicate parent-level `Connect Google Sheets` pre-screen
- the chooser should keep `Reconnect` and `Change sheet/tab` recovery actions but should not expose an in-flow `Remove` action in this Google Sheets spend experience
- reconnect/change-sheet transitions should render the Google Sheets auth component directly so users see one smooth loading-to-selection flow instead of duplicate parent and child connection screens
- after Google Sheets auth succeeds, the UI should remain in a loading state while spreadsheets load and must not flash back to the initial `Connect Google Sheets` screen
- the spend modal should finish checking existing Google Sheets spend connections before mounting the auth component, so users do not see a temporary connect screen before the saved-sheet chooser loads
- after reconnect, spreadsheet listing should prefer the newest pending OAuth connection so stale older tokens do not block sheet selection
- users must explicitly select a Google Sheets tab before connecting; the connector should not silently use the first sheet/tab by default
- Google Sheets tab-loading failures should surface the real error to the user instead of silently turning into a misleading `No tabs found` state
- after a user connects and selects a Google Sheets tab in the spend flow, the selected tab should appear in the chooser and the user should click `Next` to load preview/mapping; the modal should not auto-advance before the user confirms the selected tab
- existing saved Google Sheets revenue tabs should expose a `Next` action so users can continue to preview/mapping when the chooser already has a selected tab
- when changing/reconnecting a Google Sheets spend tab from an existing saved-sheet chooser, `Back` should return to that chooser rather than exiting to the spend-source picker
- in Google Sheets spend edit mode, `Back` from mapping should return to the sheet/tab chooser, and `Next` should repopulate mapping from the selected sheet/tab without reusing stale values from a different connection
- in Google Sheets spend edit mode, changing the selected sheet/tab must update the existing spend source by stable `sourceId`; it must not create a second additive Google Sheets spend source
- in Google Sheets spend edit mode, selecting or connecting a different sheet/tab must clear stale mapped columns, campaign search, and selected campaign values from the previous sheet before previewing the new sheet/tab
- Google Sheets OAuth placeholder rows with `spreadsheetId='pending'` must not be returned to source choosers as selectable sheet connections
- spreadsheet-tab loading should use the same newest/pending OAuth token selection pattern as spreadsheet listing so reconnects do not list files with one token and try to load tabs with an older token
- if a saved Google Sheets spend connection's token fails during preview or import, the spend path may self-heal by verifying the same spreadsheet/tab with the newest campaign Google Sheets token and updating the saved connection tokens before asking the user to reconnect
- Google Sheets spend preview/import should surface clear `403` and `404` recovery messages without auto-deleting the connection or switching sheets

## Spend Source 5: CSV Journey

The user journey is:

1. user clicks `+` on `Total Spend`
2. the modal opens and the user selects `Upload CSV`
3. the user uploads a CSV file
4. the system generates a preview of headers and sample rows
5. the user selects the spend column
6. the user can optionally select a date column for daily spend tracking
7. the user can optionally select a campaign identifier column and one or more campaign values
8. the user confirms the mapping and runs the import
9. the system saves a CSV spend source with the mapping configuration
10. the system materializes spend records and recomputes campaign financial values
11. the GA4 cards and source modal provenance refetches

Important meaning:

- CSV spend is a structured import workflow, not a file attachment
- CSV spend can materialize daily spend records when a date column is mapped; if no date column is selected, it remains a spend-to-date snapshot-style source
- the CSV upload/re-upload helper text should list only the required primary column as `Required columns: Spend`; optional campaign mapping is handled on the mapping screen
- the CSV spend mapping screen should show `Spend` as a direct dropdown field; it should not require an `Edit columns` sub-action to change the spend column
- the CSV spend mapping screen should not show extra section headings named `Columns` or `Campaign mapping`; the visible controls are the spend dropdown, optional date-column dropdown, optional campaign identifier/value controls, preview table, and action buttons
- CSV spend does not auto-refresh on a schedule
- CSV spend preview should show all uploaded columns in the preview table, not only mapped processing columns
- CSV spend edit should expose `Back` from mapping to upload so the user can replace the CSV file before previewing again
- when a new CSV is selected in edit mode, stale preview rows, campaign search, and selected campaign values from the previous CSV must be cleared before the new preview/mapping is shown
- CSV spend edit should preserve full preview metadata for reopening the source, while processing can still store normalized spend/campaign rows for recalculation
- once a CSV spend source has been imported with the persisted edit payload, edit mode can recalculate from the stored imported dataset when the user changes only campaign-value selection
- if the user changes mapped columns, including the date column, or the original stored dataset is not available, re-upload is still required
- CSV spend preview and process endpoints must enforce normal campaign access checks before reading, previewing, processing, updating, or materializing uploaded data
- CSV spend process/edit must verify that any provided existing `sourceId` is an active CSV spend source for the requested campaign before updating records
- deleting a CSV spend source must follow the shared source-delete rule: prove campaign/source ownership first, then delete only normalized spend records tied to that verified source ID

## Spend Source 6: Existing Stored Manual Spend

Current production-state rule:

- new direct `Manual` spend creation is no longer exposed in the GA4 production spend-source picker
- existing stored `Manual` spend sources must still render, continue contributing to totals, and remain editable/deletable until explicitly removed

Important meaning:

- `Manual` spend is now a continuity/edit path for previously stored sources, not a normal new-source GA4 creation journey
- existing stored `Manual` is a direct spend-entry workflow
- it behaves like a manually maintained snapshot, not a refreshable connector
- it should be treated as a temporary validation/testing path rather than a long-term production workflow

## Source Modal From The Cards

The `Sources` action under `Total Revenue` and `Total Spend` opens the provenance and audit entries.

These entries show which sources contribute to the totals.

Important meaning:

- edit/delete actions operate on source definitions and their records
- they do not directly edit the total card value
- executive-facing provenance should be consolidated in a source modal / `Sources used` areas rather than repeated as per-card microcopy under every financial card
- revenue provenance should enumerate the full active revenue source set, including GA4 native revenue when present, instead of only the first imported/manual revenue source
- revenue provenance should keep active source definitions visible even when another source has breakdown rows and the active source currently contributes `$0.00`
- revenue provenance and Total Revenue must stay additive: adding a new source should increase Total Revenue by that source's persisted records rather than replacing another source with the same connection metadata
- the Revenue Sources and Spend Sources modal bodies should scroll vertically when many source entries are present so edit/delete actions remain accessible inside the dialog

## Edit And Delete Pattern

The required pattern is:

1. user edits or deletes a source from the source modal
2. the source definition and/or materialized records are updated
3. campaign financial values are recomputed
4. the cards and source modal provenance repopulate from the new state

### Edit Meaning By Source Type

- connector-based revenue or spend sources should reopen their source-specific flow rather than exposing a raw total-field edit
- `Google Sheets` edit should reopen the connection/mapping flow for that sheet source
- `Google Sheets` spend edit should keep `Update spend` disabled until the user makes a meaningful change
- `Google Sheets` spend edit should allow recalculation when the user changes selected campaign values, mapped columns, or the selected sheet connection
- `Google Sheets` spend edit must pass stable source identity through the save path so changing sheet/tab updates the existing source instead of creating a duplicate
- `LinkedIn Ads`, `Meta / Facebook`, and `Google Ads` spend edit should label the action `Update spend` and keep it disabled until the selected platform campaign set changes
- `CSV` spend edit should reopen the mapping flow
- `CSV` spend edit should allow `Back` to the upload step and should clear stale preview/selection state when a replacement CSV is chosen
- if only campaign-value selection changes and the stored import dataset is available, `Update spend` should recalculate without forcing a re-upload
- if mapped columns change or the original stored dataset is unavailable, `CSV` spend edit should require re-upload
- `CSV` spend edit should keep `Update spend` disabled until the user makes a meaningful change
- `Salesforce` revenue edit must update the existing revenue source and replace that source's materialized records rather than creating a second additive source row
- for connector edit flows that can change underlying connection identifiers, stable source identity is required: the existing `sourceId` must survive modal -> wizard -> save payload -> save route
- review-step totals in CRM edit flows should refresh from the current preview inputs and should not let stale saved totals override fresh preview totals
- Salesforce confirmed campaign-level provenance depends on `mappingConfig.campaignValueRevenueTotals`; Pipeline Proxy refresh/persistence must preserve that confirmed field and must not replace it with `pipelineValueRevenueTotals`
- Salesforce confirmed campaign-level provenance is built from exact confirmed Opportunity records and requires the save/materialization query to select the attribution field as well as filter by it
- Salesforce Review Settings preview should use the same selected date field as save/materialization so the displayed Total Revenue (to date) matches the source rows that will be persisted
- if an Ad Comparison or Overview provenance entry is missing, trace the field `campaignValueRevenueTotals` from CRM save -> persisted revenue source -> `/revenue-sources` response -> frontend merge -> table render before changing UI
- `Manual` edit should overwrite the saved snapshot amount and then recompute downstream values
- existing stored `Manual` spend edit should label the action `Update spend` and keep it disabled until the amount changes

### Campaign Filter Meaning For CSV And Google Sheets

- if the user selects a campaign identifier column and one or more campaign values, only matching rows should contribute to this campaign
- if a campaign identifier column is selected and matching values are available, import should be blocked until at least one campaign value is chosen
- if the user does not apply that filter, the imported source is treated as wholly belonging to this campaign

### Import Endpoint Security Template

- every source-import preview endpoint must verify that the signed-in user can access the target campaign before returning headers, sample rows, campaign values, or source metadata
- every source-import process/save endpoint must verify that same campaign access before creating or updating source definitions and before materializing revenue or spend records
- this applies to CSV, Google Sheets, and future connector-style import previews such as LinkedIn, Meta, Google Ads, or other integrations that use the GA4 source pattern as a template
- access checks are required even when the endpoint only previews uploaded data, because preview output can expose campaign-scoped source configuration and can lead into source mutation
- Custom Integration UI connect/read/upload/transfer routes follow the same rule: verify campaign access before reading source state or mutating integration/metric rows; public token/email inbound routes must derive campaign identity from the persisted integration token/email instead of trusting a posted campaign id

### Refreshable Vs Snapshot Behavior

- `Shopify`
  - updated immediately on save/edit
  - updated again on scheduled auto-refresh
  - materializes daily order-date revenue rows
- `HubSpot`
  - updated immediately on save/edit
  - updated again on scheduled auto-refresh
  - in GA4 `Total Revenue only`, materializes true daily rows by the selected HubSpot date field, typically `Close Date`
- `Salesforce`
  - updated immediately on save/edit
  - updated again on scheduled auto-refresh
  - materializes true daily won rows by the selected Salesforce date field, typically `CloseDate`
- `Google Sheets`
  - updated immediately on save/edit
  - updated again on scheduled auto-refresh
  - materializes daily rows only when a real date column is mapped; otherwise it stays a snapshot-style source
- `Upload CSV`
  - updated immediately on import/edit
  - no scheduled auto-refresh
  - materializes daily rows only when a real date column is mapped; otherwise it stays a snapshot-style source
- existing stored `Manual` revenue
  - no new production creation path
  - only changes when the user edits or deletes that legacy source

- `HubSpot`, `Salesforce`, `Shopify`, and eligible `Google Sheets` revenue sources are refreshable connector-style sources
- saved `HubSpot` and `Salesforce` revenue mappings are eligible for scheduled auto-reprocess through the internal auto-refresh path, while public save-mapping routes must remain protected by normal user/campaign access checks
- `Google Sheets` spend is a refreshable source after setup
- `LinkedIn Ads` spend is connector-based and refreshable through the platform refresh pipeline
- `Meta / Facebook` and `Google Ads` spend currently use connected-platform selection flows, but their current persisted spend handling is still more snapshot-like than a fully specialized connector pipeline
- scheduled Meta / Facebook and Google Ads spend refresh must reuse the saved selected campaign IDs and replace the source's prior materialized spend records rather than append duplicates
- `Upload CSV` revenue is manual for import cadence and requires re-upload for source-file updates; when a date column is mapped, it can still materialize daily revenue rows
- `Upload CSV` spend is manual for import cadence; when a date column is mapped, it can still materialize daily spend rows, and spend-source edit can recalculate from the stored imported dataset when only campaign-value selection changes
- existing stored `Manual` revenue/spend remains a manual snapshot source and requires direct manual updates
- new direct `Manual` source creation is no longer available from the production pickers

### Financial Source-Of-Truth Hierarchy

1. the user completes a source-specific add or edit flow
2. the system saves or updates the source definition and mapping configuration
3. the system materializes normalized revenue or spend records from that source
4. campaign financial totals are recomputed from those records and any applicable native GA4 revenue
5. the GA4 Overview cards and financial source modal provenance refetch from the recomputed state

Important meaning:

- the cards themselves are never the source of truth
- source definitions and normalized records are the source of truth

## Critical Computation Rules

- the card is never the source of truth
- source definitions plus normalized records are the source of truth
- recomputation must happen after add, edit, delete, and eligible auto-refresh operations
- downstream KPI, benchmark, ad comparison, insights, and report values must use the recomputed financial state; revenue-availability gates must follow the same selected GA4 financial source as `Total Revenue`, not a separate Summary-card revenue fallback
- source-preview, save, scheduler, materialization, API, and card reads must preserve the same critical source fields before a financial number is trusted
- for revenue, spend, scheduler, source-preview, or source-provenance fixes, apply the analytics source checklist in `GA4_DEVELOPMENT_WORKFLOW.md` before editing code

## Current-State Note

The current implementation is intentionally hybrid:

- GA4 native revenue can coexist with imported revenue
- spend is always explicit and source-backed
- manual and CSV flows behave more like snapshot inputs than auto-refreshing connectors
- some users may have no GA4-native revenue and rely entirely on imported external revenue sources

Planned production direction:

- `Manual` has now been removed from new production revenue and spend source selection
- `CSV` remains as the structured manual import path, while existing stored manual sources continue working until removed

Future work must preserve financial provenance and recomputation accuracy.
