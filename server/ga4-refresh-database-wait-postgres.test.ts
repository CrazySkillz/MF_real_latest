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
const schemaName = `ga4_wait_it_${randomUUID().replace(/-/g, "")}`;
const tables = [schema.campaigns, schema.ga4Connections, schema.metricSnapshots];
const storage = new DatabaseStorage();
const date = "2026-10-17";
const dueAt = new Date(Date.now() - 60_000);
let admin: Pool, pool: Pool, created = false;
const ensure = () => storage.ensureGA4RefreshWork("a", "owner-a", dueAt, date);
async function claim() {
  const work = (await ensure())!;
  const claimed = (await storage.claimGA4RefreshWork("a", "owner-a", work.id, 120_000))!;
  return { campaignId: "a", ownerId: "owner-a", reportingDate: date, work: { id: claimed.id, leaseToken: claimed.leaseToken! } };
}
async function accepts(scope: any) { return storage.writeWithGA4RefreshOwnership(scope, async () => true); }

describe.skipIf(!testUrl)("GA4 owned database waits and credentials with real PostgreSQL", () => {
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
  it("bounds an exhausted connection pool and releases a connection that arrives too late", async () => {
    const held = await Promise.all(Array.from({ length: 4 }, () => pool.connect()));
    try { await expect(ensure()).rejects.toThrow("GA4_REFRESH_DATABASE_WAIT_TIMEOUT"); }
    finally { held.forEach(client => client.release()); }
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(pool.waitingCount).toBe(0); expect(pool.idleCount).toBe(pool.totalCount);
    expect(await ensure()).toBeDefined();
  }, 20_000);
  it("destroys a stalled checked-out connection and rolls back its unfinished writes", async () => {
    const scope = await claim(); let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const nativeSetTimeout = globalThis.setTimeout;
    const timers = vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: any, ms: number, ...args: any[]) =>
      nativeSetTimeout(fn, ms === 120_000 ? 300 : ms, ...args)) as any);
    const outcome = storage.writeWithGA4RefreshOwnership(scope, async tx => {
      await tx.execute(sql`UPDATE campaigns SET spend='999' WHERE id='a'`);
      const pending = Promise.resolve(tx.execute(sql`SELECT pg_sleep(1.2)`)); entered(); await pending;
    }).then(() => null, error => error);
    try {
      await Promise.race([started, outcome.then(error => { throw error; })]);
      expect(await outcome).toMatchObject({ message: "GA4_REFRESH_DATABASE_TRANSACTION_TIMEOUT" });
    } finally { timers.mockRestore(); }
    expect((await storage.getCampaign("a"))?.spend).toBe("0.00");
    expect(await accepts(scope)).toBe(true);
  });
  it("keeps ordinary database connections usable when one owned transaction times out", async () => {
    const before = pool.totalCount;
    const scope = await claim();
    await expect(storage.writeWithGA4RefreshOwnership(scope, async tx => {
      await tx.execute(sql`SET LOCAL statement_timeout = '50ms'`);
      await tx.execute(sql`UPDATE campaigns SET spend='999' WHERE id='a'`);
      await tx.execute(sql`SELECT pg_sleep(1)`);
    })).rejects.toThrow();
    expect((await storage.getCampaign("a"))?.spend).toBe("0.00");
    expect((await storage.updateCampaign("b", { spend: "44" }))?.spend).toBe("44.00");
    expect(pool.totalCount).toBeGreaterThanOrEqual(before);
    expect(await accepts(scope)).toBe(true);
  });
  it("handles a server-closed idle transaction and releases its database locks", async () => {
    const scope = await claim();
    const outcome = storage.writeWithGA4RefreshOwnership(scope, async tx => {
      await tx.execute(sql`SET LOCAL idle_in_transaction_session_timeout = '100ms'`);
      await tx.execute(sql`UPDATE campaigns SET spend='999' WHERE id='a'`);
      await new Promise(() => {});
    }).catch(error => error);
    expect(await outcome).toMatchObject({ code: "25P03" });
    expect((await storage.getCampaign("a"))?.spend).toBe("0.00");
    expect(await accepts(scope)).toBe(true);
  });
  it("never renews or writes beyond the durable attempt deadline", async () => {
    const scope = await claim();
    await pool.query("UPDATE ga4_refresh_work SET started_at=clock_timestamp()-interval '14 minutes 50 seconds' WHERE id=$1", [scope.work.id]);
    expect(await storage.updateGA4RefreshWorkLease("a", "owner-a", scope.work.id, scope.work.leaseToken, "renew")).toBeDefined();
    const remaining = (await pool.query("SELECT extract(epoch FROM lease_expires_at-clock_timestamp()) AS value FROM ga4_refresh_work WHERE id=$1", [scope.work.id])).rows[0].value;
    expect(Number(remaining)).toBeGreaterThan(0); expect(Number(remaining)).toBeLessThanOrEqual(10);
    await pool.query("UPDATE ga4_refresh_work SET started_at=clock_timestamp()-interval '16 minutes' WHERE id=$1", [scope.work.id]);
    expect(await storage.updateGA4RefreshWorkLease("a", "owner-a", scope.work.id, scope.work.leaseToken, "renew")).toBeUndefined();
    await expect(accepts(scope)).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
  });
  it("fences credential renewal and preserves the legacy refresh token and client secret", async () => {
    const scope = await claim();
    const renewed = await storage.updateGA4ConnectionTokens("connection-a", { accessToken: "new-token" }, { refreshScope: scope });
    expect(renewed).toMatchObject({ accessToken: "new-token", refreshToken: "keep-refresh", clientSecret: "keep-secret" });
    await expect(storage.updateGA4ConnectionTokens("connection-b", { accessToken: "wrong" }, { refreshScope: scope })).rejects.toThrow();
    await pool.query("UPDATE ga4_refresh_work SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [scope.work.id]);
    await expect(storage.updateGA4ConnectionTokens("connection-a", { accessToken: "late-token" }, { refreshScope: scope })).rejects.toThrow();
    expect((await storage.getGA4Connection("a"))?.accessToken).toBe("new-token");
  });
});
