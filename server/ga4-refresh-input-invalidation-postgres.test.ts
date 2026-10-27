import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableColumns, getTableName, SQL, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";

const database = vi.hoisted(() => ({ current: null as any, pool: null as any }));
vi.mock("./db", () => ({ get db() { return database.current; }, get pool() { return database.pool; } }));
import { DatabaseStorage } from "./storage";

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "").trim();
if (testUrl) {
  const url = new URL(testUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1"
    || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) {
    throw new Error("GA4 PostgreSQL tests require 127.0.0.1/ga4_alignment_test and no DATABASE_URL");
  }
}
const schemaName = `ga4_input_it_${randomUUID().replace(/-/g, "")}`;
const tables = [schema.campaigns, schema.ga4Connections, schema.metricSnapshots, schema.ga4OverviewSnapshots, schema.ga4DailyMetrics,
  schema.revenueSources, schema.revenueRecords, schema.spendSources, schema.spendRecords,
  schema.kpis, schema.kpiProgress, schema.kpiAlerts, schema.kpiPeriods, schema.benchmarks, schema.benchmarkHistory, schema.notifications,
  schema.googleSheetsConnections, schema.salesforceConnections, schema.hubspotConnections, schema.shopifyConnections,
  schema.googleAdsConnections, schema.ga4GoogleAdsSpendConnections, schema.googleAdsDailyMetrics, schema.ga4GoogleAdsSpendDailyMetrics,
  schema.linkedinConnections, schema.metaConnections, schema.instagramConnections, schema.tiktokConnections,
  schema.metaDailyMetrics, schema.instagramDailyMetrics, schema.tiktokDailyMetrics];
const storage = new DatabaseStorage();
const date = "2026-10-17";
let admin: Pool, pool: Pool, created = false;
// Source saves now queue their own current work; a new test worker must use a
// current slot rather than attempting to supersede it with a minute-old slot.
const ensure = () => storage.ensureGA4RefreshWork("a", "owner-a", new Date(), date);
async function claim() {
  const work = (await ensure())!;
  const claimed = (await storage.claimGA4RefreshWork("a", "owner-a", work.id, 120_000))!;
  return { campaignId: "a", ownerId: "owner-a", reportingDate: date, work: { id: claimed.id, leaseToken: claimed.leaseToken! } };
}
async function accepts(scope: any) { return storage.writeWithGA4RefreshOwnership(scope, async () => true); }

describe.skipIf(!testUrl)("GA4 refresh invalidation on ordinary input edits", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 2 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, application_name: schemaName, max: 4 });
    database.current = drizzle(pool, { schema }); database.pool = pool;
    const dialect = new PgDialect();
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map((column: any) => {
        const value = column.default;
        const defaultSql = value instanceof SQL ? dialect.sqlToQuery(value).sql
          : typeof value === "string" ? `'${value.replace(/'/g, "''")}'` : String(value);
        return `"${column.name}" ${column.getSQLType()}${column.notNull ? " NOT NULL" : ""}${value !== undefined ? ` DEFAULT ${defaultSql}` : ""}${column.primary ? " PRIMARY KEY" : ""}`;
      });
      await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(", ")})`);
    }
    await pool.query(readFileSync(new URL("../migrations/0020_add_ga4_refresh_work.sql", import.meta.url), "utf8"));
    await pool.query(readFileSync(new URL("../migrations/0021_add_ga4_refresh_recovery.sql", import.meta.url), "utf8"));
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`); await admin?.end(); });
  beforeEach(async () => {
    await pool.query("DELETE FROM ga4_refresh_work");
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    for (const id of ["a", "b"]) {
      await database.current.insert(schema.campaigns).values({ id, ownerId: `owner-${id}`, name: id,
        status: "active", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: "sale" });
      await database.current.insert(schema.ga4Connections).values({ id: `connection-${id}`, campaignId: id,
        propertyId: `property-${id}`, method: "access_token", importStartDate: "2026-09-04", isPrimary: true,
        accessToken: "old-token", refreshToken: "keep-refresh", clientSecret: "keep-secret" });
    }
  });

  const kpi = { campaignId: "a", platformType: "google_analytics", name: "Total Sessions", metric: "sessions", targetValue: "100", unit: "count", alertsEnabled: false };
  it.each([true, false])("V1-073 requires a surviving campaign before source replacement (durable table=%s)", async durable => {
    await storage.replaceGa4CsvRevenueSourceWithRecords("b", null,
      { campaignId: "b", sourceType: "csv", platformContext: "ga4", currency: "EUR", mappingConfig: "{}" },
      [{ campaignId: "b", date, revenue: "100.00", currency: "EUR" }]);
    if (!durable) await pool.query('ALTER TABLE ga4_refresh_work RENAME TO suspended_refresh_work');
    try {
      const source = { campaignId: "a", sourceType: "csv", platformContext: "ga4", currency: "EUR", mappingConfig: "{}" } as any;
      const records = [{ campaignId: "a", date, revenue: "100.00", currency: "EUR" }];
      await pool.query("DELETE FROM campaigns WHERE id='a'");
      expect(await storage.updateCampaignWithGA4DailyInvalidation("a", { currency: "USD" })).toBeUndefined();
      await expect(storage.replaceGa4CsvRevenueSourceWithRecords("a", null, source, records)).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      await expect(storage.replaceSpendSourceWithRecords("a", null, "csv", "ga4", source,
        [{ campaignId: "a", date, spend: "100.00", currency: "EUR" }])).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      expect((await pool.query("SELECT count(*)::int n FROM revenue_sources WHERE campaign_id='a'")).rows[0].n).toBe(0);
      expect((await pool.query("SELECT count(*)::int n FROM spend_sources WHERE campaign_id='a'")).rows[0].n).toBe(0);
      expect((await pool.query("SELECT count(*)::int n FROM revenue_records WHERE campaign_id='b'")).rows[0].n).toBe(1);
      const write = vi.fn();
      await expect((storage as any).writeGA4RefreshInputChange(["b", "a", "b"], write)).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      expect(write).not.toHaveBeenCalled();
    } finally { if (!durable) await pool.query('ALTER TABLE suspended_refresh_work RENAME TO ga4_refresh_work'); }
  });
  it("V1-073 rejects a save waiting behind a committed campaign deletion", async () => {
    const deleting = await pool.connect();
    let save: Promise<unknown> | undefined;
    try {
      await deleting.query('BEGIN'); await deleting.query("DELETE FROM campaigns WHERE id='a'");
      let settled = false;
      save = storage.replaceGa4CsvRevenueSourceWithRecords("a", null,
        { campaignId: "a", sourceType: "csv", currency: "EUR", mappingConfig: "{}" },
        [{ campaignId: "a", date, revenue: "100.00", currency: "EUR" }]).then(
          value => { settled = true; return value; }, error => { settled = true; return error; });
      await new Promise(resolve => setTimeout(resolve, 30)); expect(settled).toBe(false);
      await deleting.query('COMMIT');
      expect(await save).toMatchObject({ message: "GA4_REFRESH_TARGET_SCOPE_CHANGED" });
      expect((await pool.query("SELECT count(*)::int n FROM revenue_records WHERE campaign_id='a'")).rows[0].n).toBe(0);
    } finally { await deleting.query('ROLLBACK'); deleting.release(); await save; }
  });
  const benchmark = { campaignId: "a", platformType: "google_analytics", category: "traffic", name: "Sessions", metric: "sessions", benchmarkValue: "100", unit: "count" };
  const source = { campaignId: "a", sourceType: "google_sheets", platformContext: "ga4", mappingConfig: "original" };
  async function publishedCampaign() {
    const scope = await claim();
    await pool.query("UPDATE ga4_refresh_work SET status='completed',lease_token=NULL,lease_expires_at=NULL,completed_at=now() WHERE id=$1", [scope.work.id]);
    for (const campaignId of ["a", "b"]) await database.current.insert(schema.metricSnapshots).values({ campaignId,
      snapshotType: "executive_summary_daily", reportingDate: date,
      notes: `ga4_aligned_refresh_v1:${date}:2026-10-18T08:00:00Z`, metrics: { sessions: 3433 } });
    return {
      work: (await pool.query("SELECT * FROM ga4_refresh_work ORDER BY id")).rows,
      snapshots: (await pool.query("SELECT * FROM metric_snapshots ORDER BY campaign_id")).rows,
      version: await storage.getGA4PublicationVersion("a"),
    };
  }
  it.each([false, true])("preserves the completed publication on a campaign rename (full edit form=%s)", async fullForm => {
    await database.current.update(schema.campaigns).set({ budget: "30000.00", startDate: new Date("2026-09-04T00:00:00Z") });
    const before = await publishedCampaign();
    const values = fullForm ? schema.insertCampaignSchema.partial().parse({ name: "Promo", clientWebsite: null,
      label: null, budget: "30000.00", currency: "EUR", conversionValue: null,
      reportingTimeZone: "Europe/Amsterdam", startDate: "2026-09-04", endDate: null }) : { name: "Promo" };
    expect(await storage.updateCampaign("a", values)).toMatchObject({ id: "a", name: "Promo", currency: "EUR" });
    expect((await pool.query("SELECT * FROM ga4_refresh_work ORDER BY id")).rows).toEqual(before.work);
    expect((await pool.query("SELECT * FROM metric_snapshots ORDER BY campaign_id")).rows).toEqual(before.snapshots);
    expect(await storage.getGA4PublicationVersion("a")).toBe(before.version);
    expect((await storage.getCampaign("b"))?.name).toBe("b");
  });
  it("preserves a running worker on rename and still rejects its later real input edit", async () => {
    const scope = await claim();
    await storage.updateCampaign("a", { name: "Promo" });
    expect(await accepts(scope)).toBe(true);
    await expect(storage.getGA4PublicationVersion("a")).rejects.toThrow("GA4_REFRESH_PUBLICATION_BUSY");
    await storage.updateCampaign("a", { name: "Promo", ga4CampaignFilter: "other" });
    await expect(accepts(scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
  });
  it.each([
    { currency: "USD" }, { reportingTimeZone: "UTC" }, { ga4CampaignFilter: "other" }, { status: "paused" },
    { budget: "31000.00" }, { conversionValue: "5.00" }, { spend: "20.00" }, { clientId: "other-client" },
  ])("still invalidates a rename accompanied by changed inputs: %j", async change => {
    await publishedCampaign();
    await storage.updateCampaign("a", { name: "Promo", ...change });
    expect((await pool.query("SELECT scope_hash FROM ga4_refresh_work WHERE campaign_id='a'")).rows[0].scope_hash).toMatch(/^invalidated:/);
    expect((await pool.query("SELECT notes FROM metric_snapshots WHERE campaign_id='a'")).rows[0].notes).toBeNull();
    expect((await pool.query("SELECT notes FROM metric_snapshots WHERE campaign_id='b'")).rows[0].notes).toContain("ga4_aligned_refresh_v1:");
  });
  it("does not restore a missing publication marker during a rename", async () => {
    await publishedCampaign();
    await pool.query("UPDATE metric_snapshots SET notes=NULL WHERE campaign_id='a'");
    await storage.updateCampaign("a", { name: "Promo" });
    expect((await pool.query("SELECT notes FROM metric_snapshots WHERE campaign_id='a'")).rows[0].notes).toBeNull();
    expect(await storage.updateCampaign("missing", { name: "Promo" })).toBeUndefined();
  });
  it("rejects a rename waiting behind deletion without touching another campaign's publication", async () => {
    const before = await publishedCampaign();
    const deleting = await pool.connect();
    let rename: Promise<unknown> | undefined;
    try {
      await deleting.query("BEGIN"); await deleting.query("DELETE FROM campaigns WHERE id='a'");
      let settled = false;
      rename = storage.updateCampaign("a", { name: "Promo" }).then(value => { settled = true; return value; });
      await new Promise(resolve => setTimeout(resolve, 30)); expect(settled).toBe(false);
      await deleting.query("COMMIT");
      expect(await rename).toBeUndefined();
      expect((await pool.query("SELECT * FROM metric_snapshots ORDER BY campaign_id")).rows).toEqual(before.snapshots);
    } finally { await deleting.query("ROLLBACK"); deleting.release(); await rename; }
  });
  it("retains worker ownership guards for a rename supplied by an owned refresh", async () => {
    const scope = await claim();
    await expect(storage.updateCampaign("b", { name: "Promo" }, { refreshScope: scope })).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    await pool.query("UPDATE ga4_refresh_work SET lease_expires_at=now()-interval '1 second' WHERE id=$1", [scope.work.id]);
    await expect(storage.updateCampaign("a", { name: "Promo" }, { refreshScope: scope })).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    expect((await storage.getCampaign("a"))?.name).toBe("a");
  });
  it("V1-087 handles an ordinary currency write chosen from a stale API read without invalidating a same-currency edit", async () => {
    await database.current.insert(schema.ga4DailyMetrics).values({ campaignId: "a", propertyId: "property-a", date, revenue: "100.00" });
    await storage.updateCampaign("a", { currency: "EUR", name: "Renamed" });
    expect((await storage.getGA4DailyMetrics("a", "property-a", date, date))).toHaveLength(1);
    await storage.updateCampaign("a", { currency: "USD" });
    expect((await storage.getGA4DailyMetrics("a", "property-a", date, date))).toHaveLength(0);
  });
  it.each(["0.00", "-10.00", "100.00"])("V1-035 recognizes real out-of-window materialization %s without adding it to dated totals", async (revenue) => {
    await database.current.insert(schema.revenueSources).values({ id: "source-a", campaignId: "a", sourceType: "csv", platformContext: "ga4",
      currency: "EUR", isActive: true, createdAt: new Date("2026-10-01T00:00:00Z") });
    await database.current.insert(schema.revenueRecords).values({ campaignId: "a", revenueSourceId: "source-a", date: "2026-10-18", revenue, currency: "EUR" });
    expect(await storage.getRevenueTotalForRange("a", "1900-01-01", date, "ga4")).toEqual({ totalRevenue: 0, currency: "EUR", sourceIds: [] });
    expect(await storage.getRevenueTotalForRange("a", "1900-01-01", "2026-10-18", "ga4"))
      .toEqual({ totalRevenue: Number(revenue), currency: "EUR", sourceIds: ["source-a"] });
    expect(await storage.getRevenueTotalForRange("b", "1900-01-01", "2026-10-18", "ga4")).toEqual({ totalRevenue: 0, currency: "EUR", sourceIds: [] });
  });
  it("V1-035 rejects missing materialization and cross-campaign records before applying a real future-record fallback", async () => {
    await database.current.insert(schema.revenueSources).values({ id: "source-a", campaignId: "a", sourceType: "csv", platformContext: "ga4",
      currency: "EUR", isActive: true, createdAt: new Date("2026-10-01T00:00:00Z") });
    await database.current.insert(schema.revenueRecords).values({ campaignId: "b", revenueSourceId: "source-a", date: "2026-10-18", revenue: "100.00", currency: "EUR" });
    await expect(storage.getRevenueTotalForRange("a", "1900-01-01", date, "ga4"))
      .rejects.toMatchObject({ code: "GA4_REVENUE_MATERIALIZATION_INCOMPLETE" });
    await database.current.insert(schema.revenueRecords).values({ campaignId: "a", revenueSourceId: "source-a", date: "2026-10-18", revenue: "100.00", currency: "USD" });
    await expect(storage.getRevenueTotalForRange("a", "1900-01-01", date, "ga4"))
      .rejects.toMatchObject({ code: "GA4_REVENUE_CURRENCY_INTEGRITY_ERROR" });
  });
  it("V1-087 invalidates only the edited campaign's native facts and rejects its old worker", async () => {
    const scope = await claim();
    for (const campaignId of ["a", "b"]) {
      await database.current.insert(schema.ga4DailyMetrics).values({ campaignId, propertyId: `property-${campaignId}`, date, revenue: "100.00" });
      await database.current.insert(schema.ga4OverviewSnapshots).values({ campaignId, propertyId: `property-${campaignId}`,
        windowStart: "2026-09-04", windowEnd: date, campaignBreakdown: { totals: { revenue: 100 }, meta: { currencyCode: "EUR" } }, landingPages: {}, conversionEvents: {} });
      await database.current.insert(schema.metricSnapshots).values({ campaignId, snapshotType: "financial_daily", reportingDate: date,
        metrics: { financialDaily: { currency: "EUR" } } });
    }
    expect(await storage.updateCampaignWithGA4DailyInvalidation("a", { currency: "USD" })).toMatchObject({ id: "a", currency: "USD" });
    expect((await pool.query("SELECT campaign_id,revenue FROM ga4_daily_metrics")).rows).toEqual([{ campaign_id: "b", revenue: "100.00" }]);
    expect((await pool.query("SELECT campaign_id FROM ga4_overview_snapshots")).rows).toEqual([{ campaign_id: "b" }]);
    const retained = (await pool.query("SELECT campaign_id,metrics FROM metric_snapshots ORDER BY campaign_id")).rows;
    expect(retained).toEqual(["a", "b"].map(campaign_id => ({ campaign_id, metrics: { financialDaily: { currency: "EUR" } } })));
    expect((await storage.getCampaign("b"))?.currency).toBe("EUR");
    await expect(accepts(scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
  });
  it("V1-087 rolls back currency and daily deletion together when Overview invalidation fails", async () => {
    const scope = await claim();
    await database.current.insert(schema.ga4DailyMetrics).values({ campaignId: "a", propertyId: "property-a", date, revenue: "100.00" });
    await database.current.insert(schema.ga4OverviewSnapshots).values({ campaignId: "a", propertyId: "property-a",
      windowStart: "2026-09-04", windowEnd: date, campaignBreakdown: {}, landingPages: {}, conversionEvents: {} });
    await pool.query("CREATE FUNCTION reject_currency_invalidation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced currency invalidation failure'; END $$");
    await pool.query("CREATE TRIGGER reject_currency_invalidation BEFORE DELETE ON ga4_overview_snapshots FOR EACH ROW EXECUTE FUNCTION reject_currency_invalidation()");
    try { await expect(storage.updateCampaignWithGA4DailyInvalidation("a", { currency: "USD" })).rejects.toThrow("forced currency invalidation failure"); }
    finally { await pool.query("DROP TRIGGER reject_currency_invalidation ON ga4_overview_snapshots"); await pool.query("DROP FUNCTION reject_currency_invalidation()"); }
    expect((await storage.getCampaign("a"))?.currency).toBe("EUR");
    expect((await pool.query("SELECT revenue FROM ga4_daily_metrics WHERE campaign_id='a'")).rows).toEqual([{ revenue: "100.00" }]);
    expect(await accepts(scope)).toBe(true);
  });
  it.each(["LinkedIn", "Meta", "Instagram", "TikTok"])("invalidates native work for %s connection create, edit and delete", async platform => {
    const methods = storage as any;
    const payload = { campaignId: "a", method: "manual_token", accessToken: "test", adAccountId: "account", advertiserId: "account" };
    let scope = await claim();
    await methods[`create${platform}Connection`](payload);
    await expect(accepts(scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    scope = await claim();
    await methods[`update${platform}Connection`]("a", { accessToken: "replacement" });
    await expect(accepts(scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    scope = await claim();
    await methods[`delete${platform}Connection`]("a");
    await expect(accepts(scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    expect((await storage.getCampaign("b"))?.ownerId).toBe("owner-b");
  });
  it("only activates automatic recovery for active native-only campaign scopes", async () => {
    await pool.query("UPDATE ga4_connections SET property_id='542352127'");
    expect(await storage.isGA4NativeRecoveryEligible("a")).toBe(true);
    expect(await storage.isGA4NativeRecoveryEligible("missing")).toBe(false);
    await storage.createRevenueSource(source);
    expect(await storage.isGA4NativeRecoveryEligible("a")).toBe(false);
    expect(await storage.isGA4NativeRecoveryEligible("b")).toBe(true);
    await pool.query("UPDATE revenue_sources SET is_active=false");
    expect(await storage.isGA4NativeRecoveryEligible("a")).toBe(true);
    await storage.createMetaConnection({ campaignId: "a", method: "manual_token", adAccountId: "account" });
    expect(await storage.isGA4NativeRecoveryEligible("a")).toBe(false);
    await storage.deleteMetaConnection("a");
    await storage.updateCampaign("a", { status: "paused" });
    expect(await storage.isGA4NativeRecoveryEligible("a")).toBe(false);
  });
  it.each(['csv', 'manual', 'custom', 'google_sheets', 'hubspot', 'salesforce', 'shopify'])(
    'allows explicitly supported financial recovery for %s without weakening the native-only gate', async sourceType => {
      await pool.query("UPDATE ga4_connections SET property_id='542352127'");
      await storage.createRevenueSource({ ...source, sourceType });
      expect(await storage.isGA4NativeRecoveryEligible('a')).toBe(false);
      expect(await storage.isGA4NativeRecoveryEligible('a', { includeFinancialSources: true } as any)).toBe(true);
      const scope = await claim();
      await storage.createSpendSource({ ...source, sourceType: 'csv' });
      await expect(accepts(scope)).rejects.toThrow('GA4_REFRESH_WORK_OWNERSHIP_LOST');
    });
  it('rejects deferred and unknown financial source types during recovery', async () => {
    await pool.query("UPDATE ga4_connections SET property_id='542352127'");
    const saved = await storage.createSpendSource({ ...source, sourceType: 'ad_platforms', mappingConfig: JSON.stringify({ platform: 'meta' }) });
    expect(await storage.isGA4NativeRecoveryEligible('a', { includeFinancialSources: true } as any)).toBe(false);
    await storage.updateSpendSource(saved.id, { mappingConfig: JSON.stringify({ platform: 'google_ads' }) });
    expect(await storage.isGA4NativeRecoveryEligible('a', { includeFinancialSources: true } as any)).toBe(true);
    await storage.updateSpendSource(saved.id, { sourceType: 'future-provider' });
    expect(await storage.isGA4NativeRecoveryEligible('a', { includeFinancialSources: true } as any)).toBe(false);
  });
  it("renews an ordinary credential without invalidating itself, but rejects reconnection and edited inputs", async () => {
    await ensure(); await storage.retireGA4RefreshWork("a");
    const version = await storage.getGA4PublicationVersion("a");
    const expectedConnection = await storage.getGA4Connection("a");
    const options = { publicationVersion: { campaignId: "a", version }, expectedConnection };
    expect(await storage.updateGA4ConnectionTokens("connection-a", { accessToken: "renewed" }, options)).toMatchObject({ accessToken: "renewed", refreshToken: "keep-refresh", clientSecret: "keep-secret" });
    expect(await storage.getGA4PublicationVersion("a")).toBe(version);
    await expect(storage.updateGA4ConnectionTokens("connection-a", { accessToken: "stale" }, options)).rejects.toThrow("GA4_REFRESH_CONNECTION_CHANGED");
    const fresh = { ...options, expectedConnection: await storage.getGA4Connection("a") };
    await storage.updateGA4Connection("connection-a", { accessToken: "user-reconnected" });
    await expect(storage.updateGA4ConnectionTokens("connection-a", { accessToken: "stale" }, fresh)).rejects.toThrow("GA4_REFRESH_PUBLICATION_CHANGED");
    expect((await storage.getGA4Connection("a"))?.accessToken).toBe("user-reconnected");
  });
  const changes: Array<[string, () => Promise<unknown>]> = [
    ["campaign edit then restore", async () => { await storage.updateCampaign("a", { ga4CampaignFilter: "other" }); await storage.updateCampaign("a", { ga4CampaignFilter: "sale" }); }],
    ["GA4 reconnect with unchanged property", () => storage.updateGA4Connection("connection-a", { accessToken: "replacement" })],
    ["GA4 connection add", () => storage.createGA4Connection({ campaignId: "a", propertyId: "property-new", method: "access_token", accessToken: "replacement" })],
    ["Revenue add", () => storage.createRevenueSource(source)],
    ["Spend add", () => storage.createSpendSource(source)],
    ["KPI add", () => storage.createKPI(kpi)],
    ["Benchmark add", () => storage.createBenchmark(benchmark)],
  ];
  it.each(changes)("rejects a late owned write after %s", async (_name, change) => {
    const scope = await claim();
    await change();
    await expect(accepts(scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    const next = await claim(); expect(next.work.id).not.toBe(scope.work.id); expect(await accepts(next)).toBe(true);
  });
  it.each(["revenue", "spend"] as const)("detects %s edit-then-restore and deactivation", async kind => {
    const saved = kind === "revenue" ? await storage.createRevenueSource(source) : await storage.createSpendSource(source);
    const scope = await claim();
    const update = kind === "revenue" ? storage.updateRevenueSource.bind(storage) : storage.updateSpendSource.bind(storage);
    await update(saved.id, { mappingConfig: "new" }); await update(saved.id, { mappingConfig: "original" });
    await expect(accepts(scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    const next = await claim();
    if (kind === "revenue") await storage.deleteRevenueSourceWithRecords("a", saved.id, "ga4");
    else await storage.deleteSpendSourceWithRecords("a", saved.id, "ga4");
    await expect(accepts(next)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
  });
  it.each(["KPI", "Benchmark"] as const)("detects %s edit-then-restore and deletion", async kind => {
    const saved = kind === "KPI" ? await storage.createKPI(kpi) : await storage.createBenchmark(benchmark);
    const scope = await claim();
    if (kind === "KPI") { await storage.updateCanonicalGA4KPI(saved.id, { targetValue: "200" }); await storage.updateCanonicalGA4KPI(saved.id, { targetValue: "100" }); }
    else { await storage.updateBenchmark(saved.id, { benchmarkValue: "200" }); await storage.updateBenchmark(saved.id, { benchmarkValue: "100" }); }
    await expect(accepts(scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    const next = await claim();
    if (kind === "KPI") await storage.deleteKPI(saved.id); else await storage.deleteBenchmark(saved.id);
    await expect(accepts(next)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
  });
  it("leaves another campaign and non-GA4 source edits independent", async () => {
    const scope = await claim();
    await storage.updateCampaign("b", { name: "other" });
    await storage.createRevenueSource({ ...source, campaignId: "b" });
    await storage.createSpendSource({ ...source, platformContext: "linkedin" });
    expect(await accepts(scope)).toBe(true);
  });
  it("rolls back a failed input edit without invalidating the active owner", async () => {
    const scope = await claim();
    await expect(storage.createRevenueSource({ ...source, sourceType: null } as any)).rejects.toThrow();
    expect(await accepts(scope)).toBe(true);
  });
  it("does not invalidate the claim for its own credential save", async () => {
    const scope = await claim();
    await storage.updateGA4ConnectionTokens("connection-a", { accessToken: "rotated" }, { refreshScope: scope });
    expect(await accepts(scope)).toBe(true);
  });
  it.each(["revenue", "spend"] as const)("invalidates raw %s record inserts and removals", async kind => {
    const saved = kind === "revenue" ? await storage.createRevenueSource(source) : await storage.createSpendSource(source);
    const first = await claim();
    if (kind === "revenue") await storage.createRevenueRecords([{ campaignId: "a", revenueSourceId: saved.id, date, revenue: "42" }]);
    else await storage.createSpendRecords([{ campaignId: "a", spendSourceId: saved.id, date, spend: "42" }]);
    await expect(accepts(first)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    const second = await claim();
    if (kind === "revenue") await storage.deleteRevenueRecordsBySource(saved.id); else await storage.deleteSpendRecordsBySource(saved.id);
    await expect(accepts(second)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
  });
  it.each(["Sheets", "Salesforce", "HubSpot", "Shopify", "Google Ads", "dedicated Google Ads"])("invalidates %s connection edits even when restored", async kind => {
    const targets: Record<string, [any, any, (values: any) => Promise<unknown>]> = {
      Sheets: [schema.googleSheetsConnections, { spreadsheetId: "sheet", method: "oauth" }, values => storage.updateGoogleSheetsConnection("provider-a", values)],
      Salesforce: [schema.salesforceConnections, {}, values => storage.updateSalesforceConnection("provider-a", values)],
      HubSpot: [schema.hubspotConnections, {}, values => storage.updateHubspotConnection("provider-a", values)],
      Shopify: [schema.shopifyConnections, { shopDomain: "a.myshopify.com" }, values => storage.updateShopifyConnection("provider-a", values)],
      "Google Ads": [schema.googleAdsConnections, { customerId: "customer", method: "oauth" }, values => storage.updateGoogleAdsConnection("a", values)],
      "dedicated Google Ads": [schema.ga4GoogleAdsSpendConnections, { customerId: "customer", method: "oauth" }, values => storage.updateGA4GoogleAdsSpendConnection("a", values)],
    };
    const [table, values, update] = targets[kind];
    await database.current.insert(table).values({ id: "provider-a", campaignId: "a", ...values });
    const scope = await claim();
    if (kind.includes("Google Ads")) { await update({ customerId: "changed" }); await update({ customerId: "customer" }); }
    else { await update({ isActive: false }); await update({ isActive: true }); }
    await expect(accepts(scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
  });
  it.each(["Sheets", "Salesforce", "HubSpot", "Shopify", "Google Ads"])("invalidates %s connection creation and deletion", async kind => {
    const targets: Record<string, [(values: any) => Promise<any>, (id: string) => Promise<boolean>, any]> = {
      Sheets: [values => storage.createGoogleSheetsConnection(values), id => storage.deleteGoogleSheetsConnection(id), { spreadsheetId: "sheet", method: "oauth" }],
      Salesforce: [values => storage.createSalesforceConnection(values), id => storage.deleteSalesforceConnection(id), {}],
      HubSpot: [values => storage.createHubspotConnection(values), id => storage.deleteHubspotConnection(id), {}],
      Shopify: [values => storage.createShopifyConnection(values), id => storage.deleteShopifyConnection(id), { shopDomain: "a.myshopify.com" }],
      "Google Ads": [values => storage.createGoogleAdsConnection(values), () => storage.deleteGoogleAdsConnection("a"), { customerId: "customer", method: "oauth" }],
    };
    const [create, remove, values] = targets[kind]; const first = await claim();
    const saved = await create({ campaignId: "a", ...values });
    await expect(accepts(first)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    const next = await claim(); expect(await remove(saved.id)).toBe(true);
    await expect(accepts(next)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
  });
  it.each(["Shopify", "Google Ads", "dedicated Google Ads"])("invalidates %s connection replacement", async kind => {
    const scope = await claim();
    if (kind === "Shopify") await storage.replaceShopifyConnection({ campaignId: "a", shopDomain: "a.myshopify.com" } as any);
    else if (kind === "Google Ads") await storage.replaceGoogleAdsConnection({ campaignId: "a", customerId: "customer", method: "oauth" } as any);
    else await storage.replaceGA4GoogleAdsSpendConnection({ campaignId: "a", customerId: "customer", method: "oauth" } as any, []);
    await expect(accepts(scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
  });
  it("changes Sheets primary selection atomically and promotes the remaining connection on delete", async () => {
    const first = await storage.createGoogleSheetsConnection({ campaignId: "a", spreadsheetId: "first", method: "oauth" } as any);
    const second = await storage.createGoogleSheetsConnection({ campaignId: "a", spreadsheetId: "second", method: "oauth" } as any);
    const scope = await claim(); expect(await storage.setPrimaryGoogleSheetsConnection("a", second.id)).toBe(true);
    await expect(accepts(scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    expect(await storage.deleteGoogleSheetsConnection(second.id)).toBe(true);
    expect((await pool.query("SELECT is_primary FROM google_sheets_connections WHERE id=$1", [first.id])).rows[0].is_primary).toBe(true);
  });

  it("V1-051 publishes complete cache atomically and rejects stale or replaced inputs", async () => {
    const source = await storage.createGoogleSheetsConnection({ campaignId: "a", spreadsheetId: "book", sheetName: "Main", purpose: "general", method: "oauth" } as any);
    const write = (started: string, value: number, expected = source) => storage.updateGoogleSheetsConnection(source.id, {
      cachedData: { headers: ["Clicks"], rows: [[value]], totalRows: 1, complete: true, spreadsheetId: "book", sheetName: "Main", readStartedAt: started },
      lastDataRefreshAt: new Date(),
    } as any, { expectedConnection: expected });
    await write("2026-10-23T10:00:00Z", 20);
    await expect(write("2026-10-23T09:00:00Z", 10)).rejects.toThrow("GOOGLE_SHEETS_CACHE_INPUT_CHANGED");
    expect((await pool.query("SELECT cached_data FROM google_sheets_connections WHERE id=$1", [source.id])).rows[0].cached_data.rows).toEqual([[20]]);
    await storage.updateGoogleSheetsConnection(source.id, { sheetName: "Renamed", cachedData: null, lastDataRefreshAt: null } as any);
    await expect(write("2026-10-23T11:00:00Z", 30)).rejects.toThrow("GOOGLE_SHEETS_CACHE_INPUT_CHANGED");
    expect((await pool.query("SELECT cached_data FROM google_sheets_connections WHERE id=$1", [source.id])).rows[0].cached_data).toBeNull();
  });
  it("V1-051 cannot restore a deleted campaign or disconnected cache", async () => {
    const source = await storage.createGoogleSheetsConnection({ campaignId: "a", spreadsheetId: "book", sheetName: "Main", purpose: "general", method: "oauth" } as any);
    const values = { cachedData: { headers: [], rows: [], totalRows: 0, complete: true, spreadsheetId: "book", sheetName: "Main", readStartedAt: new Date().toISOString() }, lastDataRefreshAt: new Date() } as any;
    await storage.updateGoogleSheetsConnection(source.id, { isActive: false, cachedData: null } as any);
    await expect(storage.updateGoogleSheetsConnection(source.id, values, { expectedConnection: source })).rejects.toThrow("GOOGLE_SHEETS_CACHE_INPUT_CHANGED");
    await pool.query("DELETE FROM campaigns WHERE id='a'");
    await expect(storage.updateGoogleSheetsConnection(source.id, values, { expectedConnection: source })).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    expect((await pool.query("SELECT cached_data FROM google_sheets_connections WHERE id=$1", [source.id])).rows[0].cached_data).toBeNull();
  });
  it("V1-051 serializes competing cache completions and keeps the newest read", async () => {
    const source = await storage.createGoogleSheetsConnection({ campaignId: "a", spreadsheetId: "book", sheetName: "Main", purpose: "general", method: "oauth" } as any);
    const write = (started: string, value: number) => storage.updateGoogleSheetsConnection(source.id, {
      cachedData: { headers: ["Clicks"], rows: [[value]], totalRows: 1, complete: true, spreadsheetId: "book", sheetName: "Main", readStartedAt: started }, lastDataRefreshAt: new Date(),
    } as any, { expectedConnection: source });
    const results = await Promise.allSettled([write("2026-10-23T12:00:00Z", 20), write("2026-10-23T11:00:00Z", 10)]);
    expect(results[0].status).toBe("fulfilled");
    expect((await pool.query("SELECT cached_data FROM google_sheets_connections WHERE id=$1", [source.id])).rows[0].cached_data.rows).toEqual([[20]]);
  });
  it("V1-051 rolls back a failed cache publication without moving the successful timestamp", async () => {
    const source = await storage.createGoogleSheetsConnection({ campaignId: "a", spreadsheetId: "book", sheetName: "Main", purpose: "general", method: "oauth" } as any);
    await pool.query("CREATE FUNCTION reject_sheets_cache() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced cache failure'; END $$");
    await pool.query("CREATE TRIGGER reject_sheets_cache BEFORE UPDATE ON google_sheets_connections FOR EACH ROW EXECUTE FUNCTION reject_sheets_cache()");
    try {
      await expect(storage.updateGoogleSheetsConnection(source.id, { cachedData: { headers: [], rows: [], totalRows: 0, complete: true, spreadsheetId: "book", sheetName: "Main", readStartedAt: new Date().toISOString() }, lastDataRefreshAt: new Date() } as any,
        { expectedConnection: source })).rejects.toThrow("forced cache failure");
      const saved = (await pool.query("SELECT cached_data, last_data_refresh_at FROM google_sheets_connections WHERE id=$1", [source.id])).rows[0];
      expect(saved.cached_data).toBeNull(); expect(saved.last_data_refresh_at).toBeNull();
    } finally { await pool.query("DROP TRIGGER reject_sheets_cache ON google_sheets_connections"); await pool.query("DROP FUNCTION reject_sheets_cache()"); }
  });
  it("keeps legacy Sheets writes and work invalidation in the same transaction", async () => {
    await pool.query("ALTER TABLE google_sheets_connections DROP COLUMN sheet_name");
    try {
      const created = await storage.createGoogleSheetsConnection({ campaignId: "a", spreadsheetId: "first", method: "oauth" } as any);
      const scope = await claim();
      await pool.query("CREATE FUNCTION reject_legacy_invalidation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced invalidation failure'; END $$");
      await pool.query("CREATE TRIGGER reject_legacy_invalidation BEFORE UPDATE ON ga4_refresh_work FOR EACH ROW EXECUTE FUNCTION reject_legacy_invalidation()");
      try { await expect(storage.updateGoogleSheetsConnection(created.id, { spreadsheetName: "must roll back" })).rejects.toThrow("forced invalidation failure"); }
      finally { await pool.query("DROP TRIGGER reject_legacy_invalidation ON ga4_refresh_work"); await pool.query("DROP FUNCTION reject_legacy_invalidation()"); }
      expect((await pool.query("SELECT spreadsheet_name FROM google_sheets_connections WHERE id=$1", [created.id])).rows[0].spreadsheet_name).toBeNull();
      expect(await accepts(scope)).toBe(true);
      await storage.updateGoogleSheetsConnection(created.id, { spreadsheetName: "O'Brien $1" });
      expect((await pool.query("SELECT spreadsheet_name FROM google_sheets_connections WHERE id=$1", [created.id])).rows[0].spreadsheet_name).toBe("O'Brien $1");
      await expect(accepts(scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
      expect(await storage.deleteGoogleSheetsConnection(created.id)).toBe(true);
    } finally { await pool.query("ALTER TABLE google_sheets_connections ADD COLUMN sheet_name text"); }
  });
  it("preserves completed work history and saved metrics while removing stale readiness", async () => {
    const scope = await claim();
    await pool.query("UPDATE ga4_refresh_work SET status='completed',lease_token=NULL,lease_expires_at=NULL,completed_at=clock_timestamp() WHERE id=$1", [scope.work.id]);
    const before = (await pool.query("SELECT completed_at FROM ga4_refresh_work WHERE id=$1", [scope.work.id])).rows[0];
    for (const campaignId of ["a", "b"]) await database.current.insert(schema.metricSnapshots).values({ campaignId,
      snapshotType: "executive_summary_daily", reportingDate: date, notes: `ga4_aligned_refresh_v1:${date}:2026-10-18T08:00:00Z`, metrics: { sessions: 2977 } });
    await storage.createRevenueSource(source);
    const work = (await pool.query("SELECT * FROM ga4_refresh_work WHERE id=$1", [scope.work.id])).rows[0];
    expect(work.status).toBe("completed"); expect(work.completed_at).toEqual(before.completed_at);
    const snapshots = (await pool.query("SELECT campaign_id,notes,metrics FROM metric_snapshots ORDER BY campaign_id")).rows;
    expect(snapshots[0]).toMatchObject({ campaign_id: "a", notes: null, metrics: { sessions: 2977 } });
    expect(snapshots[1].notes).toContain("ga4_aligned_refresh_v1:");
    expect((await ensure())!.id).not.toBe(scope.work.id);
  });
  it("rolls back the edit if work invalidation fails", async () => {
    const scope = await claim();
    await pool.query("CREATE FUNCTION reject_invalidation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced invalidation failure'; END $$");
    await pool.query("CREATE TRIGGER reject_invalidation BEFORE UPDATE ON ga4_refresh_work FOR EACH ROW EXECUTE FUNCTION reject_invalidation()");
    try { await expect(storage.createSpendSource(source)).rejects.toThrow("forced invalidation failure"); }
    finally { await pool.query("DROP TRIGGER reject_invalidation ON ga4_refresh_work"); await pool.query("DROP FUNCTION reject_invalidation()"); }
    expect((await pool.query("SELECT count(*) AS n FROM spend_sources")).rows[0].n).toBe("0");
    expect(await accepts(scope)).toBe(true);
  });
  it("serializes an ordinary input edit behind an owned write, then refuses its late follow-up", async () => {
    const saved = await storage.createRevenueSource(source); const scope = await claim();
    let release!: () => void, entered!: () => void;
    const hold = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    const publication = storage.writeWithGA4RefreshOwnership(scope, async tx => {
      await tx.execute(sql`UPDATE campaigns SET spend='12' WHERE id='a'`); entered(); await hold;
    });
    await started;
    const edit = storage.updateRevenueSource(saved.id, { mappingConfig: "new" });
    let blocked = false;
    try {
      const until = Date.now() + 3000;
      while (Date.now() < until) {
        blocked = Number((await pool.query("SELECT count(*) AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [schemaName])).rows[0].n) > 0;
        if (blocked) break;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    } finally { release(); }
    await publication; await edit;
    expect(blocked).toBe(true);
    expect((await storage.getRevenueSource("a", saved.id))?.mappingConfig).toBe("new");
    await expect(accepts(scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
  });
  it("rejects Revenue saves without durable publication support and preserves ordinary Spend compatibility", async () => {
    await pool.query("DROP TABLE ga4_refresh_work");
    try {
      await expect(storage.createRevenueSource(source)).rejects.toThrow("GA4_REVENUE_PUBLICATION_UNAVAILABLE");
      expect(await storage.getRevenueSources("a")).toEqual([]);
      expect(await storage.createSpendSource(source)).toMatchObject(source);
    }
    finally { await pool.query(readFileSync(new URL("../migrations/0020_add_ga4_refresh_work.sql", import.meta.url), "utf8"));
    await pool.query(readFileSync(new URL("../migrations/0021_add_ga4_refresh_recovery.sql", import.meta.url), "utf8")); }
  });
});
