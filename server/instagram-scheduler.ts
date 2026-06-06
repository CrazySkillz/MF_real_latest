import { db } from "./db";
import { storage } from "./storage";
import { instagramConnections } from "../shared/schema";

const parseSelectedInstagramCampaignIds = (connection: any): string[] => {
  try {
    const parsed = JSON.parse(String(connection?.selectedCampaignIds || "[]"));
    return Array.isArray(parsed)
      ? Array.from(new Set(parsed.map((id: any) => String(id || "").trim()).filter(Boolean)))
      : [];
  } catch {
    return [];
  }
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function refreshInstagramForCampaign(
  campaignId: string,
  connection?: any,
): Promise<{ refreshed: boolean; reason?: string; upserted: number }> {
  if (!connection) {
    connection = await storage.getInstagramConnection(campaignId);
  }
  if (!connection) return { refreshed: false, reason: "missing_connection", upserted: 0 };
  if ((connection as any).spendOnly) return { refreshed: false, reason: "spend_only", upserted: 0 };
  if (String((connection as any).method || "") === "test_mode") return { refreshed: false, reason: "test_mode_explicit_refresh_only", upserted: 0 };
  if (String((connection as any).publisherPlatformFilter || "instagram") !== "instagram") return { refreshed: false, reason: "invalid_publisher_platform", upserted: 0 };

  const campaign = await storage.getCampaign(campaignId).catch(() => null);
  if (!campaign) {
    console.warn(`[Instagram Scheduler] Skipping refresh for missing campaign ${campaignId}`);
    return { refreshed: false, reason: "missing_campaign", upserted: 0 };
  }

  if (!(connection as any).accessToken) return { refreshed: false, reason: "missing_access_token", upserted: 0 };

  const selectedCampaignIds = parseSelectedInstagramCampaignIds(connection);
  if (selectedCampaignIds.length === 0) {
    console.warn(`[Instagram Scheduler] Skipping refresh for campaign ${campaignId}; missing selected Instagram campaign IDs`);
    return { refreshed: false, reason: "missing_selected_campaigns", upserted: 0 };
  }

  const { MetaGraphAPIClient } = await import("./services/meta-graph-api");
  const metaClient = new MetaGraphAPIClient((connection as any).accessToken as string);
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const rows: any[] = [];

  for (const instagramCampaignId of selectedCampaignIds) {
    const placements = await metaClient.getCampaignDailyPlacementInsights(instagramCampaignId, { since: iso(since), until: iso(until) });
    for (const placement of placements) {
      if (String(placement.publisherPlatform || "").trim().toLowerCase() !== "instagram") continue;
      const date = String(placement.dateStart || placement.dateStop || "").slice(0, 10);
      if (!date) continue;
      rows.push({
        campaignId,
        instagramCampaignId,
        instagramCampaignName: instagramCampaignId,
        date,
        publisherPlatform: "instagram",
        platformPosition: placement.platformPosition || "unknown",
        impressions: placement.impressions || 0,
        clicks: placement.clicks || 0,
        spend: String(Number(placement.spend || 0).toFixed(2)),
        conversions: String(Number(placement.conversions || 0).toFixed(2)),
        actions: placement.actions || [],
        ctr: placement.impressions > 0 ? ((placement.clicks / placement.impressions) * 100).toFixed(2) : "0.00",
        cpc: placement.clicks > 0 ? (placement.spend / placement.clicks).toFixed(2) : "0.00",
        cpm: placement.impressions > 0 ? ((placement.spend / placement.impressions) * 1000).toFixed(2) : "0.00",
        costPerConversion: placement.conversions > 0 ? (placement.spend / placement.conversions).toFixed(2) : "0.00",
        conversionRate: placement.clicks > 0 ? ((placement.conversions / placement.clicks) * 100).toFixed(2) : "0.00",
      });
    }
  }

  const result = rows.length > 0 ? await storage.upsertInstagramDailyMetrics(rows as any) : { upserted: 0 };
  await storage.updateInstagramConnection(campaignId, { lastRefreshAt: new Date() } as any);
  return { refreshed: true, upserted: result.upserted };
}

export async function refreshAllInstagramMetrics(): Promise<void> {
  let connections: any[] = [];
  try {
    connections = await db.select({ campaignId: instagramConnections.campaignId }).from(instagramConnections);
  } catch {
    return;
  }

  for (const conn of connections) {
    const campaignId = String((conn as any)?.campaignId || "").trim();
    if (!campaignId) continue;
    try {
      const connection = await storage.getInstagramConnection(campaignId);
      await refreshInstagramForCampaign(campaignId, connection);
    } catch (error: any) {
      console.error(`[Instagram Scheduler] Error refreshing campaign ${campaignId}:`, error?.message || error);
    }
  }
}

export function startInstagramScheduler(): void {
  console.log("[Instagram Scheduler] Starting Instagram data refresh scheduler...");

  const refreshIntervalHours = parseInt(process.env.INSTAGRAM_REFRESH_INTERVAL_HOURS || "4", 10);
  const refreshIntervalMs = refreshIntervalHours * 60 * 60 * 1000;

  console.log(`[Instagram Scheduler] Refresh interval: ${refreshIntervalHours} hours`);

  setInterval(() => {
    refreshAllInstagramMetrics();
  }, refreshIntervalMs);

  console.log("[Instagram Scheduler] Started successfully");
}
