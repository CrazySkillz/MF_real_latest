const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const out = 'docs/audits/v1-2026-10-19/';
const parse = path => ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const pages = Object.fromEntries(['instagram', 'tiktok', 'google-ads', 'meta'].map(p => [p, parse(`client/src/pages/${p}-analytics.tsx`)]));
const server = parse('server/routes-oauth.ts');
const js = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function find(sf, predicate) { let found; function visit(n) { if (!found && predicate(n)) found = n; if (!found) ts.forEachChild(n, visit); } visit(sf); assert.ok(found, 'Requested AST node absent'); return found; }
function evaluate(code, bindings = {}) { const vars = { useMemo: fn => fn(), ...bindings }; return new Function(...Object.keys(vars), js(`return (${code});`))(...Object.values(vars)); }
function value(sf, name, bindings) { const n = find(sf, n => ts.isVariableDeclaration(n) && n.name.getText(sf) === name); return evaluate(n.initializer.getText(sf), bindings); }
function func(sf, name, bindings) { const n = find(sf, n => ts.isFunctionDeclaration(n) && n.name?.text === name); return evaluate(n.getText(sf), bindings); }
function handler(path, bindings) {
  const n = find(server, n => ts.isCallExpression(n) && n.expression.getText(server) === 'app.get' && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === path);
  return evaluate(n.arguments[n.arguments.length - 1].getText(server), bindings);
}
function response() { return { statusCode: 200, payload: null, status(v) { this.statusCode = v; return this; }, json(v) { this.payload = v; return this; }, setHeader() {} }; }
const results = [], quiet = { log() {}, error() {}, warn() {} };
const getDateRangeBounds = value(server, 'getDateRangeBounds');
function revenueState(p, sources, rangedTotal = 100) {
  const prefix = p === 'google-ads' ? 'googleAds' : p;
  const capital = prefix[0].toUpperCase() + prefix.slice(1);
  const inputs = { [`active${capital}RevenueSources`]: sources, [`${prefix}RevenueTotalsData`]: { success: true, totalRevenue: rangedTotal }, overviewTotals: { spend: 100 }, summary: { spend: 100, totalSpend: 100 } };
  const state = { ...inputs };
  for (const name of [`has${capital}AttributedRevenue`, `${prefix}AttributedRevenueFromSources`, `${prefix}AttributedRevenue`, `${prefix}AttributedProfit`, `${prefix}AttributedRoas`, `${prefix}AttributedRoi`]) state[name] = value(pages[p], name, state);
  return { available: state[`has${capital}AttributedRevenue`], revenue: state[`${prefix}AttributedRevenue`], profit: state[`${prefix}AttributedProfit`], roas: state[`${prefix}AttributedRoas`], roi: state[`${prefix}AttributedRoi`] };
}
async function run() {
  for (const p of ['instagram', 'google-ads', 'meta']) {
    const actual = revenueState(p, [{ id: 'old-and-current', isActive: true, lastTotalRevenue: 900, currency: 'EUR' }]);
    assert.equal(actual.revenue, 900); assert.equal(actual.roas, 9); assert.equal(actual.roi, 800);
    results.push({ case: `${p}: all-history source amount overrides bounded revenue total`, suppliedBoundedRevenue: 100, spendInMetricsWindow: 100, allHistorySourceRevenue: 900, actual, boundary: 'Exact page expressions, synthetic source/totals/summary objects; not a browser or provider test.' });
  }
  const ranges = [];
  const sourceRoute = handler('/api/campaigns/:id/revenue-sources', {
    parseRevenueReadPlatformContext: raw => raw, ensureCampaignAccess: async () => ({ id: 'fixture', currency: 'EUR' }), getShopifyRevenueSourceFreshness: () => null,
    storage: { getRevenueSources: async () => [{ id: 'source', currency: 'EUR' }], getRevenueBreakdownBySource: async (...args) => { ranges.push(args.slice(1, 3)); return [{ sourceId: 'source', revenue: 900 }]; } },
  });
  let res = response(); await sourceRoute({ params: { id: 'fixture' }, query: { platformContext: 'instagram' } }, res);
  assert.deepEqual(ranges, [['1900-01-01', '2999-12-31'], ['1900-01-01', '2999-12-31']]); assert.equal(res.payload.sources[0].lastTotalRevenue, 900);
  results.push({ case: 'Non-GA4 source-list API requests all history', ranges, response: res.payload });
  const mixedRoute = handler('/api/campaigns/:id/revenue-sources', {
    parseRevenueReadPlatformContext: raw => raw, ensureCampaignAccess: async () => ({ id: 'fixture' }), getShopifyRevenueSourceFreshness: () => null,
    storage: { getRevenueSources: async () => [{ id: 'usd', currency: 'USD', mappingConfig: '{"lastTotalRevenue":100}' }, { id: 'eur', currency: 'EUR', mappingConfig: '{"lastTotalRevenue":200}' }], getRevenueBreakdownBySource: async () => { throw new Error('Imported revenue source currencies do not match'); } },
  });
  res = response(); await mixedRoute({ params: { id: 'fixture' }, query: { platformContext: 'instagram' } }, res);
  const mixed = revenueState('instagram', res.payload.sources, 0);
  assert.equal(res.payload.success, true); assert.equal(mixed.revenue, 300); assert.equal(mixed.roas, 3);
  results.push({ case: 'Currency-integrity read errors are replaced by mapping totals and summed by Instagram', response: res.payload, actual: mixed, boundary: 'Actual source-list handler/page expressions; storage throws its actual error text. No claim mixed rows currently exist in production.' });
  const schema = { safeParse: id => ({ success: true, data: id }) };
  for (const p of ['instagram', 'tiktok']) {
    const calls = [], base = p === 'instagram' ? 'Instagram' : 'TikTok';
    const read = handler(`/api/${p}/:campaignId/daily-metrics`, {
      campaignIdSchema: schema, ensureCampaignAccess: async () => true, console: quiet, getDateRangeBounds,
      storage: { [`get${base}Connection`]: async () => ({ selectedCampaignIds: '["selected"]', method: 'oauth' }), [`get${base}DailyMetrics`]: async () => { throw new Error('fixture DB unavailable'); }, getRevenueTotalForRange: async (...a) => { calls.push(a); return { totalRevenue: 0, currency: 'EUR', sourceIds: ['measured-zero'] }; } },
    });
    res = response(); await read({ params: { campaignId: 'fixture' }, query: { dateRange: '30days' } }, res);
    assert.equal(res.statusCode, 200); assert.equal(res.payload.success, true); assert.equal(res.payload.rows.length, 0);
    results.push({ case: `${p}: DB failure returns successful empty read`, response: res.payload, boundary: 'Actual handler; actor/schema/storage fixture inputs, no DB or authentication certificate.' });
    if (p === 'tiktok') {
      assert.equal(calls[0][1], '1900-01-01'); assert.notEqual(calls[0][1], res.payload.startDate); assert.equal(res.payload.financialSummary.hasAttributedRevenue, false); assert.equal(res.payload.financialSummary.attributedRevenue, null);
      results.push({ case: 'TikTok uses all-history Revenue for selected metric window and hides measured zero', metricStart: res.payload.startDate, revenueRead: calls[0], suppliedRevenue: { totalRevenue: 0, currency: 'EUR', sourceIds: ['measured-zero'] }, financialSummary: res.payload.financialSummary });
    }
  }
  for (const p of ['google-ads', 'meta', 'tiktok']) {
    const formatter = p === 'tiktok' ? func(pages[p], 'formatCurrency') : value(pages[p], 'fmtCurrency');
    const formatted = formatter(100); assert.equal(formatted, '$100.00');
    results.push({ case: `${p}: current monetary formatter has no currency input`, sourceCurrency: 'EUR', amount: 100, formatted, boundary: 'Exact formatter; EUR is fixture provenance, not an argument the formatter accepts. Current caller/source currency propagation traced separately.' });
  }
  const igFormatter = func(pages.instagram, 'formatInstagramKpiValue', { getInstagramKpiMetric: () => ({ unit: '$' }) });
  assert.equal(igFormatter('spend', 100), '$100.00');
  results.push({ case: 'Instagram KPI currency formatter hardcodes dollar', sourceCurrency: 'EUR', amount: 100, formatted: igFormatter('spend', 100), boundary: 'Exact formatter; metric lookup supplies its actual declared Spend unit.' });
  const metrics = [
    { date: '2026-10-01', impressions: 1000, clicks: 10, spend: '100', ctr: '1', searchImpressionShare: '50' },
    { date: '2026-10-01', impressions: 10, clicks: 10, spend: '10', ctr: '100', searchImpressionShare: '100' },
  ];
  const summary = value(pages['google-ads'], 'summary', { metrics });
  const chart = value(pages['google-ads'], 'chartData', { metrics });
  assert.equal(summary.ctr, 20 / 1010 * 100); assert.equal(chart[0].ctr, 50.5); assert.equal(summary.searchImpressionShare, 75); assert.equal(chart[0].searchImpressionShare, 75);
  results.push({ case: 'Google Ads daily CTR and Search Impression Share average row rates', metrics, actualSummary: summary, actualChart: chart, exactSyntheticEligibleShare: 1010 / 2010 * 100, boundary: 'CTR denominator exactly known. Eligible-share example assumes disjoint exact synthetic Search rows; not a recipe to infer real eligibility from rounded/censored provider shares.' });
  const igZero = value(pages.instagram, 'overviewTotals', { dailyMetrics: { rows: [{ impressions: 0, clicks: 0, spend: 0, conversions: 0 }] } });
  const ttZero = value(pages.tiktok, 'totals', { rows: [{ impressions: 0, clicks: 0, spend: 0, conversions: 0 }] });
  assert.equal(igZero.ctr, null); assert.equal(igZero.cpc, null); assert.equal(ttZero.ctr, null); assert.equal(ttZero.costPerConversion, null);
  results.push({ case: 'Control: Instagram/TikTok overview rate denominators withhold undefined ratios', instagram: igZero, tiktok: ttZero });
  fs.writeFileSync(out + 'retained-value-boundary-reproductions.json', JSON.stringify({ head: '777aae6f6353e998d60b635d3e66b413093117c2', executedAt: new Date().toISOString(), boundary: 'Current AST-extracted handlers/page expressions. Fixture storage/provider state only. No app server, live requests, customer data or runtime modifications.', results }, null, 2) + '\n');
  console.log(`${results.length} retained-value cases executed`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
