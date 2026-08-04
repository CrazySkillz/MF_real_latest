import { createHash, randomBytes } from "node:crypto";
import { chromium, type Page } from "playwright";
import { pool } from "../server/db";
import { buildGA4InsightsMonthlySeries, buildGA4InsightsRollups, normalizeGA4InsightsDailyRows } from "../shared/ga4-insights";
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
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
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
    SELECT c.owner_id, c.reporting_time_zone, c.ga4_campaign_filter, c.currency,
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
  const currency = String(row.currency || "USD").trim().toUpperCase();
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
    revenueSources: `/api/campaigns/${CAMPAIGN_ID}/revenue-sources`,
    revenueBreakdown: `/api/campaigns/${CAMPAIGN_ID}/revenue-breakdown`,
    spendSources: `/api/campaigns/${CAMPAIGN_ID}/spend-sources?platformContext=ga4`,
    spendBreakdown: `/api/campaigns/${CAMPAIGN_ID}/spend-breakdown?platformContext=ga4`,
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
  const pageInputPromises = Object.entries(paths).map(async ([name, path]) => {
    const expected = new URL(path, BASE_URL);
    const response = await owner.page.waitForResponse((candidate) => {
      const actual = new URL(candidate.url());
      if (actual.pathname !== expected.pathname) return false;
      if (name === "daily") return actual.searchParams.get("days") === "60";
      if (name === "breakdown") return actual.searchParams.get("dateRange") === "30days";
      return true;
    }, { timeout: 120000 });
    return [name, response] as const;
  });
  const analyticsPaths = [
    ...(Array.isArray(responses.kpis.body) ? responses.kpis.body : [])
      .filter((item: any) => String(item?.id || "").trim())
      .map((item: any) => `/api/kpis/${encodeURIComponent(String(item.id))}/analytics`),
    ...(Array.isArray(responses.benchmarks.body) ? responses.benchmarks.body : [])
      .filter((item: any) => String(item?.id || "").trim())
      .map((item: any) => `/api/benchmarks/${encodeURIComponent(String(item.id))}/analytics`),
  ];
  const analyticsResponsePromises = analyticsPaths.map((path) => owner.page.waitForResponse((candidate) =>
    new URL(candidate.url()).pathname === path
  , { timeout: 120000 }));
  await owner.page.goto(`${BASE_URL}/campaigns/${CAMPAIGN_ID}/ga4-metrics?tab=insights`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const pageInputEntries = await Promise.all(pageInputPromises);
  for (const [name, response] of pageInputEntries) {
    if (!response.ok()) throw new Error("Live-page " + name + " request failed (" + response.status() + ")");
    responses[name] = { ok: true, status: response.status(), body: await response.json() };
  }
  const analyticsResponses = await Promise.all(analyticsResponsePromises);
  for (const response of analyticsResponses) {
    if (!response.ok()) throw new Error("Live-page analytics request failed (" + response.status() + ")");
  }
  const uiDailyBody: any = responses.daily.body;
  if (normalizeProperty(uiDailyBody?.propertyId) !== normalizeProperty(propertyId)) throw new Error("Live-page property parity failed");
  if (uiDailyBody?.startDate !== expected60.startDate || uiDailyBody?.endDate !== expected60.endDate) throw new Error("Live-page 60-day window parity failed");
  const uiRollups = buildGA4InsightsRollups(uiDailyBody?.data, uiDailyBody?.dataThroughDate);
  await owner.page.getByRole("heading", { name: "Insights", exact: true }).waitFor({ timeout: 120000 });
  await owner.page.getByText("Executive Financials", { exact: true }).waitFor({ timeout: 120000 });
  await owner.page.getByText("Data Summary", { exact: true }).waitFor({ timeout: 120000 });
  await owner.page.getByText("Exact completed-day window", { exact: true }).waitFor({ timeout: 120000 });
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
  const toDateTotals = responses.toDate.body?.totals || {};
  const revenueDefinitions = Array.isArray(responses.revenueSources.body?.sources) ? responses.revenueSources.body.sources : [];
  const spendDefinitions = Array.isArray(responses.spendSources.body?.sources) ? responses.spendSources.body.sources : [];
  const revenueBreakdownSources = Array.isArray(responses.revenueBreakdown.body?.sources) ? responses.revenueBreakdown.body.sources : [];
  const spendBreakdownSources = Array.isArray(responses.spendBreakdown.body?.sources) ? responses.spendBreakdown.body.sources : [];
  const ga4Revenue = Number(toDateTotals.revenue || 0);
  const importedRevenue = Number(responses.revenue.body?.totalRevenue || 0);
  const ga4RevenueMetric = String(responses.toDate.body?.revenueMetric || "").trim();
  const ga4HasRevenueMetric = Boolean(ga4RevenueMetric) || ga4Revenue !== 0;
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

  const spendLabels = spendSourceIds.map((id: string) => {
    const source = spendDefinitions.find((candidate: any) => String(candidate?.id) === id);
    return String(source?.displayName || source?.sourceType || "").trim();
  }).filter(Boolean);
  const revenueTypeLabel = (type: unknown) => ({
    manual: "Manual", csv: "CSV", google_sheets: "Google Sheets", hubspot: "HubSpot",
    salesforce: "Salesforce", shopify: "Shopify", ga4: "GA4 Revenue", custom: "Custom",
  } as Record<string, string>)[String(type || "")] || String(type || "") || "Revenue";
  const revenueDisplaySources: any[] = revenueBreakdownSources.length > 0
    ? [...revenueBreakdownSources, ...revenueDefinitions.filter((definition: any) =>
        definition?.isActive !== false && !revenueBreakdownSources.some((source: any) => String(source?.sourceId) === String(definition?.id))
      )]
    : revenueDefinitions.filter((definition: any) => definition?.isActive !== false);
  const revenueLabels = revenueDisplaySources.map((source: any) => {
    return String(source?.displayName || revenueTypeLabel(source?.sourceType)).trim() || "Revenue";
  });
  if (ga4HasRevenueMetric) revenueLabels.unshift("GA4 native revenue");
  const sourcesText = await cardText("insights-financial-sources");
  assertIncludes(sourcesText, "Spend: " + (spendLabels.length > 0 ? spendLabels.join(", ") : "Not connected"), "spend provenance");
  assertIncludes(sourcesText, "Revenue: " + (revenueLabels.length > 0 ? Array.from(new Set(revenueLabels)).join(", ") : "Not connected"), "revenue provenance");

  const summaryText = await cardText("insights-data-summary");
  assertIncludes(summaryText, String(uiRollups.last30.startDate), "summary start date");
  assertIncludes(summaryText, String(uiRollups.last30.endDate), "summary end date");
  assertIncludes(summaryText, uiRollups.last30.days + "/" + uiRollups.last30.expectedDays + " imported days", "summary completeness");
  assertIncludes(await cardText("insights-summary-sessions"), formatNumber(uiRollups.last30.sessions), "summary sessions");
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
      formatMoney(expected.revenue, currency),
    ];
    if (cells.map(normalizeText).join("|") !== expectedCells.map(normalizeText).join("|")) {
      throw new Error("Rendered channel row parity failed for " + expected.label);
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
  } else {
    assertIncludes(await trends.innerText(), "Need at least 2 days", "daily insufficient-history state");
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
    } else {
      assertIncludes(await trends.innerText(), "Need at least " + (days * 2) + " days", mode + " insufficient-history state");
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
      const comparable = Boolean(previous && !current.partial && !previous?.partial);
      const expectedCells = [
        label + " " + (current.partial ? "partial, " + current.days + " days" : current.days + " days"),
        formatNumber(current.value),
        comparable && previous ? formatDelta(current.value, previous.value) : "Not comparable",
      ];
      if (cells.join("|") !== expectedCells.join("|")) throw new Error("Monthly trend parity failed for " + current.month);
    }
  }

  const tracker = owner.page.getByTestId("insights-trackers");
  const trackerCounts = {
    total: Number(await tracker.getAttribute("data-total")),
    high: Number(await tracker.getAttribute("data-high")),
    medium: Number(await tracker.getAttribute("data-medium")),
  };
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
  for (const finding of findings) {
    for (const field of ["id", "category", "severity", "title", "description", "basis", "confidence"] as const) {
      if (!String(finding[field] || "").trim()) throw new Error("Finding " + finding.id + " has an empty " + field);
    }
    for (const value of [finding.title, finding.description, finding.recommendation, finding.basis, finding.confidence].filter(Boolean)) {
      assertIncludes(finding.text, value, "finding " + finding.id);
    }
  }
  if ((!uiRollups.last7.complete || !uiRollups.prior7.complete) && findings.some((finding) => finding.id.endsWith(":wow"))) {
    throw new Error("A 7-day trend finding rendered without two complete 7-day windows");
  }
  if ((!uiRollups.last3.complete || !uiRollups.prior3.complete) && findings.some((finding) => finding.id.endsWith(":3d"))) {
    throw new Error("A 3-day trend finding rendered without two complete 3-day windows");
  }
  const hiddenCount = Math.max(0, trackerCounts.total - findings.length);
  if (hiddenCount > 0) assertIncludes(await cardText("insights-hidden-count"), "+ " + hiddenCount + " more insights", "hidden finding count");
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
    currency,
    savedFilterCount: filters.length,
    dailyWindow: { startDate: expected60.startDate, endDate: expected60.endDate, rows: rollups.availableDays },
    breakdownWindow: { startDate: expected30.startDate, endDate: expected30.endDate, rows: responses.breakdown.body?.rows?.length || 0 },
    last30: { complete: rollups.last30.complete, sessions: rollups.last30.sessions, conversions: rollups.last30.conversions, revenue: Number(rollups.last30.revenue.toFixed(2)) },
    sourceCounts: { revenue: revenueDefinitions.length, spend: spendDefinitions.length },
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
