# ARCHITECTURE_USER_JOURNEY.md

## Purpose

This document defines the required end-to-end user journey and product architecture pattern for this codebase.

It exists to preserve the current design model for future development.

This is not optional guidance.
It is the template future work must follow.

## Product Summary

This app is a marketing analytics platform that pulls performance data from multiple sources, including:

- LinkedIn
- GA4
- Google Sheets
- Google Ads
- Meta
- custom uploads
- CRM and ecommerce revenue sources
- manual spend and revenue inputs

The platform transforms those inputs into:

- campaign dashboards
- KPIs
- benchmarks
- alerts and notifications
- executive summaries
- downloadable and scheduled reports

## Intended Users

This platform is primarily for:

- marketing managers and growth teams tracking campaign performance across channels
- analysts who need cross-platform rollups for spend, conversions, revenue, ROI, ROAS, and related metrics
- executives who need a single health-and-insights view and executive-ready reports

## Enterprise Standard

This is a professional enterprise-grade platform relied on by marketing executives to make critical business decisions.

There is no margin for error.

The user journey, analytics model, and presentation hierarchy must remain stable and trustworthy.
Any new development must preserve that trust.

## Core Journey

The required core user flow is:

`sign-in -> create/select client -> create campaign -> connect data -> analyze -> act`

This flow must remain the conceptual backbone of the product.

## End-to-End User Journey

### 1. Sign In

The user authenticates first.

The system uses `Clerk` for account creation and authentication.

Protected product routes are not the entry point for signed-out users.
Authentication gates access to the rest of the system.

### 2. Create or Select Client

This is a multi-tenant application.

Users work within a client/account context.
Clients are the top-level organizational unit above campaigns.

The expected pattern is:

- sign in
- enter the app
- create or select a client
- then work on campaigns within that client

Future development should preserve client context as a real product layer, not a cosmetic selector.

The concrete top-of-funnel journey should be understood as:

1. user signs in through `Clerk`
2. user lands on the `Welcome / Home` page
3. the `Welcome / Home` page contains marketing-industry news / information
4. the user can create a new client by clicking `+` next to `CLIENTS` in the left nav
5. a client-creation modal opens
6. the user enters the client name and clicks `Save`
7. the new client appears under the `Clients` section in the left nav
8. clicking the client should route the user to that client's `Dashboard`

### Left Sidebar Pattern

The left sidebar has two navigation layers:

- global main-nav items
- client-specific submenu items under each client

Current intended pattern:

- `Home` and `Notifications` are global main-nav items
- `Dashboard`, `Campaigns`, `Audiences`, and `Reports` are client-scoped submenu items
- `Connected Platforms` is a status section below the main navigation, not a route group

Important meaning:

- `Notifications` is not client-submenu navigation
- the `Notifications` page is a global surface that aggregates notifications across campaigns
- users can filter that page by campaign after opening it

### Current-State Note: Dashboard

The `Dashboard` should be treated as the client-level overview layer for that client's campaigns.

The Dashboard still needs refinement.

For now, preserve the current routing and hierarchy:

- `Welcome / Home` -> select/create client -> client `Dashboard` -> `Campaigns` -> campaign-specific analytics

Do not redesign around the Dashboard until that layer is intentionally updated.

### 3. Create Campaign

Campaigns are the primary working unit of the platform.

Creating a campaign establishes the object that later contains:

- campaign metadata
- connected source integrations
- source-specific mappings and filters
- attribution-related configuration
- KPIs
- benchmarks
- financial and performance rollups
- notifications
- reports

This is a campaign-centered architecture.
Do not redesign the product around integrations alone, reports alone, or dashboards alone.

### 4. Connect Data

After creating a campaign, the user connects one or more data sources to it.

This is a required step in the product model.

The campaign is the anchor.
The sources attach to the campaign.

The pattern is:

- enter campaign details
- connect data to that campaign
- then derive analytics from those campaign-scoped connections

Do not invert this model unless explicitly requested.

### 5. Analyze

After connecting data, the user analyzes campaign or account performance through the platform's analytics surfaces.

These surfaces include:

- dashboard views
- campaign detail views
- platform analytics pages
- KPI tracking
- benchmark tracking
- executive summaries
- financial analysis
- notifications
- reports

This stage is where raw connected data becomes operational insight.

### 6. Act

The product is designed to support action, not just passive reporting.

Users are expected to act on the analysis by:

- adjusting campaigns
- changing spend or priorities
- responding to KPI or benchmark alerts
- reviewing campaign health and risk
- sharing reports with stakeholders

The system should continue to support this decision-support loop.

## Required Structural Pattern

The required product architecture pattern is:

1. Authentication gates the system.
2. Users operate inside a client context.
3. Campaigns are the primary detailed analytics object.
4. Data sources connect into campaigns.
5. The system transforms those campaign-connected sources into analytics.
6. Platform-level views drill into platform-level analytics.
7. Campaign-level views drill into the campaign as a whole with all connected data sources.
8. KPIs, benchmarks, alerts, and reports sit on top of those analytics layers.
9. The final outcome is business action based on accurate data.

Future development must fit into this pattern.

## Platform-Level vs Campaign-Level Analytics

This distinction is fundamental and must remain explicit in both product behavior and code structure.

Do not merge these concepts.
Do not blur their responsibilities.
Do not build new features that confuse cross-campaign views with single-campaign views.

### Platform-Level Analytics

In this product, a platform means a connected source such as:

- GA4
- Meta
- LinkedIn
- Google Ads
- Google Sheets

Platform-level analytics means analytics specific to that connected platform.

Connected Platforms = where the data comes from.
Platform-specific deep detail = one platform's connected data for the current campaign or context.

They answer questions like:

- What does GA4 say for this campaign's selected GA4 configuration?
- What does LinkedIn say for this campaign's selected LinkedIn campaigns?
- What does Meta say for this campaign's selected Meta campaigns?
- What is happening inside this one connected platform?
- What source-specific detail or validation is needed here?

Important scoping rule:

- platform analytics should be scoped to the data the user selected when connecting that platform
- example:
  - if a user connects a GA4 property and selects specific GA4 campaigns, the GA4 analytics should be scoped to those selected GA4 campaigns
  - if a user connects LinkedIn and selects specific LinkedIn campaigns, the LinkedIn analytics should be scoped to those selected LinkedIn campaigns
- do not silently expand a platform view to unrelated data in the same property/account unless that behavior is explicitly designed and communicated


### Campaign-Level Analytics

Campaign-level analytics are scoped to a campaign and include all connected data sources.

They answer questions like:

- How is this specific campaign performing?
- Which data sources are connected to this campaign?
- What are this campaign's KPIs, benchmarks, trends, and financials?
- What source-level or campaign-level actions should be taken here?

These views are diagnosis-oriented and execution-oriented.

They are used for:

- deep performance analysis
- campaign configuration
- per-campaign financial review
- source-level investigation within a campaign
- optimization of a specific campaign

Examples include:

- campaign detail
- GA4 analytics for a campaign
- LinkedIn analytics for a campaign
- Meta analytics for a campaign
- Google Ads analytics for a campaign
- Google Sheets data for a campaign
- custom integration analytics for a campaign
- financial analysis for a campaign
- executive summary for a campaign
- trend analysis for a campaign

Campaign-level analytics must remain explicitly scoped to one campaign and its connected sources.

## Important Implementation Nuance: Two Detail Layers Inside A Campaign

The current codebase follows an important two-layer pattern inside the campaign experience.

This must be preserved.

Even though both layers appear within the campaign area, they serve different purposes:

- campaign-level analytics = the campaign as a whole
- connected platform analytics = one platform at a time within that campaign

These are not interchangeable.

To avoid ambiguity:

- `Connected Platforms` belongs inside the campaign-level `Overview` tab
- this is correct because it answers a campaign question: which platforms are connected to this campaign?
- however, the analytics launched from that section are still platform-specific, not campaign-wide

So the placement is campaign-level, while the detail view it launches is platform-level.

## Campaign Hub Pattern

The campaign detail page acts as the hub for a single campaign.

This hub is where the top tabs matter and define the meaning of the campaign-centered experience.

### Campaign-Level Hub Tabs

These are campaign-level, not platform-specific:

- KPIs
- Benchmarks
- Freestyle Chat
- Overview

### KPIs Tab

The KPIs tab is campaign-level.

It defines what good looks like for the campaign overall.

This is where the user defines campaign goals and targets such as:

- CTR
- CPL
- ROAS
- ROI
- leads
- conversions
- spend efficiency targets

These KPI definitions are meant to evaluate the campaign as a whole, not just one source in isolation.

Implementation note:

The code currently supports this pattern by computing campaign KPI values from unified campaign totals and selected connected sources rather than treating KPIs as purely platform-specific values.

### Benchmarks Tab

The Benchmarks tab is campaign-level.

It answers:

- how does this campaign compare?
- are we above, near, or below expected reference values?

Benchmarks are not the same as goals.

KPIs define target performance.
Benchmarks define comparative reference performance.

Both belong at the campaign layer and should continue to be interpreted together:

- KPI = what success should be
- Benchmark = how current performance compares to expected or reference values

Implementation note:

The current codebase keeps Benchmarks aligned with the same normalized campaign totals used for campaign KPIs so those two tabs do not drift conceptually.

### Freestyle Chat

Freestyle Chat is campaign-level.

It is intended for questions, prompts, and exploratory analysis about overall campaign performance.

It should continue to use campaign context such as:

- campaign performance
- spend and revenue
- KPIs
- benchmarks
- campaign-level rollups

It should not be repurposed into a single-platform diagnostic tool unless explicitly designed that way.

Current-state note:

- Freestyle Chat is still in progress
- the intended behavior is that users can enter prompts and run queries against their campaign data to get insights
- future work should preserve this as a campaign-context analytics surface rather than a generic chatbot

### Overview And Campaign DeepDive

The Overview tab is the campaign hub landing area.

It is allowed, and expected, to contain a mix of:

- campaign-wide summary sections
- campaign-scoped launcher sections
- platform-connection sections related to that campaign

Inside Overview, the Campaign DeepDive section acts as a set of analysis launchers.

These launchers are campaign-wide and cross-platform in intent.

Current DeepDive launchers include:

- Performance Summary
- Budget & Financial Analysis
- Platform Comparison
- Trend Analysis
- Executive Summary
- Custom Report

These are campaign-level deep dives.
They are not individual-source analytics pages.

## Connected Platforms Pattern

Connected Platforms is where the data comes from.

It shows platform connection state plus platform-specific entry points.

The correct interpretation is:

- Connected Platforms = platform-specific detail for a campaign
- View Detailed Analytics = drill into one platform only

Important clarification:

`Connected Platforms` is still part of the campaign-level `Overview` experience.

Why:

- it shows which sources are attached to this campaign
- it helps the user understand campaign setup and campaign data coverage
- it belongs in the campaign hub because connection state is part of campaign understanding

What it is not:

- it is not the same thing as campaign-wide rollup analysis
- it is not the same thing as DeepDive
- it is not a cross-platform narrative layer by itself

### View Detailed Analytics

The `View Detailed Analytics` action is a platform-specific deep-detail launcher.

Examples:

- GA4-only detail
- LinkedIn-only detail
- Meta-only detail
- Google Ads-only detail
- Google Sheets-only detail
- Custom Integration-only detail

These pages are still campaign-scoped in routing and tenancy, but analytically they are platform-specific views.

## DeepDive vs Connected Platforms

This distinction is one of the most important architectural rules in the product.

There are two levels of detail:

- DeepDive = cross-platform, campaign-wide analysis
- Connected Platforms = individual platform analytics

More specifically:

- DeepDive tells the story of the campaign as a whole
- Connected Platforms shows the underlying source-specific lenses feeding that campaign

Future development must preserve this split.

## Relationship Between Campaign-Level Analytics And Connected Platforms

The correct relationship is:

1. Connected Platforms provide source-level inputs.
2. Campaign-level analytics aggregate, interpret, and evaluate those inputs at the campaign level.
3. KPIs and Benchmarks sit at the campaign layer.
4. DeepDive pages tell a broader story using the campaign's combined knowledge.
5. Platform-specific detailed analytics remain available when a user needs to inspect one source directly.

This means:

- campaign-level analysis is downstream of connected-platform data
- connected-platform pages are supporting detail views
- the campaign remains the primary object

## Consistency Review Of The Current Codebase

Based on the current implementation, the codebase is broadly consistent with this pattern, with these important clarifications:


### Important Clarification

The Connected Platforms section appears inside the campaign Overview page, and that placement is correct.

It should remain there because it is part of understanding the campaign's connected setup.

However, it should not be interpreted as the same kind of analytics as campaign-wide DeepDive or campaign-level KPI/Benchmark analysis.

It is a platform-specific layer inside the campaign experience.

### Small Implementation Caveat

Custom Report currently behaves as a campaign-level reporting launcher, but in implementation it is opened from the hub as a report-building action rather than a dedicated deep-dive page.

That is still consistent with the campaign-wide DeepDive concept and should be treated as part of the campaign-level analysis/reporting layer, not the platform-specific layer.

## Campaign Creation As The Product Anchor

Future development should always remember:

- campaigns are not incidental records
- campaigns are not just tags on integrations
- campaigns are not secondary to data connectors

Campaigns are the anchor object that organizes:

- source connections
- source mappings
- financial aggregation
- KPI and benchmark logic
- notifications
- reporting
- executive analysis

## Campaign Management Journey

The current product is built around a campaign management workflow.

This must remain the standard user journey for campaign creation and access.

### Campaign Management Entry Point

The user navigates to `Campaigns` from the left sidebar.

They land on the Campaign Management page, which is client-specific.

The currently selected client in the client context / dropdown determines which campaigns are shown there.

That page should:

- list campaigns for the currently selected client
- show `No campaigns found` for new users or clients with no campaigns
- let the user create campaigns
- let the user edit campaigns
- let the user pause or re-activate campaigns
- let the user delete campaigns

### Campaign Creation Wizard Pattern

The intended campaign creation pattern is:

1. User clicks `Create Campaign`
2. User enters campaign metadata
3. User clicks `Next`
4. User lands on the connectors flow
5. User connects one or more sources
6. User clicks the final `Create Campaign` action
7. The system finalizes the campaign and marks it active
8. The user returns to Campaign Management and sees the new campaign in the list
9. The user clicks the campaign and lands on the campaign-level Overview
10. Under "Connected Platforms" in the Overview all connected platforms should show a blue Connected badge and a View Detailed Analytics link which should link to the specific platform's analytics section

### Draft vs Finalized Campaigns

The intended design is:

- the campaign is a draft during setup
- it becomes active only when the creation flow is finalized
- campaign creation should be treated as complete only after the relevant source connections/configuration are successfully completed

Required interpretation for future development:

- the final `Create Campaign` action should represent campaign finalization, not just record creation
- an `active` campaign should normally mean the campaign has at least one successfully configured data source or intentionally supported campaign data path
- intentionally supported data paths can include manual or import-based campaign setup, not only OAuth-connected platforms
- do not treat connector setup as optional if the campaign is expected to produce analytics immediately

### Campaign Overview Entry After Creation

After the campaign exists, clicking it from Campaign Management should take the user to the campaign-level Overview.

That Overview should function as the campaign hub.

Inside that hub, the `Connected Platforms` section should:

- be campaign-specific
- show connection status for sources attached to that campaign
- show a blue `Connected` badge for platforms that are successfully connected to that campaign
- provide `View Detailed Analytics` entry points for connected sources
- have each `View Detailed Analytics` link route to that specific platform's analytics section for the current campaign

This is the correct bridge from campaign setup into analytics.

This is a super-important design pattern.

Required interpretation for future development:

- `Connected Platforms` belongs inside the campaign-level `Overview` because it answers which sources are attached to the campaign
- the blue `Connected` badge communicates that the source is live for that campaign
- `View Detailed Analytics` is the handoff from the campaign hub to the platform-specific analytics layer
- the user should not be sent to a generic or wrong destination; the link must open the correct analytics section for that exact connected platform

## Platform-Specific Templates

Platform-specific behavior should live in dedicated companion docs, not be expanded indefinitely inside this file.

Current platform-specific docs:

- `GA4/README.md`
- `GA4/OVERVIEW.md`
- `GA4/FINANCIAL_SOURCES.md`
- `GA4/KPIS.md`
- `GA4/BENCHMARKS.md`
- `GA4/AD_COMPARISON.md`
- `GA4/INSIGHTS.md`
- `GA4/REPORTS.md`
- `GA4/REFRESH_AND_PROCESSING.md`

`GA4/README.md` is the entry point for GA4-related work.

Use platform-specific docs for:

- platform overview behavior
- source import and mapping journeys
- computation and recomputation rules
- platform-specific scope, filtering, and attribution rules

High-level rule:

- `ARCHITECTURE_USER_JOURNEY.md` = overall architecture and product pattern
- platform-specific docs = detailed implementation template for each connected platform

## Template For Future Development

Any new feature should be designed by asking:

1. Is this platform-level or campaign-level?
2. If campaign-level, is it campaign-wide or platform-specific within the campaign?
3. Where does it sit in the journey: create, connect, analyze, or act?
4. Does it attach to a campaign, or is it a broader account-level surface?
5. Does it preserve the existing client -> campaign -> connection -> analytics hierarchy?
6. Does it help users move from data collection to accurate decision-making?

If a proposed change does not fit this model, pause before implementing it.

## What Must Not Be Changed Casually

- the campaign-centered product model
- the distinction between platform-level and campaign-level analytics
- the client -> campaign -> connection hierarchy
- the connect-data-before-analysis workflow
- the decision-support orientation of the product
- the executive-grade accuracy expectation attached to all analytics and reporting
