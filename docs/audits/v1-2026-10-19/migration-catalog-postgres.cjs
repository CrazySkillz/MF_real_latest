// Executes every retained SQL file and simultaneous startup callbacks in isolated local schemas.
const fs = require('node:fs'), ts = require('typescript'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { Pool } = require('pg'), { drizzle } = require('drizzle-orm/node-postgres'), { sql } = require('drizzle-orm');
const out = 'docs/audits/v1-2026-10-19/';
const url = new URL(process.env.NOTIFICATION_TEST_DATABASE_URL || '');
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55443'); assert.equal(url.pathname, '/notifications_test'); assert.equal(url.username, 'v1_audit');
assert.equal(process.env.DATABASE_URL || '', '');
const generated = JSON.parse(fs.readFileSync(out + 'schema-generation.json', 'utf8'));
const files = fs.readdirSync('migrations').filter(name => name.endsWith('.sql')).sort().map(name => {
  const source = fs.readFileSync('migrations/' + name, 'utf8');
  assert.ok(!/(?:"public"|\bpublic)\s*\./i.test(source), name);
  return { name, source, sha256: crypto.createHash('sha256').update(source).digest('hex') };
});
const source = ts.createSourceFile('index.ts', fs.readFileSync('server/index.ts', 'utf8'), ts.ScriptTarget.Latest, true);
let callback;
function visit(n) {
  if (ts.isCallExpression(n) && n.expression.getText(source) === 'setTimeout' && n.arguments[1]?.getText(source) === '5000') callback = n.arguments[0].getText(source);
  ts.forEachChild(n, visit);
}
visit(source); assert.ok(callback);
const transpile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const admin = new Pool({ connectionString: url.href, statement_timeout: 10000 }), results = [], catalog = [];
async function withSchema(label, run) {
  const schema = 'v1_migration_' + crypto.randomUUID().replaceAll('-', '');
  assert.match(schema, /^v1_migration_[a-f0-9]{32}$/);
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new Pool({ connectionString: url.href, options: `-c search_path=${schema}`, statement_timeout: 10000, lock_timeout: 5000, max: 4 });
  try {
    for (const statement of generated.statements) { assert.ok(!/(?:"public"|\bpublic)\s*\./i.test(statement)); await pool.query(statement); }
    await run(pool, schema);
  } finally {
    await pool.end();
    assert.match(schema, /^v1_migration_[a-f0-9]{32}$/);
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  }
}
function startup(pool, worker, synchronizeFirst) {
  const db = drizzle(pool), calls = [], errors = [], logs = [];
  let first = true;
  const env = {
    db: { execute: async query => {
      if (first) { first = false; if (synchronizeFirst) await synchronizeFirst(); }
      try { return await db.execute(query); }
      catch (e) { errors.push({ code: e.code || e.cause?.code, message: String(e.cause?.message || e.message).replaceAll(/v1_migration_[a-f0-9]{32}/g, '<fixture_schema>') }); throw e; }
    } }, sql, port: 0, log: value => logs.push(String(value)), console: { error: () => {} },
    seedDashboardData: async () => calls.push('seed:stubbed'),
    snapshotScheduler: { start: () => calls.push('snapshotScheduler') },
    executiveSummarySnapshotScheduler: { start: () => calls.push('executiveSummarySnapshotScheduler') },
  };
  for (const name of ['startKPIScheduler','startReportScheduler','startLinkedInScheduler','startMetaScheduler','startGoogleSheetsTokenScheduler','startDailyAutoRefreshScheduler','startGA4DailyScheduler','startGoogleAdsScheduler','startInstagramScheduler','startTikTokScheduler','startAlertEmailScheduler']) env[name] = () => calls.push(name);
  const run = new Function(...Object.keys(env), transpile('return (' + callback + ');'))(...Object.values(env));
  return { run, result: () => ({ worker, sqlErrors: errors, seedInvocations: calls.filter(v => v === 'seed:stubbed').length, schedulerStartInvocations: calls.filter(v => v !== 'seed:stubbed').length }) };
}
(async () => {
  try {
    await withSchema('all retained scripts', async pool => {
      const initialized = startup(pool, 'baseline');
      await initialized.run();
      assert.deepEqual(initialized.result().sqlErrors, []);
      for (let pass = 1; pass <= 2; pass++) for (const file of files) {
        const start = Date.now();
        try { await pool.query(file.source); catalog.push({ file: file.name, sha256: file.sha256, pass, result: 'executed', elapsedMs: Date.now() - start }); }
        catch (e) { catalog.push({ file: file.name, sha256: file.sha256, pass, result: 'failed', code: e.code, message: e.message, elapsedMs: Date.now() - start }); }
      }
      const rows = await pool.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=current_schema() AND ((table_name='notifications' AND column_name='metadata') OR (table_name='kpi_periods' AND column_name='id')) ORDER BY table_name,column_name");
      results.push({ case: 'Every retained migration file, two lexicographic passes on declared schema plus successful current startup', files: files.length, executions: catalog.length, failures: catalog.filter(x => x.result === 'failed'), selectedColumnTypes: rows.rows, caveat: 'This explicit order is a compatibility diagnostic, not an approved production migration order. Empty fixture tables do not prove historical data migration safety.' });
    });
    await withSchema('concurrent startup', async pool => {
      let arrived = 0, release;
      const barrier = new Promise(resolve => { release = resolve; });
      const synchronizeFirst = async () => { if (++arrived === 2) release(); await barrier; };
      const workers = [startup(pool, 'A', synchronizeFirst), startup(pool, 'B', synchronizeFirst)];
      await Promise.all(workers.map(worker => worker.run()));
      const observations = workers.map(worker => worker.result());
      for (const observation of observations) assert.equal(observation.schedulerStartInvocations, 13);
      results.push({ case: 'Two current startup migration callbacks start together against one declared schema', workers: observations, caveat: 'Exact migration SQL; workers and seed are recorded stubs. One bounded contention run, no historical production fixture, load, HTTP, provider or scheduler execution.' });
    });
    const remaining = await admin.query("SELECT count(*)::int AS count FROM pg_namespace WHERE nspname LIKE 'v1_migration_%'");
    assert.equal(remaining.rows[0].count, 0);
    fs.writeFileSync(out + 'migration-catalog-postgres.json', JSON.stringify({
      head: '777aae6f6353e998d60b635d3e66b413093117c2', at: new Date().toISOString(),
      boundary: 'Disposable PostgreSQL18 loopback55443/notifications_test with v1_audit fixture role; DATABASE_URL empty; generated current schema; real SQL; no application startup, customer data, provider or email.',
      results, catalog, remainingFixtureSchemas: 0,
    }, null, 2) + '\n');
    console.log(JSON.stringify({ scenarios: results.length, migrationFiles: files.length, fileExecutions: catalog.length, scriptFailures: catalog.filter(x => x.result === 'failed').length, concurrentStartup: results[1], remainingFixtureSchemas: 0 }));
  } finally { await admin.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
