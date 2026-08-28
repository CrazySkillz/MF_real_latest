import { beforeEach, describe, expect, it, vi } from "vitest";

const pdfTextCalls = vi.hoisted((): string[] => []);
const aggregateCampaignMetricsMock = vi.hoisted(() => vi.fn());
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getCampaignKPIs: vi.fn(),
  getCampaignBenchmarks: vi.fn(),
  getPlatformKPIs: vi.fn(),
  getPlatformBenchmarks: vi.fn(),
  getPrimaryGA4Connection: vi.fn(),
  getGA4DailyMetrics: vi.fn(),
  getComparisonData: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./scheduler", () => ({ aggregateCampaignMetrics: aggregateCampaignMetricsMock }));
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
    pdfTextCalls.length = 0;
    vi.clearAllMocks();
    storageMock.getCampaign.mockResolvedValue({ id: "campaign-1", name: "Campaign", currency: "USD", reportingTimeZone: "Europe/Amsterdam" });
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
    storageMock.getGA4DailyMetrics.mockResolvedValue([
      { date: "2026-08-21", sessions: 10, conversions: 5 },
      { date: "2026-08-27", sessions: 20, conversions: 7 },
    ]);
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
    aggregateCampaignMetricsMock.mockResolvedValue({ detailedMetrics: { performanceSummary } });
  });

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
    expect(pdfTextCalls).toContain("- Total Users: 1,184");
    expect(pdfTextCalls).toContain("- Total Sessions: 1,179");
    expect(pdfTextCalls).toContain("- Total Conversions: 152");
    expect(pdfTextCalls).toContain("- Total Revenue: $51,072.99");
    expect(pdfTextCalls).toContain("- Total Spend: $2,699.75");
    expect(pdfTextCalls.some((text) => text.includes("KPI below target: CPA"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Sessions: 1,179") && text.includes("Previous 1,149"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Spend: $2,699.75") && text.includes("Previous $2,500.00"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Total Revenue: $51,072.99") && text.includes("exact-date Revenue unavailable"))).toBe(true);
    expect(pdfTextCalls).not.toContain("Overview");
    expect(pdfTextCalls).not.toContain("What's Changed");
    expect(pdfTextCalls).not.toContain("Insights");
    expect(pdfTextCalls).not.toContain("Connected-source performance");
    expect(pdfTextCalls).not.toContain("Campaign KPI rows");
    expect(pdfTextCalls).not.toContain("Campaign Benchmark rows");
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith("campaign-1", "properties/123", "2026-08-21", "2026-08-27");
    expect(storageMock.getComparisonData).toHaveBeenCalledWith("campaign-1", "last_week", "Europe/Amsterdam", "2026-08-20");
  });
});
