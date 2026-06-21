import { storage } from "./storage";
import { ga4Service } from "./analytics";
import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { checkPerformanceAlerts } from "./kpi-scheduler";
import { checkBenchmarkPerformanceAlerts } from "./benchmark-notifications";
import { getLatestCompleteReportingDate, normalizeReportingTimeZone } from "./utils/reporting-timezone";

type CampaignFilter = string | string[] | undefined;
type GA4DailySchedulerConfig = {
  reportingTimeZone: string;
  hour: number;
  minute: number;
  runOnStartup: boolean;
};

const parseBoundedInt = (value: any, fallback: number, min: number, max: number) => {
  const parsed = parseInt(String(value ?? ""), 10);
  const n = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(Math.max(n, min), max);
};

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

const getZonedParts = (date: Date, reportingTimeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: reportingTimeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour),
    minute: Number(byType.minute),
    second: Number(byType.second),
  };
};

const getTimeZoneOffsetMs = (date: Date, reportingTimeZone: string) => {
  const p = getZonedParts(date, reportingTimeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
};

const zonedDateTimeToUTC = (reportingTimeZone: string, year: number, month: number, day: number, hour: number, minute: number) => {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const first = new Date(utcGuess.getTime() - getTimeZoneOffsetMs(utcGuess, reportingTimeZone));
  return new Date(utcGuess.getTime() - getTimeZoneOffsetMs(first, reportingTimeZone));
};

const addCalendarDays = (year: number, month: number, day: number, days: number) => {
  const d = new Date(Date.UTC(year, month - 1, day + days, 0, 0, 0, 0));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};

export function getGA4DailySchedulerConfig(env: NodeJS.ProcessEnv = process.env): GA4DailySchedulerConfig {
  const reportingTimeZone = normalizeReportingTimeZone(env.GA4_DAILY_REFRESH_TIME_ZONE || "UTC");
  const hour = parseBoundedInt(env.GA4_DAILY_REFRESH_HOUR, 3, 0, 23);
  const minute = parseBoundedInt(env.GA4_DAILY_REFRESH_MINUTE, 0, 0, 59);
  const runOnStartup = String(env.GA4_DAILY_REFRESH_RUN_ON_STARTUP ?? "true").toLowerCase() !== "false";
  return { reportingTimeZone, hour, minute, runOnStartup };
}

export function getNextGA4DailyRunAt(now = new Date(), config: GA4DailySchedulerConfig = getGA4DailySchedulerConfig()): Date {
  const tz = normalizeReportingTimeZone(config.reportingTimeZone);
  const nowParts = getZonedParts(now, tz);
  let target = zonedDateTimeToUTC(tz, nowParts.year, nowParts.month, nowParts.day, config.hour, config.minute);
  if (target.getTime() <= now.getTime()) {
    const nextDay = addCalendarDays(nowParts.year, nowParts.month, nowParts.day, 1);
    target = zonedDateTimeToUTC(tz, nextDay.year, nextDay.month, nextDay.day, config.hour, config.minute);
  }
  return target;
}

const formatSchedulerLocalTime = (date: Date, reportingTimeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: reportingTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);

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

async function runGA4DailyRefreshPipelineForTrigger(trigger: string): Promise<void> {
  if ((global as any).__ga4DailyRefreshInProgress) {
    console.log(`[GA4 Daily] Skipping ${trigger} pipeline (already in progress)`);
    return;
  }

  (global as any).__ga4DailyRefreshInProgress = true;
  const startedAt = Date.now();
  console.log(`[GA4 Daily] Pipeline starting (trigger=${trigger})`);
  try {
    await refreshAllGA4DailyMetrics();

    try {
      await runGA4DailyKPIAndBenchmarkJobs();
    } catch (e: any) {
      console.warn("[GA4 Daily] KPI/Benchmark recompute failed:", e?.message || e);
    }

    try {
      await checkPerformanceAlerts();
    } catch (e: any) {
      console.warn("[GA4 Daily] KPI alert check failed:", e?.message || e);
    }

    try {
      await checkBenchmarkPerformanceAlerts();
    } catch (e: any) {
      console.warn("[GA4 Daily] Benchmark alert check failed:", e?.message || e);
    }
  } finally {
    (global as any).__ga4DailyRefreshInProgress = false;
    console.log(`[GA4 Daily] Pipeline done (trigger=${trigger}, elapsedSeconds=${Math.round((Date.now() - startedAt) / 1000)})`);
  }
}

export async function runGA4DailyRefreshPipeline(): Promise<void> {
  await runGA4DailyRefreshPipelineForTrigger("manual");
}

/**
 * Start the GA4 daily refresh scheduler
 * Runs at the configured local reporting time, with an optional startup run.
 */
export function startGA4DailyScheduler(): void {
  if ((global as any).ga4DailySchedulerTimer || (global as any).ga4DailySchedulerInterval) {
    console.log("[GA4 Daily] Scheduler already running");
    return;
  }

  const config = getGA4DailySchedulerConfig();
  const scheduleNextRun = () => {
    const nextRunAt = getNextGA4DailyRunAt(new Date(), config);
    const delayMs = Math.max(1000, nextRunAt.getTime() - Date.now());
    console.log(`[GA4 Daily] Next scheduled run at ${nextRunAt.toISOString()} (${formatSchedulerLocalTime(nextRunAt, config.reportingTimeZone)}, timezone=${config.reportingTimeZone}, dataThroughDate=${getLatestCompleteReportingDate(config.reportingTimeZone, nextRunAt)})`);
    (global as any).ga4DailySchedulerTimer = setTimeout(() => {
      runGA4DailyRefreshPipelineForTrigger("scheduled").catch((e) => {
        console.warn("[GA4 Daily] Scheduled pipeline failed:", (e as any)?.message || e);
      }).finally(scheduleNextRun);
    }, delayMs);
  };

  console.log(`[GA4 Daily] Scheduler started (time=${String(config.hour).padStart(2, "0")}:${String(config.minute).padStart(2, "0")}, timezone=${config.reportingTimeZone}, startupRun=${config.runOnStartup})`);

  if (config.runOnStartup) {
    runGA4DailyRefreshPipelineForTrigger("startup").catch((e) => {
      console.warn("[GA4 Daily] Startup pipeline failed:", (e as any)?.message || e);
    });
  }

  scheduleNextRun();
}

export function stopGA4DailyScheduler(): void {
  if ((global as any).ga4DailySchedulerTimer) {
    clearTimeout((global as any).ga4DailySchedulerTimer);
    (global as any).ga4DailySchedulerTimer = null;
  }
  if ((global as any).ga4DailySchedulerInterval) {
    clearInterval((global as any).ga4DailySchedulerInterval);
    (global as any).ga4DailySchedulerInterval = null;
  }
  (global as any).__ga4DailyRefreshInProgress = false;
  console.log("[GA4 Daily] Scheduler stopped");
}


