// Bounded PDF reconciliation: read-only database transaction; no application/provider calls.
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const { Client } = require('pg');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const output = `${__dirname}/pdf-native-breakdown-readonly.json`;
assert.ok(!fs.existsSync(output));
const result = { at: new Date().toISOString(), productionWrites: false, providerCalls: false };
let db;
(async () => {
  const env = parseEnv(fs.readFileSync('.env', 'utf8'));
  const url = new URL(env.DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])),
    '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  db = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true },
    application_name: 'mf-pdf-native-breakdown-readonly', options: '-c default_transaction_read_only=on',
    connectionTimeoutMillis: 10000, statement_timeout: 10000, query_timeout: 12000,
    lock_timeout: 2000, idle_in_transaction_session_timeout: 15000 });
  await db.connect();
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  const campaigns = (await db.query('SELECT id, owner_id IS NOT NULL AS owned FROM campaigns WHERE name=$1', ['V1 Batch 5 Test'])).rows;
  assert.equal(campaigns.length, 1);
  const campaign = campaigns[0];
  assert.equal(campaign.owned, true);
  assert.equal(hash(campaign.id), 'de4775c3b435c3350ea24f5d538e60e639c9f9cd21de63d5432956b44551e722');
  const snapshots = (await db.query('SELECT window_start, window_end, updated_at::text AS updated_at_utc, campaign_breakdown FROM ga4_overview_snapshots WHERE campaign_id=$1', [campaign.id])).rows;
  result.snapshots = snapshots.map(snapshot => {
    const breakdown = typeof snapshot.campaign_breakdown === 'string' ? JSON.parse(snapshot.campaign_breakdown) : snapshot.campaign_breakdown;
    return { windowStart: snapshot.window_start, windowEnd: snapshot.window_end, updatedAtUtc: snapshot.updated_at_utc,
      simulated: breakdown?.isSimulated ?? null, totals: breakdown?.totals,
      rows: (breakdown?.rows || []).map(row => ({ campaign: row.campaign, revenue: row.revenue, sessions: row.sessions, conversions: row.conversions, sessionKeyEventRate: row.sessionKeyEventRate })) };
  });
  const sources = (await db.query("SELECT source_type, mapping_config FROM revenue_sources WHERE campaign_id=$1 AND is_active=true AND (platform_context='ga4' OR platform_context IS NULL)", [campaign.id])).rows;
  result.sourceMappings = sources.map(source => {
    const cfg = typeof source.mapping_config === 'string' ? JSON.parse(source.mapping_config) : source.mapping_config || {};
    return { type: source.source_type, campaignMappings: (cfg.campaignMappings || []).map(mapping => ({
      crmValue: mapping.crmValue, campaignName: mapping.linkedinCampaignName, campaignUrn: mapping.linkedinCampaignUrn })),
      confirmedValueTotals: cfg.campaignValueRevenueTotals || [] };
  });
  await db.query('ROLLBACK');
  result.transactionEnded = 'ROLLBACK';
  result.result = 'READ_ONLY_CHECK_COMPLETE';
})().catch(error => { result.result = 'CHECK_FAILED'; result.errorCode = error.code || error.name; process.exitCode = 1; })
.finally(async () => {
  if (db) await db.end().catch(() => {});
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result, null, 2));
});
