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

  async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        console.error('Token refresh failed:', await response.text());
        return null;
      }

      const data = await response.json();
      return {
        access_token: data.access_token,
        expires_in: data.expires_in || 3600
      };
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }

  async getMetricsWithAutoRefresh(campaignId: string, storage: any): Promise<GA4Metrics> {
    const connection = await storage.getGA4Connection(campaignId);
    if (!connection || connection.method !== 'access_token') {
      throw new Error('No valid access token connection found');
    }

    let accessToken = connection.accessToken;
    
    // Try with current token
    try {
      return await this.getMetricsWithToken(connection.propertyId, accessToken!, '30daysAgo');
    } catch (error: any) {
      // If token expired, provide user-friendly error for reconnection
      if (error.message.includes('invalid_grant') || 
          error.message.includes('401') || 
          error.message.includes('403') ||
          error.message.includes('invalid authentication credentials') ||
          error.message.includes('Request had invalid authentication credentials')) {
        
        // Mark connection as expired for UI to handle
        await storage.updateGA4Connection(campaignId, {
          accessToken: null // Clear expired token
        });
        
        throw new Error('TOKEN_EXPIRED');
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
            { name: 'totalUsers' },
          ],
          dimensions: [
            { name: 'date' },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`GA4 API Error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();

      // Process the response and extract metrics
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
          limit: 1,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('GA4 connection test failed:', error);
      return false;
    }
  }
}

export const ga4Service = new GoogleAnalytics4Service();