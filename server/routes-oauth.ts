import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCampaignSchema, insertMetricSchema, insertIntegrationSchema, insertPerformanceDataSchema, insertGA4ConnectionSchema } from "@shared/schema";
import { z } from "zod";
import { ga4Service } from "./analytics";
import { realGA4Client } from "./real-ga4-client";


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

  // Get a single campaign by ID
  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  // Get real GA4 metrics for a campaign
  app.get("/api/campaigns/:id/ga4-metrics", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const connection = await storage.getGA4Connection(campaignId);
      
      if (!connection) {
        return res.status(404).json({ 
          error: "No GA4 connection found for this campaign. Please connect your Google Analytics first." 
        });
      }
      
      if (connection.method === 'access_token') {
        // Use auto-refresh method that handles token expiration
        const metrics = await ga4Service.getMetricsWithAutoRefresh(campaignId, storage);
        
        res.json({
          success: true,
          metrics,
          propertyId: connection.propertyId,
          lastUpdated: new Date().toISOString()
        });
      } else {
        // Service account method would require additional setup
        res.json({
          error: "Service account metrics not yet implemented",
          method: connection.method
        });
      }
    } catch (error) {
      console.error('GA4 metrics error:', error);
      
      // Handle token expiration gracefully
      if (error instanceof Error && (error.message === 'AUTO_REFRESH_NEEDED' || (error as any).isAutoRefreshNeeded)) {
        console.log('Sending AUTO_REFRESH_NEEDED response to client');
        res.status(401).json({ 
          error: 'AUTO_REFRESH_NEEDED',
          message: 'Access token expired - automatic refresh needed',
          autoRefresh: true,
          hasRefreshToken: (error as any).hasRefreshToken
        });
      } else if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || (error as any).isTokenExpired)) {
        console.log('Sending TOKEN_EXPIRED response to client');
        res.status(401).json({ 
          error: 'TOKEN_EXPIRED',
          message: 'Your Google Analytics access has expired. Please reconnect to continue viewing metrics.',
          requiresReconnection: true
        });
      } else {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Failed to fetch GA4 metrics' 
        });
      }
    }
  });

  // Google Analytics OAuth endpoints
  app.post("/api/auth/google/url", (req, res) => {
    try {
      const { campaignId, returnUrl } = req.body;
      
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        return res.status(400).json({
          error: "Google OAuth credentials not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment variables."
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

  // Check GA4 connection status (checks actual database storage)
  app.get("/api/ga4/check-connection/:campaignId", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      
      // Check if there's a GA4 connection in the database
      const ga4Connection = await storage.getGA4Connection(campaignId);
      
      if (ga4Connection) {
        return res.json({
          connected: true,
          propertyId: ga4Connection.propertyId,
          propertyName: ga4Connection.propertyName,
          method: ga4Connection.method,
          connectedAt: ga4Connection.connectedAt
        });
      }

      // Fallback: check temporary OAuth connections for backward compatibility
      const connections = (global as any).oauthConnections;
      if (connections && connections.has(campaignId)) {
        const connection = connections.get(campaignId);
        return res.json({
          connected: true,
          properties: connection.properties || [],
          user: connection.userInfo
        });
      }
      
      res.json({ connected: false });
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




  // Manual GA4 token connection for users
  app.post("/api/ga4/connect-token", async (req, res) => {
    try {
      // Add proper validation for the fields the frontend sends
      const frontendSchema = insertGA4ConnectionSchema.pick({
        campaignId: true,
        accessToken: true, 
        refreshToken: true,
        propertyId: true
      });
      const validatedData = frontendSchema.parse(req.body);
      const { campaignId, accessToken, refreshToken, propertyId } = validatedData;
      
      console.log('GA4 connect-token request (AFTER validation):', {
        campaignId,
        propertyId,
        accessTokenLength: accessToken ? accessToken.length : 0,
        accessTokenStart: accessToken ? accessToken.substring(0, 20) : 'NULL',
        hasRefreshToken: !!refreshToken,
        validatedDataKeys: Object.keys(validatedData)
      });
      
      if (!campaignId || !accessToken || !propertyId) {
        return res.status(400).json({ 
          success: false, 
          error: "Campaign ID, access token, and property ID are required" 
        });
      }

      // Store the user's GA4 connection in database using validated data
      const connection = await storage.createGA4Connection({
        campaignId,
        propertyId,
        accessToken,
        refreshToken: refreshToken || null,
        method: 'access_token',
        propertyName: `GA4 Property ${propertyId}`,
        serviceAccountKey: null
      });
      
      console.log('GA4 connection created:', {
        id: connection.id,
        campaignId: connection.campaignId,
        accessTokenStored: !!connection.accessToken,
        accessTokenLength: connection.accessToken ? connection.accessToken.length : 0
      });

      res.json({
        success: true,
        method: 'access_token',
        propertyId,
        message: 'Successfully connected with access token'
      });
    } catch (error) {
      console.error('GA4 token connection error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid GA4 connection data", 
          details: error.errors 
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to connect with access token'
      });
    }
  });

  // Transfer GA4 connection from temporary campaign ID to real campaign ID
  app.post("/api/ga4/transfer-connection", async (req, res) => {
    try {
      const { fromCampaignId, toCampaignId } = req.body;
      
      if (!fromCampaignId || !toCampaignId) {
        return res.status(400).json({ 
          success: false, 
          error: "Both fromCampaignId and toCampaignId are required" 
        });
      }

      // Get the existing connection
      const existingConnection = await storage.getGA4Connection(fromCampaignId);
      
      console.log('Transfer connection - existing connection:', {
        fromCampaignId,
        toCampaignId,
        found: !!existingConnection,
        hasAccessToken: !!existingConnection?.accessToken,
        accessTokenLength: existingConnection?.accessToken?.length || 0,
        hasRefreshToken: !!existingConnection?.refreshToken
      });
      
      if (!existingConnection) {
        return res.status(404).json({
          success: false,
          error: "No GA4 connection found for the source campaign"
        });
      }

      // Create new connection with the real campaign ID
      const newConnection = await storage.createGA4Connection({
        campaignId: toCampaignId,
        propertyId: existingConnection.propertyId,
        accessToken: existingConnection.accessToken,
        refreshToken: existingConnection.refreshToken,
        method: existingConnection.method,
        propertyName: existingConnection.propertyName,
        serviceAccountKey: existingConnection.serviceAccountKey
      });
      
      console.log('Transfer connection - new connection created:', {
        id: newConnection.id,
        campaignId: newConnection.campaignId,
        hasAccessToken: !!newConnection.accessToken,
        accessTokenLength: newConnection.accessToken?.length || 0
      });

      // Delete the temporary connection
      await storage.deleteGA4Connection(fromCampaignId);

      res.json({
        success: true,
        message: 'GA4 connection transferred successfully'
      });
    } catch (error) {
      console.error('GA4 connection transfer error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to transfer GA4 connection'
      });
    }
  });

  // Service account GA4 connection for users
  app.post("/api/ga4/connect-service-account", async (req, res) => {
    try {
      // Add proper validation for the fields the frontend sends  
      const serviceAccountSchema = insertGA4ConnectionSchema.pick({
        campaignId: true,
        serviceAccountKey: true,
        propertyId: true
      });
      const validatedData = serviceAccountSchema.parse(req.body);
      const { campaignId, serviceAccountKey, propertyId } = validatedData;
      
      if (!campaignId || !serviceAccountKey || !propertyId) {
        return res.status(400).json({ 
          success: false, 
          error: "Campaign ID, service account key, and property ID are required" 
        });
      }

      // Validate JSON format
      let parsedKey;
      try {
        parsedKey = JSON.parse(serviceAccountKey);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: "Invalid JSON format for service account key"
        });
      }

      // Store the user's GA4 service account connection in database
      await storage.createGA4Connection({
        campaignId,
        propertyId,
        accessToken: null,
        refreshToken: null,
        method: 'service_account',
        propertyName: `GA4 Property ${propertyId}`,
        serviceAccountKey: JSON.stringify(parsedKey)
      });

      res.json({
        success: true,
        method: 'service_account',
        propertyId,
        message: 'Successfully connected with service account'
      });
    } catch (error) {
      console.error('GA4 service account connection error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid GA4 service account data", 
          details: error.errors 
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to connect with service account'
      });
    }
  });

  // OAuth code exchange endpoint for client-side OAuth
  app.post("/api/ga4/oauth-exchange", async (req, res) => {
    try {
      const { campaignId, authCode, clientId, clientSecret, redirectUri } = req.body;
      
      // Debug logging
      console.log('OAuth exchange request body:', {
        campaignId: !!campaignId,
        authCode: !!authCode,
        clientId: !!clientId,
        clientSecret: !!clientSecret,
        clientSecretLength: clientSecret?.length || 0,
        redirectUri: !!redirectUri
      });
      
      if (!campaignId || !authCode || !clientId || !clientSecret || !redirectUri) {
        console.log('Missing required fields:', {
          campaignId: !campaignId,
          authCode: !authCode,
          clientId: !clientId,
          clientSecret: !clientSecret,
          redirectUri: !redirectUri
        });
        return res.status(400).json({
          success: false,
          error: "Missing required fields: campaignId, authCode, clientId, clientSecret, redirectUri"
        });
      }

      // Exchange authorization code for tokens
      const tokenParams = {
        code: authCode,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      };
      
      console.log('Token exchange params:', {
        code: !!authCode,
        client_id: !!clientId,
        client_secret: !!clientSecret,
        client_secret_length: clientSecret.length,
        redirect_uri: !!redirectUri,
        grant_type: 'authorization_code'
      });
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenParams)
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error('Token exchange failed:', errorData);
        return res.status(400).json({
          success: false,
          error: 'Failed to exchange authorization code for tokens'
        });
      }

      const tokens = await tokenResponse.json();
      const { access_token, refresh_token } = tokens;

      if (!access_token) {
        return res.status(400).json({
          success: false,
          error: 'No access token received from Google'
        });
      }

      // Get GA4 properties using the access token
      try {
        const propertiesResponse = await fetch('https://analyticsdata.googleapis.com/v1beta/properties', {
          headers: { 'Authorization': `Bearer ${access_token}` }
        });

        let properties = [];
        if (propertiesResponse.ok) {
          const propertiesData = await propertiesResponse.json();
          properties = propertiesData.properties?.map((prop: any) => ({
            id: prop.name.split('/')[1],
            name: prop.displayName || `Property ${prop.name.split('/')[1]}`
          })) || [];
        }

        // Create GA4 connection with tokens (no property selected yet)
        await storage.createGA4Connection({
          campaignId,
          accessToken: access_token,
          refreshToken: refresh_token || null,
          propertyId: '', // Will be set when user selects property
          method: 'oauth',
          propertyName: 'OAuth Connection'
        });

        res.json({
          success: true,
          properties,
          message: 'OAuth authentication successful'
        });

      } catch (error) {
        console.error('Failed to fetch GA4 properties:', error);
        res.json({
          success: true,
          properties: [],
          message: 'OAuth successful, but failed to fetch properties. You can enter Property ID manually.'
        });
      }

    } catch (error) {
      console.error('OAuth exchange error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during OAuth exchange'
      });
    }
  });

  const server = createServer(app);
  return server;
}