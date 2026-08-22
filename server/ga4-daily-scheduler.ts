import { storage } from "./storage";
import { ga4Service } from "./analytics";
import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { checkPerformanceAlerts } from "./kpi-scheduler";
import { checkBenchmarkPerformanceAlerts } from "./benchmark-notifications";
import { getLatestCompleteReportingDate, getReportingDateWindow, normalizeReportingTimeZone } from "./utils/reporting-timezone";
import { createHash } from "crypto";
import { normalizeGA4InsightsDailyMetricValues } from "../shared/ga4-insights";
import { beginFinancialDailySnapshotRefreshObservation, recordFinancialDailySnapshotRefreshEvidence } from "./utils/financial-daily-snapshot-observation";
import { writeFinancialDailySnapshotIfReady } from "./utils/financial-daily-snapshot-writer";

type CampaignFilter = string | string[] | undefined;
type GA4DailySchedulerConfig = {
  reportingTimeZone: string;
  hour: number;
  minute: number;
  runOnStartup: boolean;
};

type GA4DailyRunStatus = "idle" | "running" | "success" | "failed" | "skipped";
type GA4DailyRefreshPipelineOptions = {
  campaignId?: string;
  suppressAlerts?: boolean;
};
export type GA4DailyRefreshResult = {
  campaignIdsProcessed: string[];
  campaignIdsSkipped: string[];
  campaignIdsFailed: string[];
  propertyIdsProcessed: string[];
  propertyIdsFailed: string[];
  rowsUpserted: number;
  reportingDatesByCampaign: Record<string, string>;
};

const ga4DailySchedulerStatus = {
  startedAt: null as Date | null,
  stoppedAt: null as Date | null,
  config: null as GA4DailySchedulerConfig | null,
  nextRunAt: null as Date | null,
  nextDataThroughDate: null as string | null,
  lastRunStartedAt: null as Date | null,
  lastRunFinishedAt: null as Date | null,
  lastRunTrigger: null as string | null,
  lastRunStatus: "idle" as GA4DailyRunStatus,
  lastSkippedAt: null as Date | null,
  lastErrorTime: null as Date | null,
  lastError: null as string | null,
  totalRuns: 0,
  totalStartupRuns: 0,
  totalScheduledRuns: 0,
  totalManualRuns: 0,
  totalSkippedRuns: 0,
  lastRecomputeRecordedAt: null as Date | null,
  lastRecomputeEvidence: null as null | Record<string, string[]>,
};

const toIsoOrNull = (value: Date | null) => value ? value.toISOString() : null;
const hashEvidenceIds = (values: unknown[]) => values
  .map((value) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12))
  .sort();

type GA4DailyRecomputeResult = Awaited<ReturnType<typeof runGA4DailyKPIAndBenchmarkJobs>>;

export function getGA4DailyRecomputeFailure(
  result: Pick<GA4DailyRecomputeResult, "campaignsProcessed" | "campaignIdsFailed" | "kpiIdsFailed" | "benchmarkIdsFailed">,
  targetedCampaign: boolean,
): string | null {
  if (targetedCampaign && Number(result.campaignsProcessed || 0) <= 0) {
    return "GA4 KPI/Benchmark recompute skipped the target campaign";
  }
  const campaignFailures = result.campaignIdsFailed.length;
  const kpiFailures = result.kpiIdsFailed.length;
  const benchmarkFailures = result.benchmarkIdsFailed.length;
  if (campaignFailures === 0 && kpiFailures === 0 && benchmarkFailures === 0) return null;
  return `GA4 KPI/Benchmark recompute incomplete (${campaignFailures} campaign, ${kpiFailures} KPI, ${benchmarkFailures} Benchmark failures)`;
}

export function getGA4DailyRefreshFailure(result: GA4DailyRefreshResult, campaignId: string): string | null {
  if (!campaignId) {
    return result.campaignIdsFailed.length > 0
      ? `GA4 daily refresh failed for ${result.campaignIdsFailed.length} campaign(s)`
      : null;
  }
  if (result.campaignIdsFailed.includes(campaignId)) return "GA4 daily refresh failed for the target campaign";
  if (!result.campaignIdsProcessed.includes(campaignId)) return "GA4 daily refresh skipped the target campaign";
  return null;
}

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

export async function refreshAllGA4DailyMetrics(opts: GA4DailyRefreshPipelineOptions = {}): Promise<GA4DailyRefreshResult> {
  const campaignId = String(opts.campaignId || "").trim();
  const lookbackDays = Math.min(
    Math.max(parseInt(process.env.GA4_DAILY_LOOKBACK_DAYS || "90", 10) || 90, 7),
    365
  );

  const now = new Date();
  console.log(`[GA4 Daily] Refresh starting (lookbackDays=${lookbackDays}${campaignId ? `, campaignId=${campaignId}` : ""})`);

  const campaigns = campaignId
    ? [await storage.getCampaign(campaignId).catch(() => undefined)].filter(Boolean) as any[]
    : await storage.getCampaigns().catch(() => []);
  let upserted = 0;
  const campaignIdsProcessed: string[] = [];
  const campaignIdsSkipped: string[] = [];
  const campaignIdsFailed: string[] = [];
  const propertyIdsProcessed: string[] = [];
  const propertyIdsFailed: string[] = [];
  const reportingDatesByCampaign: Record<string, string> = {};

  for (const c of campaigns) {
    const currentCampaignId = String((c as any)?.id || "");
    const conns = await storage.getGA4Connections(currentCampaignId).catch(() => [] as any[]);
    const activeConnections = conns.filter((connection: any) =>
      connection?.isActive !== false && String(connection?.propertyId || "").trim()
    );
    if (activeConnections.length === 0) { campaignIdsSkipped.push(currentCampaignId); continue; }
    const campaignFilter = parseGA4CampaignFilter((c as any)?.ga4CampaignFilter);
    const reportingWindow = getReportingDateWindow(lookbackDays, (c as any)?.reportingTimeZone, now);
    reportingDatesByCampaign[currentCampaignId] = reportingWindow.endDate;
    let failed = false;
    for (const connection of activeConnections) {
      try {
        const series = await ga4Service.getTimeSeriesData(
          currentCampaignId,
          storage,
          reportingWindow.startDate,
          String(connection.propertyId),
          campaignFilter,
          reportingWindow.endDate,
        );
        const rows = Array.isArray(series) ? series : [];
        const normalizedRows = rows.map((r: any) => normalizeGA4InsightsDailyMetricValues({
          campaignId: currentCampaignId,
          propertyId: String(connection.propertyId),
          date: String(r?.date || "").trim(),
          users: r?.users,
          sessions: r?.sessions,
          engagedSessions: r?.engagedSessions,
          pageviews: r?.pageviews,
          conversions: r?.conversions,
          revenue: r?.revenue ?? 0,
          engagementRate: (r as any)?.engagementRate ?? null,
          revenueMetric: (r as any)?.revenueMetric ?? null,
          isSimulated: false,
        }));
        if (normalizedRows.some((row) => !row)) throw new Error("GA4 returned an invalid daily metric value");
        const toUpsert = normalizedRows as any[];
        if (toUpsert.some((row: any) =>
          !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || "")) ||
          row.date < reportingWindow.startDate ||
          row.date > reportingWindow.endDate
        )) throw new Error("GA4 returned a daily row outside the requested completed-day window");

        const res = await storage.replaceGA4DailyMetricsWindow(
          currentCampaignId,
          String(connection.propertyId),
          reportingWindow.startDate,
          reportingWindow.endDate,
          toUpsert as any,
        );
        upserted += Number(res?.replaced || 0);
        propertyIdsProcessed.push(String(connection.propertyId));
      } catch (e: any) {
        failed = true;
        propertyIdsFailed.push(String(connection.propertyId));
        console.warn(`[GA4 Daily] Refresh failed for campaign ${currentCampaignId}, property ${String(connection.propertyId)}:`, e?.message || e);
      }
    }
    if (failed) campaignIdsFailed.push(currentCampaignId);
    else campaignIdsProcessed.push(currentCampaignId);
  }

  console.log(`[GA4 Daily] Refresh done (campaignsProcessed=${campaignIdsProcessed.length}, campaignsFailed=${campaignIdsFailed.length}, rowsUpserted=${upserted})`);
  return { campaignIdsProcessed, campaignIdsSkipped, campaignIdsFailed, propertyIdsProcessed, propertyIdsFailed, rowsUpserted: upserted, reportingDatesByCampaign };
}

async function runGA4DailyRefreshPipelineForTrigger(trigger: string, opts: GA4DailyRefreshPipelineOptions = {}): Promise<void> {
  const campaignId = String(opts.campaignId || "").trim();
  if ((global as any).__ga4DailyRefreshInProgress) {
    ga4DailySchedulerStatus.totalSkippedRuns += 1;
    ga4DailySchedulerStatus.lastRunTrigger = trigger;
    ga4DailySchedulerStatus.lastRunStatus = "skipped";
    ga4DailySchedulerStatus.lastSkippedAt = new Date();
    console.log(`[GA4 Daily] Skipping ${trigger} pipeline (already in progress)`);
    return;
  }

  (global as any).__ga4DailyRefreshInProgress = true;
  beginFinancialDailySnapshotRefreshObservation("ga4_daily");
  const startedAtDate = new Date();
  const startedAt = Date.now();
  ga4DailySchedulerStatus.totalRuns += 1;
  if (trigger === "startup") ga4DailySchedulerStatus.totalStartupRuns += 1;
  else if (trigger === "scheduled") ga4DailySchedulerStatus.totalScheduledRuns += 1;
  else if (trigger === "manual") ga4DailySchedulerStatus.totalManualRuns += 1;
  ga4DailySchedulerStatus.lastRunStartedAt = startedAtDate;
  ga4DailySchedulerStatus.lastRunFinishedAt = null;
  ga4DailySchedulerStatus.lastRunTrigger = trigger;
  ga4DailySchedulerStatus.lastRunStatus = "running";
  console.log(`[GA4 Daily] Pipeline starting (trigger=${trigger}${campaignId ? `, campaignId=${campaignId}` : ""})`);
  try {
    const refreshResult = await refreshAllGA4DailyMetrics({ campaignId });
    const refreshFailure = getGA4DailyRefreshFailure(refreshResult, campaignId);
    if (campaignId && refreshFailure) throw new Error(refreshFailure);

    const recomputeResult = await runGA4DailyKPIAndBenchmarkJobs(campaignId
      ? { campaignId, suppressAlerts: true }
      : refreshFailure
        ? { campaignIds: refreshResult.campaignIdsProcessed, suppressAlerts: true }
        : undefined);
    ga4DailySchedulerStatus.lastRecomputeRecordedAt = new Date();
    ga4DailySchedulerStatus.lastRecomputeEvidence = {
      campaignIdsProcessed: hashEvidenceIds(recomputeResult.campaignIdsProcessed),
      campaignIdsSkipped: hashEvidenceIds(recomputeResult.campaignIdsSkipped),
      campaignIdsFailed: hashEvidenceIds(recomputeResult.campaignIdsFailed),
      kpiIdsUpdated: hashEvidenceIds(recomputeResult.kpiIdsUpdated),
      kpiIdsSkipped: hashEvidenceIds(recomputeResult.kpiIdsSkipped),
      kpiIdsFailed: hashEvidenceIds(recomputeResult.kpiIdsFailed),
      benchmarkIdsUpdated: hashEvidenceIds(recomputeResult.benchmarkIdsUpdated),
      benchmarkIdsSkipped: hashEvidenceIds(recomputeResult.benchmarkIdsSkipped),
      benchmarkIdsFailed: hashEvidenceIds(recomputeResult.benchmarkIdsFailed),
    };
    console.log(`[GA4 Daily] KPI/Benchmark recompute result ${JSON.stringify({
      campaignIdsProcessed: recomputeResult.campaignIdsProcessed,
      campaignIdsSkipped: recomputeResult.campaignIdsSkipped,
      campaignIdsFailed: recomputeResult.campaignIdsFailed,
      kpiIdsUpdated: recomputeResult.kpiIdsUpdated,
      kpiIdsSkipped: recomputeResult.kpiIdsSkipped,
      kpiIdsFailed: recomputeResult.kpiIdsFailed,
      benchmarkIdsUpdated: recomputeResult.benchmarkIdsUpdated,
      benchmarkIdsSkipped: recomputeResult.benchmarkIdsSkipped,
      benchmarkIdsFailed: recomputeResult.benchmarkIdsFailed,
    })}`);
    const recomputeFailure = getGA4DailyRecomputeFailure(recomputeResult, Boolean(campaignId));
    if (recomputeFailure) throw new Error(recomputeFailure);

    const completedAt = new Date().toISOString();
    const snapshotWriteFailures: string[] = [];
    for (const processedCampaignId of refreshResult.campaignIdsProcessed) {
      const reportingDate = refreshResult.reportingDatesByCampaign[processedCampaignId] || "";
      recordFinancialDailySnapshotRefreshEvidence("ga4_daily", {
        campaignId: processedCampaignId,
        reportingDate,
        status: "success",
        completedAt,
        failures: [],
      });
      try {
        const writeResult = await writeFinancialDailySnapshotIfReady({ campaignId: processedCampaignId, reportingDate });
        console.log(`[GA4 Daily] Financial snapshot ${writeResult.status} for campaign ${processedCampaignId}${writeResult.reasons.length > 0 ? ` (${writeResult.reasons.join(", ")})` : ""}`);
      } catch (error: any) {
        snapshotWriteFailures.push(processedCampaignId);
        console.warn(`[GA4 Daily] Financial snapshot write failed for campaign ${processedCampaignId}:`, error?.message || error);
      }
    }
    if (snapshotWriteFailures.length > 0) throw new Error(`Financial snapshot write failed for ${snapshotWriteFailures.length} campaign(s)`);
    if (refreshFailure) throw new Error(refreshFailure);

    if (!campaignId && !opts.suppressAlerts) {
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
    }
  } catch (e: any) {
    ga4DailySchedulerStatus.lastRunStatus = "failed";
    ga4DailySchedulerStatus.lastErrorTime = new Date();
    ga4DailySchedulerStatus.lastError = e?.message || String(e);
    throw e;
  } finally {
    (global as any).__ga4DailyRefreshInProgress = false;
    ga4DailySchedulerStatus.lastRunFinishedAt = new Date();
    if (ga4DailySchedulerStatus.lastRunStatus === "running") {
      ga4DailySchedulerStatus.lastRunStatus = "success";
      ga4DailySchedulerStatus.lastError = null;
    }
    console.log(`[GA4 Daily] Pipeline done (trigger=${trigger}, elapsedSeconds=${Math.round((Date.now() - startedAt) / 1000)})`);
  }
}

export async function runGA4DailyRefreshPipeline(opts: GA4DailyRefreshPipelineOptions = {}): Promise<void> {
  await runGA4DailyRefreshPipelineForTrigger("manual", opts);
}

export function getGA4DailySchedulerStatus() {
  const config = ga4DailySchedulerStatus.config || getGA4DailySchedulerConfig();
  return {
    started: Boolean(ga4DailySchedulerStatus.startedAt),
    timerScheduled: Boolean((global as any).ga4DailySchedulerTimer),
    inProgress: Boolean((global as any).__ga4DailyRefreshInProgress),
    config,
    startedAt: toIsoOrNull(ga4DailySchedulerStatus.startedAt),
    stoppedAt: toIsoOrNull(ga4DailySchedulerStatus.stoppedAt),
    nextRunAt: toIsoOrNull(ga4DailySchedulerStatus.nextRunAt),
    nextDataThroughDate: ga4DailySchedulerStatus.nextDataThroughDate,
    lastRunStartedAt: toIsoOrNull(ga4DailySchedulerStatus.lastRunStartedAt),
    lastRunFinishedAt: toIsoOrNull(ga4DailySchedulerStatus.lastRunFinishedAt),
    lastRunTrigger: ga4DailySchedulerStatus.lastRunTrigger,
    lastRunStatus: ga4DailySchedulerStatus.lastRunStatus,
    lastSkippedAt: toIsoOrNull(ga4DailySchedulerStatus.lastSkippedAt),
    lastErrorTime: toIsoOrNull(ga4DailySchedulerStatus.lastErrorTime),
    lastError: ga4DailySchedulerStatus.lastError,
    totalRuns: ga4DailySchedulerStatus.totalRuns,
    totalStartupRuns: ga4DailySchedulerStatus.totalStartupRuns,
    totalScheduledRuns: ga4DailySchedulerStatus.totalScheduledRuns,
    totalManualRuns: ga4DailySchedulerStatus.totalManualRuns,
    totalSkippedRuns: ga4DailySchedulerStatus.totalSkippedRuns,
    lastRecomputeRecordedAt: toIsoOrNull(ga4DailySchedulerStatus.lastRecomputeRecordedAt),
    lastRecomputeEvidence: ga4DailySchedulerStatus.lastRecomputeEvidence,
  };
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
  ga4DailySchedulerStatus.startedAt = new Date();
  ga4DailySchedulerStatus.stoppedAt = null;
  ga4DailySchedulerStatus.config = config;
  const scheduleNextRun = () => {
    const nextRunAt = getNextGA4DailyRunAt(new Date(), config);
    const dataThroughDate = getLatestCompleteReportingDate(config.reportingTimeZone, nextRunAt);
    const delayMs = Math.max(1000, nextRunAt.getTime() - Date.now());
    ga4DailySchedulerStatus.nextRunAt = nextRunAt;
    ga4DailySchedulerStatus.nextDataThroughDate = dataThroughDate;
    console.log(`[GA4 Daily] Next scheduled run at ${nextRunAt.toISOString()} (${formatSchedulerLocalTime(nextRunAt, config.reportingTimeZone)}, timezone=${config.reportingTimeZone}, dataThroughDate=${dataThroughDate})`);
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
  ga4DailySchedulerStatus.stoppedAt = new Date();
  ga4DailySchedulerStatus.nextRunAt = null;
  ga4DailySchedulerStatus.nextDataThroughDate = null;
  console.log("[GA4 Daily] Scheduler stopped");
}


