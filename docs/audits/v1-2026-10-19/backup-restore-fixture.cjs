// Isolated backup/restore rehearsal only; never reads application environment or customer data.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const ts = require('typescript'), assert = require('node:assert/strict'), { Pool } = require('pg');
const dir = path.resolve('docs/audits/v1-2026-10-19'), schema = 'v1_restore_' + crypto.randomUUID().replaceAll('-', '');
assert.match(schema, /^v1_restore_[a-f0-9]{32}$/); assert.equal(process.env.DATABASE_URL || '', '');
const connectionString = 'postgresql://v1_audit@127.0.0.1:55443/notifications_test';
const admin = new Pool({ connectionString, statement_timeout: 10000 });
let pool;
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const generated = JSON.parse(fs.readFileSync(path.join(dir, 'schema-generation.json'), 'utf8'));
const vaultCode = ts.transpileModule(fs.readFileSync('server/utils/tokenVault.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function vault(key) {
  const exports = {};
  new Function('require', 'process', 'exports', vaultCode)(require, { env: { NODE_ENV: 'production', TOKEN_ENCRYPTION_KEY: key } }, exports);
  return exports;
}
const key = crypto.randomBytes(32).toString('hex'), correctVault = vault(key);
const syntheticTokens = correctVault.buildEncryptedTokens({ accessToken: 'AUDIT_FAKE_ACCESS', refreshToken: 'AUDIT_FAKE_REFRESH', clientSecret: 'AUDIT_FAKE_CLIENT' });
const artifact = fs.readFileSync(path.join(dir, 'pdf-insights-rate-fixture.pdf'));
async function signature() {
  const data = {};
  for (const table of ['clients','campaigns','ga4_connections','revenue_sources','revenue_records','report_snapshots']) {
    assert.ok(/^[a-z][a-z0-9_]+$/.test(table));
    data[table] = (await pool.query(`SELECT row_to_json(t) AS value FROM ${table} t ORDER BY id`)).rows.map(row => row.value);
  }
  return { data, hash: hash(JSON.stringify(data)) };
}
(async () => {
  let created = false;
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`); created = true;
    pool = new Pool({ connectionString, options: `-c search_path=${schema}`, statement_timeout: 10000 });
    for (const sql of generated.statements) { assert.ok(!/(?:"public"|\bpublic)\s*\./i.test(sql)); await pool.query(sql); }
    for (const owner of ['a','b']) {
      await pool.query('INSERT INTO clients(id,owner_id,name) VALUES($1,$2,$3)', [`client-${owner}`, `owner-${owner}`, `Fixture ${owner}`]);
      await pool.query('INSERT INTO campaigns(id,owner_id,client_id,name,currency,reporting_time_zone,ga4_campaign_filter) VALUES($1,$2,$3,$4,$5,$6,$7)', [`campaign-${owner}`, `owner-${owner}`, `client-${owner}`, `Fixture ${owner}`, 'EUR', 'Europe/Amsterdam', 'fixture-scope']);
      await pool.query('INSERT INTO ga4_connections(id,campaign_id,property_id,method,encrypted_tokens,import_start_date) VALUES($1,$2,$3,$4,$5,$6)', [`connection-${owner}`, `campaign-${owner}`, '123456789', 'access_token', syntheticTokens, '2026-10-01']);
      await pool.query('INSERT INTO revenue_sources(id,campaign_id,source_type,platform_context,currency,mapping_config) VALUES($1,$2,$3,$4,$5,$6)', [`source-${owner}`, `campaign-${owner}`, 'csv', 'ga4', 'EUR', '{"campaignValue":"fixture-scope"}']);
      await pool.query('INSERT INTO revenue_records(id,campaign_id,revenue_source_id,date,revenue,currency,external_id) VALUES($1,$2,$3,$4,$5,$6,$7)', [`revenue-${owner}`, `campaign-${owner}`, `source-${owner}`, '2026-10-18', owner === 'a' ? '12.34' : '56.78', 'EUR', `external-${owner}`]);
      await pool.query('INSERT INTO report_snapshots(id,report_id,campaign_id,platform_type,report_type,snapshot_json) VALUES($1,$2,$3,$4,$5,$6)', [`snapshot-${owner}`, `report-${owner}`, `campaign-${owner}`, 'google_analytics', 'insights', JSON.stringify({ fixtureOnly: true, pdfBase64: artifact.toString('base64') })]);
    }
    const before = await signature(), file = path.join(dir, 'synthetic-backup-restore.dump');
    const args = ['-h','127.0.0.1','-p','55443','-U','v1_audit','-d','notifications_test'];
    cp.execFileSync('C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe', [...args, '-n', schema, '-F', 'c', '-f', file], { windowsHide: true, timeout: 30000, stdio: ['ignore','pipe','pipe'] });
    await pool.end(); pool = null;
    assert.match(schema, /^v1_restore_[a-f0-9]{32}$/);
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`); created = false;
    created = true; // Also clean up a partially restored fixture if pg_restore fails.
    cp.execFileSync('C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe', [...args, '--no-owner','--no-privileges','--exit-on-error', file], { windowsHide: true, timeout: 30000, stdio: ['ignore','pipe','pipe'] });
    pool = new Pool({ connectionString, options: `-c search_path=${schema}`, statement_timeout: 10000 });
    const after = await signature();
    assert.equal(after.hash, before.hash);
    for (const row of after.data.ga4_connections) assert.deepEqual(correctVault.decryptTokens(row.encrypted_tokens), { accessToken: 'AUDIT_FAKE_ACCESS', refreshToken: 'AUDIT_FAKE_REFRESH', clientSecret: 'AUDIT_FAKE_CLIENT' });
    const wrongVault = vault(crypto.randomBytes(32).toString('hex'));
    assert.deepEqual(wrongVault.decryptTokens(after.data.ga4_connections[0].encrypted_tokens), { accessToken: null, refreshToken: null, clientSecret: null });
    for (const row of after.data.report_snapshots) assert.equal(hash(Buffer.from(JSON.parse(row.snapshot_json).pdfBase64, 'base64')), hash(artifact));
    const tables = (await pool.query('SELECT count(*)::int AS count FROM pg_tables WHERE schemaname=$1', [schema])).rows[0].count;
    assert.equal(tables, 62);
    fs.writeFileSync(path.join(dir, 'backup-restore-fixture.json'), JSON.stringify({
      head: '777aae6f6353e998d60b635d3e66b413093117c2', at: new Date().toISOString(),
      boundary: 'PostgreSQL18 generated-schema logical backup/restore on disposable loopback55443 database. Two synthetic owners, six populated tables, twelve rows, current tokenVault code and prior synthetic PDF artifact. No application database/configuration, real credentials, provider or email.',
      result: { restoredTables: tables, restoredPopulatedTables: Object.keys(after.data).length, restoredFixtureRows: Object.values(after.data).reduce((n,rows) => n + rows.length, 0), exactRowHashPreserved: true, encryptedCredentialsRecoverWithOriginalKey: true, wrongKeyReturnsNullCredentials: true, exactPdfBytesPreserved: true, backupBytes: fs.statSync(file).size, backupSHA256: hash(fs.readFileSync(file)) },
      limitations: ['Not a production backup, restore or application rollback certificate.', 'No PITR, hosted service permissions, production key recovery, migration-triggered schema or background work resumed.', 'Report payload is an explicitly fixture-only container; this does not validate the application snapshot renderer.'],
    }, null, 2) + '\n');
    console.log('Restored 62 tables; twelve fixture rows, ciphertext/key recovery and PDF bytes reconcile.');
  } finally {
    if (pool) await pool.end();
    // The only candidate schema is the validated random namespace created by this runner.
    assert.match(schema, /^v1_restore_[a-f0-9]{32}$/);
    if (created) await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    const remaining = await admin.query('SELECT count(*)::int AS count FROM pg_namespace WHERE nspname=$1', [schema]);
    assert.equal(remaining.rows[0].count, 0);
    await admin.end();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
