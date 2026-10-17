import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { resolveGA4KpiMetricIdentity } from "../shared/ga4-kpi-metric-identity";

const page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
const start = page.indexOf("const downloadGA4Report = async");
const end = page.indexOf('const { jsPDF } = await import("jspdf");', start);
if (start < 0 || end < start) throw new Error("Browser report preflight not found");
// Run the actual preflight before the PDF dependency is loaded or a file saved.
const preflight = page.slice(start, end) + 'return "ready"; }; return downloadGA4Report;';
function run(overrides: Record<string, any> = {}, configuration?: any) {
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
    ...overrides,
  };
  const callback = new Function(...Object.keys(bindings), ts.transpileModule(preflight, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(bindings));
  return callback({ reportType: "custom", configuration: configuration || { sections: { kpis: true }, subsections: {}, selectedKpiIds: ["k"], selectedBenchmarkIds: [] } });
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
