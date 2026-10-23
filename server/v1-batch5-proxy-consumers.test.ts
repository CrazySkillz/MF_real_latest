import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const files = {
  ga4: ['ga4-metrics.tsx', 'pipelineProxyData'],
  sheets: ['google-sheets-data.tsx', 'googleSheetsPipelineProxySourceEntries'],
  custom: ['custom-integration-analytics.tsx', 'customIntegrationPipelineProxySourceEntries'],
} as const;
function expression(file: string, name: string) {
  const tree = ts.createSourceFile(file, readFileSync(`client/src/pages/${file}`, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let code = '';
  function visit(n: ts.Node) { if (ts.isVariableDeclaration(n) && n.name.getText(tree) === name) code = n.initializer!.getText(tree); ts.forEachChild(n, visit); }
  visit(tree); if (!code) throw Error(`Missing ${name}`);
  return ts.transpileModule(`const result = ${code};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
}
const code = Object.fromEntries(Object.entries(files).map(([kind, [file, name]]) => [kind, expression(file, name)]));
const source = (provider: string) => ({ id: `${provider}-source`, sourceType: provider, isActive: true, mappingConfig: JSON.stringify({ selectedValues: ['selected'], pipelineEnabled: true, pipelineStageId: 'open', pipelineStageLabel: 'Open', pipelineTotalToDate: 100, pipelineValueRevenueTotals: [{ campaignValue: 'selected', revenue: 100 }] }) });
const endpoint = (provider = 'hubspot') => ({ success: true, pipelineEnabled: true, sourceId: `${provider}-source`, mode: 'current_stage', currency: 'USD', lastUpdatedAt: '2026-10-23T12:00:00Z', totalToDate: 0, pipelineValueRevenueTotals: [] });
function read(kind: keyof typeof files, data: any, options: any = {}) {
  const sources = options.sources ?? [source('hubspot')];
  const env: any = {
    useMemo: (f: any) => f(), revenueSourcesResp: { sources }, revenueDisplaySources: sources, selectedGa4CampaignFilterList: ['selected'],
    hubspotPipelineProxyData: data, salesforcePipelineProxyData: options.salesforce, hubspotPipelineProxyError: !!options.error, salesforcePipelineProxyError: false, campaignCurrency: 'USD',
    activeGoogleSheetsRevenueSources: sources, parseRevenueSourceConfig: (s: any) => JSON.parse(s.mappingConfig), googleSheetsRevenueCurrency: 'USD',
    activeCustomIntegrationRevenueSources: sources, getCustomIntegrationFinancialSourceConfig: (s: any) => JSON.parse(s.mappingConfig), customIntegrationFinancialCurrency: 'USD',
    customIntegrationHubspotPipelineProxyData: data, customIntegrationSalesforcePipelineProxyData: options.salesforce, customIntegrationHubspotPipelineProxyError: !!options.error, customIntegrationSalesforcePipelineProxyError: false,
  };
  const result = new Function(...Object.keys(env), code[kind] + '\nreturn result;')(...Object.values(env));
  return kind === 'ga4' ? result : { success: result.length > 0 && result.every((e: any) => e.available), providerEntries: result, totalToDate: result.every((e: any) => e.available) ? result.reduce((s: number, e: any) => s + e.totalToDate, 0) : null };
}
describe.each(Object.keys(files) as Array<keyof typeof files>)('Batch 5 %s actual proxy consumer', kind => {
  it('keeps current zero and empty items instead of the old mapping 100', () => {
    const result = read(kind, endpoint()); expect(result.success).toBe(true); expect(result.totalToDate).toBe(0);
    expect(result.providerEntries[0].campaignValues ?? []).toEqual([]);
  });
  it.each([null, { success: false }, { ...endpoint(), warning: 'Mixed currency' }, { ...endpoint(), sourceId: 'different-source' }, { ...endpoint(), mode: 'legacy' }, { ...endpoint(), lastUpdatedAt: null }, { ...endpoint(), currency: 'EUR' }, { ...endpoint(), totalToDate: null }, { ...endpoint(), totalToDate: 25 }, { ...endpoint(), pipelineEnabled: false }])('shows unavailable for unverified endpoint %j', data => {
    const result = read(kind, data); expect(result.success).toBe(false); expect(result.totalToDate).toBeNull();
  });
  it('does not present cached endpoint data as current after a failed refetch', () => { expect(read(kind, endpoint(), { error: true }).success).toBe(false); });
  it('retains exact positive value and freshness', () => {
    const result = read(kind, { ...endpoint(), totalToDate: 12.75, pipelineValueRevenueTotals: [{ campaignValue: 'selected', revenue: 12.75 }] });
    expect(result.success).toBe(true); expect(result.totalToDate).toBe(12.75); expect(result.providerEntries[0].lastUpdatedAt).toBe('2026-10-23T12:00:00Z');
  });
  it('never publishes a partial combined total when another configured provider fails', () => {
    const result = read(kind, endpoint(), { sources: [source('hubspot'), source('salesforce')] });
    expect(result.success).toBe(false); expect(result.totalToDate).toBeNull();
  });
  it('does not resurrect a disconnected source from an old endpoint', () => { const result = read(kind, endpoint(), { sources: [] }); expect(result?.success ?? false).toBe(false); });
});
