import { createHash } from 'node:crypto';
import { chromium, type BrowserContext, type Download, type Page } from 'playwright';
import { PDFParse } from 'pdf-parse';
import { pool } from '../server/db';
import { resolveGA4ImportToDateWindow } from '../server/utils/reporting-timezone';

const BASE_URL = process.env.GA4_AD_COMPARISON_BASE_URL || 'https://marketforensics.onrender.com';
const EXPECTED_SHA = String(process.env.GA4_AD_COMPARISON_EXPECTED_SHA || '').trim();
const CAMPAIGN_ID = String(process.env.GA4_AD_COMPARISON_CAMPAIGN_ID || '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458').trim();
const PROPERTY_ID = String(process.env.GA4_AD_COMPARISON_PROPERTY_ID || '542352127').trim();
const clerkSecret = String(process.env.CLERK_SECRET_KEY || '').trim();

if (!pool) throw new Error('DATABASE_URL is required');
if (!clerkSecret) throw new Error('CLERK_SECRET_KEY is required');
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error('GA4_AD_COMPARISON_EXPECTED_SHA must be a full Git SHA');

const hash = (value: unknown) => createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);
const parseFilter = (value: unknown): string[] => {
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
  } catch {
    // Legacy single-value filter.
  }
  return [raw];
};
const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
const formatPct = (value: number) => {
  const rounded = Math.round(Number(value || 0) * 10) / 10;
  return rounded === Math.floor(rounded) ? `${Math.round(rounded)}%` : `${rounded.toFixed(1)}%`;
};
const downloadBuffer = async (download: Download) => {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Downloaded Ad Comparison PDF stream is unavailable');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
};
const extractPdfText = async (data: Buffer) => {
  const parser = new PDFParse({ data: new Uint8Array(data) });
  try {
    return String((await parser.getText()).text || '').replace(/\s+/g, ' ').trim();
  } finally {
    await parser.destroy();
  }
};

const clerkPost = async (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${clerkSecret}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const api = async (page: Page, path: string) => page.evaluate(async (requestPath) => {
  const sessionToken = await (window as any).Clerk?.session?.getToken();
  if (!sessionToken) throw new Error('Clerk session token is unavailable');
  const response = await fetch(requestPath, {
    method: 'GET',
    credentials: 'include',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: response.ok, status: response.status, body };
}, path);

const client = await pool.connect();
let context: BrowserContext | null = null;
let sessionId = '';
let signInTokenId = '';
let secondaryContext: BrowserContext | null = null;
let secondarySessionId = '';
let secondarySignInTokenId = '';

try {
  await client.query('BEGIN TRANSACTION READ ONLY');
  const inventory = await client.query(`
    SELECT
      c.owner_id,
      c.currency,
      c.reporting_time_zone,
      c.ga4_campaign_filter,
      g.import_start_date,
      g.property_id
    FROM campaigns c
    JOIN ga4_connections g
      ON g.campaign_id = c.id
     AND g.property_id = $2
     AND g.is_active = true
    WHERE c.id = $1
    LIMIT 1
  `, [CAMPAIGN_ID, PROPERTY_ID]);
  if (inventory.rowCount !== 1) throw new Error('Exact active campaign/property inventory row was not found');
  const row = inventory.rows[0];
  const expectedWindow = resolveGA4ImportToDateWindow(row.import_start_date, row.reporting_time_zone);
  if (!expectedWindow) throw new Error('Saved import-to-date boundary is invalid');
  const expectedCampaigns = parseFilter(row.ga4_campaign_filter);
  if (expectedCampaigns.length === 0) throw new Error('Saved GA4 campaign filter is empty');

  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json();
  if (!healthResponse.ok || health?.commit !== EXPECTED_SHA) {
    throw new Error(`Deployed SHA mismatch: ${String(health?.commit || 'unavailable')}`);
  }

  const browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  const page = await context.newPage();
  const tokenResponse = await clerkPost('/sign_in_tokens', { user_id: row.owner_id, expires_in_seconds: 600 });
  const tokenBody: any = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenBody?.token) throw new Error(`Clerk sign-in token failed (${tokenResponse.status})`);
  signInTokenId = String(tokenBody.id || '');
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(tokenBody.token))}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ''));

  const endpointPath = `/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/ga4-breakdown?window=import-to-date&propertyId=${encodeURIComponent(PROPERTY_ID)}&debug=1`;
  const endpoint = await api(page, endpointPath);
  if (!endpoint.ok || endpoint.body?.success !== true) throw new Error(`Cumulative endpoint failed (${endpoint.status})`);
  if (endpoint.body?.window !== 'import-to-date') throw new Error('Endpoint did not confirm import-to-date mode');
  if (String(endpoint.body?.propertyId) !== PROPERTY_ID) throw new Error('Endpoint property mismatch');
  if (endpoint.body?.startDate !== expectedWindow.startDate || endpoint.body?.endDate !== expectedWindow.endDate) {
    throw new Error(`Endpoint boundary mismatch: ${endpoint.body?.startDate}..${endpoint.body?.endDate}`);
  }

  const rows = Array.isArray(endpoint.body?.rows) ? endpoint.body.rows : [];
  const expectedSet = new Set(expectedCampaigns.map(normalize));
  const unexpectedCampaigns = [...new Set(rows.map((item: any) => normalize(item?.campaign)).filter((item: string) => item && !expectedSet.has(item)))];
  if (unexpectedCampaigns.length > 0) throw new Error(`Endpoint returned campaigns outside saved scope: ${unexpectedCampaigns.join(', ')}`);
  const aggregates = new Map<string, { name: string; sessions: number; users: number; conversions: number; revenue: number }>();
  for (const item of rows) {
    const name = String(item?.campaign || '').trim();
    const nameKey = normalize(name);
    const current = aggregates.get(nameKey) || { name, sessions: 0, users: 0, conversions: 0, revenue: 0 };
    current.sessions += Number(item?.sessions || 0);
    current.users += Number(item?.users || 0);
    current.conversions += Number(item?.conversions || 0);
    current.revenue += Number(item?.revenue || 0);
    aggregates.set(nameKey, current);
  }

  const revenueSourcesPath = `/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/revenue-sources?platformContext=ga4`;
  const revenueBreakdownPath = `/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/revenue-breakdown?platformContext=ga4`;
  const [revenueSourcesResponse, revenueBreakdownResponse] = await Promise.all([
    api(page, revenueSourcesPath),
    api(page, revenueBreakdownPath),
  ]);
  if (!revenueSourcesResponse.ok || revenueSourcesResponse.body?.success !== true) {
    throw new Error(`Revenue sources endpoint failed (${revenueSourcesResponse.status})`);
  }
  if (!revenueBreakdownResponse.ok || revenueBreakdownResponse.body?.success !== true) {
    throw new Error(`Revenue breakdown endpoint failed (${revenueBreakdownResponse.status})`);
  }
  const revenueSources = (Array.isArray(revenueSourcesResponse.body?.sources) ? revenueSourcesResponse.body.sources : [])
    .filter((source: any) => source?.isActive !== false);
  const revenueBreakdownRows = Array.isArray(revenueBreakdownResponse.body?.sources) ? revenueBreakdownResponse.body.sources : [];
  const revenueBreakdownById = new Map(revenueBreakdownRows.map((source: any) => [String(source?.sourceId || ''), source]));
  const campaignCurrency = String(row.currency || '').trim().toUpperCase();
  let importedRevenueTotal = 0;
  for (const source of revenueSources) {
    const sourceId = String(source?.id || '');
    const breakdownSource: any = revenueBreakdownById.get(sourceId);
    const materializedRevenueStatus = String(source?.materializedRevenueStatus || '');
    if (materializedRevenueStatus === 'available') {
      const sourceAmount = Number(source?.lastTotalRevenue);
      const breakdownAmount = Number(breakdownSource?.revenue);
      if (!breakdownSource || !Number.isFinite(sourceAmount) || sourceAmount !== breakdownAmount) {
        throw new Error(`Revenue source ${hash(sourceId)} does not match its materialized breakdown`);
      }
      importedRevenueTotal += breakdownAmount;
      for (const currency of [source?.currency, breakdownSource?.currency]) {
        if (currency && String(currency).trim().toUpperCase() !== campaignCurrency) throw new Error(`Revenue source ${hash(sourceId)} currency does not match campaign currency`);
      }
    } else if (materializedRevenueStatus !== 'unavailable' || breakdownSource || source?.lastTotalRevenue !== null) {
      throw new Error(`Revenue source ${hash(sourceId)} has an invalid materialization state`);
    }
  }

  await page.goto(`${BASE_URL}/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/ga4-metrics?tab=campaigns`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.getByRole('heading', { name: 'Ad Comparison', exact: true }).waitFor({ timeout: 120000 });
  await page.getByText(`Compare GA4 campaigns from the initial import (${expectedWindow.startDate}) through the latest completed day (${expectedWindow.endDate})`, { exact: true }).waitFor({ timeout: 120000 });
  const comparisonRows = [...aggregates.values()].map((value) => ({
    ...value,
    revenue: Number(value.revenue.toFixed(2)),
    conversionRate: value.sessions > 0 ? (value.conversions / value.sessions) * 100 : 0,
  }));
  const formatMoney = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: campaignCurrency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(value || 0));
  const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(Number(value || 0));
  const metricOptions = [
    { value: 'sessions', label: 'Sessions' },
    { value: 'users', label: 'Users' },
    { value: 'conversions', label: 'Conversions' },
    { value: 'revenue', label: 'Revenue' },
    { value: 'conversionRate', label: 'Conversion Rate' },
  ];
  const adHeading = page.getByRole('heading', { name: 'Ad Comparison', exact: true });
  const metricSelect = adHeading.locator('xpath=../..').getByRole('combobox');
  if (await metricSelect.count() !== 1) throw new Error('Ad Comparison metric selector is not uniquely scoped');
  const uiBreakdownPattern = `**/api/campaigns/${CAMPAIGN_ID}/ga4-breakdown?window=import-to-date&propertyId=${PROPERTY_ID}`;
  const routeBreakdown = async (route: any, routedRows: any[]) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      propertyId: PROPERTY_ID,
      window: 'import-to-date',
      ...expectedWindow,
      totals: { sessions: 0, sessionsRaw: 0, users: 0, conversions: 0, revenue: 0, engagedSessions: 0, engagementRate: 0 },
      rows: routedRows,
    }),
  });
  await page.route(uiBreakdownPattern, async (route) => routeBreakdown(route, []));
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await page.getByRole('tab', { name: 'Ad Comparison', exact: true }).click();
  await page.getByText('No campaign data available. Ensure your GA4 property has UTM campaign tracking configured.', { exact: true })
    .waitFor({ timeout: 120000 });
  await page.unroute(uiBreakdownPattern);

  await page.route(uiBreakdownPattern, async (route) => routeBreakdown(route, [{
    campaign: expectedCampaigns[0], sessions: 0, users: 0, conversions: 0, revenue: 0, engagedSessions: 0,
  }, {
    campaign: expectedCampaigns[0].toLocaleUpperCase('en-US'), sessions: 0, users: 0, conversions: 0, revenue: 0, engagedSessions: 0,
  }]));
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await page.getByRole('tab', { name: 'Ad Comparison', exact: true }).click();
  await page.getByText('Top Campaigns by Sessions', { exact: true }).waitFor({ timeout: 120000 });
  const zeroSessionsCard = page.getByText('Total Sessions', { exact: true }).locator('xpath=..');
  if (!(await zeroSessionsCard.innerText()).includes('0')) throw new Error('Valid zero Sessions summary did not render as zero');
  const zeroCampaignsCard = page.getByText('Campaigns Compared', { exact: true }).locator('xpath=..');
  if (!(await zeroCampaignsCard.innerText()).includes('1')) throw new Error('Valid zero campaign was not counted');
  await page.unroute(uiBreakdownPattern);
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await page.getByRole('tab', { name: 'Ad Comparison', exact: true }).click();
  await page.getByText(`Compare GA4 campaigns from the initial import (${expectedWindow.startDate}) through the latest completed day (${expectedWindow.endDate})`, { exact: true })
    .waitFor({ timeout: 120000 });

  for (const metric of metricOptions) {
    await metricSelect.click();
    await page.getByRole('option', { name: `${metric.label} (High to Low)`, exact: true }).click();
    const title = `Top Campaigns by ${metric.label}`;
    const titleLocator = page.getByText(title, { exact: true });
    await titleLocator.waitFor({ timeout: 30000 });
    await page.getByText(`Up to 10 campaigns sorted by ${metric.label}`, { exact: true }).waitFor({ timeout: 30000 });
    const sortedRows = [...comparisonRows].sort((a: any, b: any) =>
      (Number(b?.[metric.value] || 0) - Number(a?.[metric.value] || 0))
      || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
      || a.name.localeCompare(b.name, 'en', { sensitivity: 'variant' }));
    const chartRows = sortedRows.slice(0, 10);
    const chartCard = titleLocator.locator('xpath=../..');
    await page.waitForTimeout(500);
    const axisLabels = (await chartCard.locator('.recharts-yAxis .recharts-cartesian-axis-tick-value').allTextContents())
      .map((value) => value.trim()).filter(Boolean);
    const expectedLabels = chartRows.map((value) => value.name.length > 30 ? `${value.name.slice(0, 28)}...` : value.name);
    if (JSON.stringify(axisLabels) !== JSON.stringify(expectedLabels)) {
      throw new Error(`${metric.label} chart order/top-10 labels do not match API aggregation: expected ${JSON.stringify(expectedLabels)}, received ${JSON.stringify(axisLabels)}`);
    }
    const bars = chartCard.locator('.recharts-bar-rectangle');
    if (await bars.count() !== chartRows.length) throw new Error(`${metric.label} chart bar count does not match top-10 API aggregation`);
    for (let index = 0; index < chartRows.length; index += 1) {
      const chartValue = Number((chartRows[index] as any)?.[metric.value] || 0);
      if (chartValue <= 0) continue;
      await bars.nth(index).hover({ force: true });
      const tooltipText = await chartCard.locator('.recharts-tooltip-wrapper').innerText();
      const formattedValue = metric.value === 'revenue'
        ? formatMoney(chartValue)
        : metric.value === 'conversionRate' ? formatPct(chartValue) : formatNumber(chartValue);
      if (!tooltipText.includes(chartRows[index].name) || !tooltipText.includes(formattedValue)) {
        throw new Error(`${metric.label} chart tooltip label/value does not match API aggregation`);
      }
    }
    const totalMetric = metric.value === 'conversionRate'
      ? (() => {
          const totalSessions = sortedRows.reduce((sum, value) => sum + value.sessions, 0);
          const totalConversions = sortedRows.reduce((sum, value) => sum + value.conversions, 0);
          return totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;
        })()
      : sortedRows.reduce((sum: number, value: any) => sum + Number(value?.[metric.value] || 0), 0);
    const summaryLabel = metric.value === 'revenue'
      ? 'GA4 Revenue (Imported to Date)'
      : metric.value === 'conversionRate' ? 'Overall Conversion Rate' : `Total ${metric.label}`;
    const formattedTotal = metric.value === 'revenue'
      ? formatMoney(totalMetric)
      : metric.value === 'conversionRate' ? formatPct(totalMetric) : formatNumber(totalMetric);
    const summaryText = await page.getByText(summaryLabel, { exact: true }).locator('xpath=..').innerText();
    if (!summaryText.includes(formattedTotal)) throw new Error(`${metric.label} summary total does not match API aggregation`);
    if (metric.value === 'revenue' && importedRevenueTotal !== 0) {
      const combinedRevenue = formatMoney(totalMetric + importedRevenueTotal);
      if (combinedRevenue !== formattedTotal && summaryText.includes(combinedRevenue)) {
        throw new Error('Imported revenue leaked into the native GA4 Revenue summary');
      }
    }
  }
  const campaignsComparedText = await page.getByText('Campaigns Compared', { exact: true }).locator('xpath=..').innerText();
  if (!campaignsComparedText.includes(String(comparisonRows.length))) throw new Error('Campaigns Compared does not match the de-duplicated API aggregation');

  const unauthenticatedResponse = await fetch(`${BASE_URL}${endpointPath}`);
  if (unauthenticatedResponse.status !== 401) throw new Error(`Unauthenticated breakdown request returned ${unauthenticatedResponse.status}, expected 401`);
  const missingProperty = await api(page, `/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/ga4-breakdown?window=import-to-date`);
  if (missingProperty.status !== 400) throw new Error(`Missing property request returned ${missingProperty.status}, expected 400`);
  const wrongProperty = await api(page, `/api/campaigns/${encodeURIComponent(CAMPAIGN_ID)}/ga4-breakdown?window=import-to-date&propertyId=__scope_probe__`);
  if (wrongProperty.status !== 404) throw new Error(`Unsaved property request returned ${wrongProperty.status}, expected 404`);

  const otherOwner = await client.query('SELECT owner_id FROM campaigns WHERE owner_id <> $1 LIMIT 1', [row.owner_id]);
  if (otherOwner.rowCount !== 1) throw new Error('A second owner is required for deployed ownership-isolation validation');
  const secondaryTokenResponse = await clerkPost('/sign_in_tokens', { user_id: otherOwner.rows[0].owner_id, expires_in_seconds: 600 });
  const secondaryTokenBody: any = await secondaryTokenResponse.json().catch(() => ({}));
  if (!secondaryTokenResponse.ok || !secondaryTokenBody?.token) throw new Error(`Secondary Clerk sign-in token failed (${secondaryTokenResponse.status})`);
  secondarySignInTokenId = String(secondaryTokenBody.id || '');
  secondaryContext = await browser.newContext();
  const secondaryPage = await secondaryContext.newPage();
  await secondaryPage.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(secondaryTokenBody.token))}`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await secondaryPage.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60000 });
  secondarySessionId = await secondaryPage.evaluate(() => String((window as any).Clerk?.session?.id || ''));
  const crossOwner = await api(secondaryPage, endpointPath);
  if (crossOwner.status !== 404) throw new Error(`Cross-owner breakdown request returned ${crossOwner.status}, expected 404`);

  await page.route(uiBreakdownPattern, async (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, error: 'certification failure probe' }),
  }));
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await page.getByRole('tab', { name: 'Ad Comparison', exact: true }).click();
  await page.getByText('Showing the last verified campaign breakdown. The latest refresh failed.', { exact: true })
    .waitFor({ timeout: 120000 });
  await page.getByText('Top Campaigns by Conversion Rate', { exact: true }).waitFor({ timeout: 30000 });
  await page.unroute(uiBreakdownPattern);
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await page.getByRole('tab', { name: 'Ad Comparison', exact: true }).click();
  await page.getByText('Showing the last verified campaign breakdown. The latest refresh failed.', { exact: true })
    .waitFor({ state: 'hidden', timeout: 120000 });

  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Create Report', exact: true }).click();
  const reportDialog = page.getByRole('dialog').filter({ hasText: 'Report Type' });
  await reportDialog.locator('h4').filter({ hasText: /^Ad Comparison$/ }).click();
  const pdfDownloadPromise = page.waitForEvent('download', { timeout: 120000 });
  await reportDialog.getByRole('button', { name: /Generate & Download Report/ }).click();
  const reportText = await extractPdfText(await downloadBuffer(await pdfDownloadPromise));
  const normalizedReportText = reportText.toLocaleLowerCase('en-US');
  const pdfTotalSessions = comparisonRows.reduce((sum, value) => sum + value.sessions, 0);
  const pdfTotalConversions = comparisonRows.reduce((sum, value) => sum + value.conversions, 0);
  const pdfConversionRate = pdfTotalSessions > 0 ? (pdfTotalConversions / pdfTotalSessions) * 100 : 0;
  for (const expected of [
    'Top Campaigns by Conversion Rate',
    'Overall Conversion Rate',
    formatPct(pdfConversionRate),
    'Campaigns Compared',
    String(comparisonRows.length),
    ...[...comparisonRows]
      .sort((a, b) => (b.conversionRate - a.conversionRate)
        || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
        || a.name.localeCompare(b.name, 'en', { sensitivity: 'variant' }))
      .slice(0, 10)
      .map((value) => value.name),
  ]) {
    if (!normalizedReportText.includes(expected.toLocaleLowerCase('en-US'))) throw new Error(`Downloaded Ad Comparison PDF is missing chart/summary value: ${expected}`);
  }

  console.log(JSON.stringify({
    status: 'passed',
    deployedSha: health.commit,
    campaignHash: hash(CAMPAIGN_ID),
    ownerHash: hash(row.owner_id),
    propertyId: PROPERTY_ID,
    reportingTimeZone: expectedWindow.reportingTimeZone,
    startDate: expectedWindow.startDate,
    endDate: expectedWindow.endDate,
    days: expectedWindow.days,
    savedCampaigns: expectedCampaigns,
    providerRowCount: rows.length,
    returnedCampaigns: comparisonRows.map((value) => value.name),
    savedCampaignsWithoutProviderRows: expectedCampaigns.filter((name) => !aggregates.has(normalize(name))),
    aggregates: Object.fromEntries([...aggregates.values()].map((value) => [value.name, {
      sessions: value.sessions,
      users: value.users,
      conversions: value.conversions,
      revenue: Number(value.revenue.toFixed(2)),
    }])),
    sourceInventory: revenueSources.map((source: any) => ({
      sourceHash: hash(source?.id),
      sourceType: String(source?.sourceType || ''),
      materializedRevenueStatus: String(source?.materializedRevenueStatus || ''),
      revenue: source?.lastTotalRevenue === null ? null : Number(source?.lastTotalRevenue),
      currency: String(source?.currency || campaignCurrency),
    })),
    importedRevenueExcludedFromNativeRanking: true,
    pdfParity: 'selected Conversion Rate title, top-10 campaign labels, weighted summary total, and Campaigns Compared rendered',
    selectorOptionsValidated: metricOptions.map((metric) => `${metric.label} (High to Low)`),
    uiParity: 'empty, valid-zero, chart title, subtitle, descending top-10 labels, selected-metric total, Campaigns Compared, and cached last-good failure state rendered',
    ownershipIsolation: 'unauthenticated 401, cross-owner 404, missing property 400, unsaved property 404',
    databaseTransaction: 'read only and rolled back',
  }, null, 2));
} finally {
  await client.query('ROLLBACK').catch(() => null);
  client.release();
  if (secondarySessionId) await clerkPost(`/sessions/${encodeURIComponent(secondarySessionId)}/revoke`).catch(() => null);
  else if (secondarySignInTokenId) await clerkPost(`/sign_in_tokens/${encodeURIComponent(secondarySignInTokenId)}/revoke`).catch(() => null);
  if (sessionId) await clerkPost(`/sessions/${encodeURIComponent(sessionId)}/revoke`).catch(() => null);
  else if (signInTokenId) await clerkPost(`/sign_in_tokens/${encodeURIComponent(signInTokenId)}/revoke`).catch(() => null);
  const browser = context?.browser();
  await secondaryContext?.close().catch(() => null);
  await context?.close().catch(() => null);
  await browser?.close().catch(() => null);
  await pool.end().catch(() => null);
}
