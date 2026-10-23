// Exact user-created fixture only; no application imports, provider calls or writes.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const { Client } = require('pg');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const result = { at: new Date().toISOString(), campaignName: 'V1 Batch 5 Test', productionWrites: false, providerCalls: false };
const label = process.argv[2] || 'postdeploy-recovery';
assert.match(label, /^[a-z0-9-]+$/);
const output = path.join(__dirname, `${label}.json`);
assert.ok(!fs.existsSync(output));
let db;
(async () => {
  const healthResponse = await fetch('https://marketforensics.onrender.com/api/health', { signal: AbortSignal.timeout(20000) });
  const health = await healthResponse.json();
  result.liveHealth = { status: healthResponse.status, ok: health.ok, commit: health.commit };
  assert.equal(healthResponse.status, 200); assert.equal(health.ok, true);
  assert.equal(health.commit, 'c056ad50983b5326eeaf36e4554f50e3b10a9244');
  const env = parseEnv(fs.readFileSync('.env', 'utf8'));
  const url = new URL(env.DATABASE_URL);
  result.databaseTargetSha256 = hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname]));
  const previous = JSON.parse(fs.readFileSync('docs/fixes/v1-batch-5/validation-2026-10-23/predeploy-compatibility-final.json', 'utf8'));
  assert.equal(result.databaseTargetSha256, previous.databaseTargetSha256);
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options']) url.searchParams.delete(key);
  db = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'mf-initial-financial-readonly',
    options: '-c default_transaction_read_only=on', connectionTimeoutMillis: 10000,
    statement_timeout: 10000, query_timeout: 12000, lock_timeout: 2000, idle_in_transaction_session_timeout: 15000 });
  await db.connect();
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  result.readOnly = (await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only === 'on';
  assert.equal(result.readOnly, true);
  const campaigns = (await db.query('SELECT id, status, currency, reporting_time_zone, created_at, owner_id IS NOT NULL AS owned FROM campaigns WHERE name=$1', [result.campaignName])).rows;
  assert.equal(campaigns.length, 1, 'Exact fixture must be unique');
  const campaign = campaigns[0]; assert.equal(campaign.owned, true);
  result.campaign = { ...campaign, id: undefined, ref: hash(campaign.id) };
  result.daily = (await db.query('SELECT count(*)::int rows, min(date) first_date, max(date) last_date, sum(revenue) revenue_sum, sum(conversions) conversions, max(updated_at) updated_at FROM ga4_daily_metrics WHERE campaign_id=$1', [campaign.id])).rows;
  result.overview = (await db.query(`SELECT window_start,window_end,updated_at,
    campaign_breakdown->'totals' AS totals, campaign_breakdown->'meta' AS meta
    FROM ga4_overview_snapshots WHERE campaign_id=$1`, [campaign.id])).rows;
  result.snapshots = (await db.query(`SELECT snapshot_type,reporting_date,recorded_at,
    metrics->'financialDaily' AS financial_daily FROM metric_snapshots WHERE campaign_id=$1 ORDER BY recorded_at DESC LIMIT 30`, [campaign.id])).rows;
  result.work = (await db.query(`SELECT status,reporting_date,due_at,completed_at,attempt_count,next_attempt_at,retryable,last_error,lease_expires_at,scope->>'kind' AS kind
    FROM ga4_refresh_work WHERE campaign_id=$1 ORDER BY due_at DESC LIMIT 30`, [campaign.id])).rows;
  result.sources = (await db.query(`SELECT 'revenue' AS kind,source_type,is_active,currency FROM revenue_sources WHERE campaign_id=$1
    UNION ALL SELECT 'spend',source_type,is_active,currency FROM spend_sources WHERE campaign_id=$1`, [campaign.id])).rows;
  result.connections = (await db.query('SELECT property_id,is_primary,is_active,import_start_date,connected_at FROM ga4_connections WHERE campaign_id=$1', [campaign.id])).rows;
  await db.query('ROLLBACK'); result.transactionEnded = 'ROLLBACK'; result.result = 'READ_ONLY_DIAGNOSIS_COMPLETE';
})().catch(error => {
  result.result = 'CHECK_FAILED'; result.error = { code: error.code || error.name, message: 'Read-only diagnosis failed; credential and database details withheld.' };
  process.exitCode = 1;
}).finally(async () => {
  if (db) await db.end().catch(() => {});
  result.completedAt = new Date().toISOString();
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result, null, 2));
});
