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