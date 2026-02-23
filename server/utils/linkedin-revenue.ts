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
  conversionValueSource: "webhook_events" | "connection" | "session" | "derived" | "none";
  importedRevenueToDate: number;
  windowStartDate: string;
  windowEndDate: string;
  webhookEventCount?: number;
  webhookRevenueUsed?: boolean;
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

  // Revenue sources for LinkedIn (used to detect explicit conversion-value sources AND Shopify AOV fallback)
  let linkedInRevenueSources: any[] = [];
  try {
    linkedInRevenueSources = await (storage as any).getRevenueSources?.(campaignId, "linkedin");
  } catch {
    linkedInRevenueSources = [];
  }

  // If the user explicitly configured a LinkedIn conversion-value source, we can trust conversionValue.
  // Otherwise, a legacy/stale session conversionValue may exist from older configs and should not override
  // imported revenue-to-date (we'll derive CV from revenue ÷ conversions instead).
  let hasExplicitLinkedInConversionValueSource = false;
  try {
    hasExplicitLinkedInConversionValueSource = (Array.isArray(linkedInRevenueSources) ? linkedInRevenueSources : []).some((s: any) => {
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
    // Self-healing: if conversionValue is set but there are no active revenue sources,
    // it's stale (e.g., source was deleted before cleanup code existed). Clear it.
    if (connCv > 0) {
      const activeSourceCount = (Array.isArray(linkedInRevenueSources) ? linkedInRevenueSources : [])
        .filter((s: any) => s && (s as any).isActive !== false).length;
      if (activeSourceCount === 0 && importedRevenueToDate <= 0) {
        // No active sources and no imported revenue — conversionValue is stale
        try { await storage.updateLinkedInConnection(campaignId, { conversionValue: null } as any); } catch { /* ignore */ }
        connCv = 0;
      }
    }
  } catch {
    connCv = 0;
  }

  // Shopify fallback: Shopify is revenue-to-date. We still want a Conversion Value card.
  // Use the Shopify mappingConfig's computed AOV (lastConversionValue), or derive from
  // revenue-to-date ÷ lastMatchedOrderCount. This does NOT depend on LinkedIn conversions.
  // Also check the Shopify CONNECTION's mappingConfig as a fallback.
  let shopifyCv = 0;
  try {
    const shopifySource = (Array.isArray(linkedInRevenueSources) ? linkedInRevenueSources : []).find((s: any) => {
      if (!s || (s as any)?.isActive === false) return false;
      return String((s as any)?.sourceType || "").trim().toLowerCase() === "shopify";
    });
    if (shopifySource) {
      const raw = (shopifySource as any)?.mappingConfig;
      const cfg = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
      const lastCv = parseNum(cfg?.lastConversionValue);
      const lastCount = Math.max(0, Math.round(parseNum(cfg?.lastMatchedOrderCount)));
      if (lastCv > 0) {
        shopifyCv = lastCv;
      } else if (importedRevenueToDate > 0 && lastCount > 0) {
        shopifyCv = importedRevenueToDate / lastCount;
      }

      // Fallback: check Shopify connection's mappingConfig for lastConversionValue/lastMatchedOrderCount
      if (shopifyCv <= 0) {
        try {
          const shopifyConn = await (storage as any).getShopifyConnection?.(campaignId);
          if (shopifyConn) {
            const connRaw = (shopifyConn as any)?.mappingConfig;
            const connCfg = connRaw ? (typeof connRaw === "string" ? JSON.parse(connRaw) : connRaw) : {};
            const connLastCv = parseNum(connCfg?.lastConversionValue);
            const connLastCount = Math.max(0, Math.round(parseNum(connCfg?.lastMatchedOrderCount)));
            if (connLastCv > 0) {
              shopifyCv = connLastCv;
            } else if (importedRevenueToDate > 0 && connLastCount > 0) {
              shopifyCv = importedRevenueToDate / connLastCount;
            }
          }
        } catch {
          // ignore
        }
      }

      // Ultimate fallback: if we have Shopify revenue but no order count info at all,
      // assume 1 order (so CV = revenue-to-date). This handles legacy mappings.
      if (shopifyCv <= 0 && importedRevenueToDate > 0) {
        shopifyCv = importedRevenueToDate;
      }
    }
  } catch {
    shopifyCv = 0;
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
  } else if (shopifyCv > 0) {
    conversionValue = shopifyCv;
    conversionValueSource = "derived";
  } else if (importedRevenueToDate > 0 && conversionsTotal > 0) {
    conversionValue = importedRevenueToDate / conversionsTotal;
    conversionValueSource = "derived";
  }

  // Round for stability in exec-facing UI
  conversionValue = Number(Number(conversionValue || 0).toFixed(2));
  importedRevenueToDate = Number(Number(importedRevenueToDate || 0).toFixed(2));

  // Check for webhook conversion events (HIGHEST PRIORITY for accuracy)
  let webhookEventCount = 0;
  let webhookRevenueUsed = false;
  let webhookRevenue = 0;
  try {
    const startDateObj = new Date(`${startDate}T00:00:00.000Z`);
    const endDateObj = new Date(`${endDate}T23:59:59.999Z`);
    const webhookEvents = await storage.getConversionEvents(campaignId, startDateObj, endDateObj);
    webhookEventCount = webhookEvents.length;
    if (webhookEventCount > 0) {
      webhookRevenue = webhookEvents.reduce((sum, evt) => sum + parseFloat(evt.value || "0"), 0);
      webhookRevenue = Number(Number(webhookRevenue || 0).toFixed(2));
    }
  } catch (err) {
    // Webhook events optional - continue with fallback logic
    webhookEventCount = 0;
    webhookRevenue = 0;
  }

  const hasRevenueTracking = webhookRevenue > 0 || conversionValue > 0 || importedRevenueToDate > 0;

  let totalRevenue = 0;
  let finalConversionValueSource = conversionValueSource;
  if (hasRevenueTracking) {
    // PRIORITY 1: Webhook events (most accurate - actual conversion values)
    if (webhookRevenue > 0) {
      totalRevenue = webhookRevenue;
      webhookRevenueUsed = true;
      finalConversionValueSource = "webhook_events";
    }
    // PRIORITY 2: Imported revenue-to-date (e.g., HubSpot deal Amounts, Shopify orders)
    // IMPORTANT: When we have an imported revenue-to-date, that imported value is the source of truth
    // for Total Revenue. We may still *derive* conversionValue for display, but we must not recompute
    // Total Revenue from conversions × (rounded) conversionValue, or the UI will drift by cents
    // (exec-facing accuracy requirement).
    else {
      const hasImportedToDate = importedRevenueToDate > 0;
      const hasExplicitConversionValue = conversionValueSource === "connection" || conversionValueSource === "session";
      // PRIORITY 3: Explicit conversion value (connection or session) × conversions
      if (hasImportedToDate && !hasExplicitConversionValue) {
        totalRevenue = importedRevenueToDate;
      } else if (conversionValue > 0) {
        totalRevenue = conversionsTotal * conversionValue;
      }
      // PRIORITY 4: Imported revenue fallback
      else {
        totalRevenue = importedRevenueToDate;
      }
    }
  }
  totalRevenue = Number(Number(totalRevenue || 0).toFixed(2));

  return {
    hasRevenueTracking,
    totalRevenue,
    conversionValue,
    conversionValueSource: finalConversionValueSource,
    importedRevenueToDate,
    windowStartDate: startDate,
    windowEndDate: endDate,
    webhookEventCount,
    webhookRevenueUsed,
  };
}

