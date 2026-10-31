// Runs the current storage grant policy against a caller-supplied PostgreSQL client.
// Every synthetic row is uncommitted and is rolled back, including on failure.
const fs = require('node:fs'), ts = require('typescript'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { drizzle } = require('drizzle-orm/node-postgres'), orm = require('drizzle-orm');
const compile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function loadPolicy(client, environment) {
  const schema = {};
  new Function('exports', 'require', compile(fs.readFileSync('shared/schema.ts', 'utf8')))(schema, require);
  const sf = ts.createSourceFile('storage.ts', fs.readFileSync('server/storage.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  let method;
  const visit = n => { if (ts.isMethodDeclaration(n) && n.name.getText(sf) === 'assertServiceAccountResourceAccess') { assert.equal(method, undefined); method = n.getText(sf); } ts.forEachChild(n, visit); };
  visit(sf); assert.ok(method);
  const env = { ...schema, ...orm, db: drizzle(client), process: { env: environment } };
  return new Function(...Object.keys(env), compile(`class Policy { ${method} }; return new Policy();`))(...Object.values(env));
}
function loadHydrator(provider, storage, issued, resource) {
  const names = { ga4: ['ga4', 'GA4'], google_sheets: ['google-sheets', 'GoogleSheets'], google_ads: ['google-ads', 'GoogleAds'] };
  const [file, name] = names[provider], sf = ts.createSourceFile(file, fs.readFileSync(`server/utils/${file}-service-account.ts`, 'utf8'), ts.ScriptTarget.Latest, true);
  const declaration = sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === `hydrate${name}ServiceAccountConnection`);
  assert.ok(declaration);
  const env = {
    require: requested => { assert.equal(requested, '../storage'); return { storage }; },
    [`${provider.toUpperCase()}_SERVICE_ACCOUNT_METHOD`]: 'service_account',
    assertGA4ServiceAccountPropertyAllowed: value => assert.equal(value, resource),
    normalizeGA4ServiceAccountPropertyId: value => value,
    assertGoogleAdsServiceAccountCustomerAllowed: value => assert.equal(value, resource),
    normalizeGoogleAdsCustomerId: value => value,
    getGoogleAdsServiceAccountLoginCustomerId: () => null,
    [`get${name}ServiceAccountAccessToken`]: async () => { issued.count++; return { accessToken: 'synthetic-never-a-provider-token', expiresAt: new Date('2099-01-01') }; },
  };
  // Configuration allowlists and token issuance are synthetic; grant reads are real.
  return new Function(...Object.keys(env), compile(declaration.getText(sf).replace(/^export\s+/, '')) + `\nreturn hydrate${name}ServiceAccountConnection;`)(...Object.values(env));
}
async function run(client, observer, { failAfterSeed = false, environment = {} } = {}) {
  const ids = { a: crypto.randomUUID(), b: crypto.randomUUID(), clientA: crypto.randomUUID(), clientB: crypto.randomUUID() };
  const ownerA = `b1_grant_${crypto.randomUUID()}`, ownerB = `b1_grant_${crypto.randomUUID()}`;
  const env = { ...environment }, checks = [], issued = { count: 0 };
  const storage = loadPolicy(client, env);
  const check = async (name, fn) => { await fn(); checks.push({ check: name, passed: true }); };
  const denied = fn => assert.rejects(fn, error => error?.code === 'SERVICE_ACCOUNT_RESOURCE_NOT_GRANTED');
  const absence = async db => {
    assert.equal((await db.query('SELECT id FROM clients WHERE id=ANY($1::text[])', [[ids.clientA, ids.clientB]])).rowCount, 0);
    assert.equal((await db.query('SELECT id FROM campaigns WHERE id=ANY($1::text[])', [[ids.a, ids.b]])).rowCount, 0);
    assert.equal((await db.query('SELECT id FROM service_account_resource_grants WHERE client_id=ANY($1::text[])', [[ids.clientA, ids.clientB]])).rowCount, 0);
  };
  let originalError;
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  try {
    await client.query("SET LOCAL lock_timeout='3s'"); await client.query("SET LOCAL statement_timeout='15s'"); await client.query("SET LOCAL idle_in_transaction_session_timeout='30s'");
    await absence(client);
    await client.query('INSERT INTO clients(id,owner_id,name) VALUES($1,$2,$3),($4,$5,$3)', [ids.clientA, ownerA, 'B1_GRANT_ROLLBACK_ONLY', ids.clientB, ownerB]);
    await client.query("INSERT INTO campaigns(id,owner_id,client_id,name,platform,status,currency) VALUES($1,$2,$3,'B1_GRANT_ROLLBACK_ONLY','custom','draft','EUR'),($4,$5,$6,'B1_GRANT_ROLLBACK_ONLY','custom','draft','EUR')", [ids.a, ownerA, ids.clientA, ids.b, ownerB, ids.clientB]);
    if (failAfterSeed) throw Object.assign(Error('INJECTED_AFTER_SEED'), { code: 'INJECTED_AFTER_SEED' });
    await check('other connections cannot see temporary campaigns', () => absence(observer));
    for (const provider of ['ga4', 'google_sheets', 'google_ads']) {
      const resource = provider === 'ga4' ? '991234567' : provider === 'google_ads' ? '9912345678' : 'B1_GRANT_SYNTHETIC_RESOURCE';
      const connection = { id: crypto.randomUUID(), campaignId: ids.a, method: 'service_account', propertyId: resource, spreadsheetId: resource, customerId: resource, accessToken: 'previous-synthetic-token' };
      const hydrate = loadHydrator(provider, storage, issued, resource), startCalls = issued.count;
      await check(`${provider}: denied before token issuance without a grant`, async () => { await denied(() => hydrate(connection)); assert.equal(issued.count, startCalls); });
      const inserted = await client.query('INSERT INTO service_account_resource_grants(owner_id,client_id,provider,resource_id) VALUES($1,$2,$3,$4) RETURNING id', [ownerA, ids.clientA, provider, resource]);
      assert.equal(inserted.rowCount, 1);
      await check(`${provider}: exact granted resource accepted`, async () => { const row = await hydrate(connection); assert.equal(row.accessToken, 'synthetic-never-a-provider-token'); assert.equal(issued.count, startCalls + 1); });
      await check(`${provider}: wrong owner and resource denied`, async () => { await denied(() => storage.assertServiceAccountResourceAccess(ids.b, provider, resource)); await denied(() => storage.assertServiceAccountResourceAccess(ids.a, provider, resource + '_different')); });
      await check(`${provider}: revoked database grant denies even with cached token`, async () => {
        assert.equal((await client.query('DELETE FROM service_account_resource_grants WHERE id=$1 AND client_id=$2', [inserted.rows[0].id, ids.clientA])).rowCount, 1);
        await denied(() => hydrate(connection)); assert.equal(issued.count, startCalls + 1);
      });
      await check(`${provider}: restarted policy observes revocation`, () => denied(() => loadPolicy(client, env).assertServiceAccountResourceAccess(ids.a, provider, resource)));
      await check(`${provider}: separately configured environment grant and revocation`, async () => {
        const original = env.SERVICE_ACCOUNT_RESOURCE_GRANTS;
        try {
          env.SERVICE_ACCOUNT_RESOURCE_GRANTS = JSON.stringify([{ ownerId: ownerA, clientId: ids.clientA, provider, resourceId: resource }]);
          await storage.assertServiceAccountResourceAccess(ids.a, provider, resource);
          env.SERVICE_ACCOUNT_RESOURCE_GRANTS = '[]'; await denied(() => hydrate(connection)); assert.equal(issued.count, startCalls + 1);
        } finally { if (original === undefined) delete env.SERVICE_ACCOUNT_RESOURCE_GRANTS; else env.SERVICE_ACCOUNT_RESOURCE_GRANTS = original; }
      });
    }
    await check('no temporary grant became visible to another connection', () => absence(observer));
  } catch (error) { originalError = error; }
  finally { await client.query('ROLLBACK'); }
  await check('fresh independent read confirms no temporary rows remain', () => absence(observer));
  if (originalError) throw originalError;
  return { result: 'PASS', checks, committedRows: 0, realProviderCalls: 0, applicationStartup: false, limits: 'Current source grant policy and credential-hydration functions with real PostgreSQL grant reads. Allowlists and token issuance are synthetic. This is not an HTTP request or a real scheduler/provider run.' };
}
module.exports = { run };
