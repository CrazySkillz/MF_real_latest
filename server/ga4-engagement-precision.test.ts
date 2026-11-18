import { describe, expect, it } from 'vitest';
import { buildGA4InsightsCalendarRollup, buildGA4InsightsMonthlySeries, calculateGA4InsightsDeltaPct, normalizeGA4InsightsDailyMetricValues, normalizeGA4InsightsDailyRows } from '../shared/ga4-insights';
import real from './fixtures/ga4-trends-history';

describe('GA4 Insights engagement precision from saved counts', () => {
  const saved = real.daily.map(row => ({ ...row, engagementRate: Number(row.engagementRate.toFixed(4)) }));
  it('recovers September 14 and 15 without changing stored inputs or other fields', () => {
    const original = structuredClone(saved);
    const rows = normalizeGA4InsightsDailyRows(saved, real.endDate);
    for (const row of normalizeGA4InsightsDailyRows(['2026-09-14', '2026-09-15'].map(date => ({ date, sessions: 117, engagedSessions: 85, engagementRate: '0.7265' })))) {
      expect(row.engagementRate).toBe(85 / 117);
      expect((row.engagementRate * 100).toFixed(1)).toBe('72.6');
    }
    rows.forEach((row, i) => {
      expect(row.engagementRate).toBe(saved[i].sessions > 0 ? saved[i].engagedSessions / saved[i].sessions : 0);
      expect({ ...row, engagementRate: saved[i].engagementRate }).toEqual(saved[i]);
      // The save/publication normalizer and persisted representation stay untouched.
      expect(normalizeGA4InsightsDailyMetricValues(saved[i])).toEqual(saved[i]);
    });
    expect(saved).toEqual(original);
  });

  it.each([null, undefined, ''])('preserves the saved-rate fallback for a missing count (%s)', engagedSessions => {
    const row = normalizeGA4InsightsDailyRows([{ date: '2026-09-14', sessions: 117, engagementRate: '0.7265', engagedSessions }])[0];
    expect(row.engagedSessions).toBeNull();
    expect(row.engagementRate).toBe(0.7265);
  });

  it('handles zero counts, numeric strings, cutoffs, gaps and invalid rows without manufacturing history', () => {
    const rows = normalizeGA4InsightsDailyRows([
      { date: '2026-09-13', sessions: '117', engagedSessions: '85', engagementRate: '0.7265' },
      { date: '2026-09-14', sessions: 117, engagedSessions: 0, engagementRate: 0.7265 },
      { date: '2026-09-15', sessions: 0, engagedSessions: 0, engagementRate: 0 },
      { date: '2026-09-17', sessions: 117, engagedSessions: 118, engagementRate: 0.7265 },
      { date: '2026-09-18', sessions: 117, engagedSessions: 85, engagementRate: 'invalid' },
      { date: '2026-09-19', sessions: 117, engagedSessions: 85, engagementRate: 0.7265 },
    ], '2026-09-18');
    expect(rows.map(row => [row.date, row.engagementRate])).toEqual([
      ['2026-09-13', 85 / 117], ['2026-09-14', 0], ['2026-09-15', 0],
    ]);
    expect(buildGA4InsightsCalendarRollup(rows, '2026-09-18', 7).complete).toBe(false);
  });

  it('preserves every rolling and monthly weighted result and computes daily deltas from full precision', () => {
    const rows = normalizeGA4InsightsDailyRows(saved, real.endDate);
    for (const day of rows) {
      for (const length of [7, 30]) {
        expect(buildGA4InsightsCalendarRollup(rows, day.date, length)).toEqual(buildGA4InsightsCalendarRollup(real.daily, day.date, length));
      }
    }
    expect(buildGA4InsightsMonthlySeries(rows, real.endDate, 'engagementRate')).toEqual(buildGA4InsightsMonthlySeries(real.daily, real.endDate, 'engagementRate'));
    expect(calculateGA4InsightsDeltaPct(rows[10].engagementRate, rows[9].engagementRate)).toBeCloseTo(calculateGA4InsightsDeltaPct(real.daily[10].engagementRate, real.daily[9].engagementRate), 12);
  });
});
