// Execute existing read methods against the exact affected campaign in a read-only transaction.
// No application startup, auth session, provider request, or production write is allowed.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { createRequire } = require('node:module'), vm = require('node:vm');
const { Client } = require('pg'), { drizzle } = require('drizzle-orm/node-postgres'), { build } = require('esbuild');
const campaignId = '36493a43-accd-4360-8ff2-de62f5a19b6e', day = '2026-10-26', start = '2026-09-23';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const result = { at: new Date().toISOString(), checks: [] };
let client;
(async () => {
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'report-incident-readonly', connectionTimeoutMillis: 10000, statement_timeout: 10000, query_timeout: 12000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  result.readOnly = true;
  const [connection] = (await client.query('SELECT property_id,method FROM ga4_connections WHERE campaign_id=$1 AND is_active=true ORDER BY is_primary DESC LIMIT 1', [campaignId])).rows;
  assert.ok(connection); result.connectionMethod = connection.method;
  const readonlyDb = drizzle(client);
  readonlyDb.transaction = async callback => callback(readonlyDb);
  const bundle = await build({ entryPoints: ['server/storage.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    plugins: [{ name: 'read-only-database', setup(builder) {
      builder.onResolve({ filter: /(?:^|\/)db$/ }, () => ({ path: 'readonly-db', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const db = globalThis.readonlyDb; export const pool = null;', loader: 'js' }));
    } }],
  });
  const exported = { exports: {} };
  const blockedFetch = () => { throw new Error('PROVIDER_ACCESS_FORBIDDEN'); };
  vm.runInNewContext(bundle.outputFiles[0].text, { module: exported, exports: exported.exports, require: createRequire(path.resolve('package.json')),
    readonlyDb, process: { env: { NODE_ENV: 'production' } }, console: { log() {}, warn() {}, error() {} }, Buffer, URL, Date, setTimeout, clearTimeout, fetch: blockedFetch });
  const storage = exported.exports.storage;
  if (process.argv.includes('--breakdown-route')) {
    const ts = require('typescript');
    const source = ts.createSourceFile('routes-oauth.ts', fs.readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
    const definitions = {};
    const visit = node => {
      if (ts.isVariableDeclaration(node) && ['getSynchronizedGA4OverviewSnapshot', 'parseGA4CampaignFilter'].includes(node.name.getText(source))) definitions[node.name.getText(source)] = node.initializer.getText(source);
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'app.get' && node.arguments[0]?.getText(source) === '"/api/campaigns/:id/ga4-breakdown"') definitions.route = node.arguments.at(-1).getText(source);
      ts.forEachChild(node, visit);
    };
    visit(source);
    const compile = (name, bindings) => {
      assert.ok(definitions[name]);
      return new Function(...Object.keys(bindings), ts.transpileModule(`return (${definitions[name]});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(bindings));
    };
    const [campaign] = (await client.query('SELECT id,owner_id,client_id,currency,reporting_time_zone AS "reportingTimeZone",ga4_campaign_filter AS "ga4CampaignFilter" FROM campaigns WHERE id=$1', [campaignId])).rows;
    assert.equal(hash(String(campaign.owner_id)).slice(0, 12), 'd57d01592772');
    assert.equal(hash(String(campaign.client_id)).slice(0, 12), '6be34241134f');
    const timezone = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('server/utils/reporting-timezone.ts', 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText, { exports: timezone.exports, Date, Intl });
    let providerCalls = 0;
    const handler = compile('route', { storage,
      ensureCampaignAccess: async req => { assert.equal(req.params.id, campaignId); return campaign; },
      parseGA4CampaignFilter: compile('parseGA4CampaignFilter', {}),
      getSynchronizedGA4OverviewSnapshot: compile('getSynchronizedGA4OverviewSnapshot', { storage }),
      resolveGA4ImportToDateWindow: timezone.exports.resolveGA4ImportToDateWindow,
      isYesopMockProperty: () => false,
      ga4Service: { getAcquisitionBreakdown: async () => { providerCalls++; throw new Error('PROVIDER_ACCESS_FORBIDDEN'); } },
      console: { error() {} },
    });
    const response = { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ params: { id: campaignId }, query: { window: 'import-to-date', propertyId: connection.property_id, adComparisonCampaignBreakdown: '1' } }, response);
    assert.equal(response.code, 200); assert.equal(providerCalls, 0);
    const saved = await storage.getGA4OverviewSnapshot(campaignId, connection.property_id);
    assert.deepEqual(response.body.rows, saved.campaignBreakdown.rows.slice(0, 2000));
    assert.deepEqual(response.body.totals, saved.campaignBreakdown.totals);
    assert.equal(response.body.startDate, start); assert.equal(response.body.endDate, day);
    assert.equal(response.body.totals.revenue, 7653.96);
    assert.equal(Number(response.body.rows.reduce((sum, row) => sum + Number(row.revenue), 0).toFixed(2)), 7653.96);
    const financial = await storage.getLatestFinancialDailySnapshot(campaignId, day);
    assert.equal(Number(financial.metrics.financialDaily.inputs.revenue.value), 8003.96);
    result.checks.push({ method: 'actual-ga4-breakdown-route', passed: true, httpStatus: response.code, providerCalls,
      campaignHash: hash(campaignId).slice(0, 12), startDate: response.body.startDate, endDate: response.body.endDate,
      rows: response.body.rows.length, nativeRevenue: response.body.totals.revenue, totalRevenue: Number(financial.metrics.financialDaily.inputs.revenue.value) });
    await client.query('ROLLBACK');
    return;
  }
  const cases = [
    ['getGA4PublicationVersion', [campaignId]],
    ['getGA4OverviewSnapshot', [campaignId, connection.property_id]],
    ['getGA4DailyMetrics', [campaignId, connection.property_id, start, day]],
    ['getExecutiveSummaryDailyComparisonData', [campaignId, day, day]],
    ['getLatestFinancialDailySnapshot', [campaignId, day]],
    ['getRevenueSources', [campaignId, 'ga4']], ['getSpendSources', [campaignId, 'ga4']],
    ['getGA4RevenuePublicationStatus', [campaignId, day]],
    ['getRevenueTotalForRange', [campaignId, start, day, 'ga4']], ['getRevenueTotalForRange', [campaignId, day, day, 'ga4']],
    ['getRevenueBreakdownBySource', [campaignId, start, day, 'ga4']],
    ['getSpendTotalForRange', [campaignId, start, day, 'ga4']], ['getSpendBreakdownBySource', [campaignId, start, day, 'ga4']],
  ];
  for (const [method, args] of cases) {
    const begun = Date.now();
    await client.query('SAVEPOINT diagnostic_read');
    try {
      const value = await storage[method](...args);
      result.checks.push({ method, latestDayOnly: args[1] === day, passed: true, elapsedMs: Date.now() - begun, rows: Array.isArray(value) ? value.length : undefined, available: value !== null && value !== undefined });
    } catch (error) {
      result.checks.push({ method, latestDayOnly: args[1] === day, passed: false, elapsedMs: Date.now() - begun, code: error.code, message: String(error.message).slice(0, 220) });
    }
    await client.query('ROLLBACK TO SAVEPOINT diagnostic_read');
    await client.query('RELEASE SAVEPOINT diagnostic_read');
  }
  await client.query('ROLLBACK');
})().catch(error => { result.failure = { code: error.code || error.name, message: 'Read-only diagnostic could not complete; details redacted' }; process.exitCode = 1; })
  .finally(async () => { if (client) await client.end().catch(() => {}); fs.writeFileSync(__dirname + '/storage-' + result.at.replace(/[:.]/g, '-') + '.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(result)); });
