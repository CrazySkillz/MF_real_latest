import { createHash, randomBytes } from "node:crypto";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { pool } from "../server/db";

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
const definitionSignature = (row: any) => JSON.stringify({
  id: row?.id,
  campaignId: row?.campaignId,
  platformType: row?.platformType,
  status: row?.status,
  name: row?.name,
  metric: row?.metric,
  category: row?.category,
  benchmarkValue: row?.benchmarkValue,
  currentValue: row?.currentValue,
  unit: row?.unit,
  benchmarkType: row?.benchmarkType,
  period: row?.period,
  alertsEnabled: row?.alertsEnabled,
});

const clerkPost = async (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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

const postConcurrently = (page: Page, path: string, body: unknown): Promise<ApiResult[]> => page.evaluate(async (input) => {
  const token = await (window as any).Clerk?.session?.getToken();
  if (!token) throw new Error("Clerk session token is unavailable");
  const responses = await Promise.all([
    fetch(input.path, {
      method: "POST",
      credentials: "include",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(input.body),
    }),
    fetch(input.path, {
      method: "POST",
      credentials: "include",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(input.body),
    }),
  ]);
  const results: ApiResult[] = [];
  for (const response of responses) {
    const text = await response.text();
    let parsed: any = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    results.push({ status: response.status, ok: response.ok, body: parsed });
  }
  return results;
}, { path, body });

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
let temporaryBenchmarkId = "";
let thrown: unknown = null;
let output: Record<string, unknown> | null = null;

const duplicateFingerprint = async (benchmarkIds: string[]) => {
  if (benchmarkIds.length === 0) return [];
  const result = await client.query(`
    SELECT benchmark_id, DATE(recorded_at)::text AS recorded_date, COALESCE(notes, '') AS scope_note,
      COUNT(*)::int AS row_count, ARRAY_AGG(id ORDER BY id) AS row_ids
    FROM benchmark_history
    WHERE benchmark_id = ANY($1::text[])
    GROUP BY benchmark_id, DATE(recorded_at), COALESCE(notes, '')
    HAVING COUNT(*) > 1
    ORDER BY benchmark_id, recorded_date, scope_note
  `, [benchmarkIds]);
  return result.rows.map((row: any) => ({
    benchmarkHash: opaque(row.benchmark_id),
    recordedDate: row.recorded_date,
    scopeHash: opaque(row.scope_note),
    rowCount: Number(row.row_count),
    rowHashes: (Array.isArray(row.row_ids) ? row.row_ids : []).map(opaque).sort(),
  }));
};

try {
  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json().catch(() => null);
  check(healthResponse.ok && health?.commit === EXPECTED_SHA, `Deployed SHA mismatch: ${String(health?.commit || "unavailable")}`);

  const campaignResult = await client.query(`
    SELECT owner_id, client_id, currency
    FROM campaigns
    WHERE id = $1
  `, [CAMPAIGN_ID]);
  check(campaignResult.rowCount === 1, "Target campaign was not found");
  const campaign = campaignResult.rows[0];
  check(campaign.owner_id && campaign.client_id, "Target campaign ownership/client scope is incomplete");

  browser = await chromium.launch({ headless: true });
  ownerAuth = await authenticate(browser, String(campaign.owner_id));
  const benchmarkPath = `/api/platforms/google_analytics/benchmarks?campaignId=${encodeURIComponent(CAMPAIGN_ID)}`;
  const initialList = await api(ownerAuth.page, "GET", benchmarkPath);
  check(initialList.ok && Array.isArray(initialList.body), "Initial Benchmark inventory request failed");
  const initialDefinitions = new Map(initialList.body.map((row: any) => [String(row.id), definitionSignature(row)]));
  const initialIds = [...initialDefinitions.keys()];
  const duplicatesBefore = await duplicateFingerprint(initialIds);

  const nonce = randomBytes(10).toString("hex");
  const marker = `Temporary concurrency validation ${nonce}`;
  const created = await api(ownerAuth.page, "POST", "/api/benchmarks", {
    campaignId: CAMPAIGN_ID,
    platformType: "google_analytics",
    name: marker,
    metric: "__custom__",
    description: "Temporary GA4 Benchmark history concurrency validation",
    category: "performance",
    benchmarkType: "goal",
    period: "monthly",
    unit: "count",
    currentValue: "1",
    benchmarkValue: "1",
    alertsEnabled: false,
    emailNotifications: false,
  });
  check(created.status === 201 && created.body?.id, `Temporary Benchmark create failed (${created.status})`);
  temporaryBenchmarkId = String(created.body.id);

  const historyNote = `auto:ga4_daily:${new Date().toISOString().slice(0, 10)};ga4_scope_v1:temporary_concurrency:${nonce}`;
  const historyBody = {
    currentValue: "1",
    benchmarkValue: "1",
    variance: "0",
    performanceRating: "average",
    notes: historyNote,
  };
  const responses = await postConcurrently(
    ownerAuth.page,
    `/api/benchmarks/${encodeURIComponent(temporaryBenchmarkId)}/history`,
    historyBody,
  );
  check(responses.length === 2 && responses.every((response) => response.ok),
    `Concurrent history requests failed (${responses.map((response) => response.status).join(",")})`);
  check(String(responses[0]?.body?.id || "") && String(responses[0]?.body?.id) === String(responses[1]?.body?.id),
    "Concurrent history requests did not resolve to the same logical row");

  const stored = await client.query(`
    SELECT id
    FROM benchmark_history
    WHERE benchmark_id = $1 AND notes = $2
    ORDER BY id
  `, [temporaryBenchmarkId, historyNote]);
  check(stored.rowCount === 1, `Expected one temporary history row, found ${stored.rowCount}`);

  const deleted = await api(ownerAuth.page, "DELETE", `/api/platforms/google_analytics/benchmarks/${encodeURIComponent(temporaryBenchmarkId)}`);
  check(deleted.ok && deleted.body?.success === true, `Temporary Benchmark delete failed (${deleted.status})`);
  const deletedCounts = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM benchmarks WHERE id = $1) AS benchmark_count,
      (SELECT COUNT(*)::int FROM benchmark_history WHERE benchmark_id = $1) AS history_count
  `, [temporaryBenchmarkId]);
  check(Number(deletedCounts.rows[0]?.benchmark_count) === 0 && Number(deletedCounts.rows[0]?.history_count) === 0,
    "Temporary Benchmark cleanup left a parent or history row");
  const deletedBenchmarkHash = opaque(temporaryBenchmarkId);
  temporaryBenchmarkId = "";

  const finalList = await api(ownerAuth.page, "GET", benchmarkPath);
  check(finalList.ok && Array.isArray(finalList.body) && finalList.body.length === initialDefinitions.size,
    "Final Benchmark inventory count did not return to its initial boundary");
  check(finalList.body.every((row: any) => initialDefinitions.get(String(row.id)) === definitionSignature(row)),
    "An existing Benchmark definition changed during concurrency validation");
  const duplicatesAfter = await duplicateFingerprint(initialIds);
  check(JSON.stringify(duplicatesAfter) === JSON.stringify(duplicatesBefore),
    "The pre-existing duplicate-history boundary changed during concurrency validation");

  output = {
    success: true,
    deployedSha: EXPECTED_SHA,
    campaignHash: opaque(CAMPAIGN_ID),
    ownerHash: opaque(campaign.owner_id),
    clientHash: opaque(campaign.client_id),
    temporaryBenchmarkHash: deletedBenchmarkHash,
    concurrentRequests: responses.length,
    responseRowHashes: responses.map((response) => opaque(response.body?.id)),
    storedLogicalRows: stored.rowCount,
    temporaryCleanup: { benchmarkRows: 0, historyRows: 0 },
    existingDefinitionsUnchanged: true,
    existingDuplicateGroupsBefore: duplicatesBefore.length,
    existingDuplicateGroupsAfter: duplicatesAfter.length,
    existingDuplicateBoundaryUnchanged: true,
  };
} catch (error) {
  thrown = error;
} finally {
  const cleanupErrors: string[] = [];
  if (ownerAuth && temporaryBenchmarkId) {
    const deleted = await api(ownerAuth.page, "DELETE", `/api/platforms/google_analytics/benchmarks/${encodeURIComponent(temporaryBenchmarkId)}`).catch(() => null);
    if (!deleted?.ok) cleanupErrors.push("temporary Benchmark cleanup failed");
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM benchmarks WHERE id = $1) AS benchmark_count,
        (SELECT COUNT(*)::int FROM benchmark_history WHERE benchmark_id = $1) AS history_count
    `, [temporaryBenchmarkId]).catch(() => null);
    if (!counts || Number(counts.rows[0]?.benchmark_count) !== 0 || Number(counts.rows[0]?.history_count) !== 0) {
      cleanupErrors.push("temporary Benchmark cleanup could not be proven");
    }
  }
  await revoke(ownerAuth).catch((error) => cleanupErrors.push(String((error as Error).message || error)));
  if (browser) await browser.close().catch(() => null);
  client.release();
  await pool.end().catch(() => null);
  if (cleanupErrors.length > 0) thrown = new Error([
    thrown instanceof Error ? thrown.message : thrown ? String(thrown) : "",
    ...cleanupErrors,
  ].filter(Boolean).join("; "));
}

if (thrown) throw thrown;
if (!output) throw new Error("Benchmark history concurrency evidence was not produced");
console.log(JSON.stringify(output, null, 2));
