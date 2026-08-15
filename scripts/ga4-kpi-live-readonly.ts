import { createHash } from "node:crypto";
import { chromium, type Browser, type BrowserContext, type Download, type Page } from "playwright";
import { PDFParse } from "pdf-parse";
import { pool } from "../server/db";
import { resolveGA4KpiLiveValue } from "../shared/ga4-kpi-live-value";
import { getGA4KpiMetricDependencies } from "../shared/ga4-kpi-metric-identity";
import {
  getGA4KpiReportingWindowLabel,
  resolveGA4InsightTargetPeriodCompatibility,
  resolveGA4KpiConsumerState,
  type GA4KpiConsumerState,
} from "../shared/ga4-kpi-consumer-state";
import { selectGA4FinancialTotalsSource } from "../shared/ga4-financial-source";
import { resolveGA4InsightsCampaignToDateSufficiencyReason } from "../shared/ga4-insights";
import {
  classifyKpiBandWithPolicy,
  computeAttainmentFillPct,
  computeAttainmentPct,
  computeEffectiveDeltaPct,
  isLowerIsBetterKpi,
  resolveKpiDataSufficiency,
  resolveKpiThresholdPolicy,
} from "../shared/kpi-math";
import { computeCpa, computeRoiPercent } from "../shared/metric-math";
import { getLatestGA4KPIIdsByDuplicateKey, isLatestGA4KPIForDuplicateKey } from "../server/utils/ga4-kpi-alert-dedupe";

const BASE_URL = String(process.env.GA4_KPI_VALIDATION_BASE_URL || "https://marketforensics.onrender.com").replace(/\/$/, "");
const EXPECTED_SHA = String(process.env.GA4_KPI_VALIDATION_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.GA4_KPI_VALIDATION_CAMPAIGN_ID || "").trim();
const clerkSecret = String(process.env.CLERK_SECRET_KEY || "").trim();

if (!pool) throw new Error("DATABASE_URL is required");
if (!clerkSecret) throw new Error("CLERK_SECRET_KEY is required");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("GA4_KPI_VALIDATION_EXPECTED_SHA must be a full Git SHA");
if (!/^[0-9a-f-]{36}$/i.test(CAMPAIGN_ID)) throw new Error("GA4_KPI_VALIDATION_CAMPAIGN_ID must be an exact campaign UUID");

type KpiRow = {
  id: string;
  campaign_id: string;
  owner_id: string;
  name: string;
  metric: string | null;
  description: string | null;
  unit: string;
  current_value: string | null;
  target_value: string;
  priority: string | null;
  timeframe: string | null;
  tracking_period: number | null;
  alerts_enabled: boolean;
  alert_threshold: string | null;
  alert_condition: string | null;
};

type PageInput = { ok: boolean; status: number; body: any; headers: Record<string, string>; url: string };

const hash = (value: unknown) => createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 12);
const normalizeText = (value: unknown) => String(value ?? "").replace(/,/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const numeric = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const parseJson = (value: unknown): any => {
  if (!value) return {};
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return {}; }
};
const responseReason = (response: PageInput) =>
  String(response.body?.error || response.body?.message || "no API reason returned").slice(0, 300);

const hasNumericEvidence = (text: string, value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return false;
  const normalized = normalizeText(text);
  return [String(number), number.toFixed(2), number.toFixed(1), String(Math.round(number))]
    .some((candidate) => normalized.includes(candidate.replace(/,/g, "").toLowerCase()));
};

const pdfText = async (data: Buffer) => {
  const parser = new PDFParse({ data: new Uint8Array(data) });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
};

const downloadBuffer = async (download: Download) => {
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Downloaded KPI PDF stream is unavailable");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
};

const formatMoney = (value: unknown, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
};

const formatCardValue = (value: unknown, unit: unknown, currency: string) => {
  const number = Number(value);
  const normalizedUnit = String(unit || "").trim();
  if (normalizedUnit === "%") {
    const rounded = Math.round(number * 100) / 100;
    return `${rounded.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
  }
  if (normalizedUnit === "$") return formatMoney(number, currency);
  if (normalizedUnit === "ratio") return `${number.toFixed(2)}x`;
  if (/^[A-Z]{3}$/.test(normalizedUnit)) return formatMoney(number, normalizedUnit);
  return number.toLocaleString("en-US");
};

const reportConfig = (report: any) => parseJson(report?.configuration);
const reportIncludesKpiItems = (report: any) => {
  const type = String(report?.reportType || "").trim().toLowerCase();
  if (type === "kpis") return true;
  if (type !== "custom") return false;
  const config = reportConfig(report);
  return config?.sections?.kpis === true
    && config?.subsections?.kpis?.items === true
    && Array.isArray(config?.selectedKpiIds)
    && config.selectedKpiIds.length > 0;
};
const selectedReportKpis = (report: any, rows: any[]) => {
  if (String(report?.reportType || "").trim().toLowerCase() !== "custom") return rows;
  const selected = new Set((reportConfig(report)?.selectedKpiIds || []).map(String));
  return rows.filter((row) => selected.has(String(row.id)));
};

const computeProgress = (kpi: any, current: number) => {
  const target = Number(kpi?.targetValue || 0);
  const metric = String(kpi?.metric || kpi?.name || "");
  const lowerIsBetter = isLowerIsBetterKpi({ metric, name: kpi?.name });
  const policy = resolveKpiThresholdPolicy({ metric, name: kpi?.name, unit: kpi?.unit, current, target, lowerIsBetter });
  const band = classifyKpiBandWithPolicy({ current, target, lowerIsBetter, policy }) ?? "below";
  const attainmentPct = computeAttainmentPct({ current, target, lowerIsBetter }) ?? 0;
  return {
    band,
    attainmentPct,
    fillPct: computeAttainmentFillPct(attainmentPct),
    effectiveDeltaPct: computeEffectiveDeltaPct({ current, target, lowerIsBetter }),
  };
};

const readPersistenceFingerprint = async (client: any, campaignId: string) => {
  const result = await client.query(`
    SELECT
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM campaigns WHERE id = $1) x) AS campaign,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT cl.* FROM clients cl JOIN campaigns c ON c.client_id = cl.id WHERE c.id = $1) x) AS client,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM ga4_connections WHERE campaign_id = $1) x) AS connections,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM ga4_daily_metrics WHERE campaign_id = $1) x) AS daily,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM revenue_sources WHERE campaign_id = $1) x) AS revenue_sources,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM revenue_records WHERE campaign_id = $1) x) AS revenue_records,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM spend_sources WHERE campaign_id = $1) x) AS spend_sources,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM spend_records WHERE campaign_id = $1) x) AS spend_records,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM kpis WHERE campaign_id = $1 AND platform_type = 'google_analytics') x) AS kpis,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT kp.* FROM kpi_progress kp JOIN kpis k ON k.id = kp.kpi_id WHERE k.campaign_id = $1 AND k.platform_type = 'google_analytics') x) AS progress,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT ka.* FROM kpi_alerts ka JOIN kpis k ON k.id = ka.kpi_id WHERE k.campaign_id = $1 AND k.platform_type = 'google_analytics') x) AS alerts,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT kp.* FROM kpi_periods kp JOIN kpis k ON k.id = kp.kpi_id WHERE k.campaign_id = $1 AND k.platform_type = 'google_analytics') x) AS periods,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM notifications WHERE campaign_id = $1) x) AS notifications,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT e.* FROM email_alert_events e JOIN kpis k ON k.id = e.entity_id WHERE e.entity_type = 'kpi' AND k.campaign_id = $1 AND k.platform_type = 'google_analytics') x) AS email_events,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT * FROM linkedin_reports WHERE campaign_id = $1 AND platform_type = 'google_analytics') x) AS reports,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT s.* FROM report_snapshots s JOIN linkedin_reports r ON r.id = s.report_id WHERE r.campaign_id = $1 AND r.platform_type = 'google_analytics') x) AS snapshots,
      (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.id)::text, '[]')) FROM (SELECT e.* FROM report_send_events e JOIN linkedin_reports r ON r.id = e.report_id WHERE r.campaign_id = $1 AND r.platform_type = 'google_analytics') x) AS send_events
  `, [campaignId]);
  return result.rows[0] || {};
};

const clerkPost = async (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const authenticatedContext = async (browser: Browser, ownerId: string) => {
  const tokenResponse = await clerkPost("/sign_in_tokens", { user_id: ownerId, expires_in_seconds: 600 });
  const tokenBody: any = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenBody?.token) throw new Error(`Clerk sign-in token failed (${tokenResponse.status})`);
  const context = await browser.newContext({ acceptDownloads: true, locale: "en-US" });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(tokenBody.token))}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60000 });
  const sessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ""));
  return { context, page, sessionId, signInTokenId: String(tokenBody.id || "") };
};

const pageInput = async (response: any): Promise<PageInput> => {
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: response.ok(), status: response.status(), body, headers: await response.allHeaders(), url: response.url() };
};

const expectedResponse = (page: Page, path: string) => {
  const expected = new URL(path, BASE_URL);
  return page.waitForResponse((response) => {
    const actual = new URL(response.url());
    if (actual.origin !== expected.origin || actual.pathname !== expected.pathname) return false;
    for (const [key, value] of expected.searchParams) {
      if (actual.searchParams.get(key) !== value) return false;
    }
    return true;
  }, { timeout: 120000 }).then(pageInput);
};

const corePaths = (propertyId: string) => ({
  notifications: "/api/notifications?readOnly=1",
  connectionStatus: `/api/ga4/check-connection/${CAMPAIGN_ID}?readOnly=1`,
  connections: `/api/campaigns/${CAMPAIGN_ID}/ga4-connections?readOnly=1`,
  daily: `/api/campaigns/${CAMPAIGN_ID}/ga4-daily?days=30&propertyId=${encodeURIComponent(propertyId)}&readOnly=1`,
  breakdown: `/api/campaigns/${CAMPAIGN_ID}/ga4-breakdown?dateRange=30days&propertyId=${encodeURIComponent(propertyId)}&readOnly=1`,
  toDate: `/api/campaigns/${CAMPAIGN_ID}/ga4-to-date?propertyId=${encodeURIComponent(propertyId)}&insightsScope=1&readOnly=1`,
  revenue: `/api/campaigns/${CAMPAIGN_ID}/revenue-to-date`,
  spend: `/api/campaigns/${CAMPAIGN_ID}/spend-to-date?platformContext=ga4`,
  revenueSources: `/api/campaigns/${CAMPAIGN_ID}/revenue-sources`,
  revenueBreakdown: `/api/campaigns/${CAMPAIGN_ID}/revenue-breakdown`,
  spendSources: `/api/campaigns/${CAMPAIGN_ID}/spend-sources?platformContext=ga4`,
  spendBreakdown: `/api/campaigns/${CAMPAIGN_ID}/spend-breakdown?platformContext=ga4`,
  kpis: `/api/platforms/google_analytics/kpis?campaignId=${encodeURIComponent(CAMPAIGN_ID)}`,
  reports: `/api/platforms/google_analytics/reports?campaignId=${encodeURIComponent(CAMPAIGN_ID)}`,
});

const client = await pool.connect();
let browser: Browser | null = null;
let auth: { context: BrowserContext; page: Page; sessionId: string; signInTokenId: string } | null = null;
let output: Record<string, unknown> | null = null;
let thrown: unknown = null;

try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const inventory = await client.query(`
    SELECT c.id, c.owner_id, c.client_id, cl.owner_id AS client_owner_id,
           c.reporting_time_zone, c.currency, c.ga4_campaign_filter,
           g.id AS connection_id, g.property_id, g.method
    FROM campaigns c
    JOIN clients cl ON cl.id = c.client_id
    JOIN ga4_connections g ON g.campaign_id = c.id AND g.is_active = true
    WHERE c.id = $1
    ORDER BY g.is_primary DESC, g.connected_at ASC
    LIMIT 1
  `, [CAMPAIGN_ID]);
  if (inventory.rowCount !== 1) throw new Error("Exact active campaign/property inventory row was not found");
  const campaign = inventory.rows[0];
  if (!campaign.owner_id || String(campaign.owner_id) !== String(campaign.client_owner_id || "")) {
    throw new Error("Campaign client scope is missing or belongs to another tenant");
  }
  const propertyId = String(campaign.property_id || "").trim();
  if (!propertyId) throw new Error("The target campaign has no exact active GA4 property");
  const currency = String(campaign.currency || "USD").trim().toUpperCase();

  const kpiInventory = await client.query<KpiRow>(`
    SELECT k.id, k.campaign_id, c.owner_id, k.name, k.metric, k.description, k.unit,
           k.current_value, k.target_value, k.priority, k.timeframe, k.tracking_period,
           k.alerts_enabled, k.alert_threshold, k.alert_condition
    FROM kpis k
    JOIN campaigns c ON c.id = k.campaign_id
    WHERE k.campaign_id = $1
      AND k.platform_type = 'google_analytics'
    ORDER BY k.created_at, k.id
  `, [CAMPAIGN_ID]);
  if (kpiInventory.rows.length === 0) throw new Error("No active campaign-scoped GA4 KPIs exist for validation");

  const persistedNotifications = await client.query(`
    SELECT id, title, message, type, metadata, created_at
    FROM notifications
    WHERE campaign_id = $1
    ORDER BY created_at DESC, id
  `, [CAMPAIGN_ID]);
  const persistedAlertRows = await client.query(`
    SELECT ka.*
    FROM kpi_alerts ka
    JOIN kpis k ON k.id = ka.kpi_id
    WHERE k.campaign_id = $1 AND k.platform_type = 'google_analytics'
    ORDER BY ka.created_at DESC, ka.id
  `, [CAMPAIGN_ID]);
  const persistenceFingerprintBefore = await readPersistenceFingerprint(client, CAMPAIGN_ID);

  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json().catch(() => null);
  if (!healthResponse.ok || health?.commit !== EXPECTED_SHA) {
    throw new Error(`Deployed SHA mismatch: ${String(health?.commit || "unavailable")}`);
  }

  browser = await chromium.launch({ headless: true });
  auth = await authenticatedContext(browser, String(campaign.owner_id));
  const { page } = auth;
  const blockedApplicationMutations: string[] = [];
  const blockedUnsafeGets: string[] = [];
  const readOnlyRewrites: string[] = [];
  const unsafeGetPatterns = [
    /\/api\/campaigns\/[^/]+\/ga4-diagnostics$/,
    /\/api\/campaigns\/[^/]+\/ga4-landing-pages$/,
    /\/api\/campaigns\/[^/]+\/ga4-conversion-events$/,
    /\/api\/campaigns\/[^/]+\/ga4-geographic$/,
    /\/api\/(?:hubspot|salesforce)\/[^/]+\/pipeline-proxy$/,
    /\/api\/report-snapshots\/[^/]+\/pdf$/,
  ];
  const readOnlyGetPatterns = [
    /\/api\/notifications$/,
    /\/api\/ga4\/check-connection\/[^/]+$/,
    /\/api\/campaigns\/[^/]+\/ga4-connections$/,
    /\/api\/campaigns\/[^/]+\/ga4-daily$/,
    /\/api\/campaigns\/[^/]+\/ga4-breakdown$/,
    /\/api\/campaigns\/[^/]+\/ga4-to-date$/,
  ];

  await page.route(`${BASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET") {
      blockedApplicationMutations.push(`${request.method()} ${url.pathname}`);
      await route.abort();
      return;
    }
    if (unsafeGetPatterns.some((pattern) => pattern.test(url.pathname))) {
      blockedUnsafeGets.push(`${url.pathname}${url.search}`);
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "READ_ONLY_VALIDATION_BLOCKED" }),
      });
      return;
    }
    if (readOnlyGetPatterns.some((pattern) => pattern.test(url.pathname)) && url.searchParams.get("readOnly") !== "1") {
      url.searchParams.set("readOnly", "1");
      readOnlyRewrites.push(`${url.pathname}${url.search}`);
      await route.continue({ url: url.toString() });
      return;
    }
    await route.continue();
  });

  const { reports: reportsPath, ...initialPaths } = corePaths(propertyId);
  const pendingInputs = Object.entries(initialPaths).map(async ([name, path]) => [name, await expectedResponse(page, path)] as const);
  await page.goto(`${BASE_URL}/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/ga4-metrics?tab=kpis&readOnly=1`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  const inputs = Object.fromEntries(await Promise.all(pendingInputs)) as Record<string, PageInput>;
  const failures: string[] = [];
  for (const [name, response] of Object.entries(inputs)) {
    if (!response.ok) failures.push(`${name} page input failed (${response.status}): ${responseReason(response)}`);
  }
  for (const name of ["connectionStatus", "connections", "daily", "breakdown", "toDate"]) {
    if (inputs[name]?.body?.validationReadOnly !== true) failures.push(`${name} page input did not confirm read-only mode`);
  }
  if (inputs.notifications?.headers?.["x-ga4-validation-read-only"] !== "1"
    || inputs.notifications?.headers?.["x-ga4-credential-refresh-allowed"] !== "0") {
    failures.push("Notifications did not confirm the no-refresh read-only contract");
  }
  if (inputs.daily?.body?.providerRefreshAttempted !== false) {
    failures.push("The exact KPI daily page input attempted a provider refresh");
  }
  if (String(inputs.daily?.body?.propertyId || "").replace(/^properties\//, "") !== propertyId.replace(/^properties\//, "")) {
    failures.push("The KPI daily page input returned a different GA4 property");
  }
  if (String(inputs.breakdown?.body?.propertyId || "").replace(/^properties\//, "") !== propertyId.replace(/^properties\//, "")) {
    failures.push("The KPI breakdown page input returned a different GA4 property");
  }

  const apiKpis = Array.isArray(inputs.kpis?.body) ? inputs.kpis.body : [];
  const inventoryIds = new Set(kpiInventory.rows.map((row) => String(row.id)));
  const apiIds = new Set(apiKpis.map((row: any) => String(row?.id || "")));
  if (inventoryIds.size !== apiIds.size || [...inventoryIds].some((id) => !apiIds.has(id))) {
    failures.push("Authenticated KPI API inventory does not match the exact database campaign/platform scope");
  }

  const dailyRows = (Array.isArray(inputs.daily?.body?.data) ? inputs.daily.body.data : [])
    .filter((row: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(row?.date || "")))
    .filter((row: any) => !inputs.daily?.body?.dataThroughDate || String(row.date) <= String(inputs.daily.body.dataThroughDate));
  const dailyTotals = dailyRows.reduce((sum: any, row: any) => ({
    sessions: sum.sessions + Number(row?.sessions || 0),
    users: sum.users + Number(row?.users || 0),
    pageviews: sum.pageviews + Number(row?.pageviews || 0),
    conversions: sum.conversions + Number(row?.conversions || 0),
    revenue: sum.revenue + Number(row?.revenue || 0),
    engagedSessions: sum.engagedSessions + Number(row?.engagedSessions || 0),
  }), { sessions: 0, users: 0, pageviews: 0, conversions: 0, revenue: 0, engagedSessions: 0 });
  dailyTotals.revenue = Number(dailyTotals.revenue.toFixed(2));
  dailyTotals.engagementRate = dailyTotals.sessions > 0 ? dailyTotals.engagedSessions / dailyTotals.sessions : 0;

  const revenueDefinitions = Array.isArray(inputs.revenueSources?.body?.sources)
    ? inputs.revenueSources.body.sources
    : Array.isArray(inputs.revenueSources?.body) ? inputs.revenueSources.body : [];
  const spendDefinitions = Array.isArray(inputs.spendSources?.body?.sources)
    ? inputs.spendSources.body.sources
    : Array.isArray(inputs.spendSources?.body) ? inputs.spendSources.body : [];
  const revenueBreakdownSources = Array.isArray(inputs.revenueBreakdown?.body?.sources) ? inputs.revenueBreakdown.body.sources : [];
  const spendBreakdownSources = Array.isArray(inputs.spendBreakdown?.body?.sources) ? inputs.spendBreakdown.body.sources : [];
  const revenueDisplaySourceCount = revenueBreakdownSources.length > 0
    ? new Set([...revenueBreakdownSources.map((row: any) => String(row?.sourceId || "")), ...revenueDefinitions.filter((row: any) => row?.isActive !== false).map((row: any) => String(row?.id || ""))]).size
    : revenueDefinitions.filter((row: any) => row?.isActive !== false).length;
  const spendDisplaySourceCount = spendBreakdownSources.length > 0
    ? spendBreakdownSources.length
    : spendDefinitions.filter((row: any) => row?.isActive !== false).length;
  const importedRevenue = Number(inputs.revenue?.body?.totalRevenue || 0);
  const hasImportedRevenueSource = revenueDisplaySourceCount > 0
    || (Array.isArray(inputs.revenue?.body?.sourceIds) && inputs.revenue.body.sourceIds.length > 0);
  const requiresVerifiedNativeCurrency = hasImportedRevenueSource && !!propertyId;
  const toDateCurrencyMatches = String(inputs.toDate?.body?.currencyCode || "").trim().toUpperCase() === currency;
  const financialCandidates = requiresVerifiedNativeCurrency
    ? [toDateCurrencyMatches ? inputs.toDate?.body?.totals : null]
    : [inputs.toDate?.body?.totals, dailyRows.length > 0 ? dailyTotals : null, inputs.breakdown?.body?.totals || null];
  const financialNative = selectGA4FinancialTotalsSource(financialCandidates, inputs.toDate?.body?.totals || {} as any);
  const ga4Revenue = Number(financialNative?.revenue || 0);
  const ga4HasRevenueMetric = Boolean(String(inputs.toDate?.body?.revenueMetric || "").trim()) || ga4Revenue !== 0;
  const financialRevenue = ga4Revenue + importedRevenue;
  const financialConversions = Number(financialNative?.conversions || 0);
  const financialSpend = spendDisplaySourceCount > 0
    ? Number(inputs.spendBreakdown?.body?.totalSpend ?? inputs.spend?.body?.spendToDate ?? 0)
    : 0;
  const financialROI = computeRoiPercent(financialRevenue, financialSpend);
  const financialCPA = computeCpa(financialSpend, financialConversions);
  const revenueAvailable = hasImportedRevenueSource || ga4HasRevenueMetric;
  const spendAvailable = spendDisplaySourceCount > 0
    || (Array.isArray(inputs.spend?.body?.sourceIds) && inputs.spend.body.sourceIds.length > 0);

  const expectedRows = apiKpis.map((kpi: any) => {
    const liveValue = Number(resolveGA4KpiLiveValue({
      kpi,
      breakdownTotals: dailyTotals,
      overviewEngagementRate: dailyTotals.engagementRate,
      financialRevenue,
      financialSpend,
      financialROI,
      financialCPA,
    })) || 0;
    const dependencies = getGA4KpiMetricDependencies(kpi?.metric || kpi?.name);
    const missing: string[] = [];
    if (dependencies.requiresSpend && !spendAvailable) missing.push("Spend");
    if (dependencies.requiresRevenue && !revenueAvailable) missing.push("Revenue");
    const noWindowReason = resolveGA4InsightsCampaignToDateSufficiencyReason({
      noCompletedWindow: inputs.toDate?.body?.noCompletedWindow === true,
      hasImportedRevenueSource,
      metric: kpi?.metric,
      name: kpi?.name,
    });
    const sufficiency = noWindowReason ? { sufficient: false, reason: noWindowReason } : resolveKpiDataSufficiency({
      metric: kpi?.metric,
      name: kpi?.name,
      sessions: dailyTotals.sessions,
      conversions: financialConversions,
      spend: financialSpend,
    });
    const state = resolveGA4KpiConsumerState({
      metric: kpi?.metric,
      name: kpi?.name,
      listState: "ready",
      trafficState: !inputs.daily.ok || !inputs.breakdown.ok
        ? "unavailable"
        : inputs.daily?.body?.refreshIsStale === true ? "stale" : "ready",
      revenueState: inputs.toDate.ok && inputs.revenue.ok && inputs.revenueSources.ok && inputs.revenueBreakdown.ok ? "ready" : "unavailable",
      spendState: inputs.spend.ok && inputs.spendSources.ok && inputs.spendBreakdown.ok ? "ready" : "unavailable",
      missingDependencies: missing,
      sufficiencyReason: sufficiency.sufficient ? null : sufficiency.reason || "Required denominator data is not available.",
    });
    return { kpi, liveValue, state, progress: computeProgress(kpi, liveValue) };
  });
  const isExpectedAlertBreached = (row: any) => {
    const threshold = Number(row.kpi.alertThreshold);
    if (!row.kpi.alertsEnabled || !row.state.eligible || !Number.isFinite(threshold)) return false;
    const condition = String(row.kpi.alertCondition || "below");
    if (condition === "above") return row.liveValue > threshold;
    if (condition === "equals") return Math.abs(row.liveValue - threshold) < 0.01;
    return row.liveValue < threshold;
  };

  await page.locator("#ga4-kpis-section").waitFor({ state: "visible", timeout: 60000 });
  await page.waitForFunction((ids) => ids.every((id) => {
    const card = document.querySelector(`#ga4-kpi-${id}`) as HTMLElement | null;
    return Boolean(card && !/source inputs are still loading|kpi list is still loading/i.test(String(card.innerText || "")));
  }), apiKpis.map((row: any) => String(row.id)), { timeout: 60000 }).catch(() => null);

  const cardEvidence: any[] = [];
  for (const expected of expectedRows) {
    const card = page.locator(`#ga4-kpi-${expected.kpi.id}`);
    const visible = await card.isVisible().catch(() => false);
    const dom = visible ? await card.evaluate((element) => {
      const lines = String((element as HTMLElement).innerText || "").split("\n").map((line) => line.trim()).filter(Boolean);
      const currentIndex = lines.indexOf("Current"), targetIndex = lines.indexOf("Target"), progressIndex = lines.indexOf("Progress");
      const stateLabels = ["Last-good — not verified", "Blocked", "Insufficient data", "Loading", "Unavailable", "Failed"];
      return {
        text: lines.join("\n"),
        current: currentIndex >= 0 ? lines[currentIndex + 1] || "" : "",
        target: targetIndex >= 0 ? lines[targetIndex + 1] || "" : "",
        progress: progressIndex >= 0 ? lines[progressIndex + 1] || "" : "",
        window: lines.find((line) => line.startsWith("Window: ")) || "",
        stateLabel: stateLabels.find((label) => lines.includes(label)) || "Verified current value",
        alertPulse: Boolean(element.querySelector(".animate-pulse")),
      };
    }) : { text: "", current: "", target: "", progress: "", window: "", stateLabel: "", alertPulse: false };
    const showCurrent = expected.state.eligible || expected.state.code === "insufficient_data" || expected.state.code === "stale";
    const expectedCurrent = showCurrent ? formatCardValue(expected.liveValue, expected.kpi.unit, currency) : "—";
    const expectedTarget = formatCardValue(expected.kpi.targetValue, expected.kpi.unit, currency);
    const expectedPulse = isExpectedAlertBreached(expected);
    const checks = {
      name: normalizeText(dom.text).includes(normalizeText(expected.kpi.name)),
      current: dom.current === expectedCurrent,
      target: dom.target === expectedTarget,
      window: dom.window === `Window: ${getGA4KpiReportingWindowLabel(expected.kpi.metric, expected.kpi.name)}`,
      state: dom.stateLabel === expected.state.label,
      alertPulse: dom.alertPulse === expectedPulse,
    };
    if (!visible || Object.values(checks).some((value) => !value)) {
      failures.push(`${hash(expected.kpi.id)}: deployed KPI card/input/state/alert parity failed`);
    }
    cardEvidence.push({ kpiHash: hash(expected.kpi.id), visible, checks, state: expected.state.code, liveValue: expected.liveValue });
  }

  const expectedTracker = expectedRows.reduce((tracker: any, row: any) => {
    tracker.total += 1;
    if (!row.state.eligible || !Number.isFinite(Number(row.kpi.targetValue)) || Number(row.kpi.targetValue) <= 0) return tracker;
    tracker.scored += 1;
    tracker[row.progress.band] += 1;
    tracker.sum += row.progress.fillPct;
    return tracker;
  }, { total: 0, scored: 0, above: 0, near: 0, below: 0, sum: 0 });
  const trackerDom = await page.evaluate(() => {
    const labels = ["Total KPIs", "Above Target", "On Track", "Below Target", "Avg. Progress"];
    return Object.fromEntries(labels.map((label) => {
      const node = [...document.querySelectorAll("p")].find((item) => String(item.textContent || "").trim() === label);
      const values = node?.parentElement ? [...node.parentElement.querySelectorAll("p")] : [];
      return [label, String(values[1]?.textContent || "").trim()];
    }));
  });
  const expectedAverage = expectedTracker.scored > 0 ? expectedTracker.sum / expectedTracker.scored : 0;
  const trackerParity = Number(trackerDom["Total KPIs"]) === expectedTracker.total
    && Number(trackerDom["Above Target"]) === expectedTracker.above
    && Number(trackerDom["On Track"]) === expectedTracker.near
    && Number(trackerDom["Below Target"]) === expectedTracker.below
    && (expectedTracker.scored > 0
      ? Math.abs(Number(String(trackerDom["Avg. Progress"]).replace("%", "")) - expectedAverage) <= 0.11
      : trackerDom["Avg. Progress"] === "—");
  if (!trackerParity) failures.push("Deployed KPI Tracker does not match the exact scored card inputs");

  const persistedKpiNotifications = persistedNotifications.rows.filter((notification: any) => {
    const metadata = parseJson(notification?.metadata);
    return metadata?.kpiId && inventoryIds.has(String(metadata.kpiId));
  });
  const isPerformanceAlert = (notification: any) => {
    const metadata = parseJson(notification?.metadata);
    return String(notification?.type || "").trim().toLowerCase() === "performance-alert"
      || String(metadata?.alertType || "").trim().toLowerCase() === "performance-alert"
      || (/\b(kpi|benchmark)\s+alert\b/i.test(String(notification?.title || "")) && Boolean(metadata?.kpiId || metadata?.benchmarkId));
  };
  const activePersistedAlerts = persistedKpiNotifications.filter((notification: any) => {
    const metadata = parseJson(notification?.metadata);
    return isPerformanceAlert(notification) && !metadata?.dismissedAt && !metadata?.resolved;
  });
  const persistedNotificationEvidence = expectedRows.map((row: any) => ({
    kpiHash: hash(row.kpi.id),
    persistedCount: persistedKpiNotifications.filter((notification: any) => String(parseJson(notification?.metadata)?.kpiId || "") === String(row.kpi.id)).length,
    alertAuditCount: persistedAlertRows.rows.filter((alert: any) => String(alert?.kpi_id || "") === String(row.kpi.id)).length,
  }));
  const latestIdsByKey = getLatestGA4KPIIdsByDuplicateKey(apiKpis);
  const expectedNotificationKpiIds = new Set(expectedRows
    .filter((row: any) => isExpectedAlertBreached(row))
    .filter((row: any) => isLatestGA4KPIForDuplicateKey(row.kpi, latestIdsByKey))
    .filter((row: any) => activePersistedAlerts.some((notification: any) => String(parseJson(notification?.metadata)?.kpiId || "") === String(row.kpi.id)))
    .map((row: any) => String(row.kpi.id)));
  const apiNotifications = Array.isArray(inputs.notifications?.body) ? inputs.notifications.body : [];
  if (!Array.isArray(inputs.notifications?.body)) failures.push("Notifications read-only response was not an array");
  const actualKpiNotifications = apiNotifications.filter((notification: any) => {
    const metadata = parseJson(notification?.metadata);
    return String(notification?.campaignId || "") === CAMPAIGN_ID
      && inventoryIds.has(String(metadata?.kpiId || ""))
      && isPerformanceAlert(notification);
  });
  const actualNotificationKpiIds = actualKpiNotifications.map((notification: any) => String(parseJson(notification?.metadata)?.kpiId || ""));
  const uniqueActualNotificationKpiIds = new Set(actualNotificationKpiIds);
  const notificationRows = actualKpiNotifications.map((notification: any) => {
    const metadata = parseJson(notification?.metadata);
    const row = expectedRows.find((candidate: any) => String(candidate.kpi.id) === String(metadata?.kpiId || ""));
    const checks = {
      expected: Boolean(row && expectedNotificationKpiIds.has(String(row.kpi.id))),
      current: Boolean(row && Math.abs(Number(metadata?.currentValue) - Number(row.liveValue)) <= 0.01),
      threshold: Boolean(row && Math.abs(Number(metadata?.thresholdValue) - Number(row.kpi.alertThreshold)) <= 0.01),
      condition: Boolean(row && String(metadata?.alertCondition || "below") === String(row.kpi.alertCondition || "below")),
      itemType: String(metadata?.itemType || "") === "kpi",
      title: Boolean(row && normalizeText(notification?.title).includes(normalizeText(row.kpi.name))),
    };
    return { kpiHash: hash(metadata?.kpiId), checks, exact: Object.values(checks).every(Boolean) };
  });
  const notificationParity = actualNotificationKpiIds.length === uniqueActualNotificationKpiIds.size
    && expectedNotificationKpiIds.size === uniqueActualNotificationKpiIds.size
    && [...expectedNotificationKpiIds].every((id) => uniqueActualNotificationKpiIds.has(id))
    && notificationRows.every((row: any) => row.exact);
  if (!notificationParity) failures.push("Deployed Notifications do not match exact breached, persisted, latest-KPI card values");

  await page.getByRole("tab", { name: "Insights", exact: true }).click();
  await page.getByTestId("insights-trackers").waitFor({ state: "visible", timeout: 120000 });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="insights-trackers"]')?.getAttribute("data-findings") !== null,
    undefined,
    { timeout: 120000 },
  );
  const findingRows = await page.getByTestId("insights-finding").evaluateAll((nodes) => nodes.map((node) => ({
    id: String(node.getAttribute("data-insight-id") || ""),
    title: String(node.getAttribute("data-title") || ""),
    description: String(node.getAttribute("data-description") || ""),
  })));
  const insightsEvidence: any[] = [];
  for (const row of expectedRows) {
    const compatibility = resolveGA4InsightTargetPeriodCompatibility({
      metric: row.kpi.metric,
      name: row.kpi.name,
      timeframe: row.kpi.timeframe,
      trackingPeriod: row.kpi.trackingPeriod,
    });
    const target = Number(row.kpi.targetValue);
    const invalidTarget = !Number.isFinite(target) || target <= 0;
    let directExpectedId: string | null = null;
    if (row.state.code === "blocked") directExpectedId = `integrity:kpi_blocked:${row.kpi.id}`;
    else if (invalidTarget) directExpectedId = `integrity:kpi_invalid_config:${row.kpi.id}`;
    else if (row.state.eligible && compatibility.comparable && row.progress.attainmentPct < 100) directExpectedId = `kpi:${row.kpi.id}`;
    else if (row.state.eligible && compatibility.comparable && Number(row.progress.effectiveDeltaPct || 0) >= 10) directExpectedId = `positive:kpi:${row.kpi.id}`;
    const directFinding = directExpectedId ? findingRows.find((item) => item.id === directExpectedId) : null;
    const consolidatedFinding = findingRows.find((item) => item.id === "integrity:targets_unverified"
      && normalizeText(item.description).includes(normalizeText(row.kpi.name)));
    const periodMismatchFinding = findingRows.find((item) => item.id === "integrity:target_period_mismatch"
      && normalizeText(item.description).includes(normalizeText(row.kpi.name)));
    const requiresConsolidatedFinding = !row.state.eligible && row.state.code !== "blocked" && !invalidTarget;
    let expectedMode = "direct_or_absent";
    let exact = false;
    if (consolidatedFinding) {
      expectedMode = "consolidated_unverified";
      exact = !directFinding && !periodMismatchFinding;
    } else if (requiresConsolidatedFinding) {
      expectedMode = "consolidated_unverified";
    } else if (row.state.eligible && !compatibility.comparable) {
      expectedMode = "period_mismatch";
      exact = Boolean(periodMismatchFinding) && !directFinding;
    } else {
      exact = (!directExpectedId || Boolean(directFinding)) && !periodMismatchFinding;
    }
    if (!exact) failures.push(`${hash(row.kpi.id)}: KPI-derived Insights context parity failed`);
    insightsEvidence.push({
      kpiHash: hash(row.kpi.id),
      expectedMode,
      expectedId: expectedMode === "consolidated_unverified" ? "integrity:targets_unverified" : directExpectedId,
      observed: consolidatedFinding?.id || periodMismatchFinding?.id || directFinding?.id || null,
      exact,
    });
  }

  const reportsResponsePromise = expectedResponse(page, reportsPath);
  await page.getByRole("tab", { name: "Reports", exact: true }).click();
  inputs.reports = await reportsResponsePromise;
  if (!inputs.reports.ok) failures.push(`reports page input failed (${inputs.reports.status}): ${responseReason(inputs.reports)}`);
  await page.getByText("Reports", { exact: true }).first().waitFor({ state: "visible", timeout: 60000 });

  const reports = (Array.isArray(inputs.reports?.body) ? inputs.reports.body : [])
    .filter((report: any) => String(report?.status || "active") === "active");
  const report = reports.find((item: any) => String(item?.reportType || "").trim().toLowerCase() === "kpis")
    || reports.find(reportIncludesKpiItems);
  let pdfEvidence: any = { available: false, exact: false, reportHash: null, rows: [] };
  if (!report) {
    failures.push("No active saved browser report includes KPI items, so exact deployed KPI PDF output is unverified");
  } else {
    try {
      const heading = page.locator("h3").filter({ hasText: String(report.name || "") }).first();
      await heading.waitFor({ state: "visible", timeout: 60000 });
      const card = heading.locator("xpath=ancestor::div[.//button[contains(normalize-space(.), 'Download')]][1]");
      const downloadPromise = page.waitForEvent("download", { timeout: 90000 });
      await card.getByRole("button", { name: "Download" }).first().click();
      const download = await downloadPromise;
      const downloadFailure = await download.failure();
      if (downloadFailure) throw new Error(downloadFailure);
      const text = normalizeText(await pdfText(await downloadBuffer(download)));
      const selectedRows = selectedReportKpis(report, expectedRows);
      const rows = selectedRows.map((row: any) => {
        const status = row.state.eligible
          ? row.progress.band === "above" ? "above target" : row.progress.band === "near" ? "on track" : "below target"
          : normalizeText(row.state.label);
        const checks = {
          name: text.includes(normalizeText(row.kpi.name)),
          window: text.includes(normalizeText(getGA4KpiReportingWindowLabel(row.kpi.metric, row.kpi.name))),
          current: row.state.eligible || row.state.code === "stale" ? hasNumericEvidence(text, row.liveValue) : true,
          target: row.state.eligible ? hasNumericEvidence(text, row.kpi.targetValue) : true,
          state: text.includes(status),
        };
        return { kpiHash: hash(row.kpi.id), checks, exact: Object.values(checks).every(Boolean) };
      });
      const exact = text.includes("key performance indicators") && rows.length > 0 && rows.every((row: any) => row.exact);
      if (!exact) failures.push(`${hash(report.id)}: downloaded browser KPI PDF does not match the exact page inputs and states`);
      pdfEvidence = { available: true, exact, reportHash: hash(report.id), rows };
    } catch (error: any) {
      failures.push(`${hash(report.id)}: deployed browser KPI PDF was unavailable (${String(error?.message || error).slice(0, 200)})`);
      pdfEvidence = { available: false, exact: false, reportHash: hash(report.id), rows: [] };
    }
  }

  if (blockedApplicationMutations.length > 0) {
    failures.push(`Application mutation requests were attempted and blocked: ${blockedApplicationMutations.join(", ")}`);
  }
  const persistenceFingerprintAfter = await readPersistenceFingerprint(client, CAMPAIGN_ID);
  const changedPersistenceComponents = Object.keys(persistenceFingerprintBefore)
    .filter((key) => persistenceFingerprintBefore[key] !== persistenceFingerprintAfter[key]);
  if (changedPersistenceComponents.length > 0) {
    failures.push(`Read-only validation observed changed campaign persistence: ${changedPersistenceComponents.join(", ")}`);
  }

  const schedulerResponse = await fetch(`${BASE_URL}/health/scheduler`);
  const scheduler: any = await schedulerResponse.json().catch(() => null);
  output = {
    success: failures.length === 0,
    certificationStatus: failures.length === 0 ? "candidate_evidence_passed" : "UNVERIFIED",
    mode: "read_only_application_data",
    deployedSha: health.commit,
    campaignHash: hash(CAMPAIGN_ID),
    ownerHash: hash(campaign.owner_id),
    propertyHash: hash(propertyId),
    reportingTimeZone: campaign.reporting_time_zone || "UTC",
    currency,
    kpiCount: apiKpis.length,
    failures,
    pageInputs: Object.fromEntries(Object.entries(inputs).map(([name, response]) => [name, {
      status: response.status,
      readOnly: response.body?.validationReadOnly === true || response.headers?.["x-ga4-validation-read-only"] === "1",
    }])),
    sourceWindows: {
      traffic: { startDate: inputs.daily?.body?.startDate || null, endDate: inputs.daily?.body?.endDate || null, importedDays: dailyRows.length },
      nativeFinancial: { startDate: inputs.toDate?.body?.startDate || null, endDate: inputs.toDate?.body?.endDate || null },
      importedRevenue: { startDate: inputs.revenue?.body?.startDate || null, endDate: inputs.revenue?.body?.endDate || null },
      spend: { startDate: inputs.spend?.body?.startDate || null, endDate: inputs.spend?.body?.endDate || null },
    },
    financialInputs: { ga4Revenue, importedRevenue, totalRevenue: financialRevenue, spend: financialSpend, conversions: financialConversions },
    tracker: { ...expectedTracker, sum: undefined, average: Number(expectedAverage.toFixed(1)), exact: trackerParity },
    cards: cardEvidence,
    alertsAndNotifications: {
      cardAlertPulseParity: cardEvidence.every((item) => item.checks.alertPulse),
      exact: notificationParity,
      persistedRows: persistedNotificationEvidence,
      visibleRows: notificationRows,
      deployedNotificationsApi: "read_only_no_credential_refresh_confirmed",
    },
    insights: insightsEvidence,
    browserPdf: pdfEvidence,
    blockedUnsafeGets,
    readOnlyRewrites,
    blockedApplicationMutations,
    persistenceSemanticStateUnchanged: changedPersistenceComponents.length === 0,
    scheduler: scheduler?.ga4DailyScheduler || null,
    limitations: [
      "Server snapshot/test-send/scheduled report paths are intentionally not called because their KPI preflight persists recomputation.",
      "This validator creates only a short-lived owner session in Clerk and revokes it during cleanup.",
    ],
  };
} catch (error) {
  thrown = error;
} finally {
  await client.query("ROLLBACK").catch(() => null);
  client.release();
  const cleanupErrors: string[] = [];
  if (auth) {
    await auth.context.close().catch(() => null);
    if (auth.sessionId) {
      const revoked = await clerkPost(`/sessions/${encodeURIComponent(auth.sessionId)}/revoke`).catch(() => null);
      if (!revoked?.ok) cleanupErrors.push(`session revoke failed (${revoked?.status || "unavailable"})`);
    } else if (auth.signInTokenId) {
      const revoked = await clerkPost(`/sign_in_tokens/${encodeURIComponent(auth.signInTokenId)}/revoke`).catch(() => null);
      if (!revoked?.ok) cleanupErrors.push(`sign-in token revoke failed (${revoked?.status || "unavailable"})`);
    }
  }
  if (browser) await browser.close().catch(() => null);
  await pool.end().catch(() => null);
  if (cleanupErrors.length > 0 && !thrown) thrown = new Error(`Clerk cleanup failed: ${cleanupErrors.join("; ")}`);
}

if (thrown) throw thrown;
if (!output) throw new Error("KPI production evidence packet was not produced");
console.log(JSON.stringify(output, null, 2));
if (output.success !== true) process.exitCode = 1;
