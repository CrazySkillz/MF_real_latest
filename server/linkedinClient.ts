import axios, { AxiosInstance } from 'axios';

interface LinkedInTokens {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

interface LinkedInAdAccount {
  id: string;
  name: string;
  reference: string;
  type: string;
  status: string;
}

interface LinkedInCampaign {
  id: string;
  name: string;
  status: string;
  dailyBudget?: {
    amount: string;
  };
  totalBudget?: {
    amount: string;
  };
}

interface LinkedInAdAnalytics {
  campaignId: string;
  impressions: number;
  clicks: number;
  costInLocalCurrency: number;
  externalWebsiteConversions: number;
}

export class LinkedInClient {
  private accessToken: string;
  private api: AxiosInstance;
  
  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.api = axios.create({
      baseURL: 'https://api.linkedin.com/rest',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202405',
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json'
      }
    });
  }

  static async exchangeCodeForToken(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<LinkedInTokens> {
    try {
      const response = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('LinkedIn token exchange error:', error.response?.data || error.message);
      throw new Error(`Failed to exchange code for token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  async getAdAccounts(): Promise<LinkedInAdAccount[]> {
    try {
      const response = await this.api.get('/adAccounts', {
        params: {
          q: 'search',
          search: {
            status: {
              values: ['ACTIVE', 'DRAFT', 'CANCELED', 'PENDING_DELETION', 'REMOVED']
            }
          },
          fields: 'id,name,reference,type,status'
        }
      });

      return response.data.elements || [];
    } catch (error: any) {
      console.error('LinkedIn get ad accounts error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch ad accounts: ${error.response?.data?.message || error.message}`);
    }
  }

  async getCampaigns(adAccountId: string): Promise<LinkedInCampaign[]> {
    try {
      const response = await this.api.get('/adCampaigns', {
        params: {
          q: 'search',
          search: {
            account: {
              values: [adAccountId]
            },
            status: {
              values: ['ACTIVE', 'PAUSED', 'ARCHIVED', 'DRAFT', 'PENDING_DELETION', 'CANCELED', 'COMPLETED']
            }
          },
          fields: 'id,name,status,dailyBudget,totalBudget,runSchedule'
        }
      });

      return response.data.elements || [];
    } catch (error: any) {
      console.error('LinkedIn get campaigns error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch campaigns: ${error.response?.data?.message || error.message}`);
    }
  }

  async getCampaignAnalytics(
    campaignIds: string[],
    startDate: string, // Format: YYYY-MM-DD
    endDate: string     // Format: YYYY-MM-DD
  ): Promise<any[]> {
    try {
      const response = await this.api.get('/adAnalytics', {
        params: {
          q: 'analytics',
          campaigns: `List(${campaignIds.map(id => `urn:li:sponsoredCampaign:${id.replace('urn:li:sponsoredCampaign:', '')}`).join(',')})`,
          dateRange: {
            start: {
              day: parseInt(startDate.split('-')[2]),
              month: parseInt(startDate.split('-')[1]),
              year: parseInt(startDate.split('-')[0])
            },
            end: {
              day: parseInt(endDate.split('-')[2]),
              month: parseInt(endDate.split('-')[1]),
              year: parseInt(endDate.split('-')[0])
            }
          },
          timeGranularity: 'ALL',
          pivot: 'CAMPAIGN',
          fields: 'impressions,clicks,costInLocalCurrency,externalWebsiteConversions,dateRange,pivotValues'
        }
      });

      return response.data.elements || [];
    } catch (error: any) {
      console.error('LinkedIn get analytics error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch campaign analytics: ${error.response?.data?.message || error.message}`);
    }
  }

  async getCreativeAnalytics(
    campaignIds: string[],
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    try {
      const response = await this.api.get('/adAnalytics', {
        params: {
          q: 'analytics',
          campaigns: `List(${campaignIds.map(id => `urn:li:sponsoredCampaign:${id.replace('urn:li:sponsoredCampaign:', '')}`).join(',')})`,
          dateRange: {
            start: {
              day: parseInt(startDate.split('-')[2]),
              month: parseInt(startDate.split('-')[1]),
              year: parseInt(startDate.split('-')[0])
            },
            end: {
              day: parseInt(endDate.split('-')[2]),
              month: parseInt(endDate.split('-')[1]),
              year: parseInt(endDate.split('-')[0])
            }
          },
          timeGranularity: 'ALL',
          pivot: 'CREATIVE',
          fields: 'impressions,clicks,costInLocalCurrency,externalWebsiteConversions,dateRange,pivotValues'
        }
      });

      return response.data.elements || [];
    } catch (error: any) {
      console.error('LinkedIn get creative analytics error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch creative analytics: ${error.response?.data?.message || error.message}`);
    }
  }

  async getCreatives(campaignIds: string[]): Promise<any[]> {
    try {
      const creatives: any[] = [];
      
      for (const campaignId of campaignIds) {
        const response = await this.api.get('/adCreatives', {
          params: {
            q: 'search',
            search: {
              campaign: {
                values: [campaignId]
              }
            },
            fields: 'id,campaign,name,type,status'
          }
        });
        
        if (response.data.elements) {
          creatives.push(...response.data.elements.map((creative: any) => ({
            ...creative,
            campaignId
          })));
        }
      }

      return creatives;
    } catch (error: any) {
      console.error('LinkedIn get creatives error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch creatives: ${error.response?.data?.message || error.message}`);
    }
  }
}
