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
const schemaName = `custom_it_${randomUUID().replace(/-/g, "")}`;
const tables = [schema.campaigns, schema.customIntegrations, schema.customIntegrationMetrics, schema.inboundWebhookReceipts];
const storage = new DatabaseStorage();
let admin: Pool, pool: Pool, created = false;
const validation = { validationVersion: 2, confidence: 100, extractedFields: 1, requiresReview: false, warnings: [] };
const metric = (campaignId = "a", parserMetadata: any = validation) => ({ campaignId, spend: "100.00", parserMetadata });

describe.skipIf(!testUrl)("Batch 4 Custom publication and atomic transfer", () => {
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
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`); await admin?.end(); });

  beforeEach(async () => {
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    for (const [id, ownerId] of [["a", "owner"], ["b", "owner"], ["other", "another-owner"]]) {
      await database.current.insert(schema.campaigns).values({ id, ownerId, name: id, status: "active", currency: "EUR" });
    }
    await storage.createCustomIntegration({ campaignId: "a", webhookToken: "fixture-only", email: "fixture@example.invalid" });
  });
  it("preserves every metric field, IDs, timestamps, metadata and replay receipt on atomic move", async () => {
    const integration = (await storage.getCustomIntegration("a"))!;
    const saved = await storage.createCustomIntegrationMetrics({ ...metric(), previousMetrics: '{"spend":"90"}', previousUpdateAt: new Date("2025-12-01") }, {integrationId:integration.id, receipt:"receipt"});
    expect(await storage.transferCustomIntegration("a", "b", "owner")).toBe(true);
    expect(await storage.getCustomIntegration("a")).toBeUndefined();
    expect(await storage.getCustomIntegration("b")).toEqual({...integration,campaignId:"b"});
    expect(await storage.getLatestCustomIntegrationMetrics("b")).toEqual({...saved,campaignId:"b"});
    const replay = await storage.createCustomIntegrationMetrics(metric("b"), {integrationId:integration.id,receipt:"receipt"});
    expect(replay.alreadyProcessed).toBe(true);
    expect((await storage.getAllCustomIntegrationMetrics("b")).length).toBe(1);
    await expect(storage.transferCustomIntegration("a", "b", "owner")).rejects.toThrow("Destination");
  });
  it.each([["a","a","owner"], ["a","other","owner"], ["a","missing","owner"], ["a","b","wrong-owner"]])("rejects invalid transfer %s -> %s", async (from,to,owner) => {
    const saved=await storage.createCustomIntegrationMetrics(metric());
    await expect(storage.transferCustomIntegration(from,to,owner)).rejects.toThrow();
    expect(await storage.getLatestCustomIntegrationMetrics("a")).toEqual(saved);
  });
  it("rejects destination integration, orphan data and different currency", async () => {
    await storage.createCustomIntegration({campaignId:"b",webhookToken:"destination"});
    await expect(storage.transferCustomIntegration("a","b","owner")).rejects.toThrow("Destination");
    await storage.deleteCustomIntegration("b");
    await database.current.insert(schema.customIntegrationMetrics).values(metric("b"));
    await expect(storage.transferCustomIntegration("a","b","owner")).rejects.toThrow("imported data");
    await pool.query("DELETE FROM custom_integration_metrics");
    await pool.query("UPDATE campaigns SET currency='USD' WHERE id='b'");
    await expect(storage.transferCustomIntegration("a","b","owner")).rejects.toThrow("currencies");
  });
  it("rolls back metric and receipt moves when final connection update fails", async () => {
    const saved=await storage.createCustomIntegrationMetrics(metric());
    await pool.query(`CREATE FUNCTION fail_move() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$`);
    await pool.query('CREATE TRIGGER fail_move BEFORE UPDATE ON custom_integrations FOR EACH ROW EXECUTE FUNCTION fail_move()');
    try {
      await expect(storage.transferCustomIntegration("a","b","owner")).rejects.toThrow("fixture failure");
      expect(await storage.getLatestCustomIntegrationMetrics("a")).toEqual(saved);
      expect(await storage.getCustomIntegration("b")).toBeUndefined();
    } finally { await pool.query('DROP TRIGGER fail_move ON custom_integrations'); await pool.query('DROP FUNCTION fail_move()'); }
  });
  it("serializes concurrent transfers; only one move publishes", async () => {
    await storage.createCustomIntegrationMetrics(metric());
    const results = await Promise.allSettled([storage.transferCustomIntegration("a","b","owner"),storage.transferCustomIntegration("a","b","owner")]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
    expect(await storage.getAllCustomIntegrationMetrics("a")).toHaveLength(0);
    expect(await storage.getAllCustomIntegrationMetrics("b")).toHaveLength(1);
  });
  it("rejects a late token write after transfer without reviving the old campaign data", async () => {
    const integration=(await storage.getCustomIntegration("a"))!;
    await storage.transferCustomIntegration("a","b","owner");
    await expect(storage.createCustomIntegrationMetrics(metric(),{integrationId:integration.id,webhookToken:integration.webhookToken})).rejects.toThrow("revoked");
    expect(await storage.getAllCustomIntegrationMetrics("a")).toHaveLength(0);
  });
  it.each([null,{}, {...validation,requiresReview:true}, {...validation,warnings:["partial"]}, {...validation,confidence:90}, {...validation,validationVersion:1}])("never publishes review-required or unverifiable imports %j", async parserMetadata => {
    const saved=await storage.createCustomIntegrationMetrics(metric());
    await expect(storage.createCustomIntegrationMetrics(metric("a",parserMetadata))).rejects.toThrow("requires review");
    expect(await storage.getLatestCustomIntegrationMetrics("a")).toEqual(saved);
    expect(await storage.getAllCustomIntegrationMetrics("a")).toHaveLength(1);
  });
  it("retains historical unverified rows but does not return them as validated or fall back to older values", async () => {
    await storage.createCustomIntegrationMetrics(metric());
    await database.current.insert(schema.customIntegrationMetrics).values({...metric("a",null),uploadedAt:new Date("2099-01-01")});
    expect(await storage.getLatestCustomIntegrationMetrics("a")).toBeUndefined();
    expect(await storage.getAllCustomIntegrationMetrics("a")).toHaveLength(2);
  });
  it("recovers an older unverified import through validated publication without changing history or neighboring data", async () => {
    await database.current.insert(schema.customIntegrationMetrics).values({
      ...metric("a", null), id: "legacy-import", uploadedAt: new Date("2025-11-22T10:00:00Z"),
      pdfFileName: "original.pdf", emailId: "legacy-email", previousMetrics: '{"spend":"90"}',
    });
    const legacy = (await storage.getAllCustomIntegrationMetrics("a"))[0];
    const neighbor = await storage.createCustomIntegrationMetrics(metric("other"));
    const integration = (await storage.getCustomIntegration("a"))!;
    expect(await storage.getLatestCustomIntegrationMetrics("a")).toBeUndefined();
    await expect(storage.createCustomIntegrationMetrics(metric("a", { ...validation, requiresReview: true }), { integrationId: integration.id })).rejects.toThrow("requires review");
    expect(await storage.getAllCustomIntegrationMetrics("a")).toEqual([legacy]);
    const recovered = await storage.createCustomIntegrationMetrics({ ...metric(), spend: "123.45" }, { integrationId: integration.id });
    expect(await storage.getLatestCustomIntegrationMetrics("a")).toEqual(recovered);
    expect(await storage.getAllCustomIntegrationMetrics("a")).toEqual(expect.arrayContaining([legacy, recovered]));
    expect(await storage.getAllCustomIntegrationMetrics("a")).toHaveLength(2);
    expect(await storage.getLatestCustomIntegrationMetrics("other")).toEqual(neighbor);
  });
  it("preserves explicit zero, parent currency and truthful period metadata", async () => {
    await storage.createCustomIntegrationMetrics({...metric(),spend:"0"});
    expect(await storage.getLatestCustomIntegrationMetrics("a")).toMatchObject({spend:"0.00",parserMetadata:{currency:"EUR",period:"source_report_unspecified"}});
  });
  it("cannot recreate a deleted campaign through connection creation", async () => {
    await pool.query("DELETE FROM campaigns WHERE id='a'");
    await expect(storage.createCustomIntegration({campaignId:"a",webhookToken:"new"})).rejects.toThrow("unavailable");
  });
  it("rejects a dollar-denominated PDF amount for an EUR campaign", async () => {
    await expect(storage.createCustomIntegrationMetrics(metric("a",{...validation,declaredCurrency:"USD"}))).rejects.toThrow("currency");
    expect(await storage.getAllCustomIntegrationMetrics("a")).toHaveLength(0);
  });
  it("allows authenticated draft imports but not inbound token publication to drafts", async () => {
    const integration=(await storage.getCustomIntegration("a"))!;
    await pool.query("UPDATE campaigns SET status='draft' WHERE id='a'");
    await expect(storage.createCustomIntegrationMetrics(metric(),{integrationId:integration.id})).rejects.toThrow("unavailable");
    expect(await storage.createCustomIntegrationMetrics(metric(),{integrationId:integration.id,allowDraft:true})).toMatchObject({campaignId:"a"});
  });
  it("rejects late manual publication after disconnect and preserves unrelated data", async () => {
    const integration=(await storage.getCustomIntegration("a"))!;
    await storage.createCustomIntegration({campaignId:"other",webhookToken:"neighbor"});
    await storage.createCustomIntegrationMetrics(metric("other"));
    await storage.deleteCustomIntegration("a");
    await expect(storage.createCustomIntegrationMetrics(metric(),{integrationId:integration.id,allowDraft:true})).rejects.toThrow("revoked");
    expect(await storage.getAllCustomIntegrationMetrics("a")).toHaveLength(0);
    expect(await storage.getAllCustomIntegrationMetrics("other")).toHaveLength(1);
  });

});
