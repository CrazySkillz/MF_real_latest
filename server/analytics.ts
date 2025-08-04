interface GA4Credentials {
  propertyId: string;
  measurementId: string;
  accessToken?: string;
}

interface GA4Metrics {
  impressions: number;
  clicks: number;
  sessions: number;
  pageviews: number;
  bounceRate: number;
  averageSessionDuration: number;
  conversions: number;
}

export class GoogleAnalytics4Service {
  async getMetricsWithToken(propertyId: string, accessToken: string, dateRange = '30daysAgo'): Promise<GA4Metrics> {
    const credentials = { propertyId, measurementId: '', accessToken };
    return this.getMetrics(credentials, accessToken, dateRange);
  }

  // Automatic token refresh for SaaS production use

  async simulateGA4Connection(propertyId: string): Promise<{ success: boolean; user?: any; properties?: any[] }> {
    // Return success with simulated data for demo purposes
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return {
        success: true,
        user: { email: 'demo@example.com', name: 'Demo User' },
        properties: [
          { id: propertyId, name: 'Demo GA4 Property', account: 'Demo Account' }
        ]
      };
    }
    return { success: false };
  }

  async refreshAccessToken(refreshToken: string, clientId?: string, clientSecret?: string): Promise<{ access_token: string; expires_in: number }> {
    // Use provided client credentials (from database) or fall back to environment variables
    const authClientId = clientId || process.env.GOOGLE_CLIENT_ID;
    const authClientSecret = clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    
    if (authClientId && authClientSecret) {
      // Production-grade automatic refresh with stored or environment credentials
      console.log('Using OAuth credentials for automatic refresh (source:', clientId ? 'database' : 'environment', ')');
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: authClientId,
          client_secret: authClientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to refresh token: ${errorData.error_description || errorData.error}`);
      }

      const tokenData = await response.json();
      return {
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in || 3600
      };
    } else {
      // Fallback: Try refresh without credentials (will likely fail, but attempt it)
      console.log('WARNING: No OAuth credentials - attempting refresh without client auth (may fail)');
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Token refresh failed without client credentials:', errorData);
        throw new Error('Automatic refresh requires Google OAuth credentials for guaranteed operation');
      }

      const tokenData = await response.json();
      return {
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in || 3600
      };
    }
  }

  async getMetricsWithAutoRefresh(campaignId: string, storage: any): Promise<GA4Metrics> {
    const connection = await storage.getGA4Connection(campaignId);
    if (!connection || connection.method !== 'access_token') {
      throw new Error('No valid access token connection found');
    }

    // Check if we have an access token
    if (!connection.accessToken) {
      console.log('No access token found in database for campaign:', campaignId);
      const tokenExpiredError = new Error('TOKEN_EXPIRED');
      (tokenExpiredError as any).isTokenExpired = true;
      throw tokenExpiredError;
    }

    console.log('Using access token for GA4 API call:', {
      campaignId,
      propertyId: connection.propertyId,
      tokenLength: connection.accessToken.length,
      tokenStart: connection.accessToken.substring(0, 20)
    });
    
    // Try with current token
    try {
      return await this.getMetricsWithToken(connection.propertyId, connection.accessToken, '30daysAgo');
    } catch (error: any) {
      console.log('GA4 API call failed:', error.message);
      
      // Check if error is due to expired token
      if (error.message.includes('invalid_grant') || 
          error.message.includes('401') || 
          error.message.includes('403') ||
          error.message.includes('invalid authentication credentials') ||
          error.message.includes('Request had invalid authentication credentials')) {
        
        console.log('Access token invalid/expired - attempting automatic background refresh');
        
        // Attempt automatic token refresh if we have a refresh token
        if (connection.refreshToken) {
          try {
            console.log('Refreshing access token automatically in background...');
            console.log('Using stored OAuth credentials:', {
              hasClientId: !!connection.clientId,
              hasClientSecret: !!connection.clientSecret,
              clientIdLength: connection.clientId?.length || 0
            });
            
            // Use stored client credentials for automatic refresh
            const refreshResult = await this.refreshAccessToken(
              connection.refreshToken, 
              connection.clientId || undefined,
              connection.clientSecret || undefined
            );
            
            // Update the connection with new access token
            await storage.updateGA4ConnectionTokens(campaignId, {
              accessToken: refreshResult.access_token,
              refreshToken: connection.refreshToken, // Keep the same refresh token
              expiresAt: new Date(Date.now() + (refreshResult.expires_in * 1000))
            });
            
            console.log('Access token refreshed successfully - retrying metrics call');
            
            // Retry with new token
            return await this.getMetricsWithToken(connection.propertyId, refreshResult.access_token, '30daysAgo');
          } catch (refreshError: any) {
            console.error('Failed to refresh access token automatically:', refreshError.message);
            
            // If automatic refresh fails, fall back to UI refresh
            const autoRefreshError = new Error('AUTO_REFRESH_NEEDED');
            (autoRefreshError as any).isAutoRefreshNeeded = true;
            (autoRefreshError as any).hasRefreshToken = !!connection.refreshToken;
            throw autoRefreshError;
          }
        } else {
          console.log('No refresh token available - user needs to reconnect');
          const tokenExpiredError = new Error('TOKEN_EXPIRED');
          (tokenExpiredError as any).isTokenExpired = true;
          throw tokenExpiredError;
        }
      }
      throw error;
    }
  }

  async getMetrics(credentials: GA4Credentials, accessToken: string, dateRange = '30daysAgo'): Promise<GA4Metrics> {
    try {
      // Use Google Analytics Data API REST endpoint with user's access token
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${credentials.propertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: dateRange,
              endDate: 'today',
            },
          ],
          metrics: [
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'conversions' },
            { name: 'totalUsers' }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GA4 API Error: ${errorText}`);
      }

      const data = await response.json();

      // Process the response data
      let totalSessions = 0;
      let totalPageviews = 0;
      let totalUsers = 0;
      let totalConversions = 0;
      let totalBounceRate = 0;
      let totalSessionDuration = 0;
      let rowCount = 0;

      if (data.rows) {
        for (const row of data.rows) {
          if (row.metricValues) {
            totalSessions += parseInt(row.metricValues[0]?.value || '0');
            totalPageviews += parseInt(row.metricValues[1]?.value || '0');
            totalBounceRate += parseFloat(row.metricValues[2]?.value || '0');
            totalSessionDuration += parseFloat(row.metricValues[3]?.value || '0');
            totalConversions += parseInt(row.metricValues[4]?.value || '0');
            totalUsers += parseInt(row.metricValues[5]?.value || '0');
            rowCount++;
          }
        }
      }

      return {
        impressions: totalUsers, // Using total users as impressions equivalent
        clicks: totalSessions, // Using sessions as clicks equivalent
        sessions: totalSessions,
        pageviews: totalPageviews,
        bounceRate: rowCount > 0 ? totalBounceRate / rowCount : 0,
        averageSessionDuration: rowCount > 0 ? totalSessionDuration / rowCount : 0,
        conversions: totalConversions,
      };
    } catch (error) {
      console.error('Error fetching GA4 metrics:', error);
      throw new Error(`Failed to fetch GA4 metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async testConnection(credentials: GA4Credentials, accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${credentials.propertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: '7daysAgo',
              endDate: 'today',
            },
          ],
          metrics: [{ name: 'sessions' }],
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Error testing GA4 connection:', error);
      return false;
    }
  }
}

export const ga4Service = new GoogleAnalytics4Service();