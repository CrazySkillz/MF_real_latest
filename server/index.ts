import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes-oauth";
import { setupVite, serveStatic, log } from "./vite";
import { snapshotScheduler } from "./scheduler";
import { startKPIScheduler } from "./kpi-scheduler";
import { startReportScheduler, getSchedulerMetrics } from "./report-scheduler";
import { startLinkedInScheduler } from "./linkedin-scheduler";
import { startGoogleSheetsTokenScheduler } from "./google-sheets-token-scheduler";
import { startDailyAutoRefreshScheduler } from "./auto-refresh-scheduler";
import { startGA4DailyScheduler } from "./ga4-daily-scheduler";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { clerkMiddleware } from "@clerk/express";

const app = express();

// Set Express environment mode based on NODE_ENV
app.set("env", process.env.NODE_ENV || "development");
// Trust proxy headers on platforms like Render so req.protocol reflects X-Forwarded-Proto (https)
// This prevents OAuth redirect_uri mismatches (http vs https).
app.set("trust proxy", 1);

// ----------------------------------------------------------------------------
// Clerk authentication middleware
// ----------------------------------------------------------------------------
app.use(clerkMiddleware());

// Conditionally apply body parsing - skip for webhook routes that use multer
app.use((req, res, next) => {
  // Skip body parsing for Mailgun/SendGrid inbound webhooks (they use multer for multipart/form-data)
  if (req.path === '/api/mailgun/inbound' || req.path === '/api/sendgrid/inbound') {
    return next();
  }
  // Apply body parsing for all other routes
  express.json()(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ extended: false })(req, res, next);
  });
});

// API routes middleware - ensure all API routes are handled first
app.use('/api', (req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    let logLine = `${req.method} /api${path} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }

    if (logLine.length > 80) {
      logLine = logLine.slice(0, 79) + "…";
    }

    log(logLine);
  });

  next();
});

// Global error handlers to prevent server crashes
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  console.error('Stack:', reason?.stack || 'No stack trace');
  // Don't exit the process - let the server continue running
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit the process - let the server continue running
  // In production, you might want to gracefully shutdown here
});

(async () => {
  try {
    const server = await registerRoutes(app);

    // Health check endpoint for monitoring
    app.get('/health/scheduler', (_req: Request, res: Response) => {
      try {
        const metrics = getSchedulerMetrics();
        res.json({
          status: 'healthy',
          scheduler: metrics,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
      }
    });

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen(port, "0.0.0.0", () => {
      log(`serving on port ${port}`);

      // Run database migrations on startup
      setTimeout(async () => {
        try {
          if (!db) {
            log('No DATABASE_URL configured; skipping database migrations and schedulers (using in-memory storage).');
            return;
          }
          log('Running database migrations...');

          // Migration: Campaign ownership (authorization)
          await db.execute(sql`
            ALTER TABLE campaigns
            ADD COLUMN IF NOT EXISTS owner_id TEXT;
          `);
          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_campaigns_owner_id ON campaigns(owner_id);
          `);

          // Migration: encrypted token storage for integrations (tokens/secrets at rest)
          await db.execute(sql`
            ALTER TABLE ga4_connections
            ADD COLUMN IF NOT EXISTS encrypted_tokens JSONB;
          `);
          await db.execute(sql`
            ALTER TABLE google_sheets_connections
            ADD COLUMN IF NOT EXISTS encrypted_tokens JSONB;
          `);
          await db.execute(sql`
            ALTER TABLE linkedin_connections
            ADD COLUMN IF NOT EXISTS encrypted_tokens JSONB;
          `);
          await db.execute(sql`
            ALTER TABLE hubspot_connections
            ADD COLUMN IF NOT EXISTS encrypted_tokens JSONB;
          `);
          await db.execute(sql`
            ALTER TABLE salesforce_connections
            ADD COLUMN IF NOT EXISTS encrypted_tokens JSONB;
          `);
          await db.execute(sql`
            ALTER TABLE shopify_connections
            ADD COLUMN IF NOT EXISTS encrypted_tokens JSONB;
          `);
          await db.execute(sql`
            ALTER TABLE meta_connections
            ADD COLUMN IF NOT EXISTS encrypted_tokens JSONB;
          `);

          // Migration 1: Add KPI campaign scope columns
          await db.execute(sql`
            ALTER TABLE kpis 
            ADD COLUMN IF NOT EXISTS apply_to TEXT DEFAULT 'all',
            ADD COLUMN IF NOT EXISTS specific_campaign_id TEXT;
          `);

          // Migration: Add KPI calculation config (stores user-selected source inputs for blended campaign KPIs)
          await db.execute(sql`
            ALTER TABLE kpis
            ADD COLUMN IF NOT EXISTS calculation_config JSONB;
          `);

          // Migration: Add Benchmark calculation config (stores user-selected source inputs for campaign-level benchmarks)
          await db.execute(sql`
            ALTER TABLE benchmarks
            ADD COLUMN IF NOT EXISTS calculation_config JSONB;
          `);

          // Migration: Widen KPI numeric columns to avoid DECIMAL overflow for enterprise-scale values.
          await db.execute(sql`
            ALTER TABLE kpis
            ALTER COLUMN target_value TYPE DECIMAL(18, 2),
            ALTER COLUMN current_value TYPE DECIMAL(18, 2),
            ALTER COLUMN last_computed_value TYPE DECIMAL(18, 2),
            ALTER COLUMN alert_threshold TYPE DECIMAL(18, 2);
          `);

          // Migration 2: Add notifications metadata column
          await db.execute(sql`
            ALTER TABLE notifications 
            ADD COLUMN IF NOT EXISTS metadata TEXT;
          `);

          // Migration: Email audit events (production-grade observability for alert/report/test sends)
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS email_alert_events (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              kind TEXT NOT NULL DEFAULT 'generic',
              entity_type TEXT,
              entity_id TEXT,
              campaign_id TEXT,
              campaign_name TEXT,
              "to" TEXT NOT NULL,
              subject TEXT NOT NULL,
              provider TEXT,
              success BOOLEAN NOT NULL DEFAULT false,
              error TEXT,
              metadata TEXT,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // Migration: Add GA4 campaign filter to campaigns (so each MetricMind campaign maps to one GA4 campaign)
          await db.execute(sql`
            ALTER TABLE campaigns
            ADD COLUMN IF NOT EXISTS ga4_campaign_filter TEXT;
          `);

          // GA4 daily metrics (persisted daily facts powering "daily values" GA4 UI)
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS ga4_daily_metrics (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              property_id TEXT NOT NULL,
              date TEXT NOT NULL,
              users INTEGER NOT NULL DEFAULT 0,
              sessions INTEGER NOT NULL DEFAULT 0,
              pageviews INTEGER NOT NULL DEFAULT 0,
              conversions INTEGER NOT NULL DEFAULT 0,
              revenue DECIMAL(15, 2) NOT NULL DEFAULT 0,
              engagement_rate DECIMAL(7, 4) DEFAULT 0,
              revenue_metric TEXT,
              is_simulated BOOLEAN NOT NULL DEFAULT false,
              updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE (campaign_id, property_id, date)
            );
          `);

          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_ga4_daily_metrics_campaign_date
            ON ga4_daily_metrics(campaign_id, date);
          `);

          // LinkedIn daily metrics (persisted daily facts powering LinkedIn Insights anomaly detection)
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS linkedin_daily_metrics (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              date TEXT NOT NULL,
              impressions INTEGER NOT NULL DEFAULT 0,
              clicks INTEGER NOT NULL DEFAULT 0,
              reach INTEGER NOT NULL DEFAULT 0,
              engagements INTEGER NOT NULL DEFAULT 0,
              conversions INTEGER NOT NULL DEFAULT 0,
              leads INTEGER NOT NULL DEFAULT 0,
              spend DECIMAL(15, 2) NOT NULL DEFAULT 0,
              video_views INTEGER NOT NULL DEFAULT 0,
              viral_impressions INTEGER NOT NULL DEFAULT 0,
              updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE (campaign_id, date)
            );
          `);

          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_linkedin_daily_metrics_campaign_date
            ON linkedin_daily_metrics(campaign_id, date);
          `);

          // LinkedIn connections: track last successful refresh (used for data coverage UI across tabs)
          await db.execute(sql`
            ALTER TABLE linkedin_connections
            ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMP;
          `);

          // Reports: ensure schedule fields exist + add snapshots/send-events tables (production-grade auditability)
          await db.execute(sql`
            ALTER TABLE linkedin_reports
            ADD COLUMN IF NOT EXISTS schedule_time_zone TEXT,
            ADD COLUMN IF NOT EXISTS quarter_timing TEXT;
          `);

          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS report_snapshots (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              report_id TEXT NOT NULL,
              campaign_id TEXT,
              platform_type TEXT NOT NULL DEFAULT 'linkedin',
              report_type TEXT NOT NULL,
              window_start TEXT,
              window_end TEXT,
              snapshot_json TEXT NOT NULL,
              has_estimated BOOLEAN NOT NULL DEFAULT false,
              generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);

          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS report_send_events (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              report_id TEXT NOT NULL,
              snapshot_id TEXT,
              scheduled_key TEXT NOT NULL,
              time_zone TEXT,
              recipients TEXT[],
              status TEXT NOT NULL DEFAULT 'pending',
              error TEXT,
              sent_at TIMESTAMP,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);

          await db.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS ux_report_send_events_report_scheduled_key
            ON report_send_events(report_id, scheduled_key);
          `);

          // Spend tables for GA4 financials (generic spend ingestion from any source)
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS spend_sources (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              source_type TEXT NOT NULL,
              display_name TEXT,
              currency TEXT,
              mapping_config TEXT,
              is_active BOOLEAN NOT NULL DEFAULT true,
              connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);

          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS spend_records (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              spend_source_id TEXT NOT NULL,
              date TEXT NOT NULL,
              spend DECIMAL(12, 2) NOT NULL,
              currency TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // Revenue tables for GA4 revenue fallback (manual/CSV/Sheets + CRM/Ecommerce connectors)
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS revenue_sources (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              source_type TEXT NOT NULL,
              platform_context TEXT,
              display_name TEXT,
              currency TEXT,
              mapping_config TEXT,
              is_active BOOLEAN NOT NULL DEFAULT true,
              connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // Migration: platform-scoped revenue sources (LinkedIn vs GA4). Legacy rows may be null (treated as GA4).
          await db.execute(sql`
            ALTER TABLE revenue_sources
            ADD COLUMN IF NOT EXISTS platform_context TEXT;
          `);

          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS revenue_records (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              revenue_source_id TEXT NOT NULL,
              date TEXT NOT NULL,
              revenue DECIMAL(12, 2) NOT NULL,
              currency TEXT,
              external_id TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // Migration 3: Create KPI periods table
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS kpi_periods (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              kpi_id TEXT NOT NULL,
              period_start TIMESTAMP NOT NULL,
              period_end TIMESTAMP NOT NULL,
              period_type TEXT NOT NULL,
              period_label TEXT NOT NULL,
              final_value DECIMAL(10, 2) NOT NULL,
              target_value DECIMAL(10, 2) NOT NULL,
              unit TEXT NOT NULL,
              target_achieved BOOLEAN NOT NULL,
              performance_percentage DECIMAL(5, 2),
              performance_level TEXT,
              previous_period_value DECIMAL(10, 2),
              change_amount DECIMAL(10, 2),
              change_percentage DECIMAL(5, 2),
              trend_direction TEXT,
              notes TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // Create indexes
          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_kpi_periods_kpi_id ON kpi_periods(kpi_id);
          `);

          // Migration 4: Create conversion_events table
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS conversion_events (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              conversion_id TEXT,
              value DECIMAL(10, 2) NOT NULL,
              currency TEXT NOT NULL DEFAULT 'USD',
              conversion_type TEXT,
              source TEXT NOT NULL,
              metadata JSONB,
              occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // Create index for conversion_events
          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_conversion_events_campaign_id ON conversion_events(campaign_id);
          `);

          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_conversion_events_occurred_at ON conversion_events(occurred_at);
          `);

          // Migration 5: Add conversionValue to platform connection tables
          await db.execute(sql`
            ALTER TABLE linkedin_connections 
            ADD COLUMN IF NOT EXISTS conversion_value DECIMAL(10, 2);
          `);

          await db.execute(sql`
            ALTER TABLE meta_connections 
            ADD COLUMN IF NOT EXISTS conversion_value DECIMAL(10, 2);
          `);

          // Migration 6: Add isPrimary and isActive to google_sheets_connections for multiple sheets support
          await db.execute(sql`
            ALTER TABLE google_sheets_connections 
            ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
            ADD COLUMN IF NOT EXISTS column_mappings TEXT;
          `);

          // Migration 6b: Ensure sheet_name exists (older DBs created before multi-tab support)
          await db.execute(sql`
            ALTER TABLE google_sheets_connections
            ADD COLUMN IF NOT EXISTS sheet_name TEXT;
          `);

          // Migration 6c: Purpose-scoped Google Sheets connections (Spend vs Revenue should not leak)
          await db.execute(sql`
            ALTER TABLE google_sheets_connections
            ADD COLUMN IF NOT EXISTS purpose TEXT;
          `);

          // Set existing connections as primary and active (backward compatibility)
          await db.execute(sql`
            UPDATE google_sheets_connections 
            SET is_primary = true, is_active = true 
            WHERE is_primary IS NULL OR is_active IS NULL;
          `);

          // Migration 7: Create mapping_templates table
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS mapping_templates (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              name TEXT NOT NULL,
              description TEXT,
              platform TEXT NOT NULL,
              column_structure TEXT NOT NULL,
              mappings TEXT NOT NULL,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              last_used_at TIMESTAMP,
              usage_count INTEGER DEFAULT 0,
              created_by TEXT,
              is_shared BOOLEAN DEFAULT false
            );
          `);

          // Migration 8: HubSpot connections (CRM revenue source)
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS hubspot_connections (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              portal_id TEXT,
              portal_name TEXT,
              access_token TEXT,
              refresh_token TEXT,
              client_id TEXT,
              client_secret TEXT,
              expires_at TIMESTAMP,
              is_active BOOLEAN NOT NULL DEFAULT true,
              mapping_config TEXT,
              connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // Backward-compat: ensure newer columns exist if table was created earlier
          await db.execute(sql`
            ALTER TABLE hubspot_connections
            ADD COLUMN IF NOT EXISTS mapping_config TEXT,
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
          `);

          // Migration 9: Salesforce connections (CRM revenue source)
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS salesforce_connections (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              org_id TEXT,
              org_name TEXT,
              instance_url TEXT,
              access_token TEXT,
              refresh_token TEXT,
              client_id TEXT,
              client_secret TEXT,
              expires_at TIMESTAMP,
              is_active BOOLEAN NOT NULL DEFAULT true,
              mapping_config TEXT,
              connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);

          await db.execute(sql`
            ALTER TABLE salesforce_connections
            ADD COLUMN IF NOT EXISTS org_id TEXT,
            ADD COLUMN IF NOT EXISTS org_name TEXT,
            ADD COLUMN IF NOT EXISTS instance_url TEXT,
            ADD COLUMN IF NOT EXISTS mapping_config TEXT,
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
          `);

          // Migration 10: Shopify connections (Ecommerce revenue source)
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS shopify_connections (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              shop_domain TEXT NOT NULL,
              shop_name TEXT,
              access_token TEXT,
              is_active BOOLEAN NOT NULL DEFAULT true,
              mapping_config TEXT,
              connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);

          await db.execute(sql`
            ALTER TABLE shopify_connections
            ADD COLUMN IF NOT EXISTS shop_domain TEXT,
            ADD COLUMN IF NOT EXISTS shop_name TEXT,
            ADD COLUMN IF NOT EXISTS access_token TEXT,
            ADD COLUMN IF NOT EXISTS mapping_config TEXT,
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
          `);

          log('✅ Database migrations completed successfully');
        } catch (error) {
          console.error('⚠️  Migration warning (may already exist):', error.message);
        }

        // Start automated snapshot scheduler
        try {
          snapshotScheduler.start();
        } catch (error) {
          console.error('Failed to start snapshot scheduler:', error);
        }

        // Start KPI scheduler
        try {
          startKPIScheduler();
        } catch (error) {
          console.error('Failed to start KPI scheduler:', error);
        }

        // Start Report scheduler
        try {
          startReportScheduler();
        } catch (error) {
          console.error('Failed to start report scheduler:', error);
        }

        // Start LinkedIn data refresh scheduler
        try {
          startLinkedInScheduler();
        } catch (error) {
          console.error('Failed to start LinkedIn scheduler:', error);
        }

        // Start Google Sheets token refresh scheduler
        try {
          startGoogleSheetsTokenScheduler();
        } catch (error) {
          console.error('Failed to start Google Sheets token refresh scheduler:', error);
        }

        // Start daily auto-refresh + auto-process scheduler (LinkedIn refresh + HubSpot/Salesforce/Shopify revenue reprocess)
        try {
          startDailyAutoRefreshScheduler();
        } catch (error) {
          console.error('Failed to start daily auto-refresh scheduler:', error);
        }

        // Start GA4 daily refresh scheduler (persisted daily facts)
        try {
          startGA4DailyScheduler();
        } catch (error) {
          console.error('Failed to start GA4 daily scheduler:', error);
        }
      }, 5000); // 5 second delay
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
