// Google Analytics 4 Client-side Integration
// This allows users to authenticate directly with their Google account
// using Google Identity Services (the new Google Sign-In)

interface GA4Metrics {
  sessions: number;
  pageviews: number;
  users: number;
  bounceRate: number;
  averageSessionDuration: number;
  conversions: number;
}

export class GA4ClientService {
  private accessToken: string | null = null;
  private isInitialized = false;

  constructor() {
    this.loadGoogleIdentity();
  }

  private async loadGoogleIdentity(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await this.loadGoogleIdentity();
    this.isInitialized = true;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  async signIn(): Promise<string> {
    // This method is now mainly for backwards compatibility
    // The actual token setting is done via setAccessToken
    if (this.accessToken) {
      return this.accessToken;
    }
    throw new Error('Access token not set. Please use the modal to authenticate.');
  }

  async getMetrics(propertyId: string, dateRange = '30daysAgo'): Promise<GA4Metrics> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please sign in first.');
    }

    try {
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
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
            { name: 'totalUsers' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'conversions' },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`GA4 API Error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      
      // Process the response
      let sessions = 0;
      let pageviews = 0;
      let users = 0;
      let bounceRate = 0;
      let sessionDuration = 0;
      let conversions = 0;

      if (data.rows && data.rows.length > 0) {
        const totals = data.totals?.[0]?.metricValues || data.rows[0]?.metricValues || [];
        sessions = parseInt(totals[0]?.value || '0');
        pageviews = parseInt(totals[1]?.value || '0');
        users = parseInt(totals[2]?.value || '0');
        bounceRate = parseFloat(totals[3]?.value || '0');
        sessionDuration = parseFloat(totals[4]?.value || '0');
        conversions = parseInt(totals[5]?.value || '0');
      }

      return {
        sessions,
        pageviews,
        users,
        bounceRate,
        averageSessionDuration: sessionDuration,
        conversions,
      };
    } catch (error) {
      console.error('Error fetching GA4 metrics:', error);
      throw error;
    }
  }

  async testConnection(propertyId: string): Promise<boolean> {
    try {
      await this.getMetrics(propertyId, '7daysAgo');
      return true;
    } catch (error) {
      console.error('GA4 connection test failed:', error);
      return false;
    }
  }

  signOut(): void {
    if (window.gapi?.auth2) {
      const authInstance = window.gapi.auth2.getAuthInstance();
      authInstance.signOut();
    }
    this.accessToken = null;
  }

  isSignedIn(): boolean {
    return !!this.accessToken;
  }
}

// Global instance
export const ga4Client = new GA4ClientService();

// Extend window interface for TypeScript
declare global {
  interface Window {
    google: any;
  }
}