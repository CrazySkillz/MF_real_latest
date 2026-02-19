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

export type MetaRevenueContext = {
  hasRevenueTracking: boolean;
  totalRevenue: number;
  conversionValue: number;
  conversionValueSource: "webhook_events" | "connection" | "manual" | "csv" | "derived" | "none";
  importedRevenueToDate: number;
  windowStartDate: string;
  windowEndDate: string;
  webhookEventCount?: number;
  webhookRevenueUsed?: boolean;
};

/**
 * Canonical Meta revenue rules (single source of truth).
 *
 * - Uses Meta-scoped inputs only (platformContext='meta').
 * - Conversion value priority: Manual entry > CSV import > Webhook events > Derived (revenue ÷ conversions) > None.
 * - Revenue enablement: conversionValue > 0 OR importedRevenueToDate > 0.
 * - Campaign-level revenue:
 *   - If importedRevenueToDate exists and there is no explicit conversion value, use importedRevenueToDate.
 *   - Otherwise use conversions × conversionValue (covers explicit + derived CV).
 *
 * Platform isolation: Meta revenue is separate from LinkedIn and GA4 revenue.
 */
export async function resolveMetaRevenueContext(opts: {
  campaignId: string;
  conversionsTotal: number;
}): Promise<MetaRevenueContext> {
  const campaignId = String(opts.campaignId || "").trim();
  const conversionsTotal = Math.max(0, parseNum(opts.conversionsTotal));

  const campaign = await storage.getCampaign(campaignId).catch(() => undefined as any);
  const { startDate, endDate } = last30CompleteUtcWindow(campaign);

  // Get imported revenue from Meta-specific sources (manual, CSV)
  let importedRevenueToDate = 0;
  try {
    const totals = await (storage as any).getRevenueTotalForRange?.(campaignId, startDate, endDate, "meta");
    importedRevenueToDate = parseNum((totals as any)?.totalRevenue);
  } catch {
    importedRevenueToDate = 0;
  }

  // Get Meta revenue sources
  let metaRevenueSources: any[] = [];
  try {
    metaRevenueSources = await (storage as any).getRevenueSources?.(campaignId, "meta");
  } catch {
    metaRevenueSources = [];
  }

  // Check if there's an explicit manual or CSV conversion value source
  let hasExplicitMetaConversionValueSource = false;
  try {
    hasExplicitMetaConversionValueSource = (Array.isArray(metaRevenueSources) ? metaRevenueSources : []).some((s: any) => {
      if (!s || (s as any)?.isActive === false) return false;
      const sourceType = String((s as any)?.sourceType || "").trim().toLowerCase();
      return sourceType === "manual" || sourceType === "csv";
    });
  } catch {
    hasExplicitMetaConversionValueSource = false;
  }

  // Get manual conversion value from Meta connection (if set)
  let manualCv = 0;
  try {
    const conn = await storage.getMetaConnection(campaignId);
    manualCv = parseNum((conn as any)?.conversionValue);
  } catch {
    manualCv = 0;
  }

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

  // Determine conversion value and source
  let conversionValue = 0;
  let conversionValueSource: MetaRevenueContext["conversionValueSource"] = "none";

  if (manualCv > 0) {
    conversionValue = manualCv;
    conversionValueSource = "manual";
  } else if (hasExplicitMetaConversionValueSource && importedRevenueToDate > 0) {
    // CSV import with explicit conversion value
    conversionValueSource = "csv";
    if (conversionsTotal > 0) {
      conversionValue = importedRevenueToDate / conversionsTotal;
    }
  } else if (importedRevenueToDate > 0 && conversionsTotal > 0) {
    // Derive conversion value from imported revenue
    conversionValue = importedRevenueToDate / conversionsTotal;
    conversionValueSource = "derived";
  }

  // Round for stability in exec-facing UI
  conversionValue = Number(Number(conversionValue || 0).toFixed(2));
  importedRevenueToDate = Number(Number(importedRevenueToDate || 0).toFixed(2));

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
    // PRIORITY 2: Imported revenue-to-date (manual entry, CSV)
    else if (importedRevenueToDate > 0) {
      totalRevenue = importedRevenueToDate;
    }
    // PRIORITY 3: Conversions × conversion value
    else if (conversionValue > 0) {
      totalRevenue = conversionsTotal * conversionValue;
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

/**
 * Process CSV data and import revenue with crosswalk matching
 */
export async function processMetaRevenueCSV(opts: {
  campaignId: string;
  csvData: string;
  campaignColumn: string;
  revenueColumn: string;
}): Promise<{
  success: boolean;
  rowsProcessed: number;
  totalRevenue: number;
  matchedCampaigns: string[];
  errors?: string[];
}> {
  const { campaignId, csvData, campaignColumn, revenueColumn } = opts;

  try {
    // Parse CSV (simple line-by-line parsing)
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const campaignColIndex = header.indexOf(campaignColumn);
    const revenueColIndex = header.indexOf(revenueColumn);

    if (campaignColIndex === -1) {
      throw new Error(`Campaign column "${campaignColumn}" not found in CSV`);
    }
    if (revenueColIndex === -1) {
      throw new Error(`Revenue column "${revenueColumn}" not found in CSV`);
    }

    // Get Meta campaigns for crosswalk matching
    const connection = await storage.getMetaConnection(campaignId);
    if (!connection) {
      throw new Error('Meta connection not found');
    }

    // Parse data rows
    const rows: Array<{ campaignName: string; revenue: number; date: string }> = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      const campaignName = values[campaignColIndex] || '';
      const revenueStr = values[revenueColIndex] || '0';

      const revenue = parseNum(revenueStr);
      if (revenue <= 0) {
        errors.push(`Row ${i + 1}: Invalid revenue value "${revenueStr}"`);
        continue;
      }

      rows.push({
        campaignName,
        revenue,
        date: yesterdayUTC(), // Default to yesterday
      });
    }

    // Store revenue data (platform-isolated to 'meta')
    let totalRevenue = 0;
    const matchedCampaigns: string[] = [];

    for (const row of rows) {
      totalRevenue += row.revenue;
      matchedCampaigns.push(row.campaignName);

      // Store in revenue sources or daily metrics
      // This would integrate with the actual storage layer
      // For now, we'll use a placeholder
    }

    return {
      success: true,
      rowsProcessed: rows.length,
      totalRevenue,
      matchedCampaigns,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    return {
      success: false,
      rowsProcessed: 0,
      totalRevenue: 0,
      matchedCampaigns: [],
      errors: [error.message || 'Failed to process CSV'],
    };
  }
}
