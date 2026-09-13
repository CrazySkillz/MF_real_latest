import { createHash } from "crypto";
import { chromium, type BrowserContext, type Page } from "playwright";
import { pool } from "../server/db";
import { getReportingDateWindow } from "../server/utils/reporting-timezone";

const BASE_URL = String(process.env.GA4_OVERVIEW_BASE_URL || "https://marketforensics.onrender.com").replace(/\/$/, "");
const EXPECTED_SHA = String(process.env.GA4_OVERVIEW_SPEND_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.GA4_OVERVIEW_SPEND_CAMPAIGN_ID || "8aa735ee-c02f-41e2-bb1f-7c3f43bb9458").trim();
const CLERK_SECRET = String(process.env.CLERK_SECRET_KEY || "").trim();
const OBSERVATION_SECONDS = Math.max(0, Math.min(180, Number(process.env.GA4_OVERVIEW_SPEND_OBSERVATION_SECONDS || 180)));

if (!pool) throw new Error("DATABASE_URL is required");
if (!CLERK_SECRET) throw new Error("CLERK_SECRET_KEY is required");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("GA4_OVERVIEW_SPEND_EXPECTED_SHA must be a full Git SHA");

const allowedSourceTypes = new Set(["csv", "google_sheets"]);
const hash = (value: unknown) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
const round2 = (value: unknown) => Number((Number(value) || 0).toFixed(2));
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const exact = (actual: unknown, expected: unknown, label: string) => {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
};
const parseMapping = (raw: unknown) => {
  try { return raw && typeof raw === "object" ? raw as any : JSON.parse(String(raw || "{}")); }
  catch { return null; }
};
const validDate = (value: unknown) => {
  const raw = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw;
};
const sourceIds = (sources: any[]) => sources.map((source) => String(source?.id || source?.sourceId || "")).filter(Boolean).sort();
const rowTotal = (rows: any[]) => round2(rows.reduce((sum, row) => sum + Number(row?.spend || 0), 0));
const clerkPost = async (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${CLERK_SECRET}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const api = async (page: Page, path: string) => page.evaluate(async (requestPath) => {
  const token = await (window as any).Clerk?.session?.getToken();
  if (!token) throw new Error("Clerk session token is unavailable");
  const response = await fetch(requestPath, { credentials: "include", headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: response.ok, status: response.status, body };
}, path);
const readSpendEndpoints = async (page: Page) => {
  const base = `/api/campaigns/${CAMPAIGN_ID}`;
  const entries = await Promise.all([
    ["sources", `${base}/spend-sources?platformContext=ga4`],
    ["total", `${base}/spend-to-date?platformContext=ga4`],
    ["breakdown", `${base}/spend-breakdown?platformContext=ga4`],
  ].map(async ([name, path]) => [name, await api(page, path)] as const));
  const result: Record<string, any> = Object.fromEntries(entries);
  for (const [name, response] of Object.entries(result)) {
    assert(response.ok && response.body?.success === true, `${name} endpoint failed (${response.status})`);
  }
  return result;
};

const client = await pool.connect();
let context: BrowserContext | null = null;
let sessionId = "";
let signInTokenId = "";
try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const campaignResult = await client.query(`
    SELECT id::text, owner_id, client_id, currency, reporting_time_zone
    FROM campaigns WHERE id = $1 LIMIT 1
  `, [CAMPAIGN_ID]);
  exact(campaignResult.rowCount, 1, "campaign inventory");
  const campaign = campaignResult.rows[0];
  const campaignCurrency = String(campaign.currency || "USD").trim().toUpperCase();
  const completedEndDate = getReportingDateWindow(1, campaign.reporting_time_zone).endDate;

  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json();
  exact(health?.commit, EXPECTED_SHA, "deployed SHA");

  const sourceResult = await client.query(`
    SELECT id::text, source_type, display_name, currency, platform_context, mapping_config,
           connected_at, created_at
    FROM spend_sources
    WHERE campaign_id = $1 AND is_active = true AND COALESCE(platform_context, 'ga4') = 'ga4'
    ORDER BY id
  `, [CAMPAIGN_ID]);
  const sources = sourceResult.rows;
  assert(sources.length > 0, "No active GA4 Spend sources are configured");
  assert(sources.every((source) => allowedSourceTypes.has(String(source.source_type))), "Configured GA4 Spend source is outside the certified CSV/Google Sheets boundary");
  assert(sources.some((source) => source.source_type === "csv"), "CSV Spend is not configured on the target campaign");
  assert(sources.some((source) => source.source_type === "google_sheets"), "Google Sheets Spend is not configured on the target campaign");

  const ids = sources.map((source) => String(source.id));
  const duplicateSignatures = new Set<string>();
  for (const source of sources) {
    const mapping = parseMapping(source.mapping_config) || {};
    const signature = source.source_type === "google_sheets"
      ? [source.source_type, mapping.connectionId, mapping.spreadsheetId, mapping.sheetName, mapping.spendColumn,
          mapping.dateColumn, mapping.campaignColumn, JSON.stringify([...(mapping.campaignValues || [])].map(String).sort())]
      : [source.source_type, mapping.storedSpendColumn, mapping.storedDateColumn, mapping.storedCampaignColumn,
          JSON.stringify([...(mapping.campaignValues || [])].map(String).sort()), hash(JSON.stringify(mapping.csvStoredSpendRows || []))];
    const key = JSON.stringify(signature);
    assert(!duplicateSignatures.has(key), `Duplicate active Spend source signature ${hash(key)}`);
    duplicateSignatures.add(key);
  }
  const recordResult = await client.query(`
    SELECT id::text, campaign_id::text, spend_source_id, date, spend, currency, source_type
    FROM spend_records
    WHERE campaign_id = $1 OR spend_source_id = ANY($2::text[])
    ORDER BY spend_source_id, date, id
  `, [CAMPAIGN_ID, ids]);
  const records = recordResult.rows;
  const sourceIdSet = new Set(ids);
  const scopedRecords = records.filter((record) => record.campaign_id === CAMPAIGN_ID && sourceIdSet.has(String(record.spend_source_id)));
  const crossCampaignRecords = records.filter((record) => sourceIdSet.has(String(record.spend_source_id)) && record.campaign_id !== CAMPAIGN_ID);
  exact(crossCampaignRecords.length, 0, "cross-campaign Spend records");
  assert(scopedRecords.every((record) => validDate(record.date)), "Spend record has an invalid stored date");
  assert(scopedRecords.every((record) => String(record.currency || "").toUpperCase() === campaignCurrency), "Spend record currency mismatch");

  const recordsBySource = new Map<string, any[]>();
  for (const record of scopedRecords) {
    const sourceId = String(record.spend_source_id);
    recordsBySource.set(sourceId, [...(recordsBySource.get(sourceId) || []), record]);
  }
  const sheetConnectionAgesDays: number[] = [];
  for (const source of sources) {
    const sourceRecords = recordsBySource.get(String(source.id)) || [];
    assert(sourceRecords.length > 0, `Active Spend source ${hash(source.id)} has no records`);
    exact(String(source.currency || "").toUpperCase(), campaignCurrency, `source currency ${hash(source.id)}`);
    assert(sourceRecords.every((record) => String(record.source_type) === String(source.source_type)), `record type mismatch ${hash(source.id)}`);
    const dates = sourceRecords.map((record) => String(record.date));
    exact(new Set(dates).size, dates.length, `duplicate source/date records ${hash(source.id)}`);
    const mapping = parseMapping(source.mapping_config);
    assert(mapping, `invalid mapping JSON ${hash(source.id)}`);
    if (source.source_type === "csv") {
      assert(String(mapping.storedSpendColumn || mapping.spendColumn || "").trim(), `CSV Spend column is missing ${hash(source.id)}`);
      assert(String(mapping.storedDateColumn || mapping.dateColumn || "").trim(), `CSV Spend date column is missing ${hash(source.id)}`);
      assert(Array.isArray(mapping.csvStoredSpendRows) && mapping.csvStoredSpendRows.length > 0, `CSV stored manual-refresh rows are missing ${hash(source.id)}`);
    } else {
      assert(String(mapping.connectionId || "").trim(), `Google Sheets connection is missing ${hash(source.id)}`);
      assert(String(mapping.spendColumn || "").trim(), `Google Sheets Spend column is missing ${hash(source.id)}`);
      assert(String(mapping.lastSyncedAt || "").trim(), `Google Sheets lastSyncedAt is missing ${hash(source.id)}`);
      const connectionResult = await client.query(`
        SELECT id::text, campaign_id::text, is_active, connected_at, created_at
        FROM google_sheets_connections WHERE id = $1 AND campaign_id = $2 LIMIT 1
      `, [String(mapping.connectionId), CAMPAIGN_ID]);
      exact(connectionResult.rowCount, 1, `campaign-owned Google Sheets connection ${hash(source.id)}`);
      assert(connectionResult.rows[0].is_active !== false, `inactive Google Sheets connection ${hash(source.id)}`);
      const connectionDate = new Date(connectionResult.rows[0].connected_at || connectionResult.rows[0].created_at || 0).getTime();
      assert(Number.isFinite(connectionDate) && connectionDate > 0, `Google Sheets connection timestamp is invalid ${hash(source.id)}`);
      sheetConnectionAgesDays.push(Math.floor((Date.now() - connectionDate) / 86_400_000));
    }
  }

  const damageResult = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM spend_records r LEFT JOIN spend_sources s ON s.id::text = r.spend_source_id
        WHERE r.campaign_id = $1 AND (s.id IS NULL OR s.campaign_id <> r.campaign_id))::int AS orphan_count,
      (SELECT COUNT(*) FROM spend_records r JOIN spend_sources s ON s.id::text = r.spend_source_id
        WHERE r.campaign_id = $1 AND s.campaign_id = $1 AND s.is_active = false)::int AS inactive_count
  `, [CAMPAIGN_ID]);
  exact(Number(damageResult.rows[0]?.orphan_count || 0), 0, "orphan target-campaign Spend records");
  exact(Number(damageResult.rows[0]?.inactive_count || 0), 0, "inactive-source Spend records");

  const otherOwnerResult = await client.query(`
    SELECT id::text FROM campaigns WHERE owner_id IS DISTINCT FROM $1 ORDER BY id LIMIT 1
  `, [campaign.owner_id]);
  exact(otherOwnerResult.rowCount, 1, "cross-owner isolation fixture");

  const browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  const page = await context.newPage();
  const tokenResponse = await clerkPost("/sign_in_tokens", { user_id: campaign.owner_id, expires_in_seconds: 900 });
  const tokenBody: any = await tokenResponse.json().catch(() => ({}));
  assert(tokenResponse.ok && tokenBody?.token, `Clerk sign-in token failed (${tokenResponse.status})`);
  signInTokenId = String(tokenBody.id || "");
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(tokenBody.token))}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ""));

  for (const path of ["spend-sources?platformContext=ga4", "spend-to-date?platformContext=ga4", "spend-breakdown?platformContext=ga4"]) {
    const response = await fetch(`${BASE_URL}/api/campaigns/${CAMPAIGN_ID}/${path}`, { redirect: "manual" });
    exact(response.status, 401, `unauthenticated denial ${path.split("?")[0]}`);
  }
  const crossOwner = await api(page, `/api/campaigns/${otherOwnerResult.rows[0].id}/spend-sources?platformContext=ga4`);
  assert(crossOwner.status === 403 || crossOwner.status === 404, "cross-owner Spend source request was not denied");

  const before = await readSpendEndpoints(page);
  const verifyApiSnapshot = (responses: Record<string, any>, databaseSources: any[], databaseRecords: any[]) => {
    const apiSources = Array.isArray(responses.sources.body?.sources) ? responses.sources.body.sources : [];
    const breakdownRows = Array.isArray(responses.breakdown.body?.sources) ? responses.breakdown.body.sources : [];
    const visibleRecords = databaseRecords.filter((record) => String(record.date) <= completedEndDate);
    const databaseTotal = round2(visibleRecords.reduce((sum, record) => sum + Number(record.spend || 0), 0));
    exact(JSON.stringify(sourceIds(apiSources)), JSON.stringify(sourceIds(databaseSources)), "database/API source IDs");
    exact(JSON.stringify(sourceIds(breakdownRows)), JSON.stringify(sourceIds(databaseSources)), "breakdown/source-list IDs");
    exact(rowTotal(breakdownRows), databaseTotal, "breakdown/database Total Spend");
    exact(round2(responses.breakdown.body?.totalSpend), databaseTotal, "breakdown aggregate Total Spend");
    exact(round2(responses.total.body?.spendToDate), databaseTotal, "spend-to-date/database Total Spend");
    exact(JSON.stringify([...responses.total.body.sourceIds].map(String).sort()), JSON.stringify(sourceIds(databaseSources)), "spend-to-date/source-list IDs");
    exact(String(responses.total.body?.currency || "").toUpperCase(), campaignCurrency, "spend-to-date currency");
    exact(responses.total.body?.endDate, completedEndDate, "spend-to-date completed-day boundary");
    exact(responses.breakdown.body?.endDate, completedEndDate, "spend-breakdown completed-day boundary");
    return { apiSources, breakdownRows, databaseTotal };
  };
  const beforeVerified = verifyApiSnapshot(before, sources, scopedRecords);
  const beforeMappings = new Map(beforeVerified.apiSources.map((source: any) => [String(source.id), parseMapping(source.mappingConfig)]));

  let after = before;
  let observedSeconds = 0;
  let automaticRefreshObserved = false;
  while (observedSeconds < OBSERVATION_SECONDS && !automaticRefreshObserved) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    observedSeconds += 10;
    after = await readSpendEndpoints(page);
    const currentSources = Array.isArray(after.sources.body?.sources) ? after.sources.body.sources : [];
    automaticRefreshObserved = currentSources.filter((source: any) => source.sourceType === "google_sheets").every((source: any) => {
      const beforeMapping = beforeMappings.get(String(source.id));
      const currentMapping = parseMapping(source.mappingConfig);
      return new Date(currentMapping?.lastSyncedAt || 0).getTime() > new Date(beforeMapping?.lastSyncedAt || 0).getTime();
    });
  }
  if (OBSERVATION_SECONDS > 0) {
    assert(automaticRefreshObserved, `No natural Google Sheets Spend refresh was observed within ${OBSERVATION_SECONDS} seconds`);
  }

  const afterSources = Array.isArray(after.sources.body?.sources) ? after.sources.body.sources : [];
  exact(JSON.stringify(sourceIds(afterSources)), JSON.stringify(sourceIds(sources)), "stable source IDs after automatic refresh");
  for (const source of afterSources.filter((candidate: any) => candidate.sourceType === "csv")) {
    exact(hash(source.mappingConfig), hash(sources.find((candidate) => String(candidate.id) === String(source.id))?.mapping_config), `CSV unchanged during automatic observation ${hash(source.id)}`);
  }

  const refreshedRecordResult = await client.query(`
    SELECT id::text, campaign_id::text, spend_source_id, date, spend, currency, source_type
    FROM spend_records WHERE campaign_id = $1 AND spend_source_id = ANY($2::text[])
    ORDER BY spend_source_id, date, id
  `, [CAMPAIGN_ID, ids]);
  const refreshedRecords = refreshedRecordResult.rows;
  const afterVerified = verifyApiSnapshot(after, afterSources, refreshedRecords);

  console.log(JSON.stringify({
    status: "passed",
    certificationStatus: "validation_output_only",
    deployedSha: health.commit,
    campaignHash: hash(CAMPAIGN_ID),
    clientHash: hash(campaign.client_id),
    ownerHash: hash(campaign.owner_id),
    currency: campaignCurrency,
    completedEndDate,
    sourceInventory: afterSources.map((source: any) => ({
      idHash: hash(source.id),
      type: source.sourceType,
      displayName: source.displayName,
      spend: round2(afterVerified.breakdownRows.find((row: any) => String(row.sourceId) === String(source.id))?.spend),
      mappingHash: hash(source.mappingConfig),
    })),
    reconciliation: {
      sourceCount: afterSources.length,
      breakdownCount: afterVerified.breakdownRows.length,
      totalSpend: afterVerified.databaseTotal,
      sourceIdsStableAcrossObservation: true,
      csvMappingsUnchangedAcrossObservation: true,
    },
    automaticRefresh: {
      observed: automaticRefreshObserved,
      observationSeconds: observedSeconds,
      oldestConnectionAgeDays: Math.max(...sheetConnectionAgesDays),
      lastSyncedAt: afterSources.filter((source: any) => source.sourceType === "google_sheets").map((source: any) => ({
        idHash: hash(source.id),
        value: parseMapping(source.mappingConfig)?.lastSyncedAt || null,
      })),
    },
    integrity: {
      orphanRecords: Number(damageResult.rows[0]?.orphan_count || 0),
      crossCampaignRecords: crossCampaignRecords.length,
      inactiveSourceRecords: Number(damageResult.rows[0]?.inactive_count || 0),
      currencyMatches: true,
      datesValid: true,
      duplicateSourceDateRows: 0,
      duplicateActiveSourceSignatures: 0,
    },
    accessControl: { unauthenticated: "denied", crossOwner: "denied" },
    googleAds: "NOT CONFIGURED / EXCLUDED",
    excluded: [
      "Google Ads behavior and readiness",
      "Revenue sources and Revenue evidence",
      "provider-value mutation",
      "provider-failure injection",
      "add/edit/delete production mutation",
    ],
    databaseTransaction: "read only and rolled back",
  }, null, 2));
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
