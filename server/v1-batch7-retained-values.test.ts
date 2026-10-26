import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { insertKPIProgressSchema } from "../shared/schema";
import { computeAttainmentPct, computeAttainmentFillPct, isLowerIsBetterKpi } from "../shared/kpi-math";
import { formatConversionCredit } from "../shared/metric-math";
import React from "react";
import { renderToString } from "react-dom/server";

const page = "client/src/pages/kpis.tsx";
const comparison = "client/src/pages/platform-comparison.tsx";
const read = (file: string) => process.env.V1_BATCH7_BASELINE
  ? execFileSync("git", ["show", `eacb62fa:${file}`], { encoding: "utf8" }) : readFileSync(file, "utf8");
const parse = (file: string) => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const find = (source: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node[] => {
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { if (predicate(node)) nodes.push(node); ts.forEachChild(node, visit); };
  visit(source); return nodes;
};
const evaluate = (code: string, env: Record<string, any> = {}) => new Function(...Object.keys(env), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(...Object.values(env));
const binding = (file: string, name: string, env: Record<string, any> = {}) => {
  const source = parse(file);
  const node = find(source, n => (ts.isVariableDeclaration(n) && n.name.getText(source) === name) || (ts.isFunctionDeclaration(n) && n.name?.text === name))[0];
  if (!node) throw new Error(`Missing ${name}`);
  return evaluate(ts.isVariableDeclaration(node) ? `return (${node.initializer!.getText(source)});` : `${node.getText(source).replace(/^export /, "")}; return ${name};`, env);
};
const math = { computeAttainmentPct, computeAttainmentFillPct, isLowerIsBetterKpi, formatConversionCredit };

describe("V1-129/130 retained KPI input and scoring", () => {
  it.each([-100, -10.5, 0, 0.75, 300])("accepts finite progress %s without an invisible ID field", value => {
    expect(binding(page, "progressFormSchema", { z, insertKPIProgressSchema }).safeParse({ value, notes: "manual" }).success).toBe(true);
  });
  it.each(["", " ", "bad", Infinity, NaN, null, true, false, {}, [1]])("rejects unavailable/nonfinite progress %s", value => {
    expect(binding(page, "progressFormSchema", { z, insertKPIProgressSchema }).safeParse({ value, kpiId: "existing" }).success).toBe(false);
  });
  it.each([["CPA", 50, 25, 50], ["CPA", 10, 25, 100], ["CAC", 50, 25, 50], ["CAC", 0, 25, 100], ["ROI", -10, 100, 0], ["ROI", 150, 100, 100], ["CTR", 1.25, 2.5, 50]])("scores %s %s/%s as %s", (name, current, target, expected) => {
    expect(binding(page, "calculateProgress", math)(current, target, name)).toBe(expected);
  });
  it.each([null, undefined, "", " ", "bad", "12bad", Infinity])("withholds unavailable current %s", current => {
    expect(binding(page, "calculateProgress", math)(current, 100, "ROI")).toBeNull();
    expect(binding(page, "formatValue", math)(current, "%", "EUR")).toBe("Unavailable");
  });
  it.each([0, -10, "bad", null])("does not invent a progress percentage for target %s", target => {
    expect(binding(page, "calculateProgress", math)(10, target, "ROI")).toBeNull();
  });
  it("preserves signed values, fractional conversions and campaign currency", () => {
    const format = binding(page, "formatValue", math);
    expect(format(-10.5, "%", "EUR")).toBe("-10.5%");
    expect(format(0.75, "count", "EUR")).toBe(formatConversionCredit(0.75));
    expect(format(25, "$", "EUR")).toContain("€");
  });
  it("sends the selected campaign KPI ID and explicit scope only after validation", () => {
    const sent: any[] = [];
    binding(page, "onRecordProgress", { selectedKPI: { id: "k", campaignId: "c" }, campaignId: "c", recordProgressMutation: { mutate: (data: any) => sent.push(data) } })({ value: -10, notes: "loss" });
    expect(sent).toEqual([{ kpiId: "k", progressData: { value: -10, notes: "loss", expectedScope: "campaign", campaignId: "c" } }]);
  });
});

describe("V1-062 comparison measured values and failure boundaries", () => {
  const row = (metrics: any = { spend: 100, revenue: 0, conversions: 5 }) => ({ id: "custom", label: "Custom", category: "custom", connected: true, includedMetrics: Object.keys(metrics), metrics });
  const build = (outcomeTotals: any) => binding(comparison, "buildPlatformMetrics", { outcomeTotals, outcomeTotalsFetched: true, campaign: { currency: "EUR" }, ga4Data: null, linkedInData: null, customIntegrationData: { metrics: { spend: 100, conversions: 5, revenue: 0 } }, metaAnalytics: null })();
  it.each([0, 100, 300, -10])("uses measured revenue %s with positive spend", revenue => {
    const [result] = build({ performanceSummary: { sources: [row({ spend: 100, revenue })] } });
    expect(result.revenue).toBe(revenue);
    expect(result.roas).toBe(revenue / 100);
    expect(result.roi).toBeCloseTo(revenue - 100, 10);
  });
  it.each([null, {}, { platforms: {} }])("does not invent conversions-times-AOV revenue without a canonical result: %j", response => {
    expect(build(response)).toEqual([]);
  });
  it("does not allocate whole-campaign revenue to the GA4 source row", () => {
    const ga4 = { ...row({ revenue: 0, sessions: 10 }), id: "ga4", category: "web_analytics" };
    expect(build({ performanceSummary: { sources: [ga4] }, revenue: { totalRevenue: 999 } })[0].revenue).toBe(0);
  });
  it.each([{ available: false }, { freshness: { stale: true } }, { freshness: { refreshIsStale: true } }, { currency: "USD" }])("excludes explicitly unusable source %j", status => {
    expect(build({ performanceSummary: { sources: [{ ...row(), ...status }] } })).toEqual([]);
  });
  it("never treats an excluded or null metric as a measured zero capability", () => {
    const [result] = build({ performanceSummary: { sources: [{ ...row({ spend: 100, revenue: null }), includedMetrics: ["spend", "revenue"] }] } });
    expect(result.includedMetrics).not.toContain("revenue");
  });
  it("keeps a measured zero channel revenue even when campaign revenue is positive", () => {
    const hasMetric = binding(comparison, "hasMetric");
    const p = { revenue: 0, spend: 100, includedMetrics: ["spend", "revenue"] };
    const env = { hasMetric, canUseSingleSourceFinancialTotals: true, campaignAggregateRevenue: 999, campaignAggregateSpend: 100 };
    const getChannelSpend = binding(comparison, "getChannelSpend", env);
    const getChannelRevenue = binding(comparison, "getChannelRevenue", env);
    expect(getChannelRevenue(p)).toBe(0);
    expect(binding(comparison, "getChannelRoi", { getChannelSpend, getChannelRevenue })(p)).toBe(-100);
  });
  it("preserves fractional conversion credits", () => {
    expect(binding(comparison, "formatNumber", math)(0.75)).toBe(formatConversionCredit(0.75));
  });
  it("throws on a failed aggregate fetch so cached good data is not replaced with null", async () => {
    const source = parse(comparison);
    const declaration = find(source, n => ts.isVariableDeclaration(n) && n.name.getText(source).includes("outcomeTotalsFetched"))[0] as ts.VariableDeclaration;
    const options = evaluate(`return (${declaration.initializer!.getText(source)});`, { campaignId: "c", PLATFORM_COMPARISON_REFRESH_MS: 30000, useQuery: (o: any) => o, fetch: async () => ({ ok: false }) });
    await expect(options.queryFn()).rejects.toThrow("Unable to load");
    expect(read(comparison)).toContain("last successfully loaded values");
  });
});

describe("V1-064 current KPI export contracts", () => {
  const kpis = [{ id: "k", name: 'CPA "quoted", test', unit: "$", currentValue: "50", targetValue: "25", status: "tracking", priority: "high", description: 'First line\nSecond "quoted" line' },
    { id: "loss", name: "ROI", unit: "%", currentValue: "-10", targetValue: "100", status: "tracking", priority: "high" },
    { id: "missing", name: "CTR", unit: "%", currentValue: null, targetValue: "2.5", status: "tracking", priority: "medium" }];
  async function download(kpiReportFormat: string) {
    let blob: Blob | undefined, pdf: any;
    const link = { href: "", download: "", click() {} };
    const calculateProgress = binding(page, "calculateProgress", math), formatValue = binding(page, "formatValue", math);
    await binding(page, "downloadKPIReport", { campaignId: "c", campaign: { name: "Fixture", currency: "EUR" }, kpis,
      kpiReportFormat, kpiReportDateRange: "30d", calculateProgress, formatValue,
      exportCampaignKPIsToPDF: async (data: any) => { pdf = data; },
      format: () => "2026-10-26", Blob, URL: { createObjectURL: (value: Blob) => { blob = value; return "blob:fixture"; }, revokeObjectURL() {} },
      document: { createElement: () => link, body: { appendChild() {}, removeChild() {} } },
    })();
    return { blob, pdf, name: link.download };
  }
  it("CSV escapes embedded quotes/newlines and uses the same scoped units/progress as the cards", async () => {
    const result = await download("csv");
    expect(result.name).toMatch(/\.csv$/); expect(result.blob!.type).toContain("text/csv");
    const text = await result.blob!.text();
    expect(text).toContain('"CPA ""quoted"", test"'); expect(text).toContain('First line\nSecond ""quoted"" line');
    expect(text).toContain("€50.00"); expect(text).toContain('"50.0%"'); expect(text).toContain("Unavailable");
  });
  it("JSON is labeled JSON and preserves signed and unavailable values", async () => {
    const result = await download("json");
    expect(result.name).toMatch(/\.json$/); expect(result.blob!.type).toBe("application/json");
    const data = JSON.parse(await result.blob!.text());
    expect(data.scope).toBe("Current saved KPI values");
    expect(data.kpis[1]).toMatchObject({ currentValue: "-10.0%", progress: "0.0%", savedStatus: "tracking" });
    expect(data.kpis[2].progress).toBe("Unavailable");
    expect(read(page)).toContain('<SelectItem value="json">JSON Data</SelectItem>');
    expect(read(page)).not.toContain("kpiReportDateRange");
  });
  it("PDF delegates to the real PDF helper with correctly formatted source values", async () => {
    const result = await download("pdf"); expect(result.blob).toBeUndefined();
    expect(result.pdf.kpis[0].formattedDetails).toContain("Progress: 50.0%");
    expect(result.pdf.kpis[1].formattedDetails).toContain("Current Value: -10.0%");
    expect(result.pdf.kpis[2].formattedDetails).toContain("Progress: Unavailable");
  });
  it("writes an actual PDF and wraps long KPI names/details across pages", async () => {
    const { jsPDF } = await import("jspdf");
    let saved: Buffer | undefined, filename = "";
    const positions: { page: number; x: number; y: number; width: number }[] = [];
    const CapturingPDF = function () {
      const doc = new jsPDF(); const text = doc.text.bind(doc);
      doc.text = ((value: any, x: number, y: number, ...args: any[]) => {
        positions.push({ page: doc.getCurrentPageInfo().pageNumber, x, y, width: doc.getTextWidth(String(value)) });
        return text(value, x, y, ...args);
      }) as any;
      doc.save = ((name: string) => { filename = name; saved = Buffer.from(doc.output("arraybuffer")); return doc; }) as any;
      return doc;
    };
    const exportPdf = binding("client/src/lib/pdfExport.ts", "exportCampaignKPIsToPDF", { require: () => ({ jsPDF: CapturingPDF }) });
    const result = await download("pdf");
    const longName = "Long campaign name with measured euro revenue ".repeat(6);
    await exportPdf({ ...result.pdf, name: longName, kpis: Array.from({ length: 12 }, (_, i) => ({ ...result.pdf.kpis[i % 3], name: `KPI ${i + 1} ` + "Long descriptive title ".repeat(7),
      formattedDetails: [...result.pdf.kpis[i % 3].formattedDetails, "Long detail ".repeat(45)] })) });
    expect(filename).toMatch(/\.pdf$/); expect(saved!.subarray(0, 5).toString()).toBe("%PDF-");
    expect(Math.max(...positions.map(p => p.page))).toBeGreaterThan(1);
    for (const position of positions) { expect(position.x + position.width).toBeLessThanOrEqual(191); expect(position.y).toBeLessThanOrEqual(288); }
    writeFileSync("docs/fixes/v1-batch-7/validation-2026-10-26/retained-kpi-export.pdf", saved!);
  });
  it("reports a PDF-generation failure instead of showing success", async () => {
    const toasts: any[] = [], closed: any[] = [];
    await binding(page, "generateKPIReport", { downloadKPIReport: async () => { throw Error("fixture failed"); },
      toast: (data: any) => toasts.push(data), setShowKPIReportDialog: (v: any) => closed.push(v), console: { error() {} } })();
    expect(toasts).toEqual([expect.objectContaining({ variant: "destructive" })]); expect(closed).toEqual([]);
  });
});

describe("V1-129 platform form requests", () => {
  it("formats the selected campaign currency and withholds absent/malformed values", () => {
    const format = binding("client/src/pages/platform-kpis.tsx", "formatValue", { selectedCampaign: { currency: "EUR" } });
    expect(format("-10.5", "$" )).toContain("€");
    expect(format("0", "%")).toBe("0%");
    for (const missing of [null, "", " ", "12bad", Infinity]) expect(format(missing, "$" )).toBe("Unavailable");
  });
  const file = "client/src/pages/platform-kpis.tsx";
  const mutation = (name: string, env: any) => binding(file, name, { useMutation: (o: any) => o, queryClient: {}, ...env }).mutationFn;
  it("includes campaignId on create and prevents creation without a selected campaign", async () => {
    const sent: any[] = [];
    const env = { selectedCampaign: { id: "c" }, campaignId: "c", campaignsError: false, platformType: "facebook", fetch: async (url: string, req: any) => { sent.push([url, JSON.parse(req.body)]); return { ok: true, json: async () => ({}) }; } };
    await mutation("createKPIMutation", env)({ name: "ROI", unit: "%", targetValue: "100" });
    expect(sent[0][1].campaignId).toBe("c");
    await expect(mutation("createKPIMutation", { ...env, selectedCampaign: undefined })({})).rejects.toThrow("Select a campaign");
  });
  it.each(["recordProgressMutation", "deleteKPIMutation"])("%s rejects a stale selection from another campaign", async name => {
    const run = mutation(name, { campaignId: "c", selectedCampaign: { id: "c" }, kpis: [{ id: "k", campaignId: "other" }], fetch: () => { throw Error("must not fetch"); } });
    await expect(run(name === "deleteKPIMutation" ? "k" : { kpiId: "k", progressData: { value: "0" } })).rejects.toThrow("outside the selected campaign");
  });
});

describe("V1-061 explicit nonoperational Audiences demo", () => {
  it("renders the demo notice and disables all create/edit/delete buttons", () => {
    const code = ts.transpileModule(read("client/src/pages/audiences.tsx"), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports: any = {};
    const require = (name: string) => name === "react" ? React : new Proxy({}, { get: (_target, component) => ({ children, disabled, role, "aria-label": label }: any) => React.createElement(component === "Button" ? "button" : "div", { disabled, role, "aria-label": label }, children) });
    new Function("exports", "require", "React", code)(exports, require, React);
    const html = renderToString(React.createElement(exports.default));
    expect(html).toContain("Example data only. These are not your audiences.");
    const actions = html.match(/<button[^>]*>.*?<\/button>/gs)!.filter(button => /Create Audience|Edit audience|Delete audience/.test(button));
    expect(actions.length).toBeGreaterThanOrEqual(10);
    for (const button of actions) expect(button).toContain('disabled=""');
  });
});
