import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableColumns, getTableName, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";
const database = vi.hoisted(() => ({ current: null as any }));
vi.mock("./db", () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from "./storage";
const testUrl = process.env.GA4_TEST_DATABASE_URL || "";
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== "127.0.0.1" || url.port !== "55444" || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) throw Error("Isolated local fixture required");
}
const namespace = `monitor_schema_${randomUUID().replace(/-/g, "")}`;
let admin: Pool, writer: Pool, reader: Pool, created = false;
const storage = new DatabaseStorage(), hash = (id: string) => createHash("sha256").update(id).digest("hex").slice(0, 12);
describe.skipIf(!testUrl)("monitor snapshots during additive access rollout", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 1 });
    await admin.query(`CREATE SCHEMA "${namespace}"`); created = true;
    writer = new Pool({ connectionString: testUrl, options: `-c search_path=${namespace}`, max: 1 });
    reader = new Pool({ connectionString: testUrl, options: `-c search_path=${namespace} -c default_transaction_read_only=on`, max: 1 });
    database.current = drizzle(reader, { schema });
    const dialect = new PgDialect();
    for (const table of [schema.clients, schema.campaigns, schema.ga4Connections, schema.ga4DailyMetrics, schema.ga4OverviewSnapshots,
      schema.revenueSources, schema.revenueRecords, schema.spendSources, schema.spendRecords, schema.googleSheetsConnections,
      schema.hubspotConnections, schema.salesforceConnections, schema.shopifyConnections, schema.ga4GoogleAdsSpendConnections,
      schema.ga4GoogleAdsSpendDailyMetrics, schema.kpis, schema.benchmarks, schema.metricSnapshots, schema.linkedinReports,
      schema.reportSnapshots, schema.ga4RefreshWork, schema.notifications, schema.emailAlertEvents]) {
      const columns = Object.values(getTableColumns(table)).filter(c => c.name !== "service_account_binding_id").map((column: any) => {
        const value = column.default, d = value instanceof SQL ? dialect.sqlToQuery(value).sql : typeof value === "string" ? `'${value.replace(/'/g, "''")}'` : String(value);
        return `"${column.name}" ${column.getSQLType()}${column.notNull ? " NOT NULL" : ""}${value !== undefined ? ` DEFAULT ${d}` : ""}${column.primary ? " PRIMARY KEY" : ""}`;
      });
      await writer.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(",")})`);
    }
    const db = drizzle(writer, { schema });
    await db.insert(schema.clients).values([{ id: "ca", ownerId: "oa", name: "A" }, { id: "cb", ownerId: "ob", name: "B" }]);
    await db.insert(schema.campaigns).values([{ id: "a", ownerId: "oa", clientId: "ca", name: "A", status: "active" }, { id: "b", ownerId: "ob", clientId: "cb", name: "B", status: "active" }]);
    await writer.query("INSERT INTO ga4_connections (campaign_id,property_id,property_name,method) VALUES ('a','123','A','access_token'),('b','456','B','access_token')");
    await writer.query("INSERT INTO ga4_google_ads_spend_connections (campaign_id,customer_id,method) VALUES ('a','4951281615','oauth'),('b','1234567890','oauth')");
  });
  afterAll(async () => { await reader?.end(); await writer?.end(); if (created) await admin.query(`DROP SCHEMA "${namespace}" CASCADE`); await admin?.end(); });
  it("reads a legacy schema without adding columns, changing data or crossing clients", async () => {
    const before = (await writer.query("SELECT to_jsonb(t) AS row FROM ga4_connections t ORDER BY campaign_id")).rows;
    const snapshot = await storage.getLiveNumberCheckSnapshot(hash("a"));
    expect(snapshot.rows.ga4Connections).toHaveLength(1);
    expect(snapshot.rows.ga4Connections[0]).toMatchObject({ campaignId: "a", propertyId: "123", serviceAccountBindingId: null });
    expect(snapshot.rows.ga4GoogleAdsSpendConnections).toHaveLength(1);
    expect(snapshot.rows.ga4GoogleAdsSpendConnections[0]).toMatchObject({ campaignId: "a", customerId: "4951281615", serviceAccountBindingId: null });
    expect((await writer.query("SELECT to_jsonb(t) AS row FROM ga4_connections t ORDER BY campaign_id")).rows).toEqual(before);
    await expect(reader.query("UPDATE ga4_connections SET property_id='999'")).rejects.toMatchObject({ code: "25006" });
  });
  it("reads the exact new binding after migration and preserves campaign ownership checks", async () => {
    await writer.query("ALTER TABLE ga4_connections ADD COLUMN service_account_binding_id varchar; UPDATE ga4_connections SET service_account_binding_id='binding-a' WHERE campaign_id='a'");
    await writer.query("ALTER TABLE ga4_google_ads_spend_connections ADD COLUMN service_account_binding_id varchar; UPDATE ga4_google_ads_spend_connections SET service_account_binding_id='ads-binding-a' WHERE campaign_id='a'");
    expect((await storage.getLiveNumberCheckSnapshot(hash("a"))).rows.ga4GoogleAdsSpendConnections[0].serviceAccountBindingId).toBe("ads-binding-a");
    expect((await storage.getLiveNumberCheckSnapshot(hash("b"))).rows.ga4GoogleAdsSpendConnections[0].serviceAccountBindingId).toBeNull();
    expect((await storage.getLiveNumberCheckSnapshot(hash("a"))).rows.ga4Connections[0].serviceAccountBindingId).toBe("binding-a");
    expect((await storage.getLiveNumberCheckSnapshot(hash("b"))).rows.ga4Connections[0].serviceAccountBindingId).toBeNull();
    await writer.query("UPDATE clients SET owner_id='wrong-owner' WHERE id='ca'");
    await expect(storage.getLiveNumberCheckSnapshot(hash("a"))).rejects.toThrow("MONITOR_CAMPAIGN_UNAVAILABLE");
  });
});
