# MarketPulse - Marketing Dashboard

## Overview

MarketPulse is a modern web application for tracking marketing campaign performance and metrics. It provides a comprehensive dashboard for managing advertising campaigns across multiple platforms, monitoring key performance indicators, and integrating with various marketing services.

The application is built as a full-stack solution with a React frontend and Express.js backend, utilizing modern web technologies and a clean architectural pattern.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Python with FastAPI framework
- **Language**: Python 3.11 with type hints and Pydantic models
- **Data Layer**: SQLAlchemy ORM with PostgreSQL support (in-memory storage for development)
- **API Design**: RESTful APIs with automatic OpenAPI documentation
- **Development**: Hot reload with Uvicorn server
- **Legacy**: Node.js/TypeScript backend available for reference (server/ directory)

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: Strongly typed database schemas with Zod validation
- **Migrations**: Drizzle Kit for database migrations
- **Development Storage**: In-memory storage class for development/testing

## Key Components

### Data Models
- **Campaigns**: Marketing campaigns with metrics (impressions, clicks, spend)
- **Metrics**: Key performance indicators with trend data
- **Integrations**: Third-party platform connections (Facebook, Google, LinkedIn)
- **Performance Data**: Time-series performance metrics

### Frontend Components
- **Dashboard**: Main analytics view with metrics cards, charts, and campaign tables
- **Integrations**: Platform connection management
- **UI Components**: Comprehensive component library based on Radix UI
- **Charts**: Performance visualizations using Recharts

### Backend Services
- **Storage Interface**: Abstracted data layer supporting multiple implementations
- **API Routes**: RESTful endpoints for CRUD operations
- **Validation**: Schema validation using Zod
- **Error Handling**: Centralized error handling middleware

## Data Flow

1. **Client Requests**: Frontend makes API calls using TanStack Query
2. **API Layer**: Express.js routes handle requests with validation
3. **Storage Layer**: Abstract storage interface processes data operations
4. **Database**: PostgreSQL stores persistent data via Drizzle ORM
5. **Response**: Typed responses sent back to frontend components
6. **UI Updates**: React Query manages cache updates and re-renders

## External Dependencies

### Production Dependencies
- **Database**: Neon Database (PostgreSQL)
- **UI Components**: Radix UI primitives
- **Charts**: Recharts for data visualization
- **Validation**: Zod for runtime type checking
- **Forms**: React Hook Form for form management

### Development Tools
- **Build**: Vite with TypeScript support
- **Linting**: ESLint configuration
- **Styling**: Tailwind CSS with PostCSS
- **Development**: Hot reload and error overlay

### Third-party Integrations
- **Marketing Platforms**: Facebook Ads, Google Analytics, LinkedIn Ads
- **Authentication**: Prepared for OAuth integration flows
- **API Connections**: Credential management for platform APIs

## Deployment Strategy

### Development
- **Local Development**: Vite dev server with Express backend
- **Hot Reload**: Automatic refresh for frontend and backend changes
- **Environment**: Development mode with debugging enabled

### Production Build
- **Frontend**: Vite production build with optimization
- **Backend**: ESBuild compilation to single JavaScript file
- **Assets**: Static file serving from Express
- **Environment**: Production configuration with performance optimizations

### Database Setup
- **Migrations**: Drizzle Kit for schema management
- **Connection**: Environment-based database URL configuration
- **Seeding**: Empty state initialization (no mock data)

## Recent Changes

### August 2025 - Complete Multi-Platform Integration & Auto-Refresh
- **Real-Time GA4 API**: Implemented authentic Google Analytics Data API v1 integration
- **OAuth Flow**: Built complete OAuth 2.0 flow for Google Analytics access with popup authentication
- **Live Metrics**: Users can connect real GA4 accounts and pull live data (sessions, pageviews, conversions, bounce rate)
- **Property Selection**: Dynamic GA4 property discovery and selection interface
- **Token Management**: Automatic token refresh and connection persistence 
- **Dual Mode**: Supports both real Google OAuth (when API keys provided) and realistic simulation mode
- **Integration Fixed**: Resolved routing conflicts and popup authentication issues for seamless user experience
- **Google Sheets Integration**: Complete end-to-end Google Sheets data integration with OAuth authentication
- **Professional Data Display**: Created comprehensive marketing SaaS interface for viewing Google Sheets data with summary metrics and tabular raw data
- **Connection Transfer System**: Implemented seamless connection transfer from temporary to permanent campaigns
- **Dynamic Platform Detection**: Built smart platform detection system that identifies connected services during campaign creation
- **Auto-Refresh System**: Implemented comprehensive auto-refresh functionality with configurable intervals (10s, 30s, 1min, 5min)
- **Data Display Fix**: Resolved critical column mapping bug that prevented summary metrics calculation from Google Sheets data
- **Real-Time Sync**: Platform now correctly processes and displays millions of data points from authentic Google Sheets sources

### January 2025 - Python Backend Refactor  
- **Backend Migration**: Converted Express.js/TypeScript backend to Python/FastAPI
- **API Structure**: Created modular Python API with models, storage, and endpoints  
- **Type Safety**: Implemented Pydantic models for request/response validation
- **Data Management**: Built abstract storage interface with in-memory implementation
- **Development Setup**: Configured Python environment with FastAPI and Uvicorn

The application now features complete Google Analytics integration with real-time data access, while maintaining the hybrid React/TypeScript frontend and Node.js backend architecture for optimal performance and developer experience.