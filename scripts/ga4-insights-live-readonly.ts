import { createHash, randomBytes } from "node:crypto";
import { chromium, type Page } from "playwright";
import { pool } from "../server/db";
import { addGA4InsightsDateDays, areGA4InsightsMonthsAdjacent, assertGA4InsightsFinancialCurrencyScope, buildGA4InsightsCalendarRollup, buildGA4InsightsHistoryScopeMarker, buildGA4InsightsMonthlySeries, buildGA4InsightsRollups, buildGA4InsightsSpendSourceLabels, calculateGA4InsightsDeltaPct, normalizeGA4InsightsDailyRows } from "../shared/ga4-insights";
import { getReportingDateWindow } from "../server/utils/reporting-timezone";

const BASE_URL = process.env.GA4_INSIGHTS_BASE_URL || "https://marketforensics.onrender.com";
const EXPECTED_SHA = String(process.env.GA4_INSIGHTS_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.GA4_INSIGHTS_CAMPAIGN_ID || "8aa735ee-c02f-41e2-bb1f-7c3f43bb9458").trim();
const requestedProperty = String(process.env.GA4_INSIGHTS_PROPERTY_ID || "").trim();
const clerkSecret = String(process.env.CLERK_SECRET_KEY || "").trim();
const requireTenantIsolation = String(process.env.GA4_INSIGHTS_REQUIRE_TENANT_ISOLATION || "1") !== "0";
const allowTemporaryUser = String(process.env.GA4_INSIGHTS_ALLOW_TEMPORARY_USER || "0") === "1";
const authorizedNonOwnerUserId = String(process.env.GA4_INSIGHTS_NONOWNER_USER_ID || "").trim();

if (!pool) throw new Error("DATABASE_URL is required");
if (!clerkSecret) throw new Error("CLERK_SECRET_KEY is required");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("GA4_INSIGHTS_EXPECTED_SHA must be a full Git SHA");

const normalizeProperty = (value: unknown) => String(value || "").replace(/^properties\//, "").trim();
const normalizeCampaign = (value: unknown) => String(value || "").trim().toLowerCase();
const hash = (value: unknown) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
const normalizeText = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();
const assertIncludes = (actual: unknown, expected: unknown, label: string) => {
  if (!normalizeText(actual).includes(normalizeText(expected))) {
    throw new Error(label + " parity failed (expected " + JSON.stringify(normalizeText(expected)) + "; actual " + JSON.stringify(normalizeText(actual)) + ")");
  }
};
const formatNumber = (value: unknown) => new Intl.NumberFormat("en-US").format(Number(value || 0));
const formatMoney = (value: unknown, currency: string) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0));
const formatPct = (value: unknown) => {
  const rounded = Math.round(Number(value || 0) * 10) / 10;
  return (rounded === Math.floor(rounded) ? String(Math.round(rounded)) : rounded.toFixed(1)) + "%";
};
const formatDelta = (current: number, previous: number) => {
  const delta = calculateGA4InsightsDeltaPct(current, previous);
  return (delta >= 0 ? "+" : "") + delta.toFixed(1) + "%";
};
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
const request = async (page: Page, path: string, method = "GET", body?: unknown) => page.evaluate(async ({ path, method, body }) => {
  const token = await (window as any).Clerk?.session?.getToken();
  if (!token) throw new Error("Clerk session token is unavailable");
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let parsedBody: any = null;
  try { parsedBody = text ? JSON.parse(text) : null; } catch { parsedBody = text; }
  return { ok: response.ok, status: response.status, body: parsedBody };
}, { path, method, body });

const readPersistenceFingerprint = async (client: any, campaignId: string) => {
  const result = await client.query(`
    SELECT
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM campaigns WHERE id = $1) x) AS campaign,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT cl.* FROM clients cl JOIN campaigns c ON c.client_id = cl.id WHERE c.id = $1) x) AS client,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM ga4_connections WHERE campaign_id = $1) x) AS connections,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM ga4_daily_metrics WHERE campaign_id = $1) x) AS daily,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM google_ads_connections WHERE campaign_id = $1) x) AS google_ads_connections,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM google_ads_daily_metrics WHERE campaign_id = $1) x) AS google_ads_daily,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT id, campaign_id, source_type, platform_context, display_name, currency, is_active, connected_at, created_at FROM revenue_sources WHERE campaign_id = $1) x) AS revenue_sources,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.revenue_source_id, x.date, x.revenue, x.external_id)::text, '[]')) FROM (SELECT campaign_id, revenue_source_id, date, revenue, currency, external_id, source_type, sub_campaign_urn FROM revenue_records WHERE campaign_id = $1) x) AS revenue_records,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT id, campaign_id, source_type, platform_context, display_name, currency, is_active, connected_at, created_at FROM spend_sources WHERE campaign_id = $1) x) AS spend_sources,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.spend_source_id, x.date, x.spend, x.sub_campaign_urn)::text, '[]')) FROM (SELECT campaign_id, spend_source_id, date, spend, currency, source_type, sub_campaign_urn FROM spend_records WHERE campaign_id = $1) x) AS spend_records,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) - 'updated_at' ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM kpis WHERE campaign_id = $1 AND platform_type = 'google_analytics') x) AS kpis,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT kp.* FROM kpi_progress kp JOIN kpis k ON k.id = kp.kpi_id WHERE k.campaign_id = $1 AND k.platform_type = 'google_analytics') x) AS kpi_progress,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) - 'updated_at' - 'last_updated' ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM benchmarks WHERE campaign_id = $1 AND platform_type = 'google_analytics') x) AS benchmarks,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT bh.* FROM benchmark_history bh JOIN benchmarks b ON b.id = bh.benchmark_id WHERE b.campaign_id = $1 AND b.platform_type = 'google_analytics') x) AS benchmark_history
  `, [campaignId]);
  return result.rows[0] || {};
};

const client = await pool.connect();
const browser = await chromium.launch({ headless: true });
const sessions: string[] = [];
let temporaryUserId = "";
let output: Record<string, unknown> | null = null;
try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const inventory = await client.query(`
    SELECT c.owner_id, c.client_id, cl.owner_id AS client_owner_id,
           c.reporting_time_zone, c.ga4_campaign_filter, c.currency,
           g.property_id, g.display_name, g.property_name
    FROM campaigns c
    LEFT JOIN clients cl ON cl.id = c.client_id
    JOIN ga4_connections g ON g.campaign_id = c.id AND g.is_active = true
    WHERE c.id = $1
      AND ($2 = '' OR REPLACE(g.property_id, 'properties/', '') = REPLACE($2, 'properties/', ''))
    ORDER BY g.is_primary DESC
    LIMIT 1
  `, [CAMPAIGN_ID, requestedProperty]);
  if (inventory.rowCount !== 1) throw new Error("Exact active campaign/property inventory row was not found");
  const row = inventory.rows[0];
  if (!row.client_id || String(row.client_owner_id || "") !== String(row.owner_id || "")) {
    throw new Error("Campaign client scope is missing or belongs to another tenant");
  }
  const propertyId = String(row.property_id);
  const currency = String(row.currency || "USD").trim().toUpperCase();
  const filters = parseFilter(row.ga4_campaign_filter);
  const expected60 = getReportingDateWindow(60, row.reporting_time_zone);
  const expected30 = getReportingDateWindow(30, row.reporting_time_zone);
  const persistenceFingerprintBefore = await readPersistenceFingerprint(client, CAMPAIGN_ID);

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
  const [ga4OAuthConfig, sheetsOAuthConfig] = await Promise.all([
    request(owner.page, "/api/auth/google/url", "POST", { campaignId: CAMPAIGN_ID }),
    request(owner.page, "/api/auth/google-sheets/connect", "POST", { campaignId: CAMPAIGN_ID, purpose: "revenue" }),
  ]);
  if (!ga4OAuthConfig.ok || !sheetsOAuthConfig.ok) throw new Error("Production Google OAuth configuration validation failed");
  const ga4OAuthUrl = new URL(String(ga4OAuthConfig.body?.oauth_url || ""));
  const sheetsOAuthUrl = new URL(String(sheetsOAuthConfig.body?.authUrl || ""));
  const ga4State = String(ga4OAuthUrl.searchParams.get("state") || "");
  const sheetsState = String(sheetsOAuthUrl.searchParams.get("state") || "");
  if (ga4State.split(".").length !== 2 || !sheetsState.startsWith("sheets:") || sheetsState.slice(7).split(".").length !== 2) {
    throw new Error("Production OAuth state is not signed");
  }
  if (!ga4OAuthUrl.searchParams.get("client_id") || !sheetsOAuthUrl.searchParams.get("client_id")) {
    throw new Error("Production Google OAuth client ID is unavailable");
  }
  const paths = {
    campaign: `/api/campaigns/${CAMPAIGN_ID}`,
    clients: "/api/clients",
    connectionStatus: `/api/ga4/check-connection/${CAMPAIGN_ID}?readOnly=1`,
    connections: `/api/campaigns/${CAMPAIGN_ID}/ga4-connections?readOnly=1`,
    overviewDaily: `/api/campaigns/${CAMPAIGN_ID}/ga4-daily?days=30&propertyId=${encodeURIComponent(propertyId)}&readOnly=1`,
    daily: `/api/campaigns/${CAMPAIGN_ID}/ga4-daily?days=60&propertyId=${encodeURIComponent(propertyId)}&readOnly=1`,
    breakdown: `/api/campaigns/${CAMPAIGN_ID}/ga4-breakdown?dateRange=30days&propertyId=${encodeURIComponent(propertyId)}&readOnly=1`,
    toDate: `/api/campaigns/${CAMPAIGN_ID}/ga4-to-date?propertyId=${encodeURIComponent(propertyId)}&readOnly=1`,
    revenue: `/api/campaigns/${CAMPAIGN_ID}/revenue-to-date`,
    spend: `/api/campaigns/${CAMPAIGN_ID}/spend-to-date?platformContext=ga4`,
    revenueSources: `/api/campaigns/${CAMPAIGN_ID}/revenue-sources`,
    revenueBreakdown: `/api/campaigns/${CAMPAIGN_ID}/revenue-breakdown`,
    spendSources: `/api/campaigns/${CAMPAIGN_ID}/spend-sources?platformContext=ga4`,
    spendBreakdown: `/api/campaigns/${CAMPAIGN_ID}/spend-breakdown?platformContext=ga4`,
    kpis: `/api/platforms/google_analytics/kpis?campaignId=${CAMPAIGN_ID}`,
    benchmarks: `/api/platforms/google_analytics/benchmarks?campaignId=${CAMPAIGN_ID}`,
  };
  const entries = await Promise.all(Object.entries(paths).map(async ([name, path]) => [name, await request(owner.page, path)] as const));
  const responses = Object.fromEntries(entries) as Record<string, any>;
  for (const [name, response] of entries) {
    if (!response.ok) {
      const reason = String(response.body?.error || response.body?.message || "no API reason returned").slice(0, 300);
      throw new Error(`${name} endpoint failed (${response.status}): ${reason}`);
    }
  }
  const assertCampaignResponseScope = (campaignResponse: any) => {
    if (String(campaignResponse?.id || "") !== CAMPAIGN_ID || String(campaignResponse?.clientId || "") !== String(row.client_id)) {
      throw new Error("Campaign/client response scope parity failed");
    }
    if (String(campaignResponse?.currency || "USD").trim().toUpperCase() !== currency) throw new Error("Campaign response currency parity failed");
    if (getReportingDateWindow(1, campaignResponse?.reportingTimeZone).reportingTimeZone !== expected60.reportingTimeZone) throw new Error("Campaign response timezone parity failed");
    if (JSON.stringify(parseFilter(campaignResponse?.ga4CampaignFilter).map(normalizeCampaign).sort()) !== JSON.stringify(filters.map(normalizeCampaign).sort())) {
      throw new Error("Campaign response saved-filter parity failed");
    }
  };
  assertCampaignResponseScope(responses.campaign.body || {});
  const expectedClient = (Array.isArray(responses.clients.body) ? responses.clients.body : []).find((item: any) => String(item?.id || "") === String(row.client_id));
  if (!expectedClient?.name) throw new Error("Campaign client is absent from the authenticated client response");
  for (const name of ["connectionStatus", "connections", "overviewDaily", "daily", "breakdown", "toDate"]) {
    if (responses[name]?.body?.validationReadOnly !== true) throw new Error(`${name} did not confirm read-only mode`);
  }

  for (const response of [responses.overviewDaily.body, responses.daily.body, responses.breakdown.body, responses.toDate.body]) {
    if (normalizeProperty(response?.propertyId) !== normalizeProperty(propertyId)) throw new Error("Property parity failed");
  }
  if (responses.daily.body?.startDate !== expected60.startDate || responses.daily.body?.endDate !== expected60.endDate) throw new Error("60-day window parity failed");
  if (responses.overviewDaily.body?.startDate !== expected30.startDate || responses.overviewDaily.body?.endDate !== expected30.endDate) throw new Error("30-day overview window parity failed");
  if (responses.breakdown.body?.startDate !== expected30.startDate || responses.breakdown.body?.endDate !== expected30.endDate) throw new Error("30-day breakdown window parity failed");
  if (responses.toDate.body?.endDate !== expected60.endDate) throw new Error("to-date completed-day cutoff parity failed");

  const expectedFilterSet = new Set(filters.map(normalizeCampaign));
  const outsideScope = (Array.isArray(responses.breakdown.body?.rows) ? responses.breakdown.body.rows : [])
    .map((item: any) => normalizeCampaign(item?.campaign))
    .filter((campaign: string) => expectedFilterSet.size > 0 && campaign && !expectedFilterSet.has(campaign));
  if (outsideScope.length > 0) throw new Error("Breakdown returned campaigns outside the saved filter");

  const rollups = buildGA4InsightsRollups(responses.daily.body?.data, responses.daily.body?.dataThroughDate);
  const pageInputPromises = Object.entries(paths).map(async ([name, path]) => {
    const expected = new URL(path, BASE_URL);
    const response = await owner.page.waitForResponse((candidate) => {
      const actual = new URL(candidate.url());
      if (actual.pathname !== expected.pathname) return false;
      for (const [key, value] of expected.searchParams) if (actual.searchParams.get(key) !== value) return false;
      if (name === "daily") return actual.searchParams.get("days") === "60";
      if (name === "overviewDaily") return actual.searchParams.get("days") === "30";
      if (name === "breakdown") return actual.searchParams.get("dateRange") === "30days";
      return true;
    }, { timeout: 120000 });
    return [name, response] as const;
  });
  const analyticsRequests = [
    ...(Array.isArray(responses.kpis.body) ? responses.kpis.body : [])
      .filter((item: any) => String(item?.id || "").trim())
      .map((item: any) => ({ kind: "KPI", id: String(item.id), path: `/api/kpis/${encodeURIComponent(String(item.id))}/analytics`, collection: "progress" })),
    ...(Array.isArray(responses.benchmarks.body) ? responses.benchmarks.body : [])
      .filter((item: any) => String(item?.id || "").trim())
      .map((item: any) => ({ kind: "Benchmark", id: String(item.id), path: `/api/benchmarks/${encodeURIComponent(String(item.id))}/analytics`, collection: "history" })),
  ];
  const analyticsResponsePromises = analyticsRequests.map(async (requestSpec) => {
    const response = await owner.page.waitForResponse((candidate) => {
      const actual = new URL(candidate.url());
      return actual.pathname === requestSpec.path &&
        actual.searchParams.get("ga4Scope") === "1" &&
        normalizeProperty(actual.searchParams.get("propertyId")) === normalizeProperty(propertyId) &&
        (requestSpec.kind !== "KPI" || actual.searchParams.get("timeframe") === "30d");
    }, { timeout: 120000 });
    return { requestSpec, response };
  });
  await owner.page.goto(`${BASE_URL}/campaigns/${CAMPAIGN_ID}/ga4-metrics?tab=insights&readOnly=1`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const pageInputEntries = await Promise.all(pageInputPromises);
  for (const [name, response] of pageInputEntries) {
    if (!response.ok()) throw new Error("Live-page " + name + " request failed (" + response.status() + ")");
    responses[name] = { ok: true, status: response.status(), body: await response.json() };
  }
  assertCampaignResponseScope(responses.campaign.body || {});
  const uiClient = (Array.isArray(responses.clients.body) ? responses.clients.body : []).find((item: any) => String(item?.id || "") === String(row.client_id));
  if (String(uiClient?.name || "") !== String(expectedClient.name)) throw new Error("Live-page client response parity failed");
  const analyticsResponses = await Promise.all(analyticsResponsePromises);
  const historyScopeMarker = buildGA4InsightsHistoryScopeMarker(propertyId, filters, row.reporting_time_zone, currency);
  for (const { requestSpec, response } of analyticsResponses) {
    if (!response.ok()) throw new Error("Live-page analytics request failed (" + response.status() + ")");
    const body: any = await response.json();
    const points = Array.isArray(body?.[requestSpec.collection]) ? body[requestSpec.collection] : [];
    if (points.some((point: any) => !String(point?.notes || "").includes(historyScopeMarker))) {
      throw new Error(requestSpec.kind + " analytics history escaped the selected property/filter/timezone/currency scope");
    }
  }
  const uiDailyBody: any = responses.daily.body;
  const uiOverviewDailyBody: any = responses.overviewDaily.body;
  if (normalizeProperty(uiDailyBody?.propertyId) !== normalizeProperty(propertyId)) throw new Error("Live-page property parity failed");
  if (uiDailyBody?.providerRefreshAttempted !== false) throw new Error("Live-page read-only parity triggered a daily provider refresh");
  if (uiDailyBody?.startDate !== expected60.startDate || uiDailyBody?.endDate !== expected60.endDate) throw new Error("Live-page 60-day window parity failed");
  if (normalizeProperty(uiOverviewDailyBody?.propertyId) !== normalizeProperty(propertyId)) throw new Error("Live-page 30-day property parity failed");
  if (uiOverviewDailyBody?.providerRefreshAttempted !== false) throw new Error("Live-page 30-day read-only parity triggered a provider refresh");
  if (uiOverviewDailyBody?.startDate !== expected30.startDate || uiOverviewDailyBody?.endDate !== expected30.endDate) throw new Error("Live-page 30-day window parity failed");
  const uiRollups = buildGA4InsightsRollups(uiDailyBody?.data, uiDailyBody?.dataThroughDate);
  await owner.page.getByRole("heading", { name: "Insights", exact: true }).waitFor({ timeout: 120000 });
  await owner.page.getByText("Executive Financials", { exact: true }).waitFor({ timeout: 120000 });
  await owner.page.getByText("Data Summary", { exact: true }).waitFor({ timeout: 120000 });
  await owner.page.getByTestId("insights-summary-sessions").waitFor({ timeout: 120000 });
  await owner.page.waitForFunction(() => [
    "insights-financial-spend", "insights-financial-revenue", "insights-financial-profit",
    "insights-financial-roas", "insights-financial-roi", "insights-data-summary",
  ].every((testId) => {
    const element = document.querySelector(`[data-testid="${testId}"]`);
    return element && !String(element.textContent || "").includes("Loading...");
  }), undefined, { timeout: 120000 });
  const bodyText = await owner.page.locator("body").innerText();
  for (const required of ["Completed-day cutoff", "Latest imported day", "Reporting timezone", "What to investigate next"]) {
    if (!bodyText.includes(required)) throw new Error(`Live Insights text missing: ${required}`);
  }

  const cardText = async (testId: string) => normalizeText(await owner.page.getByTestId(testId).innerText());
  assertIncludes(await cardText("insights-scope-client"), String(expectedClient.name), "scope client");
  assertIncludes(await cardText("insights-scope-campaign"), String(responses.campaign.body?.name || ""), "scope campaign");
  assertIncludes(await cardText("insights-scope-property"), String(propertyId), "scope property");
  assertIncludes(await cardText("insights-scope-filter"), filters.length > 0 ? filters.join(", ") : "All campaigns", "scope saved filter");
  const freshnessWarning = owner.page.getByTestId("ga4-overview-freshness-warning");
  if (uiOverviewDailyBody?.refreshIsStale === true) {
    if (await freshnessWarning.count() !== 1) throw new Error("Shared daily freshness warning is missing");
    const warningText = normalizeText(await freshnessWarning.innerText());
    assertIncludes(warningText, uiOverviewDailyBody?.providerRefreshWarning ? "latest GA4 provider refresh did not complete" : "GA4 daily data is delayed", "shared freshness reason");
    assertIncludes(warningText, String(uiOverviewDailyBody?.latestStoredDailyDate || "No stored daily values"), "shared freshness coverage");
  } else if (await freshnessWarning.count() !== 0) {
    throw new Error("Shared daily freshness warning rendered for a current response");
  }
  const toDateTotals = responses.toDate.body?.totals || {};
  const revenueDefinitions = Array.isArray(responses.revenueSources.body?.sources) ? responses.revenueSources.body.sources : [];
  const spendDefinitions = Array.isArray(responses.spendSources.body?.sources) ? responses.spendSources.body.sources : [];
  const revenueBreakdownSources = Array.isArray(responses.revenueBreakdown.body?.sources) ? responses.revenueBreakdown.body.sources : [];
  const spendBreakdownSources = Array.isArray(responses.spendBreakdown.body?.sources) ? responses.spendBreakdown.body.sources : [];
  const ga4Revenue = Number(toDateTotals.revenue || 0);
  const importedRevenue = Number(responses.revenue.body?.totalRevenue || 0);
  const ga4RevenueMetric = String(responses.toDate.body?.revenueMetric || "").trim();
  const ga4HasRevenueMetric = Boolean(ga4RevenueMetric) || ga4Revenue !== 0;
  const responseTimeZone = String(responses.toDate.body?.reportingTimeZone || "").trim();
  const responseCurrency = String(responses.toDate.body?.currencyCode || "").trim().toUpperCase();
  if (!responseTimeZone || responseTimeZone !== expected60.reportingTimeZone) {
    throw new Error(`GA4 report/campaign timezone mismatch (${responseTimeZone || "missing"} vs ${expected60.reportingTimeZone})`);
  }
  if (ga4HasRevenueMetric && (!responseCurrency || responseCurrency !== currency)) {
    throw new Error(`GA4 native revenue response currency mismatch (${responseCurrency || "missing"} vs ${currency})`);
  }
  const assertSourceCurrencies = (definitions: any[], breakdown: any[], kind: string) => {
    for (const definition of definitions.filter((item: any) => item?.isActive !== false)) {
      const detail = breakdown.find((item: any) => String(item?.sourceId || "") === String(definition?.id || ""));
      const sourceCurrency = String(definition?.currency || detail?.currency || "").trim().toUpperCase();
      if (!sourceCurrency) throw new Error(`${kind} source currency is unavailable`);
      if (sourceCurrency !== currency) throw new Error(`${kind} source currency mismatch (${sourceCurrency} vs ${currency})`);
    }
  };
  assertSourceCurrencies(revenueDefinitions, revenueBreakdownSources, "Revenue");
  assertSourceCurrencies(spendDefinitions, spendBreakdownSources, "Spend");
  assertGA4InsightsFinancialCurrencyScope({ currency }, revenueDefinitions, responses.revenue.body?.currency, "Imported revenue");
  assertGA4InsightsFinancialCurrencyScope({ currency }, spendDefinitions, responses.spend.body?.currency, "Spend");
  const activeGoogleAdsSources = spendDefinitions.filter((source: any) => {
    if (source?.isActive === false || String(source?.sourceType || "") !== "ad_platforms") return false;
    try {
      const mapping = typeof source?.mappingConfig === "string" ? JSON.parse(source.mappingConfig) : source?.mappingConfig || {};
      return String(mapping?.platform || "").toLowerCase() === "google_ads";
    } catch { return false; }
  });
  if (activeGoogleAdsSources.length > 0) {
    throw new Error("Google Ads spend is active outside the current GA4 Insights release boundary");
  }
  const googleAdsProviderScope = { active: false, releaseBoundary: "excluded" };
  const sourceToDateEnd = expected60.dataThroughDate;
  if (responses.revenue.body?.startDate !== "1900-01-01" || responses.revenue.body?.endDate !== sourceToDateEnd) {
    throw new Error("Imported revenue source-to-date window parity failed");
  }
  if (responses.spend.body?.startDate !== "1900-01-01" || responses.spend.body?.endDate !== sourceToDateEnd) {
    throw new Error("Spend source-to-date window parity failed");
  }
  const revenueMetricAvailable = revenueDefinitions.length > 0 || ga4HasRevenueMetric;
  const spendSourceIds = Array.isArray(responses.spend.body?.sourceIds) ? responses.spend.body.sourceIds.map(String) : [];
  const spendMetricAvailable = spendDefinitions.length > 0 || spendSourceIds.length > 0;
  const hasSpendDisplaySources = spendBreakdownSources.length > 0 || spendDefinitions.some((source: any) => source?.isActive !== false);
  const financialRevenue = ga4Revenue + importedRevenue;
  const financialSpend = hasSpendDisplaySources
    ? Number(responses.spendBreakdown.body?.totalSpend ?? responses.spend.body?.spendToDate ?? 0)
    : 0;
  const financialConversions = Number(toDateTotals.conversions || 0);
  const financialProfit = financialRevenue - financialSpend;
  const financialRoas = financialSpend > 0 ? financialRevenue / financialSpend : 0;
  const financialRoi = financialSpend > 0 ? ((financialRevenue - financialSpend) / financialSpend) * 100 : 0;
  const financialCpa = financialSpend > 0 && financialConversions > 0 ? financialSpend / financialConversions : 0;
  const financialRevenueAvailable = revenueMetricAvailable;
  const financialSpendAvailable = spendMetricAvailable;
  const expectedFinancialValues: Record<string, string> = {
    "insights-financial-spend": financialSpendAvailable ? formatMoney(financialSpend, currency) : (spendMetricAvailable ? "Unavailable" : "Not connected"),
    "insights-financial-revenue": financialRevenueAvailable ? formatMoney(financialRevenue, currency) : (revenueMetricAvailable ? "Unavailable" : "Not connected"),
    "insights-financial-profit": financialRevenueAvailable && financialSpendAvailable ? formatMoney(financialProfit, currency) : "Unavailable",
    "insights-financial-roas": financialRevenueAvailable && financialSpendAvailable && financialSpend > 0 ? financialRoas.toFixed(2) + "x" : (financialSpendAvailable && financialSpend <= 0 ? "\u2014" : "Unavailable"),
    "insights-financial-roi": financialRevenueAvailable && financialSpendAvailable && financialSpend > 0 ? financialRoi.toFixed(1) + "%" : (financialSpendAvailable && financialSpend <= 0 ? "\u2014" : "Unavailable"),
  };
  for (const [testId, expected] of Object.entries(expectedFinancialValues)) {
    assertIncludes(await cardText(testId), expected, testId);
  }

  const spendLabels = buildGA4InsightsSpendSourceLabels(
    Number(responses.spend.body?.spendToDate || 0),
    spendSourceIds,
    spendDefinitions,
  );
  const revenueTypeLabel = (type: unknown) => ({
    manual: "Manual", csv: "CSV", google_sheets: "Google Sheets", hubspot: "HubSpot",
    salesforce: "Salesforce", shopify: "Shopify", ga4: "GA4 Revenue", custom: "Custom",
  } as Record<string, string>)[String(type || "")] || String(type || "") || "Revenue";
  const revenueDisplaySources: any[] = revenueBreakdownSources.length > 0
    ? [...revenueBreakdownSources, ...revenueDefinitions.filter((definition: any) =>
        definition?.isActive !== false && !revenueBreakdownSources.some((source: any) => String(source?.sourceId) === String(definition?.id))
      )]
    : revenueDefinitions.filter((definition: any) => definition?.isActive !== false);
  const importedRevenueSourceIds = new Set(
    (Array.isArray(responses.revenue.body?.sourceIds) ? responses.revenue.body.sourceIds : []).map(String),
  );
  const revenueProvenanceSources = importedRevenueSourceIds.size > 0
    ? revenueDisplaySources.filter((source: any) => importedRevenueSourceIds.has(String(source?.sourceId || source?.id || "")))
    : importedRevenue === 0 ? revenueDisplaySources : [];
  const revenueLabels = revenueProvenanceSources.map((source: any) => {
    return String(source?.displayName || revenueTypeLabel(source?.sourceType)).trim() || "Revenue";
  });
  if (ga4HasRevenueMetric) revenueLabels.unshift("GA4 native revenue");
  const sourcesText = await cardText("insights-financial-sources");
  assertIncludes(sourcesText, "Spend: " + (spendLabels.length > 0 ? spendLabels.join(", ") : "Not connected"), "spend provenance");
  assertIncludes(sourcesText, "Revenue: " + (revenueLabels.length > 0 ? Array.from(new Set(revenueLabels)).join(", ") : "Not connected"), "revenue provenance");
  const financialWindows = [
    ...(ga4HasRevenueMetric ? [`GA4 native revenue ${String(responses.toDate.body?.startDate)} to ${String(responses.toDate.body?.endDate)} completed days`] : []),
    ...(revenueDisplaySources.length > 0 ? [`imported revenue source-to-date through completed ${expected60.reportingTimeZone.split("/").pop()?.replace(/_/g, " ")} day ${String(responses.revenue.body?.endDate)}`] : []),
    ...(hasSpendDisplaySources ? [`spend source-to-date through completed ${expected60.reportingTimeZone.split("/").pop()?.replace(/_/g, " ")} day ${String(responses.spend.body?.endDate)}`] : []),
  ];
  const financialWindowDescription = financialWindows.length > 0 ? financialWindows.join("; ") + "." : "";
  if (financialWindowDescription) assertIncludes(sourcesText, "Windows: " + financialWindowDescription, "financial window provenance");

  const summaryText = await cardText("insights-data-summary");
  assertIncludes(summaryText, String(uiRollups.last30.startDate), "summary start date");
  assertIncludes(summaryText, String(uiRollups.last30.endDate), "summary end date");
  assertIncludes(summaryText, uiRollups.last30.days + "/" + uiRollups.last30.expectedDays + " imported days", "summary completeness");
  if (financialWindowDescription) assertIncludes(summaryText, financialWindowDescription, "summary financial windows");
  assertIncludes(await cardText("insights-summary-sessions"), formatNumber(uiRollups.last30.sessions), "summary sessions");
  assertIncludes(
    await cardText("insights-summary-sessions"),
    uiRollups.last30.complete
      ? "Exact completed-day window"
      : `Partial: ${uiRollups.last30.days}/${uiRollups.last30.expectedDays} imported days; missing days excluded`,
    "summary traffic completeness",
  );
  assertIncludes(await cardText("insights-summary-conversions"), formatNumber(uiRollups.last30.conversions), "summary conversions");
  assertIncludes(
    await cardText("insights-summary-conversions"),
    uiRollups.last30.sessions > 0 ? formatPct((uiRollups.last30.conversions / uiRollups.last30.sessions) * 100) + " conversion rate" : "Valid zero sessions",
    "summary conversion rate",
  );
  if (financialRevenueAvailable) assertIncludes(await cardText("insights-summary-revenue"), formatMoney(financialRevenue, currency), "summary revenue");
  if (financialSpendAvailable) {
    assertIncludes(await cardText("insights-summary-spend"), formatMoney(financialSpend, currency), "summary spend");
    if (financialRevenueAvailable) {
      assertIncludes(await cardText("insights-summary-profit"), formatMoney(financialProfit, currency), "summary profit");
      assertIncludes(await cardText("insights-summary-roas"), financialSpend > 0 ? financialRoas.toFixed(2) + "x" : "\u2014", "summary ROAS");
    }
    assertIncludes(await cardText("insights-summary-cpa"), financialSpend > 0 && financialConversions > 0 ? formatMoney(financialCpa, currency) : "\u2014", "summary CPA");
  }

  const channelMap = new Map<string, { label: string; sessions: number; conversions: number; revenue: number }>();
  for (const sourceRow of Array.isArray(responses.breakdown.body?.rows) ? responses.breakdown.body.rows : []) {
    const source = String(sourceRow?.source || "(direct)").trim();
    const medium = String(sourceRow?.medium || "(none)").trim();
    const label = source + " / " + medium;
    const value = channelMap.get(label) || { label, sessions: 0, conversions: 0, revenue: 0 };
    value.sessions += Number(sourceRow?.sessions || 0);
    value.conversions += Number(sourceRow?.conversions || 0);
    value.revenue += Number(sourceRow?.revenue || 0);
    channelMap.set(label, value);
  }
  const expectedChannels = Array.from(channelMap.values()).sort((a, b) => b.sessions - a.sessions);
  const channelTotalSessions = expectedChannels.reduce((sum, channel) => sum + channel.sessions, 0);
  const channelRows = owner.page.getByTestId("insights-summary-channel-row");
  if (await channelRows.count() !== expectedChannels.length) throw new Error("Rendered channel row count does not match the scoped breakdown");
  for (let index = 0; index < expectedChannels.length; index += 1) {
    const expected = expectedChannels[index];
    const cells = await channelRows.nth(index).locator("td").allInnerTexts();
    const expectedCells = [
      expected.label,
      formatNumber(expected.sessions),
      (channelTotalSessions > 0 ? (expected.sessions / channelTotalSessions) * 100 : 0).toFixed(0) + "%",
      formatNumber(expected.conversions),
      formatPct(expected.sessions > 0 ? (expected.conversions / expected.sessions) * 100 : 0),
    ];
    if (cells.map(normalizeText).join("|") !== expectedCells.map(normalizeText).join("|")) {
      throw new Error("Rendered channel row parity failed for " + expected.label
        + " (expected " + JSON.stringify(expectedCells.map(normalizeText))
        + "; actual " + JSON.stringify(cells.map(normalizeText)) + ")");
    }
  }
  if (expectedChannels.length > 0) {
    const top = expectedChannels[0];
    const topText = await cardText("insights-summary-top-channel");
    assertIncludes(topText, top.label, "top channel label");
    assertIncludes(topText, (channelTotalSessions > 0 ? (top.sessions / channelTotalSessions) * 100 : 0).toFixed(0) + "% of sessions", "top channel share");
    assertIncludes(topText, expectedChannels.length + " channels", "top channel count");
  }

  const normalizedDailyRows = normalizeGA4InsightsDailyRows(uiDailyBody?.data, uiDailyBody?.dataThroughDate);
  const trends = owner.page.getByTestId("insights-trends");
  const dailyChartEndDate = String(normalizedDailyRows.at(-1)?.date || "");
  const dailyChartStartDate = dailyChartEndDate ? addGA4InsightsDateDays(dailyChartEndDate, -29) || "" : "";
  const dailyChartRows = normalizedDailyRows.filter((row) => row.date >= dailyChartStartDate && row.date <= dailyChartEndDate);
  const assertChartSeries = async (expected: unknown[], label: string) => {
    const raw = await trends.getByTestId("insights-trends-chart").getAttribute("data-chart-series");
    const actual = JSON.parse(String(raw || "[]"));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(label + " chart-series parity failed");
  };
  const dailyExpected = normalizedDailyRows.slice(-14).reverse();
  const dailyRendered = trends.locator("tbody tr");
  if (dailyExpected.length >= 2) {
    if (await dailyRendered.count() !== dailyExpected.length) throw new Error("Daily trend row count parity failed");
    for (let index = 0; index < dailyExpected.length; index += 1) {
      const current = dailyExpected[index];
      const previousDate = new Date(current.date + "T00:00:00.000Z");
      previousDate.setUTCDate(previousDate.getUTCDate() - 1);
      const previous = normalizedDailyRows.find((candidate) => candidate.date === previousDate.toISOString().slice(0, 10));
      const cells = await dailyRendered.nth(index).locator("td").allInnerTexts();
      const expectedCells = [
        current.date,
        formatNumber(current.sessions),
        previous ? formatDelta(Number(current.sessions || 0), Number(previous.sessions || 0)) : "\u2014",
      ];
      if (cells.map(normalizeText).join("|") !== expectedCells.map(normalizeText).join("|")) throw new Error("Daily trend parity failed for " + current.date);
    }
    const byDate = new Map(normalizedDailyRows.map((row) => [row.date, row]));
    const expectedChart: unknown[] = [];
    const finalDate = dailyChartEndDate;
    let cursor = finalDate ? addGA4InsightsDateDays(finalDate, -29) || "" : "";
    while (cursor && cursor <= finalDate) {
      const row = byDate.get(cursor);
      expectedChart.push({ date: cursor.slice(5), value: row ? Number(row.sessions || 0) : null, idx: expectedChart.length });
      cursor = addGA4InsightsDateDays(cursor, 1) || "";
    }
    const dailyCoverage = await trends.getByTestId("insights-daily-chart-coverage").innerText();
    assertIncludes(dailyCoverage, "Daily chart " + addGA4InsightsDateDays(finalDate, -29) + " \u2192 " + finalDate, "daily chart range");
    assertIncludes(dailyCoverage, expectedChart.filter((row: any) => row.value !== null).length + "/" + expectedChart.length + " imported days", "daily chart coverage");
    assertIncludes(dailyCoverage, "Missing dates are skipped, not treated as zero.", "daily chart missing-date state");
    await assertChartSeries(expectedChart, "Daily");
  } else {
    assertIncludes(await trends.innerText(), "Need at least 2 imported daily rows", "daily insufficient-history state");
  }

  const validateRollingMode = async (mode: "7d" | "30d", days: 7 | 30) => {
    await trends.getByRole("button", { name: mode, exact: true }).click();
    const current = days === 7 ? uiRollups.last7 : uiRollups.last30;
    const prior = days === 7 ? uiRollups.prior7 : uiRollups.prior30;
    if (current.complete && prior.complete) {
      const rendered = normalizeText(await trends.innerText());
      assertIncludes(rendered, "Last " + days + " days", mode + " current label");
      assertIncludes(rendered, String(current.startDate) + " \u2192 " + String(current.endDate), mode + " current range");
      assertIncludes(rendered, formatNumber(current.sessions), mode + " current value");
      assertIncludes(rendered, formatDelta(current.sessions, prior.sessions), mode + " delta");
      assertIncludes(rendered, "Prior " + days + " days", mode + " prior label");
      assertIncludes(rendered, String(prior.startDate) + " \u2192 " + String(prior.endDate), mode + " prior range");
      assertIncludes(rendered, formatNumber(prior.sessions), mode + " prior value");
      const expectedChart: unknown[] = [];
      for (const row of normalizedDailyRows.slice(-(days * 2))) {
        const rollup = buildGA4InsightsCalendarRollup(normalizedDailyRows, row.date, days);
        if (rollup.complete) expectedChart.push({ date: row.date.slice(5), value: Number(rollup.sessions.toFixed(2)), idx: expectedChart.length });
      }
      await assertChartSeries(expectedChart, mode);
    } else {
      const rendered = await trends.innerText();
      assertIncludes(rendered, days + "-day comparison unavailable", mode + " insufficient-history state");
      assertIncludes(rendered, "Current " + current.startDate + " → " + current.endDate + ": " + current.days + "/" + current.expectedDays + " imported days", mode + " current coverage");
      assertIncludes(rendered, "Prior " + prior.startDate + " → " + prior.endDate + ": " + prior.days + "/" + prior.expectedDays + " imported days", mode + " prior coverage");
      assertIncludes(rendered, "Total imported rows in the 60-day response: " + normalizedDailyRows.length, mode + " total imported rows");
      assertIncludes(rendered, "Missing dates are not assumed to be zero.", mode + " missing-date policy");
    }
  };
  await validateRollingMode("7d", 7);
  await validateRollingMode("30d", 30);

  await trends.getByRole("button", { name: "Monthly", exact: true }).click();
  const monthly = buildGA4InsightsMonthlySeries(normalizedDailyRows, uiDailyBody?.dataThroughDate || null, "sessions");
  if (new Set(normalizedDailyRows.map((item) => item.date.slice(0, 7))).size < 2) {
    assertIncludes(await trends.innerText(), "Need at least 2 calendar months", "monthly insufficient-history state");
  } else {
    const renderedRows = trends.locator("tbody tr");
    const expectedRows = [...monthly].reverse();
    if (await renderedRows.count() !== expectedRows.length) throw new Error("Monthly trend row count parity failed");
    for (let index = 0; index < expectedRows.length; index += 1) {
      const current = expectedRows[index];
      const previous = index < expectedRows.length - 1 ? expectedRows[index + 1] : null;
      const [year, month] = current.month.split("-");
      const label = new Date(Number(year), Number(month) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
      const cells = (await renderedRows.nth(index).locator("td").allInnerTexts()).map(normalizeText);
      const comparable = Boolean(previous && areGA4InsightsMonthsAdjacent(current.month, previous.month) && !current.partial && !previous?.partial);
      const expectedCells = [
        label + " " + (current.partial ? "partial, " + current.days + " days" : current.days + " days"),
        formatNumber(current.value),
        comparable && previous ? formatDelta(current.value, previous.value) : "Not comparable",
      ];
      if (cells.join("|") !== expectedCells.join("|")) throw new Error("Monthly trend parity failed for " + current.month);
    }
    await assertChartSeries(monthly.map((row, index) => {
      const [year, month] = row.month.split("-");
      const date = new Date(Number(year), Number(month) - 1).toLocaleString("en-US", { month: "short" }) + " '" + year.slice(2);
      return { date, value: Number(row.value.toFixed(2)), idx: index, partial: row.partial };
    }), "Monthly");
  }

  const allTrendMetrics = [
    { key: "sessions", label: "Sessions" },
    { key: "users", label: "Users" },
    { key: "conversions", label: "Conversions" },
    { key: "revenue", label: "Revenue" },
    { key: "pageviews", label: "Page Views" },
    { key: "engagementRate", label: "Engagement Rate" },
  ] as const;
  const nonUserTrendMetrics = allTrendMetrics.filter((metric) => metric.key !== "users");
  const chooseTrendMetric = async (label: string) => {
    const trigger = trends.getByTestId("insights-trend-metric");
    await trigger.click();
    await owner.page.getByRole("option", { name: label, exact: true }).click();
    if (normalizeText(await trigger.innerText()) !== label) throw new Error("Trend metric selection failed for " + label);
  };
  const dailyTrendValue = (row: any, key: string) => key === "engagementRate"
    ? Number(row?.engagementRate || 0) * 100
    : Number(row?.[key] || 0);
  const aggregateTrendValue = (row: any, key: string) => key === "engagementRate"
    ? Number(row?.engagementRate || 0)
    : Number(row?.[key] || 0);
  const formatTrendValue = (key: string, value: number) => key === "revenue"
    ? formatMoney(value, currency)
    : key === "engagementRate" ? formatPct(value) : formatNumber(value);

  await trends.getByRole("button", { name: "Daily", exact: true }).click();
  if (dailyExpected.length >= 2) {
    const byDate = new Map(normalizedDailyRows.map((row) => [row.date, row]));
    const finalDate = dailyChartEndDate;
    for (const metric of allTrendMetrics) {
      await chooseTrendMetric(metric.label);
      const rows = trends.locator("tbody tr");
      if (await rows.count() !== dailyExpected.length) throw new Error(metric.label + " Daily row count parity failed");
      for (let index = 0; index < dailyExpected.length; index += 1) {
        const current = dailyExpected[index];
        const previousDate = addGA4InsightsDateDays(current.date, -1);
        const previous = normalizedDailyRows.find((candidate) => candidate.date === previousDate);
        const currentValue = dailyTrendValue(current, metric.key);
        const expectedCells = [
          current.date,
          formatTrendValue(metric.key, currentValue),
          previous ? formatDelta(currentValue, dailyTrendValue(previous, metric.key)) : "\u2014",
        ].map(normalizeText);
        const actualCells = (await rows.nth(index).locator("td").allInnerTexts()).map(normalizeText);
        if (actualCells.join("|") !== expectedCells.join("|")) throw new Error(metric.label + " Daily parity failed for " + current.date);
      }
      const expectedChart: unknown[] = [];
      let cursor = finalDate ? addGA4InsightsDateDays(finalDate, -29) || "" : "";
      while (cursor && cursor <= finalDate) {
        const row = byDate.get(cursor);
        const raw = row ? dailyTrendValue(row, metric.key) : null;
        expectedChart.push({ date: cursor.slice(5), value: raw === null ? null : metric.key === "engagementRate" ? Number(raw.toFixed(2)) : raw, idx: expectedChart.length });
        cursor = addGA4InsightsDateDays(cursor, 1) || "";
      }
      await assertChartSeries(expectedChart, metric.label + " Daily");
    }
  }

  const validateEveryRollingMetric = async (mode: "7d" | "30d", days: 7 | 30) => {
    await trends.getByRole("button", { name: mode, exact: true }).click();
    const current = days === 7 ? uiRollups.last7 : uiRollups.last30;
    const prior = days === 7 ? uiRollups.prior7 : uiRollups.prior30;
    if (!current.complete || !prior.complete) return;
    for (const metric of nonUserTrendMetrics) {
      await chooseTrendMetric(metric.label);
      const currentValue = aggregateTrendValue(current, metric.key);
      const priorValue = aggregateTrendValue(prior, metric.key);
      const rows = trends.locator("tbody tr");
      if (await rows.count() !== 2) throw new Error(metric.label + " " + mode + " row count parity failed");
      const currentCells = (await rows.nth(0).locator("td").allInnerTexts()).map(normalizeText);
      const priorCells = (await rows.nth(1).locator("td").allInnerTexts()).map(normalizeText);
      if (currentCells.join("|") !== ["Last " + days + " days " + current.startDate + " \u2192 " + current.endDate, formatTrendValue(metric.key, currentValue), formatDelta(currentValue, priorValue)].map(normalizeText).join("|")) {
        throw new Error(metric.label + " " + mode + " current-row parity failed");
      }
      if (priorCells.join("|") !== ["Prior " + days + " days " + prior.startDate + " \u2192 " + prior.endDate, formatTrendValue(metric.key, priorValue), "baseline"].map(normalizeText).join("|")) {
        throw new Error(metric.label + " " + mode + " prior-row parity failed");
      }
      const expectedChart: unknown[] = [];
      for (const row of normalizedDailyRows.slice(-(days * 2))) {
        const rollup = buildGA4InsightsCalendarRollup(normalizedDailyRows, row.date, days);
        if (rollup.complete) expectedChart.push({ date: row.date.slice(5), value: Number(aggregateTrendValue(rollup, metric.key).toFixed(2)), idx: expectedChart.length });
      }
      await assertChartSeries(expectedChart, metric.label + " " + mode);
    }
  };
  await validateEveryRollingMetric("7d", 7);
  await validateEveryRollingMetric("30d", 30);

  await trends.getByRole("button", { name: "Monthly", exact: true }).click();
  if (new Set(normalizedDailyRows.map((item) => item.date.slice(0, 7))).size >= 2) {
    for (const metric of nonUserTrendMetrics) {
      await chooseTrendMetric(metric.label);
      const metricMonthly = buildGA4InsightsMonthlySeries(normalizedDailyRows, uiDailyBody?.dataThroughDate || null, metric.key);
      const expectedRows = [...metricMonthly].reverse();
      const rows = trends.locator("tbody tr");
      if (await rows.count() !== expectedRows.length) throw new Error(metric.label + " Monthly row count parity failed");
      for (let index = 0; index < expectedRows.length; index += 1) {
        const current = expectedRows[index];
        const previous = index < expectedRows.length - 1 ? expectedRows[index + 1] : null;
        const [year, month] = current.month.split("-");
        const label = new Date(Number(year), Number(month) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
        const comparable = Boolean(previous && areGA4InsightsMonthsAdjacent(current.month, previous.month) && !current.partial && !previous?.partial);
        const expectedCells = [
          label + " " + (current.partial ? "partial, " + current.days + " days" : current.days + " days"),
          formatTrendValue(metric.key, current.value),
          comparable && previous ? formatDelta(current.value, previous.value) : "Not comparable",
        ].map(normalizeText);
        const actualCells = (await rows.nth(index).locator("td").allInnerTexts()).map(normalizeText);
        if (actualCells.join("|") !== expectedCells.join("|")) throw new Error(metric.label + " Monthly parity failed for " + current.month);
      }
      await assertChartSeries(metricMonthly.map((row, index) => {
        const [year, month] = row.month.split("-");
        return {
          date: new Date(Number(year), Number(month) - 1).toLocaleString("en-US", { month: "short" }) + " '" + year.slice(2),
          value: Number(row.value.toFixed(2)), idx: index, partial: row.partial,
        };
      }), metric.label + " Monthly");
    }
  }

  const tracker = owner.page.getByTestId("insights-trackers");
  const trackerCounts = {
    total: Number(await tracker.getAttribute("data-total")),
    high: Number(await tracker.getAttribute("data-high")),
    medium: Number(await tracker.getAttribute("data-medium")),
  };
  const allFindings: any[] = JSON.parse(String(await tracker.getAttribute("data-findings") || "[]"));
  if (allFindings.length !== trackerCounts.total) throw new Error("Complete finding inventory does not match the tracker");
  if (allFindings.filter((finding) => finding?.severity === "high").length !== trackerCounts.high) throw new Error("High-priority tracker count parity failed");
  if (allFindings.filter((finding) => finding?.severity === "medium").length !== trackerCounts.medium) throw new Error("Medium-priority tracker count parity failed");
  if (new Set(allFindings.map((finding) => String(finding?.id || ""))).size !== allFindings.length) throw new Error("Finding IDs are not unique");
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  for (let index = 0; index < allFindings.length; index += 1) {
    const finding = allFindings[index];
    for (const field of ["id", "category", "severity", "title", "description", "dataBasis", "confidence"]) {
      if (!String(finding?.[field] || "").trim()) throw new Error("Finding " + String(finding?.id || index) + " has an empty " + field);
    }
    if (index > 0 && severityOrder[String(allFindings[index - 1]?.severity)] > severityOrder[String(finding?.severity)]) {
      throw new Error("Finding priority ordering parity failed");
    }
  }
  assertIncludes(await cardText("insights-tracker-total"), formatNumber(trackerCounts.total), "total finding tracker");
  assertIncludes(await cardText("insights-tracker-high"), formatNumber(trackerCounts.high), "high finding tracker");
  assertIncludes(await cardText("insights-tracker-medium"), formatNumber(trackerCounts.medium), "medium finding tracker");
  const findingNodes = owner.page.getByTestId("insights-finding");
  const findings = await findingNodes.evaluateAll((nodes) => nodes.map((node) => {
    const element = node as HTMLElement;
    return {
      id: element.dataset.insightId || "",
      category: element.dataset.category || "",
      severity: element.dataset.severity || "",
      title: element.dataset.title || "",
      description: element.dataset.description || "",
      recommendation: element.dataset.recommendation || "",
      basis: element.dataset.basis || "",
      confidence: element.dataset.confidence || "",
      text: element.innerText,
    };
  }));
  if (findings.length !== Math.min(12, trackerCounts.total)) throw new Error("Visible finding count does not match the tracker");
  const visibleMetadata = findings.map(({ text: _text, basis, ...finding }) => ({ ...finding, dataBasis: basis }));
  const findingCategoryOrder = ["setup", "targets", "trends", "finance", "context"];
  const expectedVisibleMetadata = findingCategoryOrder.flatMap((category) => allFindings.slice(0, 12)
    .filter((finding) => finding.category === category)
    .map((finding) => ({
      id: finding.id,
      category: finding.category,
      severity: finding.severity,
      title: finding.title,
      description: finding.description,
      recommendation: finding.recommendation || "",
      confidence: finding.confidence,
      dataBasis: finding.dataBasis,
    })));
  if (JSON.stringify(visibleMetadata) !== JSON.stringify(expectedVisibleMetadata)) {
    throw new Error("Visible grouped findings do not match the first twelve generated findings");
  }
  for (const finding of findings) {
    for (const field of ["id", "category", "severity", "title", "description", "basis", "confidence"] as const) {
      if (!String(finding[field] || "").trim()) throw new Error("Finding " + finding.id + " has an empty " + field);
    }
    for (const value of [finding.title, finding.description, finding.recommendation, finding.basis, finding.confidence].filter(Boolean)) {
      assertIncludes(finding.text, value, "finding " + finding.id);
    }
  }
  if ((!uiRollups.last7.complete || !uiRollups.prior7.complete) && allFindings.some((finding) => finding.id.endsWith(":wow"))) {
    throw new Error("A 7-day trend finding rendered without two complete 7-day windows");
  }
  if ((!uiRollups.last3.complete || !uiRollups.prior3.complete) && allFindings.some((finding) => finding.id.endsWith(":3d"))) {
    throw new Error("A 3-day trend finding rendered without two complete 3-day windows");
  }
  if (uiDailyBody?.refreshIsStale && allFindings.some((finding) => /^(anomaly:|positive:(sessions|revenue|conversions):|info:(avg_sessions|engagement_rate|top_channel))/.test(finding.id))) {
    throw new Error("A trend conclusion rendered from stale daily history");
  }
  const kpiIds = new Set((Array.isArray(responses.kpis.body) ? responses.kpis.body : []).map((item: any) => String(item?.id || "")));
  const benchmarkIds = new Set((Array.isArray(responses.benchmarks.body) ? responses.benchmarks.body : []).map((item: any) => String(item?.id || "")));
  for (const finding of allFindings) {
    const id = String(finding?.id || "");
    if ((id.startsWith("kpi:") || id.startsWith("positive:kpi:")) && !kpiIds.has(id.slice(id.lastIndexOf(":") + 1))) {
      throw new Error("A KPI finding does not map to the scoped KPI response");
    }
    if (id.startsWith("integrity:kpi") && !kpiIds.has(id.slice(id.lastIndexOf(":") + 1))) {
      throw new Error("A KPI integrity finding does not map to the scoped KPI response");
    }
    if (id.startsWith("bench:") && !benchmarkIds.has(id.slice(id.lastIndexOf(":") + 1))) {
      throw new Error("A Benchmark finding does not map to the scoped Benchmark response");
    }
    if (id.startsWith("integrity:bench") && !benchmarkIds.has(id.slice(id.lastIndexOf(":") + 1))) {
      throw new Error("A Benchmark integrity finding does not map to the scoped Benchmark response");
    }
  }
  const hiddenCount = Math.max(0, trackerCounts.total - findings.length);
  if (hiddenCount > 0) assertIncludes(await cardText("insights-hidden-count"), "+ " + hiddenCount + " more insights", "hidden finding count");
  await owner.context.close();

  let tenantIsolation = "not run; no second production identity was authorized";
  if (requireTenantIsolation) {
    const usersResponse = await clerkGet("/users?limit=100&order_by=-created_at");
    const users: any[] = await usersResponse.json().catch(() => []);
    if (!usersResponse.ok || !Array.isArray(users)) throw new Error(`Clerk user inventory failed (${usersResponse.status})`);
    let otherUser = authorizedNonOwnerUserId
      ? users.find((candidate) => String(candidate?.id || "") === authorizedNonOwnerUserId)
      : null;
    if (otherUser && String(otherUser?.id || "") === String(row.owner_id)) {
      throw new Error("Configured non-owner identity is the campaign owner");
    }
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
    if (!nonOwner) throw new Error("No explicitly authorized non-owner Clerk account is available for the tenant-isolation gate");
    const denied = await request(nonOwner.page, paths.daily);
    if (denied.ok || ![403, 404].includes(denied.status)) throw new Error(`Non-owner request did not fail closed (${denied.status})`);
    tenantIsolation = `failed closed with ${denied.status}`;
    await nonOwner.context.close();
  }
  const persistenceFingerprintAfter = await readPersistenceFingerprint(client, CAMPAIGN_ID);
  const changedPersistenceComponents = Object.keys(persistenceFingerprintBefore).filter((key) =>
    persistenceFingerprintBefore[key] !== persistenceFingerprintAfter[key],
  );
  if (changedPersistenceComponents.length > 0) {
    throw new Error(`Read-only certification observed changed campaign-scoped persistence: ${changedPersistenceComponents.join(", ")}`);
  }

  output = {
    status: "passed",
    deployedSha: health.commit,
    campaignHash: hash(CAMPAIGN_ID),
    ownerHash: hash(row.owner_id),
    propertyId: normalizeProperty(propertyId),
    reportingTimeZone: expected60.reportingTimeZone,
    responseTimeZone,
    currency,
    responseCurrency,
    oauthConfiguration: { ga4SignedState: true, sheetsSignedState: true, googleClientConfigured: true },
    savedFilterCount: filters.length,
    dailyWindow: { startDate: expected60.startDate, endDate: expected60.endDate, rows: rollups.availableDays },
    dailyChart: {
      startDate: dailyChartStartDate,
      endDate: dailyChartEndDate,
      slots: dailyChartEndDate ? 30 : 0,
      importedDays: dailyChartRows.length,
      points: dailyChartRows.map((row) => ({ date: row.date, sessions: row.sessions })),
    },
    dailyFreshness: {
      refreshIsStale: uiDailyBody?.refreshIsStale,
      providerRefreshOutcome: uiDailyBody?.providerRefreshOutcome || null,
      providerRefreshWarning: uiDailyBody?.providerRefreshWarning || null,
      latestStoredDailyDate: uiDailyBody?.latestStoredDailyDate || null,
      dataThroughDate: uiDailyBody?.dataThroughDate || null,
      lastCompletedRefreshAt: uiDailyBody?.lastCompletedRefreshAt || null,
    },
    overviewDailyWindow: { startDate: expected30.startDate, endDate: expected30.endDate, rows: Array.isArray(uiOverviewDailyBody?.data) ? uiOverviewDailyBody.data.length : 0 },
    breakdownWindow: { startDate: expected30.startDate, endDate: expected30.endDate, rows: responses.breakdown.body?.rows?.length || 0 },
    last30: { complete: rollups.last30.complete, sessions: rollups.last30.sessions, conversions: rollups.last30.conversions, revenue: Number(rollups.last30.revenue.toFixed(2)) },
    financialReconciliation: {
      nativeRevenue: Number(ga4Revenue.toFixed(2)),
      importedRevenue: Number(importedRevenue.toFixed(2)),
      totalRevenue: Number(financialRevenue.toFixed(2)),
      spend: Number(financialSpend.toFixed(2)),
      profit: Number(financialProfit.toFixed(2)),
      roas: financialSpend > 0 ? Number(financialRoas.toFixed(4)) : null,
      roiPct: financialSpend > 0 ? Number(financialRoi.toFixed(2)) : null,
      cpa: financialSpend > 0 && financialConversions > 0 ? Number(financialCpa.toFixed(2)) : null,
      conversions: financialConversions,
      completedDay: sourceToDateEnd,
    },
    sourceCounts: { revenue: revenueDefinitions.length, spend: spendDefinitions.length },
    googleAdsProviderScope,
    kpiCount: Array.isArray(responses.kpis.body) ? responses.kpis.body.length : 0,
    benchmarkCount: Array.isArray(responses.benchmarks.body) ? responses.benchmarks.body.length : 0,
    liveSurfaceParity: {
      executiveFinancialValues: Object.keys(expectedFinancialValues).length,
      summaryValues: 8,
      channelRows: expectedChannels.length,
      trendModes: 4,
      trackerValues: 3,
      visibleFindings: findings.length,
      hiddenFindings: hiddenCount,
      findingFields: ["id", "category", "severity", "title", "description", "recommendation", "basis", "confidence"],
    },
    tenantIsolation,
    persistenceSemanticStateUnchanged: true,
    tenantFixture: !requireTenantIsolation
      ? "not applicable; tenant isolation skipped"
      : temporaryUserId ? "ephemeral Clerk-only user created and deleted" : "existing Clerk user",
    uiParity: "all live financial, summary, channel, trend, tracker, and visible-finding surfaces matched scoped production inputs",
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
