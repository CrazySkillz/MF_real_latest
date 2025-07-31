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

interface TokenInfo {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

export class GA4ClientService {
  private tokenInfo: TokenInfo | null = null;
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

  setAccessToken(token: string, expiresIn: number = 3600): void {
    this.tokenInfo = {
      access_token: token,
      expires_at: Date.now() + (expiresIn * 1000) // Convert seconds to milliseconds
    };
    
    // Store in sessionStorage for persistence across page reloads
    sessionStorage.setItem('ga4_token_info', JSON.stringify(this.tokenInfo));
  }

  private isTokenExpired(): boolean {
    if (!this.tokenInfo) return true;
    return Date.now() >= this.tokenInfo.expires_at;
  }

  private loadTokenFromStorage(): void {
    const stored = sessionStorage.getItem('ga4_token_info');
    if (stored) {
      try {
        this.tokenInfo = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored token info:', e);
        sessionStorage.removeItem('ga4_token_info');
      }
    }
  }

  async signIn(): Promise<string> {
    // Load token from storage if available
    this.loadTokenFromStorage();
    
    if (this.tokenInfo && !this.isTokenExpired()) {
      return this.tokenInfo.access_token;
    }
    
    // Token expired or not available
    throw new Error('Access token expired or not set. Please re-authenticate.');
  }

  async getMetrics(propertyId: string, dateRange = '30daysAgo'): Promise<GA4Metrics> {
    this.loadTokenFromStorage();
    
    if (!this.tokenInfo || this.isTokenExpired()) {
      throw new Error('Access token expired. Please re-authenticate through the campaign setup.');
    }

    try {
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tokenInfo.access_token}`,
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
    this.tokenInfo = null;
    sessionStorage.removeItem('ga4_token_info');
    sessionStorage.removeItem('ga4PropertyId');
    sessionStorage.removeItem('ga4AccessToken');
    sessionStorage.removeItem('ga4MeasurementId');
  }

  isSignedIn(): boolean {
    this.loadTokenFromStorage();
    return !!(this.tokenInfo && !this.isTokenExpired());
  }

  getTokenExpiryTime(): number | null {
    this.loadTokenFromStorage();
    return this.tokenInfo?.expires_at || null;
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