// Real Axios error construction and exact current Google Ads client/route; no network.
const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict'), util = require('node:util'), axios = require('axios');
const out = 'docs/audits/v1-2026-10-19/';
const transpile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sf = ts.createSourceFile('routes.ts', fs.readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
let registration;
function walk(n) {
  if (ts.isCallExpression(n) && n.expression.getText(sf) === 'app.post' && n.arguments[0]?.text === '/api/google-ads/:campaignId/refresh') registration = n.getText(sf);
  ts.forEachChild(n, walk);
}
walk(sf); assert.ok(registration);
async function execute(denied, providerRejects) {
  const logs = [], calls = [];
  const exports = {};
  const fixtureAxios = { ...axios, create: config => axios.create({ ...config, adapter: async request => {
    calls.push({ path: request.url, authorizationPresent: !!request.headers.Authorization });
    if (providerRejects) throw new axios.AxiosError('Synthetic provider failure', 'ERR_BAD_RESPONSE', request, undefined, { status: 403, statusText: 'Forbidden', data: { error: 'Synthetic denied' }, headers: {}, config: request });
    return { status: 200, data: [{ results: [{ customer: { id: '1234567890', descriptiveName: 'Fixture', currencyCode: 'EUR', timeZone: 'UTC', manager: false } }] }], headers: {}, config: request };
  } }) };
  new Function('require', 'exports', transpile(fs.readFileSync('server/googleAdsClient.ts', 'utf8')))(name => { assert.equal(name, 'axios'); return { default: fixtureAxios }; }, exports);
  const provider = new exports.GoogleAdsClient({ accessToken: 'AUDIT_FAKE_BEARER_MARKER', developerToken: 'AUDIT_FAKE_DEVELOPER_MARKER', customerId: '1234567890' });
  let handler;
  const env = {
    app: { post: (_path, h) => { handler = h; } },
    ensureCampaignAccess: async (_req, res) => { if (denied) { res.status(404).json({ error: 'Campaign not found' }); return null; } return { id: 'fixture' }; },
    storage: { getGoogleAdsConnection: async () => ({ campaignId: 'fixture', method: 'oauth' }) },
    require: name => { assert.equal(name, './google-ads-scheduler'); return { refreshGoogleAdsForCampaign: async () => { await provider.getCustomerAccount(); return { providerRefreshed: true }; } }; },
    console: { error: (...args) => logs.push(util.format(...args)) },
  };
  new Function(...Object.keys(env), transpile(registration))(...Object.values(env));
  const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  await handler({ params: { campaignId: 'fixture' }, query: {} }, res);
  const text = logs.join('\n');
  const exposed = { accessToken: text.includes('AUDIT_FAKE_BEARER_MARKER'), developerToken: text.includes('AUDIT_FAKE_DEVELOPER_MARKER') };
  assert.equal(res.statusCode, denied ? 404 : providerRejects ? 500 : 200);
  assert.equal(exposed.accessToken, !denied && providerRejects);
  assert.equal(exposed.developerToken, !denied && providerRejects);
  assert.ok(!JSON.stringify(res.body).includes('AUDIT_FAKE_'));
  return { case: denied ? 'Denied campaign stops before provider/log' : providerRejects ? 'Provider Axios error logs bearer and developer token' : 'Successful provider fixture logs no credentials', status: res.statusCode, requests: calls.length, credentialMarkersInLogs: exposed, credentialMarkersInResponse: false };
}
(async () => {
  const results = [await execute(false, true), await execute(true, true), await execute(false, false)];
  fs.writeFileSync(out + 'provider-error-log-reproductions.json', JSON.stringify({
    head: '777aae6f6353e998d60b635d3e66b413093117c2', at: new Date().toISOString(),
    boundary: 'Exact GoogleAdsClient code with real Axios and a rejecting in-memory adapter; exact refresh route catch. Scheduler dependency is replaced by the actual client account read; code trace confirms ordinary scheduler lets that error propagate. Access/storage are fixtures. No real credentials, provider, DB, email or production log read.',
    results,
  }, null, 2) + '\n');
  console.log(`${results.length} provider-error credential-log cases passed`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
