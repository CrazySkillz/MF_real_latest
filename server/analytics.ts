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