import { storage } from "../storage";

function parseNum(v: any): number {
  if (v === null || typeof v === "undefined" || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

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

function last30CompleteUtcWindow(campaign: any): { startDate: string; endDate: string } {
  const endDate = yesterdayUTC();
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const start = new Date(end.getTime());
  start.setUTCDate(start.getUTCDate() - 29);
  let startDate = start.toISOString().slice(0, 10);

  const campStart =
    isoDateUTC(campaign?.startDate) ||
    isoDateUTC(campaign?.createdAt) ||
    null;
  if (campStart && String(campStart) > String(startDate)) startDate = String(campStart);
  if (String(startDate) > String(endDate)) startDate = endDate;

  return { startDate, endDate };
}

export type LinkedInRevenueContext = {
  hasRevenueTracking: boolean;
  totalRevenue: number;
  conversionValue: number;
  conversionValueSource: "connection" | "session" | "derived" | "none";
  importedRevenueToDate: number;
  windowStartDate: string;
  windowEndDate: string;
};

/**
 * Canonical LinkedIn revenue rules (single source of truth).
 *
 * - Uses LinkedIn-scoped inputs only (platformContext='linkedin').
 * - Conversion value priority: LinkedIn connection > import session > derived (revenue-to-date ÷ conversions) > none.
 * - Revenue enablement: conversionValue > 0 OR importedRevenueToDate > 0.
 * - Campaign-level revenue:
 *   - If importedRevenueToDate exists and there is no explicit conversion value, use importedRevenueToDate.
 *   - Otherwise use conversions × conversionValue (covers explicit + derived CV).
 *
 * This is designed to keep Overview/KPIs/Benchmarks/Ads consistent.
 */
export async function resolveLinkedInRevenueContext(opts: {
  campaignId: string;
  conversionsTotal: number;
  sessionConversionValue?: any;
}): Promise<LinkedInRevenueContext> {
  const campaignId = String(opts.campaignId || "").trim();
  const conversionsTotal = Math.max(0, parseNum(opts.conversionsTotal));

  const campaign = await storage.getCampaign(campaignId).catch(() => undefined as any);
  const { startDate, endDate } = last30CompleteUtcWindow(campaign);

  let importedRevenueToDate = 0;
  try {
    const totals = await (storage as any).getRevenueTotalForRange?.(campaignId, startDate, endDate, "linkedin");
    importedRevenueToDate = parseNum((totals as any)?.totalRevenue);
  } catch {
    importedRevenueToDate = 0;
  }

  // If the user explicitly configured a LinkedIn conversion-value source, we can trust conversionValue.
  // Otherwise, a legacy/stale session conversionValue may exist from older configs and should not override
  // imported revenue-to-date (we'll derive CV from revenue ÷ conversions instead).
  let hasExplicitLinkedInConversionValueSource = false;
  try {
    const sources = await (storage as any).getRevenueSources?.(campaignId, "linkedin");
    hasExplicitLinkedInConversionValueSource = (Array.isArray(sources) ? sources : []).some((s: any) => {
      if (!s || (s as any)?.isActive === false) return false;
      const raw = (s as any)?.mappingConfig;
      if (!raw) return false;
      try {
        const cfg = typeof raw === "string" ? JSON.parse(raw) : raw;
        const vs = String(cfg?.valueSource || "").trim().toLowerCase();
        const mode = String(cfg?.mode || "").trim().toLowerCase();
        return vs === "conversion_value" || mode === "conversion_value";
      } catch {
        return false;
      }
    });
  } catch {
    hasExplicitLinkedInConversionValueSource = false;
  }

  let connCv = 0;
  try {
    const conn = await storage.getLinkedInConnection(campaignId);
    connCv = parseNum((conn as any)?.conversionValue);
  } catch {
    connCv = 0;
  }

  const sessionCvRaw = parseNum(opts.sessionConversionValue);
  const shouldIgnoreSessionCv =
    importedRevenueToDate > 0 && connCv <= 0 && !hasExplicitLinkedInConversionValueSource;
  const sessionCv = shouldIgnoreSessionCv ? 0 : sessionCvRaw;

  let conversionValue = 0;
  let conversionValueSource: LinkedInRevenueContext["conversionValueSource"] = "none";
  if (connCv > 0) {
    conversionValue = connCv;
    conversionValueSource = "connection";
  } else if (sessionCv > 0) {
    conversionValue = sessionCv;
    conversionValueSource = "session";
  } else if (importedRevenueToDate > 0 && conversionsTotal > 0) {
    conversionValue = importedRevenueToDate / conversionsTotal;
    conversionValueSource = "derived";
  }

  // Round for stability in exec-facing UI
  conversionValue = Number(Number(conversionValue || 0).toFixed(2));
  importedRevenueToDate = Number(Number(importedRevenueToDate || 0).toFixed(2));

  const hasRevenueTracking = conversionValue > 0 || importedRevenueToDate > 0;

  let totalRevenue = 0;
  if (hasRevenueTracking) {
    if (importedRevenueToDate > 0 && conversionValueSource === "none") {
      totalRevenue = importedRevenueToDate;
    } else if (conversionValue > 0) {
      totalRevenue = conversionsTotal * conversionValue;
    } else {
      totalRevenue = importedRevenueToDate;
    }
  }
  totalRevenue = Number(Number(totalRevenue || 0).toFixed(2));

  return {
    hasRevenueTracking,
    totalRevenue,
    conversionValue,
    conversionValueSource,
    importedRevenueToDate,
    windowStartDate: startDate,
    windowEndDate: endDate,
  };
}

