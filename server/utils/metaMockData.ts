/**
 * Mock data generator for Meta/Facebook Ads
 * Generates realistic ad campaign metrics for testing and demos
 */

interface MetaCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  objective: 'REACH' | 'TRAFFIC' | 'ENGAGEMENT' | 'CONVERSIONS' | 'APP_INSTALLS' | 'BRAND_AWARENESS';
  dailyBudget: number;
  lifetimeBudget?: number;
  startDate: Date;
  endDate?: Date;
}

interface MetaDailyMetrics {
  date: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number;
  videoViews: number;
  postEngagement: number;
  linkClicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpp: number;
  frequency: number;
  costPerConversion: number;
}

interface MetaDemographics {
  ageRange: string;
  gender: 'male' | 'female' | 'unknown';
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

interface MetaGeographics {
  country: string;
  region?: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

interface MetaPlacement {
  placement: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

/**
 * Generate realistic test campaigns based on ad account
 */
export function generateMetaCampaigns(adAccountId: string, adAccountName: string): MetaCampaign[] {
  const campaignTypes = [
    { name: 'Brand Awareness Campaign', objective: 'BRAND_AWARENESS' as const, budget: 5000 },
    { name: 'Website Traffic Drive', objective: 'TRAFFIC' as const, budget: 3000 },
    { name: 'Lead Generation', objective: 'CONVERSIONS' as const, budget: 8000 },
    { name: 'Product Launch - Holiday Sale', objective: 'CONVERSIONS' as const, budget: 12000 },
    { name: 'Retargeting Campaign', objective: 'CONVERSIONS' as const, budget: 4500 },
    { name: 'Video Views Campaign', objective: 'ENGAGEMENT' as const, budget: 2500 },
  ];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30); // Started 30 days ago

  return campaignTypes.map((type, index) => ({
    id: `${adAccountId}_campaign_${index + 1}`,
    name: `${adAccountName} - ${type.name}`,
    status: index < 4 ? 'ACTIVE' : (index === 4 ? 'PAUSED' : 'ACTIVE'),
    objective: type.objective,
    dailyBudget: type.budget / 30,
    lifetimeBudget: type.budget,
    startDate,
    endDate: index === 3 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined, // Holiday sale ends in 7 days
  }));
}

/**
 * Generate daily metrics for the last 30 days
 */
export function generateDailyMetrics(campaign: MetaCampaign, days: number = 30): MetaDailyMetrics[] {
  const metrics: MetaDailyMetrics[] = [];
  const today = new Date();
  
  // Base metrics vary by objective
  const baseMetrics = getBaseMetricsByObjective(campaign.objective);
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Add some realistic variance (weekends lower, weekdays higher)
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendMultiplier = isWeekend ? 0.7 : 1.0;
    
    // Add trend (performance improves over time as optimization kicks in)
    const trendMultiplier = 0.8 + (0.4 * (days - i) / days); // 0.8 to 1.2
    
    // Random daily variance
    const randomVariance = 0.85 + Math.random() * 0.3; // 0.85 to 1.15
    
    const multiplier = weekendMultiplier * trendMultiplier * randomVariance;
    
    const impressions = Math.round(baseMetrics.impressions * multiplier);
    const reach = Math.round(impressions * (0.7 + Math.random() * 0.2)); // 70-90% of impressions
    const clicks = Math.round(impressions * baseMetrics.ctr);
    const spend = parseFloat((campaign.dailyBudget * multiplier).toFixed(2));
    const conversions = Math.round(clicks * baseMetrics.conversionRate);
    const videoViews = campaign.objective === 'ENGAGEMENT' ? Math.round(impressions * 0.15) : 0;
    const postEngagement = Math.round(impressions * 0.05);
    const linkClicks = Math.round(clicks * 0.9); // 90% of clicks are link clicks
    
    const ctr = parseFloat(((clicks / impressions) * 100).toFixed(2));
    const cpc = parseFloat((spend / clicks).toFixed(2));
    const cpm = parseFloat((spend / impressions * 1000).toFixed(2));
    const cpp = parseFloat((spend / reach * 1000).toFixed(2));
    const frequency = parseFloat((impressions / reach).toFixed(2));
    const costPerConversion = conversions > 0 ? parseFloat((spend / conversions).toFixed(2)) : 0;
    
    metrics.push({
      date: date.toISOString().split('T')[0],
      impressions,
      reach,
      clicks,
      spend,
      conversions,
      videoViews,
      postEngagement,
      linkClicks,
      ctr,
      cpc,
      cpm,
      cpp,
      frequency,
      costPerConversion,
    });
  }
  
  return metrics;
}

/**
 * Get base metrics configuration by campaign objective
 */
function getBaseMetricsByObjective(objective: MetaCampaign['objective']) {
  const configs = {
    BRAND_AWARENESS: {
      impressions: 50000,
      ctr: 0.008, // 0.8%
      conversionRate: 0.01, // 1% of clicks convert
    },
    TRAFFIC: {
      impressions: 35000,
      ctr: 0.015, // 1.5%
      conversionRate: 0.02, // 2% of clicks convert
    },
    ENGAGEMENT: {
      impressions: 40000,
      ctr: 0.025, // 2.5%
      conversionRate: 0.015, // 1.5% of clicks convert
    },
    CONVERSIONS: {
      impressions: 25000,
      ctr: 0.02, // 2%
      conversionRate: 0.05, // 5% of clicks convert
    },
    APP_INSTALLS: {
      impressions: 30000,
      ctr: 0.018, // 1.8%
      conversionRate: 0.08, // 8% of clicks convert (install)
    },
  };
  
  return configs[objective] || configs.CONVERSIONS;
}

/**
 * Generate demographic breakdown
 */
export function generateDemographics(totalImpressions: number, totalClicks: number, totalSpend: number, totalConversions: number): MetaDemographics[] {
  const demographics: MetaDemographics[] = [];
  
  const ageRanges = [
    { range: '18-24', impressionShare: 0.15, ctrMultiplier: 1.2 },
    { range: '25-34', impressionShare: 0.35, ctrMultiplier: 1.3 },
    { range: '35-44', impressionShare: 0.25, ctrMultiplier: 1.0 },
    { range: '45-54', impressionShare: 0.15, ctrMultiplier: 0.8 },
    { range: '55-64', impressionShare: 0.07, ctrMultiplier: 0.7 },
    { range: '65+', impressionShare: 0.03, ctrMultiplier: 0.6 },
  ];
  
  const genders: Array<'male' | 'female'> = ['male', 'female'];
  
  ageRanges.forEach(age => {
    genders.forEach(gender => {
      const genderShare = gender === 'male' ? 0.48 : 0.52;
      const impressions = Math.round(totalImpressions * age.impressionShare * genderShare);
      const baseCtr = totalClicks / totalImpressions;
      const clicks = Math.round(impressions * baseCtr * age.ctrMultiplier);
      const spend = parseFloat((totalSpend * (impressions / totalImpressions)).toFixed(2));
      const conversions = Math.round(totalConversions * (clicks / totalClicks));
      
      demographics.push({
        ageRange: age.range,
        gender,
        impressions,
        clicks,
        spend,
        conversions,
      });
    });
  });
  
  return demographics;
}

/**
 * Generate geographic breakdown
 */
export function generateGeographics(totalImpressions: number, totalClicks: number, totalSpend: number, totalConversions: number): MetaGeographics[] {
  const countries = [
    { country: 'United States', share: 0.45, ctrMultiplier: 1.2 },
    { country: 'United Kingdom', share: 0.15, ctrMultiplier: 1.1 },
    { country: 'Canada', share: 0.12, ctrMultiplier: 1.15 },
    { country: 'Australia', share: 0.08, ctrMultiplier: 1.0 },
    { country: 'Germany', share: 0.07, ctrMultiplier: 0.9 },
    { country: 'France', share: 0.06, ctrMultiplier: 0.85 },
    { country: 'Other', share: 0.07, ctrMultiplier: 0.8 },
  ];
  
  const baseCtr = totalClicks / totalImpressions;
  
  return countries.map(country => {
    const impressions = Math.round(totalImpressions * country.share);
    const clicks = Math.round(impressions * baseCtr * country.ctrMultiplier);
    const spend = parseFloat((totalSpend * country.share).toFixed(2));
    const conversions = Math.round(totalConversions * (clicks / totalClicks));
    
    return {
      country: country.country,
      impressions,
      clicks,
      spend,
      conversions,
    };
  });
}

/**
 * Generate placement breakdown
 */
export function generatePlacements(totalImpressions: number, totalClicks: number, totalSpend: number, totalConversions: number): MetaPlacement[] {
  const placements = [
    { placement: 'Facebook Feed', share: 0.35, ctrMultiplier: 1.3 },
    { placement: 'Instagram Feed', share: 0.25, ctrMultiplier: 1.4 },
    { placement: 'Instagram Stories', share: 0.15, ctrMultiplier: 1.1 },
    { placement: 'Facebook Right Column', share: 0.10, ctrMultiplier: 0.6 },
    { placement: 'Audience Network', share: 0.08, ctrMultiplier: 0.8 },
    { placement: 'Messenger', share: 0.05, ctrMultiplier: 0.9 },
    { placement: 'Facebook Stories', share: 0.02, ctrMultiplier: 1.0 },
  ];
  
  const baseCtr = totalClicks / totalImpressions;
  
  return placements.map(placement => {
    const impressions = Math.round(totalImpressions * placement.share);
    const clicks = Math.round(impressions * baseCtr * placement.ctrMultiplier);
    const spend = parseFloat((totalSpend * placement.share).toFixed(2));
    const conversions = Math.round(totalConversions * (clicks / totalClicks));
    
    return {
      placement: placement.placement,
      impressions,
      clicks,
      spend,
      conversions,
    };
  });
}

/**
 * Generate complete mock data for a Meta ad account
 */
export function generateMetaMockData(adAccountId: string, adAccountName: string) {
  const campaigns = generateMetaCampaigns(adAccountId, adAccountName);
  
  const campaignData = campaigns.map(campaign => {
    const dailyMetrics = generateDailyMetrics(campaign);
    
    // Calculate totals
    const totals = dailyMetrics.reduce((acc, day) => ({
      impressions: acc.impressions + day.impressions,
      reach: acc.reach + day.reach,
      clicks: acc.clicks + day.clicks,
      spend: acc.spend + day.spend,
      conversions: acc.conversions + day.conversions,
      videoViews: acc.videoViews + day.videoViews,
      postEngagement: acc.postEngagement + day.postEngagement,
      linkClicks: acc.linkClicks + day.linkClicks,
    }), {
      impressions: 0,
      reach: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      videoViews: 0,
      postEngagement: 0,
      linkClicks: 0,
    });
    
    const demographics = generateDemographics(totals.impressions, totals.clicks, totals.spend, totals.conversions);
    const geographics = generateGeographics(totals.impressions, totals.clicks, totals.spend, totals.conversions);
    const placements = generatePlacements(totals.impressions, totals.clicks, totals.spend, totals.conversions);
    
    return {
      campaign,
      dailyMetrics,
      totals: {
        ...totals,
        ctr: parseFloat(((totals.clicks / totals.impressions) * 100).toFixed(2)),
        cpc: parseFloat((totals.spend / totals.clicks).toFixed(2)),
        cpm: parseFloat((totals.spend / totals.impressions * 1000).toFixed(2)),
        cpp: parseFloat((totals.spend / totals.reach * 1000).toFixed(2)),
        frequency: parseFloat((totals.impressions / totals.reach).toFixed(2)),
        costPerConversion: totals.conversions > 0 ? parseFloat((totals.spend / totals.conversions).toFixed(2)) : 0,
        conversionRate: parseFloat(((totals.conversions / totals.clicks) * 100).toFixed(2)),
      },
      demographics,
      geographics,
      placements,
    };
  });
  
  const totalSpend = campaignData.reduce((sum, c) => sum + c.totals.spend, 0);
  const totalImpressions = campaignData.reduce((sum, c) => sum + c.totals.impressions, 0);
  const totalReach = campaignData.reduce((sum, c) => sum + c.totals.reach, 0);
  const totalClicks = campaignData.reduce((sum, c) => sum + c.totals.clicks, 0);
  const totalConversions = campaignData.reduce((sum, c) => sum + c.totals.conversions, 0);
  const totalVideoViews = campaignData.reduce((sum, c) => sum + c.totals.videoViews, 0);

  return {
    adAccountId,
    adAccountName,
    campaigns: campaignData,
    summary: {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
      totalSpend: parseFloat(totalSpend.toFixed(2)),
      totalImpressions,
      totalReach,
      totalClicks,
      totalConversions,
      totalVideoViews,
      avgCTR: parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)),
      avgCPC: parseFloat((totalSpend / totalClicks).toFixed(2)),
      avgCPM: parseFloat((totalSpend / totalImpressions * 1000).toFixed(2)),
      avgCPP: parseFloat((totalSpend / totalReach * 1000).toFixed(2)),
      avgFrequency: parseFloat((totalImpressions / totalReach).toFixed(2)),
      costPerConversion: totalConversions > 0 ? parseFloat((totalSpend / totalConversions).toFixed(2)) : 0,
      conversionRate: parseFloat(((totalConversions / totalClicks) * 100).toFixed(2)),
    },
  };
}

