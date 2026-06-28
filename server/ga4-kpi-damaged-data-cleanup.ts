import { fileURLToPath } from "url";
import { resolve } from "path";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "./db";
import { storage } from "./storage";
import { emailAlertEvents, kpis, notifications } from "@shared/schema";
import {
  computeKpiValue,
  getGA4KPIFinancialSourceWindow,
  isComputableGA4KpiMetric,
} from "./ga4-kpi-benchmark-jobs";
import {
  getLatestGA4KPIIdsByDuplicateKey,
  isLatestGA4KPIForDuplicateKey,
} from "./utils/ga4-kpi-alert-dedupe";

type CleanupMode = "dry-run" | "apply";
type CandidateKind = "financial_source_window_drift" | "duplicate_notification_state";
type SkipKind = "financial_source_window_drift" | "custom_zero_overwrite" | "duplicate_email_audit_state";

type SourceWindow = {
  oldStartDate?: string;
  oldEndDate?: string;
  newStartDate?: string;
  newEndDate?: string;
  propertyId?: string;
  latestGa4Date?: string;
  revenueSourceIds?: string[];
  spendSourceIds?: string[];
};

type CleanupCandidate = {
  kind: CandidateKind;
  id: string;
  kpiId?: string;
  campaignId?: string;
  metric?: string;
  oldValue?: number;
  newValue?: number;
  sourceWindow?: SourceWindow;
  reasonCode: string;
};

type CleanupSkip = {
  kind: SkipKind;
  id?: string;
  kpiId?: string;
  campaignId?: string;
  metric?: string;
  sourceWindow?: SourceWindow;
  reasonCode: string;
  reason: string;
};

type CleanupOptions = {
  mode: CleanupMode;
  campaignId?: string;
};

type CleanupResult = {
  mode: CleanupMode;
  candidates: CleanupCandidate[];
  skipped: CleanupSkip[];
  applied: number;
};

const OLD_FINANCIAL_SOURCE_START_DATE = "2000-01-01";
const FINANCIAL_KPI_METRICS = new Set(["revenue", "roas", "roi", "cpa"]);

const round2 = (value: number) => Number((Number.isFinite(value) ? value : 0).toFixed(2));
const parseNumber = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const differs = (a: number, b: number) => Math.abs(round2(a) - round2(b)) >= 0.01;
const matches = (a: number, b: number) => Math.abs(round2(a) - round2(b)) < 0.01;

const isoDateUTC = (value: Date) => value.toISOString().slice(0, 10);

const campaignStartDate = (campaign: any) => {
  const raw = campaign?.startDate || campaign?.createdAt || null;
  if (!raw) return OLD_FINANCIAL_SOURCE_START_DATE;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return OLD_FINANCIAL_SOURCE_START_DATE;
  return isoDateUTC(date);
};

export const normalizeKpiMetric = (row: any) => String(row?.metric || row?.name || "").trim().toLowerCase();
export const isFinancialSourceWindowKpi = (row: any) => FINANCIAL_KPI_METRICS.has(normalizeKpiMetric(row));
export const isUnprovenCustomZeroOverwrite = (row: any) => {
  const platform = String(row?.platformType || "").trim().toLowerCase();
  if (platform !== "google_analytics") return false;
  if (isComputableGA4KpiMetric(String(row?.metric || row?.name || ""))) return false;
  return matches(parseNumber(row?.currentValue), 0);
};

const parseMetadata = (value: unknown): Record<string, any> | null => {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, any>;
  try {
    return JSON.parse(String(value || "{}"));
  } catch {
    return null;
  }
};

async function getAllGA4Kpis(): Promise<any[]> {
  return await db
    .select()
    .from(kpis)
    .where(eq(kpis.platformType, "google_analytics"));
}

async function getCampaigns(options: CleanupOptions): Promise<any[]> {
  if (options.campaignId) {
    return [await storage.getCampaign(options.campaignId).catch(() => null)].filter(Boolean);
  }
  return await storage.getCampaigns().catch(() => []);
}

async function buildFinancialInputs(campaign: any, propertyId: string, date: string, financialStartDate: string, financialEndDate: string) {
  const campaignId = String(campaign?.id || "");
  const startDate = campaignStartDate(campaign);
  const rows = await storage.getGA4DailyMetrics(campaignId, propertyId, startDate, date).catch(() => [] as any[]);
  const nativeTotals = (Array.isArray(rows) ? rows : []).reduce((acc, row: any) => {
    acc.users += parseNumber(row?.users);
    acc.sessions += parseNumber(row?.sessions);
    acc.pageviews += parseNumber(row?.pageviews);
    acc.conversions += parseNumber(row?.conversions);
    acc.ga4Revenue += parseNumber(row?.revenue);
    acc.engagementRate = parseNumber(row?.engagementRate || acc.engagementRate);
    return acc;
  }, { users: 0, sessions: 0, pageviews: 0, conversions: 0, ga4Revenue: 0, engagementRate: 0 });

  const revenue = await storage.getRevenueTotalForRange(campaignId, financialStartDate, financialEndDate, "ga4").catch(() => ({ totalRevenue: 0, sourceIds: [] as string[] }));
  const spend = await storage.getSpendTotalForRange(campaignId, financialStartDate, financialEndDate).catch(() => ({ totalSpend: 0, sourceIds: [] as string[] }));

  return {
    inputs: {
      users: Math.round(nativeTotals.users || 0),
      sessions: Math.round(nativeTotals.sessions || 0),
      pageviews: Math.round(nativeTotals.pageviews || 0),
      conversions: Math.round(nativeTotals.conversions || 0),
      ga4Revenue: round2(nativeTotals.ga4Revenue || 0),
      importedRevenue: round2(parseNumber((revenue as any)?.totalRevenue)),
      spend: round2(parseNumber((spend as any)?.totalSpend)),
      engagementRate: parseNumber(nativeTotals.engagementRate),
    },
    revenueSourceIds: Array.isArray((revenue as any)?.sourceIds) ? (revenue as any).sourceIds.map(String) : [],
    spendSourceIds: Array.isArray((spend as any)?.sourceIds) ? (spend as any).sourceIds.map(String) : [],
  };
}

async function inspectFinancialSourceWindowDrift(result: CleanupResult, options: CleanupOptions) {
  const campaigns = await getCampaigns(options);
  const newWindow = getGA4KPIFinancialSourceWindow();

  for (const campaign of campaigns) {
    const campaignId = String(campaign?.id || "");
    if (!campaignId) continue;
    const rows = (await storage.getPlatformKPIs("google_analytics", campaignId).catch(() => [] as any[]))
      .filter(isFinancialSourceWindowKpi);
    if (rows.length === 0) continue;

    const primary = await (storage as any).getPrimaryGA4Connection(campaignId).catch(() => null as any);
    const propertyId = String(primary?.propertyId || "").trim();
    if (!propertyId) {
      for (const row of rows) {
        result.skipped.push({
          kind: "financial_source_window_drift",
          id: String(row?.id || ""),
          campaignId,
          metric: String(row?.metric || row?.name || ""),
          reasonCode: "financial_no_primary_property",
          reason: "No active primary GA4 property proves the source boundary.",
        });
      }
      continue;
    }

    if (String(primary?.method || "").trim().toLowerCase() === "access_token") {
      for (const row of rows) {
        result.skipped.push({
          kind: "financial_source_window_drift",
          id: String(row?.id || ""),
          campaignId,
          metric: String(row?.metric || row?.name || ""),
          sourceWindow: { propertyId },
          reasonCode: "financial_live_ga4_totals_not_local",
          reason: "The forward job may use live GA4 token totals, which this local cleanup script must not fetch or mutate from.",
        });
      }
      continue;
    }

    const latest = await storage.getLatestGA4DailyMetric(campaignId, propertyId).catch(() => null as any);
    const latestDate = String(latest?.date || "").trim();
    if (!latestDate) {
      for (const row of rows) {
        result.skipped.push({
          kind: "financial_source_window_drift",
          id: String(row?.id || ""),
          campaignId,
          metric: String(row?.metric || row?.name || ""),
          sourceWindow: { propertyId },
          reasonCode: "financial_no_persisted_ga4_daily_row",
          reason: "No persisted GA4 daily row proves the native metric date boundary.",
        });
      }
      continue;
    }

    const oldWindow = { startDate: OLD_FINANCIAL_SOURCE_START_DATE, endDate: latestDate };
    const oldData = await buildFinancialInputs(campaign, propertyId, latestDate, oldWindow.startDate, oldWindow.endDate);
    const newData = await buildFinancialInputs(campaign, propertyId, latestDate, newWindow.startDate, newWindow.endDate);

    for (const row of rows) {
      const id = String(row?.id || "");
      const metric = String(row?.metric || row?.name || "");
      const currentValue = round2(parseNumber(row?.currentValue));
      const oldValue = round2(computeKpiValue(metric, oldData.inputs));
      const newValue = round2(computeKpiValue(metric, newData.inputs));
      const sourceWindow = {
        oldStartDate: oldWindow.startDate,
        oldEndDate: oldWindow.endDate,
        newStartDate: newWindow.startDate,
        newEndDate: newWindow.endDate,
        propertyId,
        latestGa4Date: latestDate,
        revenueSourceIds: newData.revenueSourceIds,
        spendSourceIds: newData.spendSourceIds,
      };

      if (matches(currentValue, newValue)) continue;
      if (matches(currentValue, oldValue) && differs(oldValue, newValue)) {
        result.candidates.push({
          kind: "financial_source_window_drift",
          id,
          kpiId: id,
          campaignId,
          metric,
          oldValue,
          newValue,
          sourceWindow,
          reasonCode: "financial_matches_old_window",
        });
        if (result.mode === "apply") {
          await storage.updateKPI(id, { currentValue: String(newValue) } as any);
          result.applied += 1;
        }
        continue;
      }

      result.skipped.push({
        kind: "financial_source_window_drift",
        id,
        campaignId,
        metric,
        oldValue: undefined,
        newValue: undefined,
        sourceWindow,
        reasonCode: "financial_current_value_unproven",
        reason: `Current value ${currentValue} does not match the old formula (${oldValue}) or the new formula (${newValue}).`,
      } as CleanupSkip);
    }
  }
}

async function inspectCustomZeroOverwrites(result: CleanupResult, rows: any[]) {
  for (const row of rows) {
    if (!isUnprovenCustomZeroOverwrite(row)) continue;
    result.skipped.push({
      kind: "custom_zero_overwrite",
      id: String(row?.id || ""),
      kpiId: String(row?.id || ""),
      campaignId: String(row?.campaignId || ""),
      metric: String(row?.metric || row?.name || ""),
      reasonCode: "custom_zero_previous_value_unproven",
      reason: "The row is custom or unsupported and currently zero, but the prior user-entered value is not recoverable from local persisted state.",
    });
  }
}

async function inspectDuplicateAlertState(result: CleanupResult, rows: any[]) {
  const latestIdsByKey = getLatestGA4KPIIdsByDuplicateKey(rows);
  const supersededIds = rows
    .filter((row) => !isLatestGA4KPIForDuplicateKey(row, latestIdsByKey))
    .map((row) => String(row?.id || "").trim())
    .filter(Boolean);
  if (supersededIds.length === 0) return;

  const alertRows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.type, "performance-alert"));

  for (const alert of alertRows as any[]) {
    const meta = parseMetadata(alert?.metadata);
    const kpiId = String(meta?.kpiId || "").trim();
    if (!supersededIds.includes(kpiId)) continue;
    if (meta?.resolved || meta?.dismissedAt) continue;

    result.candidates.push({
      kind: "duplicate_notification_state",
      id: String(alert?.id || ""),
      kpiId,
      campaignId: String(alert?.campaignId || ""),
      reasonCode: "duplicate_notification_superseded_kpi",
    });
    if (result.mode === "apply") {
      await storage.updateNotification(String(alert.id), {
        read: true,
        metadata: JSON.stringify({
          ...meta,
          resolved: true,
          resolvedAt: new Date().toISOString(),
          resolvedReason: "superseded",
        }),
      } as any);
      result.applied += 1;
    }
  }

  const auditRows = await db
    .select()
    .from(emailAlertEvents)
    .where(and(
      eq(emailAlertEvents.kind, "alert"),
      eq(emailAlertEvents.entityType, "kpi"),
      inArray(emailAlertEvents.entityId, supersededIds),
    ));

  for (const audit of auditRows as any[]) {
    result.skipped.push({
      kind: "duplicate_email_audit_state",
      id: String(audit?.id || ""),
      kpiId: String(audit?.entityId || ""),
      campaignId: String(audit?.campaignId || ""),
      reasonCode: "duplicate_email_audit_retained",
      reason: "Email audit rows are immutable evidence; current retry/send paths suppress superseded GA4 KPI IDs instead of rewriting history.",
    });
  }
}

export async function inventoryGA4KPIDamagedData(options: CleanupOptions): Promise<CleanupResult> {
  if (!db) throw new Error("DATABASE_URL is required to inventory GA4 KPI damaged data.");
  const result: CleanupResult = { mode: options.mode, candidates: [], skipped: [], applied: 0 };
  const allGA4Kpis = await getAllGA4Kpis();

  await inspectFinancialSourceWindowDrift(result, options);
  await inspectCustomZeroOverwrites(result, allGA4Kpis);
  await inspectDuplicateAlertState(result, allGA4Kpis);

  return result;
}

export function parseArgs(argv: string[]): CleanupOptions {
  const campaignArg = argv.find((arg) => arg.startsWith("--campaign-id="));
  return {
    mode: argv.includes("--apply") ? "apply" : "dry-run",
    campaignId: campaignArg ? campaignArg.slice("--campaign-id=".length).trim() || undefined : undefined,
  };
}

export function printResult(result: CleanupResult) {
  const sampleRowIds = result.candidates.slice(0, 10).map((row) => `${row.kind}:${row.id}`);
  const sourceWindows = Array.from(new Set(result.candidates
    .map((row) => row.sourceWindow ? JSON.stringify(row.sourceWindow) : "")
    .filter(Boolean)));
  const reasonCodes = Array.from(new Set([
    ...result.candidates.map((row) => row.reasonCode),
    ...result.skipped.map((row) => row.reasonCode),
  ])).sort();

  console.log(`[GA4 KPI damaged-data inventory] mode=${result.mode}`);
  console.log(`[GA4 KPI damaged-data inventory] candidate count=${result.candidates.length}`);
  console.log(`[GA4 KPI damaged-data inventory] skipped count=${result.skipped.length}`);
  console.log(`[GA4 KPI damaged-data inventory] applied count=${result.applied}`);
  console.log(`[GA4 KPI damaged-data inventory] sample row IDs=${sampleRowIds.join(", ") || "none"}`);
  console.log(`[GA4 KPI damaged-data inventory] source windows=${sourceWindows.join(" | ") || "none"}`);
  console.log(`[GA4 KPI damaged-data inventory] reason codes=${reasonCodes.join(", ") || "none"}`);

  for (const row of result.candidates) {
    console.log(`${row.kind} id=${row.id} kpi=${row.kpiId || row.id} campaign=${row.campaignId || "none"} metric=${row.metric || "n/a"} ${row.oldValue ?? "n/a"} -> ${row.newValue ?? "n/a"} reason=${row.reasonCode}`);
  }
  for (const row of result.skipped) {
    console.log(`${row.kind} id=${row.id || "none"} kpi=${row.kpiId || "none"} campaign=${row.campaignId || "none"} metric=${row.metric || "n/a"} reason=${row.reasonCode}: ${row.reason}`);
  }
  if (result.mode === "dry-run") {
    console.log("[GA4 KPI damaged-data inventory] Dry run only. Re-run with --apply only after reviewing the candidate and skipped-row inventory.");
  }
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : "";

if (invokedFile && resolve(currentFile) === invokedFile) {
  inventoryGA4KPIDamagedData(parseArgs(process.argv.slice(2)))
    .then(printResult)
    .catch((error) => {
      console.error("[GA4 KPI damaged-data inventory] Failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool?.end();
    });
}