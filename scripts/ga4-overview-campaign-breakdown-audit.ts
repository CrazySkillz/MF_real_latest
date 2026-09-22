import { createHash } from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { pool } from '../server/db';
import { resolveGA4ImportToDateWindow } from '../server/utils/reporting-timezone';
import { resolveExactGA4CampaignBreakdownRevenue } from '../shared/ga4-campaign-breakdown';
import { normalizeGA4CampaignAllocationKey } from '../shared/ga4-financial-source';

const BASE_URL = process.env.GA4_OVERVIEW_BASE_URL || 'https://marketforensics.onrender.com';
const EXPECTED_SHA = String(process.env.GA4_OVERVIEW_EXPECTED_SHA || '').trim();
const CAMPAIGN_ID = String(process.env.GA4_OVERVIEW_CAMPAIGN_ID || '8aa735ee-c02f-41e2-bb1f-7c3f43bb9458').trim();
const PROPERTY_ID = String(process.env.GA4_OVERVIEW_PROPERTY_ID || '542352127').trim();
const AUDIT_SCOPE = String(process.env.GA4_OVERVIEW_BREAKDOWN_AUDIT_SCOPE || 'complete').trim().toLowerCase();
const clerkSecret = String(process.env.CLERK_SECRET_KEY || '').trim();

if (!pool) throw new Error('DATABASE_URL is required');
if (!clerkSecret) throw new Error('CLERK_SECRET_KEY is required');
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error('GA4_OVERVIEW_EXPECTED_SHA must be a full Git SHA');
if (!['complete', 'ui'].includes(AUDIT_SCOPE)) throw new Error('GA4_OVERVIEW_BREAKDOWN_AUDIT_SCOPE must be complete or ui');
const uiOnly = AUDIT_SCOPE === 'ui';

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};
const exact = (actual: unknown, expected: unknown, label: string) => {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
};
const hash = (value: unknown) => createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);
const round2 = (value: unknown) => Number((Number(value) || 0).toFixed(2));
const sum = (rows: any[], key: string) => rows.reduce((total, row) => total + (Number(row?.[key]) || 0), 0);
const compact = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim();
const normalizePropertyId = (value: unknown) => String(value || '').trim().replace(/^properties\//, '');
const parseCampaignFilter = (value: unknown) => {
  const text = String(value || '').trim();
  if (!text) return [] as string[];
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    } catch {}
  }
  return [text];
};
const formatNumber = (value: unknown) => Number(value || 0).toLocaleString('en-US');
const formatPercent = (value: number) => `${value.toFixed(1).replace(/\.0$/, '')}%`;
const formatMoney = (value: unknown, currency: string) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value || 0));
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
const isOverviewBreakdownResponse = (response: any) => {
  const url = response.url();
  return url.includes(`/api/campaigns/${CAMPAIGN_ID}/ga4-breakdown?`) && url.includes('overviewCampaignBreakdown=1');
};

const client = await pool.connect();
let context: BrowserContext | null = null;
let sessionId = '';
let signInTokenId = '';
try {
  await client.query('BEGIN TRANSACTION READ ONLY');
  const inventory = await client.query(`
    SELECT c.owner_id, c.client_id, c.currency, c.reporting_time_zone, c.ga4_campaign_filter,
           c.start_date, c.created_at, g.import_start_date, g.property_id
    FROM campaigns c
    JOIN ga4_connections g ON g.campaign_id = c.id AND g.property_id = $2 AND g.is_active = true
    WHERE c.id = $1
    LIMIT 1
  `, [CAMPAIGN_ID, PROPERTY_ID]);
  exact(inventory.rowCount, 1, 'active campaign/property inventory');
  const record = inventory.rows[0];
  const currency = String(record.currency || '').trim().toUpperCase();
  assert(/^[A-Z]{3}$/.test(currency), 'Campaign currency is unavailable');
  const selectedCampaigns = parseCampaignFilter(record.ga4_campaign_filter);
  assert(selectedCampaigns.length > 0, 'Saved GA4 campaign scope is empty');
  const selectedKeys = selectedCampaigns.map(normalizeGA4CampaignAllocationKey);
  assert(selectedKeys.every(Boolean), 'Saved GA4 campaign scope contains an empty normalized key');
  exact(new Set(selectedKeys).size, selectedKeys.length, 'duplicate normalized saved GA4 campaign scope');
  const expectedTrafficWindow = resolveGA4ImportToDateWindow(record.import_start_date, record.reporting_time_zone);
  assert(expectedTrafficWindow, 'Initial-import window is unavailable');
  const expectedNativeStart = record.start_date
    ? new Date(record.start_date).toISOString().slice(0, 10)
    : String(record.import_start_date || '').trim() || new Date(record.created_at).toISOString().slice(0, 10);

  const [isolationInventory, revenueIntegrity, scheduledSnapshotInventory] = await Promise.all([
    client.query(`
      SELECT c.id, g.property_id
      FROM campaigns c
      JOIN ga4_connections g ON g.campaign_id = c.id AND g.is_active = true
      WHERE c.owner_id IS DISTINCT FROM $1
      ORDER BY c.id
      LIMIT 1
    `, [record.owner_id]),
    client.query(`
      SELECT
        COUNT(r.id) FILTER (WHERE r.campaign_id <> s.campaign_id)::int AS cross_campaign_records,
        COUNT(r.id) FILTER (WHERE r.currency IS NOT NULL AND UPPER(r.currency) <> UPPER($2))::int AS wrong_currency_records,
        (SELECT COUNT(*) FROM revenue_records rr LEFT JOIN revenue_sources rs ON rs.id::text = rr.revenue_source_id
          WHERE rr.campaign_id = $1 AND (rs.id IS NULL OR rs.campaign_id <> rr.campaign_id))::int AS orphan_records,
        (SELECT COUNT(*) FROM (
          SELECT rr.revenue_source_id, rr.external_id FROM revenue_records rr
          JOIN revenue_sources rs ON rs.id::text = rr.revenue_source_id
          WHERE rr.campaign_id = $1 AND rs.campaign_id = $1 AND rs.is_active = true
            AND COALESCE(rs.platform_context, 'ga4') = 'ga4'
            AND rr.external_id IS NOT NULL AND rr.external_id <> ''
          GROUP BY rr.revenue_source_id, rr.external_id HAVING COUNT(*) > 1
        ) duplicates)::int AS duplicate_external_keys
      FROM revenue_sources s
      LEFT JOIN revenue_records r ON r.revenue_source_id = s.id::text
      WHERE s.campaign_id = $1 AND s.is_active = true AND COALESCE(s.platform_context, 'ga4') = 'ga4'
    `, [CAMPAIGN_ID, currency]),
    client.query(`
      SELECT r.id AS report_id, s.id AS snapshot_id, s.generated_at
      FROM linkedin_reports r
      JOIN LATERAL (
        SELECT id, generated_at
        FROM report_snapshots
        WHERE report_id = r.id
        ORDER BY generated_at DESC
        LIMIT 1
      ) s ON true
      WHERE r.campaign_id = $1
        AND LOWER(r.platform_type) = 'google_analytics'
        AND LOWER(r.report_type) = 'overview'
        AND LOWER(r.status) = 'active'
      ORDER BY s.generated_at DESC
      LIMIT 1
    `, [CAMPAIGN_ID]),
  ]);

  const healthResponse = await fetch(`${BASE_URL}/api/health`);
  const health: any = await healthResponse.json();
  exact(health?.commit, EXPECTED_SHA, 'deployed SHA');

  const browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  const page = await context.newPage();
  await page.clock.install({ time: new Date() });
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
    native: `${base}/ga4-to-date?propertyId=${PROPERTY_ID}&readOnly=1`,
    breakdown: `${base}/ga4-breakdown?window=import-to-date&propertyId=${PROPERTY_ID}&overviewCampaignBreakdown=1&readOnly=1&debug=1&dimensionDiagnostics=1`,
    revenueTotal: `${base}/revenue-to-date`,
    revenueSources: `${base}/revenue-sources`,
    revenueBreakdown: `${base}/revenue-breakdown`,
  };
  const unauthenticated = await fetch(`${BASE_URL}${paths.breakdown}`, { redirect: 'manual' });
  exact(unauthenticated.status, 401, 'unauthenticated Campaign Breakdown denial');
  exact(isolationInventory.rowCount, 1, 'cross-owner isolation fixture');
  const otherCampaign = isolationInventory.rows[0];
  const crossOwner = await api(page,
    `/api/campaigns/${otherCampaign.id}/ga4-breakdown?window=import-to-date&propertyId=${encodeURIComponent(otherCampaign.property_id)}&overviewCampaignBreakdown=1&readOnly=1`,
  );
  assert(crossOwner.status === 403 || crossOwner.status === 404, 'Cross-owner Campaign Breakdown request was not denied');

  const entries = await Promise.all(Object.entries(paths).map(async ([name, path]) => [name, await api(page, path)] as const));
  const responses: Record<string, any> = Object.fromEntries(entries);
  for (const [name, response] of Object.entries(responses)) {
    assert(response.ok && response.body?.success !== false, `${name} endpoint failed (${response.status}): ${JSON.stringify(response.body)}`);
  }

  const rows = Array.isArray(responses.breakdown.body?.rows) ? responses.breakdown.body.rows : [];
  exact(normalizePropertyId(responses.breakdown.body?.propertyId), normalizePropertyId(PROPERTY_ID), 'Campaign Breakdown property');
  exact(responses.breakdown.body?.startDate, expectedTrafficWindow.startDate, 'traffic initial-import boundary');
  exact(responses.breakdown.body?.endDate, expectedTrafficWindow.endDate, 'traffic latest completed day');
  exact(responses.breakdown.body?.revenueWindow?.source, 'ga4', 'native row-revenue source');
  exact(responses.breakdown.body?.revenueWindow?.startDate, expectedNativeStart, 'native row-revenue campaign-start boundary');
  exact(responses.breakdown.body?.revenueWindow?.endDate, expectedTrafficWindow.endDate, 'native row-revenue latest completed day');
  exact(responses.native.body?.startDate, expectedNativeStart, 'GA4 Revenue campaign-start boundary');
  exact(responses.native.body?.endDate, expectedTrafficWindow.endDate, 'GA4 Revenue latest completed day');
  exact(String(responses.native.body?.currencyCode || '').toUpperCase(), currency, 'native GA4 currency');

  const rowKeys = rows.map((row: any) => normalizeGA4CampaignAllocationKey(row?.campaign));
  exact(rows.length, selectedCampaigns.length, 'Campaign Breakdown row count/saved scope count');
  exact(new Set(rowKeys).size, rowKeys.length, 'duplicate normalized Campaign Breakdown rows');
  exact([...rowKeys].sort().join('|'), [...selectedKeys].sort().join('|'), 'Campaign Breakdown exact saved campaign scope');
  for (const metric of ['sessions', 'users', 'conversions'] as const) {
    exact(sum(rows, metric), Number(responses.breakdown.body?.totals?.[metric] || 0), `row/${metric} aggregate reconciliation`);
  }
  const nativeRevenue = round2(responses.native.body?.totals?.revenue);
  exact(round2(sum(rows, 'revenue')), nativeRevenue, 'native row revenue/GA4 Revenue reconciliation');
  exact(round2(responses.breakdown.body?.totals?.revenue), nativeRevenue, 'native Campaign Breakdown total/GA4 Revenue reconciliation');

  const revenueSources = Array.isArray(responses.revenueSources.body?.sources) ? responses.revenueSources.body.sources : [];
  const revenueBreakdown = Array.isArray(responses.revenueBreakdown.body?.sources) ? responses.revenueBreakdown.body.sources : [];
  const definitionsById = new Map(revenueSources.map((source: any) => [String(source?.id || ''), source]));
  assert(revenueBreakdown.every((source: any) => definitionsById.has(String(source?.sourceId || ''))), 'Revenue breakdown contains an unknown source');
  const materializedById = new Map(revenueBreakdown.map((source: any) => [String(source?.sourceId || ''), source]));
  const resolutionSources = revenueSources.filter((source: any) => source?.isActive !== false).map((source: any) => {
    const materialized: any = materializedById.get(String(source?.id || ''));
    return {
      ...source,
      sourceId: String(source?.id || ''),
      revenue: materialized?.revenue ?? null,
      currency: materialized?.currency || source?.currency,
    };
  });
  const revenueResolution = resolveExactGA4CampaignBreakdownRevenue(
    rows.map((row: any) => ({ name: row?.campaign })), resolutionSources, currency,
  );
  exact(revenueResolution.ambiguous, false, 'exact imported-revenue mapping ambiguity');
  exact(revenueResolution.currencyMismatch, false, 'exact mapped imported-revenue currency');
  exact(revenueResolution.materializationMismatch, false, 'exact mapped imported-revenue materialization');
  const importedRevenue = round2(responses.revenueTotal.body?.totalRevenue);
  exact(round2(sum(revenueBreakdown, 'revenue')), importedRevenue, 'imported revenue breakdown/total reconciliation');
  exact(round2(revenueResolution.mappedRevenue + revenueResolution.unmatchedRevenue), importedRevenue, 'configured mapped+unmatched/imported total reconciliation');
  const displayedRevenue = round2(nativeRevenue + revenueResolution.mappedRevenue);
  const totalRevenue = round2(nativeRevenue + importedRevenue);
  if (revenueResolution.allImportedRevenueMapped) {
    exact(displayedRevenue, totalRevenue, 'fully mapped displayed rows/Total Revenue reconciliation');
  } else {
    assert(displayedRevenue !== totalRevenue, 'Partially mapped displayed rows must not imply Total Revenue reconciliation');
    exact(round2(totalRevenue - displayedRevenue), round2(revenueResolution.unmatchedRevenue), 'unmatched imported revenue exclusion');
  }

  const integrity = revenueIntegrity.rows[0];
  exact(Number(integrity.cross_campaign_records), 0, 'cross-campaign imported revenue records');
  exact(Number(integrity.wrong_currency_records), 0, 'wrong-currency imported revenue records');
  exact(Number(integrity.orphan_records), 0, 'orphan imported revenue records');
  exact(Number(integrity.duplicate_external_keys), 0, 'duplicate external imported-revenue keys');

  await page.goto(`${BASE_URL}/campaigns/${CAMPAIGN_ID}/ga4-metrics?tab=overview`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  const heading = page.getByText('Campaign Breakdown', { exact: true });
  await heading.waitFor({ timeout: 120000 });
  const section = heading.locator("xpath=ancestor::div[./div/h3[normalize-space()='Campaign Breakdown']][1]");
  const firstCampaign = String(rows[0]?.campaign || '');
  await section.locator('tbody tr').filter({ hasText: firstCampaign }).first().waitFor({ timeout: 120000 });
  assert(!(await section.innerText()).includes('Campaign breakdown is unavailable'), 'Rendered Campaign Breakdown is unavailable');
  const headers = (await section.locator('thead th').allTextContents()).map((value) => compact(value).replace('Conv.', 'Conv'));
  exact(headers.join('|'), ['Campaign', 'Sessions', 'Users', 'Conversions', 'Conv Rate', 'Revenue'].join('|'), 'rendered Campaign Breakdown columns');

  const renderedRows: Array<{ campaign: string; cells: string[] }> = [];
  for (const row of rows) {
    const campaignName = String(row?.campaign || '').trim();
    const rendered = section.locator('tbody tr').filter({ hasText: campaignName }).first();
    await rendered.waitFor({ timeout: 120000 });
    const cells = (await rendered.locator('td').allTextContents()).map(compact);
    exact(cells.length, 6, `${campaignName} rendered column count`);
    exact(cells[0], campaignName, `${campaignName} rendered campaign`);
    exact(cells[1], formatNumber(row.sessions), `${campaignName} rendered sessions`);
    exact(cells[2], formatNumber(row.users), `${campaignName} rendered users`);
    exact(cells[3], formatNumber(row.conversions), `${campaignName} rendered conversions`);
    const conversionRate = Number(row.sessions) > 0 ? (Number(row.conversions) / Number(row.sessions)) * 100 : 0;
    exact(cells[4], formatPercent(conversionRate), `${campaignName} rendered conversion rate`);
    const rowRevenue = round2(Number(row.revenue) + Number(revenueResolution.revenueByCampaign.get(campaignName) || 0));
    exact(cells[5], formatMoney(rowRevenue, currency), `${campaignName} rendered revenue`);
    renderedRows.push({ campaign: campaignName, cells });
  }

  const reloadResponse = page.waitForResponse(isOverviewBreakdownResponse, { timeout: 120000 });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  exact((await reloadResponse).status(), 200, 'page reload Campaign Breakdown refetch');
  await page.getByText('Campaign Breakdown', { exact: true }).waitFor({ timeout: 120000 });
  await page.locator('tr').filter({ hasText: firstCampaign }).first().waitFor({ timeout: 120000 });

  const focusResponse = page.waitForResponse(isOverviewBreakdownResponse, { timeout: 120000 });
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  exact((await focusResponse).status(), 200, 'focus/visibility Campaign Breakdown refetch');

  const automaticResponse = page.waitForResponse(isOverviewBreakdownResponse, { timeout: 120000 });
  await page.clock.fastForward(10 * 60 * 1000);
  exact((await automaticResponse).status(), 200, 'automatic-interval Campaign Breakdown refetch');

  let browserPdfVerified = false;
  let scheduledPdfVerified = false;
  let scheduledSnapshot: any = null;
  if (!uiOnly) {
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Create Report', exact: true }).click();
  const reportDialog = page.getByRole('dialog').filter({ hasText: 'Report Type' });
  await reportDialog.locator('h4').filter({ hasText: /^Overview$/ }).click();
  const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
  await reportDialog.getByRole('button', { name: /Generate & Download Report/ }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  assert(stream, 'Browser Overview PDF download stream is unavailable');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const parser = new PDFParse({ data: Buffer.concat(chunks) });
  const reportText = compact((await parser.getText()).text);
  await parser.destroy();
  for (const header of ['Campaign Breakdown', 'CAMPAIGN', 'SESSIONS', 'USERS', 'CONVERSIONS', 'CONV. RATE', 'REVENUE']) {
    assert(reportText.includes(header), `Browser PDF is missing Campaign Breakdown header ${header}`);
  }
  for (const row of rows) {
    const campaignName = String(row?.campaign || '').trim();
    const rowRevenue = round2(Number(row.revenue) + Number(revenueResolution.revenueByCampaign.get(campaignName) || 0));
    assert(reportText.includes(campaignName), `Browser PDF is missing campaign ${campaignName}`);
    assert(reportText.includes(rowRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
      `Browser PDF is missing ${campaignName} revenue`);
  }
  browserPdfVerified = true;

  exact(scheduledSnapshotInventory.rowCount, 1, 'existing GA4 Overview scheduled-PDF snapshot fixture');
  scheduledSnapshot = scheduledSnapshotInventory.rows[0];
  const authToken = await page.evaluate(() => (window as any).Clerk?.session?.getToken());
  assert(authToken, 'Clerk session token is unavailable for scheduled-PDF validation');
  const scheduledPdfResponse = await context.request.get(
    `${BASE_URL}/api/report-snapshots/${encodeURIComponent(String(scheduledSnapshot.snapshot_id))}/pdf`,
    { headers: { Authorization: `Bearer ${authToken}` } },
  );
  exact(scheduledPdfResponse.status(), 200, 'scheduled-PDF snapshot download status');
  assert(String(scheduledPdfResponse.headers()['content-type'] || '').includes('application/pdf'), 'scheduled-PDF response is not a PDF');
  const scheduledParser = new PDFParse({ data: await scheduledPdfResponse.body() });
  const scheduledReportText = compact((await scheduledParser.getText()).text);
  await scheduledParser.destroy();
  for (const header of ['Campaign Breakdown', 'CAMPAIGN', 'SESSIONS', 'USERS', 'CONVERSIONS', 'CONV. RATE', 'REVENUE']) {
    assert(scheduledReportText.includes(header), `Scheduled PDF is missing Campaign Breakdown header ${header}`);
  }
  for (const row of rows) {
    const campaignName = String(row?.campaign || '').trim();
    const rowRevenue = round2(Number(row.revenue) + Number(revenueResolution.revenueByCampaign.get(campaignName) || 0));
    assert(scheduledReportText.includes(campaignName), `Scheduled PDF is missing campaign ${campaignName}`);
    for (const value of [formatNumber(row.sessions), formatNumber(row.users), formatNumber(row.conversions), formatPercent(Number(row.sessions) > 0 ? (Number(row.conversions) / Number(row.sessions)) * 100 : 0)]) {
      assert(scheduledReportText.includes(value), `Scheduled PDF is missing ${campaignName} value ${value}`);
    }
    assert(scheduledReportText.includes(`${currency} ${rowRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
      `Scheduled PDF is missing ${campaignName} revenue`);
  }
  scheduledPdfVerified = true;
  }

  console.log(JSON.stringify({
    status: 'passed',
    certificationStatus: 'deployed_validation_only',
    auditScope: AUDIT_SCOPE,
    deployedSha: health.commit,
    campaignHash: hash(CAMPAIGN_ID),
    clientHash: hash(record.client_id),
    ownerHash: hash(record.owner_id),
    propertyId: PROPERTY_ID,
    currency,
    trafficWindow: expectedTrafficWindow,
    nativeRevenueWindow: { startDate: expectedNativeStart, endDate: expectedTrafficWindow.endDate },
    selectedCampaigns,
    nativeRevenue,
    importedRevenue: {
      total: importedRevenue,
      exactlyMappedToRows: round2(revenueResolution.mappedRevenue),
      unmatchedOutsideRows: round2(revenueResolution.unmatchedRevenue),
      allExactlyMapped: revenueResolution.allImportedRevenueMapped,
    },
    displayedRowRevenue: displayedRevenue,
    totalRevenue,
    rows: renderedRows,
    providerPagination: responses.breakdown.body?.meta?.rowCount,
    providerAttribution: responses.breakdown.body?.meta?.overviewCampaignAttribution,
    providerDimensionDiagnostics: responses.breakdown.body?.meta?.dimensionDiagnostics,
    refreshEvidence: { pageReload: '200', windowFocus: '200', automaticInterval: '200 after ten-minute clock advance' },
    consumerParity: {
      api: true,
      renderedUi: true,
      browserPdf: browserPdfVerified,
      scheduledPdf: scheduledPdfVerified,
      ...(scheduledSnapshot ? {
        scheduledSnapshotHash: hash(scheduledSnapshot.snapshot_id),
        scheduledSnapshotGeneratedAt: new Date(scheduledSnapshot.generated_at).toISOString(),
      } : {}),
    },
    accessControl: { unauthenticated: 'denied', crossOwner: 'denied' },
    productionDataIntegrity: {
      crossCampaignRecords: Number(integrity.cross_campaign_records),
      wrongCurrencyRecords: Number(integrity.wrong_currency_records),
      orphanRecords: Number(integrity.orphan_records),
      duplicateExternalKeys: Number(integrity.duplicate_external_keys),
    },
    databaseTransaction: 'read only and rolled back',
    excludedFromCertification: [
      'Summary', 'Landing Pages', 'Conversion Events', 'Reports as a section',
      'Revenue & Financials as a parent section', 'Google Ads',
      ...(uiOnly ? ['Browser and scheduled PDF parity for this fresh-campaign portability run'] : []),
    ],
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
