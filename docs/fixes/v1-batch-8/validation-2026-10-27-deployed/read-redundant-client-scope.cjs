// Exact two-client inventory; enforced READ ONLY. No application imports or mutations.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const hashes = ['28653e2984ab', 'dcd835dcddad'];
const result = { at: new Date().toISOString() };
let client;
(async () => {
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'batch8-client-scope-readonly', connectionTimeoutMillis: 10000, statement_timeout: 12000, query_timeout: 15000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  result.readOnly = true;
  result.rows = (await client.query(`SELECT cl.name AS client_name,
    left(encode(sha256(convert_to(cl.id,'UTF8')),'hex'),12) AS client_hash,
    c.name AS campaign_name, c.status AS campaign_status,
    left(encode(sha256(convert_to(c.id,'UTF8')),'hex'),12) AS campaign_hash,
    COALESCE(cl.owner_id=c.owner_id,false) AS owner_matches
    FROM clients cl LEFT JOIN campaigns c ON c.client_id=cl.id
    WHERE left(encode(sha256(convert_to(cl.id,'UTF8')),'hex'),12)=ANY($1::text[])
    ORDER BY cl.name,c.name`, [hashes])).rows;
  await client.query('ROLLBACK');
})().catch(error => { result.error = { code: error.code || error.name, message: 'Read-only scope check failed; connection details redacted' }; process.exitCode = 1; })
  .finally(async () => {
    if (client) await client.end().catch(() => {});
    fs.writeFileSync(__dirname + `/client-scope-${result.at.replace(/[:.]/g, '-')}.json`, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(result, null, 2));
  });
