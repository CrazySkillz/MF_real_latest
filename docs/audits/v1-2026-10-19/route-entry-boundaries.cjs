// Audit-only anonymous-entry probe. Never imports the running application or its database.
const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const dir = 'docs/audits/v1-2026-10-19/', inventory = JSON.parse(fs.readFileSync(dir + 'inventory.json', 'utf8'));
const sf = ts.createSourceFile('routes.ts', fs.readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const named = new Map(), registrations = new Map();
function visit(n) {
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && !named.has(n.name.text)) named.set(n.name.text, `const ${n.getText(sf)};`);
  if (ts.isFunctionDeclaration(n) && n.name && !named.has(n.name.text)) named.set(n.name.text, n.getText(sf));
  if (ts.isCallExpression(n) && /^app\.(get|post|put|patch|delete)$/.test(n.expression.getText(sf)))
    registrations.set(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, n.getText(sf));
  ts.forEachChild(n, visit);
}
visit(sf);
// The route-local parseNum shadows several earlier parser-local functions.
const register = sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'registerRoutes');
for (const statement of register.body.statements) if (ts.isVariableStatement(statement)) for (const decl of statement.declarationList.declarations) {
  if (ts.isIdentifier(decl.name)) named.set(decl.name.text, `const ${decl.getText(sf)};`);
}
function bind(code, name, env) {
  assert.ok(code, name);
  return new Function(...Object.keys(env), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText + `\nreturn ${name};`)(...Object.values(env));
}
const helpers = ['campaignIdSchema', 'sessionIdSchema', 'getActorId', 'getSessionId', 'ensureCampaignAccess', 'requireCampaignAccessParamId', 'requireCampaignAccessCampaignIdParam', 'requireCampaignAccessBodyCampaignId', 'requireCampaignAccessQueryCampaignId', 'ensureLinkedInSessionAccess', 'ensureKpiAccess', 'ensureBenchmarkAccess', 'ensurePlatformReportAccess', 'normalizePropertyIdForMock', 'isYesopMockProperty', 'parsePlatformContext', 'parseRevenueReadPlatformContext', 'parseOptionalSpendPlatformContext', 'getDateRangeBounds', 'parseNum', 'isCampaignKPIPlatformType', 'isCampaignBenchmarkPlatformType'];
async function runRoute(row) {
  const effects = [], errors = [], middlewareReached = [], lookupReads = [], moduleFixtures = [], uuid = '11111111-1111-4111-8111-111111111111';
  const trap = (name) => async () => { effects.push(name); throw new Error(`AUDIT_FORBIDDEN_EFFECT:${name}`); };
  const pass = (name) => (_req, _res, next) => { middlewareReached.push(name); return next(); };
  const fixtureRow = { id: uuid, campaignId: uuid, platformType: 'meta', platform: 'meta' };
  const allowedLookups = new Set(['getKPI', 'getMetaBenchmarkById', 'getMetaReportById', 'getCustomIntegrationById']);
  const db = { select: () => ({ from: () => ({ where: async () => { lookupReads.push('db.notification-id-lookup'); return [fixtureRow]; } }) }) };
  const env = {
    z: require('zod').z, getAuth: () => ({ userId: null, sessionId: null }), isInternalAutoRefreshRequest: () => false,
    process: { env: { NODE_ENV: 'production' } }, console: { log() {}, warn() {}, error(...args) { errors.push(args.map(String).join(' ')); } }, devLog() {},
    storage: new Proxy({}, { get: (_, name) => allowedLookups.has(name) ? async () => { lookupReads.push(`storage.${name}`); return fixtureRow; } : trap(`storage.${String(name)}`) }), fetch: trap('fetch'), Buffer, URL, URLSearchParams,
    require(name) {
      moduleFixtures.push(name);
      if (name === './db') return { db };
      if (name === '../shared/schema') return { notifications: { id: 'fixture-notification-column' } };
      if (name === 'drizzle-orm') return { eq: () => 'fixture-id-predicate' };
      if (name === './utils/executive-summary-helpers') return {};
      throw new Error(`Unexpected module load: ${name}`);
    },
    GA4_KPI_ACTIVE_METRIC_CONFLICT: 'GA4_KPI_ACTIVE_METRIC_CONFLICT', GA4_KPI_INVALID_CONFIGURATION: 'GA4_KPI_INVALID_CONFIGURATION',
    oauthRateLimiter: pass('oauthRateLimiter'), importRateLimiter: pass('importRateLimiter'),
    googleSheetsRateLimiter: pass('googleSheetsRateLimiter'), linkedInApiRateLimiter: pass('linkedInApiRateLimiter'),
    uploadRevenueCsv: pass('uploadRevenueCsv'), uploadCsv: { single: () => pass('uploadCsv.single') },
    upload: { single: () => pass('upload.single'), any: () => pass('upload.any') },
  };
  for (const name of helpers) env[name] = bind(named.get(name), name, env);
  const shopSf = ts.createSourceFile('shop.ts', fs.readFileSync('server/utils/shopify-provider.ts','utf8'),99,true);
  const shopHelper = shopSf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'normalizeShopifyDomain');
  const shopPattern = shopSf.statements.filter(ts.isVariableStatement).flatMap(s=>[...s.declarationList.declarations]).find(n=>n.name.getText(shopSf)==='SHOPIFY_HOST_PATTERN');
  env.normalizeShopifyDomain = bind(`const ${shopPattern.getText(shopSf)};\n` + shopHelper.getText(shopSf).replace(/^export\s+/,''), 'normalizeShopifyDomain', {});
  let middleware;
  const app = Object.fromEntries(['get', 'post', 'put', 'patch', 'delete'].map(method => [method, (_path, ...handlers) => { middleware = handlers; }]));
  const req = {
    params: Object.fromEntries([...row.path.matchAll(/:([A-Za-z0-9_]+)/g)].map(m => [m[1], uuid])),
    query: { campaignId: uuid, readOnly: '1', platform: 'ga4', startDate: '2026-10-01', endDate: '2026-10-19' },
    body: { campaignId: uuid, clientId: uuid, sourceId: uuid, name: 'Synthetic fixture', platform: 'ga4', propertyId: '123', authCode: 'fixture-code', clientSecret: 'fixture-secret', redirectUri: 'https://example.invalid', adAccountId: 'fixture-account', adAccountName: 'Fixture account', campaigns: [], email: 'fixture@example.invalid', fromCampaignId: uuid, toCampaignId: uuid, shopDomain: 'fixture.myshopify.com', accessToken: 'fixture-token' },
    headers: {}, socket: { remoteAddress: '198.51.100.1' }, get: () => undefined, protocol: 'https', path: row.path,
  };
  if (req.params.platformType) req.params.platformType = 'ga4';
  if ([27540,27568].includes(row.line)) { req.body.platform = 'meta'; req.query.platform = 'meta'; }
  const res = { statusCode: 200, status(v) { this.statusCode = v; return this; }, json(v) { this.payload = v; return this; }, send(v) { this.payload = v; return this; }, end() { return this; }, setHeader() {}, type() { return this; }, redirect(...args) { this.statusCode = typeof args[0] === 'number' ? args[0] : 302; this.payload = args.at(-1); return this; } };
  let exception;
  try {
    bind(registrations.get(row.line), 'undefined', { ...env, app });
    async function next(i = 0) { if (i < middleware.length) await middleware[i](req, res, () => next(i + 1)); }
    await next();
  } catch (error) { exception = String(error); }
  const result = { method: row.method, path: row.path, file: row.file, line: row.line, status: res.statusCode, effects, lookupReads, moduleFixtures, middlewareReached };
  if (exception) result.exception = exception;
  if (errors.length) result.errors = errors;
  result.classification = effects.length ? 'PRE_AUTH_EFFECT_ATTEMPT' : exception || /not defined|not a function/.test(errors.join(' ') + JSON.stringify(res.payload)) ? 'HARNESS_BINDING_OR_RUNTIME_ERROR' : [401,403].includes(res.statusCode) ? 'ANONYMOUS_DENIED' : res.statusCode === 400 ? 'INPUT_REJECTED_BEFORE_AUTH_PROOF' : res.statusCode === 404 ? 'NOT_FOUND_REQUIRES_STATIC_CLASSIFICATION' : 'RESPONSE_REQUIRES_STATIC_CLASSIFICATION';
  if (result.classification !== 'ANONYMOUS_DENIED') result.response = res.payload;
  if (row.line === 24420 && res.statusCode === 404 && !effects.length) result.classification = 'PRODUCTION_ONLY_TEST_ROUTE_DISABLED';
  return result;
}
async function main() {
  const marked = inventory.routes.filter(r => r.method !== 'USE' && r.guardHints.length);
  const rows = marked.filter(r => r.file === 'server/routes-oauth.ts' && !r.path.includes('/callback'));
  const results = [];
  for (const row of rows) results.push(await runRoute(row));
  const excluded = marked.filter(r => !rows.includes(r)).map(r => ({ method: r.method, path: r.path, file: r.file, line: r.line, reason: 'OAuth callback capability/state authentication reviewed separately; not ordinary anonymous-session denial.' }));
  assert.ok(results.every(r => ['ANONYMOUS_DENIED','PRODUCTION_ONLY_TEST_ROUTE_DISABLED'].includes(r.classification)), 'Unresolved entry case; inspect captured diagnostics');
  const packet = { head: inventory.head, at: new Date().toISOString(), boundary: 'Each marked noncallback registration executed separately with actual actor/campaign/child guard helpers and anonymous fixture identity. Rate limiters/upload parsers explicitly passthrough. Ten routes may resolve a synthetic child ID before denial; lookupReads records those reads. Notification DB and executive helper module namespace are explicit fixtures. All other storage/network effects throw. A 401 proves only this input reaches denial, not all branches, route-overlap precedence, authenticated tenant/child isolation, CSRF, final-write races or release safety.', markedRegistrations: marked.length, excluded, results };
  fs.writeFileSync(dir + 'route-entry-boundaries.json', JSON.stringify(packet, null, 2) + '\n');
  console.log(JSON.stringify({ probed: results.length, excluded: excluded.length, counts: results.reduce((a,r)=>(a[r.classification]=(a[r.classification]||0)+1,a),{}), followup: results.filter(r => r.classification !== 'ANONYMOUS_DENIED') },null,2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
