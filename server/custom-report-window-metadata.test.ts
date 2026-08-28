import { beforeEach, describe, expect, it, vi } from "vitest";

const pdfTextCalls = vi.hoisted((): string[] => []);
const aggregateCampaignMetricsMock = vi.hoisted(() => vi.fn());
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getPlatformKPIs: vi.fn(),
  getPlatformBenchmarks: vi.fn(),
  getPrimaryGA4Connection: vi.fn(),
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

const metric = (value: number) => ({ available: true, value, sources: ["ga4"], unavailableReasons: [] });
const performanceSummary = {
  version: "performance_summary_aggregate_v3",
  dateRange: "90days",
  currentValueWindow: {
    mode: "initial_import_to_latest_completed_day",
    startDate: "2026-07-02",
    endDate: "2026-08-25",
    dataThroughDate: "2026-08-25",
    reportingTimeZone: "Europe/Amsterdam",
  },
  totals: {
    users: metric(100),
    sessions: metric(200),
    conversions: metric(10),
    revenue: metric(5000),
    cvr: metric(5),
  },
  sources: [{
    id: "ga4",
    label: "Google Analytics",
    category: "web_analytics",
    connected: true,
    includedMetrics: ["users", "sessions", "conversions", "revenue"],
    metrics: { users: 100, sessions: 200, conversions: 10, revenue: 5000 },
  }],
};

const report = (reportType: string, selectedSections: string[], storedReportType = "custom") => ({
  id: "report-1",
  name: "Campaign report",
  platformType: "campaign_deepdive",
  campaignId: "campaign-1",
  reportType: storedReportType,
  configuration: { reportType, selectedSections, selectedMetrics: [] },
});

describe("Campaign Custom Report PDF window metadata", () => {
  beforeEach(() => {
    pdfTextCalls.length = 0;
    vi.clearAllMocks();
    storageMock.getCampaign.mockResolvedValue({ id: "campaign-1", name: "Campaign", reportingTimeZone: "Europe/Amsterdam" });
    storageMock.getPlatformKPIs.mockResolvedValue([]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([]);
    storageMock.getPrimaryGA4Connection.mockResolvedValue(null);
    aggregateCampaignMetricsMock.mockResolvedValue({ detailedMetrics: { performanceSummary } });
  });

  it("prints the certified aggregate window instead of the generic scheduler window", async () => {
    await buildPdfAttachmentForReport({
      report: report("performance-summary", ["performance-summary:overview"]),
      windowStart: "2026-07-27",
      windowEnd: "2026-08-25",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls).toContain("Metric window: 2026-07-02 to 2026-08-25 (Europe/Amsterdam).");
    expect(pdfTextCalls).not.toContain("Window: 2026-07-27 to 2026-08-25");
  });

  it("fails the Custom Report metric window closed when certified metadata is unavailable", async () => {
    aggregateCampaignMetricsMock.mockResolvedValue({
      detailedMetrics: { performanceSummary: { ...performanceSummary, currentValueWindow: null } },
    });

    await buildPdfAttachmentForReport({
      report: report("performance-summary", ["performance-summary:overview"]),
      windowStart: "2026-07-27",
      windowEnd: "2026-08-25",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls).toContain("Metric window: Unavailable.");
    expect(pdfTextCalls).not.toContain("Window: 2026-07-27 to 2026-08-25");
  });

  it("prints the exact Trend calendar window for a Trend Custom Report", async () => {
    aggregateCampaignMetricsMock.mockResolvedValue({
      detailedMetrics: { performanceSummary, trendAnalysis: { endDate: "2026-08-25", dailyTotals: [] } },
    });

    await buildPdfAttachmentForReport({
      report: report("trend-analysis", ["trend-analysis:overview"]),
      windowStart: "2026-07-27",
      windowEnd: "2026-08-25",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls).toContain("Trend window: 2026-05-28 to 2026-08-25.");
    expect(pdfTextCalls).not.toContain("Window: 2026-07-27 to 2026-08-25");
  });

  it("preserves the existing header contract for non-Custom-Report compositions", async () => {
    await buildPdfAttachmentForReport({
      report: report("performance-summary", ["performance-summary:overview"], "overview"),
      windowStart: "2026-07-27",
      windowEnd: "2026-08-25",
      campaignName: "Campaign",
    });

    expect(pdfTextCalls).toContain("Window: 2026-07-27 to 2026-08-25");
    expect(pdfTextCalls).not.toContain("Metric window: 2026-07-02 to 2026-08-25 (Europe/Amsterdam).");
  });
});
