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
async function save(kind: typeof families[number], id: string | null = null, records = rows(), options: any = {}) {
  const source = { campaignId: "a", sourceType: kind, platformContext: "ga4", currency: "EUR", mappingConfig: "{}" };
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
async function publish(scope: Awaited<ReturnType<typeof claim>>, complete = true) {
  const revenuePublication = await storage.getGA4RevenuePublication("a", day);
  const total = await storage.getRevenueTotalForRange("a", "1900-01-01", day);
  const snapshot = { version: "financial_daily_snapshot_v1" as const, campaignId: "a", reportingDate: day, currency: "EUR",
    currentValueWindow: { mode: "initial_import_to_latest_completed_day" as const, startDate: "2026-09-04", endDate: day,
      dataThroughDate: day, reportingTimeZone: "Europe/Amsterdam" },
    inputs: { revenue: { value: (7653.96 + total.totalRevenue).toFixed(2), available: true as const, sources: ["ga4", ...total.sourceIds.map(id => `revenue-source:${id}`)] },
      spend: { value: null, available: false as const, sources: [] as never[] }, conversions: { value: 2, available: true as const, sources: ["ga4"] } },
    revenuePublication, refreshScope: scope };
  await storage.upsertFinancialDailySnapshot(snapshot);
  if (complete) {
    await database.current.insert(schema.metricSnapshots).values({ campaignId: "a", reportingDate: day, snapshotType: "executive_summary_daily",
      notes: `ga4_refresh_publication_v1:${scope.work.id}:${createHash("sha256").update(scope.work.leaseToken).digest("hex")}` });
    expect(await storage.updateGA4RefreshWorkLease("a", "owner-a", scope.work.id, scope.work.leaseToken, "complete", 120_000, new Date().toISOString())).toBeDefined();
  }
  return snapshot;
}
async function sourceResponse() {
  const source = readFileSync(new URL("./routes-oauth.ts", import.meta.url), "utf8");
  const start = source.indexOf('app.get("/api/campaigns/:id/revenue-sources"');
  const end = source.indexOf("// Unified data-sources endpoint", start);
  let handler: any;
  new Function("app", "storage", "ensureCampaignAccess", "parseRevenueReadPlatformContext", "getReportingDateWindow", "getShopifyRevenueSourceFreshness",
    ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(
    { get: (_path: string, callback: any) => { handler = callback; } }, storage, async () => storage.getCampaign("a"),
    () => "ga4", () => ({ endDate: day }), () => null);
  const res: any = { setHeader() {}, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; } };
  await handler({ params: { id: "a" }, query: {} }, res);
  expect(res.code, JSON.stringify(res.body)).toBeUndefined(); return res.body;
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
  it("retains pending revenue work after another campaign input changes", async () => {
    await save("csv"); const previous = (await storage.getRecoverableGA4RefreshWork())[0];
    await storage.updateCampaign("a", { name: "Updated campaign" });
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
  it("does not change Spend connection-date eligibility", async () => {
    await database.current.insert(schema.spendSources).values({ id: "spend", campaignId: "a", sourceType: "csv", platformContext: "ga4", currency: "EUR" });
    await database.current.insert(schema.spendRecords).values({ campaignId: "a", spendSourceId: "spend", date: "2026-09-30", spend: "99.00", currency: "EUR" });
    expect((await storage.getSpendTotalForRange("a", "1900-01-01", day, "ga4")).totalSpend).toBe(0);
  });
});
