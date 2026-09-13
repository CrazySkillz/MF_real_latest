import { createHash } from "node:crypto";
import { chromium, type APIResponse, type Browser, type BrowserContext, type Page } from "playwright";
import { PDFParse } from "pdf-parse";
import { pool } from "../server/db";
import { storage } from "../server/storage";
import { getReportingDateWindow } from "../server/utils/reporting-timezone";

const BASE_URL = String(process.env.GA4_OVERVIEW_BASE_URL || "https://marketforensics.onrender.com").replace(/\/$/, "");
const EXPECTED_SHA = String(process.env.GA4_OVERVIEW_SPEND_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.GA4_OVERVIEW_SPEND_CAMPAIGN_ID || "").trim();
const CLERK_SECRET = String(process.env.CLERK_SECRET_KEY || "").trim();
const CONFIRMED = String(process.env.GA4_OVERVIEW_SPEND_DOWNSTREAM_CONFIRM || "").trim().toLowerCase() === "true";

if (!pool) throw new Error("DATABASE_URL is required");
if (!CLERK_SECRET) throw new Error("CLERK_SECRET_KEY is required");
if (!/^[0-9a-f-]{36}$/i.test(CAMPAIGN_ID)) throw new Error("GA4_OVERVIEW_SPEND_CAMPAIGN_ID must be an explicit campaign UUID");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("GA4_OVERVIEW_SPEND_EXPECTED_SHA must be the exact deployed SHA");
if (!CONFIRMED) throw new Error("GA4_OVERVIEW_SPEND_DOWNSTREAM_CONFIRM=true is required for this authorized production mutation");

type Result = { ok: boolean; status: number; body: any };

const hash = (value: unknown) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
const money = (value: unknown) => Number(Number(value || 0).toFixed(2));
const parseJson = (value: unknown): any => {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try { return JSON.parse(value); } catch { return {}; }
};
const stable = (value: any): any => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const stableJson = (value: unknown) => JSON.stringify(stable(value));
const stableProtectedRows = (kind: "revenue_sources" | "revenue_records" | "ga4_daily", rows: any[]) => {
  const normalized = rows.map((raw) => {
    const row = { ...raw };
    delete row.updated_at;
    if (kind === "revenue_records") {
      delete row.id;
      delete row.created_at;
    }
    if (kind === "revenue_sources") {
      const mapping = parseJson(row.mapping_config);
      delete mapping.lastSyncedAt;
      row.mapping_config = mapping;
    }
    return row;
  });
  return normalized.sort((a, b) => stableJson(a).localeCompare(stableJson(b)));
};
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const responseResult = async (response: APIResponse): Promise<Result> => {
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: response.ok(), status: response.status(), body };
};
const normalizedText = (value: unknown) => String(value ?? "").replace(/,/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const pdfText = async (data: Buffer) => {
  const parser = new PDFParse({ data: new Uint8Array(data) });
  try { return (await parser.getText()).text; } finally { await parser.destroy(); }
};
const hasNumber = (text: string, value: number) => [String(value), value.toFixed(1), value.toFixed(2)]
  .some((candidate) => text.includes(candidate.toLowerCase()));
const parseNumber = (value: unknown) => {
  const parsed = Number(String(value ?? "").trim().replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const isDateLike = (value: unknown) => {
  const raw = String(value ?? "").trim();
  return Boolean(raw && !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw) && !Number.isNaN(new Date(raw).getTime()));
};
const clerkPost = async (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${CLERK_SECRET}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const dbClient = await pool.connect();
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let sessionId = "";
let signInTokenId = "";
let ownerId = "";
let runTag = `spend-downstream-cert-${Date.now()}`;
const fixtureSuffix = hash(runTag);
const kpiName = `Spend CPA ${fixtureSuffix}`;
const benchmarkName = `Spend BM ${fixtureSuffix}`;
const reportName = `Spend Report ${fixtureSuffix}`;
let connectionId = "";
let originalSpreadsheetId = "";
let connectionTemporarilyBroken = false;
let sheetSourceId = "";
let csvSourceId = "";
let kpiId = "";
let benchmarkId = "";
let reportId = "";
const snapshotIds = new Set<string>();

const token = async () => {
  const value = await page?.evaluate(() => (window as any).Clerk?.session?.getToken());
  assert(value, "Clerk session token is unavailable");
  return String(value);
};
const request = async (method: string, path: string, body?: unknown): Promise<Result> => {
  assert(context, "Authenticated request context is unavailable");
  return responseResult(await context!.request.fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { data: body }),
    failOnStatusCode: false,
    timeout: 120_000,
  }));
};
const get = (path: string) => request("GET", path);
const post = (path: string, body?: unknown) => request("POST", path, body);
const patch = (path: string, body: unknown) => request("PATCH", path, body);
const del = (path: string) => request("DELETE", path);
const csvProcess = async (mapping: any, file?: { name: string; text: string }): Promise<Result> => {
  assert(context, "Authenticated request context is unavailable");
  const multipart: Record<string, any> = { platformContext: "ga4", mapping: JSON.stringify(mapping) };
  if (file) multipart.file = { name: file.name, mimeType: "text/csv", buffer: Buffer.from(file.text, "utf8") };
  return responseResult(await context!.request.post(`${BASE_URL}/api/campaigns/${CAMPAIGN_ID}/spend/csv/process`, {
    headers: { Authorization: `Bearer ${await token()}` },
    multipart,
    failOnStatusCode: false,
    timeout: 120_000,
  }));
};

const sourceState = async (sourceId: string) => {
  const [source, records] = await Promise.all([
    dbClient.query(`
      SELECT id::text, source_type, platform_context, display_name, currency, mapping_config, is_active
      FROM spend_sources WHERE campaign_id = $1 AND id::text = $2
    `, [CAMPAIGN_ID, sourceId]),
    dbClient.query(`
      SELECT date, spend::text, currency, source_type
      FROM spend_records WHERE campaign_id = $1 AND spend_source_id = $2 ORDER BY date, id
    `, [CAMPAIGN_ID, sourceId]),
  ]);
  const row = source.rows[0];
  if (!row) return null;
  return { ...row, records: records.rows, total: money(records.rows.reduce((sum, record) => sum + Number(record.spend || 0), 0)) };
};
const sourceWithoutSync = (source: any) => {
  if (!source) return null;
  const mapping = parseJson(source.mapping_config);
  delete mapping.lastSyncedAt;
  return { ...source, mapping_config: mapping };
};
const endpointSpend = async () => {
  const [sources, total, breakdown, daily] = await Promise.all([
    get(`/api/campaigns/${CAMPAIGN_ID}/spend-sources?platformContext=ga4`),
    get(`/api/campaigns/${CAMPAIGN_ID}/spend-to-date?platformContext=ga4`),
    get(`/api/campaigns/${CAMPAIGN_ID}/spend-breakdown?platformContext=ga4`),
    get(`/api/campaigns/${CAMPAIGN_ID}/daily-financials?start=1900-01-01&end=2999-12-31`),
  ]);
  const sourceRows = Array.isArray(sources.body) ? sources.body : sources.body?.sources || [];
  const breakdownRows = Array.isArray(breakdown.body) ? breakdown.body : breakdown.body?.sources || breakdown.body?.data || [];
  const dailyRows = Array.isArray(daily.body) ? daily.body : daily.body?.data || daily.body?.rows || [];
  return {
    ok: [sources, total, breakdown, daily].every((result) => result.ok),
    sourceIds: sourceRows.map((row: any) => String(row?.id || row?.sourceId || "")).filter(Boolean).sort(),
    breakdownIds: breakdownRows.map((row: any) => String(row?.sourceId || row?.id || "")).filter(Boolean).sort(),
    total: money(total.body?.spendToDate),
    breakdownTotal: money(breakdown.body?.totalSpend),
    dailyTotal: money(dailyRows.reduce((sum: number, row: any) => sum + Number(row?.spend || 0), 0)),
  };
};
const dependentValues = async () => {
  const [kpis, benchmarks] = await Promise.all([
    get(`/api/platforms/google_analytics/kpis?campaignId=${CAMPAIGN_ID}`),
    get(`/api/platforms/google_analytics/benchmarks?campaignId=${CAMPAIGN_ID}`),
  ]);
  const kpi = (Array.isArray(kpis.body) ? kpis.body : []).find((row: any) => String(row?.id) === kpiId);
  const benchmark = (Array.isArray(benchmarks.body) ? benchmarks.body : []).find((row: any) => String(row?.id) === benchmarkId);
  return { kpis, benchmarks, kpi, benchmark, kpiValue: money(kpi?.currentValue), benchmarkValue: money(benchmark?.currentValue) };
};

try {
  const campaignResult = await dbClient.query(`
    SELECT id::text, name, owner_id, client_id, currency, reporting_time_zone, spend
    FROM campaigns WHERE id = $1
  `, [CAMPAIGN_ID]);
  assert(campaignResult.rowCount === 1, "Campaign2 was not found");
  const campaign = campaignResult.rows[0];
  ownerId = String(campaign.owner_id || "");
  const completedEndDate = getReportingDateWindow(1, campaign.reporting_time_zone).endDate;
  const campaignCurrency = String(campaign.currency || "USD").trim().toUpperCase();

  const [baselineCountsResult, baselineConnectionsResult, baselineRevenueSourcesResult, baselineRevenueRecordsResult, baselineGa4DailyResult, ga4ConnectionResult] = await Promise.all([
    dbClient.query(`
      SELECT
        (SELECT count(*) FROM spend_sources WHERE campaign_id = $1)::int AS sources,
        (SELECT count(*) FROM spend_records WHERE campaign_id = $1)::int AS records,
        (SELECT count(*) FROM kpis WHERE campaign_id = $1)::int AS kpis,
        (SELECT count(*) FROM kpi_progress p JOIN kpis k ON k.id::text = p.kpi_id WHERE k.campaign_id = $1)::int AS kpi_progress,
        (SELECT count(*) FROM kpi_alerts a JOIN kpis k ON k.id::text = a.kpi_id WHERE k.campaign_id = $1)::int AS kpi_alerts,
        (SELECT count(*) FROM benchmarks WHERE campaign_id = $1)::int AS benchmarks,
        (SELECT count(*) FROM benchmark_history h JOIN benchmarks b ON b.id::text = h.benchmark_id WHERE b.campaign_id = $1)::int AS benchmark_history,
        (SELECT count(*) FROM linkedin_reports WHERE campaign_id = $1)::int AS reports,
        (SELECT count(*) FROM report_snapshots WHERE campaign_id = $1)::int AS snapshots,
        (SELECT count(*) FROM report_send_events e JOIN linkedin_reports r ON r.id::text = e.report_id WHERE r.campaign_id = $1)::int AS send_events,
        (SELECT count(*) FROM notifications WHERE campaign_id = $1)::int AS notifications,
        (SELECT count(*) FROM ga4_daily_metrics WHERE campaign_id = $1 AND date = $2)::int AS completed_day_rows
    `, [CAMPAIGN_ID, completedEndDate]),
    dbClient.query(`
      SELECT id::text, spreadsheet_id, purpose, spreadsheet_name, sheet_name, is_active, is_primary
      FROM google_sheets_connections WHERE campaign_id = $1 AND spreadsheet_id <> 'pending' ORDER BY id
    `, [CAMPAIGN_ID]),
    dbClient.query(`SELECT * FROM revenue_sources WHERE campaign_id = $1 ORDER BY id`, [CAMPAIGN_ID]),
    dbClient.query(`SELECT * FROM revenue_records WHERE campaign_id = $1 ORDER BY id`, [CAMPAIGN_ID]),
    dbClient.query(`SELECT * FROM ga4_daily_metrics WHERE campaign_id = $1 ORDER BY property_id, date`, [CAMPAIGN_ID]),
    dbClient.query(`
      SELECT id::text, property_id, import_start_date, lookback_days, is_primary, is_active
      FROM ga4_connections WHERE campaign_id = $1 AND is_active = true ORDER BY is_primary DESC, created_at
    `, [CAMPAIGN_ID]),
  ]);
  const baselineCounts = baselineCountsResult.rows[0];
  const baselineConnections = baselineConnectionsResult.rows;
  const ga4Connection = ga4ConnectionResult.rows[0];
  assert(campaign.name === "Campaign2", "The authorized campaign name no longer matches Campaign2");
  assert(Number(campaign.spend || 0) === 0, "Campaign2 Spend baseline is no longer zero");
  assert(["sources", "records", "kpis", "kpi_progress", "kpi_alerts", "benchmarks", "benchmark_history", "reports", "snapshots", "send_events", "notifications"]
    .every((key) => Number(baselineCounts[key] || 0) === 0), "Campaign2 is no longer an empty isolated downstream boundary");
  assert(Number(baselineCounts.completed_day_rows || 0) === 1, "Campaign2 completed-day GA4 row is unavailable; refusing a recompute that could backfill protected data");
  assert(ga4Connection?.property_id && ga4Connection?.import_start_date, "Campaign2 active GA4 import boundary is unavailable");

  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json().catch(() => ({}));
  assert(healthResponse.ok && health?.commit === EXPECTED_SHA, `Expected deployed SHA ${EXPECTED_SHA}, received ${String(health?.commit || "unknown")}`);

  const signIn = await clerkPost("/sign_in_tokens", { user_id: ownerId, expires_in_seconds: 2400 });
  const signInBody: any = await signIn.json().catch(() => ({}));
  assert(signIn.ok && signInBody?.token, `Clerk sign-in token failed (${signIn.status})`);
  signInTokenId = String(signInBody.id || "");
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  page = await context.newPage();
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(signInBody.token))}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60_000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ""));

  const checks: Record<string, boolean> = {};
  const failures: string[] = [];
  const observations: Record<string, any> = {};
  const check = (name: string, condition: unknown, detail?: unknown) => {
    checks[name] = condition === true;
    if (condition !== true) failures.push(detail === undefined ? name : `${name}: ${stableJson(detail)}`);
  };

  try {
    const viableConnections: Array<{ id: string; spreadsheetId: string; sheetName: string; preview: any }> = [];
    for (const connection of baselineConnections.filter((row) => row.is_active)) {
      const preview = await post(`/api/campaigns/${CAMPAIGN_ID}/spend/sheets/preview`, { connectionId: connection.id });
      const headers = Array.isArray(preview.body?.headers) ? preview.body.headers.map(String) : [];
      const rows = Array.isArray(preview.body?.sampleRows) ? preview.body.sampleRows : [];
      if (preview.ok && headers.includes("Spend") && headers.includes("Date") && headers.includes("Campaign ID") && rows.length > 0) {
        viableConnections.push({ id: connection.id, spreadsheetId: connection.spreadsheet_id, sheetName: connection.sheet_name, preview: preview.body });
      }
    }
    assert(viableConnections.length > 0, "No exact Spend/Date/Campaign ID provider fixture is available");
    const provider = viableConnections[0];

    const connectionCreated = await post("/api/google-sheets/select-spreadsheet-multiple", {
      campaignId: CAMPAIGN_ID,
      spreadsheetId: provider.spreadsheetId,
      sheetNames: [provider.sheetName],
      selectionMode: "append",
      purpose: "spend",
    });
    connectionId = String(connectionCreated.body?.connectionIds?.[0] || connectionCreated.body?.connectionId || "");
    assert(connectionCreated.ok && connectionId && !baselineConnections.some((row) => String(row.id) === connectionId), "Dedicated Spend connection creation failed");
    const dedicatedConnection = await dbClient.query(`
      SELECT spreadsheet_id FROM google_sheets_connections
      WHERE id::text = $1 AND campaign_id = $2 AND purpose = 'spend' AND is_active = true
    `, [connectionId, CAMPAIGN_ID]);
    originalSpreadsheetId = String(dedicatedConnection.rows[0]?.spreadsheet_id || "");
    assert(originalSpreadsheetId === provider.spreadsheetId, "Dedicated Spend connection boundary mismatch");

    const dedicatedPreview = await post(`/api/campaigns/${CAMPAIGN_ID}/spend/sheets/preview`, { connectionId });
    const sheetRows = Array.isArray(dedicatedPreview.body?.sampleRows) ? dedicatedPreview.body.sampleRows : [];
    const grouped = new Map<string, { total: number; dates: string[] }>();
    for (const row of sheetRows) {
      const campaignValue = String(row?.["Campaign ID"] ?? "").trim();
      const spend = Number(parseNumber(row?.Spend));
      const rawDate = String(row?.Date ?? "").trim();
      if (!campaignValue || !(spend > 0) || !isDateLike(rawDate) || rawDate > completedEndDate) continue;
      const current = grouped.get(campaignValue) || { total: 0, dates: [] };
      current.total += spend;
      current.dates.push(rawDate);
      grouped.set(campaignValue, current);
    }
    const groups = [...grouped.entries()].map(([value, group]) => ({ value, total: money(group.total), recordCount: new Set(group.dates).size }));
    assert(groups.length >= 2, "At least two different provider campaign values are required for an exact automatic delta");
    const baseGroup = [...groups].sort((a, b) => a.total - b.total)[0];
    const alternateGroup = [...groups].sort((a, b) => Math.abs(b.total - baseGroup.total) - Math.abs(a.total - baseGroup.total))[0];
    assert(baseGroup.total > 0 && alternateGroup.total > 0 && baseGroup.total !== alternateGroup.total, "Provider campaign values do not expose a non-zero Spend delta");

    const sheetMapping = {
      spendColumn: "Spend",
      dateColumn: "Date",
      campaignColumn: "Campaign ID",
      campaignValues: [baseGroup.value],
      currency: campaignCurrency,
      displayName: `${runTag}-sheets`,
      platformContext: "ga4",
    };
    const sheetCreated = await post(`/api/campaigns/${CAMPAIGN_ID}/spend/sheets/process`, { connectionId, mapping: sheetMapping, platformContext: "ga4" });
    sheetSourceId = String(sheetCreated.body?.sourceId || "");
    const initialSheetState = await sourceState(sheetSourceId);
    check("sheetFixtureCreated", sheetCreated.ok && initialSheetState?.total === baseGroup.total && initialSheetState?.records.length === baseGroup.recordCount, { status: sheetCreated.status, total: initialSheetState?.total });
    assert(checks.sheetFixtureCreated, "Temporary Google Sheets source creation failed");

    const csvFile = {
      name: `${runTag}-csv.csv`,
      text: "Date,Spend,Campaign\n2026-09-01,8,TARGET\n2026-09-02,5,TARGET",
    };
    const csvMapping = {
      spendColumn: "Spend",
      dateColumn: "Date",
      campaignColumn: "Campaign",
      campaignValues: ["TARGET"],
      currency: campaignCurrency,
      displayName: csvFile.name,
      platformContext: "ga4",
    };
    const csvCreated = await csvProcess(csvMapping, csvFile);
    csvSourceId = String(csvCreated.body?.sourceId || "");
    const initialCsvState = await sourceState(csvSourceId);
    check("csvFixtureCreated", csvCreated.ok && initialCsvState?.total === 13 && initialCsvState?.records.length === 2, { status: csvCreated.status, total: initialCsvState?.total });
    assert(checks.csvFixtureCreated, "Temporary CSV source creation failed");

    const initialTotal = money(baseGroup.total + 13);
    const initialSpendEndpoints = await endpointSpend();
    check("initialSpendReconciled", initialSpendEndpoints.ok && initialSpendEndpoints.sourceIds.length === 2
      && stableJson(initialSpendEndpoints.sourceIds) === stableJson(initialSpendEndpoints.breakdownIds)
      && initialSpendEndpoints.total === initialTotal && initialSpendEndpoints.breakdownTotal === initialTotal
      && initialSpendEndpoints.dailyTotal === initialTotal, initialSpendEndpoints);

    const beforeFailureSource = sourceWithoutSync(await sourceState(sheetSourceId));
    const beforeFailureSpend = await endpointSpend();
    const brokenSpreadsheetId = `spend-cert-missing-${Date.now()}`;
    const broken = await dbClient.query(`
      UPDATE google_sheets_connections SET spreadsheet_id = $1
      WHERE id::text = $2 AND campaign_id = $3 AND purpose = 'spend' AND is_active = true AND spreadsheet_id = $4
    `, [brokenSpreadsheetId, connectionId, CAMPAIGN_ID, originalSpreadsheetId]);
    assert(broken.rowCount === 1, "Guarded provider-failure injection did not change exactly one temporary connection");
    connectionTemporarilyBroken = true;
    const failedRefresh = await post(`/api/campaigns/${CAMPAIGN_ID}/spend-sources/${sheetSourceId}/google-sheets-refresh/run-now`);
    const afterFailureSource = sourceWithoutSync(await sourceState(sheetSourceId));
    const afterFailureSpend = await endpointSpend();
    check("providerTransportFailurePreservesLastGood", failedRefresh.status === 502
      && failedRefresh.body?.result?.reason === "reprocess_failed"
      && stableJson(afterFailureSource) === stableJson(beforeFailureSource)
      && stableJson(afterFailureSpend) === stableJson(beforeFailureSpend), { status: failedRefresh.status, reason: failedRefresh.body?.result?.reason });
    const restoredConnection = await dbClient.query(`
      UPDATE google_sheets_connections SET spreadsheet_id = $1
      WHERE id::text = $2 AND campaign_id = $3 AND purpose = 'spend' AND spreadsheet_id = $4
    `, [originalSpreadsheetId, connectionId, CAMPAIGN_ID, brokenSpreadsheetId]);
    assert(restoredConnection.rowCount === 1, "Guarded temporary connection restoration did not change exactly one row");
    connectionTemporarilyBroken = false;
    const recoveredRefresh = await post(`/api/campaigns/${CAMPAIGN_ID}/spend-sources/${sheetSourceId}/google-sheets-refresh/run-now`);
    check("providerTransportRecovered", recoveredRefresh.ok && recoveredRefresh.body?.result?.success === true && (await sourceState(sheetSourceId))?.total === baseGroup.total, { status: recoveredRefresh.status, body: recoveredRefresh.body?.result });

    const ga4Totals = await get(`/api/campaigns/${CAMPAIGN_ID}/ga4-to-date?propertyId=${encodeURIComponent(String(ga4Connection.property_id))}&endDate=${completedEndDate}&readOnly=1`);
    const financialConversions = Math.round(Number(ga4Totals.body?.totals?.conversions || 0));
    check("ga4FinancialDenominatorAvailable", ga4Totals.ok && financialConversions > 0, { status: ga4Totals.status, conversions: financialConversions });
    assert(checks.ga4FinancialDenominatorAvailable, "GA4 financial conversion denominator is unavailable");

    const kpi = await storage.createKPI({
      campaignId: CAMPAIGN_ID,
      platformType: "google_analytics",
      category: "performance",
      name: kpiName,
      metric: "cpa",
      targetValue: "999999",
      currentValue: "0",
      unit: "$",
      description: "Temporary authorized Spend propagation fixture",
      priority: "medium",
      status: "tracking",
      timeframe: "monthly",
      trackingPeriod: 30,
      rollingAverage: "7day",
      alertsEnabled: false,
      emailNotifications: false,
      slackNotifications: false,
      alertFrequency: "daily",
      applyTo: "all",
    } as any);
    kpiId = String(kpi.id || "");
    const benchmark = await storage.createBenchmark({
      campaignId: CAMPAIGN_ID,
      platformType: "google_analytics",
      category: "performance",
      name: benchmarkName,
      metric: "cpa",
      description: "Temporary authorized Spend propagation fixture",
      benchmarkValue: "999999",
      currentValue: "0",
      unit: "$",
      benchmarkType: "goal",
      source: "Spend certification fixture",
      period: "monthly",
      status: "active",
      confidenceLevel: "high",
      applyTo: "all",
      alertsEnabled: false,
      emailNotifications: false,
    } as any);
    benchmarkId = String(benchmark.id || "");
    assert(kpiId && benchmarkId, "Temporary KPI/Benchmark fixture creation failed");

    const reportConfig = {
      sections: { overview: true, kpis: true, benchmarks: true, ads: false, insights: false },
      subsections: {
        overview: { summary: false, revenue: false, spend: true, performance: false, campaignBreakdown: false, landingPages: false, conversionEvents: false },
        kpis: { items: true },
        benchmarks: { items: true },
        ads: { summary: false, topCampaigns: false, allCampaigns: false, bestWorst: false, revenueBreakdown: false },
        insights: { summaryCards: false, trends: false, dataSummary: false, actions: false },
      },
      selectedKpiIds: [kpiId],
      selectedBenchmarkIds: [benchmarkId],
    };
    const reportCreated = await post("/api/platforms/google_analytics/reports", {
      campaignId: CAMPAIGN_ID,
      name: reportName,
      description: "Temporary authorized Spend propagation fixture",
      reportType: "custom",
      configuration: reportConfig,
      scheduleEnabled: false,
      status: "active",
    });
    reportId = String(reportCreated.body?.id || "");
    assert(reportCreated.status === 201 && reportId, `Temporary report creation failed (${reportCreated.status})`);

    const validateDownstream = async (label: string, expectedSpend: number) => {
      const expectedCpa = money(expectedSpend / financialConversions);
      const created = await post(`/api/platforms/google_analytics/reports/${reportId}/snapshots`);
      const snapshotId = String(created.body?.snapshot?.id || "");
      if (snapshotId) snapshotIds.add(snapshotId);
      assert(created.ok && snapshotId, `${label} snapshot creation failed (${created.status}): ${stableJson(created.body)}`);
      const payload = parseJson(created.body?.snapshot?.snapshotJson);
      const benchmarkSnapshot = (Array.isArray(payload?.benchmarks) ? payload.benchmarks : [])
        .find((row: any) => String(row?.id) === benchmarkId);
      const values = await dependentValues();
      const pdfResponse = await context!.request.get(`${BASE_URL}/api/report-snapshots/${snapshotId}/pdf`, {
        headers: { Authorization: `Bearer ${await token()}` }, failOnStatusCode: false, timeout: 120_000,
      });
      const pdf = await pdfResponse.body();
      const text = pdfResponse.ok() ? normalizedText(await pdfText(pdf)) : "";
      const exact = created.ok && values.kpis.ok && values.benchmarks.ok
        && values.kpiValue === expectedCpa && values.benchmarkValue === expectedCpa
        && money(benchmarkSnapshot?.currentValue) === expectedCpa
        && pdfResponse.ok() && pdf.subarray(0, 5).toString() === "%PDF-" && pdf.length > 1000
        && text.includes("total spend") && hasNumber(text, expectedSpend)
        && text.includes(normalizedText(kpiName)) && text.includes(normalizedText(benchmarkName))
        && hasNumber(text, expectedCpa);
      check(label, exact, {
        expectedSpend,
        expectedCpa,
        kpi: values.kpiValue,
        benchmark: values.benchmarkValue,
        snapshotBenchmark: money(benchmarkSnapshot?.currentValue),
        pdfStatus: pdfResponse.status(),
        pdfBytes: pdf.length,
      });
      return { expectedSpend, expectedCpa, snapshotHash: hash(snapshotId), pdfBytes: pdf.length };
    };

    observations.initialDownstream = await validateDownstream("initialKpiBenchmarkSnapshotReportPdfPropagation", initialTotal);

    const initialMappingRaw = String((await sourceState(sheetSourceId))?.mapping_config || "");
    const alternateMapping = { ...parseJson(initialMappingRaw), campaignValues: [alternateGroup.value] };
    const mappingChanged = await dbClient.query(`
      UPDATE spend_sources SET mapping_config = $1
      WHERE id::text = $2 AND campaign_id = $3 AND source_type = 'google_sheets'
        AND is_active = true AND mapping_config = $4
    `, [JSON.stringify(alternateMapping), sheetSourceId, CAMPAIGN_ID, initialMappingRaw]);
    assert(mappingChanged.rowCount === 1, "Guarded temporary mapping mutation did not change exactly one source");
    const csvBeforeAutomatic = sourceWithoutSync(await sourceState(csvSourceId));
    const initialSyncedAt = String(parseJson(initialMappingRaw)?.lastSyncedAt || "");
    let automaticSeconds = 0;
    let automaticSheetState: any = null;
    while (automaticSeconds < 180) {
      await wait(10_000);
      automaticSeconds += 10;
      automaticSheetState = await sourceState(sheetSourceId);
      const nextSync = String(parseJson(automaticSheetState?.mapping_config)?.lastSyncedAt || "");
      if (automaticSheetState?.total === alternateGroup.total && new Date(nextSync || 0).getTime() > new Date(initialSyncedAt || 0).getTime()) break;
    }
    const csvAfterAutomatic = sourceWithoutSync(await sourceState(csvSourceId));
    const automaticTotal = money(alternateGroup.total + 13);
    const automaticSpendEndpoints = await endpointSpend();
    check("automaticSheetExactProviderSelectionDelta", automaticSheetState?.id === sheetSourceId
      && automaticSheetState?.total === alternateGroup.total
      && automaticSpendEndpoints.sourceIds.length === 2
      && automaticSpendEndpoints.total === automaticTotal
      && automaticSpendEndpoints.breakdownTotal === automaticTotal
      && automaticSpendEndpoints.dailyTotal === automaticTotal
      && stableJson(csvAfterAutomatic) === stableJson(csvBeforeAutomatic), { automaticSeconds, sheetTotal: automaticSheetState?.total, endpoints: automaticSpendEndpoints });
    observations.automaticSheet = {
      seconds: automaticSeconds,
      sourceStable: automaticSheetState?.id === sheetSourceId,
      sourceCount: automaticSpendEndpoints.sourceIds.length,
      fromSpend: baseGroup.total,
      toSpend: alternateGroup.total,
      exactDelta: money(alternateGroup.total - baseGroup.total),
      csvUnchanged: stableJson(csvAfterAutomatic) === stableJson(csvBeforeAutomatic),
    };
    observations.automaticDownstream = await validateDownstream("automaticSheetKpiBenchmarkSnapshotReportPdfPropagation", automaticTotal);

    const highCsvFile = {
      name: `${runTag}-csv-high.csv`,
      text: "Date,Spend,Campaign\n2026-09-01,508,TARGET\n2026-09-02,505,TARGET",
    };
    const highCsv = await csvProcess({ ...csvMapping, sourceId: csvSourceId, displayName: highCsvFile.name }, highCsvFile);
    const highCsvState = await sourceState(csvSourceId);
    const highTotal = money(alternateGroup.total + 1013);
    const highSpendEndpoints = await endpointSpend();
    check("csvManualRefreshExactDelta", highCsv.ok && String(highCsv.body?.sourceId || "") === csvSourceId
      && highCsvState?.total === 1013 && highSpendEndpoints.sourceIds.length === 2
      && highSpendEndpoints.total === highTotal && highSpendEndpoints.breakdownTotal === highTotal
      && highSpendEndpoints.dailyTotal === highTotal, { status: highCsv.status, csvTotal: highCsvState?.total, endpoints: highSpendEndpoints });
    observations.csvDownstream = await validateDownstream("csvManualKpiBenchmarkSnapshotReportPdfPropagation", highTotal);

    const lowerCpa = Math.min(observations.automaticDownstream.expectedCpa, observations.csvDownstream.expectedCpa);
    const upperCpa = Math.max(observations.automaticDownstream.expectedCpa, observations.csvDownstream.expectedCpa);
    assert(upperCpa > lowerCpa, "Spend delta did not produce a distinct CPA at persisted precision");
    const threshold = money((lowerCpa + upperCpa) / 2);
    const restoreLowCsv = await csvProcess({ ...csvMapping, sourceId: csvSourceId }, csvFile);
    assert(restoreLowCsv.ok, "CSV low-state restoration for alert validation failed");
    await validateDownstream("alertLowStatePrepared", automaticTotal);
    const enableAlert = await patch(`/api/platforms/google_analytics/kpis/${kpiId}`, {
      alertsEnabled: true,
      alertThreshold: threshold,
      alertCondition: "below",
      emailNotifications: false,
      alertFrequency: "daily",
    });
    const alertRows = await dbClient.query(`
      SELECT id::text, message, read, metadata
      FROM notifications WHERE campaign_id = $1 AND type = 'performance-alert' ORDER BY created_at
    `, [CAMPAIGN_ID]);
    const activeAlert = alertRows.rows.find((row) => String(parseJson(row.metadata)?.kpiId || "") === kpiId && !parseJson(row.metadata)?.resolved);
    check("alertUsesLowSpendDerivedValue", enableAlert.ok && Boolean(activeAlert)
      && normalizedText(activeAlert?.message).includes(observations.automaticDownstream.expectedCpa.toFixed(2)), { status: enableAlert.status, alertCount: alertRows.rows.length, expectedCpa: observations.automaticDownstream.expectedCpa });

    const highCsvAgain = await csvProcess({ ...csvMapping, sourceId: csvSourceId, displayName: highCsvFile.name }, highCsvFile);
    assert(highCsvAgain.ok, "CSV high-state restoration for alert validation failed");
    await validateDownstream("alertHighStatePrepared", highTotal);
    const reconcileAlert = await patch(`/api/platforms/google_analytics/kpis/${kpiId}`, { description: "Temporary authorized Spend propagation fixture - high state" });
    const resolvedRows = await dbClient.query(`
      SELECT id::text, read, metadata FROM notifications
      WHERE campaign_id = $1 AND type = 'performance-alert' ORDER BY created_at
    `, [CAMPAIGN_ID]);
    const resolvedAlert = resolvedRows.rows.find((row) => String(parseJson(row.metadata)?.kpiId || "") === kpiId && parseJson(row.metadata)?.resolved === true);
    check("alertClearsAfterHigherSpendDerivedValue", reconcileAlert.ok && Boolean(resolvedAlert) && resolvedAlert.read === true, { status: reconcileAlert.status, notificationCount: resolvedRows.rows.length });
    observations.alert = { threshold, lowCpa: lowerCpa, highCpa: upperCpa, created: Boolean(activeAlert), resolved: Boolean(resolvedAlert) };

    const disableAlert = await patch(`/api/platforms/google_analytics/kpis/${kpiId}`, { alertsEnabled: false, alertThreshold: null, emailNotifications: false });
    check("alertDisabledBeforeCleanup", disableAlert.ok, { status: disableAlert.status });

    const restoredSheet = await post(`/api/campaigns/${CAMPAIGN_ID}/spend/sheets/process`, {
      connectionId,
      mapping: { ...sheetMapping, sourceId: sheetSourceId },
      platformContext: "ga4",
    });
    const restoredCsv = await csvProcess({ ...csvMapping, sourceId: csvSourceId }, csvFile);
    check("temporarySourcesRestoredBeforeDelete", restoredSheet.ok && restoredCsv.ok
      && (await sourceState(sheetSourceId))?.total === baseGroup.total
      && (await sourceState(csvSourceId))?.total === 13, { sheetStatus: restoredSheet.status, csvStatus: restoredCsv.status });

    check("allAuthorizedChecksPassed", failures.length === 0, failures);
  } finally {
    if (connectionTemporarilyBroken && connectionId && originalSpreadsheetId) {
      await dbClient.query(`
        UPDATE google_sheets_connections SET spreadsheet_id = $1
        WHERE id::text = $2 AND campaign_id = $3 AND purpose = 'spend'
      `, [originalSpreadsheetId, connectionId, CAMPAIGN_ID]).catch(() => null);
      connectionTemporarilyBroken = false;
    }

    if (kpiId) {
      await dbClient.query(`DELETE FROM notifications WHERE campaign_id = $1 AND metadata LIKE $2`, [CAMPAIGN_ID, `%${kpiId}%`]).catch(() => null);
      await dbClient.query(`DELETE FROM email_alert_events WHERE entity_id = $1`, [kpiId]).catch(() => null);
    }
    if (reportId) {
      await dbClient.query(`DELETE FROM report_send_events WHERE report_id = $1`, [reportId]).catch(() => null);
      await dbClient.query(`DELETE FROM email_alert_events WHERE entity_id = $1`, [reportId]).catch(() => null);
      await dbClient.query(`DELETE FROM report_snapshots WHERE report_id = $1 AND campaign_id = $2`, [reportId, CAMPAIGN_ID]).catch(() => null);
      await del(`/api/platforms/google_analytics/reports/${reportId}`).catch(() => null);
      await dbClient.query(`DELETE FROM linkedin_reports WHERE id::text = $1 AND campaign_id = $2 AND name = $3`, [reportId, CAMPAIGN_ID, reportName]).catch(() => null);
    }
    if (benchmarkId) {
      await del(`/api/platforms/google_analytics/benchmarks/${benchmarkId}`).catch(() => null);
      await dbClient.query(`DELETE FROM benchmark_history WHERE benchmark_id = $1`, [benchmarkId]).catch(() => null);
      await dbClient.query(`DELETE FROM benchmarks WHERE id::text = $1 AND campaign_id = $2 AND name = $3`, [benchmarkId, CAMPAIGN_ID, benchmarkName]).catch(() => null);
    }
    if (kpiId) {
      await del(`/api/platforms/google_analytics/kpis/${kpiId}`).catch(() => null);
      await dbClient.query(`DELETE FROM kpi_progress WHERE kpi_id = $1`, [kpiId]).catch(() => null);
      await dbClient.query(`DELETE FROM kpi_alerts WHERE kpi_id = $1`, [kpiId]).catch(() => null);
      await dbClient.query(`DELETE FROM kpi_periods WHERE kpi_id = $1`, [kpiId]).catch(() => null);
      await dbClient.query(`DELETE FROM kpis WHERE id::text = $1 AND campaign_id = $2 AND name = $3`, [kpiId, CAMPAIGN_ID, kpiName]).catch(() => null);
    }
    for (const sourceId of [csvSourceId, sheetSourceId].filter(Boolean)) {
      await del(`/api/campaigns/${CAMPAIGN_ID}/spend-sources/${sourceId}?platformContext=ga4`).catch(() => null);
      await storage.deleteSpendSourceWithRecords(CAMPAIGN_ID, sourceId, "ga4").catch(() => false);
      await storage.hardDeleteInactiveSpendSource(CAMPAIGN_ID, sourceId).catch(() => false);
    }
    if (connectionId) {
      await storage.deleteGoogleSheetsConnection(connectionId).catch(() => false);
      await dbClient.query(`
        DELETE FROM google_sheets_connections
        WHERE id::text = $1 AND campaign_id = $2 AND purpose = 'spend' AND is_active = false
      `, [connectionId, CAMPAIGN_ID]).catch(() => null);
    }
    await dbClient.query(`
      UPDATE campaigns SET spend = '0'
      WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM spend_sources WHERE campaign_id = $1)
    `, [CAMPAIGN_ID]).catch(() => null);
  }

  const [finalCountsResult, finalConnectionsResult, finalRevenueSourcesResult, finalRevenueRecordsResult, finalGa4DailyResult, finalFixtureResidueResult, finalCampaignResult] = await Promise.all([
    dbClient.query(`
      SELECT
        (SELECT count(*) FROM spend_sources WHERE campaign_id = $1)::int AS sources,
        (SELECT count(*) FROM spend_records WHERE campaign_id = $1)::int AS records,
        (SELECT count(*) FROM kpis WHERE campaign_id = $1)::int AS kpis,
        (SELECT count(*) FROM benchmarks WHERE campaign_id = $1)::int AS benchmarks,
        (SELECT count(*) FROM linkedin_reports WHERE campaign_id = $1)::int AS reports,
        (SELECT count(*) FROM report_snapshots WHERE campaign_id = $1)::int AS snapshots,
        (SELECT count(*) FROM notifications WHERE campaign_id = $1)::int AS notifications
    `, [CAMPAIGN_ID]),
    dbClient.query(`
      SELECT id::text, spreadsheet_id, purpose, spreadsheet_name, sheet_name, is_active, is_primary
      FROM google_sheets_connections WHERE campaign_id = $1 AND spreadsheet_id <> 'pending' ORDER BY id
    `, [CAMPAIGN_ID]),
    dbClient.query(`SELECT * FROM revenue_sources WHERE campaign_id = $1 ORDER BY id`, [CAMPAIGN_ID]),
    dbClient.query(`SELECT * FROM revenue_records WHERE campaign_id = $1 ORDER BY id`, [CAMPAIGN_ID]),
    dbClient.query(`SELECT * FROM ga4_daily_metrics WHERE campaign_id = $1 ORDER BY property_id, date`, [CAMPAIGN_ID]),
    dbClient.query(`
      SELECT
        (SELECT count(*) FROM kpi_progress WHERE kpi_id = $1)::int AS kpi_progress,
        (SELECT count(*) FROM kpi_alerts WHERE kpi_id = $1)::int AS kpi_alerts,
        (SELECT count(*) FROM kpi_periods WHERE kpi_id = $1)::int AS kpi_periods,
        (SELECT count(*) FROM benchmark_history WHERE benchmark_id = $2)::int AS benchmark_history,
        (SELECT count(*) FROM report_snapshots WHERE report_id = $3)::int AS report_snapshots,
        (SELECT count(*) FROM report_send_events WHERE report_id = $3)::int AS report_send_events,
        (SELECT count(*) FROM email_alert_events WHERE entity_id IN ($1, $2, $3))::int AS email_alert_events,
        (SELECT count(*) FROM spend_sources WHERE id::text IN ($4, $5))::int AS spend_sources,
        (SELECT count(*) FROM spend_records WHERE spend_source_id IN ($4, $5))::int AS spend_records,
        (SELECT count(*) FROM google_sheets_connections WHERE id::text = $6)::int AS sheet_connections
    `, [kpiId, benchmarkId, reportId, sheetSourceId, csvSourceId, connectionId]),
    dbClient.query(`SELECT spend FROM campaigns WHERE id = $1`, [CAMPAIGN_ID]),
  ]);
  const finalCounts = finalCountsResult.rows[0];
  const finalFixtureResidue = finalFixtureResidueResult.rows[0];
  const revenueSourcesUnchanged = stableJson(stableProtectedRows("revenue_sources", finalRevenueSourcesResult.rows))
    === stableJson(stableProtectedRows("revenue_sources", baselineRevenueSourcesResult.rows));
  const revenueRecordsUnchanged = stableJson(stableProtectedRows("revenue_records", finalRevenueRecordsResult.rows))
    === stableJson(stableProtectedRows("revenue_records", baselineRevenueRecordsResult.rows));
  const ga4DailyUnchanged = stableJson(stableProtectedRows("ga4_daily", finalGa4DailyResult.rows))
    === stableJson(stableProtectedRows("ga4_daily", baselineGa4DailyResult.rows));
  const protectedRowsUnchanged = revenueSourcesUnchanged && revenueRecordsUnchanged && ga4DailyUnchanged;
  const noFixtureResidue = Object.values(finalFixtureResidue).every((value) => Number(value || 0) === 0);
  const cleanupExact = ["sources", "records", "kpis", "benchmarks", "reports", "snapshots", "notifications"]
    .every((key) => Number(finalCounts[key] || 0) === Number(baselineCounts[key] || 0))
    && money(finalCampaignResult.rows[0]?.spend) === money(campaign.spend)
    && stableJson(finalConnectionsResult.rows) === stableJson(baselineConnections)
    && protectedRowsUnchanged
    && noFixtureResidue;
  assert(cleanupExact, `Campaign2 cleanup mismatch: ${stableJson({
    baselineCounts,
    finalCounts,
    baselineSpend: campaign.spend,
    finalSpend: finalCampaignResult.rows[0]?.spend,
    connectionStructureRestored: stableJson(finalConnectionsResult.rows) === stableJson(baselineConnections),
    revenueSourcesUnchanged,
    revenueRecordsUnchanged,
    ga4DailyUnchanged,
    fixtureResidue: finalFixtureResidue,
  })}`);

  const output = {
    success: true,
    mode: "authorized_campaign2_spend_downstream_and_provider_failure_with_exact_cleanup",
    deployedSha: health.commit,
    campaignHash: hash(CAMPAIGN_ID),
    currency: campaignCurrency,
    completedEndDate,
    checks,
    observations,
    cleanup: {
      exact: cleanupExact,
      counts: finalCounts,
      fixtureResidue: finalFixtureResidue,
      connectionStructureRestored: true,
      protectedRevenueAndGa4DailyRowsUnchanged: protectedRowsUnchanged,
      campaignSpend: money(finalCampaignResult.rows[0]?.spend),
    },
    providerBoundary: {
      externalCellWritePerformed: false,
      reason: "The configured Google Sheets OAuth contract is read-only; exact automatic value-changing refresh used two existing provider campaign selections instead.",
    },
    scheduledPdfBoundary: "The deployed manual snapshot and snapshot-download routes executed the same GA4 PDF builder used by scheduled reports; no email was sent.",
    googleAds: "NOT CONFIGURED / EXCLUDED",
  };
  console.log(JSON.stringify(output, null, 2));
} finally {
  if (sessionId) await clerkPost(`/sessions/${encodeURIComponent(sessionId)}/revoke`).catch(() => null);
  else if (signInTokenId) await clerkPost(`/sign_in_tokens/${encodeURIComponent(signInTokenId)}/revoke`).catch(() => null);
  await context?.close().catch(() => null);
  await browser?.close().catch(() => null);
  dbClient.release();
  await pool.end().catch(() => null);
}
