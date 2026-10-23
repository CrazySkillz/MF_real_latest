import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import * as metrics from "./utils/google-sheets-aggregate-source";
import * as ranges from "./utils/google-sheets-revenue-ranges";
import { filterGoogleSheetsRows } from "./utils/googleSheetsSelection";
import { fixture } from "./v1-batch4-standalone-sheets-scope.test";

const mapping = [{ targetFieldId: "campaign_name", sourceColumnIndex: 0, sourceColumnName: "Campaign", selectedValues: ["A"] }];
const headers = ["Campaign", "Date", "Spend", "Clicks", "CPC", "Impressions", "CTR", "Revenue", "ROAS", "Campaign ID"];
const rows = [["A", "2026-10-01", 100, 100, 1, 1000, "10%", 0, 0, 123], ["A", "2026-10-01", 90, 10, 9, 10, "100%", 0, 0, 456], ["B", "2020-01-01", 900, 900, 1, 1000, 90, 100, 1, 789]];
const scope = { platform: "google_sheets", activeSpreadsheetId: "book:conn", connectionId: "conn", spreadsheetId: "book", sheetName: "Main" };
function connection(overrides: any = {}) {
  return { id: "conn", campaignId: "a", spreadsheetId: "book", sheetName: "Main", isActive: true, purpose: "general", columnMappings: JSON.stringify(mapping),
    cachedData: { complete: true, spreadsheetId: "book", sheetName: "Main", headers, rows, totalRows: rows.length }, lastDataRefreshAt: new Date(), ...overrides };
}
function loadFunctions(file: string, names: string[], dependencies: any, declarations: string[] = []) {
  const ast = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  const extracted = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) extracted.set(node.name.text, node.getText(ast).replace(/^export /, ""));
    if (ts.isVariableDeclaration(node) && [...names, ...declarations].includes(node.name.getText(ast))) extracted.set(node.name.getText(ast), `const ${node.getText(ast)};`);
    ts.forEachChild(node, visit);
  }; visit(ast);
  for (const name of [...names, ...declarations]) if (!extracted.has(name)) throw new Error(`Missing actual implementation: ${name}`);
  const code = ts.transpileModule([...extracted.values(), `return { ${names.join(",")} };`].join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const { require: moduleLoader, ...bindings } = dependencies;
  return new Function("require", ...Object.keys(bindings), code)(moduleLoader || createRequire(import.meta.url), ...Object.values(bindings));
}
function reports(conn = connection(), storageOverrides: any = {}) {
  const storage = { getCampaign: vi.fn(async () => ({ id: "a", name: "App A", platform: "Google Sheets", currency: "USD" })), getGoogleSheetsConnections: vi.fn(async () => [conn]),
    getRevenueSources: vi.fn(async () => [{ id: "revenue", isActive: true }]), getSpendSources: vi.fn(async () => [{ id: "spend", isActive: true }]),
    getRevenueTotalForRange: vi.fn(async () => ({ totalRevenue: 0, sourceIds: ["revenue"], currency: "USD" })),
    getSpendTotalForRange: vi.fn(async () => ({ totalSpend: 190, sourceIds: ["spend"], currency: "USD" })),
    getPlatformKPIs: vi.fn(async () => [{ id: "k", metric: "CPC", targetValue: 2, calculationConfig: JSON.stringify({ sourceScope: scope }) }]),
    getPlatformBenchmarks: vi.fn(async () => [{ id: "b", metric: "CPC", benchmarkValue: 2, calculationConfig: JSON.stringify({ sourceScope: scope }) }]), ...storageOverrides };
  const functions = loadFunctions("./report-scheduler.ts", ["buildPdfAttachmentForReport", "platformRequiresSourceBackedReportOutput", "googleSheetsConnectionMatchesSavedScope", "buildGoogleSheetsCachedMetricSummary", "formatGoogleSheetsReportValue", "buildGoogleSheetsConfirmedFinancialMetricSummary", "buildGoogleSheetsScheduledPdfAttachment", "getGoogleSheetsReportSourceScope", "isGoogleSheetsConfirmedFinancialMetric"], {
    ...metrics, ...ranges, filterGoogleSheetsRows, storage,
    parseReportConfiguration: (value: any) => typeof value === "string" ? JSON.parse(value) : value || {},
    coercePdfBufferFromDoc: (doc: any) => Buffer.from(doc.output("arraybuffer")),
  }, ["GOOGLE_SHEETS_REPORT_CURRENCY_PATTERN", "parseGoogleSheetsReportNumber", "normalizeGoogleSheetsReportKey"]);
  return { ...functions, storage };
}

describe("V1-112/114 actual endpoint and downstream calculations", () => {
  it("derives CPC and weighted CTR from the selected rows, including zero revenue", async () => {
    const f = fixture(true, { headers, rows, mappings: mapping });
    const result = await f.invoke();
    expect(result.statusCode, JSON.stringify(result.body)).toBe(200);
    const columns = new Map(result.body.summary.detectedColumns.map((c: any) => [c.name, c.summaryValue]));
    expect(columns.get("CPC")).toBeCloseTo(190 / 110);
    expect(columns.get("CTR")).toBeCloseTo(110 / 1010 * 100);
    expect(columns.get("ROAS")).toBe(0);
    expect(columns.has("Campaign ID")).toBe(false);
    expect(result.body.insights.trendSeries[0].CPC).toBeCloseTo(190 / 110);
    expect(result.body.insights.trendSeries[0].Spend).toBe(190);
  });
  it.each([false, true])("does not use Budget as Spend regardless of order (%s)", reverse => {
    const hs = reverse ? ["Spend", "Budget", "Revenue", "ROAS"] : ["Budget", "Spend", "Revenue", "ROAS"];
    const values = reverse ? [100, 1000, 200, 2] : [1000, 100, 200, 2];
    expect(metrics.buildGoogleSheetsMetricSummary(hs, [values]).detectedColumns.find(c => c.name === "ROAS")?.summaryValue).toBe(2);
  });
  it("keeps full ratio names in ratio/percentage units instead of currency", () => {
    const summary = metrics.buildGoogleSheetsMetricSummary(["Revenue", "Spend", "Return on Ad Spend", "Return on Investment"], [[200, 100, 2, 100]]);
    expect(summary.detectedColumns.slice(2).map(c => [c.summaryValue, c.type])).toEqual([[2, "decimal"], [100, "decimal"]]);
    expect(reports().formatGoogleSheetsReportValue(2, "Return on Ad Spend", "decimal")).toBe("2.00x");
    expect(reports().formatGoogleSheetsReportValue(100, "Return on Investment", "decimal")).toBe("100%");
  });
  it("requires an exact mapping when two spend columns compete", () => {
    const hs = ["Cost", "Spend", "Revenue", "ROAS"], rs = [[50, 100, 200, 99]];
    expect(metrics.buildGoogleSheetsMetricSummary(hs, rs).detectedColumns.at(-1)?.summaryValue).toBeNull();
    expect(metrics.buildGoogleSheetsMetricSummary(hs, rs, [{ targetFieldId: "spend", sourceColumnIndex: 1, sourceColumnName: "Spend" }]).detectedColumns.at(-1)?.summaryValue).toBe(2);
  });
  it.each([["Revenue", "Spend", "ROI"], ["Spend", "Clicks", "CPC"], ["Clicks", "Impressions", "CTR"]])("keeps zero denominators unavailable: %j", (...hs) => {
    expect(metrics.buildGoogleSheetsMetricSummary(hs, [[0, 0, 99]]).detectedColumns.at(-1)?.summaryValue).toBeNull();
  });
  it("keeps measured zero columns, late numeric columns and losses", () => {
    const summary = metrics.buildGoogleSheetsMetricSummary(["Revenue", "Spend", "ROI"], [[0, 100, 99]]);
    expect(summary.detectedColumns.map(c => c.summaryValue)).toEqual([0, 100, -100]);
    expect(metrics.buildGoogleSheetsMetricSummary(["Metric"], [...Array.from({ length: 7 }, () => [""]), [5]]).detectedColumns[0].summaryValue).toBe(5);
  });
  it("preserves mapped per-conversion median/latest semantics including measured zero", () => {
    const hs = ["Date", "Value"], rs = [["2026-10-01", 100], ["2026-10-02", 0]];
    const map = { targetFieldId: "conversion_value", sourceColumnIndex: 1, sourceColumnName: "Value", valueSemantic: "value_per_conversion", dateColumnIndex: 0, dateColumnName: "Date" };
    expect(metrics.buildGoogleSheetsMetricSummary(hs, rs, [map]).detectedColumns[0].summaryValue).toBe(50);
    expect(metrics.buildGoogleSheetsMetricSummary(hs, rs, [{ ...map, dateStrategy: "latest" }]).detectedColumns[0].summaryValue).toBe(0);
    expect(metrics.buildGoogleSheetsMetricSummary(hs, [["2026-02-30", 0]], [{ ...map, dateStrategy: "latest" }]).detectedColumns[0].summaryValue).toBeNull();
    expect(metrics.buildGoogleSheetsMetricSummary(hs, [["2026-10-01", -1]], [map]).detectedColumns[0].summaryValue).toBeNull();
  });
  it.each(["1oops", "1.2.3", "NaN", "Infinity", "1,23", "\u20ac10"])("does not publish a partial numeric column for %s", invalid => {
    expect(metrics.buildGoogleSheetsMetricSummary(["Spend"], [[100], [invalid]]).detectedColumns[0].summaryValue).toBeNull();
  });
  it("rejects duplicate headers and invalid mappings", () => {
    expect(() => metrics.buildGoogleSheetsMetricSummary(["Spend", "spend"], [[1, 2]])).toThrow();
    expect(() => metrics.buildGoogleSheetsMetricSummary(["Spend"], [[1]], [{ targetFieldId: "spend", sourceColumnIndex: 3 }])).toThrow();
  });
  it("uses summaryValue including null in real browser metric options", () => {
    const ui = loadFunctions("../client/src/pages/google-sheets-data.tsx", ["buildGoogleSheetsMetricOptions", "parseSheetMetricNumber"], { useCallback: (fn: any) => fn }, ["GOOGLE_SHEETS_KPI_DATE_COLUMN_PATTERN", "GOOGLE_SHEETS_KPI_CURRENCY_COLUMN_PATTERN"]);
    const summary = metrics.buildGoogleSheetsMetricSummary(headers, rows.slice(0, 2));
    const options = ui.buildGoogleSheetsMetricOptions({ summary });
    expect(options.find((o: any) => o.key === "CPC").currentValue).toBeCloseTo(190 / 110);
    const unavailable = ui.buildGoogleSheetsMetricOptions({ summary: metrics.buildGoogleSheetsMetricSummary(["CTR"], [[1], [100]]) });
    expect(unavailable[0]).toMatchObject({ available: false, currentValue: null });
  });
  it.each(["overview", "kpis", "benchmarks", "custom"])("keeps CPC accurate in the actual browser %s PDF builder", async reportType => {
    let artifact: Buffer | undefined;
    const require = createRequire(import.meta.url);
    const data = { summary: metrics.buildGoogleSheetsMetricSummary(headers, rows.slice(0, 2)), filteredRows: 2 };
    const ui = loadFunctions("../client/src/pages/google-sheets-data.tsx", ["buildGoogleSheetsMetricOptions", "parseSheetMetricNumber"], { useCallback: (fn: any) => fn }, ["GOOGLE_SHEETS_KPI_DATE_COLUMN_PATTERN", "GOOGLE_SHEETS_KPI_CURRENCY_COLUMN_PATTERN"]);
    const options = ui.buildGoogleSheetsMetricOptions(data);
    const item = { id: "goal", name: "CPC", metric: "CPC", targetValue: 2, benchmarkValue: 2 };
    const report = loadFunctions("../client/src/pages/google-sheets-data.tsx", ["downloadGoogleSheetsReport"], {
      require: (name: string) => name === "jspdf" ? { jsPDF: function () { const doc = new (require("jspdf").jsPDF)(); doc.save = () => { artifact = Buffer.from(doc.output("arraybuffer")); }; return doc; } } : require(name),
      parseSheetMetricNumber: ui.parseSheetMetricNumber, parseGoogleSheetsReportConfiguration: (v: any) => v,
      getGoogleSheetsMetricOptionsForSavedScope: () => ({ scope, options }), customReportConfig: {}, reportForm: { name: "Fixture" },
      activeSpreadsheetId: "different-tab", sheetsData: { filteredRows: 999 }, savedGoogleSheetsSourceQueries: [{ data }], savedGoogleSheetsSourceValues: [scope.activeSpreadsheetId],
      visibleGoogleSheetsKpisData: [item], visibleGoogleSheetsBenchmarksData: [item],
      resolveGoogleSheetsKpiMetric: () => ({ currentValue: options.find((o: any) => o.key === "CPC").currentValue, option: options.find((o: any) => o.key === "CPC") }),
      resolveGoogleSheetsBenchmarkMetric: () => ({ currentValue: options.find((o: any) => o.key === "CPC").currentValue, option: options.find((o: any) => o.key === "CPC") }),
      activeGoogleSheetsSourceScope: scope,
    });
    await report.downloadGoogleSheetsReport({ reportType, configuration: { sourceScope: scope, selectedMetrics: ["CPC"], kpis: ["goal"], benchmarks: ["goal"] } });
    expect(artifact).toBeDefined();
    const text = artifact!.toString("latin1"); expect(text).toContain("$1.73"); expect(text).not.toContain("$10.00"); expect(text).toContain("Rows: 2"); expect(text).not.toContain("Rows: 999");
  });
  it("keeps the last supported row in totals and handles five concurrent local tester reads", async () => {
    const largeRows = Array.from({ length: 49_999 }, (_, i) => ["Alpha", i === 49_998 ? 10 : 1]);
    const full = fixture(true, { headers: ["Campaign Name", "Revenue"], rows: largeRows });
    const result = await full.invoke(); expect(result.body.filteredRows).toBe(49_999); expect(result.body.summary.metrics.Revenue).toBe(50_008);
    const concurrent = await Promise.all(Array.from({ length: 5 }, () => fixture(true, { headers: ["Campaign Name", "Revenue"], rows: largeRows.slice(0, 2000) }).invoke()));
    expect(concurrent.map(r => r.body.summary.metrics.Revenue)).toEqual([2000, 2000, 2000, 2000, 2000]);
  }, 30_000);
});

describe("V1-108/113 actual scheduled report builder", () => {
  it("returns no artifact through the real PDF wrapper when source coverage cannot be proved", async () => {
    const c = connection(); delete c.cachedData.complete; const f = reports(c);
    expect(await f.buildPdfAttachmentForReport({ report: { campaignId: "a", platformType: "google_sheets", reportType: "overview", configuration: { sourceScope: scope } }, windowStart: "2026-10-01", windowEnd: "2026-10-31", campaignName: "App A" })).toBeNull();
    expect(f.platformRequiresSourceBackedReportOutput("google_sheets")).toBe(true);
  });
  it("does not label a missing source's contribution as measured zero", async () => {
    const f = reports(connection(), { getRevenueSources: async () => [{ id: "revenue" }, { id: "missing-records" }] });
    const result = await f.buildGoogleSheetsConfirmedFinancialMetricSummary("a", "2026-10-01", "2026-10-31");
    expect(result.has("overview.total_revenue")).toBe(false); expect(result.has("overview.roas")).toBe(false);
  });
  it("filters saved campaign and dates before ratios, excludes numeric identifiers", () => {
    const f = reports(); const result = f.buildGoogleSheetsCachedMetricSummary([connection()], scope, "App A", { start: "2026-10-01", end: "2026-10-31" });
    expect(result.rowCount).toBe(2); expect(result.metrics.get("spend").total).toBe(190);
    expect(result.metrics.get("cpc").total).toBeCloseTo(190 / 110); expect(result.metrics.has("campaign id")).toBe(false);
  });
  it.each(["overview", "kpis", "benchmarks", "custom", "insights"])("renders correct actual %s PDF values", async reportType => {
    const f = reports();
    const buffer = await f.buildGoogleSheetsScheduledPdfAttachment({ report: { campaignId: "a", platformType: "google_sheets", reportType, configuration: { sourceScope: scope, selectedMetrics: ["CPC"], sections: { overview: true, kpis: true, benchmarks: true } } }, windowStart: "2026-10-01", windowEnd: "2026-10-31", campaignName: "App A" });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    const text = buffer.toString("latin1");
    expect(text).toContain("$1.73"); expect(text).not.toContain("$10.00"); expect(text).not.toContain("Campaign ID:");
  });
  it("preserves measured zero and loss in dated financial metrics", async () => {
    const f = reports(); const result = await f.buildGoogleSheetsConfirmedFinancialMetricSummary("a", "2026-10-01", "2026-10-31");
    expect(result.get("overview.total_revenue").total).toBe(0); expect(result.get("overview.roas").total).toBe(0); expect(result.get("overview.roi").total).toBe(-100);
    expect(f.storage.getRevenueTotalForRange).toHaveBeenCalledWith("a", "2026-10-01", "2026-10-31", "google_sheets");
    expect(f.storage.getSpendTotalForRange).toHaveBeenCalledWith("a", "2026-10-01", "2026-10-31", "google_sheets");
  });
  it("does not turn storage failure into measured zero", async () => {
    const f = reports(connection(), { getRevenueTotalForRange: async () => { throw new Error("fixture DB failure"); } });
    await expect(f.buildGoogleSheetsConfirmedFinancialMetricSummary("a", "2026-10-01", "2026-10-31")).rejects.toThrow("fixture DB failure");
  });
  it.each(["old", "stale", "renamed", "inactive", "child", "foreign", "ambiguous"])("rejects %s saved cache/source", reason => {
    const c = connection(); const list = [c];
    if (reason === "old") delete c.cachedData.complete;
    if (reason === "stale") c.lastDataRefreshAt = new Date(Date.now() - 26 * 3600000);
    if (reason === "renamed") c.sheetName = "Changed";
    if (reason === "inactive") c.isActive = false;
    if (reason === "child") c.purpose = "spend";
    if (reason === "foreign") c.spreadsheetId = "other";
    if (reason === "ambiguous") list.push({ ...c });
    expect(() => reports().buildGoogleSheetsCachedMetricSummary(list, scope, "App A", { start: "2026-10-01", end: "2026-10-31" })).toThrow();
  });
  it.each(["07/08/2026", "2026-02-30", "", 45000])("rejects ambiguous/missing/invalid report date %s", date => {
    const c = connection(); c.cachedData.rows = [["A", date, 10]]; c.cachedData.totalRows = 1;
    expect(() => reports().buildGoogleSheetsCachedMetricSummary([c], scope, "App A", { start: "2026-10-01", end: "2026-10-31" })).toThrow();
  });
  it("does not substitute an unrelated source for mismatched saved identity", () => {
    expect(reports().googleSheetsConnectionMatchesSavedScope(connection(), { ...scope, activeSpreadsheetId: "other:conn" })).toBe(false);
  });
  it("keeps no-match empty and resolves changed saved selection without modifying cache", () => {
    const c = connection(); c.columnMappings = JSON.stringify([{ ...mapping[0], selectedValues: ["Missing"] }]);
    expect(reports().buildGoogleSheetsCachedMetricSummary([c], scope, "App A", { start: "2026-10-01", end: "2026-10-31" }).metrics.size).toBe(0);
    c.columnMappings = JSON.stringify([{ ...mapping[0], selectedValues: ["B"] }]);
    expect(reports().buildGoogleSheetsCachedMetricSummary([c], scope, "App A", { start: "2020-01-01", end: "2020-01-01" }).metrics.get("spend").total).toBe(900);
    expect(c.cachedData.rows).toEqual(rows);
  });
});
