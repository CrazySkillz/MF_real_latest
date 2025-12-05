/**
 * KPI Refresh Utility
 * Automatically refreshes KPI currentValue from latest LinkedIn metrics
 * 
 * This is used after LinkedIn data imports to ensure KPIs stay in sync
 */

import { storage } from "../storage";
import type { KPI } from "../../shared/schema";

/**
 * Calculate metric value from LinkedIn data
 */
function calculateMetricValue(
  metricKey: string,
  aggregated: any,
  campaignData?: any
): { value: string; unit: string } {
  let currentValue = '0';
  let unit = '';

  // Use campaign-specific data if provided, otherwise use aggregated
  const data = campaignData || aggregated;
  
  const impressions = data?.impressions || data?.totalImpressions || 0;
  const clicks = data?.clicks || data?.totalClicks || 0;
  const spend = data?.spend || data?.totalSpend || 0;
  const conversions = data?.conversions || data?.totalConversions || 0;
  const leads = data?.leads || data?.totalLeads || 0;
  const engagements = data?.engagements || data?.totalEngagements || 0;
  const reach = data?.reach || data?.totalReach || 0;
  const videoViews = data?.videoViews || data?.totalVideoViews || 0;
  const viralImpressions = data?.viralImpressions || data?.totalViralImpressions || 0;
  const conversionValue = aggregated?.conversionValue || aggregated?.conversion_value || 0;

  switch (metricKey.toLowerCase()) {
    // Core metrics
    case 'impressions':
      currentValue = String(Math.round(impressions));
      break;
    case 'reach':
      currentValue = String(Math.round(reach));
      break;
    case 'clicks':
      currentValue = String(Math.round(clicks));
      break;
    case 'engagements':
      currentValue = String(Math.round(engagements));
      break;
    case 'spend':
      currentValue = spend.toFixed(2);
      unit = '$';
      break;
    case 'conversions':
      currentValue = String(Math.round(conversions));
      break;
    case 'leads':
      currentValue = String(Math.round(leads));
      break;
    case 'videoviews':
      currentValue = String(Math.round(videoViews));
      break;
    case 'viralimpressions':
      currentValue = String(Math.round(viralImpressions));
      break;

    // Derived metrics
    case 'ctr':
      currentValue = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0';
      unit = '%';
      break;
    case 'cpc':
      currentValue = clicks > 0 ? (spend / clicks).toFixed(2) : '0';
      unit = '$';
      break;
    case 'cpm':
      currentValue = impressions > 0 ? ((spend / impressions) * 1000).toFixed(2) : '0';
      unit = '$';
      break;
    case 'cvr':
      currentValue = clicks > 0 ? ((conversions / clicks) * 100).toFixed(2) : '0';
      unit = '%';
      break;
    case 'cpa':
      currentValue = conversions > 0 ? (spend / conversions).toFixed(2) : '0';
      unit = '$';
      break;
    case 'cpl':
      currentValue = leads > 0 ? (spend / leads).toFixed(2) : '0';
      unit = '$';
      break;
    case 'er':
      currentValue = impressions > 0 ? ((engagements / impressions) * 100).toFixed(2) : '0';
      unit = '%';
      break;

    // Revenue metrics (require conversion value)
    case 'roi':
      if (conversionValue > 0 && conversions > 0) {
        const revenue = conversions * conversionValue;
        const profit = revenue - spend;
        currentValue = spend > 0 ? ((profit / spend) * 100).toFixed(2) : '0';
        unit = '%';
      }
      break;
    case 'roas':
      if (conversionValue > 0 && conversions > 0) {
        const revenue = conversions * conversionValue;
        currentValue = spend > 0 ? (revenue / spend).toFixed(2) : '0';
        unit = 'x';
      }
      break;
    case 'totalrevenue':
    case 'total_revenue':
      if (conversionValue > 0 && conversions > 0) {
        const revenue = conversions * conversionValue;
        currentValue = revenue.toFixed(2);
        unit = '$';
      }
      break;
    case 'profit':
      if (conversionValue > 0 && conversions > 0) {
        const revenue = conversions * conversionValue;
        const profit = revenue - spend;
        currentValue = profit.toFixed(2);
        unit = '$';
      }
      break;
    case 'profitmargin':
    case 'profit_margin':
      if (conversionValue > 0 && conversions > 0) {
        const revenue = conversions * conversionValue;
        const profit = revenue - spend;
        currentValue = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0';
        unit = '%';
      }
      break;
    case 'revenueperlead':
    case 'revenue_per_lead':
      if (conversionValue > 0 && conversions > 0 && leads > 0) {
        const revenue = conversions * conversionValue;
        currentValue = (revenue / leads).toFixed(2);
        unit = '$';
      }
      break;
  }

  return { value: currentValue, unit };
}

/**
 * Get aggregated LinkedIn metrics for a campaign
 */
async function getAggregatedMetrics(campaignId: string): Promise<any> {
  try {
    // Get latest import session
    const sessions = await storage.getCampaignLinkedInImportSessions(campaignId);
    if (!sessions || sessions.length === 0) {
      return null;
    }

    const latestSession = sessions.sort((a: any, b: any) => 
      new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    )[0];

    // Get metrics for this session
    const metrics = await storage.getLinkedInImportMetrics(latestSession.id);
    
    // Aggregate metrics
    const aggregated: Record<string, number> = {};
    metrics.forEach((m: any) => {
      const key = m.metricKey.toLowerCase();
      const value = parseFloat(m.metricValue || '0');
      aggregated[key] = (aggregated[key] || 0) + value;
    });

    // Calculate derived metrics
    const impressions = aggregated.impressions || 0;
    const clicks = aggregated.clicks || 0;
    const spend = aggregated.spend || 0;
    const conversions = aggregated.conversions || 0;
    const leads = aggregated.leads || 0;
    const engagements = aggregated.engagements || 0;

    // Add derived metrics
    if (impressions > 0) {
      aggregated.ctr = (clicks / impressions) * 100;
      aggregated.cpm = (spend / impressions) * 1000;
      aggregated.er = (engagements / impressions) * 100;
    }
    if (clicks > 0) {
      aggregated.cpc = spend / clicks;
      aggregated.cvr = (conversions / clicks) * 100;
    }
    if (conversions > 0) {
      aggregated.cpa = spend / conversions;
    }
    if (leads > 0) {
      aggregated.cpl = spend / leads;
    }

    // Add revenue metrics if conversion value exists
    if (latestSession.conversionValue && parseFloat(latestSession.conversionValue) > 0) {
      const conversionValue = parseFloat(latestSession.conversionValue);
      aggregated.conversionValue = conversionValue;
      aggregated.hasRevenueTracking = true;
      
      if (conversions > 0) {
        const revenue = conversions * conversionValue;
        aggregated.totalRevenue = revenue;
        aggregated.profit = revenue - spend;
        
        if (spend > 0) {
          aggregated.roas = revenue / spend;
          aggregated.roi = ((revenue - spend) / spend) * 100;
        }
        if (revenue > 0) {
          aggregated.profitMargin = ((revenue - spend) / revenue) * 100;
        }
        if (leads > 0) {
          aggregated.revenuePerLead = revenue / leads;
        }
      }
    }

    return aggregated;
  } catch (error) {
    console.error(`[KPI Refresh] Error getting aggregated metrics for campaign ${campaignId}:`, error);
    return null;
  }
}

/**
 * Get campaign-specific metrics for a LinkedIn campaign
 */
async function getCampaignSpecificMetrics(
  campaignId: string,
  linkedInCampaignName: string
): Promise<any> {
  try {
    // Get latest import session
    const sessions = await storage.getCampaignLinkedInImportSessions(campaignId);
    if (!sessions || sessions.length === 0) {
      return null;
    }

    const latestSession = sessions.sort((a: any, b: any) => 
      new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    )[0];

    // Get ads for this session
    const ads = await storage.getLinkedInAdPerformance(latestSession.id);
    
    // Filter ads for this specific LinkedIn campaign
    const campaignAds = ads.filter((ad: any) => ad.campaignName === linkedInCampaignName);
    if (campaignAds.length === 0) {
      return null;
    }

    // Aggregate metrics for this campaign
    const totals = campaignAds.reduce((acc: any, ad: any) => ({
      impressions: (acc.impressions || 0) + (ad.impressions || 0),
      clicks: (acc.clicks || 0) + (ad.clicks || 0),
      spend: (acc.spend || 0) + parseFloat(ad.spend || 0),
      conversions: (acc.conversions || 0) + (ad.conversions || 0),
      leads: (acc.leads || 0) + (ad.leads || 0),
      engagements: (acc.engagements || 0) + (ad.engagements || 0),
      reach: (acc.reach || 0) + (ad.reach || 0),
      videoViews: (acc.videoViews || 0) + (ad.videoViews || 0),
      viralImpressions: (acc.viralImpressions || 0) + (ad.viralImpressions || 0),
    }), {});

    // Calculate derived metrics
    const impressions = totals.impressions || 0;
    const clicks = totals.clicks || 0;
    const spend = totals.spend || 0;
    const conversions = totals.conversions || 0;
    const leads = totals.leads || 0;
    const engagements = totals.engagements || 0;

    const campaignData = {
      ...totals,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      cvr: clicks > 0 ? (conversions / clicks) * 100 : 0,
      cpa: conversions > 0 ? spend / conversions : 0,
      cpl: leads > 0 ? spend / leads : 0,
      er: impressions > 0 ? (engagements / impressions) * 100 : 0
    };

    // Add revenue metrics if conversion value exists
    if (latestSession.conversionValue && parseFloat(latestSession.conversionValue) > 0) {
      const conversionValue = parseFloat(latestSession.conversionValue);
      if (conversions > 0) {
        const revenue = conversions * conversionValue;
        campaignData.totalRevenue = revenue;
        campaignData.profit = revenue - spend;
        
        if (spend > 0) {
          campaignData.roas = revenue / spend;
          campaignData.roi = ((revenue - spend) / spend) * 100;
        }
        if (revenue > 0) {
          campaignData.profitMargin = ((revenue - spend) / revenue) * 100;
        }
        if (leads > 0) {
          campaignData.revenuePerLead = revenue / leads;
        }
      }
    }

    return campaignData;
  } catch (error) {
    console.error(`[KPI Refresh] Error getting campaign-specific metrics:`, error);
    return null;
  }
}

/**
 * Refresh KPI currentValue from latest LinkedIn metrics
 * This is called after LinkedIn data is imported
 */
export async function refreshKPIsForCampaign(campaignId: string): Promise<void> {
  try {
    console.log(`[KPI Refresh] Refreshing KPIs for campaign ${campaignId}`);

    // Get all LinkedIn KPIs for this campaign
    const kpis = await storage.getPlatformKPIs('linkedin', campaignId);
    if (!kpis || kpis.length === 0) {
      console.log(`[KPI Refresh] No KPIs found for campaign ${campaignId}`);
      return;
    }

    console.log(`[KPI Refresh] Found ${kpis.length} KPIs to refresh`);

    // Get aggregated metrics
    const aggregated = await getAggregatedMetrics(campaignId);
    if (!aggregated) {
      console.log(`[KPI Refresh] No LinkedIn data found for campaign ${campaignId}`);
      return;
    }

    // Refresh each KPI
    for (const kpi of kpis) {
      try {
        // Skip if KPI doesn't have a metric field
        if (!kpi.metric) {
          console.log(`[KPI Refresh] Skipping KPI ${kpi.id} - no metric field`);
          continue;
        }

        // Skip if KPI is not for LinkedIn platform
        if (kpi.platformType !== 'linkedin') {
          console.log(`[KPI Refresh] Skipping KPI ${kpi.id} - not LinkedIn platform`);
          continue;
        }

        let metricValue: { value: string; unit: string };

        // Check if KPI is campaign-specific
        if (kpi.applyTo === 'specific' && kpi.specificCampaignId) {
          // Get campaign-specific metrics
          const campaignData = await getCampaignSpecificMetrics(campaignId, kpi.specificCampaignId);
          if (campaignData) {
            metricValue = calculateMetricValue(kpi.metric, aggregated, campaignData);
          } else {
            console.log(`[KPI Refresh] No campaign-specific data for ${kpi.specificCampaignId}`);
            continue;
          }
        } else {
          // Use aggregated metrics
          metricValue = calculateMetricValue(kpi.metric, aggregated);
        }

        // Update KPI if value changed
        const newValue = metricValue.value;
        if (newValue !== kpi.currentValue) {
          console.log(`[KPI Refresh] Updating KPI ${kpi.id} (${kpi.name}): ${kpi.currentValue} → ${newValue}`);
          
          await storage.updateKPI(kpi.id, {
            currentValue: newValue,
            unit: metricValue.unit || kpi.unit
          });

          console.log(`[KPI Refresh] ✅ Updated KPI ${kpi.id}`);
        } else {
          console.log(`[KPI Refresh] KPI ${kpi.id} value unchanged: ${newValue}`);
        }
      } catch (error) {
        console.error(`[KPI Refresh] Error refreshing KPI ${kpi.id}:`, error);
        // Continue with other KPIs even if one fails
      }
    }

    console.log(`[KPI Refresh] ✅ Completed refreshing KPIs for campaign ${campaignId}`);
  } catch (error) {
    console.error(`[KPI Refresh] Error refreshing KPIs for campaign ${campaignId}:`, error);
    throw error;
  }
}

