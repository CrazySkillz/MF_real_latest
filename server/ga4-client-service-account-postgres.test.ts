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
vi.mock("google-auth-library", async importOriginal => ({ ...await importOriginal<any>(), JWT: class {
  transporter = { defaults: {} };
  async getAccessToken() { return { token: "synthetic-issuer" }; }
} }));
import { DatabaseStorage } from "./storage";
const testUrl = process.env.GA4_TEST_DATABASE_URL || "";
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== "127.0.0.1" || url.port !== "55444" || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) throw Error("Isolated local fixture required");
}
const namespace = `ga4_accounts_${randomUUID().replace(/-/g, "")}`;
const migration = readFileSync("migrations/0028_ga4_client_service_accounts.sql", "utf8");
let admin: Pool, pool: Pool, created = false;
const storage = new DatabaseStorage();
const reserve = (campaign: string, property: string, owner = campaign === "b" ? "owner-b" : "owner-a") => storage.reserveGA4ClientServiceAccount(campaign, property, owner);
const complete = (campaign: string, property: string, id: string, googleId: string, verified = false) => storage.completeGA4ClientServiceAccount(campaign, property, id, googleId, campaign === "b" ? "owner-b" : "owner-a", verified);
describe.skipIf(!testUrl)("client service-account PostgreSQL boundaries", () => {
  beforeAll(async () => {
    vi.stubEnv("GA4_CLIENT_SERVICE_ACCOUNT_JSON", JSON.stringify({ type: "service_account", project_id: "fixture-project", client_email: "issuer@fixture-project.iam.gserviceaccount.com", private_key: "fixture-only" }));
    admin = new Pool({ connectionString: testUrl, max: 1 });
    await admin.query(`CREATE SCHEMA "${namespace}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${namespace}`, max: 5 });
    database.current = drizzle(pool, { schema });
    const dialect = new PgDialect();
    for (const table of [schema.clients, schema.campaigns, schema.ga4Connections]) {
      const columns = Object.values(getTableColumns(table)).filter(c => c.name !== "service_account_binding_id").map((column: any) => {
        const value = column.default, d = value instanceof SQL ? dialect.sqlToQuery(value).sql : typeof value === "string" ? `'${value.replace(/'/g, "''")}'` : String(value);
        return `"${column.name}" ${column.getSQLType()}${column.notNull ? " NOT NULL" : ""}${value !== undefined ? ` DEFAULT ${d}` : ""}${column.primary ? " PRIMARY KEY" : ""}`;
      });
      await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(",")})`);
    }
    await pool.query(migration);
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${namespace}" CASCADE`); await admin?.end(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (!/^https:\/\/iamcredentials\.googleapis\.com\/v1\/projects\/-\/serviceAccounts\/\d+:generateAccessToken$/.test(url)) throw Error("Unexpected provider request");
      return new Response(JSON.stringify({ accessToken: url.includes("/111:") ? "client-a-token" : "client-b-token", expireTime: new Date(Date.now() + 3600000).toISOString() }));
    }));
    await pool.query("TRUNCATE ga4_connections,ga4_client_service_accounts,campaigns,clients");
    await database.current.insert(schema.clients).values([{ id: "client-a", ownerId: "owner-a", name: "Acme" }, { id: "client-b", ownerId: "owner-b", name: "Beta" }]);
    await database.current.insert(schema.campaigns).values([
      { id: "a", ownerId: "owner-a", clientId: "client-a", name: "A", status: "draft" },
      { id: "a2", ownerId: "owner-a", clientId: "client-a", name: "A2", status: "draft" },
      { id: "b", ownerId: "owner-b", clientId: "client-b", name: "B", status: "draft" },
    ]);
  });
  it("reserves one identity across concurrent requests and campaigns for the same client/property", async () => {
    const rows = await Promise.all([reserve("a", "123456789"), reserve("a2", "123456789"), reserve("a", "123456789")]);
    expect(new Set(rows.map(r => r.id)).size).toBe(1);
    expect(rows[0].email).toBe("acme-123456789@fixture-project.iam.gserviceaccount.com");
    expect(rows[0].verifiedAt).toBeNull(); expect(rows[0].googleUniqueId).toBeNull();
  });
  it("does not reveal another owner's binding or accept a foreign binding ID", async () => {
    const a = await reserve("a", "123456789");
    expect(await storage.getGA4ClientServiceAccount("b", "123456789", a.id)).toBeUndefined();
    await expect(complete("b", "123456789", a.id, "999", true)).rejects.toThrow("identity has changed");
    expect(await storage.getGA4ClientServiceAccount("a", "999999999", a.id)).toBeUndefined();
    expect((await storage.getGA4ClientServiceAccount("a", "123456789", a.id))?.verifiedAt).toBeNull();
  });
  it("refuses a mismatched campaign/client owner, including internal callers", async () => {
    await pool.query("UPDATE campaigns SET owner_id='owner-b' WHERE id='a'");
    await expect(reserve("a", "123456789")).rejects.toThrow("new campaign");
  });
  it("fails closed on a name collision instead of sharing access", async () => {
    await reserve("a", "123456789");
    await pool.query("UPDATE clients SET name='Acme' WHERE id='client-b'");
    await expect(reserve("b", "123456789")).rejects.toThrow("another client");
    expect(await storage.getGA4ClientServiceAccount("b", "123456789")).toBeUndefined();
  });
  it("keeps the original identity after a client rename and only verifies the same Google unique ID", async () => {
    const a = await reserve("a", "123456789");
    await pool.query("UPDATE clients SET name='Renamed' WHERE id='client-a'");
    expect((await reserve("a2", "123456789")).email).toBe(a.email);
    await complete("a", "123456789", a.id, "1234");
    expect((await storage.getGA4ClientServiceAccount("a", "123456789"))?.verifiedAt).toBeNull();
    await expect(complete("a", "123456789", a.id, "555", true)).rejects.toThrow("identity has changed");
    expect((await complete("a", "123456789", a.id, "1234", true)).verifiedAt).toBeInstanceOf(Date);
  });
  it("blocks connection creation from an unverified or foreign reservation before writes", async () => {
    const a = await reserve("a", "123456789");
    for (const campaignId of ["a", "b"]) await expect(storage.createGA4Connection({ campaignId, propertyId: "123456789", method: "service_account", serviceAccountBindingId: a.id, lookbackDays: 30 })).rejects.toThrow("not verified");
    expect((await pool.query("SELECT count(*) FROM ga4_connections")).rows[0].count).toBe("0");
  });
  it("uses each client's own credential through actual connection persistence and runtime reads", async () => {
    const a = await reserve("a", "123456789"), b = await reserve("b", "123456789");
    await complete("a", "123456789", a.id, "111", true);
    await complete("b", "123456789", b.id, "222", true);
    for (const [campaignId, bindingId, token] of [["a", a.id, "client-a-token"], ["b", b.id, "client-b-token"]]) {
      const saved = await storage.createGA4Connection({ campaignId, propertyId: "123456789", method: "service_account", serviceAccountBindingId: bindingId, lookbackDays: 30 });
      expect(saved.accessToken).toBe(token);
      expect((await storage.getGA4Connection(campaignId))?.accessToken).toBe(token);
    }
    const persisted = (await pool.query("SELECT access_token,refresh_token,service_account_key FROM ga4_connections")).rows;
    expect(persisted).toEqual([{ access_token: null, refresh_token: null, service_account_key: null }, { access_token: null, refresh_token: null, service_account_key: null }]);
    await pool.query("UPDATE ga4_client_service_accounts SET verified_at=NULL WHERE id=$1", [a.id]);
    await expect(storage.getGA4Connection("a")).rejects.toThrow("not verified");
    expect((await storage.getGA4Connection("b"))?.accessToken).toBe("client-b-token");
  });
  it("rejects an owner change between the HTTP access check and reservation/completion", async () => {
    const a = await reserve("a", "123456789");
    await pool.query("UPDATE campaigns SET owner_id='new-owner' WHERE client_id='client-a'");
    await pool.query("UPDATE clients SET owner_id='new-owner' WHERE id='client-a'");
    await expect(reserve("a", "123456789", "owner-a")).rejects.toThrow("new campaign");
    await expect(complete("a", "123456789", a.id, "111", true)).rejects.toThrow("no longer available");
    expect(await storage.getGA4ClientServiceAccount("a", "123456789", a.id)).toBeUndefined();
  });
  it("retains the name reservation after deletion but cannot use a missing client", async () => {
    const a = await reserve("a", "123456789");
    await pool.query("DELETE FROM clients WHERE id='client-a'");
    expect(await storage.getGA4ClientServiceAccount("a", "123456789")).toBeUndefined();
    await expect(complete("a", "123456789", a.id, "1234", true)).rejects.toThrow("no longer available");
    await pool.query("UPDATE clients SET name='Acme' WHERE id='client-b'");
    await expect(reserve("b", "123456789")).rejects.toThrow("another client");
  });
  it("does not provision active/deleted campaigns and hides deleted campaign identities", async () => {
    const a = await reserve("a", "123456789");
    for (const state of ["active", "deleted"]) {
      await pool.query("UPDATE campaigns SET status=$1 WHERE id='a'", [state]);
      await expect(reserve("a", "123456789")).rejects.toThrow("new campaign");
      await expect(complete("a", "123456789", a.id, "1234", true)).rejects.toThrow("no longer available");
    }
    expect(await storage.getGA4ClientServiceAccount("a", "123456789")).toBeUndefined();
  });
  it("caps automatic reservations per client while allowing reuse and a different client", async () => {
    for (let i = 1; i <= 20; i++) await reserve("a", String(i));
    await expect(reserve("a", "21")).rejects.toThrow("limit");
    expect((await reserve("a", "1")).propertyId).toBe("1");
    expect((await reserve("b", "21")).clientId).toBe("client-b");
  });
  it("additive migration is repeatable and leaves existing connections and reservations unchanged", async () => {
    await database.current.insert(schema.ga4Connections).values({ campaignId: "a", propertyId: "123456789", method: "access_token", propertyName: "Existing", accessToken: "synthetic" });
    await reserve("a", "123456789");
    const before = await pool.query("SELECT to_jsonb(t) AS row FROM ga4_connections t");
    const identities = await pool.query("SELECT to_jsonb(t) AS row FROM ga4_client_service_accounts t");
    await pool.query(migration);
    expect((await pool.query("SELECT to_jsonb(t) AS row FROM ga4_connections t")).rows).toEqual(before.rows);
    expect((await pool.query("SELECT to_jsonb(t) AS row FROM ga4_client_service_accounts t")).rows).toEqual(identities.rows);
    expect(before.rows[0].row.service_account_binding_id).toBeNull();
  });
});
