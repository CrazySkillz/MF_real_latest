// Follow-up to the read-only inventory: distinguish surviving dependencies from
// orphaned history. No application imports or data changes; output hashes/counts only.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
const dir = 'docs/fixes/v1-batch-4/validation-2026-10-23-custom-integration/';
const out = dir + 'predeploy-current-dependencies.json';
assert.ok(!fs.existsSync(out));
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const result = { at: new Date().toISOString(), productionWrites: false, scope: 'Surviving Custom Integration campaign dependencies; no customer names, IDs, emails, filenames or values in output' };
let db;
(async () => {
  const before = JSON.parse(fs.readFileSync(dir + 'predeploy-compatibility.json', 'utf8'));
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), before.databaseTargetSha256);
  result.databaseTargetSha256 = before.databaseTargetSha256;
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options']) url.searchParams.delete(key);
  db = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'mf-batch4-custom-current-dependencies',
    options: '-c default_transaction_read_only=on', connectionTimeoutMillis: 10000, statement_timeout: 10000,
    query_timeout: 12000, lock_timeout: 2000, idle_in_transaction_session_timeout: 15000 });
  await db.connect(); await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  result.readOnly = (await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only === 'on';
  assert.equal(result.readOnly, true);
  const rows = (await db.query(`SELECT c.id,c.status,c.platform,c.currency,c.owner_id IS NOT NULL AS has_owner,
    p.id IS NOT NULL AS has_client,p.owner_id=c.owner_id AS same_client_owner,c.id='temp-campaign-setup' AS temp_setup,
    lower(c.name)='ptomo' AS ptomo,
    (SELECT count(*)::int FROM custom_integrations i WHERE i.campaign_id=c.id) connections,
    (SELECT count(*)::int FROM custom_integration_metrics m WHERE m.campaign_id=c.id) imports,
    (SELECT count(*)::int FROM kpis k WHERE k.campaign_id=c.id) kpis,
    (SELECT count(*)::int FROM benchmarks b WHERE b.campaign_id=c.id) benchmarks,
    (SELECT count(*)::int FROM linkedin_reports r WHERE r.campaign_id=c.id) reports,
    (SELECT count(*)::int FROM linkedin_reports r WHERE r.campaign_id=c.id AND r.schedule_enabled) scheduled_reports,
    (SELECT count(*)::int FROM kpi_reports r WHERE r.campaign_id=c.id AND r.schedule_enabled) scheduled_kpi_reports,
    (SELECT count(*)::int FROM report_snapshots s WHERE s.campaign_id=c.id) report_snapshots,
    (SELECT count(*)::int FROM metric_snapshots s WHERE s.campaign_id=c.id) metric_snapshots,
    latest.parser_metadata,latest.uploaded_at::text latest_upload,
    latest.pdf_file_name IS NOT NULL AS has_source_filename,latest.email_id IS NOT NULL AS has_email_id
    FROM campaigns c LEFT JOIN clients p ON p.id=c.client_id
    LEFT JOIN LATERAL (SELECT parser_metadata,uploaded_at,pdf_file_name,email_id FROM custom_integration_metrics m
      WHERE m.campaign_id=c.id ORDER BY uploaded_at DESC,id DESC LIMIT 1) latest ON true
    WHERE EXISTS (SELECT 1 FROM custom_integrations i WHERE i.campaign_id=c.id)
       OR EXISTS (SELECT 1 FROM custom_integration_metrics m WHERE m.campaign_id=c.id)
    ORDER BY c.id LIMIT 251`)).rows;
  assert.ok(rows.length <= 250);
  result.campaigns = rows.map(({ id, parser_metadata: metadata, ...r }) => ({ campaignSha256: hash(id), ...r,
    currentValidationAccepted: metadata?.validationVersion === 2 && metadata.requiresReview === false && Number(metadata.confidence) >= 95
      && Number(metadata.extractedFields) > 0 && Array.isArray(metadata.warnings) && metadata.warnings.length === 0,
    parserMetadataPresent: metadata != null, sourceValidationVersion: metadata?.validationVersion ?? null,
    historicalRequiresReview: typeof metadata?.requiresReview === 'boolean' ? metadata.requiresReview : null }));
  result.survivingCampaignsWithImports = rows.filter(r => r.imports > 0).length;
  result.survivingImportRows = rows.reduce((n,r) => n + r.imports, 0);
  result.ownedNondeletedCampaignsWithImports = rows.filter(r => r.imports > 0 && r.has_owner && r.status !== 'deleted').length;
  await db.query('ROLLBACK'); result.transactionEnded = 'ROLLBACK'; result.result = 'READ_ONLY_INVENTORY_COMPLETE';
})().catch(error => { result.result = 'CHECK_FAILED'; result.error = { code: error.code || error.name, message: 'Check failed; sensitive details withheld' }; process.exitCode = 1;
}).finally(async () => { if (db) await db.end().catch(() => {}); result.completedAt = new Date().toISOString(); fs.writeFileSync(out, JSON.stringify(result,null,2)+'\n',{flag:'wx'}); console.log(JSON.stringify(result,null,2)); });
