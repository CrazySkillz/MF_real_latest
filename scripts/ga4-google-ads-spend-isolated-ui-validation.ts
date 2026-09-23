import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { chromium, type BrowserContext, type Route } from "playwright";
import { pool } from "../server/db";

const BASE_URL = String(process.env.GA4_GOOGLE_ADS_ISOLATED_BASE_URL || "https://marketforensics.onrender.com").replace(/\/$/, "");
const EXPECTED_SHA = String(process.env.GA4_GOOGLE_ADS_ISOLATED_EXPECTED_SHA || "").trim();
const CAMPAIGN_NAME = String(process.env.GA4_GOOGLE_ADS_ISOLATED_CAMPAIGN_NAME || "Campaign3").trim();
const CLERK_SECRET = String(process.env.CLERK_SECRET_KEY || "").trim();
const OUTPUT_DIR = path.resolve("test-results", "google-ads-spend-isolated-ui");
const FIXTURE_SOURCE_ID = "isolated-google-ads-spend-source";
const FIXTURE_CAMPAIGN_ID = "isolated-google-ads-campaign-1";
const FIXTURE_AMOUNT = 5;
const FIXTURE_CURRENCY = "EUR";

if (!pool) throw new Error("DATABASE_URL is required");
if (!CLERK_SECRET) throw new Error("CLERK_SECRET_KEY is required");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("GA4_GOOGLE_ADS_ISOLATED_EXPECTED_SHA must be a full Git SHA");

const hash = (value: unknown) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};
const clerkPost = async (requestPath: string, body?: unknown) => fetch(`https://api.clerk.com/v1${requestPath}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${CLERK_SECRET}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const jsonResponse = (route: Route, body: unknown, status = 200) => route.fulfill({
  status,
  contentType: "application/json",
  headers: { "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

const client = await pool.connect();
let context: BrowserContext | null = null;
let sessionId = "";
let signInTokenId = "";
try {
  await client.query("BEGIN TRANSACTION READ ONLY");

  const healthResponse = await fetch(`${BASE_URL}/api/health`, { headers: { "Cache-Control": "no-store" } });
  const health: any = await healthResponse.json().catch(() => null);
  assert(healthResponse.ok && health?.ok === true, `Production health check failed (${healthResponse.status})`);
  assert(String(health.commit || "") === EXPECTED_SHA, `Expected deployed SHA ${EXPECTED_SHA}, received ${String(health.commit || "missing")}`);

  const campaignResult = await client.query(`
    SELECT c.id::text, c.owner_id, c.currency, c.reporting_time_zone
    FROM campaigns c
    JOIN ga4_connections g ON g.campaign_id = c.id AND g.is_active = true
    JOIN ga4_google_ads_spend_connections a ON a.campaign_id = c.id
    WHERE c.name = $1 AND c.owner_id IS NOT NULL
    ORDER BY c.created_at DESC
    LIMIT 1
  `, [CAMPAIGN_NAME]);
  assert(campaignResult.rowCount === 1, `Could not find one connected ${CAMPAIGN_NAME} campaign`);
  const campaign = campaignResult.rows[0];
  assert(String(campaign.currency || "").toUpperCase() === FIXTURE_CURRENCY, `${CAMPAIGN_NAME} must use ${FIXTURE_CURRENCY}`);

  const databaseFingerprint = async () => {
    const result = await client.query(`
      SELECT
        md5(COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id)::text FROM spend_sources s WHERE s.campaign_id = $1), '[]')) AS sources,
        md5(COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id)::text FROM spend_records r WHERE r.campaign_id = $1), '[]')) AS records
    `, [campaign.id]);
    return result.rows[0];
  };
  const databaseBefore = await databaseFingerprint();

  const browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const appOrigin = new URL(BASE_URL).origin;
  let imported = false;
  let importRequestValidated = false;
  const interceptedReadLikePosts: string[] = [];
  const unexpectedProductionMutations: string[] = [];

  await context.route("**/*", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const method = request.method().toUpperCase();
    const campaignBase = `/api/campaigns/${campaign.id}`;
    const isTargetOrigin = requestUrl.origin === appOrigin;
    const redactedPath = requestUrl.pathname.replace(String(campaign.id), ":campaignId");

    if (isTargetOrigin && method === "GET" && requestUrl.pathname === `${campaignBase}/spend-sources`) {
      return jsonResponse(route, {
        success: true,
        sources: imported ? [{
          id: FIXTURE_SOURCE_ID,
          campaignId: campaign.id,
          sourceType: "ad_platforms",
          displayName: "Google Ads",
          currency: FIXTURE_CURRENCY,
          platformContext: "ga4",
          isActive: true,
          mappingConfig: JSON.stringify({
            platform: "google_ads",
            adAccountName: "Isolated Google Ads fixture",
            selectedCampaignIds: [FIXTURE_CAMPAIGN_ID],
            breakdown: [{ campaignId: FIXTURE_CAMPAIGN_ID, name: "Campaign #1", spend: FIXTURE_AMOUNT, impressions: 100, clicks: 2 }],
          }),
        }] : [],
      });
    }

    if (isTargetOrigin && method === "GET" && requestUrl.pathname === `${campaignBase}/spend-breakdown`) {
      return jsonResponse(route, {
        success: true,
        totalSpend: imported ? FIXTURE_AMOUNT : 0,
        sources: imported ? [{
          sourceId: FIXTURE_SOURCE_ID,
          sourceType: "ad_platforms",
          displayName: "Google Ads",
          currency: FIXTURE_CURRENCY,
          spend: FIXTURE_AMOUNT,
          recordCount: 1,
        }] : [],
        startDate: "1900-01-01",
        endDate: "2026-09-22",
      });
    }

    if (isTargetOrigin && method === "GET" && requestUrl.pathname === `${campaignBase}/spend-to-date`) {
      return jsonResponse(route, {
        success: true,
        spendToDate: imported ? FIXTURE_AMOUNT : 0,
        currency: FIXTURE_CURRENCY,
        startDate: "1900-01-01",
        endDate: "2026-09-22",
        sourceIds: imported ? [FIXTURE_SOURCE_ID] : [],
      });
    }

    if (isTargetOrigin && method === "GET" && requestUrl.pathname === `${campaignBase}/spend-daily`) {
      return jsonResponse(route, {
        success: true,
        date: "2026-09-22",
        totalSpend: imported ? FIXTURE_AMOUNT : 0,
        currency: FIXTURE_CURRENCY,
        sourceIds: imported ? [FIXTURE_SOURCE_ID] : [],
      });
    }

    if (isTargetOrigin && method === "GET" && requestUrl.pathname === `/api/google-ads/${campaign.id}/connection` && requestUrl.searchParams.get("spendPreview") === "1") {
      return jsonResponse(route, {
        success: true,
        connected: true,
        customerId: "isolated-customer",
        customerName: "Isolated Google Ads fixture",
      });
    }

    if (isTargetOrigin && method === "GET" && requestUrl.pathname === `/api/google-ads/${campaign.id}/daily-metrics` && requestUrl.searchParams.get("spendPreview") === "1") {
      return jsonResponse(route, {
        success: true,
        metrics: [{
          googleCampaignId: FIXTURE_CAMPAIGN_ID,
          googleCampaignName: "Campaign #1",
          date: "2026-09-22",
          spend: FIXTURE_AMOUNT.toFixed(2),
          impressions: 100,
          clicks: 2,
        }],
        currency: FIXTURE_CURRENCY,
      });
    }

    if (isTargetOrigin && method === "POST" && requestUrl.pathname === `${campaignBase}/spend/meta/preview`) {
      interceptedReadLikePosts.push(`${method} ${redactedPath}`);
      return jsonResponse(route, { success: true, connected: false });
    }

    if (isTargetOrigin && method === "POST" && requestUrl.pathname === `${campaignBase}/spend/process/manual`) {
      let body: any = null;
      try { body = request.postDataJSON(); } catch { body = null; }
      const selectedIds = Array.isArray(body?.mappingConfig?.selectedCampaignIds) ? body.mappingConfig.selectedCampaignIds.map(String) : [];
      const valid = body?.sourceType === "ad_platforms"
        && body?.platformContext === "ga4"
        && body?.displayName === "Google Ads"
        && body?.currency === FIXTURE_CURRENCY
        && Number(body?.amount) === FIXTURE_AMOUNT
        && body?.mappingConfig?.platform === "google_ads"
        && selectedIds.length === 1
        && selectedIds[0] === FIXTURE_CAMPAIGN_ID;
      if (!valid) {
        return jsonResponse(route, { success: false, error: "Isolated import contract validation failed" }, 400);
      }
      importRequestValidated = true;
      imported = true;
      return jsonResponse(route, {
        success: true,
        sourceId: FIXTURE_SOURCE_ID,
        spendToDate: FIXTURE_AMOUNT,
        currency: FIXTURE_CURRENCY,
      });
    }

    if (isTargetOrigin && requestUrl.pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      unexpectedProductionMutations.push(`${method} ${redactedPath}`);
      return jsonResponse(route, { success: false, error: "Blocked by isolated read-only browser validation" }, 503);
    }

    return route.continue();
  });

  const tokenResponse = await clerkPost("/sign_in_tokens", { user_id: campaign.owner_id, expires_in_seconds: 900 });
  const tokenBody: any = await tokenResponse.json().catch(() => ({}));
  assert(tokenResponse.ok && tokenBody?.token, `Clerk sign-in token failed (${tokenResponse.status})`);
  signInTokenId = String(tokenBody.id || "");
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(tokenBody.token))}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60_000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ""));

  await page.goto(`${BASE_URL}/campaigns/${campaign.id}/ga4-metrics`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByTestId("ga4-add-spend-source").waitFor({ state: "visible", timeout: 60_000 });
  await page.getByTestId("ga4-add-spend-source").click();

  const addSpendDialog = page.locator("[data-add-spend-dialog]");
  await addSpendDialog.getByText("Add spend source", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  await addSpendDialog.locator(".cursor-pointer").filter({ hasText: "Google Ads" }).first().click();
  await addSpendDialog.getByText("Google Ads — Connected", { exact: false }).waitFor({ state: "visible", timeout: 20_000 });
  await addSpendDialog.getByText("Campaign #1", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  await addSpendDialog.getByText("€5.00", { exact: true }).first().waitFor({ state: "visible", timeout: 20_000 });
  await addSpendDialog.getByRole("button", { name: "Import spend", exact: true }).click();
  await addSpendDialog.waitFor({ state: "hidden", timeout: 20_000 });

  assert(importRequestValidated, "The UI did not submit the expected Google Ads Spend import contract");
  assert(unexpectedProductionMutations.length === 0, `Unexpected application mutations were attempted: ${unexpectedProductionMutations.join(", ")}`);

  const totalSpendLabel = page.getByText("Total Spend", { exact: true }).filter({ visible: true }).first();
  await totalSpendLabel.waitFor({ state: "visible", timeout: 20_000 });
  const totalSpendCard = totalSpendLabel.locator("..").locator("..");
  await totalSpendCard.getByText("€5.00", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  await totalSpendCard.getByRole("button", { name: "Sources (1)", exact: true }).waitFor({ state: "visible", timeout: 20_000 });

  await mkdir(OUTPUT_DIR, { recursive: true });
  await page.evaluate(() => {
    const banner = document.createElement("div");
    banner.id = "isolated-test-evidence-banner";
    banner.textContent = "ISOLATED TEST — €5 SAMPLE GOOGLE ADS SPEND — NOT PRODUCTION DATA";
    Object.assign(banner.style, {
      position: "fixed", top: "0", left: "0", right: "0", zIndex: "2147483647",
      padding: "10px", textAlign: "center", background: "#7c2d12", color: "white",
      font: "700 16px/1.2 system-ui, sans-serif", letterSpacing: "0.02em",
    });
    document.body.appendChild(banner);
  });
  const totalSpendScreenshot = path.join(OUTPUT_DIR, "total-spend-eur-5.png");
  await page.screenshot({ path: totalSpendScreenshot, fullPage: true });

  await totalSpendCard.getByRole("button", { name: "Sources (1)", exact: true }).click();
  const spendSourcesDialog = page.locator("[data-spend-sources-dialog]");
  await spendSourcesDialog.getByText("Spend Sources", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  await spendSourcesDialog.getByText("Google Ads", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  await spendSourcesDialog.getByText("€5.00", { exact: true }).waitFor({ state: "visible", timeout: 20_000 });
  await spendSourcesDialog.evaluate((dialog) => {
    const label = document.createElement("div");
    label.textContent = "ISOLATED €5 TEST — NOT PRODUCTION DATA";
    Object.assign(label.style, {
      margin: "0 28px 8px 0", padding: "8px", borderRadius: "6px", textAlign: "center",
      background: "#7c2d12", color: "white", font: "700 12px/1.2 system-ui, sans-serif",
    });
    dialog.prepend(label);
  });
  const spendSourcesScreenshot = path.join(OUTPUT_DIR, "spend-sources-google-ads-eur-5.png");
  await page.screenshot({ path: spendSourcesScreenshot, fullPage: true });

  const databaseAfter = await databaseFingerprint();
  assert(databaseAfter.sources === databaseBefore.sources, "Production Spend sources changed during isolated validation");
  assert(databaseAfter.records === databaseBefore.records, "Production Spend records changed during isolated validation");

  const result = {
    status: "passed",
    certificationStatus: "development_evidence_only",
    deployedSha: EXPECTED_SHA,
    campaignHash: hash(campaign.id),
    fixture: { source: "Google Ads", amount: FIXTURE_AMOUNT, currency: FIXTURE_CURRENCY, campaign: "Campaign #1" },
    importRequestValidated,
    totalSpendUiVerified: true,
    spendSourceUiVerified: true,
    unexpectedProductionMutations,
    interceptedReadLikePosts,
    productionSpendDatabaseUnchanged: true,
    screenshots: [totalSpendScreenshot, spendSourcesScreenshot],
  };
  await writeFile(path.join(OUTPUT_DIR, "result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
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
