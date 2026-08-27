import { getInternalAutoRefreshToken } from "./internal-request-auth";
import { storage } from "./storage";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function captureExecutiveSummarySnapshots(baseUrl: string): Promise<void> {
  const campaigns = await storage.getCampaigns();
  const token = getInternalAutoRefreshToken();
  const capturedCampaignIds = new Set<string>();
  for (const campaign of campaigns) {
    if (capturedCampaignIds.has(campaign.id)) continue;
    capturedCampaignIds.add(campaign.id);
    try {
      const response = await fetch(`${baseUrl}/api/campaigns/${encodeURIComponent(campaign.id)}/outcome-totals?dateRange=90days&captureExecutiveSnapshot=1`, {
        headers: { "x-internal-auto-refresh-token": token },
      });
      if (!response.ok) {
        console.warn(`[Executive Summary] Daily snapshot request failed for campaign ${campaign.id}: ${response.status}`);
      }
      await response.body?.cancel().catch(() => null);
    } catch (error: any) {
      console.warn(`[Executive Summary] Daily snapshot request failed for campaign ${campaign.id}:`, error?.message || error);
    }
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
