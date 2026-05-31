# LinkedIn Revenue Import Production-Ready Tracker

## Purpose

Track the work required to make revenue import in the LinkedIn Analytics Overview tab production-ready.

LinkedIn is a paid-media source. It provides paid-ad activity such as spend, impressions, clicks, leads, and conversions. It should not be treated as a native revenue source unless the user connects a LinkedIn-scoped revenue attribution input.

This tracker is scoped to revenue attribution for LinkedIn campaigns, not the full LinkedIn Connected Platform implementation. The broader LinkedIn platform tracker remains `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md`.

## Product Rule

LinkedIn revenue must be optional, explicit, and source-scoped.

- LinkedIn spend and ad metrics can come from LinkedIn.
- LinkedIn revenue must come from a connected revenue attribution source such as CRM, ecommerce, CSV, Google Sheets, webhook conversion events, or manual entry.
- GA4 revenue must not unlock LinkedIn revenue, ROI, or ROAS unless a validated LinkedIn attribution mapping exists.
- Revenue, ROI, and ROAS must remain unavailable when no LinkedIn-scoped revenue source exists.

## Current Root Cause

The backend already has the right core pattern:

- `server/utils/linkedin-revenue.ts` is the canonical LinkedIn revenue rule helper.
- `AddRevenueWizardModal` supports `platformContext="linkedin"`.
- LinkedIn-scoped revenue sources are saved separately from GA4 revenue.
- LinkedIn revenue can be handled as either `revenue_to_date` or `conversion_value`.

The main gap is the LinkedIn Analytics Overview user journey:

- The Overview tab shows `Revenue Tracking Not Configured`.
- The current call to action routes users back to Campaign Overview instead of opening the revenue import flow directly.
- The wording does not clearly explain that users are connecting revenue attribution for LinkedIn, not importing native LinkedIn revenue.
- The production-ready path needs regression coverage proving GA4 revenue cannot leak into LinkedIn revenue.

## Production-Ready Target

LinkedIn Analytics Overview should let a user connect revenue attribution directly from the Overview tab using the same refined GA4 revenue import pattern, with LinkedIn-specific wording and strict platform scoping.

Production-ready behavior:

- `Revenue Tracking Not Configured` shows a direct LinkedIn revenue attribution action.
- Clicking the action opens the existing `AddRevenueWizardModal` with `platformContext="linkedin"`.
- The modal clearly explains the two valid LinkedIn modes:
  - Revenue to date: actual attributed revenue from CRM, ecommerce, CSV, Google Sheets, webhook, or manual source.
  - Conversion value: average value per LinkedIn conversion.
- Imported LinkedIn revenue updates LinkedIn Overview, KPI, Benchmark, Campaign DeepDive, and Custom Report consumers through the existing cache/refetch pattern.
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

### Commit 2: LinkedIn-Specific Revenue Attribution Copy

Goal:

- Make the business meaning clear for executives and operators.

Changes:

- Update LinkedIn Overview copy to explain:
  - LinkedIn provides paid-ad activity.
  - Revenue must be attributed from CRM, ecommerce, CSV, Google Sheets, webhook, or manual input.
  - ROI/ROAS unlock only after a LinkedIn-scoped revenue source is connected.
- Update modal/help text only where the existing shared wizard supports contextual copy without changing GA4 behavior.

Validation:

- LinkedIn Overview clearly says revenue attribution is not native LinkedIn revenue.
- GA4 revenue import copy remains unchanged.
- The user can understand why revenue is needed before ROI/ROAS appear.

Status:

- [ ] Pending.

### Commit 3: Confirm Revenue Source Modes

Goal:

- Ensure LinkedIn supports only the two valid source-of-truth modes.

Changes:

- Review and, only if necessary, tighten `AddRevenueWizardModal` LinkedIn mode handling:
  - `revenue_to_date`
  - `conversion_value`
- Preserve existing backend request shapes.
- Do not add new revenue modes.

Validation:

- Manual revenue-to-date can be saved for LinkedIn.
- Manual conversion value can be saved for LinkedIn.
- CSV revenue-to-date can be imported for LinkedIn.
- CSV conversion value can be imported for LinkedIn.
- Google Sheets revenue-to-date can be imported for LinkedIn.
- Google Sheets conversion value can be imported for LinkedIn.

Status:

- [ ] Pending.

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
- GA4 revenue does not unlock LinkedIn revenue metrics
- LinkedIn revenue source add/edit/delete paths update LinkedIn analytics and Campaign DeepDive consumers
- regression coverage protects the source-scoping rules
- final validation is recorded in this tracker
