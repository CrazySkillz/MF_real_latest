import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleAnalytics4Service, ga4Service } from './analytics';
import { selectGA4UnitsSoldCards } from '../shared/ga4-ad-comparison-cards';

const scope = { campaignId: 'saved-campaign', propertyId: '123', startDate: '2025-11-20', endDate: '2026-11-28', campaignNames: ['coffee_bags', 'served_here'] };
const response = () => ({ dimensionHeaders: [{ name: 'sessionCampaignName' }], metricHeaders: [{ name: 'itemsPurchased', type: 'TYPE_INTEGER' }], rowCount: 2,
  rows: [{ dimensionValues: [{ value: 'coffee_bags' }], metricValues: [{ value: '6' }] }, { dimensionValues: [{ value: 'served_here' }], metricValues: [{ value: '0' }] }] });
let data: any;
let requests: any[];
const collect = (service = ga4Service) => service.getCampaignUnitsSoldWithToken(scope.campaignId, scope.propertyId, 'fixture', scope.startDate, scope.endDate, scope.campaignNames);
const packet = () => ({ version: 1, metric: 'itemsPurchased', attribution: 'sessionCampaignName', ...scope, campaigns: [{ name: 'coffee_bags', units: 6 }, { name: 'served_here', units: 0 }] });
const savedReport = () => ({ propertyId: scope.propertyId, startDate: scope.startDate, endDate: scope.endDate, meta: { propertyId: scope.propertyId, unitsSold: packet() } });
beforeEach(() => {
  vi.stubEnv('DATABASE_URL', ''); data = response(); requests = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    expect(url).toBe('https://analyticsdata.googleapis.com/v1beta/properties/123:runReport');
    requests.push(JSON.parse(init.body)); return new Response(JSON.stringify(data));
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('verified GA4 item quantities', () => {
  it('queries actual quantities for the full imported dates and exact selected session campaigns', async () => {
    const result = await collect();
    expect(result?.campaigns).toEqual([{ name: 'coffee_bags', units: 6 }, { name: 'served_here', units: 0 }]);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ dateRanges: [{ startDate: scope.startDate, endDate: scope.endDate }],
      dimensions: [{ name: 'sessionCampaignName' }], metrics: [{ name: 'itemsPurchased' }], keepEmptyRows: true });
    expect(requests[0].dimensionFilter.orGroup.expressions.map((e: any) => e.filter)).toEqual(scope.campaignNames.map(value => ({
      fieldName: 'sessionCampaignName', stringFilter: { matchType: 'EXACT', value, caseSensitive: false },
    })));
    expect(selectGA4UnitsSoldCards({ ...savedReport(), meta: { propertyId: scope.propertyId, unitsSold: result } }, scope)).toEqual([
      { title: 'Highest Units Sold', units: 6, names: ['coffee_bags'] }, { title: 'Fewest Units Sold', units: 0, names: ['served_here'] },
    ]);
  });
  it.each(['sampling', 'thresholding', 'truncated', 'restricted', 'other-row', 'empty-reason'])('does not publish %s data', async kind => {
    data.metadata = { sampling: { samplingMetadatas: [{}] }, thresholding: { subjectToThresholding: true },
      truncated: { dataTruncationReasons: [{}] }, restricted: { schemaRestrictionResponse: { activeMetricRestrictions: [{}] } },
      'other-row': { dataLossFromOtherRow: true }, 'empty-reason': { emptyReason: 'unavailable' } }[kind];
    expect(await collect()).toBeUndefined();
  });
  it.each(['wrong metric', 'wrong dimension', 'missing', 'duplicate', 'outside', 'truncated', 'empty', 'null', 'blank', 'fraction', 'negative', 'overflow'])('rejects %s quantities without substituting zero', async kind => {
    if (kind === 'wrong metric') data.metricHeaders[0].name = 'eventCount';
    if (kind === 'wrong dimension') data.dimensionHeaders[0].name = 'campaignName';
    if (kind === 'missing') { data.rows.pop(); data.rowCount--; }
    if (kind === 'duplicate') data.rows[1].dimensionValues[0].value = 'coffee_bags';
    if (kind === 'outside') data.rows[1].dimensionValues[0].value = 'unselected';
    if (kind === 'truncated') data.rowCount++;
    if (kind === 'empty') { data.rows = []; data.rowCount = 0; }
    const invalid: Record<string, any> = { null: null, blank: '', fraction: '1.5', negative: '-1', overflow: '9007199254740992' };
    if (kind in invalid) data.rows[0].metricValues[0].value = invalid[kind];
    expect(await collect()).toBeUndefined();
  });
  it('keeps optional provider failures from failing publication but preserves job cancellation', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('incompatible metric', { status: 400 }));
    expect(await collect()).toBeUndefined();
    vi.mocked(fetch).mockRejectedValueOnce(new DOMException('optional timeout', 'TimeoutError'));
    expect(await collect()).toBeUndefined();
    const controller = new AbortController(); controller.abort(new Error('JOB_CANCELLED'));
    await expect(collect(new GoogleAnalytics4Service(controller.signal))).rejects.toThrow('JOB_CANCELLED');
  });
  it('skips a single-campaign scope without making a provider request', async () => {
    expect(await ga4Service.getCampaignUnitsSoldWithToken('a', '123', 'fixture', scope.startDate, scope.endDate, ['coffee_bags'])).toBeUndefined();
    expect(requests).toEqual([]);
  });
  it('enriches the existing import report only, preserving all prior metrics if quantity collection fails', async () => {
    vi.spyOn(ga4Service, 'getDistinctUsersWithToken').mockResolvedValue({ version: 1, metric: 'totalUsers', propertyId: '123',
      startDate: scope.startDate, endDate: scope.endDate, total: 0, campaigns: [], daily: [], windows: [] });
    const originalFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url: any, init: any) => {
      const body = JSON.parse(init.body);
      if (body.metrics[0].name === 'itemsPurchased') return originalFetch(url, init);
      return new Response(JSON.stringify({ metadata: { currencyCode: 'EUR' }, rowCount: 0, rows: [],
        totals: [{ metricValues: body.metrics.map(() => ({ value: '0' })) }] }));
    });
    const storage = { getGA4Connection: async () => ({ propertyId: '123', accessToken: 'fixture' }) };
    const capture = { campaignId: scope.campaignId, captured: { propertyId: '123', startDate: scope.startDate, endDate: scope.endDate,
      currencyCode: 'EUR', campaigns: scope.campaignNames.map(name => ({ name, rows: [] })) } };
    const run = (mode = 'reader') => ga4Service.getAcquisitionBreakdown(scope.campaignId, storage, scope.startDate, '123', 2000,
      scope.campaignNames, scope.endDate, true, false, 'EUR', true, mode === 'fallback' ? capture : mode === 'import' ? { campaignId: scope.campaignId } : undefined);
    const baseline = await run(); expect(requests).toHaveLength(0); expect(baseline.meta.unitsSold).toBeUndefined();
    const enriched = await run('fallback'); expect(enriched.meta.unitsSold?.campaigns[0].units).toBe(6);
    expect(await run('import')).toEqual(enriched);
    const { unitsSold, ...meta } = enriched.meta; expect({ ...enriched, meta }).toEqual(baseline);
    data.metadata = { subjectToThresholding: true };
    expect(await run('import')).toEqual(baseline);
  });
});

describe('units cards read only complete saved scopes', () => {
  it('does not infer quantities from existing conversion or revenue values', () => {
    expect(selectGA4UnitsSoldCards({ ...savedReport(), meta: { propertyId: '123' }, rows: [{ conversions: 1, revenue: 40.5 }] }, scope)).toEqual([]);
  });
  it.each(['propertyId', 'campaignId', 'startDate', 'endDate', 'metric', 'attribution', 'version'])('hides a mismatched %s packet', field => {
    const report = savedReport(); (report.meta.unitsSold as any)[field] = 'other';
    expect(selectGA4UnitsSoldCards(report, scope)).toEqual([]);
  });
  it.each(['propertyId', 'startDate', 'endDate'])('hides another report %s', field => {
    const report = savedReport(); (report as any)[field] = 'other';
    expect(selectGA4UnitsSoldCards(report, scope)).toEqual([]);
  });
  it.each([undefined, null, -1, 1.5, NaN, Infinity, '6'])('hides missing or invalid stored quantities (%s)', units => {
    const report = savedReport(); (report.meta.unitsSold.campaigns[1] as any).units = units;
    expect(selectGA4UnitsSoldCards(report, scope)).toEqual([]);
  });
  it('rejects partial, duplicate, extra, or foreign campaign sets', () => {
    for (const names of [['coffee_bags'], ['coffee_bags', 'other'], ['coffee_bags', 'COFFEE_BAGS'], ['coffee_bags', 'served_here', 'extra']]) {
      expect(selectGA4UnitsSoldCards(savedReport(), { ...scope, campaignNames: names })).toEqual([]);
    }
    const report = savedReport(); report.meta.unitsSold.campaigns[1].name = 'coffee_bags';
    expect(selectGA4UnitsSoldCards(report, scope)).toEqual([]);
  });
  it('keeps explicit zero ties, normalizes case, and leaves source data unchanged', () => {
    const report = savedReport(); report.meta.unitsSold.campaigns[0].units = 0;
    const before = structuredClone(report);
    const cards = selectGA4UnitsSoldCards(report, { ...scope, campaignNames: ['SERVED_HERE', 'COFFEE_BAGS'] });
    expect(cards.map(card => card.names)).toEqual([['COFFEE_BAGS', 'SERVED_HERE'], ['COFFEE_BAGS', 'SERVED_HERE']]);
    expect(cards.map(card => card.units)).toEqual([0, 0]); expect(report).toEqual(before);
  });
});
