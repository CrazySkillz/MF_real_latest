import {
  financialDailySnapshotInputSchema,
  type MetricSnapshot,
  type MimosaasTrackingDailyMetric,
} from "../../shared/schema";

type FinancialSource = { id: string; currency: string | null };

export type MimosaasTrackingPublicationSourceStates = {
  version: "mimosaas_tracking_publication_sources_v1";
  websiteMetrics: { status: "available" | "pending"; dailyMetricId: string | null };
  revenue: { status: "available" | "unavailable" | "pending"; sourceIds: string[] };
  spend: { status: "available" | "unavailable" | "pending"; sourceIds: string[] };
  financialSnapshot: { status: "available" | "not_required" | "pending"; id: string | null };
};

export type MimosaasTrackingDailySnapshotValues = {
  campaignId: string;
  reportingDate: string;
  reportingTimeZone: string;
  users: number;
  sessions: number;
  engagedSessions: number;
  pageviews: number;
  conversions: number;
  engagementRate: string;
  conversionRate: string;
  revenue: string | null;
  spend: string | null;
  currency: string;
  revenueStatus: "available" | "unavailable";
  spendStatus: "available" | "unavailable";
  sourceStates: MimosaasTrackingPublicationSourceStates;
  financialSnapshotId: string | null;
};

export type MimosaasTrackingPublicationBuildResult =
  | { ready: true; values: MimosaasTrackingDailySnapshotValues }
  | { ready: false; reasons: string[]; sourceStates: MimosaasTrackingPublicationSourceStates };

const sourceIds = (sources: FinancialSource[]) => Array.from(new Set(
  sources.map((source) => String(source.id || "").trim()).filter(Boolean),
)).sort();

const exactSources = (actual: string[], expected: string[]) =>
  actual.length === expected.length && actual.every((value, index) => value === expected[index]);

const rate = (numerator: number, denominator: number) =>
  (denominator > 0 ? (numerator / denominator) * 100 : 0).toFixed(4);

export function buildMimosaasTrackingDailySnapshot(input: {
  campaignId: string;
  reportingDate: string;
  reportingTimeZone: string;
  currency: string;
  metrics: MimosaasTrackingDailyMetric | null;
  revenueSources: FinancialSource[];
  spendSources: FinancialSource[];
  financialSnapshot: MetricSnapshot | null;
}): MimosaasTrackingPublicationBuildResult {
  const reasons: string[] = [];
  const revenueSourceIds = sourceIds(input.revenueSources);
  const spendSourceIds = sourceIds(input.spendSources);
  const financialRequired = revenueSourceIds.length > 0 || spendSourceIds.length > 0;
  const sourceStates: MimosaasTrackingPublicationSourceStates = {
    version: "mimosaas_tracking_publication_sources_v1",
    websiteMetrics: {
      status: input.metrics ? "available" : "pending",
      dailyMetricId: input.metrics ? String(input.metrics.id) : null,
    },
    revenue: {
      status: revenueSourceIds.length === 0 ? "unavailable" : "pending",
      sourceIds: revenueSourceIds,
    },
    spend: {
      status: spendSourceIds.length === 0 ? "unavailable" : "pending",
      sourceIds: spendSourceIds,
    },
    financialSnapshot: {
      status: financialRequired ? "pending" : "not_required",
      id: null,
    },
  };

  if (!input.metrics) reasons.push("website_metrics_pending");
  if (input.metrics && (input.metrics.campaignId !== input.campaignId
    || input.metrics.reportingDate !== input.reportingDate
    || input.metrics.reportingTimeZone !== input.reportingTimeZone)) {
    reasons.push("website_metrics_scope_mismatch");
  }
  if (input.metrics && ([input.metrics.users, input.metrics.sessions, input.metrics.engagedSessions, input.metrics.pageviews, input.metrics.conversions]
    .some((value) => !Number.isInteger(value) || value < 0) || input.metrics.engagedSessions > input.metrics.sessions)) {
    reasons.push("website_metrics_invalid");
  }

  const currency = String(input.currency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) reasons.push("campaign_currency_invalid");
  if ([...input.revenueSources, ...input.spendSources].some((source) => String(source.currency || "").trim().toUpperCase() !== currency)) {
    reasons.push("financial_source_currency_mismatch");
  }
  if (financialRequired && !input.financialSnapshot) reasons.push("financial_snapshot_pending");
  if (!financialRequired && input.financialSnapshot) reasons.push("financial_snapshot_unexpected");

  const rawFinancial = (input.financialSnapshot?.metrics as any)?.financialDaily;
  const parsedFinancial = input.financialSnapshot ? financialDailySnapshotInputSchema.safeParse({
    ...rawFinancial,
    campaignId: input.financialSnapshot.campaignId,
    reportingDate: input.financialSnapshot.reportingDate,
  }) : null;
  if (input.financialSnapshot && (input.financialSnapshot.snapshotType !== "financial_daily" || !parsedFinancial?.success)) {
    reasons.push("financial_snapshot_invalid");
  }
  const financial = parsedFinancial?.success ? parsedFinancial.data : null;
  if (financial && (financial.campaignId !== input.campaignId
    || financial.reportingDate !== input.reportingDate
    || financial.currentValueWindow.startDate !== input.reportingDate
    || financial.currentValueWindow.reportingTimeZone !== input.reportingTimeZone
    || financial.currency !== currency)) {
    reasons.push("financial_snapshot_scope_mismatch");
  }

  if (financial) {
    const expectedRevenueSources = revenueSourceIds.map((id) => `revenue-source:${id}`);
    const expectedSpendSources = spendSourceIds.map((id) => `spend-source:${id}`);
    const actualRevenueSources = [...financial.inputs.revenue.sources].sort();
    const actualSpendSources = [...financial.inputs.spend.sources].sort();
    if (revenueSourceIds.length > 0
      ? !financial.inputs.revenue.available || !exactSources(actualRevenueSources, expectedRevenueSources)
      : financial.inputs.revenue.available || actualRevenueSources.length > 0) {
      reasons.push("revenue_snapshot_sources_mismatch");
    }
    if (spendSourceIds.length > 0
      ? !financial.inputs.spend.available || !exactSources(actualSpendSources, expectedSpendSources)
      : financial.inputs.spend.available || actualSpendSources.length > 0) {
      reasons.push("spend_snapshot_sources_mismatch");
    }
    if (!input.metrics || !financial.inputs.conversions.available
      || financial.inputs.conversions.value !== input.metrics.conversions
      || !exactSources([...financial.inputs.conversions.sources].sort(), ["mimosaas_tracking"])) {
      reasons.push("conversion_snapshot_authority_mismatch");
    }
  }

  if (reasons.length > 0 || !input.metrics) return { ready: false, reasons: Array.from(new Set(reasons)), sourceStates };
  if (revenueSourceIds.length > 0) sourceStates.revenue.status = "available";
  if (spendSourceIds.length > 0) sourceStates.spend.status = "available";
  if (financialRequired) {
    sourceStates.financialSnapshot = { status: "available", id: String(input.financialSnapshot!.id) };
  }
  const engagementRate = rate(input.metrics.engagedSessions, input.metrics.sessions);
  const conversionRate = rate(input.metrics.conversions, input.metrics.sessions);
  if (Number(conversionRate) > 999.9999) {
    return { ready: false, reasons: ["conversion_rate_out_of_range"], sourceStates };
  }

  return {
    ready: true,
    values: {
      campaignId: input.campaignId,
      reportingDate: input.reportingDate,
      reportingTimeZone: input.reportingTimeZone,
      users: input.metrics.users,
      sessions: input.metrics.sessions,
      engagedSessions: input.metrics.engagedSessions,
      pageviews: input.metrics.pageviews,
      conversions: input.metrics.conversions,
      engagementRate,
      conversionRate,
      revenue: financial?.inputs.revenue.available ? financial.inputs.revenue.value : null,
      spend: financial?.inputs.spend.available ? financial.inputs.spend.value : null,
      currency,
      revenueStatus: financial?.inputs.revenue.available ? "available" : "unavailable",
      spendStatus: financial?.inputs.spend.available ? "available" : "unavailable",
      sourceStates,
      financialSnapshotId: financial ? String(input.financialSnapshot!.id) : null,
    },
  };
}
