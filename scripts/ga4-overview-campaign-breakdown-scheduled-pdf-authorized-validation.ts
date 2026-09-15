import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { chromium, type APIResponse, type Browser, type BrowserContext, type Page } from "playwright";
import { pool } from "../server/db";
import { resolveExactGA4CampaignBreakdownRevenue } from "../shared/ga4-campaign-breakdown";

const BASE_URL = String(process.env.GA4_OVERVIEW_BASE_URL || "https://marketforensics.onrender.com").replace(/\/$/, "");
const EXPECTED_SHA = String(process.env.GA4_OVERVIEW_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.GA4_OVERVIEW_CAMPAIGN_ID || "").trim();
const PROPERTY_ID = String(process.env.GA4_OVERVIEW_PROPERTY_ID || "").trim().replace(/^properties\//, "");
const CLERK_SECRET = String(process.env.CLERK_SECRET_KEY || "").trim();
const CONFIRMED = String(process.env.GA4_OVERVIEW_SCHEDULED_PDF_CONFIRM || "").trim().toLowerCase() === "true";

if (!pool) throw new Error("DATABASE_URL is required");
if (!CLERK_SECRET) throw new Error("CLERK_SECRET_KEY is required");
if (!/^[0-9a-f-]{36}$/i.test(CAMPAIGN_ID)) throw new Error("GA4_OVERVIEW_CAMPAIGN_ID must be an explicit campaign UUID");
if (!/^\d+$/.test(PROPERTY_ID)) throw new Error("GA4_OVERVIEW_PROPERTY_ID must be an explicit numeric property ID");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("GA4_OVERVIEW_EXPECTED_SHA must be the exact deployed SHA");
if (!CONFIRMED) throw new Error("GA4_OVERVIEW_SCHEDULED_PDF_CONFIRM=true is required for this temporary production fixture");

type Result = { ok: boolean; status: number; body: any };
const assert = (condition: unknown, message: string): asserts condition => { if (!condition) throw new Error(message); };
const exact = (actual: unknown, expected: unknown, label: string) => {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
};
const round2 = (value: unknown) => Number((Number(value) || 0).toFixed(2));
const compact = (value: unknown) => String(value || "").replace(/,/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const hash = (value: unknown) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
const stable = (value: any): any => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const stableJson = (value: unknown) => JSON.stringify(stable(value));
const responseResult = async (response: APIResponse): Promise<Result> => {
  const raw = await response.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  return { ok: response.ok(), status: response.status(), body };
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
let reportId = "";
let snapshotId = "";
const runTag = `Campaign Breakdown scheduled PDF ${Date.now()}`;

const token = async () => {
  const value = await page?.evaluate(() => (window as any).Clerk?.session?.getToken());
  assert(value, "Clerk session token is unavailable");
  return String(value);
};
const request = async (method: string, path: string, body?: unknown): Promise<Result> => {
  assert(context, "Authenticated request context is unavailable");
  return responseResult(await context.request.fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { data: body }),
    failOnStatusCode: false,
    timeout: 120_000,
  }));
};
const get = (path: string) => request("GET", path);
const post = (path: string, body?: unknown) => request("POST", path, body);
const del = (path: string) => request("DELETE", path);

const readProtectedState = async () => {
  const queries = await Promise.all([
    dbClient.query(`SELECT id::text, source_type, platform_context, display_name, currency, mapping_config, is_active FROM revenue_sources WHERE campaign_id = $1 ORDER BY id`, [CAMPAIGN_ID]),
    dbClient.query(`SELECT revenue_source_id, external_id, date, revenue::text, currency, source_type FROM revenue_records WHERE campaign_id = $1 ORDER BY revenue_source_id, external_id, date, id`, [CAMPAIGN_ID]),
    dbClient.query(`SELECT id::text, source_type, platform_context, display_name, currency, mapping_config, is_active FROM spend_sources WHERE campaign_id = $1 ORDER BY id`, [CAMPAIGN_ID]),
    dbClient.query(`SELECT spend_source_id, sub_campaign_urn, date, spend::text, currency, source_type FROM spend_records WHERE campaign_id = $1 ORDER BY spend_source_id, sub_campaign_urn, date, id`, [CAMPAIGN_ID]),
    dbClient.query(`SELECT property_id, date, sessions, users, conversions, revenue::text, revenue_metric, is_simulated FROM ga4_daily_metrics WHERE campaign_id = $1 ORDER BY property_id, date`, [CAMPAIGN_ID]),
    dbClient.query(`SELECT id::text, name, metric, current_value, target_value, status FROM kpis WHERE campaign_id = $1 ORDER BY id`, [CAMPAIGN_ID]),
    dbClient.query(`SELECT id::text, name, metric, current_value, benchmark_value, status FROM benchmarks WHERE campaign_id = $1 ORDER BY id`, [CAMPAIGN_ID]),
  ]);
  return hash(stableJson(queries.map((result) => result.rows)));
};
const readCounts = async () => (await dbClient.query(`
  SELECT
    (SELECT count(*) FROM linkedin_reports WHERE campaign_id = $1)::int AS reports,
    (SELECT count(*) FROM report_snapshots WHERE campaign_id = $1)::int AS snapshots,
    (SELECT count(*) FROM report_send_events e JOIN linkedin_reports r ON r.id::text = e.report_id WHERE r.campaign_id = $1)::int AS send_events
`, [CAMPAIGN_ID])).rows[0];

try {
  const campaignResult = await dbClient.query(`
    SELECT c.id::text, c.name, c.owner_id, c.client_id, c.currency, c.ga4_campaign_filter, g.property_id
    FROM campaigns c
    JOIN ga4_connections g ON g.campaign_id = c.id AND g.is_active = true AND g.property_id = $2
    WHERE c.id = $1
    LIMIT 1
  `, [CAMPAIGN_ID, PROPERTY_ID]);
  exact(campaignResult.rowCount, 1, "active campaign/property boundary");
  const campaign = campaignResult.rows[0];
  const currency = String(campaign.currency || "").trim().toUpperCase();
  assert(/^[A-Z]{3}$/.test(currency), "Campaign currency is unavailable");
  const baselineCounts = await readCounts();
  const baselineProtectedHash = await readProtectedState();

  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json().catch(() => ({}));
  assert(healthResponse.ok && health?.commit === EXPECTED_SHA,
    `Expected deployed SHA ${EXPECTED_SHA}, received ${String(health?.commit || "unknown")}`);

  const signIn = await clerkPost("/sign_in_tokens", { user_id: campaign.owner_id, expires_in_seconds: 1800 });
  const signInBody: any = await signIn.json().catch(() => ({}));
  assert(signIn.ok && signInBody?.token, `Clerk sign-in token failed (${signIn.status})`);
  signInTokenId = String(signInBody.id || "");
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  page = await context.newPage();
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(signInBody.token))}`, {
    waitUntil: "domcontentloaded", timeout: 60_000,
  });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60_000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ""));

  const configuration = {
    sections: { overview: true, kpis: false, benchmarks: false, ads: false, insights: false },
    subsections: {
      overview: { summary: false, revenue: false, spend: false, performance: false, campaignBreakdown: true, landingPages: false, conversionEvents: false },
      kpis: { items: false },
      benchmarks: { items: false },
      ads: { summary: false, topCampaigns: false, allCampaigns: false, bestWorst: false, revenueBreakdown: false },
      insights: { summaryCards: false, trends: false, dataSummary: false, actions: false },
    },
    selectedKpiIds: [],
    selectedBenchmarkIds: [],
  };
  const createdReport = await post("/api/platforms/google_analytics/reports", {
    campaignId: CAMPAIGN_ID,
    name: runTag,
    description: "Temporary authorized Campaign Breakdown scheduled-PDF value-parity fixture",
    reportType: "custom",
    configuration,
    scheduleEnabled: false,
    status: "active",
  });
  reportId = String(createdReport.body?.id || "");
  assert(createdReport.status === 201 && reportId, `Temporary report creation failed (${createdReport.status}): ${stableJson(createdReport.body)}`);
  exact(String(createdReport.body?.campaignId || ""), CAMPAIGN_ID, "temporary report campaign scope");
  exact(String(createdReport.body?.platformType || "").toLowerCase(), "google_analytics", "temporary report platform scope");
  exact(String(createdReport.body?.reportType || "").toLowerCase(), "custom", "temporary report type");
  exact(Boolean(createdReport.body?.scheduleEnabled), false, "temporary report scheduler exclusion");

  const createdSnapshot = await post(`/api/platforms/google_analytics/reports/${reportId}/snapshots`);
  snapshotId = String(createdSnapshot.body?.snapshot?.id || "");
  assert(createdSnapshot.ok && snapshotId, `Temporary snapshot creation failed (${createdSnapshot.status}): ${stableJson(createdSnapshot.body)}`);
  const snapshotPayload = typeof createdSnapshot.body?.snapshot?.snapshotJson === "string"
    ? JSON.parse(createdSnapshot.body.snapshot.snapshotJson)
    : createdSnapshot.body?.snapshot?.snapshotJson || {};
  exact(String(snapshotPayload?.source || ""), "manual", "snapshot source");
  exact(String(snapshotPayload?.campaignId || ""), CAMPAIGN_ID, "snapshot campaign scope");

  const base = `/api/campaigns/${CAMPAIGN_ID}`;
  const [breakdown, native, revenueTotal, revenueSourcesResult, revenueBreakdownResult] = await Promise.all([
    get(`${base}/ga4-breakdown?window=import-to-date&propertyId=${PROPERTY_ID}&overviewCampaignBreakdown=1&readOnly=1`),
    get(`${base}/ga4-to-date?propertyId=${PROPERTY_ID}&readOnly=1`),
    get(`${base}/revenue-to-date`),
    get(`${base}/revenue-sources`),
    get(`${base}/revenue-breakdown`),
  ]);
  for (const [label, result] of Object.entries({ breakdown, native, revenueTotal, revenueSourcesResult, revenueBreakdownResult })) {
    assert(result.ok && result.body?.success !== false, `${label} endpoint failed (${result.status}): ${stableJson(result.body)}`);
  }
  const rows = Array.isArray(breakdown.body?.rows) ? breakdown.body.rows : [];
  assert(rows.length > 0, "Campaign Breakdown API returned no rows");
  exact(String(breakdown.body?.propertyId || "").replace(/^properties\//, ""), PROPERTY_ID, "Campaign Breakdown property");
  exact(round2(rows.reduce((sum: number, row: any) => sum + Number(row?.revenue || 0), 0)), round2(native.body?.totals?.revenue), "native row revenue/GA4 Revenue reconciliation");

  const sourceDefinitions = Array.isArray(revenueSourcesResult.body?.sources) ? revenueSourcesResult.body.sources : [];
  const materializedSources = Array.isArray(revenueBreakdownResult.body?.sources) ? revenueBreakdownResult.body.sources : [];
  const materializedById = new Map(materializedSources.map((source: any) => [String(source?.sourceId || ""), source]));
  const resolutionSources = sourceDefinitions.filter((source: any) => source?.isActive !== false).map((source: any) => {
    const materialized: any = materializedById.get(String(source?.id || ""));
    return { ...source, sourceId: String(source?.id || ""), revenue: materialized?.revenue ?? null, currency: materialized?.currency || source?.currency };
  });
  const resolution = resolveExactGA4CampaignBreakdownRevenue(
    rows.map((row: any) => ({ name: String(row?.campaign || "") })), resolutionSources, currency,
  );
  exact(resolution.ambiguous, false, "exact imported-revenue mapping ambiguity");
  exact(resolution.currencyMismatch, false, "exact imported-revenue mapping currency");
  exact(resolution.materializationMismatch, false, "exact imported-revenue materialization");
  exact(round2(resolution.mappedRevenue + resolution.unmatchedRevenue), round2(revenueTotal.body?.totalRevenue), "mapped+unmatched/imported revenue reconciliation");

  assert(context, "Authenticated request context is unavailable for PDF download");
  const pdfResponse = await context.request.get(`${BASE_URL}/api/report-snapshots/${snapshotId}/pdf`, {
    headers: { Authorization: `Bearer ${await token()}` }, failOnStatusCode: false, timeout: 120_000,
  });
  exact(pdfResponse.status(), 200, "scheduled-consumer PDF status");
  assert(String(pdfResponse.headers()["content-type"] || "").includes("application/pdf"), "Scheduled-consumer response is not a PDF");
  const pdfBuffer = await pdfResponse.body();
  assert(pdfBuffer.subarray(0, 5).toString() === "%PDF-" && pdfBuffer.length > 1000, "Scheduled-consumer PDF artifact is invalid");
  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
  const pdfText = compact((await parser.getText()).text);
  await parser.destroy();
  for (const header of ["Campaign Breakdown", "CAMPAIGN", "SESSIONS", "USERS", "CONVERSIONS", "CONV. RATE", "REVENUE"]) {
    assert(pdfText.includes(compact(header)), `Scheduled-consumer PDF is missing header ${header}`);
  }
  const observedRows = rows.map((row: any) => {
    const campaignName = String(row?.campaign || "").trim();
    const sessions = Number(row?.sessions || 0);
    const users = Number(row?.users || 0);
    const conversions = Number(row?.conversions || 0);
    const conversionRate = sessions > 0 ? (conversions / sessions) * 100 : 0;
    const displayedRevenue = round2(Number(row?.revenue || 0) + Number(resolution.revenueByCampaign.get(campaignName) || 0));
    for (const value of [campaignName, String(sessions), String(users), String(conversions), `${conversionRate.toFixed(1)}%`, `${currency} ${displayedRevenue.toFixed(2)}`]) {
      assert(pdfText.includes(compact(value)), `Scheduled-consumer PDF is missing ${campaignName} value ${value}`);
    }
    return { campaign: campaignName, sessions, users, conversions, conversionRate: round2(conversionRate), displayedRevenue };
  });

  const fixtureEvents = await dbClient.query(`SELECT count(*)::int AS count FROM report_send_events WHERE report_id = $1`, [reportId]);
  exact(Number(fixtureEvents.rows[0]?.count || 0), 0, "temporary report send-event count");

  console.log(JSON.stringify({
    success: true,
    mode: "authorized_campaign_breakdown_scheduled_pdf_builder_parity_with_exact_cleanup",
    deployedSha: health.commit,
    campaignHash: hash(CAMPAIGN_ID),
    clientHash: hash(campaign.client_id),
    ownerHash: hash(campaign.owner_id),
    propertyId: PROPERTY_ID,
    currency,
    reportBoundary: "Custom GA4 report with only Overview > Campaign Breakdown selected",
    schedulerOrEmailTriggered: false,
    snapshotSource: "manual",
    sharedProductionBuilder: "buildGA4ScheduledPdfAttachment",
    rows: observedRows,
    nativeRevenue: round2(native.body?.totals?.revenue),
    importedRevenue: round2(revenueTotal.body?.totalRevenue),
    mappedImportedRevenue: round2(resolution.mappedRevenue),
    unmatchedImportedRevenue: round2(resolution.unmatchedRevenue),
    pdfBytes: pdfBuffer.length,
    temporaryReportHash: hash(reportId),
    temporarySnapshotHash: hash(snapshotId),
  }, null, 2));

  if (snapshotId) {
    const deletedSnapshot = await dbClient.query(`DELETE FROM report_snapshots WHERE id::text = $1 AND report_id = $2 AND campaign_id = $3`, [snapshotId, reportId, CAMPAIGN_ID]);
    exact(deletedSnapshot.rowCount, 1, "temporary snapshot cleanup");
    snapshotId = "";
  }
  const deletedReport = await del(`/api/platforms/google_analytics/reports/${reportId}`);
  assert(deletedReport.ok && deletedReport.body?.success === true, `Temporary report cleanup failed (${deletedReport.status})`);
  reportId = "";

  const finalCounts = await readCounts();
  exact(stableJson(finalCounts), stableJson(baselineCounts), "temporary report/snapshot count cleanup");
  exact(await readProtectedState(), baselineProtectedHash, "protected analytics state after validation");
  console.log(JSON.stringify({ cleanup: { exact: true, counts: finalCounts, protectedAnalyticsStateUnchanged: true } }, null, 2));
} finally {
  if (snapshotId && reportId) {
    await dbClient.query(`DELETE FROM report_snapshots WHERE id::text = $1 AND report_id = $2 AND campaign_id = $3`, [snapshotId, reportId, CAMPAIGN_ID]).catch(() => null);
  }
  if (reportId) {
    await del(`/api/platforms/google_analytics/reports/${reportId}`).catch(() => null);
    await dbClient.query(`DELETE FROM linkedin_reports WHERE id::text = $1 AND campaign_id = $2 AND name = $3`, [reportId, CAMPAIGN_ID, runTag]).catch(() => null);
  }
  if (sessionId) await clerkPost(`/sessions/${encodeURIComponent(sessionId)}/revoke`).catch(() => null);
  else if (signInTokenId) await clerkPost(`/sign_in_tokens/${encodeURIComponent(signInTokenId)}/revoke`).catch(() => null);
  await context?.close().catch(() => null);
  await browser?.close().catch(() => null);
  dbClient.release();
  await pool.end().catch(() => null);
}
