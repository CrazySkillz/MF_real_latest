import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableColumns, getTableName, is, SQL } from "drizzle-orm";
import { PgDialect, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";

const database = vi.hoisted(() => ({ current: null as any }));
vi.mock("./db", () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from "./storage";
import { getLatestCompleteReportingDate } from "./utils/reporting-timezone";

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "").trim();
if (testUrl) {
  const url = new URL(testUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1"
    || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) {
    throw new Error("GA4 PostgreSQL tests require 127.0.0.1/ga4_alignment_test and no DATABASE_URL");
  }
}
const schemaName = `initial_import_${randomUUID().replace(/-/g, "")}`;
const tables = Object.values(schema).filter(value => is(value, PgTable) && value !== schema.ga4RefreshWork) as PgTable[];
const storage = new DatabaseStorage();
let admin: Pool, pool: Pool, created = false;
const date = getLatestCompleteReportingDate("Europe/Amsterdam");
const request = (retry = false) => storage.requestGA4InitialImport("a", "owner-a", { platform: "google-analytics", ga4CampaignFilter: "sale" }, retry);
const claim = (id: string) => storage.claimGA4RefreshWork("a", "owner-a", id, 120_000);
const finish = (work: any) => storage.updateGA4RefreshWorkLease("a", "owner-a", work.id, work.leaseToken, "complete_initial_import");
const children = new Set<ChildProcess>();
function worker(pauseAt = "", campaignId = "a") {
  const child = fork(fileURLToPath(new URL("./test-support/ga4-recovery-process-worker.ts", import.meta.url)), [], {
    execArgv: ["--import", "tsx"], silent: true, windowsHide: true,
    env: { ...process.env, GA4_TEST_DATABASE_URL: testUrl, GA4_TEST_SCHEMA: schemaName,
      GA4_TEST_REPORTING_DATE: date, GA4_TEST_DUE_AT: new Date().toISOString(), GA4_TEST_INITIAL_IMPORT: "true", GA4_TEST_PAUSE_AT: pauseAt, GA4_TEST_CAMPAIGN: campaignId },
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
  return { child, until, exited };
}

async function publish(work: any, propertyId = "123", connectionId = "connection-a", revenue = 20, conversions = 2) {
  const campaign = (await storage.getCampaign("a"))!;
  const [connection] = (await database.current.select().from(schema.ga4Connections)).filter((c: any) => c.id === connectionId);
  const previous = await storage.getGA4OverviewSnapshot("a", propertyId);
  return storage.replaceGA4DailyMetricsWindow("a", propertyId, date, date, [{
    campaignId: "a", propertyId, date, sessions: 10, users: 9, pageviews: 15, conversions, revenue: String(revenue), engagedSessions: 5,
  }], {
    windowStart: date, windowEnd: date, campaignBreakdown: { totals: { sessions: 10, conversions, revenue }, meta: { currencyCode: "EUR" } },
    landingPages: { rows: [] }, conversionEvents: { totals: { conversions } },
    refreshScope: { campaign: Object.fromEntries(["ownerId", "clientId", "status", "ga4CampaignFilter", "currency", "reportingTimeZone"].map(key => [key, (campaign as any)[key] ?? null])),
      connection: Object.fromEntries(["id", "propertyId", "importStartDate", "isPrimary"].map(key => [key, connection[key] ?? null])),
      previousUpdatedAt: previous?.updatedAt?.toISOString() ?? null, work: { id: work.id, leaseToken: work.leaseToken },
    },
  });
}

describe.skipIf(!testUrl)("durable initial imports with real PostgreSQL", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 2 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, application_name: schemaName, max: 4 });
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
    await pool.query("CREATE UNIQUE INDEX overview_scope ON ga4_overview_snapshots(campaign_id,property_id)");
    await pool.query("CREATE UNIQUE INDEX initial_financial_day ON metric_snapshots(campaign_id,reporting_date) WHERE snapshot_type='financial_daily' AND reporting_date IS NOT NULL");
    await pool.query(readFileSync(new URL("../migrations/0020_add_ga4_refresh_work.sql", import.meta.url), "utf8"));
    await pool.query(readFileSync(new URL("../migrations/0021_add_ga4_refresh_recovery.sql", import.meta.url), "utf8"));
  });
  afterAll(async () => {
    await Promise.all(Array.from(children, child => new Promise<void>(resolve => { child.once("exit", () => resolve()); child.kill(); })));
    await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`); await admin?.end(); });
  beforeEach(async () => {
    await pool.query("DELETE FROM ga4_refresh_work");
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    for (const id of ["a", "b"]) {
      await database.current.insert(schema.clients).values({ id: `client-${id}`, ownerId: `owner-${id}`, name: id });
      await database.current.insert(schema.campaigns).values({ id, ownerId: `owner-${id}`, clientId: `client-${id}`, name: id,
        status: "draft", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: "sale" });
      await database.current.insert(schema.ga4Connections).values({ id: `connection-${id}`, campaignId: id,
        propertyId: id === "a" ? "123" : "456", method: "access_token", importStartDate: date, isPrimary: true });
    }
  });
  it("persists one request across concurrent Create calls and survives a new storage instance", async () => {
    const requests = await Promise.all([request(), request(), request()]);
    expect(new Set(requests.map(w => w!.id)).size).toBe(1);
    expect(await new DatabaseStorage().getGA4InitialImportWork("a", "owner-a")).toEqual(requests[0]);
    expect(await storage.getGA4InitialImportStatus("a", "owner-a")).toEqual({ state: "queued", canRetry: false, dataThroughDate: date, error: null });
    expect((await storage.getCampaign("a"))?.status).toBe("draft");
    expect((await storage.getRecoverableGA4RefreshWork()).map(w => w.id)).toContain(requests[0]!.id);
  });
  it("excludes ordinary drafts from scheduled work", async () => {
    expect(await storage.ensureGA4RefreshWork("a", "owner-a", new Date(), date)).toBeUndefined();
    expect(await storage.isGA4NativeRecoveryEligible("a")).toBe(false);
    expect(await storage.getGA4InitialImportStatus("a", "owner-a")).toBeNull();
  });
  it("checks owner for request, status, claim and activation", async () => {
    expect(await storage.requestGA4InitialImport("a", "owner-b", { platform: "google-analytics" })).toBeUndefined();
    const work = (await request())!;
    expect(await storage.getGA4InitialImportStatus("a", "owner-b")).toBeNull();
    expect(await storage.getGA4InitialImportWork("b", "owner-b", work.id)).toBeUndefined();
    expect(await storage.claimGA4RefreshWork("a", "owner-b", work.id, 120000)).toBeUndefined();
    const owned = (await claim(work.id))!;
    await publish(owned);
    expect(await storage.updateGA4RefreshWorkLease("a", "owner-b", work.id, owned.leaseToken!, "complete_initial_import")).toBeUndefined();
    expect((await storage.getCampaign("a"))?.status).toBe("draft");
  });
  it("activates only after this attempt commits all properties, atomically with completion", async () => {
    await database.current.insert(schema.ga4Connections).values({ id: "second", campaignId: "a", propertyId: "789", method: "access_token", importStartDate: date });
    const work = (await claim((await request())!.id))!;
    expect(await finish(work)).toBeUndefined();
    await publish(work);
    expect(await finish(work)).toBeUndefined();
    expect((await storage.getCampaign("a"))?.status).toBe("draft");
    await publish(work, "789", "second", 999);
    expect(await finish(work)).toMatchObject({ status: "completed" });
    expect(((await storage.getLatestFinancialDailySnapshot("a", date))?.metrics as any)?.financialDaily.inputs.revenue.value).toBe("20.00");
    expect((await storage.getCampaign("a"))?.status).toBe("active");
    expect(await storage.getGA4InitialImportStatus("a", "owner-a")).toMatchObject({ state: "completed", canRetry: false });
    expect(await finish(work)).toBeUndefined();
    expect(await storage.isGA4NativeRecoveryEligible("a")).toBe(true);
  });
  it.each([7653.96, 0, -15.25])("publishes initial native revenue %s and fractional conversions before activation", async revenue => {
    const work = (await claim((await request())!.id))!;
    await publish(work, "123", "connection-a", revenue, 0.75);
    expect(await finish(work)).toMatchObject({ status: "completed" });
    const snapshot = await storage.getLatestFinancialDailySnapshot("a", date);
    expect((snapshot?.metrics as any)?.financialDaily).toMatchObject({ currency: "EUR", inputs: {
      revenue: { available: true, value: revenue.toFixed(2), sources: ["ga4"] },
      conversions: { available: true, value: 0.75, sources: ["ga4"] },
      spend: { available: false, value: null, sources: [] },
    }, currentValueWindow: { startDate: date, endDate: date, reportingTimeZone: "Europe/Amsterdam" } });
    expect((await storage.getCampaign("a"))?.status).toBe("active");
    expect(await storage.getLatestFinancialDailySnapshot("b", date)).toBeNull();
    expect(await finish(work)).toBeUndefined();
    expect((await pool.query("SELECT count(*)::int n FROM metric_snapshots WHERE campaign_id='a' AND snapshot_type='financial_daily'")).rows[0].n).toBe(1);
  });
  it.each(["missing-overview", "currency", "missing-currency", "window-start", "window-end", "revenue", "conversions"])("rejects initial financial publication with invalid %s", async invalid => {
    const work = (await claim((await request())!.id))!;
    await publish(work);
    if (invalid === "missing-overview") await pool.query("DELETE FROM ga4_overview_snapshots WHERE campaign_id='a'");
    else {
      const saved = await storage.getGA4OverviewSnapshot("a", "123");
      const breakdown: any = structuredClone(saved!.campaignBreakdown);
      if (invalid === "currency") breakdown.meta.currencyCode = "USD";
      if (invalid === "missing-currency") delete breakdown.meta.currencyCode;
      if (invalid === "revenue") breakdown.totals.revenue = null;
      if (invalid === "conversions") breakdown.totals.conversions = -1;
      await pool.query("UPDATE ga4_overview_snapshots SET campaign_breakdown=$1,window_start=$2,window_end=$3 WHERE campaign_id='a'", [JSON.stringify(breakdown), invalid === "window-start" ? "2000-01-01" : date, invalid === "window-end" ? "2000-01-01" : date]);
    }
    expect(await finish(work)).toBeUndefined();
    expect((await storage.getCampaign("a"))?.status).toBe("draft");
    expect(await storage.getLatestFinancialDailySnapshot("a", date)).toBeNull();
  });
  it("rolls initial snapshot, activation and completion back together and permits a clean retry", async () => {
    const work = (await claim((await request())!.id))!;
    await publish(work);
    await pool.query("CREATE FUNCTION reject_initial_activation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='active' THEN RAISE EXCEPTION 'test activation failure'; END IF; RETURN NEW; END $$");
    await pool.query("CREATE TRIGGER reject_initial_activation BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION reject_initial_activation()");
    try { await expect(finish(work)).rejects.toThrow("test activation failure"); }
    finally { await pool.query("DROP TRIGGER reject_initial_activation ON campaigns"); await pool.query("DROP FUNCTION reject_initial_activation()"); }
    expect((await storage.getCampaign("a"))?.status).toBe("draft");
    expect((await storage.getGA4InitialImportWork("a", "owner-a"))?.status).toBe("running");
    expect(await storage.getLatestFinancialDailySnapshot("a", date)).toBeNull();
    expect(await finish(work)).toMatchObject({ status: "completed" });
    expect(await storage.getLatestFinancialDailySnapshot("a", date)).not.toBeNull();
  });
  it("refuses native-only financial publication after a source is added", async () => {
    const work = (await claim((await request())!.id))!;
    await publish(work);
    await database.current.insert(schema.revenueSources).values({ campaignId: "a", sourceType: "csv", currency: "EUR", platformContext: "ga4" });
    expect(await finish(work)).toBeUndefined();
    expect((await storage.getCampaign("a"))?.status).toBe("draft");
    expect(await storage.getLatestFinancialDailySnapshot("a", date)).toBeNull();
  });
  it("allows one owner and rejects a worker that resumes after its lease was replaced", async () => {
    const pending = (await request())!;
    const claims = await Promise.all([claim(pending.id), claim(pending.id)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const old = claims.find(Boolean)!;
    await publish(old);
    await pool.query("UPDATE ga4_refresh_work SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [old.id]);
    const replacement = (await claim(old.id))!;
    expect(replacement.leaseToken).not.toBe(old.leaseToken);
    await expect(publish(old)).rejects.toThrow("OWNERSHIP_LOST");
    expect(await finish(old)).toBeUndefined();
    expect(await finish(replacement)).toBeUndefined(); // Previous attempt's receipts cannot activate.
    await publish(replacement);
    expect(await finish(replacement)).toMatchObject({ status: "completed" });
  });
  it("blocks background retries after auth failure and permits explicit retry without duplication", async () => {
    const work = (await claim((await request())!.id))!;
    await storage.updateGA4RefreshWorkLease("a", "owner-a", work.id, work.leaseToken!, "release", 120000, undefined, { retryable: false, code: "daily_series:TOKEN_EXPIRED" });
    expect(await storage.getGA4InitialImportStatus("a", "owner-a")).toMatchObject({ state: "failed", canRetry: true });
    expect(await storage.getRecoverableGA4RefreshWork()).toHaveLength(0);
    expect((await request())!.retryable).toBe(false);
    expect((await request(true))!.id).toBe(work.id);
    const retry = (await claim(work.id))!;
    await publish(retry);
    expect(await finish(retry)).toMatchObject({ status: "completed" });
  });
  it("does not reset a running attempt or its retry limit on repeated Create", async () => {
    const work = (await claim((await request())!.id))!;
    const repeated = (await request(true))!;
    expect(repeated.leaseToken).toBe(work.leaseToken);
    expect(repeated.attemptCount).toBe(1);
    expect(await claim(work.id)).toBeUndefined();
  });
  it("honors provider Retry-After when the user retries exhausted work", async () => {
    const work = (await claim((await request())!.id))!;
    await storage.updateGA4RefreshWorkLease("a", "owner-a", work.id, work.leaseToken!, "release", 120000, undefined, { retryable: true, code: "GA4_PROVIDER_BACKOFF", retryAfterMs: 600000 });
    await pool.query("UPDATE ga4_refresh_work SET attempt_count=3 WHERE id=$1", [work.id]);
    const retried = (await request(true))!;
    expect(retried.nextAttemptAt!.getTime()).toBeGreaterThan(Date.now());
    expect(await claim(work.id)).toBeUndefined();
  });
  it.each(["ga4CampaignFilter", "currency", "reportingTimeZone"])("invalidates initial work after %s changes", async key => {
    const work = (await claim((await request())!.id))!;
    await publish(work);
    await storage.updateCampaign("a", { [key]: key === "currency" ? "USD" : key === "reportingTimeZone" ? "UTC" : "other" });
    expect(await finish(work)).toBeUndefined();
    await expect(publish(work)).rejects.toThrow("OWNERSHIP_LOST");
    expect(await storage.getGA4InitialImportStatus("a", "owner-a")).toMatchObject({ state: "failed", canRetry: true });
    expect((await request(true))!.id).not.toBe(work.id);
  });
  it("blocks stale browser cleanup but permits confirmed deletion and never resurrects the campaign", async () => {
    const work = (await claim((await request())!.id))!;
    await expect(storage.deleteCampaignCascade("a", { expectedDraftOwnerId: "owner-a" })).rejects.toThrow("CAMPAIGN_NO_LONGER_DRAFT");
    expect(await storage.deleteCampaignCascade("a")).toBe(true);
    expect(await finish(work)).toBeUndefined();
    expect(await storage.getGA4InitialImportWork("a", "owner-a")).toBeUndefined();
    expect(await storage.getCampaign("b")).toMatchObject({ status: "draft" });
  });
  it("rolls back activation when the lease expires inside the activation transaction", async () => {
    const work = (await claim((await request())!.id))!;
    await publish(work);
    await pool.query("UPDATE ga4_refresh_work SET lease_expires_at=clock_timestamp()+interval '0.15 seconds' WHERE id=$1", [work.id]);
    await pool.query(`CREATE FUNCTION delay_activation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.3); RETURN NEW; END $$;
      CREATE TRIGGER delay_activation BEFORE UPDATE ON campaigns FOR EACH ROW WHEN (NEW.status='active') EXECUTE FUNCTION delay_activation()`);
    try { await expect(finish(work)).rejects.toThrow("OWNERSHIP_LOST"); }
    finally { await pool.query("DROP TRIGGER delay_activation ON campaigns; DROP FUNCTION delay_activation()"); }
    expect((await storage.getCampaign("a"))?.status).toBe("draft");
    expect((await storage.getGA4InitialImportWork("a", "owner-a"))?.status).toBe("running");
  });
  it("rejects external-source configurations without partially saving final Create", async () => {
    await database.current.insert(schema.googleAdsConnections).values({ campaignId: "a", customerId: "123", accessToken: "test", method: "oauth" });
    await expect(request()).rejects.toThrow("CONFIGURATION_REQUIRED");
    expect((await storage.getCampaign("a"))?.platform).not.toBe("google-analytics");
    expect(await storage.getRecoverableGA4RefreshWork()).toHaveLength(0);
  });
  it("does not allow the regular completion action to activate initial work", async () => {
    const work = (await claim((await request())!.id))!;
    await publish(work);
    expect(await storage.updateGA4RefreshWorkLease("a", "owner-a", work.id, work.leaseToken!, "complete")).toBeUndefined();
    expect((await storage.getCampaign("a"))?.status).toBe("draft");
  });
  it("allows the first normal snapshot refresh after initial activation even when its scheduled slot is earlier", async () => {
    const work = (await claim((await request())!.id))!;
    await publish(work); await finish(work);
    const scheduled = await storage.ensureGA4RefreshWork("a", "owner-a", new Date(work.dueAt.getTime() - 1000), date);
    expect(scheduled).toBeDefined();
    expect(await claim(scheduled!.id)).toMatchObject({ status: "running" });
    expect(await storage.getGA4InitialImportStatus("a", "owner-a")).toMatchObject({ state: "completed" });
  });
  it("rolls daily values and the activation receipt back when Overview persistence fails", async () => {
    const work = (await claim((await request())!.id))!;
    await pool.query(`CREATE FUNCTION reject_overview() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture overview failure'; END $$;
      CREATE TRIGGER reject_overview BEFORE INSERT ON ga4_overview_snapshots FOR EACH ROW EXECUTE FUNCTION reject_overview()`);
    try { await expect(publish(work)).rejects.toThrow("fixture overview failure"); }
    finally { await pool.query("DROP TRIGGER reject_overview ON ga4_overview_snapshots; DROP FUNCTION reject_overview()"); }
    expect(await storage.getGA4DailyMetrics("a", "123", date, date)).toHaveLength(0);
    expect(await finish(work)).toBeUndefined();
    expect((await storage.getCampaign("a"))?.status).toBe("draft");
  });
  it("allows owned writes for the exact draft and rejects them after configuration changes", async () => {
    const work = (await claim((await request())!.id))!;
    const scope = { campaignId: "a", ownerId: "owner-a", reportingDate: date, work: { id: work.id, leaseToken: work.leaseToken! } };
    expect(await storage.writeWithGA4RefreshOwnership(scope, async () => "owned")).toBe("owned");
    await storage.updateCampaign("a", { currency: "USD" });
    await expect(storage.writeWithGA4RefreshOwnership(scope, async () => "stale")).rejects.toThrow("OWNERSHIP_LOST");
  });
  it("does not present a completed old import as valid after the campaign is returned to draft", async () => {
    const work = (await claim((await request())!.id))!;
    await publish(work); await finish(work);
    await storage.updateCampaign("a", { status: "draft" });
    expect(await storage.getGA4InitialImportStatus("a", "owner-a")).toMatchObject({ state: "failed", canRetry: true });
    expect((await request(true))!.id).not.toBe(work.id);
  });
  it.each(["provider", "daily", "complete"])("survives a real process kill at %s and reopens without duplicating imports", async stage => {
    const first = worker(stage);
    try {
      await first.until("stage");
      first.child.kill(); await first.exited;
      expect((await storage.getCampaign("a"))?.status).toBe(stage === "complete" ? "active" : "draft");
      await pool.query("UPDATE ga4_refresh_work SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE campaign_id='a' AND status='running'");
      const resumed = worker();
      const result = await resumed.until("result"); await resumed.exited;
      expect(result.status).toBe(stage === "complete" ? "already_completed" : "completed");
      expect((await storage.getCampaign("a"))?.status).toBe("active");
      expect((await pool.query("SELECT * FROM ga4_refresh_work WHERE campaign_id='a'")).rowCount).toBe(1);
      expect(await storage.getGA4DailyMetrics("a", "123", date, date)).toHaveLength(1);
      expect(((await storage.getLatestFinancialDailySnapshot("a", date))?.metrics as any)?.financialDaily.inputs.revenue.value).toBe("100.00");
      expect((await pool.query("SELECT count(*)::int n FROM metric_snapshots WHERE campaign_id='a' AND snapshot_type='financial_daily'")).rows[0].n).toBe(1);
      expect((await storage.getCampaign("b"))?.status).toBe("draft");
    } finally {
      if (first.child.exitCode === null && first.child.signalCode === null) { first.child.kill(); await first.exited; }
    }
  }, 30000);

});
