import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableColumns, getTableName, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import ts from "typescript";
import * as schema from "../shared/schema";
import { aggregateCsvSpendRows, parseCsvText } from "./utils/csv";
import { getReportingDateWindow, isCreatedThroughReportingDate } from "./utils/reporting-timezone";
import { writeFinancialDailySnapshotIfReady } from "./utils/financial-daily-snapshot-writer";
import { beginFinancialDailySnapshotRefreshObservation, recordFinancialDailySnapshotRefreshEvidence } from "./utils/financial-daily-snapshot-observation";
import { computeKpiValue } from "./ga4-kpi-benchmark-jobs";

const database = vi.hoisted(() => ({ current: null as any }));
vi.mock("./db", () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from "./storage";
const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "").trim();
if (testUrl) {
  const url = new URL(testUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1"
    || url.port !== "55444" || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) {
    throw new Error("Isolated local fixture database required");
  }
}
const schemaName = `ga4_spend_date_it_${randomUUID().replace(/-/g, "")}`;
const tables = [schema.campaigns, schema.spendSources, schema.spendRecords];
const storage = new DatabaseStorage();
const day = "2026-10-27", now = new Date("2026-10-28T09:00:00Z");
let admin: Pool, pool: Pool, created = false;
async function save(id: string | null = null, amounts = [{ date: "2026-01-01", spend: "1100.00" }], overrides: any = {}) {
  return storage.replaceCsvSpendSourceWithRecords("a", id, {
    campaignId: "a", sourceType: "csv", platformContext: "ga4", displayName: "Test_spend.csv", currency: "EUR",
    mappingConfig: JSON.stringify({ dateColumn: "date", spendColumn: "spend", campaignColumn: "Campaign", campaignValues: ["LI_B2B_SaaS_US_Q1"] }),
    createdAt: now, isActive: true, ...overrides,
  } as any, amounts.map(row => ({ ...row, campaignId: "a", currency: "EUR", sourceType: "csv" })) as any);
}
const totals = (end = day, platform: any = "ga4") => storage.getSpendTotalForRange("a", "1900-01-01", end, platform);
const breakdown = (end = day) => storage.getSpendBreakdownBySource("a", "1900-01-01", end, "ga4");
async function sourceResponse() {
  const text = readFileSync("server/routes-oauth.ts", "utf8");
  const start = text.indexOf('  app.get("/api/campaigns/:id/spend-sources",');
  const end = text.indexOf("  const getGoogleSheetsSpendDuplicateGroups", start);
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  let handler: any;
  const guard = vi.fn();
  new Function("app", "requireCampaignAccessParamId", "storage", "parseOptionalSpendPlatformContext", "getReportingDateWindow", "isCreatedThroughReportingDate",
    ts.transpileModule(text.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(
    { get: (_path: string, auth: any, fn: any) => { expect(auth).toBe(guard); handler = fn; } }, guard, storage,
    () => "ga4", (days: number, zone: string) => getReportingDateWindow(days, zone, now), isCreatedThroughReportingDate);
  const res: any = { code: 200, setHeader: vi.fn(), status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; } };
  await handler({ params: { id: "a" }, query: { platformContext: "ga4" } }, res);
  expect(res.code).toBe(200);
  return res.body;
}
describe.skipIf(!testUrl)("GA4 transaction-date Spend eligibility with real PostgreSQL", () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 2 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, max: 4 });
    database.current = drizzle(pool, { schema });
    const dialect = new PgDialect();
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map((column: any) => {
        const value = column.default;
        const defaultSql = value instanceof SQL ? dialect.sqlToQuery(value).sql : typeof value === "string" ? `'${value.replace(/'/g, "''")}'` : String(value);
        return `"${column.name}" ${column.getSQLType()}${column.notNull ? " NOT NULL" : ""}${value !== undefined ? ` DEFAULT ${defaultSql}` : ""}${column.primary ? " PRIMARY KEY" : ""}`;
      });
      await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(", ")})`);
    }
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`); await admin?.end(); });
  beforeEach(async () => {
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    await database.current.insert(schema.campaigns).values([
      { id: "a", name: "Promo fixture", ownerId: "owner-a", currency: "EUR", reportingTimeZone: "Europe/Amsterdam" },
      { id: "b", name: "Other fixture", ownerId: "owner-b", currency: "EUR", reportingTimeZone: "Europe/Amsterdam" },
    ]);
  });
  it("includes Promo's selected EUR 800 + EUR 300 January rows on the upload day", async () => {
    const parsed = parseCsvText('"date,Campaign,spend"\n"2026-01-01,LI_B2B_SaaS_US_Q1,800"\n"2026-01-01,LI_B2B_SaaS_US_Q1,300"\n"2026-01-01,yesop_brand_search,250"');
    const imported = aggregateCsvSpendRows(parsed.rows, { dateColumn: "date", spendColumn: "spend", campaignColumn: "Campaign", campaignValues: ["LI_B2B_SaaS_US_Q1"] });
    expect(imported.totalSpend).toBe(1100);
    const source = await save(null, imported.dailySpend.map(row => ({ date: row.date, spend: row.spend.toFixed(2) })));
    expect(await totals()).toEqual({ totalSpend: 1100, currency: "EUR", sourceIds: [source.id] });
    expect(await breakdown()).toEqual([{ sourceId: source.id, displayName: "Test_spend.csv", sourceType: "csv", currency: "EUR", spend: 1100 }]);
    const response = await sourceResponse();
    expect(response.completedDayEndDate).toBe(day);
    expect(response.sources[0]).toMatchObject({ id: source.id, latestTotalSpend: 1100, completedDaySpend: 1100, pendingCompletedDay: false });
  });
  it.each(["csv", "google_sheets", "ad_platforms"])("uses dates for a new %s source and excludes today/future rows", async sourceType => {
    const source = await save(null, [
      { date: "2026-01-01", spend: "1100.00" }, { date: day, spend: "25.50" },
      { date: "2026-10-28", spend: "900.00" }, { date: "2026-10-29", spend: "800.00" },
    ], { sourceType });
    // The CSV save path intentionally fixes the type to CSV; seed the other
    // materialized source families explicitly to exercise their shared reads.
    await pool.query("UPDATE spend_sources SET source_type=$1 WHERE id=$2", [sourceType, source.id]);
    await pool.query("UPDATE spend_records SET source_type=$1 WHERE spend_source_id=$2", [sourceType, source.id]);
    expect(await totals()).toEqual({ totalSpend: 1125.5, currency: "EUR", sourceIds: [source.id] });
    expect((await breakdown())[0].spend).toBe(1125.5);
    expect((await totals("2026-01-01")).totalSpend).toBe(1100);
    expect((await totals("2026-10-28")).totalSpend).toBe(2025.5);
    expect((await sourceResponse()).sources[0]).toMatchObject({ sourceType, latestTotalSpend: 2825.5, completedDaySpend: 1125.5 });
  });
  it("keeps today-only records pending without manufacturing completed spend", async () => {
    await save(null, [{ date: "2026-10-28", spend: "1100.00" }]);
    expect(await totals()).toEqual({ totalSpend: 0, currency: undefined, sourceIds: [] });
    expect(await breakdown()).toEqual([]);
    expect((await sourceResponse()).sources[0]).toMatchObject({ latestTotalSpend: 1100, completedDaySpend: 0, pendingCompletedDay: true });
  });
  it("retains valid zero provenance and does not use a campaign spend cache", async () => {
    await pool.query("UPDATE campaigns SET spend='9999' WHERE id='a'");
    const source = await save(null, [{ date: day, spend: "0.00" }]);
    expect(await totals()).toEqual({ totalSpend: 0, currency: "EUR", sourceIds: [source.id] });
    expect((await sourceResponse()).sources[0]).toMatchObject({ latestTotalSpend: 0, completedDaySpend: 0, pendingCompletedDay: false });
  });
  it("retains exact campaign, source, platform, active and currency boundaries", async () => {
    const source = await save();
    await save(null, [{ date: day, spend: "20.00" }], { platformContext: null });
    await save(null, [{ date: day, spend: "500.00" }], { platformContext: "linkedin" });
    const inactive = await save(null, [{ date: day, spend: "600.00" }]);
    await pool.query("UPDATE spend_sources SET is_active=false WHERE id=$1", [inactive.id]);
    await database.current.insert(schema.spendSources).values({ id: "other", campaignId: "b", sourceType: "csv", platformContext: "ga4", currency: "EUR" });
    await database.current.insert(schema.spendRecords).values([
      { campaignId: "b", spendSourceId: source.id, date: day, spend: "700.00", currency: "EUR" },
      { campaignId: "a", spendSourceId: "other", date: day, spend: "800.00", currency: "EUR" },
      { campaignId: "a", spendSourceId: "orphan", date: day, spend: "900.00", currency: "EUR" },
    ]);
    expect((await totals()).totalSpend).toBe(1120);
    expect((await breakdown()).reduce((sum, row) => sum + row.spend, 0)).toBe(1120);
    expect((await totals(day, "linkedin")).totalSpend).toBe(500);
    await database.current.insert(schema.spendRecords).values({ campaignId: "a", spendSourceId: source.id, date: day, spend: "10.00", currency: "USD" });
    await expect(totals()).rejects.toThrow("Spend source currencies do not match");
    await expect(breakdown()).rejects.toThrow("Spend source currencies do not match");
  });
  it("replaces only the edited source and removes only the deleted source contribution", async () => {
    const first = await save(), other = await save(null, [{ date: day, spend: "50.00" }]);
    const edited = await save(first.id, [{ date: "2026-01-01", spend: "1200.00" }]);
    expect(edited.id).toBe(first.id);
    expect((await totals()).totalSpend).toBe(1250);
    expect(await storage.deleteSpendSourceWithRecords("a", first.id, "ga4")).toBe(true);
    expect(await totals()).toEqual({ totalSpend: 50, currency: "EUR", sourceIds: [other.id] });
  });
  it("carries the same new-source spend into a ready financial snapshot and existing ratio formulas", async () => {
    await save();
    for (const stage of ["financial_sources", "ga4_daily"] as const) {
      beginFinancialDailySnapshotRefreshObservation(stage);
      recordFinancialDailySnapshotRefreshEvidence(stage, { campaignId: "a", reportingDate: day, status: "success", completedAt: now.toISOString(), failures: [] });
    }
    const spend = await totals();
    const inputs = { users: 1, sessions: 1, pageviews: 1, conversions: 100, ga4Revenue: 84149.90, importedRevenue: 250, spend: spend.totalSpend, engagementRate: 0.5 };
    const result = await writeFinancialDailySnapshotIfReady({ campaignId: "a", reportingDate: day }, {
      getCampaign: () => storage.getCampaign("a"),
      getGA4Connections: async () => [{ campaignId: "a", propertyId: "542352127", isPrimary: true, importStartDate: "2026-09-04" }],
      getGA4OverviewSnapshot: vi.fn(), getSpendSources: () => storage.getSpendSources("a", "ga4"),
      getSpendTotalForRange: () => totals(), getRevenueTotalForRange: async () => ({ totalRevenue: 250, sourceIds: ["revenue"] }),
      getCampaignMetricTotals: async () => ({ ...inputs, revenue: 84399.90, ga4Available: true, ga4RevenueAvailable: true, financialConversions: 100,
        spendAvailable: true, revenueAvailable: true, financialConversionsAvailable: true, ga4FinancialSource: "provider_to_date", revenueBySource: new Map(), spendBySource: new Map() }),
      upsertFinancialDailySnapshot: vi.fn(), now: () => now,
    } as any);
    expect(result.status).toBe("written");
    expect(result.snapshot?.inputs.spend).toEqual({ value: "1100.00", available: true, sources: ["canonical_spend_sources"] });
    expect(result.snapshot?.inputs.revenue.value).toBe("84399.90");
    expect(computeKpiValue("roas", inputs)).toBeCloseTo(84399.90 / 1100, 2);
    expect(computeKpiValue("roi", inputs)).toBeCloseTo((84399.90 - 1100) / 1100 * 100, 2);
    expect(computeKpiValue("cpa", inputs)).toBe(11);
  });
});
