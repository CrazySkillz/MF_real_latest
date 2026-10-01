# Current App Sections

Last reconciled with the implementation: 2026-10-01.

## Purpose

This is the current code-traced product-surface reference for onboarding, help
content, and user-journey copy. It records what a signed-in user can reach in
the current application and separates that from retained routes, historical
implementation notes, and production-readiness evidence.

This document does not certify analytics accuracy or production readiness.
Those decisions remain in `PRODUCTION_READINESS.md`,
`APP_PRODUCTION_READINESS.md`, and the relevant section or platform readiness
documents.

## Documentation Authority

- Use this file for current page names, routes, navigation, and visible user
  actions.
- Use `ARCHITECTURE_USER_JOURNEY.md` for the required product hierarchy and
  the distinction between campaign-wide and platform-specific analytics.
- Use `GA4/README.md` and the other `GA4/*.md` functional files for detailed
  GA4 behavior.
- Use dated certificates, implementation summaries, and proposal documents as
  historical evidence only. They are not onboarding sources unless a current
  functional document explicitly incorporates them.

## Current Primary Journey

`sign in -> Clients -> select/create client -> All Campaigns -> create/select campaign -> Campaign Overview -> Campaign Diagnostics or Connected Platform -> act through alerts and reports`

The current release is GA4-first:

- the Create Campaign wizard exposes Google Analytics as its enabled platform
- the Campaign Overview `Connected Platform` list renders Google Analytics
  only
- routes and page implementations for other platforms remain in the codebase,
  but they are not part of the current primary onboarding journey

## Authentication And Account

| Surface | Route | Current behavior |
| --- | --- | --- |
| Sign in | `/sign-in` | Clerk-hosted sign-in UI. Successful sign-in returns to `/`. |
| Sign up | `/sign-up` | Clerk-hosted sign-up UI. Successful sign-up returns to `/`. |
| Account menu | Global top navigation | Clerk account management and sign-out actions. Clerk development-mode branding depends on the configured Clerk instance, not this app's page code. |
| Privacy Policy | `/privacy` | Available to signed-in and signed-out visitors. |
| Google OAuth callback | `/auth/google/callback` | Technical provider return route used during Google connection flows; it is not a standalone onboarding destination. |

When no client exists, `WelcomeGate` restricts the signed-in journey to the
client/home, notifications, and authentication callback surfaces. The `/welcome`
route currently renders the same Clients page as `/`.

## Global Navigation And Sidebar

The left sidebar currently contains:

1. `Clients`
2. the current client context when the user is in a campaign route
3. the current campaign indented below the client on supported campaign detail
   routes
4. `Back to Campaign Overview` on those supported detail routes, or `Back to
   All Campaigns` on the campaign hub
5. `Notifications`

The current client is highlighted while the user is viewing that client's
campaign. The campaign context and `Back to Campaign Overview` treatment is
implemented for GA4, Campaign Diagnostics, Talk to Your Data, and campaign
scoped Reports routes.

`Dashboard`, `Audiences`, and `Reports` are not global sidebar items in the
current implementation.

## Clients

**Primary route:** `/`

The Clients page lets a user:

- create a client
- select a client and open `All Campaigns`
- delete a client through a confirmation dialog

Client deletion is presented as destructive and permanent. Onboarding copy
must preserve that warning and must not imply that a deleted client can be
restored from the UI. Exact cascade and ownership safety remain controlled by
the destructive-path readiness evidence; this current-surface inventory does
not recertify them.

The confirmation dialog stays open with `Deleting...` while the server runs
the campaign and analytics-child cascade. There is no intentional client-side
delay. After the server confirms success, the page removes the client from its
cached list, closes the dialog, and revalidates Clients, Campaigns, and
Notifications in the background. This keeps loading content stable during the
request; the wait time is the server-side cascade, not a UI transition timer.

The registered `/clients` page is a retained alternate implementation that
routes client selection to `/dashboard`; it is not linked by the current
sidebar or primary client journey.

## Campaign Management

**Route:** `/campaigns`

`All Campaigns` is scoped to the selected client. It provides:

- a campaign list
- campaign creation
- campaign editing
- campaign deletion
- entry into a campaign's `Campaign Overview`

### Create Campaign Wizard

The visible wizard has five steps:

1. `Details`
2. `Platform`
3. `Auth` (`Connect` for Custom Integration code paths)
4. `Configure`
5. `Confirm`

The current enabled creation path is Google Analytics. The GA4 configuration
step selects a property and campaign scope before final confirmation. The
campaign remains a draft during setup and becomes active after the final
`Create Campaign` action succeeds.

Several additional platform definitions and connector implementations remain
in the codebase. They are filtered out of the current Create Campaign platform
selection and should not appear in onboarding instructions for this release.

## Campaign Overview

**Route:** `/campaigns/:id`

`Campaign Overview` is the hub for one campaign. The page no longer displays a
separate client/campaign summary card at the top. Client and campaign context
is carried in the sidebar.

The hub has two visible sections:

### Campaign Diagnostics

The current launchers are:

| Launcher | Route | Purpose |
| --- | --- | --- |
| Performance Summary | `/campaigns/:id/performance` | Campaign outcomes, health, priority, recent movement, and evidence-based actions. |
| Budget & Financial Analysis | `/campaigns/:id/financial-analysis` | Campaign financial position, budget pacing, source allocation, and financial actions. |
| Trend Analysis | `/campaigns/:id/trend-analysis` | Cumulative headline values with selectable 7, 14, 30, or 90-day chart and comparison windows. |
| Executive Summary | `/campaigns/:id/executive-summary` | Risk, funnel, KPI and Benchmark exceptions, and evidence-backed actions for leadership. |
| Reports | `/reports?campaignId=:id` | Create, schedule, manage, and download campaign diagnostic reports. |
| Talk to Your Data | `/campaigns/:id/talk-to-your-data` | Enabled launcher that currently opens a placeholder page saying `Chat feature coming soon!`. |

`Platform Comparison` is not a current Campaign Diagnostics launcher.

### Connected Platform

The visible section is labelled `Connected Platform`. In the current GA4-first
release it renders the Google Analytics connection card. `View Detailed
Analytics` opens `/campaigns/:id/ga4-metrics`.

Revenue and Spend sources configured inside Google Analytics are child
financial inputs. They do not appear as separate main Connected Platform cards.

## Campaign Diagnostics Pages

### Performance Summary

**Route:** `/campaigns/:id/performance`

The current page includes:

- `Performance Summary` with Total Users, Total Sessions, Total Conversions,
  Total Revenue, and Total Spend
- Campaign Health
- Top Priority Action
- Recent Movement
- Recommended Actions

A retained `Metric Trends` renderer is fixed off in the current page and is not
part of the visible Performance Summary.

Unavailable inputs remain unavailable rather than being presented as factual
zeros. Recommendations depend on connected data and configured KPI or
Benchmark targets.

### Budget & Financial Analysis

**Route:** `/campaigns/:id/financial-analysis`

The current page is one executive view. It includes:

- Budget & Financial Analysis headline metrics
- Budget & Pacing
- conditional Paid Media Efficiency
- Allocation & Sources
- Executive Action

The older Overview, ROI & ROAS, Cost Analysis, Budget Allocation, and Insights
tab renderer remains in the file as a disabled rollback reference and is not a
current user-facing tab set.

### Trend Analysis

**Route:** `/campaigns/:id/trend-analysis`

The current page is one executive view. The selector offers `Last 7 Days`,
`Last 14 Days`, `Last 30 Days`, and `Last 90 Days`. It changes the chart window
and exact comparison date; it does not replace the cumulative current totals.

Visible sections are data-dependent and can include:

- Campaign Performance Trend
- Efficiency Trends
- Anomaly Detection
- Website Engagement & Conversion Summary
- connected paid/source detail
- Executive Recommendations

### Executive Summary

**Route:** `/campaigns/:id/executive-summary`

The current page includes:

- campaign trajectory or a reason that history is not comparable
- Risk Level
- an executive narrative
- Marketing Funnel Performance
- KPIs & Benchmarks, including attention and no-exception states
- Recommended Actions

When the available data and targets do not support a reliable action, the page
shows `No Evidence-Backed Actions Available`.

### Reports

**Campaign route:** `/reports?campaignId=:id`

The campaign-scoped Reports page provides:

- `Create Report`
- Performance Summary, Budget & Financial Analysis, Trend Analysis, and
  Executive Summary report types
- immediate PDF download for unscheduled reports
- Daily, Weekly, Monthly, and Quarterly scheduling
- email recipients, a browser time zone, and schedule times from `09:00` through
  `18:00`
- saved report edit, pause/resume, latest-report download, and delete actions

`Platform Comparison` is hidden for new report creation. A legacy saved
Platform Comparison report can still be edited. Legacy Custom reports can also
be edited, but Custom is not offered for new campaign report creation.

Campaign Diagnostics and GA4 PDFs use the current branded report shell:

- cream background matching the logo background
- pastel orange top rule and accents
- MimoSaaS logo at the top right below the rule
- white content and metric cards
- no vertical orange bar beside section headings
- light chart frames and thin chart series where charts are included

Browser downloads use the browser's configured download location. Web code
cannot force a specific operating-system folder when the browser is configured
to ask for a location or use another default.

### Talk to Your Data

**Route:** `/campaigns/:id/talk-to-your-data`

The page currently contains only `Chat feature coming soon!`. It does not send
campaign data to an AI provider and does not yet accept prompts. Onboarding may
identify it as coming soon, but must not describe a working chat workflow.

## Google Analytics

**Route:** `/campaigns/:id/ga4-metrics`

Google Analytics is a platform-specific analytics page scoped to the property
and campaign values saved during setup. Its current tabs are:

1. Overview
2. KPIs
3. Benchmarks
4. Ad Comparison
5. Insights
6. Reports

The GA4 Reports builder offers the standard templates `Overview`, `KPIs`,
`Benchmarks`, `Ad Comparison`, and `Insights`, plus a section-composed Custom
Report. Unscheduled reports generate and download immediately. Scheduled
reports are saved to the campaign's GA4 report list. GA4 Reports, KPI reminder
emails, and Benchmark reminder emails share the `06:00` through `18:00` local
hour range; Weekly KPI and Benchmark reminders also require a weekday.

### GA4 Tab Summary

- **Overview:** Sessions, Users, Conversions, Engagement Rate, and Conversion
  Rate summary cards; a three-column Revenue, Spend, and Pipeline Proxy row;
  Performance cards; Campaign Breakdown, Conversion Events, and Landing Pages.
  The cards inside the first financial row are `Total Revenue`, `Total Spend`,
  and `Expected Revenue`.
- **KPIs:** executive status counts, campaign/platform KPI cards, create/edit/
  delete controls, custom KPIs, targets, and optional alert/email schedules.
- **Benchmarks:** executive status counts, Benchmark cards, create/edit/delete
  controls, custom reference values, and optional alert/email schedules. The
  current create flow does not offer automatic industry benchmark suggestions.
- **Ad Comparison:** compares GA4 campaign rows rather than individual ads or
  creatives. It includes conditional leader cards, a metric selector and chart,
  totals, campaign count, and Revenue Breakdown.
- **Insights:** Executive Financials, Trends, Data Summary, tracker cards, and
  `What to investigate next`. Trends keeps `Latest imported day`, omits the
  former `Chart through` label, and states only `Missing stored dates are shown
  as 0` for Daily coverage. Data Summary no longer prints the imported-history
  date-range sentence.
- **Reports:** standard templates, Custom Report composition, immediate PDF
  generation, saved schedules, and the current branded report output.

Detailed metric meaning, source rules, windows, refresh behavior, and report
contracts live in the corresponding `GA4/*.md` files.

## Other Platform Page Implementations

The following campaign-scoped pages are registered and have page
implementations, but they are outside the current GA4-first onboarding path
because the Create Campaign selector and Campaign Overview Connected Platform
list do not currently expose them:

| Platform | Route | Implemented visible tabs |
| --- | --- | --- |
| Google Sheets | `/campaigns/:id/google-sheets-data` | Overview, Summary, KPIs, Benchmarks, Insights, Reports |
| LinkedIn Ads | `/campaigns/:id/linkedin-analytics` | Overview, KPIs, Benchmarks, Ad Comparison, Insights, Reports |
| Meta/Facebook Ads | `/campaigns/:id/meta-analytics` | Overview, KPIs, Benchmarks, Ad Comparison, Insights, Reports |
| Google Ads | `/campaigns/:id/google-ads-analytics` | Overview, KPIs, Benchmarks, Ad Comparison, Insights, Reports |
| Instagram Ads | `/campaigns/:id/instagram-analytics` | Overview, KPIs, Benchmarks, Ad Comparison, Insights, Reports |
| TikTok Ads | `/campaigns/:id/tiktok-analytics` | Overview, KPIs, Benchmarks, Ad Comparison, Insights, Reports |
| Custom Integration | `/campaigns/:id/custom-integration-analytics` | Overview, Summary, KPIs, Benchmarks, Insights, Reports |

These routes should receive platform-specific onboarding only after their
connection entry points and Campaign Overview visibility are intentionally
enabled and revalidated.

## Notifications

**Route:** `/notifications`

The page lists active KPI and Benchmark alerts across campaigns. Users can
filter by priority, client, campaign, and date. Alert actions deep-link to the
relevant GA4 KPI or Benchmark when campaign and item context is available.

The current page does not expose read, clear, or dismiss controls. A missing or
resolved deep-linked alert is shown as no longer active.

## Registered Routes Excluded From Current Onboarding

The following routes are registered but have no current primary-navigation
caller or are retained compatibility surfaces:

| Route | Current classification |
| --- | --- |
| `/dashboard` | Retained Marketing Dashboard implementation; not linked from the sidebar and still marked for refinement. |
| `/clients` | Alternate Clients implementation that routes selection to Dashboard; the primary Clients route is `/`. |
| `/campaigns/:id/platform-comparison` | Implemented page retained for compatibility; removed from current Campaign Diagnostics launchers and new report creation. |
| `/campaigns/:id/kpis` | Registered standalone campaign KPI page; current alert deep links use GA4 KPI/Benchmark tabs instead. |
| `/platforms/:platformType/kpis` | Registered standalone platform KPI page with no current navigation caller. |
| `/linkedin-analytics` | Legacy non-campaign LinkedIn route. |
| `/audiences` | Implemented Audience Management page with no current navigation caller. |
| `/reports` without `campaignId` | Standalone fail-closed library shell; it does not expose campaign report creation. |
| `/integrations/:id/analytics` | Compatibility route to Custom Integration analytics. |

Do not include these routes in onboarding unless the product explicitly
restores a navigation entry and validates the resulting journey.

## Known Journey Gaps Before Building Onboarding

1. Campaign creation and the Campaign Overview platform list are intentionally
   GA4-first even though other platform pages and connectors remain in code.
2. Sidebar campaign nesting recognizes GA4 and Campaign Diagnostics routes,
   but not every retained non-GA4 platform route.
3. Campaign Overview retains non-rendered KPI and Benchmark tab content without
   visible tab controls; onboarding should use the GA4 KPI and Benchmark tabs.
4. Talk to Your Data is a placeholder, not an interactive feature.
5. Dashboard and Audiences are registered but absent from the primary
   navigation.
6. The unused `WelcomePage` component still previews Dashboard, while
   `/welcome` currently renders the Clients page.
7. Campaign Diagnostics browser and scheduled PDFs use the new branded shell,
   but some generated section text still retains older labels such as `Key
   Outcomes`, `Financial Position`, and `7-Day Snapshot Trajectory`. Those are
   current report-output labels, not current web-page headings.

Resolve or explicitly accept these product decisions before creating the
website onboarding flow. Documentation alone should not make a hidden or
placeholder feature appear available.

## Code Sources Reviewed

The current-state inventory above was traced from:

- `client/src/App.tsx`
- `client/src/components/layout/sidebar.tsx`
- `client/src/components/layout/navigation.tsx`
- `client/src/pages/home.tsx`
- `client/src/pages/campaigns.tsx`
- `client/src/pages/campaign-detail.tsx`
- all registered Campaign Diagnostics and connected-platform page components
- `client/src/pages/notifications.tsx`
- `client/src/pages/reports.tsx`
- current GA4 report renderers and GA4 functional documentation
