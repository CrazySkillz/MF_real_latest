import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableColumns, getTableName, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";
import { buildExecutiveSummaryDailySnapshotInput } from "./utils/executive-summary-daily-snapshot";
import { addGA4InsightsDateDays } from "../shared/ga4-insights";

const database = vi.hoisted(() => ({ current: null as any }));
vi.mock("./db", () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from "./storage";

// This opt-in test must never use the application's database or a remote server.
const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "").trim();
if (testUrl) {
  const url = new URL(testUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1"
      || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) {
    throw new Error("GA4 PostgreSQL tests require 127.0.0.1/ga4_alignment_test and no DATABASE_URL");
  }
}
const schemaName = `ga4_it_${randomUUID().replace(/-/g, "")}`;
const tables = [schema.campaigns, schema.ga4Connections, schema.ga4DailyMetrics, schema.ga4OverviewSnapshots, schema.metricSnapshots];
const storage = new DatabaseStorage();
let admin: Pool;
let pool: Pool;
let created = false;
const queries: string[] = [];
const logger = { logQuery: (query: string) => { queries.push(query); } };
const date = "2026-10-16";
const campaign = (id = "a") => ({ id, name: `Test ${id}`, ownerId: `owner-${id}`, clientId: `client-${id}`, status: "active",
  currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: "sale" });
const connection = (id = "a") => ({ id: `connection-${id}`, campaignId: id, propertyId: `property-${id}`,
  method: "access_token", isPrimary: true, isActive: true, importStartDate: date });
const row = (sessions: number, id = "a") => ({ campaignId: id, propertyId: `property-${id}`, date, sessions,
  users: sessions, pageviews: sessions, conversions: 2, engagedSessions: 5, revenue: "100.00" });
async function overview(sessions: number, id = "a") {
  const { name, id: _id, ...campaignScope } = campaign(id);
  const { campaignId, method, isActive, ...connectionScope } = connection(id);
  const previous = await storage.getGA4OverviewSnapshot(id, `property-${id}`);
  return { windowStart: date, windowEnd: date, campaignBreakdown: { totals: { sessions } }, landingPages: {}, conversionEvents: {},
    refreshScope: { campaign: campaignScope, connection: connectionScope, previousUpdatedAt: previous?.updatedAt?.toISOString() ?? null } };
}
const write = (sessions: number, snapshot: any, id = "a") => storage.replaceGA4DailyMetricsWindow(id, `property-${id}`, date, date, [row(sessions, id)], snapshot);
async function expectSaved(sessions: number, id = "a") {
  const daily = await storage.getGA4DailyMetrics(id, `property-${id}`, date, date);
  expect(daily).toHaveLength(1);
  expect(daily[0].sessions).toBe(sessions);
  expect((await storage.getGA4OverviewSnapshot(id, `property-${id}`))?.campaignBreakdown).toEqual({ totals: { sessions } });
}

describe.skipIf(!testUrl)("GA4 publication with real PostgreSQL transactions", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 2 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, application_name: schemaName, max: 6 });
    database.current = drizzle(pool, { schema, logger });
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
    await pool.query("CREATE UNIQUE INDEX overview_identity ON ga4_overview_snapshots (campaign_id,property_id)");
    await pool.query("CREATE UNIQUE INDEX executive_identity ON metric_snapshots (campaign_id,reporting_date) WHERE snapshot_type='executive_summary_daily' AND reporting_date IS NOT NULL");
    // Force a failure after daily replacement, inside the actual storage transaction.
    await pool.query("ALTER TABLE ga4_overview_snapshots ADD CONSTRAINT test_rejected_payload CHECK (NOT (campaign_breakdown ? 'rejectForTest'))");
  });
  afterAll(async () => {
    await pool?.end();
    if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    await admin?.end();
  });
  beforeEach(async () => {
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    for (const id of ["a", "b"]) {
      await database.current.insert(schema.campaigns).values(campaign(id));
      await database.current.insert(schema.ga4Connections).values(connection(id));
      await write(10, await overview(10, id), id);
    }
  });

  it("commits daily and Overview values together without changing another campaign", async () => {
    await write(20, await overview(20));
    await expectSaved(20); await expectSaved(10, "b");
  });
  it.each([0, 1, 90, 365, 500, 501])("saves %i daily rows in bounded batches with identical values and scope", async count => {
    const start = addGA4InsightsDateDays(date, 1 - Math.max(count, 1))!;
    const input = Array.from({ length: count }, (_, i) => ({ ...row(i % 3 === 0 ? 0 : 10),
      date: addGA4InsightsDateDays(start, i)!, users: i % 3 === 0 ? 0 : "8", conversions: i % 3 === 0 ? 0 : "2",
      engagedSessions: i % 3 === 0 ? 0 : i % 3 === 1 ? null : 2.6,
      engagementRate: i % 3 === 0 ? 0 : "0.5", revenue: i % 3 === 0 ? "0" : "-12.345",
      revenueMetric: i % 3 === 0 ? null : "purchaseRevenue", isSimulated: i % 3 === 0,
    }));
    const untouched = [
      { ...row(17), date: addGA4InsightsDateDays(start, -1)! },
      { ...row(18), date: addGA4InsightsDateDays(date, 1)! },
      { ...row(19), propertyId: "other-property", date: start },
    ];
    const sentinels = await database.current.insert(schema.ga4DailyMetrics).values(untouched).returning();
    const snapshot = { ...await overview(20), windowStart: start };
    queries.length = 0;
    await expect(storage.replaceGA4DailyMetricsWindow("a", "property-a", start, date, input as any, snapshot))
      .resolves.toEqual({ replaced: count });
    expect(queries.filter(query => query.startsWith('insert into "ga4_daily_metrics"'))).toHaveLength(Math.ceil(count / 500));
    const saved = await storage.getGA4DailyMetrics("a", "property-a", start, date);
    expect(saved).toHaveLength(count);
    expect(new Set(saved.map(value => value.id)).size).toBe(count);
    for (const [i, actual] of saved.entries()) {
      expect(actual).toMatchObject({ campaignId: "a", propertyId: "property-a", date: input[i].date,
        users: i % 3 === 0 ? 0 : 8, sessions: i % 3 === 0 ? 0 : 10, pageviews: i % 3 === 0 ? 0 : 10,
        conversions: i % 3 === 0 ? 0 : 2, engagedSessions: i % 3 === 0 ? 0 : i % 3 === 1 ? null : 3,
        engagementRate: i % 3 === 0 ? "0.0000" : "0.5000", revenue: i % 3 === 0 ? "0.00" : "-12.35",
        revenueMetric: i % 3 === 0 ? null : "purchaseRevenue", isSimulated: i % 3 === 0,
      });
      expect(actual.id).toBeTruthy(); expect(actual.updatedAt).toBeInstanceOf(Date); expect(actual.createdAt).toBeInstanceOf(Date);
    }
    const all = await database.current.select().from(schema.ga4DailyMetrics);
    expect(all.filter((value: any) => sentinels.some((sentinel: any) => sentinel.id === value.id))).toEqual(sentinels);
    expect(await storage.getGA4OverviewSnapshot("a", "property-a")).toMatchObject({ windowStart: start, windowEnd: date,
      campaignBreakdown: snapshot.campaignBreakdown, landingPages: snapshot.landingPages, conversionEvents: snapshot.conversionEvents });
    await expectSaved(10, "b");
  });
  it("preserves the daily-only path and leaves its existing Overview untouched", async () => {
    const previous = await storage.getGA4OverviewSnapshot("a", "property-a");
    const start = addGA4InsightsDateDays(date, -1)!;
    const input = [{ ...row(20), date: start }, row(30)];
    await expect(storage.replaceGA4DailyMetricsWindow("a", "property-a", start, date, input)).resolves.toEqual({ replaced: 2 });
    expect((await storage.getGA4DailyMetrics("a", "property-a", start, date)).map(value => value.sessions)).toEqual([20, 30]);
    expect(await storage.getGA4OverviewSnapshot("a", "property-a")).toEqual(previous);
    await expectSaved(10, "b");
  });
  it.each(["metric", "campaign", "property", "date", "window"])("rejects an invalid %s before starting any replacement", async invalid => {
    const input: any = row(20);
    if (invalid === "metric") input.revenue = "NaN";
    if (invalid === "campaign") input.campaignId = "b";
    if (invalid === "property") input.propertyId = "property-b";
    if (invalid === "date") input.date = "2026-10-17";
    const snapshot = await overview(20);
    queries.length = 0;
    await expect(storage.replaceGA4DailyMetricsWindow("a", "property-a", invalid === "window" ? "bad" : date, date, [input], snapshot)).rejects.toThrow();
    expect(queries).toEqual([]);
    await expectSaved(10); await expectSaved(10, "b");
  });
  it.each(["later daily batch", "Overview"])("rolls back every batch when %s fails and allows retry", async failure => {
    const start = addGA4InsightsDateDays(date, -500)!;
    const input: any[] = Array.from({ length: 501 }, (_, i) => ({ ...row(20), date: addGA4InsightsDateDays(start, i)! }));
    const snapshot = { ...await overview(20), windowStart: start };
    const before = await database.current.select().from(schema.ga4DailyMetrics);
    const beforeOverview = await storage.getGA4OverviewSnapshot("a", "property-a");
    if (failure === "later daily batch") input[500].id = before.find((value: any) => value.campaignId === "b").id;
    const rejected = failure === "Overview" ? { ...snapshot, campaignBreakdown: { rejectForTest: true } } : snapshot;
    queries.length = 0;
    await expect(storage.replaceGA4DailyMetricsWindow("a", "property-a", start, date, input, rejected)).rejects.toThrow();
    expect(queries.filter(query => query.startsWith('insert into "ga4_daily_metrics"'))).toHaveLength(2);
    expect(await database.current.select().from(schema.ga4DailyMetrics)).toEqual(before);
    expect(await storage.getGA4OverviewSnapshot("a", "property-a")).toEqual(beforeOverview);
    delete input[500].id;
    await expect(storage.replaceGA4DailyMetricsWindow("a", "property-a", start, date, input, snapshot)).resolves.toEqual({ replaced: 501 });
    expect(await storage.getGA4DailyMetrics("a", "property-a", start, date)).toHaveLength(501);
    await expectSaved(10, "b");
  });
  it("rolls back daily replacement if Overview storage fails, then permits a clean retry", async () => {
    const snapshot = await overview(20);
    await expect(write(20, { ...snapshot, campaignBreakdown: { rejectForTest: true } })).rejects.toThrow();
    await expectSaved(10); await expectSaved(10, "b");
    await write(20, snapshot); await expectSaved(20);
  });
  it("keeps readers on the previous values and rolls back when a writer connection dies mid-publication", async () => {
    const holder = await pool.connect();
    const snapshot = await overview(20);
    let pending: Promise<unknown> | undefined;
    let blockedPid: number | undefined;
    const acquired: any[] = [];
    const trackClient = (client: any) => { acquired.push(client); };
    const connectionErrors: Error[] = [];
    const captureDisconnect = (error: Error) => { connectionErrors.push(error); };
    let writer: any;
    pool.on("acquire", trackClient);
    await pool.query("CREATE FUNCTION hold_overview_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(55439001); RETURN NEW; END $$");
    await pool.query("CREATE TRIGGER hold_overview_write BEFORE INSERT ON ga4_overview_snapshots FOR EACH ROW EXECUTE FUNCTION hold_overview_write()");
    try {
      await holder.query("BEGIN");
      await holder.query("SELECT pg_advisory_xact_lock(55439001)");
      pending = write(20, snapshot).then(() => null, error => error);
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const result = await admin.query("SELECT pid FROM pg_stat_activity WHERE application_name=$1 AND wait_event='advisory'", [schemaName]);
        blockedPid = result.rows[0]?.pid;
        if (blockedPid) break;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      expect(blockedPid).toBeTypeOf("number");
      writer = acquired.find(client => client.processID === blockedPid);
      expect(writer).toBeTruthy();
      writer.on("error", captureDisconnect); // pg also emits a client error for this intentional termination.
      const disconnected = new Promise(resolve => writer.once("end", resolve));
      await expectSaved(10); // The writer has already replaced daily rows inside its uncommitted transaction.
      await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid=$1 AND application_name=$2", [blockedPid, schemaName]);
      expect(await pending).toBeInstanceOf(Error);
      await disconnected;
      for (const error of connectionErrors) expect(error.message).toBe("Connection terminated unexpectedly");
    } finally {
      pool.off("acquire", trackClient);
      writer?.off("error", captureDisconnect);
      await holder.query("ROLLBACK"); holder.release();
      await pending;
      await pool.query("DROP TRIGGER hold_overview_write ON ga4_overview_snapshots");
      await pool.query("DROP FUNCTION hold_overview_write()");
    }
    await expectSaved(10); await expectSaved(10, "b");
    await write(20, snapshot); await expectSaved(20);
  });
  it("allows exactly one overlapping publication and rejects the superseded attempt", async () => {
    const first = await overview(20), second = await overview(30);
    const holder = await pool.connect();
    let pending: Promise<PromiseSettledResult<unknown>[]> | undefined;
    let blocked = 0;
    try {
      await holder.query("BEGIN");
      await holder.query("SELECT id FROM campaigns WHERE id='a' FOR UPDATE");
      pending = Promise.allSettled([write(20, first), write(30, second)]);
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const result = await admin.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [schemaName]);
        blocked = result.rows[0].count;
        if (blocked >= 2) break;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    } finally { await holder.query("ROLLBACK"); holder.release(); }
    const results = await pending!;
    expect(blocked).toBe(2);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.message).toContain("Another GA4 refresh");
    await expectSaved(results[0].status === "fulfilled" ? 20 : 30); await expectSaved(10, "b");
  });
  it.each(["currency", "scope", "inactive connection", "deleted campaign"])("rejects an in-flight %s change without overwriting saved data", async change => {
    const snapshot = await overview(20);
    if (change === "currency") await pool.query("UPDATE campaigns SET currency='USD' WHERE id='a'");
    if (change === "scope") await pool.query("UPDATE campaigns SET ga4_campaign_filter='other' WHERE id='a'");
    if (change === "inactive connection") await pool.query("UPDATE ga4_connections SET is_active=false WHERE campaign_id='a'");
    if (change === "deleted campaign") await pool.query("DELETE FROM campaigns WHERE id='a'");
    await expect(write(20, snapshot)).rejects.toThrow("scope changed");
    await expectSaved(10); await expectSaved(10, "b");
  });
  it("reads durable readiness on a new connection, invalidates only the target date and restores it after completion", async () => {
    const value = { value: 10, available: true, sources: ["ga4"] };
    const totals = { users: value, sessions: value, conversions: value, revenue: value, spend: { value: 0, available: false, sources: [] } };
    for (const id of ["a", "b"]) {
      await storage.upsertExecutiveSummaryDailySnapshot(buildExecutiveSummaryDailySnapshotInput({ campaignId: id, currency: "EUR",
        ga4PropertyId: `property-${id}`, ga4CampaignFilter: "sale", performanceSummary: { version: "performance_summary_aggregate_v3",
          currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: date, endDate: date, dataThroughDate: date, reportingTimeZone: "Europe/Amsterdam" },
          totals, sources: [{ id: "ga4", category: "web_analytics", connected: true, includedMetrics: ["users", "sessions", "conversions", "revenue"] }],
        } }));
      expect(await storage.markExecutiveSummaryDailySnapshotAligned(id, date, "2026-10-17T12:12:00.000Z")).toBe(true);
    }
    await pool.end();
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, application_name: schemaName, max: 6 });
    database.current = drizzle(pool, { schema, logger });
    const restarted = new DatabaseStorage();
    const marker = `ga4_aligned_refresh_v1:${date}:2026-10-17T12:12:00.000Z`;
    expect((await restarted.getExecutiveSummaryDailyComparisonData("a", date, date)).current?.notes).toBe(marker);
    await restarted.invalidateExecutiveSummaryDailySnapshotAlignment("a", "2026-10-15");
    expect((await restarted.getExecutiveSummaryDailyComparisonData("a", date, date)).current?.notes).toBe(marker);
    await restarted.invalidateExecutiveSummaryDailySnapshotAlignment("a", date);
    expect((await restarted.getExecutiveSummaryDailyComparisonData("a", date, date)).current?.notes).toBeNull();
    expect((await restarted.getExecutiveSummaryDailyComparisonData("b", date, date)).current?.notes).toBe(marker);
    expect(await restarted.markExecutiveSummaryDailySnapshotAligned("a", date, "2026-10-17T18:05:00.000Z")).toBe(true);
    expect((await restarted.getExecutiveSummaryDailyComparisonData("a", date, date)).current?.notes).toContain("18:05:00.000Z");
    expect(await restarted.markExecutiveSummaryDailySnapshotAligned("missing", date, "2026-10-17T18:05:00.000Z")).toBe(false);
  });
});
