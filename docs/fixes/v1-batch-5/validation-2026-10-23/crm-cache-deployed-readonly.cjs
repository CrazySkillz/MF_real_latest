// Exact user fixture; no application imports, provider calls, refresh requests or production writes.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const { Client } = require('pg');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const result = { at: new Date().toISOString(), campaignName: 'V1 Batch 5 Test', productionWrites: false, providerCalls: false };
const output = `${__dirname}/crm-cache-deployed-readonly.json`;
assert.ok(!fs.existsSync(output));
let db;
(async () => {
  const response = await fetch('https://marketforensics.onrender.com/api/health', { signal: AbortSignal.timeout(20000) });
  const health = await response.json();
  result.liveHealth = { status: response.status, ok: health.ok, commit: health.commit };
  assert.equal(response.status, 200); assert.equal(health.ok, true);
  assert.equal(health.commit, 'b9a81999356d51b772a6c699265557422a4b6397');
  const env = parseEnv(fs.readFileSync('.env', 'utf8'));
  const url = new URL(env.DATABASE_URL);
  result.databaseTargetSha256 = hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname]));
  assert.equal(result.databaseTargetSha256, '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  db = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'mf-crm-cache-deployed-readonly',
    options: '-c default_transaction_read_only=on', connectionTimeoutMillis: 10000, statement_timeout: 10000,
    query_timeout: 12000, lock_timeout: 2000, idle_in_transaction_session_timeout: 15000 });
  await db.connect();
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  result.databaseTimeZone = (await db.query('SHOW TimeZone')).rows[0].TimeZone;
  assert.equal(result.databaseTimeZone, 'UTC');
  const campaigns = (await db.query('SELECT id, currency, status, reporting_time_zone, owner_id IS NOT NULL AS owned FROM campaigns WHERE name=$1', [result.campaignName])).rows;
  assert.equal(campaigns.length, 1); const campaign = campaigns[0]; assert.equal(campaign.owned, true);
  assert.equal(hash(campaign.id), 'de4775c3b435c3350ea24f5d538e60e639c9f9cd21de63d5432956b44551e722');
  result.campaign = { ref: hash(campaign.id), currency: campaign.currency, status: campaign.status, reportingTimeZone: campaign.reporting_time_zone };
  const financial = (await db.query("SELECT reporting_date, recorded_at::text, metrics->'financialDaily' AS financial, metrics->'revenuePublication' AS receipt FROM metric_snapshots WHERE campaign_id=$1 AND snapshot_type='financial_daily' ORDER BY reporting_date DESC, recorded_at DESC LIMIT 1", [campaign.id])).rows[0];
  assert.ok(financial?.financial); const cutoff = financial.reporting_date;
  const sources = (await db.query("SELECT id, source_type, currency, is_active, mapping_config FROM revenue_sources WHERE campaign_id=$1 AND (platform_context='ga4' OR platform_context IS NULL) ORDER BY id", [campaign.id])).rows;
  const currentHashes = {};
  result.sources = [];
  for (const source of sources) {
    const rows = (await db.query('SELECT date, revenue, currency, external_id, sub_campaign_urn FROM revenue_records WHERE campaign_id=$1 AND revenue_source_id=$2 ORDER BY date', [campaign.id, source.id])).rows;
    const eligible = rows.filter(row => row.date >= '1900-01-01' && row.date <= cutoff);
    if (source.is_active) currentHashes[source.id] = hash(JSON.stringify([source.source_type, source.currency,
      eligible.map(row => JSON.stringify([row.date, String(row.revenue), row.currency, row.external_id, row.sub_campaign_urn])).sort()]));
    const cfg = typeof source.mapping_config === 'string' ? JSON.parse(source.mapping_config) : source.mapping_config || {};
    result.sources.push({ ref: hash(source.id), type: source.source_type, active: source.is_active, currency: source.currency,
      recordCount: rows.length, completedDayRevenue: eligible.reduce((sum, row) => sum + Math.round(Number(row.revenue) * 100), 0) / 100,
      saleDates: [...new Set(eligible.map(row => row.date))], futureRecordCount: rows.length - eligible.length,
      pipeline: { enabled: cfg.pipelineEnabled ?? null, stage: cfg.pipelineStageLabel ?? null,
        total: cfg.pipelineTotalToDate ?? null, currency: cfg.pipelineCurrency ?? null, updatedAt: cfg.pipelineLastUpdatedAt ?? null } });
  }
  const receipt = financial.receipt;
  const receiptWork = receipt?.workId ? (await db.query('SELECT status, completed_at FROM ga4_refresh_work WHERE id=$1 AND campaign_id=$2', [receipt.workId, campaign.id])).rows[0] : null;
  result.financial = { reportingDate: cutoff, recordedAtUtc: financial.recorded_at, currency: financial.financial.currency,
    window: financial.financial.currentValueWindow, revenue: financial.financial.inputs.revenue.value,
    spendAvailable: financial.financial.inputs.spend.available,
    receiptMatchesCurrentSources: JSON.stringify(Object.entries(receipt?.sources || {}).sort()) === JSON.stringify(Object.entries(currentHashes).sort()),
    receiptReportingDate: receipt?.reportingDate, receiptWorkStatus: receiptWork?.status, receiptCompletedAt: receiptWork?.completed_at };
  result.work = (await db.query("SELECT status, reporting_date, scope->>'kind' AS kind, due_at, started_at, completed_at, attempt_count, retryable FROM ga4_refresh_work WHERE campaign_id=$1 AND scope_hash NOT LIKE 'invalidated:%' ORDER BY due_at DESC LIMIT 5", [campaign.id])).rows;
  result.nativeOverview = (await db.query("SELECT window_start, window_end, updated_at::text AS updated_at_utc, campaign_breakdown->'totals'->>'revenue' AS revenue FROM ga4_overview_snapshots WHERE campaign_id=$1", [campaign.id])).rows;
  result.executive = (await db.query("SELECT reporting_date, recorded_at::text AS recorded_at_utc, notes FROM metric_snapshots WHERE campaign_id=$1 AND snapshot_type='executive_summary_daily' ORDER BY reporting_date DESC LIMIT 1", [campaign.id])).rows;
  result.kpis = (await db.query('SELECT platform_type, metric, current_value, status FROM kpis WHERE campaign_id=$1', [campaign.id])).rows;
  result.benchmarks = (await db.query('SELECT platform_type, metric, current_value FROM benchmarks WHERE campaign_id=$1', [campaign.id])).rows;
  result.reports = (await db.query('SELECT platform_type, report_type, schedule_enabled, status FROM linkedin_reports WHERE campaign_id=$1', [campaign.id])).rows;
  assert.equal(result.financial.receiptMatchesCurrentSources, true, 'Saved receipt differs from current source facts');
  assert.equal(receipt?.reportingDate, cutoff); assert.equal(receiptWork?.status, 'completed');
  assert.equal(result.sources.some(source => source.type === 'shopify' && source.active), false);
  assert.ok(result.sources.filter(source => source.type === 'shopify').every(source => source.recordCount === 0));
  assert.equal(Number(result.financial.revenue), 8003.96); assert.equal(result.financial.spendAvailable, false);
  assert.equal(result.sources.filter(source => source.active).reduce((sum, source) => sum + source.completedDayRevenue, 0), 350);
  await db.query('ROLLBACK'); result.transactionEnded = 'ROLLBACK'; result.result = 'READ_ONLY_CHECK_COMPLETE';
})().catch(error => {
  result.result = 'CHECK_FAILED'; result.errorCode = error.code || error.name; process.exitCode = 1;
}).finally(async () => {
  if (db) await db.end().catch(() => {});
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result, null, 2));
});
