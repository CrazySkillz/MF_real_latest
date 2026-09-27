import { storage } from "./storage";
import { GA4_CONVERSION_EVENTS_SNAPSHOT_VERSION, ga4Service } from "./analytics";
import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { checkGA4PerformanceAlertsForCampaign, checkPerformanceAlerts } from "./kpi-scheduler";
import { checkGA4BenchmarkPerformanceAlertsForCampaign, checkBenchmarkPerformanceAlerts } from "./benchmark-notifications";
import { GA4_OVERVIEW_LEGACY_IMPORT_START_DATE, getLatestCompleteReportingDate, getReportingDateWindow, normalizeReportingTimeZone } from "./utils/reporting-timezone";
import { createHash } from "crypto";
import { addGA4InsightsDateDays, normalizeGA4InsightsDailyMetricValues } from "../shared/ga4-insights";
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
  failureReasonsByCampaign?: Record<string, string[]>;
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
  totalSnapshotBootstrapRuns: 0,
  totalSkippedRuns: 0,
  lastRecomputeRecordedAt: null as Date | null,
  lastRecomputeEvidence: null as null | Record<string, string[]>,
  lastSnapshotBootstrapFailures: [] as Array<{ campaignIdHash: string; reason: string }>,
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
  if (result.campaignIdsFailed.includes(campaignId)) {
    const reason = result.failureReasonsByCampaign?.[campaignId]?.join(", ");
    return reason ? `GA4 daily refresh failed for the target campaign (${reason})` : "GA4 daily refresh failed for the target campaign";
  }
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

const getDateRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  for (let date: string | null = startDate; date && date <= endDate; date = addGA4InsightsDateDays(date, 1)) {
    dates.push(date);
  }
  return dates;
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
  const runOnStartup = false;
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

export async function refreshAllGA4DailyMetrics(opts: GA4DailyRefreshPipelineOptions = {}, now = new Date()): Promise<GA4DailyRefreshResult> {
  const campaignId = String(opts.campaignId || "").trim();
  const lookbackDays = Math.min(
    Math.max(parseInt(process.env.GA4_DAILY_LOOKBACK_DAYS || "90", 10) || 90, 7),
    365
  );

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
  const failureReasonsByCampaign: Record<string, string[]> = {};

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
        const configuredImportStartDate = String(connection?.importStartDate || "").trim();
        const storageStartDate = /^\d{4}-\d{2}-\d{2}$/.test(configuredImportStartDate)
          ? configuredImportStartDate > reportingWindow.startDate ? configuredImportStartDate : reportingWindow.startDate
          : reportingWindow.startDate;
        if (storageStartDate > reportingWindow.endDate) throw new Error("GA4 daily import starts after the completed-day window");
        const propertyId = String(connection.propertyId);
        const initialSeries = await withGA4DailyStage("daily_series", ga4Service.getTimeSeriesData(
          currentCampaignId,
          storage,
          storageStartDate,
          propertyId,
          campaignFilter,
          reportingWindow.endDate,
          String((c as any)?.currency || "").trim().toUpperCase(),
        ));
        const hasCampaignFilter = Array.isArray(campaignFilter)
          ? campaignFilter.length > 0
          : Boolean(String(campaignFilter || "").trim());
        const providerResult = hasCampaignFilter
          ? await (async () => {
              const refreshedConnection = await storage.getGA4Connection(currentCampaignId, propertyId);
              if (!refreshedConnection?.accessToken) throw new Error("GA4 access token is unavailable for daily presence verification");
              return withGA4DailyStage("daily_presence", ga4Service.getTrendsDailyPresenceWithToken(
                propertyId,
                String(refreshedConnection.accessToken),
                storageStartDate,
                reportingWindow.endDate,
                campaignFilter,
                String((c as any)?.currency || "").trim().toUpperCase(),
              ));
            })()
          : { dailyRows: initialSeries, presentDates: (Array.isArray(initialSeries) ? initialSeries : []).map((row: any) => String(row?.date || "")) };
        const rows = Array.isArray(providerResult.dailyRows) ? providerResult.dailyRows : [];
        const normalizedRows = rows.map((r: any) => normalizeGA4InsightsDailyMetricValues({
          campaignId: currentCampaignId,
          propertyId,
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
          row.date < storageStartDate ||
          row.date > reportingWindow.endDate
        )) throw new Error("GA4 returned a daily row outside the requested completed-day window");
        const rowsByDate = new Map(toUpsert.map((row: any) => [String(row.date), row]));
        if (rowsByDate.size !== toUpsert.length) throw new Error("GA4 returned duplicate daily rows");
        for (const presentDate of providerResult.presentDates) {
          if (!rowsByDate.has(String(presentDate))) {
            throw new Error("GA4 reported activity for a date without a complete daily metric row");
          }
        }
        const completeRows = getDateRange(storageStartDate, reportingWindow.endDate).map((date) => rowsByDate.get(date) || {
          campaignId: currentCampaignId,
          propertyId,
          date,
          users: 0,
          sessions: 0,
          engagedSessions: 0,
          pageviews: 0,
          conversions: 0,
          revenue: 0,
          engagementRate: 0,
          revenueMetric: null,
          isSimulated: false,
        });

        const overviewStartDate = /^\d{4}-\d{2}-\d{2}$/.test(configuredImportStartDate)
          ? configuredImportStartDate
          : GA4_OVERVIEW_LEGACY_IMPORT_START_DATE;
        let overviewSnapshot: any = undefined;
        if (hasCampaignFilter) {
          const [campaignBreakdown, landingPages, existingOverviewRows] = await Promise.all([
            withGA4DailyStage("overview_campaign_breakdown", ga4Service.getAcquisitionBreakdown(
              currentCampaignId, storage, overviewStartDate, propertyId, 10000, campaignFilter,
              reportingWindow.endDate, false, false, String((c as any)?.currency || "").trim().toUpperCase(), true,
            )),
            withGA4DailyStage("overview_landing_pages", ga4Service.getLandingPagesReport(
              currentCampaignId, storage, overviewStartDate, propertyId, 50, campaignFilter, reportingWindow.endDate,
            )),
            withGA4DailyStage("overview_daily_storage", storage.getGA4DailyMetrics(currentCampaignId, propertyId, overviewStartDate, reportingWindow.endDate)),
          ]);
          const overviewRowsByDate = new Map(
            (Array.isArray(existingOverviewRows) ? existingOverviewRows : []).map((row: any) => [String(row.date), row]),
          );
          for (const row of completeRows) overviewRowsByDate.set(String(row.date), row);
          const overviewRows = Array.from(overviewRowsByDate.values()).filter((row: any) =>
            String(row.date) >= overviewStartDate && String(row.date) <= reportingWindow.endDate
          );
          const expected = overviewRows.reduce((totals: any, row: any) => ({
            sessions: totals.sessions + Number(row?.sessions || 0),
            conversions: totals.conversions + Number(row?.conversions || 0),
            revenue: totals.revenue + Number(row?.revenue || 0),
          }), { sessions: 0, conversions: 0, revenue: 0 });
          const expectedDailyConversions = Object.fromEntries(overviewRows.map((row: any) => [
            String(row.date), Number(row?.conversions || 0),
          ]));
          const conversionEvents = await withGA4DailyStage("overview_conversion_events", ga4Service.getConversionEventsReport(
            currentCampaignId, storage, overviewStartDate, propertyId, 50, campaignFilter,
            reportingWindow.endDate, false, expectedDailyConversions,
          ));
          const campaignCurrency = String((c as any)?.currency || "").trim().toUpperCase();
          const verifiedOverviewCurrency = String(campaignBreakdown?.meta?.currencyCode || "").trim().toUpperCase();
          if (!/^[A-Z]{3}$/.test(campaignCurrency) || verifiedOverviewCurrency !== campaignCurrency) {
            throw Object.assign(new Error("GA4_CURRENCY_UNVERIFIED: GA4 Overview report currency is unverified"), {
              code: "GA4_CURRENCY_UNVERIFIED",
              ga4DailyStage: "overview_campaign_breakdown",
            });
          }
          // Daily revenue is stored at cent precision while GA4's aggregate can retain
          // more source precision. Permit only the maximum per-day quantization delta.
          const revenueRoundingTolerance = overviewRows.length * 0.005 + 1e-9;
          const breakdownTotals = campaignBreakdown?.totals || {};
          const eventTotals = conversionEvents?.totals || {};
          const eventConversionTotal = Number(eventTotals.conversions || 0);
          const eventConversionSource = String((conversionEvents as any)?._reconciliationSource || "unknown")
            .replace(/[^a-z0-9_]/gi, "_");
          const reconciliationMismatches = [
            Number(breakdownTotals.sessions || 0) !== expected.sessions ? "breakdown_sessions" : "",
            Number(breakdownTotals.conversions || 0) !== expected.conversions ? "breakdown_conversions" : "",
            Math.abs(Number(breakdownTotals.revenue || 0) - expected.revenue) > revenueRoundingTolerance ? "breakdown_revenue" : "",
            eventConversionTotal !== expected.conversions
              ? `event_conversions_${eventConversionSource}_${eventConversionTotal < expected.conversions ? "low" : "high"}`
              : "",
          ].filter(Boolean);
          if (reconciliationMismatches.length > 0) throw Object.assign(
            new Error(`GA4 Overview detail totals do not reconcile with scheduler daily facts: ${reconciliationMismatches.join("+")}`),
            { ga4DailyStage: "overview_reconciliation" },
          );
          overviewSnapshot = {
            windowStart: overviewStartDate,
            windowEnd: reportingWindow.endDate,
            campaignBreakdown,
            landingPages,
            conversionEvents,
          };
        }

        const res = await storage.replaceGA4DailyMetricsWindow(
          currentCampaignId,
          propertyId,
          storageStartDate,
          reportingWindow.endDate,
          completeRows as any,
          overviewSnapshot,
        );
        upserted += Number(res?.replaced || 0);
        propertyIdsProcessed.push(propertyId);
      } catch (e: any) {
        failed = true;
        propertyIdsFailed.push(String(connection.propertyId));
        const reason = getGA4DailyFailureReason(e);
        failureReasonsByCampaign[currentCampaignId] = Array.from(new Set([...(failureReasonsByCampaign[currentCampaignId] || []), reason]));
        console.warn(`[GA4 Daily] Refresh failed for campaign ${currentCampaignId}, property ${String(connection.propertyId)}:`, e?.message || e);
      }
    }
    if (failed) campaignIdsFailed.push(currentCampaignId);
    else campaignIdsProcessed.push(currentCampaignId);
  }

  console.log(`[GA4 Daily] Refresh done (campaignsProcessed=${campaignIdsProcessed.length}, campaignsFailed=${campaignIdsFailed.length}, rowsUpserted=${upserted})`);
  return { campaignIdsProcessed, campaignIdsSkipped, campaignIdsFailed, propertyIdsProcessed, propertyIdsFailed, rowsUpserted: upserted, reportingDatesByCampaign, failureReasonsByCampaign };
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
  else if (trigger === "snapshot_bootstrap") ga4DailySchedulerStatus.totalSnapshotBootstrapRuns += 1;
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
      for (const processedCampaignId of refreshResult.campaignIdsProcessed) {
        const providerCoverageThroughDate = refreshResult.reportingDatesByCampaign[processedCampaignId];
        if (!providerCoverageThroughDate) continue;
        try {
          await checkGA4PerformanceAlertsForCampaign(processedCampaignId, providerCoverageThroughDate);
          await checkGA4BenchmarkPerformanceAlertsForCampaign(processedCampaignId, providerCoverageThroughDate);
        } catch (e: any) {
          console.warn(`[GA4 Daily] Campaign-scoped alert check failed for ${processedCampaignId}:`, e?.message || e);
        }
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

const getGA4DailyFailureReason = (error: any) => {
  const stage = String(error?.ga4DailyStage || "unknown").replace(/[^a-z0-9_-]/gi, "_");
  const message = String(error?.message || error || "");
  const knownCode = [
    "TOKEN_EXPIRED", "NO_GA4_CONNECTION", "GA4_CURRENCY_UNVERIFIED",
    "GA4_API_PAGINATION_INCOMPLETE", "GA4_CONVERSION_EVENT_PROVIDER_VALUE_UNSAFE",
    "GA4_CONVERSION_EVENT_DAILY_RECONCILIATION_FAILED", "GA4_CONVERSION_EVENT_REVENUE_METRIC_MISMATCH",
    "GA4_CONVERSION_EVENT_LIMIT_EXCEEDED", "GA4_CONVERSION_EVENT_EXPECTED_DAILY_VALUES_UNSAFE",
  ].find((code) => message.includes(code));
  if (knownCode) return `${stage}:${knownCode}`;
  if (message.includes("do not reconcile")) {
    const mismatches = message.match(/facts:\s*([a-z_+]+)/i)?.[1];
    return `${stage}:GA4_OVERVIEW_RECONCILIATION_FAILED${mismatches ? `:${mismatches}` : ""}`;
  }
  const providerStatus = message.match(/\"status\"\s*:\s*\"([A-Z_]+)\"/i)?.[1];
  if (providerStatus) {
    const issue = /incompatib/i.test(message)
      ? "INCOMPATIBLE_FIELDS"
      : /not a valid metric/i.test(message)
        ? "INVALID_METRIC"
        : /not a valid dimension/i.test(message)
          ? "INVALID_DIMENSION"
          : "UNCLASSIFIED";
    const fields = [
      "eventName", "sessionCampaignName", "campaignName", "conversions", "keyEvents",
      "eventCount", "totalUsers", "totalRevenue", "purchaseRevenue", "startDate", "endDate",
    ].filter((field) => message.includes(field));
    return `${stage}:GA4_PROVIDER_${providerStatus.toUpperCase()}:${issue}${fields.length > 0 ? `:${fields.join("+")}` : ""}`;
  }
  return `${stage}:GA4_PROVIDER_REQUEST_FAILED`;
};

const withGA4DailyStage = async <T>(stage: string, operation: Promise<T>): Promise<T> => {
  try {
    return await operation;
  } catch (error: any) {
    error.ga4DailyStage = stage;
    throw error;
  }
};

type GA4DailyPipelineRunner = (trigger: string, opts?: GA4DailyRefreshPipelineOptions) => Promise<void>;

export async function backfillMissingGA4OverviewSnapshots(
  runPipeline: GA4DailyPipelineRunner = runGA4DailyRefreshPipelineForTrigger,
): Promise<string[]> {
  ga4DailySchedulerStatus.lastSnapshotBootstrapFailures = [];
  const campaigns = await storage.getCampaigns();
  const campaignIds: string[] = [];
  for (const campaign of campaigns) {
    const campaignId = String((campaign as any)?.id || "").trim();
    const campaignFilter = parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter);
    const hasCampaignFilter = Array.isArray(campaignFilter)
      ? campaignFilter.length > 0
      : Boolean(String(campaignFilter || "").trim());
    if (!campaignId || !hasCampaignFilter) continue;
    const connections = await storage.getGA4Connections(campaignId);
    const activeConnections = connections.filter((connection: any) =>
      connection?.isActive !== false && String(connection?.propertyId || "").trim()
    );
    let needsBootstrap = false;
    for (const connection of activeConnections) {
      const propertyId = String(connection.propertyId);
      const expectedStartDate = /^\d{4}-\d{2}-\d{2}$/.test(String(connection?.importStartDate || ""))
        ? String(connection.importStartDate)
        : GA4_OVERVIEW_LEGACY_IMPORT_START_DATE;
      const [snapshot, latestDaily] = await Promise.all([
        storage.getGA4OverviewSnapshot(campaignId, propertyId),
        storage.getLatestGA4DailyMetric(campaignId, propertyId),
      ]);
      const expectedCurrency = String((campaign as any)?.currency || "").trim().toUpperCase();
      const snapshotCurrency = String((snapshot as any)?.campaignBreakdown?.meta?.currencyCode || "").trim().toUpperCase();
      if (!snapshot || !latestDaily || String(snapshot.windowStart) !== expectedStartDate ||
          String(snapshot.windowEnd) !== String(latestDaily.date) ||
          String((snapshot as any)?.conversionEvents?.version || "") !== GA4_CONVERSION_EVENTS_SNAPSHOT_VERSION ||
          (/^[A-Z]{3}$/.test(expectedCurrency) && snapshotCurrency !== expectedCurrency)) {
        needsBootstrap = true;
        break;
      }
    }
    if (needsBootstrap) campaignIds.push(campaignId);
  }

  for (const campaignId of campaignIds) {
    try {
      await runPipeline("snapshot_bootstrap", { campaignId, suppressAlerts: true });
    } catch (error: any) {
      ga4DailySchedulerStatus.lastSnapshotBootstrapFailures.push({
        campaignIdHash: hashEvidenceIds([campaignId])[0],
        reason: String(error?.message || error || "GA4 snapshot bootstrap failed").slice(0, 300),
      });
      console.warn(`[GA4 Daily] Overview snapshot bootstrap failed for campaign ${campaignId}:`, error?.message || error);
    }
  }
  return campaignIds;
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
    totalSnapshotBootstrapRuns: ga4DailySchedulerStatus.totalSnapshotBootstrapRuns,
    totalSkippedRuns: ga4DailySchedulerStatus.totalSkippedRuns,
    lastRecomputeRecordedAt: toIsoOrNull(ga4DailySchedulerStatus.lastRecomputeRecordedAt),
    lastRecomputeEvidence: ga4DailySchedulerStatus.lastRecomputeEvidence,
    lastSnapshotBootstrapFailures: ga4DailySchedulerStatus.lastSnapshotBootstrapFailures,
  };
}

/**
 * Start the GA4 daily refresh scheduler
 * Runs only at the configured local reporting time.
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

  scheduleNextRun();
  void backfillMissingGA4OverviewSnapshots().then((campaignIds) => {
    if (campaignIds.length > 0) {
      console.log(`[GA4 Daily] Overview snapshot bootstrap attempted for ${campaignIds.length} campaign(s)`);
    }
  }).catch((error: any) => {
    console.warn("[GA4 Daily] Overview snapshot bootstrap discovery failed:", error?.message || error);
  });
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


