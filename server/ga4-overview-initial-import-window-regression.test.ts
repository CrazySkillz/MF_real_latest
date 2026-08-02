import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { summarizeGA4TrafficRows } from '../shared/ga4-traffic-window';
import { getGA4HistoricalImportStartDate } from './utils/reporting-timezone';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('GA4 Overview initial historical import boundary', () => {
  it('keeps the initial 30-day start fixed while completed days advance', () => {
    const connectedAt = new Date('2026-08-01T10:00:00.000Z');
    expect(getGA4HistoricalImportStartDate(connectedAt, 30, 'UTC')).toBe('2026-07-02');
    expect(getGA4HistoricalImportStartDate(connectedAt, 30, 'Europe/Amsterdam')).toBe('2026-07-02');
  });

  it('does not reduce unchanged totals when a later completed day has no activity', () => {
    const importedRows = [
      { date: '2026-07-02', sessions: 21, users: 20, conversions: 2, engagementRate: 0.5 },
      { date: '2026-07-31', sessions: 866, users: 867, conversions: 110, engagementRate: 0.684 },
    ];
    const afterZeroActivityDay = [...importedRows];
    expect(summarizeGA4TrafficRows(importedRows).sessions).toBe(887);
    expect(summarizeGA4TrafficRows(afterZeroActivityDay).sessions).toBe(887);
  });

  it('keeps rolling consumers separate and routes cumulative totals only to Overview Summary', () => {
    const route = read('server/routes-oauth.ts');
    const page = read('client/src/pages/ga4-metrics.tsx');
    const scheduledReport = read('server/ga4-scheduled-report-pdf.ts');
    expect(route).toContain('overviewStartDate');
    expect(route).toContain('overviewTotals');
    expect(page).toContain('overviewSummaryTotals');
    expect(page).toContain('Imported GA4 data, updated daily');
    expect(scheduledReport).toContain('overviewStartDate');
  });
});
