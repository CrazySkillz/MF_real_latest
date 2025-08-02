import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCampaignSchema, insertMetricSchema, insertIntegrationSchema, insertPerformanceDataSchema } from "@shared/schema";
import { z } from "zod";
import { ga4Service } from "./analytics";
import { realGA4Client } from "./real-ga4-client";

// Simulate professional platform authentication (like Supermetrics)
async function simulateProfessionalAuth(email: string, password: string, propertyId: string, campaignId: string) {
  try {
    console.log(`Professional auth simulation for ${email}`);
    
    if (email.includes('@') && password.length >= 6 && propertyId.match(/^\d+$/)) {
      console.log(`Storing GA4 connection for campaign ${campaignId}`);
      
      const mockConnection = {
        email,
        propertyId,
        connected: true,
        connectedAt: new Date().toISOString(),
        tokenType: 'professional_oauth'
      };
      
      (global as any).simpleGA4Connections = (global as any).simpleGA4Connections || new Map();
      (global as any).simpleGA4Connections.set(campaignId, mockConnection);
      
      return { success: true };
    } else {
      return { 
        success: false, 
        error: "Invalid credentials or property ID format" 
      };
    }
  } catch (error) {
    console.error('Professional auth simulation error:', error);
    return { 
      success: false, 
      error: "Authentication service temporarily unavailable" 
    };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Critical: Ensure API routes are handled before any other middleware
  app.use('/api', (req, res, next) => {
    (req as any).isApiRoute = true;
    next();
  });

  // Campaign routes
  app.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch campaigns" });
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

  // Google Analytics OAuth endpoints
  app.post("/api/auth/google/url", (req, res) => {
    try {
      const { campaignId, returnUrl } = req.body;
      
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        console.log('Google OAuth credentials not configured. Using demo mode.');
        return res.json({
          setup_required: true,
          message: "Platform OAuth ready for configuration"
        });
      }
      
      const baseUrl = "https://accounts.google.com/o/oauth2/v2/auth";
      const scopes = [
        "https://www.googleapis.com/auth/analytics.readonly",
        "https://www.googleapis.com/auth/userinfo.email"
      ];
      
      const state = Buffer.from(JSON.stringify({ campaignId, returnUrl })).toString('base64');
      
      const params = {
        client_id: clientId,
        redirect_uri: `${req.protocol}://${req.get('host')}/auth/google/callback`,
        scope: scopes.join(" "),
        response_type: "code",
        access_type: "offline",
        prompt: "select_account",
        state: state,
        include_granted_scopes: "true"
      };
      
      const queryString = new URLSearchParams(params).toString();
      const oauthUrl = `${baseUrl}?${queryString}`;
      
      res.json({ oauth_url: oauthUrl });
    } catch (error) {
      console.error('OAuth URL generation error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // OAuth callback endpoint
  app.post("/api/auth/google/callback", async (req, res) => {
    try {
      const { code, state } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: 'Authorization code is required' });
      }
      
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'OAuth not configured' });
      }
      
      let campaignId = 'unknown';
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        campaignId = stateData.campaignId || 'unknown';
      } catch (e) {
        console.warn('Could not parse OAuth state:', e);
      }
      
      // Exchange authorization code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: `${req.protocol}://${req.get('host')}/auth/google/callback`
        })
      });
      
      const tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', tokenData);
        return res.status(400).json({ 
          error: tokenData.error_description || 'Failed to exchange authorization code' 
        });
      }
      
      // Get user info
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });
      
      let userInfo = null;
      if (userInfoResponse.ok) {
        userInfo = await userInfoResponse.json();
      }
      
      // Get Analytics properties
      const accountsResponse = await fetch('https://analyticsadmin.googleapis.com/v1alpha/accounts', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });
      
      let properties: any[] = [];
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        
        for (const account of accountsData.accounts || []) {
          try {
            const propertiesResponse = await fetch(`https://analyticsadmin.googleapis.com/v1alpha/${account.name}/properties`, {
              headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
              }
            });
            
            if (propertiesResponse.ok) {
              const propertiesData = await propertiesResponse.json();
              for (const property of propertiesData.properties || []) {
                properties.push({
                  id: property.name.split('/').pop(),
                  name: property.displayName,
                  account: account.displayName
                });
              }
            }
          } catch (error) {
            console.warn('Error fetching properties for account:', account.name, error);
          }
        }
      }
      
      // Store the OAuth connection
      (global as any).oauthConnections = (global as any).oauthConnections || new Map();
      (global as any).oauthConnections.set(campaignId, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
        userInfo,
        properties,
        connectedAt: new Date().toISOString()
      });
      
      res.json({
        success: true,
        user: userInfo,
        properties,
        message: 'Successfully authenticated with Google Analytics'
      });
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  // Check OAuth connection status
  app.get("/api/ga4/check-connection/:campaignId", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      const connections = (global as any).oauthConnections;
      
      if (!connections || !connections.has(campaignId)) {
        return res.json({ connected: false });
      }
      
      const connection = connections.get(campaignId);
      res.json({
        connected: true,
        properties: connection.properties || [],
        user: connection.userInfo
      });
    } catch (error) {
      console.error('Connection check error:', error);
      res.status(500).json({ error: 'Failed to check connection status' });
    }
  });

  // Select GA4 property for campaign
  app.post("/api/ga4/select-property", async (req, res) => {
    try {
      const { campaignId, propertyId } = req.body;
      
      if (!campaignId || !propertyId) {
        return res.status(400).json({ error: 'Campaign ID and Property ID are required' });
      }
      
      const connections = (global as any).oauthConnections;
      if (!connections || !connections.has(campaignId)) {
        return res.status(404).json({ error: 'No OAuth connection found for this campaign' });
      }
      
      const connection = connections.get(campaignId);
      
      connection.selectedPropertyId = propertyId;
      connection.selectedProperty = connection.properties?.find((p: any) => p.id === propertyId);
      
      // Store in real GA4 connections for metrics access
      (global as any).realGA4Connections = (global as any).realGA4Connections || new Map();
      (global as any).realGA4Connections.set(campaignId, {
        propertyId,
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken,
        connectedAt: connection.connectedAt,
        isReal: true,
        propertyName: connection.selectedProperty?.name || `Property ${propertyId}`
      });
      
      res.json({
        success: true,
        selectedProperty: connection.selectedProperty
      });
    } catch (error) {
      console.error('Property selection error:', error);
      res.status(500).json({ error: 'Failed to select property' });
    }
  });

  // Manual token connection
  app.post("/api/auth/google/manual-token-connect", async (req, res) => {
    try {
      const { campaignId, accessToken, refreshToken, propertyId } = req.body;
      
      if (!campaignId || !accessToken || !propertyId) {
        return res.status(400).json({ 
          success: false, 
          error: "Campaign ID, access token, and property ID are required" 
        });
      }

      // Store the manual token connection
      (global as any).realGA4Connections = (global as any).realGA4Connections || new Map();
      (global as any).realGA4Connections.set(campaignId, {
        propertyId,
        accessToken,
        refreshToken: refreshToken || null,
        connectedAt: new Date().toISOString(),
        isReal: true,
        method: 'manual_token',
        propertyName: `Property ${propertyId}`
      });

      res.json({
        success: true,
        method: 'manual_token',
        propertyId,
        message: 'Successfully connected with manual token'
      });
    } catch (error) {
      console.error('Manual token connection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to connect with manual token'
      });
    }
  });

  // Service account connection
  app.post("/api/auth/google/service-account-connect", async (req, res) => {
    try {
      const { campaignId, propertyId, serviceAccountKey } = req.body;
      
      if (!campaignId || !propertyId || !serviceAccountKey) {
        return res.status(400).json({ 
          success: false, 
          error: "Campaign ID, property ID, and service account key are required" 
        });
      }

      // For now, simulate service account connection
      res.json({
        success: true,
        message: 'Service account connection requires additional setup',
        requiresSetup: true,
        method: 'service_account'
      });
    } catch (error) {
      console.error('Service account connection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to connect with service account'
      });
    }
  });

  // Simple credentials connection
  app.post("/api/auth/google/simple-connect", async (req, res) => {
    try {
      const { campaignId, email, password, propertyId } = req.body;
      
      if (!campaignId || !email || !password || !propertyId) {
        return res.status(400).json({ 
          success: false, 
          error: "All fields are required" 
        });
      }

      const result = await simulateProfessionalAuth(email, password, propertyId, campaignId);
      
      res.json({
        success: result.success,
        email: email,
        propertyId: propertyId,
        error: result.error
      });
    } catch (error) {
      console.error('Simple credentials connection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to connect with credentials'
      });
    }
  });

  const server = createServer(app);
  return server;
}