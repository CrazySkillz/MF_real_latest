# PerformanceCore - Marketing Analytics Platform

## Overview
PerformanceCore is a comprehensive marketing analytics platform designed for tracking and optimizing advertising campaigns across multiple platforms. Its primary purpose is to provide a unified dashboard for monitoring Key Performance Indicators (KPIs), integrating with various marketing services, and leveraging advanced analytics to drive superior marketing results. The platform aims to offer a full-stack solution for a holistic view of campaign performance, targeting enhanced business vision and market potential.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features a professional, GA4-inspired design with interactive elements and consistent iconography.

### Technical Implementations
- **Frontend**: React 18 with TypeScript, Vite, Radix UI (shadcn/ui), Tailwind CSS, TanStack Query, Wouter, React Hook Form (Zod for validation), Recharts for data visualization.
- **Backend**: Python 3.11 with FastAPI, Pydantic, RESTful APIs, OpenAPI documentation, Uvicorn.
- **Data Storage**: PostgreSQL with Drizzle ORM, Zod-validated schema, Drizzle Kit for migrations.
- **Data Flow**: Utilizes TanStack Query for client-backend communication, FastAPI for validation, an abstract storage interface, and Drizzle ORM for PostgreSQL interaction, ensuring typed responses and UI updates via React Query.

### Feature Specifications
- **KPI Management**: A two-tier analytics architecture supports Campaign-Level (aggregated cross-platform metrics) and Platform-Level KPIs (channel-specific). Includes numeric coercion, division-by-zero protection, and time-based analysis.
- **Email & Benchmark Alerts**: Configurable threshold-based email alerts for KPIs and Benchmarks with various conditions and recipient options.
- **Geographic Analytics**: Interactive world map visualization with granular location breakdown, integrating GA4 data.
- **Dynamic Platform Detection**: Identifies connected services during campaign creation.
- **Auto-Refresh**: Configurable data auto-refresh functionality.
- **LinkedIn Reports**: Creation, management, and viewing of various report types (Overview, KPIs, Benchmarks, Ad Comparison, Custom) via a two-step modal.
- **Custom Integration Webhooks**: Automated PDF processing via unique token-based webhook URLs, supporting direct file uploads or URL-based PDF processing.
- **KPI Report Scheduling & Export**: PDF export of campaign-level KPI reports and automated email delivery with configurable frequency and multiple recipients.
- **Performance Summary (Executive Dashboard)**: Provides an executive snapshot including Campaign Health Status, AI-powered Top Priority Actions, Aggregated Metrics, Time-Based Metric Comparison, Data Source Status, and AI-Powered Insights.
- **Budget & Financial Analysis**: A comprehensive financial dashboard with real-time, multi-currency metrics aggregated from connected platforms (LinkedIn, Custom Integration, GA4). Features budget pacing, burn rate analysis, time-based comparisons, a Campaign Health Score (0-100 with traffic-light indicators), platform-specific ROAS, and an AOV warning system.
- **Platform Comparison**: Cross-channel performance analysis dashboard with real-time data from connected platforms, featuring dynamic platform detection. Includes Overview, Performance Metrics, Cost Analysis, and an Insights Tab with data-driven recommendations, budget reallocation strategies, and platform-specific optimizations. It also implements intelligent ranking logic for CPC comparison.
- **Trend Analysis Report**: Integrates Google Trends API for industry market trend tracking based on configurable keywords and industry categories, providing market intelligence.
- **Executive Summary**: Visual marketing funnel representation from impressions to revenue, with automated health grading, risk assessment, and enterprise-grade strategic recommendations. Recommendations include data freshness validation, non-linear scaling models, scenario planning (best/expected/worst case), confidence levels, explicit assumptions, dynamic reallocation, conservative scaling, and comprehensive disclaimers for transparency.

### System Design Choices
- **LinkedIn Revenue Calculation**: All LinkedIn revenue is consistently calculated using the actual `conversionValue` stored in `linkedinImportSessions`, ensuring accuracy across all features like metrics APIs, executive summary, platform comparison, and financial analysis.
- **Custom Integration Metric Mapping**: Supports PDF uploads for GA4, email, and social media metrics, intelligently mapping them to advertising campaign equivalents for consistent cross-platform reporting in all summary and comparison sections.
- **Conversion Rate (CVR) Accuracy**: Displays two CVR metrics for transparency: "Click-Through CVR" (capped at 100%, based on direct ad clicks) and "Total CVR" (can exceed 100% due to view-through conversions, displayed only when >100%). This provides a complete understanding of campaign attribution.
- **Custom Integration Fields NOT Used**: Specific GA4, traffic source, email, and social media metrics from custom integration are identified as not impacting Executive Summary aggregations to maintain focus on core advertising metrics.

## External Dependencies

- **Database**: Neon Database (PostgreSQL)
- **UI Components**: Radix UI
- **Charts**: Recharts
- **Validation**: Zod
- **Forms**: React Hook Form
- **Marketing Platforms Integration**: Facebook Ads, Google Analytics (GA4), LinkedIn Ads, Google Sheets
- **Authentication**: OAuth 2.0 (for Google services and LinkedIn Ads)
- **Build Tools**: Vite, ESLint, PostCSS, ESBuild
- **Email Services**: SendGrid, Mailgun, SMTP (via Nodemailer)
- **PDF Parsing**: pdf-parse library