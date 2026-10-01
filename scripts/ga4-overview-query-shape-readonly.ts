import { createHash } from "node:crypto";
import { chromium, type BrowserContext, type Page } from "playwright";
import { pool } from "../server/db";
import { resolveGA4ImportToDateWindow } from "../server/utils/reporting-timezone";

const BASE_URL = process.env.GA4_OVERVIEW_BASE_URL || "https://marketforensics.onrender.com";
const EXPECTED_SHA = String(process.env.GA4_OVERVIEW_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.GA4_OVERVIEW_CAMPAIGN_ID || "").trim();
const PROPERTY_ID = String(process.env.GA4_OVERVIEW_PROPERTY_ID || "").trim();
const clerkSecret = String(process.env.CLERK_SECRET_KEY || "").trim();

if (!pool) throw new Error("DATABASE_URL is required");
if (!clerkSecret) throw new Error("CLERK_SECRET_KEY is required");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("GA4_OVERVIEW_EXPECTED_SHA must be a full Git SHA");
if (!/^[0-9a-f-]{36}$/i.test(CAMPAIGN_ID)) throw new Error("GA4_OVERVIEW_CAMPAIGN_ID must be a campaign UUID");
if (!/^\d+$/.test(PROPERTY_ID)) throw new Error("GA4_OVERVIEW_PROPERTY_ID must be a numeric property ID");

const hash = (value: unknown) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
const round2 = (value: unknown) => Number((Number(value) || 0).toFixed(2));
const clerkPost = async (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const api = async (page: Page, path: string) => page.evaluate(async (requestPath) => {
  const token = await (window as any).Clerk?.session?.getToken();
  if (!token) throw new Error("Clerk session token is unavailable");
  const response = await fetch(requestPath, {
    credentials: "include",
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: response.ok, status: response.status, body };
}, path);
const requireSuccess = (response: any, label: string) => {
  if (!response?.ok || response?.body?.success === false) {
    throw new Error(`${label} failed (${response?.status}): ${JSON.stringify(response?.body)}`);
  }
  return response.body;
};

const client = await pool.connect();
let context: BrowserContext | null = null;
let sessionId = "";
let signInTokenId = "";
try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const inventory = await client.query(`
    SELECT c.owner_id, c.currency, c.reporting_time_zone, c.ga4_campaign_filter, g.import_start_date
    FROM campaigns c
    JOIN ga4_connections g ON g.campaign_id = c.id AND g.property_id = $2 AND g.is_active = true
    WHERE c.id = $1
    LIMIT 1
  `, [CAMPAIGN_ID, PROPERTY_ID]);
  if (inventory.rowCount !== 1) throw new Error("Campaign/property scope is unavailable");
  const record = inventory.rows[0];
  const reportingWindow = resolveGA4ImportToDateWindow(record.import_start_date, record.reporting_time_zone);
  if (!reportingWindow) throw new Error("Initial-import window is unavailable");

  const persistedResult = await client.query(`
    SELECT COALESCE(SUM(sessions), 0)::int AS sessions,
           COALESCE(SUM(users), 0)::int AS users,
           COALESCE(SUM(conversions), 0)::int AS conversions,
           COALESCE(SUM(revenue), 0)::numeric AS revenue,
           MAX(date) AS max_date
    FROM ga4_daily_metrics
    WHERE campaign_id = $1 AND property_id = $2 AND date BETWEEN $3 AND $4
  `, [CAMPAIGN_ID, PROPERTY_ID, reportingWindow.startDate, reportingWindow.endDate]);

  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json();
  if (health?.commit !== EXPECTED_SHA) throw new Error(`deployed SHA mismatch: ${health?.commit || "unavailable"}`);

  const browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  const page = await context.newPage();
  const tokenResponse = await clerkPost("/sign_in_tokens", { user_id: record.owner_id, expires_in_seconds: 900 });
  const tokenBody: any = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenBody?.token) throw new Error(`Clerk sign-in token failed (${tokenResponse.status})`);
  signInTokenId = String(tokenBody.id || "");
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(tokenBody.token))}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ""));

  const base = `/api/campaigns/${CAMPAIGN_ID}`;
  const [aggregateResponse, breakdownResponse, benchmarkResponse] = await Promise.all([
    api(page, `${base}/ga4-to-date?propertyId=${PROPERTY_ID}&readOnly=1`),
    api(page, `${base}/ga4-breakdown?window=import-to-date&propertyId=${PROPERTY_ID}&adComparisonCampaignBreakdown=1&readOnly=1&debug=1&dimensionDiagnostics=1`),
    api(page, `${base}/ga4-benchmark-provider-validation?propertyId=${PROPERTY_ID}&disableTokenRefresh=1`),
  ]);
  const aggregate = requireSuccess(aggregateResponse, "aggregate query");
  const breakdown = requireSuccess(breakdownResponse, "breakdown query");
  const benchmark = requireSuccess(benchmarkResponse, "benchmark provider query");
  const persisted = persistedResult.rows[0];
  const summarize = (totals: any) => ({
    sessions: Number(totals?.sessions || 0),
    users: Number(totals?.users || 0),
    conversions: Number(totals?.conversions || 0),
    revenue: round2(totals?.revenue),
  });
  const persistedTotals = summarize(persisted);
  const aggregateTotals = summarize(aggregate?.totals);
  const breakdownTotals = summarize(breakdown?.totals);
  const difference = (actual: any, expected: any) => ({
    sessions: actual.sessions - expected.sessions,
    users: actual.users - expected.users,
    conversions: actual.conversions - expected.conversions,
    revenue: round2(actual.revenue - expected.revenue),
  });

  console.log(JSON.stringify({
    status: "passed",
    mode: "production-provider-and-database-read-only",
    deployedSha: health.commit,
    campaignHash: hash(CAMPAIGN_ID),
    propertyId: PROPERTY_ID,
    window: reportingWindow,
    persisted: { ...persistedTotals, maxDate: String(persisted?.max_date || "") },
    aggregate: aggregateTotals,
    breakdown: breakdownTotals,
    aggregateMinusPersisted: difference(aggregateTotals, persistedTotals),
    breakdownMinusPersisted: difference(breakdownTotals, persistedTotals),
    currentValueDateDimensionProvider: benchmark?.currentValueDateDimensionProvider || null,
    benchmarkComparisons: (Array.isArray(benchmark?.benchmarks) ? benchmark.benchmarks : []).map((row: any) => ({
      metric: row?.metric,
      storedCurrentValue: row?.storedCurrentValue,
      schedulerCandidateCurrentValue: row?.schedulerCandidateCurrentValue,
      storedVsSchedulerDelta: row?.storedVsSchedulerDelta,
    })),
    breakdownAttribution: breakdown?.meta?.overviewCampaignAttribution || null,
    dimensionDiagnostics: breakdown?.meta?.dimensionDiagnostics || null,
    safeguards: {
      applicationWrites: false,
      credentialRefreshAllowed: false,
      databaseTransaction: "read only and rolled back",
      temporarySessionRevoked: true,
    },
  }, null, 2));
} finally {
  await client.query("ROLLBACK").catch(() => null);
  client.release();
  if (sessionId) await clerkPost(`/sessions/${encodeURIComponent(sessionId)}/revoke`).catch(() => null);
  else if (signInTokenId) await clerkPost(`/sign_in_tokens/${encodeURIComponent(signInTokenId)}/revoke`).catch(() => null);
  const browser = context?.browser();
  await context?.close().catch(() => null);
  await browser?.close().catch(() => null);
  await pool.end().catch(() => null);
}
