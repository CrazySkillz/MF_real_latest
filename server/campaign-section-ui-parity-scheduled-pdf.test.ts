import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pdfTextCalls = vi.hoisted((): string[] => []);
const aggregateCampaignMetricsMock = vi.hoisted(() => vi.fn());
const getCampaignMetricTotalsMock = vi.hoisted(() => vi.fn());
const evaluateExecutiveSummaryTrajectoryMock = vi.hoisted(() => vi.fn());
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getCampaignKPIs: vi.fn(),
  getCampaignBenchmarks: vi.fn(),
  getPlatformKPIs: vi.fn(),
  getPlatformBenchmarks: vi.fn(),
  getPrimaryGA4Connection: vi.fn(),
  getGA4DailyMetrics: vi.fn(),
  getFinancialDailyComparisonData: vi.fn(),
  getExecutiveSummaryDailyComparisonData: vi.fn(),
  getRevenueBreakdownBySource: vi.fn(),
  getSpendBreakdownBySource: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./scheduler", () => ({ aggregateCampaignMetrics: aggregateCampaignMetricsMock }));
vi.mock("./utils/campaign-current-values", () => ({ getCampaignMetricTotals: getCampaignMetricTotalsMock }));
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
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    setFontSize() {}
    setFont() {}
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

const report = (reportType: string, selectedSections: string[]) => ({
  id: `report-${reportType}`,
  name: `${reportType} report`,
  platformType: "campaign_deepdive",
  campaignId: "campaign-1",
  reportType: "custom",
  configuration: { reportType, selectedSections, selectedMetrics: [] },
});

describe("scheduled Campaign DeepDive UI value parity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T12:00:00.000Z"));
    pdfTextCalls.length = 0;
    vi.clearAllMocks();
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

  it("uses cumulative UI traffic, current financial totals, and the default 30-day Trend comparison", async () => {
    await buildPdfAttachmentForReport({
      report: report("trend-analysis", ["trend-analysis:overview"]),
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls).toContain("Trend window: 2026-07-29 to 2026-08-27.");
    expect(pdfTextCalls.some((text) => text.includes("Sessions: 1,183"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Revenue: $72,766.69"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("selector comparison date is 2026-07-28"))).toBe(true);
    expect(pdfTextCalls).toContain("Source: Google Analytics");
    expect(pdfTextCalls.some((text) => text.includes("Daily records: 4 of 30 calendar dates"))).toBe(true);
    expect(pdfTextCalls).toContain("Daily Traffic");
    expect(pdfTextCalls).toContain("- 2026-08-25: Users 10; Sessions 10; Conversions 2");
    expect(pdfTextCalls).toContain("Conversion Quality Trend");
    expect(pdfTextCalls).toContain("- 2026-08-24: CVR 0.5%; Engagement Rate 60.0%");
    expect(pdfTextCalls).toContain("- 2026-08-25: CVR 20.0%; Engagement Rate 60.0%");
    expect(pdfTextCalls).toContain("Website Engagement & Conversion Summary");
    expect(pdfTextCalls).toContain("- Engaged Sessions: 809");
    expect(pdfTextCalls).toContain("- Conversions per 100 sessions: 12.8");
    expect(pdfTextCalls).not.toContain("Paid Acquisition Funnel");
    expect(pdfTextCalls).toContain("Executive Recommendations");
    expect(pdfTextCalls.some((text) => text.includes("Selected-Window Comparison") && text.includes("Jul 28, 2026"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Campaign-to-Date ROAS") && text.includes("26.95x"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Campaign-to-Date Conversion Volume") && text.includes("12.8 conversions per 100 sessions"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Sessions: 1,179"))).toBe(false);
    expect(pdfTextCalls.some((text) => text.includes("Sessions: 30"))).toBe(false);
    expect(pdfTextCalls.some((text) => text.includes("Cost per click: Unavailable"))).toBe(false);
    expect(pdfTextCalls.some((text) => text.includes("Click-through rate: Unavailable"))).toBe(false);
    expect(getCampaignMetricTotalsMock).not.toHaveBeenCalled();
  });

  it("keeps the multi-source Trend website summary scoped to session-capable source rows", async () => {
    const ga4Source = {
      id: "ga4", label: "Google Analytics", category: "web_analytics", connected: true,
      includedMetrics: ["users", "sessions", "conversions", "revenue", "engagementRate"],
      dailyRows: [{ date: "2026-08-27", metrics: { users: 80, sessions: 100, conversions: 10, revenue: 600, engagementRate: 0.8 } }],
    };
    const paidSource = {
      id: "linkedin", label: "LinkedIn Ads", category: "paid_media", connected: true,
      includedMetrics: ["impressions", "clicks", "spend", "conversions"],
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
          campaignId: "campaign-1", dateRange: "90days", startDate: "2026-07-29", endDate: "2026-08-27",
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
    expect(pdfTextCalls).toContain("- Selected 30-day window from 2026-07-29 through 2026-08-27.");
    expect(pdfTextCalls).toContain("- Sessions: 100");
    expect(pdfTextCalls).toContain("- Users: 80");
    expect(pdfTextCalls).toContain("- Conversions: 10");
    expect(pdfTextCalls).toContain("- Engagement rate: 80.0%");
    expect(pdfTextCalls).toContain("- Conversions per 100 sessions: 10.0");
    expect(pdfTextCalls).not.toContain("- Conversions per 100 sessions: 40.0");
    expect(pdfTextCalls).toContain("Paid Acquisition Funnel");
    expect(pdfTextCalls).toContain("- Impressions: 1,000");
    expect(pdfTextCalls).toContain("- Clicks: 100");
    expect(pdfTextCalls).toContain("- Conversions: 30");
    expect(pdfTextCalls).toContain("- CTR: 10.0%");
    expect(pdfTextCalls).toContain("- Paid CVR: 30.0%");
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
    expect(pdfTextCalls).toContain("- Revenue: $72,766.69");
    expect(pdfTextCalls).toContain("- Spend: $2,699.75");
    expect(pdfTextCalls).toContain("- ROAS: 26.95x");
    expect(pdfTextCalls).toContain("- Conversion rate: 12.8%");
    expect(pdfTextCalls).toContain("- Imported Revenue: $16,799.99");
    expect(pdfTextCalls).toContain("- Imported Spend: $2,699.75");
    expect(pdfTextCalls).not.toContain("ROI & ROAS");
    expect(getCampaignMetricTotalsMock).not.toHaveBeenCalled();
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

    expect(pdfTextCalls).toContain("- GA4 Revenue: $0.00");
    expect(pdfTextCalls).toContain("- Zero Revenue: $0.00");
    expect(pdfTextCalls).toContain("- Zero Spend: $0.00");
    expect(pdfTextCalls).not.toContain("- No detailed revenue inputs are available.");
    expect(pdfTextCalls).not.toContain("- No detailed spend inputs are available.");
  });

  it("uses Executive Summary UI financials, cumulative traffic, GA4 target rows, and trajectory", async () => {
    await buildPdfAttachmentForReport({
      report: report("executive-summary", ["executive-summary:overview", "executive-summary:recommendations"]),
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls).toContain("7-Day Snapshot Trajectory: accelerating (12.5%)");
    expect(pdfTextCalls).toContain("- Sessions: 1,183");
    expect(pdfTextCalls).toContain("- Revenue: $72,766.69");
    expect(pdfTextCalls).not.toContain("- Sessions: 1,179");
    expect(pdfTextCalls).not.toContain("- Revenue: $51,072.99");
    expect(pdfTextCalls.some((text) => text.includes("Sessions target"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Wrong campaign KPI"))).toBe(false);
    expect(storageMock.getExecutiveSummaryDailyComparisonData).toHaveBeenCalledWith("campaign-1", "2026-08-27", "2026-08-20");
    expect(getCampaignMetricTotalsMock).toHaveBeenCalledWith("campaign-1", true);
  });
});
