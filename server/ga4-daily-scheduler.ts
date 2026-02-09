import { storage } from "./storage";
import { ga4Service } from "./analytics";

type CampaignFilter = string | string[] | undefined;

const formatISODateUTC = (d: Date) => {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const parseGA4CampaignFilter = (raw: any): CampaignFilter => {
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw.map((v) => String(v || "").trim()).filter(Boolean);
  const s = String(raw || "").trim();
  if (!s) return undefined;
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v || "").trim()).filter(Boolean);
  } catch {
    // ignore
  }
  return s;
};

export async function refreshAllGA4DailyMetrics(): Promise<void> {
  const lookbackDays = Math.min(
    Math.max(parseInt(process.env.GA4_DAILY_LOOKBACK_DAYS || "90", 10) || 90, 7),
    365
  );

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (lookbackDays - 1));
  const startISO = formatISODateUTC(start);

  console.log(`[GA4 Daily] Refresh starting (lookbackDays=${lookbackDays}, start=${startISO})`);

  const campaigns = await storage.getCampaigns().catch(() => []);
  let processed = 0;
  let upserted = 0;

  for (const c of campaigns) {
    try {
      const conns = await storage.getGA4Connections(String((c as any)?.id || ""));
      const primary = conns.find((x: any) => x?.isPrimary) || conns[0];
      if (!primary?.propertyId) continue;

      const campaignFilter = parseGA4CampaignFilter((c as any)?.ga4CampaignFilter);

      const series = await ga4Service.getTimeSeriesData(
        String((c as any)?.id || ""),
        storage,
        startISO, // explicit start date
        String(primary.propertyId),
        campaignFilter
      );

      const rows = Array.isArray(series) ? series : [];
      if (rows.length === 0) continue;

      const toUpsert = rows
        .map((r: any) => ({
          campaignId: String((c as any)?.id || ""),
          propertyId: String(primary.propertyId),
          date: String(r?.date || "").trim(),
          users: Number(r?.users || 0) || 0,
          sessions: Number(r?.sessions || 0) || 0,
          pageviews: Number(r?.pageviews || 0) || 0,
          conversions: Number(r?.conversions || 0) || 0,
          revenue: String(Number(r?.revenue || 0).toFixed(2)),
          engagementRate: (r as any)?.engagementRate ?? null,
          revenueMetric: (r as any)?.revenueMetric ?? null,
          isSimulated: false,
        }))
        .filter((x: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || "")));

      const res = await storage.upsertGA4DailyMetrics(toUpsert as any);
      upserted += Number(res?.upserted || 0);
      processed += 1;
    } catch (e: any) {
      // Don't let one bad connection break the scheduler
      console.warn(`[GA4 Daily] Refresh failed for campaign ${(c as any)?.id}:`, e?.message || e);
    }
  }

  console.log(`[GA4 Daily] Refresh done (campaignsProcessed=${processed}, rowsUpserted=${upserted})`);
}

/**
 * Start the GA4 daily refresh scheduler
 * Runs daily (default: 24h interval), with an initial run deferred to avoid impacting deployment/startup.
 * Set GA4_DAILY_ENABLED=false to disable entirely (e.g. when OAuth tokens are expired).
 */
export function startGA4DailyScheduler(): void {
  if (String(process.env.GA4_DAILY_ENABLED ?? "true").toLowerCase() === "false") {
    console.log("[GA4 Daily] Scheduler disabled via GA4_DAILY_ENABLED=false");
    return;
  }
  if ((global as any).ga4DailySchedulerInterval) {
    console.log("[GA4 Daily] Scheduler already running");
    return;
  }

  const refreshIntervalHours = parseInt(process.env.GA4_DAILY_REFRESH_INTERVAL_HOURS || "24", 10);
  const refreshIntervalMs = Math.max(1, refreshIntervalHours) * 60 * 60 * 1000;

  console.log(`[GA4 Daily] Scheduler started (interval=${refreshIntervalHours}h)`);

  // Defer initial run by 60s so deployment/health checks complete first; never let errors crash the process
  const runSafe = () => refreshAllGA4DailyMetrics().catch((e: any) => console.warn("[GA4 Daily] Initial run error:", e?.message || e));
  setTimeout(runSafe, 60_000);

  (global as any).ga4DailySchedulerInterval = setInterval(() => {
    refreshAllGA4DailyMetrics().catch((e: any) => console.warn("[GA4 Daily] Interval run error:", e?.message || e));
  }, refreshIntervalMs);
}

export function stopGA4DailyScheduler(): void {
  if ((global as any).ga4DailySchedulerInterval) {
    clearInterval((global as any).ga4DailySchedulerInterval);
    (global as any).ga4DailySchedulerInterval = null;
    console.log("[GA4 Daily] Scheduler stopped");
  }
}


