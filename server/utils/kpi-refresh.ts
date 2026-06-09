/**
 * KPI Refresh Utility
 * Automatically updates KPI currentValue from latest LinkedIn metrics
 */

import { storage } from "../storage";
import type { Benchmark, KPI } from "../../shared/schema";
import {
  computeCpaRounded,
  computeCpc,
  computeCpl,
  computeCpm,
  computeCtrPercent,
  computeCvrPercent,
  computeErPercent,
} from "../../shared/linkedin-metrics-math";
import { resolveLinkedInRevenueContext } from "./linkedin-revenue";

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
    // Canonical latest session selection (DB-ordered, deterministic)
    const latestSession = await (storage as any).getLatestLinkedInImportSession?.(campaignId);
    if (!latestSession) {
      console.log(`[KPI Refresh] No LinkedIn import sessions found for campaign ${campaignId}`);
      return null;
    }

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

    // Canonical LinkedIn revenue rules (shared across tabs/endpoints)
    const rev = await resolveLinkedInRevenueContext({
      campaignId,
      conversionsTotal: conversions,
      sessionConversionValue: (latestSession as any)?.conversionValue,
    });

    if (rev.hasRevenueTracking && rev.totalRevenue > 0) {
      aggregated.totalRevenue = parseFloat(rev.totalRevenue.toFixed(2));
      aggregated.revenue = aggregated.totalRevenue; // Alias
      aggregated.conversionValue = rev.conversionValue;

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
    const latestSession = await (storage as any).getLatestLinkedInImportSession?.(campaignId);
    if (!latestSession) return null;

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
    const totalConversionsOverall = (ads || []).reduce((sum: number, ad: any) => sum + (Number(ad?.conversions) || 0), 0);
    const revAll = await resolveLinkedInRevenueContext({
      campaignId,
      conversionsTotal: totalConversionsOverall,
      sessionConversionValue: (latestSession as any)?.conversionValue,
    });
    const hasRevenueTracking = revAll.hasRevenueTracking;
    const totalRevenueAll = Number(revAll.totalRevenue || 0) || 0;
    const conversionValueUsed = Number(revAll.conversionValue || 0) || 0;

    const computeRevenueForConversions = (conv: number): number => {
      const c = Number(conv || 0) || 0;
      if (!hasRevenueTracking) return 0;
      if (totalRevenueAll > 0 && totalConversionsOverall > 0) return totalRevenueAll * (c / totalConversionsOverall);
      if (conversionValueUsed > 0) return c * conversionValueUsed;
      return 0;
    };

    const totalRevenue = Number(Number(computeRevenueForConversions(conversions)).toFixed(2));
    
    // Set revenue metrics if we have a value
    if (totalRevenue > 0) {
      aggregated.totalRevenue = parseFloat(totalRevenue.toFixed(2));
      aggregated.revenue = aggregated.totalRevenue;
      aggregated.conversionValue = conversionValueUsed;
      
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

function mapKPIMetricToInstagramKey(kpiMetric: string): string {
  const normalized = String(kpiMetric || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const metricMap: Record<string, string> = {
    impressions: "impressions",
    clicks: "clicks",
    spend: "spend",
    conversions: "conversions",
    videoviews: "videoViews",
    ctr: "ctr",
    cpc: "cpc",
    cpm: "cpm",
    cpa: "costPerConversion",
    costperconversion: "costPerConversion",
    conversionrate: "conversionRate",
    cvr: "conversionRate",
    totalrevenue: "totalRevenue",
    revenue: "totalRevenue",
    roas: "roas",
    roi: "roi",
    profit: "profit",
  };
  return metricMap[normalized] || normalized;
}

function mapKPIMetricToTikTokKey(kpiMetric: string): string {
  const normalized = String(kpiMetric || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const metricMap: Record<string, string> = {
    impressions: "impressions",
    clicks: "clicks",
    spend: "spend",
    conversions: "conversions",
    videoviews: "videoViews",
    engagements: "engagements",
    ctr: "ctr",
    cpc: "cpc",
    cpm: "cpm",
    cpa: "costPerConversion",
    costperconversion: "costPerConversion",
    conversionrate: "conversionRate",
    cvr: "conversionRate",
    totalrevenue: "totalRevenue",
    revenue: "totalRevenue",
    roas: "roas",
    roi: "roi",
    profit: "profit",
  };
  return metricMap[normalized] || normalized;
}

async function getInstagramMetricsForTarget(campaignId: string, target: KPI | Benchmark): Promise<Record<string, number> | null> {
  const connection = await storage.getInstagramConnection(campaignId).catch(() => null);
  if (!connection || (connection as any).spendOnly) return null;

  const selectedCampaignIds = (() => {
    try {
      const parsed = JSON.parse(String((connection as any).selectedCampaignIds || "[]"));
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  })();
  if (selectedCampaignIds.length === 0) return null;

  const trackingPeriod = Math.max(1, Number((target as any).trackingPeriod || 30) || 30);
  const endDate = yesterdayUTC();
  const start = new Date(`${endDate}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (trackingPeriod - 1));
  const startDate = start.toISOString().slice(0, 10);
  const selectedSet = new Set(selectedCampaignIds);
  const specificId = String((target as any).applyTo || "") === "specific" ? String((target as any).specificCampaignId || "").trim() : "";
  if (specificId && !selectedSet.has(specificId)) return null;

  const rows = (await storage.getInstagramDailyMetrics(campaignId, startDate, endDate).catch(() => [] as any[]))
    .filter((row: any) => selectedSet.has(String(row?.instagramCampaignId || "")))
    .filter((row: any) => String(row?.publisherPlatform || "instagram").trim().toLowerCase() === "instagram")
    .filter((row: any) => !specificId || String(row?.instagramCampaignId || "") === specificId);
  if (rows.length === 0) return null;

  const totals = rows.reduce((sum: any, row: any) => {
    sum.impressions += Number(row?.impressions || 0);
    sum.clicks += Number(row?.clicks || 0);
    sum.spend += Number(row?.spend || 0);
    sum.conversions += Number(row?.conversions || 0);
    sum.videoViews += Number(row?.videoViews || 0);
    return sum;
  }, { impressions: 0, clicks: 0, spend: 0, conversions: 0, videoViews: 0 });

  const metrics: Record<string, number> = {
    impressions: totals.impressions,
    clicks: totals.clicks,
    spend: parseFloat(totals.spend.toFixed(2)),
    conversions: totals.conversions,
    videoViews: totals.videoViews,
    ctr: totals.impressions > 0 ? parseFloat(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0,
    cpc: totals.clicks > 0 ? parseFloat((totals.spend / totals.clicks).toFixed(2)) : 0,
    cpm: totals.impressions > 0 ? parseFloat(((totals.spend / totals.impressions) * 1000).toFixed(2)) : 0,
    costPerConversion: totals.conversions > 0 ? parseFloat((totals.spend / totals.conversions).toFixed(2)) : 0,
    conversionRate: totals.clicks > 0 ? parseFloat(((totals.conversions / totals.clicks) * 100).toFixed(2)) : 0,
  };
  const revenue = await storage.getRevenueTotalForRange(campaignId, startDate, endDate, "instagram").catch(() => null);
  const totalRevenue = Number((revenue as any)?.totalRevenue || 0);
  const sourceIds = Array.isArray((revenue as any)?.sourceIds) ? (revenue as any).sourceIds : [];
  if (sourceIds.length > 0) {
    metrics.totalRevenue = parseFloat(totalRevenue.toFixed(2));
    metrics.revenue = metrics.totalRevenue;
    metrics.profit = parseFloat((totalRevenue - totals.spend).toFixed(2));
    metrics.roas = totals.spend > 0 ? parseFloat((totalRevenue / totals.spend).toFixed(2)) : 0;
    metrics.roi = totals.spend > 0 ? parseFloat((((totalRevenue - totals.spend) / totals.spend) * 100).toFixed(2)) : 0;
  }
  return metrics;
}

async function getTikTokMetricsForTarget(campaignId: string, target: KPI | Benchmark): Promise<Record<string, number> | null> {
  const connection = await storage.getTikTokConnection(campaignId).catch(() => null);
  if (!connection || (connection as any).spendOnly) return null;

  const selectedCampaignIds = (() => {
    try {
      const parsed = JSON.parse(String((connection as any).selectedCampaignIds || "[]"));
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  })();
  if (selectedCampaignIds.length === 0) return null;

  const trackingPeriod = Math.max(1, Number((target as any).trackingPeriod || 30) || 30);
  const endDate = yesterdayUTC();
  const start = new Date(`${endDate}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (trackingPeriod - 1));
  const startDate = start.toISOString().slice(0, 10);
  const selectedSet = new Set(selectedCampaignIds);
  const specificId = String((target as any).applyTo || "") === "specific" ? String((target as any).specificCampaignId || "").trim() : "";
  if (specificId && !selectedSet.has(specificId)) return null;

  const rows = (await storage.getTikTokDailyMetrics(campaignId, startDate, endDate).catch(() => [] as any[]))
    .filter((row: any) => selectedSet.has(String(row?.tiktokCampaignId || "")))
    .filter((row: any) => !specificId || String(row?.tiktokCampaignId || "") === specificId);
  if (rows.length === 0) return null;

  const totals = rows.reduce((sum: any, row: any) => {
    sum.impressions += Number(row?.impressions || 0);
    sum.clicks += Number(row?.clicks || 0);
    sum.spend += Number(row?.spend || 0);
    sum.conversions += Number(row?.conversions || 0);
    sum.videoViews += Number(row?.videoViews || 0);
    sum.engagements += Number(row?.engagements || 0);
    return sum;
  }, { impressions: 0, clicks: 0, spend: 0, conversions: 0, videoViews: 0, engagements: 0 });

  const metrics: Record<string, number> = {
    impressions: totals.impressions,
    clicks: totals.clicks,
    spend: parseFloat(totals.spend.toFixed(2)),
    conversions: totals.conversions,
    videoViews: totals.videoViews,
    engagements: totals.engagements,
    ctr: totals.impressions > 0 ? parseFloat(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0,
    cpc: totals.clicks > 0 ? parseFloat((totals.spend / totals.clicks).toFixed(2)) : 0,
    cpm: totals.impressions > 0 ? parseFloat(((totals.spend / totals.impressions) * 1000).toFixed(2)) : 0,
    costPerConversion: totals.conversions > 0 ? parseFloat((totals.spend / totals.conversions).toFixed(2)) : 0,
    conversionRate: totals.clicks > 0 ? parseFloat(((totals.conversions / totals.clicks) * 100).toFixed(2)) : 0,
  };

  if (!specificId) {
    const revenue = await storage.getRevenueTotalForRange(campaignId, startDate, endDate, "tiktok").catch(() => null);
    const totalRevenue = Number((revenue as any)?.totalRevenue || 0);
    const sourceIds = Array.isArray((revenue as any)?.sourceIds) ? (revenue as any).sourceIds : [];
    if (sourceIds.length > 0 && totalRevenue > 0) {
      metrics.totalRevenue = parseFloat(totalRevenue.toFixed(2));
      metrics.revenue = metrics.totalRevenue;
      metrics.profit = parseFloat((totalRevenue - totals.spend).toFixed(2));
      metrics.roas = totals.spend > 0 ? parseFloat((totalRevenue / totals.spend).toFixed(2)) : 0;
      metrics.roi = totals.spend > 0 ? parseFloat((((totalRevenue - totals.spend) / totals.spend) * 100).toFixed(2)) : 0;
    }
  }

  return metrics;
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

function calculateInstagramKPIValue(kpi: KPI, metrics: Record<string, number>): string | null {
  if (!kpi.metric) return null;
  const metricKey = mapKPIMetricToInstagramKey(kpi.metric);
  const value = metrics[metricKey];
  if (value === undefined || value === null) return null;
  return (kpi.unit === "%" || kpi.unit === "$" || kpi.unit === "x") ? Number(value).toFixed(2) : String(value);
}

function calculateTikTokKPIValue(kpi: KPI, metrics: Record<string, number>): string | null {
  if (!kpi.metric) return null;
  const metricKey = mapKPIMetricToTikTokKey(kpi.metric);
  const value = metrics[metricKey];
  if (value === undefined || value === null) return null;
  return (kpi.unit === "%" || kpi.unit === "$" || kpi.unit === "x") ? Number(value).toFixed(2) : String(value);
}

export async function refreshInstagramKPIsForCampaign(campaignId: string): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;
  try {
    const kpis = await storage.getPlatformKPIs("instagram", campaignId);
    for (const kpi of Array.isArray(kpis) ? kpis : []) {
      const metrics = await getInstagramMetricsForTarget(campaignId, kpi);
      if (!metrics) continue;
      const newCurrentValue = calculateInstagramKPIValue(kpi, metrics);
      if (newCurrentValue === null) {
        errors++;
        continue;
      }
      if (kpi.currentValue !== newCurrentValue) {
        await storage.updateKPI(kpi.id, { currentValue: newCurrentValue });
        updated++;
      }
    }
  } catch (error) {
    console.error(`[KPI Refresh] Error refreshing Instagram KPIs for campaign ${campaignId}:`, error);
    return { updated, errors: errors + 1 };
  }
  return { updated, errors };
}

export async function refreshTikTokKPIsForCampaign(campaignId: string): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;
  try {
    const kpis = await storage.getPlatformKPIs("tiktok", campaignId);
    for (const kpi of Array.isArray(kpis) ? kpis : []) {
      const metrics = await getTikTokMetricsForTarget(campaignId, kpi);
      if (!metrics) continue;
      const newCurrentValue = calculateTikTokKPIValue(kpi, metrics);
      if (newCurrentValue === null) {
        errors++;
        continue;
      }
      if (kpi.currentValue !== newCurrentValue) {
        await storage.updateKPI(kpi.id, { currentValue: newCurrentValue });
        updated++;
      }
    }
  } catch (error) {
    console.error(`[KPI Refresh] Error refreshing TikTok KPIs for campaign ${campaignId}:`, error);
    return { updated, errors: errors + 1 };
  }
  return { updated, errors };
}

export async function refreshInstagramBenchmarksForCampaign(campaignId: string): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;
  try {
    const benchmarks = await storage.getPlatformBenchmarks("instagram", campaignId);
    for (const benchmark of Array.isArray(benchmarks) ? benchmarks : []) {
      const metrics = await getInstagramMetricsForTarget(campaignId, benchmark);
      if (!metrics) continue;
      const metricKey = mapKPIMetricToInstagramKey(String((benchmark as any).metric || ""));
      const value = metrics[metricKey];
      if (value === undefined || value === null) {
        errors++;
        continue;
      }
      const currentValue = String(value);
      const benchmarkValue = parseFloat(String((benchmark as any).benchmarkValue ?? "0")) || 0;
      const variance = benchmarkValue > 0
        ? (((Number(value) || 0) - benchmarkValue) / benchmarkValue) * 100
        : 0;
      if (String((benchmark as any).currentValue ?? "") !== currentValue || String((benchmark as any).variance ?? "") !== String(variance)) {
        await storage.updateBenchmark(String((benchmark as any).id), {
          currentValue,
          variance: String(variance),
        } as any);
        updated++;
      }
    }
  } catch (error) {
    console.error(`[KPI Refresh] Error refreshing Instagram Benchmarks for campaign ${campaignId}:`, error);
    return { updated, errors: errors + 1 };
  }
  return { updated, errors };
}

export async function refreshTikTokBenchmarksForCampaign(campaignId: string): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;
  try {
    const benchmarks = await storage.getPlatformBenchmarks("tiktok", campaignId);
    for (const benchmark of Array.isArray(benchmarks) ? benchmarks : []) {
      const metrics = await getTikTokMetricsForTarget(campaignId, benchmark);
      if (!metrics) continue;
      const metricKey = mapKPIMetricToTikTokKey(String((benchmark as any).metric || ""));
      const value = metrics[metricKey];
      if (value === undefined || value === null) {
        errors++;
        continue;
      }
      const currentValue = String(value);
      const benchmarkValue = parseFloat(String((benchmark as any).benchmarkValue ?? "0")) || 0;
      const variance = benchmarkValue > 0
        ? (((Number(value) || 0) - benchmarkValue) / benchmarkValue) * 100
        : 0;
      if (String((benchmark as any).currentValue ?? "") !== currentValue || String((benchmark as any).variance ?? "") !== String(variance)) {
        await storage.updateBenchmark(String((benchmark as any).id), {
          currentValue,
          variance: String(variance),
        } as any);
        updated++;
      }
    }
  } catch (error) {
    console.error(`[KPI Refresh] Error refreshing TikTok Benchmarks for campaign ${campaignId}:`, error);
    return { updated, errors: errors + 1 };
  }
  return { updated, errors };
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
            continue;
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
