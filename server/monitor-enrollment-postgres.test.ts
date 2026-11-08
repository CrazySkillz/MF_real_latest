import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
const database = vi.hoisted(() => ({ current: null as any }));
vi.mock("./db", () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from "./storage";
const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "").trim();
if (testUrl) {
  const url = new URL(testUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1"
    || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) throw new Error("Enrollment tests require isolated local PostgreSQL");
}
const namespace = `monitor_enrollment_${randomUUID().replace(/-/g, "")}`;
let admin: Pool, writer: Pool, reader: Pool, created = false;
const storage = new DatabaseStorage(), hash = (id: string) => createHash("sha256").update(id).digest("hex").slice(0, 12);
describe.skipIf(!testUrl)("monitor enrollment against read-only PostgreSQL", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 1 });
    await admin.query(`CREATE SCHEMA "${namespace}"`); created = true;
    writer = new Pool({ connectionString: testUrl, options: `-c search_path=${namespace}`, max: 1 });
    reader = new Pool({ connectionString: testUrl, options: `-c search_path=${namespace} -c default_transaction_read_only=on`, max: 1 });
    database.current = drizzle(reader);
    await writer.query("CREATE TABLE clients(id text primary key, owner_id text); CREATE TABLE campaigns(id text primary key, owner_id text, client_id text, status text, reporting_time_zone text, created_at timestamp); CREATE TABLE ga4_refresh_work(campaign_id text, status text, scope jsonb, completed_at timestamptz)");
    await writer.query('ALTER TABLE ga4_refresh_work ADD COLUMN scope_hash text, ADD COLUMN last_error text, ADD COLUMN retryable boolean DEFAULT true, ADD COLUMN attempt_count integer DEFAULT 0, ADD COLUMN lease_expires_at timestamptz');
  });
  afterAll(async () => {
    await reader?.end(); await writer?.end();
    if (created) await admin.query(`DROP SCHEMA "${namespace}" CASCADE`);
    await admin?.end();
  });
  beforeEach(async () => {
    await writer.query("TRUNCATE campaigns,clients,ga4_refresh_work; INSERT INTO clients VALUES ('client-a','owner-a'),('client-b','owner-b'); INSERT INTO campaigns VALUES ('a','owner-a','client-a','active','Europe/Amsterdam','2026-11-01'),('b','owner-b','client-b','draft','UTC','2026-11-01')");
  });
  it("enrolls newly activated campaigns across clients without any saved allowlist or successful refresh", async () => {
    expect((await storage.getMonitorCampaigns()).map(c => c.campaignIdHash)).toEqual([hash("a")]);
    await writer.query("UPDATE campaigns SET status='active' WHERE id='b'");
    expect((await storage.getMonitorCampaigns()).map(c => c.campaignIdHash).sort()).toEqual([hash("a"), hash("b")].sort());
    await expect(reader.query("UPDATE campaigns SET status='paused'")).rejects.toMatchObject({ code: "25006" });
  });
  it('finds only current exhausted verification failures using read-only access', async () => {
    await writer.query(`INSERT INTO ga4_refresh_work(campaign_id,status,scope,scope_hash,last_error,attempt_count) VALUES ('b','pending','{"kind":"initial_import"}','scope','GA4_INITIAL_VERIFICATION_DIFFERENCE',3)`);
    expect(await storage.getInitialImportVerificationFailures()).toEqual([hash('b')]);
    expect((await storage.getMonitorCampaigns()).map(c => c.campaignIdHash)).toEqual([hash('a')]);
    for (const update of ["attempt_count=1", "scope_hash='invalidated:scope'", "status='completed'", "status='running',lease_expires_at=clock_timestamp()+interval '1 hour'"]) {
      await writer.query("UPDATE ga4_refresh_work SET status='pending',scope_hash='scope',attempt_count=3");
      await writer.query(`UPDATE ga4_refresh_work SET ${update}`);
      expect(await storage.getInitialImportVerificationFailures()).toEqual([]);
    }
    await writer.query("UPDATE ga4_refresh_work SET status='pending',scope_hash='scope',attempt_count=3; UPDATE campaigns SET status='deleted' WHERE id='b'");
    expect(await storage.getInitialImportVerificationFailures()).toEqual([]);
  });
  it.each(["draft", "paused", "inactive", "deleted"])("removes %s campaigns without changing their data", async status => {
    await writer.query("UPDATE campaigns SET status=$1 WHERE id='a'", [status]);
    expect(await storage.getMonitorCampaigns()).toEqual([]);
    expect((await writer.query("SELECT status FROM campaigns WHERE id='a'")).rows[0].status).toBe(status);
  });
  it("reflects timezone edits and hard deletion on the next discovery", async () => {
    await writer.query("UPDATE campaigns SET reporting_time_zone='Asia/Kolkata' WHERE id='a'");
    expect(await storage.getMonitorCampaigns()).toMatchObject([{ reportingTimeZone: "Asia/Kolkata" }]);
    await writer.query("DELETE FROM campaigns WHERE id='a'");
    expect(await storage.getMonitorCampaigns()).toEqual([]);
  });
  it("excludes legacy orphan tests, but fails closed for a broken active client ownership boundary", async () => {
    await writer.query("UPDATE campaigns SET client_id=null WHERE id='a'");
    expect(await storage.getMonitorCampaigns()).toEqual([]);
    await writer.query("UPDATE campaigns SET client_id='client-b' WHERE id='a'");
    await expect(storage.getMonitorCampaigns()).rejects.toThrow("MONITOR_SCOPE_INVALID");
    await writer.query("DELETE FROM clients WHERE id='client-b'");
    await expect(storage.getMonitorCampaigns()).rejects.toThrow("MONITOR_SCOPE_INVALID");
  });
  it("starts refresh expectations at completed initial import, not an older draft date or ongoing refresh", async () => {
    await writer.query("INSERT INTO ga4_refresh_work VALUES ('a','completed','{\"kind\":\"initial_import\"}','2026-11-07T09:00:00Z'),('a','completed','{}','2026-11-07T13:00:00Z')");
    expect(await storage.getMonitorCampaigns()).toMatchObject([{ monitorFrom: "2026-11-07T09:00:00.000Z" }]);
  });
  it("alerts on capacity overflow rather than silently dropping campaigns", async () => {
    await writer.query("INSERT INTO campaigns SELECT 'new-'||i,'owner-a','client-a','active','UTC','2026-11-01'::timestamp FROM generate_series(1,100) i");
    await expect(storage.getMonitorCampaigns()).rejects.toThrow("MONITOR_CAMPAIGN_LIMIT_EXCEEDED");
  });
});
