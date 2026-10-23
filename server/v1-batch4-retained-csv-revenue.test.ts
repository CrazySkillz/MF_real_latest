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

const ast = ts.createSourceFile("routes.ts", readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
function extract(predicate: (node: ts.Node) => boolean) {
  let result = "";
  function visit(node: ts.Node) {
    if (!result && predicate(node)) result = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!result) throw new Error("Missing current route implementation");
  return result;
}
const setup = ["zValueSource", "zCsvRevenuePlatformContext", "zRevenueMapping", "parseCsvRevenuePlatformContext", "parseValueSource", "exactGoogleAdsCampaignIdOrNull", "googleAdsCampaignIdFromValueOrMapping"]
  .map(name => `const ${extract(n => ts.isVariableDeclaration(n) && n.name.getText(ast) === name)};`).join("\n");
const parseNumCode = `const ${extract(n => ts.isVariableDeclaration(n) && n.name.getText(ast) === "parseNum" && n.getText(ast).includes("String(val).replace"))};`;
const code = Object.fromEntries(["preview", "process"].map(action => [action, ts.transpileModule(`${setup}\n${parseNumCode}\n${extract(n => ts.isCallExpression(n)
  && n.expression.getText(ast) === "app.post" && ts.isStringLiteral(n.arguments[0])
  && n.arguments[0].text === `/api/campaigns/:id/revenue/csv/${action}`)}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText]));
const date = "2026-10-21";
const contexts = ["linkedin", "meta", "google_ads", "instagram", "tiktok", "google_sheets", "custom_integration"];

// Actual route/parser/schema; provider, auth and downstream side effects are isolated boundaries.
function fixture(context = "linkedin", persistence?: any) {
  const sources: any[] = [];
  const records: any[] = [];
  const replace = vi.fn(async (campaignId, id, sourceType, platformContext, source, rows, expected) => {
    if (persistence) return persistence.replaceRevenueSourceWithRecords(campaignId, id, sourceType, platformContext, source, rows, expected);
    const saved = id ? sources.find(s => s.id === id) : { id: randomUUID() };
    Object.assign(saved, source, { sourceType, platformContext });
    if (!id) sources.push(saved);
    records.splice(0, records.length, ...rows.map((r: any) => ({ ...r, revenueSourceId: saved.id })));
    return saved;
  });
  const getSource = async (campaignId: string, id: string) => persistence ? persistence.getRevenueSource(campaignId, id)
    : sources.find(s => s.id === id && s.campaignId === campaignId && s.isActive);
  const storage: any = {
    getCampaign: async () => ({ id: "a", currency: "EUR" }), getRevenueSource: getSource, replaceRevenueSourceWithRecords: replace,
    createRevenueSource: vi.fn(async (source: any) => { const saved = { id: randomUUID(), ...source }; sources.push(saved); return saved; }),
    updateRevenueSource: vi.fn(async (id: string, source: any) => Object.assign(sources.find(s => s.id === id), source)),
    deleteRevenueRecordsBySource: vi.fn(async () => { records.length = 0; }),
    createRevenueRecords: vi.fn(async (rows: any[]) => { records.push(...rows); }), updateLinkedInConnection: vi.fn(),
  };
  const recompute = vi.fn(), session = vi.fn();
  let handler: any;
  const dependencies: any = { ...csv, z, Buffer, createHash, storage,
    app: { post: (_path: string, ...handlers: any[]) => { handler = handlers.at(-1); } },
    importRateLimiter: () => {}, requireCampaignAccessParamId: () => {}, uploadRevenueCsv: () => {},
    MAX_CSV_ROWS_PREVIEW: 50_000, MAX_CSV_ROWS_PROCESS: 50_000, countLinesUpTo: (s: string) => s.split("\n").length,
    sendBadRequest: (res: any, error: string) => res.status(400).json({ success: false, error }),
    getActiveGoogleAdsCampaignIdSet: async () => new Set(["123"]), getActiveMetaCampaignIdSet: async () => new Set(),
    getActiveInstagramCampaignIdSet: async () => new Set(), getActiveTikTokCampaignIdSet: async () => new Set(),
    yesterdayUTC: () => date,
    recomputeCampaignDerivedValues: recompute, setLatestLinkedInImportSessionConversionValue: session,
    clearLatestLinkedInImportSessionConversionValue: session,
  };
  async function invoke(text?: string, mapping: any = {}, action = "process") {
    new Function(...Object.keys(dependencies), code[action])(...Object.values(dependencies));
    const res: any = { statusCode: 200, status(n: number) { this.statusCode = n; return this; }, json(body: any) { this.body = body; return this; } };
    await handler({ params: { id: "a" }, body: { platformContext: context, mapping: JSON.stringify({ revenueColumn: "Revenue", currency: "EUR", ...mapping }) },
      ...(text === undefined ? {} : { file: { buffer: Buffer.from(text), originalname: "fixture.csv" } }) }, res);
    return res;
  }
  return { invoke, storage, sources, records, replace, recompute, session };
}

describe("V1-072 retained Revenue CSV route safety", () => {
  it.each(contexts)("retains all 50,000 rows and rejects row 50,001 in %s preview/save", async context => {
    const f = fixture(context), text = `Revenue\n${Array(50_000).fill("1").join("\n")}`;
    for (const action of ["preview", "process"]) {
      const result = await f.invoke(text, {}, action);
      expect(result.statusCode, result.body.error).toBe(200);
      expect(result.body.rowCount).toBe(50_000);
      if (action === "process") {
        expect(result.body.totalRevenue).toBe(50_000);
        expect(f.records[0].revenue).toBe("50000.00");
        expect(JSON.parse(f.sources[0].mappingConfig).csvStoredRevenueRows).toHaveLength(50_000);
      }
      expect((await f.invoke(text + "\n1", {}, action)).statusCode).toBe(413);
    }
  });
  it("counts quoted multiline fields as data rows, not physical lines", async () => {
    const f = fixture("custom_integration");
    const text = `Revenue,Note\n${Array(26_000).fill('1,"line one\nline two"').join("\n")}`;
    const result = await f.invoke(text);
    expect(result.statusCode, result.body.error).toBe(200);
    expect(result.body.totalRevenue).toBe(26_000);
  });
  it.each(["Revenue,Revenue\n10,20", 'Revenue\n"10', "Revenue,Note\n10,note,extra"])("rejects malformed replacements before mutation: %s", async text => {
    const f = fixture(); await f.invoke("Revenue\n20");
    const before = structuredClone({ sources: f.sources, records: f.records });
    expect((await f.invoke(text, { sourceId: f.sources[0].id })).statusCode).toBe(400);
    expect({ sources: f.sources, records: f.records }).toEqual(before);
  });
  it.each([false, true])("rejects invalid conversion values without source/record/downstream changes, edit=%s", async edit => {
    const f = fixture(); await f.invoke("Revenue\n20");
    const before = structuredClone({ sources: f.sources, records: f.records });
    f.recompute.mockClear(); f.session.mockClear(); f.storage.updateLinkedInConnection.mockClear();
    const result = await f.invoke("Value\ninvalid", { sourceId: edit ? f.sources[0].id : undefined, valueSource: "conversion_value", conversionValueColumn: "Value" });
    expect(result.statusCode).toBe(400);
    expect({ sources: f.sources, records: f.records }).toEqual(before);
    expect(f.recompute).not.toHaveBeenCalled(); expect(f.session).not.toHaveBeenCalled();
    expect(f.storage.updateLinkedInConnection).not.toHaveBeenCalled();
  });
  it("keeps the existing conversion median and clears prior Revenue records only after validation", async () => {
    const f = fixture(); await f.invoke("Revenue\n20");
    const result = await f.invoke("Value\n10\n30", { sourceId: f.sources[0].id, valueSource: "conversion_value", conversionValueColumn: "Value" });
    expect(result.body).toMatchObject({ success: true, conversionValue: 20, totalRevenue: 0, mode: "conversion_value" });
    expect(f.records).toEqual([]); expect(f.sources).toHaveLength(1);
    expect(f.storage.updateLinkedInConnection).toHaveBeenLastCalledWith("a", { conversionValue: "20.00" });
  });
  it("rejects empty selected revenue before replacing a saved source", async () => {
    const f = fixture(); await f.invoke("Revenue\n20");
    const before = structuredClone({ sources: f.sources, records: f.records });
    expect((await f.invoke("Revenue\ninvalid", { sourceId: f.sources[0].id })).statusCode).toBe(400);
    expect({ sources: f.sources, records: f.records }).toEqual(before);
  });
  it.each([null, "Date"])("preserves exact active campaign attribution and existing date grain: %s", async dateColumn => {
    const f = fixture("google_ads");
    const result = await f.invoke(`Date,Campaign,Revenue\n${date},A,10\n2026-10-20,B,90\n${date},C,999`, {
      dateColumn, campaignColumn: "Campaign", campaignValues: ["A", "B"],
      campaignMappings: [{ crmValue: "A", googleAdsCampaignId: "123" }, { crmValue: "B", googleAdsCampaignId: "unselected" }],
    });
    expect(result.statusCode, result.body.error).toBe(200);
    expect(result.body).toMatchObject({ totalRevenue: 100, keptRows: 2 });
    expect(f.records.filter(r => r.subCampaignUrn)).toEqual([expect.objectContaining({ date, revenue: "10.00", subCampaignUrn: "123" })]);
    expect(f.records.filter(r => !r.subCampaignUrn).map(r => [r.date, r.revenue])).toEqual(dateColumn ? [[date, "10.00"], ["2026-10-20", "90.00"]] : [[date, "100.00"]]);
  });
});

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "").trim();
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) throw new Error("Use isolated local CSV fixtures only");
}
describe.skipIf(!testUrl)("V1-072 actual PostgreSQL source/record transaction", () => {
  const schemaName = `csv_revenue_it_${randomUUID().replace(/-/g, "")}`;
  let admin: Pool, pool: Pool, db: any, storage: any, created = false;
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 1 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, max: 3 });
    db = drizzle(pool, { schema });
    vi.doMock("./db", () => ({ db, pool }));
    const { DatabaseStorage } = await import("./storage"); storage = new DatabaseStorage();
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
    await db.insert(schema.campaigns).values(["a", "b"].map(id => ({ id, ownerId: `owner-${id}`, name: id, currency: "EUR", status: "active" })));
  });
  afterAll(async () => {
    await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    await admin?.end(); vi.doUnmock("./db");
  });
  const snapshot = async () => ({ sources: (await pool.query("SELECT * FROM revenue_sources ORDER BY id")).rows,
    records: (await pool.query("SELECT * FROM revenue_records ORDER BY id")).rows });
  it("persists add/edit/selection-only edits and reconciles source totals without changing unrelated data", async () => {
    const f = fixture("custom_integration", storage);
    const mapping = { campaignColumn: "Campaign", campaignValue: "A", dateColumn: "Date" };
    const input = `Date,Campaign,Revenue\n${date},A,10\n${date},B,90`;
    const first = await f.invoke(input, mapping);
    expect(first.statusCode, first.body.error).toBe(200);
    await storage.replaceRevenueSourceWithRecords("b", null, "csv", "custom_integration", { campaignId: "b", currency: "EUR", sourceType: "csv" }, [{ campaignId: "b", date, currency: "EUR", revenue: "777.00" }]);
    const other = (await snapshot()).records.find((r: any) => r.campaign_id === "b");
    const sourceId = first.body.sourceId;
    expect((await f.invoke(undefined, { ...mapping, sourceId, campaignValue: "B" })).body.totalRevenue).toBe(90);
    expect((await f.invoke(input.replace(",90", ",95"), { ...mapping, sourceId, campaignValue: "B" })).body.totalRevenue).toBe(95);
    expect(await storage.getRevenueTotalForRange("a", "1900-01-01", "2999-12-31", "custom_integration")).toEqual({ totalRevenue: 95, currency: "EUR", sourceIds: [sourceId] });
    expect(await storage.getRevenueBreakdownBySource("a", "1900-01-01", "2999-12-31", "custom_integration")).toEqual([expect.objectContaining({ sourceId, revenue: 95 })]);
    expect((await snapshot()).records.find((r: any) => r.campaign_id === "b")).toEqual(other);
    expect(await storage.getRevenueSources("a", "custom_integration")).toHaveLength(1);
  });
  it("retains last-good database data when conversion validation fails", async () => {
    const f = fixture("linkedin", storage), first = await f.invoke("Revenue\n20");
    expect(first.statusCode, first.body.error).toBe(200);
    const before = await snapshot();
    expect((await f.invoke("Value\ninvalid", { sourceId: first.body.sourceId, valueSource: "conversion_value", conversionValueColumn: "Value" })).statusCode).toBe(400);
    expect(await snapshot()).toEqual(before);
  });
  it.each([false, true])("rolls back source and record writes after database insert failure, edit=%s", async edit => {
    const f = fixture("custom_integration", storage), first = await f.invoke("Revenue\n20");
    expect(first.statusCode, first.body.error).toBe(200);
    const before = await snapshot();
    await pool.query("ALTER TABLE revenue_records ADD CONSTRAINT fixture_reject CHECK (revenue < 30)");
    try {
      expect((await f.invoke("Revenue\n40", { sourceId: edit ? first.body.sourceId : undefined })).statusCode).toBe(500);
      expect(await snapshot()).toEqual(before);
    } finally { await pool.query("ALTER TABLE revenue_records DROP CONSTRAINT fixture_reject"); }
  });
  it.each(["campaign", "context", "type", "inactive", "stale"])("rejects wrong or changed %s without writes", async boundary => {
    const f = fixture("custom_integration", storage), first = await f.invoke("Revenue\n20");
    expect(first.statusCode, first.body.error).toBe(200);
    const id = first.body.sourceId;
    if (boundary === "campaign") await pool.query("UPDATE revenue_sources SET campaign_id='b'");
    if (boundary === "context") await pool.query("UPDATE revenue_sources SET platform_context='linkedin'");
    if (boundary === "type") await pool.query("UPDATE revenue_sources SET source_type='manual'");
    if (boundary === "inactive") await pool.query("UPDATE revenue_sources SET is_active=false");
    const before = await snapshot();
    if (boundary === "stale") {
      const persist = storage.replaceRevenueSourceWithRecords.bind(storage);
      f.replace.mockImplementationOnce((...args: any[]) => persist(...args.slice(0, 6), "stale mapping"));
    }
    const result = await f.invoke("Revenue\n25", { sourceId: id });
    expect(result.statusCode, result.body.error).toBe(boundary === "stale" ? 409 : 404);
    expect(await snapshot()).toEqual(before);
  });
  it("does not recreate financial data after the parent campaign has been deleted", async () => {
    await pool.query("DELETE FROM campaigns WHERE id='a'");
    const f = fixture("custom_integration", storage);
    expect((await f.invoke("Revenue\n20")).statusCode).toBe(500);
    expect(await snapshot()).toEqual({ sources: [], records: [] });
  });
  it("allows only one concurrent edit of the same saved mapping to commit", async () => {
    const f = fixture("custom_integration", storage), first = await f.invoke("Revenue\n20");
    expect(first.statusCode, first.body.error).toBe(200);
    const source = await storage.getRevenueSource("a", first.body.sourceId);
    const results = await Promise.allSettled(["30.00", "40.00"].map(revenue => storage.replaceRevenueSourceWithRecords(
      "a", source.id, "csv", "custom_integration", { ...source, mappingConfig: JSON.stringify({ revenue }) },
      [{ campaignId: "a", date, currency: "EUR", revenue }], source.mappingConfig)));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toMatchObject([{ reason: { code: "REVENUE_SOURCE_CHANGED" } }]);
    const saved = await storage.getRevenueSource("a", source.id);
    expect((await snapshot()).records).toEqual([expect.objectContaining({ revenue: JSON.parse(saved.mappingConfig).revenue })]);
  });
  it("waits for an in-flight parent deletion and fails without creating orphan rows", async () => {
    const deletion = await pool.connect();
    try {
      await deletion.query("BEGIN"); await deletion.query("DELETE FROM campaigns WHERE id='a'");
      const f = fixture("custom_integration", storage), pending = f.invoke("Revenue\n20");
      let waiting = false;
      const deadline = Date.now() + 3000;
      while (!waiting && Date.now() < deadline) {
        waiting = (await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%campaigns%' AND pid<>pg_backend_pid() LIMIT 1")).rowCount === 1;
        if (!waiting) await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
      await deletion.query("COMMIT");
      expect((await pending).statusCode).toBe(500);
      expect(await snapshot()).toEqual({ sources: [], records: [] });
    } finally { await deletion.query("ROLLBACK"); deletion.release(); }
  });
});
