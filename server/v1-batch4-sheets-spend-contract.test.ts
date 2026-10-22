import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import ts from "typescript";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableColumns, getTableName, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";
import * as csv from "./utils/csv";
import * as ranges from "./utils/google-sheets-revenue-ranges";

const routes = ts.createSourceFile("routes.ts", readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const scheduler = ts.createSourceFile("scheduler.ts", readFileSync(new URL("./auto-refresh-scheduler.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const date = "2026-10-21";
function extract(ast: ts.SourceFile, predicate: (node: ts.Node) => boolean): string {
  let result = "";
  function visit(node: ts.Node) { if (!result && predicate(node)) result = node.getText(ast); ts.forEachChild(node, visit); }
  visit(ast);
  if (!result) throw new Error("Missing implementation node");
  return result;
}
const codeCache = new Map<string, string>();
const cached = (key: string, read: () => string) => { if (!codeCache.has(key)) codeCache.set(key, read()); return codeCache.get(key)!; };
const declaration = (name: string) => cached(name, () => `const ${extract(routes, n => ts.isVariableDeclaration(n) && n.name.getText(routes) === name)};`);
const parseNum = `const ${extract(routes, n => ts.isVariableDeclaration(n) && n.name.getText(routes) === "parseNum" && n.getText(routes).includes("String(val).replace"))};`;
const routeCode = (path: string) => cached(path, () => extract(routes, n => ts.isCallExpression(n) && ["app.post", "app.get"].includes(n.expression.getText(routes)) && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === path));
const refreshCode = extract(scheduler, n => ts.isFunctionDeclaration(n) && n.name?.text === "reprocessGoogleSheetsSpendWithDetails");

// Actual registered handlers and scheduler body; only provider/auth/storage boundaries are fixtures.
function fixture(initial: unknown[][], currency = "EUR", persist?: (...args: any[]) => Promise<any>) {
  let values = initial, gridRows = initial.length;
  const campaign = { id: "a", currency, reportingTimeZone: "Europe/Amsterdam" };
  const conn: any = { id: "connection-a", campaignId: "a", spreadsheetId: "fixture", sheetName: "Spend", accessToken: "fixture-token" };
  const saved: any = { id: "source-a", campaignId: "a", sourceType: "google_sheets", platformContext: "ga4", isActive: true, currency,
    mappingConfig: JSON.stringify({ connectionId: conn.id, spendColumn: "Spend", dateColumn: "Date", currency }), records: [{ date, spend: "20.00", currency }] };
  const replace = vi.fn(async (...args: any[]) => {
    const result = persist ? await persist(...args) : { ...saved, ...args[4] };
    Object.assign(saved, result, { records: args[5] });
    return result;
  });
  const storage: any = { getCampaign: vi.fn(async () => campaign), getGoogleSheetsConnections: vi.fn(async () => [conn]),
    getSpendSources: vi.fn(async () => [saved]), replaceSpendSourceWithRecords: replace, updateGoogleSheetsConnection: vi.fn(),
    writeWithGA4RefreshOwnership: vi.fn(async (_scope: any, fn: any) => fn()) };
  const provider = vi.fn(async (url: string, options: any) => {
    if (!url.startsWith("https://sheets.googleapis.com/v4/spreadsheets/fixture")) throw new Error("Unexpected provider request");
    if (!url.includes("/values/")) return new Response(JSON.stringify({ sheets: [{ properties: { title: "Spend", index: 0, gridProperties: { rowCount: gridRows } } }] }));
    const range = decodeURIComponent(url.split("/values/")[1]);
    const bounds = range.match(/!(?:A)?(\d+):(?:ZZ)?(\d+)$/)!;
    return new Response(JSON.stringify({ values: values.slice(Number(bounds[1]) - 1, Number(bounds[2])) }));
  });
  const renew = vi.fn(async () => "renewed-fixture-token"), recompute = vi.fn(), recalc = vi.fn();
  let handler: any, guard: any, currentOptions: any = {};
  const access = vi.fn((_req: any, _res: any, next: any) => next());
  const register = (_path: string, ...callbacks: any[]) => { guard = callbacks[0]; handler = callbacks.at(-1); };
  const dependencies: any = { ...csv, ...ranges, storage, createHash, app: { post: register, get: register }, requireCampaignAccessParamId: access,
    fetch: provider, EXTERNAL_API_TIMEOUT_MS: 15_000,
    refreshGoogleSheetsToken: renew, getInternalGA4RefreshWriteInput: () => currentOptions,
    spendSourceMatchesPlatformContext: (s: any, v: string) => (s.platformContext || "ga4") === v,
    getReportingDateWindow: () => ({ endDate: date }), recalcCampaignSpend: recalc, recomputeGA4SpendBeforeResponse: recompute,
    toA1Prefix: (v: string) => `'${v}'!`, isSourceOutsideCampaign: (s: any, id: string) => s.campaignId !== id,
    console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    postJson: async (_path: string, body: any, options: any) => { const r = await invoke("process", {}, body, options); return { ok: r.statusCode === 200, status: r.statusCode, json: r.body }; },
  };
  function compile(code: string) { return new Function(...Object.keys(dependencies), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(dependencies)); }
  async function invoke(action = "process", mapping: any = {}, body?: any, options: any = {}) {
    currentOptions = options;
    compile(`${parseNum}\n${declaration("scopedSpendPlatformContexts")}\n${declaration("isSupportedScopedSpendPlatformContext")}\n${declaration("fetchWithTimeout")}\n${declaration("readGoogleSheetsRevenueChunks")}\n${routeCode(`/api/campaigns/:id/spend/sheets/${action}`)}`);
    const req = { params: { id: "a" }, body: body || { connectionId: conn.id, platformContext: "ga4", mapping: { spendColumn: "Spend", dateColumn: "Date", currency, ...mapping } } };
    const res: any = { statusCode: 200, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; } };
    await guard(req, res, () => handler(req, res));
    return res;
  }
  async function refresh(options: any = {}) { return compile(`${refreshCode}\nreturn reprocessGoogleSheetsSpendWithDetails;`)("a", saved, JSON.parse(saved.mappingConfig), options); }
  return { invoke, refresh, saved, replace, provider, storage, conn, renew, recompute, recalc, access,
    setData: (next: unknown[][], size = next.length) => { values = next; gridRows = size; }, setDeadline: (ms: number) => { dependencies.EXTERNAL_API_TIMEOUT_MS = ms; } };
}

describe("Batch 4 complete Sheets Spend reads and validation", () => {
  it.each(["preview", "process", "refresh"])("includes data after row 5000 during %s", async path => {
    const f = fixture([["Date", "Spend"], ...Array.from({ length: 5001 }, () => [date, "1"])]);
    const result = path === "refresh" ? await f.refresh() : await f.invoke(path);
    expect(path === "refresh" ? result.success : result.statusCode, JSON.stringify(result.body)).toBe(path === "refresh" ? true : 200);
    if (path === "preview") expect(result.body.rowCount).toBe(5001);
    else expect(Number(f.saved.records[0].spend)).toBe(5001);
    expect(f.provider.mock.calls.every(([, options]) => options.signal instanceof AbortSignal)).toBe(true);
  });
  it.each(["12oops", "N/A", "-1", "$100", "1e3", "1.234", "12,34", "10000000000"])("rejects invalid selected amount %s before add/edit/refresh writes", async value => {
    const f = fixture([["Date", "Spend"], [date, value]]), before = structuredClone(f.saved);
    expect((await f.invoke()).statusCode).toBe(400);
    expect((await f.invoke("process", { sourceId: f.saved.id })).statusCode).toBe(400);
    expect((await f.refresh()).success).toBe(false);
    expect(f.replace).not.toHaveBeenCalled(); expect(f.recompute).not.toHaveBeenCalled(); expect(f.saved).toEqual(before);
  });
  it.each([[], [["Date", "Spend"]], [["Date", "Spend"], [date, ""]]].map(values => ({ values })))("does not turn missing data into measured zero: $values", async ({ values }) => {
    const f = fixture(values);
    f.setData(values, Math.max(1, values.length));
    expect((await f.invoke()).statusCode).toBe(400); expect((await f.refresh()).success).toBe(false); expect(f.replace).not.toHaveBeenCalled();
  });
  it("preserves an explicit numeric zero and its selected date", async () => {
    const f = fixture([["Date", "Spend"], ["2026-10-20", "0"]]);
    expect((await f.invoke()).body.spendToDate).toBe(0);
    expect(f.saved.records).toEqual([{ campaignId: "a", date: "2026-10-20", spend: "0", currency: "EUR", sourceType: "google_sheets" }]);
  });
  it("rejects combined overflow, invalid dates and an empty campaign selection", async () => {
    const f = fixture([["Date", "Spend"], [date, "9999999999"], [date, "1"]]);
    expect((await f.invoke()).statusCode).toBe(400);
    f.setData([["Date", "Spend"], ["2026-02-30", "1"]]); expect((await f.invoke()).statusCode).toBe(400);
    f.setData([["Date", "Spend", "Campaign"], [date, "1", "B"]]); expect((await f.invoke("process", { campaignColumn: "Campaign", campaignValue: "A" })).statusCode).toBe(400);
    expect(f.replace).not.toHaveBeenCalled();
  });
  it.each(["preview", "process"])("rejects duplicate generated/trimmed headers in %s", async action => {
    const f = fixture([["", "Column 1", "Spend"], ["A", "B", "10"]]);
    expect((await f.invoke(action)).statusCode).toBe(400); expect(f.replace).not.toHaveBeenCalled();
  });
  it("rejects oversized metadata and a failed later chunk without partial replacement", async () => {
    const f = fixture([["Date", "Spend"], [date, "10"]]);
    f.setData([["Date", "Spend"], [date, "10"]], 50_001);
    expect((await f.invoke()).statusCode).toBe(413); expect(f.provider).toHaveBeenCalledTimes(1);
    f.setData([["Date", "Spend"], ...Array.from({ length: 5001 }, () => [date, "1"])]);
    const original = f.provider.getMockImplementation()!;
    f.provider.mockImplementation(async (url, options) => decodeURIComponent(url).includes("!5001:") ? new Response("unavailable", { status: 503 }) : original(url, options));
    expect((await f.invoke()).statusCode).toBe(400); expect((await f.refresh()).success).toBe(false); expect(f.replace).not.toHaveBeenCalled();
  });
  it("retains selection, source ID, snapshot imports and owned token renewal across scheduler refresh", async () => {
    const f = fixture([["Spend", "Campaign"], ["$10.25", "A"], ["bad", "B"]], "USD");
    expect((await f.invoke("process", { dateColumn: null, campaignColumn: "Campaign", campaignValue: " A " })).body.spendToDate).toBe(10.25);
    f.conn.refreshToken = "fixture-refresh";
    const original = f.provider.getMockImplementation()!;
    let first = true;
    f.provider.mockImplementation(async (url, options) => { if (url.includes("/values/") && first) { first = false; return new Response("expired", { status: 401 }); } return original(url, options); });
    const options = { refreshScope: { campaignId: "a", ownerToken: "fixture" } };
    expect((await f.refresh(options)).success).toBe(true);
    expect(f.renew).toHaveBeenCalledWith(f.conn, options);
    expect(f.replace.mock.calls.at(-1)?.[1]).toBe(f.saved.id); expect(f.replace.mock.calls.at(-1)?.[7]).toEqual(options);
    expect(Number(f.saved.records[0].spend)).toBe(10.25);
  });
  it("preserves campaign authorization, stale source, changed mapping, missing connection and currency guards", async () => {
    const f = fixture([["Date", "Spend"], [date, "10"]]);
    f.access.mockImplementationOnce((_req, res, _next) => res.status(403).json({ error: "Denied" }));
    expect((await f.invoke()).statusCode).toBe(403); expect(f.provider).not.toHaveBeenCalled();
    expect((await f.invoke("process", { sourceId: "foreign-source" })).statusCode).toBe(404);
    expect((await f.invoke("process", {}, { connectionId: f.conn.id, platformContext: "ga4", mapping: { spendColumn: "Spend", sourceId: f.saved.id }, expectedSourceMappingConfig: "changed" })).statusCode).toBe(409);
    expect((await f.invoke("process", { currency: "USD" })).body.code).toBe("SPEND_CURRENCY_MISMATCH");
    f.storage.getGoogleSheetsConnections.mockResolvedValue([]); expect((await f.invoke()).statusCode).toBe(404); expect(f.replace).not.toHaveBeenCalled();
  });
  it("reads all 50,000 supported grid rows and columns beyond ZZ", async () => {
    const f = fixture([[...Array.from({ length: 702 }, (_, i) => `Other ${i}`), "Spend"], [...Array(702).fill(""), "12.50"]]);
    expect((await f.invoke("process", { dateColumn: null })).body.spendToDate).toBe(12.5);
    f.setData([["Date", "Spend"], ...Array.from({ length: 49_999 }, () => [date, "0.01"])]);
    expect((await f.invoke()).body.spendToDate).toBe(499.99);
    expect(f.provider.mock.calls.filter(([url]) => url.includes("/values/")).at(-1)?.[0]).toContain(encodeURIComponent("'Spend'!45001:50000"));
  });
  it.each(["metadata", "values", "body"])("aborts a stalled %s request before any saved values change", async stage => {
    const f = fixture([["Date", "Spend"], [date, "10"]]), before = structuredClone(f.saved), original = f.provider.getMockImplementation()!;
    f.setDeadline(25);
    f.provider.mockImplementation(async (url, options) => {
      if (stage !== "metadata" && !url.includes("/values/")) return original(url, options);
      const stalled = () => new Promise<never>((_resolve, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true }));
      if (stage === "body") return { ok: true, json: stalled } as any;
      return stalled();
    });
    expect((await f.invoke()).statusCode).toBeGreaterThanOrEqual(400);
    expect((await f.refresh()).success).toBe(false); expect(f.saved).toEqual(before); expect(f.replace).not.toHaveBeenCalled();
  });
  it("retains a successfully repaired connection if a later chunk needs token renewal", async () => {
    const f = fixture([["Date", "Spend"], [date, "10"]]), original = f.provider.getMockImplementation()!;
    const fallback = { ...f.conn, id: "newer-connection", accessToken: "fallback-token", refreshToken: "fallback-refresh" };
    f.storage.getGoogleSheetsConnections.mockResolvedValue([f.conn, fallback]);
    f.storage.updateGoogleSheetsConnection.mockImplementation(async (id: string, values: any) => ({ ...f.conn, ...values, id }));
    f.provider.mockImplementation(async (url, options) => options.headers.Authorization === "Bearer fixture-token" || (url.includes("/values/") && options.headers.Authorization === "Bearer fallback-token")
      ? new Response("expired", { status: 401 }) : original(url, options));
    expect((await f.invoke()).body.spendToDate).toBe(10);
    expect(f.renew).toHaveBeenCalledWith(expect.objectContaining({ id: "connection-a", refreshToken: "fallback-refresh" }), {});
  });
  it("keeps explicit zero records for the retained standalone Sheets path", async () => {
    const f = fixture([["Date", "Spend"], [date, "0"]]);
    f.storage.createSpendSource = vi.fn(async (s: any) => ({ ...s, id: "standalone" }));
    f.storage.createSpendRecords = vi.fn();
    const res = await f.invoke("process", {}, { connectionId: f.conn.id, platformContext: "google_sheets", mapping: { spendColumn: "Spend", dateColumn: "Date", currency: "EUR" } });
    expect(res.statusCode, res.body.error).toBe(200);
    expect(f.storage.createSpendRecords).toHaveBeenCalledWith([{ campaignId: "a", spendSourceId: "standalone", date, spend: "0", currency: "EUR", sourceType: "google_sheets" }]);
  });
});

// Read-only reproduction of the original cross-platform/currency grouping defect.
describe("Batch 4 duplicate inspection boundaries", () => {
  it("does not group different platforms, currencies or saved singular selections", async () => {
    const mapping = { connectionId: "conn", spreadsheetId: "sheet", sheetName: "Spend", spendColumn: "Spend", campaignColumn: "Campaign", campaignValues: [], campaignValue: "A" };
    const sources = [["ga4", "USD", "A"], ["linkedin", "EUR", "A"], ["ga4", "EUR", "A"], ["ga4", "USD", "B"]].map(([platformContext, currency, campaignValue], index) => ({ id: String(index), campaignId: "a", sourceType: "google_sheets", isActive: true, platformContext, currency, mappingConfig: JSON.stringify({ ...mapping, campaignValue }) }));
    const storage = { getSpendSources: async () => sources, getGoogleSheetsSpendCleanupState: async () => ({ sources, records: [] }) };
    const fn = new Function("storage", "createHash", ts.transpileModule(`${declaration("scopedSpendPlatformContexts")}\n${declaration("isSupportedScopedSpendPlatformContext")}\n${declaration("getGoogleSheetsSpendDuplicateGroups")}\nreturn getGoogleSheetsSpendDuplicateGroups;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(storage, createHash);
    expect((await fn("a")).duplicateGroups).toEqual([]);
  });
});

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "").trim();
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) throw new Error("Use isolated local Spend fixtures only");
}
describe.skipIf(!testUrl)("Sheets Spend handler-to-PostgreSQL and cleanup safety", () => {
  const schemaName = `sheets_spend_it_${randomUUID().replace(/-/g, "")}`;
  let admin: Pool, pool: Pool, db: any, storage: any, created = false;
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 1 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, max: 3 });
    db = drizzle(pool, { schema });
    vi.doMock("./db", () => ({ db, pool }));
    const { DatabaseStorage } = await import("./storage"); storage = new DatabaseStorage();
    const dialect = new PgDialect();
    for (const table of [schema.campaigns, schema.spendSources, schema.spendRecords]) {
      const columns = Object.values(getTableColumns(table)).map((column: any) => {
        const value = column.default;
        const defaultSql = value instanceof SQL ? dialect.sqlToQuery(value).sql : typeof value === "string" ? `'${value.replace(/'/g, "''")}'` : String(value);
        return `"${column.name}" ${column.getSQLType()}${column.notNull ? " NOT NULL" : ""}${value !== undefined ? ` DEFAULT ${defaultSql}` : ""}${column.primary ? " PRIMARY KEY" : ""}`;
      });
      await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(", ")})`);
    }
  });
  beforeEach(async () => {
    await pool.query("TRUNCATE campaigns,spend_sources,spend_records");
    await db.insert(schema.campaigns).values(["a", "b"].map(id => ({ id, ownerId: `owner-${id}`, name: id, currency: "EUR", reportingTimeZone: "Europe/Amsterdam", status: "active" })));
  });
  afterAll(async () => {
    await pool?.end();
    if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    await admin?.end(); vi.doUnmock("./db");
  });
  const mapping = JSON.stringify({ connectionId: "conn", spreadsheetId: "sheet", sheetName: "Spend", spendColumn: "Spend", dateColumn: "Date" });
  async function seed(id: string, overrides: any = {}, amount: string | null = "10.00") {
    const source = { id, campaignId: "a", sourceType: "google_sheets", platformContext: "ga4", currency: "EUR", mappingConfig: mapping, createdAt: new Date("2026-10-01"), ...overrides };
    await db.insert(schema.spendSources).values(source);
    if (amount !== null) await db.insert(schema.spendRecords).values({ id: `record-${id}`, campaignId: source.campaignId, spendSourceId: id, date, spend: amount, currency: source.currency, sourceType: "google_sheets" });
  }
  async function snapshot() { return { sources: (await pool.query("SELECT * FROM spend_sources ORDER BY id")).rows, records: (await pool.query("SELECT * FROM spend_records ORDER BY id")).rows }; }
  function cleanupFixture() {
    let handler: any, guard: any;
    const recompute = vi.fn(), recalc = vi.fn();
    const access = vi.fn((_req: any, _res: any, next: any) => next());
    const register = (_path: string, ...callbacks: any[]) => { guard = callbacks[0]; handler = callbacks.at(-1); };
    const deps: any = { storage, createHash, app: { get: register, post: register }, requireCampaignAccessParamId: access, recalcCampaignSpend: recalc, recomputeGA4KPIAndBenchmarkValues: recompute };
    const call = async (action = "", body: any = {}, campaignId = "a") => {
      const code = `${declaration("scopedSpendPlatformContexts")}\n${declaration("isSupportedScopedSpendPlatformContext")}\n${declaration("getGoogleSheetsSpendDuplicateGroups")}\n${routeCode(`/api/campaigns/:id/spend-sources/google-sheets-duplicates${action ? "/" + action : ""}`)}`;
      new Function(...Object.keys(deps), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(deps));
      const req = { params: { id: campaignId }, body };
      const res: any = { statusCode: 200, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; } };
      await guard(req, res, () => handler(req, res)); return res;
    };
    return { call, recompute, recalc, access };
  }
  it("persists complete imports, exact selections, edits and refreshes with reconciled source totals", async () => {
    await seed("foreign", { campaignId: "b" }, "99.00");
    const f = fixture([["Date", "Spend", "Campaign"], ...Array.from({ length: 5001 }, () => [date, "1.25", "A"]), [date, "bad", "B"]], "EUR", storage.replaceSpendSourceWithRecords.bind(storage));
    const selection = { campaignColumn: "Campaign", campaignValue: "A" };
    expect((await f.invoke("process", selection)).body.spendToDate).toBe(6251.25);
    f.setData([["Date", "Spend", "Campaign"], [date, "15.25", "A"], [date, "1000", "B"]]);
    expect((await f.invoke("process", { ...selection, sourceId: f.saved.id })).body.spendToDate).toBe(15.25);
    expect((await f.refresh()).success).toBe(true);
    expect((await pool.query("SELECT spend,currency,spend_source_id FROM spend_records WHERE campaign_id='a'")).rows).toEqual([{ spend: "15.25", currency: "EUR", spend_source_id: f.saved.id }]);
    expect(await storage.getSpendTotalForRange("a", "1900-01-01", "2999-12-31", "ga4")).toMatchObject({ totalSpend: 15.25, currency: "EUR" });
    expect(await storage.getSpendBreakdownBySource("a", "1900-01-01", "2999-12-31", "ga4")).toEqual([expect.objectContaining({ sourceId: f.saved.id, spend: 15.25 })]);
    expect((await pool.query("SELECT spend FROM spend_records WHERE campaign_id='b'")).rows).toEqual([{ spend: "99.00" }]);
  });
  it("keeps actual saved rows and source metadata on rejected edits and scheduler failures, then recovers", async () => {
    const f = fixture([["Date", "Spend"], [date, "20"]], "EUR", storage.replaceSpendSourceWithRecords.bind(storage));
    expect((await f.invoke()).statusCode).toBe(200); const before = await snapshot();
    for (const data of [[["Date", "Spend"], [date, "bad"]], [["Date", "Spend"], [date, ""]], [["Date", "Spend", "Spend"], [date, "10", "99"]]]) {
      f.setData(data); expect((await f.invoke("process", { sourceId: f.saved.id })).statusCode).toBe(400); expect((await f.refresh()).success).toBe(false); expect(await snapshot()).toEqual(before);
    }
    f.setData([["Date", "Spend"], [date, "20"]], 50001); expect((await f.refresh()).success).toBe(false); expect(await snapshot()).toEqual(before);
    f.setData([["Date", "Spend"], [date, "0"]]); expect((await f.refresh()).success).toBe(true);
    expect((await pool.query("SELECT spend FROM spend_records")).rows).toEqual([{ spend: "0.00" }]);
  });
  it("requires inspection and confirmation, removes only identical scoped records, and purges only inspected empty inactive matches", async () => {
    await seed("keep"); await seed("remove", { createdAt: new Date("2026-10-02") });
    await seed("linkedin", { platformContext: "linkedin" }); await seed("usd", { currency: "USD" }); await seed("foreign", { campaignId: "b" });
    const f = cleanupFixture(), before = await snapshot();
    const inspected = await f.call(); expect(await snapshot()).toEqual(before); expect(inspected.body.duplicateGroupCount).toBe(1);
    expect((await f.call("cleanup", { confirm: true })).statusCode).toBe(400);
    expect((await f.call("cleanup", { inspectionToken: inspected.body.inspectionToken })).statusCode).toBe(400);
    expect(await snapshot()).toEqual(before);
    const cleaned = await f.call("cleanup", { confirm: true, inspectionToken: inspected.body.inspectionToken });
    expect(cleaned.statusCode, cleaned.body.error).toBe(200); expect(cleaned.body.deactivatedSourceIds).toEqual(["remove"]);
    expect(f.recompute).toHaveBeenCalledWith("a", "Spend Update"); expect(f.recalc).toHaveBeenCalledWith("a");
    expect((await snapshot()).records.map((r: any) => r.spend_source_id)).toEqual(["foreign", "keep", "linkedin", "usd"]);
    expect((await f.call("purge-inactive", { confirm: true, inspectionToken: inspected.body.inspectionToken })).statusCode).toBe(409);
    const again = await f.call(); expect(again.body.inactiveDuplicateCandidates).toEqual(["remove"]);
    expect((await f.call("purge-inactive", { confirm: true, inspectionToken: again.body.inspectionToken })).body.purgedSourceIds).toEqual(["remove"]);
    expect((await snapshot()).sources.map((s: any) => s.id)).toEqual(["foreign", "keep", "linkedin", "usd"]);
    expect(f.recalc).toHaveBeenCalledTimes(1);
  });
  it("skips different records, incomplete mappings, currency conflicts and inactive sources with records", async () => {
    await seed("a"); await seed("b", {}, "11.00"); await seed("inactive", { isActive: false });
    await seed("invalid-a", { mappingConfig: "{}" }); await seed("invalid-b", { mappingConfig: "{}" });
    await seed("conflict-a", { mappingConfig: JSON.stringify({ ...JSON.parse(mapping), currency: "USD" }) });
    await seed("conflict-b", { mappingConfig: JSON.stringify({ ...JSON.parse(mapping), currency: "USD" }) });
    const f = cleanupFixture(), before = await snapshot(), inspection = await f.call();
    expect(inspection.body.inactiveDuplicateCandidates).toEqual([]);
    expect((await f.call("cleanup", { confirm: true, inspectionToken: inspection.body.inspectionToken })).body.deactivatedSourceIds).toEqual([]);
    expect((await f.call("purge-inactive", { confirm: true, inspectionToken: inspection.body.inspectionToken })).body.purgedSourceIds).toEqual([]);
    expect(await snapshot()).toEqual(before); expect(f.recompute).not.toHaveBeenCalled();
  });
  it("fails closed on lost access, a stale inspection, and a changed source between route validation and the transaction", async () => {
    await seed("a"); await seed("b"); const f = cleanupFixture(), before = await snapshot(), inspection = await f.call();
    f.access.mockImplementationOnce((_req, res, _next) => res.status(403).json({ error: "Denied" }));
    expect((await f.call("cleanup", { confirm: true, inspectionToken: inspection.body.inspectionToken })).statusCode).toBe(403); expect(await snapshot()).toEqual(before);
    await pool.query("UPDATE spend_sources SET display_name='changed' WHERE id='b'");
    expect((await f.call("cleanup", { confirm: true, inspectionToken: inspection.body.inspectionToken })).statusCode).toBe(409);
    const next = await f.call(), original = storage.cleanupGoogleSheetsSpendDuplicates.bind(storage);
    const spy = vi.spyOn(storage, "cleanupGoogleSheetsSpendDuplicates").mockImplementationOnce(async (...args: any[]) => {
      await pool.query("UPDATE spend_records SET spend='99' WHERE spend_source_id='b'"); return original(...args);
    });
    try { expect((await f.call("cleanup", { confirm: true, inspectionToken: next.body.inspectionToken })).statusCode).toBe(409); }
    finally { spy.mockRestore(); }
    expect((await snapshot()).sources.every((s: any) => s.is_active)).toBe(true); expect(f.recompute).not.toHaveBeenCalled();
  });
  it("rolls back every source and record when any cleanup deletion fails", async () => {
    await seed("a"); await seed("b"); await seed("c"); const f = cleanupFixture(), before = await snapshot(), inspection = await f.call();
    await pool.query("CREATE FUNCTION fail_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.spend_source_id='c' THEN RAISE EXCEPTION 'isolated failure'; END IF; RETURN OLD; END $$");
    await pool.query("CREATE TRIGGER fail_cleanup BEFORE DELETE ON spend_records FOR EACH ROW EXECUTE FUNCTION fail_cleanup()");
    try {
      expect((await f.call("cleanup", { confirm: true, inspectionToken: inspection.body.inspectionToken })).statusCode).toBe(500);
      expect(await snapshot()).toEqual(before); expect(f.recalc).not.toHaveBeenCalled();
    } finally { await pool.query("DROP TRIGGER fail_cleanup ON spend_records"); await pool.query("DROP FUNCTION fail_cleanup()"); }
    expect((await storage.getSpendTotalForRange("a", "1900-01-01", "2999-12-31", "ga4")).totalSpend).toBe(30);
    expect((await f.call("cleanup", { confirm: true, inspectionToken: inspection.body.inspectionToken })).body.deactivatedCount).toBe(2);
    expect((await storage.getSpendTotalForRange("a", "1900-01-01", "2999-12-31", "ga4")).totalSpend).toBe(10);
    expect((await storage.getSpendBreakdownBySource("a", "1900-01-01", "2999-12-31", "ga4"))).toEqual([expect.objectContaining({ sourceId: "a", spend: 10 })]);
  });
  it("protects against cross-campaign child corruption and a purge that gains records", async () => {
    await seed("a"); await seed("b");
    await pool.query("UPDATE spend_records SET campaign_id='b' WHERE spend_source_id='b'");
    const f = cleanupFixture(), inspected = await f.call();
    expect((await f.call("cleanup", { confirm: true, inspectionToken: inspected.body.inspectionToken })).body.deactivatedSourceIds).toEqual([]);
    const state = await storage.getGoogleSheetsSpendCleanupState("a");
    await expect(storage.cleanupGoogleSheetsSpendDuplicates("a", state, ["b"], "deactivate")).rejects.toMatchObject({ code: "SPEND_SOURCE_CHANGED" });
    await seed("inactive", { isActive: false }, null); const expected = await storage.getGoogleSheetsSpendCleanupState("a");
    await db.insert(schema.spendRecords).values({ campaignId: "a", spendSourceId: "inactive", date, spend: "7", currency: "EUR" });
    await expect(storage.cleanupGoogleSheetsSpendDuplicates("a", expected, ["inactive"], "purge")).rejects.toMatchObject({ code: "SPEND_SOURCE_CHANGED" });
    expect((await snapshot()).sources.find((s: any) => s.id === "inactive")).toBeDefined();
  });
  it("waits for an in-flight legacy child insert and rejects its changed state atomically", async () => {
    await seed("a"); await seed("inactive", { isActive: false }, null);
    const expected = await storage.getGoogleSheetsSpendCleanupState("a"), writer = await pool.connect();
    await writer.query("BEGIN");
    await writer.query("INSERT INTO spend_records(campaign_id,spend_source_id,date,spend,currency) VALUES('a','inactive',$1,7,'EUR')", [date]);
    const result = storage.cleanupGoogleSheetsSpendDuplicates("a", expected, ["inactive"], "purge").then(() => null, (e: any) => e);
    try {
      let waiting = false;
      for (let i = 0; i < 40 && !waiting; i++) {
        waiting = (await pool.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE relation='spend_records'::regclass AND NOT granted) AS waiting")).rows[0].waiting;
        if (!waiting) await new Promise(resolve => setTimeout(resolve, 25));
      }
      expect(waiting).toBe(true); await writer.query("COMMIT");
      expect(await result).toMatchObject({ code: "SPEND_SOURCE_CHANGED" });
      expect((await snapshot()).sources.find((s: any) => s.id === "inactive")).toBeDefined();
    } finally { await writer.query("ROLLBACK"); writer.release(); await result; }
  });
  it("bounds waiting on a busy campaign and preserves all rows", async () => {
    await seed("a"); await seed("b"); const expected = await storage.getGoogleSheetsSpendCleanupState("a"), before = await snapshot(), writer = await pool.connect();
    await writer.query("BEGIN"); await writer.query("SELECT id FROM campaigns WHERE id='a' FOR UPDATE");
    try {
      const error = await storage.cleanupGoogleSheetsSpendDuplicates("a", expected, ["b"], "deactivate").catch((e: any) => e);
      expect(error.code || error.cause?.code).toBe("55P03"); expect(await snapshot()).toEqual(before);
    } finally { await writer.query("ROLLBACK"); writer.release(); }
  });
});
