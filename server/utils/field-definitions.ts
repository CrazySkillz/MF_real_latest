/**
 * Platform Field Definitions
 * Defines required and optional fields for each platform with aliases and patterns for auto-detection
 */

export interface PlatformField {
  id: string;
  name: string;
  type: 'number' | 'text' | 'date' | 'currency' | 'percentage' | 'boolean';
  required: boolean;
  category: 'metrics' | 'dimensions' | 'identifiers';
  aliases: string[];
  patterns: RegExp[];
  validation?: (value: any) => boolean;
  transform?: (value: any) => any;
  description?: string;
}

/**
 * LinkedIn Ads Platform Fields
 */
export const LINKEDIN_PLATFORM_FIELDS: PlatformField[] = [
  {
    id: 'campaign_name',
    name: 'Campaign Name',
    type: 'text',
    required: false,
    category: 'identifiers',
    aliases: ['campaign', 'campaign name', 'campaign_name', 'ad campaign', 'campaign title', 'campaign_title'],
    patterns: [/campaign.*name/i, /^campaign$/i, /ad.*campaign/i],
    description: 'Name of the advertising campaign'
  },
  {
    id: 'campaign_id',
    name: 'Campaign ID',
    type: 'text',
    required: false,
    category: 'identifiers',
    aliases: ['campaign id', 'campaign_id', 'campaignid', 'id', 'campaign identifier', 'linkedin campaign id', 'linkedin_campaign_id', 'urn'],
    patterns: [/campaign.*id/i, /campaignid/i, /^id$/i, /urn/i],
    description: 'Numeric campaign ID or URN (e.g., 123456789 or urn:li:sponsoredCampaign:123456789)'
  },
  {
    id: 'platform',
    name: 'Platform',
    type: 'text',
    required: true,
    category: 'identifiers',
    aliases: ['platform', 'ad platform', 'channel', 'network', 'source', 'media'],
    patterns: [/platform/i, /channel/i, /network/i],
    description: 'Advertising platform (e.g., LinkedIn, Facebook, Google Ads)'
  },
  {
    id: 'impressions',
    name: 'Impressions',
    type: 'number',
    required: true,
    category: 'metrics',
    aliases: ['impressions', 'views', 'imp', 'impression count', 'impressions_count', 'total impressions'],
    patterns: [/impressions?/i, /^views?$/i, /imp.*count/i],
    description: 'Number of times the ad was shown',
    transform: (val) => parseInt(String(val).replace(/[^0-9]/g, '')) || 0
  },
  {
    id: 'clicks',
    name: 'Clicks',
    type: 'number',
    required: true,
    category: 'metrics',
    aliases: ['clicks', 'click', 'click count', 'clicks_count', 'total clicks', 'ctr clicks'],
    patterns: [/clicks?/i, /click.*count/i],
    description: 'Number of clicks on the ad',
    transform: (val) => parseInt(String(val).replace(/[^0-9]/g, '')) || 0
  },
  {
    id: 'spend',
    name: 'Spend (USD)',
    type: 'currency',
    required: true,
    category: 'metrics',
    aliases: ['spend', 'cost', 'budget', 'spent', 'cost (usd)', 'spend (usd)', 'ad spend', 'total spend', 'expense'],
    patterns: [/spend/i, /cost/i, /budget/i, /expense/i],
    description: 'Total amount spent on advertising',
    transform: (val) => parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0
  },
  {
    id: 'conversions',
    name: 'Conversions',
    type: 'number',
    required: false,
    category: 'metrics',
    aliases: ['conversions', 'conversion', 'conversion count', 'conv', 'conversions_count', 'total conversions'],
    patterns: [/conversions?/i, /conv.*count/i],
    description: 'Number of conversions',
    transform: (val) => parseInt(String(val).replace(/[^0-9]/g, '')) || 0
  },
  {
    id: 'revenue',
    name: 'Revenue',
    type: 'currency',
    required: false, // Will be set to required for LinkedIn campaigns with LinkedIn API connected
    category: 'metrics',
    aliases: ['revenue', 'sales', 'total revenue', 'revenue (usd)', 'income', 'sales revenue', 'total sales'],
    patterns: [/revenue/i, /sales/i, /income/i],
    description: 'Total revenue generated (required for conversion value calculation when LinkedIn API is connected)',
    transform: (val) => parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0
  }
];

/**
 * Google Ads Platform Fields
 */
export const GOOGLE_ADS_PLATFORM_FIELDS: PlatformField[] = [
  ...LINKEDIN_PLATFORM_FIELDS,
  {
    id: 'ctr',
    name: 'CTR (Click-Through Rate)',
    type: 'percentage',
    required: false,
    category: 'metrics',
    aliases: ['ctr', 'click through rate', 'click-through rate'],
    patterns: [/ctr/i, /click.*through.*rate/i],
    description: 'Click-through rate as percentage'
  },
  {
    id: 'cpc',
    name: 'CPC (Cost Per Click)',
    type: 'currency',
    required: false,
    category: 'metrics',
    aliases: ['cpc', 'cost per click', 'cost-per-click'],
    patterns: [/cpc/i, /cost.*per.*click/i],
    description: 'Average cost per click'
  }
];

/**
 * Facebook/Meta Ads Platform Fields
 */
export const FACEBOOK_ADS_PLATFORM_FIELDS: PlatformField[] = [
  ...LINKEDIN_PLATFORM_FIELDS,
  {
    id: 'reach',
    name: 'Reach',
    type: 'number',
    required: false,
    category: 'metrics',
    aliases: ['reach', 'people reached', 'unique reach'],
    patterns: [/reach/i],
    description: 'Number of unique people who saw the ad'
  }
];

/**
 * Get platform fields by platform name
 */
export function getPlatformFields(platform: string): PlatformField[] {
  const platformLower = platform.toLowerCase();
  
  if (platformLower.includes('google') || platformLower.includes('google ads')) {
    return GOOGLE_ADS_PLATFORM_FIELDS;
  }
  
  if (platformLower.includes('facebook') || platformLower.includes('meta')) {
    return FACEBOOK_ADS_PLATFORM_FIELDS;
  }
  
  // Default to LinkedIn fields
  return LINKEDIN_PLATFORM_FIELDS;
}

/**
 * Get required fields only
 */
export function getRequiredFields(platform: string): PlatformField[] {
  return getPlatformFields(platform).filter(field => field.required);
}

/**
 * Get field by ID
 */
export function getFieldById(platform: string, fieldId: string): PlatformField | undefined {
  return getPlatformFields(platform).find(field => field.id === fieldId);
}

