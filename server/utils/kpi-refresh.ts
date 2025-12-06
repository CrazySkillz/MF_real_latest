/**
 * KPI Refresh Utility
 * Automatically updates KPI currentValue from latest LinkedIn metrics
 */

import { storage } from "../storage";
import type { KPI } from "../../shared/schema";

/**
 * Get aggregated LinkedIn metrics for a campaign
 * Returns all core, derived, and revenue metrics
 */
async function getLatestLinkedInMetrics(campaignId: string): Promise<Record<string, number> | null> {
  try {
    // Get the latest import session for this campaign
    const sessions = await storage.getCampaignLinkedInImportSessions(campaignId);
    if (!sessions || sessions.length === 0) {
      console.log(`[KPI Refresh] No LinkedIn import sessions found for campaign ${campaignId}`);
      return null;
    }

    // Get the most recent session
    const latestSession = sessions.sort((a: any, b: any) => 
      new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    )[0];

    // Get metrics for this session
    const metrics = await storage.getLinkedInImportMetrics(latestSession.id);

    // Aggregate metrics
    const aggregated: Record<string, number> = {};
    const selectedMetrics = Array.from(new Set(metrics.map((m: any) => m.metricKey)));

    selectedMetrics.forEach((metricKey: string) => {
      const total = metrics
        .filter((m: any) => m.metricKey === metricKey)
        .reduce((sum: number, m: any) => sum + parseFloat(m.metricValue || '0'), 0);
      aggregated[metricKey] = parseFloat(total.toFixed(2));
    });

    // Calculate derived metrics
    const impressions = aggregated.impressions || 0;
    const clicks = aggregated.clicks || 0;
    const spend = aggregated.spend || 0;
    const conversions = aggregated.conversions || 0;
    const leads = aggregated.leads || 0;
    const engagements = aggregated.engagements || 0;
    const reach = aggregated.reach || 0;

    // Calculate revenue from conversion value
    if (latestSession.conversionValue && parseFloat(latestSession.conversionValue) > 0 && conversions > 0) {
      const conversionValue = parseFloat(latestSession.conversionValue);
      aggregated.totalRevenue = parseFloat((conversions * conversionValue).toFixed(2));
      aggregated.revenue = aggregated.totalRevenue; // Alias
      aggregated.conversionValue = conversionValue;

      // Calculate ROI and ROAS if revenue is available
      if (spend > 0) {
        aggregated.roas = parseFloat((aggregated.totalRevenue / spend).toFixed(2));
        aggregated.roi = parseFloat((((aggregated.totalRevenue - spend) / spend) * 100).toFixed(2));
        aggregated.profit = parseFloat((aggregated.totalRevenue - spend).toFixed(2));
        aggregated.profitMargin = parseFloat(((aggregated.profit / aggregated.totalRevenue) * 100).toFixed(2));
        if (leads > 0) {
          aggregated.revenuePerLead = parseFloat((aggregated.totalRevenue / leads).toFixed(2));
        }
      }
    }

    // CTR: (Clicks / Impressions) * 100
    if (impressions > 0) {
      aggregated.ctr = parseFloat(((clicks / impressions) * 100).toFixed(2));
    }

    // CPC: Spend / Clicks
    if (clicks > 0) {
      aggregated.cpc = parseFloat((spend / clicks).toFixed(2));
    }

    // CPM: (Spend / Impressions) * 1000
    if (impressions > 0) {
      aggregated.cpm = parseFloat(((spend / impressions) * 1000).toFixed(2));
    }

    // CVR (Conversion Rate): (Conversions / Clicks) * 100
    if (clicks > 0) {
      aggregated.cvr = parseFloat(((conversions / clicks) * 100).toFixed(2));
    }

    // CPA (Cost per Acquisition): Spend / Conversions
    if (conversions > 0) {
      aggregated.cpa = parseFloat((spend / conversions).toFixed(2));
    }

    // CPL (Cost per Lead): Spend / Leads
    if (leads > 0) {
      aggregated.cpl = parseFloat((spend / leads).toFixed(2));
    }

    // ER (Engagement Rate): (Engagements / Impressions) * 100
    if (impressions > 0) {
      aggregated.er = parseFloat(((engagements / impressions) * 100).toFixed(2));
    }

    return aggregated;
  } catch (error) {
    console.error(`[KPI Refresh] Error fetching LinkedIn metrics for campaign ${campaignId}:`, error);
    return null;
  }
}

/**
 * Get campaign-specific metrics for a specific LinkedIn campaign
 */
async function getCampaignSpecificMetrics(
  campaignId: string,
  linkedInCampaignName: string
): Promise<Record<string, number> | null> {
  try {
    const sessions = await storage.getCampaignLinkedInImportSessions(campaignId);
    if (!sessions || sessions.length === 0) {
      return null;
    }

    const latestSession = sessions.sort((a: any, b: any) => 
      new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    )[0];

    // Get ads for this session
    const ads = await storage.getLinkedInAdPerformance(latestSession.id);
    
    // Filter ads for the specific campaign
    const campaignAds = ads.filter((ad: any) => ad.campaignName === linkedInCampaignName);
    
    if (campaignAds.length === 0) {
      console.log(`[KPI Refresh] No ads found for LinkedIn campaign: ${linkedInCampaignName}`);
      return null;
    }

    // Aggregate metrics from all ads in this campaign
    const aggregated: Record<string, number> = {
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      leads: 0,
      engagements: 0,
      reach: 0,
    };

    campaignAds.forEach((ad: any) => {
      aggregated.impressions += ad.impressions || 0;
      aggregated.clicks += ad.clicks || 0;
      aggregated.spend += parseFloat(ad.spend || '0');
      aggregated.conversions += ad.conversions || 0;
      aggregated.leads += ad.leads || 0;
      aggregated.engagements += ad.engagements || 0;
      aggregated.reach += ad.reach || 0;
    });

    // Calculate derived metrics (same logic as aggregate)
    const impressions = aggregated.impressions || 0;
    const clicks = aggregated.clicks || 0;
    const spend = aggregated.spend || 0;
    const conversions = aggregated.conversions || 0;
    const leads = aggregated.leads || 0;
    const engagements = aggregated.engagements || 0;

    // Get conversion value from session
    if (latestSession.conversionValue && parseFloat(latestSession.conversionValue) > 0 && conversions > 0) {
      const conversionValue = parseFloat(latestSession.conversionValue);
      aggregated.totalRevenue = parseFloat((conversions * conversionValue).toFixed(2));
      aggregated.revenue = aggregated.totalRevenue;
      
      if (spend > 0) {
        aggregated.roas = parseFloat((aggregated.totalRevenue / spend).toFixed(2));
        aggregated.roi = parseFloat((((aggregated.totalRevenue - spend) / spend) * 100).toFixed(2));
        aggregated.profit = parseFloat((aggregated.totalRevenue - spend).toFixed(2));
        aggregated.profitMargin = parseFloat(((aggregated.profit / aggregated.totalRevenue) * 100).toFixed(2));
        if (leads > 0) {
          aggregated.revenuePerLead = parseFloat((aggregated.totalRevenue / leads).toFixed(2));
        }
      }
    }

    if (impressions > 0) {
      aggregated.ctr = parseFloat(((clicks / impressions) * 100).toFixed(2));
    }
    if (clicks > 0) {
      aggregated.cpc = parseFloat((spend / clicks).toFixed(2));
    }
    if (impressions > 0) {
      aggregated.cpm = parseFloat(((spend / impressions) * 1000).toFixed(2));
    }
    if (clicks > 0) {
      aggregated.cvr = parseFloat(((conversions / clicks) * 100).toFixed(2));
    }
    if (conversions > 0) {
      aggregated.cpa = parseFloat((spend / conversions).toFixed(2));
    }
    if (leads > 0) {
      aggregated.cpl = parseFloat((spend / leads).toFixed(2));
    }
    if (impressions > 0) {
      aggregated.er = parseFloat(((engagements / impressions) * 100).toFixed(2));
    }

    return aggregated;
  } catch (error) {
    console.error(`[KPI Refresh] Error fetching campaign-specific metrics:`, error);
    return null;
  }
}

/**
 * Map KPI metric name to LinkedIn metric key
 */
function mapKPIMetricToLinkedInKey(kpiMetric: string): string {
  const metricMap: Record<string, string> = {
    // Core metrics
    'impressions': 'impressions',
    'reach': 'reach',
    'clicks': 'clicks',
    'engagements': 'engagements',
    'spend': 'spend',
    'conversions': 'conversions',
    'leads': 'leads',
    
    // Derived metrics
    'ctr': 'ctr',
    'cpc': 'cpc',
    'cpm': 'cpm',
    'cvr': 'cvr',
    'cpa': 'cpa',
    'cpl': 'cpl',
    'er': 'er',
    
    // Revenue metrics
    'totalrevenue': 'totalRevenue',
    'total revenue': 'totalRevenue',
    'revenue': 'totalRevenue',
    'roas': 'roas',
    'roi': 'roi',
    'profit': 'profit',
    'profitmargin': 'profitMargin',
    'profit margin': 'profitMargin',
    'revenueperlead': 'revenuePerLead',
    'revenue per lead': 'revenuePerLead',
  };

  const normalized = kpiMetric.toLowerCase().trim();
  return metricMap[normalized] || normalized;
}

/**
 * Calculate currentValue for a KPI from LinkedIn metrics
 */
function calculateKPIValue(kpi: KPI, metrics: Record<string, number>): string | null {
  if (!kpi.metric) {
    console.log(`[KPI Refresh] KPI ${kpi.name} has no metric field, skipping`);
    return null;
  }

  const metricKey = mapKPIMetricToLinkedInKey(kpi.metric);
  const value = metrics[metricKey];

  if (value === undefined || value === null) {
    console.log(`[KPI Refresh] Metric ${metricKey} not found in LinkedIn data for KPI ${kpi.name}`);
    return null;
  }

  // Format value based on unit
  if (kpi.unit === '%') {
    return value.toFixed(2);
  } else if (kpi.unit === '$') {
    return value.toFixed(2);
  } else {
    return value.toString();
  }
}

/**
 * Refresh all KPIs for a campaign from latest LinkedIn metrics
 */
export async function refreshKPIsForCampaign(campaignId: string): Promise<{ updated: number; errors: number }> {
  console.log(`[KPI Refresh] Starting refresh for campaign ${campaignId}`);
  
  let updated = 0;
  let errors = 0;

  try {
    // Get all LinkedIn KPIs for this campaign
    const kpis = await storage.getPlatformKPIs('linkedin', campaignId);
    
    if (!kpis || kpis.length === 0) {
      console.log(`[KPI Refresh] No KPIs found for campaign ${campaignId}`);
      return { updated: 0, errors: 0 };
    }

    console.log(`[KPI Refresh] Found ${kpis.length} KPIs to refresh`);

    // Get latest LinkedIn metrics
    const aggregatedMetrics = await getLatestLinkedInMetrics(campaignId);
    
    if (!aggregatedMetrics) {
      console.log(`[KPI Refresh] No LinkedIn metrics found for campaign ${campaignId}, skipping refresh`);
      return { updated: 0, errors: 0 };
    }

    // Refresh each KPI
    for (const kpi of kpis) {
      try {
        let metrics = aggregatedMetrics;
        
        // If KPI is campaign-specific, get campaign-specific metrics
        if (kpi.applyTo === 'specific' && kpi.specificCampaignId) {
          const campaignMetrics = await getCampaignSpecificMetrics(campaignId, kpi.specificCampaignId);
          if (campaignMetrics) {
            metrics = campaignMetrics;
          } else {
            console.log(`[KPI Refresh] Using aggregate metrics for campaign-specific KPI ${kpi.name} (campaign not found)`);
          }
        }

        const newCurrentValue = calculateKPIValue(kpi, metrics);
        
        if (newCurrentValue === null) {
          console.log(`[KPI Refresh] Could not calculate value for KPI ${kpi.name}, skipping update`);
          errors++;
          continue;
        }

        // Only update if value has changed
        if (kpi.currentValue !== newCurrentValue) {
          await storage.updateKPI(kpi.id, {
            currentValue: newCurrentValue
          });
          
          console.log(`[KPI Refresh] Updated KPI ${kpi.name}: ${kpi.currentValue} → ${newCurrentValue}`);
          updated++;
        } else {
          console.log(`[KPI Refresh] KPI ${kpi.name} value unchanged: ${newCurrentValue}`);
        }
      } catch (error) {
        console.error(`[KPI Refresh] Error refreshing KPI ${kpi.id}:`, error);
        errors++;
      }
    }

    console.log(`[KPI Refresh] Completed: ${updated} updated, ${errors} errors`);
    return { updated, errors };
  } catch (error) {
    console.error(`[KPI Refresh] Error refreshing KPIs for campaign ${campaignId}:`, error);
    return { updated: 0, errors: 0 };
  }
}
