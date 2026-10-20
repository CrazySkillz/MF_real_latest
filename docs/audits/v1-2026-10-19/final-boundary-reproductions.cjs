// Audit-only exact route/helper cases. All actors and persistence are synthetic.
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), assert = require('node:assert/strict');
const compile = s => ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function load(file) {
  const module = { exports: {} };
  new Function('module', 'exports', 'require', compile(fs.readFileSync(file, 'utf8')))(module, module.exports, id =>
    id.startsWith('.') ? load(path.resolve(path.dirname(file), id) + '.ts') : require(id));
  return module.exports;
}
const schema = load('shared/schema.ts'), timezone = load('server/utils/reporting-timezone.ts'), z = require('zod').z;
const sf = ts.createSourceFile('routes.ts', fs.readFileSync('server/routes-oauth.ts', 'utf8'), 99, true);
const named = new Map(), routes = new Map();
function visit(n) {
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && !named.has(n.name.text)) named.set(n.name.text, `const ${n.getText(sf)};`);
  if (ts.isFunctionDeclaration(n) && n.name) named.set(n.name.text, n.getText(sf));
  if (ts.isCallExpression(n) && /^app\.(get|post|patch|put|delete)$/.test(n.expression.getText(sf)) && ts.isStringLiteral(n.arguments[0]))
    routes.set(n.expression.name.text.toUpperCase() + ' ' + n.arguments[0].text, n.arguments.at(-1).getText(sf));
  ts.forEachChild(n, visit);
}
visit(sf);
const bind = (code, name, env) => new Function(...Object.keys(env), compile(code) + `\nreturn ${name};`)(...Object.values(env));
const response = () => ({ statusCode: 200, status(n) { this.statusCode = n; return this; }, json(value) { this.payload = value; return this; } });
const campaign = { id: 'owned-campaign', clientId: 'owned-client', ownerId: 'owner-a', status: 'active', currency: 'EUR', reportingTimeZone: 'UTC', ga4CampaignFilter: 'selected' };
const quiet = { log() {}, warn() {}, error() {} };
function environment(storage) {
  const env = { storage, ...schema, z, getAuth: () => ({ userId: 'owner-a', sessionId: 'session-a' }), isInternalAutoRefreshRequest: () => false, console: quiet, process: { env: { NODE_ENV: 'production' } }, ...timezone };
  for (const name of ['campaignIdSchema', 'getActorId', 'ensureCampaignAccess', 'ensureKpiAccess', 'ensureBenchmarkAccess', 'zPlatformContext', 'parsePlatformContext', 'parseGA4CampaignFilter', 'getGA4CampaignFilterValues', 'withReportingTimeZone'])
    env[name] = bind(named.get(name), name, env);
  return env;
}
async function request(key, storage, req, extra = {}) {
  const env = { ...environment(storage), ...extra }, res = response();
  const handler = bind('const handler=' + routes.get(key), 'handler', env);
  await handler({ params: {}, body: {}, query: {}, ...req }, res);
  return res;
}
async function main() {
  const results = [];
  {
    const calls = [], res = await request('POST /api/clients', { createClient: async value => { calls.push(value); return value; } },
      { body: { name: '  Fixture Client  ', ownerId: 'owner-b', id: 'foreign-client' } });
    assert.equal(res.statusCode, 201); assert.deepEqual(calls, [{ ownerId: 'owner-a', name: 'Fixture Client' }]);
    results.push({ case: 'Client create replaces spoofed owner and ignores caller ID', status: 201 });
  }
  {
    const calls = [], res = await request('GET /api/clients', { getClients: async owner => { calls.push(owner); return []; } }, {});
    assert.equal(res.statusCode, 200); assert.deepEqual(calls, ['owner-a']);
    results.push({ case: 'Client list passes authenticated owner to persistence', status: 200 });
  }
  for (const include of [false, true]) {
    const lookups = [];
    const rows = [campaign, { ...campaign, id: 'foreign', ownerId: 'owner-b' }, { ...campaign, id: 'orphan', clientId: 'missing' },
      { ...campaign, id: 'draft', status: 'draft' }, { ...campaign, id: 'foreign-draft', status: 'draft', ownerId: 'owner-b' }];
    const res = await request('GET /api/campaigns', {
      getClients: async owner => { assert.equal(owner, 'owner-a'); return [{ id: 'owned-client' }]; },
      getCampaigns: async () => rows,
      getGA4InitialImportStatus: async (id, owner) => { lookups.push([id, owner]); return { state: 'pending' }; },
    }, { query: { includeInitialImports: include ? '1' : '0' } });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload.map(r => r.id), include ? ['owned-campaign', 'draft'] : ['owned-campaign']);
    assert.deepEqual(lookups, include ? [['draft', 'owner-a']] : []);
    results.push({ case: 'Campaign list excludes foreign/orphan rows and scopes import status', includeInitialImports: include, visibleCount: res.payload.length });
  }
  for (const key of ['GET /api/campaigns', 'POST /api/campaigns', 'PATCH /api/campaigns/:id']) {
    let writes = 0;
    const res = await request(key, {
      getCampaign: async () => campaign, getClients: async () => [{ id: 'owned-client' }],
      getCampaigns: async () => { writes++; return []; }, createCampaign: async () => { writes++; },
      updateCampaign: async () => { writes++; },
    }, { params: { id: campaign.id }, body: { clientId: 'foreign-client' }, query: { clientId: 'foreign-client' } });
    assert.equal(res.statusCode, 404); assert.equal(writes, 0);
    results.push({ case: key + ' rejects foreign Client before campaign read/write', status: 404 });
  }
  {
    const writes = [], res = await request('PATCH /api/campaigns/:id', {
      getCampaign: async () => campaign, updateCampaign: async (id, value) => { writes.push({ id, value }); return { ...campaign, ...value }; },
    }, { params: { id: campaign.id }, body: { ownerId: 'owner-b', id: 'other-id', name: 'Changed label' } });
    assert.equal(res.statusCode, 200); assert.deepEqual(writes, [{ id: campaign.id, value: { name: 'Changed label' } }]);
    results.push({ case: 'Campaign update strips owner and row identity using actual schema', status: 200 });
  }
  for (const [key, storage, params, query, status] of [
    ['DELETE /api/campaigns/:id/revenue-sources/:sourceId', { getRevenueSource: async (id, source) => { assert.equal(id, campaign.id); assert.equal(source, 'foreign-source'); return undefined; } }, { id: campaign.id, sourceId: 'foreign-source' }, {}, 404],
    ['DELETE /api/campaigns/:id/revenue-sources/:sourceId', { getRevenueSource: async () => ({ id: 'source', platformContext: 'google_ads' }) }, { id: campaign.id, sourceId: 'source' }, { platformContext: 'ga4' }, 404],
    ['DELETE /api/campaigns/:id/spend-sources/:sourceId', { getSpendSources: async id => { assert.equal(id, campaign.id); return [{ id: 'owned-source' }]; } }, { id: campaign.id, sourceId: 'foreign-source' }, {}, 404],
    ['DELETE /api/campaigns/:id/revenue-sources/:sourceId/pipeline-proxy', {}, { id: campaign.id, sourceId: 'source' }, { platformContext: 'google_ads' }, 400],
  ]) {
    const res = await request(key, { getCampaign: async () => campaign, ...storage }, { params, query });
    assert.equal(res.statusCode, status, JSON.stringify({ key, payload: res.payload }));
    results.push({ case: key + ' rejects absent child or different platform', requestedPlatform: query.platformContext || null, status });
  }
  for (const method of ['PATCH', 'DELETE']) {
    for (const child of [{ id: 'kpi', campaignId: 'owned-sibling', platformType: null }, { id: 'kpi', campaignId: campaign.id, platformType: 'google_analytics' }]) {
      const res = await request(method + ' /api/campaigns/:id/kpis/:kpiId', {
        getCampaign: async id => ({ ...campaign, id }), getKPI: async () => child,
      }, { params: { id: campaign.id, kpiId: 'kpi' }, body: { campaignId: 'foreign-campaign' } });
      assert.equal(res.statusCode, 404);
      results.push({ case: method + ' campaign KPI rejects owned sibling or platform child', childCampaign: child.campaignId, childPlatform: child.platformType, status: 404 });
    }
  }
  const complete = { campaignsProcessed: 1, campaignIdsFailed: [], kpiIdsSkipped: [], kpiIdsFailed: [], benchmarkIdsSkipped: [], benchmarkIdsFailed: [], alertReconciliationFailures: [] };
  for (const [label, result, succeeds] of [
    ['All goals and alert reconciliation completed', complete, true],
    ['No campaign processed', { ...complete, campaignsProcessed: 0 }, false],
    ['Target campaign failed', { ...complete, campaignIdsFailed: [campaign.id] }, false],
    ['KPI unavailable/skipped', { ...complete, kpiIdsSkipped: ['kpi'] }, false],
    ['Benchmark failed', { ...complete, benchmarkIdsFailed: ['benchmark'] }, false],
    ['Alert reconciliation failed', { ...complete, alertReconciliationFailures: ['kpi'] }, false],
  ]) {
    const calls = [], env = {
      console: quiet, getReportingDateWindow: () => ({ endDate: '2026-10-19' }),
      storage: { getCampaign: async () => campaign, invalidateExecutiveSummaryDailySnapshotAlignment: async (...args) => { calls.push(['invalidate', ...args]); } },
      runGA4DailyKPIAndBenchmarkJobs: async options => { calls.push(['jobs', options]); return result; },
    };
    const fn = bind(named.get('recomputeGA4KPIAndBenchmarkValues'), 'recomputeGA4KPIAndBenchmarkValues', env);
    if (succeeds) assert.equal(await fn(campaign.id, 'Fixture'), true);
    else await assert.rejects(fn(campaign.id, 'Fixture'), /incomplete/);
    assert.equal(calls[0][0], 'invalidate'); assert.deepEqual(calls[1][1], { campaignId: campaign.id, useSavedOverview: true });
    results.push({ case: 'Post-source shared recompute: ' + label, acceptsComplete: succeeds, alignmentInvalidatedBeforeJobs: true });
  }
  fs.writeFileSync('docs/audits/v1-2026-10-19/final-boundary-reproductions.json', JSON.stringify({
    head: '777aae6f6353e998d60b635d3e66b413093117c2', at: new Date().toISOString(),
    boundary: 'Exact handlers/access/recompute helpers and actual schema. Fixture identities/storage/worker results; no database/provider/network/email. Child-storage filtering is asserted as a call contract, not simulated SQL enforcement. Recompute rejection does not imply callers return failure, background retries survive restart or every consumer withholds stale data.',
    results,
  }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: results.length, passed: results.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
