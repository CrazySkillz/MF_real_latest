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

// Never use the app database, environment file, or a remote database.
const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "").trim();
if (testUrl) {
  const url = new URL(testUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1"
    || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) {
    throw new Error("GA4 PostgreSQL tests require 127.0.0.1/ga4_alignment_test and no DATABASE_URL");
  }
}
const migration = readFileSync(new URL("../migrations/0020_add_ga4_refresh_work.sql", import.meta.url), "utf8");
const startup = readFileSync(new URL("./index.ts", import.meta.url), "utf8")
  .split("// P5.1 storage foundation only;")[1].split("} catch (error)")[0];
const startupSql = Array.from(startup.matchAll(/db\.execute\(sql`([\s\S]*?)`\)/g), match => match[1]).join("\n");
const schemaName = `ga4_work_it_${randomUUID().replace(/-/g, "")}`;
const tables = [schema.campaigns, schema.ga4Connections, schema.metricSnapshots];
const storage = new DatabaseStorage();
const date = "2026-10-17";
const dueAt = new Date(Date.now() - 3_600_000);
let admin: Pool;
let pool: Pool;
let created = false;
const queries: string[] = [];
const ensure = (id = "a", due = dueAt) => storage.ensureGA4RefreshWork(id, `owner-${id}`, due, date);
const claim = (workId: string, id = "a") => storage.claimGA4RefreshWork(id, `owner-${id}`, workId, 120_000);
const change = (work: any, action: "renew" | "release" | "complete", token = work.leaseToken, id = "a") =>
  storage.updateGA4RefreshWorkLease(id, `owner-${id}`, work.id, token, action);
const expire = (workId: string) => pool.query("UPDATE ga4_refresh_work SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [workId]);
async function saved(workId: string) {
  return (await pool.query("SELECT * FROM ga4_refresh_work WHERE id=$1", [workId])).rows[0];
}
async function marker(notes: string, id = "a", reportingDate = date) {
  await pool.query("INSERT INTO metric_snapshots(campaign_id,snapshot_type,reporting_date,notes) VALUES ($1,'executive_summary_daily',$2,$3)",
    [id, reportingDate, notes]);
}

describe("GA4 work migration contract", () => {
  it("keeps startup DDL identical to the standalone additive migration", () => {
    const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
    expect(normalize(startupSql)).toBe(normalize(migration));
  });
});

describe.skipIf(!testUrl)("durable GA4 work with real PostgreSQL", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 2 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, application_name: schemaName, max: 8 });
    database.current = drizzle(pool, { schema, logger: { logQuery: (query: string) => queries.push(query) } });
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
    await pool.query(migration);
    await pool.query(startupSql);
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
      await database.current.insert(schema.campaigns).values({ id, ownerId: `owner-${id}`, clientId: `client-${id}`, name: id,
        status: "active", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: "sale" });
      await database.current.insert(schema.ga4Connections).values({ id: `connection-${id}`, campaignId: id,
        propertyId: `property-${id}`, method: "access_token", isActive: true, isPrimary: true, importStartDate: "2026-09-04",
        accessToken: "test-token-must-not-be-copied", clientSecret: "test-secret-must-not-be-copied" });
    }
    queries.length = 0;
  });

  it("persists one pending identity across callers and repeated migrations without copying credentials", async () => {
    const [a, b] = await Promise.all([ensure(), new DatabaseStorage().ensureGA4RefreshWork("a", "owner-a", dueAt, date)]);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ status: "pending", campaignId: "a", dueAt, reportingDate: date, leaseToken: null });
    expect(JSON.stringify(a)).not.toContain("test-token"); expect(JSON.stringify(a)).not.toContain("test-secret");
    await pool.query(startupSql); await pool.query(migration);
    expect(await ensure()).toEqual(a);
    const columns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='ga4_refresh_work'", [schemaName]);
    expect(columns.rows.map(r => r.column_name).sort()).toEqual(Object.values(getTableColumns(schema.ga4RefreshWork)).map(c => c.name).sort());
  });
  it.each(["same slot", "different slots"])("allows only one concurrent owner across %s", async kind => {
    const first = (await ensure())!;
    const second = kind === "same slot" ? first : (await ensure("a", new Date(dueAt.getTime() + 1000)))!;
    const holder = await pool.connect();
    await holder.query("BEGIN"); await holder.query("SELECT id FROM campaigns WHERE id='a' FOR UPDATE");
    const pending = Promise.all([claim(first.id), claim(second.id), claim(first.id), claim(second.id)]);
    let blocked = 0;
    try {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        blocked = Number((await pool.query("SELECT count(*) FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [schemaName])).rows[0].count);
        if (blocked === 4) break;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    } finally { await holder.query("ROLLBACK"); holder.release(); }
    const results = await pending;
    expect(blocked).toBe(4); // Prove contention on independent database connections.
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await pool.query("SELECT * FROM ga4_refresh_work WHERE status='running'")).rows).toHaveLength(1);
  });
  it("allows different campaigns to claim independently and refuses cross-campaign IDs", async () => {
    const a = (await ensure())!; const b = (await ensure("b"))!;
    expect(await claim(a.id, "b")).toBeUndefined(); expect(await claim(b.id)).toBeUndefined();
    const results = await Promise.all([claim(a.id), claim(b.id, "b")]);
    expect(results.filter(Boolean)).toHaveLength(2);
    expect(await change(results[0], "release", results[0]!.leaseToken!, "b")).toBeUndefined();
  });
  it("holds future work without claiming it early", async () => {
    const future = new Date(Date.now() + 86400000);
    const work = (await ensure("a", future))!;
    expect(await claim(work.id)).toBeUndefined(); expect((await saved(work.id)).status).toBe("pending");
  });
  it("renews and releases only a live token, then issues a new token on retry", async () => {
    const work = (await claim((await ensure())!.id))!;
    expect(await change(work, "release", "wrong-token")).toBeUndefined();
    const renewed = (await change(work, "renew"))!;
    expect(renewed.leaseExpiresAt!.getTime()).toBeGreaterThanOrEqual(work.leaseExpiresAt!.getTime());
    expect(await change(work, "release")).toMatchObject({ status: "pending", leaseToken: null });
    const retried = (await claim(work.id))!;
    expect(retried.leaseToken).not.toBe(work.leaseToken);
    expect(await change(work, "release")).toBeUndefined();
  });
  it.each(["renew", "release", "complete"] as const)("rejects the old owner's %s after expiry and takeover", async action => {
    const work = (await claim((await ensure())!.id))!;
    await expire(work.id);
    expect(await change(work, action)).toBeUndefined();
    const replacement = (await claim(work.id))!;
    expect(replacement.leaseToken).not.toBe(work.leaseToken);
    expect(await change(work, action)).toBeUndefined();
    expect((await saved(work.id)).lease_token).toBe(replacement.leaseToken);
  });
  it("lets another due slot recover campaign ownership after expiry", async () => {
    const first = (await claim((await ensure())!.id))!;
    const later = (await ensure("a", new Date(dueAt.getTime() + 1000)))!;
    expect(await claim(later.id)).toBeUndefined(); await expire(first.id);
    expect(await claim(later.id)).toMatchObject({ id: later.id, status: "running" });
    expect(await saved(first.id)).toMatchObject({ status: "pending", lease_token: null });
  });
  it("rolls back expiry cleanup if claiming the replacement fails", async () => {
    const first = (await claim((await ensure())!.id))!;
    const later = (await ensure("a", new Date(dueAt.getTime() + 1000)))!;
    await expire(first.id);
    // A test-only constraint forces the new claim to fail after the old lease is cleared.
    await pool.query(`ALTER TABLE ga4_refresh_work ADD CONSTRAINT test_claim_failure CHECK (id <> '${later.id}' OR status <> 'running')`);
    try {
      await expect(claim(later.id)).rejects.toThrow();
      expect(await saved(first.id)).toMatchObject({ status: "running", lease_token: first.leaseToken });
      expect((await saved(later.id)).status).toBe("pending");
    } finally { await pool.query("ALTER TABLE ga4_refresh_work DROP CONSTRAINT test_claim_failure"); }
    expect(await claim(later.id)).toBeDefined();
  });
  it("uses the database clock even if a worker's clock is wrong", async () => {
    const work = (await ensure())!;
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2099-01-01"));
    try {
      const claimed = (await claim(work.id))!;
      const { rows } = await pool.query("SELECT extract(epoch FROM (lease_expires_at-clock_timestamp())) AS remaining FROM ga4_refresh_work WHERE id=$1", [work.id]);
      expect(Number(rows[0].remaining)).toBeGreaterThan(110); expect(Number(rows[0].remaining)).toBeLessThanOrEqual(120);
      expect(await change(claimed, "renew")).toBeDefined();
    } finally { vi.useRealTimers(); }
  });
  it.each(["paused", "draft", "deleted", "ownerless", "foreign-owner", "disconnected", "inactive", "empty-property"])("fails closed for %s campaigns", async kind => {
    const work = (await claim((await ensure())!.id))!;
    if (kind === "deleted") await pool.query("DELETE FROM campaigns WHERE id='a'");
    else if (kind === "disconnected") await pool.query("DELETE FROM ga4_connections WHERE campaign_id='a'");
    else if (kind === "inactive") await pool.query("UPDATE ga4_connections SET is_active=false WHERE campaign_id='a'");
    else if (kind === "empty-property") await pool.query("UPDATE ga4_connections SET property_id='' WHERE campaign_id='a'");
    else if (kind === "ownerless") await pool.query("UPDATE campaigns SET owner_id=NULL WHERE id='a'");
    else if (kind === "foreign-owner") await pool.query("UPDATE campaigns SET owner_id='foreign' WHERE id='a'");
    else await pool.query("UPDATE campaigns SET status=$1 WHERE id='a'", [kind]);
    expect(await ensure()).toBeUndefined(); expect(await claim(work.id)).toBeUndefined();
    for (const action of ["renew", "release", "complete"] as const) expect(await change(work, action)).toBeUndefined();
    expect((await saved(work.id)).lease_token).toBe(work.leaseToken);
    expect(await ensure("b")).toBeDefined();
  });
  it.each([
    ["campaigns", "client_id", "changed-client"], ["campaigns", "currency", "USD"],
    ["campaigns", "ga4_campaign_filter", "other-sale"], ["campaigns", "reporting_time_zone", "UTC"],
    ["ga4_connections", "property_id", "other-property"], ["ga4_connections", "import_start_date", "2026-09-05"],
    ["ga4_connections", "is_primary", false], ["ga4_connections", "method", "service_account"],
    ["ga4_connections", "lookback_days", 30], ["ga4_connections", "connected_at", "2020-01-01"],
  ])("invalidates old work after %s.%s changes", async (table, column, value) => {
    const work = (await claim((await ensure())!.id))!;
    await pool.query(`UPDATE ${table} SET ${column}=$1 WHERE ${table === "campaigns" ? "id" : "campaign_id"}='a'`, [value]);
    expect(await claim(work.id)).toBeUndefined();
    for (const action of ["renew", "release", "complete"] as const) expect(await change(work, action)).toBeUndefined();
    const replacement = (await ensure())!;
    expect(replacement.scopeHash).not.toBe(work.scopeHash); expect(replacement.id).not.toBe(work.id);
    expect(await claim(replacement.id)).toBeUndefined(); // Wait for the old owner to expire; no simultaneous owner.
    await expire(work.id); expect(await claim(replacement.id)).toBeDefined();
  });
  it("invalidates work when a connection is added or removed and ignores credential renewal", async () => {
    const original = (await ensure())!;
    await pool.query("UPDATE ga4_connections SET access_token='renewed',expires_at=now() WHERE campaign_id='a'");
    expect((await ensure())!.id).toBe(original.id);
    await database.current.insert(schema.ga4Connections).values({ campaignId: "a", propertyId: "extra", method: "access_token" });
    expect(await claim(original.id)).toBeUndefined();
    const expanded = (await ensure())!;
    await pool.query("DELETE FROM ga4_connections WHERE campaign_id='a' AND property_id='extra'");
    expect(await claim(expanded.id)).toBeUndefined();
  });
  it.each(["missing", "old", "future", "wrong-date", "wrong-campaign", "malformed"])("does not complete using a %s alignment marker", async kind => {
    const work = (await claim((await ensure())!.id))!;
    const at = kind === "old" ? new Date(dueAt.getTime() - 1000) : kind === "future" ? new Date(Date.now() + 86400000) : new Date();
    if (kind !== "missing") await marker(kind === "malformed" ? `ga4_aligned_refresh_v1:${date}:invalid` : `ga4_aligned_refresh_v1:${date}:${at.toISOString()}`,
      kind === "wrong-campaign" ? "b" : "a", kind === "wrong-date" ? "2026-10-16" : date);
    expect(await change(work, "complete")).toBeUndefined(); expect((await saved(work.id)).status).toBe("running");
  });
  it("completes only after the existing marker, preserving that marker and all metric data", async () => {
    const work = (await claim((await ensure())!.id))!;
    const notes = `ga4_aligned_refresh_v1:${date}:${new Date().toISOString()}`;
    await marker(notes); queries.length = 0;
    expect(await change(work, "complete")).toMatchObject({ status: "completed", leaseToken: null });
    expect(await claim(work.id)).toBeUndefined();
    expect((await ensure())!.status).toBe("completed");
    expect((await pool.query("SELECT notes FROM metric_snapshots WHERE campaign_id='a'")).rows[0].notes).toBe(notes);
    expect(queries.filter(q => /^(insert|update|delete)/.test(q)).every(q => q.includes('"ga4_refresh_work"'))).toBe(true);
  });
  it("enforces state and single-owner constraints even for direct SQL writes", async () => {
    const first = (await claim((await ensure())!.id))!;
    const later = (await ensure("a", new Date(dueAt.getTime() + 1000)))!;
    await expect(pool.query("UPDATE ga4_refresh_work SET status='completed' WHERE id=$1", [first.id])).rejects.toMatchObject({ code: "23514" });
    await expect(pool.query("UPDATE ga4_refresh_work SET status='running',lease_token='other',lease_expires_at=now()+interval '1 minute',started_at=now() WHERE id=$1", [later.id]))
      .rejects.toMatchObject({ code: "23505" });
  });
  it("rejects invalid work dates, durations and owner inputs without writing work", async () => {
    for (const value of ["invalid", "2026-02-30", "2026-13-01"]) await expect(storage.ensureGA4RefreshWork("a", "owner-a", dueAt, value)).rejects.toThrow();
    await expect(storage.ensureGA4RefreshWork("a", "owner-a", new Date("invalid"), date)).rejects.toThrow();
    for (const leaseMs of [0, -1, NaN, Infinity, 999, 900001, 1234.5]) await expect(storage.claimGA4RefreshWork("a", "owner-a", "id", leaseMs)).rejects.toThrow();
    expect(await storage.ensureGA4RefreshWork("a", "owner-b", dueAt, date)).toBeUndefined();
    expect(await storage.ensureGA4RefreshWork("a", "", dueAt, date)).toBeUndefined();
    expect((await pool.query("SELECT * FROM ga4_refresh_work")).rows).toHaveLength(0);
  });
  it("persists retry delays and stops after three claims, including crash takeovers", async () => {
    const pending = (await ensure())!;
    let work = (await claim(pending.id))!;
    await storage.updateGA4RefreshWorkLease("a", "owner-a", work.id, work.leaseToken!, "release", 120_000, undefined,
      { retryable: true, code: "GA4_TRANSIENT_ERROR" });
    expect(await claim(work.id)).toBeUndefined();
    await pool.query("UPDATE ga4_refresh_work SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1", [work.id]);
    work = (await claim(work.id))!; expect(work.attemptCount).toBe(2);
    await expire(work.id); work = (await claim(work.id))!; expect(work.attemptCount).toBe(3);
    await expire(work.id); expect(await claim(work.id)).toBeUndefined();
  });
  it("does not retry permanent credential failures and lets a later slot proceed", async () => {
    const work = (await claim((await ensure())!.id))!;
    await storage.updateGA4RefreshWorkLease("a", "owner-a", work.id, work.leaseToken!, "release", 120_000, undefined,
      { retryable: false, code: "TOKEN_EXPIRED" });
    expect(await claim(work.id)).toBeUndefined();
    const later = (await ensure("a", new Date(dueAt.getTime() + 1000)))!;
    expect(await claim(later.id)).toMatchObject({ attemptCount: 1, status: "running" });
    expect(await claim(work.id)).toBeUndefined();
  });
  it.each([300_000, Infinity])("honors provider backoff across due slots (%s ms)", async retryAfterMs => {
    const work = (await claim((await ensure())!.id))!;
    await storage.updateGA4RefreshWorkLease("a", "owner-a", work.id, work.leaseToken!, "release", 120_000, undefined,
      { retryable: true, code: "GA4_PROVIDER_BACKOFF", retryAfterMs });
    const later = (await ensure("a", new Date(dueAt.getTime() + 1000)))!;
    expect(await claim(later.id)).toBeUndefined();
    expect(await claim(work.id)).toBeUndefined();
    // Only the explicit input change clears a provider hold; time is controlled in this isolated fixture.
    await storage.retireGA4RefreshWork("a");
    const fresh = (await ensure("a", new Date(dueAt.getTime() + 2000)))!;
    expect(await claim(fresh.id)).toBeDefined();
  });
});
