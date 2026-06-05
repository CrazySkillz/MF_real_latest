# Instagram Connected Platform Production-Ready Tracker

## Purpose

Track the work required to create and refine an Instagram connected platform integration to production level for both supported user paths:

- Initial campaign creation through the `Create Campaign` flow.
- Adding Instagram later from the campaign `Connected Platforms` section.

This tracker exists so Instagram follows the same source-backed connected-platform pattern used by GA4, LinkedIn, Google Ads, Meta/Facebook, and Campaign DeepDive.

## Commit Tracker

This table is the single source of truth for what is done, pending, and where each future change belongs. If a future finding requires splitting or adding a commit, the new subcommit must be added here before implementation starts.

| Commit | Scope | Status | Runtime/UI exposure |
| --- | --- | --- | --- |
| 1 | Documentation and acceptance contract | Done and pushed; user validation passed | None |
| 2 | API/source-contract research and local design trace | Done and pushed; user validation passed | None |
| 3 | Schema/storage foundation and migration | Done and pushed; user validation pending | None |
| 4A | Read-only Instagram connection/status route | Done and pushed; user validation passed by local checks | Backend route only; no UI |
| 4B | Backend test-mode connection route requiring selected Instagram campaigns | Done and pushed; user validation passed by local checks | Backend route only; no UI |
| 4C | Backend selected-campaign update route for an existing connection | Done and pushed; user validation passed by local checks | Backend route only; no UI |
| 4D | Backend disconnect route | Done and pushed; user validation passed by local checks | Backend route only; no UI |
| 4E | Backend Instagram campaign-list/selector contract | Done and pushed; user validation passed by local checks | Backend route only; no UI |
| 4F | Commit 4 backend contract finalization and validation docs | Done and pushed; user validation passed | None |
| 5A | Create Campaign platform option only, disabled/hidden behind backend readiness guard if needed | Done and pushed; user validation passed | Create Campaign UI option only |
| 5B | Create Campaign uses existing backend test connection contract without finalizing campaign analytics | Done and pushed; user validation passed | Create Campaign connection step |
| 5C | Create Campaign selected-campaign validation and finalization guard | Done and pushed; user validation passed | Create Campaign finalization guard |
| 5D | Create Campaign query invalidation after successful Instagram setup | Done and pushed; user validation passed | Create Campaign cache behavior |
| 5E | Create Campaign regression and validation docs | Done and pushed; user validation passed | None |
| 6A | Connected Platforms status endpoint includes Instagram status from source contract | Done and pushed; user validation pending | Backend status payload used by UI |
| 6B | Connected Platforms Instagram card shell with no placeholder metrics | Done and pushed; user validation pending | Connected Platforms UI card |
| 6C | Connected Platforms add-source flow opens existing Instagram setup contract | Done and pushed; user validation pending | Connected Platforms setup UI |
| 6D | Connected Platforms success/error/empty states and query invalidation | Done and pushed; user validation pending | Connected Platforms UI state |
| 6E | Connected Platforms regression and validation docs | Done and pushed; user validation pending | None |
| 6F | Connected Platforms disconnect UI route mapping | Implemented locally; user validation pending | Connected Platforms disconnect action |
| 7A | Campaign Overview reads Instagram connection/source status only | Pending | Overview source status |
| 7B | Campaign Overview unavailable metric states for connected-without-rows | Pending | Overview metric states |
| 7C | Campaign Overview source-backed metrics from Instagram daily rows only | Pending | Overview metrics |
| 7D | Campaign Overview regression and validation docs | Pending | None |
| 8A | Instagram analytics route shell and access guard | Pending | Instagram analytics page route |
| 8B | Instagram analytics daily metrics endpoint | Pending | Backend analytics data route |
| 8C | Instagram analytics Overview tab from source-backed rows | Pending | Analytics UI |
| 8D | Instagram analytics Campaign Breakdown tab from selected campaign rows | Pending | Analytics UI |
| 8E | Instagram analytics unavailable/error/freshness states | Pending | Analytics UI state |
| 8F | Instagram analytics regression and validation docs | Pending | None |
| 9A | Instagram aggregate resolver reads only `instagram_daily_metrics` | Pending | Campaign DeepDive backend aggregate |
| 9B | Instagram aggregate capabilities and unavailable-reason contract | Pending | Campaign DeepDive source contract |
| 9C | Meta/Facebook plus Instagram no-double-counting guard | Pending | Campaign DeepDive source safety |
| 9D | Campaign DeepDive consumers accept Instagram through existing `platformSources` contract | Pending | Campaign DeepDive UI values |
| 9E | Campaign DeepDive regression and validation docs | Pending | None |
| 10A | Add `instagram` platform context allowlist only where storage/source proof exists | Pending | Financial import backend |
| 10B | Instagram spend import/edit source identity uses `instagram_api` only | Pending | Spend import path |
| 10C | Instagram attributed revenue import/edit source identity uses `platformContext="instagram"` only | Pending | Revenue import path |
| 10D | Revenue/spend regression and validation docs | Pending | None |
| 11A | Instagram provider/client adapter research refresh before live behavior | Pending | None |
| 11B | Test-mode Instagram daily metric generation behind explicit refresh only | Pending | Backend refresh route |
| 11C | Manual refresh route imports selected Instagram-only rows | Pending | Backend refresh route |
| 11D | Scheduler refresh skips missing, spend-only, invalid, or unselected-source campaigns | Pending | Background refresh |
| 11E | Scheduler snapshot integration uses same aggregate contract as UI | Pending | Background snapshots |
| 11F | Scheduler/refresh regression and validation docs | Pending | None |
| 12A | Backend disconnect route and storage cleanup proof | Pending after 4D if 4D is not enough | Backend lifecycle route |
| 12B | Reconnect stale-row safety and selected-scope replacement proof | Pending | Backend lifecycle behavior |
| 12C | Existing damaged-data cleanup plan if stale Instagram rows can exist | Pending | Data cleanup plan only unless needed |
| 12D | Lifecycle regression and validation docs | Pending | None |
| 13A | Instagram KPI current-value source contract | Pending | KPI backend/UI |
| 13B | Instagram Benchmark current-value source contract | Pending | Benchmark backend/UI |
| 13C | Instagram report route/source contract | Pending | Report backend/UI |
| 13D | Instagram scheduled report snapshot/send guard | Pending | Scheduled reports |
| 13E | Instagram PDF/export output source proof | Pending | Report exports |
| 13F | KPI/Benchmark/Report regression and validation docs | Pending | None |
| 14A | End-to-end local test-mode Create Campaign validation | Pending | Validation only |
| 14B | End-to-end local test-mode Connected Platforms validation | Pending | Validation only |
| 14C | Local Meta/Facebook plus Instagram no-double-counting validation | Pending | Validation only |
| 14D | Production-like or deployed live OAuth/API validation | Pending | Validation only |
| 14E | Final production-ready evidence update | Pending | Documentation only |

Commit 4 is intentionally split into backend-only subcommits because this area is analytics-sensitive. No Commit 4 subcommit should expose Instagram in Create Campaign, Connected Platforms, Campaign DeepDive, reports, scheduler, revenue, KPIs, or Benchmarks.

## Required Product Rule

`Connected Platforms` is the source of truth.

Instagram must be treated as a campaign-scoped main paid-media connected source only after the user has explicitly connected the source and selected the Instagram-scoped account/campaign data that should feed the campaign. Campaign DeepDive, KPIs, Benchmarks, Custom Reports, scheduled reports, and any Instagram analytics page must consume Instagram through source-backed Instagram rows and the shared connected-source aggregate contract, not through placeholder values, generic campaign-level estimates, unscoped Meta values, or Instagram placement rows borrowed from a separate Meta/Facebook connection.

## Current Status

Instagram is not implemented as a first-class connected platform in the current local codebase.

Current code supports Meta/Facebook Ads and can surface Instagram placement names inside Meta analytics, but that is not the same as a standalone Instagram connected platform. There is no dedicated Instagram connection flow, route, schema table, storage method, scheduler, aggregate resolver, analytics route, report path, KPI/Benchmark platform context, or disconnect/reconnect lifecycle.

No production-ready claim can be made for Instagram until the implementation and validation items in this tracker are completed.

Commit 1 documentation and acceptance-contract validation passed after user review.

Commit 2 API/source-contract research and local design trace passed user validation.

Commit 3 schema/storage foundation is implemented locally using the source boundary documented below.

Commit 4A read-only backend connection/status route is implemented locally. No runtime Instagram UI, write connection flow, refresh route, scheduler, aggregate, revenue, KPI, Benchmark, or report behavior exists yet.

Commit 4B backend test-mode connection route is implemented locally. It requires explicit selected Instagram campaign IDs before replacing a campaign-scoped Instagram source and does not refresh, seed, aggregate, expose UI, or call live OAuth.

Commit 4C backend selected-campaign update route is implemented locally. It requires an existing Instagram connection and a non-empty selected campaign list, clears Instagram daily rows only when the selected scope changes, and still does not expose UI, refresh, aggregate, or live OAuth behavior.

Commit 4D backend disconnect route is implemented locally. It requires campaign access, fails closed when no Instagram connection exists, deletes via storage cleanup, and still does not expose UI, refresh, aggregate, or live OAuth behavior.

Commit 4E backend campaign-list/selector contract is implemented locally. It lists only the persisted selected Instagram campaign IDs from the source contract and does not discover live provider campaigns, mutate storage, refresh, aggregate, or expose UI behavior.

Commit 4F backend contract finalization is done, pushed, and user-validated. It documents the completed backend-only Commit 4 boundary, validation evidence, and the remaining no-UI/no-runtime exposure guarantees before Create Campaign work begins.

Commit 5A Create Campaign platform option is implemented locally. It added Instagram to the Create Campaign platform list before Commit 5B enabled the test setup path.

Commit 5B Create Campaign test setup is implemented locally. Instagram can enter Step 3 and connect only through `/api/instagram/:campaignId/connect-test` with selected campaign IDs; it still does not add analytics, aggregate, reports, scheduler, revenue, KPI, Benchmark, or live OAuth behavior.

Commit 5C Create Campaign finalization guard is implemented locally. When Instagram is selected, Step 5 now verifies the persisted Instagram connection through `/api/instagram/:campaignId/connection` and blocks activation unless the connection is present with at least one selected Instagram campaign ID.

Commit 5C startup migration correction is done and pushed. The Create Campaign test route failed with `relation "instagram_connections" does not exist` because the SQL migration file existed but the app's inline startup migration block did not create the Instagram tables for the active database.

Commit 5D Create Campaign query invalidation is done, pushed, and user-validated. After successful finalization, the Create Campaign flow invalidates campaign-scoped connected platform, outcome totals, Executive Summary, Trend Analysis, KPI, Benchmark, and all-data-source queries so stale source-dependent data is not retained after an Instagram connection is added.

Commit 5E Create Campaign closeout is done, pushed, and user-validated. It documents the completed Commit 5 boundary: Instagram can be connected during Create Campaign through the test source contract and finalized with source validation/cache invalidation, but analytics aggregation, Campaign DeepDive source cards, reports, scheduler, revenue, KPI, and Benchmark behavior remain future commits.

Commit 6A Connected Platforms status endpoint is done and pushed. `/api/campaigns/:id/connected-platforms` now includes Instagram status from the persisted Instagram source contract only, requires a non-empty selected campaign scope, and intentionally returns no analytics path until the Instagram analytics/aggregate phases are implemented.

Commit 6B Connected Platforms card shell is done and pushed. Campaign Detail renders an Instagram Ads card from the connected-platforms status map, with no placeholder metrics and no analytics link.

Commit 6C Connected Platforms add-source setup is done and pushed. The Instagram Ads card can open a minimal test setup form that calls only `POST /api/instagram/:campaignId/connect-test` with explicit selected Instagram campaign IDs.

Commit 6D Connected Platforms state/invalidation is done and pushed. Instagram setup now uses a dedicated campaign-scoped invalidation helper after success and keeps empty selected-campaign input plus backend errors in destructive toast states.

Commit 6E Connected Platforms closeout is done and pushed. It documents the completed Commit 6 boundary: Instagram can be surfaced and connected from Connected Platforms through the test source contract, but analytics pages, Campaign DeepDive aggregation, refresh, reports, revenue, KPI, and Benchmark behavior remain future commits.

Commit 6F Connected Platforms disconnect UI route mapping is implemented locally. It maps the existing shared disconnect action for `Instagram Ads` to the already campaign-access-guarded backend `DELETE /api/instagram/:campaignId/connection` route and invalidates the Instagram connection query after success; it does not add analytics, refresh, aggregate, reports, revenue, KPI, Benchmark, or live OAuth behavior.

## Root Cause Analysis

The current gap is not one isolated UI bug. It is a missing source contract and lifecycle implementation:

- Create Campaign does not offer Instagram as a selectable platform.
- Connected Platforms does not render an Instagram card, connection status, or `View Detailed Analytics` route.
- `/api/campaigns/:id/connected-platforms` does not return an Instagram status.
- Before Commit 3, `shared/schema.ts` had no Instagram connection or daily metrics tables; Commit 3 adds the inert schema foundation.
- Before Commit 3, `server/storage.ts` had no Instagram storage lifecycle methods; Commit 3 adds storage methods without UI, scheduler, or aggregate callers.
- Before Commit 4A, `server/routes-oauth.ts` had no Instagram connection/status route; Commit 4A adds a read-only status route.
- Before Commit 4B, there was no backend write path to create an Instagram source contract row; Commit 4B adds a test-mode-only route that requires selected campaigns before writing and still adds no live OAuth, analytics, refresh, revenue, KPI, Benchmark, or report route.
- Before Commit 4C, selected Instagram campaign scope could only be set by replacing the whole test connection; Commit 4C adds a backend selected-campaign update route for an existing connection and clears stale Instagram daily rows when that scope changes.
- Before Commit 4D, there was no backend disconnect route for the Instagram source contract; Commit 4D adds a campaign-access-guarded disconnect route that delegates source and daily-row cleanup to storage.
- Before Commit 4E, there was no backend route that returned selector-ready Instagram campaign scope; Commit 4E adds a read-only campaign list from persisted selected campaign IDs only.
- Before Commit 4F, the backend-only Commit 4 route contract was implemented but not explicitly closed in the tracker; Commit 4F records the completed backend boundary and remaining exclusions.
- Before Commit 5A, Create Campaign did not show Instagram at all; Commit 5A added a disabled option only.
- Before Commit 5B, the Create Campaign Instagram option could not enter setup; Commit 5B adds a test-mode setup path using the backend source contract without analytics/runtime exposure.
- Before Commit 5C, Create Campaign finalization trusted the wizard's in-memory connected platform list and did not re-check the persisted Instagram source contract; Commit 5C adds a read-only finalization guard before activating the draft.
- The first 5C browser validation exposed a startup migration gap: `instagram_connections` and `instagram_daily_metrics` existed in `shared/schema.ts` and `migrations/0007_add_instagram_connected_platform_foundation.sql`, but not in the inline startup migrations in `server/index.ts`. Because this app runs those inline startup migrations for the active database, the backend route reached storage before the tables existed.
- Before Commit 5D, Create Campaign finalization invalidated campaigns, connected platforms, outcome totals, one Executive Summary key, and LinkedIn imports, but did not invalidate the other campaign-scoped source-dependent keys used by Trend Analysis, KPIs, Benchmarks, reports, and all-data-source surfaces.
- Before Commit 5E, the Create Campaign validation text incorrectly included confirming Instagram in `/api/campaigns/:campaignId/outcome-totals` through `performanceSummary.sources`, even though Instagram aggregate resolution is explicitly deferred to Commit 9. Commit 5E corrects the acceptance boundary so validation does not imply unimplemented analytics behavior.
- Before Commit 6A, Connected Platforms could not report an existing Instagram source because `/api/campaigns/:id/connected-platforms` did not read `instagram_connections`. Commit 6A adds a backend status payload only, without rendering a new card or enabling analytics.
- Before Commit 6B, the backend Instagram status from Commit 6A had no Campaign Detail card shell. Commit 6B adds the card shell only and kept analytics/setup behavior unavailable until Commit 6C.
- Before Commit 6C, the Instagram card could not connect Instagram later from Connected Platforms. Commit 6C opens the same test source-contract setup path without adding live OAuth, analytics, refresh, or aggregate behavior.
- Before Commit 6D, successful Instagram setup from Connected Platforms invalidated only the platform status and Instagram connection query, leaving source-dependent campaign queries potentially stale. Commit 6D broadens invalidation without adding new data paths.
- Before Commit 6E, the Commit 6 validation text still implied Instagram analytics and Campaign DeepDive source-backed confirmation, even though those are explicitly later commits. Commit 6E corrects the Connected Platforms acceptance boundary.
- Before Commit 6F, the shared Connected Platforms disconnect handler did not include an `Instagram Ads` route mapping, so disconnecting Instagram fell through to the generic unsupported-platform toast even though the backend disconnect route already existed. Commit 6F maps only that UI branch to the existing guarded Instagram route.
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

## Commit 2 API And Local Design Trace

### External API Research Result

Official Meta documentation references for implementation:

- Meta Marketing API Insights: `https://developers.facebook.com/docs/marketing-api/insights`
- Meta Marketing API Insights Breakdowns: `https://developers.facebook.com/docs/marketing-api/insights/breakdowns/`
- Meta Marketing API Insights Parameters: `https://developers.facebook.com/docs/marketing-api/insights/parameters/`
- Meta Marketing API Authorization: `https://developers.facebook.com/docs/marketing-api/get-started/authorization/`
- Meta Marketing API ad object insights reference: `https://developers.facebook.com/docs/marketing-api/reference/adgroup/insights`

Findings:

- Meta's Insights API is the relevant data source for paid Instagram ad delivery because Instagram ads are delivered through Meta ad infrastructure.
- The relevant segmentation fields for separating Instagram delivery from other Meta delivery are `publisher_platform` and `platform_position`.
- Third-party docs and examples that point back to Meta's official Insights docs use platform breakdown requests such as `publisher_platform`, `platform_position`, and `impression_device`.
- Current local code already calls the Meta Insights endpoint with `breakdowns: 'publisher_platform,platform_position'` in `MetaGraphAPIClient.getPlacementInsights`.
- Current local code does not persist those placement breakdown rows as a standalone source. They are only used as Meta analytics breakdowns.
- Because direct official docs access can be unstable in this environment, live implementation must re-check the exact current Meta API version, allowed breakdown combinations, field compatibility, and permission requirements before live OAuth is called production-ready.

### Local Code Trace Result

Reusable with care:

- `server/services/meta-graph-api.ts`
  - `MetaGraphAPIClient` already handles Meta API requests, token errors, permission errors, rate-limit errors, campaign discovery, daily campaign insights, and placement insights.
  - `getPlacementInsights` already requests `publisher_platform,platform_position` and materializes `publisherPlatform`, `platformPosition`, impressions, clicks, spend, conversion-like actions, and raw actions.

- `server/meta-scheduler.ts`
  - Existing selected-campaign guard pattern is useful: skip refresh when selected campaign IDs are missing.
  - Existing fail-closed pattern is useful: selected IDs that no longer exist should not import all account campaigns.
  - Existing upsert and refresh timestamp pattern is useful.

- `server/routes-oauth.ts`
  - Existing selected-campaign route pattern is useful.
  - Existing daily-metrics route pattern is useful.
  - Existing ad-platform spend import route needs future extension only after Instagram daily rows exist.

Not safe to reuse directly:

- `meta_daily_metrics` rows are campaign-level Meta rows and are not currently guaranteed to be Instagram-only.
- Existing Meta aggregate logic can include all selected Meta campaign delivery and therefore may include Facebook plus Instagram together.
- Existing Meta spend records use `sourceType: 'meta_api'`; Instagram must use its own source identity, such as `instagram_api`, to avoid stale or cross-platform spend provenance.
- Existing Meta revenue context is `platformContext="meta"`; Instagram attributed revenue must use `platformContext="instagram"` only after platform context validation is extended.

### Future `instagram_connections` Fields

Minimum planned fields for Commit 3:

- `id`
- `campaignId`
- `adAccountId`
- `adAccountName`
- `accessToken`
- `refreshToken`
- `encryptedTokens`
- `method`
- `selectedCampaignIds`
- `campaignUtmMap`
- `publisherPlatformFilter`
- `sourceContractVersion`
- `lastRefreshAt`
- `spendOnly`
- `expiresAt`
- `connectedAt`
- `createdAt`

Field meanings:

- `selectedCampaignIds` stores the Meta campaign IDs selected for the standalone Instagram source.
- `publisherPlatformFilter` must be fixed to `instagram` for the standalone Instagram source contract.
- `sourceContractVersion` identifies the source contract used to materialize rows, starting with a value such as `instagram_publisher_platform_v1`.
- `campaignUtmMap` follows the existing source-to-GA4 matching pattern, but must map Instagram selected campaign IDs only.

### Future `instagram_daily_metrics` Fields

Minimum planned fields for Commit 3:

- `id`
- `campaignId`
- `instagramCampaignId`
- `instagramCampaignName`
- `date`
- `publisherPlatform`
- `platformPosition`
- `impressions`
- `clicks`
- `spend`
- `conversions`
- `actions`
- `videoViews`
- `ctr`
- `cpc`
- `cpm`
- `costPerConversion`
- `conversionRate`
- `ga4Revenue`
- `ga4UtmName`
- `importedAt`

Field meanings:

- `publisherPlatform` must be persisted and must equal `instagram` for rows accepted into the Instagram source contract.
- `platformPosition` is persisted for provenance and future placement breakdowns.
- `actions` preserves provider action rows for auditability because conversion semantics are action-derived.
- `ga4Revenue` and `ga4UtmName` remain nullable and can be used only after a future explicit Instagram attribution/enrichment path is implemented.
- Reach, frequency, CPP, and other Meta-only or broad delivery metrics remain unavailable for Instagram until proven available at the same Instagram-only source scope.

### No-Double-Counting Rule

Implementation-ready rule:

- Instagram standalone source rows must be materialized only from provider rows where `publisher_platform` is exactly `instagram`.
- Meta/Facebook source rows must not be combined with Instagram standalone rows unless Meta/Facebook rows are also filtered to exclude `publisher_platform=instagram`.
- If Meta/Facebook cannot be filtered to exclude Instagram at the same metric/date/campaign scope, then shared aggregate consumers must treat Meta/Facebook and Instagram as overlapping sources and must fail closed for combined paid-media totals rather than double-count.
- In a campaign with both Meta/Facebook and Instagram connected, the aggregate is trusted only when both source resolvers can prove mutually exclusive row scopes.
- Existing Meta analytics may continue to show Instagram placements as Meta breakdown rows, but those rows do not make Instagram a main Connected Platform and must not feed the standalone Instagram aggregate unless they are persisted under the Instagram source contract.

### Commit 3 Smallest Schema/Storage Slice

The next code-bearing commit should only add schema and storage foundations:

- Add `instagram_connections`.
- Add `instagram_daily_metrics`.
- Add insert schemas and select/insert types.
- Add storage interface and implementation methods for get/upsert/update/delete connection and get/upsert/delete daily rows.
- Add campaign delete cleanup coverage.
- Do not expose Instagram in Create Campaign.
- Do not expose Instagram in Connected Platforms.
- Do not add routes, schedulers, aggregate resolvers, revenue context, or UI behavior yet.

## Commit Details

These sections provide acceptance criteria for commits listed in the top Commit Tracker. The table above remains the only place to track overall status.

### Details For Commit 1: Documentation And Acceptance Contract

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

### Details For Commit 2: API Source Contract And Local Design Trace

Goal:

- Prove the exact Instagram source boundary before adding persistence or runtime behavior.

Root cause:

- Instagram likely depends on Meta Marketing API mechanics, but a standalone Instagram main Connected Platform cannot safely reuse all Meta/Facebook ad data.
- The current codebase already has Meta/Facebook analytics that can include Instagram placement rows.
- Adding Instagram schema or UI before proving provider filters, source identity, and no-double-counting rules would risk persisting ambiguous data and misleading campaign metrics.

Tasks:

- Verify official current Meta/Instagram Marketing API requirements, scopes, account discovery, campaign discovery, insights fields, and Instagram-only filtering behavior.
- Prove whether Instagram-only paid delivery can be filtered reliably from provider responses, such as by publisher platform, platform position, placement, account/campaign scope, or another official field.
- Trace existing Meta/Facebook code paths that may be reusable without changing their current behavior.
- Decide the exact persisted source identity fields for future `instagram_connections`.
- Decide the exact persisted daily-row fields for future `instagram_daily_metrics`.
- Document how Instagram selected campaigns will be represented and validated.
- Document the Meta/Facebook plus Instagram no-double-counting rule before any migration or code change.
- Identify the smallest schema/storage slice for Commit 3.

Validation:

- Official API references are recorded in this tracker or a linked companion note.
- The planned `instagram_connections` and `instagram_daily_metrics` fields are listed before implementation.
- The Meta/Facebook no-double-counting boundary is documented in implementation-ready terms.
- No schema, storage, route, scheduler, or UI behavior is changed in this commit.

Status:

- [x] Completed locally: official Meta API references recorded.
- [x] Completed locally: local Meta API and scheduler reuse boundaries traced.
- [x] Completed locally: future `instagram_connections` fields documented.
- [x] Completed locally: future `instagram_daily_metrics` fields documented.
- [x] Completed locally: Meta/Facebook plus Instagram no-double-counting rule documented.
- [x] Completed locally: Commit 3 smallest schema/storage slice identified.
- [x] User validation passed for Commit 2.

### Details For Commit 3: Schema And Storage Foundation

Goal:

- Add the minimum persistence required for campaign-scoped Instagram source identity and daily rows.

Tasks:

- Add Instagram connection schema, daily metrics schema, insert schemas, and types in `shared/schema.ts`.
- Add storage methods in `server/storage.ts` for get/create/update/delete connection and get/upsert/delete daily metrics.
- Add campaign delete cascade coverage for new Instagram campaign-scoped tables.
- Add a deployable migration for the new Instagram tables and daily-row uniqueness.
- Preserve existing LinkedIn, Meta, Google Ads, GA4, Custom Integration, revenue, spend, KPI, Benchmark, report, and snapshot behavior.

Validation:

- New schema shapes match existing platform conventions.
- Campaign delete cleanup includes Instagram rows and remains campaign-scoped.
- Existing platform storage tests remain unchanged.

Status:

- [x] Implemented locally: `instagram_connections` schema, insert schema, and types.
- [x] Implemented locally: `instagram_daily_metrics` schema, insert schema, and types.
- [x] Implemented locally: storage interface and implementation methods for Instagram connection and daily rows.
- [x] Implemented locally: campaign delete cleanup includes Instagram rows by campaign ID.
- [x] Implemented locally: migration `0007_add_instagram_connected_platform_foundation.sql`.
- [ ] User validation pending for Commit 3.

### Details For Commit 4: Connection Flow And Selected Campaign Scope

Goal:

- Create the Instagram connection/import contract used by both entry points.

Commit 4A smallest safe backend slice:

- Add a campaign-access-guarded read-only Instagram connection status route.
- Return sanitized source identity fields and selected campaign IDs.
- Do not expose tokens, create connections, update connections, delete connections, refresh metrics, seed test data, or update Connected Platforms.
- Keep Create Campaign and Connected Platforms UI unchanged.

Commit 4A validation:

- Route is guarded by `ensureCampaignAccess`.
- Route reads only `storage.getInstagramConnection`.
- Route does not expose `accessToken`, `refreshToken`, or `encryptedTokens`.
- Route does not call create/update/delete storage methods.

Commit 4B smallest safe backend slice:

- Add `POST /api/instagram/:campaignId/connect-test`.
- Require a non-empty `selectedCampaignIds` array before any storage mutation.
- Replace only the current campaign's Instagram connection after campaign access and selection validation.
- Persist `publisherPlatformFilter="instagram"` and `sourceContractVersion="instagram_publisher_platform_v1"`.
- Do not seed mock daily metrics, refresh provider data, add UI, update Connected Platforms, or feed aggregate/report paths.

Commit 4B validation:

- Route is guarded by `ensureCampaignAccess`.
- Route fails closed when selected campaign IDs are missing.
- Route persists selected IDs for the status route.
- Route does not call Instagram daily metric upsert or refresh paths.

Commit 4C smallest safe backend slice:

- Add `PATCH /api/instagram/:campaignId/selected-campaigns`.
- Require an existing Instagram connection.
- Require a non-empty `selectedCampaignIds` array before any cleanup or update.
- Clear `instagram_daily_metrics` only when the selected campaign list changes.
- Update only the connection's selected campaign scope.
- Do not create a connection, refresh provider data, seed metrics, add UI, update Connected Platforms, or feed aggregate/report paths.

Commit 4C validation:

- Route is guarded by `ensureCampaignAccess`.
- Route returns `404` when no Instagram connection exists.
- Route fails closed when selected campaign IDs are missing.
- Route clears stale daily rows before updating the selected scope only when the selection changes.
- Route does not call create, daily upsert, or refresh paths.

Commit 4D smallest safe backend slice:

- Add `DELETE /api/instagram/:campaignId/connection`.
- Require campaign access before reading or deleting the connection.
- Return `404` when no Instagram connection exists.
- Delete through `storage.deleteInstagramConnection` so connection and daily-row cleanup stay centralized.
- Do not call daily metric cleanup directly from the route.
- Do not add UI, update Connected Platforms, refresh provider data, seed metrics, or feed aggregate/report paths.

Commit 4D validation:

- Route is guarded by `ensureCampaignAccess`.
- Route reads the connection before delete and fails closed when none exists.
- Route delegates cleanup to `storage.deleteInstagramConnection`.
- Storage delete removes `instagram_daily_metrics` for only the campaign being disconnected.
- Route does not call daily upsert or refresh paths.

Commit 4E smallest safe backend slice:

- Add `GET /api/instagram/:campaignId/campaigns`.
- Require campaign access before reading connection state.
- Require an existing Instagram connection.
- Return selector-ready campaign rows only from persisted `selectedCampaignIds`.
- Mark returned rows as `publisherPlatform="instagram"`.
- Do not discover live provider campaigns, mutate storage, refresh provider data, seed metrics, add UI, update Connected Platforms, or feed aggregate/report paths.

Commit 4E validation:

- Route is guarded by `ensureCampaignAccess`.
- Route reads only `storage.getInstagramConnection`.
- Route returns `404` when no Instagram connection exists.
- Route does not expose tokens.
- Route does not call create, update, delete, daily upsert, or refresh paths.

Commit 4F smallest safe documentation slice:

- Close Commit 4 as a backend-only contract in this tracker.
- Record that Commit 4A-4E add only backend routes and regression coverage.
- Record that Commit 4 still does not expose Instagram in Create Campaign, Connected Platforms, Campaign DeepDive, analytics pages, reports, scheduler, revenue, KPIs, or Benchmarks.
- Record that live OAuth/provider campaign discovery remains unimplemented and must not be treated as production-ready.
- Keep Commit 5 as the first UI-exposure phase.

Commit 4F validation:

- Master tracker marks Commit 4A-4E completion accurately.
- Current Status and Current Evidence Map reflect backend-only completion.
- Outstanding items still show UI, aggregate, revenue/spend, scheduler, and reporting work as pending.
- Validation evidence references the source-safety regression suite used for Commit 4 backend routes.

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

- [x] Commit 4A implemented locally: read-only Instagram connection/status route.
- [x] Commit 4A implemented locally: auth and source-safety regression coverage.
- [x] Commit 4B implemented locally: test-mode connection route requires selected campaign IDs before writing.
- [x] Commit 4B implemented locally: source-safety regression coverage.
- [x] Commit 4C implemented locally: selected-campaign update route requires existing connection and non-empty selected IDs.
- [x] Commit 4C implemented locally: stale daily row cleanup on selected-scope change.
- [x] Commit 4C implemented locally: source-safety regression coverage.
- [x] Commit 4D implemented locally: disconnect route is campaign-access guarded and fails closed.
- [x] Commit 4D implemented locally: disconnect delegates connection and daily-row cleanup to storage.
- [x] Commit 4D implemented locally: source-safety regression coverage.
- [x] Commit 4E implemented locally: campaign-list route is campaign-access guarded and read-only.
- [x] Commit 4E implemented locally: selector rows come only from persisted selected campaign IDs.
- [x] Commit 4E implemented locally: source-safety regression coverage.
- [x] Commit 4F pushed and user-validated: backend-only Commit 4 contract and validation boundary documented.
- [ ] Full connection flow not started.
- [x] User validation passed for Commit 4A by local checks.
- [x] User validation passed for Commit 4B by local checks.
- [x] User validation passed for Commit 4C by local checks.
- [x] User validation passed for Commit 4D by local checks.
- [x] User validation passed for Commit 4E by local checks.
- [x] User validation passed for Commit 4F.

### Details For Commits 5A-5E: Create Campaign Flow

Goal:

- Let users connect Instagram during initial campaign creation without creating a parallel journey.

Commit 5A smallest safe UI slice:

- Add Instagram to the Create Campaign platform list.
- Keep Instagram disabled as a Coming Soon option until Commit 5B adds a real setup path.
- Do not route Instagram to Step 3 authentication.
- Do not create, update, connect, refresh, or finalize Instagram from Create Campaign.
- Do not expose Instagram in Connected Platforms, Campaign DeepDive, analytics pages, reports, scheduler, revenue, KPIs, or Benchmarks.

Commit 5A validation:

- Create Campaign platform list contains Instagram Ads.
- Before Commit 5B, Instagram was included in the existing Coming Soon guard.
- Before Commit 5B, clicking Instagram could not proceed into connection setup.
- Google Ads, Meta/Facebook, LinkedIn, GA4, and Google Sheets existing platform paths remain unchanged.

Commit 5B smallest safe UI slice:

- Allow the Instagram option to enter Create Campaign Step 3.
- Add a minimal test-mode setup form that calls `POST /api/instagram/:campaignId/connect-test`.
- Require at least one selected Instagram campaign ID before calling the backend.
- Mark Instagram connected in the wizard only after the backend route succeeds.
- Do not call live OAuth, provider campaign discovery, metric refresh, daily metric upsert, analytics routes, Connected Platforms routes, revenue/spend routes, KPI routes, Benchmark routes, or report routes.

Commit 5B validation:

- Instagram Step 3 uses only the backend test source-contract route.
- Empty selected campaign IDs are rejected before the backend call.
- Successful test connection adds Instagram to the wizard connected platform list.
- Existing Google Ads, Meta/Facebook, LinkedIn, GA4, and Google Sheets setup paths remain unchanged.
- No Instagram analytics, aggregate, scheduler, report, revenue, KPI, or Benchmark path is added.

Commit 5C smallest safe UI slice:

- Before finalizing a draft campaign that includes Instagram, call `GET /api/instagram/:campaignId/connection`.
- Require the persisted response to have `connected: true` and a non-empty `selectedCampaignIds` array.
- Block activation with an error toast if the persisted Instagram source contract is missing or incomplete.
- Do not change finalization behavior for non-Instagram platforms.
- Do not add live OAuth, refresh, analytics, scheduler, reports, revenue, KPI, Benchmark, or Connected Platforms behavior.

Commit 5C validation:

- Instagram finalization checks the persisted connection before the existing campaign activation PATCH.
- Missing or incomplete Instagram selected campaign scope blocks campaign activation.
- A valid Instagram test connection can proceed to the existing finalization PATCH.
- Startup migrations create `instagram_connections` and `instagram_daily_metrics` if they are absent before Instagram routes need them.
- Existing Google Ads, Meta/Facebook, LinkedIn, GA4, and Google Sheets setup paths remain unchanged.

Commit 5D smallest safe UI slice:

- Extend only the existing post-finalization query invalidation list.
- Invalidate the string-key Executive Summary query, Trend Analysis, KPIs, Benchmarks, and all-data-source queries for the finalized campaign.
- Do not add backend routes, provider calls, live OAuth, refresh, analytics, scheduler, reports, revenue, KPI, Benchmark, or Connected Platforms behavior.

Commit 5D validation:

- Successful Create Campaign finalization invalidates Connected Platforms, outcome totals, Executive Summary, Trend Analysis, KPI, Benchmark, and all-data-source campaign queries.
- No new Instagram fetch, refresh, analytics, scheduler, report, revenue, KPI, or Benchmark route is called.
- Existing non-Instagram platform finalization behavior remains unchanged except broader stale-cache invalidation.

Commit 5E smallest safe documentation slice:

- Close the Create Campaign phase in the tracker.
- Keep 5A-5C marked user-validated after the Instagram test-account validation.
- Keep 5D marked locally implemented and pending user validation.
- Remove aggregate/outcome-totals source inclusion from Commit 5 validation because it belongs to later source-backed aggregate work.
- Do not add runtime behavior.

Commit 5E validation:

- The Create Campaign tracker describes only source setup, finalization guard, and cache invalidation.
- Instagram aggregate, Campaign DeepDive, Connected Platforms add-source, reports, scheduler, revenue, KPI, and Benchmark work remain pending in later commits.
- Regression coverage remains focused on Create Campaign setup/finalization/cache invalidation and startup table creation.

Tasks:

- Add Instagram to the Create Campaign platform list.
- Reuse the Instagram connection flow in Step 3.
- Add finalization guard so an Instagram-selected draft cannot become active unless the Instagram source contract is complete.
- Invalidate campaign, Connected Platforms, outcome totals, Executive Summary, Trend Analysis, KPI, Benchmark, and all-data-source queries after finalization.

Validation:

- Create a new campaign.
- Select Instagram in Create Campaign.
- Connect or use approved test mode.
- Select Instagram campaigns.
- Finalize campaign.
- Confirm the campaign is created and the persisted Instagram connection is campaign-scoped.
- Confirm `/api/campaigns/:campaignId/outcome-totals` does not include placeholder Instagram metrics before Commit 9 aggregate work.

Status:

- [x] Commit 5A done and pushed: Instagram appears in Create Campaign platform list.
- [x] Commit 5A done and pushed: Instagram option added before Commit 5B enabled setup.
- [x] Commit 5B done and pushed: Instagram Create Campaign setup uses backend test route.
- [x] Commit 5B done and pushed: selected campaign IDs are required before backend connection.
- [x] Commit 5C done and pushed: Step 5 verifies the persisted Instagram connection before campaign activation.
- [x] Commit 5C correction done and pushed: startup migrations create Instagram source tables if absent.
- [x] Commit 5D done and pushed: successful finalization invalidates campaign-scoped source-dependent query keys.
- [x] Commit 5E done and pushed: Create Campaign validation and acceptance boundary are documented.
- [x] User validation passed for Commit 5A by connecting to the Instagram test account.
- [x] User validation passed for Commit 5B by connecting to the Instagram test account.
- [x] User validation passed for Commit 5C by connecting to the Instagram test account.
- [x] User validation passed for Commit 5D by connecting to the Instagram test account.
- [x] User validation passed for Commit 5E by connecting to the Instagram test account.

### Details For Commits 6A-6F: Connected Platforms Add-Source Flow

Goal:

- Let users add Instagram later from the campaign `Connected Platforms` section using the same source contract as Create Campaign.

Commit 6A smallest safe backend slice:

- Add Instagram to `/api/campaigns/:id/connected-platforms` status output.
- Read only `storage.getInstagramConnection(campaignId)`.
- Mark Instagram connected only when the connection exists, is not `spendOnly`, and has non-empty `selectedCampaignIds`.
- Return `analyticsPath: null` because the Instagram analytics page and aggregate resolver are later commits.
- Do not add a UI card, setup flow, live OAuth, refresh, metrics, scheduler, reports, revenue, KPI, or Benchmark behavior.

Commit 6A validation:

- Existing campaign with an Instagram test connection returns an Instagram status row.
- Campaign without Instagram connection returns Instagram with `connected: false`.
- Instagram status includes selected campaign IDs/source contract metadata only; it does not expose analytics route behavior.
- Existing GA4, Google Sheets, LinkedIn, Meta/Facebook, Google Ads, and Custom Integration statuses remain unchanged.

Commit 6B smallest safe UI slice:

- Add Instagram Ads to the Campaign Detail Connected Platforms card list.
- Read connection state from `platformStatusMap.get("instagram")`.
- Show zero/unavailable card metrics only; do not source or invent performance values.
- Do not render `View Detailed Analytics` because `analyticsPath` remains `null`.
- Do not open a setup dropdown for Instagram until Commit 6C.

Commit 6B validation:

- Campaign Detail shows an Instagram Ads card.
- Existing campaign with a valid Instagram source shows the card as connected.
- Campaign without an Instagram source shows the card as not connected.
- The Instagram card has no analytics button and no placeholder performance metrics.
- Existing platform cards remain unchanged.

Commit 6C smallest safe UI slice:

- Let the disconnected Instagram Ads card expand.
- Add a minimal test-mode setup form with ad account ID, ad account name, and selected Instagram campaign IDs.
- Require at least one selected campaign ID before calling the backend.
- Call only `POST /api/instagram/:campaignId/connect-test`.
- Invalidate the connected-platforms status query after successful connection.
- Do not add live OAuth, provider campaign discovery, refresh, analytics, aggregate, scheduler, reports, revenue, KPI, or Benchmark behavior.

Commit 6C validation:

- Disconnected Instagram Ads card expands into the test setup form.
- Empty selected campaign IDs are blocked before the backend call.
- Successful setup uses the Instagram source-contract route and updates the Connected Platforms status.
- The Instagram card still has no analytics button and no placeholder metrics.
- Existing platform setup flows remain unchanged.

Commit 6D smallest safe UI state slice:

- Keep empty selected Instagram campaign IDs blocked before backend mutation.
- Keep backend connection errors surfaced through the existing destructive toast pattern.
- Add a dedicated Instagram Connected Platforms invalidation helper.
- After successful setup, invalidate campaign, connected-platforms, Instagram connection, outcome totals, Executive Summary, Trend Analysis, KPI, Benchmark, and all-data-source query keys.
- Do not add live OAuth, provider discovery, refresh, analytics, aggregate, scheduler, reports, revenue, KPI, or Benchmark behavior.

Commit 6D validation:

- Empty selected campaign IDs still do not call the backend.
- Backend setup errors show a destructive connection-failed toast.
- Successful setup closes the expanded card and invalidates source-dependent campaign query keys.
- Existing platform setup flows remain unchanged.

Commit 6E smallest safe documentation slice:

- Close the Connected Platforms phase in the tracker.
- Keep 6A-6D marked locally implemented and pending user validation.
- Remove analytics and Campaign DeepDive aggregate confirmation from Commit 6 validation because those belong to later source-backed aggregate/analytics work.
- Document that 6A-6D do not add live OAuth, refresh, analytics, aggregate, scheduler, reports, revenue, KPI, or Benchmark behavior.
- Do not add runtime behavior.

Commit 6E validation:

- The Connected Platforms tracker describes only status, card shell, test setup, state handling, and cache invalidation.
- Instagram analytics, Campaign DeepDive aggregation, source-backed metrics, reports, scheduler, revenue, KPI, and Benchmark work remain pending in later commits.
- Regression coverage remains focused on Connected Platforms status/card/setup/invalidation and source-contract boundaries.

Commit 6F smallest safe UI slice:

- Add only the missing `Instagram Ads` branch to the shared Connected Platforms disconnect handler.
- Call only the existing `DELETE /api/instagram/:campaignId/connection` route.
- Invalidate the Instagram connection query after successful disconnect.
- Do not change backend disconnect behavior, storage cleanup, analytics, refresh, aggregate, scheduler, reports, revenue, KPI, Benchmark, or live OAuth behavior.

Commit 6F validation:

- Disconnecting Instagram from Connected Platforms no longer shows `Disconnect not supported for this platform`.
- The Instagram card returns to disconnected state after a successful disconnect.
- Existing platform disconnect behavior remains unchanged.
- Instagram analytics, Campaign DeepDive aggregation, source-backed metrics, reports, scheduler, revenue, KPI, and Benchmark work remain pending in later commits.

Tasks:

- Add Instagram to the Campaign Overview Connected Platforms card list.
- Add Instagram status to `/api/campaigns/:id/connected-platforms`.
- Render the same Instagram connection flow from the expanded card.
- Keep `View Detailed Analytics` unavailable until the Instagram analytics page is implemented.
- Ensure success invalidates Connected Platforms, outcome totals, Executive Summary, Trend Analysis, KPI, Benchmark, and all-data-source queries.

Validation:

- Open an existing campaign.
- Add Instagram from Connected Platforms.
- Select account and campaigns.
- Confirm the card updates without placeholder metrics.
- Confirm Campaign DeepDive does not show placeholder Instagram aggregate metrics before Commit 9 source-backed aggregate work.

Status:

- [x] Commit 6A done and pushed: Connected Platforms backend status includes Instagram from the source contract only.
- [x] Commit 6B done and pushed: Campaign Detail renders an Instagram Ads card shell without analytics exposure.
- [x] Commit 6C done and pushed: disconnected Instagram card opens the test source-contract setup form.
- [x] Commit 6D done and pushed: Instagram Connected Platforms setup invalidates source-dependent campaign query keys.
- [x] Commit 6E done and pushed: Connected Platforms validation and acceptance boundary are documented.
- [x] Commit 6F implemented locally: Connected Platforms disconnect maps Instagram Ads to the existing backend route.
- [ ] User validation pending for Commit 6A.
- [ ] User validation pending for Commit 6B.
- [ ] User validation pending for Commit 6C.
- [ ] User validation pending for Commit 6D.
- [ ] User validation pending for Commit 6E.
- [ ] User validation pending for Commit 6F.

### Details For Commits 7A-7D: Source-Backed Campaign Overview Metrics

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

### Details For Commits 8A-8F: Instagram Analytics Page

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

### Details For Commits 9A-9E: Campaign DeepDive Aggregate Resolver

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

### Details For Commits 10A-10D: Revenue, Spend, And Derived Metric Semantics

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

### Details For Commits 11A-11F: Scheduler And Freshness Hardening

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

### Details For Commits 12A-12D: Disconnect, Reconnect, And Stale Data Safety

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

### Details For Commits 13A-13F: KPI, Benchmark, Reports, And Scheduled Output Parity

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

### Details For Commits 14A-14E: Regression Coverage And Final Evidence

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
- The current scheduler/report paths do not include Instagram lifecycle support; schema/storage foundation exists locally after Commit 3, backend-only connection/status, test connection, selected-campaign update, disconnect, and selected-campaign list routes exist after Commit 4A-4E, Commit 4F documents that this backend contract is closed without UI/runtime exposure, Commit 5A added the Create Campaign option, Commit 5B adds a test setup path only, Commit 5C adds a persisted-source finalization guard, Commit 5D broadens post-finalization cache invalidation only, Commit 5E closes the Create Campaign documentation boundary, Commit 6A adds backend Connected Platforms status only, Commit 6B adds a card shell, Commit 6C adds test source-contract setup only, Commit 6D broadens Connected Platforms success invalidation only, and Commit 6E closes the Connected Platforms documentation boundary.
- Meta/Facebook currently has Instagram-related placement concepts, but not a standalone Instagram source contract.
- Instagram Commit 1 documentation and acceptance-contract validation passed after user review.
- Instagram Commit 2 API/source-contract research and local design trace passed user validation.
- Instagram Commit 3 schema/storage foundation is implemented locally without UI, route, scheduler, aggregate, revenue, KPI, Benchmark, or report exposure.
- Instagram Commit 4A read-only backend connection/status route is implemented locally without UI, write, refresh, scheduler, aggregate, revenue, KPI, Benchmark, or report exposure.
- Instagram Commit 4B backend test-mode connection route is implemented locally without UI, live OAuth, refresh, scheduler, aggregate, revenue, KPI, Benchmark, or report exposure.
- Instagram Commit 4C backend selected-campaign update route is implemented locally without UI, live OAuth, refresh, scheduler, aggregate, revenue, KPI, Benchmark, or report exposure.
- Instagram Commit 4D backend disconnect route is implemented locally without UI, live OAuth, refresh, scheduler, aggregate, revenue, KPI, Benchmark, or report exposure.
- Instagram Commit 4E backend selected-campaign list route is implemented locally without UI, live OAuth, refresh, scheduler, aggregate, revenue, KPI, Benchmark, or report exposure.
- Instagram Commit 4F backend contract finalization is done, pushed, and user-validated as documentation only.
- Instagram Commit 5A Create Campaign option is implemented locally.
- Instagram Commit 5B Create Campaign test setup is implemented locally without live OAuth, refresh, scheduler, aggregate, revenue, KPI, Benchmark, analytics page, Connected Platforms, or report exposure.
- Instagram Commit 5C Create Campaign finalization guard is implemented locally without live OAuth, refresh, scheduler, aggregate, revenue, KPI, Benchmark, analytics page, Connected Platforms, or report exposure.
- Instagram Commit 5C startup migration correction is done and pushed, and only creates missing Instagram source tables/indexes.
- Instagram Commit 5D Create Campaign query invalidation is done, pushed, and user-validated without live OAuth, refresh, scheduler, aggregate, revenue, KPI, Benchmark, analytics page, Connected Platforms, or report exposure.
- Instagram Commit 5E Create Campaign closeout is done, pushed, and user-validated as documentation/regression-boundary tracking only.
- Instagram Commit 6A Connected Platforms backend status is done and pushed without UI card, setup flow, live OAuth, refresh, scheduler, aggregate, revenue, KPI, Benchmark, analytics page, or report exposure.
- Instagram Commit 6B Connected Platforms card shell is done and pushed without live OAuth, refresh, scheduler, aggregate, revenue, KPI, Benchmark, analytics page, or report exposure.
- Instagram Commit 6C Connected Platforms add-source setup is done and pushed without live OAuth, refresh, scheduler, aggregate, revenue, KPI, Benchmark, analytics page, or report exposure.
- Instagram Commit 6D Connected Platforms state/invalidation is done and pushed without live OAuth, refresh, scheduler, aggregate, revenue, KPI, Benchmark, analytics page, or report exposure.
- Instagram Commit 6E Connected Platforms closeout is done and pushed as documentation/regression-boundary tracking only.

Partially reviewed:

- Create Campaign platform list and connector rendering.
- Campaign Overview Connected Platforms cards.
- Connected Platforms status endpoint.
- Shared aggregate helper.
- Revenue/spend platform context allowlists.
- Existing Meta, LinkedIn, and Google Ads tracker patterns.

Unverified:

- Live implementation still needs production-like confirmation of exact current Meta API version, allowed breakdown combinations, field compatibility, and permission requirements.
- Whether product wants standalone Instagram or Instagram as a Meta/Facebook breakdown only.
- Live OAuth behavior.
- Provider rate limits, token lifetime, and permission review requirements.
- Full report scheduler behavior for a new Instagram platform.

## Outstanding Items

Implementation:

- [x] Confirm product decision for tracking purposes: standalone Instagram main platform unless later explicitly changed.
- [x] Complete Commit 2 API/source-contract research and local design trace.
- [x] Confirm official API requirements from current Meta/Instagram docs for planning purposes.
- [x] Document exact future `instagram_connections` fields.
- [x] Document exact future `instagram_daily_metrics` fields.
- [x] Document implementation-ready Meta/Facebook plus Instagram no-double-counting rule.
- [x] Add schema/storage foundation.
- [x] Add read-only connection/status route foundation.
- [x] Add backend test-mode connection route requiring selected Instagram campaigns.
- [x] Add backend selected-campaign update route requiring an existing Instagram connection.
- [x] Add backend disconnect route.
- [x] Add backend selected-campaign list route.
- [x] Close Commit 4 backend-only contract in documentation.
- [x] Add Create Campaign Instagram option.
- [x] Add Create Campaign Instagram test setup path.
- [x] Add Create Campaign Instagram finalization guard.
- [x] Add Create Campaign query invalidation.
- [x] Close Create Campaign validation and documentation boundary.
- [x] Add Connected Platforms backend Instagram status.
- [ ] Add write connection flow.
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

- [x] Commit 1 documentation and acceptance-contract validation.
- [x] Commit 2 API/source-contract research and local design trace.
- [x] Commit 3 local schema/storage foundation implementation.
- [x] Commit 4A local read-only connection/status route implementation.
- [x] Commit 4B local backend test-mode connection route implementation.
- [x] Commit 4C local backend selected-campaign update route implementation.
- [x] Commit 4D local backend disconnect route implementation.
- [x] Commit 4E local backend selected-campaign list route implementation.
- [x] Commit 4F backend contract finalization documentation pushed and user-validated.
- [x] Commit 5A local disabled Create Campaign option implementation.
- [x] Commit 5B local Create Campaign test setup implementation.
- [x] Commit 5C local Create Campaign finalization guard implementation.
- [x] Commit 5C local startup migration correction for Instagram source tables.
- [x] Commit 5D Create Campaign query invalidation pushed and user-validated.
- [x] Commit 5E Create Campaign validation and documentation closeout pushed and user-validated.
- [x] Commit 6A local Connected Platforms backend status implementation.
- [x] Commit 6B local Connected Platforms card shell implementation.
- [x] Commit 6C local Connected Platforms add-source setup implementation.
- [x] Commit 6D local Connected Platforms state and invalidation implementation.
- [x] Commit 6E local Connected Platforms validation and documentation closeout.
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

## Latest Validation

- User validation passed for Instagram Commit 1 documentation and acceptance contract.
- User validation passed for Instagram Commit 2 API/source-contract research and local design trace.
- Local implementation complete for Instagram Commit 3 schema/storage foundation; user validation is pending.
- User validation passed for Instagram Commit 4A read-only connection/status route through local check and source-safety regression suite.
- User validation passed for Instagram Commit 4B backend test-mode connection route through local check and source-safety regression suite.
- User validation passed for Instagram Commit 4C backend selected-campaign update route through local check and source-safety regression suite.
- User validation passed for Instagram Commit 4D backend disconnect route through local check and source-safety regression suite.
- User validation passed for Instagram Commit 4E backend selected-campaign list route through local check and source-safety regression suite.
- User validation passed for Instagram Commit 4F backend contract finalization documentation.
- User validation passed for Instagram Commit 5A Create Campaign platform option by connecting to the Instagram test account.
- User validation passed for Instagram Commit 5B Create Campaign test setup path by connecting to the Instagram test account.
- User validation passed for Instagram Commit 5C Create Campaign finalization guard by connecting to the Instagram test account.
- Instagram Commit 5C startup migration correction is done and pushed after browser validation exposed the missing active-database tables.
- User validation passed for Instagram Commit 5D Create Campaign query invalidation by connecting to the Instagram test account.
- User validation passed for Instagram Commit 5E Create Campaign closeout documentation by connecting to the Instagram test account.
- Local implementation complete for Instagram Commit 6A Connected Platforms backend status; user validation is pending.
- Local implementation complete for Instagram Commit 6B Connected Platforms card shell; user validation is pending.
- Local implementation complete for Instagram Commit 6C Connected Platforms add-source setup; user validation is pending.
- Local implementation complete for Instagram Commit 6D Connected Platforms state and invalidation; user validation is pending.
- Local implementation complete for Instagram Commit 6E Connected Platforms closeout documentation; user validation is pending.
