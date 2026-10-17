import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";
import { resolveGA4KpiMetricIdentity } from "../shared/ga4-kpi-metric-identity";
import { formatPct, normalizeRateToPercent } from "../shared/metric-math";

const page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
const start = page.indexOf("const downloadGA4Report = async");
const end = page.indexOf('const { jsPDF } = await import("jspdf");', start);
if (start < 0 || end < start) throw new Error("Browser report preflight not found");
// Run the actual preflight before the PDF dependency is loaded or a file saved.
const preflight = page.slice(start, end) + 'return "ready"; }; return downloadGA4Report;';
function run(overrides: Record<string, any> = {}, configuration?: any, reportType = "custom", body = preflight) {
  const bindings: Record<string, any> = {
    ga4ReportForm: {}, normalizeCustomReportConfig: (value: any) => value, resolveGA4KpiMetricIdentity,
    campaignId: "campaign-a", campaign: { reportingTimeZone: "Europe/Amsterdam" }, campaignCurrency: "EUR", selectedGA4PropertyId: "123",
    normalizeClientReportingTimeZone: (value: string) => value,
    platformKPIs: [{ id: "k", metric: "revenue" }], benchmarks: [], revenueDisplaySources: [],
    overviewFinancialSnapshot: { campaignId: "campaign-a", metrics: { financialDaily: { currency: "EUR", currentValueWindow: { startDate: "2026-10-15", reportingTimeZone: "Europe/Amsterdam" } } } },
    overviewFinancialRevenueAvailable: true, overviewFinancialConversionsAvailable: true, overviewFinancialSpendAvailable: true,
    overviewFinancialRefreshWarning: null, overviewFinancialReportingDate: "2026-10-16", overviewFinancialRevenue: 130,
    overviewFinancialConversions: 5, overviewFinancialSpend: 20, financialRevenue: 130, financialConversions: 5, financialSpend: 20,
    ga4ToDateResp: { startDate: "2026-10-15", endDate: "2026-10-16" },
    overviewSummaryAvailable: true, financialRevenueAvailable: true, financialSpendAvailable: true,
    importedRevenueError: false, revenueSourcesError: false, revenueBreakdownError: false,
    spendSourcesError: false, spendToDateError: false, spendBreakdownError: false,
    spendSourceDefinitionsKnownEmpty: false, hasSpendSources: true,
    campaignBreakdownUnavailable: false, landingPagesUnavailable: false, conversionEventsUnavailable: false,
    ...overrides,
  };
  const callback = new Function(...Object.keys(bindings), ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(bindings));
  return callback({ reportType, configuration: configuration || { sections: { kpis: true }, subsections: {}, selectedKpiIds: ["k"], selectedBenchmarkIds: [] } });
}

describe("Browser GA4 report publication gate", () => {
  it("accepts aligned figures", async () => { await expect(run()).resolves.toBe("ready"); });
  it.each([
    { financialRevenue: 140 }, { financialConversions: 6 }, { financialSpend: 30 },
    { overviewFinancialSnapshot: null }, { overviewFinancialRefreshWarning: "Retained figures" },
    { overviewFinancialReportingDate: "2026-10-15" }, { campaignCurrency: "USD" },
    { campaign: { reportingTimeZone: "UTC" } }, { overviewFinancialRevenueAvailable: false },
  ])("rejects mixed or unavailable inputs before loading the PDF library: %j", async changes => {
    await expect(run(changes)).rejects.toThrow("successful aligned data refresh");
  });
  it("does not block a nonfinancial custom KPI on an unrelated financial publication", async () => {
    await expect(run({ platformKPIs: [{ id: "k", metric: "sessions" }], overviewFinancialSnapshot: null })).resolves.toBe("ready");
  });
  it("keeps an empty saved KPI selection empty", async () => {
    await expect(run({ overviewFinancialSnapshot: null }, { sections: { kpis: true }, subsections: {}, selectedKpiIds: [], selectedBenchmarkIds: [] })).resolves.toBe("ready");
  });
});

describe("Browser Overview reports without a Spend source", () => {
  const absentSpend = {
    financialSpendAvailable: false, overviewFinancialSpendAvailable: false,
    financialSpend: 0, overviewFinancialSpend: 0, hasSpendSources: false, spendSourceDefinitionsKnownEmpty: true,
  };
  const customOverview = (selected: string) => ({
    sections: { overview: true },
    subsections: { overview: Object.fromEntries(["summary", "revenue", "spend", "performance", "campaignBreakdown", "landingPages", "conversionEvents"].map(key => [key, key === selected])) },
    selectedKpiIds: [], selectedBenchmarkIds: [],
  });
  it.each(["overview", "spend", "performance"])("allows %s when Spend is confirmed absent", async section => {
    await expect(run(absentSpend, customOverview(section), section === "overview" ? "overview" : "custom")).resolves.toBe("ready");
  });
  it.each([
    ["source lookup failed", { spendSourcesError: true }],
    ["source list not loaded or not empty", { spendSourceDefinitionsKnownEmpty: false }],
    ["source amounts unavailable", { spendSourceDefinitionsKnownEmpty: false, hasSpendSources: true }],
    ["retained source breakdown", { hasSpendSources: true }],
    ["both amount requests failed", { spendToDateError: true, spendBreakdownError: true }],
    ["old published zero Spend source", { overviewFinancialSpendAvailable: true }],
  ])("still blocks %s", async (_name, changes) => {
    await expect(run({ ...absentSpend, ...changes }, undefined, "overview")).rejects.toThrow("unavailable: Spend");
  });
  it("blocks removal of a previously published positive Spend source", async () => {
    await expect(run({ ...absentSpend, overviewFinancialSpendAvailable: true, overviewFinancialSpend: 20 }, undefined, "overview")).rejects.toThrow("successful aligned data refresh");
  });
  it.each([
    ["Summary", { overviewSummaryAvailable: false }], ["Revenue", { revenueSourcesError: true }],
    ["Campaign Breakdown", { campaignBreakdownUnavailable: true }], ["Landing Pages", { landingPagesUnavailable: true }],
    ["Conversion Events", { conversionEventsUnavailable: true }],
  ])("preserves the %s failure guard", async (section, changes) => {
    await expect(run({ ...absentSpend, ...changes }, undefined, "overview")).rejects.toThrow(`unavailable: ${section}.`);
  });
  it("does not require Spend for a custom Summary-only report", async () => {
    await expect(run({ ...absentSpend, spendSourcesError: true }, customOverview("summary"))).resolves.toBe("ready");
  });

  // Execute the complete browser handler with real PDF drawing; intercept only logo loading and file saving.
  const handlerEnd = page.indexOf("const connectedPropertyCount =", end);
  if (handlerEnd < end) throw new Error("Browser report handler end not found");
  const handler = page.slice(start, handlerEnd).replace('const { jsPDF } = await import("jspdf");', "") + "return downloadGA4Report;";
  async function render(changes: Record<string, any>, reportType = "overview", configuration?: any) {
    const doc = new jsPDF();
    const text = vi.spyOn(doc, "text");
    const save = vi.spyOn(doc, "save").mockReturnValue(doc);
    await run({
      ...absentSpend, jsPDF: function () { return doc; }, loadMimoSaaSReportLogo: async () => null,
      campaign: { name: "Ptomo", currency: "EUR", reportingTimeZone: "Europe/Amsterdam" },
      ga4Metrics: { propertyId: "123" }, overviewSummaryTotals: { sessions: 2977, users: 2978, conversions: 262 },
      overviewSummaryEngagementRate: 0.724, financialRevenue: 65659.5, overviewFinancialRevenue: 65659.5,
      financialConversions: 262, overviewFinancialConversions: 262, financialROAS: 0,
      ga4HasRevenueMetric: true, ga4RevenueForFinancials: 65659.5, spendDisplaySources: [],
      campaignBreakdownAgg: [], campaignBreakdownMatchedExternalRevenue: new Map(),
      ga4LandingPages: { rows: [] }, ga4ConversionEvents: { rows: [] }, formatPct, normalizeRateToPercent,
      ...changes,
    }, configuration, reportType, handler);
    expect(save).toHaveBeenCalledOnce();
    expect(doc.output()).toMatch(/^%PDF-/);
    const words = text.mock.calls.map(call => call[0]);
    return (label: string) => words[words.indexOf(label.toUpperCase()) + 1];
  }
  it.each(["overview", "spend", "performance"])("downloads the actual %s PDF with missing Spend marked unavailable", async section => {
    const metric = await render({}, section === "overview" ? "overview" : "custom", customOverview(section));
    if (section !== "performance") expect(metric("Total Spend")).toBe("Unavailable");
    if (section !== "spend") for (const label of ["Profit", "ROAS", "ROI", "CPA"]) expect(metric(label)).toBe("Unavailable");
    if (section === "overview") {
      expect(metric("Sessions")).toBe("2,977");
      expect(metric("Conversions")).toBe("262");
      expect(metric("Total Revenue")).toBe("EUR 65,659.50");
    }
  });
  it.each([0, 1000])("preserves a configured Spend source with amount %s", async spend => {
    const metric = await render({ financialSpendAvailable: true, overviewFinancialSpendAvailable: true,
      financialSpend: spend, overviewFinancialSpend: spend, hasSpendSources: true, spendSourceDefinitionsKnownEmpty: false,
      financialROAS: spend ? 65659.5 / spend : 0 });
    expect(metric("Total Spend")).toBe(spend ? "EUR 1,000.00" : "EUR 0.00");
    expect(metric("Profit")).toBe(spend ? "EUR 64,659.50" : "EUR 65,659.50");
    expect(metric("ROAS")).toBe(spend ? "65.66x" : "—");
    expect(metric("ROI")).toBe(spend ? formatPct(6465.95) : "—");
    expect(metric("CPA")).toBe(spend ? "EUR 3.82" : "—");
  });

  // Derive Revenue availability from the page expressions, rather than forcing a ready flag for zero.
  const revenueNames = ["ga4RevenueMetricName", "ga4FinancialNativeAvailable", "ga4RevenueForFinancials", "ga4HasRevenueMetric",
    "revenueMetricAvailable", "importedRevenueForFinancials", "revenueSourceDefinitionsKnownEmpty", "importedRevenueAvailable",
    "financialRevenueAvailable", "financialRevenue"];
  const revenueExpressions: Record<string, string> = {};
  const ast = ts.createSourceFile("ga4-metrics.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visitRevenue(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && revenueNames.includes(node.name.getText(ast))) revenueExpressions[node.name.getText(ast)] = node.initializer!.getText(ast);
    ts.forEachChild(node, visitRevenue);
  }
  visitRevenue(ast);
  function zeroRevenue(changes: Record<string, any> = {}) {
    const args: Record<string, any> = {
      ga4ToDateResp: { revenueMetric: "totalRevenue", startDate: "2026-10-15", endDate: "2026-10-16" },
      ga4FinancialTotalsSource: { revenue: 0, conversions: 262 }, activeRevenueSource: null,
      requiresVerifiedNativeCurrency: false, importedRevenueToDateResp: undefined,
      revenueSourcesResp: { sources: [] }, activeTab: "reports", useMemo: (callback: () => any) => callback(), ...changes,
    };
    const body = revenueNames.map(name => `const ${name} = ${revenueExpressions[name]};`).join("\n") + `return { ${revenueNames.join(",")} };`;
    return { ...args, ...new Function(...Object.keys(args), ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(args)), overviewFinancialRevenue: 0 };
  }
  it.each(["totalRevenue", "purchaseRevenue"])("accepts zero %s with no external Revenue or Spend source", async revenueMetric => {
    const inputs = zeroRevenue({ ga4ToDateResp: { revenueMetric, startDate: "2026-10-15", endDate: "2026-10-16" } });
    expect(inputs.financialRevenueAvailable).toBe(true);
    const metric = await render(inputs);
    expect(metric("Total Revenue")).toBe("EUR 0.00");
    for (const name of ["Total Spend", "Profit", "ROAS", "ROI", "CPA"]) expect(metric(name)).toBe("Unavailable");
  });
  it("downloads a custom Revenue-only PDF with valid zero revenue", async () => {
    const metric = await render(zeroRevenue(), "custom", customOverview("revenue"));
    expect(metric("Total Revenue")).toBe("EUR 0.00");
  });
  it("keeps zero Revenue with positive Spend distinct from unavailable Revenue", async () => {
    const metric = await render({ ...zeroRevenue(), financialSpendAvailable: true, overviewFinancialSpendAvailable: true,
      financialSpend: 1000, overviewFinancialSpend: 1000, hasSpendSources: true, spendSourceDefinitionsKnownEmpty: false });
    expect(metric("Total Revenue")).toBe("EUR 0.00");
    expect(metric("Profit")).toBe("EUR -1,000.00");
    expect(metric("ROAS")).toBe("0.00x");
    expect(metric("ROI")).toBe(formatPct(-100));
    expect(metric("CPA")).toBe("EUR 3.82");
  });
  it.each([
    { importedRevenueError: true }, { revenueSourcesError: true }, { revenueBreakdownError: true },
    { revenueDisplaySources: [{ revenue: null, materializedRevenueStatus: "unavailable" }] },
  ])("still rejects failed Revenue inputs when the last value is zero: %j", async changes => {
    await expect(run({ ...absentSpend, ...zeroRevenue(), ...changes }, undefined, "overview")).rejects.toThrow("unavailable: Revenue.");
  });
  it("blocks an unknown Revenue source list even when native Revenue is zero", async () => {
    const inputs = zeroRevenue({ revenueSourcesResp: undefined });
    expect(inputs.financialRevenueAvailable).toBe(false);
    await expect(run({ ...absentSpend, ...inputs }, undefined, "overview")).rejects.toThrow("unavailable: Revenue.");
  });
  it("blocks a missing or failed Revenue publication rather than inventing zero", async () => {
    await expect(run({ ...absentSpend, ...zeroRevenue(), overviewFinancialRevenueAvailable: false }, undefined, "overview")).rejects.toThrow("successful aligned data refresh");
  });
});

describe("Insights financial recommendation input states", () => {
  const source = ts.createSourceFile("ga4-metrics.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const expressions: Record<string, string> = {};
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ["revenueKpiInputState", "spendKpiInputState", "combineKpiInputStates"].includes(node.name.getText(source))) expressions[node.name.getText(source)] = node.initializer!.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  const evaluate = (name: string, changes: Record<string, any> = {}) => {
    const args: Record<string, any> = { nativeRevenueKpiInputState: "ready", importedRevenueKpiInputState: "ready", snapshotRevenueKpiInputState: "ready",
      financialRevenue: 130, overviewFinancialRevenue: 130, spendSourcesError: false, spendSourcesResp: { sources: [{}] },
      financialDailySnapshotResp: { snapshot: {} }, financialDailySnapshotError: false, overviewFinancialRefreshWarning: null,
      overviewFinancialSpendAvailable: true, hasSpendSources: true, financialSpend: 20, overviewFinancialSpend: 20,
      spendSourceDefinitionsKnownEmpty: false, spendBreakdownResp: { totalSpend: 20 }, spendBreakdownError: false, ...changes };
    return new Function(...Object.keys(args), ts.transpileModule(`const combineKpiInputStates = ${expressions.combineKpiInputStates}; return ${expressions[name]};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(args));
  };
  it("keeps revised Revenue out of recommendations until the publication matches", () => {
    expect(evaluate("revenueKpiInputState")).toBe("ready");
    expect(evaluate("revenueKpiInputState", { financialRevenue: 140 })).toBe("stale");
    expect(evaluate("revenueKpiInputState", { snapshotRevenueKpiInputState: "unavailable" })).toBe("unavailable");
  });
  it("distinguishes revised, removed, failed and genuinely absent Spend", () => {
    expect(evaluate("spendKpiInputState")).toBe("ready");
    for (const changes of [{ financialSpend: 30 }, { hasSpendSources: false }, { financialDailySnapshotError: true }]) expect(evaluate("spendKpiInputState", changes)).toBe("stale");
    expect(evaluate("spendKpiInputState", { financialDailySnapshotResp: undefined })).toBe("loading");
    expect(evaluate("spendKpiInputState", { overviewFinancialSpendAvailable: false, hasSpendSources: false, spendSourceDefinitionsKnownEmpty: true })).toBe("ready");
  });
});
