import { BetaAnalyticsDataClient } from '@google-analytics/data';

interface GA4Credentials {
  propertyId: string;
  measurementId: string;
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
  private client: BetaAnalyticsDataClient;

  constructor() {
    // Initialize GA4 client - requires service account credentials
    this.client = new BetaAnalyticsDataClient({
      // If GOOGLE_APPLICATION_CREDENTIALS env var is set, it will use that
      // Otherwise, we'll need to handle authentication differently
    });
  }

  async getMetrics(credentials: GA4Credentials, dateRange = '30daysAgo'): Promise<GA4Metrics> {
    try {
      const [response] = await this.client.runReport({
        property: `properties/${credentials.propertyId}`,
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
      });

      // Process the response and extract metrics
      let totalSessions = 0;
      let totalPageviews = 0;
      let totalUsers = 0;
      let totalConversions = 0;
      let totalBounceRate = 0;
      let totalSessionDuration = 0;
      let rowCount = 0;

      if (response.rows) {
        for (const row of response.rows) {
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

  async testConnection(credentials: GA4Credentials): Promise<boolean> {
    try {
      const [response] = await this.client.runReport({
        property: `properties/${credentials.propertyId}`,
        dateRanges: [
          {
            startDate: '7daysAgo',
            endDate: 'today',
          },
        ],
        metrics: [{ name: 'sessions' }],
        limit: 1,
      });

      return response.rows !== undefined;
    } catch (error) {
      console.error('GA4 connection test failed:', error);
      return false;
    }
  }
}

export const ga4Service = new GoogleAnalytics4Service();