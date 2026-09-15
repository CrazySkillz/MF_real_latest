import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pdfText = vi.hoisted((): string[] => []);
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getGA4Connections: vi.fn(),
  getGA4DailyMetrics: vi.fn(),
  getPlatformKPIs: vi.fn(),
  getPlatformBenchmarks: vi.fn(),
  getRevenueBreakdownBySource: vi.fn(),
  getRevenueSources: vi.fn(),
  getSpendBreakdownBySource: vi.fn(),
  getSpendSources: vi.fn(),
  updateGA4ConnectionTokens: vi.fn(),
}));
const ga4ServiceMock = vi.hoisted(() => ({
  getAcquisitionBreakdown: vi.fn(),
  getConversionEventsReport: vi.fn(),
  getLandingPagesReport: vi.fn(),
  getMetricsWithAutoRefresh: vi.fn(),
  getTimeSeriesData: vi.fn(),
  getTotalsWithRevenue: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: ga4ServiceMock }));
vi.mock("jspdf", () => ({
  jsPDF: class {
    addPage() {}
    circle() {}
    getTextWidth(value: unknown) { return String(value || "").length; }
    line() {}
    rect() {}
    roundedRect() {}
    setDrawColor() {}
    setFillColor() {}
    setFont() {}
    setFontSize() {}
    setLineWidth() {}
    setTextColor() {}
    splitTextToSize(value: unknown) { return [String(value)]; }
    text(value: unknown) {
      (Array.isArray(value) ? value : [value]).forEach((item) => pdfText.push(String(item)));
    }
    output(kind: string) {
      return kind === "nodebuffer" ? Buffer.from("x".repeat(256)) : new ArrayBuffer(256);
    }
  },
}));

import { buildGA4ScheduledPdfAttachment } from "./ga4-scheduled-report-pdf";

const campaign = {
  id: "conversion-events-campaign",
  name: "Conversion events campaign",
  currency: "USD",
  reportingTimeZone: "Europe/Amsterdam",
  ga4CampaignFilter: "saved_campaign",
  startDate: "2026-08-01T00:00:00.000Z",
  createdAt: "2026-08-01T00:00:00.000Z",
};
const connection = {
  id: "conversion-events-connection",
  campaignId: campaign.id,
  propertyId: "properties/987654",
  method: "access_token",
  accessToken: "token",
  isPrimary: true,
  lookbackDays: 30,
  importStartDate: "2026-08-01",
};
const conversionRows = Array.from({ length: 26 }, (_, index) => ({
  eventName: `conv_evt_${String(index + 1).padStart(2, "0")}`,
  conversions: index === 0 ? 2.5 : 26 - index,
  eventCount: 50 - index,
  users: 40 - index,
  revenue: 99999,
}));
const report = {
  id: "conversion-events-report",
  campaignId: campaign.id,
  platformType: "google_analytics",
  name: "Conversion events fixture",
  reportType: "custom",
  configuration: JSON.stringify({
    sections: { overview: true, kpis: false, benchmarks: false, ads: false, insights: false },
    subsections: { overview: { conversionEvents: true } },
  }),
};

describe("GA4 Overview Conversion Events scheduled PDF value parity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
    pdfText.length = 0;
    for (const mock of [...Object.values(storageMock), ...Object.values(ga4ServiceMock)]) mock.mockReset();
    storageMock.getCampaign.mockResolvedValue(campaign);
    storageMock.getGA4Connections.mockResolvedValue([connection]);
    storageMock.getGA4DailyMetrics.mockResolvedValue([]);
    storageMock.getPlatformKPIs.mockResolvedValue([]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([]);
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([]);
    storageMock.getRevenueSources.mockResolvedValue([]);
    storageMock.getSpendBreakdownBySource.mockResolvedValue([]);
    storageMock.getSpendSources.mockResolvedValue([]);
    ga4ServiceMock.getAcquisitionBreakdown.mockResolvedValue({ rows: [], totals: {} });
    ga4ServiceMock.getConversionEventsReport.mockResolvedValue({ rows: conversionRows });
    ga4ServiceMock.getLandingPagesReport.mockResolvedValue({ rows: [] });
    ga4ServiceMock.getMetricsWithAutoRefresh.mockResolvedValue({});
    ga4ServiceMock.getTimeSeriesData.mockResolvedValue([]);
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ totals: {} });
  });

  afterEach(() => vi.useRealTimers());

  it("renders the exact first 25 API rows, preserves fractional credit, and excludes revenue", async () => {
    const result = await buildGA4ScheduledPdfAttachment({
      report,
      reportName: report.name,
      windowStart: "2026-08-01",
      windowEnd: "2026-09-14",
      campaignName: campaign.name,
    });
    const text = pdfText.join("\n");

    expect(result?.length).toBeGreaterThan(100);
    expect(ga4ServiceMock.getConversionEventsReport).toHaveBeenCalledWith(
      campaign.id,
      storageMock,
      "2026-08-01",
      connection.propertyId,
      50,
      campaign.ga4CampaignFilter,
      "2026-09-14",
    );
    for (const value of [
      "Conversion Events", "EVENT", "CONVERSIONS", "EVENT COUNT", "USERS",
      "conv_evt_01", "2.5", "conv_evt_25",
    ]) expect(text).toContain(value);
    expect(text).not.toContain("conv_evt_26");
    expect(text).not.toMatch(/Revenue|99,999/i);
  });

  it("fails closed when selected Conversion Events provider input is unavailable", async () => {
    ga4ServiceMock.getConversionEventsReport.mockRejectedValue(new Error("provider unavailable"));
    await expect(buildGA4ScheduledPdfAttachment({
      report,
      reportName: report.name,
      windowStart: "2026-08-01",
      windowEnd: "2026-09-14",
      campaignName: campaign.name,
    })).rejects.toThrow("GA4_OVERVIEW_REPORT_INPUT_UNAVAILABLE: Conversion Events");
  });
});
