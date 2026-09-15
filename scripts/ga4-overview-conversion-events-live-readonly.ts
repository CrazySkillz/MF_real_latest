import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright";
import { pool } from "../server/db";
import { resolveGA4ImportToDateWindow } from "../server/utils/reporting-timezone";

const BASE_URL = String(process.env.GA4_CONVERSION_EVENTS_BASE_URL || "https://marketforensics.onrender.com").replace(/\/$/, "");
const EXPECTED_SHA = String(process.env.GA4_CONVERSION_EVENTS_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.GA4_CONVERSION_EVENTS_CAMPAIGN_ID || "8aa735ee-c02f-41e2-bb1f-7c3f43bb9458").trim();
const PROPERTY_ID = String(process.env.GA4_CONVERSION_EVENTS_PROPERTY_ID || "542352127").trim();
const clerkSecret = String(process.env.CLERK_SECRET_KEY || "").trim();

if (!pool) throw new Error("DATABASE_URL is required");
if (!clerkSecret) throw new Error("CLERK_SECRET_KEY is required");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("GA4_CONVERSION_EVENTS_EXPECTED_SHA must be a full Git SHA");

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const exact = (actual: unknown, expected: unknown, label: string) => {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
};
const hash = (value: unknown) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
const normalizePropertyId = (value: unknown) => String(value || "").replace(/^properties\//, "").trim();
const displayInteger = (value: unknown) => new Intl.NumberFormat("en-US").format(Number(value || 0));
const displayConversion = (value: unknown) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 20 });
const compact = (value: string) => value.replace(/\s+/g, " ").trim();
const clerkPost = async (requestPath: string, body?: unknown) => fetch(`https://api.clerk.com/v1${requestPath}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const api = async (page: Page, requestPath: string) => page.evaluate(async (path) => {
  const token = await (window as any).Clerk?.session?.getToken();
  if (!token) throw new Error("Clerk session token is unavailable");
  const response = await fetch(path, { credentials: "include", headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, ok: response.ok, headers: Object.fromEntries(response.headers.entries()), body };
}, requestPath);

const fingerprint = async (client: any, campaignId: string) => {
  const result = await client.query(`
    SELECT
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM campaigns WHERE id = $1) x) AS campaign,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM ga4_connections WHERE campaign_id = $1) x) AS connections,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM ga4_daily_metrics WHERE campaign_id = $1) x) AS daily,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM linkedin_reports WHERE campaign_id = $1 AND platform_type = 'google_analytics') x) AS reports,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (
        SELECT s.* FROM report_snapshots s JOIN linkedin_reports r ON r.id = s.report_id
        WHERE r.campaign_id = $1 AND r.platform_type = 'google_analytics'
      ) x) AS snapshots,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (
        SELECT e.* FROM report_send_events e JOIN linkedin_reports r ON r.id = e.report_id
        WHERE r.campaign_id = $1 AND r.platform_type = 'google_analytics'
      ) x) AS send_events
  `, [campaignId]);
  return result.rows[0];
};

const client = await pool.connect();
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let sessionId = "";
let signInTokenId = "";
try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const inventory = await client.query(`
    SELECT c.owner_id, c.client_id, c.reporting_time_zone, c.ga4_campaign_filter,
           g.import_start_date, g.property_id
    FROM campaigns c
    JOIN ga4_connections g ON g.campaign_id = c.id
      AND g.property_id = $2 AND g.is_active = true
    WHERE c.id = $1
    LIMIT 1
  `, [CAMPAIGN_ID, PROPERTY_ID]);
  exact(inventory.rowCount, 1, "active campaign/property inventory");
  const record = inventory.rows[0];
  assert(String(record.ga4_campaign_filter || "").trim(), "saved campaign scope is unavailable");
  const expectedWindow = resolveGA4ImportToDateWindow(record.import_start_date, record.reporting_time_zone);
  assert(expectedWindow, "fixed import-to-date window is unavailable");
  const crossOwner = await client.query(`
    SELECT c.id, g.property_id
    FROM campaigns c
    JOIN ga4_connections g ON g.campaign_id = c.id AND g.is_active = true
    WHERE c.owner_id IS DISTINCT FROM $1
    ORDER BY c.id
    LIMIT 1
  `, [record.owner_id]);
  exact(crossOwner.rowCount, 1, "cross-owner isolation fixture");
  const before = await fingerprint(client, CAMPAIGN_ID);

  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  exact(healthResponse.status, 200, "production health status");
  const health: any = await healthResponse.json();
  exact(health.commit, EXPECTED_SHA, "deployed SHA");

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  const tokenResponse = await clerkPost("/sign_in_tokens", { user_id: record.owner_id, expires_in_seconds: 900 });
  const tokenBody: any = await tokenResponse.json().catch(() => ({}));
  assert(tokenResponse.ok && tokenBody?.token, `Clerk sign-in token failed (${tokenResponse.status})`);
  signInTokenId = String(tokenBody.id || "");
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(tokenBody.token))}`, {
    waitUntil: "domcontentloaded", timeout: 60000,
  });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ""));

  const conversionPath = `/api/campaigns/${CAMPAIGN_ID}/ga4-conversion-events?window=import-to-date&propertyId=${encodeURIComponent(PROPERTY_ID)}&limit=50&readOnly=1`;
  const unauthenticated = await fetch(`${BASE_URL}${conversionPath}`, { redirect: "manual" });
  exact(unauthenticated.status, 401, "unauthenticated denial");
  const crossOwnerRecord = crossOwner.rows[0];
  const denied = await api(page, `/api/campaigns/${crossOwnerRecord.id}/ga4-conversion-events?window=import-to-date&propertyId=${encodeURIComponent(String(crossOwnerRecord.property_id))}&limit=50&readOnly=1`);
  exact(denied.status, 404, "cross-owner denial");
  const wrongProperty = await api(page, `/api/campaigns/${CAMPAIGN_ID}/ga4-conversion-events?window=import-to-date&propertyId=999999999999999999&limit=50&readOnly=1`);
  exact(wrongProperty.status, 404, "different-property denial");

  const direct = await api(page, conversionPath);
  assert(direct.status === 200, `Conversion Events API status ${direct.status}: ${JSON.stringify(direct.body)}`);
  exact(direct.headers["x-ga4-validation-read-only"], "1", "read-only response header");
  exact(direct.headers["x-ga4-credential-refresh-allowed"], "0", "credential-refresh response header");
  exact(direct.body?.validationReadOnly, true, "read-only response body");
  exact(normalizePropertyId(direct.body?.propertyId), normalizePropertyId(PROPERTY_ID), "saved property scope");
  exact(direct.body?.startDate, expectedWindow!.startDate, "fixed import start date");
  exact(direct.body?.endDate, expectedWindow!.endDate, "latest completed day");
  const directRows = Array.isArray(direct.body?.rows) ? direct.body.rows : [];
  assert(directRows.length <= 50, "provider response exceeds the API top-50 envelope");
  const directNames = new Set<string>();
  for (const row of directRows) {
    const eventName = String(row?.eventName || "").trim();
    assert(eventName, "invalid empty event name");
    assert(!directNames.has(eventName), "duplicate exact event name");
    directNames.add(eventName);
    assert(Number.isFinite(Number(row?.conversions)) && Number(row.conversions) > 0, "zero or invalid conversion row");
    for (const metric of ["eventCount", "users"] as const) {
      assert(Number.isInteger(Number(row?.[metric])) && Number(row[metric]) >= 0, `invalid ${metric} value`);
    }
  }
  for (let index = 1; index < directRows.length; index += 1) {
    const previous = directRows[index - 1];
    const current = directRows[index];
    assert(Number(previous.conversions) >= Number(current.conversions), "provider rows are not ordered by Conversions descending");
    if (Number(previous.conversions) === Number(current.conversions)) {
      assert(String(previous.eventName).localeCompare(String(current.eventName)) <= 0, "equal-conversion rows are not ordered by Event");
    }
  }
  exact(Number(direct.body?.totals?.conversions), directRows.reduce((sum: number, row: any) => sum + Number(row.conversions), 0), "Conversion total");
  exact(Number(direct.body?.totals?.eventCount), directRows.reduce((sum: number, row: any) => sum + Number(row.eventCount), 0), "Event Count total");
  exact(Number(direct.body?.totals?.users), directRows.reduce((sum: number, row: any) => sum + Number(row.users), 0), "Users row total");

  const mutationRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === new URL(BASE_URL).origin && url.pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      mutationRequests.push(`${request.method()} ${url.pathname}`);
    }
  });
  const uiConversionResponse = page.waitForResponse(
    (response) => response.url().includes(`/api/campaigns/${CAMPAIGN_ID}/ga4-conversion-events?`),
    { timeout: 120000 },
  );
  await page.goto(`${BASE_URL}/campaigns/${CAMPAIGN_ID}/ga4-metrics?tab=overview&readOnly=1`, {
    waitUntil: "domcontentloaded", timeout: 60000,
  });
  const uiResponse = await uiConversionResponse;
  exact(uiResponse.status(), 200, "rendered Conversion Events request status");
  const uiBody: any = await uiResponse.json();
  const uiRows = Array.isArray(uiBody?.rows) ? uiBody.rows : [];
  exact(JSON.stringify(uiRows), JSON.stringify(directRows), "API/rendered request rows");
  const heading = page.locator("h3").filter({ hasText: /^Conversion Events$/ }).first();
  await heading.waitFor({ timeout: 120000 });
  const section = heading.locator("xpath=../..");
  if (uiRows.length === 0) {
    await section.getByText("No conversion event breakdown available yet for this property/campaign selection.", { exact: true }).waitFor({ timeout: 120000 });
    exact(await section.locator("tbody tr").count(), 0, "empty rendered row count");
  } else {
    const headers = (await section.locator("thead th").allTextContents()).map(compact);
    exact(JSON.stringify(headers), JSON.stringify(["Event", "Conversions", "Event Count", "Users"]), "rendered columns");
    const rendered = section.locator("tbody tr");
    exact(await rendered.count(), Math.min(uiRows.length, 25), "rendered top-25 row count");
    for (let index = 0; index < Math.min(uiRows.length, 25); index += 1) {
      const cells = (await rendered.nth(index).locator("td").allTextContents()).map(compact);
      const row = uiRows[index];
      exact(JSON.stringify(cells), JSON.stringify([
        String(row.eventName), displayConversion(row.conversions), displayInteger(row.eventCount), displayInteger(row.users),
      ]), `rendered row ${index + 1}`);
    }
  }

  let injectedFailureRequests = 0;
  const failureRoute = async (route: Route) => {
    injectedFailureRequests += 1;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, error: "INJECTED_READ_ONLY_PROVIDER_FAILURE" }) });
  };
  await page.route(`**/api/campaigns/${CAMPAIGN_ID}/ga4-conversion-events?**`, failureRoute);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("visibilitychange"));
  });
  for (let attempt = 0; attempt < 80 && injectedFailureRequests === 0; attempt += 1) await page.waitForTimeout(250);
  assert(injectedFailureRequests > 0, "focus did not refetch Conversion Events");
  await page.getByText("Some Overview data could not refresh. Last successful values remain visible where available; unavailable values are marked.", { exact: true }).waitFor({ timeout: 30000 });
  if (uiRows.length === 0) {
    await section.getByText("No conversion event breakdown available yet for this property/campaign selection.", { exact: true }).waitFor();
  } else {
    exact(await section.locator("tbody tr").count(), Math.min(uiRows.length, 25), "cached last-good rendered row count");
  }
  await page.unroute(`**/api/campaigns/${CAMPAIGN_ID}/ga4-conversion-events?**`, failureRoute);

  const reloadResponse = page.waitForResponse(
    (response) => response.url().includes(`/api/campaigns/${CAMPAIGN_ID}/ga4-conversion-events?`) && response.status() === 200,
    { timeout: 120000 },
  );
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  const reloadedBody: any = await (await reloadResponse).json();
  exact(JSON.stringify(reloadedBody?.rows || []), JSON.stringify(uiRows), "reload row parity");

  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  await page.getByRole("button", { name: "Create Report", exact: true }).click();
  const reportDialog = page.getByRole("dialog").filter({ hasText: "Report Type" });
  await reportDialog.getByText("Custom Report", { exact: true }).first().click();
  await reportDialog.getByRole("button", { name: "Overview", exact: true }).click();
  await reportDialog.getByLabel("Conversion Events", { exact: true }).check();
  const downloadPromise = page.waitForEvent("download", { timeout: 120000 });
  await reportDialog.getByRole("button", { name: /Generate & Download Report/ }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  assert(stream, "browser PDF download stream is unavailable");
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const parser = new PDFParse({ data: Buffer.concat(chunks) });
  const pdfText = compact((await parser.getText()).text);
  await parser.destroy();
  assert(!/\bREVENUE\b/i.test(pdfText), "Conversion-only browser PDF contains a Revenue column or section");
  if (uiRows.length > 0) {
    for (const value of ["Conversion Events", "EVENT", "CONVERSIONS", "EVENT COUNT", "USERS"]) {
      assert(pdfText.includes(value), `browser PDF is missing ${value}`);
    }
    for (const row of uiRows.slice(0, 25)) {
      for (const value of [
        String(row.eventName), displayConversion(row.conversions), displayInteger(row.eventCount), displayInteger(row.users),
      ]) assert(pdfText.includes(value), "browser PDF is missing a rendered Conversion Events value");
    }
  }

  exact(mutationRequests.length, 0, `application mutation requests (${mutationRequests.join(", ")})`);
  const after = await fingerprint(client, CAMPAIGN_ID);
  exact(JSON.stringify(after), JSON.stringify(before), "application persistence fingerprint");

  console.log(JSON.stringify({
    status: "passed",
    certificationStatus: "validation_output_only",
    deployedSha: health.commit,
    campaignHash: hash(CAMPAIGN_ID),
    clientHash: hash(record.client_id),
    ownerHash: hash(record.owner_id),
    propertyHash: hash(PROPERTY_ID),
    window: expectedWindow,
    providerRows: directRows.length,
    populatedRowAccuracyProven: directRows.length > 0,
    emptyStateProven: directRows.length === 0,
    zeroConversionRowsExcluded: true,
    apiUiBrowserPdfParity: true,
    focusRefetchAndLastGoodState: true,
    reloadRefetch: true,
    accessControl: { unauthenticated: "denied", crossOwner: "denied", differentProperty: "denied" },
    databaseTransaction: "read only and rolled back",
    applicationPersistenceUnchanged: true,
    scheduledPdfBuilder: "not executed against production; actual builder output and shared provider arguments are covered by the local focused fixture",
    reportsCertification: "excluded",
  }, null, 2));
} finally {
  await client.query("ROLLBACK").catch(() => null);
  client.release();
  if (sessionId) await clerkPost(`/sessions/${encodeURIComponent(sessionId)}/revoke`).catch(() => null);
  else if (signInTokenId) await clerkPost(`/sign_in_tokens/${encodeURIComponent(signInTokenId)}/revoke`).catch(() => null);
  await context?.close().catch(() => null);
  await browser?.close().catch(() => null);
  await pool.end().catch(() => null);
}
