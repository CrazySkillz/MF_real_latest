import { storage } from "./storage";
import type { InsertLinkedInDailyMetric } from "../shared/schema";

type LinkedInDailyElement = {
  impressions?: number;
  clicks?: number;
  costInLocalCurrency?: number | string;
  externalWebsiteConversions?: number;
  approximateUniqueImpressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  reactions?: number;
  leadGenerationMailContactInfoShares?: number;
  leadGenerationMailInterestedClicks?: number;
  videoViews?: number;
  videoStarts?: number;
  viralImpressions?: number;
  dateRange?: {
    start?: { year?: number; month?: number; day?: number };
    end?: { year?: number; month?: number; day?: number };
  };
};

function toISODate(dr: any): string | null {
  const s = dr?.start || dr?.dateRange?.start;
  const y = Number(s?.year);
  const m = Number(s?.month);
  const d = Number(s?.day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function toNum(n: any): number {
  const x = typeof n === "string" ? parseFloat(n) : Number(n);
  return Number.isFinite(x) ? x : 0;
}

/**
 * Persist daily facts for a MetricMind campaign by aggregating LinkedIn campaign DAILY analytics into a per-day rollup.
 * We persist base facts (impressions/clicks/spend/conversions/etc). Revenue-derived metrics are computed in the UI
 * using the current conversion value to avoid stale revenue when conversion value changes.
 */
export async function upsertLinkedInDailyTotals(params: {
  campaignId: string; // MetricMind campaign id
  dailyElements: LinkedInDailyElement[];
}): Promise<{ upserted: number; days: number }> {
  const campaignId = String(params.campaignId || "").trim();
  if (!campaignId) return { upserted: 0, days: 0 };

  const map = new Map<string, InsertLinkedInDailyMetric>();
  for (const el of Array.isArray(params.dailyElements) ? params.dailyElements : []) {
    const date = toISODate((el as any)?.dateRange || (el as any));
    if (!date) continue;

    const impressions = Math.max(0, Math.round(toNum((el as any)?.impressions)));
    const clicks = Math.max(0, Math.round(toNum((el as any)?.clicks)));
    const spend = toNum((el as any)?.costInLocalCurrency);
    const conversions = Math.max(0, Math.round(toNum((el as any)?.externalWebsiteConversions)));
    const reach = Math.max(0, Math.round(toNum((el as any)?.approximateUniqueImpressions)));

    const likes = Math.max(0, Math.round(toNum((el as any)?.likes || (el as any)?.reactions)));
    const comments = Math.max(0, Math.round(toNum((el as any)?.comments)));
    const shares = Math.max(0, Math.round(toNum((el as any)?.shares)));
    const engagements = Math.max(0, likes + comments + shares + clicks);

    const leads = Math.max(
      0,
      Math.round(
        toNum((el as any)?.leadGenerationMailContactInfoShares) +
          toNum((el as any)?.leadGenerationMailInterestedClicks)
      )
    );

    const videoViews = Math.max(0, Math.round(toNum((el as any)?.videoViews || (el as any)?.videoStarts)));
    const viralImpressions = Math.max(0, Math.round(toNum((el as any)?.viralImpressions)));

    const existing = map.get(date);
    if (!existing) {
      map.set(date, {
        campaignId,
        date,
        impressions,
        clicks,
        reach,
        engagements,
        conversions,
        leads,
        spend: String(spend.toFixed(2)),
        videoViews,
        viralImpressions,
      });
    } else {
      existing.impressions = Math.round(toNum((existing as any).impressions) + impressions) as any;
      existing.clicks = Math.round(toNum((existing as any).clicks) + clicks) as any;
      existing.reach = Math.round(toNum((existing as any).reach) + reach) as any;
      existing.engagements = Math.round(toNum((existing as any).engagements) + engagements) as any;
      existing.conversions = Math.round(toNum((existing as any).conversions) + conversions) as any;
      existing.leads = Math.round(toNum((existing as any).leads) + leads) as any;
      const prevSpend = toNum((existing as any).spend);
      existing.spend = String((prevSpend + spend).toFixed(2)) as any;
      existing.videoViews = Math.round(toNum((existing as any).videoViews) + videoViews) as any;
      existing.viralImpressions = Math.round(toNum((existing as any).viralImpressions) + viralImpressions) as any;
      map.set(date, existing);
    }
  }

  const rows = Array.from(map.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (rows.length === 0) return { upserted: 0, days: 0 };

  const result = await storage.upsertLinkedInDailyMetrics(rows);
  const upserted = typeof (result as any)?.upserted === "number" ? (result as any).upserted : rows.length;
  return { upserted, days: rows.length };
}


