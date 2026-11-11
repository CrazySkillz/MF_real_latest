import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableColumns, getTableName, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import ts from "typescript";
import * as schema from "../shared/schema";
import { getLatestCompleteReportingDate } from "./utils/reporting-timezone";
import { z } from "zod";
import * as sfQuery from "./utils/salesforce-query";
import * as sfCurrency from "./utils/salesforceCurrency";
import * as hubCurrency from "./utils/hubspot-currency";
import * as hubPagination from "./utils/hubspot-pagination";
import * as csv from "./utils/csv";

const database = vi.hoisted(() => ({ current: null as any }));
vi.mock("./db", () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from "./storage";

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "").trim();
if (testUrl) {
  const url = new URL(testUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1"
    || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) throw new Error("Local fixture database required");
}
const schemaName = `ga4_revenue_publication_it_${randomUUID().replace(/-/g, "")}`;
const tables = [schema.campaigns, schema.ga4Connections, schema.metricSnapshots, schema.revenueSources, schema.revenueRecords,
  schema.spendSources, schema.spendRecords, schema.hubspotConnections, schema.salesforceConnections, schema.shopifyConnections,
  schema.googleSheetsConnections, schema.linkedinConnections, schema.metaConnections, schema.instagramConnections,
  schema.tiktokConnections, schema.googleAdsConnections, schema.ga4GoogleAdsSpendConnections];
const storage = new DatabaseStorage();
const day = getLatestCompleteReportingDate("Europe/Amsterdam");
const nextDay = new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10);
const families = ["hubspot", "salesforce", "shopify", "google_sheets", "csv", "manual", "custom"] as const;
let admin: Pool, pool: Pool, created = false;
const rows = (amount = "250.00", date = "2026-09-30") => [{ campaignId: "a", date, currency: "EUR", revenue: amount, externalId: "sale-1" }];
function csvImportHandler(kind: "revenue" | "spend") {
  const source = readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("routes-oauth.ts", source, ts.ScriptTarget.Latest, true);
  let registration = "", handler: any;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "app.post" && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === `/api/campaigns/:id/${kind}/csv/process`) registration = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); if (!registration) throw new Error("CSV route missing");
  const dependencies: any = {
    ...csv, Buffer, createHash, storage, z,
    app: { post: (_path: string, ...callbacks: any[]) => { handler = callbacks.at(-1); } },
    importRateLimiter: () => {}, requireCampaignAccessParamId: () => {}, uploadCsv: { single: () => () => {} }, uploadRevenueCsv: () => {},
    MAX_CSV_ROWS_PREVIEW: 50_000, MAX_CSV_ROWS_PROCESS: 50_000, countLinesUpTo: (text: string) => text.split("\n").length,
    isSupportedScopedSpendPlatformContext: (context: string) => ["ga4", "linkedin"].includes(context),
    spendSourceMatchesPlatformContext: (value: any, context: string) => value.platformContext === context,
    parseCsvRevenuePlatformContext: (value: string, fallback: string) => value || fallback,
    zRevenueMapping: { safeParse: (data: any) => ({ success: true, data }) },
    normalizeOverviewInventoryConfigValue: (value: any) => value, inFlightGa4CsvRevenueAdds: new Set(),
    sendBadRequest: (res: any, error: string) => res.status(400).json({ success: false, error }),
    parseNum: (value: unknown) => Number.parseFloat(String(value).replace(/[$,]/g, "")),
    getReportingDateWindow: () => ({ endDate: day }), yesterdayUTC: () => day, googleAdsCampaignIdFromValueOrMapping: () => null,
    recalcCampaignSpend: vi.fn(), recomputeGA4SpendBeforeResponse: vi.fn(), recomputeCampaignDerivedValues: vi.fn(), devLog: () => {},
  };
  const importHelpers = source.slice(source.indexOf("  const replayGa4FinancialImport ="), source.indexOf("  const inFlightGa4CsvRevenueAdds ="));
  new Function(...Object.keys(dependencies), ts.transpileModule(importHelpers + registration, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(dependencies));
  return async (requestId?: string, options: { campaignId?: string; sourceId?: string; amount?: string } = {}) => {
    const campaignId = options.campaignId || "a";
    const column = kind === "revenue" ? "Revenue" : "Spend";
    const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
    await handler({ params: { id: campaignId }, headers: { "x-import-request-id": requestId }, _campaign: await storage.getCampaign(campaignId),
      body: { platformContext: "ga4", mapping: JSON.stringify({ [kind === "revenue" ? "revenueColumn" : "spendColumn"]: column, dateColumn: "Date", platformContext: "ga4", currency: "EUR", ...(options.sourceId ? { sourceId: options.sourceId } : {}) }) },
      file: { buffer: Buffer.from(`Date,${column}\n2026-09-30,${options.amount ?? "250"}`), originalname: "fixture.csv" } }, res);
    return res;
  };
}
function financialReplayHandler(kind: "revenue" | "spend", sourceType: string) {
  const source = readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("routes-oauth.ts", source, ts.ScriptTarget.Latest, true);
  const endpoint = sourceType === "ad_platforms" ? "spend/process/manual" : sourceType === "google_sheets" ? `${kind}/sheets/process` : `${sourceType}/save-mappings`;
  let registration = "", handler: any;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "app.post" && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === `/api/campaigns/:id/${endpoint}`) registration = node.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); if (!registration) throw new Error("Financial route missing");
  const access = vi.fn(async (req: any, res: any) => req.denied ? (res.status(403).json({ error: "Denied" }), null) : storage.getCampaign("a"));
  const dependencies: any = { storage, z, randomUUID, createHash, ...sfQuery,
    app: { post: (_path: string, ...callbacks: any[]) => { handler = callbacks.at(-1); } },
    ensureCampaignAccess: access, requireCampaignAccessParamId: () => {}, importRateLimiter: () => {}, googleSheetsRateLimiter: () => {},
    zSelectedValues: z.array(z.string()), zNumberLike: z.number(), zValueSource: z.enum(["revenue", "conversion_value"]),
    zSheetsRevenuePlatformContext: z.string(), zSalesforceRevenuePlatformContext: z.string(), zHubSpotRevenuePlatformContext: z.string(), zShopifyRevenuePlatformContext: z.string(),
    zRevenueMapping: z.object({ revenueColumn: z.string() }).passthrough(),
    parseNum: (value: unknown) => Number(value || 0),
    spendSourceTypeForPlatformContext: (_context: string, type: string) => type || "manual",
    getInternalGA4RefreshWriteInput: () => ({}), assertProductionTokenEncryptionConfigured: () => {}, isInternalAutoRefreshRequest: () => false,
    isSupportedScopedSpendPlatformContext: (v: string) => ["ga4", "linkedin"].includes(v),
    sendBadRequest: (res: any, error: string) => res.status(400).json({ error }), inFlightGoogleSheetsRevenueAdds: new Set(),
    console: { error: () => {} },
  };
  const helpers = source.slice(source.indexOf("  const replayGa4FinancialImport ="), source.indexOf("  const inFlightGa4CsvRevenueAdds ="));
  new Function(...Object.keys(dependencies), ts.transpileModule(helpers + registration, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(dependencies));
  return async (id: string, overrides: any = {}) => {
    const req: any = { params: { id: "a" }, headers: { "x-import-request-id": id }, body: { platformContext: "ga4", connectionId: "fixture",
      mapping: { revenueColumn: "Revenue", spendColumn: "Spend" }, campaignField: "Campaign", campaignProperty: "campaign", selectedValues: ["sale"],
      sourceType: "ad_platforms", mappingConfig: { platform: "google_ads" }, ...overrides } };
    const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
    await handler(req, res); return { ...res, request: req };
  };
}
async function save(kind: typeof families[number], id: string | null = null, records = rows(), options: any = {}, sourceOverrides: any = {}) {
  const source = { campaignId: "a", sourceType: kind, platformContext: "ga4", currency: "EUR", mappingConfig: "{}", ...sourceOverrides };
  if (kind === "hubspot") return storage.replaceGa4HubspotRevenueSourceWithRecords("a", id, "hubspot-a", "{}", source, records, undefined, options);
  if (kind === "salesforce") return storage.replaceGa4SalesforceRevenueSourceWithRecords("a", id, "salesforce-a", "{}", source, records, undefined, options);
  if (kind === "shopify") return storage.replaceGa4ShopifyRevenueSourceWithRecords("a", id, "shopify-a", "{}", source, records, undefined, options);
  if (kind === "csv") return storage.replaceGa4CsvRevenueSourceWithRecords("a", id, source, records);
  return storage.replaceRevenueSourceWithRecords("a", id, kind, "ga4", source, records, undefined, options);
}
async function claim() {
  const work = (await storage.getRecoverableGA4RefreshWork()).find(work => work.campaignId === "a")!;
  expect(work?.scope).toMatchObject({ kind: "revenue_change" });
  const claimed = (await storage.claimGA4RefreshWork("a", "owner-a", work.id, 120_000))!;
  return { campaignId: "a", ownerId: "owner-a", reportingDate: day, work: { id: claimed.id, leaseToken: claimed.leaseToken! } };
}
async function publish(scope: Awaited<ReturnType<typeof claim>>, complete = true, includeDisplay = false) {
  const revenuePublication = await storage.getGA4RevenuePublication("a", day);
  if (includeDisplay) revenuePublication.display = { nativeRevenue: 7653.96, sources:
    (await storage.getRevenueBreakdownBySource("a", "1900-01-01", day)).map(row => ({ ...row, mappingConfig: {} })) };
  const total = await storage.getRevenueTotalForRange("a", "1900-01-01", day);
  const snapshot = { version: "financial_daily_snapshot_v1" as const, campaignId: "a", reportingDate: day, currency: "EUR",
    currentValueWindow: { mode: "initial_import_to_latest_completed_day" as const, startDate: "2026-09-04", endDate: day,
      dataThroughDate: day, reportingTimeZone: "Europe/Amsterdam" },
    inputs: { revenue: { value: (7653.96 + total.totalRevenue).toFixed(2), available: true as const, sources: ["ga4", ...total.sourceIds.map(id => `revenue-source:${id}`)] },
      spend: { value: null, available: false as const, sources: [] as never[] }, conversions: { value: 2, available: true as const, sources: ["ga4"] } },
    revenuePublication, refreshScope: scope };
  await storage.upsertFinancialDailySnapshot(snapshot);
  if (complete) {
    const notes = `ga4_refresh_publication_v1:${scope.work.id}:${createHash("sha256").update(scope.work.leaseToken).digest("hex")}`;
    const updated = await pool.query("UPDATE metric_snapshots SET notes=$1 WHERE campaign_id='a' AND reporting_date=$2 AND snapshot_type='executive_summary_daily'", [notes, day]);
    if (!updated.rowCount) await database.current.insert(schema.metricSnapshots).values({ campaignId: "a", reportingDate: day, snapshotType: "executive_summary_daily", notes });
    expect(await storage.updateGA4RefreshWorkLease("a", "owner-a", scope.work.id, scope.work.leaseToken, "complete", 120_000, new Date().toISOString())).toBeDefined();
  }
  return snapshot;
}
async function sourceResponse(reportingDate = day) {
  const source = readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8");
  const start = source.indexOf('app.get("/api/campaigns/:id/revenue-sources"');
  const end = source.indexOf("// Unified data-sources endpoint", start);
  let handler: any;
  new Function("app", "storage", "ensureCampaignAccess", "parseRevenueReadPlatformContext", "getReportingDateWindow", "getShopifyRevenueSourceFreshness",
    ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(
    { get: (_path: string, callback: any) => { handler = callback; } }, storage, async () => storage.getCampaign("a"),
    () => "ga4", () => ({ endDate: reportingDate }), () => null);
  const res: any = { setHeader() {}, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; } };
  await handler({ params: { id: "a" }, query: {} }, res);
  expect(res.code, JSON.stringify(res.body)).toBeUndefined(); return res.body;
}

// Actual proxy GET handlers and storage; only access/provider responses are controlled.
async function pipelineResponse(provider: "hubspot" | "salesforce", context = "ga4", failProvider = false) {
  const source = readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8");
  const start = source.indexOf(`app.get("/api/${provider}/:campaignId/pipeline-proxy"`);
  const end = source.indexOf(provider === "hubspot" ? 'app.delete("/api/hubspot/:campaignId/pipeline-proxy"' : '// HubSpot deals properties', start);
  let handler: any;
  const providerRead = vi.fn(async () => { if (failProvider) throw new Error("provider unavailable"); });
  const dependencies = {
    app: { get: (_path: string, fn: any) => { handler = fn; } }, storage,
    ensureCampaignAccess: async () => true, getGA4CampaignFilterValues: () => ["sale"],
    zSalesforceRevenuePlatformContext: z.enum(["ga4", "linkedin"]),
    ...sfQuery, ...sfCurrency, ...hubCurrency, ...hubPagination, MAX_HUBSPOT_RESULTS: 10000,
    getHubspotAccessTokenForCampaign: async () => ({ accessToken: "fake" }),
    getSalesforceAccessTokenForCampaign: async () => ({ accessToken: "fake", instanceUrl: "https://example.invalid", fetchImpl: vi.fn() }),
    hubspotSearchDeals: async () => { await providerRead(); return { results: [{ id: "pipeline-deal", properties: { Campaign: "sale", amount: "3200", deal_currency_code: "EUR" } }] }; },
    fetchCompleteSalesforceQuery: async () => { await providerRead(); return [{ Id: "pipeline-opportunity", Campaign: "sale", Amount: "3200", CurrencyIsoCode: "EUR" }]; },
  };
  const amountHelper = source.slice(source.indexOf("  function parseCrmRevenueAmount("), source.indexOf("  async function hubspotSearchDeals("));
  const platformHelper = source.slice(source.indexOf("  const isGA4RevenuePlatformContext ="), source.indexOf("  const recomputeGA4KPIAndBenchmarkValues ="));
  new Function(...Object.keys(dependencies), ts.transpileModule(amountHelper + platformHelper + source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(dependencies));
  const res: any = { code: 200, setHeader() {}, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; } };
  await handler({ params: { campaignId: "a" }, query: { platformContext: context } }, res);
  return { ...res, providerRead };
}

// Actual delete handler and storage transaction. Authentication and the asynchronous recovery kick are controlled.
async function deleteResponse(sourceId: string, options: { campaignId?: string; platform?: string; authorized?: boolean } = {}) {
  const source = readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8");
  const start = source.indexOf('app.delete("/api/campaigns/:id/revenue-sources/:sourceId",');
  const end = source.indexOf("// Individual spend source delete", start);
  let handler: any; const recompute = vi.fn();
  new Function("app", "storage", "ensureCampaignAccess", "parsePlatformContext", "revenuePurposeForPlatformContext", "recomputeCampaignDerivedValues",
    ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(
    { delete: (_path: string, callback: any) => { handler = callback; } }, storage,
    async (_req: any, res: any) => options.authorized === false ? (res.status(403).json({ success: false }), false) : true,
    (value: string) => value, (value: string) => value === "ga4" ? "revenue" : `${value}_revenue`, recompute);
  const res: any = { code: 200, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; } };
  await handler({ params: { id: options.campaignId ?? "a", sourceId }, query: { platformContext: options.platform ?? "ga4" } }, res);
  return { ...res, recompute };
}

describe.skipIf(!testUrl)("sale-date eligibility and durable revenue publication with real PostgreSQL", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 2 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, application_name: schemaName, max: 8 });
    database.current = drizzle(pool, { schema });
    const dialect = new PgDialect();
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map((column: any) => {
        const value = column.default;
        const defaultSql = value instanceof SQL ? dialect.sqlToQuery(value).sql : typeof value === "string" ? `'${value.replace(/'/g, "''")}'` : String(value);
        return `"${column.name}" ${column.getSQLType()}${column.notNull ? " NOT NULL" : ""}${value !== undefined ? ` DEFAULT ${defaultSql}` : ""}${column.primary ? " PRIMARY KEY" : ""}`;
      });
      await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(", ")})`);
    }
    await pool.query("CREATE UNIQUE INDEX financial_identity ON metric_snapshots (campaign_id,reporting_date) WHERE snapshot_type='financial_daily' AND reporting_date IS NOT NULL");
    for (const file of ["0020_add_ga4_refresh_work.sql", "0021_add_ga4_refresh_recovery.sql"]) await pool.query(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`); await admin?.end(); });
  beforeEach(async () => {
    await pool.query("DELETE FROM ga4_refresh_work");
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    for (const id of ["a", "b"]) {
      await database.current.insert(schema.campaigns).values({ id, name: id, ownerId: `owner-${id}`, status: "active", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: "sale" });
      await database.current.insert(schema.ga4Connections).values({ id: `ga4-${id}`, campaignId: id, propertyId: "123", method: "access_token", isPrimary: true, importStartDate: "2026-09-04" });
      for (const kind of ["hubspot", "salesforce", "shopify"] as const) await database.current.insert(schema[`${kind}Connections`]).values({ id: `${kind}-${id}`, campaignId: id,
        ...(kind === "shopify" ? { shopDomain: `${id}.myshopify.com` } : {}), mappingConfig: "{}" });
    }
  });
  it.each(families)("includes an older %s sale from a new source, excluding today's and future sales", async kind => {
    const source = await save(kind, null, [...rows(), ...rows("100.00", nextDay), ...rows("200.00", "2999-01-01")]);
    expect(new Date(source.createdAt).getTime()).toBeGreaterThan(Date.parse(day));
    expect(await storage.getRevenueTotalForRange("a", "1900-01-01", day)).toMatchObject({ totalRevenue: 250, currency: "EUR", sourceIds: [source.id] });
    expect(await storage.getRevenueBreakdownBySource("a", "1900-01-01", day)).toMatchObject([{ sourceId: source.id, revenue: 250 }]);
    const pending = await storage.getRecoverableGA4RefreshWork();
    expect(pending).toHaveLength(1); expect(pending[0]).toMatchObject({ campaignId: "a", reportingDate: day, status: "pending" });
    expect((await storage.getGA4RevenuePublicationStatus("a", day))[source.id].status).toBe("pending");
    expect((await storage.getRevenueTotalForRange("a", "1900-01-01", nextDay)).totalRevenue).toBe(350);
  });
  it.each(["revenue", "spend"] as const)("does not add a second CSV %s source when the saved import response is lost and retried", async kind => {
    const invoke = csvImportHandler(kind), requestId = randomUUID();
    const first = await invoke(requestId); // Commit happened, but its HTTP response did not reach the browser.
    const retry = await invoke(requestId);
    expect(first.statusCode, first.body?.error).toBe(200);
    expect(retry.statusCode, retry.body?.error).toBe(200);
    expect(retry.body.sourceId).toBe(first.body.sourceId);
    const sources = kind === "revenue" ? await storage.getRevenueSources("a", "ga4") : await storage.getSpendSources("a", "ga4");
    expect(sources).toHaveLength(1);
    const total = kind === "revenue" ? (await storage.getRevenueTotalForRange("a", "1900-01-01", day)).totalRevenue : (await storage.getSpendTotalForRange("a", "1900-01-01", day, "ga4")).totalSpend;
    expect(total).toBe(250);
  });
  it.each([
    ["revenue", "google_sheets"], ["revenue", "hubspot"], ["revenue", "salesforce"], ["revenue", "shopify"],
    ["spend", "google_sheets"], ["spend", "ad_platforms"],
  ] as const)("acknowledges a committed %s %s source through its actual route without contacting a provider", async (kind, family) => {
    const id = randomUUID();
    const persist = () => kind === "revenue" ? save(family as typeof families[number], null, rows(), {}, { id })
      : storage.replaceSpendSourceWithRecords("a", null, family, "ga4", { id, campaignId: "a", sourceType: family, platformContext: "ga4", currency: "EUR", mappingConfig: "{}" }, [{ campaignId: "a", date: "2026-09-30", spend: "250.00", currency: "EUR", sourceType: family }]);
    await persist();
    // A concurrent second transaction cannot alter records, connection mappings or publication work.
    const workBefore = await storage.getRecoverableGA4RefreshWork();
    await expect(persist()).rejects.toThrow();
    expect(await storage.getRecoverableGA4RefreshWork()).toEqual(workBefore);
    const replay = await financialReplayHandler(kind, family)(id);
    expect(replay.statusCode, JSON.stringify(replay.body)).toBe(200);
    expect(replay.body).toEqual({ success: true, alreadySaved: true, sourceId: id });
    const total = kind === "revenue" ? (await storage.getRevenueTotalForRange("a", "1900-01-01", day)).totalRevenue : (await storage.getSpendTotalForRange("a", "1900-01-01", day, "ga4")).totalSpend;
    expect(total).toBe(250);
    expect(await storage.getRecoverableGA4RefreshWork()).toEqual(workBefore);
  });
  it.each(["revenue", "spend"] as const)("keeps separate intended CSV %s imports additive, including headerless retained callers", async kind => {
    const invoke = csvImportHandler(kind);
    for (const id of [randomUUID(), randomUUID(), undefined, undefined]) expect((await invoke(id)).statusCode).toBe(200);
    const sources = kind === "revenue" ? await storage.getRevenueSources("a", "ga4") : await storage.getSpendSources("a", "ga4");
    expect(sources).toHaveLength(4);
    const total = kind === "revenue" ? (await storage.getRevenueTotalForRange("a", "1900-01-01", day)).totalRevenue : (await storage.getSpendTotalForRange("a", "1900-01-01", day, "ga4")).totalSpend;
    expect(total).toBe(1000);
  });
  it.each(["revenue", "spend"] as const)("protects CSV %s creation against simultaneous retries", async kind => {
    const invoke = csvImportHandler(kind), id = randomUUID();
    const attempts = await Promise.all([invoke(id), invoke(id)]);
    expect(attempts.some(result => result.statusCode === 200)).toBe(true);
    expect(attempts.every(result => [200, 409].includes(result.statusCode))).toBe(true);
    expect((await invoke(id)).body).toMatchObject({ alreadySaved: true, sourceId: id });
    const sources = kind === "revenue" ? await storage.getRevenueSources("a", "ga4") : await storage.getSpendSources("a", "ga4");
    expect(sources.map(source => source.id)).toEqual([id]);
  });
  it.each(["revenue", "spend"] as const)("does not overwrite a later CSV %s edit when an old create request is retried", async kind => {
    const invoke = csvImportHandler(kind), id = randomUUID();
    expect((await invoke(id)).statusCode).toBe(200);
    expect((await invoke(undefined, { sourceId: id, amount: "400" })).statusCode).toBe(200);
    expect((await invoke(id)).body).toMatchObject({ alreadySaved: true, sourceId: id });
    const total = kind === "revenue" ? (await storage.getRevenueTotalForRange("a", "1900-01-01", day)).totalRevenue : (await storage.getSpendTotalForRange("a", "1900-01-01", day, "ga4")).totalSpend;
    expect(total).toBe(400);
  });
  it.each(["revenue", "spend"] as const)("cannot restore deleted CSV %s or reuse another campaign's request identity", async kind => {
    const invoke = csvImportHandler(kind), id = randomUUID();
    await invoke(id);
    const foreign = await invoke(id, { campaignId: "b" });
    expect(foreign.statusCode).toBe(409); expect(foreign.body.sourceId).toBeUndefined();
    const other = kind === "revenue" ? await storage.getRevenueSources("b", "ga4") : await storage.getSpendSources("b", "ga4");
    expect(other).toHaveLength(0);
    if (kind === "revenue") await storage.deleteRevenueSourceWithRecords("a", id, "ga4");
    else await storage.deleteSpendSourceWithRecords("a", id, "ga4");
    const retired = await invoke(id);
    expect(retired.statusCode).toBe(409); expect(retired.body.code).toBe("FINANCIAL_IMPORT_RETIRED");
    const active = kind === "revenue" ? await storage.getRevenueSources("a", "ga4") : await storage.getSpendSources("a", "ga4");
    expect(active).toHaveLength(0);
  });
  it.each(["revenue", "spend"] as const)("rejects malformed CSV %s request identities and can retry a validation failure safely", async kind => {
    const invoke = csvImportHandler(kind), id = randomUUID();
    expect((await invoke("not-a-uuid")).statusCode).toBe(400);
    expect((await invoke(id, { amount: "invalid" })).statusCode).not.toBe(200);
    const active = kind === "revenue" ? await storage.getRevenueSources("a", "ga4") : await storage.getSpendSources("a", "ga4");
    expect(active).toHaveLength(0);
    const valid = await invoke(id);
    expect(valid.statusCode).toBe(200); expect(valid.body.sourceId).toBe(id);
  });
  it.each(families)("publishes %s old-sale edits and does not requeue identical provider data", async kind => {
    const source = await save(kind); const scope = await claim();
    await publish(scope);
    expect((await storage.getLatestFinancialDailySnapshot("a", day))?.metrics).toMatchObject({ financialDaily: { inputs: { revenue: { value: "7903.96" } } } });
    expect((await storage.getGA4RevenuePublicationStatus("a", day))[source.id].status).toBe("published");
    const before = await storage.getGA4RevenuePublication("a", day);
    const notesBefore = (await pool.query("SELECT notes FROM metric_snapshots WHERE campaign_id='a' AND snapshot_type='executive_summary_daily'")).rows;
    await save(kind, source.id);
    expect(await storage.getGA4RevenuePublication("a", day)).toEqual(before);
    expect(await storage.getRecoverableGA4RefreshWork()).toHaveLength(0);
    expect((await storage.getGA4RevenuePublicationStatus("a", day))[source.id].status).toBe("published");
    expect((await pool.query("SELECT notes FROM metric_snapshots WHERE campaign_id='a' AND snapshot_type='executive_summary_daily'")).rows).toEqual(notesBefore);
    await save(kind, source.id, rows("300.00"));
    expect((await storage.getGA4RevenuePublicationStatus("a", day))[source.id].status).toBe("pending");
    expect(await storage.getRecoverableGA4RefreshWork()).toHaveLength(1);
  });
  it.each(["hubspot", "salesforce"] as const)("recovers report readiness after %s connection invalidation with unchanged revenue", async kind => {
    const source = await save(kind); await publish(await claim());
    const before = await storage.getGA4RevenuePublication("a", day);
    const beforeOther = await storage.getGA4RevenuePublication("b", day);
    if (kind === "hubspot") await storage.updateHubspotConnection("hubspot-a", { clientId: "changed-client" });
    else await storage.updateSalesforceConnection("salesforce-a", { clientId: "changed-client" });
    expect((await pool.query("SELECT notes FROM metric_snapshots WHERE campaign_id='a' AND snapshot_type='executive_summary_daily'")).rows[0].notes).toBeNull();
    await save(kind, source.id);
    expect(await storage.getGA4RevenuePublication("a", day)).toEqual(before);
    expect(await storage.getGA4RevenuePublication("b", day)).toEqual(beforeOther);
    const queued = await storage.getRecoverableGA4RefreshWork();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ campaignId: "a", reportingDate: day, scope: { kind: "revenue_change" } });
    await publish(await claim());
    expect((await pool.query("SELECT notes FROM metric_snapshots WHERE campaign_id='a' AND snapshot_type='executive_summary_daily'")).rows[0].notes).toContain(`ga4_aligned_refresh_v1:${day}:`);
    await save(kind, source.id);
    expect(await storage.getRecoverableGA4RefreshWork()).toHaveLength(0);
    expect((await storage.getLatestFinancialDailySnapshot("a", day))?.metrics).toMatchObject({ financialDaily: { inputs: { revenue: { value: "7903.96" } } } });
  });
  it.each(families)("queues %s unchanged revenue when existing report readiness is missing", async kind => {
    const source = await save(kind); await publish(await claim());
    const before = await storage.getGA4RevenuePublication("a", day);
    await pool.query("UPDATE metric_snapshots SET notes=NULL WHERE campaign_id='a' AND snapshot_type='executive_summary_daily'");
    await save(kind, source.id);
    expect(await storage.getGA4RevenuePublication("a", day)).toEqual(before);
    expect(await storage.getRecoverableGA4RefreshWork()).toMatchObject([{ campaignId: "a", scope: { kind: "revenue_change" } }]);
    expect((await storage.getLatestFinancialDailySnapshot("a", day))?.metrics).toMatchObject({ financialDaily: { inputs: { revenue: { value: "7903.96" } } } });
  });
  it.each(["missing", "wrong_date", "invalid_time", "future_time", "unfinished"])("does not accept %s report readiness for unchanged revenue", async state => {
    const source = await save("hubspot"); await publish(await claim());
    if (state === "missing") await pool.query("DELETE FROM metric_snapshots WHERE campaign_id='a' AND snapshot_type='executive_summary_daily'");
    else {
      const notes = state === "wrong_date" ? `ga4_aligned_refresh_v1:2000-01-01:${new Date().toISOString()}`
        : state === "invalid_time" ? `ga4_aligned_refresh_v1:${day}:invalid`
        : state === "future_time" ? `ga4_aligned_refresh_v1:${day}:2999-01-01T00:00:00Z`
        : "ga4_refresh_publication_v1:unfinished:receipt";
      await pool.query("UPDATE metric_snapshots SET notes=$1 WHERE campaign_id='a' AND snapshot_type='executive_summary_daily'", [notes]);
    }
    await save("hubspot", source.id);
    expect(await storage.getRecoverableGA4RefreshWork()).toHaveLength(1);
    expect((await storage.getRevenueTotalForRange("a", "1900-01-01", day)).totalRevenue).toBe(250);
  });
  it.each((["hubspot", "salesforce"] as const).flatMap(provider => ["ga4", null].flatMap(context => [false, true].map(failProvider => ({ provider, context, failProvider })))))
  ("preserves published report readiness for $provider Pipeline Proxy (context=$context, provider failure=$failProvider)", async ({ provider, context, failProvider }) => {
    const source = await save(provider);
    const config = { platformContext: "ga4", selectedValues: ["sale"], campaignProperty: "Campaign", campaignField: "Campaign",
      revenueProperty: "amount", revenueField: "Amount", pipelineEnabled: true, pipelineStageId: "contractsent", pipelineStageName: "Contract Sent",
      pipelineStageLabel: "Contract Sent", campaignValueRevenueTotals: [{ campaignValue: "sale", revenue: 250 }] };
    await storage.updateRevenueSource(source.id, { platformContext: context, mappingConfig: JSON.stringify(config) });
    await publish(await claim());
    const before = await pool.query("SELECT notes FROM metric_snapshots WHERE campaign_id='a' AND snapshot_type='executive_summary_daily'");
    expect(before.rows[0].notes).toContain("ga4_aligned_refresh_v1:");
    const response = await pipelineResponse(provider, "ga4", failProvider);
    expect(response.providerRead).toHaveBeenCalledTimes(1);
    if (failProvider) {
      expect(response.code).toBe(provider === "hubspot" ? 503 : 500);
      expect((await storage.getRevenueSource("a", source.id))!.mappingConfig).toBe(JSON.stringify(config));
    } else {
      expect(response.code, JSON.stringify(response.body)).toBe(200); expect(response.body).toMatchObject({ success: true, totalToDate: 3200, currency: "EUR", sourceId: source.id });
      expect(JSON.parse((await storage.getRevenueSource("a", source.id))!.mappingConfig!).pipelineTotalToDate).toBe(3200);
      const cached = await pipelineResponse(provider);
      expect(cached.body.totalToDate).toBe(3200); expect(cached.providerRead).not.toHaveBeenCalled();
    }
    expect((await pool.query(`SELECT mapping_config FROM ${provider}_connections WHERE id=$1`, [`${provider}-a`])).rows[0].mapping_config).toBe("{}");
    expect((await storage.getRevenueTotalForRange("a", "1900-01-01", day, "ga4")).totalRevenue).toBe(250);
    expect((await storage.getLatestFinancialDailySnapshot("a", day))?.metrics).toMatchObject({ financialDaily: { inputs: { revenue: { value: "7903.96" } } } });
    expect(await storage.getRecoverableGA4RefreshWork()).toHaveLength(0);
    expect((await pool.query("SELECT notes FROM metric_snapshots WHERE campaign_id='a' AND snapshot_type='executive_summary_daily'")).rows).toEqual(before.rows);
  });
  it.each(["hubspot", "salesforce"] as const)("retains %s connection-cache updates for the existing LinkedIn path", async provider => {
    const source = await save(provider);
    const config = { platformContext: "linkedin", selectedValues: ["sale"], campaignProperty: "Campaign", campaignField: "Campaign",
      revenueProperty: "amount", revenueField: "Amount", pipelineEnabled: true, pipelineStageId: "contractsent", pipelineStageName: "Contract Sent",
      pipelineStageLabel: "Contract Sent", campaignValueRevenueTotals: [{ campaignValue: "sale", revenue: 250 }] };
    await storage.updateRevenueSource(source.id, { platformContext: "linkedin", mappingConfig: JSON.stringify(config) });
    const response = await pipelineResponse(provider, "linkedin");
    expect(response.code, JSON.stringify(response.body)).toBe(200); expect(response.body.totalToDate).toBe(3200);
    const connection = (await pool.query(`SELECT mapping_config FROM ${provider}_connections WHERE id=$1`, [`${provider}-a`])).rows[0];
    expect(JSON.parse(connection.mapping_config).pipelineTotalToDate).toBe(3200);
    expect(JSON.parse((await storage.getRevenueSource("a", source.id))!.mappingConfig!).pipelineTotalToDate).toBe(3200);
  });
  it("retains the published source breakdown while a saved edit changes the live records", async () => {
    const source = await save("google_sheets");
    await publish(await claim(), true, true);
    const before = await storage.getLatestFinancialDailySnapshot("a", day);
    expect((before!.metrics as any).revenuePublication.display).toMatchObject({ nativeRevenue: 7653.96,
      sources: [{ sourceId: source.id, revenue: 250 }] });
    await save("google_sheets", source.id, rows("31000.00"));
    const retained = await storage.getLatestFinancialDailySnapshot("a", day);
    expect(retained!.metrics).toEqual(before!.metrics);
    expect((await storage.getRevenueBreakdownBySource("a", "1900-01-01", day))[0].revenue).toBe(31000);
    expect((await sourceResponse()).sources[0].publicationStatus).toBe("pending");
    await publish(await claim(), true, true);
    const updated = await storage.getLatestFinancialDailySnapshot("a", day);
    expect((updated!.metrics as any).financialDaily.inputs.revenue.value).toBe("38653.96");
    expect((updated!.metrics as any).revenuePublication.display.sources[0].revenue).toBe(31000);
  });

  it("does not clear pending merely because a financial snapshot was written before the coordinated job finished", async () => {
    const source = await save("hubspot"); const scope = await claim();
    await publish(scope, false);
    expect((await storage.getGA4RevenuePublicationStatus("a", day))[source.id].status).toBe("pending");
    await storage.updateGA4RefreshWorkLease("a", "owner-a", scope.work.id, scope.work.leaseToken, "release", 120_000, undefined, { retryable: true, code: "fixture_report_failure" });
    expect((await storage.getGA4RevenuePublicationStatus("a", day))[source.id].status).toBe("failed");
    expect((await storage.getRevenueTotalForRange("a", "1900-01-01", day)).totalRevenue).toBe(250);
  });
  it("reports saved, included and failed states through the actual Revenue Sources endpoint", async () => {
    const source = await save("hubspot");
    expect((await sourceResponse()).sources[0]).toMatchObject({ id: source.id, lastTotalRevenue: 250, completedDayRevenue: 250,
      pendingCompletedDay: false, publicationStatus: "pending", publicationHash: expect.any(String) });
    await publish(await claim());
    expect((await sourceResponse()).sources[0].publicationStatus).toBe("published");
    await save("hubspot", source.id, rows("300.00")); const scope = await claim();
    await storage.updateGA4RefreshWorkLease("a", "owner-a", scope.work.id, scope.work.leaseToken, "release", 120_000, undefined, { retryable: false, code: "fixture_processing_failure" });
    expect((await sourceResponse()).sources[0]).toMatchObject({ lastTotalRevenue: 300, publicationStatus: "failed" });
  });
  it("distinguishes an already eligible portion from today's still-pending sales in the source endpoint", async () => {
    await save("csv", null, [...rows(), ...rows("100.00", nextDay)]);
    expect((await sourceResponse()).sources[0]).toMatchObject({ lastTotalRevenue: 350, completedDayRevenue: 250,
      completedDayEndDate: day, pendingCompletedDay: true, publicationStatus: "pending" });
  });
  it("keeps unchanged published sources included after midnight without publishing new work", async () => {
    await save("hubspot", null, rows("0.00"));
    await save("salesforce", null, rows("0.00"));
    await save("shopify", null, rows("785.95", "2026-09-28"));
    await publish(await claim());
    const before = await pool.query("SELECT * FROM metric_snapshots ORDER BY id");
    const workBefore = await pool.query("SELECT * FROM ga4_refresh_work ORDER BY id");
    const response = await sourceResponse(nextDay);
    expect(response.sources).toHaveLength(3);
    expect(response.sources.every((source: any) => source.publicationStatus === "published")).toBe(true);
    expect(response.sources.find((source: any) => source.sourceType === "shopify")).toMatchObject({
      completedDayEndDate: nextDay, lastTotalRevenue: 785.95, completedDayRevenue: 785.95, pendingCompletedDay: false,
    });
    expect((await pool.query("SELECT * FROM metric_snapshots ORDER BY id")).rows).toEqual(before.rows);
    expect((await pool.query("SELECT * FROM ga4_refresh_work ORDER BY id")).rows).toEqual(workBefore.rows);
    expect(await storage.getGA4RevenuePublicationStatus("b", nextDay)).toEqual({});
  });
  it("keeps newly eligible sales pending after midnight while unchanged neighbors remain included", async () => {
    const unchanged = await save("hubspot", null, rows("0.00"));
    const source = await save("shopify", null, [...rows("785.95", "2026-09-28"), ...rows("10.00", nextDay)]);
    await publish(await claim());
    const status = await storage.getGA4RevenuePublicationStatus("a", nextDay);
    expect(status[unchanged.id].status).toBe("published");
    expect(status[source.id].status).toBe("pending");
  });
  it("rejects a receipt whose date disagrees with its saved snapshot after midnight", async () => {
    const source = await save("shopify"); await publish(await claim());
    await pool.query("UPDATE metric_snapshots SET metrics=jsonb_set(metrics, '{revenuePublication,reportingDate}', '\"2000-01-01\"') WHERE campaign_id='a' AND snapshot_type='financial_daily'");
    expect((await storage.getGA4RevenuePublicationStatus("a", nextDay))[source.id].status).toBe("pending");
  });
  it("rejects a stale worker after a second edit and keeps exactly one recoverable job", async () => {
    const source = await save("csv"); const scope = await claim();
    const snapshot = await publish(scope, false);
    await save("csv", source.id, rows("300.00"));
    await expect(storage.upsertFinancialDailySnapshot(snapshot)).rejects.toThrow(/GA4_REFRESH/);
    const work = await new DatabaseStorage().getRecoverableGA4RefreshWork();
    expect(work).toHaveLength(1); expect(work[0].id).not.toBe(scope.work.id);
    expect((await storage.getRevenueTotalForRange("a", "1900-01-01", day)).totalRevenue).toBe(300);
  });
  it("rejects a mismatched source receipt even when the current worker owns publication", async () => {
    const source = await save("csv"); const scope = await claim(); const snapshot = await publish(scope, false);
    snapshot.revenuePublication.sources[source.id] = "stale-amount";
    await expect(storage.upsertFinancialDailySnapshot(snapshot)).rejects.toThrow("GA4_REFRESH_PUBLICATION_CHANGED");
  });
  it("rolls back source rows and queue together if persistence fails", async () => {
    const source = await save("csv"); const before = await storage.getGA4RevenuePublication("a", day);
    const work = await storage.getRecoverableGA4RefreshWork();
    await expect(save("csv", source.id, rows("invalid"))).rejects.toThrow();
    expect(await storage.getGA4RevenuePublication("a", day)).toEqual(before);
    expect((await storage.getRecoverableGA4RefreshWork()).map(item => item.id)).toEqual(work.map(item => item.id));
  });
  it.each(["hubspot", "salesforce"] as const)("rejects a %s pipeline change during current-day publication without altering the last good financial snapshot", async kind => {
    const source = await save(kind); const scope = await claim(); const prior = await publish(scope, false);
    vi.stubEnv("GA4_INCLUDE_CURRENT_DAY", "true");
    try {
      const snapshot = { ...prior, currentValueWindow: { ...prior.currentValueWindow, mode: "initial_import_to_latest_available_day" as const },
        revenuePublication: await storage.getGA4RevenuePublication("a", day) };
      expect(Object.keys(snapshot.revenuePublication.pipelineSources || {})).toEqual([source.id]);
      await storage.upsertFinancialDailySnapshot(snapshot);
      const before = await storage.getLatestFinancialDailySnapshot("a", day);
      await pool.query("UPDATE revenue_sources SET mapping_config=$1 WHERE id=$2", [JSON.stringify({ pipelineEnabled: true, pipelineTotalToDate: 200 }), source.id]);
      await expect(storage.upsertFinancialDailySnapshot(snapshot)).rejects.toThrow("GA4_REFRESH_PUBLICATION_CHANGED");
      expect(await storage.getLatestFinancialDailySnapshot("a", day)).toEqual(before);
      snapshot.revenuePublication = await storage.getGA4RevenuePublication("a", day);
      await expect(storage.upsertFinancialDailySnapshot(snapshot)).resolves.toBeDefined();
      expect(await storage.getLatestFinancialDailySnapshot("b", day)).toBeNull();
    } finally { vi.unstubAllEnvs(); }
  });
  it("preserves pending work on rename and replaces it only after an analytics input changes", async () => {
    await save("csv"); const previous = (await storage.getRecoverableGA4RefreshWork())[0];
    await storage.updateCampaign("a", { name: "Updated campaign" });
    expect((await storage.getRecoverableGA4RefreshWork()).map(work => work.id)).toEqual([previous.id]);
    await storage.updateCampaign("a", { ga4CampaignFilter: JSON.stringify(["updated-filter"]) });
    const pending = await storage.getRecoverableGA4RefreshWork();
    expect(pending).toHaveLength(1); expect(pending[0].id).not.toBe(previous.id);
    expect(pending[0].scope).toMatchObject({ kind: "revenue_change" });
  });
  it("rolls back an import when durable processing is disabled", async () => {
    vi.stubEnv("GA4_DURABLE_RECOVERY_ENABLED", "false");
    try {
      await expect(save("csv")).rejects.toThrow("GA4_REVENUE_PUBLICATION_UNAVAILABLE");
      expect(await storage.getRevenueSources("a")).toEqual([]);
      expect(await storage.getRecoverableGA4RefreshWork()).toEqual([]);
    } finally { vi.unstubAllEnvs(); }
  });
  it("supports GA4 revenue publication on a multi-platform campaign without widening ordinary recovery", async () => {
    await database.current.insert(schema.linkedinConnections).values({ id: "linkedin-a", campaignId: "a", adAccountId: "test-account", method: "oauth" });
    expect(await storage.isGA4NativeRecoveryEligible("a", { includeFinancialSources: true })).toBe(false);
    expect(await storage.isGA4NativeRecoveryEligible("a", { includeFinancialSources: true, revenueChange: true })).toBe(true);
    expect(await storage.isGA4NativeRecoveryEligible("b", { includeFinancialSources: true })).toBe(true);
  });
  it("queues source deletion and preserves other campaigns and platforms", async () => {
    const source = await save("csv"); await publish(await claim());
    for (const [id, campaignId, platformContext] of [["foreign", "b", "ga4"], ["linkedin", "a", "linkedin"]]) {
      await database.current.insert(schema.revenueSources).values({ id, campaignId, platformContext, sourceType: "csv", currency: "EUR" });
      await database.current.insert(schema.revenueRecords).values({ campaignId, revenueSourceId: id, date: "2026-09-30", revenue: "900", currency: "EUR" });
    }
    expect(await storage.deleteRevenueSourceWithRecords("b", source.id, "ga4")).toBe(false);
    expect(await storage.deleteRevenueSourceWithRecords("a", source.id, "linkedin")).toBe(false);
    expect(await storage.deleteRevenueSourceWithRecords("a", source.id, "ga4")).toBe(true);
    expect(await storage.getRecoverableGA4RefreshWork()).toHaveLength(1);
    expect((await storage.getRevenueTotalForRange("a", "1900-01-01", day)).totalRevenue).toBe(0);
    expect((await storage.getRevenueTotalForRange("b", "1900-01-01", day)).totalRevenue).toBe(900);
    expect((await storage.getRevenueTotalForRange("a", "1900-01-01", day, "linkedin")).totalRevenue).toBe(900);
  });
  it.each(families)("deletes %s through the real route, publishes the lower total and prevents stale restoration", async kind => {
    const source = await save(kind);
    const neighbor = await save("csv", null, rows("100.00"));
    for (const [id, campaignId, platformContext] of [["foreign", "b", "ga4"], ["linkedin", "a", "linkedin"]]) {
      await database.current.insert(schema.revenueSources).values({ id, campaignId, platformContext, sourceType: kind, currency: "EUR" });
      await database.current.insert(schema.revenueRecords).values({ campaignId, revenueSourceId: id, date: "2026-09-30", revenue: "900", currency: "EUR" });
    }
    expect((await publish(await claim())).inputs.revenue.value).toBe("8003.96");
    for (const options of [{ authorized: false }, { campaignId: "b" }, { platform: "linkedin" }]) {
      const rejected = await deleteResponse(source.id, options);
      expect(rejected.code).toBe(options.authorized === false ? 403 : 404);
      expect(rejected.recompute).not.toHaveBeenCalled();
    }
    const removed = await deleteResponse(source.id);
    expect(removed.body).toEqual({ success: true, revenueTrackingDisabled: false });
    expect(removed.recompute).toHaveBeenCalledExactlyOnceWith("a", { platformContext: "ga4" });
    const jobs = await storage.getRecoverableGA4RefreshWork();
    expect(jobs).toHaveLength(1);
    expect((await sourceResponse()).sources.map((item: any) => item.id)).toEqual([neighbor.id]);
    expect((await deleteResponse(source.id)).code).toBe(404);
    await expect(save(kind, source.id)).rejects.toThrow();
    expect((await publish(await claim())).inputs.revenue.value).toBe("7753.96");
    expect((await storage.getRevenueTotalForRange("b", "1900-01-01", day)).totalRevenue).toBe(900);
    expect((await storage.getRevenueTotalForRange("a", "1900-01-01", day, "linkedin")).totalRevenue).toBe(900);
    expect((await pool.query("SELECT count(*)::int AS n FROM revenue_records WHERE revenue_source_id=$1", [source.id])).rows[0].n).toBe(0);
    expect(await storage.getRecoverableGA4RefreshWork()).toEqual([]);
  });
  it.each(families)("removes the final %s source while retaining native GA4 and unrelated sheet connections", async kind => {
    const source = await save(kind);
    for (const [id, campaignId, purpose] of [["own", "a", "revenue"], ["spend", "a", "spend"], ["platform", "a", "linkedin_revenue"], ["foreign", "b", "revenue"]]) {
      await database.current.insert(schema.googleSheetsConnections).values({ id, campaignId, purpose, spreadsheetId: id, method: "oauth", isActive: true });
    }
    expect((await deleteResponse(source.id)).body).toEqual({ success: true, revenueTrackingDisabled: true });
    expect((await publish(await claim())).inputs.revenue.value).toBe("7653.96");
    expect((await pool.query("SELECT id FROM google_sheets_connections WHERE is_active=true ORDER BY id")).rows.map(row => row.id)).toEqual(["foreign", "platform", "spend"]);
    expect((await sourceResponse()).sources).toEqual([]);
  });
  for (const kind of ["hubspot", "salesforce"] as const) {
    it.each([false, true])(`${kind} deletion preserves the remaining pipeline owner and OAuth connection (other owner: %s)`, async otherOwner => {
      const source = await save(kind);
      const config = { platformContext: "ga4", selectedValues: ["removed"], pipelineEnabled: true, pipelineStageId: "open", pipelineStageName: "Open", pipelineTotalToDate: 3200 };
      await pool.query("UPDATE revenue_sources SET mapping_config=$1 WHERE id=$2", [JSON.stringify(config), source.id]);
      await pool.query(`UPDATE ${kind}_connections SET mapping_config=$1 WHERE id=$2`, [JSON.stringify(config), `${kind}-a`]);
      const retained = { ...config, platformContext: "linkedin", selectedValues: ["retained"], pipelineTotalToDate: 500 };
      if (otherOwner) await database.current.insert(schema.revenueSources).values({ id: "other-owner", campaignId: "a", sourceType: kind, platformContext: "linkedin", currency: "EUR", mappingConfig: JSON.stringify(retained) });
      const foreignBefore = (await pool.query(`SELECT * FROM ${kind}_connections WHERE campaign_id='b'`)).rows;
      const response = await deleteResponse(source.id);
      expect(response.code).toBe(200);
      const connection: any = kind === "hubspot" ? await storage.getHubspotConnection("a") : await storage.getSalesforceConnection("a");
      expect(connection.isActive).toBe(true);
      expect(JSON.parse(connection.mappingConfig)).toMatchObject(otherOwner ? retained : { pipelineEnabled: false, pipelineTotalToDate: 0 });
      if (otherOwner) expect(JSON.parse((await storage.getRevenueSource("a", "other-owner"))!.mappingConfig!)).toEqual(retained);
      expect((await pool.query(`SELECT * FROM ${kind}_connections WHERE campaign_id='b'`)).rows).toEqual(foreignBefore);
      expect((await publish(await claim())).inputs.revenue.value).toBe("7653.96");
    });
  }
  it.each(families)("rejects an in-flight publication after %s deletion", async kind => {
    const source = await save(kind); const stale = await claim();
    const oldSnapshot = await publish(stale, false);
    expect((await deleteResponse(source.id)).code).toBe(200);
    await expect(storage.upsertFinancialDailySnapshot(oldSnapshot)).rejects.toThrow(/GA4_REFRESH/);
    expect((await storage.getRecoverableGA4RefreshWork()).map(item => item.id)).not.toContain(stale.work.id);
    expect((await publish(await claim())).inputs.revenue.value).toBe("7653.96");
  });
  it.each(families)("rolls back a failed %s delete without changing records, totals or publication work", async kind => {
    const source = await save(kind); await publish(await claim());
    const before = await storage.getGA4RevenuePublication("a", day);
    await pool.query("CREATE FUNCTION reject_revenue_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture deletion failure'; END $$");
    await pool.query("CREATE TRIGGER reject_revenue_delete BEFORE DELETE ON revenue_records FOR EACH ROW EXECUTE FUNCTION reject_revenue_delete()");
    try {
      const response = await deleteResponse(source.id);
      expect(response.code).toBe(500); expect(response.recompute).not.toHaveBeenCalled();
      expect(await storage.getGA4RevenuePublication("a", day)).toEqual(before);
      expect((await sourceResponse()).sources.map((item: any) => item.id)).toEqual([source.id]);
      expect((await storage.getRevenueTotalForRange("a", "1900-01-01", day)).totalRevenue).toBe(250);
      expect(await storage.getRecoverableGA4RefreshWork()).toEqual([]);
    } finally {
      await pool.query("DROP TRIGGER reject_revenue_delete ON revenue_records");
      await pool.query("DROP FUNCTION reject_revenue_delete()");
    }
  });
  it("publishes 8003.96 after removing only the 785.95 Shopify source", async () => {
    const hubspot = await save("hubspot", null, rows("250.00"));
    const salesforce = await save("salesforce", null, rows("100.00", "2026-09-02"));
    const shopify = await save("shopify", null, rows("785.95", "2026-09-28"));
    expect((await publish(await claim())).inputs.revenue.value).toBe("8789.91");
    expect(await storage.deleteRevenueSourceWithRecords("a", shopify.id, "ga4")).toBe(true);
    const scope = await claim();
    const snapshot = await publish(scope, false);
    // Reuse the existing executive row, as the real daily upsert does, instead of the fixture's insert-only helper.
    await pool.query("UPDATE metric_snapshots SET notes=$1 WHERE campaign_id=$2 AND reporting_date=$3 AND snapshot_type='executive_summary_daily'",
      [`ga4_refresh_publication_v1:${scope.work.id}:${createHash("sha256").update(scope.work.leaseToken).digest("hex")}`, "a", day]);
    expect(await storage.updateGA4RefreshWorkLease("a", "owner-a", scope.work.id, scope.work.leaseToken, "complete", 120_000, new Date().toISOString())).toBeDefined();
    expect(snapshot.inputs.revenue.value).toBe("8003.96");
    expect(Object.keys(snapshot.revenuePublication.sources).sort()).toEqual([hubspot.id, salesforce.id].sort());
    expect((await storage.getRevenueSources("a", "ga4")).map(source => source.id).sort()).toEqual([hubspot.id, salesforce.id].sort());
    expect((await pool.query("SELECT count(*)::int AS n FROM revenue_records WHERE campaign_id=$1 AND revenue_source_id=$2", ["a", shopify.id])).rows[0].n).toBe(0);
    expect(await storage.getRecoverableGA4RefreshWork()).toEqual([]);
  });
  it("keeps zero available and rejects missing materialization and mixed currency", async () => {
    const source = await save("csv", null, rows("0.00"));
    expect((await storage.getRevenueTotalForRange("a", "1900-01-01", day)).totalRevenue).toBe(0);
    await pool.query("UPDATE revenue_records SET currency='USD' WHERE revenue_source_id=$1", [source.id]);
    await expect(storage.getRevenueTotalForRange("a", "1900-01-01", day)).rejects.toThrow(/currency/);
    await pool.query("DELETE FROM revenue_records WHERE revenue_source_id=$1", [source.id]);
    await expect(storage.getRevenueTotalForRange("a", "1900-01-01", day)).rejects.toThrow(/materialized/);
  });
  it("keeps today's revenue pending after a successful zero-eligible publication", async () => {
    const source = await save("csv", null, rows("250.00", nextDay)); await publish(await claim());
    expect((await storage.getRevenueTotalForRange("a", "1900-01-01", day)).totalRevenue).toBe(0);
    expect((await storage.getGA4RevenuePublicationStatus("a", day))[source.id].status).toBe("pending");
  });
  it("includes past-dated Spend from a new source but excludes today and future records", async () => {
    await database.current.insert(schema.spendSources).values({ id: "spend", campaignId: "a", sourceType: "csv", platformContext: "ga4", currency: "EUR" });
    await database.current.insert(schema.spendRecords).values([
      { campaignId: "a", spendSourceId: "spend", date: "2026-09-30", spend: "99.00", currency: "EUR" },
      { campaignId: "a", spendSourceId: "spend", date: nextDay, spend: "200.00", currency: "EUR" },
      { campaignId: "a", spendSourceId: "spend", date: "2999-12-31", spend: "300.00", currency: "EUR" },
    ]);
    expect(await storage.getSpendTotalForRange("a", "1900-01-01", day, "ga4")).toEqual({ totalSpend: 99, currency: "EUR", sourceIds: ["spend"] });
  });
  it.each(["csv", "google_sheets", "ad_platforms"])("queues publication after %s Spend is saved beside an unchanged published Revenue source", async sourceType => {
    await save("csv");
    await publish(await claim());
    const source = { campaignId: "a", sourceType, platformContext: "ga4" as const, currency: "EUR", mappingConfig: "{}" };
    const records = [{ campaignId: "a", date: day, spend: "20.00", currency: "EUR", sourceType }];
    if (sourceType === "csv") await storage.replaceCsvSpendSourceWithRecords("a", null, source, records);
    else await storage.replaceSpendSourceWithRecords("a", null, sourceType, "ga4", source, records);
    expect((await storage.getSpendTotalForRange("a", day, day, "ga4")).totalSpend).toBe(20);
    // The source commit must carry recoverable publication work; a UI response or
    // a later scheduled provider refresh cannot be required to repair the card.
    expect((await storage.getRecoverableGA4RefreshWork()).filter(work => work.campaignId === "a")).toHaveLength(1);
    expect((await storage.getRecoverableGA4RefreshWork()).some(work => work.campaignId === "b")).toBe(false);
  });
  it.each(["csv", "google_sheets", "ad_platforms"])("publishes %s Spend edits/deletion and rejects a late pre-edit worker", async sourceType => {
    const source = { campaignId: "a", sourceType, platformContext: "ga4" as const, currency: "EUR", mappingConfig: "{}" };
    const records = (spend: string) => [{ campaignId: "a", date: day, spend, currency: "EUR", sourceType }];
    const replace = (id: string | null, amount: string) => sourceType === "csv"
      ? storage.replaceCsvSpendSourceWithRecords("a", id, source, records(amount))
      : storage.replaceSpendSourceWithRecords("a", id, sourceType, "ga4", source, records(amount));
    const created = await replace(null, "20.00"); const firstWorker = await claim();
    const edited = await replace(created.id, "40.00");
    expect(edited.id).toBe(created.id);
    await expect(publish(firstWorker)).rejects.toThrow();
    expect((await storage.getSpendTotalForRange("a", day, day, "ga4")).totalSpend).toBe(40);
    const secondWorker = await claim(); await publish(secondWorker);
    expect(await storage.deleteSpendSourceWithRecords("a", created.id, "ga4")).toBe(true);
    expect(await storage.deleteSpendSourceWithRecords("a", created.id, "ga4")).toBe(false);
    await expect(publish(secondWorker)).rejects.toThrow();
    expect((await storage.getSpendTotalForRange("a", day, day, "ga4")).sourceIds).toEqual([]);
    expect((await storage.getRecoverableGA4RefreshWork()).filter(work => work.campaignId === "a")).toHaveLength(1);
    await publish(await claim());
    expect(await storage.getRecoverableGA4RefreshWork()).toEqual([]);
  });
  it("rolls back a Spend save when durable publication is disabled", async () => {
    vi.stubEnv("GA4_DURABLE_RECOVERY_ENABLED", "false");
    try {
      await expect(storage.replaceCsvSpendSourceWithRecords("a", null,
        { campaignId: "a", sourceType: "csv", platformContext: "ga4", currency: "EUR" },
        [{ campaignId: "a", date: day, spend: "20.00", currency: "EUR", sourceType: "csv" }])).rejects.toThrow("GA4_REVENUE_PUBLICATION_UNAVAILABLE");
      expect(await storage.getSpendSources("a", "ga4")).toEqual([]);
      expect((await pool.query("SELECT * FROM spend_records")).rows).toEqual([]);
      expect(await storage.getRecoverableGA4RefreshWork()).toEqual([]);
    } finally { vi.unstubAllEnvs(); }
  });
});
