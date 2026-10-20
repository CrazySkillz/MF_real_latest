const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const out = 'docs/audits/v1-2026-10-19/';
const code = ts.transpileModule(fs.readFileSync('server/utils/linkedin-revenue.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
class AuditDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-19T12:00:00Z'])); } static now() { return Date.parse('2026-10-19T12:00:00Z'); } }
async function run(options = {}) {
  const calls = [], writes = [];
  const storage = {
    getCampaign: async () => ({ id: 'fixture', startDate: '2020-01-01', currency: 'USD' }),
    getRevenueTotalForRange: async (...args) => { calls.push({ method: 'revenueRange', args }); if (options.failRevenue) throw Error('AUDIT revenue unavailable'); return { totalRevenue: options.revenue ?? 0 }; },
    getRevenueSources: async () => { if (options.failSources) throw Error('AUDIT source list unavailable'); return options.sources ?? [{ id: 'rev-a', sourceType: 'csv', isActive: true, mappingConfig: '{}' }]; },
    getLinkedInConnection: async () => ({ campaignId: 'fixture', conversionValue: options.connectionCv ?? null }),
    updateLinkedInConnection: async (...args) => { writes.push(args); },
    getShopifyConnection: async () => null,
    getConversionEvents: async (...args) => { calls.push({ method: 'events', args }); return options.events ?? []; },
  };
  const exports = {}; new Function('exports', 'require', 'Date', code)(exports, name => { assert.equal(name, '../storage'); return { storage }; }, AuditDate);
  const result = await exports.resolveLinkedInRevenueContext({ campaignId: 'fixture', conversionsTotal: 10, sessionConversionValue: options.sessionCv });
  return { result, calls, writes };
}
const sf = ts.createSourceFile('routes.ts', fs.readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
let adsHandler;
function findHandler(n) { if (ts.isCallExpression(n) && n.expression.getText(sf) === 'app.get' && n.arguments[0]?.text === '/api/linkedin/imports/:sessionId/ads') adsHandler = n.arguments.at(-1); ts.forEachChild(n, findHandler); } findHandler(sf);
assert.ok(adsHandler, 'Current ads handler');
const vars = new Map();
function visit(n) { if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && !vars.has(n.name.text)) vars.set(n.name.text, n.initializer.getText(sf)); ts.forEachChild(n, visit); } visit(adsHandler);
function value(name, env) { assert.ok(vars.has(name), name); return new Function(...Object.keys(env), ts.transpileModule(`return (${vars.get(name)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(...Object.values(env)); }
(async () => {
  const results = [];
  const failure = await run({ failRevenue: true, failSources: true, connectionCv: 50 });
  assert.deepEqual(failure.writes, [['fixture', { conversionValue: null }]]); assert.equal(failure.result.hasRevenueTracking, false);
  results.push({ case: 'Revenue/source read failures cause current helper to clear a valid connection CV', actual: failure });
  const zeroLegacy = await run({ revenue: 0, connectionCv: 50 }); assert.equal(zeroLegacy.result.totalRevenue, 500); assert.equal(zeroLegacy.result.conversionValueSource, 'connection');
  results.push({ case: 'Configured actual-revenue source measured0 loses precedence to legacy connection CV50', actual: zeroLegacy });
  const negativeLegacy = await run({ revenue: -10, connectionCv: 50 }); assert.equal(negativeLegacy.result.totalRevenue, 500);
  results.push({ case: 'Conditional negative actual-revenue total also loses precedence to legacy CV', actual: negativeLegacy, boundary: 'Successful negative storage reply; not a claim all provider import paths currently accept refunds' });
  const deletedLegacy = await run({ sources: [], connectionCv: 50, sessionCv: 50 }); assert.equal(deletedLegacy.writes.length, 1); assert.equal(deletedLegacy.result.totalRevenue, 500); assert.equal(deletedLegacy.result.conversionValueSource, 'session');
  results.push({ case: 'No sources: self-heal clears connection CV but retained session CV still supplies Revenue500', actual: deletedLegacy, boundary: 'Persisted legacy session scenario, not a full source-delete route test' });
  const positive = await run({ revenue: 123.45, connectionCv: 50, sessionCv: 50 }); assert.equal(positive.result.totalRevenue, 123.45); assert.equal(positive.result.conversionValueSource, 'derived'); assert.equal(positive.writes.length, 0);
  results.push({ case: 'Control: positive actual Revenue ignores legacy CV and preserves123.45 exactly', actual: positive });
  const explicit = await run({ connectionCv: 50, sources: [{ id: 'explicit', isActive: true, mappingConfig: '{"valueSource":"conversion_value"}' }] }); assert.equal(explicit.result.totalRevenue, 500);
  results.push({ case: 'Control: explicit configured conversion-value mode produces500 for10conversions', actual: explicit });
  const noLegacy = await run({ revenue: 0 }); assert.equal(noLegacy.result.hasRevenueTracking, false);
  results.push({ case: 'Configured measured0 with no legacy CV becomes tracking unavailable', actual: noLegacy });
  const shopify = await run({ revenue: 1000, sources: [{ id: 'shopify', sourceType: 'shopify', isActive: true, mappingConfig: '{}' }] }); assert.equal(shopify.result.conversionValue, 1000); assert.equal(shopify.result.totalRevenue, 1000);
  results.push({ case: 'Missing Shopify order-count/AOV metadata assumes one order for conversion value', actual: shopify, boundary: 'Amount is real fixture Revenue1000; derived per-order1000 has no evidenced order count. Total Revenue remains1000.' });
  assert.deepEqual(positive.calls[0].args.slice(1), ['1900-01-01', '2026-10-19', 'linkedin']); assert.equal(positive.result.windowStartDate, '2026-09-19'); assert.equal(positive.result.windowEndDate, '2026-10-18');
  results.push({ case: 'Helper reports30-completed-day window but imported Revenue query uses all-history through today', query: positive.calls[0], declaredWindow: [positive.result.windowStartDate, positive.result.windowEndDate] });
  const mixed = await run({ revenue: 100, events: [{ value: '100', currency: 'USD', conversionType: 'purchase' }, { value: '200', currency: 'EUR', conversionType: 'lead' }] });
  assert.equal(mixed.result.totalRevenue, 300); assert.equal(mixed.result.webhookRevenueUsed, true);
  results.push({ case: 'Webhook highest-priority Revenue sums USD/EUR and purchase/lead values without contract guard', actual: mixed, boundary: 'Current storage schema permits these fields; same campaign fixture. No cross-tenant or live occurrence claim.' });
  const env = { rev: mixed.result, ads: [{ id: 'ad-a', conversions: 1, spend: 10 }, { id: 'ad-b', conversions: 3, spend: 30 }], totalAdConversions: 4, totalRevenueAll: mixed.result.totalRevenue, importedRevenueToDate: mixed.result.importedRevenueToDate, conversionValue: mixed.result.conversionValue, parseNum: x => Number(x || 0) };
  for (const name of ['conversionValueSourceRaw', 'conversionValueSource', 'allocatedAdRevenue', 'computeAdRevenue', 'enriched']) env[name] = value(name, env);
  assert.deepEqual(env.enriched.map(ad => ad.revenue), ['75.00', '225.00']); assert.ok(env.enriched.every(ad => ad._computed.revenueIsEstimated === false));
  results.push({ case: 'Actual Ads expressions allocate webhook totals by conversion share without Estimated flag', ads: env.enriched, boundary: 'No ad identity exists in supplied events; actual declaration/map expressions, not the complete route/storage/auth journey' });
  fs.writeFileSync(out + 'linkedin-revenue-boundary-reproductions.json', JSON.stringify({ head: '777aae6f6353e998d60b635d3e66b413093117c2', executedAt: new Date().toISOString(), boundary: 'Complete actual LinkedIn revenue utility with fixture storage and fixed clock; actual Ads-route aggregation expressions. No real connection mutation, provider, message or runtime change.', results }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: results.length, passed: results.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
