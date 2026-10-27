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
  if (process.argv.includes('--refresh-routes')) {
    // READ ONLY PostgreSQL cannot take row locks. Omit only FOR SHARE for this
    // diagnostic; keep the same select/where/data transformations and snapshot.
    const select = readonlyDb.select.bind(readonlyDb);
    readonlyDb.select = (...args) => {
      const builder = select(...args), from = builder.from.bind(builder);
      builder.from = (...tables) => { const query = from(...tables); query.for = strength => { assert.equal(strength, 'share'); result.omittedReadLocks = (result.omittedReadLocks || 0) + 1; return query; }; return query; };
      return builder;
    };
  }
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
  if (process.argv.includes('--refresh-routes')) {
    const ts = require('typescript');
    const source = ts.createSourceFile('routes-oauth.ts', fs.readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
    const definitions = {}, handlers = {};
    const visit = node => {
      if (ts.isFunctionDeclaration(node) && node.name) definitions[node.name.text] = node.getText(source).replace(/^export /, '');
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)
        && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer) || ['zPlatformContext', 'zRevenueReadPlatformContext'].includes(node.name.text))) definitions[node.name.text] = node.initializer.getText(source);
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'app.get' && ts.isStringLiteral(node.arguments[0])) handlers[node.arguments[0].text] = node.arguments.at(-1).getText(source);
      ts.forEachChild(node, visit);
    }; visit(source);
    const campaign = await storage.getCampaign(campaignId);
    assert.equal(hash(String(campaign.ownerId)).slice(0, 12), 'd57d01592772');
    assert.equal(hash(String(campaign.clientId)).slice(0, 12), '6be34241134f');
    const bindings = { storage, z: require('zod').z, process: { env: {} }, dailyRefreshAttempts: new Map(), ensureCampaignAccess: async () => campaign, console: { log() {}, warn() {}, error() {} },
      ga4Service: new Proxy({}, { get: () => blockedFetch }) };
    for (const file of ['server/utils/ga4-service-account.ts', 'server/ga4-daily-scheduler.ts']) {
      const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      for (const statement of tree.statements) if (ts.isVariableStatement(statement)) for (const node of statement.declarationList.declarations)
        if (ts.isIdentifier(node.name) && node.initializer && ['isSupportedGA4ConnectionMethod', 'GA4_SERVICE_ACCOUNT_METHOD', 'GA4_ALIGNED_REFRESH_MARKER_PREFIX', 'getGA4RefreshAttemptScope', 'parseBoundedInt'].includes(node.name.text)) definitions[node.name.text] = node.initializer.getText(tree);
      for (const node of tree.statements) if (ts.isFunctionDeclaration(node) && node.name
        && ['isSupportedGA4ConnectionMethod', 'getGA4DailyRefreshAttempt', 'parseGA4AlignedRefreshMarker', 'getGA4DailySchedulerConfig'].includes(node.name.text))
        definitions[node.name.text] = node.getText(tree).replace(/^export /, '');
    }
    for (const file of ['server/utils/reporting-timezone.ts', 'shared/ga4-insights.ts', 'shared/ga4-financial-source.ts', 'shared/ga4-traffic-window.ts']) {
      const compiled = await build({ entryPoints: [file], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external' });
      const module = { exports: {} };
      vm.runInNewContext(compiled.outputFiles[0].text, { module, exports: module.exports, require: createRequire(path.resolve('package.json')), Date, URL });
      Object.assign(bindings, module.exports);
    }
    let scope;
    const compile = text => new Function('scope', `with(scope) { return (${ts.transpileModule('const handler = ' + text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText.replace(/^const handler = /, '').replace(/;\s*$/, '')}); }`)(scope);
    scope = new Proxy(bindings, { has: (target, key) => key in target || key in definitions,
      get(target, key) { if (!(key in target) && key in definitions) target[key] = compile(definitions[key]); return target[key]; } });
    for (const suffix of ['ga4-daily', 'ga4-daily?status', 'ga4-to-date', 'ga4-landing-pages', 'ga4-conversion-events', 'ga4-breakdown', 'financial-daily-snapshot', 'revenue-sources', 'revenue-to-date', 'revenue-breakdown', 'revenue-daily', 'spend-to-date', 'spend-sources', 'spend-breakdown', 'spend-daily']) {
      await client.query('SAVEPOINT route_read');
      const response = { code: 200, body: null, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      try {
        await compile(handlers['/api/campaigns/:id/' + suffix.split('?')[0]])({ params: { id: campaignId }, _campaign: campaign,
          query: { readOnly: '1', statusOnly: suffix.includes('?') ? '1' : undefined, propertyId: connection.property_id, insightsScope: '1', window: 'import-to-date', snapshotEndDate: day, throughDate: day,
            overviewCampaignBreakdown: '1', platformContext: 'ga4', date: day } }, response);
        result.checks.push({ route: suffix, status: response.code, error: response.body?.error || response.body?.message || null });
      } catch (error) { result.checks.push({ route: suffix, error: String(error.message).slice(0, 180) }); }
      await client.query('ROLLBACK TO SAVEPOINT route_read'); await client.query('RELEASE SAVEPOINT route_read');
    }
    for (const kind of ['getPlatformKPIs', 'getPlatformBenchmarks', 'getPlatformReports']) {
      const rows = await storage[kind]('google_analytics', campaignId);
      result.checks.push({ method: kind, rows: rows.length });
    }
    await client.query('ROLLBACK'); return;
  }
  if (process.argv.includes('--refresh-inputs')) {
    const snapshot = await storage.getGA4OverviewSnapshot(campaignId, connection.property_id);
    const latest = await storage.getLatestGA4DailyMetric(campaignId, connection.property_id);
    const summary = await storage.getExecutiveSummaryDailyComparisonData(campaignId, day, day);
    const [scope] = (await client.query('SELECT currency, reporting_time_zone, ga4_campaign_filter FROM campaigns WHERE id=$1', [campaignId])).rows;
    const [configured] = (await client.query('SELECT import_start_date FROM ga4_connections WHERE campaign_id=$1 AND property_id=$2 AND is_active=true', [campaignId, connection.property_id])).rows;
    result.checks.push({ method: 'refresh-inputs', scope, configured, latestDay: latest?.date,
      snapshot: snapshot && { windowStart: snapshot.windowStart, windowEnd: snapshot.windowEnd, updatedAt: snapshot.updatedAt,
        breakdown: snapshot.campaignBreakdown, landingPresent: !!snapshot.landingPages, eventsPresent: !!snapshot.conversionEvents },
      summary: summary.current && { reportingDate: summary.current.reportingDate, notes: summary.current.notes },
      version: await storage.getGA4PublicationVersion(campaignId) });
    await client.query('ROLLBACK'); return;
  }
  if (process.argv.includes('--publication-inputs')) {
    // Inspect only the inputs to the publication-status reader; its FOR SHARE
    // lock cannot be taken in this deliberately READ ONLY diagnostic transaction.
    const current = await storage.readGA4RevenuePublication(readonlyDb, campaignId, day);
    const financial = await storage.getLatestFinancialDailySnapshot(campaignId, day);
    const receipt = financial?.metrics?.revenuePublication;
    const work = receipt?.workId ? (await client.query('SELECT status FROM ga4_refresh_work WHERE id=$1 AND campaign_id=$2', [receipt.workId, campaignId])).rows[0] : null;
    result.checks.push({ method: 'revenue-publication-inputs', financialRevenue: financial?.metrics?.financialDaily?.inputs?.revenue?.value,
      receiptDate: receipt?.reportingDate, completed: !receipt?.workId || work?.status === 'completed',
      sources: (await storage.getRevenueSources(campaignId, 'ga4')).map(source => ({ sourceType: source.sourceType,
        hashMatchesPublishedReceipt: current.sources[source.id] === receipt?.sources?.[source.id],
        pendingCompletedDay: current.pendingSourceIds.includes(source.id) })) });
    await client.query('ROLLBACK'); return;
  }
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
