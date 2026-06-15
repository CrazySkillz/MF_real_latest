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

  it("only includes Meta attributed revenue when Meta revenue tracking is available", () => {
    const withoutRevenue = buildPerformanceSummaryAggregate({
      campaignId: "campaign-meta-no-revenue",
      dateRange: "30days",
      ga4: { connected: false },
      webAnalytics: { connected: false, provider: null },
      spend: { unifiedSpend: 100, spendSource: "platform_spend_fallback" },
      platforms: {
        meta: { connected: true, impressions: 1000, clicks: 40, spend: 100, conversions: 4, attributedRevenue: 300 },
      },
      revenue: { onsiteRevenue: 0, offsiteRevenue: 0, totalRevenue: 0 },
      revenueSources: [],
    });
    const metaWithoutRevenue = withoutRevenue.sources.find((source) => source.id === "meta");

    expect(metaWithoutRevenue?.includedMetrics).not.toContain("attributedRevenue");
    expect(metaWithoutRevenue?.excludedMetrics).toContainEqual({
      metric: "attributedRevenue",
      reason: "Meta Total Revenue requires a Meta-scoped imported revenue source",
    });
    expect(metaWithoutRevenue?.metrics.attributedRevenue).toBeNull();
    expect(withoutRevenue.totals.revenue).toMatchObject({ available: false, value: 0, sources: [] });
    expect(withoutRevenue.totals.roas).toMatchObject({ available: false, value: null, sources: [] });
    expect(withoutRevenue.totals.roi).toMatchObject({ available: false, value: null, sources: [] });

    const withRevenue = buildPerformanceSummaryAggregate({
      campaignId: "campaign-meta-revenue",
      dateRange: "30days",
      ga4: { connected: false },
      webAnalytics: { connected: false, provider: null },
      spend: { unifiedSpend: 100, spendSource: "platform_spend_fallback" },
      platforms: {
        meta: { connected: true, impressions: 1000, clicks: 40, spend: 100, conversions: 4, hasRevenueTracking: true, attributedRevenue: 300 },
      },
      revenue: { onsiteRevenue: 0, offsiteRevenue: 300, totalRevenue: 300 },
      revenueSources: [],
    });

    expect(withRevenue.sources.find((source) => source.id === "meta")?.includedMetrics).toContain("attributedRevenue");
    expect(withRevenue.totals.revenue).toMatchObject({ available: true, value: 300, sources: ["meta"] });
    expect(withRevenue.totals.roas).toMatchObject({ available: true, value: 3, sources: ["revenue", "spend"] });
    expect(withRevenue.totals.roi).toMatchObject({ available: true, value: 200, sources: ["revenue", "spend"] });
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

  it("aggregates Google Ads as a source-backed paid-media platform", () => {
    const aggregate = buildPerformanceSummaryAggregate({
      campaignId: "campaign-google-ads",
      dateRange: "30days",
      ga4: { connected: false },
      webAnalytics: { connected: false, provider: null },
      spend: { unifiedSpend: 250, spendSource: "platform_spend_fallback" },
      platforms: {},
      platformSources: [{
        id: "google_ads",
        label: "Google Ads",
        category: "paid_media",
        connected: true,
        capabilities: ["impressions", "clicks", "spend", "conversions", "attributedRevenue"],
        includedMetrics: ["impressions", "clicks", "spend", "conversions", "attributedRevenue"],
        excludedMetrics: [
          { metric: "sessions", reason: "Sessions are web analytics metrics" },
          { metric: "users", reason: "Users are web analytics metrics" },
        ],
        metrics: {
          impressions: 10000,
          clicks: 500,
          spend: 250,
          conversions: 25,
          conversionValue: 700,
          ga4AttributedRevenue: 750,
          importedAttributedRevenue: 750,
          attributedRevenue: 750,
        },
        revenueSemantics: { attributedRevenueSource: "google_ads_imported_attributed_revenue" },
        freshness: { selectedCampaignIds: ["google-campaign-1"] },
      }],
      revenue: { onsiteRevenue: 0, offsiteRevenue: 750, totalRevenue: 750 },
      revenueSources: [],
    });

    expect(aggregate.sources).toHaveLength(1);
    expect(aggregate.sources[0]).toMatchObject({
      id: "google_ads",
      label: "Google Ads",
      category: "paid_media",
      includedMetrics: ["impressions", "clicks", "spend", "conversions", "attributedRevenue"],
      metrics: {
        impressions: 10000,
        clicks: 500,
        spend: 250,
        conversions: 25,
        attributedRevenue: 750,
      },
      revenueSemantics: { attributedRevenueSource: "google_ads_imported_attributed_revenue" },
      freshness: { selectedCampaignIds: ["google-campaign-1"] },
    });
    expect(aggregate.totals.impressions).toMatchObject({ available: true, value: 10000, sources: ["google_ads"] });
    expect(aggregate.totals.clicks).toMatchObject({ available: true, value: 500, sources: ["google_ads"] });
    expect(aggregate.totals.spend).toMatchObject({ available: true, value: 250, sources: ["google_ads"] });
    expect(aggregate.totals.conversions).toMatchObject({ available: true, value: 25, sources: ["google_ads"] });
    expect(aggregate.totals.revenue).toMatchObject({ available: true, value: 750, sources: ["google_ads"] });
    expect(aggregate.totals.roas).toMatchObject({ available: true, value: 3, sources: ["revenue", "spend"] });
    expect(aggregate.totals.roi).toMatchObject({ available: true, value: 200, sources: ["revenue", "spend"] });
    expect(aggregate.totals.ctr).toMatchObject({ available: true, value: 5, sources: ["clicks", "impressions"] });
    expect(aggregate.totals.cvr).toMatchObject({ available: true, value: 5, sources: ["conversions", "clicks"] });
  });

  it("includes source-backed Instagram paid-media metrics when Meta is also connected", () => {
    const aggregate = buildPerformanceSummaryAggregate({
      campaignId: "campaign-meta-instagram",
      dateRange: "30days",
      ga4: { connected: false },
      webAnalytics: { connected: false, provider: null },
      spend: { unifiedSpend: 75, spendSource: "platform_spend_fallback" },
      platforms: {
        meta: { connected: true, impressions: 2000, clicks: 80, spend: 50, conversions: 8 },
      },
      platformSources: [{
        id: "instagram",
        label: "Instagram Ads",
        category: "paid_media",
        connected: true,
        capabilities: ["impressions", "clicks", "spend", "conversions"],
        includedMetrics: ["impressions", "clicks", "spend", "conversions"],
        excludedMetrics: [{ metric: "sessions", reason: "Sessions are web analytics metrics" }],
        metrics: { impressions: 1000, clicks: 40, spend: 25, conversions: 4 },
        freshness: { publisherPlatformFilter: "instagram" },
      }],
      revenue: { onsiteRevenue: 0, offsiteRevenue: 0, totalRevenue: 0 },
      revenueSources: [],
    });

    expect(aggregate.sources.map((source) => source.id)).toEqual(["meta", "instagram"]);
    expect(aggregate.totals.impressions).toMatchObject({ available: true, value: 3000, sources: ["meta", "instagram"] });
    expect(aggregate.totals.clicks).toMatchObject({ available: true, value: 120, sources: ["meta", "instagram"] });
    expect(aggregate.totals.conversions).toMatchObject({ available: true, value: 12, sources: ["meta", "instagram"] });
    expect(aggregate.totals.spend).toMatchObject({ available: true, value: 75, sources: ["meta", "instagram"] });
  });

  it("does not count native Google Ads conversion value as aggregate revenue without an imported source", () => {
    const aggregate = buildPerformanceSummaryAggregate({
      campaignId: "campaign-google-ads-no-imported-revenue",
      dateRange: "30days",
      ga4: { connected: false },
      webAnalytics: { connected: false, provider: null },
      spend: { unifiedSpend: 250, spendSource: "platform_spend_fallback" },
      platforms: {},
      platformSources: [{
        id: "google_ads",
        label: "Google Ads",
        category: "paid_media",
        connected: true,
        capabilities: ["impressions", "clicks", "spend", "conversions", "attributedRevenue"],
        includedMetrics: ["impressions", "clicks", "spend", "conversions"],
        excludedMetrics: [
          { metric: "sessions", reason: "Sessions are web analytics metrics" },
          { metric: "users", reason: "Users are web analytics metrics" },
          { metric: "attributedRevenue", reason: "Google Ads Total Revenue requires a Google Ads-scoped imported revenue source" },
        ],
        metrics: {
          impressions: 10000,
          clicks: 500,
          spend: 250,
          conversions: 25,
          conversionValue: 700,
          ga4AttributedRevenue: 750,
          importedAttributedRevenue: 0,
          attributedRevenue: 0,
        },
        revenueSemantics: { attributedRevenueSource: "unavailable" },
      }],
      revenue: { onsiteRevenue: 0, offsiteRevenue: 0, totalRevenue: 0 },
      revenueSources: [],
    });

    expect(aggregate.totals.spend).toMatchObject({ available: true, value: 250, sources: ["google_ads"] });
    expect(aggregate.totals.conversions).toMatchObject({ available: true, value: 25, sources: ["google_ads"] });
    expect(aggregate.totals.revenue).toMatchObject({ available: false, value: 0, sources: [] });
    expect(aggregate.totals.roas).toMatchObject({ available: false, value: null, sources: [] });
    expect(aggregate.totals.roi).toMatchObject({ available: false, value: null, sources: [] });
  });

  it("gates TikTok attributed revenue through the generic paid-media source contract", () => {
    const withoutRevenue = buildPerformanceSummaryAggregate({
      campaignId: "campaign-tiktok-no-revenue",
      dateRange: "30days",
      ga4: { connected: false },
      webAnalytics: { connected: false, provider: null },
      spend: { unifiedSpend: 96, spendSource: "platform_spend_fallback" },
      platforms: {},
      platformSources: [{
        id: "tiktok",
        label: "TikTok Ads",
        category: "paid_media",
        connected: true,
        capabilities: ["impressions", "clicks", "spend", "conversions", "attributedRevenue"],
        includedMetrics: ["impressions", "clicks", "spend", "conversions"],
        excludedMetrics: [{ metric: "attributedRevenue", reason: "TikTok attributed revenue requires a TikTok-scoped imported revenue source" }],
        metrics: { impressions: 3200, clicks: 115, spend: 96, conversions: 5, attributedRevenue: null },
      }],
      revenue: { onsiteRevenue: 0, offsiteRevenue: 0, totalRevenue: 0 },
      revenueSources: [],
    });

    expect(withoutRevenue.totals.revenue).toMatchObject({ available: false, value: 0, sources: [] });
    expect(withoutRevenue.totals.roas).toMatchObject({ available: false, value: null, sources: [] });
    expect(withoutRevenue.totals.roi).toMatchObject({ available: false, value: null, sources: [] });

    const withRevenue = buildPerformanceSummaryAggregate({
      campaignId: "campaign-tiktok-revenue",
      dateRange: "30days",
      ga4: { connected: false },
      webAnalytics: { connected: false, provider: null },
      spend: { unifiedSpend: 96, spendSource: "platform_spend_fallback" },
      platforms: {},
      platformSources: [{
        id: "tiktok",
        label: "TikTok Ads",
        category: "paid_media",
        connected: true,
        capabilities: ["impressions", "clicks", "spend", "conversions", "attributedRevenue"],
        includedMetrics: ["impressions", "clicks", "spend", "conversions", "attributedRevenue"],
        excludedMetrics: [],
        metrics: { impressions: 3200, clicks: 115, spend: 96, conversions: 5, attributedRevenue: 240 },
        revenueSemantics: { attributedRevenueSource: "tiktok_imported_attributed_revenue" },
      }],
      revenue: { onsiteRevenue: 0, offsiteRevenue: 240, totalRevenue: 240 },
      revenueSources: [],
    });

    expect(withRevenue.sources.find((source) => source.id === "tiktok")?.includedMetrics).toContain("attributedRevenue");
    expect(withRevenue.totals.revenue).toMatchObject({ available: true, value: 240, sources: ["tiktok"] });
    expect(withRevenue.totals.roas).toMatchObject({ available: true, value: 2.5, sources: ["revenue", "spend"] });
    expect(withRevenue.totals.roi).toMatchObject({ available: true, value: 150, sources: ["revenue", "spend"] });
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

  it("keeps missing Custom Integration fields unavailable instead of zero-filling aggregate availability", () => {
    const aggregate = buildPerformanceSummaryAggregate({
      campaignId: "campaign-custom-partial",
      dateRange: "30days",
      ga4: { connected: false },
      webAnalytics: { connected: false, provider: null },
      spend: { unifiedSpend: 100, spendSource: "platform_spend_fallback" },
      platforms: {
        customIntegration: { connected: true, clicks: 0, spend: 100 },
      },
      revenue: { onsiteRevenue: 0, offsiteRevenue: 0, totalRevenue: 0 },
      revenueSources: [],
    });
    const custom = aggregate.sources.find((source) => source.id === "custom_integration");

    expect(custom?.includedMetrics).toEqual(["clicks", "spend"]);
    expect(custom?.excludedMetrics).toContainEqual({
      metric: "impressions",
      reason: "Selected Custom Integration import does not include impressions",
    });
    expect(aggregate.totals.clicks).toMatchObject({ available: true, value: 0, sources: ["custom_integration"] });
    expect(aggregate.totals.spend).toMatchObject({ available: true, value: 100, sources: ["custom_integration"] });
    expect(aggregate.totals.impressions.available).toBe(false);
    expect(aggregate.totals.conversions.available).toBe(false);
    expect(aggregate.totals.sessions).toMatchObject({
      available: false,
      unavailableReasons: ["No connected web analytics source provides sessions"],
    });
  });

  it("only treats Custom Integration as a web analytics source when the caller selects it as the web provider", () => {
    const baseInput = {
      campaignId: "campaign-custom-web",
      dateRange: "30days",
      ga4: { connected: false },
      spend: { unifiedSpend: 0, spendSource: "platform_spend_fallback" },
      platforms: {
        customIntegration: { connected: true, users: 120, sessions: 300, pageviews: 650, conversions: 12 },
      },
      revenue: { onsiteRevenue: 0, offsiteRevenue: 0, totalRevenue: 0 },
      revenueSources: [],
    };
    const notWeb = buildPerformanceSummaryAggregate({
      ...baseInput,
      webAnalytics: { connected: false, provider: null },
    });
    const asWeb = buildPerformanceSummaryAggregate({
      ...baseInput,
      webAnalytics: { connected: true, provider: "custom_integration", users: 120, sessions: 300, conversions: 12 },
    });

    expect(notWeb.sources.find((source) => source.id === "custom_integration")?.includedMetrics).toEqual(["conversions"]);
    expect(notWeb.totals.sessions.available).toBe(false);
    expect(notWeb.sources.find((source) => source.id === "custom_integration")?.excludedMetrics).toContainEqual({
      metric: "sessions",
      reason: "Custom Integration is not the active web analytics source",
    });
    expect(asWeb.sources.find((source) => source.id === "custom_integration")?.includedMetrics).toEqual(["conversions", "users", "sessions", "pageviews"]);
    expect(asWeb.totals.sessions).toMatchObject({ available: true, value: 300, sources: ["custom_integration"] });
    expect(asWeb.totals.users).toMatchObject({ available: true, value: 120, sources: ["custom_integration"] });
    expect(asWeb.totals.conversions).toMatchObject({ available: true, value: 12, sources: ["custom_integration"] });
  });
});
