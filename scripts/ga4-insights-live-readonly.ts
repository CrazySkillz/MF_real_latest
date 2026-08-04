import { createHash, randomBytes } from "node:crypto";
import { chromium, type Page } from "playwright";
import { pool } from "../server/db";
import { buildGA4InsightsRollups } from "../shared/ga4-insights";
import { getReportingDateWindow } from "../server/utils/reporting-timezone";

const BASE_URL = process.env.GA4_INSIGHTS_BASE_URL || "https://marketforensics.onrender.com";
const EXPECTED_SHA = String(process.env.GA4_INSIGHTS_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.GA4_INSIGHTS_CAMPAIGN_ID || "8aa735ee-c02f-41e2-bb1f-7c3f43bb9458").trim();
const requestedProperty = String(process.env.GA4_INSIGHTS_PROPERTY_ID || "").trim();
const clerkSecret = String(process.env.CLERK_SECRET_KEY || "").trim();
const requireTenantIsolation = String(process.env.GA4_INSIGHTS_REQUIRE_TENANT_ISOLATION || "1") !== "0";
const allowTemporaryUser = String(process.env.GA4_INSIGHTS_ALLOW_TEMPORARY_USER || "0") === "1";

if (!pool) throw new Error("DATABASE_URL is required");
if (!clerkSecret) throw new Error("CLERK_SECRET_KEY is required");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("GA4_INSIGHTS_EXPECTED_SHA must be a full Git SHA");

const normalizeProperty = (value: unknown) => String(value || "").replace(/^properties\//, "").trim();
const normalizeCampaign = (value: unknown) => String(value || "").trim().toLowerCase();
const hash = (value: unknown) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
const parseFilter = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
  } catch {
    // Legacy scalar filter.
  }
  return [raw];
};
const clerkPost = async (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const clerkGet = async (path: string) => fetch(`https://api.clerk.com/v1${path}`, {
  headers: { Authorization: `Bearer ${clerkSecret}` },
});
const clerkDelete = async (path: string) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${clerkSecret}` },
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
const sessions: string[] = [];
let temporaryUserId = "";
let output: Record<string, unknown> | null = null;
try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const inventory = await client.query(`
    SELECT c.owner_id, c.reporting_time_zone, c.ga4_campaign_filter,
           g.property_id, g.display_name, g.property_name
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
  const filters = parseFilter(row.ga4_campaign_filter);
  const expected60 = getReportingDateWindow(60, row.reporting_time_zone);
  const expected30 = getReportingDateWindow(30, row.reporting_time_zone);

  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json();
  if (!healthResponse.ok || health?.commit !== EXPECTED_SHA) throw new Error(`Deployed SHA mismatch: ${String(health?.commit || "unavailable")}`);

  const signIn = async (userId: string, allowMissing = false) => {
    const tokenResponse = await clerkPost("/sign_in_tokens", { user_id: userId, expires_in_seconds: 600 });
    const token: any = await tokenResponse.json().catch(() => ({}));
    if (allowMissing && tokenResponse.status === 404) return null;
    if (!tokenResponse.ok || !token?.token) throw new Error(`Clerk sign-in token failed (${tokenResponse.status})`);
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(token.token))}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60000 });
    sessions.push(await page.evaluate(() => String((window as any).Clerk?.session?.id || "")));
    return { context, page };
  };

  const owner = await signIn(String(row.owner_id));
  if (!owner) throw new Error("Campaign owner is unavailable in Clerk");
  const paths = {
    daily: `/api/campaigns/${CAMPAIGN_ID}/ga4-daily?days=60&propertyId=${encodeURIComponent(propertyId)}`,
    breakdown: `/api/campaigns/${CAMPAIGN_ID}/ga4-breakdown?dateRange=30days&propertyId=${encodeURIComponent(propertyId)}&debug=1`,
    toDate: `/api/campaigns/${CAMPAIGN_ID}/ga4-to-date?propertyId=${encodeURIComponent(propertyId)}`,
    revenue: `/api/campaigns/${CAMPAIGN_ID}/revenue-to-date`,
    spend: `/api/campaigns/${CAMPAIGN_ID}/spend-to-date?platformContext=ga4`,
    kpis: `/api/platforms/google_analytics/kpis?campaignId=${CAMPAIGN_ID}`,
    benchmarks: `/api/platforms/google_analytics/benchmarks?campaignId=${CAMPAIGN_ID}`,
  };
  const entries = await Promise.all(Object.entries(paths).map(async ([name, path]) => [name, await request(owner.page, path)] as const));
  const responses = Object.fromEntries(entries) as Record<string, any>;
  for (const [name, response] of entries) if (!response.ok) throw new Error(`${name} endpoint failed (${response.status})`);

  for (const response of [responses.daily.body, responses.breakdown.body, responses.toDate.body]) {
    if (normalizeProperty(response?.propertyId) !== normalizeProperty(propertyId)) throw new Error("Property parity failed");
  }
  if (responses.daily.body?.startDate !== expected60.startDate || responses.daily.body?.endDate !== expected60.endDate) throw new Error("60-day window parity failed");
  if (responses.breakdown.body?.startDate !== expected30.startDate || responses.breakdown.body?.endDate !== expected30.endDate) throw new Error("30-day breakdown window parity failed");
  if (responses.toDate.body?.endDate !== expected60.endDate) throw new Error("to-date completed-day cutoff parity failed");

  const expectedFilterSet = new Set(filters.map(normalizeCampaign));
  const outsideScope = (Array.isArray(responses.breakdown.body?.rows) ? responses.breakdown.body.rows : [])
    .map((item: any) => normalizeCampaign(item?.campaign))
    .filter((campaign: string) => expectedFilterSet.size > 0 && campaign && !expectedFilterSet.has(campaign));
  if (outsideScope.length > 0) throw new Error("Breakdown returned campaigns outside the saved filter");

  const rollups = buildGA4InsightsRollups(responses.daily.body?.data, responses.daily.body?.dataThroughDate);
  const uiDailyResponsePromise = owner.page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === `/api/campaigns/${CAMPAIGN_ID}/ga4-daily`
      && url.searchParams.get("days") === "60";
  }, { timeout: 120000 });
  await owner.page.goto(`${BASE_URL}/campaigns/${CAMPAIGN_ID}/ga4-metrics?tab=insights`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const uiDailyResponse = await uiDailyResponsePromise;
  if (!uiDailyResponse.ok()) throw new Error(`Live-page 60-day request failed (${uiDailyResponse.status()})`);
  const uiDailyBody: any = await uiDailyResponse.json();
  if (normalizeProperty(uiDailyBody?.propertyId) !== normalizeProperty(propertyId)) throw new Error("Live-page property parity failed");
  if (uiDailyBody?.startDate !== expected60.startDate || uiDailyBody?.endDate !== expected60.endDate) throw new Error("Live-page 60-day window parity failed");
  const uiRollups = buildGA4InsightsRollups(uiDailyBody?.data, uiDailyBody?.dataThroughDate);
  await owner.page.getByRole("heading", { name: "Insights", exact: true }).waitFor({ timeout: 120000 });
  await owner.page.getByText("Executive Financials", { exact: true }).waitFor({ timeout: 120000 });
  await owner.page.getByText("Data Summary", { exact: true }).waitFor({ timeout: 120000 });
  await owner.page.getByText("Exact completed-day window", { exact: true }).waitFor({ timeout: 120000 });
  const bodyText = await owner.page.locator("body").innerText();
  for (const required of ["Completed-day cutoff", "Latest imported day", "Reporting timezone", "What to investigate next"]) {
    if (!bodyText.includes(required)) throw new Error(`Live Insights text missing: ${required}`);
  }
  const expectedRenderedSessions = new Intl.NumberFormat("en-US").format(uiRollups.last30.sessions);
  if (!bodyText.includes(expectedRenderedSessions)) {
    const summaryIndex = bodyText.indexOf("Data Summary");
    throw new Error(`Rendered 30-day sessions do not match API rollup (expected ${expectedRenderedSessions}; summary: ${bodyText.slice(summaryIndex, summaryIndex + 500).replace(/\s+/g, " ")})`);
  }
  await owner.context.close();

  let tenantIsolation = "not run; no second production identity was authorized";
  if (requireTenantIsolation) {
    const usersResponse = await clerkGet("/users?limit=100&order_by=-created_at");
    const users: any[] = await usersResponse.json().catch(() => []);
    if (!usersResponse.ok || !Array.isArray(users)) throw new Error(`Clerk user inventory failed (${usersResponse.status})`);
    let otherUser = users.find((candidate) => String(candidate?.id || "") !== String(row.owner_id));
    if (!otherUser && allowTemporaryUser) {
      const createdResponse = await clerkPost("/users", {
        email_address: [`ga4-insights-cert-${Date.now()}@example.com`],
        password: `G4!${randomBytes(18).toString("base64url")}aA1!`,
        private_metadata: { purpose: "temporary GA4 Insights tenant-isolation certification" },
      });
      const created: any = await createdResponse.json().catch(() => ({}));
      if (!createdResponse.ok || !created?.id) throw new Error(`Temporary Clerk user creation failed (${createdResponse.status})`);
      temporaryUserId = String(created.id);
      otherUser = created;
    }
    const nonOwner = otherUser ? await signIn(String(otherUser.id), true) : null;
    if (!nonOwner) throw new Error("No valid non-owner Clerk account is available for the tenant-isolation gate");
    const denied = await request(nonOwner.page, paths.daily);
    if (denied.ok || ![403, 404].includes(denied.status)) throw new Error(`Non-owner request did not fail closed (${denied.status})`);
    tenantIsolation = `failed closed with ${denied.status}`;
    await nonOwner.context.close();
  }

  output = {
    status: "passed",
    deployedSha: health.commit,
    campaignHash: hash(CAMPAIGN_ID),
    ownerHash: hash(row.owner_id),
    propertyId: normalizeProperty(propertyId),
    reportingTimeZone: expected60.reportingTimeZone,
    savedFilterCount: filters.length,
    dailyWindow: { startDate: expected60.startDate, endDate: expected60.endDate, rows: rollups.availableDays },
    breakdownWindow: { startDate: expected30.startDate, endDate: expected30.endDate, rows: responses.breakdown.body?.rows?.length || 0 },
    last30: { complete: rollups.last30.complete, sessions: rollups.last30.sessions, conversions: rollups.last30.conversions, revenue: Number(rollups.last30.revenue.toFixed(2)) },
    sourceCounts: { revenue: responses.revenue.body?.sourceCount ?? null, spend: responses.spend.body?.sourceCount ?? null },
    kpiCount: Array.isArray(responses.kpis.body) ? responses.kpis.body.length : 0,
    benchmarkCount: Array.isArray(responses.benchmarks.body) ? responses.benchmarks.body.length : 0,
    tenantIsolation,
    tenantFixture: temporaryUserId ? "ephemeral Clerk-only user created and deleted" : "existing Clerk user",
    uiParity: "live headings, freshness labels, and API-derived 30-day sessions rendered",
    databaseTransaction: "read only and rolled back",
  };
} finally {
  await client.query("ROLLBACK").catch(() => null);
  client.release();
  const cleanupErrors: string[] = [];
  for (const session of sessions.filter(Boolean)) {
    const revoked = await clerkPost(`/sessions/${encodeURIComponent(session)}/revoke`).catch(() => null);
    if (!revoked?.ok) cleanupErrors.push(`session revoke failed (${revoked?.status || "unavailable"})`);
  }
  await browser.close().catch(() => null);
  if (temporaryUserId) {
    const deletion = await clerkDelete(`/users/${encodeURIComponent(temporaryUserId)}`).catch(() => null);
    if (!deletion?.ok) cleanupErrors.push(`temporary user deletion failed (${deletion?.status || "unavailable"})`);
    const deletedLookup = await clerkGet(`/users/${encodeURIComponent(temporaryUserId)}`).catch(() => null);
    if (deletedLookup?.status !== 404) cleanupErrors.push(`temporary user still resolves (${deletedLookup?.status || "unavailable"})`);
  }
  await pool.end().catch(() => null);
  if (cleanupErrors.length > 0) throw new Error(`Clerk cleanup failed: ${cleanupErrors.join("; ")}`);
}
if (!output) throw new Error("Production evidence packet was not produced");
console.log(JSON.stringify(output, null, 2));
