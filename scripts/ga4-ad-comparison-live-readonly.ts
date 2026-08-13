import { createHash } from 'node:crypto';
import { chromium, type BrowserContext, type Page } from 'playwright';
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
  const aggregates = new Map<string, { sessions: number; users: number; conversions: number; revenue: number }>();
  for (const item of rows) {
    const name = String(item?.campaign || '').trim();
    const current = aggregates.get(name) || { sessions: 0, users: 0, conversions: 0, revenue: 0 };
    current.sessions += Number(item?.sessions || 0);
    current.users += Number(item?.users || 0);
    current.conversions += Number(item?.conversions || 0);
    current.revenue += Number(item?.revenue || 0);
    aggregates.set(name, current);
  }
  for (const campaign of expectedCampaigns) {
    if (!aggregates.has(campaign)) throw new Error(`Saved campaign is absent from provider rows: ${campaign}`);
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
  const visibleText = await page.locator('body').innerText();
  for (const campaign of expectedCampaigns) {
    if (!visibleText.includes(campaign)) throw new Error(`Rendered table is missing campaign ${campaign}`);
  }
  if (!visibleText.includes('GA4 Revenue (imported to date)')) throw new Error('Rendered revenue boundary label is missing');
  for (const source of revenueSources) {
    const displayName = String(source?.displayName || source?.sourceType || '').trim();
    if (!displayName || !visibleText.includes(displayName)) {
      throw new Error(`Rendered Revenue Breakdown is missing source ${hash(source?.id)}`);
    }
  }
  if (revenueSources.some((source: any) => source?.materializedRevenueStatus === 'unavailable') && !visibleText.includes('Unavailable')) throw new Error('Rendered unavailable source state is missing');

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
    aggregates: Object.fromEntries([...aggregates.entries()].map(([name, value]) => [name, {
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
    uiParity: 'window labels, every saved campaign row, and every active imported source label rendered',
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
