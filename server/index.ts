import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes-oauth";
import { setupVite, serveStatic, log } from "./vite";
import { snapshotScheduler } from "./scheduler";
import { executiveSummarySnapshotScheduler } from "./executive-summary-snapshot-scheduler";
import { startKPIScheduler } from "./kpi-scheduler";
import { startReportScheduler, getSchedulerMetrics } from "./report-scheduler";
import { startLinkedInScheduler } from "./linkedin-scheduler";
import { startMetaScheduler } from "./meta-scheduler";
import { startGoogleSheetsTokenScheduler } from "./google-sheets-token-scheduler";
import { getAutoRefreshSchedulerStatus, startDailyAutoRefreshScheduler } from "./auto-refresh-scheduler";
import { getGA4DailySchedulerStatus, startGA4DailyScheduler } from "./ga4-daily-scheduler";
import { startGoogleAdsScheduler } from "./google-ads-scheduler";
import { startInstagramScheduler } from "./instagram-scheduler";
import { startTikTokScheduler } from "./tiktok-scheduler";
import { startAlertEmailScheduler } from "./alert-email-scheduler";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { clerkMiddleware } from "@clerk/express";
import { getFinancialDailySnapshotObservationStatus } from "./utils/financial-daily-snapshot-observation";
import { assertProductionTokenEncryptionConfigured } from "./utils/tokenVault";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

assertProductionTokenEncryptionConfigured();
const app = express();
let applicationReady = false;
app.use((_req, res, next) => {
  if (!applicationReady) {
    res.setHeader("Retry-After", "5");
    return res.status(503).json({ status: "initializing" });
  }
  next();
});

// Set Express environment mode based on NODE_ENV
app.set("env", process.env.NODE_ENV || "development");
// Trust proxy headers on platforms like Render so req.protocol reflects X-Forwarded-Proto (https)
// This prevents OAuth redirect_uri mismatches (http vs https).
app.set("trust proxy", 1);

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://*.clerk.accounts.dev https://*.clerk.com",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://*.protect.clerk.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://accounts.google.com https://analyticsdata.googleapis.com https://cdn.jsdelivr.net https://clerk-telemetry.com https://*.clerk-telemetry.com https://img.clerk.com https://*.clerk.accounts.dev https://*.clerk.com https://*.protect.clerk.com:*",
  "frame-src 'self' https://accounts.google.com https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://*.protect.clerk.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (app.get("env") === "production") {
    res.setHeader("Content-Security-Policy", contentSecurityPolicy);
    if (req.secure) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    }
  }
  next();
});

// ----------------------------------------------------------------------------
// Clerk authentication middleware
// ----------------------------------------------------------------------------
// @clerk/express looks for CLERK_PUBLISHABLE_KEY; fall back to VITE_ prefixed var
if (!process.env.CLERK_PUBLISHABLE_KEY && process.env.VITE_CLERK_PUBLISHABLE_KEY) {
  process.env.CLERK_PUBLISHABLE_KEY = process.env.VITE_CLERK_PUBLISHABLE_KEY;
}
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
  const path = req.path.replace(/^(\/(?:webhook\/custom-integration|email\/inbound)\/)[^/]+/, "$1[redacted]");
  res.on("finish", () => {
    const duration = Date.now() - start;
    let logLine = `${req.method} /api${path} ${res.statusCode} in ${duration}ms`;

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
          autoRefreshScheduler: getAutoRefreshSchedulerStatus(),
          ga4DailyScheduler: getGA4DailySchedulerStatus(),
          financialDailySnapshot: getFinancialDailySnapshotObservationStatus(),
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

      // Bind for infrastructure discovery; health and application requests remain 503 until ready.
      setTimeout(async () => {
        try {
        if (!db) throw new Error('DATABASE_URL is required to initialize the application');
        await db.transaction(async (migrationDb: any) => {
        const db = migrationDb;
        await db.execute(sql`SET LOCAL lock_timeout = '10s'`);
        await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext('mf_schema_startup_v1'))`);
        const base = await db.execute(sql`SELECT to_regclass('campaigns') AS name`);
        if (!base.rows[0]?.name) {
          const existing = await db.execute(sql`SELECT tablename FROM pg_tables WHERE schemaname = current_schema() LIMIT 1`);
          if (existing.rows.length) throw new Error('Incomplete database schema; reviewed upgrade required');
          await db.execute(sql.raw(readFileSync(resolve(process.cwd(), 'migrations/v1-bootstrap.sql'), 'utf8')));
        }
        try {
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

          // Migration: Keep KPI progress history at the same enterprise-scale capacity as live KPI values.
          await db.execute(sql`
            ALTER TABLE kpi_progress
            ALTER COLUMN value TYPE DECIMAL(18, 2),
            ALTER COLUMN rolling_average_7d TYPE DECIMAL(18, 2),
            ALTER COLUMN rolling_average_30d TYPE DECIMAL(18, 2);
          `);

          // Migration 2: Add notifications metadata column
          await db.execute(sql`
            ALTER TABLE notifications 
            ADD COLUMN IF NOT EXISTS metadata TEXT;
          `);

          // Standalone Shopify refresh failures are not Notifications. This exact-kind cleanup
          // preserves KPI, Benchmark, and every unrelated notification row.
          await db.execute(sql`
            DELETE FROM notifications
            WHERE metadata IS NOT NULL
              AND metadata::text ~ '"kind"[[:space:]]*:[[:space:]]*"shopify_revenue_refresh_failure"';
          `);

          // Migration: Email audit events (production-grade observability for alert/report/test sends)
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS email_alert_events (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              kind TEXT NOT NULL DEFAULT 'generic',
              entity_type TEXT,
              entity_id TEXT,
              dedupe_key TEXT,
              campaign_id TEXT,
              campaign_name TEXT,
              "to" TEXT NOT NULL,
              subject TEXT NOT NULL,
              provider TEXT,
              success BOOLEAN NOT NULL DEFAULT false,
              delivery_status TEXT NOT NULL DEFAULT 'pending',
              provider_response_id TEXT,
              attempt_count INTEGER NOT NULL DEFAULT 0,
              last_attempt_at TIMESTAMP,
              next_attempt_at TIMESTAMP,
              delivered_at TIMESTAMP,
              failed_at TIMESTAMP,
              error TEXT,
              metadata TEXT,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);
          await db.execute(sql`
            ALTER TABLE email_alert_events
            ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
            ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS provider_response_id TEXT,
            ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP;
          `);
          await db.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS email_alert_events_dedupe_key_unique
            ON email_alert_events (dedupe_key);
          `);

          // Migration: Add GA4 campaign filter to campaigns (so each MetricMind campaign maps to one GA4 campaign)
          await db.execute(sql`
            ALTER TABLE campaigns
            ADD COLUMN IF NOT EXISTS ga4_campaign_filter TEXT;
          `);
          await db.execute(sql`
            ALTER TABLE campaigns
            ADD COLUMN IF NOT EXISTS reporting_time_zone TEXT NOT NULL DEFAULT 'UTC';
          `);

          // Migration: Add date-only budget pacing boundaries without changing financial campaign dates
          await db.execute(sql`
            ALTER TABLE campaigns
            ADD COLUMN IF NOT EXISTS pacing_start_date TEXT,
            ADD COLUMN IF NOT EXISTS pacing_end_date TEXT;
          `);

          // Migration: Add an idempotent reporting-day identity for forward-only financial snapshots
          await db.execute(sql`
            ALTER TABLE metric_snapshots
            ADD COLUMN IF NOT EXISTS reporting_date TEXT;
          `);
          await db.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS metric_snapshots_financial_day_unique
            ON metric_snapshots (campaign_id, reporting_date)
            WHERE snapshot_type = 'financial_daily' AND reporting_date IS NOT NULL;
          `);
          await db.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS metric_snapshots_executive_summary_day_unique
            ON metric_snapshots (campaign_id, reporting_date)
            WHERE snapshot_type = 'executive_summary_daily' AND reporting_date IS NOT NULL;
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
              engaged_sessions INTEGER,
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
            ALTER TABLE ga4_daily_metrics
            ADD COLUMN IF NOT EXISTS engaged_sessions INTEGER;
          `);

          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_ga4_daily_metrics_campaign_date
            ON ga4_daily_metrics(campaign_id, date);
          `);

          // Atomic GA4 Overview detail payload published by the daily scheduler.
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS ga4_overview_snapshots (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              property_id TEXT NOT NULL,
              window_start TEXT NOT NULL,
              window_end TEXT NOT NULL,
              campaign_breakdown JSONB NOT NULL,
              landing_pages JSONB NOT NULL,
              conversion_events JSONB NOT NULL,
              updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);
          await db.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS ga4_overview_snapshots_campaign_property_unique
            ON ga4_overview_snapshots (campaign_id, property_id);
          `);

          // GA4 connection lifecycle audit and fail-closed protection against silent deactivation.
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS ga4_connection_lifecycle_events (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              connection_id TEXT NOT NULL,
              campaign_id TEXT NOT NULL,
              property_id TEXT,
              action TEXT NOT NULL CHECK (action IN ('connected', 'reactivated', 'disconnected')),
              actor TEXT NOT NULL,
              reason TEXT NOT NULL,
              changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);
          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS ga4_connection_lifecycle_events_connection_changed_idx
            ON ga4_connection_lifecycle_events (connection_id, changed_at DESC);
          `);
          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS ga4_connection_lifecycle_events_campaign_changed_idx
            ON ga4_connection_lifecycle_events (campaign_id, changed_at DESC);
          `);
          await db.execute(sql`
            CREATE OR REPLACE FUNCTION enforce_and_audit_ga4_connection_lifecycle()
            RETURNS TRIGGER
            LANGUAGE plpgsql
            AS $function$
            DECLARE
              lifecycle_actor TEXT := COALESCE(NULLIF(current_setting('app.ga4_connection_actor', true), ''), current_user);
              lifecycle_reason TEXT := NULLIF(current_setting('app.ga4_connection_reason', true), '');
            BEGIN
              IF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
                RAISE EXCEPTION 'GA4_CONNECTION_DEACTIVATION_BLOCKED: use the campaign-scoped disconnect path';
              END IF;
              IF TG_OP = 'INSERT' THEN
                INSERT INTO ga4_connection_lifecycle_events
                  (connection_id, campaign_id, property_id, action, actor, reason)
                VALUES
                  (NEW.id, NEW.campaign_id, NEW.property_id, 'connected', lifecycle_actor,
                   COALESCE(lifecycle_reason, 'ga4_connection_created'));
                RETURN NEW;
              END IF;
              IF TG_OP = 'DELETE' THEN
                INSERT INTO ga4_connection_lifecycle_events
                  (connection_id, campaign_id, property_id, action, actor, reason)
                VALUES
                  (OLD.id, OLD.campaign_id, OLD.property_id, 'disconnected', lifecycle_actor,
                   COALESCE(lifecycle_reason, 'ga4_connection_deleted'));
                RETURN OLD;
              END IF;
              IF OLD.is_active = false AND NEW.is_active = true THEN
                INSERT INTO ga4_connection_lifecycle_events
                  (connection_id, campaign_id, property_id, action, actor, reason)
                VALUES
                  (NEW.id, NEW.campaign_id, NEW.property_id, 'reactivated', lifecycle_actor,
                   COALESCE(lifecycle_reason, 'ga4_connection_reactivated'));
              END IF;
              RETURN NEW;
            END;
            $function$;
          `);
          await db.execute(sql`
            DO $trigger$
            BEGIN
              CREATE TRIGGER ga4_connection_lifecycle_guard
              BEFORE INSERT OR UPDATE OR DELETE ON ga4_connections
              FOR EACH ROW EXECUTE FUNCTION enforce_and_audit_ga4_connection_lifecycle();
            EXCEPTION WHEN duplicate_object THEN
              NULL;
            END;
            $trigger$;
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

          // Migration 6d: Distinguish OAuth from temporary service-account connections.
          await db.execute(sql`
            ALTER TABLE google_sheets_connections
            ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'access_token';
          `);

          // Set existing connections as primary and active (backward compatibility)
          await db.execute(sql`
            UPDATE google_sheets_connections
            SET is_primary = true, is_active = true
            WHERE is_primary IS NULL OR is_active IS NULL;
          `);

          // Migration 6e: Add cached data columns for daily refresh
          await db.execute(sql`
            ALTER TABLE google_sheets_connections
            ADD COLUMN IF NOT EXISTS cached_data JSONB,
            ADD COLUMN IF NOT EXISTS last_data_refresh_at TIMESTAMP;
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

          // Migration 11: Add platformContext to spend_sources, subCampaignUrn to spend_records
          await db.execute(sql`
            ALTER TABLE spend_sources
            ADD COLUMN IF NOT EXISTS platform_context TEXT;
          `);
          await db.execute(sql`
            ALTER TABLE spend_records
            ADD COLUMN IF NOT EXISTS sub_campaign_urn TEXT;
          `);

          // Migration 11b: Add sub_campaign_urn to revenue_records (missed in migration 11)
          await db.execute(sql`
            ALTER TABLE revenue_records
            ADD COLUMN IF NOT EXISTS sub_campaign_urn TEXT;
          `);

          // Migration 12: Campaign selection for Google Ads and Meta
          await db.execute(sql`
            ALTER TABLE google_ads_connections
            ADD COLUMN IF NOT EXISTS selected_campaign_ids TEXT;
          `);
          await db.execute(sql`
            ALTER TABLE meta_connections
            ADD COLUMN IF NOT EXISTS selected_campaign_ids TEXT;
          `);

          // Migration 13: Google Ads ↔ GA4 revenue attribution
          await db.execute(sql`
            ALTER TABLE google_ads_daily_metrics
            ADD COLUMN IF NOT EXISTS ga4_revenue NUMERIC(15,2);
          `);
          await db.execute(sql`
            ALTER TABLE google_ads_daily_metrics
            ADD COLUMN IF NOT EXISTS ga4_utm_name TEXT;
          `);
          await db.execute(sql`
            ALTER TABLE google_ads_connections
            ADD COLUMN IF NOT EXISTS campaign_utm_map TEXT;
          `);

          // Migration 14: Meta + LinkedIn ↔ GA4 revenue attribution
          await db.execute(sql`ALTER TABLE meta_daily_metrics ADD COLUMN IF NOT EXISTS meta_campaign_name TEXT;`);
          await db.execute(sql`ALTER TABLE meta_daily_metrics ADD COLUMN IF NOT EXISTS ga4_revenue NUMERIC(15,2);`);
          await db.execute(sql`ALTER TABLE meta_daily_metrics ADD COLUMN IF NOT EXISTS ga4_utm_name TEXT;`);
          await db.execute(sql`ALTER TABLE meta_connections ADD COLUMN IF NOT EXISTS campaign_utm_map TEXT;`);
          await db.execute(sql`ALTER TABLE linkedin_daily_metrics ADD COLUMN IF NOT EXISTS linkedin_campaign_id TEXT;`);
          await db.execute(sql`ALTER TABLE linkedin_daily_metrics ADD COLUMN IF NOT EXISTS linkedin_campaign_name TEXT;`);
          await db.execute(sql`ALTER TABLE linkedin_daily_metrics ADD COLUMN IF NOT EXISTS ga4_revenue NUMERIC(15,2);`);
          await db.execute(sql`ALTER TABLE linkedin_daily_metrics ADD COLUMN IF NOT EXISTS ga4_utm_name TEXT;`);
          await db.execute(sql`ALTER TABLE linkedin_connections ADD COLUMN IF NOT EXISTS campaign_utm_map TEXT;`);

          // Migration 15: spendOnly flag for connections made from spend wizard
          await db.execute(sql`ALTER TABLE linkedin_connections ADD COLUMN IF NOT EXISTS spend_only BOOLEAN DEFAULT FALSE;`);
          await db.execute(sql`ALTER TABLE meta_connections ADD COLUMN IF NOT EXISTS spend_only BOOLEAN DEFAULT FALSE;`);
          await db.execute(sql`ALTER TABLE google_ads_connections ADD COLUMN IF NOT EXISTS spend_only BOOLEAN DEFAULT FALSE;`);

          // Migration 16: Fix seed integrations — only Google Analytics should be connected by default
          await db.execute(sql`
            UPDATE integrations SET connected = false WHERE platform IN ('facebook', 'linkedin') AND connected = true;
          `);

          // Migration 17: Add lookback_days column to ga4_connections
          await db.execute(sql`
            ALTER TABLE ga4_connections ADD COLUMN IF NOT EXISTS lookback_days INTEGER NOT NULL DEFAULT 90;
          `);

          // Migration 17b: Persist the GA4 Overview initial historical-import boundary
          await db.execute(sql`
            ALTER TABLE ga4_connections ADD COLUMN IF NOT EXISTS import_start_date TEXT;
          `);

          // Migration 18: Instagram connected platform foundation
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS instagram_connections (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              ad_account_id TEXT NOT NULL,
              ad_account_name TEXT,
              access_token TEXT,
              refresh_token TEXT,
              encrypted_tokens JSONB,
              method TEXT NOT NULL,
              selected_campaign_ids TEXT,
              campaign_utm_map TEXT,
              publisher_platform_filter TEXT NOT NULL DEFAULT 'instagram',
              source_contract_version TEXT NOT NULL DEFAULT 'instagram_publisher_platform_v1',
              last_refresh_at TIMESTAMP,
              spend_only BOOLEAN DEFAULT FALSE,
              expires_at TIMESTAMP,
              connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);
          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_instagram_connections_campaign_id
            ON instagram_connections(campaign_id);
          `);
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS instagram_daily_metrics (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              instagram_campaign_id TEXT NOT NULL,
              instagram_campaign_name TEXT,
              date TEXT NOT NULL,
              publisher_platform TEXT NOT NULL DEFAULT 'instagram',
              platform_position TEXT NOT NULL DEFAULT 'unknown',
              impressions INTEGER NOT NULL DEFAULT 0,
              clicks INTEGER NOT NULL DEFAULT 0,
              spend DECIMAL(10, 2) NOT NULL DEFAULT 0,
              conversions DECIMAL(10, 2) NOT NULL DEFAULT 0,
              video_views INTEGER NOT NULL DEFAULT 0,
              actions JSONB,
              ctr DECIMAL(5, 2),
              cpc DECIMAL(10, 2),
              cpm DECIMAL(10, 2),
              cost_per_conversion DECIMAL(10, 2),
              conversion_rate DECIMAL(5, 2),
              ga4_revenue DECIMAL(15, 2),
              ga4_utm_name TEXT,
              imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);
          await db.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_instagram_daily_metrics_unique
            ON instagram_daily_metrics(campaign_id, instagram_campaign_id, date, platform_position);
          `);
          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_instagram_daily_metrics_campaign_date
            ON instagram_daily_metrics(campaign_id, date DESC);
          `);

          // Migration 19: TikTok connected platform foundation
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS tiktok_connections (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              advertiser_id TEXT NOT NULL,
              advertiser_name TEXT,
              access_token TEXT,
              refresh_token TEXT,
              encrypted_tokens JSONB,
              method TEXT NOT NULL,
              selected_campaign_ids TEXT,
              selected_campaign_metadata TEXT,
              reporting_dimensions TEXT,
              reporting_metrics TEXT,
              source_contract_version TEXT NOT NULL DEFAULT 'tiktok_campaign_daily_v1',
              last_refresh_at TIMESTAMP,
              last_error TEXT,
              spend_only BOOLEAN DEFAULT FALSE,
              expires_at TIMESTAMP,
              connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);
          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_tiktok_connections_campaign_id
            ON tiktok_connections(campaign_id);
          `);
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS tiktok_daily_metrics (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              advertiser_id TEXT NOT NULL,
              tiktok_campaign_id TEXT NOT NULL,
              tiktok_campaign_name TEXT,
              date TEXT NOT NULL,
              impressions INTEGER NOT NULL DEFAULT 0,
              clicks INTEGER NOT NULL DEFAULT 0,
              spend DECIMAL(10, 2) NOT NULL DEFAULT 0,
              currency TEXT,
              conversions DECIMAL(10, 2) NOT NULL DEFAULT 0,
              video_views INTEGER NOT NULL DEFAULT 0,
              engagements INTEGER NOT NULL DEFAULT 0,
              ctr DECIMAL(5, 2),
              cpc DECIMAL(10, 2),
              cpm DECIMAL(10, 2),
              cost_per_conversion DECIMAL(10, 2),
              conversion_rate DECIMAL(5, 2),
              raw_metrics JSONB,
              metric_availability JSONB,
              is_estimated BOOLEAN NOT NULL DEFAULT FALSE,
              source_contract_version TEXT NOT NULL DEFAULT 'tiktok_campaign_daily_v1',
              is_simulated BOOLEAN NOT NULL DEFAULT FALSE,
              last_synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);
          await db.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_tiktok_daily_metrics_unique
            ON tiktok_daily_metrics(campaign_id, advertiser_id, tiktok_campaign_id, date, source_contract_version);
          `);
          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS idx_tiktok_daily_metrics_campaign_date
            ON tiktok_daily_metrics(campaign_id, date DESC);
          `);

          log('✅ Database migrations completed successfully');
        } catch (error) {
          throw error;
        }

        // P5.1 storage foundation only; the scheduler does not yet claim these work records.
        try {
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS ga4_refresh_work (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              due_at TIMESTAMPTZ NOT NULL,
              reporting_date TEXT NOT NULL,
              scope_hash TEXT NOT NULL,
              scope JSONB NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending',
              lease_token TEXT,
              lease_expires_at TIMESTAMPTZ,
              started_at TIMESTAMPTZ,
              completed_at TIMESTAMPTZ,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT ga4_refresh_work_state CHECK (
                (status = 'pending' AND lease_token IS NULL AND lease_expires_at IS NULL AND completed_at IS NULL)
                OR (status = 'running' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL AND started_at IS NOT NULL AND completed_at IS NULL)
                OR (status = 'completed' AND lease_token IS NULL AND lease_expires_at IS NULL AND completed_at IS NOT NULL)
              )
            );
          `);
          await db.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS ga4_refresh_work_identity
            ON ga4_refresh_work (campaign_id, due_at, reporting_date, scope_hash);
          `);
          await db.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS ga4_refresh_work_running_campaign
            ON ga4_refresh_work (campaign_id) WHERE status = 'running';
          `);
        } catch (error) {
          throw error;
        }

        try {
          await db.execute(sql`ALTER TABLE ga4_refresh_work ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0`);
          await db.execute(sql`ALTER TABLE ga4_refresh_work ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ`);
          await db.execute(sql`ALTER TABLE ga4_refresh_work ADD COLUMN IF NOT EXISTS retryable BOOLEAN NOT NULL DEFAULT TRUE`);
          await db.execute(sql`ALTER TABLE ga4_refresh_work ADD COLUMN IF NOT EXISTS last_error TEXT`);
          await db.execute(sql`ALTER TABLE ga4_refresh_work ADD COLUMN IF NOT EXISTS suppress_alerts BOOLEAN NOT NULL DEFAULT FALSE`);
        } catch (error) {
          throw error;
        }

        // GA4 Google Ads Spend storage is independent of the existing Connected Platform tables.
        try {
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS ga4_google_ads_spend_connections (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              customer_id TEXT NOT NULL,
              customer_name TEXT,
              manager_account_id TEXT,
              access_token TEXT,
              refresh_token TEXT,
              client_id TEXT,
              client_secret TEXT,
              developer_token TEXT,
              encrypted_tokens JSONB,
              method TEXT NOT NULL,
              spend_only BOOLEAN NOT NULL DEFAULT TRUE,
              last_refresh_at TIMESTAMP,
              expires_at TIMESTAMP,
              connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);
          await db.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS ga4_google_ads_spend_connections_campaign_unique
            ON ga4_google_ads_spend_connections(campaign_id);
          `);
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS ga4_google_ads_spend_daily_metrics (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              campaign_id TEXT NOT NULL,
              google_campaign_id TEXT NOT NULL,
              google_campaign_name TEXT,
              date TEXT NOT NULL,
              impressions INTEGER NOT NULL DEFAULT 0,
              clicks INTEGER NOT NULL DEFAULT 0,
              spend NUMERIC(12, 2) NOT NULL DEFAULT 0,
              imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);
          await db.execute(sql`
            CREATE UNIQUE INDEX IF NOT EXISTS ga4_google_ads_spend_daily_metrics_campaign_day_unique
            ON ga4_google_ads_spend_daily_metrics(campaign_id, google_campaign_id, date);
          `);
          log('GA4 Google Ads Spend storage ready');
        } catch (error) {
          throw error;
        }

        // Explicit additive manifest: historical backfill and cleanup scripts are excluded.
        for (const migration of ['0022_v1_entrypoint_ownership.sql', '0023_service_account_resource_grants.sql', '0024_v1_schema_integrity.sql']) {
          const statement = readFileSync(resolve(process.cwd(), 'migrations', migration), 'utf8')
            .replace(/^(?:BEGIN|COMMIT);[ \t]*\r?$/gm, ''); // The enclosing transaction owns commit/rollback.
          await db.execute(sql.raw(statement));
        }
        });

        // Start automated snapshot scheduler
        try {
          snapshotScheduler.start();
        } catch (error) {
          console.error('Failed to start snapshot scheduler:', error);
          throw error;
        }

        try {
          executiveSummarySnapshotScheduler.start(port);
        } catch (error) {
          console.error('Failed to start Executive Summary snapshot scheduler:', error);
          throw error;
        }

        // Start KPI scheduler
        try {
          startKPIScheduler();
        } catch (error) {
          console.error('Failed to start KPI scheduler:', error);
          throw error;
        }

        // Start Report scheduler
        try {
          startReportScheduler();
        } catch (error) {
          console.error('Failed to start report scheduler:', error);
          throw error;
        }

        // Start LinkedIn data refresh scheduler
        try {
          startLinkedInScheduler();
        } catch (error) {
          console.error('Failed to start LinkedIn scheduler:', error);
          throw error;
        }

        // Start Meta/Facebook data refresh scheduler
        try {
          startMetaScheduler();
        } catch (error) {
          console.error('Failed to start Meta scheduler:', error);
          throw error;
        }

        // Start Google Sheets token refresh scheduler
        try {
          startGoogleSheetsTokenScheduler();
        } catch (error) {
          console.error('Failed to start Google Sheets token refresh scheduler:', error);
          throw error;
        }

        // Start daily auto-refresh + auto-process scheduler (LinkedIn refresh + HubSpot/Salesforce/Shopify revenue reprocess)
        try {
          startDailyAutoRefreshScheduler();
        } catch (error) {
          console.error('Failed to start daily auto-refresh scheduler:', error);
          throw error;
        }

        // Start GA4 daily refresh scheduler (persisted daily facts)
        try {
          startGA4DailyScheduler(port);
        } catch (error) {
          console.error('Failed to start GA4 daily scheduler:', error);
          throw error;
        }

        // Start Google Ads data refresh scheduler
        try {
          startGoogleAdsScheduler();
        } catch (error) {
          console.error('Failed to start Google Ads scheduler:', error);
          throw error;
        }

        // Start Instagram data refresh scheduler
        try {
          startInstagramScheduler();
        } catch (error) {
          console.error('Failed to start Instagram scheduler:', error);
          throw error;
        }

        // Start TikTok data refresh scheduler
        try {
          startTikTokScheduler();
        } catch (error) {
          console.error('Failed to start TikTok scheduler:', error);
          throw error;
        }

        // Start alert email reminder scheduler
        try {
          startAlertEmailScheduler();
        } catch (error) {
          console.error('Failed to start alert email scheduler:', error);
          throw error;
        }
        applicationReady = true;
        } catch (error) {
          applicationReady = false;
          console.error('Application initialization failed:', error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }, 5000); // Readiness remains false during the delay.
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
