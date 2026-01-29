/**
 * LinkedIn Data Refresh Scheduler
 * Automatically refreshes LinkedIn metrics for all campaigns with LinkedIn connections
 * Supports both test mode and production mode
 */

import { storage } from "./storage";
import { refreshKPIsForCampaign } from "./utils/kpi-refresh";
import { checkPerformanceAlerts } from "./kpi-scheduler";
import { db } from "./db";
import { linkedinConnections } from "../shared/schema";

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
  connection: any
): Promise<void> {
  console.log(`[LinkedIn Scheduler] TEST MODE: Generating mock data for campaign ${campaignId}`);

  // Get the latest import session to reuse selected campaigns and metrics
  const latestSession = await storage.getLatestLinkedInImportSession(campaignId);
  if (!latestSession) {
    console.log(`[LinkedIn Scheduler] No previous import sessions found for test mode campaign ${campaignId}`);
    return;
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

  // Get the selected metric keys
  const selectedMetricKeys = latestSession.selectedMetricKeys || [];

  // Generate mock metrics (simplified - in real implementation, you'd want to preserve campaign structure)
  for (const metricKey of selectedMetricKeys) {
    // Generate slightly varied values to simulate real data changes
    const baseValue = Math.random() * 10000 + 1000;
    const variation = 0.8 + (Math.random() * 0.4); // ±20% variation
    const raw = baseValue * variation;
    const metricValue = normalizeLinkedInMetricValue(metricKey, raw);

    await storage.createLinkedInImportMetric({
      sessionId: newSession.id,
      campaignUrn: `test-campaign-${Date.now()}`,
      campaignName: 'Test Campaign',
      campaignStatus: 'active',
      metricKey,
      metricValue
    });
  }

  // Generate mock ad performance data
  const numAds = Math.floor(Math.random() * 2) + 2;
  for (let i = 0; i < numAds; i++) {
    const adData: any = {
      sessionId: newSession.id,
      adId: `ad-${campaignId}-${Date.now()}-${i + 1}`,
      adName: `Ad ${i + 1} - Test Campaign`,
      campaignUrn: `test-campaign-${Date.now()}`,
      campaignName: 'Test Campaign',
      campaignSelectedMetrics: selectedMetricKeys,
      impressions: 0,
      clicks: 0,
      spend: "0",
      conversions: 0,
      revenue: "0",
      ctr: "0",
      cpc: "0",
      conversionRate: "0"
    };

    // Populate selected metrics with mock data
    if (selectedMetricKeys.includes('impressions')) {
      adData.impressions = Math.floor(Math.random() * 50000) + 10000;
    }
    if (selectedMetricKeys.includes('reach')) {
      adData.reach = Math.floor(Math.random() * 40000) + 8000;
    }
    if (selectedMetricKeys.includes('clicks')) {
      adData.clicks = Math.floor(Math.random() * 2000) + 500;
    }
    if (selectedMetricKeys.includes('engagements')) {
      adData.engagements = Math.floor(Math.random() * 3000) + 600;
    }
    if (selectedMetricKeys.includes('spend')) {
      adData.spend = (Math.random() * 5000 + 1000).toFixed(2);
    }
    if (selectedMetricKeys.includes('conversions')) {
      adData.conversions = Math.floor(Math.random() * 100) + 10;
    }
    if (selectedMetricKeys.includes('leads')) {
      adData.leads = Math.floor(Math.random() * 80) + 5;
    }

    // Calculate derived metrics
    const spend = parseFloat(adData.spend);
    if (selectedMetricKeys.includes('clicks') && selectedMetricKeys.includes('impressions') && adData.impressions > 0) {
      adData.ctr = ((adData.clicks / adData.impressions) * 100).toFixed(2);
    }
    if (selectedMetricKeys.includes('spend') && selectedMetricKeys.includes('clicks') && adData.clicks > 0) {
      adData.cpc = (spend / adData.clicks).toFixed(2);
    }
    if (selectedMetricKeys.includes('conversions') && selectedMetricKeys.includes('clicks') && adData.clicks > 0) {
      adData.cvr = ((adData.conversions / adData.clicks) * 100).toFixed(2);
      adData.conversionRate = adData.cvr;
    }

    await storage.createLinkedInAdPerformance(adData);
  }

  console.log(`[LinkedIn Scheduler] ✅ Mock data generated for campaign ${campaignId}`);

  // Also persist mock daily facts so Insights (Trends + anomalies) can be tested without waiting days.
  try {
    const days = 90;
    const now = new Date();
    const endUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)); // yesterday UTC
    const startUTC = new Date(endUTC.getTime());
    startUTC.setUTCDate(startUTC.getUTCDate() - (days - 1));

    let impressions = 20000 + Math.floor(Math.random() * 8000);
    let clicks = Math.max(50, Math.floor(impressions * (0.008 + Math.random() * 0.01)));
    let conversions = Math.max(0, Math.floor(clicks * (0.01 + Math.random() * 0.03)));
    let spend = 300 + Math.random() * 700;

    const drift = () => 0.9 + Math.random() * 0.2; // ±10%
    const rows: any[] = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(startUTC.getTime());
      d.setUTCDate(startUTC.getUTCDate() + i);
      const date = d.toISOString().slice(0, 10);

      impressions = Math.max(1000, Math.floor(impressions * drift()));
      clicks = Math.max(1, Math.floor(clicks * drift()));
      conversions = Math.max(0, Math.floor(conversions * drift()));
      spend = Math.max(10, spend * drift());

      rows.push({
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
      });
    }

    await storage.upsertLinkedInDailyMetrics(rows as any);
    console.log(`[LinkedIn Scheduler] ✅ Mock daily metrics upserted: ${rows.length} days for campaign ${campaignId}`);

    // Persist canonical last refresh timestamp for coverage UI.
    try {
      await storage.updateLinkedInConnection(campaignId, { lastRefreshAt: new Date() } as any);
    } catch {
      // ignore
    }
  } catch (e: any) {
    console.warn(`[LinkedIn Scheduler] Mock daily metrics upsert failed for ${campaignId}:`, e?.message || e);
  }
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
  connection?: any
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
      await generateMockLinkedInData(campaignId, connection);
    } else {
      await fetchRealLinkedInData(campaignId, connection);
    }

    // After data refresh, refresh KPIs
    console.log(`[LinkedIn Scheduler] Refreshing KPIs for campaign ${campaignId}...`);
    await refreshKPIsForCampaign(campaignId);

    // Immediately check for alerts after KPI refresh
    console.log(`[LinkedIn Scheduler] Checking performance alerts for campaign ${campaignId}...`);
    await checkPerformanceAlerts();

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

