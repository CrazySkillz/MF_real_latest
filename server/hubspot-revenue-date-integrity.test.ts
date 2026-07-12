import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { normalizeStrictUtcDateKey } from './utils/data-transformation';

const routes = readFileSync(join(process.cwd(), 'server', 'routes-oauth.ts'), 'utf8');

const hubspotSaveRoute = () => {
  const start = routes.indexOf('app.post("/api/campaigns/:id/hubspot/save-mappings"');
  const end = routes.indexOf('// Helper function to refresh Google Sheets access token', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return routes.slice(start, end);
};

describe('GA4 HubSpot confirmed revenue date integrity', () => {
  it('normalizes supported HubSpot date values to strict UTC day keys', () => {
    expect(normalizeStrictUtcDateKey('2026-07-01')).toBe('2026-07-01');
    expect(normalizeStrictUtcDateKey('2026/7/1')).toBe('2026-07-01');
    expect(normalizeStrictUtcDateKey('7/1/2026')).toBe('2026-07-01');
    expect(normalizeStrictUtcDateKey('2026-07-01T23:30:00-05:00')).toBe('2026-07-02');
    expect(normalizeStrictUtcDateKey('2026-03-29T00:30:00+01:00')).toBe('2026-03-28');
    expect(normalizeStrictUtcDateKey('2026-10-25T01:30:00+02:00')).toBe('2026-10-24');
    expect(normalizeStrictUtcDateKey(Date.parse('2026-07-01T12:00:00.000Z'))).toBe('2026-07-01');
    expect(normalizeStrictUtcDateKey(Math.floor(Date.parse('2026-07-01T12:00:00.000Z') / 1000))).toBe('2026-07-01');
  });

  it('rejects missing and impossible calendar dates instead of rolling them forward', () => {
    expect(normalizeStrictUtcDateKey(null)).toBeNull();
    expect(normalizeStrictUtcDateKey('')).toBeNull();
    expect(normalizeStrictUtcDateKey('2026-02-29')).toBeNull();
    expect(normalizeStrictUtcDateKey('2026-02-30T12:00:00.000Z')).toBeNull();
    expect(normalizeStrictUtcDateKey('2026-02-30 12:00:00Z')).toBeNull();
    expect(normalizeStrictUtcDateKey('2/30/2026')).toBeNull();
    expect(normalizeStrictUtcDateKey('2026-13-01')).toBeNull();
    expect(normalizeStrictUtcDateKey('not-a-date')).toBeNull();
    expect(normalizeStrictUtcDateKey('2024-02-29')).toBe('2024-02-29');
  });

  it('fails GA4 invalid dates and total mismatches before any revenue mutation', () => {
    const route = hubspotSaveRoute();
    const invalidDateGuard = route.indexOf(`if (platformCtx === 'ga4' && invalidConfirmedRevenueDateCount > 0)`);
    const reconciliationGuard = route.indexOf(`code: 'HUBSPOT_REVENUE_MATERIALIZATION_MISMATCH'`);
    const connectionMutation = route.indexOf('await storage.updateHubspotConnection');
    const atomicMutation = route.indexOf('await storage.replaceGa4HubspotRevenueSourceWithRecords');

    expect(route).toContain(`? normalizeStrictUtcDateKey(props?.[dateFieldChoice])`);
    expect(route).toContain(': normalizeDate(props?.[dateFieldChoice]);');
    expect(route).toContain('dateField: z.enum(["closedate", "hs_lastmodifieddate", "createdate"]).optional(),');
    expect(route).toContain(`code: 'HUBSPOT_INVALID_CONFIRMED_REVENUE_DATES'`);
    expect(route).toContain('const confirmedRevenueTotal = Number(totalRevenue.toFixed(2));');
    expect(route).toContain('const dailyMaterializedTotal = Number(Array.from(revenueByCloseDate.values())');
    expect(route).toContain('const campaignValueMaterializedTotal = Number(Array.from(campaignValueRevenueTotals.values())');
    expect(invalidDateGuard).toBeGreaterThanOrEqual(0);
    expect(reconciliationGuard).toBeGreaterThan(invalidDateGuard);
    expect(connectionMutation).toBeGreaterThan(reconciliationGuard);
    expect(atomicMutation).toBeGreaterThan(reconciliationGuard);
  });
});
