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

const metric = (value: number) => ({ available: true, value, sources: ["custom_integration"], unavailableReasons: [] });
const performanceSummary = {
  dateRange: "90days",
  totals: {
    users: metric(100),
    sessions: metric(200),
    conversions: metric(10),
    revenue: metric(5000),
    cvr: metric(5),
    roas: { available: false, value: null, sources: [], unavailableReasons: ["ROAS requires available spend and revenue"] },
    roi: { available: false, value: null, sources: [], unavailableReasons: ["ROI requires available spend and revenue"] },
  },
  sources: [{
    id: "custom_integration",
    label: "Custom Integration",
    category: "web_analytics",
    connected: true,
    includedMetrics: ["users", "sessions", "conversions", "revenue"],
    metrics: { users: 100, sessions: 200, conversions: 10, revenue: 5000 },
  }],
};

const executiveReport = (selectedSections: string[]) => ({
  id: "report-1",
  name: "Executive report",
  platformType: "campaign_deepdive",
  campaignId: "campaign-1",
  configuration: {
    reportType: "executive-summary",
    selectedSections,
    selectedMetrics: [],
  },
});

describe("scheduled Executive Summary PDF", () => {
  beforeEach(() => {
    pdfTextCalls.length = 0;
    vi.clearAllMocks();
    storageMock.getCampaign.mockResolvedValue({ id: "campaign-1", name: "Campaign", currency: "EUR" });
    storageMock.getCampaignKPIs.mockResolvedValue([
      { id: "kpi-revenue", name: "Revenue target", metric: "revenue", unit: "USD", currentValue: "999999", targetValue: "10000" },
      { id: "kpi-conversions", name: "Conversion target", metric: "conversions", unit: "count", currentValue: "0", targetValue: "8" },
      { id: "kpi-invalid", name: "Invalid target", metric: "revenue", unit: "USD", targetValue: "0" },
    ]);
    storageMock.getCampaignBenchmarks.mockResolvedValue([
      { id: "bm-revenue", name: "Revenue benchmark", metric: "revenue", unit: "USD", currentValue: "999999", benchmarkValue: "6000" },
      { id: "bm-conversions", name: "Conversion benchmark", metric: "conversions", unit: "count", currentValue: "0", benchmarkValue: "8" },
    ]);
    storageMock.getPlatformKPIs.mockResolvedValue([]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([]);
    storageMock.getPrimaryGA4Connection.mockResolvedValue(null);
    aggregateCampaignMetricsMock.mockResolvedValue({ detailedMetrics: { performanceSummary } });
  });

  it("deduplicates legacy keys and renders aggregate-backed exceptions in campaign currency", async () => {
    const buffer = await buildPdfAttachmentForReport({
      report: executiveReport(["executive-summary:overview", "executive-summary:recommendations"]),
      windowStart: "2026-07-01",
      windowEnd: "2026-07-30",
      campaignName: "Campaign",
      isTest: true,
    });

    expect(buffer?.length).toBeGreaterThan(100);
    expect(pdfTextCalls.filter((text) => text === "Marketing Funnel Performance")).toHaveLength(1);
    expect(pdfTextCalls).toContain("Metric basis: 90-day connected-source aggregate through scheduler generation time.");
    expect(pdfTextCalls.some((text) => text.includes("Revenue target: Current €5,000.00; Target €10,000.00"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Revenue benchmark: Yours €5,000.00; Benchmark €6,000.00"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Conversion target"))).toBe(false);
    expect(pdfTextCalls.some((text) => text.includes("Conversion benchmark"))).toBe(false);
    expect(pdfTextCalls.some((text) => text.includes("999999"))).toBe(false);
    expect(pdfTextCalls).toContain("Recommended Actions");
    expect(pdfTextCalls).toContain("- Review website conversion path before making paid-media budget decisions.");
    expect(storageMock.getCampaignKPIs).toHaveBeenCalledWith("campaign-1");
    expect(storageMock.getCampaignBenchmarks).toHaveBeenCalledWith("campaign-1");
    expect(storageMock.getPlatformKPIs).not.toHaveBeenCalled();
    expect(storageMock.getPlatformBenchmarks).not.toHaveBeenCalled();
  });

  it("keeps certified GA4 rows separate when another report section also needs them", async () => {
    storageMock.getPlatformKPIs.mockResolvedValue([{ id: "ga4-kpi", name: "Certified GA4 KPI", currentValue: "12", targetValue: "15", unit: "count" }]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([{ id: "ga4-bm", name: "Certified GA4 Benchmark", currentValue: "12", benchmarkValue: "15", unit: "count" }]);

    await buildPdfAttachmentForReport({
      report: executiveReport(["performance-summary:overview", "executive-summary:overview"]),
      windowStart: "2026-07-01",
      windowEnd: "2026-07-30",
      campaignName: "Campaign",
      isTest: true,
    });

    expect(pdfTextCalls.some((text) => text.includes("Certified GA4 KPI"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.includes("Revenue target"))).toBe(true);
    expect(storageMock.getPlatformKPIs).toHaveBeenCalledWith("google_analytics", "campaign-1");
    expect(storageMock.getPlatformBenchmarks).toHaveBeenCalledWith("google_analytics", "campaign-1");
    expect(storageMock.getCampaignKPIs).toHaveBeenCalledWith("campaign-1");
    expect(storageMock.getCampaignBenchmarks).toHaveBeenCalledWith("campaign-1");
  });

  it("fails monetary values closed without a valid campaign currency and preserves Monitor severity", async () => {
    storageMock.getCampaign.mockResolvedValue({ id: "campaign-1", name: "Campaign", currency: "" });
    storageMock.getCampaignKPIs.mockResolvedValue([
      { id: "kpi-revenue", name: "Revenue target", metric: "revenue", unit: "USD", targetValue: "6000" },
    ]);
    storageMock.getCampaignBenchmarks.mockResolvedValue([
      { id: "bm-revenue", name: "Revenue benchmark", metric: "revenue", unit: "USD", benchmarkValue: "5500" },
    ]);

    await buildPdfAttachmentForReport({
      report: executiveReport(["executive-summary:overview"]),
      windowStart: "2026-07-01",
      windowEnd: "2026-07-30",
      campaignName: "Campaign",
      isTest: true,
    });

    expect(pdfTextCalls.some((text) => text.includes("Revenue target: Current Unavailable; Target Unavailable"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.startsWith("- KPI Risk: Monitor"))).toBe(true);
    expect(pdfTextCalls.some((text) => text.startsWith("- Benchmark Risk: Monitor"))).toBe(true);
  });
});
