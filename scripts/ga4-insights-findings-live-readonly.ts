import { chromium } from "playwright";
import { pool } from "../server/db";

const baseUrl = "https://marketforensics.onrender.com";
const expectedSha = "6673a976f98d853b9eb37ddc99a2afc195f302d9";
const campaignId = "eee3e654-b736-4e8e-86ec-1050e4d905c0";
const clerkSecret = String(process.env.CLERK_SECRET_KEY || "");
if (!pool || !clerkSecret) throw new Error("Read-only database and Clerk access are required");

const healthResponse = await fetch(`${baseUrl}/api/health`);
const health = await healthResponse.json() as { commit?: string };
if (!healthResponse.ok || health.commit !== expectedSha) throw new Error(`Exact deployed revision unavailable: ${String(health.commit || "unknown")}`);

const db = await pool.connect();
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let sessionId = "";
try {
  await db.query("BEGIN TRANSACTION READ ONLY");
  const inventory = await db.query(`
    SELECT c.owner_id, c.created_at, c.reporting_time_zone, c.ga4_campaign_filter,
           g.property_id, g.is_primary, g.import_start_date::text AS import_start_date
    FROM campaigns c
    JOIN clients cl ON cl.id = c.client_id AND cl.owner_id = c.owner_id
    JOIN ga4_connections g ON g.campaign_id = c.id AND g.is_active = true
    WHERE c.id = $1
    ORDER BY g.is_primary DESC
    LIMIT 1
  `, [campaignId]);
  if (inventory.rowCount !== 1) throw new Error("Owned campaign and active GA4 property not found");
  const selected = inventory.rows[0];
  const propertyId = String(selected.property_id);
  if (selected.is_primary !== true || propertyId.replace(/^properties\//, "") !== "542352127" ||
      String(selected.reporting_time_zone) !== "Europe/Amsterdam" ||
      JSON.stringify(JSON.parse(String(selected.ga4_campaign_filter || "[]"))) !== JSON.stringify(["yesop_retargeti", "yesop_email_nurture"])) {
    throw new Error("Selected campaign property, filter, or reporting timezone changed");
  }
  const targets = await db.query(`SELECT
    (SELECT COUNT(*)::int FROM kpis WHERE campaign_id = $1 AND platform_type = 'google_analytics') AS kpis,
    (SELECT COUNT(*)::int FROM benchmarks WHERE campaign_id = $1 AND platform_type = 'google_analytics') AS benchmarks`, [campaignId]);
  if (Number(targets.rows[0]?.kpis) !== 0 || Number(targets.rows[0]?.benchmarks) !== 0) {
    throw new Error("This live campaign now has saved GA4 targets and needs a new target inventory");
  }
  const tokenResponse = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: selected.owner_id, expires_in_seconds: 600 }),
  });
  const ticket = await tokenResponse.json() as { token?: string };
  if (!tokenResponse.ok || !ticket.token) throw new Error(`Owner sign-in failed (${tokenResponse.status})`);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/sign-in?__clerk_ticket=${encodeURIComponent(ticket.token)}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk.session.id));
  await page.route("**/api/**", route => route.request().method() === "GET" ? route.continue() : route.abort());

  const dailyPromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === `/api/campaigns/${campaignId}/ga4-daily` && url.searchParams.get("days") === "60" &&
      url.searchParams.get("readOnly") === "1" && url.searchParams.get("propertyId")?.replace(/^properties\//, "") === propertyId.replace(/^properties\//, "");
  }, { timeout: 120000 });
  const coveragePromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === `/api/campaigns/${campaignId}/ga4-insights-trends-coverage` &&
      url.searchParams.get("propertyId")?.replace(/^properties\//, "") === propertyId.replace(/^properties\//, "");
  }, { timeout: 120000 });
  await page.goto(`${baseUrl}/campaigns/${campaignId}/ga4-metrics?tab=insights&readOnly=1`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const dailyResponse = await dailyPromise;
  const coverageResponse = await coveragePromise;
  if (!dailyResponse.ok() || !coverageResponse.ok()) throw new Error("Selected daily or coverage GET failed");
  const daily = await dailyResponse.json() as any;
  const coverage = await coverageResponse.json() as any;
  if (daily.validationReadOnly !== true || daily.providerRefreshAttempted !== false || daily.refreshIsStale === true ||
      String(daily.propertyId).replace(/^properties\//, "") !== propertyId.replace(/^properties\//, "") ||
      daily.reportingTimeZone !== selected.reporting_time_zone || daily.overviewStartDate !== selected.import_start_date) {
    throw new Error("Daily API read-only, freshness, or property scope failed");
  }
  if (coverage.verified !== true || !Array.isArray(coverage.dailyRows) || !Array.isArray(coverage.zeroDates) ||
      String(coverage.propertyId).replace(/^properties\//, "") !== propertyId.replace(/^properties\//, "") ||
      coverage.startDate !== selected.import_start_date || coverage.endDate !== daily.dataThroughDate ||
      coverage.reportingTimeZone !== daily.reportingTimeZone) {
    throw new Error(`GA4 provider coverage is not verified for this daily response: ${String(coverage.reason || "scope mismatch")}`);
  }

  await page.waitForFunction(() => document.querySelector('[data-testid="insights-trackers"]')?.hasAttribute("data-findings"), undefined, { timeout: 120000 });
  const tracker = page.getByTestId("insights-trackers");
  const findings = JSON.parse(String(await tracker.getAttribute("data-findings"))) as Array<any>;
  const counts = { total: findings.length, high: findings.filter(item => item.severity === "high").length,
    medium: findings.filter(item => item.severity === "medium").length };
  for (const [key, expected] of Object.entries(counts)) {
    if (Number(await tracker.getAttribute(`data-${key}`)) !== expected ||
        (await page.getByTestId(`insights-tracker-${key}`).locator("p").nth(1).innerText()) !== String(expected)) {
      throw new Error(`${key} tracker does not match the generated findings`);
    }
  }
  const cards = await page.getByTestId("insights-finding").evaluateAll(nodes => nodes.map(node => ({
    id: node.getAttribute("data-insight-id"), title: node.getAttribute("data-title"), severity: node.getAttribute("data-severity"),
    basis: node.getAttribute("data-basis"), confidence: node.getAttribute("data-confidence"),
    description: node.getAttribute("data-description"), recommendation: node.getAttribute("data-recommendation"),
    text: node.textContent || "",
  })));
  if (JSON.stringify(cards.map(item => item.id).sort()) !== JSON.stringify(findings.slice(0, 12).map(item => item.id).sort())) {
    throw new Error("Visible cards differ from the generated finding IDs");
  }
  for (const card of cards) {
    const source = findings.find(item => item.id === card.id);
    if (!source || card.title !== source.title || card.severity !== source.severity || card.basis !== source.dataBasis ||
        card.confidence !== source.confidence || card.description !== source.description ||
        card.recommendation !== (source.recommendation || "") || !card.text.includes(String(source.title)) ||
        !card.text.includes(String(source.description)) || !card.text.includes(String(source.recommendation || "")) ||
        !card.text.includes(`Basis: ${source.dataBasis}`) || !card.text.includes(`Confidence: ${source.confidence}`)) {
      throw new Error(`Visible finding content differs from its source: ${String(card.id)}`);
    }
  }
  const hidden = findings.length - cards.length;
  if (hidden && !(await page.getByTestId("insights-hidden-count").innerText()).includes(`+ ${hidden} more findings`)) {
    throw new Error("Hidden findings are not disclosed");
  }

  const day = (end: string, offset: number) => {
    const value = new Date(`${end}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const windowStart = day(daily.dataThroughDate, -13);
  const stored = await db.query(`SELECT date::text AS date, sessions, conversions, revenue FROM ga4_daily_metrics
    WHERE campaign_id = $1 AND property_id = $2 AND date >= $3 AND date <= $4 ORDER BY date`,
    [campaignId, propertyId, windowStart, daily.dataThroughDate]);
  const storedByDate = new Map(stored.rows.map((item: any) => [item.date, item]));
  const verifiedByDate = new Map(coverage.dailyRows.map((item: any) => [String(item.date), item]));
  const zeros = new Set(coverage.zeroDates.map(String));
  const totals = (offsets: number[]) => offsets.reduce((sum, offset) => {
    const date = day(daily.dataThroughDate, offset);
    const saved: any = storedByDate.get(date);
    const verified: any = verifiedByDate.get(date);
    if (Boolean(saved) !== Boolean(verified) || (saved && (Number(saved.sessions) !== Number(verified.sessions) ||
        Number(saved.conversions) !== Number(verified.conversions) || Math.abs(Number(saved.revenue) - Number(verified.revenue)) > 0.01))) {
      throw new Error(`Database and verified GA4 rows differ on ${date}`);
    }
    if (!verified && !zeros.has(date)) throw new Error(`Missing calendar day is not verified zero: ${date}`);
    return { sessions: sum.sessions + Number(verified?.sessions || 0), conversions: sum.conversions + Number(verified?.conversions || 0),
      revenue: sum.revenue + Number(verified?.revenue || 0) };
  }, { sessions: 0, conversions: 0, revenue: 0 });
  const current = totals([-6, -5, -4, -3, -2, -1, 0]);
  const prior = totals([-13, -12, -11, -10, -9, -8, -7]);
  const change = prior.conversions > 0 ? ((current.conversions - prior.conversions) / prior.conversions) * 100 : 0;
  const positiveExpected = prior.conversions > 5 && change >= 15;
  if (findings.some(item => item.id === "positive:conversions:wow") !== positiveExpected) {
    throw new Error(`Conversion finding disagrees with independently summed historical dates (${change.toFixed(1)}%)`);
  }
  const creationDay = new Date(selected.created_at).toISOString().slice(0, 10);
  const historicalDates = stored.rows.filter((item: any) => item.date < creationDay).map((item: any) => item.date);
  if (!historicalDates.length) throw new Error("No pre-creation historical rows were available to verify");

  const anonymous = await fetch(`${baseUrl}/api/campaigns/${campaignId}/ga4-daily?days=60&propertyId=${encodeURIComponent(propertyId)}&readOnly=1`);
  if (![401, 403, 404].includes(anonymous.status)) throw new Error(`Anonymous campaign read did not fail closed (${anonymous.status})`);
  let fixture: "stale" | "mismatch" | "unavailable" = "stale";
  await page.route(`**/api/campaigns/${campaignId}/ga4-daily?**`, route => {
    if (new URL(route.request().url()).searchParams.get("days") !== "60") return route.continue();
    if (fixture === "unavailable") return route.fulfill({ status: 503, contentType: "application/json", body: '{"success":false,"error":"browser fixture"}' });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture === "stale" ? { ...daily, refreshIsStale: true } : daily) });
  });
  await page.route(`**/api/campaigns/${campaignId}/ga4-insights-trends-coverage?**`, route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(fixture === "mismatch"
      ? { ...coverage, verified: false, dailyRows: undefined, zeroDates: [], reason: "stored_daily_history_differs_from_ga4" }
      : coverage),
  }));
  const assertFixture = async (expectedId: string) => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector('[data-testid="insights-trackers"]')?.hasAttribute("data-findings"), undefined, { timeout: 120000 });
    const rows = JSON.parse(String(await page.getByTestId("insights-trackers").getAttribute("data-findings"))) as Array<{ id: string }>;
    if (!rows.some(item => item.id === expectedId) || rows.some(item => item.id === "positive:conversions:wow")) {
      throw new Error(`${fixture} browser fixture did not withhold performance advice`);
    }
    if ((await page.getByTestId("insights-tracker-total").locator("p").nth(1).innerText()) !== String(rows.length)) {
      throw new Error(`${fixture} browser fixture tracker disagrees with findings`);
    }
  };
  await assertFixture("integrity:daily_history_stale");
  fixture = "mismatch";
  await assertFixture("integrity:daily_history_outdated");
  fixture = "unavailable";
  await assertFixture("integrity:daily_history_unavailable");
  console.log(JSON.stringify({ deployedSha: health.commit, propertyId, savedFilter: JSON.parse(String(selected.ga4_campaign_filter)),
    ga4Kpis: Number(targets.rows[0].kpis), ga4Benchmarks: Number(targets.rows[0].benchmarks), importStartDate: selected.import_start_date,
    creationDay, historicalDates, cutoff: daily.dataThroughDate, current, prior, conversionChangePct: Number(change.toFixed(1)),
    findings: findings.map(item => ({ id: item.id, severity: item.severity, basis: item.dataBasis, confidence: item.confidence })),
    counts, visible: cards.length, hidden, anonymousStatus: anonymous.status,
    browserOnlyFixtures: ["stale", "confirmed provider mismatch", "initial daily unavailable"], appRequests: "GET only" }, null, 2));
  await context.close();
} finally {
  await db.query("ROLLBACK").catch(() => undefined);
  db.release();
  await browser?.close().catch(() => undefined);
  if (sessionId) {
    const revoke = await fetch(`https://api.clerk.com/v1/sessions/${encodeURIComponent(sessionId)}/revoke`, {
      method: "POST", headers: { Authorization: `Bearer ${clerkSecret}` },
    });
    if (!revoke.ok) throw new Error(`Temporary Clerk session revoke failed (${revoke.status})`);
  }
  await pool.end();
}
