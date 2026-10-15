import {
  financialDailySnapshotInputSchema,
  type FinancialDailySnapshotInput,
} from "../../shared/schema";
import { getReportingDateEndAt } from "./reporting-timezone";

type FinancialSource = {
  id: string;
  sourceType: string;
  currency: string | null;
  mappingConfig: string | null;
};

type RevenueRecord = {
  revenueSourceId: string;
  revenue: unknown;
  currency: string | null;
  subCampaignUrn: string | null;
};

type SpendRecord = {
  spendSourceId: string;
  spend: unknown;
  currency: string | null;
};

export type MimosaasTrackingFinancialSnapshotBuildResult =
  | { ready: true; snapshot: FinancialDailySnapshotInput }
  | { ready: false; reasons: string[] };

const normalizedCurrency = (value: unknown) => String(value || "").trim().toUpperCase();
const normalizedType = (value: unknown) => String(value || "").trim().toLowerCase();

const sourceMapping = (source: FinancialSource): Record<string, any> | null => {
  try {
    return JSON.parse(String(source.mappingConfig || "{}"));
  } catch {
    return null;
  }
};

const exactDateSourceReadiness = (source: FinancialSource, reportingDayEnd: Date | null): "ready" | "pending" | "unsupported" => {
  const type = normalizedType(source.sourceType);
  const mapping = sourceMapping(source);
  const dateColumn = String(mapping?.storedDateColumn || mapping?.dateColumn || "").trim();
  if (!dateColumn) return "unsupported";
  if (type === "csv") return "ready";
  if (type !== "google_sheets") return "unsupported";
  const lastSyncedAt = new Date(String(mapping?.lastSyncedAt || ""));
  return reportingDayEnd && !Number.isNaN(lastSyncedAt.getTime()) && lastSyncedAt.getTime() >= reportingDayEnd.getTime()
    ? "ready"
    : "pending";
};

const money = (value: number) => Number(value.toFixed(2)).toFixed(2);
const nonnegativeNumber = (value: unknown): number | null => {
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export function buildMimosaasTrackingFinancialDailySnapshot(input: {
  campaignId: string;
  reportingDate: string;
  reportingTimeZone: string;
  currency: string;
  conversions: number;
  revenueSources: FinancialSource[];
  spendSources: FinancialSource[];
  revenueRecords: RevenueRecord[];
  spendRecords: SpendRecord[];
}): MimosaasTrackingFinancialSnapshotBuildResult {
  const reasons: string[] = [];
  const currency = normalizedCurrency(input.currency);
  const revenueSourceIds = Array.from(new Set(input.revenueSources.map((source) => String(source.id || "").trim()).filter(Boolean))).sort();
  const spendSourceIds = Array.from(new Set(input.spendSources.map((source) => String(source.id || "").trim()).filter(Boolean))).sort();
  const revenueSourceSet = new Set(revenueSourceIds);
  const spendSourceSet = new Set(spendSourceIds);
  const reportingDayEnd = getReportingDateEndAt(input.reportingDate, input.reportingTimeZone);
  const freshGoogleSheetsRevenueSourceIds = new Set<string>();
  const freshGoogleSheetsSpendSourceIds = new Set<string>();

  if (!/^[A-Z]{3}$/.test(currency)) reasons.push("campaign_currency_invalid");
  if (!Number.isInteger(input.conversions) || input.conversions < 0) reasons.push("tracker_conversions_invalid");
  if (revenueSourceIds.length !== input.revenueSources.length || spendSourceIds.length !== input.spendSources.length) {
    reasons.push("financial_source_identity_invalid");
  }
  if ([...input.revenueSources, ...input.spendSources]
    .some((source) => normalizedCurrency(source.currency) !== currency)) {
    reasons.push("financial_source_currency_mismatch");
  }
  for (const source of input.revenueSources) {
    const readiness = exactDateSourceReadiness(source, reportingDayEnd);
    if (readiness === "unsupported") reasons.push(`revenue_source_refresh_unsupported:${normalizedType(source.sourceType) || "unknown"}`);
    if (readiness === "pending") reasons.push(`revenue_source_refresh_pending:${normalizedType(source.sourceType) || "unknown"}`);
    if (readiness === "ready" && normalizedType(source.sourceType) === "google_sheets") freshGoogleSheetsRevenueSourceIds.add(String(source.id));
  }
  for (const source of input.spendSources) {
    const readiness = exactDateSourceReadiness(source, reportingDayEnd);
    if (readiness === "unsupported") reasons.push(`spend_source_refresh_unsupported:${normalizedType(source.sourceType) || "unknown"}`);
    if (readiness === "pending") reasons.push(`spend_source_refresh_pending:${normalizedType(source.sourceType) || "unknown"}`);
    if (readiness === "ready" && normalizedType(source.sourceType) === "google_sheets") freshGoogleSheetsSpendSourceIds.add(String(source.id));
  }
  if (reasons.some((reason) => reason.includes("_source_refresh_unsupported:") || reason.includes("_source_refresh_pending:"))) {
    return { ready: false, reasons: Array.from(new Set(reasons)) };
  }

  const revenueBySource = new Map<string, { aggregate: number; attributed: number; hasAggregate: boolean }>();
  const representedRevenueSources = new Set<string>(freshGoogleSheetsRevenueSourceIds);
  for (const record of input.revenueRecords) {
    const sourceId = String(record.revenueSourceId || "").trim();
    const value = nonnegativeNumber(record.revenue);
    if (!revenueSourceSet.has(sourceId)) reasons.push("revenue_record_source_mismatch");
    if (value === null) reasons.push("revenue_record_value_invalid");
    if (normalizedCurrency(record.currency) !== currency) reasons.push("revenue_record_currency_mismatch");
    if (!revenueSourceSet.has(sourceId) || value === null) continue;
    representedRevenueSources.add(sourceId);
    const current = revenueBySource.get(sourceId) || { aggregate: 0, attributed: 0, hasAggregate: false };
    if (String(record.subCampaignUrn || "").trim()) current.attributed += value;
    else {
      current.aggregate += value;
      current.hasAggregate = true;
    }
    revenueBySource.set(sourceId, current);
  }
  if (revenueSourceIds.some((sourceId) => !representedRevenueSources.has(sourceId))) {
    reasons.push("revenue_source_reporting_date_missing");
  }

  let spend = 0;
  const representedSpendSources = new Set<string>(freshGoogleSheetsSpendSourceIds);
  for (const record of input.spendRecords) {
    const sourceId = String(record.spendSourceId || "").trim();
    const value = nonnegativeNumber(record.spend);
    if (!spendSourceSet.has(sourceId)) reasons.push("spend_record_source_mismatch");
    if (value === null) reasons.push("spend_record_value_invalid");
    if (normalizedCurrency(record.currency) !== currency) reasons.push("spend_record_currency_mismatch");
    if (spendSourceSet.has(sourceId) && value !== null) {
      representedSpendSources.add(sourceId);
      spend += value;
    }
  }
  if (spendSourceIds.some((sourceId) => !representedSpendSources.has(sourceId))) {
    reasons.push("spend_source_reporting_date_missing");
  }

  if (reasons.length > 0) return { ready: false, reasons: Array.from(new Set(reasons)) };
  const revenue = Array.from(revenueBySource.values()).reduce(
    (sum, value) => sum + (value.hasAggregate ? value.aggregate : value.attributed),
    0,
  );
  const snapshot = financialDailySnapshotInputSchema.safeParse({
    version: "financial_daily_snapshot_v1",
    campaignId: input.campaignId,
    reportingDate: input.reportingDate,
    currency,
    currentValueWindow: {
      mode: "initial_import_to_latest_completed_day",
      startDate: input.reportingDate,
      endDate: input.reportingDate,
      dataThroughDate: input.reportingDate,
      reportingTimeZone: input.reportingTimeZone,
    },
    inputs: {
      revenue: revenueSourceIds.length > 0
        ? { value: money(revenue), available: true, sources: revenueSourceIds.map((id) => `revenue-source:${id}`) }
        : { value: null, available: false, sources: [] },
      spend: spendSourceIds.length > 0
        ? { value: money(spend), available: true, sources: spendSourceIds.map((id) => `spend-source:${id}`) }
        : { value: null, available: false, sources: [] },
      conversions: { value: input.conversions, available: true, sources: ["mimosaas_tracking"] },
    },
  });
  return snapshot.success
    ? { ready: true, snapshot: snapshot.data }
    : { ready: false, reasons: ["financial_snapshot_invalid"] };
}
