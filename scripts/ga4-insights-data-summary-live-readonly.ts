import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { pool } from "../server/db";
import { GA4_OVERVIEW_LEGACY_IMPORT_START_DATE } from "../server/utils/reporting-timezone";

const baseUrl = "https://marketforensics.onrender.com";
const expectedSha = "0bce5024b1b5ab7dd6cbbbf1f7f91e81b94b24cf";
const campaignId = "eee3e654-b736-4e8e-86ec-1050e4d905c0";
const clerkSecret = process.env.CLERK_SECRET_KEY;
if (!pool || !clerkSecret) throw new Error("DATABASE_URL and CLERK_SECRET_KEY are required");

const client = await pool.connect();
const browser = await chromium.launch({ headless: true });
let sessionId = "";
try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  const health = await healthResponse.json() as { commit?: string };
  if (!healthResponse.ok || health.commit !== expectedSha) throw new Error("Deployed commit differs from the audited revision");

  const inventory = await client.query(`
    SELECT c.owner_id, c.client_id, c.reporting_time_zone, c.ga4_campaign_filter,
           g.property_id, g.import_start_date::text AS import_start_date, g.method
    FROM campaigns c
    JOIN clients cl ON cl.id = c.client_id AND cl.owner_id = c.owner_id
    JOIN ga4_connections g ON g.campaign_id = c.id AND g.is_active = true
    WHERE c.id = $1
    ORDER BY g.is_primary DESC
    LIMIT 1
  `, [campaignId]);
  if (inventory.rowCount !== 1) throw new Error("Owned campaign and active GA4 property were not found");
  const selected = inventory.rows[0];
  if (selected.method !== "access_token") throw new Error("Selected GA4 connection is not an OAuth property");
  const propertyId = String(selected.property_id);
  const importStartDate = String(selected.import_start_date || GA4_OVERVIEW_LEGACY_IMPORT_START_DATE);
  const savedFilterRaw = String(selected.ga4_campaign_filter || "").trim();
  let savedFilters = savedFilterRaw ? [savedFilterRaw] : [];
  try {
    const parsed = JSON.parse(savedFilterRaw);
    if (Array.isArray(parsed)) savedFilters = parsed.map(String).map(item => item.trim()).filter(Boolean);
  } catch { /* Legacy single campaign value. */ }
  const tokenResponse = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: selected.owner_id, expires_in_seconds: 600 }),
  });
  const signInToken = await tokenResponse.json() as { token?: string };
  if (!tokenResponse.ok || !signInToken.token) throw new Error(`Owner sign-in failed (${tokenResponse.status})`);

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/sign-in?__clerk_ticket=${encodeURIComponent(signInToken.token)}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk.session.id));
  await page.route("**/api/**", route => route.request().method() === "GET" ? route.continue() : route.abort());

  const responsePromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === `/api/campaigns/${campaignId}/ga4-daily` &&
      url.searchParams.get("days") === "60" &&
      url.searchParams.get("readOnly") === "1" &&
      url.searchParams.get("propertyId")?.replace(/^properties\//, "") === propertyId.replace(/^properties\//, "");
  }, { timeout: 120000 });
  const coveragePromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === `/api/campaigns/${campaignId}/ga4-insights-trends-coverage` &&
      url.searchParams.get("propertyId")?.replace(/^properties\//, "") === propertyId.replace(/^properties\//, "");
  }, { timeout: 120000 });
  await page.goto(`${baseUrl}/campaigns/${campaignId}/ga4-metrics?tab=insights&readOnly=1`, { waitUntil: "domcontentloaded" });
  const response = await responsePromise;
  if (!response.ok()) throw new Error(`Page-consumed GA4 daily request failed (${response.status()})`);
  const daily = await response.json() as any;
  if (daily.validationReadOnly !== true || daily.providerRefreshAttempted !== false) throw new Error("GA4 daily response was not read-only");
  if (String(daily.propertyId).replace(/^properties\//, "") !== propertyId.replace(/^properties\//, "")) throw new Error("Selected property mismatch");
  if (daily.overviewStartDate !== importStartDate || daily.reportingTimeZone !== selected.reporting_time_zone) throw new Error("Imported-history window or timezone mismatch");
  if (daily.dataThroughDate !== daily.endDate || daily.overviewStartDate > daily.dataThroughDate) throw new Error("Completed-day window mismatch");
  const coverageResponse = await coveragePromise;
  if (!coverageResponse.ok()) throw new Error(`Provider coverage check failed (${coverageResponse.status()})`);
  const coverage = await coverageResponse.json() as any;
  if (coverage.verified !== true || coverage.startDate !== importStartDate || coverage.endDate !== daily.dataThroughDate ||
      coverage.reportingTimeZone !== daily.reportingTimeZone ||
      String(coverage.propertyId).replace(/^properties\//, "") !== propertyId.replace(/^properties\//, "")) {
    throw new Error(`Selected-property provider coverage did not verify stored history (${String(coverage.reason || "scope mismatch")})`);
  }
  if (daily.refreshIsStale === true) throw new Error("Deployed Data Summary values are marked stale");

  const stored = await client.query(`
    SELECT COUNT(*)::int AS days, COALESCE(SUM(sessions), 0)::numeric AS sessions,
           COALESCE(SUM(conversions), 0)::numeric AS conversions
    FROM ga4_daily_metrics
    WHERE campaign_id = $1 AND property_id = $2 AND date >= $3 AND date <= $4
  `, [campaignId, propertyId, importStartDate, daily.dataThroughDate]);
  const exact = stored.rows[0];
  if (Number(daily.overviewTotals?.sessions) !== Number(exact.sessions) ||
      Number(daily.overviewTotals?.conversions) !== Number(exact.conversions)) throw new Error("API totals differ from selected campaign/property daily records");
  const providerRows = Array.isArray(coverage.dailyRows) ? coverage.dailyRows : [];
  const zeroDates = Array.isArray(coverage.zeroDates) ? coverage.zeroDates : [];
  const calendarDays = Math.round((Date.parse(`${daily.dataThroughDate}T00:00:00Z`) - Date.parse(`${importStartDate}T00:00:00Z`)) / 86400000) + 1;
  if (providerRows.length !== exact.days || providerRows.length + zeroDates.length !== calendarDays ||
      providerRows.reduce((sum: number, row: any) => sum + Number(row.sessions), 0) !== Number(exact.sessions) ||
      providerRows.reduce((sum: number, row: any) => sum + Number(row.conversions), 0) !== Number(exact.conversions)) {
    throw new Error("Provider-verified imported dates, gaps, or totals differ from persisted Data Summary history");
  }
  await page.getByTestId("insights-summary-sessions").waitFor({ timeout: 120000 });
  await page.waitForFunction(() => Boolean(document.querySelector('[data-testid="insights-trackers"]')?.getAttribute("data-findings")), undefined, { timeout: 120000 });
  const number = (value: unknown) => new Intl.NumberFormat("en-US").format(Number(value));
  const sessions = await page.getByTestId("insights-summary-sessions").locator("p").nth(1).innerText();
  const conversions = await page.getByTestId("insights-summary-conversions").locator("p").nth(1).innerText();
  if (sessions !== number(exact.sessions) || conversions !== number(exact.conversions)) throw new Error("Data Summary UI/API numeric parity failed");
  const rate = `${(Number(exact.conversions) / Number(exact.sessions) * 100).toFixed(1)}% conversion rate`;
  if (!(await page.getByTestId("insights-summary-conversions").innerText()).includes(rate)) throw new Error("Data Summary conversion rate differs from its displayed totals");
  const scope = await page.getByTestId("insights-data-summary-scope-note").innerText();
  const timeZoneLabel = String(daily.reportingTimeZone).split("/").pop()?.replace(/_/g, " ") || "";
  if (!scope.includes(`${importStartDate} to ${daily.dataThroughDate}`) || !scope.includes(`(${timeZoneLabel})`)) throw new Error("Data Summary date/timezone label differs from the API");
  const selectedProperty = await page.getByTestId("insights-scope-property").innerText();
  if (!selectedProperty.includes(propertyId.replace(/^properties\//, ""))) throw new Error("Page property selector differs from the selected source");
  const selectedFilter = await page.getByTestId("insights-scope-filter").innerText();
  if (!selectedFilter.includes(savedFilters.length ? savedFilters.join(", ") : "All campaigns")) throw new Error("Page campaign filter differs from the saved GA4 selection");
  for (const testId of ["insights-summary-top-channel", "insights-summary-channel-row", "insights-data-summary-channel-unavailable"]) {
    if (await page.getByTestId(testId).count()) throw new Error(`Disabled channel surface appeared: ${testId}`);
  }

  const trackers = page.getByTestId("insights-trackers");
  const findings = JSON.parse(String(await trackers.getAttribute("data-findings"))) as Array<{ id: string; severity: string }>;
  const counts = { total: findings.length, high: findings.filter(item => item.severity === "high").length, medium: findings.filter(item => item.severity === "medium").length };
  for (const [kind, expected] of Object.entries(counts)) {
    const actual = await page.getByTestId(`insights-tracker-${kind}`).locator("p").nth(1).innerText();
    if (actual !== String(expected)) throw new Error(`${kind} tracker differs from generated findings`);
  }
  const visibleIds = await page.getByTestId("insights-finding").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-insight-id")));
  if (JSON.stringify([...visibleIds].sort()) !== JSON.stringify(findings.slice(0, 12).map(item => item.id).sort())) throw new Error("Visible finding cards differ from tracker input");
  const hiddenCount = findings.length - visibleIds.length;
  if (hiddenCount > 0 && !(await page.getByTestId("insights-hidden-count").innerText()).includes(`+ ${hiddenCount} more findings`)) throw new Error("Hidden findings were not disclosed");

  const anonymous = await fetch(`${baseUrl}/api/campaigns/${campaignId}/ga4-daily?days=60&propertyId=${encodeURIComponent(propertyId)}&readOnly=1`);
  if (anonymous.ok || ![401, 403, 404].includes(anonymous.status)) throw new Error(`Unauthenticated GA4 daily request did not fail closed (${anonymous.status})`);
  let fixtureMode: "zero" | "stale" | "unavailable" = "zero";
  await page.route(`**/api/campaigns/${campaignId}/ga4-daily?**`, route => {
    if (new URL(route.request().url()).searchParams.get("days") !== "60") return route.continue();
    if (fixtureMode === "unavailable") return route.fulfill({ status: 503, contentType: "application/json", body: '{"success":false,"error":"fixture"}' });
    const fixture = fixtureMode === "stale" ? { ...daily, refreshIsStale: true } : {
      ...daily,
      refreshIsStale: false,
      overviewTotals: { ...daily.overviewTotals, sessions: 0, conversions: 0 },
      data: [{ date: daily.dataThroughDate, sessions: 0, conversions: 0, users: 0, pageviews: 0, revenue: 0, engagedSessions: 0, engagementRate: 0 }],
    };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture) });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("insights-summary-sessions").waitFor({ timeout: 120000 });
  if (await page.getByTestId("insights-summary-sessions").locator("p").nth(1).innerText() !== "0" ||
      await page.getByTestId("insights-summary-conversions").locator("p").nth(1).innerText() !== "0" ||
      !(await page.getByTestId("insights-summary-conversions").innerText()).includes("Valid zero sessions")) {
    throw new Error("Browser-only valid-zero fixture did not display distinct zero values");
  }
  fixtureMode = "stale";
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("insights-data-summary-stale").waitFor({ timeout: 120000 });
  if (await page.getByTestId("insights-summary-sessions").locator("p").nth(1).innerText() !== number(exact.sessions)) {
    throw new Error("Browser-only stale fixture did not retain labeled last-good values");
  }
  fixtureMode = "unavailable";
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("GA4 summary values are unavailable; no zero values are inferred.").waitFor({ timeout: 120000 });
  if (await page.getByTestId("insights-summary-sessions").count() || await page.getByTestId("insights-summary-conversions").count()) {
    throw new Error("Browser-only unavailable fixture presented unsupported zero cards");
  }
  console.log(JSON.stringify({
    deployedSha: health.commit,
    campaignHash: createHash("sha256").update(campaignId).digest("hex").slice(0, 12),
    propertyId: propertyId.replace(/^properties\//, ""),
    savedFilterCount: savedFilters.length,
    reportingTimeZone: daily.reportingTimeZone,
    window: [importStartDate, daily.dataThroughDate],
    importedDays: exact.days,
    providerVerifiedNoMatchDays: zeroDates.length,
    refreshIsStale: daily.refreshIsStale,
    lastCompletedRefreshAt: daily.lastCompletedRefreshAt,
    sessions: Number(exact.sessions),
    conversions: Number(exact.conversions),
    trackerCounts: counts,
    visibleFindings: visibleIds.length,
    hiddenFindings: hiddenCount,
    anonymousStatus: anonymous.status,
    channelUiAbsent: true,
    browserFixtures: ["valid zero", "stale last-good", "initial unavailable"],
    appRequests: "GET only",
  }, null, 2));
  await context.close();
} finally {
  await client.query("ROLLBACK").catch(() => undefined);
  client.release();
  await browser.close().catch(() => undefined);
  if (sessionId) {
    const revoked = await fetch(`https://api.clerk.com/v1/sessions/${encodeURIComponent(sessionId)}/revoke`, {
      method: "POST", headers: { Authorization: `Bearer ${clerkSecret}` },
    });
    if (!revoked.ok) throw new Error(`Temporary owner session revoke failed (${revoked.status})`);
  }
  await pool.end();
}
