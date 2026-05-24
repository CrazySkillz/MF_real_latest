import { describe, expect, it } from "vitest";
import { buildTrendAnalysisAggregate } from "./utils/trend-analysis-aggregate";

describe("Trend Analysis aggregate contract", () => {
  it("returns only GA4 daily metrics for a GA4-only campaign", () => {
    const aggregate = buildTrendAnalysisAggregate({
      campaignId: "campaign-1",
      dateRange: "30days",
      startDate: "2026-05-01",
      endDate: "2026-05-02",
      sources: [
        {
          id: "ga4",
          label: "Google Analytics",
          category: "web_analytics",
          connected: true,
          capabilities: ["users", "sessions", "conversions", "revenue", "engagementRate"],
          includedMetrics: ["users", "sessions", "conversions", "revenue", "engagementRate"],
          excludedMetrics: [
            { metric: "impressions", reason: "GA4 is not an ad-impression source" },
            { metric: "clicks", reason: "GA4 is not an ad-click source" },
            { metric: "spend", reason: "Spend is not a GA4 metric" },
          ],
          dailyRows: [
            { date: "2026-05-01", metrics: { users: 10, sessions: 20, conversions: 2, revenue: 100, engagementRate: 50 } },
            { date: "2026-05-02", metrics: { users: 15, sessions: 30, conversions: 3, revenue: 150, engagementRate: 55 } },
          ],
        },
        {
          id: "linkedin",
          label: "LinkedIn Ads",
          category: "paid_media",
          connected: false,
          capabilities: ["impressions", "clicks", "spend", "conversions"],
          includedMetrics: [],
          excludedMetrics: [],
          dailyRows: [
            { date: "2026-05-01", metrics: { impressions: 1000, clicks: 50, spend: 25, conversions: 5 } },
          ],
        },
      ],
    });

    expect(aggregate.version).toBe("trend_analysis_aggregate_v1");
    expect(aggregate.sources.map((source) => source.id)).toEqual(["ga4"]);
    expect(aggregate.sources[0].dailyRows).toHaveLength(2);
    expect(aggregate.metrics.sessions.sources).toEqual(["ga4"]);
    expect(aggregate.metrics.users.sources).toEqual(["ga4"]);
    expect(aggregate.metrics.conversions.sources).toEqual(["ga4"]);
    expect(aggregate.metrics.revenue.sources).toEqual(["ga4"]);
    expect(aggregate.metrics.impressions.sources).toEqual([]);
    expect(aggregate.metrics.clicks.sources).toEqual([]);
    expect(aggregate.dailyTotals[1].metrics).toMatchObject({
      users: 15,
      sessions: 30,
      conversions: 3,
      revenue: 150,
      cvr: 10,
    });
  });

  it("keeps child financial inputs out of main sources while allowing canonical spend totals", () => {
    const aggregate = buildTrendAnalysisAggregate({
      campaignId: "campaign-2",
      dateRange: "7days",
      startDate: "2026-05-01",
      endDate: "2026-05-01",
      financialDailyRows: [{ date: "2026-05-01", spend: 40, revenue: 120 }],
      sources: [
        {
          id: "ga4",
          label: "Google Analytics",
          category: "web_analytics",
          connected: true,
          capabilities: ["sessions", "users", "conversions", "revenue"],
          includedMetrics: ["sessions", "users", "conversions", "revenue"],
          excludedMetrics: [],
          dailyRows: [{ date: "2026-05-01", metrics: { sessions: 20, users: 10, conversions: 2, revenue: 100 } }],
        },
      ],
    });

    expect(aggregate.sources.map((source) => source.id)).toEqual(["ga4"]);
    expect(aggregate.metrics.spend.sources).toEqual(["canonical_spend_sources"]);
    expect(aggregate.dailyTotals[0].metrics).toMatchObject({
      spend: 40,
      revenue: 120,
      roas: 3,
      roi: 200,
    });
  });

  it("aggregates connected paid-media daily rows by source capability", () => {
    const aggregate = buildTrendAnalysisAggregate({
      campaignId: "campaign-3",
      dateRange: "7days",
      startDate: "2026-05-01",
      endDate: "2026-05-01",
      sources: [
        {
          id: "linkedin",
          label: "LinkedIn Ads",
          category: "paid_media",
          connected: true,
          capabilities: ["impressions", "clicks", "spend", "conversions"],
          includedMetrics: ["impressions", "clicks", "spend", "conversions"],
          excludedMetrics: [],
          dailyRows: [{ date: "2026-05-01", metrics: { impressions: 1000, clicks: 50, spend: 100, conversions: 5 } }],
        },
        {
          id: "meta",
          label: "Meta Ads",
          category: "paid_media",
          connected: true,
          capabilities: ["impressions", "clicks", "spend", "conversions"],
          includedMetrics: ["impressions", "clicks", "spend", "conversions"],
          excludedMetrics: [],
          dailyRows: [{ date: "2026-05-01", metrics: { impressions: 2000, clicks: 100, spend: 200, conversions: 10 } }],
        },
      ],
    });

    expect(aggregate.sources.map((source) => source.id)).toEqual(["linkedin", "meta"]);
    expect(aggregate.dailyTotals[0].metrics).toMatchObject({
      impressions: 3000,
      clicks: 150,
      spend: 300,
      conversions: 15,
      ctr: 5,
      cpc: 2,
      cpa: 20,
      cpm: 100,
    });
  });
});
