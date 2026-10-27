// Bounded production SELECTs only. No app imports, provider requests, tokens or customer names in output.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
process.env.TZ = 'UTC';
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const idHash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
const result = { at: new Date().toISOString(), boundary: 'TLS-verified SELECTs in a read-only transaction; exact previously confirmed database; two publicly failing/recently recovered campaign hashes only', work: [] };
let client;
(async () => {
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  result.databaseTargetSha256 = hash([url.hostname, url.port || '5432', url.pathname]);
  assert.equal(result.databaseTargetSha256, '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'batch8-scheduler-readonly', connectionTimeoutMillis: 10000, statement_timeout: 12000, query_timeout: 15000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  result.readOnly = true;
  const campaigns = (await client.query('SELECT id, created_at AS "createdAt", owner_id AS "ownerId", client_id AS "clientId", status, ga4_campaign_filter AS "ga4CampaignFilter", currency, reporting_time_zone AS "reportingTimeZone" FROM campaigns')).rows
    .filter(row => ['6caf32c94dbe', 'de4775c3b435'].includes(idHash(row.id)));
  for (const campaign of campaigns) {
    const sources = (await client.query("SELECT id,source_type,platform_context,is_active,mapping_config FROM revenue_sources WHERE campaign_id=$1", [campaign.id])).rows;
    result.sources ||= [];
    for (const source of sources) {
      let mapping = {}; try { mapping = JSON.parse(source.mapping_config || '{}'); } catch {}
      result.sources.push({ campaignHash: idHash(campaign.id), sourceHash: idHash(source.id), type: source.source_type, context: source.platform_context, active: source.is_active,
        mappingKeys: Object.keys(mapping), times: Object.fromEntries(Object.entries(mapping).filter(([key, value]) => /at$|date$|time$|updated/i.test(key) && typeof value === 'string' && /^\d{4}-\d\d-\d\d/.test(value))) });
    }
    const connections = (await client.query('SELECT id,property_id AS "propertyId",import_start_date AS "importStartDate",is_primary AS "isPrimary",method,lookback_days AS "lookbackDays",connected_at AS "connectedAt" FROM ga4_connections WHERE campaign_id=$1 AND is_active=true ORDER BY id', [campaign.id])).rows;
    const work = (await client.query('SELECT id,status,reporting_date,due_at::text,started_at::text,updated_at::text,lease_expires_at::text,completed_at::text,attempt_count,retryable,last_error,scope_hash,scope FROM ga4_refresh_work WHERE campaign_id=$1 ORDER BY due_at DESC LIMIT 12', [campaign.id])).rows;
    for (const row of work) {
      const scope = { version: 1, campaign, connections, ...(['initial_import', 'revenue_change'].includes(row.scope?.kind) ? { kind: row.scope.kind } : {}) };
      result.work.push({ campaignHash: idHash(campaign.id), workHash: idHash(row.id), status: row.status, campaignStatus: campaign.status, kind: row.scope?.kind || 'daily',
        reportingDate: row.reporting_date, dueAt: row.due_at, startedAt: row.started_at, updatedAt: row.updated_at, leaseExpiresAt: row.lease_expires_at, completedAt: row.completed_at,
        attemptCount: row.attempt_count, retryable: row.retryable, error: /^[A-Z0-9_]+$/.test(row.last_error || '') ? row.last_error : row.last_error ? 'redacted-non-code' : null,
        invalidated: row.scope_hash.startsWith('invalidated:'), scopeMatchesCurrent: hash(scope) === row.scope_hash,
        changedCampaignFields: Object.keys(campaign).filter(key => JSON.stringify(campaign[key] ?? null) !== JSON.stringify(row.scope?.campaign?.[key] ?? null)),
        connectionsMatch: connections.length === row.scope?.connections?.length && connections.every(connection => {
          const saved = row.scope.connections.find(value => value.id === connection.id);
          return saved && Object.keys(connection).every(key => JSON.stringify(connection[key] ?? null) === JSON.stringify(saved[key] ?? null));
        }), activeConnections: connections.length });
    }
  }
  await client.query('ROLLBACK');
})().catch(error => { result.error = { code: error.code || error.name, message: 'Read-only diagnosis stopped; no credentials or database target details emitted' }; process.exitCode = 1; })
  .finally(async () => { if (client) await client.end().catch(() => {}); fs.writeFileSync(__dirname + '/scheduler-state-verified.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ ...result, work: result.work.filter(row => !row.invalidated) })); });
