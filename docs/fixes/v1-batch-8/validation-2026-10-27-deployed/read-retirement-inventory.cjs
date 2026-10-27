// Enforced READ ONLY inventory of the six user-confirmed redundant campaigns.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
process.env.TZ = 'UTC';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const hashes = ['6caf32c94dbe', '57141d52e81b', 'b0f65e7c7bfb', '4ba3d83a9f51', 'd9920c47fecf', '518aea3dc6ff'];
const result = { at: new Date().toISOString(), campaignHashes: hashes };
let client;
(async () => {
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'batch8-retirement-inventory-readonly', connectionTimeoutMillis: 10000, statement_timeout: 12000, query_timeout: 15000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  result.readOnly = true;
  const campaigns = (await client.query(`SELECT c.id,c.name,c.status,cl.name AS client_name,
    left(encode(sha256(convert_to(c.owner_id,'UTF8')),'hex'),12) AS owner_hash,
    left(encode(sha256(convert_to(c.client_id,'UTF8')),'hex'),12) AS client_hash
    FROM campaigns c INNER JOIN clients cl ON c.client_id=cl.id AND c.owner_id=cl.owner_id
    WHERE left(encode(sha256(convert_to(c.id,'UTF8')),'hex'),12)=ANY($1::text[]) ORDER BY c.name`, [hashes])).rows;
  assert.equal(campaigns.length, hashes.length);
  const ids = campaigns.map(row => row.id);
  result.campaigns = campaigns.map(({ id, ...row }) => ({ campaignHash: hash(id).slice(0, 12), ...row }));
  result.reports = {};
  for (const table of ['linkedin_reports', 'kpi_reports']) {
    const rows = (await client.query(`SELECT id,campaign_id,name,status,schedule_enabled,schedule_frequency FROM ${table} WHERE campaign_id=ANY($1::text[]) ORDER BY name`, [ids])).rows;
    result.reports[table] = rows.map(({ id, campaign_id, ...row }) => ({ reportHash: hash(id).slice(0,12), campaignHash: hash(campaign_id).slice(0,12), ...row }));
  }
  result.alerts = {};
  for (const table of ['kpis', 'benchmarks']) {
    const rows = (await client.query(`SELECT campaign_id,platform_type,status,alerts_enabled,email_notifications,count(*)::int AS count FROM ${table}
      WHERE campaign_id=ANY($1::text[]) GROUP BY campaign_id,platform_type,status,alerts_enabled,email_notifications ORDER BY campaign_id,platform_type,status`, [ids])).rows;
    result.alerts[table] = rows.map(({ campaign_id, ...row }) => ({ campaignHash: hash(campaign_id).slice(0,12), ...row }));
  }
  result.work = (await client.query(`SELECT campaign_id,status,retryable,scope_hash LIKE 'invalidated:%' AS invalidated,
    COALESCE(scope->>'kind','daily') AS kind,count(*)::int AS count FROM ga4_refresh_work WHERE campaign_id=ANY($1::text[])
    GROUP BY campaign_id,status,retryable,invalidated,kind ORDER BY campaign_id,status,invalidated,kind`, [ids])).rows
    .map(({ campaign_id, ...row }) => ({ campaignHash: hash(campaign_id).slice(0,12), ...row }));
  result.openReportSendEvents = (await client.query(`SELECT e.status,count(*)::int AS count FROM report_send_events e INNER JOIN linkedin_reports r ON r.id=e.report_id
    WHERE r.campaign_id=ANY($1::text[]) AND e.status IN ('pending','pending_delivery','sending') GROUP BY e.status`, [ids])).rows;
  await client.query('ROLLBACK');
})().catch(error => { result.error = { code: error.code || error.name, message: 'Read-only inventory failed; connection details redacted' }; process.exitCode = 1; })
  .finally(async () => {
    if (client) await client.end().catch(() => {});
    fs.writeFileSync(__dirname + `/retirement-inventory-${result.at.replace(/[:.]/g, '-')}.json`, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(result, null, 2));
  });
