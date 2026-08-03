import { createHash } from "node:crypto";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { pool } from "../server/db";

const BASE_URL = process.env.GA4_BENCHMARK_BETA_BASE_URL || "https://marketforensics.onrender.com";
const EXPECTED_SHA = process.env.GA4_BENCHMARK_BETA_EXPECTED_SHA || "5366d0babc9550ecd408e55bc385e7024854f424";
const sha = (value: unknown) => createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 12);
const round2 = (value: unknown) => Number((Number(value) || 0).toFixed(2));

if (!pool) throw new Error("DATABASE_URL is required");
const clerkSecret = String(process.env.CLERK_SECRET_KEY || "");
if (!clerkSecret) throw new Error("CLERK_SECRET_KEY is required");

type InventoryRow = {
  id: string;
  campaign_id: string;
  owner_id: string;
  metric: string | null;
  name: string;
  current_value: string | null;
  benchmark_value: string;
  updated_at: Date;
  reporting_time_zone: string | null;
  ga4_campaign_filter: unknown;
  property_id: string | null;
  method: string | null;
  history_count: string;
  latest_history_at: Date | null;
  report_count: string;
};

const client = await pool.connect();
let browser: Browser | null = null;
const sessions: Array<{ sessionId: string; signInTokenId: string }> = [];

const clerkPost = async (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const authenticatedContext = async (ownerId: string): Promise<{ context: BrowserContext; page: Page }> => {
  if (!browser) throw new Error("Browser is unavailable");
  const tokenResponse = await clerkPost("/sign_in_tokens", { user_id: ownerId, expires_in_seconds: 600 });
  const tokenBody: any = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenBody?.token) throw new Error(`Clerk sign-in token failed (${tokenResponse.status})`);

  const context = await browser.newContext({ acceptDownloads: false });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(tokenBody.token))}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60000 });
  const sessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ""));
  sessions.push({ sessionId, signInTokenId: String(tokenBody.id || "") });
  return { context, page };
};

const api = async (page: Page, path: string) => page.evaluate(async (requestPath) => {
  const sessionToken = await (window as any).Clerk?.session?.getToken();
  if (!sessionToken) throw new Error("Clerk session token is unavailable");
  const response = await fetch(requestPath, {
    method: "GET",
    credentials: "include",
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: response.ok, status: response.status, body };
}, path);

try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const inventory = await client.query<InventoryRow>(`
    SELECT
      b.id,
      b.campaign_id,
      c.owner_id,
      b.metric,
      b.name,
      b.current_value,
      b.benchmark_value,
      b.updated_at,
      c.reporting_time_zone,
      c.ga4_campaign_filter,
      connection.property_id,
      connection.method,
      COALESCE(history.history_count, 0)::text AS history_count,
      history.latest_history_at,
      COALESCE(reports.report_count, 0)::text AS report_count
    FROM benchmarks b
    JOIN campaigns c ON c.id = b.campaign_id
    LEFT JOIN LATERAL (
      SELECT g.property_id, g.method
      FROM ga4_connections g
      WHERE g.campaign_id = b.campaign_id AND g.is_active = true
      ORDER BY g.is_primary DESC, g.connected_at ASC
      LIMIT 1
    ) connection ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS history_count, MAX(recorded_at) AS latest_history_at
      FROM benchmark_history h
      WHERE h.benchmark_id = b.id
    ) history ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS report_count
      FROM linkedin_reports r
      WHERE r.campaign_id = b.campaign_id
        AND r.platform_type = 'google_analytics'
        AND r.status = 'active'
    ) reports ON true
    WHERE b.platform_type = 'google_analytics'
      AND b.status = 'active'
      AND b.campaign_id IS NOT NULL
    ORDER BY c.owner_id, b.campaign_id, b.created_at
  `);
  await client.query("ROLLBACK");

  if (inventory.rows.length === 0) throw new Error("No active campaign-scoped GA4 Benchmarks exist in the target database");
  browser = await chromium.launch({ headless: true });

  const campaigns = new Map<string, InventoryRow[]>();
  for (const row of inventory.rows) {
    const key = `${row.owner_id}:${row.campaign_id}`;
    campaigns.set(key, [...(campaigns.get(key) || []), row]);
  }

  const failures: string[] = [];
  const results: any[] = [];
  for (const rows of campaigns.values()) {
    const first = rows[0];
    const { context, page } = await authenticatedContext(first.owner_id);
    const blockedApplicationMutations: string[] = [];
    await page.route(`${BASE_URL}/**`, async (route) => {
      if (route.request().method() !== "GET") {
        blockedApplicationMutations.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
        await route.abort();
        return;
      }
      await route.continue();
    });

    try {
      const health = await api(page, "/api/health");
      if (!health.ok || health.body?.commit !== EXPECTED_SHA) {
        failures.push(`${sha(first.campaign_id)}: deployed SHA mismatch`);
        continue;
      }

      const list = await api(page, `/api/platforms/google_analytics/benchmarks?campaignId=${encodeURIComponent(first.campaign_id)}`);
      const listed = Array.isArray(list.body) ? list.body : [];
      const expectedIds = new Set(rows.map((row) => String(row.id)));
      const listedIds = new Set(listed.map((row: any) => String(row?.id || "")));
      const listParity = expectedIds.size === listedIds.size && [...expectedIds].every((id) => listedIds.has(id));
      if (!list.ok || !listParity) failures.push(`${sha(first.campaign_id)}: authenticated Benchmark list parity failed`);

      let provider: any = null;
      if (first.property_id) {
        const validation = await api(
          page,
          `/api/campaigns/${encodeURIComponent(first.campaign_id)}/ga4-benchmark-provider-validation?propertyId=${encodeURIComponent(first.property_id)}&disableTokenRefresh=1`,
        );
        if (!validation.ok || validation.body?.simulation?.tokenRefreshDisabled !== true) {
          failures.push(`${sha(first.campaign_id)}: provider validation failed or token refresh was not disabled`);
        } else {
          const comparisons = Array.isArray(validation.body?.benchmarks) ? validation.body.benchmarks : [];
          const comparisonIds = new Set(comparisons.map((row: any) => String(row?.id || "")));
          const comparisonParity = expectedIds.size === comparisonIds.size && [...expectedIds].every((id) => comparisonIds.has(id));
          if (!comparisonParity) failures.push(`${sha(first.campaign_id)}: provider comparison inventory mismatch`);
          const live = String(validation.body?.currentValueProvider?.status || "").startsWith("live_provider_success");
          const mismatches = comparisons.filter((row: any) => row?.computable && live && (
            Math.abs(Number(row?.storedVsSchedulerDelta || 0)) > 0.01 || Math.abs(Number(row?.storedVsUiDelta || 0)) > 0.01
          ));
          if (mismatches.length > 0) failures.push(`${sha(first.campaign_id)}: ${mismatches.length} live stored/scheduler/UI mismatches`);
          provider = {
            status: validation.body?.currentValueProvider?.status || null,
            requestedWindowStatus: validation.body?.provider?.status || null,
            propertyHash: sha(validation.body?.propertyId),
            campaignFilterConfigured: validation.body?.campaignFilter !== null,
            currentValueWindow: validation.body?.sourceWindows?.currentValue || null,
            persistedRowCount: Number(validation.body?.currentValuePersistedDaily?.rowCount || 0),
            comparisonCount: comparisons.length,
            mismatchCount: mismatches.length,
            comparisons: comparisons.map((row: any) => ({
              benchmarkHash: sha(row?.id),
              metric: row?.metric || null,
              storedCurrentValue: row?.storedCurrentValue ?? null,
              schedulerCandidateCurrentValue: row?.schedulerCandidateCurrentValue ?? null,
              uiCandidateCurrentValue: row?.uiCandidateCurrentValue ?? null,
              storedVsSchedulerDelta: row?.storedVsSchedulerDelta ?? null,
              storedVsUiDelta: row?.storedVsUiDelta ?? null,
              computable: Boolean(row?.computable),
            })),
          };
        }
      }

      await page.goto(`${BASE_URL}/campaigns/${encodeURIComponent(first.campaign_id)}/ga4-metrics?tab=benchmarks`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.locator("body").waitFor({ state: "visible", timeout: 30000 });
      await page.waitForTimeout(3000);
      const bodyText = await page.locator("body").innerText();
      const benchmarkSectionVisible = await page.locator("#ga4-benchmarks-section").isVisible().catch(() => false);
      const missingCardNames = benchmarkSectionVisible ? rows.filter((row) => !bodyText.includes(row.name)) : rows;
      const trackerVisible = bodyText.includes("Total Benchmarks");
      if (first.property_id && (missingCardNames.length > 0 || !trackerVisible)) {
        failures.push(`${sha(first.campaign_id)}: deployed card/Tracker render parity failed`);
      }
      if (blockedApplicationMutations.length > 0) {
        failures.push(`${sha(first.campaign_id)}: application mutation request was attempted during read-only validation`);
      }

      const emailAudits: any[] = [];
      for (const row of rows) {
        const audit = await api(page, `/api/benchmarks/${encodeURIComponent(row.id)}/alert-email-delivery-validation`);
        emailAudits.push({
          benchmarkHash: sha(row.id),
          accessible: audit.ok,
          deliveredEvidenceCount: Array.isArray(audit.body?.events)
            ? audit.body.events.filter((event: any) => event?.deliveryStatus === "delivered" && event?.deliveredAt).length
            : 0,
        });
      }

      results.push({
        campaignHash: sha(first.campaign_id),
        ownerHash: sha(first.owner_id),
        reportingTimeZone: first.reporting_time_zone || "UTC",
        propertyConfigured: Boolean(first.property_id),
        propertyHash: first.property_id ? sha(first.property_id) : null,
        connectionMethod: first.method,
        benchmarkCount: rows.length,
        authenticatedListParity: list.ok && listParity,
        cardAndTrackerRenderParity: first.property_id
          ? missingCardNames.length === 0 && trackerVisible
          : "not_applicable_no_property",
        browserState: {
          path: new URL(page.url()).pathname + new URL(page.url()).search,
          benchmarkSectionVisible,
          trackerVisible,
          benchmarkNamesFound: rows.length - missingCardNames.length,
          connectionPromptVisible: bodyText.includes("Connect Google Analytics") || bodyText.includes("Connect GA4"),
          errorStateVisible: bodyText.includes("Unable to load") || bodyText.includes("Failed to load"),
        },
        provider,
        activeReportCount: Number(first.report_count || 0),
        benchmarks: rows.map((row) => ({
          benchmarkHash: sha(row.id),
          metric: row.metric,
          currentValue: round2(row.current_value),
          targetValue: round2(row.benchmark_value),
          historyCount: Number(row.history_count || 0),
          latestHistoryAt: row.latest_history_at?.toISOString() || null,
          updatedAt: row.updated_at?.toISOString() || null,
        })),
        emailAudits,
        blockedApplicationMutationCount: blockedApplicationMutations.length,
      });
    } finally {
      await context.close();
    }
  }

  const schedulerResponse = await fetch(`${BASE_URL}/health/scheduler`);
  const scheduler = await schedulerResponse.json().catch(() => null as any);
  const output = {
    success: failures.length === 0,
    mode: "read_only_application_data",
    deployedSha: EXPECTED_SHA,
    campaignCount: campaigns.size,
    benchmarkCount: inventory.rows.length,
    failures,
    scheduler: scheduler?.ga4DailyScheduler || null,
    campaigns: results,
  };
  console.log(JSON.stringify(output, null, 2));
  if (failures.length > 0) process.exitCode = 1;
} finally {
  for (const session of sessions) {
    if (session.sessionId) await clerkPost(`/sessions/${encodeURIComponent(session.sessionId)}/revoke`).catch(() => null);
    else if (session.signInTokenId) await clerkPost(`/sign_in_tokens/${encodeURIComponent(session.signInTokenId)}/revoke`).catch(() => null);
  }
  if (browser) await browser.close().catch(() => null);
  client.release();
  await pool.end();
}
