import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pdfTextCalls = vi.hoisted((): string[] => []);
const pdfDrawCalls = vi.hoisted(() => ({ rects: 0, roundedRects: 0, images: 0, fillColors: [] as string[] }));
const aggregateCampaignMetricsMock = vi.hoisted(() => vi.fn());
const getCampaignMetricTotalsMock = vi.hoisted(() => vi.fn());
const getCampaignMetricTotalsAtDateMock = vi.hoisted(() => vi.fn());
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getCampaignKPIs: vi.fn(),
  getCampaignBenchmarks: vi.fn(),
  getPlatformKPIs: vi.fn(),
  getPlatformBenchmarks: vi.fn(),
  getPrimaryGA4Connection: vi.fn(),
  getGA4DailyMetrics: vi.fn(),
  getComparisonData: vi.fn(),
  getRevenueBreakdownBySource: vi.fn(),
  getSpendBreakdownBySource: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./scheduler", () => ({ aggregateCampaignMetrics: aggregateCampaignMetricsMock }));
vi.mock("./utils/campaign-current-values", () => ({
  getCampaignMetricTotals: getCampaignMetricTotalsMock,
  getCampaignMetricTotalsAtDate: getCampaignMetricTotalsAtDateMock,
}));
vi.mock("./db", () => ({ db: {} }));
vi.mock("./services/email-service", () => ({ emailService: {} }));
vi.mock("./ga4-kpi-benchmark-jobs", () => ({ runGA4DailyKPIAndBenchmarkJobs: vi.fn() }));
vi.mock("./utils/mailgun-delivery", () => ({
  mapMailgunDeliveryToAlertEmailStatus: vi.fn(),
  waitForMailgunDelivery: vi.fn(),
}));
vi.mock("jspdf", () => ({
  jsPDF: class {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    setFontSize() {}
    setFont() {}
    setTextColor() {}
    setFillColor(...values: number[]) { pdfDrawCalls.fillColors.push(values.join(",")); }
    setDrawColor() {}
    setLineWidth() {}
    line() {}
    rect() { pdfDrawCalls.rects += 1; }
    roundedRect() { pdfDrawCalls.roundedRects += 1; }
    addImage() { pdfDrawCalls.images += 1; }
    addPage() {}
    splitTextToSize(value: any) { return [String(value)]; }
    text(value: any) {
      (Array.isArray(value) ? value : [value]).forEach((item) => pdfTextCalls.push(String(item)));
    }
    output(kind: string) {
      return kind === "nodebuffer" ? Buffer.from("x".repeat(256)) : new ArrayBuffer(256);
    }
  },
}));

import { buildPdfAttachmentForReport } from "./report-scheduler";

const metric = (value: number, sources = ["ga4"]) => ({ available: true, value, sources, unavailableReasons: [] });
const performanceSummary = {
  version: "performance_summary_aggregate_v3",
  currentValueWindow: {
    mode: "initial_import_to_latest_completed_day",
    startDate: "2026-07-02",
    endDate: "2026-08-27",
    dataThroughDate: "2026-08-27",
    reportingTimeZone: "Europe/Amsterdam",
  },
  totals: {
    users: metric(1184),
    sessions: metric(1179),
    conversions: metric(152),
    revenue: metric(51072.99),
    spend: metric(2699.75, ["canonical_spend_sources"]),
    cvr: metric(12.9),
    cpa: metric(17.76),
    roas: metric(18.92),
    roi: metric(1791.74),
  },
  sources: [{
    id: "ga4",
    label: "Google Analytics",
    category: "web_analytics",
    connected: true,
    includedMetrics: ["users", "sessions", "conversions", "revenue"],
  }],
};

describe("scheduled Performance Summary PDF", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T12:00:00.000Z"));
    pdfTextCalls.length = 0;
    pdfDrawCalls.rects = 0;
    pdfDrawCalls.roundedRects = 0;
    pdfDrawCalls.images = 0;
    pdfDrawCalls.fillColors.length = 0;
    vi.clearAllMocks();
    storageMock.getCampaign.mockResolvedValue({
      id: "campaign-1",
      name: "Campaign",
      currency: "USD",
      budget: "100000",
      pacingStartDate: "2026-07-01",
      pacingEndDate: "2026-12-31",
      reportingTimeZone: "Europe/Amsterdam",
    });
    storageMock.getCampaignKPIs.mockResolvedValue([]);
    storageMock.getCampaignBenchmarks.mockResolvedValue([]);
    storageMock.getPlatformKPIs.mockResolvedValue([
      { id: "kpi-cpa", name: "CPA", metric: "cpa", currentValue: "10.76", targetValue: "9", unit: "$", priority: "critical" },
      { id: "kpi-sessions", name: "Total Sessions", metric: "sessions", currentValue: "1183", targetValue: "950", unit: "count" },
    ]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([
      { id: "bm-cvr", name: "Conversion Rate", metric: "conversion_rate", currentValue: "12.85", benchmarkValue: "15", unit: "%" },
    ]);
    storageMock.getPrimaryGA4Connection.mockResolvedValue({ propertyId: "properties/123", importStartDate: "2026-07-02" });
    storageMock.getGA4DailyMetrics.mockImplementation((_campaignId: string, _propertyId: string, startDate: string) => Promise.resolve(startDate === "2026-07-02"
      ? [{ date: "2026-07-02", users: 1184, sessions: 1183, conversions: 152, pageviews: 1600, engagedSessions: 809 }]
      : [
          { date: "2026-08-21", sessions: 10, conversions: 5 },
          { date: "2026-08-27", sessions: 20, conversions: 7 },
        ]));
    storageMock.getComparisonData.mockResolvedValue({
      previous: {
        metrics: {
          performanceSummary: {
            version: "performance_summary_aggregate_v3",
            totals: { spend: metric(2500, ["canonical_spend_sources"]) },
          },
        },
      },
    });
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([
      { sourceId: "revenue-1", displayName: "Salesforce", sourceType: "salesforce", revenue: 16799.99, currency: "USD" },
    ]);
    storageMock.getSpendBreakdownBySource.mockResolvedValue([
      { sourceId: "spend-1", displayName: "Google Ads", sourceType: "google_ads", spend: 2699.75, currency: "USD" },
    ]);
    getCampaignMetricTotalsMock.mockResolvedValue({
      users: 1184,
      sessions: 1183,
      conversions: 152,
      financialConversions: 251,
      revenue: 72766.69,
      ga4Revenue: 55966.7,
      spend: 2699.75,
      revenueBySource: new Map([["revenue-1", 16799.99]]),
      spendBySource: new Map([["spend-1", 2699.75]]),
      revenueAvailable: true,
      spendAvailable: true,
      ga4Available: true,
      ga4RevenueAvailable: true,
      financialConversionsAvailable: true,
    });
    aggregateCampaignMetricsMock.mockResolvedValue({
      detailedMetrics: {
        performanceSummary,
        budgetPacing: {
          version: "budget_pacing_v1",
          campaignId: "campaign-1",
          periodStartDate: "2026-07-01",
          periodEndDate: "2026-12-31",
          dataThroughDate: "2026-08-27",
          currency: "USD",
          spend: metric(2400, ["canonical_spend_sources"]),
        },
      },
    });
  });

  afterEach(() => vi.useRealTimers());

  it("normalizes legacy tabs into one consolidated UI-equivalent body", async () => {
    const buffer = await buildPdfAttachmentForReport({
      report: {
        id: "report-1",
        name: "Performance report",
        platformType: "campaign_deepdive",
        campaignId: "campaign-1",
        reportType: "custom",
        configuration: {
          reportType: "performance-summary",
          selectedSections: [
            "performance-summary:overview",
            "performance-summary:health",
            "performance-summary:changes",
            "performance-summary:insights",
          ],
        },
      },
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
      isTest: true,
    });

    expect(buffer?.length).toBeGreaterThan(100);
    for (const heading of ["Key Outcomes", "Campaign Health", "Top Priority Action", "Recent Movement", "Recommended Actions"]) {
      expect(pdfTextCalls.filter((text) => text === heading)).toHaveLength(1);
    }
    expect(pdfDrawCalls.rects).toBeGreaterThan(0);
    expect(pdfDrawCalls.roundedRects).toBeGreaterThan(8);
    expect(pdfDrawCalls.images).toBe(1);
    expect(pdfDrawCalls.fillColors).toContain("254,249,243");
    expect(pdfDrawCalls.fillColors).toContain("244,174,126");
    expect(pdfTextCalls).toContain("TOTAL USERS");
    expect(pdfTextCalls).toContain("1,184");
    expect(pdfTextCalls).toContain("TOTAL SESSIONS");
    expect(pdfTextCalls).toContain("1,183");
    expect(pdfTextCalls).toContain("TOTAL CONVERSIONS");
    expect(pdfTextCalls).toContain("152");
    expect(pdfTextCalls).toContain("TOTAL REVENUE");
    expect(pdfTextCalls).toContain("$72,766.69");
    expect(pdfTextCalls).toContain("TOTAL SPEND");
    expect(pdfTextCalls).toContain("$2,699.75");
    expect(pdfTextCalls.some((text) => text.includes("KPI below target: CPA"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Previous 1,153"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Previous $2,500.00"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("exact-date Revenue unavailable"))).toBe(true);
    expect(pdfTextCalls).toContain("Sources: GA4 native revenue, Imported revenue");
    expect(pdfTextCalls).not.toContain("Overview");
    expect(pdfTextCalls).not.toContain("What's Changed");
    expect(pdfTextCalls).not.toContain("Insights");
    expect(pdfTextCalls).not.toContain("Connected-source performance");
    expect(pdfTextCalls).not.toContain("Campaign KPI rows");
    expect(pdfTextCalls).not.toContain("Campaign Benchmark rows");
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith("campaign-1", "properties/123", "2026-08-21", "2026-08-27");
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith("campaign-1", "properties/123", "2026-07-02", "2026-08-27");
    expect(storageMock.getComparisonData).toHaveBeenCalledWith("campaign-1", "last_week", "Europe/Amsterdam", "2026-08-20");
    expect(getCampaignMetricTotalsMock).toHaveBeenCalledWith("campaign-1", true);
  });

  it("renders Budget & Financial Analysis with the same branded report system", async () => {
    const buffer = await buildPdfAttachmentForReport({
      report: {
        id: "report-financial",
        name: "Budget & financials",
        platformType: "campaign_deepdive",
        campaignId: "campaign-1",
        reportType: "custom",
        configuration: { reportType: "financial-analysis", selectedSections: ["financial-analysis:overview"] },
      },
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
      isTest: true,
    });

    expect(buffer?.length).toBeGreaterThan(100);
    expect(pdfDrawCalls.images).toBe(1);
    expect(pdfDrawCalls.fillColors).toContain("254,249,243");
    expect(pdfDrawCalls.fillColors).toContain("244,174,126");
    for (const heading of ["Budget & Financial Analysis", "Financial Position", "Budget & Pacing", "Allocation & Sources", "Executive Action"]) {
      expect(pdfTextCalls).toContain(heading);
    }
    expect(pdfTextCalls).toContain("Campaign Financial Report");
    expect(pdfTextCalls).toContain("TOTAL REVENUE");
    expect(pdfTextCalls).toContain("$51,072.99");
    expect(pdfTextCalls).toContain("BUDGET USED");
    expect(pdfTextCalls).toContain("$2,400.00");
    expect(pdfTextCalls).toContain("Revenue Sources");
    expect(pdfTextCalls).toContain("Spend Sources");
    expect(pdfTextCalls).toContain("Positive financial return");
    expect(pdfTextCalls).not.toContain("Included sections");
    expect(pdfTextCalls).not.toContain("Selected section content");
    expect(storageMock.getRevenueBreakdownBySource).toHaveBeenCalledWith("campaign-1", "1900-01-01", "2026-08-27", "ga4");
    expect(storageMock.getSpendBreakdownBySource).toHaveBeenCalledWith("campaign-1", "1900-01-01", "2026-08-27", "ga4");
  });

  it("fails closed when the UI-aligned Performance Summary values are unavailable", async () => {
    getCampaignMetricTotalsMock.mockResolvedValueOnce(null);

    await expect(buildPdfAttachmentForReport({
      report: {
        id: "report-1",
        name: "Performance report",
        platformType: "campaign_deepdive",
        campaignId: "campaign-1",
        reportType: "custom",
        configuration: { reportType: "performance-summary", selectedSections: ["performance-summary:overview"] },
      },
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
      isTest: true,
    })).rejects.toThrow("Performance Summary UI-aligned values are unavailable");

    expect(pdfTextCalls).not.toContain("- Total Sessions: 1,179");
  });

  it("does not fall back to a differing aggregate revenue value", async () => {
    getCampaignMetricTotalsMock.mockResolvedValueOnce({
      users: 1184,
      sessions: 1183,
      conversions: 152,
      revenue: 72766.69,
      ga4Revenue: 55966.7,
      spend: 2699.75,
      revenueBySource: new Map([["revenue-1", 16799.99]]),
      spendBySource: new Map([["spend-1", 2699.75]]),
      revenueAvailable: false,
      spendAvailable: true,
      ga4Available: true,
      ga4RevenueAvailable: false,
    });

    const buffer = await buildPdfAttachmentForReport({
      report: {
        id: "report-1",
        name: "Performance report",
        platformType: "campaign_deepdive",
        campaignId: "campaign-1",
        reportType: "custom",
        configuration: { reportType: "performance-summary", selectedSections: ["performance-summary:overview"] },
      },
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
      isTest: true,
    });

    expect(buffer?.length).toBeGreaterThan(100);
    expect(pdfTextCalls).toContain("Unavailable - Performance Summary UI value unavailable");
    expect(pdfTextCalls).not.toContain("$51,072.99");
  });

  it("scores CPA from paired financial conversions instead of Summary traffic conversions", async () => {
    storageMock.getPlatformKPIs.mockResolvedValueOnce([
      { id: "kpi-cpa", name: "CPA", metric: "cpa", currentValue: null, targetValue: "15", unit: "$", priority: "critical" },
    ]);
    storageMock.getPlatformBenchmarks.mockResolvedValueOnce([]);

    await buildPdfAttachmentForReport({
      report: {
        id: "report-cpa",
        name: "Performance CPA report",
        platformType: "campaign_deepdive",
        campaignId: "campaign-1",
        reportType: "custom",
        configuration: { reportType: "performance-summary", selectedSections: ["performance-summary:overview"] },
      },
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
      isTest: true,
    });

    expect(2699.75 / 251).toBeLessThan(15);
    expect(2699.75 / 152).toBeGreaterThan(15);
    expect(pdfTextCalls).toContain("Cost Per Acquisition on target");
    expect(pdfTextCalls.some((text) => text.includes("$10.76"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("$17.76"))).toBe(false);
    expect(pdfTextCalls.some((text) => text.includes("KPI below target: CPA"))).toBe(false);
  });
});
