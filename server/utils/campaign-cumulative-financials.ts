import { financialDailySnapshotInputSchema, type FinancialDailySnapshotInput } from "../../shared/schema";
import { parseGA4FinancialNumber } from "../../shared/ga4-financial-source";

type FinancialMetric = {
  value?: unknown;
  available?: unknown;
  sources?: unknown;
};

type PerformanceSummaryV3 = {
  campaignId?: unknown;
  version?: unknown;
  currentValueWindow?: unknown;
  totals?: {
    spend?: FinancialMetric;
    revenue?: FinancialMetric;
    conversions?: FinancialMetric;
  };
};

type ResolvedFinancialMetric = {
  value: number;
  snapshot: {
    value: string | number | null;
    available: boolean;
    sources: string[];
  };
};

export type CampaignCumulativeFinancials = {
  snapshot: FinancialDailySnapshotInput;
  financials: {
    nativeRevenue: number;
    importedRevenue: number;
    totalRevenue: number;
    spend: number;
    conversions: number;
    profit: number;
    roas: number;
    roi: number;
    cpa: number;
  };
};

const round2 = (value: number) => Number(value.toFixed(2));

const resolveFinancialMetric = (
  metricName: "spend" | "revenue" | "conversions",
  metric: FinancialMetric | undefined,
): ResolvedFinancialMetric => {
  if (!metric || (metric.available !== true && metric.available !== false)) {
    throw new Error(`Cumulative ${metricName} availability is missing`);
  }

  const value = parseGA4FinancialNumber(metric.value);
  const hasValue = value !== null && (metricName === "revenue" || value >= 0);
  const sources = Array.isArray(metric.sources)
    ? Array.from(new Set(metric.sources.map((source) => String(source).trim()).filter(Boolean)))
    : [];

  if (metric.available === true && (!hasValue || sources.length === 0)) {
    throw new Error(`Available cumulative ${metricName} requires a ${metricName === "revenue" ? "finite" : "non-negative"} value and authoritative sources`);
  }
  if (metric.available === false && sources.length > 0) {
    throw new Error(`Unavailable cumulative ${metricName} must not retain authoritative sources`);
  }

  const numericValue = hasValue ? value : 0;
  return {
    value: numericValue,
    snapshot: metric.available === true
      ? {
          value: metricName === "conversions" ? numericValue : round2(numericValue).toFixed(2),
          available: true,
          sources,
        }
      : { value: null, available: false, sources: [] },
  };
};

export function resolveCampaignCumulativeFinancials(input: {
  campaignId: string;
  currency: string;
  performanceSummary: PerformanceSummaryV3;
  financialConversions?: FinancialMetric;
  nativeRevenue: number;
  importedRevenue: number;
}): CampaignCumulativeFinancials {
  const campaignId = String(input.campaignId || "").trim();
  if (!campaignId || input.performanceSummary?.version !== "performance_summary_aggregate_v3") {
    throw new Error("Authoritative cumulative financials require a v3 performance summary");
  }
  if (String(input.performanceSummary.campaignId || "").trim() !== campaignId) {
    throw new Error("Performance summary campaign does not match the requested campaign");
  }

  const spend = resolveFinancialMetric("spend", input.performanceSummary.totals?.spend);
  const revenue = resolveFinancialMetric("revenue", input.performanceSummary.totals?.revenue);
  const conversions = resolveFinancialMetric("conversions", input.financialConversions ?? input.performanceSummary.totals?.conversions);
  const nativeRevenue = parseGA4FinancialNumber(input.nativeRevenue);
  const importedRevenueValue = parseGA4FinancialNumber(input.importedRevenue);
  if (nativeRevenue === null || importedRevenueValue === null) {
    throw new Error("Cumulative revenue components must be finite numbers");
  }
  const importedRevenue = round2(importedRevenueValue);
  if (Math.abs(round2(nativeRevenue + importedRevenue) - round2(revenue.value)) >= 0.005) {
    throw new Error("Cumulative revenue components do not match authoritative total revenue");
  }

  const snapshot = financialDailySnapshotInputSchema.parse({
    version: "financial_daily_snapshot_v1",
    campaignId,
    reportingDate: (input.performanceSummary.currentValueWindow as any)?.endDate,
    currency: String(input.currency || "").trim().toUpperCase(),
    currentValueWindow: input.performanceSummary.currentValueWindow,
    inputs: {
      spend: spend.snapshot,
      revenue: revenue.snapshot,
      conversions: conversions.snapshot,
    },
  });
  const profit = round2(revenue.value - spend.value);

  return {
    snapshot,
    financials: {
      nativeRevenue,
      importedRevenue,
      totalRevenue: round2(revenue.value),
      spend: round2(spend.value),
      conversions: conversions.value,
      profit,
      roas: spend.value > 0 ? revenue.value / spend.value : 0,
      roi: spend.value > 0 ? ((revenue.value - spend.value) / spend.value) * 100 : 0,
      cpa: conversions.value > 0 ? spend.value / conversions.value : 0,
    },
  };
}
