/**
 * LinkedIn Data Refresh Scheduler
 * Automatically refreshes LinkedIn metrics for all campaigns with LinkedIn connections
 * Supports both test mode and production mode
 */

import { storage } from "./storage";
import { refreshKPIsForCampaign } from "./utils/kpi-refresh";
import { checkPerformanceAlerts } from "./kpi-scheduler";
import { checkBenchmarkPerformanceAlerts } from "./benchmark-notifications";
import { db } from "./db";
import { linkedinConnections, linkedinDailyMetrics } from "../shared/schema";
import { desc, eq } from "drizzle-orm";

const isLinkedInCountMetric = (metricKey: string): boolean => {
  const k = String(metricKey || "").toLowerCase();
  return [
    "impressions",
    "clicks",
    "conversions",
    "externalwebsiteconversions",
    "leads",
    "engagements",
    "reach",
    "videoviews",
    "viralImpressions".toLowerCase(),
    "likes",
    "comments",
    "shares",
  ].includes(k);
};

const normalizeLinkedInMetricValue = (metricKey: string, value: any): string => {
  const k = String(metricKey || "").toLowerCase();
  if (k === "spend") {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }
  if (isLinkedInCountMetric(k)) {
    const n = Number(value);
    return Number.isFinite(n) ? String(Math.round(n)) : "0";
  }
  // default: numeric metric (rare for import keys); keep 2 decimals for stability
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "0";
};

/**
 * Generate mock LinkedIn data for test mode
 * Reuses the same logic as the import endpoint
 */
async function generateMockLinkedInData(
  campaignId: string,
  connection: any,
  opts?: { advanceDay?: boolean }
): Promise<void> {
  console.log(`[LinkedIn Scheduler] TEST MODE: Generating mock data for campaign ${campaignId}`);

  // Get the latest import session to reuse selected campaigns and metrics
  const latestSession = await storage.getLatestLinkedInImportSession(campaignId);
  if (!latestSession) {
    console.log(`[LinkedIn Scheduler] No previous import sessions found for test mode campaign ${campaignId}`);
    return;
  }

  // --- Test-mode truth model ---
  // "To-date" numbers should be cumulative sums of daily facts.
  // Ad Comparison should sum to the same to-date totals as Overview.
  //
  // So for each refresh:
  // 1) add exactly one daily row
  // 2) compute cumulative totals from daily rows
  // 3) create a new import session whose campaign totals and ad totals reconcile to those cumulative totals

  // Persist mock daily facts incrementally so test mode simulates a real "days go by" journey.
  let toDate: any = null;
  let endUTC: Date | null = null;
  let baseStartIso = "";
  let endIso = "";
  try {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    endUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)); // yesterday UTC

    // Determine the next "new day" to add.
    // We start from a base window (60 days back) but we do NOT backfill — we add one day per refresh.
    //
    // IMPORTANT: When `opts.advanceDay` is true (manual "Run refresh" in test mode), we intentionally
    // advance the simulated date even beyond real-world "yesterday" so each click == one simulated day.
    const advanceDay = Boolean(opts?.advanceDay);

    let maxExistingDate = "";
    try {
      if (db) {
        const rows = await db
          .select({ date: linkedinDailyMetrics.date })
          .from(linkedinDailyMetrics)
          .where(eq(linkedinDailyMetrics.campaignId, campaignId))
          .orderBy(desc(linkedinDailyMetrics.date))
          .limit(1);
        maxExistingDate = String((rows as any[])?.[0]?.date || "");
      } else {
        const existingAll = await storage.getLinkedInDailyMetrics(campaignId, "0000-01-01", "9999-12-31").catch(() => []);
        maxExistingDate =
          Array.isArray(existingAll) && existingAll.length > 0 ? String((existingAll as any[])[(existingAll as any[]).length - 1]?.date || "") : "";
      }
    } catch {
      // ignore; fall back to the base window logic below
    }

    // Base window start is always "endUTC - 59", but we may extend endUTC for advanceDay.
    const baseStartForYesterdayUTC = new Date(endUTC.getTime());
    baseStartForYesterdayUTC.setUTCDate(baseStartForYesterdayUTC.getUTCDate() - 59);

    let nextUTC: Date;
    if (!maxExistingDate) {
      nextUTC = baseStartForYesterdayUTC;
    } else {
      const parsed = new Date(`${maxExistingDate}T00:00:00.000Z`);
      nextUTC = new Date(parsed.getTime());
      nextUTC.setUTCDate(nextUTC.getUTCDate() + 1);
    }

    if (!advanceDay) {
      // Cap at yesterday UTC; if we’re already at/after yesterday, just overwrite yesterday (simulate re-import corrections).
      if (nextUTC.getTime() > endUTC.getTime()) {
        nextUTC = endUTC;
      }
    } else {
      // In manual test-mode refresh: treat each click as a new simulated day.
      if (nextUTC.getTime() > endUTC.getTime()) {
        endUTC = new Date(nextUTC.getTime());
      }
    }

    // Recompute window strings AFTER potentially extending endUTC.
    const baseStartUTC = new Date(endUTC.getTime());
    baseStartUTC.setUTCDate(baseStartUTC.getUTCDate() - 59);
    baseStartIso = iso(baseStartUTC);
    endIso = iso(endUTC);

    const date = iso(nextUTC);

    // Generate a single day's totals (lightweight; avoids big arrays/large writes).
    const impressions = Math.max(1000, 20000 + Math.floor(Math.random() * 8000));
    const clicks = Math.max(1, Math.floor(impressions * (0.008 + Math.random() * 0.01)));
    const conversions = Math.max(0, Math.floor(clicks * (0.01 + Math.random() * 0.03)));
    const spend = Math.max(10, 300 + Math.random() * 700);

    const row = {
      campaignId,
      date,
      impressions,
      clicks,
      reach: Math.max(0, Math.floor(impressions * (0.6 + Math.random() * 0.2))),
      engagements: Math.max(0, Math.floor(clicks + impressions * (0.002 + Math.random() * 0.004))),
      conversions,
      leads: Math.max(0, Math.floor(conversions * (0.4 + Math.random() * 0.4))),
      spend: spend.toFixed(2),
      videoViews: Math.max(0, Math.floor(impressions * (0.01 + Math.random() * 0.02))),
      viralImpressions: Math.max(0, Math.floor(impressions * (0.05 + Math.random() * 0.1))),
    };

    await storage.upsertLinkedInDailyMetrics([row] as any);
    console.log(`[LinkedIn Scheduler] ✅ Mock daily metrics upserted: 1 day (${date}) for campaign ${campaignId}`);

    // Persist canonical last refresh timestamp for coverage UI.
    try {
      await storage.updateLinkedInConnection(campaignId, { lastRefreshAt: new Date() } as any);
    } catch {
      // ignore
    }

    const dailyToDate = await storage.getLinkedInDailyMetrics(campaignId, baseStartIso, endIso).catch(() => []);
    const sums = (Array.isArray(dailyToDate) ? (dailyToDate as any[]) : []).reduce(
      (acc: any, r: any) => {
        acc.impressions += Number(r?.impressions || 0) || 0;
        acc.clicks += Number(r?.clicks || 0) || 0;
        acc.reach += Number(r?.reach || 0) || 0;
        acc.engagements += Number(r?.engagements || 0) || 0;
        acc.conversions += Number(r?.conversions || 0) || 0;
        acc.leads += Number(r?.leads || 0) || 0;
        acc.videoViews += Number(r?.videoViews || r?.video_views || 0) || 0;
        acc.viralImpressions += Number(r?.viralImpressions || r?.viral_impressions || 0) || 0;
        acc.spend += Number(parseFloat(String(r?.spend ?? "0"))) || 0;
        return acc;
      },
      { impressions: 0, clicks: 0, reach: 0, engagements: 0, conversions: 0, leads: 0, spend: 0, videoViews: 0, viralImpressions: 0 }
    );
    toDate = {
      impressions: Math.round(Number(sums.impressions || 0)),
      clicks: Math.round(Number(sums.clicks || 0)),
      reach: Math.round(Number(sums.reach || 0)),
      engagements: Math.round(Number(sums.engagements || 0)),
      conversions: Math.round(Number(sums.conversions || 0)),
      leads: Math.round(Number(sums.leads || 0)),
      videoViews: Math.round(Number(sums.videoViews || 0)),
      viralImpressions: Math.round(Number(sums.viralImpressions || 0)),
      spend: Number(Number(sums.spend || 0).toFixed(2)),
    };
  } catch (e: any) {
    console.warn(`[LinkedIn Scheduler] Mock daily metrics upsert failed for ${campaignId}:`, e?.message || e);
  }

  // Create a new import session with the same configuration
  const newSession = await storage.createLinkedInImportSession({
    campaignId,
    adAccountId: connection.adAccountId,
    adAccountName: connection.adAccountName || '',
    selectedCampaignsCount: latestSession.selectedCampaignsCount || 1,
    selectedMetricsCount: latestSession.selectedMetricsCount || 0,
    selectedMetricKeys: latestSession.selectedMetricKeys || [],
    conversionValue: latestSession.conversionValue
  });

  const selectedMetricKeys = latestSession.selectedMetricKeys || [];
  const totals = toDate || { impressions: 0, clicks: 0, reach: 0, engagements: 0, conversions: 0, leads: 0, spend: 0, videoViews: 0, viralImpressions: 0 };

  // Preserve campaign structure from the previous import so Campaign Breakdown is stable (no duplicate/partial cards).
  const prevMetrics = await storage.getLinkedInImportMetrics(latestSession.id).catch(() => []);
  const prevCampaigns = Array.isArray(prevMetrics)
    ? Array.from(
        prevMetrics.reduce((acc: Map<string, any>, m: any) => {
          const urn = String(m?.campaignUrn || "").trim();
          if (!urn) return acc;
          if (!acc.has(urn)) {
            acc.set(urn, {
              urn,
              name: String(m?.campaignName || "Test Campaign"),
              status: String(m?.campaignStatus || "active"),
            });
          }
          return acc;
        }, new Map()).values()
      )
    : [];

  const campaigns =
    prevCampaigns.length > 0
      ? prevCampaigns
      : [{ urn: `test-campaign-${campaignId}`, name: "Test Campaign", status: "active" }];

  const splitNumber = (total: number, n: number, decimals = 0) => {
    const parts: number[] = [];
    if (n <= 0) return parts;
    const factor = Math.pow(10, decimals);
    const totalRounded = Math.round(total * factor) / factor;
    const base = Math.floor((totalRounded / n) * factor) / factor;
    let used = 0;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? Math.round((totalRounded - used) * factor) / factor : base;
      parts.push(v);
      used = Math.round((used + v) * factor) / factor;
    }
    return parts;
  };

  // Split to-date totals across campaigns so sums still reconcile.
  const campaignCount = campaigns.length;
  const spendParts = splitNumber(Number((totals as any).spend || 0), campaignCount, 2);
  const impressionsParts = splitNumber(Number((totals as any).impressions || 0), campaignCount, 0);
  const clicksParts = splitNumber(Number((totals as any).clicks || 0), campaignCount, 0);
  const engagementsParts = splitNumber(Number((totals as any).engagements || 0), campaignCount, 0);
  const reachParts = splitNumber(Number((totals as any).reach || 0), campaignCount, 0);
  const conversionsParts = splitNumber(Number((totals as any).conversions || 0), campaignCount, 0);
  const leadsParts = splitNumber(Number((totals as any).leads || 0), campaignCount, 0);
  const videoViewsParts = splitNumber(Number((totals as any).videoViews || 0), campaignCount, 0);
  const viralImpressionsParts = splitNumber(Number((totals as any).viralImpressions || 0), campaignCount, 0);

  for (let cIdx = 0; cIdx < campaigns.length; cIdx++) {
    const c = campaigns[cIdx];
    const byKey: Record<string, any> = {
      impressions: impressionsParts[cIdx] ?? 0,
      reach: reachParts[cIdx] ?? 0,
      clicks: clicksParts[cIdx] ?? 0,
      engagements: engagementsParts[cIdx] ?? 0,
      spend: spendParts[cIdx] ?? 0,
      conversions: conversionsParts[cIdx] ?? 0,
      leads: leadsParts[cIdx] ?? 0,
      videoViews: videoViewsParts[cIdx] ?? 0,
      viralImpressions: viralImpressionsParts[cIdx] ?? 0,
    };

    // Store per-campaign totals for this session (to-date semantics).
    for (const metricKey of selectedMetricKeys) {
      const raw = byKey[String(metricKey)] ?? 0;
      const metricValue = normalizeLinkedInMetricValue(metricKey, raw);
      await storage.createLinkedInImportMetric({
        sessionId: newSession.id,
        campaignUrn: c.urn,
        campaignName: c.name,
        campaignStatus: c.status,
        metricKey,
        metricValue,
      });
    }

    // Generate ad performance that sums back to the same per-campaign totals (especially spend).
    const numAds = Math.floor(Math.random() * 2) + 2;
    const adSpendParts = splitNumber(Number(byKey.spend || 0), numAds, 2);
    const adImpressionsParts = splitNumber(Number(byKey.impressions || 0), numAds, 0);
    const adClicksParts = splitNumber(Number(byKey.clicks || 0), numAds, 0);
    const adEngagementsParts = splitNumber(Number(byKey.engagements || 0), numAds, 0);
    const adReachParts = splitNumber(Number(byKey.reach || 0), numAds, 0);
    const adConversionsParts = splitNumber(Number(byKey.conversions || 0), numAds, 0);
    const adLeadsParts = splitNumber(Number(byKey.leads || 0), numAds, 0);
    const adVideoViewsParts = splitNumber(Number(byKey.videoViews || 0), numAds, 0);
    const adViralImpressionsParts = splitNumber(Number(byKey.viralImpressions || 0), numAds, 0);

    for (let i = 0; i < numAds; i++) {
      const adData: any = {
        sessionId: newSession.id,
        adId: `ad-${newSession.id}-${c.urn}-${i + 1}`,
        adName: `Ad ${i + 1} - ${c.name}`,
        campaignUrn: c.urn,
        campaignName: c.name,
        campaignSelectedMetrics: selectedMetricKeys,
        impressions: Math.round(adImpressionsParts[i] ?? 0),
        reach: Math.round(adReachParts[i] ?? 0),
        clicks: Math.round(adClicksParts[i] ?? 0),
        engagements: Math.round(adEngagementsParts[i] ?? 0),
        spend: Number(adSpendParts[i] ?? 0).toFixed(2),
        conversions: Math.round(adConversionsParts[i] ?? 0),
        leads: Math.round(adLeadsParts[i] ?? 0),
        videoViews: Math.round(adVideoViewsParts[i] ?? 0),
        viralImpressions: Math.round(adViralImpressionsParts[i] ?? 0),
        revenue: "0",
        ctr: "0",
        cpc: "0",
        cpm: "0",
        cvr: "0",
        cpa: "0",
        cpl: "0",
        er: "0",
        conversionRate: "0",
      };

      const spend = parseFloat(adData.spend);
      if (adData.impressions > 0) {
        adData.ctr = ((adData.clicks / adData.impressions) * 100).toFixed(2);
        adData.cpm = ((spend / adData.impressions) * 1000).toFixed(2);
        adData.er = ((adData.engagements / adData.impressions) * 100).toFixed(2);
      }
      if (adData.clicks > 0) {
        adData.cpc = (spend / adData.clicks).toFixed(2);
        adData.cvr = ((adData.conversions / adData.clicks) * 100).toFixed(2);
        adData.conversionRate = adData.cvr;
      }
      if (adData.conversions > 0) {
        adData.cpa = (spend / adData.conversions).toFixed(2);
      }
      if (adData.leads > 0) {
        adData.cpl = (spend / adData.leads).toFixed(2);
      }

      await storage.createLinkedInAdPerformance(adData);
    }
  }

  console.log(`[LinkedIn Scheduler] ✅ Mock session totals + ads now reconcile to daily to-date for campaign ${campaignId}`);
}

/**
 * Fetch real LinkedIn data from API
 * Reuses the same logic as the manual import endpoint
 */
async function fetchRealLinkedInData(
  campaignId: string,
  connection: any
): Promise<void> {
  console.log(`[LinkedIn Scheduler] PRODUCTION MODE: Fetching real data for campaign ${campaignId}`);

  if (!connection.accessToken) {
    console.error(`[LinkedIn Scheduler] No access token found for campaign ${campaignId}`);
    return;
  }

  try {
    // Get the latest import session to know which campaigns and metrics were selected
    const latestSession = await storage.getLatestLinkedInImportSession(campaignId);
    if (!latestSession) {
      console.log(`[LinkedIn Scheduler] No previous import sessions found for campaign ${campaignId} - skipping scheduled refresh`);
      return;
    }

    // Get the campaigns that were previously imported
    const previousMetrics = await storage.getLinkedInImportMetrics(latestSession.id);
    const previousCampaigns = Array.from(new Set(previousMetrics.map((m: any) => ({
      id: m.campaignUrn,
      name: m.campaignName,
      status: m.campaignStatus,
      selectedMetrics: latestSession.selectedMetricKeys || []
    }))));

    if (previousCampaigns.length === 0) {
      console.log(`[LinkedIn Scheduler] No previous campaigns found for campaign ${campaignId}`);
      return;
    }

    // Import LinkedIn client
    const { LinkedInClient } = await import('./linkedinClient');
    const linkedInClient = new LinkedInClient(connection.accessToken);

    // Get all campaigns from LinkedIn to match with previous imports
    const allLinkedInCampaigns = await linkedInClient.getCampaigns(connection.adAccountId);
    
    if (!allLinkedInCampaigns || allLinkedInCampaigns.length === 0) {
      console.log(`[LinkedIn Scheduler] No campaigns found for ad account ${connection.adAccountId}`);
      return;
    }

    // Match previous campaigns with current LinkedIn campaigns
    const campaignsToRefresh = previousCampaigns.map(prevCampaign => {
      const linkedInCampaign = allLinkedInCampaigns.find((c: any) => 
        c.id === prevCampaign.id || c.id.includes(prevCampaign.id) || prevCampaign.id.includes(c.id)
      );
      return linkedInCampaign ? {
        id: linkedInCampaign.id,
        name: linkedInCampaign.name || prevCampaign.name,
        status: linkedInCampaign.status || prevCampaign.status,
        selectedMetrics: prevCampaign.selectedMetrics
      } : null;
    }).filter(Boolean) as any[];

    if (campaignsToRefresh.length === 0) {
      console.log(`[LinkedIn Scheduler] No matching campaigns found for campaign ${campaignId}`);
      return;
    }

    // Finance-grade correctness:
    // Use the same window everywhere (imports, KPIs, revenue rollups) to avoid mixing
    // "lifetime revenue" with "last-30d conversions/spend".
    //
    // Window = last 30 *complete* UTC days (end = yesterday UTC) to avoid partial-today volatility.
    const now = new Date();
    const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const startDate = new Date(endDate.getTime());
    startDate.setUTCDate(startDate.getUTCDate() - 29);

    // Daily facts for Insights anomaly detection (90d lookback, complete UTC days)
    const dailyEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const dailyStart = new Date(dailyEnd.getTime());
    dailyStart.setUTCDate(dailyStart.getUTCDate() - 89);

    const campaignIds = campaignsToRefresh.map(c => c.id);

    // Fetch campaign analytics
    const campaignAnalytics = await linkedInClient.getCampaignAnalytics(
      campaignIds,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Fetch DAILY campaign analytics and persist into linkedin_daily_metrics (rolled up per MetricMind campaign per day)
    try {
      const dailyElements = await (linkedInClient as any).getCampaignAnalyticsDaily?.(
        campaignIds,
        dailyStart.toISOString().split('T')[0],
        dailyEnd.toISOString().split('T')[0]
      );
      const { upsertLinkedInDailyTotals } = await import("./linkedin-daily-metrics");
      await upsertLinkedInDailyTotals({ campaignId, dailyElements: Array.isArray(dailyElements) ? dailyElements : [] });
    } catch (e: any) {
      console.warn(`[LinkedIn Scheduler] Daily metrics upsert failed for ${campaignId}:`, e?.message || e);
    }

    // Fetch creatives (ads) for each campaign
    const creatives = await linkedInClient.getCreatives(campaignIds);

    // Fetch creative analytics
    const creativeAnalytics = await linkedInClient.getCreativeAnalytics(
      campaignIds,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Count selected metrics
    const selectedMetricsCount = campaignsToRefresh.reduce((sum, c) => 
      sum + (c.selectedMetrics?.length || 0), 0
    );

    // Create new import session
    const session = await storage.createLinkedInImportSession({
      campaignId,
      adAccountId: connection.adAccountId,
      adAccountName: connection.adAccountName || '',
      selectedCampaignsCount: campaignsToRefresh.length,
      selectedMetricsCount,
      selectedMetricKeys: latestSession.selectedMetricKeys || [],
      conversionValue: latestSession.conversionValue
    });

    // Store campaign metrics (same logic as manual import)
    for (const campaign of campaignsToRefresh) {
      if (!campaign.selectedMetrics || !Array.isArray(campaign.selectedMetrics) || campaign.selectedMetrics.length === 0) {
        continue;
      }

      const campAnalytics = campaignAnalytics.find((a: any) => 
        a.pivotValues?.includes(campaign.id) || 
        a.pivotValues?.some((pv: string) => pv.includes(campaign.id) || campaign.id.includes(pv))
      ) || {};

      // Filter out calculated metrics (CTR, CPC, CPM) - these should only be calculated, not imported
      const coreMetrics = campaign.selectedMetrics.filter((m: string) => 
        !['ctr', 'cpc', 'cpm'].includes(m.toLowerCase())
      );

      for (const metricKey of coreMetrics) {
        let rawValue: any = 0;
        
        switch (metricKey.toLowerCase()) {
          case 'impressions':
            rawValue = campAnalytics.impressions || 0;
            break;
          case 'clicks':
            rawValue = campAnalytics.clicks || 0;
            break;
          case 'spend':
            rawValue = campAnalytics.costInLocalCurrency || 0;
            break;
          case 'conversions':
            rawValue = campAnalytics.externalWebsiteConversions || 0;
            break;
          case 'leads':
            rawValue = campAnalytics.leadGenerationMailContactInfoShares || campAnalytics.leadGenerationMailInterestedClicks || 0;
            break;
          case 'likes':
            rawValue = campAnalytics.likes || campAnalytics.reactions || 0;
            break;
          case 'comments':
            rawValue = campAnalytics.comments || 0;
            break;
          case 'shares':
            rawValue = campAnalytics.shares || 0;
            break;
          case 'totalengagements':
          case 'engagements':
            const engagements = (campAnalytics.likes || 0) + (campAnalytics.comments || 0) + (campAnalytics.shares || 0) + (campAnalytics.clicks || 0);
            rawValue = engagements;
            break;
          case 'reach':
            rawValue = campAnalytics.approximateUniqueImpressions || campAnalytics.impressions || 0;
            break;
          case 'videoviews':
          case 'videoViews':
            rawValue = campAnalytics.videoViews || campAnalytics.videoStarts || 0;
            break;
          case 'viralimpressions':
          case 'viralImpressions':
            rawValue = campAnalytics.viralImpressions || 0;
            break;
        }

        const metricValue = normalizeLinkedInMetricValue(metricKey, rawValue);
        
        await storage.createLinkedInImportMetric({
          sessionId: session.id,
          campaignUrn: campaign.id,
          campaignName: campaign.name,
          campaignStatus: campaign.status || "active",
          metricKey,
          metricValue
        });
      }

      // Store ad/creative performance
      const campaignCreatives = creatives.filter((c: any) => 
        c.campaignId === campaign.id || 
        (c.campaign && (c.campaign.id === campaign.id || c.campaign.includes(campaign.id)))
      );
      
      for (const creative of campaignCreatives) {
        const creativeStats = creativeAnalytics.find((a: any) => 
          a.pivotValues?.includes(creative.id) ||
          a.pivotValues?.some((pv: string) => pv.includes(creative.id) || creative.id.includes(pv))
        ) || {};
        
        const impressions = creativeStats.impressions || 0;
        const clicks = creativeStats.clicks || 0;
        const spend = String(creativeStats.costInLocalCurrency || 0);
        const conversions = creativeStats.externalWebsiteConversions || 0;
        
        // Calculate conversion value if available
        const conversionValue = latestSession.conversionValue ? parseFloat(latestSession.conversionValue) : 150;
        const revenue = String(conversions * conversionValue);
        
        const ctr = impressions > 0 ? String((clicks / impressions) * 100) : '0';
        const cpc = clicks > 0 ? String(parseFloat(spend) / clicks) : '0';
        const conversionRate = clicks > 0 ? String((conversions / clicks) * 100) : '0';
        
        await storage.createLinkedInAdPerformance({
          sessionId: session.id,
          adId: creative.id,
          adName: creative.name || `Creative ${creative.id}`,
          campaignUrn: campaign.id,
          campaignName: campaign.name,
          campaignSelectedMetrics: campaign.selectedMetrics || [],
          impressions,
          clicks,
          spend,
          conversions,
          revenue,
          ctr,
          cpc,
          conversionRate
        });
      }
    }

    console.log(`[LinkedIn Scheduler] ✅ Real data fetched and stored for campaign ${campaignId}`);

    // Persist canonical last refresh timestamp for coverage UI.
    try {
      await storage.updateLinkedInConnection(campaignId, { lastRefreshAt: new Date() } as any);
    } catch {
      // ignore
    }
  } catch (error: any) {
    console.error(`[LinkedIn Scheduler] Error fetching real LinkedIn data for campaign ${campaignId}:`, error);
    // Don't throw - log and continue with other campaigns
  }
}

/**
 * Refresh LinkedIn data for a single campaign
 */
export async function refreshLinkedInDataForCampaign(
  campaignId: string,
  connection?: any,
  opts?: { advanceTestDay?: boolean }
): Promise<void> {
  try {
    // Get connection if not provided
    if (!connection) {
      connection = await storage.getLinkedInConnection(campaignId);
    }
    
    if (!connection) {
      console.log(`[LinkedIn Scheduler] No LinkedIn connection found for campaign ${campaignId}`);
      return;
    }

    // Detect test mode (robust): explicit method, explicit env, or known test tokens.
    const method = String(connection.method || '').toLowerCase();
    const token = String(connection.accessToken || '');
    const isTestMode =
      method.includes('test') ||
      process.env.LINKEDIN_TEST_MODE === 'true' ||
      token === 'test-mode-token' ||
      token.startsWith('test_') ||
      token.startsWith('test-');

    if (isTestMode) {
      await generateMockLinkedInData(campaignId, connection, { advanceDay: Boolean(opts?.advanceTestDay) });
    } else {
      await fetchRealLinkedInData(campaignId, connection);
    }

    // After data refresh, refresh KPIs
    console.log(`[LinkedIn Scheduler] Refreshing KPIs for campaign ${campaignId}...`);
    await refreshKPIsForCampaign(campaignId);

    // Immediately check for alerts after KPI refresh
    console.log(`[LinkedIn Scheduler] Checking performance alerts for campaign ${campaignId}...`);
    await checkPerformanceAlerts();

    // Benchmark alerts are separate from KPI alerts; run them after refresh too.
    try {
      await checkBenchmarkPerformanceAlerts();
    } catch (e: any) {
      console.warn(`[LinkedIn Scheduler] Benchmark alert check failed for campaign ${campaignId}:`, e?.message || e);
    }

    console.log(`[LinkedIn Scheduler] ✅ Completed refresh for campaign ${campaignId}`);
  } catch (error: any) {
    console.error(`[LinkedIn Scheduler] Error refreshing campaign ${campaignId}:`, error);
    // Don't throw - continue with other campaigns
  }
}

/**
 * Refresh LinkedIn data for all campaigns with LinkedIn connections
 */
export async function refreshAllLinkedInData(): Promise<void> {
  console.log('[LinkedIn Scheduler] Starting scheduled LinkedIn data refresh...');

  try {
    // Get all LinkedIn connections from database
    const allConnections = await db.select({ campaignId: linkedinConnections.campaignId }).from(linkedinConnections);
    
    if (!allConnections || allConnections.length === 0) {
      console.log('[LinkedIn Scheduler] No LinkedIn connections found');
      return;
    }

    console.log(`[LinkedIn Scheduler] Found ${allConnections.length} LinkedIn connection(s) to refresh`);

    // Refresh data for each campaign
    for (const row of allConnections) {
      const campaignId = String((row as any).campaignId || "").trim();
      if (!campaignId) continue;
      // IMPORTANT: Fetch via storage so tokens are decrypted (and legacy plaintext can be backfilled).
      const connection = await storage.getLinkedInConnection(campaignId);
      await refreshLinkedInDataForCampaign(campaignId, connection);
    }
    
    console.log('[LinkedIn Scheduler] ✅ LinkedIn data refresh completed for all campaigns');
  } catch (error: any) {
    console.error('[LinkedIn Scheduler] Error in scheduled refresh:', error);
  }
}

/**
 * Start the LinkedIn scheduler
 * Runs every 4-6 hours (configurable via environment variable)
 */
export function startLinkedInScheduler(): void {
  console.log('[LinkedIn Scheduler] Starting LinkedIn data refresh scheduler...');

  // Get refresh interval from environment (default: 4 hours = 6x daily)
  // Enterprise recommendation: 4-6 hours (4 hours = 6x daily, 6 hours = 4x daily)
  const refreshIntervalHours = parseInt(process.env.LINKEDIN_REFRESH_INTERVAL_HOURS || '4', 10);
  const refreshIntervalMs = refreshIntervalHours * 60 * 60 * 1000;

  console.log(`[LinkedIn Scheduler] Refresh interval: ${refreshIntervalHours} hours (${24 / refreshIntervalHours}x daily)`);
  console.log(`[LinkedIn Scheduler] Next refresh: ${new Date(Date.now() + refreshIntervalMs).toLocaleString()}`);

  // Don't run immediately on startup - wait for first scheduled interval
  // This prevents unnecessary API calls on server restart

  // Schedule regular refreshes
  setInterval(() => {
    refreshAllLinkedInData();
  }, refreshIntervalMs);

  console.log('[LinkedIn Scheduler] ✅ LinkedIn scheduler started successfully');
}

