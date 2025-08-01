import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCampaignSchema, insertMetricSchema, insertIntegrationSchema, insertPerformanceDataSchema } from "@shared/schema";
import { z } from "zod";
import { ga4Service } from "./analytics";
import { googleAuthService } from "./google-auth";
import { professionalGA4Auth } from "./professional-ga4-auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Campaign routes
  app.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      const validatedData = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign(validatedData);
      res.status(201).json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid campaign data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  app.patch("/api/campaigns/:id", async (req, res) => {
    try {
      const validatedData = insertCampaignSchema.partial().parse(req.body);
      const campaign = await storage.updateCampaign(req.params.id, validatedData);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid campaign data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  // Metrics routes
  app.get("/api/metrics", async (req, res) => {
    try {
      const metrics = await storage.getMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  app.post("/api/metrics", async (req, res) => {
    try {
      const validatedData = insertMetricSchema.parse(req.body);
      const metric = await storage.createMetric(validatedData);
      res.status(201).json(metric);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid metric data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create metric" });
    }
  });

  // Integration routes
  app.get("/api/integrations", async (req, res) => {
    try {
      const integrations = await storage.getIntegrations();
      res.json(integrations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  app.post("/api/integrations", async (req, res) => {
    try {
      const validatedData = insertIntegrationSchema.parse(req.body);
      const integration = await storage.createIntegration(validatedData);
      res.status(201).json(integration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid integration data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create integration" });
    }
  });

  app.patch("/api/integrations/:id", async (req, res) => {
    try {
      const validatedData = insertIntegrationSchema.partial().parse(req.body);
      const integration = await storage.updateIntegration(req.params.id, validatedData);
      if (!integration) {
        return res.status(404).json({ message: "Integration not found" });
      }
      res.json(integration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid integration data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update integration" });
    }
  });

  // Performance data routes
  app.get("/api/performance", async (req, res) => {
    try {
      const performanceData = await storage.getPerformanceData();
      res.json(performanceData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch performance data" });
    }
  });

  app.post("/api/performance", async (req, res) => {
    try {
      const validatedData = insertPerformanceDataSchema.parse(req.body);
      const performanceData = await storage.createPerformanceData(validatedData);
      res.status(201).json(performanceData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid performance data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create performance data" });
    }
  });

  // Google Analytics OAuth endpoints
  app.get("/api/auth/google/url", (req, res) => {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      
      if (!clientId) {
        return res.json({
          error: "Google OAuth not configured",
          setup_required: true,
          instructions: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your Replit secrets"
        });
      }
      
      const baseUrl = "https://accounts.google.com/o/oauth2/v2/auth";
      const scopes = [
        "https://www.googleapis.com/auth/analytics.readonly",
        "https://www.googleapis.com/auth/userinfo.email"
      ];
      
      const params = {
        client_id: clientId,
        redirect_uri: `${req.protocol}://${req.get('host')}/api/auth/google/callback`,
        scope: scopes.join(" "),
        response_type: "code",
        access_type: "offline",
        prompt: "select_account",
        include_granted_scopes: "true"
      };
      
      const queryString = new URLSearchParams(params).toString();
      const oauthUrl = `${baseUrl}?${queryString}`;
      
      res.json({ oauth_url: oauthUrl });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code, error, state } = req.query;
    
    if (error) {
      return res.redirect(`/?error=${error}`);
    }
    
    if (!code) {
      return res.redirect("/?error=no_code");
    }
    
    try {
      // Exchange authorization code for access token
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        return res.redirect("/?error=missing_oauth_config");
      }
      
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code as string,
          grant_type: "authorization_code",
          redirect_uri: `${req.protocol}://${req.get('host')}/api/auth/google/callback`,
        }),
      });
      
      const tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok) {
        console.error("Token exchange failed:", tokenData);
        return res.redirect("/?error=token_exchange_failed");
      }
      
      // Store the access token in session or pass it to frontend
      // For now, redirect with the access token (in production, use secure session storage)
      const accessToken = tokenData.access_token;
      res.redirect(`/?google_connected=true&access_token=${accessToken}`);
      
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.redirect("/?error=oauth_callback_failed");
    }
  });

  // GA4 Integration endpoints
  app.post("/api/integrations/ga4/connect", async (req, res) => {
    try {
      const { propertyId, measurementId, accessToken } = req.body;
      
      if (!propertyId || !accessToken) {
        return res.status(400).json({ error: "Property ID and access token are required" });
      }

      // Test the connection first
      const connectionValid = await ga4Service.testConnection({ propertyId, measurementId }, accessToken);
      
      if (!connectionValid) {
        return res.status(400).json({ error: "Unable to connect to GA4. Please verify your Property ID and access token." });
      }

      // Store the integration (without storing the access token for security)
      const integration = await storage.createIntegration({
        platform: "Google Analytics",
        name: "Google Analytics 4",
        connected: true,
        credentials: JSON.stringify({ propertyId, measurementId })
      });

      res.json({ 
        success: true, 
        integration,
        message: "Successfully connected to Google Analytics 4"
      });
    } catch (error) {
      console.error("GA4 connection error:", error);
      res.status(500).json({ 
        error: "Failed to connect to GA4. Please check your credentials and ensure you have the proper Google Analytics Data API access." 
      });
    }
  });

  app.post("/api/campaigns/:id/ga4-metrics", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { dateRange = '30daysAgo', accessToken } = req.body;

      if (!accessToken) {
        return res.status(400).json({ error: "Access token is required" });
      }

      // Find GA4 integration for this campaign
      const integrations = await storage.getIntegrations();
      const ga4Integration = integrations.find(i => i.platform === "Google Analytics" && i.connected);

      if (!ga4Integration || !ga4Integration.credentials) {
        return res.status(404).json({ error: "No GA4 integration found for this campaign" });
      }

      const credentials = JSON.parse(ga4Integration.credentials);
      const metrics = await ga4Service.getMetrics(credentials, accessToken, dateRange as string);

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching GA4 metrics:", error);
      res.status(500).json({ 
        error: "Failed to fetch GA4 metrics. Please ensure your GA4 property is properly configured." 
      });
    }
  });

  app.post("/api/integrations/ga4/test", async (req, res) => {
    try {
      const { propertyId, measurementId, accessToken } = req.body;
      
      if (!propertyId || !accessToken) {
        return res.status(400).json({ error: "Property ID and access token are required" });
      }

      const isValid = await ga4Service.testConnection({ propertyId, measurementId }, accessToken);
      
      res.json({ 
        valid: isValid,
        message: isValid ? "Connection successful" : "Unable to connect. Please verify your credentials." 
      });
    } catch (error) {
      console.error("GA4 test connection error:", error);
      res.status(500).json({ 
        error: "Failed to test GA4 connection",
        valid: false 
      });
    }
  });

  // Google OAuth routes
  app.get("/api/auth/google/url", async (req, res) => {
    try {
      const { campaignId, propertyId } = req.query;
      
      if (!campaignId || !propertyId) {
        return res.status(400).json({ message: "Campaign ID and Property ID are required" });
      }
      
      const authUrl = googleAuthService.generateAuthUrl(campaignId as string, propertyId as string);
      res.json({ authUrl });
    } catch (error) {
      console.error('Auth URL generation error:', error);
      res.status(500).json({ message: "Failed to generate auth URL" });
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;
      
      if (error) {
        return res.redirect(`/?error=${encodeURIComponent(error as string)}`);
      }
      
      if (!code || !state) {
        return res.redirect("/?error=missing_parameters");
      }
      
      const result = await googleAuthService.handleCallback(code as string, state as string);
      
      if (result.success && result.campaignId) {
        res.redirect(`/campaigns?google_connected=true&campaign_id=${result.campaignId}`);
      } else {
        res.redirect(`/?error=${encodeURIComponent(result.error || 'unknown_error')}`);
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect("/?error=callback_failed");
    }
  });

  // Professional GA4 authentication routes
  app.get("/api/auth/google/professional/url", async (req, res) => {
    try {
      const { campaignId, propertyId, userEmail, method } = req.query;
      
      if (!campaignId || !propertyId) {
        return res.status(400).json({ message: "Campaign ID and Property ID are required" });
      }

      // Method 1: Try Service Account first (if configured)
      if (method === 'service-account') {
        const success = await professionalGA4Auth.connectWithServiceAccount(
          propertyId as string, 
          campaignId as string
        );
        
        if (success) {
          return res.json({ 
            success: true, 
            method: 'service-account',
            message: 'Connected via Service Account'
          });
        }
      }

      // Method 2: Domain delegation (if user email provided)
      if (method === 'domain-delegation' && userEmail) {
        const success = await professionalGA4Auth.connectWithDomainDelegation(
          propertyId as string,
          campaignId as string,
          userEmail as string
        );
        
        if (success) {
          return res.json({ 
            success: true, 
            method: 'domain-delegation',
            message: 'Connected via Domain Delegation'
          });
        }
      }

      // Method 3: Professional OAuth flow
      const authUrl = professionalGA4Auth.generateProfessionalOAuthUrl(
        campaignId as string,
        propertyId as string,
        userEmail as string
      );
      
      res.json({ authUrl, method: 'oauth' });
    } catch (error) {
      console.error('Professional auth URL generation error:', error);
      res.status(500).json({ message: "Failed to generate auth URL", error: error.message });
    }
  });

  app.get("/api/auth/google/professional/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;
      
      if (error) {
        return res.redirect(`/?error=${encodeURIComponent(error as string)}`);
      }
      
      if (!code || !state) {
        return res.redirect("/?error=missing_parameters");
      }
      
      const result = await professionalGA4Auth.handleProfessionalCallback(code as string, state as string);
      
      if (result.success && result.campaignId) {
        res.redirect(`/campaigns?professional_connected=true&campaign_id=${result.campaignId}`);
      } else {
        res.redirect(`/?error=${encodeURIComponent(result.error || 'unknown_error')}`);
      }
    } catch (error) {
      console.error('Professional OAuth callback error:', error);
      res.redirect("/?error=professional_callback_failed");
    }
  });

  // Enhanced GA4 metrics with professional authentication
  app.get("/api/campaigns/:id/ga4-metrics", async (req, res) => {
    try {
      const campaignId = req.params.id;
      
      // Try professional authentication first
      let accessToken = await professionalGA4Auth.getValidAccessToken(campaignId);
      let propertyId = professionalGA4Auth.getConnectionInfo(campaignId)?.propertyId;
      
      // Fallback to basic OAuth if professional not available
      if (!accessToken || !propertyId) {
        accessToken = await googleAuthService.getValidAccessToken(campaignId);
        propertyId = googleAuthService.getPropertyId(campaignId);
      }
      
      if (!accessToken || !propertyId) {
        return res.status(401).json({ 
          message: "Google Analytics not connected for this campaign",
          requiresAuth: true,
          authMethods: ['professional', 'basic']
        });
      }
      
      // Fetch metrics using the professional service
      const metrics = await ga4Service.getMetricsWithToken(propertyId, accessToken);
      res.json({
        ...metrics,
        connectionInfo: professionalGA4Auth.getConnectionInfo(campaignId)
      });
    } catch (error) {
      console.error('GA4 metrics error:', error);
      res.status(500).json({ message: "Failed to fetch GA4 metrics" });
    }
  });

  // Service account setup endpoint (for admin use)
  app.post("/api/admin/setup-service-account", async (req, res) => {
    try {
      const { serviceAccountJson } = req.body;
      
      if (!serviceAccountJson) {
        return res.status(400).json({ message: "Service account JSON is required" });
      }
      
      const success = professionalGA4Auth.setupServiceAccount(serviceAccountJson);
      
      if (success) {
        res.json({ message: "Service account configured successfully" });
      } else {
        res.status(400).json({ message: "Failed to configure service account" });
      }
    } catch (error) {
      console.error('Service account setup error:', error);
      res.status(500).json({ message: "Service account setup failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
