# LinkedIn Revenue Import Production-Ready Tracker

## Purpose

Track the work required to make revenue import in the LinkedIn Analytics Overview tab production-ready.

LinkedIn is a paid-media source. It provides paid-ad activity such as spend, impressions, clicks, leads, and conversions. It should not be treated as a native revenue source unless the user connects a LinkedIn-scoped revenue attribution input.

This tracker is scoped to revenue attribution for LinkedIn campaigns, not the full LinkedIn Connected Platform implementation. The broader LinkedIn platform tracker remains `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md`.

## Product Rule

LinkedIn revenue must be optional, explicit, and source-scoped.

- LinkedIn spend and ad metrics can come from LinkedIn.
- LinkedIn revenue must come from a connected revenue attribution source such as CRM, ecommerce, CSV, Google Sheets, or webhook conversion events.
- GA4 revenue must not unlock LinkedIn revenue, ROI, or ROAS unless a validated LinkedIn attribution mapping exists.
- Revenue, ROI, and ROAS must remain unavailable when no LinkedIn-scoped revenue source exists.

## Current Root Cause

The backend already has the right core pattern:

- `server/utils/linkedin-revenue.ts` is the canonical LinkedIn revenue rule helper.
- `AddRevenueWizardModal` supports `platformContext="linkedin"`.
- LinkedIn-scoped revenue sources are saved separately from GA4 revenue.
- LinkedIn-scoped revenue can be saved through the shared revenue source infrastructure.

The main gaps are:

- The Overview tab shows `Revenue Tracking Not Configured`.
- The current call to action routes users back to Campaign Overview instead of opening the revenue import flow directly.
- The wording does not clearly explain that users are connecting revenue attribution for LinkedIn, not importing native LinkedIn revenue.
- The LinkedIn revenue modal still contains older LinkedIn-only flow branches for CSV, Google Sheets, and some CRM/ecommerce paths instead of matching the GA4 revenue-source flow and changing only `platformContext`.
- The LinkedIn `Total Revenue` summary card is display-only today; unlike GA4, it does not expose a `+` action or `Sources (n)` link for managing multiple LinkedIn-scoped revenue sources.
- LinkedIn Overview revenue totals previously read imported revenue through a 30-day window even though LinkedIn revenue imports are treated as campaign-lifetime revenue-to-date. Sources that materialized older daily rows could therefore be undercounted.
- CRM imports can materialize both aggregate revenue rows and per-LinkedIn-campaign rows for attribution. Totals must not double-count those sub-campaign rows when an aggregate row exists for the same source.
- The production-ready path needs regression coverage proving GA4 revenue cannot leak into LinkedIn revenue.

## Production-Ready Target

LinkedIn Analytics Overview should let a user connect revenue attribution directly from the Overview tab using the same refined GA4 revenue import pattern, with LinkedIn-specific wording and strict platform scoping.

Production-ready behavior:

- `Revenue Tracking Not Configured` shows a direct LinkedIn revenue attribution action.
- Clicking the action opens the existing `AddRevenueWizardModal` with `platformContext="linkedin"`.
- Each LinkedIn revenue source follows the same user flow as the matching GA4 revenue source. LinkedIn-specific behavior should be limited to platform scoping with `platformContext="linkedin"` and source-specific attribution copy where needed.
- LinkedIn revenue imports use revenue-to-date style revenue inputs like GA4. The UI should not expose a separate LinkedIn-only `Conversion Value` source-of-truth selector.
- Imported LinkedIn revenue updates LinkedIn Overview, KPI, Benchmark, Campaign DeepDive, and Custom Report consumers through the existing cache/refetch pattern.
- LinkedIn Overview shows a top-level `Total Revenue` summary card; when no LinkedIn-scoped revenue source exists, the card says `Not connected` instead of showing a misleading zero.
- LinkedIn Overview `Total Revenue` sums all active LinkedIn-scoped imported revenue sources using campaign-lifetime revenue-to-date semantics.
- LinkedIn Overview `Total Revenue` follows the GA4 card pattern: `+` opens the LinkedIn-scoped add-revenue flow, and `Sources (n)` opens the LinkedIn-scoped source list for multiple active sources.
- Removing the LinkedIn revenue source disables LinkedIn revenue-derived metrics immediately.
- GA4 revenue does not make LinkedIn revenue, ROI, or ROAS available.

## Commit Plan

### Commit 1: Direct LinkedIn Overview Revenue Action

Goal:

- Make the LinkedIn Analytics Overview revenue setup path obvious and direct.

Changes:

- In `client/src/pages/linkedin-analytics.tsx`, update the `Revenue Tracking Not Configured` card.
- Replace or supplement `Manage in Connected Platforms` with a direct action such as `Add Revenue Source` or `Connect Revenue Attribution`.
- Wire the action to the existing `openAddRevenueModal("add")` path.
- Keep `AddRevenueWizardModal` with `platformContext="linkedin"`.

Validation:

- Open LinkedIn Analytics -> Overview with no LinkedIn revenue source.
- Confirm the card does not imply LinkedIn natively provides revenue.
- Click the revenue action.
- Confirm the existing revenue wizard opens directly.
- Confirm the modal is scoped to LinkedIn.

Status:

- [x] Completed locally: the LinkedIn Overview `Revenue Tracking Not Configured` card now opens the existing LinkedIn-scoped revenue wizard directly with `platformContext="linkedin"` instead of routing users back to Campaign Overview.
- [x] User validation passed.

### Commit 2: LinkedIn-Specific Revenue Attribution Copy

Goal:

- Make the business meaning clear for executives and operators.

Changes:

- Update LinkedIn Overview copy to explain:
  - LinkedIn provides paid-ad activity.
  - Revenue must be attributed from CRM, ecommerce, CSV, Google Sheets, or webhook input.
  - ROI/ROAS unlock only after a LinkedIn-scoped revenue source is connected.
- Update modal/help text only where the existing shared wizard supports contextual copy without changing GA4 behavior.

Validation:

- LinkedIn Overview clearly says revenue attribution is not native LinkedIn revenue.
- GA4 revenue import copy remains unchanged.
- The user can understand why revenue is needed before ROI/ROAS appear.

Status:

- [x] Completed locally: LinkedIn Overview now explains that LinkedIn supplies paid-ad activity and revenue must be attributed from CRM, ecommerce, CSV, or Google Sheets before ROI/ROAS unlock.
- [x] Completed locally: the shared revenue wizard shows a LinkedIn-specific title and source-selection description only when opened with `platformContext="linkedin"`, leaving GA4 copy unchanged.

### Commit 3: Confirm Revenue Source Modes

Goal:

- Superseded by Commit 4A-4E. Earlier work confirmed the existing LinkedIn-specific source modes, but the corrected product target is now stricter: LinkedIn revenue sources must follow the same GA4 revenue flow and use `platformContext="linkedin"` for scoping.

Changes:

- Preserve backend compatibility for existing saved LinkedIn `conversion_value` records until a separate migration/cleanup is explicitly planned.
- Do not expose LinkedIn-only conversion-value source selection in the active UI.

Validation:

- Existing saved LinkedIn revenue records continue to load safely.
- New LinkedIn revenue imports follow the matching GA4 source flow.

Status:

- [x] Corrected locally: LinkedIn revenue attribution no longer exposes the Manual attribution option. The UI follows the GA4-like import pattern through CRM, ecommerce, CSV, Google Sheets, or webhook attribution sources.
- [x] Completed locally: CSV and Google Sheets mappings now persist `mode` as `conversion_value` when Conversion Value is selected and `revenue_to_date` when Revenue is selected, matching the backend source-of-truth modes.
- [x] User validation passed for the corrected no-manual-entry flow.
- [x] Reworked locally through Commit 4D: modal navigation, provider reconnect return handling, HubSpot Crosswalk selection, Close Date defaults, and Pipeline Proxy separation have been corrected.
- [ ] Remaining follow-up: Commit 4E regression/documentation guard work must stay current as the remaining provider parity checks are completed.

### Commit 4: Source-Scoped Refresh And UI Propagation

Goal:

- Ensure LinkedIn revenue changes update every visible consumer immediately.

Changes:

- Review the existing `invalidateAfterRevenueChange()` path for `platformContext="linkedin"`.
- Add only missing invalidations/refetches if a traced consumer does not refresh.
- Preserve the current query patterns.

Validation:

- After adding LinkedIn revenue, LinkedIn Overview updates without a hard reload.
- LinkedIn KPI and Benchmark tabs update revenue-dependent values.
- Campaign DeepDive aggregate consumers update where LinkedIn revenue is supported.
- Custom Report downloads use latest LinkedIn revenue values.
- Removing the LinkedIn revenue source disables revenue-derived metrics immediately.

Status:

- [x] Completed locally: LinkedIn revenue add/edit now invalidates and refetches LinkedIn Overview, LinkedIn KPI, LinkedIn Benchmark, LinkedIn campaign revenue breakdown, Campaign DeepDive aggregate, Executive Summary, Trend Analysis, campaign KPI, campaign Benchmark, and Custom Report aggregate query families where applicable.
- [x] Completed locally: LinkedIn revenue removal now invalidates the same revenue-dependent consumers so revenue-derived metrics are disabled without requiring a hard reload.
- [x] Completed locally: main LinkedIn Connected Platforms disconnect now deactivates LinkedIn-scoped revenue sources, deletes their revenue records, clears LinkedIn-tagged Google Sheets/HubSpot/Salesforce/Shopify revenue attribution configs, and scopes Pipeline Proxy lookups to active LinkedIn revenue sources so reconnect cannot immediately show stale revenue, ROI, ROAS, or Pipeline Proxy from the previous LinkedIn connection.
- [x] Corrected locally: the shared revenue modal now scopes CRM/ecommerce source-card status and disconnect actions by `platformContext`, so GA4 HubSpot/Salesforce/Shopify revenue sources cannot appear as LinkedIn revenue sources and LinkedIn disconnect cannot delete a GA4-scoped revenue source.
- [x] Completed locally: LinkedIn Overview now includes a top-level `Total Revenue` summary card populated from the existing LinkedIn-scoped `aggregated.totalRevenue` value, with `Not connected` shown when no LinkedIn revenue source is configured.

Commit 4 sub-commit index:

- Commit 4A: Normalize LinkedIn CSV to the GA4 revenue flow.
- Commit 4B: Normalize LinkedIn Google Sheets to the GA4 revenue flow.
- Commit 4C: Normalize LinkedIn CRM and ecommerce revenue wizards to the GA4 flow.
- Commit 4D: Align LinkedIn revenue modal navigation with GA4.
- Commit 4E: Document and guard the GA4-flow rule.

### Commit 4A: Normalize LinkedIn CSV To GA4 Revenue Flow

Goal:

- Make LinkedIn CSV revenue import match the GA4 CSV revenue import flow.

Changes:

- Remove the LinkedIn-only `What do you want to import?` selector from the CSV step.
- Remove the LinkedIn-only `Conversion Value` column UI from CSV mapping.
- Force new LinkedIn CSV imports to use the GA4-style revenue column path with `valueSource="revenue"` and `mode="revenue_to_date"`.
- Keep `platformContext="linkedin"` in the save payload so the saved source remains LinkedIn-scoped.
- Preserve backend compatibility for older saved LinkedIn CSV conversion-value records, but do not expose that mode for new imports.

Validation:

- Open LinkedIn Analytics -> Overview -> `Connect Revenue Attribution` -> `Upload CSV`.
- Confirm the CSV screen visually matches the GA4 CSV revenue screen except for LinkedIn-scoped copy where applicable.
- Confirm there is no `Total Revenue / Conversion Value` selector.
- Import a CSV and confirm the saved source has `platformContext="linkedin"` and does not unlock or alter GA4 revenue.

Status:

- [x] Completed locally: LinkedIn CSV no longer exposes the LinkedIn-only `Total Revenue / Conversion Value` selector or conversion-value column mapping. It now uses the GA4-style revenue-column CSV flow while preserving `platformContext="linkedin"` in the save payload.
- [x] User validation passed.

### Commit 4B: Normalize LinkedIn Google Sheets To GA4 Revenue Flow

Goal:

- Make LinkedIn Google Sheets revenue import match the GA4 Google Sheets revenue import flow.

Changes:

- Remove the LinkedIn-only `What do you want to import?` selector from the Google Sheets chooser.
- Remove the LinkedIn-only `Conversion Value` column UI from Google Sheets mapping.
- Force new LinkedIn Google Sheets imports to use the GA4-style revenue column path with `valueSource="revenue"` and `mode="revenue_to_date"`.
- Keep `purpose="linkedin_revenue"` and `platformContext="linkedin"` so the source remains LinkedIn-scoped.
- Preserve existing Google Sheets connection, preview, mapping, edit, and daily-refresh behavior.

Validation:

- Open LinkedIn Analytics -> Overview -> `Connect Revenue Attribution` -> `Google Sheets`.
- Confirm the chooser and mapping screens visually match the GA4 Google Sheets revenue flow except for LinkedIn-scoped copy where applicable.
- Confirm there is no `Total Revenue / Conversion Value` selector.
- Import a sheet and confirm the saved source has `platformContext="linkedin"` and updates LinkedIn revenue consumers only.

Status:

- [x] Completed locally: LinkedIn Google Sheets no longer exposes the LinkedIn-only `Total Revenue / Conversion Value` selector or conversion-value column mapping. It now uses the GA4-style revenue-column Google Sheets flow while preserving `purpose="linkedin_revenue"` and `platformContext="linkedin"` in the save/process payload.
- [x] User validation passed.

### Commit 4C: Normalize LinkedIn CRM And Ecommerce Revenue Wizards To GA4 Flow

Goal:

- Make HubSpot, Salesforce, and Shopify LinkedIn revenue setup follow the matching GA4 revenue-source flow.

Changes:

- Remove active LinkedIn-only conversion-value source selection from CRM/ecommerce wizards.
- Keep revenue-to-date style revenue mapping as the active flow.
- Keep `platformContext="linkedin"` in preview/process/save payloads.
- Keep source-card connection status scoped by `platformContext`.
- Review and remove or hide LinkedIn-only crosswalk UI only where it causes the user flow to diverge from GA4. If a source-specific attribution mapping is still required to save correct LinkedIn revenue, document it clearly before keeping it.

Validation:

- Open LinkedIn revenue modal and test HubSpot, Salesforce, and Shopify source paths.
- Confirm each path follows the same main steps as the GA4 version of that source.
- Confirm the saved sources are LinkedIn-scoped and do not appear as GA4 revenue sources.

Status:

- [x] Completed locally: HubSpot already follows the revenue-to-date path for LinkedIn and keeps conversion value disabled.
- [x] Completed locally: Salesforce active UI no longer exposes or saves conversion-value mode for LinkedIn; it now sends `valueSource="revenue"` and `conversionValueField=null` while preserving `platformContext="linkedin"`.
- [x] Completed locally: Shopify no longer labels the revenue step as `Revenue / Conversion Value`; it now presents the same revenue step label used by GA4 while preserving LinkedIn platform scoping.

### Commit 4D: Align LinkedIn Revenue Modal Navigation With GA4

Goal:

- Remove direct/partial modal states that make LinkedIn revenue setup feel different from GA4.

Changes:

- Review `initialStep` usage from `client/src/pages/linkedin-analytics.tsx`.
- Ensure normal add flow starts at the source chooser like GA4.
- Ensure Back/Cancel behavior matches GA4 for CSV, Google Sheets, CRM, and ecommerce flows.
- Keep edit mode prefill behavior only where it matches the existing GA4 edit pattern.
- Keep HubSpot/Salesforce/Shopify reconnect returns inside the selected provider wizard after a successful connection.
- Keep LinkedIn HubSpot Crosswalk on the GA4-style selected-value flow instead of a LinkedIn campaign dropdown mapping flow.
- Keep LinkedIn Salesforce Crosswalk on the same GA4-style selected-value flow so selected Opportunity values populate Revenue and Save steps directly.
- Default LinkedIn HubSpot confirmed revenue dating to HubSpot `Close Date`.
- Keep confirmed revenue and Pipeline Proxy separate: closed-won records feed Total Revenue; selected open-stage records feed Pipeline Proxy only.
- Show Pipeline Proxy in LinkedIn Overview only when a proxy source is configured.
- Render Pipeline Proxy from the saved LinkedIn-scoped revenue source configuration when the live proxy endpoint has not returned yet, while still preferring the live endpoint when it succeeds.
- Add executive-facing Pipeline Proxy card copy explaining that it is open CRM value only and is excluded from Total Revenue, ROI, and ROAS until the deal closes.
- Keep a visible Pipeline Proxy card in the top metric-card grid beside `Leads`; it shows `Not configured` until the user selects `Total Revenue + Pipeline (Proxy)` in the revenue wizard, then it populates from saved/live proxy data.
- Use a 4-column desktop grid for the LinkedIn Overview metric cards so Pipeline Proxy matches the size of Spend, Total Revenue, Impressions, Clicks, Conversions, and Leads.

Validation:

- Open LinkedIn `Connect Revenue Attribution`.
- Confirm the first screen is the shared source chooser.
- Confirm choosing CSV/Google Sheets shows the same Back behavior as GA4.
- Confirm edit mode still opens the correct saved source with prefilled values.
- Confirm HubSpot/Salesforce/Shopify connection returns open the selected provider wizard instead of dumping the user back at the source chooser.
- Confirm HubSpot Crosswalk values are clickable selections and selected values populate the Revenue and Save steps.
- Confirm Salesforce Crosswalk values are clickable selections and selected values populate the Revenue and Save steps.
- Confirm the HubSpot Revenue step defaults the Date field to `Close Date`.
- Confirm selecting `Total Revenue + Pipeline (Proxy)` creates a Pipeline Proxy card in LinkedIn Overview.
- Confirm open selected-stage deals contribute to Pipeline Proxy only, while closed-won matched deals contribute to Total Revenue after refresh/reprocess.
- Confirm Pipeline Proxy appears next to `Leads` in the top metric-card grid.
- Confirm the Pipeline Proxy card explains that open CRM value is not counted in Total Revenue, ROI, or ROAS until it closes.
- Confirm the Pipeline Proxy card remains visible as `Not configured` before setup so users know where the proxy signal will appear.
- Confirm the LinkedIn Overview metric-card section uses four desktop columns and Pipeline Proxy is the same size as the Leads card.
- Local validation: `npm run check`.
- Local validation: `npm test -- server/latest-day-revenue-regression.test.ts`.

Status:

- [x] Completed locally: HubSpot and Salesforce OAuth return handling now falls through to the selected revenue wizard even when the popup success message is missed, by confirming the provider connection status after the popup closes.
- [x] Completed locally: Shopify revenue OAuth now listens to the same BroadcastChannel signal already emitted by the callback route, so the wizard remains in the import flow after connection instead of leaving the user at the source chooser.
- [x] Completed locally: Shopify revenue OAuth now builds its callback URL from `SHOPIFY_REDIRECT_URI` first, then the actual browser/request origin, with Shopify/app base URLs only as fallbacks, because Shopify requires the redirect URL to exactly match its whitelisted app callback.
- [x] Completed locally: LinkedIn HubSpot revenue Crosswalk now uses the same clickable selected-value flow as GA4 so selected HubSpot values populate the downstream Revenue and Save steps.
- [x] Completed locally: LinkedIn Salesforce revenue Crosswalk now uses the same clickable selected-value flow as GA4/HubSpot so selected Opportunity values populate the downstream Revenue and Save steps.
- [x] Completed locally: LinkedIn HubSpot revenue now defaults confirmed revenue dating to HubSpot `Close Date`, and LinkedIn Overview shows a display-only `Pipeline Proxy` summary card when a HubSpot/Salesforce proxy source is configured.
- [x] Completed locally: LinkedIn HubSpot confirmed revenue now uses closed-won HubSpot stages by default while `Pipeline Proxy` remains a separate open-stage signal; the Overview revenue-status area renders the proxy card next to the revenue configuration card when configured.
- [x] Completed locally: LinkedIn Overview now falls back to the saved LinkedIn-scoped revenue source config for Pipeline Proxy so the card can render next to `Revenue Attribution Not Configured` before the live proxy endpoint succeeds.
- [x] Completed locally: Pipeline Proxy card now explains the business meaning of the value so users know it is an open CRM pipeline signal, not confirmed revenue.
- [x] Completed locally: Pipeline Proxy card now remains visible in the top metric-card grid next to `Leads`, with `Not configured` copy until proxy setup is selected and saved.
- [x] Completed locally: LinkedIn Overview metric cards now use a 4-column desktop grid and Pipeline Proxy uses the same card size as Leads.
- [ ] Pending: full manual parity pass for Back/Cancel behavior across CSV, Google Sheets, CRM, and ecommerce flows.

LinkedIn Pipeline Proxy rule implemented:

- Pipeline Proxy is optional and appears only when a CRM revenue source is saved with `Total Revenue + Pipeline (Proxy)`.
- Confirmed `Total Revenue` uses closed-won matched records only.
- Pipeline Proxy uses selected open-stage matched records only.
- Pipeline Proxy is display-only and must not be included in Total Revenue, ROI, ROAS, Profit, or conversion-value calculations.
- After refresh/reprocess, a matched deal that closes should stop contributing to Pipeline Proxy and start contributing to Total Revenue.
- LinkedIn Overview shows Pipeline Proxy as a top metric card next to Leads.
- LinkedIn Overview prefers the live proxy endpoint for fresh values and uses the saved source config as a safe fallback so the configured proxy is not hidden.
- The top metric-card area keeps the Pipeline Proxy card visible even before setup, so users can understand the optional signal and where it will populate.

### Commit 4E: Document And Guard The GA4-Flow Rule

Goal:

- Make the corrected rule explicit so the old LinkedIn-specific flow does not return.

Changes:

- Update this tracker after Commits 4A-4D.
- Update `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md` if the broader LinkedIn tracker references revenue setup.
- Update `GA4/README.md` or `ARCHITECTURE_USER_JOURNEY.md` only if high-level source-flow wording changes.
- Add focused regression coverage where feasible to prove LinkedIn revenue source UI/payloads follow GA4 flow and only differ by `platformContext`.

Validation:

- Documentation no longer claims active LinkedIn revenue setup supports a separate conversion-value source mode.
- Regression coverage or documented manual validation confirms CSV, Google Sheets, HubSpot, Salesforce, and Shopify follow the GA4 revenue-source flow.

Status:

- [x] Completed locally: regression coverage now guards the LinkedIn HubSpot closed-won default and prevents the old non-lost default from being reintroduced into confirmed Total Revenue.
- [x] Completed locally: regression coverage now guards that LinkedIn Overview can render Pipeline Proxy from saved source config when the live proxy endpoint has not returned.
- [x] Completed locally: regression coverage now guards that LinkedIn Salesforce Crosswalk uses selected Opportunity values instead of the stale LinkedIn campaign dropdown mapping flow.
- [ ] Pending: keep this tracker current as remaining provider manual parity checks are completed.

### Commit 4F: LinkedIn Total Revenue Card Source Controls

Goal:

- Make the LinkedIn `Total Revenue` summary card match the GA4 source-management pattern for multiple revenue sources.

Changes:

- Add a `+` action to the LinkedIn Overview `Total Revenue` summary card.
- Wire `+` to the existing LinkedIn-scoped `openAddRevenueModal("add")` flow.
- Add a `Sources (n)` link based only on active LinkedIn-scoped revenue sources from `/api/campaigns/:campaignId/revenue-sources?platformContext=linkedin`.
- Make `Sources (n)` open a GA4-style source list for LinkedIn revenue sources.
- Ensure source edit/delete actions are source-specific and scoped to `platformContext="linkedin"`.
- Preserve GA4 revenue card behavior and avoid changing revenue aggregation logic.

Validation:

- Open LinkedIn Analytics -> Overview.
- Confirm the `Total Revenue` card shows a `+` action.
- Click `+` and confirm the LinkedIn-scoped add-revenue wizard opens.
- Add more than one LinkedIn revenue source and confirm `Sources (n)` shows the correct LinkedIn-only count.
- Open `Sources (n)` and confirm only LinkedIn-scoped revenue sources appear.
- Confirm editing/deleting one source updates the count and Total Revenue without affecting GA4 revenue sources.

Status:

- [ ] Pending.

### Commit 5: Regression Coverage For Revenue Isolation

Goal:

- Prevent future GA4-to-LinkedIn revenue leakage.

Changes:

- Add or extend focused regression tests proving:
  - LinkedIn with no LinkedIn-scoped revenue source keeps revenue, ROI, and ROAS unavailable.
  - LinkedIn with a LinkedIn-scoped revenue source exposes revenue, ROI, and ROAS.
  - GA4 revenue alone does not unlock LinkedIn revenue metrics.
  - Removing LinkedIn revenue clears revenue-derived LinkedIn values.

Validation:

- Targeted regression tests pass.
- TypeScript check passes if touched code requires it.
- `git diff --check` passes.

Status:

- [ ] Pending.

### Commit 6: Documentation And Final Production-Ready Evidence

Goal:

- Record the final behavior and validation evidence.

Changes:

- Update this tracker.
- Add a short reference from `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md`.
- Update `ARCHITECTURE_USER_JOURNEY.md` only if user journey wording changes.

Validation:

- Documentation says LinkedIn revenue is attributed revenue, not native LinkedIn revenue.
- Documentation states GA4 revenue cannot unlock LinkedIn ROI/ROAS without explicit LinkedIn attribution.
- User validation is recorded.

Status:

- [ ] Pending.

## Relevant Files

- `client/src/pages/linkedin-analytics.tsx`
- `client/src/components/AddRevenueWizardModal.tsx`
- `server/utils/linkedin-revenue.ts`
- `server/routes-oauth.ts`
- `server/utils/performance-summary-aggregate.ts`
- `shared/schema.ts`
- `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `GA4/README.md`
- `ARCHITECTURE_USER_JOURNEY.md`

## Acceptance Criteria

LinkedIn revenue import is production-ready when:

- users can start LinkedIn revenue attribution directly from LinkedIn Analytics Overview
- copy clearly explains what is being attributed and why
- LinkedIn revenue remains scoped to `platformContext="linkedin"`
- each visible LinkedIn revenue source flow matches the corresponding GA4 revenue source flow, with LinkedIn-specific behavior limited to `platformContext="linkedin"` scoping and necessary attribution copy
- the visible LinkedIn revenue flow uses connected/imported attribution sources and does not offer manual entry or LinkedIn-only conversion-value source selection
- the LinkedIn `Total Revenue` summary card exposes the GA4-style `+` and `Sources (n)` controls for multiple LinkedIn-scoped revenue sources
- GA4 revenue does not unlock LinkedIn revenue metrics
- LinkedIn revenue source add/edit/delete paths update LinkedIn analytics and Campaign DeepDive consumers
- regression coverage protects the source-scoping rules
- final validation is recorded in this tracker
