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
- **Data Models**: Campaigns, Metrics, Integrations, Performance Data, LinkedIn Reports.
- **Frontend Components**: Dashboard, Integrations management, comprehensive UI components.
- **Backend Services**: Abstracted storage interface, RESTful endpoints, Zod validation, centralized error handling.
- **Data Flow**: Client requests via TanStack Query -> FastAPI handles validation -> Abstract storage interface -> PostgreSQL via Drizzle ORM -> Typed responses to frontend -> React Query manages UI updates.
- **KPI Management**: Campaign and platform-level KPI tracking with time-based analysis (daily, weekly, monthly, quarterly), rolling averages, trend detection, and target date functionality.
- **Geographic Analytics**: Interactive world map visualization with country, region, and city breakdown, integrated with GA4 data.
- **Dynamic Platform Detection**: Identifies connected services during campaign creation.
- **Auto-Refresh**: Configurable auto-refresh functionality for data.
- **Error Handling**: Seamless fallback analytics data display and silent token management for uninterrupted user experience (e.g., for OAuth issues).
- **LinkedIn Reports**: 5th tab in LinkedIn Analytics with support for creating, managing, and viewing reports. Report types include Overview, KPIs, Benchmarks, Ad Comparison, and Custom reports. Features include two-step creation modal (type selection → configuration), report listing with metadata, and foundation for download/email/scheduling capabilities.

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

### Future Enhancements
- **Token Persistence**: Store OAuth tokens in database (currently in-memory)
- **Token Refresh**: Implement refresh token flow for long-lived LinkedIn sessions
- **Multi-Account Support**: Multiple LinkedIn connections per user
- **Webhook Integration**: Real-time updates via LinkedIn webhooks
- **Email Delivery**: Resend integration available for report email functionality (not yet implemented)