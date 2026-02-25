/**
 * Google Ads Data Scheduler
 * Handles periodic data sync for Google Ads connections (mock + real)
 * Follows the meta-scheduler.ts pattern
 */
import { storage } from "./storage";
import { db } from "./db";
import { googleAdsConnections, googleAdsDailyMetrics } from "../shared/schema";
import { eq, desc } from "drizzle-orm";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Generate mock Google Ads data for test mode connections
 */
async function generateMockGoogleAdsData(
  campaignId: string,
  connection: any,
  opts?: { advanceDay?: boolean }
): Promise<void> {
  // Get the last imported date
  let existingDates: string[] = [];
  try {
    const existing = await storage.getGoogleAdsDailyMetrics(campaignId, '2000-01-01', '2099-12-31');
    existingDates = existing.map((m) => m.date);
  } catch {
    // ignore
  }

  const now = new Date();
  const yesterdayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const windowStart = new Date(yesterdayUtc);
  windowStart.setDate(windowStart.getDate() - 59);

  // Determine the next date to generate data for
  let nextDate: Date;
  if (existingDates.length === 0) {
    nextDate = windowStart;
  } else {
    const maxDate = existingDates.sort().pop()!;
    const d = new Date(maxDate + 'T00:00:00Z');
    d.setDate(d.getDate() + 1);
    nextDate = d;
  }

  const cap = opts?.advanceDay ? new Date(yesterdayUtc.getTime() + 86400000) : yesterdayUtc;
  if (nextDate > cap) {
    console.log(`[Google Ads Mock] No new dates to generate for campaign ${campaignId}`);
    return;
  }

  const dateStr = iso(nextDate);
  const mockCampaignId = `gads_campaign_${campaignId.slice(0, 8)}`;

  // Generate realistic metrics with variance
  const impressions = Math.max(3000, 20000 + Math.floor(Math.random() * 15000));
  const clicks = Math.max(40, Math.floor(impressions * (0.02 + Math.random() * 0.04)));
  const spend = Math.max(30, 300 + Math.random() * 500);
  const conversions = Math.max(0, Math.floor(clicks * (0.03 + Math.random() * 0.05)));
  const conversionValue = conversions * (20 + Math.random() * 80);
  const videoViews = Math.floor(impressions * (0.02 + Math.random() * 0.03));

  const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(4)) : 0;
  const cpc = clicks > 0 ? Number((spend / clicks).toFixed(2)) : 0;
  const cpm = impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : 0;
  const costPerConversion = conversions > 0 ? Number((spend / conversions).toFixed(2)) : 0;
  const conversionRate = clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : 0;
  const searchImpressionShare = Number((40 + Math.random() * 50).toFixed(2));

  await storage.upsertGoogleAdsDailyMetrics([{
    campaignId,
    googleCampaignId: mockCampaignId,
    googleCampaignName: 'Mock Google Ads Campaign',
    date: dateStr,
    impressions,
    clicks,
    spend: String(spend.toFixed(2)),
    conversions: String(conversions),
    conversionValue: String(conversionValue.toFixed(2)),
    ctr: String(ctr),
    cpc: String(cpc),
    cpm: String(cpm),
    interactionRate: String(ctr),
    videoViews,
    searchImpressionShare: String(searchImpressionShare),
    costPerConversion: String(costPerConversion),
    conversionRate: String(conversionRate),
  }]);

  // Also populate spend records
  try {
    let spendSources = await storage.getSpendSources(campaignId);
    let gadsSource = spendSources.find((s) => s.sourceType === 'ad_platforms' && s.displayName?.includes('Google Ads'));
    if (!gadsSource) {
      gadsSource = await storage.createSpendSource({
        campaignId,
        sourceType: 'ad_platforms',
        displayName: 'Google Ads',
        currency: 'USD',
        isActive: true,
      });
    }
    await storage.createSpendRecords([{
      campaignId,
      spendSourceId: gadsSource.id,
      date: dateStr,
      spend: String(spend.toFixed(2)),
      currency: 'USD',
    }]);
  } catch {
    // ignore duplicate spend records
  }

  console.log(`[Google Ads Mock] Generated data for ${dateStr} — impressions=${impressions}, clicks=${clicks}, spend=$${spend.toFixed(2)}`);
}

/**
 * Fetch real data from Google Ads API
 */
async function fetchRealGoogleAdsData(
  campaignId: string,
  connection: any
): Promise<void> {
  const { GoogleAdsClient } = await import('./googleAdsClient');

  let accessToken = connection.accessToken;
  const refreshToken = connection.refreshToken;
  const clientId = connection.clientId || process.env.GOOGLE_ADS_CLIENT_ID || '';
  const clientSecret = connection.clientSecret || process.env.GOOGLE_ADS_CLIENT_SECRET || '';
  const developerToken = connection.developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';

  // Refresh token if needed
  if (refreshToken && clientId && clientSecret) {
    try {
      const refreshed = await GoogleAdsClient.refreshAccessToken(refreshToken, clientId, clientSecret);
      accessToken = refreshed.access_token;
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
      await storage.updateGoogleAdsConnection(campaignId, { accessToken, expiresAt } as any);
    } catch (e: any) {
      console.warn(`[Google Ads] Token refresh failed for campaign ${campaignId}:`, e.message);
    }
  }

  if (!accessToken) {
    console.warn(`[Google Ads] No access token for campaign ${campaignId}`);
    return;
  }

  const client = new GoogleAdsClient({
    accessToken,
    developerToken,
    customerId: connection.customerId,
    managerAccountId: connection.managerAccountId || undefined,
  });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 60);

  const insights = await client.getDailyMetrics(iso(startDate), iso(endDate));

  if (insights.length === 0) {
    console.log(`[Google Ads] No data returned for campaign ${campaignId}`);
    return;
  }

  const metricsToUpsert = insights.map((i) => ({
    campaignId,
    googleCampaignId: i.campaignId,
    googleCampaignName: i.campaignName,
    date: i.date,
    impressions: i.impressions,
    clicks: i.clicks,
    spend: String(GoogleAdsClient.microsToAmount(i.costMicros).toFixed(2)),
    conversions: String(i.conversions),
    conversionValue: String(i.conversionsValue.toFixed(2)),
    ctr: String((i.ctr * 100).toFixed(4)),
    cpc: String(GoogleAdsClient.microsToAmount(i.averageCpc).toFixed(2)),
    cpm: String(GoogleAdsClient.microsToAmount(i.averageCpm).toFixed(2)),
    interactionRate: String((i.interactionRate * 100).toFixed(2)),
    videoViews: i.videoViews,
    searchImpressionShare: String((i.searchImpressionShare * 100).toFixed(2)),
    costPerConversion: i.conversions > 0
      ? String((GoogleAdsClient.microsToAmount(i.costMicros) / i.conversions).toFixed(2))
      : null,
    conversionRate: i.clicks > 0
      ? String(((i.conversions / i.clicks) * 100).toFixed(2))
      : null,
  }));

  const { upserted } = await storage.upsertGoogleAdsDailyMetrics(metricsToUpsert);
  console.log(`[Google Ads] Upserted ${upserted} daily metrics for campaign ${campaignId}`);

  // Populate spend records
  try {
    let spendSources = await storage.getSpendSources(campaignId);
    let gadsSource = spendSources.find((s) => s.sourceType === 'ad_platforms' && s.displayName?.includes('Google Ads'));
    if (!gadsSource) {
      gadsSource = await storage.createSpendSource({
        campaignId,
        sourceType: 'ad_platforms',
        displayName: 'Google Ads',
        currency: 'USD',
        isActive: true,
      });
    }

    // Aggregate spend by date
    const spendByDate = new Map<string, number>();
    for (const m of metricsToUpsert) {
      const existing = spendByDate.get(m.date) || 0;
      spendByDate.set(m.date, existing + parseFloat(m.spend));
    }

    const spendRecords = Array.from(spendByDate.entries()).map(([date, spend]) => ({
      campaignId,
      spendSourceId: gadsSource!.id,
      date,
      spend: String(spend.toFixed(2)),
      currency: 'USD',
    }));

    await storage.createSpendRecords(spendRecords);
  } catch {
    // ignore duplicate spend records
  }

  // Update lastRefreshAt
  await storage.updateGoogleAdsConnection(campaignId, {
    lastRefreshAt: new Date(),
  } as any);
}

/**
 * Refresh Google Ads data for a single campaign
 */
export async function refreshGoogleAdsForCampaign(
  campaignId: string,
  connection?: any,
  opts?: { advanceTestDay?: boolean }
): Promise<void> {
  if (!connection) {
    connection = await storage.getGoogleAdsConnection(campaignId);
  }
  if (!connection) return;

  if (connection.method === 'test_mode') {
    await generateMockGoogleAdsData(campaignId, connection, { advanceDay: opts?.advanceTestDay });
  } else {
    await fetchRealGoogleAdsData(campaignId, connection);
  }
}

/**
 * Start the Google Ads scheduler
 * Runs every 4 hours (similar to Meta scheduler)
 */
export function startGoogleAdsScheduler(): void {
  console.log('[Google Ads Scheduler] Starting Google Ads data refresh scheduler...');

  const refreshIntervalHours = parseInt(process.env.GOOGLE_ADS_REFRESH_INTERVAL_HOURS || '4', 10);
  const refreshIntervalMs = refreshIntervalHours * 60 * 60 * 1000;

  console.log(`[Google Ads Scheduler] Refresh interval: ${refreshIntervalHours} hours`);

  setInterval(() => {
    refreshAllGoogleAdsMetrics();
  }, refreshIntervalMs);

  console.log('[Google Ads Scheduler] Started successfully');
}

/**
 * Refresh all Google Ads connections (called by main scheduler)
 */
export async function refreshAllGoogleAdsMetrics(
  opts?: { advanceDay?: boolean }
): Promise<void> {
  let connections: any[] = [];
  try {
    connections = await db.select().from(googleAdsConnections);
  } catch {
    return;
  }

  for (const conn of connections) {
    try {
      await refreshGoogleAdsForCampaign(conn.campaignId, conn, { advanceTestDay: opts?.advanceDay });
    } catch (e: any) {
      console.error(`[Google Ads Scheduler] Error refreshing campaign ${conn.campaignId}:`, e.message);
    }
  }
}
