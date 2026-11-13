import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableColumns, getTableName, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";
import ts from "typescript";
import { normalizeFinancialSourceDateKey, isSupportedGa4CsvRevenueAmount, isSupportedGa4CsvRevenueDate, GA4_CSV_MAX_REVENUE_TOTAL } from "./utils/csv";
import { resolveGoogleSheetsRevenueGrid, buildGoogleSheetsRevenueRowRanges } from "./utils/google-sheets-revenue-ranges";
import { getInternalAutoRefreshToken, getInternalGA4RefreshWriteInput, isInternalAutoRefreshRequest } from "./internal-request-auth";
import { z } from "zod";
import * as sfQuery from "./utils/salesforce-query";
import * as sfCurrency from "./utils/salesforceCurrency";
import * as hubCurrency from "./utils/hubspot-currency";
import * as hubPagination from "./utils/hubspot-pagination";
import * as shopRevenue from "./utils/shopify-revenue";
import * as shopRefresh from "./utils/shopify-refresh-state";
import { normalizeStrictUtcDateKey } from "./utils/data-transformation";
import { normalizeReportingTimeZone } from "./utils/reporting-timezone";
import { createHash } from "node:crypto";

const database = vi.hoisted(() => ({ current: null as any }));
vi.mock("./db", () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from "./storage";

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "").trim();
if (testUrl) {
  const url = new URL(testUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1"
    || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) {
    throw new Error("GA4 PostgreSQL tests require 127.0.0.1/ga4_alignment_test and no DATABASE_URL");
  }
}
const schemaName = `ga4_source_it_${randomUUID().replace(/-/g, "")}`;
const financialTables = [schema.spendSources, schema.spendRecords, schema.revenueSources, schema.revenueRecords,
  schema.salesforceConnections, schema.hubspotConnections, schema.shopifyConnections, schema.googleSheetsConnections,
  schema.googleAdsConnections, schema.ga4GoogleAdsSpendConnections, schema.googleAdsDailyMetrics, schema.ga4GoogleAdsSpendDailyMetrics];
const tables = [schema.campaigns, schema.ga4Connections, schema.ga4OverviewSnapshots, schema.metricSnapshots, ...financialTables];
const kinds = ["spend", "spend records", "revenue", "salesforce", "hubspot", "shopify", "shopify state"] as const;
type Kind = typeof kinds[number];
const storage = new DatabaseStorage();
const date = "2026-10-17";
const initialMapping = JSON.stringify({ selected: "old", lastRefreshRunId: "run-1" });
const nextMapping = JSON.stringify({ selected: "old", lastRefreshRunId: "run-1", lastSyncedAt: "2026-10-18T06:00:00Z" });
let admin: Pool, pool: Pool, created = false;
const isSpend = (kind: Kind) => kind.startsWith("spend");
const sourceType = (kind: Kind) => kind === "spend records" ? "ad_platforms" : ["spend", "revenue"].includes(kind) ? "google_sheets" : kind.startsWith("shopify") ? "shopify" : kind;
const sourceId = (kind: Kind, campaign = "a") => `${kind === "shopify state" ? "shopify" : kind}-${campaign}`;
const sourceTable = (kind: Kind) => isSpend(kind) ? "spend_sources" : "revenue_sources";
const expire = (scope: any) => pool.query("UPDATE ga4_refresh_work SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [scope.work.id]);
async function claim(leaseMs = 120_000) {
  const work = (await storage.ensureGA4RefreshWork("a", "owner-a", new Date(Date.now() - 60_000), date))!;
  const claimed = (await storage.claimGA4RefreshWork("a", "owner-a", work.id, leaseMs))!;
  return { campaignId: "a", ownerId: "owner-a", reportingDate: date, work: { id: work.id, leaseToken: claimed.leaseToken! } };
}
async function saved() {
  const result: Record<string, any[]> = {};
  for (const table of financialTables) result[getTableName(table)] = (await pool.query(`SELECT * FROM "${getTableName(table)}" ORDER BY id`)).rows;
  return result;
}
async function write(kind: Kind, options: any = {}, overrides: any = {}) {
  const campaignId = overrides.campaignId ?? "a";
  const id = "sourceId" in overrides ? overrides.sourceId : sourceId(kind, campaignId);
  const expected = "expected" in overrides ? overrides.expected : initialMapping;
  const connectionExpected = "connectionExpected" in overrides ? overrides.connectionExpected : initialMapping;
  const platform = overrides.platform ?? "ga4";
  const source = { campaignId, sourceType: sourceType(kind), platformContext: platform, currency: "EUR", mappingConfig: nextMapping };
  const records = overrides.empty ? [] : [{ campaignId, date, currency: "EUR", [isSpend(kind) ? "spend" : "revenue"]: overrides.amount ?? "20.00" }] as any;
  if (kind === "spend") return storage.replaceSpendSourceWithRecords(campaignId, id, sourceType(kind), platform, source, records, expected, options);
  if (kind === "spend records") return storage.replaceSpendRecordsForSource(campaignId, id, sourceType(kind), platform, records, expected, options);
  if (kind === "revenue") return storage.replaceRevenueSourceWithRecords(campaignId, id, sourceType(kind), platform, source, records, expected, options);
  if (kind === "salesforce") return storage.replaceGa4SalesforceRevenueSourceWithRecords(campaignId, id, `salesforce-${campaignId}`, nextMapping, source, records, expected, { ...options, expectedConnectionMappingConfig: connectionExpected });
  if (kind === "hubspot") return storage.replaceGa4HubspotRevenueSourceWithRecords(campaignId, id, `hubspot-${campaignId}`, nextMapping, source, records, expected, { ...options, expectedConnectionMappingConfig: connectionExpected });
  if (kind === "shopify") return storage.replaceGa4ShopifyRevenueSourceWithRecords(campaignId, id, `shopify-${campaignId}`, nextMapping, source, records, { sourceMappingConfig: expected, connectionMappingConfig: connectionExpected }, options);
  return storage.updateGa4ShopifyRevenueSourceRefreshState(campaignId, id, nextMapping, overrides.runId ?? "run-1", { ...options, expectedSourceMappingConfig: expected });
}

// Execute the actual route body with real storage; only provider/auth harness and downstream jobs are controlled.
function sheetsRoute(beforeResponse?: () => Promise<void>, scope?: any) {
  const source = readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8");
  const start = source.indexOf('app.post("/api/campaigns/:id/spend/sheets/process"');
  const end = source.indexOf("// Salesforce PKCE support", start);
  const helperStart = source.indexOf("const spendSourceMatchesPlatformContext =");
  const helperEnd = source.indexOf("// Keep spend totals predictable", helperStart);
  const scopedStorage = Object.create(storage);
  scopedStorage.getGoogleSheetsConnections = vi.fn().mockResolvedValue([{ id: "sheet-a", spreadsheetId: "sheet", accessToken: "fake-provider-token" }]);
  const fetch = vi.fn(async (url: string) => {
    if (!url.includes("/values/")) return { ok: true, json: async () => ({ sheets: [{ properties: { title: "Spend", index: 0, gridProperties: { rowCount: 3 } } }] }) };
    await beforeResponse?.(); return { ok: true, json: async () => ({ values: [["Date", "Spend", "Campaign"], [date, "20", "old"], [date, "99", "new"]] }) };
  });
  const recalc = vi.fn(), recompute = vi.fn(); let handler: any;
  const readerStart = source.indexOf("const readGoogleSheetsRevenueChunks =");
  const readerEnd = source.indexOf("// Request validation helpers", readerStart);
  const names = ["app", "requireCampaignAccessParamId", "storage", "fetchWithTimeout", "isSupportedScopedSpendPlatformContext", "refreshGoogleSheetsToken", "toA1Prefix", "parseNum", "normalizeFinancialSourceDateKey", "getReportingDateWindow", "recalcCampaignSpend", "recomputeGA4SpendBeforeResponse", "getInternalGA4RefreshWriteInput", "resolveGoogleSheetsRevenueGrid", "buildGoogleSheetsRevenueRowRanges", "isSupportedGa4CsvRevenueAmount", "isSupportedGa4CsvRevenueDate", "GA4_CSV_MAX_REVENUE_TOTAL"];
  new Function(...names, ts.transpileModule(source.slice(helperStart, helperEnd) + source.slice(readerStart, readerEnd) + source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(
    { post: (_path: string, _auth: any, fn: any) => { handler = fn; } }, () => {}, scopedStorage, fetch,
    (context: string) => ["ga4", "linkedin"].includes(context), vi.fn(), (value: string) => value, Number,
    normalizeFinancialSourceDateKey, () => ({ endDate: date }), recalc, recompute, getInternalGA4RefreshWriteInput, resolveGoogleSheetsRevenueGrid, buildGoogleSheetsRevenueRowRanges, isSupportedGa4CsvRevenueAmount, isSupportedGa4CsvRevenueDate, GA4_CSV_MAX_REVENUE_TOTAL);
  const body: any = { connectionId: "sheet-a", platformContext: "ga4", mapping: { sourceId: "spend-a", spendColumn: "Spend", dateColumn: "Date", campaignColumn: "Campaign", campaignValues: ["old"], currency: "EUR", platformContext: "ga4" } };
  const invoke = async () => {
    const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(payload: any) { this.body = payload; return this; } };
    await handler({ params: { id: "a" }, body, ...internalRequest(scope) }, res); return res;
  };
  return { invoke, body, fetch, recalc, recompute };
}

function internalRequest(scope?: any) {
  return { socket: { remoteAddress: "127.0.0.1" }, headers: { "x-internal-auto-refresh-token": getInternalAutoRefreshToken(),
    ...(scope ? { "x-internal-ga4-refresh-scope": JSON.stringify(scope) } : {}) } };
}

function salesforceRenewal(fetch: any) {
  const source = readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8");
  const start = source.indexOf("  const salesforceTokenRefreshes =");
  const end = source.indexOf("  async function getSalesforceAccessTokenForCampaign", start);
  const statusStart = source.indexOf('  app.get("/api/salesforce/:campaignId/status"');
  const statusEnd = source.indexOf("  // Salesforce Opportunity fields", statusStart);
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  expect(statusStart).toBeGreaterThan(0); expect(statusEnd).toBeGreaterThan(statusStart);
  let handler: any;
  const refresh = new Function("storage", "fetch", "app", "ensureCampaignAccess", "console", ts.transpileModule(
    source.slice(start, end) + source.slice(statusStart, statusEnd) + "\nreturn refreshSalesforceToken;",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(storage, fetch,
    { get: (_path: string, fn: any) => { handler = fn; } }, async () => true, { log: vi.fn(), error: vi.fn() });
  return { refresh, status: async () => {
    const res: any = { json(payload: any) { this.body = payload; return this; } };
    await handler({ params: { campaignId: "a" } }, res); return res.body;
  } };
}

// Actual save routes and real materialization/ownership transactions; provider reads and auth are fixtures.
function revenueRoute(provider: "salesforce" | "hubspot" | "shopify", scope?: any, beforeResponse?: () => Promise<void>) {
  const source = readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8");
  const start = source.indexOf(`app.post("/api/campaigns/:id/${provider}/save-mappings"`);
  const end = provider === "salesforce" ? source.indexOf('app.get("/api/salesforce/:campaignId/pipeline-proxy"', start)
    : provider === "hubspot" ? source.indexOf("async function refreshGoogleSheetsToken(", start) : source.indexOf("const server = createServer(app)", start);
  const recompute = vi.fn(); let handler: any;
  const providerRead = vi.fn(async () => { await beforeResponse?.(); });
  const dependencies: any = {
    app: { post: (_path: string, _rate: any, _auth: any, fn: any) => { handler = fn; } }, storage, z,
    importRateLimiter: () => {}, requireCampaignAccessParamId: () => {}, ensureCampaignAccess: async () => true,
    sendBadRequest: (res: any, error: any) => res.status(400).json({ error }), getInternalGA4RefreshWriteInput, isInternalAutoRefreshRequest,
    zSelectedValues: z.array(z.string()), zValueSource: z.enum(["revenue", "conversion_value"]), zNumberLike: z.coerce.number(),
    zSalesforceRevenuePlatformContext: z.enum(["ga4", "linkedin"]), zHubSpotRevenuePlatformContext: z.enum(["ga4", "linkedin"]), zShopifyRevenuePlatformContext: z.enum(["ga4", "linkedin"]),
    ...sfQuery, ...sfCurrency, ...hubCurrency, ...hubPagination, ...shopRevenue, ...shopRefresh,
    normalizeStrictUtcDateKey, normalizeReportingTimeZone, randomUUID, createHash,
    yesterdayUTC: () => date, googleAdsCampaignIdFromValueOrMapping: () => null, recomputeCampaignDerivedValues: recompute,
    getSalesforceAccessTokenForCampaign: async () => ({ accessToken: "fake", instanceUrl: "https://example.invalid", fetchImpl: vi.fn() }),
    fetchCompleteSalesforceQuery: async () => { await providerRead(); return [{ Id: "op-1", Campaign: "old", Amount: "20", CurrencyIsoCode: "EUR", CloseDate: date }]; },
    getHubspotAccessTokenForCampaign: async () => ({ accessToken: "fake" }),
    fetch: async () => ({ ok: true, json: async () => ({ results: [{ stages: [{ id: "closedwon", label: "Closed Won", metadata: { isClosed: "true", probability: "1.0" } }] }] }) }),
    fetchWithTimeout: async () => ({ ok: true, json: async () => ({ results: [{ stages: [{ id: "closedwon", label: "Closed Won", metadata: { isClosed: "true", probability: "1.0" } }] }] }) }),
    deriveDefaultClosedWonStageIds: () => ["closedwon"], MAX_HUBSPOT_RESULTS: 10000,
    hubspotSearchDeals: async () => { await providerRead(); return { results: [{ id: "deal-1", properties: { Campaign: "old", amount: "20", hs_currency: "EUR", closedate: date, dealstage: "closedwon" } }] }; },
    assertProductionTokenEncryptionConfigured: () => {}, getShopifyConnectionForCampaign: () => storage.getShopifyConnection("a"),
    getShopifyApiVersion: () => "2026-07", getShopifyConnectionOrderAccess: () => ({ isOauth: false }),
    getShopifyCampaignOrderWindow: () => ({ limited: false, campaignStartAt: "2026-09-04T00:00:00Z" }), getShopifyCampaignWindowStartAt: () => new Date("2026-09-04T00:00:00Z"),
    isShopifyPartnerDevelopmentStore: async () => false,
    shopifyFetchAllOrders: async () => { await providerRead(); return { orders: [{ id: "order-1", tags: "old", test: false, cancelled_at: null, financial_status: "paid", current_total_price: "20.00", currency: "EUR", created_at: `${date}T10:00:00Z` }] }; },
    getShopifyOrderTags: (order: any) => String(order.tags).split(",").map(value => value.trim()), devLog: () => {},
    SHOPIFY_CAMPAIGN_WINDOW_ERROR_CODE: "SHOPIFY_CAMPAIGN_WINDOW_EXCEEDED", SALESFORCE_PAGINATION_ERROR_CODE: "PAGINATION", SALESFORCE_RESULT_LIMIT_ERROR_CODE: "LIMIT",
  };
  const amountHelper = source.slice(source.indexOf("  function parseCrmRevenueAmount("), source.indexOf("  async function hubspotSearchDeals("));
  const importHelpers = source.slice(source.indexOf("  const replayGa4FinancialImport ="), source.indexOf("  const inFlightGa4CsvRevenueAdds ="));
  new Function(...Object.keys(dependencies), ts.transpileModule(amountHelper + importHelpers + source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(dependencies));
  const body: any = { sourceId: `${provider}-a`, platformContext: "ga4", selectedValues: ["old"], days: 90,
    expectedSourceMappingConfig: initialMapping, campaignField: provider === "shopify" ? "tags" : "Campaign", campaignProperty: "Campaign", revenueField: "Amount", revenueProperty: "amount" };
  const headers: Record<string, string> = {};
  return { body, headers, providerRead, recompute, invoke: async () => {
    const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(payload: any) { this.body = payload; return this; } };
    const internal = internalRequest(scope);
    await handler({ params: { id: "a" }, body, ...internal, headers: { ...internal.headers, ...headers } }, res); return res;
  } };
}

describe.skipIf(!testUrl)("financial source saves with real PostgreSQL refresh ownership", () => {
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
    await pool.query(readFileSync(new URL("../migrations/0020_add_ga4_refresh_work.sql", import.meta.url), "utf8"));
    await pool.query(readFileSync(new URL("../migrations/0021_add_ga4_refresh_recovery.sql", import.meta.url), "utf8"));
  });
  afterAll(async () => {
    await pool?.end();
    if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    await admin?.end();
  });
  beforeEach(async () => {
    await pool.query("DELETE FROM ga4_refresh_work");
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    for (const id of ["a", "b"]) {
      await database.current.insert(schema.campaigns).values({ id, name: id, ownerId: `owner-${id}`, clientId: `client-${id}`,
        status: "active", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: "sale" });
      await database.current.insert(schema.ga4Connections).values({ id: `ga4-${id}`, campaignId: id, propertyId: `property-${id}`,
        method: "access_token", isPrimary: true, isActive: true, importStartDate: "2026-09-04" });
      for (const kind of kinds.filter(kind => kind !== "shopify state")) {
        await database.current.insert(isSpend(kind) ? schema.spendSources : schema.revenueSources).values({ id: sourceId(kind, id), campaignId: id,
          sourceType: sourceType(kind), platformContext: "ga4", currency: "EUR", mappingConfig: initialMapping });
        await database.current.insert(isSpend(kind) ? schema.spendRecords : schema.revenueRecords).values({ id: `record-${sourceId(kind, id)}`, campaignId: id, date,
          [isSpend(kind) ? "spendSourceId" : "revenueSourceId"]: sourceId(kind, id), [isSpend(kind) ? "spend" : "revenue"]: "10.00", currency: "EUR", sourceType: sourceType(kind) });
      }
      for (const kind of ["salesforce", "hubspot", "shopify"] as const) {
        await database.current.insert(schema[`${kind}Connections`]).values({ id: `${kind}-${id}`, campaignId: id,
          ...(kind === "shopify" ? { shopDomain: `${id}.myshopify.com` } : {}), mappingConfig: initialMapping });
      }
      await database.current.insert(schema.googleSheetsConnections).values({ id: `sheet-${id}`, campaignId: id, spreadsheetId: "sheet", method: "oauth", isActive: true });
      for (const table of [schema.googleAdsConnections, schema.ga4GoogleAdsSpendConnections]) {
        await database.current.insert(table).values({ id: `ads-${id}`, campaignId: id, customerId: `customer-${id}`, method: "oauth", spendOnly: true });
      }
    }
  });
  it.each(kinds)("keeps the ordinary %s save and response", async kind => {
    const result: any = await write(kind);
    if (kind === "spend records") expect(result).toBeUndefined();
    else expect(result.id).toBe(sourceId(kind));
  });
  for (const provider of ["salesforce", "hubspot", "shopify"] as const) {
    it(`${provider} persists the new request ID, replays a lost response and rejects a deleted request without changing another source`, async () => {
      await storage.deleteRevenueSourceWithRecords("a", `${provider}-a`, "ga4");
      const route = revenueRoute(provider), id = randomUUID();
      delete route.body.sourceId; delete route.body.expectedSourceMappingConfig;
      route.headers["x-import-request-id"] = id;
      const first = await route.invoke(); expect(first.statusCode, JSON.stringify(first.body)).toBe(200);
      expect(await storage.getRevenueSource("a", id)).toMatchObject({ id, sourceType: provider });
      expect((await route.invoke()).body).toEqual({ success: true, alreadySaved: true, sourceId: id });
      expect(route.providerRead).toHaveBeenCalledTimes(1);
      await storage.deleteRevenueSourceWithRecords("a", id, "ga4");
      const other = await storage.createRevenueSource({ campaignId: "a", sourceType: provider, platformContext: "ga4", currency: "EUR", mappingConfig: "{}" });
      await storage.createRevenueRecords([{ campaignId: "a", revenueSourceId: other.id, date, revenue: "567.00", currency: "EUR" }]);
      const before = await saved(), retired = await route.invoke();
      expect(retired.statusCode, JSON.stringify(retired.body)).toBe(409);
      expect(retired.body.code).toBe("FINANCIAL_IMPORT_RETIRED"); expect(await saved()).toEqual(before);
    });
    it(`${provider} keeps one new source across simultaneous import requests`, async () => {
      await storage.deleteRevenueSourceWithRecords("a", `${provider}-a`, "ga4");
      const route = revenueRoute(provider), id = randomUUID();
      delete route.body.sourceId; delete route.body.expectedSourceMappingConfig;
      route.headers["x-import-request-id"] = id;
      const results = await Promise.all([route.invoke(), route.invoke()]);
      expect(results.map(r => ({ code: r.statusCode, error: r.body.error }))).toEqual([{ code: 200, error: undefined }, { code: 200, error: undefined }]);
      const sources = (await storage.getRevenueSources("a", "ga4")).filter(s => s.sourceType === provider);
      expect(sources.map(s => s.id)).toEqual([id]);
      expect((await storage.getRevenueBreakdownBySource("a", "1900-01-01", "2999-01-01", "ga4")).find(s => s.sourceId === id)?.revenue).toBe(20);
    });
  }
  it.each(["hubspot", "shopify"] as const)("preserves %s automatic reuse of an existing source without changing its ID", async provider => {
    await pool.query("UPDATE revenue_sources SET mapping_config=$1 WHERE id=$2", [JSON.stringify({ campaignProperty: "Campaign", selectedValues: ["old"], revenueProperty: "amount", dateField: "closedate", pipelineEnabled: false }), `${provider}-a`]);
    const route = revenueRoute(provider), id = randomUUID();
    delete route.body.sourceId; delete route.body.expectedSourceMappingConfig; route.headers["x-import-request-id"] = id;
    const result = await route.invoke(); expect(result.statusCode, JSON.stringify(result.body)).toBe(200);
    expect(await storage.getRevenueSource("a", `${provider}-a`)).toBeDefined();
    expect(await storage.getRevenueSource("a", id)).toBeUndefined();
    const sources = (await storage.getRevenueSources("a", "ga4")).filter(s => s.sourceType === provider);
    expect(sources.map(s => s.id)).toEqual([`${provider}-a`]);
  });
  for (const provider of ["salesforce", "hubspot"] as const) {
    it.each([false, true])(`${provider} item removal preserves remaining revenue and rejects stale selection (stale: %s)`, async stale => {
      const retainedMapping = { crmValue: "old", linkedinCampaignUrn: "old", linkedinCampaignName: "old" };
      const config = JSON.stringify({ selectedValues: ["old", "removed"], campaignMappings: [retainedMapping, { crmValue: "removed", linkedinCampaignUrn: "removed", linkedinCampaignName: "removed" }] });
      await pool.query("UPDATE revenue_sources SET mapping_config=$1 WHERE id=$2", [config, `${provider}-a`]);
      await database.current.insert(schema.revenueRecords).values({ campaignId: "a", revenueSourceId: `${provider}-a`, date, currency: "EUR", revenue: "40.00", externalId: "removed-sale" });
      const before = await saved();
      const route = revenueRoute(provider);
      route.body.expectedSourceMappingConfig = stale ? initialMapping : config;
      route.body.campaignMappings = [retainedMapping];
      const response = await route.invoke();
      const after = await saved();
      if (stale) {
        expect(response.statusCode).toBe(409); expect(after).toEqual(before); expect(route.recompute).not.toHaveBeenCalled(); return;
      }
      expect(response.statusCode, JSON.stringify(response.body)).toBe(200);
      expect(JSON.parse(after.revenue_sources.find(row => row.id === `${provider}-a`)!.mapping_config)).toMatchObject({ selectedValues: ["old"], campaignMappings: [retainedMapping] });
      expect(after.revenue_records.filter(row => row.revenue_source_id === `${provider}-a`).map(row => row.revenue)).toEqual(["20.00"]);
      expect(route.recompute).toHaveBeenCalledExactlyOnceWith("a", { platformContext: "ga4" });
      for (const table of Object.keys(before)) {
        const other = (row: any) => table === `${provider}_connections` ? row.campaign_id !== "a" : row.id !== `${provider}-a` && row.revenue_source_id !== `${provider}-a`;
        expect(after[table].filter(other)).toEqual(before[table].filter(other));
      }
    });
  }
  for (const provider of ["salesforce", "hubspot"] as const) {
    it.each(["TimeoutError", "AbortError", "SyntaxError"])(`${provider} retains all saved source facts after provider %s`, async name => {
      const before = await saved();
      const error = name === "SyntaxError" ? new SyntaxError("fixture invalid JSON") : new DOMException("fixture interrupted body", name);
      const fixture = revenueRoute(provider, undefined, async () => { throw error; });
      const response = await fixture.invoke();
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(fixture.providerRead).toHaveBeenCalled();
      expect(await saved()).toEqual(before);
      expect(fixture.recompute).not.toHaveBeenCalled();
    });
  }
  it.each(kinds)("accepts the live %s owner and preserves other campaigns", async kind => {
    const scope = await claim(); const before = await saved();
    await write(kind, { refreshScope: scope }); const after = await saved();
    for (const table of Object.keys(before)) expect(after[table].filter(row => row.campaign_id === "b")).toEqual(before[table].filter(row => row.campaign_id === "b"));
    expect(JSON.stringify(after)).not.toContain(scope.work.leaseToken);
    if (kind === "shopify state") expect(after.revenue_records).toEqual(before.revenue_records);
    else expect(after[isSpend(kind) ? "spend_records" : "revenue_records"].filter(row => row[isSpend(kind) ? "spend_source_id" : "revenue_source_id"] === sourceId(kind))
      .map(row => row[isSpend(kind) ? "spend" : "revenue"])).toEqual(["20.00"]);
  });
  it.each(kinds)("rejects a foreign %s source without modifying either campaign", async kind => {
    const scope = await claim(); const before = await saved();
    await expect(write(kind, { refreshScope: scope }, { sourceId: sourceId(kind, "b") })).rejects.toThrow(); expect(await saved()).toEqual(before);
  });
  it.each(["spend", "spend records", "revenue"] as const)("preserves the valid empty-record %s replacement", async kind => {
    const scope = await claim(); await write(kind, { refreshScope: scope }, { empty: true });
    const after = await saved(); expect(after[isSpend(kind) ? "spend_records" : "revenue_records"].filter(row => row[isSpend(kind) ? "spend_source_id" : "revenue_source_id"] === sourceId(kind))).toEqual([]);
    expect(after[sourceTable(kind)].find(row => row.id === sourceId(kind))!.is_active).toBe(true);
  });
  for (const kind of kinds) {
    it.each(["expired", "replaced", "wrong owner", "wrong campaign", "wrong date", "wrong token", "released", "campaign changed"])(`${kind} rejects %s ownership without mutation`, async state => {
      const scope = await claim();
      if (state === "expired" || state === "replaced") await expire(scope);
      if (state === "replaced") await storage.claimGA4RefreshWork("a", "owner-a", scope.work.id, 120_000);
      if (state === "wrong owner") scope.ownerId = "owner-b";
      if (state === "wrong campaign") scope.campaignId = "b";
      if (state === "wrong date") scope.reportingDate = "2026-10-16";
      if (state === "wrong token") scope.work.leaseToken = "stale";
      if (state === "released") await storage.updateGA4RefreshWorkLease("a", "owner-a", scope.work.id, scope.work.leaseToken, "release");
      if (state === "campaign changed") await pool.query("UPDATE campaigns SET ga4_campaign_filter='changed' WHERE id='a'");
      const before = await saved();
      await expect(write(kind, { refreshScope: scope })).rejects.toThrow(/GA4_REFRESH/);
      expect(await saved()).toEqual(before);
    });
    it.each([undefined, null, {}])(`${kind} rejects explicitly malformed ownership %s`, async refreshScope => {
      const before = await saved(); await expect(write(kind, { refreshScope })).rejects.toThrow(/GA4_REFRESH/); expect(await saved()).toEqual(before);
    });
    it.each(["mapping", "inactive", "deleted", "platform", "type"])(`${kind} preserves saved data after a source %s change`, async state => {
      const scope = await claim();
      const table = sourceTable(kind), id = sourceId(kind);
      if (state === "deleted") await pool.query(`DELETE FROM ${table} WHERE id=$1`, [id]);
      else await pool.query(`UPDATE ${table} SET ${state === "mapping" ? "mapping_config='{}'" : state === "inactive" ? "is_active=false" : state === "platform" ? "platform_context='linkedin'" : "source_type='csv'"} WHERE id=$1`, [id]);
      const before = await saved(); await expect(write(kind, { refreshScope: scope })).rejects.toThrow(); expect(await saved()).toEqual(before);
    });
    it(`${kind} requires the pre-fetch source mapping`, async () => {
      const scope = await claim(); const before = await saved();
      await expect(write(kind, { refreshScope: scope }, { expected: undefined })).rejects.toThrow(/GA4_REFRESH/); expect(await saved()).toEqual(before);
    });
    it(`${kind} rolls back every effect when the lease expires inside its write`, async () => {
      const table = kind === "spend records" ? "spend_records" : sourceTable(kind);
      await pool.query("CREATE FUNCTION delay_source_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(1.2); RETURN COALESCE(NEW,OLD); END $$");
      await pool.query(`CREATE TRIGGER delay_source_write BEFORE ${kind === "spend records" ? "DELETE" : "UPDATE"} ON ${table} FOR EACH ROW EXECUTE FUNCTION delay_source_write()`);
      try {
        const scope = await claim(1000); const before = await saved();
        await expect(write(kind, { refreshScope: scope })).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST"); expect(await saved()).toEqual(before);
      } finally { await pool.query(`DROP TRIGGER delay_source_write ON ${table}`); await pool.query("DROP FUNCTION delay_source_write()"); }
    });
  }
  it.each(["salesforce", "hubspot", "shopify"] as const)("rolls back %s source and records if its connection changed", async kind => {
    const scope = await claim(); await pool.query(`UPDATE ${kind}_connections SET mapping_config='{}' WHERE id=$1`, [`${kind}-a`]);
    const before = await saved(); await expect(write(kind, { refreshScope: scope })).rejects.toThrow(); expect(await saved()).toEqual(before);
  });
  it.each(["salesforce", "hubspot", "shopify"] as const)("requires %s connection state before guarded replacement", async kind => {
    const scope = await claim(); const before = await saved();
    await expect(write(kind, { refreshScope: scope }, { connectionExpected: undefined })).rejects.toThrow(/GA4_REFRESH/); expect(await saved()).toEqual(before);
  });
  it.each(["spend", "spend records", "revenue"] as const)("rejects non-GA4 %s ownership and allows ordinary scoped saves", async kind => {
    await pool.query(`UPDATE ${sourceTable(kind)} SET platform_context='linkedin' WHERE id=$1`, [sourceId(kind)]);
    const scope = await claim(); const before = await saved();
    await expect(write(kind, { refreshScope: scope }, { platform: "linkedin" })).rejects.toThrow(/GA4_REFRESH/); expect(await saved()).toEqual(before);
    await write(kind, {}, { platform: "linkedin" });
  });
  it.each(["spend", "revenue"] as const)("rejects guarded %s creation but preserves ordinary add mode", async kind => {
    const scope = await claim(); const before = await saved();
    await expect(write(kind, { refreshScope: scope }, { sourceId: null })).rejects.toThrow(/GA4_REFRESH/); expect(await saved()).toEqual(before);
    const created: any = await write(kind, {}, { sourceId: null }); expect(created.id).not.toBe(sourceId(kind));
  });
  it.each(["spend", "revenue"] as const)("rolls %s metadata and deletes back when replacement rows fail", async kind => {
    const scope = await claim(); const before = await saved();
    await expect(write(kind, { refreshScope: scope }, { amount: "invalid decimal" })).rejects.toThrow(); expect(await saved()).toEqual(before);
  });
  it.each([null, ""])("compares nullable/empty mappings exactly (%s)", async expected => {
    await pool.query("UPDATE revenue_sources SET mapping_config=$1 WHERE id='revenue-a'", [expected]);
    const before = await saved();
    await expect(write("revenue", {}, { expected: expected === null ? "" : null })).rejects.toThrow("Revenue source changed"); expect(await saved()).toEqual(before);
    await write("revenue", {}, { expected });
  });
  it.each(["spend", "spend records", "revenue"] as const)("rechecks the %s mapping after waiting for a concurrent editor", async kind => {
    const scope = await claim(); const editor = await pool.connect();
    let pending: Promise<any> | undefined;
    try {
      await editor.query("BEGIN"); await editor.query(`UPDATE ${sourceTable(kind)} SET mapping_config='{"selected":"new"}' WHERE id=$1`, [sourceId(kind)]);
      pending = write(kind, { refreshScope: scope }).then(() => ({ succeeded: true }), error => ({ error }));
      let waiting = false;
      for (let i = 0; i < 100 && !waiting; i++) {
        waiting = (await pool.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE $2", [schemaName, `%${sourceTable(kind)}%`])).rowCount! > 0;
        if (!waiting) await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true); await editor.query("COMMIT"); const afterEdit = await saved();
      expect((await pending).error).toBeDefined(); expect(await saved()).toEqual(afterEdit);
    } finally { await editor.query("ROLLBACK"); editor.release(); await pending; }
  });
  it("rejects an old scheduled Sheets mapping before calling the provider", async () => {
    const fixture = sheetsRoute(); fixture.body.expectedSourceMappingConfig = initialMapping;
    await pool.query("UPDATE spend_sources SET mapping_config='{}' WHERE id='spend-a'"); const before = await saved();
    const res = await fixture.invoke(); expect(res.statusCode).toBe(409); expect(res.body.code).toBe("SPEND_SOURCE_CHANGED");
    expect(fixture.fetch).not.toHaveBeenCalled(); expect(fixture.recompute).not.toHaveBeenCalled(); expect(await saved()).toEqual(before);
  });
  it.each(["scheduled", "foreground"])("rejects a late %s Sheets reply after an edit without recomputing", async mode => {
    let afterEdit: any;
    const fixture = sheetsRoute(async () => {
      await pool.query("UPDATE spend_sources SET mapping_config='{}' WHERE id='spend-a'");
      await pool.query("UPDATE spend_records SET spend=99 WHERE spend_source_id='spend-a'"); afterEdit = await saved();
    });
    if (mode === "scheduled") fixture.body.expectedSourceMappingConfig = initialMapping;
    const res = await fixture.invoke(); expect(res.statusCode).toBe(409); expect(res.body.code).toBe("SPEND_SOURCE_CHANGED");
    expect(await saved()).toEqual(afterEdit); expect(fixture.recalc).not.toHaveBeenCalled(); expect(fixture.recompute).not.toHaveBeenCalled();
  });
  it.each(["scheduled", "foreground", "new", "legacy"])("retains the successful %s Sheets import and downstream calls", async mode => {
    const fixture = sheetsRoute();
    if (mode === "scheduled") fixture.body.expectedSourceMappingConfig = initialMapping;
    if (mode === "new") delete fixture.body.mapping.sourceId;
    if (mode === "legacy") await pool.query("UPDATE spend_sources SET platform_context=NULL WHERE id='spend-a'");
    const before = await saved(); const res = await fixture.invoke(); expect(res.statusCode).toBe(200); expect(res.body.success).toBe(true);
    expect(res.body.spendToDate).toBe(20); expect(fixture.recalc).toHaveBeenCalledWith("a", {}); expect(fixture.recompute).toHaveBeenCalledWith("a");
    const after = await saved(); expect(after.spend_sources.length).toBe(before.spend_sources.length + (mode === "new" ? 1 : 0));
    expect(after.spend_records.filter(row => row.spend_source_id === res.body.sourceId).map(row => row.spend)).toEqual(["20"]);
    expect(after.spend_records.filter(row => row.campaign_id === "b")).toEqual(before.spend_records.filter(row => row.campaign_id === "b"));
    expect(JSON.parse(after.spend_sources.find(row => row.id === res.body.sourceId)!.mapping_config)).not.toHaveProperty("expectedSourceMappingConfig");
  });
  it.each(["deleted", "inactive", "wrong campaign", "wrong platform"])("rejects a %s Sheets source before provider access", async state => {
    const fixture = sheetsRoute();
    if (state === "deleted") await pool.query("DELETE FROM spend_sources WHERE id='spend-a'");
    if (state === "inactive") await pool.query("UPDATE spend_sources SET is_active=false WHERE id='spend-a'");
    if (state === "wrong campaign") fixture.body.mapping.sourceId = "spend-b";
    if (state === "wrong platform") await pool.query("UPDATE spend_sources SET platform_context='linkedin' WHERE id='spend-a'");
    const before = await saved(); const res = await fixture.invoke(); expect(res.statusCode).toBe(404);
    expect(fixture.fetch).not.toHaveBeenCalled(); expect(await saved()).toEqual(before);
  });
  it("sends the exact saved Sheets mapping and stable source identity from the scheduler", async () => {
    const source = readFileSync(new URL("./auto-refresh-scheduler.ts", import.meta.url), "utf8");
    const body = source.slice(source.indexOf("async function reprocessGoogleSheetsSpendWithDetails("), source.indexOf("async function reprocessGoogleSheetsSpend(", source.indexOf("async function reprocessGoogleSheetsSpendWithDetails(")));
    const post = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const fn = new Function("postJson", "isSourceOutsideCampaign", ts.transpileModule(body + "return reprocessGoogleSheetsSpendWithDetails;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(post, (source: any, id: string) => source.campaignId !== id);
    const mapping = { connectionId: "sheet-a", spendColumn: "Spend", campaignValues: ["old"] };
    const savedMapping = JSON.stringify(mapping);
    expect((await fn("a", { id: "spend-a", campaignId: "a", platformContext: null, mappingConfig: savedMapping }, mapping)).success).toBe(true);
    expect(post).toHaveBeenCalledWith("/api/campaigns/a/spend/sheets/process", { connectionId: "sheet-a", platformContext: "ga4", expectedSourceMappingConfig: savedMapping, mapping: { ...mapping, sourceId: "spend-a" } }, {});
  });

  it.each(["salesforce", "hubspot", "shopify"] as const)("runs the actual %s owned route and defers follow-up calculations", async provider => {
    const scope = await claim(); const fixture = revenueRoute(provider, scope);
    const result = await fixture.invoke(); expect(result.body, result.body.error).toMatchObject({ success: true, totalRevenue: 20 });
    expect(fixture.recompute).not.toHaveBeenCalled(); expect(fixture.providerRead).toHaveBeenCalled();
    expect((await saved()).revenue_records.filter(row => row.revenue_source_id === `${provider}-a`).map(row => row.revenue)).toEqual(["20.00"]);
  });
  it.each(["salesforce", "hubspot", "shopify"] as const)("keeps ordinary %s saves and downstream recompute", async provider => {
    const fixture = revenueRoute(provider); const result = await fixture.invoke();
    expect(result.body, result.body.error).toMatchObject({ success: true, totalRevenue: 20 }); expect(fixture.recompute).toHaveBeenCalledWith("a", { platformContext: "ga4" });
  });
  it.each(["salesforce", "hubspot", "shopify"] as const)("rejects %s replies and failure audit writes after lease expiry", async provider => {
    const scope = await claim(); let afterExpiry: any;
    const fixture = revenueRoute(provider, scope, async () => { await expire(scope); afterExpiry = await saved(); });
    const result = await fixture.invoke(); expect(result.statusCode).toBeGreaterThanOrEqual(400);
    expect(fixture.providerRead).toHaveBeenCalled(); expect(await saved()).toEqual(afterExpiry); expect(fixture.recompute).not.toHaveBeenCalled();
  });
  it.each(["salesforce", "hubspot", "shopify"] as const)("rejects delayed %s data after the source is edited", async provider => {
    const scope = await claim(); let afterEdit: any;
    const fixture = revenueRoute(provider, scope, async () => {
      await pool.query("UPDATE revenue_sources SET mapping_config='{}' WHERE id=$1", [`${provider}-a`]); afterEdit = await saved();
    });
    expect((await fixture.invoke()).statusCode).toBeGreaterThanOrEqual(400);
    expect(fixture.providerRead).toHaveBeenCalled(); expect(await saved()).toEqual(afterEdit); expect(fixture.recompute).not.toHaveBeenCalled();
  });
  it("rejects a delayed owned Sheets Spend reply and does not recalculate", async () => {
    const scope = await claim(); const before = await saved();
    const fixture = sheetsRoute(async () => { await expire(scope); }, scope); fixture.body.expectedSourceMappingConfig = initialMapping;
    expect((await fixture.invoke()).statusCode).toBeGreaterThanOrEqual(400);
    expect(await saved()).toEqual(before); expect(fixture.recalc).not.toHaveBeenCalled(); expect(fixture.recompute).not.toHaveBeenCalled();
  });
  it("passes ownership into the Sheets Spend cache update and defers derived calculations", async () => {
    const scope = await claim(); const fixture = sheetsRoute(undefined, scope); fixture.body.expectedSourceMappingConfig = initialMapping;
    expect((await fixture.invoke()).body.success).toBe(true);
    expect(fixture.recalc).toHaveBeenCalledWith("a", { refreshScope: scope }); expect(fixture.recompute).not.toHaveBeenCalled();
  });

  const connections = [
    ["GoogleSheets", schema.googleSheetsConnections, "sheet-a", "sheet-a"], ["Hubspot", schema.hubspotConnections, "hubspot-a", "hubspot-a"],
    ["Salesforce", schema.salesforceConnections, "salesforce-a", "salesforce-a"], ["Shopify", schema.shopifyConnections, "shopify-a", "shopify-a"],
    ["GoogleAds", schema.googleAdsConnections, "ads-a", "a"], ["GA4GoogleAdsSpend", schema.ga4GoogleAdsSpendConnections, "ads-a", "a"],
  ] as const;
  const renewalConnections = [
    ["GA4", schema.ga4Connections, "ga4-a", "updateGA4ConnectionTokens"],
    ["GoogleSheets", schema.googleSheetsConnections, "sheet-a", "updateGoogleSheetsConnection"],
    ["Hubspot", schema.hubspotConnections, "hubspot-a", "updateHubspotConnection"],
    ["Salesforce", schema.salesforceConnections, "salesforce-a", "updateSalesforceConnection"],
    ["Shopify", schema.shopifyConnections, "shopify-a", "updateShopifyConnection"],
  ] as const;
  for (const [name, table, id, method] of renewalConnections) {
    it.each(["running", "completed"])(`preserves %s publication during credential-only ${name} renewal`, async status => {
      const update = (values: any) => (storage as any)[method](id, values);
      await update({ accessToken: "initial-access", refreshToken: "initial-refresh" });
      const scope = await claim();
      if (status === "completed") await pool.query("UPDATE ga4_refresh_work SET status='completed',lease_token=NULL,lease_expires_at=NULL,completed_at=clock_timestamp() WHERE id=$1", [scope.work.id]);
      await database.current.insert(schema.metricSnapshots).values({ campaignId: "a", snapshotType: "executive_summary_daily", reportingDate: date,
        notes: `ga4_aligned_refresh_v1:${date}:2026-10-18T06:00:00Z`, metrics: { revenue: 123.45 } });
      const workBefore = (await pool.query("SELECT * FROM ga4_refresh_work ORDER BY id")).rows;
      const snapshotsBefore = (await pool.query("SELECT * FROM metric_snapshots ORDER BY id")).rows;
      const financialBefore = await saved();
      const renewed = await update({ accessToken: "renewed-access", refreshToken: "renewed-refresh" });
      expect(renewed.accessToken).toBe("renewed-access"); expect(renewed.refreshToken).toBe("renewed-refresh");
      expect((await pool.query("SELECT * FROM ga4_refresh_work ORDER BY id")).rows).toEqual(workBefore);
      expect((await pool.query("SELECT * FROM metric_snapshots ORDER BY id")).rows).toEqual(snapshotsBefore);
      const financialAfter = await saved();
      for (const key of Object.keys(financialBefore)) {
        const preserved = (row: any) => key !== getTableName(table) || row.id !== id;
        expect(financialAfter[key].filter(preserved)).toEqual(financialBefore[key].filter(preserved));
      }
    });
    it(`still invalidates publication when ${name} connection configuration changes`, async () => {
      const scope = await claim();
      await database.current.insert(schema.metricSnapshots).values({ campaignId: "a", snapshotType: "executive_summary_daily", reportingDate: date,
        notes: `ga4_aligned_refresh_v1:${date}:2026-10-18T06:00:00Z` });
      await (storage as any)[name === "GA4" ? "updateGA4Connection" : method](id, { isActive: false });
      expect((await pool.query("SELECT scope_hash FROM ga4_refresh_work WHERE id=$1", [scope.work.id])).rows[0].scope_hash).toMatch(/^invalidated:/);
      expect((await pool.query("SELECT notes FROM metric_snapshots WHERE campaign_id='a'")).rows[0].notes).toBeNull();
    });
  }
  it.each([
    ["same unnamed account", { portalId: "147492723", portalName: null }, true],
    ["name hydration", { portalId: "147492723", portalName: "Test account" }, true],
    ["name only", { portalName: "Test account" }, true],
    ["different account", { portalId: "other", portalName: "Other account" }, false],
    ["removed account", { portalId: null, portalName: null }, false],
    ["mapping edit", { portalName: "Test account", mappingConfig: "{}" }, false],
    ["deactivation", { portalName: "Test account", isActive: false }, false],
  ] as const)("HubSpot %s preserves readiness only for metadata-only changes", async (_name, update, preserves) => {
    await storage.updateHubspotConnection("hubspot-a", { portalId: "147492723", portalName: null });
    const scope = await claim();
    await pool.query("UPDATE ga4_refresh_work SET status='completed',lease_token=NULL,lease_expires_at=NULL,completed_at=clock_timestamp() WHERE id=$1", [scope.work.id]);
    await database.current.insert(schema.metricSnapshots).values({ campaignId: "a", snapshotType: "executive_summary_daily", reportingDate: date,
      notes: `ga4_aligned_refresh_v1:${date}:2026-10-18T06:00:00Z`, metrics: { revenue: 123.45 } });
    const before = { work: (await pool.query("SELECT * FROM ga4_refresh_work ORDER BY id")).rows,
      snapshots: (await pool.query("SELECT * FROM metric_snapshots ORDER BY id")).rows, financial: await saved() };
    await storage.updateHubspotConnection("hubspot-a", update);
    const work = (await pool.query("SELECT * FROM ga4_refresh_work ORDER BY id")).rows;
    const snapshots = (await pool.query("SELECT * FROM metric_snapshots ORDER BY id")).rows;
    if (preserves) { expect(work).toEqual(before.work); expect(snapshots).toEqual(before.snapshots); }
    else { expect(work.find(row => row.id === scope.work.id).scope_hash).toMatch(/^invalidated:/); expect(snapshots[0].notes).toBeNull(); }
    const after = await saved();
    for (const key of Object.keys(before.financial)) {
      const retained = (row: any) => key !== "hubspot_connections" || row.id !== "hubspot-a";
      expect(after[key].filter(retained)).toEqual(before.financial[key].filter(retained));
    }
  });
  it.each([false, true])("Salesforce credential renewal metadata preserves publication only for the same instance (changed: %s)", async changed => {
    await storage.updateSalesforceConnection("salesforce-a", { accessToken: "initial", refreshToken: "refresh", clientId: "fixture", clientSecret: "fixture",
      instanceUrl: "https://old.invalid", expiresAt: new Date(0) });
    const scope = await claim();
    const previous = (await pool.query("SELECT * FROM ga4_refresh_work WHERE id=$1", [scope.work.id])).rows[0];
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ access_token: "renewed", refresh_token: "next", instance_url: changed ? "https://new.invalid" : "https://old.invalid" }) }));
    expect(await salesforceRenewal(fetch).refresh(await storage.getSalesforceConnection("a"), true)).toBe("renewed");
    const current = (await pool.query("SELECT * FROM ga4_refresh_work WHERE id=$1", [scope.work.id])).rows[0];
    if (changed) expect(current.scope_hash).toMatch(/^invalidated:/); else expect(current).toEqual(previous);
  });
  it.each(["expiry", "selected values", "scopes", "domain", "malformed", "array", "null"])("Shopify credential renewal metadata respects %s changes", async kind => {
    const mapping = { authType: "oauth", grantedScopes: "read_orders", grantedScopesList: ["read_orders"], selectedValues: ["old"], accessTokenExpiresAt: "2026-10-18T06:00:00Z" };
    await storage.updateShopifyConnection("shopify-a", { accessToken: "initial", refreshToken: "refresh", mappingConfig: JSON.stringify(mapping) });
    const scope = await claim();
    const previous = (await pool.query("SELECT * FROM ga4_refresh_work WHERE id=$1", [scope.work.id])).rows[0];
    const next = { ...mapping, accessTokenExpiresAt: "2026-10-19T06:00:00Z", refreshTokenExpiresAt: "2026-11-19T06:00:00Z", tokenUpdatedAt: "2026-10-18T07:00:00Z",
      ...(kind === "selected values" ? { selectedValues: ["new"] } : {}), ...(kind === "scopes" ? { grantedScopes: "read_orders,read_all_orders" } : {}) };
    await storage.updateShopifyConnection("shopify-a", { accessToken: "renewed", refreshToken: "next",
      mappingConfig: kind === "malformed" ? "{" : kind === "array" ? "[]" : kind === "null" ? null : JSON.stringify(next),
      ...(kind === "domain" ? { shopDomain: "new.myshopify.com" } : {}) } as any);
    const current = (await pool.query("SELECT * FROM ga4_refresh_work WHERE id=$1", [scope.work.id])).rows[0];
    if (kind === "expiry") expect(current).toEqual(previous); else expect(current.scope_hash).toMatch(/^invalidated:/);
  });
  it("keeps Salesforce connected through successive scheduled rotations using the real renewal and status handlers", async () => {
    await storage.updateSalesforceConnection("salesforce-a", { accessToken: "access-0", refreshToken: "refresh-0",
      clientId: "fixture-client", clientSecret: "fixture-secret", instanceUrl: "https://fixture.invalid", expiresAt: new Date(0) });
    const scope = await claim(); let generation = 0;
    const fetch = vi.fn(async (_url: string, options: any) => {
      expect(options.body.get("refresh_token")).toBe(`refresh-${generation}`);
      generation++;
      return { ok: true, status: 200, json: async () => ({ access_token: `access-${generation}`, refresh_token: `refresh-${generation}` }) };
    });
    const fixture = salesforceRenewal(fetch);
    const records = await pool.query("SELECT * FROM revenue_records ORDER BY id");
    const sources = await pool.query("SELECT * FROM revenue_sources ORDER BY id");
    for (let i = 1; i <= 2; i++) {
      const conn = await storage.getSalesforceConnection("a", { refreshScope: scope });
      expect(await fixture.refresh(conn, true, { refreshScope: scope })).toBe(`access-${i}`);
      expect(await fixture.status()).toMatchObject({ connected: true, connectionId: "salesforce-a" });
      expect((await storage.getSalesforceConnection("a", { refreshScope: scope }))?.refreshToken).toBe(`refresh-${i}`);
    }
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((await pool.query("SELECT * FROM revenue_records ORDER BY id")).rows).toEqual(records.rows);
    expect((await pool.query("SELECT * FROM revenue_sources ORDER BY id")).rows).toEqual(sources.rows);
  });
  it("keeps saved Salesforce revenue and credentials intact when the provider rejects renewal", async () => {
    await storage.updateSalesforceConnection("salesforce-a", { accessToken: "expired", refreshToken: "revoked",
      clientId: "fixture-client", clientSecret: "fixture-secret", instanceUrl: "https://fixture.invalid", expiresAt: new Date(0) });
    const before = await saved();
    const fetch = vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: "invalid_grant", error_description: "expired access/refresh token" }) }));
    expect(await salesforceRenewal(fetch).status()).toMatchObject({ connected: false, connectionId: "salesforce-a" });
    expect(fetch).toHaveBeenCalledTimes(1); expect(await saved()).toEqual(before);
  });
  it.each(connections)("persists successive %s renewals after encrypted credentials are read from PostgreSQL", async (name, table, id, arg) => {
    // Initial credentials are already encrypted in production; a null-token fixture misses this path.
    const update = (values: any, options?: any) => (storage as any)[`update${name}Connection`](arg, values, options);
    await update({ accessToken: "access-0", ...(name !== "Shopify" ? { refreshToken: "refresh-0", clientSecret: "fixture-secret" } : {}) });
    const scope = await claim();
    for (let i = 1; i <= 2; i++) {
      const [expectedConnection] = (await database.current.select().from(table)).filter((row: any) => row.id === id);
      const [separateRead] = (await database.current.select().from(table)).filter((row: any) => row.id === id);
      expect(separateRead.encryptedTokens).toEqual(expectedConnection.encryptedTokens);
      expect(separateRead.encryptedTokens).not.toBe(expectedConnection.encryptedTokens);
      const renewed = await update({ accessToken: `access-${i}`, ...(name !== "Shopify" ? { refreshToken: `refresh-${i}` } : {}) }, { refreshScope: scope, expectedConnection });
      expect(renewed.accessToken).toBe(`access-${i}`);
      if (name !== "Shopify") {
        expect(renewed.refreshToken).toBe(`refresh-${i}`);
        expect(renewed.clientSecret).toBe("fixture-secret");
      }
      const after = await saved();
      await expect(update({ accessToken: "stale-write" }, { refreshScope: scope, expectedConnection })).rejects.toThrow("GA4_REFRESH_CONNECTION_CHANGED");
      expect(await saved()).toEqual(after);
    }
    const [current] = (await database.current.select().from(table)).filter((row: any) => row.id === id);
    await expire(scope); const beforeExpiredSave = await saved();
    await expect(update({ accessToken: "expired-lease-write" }, { refreshScope: scope, expectedConnection: current })).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    expect(await saved()).toEqual(beforeExpiredSave);
  });
  it.each(connections)("fences %s credential renewal, including expired and changed credentials", async (name, table, id, arg) => {
    const scope = await claim(); const [expectedConnection] = (await database.current.select().from(table)).filter((row: any) => row.id === id);
    const update = (options: any) => (storage as any)[`update${name}Connection`](arg, { accessToken: "new-fake-token" }, options);
    await update({ refreshScope: scope, expectedConnection });
    const after = await saved(); expect(JSON.stringify(after)).not.toContain(scope.work.leaseToken);
    await expect(update({ refreshScope: scope, expectedConnection })).rejects.toThrow("GA4_REFRESH_CONNECTION_CHANGED"); expect(await saved()).toEqual(after);
    const [current] = (await database.current.select().from(table)).filter((row: any) => row.id === id);
    await expire(scope); await expect(update({ refreshScope: scope, expectedConnection: current })).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST"); expect(await saved()).toEqual(after);
  });
  it.each(connections)("rejects %s credential saves without exact connection evidence", async (name, _table, _id, arg) => {
    const scope = await claim(); const before = await saved();
    await expect((storage as any)[`update${name}Connection`](arg, { accessToken: "fake" }, { refreshScope: scope })).rejects.toThrow("GA4_REFRESH_CONNECTION_CHANGED");
    expect(await saved()).toEqual(before);
  });
  it.each(connections)("keeps owned %s reads free of legacy-token backfill writes", async (name, table, id, arg) => {
    const scope = await claim();
    await database.current.update(table).set({ accessToken: "legacy-access", ...(name !== "Shopify" ? { refreshToken: "legacy-refresh", clientSecret: "legacy-secret" } : {}) });
    const before = await saved();
    const expectedConnection = name === "GoogleSheets" ? (await storage.getGoogleSheetsConnections("a", undefined, { refreshScope: scope }))[0]
      : name === "GA4GoogleAdsSpend" ? await storage.getGA4GoogleAdsSpendConnection("a")
      : await (storage as any)[`get${name}Connection`]("a", { refreshScope: scope });
    expect(expectedConnection.id).toBe(id); expect(await saved()).toEqual(before);
    const renewed = await (storage as any)[`update${name}Connection`](arg, { accessToken: "renewed-access" }, { refreshScope: scope, expectedConnection });
    expect(renewed.accessToken).toBe("renewed-access");
    if (name !== "Shopify") expect(renewed.refreshToken).toBe("legacy-refresh");
  });
  it.each([false, true])("fences Google Ads daily facts (dedicated=%s) and rejects changed mappings", async dedicated => {
    const scope = await claim(); const table = dedicated ? schema.ga4GoogleAdsSpendConnections : schema.googleAdsConnections;
    const [expectedConnection] = (await database.current.select().from(table)).filter((row: any) => row.campaignId === "a");
    const options = { refreshScope: scope, expectedConnection, expectedSource: { id: "spend records-a", mappingConfig: initialMapping } };
    const replace = dedicated ? storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow.bind(storage) : storage.replaceGoogleAdsDailyMetricsForWindow.bind(storage);
    await replace("a", date, date, [{ campaignId: "a", googleCampaignId: "selected", date, spend: "20.00" }], options);
    await pool.query("UPDATE spend_sources SET mapping_config='{}' WHERE id='spend records-a'"); const before = await saved();
    await expect(replace("a", date, date, [], options)).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED"); expect(await saved()).toEqual(before);
    await expire(scope); await expect(replace("a", date, date, [], options)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST"); expect(await saved()).toEqual(before);
  });
  for (const method of ["service_account", "oauth"]) it.each([false, true])(`accepts unchanged ${method} Ads credentials across PostgreSQL reads (dedicated=%s)`, async dedicated => {
    const table = dedicated ? schema.ga4GoogleAdsSpendConnections : schema.googleAdsConnections;
    const update = dedicated ? storage.updateGA4GoogleAdsSpendConnection.bind(storage) : storage.updateGoogleAdsConnection.bind(storage);
    await update("a", { method, accessToken: method === "oauth" ? "fixture-access" : null } as any);
    const scope = await claim();
    const [expectedConnection] = (await database.current.select().from(table)).filter((row: any) => row.campaignId === "a");
    const [separateRead] = (await database.current.select().from(table)).filter((row: any) => row.campaignId === "a");
    expect(separateRead.encryptedTokens).toEqual(expectedConnection.encryptedTokens);
    expect(separateRead.encryptedTokens).not.toBe(expectedConnection.encryptedTokens);
    const options = { refreshScope: scope, expectedConnection, expectedSource: { id: "spend records-a", mappingConfig: initialMapping } };
    const replace = dedicated ? storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow.bind(storage) : storage.replaceGoogleAdsDailyMetricsForWindow.bind(storage);
    const otherCampaignBefore = (await saved())[getTableName(dedicated ? schema.ga4GoogleAdsSpendDailyMetrics : schema.googleAdsDailyMetrics)].filter(row => row.campaign_id === "b");
    await expect(replace("a", date, date, [{ campaignId: "a", googleCampaignId: "selected", date, spend: "4.89" }], options)).resolves.toEqual({ replaced: 1 });
    const after = await saved(), facts = after[getTableName(dedicated ? schema.ga4GoogleAdsSpendDailyMetrics : schema.googleAdsDailyMetrics)];
    expect(facts.filter(row => row.campaign_id === "a").map(row => Number(row.spend))).toEqual([4.89]);
    expect(facts.filter(row => row.campaign_id === "b")).toEqual(otherCampaignBefore);
    for (const change of [{ encryptedTokens: { ...expectedConnection.encryptedTokens, accessToken: { v: 1, data: "changed" } } },
      { customerId: "other-customer" }, { managerAccountId: "other-manager" }, { method: "other-method" }]) {
      await expect(replace("a", date, date, [], { ...options, expectedConnection: { ...expectedConnection, ...change } })).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      expect(await saved()).toEqual(after);
    }
    await expect(replace("b", date, date, [], options)).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED"); expect(await saved()).toEqual(after);
    await expire(scope); await expect(replace("a", date, date, [], options)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST"); expect(await saved()).toEqual(after);
  });
  it("prevents expired or cross-campaign jobs from changing the campaign Spend cache", async () => {
    const scope = await claim(); await storage.updateCampaign("a", { spend: "20.00" }, { refreshScope: scope });
    await expect(storage.updateCampaign("b", { spend: "99.00" }, { refreshScope: scope })).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    await expire(scope); await expect(storage.updateCampaign("a", { spend: "99.00" }, { refreshScope: scope })).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    expect((await storage.getCampaign("a"))?.spend).toBe("20.00"); expect((await storage.getCampaign("b"))?.spend).not.toBe("99.00");
  });
});
