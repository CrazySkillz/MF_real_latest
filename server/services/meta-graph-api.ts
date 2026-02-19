/**
 * Meta Graph API Client
 * Handles all communication with Facebook Marketing API
 *
 * API Documentation: https://developers.facebook.com/docs/marketing-api
 * API Version: v19.0
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// Meta Graph API Types
export interface MetaConnection {
  id: string;
  campaignId: string;
  adAccountId: string;
  adAccountName: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  objective: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  startTime?: string;
  stopTime?: string;
}

export interface MetaInsights {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  actions?: MetaAction[];
  videoViews?: number;
  frequency: number;
  cpm: number;
  cpp: number;
  ctr: number;
  cpc: number;
  dateStart: string;
  dateStop: string;
}

export interface MetaAction {
  actionType: string;
  value: string;
}

export interface MetaDemographicInsight {
  age: string;
  gender: string;
  impressions: number;
  clicks: number;
  spend: number;
  actions?: MetaAction[];
}

export interface MetaGeographicInsight {
  country: string;
  region?: string;
  impressions: number;
  clicks: number;
  spend: number;
  actions?: MetaAction[];
}

export interface MetaPlacementInsight {
  publisherPlatform: string;
  platformPosition?: string;
  impressions: number;
  clicks: number;
  spend: number;
  actions?: MetaAction[];
}

export interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  targeting?: any;
  optimizationGoal?: string;
}

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  creative?: {
    id: string;
    title?: string;
    body?: string;
    imageUrl?: string;
    videoId?: string;
  };
}

/**
 * Meta Graph API Client Class
 */
export class MetaGraphAPIClient {
  private accessToken: string;
  private apiVersion: string = 'v19.0';
  private baseUrl: string;
  private axiosInstance: AxiosInstance;
  private rateLimitDelay: number = 100; // ms between requests

  constructor(accessToken: string, apiVersion?: string) {
    this.accessToken = accessToken;
    if (apiVersion) {
      this.apiVersion = apiVersion;
    }
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;

    // Configure axios instance with defaults
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => this.handleError(error)
    );
  }

  /**
   * Error handling for Meta API responses
   */
  private handleError(error: AxiosError): Promise<never> {
    if (error.response) {
      const status = error.response.status;
      const data: any = error.response.data;

      // Rate limiting (429 or specific error codes)
      if (status === 429 || (data?.error?.code === 17 || data?.error?.code === 80000)) {
        throw new Error(`Meta API rate limit exceeded. Please try again later.`);
      }

      // Invalid or expired access token
      if (status === 401 || data?.error?.code === 190) {
        throw new Error(`Meta access token is invalid or expired. Please reconnect your account.`);
      }

      // Permission errors
      if (data?.error?.code === 200 || data?.error?.code === 10) {
        throw new Error(`Insufficient permissions. Please ensure ads_read permission is granted.`);
      }

      // Generic API error
      const message = data?.error?.message || 'Meta API request failed';
      throw new Error(`Meta API Error: ${message}`);
    }

    // Network or timeout errors
    if (error.code === 'ECONNABORTED') {
      throw new Error('Meta API request timed out. Please try again.');
    }

    throw new Error(`Network error while connecting to Meta API: ${error.message}`);
  }

  /**
   * Rate limiting helper - adds delay between requests
   */
  private async rateLimit(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.rateLimitDelay));
  }

  /**
   * Get ad account information
   */
  async getAdAccount(adAccountId: string): Promise<any> {
    await this.rateLimit();

    const response = await this.axiosInstance.get(`/act_${adAccountId}`, {
      params: {
        access_token: this.accessToken,
        fields: 'id,name,account_status,currency,timezone_name,business',
      },
    });

    return response.data;
  }

  /**
   * Get all campaigns for an ad account
   */
  async getCampaigns(
    adAccountId: string,
    dateRange?: { since: string; until: string }
  ): Promise<MetaCampaign[]> {
    await this.rateLimit();

    const params: any = {
      access_token: this.accessToken,
      fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time',
      limit: 100,
    };

    if (dateRange) {
      params.time_range = JSON.stringify(dateRange);
    }

    const response = await this.axiosInstance.get(`/act_${adAccountId}/campaigns`, {
      params,
    });

    return response.data.data.map((campaign: any) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      dailyBudget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : undefined,
      lifetimeBudget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : undefined,
      startTime: campaign.start_time,
      stopTime: campaign.stop_time,
    }));
  }

  /**
   * Get campaign insights (aggregated metrics)
   */
  async getCampaignInsights(
    campaignId: string,
    dateRange: { since: string; until: string }
  ): Promise<MetaInsights> {
    await this.rateLimit();

    const response = await this.axiosInstance.get(`/${campaignId}/insights`, {
      params: {
        access_token: this.accessToken,
        time_range: JSON.stringify(dateRange),
        fields: 'impressions,reach,clicks,spend,actions,video_views,frequency,cpm,cpp,ctr,cpc,cost_per_action_type',
        level: 'campaign',
      },
    });

    const data = response.data.data[0]; // Meta returns array with single object for campaign-level

    if (!data) {
      throw new Error(`No insights data available for campaign ${campaignId}`);
    }

    return this.transformInsights(data);
  }

  /**
   * Get daily time-series insights for a campaign
   */
  async getCampaignDailyInsights(
    campaignId: string,
    dateRange: { since: string; until: string }
  ): Promise<MetaInsights[]> {
    await this.rateLimit();

    const response = await this.axiosInstance.get(`/${campaignId}/insights`, {
      params: {
        access_token: this.accessToken,
        time_range: JSON.stringify(dateRange),
        time_increment: 1, // Daily breakdown
        fields: 'impressions,reach,clicks,spend,actions,video_views,frequency,cpm,cpp,ctr,cpc',
        level: 'campaign',
      },
    });

    return response.data.data.map((day: any) => this.transformInsights(day));
  }

  /**
   * Get demographic breakdown (age + gender)
   */
  async getDemographicInsights(
    campaignId: string,
    dateRange: { since: string; until: string }
  ): Promise<MetaDemographicInsight[]> {
    await this.rateLimit();

    const response = await this.axiosInstance.get(`/${campaignId}/insights`, {
      params: {
        access_token: this.accessToken,
        time_range: JSON.stringify(dateRange),
        breakdowns: 'age,gender',
        fields: 'impressions,clicks,spend,actions',
        level: 'campaign',
      },
    });

    return response.data.data.map((demo: any) => ({
      age: demo.age,
      gender: demo.gender,
      impressions: parseInt(demo.impressions) || 0,
      clicks: parseInt(demo.clicks) || 0,
      spend: parseFloat(demo.spend) || 0,
      actions: demo.actions,
    }));
  }

  /**
   * Get geographic breakdown (country)
   */
  async getGeographicInsights(
    campaignId: string,
    dateRange: { since: string; until: string }
  ): Promise<MetaGeographicInsight[]> {
    await this.rateLimit();

    const response = await this.axiosInstance.get(`/${campaignId}/insights`, {
      params: {
        access_token: this.accessToken,
        time_range: JSON.stringify(dateRange),
        breakdowns: 'country',
        fields: 'impressions,clicks,spend,actions',
        level: 'campaign',
      },
    });

    return response.data.data.map((geo: any) => ({
      country: geo.country,
      impressions: parseInt(geo.impressions) || 0,
      clicks: parseInt(geo.clicks) || 0,
      spend: parseFloat(geo.spend) || 0,
      actions: geo.actions,
    }));
  }

  /**
   * Get placement breakdown (publisher platform + position)
   */
  async getPlacementInsights(
    campaignId: string,
    dateRange: { since: string; until: string }
  ): Promise<MetaPlacementInsight[]> {
    await this.rateLimit();

    const response = await this.axiosInstance.get(`/${campaignId}/insights`, {
      params: {
        access_token: this.accessToken,
        time_range: JSON.stringify(dateRange),
        breakdowns: 'publisher_platform,platform_position',
        fields: 'impressions,clicks,spend,actions',
        level: 'campaign',
      },
    });

    return response.data.data.map((placement: any) => ({
      publisherPlatform: placement.publisher_platform,
      platformPosition: placement.platform_position,
      impressions: parseInt(placement.impressions) || 0,
      clicks: parseInt(placement.clicks) || 0,
      spend: parseFloat(placement.spend) || 0,
      actions: placement.actions,
    }));
  }

  /**
   * Get ad sets for a campaign
   */
  async getAdSets(campaignId: string): Promise<MetaAdSet[]> {
    await this.rateLimit();

    const response = await this.axiosInstance.get(`/${campaignId}/adsets`, {
      params: {
        access_token: this.accessToken,
        fields: 'id,name,status,daily_budget,lifetime_budget,targeting,optimization_goal',
        limit: 100,
      },
    });

    return response.data.data.map((adSet: any) => ({
      id: adSet.id,
      name: adSet.name,
      status: adSet.status,
      dailyBudget: adSet.daily_budget ? parseFloat(adSet.daily_budget) / 100 : undefined,
      lifetimeBudget: adSet.lifetime_budget ? parseFloat(adSet.lifetime_budget) / 100 : undefined,
      targeting: adSet.targeting,
      optimizationGoal: adSet.optimization_goal,
    }));
  }

  /**
   * Get ads for an ad set
   */
  async getAds(adSetId: string): Promise<MetaAd[]> {
    await this.rateLimit();

    const response = await this.axiosInstance.get(`/${adSetId}/ads`, {
      params: {
        access_token: this.accessToken,
        fields: 'id,name,status,creative{id,title,body,image_url,video_id}',
        limit: 100,
      },
    });

    return response.data.data.map((ad: any) => ({
      id: ad.id,
      name: ad.name,
      status: ad.status,
      creative: ad.creative
        ? {
            id: ad.creative.id,
            title: ad.creative.title,
            body: ad.creative.body,
            imageUrl: ad.creative.image_url,
            videoId: ad.creative.video_id,
          }
        : undefined,
    }));
  }

  /**
   * Get ad-level insights
   */
  async getAdInsights(
    adId: string,
    dateRange: { since: string; until: string }
  ): Promise<MetaInsights> {
    await this.rateLimit();

    const response = await this.axiosInstance.get(`/${adId}/insights`, {
      params: {
        access_token: this.accessToken,
        time_range: JSON.stringify(dateRange),
        fields: 'impressions,reach,clicks,spend,actions,video_views,frequency,cpm,cpp,ctr,cpc',
        level: 'ad',
      },
    });

    const data = response.data.data[0];

    if (!data) {
      return this.createEmptyInsights();
    }

    return this.transformInsights(data);
  }

  /**
   * Transform Meta API insights to internal format
   */
  private transformInsights(data: any): MetaInsights {
    const impressions = parseInt(data.impressions) || 0;
    const reach = parseInt(data.reach) || 0;
    const clicks = parseInt(data.clicks) || 0;
    const spend = parseFloat(data.spend) || 0;
    const videoViews = parseInt(data.video_views) || 0;

    // Extract conversions from actions array
    const conversions = this.extractActionValue(data.actions, [
      'offsite_conversion.fb_pixel_purchase',
      'omni_purchase',
      'purchase',
      'offsite_conversion.fb_pixel_lead',
      'lead',
    ]);

    return {
      impressions,
      reach,
      clicks,
      spend,
      actions: data.actions,
      videoViews,
      frequency: parseFloat(data.frequency) || (reach > 0 ? impressions / reach : 0),
      cpm: parseFloat(data.cpm) || (impressions > 0 ? (spend / impressions) * 1000 : 0),
      cpp: parseFloat(data.cpp) || (reach > 0 ? (spend / reach) * 1000 : 0),
      ctr: parseFloat(data.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : 0),
      cpc: parseFloat(data.cpc) || (clicks > 0 ? spend / clicks : 0),
      dateStart: data.date_start,
      dateStop: data.date_stop,
    };
  }

  /**
   * Extract specific action value from actions array
   */
  private extractActionValue(actions: MetaAction[] | undefined, actionTypes: string[]): number {
    if (!actions || !Array.isArray(actions)) {
      return 0;
    }

    for (const actionType of actionTypes) {
      const action = actions.find((a) => a.actionType === actionType || a['action_type'] === actionType);
      if (action) {
        return parseInt(action.value) || 0;
      }
    }

    return 0;
  }

  /**
   * Create empty insights object (for when no data is available)
   */
  private createEmptyInsights(): MetaInsights {
    return {
      impressions: 0,
      reach: 0,
      clicks: 0,
      spend: 0,
      actions: [],
      videoViews: 0,
      frequency: 0,
      cpm: 0,
      cpp: 0,
      ctr: 0,
      cpc: 0,
      dateStart: '',
      dateStop: '',
    };
  }

  /**
   * Batch request - get insights for multiple campaigns
   */
  async getBatchCampaignInsights(
    campaignIds: string[],
    dateRange: { since: string; until: string }
  ): Promise<Map<string, MetaInsights>> {
    const results = new Map<string, MetaInsights>();

    // Process in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < campaignIds.length; i += batchSize) {
      const batch = campaignIds.slice(i, i + batchSize);
      const promises = batch.map((id) => this.getCampaignInsights(id, dateRange));

      const batchResults = await Promise.allSettled(promises);

      batchResults.forEach((result, index) => {
        const campaignId = batch[index];
        if (result.status === 'fulfilled') {
          results.set(campaignId, result.value);
        } else {
          console.error(`Failed to fetch insights for campaign ${campaignId}:`, result.reason);
          results.set(campaignId, this.createEmptyInsights());
        }
      });

      // Add delay between batches
      if (i + batchSize < campaignIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Verify access token is valid
   */
  async verifyToken(): Promise<{ isValid: boolean; expiresAt?: Date; scopes?: string[] }> {
    try {
      const response = await this.axiosInstance.get('/debug_token', {
        params: {
          input_token: this.accessToken,
          access_token: this.accessToken,
        },
      });

      const data = response.data.data;

      return {
        isValid: data.is_valid,
        expiresAt: data.expires_at ? new Date(data.expires_at * 1000) : undefined,
        scopes: data.scopes,
      };
    } catch (error) {
      return { isValid: false };
    }
  }

  /**
   * Get long-lived access token (60 days) from short-lived token
   */
  static async exchangeToken(
    appId: string,
    appSecret: string,
    shortLivedToken: string
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const response = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedToken,
      },
    });

    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in,
    };
  }
}

/**
 * Utility function to format date for Meta API
 */
export function formatMetaDate(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Utility function to get date range for last N days
 */
export function getLastNDaysRange(days: number): { since: string; until: string } {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);

  return {
    since: formatMetaDate(since),
    until: formatMetaDate(until),
  };
}
