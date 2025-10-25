# PerformanceCore - Marketing Analytics Platform

## Overview
PerformanceCore is a comprehensive marketing analytics platform for tracking and optimizing advertising campaigns across multiple platforms. It provides a sophisticated dashboard for monitoring KPIs, integrating with various marketing services, and driving superior marketing results through advanced analytics. The platform is designed as a full-stack solution to offer a unified view of campaign performance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features a professional, GA4-inspired design with interactive elements like world maps and consistent iconography.

### Technical Implementations
- **Frontend**: React 18 with TypeScript, Vite, Radix UI (shadcn/ui), Tailwind CSS, TanStack Query, Wouter, React Hook Form (Zod for validation), Recharts for data visualization.
- **Backend**: Python 3.11 with FastAPI, Pydantic models, RESTful APIs, OpenAPI documentation, Uvicorn server.
- **Data Storage**: PostgreSQL with Drizzle ORM, Zod-validated schema, Drizzle Kit for migrations.
- **Data Flow**: Client requests via TanStack Query -> FastAPI for validation -> Abstract storage interface -> PostgreSQL via Drizzle ORM -> Typed responses to frontend -> React Query for UI updates.

### Feature Specifications
- **KPI Management**: Two-tier analytics architecture: Campaign-Level KPIs (aggregated cross-platform metrics like Impressions, Engagements, Clicks, Conversions, Spend, CTR, CPC/CPM, CVR/CPA/CPL, and Audience Metrics) and Platform-Level KPIs (channel-specific metrics). Includes numeric coercion, division-by-zero protection, and time-based analysis (daily, weekly, monthly, quarterly).
- **Email Alerts**: Configurable threshold-based alerts for KPIs and Benchmarks with various conditions (below, above, equals) and configurable recipients.
- **Benchmark Alerts**: Includes email notification functionality when performance deviates from set benchmarks.
- **Geographic Analytics**: Interactive world map visualization with country, region, and city breakdown, integrated with GA4 data.
- **Dynamic Platform Detection**: Identifies connected services during campaign creation.
- **Auto-Refresh**: Configurable auto-refresh functionality for data.
- **LinkedIn Reports**: Functionality to create, manage, and view various report types (Overview, KPIs, Benchmarks, Ad Comparison, Custom) with a two-step creation modal and a listing of reports.
- **Custom Integration Webhooks**: Automated PDF processing via unique token-based webhook URLs for integration with automation services like Zapier or IFTTT. Supports direct file uploads or URL-based PDF processing.
- **KPI Report Scheduling & Export**: PDF export of campaign-level KPI reports and automated email delivery with configurable frequency (daily, weekly, monthly, quarterly) to multiple recipients.
- **Performance Summary (Executive Dashboard)**: A focused executive snapshot from Campaign DeepDive including Campaign Health Status (calculated score), Top Priority Action (AI-powered recommendation), Aggregated Metrics Snapshot (cross-platform totals), Time-Based Metric Comparison (historical data comparison with trend indicators), Data Source Status, and AI-Powered Insights. Designed for scalability and platform-agnostic health scoring.
- **Budget & Financial Analysis**: Comprehensive financial dashboard with real-time metrics aggregated from all connected platforms (LinkedIn, Custom Integration, GA4). Features include:
  - **Real Platform Data**: Aggregates spend, impressions, clicks, conversions from LinkedIn and Custom Integration APIs, eliminating all mock/hardcoded data
  - **Multi-Currency Support**: Displays all financial metrics in campaign-specific currency (USD, EUR, GBP, CAD, AUD, JPY, CNY, INR)
  - **Budget Pacing & Burn Rate**: Daily spend tracking with target daily spend comparison, pacing status indicators (ahead/on-track/behind), and projected budget exhaustion dates
  - **Time-Based Comparisons**: Dropdown selector for comparing current metrics against historical snapshots (Yesterday, Last 7 Days, Last 30 Days) with trend indicators and percentage changes
  - **Campaign Health Score**: Real-time 0-100 health score with traffic-light indicators (excellent/good/warning/critical) across four dimensions:
    - Budget Utilization (excellent ≤80%, good ≤95%, warning ≤100%, critical >100%)
    - Pacing Status (excellent ±15%, good ±30%, warning ±50%, critical >50% deviation)
    - ROI Performance (excellent ≥100%, good ≥50%, warning ≥0%, critical <0%)
    - ROAS Performance (excellent ≥3x, good ≥1.5x, warning ≥1x, critical <1x)
  - **Platform-Specific ROAS**: Breakdown of return on ad spend by individual platforms with color-coded performance badges
  - **AOV Warning System**: Alerts when Average Order Value data is unavailable from platform integrations, ensuring transparency in financial calculations
- **Platform Comparison**: Cross-channel performance analysis dashboard with real-time data from connected platforms (LinkedIn, Custom Integration). Features comprehensive ROI and ROAS tracking across all tabs:
  - **Dynamic Platform Detection**: Automatically detects and displays only connected platforms, eliminating hardcoded dummy data
  - **Overview Tab**: Platform summary cards displaying Conversions, Spend, ROAS, and ROI with color-coded profit indicators. Quick comparison metrics highlight Best CTR, Lowest CPC, Highest ROAS, and Highest ROI performers
  - **Performance Metrics Tab**: Best performer KPI cards (Best CTR, Lowest CPC, Best Conv. Rate, Best ROI), detailed metrics table with CTR/CPC/Conv.Rate/ROI columns, and efficiency comparison showing both ROAS and ROI percentages with volume & reach bar charts
  - **Cost Analysis Tab**: Comprehensive ROI & ROAS analysis section comparing profit percentage (ROI) vs revenue multiples (ROAS) side-by-side for each platform with performance ratings (Excellent ≥100%, Good ≥50%, Break-even+ ≥0%, Loss <0% for ROI). Includes cost per conversion analysis and budget allocation efficiency tracking
  - **Insights Tab**: Data-driven recommendations engine that analyzes platform performance differences and generates actionable insights:
    - **Performance Insights**: Identifies top performers, volume leaders, highest engagement platforms, and optimization opportunities with contextual analysis
    - **Budget Reallocation Strategy**: Recommends specific budget adjustments (increase/maintain/reduce) based on ROAS performance with percentage guidance
    - **Platform-Specific Optimizations**: Generates targeted recommendations for each platform based on CTR, CVR, CPC, and ROAS metrics (creative refresh, landing page optimization, bid strategy adjustments)
    - **Performance Monitoring**: Best practices for ongoing campaign surveillance and optimization
  - **Intelligent Ranking Logic**: Corrected CPC comparison treating zero-cost platforms as absolute minimum while selecting smallest positive CPC when no zero values exist
- **Trend Analysis Report**: Industry market trend tracking via Google Trends API integration. Features include:
  - **Keyword Configuration**: UI to configure industry category and trend keywords per campaign (e.g., "wine", "organic wine" for wine campaigns)
  - **Google Trends Integration**: Real-time market trend data fetched via google-trends-api library (90-day search interest trends)
  - **Market Intelligence**: Provides executives with consumer interest patterns, seasonal demand shifts, and industry momentum insights
  - **Configuration Card**: Displays setup interface when keywords aren't configured; shows "Configure Keywords" button when set
  - **Database Schema**: Added `industry` (text) and `trendKeywords` (text array) fields to campaigns table
- **Executive Summary**: Visual marketing funnel representation showing the complete customer journey from impressions → clicks → conversions → revenue, with automated health grading, risk assessment, and strategic recommendations. Includes three-stage funnel visualization (Top/Mid/Bottom) with color-coding, icons, and narrative summary. Aggregates metrics from LinkedIn Ads and Custom Integration APIs.

## Custom Integration Metric Mapping

**Enterprise-Grade Data Accuracy:** Custom Integration supports PDF uploads containing website analytics (GA4), email marketing, and social media metrics. These metrics are intelligently mapped to advertising campaign equivalents for consistent cross-platform reporting.

### Metric Aggregation Map

All sections (Executive Summary, Performance Summary, Budget & Financial Analysis, Platform Comparison, Automated Snapshots) use consistent mapping:

| Custom Integration Source | Mapped To | Executive Summary Field | Calculation |
|---------------------------|-----------|-------------------------|-------------|
| **pageviews** (GA4) | Impressions | Total Impressions | LinkedIn impressions + CI pageviews |
| **sessions** (GA4) | Engagements | Total Engagements | LinkedIn engagements + CI sessions |
| **clicks** | Clicks | Total Clicks | LinkedIn clicks + CI clicks |
| **conversions** | Conversions | Total Conversions | LinkedIn conversions + CI conversions |
| **spend** | Spend | Total Spend | LinkedIn spend + CI spend |
| **revenue** | Revenue | Total Revenue | LinkedIn revenue + CI revenue* |

*Note: Revenue field does not currently exist in Custom Integration schema.

### Conversion Rate (CVR) Accuracy - Dual Metric System

**Enterprise Transparency Solution:** The platform displays TWO separate CVR metrics for complete transparency:

1. **Click-Through CVR** (Primary Metric)
   - Formula: `min(totalConversions, totalClicks) / totalClicks * 100`
   - Always capped at 100% (mathematically sound)
   - Represents conversions that can be attributed to direct ad clicks
   - Example: 8,857 click-through conversions / 8,857 clicks = 100%

2. **Total CVR (includes view-through)** (Secondary Metric)
   - Formula: `totalConversions / totalClicks * 100`
   - Can exceed 100% when LinkedIn view-through conversions are included
   - Represents total conversion attribution (click-through + view-through)
   - Example: 9,388 total conversions / 8,857 clicks = 106%
   - Only displayed when Total CVR > 100%

**Why This Happens:**
- LinkedIn tracks **click-through conversions** (user clicked ad → converted)
- LinkedIn also tracks **view-through conversions** (user saw ad → converted later without clicking)
- When view-through conversions push total conversions above click count, Total CVR exceeds 100%
- Example: 8,857 clicks + 531 view-through conversions = 9,388 total conversions = 106% CVR

**Display Logic:**
- Always show Click-Through CVR (capped at 100%)
- Show Total CVR only when it exceeds 100% (indicates view-through attribution)
- Executives see both metrics for complete campaign attribution understanding

### Custom Integration Fields NOT Used

These fields exist in the database but do NOT impact Executive Summary aggregations:
- `users`, `avgSessionDuration`, `pagesPerSession`, `bounceRate` (GA4 metrics)
- `organicSearchShare`, `directBrandedShare`, `emailShare`, `referralShare`, `paidShare`, `socialShare` (traffic source percentages)
- `emailsDelivered`, `openRate`, `clickThroughRate`, `clickToOpenRate`, `hardBounces`, `spamComplaints`, `listGrowth` (email metrics)
- `reach`, `viralImpressions`, `videoViews`, `leads` (social media metrics)

## External Dependencies

- **Database**: Neon Database (PostgreSQL)
- **UI Components**: Radix UI
- **Charts**: Recharts
- **Validation**: Zod
- **Forms**: React Hook Form
- **Marketing Platforms**: Facebook Ads, Google Analytics (GA4), LinkedIn Ads, Google Sheets
- **Authentication**: OAuth 2.0 (for Google services and LinkedIn Ads)
- **Build Tools**: Vite, ESLint, PostCSS, ESBuild
- **Email Services**: SendGrid, Mailgun, SMTP (via Nodemailer)
- **PDF Parsing**: pdf-parse library