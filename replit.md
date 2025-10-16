# PerformanceCore - Marketing Analytics Platform

## Overview
PerformanceCore is a comprehensive marketing analytics platform designed for campaign performance tracking and optimization. It offers a sophisticated dashboard for managing advertising campaigns across multiple platforms, monitoring key performance indicators (KPIs), and integrating with various marketing services. The platform aims to drive superior marketing results through advanced analytics and seamless integrations. It is built as a full-stack solution.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Radix UI with shadcn/ui
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for data visualization
- **UI/UX**: Professional, GA4-inspired design with interactive elements like world maps and consistent iconography.

### Backend
- **Runtime**: Python with FastAPI
- **Language**: Python 3.11 with Pydantic models
- **API Design**: RESTful APIs with OpenAPI documentation
- **Development**: Hot reload with Uvicorn server

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: Strongly typed with Zod validation
- **Migrations**: Drizzle Kit
- **Development Storage**: In-memory storage

### Core Features
- **Data Models**: Campaigns, Metrics, Integrations, Performance Data, LinkedIn Reports, Custom Integration Metrics.
- **Frontend Components**: Dashboard, Integrations management, comprehensive UI components.
- **Backend Services**: Abstracted storage interface, RESTful endpoints, Zod validation, centralized error handling.
- **Data Flow**: Client requests via TanStack Query -> FastAPI handles validation -> Abstract storage interface -> PostgreSQL via Drizzle ORM -> Typed responses to frontend -> React Query manages UI updates.
- **KPI Management**: Campaign and platform-level KPI tracking with time-based analysis (daily, weekly, monthly, quarterly), rolling averages, trend detection, and target date functionality. **Email Alerts**: KPIs support configurable threshold-based email alerts with condition settings (below, above, equals), allowing users to receive notifications when metrics cross specified thresholds.
- **Benchmark Alerts**: Benchmarks include email alert functionality with threshold monitoring, enabling users to be notified when performance deviates from industry standards or internal targets.
- **Geographic Analytics**: Interactive world map visualization with country, region, and city breakdown, integrated with GA4 data.
- **Dynamic Platform Detection**: Identifies connected services during campaign creation.
- **Auto-Refresh**: Configurable auto-refresh functionality for data.
- **Error Handling**: Seamless fallback analytics data display and silent token management for uninterrupted user experience (e.g., for OAuth issues).
- **LinkedIn Reports**: 5th tab in LinkedIn Analytics with support for creating, managing, and viewing reports. Report types include Overview, KPIs, Benchmarks, Ad Comparison, and Custom reports. Features include two-step creation modal (type selection → configuration), report listing with metadata, and foundation for download/email/scheduling capabilities.
- **Custom Integration Webhooks**: Automated PDF processing via unique webhook URLs for integration with Zapier, IFTTT, and other automation services. Each custom integration receives a unique token-based webhook endpoint for secure, automated metric updates.

## External Dependencies

- **Database**: Neon Database (PostgreSQL)
- **UI Components**: Radix UI
- **Charts**: Recharts
- **Validation**: Zod
- **Forms**: React Hook Form
- **Marketing Platforms**: Facebook Ads, Google Analytics (GA4), LinkedIn Ads, Google Sheets
- **Authentication**: OAuth 2.0 for Google services and LinkedIn Ads
- **Build Tools**: Vite, ESLint, PostCSS, ESBuild (for backend compilation)

## OAuth Integration & Production Validation

### LinkedIn OAuth (Production-Ready)
- **Implementation**: Full OAuth 2.0 authorization code flow with PKCE-like security
- **OAuth Callback**: `/oauth-callback.html` handles authorization code exchange
- **Flow**: User authorization → Code exchange → Token storage → Ad account selection → Campaign import
- **Test Mode**: Mock data available for development/demo without real credentials
- **Production Mode**: Requires LinkedIn Developer App with Client ID and Secret
- **Scopes Required**: `r_ads_reporting`, `rw_ads`, `r_organization_admin`
- **Validation Guide**: See `LINKEDIN_OAUTH_VALIDATION.md` for complete setup instructions
- **Secrets**: Set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` environment variables for production
- **Redirect URIs**: Configure in LinkedIn app to match deployment URL (e.g., `https://[domain]/oauth-callback.html`)

### Google Analytics (GA4) OAuth  
- **Implementation**: OAuth 2.0 flow with automatic token refresh
- **Integration**: Real-time and historical metrics via GA4 API
- **Token Management**: Automatic refresh on expiry with seamless fallback

### Custom Integration (Webhook-Based)
- **Implementation**: Automated PDF processing via webhook endpoints with dual-format support
- **Authentication**: Unique webhook token per integration for secure access
- **Webhook URL**: `/api/webhook/custom-integration/:token` accepts POST requests in two formats:
  - **Direct Upload** (Zapier): multipart/form-data with PDF file in 'pdf' field
  - **URL-Based** (IFTTT): JSON body with PDF URL in 'value1', 'pdfUrl', or 'pdf_url' field
- **Automation Services**: Compatible with Zapier (file upload), IFTTT (URL-based), Make.com, and other webhook-supporting platforms
- **Data Flow**: 
  - Email with PDF → Automation service → Webhook endpoint → PDF download/upload → PDF parsing → Metric extraction → Database storage → Dashboard update
- **Metrics Extraction**: Automatic parsing of marketing metrics from PDF reports using pattern matching. Supports multiple formats:
  - **Audience & Traffic** (GA4-style): Users (unique), Sessions, Pageviews, Avg. Session Duration, Pages/Session, Bounce Rate
  - **Traffic Sources**: Organic Search, Direct/Branded, Email (Newsletters), Referral/Partners, Paid (Display/Search), Social (as percentages)
  - **Email Performance**: Emails Delivered, Open Rate, Click-Through Rate, Click-to-Open, Hard Bounces, Spam Complaints, List Growth
  - **Legacy Social Media**: Impressions, Reach, Clicks, Engagements, Spend, Conversions, Leads, Video Views, Viral Impressions
- **PDF Parser**: Uses pdf-parse library with regex pattern matching for flexible metric extraction across table and inline formats
- **IFTTT Integration**: Leverages IFTTT's email trigger "Attachment URL" ingredient to pass public PDF URLs to webhook for download and processing
- **Setup**: Generate unique webhook token on connection → Copy webhook URL → Configure in automation service → Activate
- **UI Display**: Metrics are conditionally displayed based on available data, with organized sections for each metric category
- **Validation Pattern**: Robust metric validation using `isValidNumber` helper that ensures sections only render when valid numeric data exists (including zero values), preventing display of empty sections with N/A cards. Handles undefined, null, empty strings, NaN, and Infinity edge cases from PDF parsing

## Email Alert System

### Implementation
- **Alert Configuration**: KPIs and Benchmarks support threshold-based email alerts configurable through the UI
- **UI Controls**: Checkbox to enable alerts, threshold value, alert condition (below/above/equals), email recipients (comma-separated)
- **Monitoring Service**: Server-side alert monitoring service (`alert-monitoring.ts`) checks KPI/Benchmark values against thresholds
- **Email Service**: Flexible email service (`email-service.ts`) supporting multiple providers (SendGrid, Mailgun, SMTP) via nodemailer
- **Throttling**: Built-in 24-hour throttling to prevent alert spam (configurable)
- **API Endpoints**: 
  - `POST /api/alerts/check` - Manually trigger alert checks (can be called by cron jobs)
  - `GET /api/alerts/status` - Get alert configuration status

### Email Configuration
Set environment variables based on your email provider:

**SendGrid:**
- `EMAIL_PROVIDER=sendgrid`
- `SENDGRID_API_KEY` or `EMAIL_SERVICE_API_KEY`
- `EMAIL_FROM_ADDRESS`

**Mailgun:**
- `EMAIL_PROVIDER=mailgun`
- `MAILGUN_SMTP_USER`, `MAILGUN_SMTP_PASS` or `EMAIL_SERVICE_API_KEY`
- `EMAIL_FROM_ADDRESS`

**SMTP (Gmail, etc.):**
- `EMAIL_PROVIDER=smtp`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` or `EMAIL_SERVICE_API_KEY`
- `EMAIL_FROM_ADDRESS`

### Alert Workflow
1. User creates KPI/Benchmark with alert settings (threshold, condition, email recipients)
2. Background job calls `/api/alerts/check` periodically (can use cron/scheduler)
3. Monitoring service checks all enabled alerts
4. If threshold is breached, email is sent via configured provider
5. Last alert timestamp is updated to prevent spam

### Future Enhancements
- **Token Persistence**: Store OAuth tokens in database (currently in-memory)
- **Token Refresh**: Implement refresh token flow for long-lived LinkedIn sessions
- **Multi-Account Support**: Multiple LinkedIn connections per user
- **Webhook Integration**: Real-time updates via LinkedIn webhooks
- **Scheduled Reports Email**: Integration with alert system for automated report delivery
- **Custom Integration PDF Templates**: Standardized PDF templates for consistent metric extraction
- **Alert Frequency Options**: Immediate, hourly, daily, weekly alert frequency controls
- **Slack/Teams Integration**: Additional notification channels beyond email