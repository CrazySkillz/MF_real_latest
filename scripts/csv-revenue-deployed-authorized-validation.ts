import { chromium, type APIResponse, type Browser, type BrowserContext, type Page } from "playwright";
import { pool } from "../server/db";

const BASE_URL = String(process.env.CSV_REVENUE_VALIDATION_BASE_URL || "https://marketforensics.onrender.com").replace(/\/$/, "");
const EXPECTED_SHA = String(process.env.CSV_REVENUE_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.CSV_REVENUE_VALIDATION_CAMPAIGN_ID || "").trim();
const clerkSecret = String(process.env.CLERK_SECRET_KEY || "").trim();

if (!pool) throw new Error("DATABASE_URL is required");
if (!clerkSecret) throw new Error("CLERK_SECRET_KEY is required");
if (!/^[0-9a-f-]{36}$/i.test(CAMPAIGN_ID)) throw new Error("CSV_REVENUE_VALIDATION_CAMPAIGN_ID must be an explicit campaign UUID");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("CSV_REVENUE_EXPECTED_SHA must be the exact 40-character deployed SHA");

type Result = { ok: boolean; status: number; body: any; headers: Record<string, string> };
type CsvFile = { name: string; text: string };

const checks: Record<string, boolean> = {};
const observations: Record<string, any> = {};
const failures: string[] = [];
const createdSourceIds = new Set<string>();

const assertCheck = (name: string, condition: unknown, detail?: unknown) => {
  const pass = condition === true;
  checks[name] = pass;
  if (!pass) failures.push(detail === undefined ? name : `${name}: ${JSON.stringify(detail)}`);
};

const money = (value: unknown) => Number(Number(value || 0).toFixed(2));
const rowsOf = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  for (const key of ["sources", "revenueSources", "breakdown", "rows", "data"]) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
};
const sourceIdOf = (row: any) => String(row?.sourceId || row?.id || row?.revenueSourceId || "");
const sourceAmountOf = (row: any) => money(row?.revenue ?? row?.lastTotalRevenue ?? row?.amount ?? row?.totalRevenue ?? row?.total ?? row?.value);
const firstNumber = (value: any, keys: string[]): number | null => {
  for (const key of keys) {
    const parsed = Number(value?.[key]);
    if (Number.isFinite(parsed)) return money(parsed);
  }
  return null;
};

const clerkPost = async (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const readOnly = async <T>(fn: (client: any) => Promise<T>): Promise<T> => {
  const client = await pool!.connect();
  let open = false;
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    open = true;
    const value = await fn(client);
    await client.query("ROLLBACK");
    open = false;
    return value;
  } finally {
    if (open) await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
};

const campaignRow = async () => readOnly(async (client) => {
  const result = await client.query(`
    SELECT
      c.id,
      c.owner_id AS "ownerId",
      COALESCE(NULLIF(TRIM(c.currency), ''), 'USD') AS currency,
      c.reporting_time_zone AS "reportingTimeZone",
      connection.property_id AS "propertyId"
    FROM campaigns c
    LEFT JOIN LATERAL (
      SELECT property_id
      FROM ga4_connections
      WHERE campaign_id = c.id AND is_active = true
      ORDER BY is_primary DESC, connected_at ASC
      LIMIT 1
    ) connection ON true
    WHERE c.id = $1
  `, [CAMPAIGN_ID]);
  return result.rows[0] || null;
});

const databaseState = async () => readOnly(async (client) => {
  const result = await client.query(`
    SELECT
      COUNT(DISTINCT s.id) FILTER (WHERE s.is_active = true)::int AS "activeSourceCount",
      COUNT(DISTINCT s.id) FILTER (WHERE s.is_active = false)::int AS "inactiveSourceCount",
      COALESCE(SUM(r.revenue) FILTER (WHERE s.is_active = true AND r.sub_campaign_urn IS NULL), 0)::text AS "activeRevenue",
      COUNT(r.id) FILTER (WHERE s.is_active = true AND r.sub_campaign_urn IS NULL)::int AS "activeRecordCount",
      ARRAY_AGG(DISTINCT s.id::text ORDER BY s.id::text) FILTER (WHERE s.is_active = true) AS "activeSourceIds"
    FROM revenue_sources s
    LEFT JOIN revenue_records r
      ON r.revenue_source_id = s.id::text
     AND r.campaign_id = s.campaign_id
    WHERE s.campaign_id = $1
      AND LOWER(COALESCE(s.source_type, '')) = 'csv'
      AND LOWER(COALESCE(NULLIF(TRIM(s.platform_context), ''), 'ga4')) = 'ga4'
  `, [CAMPAIGN_ID]);
  const row = result.rows[0] || {};
  return {
    activeSourceCount: Number(row.activeSourceCount || 0),
    inactiveSourceCount: Number(row.inactiveSourceCount || 0),
    activeRevenue: money(row.activeRevenue),
    activeRecordCount: Number(row.activeRecordCount || 0),
    activeSourceIds: (row.activeSourceIds || []).map(String).sort(),
  };
});

const exactSourceState = async (sourceId: string) => readOnly(async (client) => {
  const result = await client.query(`
    SELECT
      s.id::text AS id,
      s.is_active AS "isActive",
      s.display_name AS "displayName",
      s.mapping_config AS "mappingConfig",
      COALESCE(SUM(r.revenue) FILTER (WHERE r.sub_campaign_urn IS NULL), 0)::text AS revenue,
      COUNT(r.id) FILTER (WHERE r.sub_campaign_urn IS NULL)::int AS "recordCount"
    FROM revenue_sources s
    LEFT JOIN revenue_records r
      ON r.revenue_source_id = s.id::text
     AND r.campaign_id = s.campaign_id
    WHERE s.campaign_id = $1 AND s.id::text = $2
    GROUP BY s.id
  `, [CAMPAIGN_ID, sourceId]);
  const row = result.rows[0];
  if (!row) return null;
  return { ...row, revenue: money(row.revenue), recordCount: Number(row.recordCount || 0) };
});

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let sessionId = "";
let signInTokenId = "";
let rateRemaining: number | null = null;
let rateResetAt = 0;

const responseResult = async (response: APIResponse): Promise<Result> => {
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  const headers = response.headers();
  return { ok: response.ok(), status: response.status(), body, headers };
};

const updateImportBudget = (result: Result) => {
  const headers = result.headers;
  const remaining = Number(headers["ratelimit-remaining"]);
  if (Number.isFinite(remaining)) rateRemaining = remaining;
  const reset = Number(headers["ratelimit-reset"] || headers["retry-after"]);
  if (Number.isFinite(reset) && reset > 0) rateResetAt = Date.now() + (reset + 2) * 1000;
};

const token = async () => {
  if (!page) throw new Error("Authenticated page is unavailable");
  const value = await page.evaluate(() => (window as any).Clerk?.session?.getToken());
  if (!value) throw new Error("Clerk session token is unavailable");
  return String(value);
};

const get = async (path: string): Promise<Result> => {
  if (!context) throw new Error("Authenticated context is unavailable");
  const response = await context.request.get(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${await token()}` },
    failOnStatusCode: false,
  });
  return responseResult(response);
};

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const ensureImportBudget = async (required = 1) => {
  if (rateRemaining === null || rateRemaining >= required) return;
  const waitMs = Math.max(1_000, rateResetAt - Date.now());
  console.log(JSON.stringify({ stage: "rate-limit-wait", required, rateRemaining, waitSeconds: Math.ceil(waitMs / 1000) }));
  await delay(waitMs);
  rateRemaining = null;
  rateResetAt = 0;
};

const rawCsvRequest = async (path: "preview" | "process", mapping: any, file?: CsvFile): Promise<Result> => {
  if (!context) throw new Error("Authenticated context is unavailable");
  const multipart: Record<string, any> = {
    platformContext: "ga4",
    ...(path === "process" ? { mapping: JSON.stringify(mapping) } : {}),
  };
  if (file) multipart.file = { name: file.name, mimeType: "text/csv", buffer: Buffer.from(file.text, "utf8") };
  const response = await context.request.post(`${BASE_URL}/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/revenue/csv/${path}`, {
    headers: { Authorization: `Bearer ${await token()}` },
    multipart,
    failOnStatusCode: false,
    timeout: 120_000,
  });
  const result = await responseResult(response);
  updateImportBudget(result);
  return result;
};

const csvRequest = async (path: "preview" | "process", mapping: any, file?: CsvFile): Promise<Result> => {
  await ensureImportBudget(1);
  let result = await rawCsvRequest(path, mapping, file);
  if (result.status === 429) {
    const retryAfter = Number(result.headers["retry-after"] || result.headers["ratelimit-reset"] || 300);
    const waitMs = (Math.max(1, retryAfter) + 2) * 1000;
    console.log(JSON.stringify({ stage: "rate-limit-retry", waitSeconds: Math.ceil(waitMs / 1000) }));
    await delay(waitMs);
    rateRemaining = null;
    rateResetAt = 0;
    result = await rawCsvRequest(path, mapping, file);
  }
  return result;
};

const csvPair = async (mappingA: any, fileA: CsvFile | undefined, mappingB: any, fileB: CsvFile | undefined) => {
  await ensureImportBudget(2);
  return Promise.all([
    rawCsvRequest("process", mappingA, fileA),
    rawCsvRequest("process", mappingB, fileB),
  ]);
};

const deleteSource = async (sourceId: string): Promise<Result> => {
  if (!context) throw new Error("Authenticated context is unavailable");
  const response = await context.request.delete(`${BASE_URL}/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/revenue-sources/${encodeURIComponent(sourceId)}?platformContext=ga4`, {
    headers: { Authorization: `Bearer ${await token()}` },
    failOnStatusCode: false,
  });
  return responseResult(response);
};

const endpointSnapshot = async () => {
  const [sources, toDate, breakdown, daily, spend, kpis, benchmarks, reports] = await Promise.all([
    get(`/api/campaigns/${CAMPAIGN_ID}/revenue-sources?platformContext=ga4`),
    get(`/api/campaigns/${CAMPAIGN_ID}/revenue-to-date?platformContext=ga4`),
    get(`/api/campaigns/${CAMPAIGN_ID}/revenue-breakdown?platformContext=ga4`),
    get(`/api/campaigns/${CAMPAIGN_ID}/revenue-daily`),
    get(`/api/campaigns/${CAMPAIGN_ID}/spend-to-date?platformContext=ga4`),
    get(`/api/platforms/google_analytics/kpis?campaignId=${CAMPAIGN_ID}`),
    get(`/api/platforms/google_analytics/benchmarks?campaignId=${CAMPAIGN_ID}`),
    get(`/api/platforms/google_analytics/reports?campaignId=${CAMPAIGN_ID}`),
  ]);
  const sourceRows = rowsOf(sources.body);
  const breakdownRows = rowsOf(breakdown.body);
  return {
    endpointPass: [sources, toDate, breakdown, daily, spend, kpis, benchmarks, reports].every((result) => result.ok),
    statuses: { sources: sources.status, toDate: toDate.status, breakdown: breakdown.status, daily: daily.status, spend: spend.status, kpis: kpis.status, benchmarks: benchmarks.status, reports: reports.status },
    sourceRows,
    breakdownRows,
    dailyRows: rowsOf(daily.body),
    revenueToDate: firstNumber(toDate.body, ["totalRevenue", "revenue", "total", "amount"]),
    breakdownTotal: firstNumber(breakdown.body, ["totalRevenue", "revenue", "total", "amount"]),
    spendToDate: firstNumber(spend.body, ["spendToDate", "totalSpend", "spend", "total", "amount"]),
    kpiCount: rowsOf(kpis.body).length,
    benchmarkCount: rowsOf(benchmarks.body).length,
    reportCount: rowsOf(reports.body).length,
  };
};

const selectedCsv = (name: string, replacements?: Record<string, number>) => {
  const lines = ["Date,Revenue,Campaign"];
  for (let index = 1; index <= 26; index++) lines.push(`2026-09-${String((index % 10) + 1).padStart(2, "0")},1,OTHER_${index}`);
  lines.push(`2026-09-01,${replacements?.A1 ?? 30},TARGET_A`);
  lines.push(`2026-09-02,${replacements?.A2 ?? 20},TARGET_A`);
  lines.push(`2026-09-03,${replacements?.B1 ?? 40},TARGET_B`);
  lines.push(`2026-09-04,${replacements?.B2 ?? 10},TARGET_B`);
  return { name, text: lines.join("\n") };
};

const timestamp = Date.now();
const primaryName = `csv-cert-${timestamp}-primary.csv`;
const snapshotName = `csv-cert-${timestamp}-snapshot.csv`;
const duplicateName = `csv-cert-${timestamp}-duplicate.csv`;

let baselineDb: Awaited<ReturnType<typeof databaseState>> | null = null;
let baselineEndpoints: Awaited<ReturnType<typeof endpointSnapshot>> | null = null;
let primarySourceId = "";
let fatalError: string | null = null;

try {
  const campaign = await campaignRow();
  if (!campaign) throw new Error("Authorized validation campaign was not found");
  observations.campaign = { id: CAMPAIGN_ID, currency: campaign.currency, propertyConfigured: Boolean(campaign.propertyId), reportingTimeZone: campaign.reportingTimeZone || "UTC" };

  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json().catch(() => null);
  assertCheck("exactDeploymentSha", healthResponse.ok && health?.commit === EXPECTED_SHA, health);

  browser = await chromium.launch({ headless: true });
  const signIn = await clerkPost("/sign_in_tokens", { user_id: campaign.ownerId, expires_in_seconds: 1800 });
  const signInBody: any = await signIn.json().catch(() => ({}));
  if (!signIn.ok || !signInBody?.token) throw new Error(`Clerk sign-in token failed (${signIn.status})`);
  signInTokenId = String(signInBody.id || "");
  context = await browser.newContext();
  page = await context.newPage();
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(signInBody.token))}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60_000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ""));

  baselineDb = await databaseState();
  baselineEndpoints = await endpointSnapshot();
  assertCheck("baselineEndpointsPass", baselineEndpoints.endpointPass, baselineEndpoints.statuses);

  const unauthenticated = await (await playwrightUnauthenticatedGet(`${BASE_URL}/api/campaigns/${CAMPAIGN_ID}/revenue-sources?platformContext=ga4`));
  assertCheck("unauthenticatedCampaignRejected", [401, 403].includes(unauthenticated.status), unauthenticated.status);

  const primaryFile = selectedCsv(primaryName);
  const preview = await csvRequest("preview", {}, primaryFile);
  assertCheck("fullPreviewBeyondFirst25", preview.ok && preview.body?.rowCount === 30 && preview.body?.sampleRows?.[29]?.Campaign === "TARGET_B", { status: preview.status, rowCount: preview.body?.rowCount, lastCampaign: preview.body?.sampleRows?.[29]?.Campaign });

  const primaryMapping = {
    revenueColumn: "Revenue", dateColumn: "Date", campaignColumn: "Campaign", campaignValues: ["TARGET_A", "TARGET_B"],
    currency: campaign.currency, displayName: primaryName, valueSource: "revenue", mode: "revenue_to_date",
  };
  const added = await csvRequest("process", primaryMapping, primaryFile);
  primarySourceId = String(added.body?.sourceId || "");
  if (primarySourceId) createdSourceIds.add(primarySourceId);
  assertCheck("campaignFilteredDatedAdd", added.ok && primarySourceId && money(added.body?.totalRevenue) === 100, { status: added.status, body: added.body });
  const addedState = primarySourceId ? await exactSourceState(primarySourceId) : null;
  assertCheck("datedRowsMaterialized", addedState?.isActive === true && addedState.recordCount === 4 && addedState.revenue === 100, addedState);

  const editMapping = { ...primaryMapping, sourceId: primarySourceId, campaignValues: ["TARGET_B"] };
  const edited = await csvRequest("process", editMapping);
  const editedState = primarySourceId ? await exactSourceState(primarySourceId) : null;
  assertCheck("editWithoutReupload", edited.ok && money(edited.body?.totalRevenue) === 50 && editedState?.revenue === 50 && editedState.recordCount === 2, { status: edited.status, body: edited.body, state: editedState });

  const replacementFile = selectedCsv(`replacement-${primaryName}`, { A1: 3, A2: 2, B1: 50, B2: 25 });
  const replacementMapping = { ...editMapping, displayName: replacementFile.name };
  const replaced = await csvRequest("process", replacementMapping, replacementFile);
  const replacedState = primarySourceId ? await exactSourceState(primarySourceId) : null;
  assertCheck("reuploadReplacesExactSource", replaced.ok && String(replaced.body?.sourceId || "") === primarySourceId && money(replaced.body?.totalRevenue) === 75 && replacedState?.revenue === 75 && replacedState.recordCount === 2, { status: replaced.status, body: replaced.body, state: replacedState });

  const snapshotFile = { name: snapshotName, text: "Revenue\n25.25" };
  const snapshotMapping = { revenueColumn: "Revenue", dateColumn: null, campaignColumn: null, campaignValues: null, currency: campaign.currency, displayName: snapshotName, valueSource: "revenue", mode: "revenue_to_date" };
  const snapshotAdded = await csvRequest("process", snapshotMapping, snapshotFile);
  const snapshotSourceId = String(snapshotAdded.body?.sourceId || "");
  if (snapshotSourceId) createdSourceIds.add(snapshotSourceId);
  const snapshotState = snapshotSourceId ? await exactSourceState(snapshotSourceId) : null;
  assertCheck("snapshotMaterialization", snapshotAdded.ok && money(snapshotAdded.body?.totalRevenue) === 25.25 && snapshotState?.recordCount === 1 && snapshotState.revenue === 25.25, { status: snapshotAdded.status, body: snapshotAdded.body, state: snapshotState });

  const downstream = await endpointSnapshot();
  const sourceRow = downstream.sourceRows.find((row) => sourceIdOf(row) === primarySourceId);
  const breakdownRow = downstream.breakdownRows.find((row) => sourceIdOf(row) === primarySourceId);
  assertCheck("sourceListAndBreakdownExact", downstream.endpointPass && sourceAmountOf(sourceRow) === 75 && sourceAmountOf(breakdownRow) === 75, { statuses: downstream.statuses, sourceRow, breakdownRow });
  assertCheck("toDateAndSpendPropagation", baselineEndpoints.revenueToDate !== null && downstream.revenueToDate !== null && money(downstream.revenueToDate - baselineEndpoints.revenueToDate) === 100.25 && downstream.spendToDate === baselineEndpoints.spendToDate, { beforeRevenue: baselineEndpoints.revenueToDate, afterRevenue: downstream.revenueToDate, beforeSpend: baselineEndpoints.spendToDate, afterSpend: downstream.spendToDate });
  observations.downstream = { kpiCount: downstream.kpiCount, benchmarkCount: downstream.benchmarkCount, reportCount: downstream.reportCount, reportContentInspected: false };

  const overlapFileA = selectedCsv(`overlap-a-${primaryName}`, { A1: 1, A2: 1, B1: 60, B2: 20 });
  const overlapFileB = selectedCsv(`overlap-b-${primaryName}`, { A1: 1, A2: 1, B1: 70, B2: 20 });
  const overlapMappingA = { ...editMapping, displayName: overlapFileA.name };
  const overlapMappingB = { ...editMapping, displayName: overlapFileB.name };
  const overlap = await csvPair(overlapMappingA, overlapFileA, overlapMappingB, overlapFileB);
  observations.overlapStatuses = overlap.map((result) => result.status).sort();
  assertCheck("overlappingEditProtected", overlap.filter((result) => result.ok).length === 1 && overlap.some((result) => result.status === 409), overlap.map((result) => ({ status: result.status, body: result.body })));

  const duplicateFile = { name: duplicateName, text: `Revenue\n${Array.from({ length: 5_000 }, () => "0.01").join("\n")}` };
  const duplicateMapping = { revenueColumn: "Revenue", dateColumn: null, campaignColumn: null, campaignValues: null, currency: campaign.currency, displayName: duplicateName, valueSource: "revenue", mode: "revenue_to_date" };
  const duplicate = await csvPair(duplicateMapping, duplicateFile, duplicateMapping, duplicateFile);
  for (const result of duplicate) {
    const sourceId = String(result.body?.sourceId || "");
    if (sourceId) createdSourceIds.add(sourceId);
  }
  observations.duplicateStatuses = duplicate.map((result) => result.status).sort();
  assertCheck("simultaneousIdenticalAddProtected", duplicate.filter((result) => result.ok).length === 1 && duplicate.some((result) => result.status === 409), duplicate.map((result) => ({ status: result.status, body: result.body })));

  const overRows = { name: `over-rows-${timestamp}.csv`, text: `Revenue\n${Array.from({ length: 5_001 }, () => "1").join("\n")}` };
  const rowLimit = await csvRequest("preview", {}, overRows);
  assertCheck("uiRowLimitRejectsWithoutTruncation", rowLimit.status === 413 && /5,000/.test(String(rowLimit.body?.error || "")), { status: rowLimit.status, body: rowLimit.body });

  const ambiguous = { name: `ambiguous-${timestamp}.csv`, text: "Revenue,Campaign;Date\n100,Alpha;2026-09-01" };
  const malformed = await csvRequest("preview", {}, ambiguous);
  assertCheck("ambiguousStructureRejected", malformed.status === 400 && /ambiguous/i.test(String(malformed.body?.error || "")), { status: malformed.status, body: malformed.body });

  const invalidAmount = await csvRequest("process", { ...snapshotMapping, displayName: `invalid-amount-${timestamp}.csv` }, { name: `invalid-amount-${timestamp}.csv`, text: "Revenue\n12.345" });
  assertCheck("invalidAmountNoMutation", invalidAmount.status === 400 && /amount/i.test(String(invalidAmount.body?.error || "")), { status: invalidAmount.status, body: invalidAmount.body });

  const invalidDateMapping = { ...primaryMapping, campaignColumn: null, campaignValues: null, displayName: `invalid-date-${timestamp}.csv` };
  const invalidDate = await csvRequest("process", invalidDateMapping, { name: invalidDateMapping.displayName, text: "Date,Revenue\n03/01/2026,10" });
  assertCheck("invalidDateNoMutation", invalidDate.status === 400 && /date/i.test(String(invalidDate.body?.error || "")), { status: invalidDate.status, body: invalidDate.body });

  const mismatchedCurrency = campaign.currency === "USD" ? "EUR" : "USD";
  const invalidCurrency = await csvRequest("process", { ...snapshotMapping, currency: mismatchedCurrency, displayName: `currency-${timestamp}.csv` }, { name: `currency-${timestamp}.csv`, text: "Revenue\n10" });
  assertCheck("currencyMismatchNoMutation", invalidCurrency.status === 400 && invalidCurrency.body?.code === "REVENUE_CURRENCY_MISMATCH", { status: invalidCurrency.status, body: invalidCurrency.body });

  const noPositive = await csvRequest("process", { ...snapshotMapping, displayName: `no-positive-${timestamp}.csv` }, { name: `no-positive-${timestamp}.csv`, text: "Revenue\n0\n-1" });
  assertCheck("noPositiveRowsNoMutation", noPositive.status === 400 && /No valid revenue rows/i.test(String(noPositive.body?.error || "")), { status: noPositive.status, body: noPositive.body });

  const oversized = { name: `oversized-${timestamp}.csv`, text: `Revenue\n"${"1".repeat(10 * 1024 * 1024)}"` };
  const fileLimitDbBefore = await databaseState();
  const previewFileLimit = await csvRequest("preview", {}, oversized);
  const processFileLimit = await csvRequest("process", { ...snapshotMapping, displayName: oversized.name }, oversized);
  const fileLimitDbAfter = await databaseState();
  observations.fileLimit = {
    preview: { status: previewFileLimit.status, body: previewFileLimit.body },
    process: { status: processFileLimit.status, body: processFileLimit.body },
    databaseBefore: fileLimitDbBefore,
    databaseAfter: fileLimitDbAfter,
  };
  assertCheck("tenMiBPreviewReturns413", previewFileLimit.status === 413 && /file too large/i.test(String(previewFileLimit.body?.message || "")), observations.fileLimit.preview);
  assertCheck("tenMiBProcessReturns413", processFileLimit.status === 413 && /file too large/i.test(String(processFileLimit.body?.message || "")), observations.fileLimit.process);
  assertCheck("tenMiBRequestsDoNotMutate", JSON.stringify(fileLimitDbAfter) === JSON.stringify(fileLimitDbBefore), observations.fileLimit);

  const processOverRows = { name: `process-over-rows-${timestamp}.csv`, text: `Revenue\n${Array.from({ length: 50_001 }, () => "1").join("\n")}` };
  const processLimit = await csvRequest("process", { ...snapshotMapping, displayName: processOverRows.name }, processOverRows);
  assertCheck("apiProcessRowLimitRejectsWithoutTruncation", processLimit.status === 413 && /50,000/.test(String(processLimit.body?.error || "")), { status: processLimit.status, body: processLimit.body });
} catch (error) {
  fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  failures.push(fatalError);
} finally {
  if (context && page) {
    for (const sourceId of [...createdSourceIds]) {
      try {
        const result = await deleteSource(sourceId);
        observations[`cleanup:${sourceId}`] = { status: result.status, success: result.ok && result.body?.success === true };
      } catch (error) {
        failures.push(`cleanup ${sourceId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

const finalDb = await databaseState().catch(() => null);
if (baselineDb && finalDb) {
  assertCheck("activeSourceIdsRestored", JSON.stringify(finalDb.activeSourceIds) === JSON.stringify(baselineDb.activeSourceIds), { before: baselineDb.activeSourceIds, after: finalDb.activeSourceIds });
  assertCheck("activeRevenueRestored", finalDb.activeRevenue === baselineDb.activeRevenue, { before: baselineDb.activeRevenue, after: finalDb.activeRevenue });
  assertCheck("activeRecordCountRestored", finalDb.activeRecordCount === baselineDb.activeRecordCount, { before: baselineDb.activeRecordCount, after: finalDb.activeRecordCount });
}

if (sessionId) await clerkPost(`/sessions/${encodeURIComponent(sessionId)}/revoke`).catch(() => null);
else if (signInTokenId) await clerkPost(`/sign_in_tokens/${encodeURIComponent(signInTokenId)}/revoke`).catch(() => null);
if (context) await context.close().catch(() => null);
if (browser) await browser.close().catch(() => null);
await pool.end();

const output = {
  success: failures.length === 0 && Object.values(checks).every(Boolean),
  mode: "authorized_target_campaign_mutation_with_exact_source_cleanup",
  targetCampaignId: CAMPAIGN_ID,
  expectedSha: EXPECTED_SHA,
  checkedAt: new Date().toISOString(),
  baselineDb,
  finalDb,
  checks,
  observations,
  knownUnvalidated: [
    "cross-owner rejection requires a separately authorized non-owner identity",
    "current report/PDF value content was not mutated or generated because snapshots are persistent",
    "scheduler source refresh is inapplicable because CSV Revenue is manual",
  ],
  fatalError,
  failures,
};
console.log(JSON.stringify(output, null, 2));
if (!output.success) process.exitCode = 1;

async function playwrightUnauthenticatedGet(url: string): Promise<Result> {
  if (!browser) throw new Error("Browser is unavailable");
  const anonymous = await browser.newContext();
  try {
    const response = await anonymous.request.get(url, { failOnStatusCode: false });
    return responseResult(response);
  } finally {
    await anonymous.close();
  }
}
