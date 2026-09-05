# GA4 Overview

## Purpose

This file defines the GA4 `Overview` tab and the GA4-specific scope rules that feed the rest of the GA4 experience.

<!-- ga4-overview-current-status -->
<!-- ga4-overview-certification-status: PRODUCTION_READY -->

Production-readiness status lives in `GA4/OVERVIEW_PRODUCTION_READINESS.md`. Overview is **PRODUCTION_READY** for certified runtime boundary `dc20c1e1c0a78c03a8f9c8d53af30b94c1a70cc1`. Review from `4be16c54` found no change to Overview values, formulas, cards, sources, aggregates, or renderers; shared runtime changes are limited to Notifications and post-refresh alert checks. Historical authenticated Summary/financial/source parity carries only through those unchanged paths. Exact-current production health and manual scheduler recomputation passed. No new browser-automation, natural-timer, or global all-campaign scheduler-health claim is made.

<!-- /ga4-overview-current-status -->

Commit 2 deployment record: commit `5cff21ad` was pushed to `main` and deployed on `2026-07-16`. The user-confirmed bounded UI smoke check passed for one configured campaign/window: the four visible configured-window labels agreed, the Users provenance tooltip was correct, Revenue & Financial was labeled campaign-to-date, and the downloaded Overview report matched the observed screen values. This does not prove all 30/60/90 live provider variants or close later Overview blockers.

Commit 3 deployment record: `7b162083` plus banner follow-up `a0b205b5` deployed, and the user-confirmed one-refresh validation passed with the incorrect page-wide banner gone. The bounded Commit 3 packet is closed; synthetic failure injection and a valid-zero production fixture remain unobserved.

Commit 4 completion record: commit `7c54da65` deployed; GA4 spend reads are scoped to explicit `ga4` plus legacy null-context sources, valid zero materialized spend no longer falls through to `campaign.spend`, and GA4 reports/jobs/aggregates use the same boundary. Local tests, TypeScript, and production build passed. On `2026-07-30`, the user confirmed Total Spend agreed with the Spend Sources list and remained correct after refresh. Foreign-context and active-source-with-zero-record production fixtures remain unproven.

Commit 8 follow-up: read-only production evidence showed that the selected `ga4_mock` scope successfully rewrote 19 provider-returned daily rows on `2026-07-30`, while the latest returned activity date remained `2026-07-12`. The freshness contract had incorrectly treated that latest activity date as the provider coverage boundary, even though GA4 can omit dates with no returned activity. The follow-up keeps all returned metrics unchanged, creates no zero rows, reports the successful check-through date separately, and leaves an actual failed provider attempt stale. The remaining generic `403` classifier in the daily time-series service was also removed; permission failures and post-refresh provider failures remain operational errors rather than reconnect requests. Commit `950c5091` deployed, and the user confirmed `Checked through 2026-07-29; latest activity 2026-07-12` with no false delayed warning.

Commit 8 UI-stability follow-up: the campaign header rendered before the separate `/ga4-daily` request completed, then conditionally inserted the normal freshness summary and increased the card height. The same status already exists in Connection Details. Commit `c26d2768` removes only that duplicate success summary from the header; the live query, coverage contract, Connection Details, and stale/failure warning remain unchanged. After deployment, the user confirmed the header remained stable and the late text did not appear. This bounded UI-stability follow-up is closed.

Historical Commit 8 read-only evidence on `2026-07-30`: the validated account had no suitable live 90-day fixture. Its three active, primary, non-empty 90-day connections used property `yesop`, which the application explicitly treats as simulated; `Summer splash` was a separate empty-Property-ID placeholder and correctly failed closed. `/health/scheduler` showed that process scheduled for `2026-07-31T03:00:00.000Z`, but `totalScheduledRuns` was `0`. No provider, token-refresh, scheduler-run, reconnect, campaign, connection, or stored-data mutation was triggered. At that date live 90-day and timer-fired evidence were unproven; 60/90-day variants remain excluded, while the later certified 30-day timer evidence is recorded below.

Current Commit 9 read-only inventory on `2026-07-30` covered all 10 owner campaigns with active GA4 connections, 73 revenue sources, and 93 spend sources. It found zero revenue orphans, zero campaign/source mismatches, zero exact duplicate candidates, zero active sources without records, and zero unexpected active platform contexts. It found four orphan spend groups containing 325,478 rows: LinkedIn and Meta scheduler rows for `myGA4` and `Summer splash`. Root cause: those schedulers already saved canonical platform daily metrics, then redundantly appended the same windows to generic `spend_records` using pseudo source IDs with no matching `spend_sources` row. Repeated scheduler runs therefore created new orphans. Commit `57036ebc` deployed the forward-only fix, which removes those four redundant scheduler write blocks while preserving canonical LinkedIn/Meta metrics, campaign scope, provider refresh, and current visible totals. The immediate post-deploy read-only inventory at `2026-07-30T16:35:49.623Z` found the same four groups and 325,538 rows as the final pre-deploy density check, proving no immediate growth. The first four-hour scheduled-cycle result remains unproven. No production rows, sources, connections, or cached campaign values were changed.

Current Commit 10 closed status on `2026-07-30`: commit `ec265895` deployed the downstream scheduled/manual Campaign DeepDive aggregate change that reuses the shared ordered GA4 campaign-to-date financial selection, scopes persisted revenue/spend and Trend financial rows to GA4, preserves valid zero/negative revenue for ROAS/ROI, and writes `performance_summary_aggregate_v2` compatibility snapshots. On existing campaign `GA4 single` / `ga4_mock`, Performance Summary Total Spend matched GA4 Overview Total Spend and Budget & Financial Analysis → ROI & ROAS Total Revenue matched GA4 Overview Total Revenue. The statement from that packet that Performance Summary had no Total Revenue card is historical; the current Performance Summary renders Total Revenue in Key Outcomes and Recent Movement. This closes the bounded Commit 10 code/browser packet only; scheduled artifacts, historical Trend, live multi-source, and valid-zero/negative production fixtures remain unproven.

Historical queue status on `2026-08-01`: Commit 16's bounded deployed 30-day saved-window correction was closed while OAuth durability was still unproven. Commit 17 deployed as `36676deb`, and the user confirmed existing Total Revenue, Total Spend, and source lists were unchanged; its bounded forward implementation and retained-source disposition were closed, with rollback behavior regression-covered and no unsafe production failure injection required. Commit 18's fail-closed downstream implementation and deterministic downstream packet were closed. Its corrective scheduler-backed Summary deployed as `e857c15d`; on existing campaign `GA4 single` / `ga4_mock`, the rendered 30-day Summary and exact `/ga4-daily` response both returned 866 Sessions, 867 daily-summed Users, 110 Conversions, 68.4% Engagement Rate, and 12.7% Conversion Rate with `refreshIsStale: false`. Timer-fired and durability evidence were pending at that date and were later closed for the exact certified boundary.

Historical Commit 19 closure: runtime `ba2e4329` deployed. Both GA4 setup surfaces expose only 30 days; both persistence APIs reject new missing/60/90-day configuration before provider or storage mutation; and retained non-30 connections fail closed without record mutation. The user confirmed `Last 30 completed days` and normally loaded metrics on existing `GA4 single` / `ga4_mock`; the bounded packet closed. Unsupported-write rejection is automated/code-path proven and was not production-injected. The user approved keeping all four visible retained Spend sources. The post-publish Google Sheets reconnect and one no-click mapped-value update were user-confirmed on `2026-08-01`. The timer-fired and OAuth gates that remained open at this point were later closed for the exact certified boundary.

Final non-scheduler read-only run on `2026-08-01`: 19 files / 190 non-mutating local tests and deployed public health passed. The authenticated guarded inventory returned zero generic damage findings. The four active retained Spend sources with eight records contribute $2,698.75, match the deployed modal exactly, and were explicitly approved to remain. `retainedSourceInventoryPass=false` records their presence, not damage. The original read-only packet called no provider, refresh, scheduler-trigger, report-write/send, cleanup, or other mutation-capable path. The later user-controlled post-publish Google Sheets reconnect and observed no-click mapped-value update close the stale connection blocker without authorizing cleanup. The final non-scheduler reconciliation passes.

Final scoped certification on `2026-08-10`: the deployed runtime returned native GA4 revenue `$52,532.70 USD`, five materialized imported sources totaling `$16,799.99 USD`, and Total Revenue `$69,332.69 USD`. A normal timer fired at `08:00 UTC`; the certified property updated at `08:00:21.147`, retained 21 unique stored dates through `2026-08-09`, and had zero duplicate dates. The same three HubSpot IDs remained `$5,100`, `$7,000`, and `$4,000`, Shopify remained `$99.99`, and CSV remained `$600`. The process-wide scheduler failed 17 obsolete campaigns outside this certification; no global scheduler-health claim is made.

## Overview Structure

The platform-level GA4 `Overview` tab contains:

- Summary cards
  - `Sessions`
  - `Users`
  - `Conversions`
  - `Engagement Rate`
  - `Conv. Rate`
- Revenue & Financial section
  - `Revenue`
    - `Total Revenue`
    - `Pipeline Proxy` when configured
  - `Spend`
    - `Total Spend`
  - `Performance`
    - `Profit`
    - `ROAS`
    - `ROI`
    - `CPA`
- Tables
  - `Campaign Breakdown`
  - `Landing Pages`
  - `Conversion Events`

## How Cards Are Populated

The GA4 `Overview` cards are computed outputs from query-backed data paths.

They are not hard-coded values and they are not manually maintained UI state.

Important clarification:

- during property setup, the system stores the GA4 property, campaign selection/filter, and the 30-day historical-import depth
- Summary starts with those 30 completed historical days and appends later completed-day facts; it must not discard the oldest imported day merely because the calendar advances
- the cards remain computed from current persisted facts for that fixed import boundary through the latest completed day; they are not frozen UI values
- the GA4 daily scheduler persists completed-day daily facts, but it is not the only Overview fetch path
- `Landing Pages` and `Conversion Events` are row-level live GA4 Data API views for the selected property, saved campaign scope, and selected Overview date range; they are not populated by allocating persisted daily totals into rows
- for live GA4 properties, current tagged traffic may appear in `pageLocation` URLs before GA4 campaign attribution dimensions populate; the Overview query path may therefore use `pageLocation` `utm_campaign` as a fallback only when the primary campaign-dimension scoped result is empty
- for Measurement Protocol or freshly tagged traffic, GA4 can expose selected-campaign traffic through `pageLocation` `utm_campaign` while exposing conversions and native revenue through `campaignName`; the Overview import path may supplement only missing `Conversions` and GA4-native `Revenue` from a compatible `campaignName` conversion/revenue query without changing the traffic totals
- new live GA4 events appear in Overview only after GA4 has processed them and the page query refetches; page load/window focus can refetch immediately, and the to-date/breakdown queries also refetch periodically while the page is open

## Source-Of-Truth Hierarchy

The GA4 Overview should be understood through this hierarchy:

1. campaign creation stores GA4 scope and campaign configuration
2. GA4 queries fetch current base metrics for that saved scope
3. revenue and spend sources contribute normalized campaign records where applicable
4. Overview cards are recomputed outputs from those fetched and normalized inputs

Important meaning:

- setup stores scope, not frozen metric values
- queries and normalized records are the real inputs
- the cards are the presentation layer for those recomputed results
- GA4 Data API values can change after already-sent events are processed by Google; the app should display the latest refetched values rather than treating the first observed value as final
- a successful daily provider query can cover the completed-day window even when the latest returned activity row is older; Connection Details labels the check-through date and latest activity date separately without materializing absent dates as zero-valued metrics
- Overview current/to-date values may update before `Insights -> Trends`, because Trends waits for persisted completed-day daily rows while Overview can use current to-date and breakdown query results

## Fetched Vs Derived Values

The clearest way to understand the Overview cards is:

- some cards are base fetched values from GA4-backed queries
- some cards are derived from those fetched values
- some financial cards combine GA4-fetched values with imported campaign revenue/spend records

### Base Fetched GA4-Backed Values

These are the primary fetched values that come from the campaign's saved GA4 scope:

- `Sessions`
- `Users`
- `Conversions`
- `Engagement Rate`
- GA4-native revenue when available

These values are fetched from the current GA4 query paths, not stored as fixed values at campaign-creation time.

Important clarification:

- `Conversions` on the GA4 Overview is the GA4 conversion total for this campaign's saved GA4 scope
- it is not sourced from imported CRM/ecommerce/manual conversion systems on this page
- derived metrics like `CPA` depend on this GA4-scoped conversion total unless the implementation is explicitly redesigned

### Derived Overview Values

These cards are derived from fetched or recomputed inputs:

- `Conv. Rate = Conversions / Sessions`
- `Profit = Revenue - Spend`
- `ROAS = Revenue / Spend`
- `ROI = (Revenue - Spend) / Spend`
- `CPA = Spend / Conversions`

Previous-day revenue and spend cards are intentionally not rendered in this app version.
Daily records and endpoints may still exist for source validation, refresh, and possible future versions, but the GA4 Overview UI exposes only to-date financial totals plus derived performance metrics.

### Summary Cards

- `Sessions`
  Populated from the selected connection's persisted GA4 daily facts beginning at the saved historical-import boundary and continuing through the latest completed reporting day. A later zero-activity day does not remove an older imported day.
- `Users`
  Populated from the same fixed-boundary cumulative Summary source as Sessions.
- `Conversions`
  Populated from the same fixed-boundary cumulative Summary source as Sessions.
- `Engagement Rate`
  Computed from engaged sessions and sessions in the same fixed-boundary cumulative source selected for the other Summary cards; valid zero remains zero.
- `Conv. Rate`
  Computed from campaign-scoped `Conversions / Sessions`.

Important meaning:

- these are GA4-native campaign metrics
- they are scoped to the GA4 property and GA4 campaign filter selected for this app campaign
- they are not populated from imported revenue or spend sources
- Summary cards use persisted daily facts for the exact selected property and saved campaign filter from the initial import boundary through the latest completed day; they do not switch to Campaign Breakdown or a rolling 30-day slice
- rolling repair/history queries used by KPI and Trend consumers remain separate from the cumulative Overview Summary boundary
- campaign-to-date totals are not a Summary fallback because they are a different window
- selected-campaign daily facts may combine `pageLocation` UTM traffic with `campaignName` conversion/revenue supplementation only for missing conversion/revenue fields; sessions, users, pageviews, and engagement remain from the traffic query
- when `pageLocation` UTM fallback is needed, the daily pipeline retains traffic metrics and supplements only missing conversion/revenue fields for the exact compatible date
- on initial page load or browser refresh, Summary card values show a stable skeleton until the scheduler-backed `/ga4-daily` response is available; Campaign Breakdown loading cannot replace or change Summary values

Important `Users` rule:

- the top `Users` card follows the same persisted daily property/campaign/window rows as the other Summary cards
- `Users` is the sum of GA4 daily `totalUsers` values in the selected completed-day window; it is not a cross-day deduplicated user count
- the top `Users` card may show a short clarification tooltip:
  `GA4 daily users summed for the selected completed-day window; the same user may appear on more than one day.`

### Financial Cards

Financial-card detail lives in `GA4/FINANCIAL_SOURCES.md`.

Visible layout:

- `Revenue` contains `Total Revenue` and `Pipeline Proxy`
- `Spend` contains `Total Spend`
- `Performance` contains `ROAS`, `ROI`, and `CPA` cards; `Profit` appears when both revenue and spend are available
- unavailable performance values render as `—` instead of hiding the card
- `Revenue` and `Spend` render side by side on desktop-width Overview screens and stack on narrower screens

High-level rule:

- `Total Revenue` is additive:
  `Total Revenue = selected scoped GA4-native financial revenue + active GA4-context source-backed imported campaign revenue`
- the shared Overview/Insights native GA4 request uses the campaign currency before native revenue is added to campaign-currency imported sources
- every campaign-to-date native GA4 financial request must verify that the response metadata currency equals the requested campaign currency; missing or mismatched currency fails closed
- every enabled imported revenue source and materialized record must match campaign currency before its amount is combined; no currency conversion or historical relabeling is performed
- imported totals and source rows use materialized-record presence rather than amount truthiness, so an authoritative `$0` remains valid
- an active imported source with no materialized aggregate renders that source as `Unavailable`; other source amounts remain visible, but `Total Revenue` fails closed instead of treating the missing source as `$0`
- persisted daily and configured-lookback breakdown revenue have no historical currency provenance, so they remain native-only continuity fallbacks and must not be combined with imported revenue when the verified campaign-to-date provider value is unavailable
- scheduled reports, downstream campaign totals, KPI current values, and alert decisions apply the same rule; this does not convert currency or rewrite historical records
- the `Total Revenue` Revenue Sources modal should show HubSpot and Shopify mapped platform campaign names from saved `campaignMappings` when available, not only generic source type labels
- the `Add revenue source` chooser is v1-scoped: Salesforce revenue is hidden for v1, while retained Salesforce docs/code paths are not current GA4 v1 certification scope
- Campaign Breakdown row revenue must add imported HubSpot revenue only to rows matched by saved CRM-to-platform `campaignMappings`; the currently recorded HubSpot deployed evidence is limited to the Current Commit 4.11 `yesop_retargeting` mapped-row packet
- GA4 report output must use the same HubSpot imported revenue and exact mapping rules as Overview; Current Commit 4.12 records local/read-only validation plus deployed evidence for the configured `GA4 Overview Report` packet only
- GA4 KPI/Benchmark financial values must use the same HubSpot imported revenue and selected GA4 native financial source included in Overview `Total Revenue`, with Pipeline Proxy excluded. The three exact enabled HubSpot source IDs are clean-certified inside the recorded Overview boundary; `GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md` is canonical and H10d is historical only.
- Shopify imported revenue follows the same GA4 source-backed financial model. The exact enabled Shopify source is clean-certified inside the recorded Overview boundary; use `GA4/OVERVIEW_REVENUE_SHOPIFY_PRODUCTION_READINESS.md` as the controlling source. Dormant OAuth, non-GA4 sources, and future stores remain excluded.
- GA4-native financial revenue and CPA conversions use the first complete source in this fixed order: campaign-to-date provider totals, campaign-to-date persisted daily totals, then the configured-lookback breakdown only when both earlier sources are absent; values are never selected by maximum revenue
- valid zero and negative campaign-to-date native values remain authoritative; a provider response without both revenue and conversions is treated as empty and falls through to the next complete candidate
- `Pipeline Proxy`, when configured from HubSpot or Salesforce, is a separate early-signal card and is not included in `Total Revenue`
- Current Commit 6 makes Salesforce Pipeline Proxy context mandatory. GA4 passes `platformContext=ga4`; the server searches only that context and returns unavailable when no exact scoped Salesforce source matches instead of falling back across platforms
- spend cards come only from explicit spend sources attached to the campaign
- GA4 itself does not provide spend for this page's spend cards
- Historical Commit 5 (`5da5f41c`) temporarily narrowed the GA4 new-source Spend chooser. Current Commit 21 restored the existing Google Sheets Revenue and Spend chooser paths and deployed them while preserving the established scoped/atomic workflows; future source instances require their own validation
- new GA4 CSV Spend requires a Date column in both UI and API; already-undated saved sources remain continuity-only and are not certified
- the earlier Current Commit 5 two-option chooser evidence is historical; at certified runtime boundary `b8c73621`, the Spend chooser includes Google Ads, Google Sheets, and Upload CSV, while Google Ads remains excluded from this Overview certification
- active Google Sheets spend sources must be repulled automatically after mapped sheet values change; the default near-real-time target is a provider pull within 1 minute, and the open Overview spend queries refetch persisted values within 15 additional seconds
- this Google Sheets spend contract is bounded polling rather than an instantaneous provider push; failed pulls must retain the last successful stored spend instead of clearing or replacing it with guessed values
- Google Sheets is available in both GA4 financial-source choosers; new Revenue and Spend requests use the existing campaign-scoped, platform-scoped mapping and atomic source/record replacement paths. The chooser path is deployed. Google Sheets Revenue is not independently generalized beyond configured/validated sources, while observed OAuth durability for the certified GA4 connection passed on `2026-08-10`
- the read-only Overview source-damage inventory separately reports retained/null-context sources for exact production review; its initial owner-scoped production run found nine sources, and the `Summer splash` `$400` unwanted Manual Spend source was subsequently deleted exactly; the post-delete run found eight retained sources and only the unchanged `$14,045.83` Google Ads source for `Summer splash`
- after a GA4 Spend source is added, edited, or deleted, the page invalidates the same KPI, Benchmark, Reports, and Notifications caches as a Revenue source mutation so mounted downstream consumers do not retain pre-mutation values
- GA4 Manual Revenue and Manual Spend creation/editing are blocked in UI and API; exact campaign-scoped deletion remains available only for reviewed legacy cleanup
- an active OAuth placeholder with an empty GA4 Property ID is setup state, not a usable GA4 analytics connection; it must never leave Overview in a permanent loading skeleton
- when no usable GA4 property exists but saved financial sources do, Overview fails GA4 metrics and tables closed as unavailable, hides new-source controls, and keeps only the existing campaign-scoped source review/removal path reachable
- retained GA4 Google Sheets, Salesforce, and LinkedIn/ad-platform source replacements update source metadata and materialized records transactionally; failed replacement preserves the prior committed source state, and ambiguous duplicate LinkedIn Spend refresh fails closed
- profit and efficiency metrics are derived outputs, not manually stored totals

Pipeline Proxy rule:

- Pipeline Proxy appears in the Revenue & Financial area; before a HubSpot or Salesforce `Total Revenue + Pipeline (Proxy)` source is configured, the card shows `Not configured`
- the render condition is the active CRM revenue source configuration, not only the separate pipeline proxy endpoint response
- when the endpoint returns a fresh same-scope value, the card uses it; if that endpoint is stale or unavailable, only the already-selected same-scope active source may supply saved Pipeline Proxy metadata, while a scope mismatch fails closed as unavailable
- if both Salesforce and HubSpot have active Pipeline Proxy configuration for the same GA4 campaign, the card should aggregate their exact proxy totals into one card total
- the card should show a compact `Sources` action; provider-specific provenance belongs in a read-only Pipeline Proxy sources modal rather than inline card microcopy
- the `Sources` count should include only providers with positive Pipeline Proxy contribution; zero-value configured CRM providers should not show as contributing sources
- CRM source edit/review displays should suppress a zero-value Pipeline Proxy summary when the unchanged source now has confirmed revenue and the effective proxy amount is known to be zero; this is display-only and must not remove the saved source configuration
- the card is display-only; users manage the underlying CRM revenue source from `Total Revenue`, not from the `Pipeline Proxy` card
- each provider entry in the read-only sources modal should render:
  - provider name
  - provider proxy amount
  - selected/contributing campaign value or values, one per line with `Stage: <stage label> | <campaign value>` formatting
  - that provider's selected pipeline stage label
- if the CRM connection is currently disconnected but the saved source is still active, the card and review/edit flows may fall back to saved proxy metadata and saved proxy amount until live preview data is available again
- the card should not show explanatory stage microcopy such as `Contract Sent open-stage signal`
- it is not confirmed revenue
- it must not feed `Profit`, `ROAS`, `ROI`, `CPA`, KPIs, Benchmarks, Ad Comparison, Insights, or Reports unless a future product change explicitly redefines that metric
- deleting or deactivating the associated HubSpot/Salesforce revenue source must remove the Pipeline Proxy card from Overview

Insights alignment rule:

- `Insights -> Executive Financials -> Revenue` uses the same all-source `financialRevenue` model as Overview
- imported revenue updates should therefore appear consistently in Overview and Insights Executive Financials; Insights Data Summary is intentionally limited to recent GA4 traffic and channel metrics

CRM Pipeline Proxy example:

- if the CRM wizard selected campaign values `yesop_brand_search` and `yesop_prospecting`, the Pipeline Proxy card is scoped to those same selected values
- if the selected stage is `Proposal/Price Quote`, the card amount is the open CRM pipeline amount for those selected campaign values in that stage
- Total Revenue remains confirmed/won revenue only and must not include the Pipeline Proxy amount

Reference note:

- use `GA4/OVERVIEW.md` for tab-level meaning and visible card behavior
- use `GA4/FINANCIAL_SOURCES.md` for revenue/spend source workflows, provenance, and recomputation rules

## GA4 Scope Rule

The GA4 page is scoped to:

- the selected GA4 property
- the GA4 campaign selection/filter configured for this app campaign
- the campaign's date scope

Important meaning:

- it is campaign-scoped within the selected GA4 property
- it is not a client-wide rollup across unrelated campaigns
- the GA4 analytics page does not currently let users add or remove GA4 campaign values after setup; changing GA4 scope after setup would require a deliberate rescope workflow that refreshes Overview inputs and recomputes downstream KPI, Benchmark, Insight, alert, and report state
- `Total Revenue` and `Total Spend` show compact totals in the cards; their `Sources` action opens the source-provenance modal where users can review, edit, or delete contributing sources
- the source-provenance modal is presentation-only and must not change financial calculations, source persistence, or recomputation behavior
- the revenue and spend source-provenance modals should scroll vertically when many entries are present

### GA4 Scope Selection Lifecycle

Current production behavior:

- users select the GA4 property and GA4 campaign values during campaign creation or GA4 connection setup
- the saved `ga4CampaignFilter` defines the GA4 scope for the campaign
- the GA4 analytics page shows the saved client, campaign, GA4 property ID, and selected campaign values for provenance
- the stable campaign provenance header does not insert a late success/freshness line; normal check-through/latest-activity detail lives in Connection Details, while an actual stale/provider failure remains an explicit Overview warning
- a non-stale daily boundary means a successful provider check covered the expected completed-day boundary or stored activity reached it, not that GA4 has finished delayed event processing; no absent date is materialized as a fake zero row
- the GA4 analytics page does not expose a post-setup campaign picker
- the setup picker should discover selectable UTM campaign values after property selection from GA4 campaign dimensions, manual UTM dimensions, and finally `pageLocation` URLs containing `utm_campaign`
- placeholder values such as `(direct)`, `(not set)`, or empty values are not sufficient proof that no UTM campaigns exist when manual UTM dimensions or `pageLocation` contain real campaign values

Reason:

- changing selected GA4 campaigns after setup changes the core analytics scope
- that scope feeds Overview, KPIs, Benchmarks, Ad Comparison, Insights, Reports, alerts, and scheduled refresh
- until a dedicated rescope workflow exists, post-setup edits are intentionally avoided to prevent partially refreshed downstream metrics

## Overview Tables

### Campaign Breakdown

`Campaign Breakdown` is campaign-filtered and represents performance grouped by UTM campaign inside the selected GA4 campaign scope.

Columns:

- `Campaign`
- `Sessions`
- `Users`
- `Conversions`
- `Conv Rate`
- `Revenue`

Important clarification:

- the visible column label is `Revenue`, not `GA4 Revenue`, because the value can include exact campaign-matched imported revenue
- the visible subtitle states `GA4 metrics: last 30 completed days; Revenue includes exact campaign-matched source-to-date imports.`
- `Campaign Breakdown` revenue starts with GA4 revenue attributed to each GA4 campaign row
- Campaign Breakdown row `Sessions`, `Users`, `Conversions`, and GA4-native `Revenue` remain the raw GA4 breakdown row values returned for the selected property and saved campaign scope; they are not scaled to Summary card totals
- exact campaign-matched imported revenue may be added only when a source saves real campaign-value mappings that match a GA4 campaign row
- the imported campaign-matched amount is source-to-date, not limited by the 30-completed-day GA4 row query
- it is not a proportional allocation of imported external revenue
- campaign financial cards and campaign-breakdown revenue should not be treated as interchangeable numbers
- `Users` in this table is a row-level GA4 breakdown value, not a deduplicated page-level total
- the same person can appear in more than one campaign row, so row `Users` values are directional and are not expected to sum or reconcile exactly to the top `Users` card

Historical deployed candidate evidence captured on `2026-08-13`:

- property `542352127` returned `isSimulated=false`; the app read the live GA4 property, which contains user-seeded test data
- `yesop_retargeting`: 17 Sessions, 17 Users, 17 Conversions, 100.0% conversion rate, `$3,818.40` native GA4 revenue, `$16,100.00` exact HubSpot imports, `$19,918.40` displayed Revenue
- `yesop_email_nurture`: 14 Sessions, 14 Users, 14 Conversions, 100.0% conversion rate, `$2,881.00` native GA4 revenue, `$600.00` exact CSV import, `$3,481.00` displayed Revenue
- `yesop_paid_social`: 11 Sessions, 11 Users, 11 Conversions, 100.0% conversion rate, `$3,165.40` native GA4 revenue, `$99.99` exact Shopify import, `$3,265.39` displayed Revenue
- the 100% rates are `Conversions / Sessions`; they reflect the seeded values returned by GA4 and are not produced by copying Sessions into the other fields

### Landing Pages

`Landing Pages` should be understood as a selected-date-range view for the GA4 property and GA4 campaign selection configured for this app campaign.

Columns:

- `Landing page`
- `Source/Medium`
- `Sessions`
- `Users`
- `Conversions`
- `Conv. rate`

Important meaning:

- it can reflect multiple GA4 campaign values if those values were intentionally selected for this one app campaign
- it is not a rollup across unrelated campaigns in the property
- it uses the same selected GA4 Overview date range as the nearby Summary, Campaign Breakdown, and current performance sections, not the app campaign's start/created date
- revenue is intentionally not shown in `Landing Pages`; page-level rows remain traffic and conversion context only
- numeric live or live-test GA4 property IDs use the live GA4 Data API path; zero row-level conversions are correct when GA4 returns zero conversions for the exact landing-page/source/medium grain
- when GA4 returns primary landing-page traffic rows or same-scope `pageLocation` traffic-fallback rows with missing conversion values, conversions may be supplemented from conversion-prioritized same-scope `pageLocation` UTM rows only by exact `Landing page + Source/Medium` match
- campaign-level conversions and campaign-matched imported revenue are not allocated into landing-page rows unless a future source provides real landing-page-level identifiers that can be matched safely
- if GA4 cannot provide an exact row-level conversion match, `Conversions` and `Conv. rate` can correctly remain zero for that row
- `Users` in this table is a row-level GA4 breakdown value, not a deduplicated page-level total
- the same person can appear on more than one landing-page row, so row `Users` values are directional and are not expected to sum or reconcile exactly to the top `Users` card

### Conversion Events

`Conversion Events` follows the same scope and selected-date-range rule as `Landing Pages`.

Columns:

- `Event`
- `Conversions`
- `Event count`
- `Users`

Important meaning:

- revenue is intentionally not shown in `Conversion Events`; event rows remain conversion-volume context only
- it uses the same selected GA4 Overview date range as the nearby Summary, Campaign Breakdown, and current performance sections, not the app campaign's start/created date
- when GA4 returns primary event rows with missing conversion values, conversions may be supplemented from conversion-prioritized same-scope `pageLocation` UTM rows only by exact `Event` name match; rows that already have conversions or revenue are not overwritten
- campaign-matched imported revenue is not allocated into event rows unless a future source provides real event-level identifiers that can be matched safely
- if GA4 cannot provide an exact event-level conversion match, `Conversions` can correctly remain zero for that row
- `Users` in this table is a row-level GA4 breakdown value, not a deduplicated page-level total
- the same person can appear in more than one conversion-event row, so row `Users` values are directional and are not expected to sum or reconcile exactly to the top `Users` card

## Overview Tables Current-State Observation

The current `Campaign Breakdown`, `Landing Pages`, and `Conversion Events` tables are not intended to be test-only surfaces.

Current code-path meaning:

- in test mode, these tables can render from simulated GA4 responses
- in production mode, they are intended to render from real GA4-backed query paths for the selected GA4 property and the campaign's saved GA4 campaign scope
- production table population uses the real GA4 query path, not a mock-refresh design
- numeric GA4 property IDs must not be classified as the Yesop simulator; Overview values for live or mock-live numeric properties should come from the GA4 live import/query path plus persisted selected-campaign daily facts, not a deterministic simulation baseline
- `Landing Pages` and `Conversion Events` use the selected supported connection's 30-day completed-day lookback; explicit API `startDate` remains a compatibility override for callers that intentionally request it
- `Landing Pages` and `Conversion Events` are not reconstructed from scheduler-populated `ga4_daily_metrics`; they fetch row-level GA4 views directly and use exact-match fallback supplementation only when GA4 returns compatible row-level values
- when attribution dimensions are empty or partial for fresh live traffic, table queries may fall back to same-scope `pageLocation` `utm_campaign`; landing page source/medium and conversion-event counts can then be supplemented only by exact row-level match

Important meaning:

- these tables should populate and update accurately in production if GA4 connection, property selection, campaign scoping, and GA4 tagging are correct
- if a table looks wrong in production, the likely problem is scoping, tagging, or upstream GA4 data quality, not that the UI is inherently test-only

## Loading, Failure, Empty, And Zero States

Current Commit 3 defines these states explicitly:

- initial loading uses stable skeletons instead of temporary zero or empty-table copy
- a successful response with zero metrics or an empty row array is valid data and renders as zero or the normal empty state
- an HTTP failure, a malformed JSON response, or `success:false` is an error and must not be converted into `$0`, `[]`, `null`, `Not configured`, or a legitimate empty-table message
- when React Query still has last successful data during a failed background refresh, that stable content remains visible and the Overview warning states that last successful values are being shown
- when no last-good data exists, affected cards/tables/source lists render `Unavailable` or an explicit request-error message
- with valid zero revenue and positive spend, Profit is negative spend, ROAS is `0.00x`, and ROI is `-100%`; zero revenue is not a missing prerequisite
- browser-generated Overview reports and scheduled/server Overview reports fail closed when a selected Overview subsection lacks required inputs; they must not export a plausible zero/empty artifact from a failed request

Deployed validation of Current Commit 3 (`7b162083`) exposed one presentation-only follow-up: the page-wide banner aggregated hidden Diagnostics and duplicate connection-list errors together with visible Overview requests, so an initial optional failure could show a generic red warning even while visible values were handled correctly. Follow-up `a0b205b5` keeps initial failures local to the affected card/table and shows the page-wide warning only when visible Overview values are retained from a previous successful request. After deployment, the user-confirmed one-refresh validation passed: the incorrect banner was gone. This closes the bounded Current Commit 3 packet without claiming unobserved failure-injection or valid-zero production fixtures.

This failure-state contract does not close the later GA4 spend-context/cache, source-family lifecycle, provider freshness, cleanup, or complete downstream-certification blockers.

## Overview Tables Deployed Validation Checklist

The current recorded Overview boundary is **PRODUCTION_READY** at certified runtime `b8c7362121593502955d41e522d32396a963fdcc`. The following checklist is retained for future campaigns, source configurations, and scope expansions.

Connection and scope:

- confirm the campaign has a valid GA4 access-token connection
- confirm the correct GA4 property is selected
- confirm the campaign's saved GA4 campaign filter/scope is correct

Summary cards:

- confirm `Sessions`, `Users`, `Conversions`, `Conv. Rate`, and GA4-native `Total Revenue` match the selected GA4 property and saved campaign values across the processed date range used by the Overview import
- confirm Measurement Protocol or freshly tagged traffic that appears under `pageLocation` `utm_campaign` can still show matching selected-campaign conversions/native revenue when GA4 exposes purchase attribution under `campaignName`
- confirm the cards keep one coherent selected-campaign source and do not combine per-metric maximum values from incompatible daily, to-date, and breakdown windows

Campaign Breakdown:

- confirm rows populate from the selected GA4 property and campaign scope
- confirm `Sessions`, `Users`, `Conversions`, and `Revenue` are coherent with GA4 for that scope
- confirm exact campaign-matched imported revenue is added only when source campaign values safely match GA4 campaign rows

Landing Pages:

- confirm rows populate for the same GA4 property, selected Overview date range, and campaign scope
- confirm `Source/Medium`, `Sessions`, `Users`, `Conversions`, and `Conv. rate` look coherent for that scope, including the case where primary campaign dimensions are empty and rows come from `pageLocation` UTM traffic fallback
- confirm row-level `Conversions = 0` is accepted only when GA4 itself returns zero for the exact landing-page/source/medium grain, not because campaign-level conversions failed to allocate into page rows
- confirm campaign-only imported revenue is not allocated into landing-page rows
- confirm page rows are not unexpectedly mixing unrelated campaigns due to bad GA4 campaign tagging/filtering

Conversion Events:

- confirm rows populate for the same GA4 property, selected Overview date range, and campaign scope
- confirm `Conversions`, `Event count`, and `Users` are coherent with GA4 event tracking for that scope
- confirm campaign-only imported revenue is not allocated into conversion-event rows
- confirm conversion-event naming and totals reflect real GA4 configuration rather than stale or misconfigured events

Freshness and updates:

- confirm table queries refetch successfully after normal page refetch/reload
- confirm production freshness expectations are based on real GA4 fetches, refetches, and scheduled refresh

Data quality:

- confirm UTM campaign naming is clean enough for `Campaign Breakdown` grouping
- confirm landing-page tracking is correct in GA4
- confirm conversion events are configured and firing correctly in GA4

## Current-State Note

The current implementation uses mixed but intentional data paths:

- persisted GA4 daily facts
- GA4 to-date totals
- strict daily spend and revenue rows for financial logic

Future work should preserve this model unless the user explicitly asks for a change to the underlying computation approach.
