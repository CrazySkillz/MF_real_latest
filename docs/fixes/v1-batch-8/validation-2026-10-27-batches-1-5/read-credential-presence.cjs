// Presence/shape counts only, including inactive and orphan connections. No credential leaves SQL.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
const label = process.argv[2] || 'credential-presence';
assert.match(label, /^[a-z0-9-]+$/);
const result = { at: new Date().toISOString(), boundary: 'Verified TLS/database identity; enforced READ ONLY; no credential values/decryption, provider calls or writes', tables: [] };
let client;
(async () => {
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify([url.hostname, url.port || '5432', url.pathname])).digest('hex'), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'batches1-5-readonly-credential-presence', connectionTimeoutMillis: 10000, statement_timeout: 10000, query_timeout: 12000, idle_in_transaction_session_timeout: 20000 });
  await client.connect(); await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  result.readOnly = true;
  const columns = (await client.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'")).rows;
  const has = (table, column) => columns.some(row => row.table_name === table && row.column_name === column);
  for (const table of ['ga4_connections','google_sheets_connections','google_ads_connections','ga4_google_ads_spend_connections','hubspot_connections','salesforce_connections','shopify_connections','linkedin_connections','meta_connections','instagram_connections','tiktok_connections']) {
    assert.ok(has(table, 'encrypted_tokens'), 'Expected encrypted connection schema unavailable');
    const plainColumns = ['access_token','refresh_token','client_secret','developer_token'].filter(column => has(table, column));
    const counts = plainColumns.map(column => `count(*) FILTER(WHERE NULLIF("${column}",'') IS NOT NULL)::int AS "${column}_present"`);
    result.tables.push({ table, ...(await client.query(`SELECT count(*)::int total, count(*) FILTER(WHERE encrypted_tokens IS NOT NULL AND encrypted_tokens::text <> '{}')::int encrypted_container_present${counts.length ? ',' + counts.join(',') : ''} FROM "${table}"`)).rows[0] });
    const plain = plainColumns.map(column => `NULLIF(t."${column}",'') IS NOT NULL`).join(' OR ') || 'false';
    const active = has(table, 'is_active') ? 't.is_active' : 'true';
    const method = has(table, 'method') ? "coalesce(t.method,'unspecified')" : "'unspecified'";
    result.tables[result.tables.length - 1].plaintextGroups = (await client.query(`SELECT (c.id IS NULL) missing_parent, ${active} active, ${method} method, (t.encrypted_tokens IS NULL) ciphertext_absent, count(*)::int count, md5(string_agg(t.id::text,',' ORDER BY t.id::text)) rowset_fingerprint FROM "${table}" t LEFT JOIN campaigns c ON c.id=t.campaign_id WHERE (${plain}) GROUP BY 1,2,3,4 ORDER BY 1,2,3,4`)).rows;
  }
  result.integrations = (await client.query("SELECT count(*)::int total, count(*) FILTER(WHERE NULLIF(credentials,'') IS NOT NULL)::int credential_present FROM integrations")).rows[0];
  result.limit = 'Encrypted-container presence does not prove authentication, decryptability or historical log exposure. Non-empty generic credentials, if any, require separate classification.';
  await client.query('ROLLBACK');
})().catch(error => { result.error = { code: error.code || error.name, detail: 'Read-only count failed; connection/error details redacted' }; process.exitCode = 1; })
  .finally(async () => { if (client) await client.end().catch(() => {}); fs.writeFileSync(__dirname + '/' + label + '.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(result, null, 2)); });
