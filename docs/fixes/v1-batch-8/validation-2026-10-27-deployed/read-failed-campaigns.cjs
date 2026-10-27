// Bounded campaign diagnosis only; enforced READ ONLY; no application/provider imports.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
process.env.TZ = 'UTC';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const hashes = ['6caf32c94dbe', '57141d52e81b', 'b0f65e7c7bfb', '4ba3d83a9f51', 'd9920c47fecf', '518aea3dc6ff', 'de4775c3b435'];
const result = { at: new Date().toISOString(), campaignHashes: hashes, environmentGrantsInspected: false };
let client;
(async () => {
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'batch8-campaign-diagnosis-readonly', connectionTimeoutMillis: 10000, statement_timeout: 12000, query_timeout: 15000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  result.readOnly = true;
  result.campaigns = (await client.query(`
    SELECT left(encode(sha256(convert_to(c.id,'UTF8')),'hex'),12) AS campaign_hash,
      c.name, c.status,
      c.owner_id IS NOT NULL AND c.owner_id <> '' AS has_owner,
      c.client_id IS NOT NULL AND c.client_id <> '' AS has_client,
      cl.id IS NOT NULL AS client_exists,
      COALESCE(c.owner_id = cl.owner_id, false) AS client_owner_matches,
      left(encode(sha256(convert_to(c.owner_id,'UTF8')),'hex'),12) AS owner_hash,
      left(encode(sha256(convert_to(c.client_id,'UTF8')),'hex'),12) AS client_hash,
      cl.name AS client_name,
      g.method, g.is_active, g.is_primary,
      left(encode(sha256(convert_to(g.property_id,'UTF8')),'hex'),12) AS property_hash,
      EXISTS (SELECT 1 FROM service_account_resource_grants r
        WHERE r.owner_id=c.owner_id AND r.client_id=c.client_id
        AND r.provider='ga4' AND r.resource_id=g.property_id) AS has_exact_database_grant
    FROM campaigns c LEFT JOIN clients cl ON cl.id=c.client_id
      LEFT JOIN ga4_connections g ON g.campaign_id=c.id AND g.is_active=true
    WHERE left(encode(sha256(convert_to(c.id,'UTF8')),'hex'),12)=ANY($1::text[])
    ORDER BY c.name, g.is_primary DESC`, [hashes])).rows;
  assert.equal(new Set(result.campaigns.map(row => row.campaign_hash)).size, hashes.length);
  await client.query('ROLLBACK');
})().catch(error => { result.error = { code: error.code || error.name, message: 'Read-only diagnosis failed; connection details redacted' }; process.exitCode = 1; })
  .finally(async () => {
    if (client) await client.end().catch(() => {});
    fs.writeFileSync(__dirname + `/failed-campaigns-${result.at.replace(/[:.]/g, '-')}.json`, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(result, null, 2));
  });
