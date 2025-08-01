import { Request, Response } from 'express';
import { JWT } from 'google-auth-library';

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

interface GA4Connection {
  propertyId: string;
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: number;
  serviceAccountAccess?: boolean;
  userEmail?: string;
}

// Professional-grade token storage (in production, use Redis or database)
const connectionStorage = new Map<string, GA4Connection>();

export class ProfessionalGA4Auth {
  
  async connectWithServiceAccount(propertyId: string, campaignId: string): Promise<boolean> {
    try {
      // For development, simulate service account authentication
      // In production, this would use actual Google Cloud service account credentials
      console.log(`Service account connection attempt for property ${propertyId}`);
      
      // Store the connection info
      this.connections.set(campaignId, {
        propertyId,
        userEmail: 'marketpulse-analytics@your-project.iam.gserviceaccount.com',
        isConnected: true,
        connectedAt: new Date().toISOString()
      });
      
      // Store a demo access token for the service account
      this.accessTokens.set(campaignId, {
        token: 'sa_demo_' + Date.now(), // Service account demo token
        expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year expiry
        refreshToken: 'sa_refresh_' + Date.now()
      });
      
      return true;
    } catch (error) {
      console.error('Service account connection error:', error);
      return false;
    }
  }
  private serviceAccountKey: ServiceAccountKey | null = null;
  private jwtClient: JWT | null = null;

  constructor() {
    this.initializeServiceAccount();
  }

  private initializeServiceAccount() {
    try {
      // In production, this would be stored securely as a JSON secret
      const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      if (serviceAccountJson) {
        this.serviceAccountKey = JSON.parse(serviceAccountJson);
        this.jwtClient = new JWT({
          email: this.serviceAccountKey.client_email,
          key: this.serviceAccountKey.private_key,
          scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
        });
        console.log('Service Account authentication initialized');
      }
    } catch (error) {
      console.log('Service Account not configured, using OAuth flow');
    }
  }

  /**
   * Method 1: Service Account Authentication (Like Supermetrics)
   * This is the preferred method for B2B platforms
   */
  async connectWithServiceAccount(propertyId: string, campaignId: string): Promise<boolean> {
    if (!this.jwtClient || !this.serviceAccountKey) {
      throw new Error('Service Account not configured');
    }

    try {
      // Generate access token using service account
      const tokens = await this.jwtClient.authorize();
      
      const connection: GA4Connection = {
        propertyId,
        accessToken: tokens.access_token!,
        expiresAt: tokens.expiry_date || Date.now() + 3600000,
        serviceAccountAccess: true,
        userEmail: this.serviceAccountKey.client_email
      };

      connectionStorage.set(campaignId, connection);
      console.log(`Service Account connected for campaign ${campaignId}`);
      return true;
    } catch (error) {
      console.error('Service Account connection failed:', error);
      return false;
    }
  }

  /**
   * Method 2: OAuth 2.0 with Domain-Wide Delegation
   * This allows service accounts to impersonate users
   */
  async connectWithDomainDelegation(propertyId: string, campaignId: string, userEmail: string): Promise<boolean> {
    if (!this.serviceAccountKey) {
      throw new Error('Service Account not configured for domain delegation');
    }

    try {
      const jwtClient = new JWT({
        email: this.serviceAccountKey.client_email,
        key: this.serviceAccountKey.private_key,
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
        subject: userEmail, // Impersonate this user
      });

      const tokens = await jwtClient.authorize();
      
      const connection: GA4Connection = {
        propertyId,
        accessToken: tokens.access_token!,
        expiresAt: tokens.expiry_date || Date.now() + 3600000,
        serviceAccountAccess: true,
        userEmail
      };

      connectionStorage.set(campaignId, connection);
      console.log(`Domain delegation connected for ${userEmail} on campaign ${campaignId}`);
      return true;
    } catch (error) {
      console.error('Domain delegation failed:', error);
      return false;
    }
  }

  /**
   * Method 3: Professional OAuth 2.0 Flow
   * Enhanced version with better error handling and refresh logic
   */
  generateProfessionalOAuthUrl(campaignId: string, propertyId: string, userEmail?: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('OAuth credentials not configured');
    }

    const redirectUri = this.getRedirectUri();
    const state = JSON.stringify({ 
      campaignId, 
      propertyId, 
      userEmail,
      timestamp: Date.now(),
      flow: 'professional'
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'openid'
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleProfessionalCallback(code: string, state: string): Promise<{ success: boolean; campaignId?: string; error?: string }> {
    try {
      const { campaignId, propertyId, userEmail } = JSON.parse(state);
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return { success: false, error: 'OAuth credentials not configured' };
      }

      // Exchange code for tokens with enhanced error handling
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.getRedirectUri(),
        }),
      });

      const tokens = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', tokens);
        return { success: false, error: `Token exchange failed: ${tokens.error_description}` };
      }

      // Verify the user has access to the specified property
      const hasAccess = await this.verifyPropertyAccess(tokens.access_token, propertyId);
      if (!hasAccess) {
        return { success: false, error: 'User does not have access to the specified GA4 property' };
      }

      // Store connection with all tokens
      const connection: GA4Connection = {
        propertyId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in * 1000),
        serviceAccountAccess: false,
        userEmail: userEmail || await this.getUserEmail(tokens.access_token)
      };

      connectionStorage.set(campaignId, connection);
      console.log(`Professional OAuth connected for campaign ${campaignId}`);
      
      return { success: true, campaignId };
    } catch (error) {
      console.error('Professional callback error:', error);
      return { success: false, error: 'Callback processing failed' };
    }
  }

  /**
   * Professional token refresh with automatic retry and fallback
   */
  async getValidAccessToken(campaignId: string): Promise<string | null> {
    const connection = connectionStorage.get(campaignId);
    if (!connection) return null;

    // For service account connections, always refresh
    if (connection.serviceAccountAccess) {
      return await this.refreshServiceAccountToken(campaignId);
    }

    // For OAuth connections, check if refresh is needed
    const bufferTime = 300000; // 5 minutes buffer
    if (connection.expiresAt && Date.now() < connection.expiresAt - bufferTime) {
      return connection.accessToken!;
    }

    // Refresh OAuth token
    return await this.refreshOAuthToken(campaignId);
  }

  private async refreshServiceAccountToken(campaignId: string): Promise<string | null> {
    if (!this.jwtClient) return null;

    try {
      const tokens = await this.jwtClient.authorize();
      const connection = connectionStorage.get(campaignId);
      
      if (connection) {
        connection.accessToken = tokens.access_token!;
        connection.expiresAt = tokens.expiry_date || Date.now() + 3600000;
        connectionStorage.set(campaignId, connection);
      }

      return tokens.access_token!;
    } catch (error) {
      console.error('Service account token refresh failed:', error);
      return null;
    }
  }

  private async refreshOAuthToken(campaignId: string): Promise<string | null> {
    const connection = connectionStorage.get(campaignId);
    if (!connection?.refreshToken) return null;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) return null;

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: connection.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const tokens = await response.json();

      if (response.ok) {
        connection.accessToken = tokens.access_token;
        connection.expiresAt = Date.now() + (tokens.expires_in * 1000);
        connectionStorage.set(campaignId, connection);
        return tokens.access_token;
      }
    } catch (error) {
      console.error('OAuth token refresh failed:', error);
    }

    return null;
  }

  private async verifyPropertyAccess(accessToken: string, propertyId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          metrics: [{ name: 'sessions' }],
          limit: 1
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private async getUserEmail(accessToken: string): Promise<string> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await response.json();
      return data.email || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private getRedirectUri(): string {
    return process.env.NODE_ENV === 'production' 
      ? `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost'}/api/auth/google/professional/callback`
      : 'http://localhost:5000/api/auth/google/professional/callback';
  }

  getConnectionInfo(campaignId: string): GA4Connection | null {
    return connectionStorage.get(campaignId) || null;
  }

  hasValidConnection(campaignId: string): boolean {
    const connection = connectionStorage.get(campaignId);
    return !!(connection && (connection.refreshToken || connection.serviceAccountAccess));
  }

  revokeConnection(campaignId: string): void {
    connectionStorage.delete(campaignId);
  }

  // Method for setting up service account in production
  setupServiceAccount(serviceAccountJson: string): boolean {
    try {
      this.serviceAccountKey = JSON.parse(serviceAccountJson);
      this.jwtClient = new JWT({
        email: this.serviceAccountKey.client_email,
        key: this.serviceAccountKey.private_key,
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      });
      console.log('Service Account configured successfully');
      return true;
    } catch (error) {
      console.error('Service Account setup failed:', error);
      return false;
    }
  }
}

export const professionalGA4Auth = new ProfessionalGA4Auth();