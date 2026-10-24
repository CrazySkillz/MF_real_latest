// Read only the exact campaign connection and September 28 test order; never renew credentials or mutate provider/database data.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg'), ts = require('typescript');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const output = `${__dirname}/shopify-tags-order-diagnosis-confirmed.json`;
assert.ok(!fs.existsSync(output));
const result = { at: new Date().toISOString(), campaignName: 'V1 Batch 5 Test', databaseWrites: false, providerWrites: false, oauthRefresh: false };
let db;
(async () => {
  const env = parseEnv(fs.readFileSync('.env', 'utf8')), url = new URL(env.DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  db = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'mf-shopify-order-readonly',
    options: '-c default_transaction_read_only=on', connectionTimeoutMillis: 10000, statement_timeout: 10000,
    query_timeout: 12000, lock_timeout: 2000, idle_in_transaction_session_timeout: 15000 });
  await db.connect(); await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  const campaigns = (await db.query('SELECT id, owner_id IS NOT NULL AS owned FROM campaigns WHERE name=$1', [result.campaignName])).rows;
  assert.equal(campaigns.length, 1); assert.equal(campaigns[0].owned, true);
  assert.equal(hash(campaigns[0].id), 'de4775c3b435c3350ea24f5d538e60e639c9f9cd21de63d5432956b44551e722');
  const connections = (await db.query('SELECT id, shop_domain, access_token, encrypted_tokens, mapping_config FROM shopify_connections WHERE campaign_id=$1 AND is_active=true', [campaigns[0].id])).rows;
  assert.equal(connections.length, 1); const conn = connections[0];
  assert.equal(hash(conn.id), '09bfc6328961896e1717deaac3b8e391f0a1c9ec88eb30a0bf56d17cd2e4d7b9');
  assert.equal(hash(conn.shop_domain), '7cfdfa3442d8f130ac3e6639a6de08de680129569cb1787606cce017bc450934');
  assert.match(conn.shop_domain, /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/);
  const cfg = JSON.parse(conn.mapping_config); assert.equal(cfg.authType, 'oauth');
  assert(Date.parse(cfg.accessTokenExpiresAt) > Date.now());
  await db.query('ROLLBACK'); await db.end(); db = null; result.transactionEnded = 'ROLLBACK';
  const vault = {}, keyEnv = { NODE_ENV: 'production' };
  for (const key of ['TOKEN_ENCRYPTION_KEY', 'ENCRYPTION_KEY']) if (env[key] || process.env[key]) keyEnv[key] = env[key] || process.env[key];
  const code = ts.transpileModule(fs.readFileSync('server/utils/tokenVault.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', 'process', code)(name => { assert.equal(name, 'crypto'); return crypto; }, vault, { env: keyEnv });
  const accessToken = vault.decryptTokens(conn.encrypted_tokens).accessToken || conn.access_token;
  result.accessTokenAvailable = Boolean(accessToken); assert.ok(accessToken);
  const endpoint = new URL(`https://${conn.shop_domain}/admin/api/2026-07/orders.json`);
  Object.entries({ status: 'any', limit: '250', order: 'created_at asc', created_at_min: '2026-09-27T00:00:00Z', created_at_max: '2026-09-30T00:00:00Z',
    fields: 'id,name,created_at,test,financial_status,cancelled_at,tags,current_total_price,current_total_price_set,currency' }).forEach(([key, value]) => endpoint.searchParams.set(key, value));
  const response = await fetch(endpoint, { headers: { 'X-Shopify-Access-Token': accessToken }, redirect: 'error', signal: AbortSignal.timeout(20000) });
  result.ordersHttpStatus = response.status; assert.equal(response.status, 200);
  const json = await response.json(); assert.ok(Array.isArray(json.orders));
  result.window = { start: '2026-09-27', end: '2026-09-30', ordersReturned: json.orders.length, hasNextPage: /rel="?next"?/.test(response.headers.get('link') || '') };
  result.orders = json.orders.filter(order => order.name === '#1014').map(order => ({ ref: hash(String(order.id)), name: order.name,
    createdAt: order.created_at, test: order.test, financialStatus: order.financial_status, cancelled: Boolean(order.cancelled_at),
    tags: String(order.tags || '').split(',').map(tag => tag.trim()).filter(Boolean), currentTotalPrice: order.current_total_price,
    currency: order.currency, currentTotalPriceSet: order.current_total_price_set }));
  if (result.orders.some(order => order.test === true)) {
    const plan = await fetch(`https://${conn.shop_domain}/admin/api/2026-07/graphql.json`, { method: 'POST', headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'query MetricMindShopPlan { shop { plan { partnerDevelopment } } }' }), redirect: 'error', signal: AbortSignal.timeout(20000) });
    result.planHttpStatus = plan.status;
    const body = await plan.json(); result.partnerDevelopment = body?.data?.shop?.plan?.partnerDevelopment ?? null;
    result.planHasErrors = Boolean(body?.errors);
  }
  result.result = 'BOUNDED_PROVIDER_READ_COMPLETE';
})().catch(error => { result.result = 'CHECK_INCOMPLETE'; result.errorCode = error.code || error.name; process.exitCode = 1; })
  .finally(async () => { if (db) await db.end().catch(() => {}); fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(result)); });
