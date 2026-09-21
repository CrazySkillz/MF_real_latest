import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pdfTextCalls = vi.hoisted((): string[] => []);
const aggregateCampaignMetricsMock = vi.hoisted(() => vi.fn());
const getCampaignMetricTotalsMock = vi.hoisted(() => vi.fn());
const resolveFinancialDailyComparisonPreviousMock = vi.hoisted(() => vi.fn());
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
    expect(pdfTextCalls).not.toContain("Source Contribution");
    expect(pdfTextCalls).toContain("Executive Recommendations");
    expect(pdfTextCalls.some((text) => text.includes("Selected-Window Comparison"))).toBe(false);
    expect(pdfTextCalls.some((text) => text.includes("Campaign-to-Date ROAS") && text.includes("26.95x") && text.includes("Reconciled Sources"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Campaign-to-Date Conversion Volume") && text.includes("12.8 conversions per 100 sessions"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Sessions: 1,179"))).toBe(false);
    expect(pdfTextCalls.some((text) => text.includes("Sessions: 30"))).toBe(false);
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
    expect(pdfTextCalls.some((text) => text.includes("Campaign-to-Date ROAS") && text.includes("Reconciled Sources"))).toBe(false);
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

    expect(pdfTextCalls.some((text) => text.includes("Conversions Increased — Validate the Drivers")
      && text.includes("2026-07-29 to 2026-08-27 recorded 60 conversions from 300 sessions")
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
    expect(pdfTextCalls.some((text) => text.includes("Revenue: $72,766.69") && text.includes("+45.5%"))).toBe(true);
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
    expect(pdfTextCalls).toContain("Source Contribution");
    expect(pdfTextCalls).toContain("- Google Analytics: Spend Unavailable; Traffic 100 sessions; Conversions 10; Revenue $600.00; ROAS Unavailable; CPA Unavailable; CTR Unavailable; CPC Unavailable; Coverage notes: impressions: GA4 is not an ad-impression source; clicks: GA4 is not an ad-click source; spend: Spend is not a GA4 metric");
    expect(pdfTextCalls).toContain("- LinkedIn Ads: Spend $300.00; Traffic 100 clicks; Conversions 30; Revenue Unavailable; ROAS Unavailable; CPA $10.00; CTR 10.0%; CPC $3.00; Coverage notes: sessions: Sessions are web analytics metrics; users: Users are web analytics metrics");
    expect(pdfTextCalls).toContain("Contribution Over Time");
    expect(pdfTextCalls).toContain("- Selected metric: Spend");
    expect(pdfTextCalls).toContain("- 2026-08-27: Google Analytics $0.00; LinkedIn Ads $300.00");
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

  it("uses the campaign reporting timezone for financial pacing instead of the delivery timezone", async () => {
    vi.setSystemTime(new Date("2026-08-28T23:30:00.000Z"));
    storageMock.getCampaign.mockResolvedValue({
      id: "campaign-1",
      name: "Campaign",
      currency: "USD",
      reportingTimeZone: "Pacific/Honolulu",
      budget: "10799",
      pacingStartDate: "2026-08-28",
      pacingEndDate: "2026-08-31",
    });

    await buildPdfAttachmentForReport({
      report: { ...report("financial-analysis", ["financial-analysis:overview"]), scheduleTimeZone: "Pacific/Kiritimati" },
      windowStart: "2026-07-29",
      windowEnd: "2026-08-27",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls).toContain("- Daily Burn Rate Basis: Based on 1 elapsed budget-period day");
    expect(pdfTextCalls).toContain("- Pacing Status: On Track");
    expect(pdfTextCalls).not.toContain("- Daily Burn Rate Basis: Based on 2 elapsed budget-period days");
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
