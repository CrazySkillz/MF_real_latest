// Bounded production READ ONLY inventory. No app imports, mutations, tokens,
// emails, customer identifiers, report payloads, or metric values in output.
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const { Client } = require('pg');
const dir = 'docs/fixes/v1-batch-4/validation-2026-10-23-custom-integration/';
const out = dir + 'predeploy-compatibility.json';
assert.ok(!fs.existsSync(out), 'Preserve previous evidence');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const result = { at: new Date().toISOString(), scope: 'Existing Custom Integration data/report compatibility only; not release certification', productionWrites: false, providerCalls: false, emailSends: false };
let db;
(async () => {
  const manifest = JSON.parse(fs.readFileSync(dir + 'candidate-manifest.json', 'utf8'));
  result.baseHead = manifest.baseHead;
  result.candidateFiles = manifest.files.length;
  result.manifestMismatches = manifest.files.filter(f => hash(fs.readFileSync(f.file, 'utf8').replace(/\r\n/g, '\n')) !== f.lfSha256).map(f => f.file);
  assert.deepEqual(result.manifestMismatches, []);
  const response = await fetch('https://marketforensics.onrender.com/api/health', { signal: AbortSignal.timeout(20000) });
  const health = await response.json();
  result.liveHealth = { status: response.status, ok: health.ok, commit: health.commit };
  assert.equal(response.status, 200); assert.equal(health.ok, true); assert.equal(health.commit, manifest.baseHead);
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  result.databaseTargetSha256 = hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname]));
  const previous = JSON.parse(fs.readFileSync('docs/fixes/v1-batch-3/deployment-2026-10-22/production-after.json', 'utf8'));
  assert.equal(result.databaseTargetSha256, previous.databaseTargetSha256);
  result.samePreviouslyVerifiedDatabase = true;
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  db = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'mf-batch4-custom-readonly-compatibility',
    options: '-c default_transaction_read_only=on', connectionTimeoutMillis: 10000,
    statement_timeout: 10000, query_timeout: 12000, lock_timeout: 2000, idle_in_transaction_session_timeout: 15000 });
  await db.connect();
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  result.readOnly = (await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only === 'on';
  assert.equal(result.readOnly, true);
  const one = async sql => (await db.query(sql)).rows[0];
  const required = { custom_integrations: ['id','campaign_id','webhook_token'], custom_integration_metrics: ['id','campaign_id','uploaded_at','parser_metadata'],
    inbound_webhook_receipts: ['id','campaign_id','metrics_id'], campaigns: ['id','owner_id','status','currency','name'],
    linkedin_reports: ['id','campaign_id','platform_type','schedule_enabled','configuration'], report_snapshots: ['report_id','campaign_id','platform_type'],
    report_send_events: ['report_id'], kpis: ['campaign_id','platform_type'], benchmarks: ['campaign_id','platform_type'] };
  const columns = (await db.query('SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=ANY($1)', [Object.keys(required)])).rows;
  result.missingColumns = Object.entries(required).flatMap(([table, names]) => names.filter(name => !columns.some(c => c.table_name === table && c.column_name === name)).map(name => table + '.' + name));
  assert.deepEqual(result.missingColumns, []);
  result.connections = await one(`SELECT count(*)::int total, count(DISTINCT i.campaign_id)::int campaigns,
    count(*) FILTER (WHERE c.id IS NULL)::int orphaned, count(*) FILTER (WHERE c.status='deleted')::int deleted_parent,
    count(*) FILTER (WHERE c.owner_id IS NULL)::int ownerless FROM custom_integrations i LEFT JOIN campaigns c ON c.id=i.campaign_id`);
  result.imports = await one(`SELECT count(*)::int total, count(DISTINCT m.campaign_id)::int campaigns,
    count(*) FILTER (WHERE c.id IS NULL)::int orphaned,
    count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM custom_integrations i WHERE i.campaign_id=m.campaign_id))::int no_connection
    FROM custom_integration_metrics m LEFT JOIN campaigns c ON c.id=m.campaign_id`);
  // Metadata stays in memory; no file names, values, subjects or identifiers leave the query.
  const latest = (await db.query(`SELECT DISTINCT ON (campaign_id) parser_metadata FROM custom_integration_metrics
    ORDER BY campaign_id,uploaded_at DESC,id DESC LIMIT 5001`)).rows;
  assert.ok(latest.length <= 5000, 'Inventory limit exceeded');
  const valid = m => m?.validationVersion === 2 && m.requiresReview === false && Number(m.confidence) >= 95
    && Number(m.extractedFields) > 0 && Array.isArray(m.warnings) && m.warnings.length === 0;
  result.latestImports = { campaigns: latest.length, accepted: latest.filter(r => valid(r.parser_metadata)).length,
    wouldBecomeUnavailable: latest.filter(r => !valid(r.parser_metadata)).length };
  result.receipts = await one('SELECT count(*)::int total FROM inbound_webhook_receipts');
  result.reports = await one(`SELECT count(*)::int total, count(*) FILTER (WHERE schedule_enabled)::int scheduled,
    count(*) FILTER (WHERE campaign_id IS NULL)::int platform_level FROM linkedin_reports
    WHERE replace(lower(platform_type),'-','_')='custom_integration'`);
  result.otherReportsMentioningCustom = await one(`SELECT count(*)::int total FROM linkedin_reports
    WHERE replace(lower(platform_type),'-','_')<>'custom_integration' AND configuration ~* 'custom[-_ ]integration'`);
  result.snapshots = await one(`SELECT count(*)::int total FROM report_snapshots s WHERE replace(lower(s.platform_type),'-','_')='custom_integration'
    OR EXISTS (SELECT 1 FROM linkedin_reports r WHERE r.id=s.report_id AND replace(lower(r.platform_type),'-','_')='custom_integration')`);
  result.sendEvents = await one(`SELECT count(*)::int total FROM report_send_events e JOIN linkedin_reports r ON r.id=e.report_id
    WHERE replace(lower(r.platform_type),'-','_')='custom_integration'`);
  result.goals = {};
  for (const table of ['kpis','benchmarks']) result.goals[table] = await one(`SELECT count(*)::int custom_platform,
    count(*) FILTER (WHERE campaign_id IN (SELECT campaign_id FROM custom_integration_metrics))::int with_import
    FROM ${table} WHERE replace(lower(platform_type),'-','_')='custom_integration'`);
  result.ptomo = await one(`SELECT count(*)::int campaigns,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM custom_integrations i WHERE i.campaign_id=c.id))::int custom_connections,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM custom_integration_metrics m WHERE m.campaign_id=c.id))::int custom_imports
    FROM campaigns c WHERE lower(name)='ptomo'`);
  assert.equal(result.ptomo.campaigns, 1);
  await db.query('ROLLBACK');
  result.transactionEnded = 'ROLLBACK';
  result.result = 'READ_ONLY_INVENTORY_COMPLETE';
  result.compatibility = result.latestImports.wouldBecomeUnavailable === 0 && result.connections.total === 0 && result.reports.total === 0
    && result.otherReportsMentioningCustom.total === 0 && result.snapshots.total === 0 && Object.values(result.goals).every(x => x.custom_platform === 0)
    ? 'NO_EXISTING_CUSTOM_DATA_OR_REPORT_DEPENDENCY_FOUND' : 'EXISTING_CUSTOM_DEPENDENCIES_REQUIRE_REVIEW';
})().catch(error => {
  result.result = 'CHECK_FAILED';
  result.error = { code: error.code || error.name, message: 'Compatibility check failed; credentials and database details withheld.' };
  process.exitCode = 1;
}).finally(async () => {
  if (db) await db.end().catch(() => {});
  result.completedAt = new Date().toISOString();
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result, null, 2));
});
