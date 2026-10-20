// One-off execution of the reviewed additive migration on the user-confirmed target.
// Never imports application startup, reads customer records, or prints credentials.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { createHash } = require('node:crypto');
const { Client } = require('pg');
const migration = 'migrations/0022_v1_entrypoint_ownership.sql';
const output = 'docs/fixes/v1-batch-1/deployment-migration.json';
const tables = ['metrics', 'integrations', 'performance_data', 'attribution_models', 'customer_journeys'];
const result = {
  at: new Date().toISOString(), migration,
  targetBinding: 'User confirmed Render uses the DATABASE_URL in this repository .env.',
  boundary: 'Reviewed additive DDL only; metadata checks, no customer-row reads or writes.',
  committed: false,
};
let client, transaction = false;
async function inspect() {
  const owners = (await client.query(`SELECT t.name AS table_name,
    to_regclass('public.' || t.name) IS NOT NULL AS table_present,
    c.data_type, c.is_nullable
    FROM unnest($1::text[]) t(name)
    LEFT JOIN information_schema.columns c ON c.table_schema='public'
      AND c.table_name=t.name AND c.column_name='owner_id' ORDER BY t.name`, [tables])).rows;
  const indexes = (await client.query(`SELECT c.relname AS index_name, i.indisvalid, i.indisready,
    pg_get_indexdef(c.oid) AS definition FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_index i ON i.indexrelid=c.oid
    WHERE n.nspname='public' AND c.relname=ANY($1::text[]) ORDER BY c.relname`,
    [tables.map(t => t + '_owner_id_idx')])).rows;
  const receipts = (await client.query(`SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema='public'
      AND table_name='inbound_webhook_receipts' ORDER BY ordinal_position`)).rows;
  const receiptPrimaryKey = (await client.query(`SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conrelid=to_regclass('public.inbound_webhook_receipts') AND contype='p'`)).rows;
  return { owners, indexes, receipts, receiptPrimaryKey };
}
(async () => {
  try {
    assert.equal(process.argv[2], '--apply', 'Explicit --apply is required');
    const sql = fs.readFileSync(migration, 'utf8');
    result.migrationSha256 = createHash('sha256').update(sql).digest('hex');
    assert.equal(result.migrationSha256, JSON.parse(fs.readFileSync('docs/fixes/v1-batch-1/candidate-files.json', 'utf8')).hashes[migration]);
    assert.equal((sql.match(/^BEGIN;\r?$/gm) || []).length, 1);
    assert.equal((sql.match(/^COMMIT;\r?$/gm) || []).length, 1);
    const body = sql.replace(/^BEGIN;\r?$/m, '').replace(/^COMMIT;\r?$/m, '');
    const env = parseEnv(fs.readFileSync('.env', 'utf8'));
    assert.ok(env.DATABASE_URL, 'DATABASE_URL is required');
    const url = new URL(env.DATABASE_URL);
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
    client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: true },
      application_name: 'mf-batch1-reviewed-migration-0022', connectionTimeoutMillis: 5000,
      statement_timeout: 15000, query_timeout: 20000, idle_in_transaction_session_timeout: 10000 });
    await client.connect();
    result.verifiedTlsConnection = true;
    await client.query('BEGIN'); transaction = true;
    await client.query("SET LOCAL search_path TO public; SET LOCAL lock_timeout TO '2s'; SET LOCAL statement_timeout TO '15s'");
    assert.equal((await client.query("SELECT pg_try_advisory_xact_lock(hashtext('mf-v1-migration-0022')) AS locked")).rows[0].locked, true);
    result.before = await inspect();
    assert.equal(result.before.owners.length, 5);
    for (const row of result.before.owners) {
      assert.equal(row.table_present, true);
      if (row.data_type !== null) { assert.equal(row.data_type, 'text'); assert.equal(row.is_nullable, 'YES'); }
    }
    await client.query(body);
    result.after = await inspect();
    for (const row of result.after.owners) { assert.equal(row.data_type, 'text'); assert.equal(row.is_nullable, 'YES'); }
    assert.equal(result.after.indexes.length, 5);
    for (const row of result.after.indexes) {
      assert.equal(row.indisvalid && row.indisready, true);
      const table = row.index_name.replace(/_owner_id_idx$/, '');
      assert.equal(row.definition, `CREATE INDEX ${row.index_name} ON public.${table} USING btree (owner_id)`);
    }
    assert.deepEqual(result.after.receipts.map(r => [r.column_name, r.data_type, r.is_nullable]), [
      ['id', 'text', 'NO'], ['campaign_id', 'text', 'NO'], ['metrics_id', 'text', 'YES'],
      ['created_at', 'timestamp without time zone', 'NO'],
    ]);
    assert.equal(result.after.receipts[3].column_default, 'CURRENT_TIMESTAMP');
    assert.deepEqual(result.after.receiptPrimaryKey, [{ definition: 'PRIMARY KEY (id)' }]);
    await client.query('COMMIT'); transaction = false; result.committed = true;
    result.completedAt = new Date().toISOString();
  } catch (error) {
    result.errorCode = error.code || error.name;
    if (transaction) { await client.query('ROLLBACK').then(() => { result.rolledBack = true; }).catch(() => { result.rollbackAcknowledged = false; }); }
    process.exitCode = 1;
  } finally {
    if (client) await client.end().catch(() => {});
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ at: result.at, committed: result.committed, verifiedTlsConnection: result.verifiedTlsConnection,
      ownerColumns: result.after?.owners.length, indexes: result.after?.indexes.length,
      receiptColumns: result.after?.receipts.length, rolledBack: result.rolledBack, errorCode: result.errorCode, evidence: output }));
  }
})();
