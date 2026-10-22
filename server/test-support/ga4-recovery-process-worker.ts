// Isolated process fixture. Never accepts an application/remote database.
export {};
async function main() {
const testUrl = new URL(String(process.env.GA4_TEST_DATABASE_URL || ""));
const schemaName = String(process.env.GA4_TEST_SCHEMA || "");
if (testUrl.hostname !== "127.0.0.1" || testUrl.pathname !== "/ga4_alignment_test" || testUrl.search ||
    process.env.DATABASE_URL || !/^(ga4_process_it_|initial_import_)[a-f0-9]+$/.test(schemaName)) throw new Error("Unsafe process test database");
testUrl.searchParams.set("options", `-c search_path=${schemaName}`);
testUrl.searchParams.set("application_name", schemaName);
process.env.DATABASE_URL = testUrl.toString();
process.env.NODE_ENV = "test";
globalThis.fetch = async () => { throw new Error("Unexpected network request in process fixture"); };
const { storage } = await import("../storage");
const { pool } = await import("../db");
if (process.env.GA4_TEST_PAUSE_AT === 'property-slot') {
  try {
    await storage.withGA4PropertyRequest('123456', AbortSignal.timeout(20000), async signal => {
      process.send?.({ type: 'stage', stage: 'property-slot' });
      await new Promise<void>((resolve, reject) => {
        process.once('message', () => resolve());
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    });
    process.send?.({ type: 'result', status: 'released' });
  } finally { await pool!.end(); process.disconnect?.(); }
  return;
}
if (process.env.GA4_TEST_PAUSE_AT === "database") {
  try {
    const client = await pool!.connect();
    const settings = (await client.query("SELECT current_setting('statement_timeout') AS statement, current_setting('idle_in_transaction_session_timeout') AS idle")).rows[0];
    await client.query("SET statement_timeout='50ms'");
    const cancelled = await client.query("SELECT pg_sleep(2)").then(() => false, error => error.code === "57014");
    client.release(true);
    const held = await Promise.all(Array.from({ length: (pool as any).options.max }, () => pool!.connect()));
    const started = Date.now();
    const timedOut = await pool!.query("SELECT 1").then(() => false, () => true);
    const elapsed = Date.now() - started;
    held.forEach(connection => connection.release());
    await pool!.query("SELECT 1");
    process.send?.({ type: "result", status: "database", settings, cancelled, timedOut, elapsed,
      waiting: pool!.waitingCount, idle: pool!.idleCount, total: pool!.totalCount });
  } finally { await pool!.end(); process.disconnect?.(); }
  return;
}
const campaignId = String(process.env.GA4_TEST_CAMPAIGN || "a");
const date = String(process.env.GA4_TEST_REPORTING_DATE);
const dueAt = new Date(String(process.env.GA4_TEST_DUE_AT));
const checkpoint = async (stage: string) => {
  if (stage !== process.env.GA4_TEST_PAUSE_AT) return;
  const continued = new Promise<void>(resolve => process.once("message", () => resolve()));
  process.send?.({ type: "stage", stage });
  await continued;
};
try {
  const initialImport = process.env.GA4_TEST_INITIAL_IMPORT === "true";
  const pending = initialImport
    ? await storage.getGA4InitialImportWork(campaignId, `owner-${campaignId}`) || await storage.requestGA4InitialImport(campaignId, `owner-${campaignId}`, { platform: "google-analytics" })
    : await storage.ensureGA4RefreshWork(campaignId, `owner-${campaignId}`, dueAt, date);
  if (pending?.status === "completed") {
    process.send?.({ type: "result", status: "already_completed" });
  } else {
    const work = pending && await storage.claimGA4RefreshWork(campaignId, `owner-${campaignId}`, pending.id, 120_000);
    if (!work?.leaseToken) throw new Error("GA4_REFRESH_WORK_BUSY");
    const refreshScope = { campaignId, ownerId: `owner-${campaignId}`, reportingDate: date, work: { id: work.id, leaseToken: work.leaseToken } };
    const campaign = (await storage.getCampaign(campaignId))!;
    const connection = (await storage.getGA4Connections(campaignId, { migrateLegacyTokens: false }))[0];
    const previous = await storage.getGA4OverviewSnapshot(campaignId, connection.propertyId);
    await checkpoint("provider");
    const external = process.env.GA4_TEST_EXTERNAL === 'true';
    if (external) {
      const source = (await storage.getRevenueSources(campaignId, 'ga4'))[0];
      await storage.replaceRevenueSourceWithRecords(campaignId, source.id, 'csv', 'ga4',
        { ...source, mappingConfig: source.mappingConfig } as any,
        [{ campaignId, date, revenue: '25.00', currency: 'EUR' }], source.mappingConfig, { refreshScope });
      await checkpoint('external');
    }
    await storage.replaceGA4DailyMetricsWindow(campaignId, connection.propertyId, date, date, [{
      campaignId, propertyId: connection.propertyId, date, sessions: 20, users: 20, pageviews: 20,
      conversions: 2, engagedSessions: 10, revenue: "100.00", engagementRate: "0.5",
    }], {
      windowStart: date, windowEnd: date,
      campaignBreakdown: { totals: { sessions: 20, users: 20, conversions: 2, revenue: 100 }, meta: { currencyCode: "EUR" } },
      conversionEvents: { totals: { conversions: 2 } }, landingPages: { rows: [] },
      refreshScope: {
        campaign: Object.fromEntries(["ownerId", "clientId", "status", "ga4CampaignFilter", "currency", "reportingTimeZone"].map(key => [key, (campaign as any)[key] ?? null])),
        connection: Object.fromEntries(["id", "propertyId", "importStartDate", "isPrimary"].map(key => [key, (connection as any)[key] ?? null])),
        previousUpdatedAt: previous?.updatedAt?.toISOString() ?? null, work: refreshScope.work,
      },
    });
    await checkpoint("daily");
    if (initialImport) {
      if (!await storage.updateGA4RefreshWorkLease(campaignId, `owner-${campaignId}`, work.id, work.leaseToken, "complete_initial_import")) throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST");
      await checkpoint("complete");
      process.send?.({ type: "result", status: "completed" });
      return;
    }
    const notes = `auto:ga4_daily:${date};ga4_scope_v1:test`;
    const recordedAt = new Date(`${date}T23:59:59Z`);
    await storage.recordKPIProgress({ kpiId: `kpi-${campaignId}`, value: "20", notes, recordedAt, refreshScope });
    await storage.recordBenchmarkHistory({ benchmarkId: `benchmark-${campaignId}`, currentValue: "20", benchmarkValue: "100",
      variance: "-80", performanceRating: "poor", notes, recordedAt, refreshScope });
    await checkpoint("derived");
    const currentValueWindow = { mode: "initial_import_to_latest_completed_day" as const, startDate: date, endDate: date,
      dataThroughDate: date, reportingTimeZone: "Europe/Amsterdam" };
    await storage.upsertFinancialDailySnapshot({ campaignId, reportingDate: date, version: "financial_daily_snapshot_v1", currency: "EUR",
      currentValueWindow, inputs: { revenue: { value: external ? "125" : "100", available: true, sources: external ? ["ga4", "csv"] : ["ga4"] },
        spend: { value: null, available: false, sources: [] }, conversions: { value: 2, available: true, sources: ["ga4"] } }, refreshScope });
    await checkpoint("financial");
    await storage.createMetricSnapshot({ campaignId, snapshotType: "platform_sync", totalConversions: 2, refreshScope });
    await checkpoint("aggregate");
    await storage.upsertExecutiveSummaryDailySnapshot({ version: "executive_summary_daily_snapshot_v2", campaignId, reportingDate: date,
      currency: "EUR", ga4PropertyId: connection.propertyId, ga4CampaignFilter: "sale", performanceSummaryVersion: "performance_summary_aggregate_v3",
      sourceSignature: ["ga4"], currentValueWindow, totals: Object.fromEntries(
        ["users", "sessions", "conversions", "revenue", "spend", "cvr", "cpa", "roas", "roi"].map(name => [name,
          ["spend", "cpa", "roas", "roi"].includes(name) ? { value: null, available: false, sources: [] }
            : { value: name === "revenue" ? (external ? 125 : 100) : name === "conversions" ? 2 : 20, available: true, sources: ["ga4"] }])) as any, refreshScope });
    await checkpoint("executive");
    const { checkGA4PerformanceAlertsForCampaign } = await import("../kpi-scheduler");
    const { checkGA4BenchmarkPerformanceAlertsForCampaign } = await import("../benchmark-notifications");
    await checkGA4PerformanceAlertsForCampaign(campaignId, date, { refreshScope });
    await checkGA4BenchmarkPerformanceAlertsForCampaign(campaignId, date, { refreshScope });
    await checkpoint("alerts");
    const completed = await storage.updateGA4RefreshWorkLease(campaignId, `owner-${campaignId}`, work.id, work.leaseToken,
      "complete", 120_000, new Date().toISOString());
    if (!completed) throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    await checkpoint("complete");
    process.send?.({ type: "result", status: "completed" });
  }
} catch (error: any) {
  process.send?.({ type: "result", status: "failed", error: String(error?.message || error) });
  process.exitCode = 1;
} finally {
  await pool?.end();
  process.disconnect?.();
}
}
void main().catch(error => { console.error(error); process.exitCode = 1; process.disconnect?.(); });
