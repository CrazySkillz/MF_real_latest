import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pdfTextCalls = vi.hoisted((): string[] => []);
const pdfTextPages = vi.hoisted((): Array<{ text: string; page: number }> => []);
const pdfPageHeight = vi.hoisted(() => ({ value: 297 }));
const trendChartMarks = vi.hoisted((): Array<{ chart: string; kind: string; color: string; args: number[] }> => []);
const pdfDrawCalls = vi.hoisted(() => ({ lines: 0, circles: 0, roundedRects: 0, roundedRectArgs: [] as number[][], images: 0, fillColors: [] as string[], drawColors: [] as string[], lineWidths: [] as number[] }));
const aggregateCampaignMetricsMock = vi.hoisted(() => vi.fn());
const getCampaignMetricTotalsMock = vi.hoisted(() => vi.fn());
const resolveFinancialDailyComparisonPreviousMock = vi.hoisted(() => vi.fn());
const evaluateExecutiveSummaryTrajectoryMock = vi.hoisted(() => vi.fn());
const storageMock = vi.hoisted(() => ({
  getGA4OverviewSnapshot: vi.fn(async () => null),
  getCampaign: vi.fn(),
  getCampaignKPIs: vi.fn(),
  getCampaignBenchmarks: vi.fn(),
  getPlatformKPIs: vi.fn(),
  getPlatformBenchmarks: vi.fn(),
  getPrimaryGA4Connection: vi.fn(),
  getGA4DailyMetrics: vi.fn(),
  getFinancialDailyComparisonData: vi.fn(),
  getComparisonData: vi.fn(),
  getGA4PublicationVersion: vi.fn(),
  getSpendSources: vi.fn(),
  getRevenueSources: vi.fn(),
  getGA4RevenuePublicationStatus: vi.fn(),
  getSpendTotalForRange: vi.fn(),
  getRevenueTotalForRange: vi.fn(),
  getExecutiveSummaryDailyComparisonData: vi.fn(),
  getRevenueBreakdownBySource: vi.fn(),
  getSpendBreakdownBySource: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./scheduler", () => ({ aggregateCampaignMetrics: aggregateCampaignMetricsMock }));
vi.mock("./utils/campaign-current-values", () => ({ getCampaignMetricTotals: getCampaignMetricTotalsMock }));
vi.mock("./utils/financial-daily-comparison", () => ({
  resolveFinancialDailyComparisonPrevious: resolveFinancialDailyComparisonPreviousMock,
}));
vi.mock("./utils/executive-summary-daily-snapshot", () => ({
  evaluateExecutiveSummaryTrajectory: evaluateExecutiveSummaryTrajectoryMock,
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
    page = 1;
    chart = "";
    drawColor = "";
    fillColor = "";
    internal = { pageSize: { getWidth: () => 210, getHeight: () => pdfPageHeight.value } };
    setFontSize() {}
    setFont() {}
    setTextColor() {}
    setFillColor(...values: number[]) { this.fillColor = values.join(","); pdfDrawCalls.fillColors.push(this.fillColor); }
    setDrawColor(...values: number[]) { this.drawColor = values.join(","); pdfDrawCalls.drawColors.push(this.drawColor); }
    setLineWidth(value: number) { pdfDrawCalls.lineWidths.push(value); }
    line(...args: number[]) { pdfDrawCalls.lines += 1; trendChartMarks.push({ chart: this.chart, kind: "line", color: this.drawColor, args }); }
    circle(x: number, y: number, radius: number) { pdfDrawCalls.circles += 1; trendChartMarks.push({ chart: this.chart, kind: "circle", color: this.fillColor, args: [x, y, radius] }); }
    rect() {}
    roundedRect(...values: number[]) { pdfDrawCalls.roundedRects += 1; pdfDrawCalls.roundedRectArgs.push(values.slice(0, 4)); }
    addImage() { pdfDrawCalls.images += 1; }
    addPage() { this.page += 1; }
    splitTextToSize(value: any) { return [String(value)]; }
    text(value: any) {
      (Array.isArray(value) ? value : [value]).forEach((item) => {
        if (["Daily Traffic", "Conversion Quality Trend", "Efficiency Trends"].includes(item)) this.chart = item;
        pdfTextCalls.push(String(item));
        pdfTextPages.push({ text: String(item), page: this.page });
      });
    }
    output(kind: string) {
      return kind === "nodebuffer" ? Buffer.from("x".repeat(256)) : new ArrayBuffer(256);
    }
  },
}));

import {
  buildPdfAttachmentForReport,
  isValidCampaignDeepDiveReportConfiguration,
  isValidCampaignDeepDiveReportConfigurationForPersistence,
} from "./report-scheduler";

const metric = (value: number, sources = ["ga4"]) => ({ available: true, value, sources, unavailableReasons: [] });
const performanceSummary = {
  version: "performance_summary_aggregate_v3",
  campaignId: "campaign-1",
  dateRange: "90days",
  currentValueWindow: {
    mode: "initial_import_to_latest_completed_day",
    startDate: "2026-07-02",
    endDate: "2026-08-27",
    dataThroughDate: "2026-08-27",
    reportingTimeZone: "Europe/Amsterdam",
  },
  totals: {
    users: metric(1184),
    sessions: metric(1183),
    conversions: metric(152),
    revenue: metric(72766.69, ["ga4", "imported_revenue"]),
    spend: metric(2699.75, ["canonical_spend_sources"]),
    cvr: metric((152 / 1183) * 100),
    roas: metric(26.95, ["ga4", "canonical_spend_sources"]),
    roi: metric(2595.31, ["ga4", "canonical_spend_sources"]),
    cpa: metric(10.76, ["ga4", "canonical_spend_sources"]),
  },
  sources: [{
    id: "ga4",
    label: "Google Analytics",
    category: "web_analytics",
    connected: true,
    includedMetrics: ["users", "sessions", "conversions", "revenue", "engagementRate"],
    metrics: { users: 1184, sessions: 1183, conversions: 152, revenue: 55966.70 },
  }],
};

const budgetPacing = {
  version: "budget_pacing_v1",
  campaignId: "campaign-1",
  currency: "USD",
  periodStartDate: "2026-07-02",
  periodEndDate: "2026-09-30",
  dataThroughDate: "2026-08-27",
  spend: metric(2699.75, ["spend-1"]),
};

const financialInputs = {
  revenue: [
    {
      id: "ga4_native_revenue", value: 55966.70, campaignId: "campaign-1", scopeMode: "campaign_to_date",
      startDate: "2026-07-02", endDate: "2026-08-27", currency: "USD", currencyVerified: true,
    },
    {
      id: "revenue-1", value: 16799.99, campaignId: "campaign-1", scopeMode: "source_to_date",
      startDate: "1900-01-01", endDate: "2026-08-27", currency: "USD", currencyVerified: true,
    },
  ],
  spend: [{
    id: "spend-1", value: 2699.75, campaignId: "campaign-1", scopeMode: "source_to_date",
    startDate: "1900-01-01", endDate: "2026-08-27", currency: "USD", currencyVerified: true,
  }],
};

const financialDecisionContext = {
  version: "financial_decision_context_v1",
  status: "ready",
  campaignId: "campaign-1",
  currency: "USD",
  dataThroughDate: "2026-08-27",
  revenueModel: "ga4_campaign_to_date_plus_imported_source_to_date",
  spendModel: "source_to_date",
  roas: 72766.69 / 2699.75,
};

const completeTrendComparisonRows = () => Array.from({ length: 60 }, (_, index) => {
  const date = new Date("2026-06-29T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + index);
  const currentWindow = index >= 30;
  const sessions = 10;
  const conversions = currentWindow ? 2 : 1;
  return {
    date: date.toISOString().slice(0, 10),
    metrics: { users: 8, sessions, conversions, cvr: (conversions / sessions) * 100, engagementRate: 0.8 },
  };
});

const report = (reportType: string, selectedSections: string[], selectedMetrics: string[] = []) => ({
  id: `report-${reportType}`,
  name: `${reportType} report`,
  platformType: "campaign_deepdive",
  campaignId: "campaign-1",
  reportType: "custom",
  configuration: { reportType, selectedSections, selectedMetrics },
});

describe("scheduled Campaign DeepDive UI value parity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T12:00:00.000Z"));
    pdfTextCalls.length = 0;
    pdfTextPages.length = 0;
    pdfPageHeight.value = 297;
    trendChartMarks.length = 0;
    pdfDrawCalls.lines = 0;
    pdfDrawCalls.circles = 0;
    pdfDrawCalls.roundedRects = 0;
    pdfDrawCalls.roundedRectArgs.length = 0;
    pdfDrawCalls.images = 0;
    pdfDrawCalls.fillColors.length = 0;
    pdfDrawCalls.drawColors.length = 0;
    pdfDrawCalls.lineWidths.length = 0;
    vi.clearAllMocks();
    storageMock.getGA4PublicationVersion.mockReset().mockResolvedValue(null);
    storageMock.getComparisonData.mockResolvedValue({ current: null, previous: null });
    resolveFinancialDailyComparisonPreviousMock.mockResolvedValue(null);
    storageMock.getCampaign.mockResolvedValue({
      id: "campaign-1",
      name: "Campaign",
      currency: "USD",
      reportingTimeZone: "Europe/Amsterdam",
      budget: "10000",
      pacingStartDate: "2026-07-02",
      pacingEndDate: "2026-09-30",
    });
    storageMock.getCampaignKPIs.mockResolvedValue([{ id: "campaign-kpi", name: "Wrong campaign KPI", metric: "sessions", currentValue: "999", targetValue: "1200" }]);
    storageMock.getCampaignBenchmarks.mockResolvedValue([]);
    storageMock.getPlatformKPIs.mockResolvedValue([{ id: "ga4-kpi", platformType: "google_analytics", name: "Sessions target", metric: "sessions", currentValue: "1183", targetValue: "2000", unit: "count" }]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([]);
    storageMock.getPrimaryGA4Connection.mockResolvedValue({ propertyId: "properties/123", importStartDate: "2026-07-02" });
    storageMock.getGA4DailyMetrics.mockResolvedValue([
      { date: "2026-07-02", users: 1154, sessions: 1153, conversions: 145, engagedSessions: 790 },
      { date: "2026-08-27", users: 30, sessions: 30, conversions: 7, engagedSessions: 19 },
    ]);
    storageMock.getFinancialDailyComparisonData.mockResolvedValue({
      previous: {
        campaignId: "campaign-1",
        snapshotType: "financial_daily",
        reportingDate: "2026-07-28",
        metrics: {
          financialDaily: {
            version: "financial_daily_snapshot_v1",
            currency: "USD",
            currentValueWindow: {
              mode: "initial_import_to_latest_completed_day",
              startDate: "2026-07-02",
              endDate: "2026-07-28",
              dataThroughDate: "2026-07-28",
              reportingTimeZone: "Europe/Amsterdam",
            },
            inputs: {
              spend: { available: true, value: 2500, sources: ["spend-1"] },
              revenue: { available: true, value: 50000, sources: ["revenue-1"] },
              conversions: { available: true, value: 145, sources: ["ga4"] },
            },
          },
        },
      },
    });
    storageMock.getExecutiveSummaryDailyComparisonData.mockResolvedValue({ current: {}, previous: {} });
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([{ sourceId: "revenue-1", displayName: "Imported Revenue", sourceType: "csv", revenue: 16799.99 }]);
    storageMock.getSpendBreakdownBySource.mockResolvedValue([{ sourceId: "spend-1", displayName: "Imported Spend", sourceType: "csv", spend: 2699.75 }]);
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
    evaluateExecutiveSummaryTrajectoryMock.mockReturnValue({ available: true, trajectory: "accelerating", trendPercentage: 12.5, reason: null });
    aggregateCampaignMetricsMock.mockResolvedValue({
      detailedMetrics: {
        performanceSummary,
        budgetPacing,
        financialDecisionContext,
        financialInputs,
        trendAnalysis: {
          campaignId: "campaign-1",
          dateRange: "90days",
          endDate: "2026-08-27",
          dailyTotals: [
            { date: "2026-08-24", metrics: { users: 150, sessions: 200, conversions: 1, revenue: 200, engagementRate: 0.6, cvr: 0.5 } },
            { date: "2026-08-25", metrics: { users: 10, sessions: 10, conversions: 2, revenue: 250, engagementRate: 0.6, cvr: 20 } },
            { date: "2026-08-26", metrics: { users: 10, sessions: 10, conversions: 2, revenue: 300, engagementRate: 0.7, cvr: 20 } },
            { date: "2026-08-27", metrics: { users: 10, sessions: 10, conversions: 3, revenue: 450, engagementRate: 0.6333, cvr: 30 } },
          ],
          sources: performanceSummary.sources,
        },
      },
    });
  });

  afterEach(() => vi.useRealTimers());

  it.each(["performance-summary", "financial-analysis", "trend-analysis", "executive-summary"].flatMap(type => [-25, 0, 5, 105].map(revenue => ({ type, revenue }))))("preserves signed and zero current Revenue $revenue in $type PDF", async ({ type, revenue }) => {
    const original = await getCampaignMetricTotalsMock();
    getCampaignMetricTotalsMock.mockResolvedValue({ ...original, revenue, ga4Revenue: revenue - 30, spend: 20, financialConversions: 3,
      revenueBySource: new Map([["revenue-1", 30]]), spendBySource: new Map([["spend-1", 20]]) });
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([{ sourceId: "revenue-1", displayName: "Imported Revenue", sourceType: "csv", revenue: 30 }]);
    storageMock.getSpendBreakdownBySource.mockResolvedValue([{ sourceId: "spend-1", displayName: "Imported Spend", sourceType: "csv", spend: 20 }]);
    const aggregate = await aggregateCampaignMetricsMock();
    aggregateCampaignMetricsMock.mockResolvedValue({ ...aggregate, detailedMetrics: { ...aggregate.detailedMetrics,
      performanceSummary: { ...performanceSummary, totals: { ...performanceSummary.totals,
        revenue: metric(revenue), spend: metric(20), roas: metric(revenue / 20), roi: metric((revenue - 20) / 20 * 100), cpa: metric(20 / 3) } },
      financialInputs: { revenue: [{ ...financialInputs.revenue[0], value: revenue - 30 }, { ...financialInputs.revenue[1], value: 30 }], spend: [{ ...financialInputs.spend[0], value: 20 }] },
      budgetPacing: { ...budgetPacing, spend: metric(20, ["spend-1"]) },
      financialDecisionContext: { ...financialDecisionContext, roas: revenue / 20 },
    } });
    await buildPdfAttachmentForReport({ report: report(type, [`${type}:overview`]), windowStart: "2026-07-29", windowEnd: "2026-08-27", campaignName: "Signed fixture" });
    const label = type === "performance-summary" || type === "financial-analysis" ? "TOTAL REVENUE" : "REVENUE";
    const index = pdfTextCalls.indexOf(label);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(pdfTextCalls[index + 1]).toBe(new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(revenue));
    if (type === "financial-analysis") {
      const nativeIndex = pdfTextCalls.indexOf("GA4 Revenue");
      expect(nativeIndex).toBeGreaterThanOrEqual(0);
      expect(pdfTextCalls[nativeIndex + 1]).toBe(new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(revenue - 30));
      expect(pdfTextCalls[pdfTextCalls.indexOf("Imported Revenue") + 1]).toBe("$30.00");
      expect(pdfTextCalls[pdfTextCalls.indexOf("Imported Spend") + 1]).toBe("$20.00");
      pdfTextCalls.length = 0;
      await buildPdfAttachmentForReport({ report: { ...report("financial-analysis", ["financial-analysis:overview"]), reportType: "overview" }, windowStart: "2026-07-29", windowEnd: "2026-08-27", campaignName: "Signed fixture" });
      expect(pdfTextCalls).toContain(`- GA4 Revenue: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(revenue - 30)}`);
      expect(pdfTextCalls).toContain("- Imported Revenue: $30.00");
    }
  });

  it("fails closed before loading report data when no sections are selected", async () => {
    const pdf = await buildPdfAttachmentForReport({
      report: report("performance-summary", []),
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
    });

    expect(pdf).toBeNull();
    expect(pdfTextCalls).toHaveLength(0);
    expect(aggregateCampaignMetricsMock).not.toHaveBeenCalled();
    expect(storageMock.getCampaign).not.toHaveBeenCalled();
  });

  it("fails closed for unknown or report-type-mismatched sections", async () => {
    const invalidReports = [
      report("unknown", ["unknown:overview"]),
      report("performance-summary", ["financial-analysis:overview"]),
      report("performance-summary", ["performance-summary:unknown"]),
    ];

    for (const invalidReport of invalidReports) {
      const pdf = await buildPdfAttachmentForReport({
        report: invalidReport,
        windowStart: "2026-07-29",
        windowEnd: "2026-08-27",
        campaignName: "Campaign",
      });
      expect(pdf).toBeNull();
    }

    expect(pdfTextCalls).toHaveLength(0);
    expect(aggregateCampaignMetricsMock).not.toHaveBeenCalled();
    expect(storageMock.getCampaign).not.toHaveBeenCalled();
  });

  it("validates Campaign DeepDive configurations before persistence or rendering", () => {
    expect(isValidCampaignDeepDiveReportConfiguration({
      reportType: "performance-summary",
      selectedSections: ["performance-summary:overview"],
    })).toBe(true);
    expect(isValidCampaignDeepDiveReportConfiguration(JSON.stringify({
      reportType: "custom",
      selectedSections: ["metrics", "kpis"],
    }))).toBe(true);
    expect(isValidCampaignDeepDiveReportConfiguration({
      reportType: "platform-comparison",
      selectedSections: ["platform-comparison:overview"],
    })).toBe(true);

    expect(isValidCampaignDeepDiveReportConfiguration(null)).toBe(false);
    expect(isValidCampaignDeepDiveReportConfiguration("{")).toBe(false);
    expect(isValidCampaignDeepDiveReportConfiguration({ reportType: "performance-summary", selectedSections: [] })).toBe(false);
    expect(isValidCampaignDeepDiveReportConfiguration({ reportType: "unknown", selectedSections: ["unknown:overview"] })).toBe(false);
    expect(isValidCampaignDeepDiveReportConfiguration({ reportType: "performance-summary", selectedSections: ["financial-analysis:overview"] })).toBe(false);
    expect(isValidCampaignDeepDiveReportConfiguration({ reportType: "performance-summary", selectedSections: ["performance-summary:unknown"] })).toBe(false);

    expect(isValidCampaignDeepDiveReportConfigurationForPersistence({
      reportType: "custom",
      selectedSections: ["metrics"],
      selectedMetrics: ["users", "revenue"],
    })).toBe(true);
    expect(isValidCampaignDeepDiveReportConfigurationForPersistence({
      reportType: "custom",
      selectedSections: ["kpis", "benchmarks"],
      selectedMetrics: [],
    })).toBe(true);
    expect(isValidCampaignDeepDiveReportConfigurationForPersistence({
      reportType: "performance-summary",
      selectedSections: ["performance-summary:overview"],
      selectedMetrics: [],
    })).toBe(true);
    expect(isValidCampaignDeepDiveReportConfigurationForPersistence({
      reportType: "custom",
      selectedSections: ["metrics"],
      selectedMetrics: [],
    })).toBe(false);
    expect(isValidCampaignDeepDiveReportConfigurationForPersistence({
      reportType: "custom",
      selectedSections: ["metrics"],
      selectedMetrics: ["users", "unknown"],
    })).toBe(false);
    expect(isValidCampaignDeepDiveReportConfigurationForPersistence({
      reportType: "custom",
      selectedSections: ["metrics"],
      selectedMetrics: ["users", "users"],
    })).toBe(false);
    expect(isValidCampaignDeepDiveReportConfigurationForPersistence({
      reportType: "performance-summary",
      selectedSections: ["performance-summary:overview"],
      selectedMetrics: ["users"],
    })).toBe(false);
  });

  it("keeps supported legacy Platform Comparison and custom section keys renderable", async () => {
    const legacyReports = [
      report("platform-comparison", ["platform-comparison:overview"]),
      report("custom", ["metrics", "kpis", "benchmarks"]),
    ];

    for (const legacyReport of legacyReports) {
      const pdf = await buildPdfAttachmentForReport({
        report: legacyReport,
        windowStart: "2026-07-29",
        windowEnd: "2026-08-27",
        campaignName: "Campaign",
      });
      expect(pdf).not.toBeNull();
    }
  });

  it("renders only selected custom metrics plus the requested KPI and Benchmark rows", async () => {
    storageMock.getPlatformBenchmarks.mockResolvedValue([
      { id: "ga4-benchmark", platformType: "google_analytics", name: "Revenue benchmark", metric: "revenue", currentValue: "72766.69", benchmarkValue: "80000", unit: "$" },
    ]);

    await buildPdfAttachmentForReport({
      report: report("custom", ["metrics", "kpis", "benchmarks"], ["revenue"]),
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls).toContain("- Revenue: $72,766.69");
    expect(pdfTextCalls).not.toContain("- Users: 1,184");
    expect(pdfTextCalls).toContain("- Sessions target: Current 1,183; Target 2,000");
    expect(pdfTextCalls).toContain("- Revenue benchmark: Yours $72,766.69; Benchmark $80,000.00");
  });

  it("leaves no-session rate gaps while retaining isolated readings and genuine zero rates in the Trend PDF", async () => {
    const aggregate = await aggregateCampaignMetricsMock();
    const dailyTotals = [
      { sessions: 10, conversions: 1, cvr: 10, engagementRate: 0.8 },
      { sessions: 0, conversions: 0, cvr: null, engagementRate: 0 },
      { sessions: 20, conversions: 0, cvr: 0, engagementRate: 0 },
      { sessions: 10, conversions: 2, cvr: 20, engagementRate: 1 },
      { sessions: 0, conversions: 0, cvr: null, engagementRate: 0 },
      { sessions: 0, conversions: 0, cvr: null, engagementRate: 0 },
      { sessions: 10, conversions: 1, cvr: 10, engagementRate: 0.5 },
    ].map((metrics, index) => ({ date: `2026-08-${21 + index}`, metrics: { ...metrics, users: metrics.sessions } }));
    aggregate.detailedMetrics.trendAnalysis.dailyTotals = dailyTotals;
    await buildPdfAttachmentForReport({ report: report("trend-analysis", ["trend-analysis:overview"]), windowStart: "2026-07-29", windowEnd: "2026-08-27", campaignName: "Rate fixture" });

    const grids = trendChartMarks.filter(mark => mark.chart === "Conversion Quality Trend" && mark.kind === "line" && mark.color === "203,213,225");
    expect(grids).toHaveLength(4);
    const [left, top, right] = grids[0].args;
    const bottom = grids[3].args[1];
    for (const color of ["244,91,16", "16,185,129"]) {
      const segments = trendChartMarks.filter(mark => mark.chart === "Conversion Quality Trend" && mark.kind === "line" && mark.color === color);
      expect.soft(segments).toHaveLength(1); // Only Aug 23-24 are adjacent active dates.
      const points = trendChartMarks.filter(mark => mark.chart === "Conversion Quality Trend" && mark.kind === "circle" && mark.color === color && mark.args[1] >= top && mark.args[1] <= bottom);
      expect.soft(points).toHaveLength(4);
      expect.soft(points.map(point => Number(((point.args[0] - left) / (right - left) * 6).toFixed(5)))).toEqual([0, 2, 3, 6]);
      expect.soft(points[1]?.args[1]).toBe(bottom); // Real 0% with sessions remains a plotted value.
    }
    const traffic = trendChartMarks.filter(mark => mark.chart === "Daily Traffic" && mark.kind === "line" && mark.color === "16,185,129");
    expect(traffic).toHaveLength(6); // Count charts still include no-activity dates as zero.
  });

  it("omits an all-no-activity quality chart without removing the daily traffic chart", async () => {
    const aggregate = await aggregateCampaignMetricsMock();
    aggregate.detailedMetrics.trendAnalysis.dailyTotals = [{ date: "2026-08-27", metrics: { users: 0, sessions: 0, conversions: 0, cvr: null, engagementRate: 0 } }];
    await buildPdfAttachmentForReport({ report: report("trend-analysis", ["trend-analysis:overview"]), windowStart: "2026-07-29", windowEnd: "2026-08-27", campaignName: "No activity fixture" });
    expect(pdfTextCalls).toContain("Daily Traffic");
    expect(pdfTextCalls).not.toContain("Conversion Quality Trend");
    expect(pdfTextCalls).toContain("Current Decision Metrics");
  });

  it("uses cumulative UI traffic, current financial totals, and the default 30-day Trend comparison", async () => {
    await buildPdfAttachmentForReport({
      report: report("trend-analysis", ["trend-analysis:overview"]),
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls).toContain("Trend window: 2026-07-29 to 2026-08-27.");
    expect(pdfTextCalls).toContain("SESSIONS");
    expect(pdfTextCalls).toContain("1,183");
    expect(pdfTextCalls).toContain("REVENUE");
    expect(pdfTextCalls).toContain("$72,766.69");
    expect(pdfTextCalls.some((text) => text.includes("selector comparison date is 2026-07-28"))).toBe(true);
    expect(pdfTextCalls).toContain("Source: Google Analytics");
    expect(pdfTextCalls.some((text) => text.includes("Daily records: 4 of 30 calendar dates"))).toBe(true);
    expect(pdfTextCalls).toContain("Daily Traffic");
    expect(pdfTextCalls).toContain("Conversion Quality Trend");
    expect(pdfTextCalls).not.toContain("- 2026-08-25: Users 10; Sessions 10; Conversions 2");
    expect(pdfDrawCalls.lines).toBeGreaterThan(8);
    expect(pdfDrawCalls.circles).toBeGreaterThanOrEqual(5);
    expect(pdfDrawCalls.roundedRects).toBeGreaterThan(10);
    expect(pdfDrawCalls.roundedRectArgs.some(([, , width, height]) => width === 3 && height === 12)).toBe(false);
    expect(pdfDrawCalls.images).toBe(1);
    expect(pdfDrawCalls.fillColors).toContain("254,249,243");
    expect(pdfDrawCalls.fillColors).toContain("244,174,126");
    expect(pdfDrawCalls.drawColors).not.toContain("145,134,255");
    expect(pdfDrawCalls.lineWidths).toContain(0.2);
    expect(pdfDrawCalls.lineWidths).not.toContain(0.45);
    expect(pdfDrawCalls.lineWidths).not.toContain(0.65);
    expect(pdfTextCalls).toContain("Website Engagement & Conversion Summary");
    expect(pdfTextCalls).toContain("ENGAGED SESSIONS");
    expect(pdfTextCalls).toContain("809");
    expect(pdfTextCalls).toContain("CONVERSIONS PER 100 SESSIONS");
    expect(pdfTextCalls).toContain("12.8");
    expect(pdfTextCalls).not.toContain("Paid Acquisition Funnel");
    expect(pdfTextCalls).not.toContain("Source Contribution");
    expect(pdfTextCalls).toContain("Executive Recommendations");
    expect(pdfTextCalls.some((text) => text.includes("Selected-Window Comparison"))).toBe(false);
    expect(pdfTextCalls).toContain("Connected-Source ROAS - Reconciled Sources");
    expect(pdfTextCalls.some((text) => text.includes("Cumulative ROAS is 26.95x"))).toBe(true);
    expect(pdfTextCalls).toContain("Connected-Source Conversion Volume");
    expect(pdfTextCalls.some((text) => text.includes("12.8 conversions per 100 sessions"))).toBe(true);
    expect(pdfTextCalls).not.toContain("1,179");
    expect(pdfTextCalls.some((text) => text.includes("Cost per click: Unavailable"))).toBe(false);
    expect(pdfTextCalls.some((text) => text.includes("Click-through rate: Unavailable"))).toBe(false);
    expect(getCampaignMetricTotalsMock).not.toHaveBeenCalled();
    expect(resolveFinancialDailyComparisonPreviousMock).not.toHaveBeenCalled();
  });

  it("withholds ROAS budget guidance when financial decision inputs do not reconcile", async () => {
    aggregateCampaignMetricsMock.mockResolvedValueOnce({
      detailedMetrics: {
        performanceSummary,
        financialDecisionContext,
        financialInputs: {
          ...financialInputs,
          spend: [{ ...financialInputs.spend[0], value: 2600 }],
        },
        trendAnalysis: {
          campaignId: "campaign-1",
          dateRange: "90days",
          endDate: "2026-08-27",
          dailyTotals: [],
          sources: performanceSummary.sources,
        },
      },
    });

    await buildPdfAttachmentForReport({
      report: report("trend-analysis", ["trend-analysis:overview"]),
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls.some((text) => text.includes("ROAS Decision Context Not Verified"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("withheld from executive budget guidance"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Connected-Source ROAS") && text.includes("Reconciled Sources"))).toBe(false);
  });

  it("emits an actionable comparison only when both exact 30-day windows are complete", async () => {
    storageMock.getPrimaryGA4Connection.mockResolvedValueOnce({ propertyId: "properties/123", importStartDate: "2026-06-29" });
    aggregateCampaignMetricsMock.mockResolvedValueOnce({
      detailedMetrics: {
        performanceSummary,
        financialDecisionContext,
        financialInputs,
        trendAnalysis: {
          campaignId: "campaign-1",
          dateRange: "90days",
          endDate: "2026-08-27",
          dailyTotals: completeTrendComparisonRows(),
          sources: performanceSummary.sources,
        },
      },
    });

    await buildPdfAttachmentForReport({
      report: report("trend-analysis", ["trend-analysis:overview"]),
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls).toContain("Conversions Increased - Validate the Drivers");
    expect(pdfTextCalls.some((text) => text.includes("2026-07-29 to 2026-08-27 recorded 60 conversions from 300 sessions")
      && text.includes("versus 30 conversions from 300 sessions")
      && text.includes("Next action:"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Selected-Window Comparison"))).toBe(false);
  });

  it("uses the same read-only exact-date financial fallback when a stored Trend comparison is absent", async () => {
    storageMock.getFinancialDailyComparisonData.mockResolvedValueOnce({ current: null, previous: null });
    const derivedPrevious = {
      campaignId: "campaign-1",
      snapshotType: "financial_daily",
      reportingDate: "2026-07-28",
      metrics: {
        financialDaily: {
          version: "financial_daily_snapshot_v1",
          currency: "USD",
          currentValueWindow: {
            mode: "initial_import_to_latest_completed_day",
            startDate: "2026-07-02",
            endDate: "2026-07-28",
            dataThroughDate: "2026-07-28",
            reportingTimeZone: "Europe/Amsterdam",
          },
          inputs: {
            spend: { available: true, value: "2500.00", sources: ["canonical_spend_sources"] },
            revenue: { available: true, value: "50000.00", sources: ["ga4"] },
            conversions: { available: true, value: 145, sources: ["ga4"] },
          },
        },
      },
    };
    resolveFinancialDailyComparisonPreviousMock.mockResolvedValueOnce(derivedPrevious);

    await buildPdfAttachmentForReport({
      report: report("trend-analysis", ["trend-analysis:overview"]),
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
    });

    expect(resolveFinancialDailyComparisonPreviousMock).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      reportingDate: "2026-07-28",
      storedPrevious: null,
    });
    expect(pdfTextCalls).toContain("REVENUE");
    expect(pdfTextCalls).toContain("$72,766.69");
    expect(pdfTextCalls.some((text) => text.includes("+45.5%") && text.includes("2026-07-28"))).toBe(true);
  });

  it("keeps the multi-source Trend website summary scoped to session-capable source rows", async () => {
    const ga4Source = {
      id: "ga4", label: "Google Analytics", category: "web_analytics", connected: true,
      includedMetrics: ["users", "sessions", "conversions", "revenue", "engagementRate"],
      excludedMetrics: [
        { metric: "impressions", reason: "GA4 is not an ad-impression source" },
        { metric: "clicks", reason: "GA4 is not an ad-click source" },
        { metric: "spend", reason: "Spend is not a GA4 metric" },
      ],
      dailyRows: [{ date: "2026-08-27", metrics: { users: 80, sessions: 100, conversions: 10, revenue: 600, engagementRate: 0.8 } }],
    };
    const paidSource = {
      id: "linkedin", label: "LinkedIn Ads", category: "paid_media", connected: true,
      includedMetrics: ["impressions", "clicks", "spend", "conversions"],
      excludedMetrics: [
        { metric: "sessions", reason: "Sessions are web analytics metrics" },
        { metric: "users", reason: "Users are web analytics metrics" },
      ],
      dailyRows: [{ date: "2026-08-27", metrics: { impressions: 1000, clicks: 100, spend: 300, conversions: 30 } }],
    };
    aggregateCampaignMetricsMock.mockResolvedValueOnce({
      detailedMetrics: {
        performanceSummary: {
          ...performanceSummary,
          currentValueWindow: { ...performanceSummary.currentValueWindow, mode: "aggregate" },
          totals: {
            ...performanceSummary.totals,
            users: metric(80), sessions: metric(100), conversions: metric(40, ["ga4", "linkedin"]), cvr: metric(40, ["ga4", "linkedin"]),
          },
          sources: [ga4Source, paidSource],
        },
        trendAnalysis: {
          campaignId: "campaign-1", dateRange: "90days", startDate: "2026-07-29", endDate: "2026-08-28",
          dailyTotals: [{ date: "2026-08-27", metrics: { users: 80, sessions: 100, conversions: 40, revenue: 600, engagementRate: 0.8, impressions: 1000, clicks: 100, spend: 300 } }],
          sources: [ga4Source, paidSource],
        },
      },
    });

    await buildPdfAttachmentForReport({
      report: report("trend-analysis", ["trend-analysis:overview"]),
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls).toContain("Website Engagement & Conversion Summary");
    expect(pdfTextCalls).toContain("Selected 30-day window from 2026-07-29 through 2026-08-27.");
    for (const value of ["100", "80", "10", "80.0%", "10.0"]) expect(pdfTextCalls).toContain(value);
    expect(pdfTextCalls).not.toContain("40.0");
    expect(pdfTextCalls).toContain("Paid Acquisition Funnel");
    for (const label of ["IMPRESSIONS", "CLICKS", "CONVERSIONS", "CTR", "PAID CVR"]) expect(pdfTextCalls).toContain(label);
    for (const value of ["1,000", "30", "10.0%", "30.0%"]) expect(pdfTextCalls).toContain(value);
    expect(pdfTextCalls).toContain("Source Contribution");
    expect(pdfTextCalls).toContain("Google Analytics");
    expect(pdfTextCalls.some((text) => text.includes("Spend Unavailable") && text.includes("Traffic 100 sessions") && text.includes("Revenue $600.00") && text.includes("Coverage notes:"))).toBe(true);
    expect(pdfTextCalls).toContain("LinkedIn Ads");
    expect(pdfTextCalls.some((text) => text.includes("Spend $300.00") && text.includes("Traffic 100 clicks") && text.includes("CPA $10.00") && text.includes("Coverage notes:"))).toBe(true);
    expect(pdfTextCalls).toContain("Contribution Over Time - Spend");
    expect(pdfTextCalls).not.toContain("- 2026-08-27: Google Analytics $0.00; LinkedIn Ads $300.00");
    expect(getCampaignMetricTotalsMock).not.toHaveBeenCalled();
  });

  it("normalizes retired Financial tabs into one UI-shaped page using aggregate values and persisted inputs", async () => {
    await buildPdfAttachmentForReport({
      report: report("financial-analysis", [
        "financial-analysis:overview",
        "financial-analysis:roi-roas",
        "financial-analysis:costs",
        "financial-analysis:budget",
        "financial-analysis:insights",
      ]),
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
    });

    for (const heading of ["Financial Position", "Budget & Pacing", "Allocation & Sources", "Executive Action"]) {
      expect(pdfTextCalls.filter((text) => text === heading)).toHaveLength(1);
    }
    expect(pdfTextCalls).toContain("Metric window: 2026-07-02 to 2026-08-27 (Europe/Amsterdam).");
    for (const label of ["TOTAL REVENUE", "TOTAL SPEND", "ROAS", "CONVERSION RATE", "DAILY BURN RATE", "PACING STATUS"]) expect(pdfTextCalls).toContain(label);
    for (const value of ["$72,766.69", "$2,699.75", "26.95x", "12.8%", "$47.36", "56.9% Under"]) expect(pdfTextCalls).toContain(value);
    expect(pdfTextCalls.some((text) => text.includes("elapsed budget-period"))).toBe(false);
    expect(pdfTextCalls).toContain("Imported Revenue");
    expect(pdfTextCalls).toContain("$16,799.99");
    expect(pdfTextCalls).toContain("Imported Spend");
    expect(pdfTextCalls).not.toContain("ROI & ROAS");
    expect(getCampaignMetricTotalsMock).not.toHaveBeenCalled();
  });

  it.each([{ revenueRows: 1, movesSection: true }, { revenueRows: 12, movesSection: false }])(
    "keeps Financial Executive Action together with $revenueRows revenue rows",
    async ({ revenueRows, movesSection }) => {
      storageMock.getRevenueBreakdownBySource.mockResolvedValue(Array.from({ length: revenueRows }, (_, index) => ({
        sourceId: `revenue-${index}`, displayName: `Revenue ${index}`, sourceType: "csv", revenue: index === 0 ? 16799.99 : 0,
      })));
      await buildPdfAttachmentForReport({
        report: report("financial-analysis", ["financial-analysis:overview"]),
        windowStart: "2026-07-29",
        windowEnd: "2026-08-27",
        campaignName: "Campaign",
      });

      const actionTitles = ["Executive Action", "Positive financial return", "Budget is pacing below target", "Review spend source mix"];
      const actions = pdfTextPages.filter(({ text }) => actionTitles.includes(text));
      expect(actions.map(({ text }) => text)).toEqual(actionTitles);
      expect(new Set(actions.map(({ page }) => page)).size).toBe(1);
      const sourcePage = pdfTextPages.find(({ text }) => text === "Spend Sources")!.page;
      expect(actions[0].page).toBe(sourcePage + (movesSection ? 1 : 0));
    },
  );

  it("uses the certified financial data-through date for financial pacing", async () => {
    vi.setSystemTime(new Date("2026-08-28T23:30:00.000Z"));
    storageMock.getCampaign.mockResolvedValue({
      id: "campaign-1",
      name: "Campaign",
      currency: "USD",
      reportingTimeZone: "Pacific/Honolulu",
      budget: "10799",
      pacingStartDate: "2026-08-27",
      pacingEndDate: "2026-08-30",
    });
    aggregateCampaignMetricsMock.mockResolvedValueOnce({
      detailedMetrics: {
        performanceSummary,
        budgetPacing: {
          ...budgetPacing,
          periodStartDate: "2026-08-27",
          periodEndDate: "2026-08-30",
        },
        financialDecisionContext,
        financialInputs,
      },
    });

    await buildPdfAttachmentForReport({
      report: { ...report("financial-analysis", ["financial-analysis:overview"]), scheduleTimeZone: "Pacific/Kiritimati" },
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls).toContain("PACING STATUS");
    expect(pdfTextCalls).toContain("On Track");
    expect(pdfTextCalls.some((text) => text.includes("elapsed budget-period"))).toBe(false);
  });

  it("keeps available zero-valued GA4, revenue, and spend provenance visible", async () => {
    const unavailableMetric = { available: false, value: null, sources: [], unavailableReasons: ["Zero denominator"] };
    aggregateCampaignMetricsMock.mockResolvedValue({
      detailedMetrics: {
        performanceSummary: {
          ...performanceSummary,
          totals: {
            ...performanceSummary.totals,
            revenue: metric(0, ["ga4", "imported_revenue"]),
            spend: metric(0, ["canonical_spend_sources"]),
            roas: unavailableMetric,
            roi: unavailableMetric,
            cpa: unavailableMetric,
          },
          sources: performanceSummary.sources.map((source) => ({
            ...source,
            metrics: { ...source.metrics, revenue: 0 },
          })),
        },
        budgetPacing: {
          ...budgetPacing,
          spend: metric(0, ["spend-1"]),
        },
      },
    });
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([{ sourceId: "revenue-1", displayName: "Zero Revenue", sourceType: "csv", revenue: 0 }]);
    storageMock.getSpendBreakdownBySource.mockResolvedValue([{ sourceId: "spend-1", displayName: "Zero Spend", sourceType: "csv", spend: 0 }]);

    await buildPdfAttachmentForReport({
      report: report("financial-analysis", ["financial-analysis:overview"]),
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls).toContain("GA4 Revenue");
    expect(pdfTextCalls).toContain("Zero Revenue");
    expect(pdfTextCalls).toContain("Zero Spend");
    expect(pdfTextCalls.filter((text) => text === "$0.00").length).toBeGreaterThanOrEqual(3);
    expect(pdfTextCalls).not.toContain("No detailed revenue inputs are available.");
    expect(pdfTextCalls).not.toContain("No detailed spend inputs are available.");
  });

  it("uses Executive Summary UI financials, cumulative traffic, GA4 target rows, and trajectory", async () => {
    await buildPdfAttachmentForReport({
      report: report("executive-summary", ["executive-summary:overview", "executive-summary:recommendations"]),
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls).toContain("7-DAY REVENUE TREND");
    expect(pdfTextCalls).toContain("accelerating (12.5%)");
    expect(pdfTextCalls).toContain("SESSIONS");
    expect(pdfTextCalls).toContain("1,183");
    expect(pdfTextCalls).toContain("REVENUE");
    expect(pdfTextCalls).toContain("$72,766.69");
    expect(pdfTextCalls).not.toContain("1,179");
    expect(pdfTextCalls).not.toContain("$51,072.99");
    expect(pdfTextCalls.some((text) => text.includes("Sessions target"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Wrong campaign KPI"))).toBe(false);
    expect(pdfTextCalls).toContain("Risk Assessment");
    expect(pdfTextCalls).toContain("KPI Risk");
    expect(pdfTextCalls).toContain("1 KPI is below 70% of target");
    expect(pdfTextCalls).toContain("Benchmark Risk");
    expect(pdfTextCalls).toContain("No evaluable campaign benchmarks available");
    expect(pdfTextCalls).toContain("Data Freshness");
    expect(pdfTextCalls).toContain("GA4 outcome metrics cover through 2026-08-27");
    expect(pdfDrawCalls.images).toBe(1);
    expect(pdfDrawCalls.fillColors).toContain("254,249,243");
    expect(pdfDrawCalls.fillColors).toContain("244,174,126");
    expect(storageMock.getExecutiveSummaryDailyComparisonData).toHaveBeenCalledWith("campaign-1", "2026-08-27", "2026-08-20");
    expect(getCampaignMetricTotalsMock).toHaveBeenCalledWith("campaign-1", true, true);
  });

  it("passes dated revenue evidence to the shared comparator and explains the recovered PDF comparison", async () => {
    const snapshots = { current: { id: "current" }, previous: { id: "previous" }, revenueHistory: { publicationMatches: true } };
    storageMock.getExecutiveSummaryDailyComparisonData.mockResolvedValue(snapshots);
    evaluateExecutiveSummaryTrajectoryMock.mockReturnValue({ available: true, trajectory: "accelerating", trendPercentage: 19.1862, reason: null, source: "dated_revenue_history" });
    await buildPdfAttachmentForReport({ report: report("executive-summary", ["executive-summary:overview"]), windowStart: "2026-07-29", windowEnd: "2026-08-27", campaignName: "Campaign" });
    expect(evaluateExecutiveSummaryTrajectoryMock).toHaveBeenCalledWith(snapshots.current, snapshots.previous, snapshots.revenueHistory);
    expect(pdfTextCalls).toContain("accelerating (19.2%)");
    expect(pdfTextCalls.join(" ")).toContain("Both dates use the current sources and their dated records.");
    expect(pdfTextCalls).not.toContain("Not Enough History");
  });

  it.each([{ height: 292, funnelPage: 2 }, { height: 380, funnelPage: 1 }])(
    "keeps Executive funnel and risk sections together at page height $height",
    async ({ height, funnelPage }) => {
      pdfPageHeight.value = height;
      await buildPdfAttachmentForReport({
        report: report("executive-summary", ["executive-summary:overview"]),
        windowStart: "2026-07-29",
        windowEnd: "2026-08-27",
        campaignName: "Campaign",
      });
      const funnel = ["Marketing Funnel Performance", "USERS", "SESSIONS", "CONVERSIONS", "REVENUE", "SPEND", "CONVERSION RATE", "ROAS", "ROI"];
      for (const text of funnel) expect(pdfTextPages.find((call) => call.text === text)?.page).toBe(funnelPage);
      const risk = ["Risk Assessment", "KPI Risk", "Benchmark Risk", "Data Freshness", "ROI / ROAS Risk", "7-Day Trend Risk", "Paid Platform Concentration Risk"];
      const riskPages = risk.map((text) => pdfTextPages.find((call) => call.text === text)?.page);
      expect(riskPages).not.toContain(undefined);
      expect(new Set(riskPages).size).toBe(1);
    },
  );


  it.each(["executive-summary", "trend-analysis"])("keeps zero counts and unavailable zero-denominator rates in %s", async type => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([{ date: "2026-08-27", users: 0, sessions: 0, conversions: 0, engagedSessions: 0 }]);
    getCampaignMetricTotalsMock.mockResolvedValue({ users: 0, sessions: 0, conversions: 0, financialConversions: 0,
      revenue: 0, ga4Revenue: 0, spend: 0, revenueAvailable: true, spendAvailable: true, spendRecordsAvailable: false,
      ga4Available: true, ga4RevenueAvailable: true, financialConversionsAvailable: true, revenueBySource: new Map(), spendBySource: new Map() });
    await buildPdfAttachmentForReport({ report: report(type, [type + ":overview"]), windowStart: "2026-07-29", windowEnd: "2026-08-27", campaignName: "Campaign" });
    const start = pdfTextCalls.indexOf(type === "executive-summary" ? "Marketing Funnel Performance" : "Website Engagement & Conversion Summary");
    const end = pdfTextCalls.indexOf(type === "executive-summary" ? "KPI Exceptions" : "Executive Recommendations", start + 1);
    const text = pdfTextCalls.slice(start, end < 0 ? undefined : end);
    expect(start).toBeGreaterThan(-1);
    for (const key of ["SESSIONS", "CONVERSIONS"]) expect(text[text.indexOf(key) + 1]).toBe("0");
    const rate = type === "executive-summary" ? "CONVERSION RATE" : "ENGAGEMENT RATE";
    expect(text[text.indexOf(rate) + 1]).toMatch(/^Unavailable/);
    expect(text[text.indexOf(rate) + 1]).not.toBe("0.0%");
    if (type === "trend-analysis") expect(text[text.indexOf("CONVERSIONS PER 100 SESSIONS") + 1]).toBe("Unavailable");
  });

  describe("Performance Summary dated financial movement", () => {
    const datedSource = (id: string) => ({ id, campaignId: "campaign-1", isActive: true, platformContext: "ga4", currency: "USD", sourceType: "csv", mappingConfig: { dateColumn: "Date" } });
    let daily: any[];
    const render = () => buildPdfAttachmentForReport({ report: report("performance-summary", ["performance-summary:overview"]), windowStart: "2026-07-29", windowEnd: "2026-08-27", campaignName: "Campaign" });
    beforeEach(() => {
      daily = Array.from({ length: 57 }, (_, i) => ({ campaignId: "campaign-1", propertyId: "properties/123", date: new Date(Date.UTC(2026, 6, 2 + i)).toISOString().slice(0, 10), isSimulated: false,
        revenue: i === 0 ? "50000" : i === 56 ? "5966.70" : "0", sessions: i === 0 ? 1153 : i === 56 ? 30 : 0, users: i === 0 ? 1154 : i === 56 ? 30 : 0, conversions: i === 0 ? 145 : i === 56 ? 7 : 0, engagedSessions: 0 }));
      storageMock.getGA4DailyMetrics.mockImplementation(async (_id, _property, start, end) => daily.filter(row => row.date >= start && row.date <= end));
      storageMock.getGA4PublicationVersion.mockReset().mockResolvedValue("published-version");
      storageMock.getSpendSources.mockReset().mockResolvedValue([datedSource("spend-1")]);
      storageMock.getRevenueSources.mockReset().mockResolvedValue([datedSource("revenue-1"), { ...datedSource("crm-zero"), sourceType: "hubspot", mappingConfig: { dateField: "closedate", lastTotalRevenue: 0 } }]);
      storageMock.getGA4RevenuePublicationStatus.mockReset().mockResolvedValue({ "revenue-1": { status: "published" }, "crm-zero": { status: "published" } });
      storageMock.getSpendTotalForRange.mockReset().mockImplementation(async (_id, _start, end) => ({ totalSpend: end === "2026-08-27" ? 2699.75 : 2500, currency: "USD", sourceIds: ["spend-1"] }));
      storageMock.getRevenueTotalForRange.mockReset().mockImplementation(async (_id, _start, end) => ({ totalRevenue: end === "2026-08-27" ? 16799.99 : 10000, currency: "USD", sourceIds: ["revenue-1"] }));
    });

    it("uses exact dated records, preserves current figures, and keeps all four movement rows together", async () => {
      await render();
      expect(pdfTextCalls).toContain("+$12,766.69 (+21.3%); Previous $60,000.00");
      expect(pdfTextCalls).toContain("+$199.75 (+8.0%); Previous $2,500.00");
      expect(pdfTextCalls).toContain("+30 (+2.6%); Previous 1,153");
      expect(pdfTextCalls).toContain("+7 (+4.8%); Previous 145");
      expect(pdfTextCalls).toContain("$72,766.69");
      expect(pdfTextCalls).toContain("$2,699.75");
      const movement = pdfTextPages.filter(row => row.text === "Recent Movement" || row.text.includes("; Previous "));
      expect(movement).toHaveLength(5);
      expect(new Set(movement.map(row => row.page)).size).toBe(1);
      expect(pdfTextCalls).not.toContain("Recent Movement (continued)");
      for (const fn of [storageMock.getRevenueTotalForRange, storageMock.getSpendTotalForRange]) {
        expect(fn).toHaveBeenCalledWith("campaign-1", "1900-01-01", "2026-08-27", "ga4");
        expect(fn).toHaveBeenCalledWith("campaign-1", "1900-01-01", "2026-08-20", "ga4");
      }
      expect(storageMock.getComparisonData).not.toHaveBeenCalled();
      expect(resolveFinancialDailyComparisonPreviousMock).not.toHaveBeenCalled();
      expect(getCampaignMetricTotalsMock).toHaveBeenCalledWith("campaign-1", true, true);
    });

    it.each(["missing day", "duplicate day", "wrong campaign", "wrong property", "simulated", "invalid revenue", "unpublished source", "undated source", "wrong currency", "unknown record source", "native mismatch"])("withholds Revenue for %s without hiding valid Spend", async (reason) => {
      if (reason === "missing day") daily.splice(2, 1);
      if (reason === "duplicate day") daily[2] = { ...daily[1] };
      if (reason === "wrong campaign") daily[2].campaignId = "other-campaign";
      if (reason === "wrong property") daily[2].propertyId = "other-property";
      if (reason === "simulated") daily[2].isSimulated = true;
      if (reason === "invalid revenue") daily[2].revenue = "";
      if (reason === "native mismatch") daily[2].revenue = "1";
      if (reason === "unpublished source") storageMock.getGA4RevenuePublicationStatus.mockResolvedValue({ "revenue-1": { status: "pending" } });
      if (reason === "undated source") storageMock.getRevenueSources.mockResolvedValue([{ ...datedSource("revenue-1"), mappingConfig: {} }]);
      if (reason === "wrong currency") storageMock.getRevenueSources.mockResolvedValue([{ ...datedSource("revenue-1"), currency: "EUR" }]);
      if (reason === "unknown record source") storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 16799.99, currency: "USD", sourceIds: ["other-source"] });
      await render();
      expect(pdfTextCalls).toContain("Comparison unavailable - exact-date Revenue unavailable");
      expect(pdfTextCalls).toContain("+$199.75 (+8.0%); Previous $2,500.00");
    });

    it.each(["undated source", "wrong currency", "wrong campaign", "inactive source", "unknown source", "current total mismatch"])("withholds Spend for %s without hiding valid Revenue", async (reason) => {
      const source = datedSource("spend-1");
      if (reason === "undated source") source.mappingConfig = {} as any;
      if (reason === "wrong currency") source.currency = "EUR";
      if (reason === "wrong campaign") source.campaignId = "other-campaign";
      if (reason === "inactive source") source.isActive = false;
      storageMock.getSpendSources.mockResolvedValue([source]);
      if (reason === "unknown source") storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 2699.75, currency: "USD", sourceIds: ["other-source"] });
      if (reason === "current total mismatch") storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 2699.76, currency: "USD", sourceIds: ["spend-1"] });
      await render();
      expect(pdfTextCalls).toContain("Comparison unavailable - incomplete source history");
      expect(pdfTextCalls).toContain("+$12,766.69 (+21.3%); Previous $60,000.00");
    });

    it.each(["changed version", "busy publication", "missing version"])("fails closed for %s", async (reason) => {
      if (reason === "changed version") storageMock.getGA4PublicationVersion.mockResolvedValueOnce("before").mockResolvedValueOnce("after");
      if (reason === "busy publication") storageMock.getGA4PublicationVersion.mockRejectedValue(new Error("GA4_REFRESH_PUBLICATION_BUSY"));
      if (reason === "missing version") storageMock.getGA4PublicationVersion.mockResolvedValue(null);
      await render();
      expect(pdfTextCalls).toContain("Comparison unavailable - exact-date Revenue unavailable");
      expect(pdfTextCalls).toContain("Comparison unavailable - incomplete source history");
      expect(pdfTextCalls).toContain("$72,766.69");
    });

    it.each(["spend", "revenue"])("keeps the other comparison when the %s range read fails", async (kind) => {
      const failed = kind === "spend" ? storageMock.getSpendTotalForRange : storageMock.getRevenueTotalForRange;
      failed.mockRejectedValue(new Error("Financial input unavailable"));
      await render();
      expect(pdfTextCalls).toContain(kind === "spend" ? "Comparison unavailable - incomplete source history" : "Comparison unavailable - exact-date Revenue unavailable");
      expect(pdfTextCalls).toContain(kind === "spend" ? "+$12,766.69 (+21.3%); Previous $60,000.00" : "+$199.75 (+8.0%); Previous $2,500.00");
    });

    it.each([0, -25])("preserves exact previous Revenue %s without an invalid percentage", async (previous) => {
      daily[0].revenue = String(previous);
      daily[56].revenue = String(55966.7 - previous);
      storageMock.getRevenueTotalForRange.mockImplementation(async (_id, _start, end) => ({ totalRevenue: end === "2026-08-27" ? 16799.99 : 0, currency: "USD", sourceIds: end === "2026-08-27" ? ["revenue-1"] : [] }));
      await render();
      const comparison = pdfTextCalls.find(text => text.includes(`Previous ${previous === 0 ? "$0.00" : "-$25.00"}`));
      expect(comparison).toBeDefined();
      expect(comparison).not.toContain("%");
      expect(pdfTextCalls).not.toContain("Comparison unavailable - exact-date Revenue unavailable");
    });

    it("retains continuation pagination if the whole movement group cannot fit a page", async () => {
      pdfPageHeight.value = 170;
      await render();
      expect(pdfTextCalls).toContain("Recent Movement (continued)");
      expect(pdfTextCalls).toContain("+$12,766.69 (+21.3%); Previous $60,000.00");
    });
  });

  it("fails Executive Summary freshness closed when the certified GA4 window is unavailable", async () => {
    aggregateCampaignMetricsMock.mockResolvedValue({
      detailedMetrics: { performanceSummary: { ...performanceSummary, currentValueWindow: null }, financialDecisionContext, financialInputs },
    });

    await buildPdfAttachmentForReport({
      report: report("executive-summary", ["executive-summary:overview"]),
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls).toContain("Data Freshness");
    expect(pdfTextCalls).toContain("Not Verified");
    expect(pdfTextCalls).toContain("Connected-source freshness is unavailable in this report context");
  });
});
