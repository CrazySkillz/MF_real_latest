import { createHash } from "node:crypto";
import { chromium, type Page } from "playwright";
import { pool } from "../server/db";
import { getReportingDateWindow } from "../server/utils/reporting-timezone";

const BASE_URL = process.env.GA4_INSIGHTS_BASE_URL || "https://marketforensics.onrender.com";
const EXPECTED_SHA = String(process.env.GA4_INSIGHTS_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.GA4_INSIGHTS_CAMPAIGN_ID || "8aa735ee-c02f-41e2-bb1f-7c3f43bb9458").trim();
const requestedProperty = String(process.env.GA4_INSIGHTS_PROPERTY_ID || "").trim();
const clerkSecret = String(process.env.CLERK_SECRET_KEY || "").trim();

if (!pool) throw new Error("DATABASE_URL is required");
if (!clerkSecret) throw new Error("CLERK_SECRET_KEY is required");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("GA4_INSIGHTS_EXPECTED_SHA must be a full Git SHA");

const normalizeProperty = (value: unknown) => String(value || "").replace(/^properties\//, "").trim();
const hash = (value: unknown) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
const clerkPost = async (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const request = async (page: Page, path: string, method = "GET") => page.evaluate(async ({ path, method }) => {
  const token = await (window as any).Clerk?.session?.getToken();
  if (!token) throw new Error("Clerk session token is unavailable");
  const response = await fetch(path, { method, credentials: "include", headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: response.ok, status: response.status, body };
}, { path, method });

const client = await pool.connect();
const browser = await chromium.launch({ headless: true });
let sessionId = "";
try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const inventory = await client.query(`
    SELECT c.owner_id, c.reporting_time_zone, g.property_id
    FROM campaigns c
    JOIN ga4_connections g ON g.campaign_id = c.id AND g.is_active = true
    WHERE c.id = $1
      AND ($2 = '' OR REPLACE(g.property_id, 'properties/', '') = REPLACE($2, 'properties/', ''))
    ORDER BY g.is_primary DESC
    LIMIT 1
  `, [CAMPAIGN_ID, requestedProperty]);
  if (inventory.rowCount !== 1) throw new Error("Exact active campaign/property inventory row was not found");
  const row = inventory.rows[0];
  const propertyId = String(row.property_id);
  const expected = getReportingDateWindow(60, row.reporting_time_zone);
  const googleAdsInventory = await client.query(`
    SELECT s.id, s.mapping_config, a.method, a.spend_only
    FROM spend_sources s
    LEFT JOIN google_ads_connections a ON a.campaign_id = s.campaign_id
    WHERE s.campaign_id = $1 AND s.is_active = true AND s.source_type = 'ad_platforms'
      AND COALESCE(s.platform_context, 'ga4') = 'ga4'
  `, [CAMPAIGN_ID]);
  const googleAdsSources = googleAdsInventory.rows.filter((source: any) => {
    try { return String(JSON.parse(String(source.mapping_config || "{}"))?.platform || "").toLowerCase() === "google_ads"; }
    catch { return false; }
  });
  if (googleAdsSources.length > 0) throw new Error("Google Ads spend is active outside the current GA4 Insights release boundary");

  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json();
  if (!healthResponse.ok || health?.commit !== EXPECTED_SHA) throw new Error(`Deployed SHA mismatch: ${String(health?.commit || "unavailable")}`);

  const tokenResponse = await clerkPost("/sign_in_tokens", { user_id: row.owner_id, expires_in_seconds: 600 });
  const token: any = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !token?.token) throw new Error(`Clerk sign-in token failed (${tokenResponse.status})`);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(token.token))}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ""));

  const dailyPath = `/api/campaigns/${CAMPAIGN_ID}/ga4-daily?days=60&propertyId=${encodeURIComponent(propertyId)}`;
  const before = await request(page, dailyPath);
  if (!before.ok) throw new Error(`Pre-run daily read failed (${before.status})`);
  const run = await request(page, `/api/campaigns/${CAMPAIGN_ID}/ga4-daily-scheduler/run-now`, "POST");
  if (!run.ok || run.body?.success !== true || run.body?.trigger !== "manual" || run.body?.campaignId !== CAMPAIGN_ID) {
    throw new Error(`Deterministic scheduler run failed (${run.status})`);
  }
  if (run.body?.certificationStatus !== "validation_output_only") throw new Error("Scheduler response lost its non-certification guard");
  if (run.body?.after?.lastRunStatus !== "success") throw new Error(`Scheduler status is ${String(run.body?.after?.lastRunStatus || "unavailable")}`);

  const after = await request(page, dailyPath);
  if (!after.ok) throw new Error(`Post-run daily read failed (${after.status})`);
  if (normalizeProperty(after.body?.propertyId) !== normalizeProperty(propertyId)) throw new Error("Post-run property parity failed");
  if (after.body?.startDate !== expected.startDate || after.body?.endDate !== expected.endDate || after.body?.dataThroughDate !== expected.dataThroughDate) {
    throw new Error("Post-run completed-day window parity failed");
  }
  if (after.body?.refreshIsStale !== false) throw new Error("Post-run daily response is stale or lacks verified freshness");
  if (after.body?.providerRefreshOutcome === "failed" || after.body?.providerRefreshWarning) {
    throw new Error("Post-run daily provider refresh reports a failure");
  }

  const googleAdsScheduler = { activeSource: false, releaseBoundary: "excluded" };

  console.log(JSON.stringify({
    status: "passed",
    deployedSha: health.commit,
    campaignHash: hash(CAMPAIGN_ID),
    ownerHash: hash(row.owner_id),
    propertyId: normalizeProperty(propertyId),
    reportingTimeZone: expected.reportingTimeZone,
    completedDay: expected.dataThroughDate,
    scheduler: {
      trigger: run.body.trigger,
      lastRunStatus: run.body.after.lastRunStatus,
      lastRunFinishedAt: run.body.after.lastRunFinishedAt,
      alertsSuppressed: true,
    },
    googleAdsScheduler,
    dailyRowsBefore: Array.isArray(before.body?.data) ? before.body.data.length : 0,
    dailyRowsAfter: Array.isArray(after.body?.data) ? after.body.data.length : 0,
    mutationBoundary: "authorized campaign GA4 daily refresh and direct KPI/Benchmark recompute only",
  }, null, 2));
  await context.close();
} finally {
  await client.query("ROLLBACK").catch(() => null);
  client.release();
  if (sessionId) await clerkPost(`/sessions/${encodeURIComponent(sessionId)}/revoke`).catch(() => null);
  await browser.close().catch(() => null);
  await pool.end().catch(() => null);
}
