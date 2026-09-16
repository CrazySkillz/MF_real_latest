import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ga4Service } from './analytics';
import {
  GA4_OVERVIEW_LEGACY_IMPORT_START_DATE,
  getGA4HistoricalImportStartDate,
  resolveGA4ImportToDateWindow,
} from './utils/reporting-timezone';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('GA4 Ad Comparison accumulation window', () => {
  it('keeps the selected 30-day import start fixed while completed days accumulate', () => {
    const selectedAt = new Date('2026-08-01T10:00:00.000Z');
    const importStartDate = getGA4HistoricalImportStartDate(selectedAt, 30, 'Europe/Amsterdam');
    expect(importStartDate).toBe('2026-07-02');

    expect(resolveGA4ImportToDateWindow(
      importStartDate,
      'Europe/Amsterdam',
      new Date('2026-08-16T10:00:00.000Z'),
    )).toEqual({
      reportingTimeZone: 'Europe/Amsterdam',
      dataThroughDate: '2026-08-15',
      startDate: '2026-07-02',
      endDate: '2026-08-15',
      days: 45,
    });
  });

  it('uses the campaign timezone for the latest completed day', () => {
    const now = new Date('2026-08-03T22:30:00.000Z');
    expect(resolveGA4ImportToDateWindow('2026-07-02', 'UTC', now)?.endDate).toBe('2026-08-02');
    expect(resolveGA4ImportToDateWindow('2026-07-02', 'Europe/Amsterdam', now)?.endDate).toBe('2026-08-03');
  });

  it('retains the documented legacy boundary and fails closed on invalid or future starts', () => {
    expect(resolveGA4ImportToDateWindow(null, 'UTC', new Date('2026-08-03T10:00:00.000Z'))?.startDate)
      .toBe(GA4_OVERVIEW_LEGACY_IMPORT_START_DATE);
    expect(resolveGA4ImportToDateWindow('2026-02-31', 'UTC', new Date('2026-08-03T10:00:00.000Z'))).toBeNull();
    expect(resolveGA4ImportToDateWindow('2026-08-04', 'UTC', new Date('2026-08-03T10:00:00.000Z'))).toBeNull();
  });

  it('sends the exact fixed start, completed end, property and campaign filter to GA4', async () => {
    const requestBodies: any[] = [];
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      requestBodies.push(JSON.parse(String(init?.body || '{}')));
      return {
        ok: true,
        json: async () => ({
          rowCount: 1,
          rows: [{
            dimensionValues: ['20260702', 'Paid Social', 'linkedin', 'paid_social', 'yesop_paid_social', 'desktop', 'NL']
              .map((value) => ({ value })),
            metricValues: ['29', '29', '3', '4845.73', '20'].map((value) => ({ value })),
          }],
          totals: [{ metricValues: ['29', '29', '3', '4845.73', '20'].map((value) => ({ value })) }],
        }),
      } as any;
    });
    vi.stubGlobal('fetch', fetchMock);
    const storage = { getGA4Connection: vi.fn(async (campaignId: string, propertyId: string) => ({
      id: 'connection-1',
      campaignId,
      propertyId: `properties/${propertyId}`,
      accessToken: 'token',
    })) };

    const result = await ga4Service.getAcquisitionBreakdown(
      'campaign-1',
      storage,
      '2026-07-02',
      '542352127',
      2000,
      ['yesop_paid_social'],
      '2026-08-15',
    );

    expect(storage.getGA4Connection).toHaveBeenCalledWith('campaign-1', '542352127');
    expect(requestBodies[0].dateRanges).toEqual([{ startDate: '2026-07-02', endDate: '2026-08-15' }]);
    expect(requestBodies[0].dimensionFilter.filter).toMatchObject({
      fieldName: 'sessionCampaignName',
      stringFilter: { matchType: 'EXACT', value: 'yesop_paid_social' },
    });
    expect(result.rows[0]).toMatchObject({ campaign: 'yesop_paid_social', sessions: 29, conversions: 3, revenue: 4845.73 });
  });

  it('isolates the cumulative query to the live Ad Comparison component', () => {
    const page = read('client/src/pages/ga4-metrics.tsx');
    const component = read('client/src/pages/ga4-ad-comparison.tsx');
    const route = read('server/routes-oauth.ts');
    expect(page).toContain('activeTab === "campaigns"');
    expect(page).toContain('window=import-to-date');
    expect(page).toContain('adComparisonCampaignBreakdown=1');
    expect(page).toContain('campaignBreakdownAgg={adComparisonBreakdownAgg}');
    expect(page).toContain('const campaignBreakdownAgg = useMemo');
    expect(page).toContain('{campaignBreakdownAgg.map((c, idx) => {');
    expect(component).toContain('GA4 Revenue (Imported to Date)');
    expect(component).not.toContain('GA4 Revenue (30 Completed Days)');
    const breakdownRoute = route.slice(
      route.indexOf('app.get("/api/campaigns/:id/ga4-breakdown"'),
      route.indexOf("app.get('/api/campaigns/:id/ga4-geographic'"),
    );
    expect(breakdownRoute.indexOf('ensureCampaignAccess(req as any, res as any, campaignId)'))
      .toBeLessThan(breakdownRoute.indexOf("if (windowMode === 'import-to-date')"));
    expect(breakdownRoute).toContain("windowMode === 'import-to-date' && !requestedPropertyId");
    expect(breakdownRoute).toContain("windowMode === 'import-to-date' && selectedCampaignNames.length === 0");
    expect(breakdownRoute).toContain('storage.getGA4Connection(campaignId, propertyId)');
    expect(breakdownRoute).toContain("const adComparisonCampaignBreakdown = windowMode === 'import-to-date'");
    expect(breakdownRoute).toContain(': adComparisonCampaignBreakdown');
    expect(breakdownRoute).toContain("String((campaign as any)?.currency || ''), true");
    expect(read('server/ga4-scheduled-report-pdf.ts')).toContain(
      'adComparisonWindow.endDate, false, false, campaignCurrency, true',
    );
  });

  it('keeps the browser Ad Comparison report on the live import-to-date rows', () => {
    const page = read('client/src/pages/ga4-metrics.tsx');
    const reportPreflight = page.slice(
      page.indexOf('if (sections.ads) {'),
      page.indexOf('const { jsPDF } = await import('),
    );
    const reportSection = page.slice(
      page.indexOf('// ========== AD COMPARISON =========='),
      page.indexOf('// ========== INSIGHTS =========='),
    );


    expect(page).toMatch(/activeTab === .campaigns. \|\| activeTab === .reports./);
    expect(reportPreflight).toContain('adComparisonBreakdownLoading || adComparisonBreakdownUnavailable || adComparisonBreakdownError');
    expect(reportSection).toContain('const rows = Array.isArray(adComparisonBreakdownAgg) ? adComparisonBreakdownAgg : [];');
    expect(reportSection).toContain('GA4 Revenue (Imported to Date)');
    expect(reportSection).not.toContain('GA4 Revenue (30 completed days)');
  });

  it('keeps every selector option, descending top-10 chart, totals, and PDF summary aligned', () => {
    const page = read('client/src/pages/ga4-metrics.tsx');
    const component = read('client/src/pages/ga4-ad-comparison.tsx');
    const scheduledPdf = read('server/ga4-scheduled-report-pdf.ts');
    const componentScope = component.slice(
      component.indexOf('const METRIC_OPTIONS'),
      component.indexOf('{/* Full comparison table */}'),
    );
    const browserPdfScope = page.slice(
      page.indexOf('// ========== AD COMPARISON =========='),
      page.indexOf('if (includeAdsAllCampaigns)'),
    );
    const scheduledPdfScope = scheduledPdf.slice(
      scheduledPdf.indexOf('if (sections.ads) {'),
      scheduledPdf.indexOf('if (includeAllCampaigns)'),
    );
    const adAggregateScope = page.slice(
      page.indexOf('const adComparisonBreakdownAgg = useMemo'),
      page.indexOf('const campaignBreakdownMatchedExternalRevenue'),
    );
    const scheduledAggregateScope = scheduledPdf.slice(
      scheduledPdf.indexOf('const adComparisonByCampaign = new Map'),
      scheduledPdf.indexOf('const sourceRevenueBreakdowns'),
    );

    for (const [value, label] of [
      ['sessions', 'Sessions'],
      ['users', 'Users'],
      ['conversions', 'Conversions'],
      ['revenue', 'Revenue'],
      ['conversionRate', 'Conversion Rate'],
    ]) {
      expect(componentScope).toContain(`{ value: "${value}", label: "${label}" }`);
      expect(componentScope).toContain('{opt.label} (High to Low)');
    }
    expect(componentScope).toContain('return (bv - av)');
    expect(componentScope).toContain('{ sensitivity: "variant" }');
    expect(componentScope).toContain('return chartRows.slice(0, 10)');
    expect(componentScope).toContain('payload?.[0]?.payload as any)?.fullName');
    expect(componentScope).toContain('(totalConversions / totalSessions) * 100');
    expect(componentScope).toContain('GA4 Revenue (Imported to Date)');
    expect(componentScope).toContain('Overall Conversion Rate');
    expect(componentScope).toContain('{chartSummaryRows.length}');
    expect(componentScope).toContain('const chartSummaryRows = useMemo');
    expect(component).toContain('{comparisonRows.map((c, idx) => {');
    expect(adAggregateScope).toContain('byName.get(name)');
    expect(adAggregateScope).not.toContain('nameKey');
    expect(scheduledAggregateScope).toContain('adComparisonByCampaign.get(name)');
    expect(scheduledAggregateScope).not.toContain('nameKey');
    expect(component).toContain('No campaign data available. Ensure your GA4 property has UTM campaign tracking configured.');
    expect(component).toContain('Showing the last verified campaign breakdown. The latest refresh failed.');
    expect(component).toContain('Ad Comparison is unavailable because the campaign breakdown could not be verified.');

    for (const pdfScope of [browserPdfScope, scheduledPdfScope]) {
      expect(pdfScope).toContain('slice(0, 10)');
      expect(pdfScope).toContain('(totalConversions / totalSessions) * 100');
      expect(pdfScope).toContain('GA4 Revenue (Imported to Date)');
      expect(pdfScope).toContain('Overall Conversion Rate');
      expect(pdfScope).toContain('Campaigns Compared');
      expect(pdfScope).toContain('Users are summed campaign-row counts and are non-additive.');
      expect(pdfScope).toContain('chartSummaryByCampaign');
    }
    expect(browserPdfScope).toContain('const selectedMetric = reportAdComparisonMetric');
    expect(browserPdfScope).toContain('if (metric === "conversions") return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 15 })');
    expect(browserPdfScope).toContain('Number(p.value || 0) > 0');
    expect(scheduledPdfScope).toContain('rawCfg?.adComparisonMetric');
    expect(scheduledPdfScope).toContain('item.value > 0');
    expect(page).toContain('? { adComparisonMetric }');
    expect(page).toContain('adComparisonMetric: ["sessions", "users", "conversions", "revenue", "conversionRate"].includes');
  });

  it('requires the live validator to prove imported revenue is excluded from native ranking', () => {
    const validator = read('scripts/ga4-ad-comparison-live-readonly.ts');

    expect(validator).toContain('/revenue-sources?platformContext=ga4');
    expect(validator).toContain('/revenue-breakdown?platformContext=ga4');
    expect(validator).toContain("materializedRevenueStatus === 'available'");
    expect(validator).toContain('does not match its materialized breakdown');
    expect(validator).toContain('Imported revenue leaked into the native GA4 Revenue summary');
    expect(validator).toContain('Valid zero Sessions summary did not render as zero');
    expect(validator).toContain('No campaign data available. Ensure your GA4 property has UTM campaign tracking configured.');
    expect(validator).toContain('Missing property request returned');
    expect(validator).toContain('sourceInventory:');
    expect(validator).not.toContain('Rendered Revenue Breakdown is missing source');
  });
});
