import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fork, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableColumns, getTableName, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";
import { getLatestCompleteReportingDate } from "./utils/reporting-timezone";

const database = vi.hoisted(() => ({ current: null as any, pool: null as any }));
vi.mock("./db", () => ({ get db() { return database.current; }, get pool() { return database.pool; } }));
import { storage } from "./storage";
import { getGA4AlignedRefreshState } from "./ga4-daily-scheduler";

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "");
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL)
    throw new Error("Process tests require an isolated localhost database and no DATABASE_URL");
}
const schemaName = `ga4_process_it_${randomUUID().replace(/-/g, "")}`;
const date = getLatestCompleteReportingDate("Europe/Amsterdam");
const dueAt = new Date(Date.now() - 60_000).toISOString();
const tables = [schema.clients, schema.campaigns, schema.ga4Connections, schema.ga4DailyMetrics, schema.ga4OverviewSnapshots,
  schema.metricSnapshots, schema.kpis, schema.kpiProgress, schema.benchmarks, schema.benchmarkHistory, schema.notifications,
  schema.revenueSources, schema.spendSources, schema.revenueRecords, schema.spendRecords];
const children = new Set<ChildProcess>();
let admin: Pool, pool: Pool;
function worker(pauseAt = "", campaignId = "a", external = false) {
  const child = fork(fileURLToPath(new URL("./test-support/ga4-recovery-process-worker.ts", import.meta.url)), [], {
    execArgv: ["--import", "tsx"], silent: true, windowsHide: true,
    env: { ...process.env, GA4_TEST_DATABASE_URL: testUrl, GA4_TEST_SCHEMA: schemaName,
      GA4_TEST_REPORTING_DATE: date, GA4_TEST_DUE_AT: dueAt, GA4_TEST_PAUSE_AT: pauseAt, GA4_TEST_CAMPAIGN: campaignId, GA4_TEST_EXTERNAL: String(external) },
  });
  children.add(child);
  const messages: any[] = [];
  let output = "";
  child.stdout?.on("data", data => { output = (output + data).slice(-6000); });
  child.stderr?.on("data", data => { output = (output + data).slice(-6000); });
  child.on("message", message => messages.push(message));
  const exited = new Promise<void>(resolve => child.once("exit", () => { children.delete(child); resolve(); }));
  const until = async (type: string) => {
    const end = Date.now() + 30_000;
    while (Date.now() < end) {
      const message = messages.find(value => value.type === type);
      if (message) return message;
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Worker exited before ${type}: ${JSON.stringify(messages)}\n${output}`);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error(`Worker timeout before ${type}: ${JSON.stringify(messages)}\n${output}`);
  };
  return { child, until, exited, hasStage: () => messages.some(value => value.type === 'stage') };
}
const expire = () => pool.query("UPDATE ga4_refresh_work SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE campaign_id='a' AND status='running'");
async function verifyPublication(external = false) {
  const daily = await storage.getGA4DailyMetrics("a", "123456", date, date);
  expect(daily).toHaveLength(1); expect(daily[0]).toMatchObject({ sessions: 20, conversions: 2, revenue: "100.00" });
  expect((await storage.getGA4OverviewSnapshot("a", "123456"))?.campaignBreakdown).toMatchObject({ totals: { sessions: 20, conversions: 2, revenue: 100 } });
  expect((await storage.getKPI("kpi-a"))?.currentValue).toBe("20");
  expect((await storage.getBenchmark("benchmark-a"))?.currentValue).toBe("20");
  expect((await pool.query("SELECT * FROM kpi_progress WHERE kpi_id='kpi-a'")).rows).toHaveLength(1);
  expect((await pool.query("SELECT * FROM benchmark_history WHERE benchmark_id='benchmark-a'")).rows).toHaveLength(1);
  const snapshots = (await pool.query("SELECT * FROM metric_snapshots WHERE campaign_id='a'")).rows;
  expect(snapshots).toHaveLength(3);
  const financial = snapshots.find(row => row.snapshot_type === "financial_daily").metrics.financialDaily;
  expect(financial.inputs.revenue).toMatchObject({ available: true, value: external ? "125" : "100" });
  expect(financial.inputs.conversions).toMatchObject({ available: true, value: 2 });
  expect(financial.inputs.spend.available).toBe(false);
  expect(await getGA4AlignedRefreshState("a", date)).toMatchObject({ reportingDate: date });
  const alerts = (await pool.query("SELECT * FROM notifications WHERE campaign_id='a' AND type='performance-alert'")).rows;
  expect(alerts).toHaveLength(2);
  expect((await pool.query("SELECT status FROM ga4_refresh_work WHERE campaign_id='a' AND scope_hash NOT LIKE 'invalidated:%'")).rows).toEqual([{ status: "completed" }]);
  expect((await storage.getKPI("kpi-b"))?.currentValue).toBe("10");
  expect((await pool.query("SELECT * FROM notifications WHERE campaign_id='b'")).rows).toHaveLength(0);
}

describe.skipIf(!testUrl)("GA4 publication across real worker termination and restart", () => {
  it('limits separate application processes and recovers a slot after worker termination', async () => {
    const workers = Array.from({ length: 6 }, () => worker('property-slot'));
    try {
      await vi.waitFor(() => expect(workers.filter(value => value.hasStage())).toHaveLength(5), { timeout: 20000 });
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(workers.filter(value => value.hasStage())).toHaveLength(5);
      const terminated = workers.find(value => value.hasStage())!;
      terminated.child.kill(); await terminated.exited;
      await vi.waitFor(() => expect(workers.every(value => value.hasStage())).toBe(true), { timeout: 5000 });
      for (const value of workers.filter(value => value !== terminated)) value.child.send('continue');
      await Promise.all(workers.map(value => value.exited));
    } finally {
      for (const value of workers) if (value.child.exitCode === null && value.child.signalCode === null) value.child.kill();
      await Promise.all(workers.map(value => value.exited));
    }
  }, 45000);
  it.each(['external', 'derived', 'complete'])('replays external financial records after termination at %s', async stage => {
    await storage.createRevenueSource({ id: 'external-a', campaignId: 'a', sourceType: 'csv', platformContext: 'ga4', currency: 'EUR', mappingConfig: '{"selected":"sale"}' });
    const first = worker(stage, 'a', true);
    await first.until('stage'); first.child.kill(); await first.exited; await expire();
    const restarted = worker('', 'a', true);
    expect(await restarted.until('result')).toMatchObject({ status: stage === 'complete' ? 'already_completed' : 'completed' });
    await restarted.exited;
    await verifyPublication(true);
    expect((await pool.query("SELECT revenue FROM revenue_records WHERE campaign_id='a'")).rows).toEqual([{ revenue: '25.00' }]);
    expect((await pool.query("SELECT * FROM revenue_records WHERE campaign_id='b'")).rows).toHaveLength(0);
  }, 90000);
  it("bounds ordinary reads and exhausted checkout using the actual application pool", async () => {
    const process = worker("database");
    const result = await process.until("result"); await process.exited;
    expect(result).toMatchObject({ status: "database", settings: { statement: "2min", idle: "2min" },
      cancelled: true, timedOut: true, waiting: 0 });
    expect(result.elapsed).toBeGreaterThanOrEqual(9_500); expect(result.elapsed).toBeLessThan(13_000);
    expect(result.idle).toBe(result.total);
  }, 30_000);
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 2 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`);
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, max: 6 });
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
    for (const kind of ["financial_daily", "executive_summary_daily"]) {
      await pool.query(`CREATE UNIQUE INDEX ${kind}_identity ON metric_snapshots(campaign_id,reporting_date) WHERE snapshot_type='${kind}' AND reporting_date IS NOT NULL`);
    }
    await pool.query("CREATE UNIQUE INDEX overview_identity ON ga4_overview_snapshots(campaign_id,property_id)");
    for (const file of ["0020_add_ga4_refresh_work.sql", "0021_add_ga4_refresh_recovery.sql"])
      await pool.query(readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
  });
  beforeEach(async () => {
    await pool.query("DELETE FROM ga4_refresh_work");
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    for (const id of ["a", "b"]) {
      await database.current.insert(schema.clients).values({ id: `client-${id}`, ownerId: `owner-${id}`, name: id });
      await database.current.insert(schema.campaigns).values({ id, ownerId: `owner-${id}`, clientId: `client-${id}`, name: id,
        status: "active", reportingTimeZone: "Europe/Amsterdam", currency: "EUR", ga4CampaignFilter: "sale" });
      await database.current.insert(schema.ga4Connections).values({ id: `connection-${id}`, campaignId: id, propertyId: "123456",
        method: "access_token", accessToken: "isolated-test-token", isPrimary: true, importStartDate: date });
      await database.current.insert(schema.kpis).values({ id: `kpi-${id}`, campaignId: id, platformType: "google_analytics", name: "Sessions",
        metric: "sessions", currentValue: "10", targetValue: "100", unit: "count", alertsEnabled: true, alertThreshold: "100", alertCondition: "below" });
      await database.current.insert(schema.benchmarks).values({ id: `benchmark-${id}`, campaignId: id, platformType: "google_analytics", name: "Sessions",
        metric: "sessions", currentValue: "10", benchmarkValue: "100", category: "traffic", unit: "count", alertsEnabled: true, alertThreshold: "100", alertCondition: "below" });
    }
  });
  afterAll(async () => {
    await Promise.all(Array.from(children, child => new Promise<void>(resolve => { child.once("exit", () => resolve()); child.kill(); })));
    await pool?.end();
    await admin?.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`); await admin?.end();
  });
  it.each(["provider", "daily", "derived", "financial", "aggregate", "executive", "alerts", "complete"])("recovers after termination at %s without duplicate values or alerts", async stage => {
    const first = worker(stage);
    await first.until("stage");
    if (stage !== "complete") expect(await getGA4AlignedRefreshState("a", date)).toBeNull();
    first.child.kill(); await first.exited;
    await expire();
    const restarted = worker();
    expect(await restarted.until("result")).toMatchObject({ status: stage === "complete" ? "already_completed" : "completed" });
    await restarted.exited;
    await verifyPublication();
  }, 90_000);
  it("rejects a late provider response after another process has recovered and completed", async () => {
    const late = worker("provider"); await late.until("stage"); await expire();
    const replacement = worker(); expect(await replacement.until("result")).toMatchObject({ status: "completed" }); await replacement.exited;
    late.child.send("continue"); expect(await late.until("result")).toMatchObject({ status: "failed" }); await late.exited;
    await verifyPublication();
  }, 90_000);
  it("admits only one competing process and does not block another campaign", async () => {
    const owner = worker("provider"); await owner.until("stage");
    const competitor = worker(); expect(await competitor.until("result")).toMatchObject({ status: "failed", error: "GA4_REFRESH_WORK_BUSY" }); await competitor.exited;
    const other = worker("provider", "b"); await other.until("stage"); other.child.kill(); await other.exited;
    owner.child.send("continue"); expect(await owner.until("result")).toMatchObject({ status: "completed" }); await owner.exited;
    await verifyPublication();
  }, 90_000);
});
