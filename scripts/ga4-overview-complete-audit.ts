import { createHash } from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { pool } from '../server/db';
import { normalizeGA4CampaignAllocationKey } from '../shared/ga4-financial-source';
import { resolveGA4ImportToDateWindow } from '../server/utils/reporting-timezone';

const BASE_URL = process.env.GA4_OVERVIEW_BASE_URL || 'https://marketforensics.onrender.com';
const EXPECTED_SHA = String(process.env.GA4_OVERVIEW_EXPECTED_SHA || '').trim();
const CAMPAIGN_ID = String(process.env.GA4_OVERVIEW_CAMPAIGN_ID || '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458').trim();
const PROPERTY_ID = String(process.env.GA4_OVERVIEW_PROPERTY_ID || '542352127').trim();
const clerkSecret = String(process.env.CLERK_SECRET_KEY || '').trim();

if (!pool) throw new Error('DATABASE_URL is required');
if (!clerkSecret) throw new Error('CLERK_SECRET_KEY is required');
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error('GA4_OVERVIEW_EXPECTED_SHA must be a full Git SHA');

const hash = (value: unknown) => createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);
const round2 = (value: unknown) => Number((Number(value) || 0).toFixed(2));
const compact = (value: string) => value.replace(/\s+/g, ' ').trim();
const clerkPost = async (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${clerkSecret}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const api = async (page: Page, path: string) => page.evaluate(async (requestPath) => {
  const token = await (window as any).Clerk?.session?.getToken();
  if (!token) throw new Error('Clerk session token is unavailable');
  const response = await fetch(requestPath, { credentials: 'include', headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: response.ok, status: response.status, body };
}, path);
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const exact = (actual: unknown, expected: unknown, label: string) => {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}`);
};
const total = (items: any[], key: string) => round2(items.reduce((sum, item) => sum + (Number(item?.[key]) || 0), 0));
const revenueSourceDisplayLabel = (source: any) => {
  const type = String(source?.sourceType || '').trim().toLowerCase();
  if (type === 'ga4') return 'Imported GA4 Revenue';
  if (type === 'shopify') return 'Shopify';
  return String(source?.displayName || source?.sourceType || 'Revenue').trim();
};

const client = await pool.connect();
let context: BrowserContext | null = null;
let sessionId = '';
let signInTokenId = '';
try {
  await client.query('BEGIN TRANSACTION READ ONLY');
  const inventory = await client.query(`
    SELECT c.owner_id, c.client_id, c.currency, c.reporting_time_zone, c.ga4_campaign_filter,
           g.import_start_date, g.property_id
    FROM campaigns c
    JOIN ga4_connections g ON g.campaign_id = c.id AND g.property_id = $2 AND g.is_active = true
    WHERE c.id = $1
    LIMIT 1
  `, [CAMPAIGN_ID, PROPERTY_ID]);
  exact(inventory.rowCount, 1, 'active campaign/property inventory');
  const record = inventory.rows[0];
  const expectedWindow = resolveGA4ImportToDateWindow(record.import_start_date, record.reporting_time_zone);
  assert(expectedWindow, 'Import-to-date window is unavailable');
  const [dailyInventory, revenueInventory, spendInventory, damageInventory, isolationInventory] = await Promise.all([
    client.query(`
      SELECT COUNT(*)::int AS rows, COUNT(DISTINCT date)::int AS unique_dates,
             MIN(date) AS min_date, MAX(date) AS max_date,
             COALESCE(SUM(sessions), 0)::int AS sessions,
             COALESCE(SUM(users), 0)::int AS users,
             COALESCE(SUM(conversions), 0)::int AS conversions,
             COALESCE(SUM(pageviews), 0)::int AS pageviews,
             COALESCE(SUM(engaged_sessions), 0)::int AS engaged_sessions,
             COALESCE(SUM(revenue), 0)::numeric AS revenue,
             COUNT(*) FILTER (WHERE is_simulated)::int AS simulated_rows
      FROM ga4_daily_metrics
      WHERE campaign_id = $1 AND property_id = $2 AND date BETWEEN $3 AND $4
    `, [CAMPAIGN_ID, PROPERTY_ID, expectedWindow!.startDate, expectedWindow!.endDate]),
    client.query(`
      SELECT s.id, s.source_type, s.display_name, s.currency, s.platform_context,
             COUNT(r.id)::int AS record_count,
             COALESCE(SUM(r.revenue) FILTER (WHERE r.sub_campaign_urn IS NULL AND r.date BETWEEN '1900-01-01' AND $3), 0)::numeric AS aggregate_amount,
             COALESCE(SUM(r.revenue) FILTER (WHERE r.sub_campaign_urn IS NOT NULL AND r.date BETWEEN '1900-01-01' AND $3), 0)::numeric AS attributed_amount,
             COUNT(r.id) FILTER (WHERE r.sub_campaign_urn IS NULL AND r.date BETWEEN '1900-01-01' AND $3)::int AS aggregate_records,
             COUNT(r.id) FILTER (WHERE r.campaign_id <> s.campaign_id)::int AS cross_campaign_records,
             COUNT(r.id) FILTER (WHERE r.currency IS NOT NULL AND UPPER(r.currency) <> UPPER($2))::int AS wrong_currency_records
      FROM revenue_sources s
      LEFT JOIN revenue_records r ON r.revenue_source_id = s.id::text
      WHERE s.campaign_id = $1 AND s.is_active = true AND COALESCE(s.platform_context, 'ga4') = 'ga4'
      GROUP BY s.id, s.source_type, s.display_name, s.currency, s.platform_context
      ORDER BY s.id
    `, [CAMPAIGN_ID, String(record.currency || 'USD'), expectedWindow!.endDate]),
    client.query(`
      SELECT s.id, s.source_type, s.display_name, s.currency, s.platform_context,
             COUNT(r.id)::int AS record_count,
             COALESCE(SUM(r.spend) FILTER (WHERE r.date BETWEEN '1900-01-01' AND $3), 0)::numeric AS amount,
             COUNT(r.id) FILTER (WHERE r.campaign_id <> s.campaign_id)::int AS cross_campaign_records,
             COUNT(r.id) FILTER (WHERE r.currency IS NOT NULL AND UPPER(r.currency) <> UPPER($2))::int AS wrong_currency_records
      FROM spend_sources s
      LEFT JOIN spend_records r ON r.spend_source_id = s.id::text
      WHERE s.campaign_id = $1 AND s.is_active = true AND COALESCE(s.platform_context, 'ga4') = 'ga4'
      GROUP BY s.id, s.source_type, s.display_name, s.currency, s.platform_context
      ORDER BY s.id
    `, [CAMPAIGN_ID, String(record.currency || 'USD'), expectedWindow!.endDate]),
    client.query(`
      SELECT
        (SELECT COUNT(*) FROM revenue_records r LEFT JOIN revenue_sources s ON s.id::text = r.revenue_source_id
          WHERE r.campaign_id = $1 AND (s.id IS NULL OR s.campaign_id <> r.campaign_id))::int AS orphan_revenue_records,
        (SELECT COUNT(*) FROM spend_records r LEFT JOIN spend_sources s ON s.id::text = r.spend_source_id
          WHERE r.campaign_id = $1 AND (s.id IS NULL OR s.campaign_id <> r.campaign_id))::int AS orphan_spend_records,
        (SELECT COUNT(*) FROM (
          SELECT r.revenue_source_id, r.external_id FROM revenue_records r
          JOIN revenue_sources s ON s.id::text = r.revenue_source_id
          WHERE r.campaign_id = $1 AND s.campaign_id = $1 AND s.is_active = true
            AND COALESCE(s.platform_context, 'ga4') = 'ga4'
            AND r.external_id IS NOT NULL AND r.external_id <> ''
          GROUP BY r.revenue_source_id, r.external_id HAVING COUNT(*) > 1
        ) duplicates)::int AS duplicate_external_revenue_keys
    `, [CAMPAIGN_ID]),
    client.query(`
      SELECT c.id, g.property_id
      FROM campaigns c
      JOIN ga4_connections g ON g.campaign_id = c.id AND g.is_active = true
      WHERE c.owner_id IS DISTINCT FROM $1
      ORDER BY c.id
      LIMIT 1
    `, [record.owner_id]),
  ]);

  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json();
  exact(health?.commit, EXPECTED_SHA, 'deployed SHA');

  const browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  const page = await context.newPage();
  const tokenResponse = await clerkPost('/sign_in_tokens', { user_id: record.owner_id, expires_in_seconds: 900 });
  const tokenBody: any = await tokenResponse.json().catch(() => ({}));
  assert(tokenResponse.ok && tokenBody?.token, `Clerk sign-in token failed (${tokenResponse.status})`);
  signInTokenId = String(tokenBody.id || '');
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(tokenBody.token))}`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ''));

  const base = `/api/campaigns/${CAMPAIGN_ID}`;
  const paths = {
    daily: `${base}/ga4-daily?days=30&propertyId=${PROPERTY_ID}&readOnly=1`,
    native: `${base}/ga4-to-date?propertyId=${PROPERTY_ID}&insightsScope=1&readOnly=1`,
    breakdown: `${base}/ga4-breakdown?window=import-to-date&propertyId=${PROPERTY_ID}&overviewCampaignBreakdown=1&readOnly=1&debug=1`,
    landing: `${base}/ga4-landing-pages?window=import-to-date&propertyId=${PROPERTY_ID}&limit=50`,
    conversions: `${base}/ga4-conversion-events?window=import-to-date&propertyId=${PROPERTY_ID}&limit=50`,
    revenueTotal: `${base}/revenue-to-date`,
    revenueSources: `${base}/revenue-sources`,
    revenueBreakdown: `${base}/revenue-breakdown`,
    spendTotal: `${base}/spend-to-date?platformContext=ga4`,
    spendSources: `${base}/spend-sources?platformContext=ga4`,
    spendBreakdown: `${base}/spend-breakdown?platformContext=ga4`,
    hubspotPipeline: `/api/hubspot/${CAMPAIGN_ID}/pipeline-proxy?platformContext=ga4`,
    salesforcePipeline: `/api/salesforce/${CAMPAIGN_ID}/pipeline-proxy?platformContext=ga4`,
  };
  for (const path of [paths.daily, paths.breakdown, paths.landing, paths.conversions, paths.revenueTotal, paths.spendTotal]) {
    const response = await fetch(`${BASE_URL}${path}`, { redirect: 'manual' });
    exact(response.status, 401, `unauthenticated denial for ${path.split('?')[0]}`);
  }
  const entries = await Promise.all(Object.entries(paths).map(async ([name, path]) => [name, await api(page, path)] as const));
  const responses: Record<string, any> = Object.fromEntries(entries);
  for (const [name, response] of Object.entries(responses).filter(([name]) => !name.endsWith('Pipeline'))) {
    assert(response.ok && response.body?.success !== false, `${name} endpoint failed (${response.status})`);
  }
  exact(isolationInventory.rowCount, 1, 'cross-owner isolation fixture');
  const otherCampaign = isolationInventory.rows[0];
  for (const path of [
    `/api/campaigns/${otherCampaign.id}/ga4-daily?days=30&propertyId=${otherCampaign.property_id}&readOnly=1`,
    `/api/campaigns/${otherCampaign.id}/revenue-to-date`,
  ]) {
    const response = await api(page, path);
    assert(response.status === 403 || response.status === 404, `cross-owner request was not denied for ${path.split('?')[0]}`);
  }

  for (const name of ['breakdown', 'landing', 'conversions']) {
    exact(responses[name].body?.startDate, expectedWindow!.startDate, `${name} start date`);
    exact(responses[name].body?.endDate, expectedWindow!.endDate, `${name} end date`);
  }
  exact(responses.daily.body?.overviewStartDate, expectedWindow!.startDate, 'Summary start date');
  exact(responses.daily.body?.dataThroughDate, expectedWindow!.endDate, 'Summary end date');
  exact(responses.daily.body?.refreshIsStale, false, 'Summary freshness');

  const summary = responses.daily.body.overviewTotals;
  const persisted = dailyInventory.rows[0];
  exact(Number(persisted.rows), Number(persisted.unique_dates), 'duplicate persisted GA4 daily dates');
  exact(Number(persisted.simulated_rows), 0, 'simulated production daily rows');
  assert(String(persisted.min_date) >= expectedWindow!.startDate, 'persisted GA4 data predates the import boundary');
  assert(String(persisted.max_date) <= expectedWindow!.endDate, 'persisted GA4 data exceeds the latest completed day');
  for (const metric of ['sessions', 'users', 'conversions', 'pageviews'] as const) {
    exact(Number(persisted[metric]), Number(summary?.[metric]), `persisted/Summary ${metric}`);
  }
  exact(round2(persisted.revenue), round2(summary?.revenue), 'persisted/Summary revenue');
  exact(Number(persisted.engaged_sessions), Number(summary?.engagedSessions), 'persisted/Summary engaged sessions');
  const campaignRows = Array.isArray(responses.breakdown.body?.rows) ? responses.breakdown.body.rows : [];
  for (const metric of ['sessions', 'users', 'conversions'] as const) {
    exact(total(campaignRows, metric), Number(summary?.[metric]), `Campaign Breakdown/Summary ${metric} reconciliation`);
    exact(Number(responses.breakdown.body?.totals?.[metric]), Number(summary?.[metric]), `Campaign aggregate/Summary ${metric} reconciliation`);
  }
  exact(responses.breakdown.body?.meta?.overviewCampaignAttribution?.selected, true, 'Overview campaign attribution guard');

  const revenueSources = Array.isArray(responses.revenueSources.body?.sources) ? responses.revenueSources.body.sources : [];
  const revenueRows = Array.isArray(responses.revenueBreakdown.body?.sources) ? responses.revenueBreakdown.body.sources : [];
  const spendSources = Array.isArray(responses.spendSources.body?.sources) ? responses.spendSources.body.sources : [];
  const spendRows = Array.isArray(responses.spendBreakdown.body?.sources) ? responses.spendBreakdown.body.sources : [];
  const importedRevenue = round2(responses.revenueTotal.body?.totalRevenue);
  const nativeRevenue = round2(responses.native.body?.totals?.revenue);
  const financialConversions = Number(responses.native.body?.totals?.conversions || 0);
  const financialRevenue = round2(nativeRevenue + importedRevenue);
  exact(responses.breakdown.body?.revenueWindow?.source, 'ga4', 'Campaign Breakdown native revenue source');
  exact(responses.breakdown.body?.revenueWindow?.startDate, responses.native.body?.startDate, 'Campaign Breakdown native revenue start date');
  exact(responses.breakdown.body?.revenueWindow?.endDate, responses.native.body?.endDate, 'Campaign Breakdown native revenue end date');
  exact(total(campaignRows, 'revenue'), nativeRevenue, 'Campaign Breakdown/GA4 Revenue native reconciliation');
  exact(round2(responses.breakdown.body?.totals?.revenue), nativeRevenue, 'Campaign aggregate/GA4 Revenue native reconciliation');
  const financialSpend = round2(responses.spendBreakdown.body?.totalSpend ?? responses.spendTotal.body?.spendToDate);
  exact(total(revenueRows, 'revenue'), importedRevenue, 'Revenue breakdown/total reconciliation');
  exact(round2(responses.revenueBreakdown.body?.totalRevenue), importedRevenue, 'Revenue aggregate/total reconciliation');
  exact(total(spendRows, 'spend'), financialSpend, 'Spend breakdown/total reconciliation');
  exact(round2(responses.spendTotal.body?.spendToDate), financialSpend, 'Spend aggregate/total reconciliation');
  assert(revenueSources.every((source: any) => source?.isActive !== false), 'Revenue source response contains an inactive source');
  assert(spendSources.every((source: any) => source?.isActive !== false), 'Spend source response contains an inactive source');
  const revenueIds = new Set(revenueSources.map((source: any) => String(source?.id || source?.sourceId || '')));
  const spendIds = new Set(spendSources.map((source: any) => String(source?.id || source?.sourceId || '')));
  assert(revenueRows.every((row: any) => revenueIds.has(String(row?.sourceId || ''))), 'Revenue breakdown contains an unknown source');
  assert(spendRows.every((row: any) => spendIds.has(String(row?.sourceId || ''))), 'Spend breakdown contains an unknown source');
  exact(revenueInventory.rows.length, revenueSources.length, 'database/API revenue source count');
  exact(spendInventory.rows.length, spendSources.length, 'database/API spend source count');
  const revenueRowsById = new Map(revenueRows.map((row: any) => [String(row?.sourceId || ''), row]));
  for (const source of revenueInventory.rows) {
    const expected = round2(Number(source.aggregate_records) > 0 ? source.aggregate_amount : source.attributed_amount);
    exact(round2(revenueRowsById.get(String(source.id))?.revenue), expected, `database/API revenue source ${hash(source.id)}`);
  }
  const spendRowsById = new Map(spendRows.map((row: any) => [String(row?.sourceId || ''), row]));
  for (const source of spendInventory.rows) {
    exact(round2(spendRowsById.get(String(source.id))?.spend), round2(source.amount), `database/API spend source ${hash(source.id)}`);
  }
  const persistedImportedRevenue = round2(revenueInventory.rows.reduce((sum: number, source: any) =>
    sum + Number(Number(source.aggregate_records) > 0 ? source.aggregate_amount : source.attributed_amount), 0));
  exact(persistedImportedRevenue, importedRevenue, 'database/API imported revenue');
  exact(round2(spendInventory.rows.reduce((sum: number, source: any) => sum + Number(source.amount || 0), 0)), financialSpend, 'database/API imported spend');
  assert([...revenueInventory.rows, ...spendInventory.rows].every((source: any) =>
    Number(source.cross_campaign_records) === 0 && Number(source.wrong_currency_records) === 0 &&
    (!source.currency || String(source.currency).toUpperCase() === String(record.currency).toUpperCase())),
  'Active financial source integrity or currency mismatch');
  const damage = damageInventory.rows[0];
  exact(Number(damage.orphan_revenue_records), 0, 'orphan revenue records');
  exact(Number(damage.orphan_spend_records), 0, 'orphan spend records');
  exact(Number(damage.duplicate_external_revenue_keys), 0, 'duplicate external revenue keys');

  const campaignRowCounts = new Map<string, number>();
  const campaignNameByKey = new Map<string, string>();
  for (const row of campaignRows) {
    const key = normalizeGA4CampaignAllocationKey(row?.campaign);
    if (!key) continue;
    campaignRowCounts.set(key, (campaignRowCounts.get(key) || 0) + 1);
    if (!campaignNameByKey.has(key)) campaignNameByKey.set(key, String(row.campaign));
  }
  const matchedImportedRevenue = new Map<string, number>();
  for (const source of revenueSources) {
    let mapping: any = source?.mappingConfig || {};
    if (typeof mapping === 'string') try { mapping = JSON.parse(mapping); } catch { mapping = {}; }
    const campaignByValue = new Map<string, string>();
    for (const item of Array.isArray(mapping?.campaignMappings) ? mapping.campaignMappings : []) {
      const valueKey = normalizeGA4CampaignAllocationKey(item?.crmValue);
      const campaignName = String(item?.linkedinCampaignName || item?.linkedinCampaignUrn || '').trim();
      if (valueKey && campaignName) campaignByValue.set(valueKey, campaignName);
    }
    for (const item of Array.isArray(mapping?.campaignValueRevenueTotals) ? mapping.campaignValueRevenueTotals : []) {
      const valueKey = normalizeGA4CampaignAllocationKey(item?.campaignValue);
      const key = normalizeGA4CampaignAllocationKey(campaignByValue.get(valueKey) || item?.campaignValue);
      const amount = Number(item?.revenue || 0);
      if (campaignRowCounts.get(key) !== 1 || !Number.isFinite(amount) || amount <= 0) continue;
      const campaignName = campaignNameByKey.get(key)!;
      matchedImportedRevenue.set(campaignName, (matchedImportedRevenue.get(campaignName) || 0) + amount);
    }
  }
  exact(round2(Array.from(matchedImportedRevenue.values()).reduce((sum, amount) => sum + amount, 0)), importedRevenue, 'Campaign Breakdown mapped imported revenue reconciliation');
  exact(round2(total(campaignRows, 'revenue') + importedRevenue), financialRevenue, 'Campaign Breakdown displayed/Total Revenue reconciliation');

  const landingRows = Array.isArray(responses.landing.body?.rows) ? responses.landing.body.rows : [];
  exact(responses.landing.body?.meta?.sessionScopedAttributionAvailable, landingRows.length > 0, 'Landing attribution state');
  assert(landingRows.every((row: any) => String(row?.landingPage || '').trim()), 'Landing Pages contains an empty landing-page key');
  const conversionRows = Array.isArray(responses.conversions.body?.rows) ? responses.conversions.body.rows : [];
  assert(conversionRows.every((row: any) => Number(row?.conversions || 0) > 0), 'Conversion Events contains a zero-conversion row');
  exact(total(conversionRows, 'conversions'), Number(summary?.conversions), 'Conversion Events/Summary conversion reconciliation');

  await page.goto(`${BASE_URL}/campaigns/${CAMPAIGN_ID}/ga4-metrics?tab=overview`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.getByText('Campaign Breakdown', { exact: true }).waitFor({ timeout: 120000 });
  await page.getByText('purchase', { exact: true }).waitFor({ timeout: 120000 });
  if (landingRows.length === 0) {
    await page.getByText('GA4 did not provide session-scoped landing-page attribution for this campaign selection.', { exact: true }).waitFor({ timeout: 120000 });
  }

  const cardText = async (label: string) => {
    const card = page.getByText(label, { exact: true }).first().locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    await card.waitFor({ timeout: 120000 });
    return compact(await card.innerText());
  };
  const renderedCards: Record<string, string> = {};
  for (const label of ['Sessions', 'Users', 'Conversions', 'Engagement Rate', 'Conv. Rate', 'Total Revenue', 'Pipeline Proxy', 'Total Spend', 'Profit', 'ROAS', 'ROI', 'CPA']) {
    renderedCards[label] = await cardText(label);
  }

  const expectedDisplay = {
    Sessions: Number(summary.sessions).toLocaleString('en-US'),
    Users: Number(summary.users).toLocaleString('en-US'),
    Conversions: Number(summary.conversions).toLocaleString('en-US'),
    'Engagement Rate': `${((Number(summary.engagementRate) || 0) * 100).toFixed(1).replace(/\.0$/, '')}%`,
    'Conv. Rate': `${((Number(summary.conversions) / Number(summary.sessions)) * 100).toFixed(1).replace(/\.0$/, '')}%`,
    'Total Revenue': `$${financialRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    'Total Spend': `$${financialSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    Profit: `$${round2(financialRevenue - financialSpend).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ROAS: financialSpend > 0 ? `${(financialRevenue / financialSpend).toFixed(2)}x` : '—',
    ROI: financialSpend > 0 ? `${(((financialRevenue - financialSpend) / financialSpend) * 100).toFixed(1).replace(/\.0$/, '')}%` : '—',
    CPA: financialSpend > 0 && financialConversions > 0
      ? `$${round2(financialSpend / financialConversions).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—',
  };
  for (const [label, value] of Object.entries(expectedDisplay)) {
    for (let attempt = 0; attempt < 120 && !renderedCards[label].includes(value); attempt += 1) {
      await page.waitForTimeout(1000);
      renderedCards[label] = await cardText(label);
    }
    assert(renderedCards[label].includes(value), `${label} card does not contain ${value}: ${renderedCards[label]}`);
  }
  const nativeRevenueConfigured = Boolean(String(responses.native.body?.revenueMetric || '').trim()) || nativeRevenue !== 0;
  assert(renderedCards['Total Revenue'].includes(`Sources (${revenueRows.length + (nativeRevenueConfigured ? 1 : 0)})`), 'Total Revenue source count mismatch');
  assert(renderedCards['Total Spend'].includes(`Sources (${spendRows.length})`), 'Total Spend source count mismatch');
  if (!responses.hubspotPipeline.ok && !responses.salesforcePipeline.ok) {
    for (let attempt = 0; attempt < 120 && !renderedCards['Pipeline Proxy'].includes('Unavailable'); attempt += 1) {
      await page.waitForTimeout(1000);
      renderedCards['Pipeline Proxy'] = await cardText('Pipeline Proxy');
    }
    assert(renderedCards['Pipeline Proxy'].includes('Unavailable'), 'Pipeline Proxy did not fail closed as unavailable');
  }

  const renderedCampaignRows: Record<string, string[]> = {};
  for (const row of campaignRows) {
    const name = String(row?.campaign || '').trim();
    const rendered = page.locator('tr').filter({ hasText: name }).first();
    await rendered.waitFor({ timeout: 120000 });
    const cells = (await rendered.locator('td').allTextContents()).map((value) => value.trim());
    renderedCampaignRows[name] = cells;
    exact(cells[1], Number(row.sessions).toLocaleString('en-US'), `${name} rendered sessions`);
    exact(cells[2], Number(row.users).toLocaleString('en-US'), `${name} rendered users`);
    exact(cells[3], Number(row.conversions).toLocaleString('en-US'), `${name} rendered conversions`);
    const conversionRate = Number(row.sessions) > 0 ? (Number(row.conversions) / Number(row.sessions)) * 100 : 0;
    exact(cells[4], `${conversionRate.toFixed(1).replace(/\.0$/, '')}%`, `${name} rendered conversion rate`);
    const displayedRevenue = round2(Number(row.revenue) + Number(matchedImportedRevenue.get(name) || 0));
    exact(cells[5], `$${displayedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, `${name} rendered revenue`);
  }
  for (const row of conversionRows) {
    const rendered = page.locator('tr').filter({ hasText: String(row.eventName) }).first();
    const cells = (await rendered.locator('td').allTextContents()).map((value) => value.trim());
    exact(cells.slice(0, 4).join('|'), [row.eventName, row.conversions, row.eventCount, row.users].join('|'), `${row.eventName} rendered conversion row`);
  }

  const revenueCard = page.getByText('Total Revenue', { exact: true }).first().locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
  await revenueCard.getByText(/^Sources \(/).click();
  const revenueDialog = page.getByRole('dialog').filter({ hasText: 'Revenue Sources' });
  await revenueDialog.waitFor({ timeout: 30000 });
  const revenueDialogText = compact(await revenueDialog.innerText());
  const nativeRevenueDisplay = `$${nativeRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  assert(revenueDialogText.includes(nativeRevenueDisplay), `Revenue Sources modal is missing native ${nativeRevenueDisplay}`);
  for (const row of revenueRows) {
    const amount = `$${round2(row.revenue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const sourceText = revenueSourceDisplayLabel(row);
    const sourceEntry = revenueDialog.locator('div.rounded-md.border').filter({ hasText: sourceText }).filter({ hasText: amount });
    assert(await sourceEntry.count() > 0, `Revenue Sources modal is missing ${sourceText} ${amount}`);
  }
  await page.keyboard.press('Escape');

  const spendCard = page.getByText('Total Spend', { exact: true }).first().locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
  await spendCard.getByText(/^Sources \(/).click();
  const spendDialog = page.getByRole('dialog').filter({ hasText: 'Spend Sources' });
  await spendDialog.waitFor({ timeout: 30000 });
  const spendDialogText = compact(await spendDialog.innerText());
  for (const row of spendRows) {
    const amount = `$${round2(row.spend).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const sourceText = String(row.displayName || row.sourceType || '').trim();
    const sourceEntry = spendDialog.locator('div.rounded-md.border').filter({ hasText: sourceText }).filter({ hasText: amount });
    assert(await sourceEntry.count() > 0, `Spend Sources modal is missing ${sourceText} ${amount}`);
  }
  await page.keyboard.press('Escape');

  const bodyText = await page.locator('body').innerText();
  assert(!bodyText.includes('Some Overview data could not refresh'), 'Rendered Overview is using last-good data after a failed refresh');

  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Create Report', exact: true }).click();
  const reportDialog = page.getByRole('dialog').filter({ hasText: 'Report Type' });
  await reportDialog.locator('h4').filter({ hasText: /^Overview$/ }).click();
  const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
  await reportDialog.getByRole('button', { name: /Generate & Download Report/ }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  assert(stream, 'Overview report download stream is unavailable');
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const parser = new PDFParse({ data: Buffer.concat(chunks) });
  const reportText = compact((await parser.getText()).text);
  await parser.destroy();
  for (const expected of ['Performance Overview', 'Summary', 'Campaign Breakdown', 'Conversion Events',
    ...(landingRows.length > 0 ? ['Landing Pages'] : []),
    expectedDisplay.Sessions, expectedDisplay.Users, expectedDisplay.Conversions,
    financialRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    financialSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ...campaignRows.flatMap((row: any) => [
      String(row.campaign),
      round2(Number(row.revenue) + Number(matchedImportedRevenue.get(String(row.campaign)) || 0))
        .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ]), ...conversionRows.map((row: any) => String(row.eventName))]) {
    assert(reportText.includes(expected), `Downloaded Overview report is missing ${expected}`);
  }

  console.log(JSON.stringify({
    status: 'passed',
    certificationStatus: 'validation_output_only',
    deployedSha: health.commit,
    campaignHash: hash(CAMPAIGN_ID),
    clientHash: hash(record.client_id),
    ownerHash: hash(record.owner_id),
    propertyId: PROPERTY_ID,
    currency: record.currency,
    window: expectedWindow,
    summary,
    financials: {
      nativeWindow: { startDate: responses.native.body?.startDate, endDate: responses.native.body?.endDate },
      importedWindow: { startDate: responses.revenueTotal.body?.startDate, endDate: responses.revenueTotal.body?.endDate },
      nativeRevenue, importedRevenue, totalRevenue: financialRevenue, totalSpend: financialSpend,
      profit: round2(financialRevenue - financialSpend),
      roas: financialSpend > 0 ? round2(financialRevenue / financialSpend) : null,
      roiPercent: financialSpend > 0 ? round2(((financialRevenue - financialSpend) / financialSpend) * 100) : null,
      cpa: financialSpend > 0 && financialConversions > 0 ? round2(financialSpend / financialConversions) : null,
      financialConversions,
    },
    sourceInventory: {
      revenue: revenueSources.map((source: any) => ({ idHash: hash(source?.id || source?.sourceId), type: source?.sourceType, displayName: source?.displayName })),
      spend: spendSources.map((source: any) => ({ idHash: hash(source?.id || source?.sourceId), type: source?.sourceType, displayName: source?.displayName })),
    },
    persistedDailyIntegrity: persisted,
    productionDataIntegrity: damage,
    campaignRows: campaignRows.map((row: any) => ({
      campaign: row.campaign,
      sessions: row.sessions,
      users: row.users,
      conversions: row.conversions,
      nativeRevenue: round2(row.revenue),
      importedRevenue: round2(matchedImportedRevenue.get(String(row.campaign)) || 0),
      displayedRevenue: round2(Number(row.revenue) + Number(matchedImportedRevenue.get(String(row.campaign)) || 0)),
    })),
    landingRows,
    conversionRows,
    pipeline: {
      hubspot: { status: responses.hubspotPipeline.status, success: responses.hubspotPipeline.body?.success === true },
      salesforce: { status: responses.salesforcePipeline.status, success: responses.salesforcePipeline.body?.success === true },
    },
    renderedCards,
    renderedCampaignRows,
    modalParity: { revenue: true, spend: true },
    accessControl: { unauthenticated: 'denied', crossOwner: 'denied' },
    downloadedOverviewReport: { parsed: true, visibleValuesMatched: true },
    databaseTransaction: 'read only and rolled back',
  }, null, 2));
} finally {
  await client.query('ROLLBACK').catch(() => null);
  client.release();
  if (sessionId) await clerkPost(`/sessions/${encodeURIComponent(sessionId)}/revoke`).catch(() => null);
  else if (signInTokenId) await clerkPost(`/sign_in_tokens/${encodeURIComponent(signInTokenId)}/revoke`).catch(() => null);
  const browser = context?.browser();
  await context?.close().catch(() => null);
  await browser?.close().catch(() => null);
  await pool.end().catch(() => null);
}
