import { db } from "./db";
import { storage } from "./storage";
import { tiktokConnections } from "../shared/schema";

const iso = (d: Date) => d.toISOString().slice(0, 10);

function parseSelectedTikTokCampaignIds(connection: any): string[] {
  try {
    const parsed = JSON.parse(String(connection?.selectedCampaignIds || "[]"));
    return Array.isArray(parsed)
      ? Array.from(new Set(parsed.map((id: any) => String(id || "").trim()).filter(Boolean)))
      : [];
  } catch {
    return [];
  }
}

function parseTikTokCampaignMetadata(connection: any): Map<string, any> {
  try {
    const parsed = JSON.parse(String(connection?.selectedCampaignMetadata || "[]"));
    if (!Array.isArray(parsed)) return new Map();
    return new Map(parsed.map((item: any) => [String(item?.id || item?.campaignId || ""), item]));
  } catch {
    return new Map();
  }
}

async function markTikTokRefreshFailure(campaignId: string, reason: string) {
  await storage.updateTikTokConnection(campaignId, { lastError: reason } as any).catch(() => undefined);
}

function buildTestModeTikTokRows(campaignId: string, connection: any, selectedCampaignIds: string[]) {
  const metadataById = parseTikTokCampaignMetadata(connection);
  const date = iso(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - 1)));

  return selectedCampaignIds.map((id, index) => {
    const metadata = metadataById.get(id) || {};
    const impressions = 3200 + (index * 450);
    const clicks = 115 + (index * 21);
    const spend = 96 + (index * 14.75);
    const conversions = 5 + index;
    const videoViews = 780 + (index * 95);
    const engagements = 240 + (index * 36);
    return {
      campaignId,
      advertiserId: connection.advertiserId,
      tiktokCampaignId: id,
      tiktokCampaignName: String(metadata.name || metadata.campaignName || id),
      date,
      impressions,
      clicks,
      spend: spend.toFixed(2),
      currency: "USD",
      conversions: conversions.toFixed(2),
      videoViews,
      engagements,
      ctr: ((clicks / impressions) * 100).toFixed(2),
      cpc: (spend / clicks).toFixed(2),
      cpm: ((spend / impressions) * 1000).toFixed(2),
      costPerConversion: (spend / conversions).toFixed(2),
      conversionRate: ((conversions / clicks) * 100).toFixed(2),
      rawMetrics: { source: "tiktok_test_mode_refresh" },
      metricAvailability: { revenue: "unavailable_until_tiktok_scoped_attributed_revenue_exists" },
      isSimulated: true,
      sourceContractVersion: "tiktok_campaign_daily_v1",
    };
  });
}

export async function refreshTikTokForCampaign(
  campaignId: string,
  connection?: any,
): Promise<{ refreshed: boolean; reason?: string; upserted: number; selectedCampaignIds: string[] }> {
  if (!connection) {
    connection = await storage.getTikTokConnection(campaignId);
  }
  if (!connection) return { refreshed: false, reason: "missing_connection", upserted: 0, selectedCampaignIds: [] };
  if ((connection as any).spendOnly) return { refreshed: false, reason: "spend_only", upserted: 0, selectedCampaignIds: [] };

  const campaign = await storage.getCampaign(campaignId).catch(() => null);
  if (!campaign) {
    await markTikTokRefreshFailure(campaignId, "missing_campaign");
    return { refreshed: false, reason: "missing_campaign", upserted: 0, selectedCampaignIds: [] };
  }

  if (!String((connection as any).advertiserId || "").trim()) {
    await markTikTokRefreshFailure(campaignId, "missing_advertiser");
    return { refreshed: false, reason: "missing_advertiser", upserted: 0, selectedCampaignIds: [] };
  }

  const selectedCampaignIds = parseSelectedTikTokCampaignIds(connection);
  if (selectedCampaignIds.length === 0) {
    await markTikTokRefreshFailure(campaignId, "missing_selected_campaigns");
    return { refreshed: false, reason: "missing_selected_campaigns", upserted: 0, selectedCampaignIds: [] };
  }

  if (String((connection as any).method || "") !== "test_mode") {
    if (!(connection as any).accessToken) {
      await markTikTokRefreshFailure(campaignId, "missing_access_token");
      return { refreshed: false, reason: "missing_access_token", upserted: 0, selectedCampaignIds };
    }
    await markTikTokRefreshFailure(campaignId, "live_provider_refresh_deferred");
    return { refreshed: false, reason: "live_provider_refresh_deferred", upserted: 0, selectedCampaignIds };
  }

  const rows = buildTestModeTikTokRows(campaignId, connection, selectedCampaignIds);
  const result = rows.length > 0 ? await storage.upsertTikTokDailyMetrics(rows as any) : { upserted: 0 };
  await storage.updateTikTokConnection(campaignId, { lastRefreshAt: new Date(), lastError: null } as any);
  return { refreshed: true, upserted: result.upserted, selectedCampaignIds };
}

export async function refreshAllTikTokMetrics(): Promise<void> {
  let connections: any[] = [];
  try {
    connections = await db.select({ campaignId: tiktokConnections.campaignId }).from(tiktokConnections);
  } catch {
    return;
  }

  for (const conn of connections) {
    const campaignId = String((conn as any)?.campaignId || "").trim();
    if (!campaignId) continue;
    try {
      const connection = await storage.getTikTokConnection(campaignId);
      await refreshTikTokForCampaign(campaignId, connection);
    } catch (error: any) {
      await markTikTokRefreshFailure(campaignId, error?.message || "refresh_failed");
      console.error(`[TikTok Scheduler] Error refreshing campaign ${campaignId}:`, error?.message || error);
    }
  }
}

export function startTikTokScheduler(): void {
  console.log("[TikTok Scheduler] Starting TikTok data refresh scheduler...");

  const refreshIntervalHours = parseInt(process.env.TIKTOK_REFRESH_INTERVAL_HOURS || "4", 10);
  const refreshIntervalMs = refreshIntervalHours * 60 * 60 * 1000;

  console.log(`[TikTok Scheduler] Refresh interval: ${refreshIntervalHours} hours`);

  setInterval(() => {
    refreshAllTikTokMetrics();
  }, refreshIntervalMs);

  console.log("[TikTok Scheduler] Started successfully");
}
