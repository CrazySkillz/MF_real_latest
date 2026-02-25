/**
 * Google Ads API Client
 * Uses Google Ads API v18 via REST with GAQL (Google Ads Query Language)
 */
import axios, { AxiosInstance } from 'axios';

export interface GoogleAdsTokens {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
}

export interface GoogleAdsCustomerAccount {
  id: string;
  descriptiveName: string;
  resourceName: string;
  manager: boolean;
}

export interface GoogleAdsCampaignInfo {
  id: string;
  name: string;
  status: string;
  resourceName: string;
}

export interface GoogleAdsDailyInsight {
  date: string; // YYYY-MM-DD
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionsValue: number;
  ctr: number;
  averageCpc: number; // in micros
  averageCpm: number; // in micros
  interactionRate: number;
  videoViews: number;
  searchImpressionShare: number;
}

const GOOGLE_ADS_API_VERSION = 'v18';
const GOOGLE_ADS_BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

export class GoogleAdsClient {
  private accessToken: string;
  private developerToken: string;
  private customerId: string;
  private managerAccountId?: string;
  private api: AxiosInstance;

  constructor(params: {
    accessToken: string;
    developerToken: string;
    customerId: string;
    managerAccountId?: string;
  }) {
    this.accessToken = params.accessToken;
    this.developerToken = params.developerToken;
    this.customerId = params.customerId.replace(/-/g, '');
    this.managerAccountId = params.managerAccountId?.replace(/-/g, '');

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'developer-token': this.developerToken,
      'Content-Type': 'application/json',
    };
    if (this.managerAccountId) {
      headers['login-customer-id'] = this.managerAccountId;
    }

    this.api = axios.create({
      baseURL: `${GOOGLE_ADS_BASE_URL}/customers/${this.customerId}`,
      headers,
    });
  }

  /**
   * Exchange an authorization code for tokens (standard Google OAuth2)
   */
  static async exchangeCodeForToken(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<GoogleAdsTokens> {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    return response.data;
  }

  /**
   * Refresh an access token using a refresh token
   */
  static async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<{ access_token: string; expires_in: number }> {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    });
    return response.data;
  }

  /**
   * List all customer accounts accessible by the current token
   */
  async getAccessibleCustomers(): Promise<GoogleAdsCustomerAccount[]> {
    // List accessible customer resource names
    const listResponse = await axios.get(
      `${GOOGLE_ADS_BASE_URL}/customers:listAccessibleCustomers`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'developer-token': this.developerToken,
        },
      }
    );

    const resourceNames: string[] = listResponse.data.resourceNames || [];
    const customers: GoogleAdsCustomerAccount[] = [];

    for (const resourceName of resourceNames) {
      try {
        const customerId = resourceName.replace('customers/', '');
        const detailApi = axios.create({
          baseURL: `${GOOGLE_ADS_BASE_URL}/customers/${customerId}`,
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'developer-token': this.developerToken,
            'Content-Type': 'application/json',
          },
        });

        const detailResponse = await detailApi.post('/googleAds:searchStream', {
          query: `SELECT customer.id, customer.descriptive_name, customer.resource_name, customer.manager FROM customer LIMIT 1`,
        });

        const results = detailResponse.data?.[0]?.results || [];
        if (results.length > 0) {
          const customer = results[0].customer;
          customers.push({
            id: customer.id,
            descriptiveName: customer.descriptiveName || `Account ${customer.id}`,
            resourceName: customer.resourceName,
            manager: customer.manager || false,
          });
        }
      } catch {
        // Skip inaccessible accounts
      }
    }

    return customers;
  }

  /**
   * Get all campaigns for the current customer account
   */
  async getCampaigns(): Promise<GoogleAdsCampaignInfo[]> {
    const response = await this.api.post('/googleAds:searchStream', {
      query: `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.resource_name
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        ORDER BY campaign.name
      `,
    });

    const results = response.data?.[0]?.results || [];
    return results.map((r: any) => ({
      id: r.campaign.id,
      name: r.campaign.name,
      status: r.campaign.status,
      resourceName: r.campaign.resourceName,
    }));
  }

  /**
   * Fetch daily metrics for all campaigns in a date range
   * Returns data with cost_micros (divide by 1,000,000 for actual currency amount)
   */
  async getDailyMetrics(startDate: string, endDate: string): Promise<GoogleAdsDailyInsight[]> {
    const response = await this.api.post('/googleAds:searchStream', {
      query: `
        SELECT
          campaign.id,
          campaign.name,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value,
          metrics.ctr,
          metrics.average_cpc,
          metrics.average_cpm,
          metrics.interaction_rate,
          metrics.video_views,
          metrics.search_impression_share
        FROM campaign
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          AND campaign.status != 'REMOVED'
        ORDER BY segments.date
      `,
    });

    const results = response.data?.[0]?.results || [];
    return results.map((r: any) => ({
      date: r.segments.date,
      campaignId: r.campaign.id,
      campaignName: r.campaign.name,
      impressions: Number(r.metrics.impressions || 0),
      clicks: Number(r.metrics.clicks || 0),
      costMicros: Number(r.metrics.costMicros || 0),
      conversions: Number(r.metrics.conversions || 0),
      conversionsValue: Number(r.metrics.conversionsValue || 0),
      ctr: Number(r.metrics.ctr || 0),
      averageCpc: Number(r.metrics.averageCpc || 0),
      averageCpm: Number(r.metrics.averageCpm || 0),
      interactionRate: Number(r.metrics.interactionRate || 0),
      videoViews: Number(r.metrics.videoViews || 0),
      searchImpressionShare: Number(r.metrics.searchImpressionShare || 0),
    }));
  }

  /**
   * Convert cost_micros to actual currency amount
   */
  static microsToAmount(micros: number): number {
    return micros / 1_000_000;
  }
}
