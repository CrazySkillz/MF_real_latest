import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pdfTextCalls = vi.hoisted((): string[] => []);

const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getCampaigns: vi.fn(),
  getGA4Connections: vi.fn(),
  getGA4Connection: vi.fn(),
  updateGA4ConnectionTokens: vi.fn(),
  getGA4DailyMetrics: vi.fn(),
  getLatestGA4DailyMetric: vi.fn(),
  getRevenueSources: vi.fn(),
  getSpendSources: vi.fn(),
  getRevenueBreakdownBySource: vi.fn(),
  getSpendBreakdownBySource: vi.fn(),
  getRevenueTotalForRange: vi.fn(),
  getSpendTotalForRange: vi.fn(),
  getPlatformKPIs: vi.fn(),
  updateKPI: vi.fn(),
  getKPIProgress: vi.fn(),
  recordKPIProgress: vi.fn(),
  getPlatformBenchmarks: vi.fn(),
  updateBenchmark: vi.fn(),
  getBenchmarkHistory: vi.fn(),
  recordBenchmarkHistory: vi.fn(),
  getNotifications: vi.fn(),
  getKPI: vi.fn(),
  getBenchmark: vi.fn(),
}));

const ga4ServiceMock = vi.hoisted(() => ({
  getMetricsWithAutoRefresh: vi.fn(),
  getAcquisitionBreakdown: vi.fn(),
  getLandingPagesReport: vi.fn(),
  getConversionEventsReport: vi.fn(),
  getTimeSeriesData: vi.fn(),
  getTotalsWithRevenue: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

const refreshCampaignCurrentValuesForCampaignMock = vi.hoisted(() => vi.fn());
const resolveCampaignCurrentValueForAlertMock = vi.hoisted(() => vi.fn(async (row: any) => row));
const getCampaignMetricTotalsMock = vi.hoisted(() => vi.fn());
const getAuthMock = vi.hoisted(() => vi.fn(() => ({ userId: "user-1" })));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: ga4ServiceMock }));
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("@clerk/express", () => ({ getAuth: getAuthMock }));
vi.mock("./utils/campaign-current-values", () => ({
  refreshCampaignCurrentValuesForCampaign: refreshCampaignCurrentValuesForCampaignMock,
  resolveCampaignCurrentValueForAlert: resolveCampaignCurrentValueForAlertMock,
  getCampaignMetricTotals: getCampaignMetricTotalsMock,
}));
vi.mock("./middleware/rateLimiter", () => {
  const passThrough = (_req: any, _res: any, next: any) => next();
  return {
    oauthRateLimiter: passThrough,
    linkedInApiRateLimiter: passThrough,
    googleSheetsRateLimiter: passThrough,
    ga4RateLimiter: passThrough,
    importRateLimiter: passThrough,
  };
});
vi.mock("jspdf", () => ({
  jsPDF: class {
    setFillColor() {}
    rect() {}
    roundedRect() {}
    setFontSize() {}
    setFont() {}
    setTextColor() {}
    setDrawColor() {}
    setLineWidth() {}
    line() {}
    circle() {}
    getTextWidth(value: any) { return String(value).length * 2; }
    addPage() {}
    splitTextToSize(value: any) {
      return [String(value)];
    }
    text(value: any) {
      if (Array.isArray(value)) {
        value.forEach((item) => pdfTextCalls.push(String(item)));
      } else {
        pdfTextCalls.push(String(value));
      }
    }
    output(kind: string) {
      if (kind === "nodebuffer") return Buffer.from("x".repeat(256));
      return new ArrayBuffer(256);
    }
  },
}));

import { buildGA4ScheduledPdfAttachment } from "./ga4-scheduled-report-pdf";
import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { registerRoutes } from "./routes-oauth";

const campaign = {
  id: "campaign-1",
  name: "Shopify Downstream Campaign",
  ownerId: "user-1",
  currency: "USD",
  startDate: "2026-06-01T00:00:00.000Z",
  createdAt: "2026-06-01T00:00:00.000Z",
  ga4CampaignFilter: "shopify_campaign",
};

const dailyRow = {
  date: "2026-07-04",
  sessions: 10,
  users: 5,
  pageviews: 20,
  conversions: 2,
  revenue: "100.00",
  engagedSessions: 6,
  engagementRate: 0.6,
  updatedAt: "2026-07-05T09:00:00.000Z",
};

const revenueSource = {
  id: "shopify-source-1",
  sourceType: "shopify",
  displayName: "Shopify",
  currency: "USD",
  isActive: true,
  mappingConfig: {
    platformContext: "ga4",
    campaignValueRevenueTotals: [
      { campaignValue: "shopify_campaign", revenue: 199.98, orderCount: 2 },
    ],
    campaignMappings: [{
      crmValue: "shopify_campaign",
      linkedinCampaignUrn: "shopify_campaign",
      linkedinCampaignName: "shopify_campaign",
    }],
  },
};

const revenueKpi = {
  id: "kpi-revenue",
  campaignId: campaign.id,
  platformType: "google_analytics",
  name: "Revenue KPI",
  metric: "Revenue",
  currentValue: "299.98",
  targetValue: "500",
  alertThreshold: "350",
  alertCondition: "below",
  alertsEnabled: true,
};

const revenueBenchmark = {
  id: "benchmark-revenue",
  campaignId: campaign.id,
  platformType: "google_analytics",
  name: "Revenue Benchmark",
  metric: "Revenue",
  currentValue: "299.98",
  benchmarkValue: "400",
  alertThreshold: "350",
  alertCondition: "below",
  alertsEnabled: true,
};

function resetMocks() {
  for (const value of Object.values(storageMock)) value.mockReset();
  for (const value of Object.values(ga4ServiceMock)) value.mockReset();
  refreshCampaignCurrentValuesForCampaignMock.mockReset();
  resolveCampaignCurrentValueForAlertMock.mockReset();
  resolveCampaignCurrentValueForAlertMock.mockImplementation(async (row: any) => row);
  getCampaignMetricTotalsMock.mockReset();
  getAuthMock.mockReset();
  getAuthMock.mockReturnValue({ userId: "user-1" });
  pdfTextCalls.length = 0;
}

function setCommonShopifyFinancialMocks() {
  storageMock.getCampaign.mockResolvedValue(campaign);
  storageMock.getCampaigns.mockResolvedValue([campaign]);
  storageMock.getGA4Connections.mockResolvedValue([
    { id: "ga4-1", campaignId: campaign.id, propertyId: "properties/123", method: "access_token", accessToken: "ga4-token", isPrimary: true, lookbackDays: 30, importStartDate: "2026-07-02" },
  ]);
  storageMock.getGA4Connection.mockResolvedValue({
    id: "ga4-1",
    campaignId: campaign.id,
    propertyId: "properties/123",
    method: "access_token",
    accessToken: "ga4-token",
    isPrimary: true,
    lookbackDays: 30,
    importStartDate: "2026-07-02",
  });
  storageMock.getGA4DailyMetrics.mockResolvedValue([dailyRow]);
  storageMock.getLatestGA4DailyMetric.mockResolvedValue(dailyRow);
  storageMock.getRevenueSources.mockResolvedValue([revenueSource]);
  storageMock.getSpendSources.mockResolvedValue([]);
  storageMock.getRevenueBreakdownBySource.mockResolvedValue([
    { sourceId: revenueSource.id, sourceType: "shopify", displayName: "Shopify", revenue: 199.98 },
  ]);
  storageMock.getSpendBreakdownBySource.mockResolvedValue([]);
  storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 199.98, currency: "USD", sourceIds: [revenueSource.id] });
  storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 0, sourceIds: [] });
  storageMock.getPlatformKPIs.mockResolvedValue([revenueKpi]);
  storageMock.updateKPI.mockResolvedValue({});
  storageMock.getKPIProgress.mockResolvedValue([]);
  storageMock.recordKPIProgress.mockResolvedValue({});
  storageMock.getPlatformBenchmarks.mockResolvedValue([revenueBenchmark]);
  storageMock.updateBenchmark.mockResolvedValue({});
  storageMock.getBenchmarkHistory.mockResolvedValue([]);
  storageMock.recordBenchmarkHistory.mockResolvedValue({});
  storageMock.getKPI.mockResolvedValue(revenueKpi);
  storageMock.getBenchmark.mockResolvedValue(revenueBenchmark);
  storageMock.getNotifications.mockResolvedValue([]);
  refreshCampaignCurrentValuesForCampaignMock.mockResolvedValue(undefined);

  ga4ServiceMock.getMetricsWithAutoRefresh.mockResolvedValue({ sessions: 10, users: 5, conversions: 2, revenue: 100 });
  ga4ServiceMock.getAcquisitionBreakdown.mockResolvedValue({
    rows: [{ campaign: "shopify_campaign", sessions: 10, users: 5, conversions: 2, revenue: 100 }],
    totals: { sessions: 10, users: 5, conversions: 2, revenue: 100 },
  });
  ga4ServiceMock.getLandingPagesReport.mockResolvedValue({ rows: [] });
  ga4ServiceMock.getConversionEventsReport.mockResolvedValue({ rows: [] });
  ga4ServiceMock.getTimeSeriesData.mockResolvedValue([dailyRow]);
  ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({
    revenueMetric: "purchaseRevenue",
    currencyCode: "USD",
    totals: { sessions: 10, users: 5, conversions: 2, pageviews: 20, revenue: 100 },
  });
}

describe("Shopify downstream value/content regression guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T12:00:00.000Z"));
    resetMocks();
    setCommonShopifyFinancialMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders scheduled GA4 PDF content with Shopify source revenue and total revenue", async () => {
    const buffer = await buildGA4ScheduledPdfAttachment({
      report: {
        id: "report-1",
        campaignId: campaign.id,
        name: "Shopify Downstream Report",
        reportType: "custom",
        configuration: JSON.stringify({
          sections: { overview: true, kpis: true, benchmarks: true, ads: true },
          selectedKpiIds: [revenueKpi.id],
          selectedBenchmarkIds: [revenueBenchmark.id],
          subsections: {
            overview: { revenue: true, performance: true, campaignBreakdown: true },
            kpis: { items: true },
            benchmarks: { items: true },
            ads: { summary: true, allCampaigns: true, revenueBreakdown: true },
          },
        }),
      },
      reportName: "Shopify Downstream Report",
      windowStart: "2026-06-01",
      windowEnd: "2026-07-04",
      campaignName: campaign.name,
    });

    const text = pdfTextCalls.join("\n");
    expect(buffer?.length).toBeGreaterThan(100);
    expect(text).toContain("TOTAL REVENUE");
    expect(text).toContain("USD 299.98");
    expect(pdfTextCalls.filter((value) => value === "USD 299.98").length).toBeGreaterThanOrEqual(2);
    expect(text).toContain("Revenue Sources");
    expect(text).toContain("Shopify");
    expect(text).toContain("USD 199.98");
    expect(text).toContain("GA4 Revenue (Imported to Date)");
    expect(text).toContain("Shopify (source-to-date; exclud");
    expect(text).toContain("shopify_campaign");
    expect(text).toContain("Revenue KPI");
    expect(text).toContain("Revenue Benchmark");
    expect(text).toContain("299.98");
    expect(ga4ServiceMock.getAcquisitionBreakdown).toHaveBeenNthCalledWith(
      1,
      campaign.id,
      storageMock,
      "2026-07-02",
      "properties/123",
      2000,
      "shopify_campaign",
      "2026-07-04",
      false,
      false,
      "USD",
      true,
    );
    expect(storageMock.getRevenueBreakdownBySource).toHaveBeenCalledWith(
      campaign.id,
      "1900-01-01",
      "2026-07-05",
      "ga4",
    );
  });

  it("keeps scheduled Ad Comparison on import-to-date rows without changing Overview rows", async () => {
    storageMock.getCampaign.mockResolvedValue({
      ...campaign,
      ga4CampaignFilter: JSON.stringify(["overview_window", "ad_import_to_date", "ad_email", "ad_social"]),
    });
    ga4ServiceMock.getAcquisitionBreakdown.mockReset()
      .mockResolvedValueOnce({
        rows: [{ campaign: "overview_window", sessions: 7, users: 7, conversions: 1, revenue: 700 }],
      })
      .mockResolvedValueOnce({
        rows: [
          { campaign: "ad_import_to_date", sessions: 55, users: 55, conversions: 55, revenue: 12409.8 },
          { campaign: "ad_email", sessions: 43, users: 43, conversions: 43, revenue: 8952.6 },
          { campaign: "ad_social", sessions: 40, users: 40, conversions: 40, revenue: 9476.6 },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ campaign: "overview_window", sessions: 7, users: 7, conversions: 1, revenue: 100 }],
        totals: { revenue: 100 },
      });

    await buildGA4ScheduledPdfAttachment({
      report: {
        id: "report-window-parity",
        campaignId: campaign.id,
        name: "Window parity",
        reportType: "custom",
        configuration: JSON.stringify({
          sections: { overview: true, ads: true },
          subsections: {
            overview: { campaignBreakdown: true },
            ads: { summary: true, bestWorst: true, allCampaigns: true, revenueBreakdown: true },
          },
        }),
      },
      reportName: "Window parity",
      windowStart: "2026-06-01",
      windowEnd: "2026-07-04",
      campaignName: campaign.name,
    });

    const text = pdfTextCalls.join("\n");
    expect(text).toContain("overview_window");
    expect(text).toContain("ad_import_to_date");
    expect(pdfTextCalls.slice(pdfTextCalls.indexOf("Top Campaigns by Sessions"), pdfTextCalls.indexOf("All Campaigns"))).toContain("7");
    expect(text).toContain("USD 30,839.00");
    expect(text).toContain("GA4 Revenue (Imported to Date)");
    expect(text).toContain("BEST PERFORMING");
    expect(text).toContain("HIGHEST CONVERSION RATE");
    expect(text).toContain("NEEDS ATTENTION");
    expect(text).toContain("Top Campaigns by Sessions");
    expect(text).toContain("TOTAL SESSIONS");
    expect(text).toContain("CAMPAIGNS COMPARED");
    expect(text).toContain("USERS");
    expect(text).not.toContain("GA4 REVENUE (30 DAYS)");
    expect(ga4ServiceMock.getAcquisitionBreakdown).toHaveBeenNthCalledWith(
      1,
      campaign.id,
      storageMock,
      "2026-07-02",
      "properties/123",
      2000,
      ["overview_window", "ad_import_to_date", "ad_email", "ad_social"],
      "2026-07-04",
      false,
      false,
      "USD",
      true,
    );
    expect(ga4ServiceMock.getAcquisitionBreakdown).toHaveBeenNthCalledWith(
      2,
      campaign.id,
      storageMock,
      "2026-07-02",
      "properties/123",
      2000,
      ["overview_window", "ad_import_to_date", "ad_email", "ad_social"],
      "2026-07-04",
      false,
      false,
      "USD",
      true,
    );
    expect(ga4ServiceMock.getAcquisitionBreakdown).toHaveBeenNthCalledWith(
      3,
      campaign.id,
      storageMock,
      "2026-06-01",
      "properties/123",
      2000,
      ["overview_window", "ad_import_to_date", "ad_email", "ad_social"],
      "2026-07-04",
      false,
      false,
      "USD",
      true,
    );
  });

  it("keeps the scheduled Ad Comparison chart and summary on the saved selector", async () => {
    const descendingFractionalRows = Array.from({ length: 9 }, (_, index) => ({
      campaign: `gamma-${index + 1}`,
      sessions: 10,
      users: 8,
      conversions: (9 - index) / 10,
      revenue: 0,
    }));
    storageMock.getCampaign.mockResolvedValue({
      ...campaign,
      ga4CampaignFilter: JSON.stringify(["Alpha", "Beta", ...descendingFractionalRows.map((row) => row.campaign)]),
    });
    ga4ServiceMock.getAcquisitionBreakdown.mockResolvedValue({
      rows: [
        { campaign: "Alpha", sessions: 60, users: 30, conversions: 3, revenue: 100 },
        { campaign: "alpha", sessions: 40, users: 20, conversions: 7, revenue: 50 },
        { campaign: "Beta", sessions: 10, users: 9, conversions: 5, revenue: 25 },
        ...descendingFractionalRows,
      ],
      totals: { revenue: 175 },
    });

    await buildGA4ScheduledPdfAttachment({
      report: {
        id: "report-ad-selector",
        campaignId: campaign.id,
        name: "Ad selector parity",
        reportType: "custom",
        configuration: JSON.stringify({
          adComparisonMetric: "conversionRate",
          sections: { ads: true },
          subsections: {
            ads: { topCampaigns: true, bestWorst: false, allCampaigns: false, revenueBreakdown: false },
          },
        }),
      },
      reportName: "Ad selector parity",
      windowStart: "2026-06-01",
      windowEnd: "2026-07-04",
      campaignName: campaign.name,
    });

    const text = pdfTextCalls.join("\n");
    expect(text).toContain("Top Campaigns by Conversion Rate");
    expect(text).toContain("OVERALL CONVERSION RATE");
    expect(text).toContain("9.8%");
    expect(text).toContain("CAMPAIGNS COMPARED");
    expect(text).toContain("11");
    expect(text).not.toContain("gamma-9");
    expect(text).not.toContain("alpha");
    expect(pdfTextCalls.indexOf("Beta")).toBeLessThan(pdfTextCalls.indexOf("Alpha"));
  });

  it("deduplicates chart/summary case variants without changing scheduled All Campaigns rows", async () => {
    storageMock.getCampaign.mockResolvedValue({
      ...campaign,
      ga4CampaignFilter: JSON.stringify(["Alpha", "Beta"]),
    });
    ga4ServiceMock.getAcquisitionBreakdown.mockResolvedValue({
      rows: [
        { campaign: "Alpha", sessions: 60, users: 30, conversions: 3, revenue: 100 },
        { campaign: "alpha", sessions: 40, users: 20, conversions: 7, revenue: 50 },
        { campaign: "Beta", sessions: 10, users: 9, conversions: 5, revenue: 25 },
      ],
      totals: { revenue: 175 },
    });

    await buildGA4ScheduledPdfAttachment({
      report: {
        id: "report-ad-case-boundary",
        campaignId: campaign.id,
        name: "Ad case boundary",
        reportType: "custom",
        configuration: JSON.stringify({
          adComparisonMetric: "sessions",
          sections: { ads: true },
          subsections: {
            ads: { topCampaigns: true, bestWorst: false, allCampaigns: true, revenueBreakdown: false },
          },
        }),
      },
      reportName: "Ad case boundary",
      windowStart: "2026-06-01",
      windowEnd: "2026-07-04",
      campaignName: campaign.name,
    });

    const allCampaignsIndex = pdfTextCalls.indexOf("All Campaigns");
    expect(allCampaignsIndex).toBeGreaterThan(-1);
    expect(pdfTextCalls.slice(0, allCampaignsIndex)).not.toContain("alpha");
    expect(pdfTextCalls.slice(allCampaignsIndex)).toEqual(expect.arrayContaining(["Alpha", "alpha", "Beta"]));
    expect(pdfTextCalls).toContain("CAMPAIGNS COMPARED");
    expect(pdfTextCalls).toContain("2");
  });

  it("fails a scheduled Ad Comparison report closed before provider work without saved campaign scope", async () => {
    storageMock.getCampaign.mockResolvedValue({ ...campaign, ga4CampaignFilter: "" });

    await expect(buildGA4ScheduledPdfAttachment({
      report: {
        id: "report-ad-missing-scope",
        campaignId: campaign.id,
        name: "Missing Ad scope",
        reportType: "ads",
        configuration: JSON.stringify({ adComparisonMetric: "sessions" }),
      },
      reportName: "Missing Ad scope",
      windowStart: "2026-06-01",
      windowEnd: "2026-07-04",
      campaignName: campaign.name,
    })).rejects.toThrow("GA4_AD_COMPARISON_REPORT_INPUT_UNAVAILABLE: Campaign scope");

    expect(ga4ServiceMock.getAcquisitionBreakdown).not.toHaveBeenCalled();
  });

  it("renders every saved Ad Comparison metric with matching ordering, total, and label", async () => {
    storageMock.getCampaign.mockResolvedValue({
      ...campaign,
      ga4CampaignFilter: JSON.stringify(["Alpha", "Beta"]),
    });
    ga4ServiceMock.getAcquisitionBreakdown.mockResolvedValue({
      rows: [
        { campaign: "Alpha", sessions: 10, users: 100, conversions: 1, revenue: 5 },
        { campaign: "Beta", sessions: 20, users: 50, conversions: 5, revenue: 100 },
      ],
      totals: { revenue: 105 },
    });
    const cases = [
      { metric: "sessions", label: "Sessions", summary: "TOTAL SESSIONS", total: "30", first: "Beta" },
      { metric: "users", label: "Users", summary: "TOTAL USERS", total: "150", first: "Alpha" },
      { metric: "conversions", label: "Conversions", summary: "TOTAL CONVERSIONS", total: "6", first: "Beta" },
      { metric: "revenue", label: "Revenue", summary: "CAMPAIGN BREAKDOWN REVENUE", total: "USD 105.00", first: "Beta" },
      { metric: "conversionRate", label: "Conversion Rate", summary: "OVERALL CONVERSION RATE", total: "20%", first: "Beta" },
    ];

    for (const expected of cases) {
      pdfTextCalls.length = 0;
      await buildGA4ScheduledPdfAttachment({
        report: {
          id: `report-ad-${expected.metric}`,
          campaignId: campaign.id,
          name: `Ad ${expected.label}`,
          reportType: "custom",
          configuration: JSON.stringify({
            adComparisonMetric: expected.metric,
            sections: { ads: true },
            subsections: {
              ads: { topCampaigns: true, bestWorst: false, allCampaigns: false, revenueBreakdown: false },
            },
          }),
        },
        reportName: `Ad ${expected.label}`,
        windowStart: "2026-06-01",
        windowEnd: "2026-07-04",
        campaignName: campaign.name,
      });

      expect(pdfTextCalls).toContain(`Top Campaigns by ${expected.label}`);
      expect(pdfTextCalls).toContain(expected.summary);
      expect(pdfTextCalls).toContain(expected.total);
      const other = expected.first === "Alpha" ? "Beta" : "Alpha";
      expect(pdfTextCalls.indexOf(expected.first)).toBeLessThan(pdfTextCalls.indexOf(other));
      if (expected.metric === "users") {
        expect(pdfTextCalls).toContain("Users are summed campaign-row counts and are non-additive.");
      }
    }
  });

  it("uses Overview Campaign Breakdown revenue in chart and leader cards while retaining native All Campaigns values", async () => {
    storageMock.getCampaign.mockResolvedValue({ ...campaign, ga4CampaignFilter: JSON.stringify(["Alpha", "Beta"]) });
    storageMock.getRevenueSources.mockResolvedValue([{
      ...revenueSource,
      mappingConfig: {
        campaignValueRevenueTotals: [{ campaignValue: "alpha_store", revenue: 200 }],
        campaignMappings: [{ crmValue: "alpha_store", linkedinCampaignName: "Alpha", linkedinCampaignUrn: "Alpha" }],
      },
    }]);
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([{ sourceId: revenueSource.id, sourceType: "shopify", displayName: "Shopify", currency: "USD", revenue: 200 }]);
    ga4ServiceMock.getAcquisitionBreakdown.mockImplementation(async (_campaignId: string, _storage: any, startDate: string) => startDate === "2026-06-01"
      ? { rows: [{ campaign: "Alpha", revenue: 5 }, { campaign: "Beta", revenue: 100 }], totals: { revenue: 105 } }
      : { rows: [{ campaign: "Alpha", sessions: 10, users: 10, conversions: 1, revenue: 500 }, { campaign: "Beta", sessions: 20, users: 20, conversions: 5, revenue: 1000 }], totals: { revenue: 1500 } });

    await buildGA4ScheduledPdfAttachment({
      report: { id: "report-overview-chart", campaignId: campaign.id, name: "Overview chart parity", reportType: "custom",
        configuration: JSON.stringify({ adComparisonMetric: "revenue", sections: { ads: true }, subsections: { ads: { topCampaigns: true, bestWorst: true, allCampaigns: true } } }) },
      reportName: "Overview chart parity", windowStart: "2026-06-01", windowEnd: "2026-07-04", campaignName: campaign.name,
    });

    expect(pdfTextCalls).toContain("CAMPAIGN BREAKDOWN REVENUE");
    expect(pdfTextCalls).toContain("USD 305.00");
    expect(pdfTextCalls[pdfTextCalls.indexOf("BEST PERFORMING") + 1]).toBe("Beta");
    expect(pdfTextCalls[pdfTextCalls.indexOf("HIGHEST CONVERSION RATE") + 1]).toBe("Beta");
    expect(pdfTextCalls).toContain("25.00% CR - USD 100.00 revenue");
    expect(pdfTextCalls.slice(pdfTextCalls.indexOf("All Campaigns"))).toEqual(expect.arrayContaining(["USD 500.00", "USD 1,000.00"]));
  });

  it("builds leader-card-only reports from Overview rows without requesting native Ad Comparison detail", async () => {
    storageMock.getCampaign.mockResolvedValue({ ...campaign, ga4CampaignFilter: JSON.stringify(["Alpha", "Beta"]) });
    ga4ServiceMock.getAcquisitionBreakdown.mockResolvedValue({
      rows: [{ campaign: "Alpha", sessions: 10, users: 10, conversions: 1, revenue: 50 },
        { campaign: "Beta", sessions: 20, users: 20, conversions: 5, revenue: 50 }],
      totals: { revenue: 100 },
    });

    await buildGA4ScheduledPdfAttachment({
      report: { id: "report-leader-only", campaignId: campaign.id, name: "Leader cards", reportType: "custom",
        configuration: JSON.stringify({ sections: { ads: true }, subsections: { ads: { bestWorst: true } } }) },
      reportName: "Leader cards", windowStart: "2026-06-01", windowEnd: "2026-07-04", campaignName: campaign.name,
    });

    expect(ga4ServiceMock.getAcquisitionBreakdown).toHaveBeenCalledTimes(2);
    expect(pdfTextCalls).toEqual(expect.arrayContaining(["BEST PERFORMING", "HIGHEST CONVERSION RATE", "NEEDS ATTENTION"]));
    expect(pdfTextCalls).not.toContain("All Campaigns");
  });

  it("keeps an unmatched unavailable source outside scheduled Campaign Breakdown rows and exports every row", async () => {
    const campaignNames = Array.from({ length: 16 }, (_, index) => index === 0 ? "shopify_campaign" : `campaign-${index + 1}`);
    const rows = campaignNames.map((name, index) => ({
      campaign: name,
      sessions: 16 - index,
      users: 16 - index,
      conversions: index === 15 ? 0 : 1,
      revenue: index === 0 ? 100 : 0,
    }));
    storageMock.getCampaign.mockResolvedValue({ ...campaign, ga4CampaignFilter: JSON.stringify(campaignNames) });
    storageMock.getRevenueSources.mockResolvedValue([
      revenueSource,
      {
        id: "unmatched-source",
        sourceType: "csv",
        displayName: "Unmatched",
        currency: "USD",
        isActive: true,
        mappingConfig: { campaignValueRevenueTotals: [{ campaignValue: "outside", revenue: 50 }] },
      },
    ]);
    ga4ServiceMock.getAcquisitionBreakdown.mockResolvedValue({
      rows,
      totals: { sessions: 136, users: 136, conversions: 15, revenue: 100 },
    });

    await buildGA4ScheduledPdfAttachment({
      report: {
        id: "report-breakdown-only",
        campaignId: campaign.id,
        name: "Campaign Breakdown only",
        reportType: "custom",
        configuration: JSON.stringify({
          sections: { overview: true },
          subsections: { overview: { campaignBreakdown: true } },
        }),
      },
      reportName: "Campaign Breakdown only",
      windowStart: "2026-06-01",
      windowEnd: "2026-07-04",
      campaignName: campaign.name,
    });

    expect(pdfTextCalls).toContain("Campaign Breakdown");
    expect(pdfTextCalls).toContain("campaign-16");
    expect(pdfTextCalls.filter((value) => value === "USD 299.98")).toHaveLength(1);
  });

  it("fails scheduled Campaign Breakdown closed when a selected mapped source is not materialized", async () => {
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([]);

    await expect(buildGA4ScheduledPdfAttachment({
      report: {
        id: "report-breakdown-missing-materialization",
        campaignId: campaign.id,
        name: "Campaign Breakdown missing materialization",
        reportType: "custom",
        configuration: JSON.stringify({
          sections: { overview: true },
          subsections: { overview: { campaignBreakdown: true } },
        }),
      },
      reportName: "Campaign Breakdown missing materialization",
      windowStart: "2026-06-01",
      windowEnd: "2026-07-04",
      campaignName: campaign.name,
    })).rejects.toThrow("GA4_OVERVIEW_REPORT_INPUT_UNAVAILABLE: Campaign Breakdown");
  });

  it("fails the deterministic scheduled Ad Comparison path closed when GA4 rows are unavailable", async () => {
    ga4ServiceMock.getAcquisitionBreakdown.mockRejectedValue(new Error("provider unavailable"));

    await expect(buildGA4ScheduledPdfAttachment({
      report: {
        id: "report-ads-failure",
        campaignId: campaign.id,
        name: "Ad Comparison failure",
        reportType: "custom",
        configuration: JSON.stringify({
          sections: { ads: true },
          subsections: { ads: { summary: true } },
        }),
      },
      reportName: "Ad Comparison failure",
      windowStart: "2026-06-01",
      windowEnd: "2026-07-04",
      campaignName: campaign.name,
    })).rejects.toThrow("GA4_AD_COMPARISON_REPORT_INPUT_UNAVAILABLE: GA4 Overview Campaign Breakdown");
  });

  it("fails the deterministic scheduled revenue provenance path closed when its read fails", async () => {
    storageMock.getRevenueBreakdownBySource.mockRejectedValue(new Error("source unavailable"));

    await expect(buildGA4ScheduledPdfAttachment({
      report: {
        id: "report-ads-revenue-failure",
        campaignId: campaign.id,
        name: "Ad Comparison revenue failure",
        reportType: "custom",
        configuration: JSON.stringify({
          sections: { ads: true },
          subsections: { ads: { revenueBreakdown: true } },
        }),
      },
      reportName: "Ad Comparison revenue failure",
      windowStart: "2026-06-01",
      windowEnd: "2026-07-04",
      campaignName: campaign.name,
    })).rejects.toThrow("GA4_AD_COMPARISON_REPORT_INPUT_UNAVAILABLE: Imported revenue provenance");
  });

  it("does not combine Shopify revenue with an unverified persisted GA4 fallback", async () => {
    ga4ServiceMock.getTotalsWithRevenue.mockRejectedValue(new Error("provider unavailable"));

    await expect(buildGA4ScheduledPdfAttachment({
      report: {
        id: "report-currency-failure",
        campaignId: campaign.id,
        name: "Currency verification failure",
        reportType: "custom",
        configuration: JSON.stringify({
          sections: { overview: true },
          subsections: { overview: { revenue: true } },
        }),
      },
      reportName: "Currency verification failure",
      windowStart: "2026-06-01",
      windowEnd: "2026-07-04",
      campaignName: campaign.name,
    })).rejects.toThrow("GA4_OVERVIEW_REPORT_INPUT_UNAVAILABLE: Revenue");
  });

  it("persists GA4 KPI and Benchmark row values from the Shopify imported revenue total", async () => {
    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-04", suppressAlerts: true });

    expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledWith(campaign.id, "1900-01-01", "2026-07-04", "ga4");
    expect(storageMock.updateKPI).toHaveBeenCalledWith(revenueKpi.id, { currentValue: "299.98" });
    expect(storageMock.updateBenchmark).toHaveBeenCalledWith(revenueBenchmark.id, { currentValue: "299.98" });
  });

  it("returns notification metadata with the current Shopify-backed GA4 revenue value", async () => {
    storageMock.getNotifications.mockResolvedValue([
      {
        id: "notification-1",
        campaignId: campaign.id,
        type: "performance-alert",
        title: "Old alert title",
        message: "Old alert message",
        read: false,
        createdAt: "2026-07-05T09:00:00.000Z",
        metadata: JSON.stringify({ alertType: "performance-alert", kpiId: revenueKpi.id }),
      },
    ]);

    const app = express();
    const server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/notifications`);
      const body = await response.json();
      const metadata = JSON.parse(body[0].metadata);

      expect(response.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].title).toBe("GA4 KPI Alert: Revenue KPI");
      expect(metadata.currentValue).toBe("299.98");
      expect(metadata.thresholdValue).toBe("350");
      expect(metadata.actionUrl).toBe(`/campaigns/${campaign.id}/ga4-metrics?tab=kpis&highlight=${revenueKpi.id}`);
      expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledWith(campaign.id, "1900-01-01", "2026-07-04", "ga4");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
