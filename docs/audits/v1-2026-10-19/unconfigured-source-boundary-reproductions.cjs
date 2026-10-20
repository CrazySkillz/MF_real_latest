// Audit-only boundary fixtures. No application startup, live database or provider calls.
const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const out = 'docs/audits/v1-2026-10-19/';
const sf = ts.createSourceFile('routes.ts', fs.readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const names = new Map(), routes = new Map();
function visit(n) {
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && !names.has(n.name.text)) names.set(n.name.text, `const ${n.getText(sf)};`);
  if (ts.isFunctionDeclaration(n) && n.name && !names.has(n.name.text)) names.set(n.name.text, n.getText(sf));
  if (ts.isCallExpression(n) && n.expression.getText(sf) === 'app.post' && ts.isStringLiteral(n.arguments[0])) routes.set(n.arguments[0].text, n.getText(sf));
  ts.forEachChild(n, visit);
} visit(sf);
const quiet = { log() {}, warn() {}, error() {} };
function bind(code, name, env) { return new Function(...Object.keys(env), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText + `\nreturn ${name};`)(...Object.values(env)); }
function scheduler(file, storage) {
  const exports = {};
  const env = { exports, console: quiet, process: { env: { NODE_ENV: 'production', ALLOW_MOCK_DATA: 'false', META_TEST_MODE: 'false', LINKEDIN_TEST_MODE: 'false' } }, require: name => {
    if (name === './storage') return { storage };
    if (name === './db') return { db: { select: () => ({ from: async () => [] }) } };
    if (name === '../shared/schema') return { instagramConnections: {}, tiktokConnections: {} };
    throw Error(`Unexpected scheduler import ${name}`);
  } };
  bind(fs.readFileSync(file, 'utf8'), 'undefined', env); return exports;
}
(async () => {
  const results = [];
  const campaignId = '11111111-1111-4111-8111-111111111111';
  for (const platform of ['meta', 'instagram', 'tiktok']) {
    for (const scenario of ['owner', 'anonymous', 'foreign', 'missing-parent']) {
      const events = [], state = { connection: null, instagramRows: [], tiktokRows: [] };
      const campaign = scenario === 'missing-parent' ? null : { id: campaignId, ownerId: 'owner', status: 'active', platforms: ['google-analytics'] };
      const storage = { getCampaign: async () => campaign };
      for (const kind of ['Meta', 'Instagram', 'TikTok']) {
        storage[`delete${kind}Connection`] = async () => { events.push('delete-connection'); return true; };
        storage[`create${kind}Connection`] = async row => { state.connection = row; events.push('create-connection'); return row; };
        storage[`update${kind}Connection`] = async () => { events.push('update-connection'); return true; };
      }
      storage.upsertInstagramDailyMetrics = async rows => { state.instagramRows = rows; events.push('write-instagram-metrics'); return { upserted: rows.length }; };
      storage.upsertTikTokDailyMetrics = async rows => { state.tiktokRows = rows; events.push('write-tiktok-metrics'); return { upserted: rows.length }; };
      const env = { storage, console: quiet, process: { env: { NODE_ENV: 'production', ALLOW_MOCK_DATA: 'false', META_TEST_MODE: 'false', LINKEDIN_TEST_MODE: 'false' } }, z: require('zod').z,
        getAuth: () => ({ userId: scenario === 'anonymous' ? null : scenario === 'foreign' ? 'other-owner' : 'owner' }), isInternalAutoRefreshRequest: () => false,
        require: name => { if (name === './meta-scheduler') return { generateMockMetaData: async () => { events.push('dispatch-meta-generator'); } }; throw Error(`Unexpected route import ${name}`); } };
      for (const name of ['campaignIdSchema', 'getActorId', 'ensureCampaignAccess', 'yesterdayUTC']) { assert.ok(names.has(name), name); env[name] = bind(names.get(name), name, env); }
      let handler; const route = `/api/${platform}/:campaignId/connect-test`;
      bind(routes.get(route), 'undefined', { ...env, app: { post: (_path, fn) => { handler = fn; } } });
      const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      await handler({ params: { campaignId }, body: { selectedCampaignIds: ['audit-selected-source'] } }, res);
      const expected = scenario === 'owner' ? 200 : scenario === 'anonymous' ? 401 : 404;
      assert.equal(res.code, expected, `${platform}/${scenario}`);
      if (scenario !== 'owner') assert.deepEqual(events, []);
      else {
        assert.equal(state.connection.method, 'test_mode');
        assert.equal(state.connection.campaignId, campaignId);
        if (platform === 'meta') assert.equal(events.filter(e => e === 'dispatch-meta-generator').length, 30);
        if (platform === 'instagram') { assert.equal(state.instagramRows.length, 1); assert.equal(state.instagramRows[0].impressions, 2500); }
        if (platform === 'tiktok') {
          const currentScheduler = scheduler('server/tiktok-scheduler.ts', storage);
          const refreshed = await currentScheduler.refreshTikTokForCampaign(campaignId, state.connection);
          assert.equal(refreshed.refreshed, true); assert.equal(state.tiktokRows.length, 1); assert.equal(state.tiktokRows[0].isSimulated, true);
        }
      }
      results.push({ case: `${platform} connect-test: ${scenario}`, status: res.code, events, method: state.connection?.method ?? null,
        generatedInstagramRows: state.instagramRows.length, generatedTikTokRows: state.tiktokRows.length,
        boundary: platform === 'meta' ? 'Actual route dispatches generator30 times; generator itself stubbed. Access/connection storage fixtures; no real data write.' : platform === 'tiktok' && scenario === 'owner' ? 'Actual route plus actual TikTok refresh function create simulated row with fixture storage; no live job/provider.' : 'Actual route and actual campaign owner helper; synthetic identity/storage, no middleware/browser/provider certificate.' });
    }
  }
  for (const platform of ['instagram', 'tiktok']) {
    const currentScheduler = scheduler(`server/${platform}-scheduler.ts`, { getInstagramConnection: async () => null, getTikTokConnection: async () => null });
    const fn = platform === 'instagram' ? currentScheduler.refreshInstagramForCampaign : currentScheduler.refreshTikTokForCampaign;
    const result = await fn(campaignId); assert.equal(result.refreshed, false); assert.equal(result.reason, 'missing_connection');
    results.push({ case: `${platform}: no stored connection skips refresh`, result, boundary: 'Positive actual-function control; production connection inventory is unknown.' });
  }
  fs.writeFileSync(out + 'unconfigured-source-boundary-reproductions.json', JSON.stringify({ head: '777aae6f6353e998d60b635d3e66b413093117c2', executedAt: new Date().toISOString(), boundary: 'Safe-exclusion audit only. Actual handlers/access helpers and selected scheduler functions with fixture storage, production environment object and mock flags false; no credentials. No live campaign, network, database, email or runtime change.', results }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: results.length, passed: results.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
