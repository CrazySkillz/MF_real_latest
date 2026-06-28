# GA4 KPIs

## Purpose

This file defines the GA4 `KPIs` tab, KPI creation flow, current-value logic, gating, alerts, and refresh behavior.

## Production Readiness Status

As of June 28, 2026, the GA4 `KPIs` tab is not production-ready for the current GA4 code scope.

The durable source of truth is `GA4/KPIS_PRODUCTION_READINESS.md`. Current local fixes make GA4 KPIs eligible for certification, but the production-readiness answer must remain not production-ready unless the complete current value inventory, downstream propagation matrix, lifecycle matrix, negative cases, report consumers, alert/notification paths, and validation evidence are covered from current code.

For future platforms, use this file only as the functional KPI tab contract. Use `GA4/KPIS_PRODUCTION_READINESS.md` for the reusable production-readiness audit gates and source-specific proof requirements.

## KPI Tab Structure

The GA4 `KPIs` tab contains:

- `Create KPI`
- an executive snapshot tracker panel
- a KPI grid with current vs target
- edit and delete actions
- alert indicators when alerts are enabled

Executive snapshot cards:

- `Total KPIs`
  Number of total KPIs.
- `Above Target`
  Better than the target by more than the metric-aware tolerance.
- `On Track`
  Within metric-aware tolerance.
- `Below Target`
  Worse than the target by more than the metric-aware tolerance.
- `Avg. Progress`
  Average progress across scorable KPIs, bounded to `0%` to `100%` per KPI so over-target KPIs do not inflate the executive summary above full completion.

Current KPI color meaning:

- `Above Target` = green
- `On Track` = blue
- `Below Target` = red

Important meaning:

- KPI card progress bars and the KPI executive snapshot should use the same status-color scheme
- visual status should not drift from the underlying KPI band classification
- performance tracker status-card copy should stay readable for mixed KPI types: use plain language such as `each KPI's tolerance` in the compact cards and avoid exposing implementation details such as derived count amounts or per-metric tolerance lists; individual KPI cards should show only the row-level tolerance percentage, such as `outside 5% tolerance`

## KPI Creation Journey

1. user clicks `Create KPI`
2. user chooses a metric/template or custom KPI
3. the app prefills the latest current value from live GA4-backed calculations
4. the user sets a target
5. the KPI is saved to this campaign and platform scope

Important meaning:

- KPI targets are campaign goals
- they are not benchmark reference values
- they are not percentages of the current value unless the user explicitly enters a percentage-based target metric
- the target should represent what "good" looks like for this campaign
- the KPI template tile grid is the metric selector; selecting `Create Custom KPI` should highlight that tile with the same selected styling used by predefined KPI tiles
- the `Unit` field is a constrained dropdown, not free text. Supported visible choices are `Select unit`, `Percentage (%)`, campaign currency, `Count`, and `Ratio (x)`, with the current campaign currency used for currency-style KPIs.
- for a custom KPI before the user selects a real unit, `Current Value` and `Target Value` should be formatted as generic numbers. Whole numbers such as `700` should remain `700`, while currency-style two-decimal formatting should apply only after a currency unit is selected.
- `Create KPI` should remain disabled until `KPI Name` and `Target Value` are both non-empty; submit-handler validation is only the fallback, not the primary UX.

## KPI Grid Behavior

Each KPI shows:

- current value
- target value
- progress bar
- status
- edit action
- delete action

Percentage KPI card values should display enough precision to explain the progress math.
For example, a raw conversion rate of about `4.03%` against a `5%` target should show about `80.6%` progress and about `19.4% below target`; it should not display the current value as only `4%` if that makes the progress appear inconsistent.

The KPI grid is the detailed record of KPI state.

The executive snapshot tracker is a summary derived from the KPI grid, not a separate source of truth.

Metric-aware threshold policy:

- count KPIs such as `Conversions`, `Users`, and `Sessions` use count-aware tolerance so normal one-unit misses are not over-penalized, while tiny targets still require meaningful progress
- rate KPIs such as `Conversion Rate` and `Engagement Rate` use relative tolerance plus a small percentage-point tolerance where appropriate
- revenue and currency KPIs use relative tolerance unless a more specific policy is defined
- ratio and efficiency KPIs such as `ROAS` and `ROI` use relative tolerance with the correct unit meaning
- lower-is-better cost KPIs such as `CPA`, `CPC`, `CPM`, and `CPL` invert the direction so lower than target is favorable
- blocked or insufficient-data KPIs are excluded from `Above Target`, `On Track`, `Below Target`, and `Avg. Progress`

Validation examples:

- `Conversions` target `10`, current `9` should be `On Track`
- `Conversions` target `1`, current `0` should be `Below Target`
- `Total Users` target `820`, current `779` should be `On Track` because it is within the `5%` tolerance
- `Total Users` target `820`, current `769` should be `Below Target` because it is `6.2%` below target and outside the `5%` tolerance
- `Conversion Rate` target `5%`, current `4.8%` should be `On Track` when sessions are available
- `Conversion Rate` with no sessions should show `Insufficient data` instead of a target status
- `Revenue` target `100000`, current `95000` should be `On Track`
- `CPA` target `100`, current `105` should be `On Track`, while larger misses should be `Below Target`

When editing an existing KPI:

- the edit modal should highlight the matching predefined KPI tile when the KPI maps to a standard template
- custom KPIs should not force-highlight a predefined tile
- opening edit mode should not auto-select or visually highlight the KPI name input text
- the KPI name field remains editable, but template selection should be visually represented by the tile grid
- `Update KPI` should remain disabled immediately after opening edit mode and should become enabled only after at least one form value differs from the loaded edit values

## KPI Value Sources

KPI current values are driven by the same live data model as the GA4 page:

- GA4 metrics
- imported revenue where relevant
- imported spend where relevant
- derived campaign financial calculations where relevant

Important meaning:

- KPIs track the latest GA4-backed campaign state
- KPI current values should stay consistent with the Overview and financial-source logic

Current-value hierarchy:

- traffic and engagement KPIs should come from GA4-scoped campaign metrics
- revenue-dependent KPIs should use recomputed campaign revenue values
- spend-dependent KPIs should use recomputed campaign spend values
- efficiency KPIs like `ROAS`, `ROI`, and `CPA` should be derived from the current recomputed financial state
- if dependencies are missing, the KPI should be blocked instead of showing a misleading value

Campaign-level KPI source previews:

- campaign-level KPI current values must be populated from connected-platform values, not from a separate generic fallback when a connected-platform value exists
- connected-platform metrics are the upstream source of truth for campaign-level KPI current values; when a connected platform value changes in GA4, the matching campaign-level KPI current value must update from that connected-platform value
- campaign-level KPI/Benchmark production-readiness tracking lives in `CAMPAIGN_LEVEL_KPI_BENCHMARK_PRODUCTION_READY.md`
- campaign-level `Revenue` must use the connected GA4 `Total Revenue` value directly and must not show a separate revenue-source picker in the create flow
- campaign-level `Conversions` must use the connected GA4 `Total Conversions` value directly and must not show a separate conversion-source picker in the create flow
- campaign-level `Users` must use the connected GA4 `Total Users` value directly and must not show a separate user-source picker in the create flow
- campaign-level `Conversions` and `Users` must populate the saved Unit field as `count` while still rendering card values as plain whole numbers
- campaign-level `Conversion Rate` must use connected GA4 `Total Conversions` and `Total Sessions` directly and must not show separate conversion/session source pickers in the create flow
- campaign-level KPI template tiles should expose only campaign-level KPI choices: `ROAS`, `ROI`, `CPA`, `Revenue`, `Conversions`, `Users`, `Conversion Rate`, and `Create Custom KPI`; source-specific tiles like `Spend`, `CTR`, and click-based conversion rate should not be shown in the campaign-level create flow
- for GA4-only campaigns, the campaign-level `ROAS`, `ROI`, and `CPA` inputs must match the GA4 financial card inputs: `Total Revenue` = GA4 native revenue plus imported revenue, `Total Spend` = spend breakdown/spend-to-date, and `Total Conversions` = GA4 connected conversions
- `ROAS` is displayed as an `x` ratio (`Revenue ÷ Spend`), while `ROI` remains a percent (`(Revenue - Spend) ÷ Spend × 100`) and `CPA` remains currency (`Spend ÷ Conversions`)
- selecting campaign-level `ROAS`, `ROI`, or `CPA` must preselect those aggregate connected-platform inputs so the Current Value preview immediately matches the visible campaign/GA4 card value
- the campaign-level `ROAS`, `ROI`, and `CPA` create flow should show the connected-platform provenance, not separate revenue/spend source-picker sections, because those metrics are aggregate values sourced from Google Analytics in Connected Platforms
- the campaign-level `Create KPI` modal must use the KPI tiles as the metric selector; do not show a separate `Aggregated Metric` dropdown in create mode because it duplicates the selected tile and can drift from the tile-driven calculation config
- the campaign-level `Create KPI` modal should match the GA4 KPI modal's visual pattern: card-colored dialog, muted template container, blue selected tile state, neutral unselected tiles, KPI form fields directly below the template selector, Priority field, and the same `Enable alerts for this KPI` section layout
- campaign-level KPI summary cards should use the same executive snapshot model as GA4 KPIs: shared metric-aware `Above Target`, `On Track`, and `Below Target` classification plus bounded `Avg. Progress`
- the campaign-level `Create KPI` modal must use the same GA4-scoped totals as the GA4 Overview page for GA4 source values
- GA4 revenue, conversions, sessions, and users shown in campaign-level KPI source options must be derived from the selected GA4 connection using the GA4 to-date response plus persisted daily rows, matching the GA4 Overview fallback rules
- do not read GA4 campaign KPI source values only from generic campaign outcome totals when a GA4-page-specific total exists, because that can drift from the values shown in GA4 Overview and Total Revenue Sources
- campaign efficiency KPIs must use aggregate campaign inputs: `ROAS` and `ROI` use `Total Revenue` plus `Total Spend`; `CPA` uses `Total Spend` plus `Total Conversions`
- standalone KPIs like `Revenue`, `Spend`, `Conversions`, and `Users` may expose individual source rows because those KPIs are explicitly source-selectable

## Revenue / Spend-Dependent KPI Gating

Some KPI types are intentionally blocked until prerequisites exist.

Examples:

- revenue
- ROAS
- ROI
- profit
- CPA

Important meaning:

- missing spend/revenue should not silently show misleading zeroes
- blocked KPIs are excluded from executive scoring
- blocked KPIs should also be excluded from `Avg. Progress`
- blocked KPIs should not be classified into `Above Target`, `On Track`, or `Below Target`

## Executive Snapshot Band Logic

The executive snapshot tracker uses shared metric-aware classification bands:

- `Above Target`
  Better than the target by more than the metric-aware tolerance.
- `On Track`
  Within metric-aware tolerance.
- `Below Target`
  Worse than the target by more than the metric-aware tolerance.

Important meaning:

- these bands drive the campaign-level KPI summary state
- they should be derived from the same KPI progress logic as the KPI grid
- tracker status should never drift from KPI card status for the same KPI
- reports and Executive Summary KPI progress should use the same shared classification result

## KPI Alerts And Notifications

Users can enable alerts with:

- threshold value
- condition: `below`, `above`, or `equals`
- frequency: `immediate`, `daily`, `weekly`
- optional comma-separated email recipients

Default form behavior:

- new GA4 KPI forms should preselect `Immediate` for `Alert Frequency`
- editing an existing KPI should preserve the saved frequency value
- when `Send email notifications` is not selected, the form should hide `Email addresses *` and `Alert Frequency`
- when `Send email notifications` is selected, `Email addresses *` should render as a full-width row with the label next to the input, and `Alert Frequency` should render underneath it

Alert frequency meaning:

- `Immediate`
  Bell + Notifications keep one active in-app alert record while the breach remains unresolved. If the KPI is already breached on create/update, the first email sends immediately. Later reminder emails can repeat at most once per hour.
- `Daily`
  Bell + Notifications keep one active in-app alert record while the breach remains unresolved. If the KPI is already breached on create/update, the first email sends immediately. Later reminder emails can repeat at most once per day.
- `Weekly`
  Bell + Notifications keep one active in-app alert record while the breach remains unresolved. If the KPI is already breached on create/update, the first email sends immediately. Later reminder emails can repeat at most once per week.

Expected behavior:

- KPIs with alerts enabled show a warning indicator on the KPI card
- breached KPIs show a red pulsing circle indicator on the KPI card
- breached KPI alerts should appear in the bell icon and notifications center
- enabled KPI alerts should not appear in the bell icon or main Notifications page unless the alert condition is currently breached; once the KPI no longer breaches, stale `performance-alert` rows should be hidden/resolved instead of remaining visible
- bell and Notifications `View KPI` navigation should always open the correct campaign, the `KPIs` tab, and the exact KPI card
- if the user is already on the same GA4 campaign page, the URL change must still switch to the correct KPI tab/item instead of staying on the previously open tab
- email delivery is optional
- `Email addresses *` and `Alert Frequency` should appear only after `Send email notifications` is selected
- the selected `Alert Frequency` controls reminder emails, not duplicate in-app notification rows
- when email alerts are enabled and the KPI is already breached on create/update, the first email should send immediately
- if a breached GA4 KPI has no active in-app notification row, the next GA4 KPI/Benchmark recompute or daily scheduler cycle should restore exactly one active bell / Notifications alert row
- opening the bell, opening Notifications, or simply loading the GA4 page should not be relied on as the reconciliation trigger for restoring a missing GA4 in-app alert row
- if the KPI unit is `count`, alert text should omit the literal word `count` in bell, Notifications, and email output
- alert text should use the same human-readable number style as KPI cards rather than raw parenthesized decimals
- alert emails should include both client and campaign context when the campaign is known
- alert email action text should use the display label `KPI`, not lowercase `kpi`
- example alert text:
  `Client: Test_client`
  `Campaign: myGA4`
  `Current value: 72,660`
  `Alert threshold value: 75,000`

## KPI Background Refresh Pattern

After GA4 Overview-driving values refresh, the required KPI order is:

1. recompute KPI current values
2. refresh KPI progress and performance state
3. update stored KPI progress/history where applicable
4. run KPI alert checks against refreshed values

The executive snapshot tracker should also recompute whenever related inputs change.

This includes:

- when a new KPI is created
- when an existing KPI is edited
- when a KPI is deleted
- when KPI current values change after GA4, revenue, or spend updates
- when revenue sources are added, edited, deleted, or refreshed
- when spend sources are added, edited, deleted, or refreshed
- when target values change
- when a KPI moves between `Above Target`, `On Track`, and `Below Track`

Important meaning:

- the executive snapshot cards are derived KPI-state summaries
- they should not lag behind the KPI grid
- any change that affects KPI current value, target value, progress, or status should trigger recomputation of the tracker counts and `Avg. Progress`
- KPI alerts should evaluate after KPI recomputation, not before
- GA4 KPI alerts must use the same current-value source as the live GA4 KPI cards
- if the exact report-date GA4 daily row is missing, GA4 KPI recomputation should fall back to the latest available GA4 daily row for that campaign/property rather than skipping alert reconciliation entirely
- duplicate active GA4 KPIs for the same `campaign + metric` must not emit competing active alerts; the latest row should win
- the bell / Notifications center should refetch current notification state when opened so resolved alerts do not linger from client cache

## Current-State Note

The GA4 `KPIs` tab is not production-ready for the current GA4 code scope. The implementation remains intentionally split between live page rendering, persisted KPI rows/history, background GA4 jobs, and alert reconciliation; current local fixes are documented in `GA4/KPIS_PRODUCTION_READINESS.md`, but final certification remains blocked by the explicit evidence gates in that file.

External/provider caveats, future-platform reuse requirements, and the exact completed fix queue are documented in `GA4/KPIS_PRODUCTION_READINESS.md`.
