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
  id: "landing-pages-campaign",
  name: "Landing pages campaign",
  currency: "USD",
  reportingTimeZone: "Europe/Amsterdam",
  ga4CampaignFilter: "saved_campaign",
  startDate: "2026-08-01T00:00:00.000Z",
  createdAt: "2026-08-01T00:00:00.000Z",
};
const connection = {
  id: "landing-pages-connection",
  campaignId: campaign.id,
  propertyId: "properties/987654",
  method: "access_token",
  accessToken: "token",
  isPrimary: true,
  lookbackDays: 30,
  importStartDate: "2026-08-01",
};
const landingRows = [{
  landingPage: "/lp?c=saved",
  source: "google",
  medium: "cpc",
  sessions: 8,
  users: 6,
  conversions: 2.5,
  revenue: 99999,
}];
const report = {
  id: "landing-pages-report",
  campaignId: campaign.id,
  platformType: "google_analytics",
  name: "Landing pages fixture",
  reportType: "custom",
  configuration: JSON.stringify({
    sections: { overview: true, kpis: false, benchmarks: false, ads: false, insights: false },
    subsections: { overview: { landingPages: true } },
  }),
};

describe("GA4 Overview Landing Pages scheduled PDF value parity", () => {
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
    ga4ServiceMock.getConversionEventsReport.mockResolvedValue({ rows: [] });
    ga4ServiceMock.getLandingPagesReport.mockResolvedValue({ rows: landingRows });
    ga4ServiceMock.getMetricsWithAutoRefresh.mockResolvedValue({});
    ga4ServiceMock.getTimeSeriesData.mockResolvedValue([]);
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ totals: {} });
  });

  afterEach(() => vi.useRealTimers());

  it("renders the exact API row values and excludes row revenue", async () => {
    const result = await buildGA4ScheduledPdfAttachment({
      report,
      reportName: report.name,
      windowStart: "2026-08-01",
      windowEnd: "2026-09-14",
      campaignName: campaign.name,
    });
    const text = pdfText.join("\n");

    expect(result?.length).toBeGreaterThan(100);
    expect(ga4ServiceMock.getLandingPagesReport).toHaveBeenCalledWith(
      campaign.id,
      storageMock,
      "2026-08-01",
      connection.propertyId,
      50,
      campaign.ga4CampaignFilter,
      "2026-09-14",
    );
    for (const value of [
      "Landing Pages", "LANDING PAGE", "SOURCE/MEDIUM", "SESSIONS", "USERS", "CONVERSIONS", "CONV. RATE",
      landingRows[0].landingPage, "google/cpc", "8", "6", "2.5", "31.3%",
    ]) expect(text).toContain(value);
    expect(text).not.toMatch(/Revenue|99,999/i);
  });
});
