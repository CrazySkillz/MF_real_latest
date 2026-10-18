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
vi.mock("./utils/ga4-alert-current-value", () => ({ resolveAlertCurrentValueForDecision: async (item: any) => item }));
import { DatabaseStorage } from "./storage";
import { checkGA4PerformanceAlertsForCampaign } from "./kpi-scheduler";
import { checkGA4BenchmarkPerformanceAlertsForCampaign } from "./benchmark-notifications";

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "").trim();
if (testUrl) {
  const url = new URL(testUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1"
    || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) {
    throw new Error("GA4 PostgreSQL tests require 127.0.0.1/ga4_alignment_test and no DATABASE_URL");
  }
}
const schemaName = `ga4_snapshot_it_${randomUUID().replace(/-/g, "")}`;
const tables = [schema.campaigns, schema.ga4Connections, schema.metricSnapshots, schema.kpis, schema.benchmarks, schema.notifications];
const storage = new DatabaseStorage();
const date = "2026-10-17";
let admin: Pool, pool: Pool, created = false;
const executive = (id = "a", value = 20): any => ({ version: "executive_summary_daily_snapshot_v2",
  campaignId: id, reportingDate: date, currency: "EUR", ga4PropertyId: `property-${id}`, ga4CampaignFilter: "sale",
  performanceSummaryVersion: "performance_summary_aggregate_v3", sourceSignature: ["ga4"],
  currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: "2026-09-04", endDate: date,
    dataThroughDate: date, reportingTimeZone: "Europe/Amsterdam" },
  totals: Object.fromEntries(["users", "sessions", "conversions", "revenue", "spend", "cvr", "cpa", "roas", "roi"]
    .map(name => [name, ["spend", "cpa", "roas", "roi"].includes(name)
      ? { value: null, available: false, sources: [] } : { value, available: true, sources: ["ga4"] }])),
});
const aggregate = (id = "a", value = 20) => ({ campaignId: id, snapshotType: "platform_sync", totalConversions: value });
const kinds = ["aggregate", "executive", "mark", "invalidate"] as const;
type Kind = typeof kinds[number];
const saved = async () => (await pool.query("SELECT * FROM metric_snapshots ORDER BY id")).rows;
const expire = (scope: any) => pool.query("UPDATE ga4_refresh_work SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [scope.work.id]);
async function claim(leaseMs = 120_000) {
  const work = (await storage.ensureGA4RefreshWork("a", "owner-a", new Date(Date.now() - 60_000), date))!;
  const claimed = (await storage.claimGA4RefreshWork("a", "owner-a", work.id, leaseMs))!;
  return { campaignId: "a", ownerId: "owner-a", reportingDate: date, work: { id: work.id, leaseToken: claimed.leaseToken! } };
}
async function write(kind: Kind, scope?: any, id = "a") {
  const options = arguments.length > 1 ? { refreshScope: scope } : {};
  if (kind === "aggregate") return storage.createMetricSnapshot({ ...aggregate(id), ...options });
  if (kind === "executive") return storage.upsertExecutiveSummaryDailySnapshot({ ...executive(id), ...options });
  if (kind === "mark") {
    // Preserve database precision: a millisecond JS timestamp can precede a claim made in the same millisecond.
    const { rows } = await pool.query(`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS completed_at`);
    return storage.markExecutiveSummaryDailySnapshotAligned(id, date, rows[0].completed_at, options);
  }
  return storage.invalidateExecutiveSummaryDailySnapshotAlignment(id, date, options);
}

describe.skipIf(!testUrl)("GA4 aggregate, executive and completion ownership in PostgreSQL", () => {
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
    await pool.query("CREATE UNIQUE INDEX executive_identity ON metric_snapshots (campaign_id,reporting_date) WHERE snapshot_type='executive_summary_daily' AND reporting_date IS NOT NULL");
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
      await storage.upsertExecutiveSummaryDailySnapshot(executive(id, 10));
      await storage.markExecutiveSummaryDailySnapshotAligned(id, date, new Date().toISOString());
    }
  });
  it.each(kinds)("preserves the ordinary %s path", async kind => {
    await write(kind);
  });
  it.each(kinds)("allows a current %s owner and preserves the other campaign", async kind => {
    const scope = await claim();
    if (kind === "mark") await write("executive", scope);
    const before = (await saved()).filter(row => row.campaign_id === "b");
    const result = await write(kind, scope);
    if (kind === "mark") expect(result).toBe(true);
    if (kind === "invalidate") expect((await saved()).find(row => row.campaign_id === "a").notes).toBeNull();
    expect((await saved()).filter(row => row.campaign_id === "b")).toEqual(before);
    expect(JSON.stringify(await saved())).not.toContain(scope.work.leaseToken);
  });
  describe.each(kinds)("%s", kind => {
    it.each(["expired", "replaced", "released", "completed", "deleted", "paused", "owner", "filter", "property", "token", "date", "campaign"])
      ("rejects %s ownership without changing saved values", async state => {
        const scope = await claim();
        if (state === "expired" || state === "replaced") await expire(scope);
        if (state === "replaced") await storage.claimGA4RefreshWork("a", "owner-a", scope.work.id, 120_000);
        if (state === "released") await storage.updateGA4RefreshWorkLease("a", "owner-a", scope.work.id, scope.work.leaseToken, "release");
        if (state === "completed") await pool.query("UPDATE ga4_refresh_work SET status='completed',lease_token=NULL,lease_expires_at=NULL,completed_at=clock_timestamp() WHERE id=$1", [scope.work.id]);
        if (state === "deleted") await pool.query("DELETE FROM campaigns WHERE id='a'");
        if (state === "paused") await pool.query("UPDATE campaigns SET status='paused' WHERE id='a'");
        if (state === "owner") await pool.query("UPDATE campaigns SET owner_id='other' WHERE id='a'");
        if (state === "filter") await pool.query("UPDATE campaigns SET ga4_campaign_filter='other' WHERE id='a'");
        if (state === "property") await pool.query("UPDATE ga4_connections SET property_id='other' WHERE campaign_id='a'");
        if (state === "token") scope.work.leaseToken = "other";
        if (state === "date") scope.reportingDate = "2026-10-16";
        if (state === "campaign") scope.campaignId = "b";
        const before = await saved();
        await expect(write(kind, scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
        expect(await saved()).toEqual(before);
      });
    it.each([null, undefined, {}, { work: {} }])("rejects malformed scope %j", async scope => {
      const before = await saved();
      await expect(write(kind, scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
      expect(await saved()).toEqual(before);
    });
    it("rejects another campaign's target", async () => {
      const scope = await claim(); const before = await saved();
      await expect(write(kind, scope, "b")).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      expect(await saved()).toEqual(before);
    });
    it("lets only the replacement write when two connections compete", async () => {
      const scope = await claim(); await expire(scope);
      const next = (await storage.claimGA4RefreshWork("a", "owner-a", scope.work.id, 120_000))!;
      const replacement = { ...scope, work: { id: next.id, leaseToken: next.leaseToken! } };
      if (kind === "mark") await write("executive", replacement);
      const holder = await pool.connect();
      let pending: Promise<PromiseSettledResult<unknown>[]> | undefined;
      let blocked = 0;
      try {
        await holder.query("BEGIN"); await holder.query("SELECT id FROM campaigns WHERE id='a' FOR UPDATE");
        pending = Promise.allSettled([write(kind, scope), write(kind, replacement)]);
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
          blocked = Number((await admin.query("SELECT count(*) FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [schemaName])).rows[0].count);
          if (blocked === 2) break;
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      } finally { await holder.query("ROLLBACK"); holder.release(); }
      const results = await pending!;
      expect(blocked).toBe(2); expect(results[0].status).toBe("rejected"); expect(results[1].status).toBe("fulfilled");
      if (kind === "mark") expect((results[1] as PromiseFulfilledResult<unknown>).value).toBe(true);
    });
    it("rolls back a save that crosses lease expiry", async () => {
      const scope = await claim();
      if (kind === "mark") await write("executive", scope);
      const before = await saved();
      await pool.query("CREATE FUNCTION delay_snapshot_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(1.2); RETURN NEW; END $$");
      await pool.query("CREATE TRIGGER delay_snapshot_write BEFORE INSERT OR UPDATE ON metric_snapshots FOR EACH ROW EXECUTE FUNCTION delay_snapshot_write()");
      await pool.query("UPDATE ga4_refresh_work SET lease_expires_at=clock_timestamp()+interval '1 second' WHERE id=$1", [scope.work.id]);
      try {
        await expect(write(kind, scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
        expect(await saved()).toEqual(before);
      } finally {
        await pool.query("DROP TRIGGER delay_snapshot_write ON metric_snapshots");
        await pool.query("DROP FUNCTION delay_snapshot_write()");
      }
    });
  });
  it("keeps one aggregate when a replacement repeats the same work", async () => {
    const scope = await claim(); const first: any = await write("aggregate", scope);
    await expire(scope);
    const next = (await storage.claimGA4RefreshWork("a", "owner-a", scope.work.id, 120_000))!;
    const replacement = { ...scope, work: { id: next.id, leaseToken: next.leaseToken! } };
    const revised = await storage.createMetricSnapshot({ ...aggregate("a", 30), refreshScope: replacement });
    expect(revised).toMatchObject({ id: first.id, totalConversions: 30 });
    expect((await saved()).filter(row => row.snapshot_type === "platform_sync")).toHaveLength(1);
    await expect(write("aggregate", scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
  });
  it("cancels a blocked database write without publishing or leaking the local timeout", async () => {
    const scope = await claim(); const before = await saved(); const holder = await pool.connect();
    try {
      await holder.query("BEGIN"); await holder.query("SELECT id FROM campaigns WHERE id='a' FOR UPDATE");
      await expect(write("aggregate", scope)).rejects.toThrow(/lock timeout/);
    } finally { await holder.query("ROLLBACK"); holder.release(); }
    expect(await saved()).toEqual(before);
    expect((await pool.query("SHOW lock_timeout")).rows[0].lock_timeout).toBe("0");
    expect((await pool.query("SHOW statement_timeout")).rows[0].statement_timeout).toBe("0");
  }, 15_000);
  it("cannot mark an old capture complete under a replacement owner", async () => {
    const scope = await claim(); await write("executive", scope); await expire(scope);
    const next = (await storage.claimGA4RefreshWork("a", "owner-a", scope.work.id, 120_000))!;
    const replacement = { ...scope, work: { id: next.id, leaseToken: next.leaseToken! } };
    const before = await saved();
    expect(await write("mark", replacement)).toBe(false);
    expect(await saved()).toEqual(before);
    await write("executive", replacement);
    expect(await write("mark", replacement)).toBe(true);
    expect((await storage.updateGA4RefreshWorkLease("a", "owner-a", next.id, next.leaseToken!, "complete"))?.status).toBe("completed");
  });
  it.each(["invalid", "2020-01-01T00:00:00Z", "2099-01-01T00:00:00Z"])("rejects an invalid completion time %s", async completedAt => {
    const scope = await claim(); await write("executive", scope); const before = await saved();
    await expect(storage.markExecutiveSummaryDailySnapshotAligned("a", date, completedAt, { refreshScope: scope })).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    expect(await saved()).toEqual(before);
  });
  it("commits report readiness and work completion together", async () => {
    const scope = await claim(); await write("executive", scope);
    const completedAt = new Date().toISOString();
    const result = await storage.updateGA4RefreshWorkLease("a", "owner-a", scope.work.id, scope.work.leaseToken, "complete", 120_000, completedAt);
    expect(result?.status).toBe("completed");
    expect((await saved()).find(row => row.campaign_id === "a").notes).toBe(`ga4_aligned_refresh_v1:${date}:${completedAt}`);
  });
  it.each(["expired", "replaced", "old-receipt", "future", "before-start"])("preserves both rows when atomic completion rejects %s", async mode => {
    const scope = await claim(); await write("executive", scope);
    if (["expired", "replaced", "old-receipt"].includes(mode)) await expire(scope);
    if (["replaced", "old-receipt"].includes(mode)) {
      const next = (await storage.claimGA4RefreshWork("a", "owner-a", scope.work.id, 120_000))!;
      if (mode === "old-receipt") scope.work.leaseToken = next.leaseToken!;
    }
    const before = await saved(); const beforeWork = (await pool.query("SELECT * FROM ga4_refresh_work")).rows;
    const completedAt = mode === "future" ? "2099-01-01T00:00:00Z" : mode === "before-start" ? "2020-01-01T00:00:00Z" : new Date().toISOString();
    expect(await storage.updateGA4RefreshWorkLease("a", "owner-a", scope.work.id, scope.work.leaseToken, "complete", 120_000, completedAt)).toBeUndefined();
    expect(await saved()).toEqual(before); expect((await pool.query("SELECT * FROM ga4_refresh_work")).rows).toEqual(beforeWork);
  });
  it.each(["metric_snapshots", "ga4_refresh_work"])("rolls back both completion writes when a delayed %s write crosses expiry", async table => {
    const scope = await claim(); await write("executive", scope);
    const before = await saved();
    await pool.query("UPDATE ga4_refresh_work SET lease_expires_at=clock_timestamp()+interval '1 second' WHERE id=$1", [scope.work.id]);
    const beforeWork = (await pool.query("SELECT * FROM ga4_refresh_work")).rows;
    await pool.query("CREATE FUNCTION delay_complete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(1.2); RETURN NEW; END $$");
    await pool.query(`CREATE TRIGGER delay_complete BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION delay_complete()`);
    try {
      await expect(storage.updateGA4RefreshWorkLease("a", "owner-a", scope.work.id, scope.work.leaseToken, "complete", 120_000, new Date().toISOString())).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
      expect(await saved()).toEqual(before); expect((await pool.query("SELECT * FROM ga4_refresh_work")).rows).toEqual(beforeWork);
    } finally { await pool.query(`DROP TRIGGER delay_complete ON ${table}`); await pool.query("DROP FUNCTION delay_complete()"); }
  });
  describe.each(["kpi", "benchmark"] as const)("%s alert ownership", kind => {
    const table = kind === "kpi" ? schema.kpis : schema.benchmarks;
    const tableName = kind === "kpi" ? "kpis" : "benchmarks";
    const check = kind === "kpi" ? checkGA4PerformanceAlertsForCampaign : checkGA4BenchmarkPerformanceAlertsForCampaign;
    beforeEach(async () => {
      for (const campaignId of ["a", "b"]) await database.current.insert(table).values({
        id: `rule-${campaignId}`, campaignId, platformType: "google_analytics", name: "Total Sessions", metric: "sessions", category: "traffic",
        ...(kind === "kpi" ? { targetValue: "100", status: "tracking" } : { benchmarkValue: "100", status: "active" }),
        currentValue: "20", unit: "count", alertsEnabled: true, alertThreshold: "30", alertCondition: "below", alertFrequency: "immediate", lastAlertSent: new Date(),
      });
    });
    const alerts = async () => (await pool.query("SELECT * FROM notifications ORDER BY id")).rows;
    it("creates, updates and resolves only the owned campaign's alert", async () => {
      const scope = await claim();
      await check("a", date, { refreshScope: scope });
      const [created] = await alerts(); expect(created.campaign_id).toBe("a");
      await pool.query(`UPDATE ${tableName} SET current_value=25 WHERE id='rule-a'`);
      await check("a", date, { refreshScope: scope });
      expect(await alerts()).toHaveLength(1); expect((await alerts())[0].message).toContain("25");
      await pool.query(`UPDATE ${tableName} SET current_value=40 WHERE id='rule-a'`);
      await check("a", date, { refreshScope: scope });
      expect(JSON.parse((await alerts())[0].metadata).resolved).toBe(true);
      expect((await pool.query(`SELECT last_alert_sent FROM ${tableName} WHERE id='rule-a'`)).rows[0].last_alert_sent).toBeNull();
      expect((await pool.query(`SELECT last_alert_sent FROM ${tableName} WHERE id='rule-b'`)).rows[0].last_alert_sent).not.toBeNull();
    });
    it.each(["expired", "replacement", "campaign", "date", "malformed"])("keeps alerts and email bookkeeping when %s ownership is rejected", async mode => {
      const scope = await claim(); await check("a", date, { refreshScope: scope });
      await pool.query(`UPDATE ${tableName} SET current_value=40 WHERE id='rule-a'`);
      if (["expired", "replacement"].includes(mode)) await expire(scope);
      if (mode === "replacement") await storage.claimGA4RefreshWork("a", "owner-a", scope.work.id, 120_000);
      const before = await alerts(); const rules = (await pool.query(`SELECT * FROM ${tableName} ORDER BY id`)).rows;
      await expect(check(mode === "campaign" ? "b" : "a", mode === "date" ? "2026-10-16" : date, { refreshScope: mode === "malformed" ? undefined : scope })).rejects.toThrow();
      expect(await alerts()).toEqual(before); expect((await pool.query(`SELECT * FROM ${tableName} ORDER BY id`)).rows).toEqual(rules);
    });
    it("rolls back alert resolution and email bookkeeping together on lease expiry", async () => {
      const scope = await claim(); await check("a", date, { refreshScope: scope });
      await pool.query(`UPDATE ${tableName} SET current_value=40 WHERE id='rule-a'`);
      const before = await alerts(); const rules = (await pool.query(`SELECT * FROM ${tableName} ORDER BY id`)).rows;
      await pool.query("CREATE FUNCTION delay_alert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(1.2); RETURN NEW; END $$");
      await pool.query("CREATE TRIGGER delay_alert BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION delay_alert()");
      await pool.query("UPDATE ga4_refresh_work SET lease_expires_at=clock_timestamp()+interval '1 second' WHERE id=$1", [scope.work.id]);
      try {
        await expect(check("a", date, { refreshScope: scope })).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
        expect(await alerts()).toEqual(before); expect((await pool.query(`SELECT * FROM ${tableName} ORDER BY id`)).rows).toEqual(rules);
      } finally { await pool.query("DROP TRIGGER delay_alert ON notifications"); await pool.query("DROP FUNCTION delay_alert()"); }
    });
  });
});
