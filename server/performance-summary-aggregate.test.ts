import { describe, expect, it } from "vitest";
import {
  buildPerformanceSummaryAggregate,
  getPerformanceSummaryMainSourceAdapterIds,
} from "./utils/performance-summary-aggregate";

describe("Performance Summary aggregate contract", () => {
  it("defines main Connected Platform sources through the aggregate adapter registry", () => {
    expect(getPerformanceSummaryMainSourceAdapterIds()).toEqual(["ga4", "linkedin", "meta", "custom_integration"]);
  });

  it("uses only GA4-capable metrics for a GA4-only campaign", () => {
    const aggregate = buildPerformanceSummaryAggregate({
      campaignId: "campaign-1",
      dateRange: "30days",
      ga4: { connected: true, revenue: 1200, conversions: 12, sessions: 300, users: 180 },
      webAnalytics: { connected: true, provider: "ga4", revenue: 1200, conversions: 12, sessions: 300, users: 180 },
      spend: { unifiedSpend: 0, spendSource: "platform_spend_fallback" },
      platforms: {},
      revenue: { onsiteRevenue: 1200, offsiteRevenue: 0, totalRevenue: 1200 },
      revenueSources: [],
    });

    expect(aggregate.version).toBe("performance_summary_aggregate_v1");
    expect(aggregate.sources.map((source) => source.id)).toEqual(["ga4"]);
    expect(aggregate.totals.sessions).toMatchObject({ available: true, value: 300, sources: ["ga4"] });
    expect(aggregate.totals.users).toMatchObject({ available: true, value: 180, sources: ["ga4"] });
    expect(aggregate.totals.conversions).toMatchObject({ available: true, value: 12, sources: ["ga4"] });
    expect(aggregate.totals.revenue).toMatchObject({ available: true, value: 1200, sources: ["ga4"] });
    expect(aggregate.totals.cvr).toMatchObject({ available: true, value: 4, sources: ["conversions", "sessions"] });
    expect(aggregate.totals.impressions.available).toBe(false);
    expect(aggregate.totals.clicks.available).toBe(false);
    expect(aggregate.totals.spend.available).toBe(false);
    expect(aggregate.totals.roas.available).toBe(false);
  });

  it("aggregates connected paid-platform metrics without requiring GA4", () => {
    const aggregate = buildPerformanceSummaryAggregate({
      campaignId: "campaign-2",
      dateRange: "30days",
      ga4: { connected: false },
      webAnalytics: { connected: false, provider: null },
      spend: { unifiedSpend: 150, spendSource: "platform_spend_fallback" },
      platforms: {
        linkedin: { connected: true, impressions: 1000, clicks: 50, spend: 100, conversions: 5, leads: 2 },
        meta: { connected: true, impressions: 2000, clicks: 80, spend: 50, conversions: 8 },
      },
      revenue: { onsiteRevenue: 0, offsiteRevenue: 0, totalRevenue: 0 },
      revenueSources: [],
    });

    expect(aggregate.sources.map((source) => source.id)).toEqual(["linkedin", "meta"]);
    expect(aggregate.totals.impressions).toMatchObject({ available: true, value: 3000, sources: ["linkedin", "meta"] });
    expect(aggregate.totals.clicks).toMatchObject({ available: true, value: 130, sources: ["linkedin", "meta"] });
    expect(aggregate.totals.conversions).toMatchObject({ available: true, value: 13, sources: ["linkedin", "meta"] });
    expect(aggregate.totals.leads).toMatchObject({ available: true, value: 2, sources: ["linkedin"] });
    expect(aggregate.totals.spend).toMatchObject({ available: true, value: 150, sources: ["linkedin", "meta"] });
    expect(aggregate.sources.find((source) => source.id === "linkedin")?.includedMetrics).not.toContain("attributedRevenue");
    expect(aggregate.totals.sessions.available).toBe(false);
    expect(aggregate.totals.revenue.sources).not.toContain("linkedin");
    expect(aggregate.totals.roas.available).toBe(false);
  });

  it("only includes LinkedIn attributed revenue when LinkedIn revenue tracking is available", () => {
    const aggregate = buildPerformanceSummaryAggregate({
      campaignId: "campaign-linkedin-revenue",
      dateRange: "30days",
      ga4: { connected: false },
      webAnalytics: { connected: false, provider: null },
      spend: { unifiedSpend: 100, spendSource: "platform_spend_fallback" },
      platforms: {
        linkedin: {
          connected: true,
          impressions: 1000,
          clicks: 50,
          spend: 100,
          conversions: 5,
          leads: 2,
          hasRevenueTracking: true,
          attributedRevenue: 250,
        },
      },
      revenue: { onsiteRevenue: 0, offsiteRevenue: 250, totalRevenue: 250 },
      revenueSources: [],
    });

    expect(aggregate.sources.find((source) => source.id === "linkedin")?.includedMetrics).toContain("attributedRevenue");
    expect(aggregate.totals.revenue).toMatchObject({ available: true, value: 250, sources: ["linkedin"] });
    expect(aggregate.totals.roas).toMatchObject({ available: true, value: 2.5, sources: ["revenue", "spend"] });
    expect(aggregate.totals.roi).toMatchObject({ available: true, value: 150, sources: ["revenue", "spend"] });
  });

  it("aggregates future main Connected Platform sources through the generic source contract", () => {
    const aggregate = buildPerformanceSummaryAggregate({
      campaignId: "campaign-future",
      dateRange: "30days",
      ga4: { connected: false },
      webAnalytics: { connected: false, provider: null },
      spend: { unifiedSpend: 300, spendSource: "platform_spend_fallback" },
      platforms: {},
      platformSources: [
        {
          id: "google_ads",
          label: "Google Ads",
          category: "paid_media",
          connected: true,
          capabilities: ["impressions", "clicks", "spend", "conversions"],
          includedMetrics: ["impressions", "clicks", "spend", "conversions"],
          excludedMetrics: [{ metric: "sessions", reason: "Sessions are web analytics metrics" }],
          metrics: { impressions: 4000, clicks: 120, spend: 200, conversions: 10 },
        },
        {
          id: "tiktok",
          label: "TikTok Ads",
          category: "paid_media",
          connected: true,
          capabilities: ["impressions", "clicks", "spend", "conversions"],
          includedMetrics: ["impressions", "clicks", "spend", "conversions"],
          excludedMetrics: [{ metric: "sessions", reason: "Sessions are web analytics metrics" }],
          metrics: { impressions: 6000, clicks: 180, spend: 100, conversions: 15 },
        },
      ],
      revenue: { onsiteRevenue: 0, offsiteRevenue: 0, totalRevenue: 0 },
      revenueSources: [],
    });

    expect(aggregate.sources.map((source) => source.id)).toEqual(["google_ads", "tiktok"]);
    expect(aggregate.totals.impressions).toMatchObject({ available: true, value: 10000, sources: ["google_ads", "tiktok"] });
    expect(aggregate.totals.clicks).toMatchObject({ available: true, value: 300, sources: ["google_ads", "tiktok"] });
    expect(aggregate.totals.conversions).toMatchObject({ available: true, value: 25, sources: ["google_ads", "tiktok"] });
    expect(aggregate.totals.spend).toMatchObject({ available: true, value: 300, sources: ["google_ads", "tiktok"] });
    expect(aggregate.totals.cpm).toMatchObject({ available: true, value: 30, sources: ["spend", "impressions"] });
  });

  it("marks canonical spend and revenue-derived ratios available only when required inputs exist", () => {
    const aggregate = buildPerformanceSummaryAggregate({
      campaignId: "campaign-3",
      dateRange: "30days",
      ga4: { connected: true, revenue: 1000, conversions: 20, sessions: 500, users: 300 },
      webAnalytics: { connected: true, provider: "ga4", revenue: 1000, conversions: 20, sessions: 500, users: 300 },
      spend: { unifiedSpend: 250, spendSource: "persisted_spend_sources" },
      platforms: {
        linkedin: { connected: true, impressions: 1000, clicks: 100, spend: 400, conversions: 9, leads: 1 },
      },
      revenue: { onsiteRevenue: 1000, offsiteRevenue: 0, totalRevenue: 1000 },
      revenueSources: [],
    });

    expect(aggregate.totals.spend).toMatchObject({ available: true, value: 250, sources: ["canonical_spend_sources"] });
    expect(aggregate.totals.roas).toMatchObject({ available: true, value: 4, sources: ["revenue", "spend"] });
    expect(aggregate.totals.roi).toMatchObject({ available: true, value: 300, sources: ["revenue", "spend"] });
    expect(aggregate.totals.cpa).toMatchObject({ available: true, value: 12.5, sources: ["spend", "conversions"] });
    expect(aggregate.totals.cpm).toMatchObject({ available: true, value: 250, sources: ["spend", "impressions"] });
  });

  it("keeps supported zero-valued metrics available instead of treating them as missing", () => {
    const aggregate = buildPerformanceSummaryAggregate({
      campaignId: "campaign-4",
      dateRange: "30days",
      ga4: { connected: false },
      webAnalytics: { connected: false, provider: null },
      spend: { unifiedSpend: 0, spendSource: "platform_spend_fallback" },
      platforms: {
        linkedin: { connected: true, impressions: 0, clicks: 0, spend: 0, conversions: 0, leads: 0 },
      },
      revenue: { onsiteRevenue: 0, offsiteRevenue: 0, totalRevenue: 0 },
      revenueSources: [],
    });

    expect(aggregate.totals.impressions).toMatchObject({ available: true, value: 0, sources: ["linkedin"] });
    expect(aggregate.totals.clicks).toMatchObject({ available: true, value: 0, sources: ["linkedin"] });
    expect(aggregate.totals.spend).toMatchObject({ available: true, value: 0, sources: ["linkedin"] });
    expect(aggregate.totals.sessions.available).toBe(false);
  });
});
