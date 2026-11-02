import { describe, expect, it } from 'vitest';
import { sumSpendAmounts } from '../shared/currency';
import { mapGoogleAdsDailyInsights } from './googleAdsClient';
import { buildGA4GoogleAdsSpendMaterialization } from './ga4-google-ads-spend';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

export const cases = [
  { name: 'same-day campaigns', costs: [1234567, 2234567], days: [1, 1], expected: '3.47' },
  { name: 'multiple dates', costs: [12345678, 12345678], days: [1, 2], expected: '24.69' },
  { name: 'sub-cent costs', costs: [4999, 4999, 4999], days: [1, 1, 2], expected: '0.01' },
  { name: 'exact half cent', costs: [1004999, 1], days: [1, 2], expected: '1.01' },
  { name: 'below half cent', costs: [1004998, 1], days: [1, 2], expected: '1.00' },
  { name: 'whole-cent control', costs: [1250000, 2750000], days: [1, 2], expected: '4.00' },
  { name: 'verified zero', costs: [0, 0], days: [1, 2], expected: '0.00' },
];
export function mapped(costs: number[], days: number[], campaignId = 'a') {
  return mapGoogleAdsDailyInsights(campaignId, costs.map((costMicros, i) => ({
    campaignId: String(i + 1), campaignName: `Fixture ${i + 1}`, date: `2026-10-0${days[i]}`,
    costMicros, impressions: 100, clicks: 5, conversions: 1, conversionsValue: 0,
    ctr: 0.05, averageCpc: 0, averageCpm: 0, interactionRate: 0, videoViews: 0, searchImpressionShare: 0,
  })));
}
export function materialize(rows: any[]) {
  return buildGA4GoogleAdsSpendMaterialization({ campaignId: 'a', currency: 'EUR', accountName: 'Fixture',
    selectedCampaignIds: rows.map(row => row.googleCampaignId), rows, startDate: '2026-10-01', endDate: '2026-10-02', fetchedAt: '2026-10-03T00:00:00Z' });
}

describe('ACCURACY-001 Google Ads round-once precision', () => {
  it.each(cases)('$name preserves micros until the selected-period result', c => {
    const result = materialize(mapped(c.costs, c.days));
    expect(result.amount.toFixed(2)).toBe(c.expected);
    // Exact input sum independently checked against the six-place stored records.
    const rawMicros = c.costs.reduce((total, value) => total + BigInt(value), 0n);
    const storedMicros = result.records.reduce((total, row) => total + BigInt(row.spend.replace('.', '')), 0n);
    expect(storedMicros).toBe(rawMicros);
  });
  it('sums six-place decimal strings beyond JS safe-integer micros without losing a cent', () => {
    expect(sumSpendAmounts(['9999999999.004999', '0.000001'])).toBe('9999999999.01');
    expect(sumSpendAmounts(['-1.005000'])).toBe('-1.01');
    expect(sumSpendAmounts(['-0.004999'])).toBe('0.00');
    expect(sumSpendAmounts(['10.25', '5.59', '0', '-1.00'])).toBe('14.84');
  });
  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects unrepresentable provider cost %s before persistence', value => {
    expect(() => mapped([value], [1])).toThrow('invalid cost micros');
  });
  it.each(['NaN', 'Infinity', '', '1e3', '1.0000001', '12oops'])('rejects invalid stored decimal %s', value => {
    expect(() => sumSpendAmounts([value])).toThrow('Invalid spend amount');
  });
  it('keeps non-selected rows out of the result', () => {
    const rows = mapped([1234567, 2234567, 99999999], [1, 1, 1]);
    const result = buildGA4GoogleAdsSpendMaterialization({ campaignId: 'a', currency: 'EUR', accountName: 'Fixture',
      selectedCampaignIds: ['1', '2'], rows, startDate: '2026-10-01', endDate: '2026-10-02', fetchedAt: null });
    expect(result.amount).toBe(3.47);
    expect(result.mappingConfig.breakdown).toHaveLength(2);
  });
  it('actual wizard grouping retains Ads fractions while preserving the adjacent Meta path', () => {
    const source = readFileSync('client/src/components/AddSpendWizardModal.tsx', 'utf8');
    const start = source.indexOf('      // Group metrics by campaign', source.indexOf('const fetchAdPlatformPreview'));
    const end = source.indexOf('      setAdPlatformCampaigns(campaigns);', start);
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const group = new Function('metrics', 'platform', `${code}; return campaigns;`);
    const rows = mapped([1234567, 2234567], [1, 1]);
    const preview = group(rows, 'google_ads');
    expect(preview.map((row: any) => row.spend)).toEqual([1.234567, 2.234567]);
    expect(sumSpendAmounts(preview.map((row: any) => row.spend))).toBe('3.47');
    expect(group([{ metaCampaignId: 'meta', spend: '1.234567' }], 'meta')[0].spend).toBe(1.23);
  });
});
