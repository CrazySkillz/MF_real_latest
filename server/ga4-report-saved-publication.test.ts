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

  it("renders past-dated spend from a source connected today without changing the report boundary", async () => {
    const saved = snapshot(); saved.metrics.financialDaily.inputs.spend.value = "1100.00";
    storageMock.getLatestFinancialDailySnapshot.mockResolvedValue(saved);
    storageMock.getSpendSources.mockResolvedValue([{ id: "s", isActive: true, currency: "EUR", sourceType: "csv", createdAt: "2026-10-17", displayName: "Test_spend.csv" }]);
    storageMock.getSpendBreakdownBySource.mockResolvedValue([{ sourceId: "s", spend: 1100, currency: "EUR" }]);
    expect((await build())?.length).toBeGreaterThan(100);
    const metric = (label: string) => printed[printed.indexOf(label.toUpperCase()) + 1];
    expect(metric("Total Spend")).toBe("EUR 1,100.00");
    expect(metric("Total Revenue")).toBe("EUR 130.01");
    expect(metric("CPA")).toBe("EUR 220.00");
    expect(storageMock.getSpendBreakdownBySource).toHaveBeenCalledWith(campaignId, "1900-01-01", "2026-10-16", "ga4");
    for (const mock of Object.values(provider)) expect(mock).not.toHaveBeenCalled();
  });

  it.each([0.75, 0.000075, 2])("prints credit %s consistently in scheduled Summary, details, goals and CPA", async credit => {
    const saved = overview();
    saved.campaignBreakdown.totals.conversions = credit;
    saved.campaignBreakdown.rows[0].conversions = credit;
    saved.landingPages.rows[0].conversions = credit;
    saved.conversionEvents.rows[0].conversions = credit;
    saved.conversionEvents.totals.conversions = credit;
    storageMock.getGA4OverviewSnapshot.mockResolvedValue(saved);
    const daily = await storageMock.getGA4DailyMetrics();
    storageMock.getGA4DailyMetrics.mockResolvedValue(daily.map((row: any, i: number) => ({ ...row, conversions: i === 0 ? 0 : credit })));
    const financial = snapshot(); financial.metrics.financialDaily.inputs.conversions.value = credit;
    storageMock.getLatestFinancialDailySnapshot.mockResolvedValue(financial);
    storageMock.getPlatformKPIs.mockResolvedValue([{ id: "k", name: "Conversion goal", metric: "conversions", currentValue: "999", unit: "count", targetValue: "10" }]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([{ id: "b", name: "Conversion reference", metric: "conversions", currentValue: "999", unit: "count", benchmarkValue: "10" }]);
    await build("custom", JSON.stringify({ sections: { overview: true, kpis: true, benchmarks: true },
      subsections: { overview: { summary: true, performance: true, campaignBreakdown: true, landingPages: true, conversionEvents: true }, kpis: { items: true }, benchmarks: { items: true } }, selectedKpiIds: ["k"], selectedBenchmarkIds: ["b"] }));
    expect(printed.filter(text => text === String(credit)).length).toBeGreaterThanOrEqual(6);
    expect(printed).toContain(`EUR ${(20 / credit).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    expect(printed).not.toContain("999");
    for (const mock of Object.values(provider)) expect(mock).not.toHaveBeenCalled();
  });

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
  it("uses EUR8003.96 after Shopify deletion in report Revenue, KPI and Benchmark values", async () => {
    const ga4 = overview();
    ga4.campaignBreakdown.totals.revenue = 7653.96; ga4.campaignBreakdown.rows[0].revenue = 7653.96;
    storageMock.getGA4OverviewSnapshot.mockResolvedValue(ga4);
    const daily = await storageMock.getGA4DailyMetrics();
    storageMock.getGA4DailyMetrics.mockResolvedValue(daily.map((row: any, i: number) => ({ ...row, revenue: i === 0 ? "3000.00" : "4653.96" })));
    const saved: any = snapshot();
    saved.metrics.financialDaily.inputs.revenue = { value: "8003.96", available: true, sources: ["ga4", "revenue-source:h", "revenue-source:f"] };
    saved.metrics.financialDaily.inputs.spend = { value: null, available: false, sources: [] };
    storageMock.getLatestFinancialDailySnapshot.mockResolvedValue(saved);
    storageMock.getRevenueSources.mockResolvedValue([
      { id: "h", isActive: true, sourceType: "hubspot", currency: "EUR", mappingConfig: JSON.stringify({ pipelineEnabled: true, pipelineTotalToDate: 3200 }) },
      { id: "f", isActive: true, sourceType: "salesforce", currency: "EUR" },
    ]);
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([{ sourceId: "h", revenue: 250, currency: "EUR" }, { sourceId: "f", revenue: 100, currency: "EUR" }]);
    storageMock.getSpendSources.mockResolvedValue([]); storageMock.getSpendBreakdownBySource.mockResolvedValue([]);
    storageMock.getPlatformKPIs.mockResolvedValue([{ id: "k", name: "Revenue KPI", metric: "revenue", currentValue: "8789.91", targetValue: "10000" }]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([{ id: "b", name: "Revenue Benchmark", metric: "revenue", currentValue: "8789.91", benchmarkValue: "10000" }]);
    await build("custom", { sections: { overview: true, kpis: true, benchmarks: true },
      subsections: { overview: { revenue: true, spend: true, performance: true }, kpis: { items: true }, benchmarks: { items: true } }, selectedKpiIds: ["k"], selectedBenchmarkIds: ["b"] });
    expect(printed).toContain("EUR 8,003.96"); expect(printed.filter(value => value === "8003.96")).toHaveLength(2);
    expect(printed).toContain("Unavailable"); expect(printed.join("\n")).not.toMatch(/8,?789\.91|11,?203\.96/);
    for (const mock of Object.values(provider)) expect(mock).not.toHaveBeenCalled();
  });
  it.each(["overview", "kpis", "benchmarks", "custom"])("uses native GA4 Revenue without external sources in a %s report", async type => {
    const saved: any = snapshot();
    saved.metrics.financialDaily.inputs.revenue = { value: "100.01", available: true, sources: ["ga4"] };
    saved.metrics.financialDaily.inputs.spend = { value: null, available: false, sources: [] };
    storageMock.getLatestFinancialDailySnapshot.mockResolvedValue(saved);
    storageMock.getRevenueSources.mockResolvedValue([]); storageMock.getSpendSources.mockResolvedValue([]);
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([]); storageMock.getSpendBreakdownBySource.mockResolvedValue([]);
    storageMock.getPlatformKPIs.mockResolvedValue([{ id: "k", name: "Native Revenue KPI", metric: "revenue", currentValue: "999.99", targetValue: "200" }]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([{ id: "b", name: "Native Revenue Benchmark", metric: "revenue", currentValue: "777.77", benchmarkValue: "200" }]);
    await build(type, { sections: { overview: true, kpis: true, benchmarks: true }, subsections: { overview: { summary: true, revenue: true, spend: true, performance: true }, kpis: { items: true }, benchmarks: { items: true } }, selectedKpiIds: ["k"], selectedBenchmarkIds: ["b"] });
    expect(printed.join("\n")).toContain("100.01");
    expect(printed.join("\n")).not.toMatch(/999\.99|777\.77|130\.01/);
    if (["overview", "custom"].includes(type)) expect(printed).toContain("Unavailable");
    for (const mock of Object.values(provider)) expect(mock).not.toHaveBeenCalled();
  });
  it("includes the saved native Revenue and unavailable Spend in an actual PDF artifact", async () => {
    const actual = await vi.importActual<typeof import("jspdf")>("jspdf");
    vi.spyOn(await import("jspdf"), "jsPDF").mockImplementation(function (...args: any[]) {
      return new (actual.jsPDF as any)(...args);
    } as any);
    const saved: any = snapshot();
    saved.metrics.financialDaily.inputs.revenue = { value: "100.01", available: true, sources: ["ga4"] };
    saved.metrics.financialDaily.inputs.spend = { value: null, available: false, sources: [] };
    storageMock.getLatestFinancialDailySnapshot.mockResolvedValue(saved);
    storageMock.getRevenueSources.mockResolvedValue([]); storageMock.getSpendSources.mockResolvedValue([]);
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([]); storageMock.getSpendBreakdownBySource.mockResolvedValue([]);
    const pdf = (await build())!;
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("EUR 100.01");
    expect(pdf.toString("latin1")).toContain("Unavailable");
    expect(pdf.toString("latin1")).not.toContain("EUR 130.01");
    for (const mock of Object.values(provider)) expect(mock).not.toHaveBeenCalled();
  });
  it.each([null, 0, 20])("renders zero Revenue without external Revenue sources and Spend=%s", async spend => {
    const ga4 = overview();
    ga4.campaignBreakdown.totals.revenue = 0;
    ga4.campaignBreakdown.rows[0].revenue = 0;
    const saved: any = snapshot();
    saved.metrics.financialDaily.inputs.revenue = { value: "0.00", available: true, sources: ["ga4"] };
    saved.metrics.financialDaily.inputs.spend = spend === null
      ? { value: null, available: false, sources: [] }
      : { value: String(spend), available: true, sources: ["spend-source:s"] };
    storageMock.getGA4OverviewSnapshot.mockResolvedValue(ga4);
    storageMock.getLatestFinancialDailySnapshot.mockResolvedValue(saved);
    storageMock.getRevenueSources.mockResolvedValue([]);
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([]);
    storageMock.getSpendSources.mockResolvedValue(spend === null ? [] : [{ id: "s", isActive: true, currency: "EUR" }]);
    storageMock.getSpendBreakdownBySource.mockResolvedValue(spend === null ? [] : [{ sourceId: "s", spend, currency: "EUR" }]);
    expect((await build())?.length).toBeGreaterThan(100);
    const metric = (label: string) => printed[printed.indexOf(label.toUpperCase()) + 1];
    expect(metric("Total Revenue")).toBe("EUR 0.00");
    expect(metric("Total Spend")).toBe(spend === null ? "Unavailable" : `EUR ${spend.toFixed(2)}`);
    if (spend === null) {
      expect(metric("Profit")).toBe("Unavailable");
      for (const label of ["ROAS", "ROI", "CPA"]) expect(metric(label)).toBe("—");
    }
    if (spend === 20) {
      expect(metric("Profit")).toBe("EUR -20.00");
      expect(metric("ROAS")).toBe("0.00x");
      expect(metric("ROI")).toBe("-100.0%");
      expect(metric("CPA")).toBe("EUR 4.00");
    }
    for (const mock of Object.values(provider)) expect(mock).not.toHaveBeenCalled();
  });
  it("rejects unavailable Revenue in the saved publication", async () => {
    const saved: any = snapshot();
    saved.metrics.financialDaily.inputs.revenue = { value: null, available: false, sources: [] };
    storageMock.getLatestFinancialDailySnapshot.mockResolvedValue(saved);
    await expect(build()).rejects.toThrow("Financial publication changed");
    expect(printed).toEqual([]);
  });
  it.each(["hubspot", "salesforce", "shopify", "google_sheets", "csv"])("includes completed-day %s revenue even when connected today", async sourceType => {
    storageMock.getRevenueSources.mockResolvedValue([{ id: "r", isActive: true, createdAt: "2026-10-17", currency: "EUR", sourceType }]);
    await build();
    expect(printed).toContain("EUR 130.01");
    expect(storageMock.getRevenueBreakdownBySource).toHaveBeenCalledWith(campaignId, "1900-01-01", "2026-10-16", "ga4");
  });
  it.each(["overview", "kpis", "benchmarks", "custom"])("rejects missing new-source materialization in a %s report", async type => {
    storageMock.getRevenueSources.mockResolvedValue([{ id: "r", isActive: true, createdAt: "2026-10-17", currency: "EUR", sourceType: "csv" }]);
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([]);
    const saved = snapshot(); saved.metrics.financialDaily.inputs.revenue.value = "100.01";
    storageMock.getLatestFinancialDailySnapshot.mockResolvedValue(saved);
    storageMock.getPlatformKPIs.mockResolvedValue([{ id: "k", name: "Revenue KPI", metric: "revenue", currentValue: "100.01", targetValue: "200" }]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([{ id: "b", name: "Revenue Benchmark", metric: "revenue", currentValue: "100.01", benchmarkValue: "200" }]);
    await expect(build(type, { sections: { kpis: true }, subsections: { kpis: { items: true } }, selectedKpiIds: ["k"] })).rejects.toThrow("GA4_OVERVIEW_REPORT_INPUT_UNAVAILABLE");
    expect(printed).toEqual([]);
  });
  it.each(["overview", "kpis", "benchmarks", "custom"])("keeps verified future-only revenue excluded in a completed-day %s report", async type => {
    storageMock.getRevenueSources.mockResolvedValue([{ id: "r", isActive: true, createdAt: "2026-10-17", currency: "EUR", sourceType: "csv" }]);
    storageMock.getRevenueBreakdownBySource.mockImplementation(async (_id, start) => start === "2026-10-17"
      ? [{ sourceId: "r", revenue: 30, currency: "EUR" }] : []);
    const saved = snapshot(); saved.metrics.financialDaily.inputs.revenue.value = "100.01";
    storageMock.getLatestFinancialDailySnapshot.mockResolvedValue(saved);
    storageMock.getPlatformKPIs.mockResolvedValue([{ id: "k", name: "Revenue KPI", metric: "revenue", currentValue: "999.99", targetValue: "200" }]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([{ id: "b", name: "Revenue Benchmark", metric: "revenue", currentValue: "999.99", benchmarkValue: "200" }]);
    await build(type, { sections: { kpis: true }, subsections: { kpis: { items: true } }, selectedKpiIds: ["k"] });
    expect(printed.join("\n")).toContain("100.01");
    expect(printed.join("\n")).not.toMatch(/130\.01|999\.99/);
  });
  it("blocks a new source with mismatched currency despite matching numeric totals", async () => {
    storageMock.getRevenueSources.mockResolvedValue([{ id: "r", isActive: true, createdAt: "2026-10-17", currency: "USD", sourceType: "csv" }]);
    await expect(build()).rejects.toThrow("Financial publication changed");
    expect(printed).toEqual([]);
  });
  it("does not assume missing rows are future sales when verification fails", async () => {
    storageMock.getRevenueSources.mockResolvedValue([{ id: "r", isActive: true, createdAt: "2026-10-17", currency: "EUR", sourceType: "csv" }]);
    storageMock.getRevenueBreakdownBySource.mockImplementation(async (_id, start) => {
      if (start === "2026-10-17") throw new Error("fixture verification failure");
      return [];
    });
    await expect(build()).rejects.toThrow("GA4_OVERVIEW_REPORT_INPUT_UNAVAILABLE: Revenue");
    expect(printed).toEqual([]);
  });
});
