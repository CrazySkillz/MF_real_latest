import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { pool } from "../server/db";
import { computeBenchmarkThresholdResult } from "../shared/kpi-math";

const BASE_URL = String(process.env.GA4_BENCHMARK_VALIDATION_BASE_URL || "https://marketforensics.onrender.com").replace(/\/$/, "");
const EXPECTED_SHA = String(process.env.GA4_BENCHMARK_VALIDATION_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.GA4_BENCHMARK_VALIDATION_CAMPAIGN_ID || "").trim();
const clerkSecret = String(process.env.CLERK_SECRET_KEY || "").trim();

if (!pool) throw new Error("DATABASE_URL is required");
if (!clerkSecret) throw new Error("CLERK_SECRET_KEY is required");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("GA4_BENCHMARK_VALIDATION_EXPECTED_SHA must be a full Git SHA");
if (!/^[0-9a-f-]{36}$/i.test(CAMPAIGN_ID)) throw new Error("GA4_BENCHMARK_VALIDATION_CAMPAIGN_ID must be an exact campaign UUID");

type ApiResult = { status: number; ok: boolean; body: any };
type AuthSession = { context: BrowserContext; page: Page; sessionId: string; signInTokenId: string };

const opaque = (value: unknown) => createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 12);
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
const parseMetadata = (value: unknown): any => {
  if (!value) return {};
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return {}; }
};
const definitionSignature = (row: any) => JSON.stringify({
  id: row?.id,
  campaignId: row?.campaignId,
  platformType: row?.platformType,
  name: row?.name,
  metric: row?.metric,
  category: row?.category,
  benchmarkValue: row?.benchmarkValue,
  unit: row?.unit,
  benchmarkType: row?.benchmarkType,
  period: row?.period,
  alertsEnabled: row?.alertsEnabled,
  alertThreshold: row?.alertThreshold,
  alertCondition: row?.alertCondition,
});

const clerkPost = async (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const clerkGet = (path: string) => fetch(`https://api.clerk.com/v1${path}`, {
  headers: { Authorization: `Bearer ${clerkSecret}` },
});
const clerkDelete = (path: string) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${clerkSecret}` },
});

const authenticate = async (browser: Browser, ownerId: string): Promise<AuthSession> => {
  const tokenResponse = await clerkPost("/sign_in_tokens", { user_id: ownerId, expires_in_seconds: 600 });
  const tokenBody: any = await tokenResponse.json().catch(() => ({}));
  check(tokenResponse.ok && tokenBody?.token, `Clerk sign-in token failed (${tokenResponse.status})`);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(tokenBody.token))}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60_000 });
  return {
    context,
    page,
    sessionId: await page.evaluate(() => String((window as any).Clerk?.session?.id || "")),
    signInTokenId: String(tokenBody.id || ""),
  };
};

const api = (page: Page, method: string, path: string, body?: unknown): Promise<ApiResult> => page.evaluate(async (input) => {
  const token = await (window as any).Clerk?.session?.getToken();
  if (!token) throw new Error("Clerk session token is unavailable");
  const response = await fetch(input.path, {
    method: input.method,
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(input.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  const text = await response.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: response.status, ok: response.ok, body: parsed };
}, { method, path, body });

const revoke = async (auth: AuthSession | null): Promise<void> => {
  if (!auth) return;
  await auth.context.close().catch(() => null);
  const response = auth.sessionId
    ? await clerkPost(`/sessions/${encodeURIComponent(auth.sessionId)}/revoke`).catch(() => null)
    : auth.signInTokenId
      ? await clerkPost(`/sign_in_tokens/${encodeURIComponent(auth.signInTokenId)}/revoke`).catch(() => null)
      : null;
  check(response?.ok, `Clerk session cleanup failed (${response?.status || "unavailable"})`);
};

const client = await pool.connect();
let browser: Browser | null = null;
let ownerAuth: AuthSession | null = null;
let outsiderAuth: AuthSession | null = null;
let temporaryBenchmarkId = "";
let temporaryClerkUserId = "";
let thrown: unknown = null;
let output: Record<string, unknown> | null = null;

try {
  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json().catch(() => null);
  check(healthResponse.ok && health?.commit === EXPECTED_SHA, `Deployed SHA mismatch: ${String(health?.commit || "unavailable")}`);

  const campaignResult = await client.query(`
    SELECT c.owner_id, c.client_id, c.currency, g.property_id, g.method
    FROM campaigns c
    JOIN LATERAL (
      SELECT property_id, method
      FROM ga4_connections
      WHERE campaign_id = c.id AND is_active = true
      ORDER BY is_primary DESC, connected_at ASC
      LIMIT 1
    ) g ON true
    WHERE c.id = $1
  `, [CAMPAIGN_ID]);
  check(campaignResult.rowCount === 1, "Target campaign or active GA4 connection was not found");
  const campaign = campaignResult.rows[0];
  check(campaign.owner_id && campaign.client_id && campaign.property_id, "Target campaign ownership/client/property scope is incomplete");

  browser = await chromium.launch({ headless: true });
  ownerAuth = await authenticate(browser, String(campaign.owner_id));
  const benchmarkPath = `/api/platforms/google_analytics/benchmarks?campaignId=${encodeURIComponent(CAMPAIGN_ID)}`;
  const initialList = await api(ownerAuth.page, "GET", benchmarkPath);
  check(initialList.ok && Array.isArray(initialList.body) && initialList.body.length > 0, "Owner Benchmark inventory request failed");
  const initialDefinitions = new Map(initialList.body.map((row: any) => [String(row.id), definitionSignature(row)]));
  const initialIds = [...initialDefinitions.keys()];

  const duplicateRows = await client.query(`
    SELECT LOWER(COALESCE(metric, '')) AS metric_key, LOWER(name) AS name_key,
      benchmark_value, UPPER(unit) AS unit_key, COALESCE(period, ''), COUNT(*)::int AS row_count
    FROM benchmarks
    WHERE campaign_id = $1 AND platform_type = 'google_analytics' AND status = 'active'
    GROUP BY LOWER(COALESCE(metric, '')), LOWER(name), benchmark_value, UPPER(unit), COALESCE(period, '')
    HAVING COUNT(*) > 1
  `, [CAMPAIGN_ID]);
  check(duplicateRows.rowCount === 0, "Active exact-duplicate GA4 Benchmark records exist in the target campaign");

  const scheduler = await api(ownerAuth.page, "POST", `/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/ga4-daily-scheduler/run-now`);
  check(scheduler.ok && scheduler.body?.success === true,
    `Campaign scheduler validation failed (${scheduler.status}): ${JSON.stringify(scheduler.body).slice(0, 800)}`);

  const provider = await api(
    ownerAuth.page,
    "GET",
    `/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/ga4-benchmark-provider-validation?propertyId=${encodeURIComponent(String(campaign.property_id))}&disableTokenRefresh=1`,
  );
  check(provider.ok && provider.body?.simulation?.tokenRefreshDisabled === true, "Benchmark provider validation did not run with token refresh disabled");
  const comparisons = Array.isArray(provider.body?.benchmarks) ? provider.body.benchmarks : [];
  check(comparisons.length === initialIds.length && initialIds.every((id) => comparisons.some((row: any) => String(row?.id) === id)),
    "Provider comparison inventory did not match the active Benchmark inventory");
  const liveProvider = String(provider.body?.currentValueProvider?.status || "").startsWith("live_provider_success");
  const providerMismatches = comparisons.filter((row: any) => row?.computable && liveProvider && (
    Math.abs(Number(row?.storedVsSchedulerDelta || 0)) > 0.01 || Math.abs(Number(row?.storedVsUiDelta || 0)) > 0.01
  ));
  check(providerMismatches.length === 0, `${providerMismatches.length} provider/persisted/scheduler/UI Benchmark mismatches were found`);

  const historyDuplicates = await client.query(`
    SELECT benchmark_id, DATE(recorded_at) AS recorded_date, COALESCE(notes, '') AS scope_note, COUNT(*)::int AS row_count
    FROM benchmark_history
    WHERE benchmark_id = ANY($1::text[])
    GROUP BY benchmark_id, DATE(recorded_at), COALESCE(notes, '')
    HAVING COUNT(*) > 1
  `, [initialIds]);
  check(historyDuplicates.rowCount === 0, "Duplicate same-date/same-scope Benchmark history rows were found");

  const refreshedList = await api(ownerAuth.page, "GET", benchmarkPath);
  check(refreshedList.ok && Array.isArray(refreshedList.body), "Refreshed Benchmark inventory request failed");
  check(initialIds.every((id) => refreshedList.body.some((row: any) => String(row?.id) === id)), "Manual refresh removed an existing Benchmark");
  check(refreshedList.body.every((row: any) => Number.isFinite(Number(row?.currentValue))), "Manual refresh produced a non-finite Benchmark current value");

  const executive = await api(ownerAuth.page, "GET", `/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/executive-summary`);
  check(executive.ok && Array.isArray(executive.body?.benchmarkComparison), "Executive Summary Benchmark comparison was unavailable");
  const standardRows = refreshedList.body.filter((row: any) => String(row?.metric || "").trim() && Number(row?.benchmarkValue) > 0);
  for (const row of standardRows) {
    const expected = computeBenchmarkThresholdResult({
      metric: row.metric,
      name: row.name,
      unit: row.unit,
      current: Number(row.currentValue),
      benchmarkValue: Number(row.benchmarkValue),
    });
    const actual = executive.body.benchmarkComparison.find((item: any) => String(item?.metric) === String(row.name));
    check(actual
      && Math.abs(Number(actual.yours) - Number(row.currentValue)) <= 0.01
      && Math.abs(Number(actual.benchmark) - Number(row.benchmarkValue)) <= 0.01
      && String(actual.unit) === String(row.unit)
      && String(actual.status) === String(expected.status),
    `Executive Summary mismatch for Benchmark ${opaque(row.id)}`);
  }

  const marker = `Certification Benchmark ${Date.now()}`;
  const currency = String(campaign.currency || "USD").trim().toUpperCase();
  const created = await api(ownerAuth.page, "POST", "/api/benchmarks", {
    campaignId: CAMPAIGN_ID,
    platformType: "google_analytics",
    name: marker,
    metric: "__custom__",
    description: "Temporary GA4 Benchmark lifecycle validation",
    category: "performance",
    benchmarkType: "goal",
    period: "monthly",
    unit: currency,
    currentValue: "0",
    benchmarkValue: "10",
    alertsEnabled: true,
    alertThreshold: "5",
    alertCondition: "below",
    alertFrequency: "daily",
    emailNotifications: false,
  });
  check(created.status === 201 && created.body?.id, `Temporary Benchmark create failed (${created.status})`);
  temporaryBenchmarkId = String(created.body.id);

  const readTemporary = async () => {
    const response = await api(ownerAuth!.page, "GET", benchmarkPath);
    check(response.ok && Array.isArray(response.body), "Benchmark inventory refresh failed");
    return response.body.find((row: any) => String(row?.id) === temporaryBenchmarkId);
  };
  let temporaryRow = await readTemporary();
  check(temporaryRow && Number(temporaryRow.currentValue) === 0 && Number(temporaryRow.benchmarkValue) === 10 && temporaryRow.unit === currency,
    "Created zero-current Benchmark target/unit did not persist exactly");

  const visibleNotifications = async () => {
    const response = await api(ownerAuth!.page, "GET", "/api/notifications?readOnly=1");
    check(response.ok && Array.isArray(response.body), "Notification inventory request failed");
    return response.body.filter((row: any) => String(parseMetadata(row?.metadata)?.benchmarkId || "") === temporaryBenchmarkId);
  };
  check((await visibleNotifications()).length === 1, "Breached temporary Benchmark did not produce exactly one visible notification");
  const repeatedReconciliation = await api(ownerAuth.page, "PUT", `/api/benchmarks/${encodeURIComponent(temporaryBenchmarkId)}`, {
    currentValue: "0",
    benchmarkValue: "10",
    unit: currency,
    alertsEnabled: true,
    alertThreshold: "5",
    alertCondition: "below",
  });
  check(repeatedReconciliation.ok, `Repeated Benchmark reconciliation failed (${repeatedReconciliation.status})`);
  check((await visibleNotifications()).length === 1, "Repeated reconciliation duplicated the temporary Benchmark notification");

  await ownerAuth.page.goto(`${BASE_URL}/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/ga4-metrics?tab=benchmarks`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const card = ownerAuth.page.locator(`#ga4-benchmark-${temporaryBenchmarkId}`);
  await card.waitFor({ state: "visible", timeout: 60_000 });
  const cardText = String(await card.innerText());
  const expectedZero = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(0);
  const expectedTarget = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(10);
  check(cardText.includes(marker) && cardText.includes(expectedZero) && cardText.includes(expectedTarget) && cardText.includes("Behind"),
    "Temporary zero-current Benchmark card formatting/status did not reconcile");

  const updated = await api(ownerAuth.page, "PUT", `/api/benchmarks/${encodeURIComponent(temporaryBenchmarkId)}`, {
    currentValue: "10",
    benchmarkValue: "10",
    unit: currency,
    alertsEnabled: true,
    alertThreshold: "5",
    alertCondition: "below",
  });
  check(updated.ok, `Temporary Benchmark edit failed (${updated.status})`);
  temporaryRow = await readTemporary();
  check(temporaryRow && Number(temporaryRow.currentValue) === 10 && Number(temporaryRow.benchmarkValue) === 10 && temporaryRow.unit === currency,
    "Edited Benchmark values/target/unit did not persist exactly");
  check((await visibleNotifications()).length === 0, "Resolved temporary Benchmark notification remained visible");

  const sameOwnerOtherClient = await client.query(`
    SELECT id FROM campaigns
    WHERE owner_id = $1 AND client_id <> $2 AND id <> $3
    ORDER BY created_at
    LIMIT 1
  `, [campaign.owner_id, campaign.client_id, CAMPAIGN_ID]);
  check(sameOwnerOtherClient.rowCount === 1, "A second client-scoped campaign was not available for deployed isolation validation");
  const otherCampaignList = await api(ownerAuth.page, "GET", `/api/platforms/google_analytics/benchmarks?campaignId=${encodeURIComponent(String(sameOwnerOtherClient.rows[0].id))}`);
  check(otherCampaignList.ok && Array.isArray(otherCampaignList.body)
    && !otherCampaignList.body.some((row: any) => String(row?.id) === temporaryBenchmarkId), "Benchmark list crossed the client/campaign boundary");

  const temporaryUserResponse = await clerkPost("/users", {
    email_address: [`ga4-benchmark-cert-${Date.now()}@example.com`],
    password: `G4!${randomBytes(18).toString("base64url")}aA1!`,
    private_metadata: { purpose: "temporary GA4 Benchmark tenant-isolation certification" },
  });
  const temporaryUser: any = await temporaryUserResponse.json().catch(() => ({}));
  check(temporaryUserResponse.ok && temporaryUser?.id, `Temporary Clerk user creation failed (${temporaryUserResponse.status})`);
  temporaryClerkUserId = String(temporaryUser.id);
  outsiderAuth = await authenticate(browser, temporaryClerkUserId);
  const outsiderList = await api(outsiderAuth.page, "GET", benchmarkPath);
  const outsiderEdit = await api(outsiderAuth.page, "PUT", `/api/benchmarks/${encodeURIComponent(temporaryBenchmarkId)}`, { benchmarkValue: "99" });
  const outsiderDelete = await api(outsiderAuth.page, "DELETE", `/api/platforms/google_analytics/benchmarks/${encodeURIComponent(temporaryBenchmarkId)}`);
  check(outsiderList.status === 404 && outsiderEdit.status === 404 && outsiderDelete.status === 404,
    "Cross-owner Benchmark read/edit/delete did not fail closed");
  check(await readTemporary(), "Cross-owner mutation changed the temporary Benchmark");

  const deleted = await api(ownerAuth.page, "DELETE", `/api/platforms/google_analytics/benchmarks/${encodeURIComponent(temporaryBenchmarkId)}`);
  check(deleted.ok && deleted.body?.success === true, `Temporary Benchmark delete failed (${deleted.status})`);
  check(!(await readTemporary()), "Deleted Benchmark remained visible in its campaign inventory");
  const childCounts = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM benchmarks WHERE id = $1) AS benchmarks,
      (SELECT COUNT(*)::int FROM benchmark_history WHERE benchmark_id = $1) AS history,
      (SELECT COUNT(*)::int FROM notifications WHERE metadata::text LIKE '%' || $1 || '%' AND read = false) AS visible_notifications
  `, [temporaryBenchmarkId]);
  check(Object.values(childCounts.rows[0] || {}).every((value) => Number(value) === 0),
    "Temporary Benchmark delete left a parent/history/visible-notification row");
  const deletedBenchmarkHash = opaque(temporaryBenchmarkId);
  temporaryBenchmarkId = "";

  const finalList = await api(ownerAuth.page, "GET", benchmarkPath);
  check(finalList.ok && Array.isArray(finalList.body) && finalList.body.length === initialDefinitions.size,
    "Final Benchmark inventory count did not return to its starting boundary");
  check(finalList.body.every((row: any) => initialDefinitions.get(String(row.id)) === definitionSignature(row)),
    "An existing Benchmark definition changed during lifecycle validation");

  const tsxCli = resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const live = spawnSync(process.execPath, [tsxCli, "scripts/ga4-benchmark-beta-clearance-readonly.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      GA4_BENCHMARK_BETA_BASE_URL: BASE_URL,
      GA4_BENCHMARK_BETA_EXPECTED_SHA: EXPECTED_SHA,
    },
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
  });
  check(live.status === 0, `Authenticated read-only Benchmark validation failed: ${String(live.stderr || live.stdout).slice(-1600)}`);
  const liveEvidence = JSON.parse(String(live.stdout || "{}").trim());
  check(liveEvidence?.success === true && Number(liveEvidence?.benchmarkCount || 0) > 0,
    "Authenticated read-only Benchmark consumer evidence did not pass exactly");

  output = {
    success: true,
    deployedSha: EXPECTED_SHA,
    campaignHash: opaque(CAMPAIGN_ID),
    ownerHash: opaque(campaign.owner_id),
    clientHash: opaque(campaign.client_id),
    propertyHash: opaque(campaign.property_id),
    providerMethod: campaign.method,
    lifecycle: {
      createZeroCurrent: true,
      currencyUnit: currency,
      editTargetAndCurrent: true,
      deleteWithChildCleanup: true,
      crossClientCampaignListIsolated: true,
      crossOwnerReadEditDeleteDenied: true,
      alertCreatedOnceAndResolved: true,
      deletedBenchmarkHash,
    },
    duplicates: {
      activeExactDuplicateGroups: 0,
      sameDateSameScopeHistoryDuplicateGroups: 0,
      repeatedAlertReconciliationVisibleRows: 1,
    },
    scheduler: {
      manualCampaignRun: true,
      trigger: scheduler.body?.trigger || "manual",
      lastRunStatus: scheduler.body?.after?.lastRunStatus || null,
      mutationAlertReconciliation: true,
    },
    valueReconciliation: {
      activeBenchmarkCount: initialIds.length,
      providerStatus: provider.body?.currentValueProvider?.status || null,
      requestedWindowStatus: provider.body?.provider?.status || null,
      comparisonCount: comparisons.length,
      mismatchCount: providerMismatches.length,
      executiveSummaryRowsChecked: standardRows.length,
    },
    consumers: {
      readOnlyCampaignCount: liveEvidence.campaignCount,
      readOnlyBenchmarkCount: liveEvidence.benchmarkCount,
      readOnlyFailureCount: Array.isArray(liveEvidence.failures) ? liveEvidence.failures.length : null,
      cardsTrackerInsightsAlertsReportsExact: liveEvidence.success === true,
    },
  };
} catch (error) {
  thrown = error;
} finally {
  const cleanupErrors: string[] = [];
  if (ownerAuth && temporaryBenchmarkId) {
    const deleted = await api(ownerAuth.page, "DELETE", `/api/platforms/google_analytics/benchmarks/${encodeURIComponent(temporaryBenchmarkId)}`).catch(() => null);
    if (!deleted?.ok) cleanupErrors.push("temporary Benchmark cleanup failed");
  }
  await revoke(outsiderAuth).catch((error) => cleanupErrors.push(String((error as Error).message || error)));
  await revoke(ownerAuth).catch((error) => cleanupErrors.push(String((error as Error).message || error)));
  if (browser) await browser.close().catch(() => null);
  if (temporaryClerkUserId) {
    const deleted = await clerkDelete(`/users/${encodeURIComponent(temporaryClerkUserId)}`).catch(() => null);
    if (!deleted?.ok) cleanupErrors.push(`temporary Clerk user cleanup failed (${deleted?.status || "unavailable"})`);
    const lookup = await clerkGet(`/users/${encodeURIComponent(temporaryClerkUserId)}`).catch(() => null);
    if (lookup?.status !== 404) cleanupErrors.push(`temporary Clerk user still resolves (${lookup?.status || "unavailable"})`);
  }
  client.release();
  await pool.end().catch(() => null);
  if (cleanupErrors.length > 0 && !thrown) thrown = new Error(cleanupErrors.join("; "));
}

if (thrown) throw thrown;
if (!output) throw new Error("Benchmark lifecycle evidence was not produced");
console.log(JSON.stringify(output, null, 2));
