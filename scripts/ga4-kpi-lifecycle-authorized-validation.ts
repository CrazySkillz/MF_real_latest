import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { pool } from "../server/db";
import { resolveGA4KpiMetricIdentity } from "../shared/ga4-kpi-metric-identity";

const BASE_URL = String(process.env.GA4_KPI_VALIDATION_BASE_URL || "https://marketforensics.onrender.com").replace(/\/$/, "");
const EXPECTED_SHA = String(process.env.GA4_KPI_VALIDATION_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.GA4_KPI_VALIDATION_CAMPAIGN_ID || "").trim();
const clerkSecret = String(process.env.CLERK_SECRET_KEY || "").trim();

if (!pool) throw new Error("DATABASE_URL is required");
if (!clerkSecret) throw new Error("CLERK_SECRET_KEY is required");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("GA4_KPI_VALIDATION_EXPECTED_SHA must be a full Git SHA");
if (!/^[0-9a-f-]{36}$/i.test(CAMPAIGN_ID)) throw new Error("GA4_KPI_VALIDATION_CAMPAIGN_ID must be an exact campaign UUID");

type ApiResult = { status: number; ok: boolean; body: any };
type AuthSession = { context: BrowserContext; page: Page; sessionId: string; signInTokenId: string };

const opaque = (value: unknown) => createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 12);
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
const stableKpi = (row: any) => JSON.stringify({
  id: row?.id,
  name: row?.name,
  metric: row?.metric,
  description: row?.description,
  unit: row?.unit,
  currentValue: row?.currentValue,
  targetValue: row?.targetValue,
  alertsEnabled: row?.alertsEnabled,
  alertThreshold: row?.alertThreshold,
  alertCondition: row?.alertCondition,
  updatedAt: row?.updatedAt,
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
  const response = await fetch(input.path, {
    method: input.method,
    credentials: "include",
    headers: input.body === undefined ? undefined : { "Content-Type": "application/json" },
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
let temporaryKpiId = "";
let temporaryReportId = "";
let temporaryClerkUserId = "";
let thrown: unknown = null;
let output: Record<string, unknown> | null = null;

try {
  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json().catch(() => null);
  check(healthResponse.ok && health?.commit === EXPECTED_SHA, `Deployed SHA mismatch: ${String(health?.commit || "unavailable")}`);

  const campaignResult = await client.query(`
    SELECT c.owner_id, c.client_id, c.currency
    FROM campaigns c
    WHERE c.id = $1
  `, [CAMPAIGN_ID]);
  check(campaignResult.rowCount === 1, "Target campaign was not found");
  const campaign = campaignResult.rows[0];
  check(campaign.owner_id && campaign.client_id, "Target campaign ownership/client scope is incomplete");

  browser = await chromium.launch({ headless: true });
  ownerAuth = await authenticate(browser, String(campaign.owner_id));
  const kpiPath = `/api/platforms/google_analytics/kpis?campaignId=${encodeURIComponent(CAMPAIGN_ID)}`;
  const initialList = await api(ownerAuth.page, "GET", kpiPath);
  check(initialList.ok && Array.isArray(initialList.body), "Owner KPI inventory request failed");
  const scheduler = await api(ownerAuth.page, "POST", `/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/ga4-daily-scheduler/run-now`);
  check(scheduler.ok && scheduler.body?.success === true,
    `Campaign scheduler validation failed (${scheduler.status}): ${JSON.stringify(scheduler.body).slice(0, 800)}`);
  const reconciliation = await api(ownerAuth.page, "POST", `/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/ga4-notifications/reconcile`);
  check(reconciliation.ok && reconciliation.body?.success === true,
    `KPI alert reconciliation failed (${reconciliation.status}): ${JSON.stringify(reconciliation.body).slice(0, 800)}`);
  const standardRows = initialList.body.filter((row: any) => resolveGA4KpiMetricIdentity(row?.metric, row?.name));
  check(standardRows.length > 0, "No standard GA4 KPI exists for duplicate validation");
  const duplicateRow = standardRows[0];
  const editableDuplicateRow = standardRows.find((row: any) => {
    const identity = resolveGA4KpiMetricIdentity(row?.metric, row?.name);
    const expectedUnit = identity === "revenue" || identity === "cpa" ? String(campaign.currency || "").toUpperCase()
      : identity === "roas" ? "ratio"
        : identity === "roi" || identity === "conversion_rate" || identity === "engagement_rate" ? "%"
          : "count";
    return String(row?.unit || "") === expectedUnit;
  });
  check(editableDuplicateRow, "No standard GA4 KPI has a current canonical unit for edit-duplicate validation");

  const duplicateCreate = await api(ownerAuth.page, "POST", "/api/platforms/google_analytics/kpis", {
    campaignId: CAMPAIGN_ID,
    name: duplicateRow.name,
    metric: duplicateRow.metric,
    description: "Temporary duplicate validation",
    unit: duplicateRow.unit,
    currentValue: duplicateRow.currentValue || "0",
    targetValue: duplicateRow.targetValue,
    priority: "low",
    status: "tracking",
    alertsEnabled: false,
  });
  check(duplicateCreate.status === 409 && duplicateCreate.body?.code === "GA4_KPI_ACTIVE_METRIC_CONFLICT", "Duplicate GA4 KPI create did not fail closed");

  const marker = `Certification Custom ${Date.now()}`;
  const created = await api(ownerAuth.page, "POST", "/api/platforms/google_analytics/kpis", {
    campaignId: CAMPAIGN_ID,
    name: marker,
    metric: "__custom__",
    description: "Temporary KPI lifecycle validation",
    unit: "count",
    currentValue: "7",
    targetValue: "11",
    priority: "low",
    status: "tracking",
    alertsEnabled: false,
    alertCondition: "below",
  });
  check(created.ok && created.body?.id, `Temporary KPI create failed (${created.status})`);
  temporaryKpiId = String(created.body.id);

  const readTemporary = async () => {
    const response = await api(ownerAuth!.page, "GET", kpiPath);
    check(response.ok && Array.isArray(response.body), "KPI inventory refresh failed");
    return response.body.find((row: any) => String(row?.id) === temporaryKpiId);
  };
  let temporaryRow = await readTemporary();
  check(temporaryRow && Number(temporaryRow.currentValue) === 7 && Number(temporaryRow.targetValue) === 11, "Created KPI values did not persist exactly");

  const invalidEdits = [
    { body: { targetValue: "0", currentValue: "9876543210987654.32" }, label: "target" },
    { body: { unit: "visits" }, label: "unit" },
    { body: { alertCondition: "sideways" }, label: "operator" },
    { body: { alertsEnabled: true, alertThreshold: null }, label: "threshold" },
  ];
  for (const invalid of invalidEdits) {
    const before = stableKpi(await readTemporary());
    const response = await api(ownerAuth.page, "PATCH", `/api/platforms/google_analytics/kpis/${encodeURIComponent(temporaryKpiId)}`, invalid.body);
    check(response.status === 400 && response.body?.code === "GA4_KPI_INVALID_CONFIGURATION", `Invalid ${invalid.label} edit did not return the KPI validation error`);
    check(stableKpi(await readTemporary()) === before, `Invalid ${invalid.label} edit changed the persisted KPI`);
  }

  const partialEdit = await api(ownerAuth.page, "PATCH", `/api/platforms/google_analytics/kpis/${encodeURIComponent(temporaryKpiId)}`, {
    description: "Partial edit preserved omitted fields",
  });
  check(partialEdit.ok, `Partial KPI edit failed (${partialEdit.status})`);
  temporaryRow = await readTemporary();
  check(Number(temporaryRow.currentValue) === 7 && Number(temporaryRow.targetValue) === 11 && temporaryRow.unit === "count", "Partial KPI edit changed omitted values");

  const validEdit = await api(ownerAuth.page, "PATCH", `/api/platforms/google_analytics/kpis/${encodeURIComponent(temporaryKpiId)}`, {
    currentValue: "8",
    targetValue: "12",
    unit: "count",
    alertsEnabled: false,
    alertThreshold: "9",
    alertCondition: "above",
  });
  check(validEdit.ok, `Valid KPI edit failed (${validEdit.status})`);
  temporaryRow = await readTemporary();
  check(Number(temporaryRow.currentValue) === 8 && Number(temporaryRow.targetValue) === 12
    && temporaryRow.unit === "count" && temporaryRow.alertCondition === "above" && Number(temporaryRow.alertThreshold) === 9,
  "Valid KPI edit did not preserve exact values and alert configuration");

  const duplicateEdit = await api(ownerAuth.page, "PATCH", `/api/platforms/google_analytics/kpis/${encodeURIComponent(temporaryKpiId)}`, {
    name: editableDuplicateRow.name,
    metric: editableDuplicateRow.metric,
    unit: editableDuplicateRow.unit,
  });
  check(duplicateEdit.status === 409 && duplicateEdit.body?.code === "GA4_KPI_ACTIVE_METRIC_CONFLICT", "Duplicate GA4 KPI edit did not fail closed");
  check(String((await readTemporary())?.metric) === "__custom__", "Rejected duplicate edit changed the temporary KPI");

  const standardBeforeTarget = String(editableDuplicateRow.targetValue);
  const standardSentinelEdit = await api(ownerAuth.page, "PATCH", `/api/platforms/google_analytics/kpis/${encodeURIComponent(String(editableDuplicateRow.id))}`, {
    currentValue: "9876543210987654.32",
  });
  check(standardSentinelEdit.ok, `Standard current-value preservation edit failed (${standardSentinelEdit.status})`);
  const afterSentinelList = await api(ownerAuth.page, "GET", kpiPath);
  const afterSentinel = Array.isArray(afterSentinelList.body)
    ? afterSentinelList.body.find((row: any) => String(row?.id) === String(editableDuplicateRow.id))
    : null;
  check(afterSentinel && String(afterSentinel.currentValue) !== "9876543210987654.32" && String(afterSentinel.targetValue) === standardBeforeTarget,
    "Browser-supplied standard KPI current value was not discarded");

  const sameOwnerOtherClient = await client.query(`
    SELECT id FROM campaigns
    WHERE owner_id = $1 AND client_id <> $2 AND id <> $3
    ORDER BY created_at
    LIMIT 1
  `, [campaign.owner_id, campaign.client_id, CAMPAIGN_ID]);
  check(sameOwnerOtherClient.rowCount === 1, "A second client-scoped campaign was not available for deployed isolation validation");
  const otherCampaignId = String(sameOwnerOtherClient.rows[0].id);
  const otherCampaignList = await api(ownerAuth.page, "GET", `/api/platforms/google_analytics/kpis?campaignId=${encodeURIComponent(otherCampaignId)}`);
  check(otherCampaignList.ok && Array.isArray(otherCampaignList.body)
    && !otherCampaignList.body.some((row: any) => String(row?.id) === temporaryKpiId), "KPI list crossed the client/campaign boundary");

  const temporaryUserResponse = await clerkPost("/users", {
    email_address: [`ga4-kpi-cert-${Date.now()}@example.com`],
    password: `G4!${randomBytes(18).toString("base64url")}aA1!`,
    private_metadata: { purpose: "temporary GA4 KPI tenant-isolation certification" },
  });
  const temporaryUser: any = await temporaryUserResponse.json().catch(() => ({}));
  check(temporaryUserResponse.ok && temporaryUser?.id, `Temporary Clerk user creation failed (${temporaryUserResponse.status})`);
  temporaryClerkUserId = String(temporaryUser.id);
  outsiderAuth = await authenticate(browser, temporaryClerkUserId);
  const outsiderList = await api(outsiderAuth!.page, "GET", kpiPath);
  const outsiderEdit = await api(outsiderAuth!.page, "PATCH", `/api/platforms/google_analytics/kpis/${encodeURIComponent(temporaryKpiId)}`, { targetValue: "99" });
  const outsiderDelete = await api(outsiderAuth!.page, "DELETE", `/api/platforms/google_analytics/kpis/${encodeURIComponent(temporaryKpiId)}`);
  check(outsiderList.status === 404 && outsiderEdit.status === 404 && outsiderDelete.status === 404, "Cross-owner KPI access did not fail closed");
  check(await readTemporary(), "Cross-owner mutation changed the temporary KPI");

  const deleted = await api(ownerAuth.page, "DELETE", `/api/platforms/google_analytics/kpis/${encodeURIComponent(temporaryKpiId)}`);
  check(deleted.ok && deleted.body?.success === true, `Temporary KPI delete failed (${deleted.status})`);
  check(!(await readTemporary()), "Deleted KPI remained visible in its campaign inventory");
  const childCounts = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM kpis WHERE id = $1) AS kpis,
      (SELECT COUNT(*)::int FROM kpi_progress WHERE kpi_id = $1) AS progress,
      (SELECT COUNT(*)::int FROM kpi_alerts WHERE kpi_id = $1) AS alerts,
      (SELECT COUNT(*)::int FROM kpi_periods WHERE kpi_id = $1) AS periods
  `, [temporaryKpiId]);
  check(Object.values(childCounts.rows[0] || {}).every((value) => Number(value) === 0), "Temporary KPI delete left persisted child rows");
  const deletedKpiHash = opaque(temporaryKpiId);
  temporaryKpiId = "";

  const report = await api(ownerAuth.page, "POST", "/api/platforms/google_analytics/reports", {
    campaignId: CAMPAIGN_ID,
    name: `KPI Certification Report ${Date.now()}`,
    description: "Temporary authenticated KPI PDF validation report",
    reportType: "kpis",
    scheduleEnabled: false,
    status: "active",
  });
  check(report.status === 201 && report.body?.id, `Temporary KPI report create failed (${report.status})`);
  temporaryReportId = String(report.body.id);

  const tsxCli = resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  const live = spawnSync(process.execPath, [tsxCli, "scripts/ga4-kpi-live-readonly.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      GA4_KPI_VALIDATION_BASE_URL: BASE_URL,
      GA4_KPI_VALIDATION_EXPECTED_SHA: EXPECTED_SHA,
      GA4_KPI_VALIDATION_CAMPAIGN_ID: CAMPAIGN_ID,
    },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  check(live.status === 0, `Authenticated read-only consumer validation failed: ${String(live.stderr || live.stdout).slice(-1000)}`);
  const liveEvidence = JSON.parse(String(live.stdout || "{}").trim());
  check(liveEvidence?.success === true && liveEvidence?.browserPdf?.exact === true, "Authenticated consumer/PDF evidence did not pass exactly");

  output = {
    success: true,
    deployedSha: EXPECTED_SHA,
    campaignHash: opaque(CAMPAIGN_ID),
    ownerHash: opaque(campaign.owner_id),
    clientHash: opaque(campaign.client_id),
    lifecycle: {
      duplicateCreateRejected: true,
      createReadEditDelete: true,
      invalidTargetUnitOperatorThresholdPreserved: true,
      partialEditPreservedOmittedValues: true,
      duplicateEditRejected: true,
      standardCurrentValueSentinelDiscarded: true,
      crossClientCampaignListIsolated: true,
      crossOwnerReadEditDeleteDenied: true,
      childCleanupVerified: true,
      deletedKpiHash,
    },
    scheduler: {
      manualCampaignRun: true,
      trigger: scheduler.body?.trigger || "manual",
      lastRunStatus: scheduler.body?.after?.lastRunStatus || null,
      reconciliation: true,
    },
    consumers: {
      kpiCount: liveEvidence.kpiCount,
      cardsExact: liveEvidence.cards?.every((row: any) => Object.values(row.checks || {}).every(Boolean)) === true,
      trackerExact: liveEvidence.tracker?.exact === true,
      notificationsExact: liveEvidence.alertsAndNotifications?.exact === true,
      insightsExact: liveEvidence.insights?.every((row: any) => row.exact === true) === true,
      browserPdfExact: liveEvidence.browserPdf?.exact === true,
      persistenceUnchangedDuringReadOnlyValidation: liveEvidence.persistenceSemanticStateUnchanged === true,
    },
  };
} catch (error) {
  thrown = error;
} finally {
  const cleanupErrors: string[] = [];
  if (ownerAuth && temporaryReportId) {
    const deleted = await api(ownerAuth.page, "DELETE", `/api/platforms/google_analytics/reports/${encodeURIComponent(temporaryReportId)}`).catch(() => null);
    if (!deleted?.ok) cleanupErrors.push("temporary report cleanup failed");
  }
  if (ownerAuth && temporaryKpiId) {
    const deleted = await api(ownerAuth.page, "DELETE", `/api/platforms/google_analytics/kpis/${encodeURIComponent(temporaryKpiId)}`).catch(() => null);
    if (!deleted?.ok) cleanupErrors.push("temporary KPI cleanup failed");
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
if (!output) throw new Error("KPI lifecycle evidence was not produced");
console.log(JSON.stringify(output, null, 2));
