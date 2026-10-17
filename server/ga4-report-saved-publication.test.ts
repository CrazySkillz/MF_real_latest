import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const printed = vi.hoisted((): string[] => []);
const storageMock = vi.hoisted(() => Object.fromEntries([
  "getCampaign", "getGA4Connections", "getGA4DailyMetrics", "getGA4OverviewSnapshot", "getLatestFinancialDailySnapshot",
  "getRevenueSources", "getSpendSources", "getRevenueBreakdownBySource", "getSpendBreakdownBySource", "getPlatformKPIs", "getPlatformBenchmarks",
].map((name) => [name, vi.fn()])));
const provider = vi.hoisted(() => Object.fromEntries([
  "getMetricsWithAutoRefresh", "getAcquisitionBreakdown", "getLandingPagesReport", "getConversionEventsReport", "getTimeSeriesData", "getTotalsWithRevenue",
].map((name) => [name, vi.fn()])));
vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: provider }));
vi.mock("jspdf", () => ({ jsPDF: class {
  addPage() {} circle() {} line() {} rect() {} roundedRect() {} setDrawColor() {} setFillColor() {} setFont() {} setFontSize() {} setLineWidth() {} setTextColor() {}
  getTextWidth(value: unknown) { return String(value).length; }
  splitTextToSize(value: unknown) { return [String(value)]; }
  text(value: unknown) { (Array.isArray(value) ? value : [value]).forEach((item) => printed.push(String(item))); }
  output() { return Buffer.from("x".repeat(256)); }
} }));
import { buildGA4ScheduledPdfAttachment } from "./ga4-scheduled-report-pdf";

const campaignId = "campaign-1";
const propertyId = "542352127";
const overview = () => ({ campaignId, propertyId, windowStart: "2026-10-15", windowEnd: "2026-10-16",
  campaignBreakdown: { rows: [{ campaign: "sale", sessions: 30, users: 25, conversions: 5, revenue: 100.009, engagedSessions: 15, sessionKeyEventRate: 0.1 }],
    totals: { sessions: 30, users: 25, conversions: 5, revenue: 100.009, engagedSessions: 15 }, meta: { currencyCode: "EUR" } },
  landingPages: { rows: [{ landingPage: "/saved", source: "google", medium: "cpc", sessions: 30, users: 25, conversions: 5 }] },
  conversionEvents: { rows: [{ eventName: "purchase_saved", conversions: 5, eventCount: 5, users: 5 }], totals: { conversions: 5 } },
});
const snapshot = () => ({ campaignId, reportingDate: "2026-10-16", metrics: { financialDaily: {
  version: "financial_daily_snapshot_v1", currency: "EUR",
  currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: "2026-10-15", endDate: "2026-10-16", dataThroughDate: "2026-10-16", reportingTimeZone: "Europe/Amsterdam" },
  inputs: { revenue: { value: "130.01", available: true, sources: ["ga4", "revenue-source:r"] },
    spend: { value: "20.00", available: true, sources: ["spend-source:s"] }, conversions: { value: 5, available: true, sources: ["ga4"] } },
} } });
const build = (type = "overview", configuration?: any) => buildGA4ScheduledPdfAttachment({
  report: { id: "report-1", campaignId, reportType: type, configuration, platformType: "google_analytics" },
  reportName: "Saved figures", windowStart: "2026-10-15", windowEnd: "2026-10-16", campaignName: "Sale",
});

describe("GA4 report saved publication", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-17T10:00:00Z")); printed.length = 0;
    Object.values(storageMock).forEach((mock) => mock.mockReset()); Object.values(provider).forEach((mock) => mock.mockReset());
    storageMock.getCampaign.mockResolvedValue({ id: campaignId, currency: "EUR", ga4CampaignFilter: "sale", reportingTimeZone: "Europe/Amsterdam" });
    storageMock.getGA4Connections.mockResolvedValue([{ id: "connection-1", campaignId, propertyId, isPrimary: true, isActive: true, method: "access_token", accessToken: "test-token", importStartDate: "2026-10-15", lookbackDays: 30 }]);
    storageMock.getGA4OverviewSnapshot.mockImplementation(async () => overview());
    storageMock.getLatestFinancialDailySnapshot.mockImplementation(async () => snapshot());
    storageMock.getGA4DailyMetrics.mockResolvedValue([
      { campaignId, propertyId, date: "2026-10-15", sessions: 10, users: 10, conversions: 2, revenue: "40.00", engagedSessions: 5 },
      { campaignId, propertyId, date: "2026-10-16", sessions: 20, users: 15, conversions: 3, revenue: "60.00", engagedSessions: 10 },
    ]);
    storageMock.getRevenueSources.mockResolvedValue([{ id: "r", isActive: true, createdAt: "2026-10-14", currency: "EUR", sourceType: "csv", displayName: "Revenue" }]);
    storageMock.getSpendSources.mockResolvedValue([{ id: "s", isActive: true, currency: "EUR", sourceType: "csv", displayName: "Spend" }]);
    storageMock.getRevenueBreakdownBySource.mockImplementation(async (_id, _start, end) => [{ sourceId: "r", revenue: end === "2026-10-17" ? 80 : 30, currency: "EUR" }]);
    storageMock.getSpendBreakdownBySource.mockResolvedValue([{ sourceId: "s", spend: 20, currency: "EUR" }]);
    storageMock.getPlatformKPIs.mockResolvedValue([]); storageMock.getPlatformBenchmarks.mockResolvedValue([]);
    for (const mock of Object.values(provider)) mock.mockRejectedValue(new Error("later provider response must not be queried"));
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("renders saved tables and exact published Revenue/Spend/CPA without querying GA4", async () => {
    expect((await build())?.length).toBeGreaterThan(100);
    const text = printed.join("\n");
    for (const value of ["EUR 130.01", "EUR 20.00", "EUR 4.00", "/saved", "purchase_saved"]) expect(text).toContain(value);
    expect(text).not.toContain("180.01");
    for (const mock of Object.values(provider)) expect(mock).not.toHaveBeenCalled();
    expect(storageMock.getRevenueBreakdownBySource).toHaveBeenCalledWith(campaignId, "1900-01-01", "2026-10-16", "ga4");
  });
  it.each(["missing", "campaign", "property", "window", "currency"])("rejects incompatible saved Overview: %s", async (condition) => {
    const saved = overview();
    if (condition === "campaign") saved.campaignId = "another-campaign";
    if (condition === "property") saved.propertyId = "another-property";
    if (condition === "window") saved.windowStart = "2026-10-14";
    if (condition === "currency") saved.campaignBreakdown.meta.currencyCode = "USD";
    storageMock.getGA4OverviewSnapshot.mockResolvedValue(condition === "missing" ? null : saved);
    await expect(build()).rejects.toThrow("Saved publication");
    expect(printed).toEqual([]);
  });
  it.each(["missing", "currency", "timezone", "revenue", "conversions", "source revision", "source currency"])("rejects incompatible financial inputs: %s", async (condition) => {
    const saved = snapshot();
    if (condition === "currency") saved.metrics.financialDaily.currency = "USD";
    if (condition === "timezone") saved.metrics.financialDaily.currentValueWindow.reportingTimeZone = "UTC";
    if (condition === "revenue") saved.metrics.financialDaily.inputs.revenue.value = "150.00";
    if (condition === "conversions") saved.metrics.financialDaily.inputs.conversions.value = 6;
    if (condition === "source revision") storageMock.getRevenueBreakdownBySource.mockResolvedValue([{ sourceId: "r", revenue: 40, currency: "EUR" }]);
    if (condition === "source currency") storageMock.getSpendSources.mockResolvedValue([{ id: "s", isActive: true, currency: "USD" }]);
    storageMock.getLatestFinancialDailySnapshot.mockResolvedValue(condition === "missing" ? null : saved);
    await expect(build()).rejects.toThrow("Financial publication changed");
    expect(printed).toEqual([]);
  });
  it("rejects daily values revised between the captured report reads", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([{ date: "2026-10-16", sessions: 31, conversions: 6 }]);
    await expect(build()).rejects.toThrow("Daily publication changed");
  });
  it("rejects a concurrent publication even when headline totals are unchanged", async () => {
    storageMock.getGA4OverviewSnapshot.mockResolvedValueOnce({ ...overview(), updatedAt: "2026-10-17T08:00:00Z" })
      .mockResolvedValueOnce({ ...overview(), updatedAt: "2026-10-17T08:01:00Z" });
    await expect(build()).rejects.toThrow("Daily publication changed");
  });
  it("rejects duplicate daily dates rather than treating row count as complete coverage", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([{ date: "2026-10-16", sessions: 10, conversions: 2 }, { date: "2026-10-16", sessions: 20, conversions: 3 }]);
    await expect(build()).rejects.toThrow("Daily publication changed");
  });
  it("does not use a disconnected primary connection's saved publication", async () => {
    storageMock.getGA4Connections.mockResolvedValue([{ campaignId, propertyId, isPrimary: true, isActive: false, method: "access_token" }]);
    await expect(build()).rejects.toThrow("NO_GA4_CONNECTION");
    expect(storageMock.getGA4OverviewSnapshot).not.toHaveBeenCalled();
  });
  it("allows a table-only report without requiring unrelated financial publication", async () => {
    storageMock.getLatestFinancialDailySnapshot.mockResolvedValue(null);
    await expect(build("custom", { sections: { overview: true }, subsections: { overview: { landingPages: true } } })).resolves.toBeTruthy();
    expect(printed.join("\n")).toContain("/saved");
  });
  it("renders KPI and Benchmark current values from the report publication despite older stored rows", async () => {
    storageMock.getPlatformKPIs.mockResolvedValue([{ id: "k", name: "Revenue KPI", metric: "revenue", currentValue: "999.99", targetValue: "200" }]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([{ id: "b", name: "CPA Benchmark", metric: "cpa", currentValue: "777.77", benchmarkValue: "5" }]);
    await build("custom", { sections: { kpis: true, benchmarks: true }, subsections: { kpis: { items: true }, benchmarks: { items: true } }, selectedKpiIds: ["k"], selectedBenchmarkIds: ["b"] });
    expect(printed).toContain("130.01"); expect(printed).toContain("4.00");
    expect(printed).not.toContain("999.99"); expect(printed).not.toContain("777.77");
  });
  it("shows unavailable Spend when the saved publication has no Spend source", async () => {
    const saved: any = snapshot(); saved.metrics.financialDaily.inputs.spend = { value: null, available: false, sources: [] };
    storageMock.getLatestFinancialDailySnapshot.mockResolvedValue(saved);
    storageMock.getSpendSources.mockResolvedValue([]); storageMock.getSpendBreakdownBySource.mockResolvedValue([]);
    await build(); expect(printed).toContain("Unavailable");
  });
});
