// Read-only schema/TLS check. Never imports application startup or provider code.
const fs = require('node:fs'), { parseEnv } = require('node:util'), { Client } = require('pg');
const confirmedRender = process.argv.includes('--confirmed-render');
const result = { at: new Date().toISOString(), boundary: (confirmedRender ? 'User confirmed Render uses this repository DATABASE_URL. ' : 'Repository-configured database; binding to Render is not established. ') + 'Metadata-only READ ONLY transaction; no customer records, credentials or configuration values returned.' };
let client;
(async () => {
  try {
    const env = parseEnv(fs.readFileSync('.env', 'utf8'));
    if (!env.DATABASE_URL) throw Object.assign(new Error('No database configured'), { code: 'NO_DATABASE_URL' });
    const url = new URL(env.DATABASE_URL);
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
    client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: true }, application_name: 'mf-batch1-deployment-preflight', connectionTimeoutMillis: 5000, statement_timeout: 5000, query_timeout: 8000, idle_in_transaction_session_timeout: 10000 });
    await client.connect();
    await client.query('BEGIN READ ONLY');
    result.readOnly = (await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only === 'on';
    if (!result.readOnly) throw Object.assign(new Error('Read-only required'), { code: 'READ_ONLY_REQUIRED' });
    result.verifiedTlsConnection = true;
    result.ownerColumns = (await client.query(`SELECT t.name AS table_name, EXISTS (
      SELECT 1 FROM information_schema.columns c WHERE c.table_schema=current_schema() AND c.table_name=t.name AND c.column_name='owner_id'
    ) AS present FROM unnest($1::text[]) AS t(name) ORDER BY t.name`, [['metrics','integrations','performance_data','attribution_models','customer_journeys']])).rows;
    result.receiptsTablePresent = (await client.query("SELECT to_regclass('inbound_webhook_receipts') IS NOT NULL AS present")).rows[0].present;
    result.migration0022Present = result.ownerColumns.every(r => r.present) && result.receiptsTablePresent;
    await client.query('ROLLBACK');
  } catch (error) { result.errorCode = error.code || error.name; process.exitCode = 1; }
  finally {
    if (client) await client.end().catch(() => {});
    fs.writeFileSync(`docs/fixes/v1-batch-1/${confirmedRender ? 'deployment-postmigration' : 'deployment-preflight'}.json`, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  }
})();
