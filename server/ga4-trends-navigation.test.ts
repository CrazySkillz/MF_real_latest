import { describe, expect, it } from 'vitest';
import { getGA4InsightsTrendsRange, buildGA4InsightsRollups } from '../shared/ga4-insights';

describe('Trends history navigation', () => {
  it('starts at the imported boundary and bounds each daily/rolling viewport to a month', () => {
    for (const mode of ['daily', '7d', '30d']) {
      expect(getGA4InsightsTrendsRange('2026-06-04', '2026-11-17', '', mode)).toEqual({startDate:'2026-11-01',endDate:'2026-11-17',previousDate:'2026-10-31',nextDate:''});
      expect(getGA4InsightsTrendsRange('2026-06-04', '2026-11-17', '2026-06-30', mode)).toEqual({startDate:'2026-06-04',endDate:'2026-06-30',previousDate:'',nextDate:'2026-07-31'});
    }
  });
  it('handles year boundaries, leap days, future selections and incomplete history', () => {
    expect(getGA4InsightsTrendsRange('2023-06-01','2024-03-12','2024-02-29','7d').previousDate).toBe('2024-01-31');
    expect(getGA4InsightsTrendsRange('2023-06-01','2024-03-12','2024-01-01','7d').nextDate).toBe('2024-02-29');
    expect(getGA4InsightsTrendsRange('2023-06-01','2024-03-12','2024-02-30','7d').endDate).toBe('2024-03-12');
    expect(getGA4InsightsTrendsRange('2023-06-01','2024-03-12','2025-01-01','7d').endDate).toBe('2024-03-12');
    expect(getGA4InsightsTrendsRange('2023-06-01','2024-03-12','2024-01-15','monthly').startDate).toBe('2023-06-01');
    expect(getGA4InsightsTrendsRange('2020-06-01','2026-11-17','','monthly').startDate).toBe('2025-12-01');
    expect(getGA4InsightsTrendsRange('', '2026-11-17','','daily').endDate).toBe('');
    expect(buildGA4InsightsRollups([{date:'2026-09-04',sessions:0},{date:'2026-09-10',sessions:4}], '2026-09-10').last7.complete).toBe(false);
  });
});
