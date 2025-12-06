import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes-oauth";
import { setupVite, serveStatic, log } from "./vite";
import { snapshotScheduler } from "./scheduler";
import { startKPIScheduler } from "./kpi-scheduler";
import { startReportScheduler } from "./report-scheduler";
import { startLinkedInScheduler } from "./linkedin-scheduler";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = express();

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
      }, 5000); // 5 second delay
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
