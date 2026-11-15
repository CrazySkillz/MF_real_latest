import { afterEach, describe, expect, it, vi } from 'vitest';
import evidence from './fixtures/ga4-native-values-real-2026-11-15.json';
import { ga4Service, GoogleAnalytics4Service } from './analytics';
import { checkGA4SourceNumbers } from './ga4-source-verification';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { getGA4PeriodTraffic, summarizeGA4TrafficRows } from '../shared/ga4-traffic-window';
import { resolveGA4KpiLiveValue } from '../shared/ga4-kpi-live-value';
import { formatGA4AdComparisonCardPct } from '../shared/ga4-ad-comparison-cards';

const { scope, breakdown, reference } = evidence;
const sourceNumbers = reference.rows[0].metricValues.map(row => Number(row.value));
it('prefills KPI creation with the same real GA4 rate, including zero and unavailable', () => {
  const page = readFileSync('client/src/pages/ga4-metrics.tsx', 'utf8');
  const body = page.slice(page.indexOf('  const calculateKPIValueFromSources ='), page.indexOf('  // Create KPI mutation'));
  const calculate = new Function(transformSync(body, { loader: 'ts' }).code + ';return calculateKPIValueFromSources;')();
  expect(calculate('Conversion Rate', { sessions: 4472, conversions: 440, conversionRate: sourceNumbers[3] * 100 })).toBe('9.59');
  expect(calculate('Conversion Rate', { sessions: 0, conversions: 0, conversionRate: 0 })).toBe('0.00');
  expect(calculate('Conversion Rate', { sessions: 4472, conversions: 440 })).toBe('Unavailable');
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('native GA4 revenue precision and session key-event rate — recorded real API data', () => {
  it('source verification detects a saved native rate that differs from the real provider response', async () => {
    vi.spyOn(GoogleAnalytics4Service.prototype, 'getTimeSeriesWithToken').mockResolvedValue(evidence.daily as any);
    vi.spyOn(GoogleAnalytics4Service.prototype, 'getAcquisitionBreakdown').mockResolvedValue(breakdown as any);
    vi.spyOn(GoogleAnalytics4Service.prototype, 'getLandingPagesReport').mockResolvedValue(evidence.landing as any);
    vi.spyOn(GoogleAnalytics4Service.prototype, 'getConversionEventsReport').mockResolvedValue({ rows: [] } as any);
    const saved = structuredClone(breakdown);
    const input = { campaignId: 'recorded', connection: { propertyId: scope.propertyId, accessToken: 'no-network' },
      publication: { campaignBreakdown: saved, landingPages: evidence.landing, conversionEvents: { rows: [] } },
      filter: scope.campaigns, startDate: scope.startDate, endDate: scope.endDate, currency: 'EUR' };
    let checks = await checkGA4SourceNumbers(input, evidence.daily);
    expect(checks).toContainEqual(expect.objectContaining({ code: 'SOURCE_SESSION_KEY_EVENT_RATE', status: 'passed' }));
    saved.meta.distinctUsers.sessionKeyEventRate = 440 / 4472;
    checks = await checkGA4SourceNumbers(input, evidence.daily);
    expect(checks).toContainEqual(expect.objectContaining({ code: 'SOURCE_SESSION_KEY_EVENT_RATE', status: 'difference' }));
  });
  it('rounds the provider revenue once, instead of rounding every daily contribution', () => {
    const report = evidence.requests.find(row => row.request.dimensions?.[0]?.name === 'date'
      && row.request.metrics.map(m => m.name).join(',') === 'sessions,totalUsers,conversions,totalRevenue,engagedSessions,sessionKeyEventRate'
      && row.request.dimensionFilter?.orGroup?.expressions?.[0]?.filter?.fieldName === 'pageLocation')!;
    expect(report).toBeDefined();
    const original = JSON.stringify(report.response);
    const totals = (ga4Service as any).mergeDailyConversionRevenueTotals(report.response, { rows: [] }, 2, 3, 0, 1);
    expect(totals.revenue).toBe(Number(sourceNumbers[2].toFixed(2)));
    expect(totals.revenue).toBe(114314.62);
    expect(report.response.rows.reduce((sum, row) => sum + Number(Number(row.metricValues[3].value).toFixed(2)), 0)).toBeCloseTo(114314.60, 8);
    expect(JSON.stringify(report.response)).toBe(original);
  });

  it('uses GA4 rates for the exact total and campaign periods, never conversion-count division', () => {
    const totals = summarizeGA4TrafficRows(evidence.daily, breakdown, scope.startDate, scope.endDate);
    expect(totals.conversionRate).toBe(sourceNumbers[3] * 100);
    expect(totals.conversionRate?.toFixed(1)).toBe('9.6');
    expect(totals.conversionRate).not.toBe(totals.conversions / totals.sessions * 100);
    for (const row of breakdown.meta.distinctUsers.campaigns) {
      expect(getGA4PeriodTraffic(breakdown, scope.startDate, scope.endDate, row.name)?.conversionRate).toBe(row.sessionKeyEventRate * 100);
    }
    expect(evidence.landing.rows[0].sessionKeyEventRate * 100).toBeCloseTo(10.343796711509716, 12);
    expect(resolveGA4KpiLiveValue({ kpi:{metric:'conversion_rate'}, breakdownTotals:totals,
      overviewEngagementRate:totals.engagementRate, financialRevenue:0, financialSpend:0, financialROI:0, financialCPA:0 })).toBe('9.59');
  });

  it.each([undefined, null, -0.1, 1.1, '0.1'])('does not invent a rate from legacy or invalid saved data (%s)', rate => {
    const saved:any = structuredClone(breakdown);
    saved.meta.distinctUsers.sessionKeyEventRate = rate;
    expect(getGA4PeriodTraffic(saved, scope.startDate, scope.endDate)?.conversionRate).toBeNull();
    expect(formatGA4AdComparisonCardPct(Number.NaN)).toBe('Unavailable');
  });

  it.each(['missing', 'negative', 'above-one'])('rejects %s rate data before publication', async damage => {
    vi.stubGlobal('fetch', vi.fn(async (_url, options:any) => {
      const request = JSON.parse(options.body);
      const recorded = evidence.requests.find(row => JSON.stringify(row.request) === JSON.stringify(request));
      if (!recorded) throw new Error('Unrecorded GA4 request');
      const response:any = structuredClone(recorded.response);
      if (!request.dimensions && response.rows?.length) {
        if (damage === 'missing') response.rows[0].metricValues.pop();
        else response.rows[0].metricValues[4].value = damage === 'negative' ? '-0.01' : '1.01';
      }
      return new Response(JSON.stringify(response), { status:200 });
    }));
    await expect(ga4Service.getDistinctUsersWithToken(scope.propertyId,'recorded-response-only',scope.startDate,scope.endDate,scope.campaigns,scope,true))
      .rejects.toThrow('GA4_PERIOD_SESSIONS_UNVERIFIED');
  });
});
