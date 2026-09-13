import { describe, expect, it } from "vitest";
import { computeKpiValue } from "./ga4-kpi-benchmark-jobs";
import { buildPerformanceSummaryAggregate } from "./utils/performance-summary-aggregate";

describe("GA4 Overview Spend downstream propagation", () => {
  const inputs = {
    users: 100,
    sessions: 80,
    pageviews: 120,
    conversions: 50,
    ga4Revenue: 1_000,
    importedRevenue: 0,
    spend: 250,
    engagementRate: 0.5,
  };

  it("uses the exact Spend input in KPI/Benchmark financial formulas", () => {
    expect(computeKpiValue("roas", inputs)).toBe(4);
    expect(computeKpiValue("roi", inputs)).toBe(300);
    expect(computeKpiValue("cpa", inputs)).toBe(5);
  });

  it("carries canonical Spend into performance totals and derived financials", () => {
    const aggregate = buildPerformanceSummaryAggregate({
      campaignId: "campaign-1",
      dateRange: "90days",
      ga4: { connected: true, available: true, users: 100, sessions: 80, conversions: 50, revenue: 1_000 },
      webAnalytics: { connected: true, available: true, provider: "ga4", users: 100, sessions: 80, conversions: 50, revenue: 1_000 },
      financialConversions: { value: 50, available: true, sources: ["ga4"] },
      spend: { unifiedSpend: 250, spendSource: "persisted_spend_sources", sourceIds: ["spend-source-1"] },
      revenue: { available: true, totalRevenue: 1_000 },
      revenueSources: [{ connected: true, type: "fixture", lastTotalRevenue: 1_000 }],
    });

    expect(aggregate.totals.spend).toMatchObject({ value: 250, available: true, sources: ["canonical_spend_sources"] });
    expect(aggregate.totals.roas).toMatchObject({ value: 4, available: true });
    expect(aggregate.totals.roi).toMatchObject({ value: 300, available: true });
    expect(aggregate.totals.cpa).toMatchObject({ value: 5, available: true });
  });
});
