import { z } from "zod";
import type { MetricSnapshot } from "../../shared/schema";
import { getExpectedDailyRefreshAt } from "./reporting-timezone";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const metricSchema = z.discriminatedUnion("available", [
  z.object({ value: z.number().finite(), available: z.literal(true), sources: z.array(z.string()) }).strict(),
  z.object({ value: z.null(), available: z.literal(false), sources: z.array(z.string()).length(0) }).strict(),
]);
const trackedMetricNames = ["users", "sessions", "conversions", "revenue", "spend", "cvr", "cpa", "roas", "roi"] as const;

export const executiveSummaryDailySnapshotInputSchema = z.object({
  version: z.literal("executive_summary_daily_snapshot_v2"),
  campaignId: z.string().trim().min(1),
  reportingDate: dateSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  ga4PropertyId: z.string().trim().min(1),
  ga4CampaignFilter: z.string(),
  performanceSummaryVersion: z.literal("performance_summary_aggregate_v3"),
  currentValueWindow: z.object({
    mode: z.literal("initial_import_to_latest_completed_day"),
    startDate: dateSchema,
    endDate: dateSchema,
    dataThroughDate: dateSchema,
    reportingTimeZone: z.string().trim().min(1),
  }).strict(),
  sourceSignature: z.array(z.string()).min(1),
  totals: z.object(Object.fromEntries(trackedMetricNames.map((name) => [name, metricSchema])) as Record<(typeof trackedMetricNames)[number], typeof metricSchema>).strict(),
}).strict().superRefine((snapshot, ctx) => {
  if (snapshot.currentValueWindow.startDate > snapshot.currentValueWindow.endDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["currentValueWindow", "startDate"], message: "Window start must not follow window end" });
  }
  if (snapshot.currentValueWindow.endDate !== snapshot.reportingDate || snapshot.currentValueWindow.dataThroughDate !== snapshot.reportingDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reportingDate"], message: "Reporting date must match the data-through window" });
  }
});

export type ExecutiveSummaryDailySnapshotInput = z.infer<typeof executiveSummaryDailySnapshotInputSchema>;

export function hasRefreshedGA4RowsForExecutiveSummarySnapshot(input: {
  reportingDate: string;
  reportingTimeZone: string;
  rows: Array<{ updatedAt?: Date | string | null }>;
}): boolean {
  const reportingDayClosedAt = getExpectedDailyRefreshAt(input.reportingDate, input.reportingTimeZone, 0, 0);
  if (!reportingDayClosedAt || !Array.isArray(input.rows) || input.rows.length === 0) return false;
  return input.rows.some((row) => {
    const updatedAt = row?.updatedAt instanceof Date ? row.updatedAt : new Date(String(row?.updatedAt || ""));
    return !Number.isNaN(updatedAt.getTime()) && updatedAt.getTime() >= reportingDayClosedAt.getTime();
  });
}

const normalizeMetric = (metric: any) => metric?.available === true && Number.isFinite(Number(metric?.value))
  ? { value: Number(metric.value), available: true as const, sources: Array.isArray(metric?.sources) ? metric.sources.map(String).sort() : [] }
  : { value: null, available: false as const, sources: [] as string[] };

export function buildExecutiveSummaryDailySnapshotInput(input: {
  campaignId: string;
  currency: string;
  ga4PropertyId: string;
  ga4CampaignFilter: unknown;
  performanceSummary: any;
  financialSourceIdentities?: { revenue: unknown[]; spend: unknown[] };
}): ExecutiveSummaryDailySnapshotInput {
  const summary = input.performanceSummary;
  const window = summary?.currentValueWindow;
  const explicitFinancialSignature = input.financialSourceIdentities
    ? [
        ...input.financialSourceIdentities.revenue.map((id) => `revenue_source:${String(id || "").trim()}`),
        ...input.financialSourceIdentities.spend.map((id) => `spend_source:${String(id || "").trim()}`),
      ].filter((identity) => !identity.endsWith(":"))
    : null;
  const summarySourceSignature = (Array.isArray(summary?.sources) ? summary.sources : [])
    .filter((source: any) => source?.connected === true)
    .filter((source: any) => explicitFinancialSignature === null || source?.category !== "financial")
    .map((source: any) => [
      String(source?.id || ""),
      String(source?.category || ""),
      ...(Array.isArray(source?.includedMetrics) ? source.includedMetrics.map(String).sort() : []),
    ].join(":"))
    .filter(Boolean)
    .sort();
  const sourceSignature = Array.from(new Set([
    ...summarySourceSignature,
    ...(explicitFinancialSignature || []),
  ])).sort();
  const totals = Object.fromEntries(trackedMetricNames.map((name) => [name, normalizeMetric(summary?.totals?.[name])])) as ExecutiveSummaryDailySnapshotInput["totals"];
  return executiveSummaryDailySnapshotInputSchema.parse({
    version: "executive_summary_daily_snapshot_v2",
    campaignId: String(input.campaignId || "").trim(),
    reportingDate: String(window?.endDate || ""),
    currency: String(input.currency || "").trim().toUpperCase(),
    ga4PropertyId: String(input.ga4PropertyId || "").replace(/^properties\//, "").trim(),
    ga4CampaignFilter: String(input.ga4CampaignFilter || "").trim(),
    performanceSummaryVersion: summary?.version,
    currentValueWindow: window,
    sourceSignature,
    totals,
  });
}

export function parseExecutiveSummaryDailySnapshot(snapshot: MetricSnapshot | null | undefined): ExecutiveSummaryDailySnapshotInput | null {
  const daily = (snapshot?.metrics as any)?.executiveSummaryDaily;
  if (!snapshot || !daily || snapshot.snapshotType !== "executive_summary_daily") return null;
  const parsed = executiveSummaryDailySnapshotInputSchema.safeParse({
    ...daily,
    campaignId: snapshot.campaignId,
    reportingDate: snapshot.reportingDate,
  });
  return parsed.success ? parsed.data : null;
}

const daysBetween = (later: string, earlier: string) =>
  (new Date(`${later}T00:00:00.000Z`).getTime() - new Date(`${earlier}T00:00:00.000Z`).getTime()) / 86400000;

export function evaluateExecutiveSummaryTrajectory(currentRow: MetricSnapshot | null, previousRow: MetricSnapshot | null) {
  const current = parseExecutiveSummaryDailySnapshot(currentRow);
  const previous = parseExecutiveSummaryDailySnapshot(previousRow);
  if (!current || !previous) return { available: false as const, trajectory: null, trendPercentage: null, reason: "not_enough_history" };
  const sameContract = current.campaignId === previous.campaignId
    && current.currency === previous.currency
    && current.ga4PropertyId === previous.ga4PropertyId
    && current.ga4CampaignFilter === previous.ga4CampaignFilter
    && current.performanceSummaryVersion === previous.performanceSummaryVersion
    && current.currentValueWindow.mode === previous.currentValueWindow.mode
    && current.currentValueWindow.startDate === previous.currentValueWindow.startDate
    && current.currentValueWindow.reportingTimeZone === previous.currentValueWindow.reportingTimeZone
    && JSON.stringify(current.sourceSignature) === JSON.stringify(previous.sourceSignature)
    && daysBetween(current.reportingDate, previous.reportingDate) === 7;
  if (!sameContract) return { available: false as const, trajectory: null, trendPercentage: null, reason: "incompatible_history" };
  const currentRevenue = current.totals.revenue;
  const previousRevenue = previous.totals.revenue;
  if (!currentRevenue.available || !previousRevenue.available || previousRevenue.value <= 0) {
    return { available: false as const, trajectory: null, trendPercentage: null, reason: "revenue_history_unavailable" };
  }
  const trendPercentage = ((currentRevenue.value - previousRevenue.value) / previousRevenue.value) * 100;
  const trajectory = trendPercentage > 10 ? "accelerating" : trendPercentage < -10 ? "declining" : "stable";
  return { available: true as const, trajectory, trendPercentage, reason: null };
}
