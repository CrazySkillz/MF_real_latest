/**
 * KPI Refresh Utility
 * Automatically updates KPI currentValue from latest LinkedIn metrics
 */

import { storage } from "../storage";
import type { KPI } from "../../shared/schema";
import {
  computeCpaRounded,
  computeCpc,
  computeCpl,
  computeCpm,
  computeCtrPercent,
  computeCvrPercent,
  computeErPercent,
} from "../../shared/linkedin-metrics-math";

function isoDateUTC(d: any): string | null {
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function yesterdayUTC(): string {
  const now = new Date();
  const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return y.toISOString().slice(0, 10);
}

function getMetricCaseInsensitive(obj: Record<string, any>, key: string): number {
  const direct = obj[key];
  if (direct !== undefined && direct !== null) {
    const n = typeof direct === "number" ? direct : parseFloat(String(direct));
    return Number.isFinite(n) ? n : 0;
  }
  const wanted = String(key || "").toLowerCase();
  for (const k of Object.keys(obj)) {
    if (String(k).toLowerCase() === wanted) {
      const v = (obj as any)[k];
      const n = typeof v === "number" ? v : parseFloat(String(v));
      return Number.isFinite(n) ? n : 0;
    }
  }
  return 0;
}

function parseConversionValueFrom(obj: any): number {
  if (!obj) return 0;
  const candidates = [
    obj.conversionValue,
    obj.conversion_value,
    obj.conversionvalue,
    obj.conversionValueUsd,
    obj.conversion_value_usd,
  ];
  for (const c of candidates) {
    const n = typeof c === "number" ? c : parseFloat(String(c ?? ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function firstNonZero(obj: Record<string, any>, keys: string[]): number {
  for (const k of keys) {
    const v = getMetricCaseInsensitive(obj, k);
    if (Number.isFinite(v) && v !== 0) return v;
  }
  return 0;
}

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

    // Normalize commonly-aliased metric keys (LinkedIn sometimes uses externalWebsiteConversions, etc.)
    const impressions = firstNonZero(aggregated, ["impressions", "totalImpressions"]);
    const clicks = firstNonZero(aggregated, ["clicks", "totalClicks"]);
    const spend = firstNonZero(aggregated, ["spend", "totalSpend"]);
    const conversions =
      firstNonZero(aggregated, ["conversions", "totalConversions"]) +
      getMetricCaseInsensitive(aggregated, "externalwebsiteconversions") +
      getMetricCaseInsensitive(aggregated, "externalWebsiteConversions") +
      getMetricCaseInsensitive(aggregated, "external_website_conversions");
    const leads = firstNonZero(aggregated, ["leads", "totalLeads"]);
    const engagements = firstNonZero(aggregated, ["engagements", "totalEngagements"]);
    const reach = firstNonZero(aggregated, ["reach", "totalReach"]);

    // Store normalized totals under canonical keys so KPI mapping is consistent.
    aggregated.impressions = parseFloat(impressions.toFixed(2));
    aggregated.clicks = parseFloat(clicks.toFixed(2));
    aggregated.spend = parseFloat(spend.toFixed(2));
    aggregated.conversions = parseFloat(conversions.toFixed(2));
    aggregated.leads = parseFloat(leads.toFixed(2));
    aggregated.engagements = parseFloat(engagements.toFixed(2));
    aggregated.reach = parseFloat(reach.toFixed(2));

    // Revenue logic MUST match Overview (`GET /api/linkedin/imports/:sessionId`) for coherence.
    // Key rules from Overview:
    // - Never use campaign.conversionValue as a fallback (it can be stale/incoherent).
    // - Prefer imported revenue-to-date when it exists and there is no explicit mapped conversion value.
    // - When a conversion value source exists, compute revenue as conversions × conversionValue.
    let hasAnyActiveLinkedInRevenueSource = false;
    let hasLinkedInConversionValueSource = false;
    let importedRevenueToDate = 0;
    let conversionValue = 0;
    let totalRevenue = 0;

    // 1) Revenue sources (active) determine whether conversion value is explicitly mapped.
    try {
      const sources = await storage.getRevenueSources(campaignId, "linkedin");
      hasAnyActiveLinkedInRevenueSource = (sources || []).length > 0;
      hasLinkedInConversionValueSource = (sources || []).some((s: any) => {
        try {
          const raw = (s as any)?.mappingConfig;
          if (!raw) return false;
          const cfg = typeof raw === "string" ? JSON.parse(raw) : raw;
          const vs = String(cfg?.valueSource || "").trim().toLowerCase();
          const mode = String(cfg?.mode || "").trim().toLowerCase();
          return vs === "conversion_value" || mode === "conversion_value";
        } catch {
          return false;
        }
      });
    } catch {
      hasAnyActiveLinkedInRevenueSource = false;
      hasLinkedInConversionValueSource = false;
    }

    // 2) Imported revenue over the same analytics window (last 30 complete UTC days)
    try {
      const campaign = await storage.getCampaign(campaignId);
      const endDate = yesterdayUTC();
      const end = new Date(`${endDate}T00:00:00.000Z`);
      const start = new Date(end.getTime());
      start.setUTCDate(start.getUTCDate() - 29);
      let startDate = start.toISOString().slice(0, 10);
      const campStart =
        isoDateUTC((campaign as any)?.startDate) ||
        isoDateUTC((campaign as any)?.createdAt) ||
        null;
      if (campStart && String(campStart) > String(startDate)) startDate = String(campStart);
      if (String(startDate) > String(endDate)) startDate = endDate;
      const totals = await (storage as any).getRevenueTotalForRange?.(campaignId, startDate, endDate, "linkedin");
      importedRevenueToDate = Number(totals?.totalRevenue || 0);
    } catch {
      importedRevenueToDate = 0;
    }
    const hasImportedRevenue = importedRevenueToDate > 0;

    // 3) Mapped conversion value: LinkedIn connection → session (never campaign-level)
    let connCv = 0;
    let sessionCv = 0;
    try {
      const linkedInConn = await storage.getLinkedInConnection(campaignId);
      connCv = linkedInConn?.conversionValue ? parseFloat(String((linkedInConn as any).conversionValue)) : 0;
    } catch {
      connCv = 0;
    }
    try {
      sessionCv = parseFloat((latestSession as any)?.conversionValue || "0");
    } catch {
      sessionCv = 0;
    }
    const mappedConversionValue = hasAnyActiveLinkedInRevenueSource ? (connCv > 0 ? connCv : sessionCv) : connCv;

    // Derived conversion value (if we have imported revenue-to-date): Revenue-to-date ÷ Conversions
    const derivedConversionValue = (hasImportedRevenue && conversions > 0) ? (importedRevenueToDate / conversions) : 0;
    conversionValue = mappedConversionValue > 0 ? mappedConversionValue : derivedConversionValue;

    const shouldEnableRevenueTracking =
      ((hasAnyActiveLinkedInRevenueSource || hasLinkedInConversionValueSource) && conversionValue > 0) ||
      hasImportedRevenue;

    if (shouldEnableRevenueTracking) {
      // Match Overview: if imported revenue exists and there's no explicit mapped CV, use imported revenue-to-date.
      const effectiveTotalRevenue =
        hasImportedRevenue && (!hasAnyActiveLinkedInRevenueSource || mappedConversionValue <= 0)
          ? importedRevenueToDate
          : (conversions * conversionValue);
      totalRevenue = Number(Number(effectiveTotalRevenue || 0).toFixed(2));
      conversionValue = Number(Number(conversionValue || 0).toFixed(2));
    } else {
      totalRevenue = 0;
      conversionValue = 0;
    }
    
    // Set revenue metrics if we have a value
    if (totalRevenue > 0) {
      aggregated.totalRevenue = parseFloat(totalRevenue.toFixed(2));
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

    // Derived metrics (single source-of-truth math helpers)
    aggregated.ctr = computeCtrPercent(clicks, impressions);
    aggregated.cpc = computeCpc(spend, clicks);
    aggregated.cpm = computeCpm(spend, impressions);
    aggregated.cvr = computeCvrPercent(conversions, clicks);
    aggregated.cpa = computeCpaRounded(spend, conversions);
    aggregated.cpl = computeCpl(spend, leads);
    aggregated.er = computeErPercent(engagements, impressions);

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

    // Campaign-specific revenue MUST also match Overview logic:
    // use the campaign-level conversionValue determined by the same rules as aggregate,
    // then allocate campaign revenue as campaignConversions × conversionValue.
    let hasAnyActiveLinkedInRevenueSource = false;
    let hasLinkedInConversionValueSource = false;
    let importedRevenueToDate = 0;
    let conversionValue = 0;
    let totalRevenue = 0;

    // Determine total conversions overall for this session (used to derive CV from imported revenue-to-date)
    const totalConversionsOverall = campaignAds.reduce((sum: number, ad: any) => sum + (Number(ad?.conversions) || 0), 0);

    try {
      const sources = await storage.getRevenueSources(campaignId, "linkedin");
      hasAnyActiveLinkedInRevenueSource = (sources || []).length > 0;
      hasLinkedInConversionValueSource = (sources || []).some((s: any) => {
        try {
          const raw = (s as any)?.mappingConfig;
          if (!raw) return false;
          const cfg = typeof raw === "string" ? JSON.parse(raw) : raw;
          const vs = String(cfg?.valueSource || "").trim().toLowerCase();
          const mode = String(cfg?.mode || "").trim().toLowerCase();
          return vs === "conversion_value" || mode === "conversion_value";
        } catch {
          return false;
        }
      });
    } catch {
      hasAnyActiveLinkedInRevenueSource = false;
      hasLinkedInConversionValueSource = false;
    }

    try {
      const campaign = await storage.getCampaign(campaignId);
      let startDate =
        isoDateUTC((campaign as any)?.startDate) ||
        isoDateUTC((campaign as any)?.createdAt) ||
        "2020-01-01";
      const endDate = yesterdayUTC();
      if (String(startDate) > String(endDate)) startDate = endDate;
      const totals = await (storage as any).getRevenueTotalForRange?.(campaignId, startDate, endDate, "linkedin");
      importedRevenueToDate = Number(totals?.totalRevenue || 0);
    } catch {
      importedRevenueToDate = 0;
    }
    const hasImportedRevenue = importedRevenueToDate > 0;

    let connCv = 0;
    let sessionCv = 0;
    try {
      const linkedInConn = await storage.getLinkedInConnection(campaignId);
      connCv = linkedInConn?.conversionValue ? parseFloat(String((linkedInConn as any).conversionValue)) : 0;
    } catch {
      connCv = 0;
    }
    try {
      sessionCv = parseFloat((latestSession as any)?.conversionValue || "0");
    } catch {
      sessionCv = 0;
    }
    const mappedConversionValue = hasAnyActiveLinkedInRevenueSource ? (connCv > 0 ? connCv : sessionCv) : connCv;
    const derivedConversionValue = (hasImportedRevenue && totalConversionsOverall > 0)
      ? (importedRevenueToDate / totalConversionsOverall)
      : 0;
    conversionValue = mappedConversionValue > 0 ? mappedConversionValue : derivedConversionValue;

    const shouldEnableRevenueTracking =
      ((hasAnyActiveLinkedInRevenueSource || hasLinkedInConversionValueSource) && conversionValue > 0) ||
      hasImportedRevenue;

    if (shouldEnableRevenueTracking && conversionValue > 0 && conversions > 0) {
      totalRevenue = Number(Number(conversions * conversionValue).toFixed(2));
      conversionValue = Number(Number(conversionValue).toFixed(2));
    } else {
      totalRevenue = 0;
      conversionValue = Number(Number(conversionValue || 0).toFixed(2));
    }
    
    // Set revenue metrics if we have a value
    if (totalRevenue > 0) {
      aggregated.totalRevenue = parseFloat(totalRevenue.toFixed(2));
      aggregated.revenue = aggregated.totalRevenue;
      aggregated.conversionValue = conversionValue;
      
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

    // Derived metrics (single source-of-truth math helpers)
    aggregated.ctr = computeCtrPercent(clicks, impressions);
    aggregated.cpc = computeCpc(spend, clicks);
    aggregated.cpm = computeCpm(spend, impressions);
    aggregated.cvr = computeCvrPercent(conversions, clicks);
    aggregated.cpa = computeCpaRounded(spend, conversions);
    aggregated.cpl = computeCpl(spend, leads);
    aggregated.er = computeErPercent(engagements, impressions);

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
