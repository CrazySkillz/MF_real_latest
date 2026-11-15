import express from 'express';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import evidence from './fixtures/ga4-native-values-real-2026-11-15.json';
import saved from './fixtures/ga4-downstream-saved-real-2026-11-15.json';
import { buildPerformanceSummaryAggregate } from './utils/performance-summary-aggregate';
import { summarizeGA4TrafficRows } from '../shared/ga4-traffic-window';

const mocks = vi.hoisted(() => ({ reads: {} as Record<string, any>, writes: vi.fn(() => { throw Error('Writes forbidden'); }) }));
vi.mock('./storage', () => ({ storage: new Proxy({}, { get: (_, key: string) => {
  if (key in mocks.reads) return mocks.reads[key];
  if (/^(get|list|find)/.test(key)) return async () => /Connections|Sources|Metrics|Snapshots|KPIs|Benchmarks|Reports/.test(key) ? [] : null;
  return mocks.writes;
} }) }));
vi.mock('./db', () => ({ db: { execute: async () => ({ rows: [] }) }, pool: null }));
vi.mock('@clerk/express', () => ({ getAuth: () => ({ userId: 'recorded-owner' }) }));
import { registerRoutes } from './routes-oauth';
import { buildPdfAttachmentForReport } from './report-scheduler';
import { PDFParse } from 'pdf-parse';
import { getCampaignMetricTotals } from './utils/campaign-current-values';
const { scope } = evidence, id = saved.campaign.id;
const nativeRevenue = Number(Number(evidence.reference.rows[0].metricValues[2].value).toFixed(2));
const nativeRate = Number(evidence.reference.rows[0].metricValues[3].value) * 100;
const originalFetch = globalThis.fetch;
let server: any, origin: string;
// Match the saved import's complete date coverage; GA4 omits zero-activity rows.
const rows = evidence.breakdown.meta.distinctUsers.daily.map(day => ({ date: day.date, sessions: 0, conversions: 0, revenue: 0,
  pageviews: 0, engagedSessions: 0, ...evidence.daily.find(row => row.date === day.date), users: day.users,
  campaignId: id, propertyId: scope.propertyId, isSimulated: false }));
const connection = { id: 'recorded-connection', campaignId: id, propertyId: scope.propertyId, isPrimary: true, isActive: true,
  method: 'access_token', accessToken: 'never-used', importStartDate: scope.startDate };
const sourceTotals = (kind: 'revenue' | 'spend', start: string, end: string) => {
  const sources = kind === 'revenue' ? saved.revenueSources : saved.spendSources;
  const records: any[] = kind === 'revenue' ? saved.revenueRecords : saved.spendRecords;
  return sources.map(source => ({ sourceId: source.id, currency: 'EUR', [kind]: records.filter(r => r[kind + 'SourceId'] === source.id
    && !r.subCampaignUrn && r.date >= start && r.date <= end).reduce((n, r) => n + Number(r[kind]), 0) }));
};
beforeAll(async () => {
  vi.stubEnv('GA4_INCLUDE_CURRENT_DAY', 'true');
  vi.useFakeTimers({ shouldAdvanceTime: true }); vi.setSystemTime(new Date('2026-11-15T18:10:00Z'));
  mocks.reads = {
    getCampaign: async () => structuredClone(saved.campaign), getGA4Connections: async () => [connection],
    getPrimaryGA4Connection: async () => connection, getGA4Connection: async () => connection,
    getGA4DailyMetrics: async (_id: string, _property: string, start: string, end: string) => rows.filter(r => r.date >= start && r.date <= end),
    getGA4OverviewSnapshot: async () => structuredClone(saved.snapshot), getGA4PublicationVersion: async () => 1,
    getLatestGA4DailyMetric: async () => ({ date: scope.endDate }),
    getLatestFinancialDailySnapshot: async () => structuredClone(saved.financial),
    getRevenueSources: async () => structuredClone(saved.revenueSources), getSpendSources: async () => structuredClone(saved.spendSources),
    getRevenueBreakdownBySource: async (_id: string, start: string, end: string) => sourceTotals('revenue', start, end),
    getSpendBreakdownBySource: async (_id: string, start: string, end: string) => sourceTotals('spend', start, end),
    getRevenueTotalForRange: async (_id: string, start: string, end: string) => ({ totalRevenue: sourceTotals('revenue', start, end).reduce((n, r: any) => n + r.revenue, 0), sourceIds: saved.revenueSources.map(s => s.id), currency: 'EUR' }),
    getSpendTotalForRange: async (_id: string, start: string, end: string) => ({ totalSpend: sourceTotals('spend', start, end).reduce((n, r: any) => n + r.spend, 0), sourceIds: saved.spendSources.map(s => s.id), currency: 'EUR' }),
  };
  const app = express(); server = await registerRoutes(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r)); origin = `http://127.0.0.1:${server.address().port}`;
  vi.stubGlobal('fetch', vi.fn((url: any, options: any) => {
    if (!String(url).startsWith(origin + '/') || options?.method && options.method !== 'GET') throw Error('External request forbidden');
    return originalFetch(url, options);
  }));
});
afterEach(() => { expect(mocks.writes).not.toHaveBeenCalled(); });
afterAll(async () => { await new Promise<void>(r => server?.close(r)); vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('matches all six affected Diagnostics and summary response values to real GA4', async () => {
  expect(await getCampaignMetricTotals(id, true, true, scope.endDate)).toMatchObject({ revenue: nativeRevenue + 3700, spend: 1100, ga4FinancialSource: 'persisted_overview', revenueAvailable: true, spendAvailable: true });
  for (const path of ['outcome-totals?dateRange=90days&persistedOnly=1', 'executive-summary']) {
    const response = await fetch(`${origin}/api/campaigns/${id}/${path}`); const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.performanceSummary.totals.revenue.value).toBe(nativeRevenue + 3700);
    expect(body.performanceSummary.totals.cvr.value).toBeCloseTo(nativeRate, 2);
    if (path.startsWith('outcome')) expect(body.ga4.revenue).toBe(nativeRevenue);
    else { expect(body.metrics.totalRevenue).toBe(nativeRevenue + 3700); expect(body.metrics.cvr).toBeCloseTo(nativeRate, 2); }
  }
});
it('prints the native GA4 rate in the actual financial-analysis PDF through the production reader', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  try {
    const pdf = await buildPdfAttachmentForReport({ report: { id: 'recorded-report', campaignId: id, platformType: 'campaign_deepdive',
      reportType: 'financial-analysis', configuration: { reportType: 'financial-analysis', selectedSections: ['financial-analysis:overview'], selectedMetrics: [] } },
      campaignName: 'Recorded Promo', windowStart: scope.startDate, windowEnd: scope.endDate });
    expect(pdf?.subarray(0, 5).toString()).toBe('%PDF-');
    const parser = new PDFParse({ data: pdf! });
    try { const { text } = await parser.getText(); expect(text).toMatch(/Conversion rate:\s+9\.6%/i); expect(text).toContain('118,014.62'); expect(text).not.toMatch(/Conversion rate:\s+9\.8%/i); }
    finally { await parser.destroy(); }
  } finally { vi.stubEnv('NODE_ENV', 'test'); }
});
it.each([undefined, null, -1, 101, '9.6'])('does not invent a GA4 rate for unavailable/invalid input %s', conversionRate => {
  const ga4 = { connected: true, available: true, sessions: 4472, conversions: 440 };
  const result = buildPerformanceSummaryAggregate({ campaignId: id, dateRange: '90days', ga4, webAnalytics: { ...ga4, provider: 'ga4', conversionRate } });
  expect(result.totals.cvr.available).toBe(false); expect(result.totals.cvr.value).toBeNull();
});
it('keeps native zero and non-GA4 count-based rates distinct', () => {
  for (const [provider, conversionRate, expected] of [['ga4', 0, 0], ['custom_integration', undefined, 10]] as const) {
    const result = buildPerformanceSummaryAggregate({ campaignId: id, dateRange: '90days', webAnalytics: { provider, connected: true, available: true, sessions: 100, conversions: 10, conversionRate } });
    expect(result.totals.cvr.value).toBe(expected);
  }
});
it('rejects damaged exact revenue without substituting a rounded daily sum', () => {
  const snapshot: any = structuredClone(saved.snapshot); delete snapshot.campaignBreakdown.totals.revenue;
  expect(() => summarizeGA4TrafficRows(evidence.daily, snapshot, scope.startDate, scope.endDate)).toThrow('GA4_PERIOD_REVENUE_UNVERIFIED');
});
