import express from "express";
import { getAuth } from "@clerk/express";
import { PgDialect } from "drizzle-orm/pg-core";
import pg from "pg";
import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ getCampaign: vi.fn(), getGA4Connection: vi.fn(), getGA4Connections: vi.fn(), getGA4DailyMetrics: vi.fn(), getLinkedInConnection: vi.fn(), getMetaConnection: vi.fn(), getGoogleAdsConnection: vi.fn(), getCustomIntegration: vi.fn(), getRevenueTotalForRange: vi.fn(), getSpendTotalForRange: vi.fn(), getLatestCustomIntegrationMetrics: vi.fn() }));
const execute = vi.hoisted(() => vi.fn());
vi.mock("./storage", () => ({ storage }));
vi.mock("./db", () => ({ db: { execute }, pool: null }));
vi.mock("./analytics", () => ({ ga4Service: {} }));
vi.mock("@clerk/express", () => ({ getAuth: vi.fn(() => ({ userId: "owner" })) }));
vi.mock("./middleware/rateLimiter", () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return { oauthRateLimiter: pass, linkedInApiRateLimiter: pass, googleSheetsRateLimiter: pass, ga4RateLimiter: pass, importRateLimiter: pass };
});
import { registerRoutes } from "./routes-oauth";

let server: any;
let url: string;
const campaign = { id: "c", ownerId: "owner", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: '["A"]' };
const connection = { campaignId: "c", propertyId: "123456", isPrimary: true, method: "access_token", importStartDate: "2026-10-01", isActive: true };
const date = "2026-10-23";
const rows = [{ date, sessions: 100, users: 90, pageviews: 100, conversions: 10, revenue: "200", engagedSessions: 50, engagementRate: 0.5, updatedAt: new Date("2026-10-24T12:00:00Z") }];
const dialect = new PgDialect();
beforeAll(async () => {
  const app = express(); app.use(express.json()); server = await registerRoutes(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); url = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-24T14:00:00Z"));
  for (const mock of Object.values(storage)) mock.mockReset(); execute.mockReset();
  vi.mocked(getAuth).mockReturnValue({ userId: "owner" } as any);
  storage.getCampaign.mockResolvedValue(campaign);
  storage.getGA4Connection.mockResolvedValue(connection); storage.getGA4Connections.mockResolvedValue([connection]);
  storage.getGA4DailyMetrics.mockResolvedValue(rows);
  for (const mock of [storage.getLinkedInConnection, storage.getMetaConnection, storage.getGoogleAdsConnection, storage.getCustomIntegration, storage.getLatestCustomIntegrationMetrics]) mock.mockResolvedValue(undefined);
  storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 100, currency: "EUR", sourceIds: ["spend"] });
  storage.getRevenueTotalForRange.mockImplementation(async (_id, _start, _end, context) => context === "google_ads" ? { totalRevenue: 0, sourceIds: [] } : { totalRevenue: 50, currency: "EUR", sourceIds: ["revenue"] });
  execute.mockImplementation(async query => dialect.sqlToQuery(query).sql.includes("'spend' as kind") ? { rows: [{ date, kind: "spend", source_id: "spend", value: 100, aggregate: true }, { date, kind: "revenue", source_id: "revenue", value: 50, aggregate: true }, { date, kind: "revenue", source_id: "revenue", value: 50, aggregate: false }] } : { rows: [] });
});
afterEach(() => vi.useRealTimers());
afterAll(async () => { server.closeAllConnections?.(); await new Promise<void>((resolve, reject) => server.close((error: any) => error ? reject(error) : resolve())); });

describe("V1-077 actual GA4 daily HTTP boundary", () => {
  const request = () => fetch(`${url}/api/campaigns/c/ga4-daily?propertyId=123456&days=60&readOnly=true`);
  it("propagates failed recent-history reads instead of a successful empty response", async () => {
    storage.getGA4DailyMetrics.mockRejectedValueOnce(new Error("daily read failed")).mockResolvedValue(rows);
    const response = await request(); expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false });
  });
  it("keeps a successful empty history distinct from explicit zero facts", async () => {
    storage.getGA4DailyMetrics.mockResolvedValue([]);
    let response = await request(); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: [], schedulerCoverageComplete: false });
    storage.getGA4DailyMetrics.mockResolvedValue([{ ...rows[0], sessions: 0, users: 0, conversions: 0, revenue: "0", pageviews: 0, engagedSessions: 0 }]);
    response = await request(); const body = await response.json();
    expect(body.data).toHaveLength(1); expect(body.data[0].sessions).toBe(0);
    expect(storage.getGA4DailyMetrics).toHaveBeenCalledWith("c", "123456", expect.any(String), "2026-10-23");
  });
  it("rejects a different owner before any source read", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: "other" } as any);
    expect((await request()).status).toBe(404); expect(storage.getGA4DailyMetrics).not.toHaveBeenCalled();
  });
});
describe("V1-056 actual retained Trend HTTP financial boundary", () => {
  const request = () => fetch(`${url}/api/campaigns/c/trend-analysis?dateRange=7days&days=7`);
  it("uses eligible canonical IDs and counts aggregate revenue once plus native GA4", async () => {
    const response = await request(); expect(response.status).toBe(200); const body = await response.json();
    expect(body.trendAnalysis.dailyTotals[0].metrics).toMatchObject({ spend: 100, revenue: 250, conversions: 10, cvr: 10 });
    expect(storage.getSpendTotalForRange).toHaveBeenCalledWith("c", "2026-10-17", date, "ga4");
    expect(storage.getRevenueTotalForRange).toHaveBeenCalledWith("c", "2026-10-17", date, "ga4");
    const query = execute.mock.calls.map(([q]) => dialect.sqlToQuery(q)).find(q => q.sql.includes("'spend' as kind"))!;
    expect(query.params).toContain("spend"); expect(query.params).toContain("revenue");
    expect(query.sql).toContain("ANY(ARRAY[");
    expect(query.sql).toContain("sr.campaign_id ="); expect(query.sql).toContain("rr.campaign_id =");
  });
  it.each(["currency", "read-failed", "changed-during-read"])("fails closed when financial inputs are %s", async failure => {
    if (failure === "currency") storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 100, currency: "USD", sourceIds: ["spend"] });
    if (failure === "read-failed") storage.getSpendTotalForRange.mockRejectedValue(new Error("failed"));
    if (failure === "changed-during-read") execute.mockResolvedValue({ rows: [] });
    expect((await request()).status).toBe(500);
  });
  it("preserves aggregate zero instead of falling back to subcampaign revenue", async () => {
    storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, currency: "EUR", sourceIds: ["revenue"] });
    execute.mockImplementation(async query => dialect.sqlToQuery(query).sql.includes("'spend' as kind") ? { rows: [{ date, kind: "spend", source_id: "spend", value: 100, aggregate: true }, { date, kind: "revenue", source_id: "revenue", value: 0, aggregate: true }, { date, kind: "revenue", source_id: "revenue", value: 50, aggregate: false }] } : { rows: [] });
    const response = await request(); expect(response.status).toBe(200);
    expect((await response.json()).trendAnalysis.dailyTotals[0].metrics.revenue).toBe(200);
  });
  it("rejects an unrelated campaign owner before querying financial data", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: "other" } as any);
    expect((await request()).status).toBe(404); expect(execute).not.toHaveBeenCalled();
  });
});

describe("V1-056 actual PostgreSQL financial query", () => {
  let client: pg.Client;
  beforeAll(async () => {
    const database = process.env.GA4_TEST_DATABASE_URL;
    if (!database || !/^postgresql:\/\/v1_audit@127\.0\.0\.1:55444\//.test(database)) throw new Error("Disposable loopback audit database required");
    client = new pg.Client({ connectionString: database, application_name: "v1_batch7_metrics" });
    await client.connect();
    // Session-local tables are dropped when this owned connection closes.
    await client.query("CREATE TEMP TABLE spend_records (campaign_id text, spend_source_id text, date text, spend numeric)");
    await client.query("CREATE TEMP TABLE revenue_records (campaign_id text, revenue_source_id text, date text, revenue numeric, sub_campaign_urn text)");
  });
  afterAll(async () => { await client?.end(); });
  it.each([0, 50])("executes canonical source selection and aggregate precedence with revenue %s", async revenue => {
    await client.query("TRUNCATE pg_temp.spend_records, pg_temp.revenue_records");
    await client.query("INSERT INTO pg_temp.spend_records VALUES ('c','spend','2026-10-23',100),('other','spend','2026-10-23',900),('c','other-source','2026-10-23',900),('c','spend','2026-10-24',900)");
    await client.query("INSERT INTO pg_temp.revenue_records VALUES ('c','revenue','2026-10-23',$1,NULL),('c','revenue','2026-10-23',999,'sub'),('other','revenue','2026-10-23',999,NULL),('c','other-source','2026-10-23',999,NULL),('c','revenue','2026-10-24',999,NULL)", [revenue]);
    storage.getRevenueTotalForRange.mockImplementation(async (_id, _start, _end, context) => context === "google_ads" ? { totalRevenue: 0, sourceIds: [] } : { totalRevenue: revenue, currency: "EUR", sourceIds: ["revenue"] });
    execute.mockImplementation(async query => {
      const compiled = dialect.sqlToQuery(query);
      return compiled.sql.includes("'spend' as kind") ? client.query(compiled.sql, compiled.params) : { rows: [] };
    });
    const response = await fetch(`${url}/api/campaigns/c/trend-analysis?days=7`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.trendAnalysis.dailyTotals).toHaveLength(1);
    expect(body.trendAnalysis.dailyTotals[0].metrics).toMatchObject({ spend: 100, revenue: 200 + revenue });
  });
  it("executes empty source-ID arrays without admitting unrelated records", async () => {
    storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: [] });
    storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 0, sourceIds: [] });
    execute.mockImplementation(async query => {
      const compiled = dialect.sqlToQuery(query);
      return compiled.sql.includes("'spend' as kind") ? client.query(compiled.sql, compiled.params) : { rows: [] };
    });
    const response = await fetch(`${url}/api/campaigns/c/trend-analysis?days=7`);
    expect(response.status).toBe(200);
    expect((await response.json()).trendAnalysis.dailyTotals[0].metrics.revenue).toBe(200);
  });
});
