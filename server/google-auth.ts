import { Request, Response } from 'express';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface StoredTokenInfo {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  property_id: string;
}

// In-memory token storage (in production, use a database)
const tokenStorage = new Map<string, StoredTokenInfo>();

export class GoogleAuthService {
  private readonly clientId = process.env.GOOGLE_CLIENT_ID;
  private readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  private readonly redirectUri = process.env.NODE_ENV === 'production' 
    ? `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost'}/api/auth/google/callback`
    : 'http://localhost:5000/api/auth/google/callback';

  constructor() {
    if (!this.clientId || !this.clientSecret) {
      console.warn('Google OAuth credentials not configured. GA4 integration will use manual token method.');
    }
  }

  generateAuthUrl(campaignId: string, propertyId: string): string {
    if (!this.clientId) {
      throw new Error('Google OAuth not configured');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      access_type: 'offline', // This ensures we get a refresh token
      prompt: 'consent', // Force consent to get refresh token
      state: JSON.stringify({ campaignId, propertyId }) // Pass campaign context
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<{ success: boolean; campaignId?: string; error?: string }> {
    if (!this.clientId || !this.clientSecret) {
      return { success: false, error: 'OAuth not configured' };
    }

    try {
      // Parse state to get campaign context
      const { campaignId, propertyId } = JSON.parse(state);

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri,
        }),
      });

      const tokens: GoogleTokenResponse = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', tokens);
        return { success: false, error: 'Failed to exchange code for tokens' };
      }

      // Store tokens with campaign association
      if (tokens.refresh_token) {
        const tokenInfo: StoredTokenInfo = {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: Date.now() + (tokens.expires_in * 1000),
          property_id: propertyId
        };

        tokenStorage.set(campaignId, tokenInfo);
        console.log(`Stored tokens for campaign ${campaignId}`);
      }

      return { success: true, campaignId };
    } catch (error) {
      console.error('OAuth callback error:', error);
      return { success: false, error: 'Callback processing failed' };
    }
  }

  async refreshAccessToken(campaignId: string): Promise<string | null> {
    const tokenInfo = tokenStorage.get(campaignId);
    if (!tokenInfo || !tokenInfo.refresh_token) {
      return null;
    }

    if (!this.clientId || !this.clientSecret) {
      return null;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: tokenInfo.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      const tokens: GoogleTokenResponse = await response.json();

      if (response.ok) {
        // Update stored token info
        tokenInfo.access_token = tokens.access_token;
        tokenInfo.expires_at = Date.now() + (tokens.expires_in * 1000);
        tokenStorage.set(campaignId, tokenInfo);

        return tokens.access_token;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return null;
  }

  async getValidAccessToken(campaignId: string): Promise<string | null> {
    const tokenInfo = tokenStorage.get(campaignId);
    if (!tokenInfo) {
      return null;
    }

    // If token is still valid, return it
    if (Date.now() < tokenInfo.expires_at - 60000) { // 1 minute buffer
      return tokenInfo.access_token;
    }

    // Try to refresh the token
    return await this.refreshAccessToken(campaignId);
  }

  getPropertyId(campaignId: string): string | null {
    const tokenInfo = tokenStorage.get(campaignId);
    return tokenInfo?.property_id || null;
  }

  hasValidTokens(campaignId: string): boolean {
    const tokenInfo = tokenStorage.get(campaignId);
    return !!(tokenInfo && tokenInfo.refresh_token);
  }

  revokeTokens(campaignId: string): void {
    tokenStorage.delete(campaignId);
  }
}

export const googleAuthService = new GoogleAuthService();