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
- [ ] Rework required: Google Sheets and CRM/ecommerce LinkedIn flows still need to be aligned to the GA4 revenue-source flow. See Commit 4B-4E before proceeding to regression/finalization work.

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
- [x] Corrected locally: the shared revenue modal now scopes CRM/ecommerce source-card status and disconnect actions by `platformContext`, so GA4 HubSpot/Salesforce/Shopify revenue sources cannot appear as LinkedIn revenue sources and LinkedIn disconnect cannot delete a GA4-scoped revenue source.
- [x] Completed locally: LinkedIn Overview now includes a top-level `Total Revenue` summary card populated from the existing LinkedIn-scoped `aggregated.totalRevenue` value, with `Not connected` shown when no LinkedIn revenue source is configured.

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

- [ ] Pending.

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

- [ ] Pending.

### Commit 4D: Align LinkedIn Revenue Modal Navigation With GA4

Goal:

- Remove direct/partial modal states that make LinkedIn revenue setup feel different from GA4.

Changes:

- Review `initialStep` usage from `client/src/pages/linkedin-analytics.tsx`.
- Ensure normal add flow starts at the source chooser like GA4.
- Ensure Back/Cancel behavior matches GA4 for CSV, Google Sheets, CRM, and ecommerce flows.
- Keep edit mode prefill behavior only where it matches the existing GA4 edit pattern.

Validation:

- Open LinkedIn `Connect Revenue Attribution`.
- Confirm the first screen is the shared source chooser.
- Confirm choosing CSV/Google Sheets shows the same Back behavior as GA4.
- Confirm edit mode still opens the correct saved source with prefilled values.

Status:

- [ ] Pending.

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
- GA4 revenue does not unlock LinkedIn revenue metrics
- LinkedIn revenue source add/edit/delete paths update LinkedIn analytics and Campaign DeepDive consumers
- regression coverage protects the source-scoping rules
- final validation is recorded in this tracker
