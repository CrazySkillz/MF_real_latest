/**
 * Meta/Facebook Data Refresh Scheduler
 * Automatically refreshes Meta campaign metrics for all campaigns with Meta connections
 * Supports both test mode and production mode
 */

import { storage } from "./storage";
import { refreshKPIsForCampaign } from "./utils/kpi-refresh";
import { checkPerformanceAlerts } from "./kpi-scheduler";
import { checkBenchmarkPerformanceAlerts } from "./benchmark-notifications";
import { db } from "./db";
import { metaConnections, metaDailyMetrics } from "../shared/schema";
import { desc, eq } from "drizzle-orm";

/**
 * Generate mock Meta data for test mode
 * Creates realistic daily metrics data
 */
async function generateMockMetaData(
  campaignId: string,
  connection: any,
  opts?: { advanceDay?: boolean }
): Promise<void> {
  console.log(`[Meta Scheduler] TEST MODE: Generating mock data for campaign ${campaignId}`);

  try {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    let endUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)); // yesterday UTC

    // Determine the next "new day" to add
    const advanceDay = Boolean(opts?.advanceDay);

    let maxExistingDate = "";
    try {
      if (db) {
        const rows = await db
          .select({ date: metaDailyMetrics.date })
          .from(metaDailyMetrics)
          .where(eq(metaDailyMetrics.campaignId, campaignId))
          .orderBy(desc(metaDailyMetrics.date))
          .limit(1);
        maxExistingDate = String((rows as any[])?.[0]?.date || "");
      } else {
        const existingAll = await storage.getMetaDailyMetrics(campaignId);
        maxExistingDate =
          Array.isArray(existingAll) && existingAll.length > 0
            ? String((existingAll as any[])[(existingAll as any[]).length - 1]?.date || "")
            : "";
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
      // Cap at yesterday UTC; if we're already at/after yesterday, just overwrite yesterday (simulate re-import corrections).
      if (nextUTC.getTime() > endUTC.getTime()) {
        nextUTC = endUTC;
      }
    } else {
      // In manual test-mode refresh: treat each click as a new simulated day.
      if (nextUTC.getTime() > endUTC.getTime()) {
        endUTC = new Date(nextUTC.getTime());
      }
    }

    const date = iso(nextUTC);

    // Generate a single day's totals (lightweight; avoids big arrays/large writes).
    const impressions = Math.max(5000, 30000 + Math.floor(Math.random() * 10000));
    const reach = Math.max(3000, Math.floor(impressions * (0.7 + Math.random() * 0.15)));
    const clicks = Math.max(50, Math.floor(impressions * (0.012 + Math.random() * 0.015)));
    const spend = Math.max(50, 400 + Math.random() * 600);
    const conversions = Math.max(0, Math.floor(clicks * (0.02 + Math.random() * 0.04)));
    const videoViews = Math.max(0, Math.floor(impressions * (0.03 + Math.random() * 0.05)));

    // Calculate derived metrics
    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";
    const cpc = clicks > 0 ? (spend / clicks).toFixed(2) : "0.00";
    const cpm = impressions > 0 ? ((spend / impressions) * 1000).toFixed(2) : "0.00";
    const cpp = reach > 0 ? ((spend / reach) * 1000).toFixed(2) : "0.00";
    const frequency = reach > 0 ? (impressions / reach).toFixed(2) : "0.00";
    const costPerConversion = conversions > 0 ? (spend / conversions).toFixed(2) : "0.00";
    const conversionRate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(2) : "0.00";

    const row = {
      campaignId,
      metaCampaignId: connection.adAccountId || 'test-campaign',
      date,
      impressions,
      reach,
      clicks,
      spend: spend.toFixed(2),
      conversions,
      videoViews,
      ctr,
      cpc,
      cpm,
      cpp,
      frequency,
      costPerConversion,
      conversionRate,
    };

    await storage.upsertMetaDailyMetrics([row] as any);
    console.log(`[Meta Scheduler] ✅ Mock daily metrics upserted: 1 day (${date}) for campaign ${campaignId}`);

    // Update campaign cumulative spend from daily metrics
    const baseStartUTC = new Date(endUTC.getTime());
    baseStartUTC.setUTCDate(baseStartUTC.getUTCDate() - 59);
    const dailyMetrics = await storage.getMetaDailyMetrics(campaignId);
    const totalSpend = dailyMetrics.reduce((sum, m) => sum + (parseFloat(String(m.spend || 0)) || 0), 0);
    await storage.updateCampaign(campaignId, { spend: totalSpend });
    console.log(`[Meta Scheduler] TEST MODE: Updated campaign ${campaignId} spend: ${totalSpend.toFixed(2)}`);

    // Populate spend_records for daily granularity (Insights tab support)
    const spendRecordsToInsert = dailyMetrics
      .filter((m: any) => parseFloat(String(m?.spend || 0)) > 0)
      .map((m: any) => ({
        campaignId,
        spendSourceId: 'meta_daily_metrics',
        date: String(m.date),
        spend: String(parseFloat(String(m.spend || 0)).toFixed(2)),
        currency: 'USD',
        sourceType: 'meta_api'
      }));

    if (spendRecordsToInsert.length > 0) {
      try {
        await storage.createSpendRecords(spendRecordsToInsert as any);
        console.log(`[Meta Scheduler] TEST MODE: Populated ${spendRecordsToInsert.length} daily spend records for campaign ${campaignId}`);
      } catch (e: any) {
        if (!e?.message?.includes('duplicate') && !e?.message?.includes('conflict')) {
          console.warn(`[Meta Scheduler] TEST MODE: Spend records insert failed for ${campaignId}:`, e?.message || e);
        }
      }
    }

    // Persist canonical last refresh timestamp for coverage UI.
    try {
      await storage.updateMetaConnection(campaignId, { lastRefreshAt: new Date() } as any);
    } catch {
      // ignore
    }
  } catch (e: any) {
    console.warn(`[Meta Scheduler] Mock daily metrics upsert failed for ${campaignId}:`, e?.message || e);
  }
}

/**
 * Fetch real Meta data from Graph API
 */
async function fetchRealMetaData(
  campaignId: string,
  connection: any
): Promise<void> {
  console.log(`[Meta Scheduler] PRODUCTION MODE: Fetching real data for campaign ${campaignId}`);

  if (!connection.accessToken) {
    console.error(`[Meta Scheduler] No access token found for campaign ${campaignId}`);
    return;
  }

  try {
    // Import Meta Graph API client
    const { MetaGraphAPIClient, getLastNDaysRange } = await import('./services/meta-graph-api');
    const metaClient = new MetaGraphAPIClient(connection.accessToken);

    // Fetch campaigns for the last 30 days
    const dateRange = getLastNDaysRange(30);
    const campaigns = await metaClient.getCampaigns(connection.adAccountId, dateRange);

    if (!campaigns || campaigns.length === 0) {
      console.log(`[Meta Scheduler] No campaigns found for ad account ${connection.adAccountId}`);
      return;
    }

    // Fetch insights for each campaign
    const campaignIds = campaigns.map((c: any) => c.id);
    const campaignInsights = await metaClient.getBatchCampaignInsights(campaignIds, dateRange);

    // Fetch daily metrics for last 90 days (for Insights tab)
    const dailyDateRange = getLastNDaysRange(90);
    const dailyMetricsToStore: any[] = [];

    for (const campaign of campaigns) {
      try {
        const dailyInsights = await metaClient.getCampaignInsights(campaign.id, dailyDateRange);

        if (dailyInsights) {
          // Meta Graph API returns aggregated data, we need to store it as daily
          const insights = campaignInsights.get(campaign.id);
          if (!insights) continue;

          // Calculate derived metrics
          const ctr = insights.impressions > 0 ? ((insights.clicks / insights.impressions) * 100).toFixed(2) : "0.00";
          const cpc = insights.clicks > 0 ? (insights.spend / insights.clicks).toFixed(2) : "0.00";
          const cpm = insights.impressions > 0 ? ((insights.spend / insights.impressions) * 1000).toFixed(2) : "0.00";
          const cpp = insights.reach > 0 ? ((insights.spend / insights.reach) * 1000).toFixed(2) : "0.00";
          const frequency = insights.reach > 0 ? (insights.impressions / insights.reach).toFixed(2) : "0.00";
          const costPerConversion = insights.conversions > 0 ? (insights.spend / insights.conversions).toFixed(2) : "0.00";
          const conversionRate = insights.clicks > 0 ? ((insights.conversions / insights.clicks) * 100).toFixed(2) : "0.00";

          dailyMetricsToStore.push({
            campaignId,
            metaCampaignId: campaign.id,
            date: dateRange.until, // Using the end date for the aggregated period
            impressions: insights.impressions,
            reach: insights.reach,
            clicks: insights.clicks,
            spend: insights.spend.toFixed(2),
            conversions: insights.conversions,
            videoViews: insights.videoViews || 0,
            ctr,
            cpc,
            cpm,
            cpp,
            frequency,
            costPerConversion,
            conversionRate,
          });
        }
      } catch (campaignError: any) {
        console.warn(`[Meta Scheduler] Failed to fetch daily insights for campaign ${campaign.id}:`, campaignError.message);
      }
    }

    // Store daily metrics
    if (dailyMetricsToStore.length > 0) {
      await storage.upsertMetaDailyMetrics(dailyMetricsToStore as any);
      console.log(`[Meta Scheduler] ✅ Stored ${dailyMetricsToStore.length} daily metric records for campaign ${campaignId}`);

      // Update campaign cumulative spend from daily metrics
      const dailyMetrics = await storage.getMetaDailyMetrics(campaignId);
      const totalSpend = dailyMetrics.reduce((sum, m) => sum + (parseFloat(String(m.spend || 0)) || 0), 0);
      await storage.updateCampaign(campaignId, { spend: totalSpend });
      console.log(`[Meta Scheduler] Updated campaign ${campaignId} spend: ${totalSpend.toFixed(2)}`);

      // Populate spend_records for daily granularity (Insights tab support)
      const spendRecordsToInsert = dailyMetrics
        .filter((m: any) => parseFloat(String(m?.spend || 0)) > 0)
        .map((m: any) => ({
          campaignId,
          spendSourceId: 'meta_daily_metrics',
          date: String(m.date),
          spend: String(parseFloat(String(m.spend || 0)).toFixed(2)),
          currency: 'USD',
          sourceType: 'meta_api'
        }));

      if (spendRecordsToInsert.length > 0) {
        try {
          await storage.createSpendRecords(spendRecordsToInsert as any);
          console.log(`[Meta Scheduler] Populated ${spendRecordsToInsert.length} daily spend records for campaign ${campaignId}`);
        } catch (e: any) {
          if (!e?.message?.includes('duplicate') && !e?.message?.includes('conflict')) {
            console.warn(`[Meta Scheduler] Spend records insert failed for ${campaignId}:`, e?.message || e);
          }
        }
      }
    }

    console.log(`[Meta Scheduler] ✅ Real data fetched and stored for campaign ${campaignId}`);

    // Persist canonical last refresh timestamp for coverage UI.
    try {
      await storage.updateMetaConnection(campaignId, { lastRefreshAt: new Date() } as any);
    } catch {
      // ignore
    }
  } catch (error: any) {
    console.error(`[Meta Scheduler] Error fetching real Meta data for campaign ${campaignId}:`, error.message);
    // Don't throw - log and continue with other campaigns
  }
}

/**
 * Refresh Meta data for a single campaign
 */
export async function refreshMetaDataForCampaign(
  campaignId: string,
  connection?: any,
  opts?: { advanceTestDay?: boolean }
): Promise<void> {
  try {
    // Get connection if not provided
    if (!connection) {
      connection = await storage.getMetaConnection(campaignId);
    }

    if (!connection) {
      console.log(`[Meta Scheduler] No Meta connection found for campaign ${campaignId}`);
      return;
    }

    // Detect test mode (robust): explicit method, explicit env, or known test tokens.
    const method = String(connection.method || '').toLowerCase();
    const token = String(connection.accessToken || '');
    const isTestMode =
      method.includes('test') ||
      process.env.META_TEST_MODE === 'true' ||
      token === 'test-mode-token' ||
      token.startsWith('test_') ||
      token.startsWith('test-');

    if (isTestMode) {
      await generateMockMetaData(campaignId, connection, { advanceDay: Boolean(opts?.advanceTestDay) });
    } else {
      await fetchRealMetaData(campaignId, connection);
    }

    // After data refresh, refresh KPIs
    console.log(`[Meta Scheduler] Refreshing KPIs for campaign ${campaignId}...`);
    await refreshKPIsForCampaign(campaignId);

    // Immediately check for alerts after KPI refresh
    console.log(`[Meta Scheduler] Checking performance alerts for campaign ${campaignId}...`);
    await checkPerformanceAlerts();

    // Benchmark alerts are separate from KPI alerts; run them after refresh too.
    try {
      await checkBenchmarkPerformanceAlerts();
    } catch (e: any) {
      console.warn(`[Meta Scheduler] Benchmark alert check failed for campaign ${campaignId}:`, e?.message || e);
    }

    console.log(`[Meta Scheduler] ✅ Completed refresh for campaign ${campaignId}`);
  } catch (error: any) {
    console.error(`[Meta Scheduler] Error refreshing campaign ${campaignId}:`, error);
    // Don't throw - continue with other campaigns
  }
}

/**
 * Refresh Meta data for all campaigns with Meta connections
 */
export async function refreshAllMetaData(): Promise<void> {
  console.log('[Meta Scheduler] Starting scheduled Meta data refresh...');

  try {
    // Get all Meta connections from database
    const allConnections = await db.select({ campaignId: metaConnections.campaignId }).from(metaConnections);

    if (!allConnections || allConnections.length === 0) {
      console.log('[Meta Scheduler] No Meta connections found');
      return;
    }

    console.log(`[Meta Scheduler] Found ${allConnections.length} Meta connection(s) to refresh`);

    // Refresh data for each campaign
    for (const row of allConnections) {
      const campaignId = String((row as any).campaignId || "").trim();
      if (!campaignId) continue;
      // Fetch via storage so tokens are decrypted
      const connection = await storage.getMetaConnection(campaignId);
      await refreshMetaDataForCampaign(campaignId, connection);
    }

    console.log('[Meta Scheduler] ✅ Meta data refresh completed for all campaigns');
  } catch (error: any) {
    console.error('[Meta Scheduler] Error in scheduled refresh:', error);
  }
}

/**
 * Start the Meta scheduler
 * Runs every 4-6 hours (configurable via environment variable)
 */
export function startMetaScheduler(): void {
  console.log('[Meta Scheduler] Starting Meta data refresh scheduler...');

  // Get refresh interval from environment (default: 4 hours = 6x daily)
  // Enterprise recommendation: 4-6 hours (4 hours = 6x daily, 6 hours = 4x daily)
  const refreshIntervalHours = parseInt(process.env.META_REFRESH_INTERVAL_HOURS || '4', 10);
  const refreshIntervalMs = refreshIntervalHours * 60 * 60 * 1000;

  console.log(`[Meta Scheduler] Refresh interval: ${refreshIntervalHours} hours (${24 / refreshIntervalHours}x daily)`);
  console.log(`[Meta Scheduler] Next refresh: ${new Date(Date.now() + refreshIntervalMs).toLocaleString()}`);

  // Don't run immediately on startup - wait for first scheduled interval
  // This prevents unnecessary API calls on server restart

  // Schedule regular refreshes
  setInterval(() => {
    refreshAllMetaData();
  }, refreshIntervalMs);

  console.log('[Meta Scheduler] ✅ Meta scheduler started successfully');
}
