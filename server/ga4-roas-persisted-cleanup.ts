import { fileURLToPath } from "url";
import { resolve } from "path";
import { eq, and } from "drizzle-orm";
import { db, pool } from "./db";
import { storage } from "./storage";
import {
  benchmarkHistory,
  ga4Connections,
  kpiProgress,
} from "@shared/schema";
import { computeBenchmarkRating, computeBenchmarkVariance } from "./ga4-kpi-benchmark-jobs";

type CleanupMode = "dry-run" | "apply";

type CleanupOptions = {
  mode: CleanupMode;
  campaignId?: string;
};

type CleanupChange = {
  kind: string;
  id: string;
  campaignId: string;
  recordedDate?: string;
  oldValue: number;
  newValue: number;
};

type CleanupSkip = {
  kind: string;
  id?: string;
  campaignId: string;
  reason: string;
};

type CleanupResult = {
  mode: CleanupMode;
  changed: CleanupChange[];
  skipped: CleanupSkip[];
};

const AUTO_GA4_DAILY_NOTE = /^auto:ga4_daily:(\d{4}-\d{2}-\d{2})$/;

const round2 = (n: number) => Number((Number.isFinite(n) ? n : 0).toFixed(2));

const parseNumber = (raw: unknown): number => {
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const extractAutoGa4DailyDate = (notes: unknown): string | null => {
  const match = String(notes || "").trim().match(AUTO_GA4_DAILY_NOTE);
  return match?.[1] || null;
};

export const isGa4RoasRecord = (row: { platformType?: unknown; metric?: unknown; name?: unknown }) => {
  const platform = String(row.platformType || "").trim().toLowerCase();
  const metric = String(row.metric || row.name || "").trim().toLowerCase();
  return platform === "google_analytics" && metric === "roas";
};

export const computePersistedRoasRatio = (revenue: number, spend: number) => {
  return round2(spend > 0 ? revenue / spend : 0);
};

const isoDateUTC = (date: Date) => date.toISOString().slice(0, 10);

const campaignStartDate = (campaign: any) => {
  const raw = campaign?.startDate || campaign?.createdAt || null;
  if (!raw) return "2000-01-01";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "2000-01-01";
  return isoDateUTC(date);
};

async function getActivePropertyIds(campaignId: string): Promise<string[]> {
  const rows = await db
    .select({ propertyId: ga4Connections.propertyId })
    .from(ga4Connections)
    .where(and(eq(ga4Connections.campaignId, campaignId), eq(ga4Connections.isActive, true)));
  return Array.from(new Set((rows as any[]).map((r) => String(r.propertyId || "").trim()).filter(Boolean)));
}

async function getPersistedRoasForDate(campaign: any, propertyId: string, date: string) {
  const campaignId = String(campaign?.id || "");
  const startDate = campaignStartDate(campaign);
  const daily = await storage.getGA4DailyMetrics(campaignId, propertyId, startDate, date);
  const ga4Revenue = (Array.isArray(daily) ? daily : []).reduce(
    (sum, row: any) => sum + parseNumber(row?.revenue),
    0
  );
  const importedRevenue = await storage.getRevenueTotalForRange(campaignId, "2000-01-01", date, "ga4");
  const spend = await storage.getSpendTotalForRange(campaignId, "2000-01-01", date);
  const totalRevenue = round2(ga4Revenue + parseNumber((importedRevenue as any)?.totalRevenue));
  const totalSpend = round2(parseNumber((spend as any)?.totalSpend));

  return {
    totalRevenue,
    totalSpend,
    roas: computePersistedRoasRatio(totalRevenue, totalSpend),
  };
}

async function latestPersistedDate(campaignId: string, propertyId: string): Promise<string | null> {
  const latest = await storage.getLatestGA4DailyMetric(campaignId, propertyId);
  return latest?.date ? String(latest.date) : null;
}

function hasChanged(oldValue: number, newValue: number) {
  return Math.abs(round2(oldValue) - round2(newValue)) >= 0.01;
}

function rollingAverage(rows: Array<{ value: number; recordedAt: Date }>, days: number, index: number) {
  const current = rows[index];
  const cutoff = new Date(current.recordedAt);
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
  cutoff.setUTCHours(0, 0, 0, 0);
  const values = rows
    .slice(0, index + 1)
    .filter((row) => row.recordedAt.getTime() >= cutoff.getTime() && row.recordedAt.getTime() <= current.recordedAt.getTime())
    .map((row) => row.value);
  const avg = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : current.value;
  return round2(avg);
}

function trendDirection(previous: number | null, next: number) {
  if (previous === null || !Number.isFinite(previous)) return "neutral";
  if (next > previous) return "up";
  if (next < previous) return "down";
  return "neutral";
}

export function buildKpiProgressRepairRows(
  rows: any[],
  repairedValuesById: Map<string, number>
) {
  const ordered = rows
    .map((row) => ({
      row,
      id: String(row?.id || ""),
      value: repairedValuesById.has(String(row?.id || ""))
        ? round2(Number(repairedValuesById.get(String(row?.id || ""))))
        : round2(parseNumber(row?.value)),
      recordedAt: row?.recordedAt ? new Date(row.recordedAt) : new Date(0),
    }))
    .filter((row) => row.id && Number.isFinite(row.recordedAt.getTime()))
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  return ordered
    .map((row, index) => {
      if (!repairedValuesById.has(row.id)) return null;
      const previous = index > 0 ? ordered[index - 1].value : null;
      return {
        id: row.id,
        value: round2(row.value),
        rollingAverage7d: rollingAverage(ordered, 7, index),
        rollingAverage30d: rollingAverage(ordered, 30, index),
        trendDirection: trendDirection(previous, row.value),
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      value: number;
      rollingAverage7d: number;
      rollingAverage30d: number;
      trendDirection: string;
    }>;
}

async function recordChange(
  result: CleanupResult,
  change: CleanupChange,
  apply: () => Promise<void>
) {
  if (!hasChanged(change.oldValue, change.newValue)) return;
  result.changed.push(change);
  if (result.mode === "apply") await apply();
}

async function repairKpiCurrentValues(result: CleanupResult, campaign: any, propertyId: string, date: string) {
  const campaignId = String(campaign.id);
  const roas = await getPersistedRoasForDate(campaign, propertyId, date);
  const rows = await storage.getPlatformKPIs("google_analytics", campaignId);
  for (const row of (Array.isArray(rows) ? rows : []).filter(isGa4RoasRecord)) {
    const id = String((row as any).id || "");
    const oldValue = parseNumber((row as any).currentValue);
    await recordChange(
      result,
      { kind: "kpi_current", id, campaignId, recordedDate: date, oldValue, newValue: roas.roas },
      async () => {
        await storage.updateKPI(id, { currentValue: String(roas.roas) } as any);
      }
    );
  }
}

async function repairBenchmarkCurrentValues(result: CleanupResult, campaign: any, propertyId: string, date: string) {
  const campaignId = String(campaign.id);
  const roas = await getPersistedRoasForDate(campaign, propertyId, date);
  const rows = await (storage as any).getPlatformBenchmarks("google_analytics", campaignId);
  for (const row of (Array.isArray(rows) ? rows : []).filter(isGa4RoasRecord)) {
    const id = String((row as any).id || "");
    const oldValue = parseNumber((row as any).currentValue);
    await recordChange(
      result,
      { kind: "benchmark_current", id, campaignId, recordedDate: date, oldValue, newValue: roas.roas },
      async () => {
        await storage.updateBenchmark(id, { currentValue: String(roas.roas) } as any);
      }
    );
  }
}

async function repairKpiProgress(result: CleanupResult, campaign: any, propertyId: string) {
  const campaignId = String(campaign.id);
  const rows = await storage.getPlatformKPIs("google_analytics", campaignId);
  for (const row of (Array.isArray(rows) ? rows : []).filter(isGa4RoasRecord)) {
    const kpiId = String((row as any).id || "");
    const progressRows = await storage.getKPIProgress(kpiId);
    const repairedValues = new Map<string, number>();

    for (const progress of Array.isArray(progressRows) ? progressRows : []) {
      const progressId = String((progress as any).id || "");
      const date = extractAutoGa4DailyDate((progress as any).notes);
      if (!date) {
        result.skipped.push({ kind: "kpi_progress", id: progressId, campaignId, reason: "Progress row is not a strict auto GA4 daily row." });
        continue;
      }
      const roas = await getPersistedRoasForDate(campaign, propertyId, date);
      repairedValues.set(progressId, roas.roas);
    }

    const repairRows = buildKpiProgressRepairRows(progressRows, repairedValues);
    for (const repair of repairRows) {
      const original = (progressRows as any[]).find((progress) => String(progress.id) === repair.id);
      if (!original) continue;
      const oldValue = parseNumber(original.value);
      await recordChange(
        result,
        { kind: "kpi_progress", id: repair.id, campaignId, recordedDate: extractAutoGa4DailyDate(original.notes) || undefined, oldValue, newValue: repair.value },
        async () => {
          await db
            .update(kpiProgress)
            .set({
              value: String(repair.value),
              rollingAverage7d: String(repair.rollingAverage7d),
              rollingAverage30d: String(repair.rollingAverage30d),
              trendDirection: repair.trendDirection,
            } as any)
            .where(eq(kpiProgress.id, repair.id));
        }
      );
    }
  }
}

async function repairBenchmarkHistory(result: CleanupResult, campaign: any, propertyId: string) {
  const campaignId = String(campaign.id);
  const rows = await (storage as any).getPlatformBenchmarks("google_analytics", campaignId);
  for (const row of (Array.isArray(rows) ? rows : []).filter(isGa4RoasRecord)) {
    const benchmarkId = String((row as any).id || "");
    const historyRows = await storage.getBenchmarkHistory(benchmarkId);
    for (const history of Array.isArray(historyRows) ? historyRows : []) {
      const historyId = String((history as any).id || "");
      const date = extractAutoGa4DailyDate((history as any).notes);
      if (!date) {
        result.skipped.push({ kind: "benchmark_history", id: historyId, campaignId, reason: "History row is not a strict auto GA4 daily row." });
        continue;
      }

      const roas = await getPersistedRoasForDate(campaign, propertyId, date);
      const oldValue = parseNumber((history as any).currentValue);
      const benchmarkValue = parseNumber((history as any).benchmarkValue);
      const variance = computeBenchmarkVariance("roas", roas.roas, benchmarkValue);
      const rating = computeBenchmarkRating(variance);

      await recordChange(
        result,
        { kind: "benchmark_history", id: historyId, campaignId, recordedDate: date, oldValue, newValue: roas.roas },
        async () => {
          await db
            .update(benchmarkHistory)
            .set({
              currentValue: String(roas.roas),
              variance: String(variance),
              performanceRating: rating,
            } as any)
            .where(eq(benchmarkHistory.id, historyId));
        }
      );
    }
  }
}

export async function cleanupGA4RoasPersistedValues(options: CleanupOptions): Promise<CleanupResult> {
  if (!db) throw new Error("DATABASE_URL is required to inspect or repair persisted GA4 ROAS values.");

  const result: CleanupResult = { mode: options.mode, changed: [], skipped: [] };
  const allCampaigns = options.campaignId
    ? [await storage.getCampaign(options.campaignId)].filter(Boolean)
    : await storage.getCampaigns();

  for (const campaign of allCampaigns as any[]) {
    const campaignId = String(campaign?.id || "");
    if (!campaignId) continue;

    const primary = await storage.getPrimaryGA4Connection(campaignId);
    if (!primary?.propertyId) {
      result.skipped.push({ kind: "current_values", campaignId, reason: "No active GA4 primary property." });
      continue;
    }

    const currentPropertyId = String(primary.propertyId);
    const currentDate = await latestPersistedDate(campaignId, currentPropertyId);
    if (!currentDate) {
      result.skipped.push({ kind: "current_values", campaignId, reason: "No persisted GA4 daily rows for the current primary property." });
    } else {
      await repairKpiCurrentValues(result, campaign, currentPropertyId, currentDate);
      await repairBenchmarkCurrentValues(result, campaign, currentPropertyId, currentDate);
    }

    const activePropertyIds = await getActivePropertyIds(campaignId);
    if (activePropertyIds.length !== 1) {
      result.skipped.push({
        kind: "historical_auto_rows",
        campaignId,
        reason: "Historical auto KPI/Benchmark rows do not store propertyId, and this campaign does not have exactly one active GA4 property.",
      });
      continue;
    }

    await repairKpiProgress(result, campaign, activePropertyIds[0]);
    await repairBenchmarkHistory(result, campaign, activePropertyIds[0]);
  }

  return result;
}

function parseArgs(argv: string[]): CleanupOptions {
  const campaignArg = argv.find((arg) => arg.startsWith("--campaign-id="));
  return {
    mode: argv.includes("--apply") ? "apply" : "dry-run",
    campaignId: campaignArg ? campaignArg.slice("--campaign-id=".length).trim() || undefined : undefined,
  };
}

function printResult(result: CleanupResult) {
  console.log(`[GA4 ROAS cleanup] mode=${result.mode}`);
  console.log(`[GA4 ROAS cleanup] changes=${result.changed.length}`);
  for (const change of result.changed) {
    console.log(`${change.kind} ${change.id} campaign=${change.campaignId} date=${change.recordedDate || "current"} ${change.oldValue} -> ${change.newValue}`);
  }
  console.log(`[GA4 ROAS cleanup] skipped=${result.skipped.length}`);
  for (const skip of result.skipped) {
    console.log(`${skip.kind} campaign=${skip.campaignId}${skip.id ? ` id=${skip.id}` : ""}: ${skip.reason}`);
  }
  if (result.mode === "dry-run") {
    console.log("[GA4 ROAS cleanup] Dry run only. Re-run with --apply after reviewing the inventory.");
  }
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : "";

if (invokedFile && resolve(currentFile) === invokedFile) {
  cleanupGA4RoasPersistedValues(parseArgs(process.argv.slice(2)))
    .then(printResult)
    .catch((error) => {
      console.error("[GA4 ROAS cleanup] Failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool?.end();
    });
}
