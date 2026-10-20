const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const out = 'docs/audits/v1-2026-10-19/';
const sf = ts.createSourceFile('routes.ts', fs.readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const named = new Map(), routes = new Map();
function visit(n) {
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && !named.has(n.name.text)) named.set(n.name.text, `const ${n.getText(sf)};`);
  if (ts.isFunctionDeclaration(n) && n.name && !named.has(n.name.text)) named.set(n.name.text, n.getText(sf));
  if (ts.isCallExpression(n) && n.expression.getText(sf) === 'app.get' && ts.isStringLiteral(n.arguments[0])) routes.set(n.arguments[0].text, n.getText(sf));
  ts.forEachChild(n, visit);
}
visit(sf);
function bind(code, name, env) { return new Function(...Object.keys(env), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText + `\nreturn ${name};`)(...Object.values(env)); }
function publicHelper(file, name, configName) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const n = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(n); return bind(n.getText(source).replace(/^export\s+/, ''), name, { [configName]: () => ({ email: 'reader@example.invalid', privateKey: 'AUDIT_SECRET_PRIVATE_KEY', allowedPropertyIds: new Set(['123']), allowedCustomerIds: new Set(['1234567890']) }) });
}
const serviceHelpers = {};
for (const [base, stem] of [['GA4', 'ga4'], ['GoogleSheets', 'google-sheets'], ['GoogleAds', 'google-ads']]) {
  const name = `get${base}ServiceAccountPublicStatus`;
  serviceHelpers[name] = publicHelper(`server/utils/${stem}-service-account.ts`, name, `get${base}ServiceAccountConfig`);
}
const publicRoutes = [
  '/api/ga4/check-connection/:campaignId', '/api/campaigns/:id/ga4-connections',
  '/api/google-sheets/check-connection/:campaignId', '/api/campaigns/:id/google-sheets-connections',
  '/api/hubspot/:campaignId/status', '/api/salesforce/:campaignId/connection', '/api/salesforce/:campaignId/status',
  '/api/campaigns/:campaignId/meta/connection', '/api/meta/:campaignId/connection',
  '/api/instagram/:campaignId/connection', '/api/tiktok/:campaignId/connection',
  '/api/google-ads/:campaignId/connection', '/api/linkedin/check-connection/:campaignId',
  '/api/shopify/:campaignId/status',
  '/api/campaigns/:id/ga4-service-account/status', '/api/campaigns/:id/google-sheets-service-account/status', '/api/campaigns/:id/google-ads-service-account/status',
];
const customRoutes = ['/api/custom-integration-by-id/:id', '/api/custom-integration/:campaignId'];
const secretMarker = 'AUDIT_SECRET_';
const fixture = {
  id: 'connection', campaignId: 'fixture', propertyId: '123', propertyName: 'Fixture property', lookbackDays: 30,
  isPrimary: true, isActive: true, method: 'oauth', accessToken: secretMarker + 'ACCESS', refreshToken: secretMarker + 'REFRESH', clientSecret: secretMarker + 'CLIENT', encryptedTokens: secretMarker + 'CIPHERTEXT', serviceAccountJson: secretMarker + 'SERVICE_ACCOUNT', privateKey: secretMarker + 'PRIVATE_KEY',
  expiresAt: '2099-01-01T00:00:00Z', connectedAt: '2026-01-01T00:00:00Z', spreadsheetId: 'sheet-fixture', spreadsheetName: 'Fixture', sheetName: 'Exact tab', columnMappings: '{"spend":"Cost"}',
  portalId: 'portal', portalName: 'Fixture portal', orgId: 'org', orgName: 'Fixture org', instanceUrl: 'https://example.invalid', adAccountId: 'account', customerId: 'customer', advertiserId: 'advertiser', selectedCampaignIds: '["selected"]', shopDomain: 'fixture.myshopify.com', shopName: 'Fixture shop', mappingConfig: '{"authType":"oauth","grantedScopesList":["read_orders"]}', webhookToken: 'AUDIT_WEBHOOK_BEARER',
};
function response() { return { statusCode: 200, status(v) { this.statusCode = v; return this; }, json(v) { this.payload = v; return this; } }; }
async function execute(path, scenario) {
  const reads = [], denied = scenario !== 'owner';
  const storage = new Proxy({}, { get(_, method) { return async (...args) => {
    reads.push(String(method));
    if (method === 'getCampaign') return scenario === 'missing-parent' ? null : { id: 'fixture', ownerId: 'owner', startDate: '2026-10-01' };
    if (method === 'getLatestCustomIntegrationMetrics') return null;
    if (method === 'getCustomIntegration' || method === 'getCustomIntegrationById') return { id: 'custom', campaignId: 'fixture', email: 'fixture@example.invalid', webhookToken: 'AUDIT_WEBHOOK_BEARER', allowedEmailAddresses: [], connectedAt: fixture.connectedAt, createdAt: fixture.connectedAt };
    if (String(method).endsWith('Connections')) return [{ ...fixture }];
    if (String(method).startsWith('get')) return { ...fixture };
    throw new Error(`Unexpected mutation ${String(method)}`);
  }; } });
  const env = {
    storage, z: require('zod').z, getAuth: () => ({ userId: scenario === 'anonymous' ? null : scenario === 'foreign' ? 'foreign-owner' : 'owner' }), isInternalAutoRefreshRequest: () => false,
    console: { log() {}, warn() {}, error() {} }, devLog() {}, ...serviceHelpers,
    getShopifyConnectionOrderAccess: () => ({ isOauth: true, scopes: ['read_orders'] }), getShopifyCampaignWindowStartAt: () => new Date('2026-10-01'),
    resolveShopifyCampaignOrderWindow: () => ({ limited: false, campaignStartAt: '2026-10-01', cutoffAt: '2026-10-01', refreshThrough: '2026-10-19', eligible: true }),
    isShopifyOauthAvailable: () => true, SHOPIFY_RECENT_ORDER_WINDOW_DAYS: 59,
    fetch: async () => { throw new Error('Provider requests are forbidden in response fixtures'); },
  };
  for (const name of ['campaignIdSchema', 'getActorId', 'ensureCampaignAccess', 'requireCampaignAccessParamId']) env[name] = bind(named.get(name), name, env);
  let middleware;
  const app = { get: (_path, ...handlers) => { middleware = handlers; } };
  bind(routes.get(path), 'undefined', { ...env, app });
  const req = { params: { id: 'fixture', campaignId: 'fixture' }, query: { readOnly: '1' } }, res = response();
  async function next(i = 0) { if (i < middleware.length) await middleware[i](req, res, () => next(i + 1)); }
  await next();
  const expected = scenario === 'anonymous' ? 401 : denied ? 404 : 200;
  assert.equal(res.statusCode, expected, `${path} ${scenario}`);
  const json = JSON.stringify(res.payload);
  assert.ok(!json.includes(secretMarker), `${path}: private credential returned`);
  if (denied) {
    assert.ok(!json.includes('AUDIT_WEBHOOK_BEARER'));
    assert.ok(reads.every(n => n === 'getCampaign' || (path === customRoutes[0] && n === 'getCustomIntegrationById')), `${path} consulted source before denial`);
  } else if (customRoutes.includes(path)) assert.ok(json.includes('AUDIT_WEBHOOK_BEARER'), 'Custom Integration owner setup requires its bearer token');
  return { case: `${scenario}: ${path}`, status: res.statusCode, privateMarkersReturned: false, ownerWebhookTokenReturned: !denied && customRoutes.includes(path), reads, responseKeys: Object.keys(res.payload || {}) };
}
async function run() {
  const results = [];
  for (const path of [...publicRoutes, ...customRoutes]) for (const scenario of ['owner', 'anonymous', 'foreign', 'missing-parent']) results.push(await execute(path, scenario));
  fs.writeFileSync(out + 'connection-response-reproductions.json', JSON.stringify({ head: '777aae6f6353e998d60b635d3e66b413093117c2', executedAt: new Date().toISOString(), boundary: '19 exact GET registrations with actual campaign/actor validation and registered ID middleware;19 owner plus57 anonymous/foreign/missing-parent cases. Clerk identity/storage/config and Shopify date helper inputs are isolated fixtures. Configured, unexpired connections only; no real credential, provider, DB, full HTTP stack or error-redaction certificate. Custom Integration bearer returned only to authorized owner is expected setup behavior.', auditCorrection: 'Initial common fixture incorrectly added OAuth credential columns to Custom Integration, whose actual schema740 has only the setup bearer. Replaced that fixture with the declared Custom Integration shape before accepting results; no application defect inferred from the artificial fields.', results }, null, 2) + '\n');
  console.log(`${results.length} connection-response/authorization cases executed`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
