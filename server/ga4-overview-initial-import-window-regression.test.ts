import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { summarizeGA4TrafficRows } from '../shared/ga4-traffic-window';
import { GA4_OVERVIEW_LEGACY_IMPORT_START_DATE, getGA4HistoricalImportStartDate } from './utils/reporting-timezone';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('GA4 Overview initial historical import boundary', () => {
  it('keeps the initial 30-day start fixed while completed days advance', () => {
    const selectedAt = new Date('2026-08-01T10:00:00.000Z');
    expect(getGA4HistoricalImportStartDate(selectedAt, 30, 'UTC')).toBe('2026-07-02');
    expect(getGA4HistoricalImportStartDate(selectedAt, 30, 'Europe/Amsterdam')).toBe('2026-07-02');
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

  it('does not use a legacy OAuth connection date as the historical import boundary', () => {
    const persistedRows = [
      { date: '2026-06-29', sessions: 107, users: 107, conversions: 13, engagementRate: 74 / 107 },
      { date: '2026-06-30', sessions: 108, users: 108, conversions: 14, engagementRate: 74 / 108 },
      { date: '2026-07-01', sessions: 115, users: 115, conversions: 15, engagementRate: 78 / 115 },
      { date: '2026-07-02', sessions: 866, users: 867, conversions: 110, engagementRate: 0.684 },
    ];
    const legacyOAuthDerivedStart = getGA4HistoricalImportStartDate('2026-07-29T10:00:00.000Z', 30, 'UTC');
    const wrongTotals = summarizeGA4TrafficRows(persistedRows.filter((row) => row.date >= String(legacyOAuthDerivedStart)));
    const correctedTotals = summarizeGA4TrafficRows(persistedRows.filter((row) => row.date >= GA4_OVERVIEW_LEGACY_IMPORT_START_DATE));
    expect(wrongTotals).toMatchObject({ sessions: 1196, users: 1197, conversions: 152 });
    expect(correctedTotals).toMatchObject({ sessions: 866, users: 867, conversions: 110 });
    expect((correctedTotals.engagementRate * 100).toFixed(1)).toBe('68.4');
    expect(((correctedTotals.conversions / correctedTotals.sessions) * 100).toFixed(1)).toBe('12.7');
  });

  it('keeps rolling consumers separate and routes cumulative totals only to Overview Summary', () => {
    const route = read('server/routes-oauth.ts');
    const page = read('client/src/pages/ga4-metrics.tsx');
    const scheduledReport = read('server/ga4-scheduled-report-pdf.ts');
    expect(route).toContain('overviewStartDate');
    expect(route).toContain('overviewTotals');
    expect(route).not.toContain('getGA4HistoricalImportStartDate(\n        (selectedConnection as any)?.connectedAt');
    expect(route).toContain('lookbackDays: existingConnection.lookbackDays');
    expect(route).toContain('importStartDate: existingConnection.importStartDate');
    expect(page).toContain('overviewSummaryTotals');
    expect(page).toContain('Imported GA4 data, updated daily');
    expect(scheduledReport).toContain('overviewStartDate');
    expect(scheduledReport).not.toContain('(connection as any)?.connectedAt');
  });
});
