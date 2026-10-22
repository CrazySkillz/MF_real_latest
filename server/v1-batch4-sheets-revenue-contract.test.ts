import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import ts from "typescript";
import { z } from "zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableColumns, getTableName, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";
import * as csv from "./utils/csv";
import * as amount from "./utils/google-sheets-revenue-amount";
import * as ranges from "./utils/google-sheets-revenue-ranges";
import * as preview from "./utils/google-sheets-revenue-preview";

const routes = ts.createSourceFile("routes.ts", readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const scheduler = ts.createSourceFile("scheduler.ts", readFileSync(new URL("./auto-refresh-scheduler.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const date = "2026-10-21";
function extract(ast: ts.SourceFile, predicate: (node: ts.Node) => boolean): string {
  let result = "";
  function visit(node: ts.Node) {
    if (!result && predicate(node)) result = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!result) throw new Error("Missing current implementation node");
  return result;
}
const declaration = (name: string) => `const ${extract(routes, node => ts.isVariableDeclaration(node) && node.name.getText(routes) === name)};`;
const setup = ["zValueSource", "zSheetsRevenuePlatformContext", "zRevenueMapping", "readGoogleSheetsRevenueChunks"].map(declaration).join("\n");
const routeCode = (action: string) => extract(routes, node => ts.isCallExpression(node)
  && node.expression.getText(routes) === "app.post" && ts.isStringLiteral(node.arguments[0])
  && node.arguments[0].text === `/api/campaigns/:id/revenue/sheets/${action}`);
const refreshCode = extract(scheduler, node => ts.isFunctionDeclaration(node) && node.name?.text === "reprocessGoogleSheetsRevenue");
const parseNumCode = `const ${extract(routes, node => ts.isVariableDeclaration(node) && node.name.getText(routes) === "parseNum" && node.getText(routes).includes('String(val).replace'))};`;

// Run current registered handlers, chunk reader and scheduler body; only provider/auth/storage are fixtures.
// No application bootstrap, credentials, database, timer or real provider is loaded.
function fixture(values: unknown[][], currency = "EUR", persist?: (...args: any[]) => Promise<any>) {
  let data = values;
  const campaign = { id: "a", currency, reportingTimeZone: "Europe/Amsterdam" };
  const conn = { id: "connection-a", campaignId: "a", spreadsheetId: "fixture", spreadsheetName: "Revenue", sheetName: "Revenue", accessToken: "fixture-token" };
  const saved: any = { id: "source-a", campaignId: "a", sourceType: "google_sheets", platformContext: "ga4", currency, isActive: true,
    mappingConfig: JSON.stringify({ connectionId: conn.id, revenueColumn: "Revenue", dateColumn: "Date", currency }), records: [{ revenue: "20.00", date, currency }] };
  const unrelated = { id: "source-b", campaignId: "b", records: [{ revenue: "99.00" }] };
  const replace = vi.fn(async (campaignId: string, sourceId: string | null, type: string, context: string, source: any, records: any[], expected?: string | null) => {
    if (campaignId !== "a" || type !== "google_sheets" || context !== "ga4" || (sourceId && (sourceId !== saved.id || expected !== saved.mappingConfig))) throw new Error("Unexpected write boundary");
    if (persist) {
      const result = await persist(campaignId, sourceId, type, context, source, records, expected);
      Object.assign(saved, result, { records });
      return result;
    }
    Object.assign(saved, source, { records });
    return { ...saved };
  });
  const storage = {
    getCampaign: vi.fn(async () => campaign), getGoogleSheetsConnections: vi.fn(async () => [conn]),
    getRevenueSources: vi.fn(async () => [saved]), replaceRevenueSourceWithRecords: replace,
    updateGoogleSheetsConnection: vi.fn(), writeWithGA4RefreshOwnership: vi.fn(async (_scope: any, writer: any) => writer()),
  };
  const provider = vi.fn(async (url: string) => {
    if (!url.startsWith("https://sheets.googleapis.com/v4/spreadsheets/fixture")) throw new Error("Unexpected provider request");
    return new Response(JSON.stringify(url.includes("/values/") ? { values: data } : {
      sheets: [{ properties: { title: "Revenue", index: 0, gridProperties: { rowCount: data.length } } }],
    }), { status: 200 });
  });
  let handler: any;
  const access = vi.fn(async () => true);
  const recompute = vi.fn();
  const dependencies: any = { z, ...csv, ...amount, ...ranges, ...preview, createHash, storage,
    fetch: provider, fetchWithTimeout: provider, ensureCampaignAccess: access,
    app: { post: (_path: string, ...callbacks: any[]) => { handler = callbacks.at(-1); } },
    googleSheetsRateLimiter: () => {}, importRateLimiter: () => {}, inFlightGoogleSheetsRevenueAdds: new Set(),
    normalizeOverviewInventoryConfigValue: (value: any) => value,
    revenuePurposeForPlatformContext: () => "revenue", parseValueSource: (value: any, fallback: any) => value || fallback,
    sendBadRequest: (res: any, error: string) => res.status(400).json({ success: false, error }),
    refreshGoogleSheetsToken: vi.fn(async () => "renewed-fixture-token"),
    googleAdsCampaignIdFromValueOrMapping: () => null,
    getReportingDateWindow: () => ({ endDate: date }), getLatestCompleteReportingDate: () => date, yesterdayUTC: () => date,
    recomputeCampaignDerivedValues: recompute,
    isSourceOutsideCampaign: (source: any, campaignId: string) => source.campaignId !== campaignId,
    console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
  function compile(code: string) {
    return new Function(...Object.keys(dependencies), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(dependencies));
  }
  async function invoke(action = "process", mapping: any = {}) {
    compile(`${setup}\n${parseNumCode}\n${routeCode(action)}`);
    const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
    await handler({ params: { id: "a" }, body: { connectionId: conn.id, platformContext: "ga4",
      mapping: { revenueColumn: "Revenue", dateColumn: "Date", currency, ...mapping } } }, res);
    return res;
  }
  async function refresh(mapping: any = {}, options: any = {}) {
    const fn = compile(`${refreshCode}\nreturn reprocessGoogleSheetsRevenue;`);
    return fn("a", saved, { ...JSON.parse(saved.mappingConfig), ...mapping }, options);
  }
  return { invoke, refresh, replace, storage, provider, access, recompute, saved, unrelated, setData: (next: unknown[][]) => { data = next; } };
}

describe("Batch 4 Sheets Revenue input and saved-scope contracts", () => {
  for (const path of ["preview", "process", "refresh"]) {
    it.each([
      ["Revenue", "Revenue"], [" Revenue ", "Revenue"], ["", "Column 1"], ["Campaign", "Campaign"],
    ])(`rejects colliding headers before ${path} can publish or replace values: %j`, async (first, second) => {
      const f = fixture([["Date", first, second], [date, "100", "7"]]);
      // Generated Column 1 collides only when the blank occupies the first column.
      if (first === "") f.setData([[first, second, "Date"], ["100", "7", date]]);
      const before = structuredClone(f.saved);
      const result = path === "refresh" ? await f.refresh() : await f.invoke(path);
      if (path === "refresh") expect(result).toBe(false);
      else {
        expect(result.statusCode, result.body?.error).toBe(400);
        expect(result.body.error).toContain("column names must be unique");
      }
      expect(f.replace).not.toHaveBeenCalled();
      expect(f.saved).toEqual(before);
    });
  }

  it.each(["process", "refresh"])("rejects a selected dollar amount in EUR during %s and preserves last-good records", async path => {
    const f = fixture([["Date", "Revenue"], [date, "$100"]]);
    const before = structuredClone(f.saved);
    if (path === "process") expect((await f.invoke(path, { sourceId: f.saved.id })).statusCode).toBe(400);
    else expect(await f.refresh()).toBe(false);
    expect(f.replace).not.toHaveBeenCalled();
    expect(f.recompute).not.toHaveBeenCalled();
    expect(f.saved).toEqual(before);
  });

  it.each([
    { campaignValue: "A" }, { campaignValues: ["A"] }, { campaignValues: [], campaignValue: "A" },
    { campaignValues: [" A ", ""], campaignValue: "B" },
  ])("refresh preserves exact saved selection, source ID, daily records and attribution: %j", async selection => {
    const f = fixture([["Date", "Campaign", "Revenue"], [date, "A", "10"], [date, "B", "90"]]);
    f.saved.mappingConfig = JSON.stringify({ ...JSON.parse(f.saved.mappingConfig), campaignColumn: "Campaign", ...selection });
    const before = f.saved.mappingConfig;
    const scope = { campaignId: "a", ownerToken: "fixture" };
    expect(await f.refresh({}, { refreshScope: scope })).toBe(true);
    expect(f.saved.records).toEqual([{ campaignId: "a", date, revenue: "10.00", currency: "EUR" }]);
    expect(JSON.parse(f.saved.mappingConfig).campaignValueRevenueTotals).toEqual([{ campaignValue: "A", revenue: 10 }]);
    expect(f.replace.mock.calls[0][1]).toBe("source-a");
    expect(f.replace.mock.calls[0][6]).toBe(before);
    expect(f.replace.mock.calls[0][7]).toEqual({ refreshScope: scope });
    expect(f.unrelated.records).toEqual([{ revenue: "99.00" }]);
  });

  it("save to refresh round trip keeps the singular selection and ignores malformed unselected rows", async () => {
    const f = fixture([["Date", "Campaign", "Revenue"], [date, "A", "10"], ["bad", "B", "$12oops"]]);
    const result = await f.invoke("process", { campaignColumn: "Campaign", campaignValue: " A " });
    expect(result.statusCode, result.body?.error).toBe(200);
    expect(result.body.totalRevenue).toBe(10);
    expect(await f.refresh()).toBe(true);
    expect(f.saved.records[0].revenue).toBe("10.00");
    expect(f.replace).toHaveBeenCalledTimes(2);
  });

  it("fails closed for an incomplete saved filter instead of importing the full sheet", async () => {
    const f = fixture([["Date", "Campaign", "Revenue"], [date, "A", "10"]]);
    expect(await f.refresh({ campaignColumn: "Campaign", campaignValues: [] })).toBe(false);
    expect(f.replace).not.toHaveBeenCalled();
  });

  it.each(["EUR", "USD"])("keeps valid %s create/edit/refresh amounts, dates and generated header names", async currency => {
    const f = fixture([[" Date ", "", "Campaign"], [date, currency === "USD" ? "$1,234.56" : "1,234.56", "A"], [date, "0", "A"]], currency);
    const previewResult = await f.invoke("preview");
    expect(previewResult.body.headers).toEqual(["Date", "Column 2", "Campaign"]);
    const mapping = { revenueColumn: "Column 2", campaignColumn: "Campaign", campaignValues: ["A"] };
    expect((await f.invoke("process", mapping)).body.totalRevenue).toBe(1234.56);
    expect((await f.invoke("process", { ...mapping, sourceId: f.saved.id })).body.totalRevenue).toBe(1234.56);
    expect(await f.refresh()).toBe(true);
    expect(f.saved.records).toEqual([{ campaignId: "a", date, revenue: "1234.56", currency }]);
  });

  it.each(["12oops", "1.234,56"])("retains existing malformed-amount rejection for %s", async value => {
    const f = fixture([["Date", "Revenue"], [date, value]]);
    expect((await f.invoke()).statusCode).toBe(400);
    expect(await f.refresh()).toBe(false);
    expect(f.replace).not.toHaveBeenCalled();
  });

  it("keeps an explicitly unfiltered snapshot import and refresh additive at the same source", async () => {
    const f = fixture([["Revenue"], ["10"], ["90"]]);
    expect((await f.invoke("process", { dateColumn: null })).body.totalRevenue).toBe(100);
    expect(await f.refresh()).toBe(true);
    expect(f.saved.records[0]).toMatchObject({ date, revenue: "100.00" });
  });

  it("preserves authorization, stale-source, provider-failure and currency mismatch boundaries", async () => {
    const f = fixture([["Date", "Revenue"], [date, "10"]]);
    f.access.mockResolvedValueOnce(false);
    await f.invoke();
    expect(f.provider).not.toHaveBeenCalled();
    expect((await f.invoke("process", { sourceId: "other-source" })).statusCode).toBe(404);
    expect((await f.invoke("process", { currency: "USD" })).body.code).toBe("REVENUE_CURRENCY_MISMATCH");
    expect(await f.refresh({ currency: "USD" })).toBe(false);
    f.provider.mockResolvedValue(new Response("unavailable", { status: 503 }));
    expect((await f.invoke()).statusCode).toBe(400);
    expect(await f.refresh()).toBe(false);
    expect(f.replace).not.toHaveBeenCalled();
  });
});

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "").trim();
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) throw new Error("Use isolated local Sheets fixtures only");
}
describe.skipIf(!testUrl)("Sheets Revenue handler-to-PostgreSQL persistence", () => {
  const schemaName = `sheets_revenue_it_${randomUUID().replace(/-/g, "")}`;
  let admin: Pool, pool: Pool, db: any, storage: any, created = false;
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 1 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, max: 2 });
    db = drizzle(pool, { schema });
    vi.doMock("./db", () => ({ db, pool }));
    const { DatabaseStorage } = await import("./storage");
    storage = new DatabaseStorage();
    const dialect = new PgDialect();
    for (const table of [schema.campaigns, schema.revenueSources, schema.revenueRecords]) {
      const columns = Object.values(getTableColumns(table)).map((column: any) => {
        const value = column.default;
        const defaultSql = value instanceof SQL ? dialect.sqlToQuery(value).sql : typeof value === "string" ? `'${value.replace(/'/g, "''")}'` : String(value);
        return `"${column.name}" ${column.getSQLType()}${column.notNull ? " NOT NULL" : ""}${value !== undefined ? ` DEFAULT ${defaultSql}` : ""}${column.primary ? " PRIMARY KEY" : ""}`;
      });
      await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(", ")})`);
    }
  });
  beforeEach(async () => {
    await pool.query("TRUNCATE campaigns,revenue_sources,revenue_records");
    await db.insert(schema.campaigns).values(["a", "b"].map(id => ({ id, ownerId: `owner-${id}`, name: id, currency: "EUR", reportingTimeZone: "Europe/Amsterdam", status: "active" })));
  });
  afterAll(async () => {
    await pool?.end();
    if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    await admin?.end();
    vi.doUnmock("./db");
  });
  it("persists only selected Revenue through add/edit/refresh and reconciles source and total reads", async () => {
    const f = fixture([["Date", "Campaign", "Revenue"], [date, "A", "10"], [date, "B", "90"]], "EUR", storage.replaceRevenueSourceWithRecords.bind(storage));
    const mapping = { campaignColumn: "Campaign", campaignValue: "A" };
    expect((await f.invoke("process", mapping)).body.totalRevenue).toBe(10);
    const sourceId = f.saved.id;
    f.setData([["Date", "Campaign", "Revenue"], [date, "A", "15"], [date, "B", "900"]]);
    expect((await f.invoke("process", { ...mapping, sourceId })).body.totalRevenue).toBe(15);
    expect(await f.refresh()).toBe(true);
    expect((await pool.query("SELECT revenue,currency,revenue_source_id FROM revenue_records")).rows).toEqual([{ revenue: "15.00", currency: "EUR", revenue_source_id: sourceId }]);
    expect(await storage.getRevenueTotalForRange("a", "1900-01-01", "2999-12-31", "ga4")).toEqual({ totalRevenue: 15, currency: "EUR", sourceIds: [sourceId] });
    expect(await storage.getRevenueBreakdownBySource("a", "1900-01-01", "2999-12-31", "ga4")).toEqual([expect.objectContaining({ sourceId, revenue: 15, currency: "EUR" })]);
    expect((await storage.getRevenueSources("a", "ga4"))).toHaveLength(1);
    expect((await storage.getRevenueSources("b", "ga4"))).toHaveLength(0);
  });
  it.each([[["Date", "Revenue", "Revenue"], [date, "100", "7"]], [["Date", "Revenue"], [date, "$100"]]])("keeps actual last-good database records on invalid edit and refresh: %j", async (headers, row) => {
    const f = fixture([["Date", "Revenue"], [date, "20"]], "EUR", storage.replaceRevenueSourceWithRecords.bind(storage));
    expect((await f.invoke()).statusCode).toBe(200);
    const before = (await pool.query("SELECT * FROM revenue_records")).rows;
    f.setData([headers, row]);
    expect((await f.invoke("process", { sourceId: f.saved.id })).statusCode).toBe(400);
    expect(await f.refresh()).toBe(false);
    expect((await pool.query("SELECT * FROM revenue_records")).rows).toEqual(before);
    expect(f.replace).toHaveBeenCalledTimes(1);
  });
});
