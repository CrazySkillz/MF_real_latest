// Exact isolated user fixture. No application imports, credential output, provider calls or writes.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const { Client } = require('pg');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const result = { at: new Date().toISOString(), campaignName: 'V1 Batch 5 Test', productionWrites: false, providerCalls: false };
const output = `${__dirname}/hubspot-save-publication-diagnosis.json`;
assert.ok(!fs.existsSync(output));
let db;
const mapping = value => {
  const cfg = typeof value === 'string' ? JSON.parse(value) : value || {};
  return Object.fromEntries(['campaignProperty', 'selectedValues', 'revenueProperty', 'dateField', 'currency', 'lastTotalRevenue',
    'pipelineEnabled', 'pipelineStageId', 'pipelineStageLabel', 'pipelineTotalToDate', 'pipelineCurrency', 'pipelineLastUpdatedAt',
    'pipelineWarning', 'pipelineValueRevenueTotals', 'lastSyncedAt'].map(key => [key, cfg[key] ?? null]));
};
(async () => {
  const response = await fetch('https://marketforensics.onrender.com/api/health', { signal: AbortSignal.timeout(20000) });
  const health = await response.json();
  result.liveHealth = { status: response.status, ok: health.ok, commit: health.commit };
  assert.equal(response.status, 200); assert.equal(health.ok, true);
  assert.equal(health.commit, '9364b8894415a343616875bb1c224a75fc481d58');
  const env = parseEnv(fs.readFileSync('.env', 'utf8'));
  const url = new URL(env.DATABASE_URL);
  result.databaseTargetSha256 = hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname]));
  assert.equal(result.databaseTargetSha256, '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options']) url.searchParams.delete(key);
  db = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'mf-hubspot-save-readonly',
    options: '-c default_transaction_read_only=on', connectionTimeoutMillis: 10000, statement_timeout: 10000,
    query_timeout: 12000, lock_timeout: 2000, idle_in_transaction_session_timeout: 15000 });
  await db.connect();
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  const campaigns = (await db.query('SELECT id, currency, status, owner_id IS NOT NULL AS owned FROM campaigns WHERE name=$1', [result.campaignName])).rows;
  assert.equal(campaigns.length, 1); const campaign = campaigns[0]; assert.equal(campaign.owned, true);
  assert.equal(hash(campaign.id), 'de4775c3b435c3350ea24f5d538e60e639c9f9cd21de63d5432956b44551e722');
  result.campaign = { ref: hash(campaign.id), currency: campaign.currency, status: campaign.status };
  const sources = (await db.query("SELECT id, currency, is_active, mapping_config FROM revenue_sources WHERE campaign_id=$1 AND source_type='hubspot'", [campaign.id])).rows;
  result.hubspotSources = [];
  for (const source of sources) {
    const records = (await db.query('SELECT count(*)::int rows, sum(revenue) revenue, min(date) first_date, max(date) last_date FROM revenue_records WHERE campaign_id=$1 AND revenue_source_id=$2', [campaign.id, source.id])).rows[0];
    result.hubspotSources.push({ ref: hash(source.id), currency: source.currency, active: source.is_active, mapping: mapping(source.mapping_config), records });
  }
  result.financial = (await db.query("SELECT reporting_date, recorded_at, metrics->'financialDaily' AS financial_daily FROM metric_snapshots WHERE campaign_id=$1 AND snapshot_type='financial_daily' ORDER BY recorded_at DESC LIMIT 1", [campaign.id])).rows;
  result.work = (await db.query('SELECT status, completed_at, attempt_count, retryable FROM ga4_refresh_work WHERE campaign_id=$1 ORDER BY due_at DESC LIMIT 5', [campaign.id])).rows;
  await db.query('ROLLBACK'); result.transactionEnded = 'ROLLBACK'; result.result = 'READ_ONLY_CHECK_COMPLETE';
})().catch(error => {
  result.result = 'CHECK_FAILED'; result.errorCode = error.code || error.name;
  process.exitCode = 1;
}).finally(async () => {
  if (db) await db.end().catch(() => {});
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ result: result.result, liveHealth: result.liveHealth, hubspotSources: result.hubspotSources, work: result.work }));
});
