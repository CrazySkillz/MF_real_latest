# Instagram Connected Platform Production-Ready Tracker

## Purpose

Track the work required to create and refine an Instagram connected platform integration to production level for both supported user paths:

- Initial campaign creation through the `Create Campaign` flow.
- Adding Instagram later from the campaign `Connected Platforms` section.

This tracker exists so Instagram follows the same source-backed connected-platform pattern used by GA4, LinkedIn, Google Ads, Meta/Facebook, and Campaign DeepDive.

## Required Product Rule

`Connected Platforms` is the source of truth.

Instagram must be treated as a campaign-scoped main paid-media connected source only after the user has explicitly connected the source and selected the Instagram-scoped account/campaign data that should feed the campaign. Campaign DeepDive, KPIs, Benchmarks, Custom Reports, scheduled reports, and any Instagram analytics page must consume Instagram through source-backed Instagram rows and the shared connected-source aggregate contract, not through placeholder values, generic campaign-level estimates, unscoped Meta values, or Instagram placement rows borrowed from a separate Meta/Facebook connection.

## Current Status

Instagram is not implemented as a first-class connected platform in the current local codebase.

Current code supports Meta/Facebook Ads and can surface Instagram placement names inside Meta analytics, but that is not the same as a standalone Instagram connected platform. There is no dedicated Instagram connection flow, route, schema table, storage method, scheduler, aggregate resolver, analytics route, report path, KPI/Benchmark platform context, or disconnect/reconnect lifecycle.

No production-ready claim can be made for Instagram until the implementation and validation items in this tracker are completed.

## Root Cause Analysis

The current gap is not one isolated UI bug. It is a missing source contract and lifecycle implementation:

- Create Campaign does not offer Instagram as a selectable platform.
- Connected Platforms does not render an Instagram card, connection status, or `View Detailed Analytics` route.
- `/api/campaigns/:id/connected-platforms` does not return an Instagram status.
- `shared/schema.ts` has no Instagram connection or daily metrics tables.
- `server/storage.ts` has no Instagram storage lifecycle methods.
- `server/routes-oauth.ts` has no Instagram OAuth/test connection, selected-campaign, analytics, refresh, revenue, KPI, Benchmark, or report route.
- `server/scheduler.ts` and platform schedulers have no Instagram refresh or snapshot input.
- `server/utils/performance-summary-aggregate.ts` can consume generic future `platformSources`, but no Instagram resolver currently supplies one.
- Revenue/spend context validation currently allows `ga4`, `linkedin`, `meta`, and `google_ads`, but not `instagram`.
- Meta/Facebook currently includes Instagram-related placement data in some contexts; promoting that data to a standalone Instagram platform without explicit source boundaries would risk double-counting and misleading source attribution.

## Existing Relevant Paths

Frontend:

- `client/src/pages/campaigns.tsx`
  - Create Campaign wizard and platform selection.
  - Currently lists GA4, Google Sheets, Facebook Ads, Google Ads, LinkedIn Ads, and X/Twitter Ads, but not Instagram.

- `client/src/pages/campaign-detail.tsx`
  - Campaign Overview and Connected Platforms section.
  - Currently renders Google Analytics, Google Sheets, Facebook Ads, Google Ads, LinkedIn Ads, and Custom Integration cards, but not Instagram.

- `client/src/App.tsx`
  - Platform analytics routes.
  - Currently has LinkedIn, Meta, and Google Ads analytics routes, but no Instagram route.

- `client/src/components/AddRevenueWizardModal.tsx`
  - Platform-scoped attributed revenue import flow.
  - Currently supports `ga4`, `linkedin`, `meta`, and `google_ads`.

- `client/src/components/AddSpendWizardModal.tsx`
  - Platform-scoped spend import flow.
  - Current ad-platform type list is LinkedIn, Meta, and Google Ads.

Server:

- `server/routes-oauth.ts`
  - Central API route file for connected platform status, OAuth/test connection routes, selected campaign routes, aggregate routes, revenue/spend routes, KPI/Benchmark routes, and report routes.

- `server/storage.ts`
  - Persistence layer for campaign source connections, daily metrics, revenue/spend records, KPIs, Benchmarks, reports, snapshots, and campaign delete cleanup.

- `server/scheduler.ts`
  - Campaign snapshot aggregation. Future Instagram rows must enter snapshots through the same source-aware aggregate contract as the UI.

- `server/report-scheduler.ts`
  - Scheduled report discovery and delivery. Instagram reports must be discoverable only after the platform report path is source-backed and campaign-access guarded.

- `server/utils/performance-summary-aggregate.ts`
  - Shared Campaign DeepDive aggregate contract. Instagram should enter through a validated generic `platformSources` resolver.

- `server/meta-scheduler.ts` and `server/services/meta-graph-api.ts`
  - Existing Meta/Facebook implementation. These may provide reusable Meta API mechanics, but Instagram must remain a separate source contract if exposed as a separate main Connected Platform.

Shared schema:

- `shared/schema.ts`
  - Authoritative schema and types. Instagram requires explicit schema support before production data can be trusted.

## Production-Ready Target Contract

Instagram is production-ready only when all of the following are true:

- The campaign has a persisted Instagram source tied to the correct campaign.
- The source stores the selected Instagram-capable account and selected Instagram campaigns or equivalent provider-scoped campaign IDs.
- The source is scoped to the current client and campaign.
- Instagram appears in `Connected Platforms` only after a valid connection and selected-campaign/import state exists.
- Source-backed Instagram rows are the only Instagram values used in Campaign Overview, Campaign DeepDive, reports, KPIs, and Benchmarks.
- Campaign DeepDive consumes Instagram through the shared aggregate contract.
- Missing Instagram metrics render as unavailable with a reason, not as invented zeroes or placeholder estimates.
- Spend, impressions, reach, clicks, conversions, CTR, CPC, CPM, frequency, CPA, and conversion rate use only valid Instagram-scoped inputs.
- Instagram attributed revenue uses only Instagram-scoped revenue sources or explicitly mapped Instagram attribution, not generic campaign revenue, GA4 revenue, Meta/Facebook revenue, or other platform revenue.
- Revenue, ROI, and ROAS are unavailable unless valid Instagram spend and valid Instagram-attributed revenue are both available.
- Scheduler refresh updates the same rows used by the UI, Campaign DeepDive, KPI/Benchmark current values, reports, and snapshots.
- Disconnect/reconnect only affects the current campaign's Instagram source and related Instagram-scoped records.
- If Meta/Facebook and Instagram are both connected, their source rows are mutually exclusive and cannot double-count the same ad delivery.
- Live API behavior is validated in a deployed or production-like environment before the live OAuth path is called production-ready.

## Source Capability Rules

Instagram may provide, when source-backed:

- impressions
- reach
- clicks or link clicks, when available from the provider response
- spend
- conversions or action-derived conversions, when available and semantically defined
- video views, engagements, placements, or creative breakdowns when available
- CTR, CPC, CPM, frequency, CPA, and conversion rate when required inputs are available
- imported Instagram-attributed revenue only when an Instagram-scoped revenue source exists
- ROAS and ROI only when valid Instagram spend and valid Instagram-attributed revenue exist

Instagram should not provide:

- GA4 users
- GA4 sessions
- GA4 pageviews
- GA4 revenue unless explicitly imported and mapped as Instagram-attributed revenue
- Meta/Facebook revenue
- LinkedIn revenue
- Google Ads conversion value
- generic campaign revenue without Instagram source provenance
- placeholder campaign-level percentage splits
- Instagram placement totals from an all-Meta source if that would double-count a separate Meta/Facebook connection

## Meta/Facebook Boundary

Instagram is commonly managed through Meta advertising infrastructure, but the product boundary must remain explicit:

- `Meta/Facebook Ads` is the existing main Connected Platform.
- `Instagram Ads`, if implemented, becomes a separate main Connected Platform only when it has its own persisted source identity and selected-source scope.
- Instagram placement rows inside Meta analytics are not enough to mark Instagram connected.
- If the implementation reuses Meta API mechanics, it must filter and persist Instagram-only rows under the Instagram source contract.
- If the product decision is to keep Instagram bundled inside Meta/Facebook Ads, do not add Instagram as a separate main Connected Platform. Instead, keep Instagram as a breakdown inside Meta analytics and update this tracker accordingly.

## Implementation Plan

### Instagram Commit 1: Documentation And Acceptance Contract

Goal:

- Establish the Instagram production-ready checklist before code changes.

Tasks:

- Create this tracker.
- Document root cause, source contract, high-risk paths, and validation evidence required.
- Confirm the product decision: standalone Instagram main Connected Platform versus Instagram as a Meta/Facebook breakdown only.

Validation:

- Tracker clearly lists Create Campaign and Connected Platforms paths.
- Tracker clearly defines the Meta/Facebook double-counting boundary.

Status:

- [x] Tracker created locally.
- [x] Product decision confirmed for tracking purposes: plan Instagram as a standalone main Connected Platform unless a later explicit product decision keeps Instagram bundled inside Meta/Facebook.
- [x] User review complete for Commit 1.

### Instagram Commit 2: Schema And Storage Foundation

Goal:

- Add the minimum persistence required for campaign-scoped Instagram source identity and daily rows.

Tasks:

- Add Instagram connection schema, daily metrics schema, insert schemas, and types in `shared/schema.ts`.
- Add storage methods in `server/storage.ts` for get/upsert/delete connection, get/upsert/delete daily metrics, selected campaign updates, and active-source checks.
- Add campaign delete cascade coverage for new Instagram campaign-scoped tables.
- Preserve existing LinkedIn, Meta, Google Ads, GA4, Custom Integration, revenue, spend, KPI, Benchmark, report, and snapshot behavior.

Validation:

- New schema shapes match existing platform conventions.
- Campaign delete cleanup includes Instagram rows and remains campaign-scoped.
- Existing platform storage tests remain unchanged.

Status:

- [ ] Not started.

### Instagram Commit 3: Connection Flow And Selected Campaign Scope

Goal:

- Create the Instagram connection/import contract used by both entry points.

Tasks:

- Add an Instagram connection flow component or narrowly scoped Meta API adapter flow.
- Support live OAuth only after official Meta/Instagram Marketing API requirements are confirmed.
- Support approved test-mode data if needed for local validation.
- Require explicit account and campaign selection.
- Persist selected Instagram campaign IDs before any source is considered connected.
- Ensure failed, cancelled, no-campaign, or token-error paths do not leave a misleading connected source.

Validation:

- Connecting with no selected Instagram campaigns cannot finalize as connected.
- Selected campaigns are persisted and visible through a status endpoint.
- Test-mode and live paths follow the same selected-source contract.

Status:

- [ ] Not started.

### Instagram Commit 4: Create Campaign Flow

Goal:

- Let users connect Instagram during initial campaign creation without creating a parallel journey.

Tasks:

- Add Instagram to the Create Campaign platform list.
- Reuse the Instagram connection flow in Step 3.
- Add finalization guard so an Instagram-selected draft cannot become active unless the Instagram source contract is complete.
- Invalidate campaign, Connected Platforms, outcome totals, Executive Summary, Trend Analysis, KPI, Benchmark, and report queries after finalization.

Validation:

- Create a new campaign.
- Select Instagram in Create Campaign.
- Connect or use approved test mode.
- Select Instagram campaigns.
- Finalize campaign.
- Confirm Connected Platforms shows Instagram connected for that campaign only.
- Confirm `/api/campaigns/:campaignId/outcome-totals` includes Instagram through `performanceSummary.sources`.

Status:

- [ ] Not started.

### Instagram Commit 5: Connected Platforms Add-Source Flow

Goal:

- Let users add Instagram later from the campaign `Connected Platforms` section using the same source contract as Create Campaign.

Tasks:

- Add Instagram to the Campaign Overview Connected Platforms card list.
- Add Instagram status to `/api/campaigns/:id/connected-platforms`.
- Render the same Instagram connection flow from the expanded card.
- Add `View Detailed Analytics` only after the source is valid and connected.
- Ensure success invalidates Connected Platforms, Instagram analytics, outcome totals, Executive Summary, Trend Analysis, KPI, Benchmark, and report queries.

Validation:

- Open an existing campaign.
- Add Instagram from Connected Platforms.
- Select account and campaigns.
- Confirm the card updates without placeholder metrics.
- Confirm Campaign DeepDive includes Instagram only where source-backed metrics exist.

Status:

- [ ] Not started.

### Instagram Commit 6: Source-Backed Campaign Overview Metrics

Goal:

- Prevent fake Instagram values from appearing in campaign overview cards.

Tasks:

- Read Instagram card metrics from the shared aggregate or Instagram daily rows.
- Show unavailable states when connected but no source-backed rows exist.
- Do not use campaign percentage splits, Meta/Facebook rows, or mock labels as production values.

Validation:

- Instagram disconnected: no Instagram metrics appear as connected values.
- Instagram connected with no rows: metrics are unavailable or zero only where zero is a real source value.
- Instagram test-mode data: card values match persisted Instagram rows.

Status:

- [ ] Not started.

### Instagram Commit 7: Instagram Analytics Page

Goal:

- Add a platform-specific Instagram analytics layer for the current campaign.

Tasks:

- Add `/campaigns/:id/instagram-analytics`.
- Build Overview and Campaign Breakdown from source-backed rows.
- Add KPI, Benchmark, Insights, and Reports tabs only where they can use source-backed values.
- Keep Instagram analytics platform-specific and campaign-scoped.
- Do not add campaign-wide DeepDive logic to this page.

Validation:

- `View Detailed Analytics` opens the Instagram analytics page for the same campaign.
- Overview totals match Instagram daily rows.
- Campaign Breakdown rows match selected Instagram campaigns only.
- Unsupported metrics show unavailable states.

Status:

- [ ] Not started.

### Instagram Commit 8: Campaign DeepDive Aggregate Resolver

Goal:

- Make Campaign DeepDive consume Instagram through the shared source contract.

Tasks:

- Add `buildInstagramPlatformSourceForAggregate(...)` in `server/routes-oauth.ts` or a narrowly scoped helper.
- Return normalized `platformSources` fields: source identity, label, category, capabilities, included metrics, excluded metric reasons, metrics, freshness, and revenue semantics.
- Wire the resolver into `/api/campaigns/:id/outcome-totals`.
- Wire the same resolver into `/api/campaigns/:id/executive-summary`.
- Wire scheduler snapshots to the same source composition.

Validation:

- Instagram-only campaign includes one Instagram paid-media source.
- GA4 + Instagram campaign includes GA4 and Instagram once each.
- Meta + Instagram campaign does not double-count the same provider rows.
- Disconnected Instagram does not appear in aggregate sources.

Status:

- [ ] Not started.

### Instagram Commit 9: Revenue, Spend, And Derived Metric Semantics

Goal:

- Make Instagram financial metrics accurate and source-scoped.

Tasks:

- Extend platform context validation to include `instagram` only after Instagram connection/storage exists.
- Add Instagram-scoped revenue source handling for manual, CSV, Google Sheets, HubSpot, Salesforce, and Shopify paths if attributed revenue is in scope.
- Add exact or explicitly mapped Instagram campaign attribution before showing per-campaign revenue.
- Ensure ROI, ROAS, Profit, and CPA use only valid Instagram spend plus valid Instagram-attributed revenue/conversions.
- Preserve GA4, LinkedIn, Meta, and Google Ads revenue isolation.

Validation:

- Instagram spend-only campaign shows paid-media metrics but no revenue-derived ROI/ROAS.
- Instagram campaign with valid attributed revenue shows revenue, ROI, and ROAS.
- GA4, Meta, LinkedIn, and Google Ads revenue do not unlock Instagram revenue metrics.
- Multiple Instagram revenue sources sum only within the Instagram platform context.

Status:

- [ ] Not started.

### Instagram Commit 10: Scheduler And Freshness Hardening

Goal:

- Make scheduled refresh update the same rows consumed by UI, aggregate, reports, KPI, and Benchmark logic.

Tasks:

- Add or extend scheduler behavior for Instagram.
- Fail closed when campaign, connection, account, token, selected campaigns, or provider scope is invalid.
- Preserve selected-campaign filtering.
- Upsert daily rows without duplicates.
- Keep previous valid values when refresh fails.
- Add freshness metadata to the aggregate source.

Validation:

- Manual refresh updates Instagram rows.
- Scheduled refresh updates the same rows.
- Missing selected campaigns skips refresh instead of importing all account campaigns.
- Failed refresh does not overwrite valid metrics with misleading zeroes.

Status:

- [ ] Not started.

### Instagram Commit 11: Disconnect, Reconnect, And Stale Data Safety

Goal:

- Prevent stale Instagram data after disconnect/reconnect.

Tasks:

- Add campaign-access-guarded Instagram disconnect route.
- Remove or exclude only the current campaign's Instagram connection, daily rows, Instagram spend rows, and Instagram-scoped revenue records.
- Ensure disconnect removes Instagram from Connected Platforms, aggregate outputs, KPI/Benchmark current values, and report source lists.
- Ensure reconnect starts from the new selected source contract.
- Add cleanup plan only if existing damaged Instagram-like records are proven.

Validation:

- Disconnect Instagram from one campaign.
- Confirm unrelated campaigns and Meta/Facebook sources are unchanged.
- Confirm Campaign DeepDive no longer includes Instagram.
- Reconnect and confirm old rows do not reappear unless they belong to the active selected Instagram source.

Status:

- [ ] Not started.

### Instagram Commit 12: KPI, Benchmark, Reports, And Scheduled Output Parity

Goal:

- Make Instagram compatible with platform KPI, Benchmark, Custom Report, and scheduled report workflows.

Tasks:

- Use shared platform KPI routes for `platformType="instagram"` where safe.
- Use shared platform Benchmark routes for `platformType="instagram"` where safe.
- Use shared platform Report routes for `platformType="instagram"` where safe.
- Ensure report scheduler discovers Instagram reports only after PDFs are source-backed and campaign-access guarded.
- Ensure direct snapshot/download routes verify campaign-platform consistency.

Validation:

- Instagram KPI create/edit/delete uses source-backed current values.
- Instagram Benchmark create/edit/delete uses source-backed current values.
- Instagram report create/update/delete returns accurate success/failure.
- Standard and scheduled report PDFs render latest Instagram-backed values.
- Scheduled report sends do not create snapshots on failed sends.

Status:

- [ ] Not started.

### Instagram Commit 13: Regression Coverage And Final Evidence

Goal:

- Prove Instagram production readiness with automated tests and user/browser validation.

Tasks:

- Add regression coverage for Create Campaign flow.
- Add regression coverage for Connected Platforms add-source flow.
- Add regression coverage for source-backed aggregate inclusion.
- Add regression coverage for Meta + Instagram no-double-counting.
- Add regression coverage for spend-only and revenue-attributed financial states.
- Add regression coverage for scheduler fail-closed behavior.
- Add regression coverage for disconnect/reconnect stale-data exclusion.
- Add regression coverage for KPI/Benchmark/report source safety.
- Record deployed or production-like live OAuth evidence before calling live Instagram production-ready.

Validation:

- Local tests pass.
- Browser validation passes for Create Campaign and Connected Platforms.
- Deployed or production-like validation proves live OAuth, account discovery, campaign discovery, selected-campaign import, refresh, and report output.

Status:

- [ ] Not started.

## Validation Checklist

### Create Campaign Flow

- [ ] Start a new campaign.
- [ ] Select Instagram during campaign creation.
- [ ] Authenticate or use approved test mode.
- [ ] Select Instagram account.
- [ ] Select Instagram campaigns.
- [ ] Complete import/initial refresh.
- [ ] Finalize campaign.
- [ ] Confirm Instagram appears in Connected Platforms with a blue connected badge.
- [ ] Confirm `View Detailed Analytics` opens Instagram analytics for the same campaign.
- [ ] Confirm `/api/campaigns/:campaignId/outcome-totals` includes Instagram once.
- [ ] Confirm Campaign DeepDive uses only available Instagram metrics.

### Connected Platforms Flow

- [ ] Open an existing campaign.
- [ ] Add Instagram from Connected Platforms.
- [ ] Authenticate or use approved test mode.
- [ ] Select Instagram account.
- [ ] Select Instagram campaigns.
- [ ] Complete import/initial refresh.
- [ ] Confirm Connected Platforms updates without fake metrics.
- [ ] Confirm Campaign DeepDive sections update.
- [ ] Confirm Custom Report output updates.

### Multi-Source Flow

- [ ] Connect GA4 and Instagram to the same campaign.
- [ ] Confirm GA4 contributes web analytics and outcome metrics.
- [ ] Confirm Instagram contributes paid-media metrics.
- [ ] Connect Meta/Facebook and Instagram to the same campaign.
- [ ] Confirm Meta/Facebook and Instagram source rows are mutually exclusive.
- [ ] Confirm no double-counting in Performance Summary, Platform Comparison, Trend Analysis, Executive Summary, and Custom Report.

### Financial Flow

- [ ] Instagram spend-only campaign does not show revenue-derived ROI/ROAS.
- [ ] Instagram with valid attributed revenue shows revenue, Profit, ROI, and ROAS where supported.
- [ ] Instagram revenue sources are isolated by `platformContext="instagram"`.
- [ ] GA4, Meta, LinkedIn, and Google Ads revenue cannot unlock Instagram revenue metrics.
- [ ] Per-campaign Instagram revenue appears only from exact IDs or explicit mappings.

### Lifecycle Flow

- [ ] Manual refresh updates current Instagram rows.
- [ ] Scheduler refresh updates the same rows.
- [ ] Failed refresh keeps previous valid values and records failure/freshness state.
- [ ] Disconnect removes Instagram from Connected Platforms and aggregate outputs.
- [ ] Reconnect does not resurrect stale rows from an old source contract.
- [ ] Campaign deletion removes only that campaign's Instagram rows and does not affect unrelated campaigns.

## Production-Ready Exit Criteria

Instagram can be marked production-ready only when:

- Create Campaign flow is implemented and validated.
- Connected Platforms add-source flow is implemented and validated.
- Source-backed Instagram rows are the only source of Instagram metrics.
- Campaign DeepDive consumes Instagram through the shared aggregate contract.
- Scheduler snapshots include Instagram through the same source composition as `/outcome-totals`.
- KPI and Benchmark current values are source-backed and campaign-scoped.
- Standard and scheduled reports use latest Instagram-backed values.
- Revenue, ROI, ROAS, CPA, and Profit are source-scoped and unavailable when required inputs are missing.
- Disconnect/reconnect behavior is campaign-scoped and stale-data safe.
- Meta/Facebook plus Instagram no-double-counting behavior is proven.
- Regression tests cover critical lifecycle paths.
- Live OAuth/API behavior has deployed or production-like evidence before the live path is called production-ready.

## Current Evidence Map

Proven:

- The existing architecture requires new main Connected Platforms to plug into Campaign DeepDive through the shared connected-source aggregate contract.
- The current aggregate can consume generic future `platformSources`.
- The current Create Campaign and Connected Platforms paths do not expose Instagram.
- The current schema/storage/scheduler/report paths do not include Instagram lifecycle support.
- Meta/Facebook currently has Instagram-related placement concepts, but not a standalone Instagram source contract.

Partially reviewed:

- Create Campaign platform list and connector rendering.
- Campaign Overview Connected Platforms cards.
- Connected Platforms status endpoint.
- Shared aggregate helper.
- Revenue/spend platform context allowlists.
- Existing Meta, LinkedIn, and Google Ads tracker patterns.

Unverified:

- Official current Meta/Instagram Marketing API requirements, scopes, account discovery, and Instagram-only filtering details.
- Whether product wants standalone Instagram or Instagram as a Meta/Facebook breakdown only.
- Live OAuth behavior.
- Provider rate limits, token lifetime, and permission review requirements.
- Full report scheduler behavior for a new Instagram platform.

## Outstanding Items

Implementation:

- [ ] Confirm product decision: standalone Instagram main platform versus Meta/Facebook breakdown.
- [ ] Confirm official API requirements from current Meta/Instagram docs.
- [ ] Add schema/storage foundation.
- [ ] Add connection flow.
- [ ] Add Create Campaign integration.
- [ ] Add Connected Platforms integration.
- [ ] Add Instagram analytics page.
- [ ] Add aggregate resolver.
- [ ] Add revenue/spend context.
- [ ] Add scheduler.
- [ ] Add disconnect/reconnect cleanup.
- [ ] Add KPI/Benchmark/report parity.
- [ ] Add regression coverage.

Evidence:

- [ ] Local test-mode Create Campaign validation.
- [ ] Local test-mode Connected Platforms validation.
- [ ] Local Campaign DeepDive aggregate validation.
- [ ] Local Meta + Instagram no-double-counting validation.
- [ ] Local scheduler validation.
- [ ] Local report validation.
- [ ] Deployed or production-like live OAuth validation.

## Relevant Documentation

- `AGENTS.md`
- `ARCHITECTURE_USER_JOURNEY.md`
- `GA4/README.md`
- `GA4_DEVELOPMENT_WORKFLOW.md`
- `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_BUDGET_FINANCIAL_ANALYSIS_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_PLATFORM_COMPARISON_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_CUSTOM_REPORT_PRODUCTION_READY.md`
- `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `META_FACEBOOK_CONNECTED_PLATFORM_PRODUCTION_READY.md`
