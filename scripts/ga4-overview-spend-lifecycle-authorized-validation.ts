import { createHash } from "crypto";
import { chromium, type APIResponse, type Browser, type BrowserContext, type Page } from "playwright";
import { pool } from "../server/db";
import { storage } from "../server/storage";
import { getReportingDateWindow } from "../server/utils/reporting-timezone";

const BASE_URL = String(process.env.GA4_OVERVIEW_BASE_URL || "https://marketforensics.onrender.com").replace(/\/$/, "");
const EXPECTED_SHA = String(process.env.GA4_OVERVIEW_SPEND_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.GA4_OVERVIEW_SPEND_CAMPAIGN_ID || "").trim();
const CLERK_SECRET = String(process.env.CLERK_SECRET_KEY || "").trim();
const CONFIRM_MUTATION = String(process.env.GA4_OVERVIEW_SPEND_LIFECYCLE_CONFIRM || "").trim().toLowerCase() === "true";

if (!pool) throw new Error("DATABASE_URL is required");
if (!CLERK_SECRET) throw new Error("CLERK_SECRET_KEY is required");
if (!/^[0-9a-f-]{36}$/i.test(CAMPAIGN_ID)) throw new Error("GA4_OVERVIEW_SPEND_CAMPAIGN_ID must be an explicit campaign UUID");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("GA4_OVERVIEW_SPEND_EXPECTED_SHA must be the exact deployed SHA");

type Result = { ok: boolean; status: number; body: any; headers: Record<string, string> };

const hash = (value: unknown) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
const money = (value: unknown) => Number(Number(value || 0).toFixed(2));
const parseNumber = (value: unknown) => {
  const normalized = String(value ?? "").trim().replace(/[$,\s]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
const isDateLike = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw || /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw)) return false;
  return !Number.isNaN(new Date(raw).getTime());
};
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const responseResult = async (response: APIResponse): Promise<Result> => {
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: response.ok(), status: response.status(), body, headers: response.headers() };
};
const clerkPost = async (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${CLERK_SECRET}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const dbClient = await pool.connect();
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let sessionId = "";
let signInTokenId = "";

try {
  await dbClient.query("BEGIN TRANSACTION READ ONLY");
  const campaignResult = await dbClient.query(`
    SELECT id::text, name, owner_id, client_id, currency, reporting_time_zone, spend
    FROM campaigns WHERE id = $1 LIMIT 1
  `, [CAMPAIGN_ID]);
  assert(campaignResult.rowCount === 1, "Campaign was not found");
  const campaign = campaignResult.rows[0];

  const baselineResult = await dbClient.query(`
    SELECT
      COUNT(DISTINCT s.id) FILTER (WHERE s.is_active = true)::int AS "activeSourceCount",
      COUNT(r.id) FILTER (WHERE s.is_active = true)::int AS "activeRecordCount",
      COALESCE(SUM(r.spend) FILTER (WHERE s.is_active = true), 0)::text AS "activeSpend",
      ARRAY_AGG(DISTINCT s.id::text ORDER BY s.id::text) FILTER (WHERE s.is_active = true) AS "activeSourceIds"
    FROM spend_sources s
    LEFT JOIN spend_records r ON r.spend_source_id = s.id::text AND r.campaign_id = s.campaign_id
    WHERE s.campaign_id = $1 AND COALESCE(NULLIF(TRIM(s.platform_context), ''), 'ga4') = 'ga4'
  `, [CAMPAIGN_ID]);
  const baseline = baselineResult.rows[0] || {};

  const dependentResult = await dbClient.query(`
    SELECT
      (SELECT COUNT(*) FROM kpis WHERE campaign_id = $1 AND platform_type = 'google_analytics')::int AS "kpiCount",
      (SELECT COUNT(*) FROM benchmarks WHERE campaign_id = $1 AND platform_type = 'google_analytics')::int AS "benchmarkCount",
      (SELECT COUNT(*) FROM notifications WHERE campaign_id = $1)::int AS "notificationCount",
      (SELECT COUNT(*) FROM kpi_alerts a JOIN kpis k ON k.id::text = a.kpi_id WHERE k.campaign_id = $1)::int AS "kpiAlertCount"
  `, [CAMPAIGN_ID]);
  const dependents = dependentResult.rows[0] || {};

  const connectionResult = await dbClient.query(`
    SELECT id::text, spreadsheet_id, purpose, spreadsheet_name, sheet_name, is_active, connected_at,
           (access_token IS NOT NULL OR refresh_token IS NOT NULL OR encrypted_tokens IS NOT NULL) AS "hasCredentials"
    FROM google_sheets_connections
    WHERE campaign_id = $1 AND spreadsheet_id <> 'pending'
    ORDER BY is_active DESC, connected_at DESC, id
  `, [CAMPAIGN_ID]);

  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json().catch(() => null);
  assert(healthResponse.ok && health?.commit === EXPECTED_SHA, `Expected deployed SHA ${EXPECTED_SHA}, received ${String(health?.commit || "unknown")}`);

  browser = await chromium.launch({ headless: true });
  const signIn = await clerkPost("/sign_in_tokens", { user_id: campaign.owner_id, expires_in_seconds: 1800 });
  const signInBody: any = await signIn.json().catch(() => ({}));
  assert(signIn.ok && signInBody?.token, `Clerk sign-in token failed (${signIn.status})`);
  signInTokenId = String(signInBody.id || "");
  context = await browser.newContext();
  page = await context.newPage();
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(signInBody.token))}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60_000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ""));
  const token = async () => {
    const value = await page!.evaluate(() => (window as any).Clerk?.session?.getToken());
    assert(value, "Clerk session token is unavailable");
    return String(value);
  };
  const postJson = async (path: string, body: unknown): Promise<Result> => responseResult(await context!.request.post(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    data: body,
    failOnStatusCode: false,
    timeout: 120_000,
  }));

  const previews: any[] = [];
  for (const connection of connectionResult.rows.filter((row) => row.is_active && row.hasCredentials)) {
    const result = await postJson(`/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/spend/sheets/preview`, { connectionId: connection.id });
    const headers = Array.isArray(result.body?.headers) ? result.body.headers.map(String) : [];
    const rows = Array.isArray(result.body?.sampleRows) ? result.body.sampleRows : [];
    const profiles = headers.map((header: string) => {
      const values = rows.map((row: any) => row?.[header]).filter((value: unknown) => String(value ?? "").trim() !== "");
      return {
        header,
        nonEmpty: values.length,
        positiveNumeric: values.filter((value: unknown) => Number(parseNumber(value)) > 0).length,
        dateLike: values.filter(isDateLike).length,
        distinct: new Set(values.map(String)).size,
      };
    });
    const spendProfile = [...profiles]
      .filter((profile) => profile.positiveNumeric > 0)
      .sort((a, b) => {
        const score = (header: string) => /spend/i.test(header) ? 3 : /cost/i.test(header) ? 2 : /amount/i.test(header) ? 1 : 0;
        return score(b.header) - score(a.header) || b.positiveNumeric - a.positiveNumeric;
      })[0] || null;
    const dateProfile = profiles.find((profile) => /(^|[_\s-])(date|day|timestamp)($|[_\s-])/i.test(profile.header) && profile.dateLike > 0) || null;
    const campaignProfile = profiles.find((profile) => /campaign/i.test(profile.header) && profile.header !== spendProfile?.header && profile.header !== dateProfile?.header) || null;
    previews.push({
      connectionId: connection.id,
      spreadsheetId: connection.spreadsheet_id,
      headers,
      rows,
      connectionHash: hash(connection.id),
      purpose: connection.purpose || null,
      spreadsheetName: connection.spreadsheet_name || null,
      sheetName: connection.sheet_name || null,
      status: result.status,
      success: result.ok && result.body?.success === true,
      rowCount: Number(result.body?.rowCount || 0),
      profiles,
      proposedMapping: {
        spendColumn: spendProfile?.header || null,
        dateColumn: dateProfile?.header || null,
        campaignColumn: campaignProfile?.header || null,
      },
    });
  }

  const publicPreflight = {
    success: true,
    mode: "read_only_preflight",
    deployedSha: health.commit,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      idHash: hash(campaign.id),
      clientHash: hash(campaign.client_id),
      ownerHash: hash(campaign.owner_id),
      currency: String(campaign.currency || "USD").trim().toUpperCase(),
      reportingTimeZone: campaign.reporting_time_zone || "UTC",
      storedCampaignSpend: money(campaign.spend),
    },
    baseline: {
      activeSourceCount: Number(baseline.activeSourceCount || 0),
      activeRecordCount: Number(baseline.activeRecordCount || 0),
      activeSpend: money(baseline.activeSpend),
      activeSourceIds: (baseline.activeSourceIds || []).map(hash),
    },
    dependents: {
      kpiCount: Number(dependents.kpiCount || 0),
      benchmarkCount: Number(dependents.benchmarkCount || 0),
      notificationCount: Number(dependents.notificationCount || 0),
      kpiAlertCount: Number(dependents.kpiAlertCount || 0),
    },
    connections: connectionResult.rows.map((connection) => ({
      idHash: hash(connection.id),
      purpose: connection.purpose || null,
      spreadsheetName: connection.spreadsheet_name || null,
      sheetName: connection.sheet_name || null,
      active: connection.is_active === true,
      hasCredentials: connection.hasCredentials === true,
    })),
    previews: previews.map(({ connectionId: _connectionId, spreadsheetId: _spreadsheetId, headers: _headers, rows: _rows, ...preview }) => preview),
    mutationPerformed: false,
    googleAds: "NOT CONFIGURED / EXCLUDED",
  };

  if (!CONFIRM_MUTATION) {
    console.log(JSON.stringify(publicPreflight, null, 2));
  } else {
    const checks: Record<string, boolean> = {};
    const failures: string[] = [];
    const observations: Record<string, any> = {};
    const createdConnectionIds = new Set<string>();
    const baselineConnectionIds = new Set(connectionResult.rows.map((row) => String(row.id)));
    const runTag = `spend-cert-${Date.now()}`;
    const completedEndDate = getReportingDateWindow(1, campaign.reporting_time_zone).endDate;
    const campaignCurrency = String(campaign.currency || "USD").trim().toUpperCase();
    const otherCurrency = campaignCurrency === "USD" ? "EUR" : "USD";
    let fatalError: string | null = null;

    const check = (name: string, condition: unknown, detail?: unknown) => {
      checks[name] = condition === true;
      if (condition !== true) failures.push(detail === undefined ? name : `${name}: ${JSON.stringify(detail)}`);
    };
    const rowsOf = (value: any): any[] => {
      if (Array.isArray(value)) return value;
      for (const key of ["sources", "data", "kpis", "benchmarks", "reports", "rows"]) {
        if (Array.isArray(value?.[key])) return value[key];
      }
      return [];
    };
    const get = async (path: string): Promise<Result> => responseResult(await context!.request.get(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${await token()}` },
      failOnStatusCode: false,
      timeout: 120_000,
    }));
    const deleteSource = async (sourceId: string): Promise<Result> => responseResult(await context!.request.delete(
      `${BASE_URL}/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/spend-sources/${encodeURIComponent(sourceId)}?platformContext=ga4`,
      { headers: { Authorization: `Bearer ${await token()}` }, failOnStatusCode: false, timeout: 120_000 },
    ));
    const csvRequest = async (path: "preview" | "process", mapping: any, file?: { name: string; text: string }): Promise<Result> => {
      const multipart: Record<string, any> = { platformContext: "ga4" };
      if (path === "process") multipart.mapping = JSON.stringify(mapping);
      if (file) multipart.file = { name: file.name, mimeType: "text/csv", buffer: Buffer.from(file.text, "utf8") };
      return responseResult(await context!.request.post(
        `${BASE_URL}/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/spend/csv/${path}`,
        { headers: { Authorization: `Bearer ${await token()}` }, multipart, failOnStatusCode: false, timeout: 120_000 },
      ));
    };
    const state = async () => {
      const [campaignState, sourceState, recordState, connectionState, dependentState] = await Promise.all([
        dbClient.query(`SELECT spend FROM campaigns WHERE id = $1`, [CAMPAIGN_ID]),
        dbClient.query(`
          SELECT id::text, source_type, platform_context, display_name, currency, mapping_config, is_active
          FROM spend_sources WHERE campaign_id = $1 ORDER BY id
        `, [CAMPAIGN_ID]),
        dbClient.query(`
          SELECT id::text, spend_source_id, date, spend::text, currency, source_type
          FROM spend_records WHERE campaign_id = $1 ORDER BY id
        `, [CAMPAIGN_ID]),
        dbClient.query(`
          SELECT id::text, spreadsheet_id, purpose, spreadsheet_name, sheet_name, is_active
          FROM google_sheets_connections WHERE campaign_id = $1 AND spreadsheet_id <> 'pending' ORDER BY id
        `, [CAMPAIGN_ID]),
        dbClient.query(`
          SELECT
            (SELECT COUNT(*) FROM notifications WHERE campaign_id = $1)::int AS "notificationCount",
            (SELECT COUNT(*) FROM kpi_alerts a JOIN kpis k ON k.id::text = a.kpi_id WHERE k.campaign_id = $1)::int AS "kpiAlertCount"
        `, [CAMPAIGN_ID]),
      ]);
      return {
        campaignSpend: money(campaignState.rows[0]?.spend),
        sources: sourceState.rows,
        records: recordState.rows,
        connections: connectionState.rows,
        notificationCount: Number(dependentState.rows[0]?.notificationCount || 0),
        kpiAlertCount: Number(dependentState.rows[0]?.kpiAlertCount || 0),
      };
    };
    const exactSourceState = async (sourceId: string) => {
      const [sourceResult, recordsResult] = await Promise.all([
        dbClient.query(`
          SELECT id::text, source_type, platform_context, display_name, currency, mapping_config, is_active
          FROM spend_sources WHERE campaign_id = $1 AND id::text = $2 LIMIT 1
        `, [CAMPAIGN_ID, sourceId]),
        dbClient.query(`
          SELECT date, spend::text, currency, source_type
          FROM spend_records WHERE campaign_id = $1 AND spend_source_id = $2 ORDER BY date, id
        `, [CAMPAIGN_ID, sourceId]),
      ]);
      const source = sourceResult.rows[0] || null;
      return source ? {
        ...source,
        records: recordsResult.rows,
        total: money(recordsResult.rows.reduce((sum, row) => sum + Number(row.spend || 0), 0)),
      } : null;
    };
    const sanitizedSource = (value: any) => {
      if (!value) return null;
      let mapping: any = {};
      try { mapping = JSON.parse(String(value.mapping_config || "{}")); } catch { mapping = {}; }
      const { lastSyncedAt: _lastSyncedAt, ...stableMapping } = mapping;
      return {
        id: value.id,
        source_type: value.source_type,
        platform_context: value.platform_context,
        display_name: value.display_name,
        currency: value.currency,
        is_active: value.is_active,
        mapping: stableMapping,
        records: value.records,
        total: value.total,
      };
    };
    const endpointSnapshot = async () => {
      const [sources, total, breakdown, daily, kpis, benchmarks, reports] = await Promise.all([
        get(`/api/campaigns/${CAMPAIGN_ID}/spend-sources?platformContext=ga4`),
        get(`/api/campaigns/${CAMPAIGN_ID}/spend-to-date?platformContext=ga4`),
        get(`/api/campaigns/${CAMPAIGN_ID}/spend-breakdown?platformContext=ga4`),
        get(`/api/campaigns/${CAMPAIGN_ID}/daily-financials?start=1900-01-01&end=${completedEndDate}`),
        get(`/api/platforms/google_analytics/kpis?campaignId=${CAMPAIGN_ID}`),
        get(`/api/platforms/google_analytics/benchmarks?campaignId=${CAMPAIGN_ID}`),
        get(`/api/platforms/google_analytics/reports?campaignId=${CAMPAIGN_ID}`),
      ]);
      const sourceRows = rowsOf(sources.body);
      const breakdownRows = rowsOf(breakdown.body);
      const dailyRows = rowsOf(daily.body);
      return {
        statuses: {
          sources: sources.status,
          total: total.status,
          breakdown: breakdown.status,
          daily: daily.status,
          kpis: kpis.status,
          benchmarks: benchmarks.status,
          reports: reports.status,
        },
        allOk: [sources, total, breakdown, daily, kpis, benchmarks, reports].every((result) => result.ok),
        sourceRows,
        breakdownRows,
        totalSpend: money(total.body?.spendToDate),
        breakdownTotal: money(breakdown.body?.totalSpend),
        dailySpend: money(dailyRows.reduce((sum, row) => sum + Number(row.spend || 0), 0)),
        sourceIds: sourceRows.map((row) => String(row.id || row.sourceId || "")).filter(Boolean).sort(),
        breakdownIds: breakdownRows.map((row) => String(row.sourceId || row.id || "")).filter(Boolean).sort(),
        kpiCount: rowsOf(kpis.body).length,
        benchmarkCount: rowsOf(benchmarks.body).length,
        reportCount: rowsOf(reports.body).length,
      };
    };
    const testSourceIds = async () => {
      const result = await dbClient.query(`
        SELECT id::text FROM spend_sources
        WHERE campaign_id = $1 AND display_name LIKE $2 ORDER BY id
      `, [CAMPAIGN_ID, `${runTag}%`]);
      return result.rows.map((row) => String(row.id));
    };
    const baselineState = await state();
    const baselineEndpoints = await endpointSnapshot();
    let sheetSourceId = "";
    let csvSourceId = "";
    let dedicatedConnectionId = "";

    try {
      check("exactCampaign", campaign.name === "Campaign2", { actualName: campaign.name });
      check("emptySpendBaseline", Number(baseline.activeSourceCount || 0) === 0 && Number(baseline.activeRecordCount || 0) === 0 && money(baseline.activeSpend) === 0 && baselineState.campaignSpend === 0, publicPreflight.baseline);
      check("noAlertingDependents", Number(dependents.kpiCount || 0) === 0 && Number(dependents.benchmarkCount || 0) === 0 && Number(dependents.notificationCount || 0) === 0 && Number(dependents.kpiAlertCount || 0) === 0, publicPreflight.dependents);
      check("noExistingSpendConnection", !connectionResult.rows.some((row) => row.is_active && (row.purpose === "spend" || row.purpose === null)), publicPreflight.connections);
      check("baselineEndpointsHealthy", baselineEndpoints.allOk && baselineEndpoints.sourceIds.length === 0 && baselineEndpoints.totalSpend === 0 && baselineEndpoints.breakdownTotal === 0 && baselineEndpoints.dailySpend === 0, baselineEndpoints);
      assert(checks.exactCampaign && checks.emptySpendBaseline && checks.noAlertingDependents && checks.noExistingSpendConnection && checks.baselineEndpointsHealthy, "Campaign2 preflight safety gate failed");

      const viablePreview = previews.find((preview) => preview.success
        && preview.proposedMapping.spendColumn === "Spend"
        && preview.proposedMapping.dateColumn === "Date"
        && preview.proposedMapping.campaignColumn === "Campaign ID");
      check("semanticSheetMappingAvailable", Boolean(viablePreview), publicPreflight.previews);
      assert(viablePreview, "No unambiguous Spend/Date/Campaign ID Google Sheets mapping is available");

      const createConnection = await postJson("/api/google-sheets/select-spreadsheet-multiple", {
        campaignId: CAMPAIGN_ID,
        spreadsheetId: viablePreview.spreadsheetId,
        sheetNames: [viablePreview.sheetName],
        selectionMode: "append",
        purpose: "spend",
      });
      dedicatedConnectionId = String(createConnection.body?.connectionIds?.[0] || createConnection.body?.connectionId || "");
      if (dedicatedConnectionId && !baselineConnectionIds.has(dedicatedConnectionId)) createdConnectionIds.add(dedicatedConnectionId);
      check("dedicatedSpendConnectionCreated", createConnection.ok && Boolean(dedicatedConnectionId) && !baselineConnectionIds.has(dedicatedConnectionId), { status: createConnection.status, body: createConnection.body });
      assert(checks.dedicatedSpendConnectionCreated, "Dedicated Spend-purpose connection was not created");

      const dedicatedPreview = await postJson(`/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/spend/sheets/preview`, { connectionId: dedicatedConnectionId });
      const sheetRows = Array.isArray(dedicatedPreview.body?.sampleRows) ? dedicatedPreview.body.sampleRows : [];
      const grouped = new Map<string, { total: number; dates: string[]; rows: number; eligible: boolean }>();
      for (const row of sheetRows) {
        const campaignValue = String(row?.["Campaign ID"] ?? "").trim();
        const spend = Number(parseNumber(row?.Spend));
        const rawDate = String(row?.Date ?? "").trim();
        if (!campaignValue || !(spend > 0)) continue;
        const current = grouped.get(campaignValue) || { total: 0, dates: [], rows: 0, eligible: true };
        current.total += spend;
        current.rows += 1;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || rawDate > completedEndDate) current.eligible = false;
        else current.dates.push(rawDate);
        grouped.set(campaignValue, current);
      }
      const selectedGroup = [...grouped.entries()].filter(([, group]) => group.eligible).sort((a, b) => a[1].total - b[1].total)[0] || null;
      check("boundedSheetFixtureAvailable", dedicatedPreview.ok && Number(dedicatedPreview.body?.rowCount || 0) === sheetRows.length && Boolean(selectedGroup) && Number(selectedGroup?.[1].total || 0) > 0, { status: dedicatedPreview.status, rowCount: dedicatedPreview.body?.rowCount });
      assert(checks.boundedSheetFixtureAvailable, "No bounded positive dated Sheet fixture is available");
      const selectedCampaignValue = selectedGroup![0];
      const expectedSheetSpend = money(selectedGroup![1].total);
      const expectedSheetRecordCount = new Set(selectedGroup![1].dates).size;
      const sheetMapping = {
        spendColumn: "Spend",
        dateColumn: "Date",
        campaignColumn: "Campaign ID",
        campaignValues: [selectedCampaignValue],
        currency: campaignCurrency,
        displayName: `${runTag}-sheets`,
        platformContext: "ga4",
      };

      const sheetAdded = await postJson(`/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/spend/sheets/process`, {
        connectionId: dedicatedConnectionId,
        mapping: sheetMapping,
        platformContext: "ga4",
      });
      sheetSourceId = String(sheetAdded.body?.sourceId || "");
      if (!sheetSourceId) sheetSourceId = (await testSourceIds())[0] || "";
      const sheetAddedState = sheetSourceId ? await exactSourceState(sheetSourceId) : null;
      check("sheetAddMaterialized", sheetAdded.ok && Boolean(sheetSourceId) && sheetAdded.body?.currency === campaignCurrency && money(sheetAdded.body?.importedRowsTotalSpend) === expectedSheetSpend && sheetAddedState?.total === expectedSheetSpend && sheetAddedState?.records.length === expectedSheetRecordCount, { status: sheetAdded.status, response: sheetAdded.body, state: sheetAddedState && { total: sheetAddedState.total, recordCount: sheetAddedState.records.length } });

      const afterSheetAdd = await endpointSnapshot();
      check("sheetAddReconciled", afterSheetAdd.allOk && afterSheetAdd.sourceIds.length === 1 && JSON.stringify(afterSheetAdd.sourceIds) === JSON.stringify(afterSheetAdd.breakdownIds) && afterSheetAdd.totalSpend === expectedSheetSpend && afterSheetAdd.breakdownTotal === expectedSheetSpend && afterSheetAdd.dailySpend === expectedSheetSpend, afterSheetAdd);

      const sheetEditMapping = { ...sheetMapping, sourceId: sheetSourceId, displayName: `${runTag}-sheets-edited` };
      const sheetEdited = await postJson(`/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/spend/sheets/process`, {
        connectionId: dedicatedConnectionId,
        mapping: sheetEditMapping,
        platformContext: "ga4",
      });
      const sheetEditedState = await exactSourceState(sheetSourceId);
      check("sheetEditStableIdentity", sheetEdited.ok && String(sheetEdited.body?.sourceId || "") === sheetSourceId && sheetEditedState?.display_name === `${runTag}-sheets-edited` && sheetEditedState?.total === expectedSheetSpend && (await testSourceIds()).length === 1, { status: sheetEdited.status, body: sheetEdited.body });

      const beforeMappingFailure = sanitizedSource(await exactSourceState(sheetSourceId));
      const mappingFailure = await postJson(`/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/spend/sheets/process`, {
        connectionId: dedicatedConnectionId,
        mapping: { ...sheetEditMapping, spendColumn: `${runTag}-missing-column` },
        platformContext: "ga4",
      });
      const afterMappingFailure = sanitizedSource(await exactSourceState(sheetSourceId));
      check("sheetMappingFailurePreservesLastGood", mappingFailure.status === 400 && mappingFailure.body?.code === "SHEET_MAPPING_CHANGED" && JSON.stringify(afterMappingFailure) === JSON.stringify(beforeMappingFailure), { status: mappingFailure.status, code: mappingFailure.body?.code });

      const beforeSheetCurrencyFailure = sanitizedSource(await exactSourceState(sheetSourceId));
      const sheetCurrencyFailure = await postJson(`/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/spend/sheets/process`, {
        connectionId: dedicatedConnectionId,
        mapping: { ...sheetEditMapping, currency: otherCurrency },
        platformContext: "ga4",
      });
      const afterSheetCurrencyFailure = sanitizedSource(await exactSourceState(sheetSourceId));
      check("sheetCurrencyFailurePreservesLastGood", sheetCurrencyFailure.status === 400 && sheetCurrencyFailure.body?.code === "SPEND_CURRENCY_MISMATCH" && JSON.stringify(afterSheetCurrencyFailure) === JSON.stringify(beforeSheetCurrencyFailure), { status: sheetCurrencyFailure.status, code: sheetCurrencyFailure.body?.code });

      const csvName = `${runTag}-csv.csv`;
      const csvFile = {
        name: csvName,
        text: "Date,Spend,Campaign\n2026-09-01,3,TARGET_A\n2026-09-02,2,TARGET_A\n2026-09-03,7,TARGET_B\n2026-09-04,4,TARGET_B",
      };
      const csvPreview = await csvRequest("preview", {}, csvFile);
      check("csvPreviewExact", csvPreview.ok && csvPreview.body?.rowCount === 4 && JSON.stringify(csvPreview.body?.headers) === JSON.stringify(["Date", "Spend", "Campaign"]), { status: csvPreview.status, body: csvPreview.body });
      const csvMapping = {
        spendColumn: "Spend",
        dateColumn: "Date",
        campaignColumn: "Campaign",
        campaignValues: ["TARGET_A"],
        currency: campaignCurrency,
        displayName: csvName,
        platformContext: "ga4",
      };
      const csvAdded = await csvRequest("process", csvMapping, csvFile);
      csvSourceId = String(csvAdded.body?.sourceId || "");
      if (!csvSourceId) csvSourceId = (await testSourceIds()).find((id) => id !== sheetSourceId) || "";
      const csvAddedState = csvSourceId ? await exactSourceState(csvSourceId) : null;
      check("csvAddFilteredAndDated", csvAdded.ok && money(csvAdded.body?.importedRowsTotalSpend) === 5 && csvAdded.body?.spendToDate === 5 && csvAddedState?.total === 5 && csvAddedState?.records.length === 2, { status: csvAdded.status, body: csvAdded.body });

      const afterCsvAdd = await endpointSnapshot();
      check("csvAddReconciled", afterCsvAdd.allOk && afterCsvAdd.sourceIds.length === 2 && JSON.stringify(afterCsvAdd.sourceIds) === JSON.stringify(afterCsvAdd.breakdownIds) && afterCsvAdd.totalSpend === money(expectedSheetSpend + 5) && afterCsvAdd.breakdownTotal === money(expectedSheetSpend + 5) && afterCsvAdd.dailySpend === money(expectedSheetSpend + 5), afterCsvAdd);

      const csvEditMapping = { ...csvMapping, sourceId: csvSourceId, campaignValues: ["TARGET_B"], displayName: `${runTag}-csv-edited.csv` };
      const csvEdited = await csvRequest("process", csvEditMapping);
      const csvEditedState = await exactSourceState(csvSourceId);
      check("csvEditWithoutUploadStableIdentity", csvEdited.ok && String(csvEdited.body?.sourceId || "") === csvSourceId && money(csvEdited.body?.importedRowsTotalSpend) === 11 && csvEditedState?.total === 11 && csvEditedState?.records.length === 2 && (await testSourceIds()).length === 2, { status: csvEdited.status, body: csvEdited.body });

      const beforeCsvCurrencyFailure = sanitizedSource(await exactSourceState(csvSourceId));
      const csvCurrencyFailure = await csvRequest("process", { ...csvEditMapping, currency: otherCurrency });
      const afterCsvCurrencyFailure = sanitizedSource(await exactSourceState(csvSourceId));
      check("csvCurrencyFailurePreservesLastGood", csvCurrencyFailure.status === 400 && csvCurrencyFailure.body?.code === "SPEND_CURRENCY_MISMATCH" && JSON.stringify(afterCsvCurrencyFailure) === JSON.stringify(beforeCsvCurrencyFailure), { status: csvCurrencyFailure.status, code: csvCurrencyFailure.body?.code });

      const replacementFile = {
        name: `${runTag}-csv-replacement.csv`,
        text: "Date,Spend,Campaign\n2026-09-01,1,TARGET_A\n2026-09-02,1,TARGET_A\n2026-09-03,8,TARGET_B\n2026-09-04,5,TARGET_B",
      };
      const csvReplaced = await csvRequest("process", { ...csvEditMapping, displayName: replacementFile.name }, replacementFile);
      const csvReplacedState = await exactSourceState(csvSourceId);
      check("csvManualReuploadReplacesExactSource", csvReplaced.ok && String(csvReplaced.body?.sourceId || "") === csvSourceId && money(csvReplaced.body?.importedRowsTotalSpend) === 13 && csvReplacedState?.total === 13 && csvReplacedState?.records.length === 2, { status: csvReplaced.status, body: csvReplaced.body });

      const csvBeforeAutomatic = sanitizedSource(await exactSourceState(csvSourceId));
      const sheetBeforeAutomatic = await exactSourceState(sheetSourceId);
      let sheetLastSyncedAt = "";
      try { sheetLastSyncedAt = JSON.parse(String(sheetBeforeAutomatic?.mapping_config || "{}"))?.lastSyncedAt || ""; } catch { sheetLastSyncedAt = ""; }
      let automaticObserved = false;
      let automaticObservationSeconds = 0;
      while (!automaticObserved && automaticObservationSeconds < 180) {
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        automaticObservationSeconds += 10;
        const refreshed = await exactSourceState(sheetSourceId);
        let refreshedAt = "";
        try { refreshedAt = JSON.parse(String(refreshed?.mapping_config || "{}"))?.lastSyncedAt || ""; } catch { refreshedAt = ""; }
        automaticObserved = new Date(refreshedAt || 0).getTime() > new Date(sheetLastSyncedAt || 0).getTime();
      }
      const csvAfterAutomatic = sanitizedSource(await exactSourceState(csvSourceId));
      const sheetAfterAutomatic = await exactSourceState(sheetSourceId);
      check("sheetAutomaticRefreshStable", automaticObserved && sheetAfterAutomatic?.total === expectedSheetSpend && sheetAfterAutomatic?.id === sheetSourceId, { automaticObservationSeconds, total: sheetAfterAutomatic?.total });
      check("csvExcludedFromScheduler", JSON.stringify(csvAfterAutomatic) === JSON.stringify(csvBeforeAutomatic), { automaticObservationSeconds });
      observations.automaticRefresh = { observed: automaticObserved, observationSeconds: automaticObservationSeconds };

      const afterAllUpdates = await endpointSnapshot();
      const afterAllState = await state();
      check("finalActiveReconciliation", afterAllUpdates.allOk && afterAllUpdates.sourceIds.length === 2 && afterAllUpdates.totalSpend === money(expectedSheetSpend + 13) && afterAllUpdates.breakdownTotal === money(expectedSheetSpend + 13) && afterAllUpdates.dailySpend === money(expectedSheetSpend + 13) && afterAllState.campaignSpend === money(expectedSheetSpend + 13), { endpoints: afterAllUpdates, campaignSpend: afterAllState.campaignSpend });
      observations.activeFixture = { sheetSpend: expectedSheetSpend, sheetRecordCount: expectedSheetRecordCount, csvSpend: 13, sourceCount: 2, totalSpend: money(expectedSheetSpend + 13), sheetCampaignValueHash: hash(selectedCampaignValue) };

      const csvDeleted = await deleteSource(csvSourceId);
      const afterCsvDelete = await endpointSnapshot();
      const csvDeletedState = await exactSourceState(csvSourceId);
      check("csvDeleteExact", csvDeleted.ok && csvDeletedState?.is_active === false && csvDeletedState.records.length === 0 && afterCsvDelete.sourceIds.length === 1 && afterCsvDelete.totalSpend === expectedSheetSpend, { status: csvDeleted.status, sourceInactive: csvDeletedState?.is_active === false, records: csvDeletedState?.records.length, sourceCount: afterCsvDelete.sourceIds.length, totalSpend: afterCsvDelete.totalSpend });
      csvSourceId = "";

      const sheetDeleted = await deleteSource(sheetSourceId);
      const afterSheetDelete = await endpointSnapshot();
      const sheetDeletedState = await exactSourceState(sheetSourceId);
      const sheetConnectionAfterDelete = await dbClient.query(`
        SELECT is_active FROM google_sheets_connections
        WHERE id::text = $1 AND campaign_id = $2 AND purpose = 'spend' LIMIT 1
      `, [dedicatedConnectionId, CAMPAIGN_ID]);
      check("sheetDeleteExact", sheetDeleted.ok && sheetDeletedState?.is_active === false && sheetDeletedState.records.length === 0 && sheetConnectionAfterDelete.rows[0]?.is_active === false && afterSheetDelete.sourceIds.length === 0 && afterSheetDelete.totalSpend === 0, { status: sheetDeleted.status, sourceInactive: sheetDeletedState?.is_active === false, records: sheetDeletedState?.records.length, connectionInactive: sheetConnectionAfterDelete.rows[0]?.is_active === false, sourceCount: afterSheetDelete.sourceIds.length, totalSpend: afterSheetDelete.totalSpend });
      sheetSourceId = "";
    } catch (error) {
      fatalError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      failures.push(fatalError);
    } finally {
      const remainingTestSourceIds = await testSourceIds().catch(() => [] as string[]);
      for (const sourceId of remainingTestSourceIds) {
        const result = await deleteSource(sourceId).catch(() => null);
        if (!result?.ok && await exactSourceState(sourceId).catch(() => null)) {
          await storage.deleteSpendSourceWithRecords(CAMPAIGN_ID, sourceId, "ga4").catch(() => false);
        }
      }
      const inactiveTestSourceIds = await testSourceIds().catch(() => [] as string[]);
      for (const sourceId of inactiveTestSourceIds) {
        const source = await exactSourceState(sourceId).catch(() => null);
        if (source?.is_active === false && source.records.length === 0) {
          await storage.hardDeleteInactiveSpendSource(CAMPAIGN_ID, sourceId).catch(() => false);
        }
      }
      const remainingAfterHardCleanup = await testSourceIds().catch(() => [] as string[]);
      const cleanupState = await state().catch(() => null);
      if (remainingAfterHardCleanup.length === 0 && cleanupState && cleanupState.campaignSpend !== baselineState.campaignSpend) {
        await storage.updateCampaign(CAMPAIGN_ID, { spend: String(baselineState.campaignSpend) as any } as any).catch(() => undefined);
      }
      for (const connectionId of createdConnectionIds) {
        if (baselineConnectionIds.has(connectionId)) continue;
        const connectionStillExists = await dbClient.query(`
          SELECT id::text FROM google_sheets_connections
          WHERE id::text = $1 AND campaign_id = $2 AND purpose = 'spend' LIMIT 1
        `, [connectionId, CAMPAIGN_ID]).then((result) => result.rowCount === 1).catch(() => false);
        if (connectionStillExists && remainingAfterHardCleanup.length === 0) {
          await storage.deleteGoogleSheetsConnection(connectionId).catch(() => false);
          await pool.query(`
            DELETE FROM google_sheets_connections
            WHERE id::text = $1 AND campaign_id = $2 AND purpose = 'spend' AND is_active = false
          `, [connectionId, CAMPAIGN_ID]).catch(() => undefined);
        }
      }
    }

    const finalState = await state();
    const finalEndpoints = await endpointSnapshot();
    const sourceStateRestored = JSON.stringify(finalState.sources) === JSON.stringify(baselineState.sources);
    const recordStateRestored = JSON.stringify(finalState.records) === JSON.stringify(baselineState.records);
    const connectionStateRestored = JSON.stringify(finalState.connections) === JSON.stringify(baselineState.connections);
    check("sourceStateRestored", sourceStateRestored, { before: baselineState.sources.length, after: finalState.sources.length });
    check("recordStateRestored", recordStateRestored, { before: baselineState.records.length, after: finalState.records.length });
    check("connectionStructureRestored", connectionStateRestored, { before: baselineState.connections.map((row) => hash(row.id)), after: finalState.connections.map((row) => hash(row.id)) });
    check("campaignSpendRestored", finalState.campaignSpend === baselineState.campaignSpend, { before: baselineState.campaignSpend, after: finalState.campaignSpend });
    check("visibilityStateUnchanged", finalState.notificationCount === baselineState.notificationCount && finalState.kpiAlertCount === baselineState.kpiAlertCount, { before: { notifications: baselineState.notificationCount, alerts: baselineState.kpiAlertCount }, after: { notifications: finalState.notificationCount, alerts: finalState.kpiAlertCount } });
    check("finalEndpointsRestored", finalEndpoints.allOk && finalEndpoints.sourceIds.length === 0 && finalEndpoints.totalSpend === 0 && finalEndpoints.breakdownTotal === 0 && finalEndpoints.dailySpend === 0, finalEndpoints);

    const output = {
      success: failures.length === 0 && Object.values(checks).every(Boolean),
      mode: "authorized_campaign2_exact_source_lifecycle_with_cleanup",
      deployedSha: health.commit,
      campaignHash: hash(CAMPAIGN_ID),
      completedEndDate,
      currency: campaignCurrency,
      checks,
      observations,
      cleanup: {
        sourceStateRestored,
        recordStateRestored,
        connectionStructureRestored: connectionStateRestored,
        campaignSpendRestored: finalState.campaignSpend === baselineState.campaignSpend,
        notificationsUnchanged: finalState.notificationCount === baselineState.notificationCount,
        kpiAlertsUnchanged: finalState.kpiAlertCount === baselineState.kpiAlertCount,
      },
      googleAds: "NOT CONFIGURED / EXCLUDED",
      knownUnvalidated: [
        "Campaign2 has no configured GA4 KPI, Benchmark, or Report consumers, so live persisted values for those consumers were not available",
        "Google Sheets source data was not edited at the provider; the negative last-good test used a missing mapped header",
        "Google transport/token failure injection was not performed",
      ],
      fatalError,
      failures,
    };
    console.log(JSON.stringify(output, null, 2));
    if (!output.success) process.exitCode = 1;
  }
} finally {
  await dbClient.query("ROLLBACK").catch(() => null);
  dbClient.release();
  if (sessionId) await clerkPost(`/sessions/${encodeURIComponent(sessionId)}/revoke`).catch(() => null);
  else if (signInTokenId) await clerkPost(`/sign_in_tokens/${encodeURIComponent(signInTokenId)}/revoke`).catch(() => null);
  await context?.close().catch(() => null);
  await browser?.close().catch(() => null);
  await pool.end().catch(() => null);
}
