import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes-oauth";
import { setupVite, serveStatic, log } from "./vite";
import { snapshotScheduler } from "./scheduler";
import { startKPIScheduler } from "./kpi-scheduler";
import { startReportScheduler } from "./report-scheduler";
import { startLinkedInScheduler } from "./linkedin-scheduler";
import { startGoogleSheetsTokenScheduler } from "./google-sheets-token-scheduler";
import { startDailyAutoRefreshScheduler } from "./auto-refresh-scheduler";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = express();

// Set Express environment mode based on NODE_ENV
app.set("env", process.env.NODE_ENV || "development");

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
          log('Running database migrations...');
          
          // Migration 1: Add KPI campaign scope columns
          await db.execute(sql`
            ALTER TABLE kpis 
            ADD COLUMN IF NOT EXISTS apply_to TEXT DEFAULT 'all',
            ADD COLUMN IF NOT EXISTS specific_campaign_id TEXT;
          `);
          
          // Migration 2: Add notifications metadata column
          await db.execute(sql`
            ALTER TABLE notifications 
            ADD COLUMN IF NOT EXISTS metadata TEXT;
          `);

          // Migration: Add GA4 campaign filter to campaigns (so each MetricMind campaign maps to one GA4 campaign)
          await db.execute(sql`
            ALTER TABLE campaigns
            ADD COLUMN IF NOT EXISTS ga4_campaign_filter TEXT;
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
      }, 5000); // 5 second delay
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
