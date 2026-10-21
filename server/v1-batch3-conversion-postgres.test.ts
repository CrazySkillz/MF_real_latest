import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableColumns, getTableName, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";

const database = vi.hoisted(() => ({ current: null as any }));
vi.mock("./db", () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from "./storage";

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "");
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== "127.0.0.1" || url.port !== "55443" || url.pathname !== "/ga4_alignment_test"
    || url.search || process.env.DATABASE_URL) throw new Error("Requires isolated localhost GA4 fixture database");
}
const schemaName = `ga4_precision_${randomUUID().replace(/-/g, "")}`;
const tables = [schema.campaigns, schema.ga4DailyMetrics, schema.ga4OverviewSnapshots, schema.metricSnapshots,
  schema.kpis, schema.kpiProgress, schema.kpiPeriods, schema.kpiAlerts, schema.benchmarks, schema.benchmarkHistory];
const date = "2026-10-18";
const storage = new DatabaseStorage();
const daily = (campaignId: string, conversions: number, propertyId = "123") => ({ campaignId, propertyId, date,
  sessions: 10, users: 8, pageviews: 20, engagedSessions: 5, engagementRate: "0.5", conversions, revenue: "100.00" });
let admin: Pool, pool: Pool, created = false;

describe.skipIf(!testUrl)("V1-079 PostgreSQL precision", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 1 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, max: 2 });
    database.current = drizzle(pool, { schema });
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
    await pool.query("CREATE UNIQUE INDEX daily_identity ON ga4_daily_metrics(campaign_id,property_id,date)");
    await pool.query("CREATE UNIQUE INDEX financial_identity ON metric_snapshots(campaign_id,reporting_date) WHERE snapshot_type='financial_daily' AND reporting_date IS NOT NULL");
    await pool.query("CREATE UNIQUE INDEX executive_identity ON metric_snapshots(campaign_id,reporting_date) WHERE snapshot_type='executive_summary_daily' AND reporting_date IS NOT NULL");
    await pool.query(readFileSync(new URL("../migrations/0025_ga4_fractional_conversions.sql", import.meta.url), "utf8"));
    await pool.query(readFileSync(new URL("../migrations/0026_goal_observed_value_precision.sql", import.meta.url), "utf8"));
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`); await admin?.end(); });
  beforeEach(async () => {
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    for (const id of ["a", "b"]) await database.current.insert(schema.campaigns).values({ id, ownerId: `owner-${id}`, name: id, currency: "EUR" });
  });

  it.each([0, 0.75, 0.000075, 2.125, 2])("round-trips credit %s through upsert, replacement and JSON without changing neighboring data", async conversions => {
    await storage.upsertGA4DailyMetrics([daily("a", 2), daily("b", 3), daily("a", 4, "456")]);
    await storage.upsertGA4DailyMetrics([daily("a", conversions)]);
    const rows = await storage.getGA4DailyMetrics("a", "123", date, date);
    expect(rows[0].conversions).toBe(conversions);
    expect(JSON.parse(JSON.stringify(rows))[0].conversions).toBe(conversions);
    await storage.replaceGA4DailyMetricsWindow("a", "123", date, date, [daily("a", conversions)]);
    expect((await storage.getGA4DailyMetrics("a", "123", date, date))[0].conversions).toBe(conversions);
    expect((await storage.getGA4DailyMetrics("b", "123", date, date))[0].conversions).toBe(3);
    expect((await storage.getGA4DailyMetrics("a", "456", date, date))[0].conversions).toBe(4);
    await expect(storage.replaceGA4DailyMetricsWindow("a", "123", date, date, [daily("b", 99)])).rejects.toThrow("scope mismatch");
    await expect(storage.replaceGA4DailyMetricsWindow("a", "123", date, date, [daily("a", NaN)])).rejects.toThrow("invalid metric");
    // Force an insert failure after DELETE and prove transaction rollback retains the prior fraction.
    await pool.query("ALTER TABLE ga4_daily_metrics ADD CONSTRAINT fixture_revenue CHECK (revenue < 200)");
    try {
      await expect(storage.replaceGA4DailyMetricsWindow("a", "123", date, date, [{ ...daily("a", 9), revenue: "999" }])).rejects.toThrow();
      expect((await storage.getGA4DailyMetrics("a", "123", date, date))[0].conversions).toBe(conversions);
    } finally { await pool.query("ALTER TABLE ga4_daily_metrics DROP CONSTRAINT fixture_revenue"); }
  });

  it("keeps financial snapshot conversion credit consistent with its JSON denominator", async () => {
    const snapshot = await storage.upsertFinancialDailySnapshot({ version: "financial_daily_snapshot_v1", campaignId: "a", reportingDate: date,
      currency: "EUR", currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: date, endDate: date,
        dataThroughDate: date, reportingTimeZone: "Europe/Amsterdam" },
      inputs: { revenue: { value: "100.00", available: true, sources: ["ga4"] },
        spend: { value: "30.00", available: true, sources: ["fixture"] }, conversions: { value: 0.75, available: true, sources: ["ga4"] } } });
    expect(snapshot.totalConversions).toBe(0.75);
    expect((snapshot.metrics as any).financialDaily.inputs.conversions.value).toBe(0.75);
    expect(30 / (snapshot.metrics as any).financialDaily.inputs.conversions.value).toBe(40);
  });

  it.each(["0", "0.75", "0.000075", "2"])("preserves observed %s through goal create, edit, progress, alerts and history", async currentValue => {
    const kpi = await storage.createKPI({ campaignId: "a", name: "Conversions", metric: "conversions", unit: "count", targetValue: "10", currentValue });
    const neighbor = await storage.createKPI({ campaignId: "b", name: "Sessions", metric: "sessions", unit: "count", targetValue: "100", currentValue: "8" });
    await storage.updateKPI(kpi.id, { currentValue, lastComputedValue: currentValue });
    expect((await storage.getKPI(kpi.id))?.currentValue).toBe(currentValue);
    expect(Number((await storage.getKPI(neighbor.id))?.currentValue)).toBe(8);
    const progress = await storage.recordKPIProgress({ kpiId: kpi.id, value: currentValue, rollingAverage7d: currentValue, rollingAverage30d: currentValue });
    expect(progress.value).toBe(currentValue);
    await storage.updateKPIProgress(progress.id, { value: "0.0000125" });
    expect((await storage.getKPIProgress(kpi.id))[0].value).toBe("0.0000125");
    const alert = await storage.createKPIAlert({ kpiId: kpi.id, alertType: "threshold_breach", message: "Fixture", currentValue });
    expect(alert.currentValue).toBe(currentValue);
    const benchmark = await storage.createBenchmark({ campaignId: "a", platformType: "google_analytics", name: "Conversions", category: "conversion", metric: "conversions", unit: "count", benchmarkValue: "10", currentValue });
    expect(benchmark.currentValue).toBe(currentValue);
    await storage.updateBenchmark(benchmark.id, { currentValue: "0.0000125" });
    expect((await storage.getBenchmark(benchmark.id))?.currentValue).toBe("0.0000125");
    await storage.recordBenchmarkHistory({ benchmarkId: benchmark.id, currentValue, benchmarkValue: "10", variance: "-90" });
    expect((await storage.getBenchmarkHistory(benchmark.id))[0].currentValue).toBe(currentValue);
    await pool.query("INSERT INTO kpi_periods(kpi_id,period_start,period_end,period_type,period_label,final_value,target_value,unit,target_achieved,previous_period_value,change_amount) VALUES ($1,now(),now(),'daily','Fixture',$2,10,'count',false,$2,$2)", [kpi.id, currentValue]);
    const period = (await pool.query("SELECT final_value,previous_period_value,change_amount FROM kpi_periods WHERE kpi_id=$1", [kpi.id])).rows[0];
    expect(Object.values(period)).toEqual([currentValue, currentValue, currentValue]);
    expect(JSON.parse(JSON.stringify(await storage.getKPI(kpi.id))).currentValue).toBe(currentValue);
  });

  it("widens observed goal fields losslessly, preserves targets, repeats and rolls back", async () => {
    const migration = readFileSync(new URL("../migrations/0026_goal_observed_value_precision.sql", import.meta.url), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("ALTER TABLE kpis ALTER COLUMN current_value TYPE NUMERIC(18,2)");
      await client.query("INSERT INTO kpis(id,name,target_value,current_value,unit) VALUES ('legacy','Legacy',999.99,123.45,'count')");
      await client.query("SAVEPOINT before_widen");
      await client.query(migration);
      const identity = async () => (await client.query("SELECT relfilenode FROM pg_class WHERE oid='kpis'::regclass")).rows;
      const after = await identity(); await client.query(migration); expect(await identity()).toEqual(after);
      expect((await client.query("SELECT current_value,target_value FROM kpis WHERE id='legacy'")).rows[0]).toEqual({ current_value: "123.45", target_value: "999.99" });
      await client.query("UPDATE kpis SET current_value=0.000075 WHERE id='legacy'");
      expect((await client.query("SELECT current_value FROM kpis WHERE id='legacy'")).rows[0].current_value).toBe("0.000075");
      await client.query("ROLLBACK TO before_widen");
      expect((await client.query("SELECT format_type(atttypid,atttypmod) type FROM pg_attribute WHERE attrelid='kpis'::regclass AND attname='current_value'")).rows[0].type).toBe("numeric(18,2)");
    } finally { await client.query("ROLLBACK"); client.release(); }
  });

  it.each(["Infinity", "-Infinity", "NaN"])("rejects nonfinite observed goal value %s", async value => {
    await expect(pool.query("INSERT INTO kpis(name,target_value,unit,current_value) VALUES ('bad',10,'count',$1)", [value])).rejects.toThrow(/kpis_current_value_finite/);
    await expect(pool.query("INSERT INTO kpi_progress(kpi_id,value) VALUES ('bad',$1)", [value])).rejects.toThrow(/kpi_progress_value_finite/);
    await expect(pool.query("INSERT INTO benchmark_history(benchmark_id,current_value,benchmark_value,variance) VALUES ('bad',$1,10,0)", [value])).rejects.toThrow(/benchmark_history_current_value_finite/);
  });

  it.each(["Infinity", "-Infinity", "NaN"])("rejects nonfinite %s in both widened columns", async value => {
    await expect(pool.query("INSERT INTO ga4_daily_metrics(campaign_id,property_id,date,conversions) VALUES ('a','123',$1,$2)", [date, value]))
      .rejects.toThrow(/ga4_daily_metrics_conversions_finite/);
    await expect(pool.query("INSERT INTO metric_snapshots(campaign_id,total_conversions) VALUES ('a',$1)", [value]))
      .rejects.toThrow(/metric_snapshots_total_conversions_finite/);
    expect((await pool.query("SELECT count(*)::integer n FROM ga4_daily_metrics")).rows[0].n).toBe(0);
  });

  it("migrates existing integers losslessly, repeats without table rewrite and rolls back atomically", async () => {
    const migration = readFileSync(new URL("../migrations/0025_ga4_fractional_conversions.sql", import.meta.url), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("ALTER TABLE ga4_daily_metrics DROP CONSTRAINT IF EXISTS ga4_daily_metrics_conversions_finite");
      await client.query("ALTER TABLE metric_snapshots DROP CONSTRAINT IF EXISTS metric_snapshots_total_conversions_finite");
      await client.query("ALTER TABLE ga4_daily_metrics ALTER COLUMN conversions TYPE INTEGER USING conversions::integer");
      await client.query("ALTER TABLE metric_snapshots ALTER COLUMN total_conversions TYPE INTEGER USING total_conversions::integer");
      await client.query("INSERT INTO ga4_daily_metrics(campaign_id,property_id,date,conversions) VALUES ('a','123',$1,2147483647),('b','123',$1,0)", [date]);
      await client.query("INSERT INTO metric_snapshots(campaign_id,total_conversions) VALUES ('a',2147483647),('b',0)");
      await client.query("SAVEPOINT old_schema");
      await client.query(migration);
      const identity = async () => (await client.query("SELECT relname,relfilenode FROM pg_class WHERE oid IN ('ga4_daily_metrics'::regclass,'metric_snapshots'::regclass) ORDER BY relname")).rows;
      const after = await identity(); await client.query(migration); expect(await identity()).toEqual(after);
      expect((await client.query("SELECT conversions FROM ga4_daily_metrics ORDER BY campaign_id")).rows).toEqual([{ conversions: 2147483647 }, { conversions: 0 }]);
      expect((await client.query("SELECT total_conversions FROM metric_snapshots ORDER BY campaign_id")).rows).toEqual([{ total_conversions: 2147483647 }, { total_conversions: 0 }]);
      await client.query("UPDATE ga4_daily_metrics SET conversions=0.000075 WHERE campaign_id='a'");
      expect((await client.query("SELECT conversions FROM ga4_daily_metrics WHERE campaign_id='a'")).rows[0].conversions).toBe(0.000075);
      await client.query("ROLLBACK TO old_schema");
      expect((await client.query("SELECT pg_typeof(conversions)::text type,conversions FROM ga4_daily_metrics WHERE campaign_id='a'")).rows[0]).toEqual({ type: "integer", conversions: 2147483647 });
      await client.query("ROLLBACK");
    } finally { await client.query("ROLLBACK"); client.release(); }
  });
});
