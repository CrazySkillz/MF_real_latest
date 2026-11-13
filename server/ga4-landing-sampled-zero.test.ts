import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleAnalytics4Service } from './analytics';

// Regression fixtures stay local. Actual property verification is recorded separately.
const samplingMetadatas = [{ samplesReadCount: '11188', samplingSpaceSize: '11348' }];
const base = { rowCount: 1, rows: [{
  dimensionValues: [{ value: '/target' }, { value: 'google' }, { value: 'cpc' }],
  metricValues: [{ value: '10' }, { value: '9' }, { value: '0' }, { value: '0' }],
}] };
// Empty response shape observed from the real GA4 request; GA4 omitted metricHeaders and rows.
const emptyTotal = { kind: 'analyticsData#runReport', metadata: { currencyCode: 'EUR', timeZone: 'Europe/Dublin' } };
const zeroRowTotal = { metricHeaders: [{ name: 'conversions', type: 'TYPE_FLOAT' }], rowCount: 1, rows: [{ metricValues: [{ value: '0' }] }] };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Landing Pages sampled conversion supplement', () => {
  const execute = (total: any, metadata: any = { samplingMetadatas }) => {
    const requests: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      const request = JSON.parse(options.body); requests.push(request);
      return new Response(JSON.stringify(request.dimensions.length === 0 ? total
        : request.dimensions[0].name === 'pageLocation' ? { metadata } : base), { status: 200 });
    }));
    const save = vi.fn();
    const service = new GoogleAnalytics4Service();
    const promise = service.getLandingPagesReport('campaign', {
      getGA4Connection: async () => ({ propertyId: '123', accessToken: 'token' }), updateGA4ConnectionTokens: save,
    }, '2026-10-14', '123', 50, ['saved-campaign'], '2026-11-13', true);
    return { promise, requests, save };
  };

  it.each([emptyTotal, zeroRowTotal])(
    'retains the native row only after an unsampled exact-scope zero is verified', async total => {
      const { promise, requests, save } = execute(total);
      expect((await promise).rows).toEqual([{ landingPage: '/target', source: 'google', medium: 'cpc', sessions: 10, users: 9, conversions: 0, revenue: 0 }]);
      expect(requests).toHaveLength(3);
      expect(requests[2].dimensionFilter).toEqual(requests[1].dimensionFilter);
      expect(requests[2].dateRanges).toEqual(requests[1].dateRanges);
      expect(requests[2].metrics).toEqual([{ name: 'conversions' }]);
      expect(save).not.toHaveBeenCalled();
    },
  );

  it.each([
    {}, { ...emptyTotal, kind: undefined }, { ...emptyTotal, rows: null }, { ...emptyTotal, rowCount: 2 },
    { ...emptyTotal, rowCount: 1, rows: [{ metricValues: [{ value: '3' }] }] },
    { ...emptyTotal, rowCount: 1, rows: [{ metricValues: [{ value: '' }] }] },
    { ...emptyTotal, rowCount: 1, rows: [{ metricValues: [{ value: '-1' }] }] },
    { ...emptyTotal, rowCount: 1, rows: [{ metricValues: [{ value: 'NaN' }] }] },
    { ...emptyTotal, metadata: { samplingMetadatas } },
    { ...emptyTotal, metadata: { subjectToThresholding: true } },
  ])('does not turn positive, incomplete, invalid or restricted totals into zero', async total => {
    const { promise, save } = execute(total);
    await expect(promise).rejects.toMatchObject({ code: 'GA4_DATA_QUALITY_UNAVAILABLE' });
    expect(save).not.toHaveBeenCalled();
  });

  it('does not recover a mixed sampling/threshold restriction', async () => {
    const { promise, requests } = execute(emptyTotal, { samplingMetadatas, subjectToThresholding: true });
    await expect(promise).rejects.toMatchObject({ code: 'GA4_DATA_QUALITY_UNAVAILABLE' });
    expect(requests).toHaveLength(2);
  });
});
