import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import * as transformation from "./utils/data-transformation";
import { enrichRows } from "./utils/data-enrichment";
import { toCanonicalFormatBatch } from "./utils/canonical-format";

import * as sheetMetrics from "./utils/google-sheets-aggregate-source";
import * as sheetRanges from "./utils/google-sheets-revenue-ranges";

// Execute the registered handler and current helpers; isolate storage and Google only.
const ast = ts.createSourceFile("routes.ts", readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
function extract(predicate: (node: ts.Node) => boolean) {
  let result = "";
  function visit(node: ts.Node) {
    if (!result && predicate(node)) result = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!result) throw new Error("Current Sheets implementation not found");
  return result;
}
const declarations = ["normalizeGoogleSheetsSummaryHeader", "isGoogleSheetsSummaryIdentifierColumn", "isGoogleSheetsSummaryBreakdownIdentifierColumn", "isGoogleSheetsSummaryCampaignBreakdownColumn"]
  .map(name => `const ${extract(n => ts.isVariableDeclaration(n) && n.name.getText(ast) === name)};`);
const functions = ["getPlatformKeywords", "matchesPlatform", "generateInsights"].map(name =>
  extract(n => ts.isFunctionDeclaration(n) && n.name?.text === name));
const route = extract(n => ts.isCallExpression(n) && n.expression.getText(ast) === "app.get"
  && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === "/api/campaigns/:id/google-sheets-data");
const code = ts.transpileModule([...declarations, ...functions, "generateInsights = observeInsights(generateInsights);", route].join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const headers = ["Campaign Name", "Revenue", "Conversions"];
const rows = [["Alpha", "10", "2"], ["Alpha extra", "900", "3"], ["Beta", "90", "1"]];
const mapping = (values: string[] = ["Alpha"], extra = {}) => ({ targetFieldId: "campaign_name", sourceColumnIndex: 0, sourceColumnName: "Campaign Name", selectedValues: values, ...extra });

export function fixture(cached = true, options: any = {}) {
  const values = [options.headers || headers, ...(options.rows || rows)];
  const primary: any = { id: "tab-a", campaignId: "a", spreadsheetId: "book", sheetName: "Main", spreadsheetName: "Fixture",
    isActive: true, isPrimary: true, purpose: "general", accessToken: "fixture-only",
    lastDataRefreshAt: new Date(), cachedData: cached ? { headers: values[0], rows: values.slice(1), complete: true, spreadsheetId: "book", sheetName: "Main", totalRows: values.length - 1 } : null,
    columnMappings: options.mappings === undefined ? null : typeof options.mappings === "string" ? options.mappings : JSON.stringify(options.mappings) };
  const connections = options.connections || [primary];
  const fetch = vi.fn(async (url: any) => new Response(JSON.stringify(String(url).includes('/values/') ? { values: options.liveValues || values }
    : { sheets: [{ properties: { title: primary.sheetName, gridProperties: { rowCount: values.length, columnCount: values[0].length } } }] }), { status: 200 }));
  const updateCampaign = vi.fn(async () => ({}));
  const updateGoogleSheetsConnection = vi.fn();
  const storage = { getCampaign: vi.fn(async () => ({ id: "a", name: options.name || "Alpha", platform: options.platform || "Google Sheets" })),
    getGoogleSheetsConnections: vi.fn(async () => connections), getLinkedInConnection: vi.fn(async () => null),
    getMetaConnection: vi.fn(async () => options.meta ? { id: "meta" } : null), getGA4Connections: vi.fn(async () => []),
    getGoogleAdsConnection: vi.fn(async () => options.ads ? { id: "ads" } : null), updateCampaign, updateGoogleSheetsConnection };
  const transformData = vi.fn(transformation.transformData);
  let insights: any, handler: any, middleware: any[] = [];
  const auth = vi.fn(), rate = vi.fn();
  const dependencies: any = { ...sheetMetrics, ...sheetRanges, ...transformation, transformData, enrichRows, toCanonicalFormatBatch, storage, fetch,
    googleSheetsRateLimiter: rate, requireCampaignAccessParamId: auth,
    app: { get: (_path: string, ...handlers: any[]) => { handler = handlers.at(-1); middleware = handlers.slice(0, -1); } },
    observeInsights: (fn: any) => { insights = vi.fn(fn); return insights; }, devLog: () => {},
    toA1SheetPrefix: (name: string) => `'${name.replace(/'/g, "''")}'!`,
    refreshGoogleSheetsToken: vi.fn(async () => "refreshed-fixture-token"),
  };
  new Function(...Object.keys(dependencies), code)(...Object.values(dependencies));
  async function invoke(spreadsheetId: any = "book:tab-a", extra: any = {}) {
    const res: any = { statusCode: 200, status(n: number) { this.statusCode = n; return this; }, json(body: any) { this.body = body; return this; } };
    await handler({ params: { id: "a" }, query: { ...(spreadsheetId === null ? {} : { spreadsheetId }), ...extra } }, res);
    return res;
  }
  return { invoke, primary, connections, storage, fetch, insights, transformData, middleware, auth, rate };
}

describe.each([true, false])("V1-051 standalone Sheets selection (cached=%s)", cached => {
  it.each(["book:missing", "missing:tab-a", "missing"])("does not substitute another dataset for %s", async selection => {
    const f = fixture(cached);
    expect((await f.invoke(selection)).statusCode).toBe(404);
    expect(f.fetch).not.toHaveBeenCalled(); expect(f.insights).not.toHaveBeenCalled();
    expect(f.storage.updateCampaign).not.toHaveBeenCalled();
  });
  it("rejects ambiguous legacy spreadsheet-only selection but keeps the default primary", async () => {
    const f = fixture(cached); f.connections.push({ ...f.primary, id: "tab-b", sheetName: "Second", isPrimary: false });
    expect((await f.invoke("book")).statusCode).toBe(400);
    expect((await f.invoke(null)).body.sheetName).toBe("Main");
  });
  it.each(["book:tab-a", "book:Main", "book"])("keeps exact supported selection %s and exact campaign rows", async selection => {
    const f = fixture(cached); const result = await f.invoke(selection);
    expect(result.statusCode, result.body.message).toBe(200);
    expect(result.body.data).toEqual([rows[0]]);
    expect(result.body.summary.metrics.Revenue).toBe(10);
    expect(f.insights).toHaveBeenCalledWith([headers, rows[0]], expect.any(Array), expect.objectContaining({ Revenue: 10 }), expect.any(Array), headers, f.primary.columnMappings);
    expect(f.middleware).toEqual([f.rate, f.auth]);
  });
  it("keeps an unmatched campaign empty and does not overwrite its saved conversion value", async () => {
    const f = fixture(cached, { name: "Missing", ads: true }); const result = await f.invoke();
    expect(result.body.data).toEqual([]); expect(result.body.filteredRows).toBe(0);
    expect(result.body.summary.metrics).toEqual({}); expect(result.body.calculatedConversionValues).toEqual([]);
    expect(f.storage.updateCampaign).not.toHaveBeenCalled();
  });
  it("preserves explicit multiple selected values even when the app campaign label differs", async () => {
    const f = fixture(cached, { name: "App label", mappings: [mapping([" alpha ", "BETA", "Alpha"])] });
    const result = await f.invoke();
    expect(result.body.data).toEqual([rows[0], rows[2]]); expect(result.body.summary.metrics.Revenue).toBe(100);
    expect(f.transformData.mock.calls[0][0]).toEqual([headers, rows[0], rows[2]]);
  });
  it("does not drop explicitly selected rows based on unrelated connected platforms", async () => {
    const f = fixture(cached, { headers: [...headers, "Platform"], rows: rows.map(r => [...r, "Google Ads"]), meta: true, mappings: [mapping()] });
    expect((await f.invoke()).body.summary.metrics.Revenue).toBe(10);
  });
  it("does not broaden a platform-only no-match", async () => {
    const f = fixture(cached, { headers: ["Platform", "Revenue"], rows: [["Unrelated", "999"]] });
    expect((await f.invoke()).body.data).toEqual([]);
  });
  it("keeps a legacy entire-tab dataset with no campaign or platform column", async () => {
    const f = fixture(cached, { headers: ["Revenue"], rows: [["10"], ["90"]] });
    expect((await f.invoke()).body.summary.metrics.Revenue).toBe(100);
  });
  it.each(["bad-json", "{}", [{ ...mapping(), sourceColumnIndex: 20 }], [{ ...mapping(), sourceColumnName: "Removed column" }]].map(value => [value]))("rejects broken saved selection before deriving values: %j", async mappings => {
    const f = fixture(cached, { mappings }); expect((await f.invoke()).statusCode).toBe(400);
    expect(f.insights).not.toHaveBeenCalled(); expect(f.transformData).not.toHaveBeenCalled();
    expect(f.storage.updateCampaign).not.toHaveBeenCalled(); expect(f.storage.updateGoogleSheetsConnection).not.toHaveBeenCalled();
  });
  it("keeps selected campaign-name values paired with their column when an unselected ID mapping exists", async () => {
    const f = fixture(cached, { headers: ["Campaign ID", ...headers], rows: rows.map((r, i) => [String(i), ...r]),
      mappings: [{ targetFieldId: "campaign_id", sourceColumnIndex: 0, sourceColumnName: "Campaign ID" }, mapping(["Alpha"], { sourceColumnIndex: 1 })] });
    expect((await f.invoke()).body.summary.metrics.Revenue).toBe(10);
  });
  it("uses the same selected rows for conversion-value side effects", async () => {
    const f = fixture(cached, { ads: true, mappings: [mapping()] }); const result = await f.invoke();
    expect(result.body.summary.metrics.Revenue).toBe(10);
    expect(f.storage.updateCampaign).toHaveBeenCalledWith("a", { conversionValue: "5.00" });
    expect(f.transformData.mock.calls[0][0]).toEqual([headers, rows[0]]);
  });
  it("keeps a selected numeric zero identifier distinct from an empty cell", async () => {
    const f = fixture(cached, { headers: ["Campaign ID", "Revenue"], rows: [[0, "10"], ["", "999"], [1, "90"]],
      mappings: [mapping(["0"], { targetFieldId: "campaign_id", sourceColumnName: "Campaign ID" })] });
    expect((await f.invoke()).body.summary.metrics.Revenue).toBe(10);
  });
  it("rejects duplicate mapped campaign headers", async () => {
    const f = fixture(cached, { headers: ["Campaign Name", "Campaign Name", "Revenue"], rows: [["Alpha", "Beta", "900"]], mappings: [mapping()] });
    expect((await f.invoke()).statusCode).toBe(400);
    expect(f.insights).not.toHaveBeenCalled();
  });
  it("preserves a selected no-match as empty even with multiple connected platforms", async () => {
    const f = fixture(cached, { mappings: [mapping(["Missing"])], ads: true, meta: true });
    expect((await f.invoke()).body.data).toEqual([]); expect(f.storage.updateCampaign).not.toHaveBeenCalled();
  });
});

describe("standalone Sheets connection lifecycle boundaries", () => {
  it.each([{ isActive: false }, { purpose: "revenue" }, { purpose: "spend" }, { spreadsheetId: "pending" }])("rejects unavailable/child selection: %j", async overrides => {
    const f = fixture(); Object.assign(f.primary, overrides);
    expect((await f.invoke()).statusCode).toBe(404); expect(f.fetch).not.toHaveBeenCalled();
  });
  it("does not reuse a removed connection after reconnect, but accepts the new ID", async () => {
    const f = fixture(); f.primary.id = "new-id";
    expect((await f.invoke()).statusCode).toBe(404);
    expect((await f.invoke("book:new-id")).body.summary.metrics.Revenue).toBe(10);
  });
  it("reads changed campaign selection on the next cached read without altering cached rows", async () => {
    const f = fixture(true, { mappings: [mapping()] }); const original = structuredClone(f.primary.cachedData);
    expect((await f.invoke()).body.summary.metrics.Revenue).toBe(10);
    f.primary.columnMappings = JSON.stringify([mapping(["Beta"])]);
    expect((await f.invoke()).body.summary.metrics.Revenue).toBe(90);
    expect(f.primary.cachedData).toEqual(original); expect(f.fetch).not.toHaveBeenCalled();
  });
  it("keeps scoped ownership lookup and empty default behavior", async () => {
    const f = fixture(true, { connections: [] }); const result = await f.invoke(null);
    expect(result.statusCode).toBe(200); expect(result.body.data).toEqual([]);
    expect(f.storage.getGoogleSheetsConnections).toHaveBeenCalledWith("a");
    expect((await f.invoke("other-owner:tab")).statusCode).toBe(404);
  });
  it("rejects a composite tab-name/connection-ID collision", async () => {
    const f = fixture(); f.connections.push({ ...f.primary, id: "tab-b", sheetName: "tab-a" });
    expect((await f.invoke()).statusCode).toBe(400); expect(f.fetch).not.toHaveBeenCalled();
  });
  it("accepts a colon in the exact tab name", async () => {
    const f = fixture(); f.primary.sheetName = "Main:2026";
    expect((await f.invoke("book:Main:2026")).body.sheetName).toBe("Main:2026");
  });
  it("rejects repeated query selectors before provider work", async () => {
    const f = fixture(); expect((await f.invoke(["book:tab-a", "other:tab-b"])).statusCode).toBe(400);
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("uses the same selection after forced refresh instead of old cached rows", async () => {
    const f = fixture(true, { mappings: [mapping()], liveValues: [headers, ["Alpha", "20", "2"], rows[2]] });
    const original = structuredClone(f.primary.cachedData);
    expect((await f.invoke("book:tab-a", { forceRefresh: "true" })).body.summary.metrics.Revenue).toBe(20);
    expect(decodeURIComponent(String(f.fetch.mock.calls[1][0]))).toContain("'Main'!1:4");
    expect(f.primary.cachedData).toEqual(original);
  });
  it.each([403, 404, 429, 500])("keeps provider failure %s from becoming replacement data", async status => {
    const f = fixture(false); f.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Fixture failure" } }), { status }));
    expect((await f.invoke()).statusCode).toBeGreaterThanOrEqual(400);
    expect(f.storage.updateCampaign).not.toHaveBeenCalled(); expect(f.storage.updateGoogleSheetsConnection).not.toHaveBeenCalled();
    expect(f.insights).not.toHaveBeenCalled();
  });
});
