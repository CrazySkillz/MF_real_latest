// Exact known campaign; enforced READ ONLY; no provider calls or application imports.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
process.env.TZ = 'UTC';
const campaignId = '36493a43-accd-4360-8ff2-de62f5a19b6e';
const reportingDate = '2026-10-26';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const result = { at: new Date().toISOString(), campaignHash: hash(campaignId).slice(0, 12), reportingDate };
let client;
(async () => {
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'batch8-publication-readonly', connectionTimeoutMillis: 10000, statement_timeout: 12000, query_timeout: 15000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  result.readOnly = true;
  const campaign = (await client.query('SELECT status,currency,reporting_time_zone FROM campaigns WHERE id=$1', [campaignId])).rows;
  assert.equal(campaign.length, 1); result.campaign = campaign[0];
  const snapshots = (await client.query("SELECT snapshot_type,reporting_date,recorded_at,metrics,notes FROM metric_snapshots WHERE campaign_id=$1 AND reporting_date=$2 AND snapshot_type IN ('financial_daily','executive_summary_daily')", [campaignId, reportingDate])).rows;
  result.snapshots = snapshots.map(row => ({ type: row.snapshot_type, date: row.reporting_date, recordedAt: row.recorded_at,
    financial: row.metrics?.financialDaily, executive: row.metrics?.executiveSummaryDaily ? { currency: row.metrics.executiveSummaryDaily.currency, window: row.metrics.executiveSummaryDaily.currentValueWindow, totals: row.metrics.executiveSummaryDaily.totals } : undefined,
    aligned: row.notes?.startsWith(`ga4_aligned_refresh_v1:${reportingDate}:`) || false,
    alignedAt: row.notes?.startsWith(`ga4_aligned_refresh_v1:${reportingDate}:`) ? row.notes.slice(`ga4_aligned_refresh_v1:${reportingDate}:`.length) : null }));
  result.overview = (await client.query('SELECT window_start,window_end,updated_at,campaign_breakdown->\'totals\' AS totals FROM ga4_overview_snapshots WHERE campaign_id=$1', [campaignId])).rows;
  result.work = [];
  for (const kind of ['daily', 'revenue_change']) {
    const rows = (await client.query("SELECT id,status,reporting_date,due_at,started_at,completed_at,updated_at,attempt_count,retryable,last_error,scope_hash FROM ga4_refresh_work WHERE campaign_id=$1 AND COALESCE(scope->>'kind','daily')=$2 ORDER BY due_at DESC LIMIT 4", [campaignId, kind])).rows;
    for (const row of rows) { const { id, scope_hash, ...safe } = row; result.work.push({ kind, workHash: hash(id).slice(0, 12), invalidated: scope_hash.startsWith('invalidated:'), ...safe }); }
  }
  await client.query('ROLLBACK');
})().catch(error => { result.error = { code: error.code || error.name, message: 'Read-only verification failed; connection details redacted' }; process.exitCode = 1; })
  .finally(async () => { if (client) await client.end().catch(() => {}); const name = `active-${result.at.replace(/[:.]/g, '-')}.json`; fs.writeFileSync(__dirname + '/' + name, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(result)); });
