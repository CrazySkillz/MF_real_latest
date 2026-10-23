import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, getTableColumns, getTableName, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";

const database = vi.hoisted(() => ({ current: null as any }));
vi.mock("./db", () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from "./storage";

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "");
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) throw new Error("Requires isolated localhost ga4_alignment_test without DATABASE_URL");
}
const families = ["ga4", "google_sheets", "linkedin", "meta"] as const;
type Family = typeof families[number];
const connections = { ga4: schema.ga4Connections, google_sheets: schema.googleSheetsConnections, linkedin: schema.linkedinConnections, meta: schema.metaConnections };
const dependents = [schema.ga4DailyMetrics, schema.ga4OverviewSnapshots, schema.ga4RefreshWork, schema.metricSnapshots,
  schema.revenueSources, schema.revenueRecords, schema.spendSources, schema.spendRecords, schema.kpis, schema.metaKpis, schema.benchmarks, schema.metaBenchmarks,
  schema.linkedinReports, schema.metaReports, schema.kpiReports, schema.reportSnapshots, schema.notifications, schema.conversionEvents, schema.inboundWebhookReceipts,
  schema.linkedinDailyMetrics, schema.metaDailyMetrics, schema.googleAdsDailyMetrics, schema.ga4GoogleAdsSpendDailyMetrics,
  schema.instagramDailyMetrics, schema.tiktokDailyMetrics, schema.customIntegrationMetrics, schema.abTests, schema.touchpoints, schema.attributionResults, schema.attributionInsights];
const tables = [schema.clients, schema.campaigns, ...Object.values(connections), schema.ga4ConnectionLifecycleEvents,
  schema.linkedinImportSessions, schema.linkedinImportMetrics, schema.linkedinAdPerformance, ...dependents];
const schemaName = `transfer_it_${randomUUID().replace(/-/g, "")}`;
const storage = new DatabaseStorage();
let admin: Pool, pool: Pool, created = false;
const when = new Date("2026-10-01T12:00:00Z");
const row = (family: Family, id = "connection", campaignId = "a"): any => ({
  id, campaignId, method: "service_account", encryptedTokens: { version: 1, ciphertext: "fixture-only" }, expiresAt: when, connectedAt: when, createdAt: when,
  ...(family === "ga4" ? { propertyId: "123", propertyName: "Selected property", websiteUrl: "https://example.invalid", displayName: "Original", serviceAccountKey: "fixture-only", isPrimary: true, importStartDate: "2026-09-01", lookbackDays: 30, clientId: "fixture-client" }
    : family === "google_sheets" ? { spreadsheetId: "selected-sheet", spreadsheetName: "Original", sheetName: "Selected tab", purpose: "revenue", isPrimary: true, clientId: "fixture-client", columnMappings: '[{"source":"Selected","target":"revenue"}]', platforms: '["ga4"]', cachedData: { headers: ["Selected"], rows: [["0.75"]] }, lastDataRefreshAt: when }
    : { adAccountId: "account", adAccountName: "Selected account", conversionValue: "0.75", campaignUtmMap: '{"ad-1":"selected"}', spendOnly: true, ...(family === "meta" ? { selectedCampaignIds: '["ad-1"]' } : { clientId: "fixture-client", lastRefreshAt: when }) }),
});
async function snapshot() {
  const result: any = {};
  for (const table of tables) result[getTableName(table)] = (await pool.query(`SELECT * FROM "${getTableName(table)}" ORDER BY id`)).rows;
  return result;
}
async function seed(family: Family) { await database.current.insert(connections[family]).values(row(family)); }
async function unchangedFailure(family: Family = "ga4", from = "a", to = "b", owner = "owner") {
  const before = await snapshot();
  await expect(storage.transferCampaignConnection(from, to, owner, family)).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
}
// Give each dependent table its minimum persisted row, independently of transfer code.
async function insertDependent(table: any, campaignId: string) {
  const values: any = { id: "dependent", campaignId, ...(table === schema.abTests ? { confidenceLevel: "0.95" } : {}) };
  for (const [key, col] of Object.entries(getTableColumns(table)) as [string, any][]) {
    if (values[key] !== undefined || !col.notNull || col.default !== undefined) continue;
    values[key] = col.dataType === "date" ? when : col.dataType === "number" ? 1 : col.dataType === "boolean" ? false : col.dataType === "json" ? {} : col.dataType === "array" ? [] : /numeric|decimal/.test(col.getSQLType()) ? "1" : "fixture";
  }
  await database.current.insert(table).values(values);
}

describe.skipIf(!testUrl)("V1-069 real PostgreSQL transfer boundaries", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 2 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, application_name: schemaName, max: 4 });
    database.current = drizzle(pool, { schema });
    const dialect = new PgDialect();
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map((col: any) => {
        const value = col.default;
        const defaultSql = value instanceof SQL ? dialect.sqlToQuery(value).sql : typeof value === "string" ? `'${value.replace(/'/g, "''")}'` : String(value);
        return `"${col.name}" ${col.getSQLType()}${col.notNull ? " NOT NULL" : ""}${value !== undefined ? ` DEFAULT ${defaultSql}` : ""}${col.primary ? " PRIMARY KEY" : ""}`;
      });
      await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(", ")})`);
    }
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`); await admin?.end(); });
  beforeEach(async () => {
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    await database.current.insert(schema.clients).values([{ id: "client", ownerId: "owner", name: "Client" }, { id: "other-client", ownerId: "other", name: "Other" }]);
    for (const id of ["a", "b", "c", "unrelated"]) await database.current.insert(schema.campaigns).values({ id, name: id, ownerId: id === "unrelated" ? "other" : "owner", clientId: id === "unrelated" ? "other-client" : "client", status: "draft", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: "selected" });
  });
  it.each(families)("moves %s original credentials/settings exactly and preserves unrelated campaigns", async family => {
    await seed(family); await database.current.insert(connections[family]).values(row(family, "other", "unrelated"));
    const before = await snapshot();
    expect(await storage.transferCampaignConnection("a", "b", "owner", family)).toEqual({ connectionId: "connection" });
    const after = await snapshot(), name = getTableName(connections[family]);
    expect(after[name]).toEqual(before[name].map((r: any) => r.id === "connection" ? { ...r, campaign_id: "b" } : r));
    expect(after.campaigns).toEqual(before.campaigns);
    if (family === "ga4") expect(after.ga4_connection_lifecycle_events).toEqual([expect.objectContaining({ connection_id: "connection", campaign_id: "a", action: "transfer" })]);
    await unchangedFailure(family); // A lost HTTP response/retry must not overwrite the destination.
    const moved = await snapshot(); expect(await storage.transferCampaignConnection("a", "c", "owner", family)).toBeUndefined(); expect(await snapshot()).toEqual(moved);
  });
  it.each(["ga4", "google_sheets"] as const)("retains every %s connection, including secondary and inactive rows", async family => {
    await seed(family);
    await database.current.insert(connections[family]).values([{ ...row(family, "secondary"), isPrimary: false }, { ...row(family, "inactive"), isPrimary: false, isActive: false }]);
    const before = (await snapshot())[getTableName(connections[family])];
    await storage.transferCampaignConnection("a", "b", "owner", family);
    expect((await snapshot())[getTableName(connections[family])]).toEqual(before.map((r: any) => ({ ...r, campaign_id: "b" })));
  });
  it.each(families)("rejects same-campaign %s and occupied destinations without changes", async family => {
    await seed(family); await unchangedFailure(family, "a", "a");
    await database.current.insert(connections[family]).values({ ...row(family, "destination", "b"), ...(["ga4", "google_sheets"].includes(family) ? { isActive: false } : {}) });
    await unchangedFailure(family);
  });
  it.each(families)("serializes two competing %s transfers and prevents duplicates", async family => {
    await seed(family);
    const results = await Promise.all([storage.transferCampaignConnection("a", "b", "owner", family), storage.transferCampaignConnection("a", "c", "owner", family)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const rows = (await snapshot())[getTableName(connections[family])]; expect(rows).toHaveLength(1); expect(["b", "c"]).toContain(rows[0].campaign_id);
  });
  it.each([
    { ownerId: "other" }, { ownerId: null }, { clientId: "other-client" }, { clientId: null }, { status: "active" }, { status: "deleted" },
    { currency: "USD" }, { reportingTimeZone: "UTC" }, { startDate: when }, { endDate: when }, { ga4CampaignFilter: "different" }, { conversionValue: "10" }, { platform: "different" }, { spend: "0.75" }, { clicks: 1 }, { impressions: 1 },
  ])("rejects incompatible destination %j", async changes => {
    await seed("ga4"); await database.current.update(schema.campaigns).set(changes).where(eq(schema.campaigns.id, "b")); await unchangedFailure();
  });
  it("rechecks storage caller ownership and a changed client owner", async () => {
    await seed("ga4"); await unchangedFailure("ga4", "a", "b", "other");
    await database.current.update(schema.clients).set({ ownerId: "other" }).where(eq(schema.clients.id, "client")); await unchangedFailure();
  });
  it("rejects missing parents and reports a missing connection without writes", async () => {
    await seed("ga4"); await unchangedFailure("ga4", "a", "missing");
    const before = await snapshot(); expect(await storage.transferCampaignConnection("b", "c", "owner", "ga4")).toBeUndefined(); expect(await snapshot()).toEqual(before);
  });
  it.each(families)("rejects ambiguous %s connections", async family => {
    await seed(family); await database.current.insert(connections[family]).values(row(family, "duplicate")); await unchangedFailure(family);
  });
  it.each(dependents.map(table => [getTableName(table), table] as const))("blocks existing %s data/work on either campaign without deleting it", async (_name, table) => {
    await seed("ga4");
    for (const campaignId of ["a", "b"]) {
      await insertDependent(table, campaignId); await unchangedFailure(); await pool.query(`DELETE FROM "${getTableName(table)}"`);
    }
  });
  it("preserves LinkedIn session IDs, selections, metric and ad children", async () => {
    await seed("linkedin");
    await database.current.insert(schema.linkedinImportSessions).values({ id: "session", campaignId: "a", adAccountId: "account", selectedMetricKeys: ["conversions"], conversionValue: "0.75", importedAt: when });
    await database.current.insert(schema.linkedinImportMetrics).values({ id: "metric", sessionId: "session", campaignUrn: "selected", campaignName: "Selected", metricKey: "conversions", metricValue: "0.75" });
    await database.current.insert(schema.linkedinAdPerformance).values({ id: "ad", sessionId: "session", adId: "ad-1", adName: "Ad", campaignUrn: "selected", campaignName: "Selected" });
    const before = await snapshot(); await storage.transferCampaignConnection("a", "b", "owner", "linkedin"); const after = await snapshot();
    expect(after.linkedin_import_sessions).toEqual(before.linkedin_import_sessions.map((r: any) => ({ ...r, campaign_id: "b" })));
    expect(after.linkedin_import_metrics).toEqual(before.linkedin_import_metrics); expect(after.linkedin_ad_performance).toEqual(before.linkedin_ad_performance);
  });
  it.each(["other-account", "destination", "wrong-platform"])("rejects incompatible import sessions: %s", async scenario => {
    const family = scenario === "wrong-platform" ? "ga4" : "linkedin"; await seed(family);
    await database.current.insert(schema.linkedinImportSessions).values({ id: "session", campaignId: scenario === "destination" ? "b" : "a", adAccountId: scenario === "other-account" ? "other" : "account" });
    await unchangedFailure(family);
  });
  it.each(families)("rolls back a failed %s connection write including session moves", async family => {
    await seed(family);
    if (family === "linkedin") await database.current.insert(schema.linkedinImportSessions).values({ id: "session", campaignId: "a", adAccountId: "account" });
    const name = getTableName(connections[family]);
    await pool.query("CREATE OR REPLACE FUNCTION reject_transfer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$");
    await pool.query(`CREATE TRIGGER reject_transfer BEFORE UPDATE ON "${name}" FOR EACH ROW EXECUTE FUNCTION reject_transfer()`);
    try { await unchangedFailure(family); } finally { await pool.query(`DROP TRIGGER reject_transfer ON "${name}"`); }
  });
  it("rolls back a GA4 transfer if its lifecycle audit cannot be persisted", async () => {
    await seed("ga4");
    await pool.query("CREATE OR REPLACE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit failure'; END $$");
    await pool.query("CREATE TRIGGER reject_audit BEFORE INSERT ON ga4_connection_lifecycle_events FOR EACH ROW EXECUTE FUNCTION reject_audit()");
    try { await unchangedFailure(); } finally { await pool.query("DROP TRIGGER reject_audit ON ga4_connection_lifecycle_events"); }
  });
  it("rejects a late Sheets cache publication that still belongs to the old campaign", async () => {
    await seed("google_sheets");
    const [expected] = await database.current.select().from(schema.googleSheetsConnections);
    await storage.transferCampaignConnection("a", "b", "owner", "google_sheets");
    const before = await snapshot();
    await expect(storage.updateGoogleSheetsConnection("connection", { cachedData: { complete: true, readStartedAt: "2026-10-23T09:00:00Z", spreadsheetId: expected.spreadsheetId, sheetName: expected.sheetName, headers: ["Changed"], rows: [[999]] } }, { expectedConnection: expected })).rejects.toThrow("GOOGLE_SHEETS_CACHE_INPUT_CHANGED");
    expect(await snapshot()).toEqual(before);
  });
});
