import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableColumns, getTableName, SQL, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";
const database = vi.hoisted(() => ({ current: null as any }));
vi.mock("./db", () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from "./storage";
import {
  buildExecutiveSummaryDailySnapshotInput,
  buildExecutiveSummaryFinancialSourceIdentity,
  evaluateExecutiveSummaryTrajectory,
} from "./utils/executive-summary-daily-snapshot";

function revenueHistoryFixture() {
  const source = (id: string) => ({ id, campaignId: "campaign-a", isActive: true, platformContext: "ga4", currency: "EUR", sourceType: "csv", mappingConfig: { revenueColumn: "Revenue" } });
  const sources = [source("existing"), source("added")];
  const snapshot = (date: string, revenue: number, definitions: any[]) => {
    const daily = buildExecutiveSummaryDailySnapshotInput({
      campaignId: "campaign-a", currency: "EUR", ga4PropertyId: "property-a", ga4CampaignFilter: "selected",
      financialSourceIdentities: { revenue: definitions.map(buildExecutiveSummaryFinancialSourceIdentity), spend: [] },
      performanceSummary: {
        version: "performance_summary_aggregate_v3",
        currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: "2026-09-01", endDate: date, dataThroughDate: date, reportingTimeZone: "Europe/Amsterdam" },
        sources: [{ id: "ga4", category: "web_analytics", connected: true, includedMetrics: ["revenue", "sessions"] }],
        totals: { revenue: { value: revenue, available: true, sources: ["ga4", "revenue_csv"] } },
      },
    });
    return { campaignId: daily.campaignId, reportingDate: date, snapshotType: "executive_summary_daily", metrics: { executiveSummaryDaily: daily } } as any;
  };
  const current = snapshot("2026-09-15", 180, sources);
  const previous = snapshot("2026-09-08", 100, sources.slice(0, 1));
  const history: any = {
    publicationMatches: true,
    campaign: { id: "campaign-a", currency: "EUR", ga4CampaignFilter: "selected", reportingTimeZone: "Europe/Amsterdam" },
    connections: [{ campaignId: "campaign-a", propertyId: "property-a", importStartDate: "2026-09-01", isActive: true }],
    sources,
    daily: Array.from({ length: 15 }, (_, i) => ({ campaignId: "campaign-a", propertyId: "property-a", date: `2026-09-${String(i + 1).padStart(2, "0")}`, revenue: "10.00", isSimulated: false })),
    records: [
      { campaignId: "campaign-a", revenueSourceId: "existing", date: "2026-08-01", revenue: "20.00", currency: "EUR", subCampaignUrn: null },
      { campaignId: "campaign-a", revenueSourceId: "added", date: "2026-09-10", revenue: "10.00", currency: "EUR", subCampaignUrn: null },
    ],
  };
  return { current, previous, history };
}

describe("Executive Summary dated revenue comparison", () => {
  it("recovers an exact seven-day comparison using the same current source selection at both dates", () => {
    const { current, previous, history } = revenueHistoryFixture();
    const before = JSON.stringify({ current, previous, history });
    expect(evaluateExecutiveSummaryTrajectory(current, previous)).toMatchObject({ available: false, reason: "incompatible_history" });
    expect(evaluateExecutiveSummaryTrajectory(current, previous, history)).toMatchObject({ available: true, trajectory: "accelerating", trendPercentage: 80, source: "dated_revenue_history" });
    expect(JSON.stringify({ current, previous, history })).toBe(before);
  });

  it("recalculates the earlier total instead of reusing a value from an old source selection", () => {
    const { current, previous, history } = revenueHistoryFixture();
    previous.metrics.executiveSummaryDaily.totals.revenue.value = 999;
    expect(evaluateExecutiveSummaryTrajectory(current, previous, history)).toMatchObject({ available: true, trendPercentage: 80 });
  });

  it("keeps aggregate records authoritative over attributed copies, and preserves signed revenue", () => {
    const { current, previous, history } = revenueHistoryFixture();
    history.records.push({ ...history.records[0], revenue: "20.00", subCampaignUrn: "selected" });
    history.daily[0].revenue = "-10.00";
    current.metrics.executiveSummaryDaily.totals.revenue.value = 160;
    expect(evaluateExecutiveSummaryTrajectory(current, previous, history)).toMatchObject({ available: true, trendPercentage: 100 });
  });

  it("uses attributed records when no aggregate exists", () => {
    const { current, previous, history } = revenueHistoryFixture();
    history.records[0].subCampaignUrn = "selected";
    expect(evaluateExecutiveSummaryTrajectory(current, previous, history)).toMatchObject({ available: true, trendPercentage: 80 });
  });

  it.each([
    ["missing calendar date", (h: any) => h.daily.splice(2, 1)],
    ["duplicate calendar date", (h: any) => h.daily[2] = { ...h.daily[1] }],
    ["simulated data", (h: any) => h.daily[0].isSimulated = true],
    ["foreign daily property", (h: any) => h.daily[0].propertyId = "other"],
    ["foreign daily campaign", (h: any) => h.daily[0].campaignId = "other"],
    ["nonfinite revenue", (h: any) => h.daily[0].revenue = "NaN"],
    ["unreconciled current total", (h: any) => h.daily[0].revenue = "11"],
    ["unpublished imported records", (h: any) => h.publicationMatches = false],
    ["unmaterialized source", (h: any) => h.records.pop()],
    ["changed current mapping", (h: any) => h.sources[0].mappingConfig.revenueColumn = "Other"],
    ["foreign source", (h: any) => h.sources[0].campaignId = "other"],
    ["foreign record", (h: any) => h.records[0].campaignId = "other"],
    ["inactive source", (h: any) => h.sources[0].isActive = false],
    ["foreign platform", (h: any) => h.sources[0].platformContext = "linkedin"],
    ["record currency", (h: any) => h.records[0].currency = "USD"],
    ["campaign currency", (h: any) => h.campaign.currency = "USD"],
    ["campaign filter", (h: any) => h.campaign.ga4CampaignFilter = "other"],
    ["campaign timezone", (h: any) => h.campaign.reportingTimeZone = "UTC"],
    ["connection property", (h: any) => h.connections[0].propertyId = "other"],
    ["connection import start", (h: any) => h.connections[0].importStartDate = "2026-08-01"],
    ["multiple active properties", (h: any) => h.connections.push({ ...h.connections[0] })],
  ])("withholds recovery for %s", (_name, change) => {
    const { current, previous, history } = revenueHistoryFixture();
    (change as (h: any) => void)(history);
    expect(evaluateExecutiveSummaryTrajectory(current, previous, history).available).toBe(false);
  });

  it.each(["currency", "ga4PropertyId", "ga4CampaignFilter"])("does not bridge a changed historical %s", (field) => {
    const { current, previous, history } = revenueHistoryFixture();
    previous.metrics.executiveSummaryDaily[field] = field === "currency" ? "USD" : "other";
    expect(evaluateExecutiveSummaryTrajectory(current, previous, history).available).toBe(false);
  });

  it.each([0, -10])("withholds a percentage when prior revenue is %s", (prior) => {
    const { current, previous, history } = revenueHistoryFixture();
    for (const daily of history.daily.filter((d: any) => d.date <= "2026-09-08")) daily.revenue = "0";
    history.records[0].revenue = String(prior);
    current.metrics.executiveSummaryDaily.totals.revenue.value = 80 + prior;
    expect(evaluateExecutiveSummaryTrajectory(current, previous, history)).toMatchObject({ available: false, reason: "revenue_history_unavailable" });
  });

  it("still requires exactly seven days and the same import start", () => {
    const { current, previous, history } = revenueHistoryFixture();
    previous.reportingDate = "2026-09-07";
    previous.metrics.executiveSummaryDaily.currentValueWindow.endDate = "2026-09-07";
    previous.metrics.executiveSummaryDaily.currentValueWindow.dataThroughDate = "2026-09-07";
    expect(evaluateExecutiveSummaryTrajectory(current, previous, history).available).toBe(false);
    previous.reportingDate = "2026-09-08";
    previous.metrics.executiveSummaryDaily.currentValueWindow.endDate = "2026-09-08";
    previous.metrics.executiveSummaryDaily.currentValueWindow.dataThroughDate = "2026-09-08";
    previous.metrics.executiveSummaryDaily.currentValueWindow.startDate = "2026-08-01";
    expect(evaluateExecutiveSummaryTrajectory(current, previous, history).available).toBe(false);
  });

  it("recovers a comparison when only Spend identity changed", () => {
    const { current, previous, history } = revenueHistoryFixture();
    previous.metrics.executiveSummaryDaily.sourceSignature = [...current.metrics.executiveSummaryDaily.sourceSignature];
    current.metrics.executiveSummaryDaily.sourceSignature.push("spend_source:new-spend");
    expect(evaluateExecutiveSummaryTrajectory(current, previous, history)).toMatchObject({ available: true, trendPercentage: 80 });
  });
});

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || "");
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/ga4_alignment_test" || url.search || process.env.DATABASE_URL) throw Error("Isolated local database required");
}
describe.skipIf(!testUrl)("Executive comparison storage with real PostgreSQL", () => {
  const schemaName = `executive_revenue_${randomUUID().replace(/-/g, "")}`;
  const tables = [schema.campaigns, schema.ga4Connections, schema.ga4DailyMetrics, schema.revenueSources, schema.revenueRecords, schema.metricSnapshots];
  const storage = new DatabaseStorage();
  let admin: Pool, pool: Pool, created = false;
  const read = () => storage.getExecutiveSummaryDailyComparisonData("campaign-a", "2026-09-15", "2026-09-08");
  async function saved() {
    return Promise.all(tables.map(async table => (await pool.query(`SELECT * FROM "${getTableName(table)}" ORDER BY id`)).rows));
  }
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
  afterAll(async () => {
    await pool?.end();
    if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    await admin?.end();
  });
  afterEach(() => vi.restoreAllMocks());
  beforeEach(async () => {
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    const { current, previous, history } = revenueHistoryFixture();
    await database.current.insert(schema.campaigns).values({ ...history.campaign, name: "Synthetic campaign", ownerId: "owner-a" });
    await database.current.insert(schema.ga4Connections).values(history.connections.map((connection: any) => ({ ...connection, method: "access_token" })));
    await database.current.insert(schema.ga4DailyMetrics).values(history.daily);
    await database.current.insert(schema.revenueSources).values(history.sources.map((source: any) => ({ ...source, displayName: source.id, mappingConfig: JSON.stringify(source.mappingConfig) })));
    await database.current.insert(schema.revenueRecords).values(history.records);
    await database.current.insert(schema.metricSnapshots).values([current, previous]);
    const publication = await storage.getGA4RevenuePublication("campaign-a", "2026-09-15");
    await database.current.insert(schema.metricSnapshots).values({ campaignId: "campaign-a", snapshotType: "financial_daily", reportingDate: "2026-09-15", metrics: { revenuePublication: publication } });
  });
  it("recovers with a database-enforced consistent read and changes no stored rows", async () => {
    const before = await saved();
    const original = (storage as any).readGA4RevenuePublication.bind(storage);
    vi.spyOn(storage as any, "readGA4RevenuePublication").mockImplementation(async (tx: any, ...args: any[]) => {
      expect((await tx.execute(sql`SHOW transaction_read_only`)).rows[0].transaction_read_only).toBe("on");
      expect((await tx.execute(sql`SHOW transaction_isolation`)).rows[0].transaction_isolation).toBe("repeatable read");
      return original(tx, ...args);
    });
    const result = await read();
    expect(evaluateExecutiveSummaryTrajectory(result.current, result.previous, result.revenueHistory)).toMatchObject({ available: true, trendPercentage: 80 });
    expect(await saved()).toEqual(before);
  });
  it("excludes another campaign's rows, unrelated platform sources and another GA4 property", async () => {
    const record = revenueHistoryFixture().history.records[0];
    await database.current.insert(schema.revenueRecords).values({ ...record, campaignId: "other", revenue: "99999" });
    await database.current.insert(schema.revenueSources).values({ ...revenueHistoryFixture().history.sources[0], id: "other-platform", displayName: "Other", platformContext: "linkedin", mappingConfig: null });
    await database.current.insert(schema.revenueRecords).values({ ...record, revenueSourceId: "other-platform", revenue: "88888" });
    await database.current.insert(schema.ga4DailyMetrics).values({ ...revenueHistoryFixture().history.daily[0], propertyId: "other", revenue: "77777" });
    const result = await read();
    expect(evaluateExecutiveSummaryTrajectory(result.current, result.previous, result.revenueHistory)).toMatchObject({ available: true, trendPercentage: 80 });
  });
  it.each(["unpublished records", "changed mapping", "missing date", "removed source"])("withholds comparison after %s", async kind => {
    if (kind === "unpublished records") await pool.query("UPDATE revenue_records SET revenue='21.00' WHERE revenue_source_id='existing'");
    if (kind === "changed mapping") await pool.query("UPDATE revenue_sources SET mapping_config='{}' WHERE id='existing'");
    if (kind === "missing date") await pool.query("DELETE FROM ga4_daily_metrics WHERE date='2026-09-02'");
    if (kind === "removed source") await pool.query("UPDATE revenue_sources SET is_active=false WHERE id='existing'");
    const result = await read();
    expect(evaluateExecutiveSummaryTrajectory(result.current, result.previous, result.revenueHistory).available).toBe(false);
  });
  it("preserves the original unavailable comparison when an evidence read fails", async () => {
    vi.spyOn(storage as any, "readGA4RevenuePublication").mockRejectedValue(Error("synthetic read failure"));
    const result = await read();
    expect(result.revenueHistory).toBeUndefined();
    expect(evaluateExecutiveSummaryTrajectory(result.current, result.previous)).toMatchObject({ available: false, reason: "incompatible_history" });
  });
});
