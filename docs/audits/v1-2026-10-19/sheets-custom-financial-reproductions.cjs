const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const out = 'docs/audits/v1-2026-10-19/';
function page(file) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const vars = new Map(), funcs = new Map(), queries = new Map();
  function visit(n) {
    if (ts.isVariableDeclaration(n) && n.initializer) {
      if (ts.isIdentifier(n.name) && !vars.has(n.name.text)) vars.set(n.name.text, n.initializer.getText(sf));
      if (ts.isObjectBindingPattern(n.name) && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(sf) === 'useQuery') {
        const data = n.name.elements.find(e => e.propertyName?.getText(sf) === 'data');
        const fn = n.initializer.arguments[0]?.properties?.find(p => p.name?.getText(sf) === 'queryFn');
        if (data && fn) queries.set(data.name.getText(sf), fn.initializer.getText(sf));
      }
    }
    if (ts.isFunctionDeclaration(n) && n.name) funcs.set(n.name.text, n.getText(sf));
    ts.forEachChild(n, visit);
  } visit(sf);
  function evalCode(code, env) { return new Function(...Object.keys(env), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText)(...Object.values(env)); }
  return { vars, value: (name, env = {}) => { assert.ok(vars.has(name), name); return evalCode(`return (${vars.get(name)});`, env); }, fn: (name, env = {}) => { assert.ok(funcs.has(name), name); return evalCode(`${funcs.get(name)}\nreturn ${name};`, env); }, query: (name, response) => { assert.ok(queries.has(name), name); return evalCode(`return (${queries.get(name)})();`, { campaignId: 'fixture', fetch: async () => response }); } };
}
const custom = page('client/src/pages/custom-integration-analytics.tsx');
const sheets = page('client/src/pages/google-sheets-data.tsx');
function customValues(revenueResponse, spendResponse, importedSpend = 100) {
  const env = { metricsData: { spend: importedSpend }, customIntegrationRevenueSourcesData: { success: true, sources: [{ id: 'revenue-a', isActive: true }] }, customIntegrationRevenueTotalsData: revenueResponse, customIntegrationSpendTotalsData: spendResponse, parseCustomIntegrationMetricNumber: custom.fn('parseCustomIntegrationMetricNumber'), campaign: { currency: 'USD' } };
  for (const name of ['activeCustomIntegrationRevenueSources', 'customIntegrationImportedRevenue', 'customIntegrationImportedSpend', 'customIntegrationExternalRevenue', 'customIntegrationTotalRevenue', 'hasCustomIntegrationConfirmedRevenue', 'customIntegrationExternalSpend', 'customIntegrationTotalSpend', 'customIntegrationSpendSourceIds', 'activeCustomIntegrationSpendSources', 'hasCustomIntegrationConfirmedSpend', 'hasCustomIntegrationDerivedFinancials', 'customIntegrationRoas', 'customIntegrationRoi']) env[name] = custom.value(name, env);
  return { revenueAvailable: env.hasCustomIntegrationConfirmedRevenue, revenue: env.customIntegrationTotalRevenue, spendAvailable: env.hasCustomIntegrationConfirmedSpend, spend: env.customIntegrationTotalSpend, roas: env.customIntegrationRoas, roi: env.customIntegrationRoi };
}
function sheetsValues(revenue, spend) {
  const env = { googleSheetsRevenueSourcesData: { success: true, sources: [{ id: 'revenue-a', isActive: true }] }, googleSheetsRevenueTotalsData: { success: true, totalRevenue: revenue }, googleSheetsSpendTotalsData: { success: true, totalSpend: spend, sourceIds: ['spend-a'], sources: [{ id: 'spend-a' }] }, useMemo: fn => fn() };
  for (const name of ['activeGoogleSheetsRevenueSources', 'googleSheetsTotalRevenue', 'hasGoogleSheetsConfirmedRevenue', 'googleSheetsTotalSpend', 'googleSheetsSpendSourceIds', 'activeGoogleSheetsSpendSources', 'hasGoogleSheetsConfirmedSpend', 'hasGoogleSheetsDerivedFinancials', 'googleSheetsRoas', 'googleSheetsRoi', 'googleSheetsConfirmedFinancialMetricOptions']) env[name] = sheets.value(name, env);
  return env;
}
function proxy(p, providerResponse, source) {
  const common = { useMemo: fn => fn(), activeGoogleSheetsRevenueSources: [source], activeCustomIntegrationRevenueSources: [source], parseRevenueSourceConfig: row => JSON.parse(row.mappingConfig), getCustomIntegrationFinancialSourceConfig: row => JSON.parse(row.mappingConfig), hubspotPipelineProxyData: providerResponse, salesforcePipelineProxyData: null, customIntegrationHubspotPipelineProxyData: providerResponse, customIntegrationSalesforcePipelineProxyData: null };
  return p.value(p === custom ? 'customIntegrationPipelineProxySourceEntries' : 'googleSheetsPipelineProxySourceEntries', common);
}
(async () => {
  const results = [];
  const failedRevenue = await custom.query('customIntegrationRevenueTotalsData', { ok: false });
  const failed = customValues(failedRevenue, { success: true, totalSpend: 0, sourceIds: [], sources: [] });
  assert.deepEqual(failed, { revenueAvailable: true, revenue: 0, spendAvailable: true, spend: 100, roas: 0, roi: -100 });
  results.push({ case: 'Custom revenue HTTP failure becomes confirmed0 and loss100%', query: failedRevenue, actual: failed });
  const malformedRevenue = await custom.query('customIntegrationRevenueTotalsData', { ok: true, json: async () => { throw new Error('AUDIT malformed response'); } });
  assert.equal(customValues(malformedRevenue, { success: true, totalSpend: 0 }).roi, -100);
  results.push({ case: 'Custom malformed successful JSON also becomes confirmed0', query: malformedRevenue });
  const failedSpend = await custom.query('customIntegrationSpendTotalsData', { ok: false });
  const partial = customValues({ success: true, totalRevenue: 200 }, failedSpend);
  assert.equal(partial.spend, 100); assert.equal(partial.spendAvailable, true); assert.equal(partial.roas, 2);
  results.push({ case: 'Custom external Spend failure leaves imported100 as complete total and ROAS2', actual: partial, boundary: 'Existing imported Spend supplies availability; external amount is unknown, not asserted to be a specific number' });
  const zeroControl = customValues({ success: true, totalRevenue: 0 }, { success: true, totalSpend: 0 });
  assert.equal(zeroControl.revenueAvailable, true); assert.equal(zeroControl.roi, -100);
  results.push({ case: 'Control: actual Custom measured0 revenue with100Spend correctly computes loss100%', actual: zeroControl });
  for (const [revenue, spend] of [[0, 100], [100, 0], [0, 0], [-10, 100]]) {
    const v = sheetsValues(revenue, spend);
    assert.equal(v.googleSheetsRoas, null); assert.equal(v.googleSheetsRoi, null);
    assert.equal(v.hasGoogleSheetsConfirmedRevenue, revenue > 0); assert.equal(v.hasGoogleSheetsConfirmedSpend, spend > 0);
    results.push({ case: `Sheets successful financial totals Revenue${revenue}/Spend${spend} lose zero/negative availability`, actual: { revenueAvailable: v.hasGoogleSheetsConfirmedRevenue, spendAvailable: v.hasGoogleSheetsConfirmedSpend, roi: v.googleSheetsRoi, options: v.googleSheetsConfirmedFinancialMetricOptions }, boundary: revenue < 0 ? 'Conditional successful negative response; provider/import acceptance policies vary' : 'Successful exact responses with existing source IDs; cards render Not connected for unavailable amounts' });
  }
  const positive = sheetsValues(200, 100); assert.equal(positive.googleSheetsRoas, 2); assert.equal(positive.googleSheetsRoi, 100);
  results.push({ case: 'Control: positive Sheets200/100 yields ROAS2/ROI100%', roas: positive.googleSheetsRoas, roi: positive.googleSheetsRoi });
  const sheetError = await sheets.query('googleSheetsRevenueTotalsData', { ok: false });
  assert.deepEqual(sheetError, { success: false, totalRevenue: 0 });
  results.push({ case: 'Sheets financial HTTP failure is normal returned data rather than thrown query error', actual: sheetError, boundary: 'Amounts subsequently show Not connected because positive-value guard fails; no measured-zero display claim for Sheets' });
  const source = { id: 'proxy-a', sourceType: 'hubspot', isActive: true, mappingConfig: JSON.stringify({ pipelineEnabled: true, pipelineStageId: 'open', pipelineTotalToDate: 100, pipelineValueRevenueTotals: [{ campaignValue: 'A', revenue: 100 }], pipelineWarning: 'Old provider failure', pipelineLastUpdatedAt: '2020-01-01' }) };
  for (const [name, p, queryName] of [['Custom', custom, 'customIntegrationHubspotPipelineProxyData'], ['Sheets', sheets, 'hubspotPipelineProxyData']]) {
    const failedProxy = await p.query(queryName, { ok: false }); assert.equal(failedProxy, null);
    const entries = proxy(p, failedProxy, source); assert.equal(entries[0].totalToDate, 100); assert.equal(entries[0].warning, undefined); assert.equal(entries[0].lastUpdatedAt, undefined);
    results.push({ case: `${name} Pipeline HTTP failure displays old mapping100 without warning/freshness fields`, entries });
    const zero = proxy(p, { success: true, totalToDate: 0, pipelineValueRevenueTotals: [] }, source); assert.equal(zero[0].totalToDate, 0);
    results.push({ case: `Control: ${name} Pipeline successful0 preserves0 instead of old100`, entries: zero });
  }
  const eur = sheets.value('fmtCurrency', { googleSheetsRevenueCurrency: 'EUR' })(100);
  assert.ok(eur.includes('100')); assert.equal(positive.googleSheetsConfirmedFinancialMetricOptions[0].unit, '$');
  results.push({ case: 'Sheets currency-aware Overview and fixed-dollar financial metric-option contract differ', overviewEur100: eur, metricOption: positive.googleSheetsConfirmedFinancialMetricOptions[0], boundary: 'Option propagation to saved KPI/report currency requires independent validation; existing field contract proven, no live saved record asserted' });
  fs.writeFileSync(out + 'sheets-custom-financial-reproductions.json', JSON.stringify({ head: '777aae6f6353e998d60b635d3e66b413093117c2', executedAt: new Date().toISOString(), boundary: 'Actual current page AST query functions, transforms and formatters. Synthetic replies, immediate useMemo, no DOM/provider/database. Does not certify full retained pages or all financial consumers.', results }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: results.length, passed: results.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
