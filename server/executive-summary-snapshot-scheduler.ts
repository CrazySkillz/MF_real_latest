import { getInternalAutoRefreshToken } from "./internal-request-auth";
import { storage } from "./storage";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function captureExecutiveSummarySnapshot(baseUrl: string, campaignId: string): Promise<boolean> {
  const token = getInternalAutoRefreshToken();
  try {
    const response = await fetch(`${baseUrl}/api/campaigns/${encodeURIComponent(campaignId)}/outcome-totals?dateRange=90days&captureExecutiveSnapshot=1&executiveFinancialScope=campaign_to_date`, {
      headers: { "x-internal-auto-refresh-token": token },
    });
    if (!response.ok) {
      console.warn(`[Executive Summary] Daily snapshot request failed for campaign ${campaignId}: ${response.status}`);
    }
    await response.body?.cancel().catch(() => null);
    return response.ok;
  } catch (error: any) {
    console.warn(`[Executive Summary] Daily snapshot request failed for campaign ${campaignId}:`, error?.message || error);
    return false;
  }
}

export async function captureExecutiveSummarySnapshots(baseUrl: string): Promise<void> {
  const campaigns = await storage.getCampaigns();
  const capturedCampaignIds = new Set<string>();
  for (const campaign of campaigns) {
    if (capturedCampaignIds.has(campaign.id)) continue;
    capturedCampaignIds.add(campaign.id);
    try {
      const ga4Connections = await storage.getGA4Connections(campaign.id);
      if (ga4Connections.some((connection: any) => {
        const propertyId = String(connection?.propertyId || "").trim();
        return connection?.isActive !== false && propertyId && propertyId.toLowerCase() !== "yesop";
      })) continue;
    } catch (error: any) {
      console.warn(`[Executive Summary] Daily snapshot skipped because GA4 ownership could not be verified for campaign ${campaign.id}:`, error?.message || error);
      continue;
    }
    await captureExecutiveSummarySnapshot(baseUrl, campaign.id);
  }
}

export class ExecutiveSummarySnapshotScheduler {
  private intervalId: NodeJS.Timeout | null = null;

  start(port: number): void {
    if (this.intervalId) return;
    const baseUrl = `http://127.0.0.1:${port}`;
    setTimeout(() => void captureExecutiveSummarySnapshots(baseUrl), 60_000);
    this.intervalId = setInterval(() => void captureExecutiveSummarySnapshots(baseUrl), DAY_MS);
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }
}

export const executiveSummarySnapshotScheduler = new ExecutiveSummarySnapshotScheduler();
