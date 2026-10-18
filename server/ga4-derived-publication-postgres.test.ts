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

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "").trim();
if (testUrl) {
  const url = new URL(testUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1"
    || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) {
    throw new Error("GA4 PostgreSQL tests require 127.0.0.1/ga4_alignment_test and no DATABASE_URL");
  }
}
const schemaName = `ga4_derived_it_${randomUUID().replace(/-/g, "")}`;
const tables = [schema.campaigns, schema.ga4Connections, schema.kpis, schema.kpiProgress,
  schema.benchmarks, schema.benchmarkHistory, schema.metricSnapshots];
const storage = new DatabaseStorage();
const date = "2026-10-17";
const recordedAt = new Date(`${date}T23:59:59.000Z`);
const notes = `auto:ga4_daily:${date};ga4_scope_v1:test`;
let admin: Pool;
let pool: Pool;
let created = false;
const progress = (id = "a", value = "20") => ({ kpiId: `kpi-${id}`, value, recordedAt, notes });
const history = (id = "a", value = "20") => ({ benchmarkId: `benchmark-${id}`, currentValue: value,
  benchmarkValue: "100", variance: "-80", performanceRating: "poor", recordedAt, notes });
const financial = (id = "a", value = "20") => ({ version: "financial_daily_snapshot_v1" as const,
  campaignId: id, reportingDate: date, currency: "EUR", currentValueWindow: {
    mode: "initial_import_to_latest_completed_day" as const, startDate: "2026-09-04", endDate: date,
    dataThroughDate: date, reportingTimeZone: "Europe/Amsterdam",
  }, inputs: { revenue: { value, available: true as const, sources: ["ga4"] },
    spend: { value: null, available: false as const, sources: [] as never[] },
    conversions: { value: 2, available: true as const, sources: ["ga4"] } } });
const writers = ["kpi", "progress update", "progress insert", "benchmark", "history", "financial"] as const;
type Writer = typeof writers[number];
async function write(kind: Writer, refreshScope?: any, id = "a", value = "20") {
  const metadata = arguments.length > 1 ? { refreshScope } : {};
  if (kind === "kpi") return storage.updateKPI(`kpi-${id}`, { currentValue: value, ...metadata } as any);
  if (kind === "progress update") return storage.updateKPIProgress(`progress-${id}`, { ...progress(id, value), ...metadata } as any);
  if (kind === "progress insert") return storage.recordKPIProgress({ ...progress(id, value), ...metadata } as any);
  if (kind === "benchmark") return storage.updateBenchmark(`benchmark-${id}`, { currentValue: value, ...metadata } as any);
  if (kind === "history") return storage.recordBenchmarkHistory({ ...history(id, value), ...metadata } as any);
  return storage.upsertFinancialDailySnapshot({ ...financial(id, value), ...metadata } as any);
}
async function claim(id = "a", leaseMs = 120_000) {
  const work = (await storage.ensureGA4RefreshWork(id, `owner-${id}`, new Date(Date.now() - 60_000), date))!;
  const claimed = (await storage.claimGA4RefreshWork(id, `owner-${id}`, work.id, leaseMs))!;
  return { campaignId: id, ownerId: `owner-${id}`, reportingDate: date,
    work: { id: claimed.id, leaseToken: claimed.leaseToken! } };
}
const expire = (scope: any) => pool.query("UPDATE ga4_refresh_work SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [scope.work.id]);
async function saved() {
  const values: Record<string, unknown> = {};
  for (const table of [schema.kpis, schema.kpiProgress, schema.benchmarks, schema.benchmarkHistory, schema.metricSnapshots]) {
    values[getTableName(table)] = (await pool.query(`SELECT * FROM "${getTableName(table)}" ORDER BY id`)).rows;
  }
  return values;
}

describe.skipIf(!testUrl)("GA4 derived writes with real PostgreSQL ownership", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 2 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, application_name: schemaName, max: 8 });
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
    await pool.query("CREATE UNIQUE INDEX financial_identity ON metric_snapshots (campaign_id,reporting_date) WHERE snapshot_type='financial_daily' AND reporting_date IS NOT NULL");
    await pool.query(readFileSync(new URL("../migrations/0020_add_ga4_refresh_work.sql", import.meta.url), "utf8"));
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
      await database.current.insert(schema.ga4Connections).values({ id: `connection-${id}`, campaignId: id,
        propertyId: `property-${id}`, method: "access_token", isPrimary: true, isActive: true, importStartDate: "2026-09-04" });
      await database.current.insert(schema.kpis).values({ id: `kpi-${id}`, campaignId: id, platformType: "google_analytics",
        name: "Sessions", metric: "sessions", targetValue: "100", currentValue: "10", unit: "count" });
      await database.current.insert(schema.kpiProgress).values({ id: `progress-${id}`, ...progress(id, "10") });
      await database.current.insert(schema.benchmarks).values({ id: `benchmark-${id}`, campaignId: id, platformType: "google_analytics",
        name: "Sessions", metric: "sessions", category: "traffic", benchmarkValue: "100", currentValue: "10", unit: "count" });
      await database.current.insert(schema.benchmarkHistory).values({ id: `history-${id}`, ...history(id, "10") });
      await storage.upsertFinancialDailySnapshot(financial(id, "10"));
    }
  });

  it.each(writers)("retains the existing unguarded %s write", async kind => {
    const result: any = await write(kind);
    expect(Number(kind === "financial" ? result.metrics.financialDaily.inputs.revenue.value : result.value ?? result.currentValue)).toBe(20);
  });
  it.each(writers)("accepts a live %s owner without storing its token or changing another campaign", async kind => {
    const scope = await claim(); const before = await saved();
    const result = await write(kind, scope);
    expect(result).toBeDefined(); expect(JSON.stringify(result)).not.toContain(scope.work.leaseToken);
    expect(Number(kind === "financial" ? (result as any).metrics.financialDaily.inputs.revenue.value : (result as any).value ?? (result as any).currentValue)).toBe(20);
    const after = await saved();
    for (const key of Object.keys(before)) {
      const other = (rows: any) => rows.filter((row: any) => row.campaign_id === "b" || row.kpi_id === "kpi-b" || row.benchmark_id === "benchmark-b");
      expect(other(after[key])).toEqual(other(before[key]));
    }
    expect(JSON.stringify(after)).not.toContain(scope.work.leaseToken);
  });
  describe.each(writers)("%s", kind => {
    it.each(["expired", "replaced", "released", "completed", "wrong token", "wrong campaign", "wrong date", "missing work",
      "owner changed", "paused", "deleted", "filter changed", "connection changed"])("rejects %s and preserves all saved values", async state => {
      const scope = await claim();
      if (state === "expired" || state === "replaced") await expire(scope);
      if (state === "replaced") await storage.claimGA4RefreshWork("a", "owner-a", scope.work.id, 120_000);
      if (state === "released") await storage.updateGA4RefreshWorkLease("a", "owner-a", scope.work.id, scope.work.leaseToken, "release");
      if (state === "completed") await pool.query("UPDATE ga4_refresh_work SET status='completed',lease_token=NULL,lease_expires_at=NULL,completed_at=clock_timestamp() WHERE id=$1", [scope.work.id]);
      if (state === "wrong token") scope.work.leaseToken = "wrong";
      if (state === "wrong campaign") scope.campaignId = "b";
      if (state === "wrong date") scope.reportingDate = "2026-10-16";
      if (state === "missing work") scope.work.id = "missing";
      if (state === "owner changed") await pool.query("UPDATE campaigns SET owner_id='new-owner' WHERE id='a'");
      if (state === "paused") await pool.query("UPDATE campaigns SET status='paused' WHERE id='a'");
      if (state === "deleted") await pool.query("DELETE FROM campaigns WHERE id='a'");
      if (state === "filter changed") await pool.query("UPDATE campaigns SET ga4_campaign_filter='changed' WHERE id='a'");
      if (state === "connection changed") await pool.query("UPDATE ga4_connections SET property_id='changed' WHERE campaign_id='a'");
      const before = await saved();
      await expect(write(kind, scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
      expect(await saved()).toEqual(before);
    });
    it("rejects a valid campaign owner targeting another campaign's data", async () => {
      const scope = await claim(); const before = await saved();
      await expect(write(kind, scope, "b")).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      expect(await saved()).toEqual(before);
    });
    it.each([null, undefined, {}, { work: {} }])("fails closed on explicitly malformed scope %j", async scope => {
      const before = await saved();
      await expect(write(kind, scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
      expect(await saved()).toEqual(before);
    });
    it("rejects a late result and allows the replacement to save", async () => {
      const scope = await claim(); await expire(scope);
      const replacement = (await storage.claimGA4RefreshWork("a", "owner-a", scope.work.id, 120_000))!;
      await expect(write(kind, scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
      expect(await write(kind, { ...scope, work: { id: replacement.id, leaseToken: replacement.leaseToken! } }, "a", "30")).toBeDefined();
    });
    it("rolls back if ownership expires while the save is writing", async () => {
      const table = kind === "kpi" || kind === "progress insert" ? "kpis" : kind === "progress update" ? "kpi_progress"
        : kind === "benchmark" ? "benchmarks" : kind === "history" ? "benchmark_history" : "metric_snapshots";
      await pool.query("CREATE FUNCTION delay_derived_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(1.2); RETURN NEW; END $$");
      await pool.query(`CREATE TRIGGER delay_derived_write BEFORE UPDATE ON "${table}" FOR EACH ROW EXECUTE FUNCTION delay_derived_write()`);
      const before = await saved();
      const scope = await claim("a", 1000);
      try {
        await expect(write(kind, scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
        expect(await saved()).toEqual(before);
      } finally {
        await pool.query(`DROP TRIGGER delay_derived_write ON "${table}"`);
        await pool.query("DROP FUNCTION delay_derived_write()");
      }
    });
    it("allows only the replacement when old and new responses compete on separate connections", async () => {
      const scope = await claim(); await expire(scope);
      const replacement = (await storage.claimGA4RefreshWork("a", "owner-a", scope.work.id, 120_000))!;
      const next = { ...scope, work: { id: replacement.id, leaseToken: replacement.leaseToken! } };
      const holder = await pool.connect();
      let pending: Promise<PromiseSettledResult<unknown>[]> | undefined;
      let blocked = 0;
      try {
        await holder.query("BEGIN"); await holder.query("SELECT id FROM campaigns WHERE id='a' FOR UPDATE");
        pending = Promise.allSettled([write(kind, scope), write(kind, next, "a", "30")]);
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
          blocked = Number((await admin.query("SELECT count(*) FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [schemaName])).rows[0].count);
          if (blocked === 2) break;
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      } finally { await holder.query("ROLLBACK"); holder.release(); }
      const results = await pending!;
      expect(blocked).toBe(2); expect(results[0].status).toBe("rejected"); expect(results[1].status).toBe("fulfilled");
      const result = (results[1] as PromiseFulfilledResult<any>).value;
      expect(Number(kind === "financial" ? result.metrics.financialDaily.inputs.revenue.value : result.value ?? result.currentValue)).toBe(30);
    });
  });
  it.each(writers.filter(kind => kind !== "financial"))("rejects a deleted %s target without recreating it", async kind => {
    const scope = await claim();
    await pool.query(kind === "benchmark" || kind === "history" ? "DELETE FROM benchmarks WHERE id='benchmark-a'" : "DELETE FROM kpis WHERE id='kpi-a'");
    const before = await saved();
    await expect(write(kind, scope)).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    expect(await saved()).toEqual(before);
  });
  it.each(writers.filter(kind => kind !== "financial"))("rejects another platform's %s in the same campaign", async kind => {
    const scope = await claim();
    await pool.query(kind === "benchmark" || kind === "history" ? "UPDATE benchmarks SET platform_type='linkedin' WHERE id='benchmark-a'"
      : "UPDATE kpis SET platform_type='linkedin' WHERE id='kpi-a'");
    const before = await saved();
    await expect(write(kind, scope)).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    expect(await saved()).toEqual(before);
  });
  it.each(["kpi", "benchmark"] as const)("preserves campaign-level %s current-value support", async kind => {
    const scope = await claim();
    await pool.query(kind === "kpi" ? "UPDATE kpis SET platform_type='campaign' WHERE id='kpi-a'" : "UPDATE benchmarks SET platform_type='campaign' WHERE id='benchmark-a'");
    expect(await write(kind, scope)).toMatchObject({ currentValue: "20.00", platformType: "campaign" });
  });
  it.each(["progress update", "progress insert", "history"] as const)("rejects wrong-date %s input", async kind => {
    const scope = await claim(); const before = await saved();
    const wrong = { recordedAt: new Date("2026-10-16T23:59:59Z"), notes: notes.replace(date, "2026-10-16"), refreshScope: scope };
    const pending = kind === "history" ? storage.recordBenchmarkHistory({ ...history(), ...wrong } as any)
      : kind === "progress insert" ? storage.recordKPIProgress({ ...progress(), ...wrong } as any)
      : storage.updateKPIProgress("progress-a", { ...progress(), ...wrong } as any);
    await expect(pending).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    expect(await saved()).toEqual(before);
  });
  it.each(["date", "notes", "parent"])("will not overwrite a KPI progress row with a different %s", async change => {
    const scope = await claim();
    if (change === "date") await pool.query("UPDATE kpi_progress SET recorded_at='2026-10-16T23:59:59' WHERE id='progress-a'");
    if (change === "notes") await pool.query("UPDATE kpi_progress SET notes='manual' WHERE id='progress-a'");
    if (change === "parent") await pool.query("UPDATE kpi_progress SET kpi_id='kpi-b' WHERE id='progress-a'");
    const before = await saved();
    await expect(write("progress update", scope)).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    expect(await saved()).toEqual(before);
  });
  it("rolls back inserted KPI progress if its current-value update fails", async () => {
    const scope = await claim(); const before = await saved();
    await pool.query("ALTER TABLE kpis ADD CONSTRAINT reject_current_value CHECK (current_value <> 20)");
    try {
      await expect(write("progress insert", scope)).rejects.toThrow();
      expect(await saved()).toEqual(before);
    } finally { await pool.query("ALTER TABLE kpis DROP CONSTRAINT reject_current_value"); }
  });
  it("keeps the exact automatic Benchmark history identity on a same-day revision", async () => {
    const scope = await claim();
    const first = await write("history", scope);
    const revised = await write("history", scope, "a", "30");
    expect(revised).toMatchObject({ id: first.id, currentValue: "30.00", recordedAt: first.recordedAt });
    expect((await pool.query("SELECT * FROM benchmark_history WHERE benchmark_id='benchmark-a'")).rows).toHaveLength(1);
  });
  it("keeps one automatic KPI progress entry when a replacement repeats the same date and scope", async () => {
    const scope = await claim();
    const first = await write("progress insert", scope); await expire(scope);
    const next = (await storage.claimGA4RefreshWork("a", "owner-a", scope.work.id, 120_000))!;
    const revised = await write("progress insert", { ...scope, work: { id: next.id, leaseToken: next.leaseToken! } }, "a", "30");
    expect(revised).toMatchObject({ id: first.id, value: "30.00" });
    expect((await pool.query("SELECT * FROM kpi_progress WHERE kpi_id='kpi-a'")).rows).toHaveLength(1);
  });
  it("does not rewrite ambiguous existing KPI progress", async () => {
    const scope = await claim();
    await database.current.insert(schema.kpiProgress).values({ id: "duplicate", ...progress() });
    const before = await saved();
    await expect(write("progress insert", scope)).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    expect(await saved()).toEqual(before);
  });
  it("keeps financial snapshot identity and unavailable inputs on a same-day revision", async () => {
    const scope = await claim();
    const first = await write("financial", scope);
    const revised = await write("financial", scope, "a", "30");
    expect(revised).toMatchObject({ id: first.id, campaignId: "a", reportingDate: date, metrics: { financialDaily: {
      inputs: { spend: { value: null, available: false, sources: [] }, revenue: { value: "30" } },
    } } });
    expect((await pool.query("SELECT * FROM metric_snapshots WHERE campaign_id='a'")).rows).toHaveLength(1);
  });
  it("preserves ordinary KPI/Benchmark definition edits and missing-row results", async () => {
    expect(await storage.updateKPI("kpi-a", { name: "Edited KPI", targetValue: "200", alertsEnabled: false }))
      .toMatchObject({ name: "Edited KPI", targetValue: "200.00", alertsEnabled: false, currentValue: "10.00" });
    expect(await storage.updateBenchmark("benchmark-a", { name: "Edited Benchmark", benchmarkValue: "200", alertsEnabled: true }))
      .toMatchObject({ name: "Edited Benchmark", benchmarkValue: "200.00", alertsEnabled: true, currentValue: "10.00" });
    expect(await storage.updateKPI("missing", { currentValue: "20" })).toBeUndefined();
    expect(await storage.updateBenchmark("missing", { currentValue: "20" })).toBeUndefined();
    expect(await storage.updateKPIProgress("missing", { value: "20" })).toBeUndefined();
  });
  it("preserves ordinary manual history and missing-parent errors", async () => {
    const point = await storage.recordKPIProgress({ kpiId: "kpi-a", value: "25", notes: "manual" });
    expect(point).toMatchObject({ value: "25.00", notes: "manual" });
    expect(point.recordedAt).toBeInstanceOf(Date);
    expect((await pool.query("SELECT current_value FROM kpis WHERE id='kpi-a'")).rows[0].current_value).toBe("25.00");
    const first = await storage.recordBenchmarkHistory({ ...history(), notes: "manual" });
    const second = await storage.recordBenchmarkHistory({ ...history(), notes: "manual" });
    expect(first.id).not.toBe(second.id);
    await expect(storage.recordKPIProgress({ kpiId: "missing", value: "20" })).rejects.toThrow("KPI not found");
    await expect(storage.recordBenchmarkHistory({ ...history(), benchmarkId: "missing" })).rejects.toThrow("Benchmark not found");
  });
  it.each(["progress update", "progress insert", "history"] as const)("publishes %s and its parent's current value in the same guarded write", async kind => {
    const scope = await claim();
    await write(kind, scope, "a", "27");
    const table = kind === "history" ? "benchmarks" : "kpis";
    expect((await pool.query(`SELECT current_value FROM ${table} WHERE campaign_id='a'`)).rows[0].current_value).toBe("27.00");
    expect((await pool.query(`SELECT current_value FROM ${table} WHERE campaign_id='b'`)).rows[0].current_value).toBe("10.00");
  });
  it("rejects a changed Benchmark target without writing its value or history", async () => {
    const scope = await claim(); await storage.updateBenchmark("benchmark-a", { benchmarkValue: "200" });
    const before = await saved();
    await expect(write("history", scope)).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    expect(await saved()).toEqual(before);
  });
});
