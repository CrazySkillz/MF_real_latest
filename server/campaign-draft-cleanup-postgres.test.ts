import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableColumns, getTableName, is, SQL } from "drizzle-orm";
import { PgDialect, PgTable } from "drizzle-orm/pg-core";
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
const schemaName = `draft_cleanup_${randomUUID().replace(/-/g, "")}`;
const tables = Object.values(schema).filter(value => is(value, PgTable) && value !== schema.ga4RefreshWork) as PgTable[];
const storage = new DatabaseStorage();
let admin: Pool, pool: Pool, created = false;
const cleanup = (id = "a", ownerId = "owner-a") =>
  storage.deleteCampaignCascade(id, { expectedDraftOwnerId: ownerId });

async function expectPreserved(id = "a", status = "active") {
  expect((await storage.getCampaign(id))?.status).toBe(status);
  expect(await storage.getGA4DailyMetrics(id, `property-${id}`, "2026-10-17", "2026-10-17")).toHaveLength(1);
  expect(await storage.getGA4OverviewSnapshot(id, `property-${id}`)).toBeDefined();
  expect((await pool.query("SELECT id FROM ga4_refresh_work WHERE campaign_id=$1", [id])).rowCount).toBe(1);
  expect((await pool.query("SELECT metadata FROM notifications WHERE campaign_id=$1", [id])).rows[0].metadata).toBe("{}");
}

async function waitForCampaignLock(queryPattern = "%campaigns%") {
  await vi.waitFor(async () => {
    const result = await admin.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query ILIKE $2", [schemaName, queryPattern]);
    expect(result.rowCount).toBeGreaterThan(0);
  }, { timeout: 5000, interval: 20 });
}

describe.skipIf(!testUrl)("campaign wizard cleanup with real PostgreSQL transactions", () => {
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
    await pool.query(readFileSync(new URL("../migrations/0020_add_ga4_refresh_work.sql", import.meta.url), "utf8"));
    await pool.query(readFileSync(new URL("../migrations/0021_add_ga4_refresh_recovery.sql", import.meta.url), "utf8"));
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`); await admin?.end(); });
  beforeEach(async () => {
    await pool.query("DELETE FROM ga4_refresh_work");
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    for (const id of ["a", "b"]) {
      await database.current.insert(schema.clients).values({ id: `client-${id}`, ownerId: `owner-${id}`, name: id });
      await database.current.insert(schema.campaigns).values({ id, ownerId: `owner-${id}`, clientId: `client-${id}`, name: id,
        status: "draft", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: "sale" });
      await database.current.insert(schema.ga4Connections).values({ id: `connection-${id}`, campaignId: id,
        propertyId: `property-${id}`, method: "access_token", importStartDate: "2026-10-17", isPrimary: true });
      await database.current.insert(schema.ga4DailyMetrics).values({ campaignId: id, propertyId: `property-${id}`,
        date: "2026-10-17", sessions: 10, users: 9, pageviews: 15, conversions: 2, revenue: "20" });
      await database.current.insert(schema.ga4OverviewSnapshots).values({ campaignId: id, propertyId: `property-${id}`,
        windowStart: "2026-10-17", windowEnd: "2026-10-17", campaignBreakdown: {}, landingPages: {}, conversionEvents: {} });
      await database.current.insert(schema.notifications).values({ campaignId: id, type: "performance-alert", title: id, message: "Test", metadata: "{}" });
      await pool.query("INSERT INTO ga4_refresh_work (id,campaign_id,due_at,reporting_date,scope_hash,scope) VALUES ($1,$2,NOW(),'2026-10-17','test','{}')", [`work-${id}`, id]);
    }
  });

  it.each(["active", "paused", "inactive"])("rejects cleanup of a %s campaign without deleting analytics or hiding alerts", async status => {
    await storage.updateCampaign("a", { status });
    await expect(cleanup()).rejects.toThrow("CAMPAIGN_NO_LONGER_DRAFT");
    await expectPreserved("a", status);
    await expectPreserved("b", "draft");
  });

  it("rechecks the draft after waiting for a concurrent finalization to commit", async () => {
    const writer = await pool.connect();
    let pending: Promise<any> | undefined;
    try {
      await writer.query("BEGIN");
      await writer.query("UPDATE campaigns SET status='active' WHERE id='a'");
      pending = cleanup().then((value: any) => ({ value }), (error: Error) => ({ error }));
      await waitForCampaignLock();
      await writer.query("COMMIT");
      expect((await pending).error?.message).toBe("CAMPAIGN_NO_LONGER_DRAFT");
      await expectPreserved();
      await expectPreserved("b", "draft");
    } finally {
      await writer.query("ROLLBACK"); writer.release();
      await pending;
    }
  });

  it("refuses a cleanup whose campaign owner changed after the API access check", async () => {
    await pool.query("UPDATE campaigns SET owner_id='owner-new' WHERE id='a'");
    expect(await cleanup()).toBe(false);
    expect((await storage.getCampaign("a"))?.ownerId).toBe("owner-new");
    await expectPreserved("a", "draft");
  });

  it("cleans only the selected draft and makes repeated cleanup return false", async () => {
    expect(await cleanup()).toBe(true);
    expect(await storage.getCampaign("a")).toBeUndefined();
    expect(await storage.getGA4DailyMetrics("a", "property-a", "2026-10-17", "2026-10-17")).toHaveLength(0);
    expect(await storage.getGA4OverviewSnapshot("a", "property-a")).toBeUndefined();
    expect((await pool.query("SELECT id FROM ga4_refresh_work WHERE campaign_id='a'")).rowCount).toBe(0);
    const notification = (await pool.query("SELECT metadata FROM notifications WHERE campaign_id='a'")).rows[0];
    expect(JSON.parse(notification.metadata).dismissalReason).toBe("campaign_deleted");
    expect(await cleanup()).toBe(false);
    expect(await storage.updateCampaign("a", { status: "active" })).toBeUndefined();
    await expectPreserved("b", "draft");
  });

  it("keeps confirmed deletion available after activation", async () => {
    await storage.updateCampaign("a", { status: "active" });
    expect(await storage.deleteCampaignCascade("a")).toBe(true);
    expect(await storage.getCampaign("a")).toBeUndefined();
    expect((await pool.query("SELECT id FROM ga4_refresh_work WHERE campaign_id='a'")).rowCount).toBe(0);
    await expectPreserved("b", "draft");
  });

  it("does not resurrect a cancelled draft when cleanup takes the campaign lock first", async () => {
    const childBlocker = await pool.connect();
    let deletion: Promise<boolean> | undefined;
    let activation: ReturnType<typeof storage.updateCampaign> | undefined;
    try {
      await childBlocker.query("BEGIN");
      await childBlocker.query("SELECT id FROM ga4_daily_metrics WHERE campaign_id='a' FOR UPDATE");
      deletion = cleanup();
      await waitForCampaignLock("%delete%ga4_daily_metrics%");
      activation = storage.updateCampaign("a", { status: "active" });
      await waitForCampaignLock();
      await childBlocker.query("COMMIT");
      expect(await deletion).toBe(true);
      expect(await activation).toBeUndefined();
      expect(await storage.getCampaign("a")).toBeUndefined();
      await expectPreserved("b", "draft");
    } finally {
      await childBlocker.query("ROLLBACK"); childBlocker.release();
      await Promise.allSettled([deletion, activation]);
    }
  });

  it("rolls back the campaign and earlier child deletes if a later cleanup write fails", async () => {
    await pool.query("UPDATE notifications SET metadata='invalid-json' WHERE campaign_id='a'");
    await expect(cleanup()).rejects.toThrow();
    expect((await storage.getCampaign("a"))?.status).toBe("draft");
    expect(await storage.getGA4DailyMetrics("a", "property-a", "2026-10-17", "2026-10-17")).toHaveLength(1);
    expect(await storage.getGA4OverviewSnapshot("a", "property-a")).toBeDefined();
    expect((await pool.query("SELECT id FROM ga4_refresh_work WHERE campaign_id='a'")).rowCount).toBe(1);
    await expectPreserved("b", "draft");
  });

  it("retains cleanup compatibility when the optional recovery table is absent", async () => {
    await pool.query("ALTER TABLE ga4_refresh_work RENAME TO hidden_refresh_work");
    try {
      expect(await cleanup()).toBe(true);
      expect(await storage.getCampaign("a")).toBeUndefined();
      expect((await storage.getCampaign("b"))?.status).toBe("draft");
    } finally {
      await pool.query("ALTER TABLE hidden_refresh_work RENAME TO ga4_refresh_work");
    }
  });

  it("removes only the deleted client's recovery records through the shared child cleanup", async () => {
    expect(await storage.deleteClientCascade("owner-a", "client-a")).toBe(true);
    expect(await storage.getCampaign("a")).toBeUndefined();
    expect((await pool.query("SELECT id FROM ga4_refresh_work WHERE campaign_id='a'")).rowCount).toBe(0);
    await expectPreserved("b", "draft");
  });

  it("does not remove recovery records when client ownership is not verified", async () => {
    expect(await storage.deleteClientCascade("owner-a", "client-b")).toBe(false);
    await expectPreserved("a", "draft");
    await expectPreserved("b", "draft");
  });

  it("returns false if another delete wins while this delete waits", async () => {
    const writer: PoolClient = await pool.connect();
    let pending: Promise<boolean> | undefined;
    try {
      await writer.query("BEGIN");
      await writer.query("DELETE FROM campaigns WHERE id='a'");
      pending = storage.deleteCampaignCascade("a");
      await waitForCampaignLock();
      await writer.query("COMMIT");
      expect(await pending).toBe(false);
      await expectPreserved("b", "draft");
    } finally {
      await writer.query("ROLLBACK"); writer.release();
      await pending;
    }
  });
});
