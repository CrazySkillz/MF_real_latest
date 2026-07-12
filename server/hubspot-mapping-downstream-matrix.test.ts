import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeGA4CampaignAllocationKey } from '../shared/ga4-financial-source';

const read = (path: string) => readFileSync(path, 'utf8');

const section = (source: string, startNeedle: string, endNeedle: string) => {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe('HubSpot GA4 mapping and downstream variant matrix', () => {
  it('uses one campaign allocation key across punctuation, spacing, and case variants', () => {
    expect(normalizeGA4CampaignAllocationKey('  Yesop_Retargeting ')).toBe('yesopretargeting');
    expect(normalizeGA4CampaignAllocationKey('yesop-retargeting')).toBe('yesopretargeting');
    expect(normalizeGA4CampaignAllocationKey('YESOP  RETARGETING')).toBe('yesopretargeting');
    expect(normalizeGA4CampaignAllocationKey('')).toBe('');
  });

  it('keeps identical add, distinct add, edit, and scheduler source identity explicit', () => {
    const routes = read('server/routes-oauth.ts');
    const wizard = read('client/src/components/HubSpotRevenueWizard.tsx');
    const scheduler = read('server/auto-refresh-scheduler.ts');
    const saveRoute = section(
      routes,
      'app.post("/api/campaigns/:id/hubspot/save-mappings"',
      '// Helper function to refresh Google Sheets access token'
    );

    expect(saveRoute).toContain('const requestedSourceId = String((body.data as any).sourceId || "").trim();');
    expect(saveRoute).toContain('const existingSource = await storage.getRevenueSource(campaignId, requestedSourceId);');
    expect(saveRoute).toContain('const selectedKey = selected.map');
    expect(saveRoute).toContain('.sort().join(');
    expect(saveRoute).toContain('if (requestedSourceId) return String((s as any).id || "") === requestedSourceId;');
    expect(saveRoute).toContain('return String(cfg?.campaignProperty || "") === campaignProp');
    expect(saveRoute).toContain('&& cfgKey === selectedKey');
    expect(saveRoute).toContain('existingHubspot ? String((existingHubspot as any).id) : null');
    expect(saveRoute).toContain('// Note: do NOT deactivate existing sources');
    expect(wizard).toContain('...(sourceId ? { sourceId } : {}),');
    expect(scheduler).toContain('reprocessHubSpot(campaignId, hubCfg, String(hubspotSource.id))');
  });

  it('fails closed on ambiguous normalized rows and accumulates exact multi-value and multi-source matches', () => {
    const overview = read('client/src/pages/ga4-metrics.tsx');
    const comparison = read('client/src/pages/ga4-ad-comparison.tsx');
    const scheduled = read('server/ga4-scheduled-report-pdf.ts');
    const overviewAllocation = section(
      overview,
      'const campaignBreakdownMatchedExternalRevenue = useMemo',
      'const sourceRevenueBreakdowns = useMemo'
    );
    const comparisonAllocation = section(
      comparison,
      'const allocationSummary = useMemo',
      'const sourceRevenueBreakdowns = useMemo'
    );
    const scheduledAllocation = section(
      scheduled,
      'const rowCounts = new Map<string, number>();',
      'const sourceRevenueBreakdowns = new Map'
    );

    for (const source of [overview, comparison, scheduled]) {
      expect(source).toContain('normalizeGA4CampaignAllocationKey');
    }
    expect(overview.split('const normalizeCampaignKey = normalizeGA4CampaignAllocationKey;').length - 1).toBe(2);
    for (const allocation of [overviewAllocation, comparisonAllocation, scheduledAllocation]) {
      expect(allocation).toContain('rowCounts.set(key, (rowCounts.get(key) || 0) + 1)');
      expect(allocation).toContain('rowCounts.get(key) !== 1');
      expect(allocation).toContain('for (const source of revenueDisplaySources)');
      expect(allocation).toContain('for (const item of totals)');
    }
    expect(overviewAllocation).toContain('(matched.get(rowName) || 0) + revenue');
    expect(comparisonAllocation).toContain('(matchedByRow.get(rowName) || 0) + revenue');
    expect(scheduledAllocation).toContain('(campaignBreakdownMatchedExternalRevenue.get(rowName) || 0) + revenue');
  });

  it('replaces mapping authority and propagates save/delete changes to financial consumers and alerts', () => {
    const routes = read('server/routes-oauth.ts');
    const saveRoute = section(
      routes,
      'app.post("/api/campaigns/:id/hubspot/save-mappings"',
      '// Helper function to refresh Google Sheets access token'
    );
    const deleteRoute = section(
      routes,
      'app.delete("/api/campaigns/:id/revenue-sources/:sourceId"',
      '// Individual spend source delete'
    );
    const recompute = section(
      routes,
      'const scheduleGA4RevenuePostResponseRecompute',
      'const scheduleGA4SpendPostResponseRecompute'
    );

    expect(saveRoute).toContain('campaignValueRevenueTotals: Array.from(campaignValueRevenueTotals.entries())');
    expect(saveRoute).toContain('...(campaignMappings.length > 0 ? { campaignMappings } : {})');
    expect(saveRoute).toContain('await recomputeCampaignDerivedValues(campaignId, { platformContext: platformCtx });');
    expect(deleteRoute).toContain('await storage.deleteRevenueSourceWithRecords(campaignId, sourceId, sourcePlatformContext');
    expect(deleteRoute).toContain('await recomputeCampaignDerivedValues(campaignId, { platformContext: sourcePlatformContext });');
    expect(recompute).toContain('recomputeGA4KPIAndBenchmarkValues(campaignId, "Revenue Update")');
    expect(recompute).toContain('await checkPerformanceAlerts();');
  });
});
