// Audit-only exact-handler execution. All identities, credentials and providers are synthetic.
const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const out = 'docs/fixes/v1-batch-1/';
const source = ts.createSourceFile('routes.ts', fs.readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const named = new Map(), routes = new Map();
function visit(n) {
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && !named.has(n.name.text)) named.set(n.name.text, `const ${n.getText(source)};`);
  if (ts.isFunctionDeclaration(n) && n.name && !named.has(n.name.text)) named.set(n.name.text, n.getText(source));
  if (ts.isCallExpression(n) && n.expression.getText(source) === 'app.post' && ts.isStringLiteral(n.arguments[0])) routes.set(n.arguments[0].text, n.getText(source));
  ts.forEachChild(n, visit);
}
visit(source);
function bind(code, name, env) {
  assert.ok(code, name);
  return new Function(...Object.keys(env), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText + `\nreturn ${name};`)(...Object.values(env));
}
function helper(stem, name, env) {
  const sf = ts.createSourceFile(stem, fs.readFileSync(`server/utils/${stem}-service-account.ts`, 'utf8'), ts.ScriptTarget.Latest, true);
  let code;
  for (const n of sf.statements) {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) code = n.getText(sf).replace(/^export\s+/, '');
    if (ts.isVariableStatement(n)) for (const d of n.declarationList.declarations) if (d.name.getText(sf) === name) code = `const ${d.getText(sf)};`;
  }
  return bind(code, name, env);
}
async function execute(family, scenario) {
  const requests = [], writes = [], owner = scenario === 'other-tenant-own-campaign' ? 'tenant-b' : 'tenant-a';
  const campaignId = `${owner}-campaign`;
  const actorId = scenario === 'anonymous' ? null : scenario === 'foreign-campaign' ? 'tenant-b' : owner;
  const resource = family === 'ga4' ? '123456789' : family === 'ads' ? '1234567890' : 'shared_fixture_sheet_123';
  const storage = {
    assertServiceAccountResourceAccess: async (id, provider, resourceId) => {
      assert.equal(id, campaignId); assert.equal(resourceId, resource);
      assert.equal(provider, family === 'ads' ? 'google_ads' : family === 'sheets' ? 'google_sheets' : 'ga4');
      if (scenario === 'other-tenant-own-campaign') throw Object.assign(new Error('Not approved for this customer'), { code: 'SERVICE_ACCOUNT_RESOURCE_NOT_GRANTED' });
    },
    getCampaign: async id => ({ id, ownerId: owner, currency: 'EUR', reportingTimeZone: 'Europe/Amsterdam', startDate: '2026-10-01' }),
    getGA4Connections: async () => [],
    createGA4Connection: async data => { writes.push({ method: 'createGA4Connection', campaignId: data.campaignId, resourceId: data.propertyId }); return { ...data, id: 'new-connection' }; },
    setPrimaryGA4Connection: async () => {},
    getGoogleSheetsConnections: async () => [],
    createGoogleSheetsConnection: async data => { writes.push({ method: 'createGoogleSheetsConnection', campaignId: data.campaignId, pending: data.spreadsheetId === 'pending' }); return data; },
    getGA4GoogleAdsSpendConnection: async () => null,
    getSpendSources: async () => [],
    replaceGA4GoogleAdsSpendConnection: async (data, metrics) => { writes.push({ method: 'replaceGA4GoogleAdsSpendConnection', campaignId: data.campaignId, resourceId: data.customerId, metricRows: metrics.length }); return data; },
  };
  const config = { email: 'reader@example.invalid', privateKey: 'AUDIT_SYNTHETIC_NOT_A_KEY', allowedPropertyIds: new Set(['123456789']), allowedCustomerIds: new Set(['1234567890']) };
  const env = {
    storage, z: require('zod').z, getAuth: () => ({ userId: actorId }), isInternalAutoRefreshRequest: () => false,
    console: { log() {}, warn() {}, error() {} }, process: { env: { NODE_ENV: 'production', GOOGLE_ADS_DEVELOPER_TOKEN: 'AUDIT_SYNTHETIC_TOKEN' } },
    oauthRateLimiter: (_q, _s, next) => next(), googleSheetsRateLimiter: (_q, _s, next) => next(),
    GA4_SERVICE_ACCOUNT_METHOD: 'service_account', GOOGLE_SHEETS_SERVICE_ACCOUNT_METHOD: 'service_account', GOOGLE_ADS_SERVICE_ACCOUNT_METHOD: 'service_account',
    getGA4ServiceAccountConfig: () => config, getGoogleAdsServiceAccountConfig: () => config, getGoogleSheetsServiceAccountConfig: () => config,
    getGA4ServiceAccountAccessToken: async () => ({ accessToken: 'AUDIT_SYNTHETIC_TOKEN' }),
    getGoogleSheetsServiceAccountAccessToken: async () => ({ accessToken: 'AUDIT_SYNTHETIC_TOKEN', expiresAt: new Date('2099-01-01') }),
    getGoogleAdsServiceAccountAccessToken: async () => ({ accessToken: 'AUDIT_SYNTHETIC_TOKEN' }),
    getGoogleAdsServiceAccountLoginCustomerId: () => null,
    getGA4HistoricalImportStartDate: () => '2026-09-19', normalizeReportingTimeZone: value => value,
    getReportingDateWindow: () => ({ endDate: '2026-10-18' }),
    fetch: async url => {
      requests.push({ provider: family, resource });
      if (scenario === 'provider-denied') return { ok: false, status: 403 };
      return { ok: true, status: 200, json: async () => ({ spreadsheetId: resource, properties: { title: 'Tenant A private sheet' }, sheets: [{ properties: { sheetId: 0, title: 'Private revenue', index: 0, sheetType: 'GRID' } }] }) };
    },
    require: name => {
      assert.equal(name, './googleAdsClient');
      return {
        GoogleAdsClient: class {
          constructor(options) { assert.equal(options.customerId, resource); }
          async getCustomerAccount() { requests.push({ provider: family, resource }); if (scenario === 'provider-denied') throw { response: { status: 403 } }; return { id: resource, currencyCode: 'EUR', timeZone: 'Europe/Amsterdam', descriptiveName: 'Tenant A account' }; }
          async getDailyMetrics() { return [{ date: '2026-10-18', cost: 100 }]; }
        },
        mapGoogleAdsDailyInsights: (id, rows) => rows.map(row => ({ ...row, campaignId: id })),
      };
    },
  };
  for (const [stem, names] of [
    ['ga4', ['normalizeGA4ServiceAccountPropertyId', 'assertGA4ServiceAccountPropertyAllowed']],
    ['google-ads', ['normalizeGoogleAdsCustomerId', 'assertGoogleAdsServiceAccountCustomerAllowed']],
    ['google-sheets', ['normalizeGoogleSheetsSpreadsheetId', 'getGoogleSheetsServiceAccountPublicStatus']],
  ]) for (const name of names) env[name] = helper(stem, name, env);
  for (const name of ['campaignIdSchema', 'getActorId', 'ensureCampaignAccess', 'requireCampaignAccessParamId']) env[name] = bind(named.get(name), name, env);
  const path = `/api/campaigns/:id/${family === 'ga4' ? 'ga4' : family === 'ads' ? 'google-ads' : 'google-sheets'}-service-account/connect`;
  let handlers;
  bind(routes.get(path), 'undefined', { ...env, app: { post(_path, ...h) { handlers = h; } } });
  const req = { params: { id: campaignId }, body: { lookbackDays: 30, propertyId: resource, customerId: resource, spreadsheetId: resource, purpose: 'revenue' } };
  const res = { statusCode: 200, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } };
  const next = async (i = 0) => { if (i < handlers.length) await handlers[i](req, res, () => next(i + 1)); };
  await next();
  const denied = ['anonymous', 'foreign-campaign', 'provider-denied', 'other-tenant-own-campaign'].includes(scenario);
  assert.equal(res.statusCode, scenario === 'anonymous' ? 401 : scenario === 'foreign-campaign' ? 404 : denied ? 403 : 200, `${family}: ${scenario}`);
  assert.equal(writes.length, denied ? 0 : 1);
  if (['anonymous', 'foreign-campaign', 'other-tenant-own-campaign'].includes(scenario)) assert.equal(requests.length, 0);
  else assert.equal(requests.length, 1);
  if (family === 'sheets' && !denied) assert.equal(res.body.spreadsheet.name, 'Tenant A private sheet');
  return { case: `${family}: ${scenario}`, status: res.statusCode, actor: actorId, campaignOwner: owner, providerRequests: requests, writes, sharedResourceAccepted: !denied, sheetMetadataReturned: family === 'sheets' && !denied };
}
(async () => {
  const results = [];
  for (const family of ['ga4', 'sheets', 'ads']) for (const scenario of ['original-tenant-own-campaign', 'other-tenant-own-campaign', 'anonymous', 'foreign-campaign', 'provider-denied']) results.push(await execute(family, scenario));
  fs.writeFileSync(out + 'service-accounts-after.json', JSON.stringify({
    base: '777aae6f6353e998d60b635d3e66b413093117c2', revision: 'uncommitted Batch 1', executedAt: new Date().toISOString(),
    boundary: 'Exact current connect registrations, actor/campaign middleware and resource validators. Storage grant decision is synthetic here and independently exercised with real PostgreSQL in postgres-after.json. Unrelated owner denial precedes provider dispatch and persistence; granted owner and provider denial controls retained. No real provider, credentials or application data.',
    results,
  }, null, 2) + '\n');
  console.log(`${results.length} isolated service-account tenant cases passed`);
})().catch(error => { console.error(error); process.exitCode = 1; });
