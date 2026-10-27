// Verify the user's deletion; SELECT-only transaction, no application/provider imports.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
process.env.TZ = 'UTC';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const names = ['Insta', 'Google', 'GA4 single', 'new_testersw', 'tert', 'client1', 'Client2', 'new_client'];
const campaignHashes = ['6caf32c94dbe', '57141d52e81b', 'b0f65e7c7bfb', '4ba3d83a9f51', 'd9920c47fecf', '518aea3dc6ff', 'f15d247e7a62'];
const clientHashes = ['28653e2984ab', 'dcd835dcddad'];
const retainedTables = new Set(['notifications', 'inbound_webhook_receipts', 'ga4_connection_lifecycle_events']);
const result = { at: new Date().toISOString(), clientNames: names, knownCampaignHashes: campaignHashes };
let client;
(async () => {
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'batch8-user-deletion-verification-readonly', connectionTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 18000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  result.readOnly = true;
  result.remainingNamedClients = (await client.query(`SELECT name,left(encode(sha256(convert_to(id,'UTF8')),'hex'),12) AS client_hash FROM clients
    WHERE name=ANY($1::text[]) OR left(encode(sha256(convert_to(id,'UTF8')),'hex'),12)=ANY($2::text[])`, [names, clientHashes])).rows;
  result.remainingKnownCampaigns = (await client.query(`SELECT name,status FROM campaigns WHERE
    left(encode(sha256(convert_to(id,'UTF8')),'hex'),12)=ANY($1::text[]) OR left(encode(sha256(convert_to(client_id,'UTF8')),'hex'),12)=ANY($2::text[])`, [campaignHashes, clientHashes])).rows;
  result.abn = (await client.query(`SELECT c.name,c.status,c.currency,cl.name AS client_name,
    left(encode(sha256(convert_to(c.owner_id,'UTF8')),'hex'),12) AS owner_hash,
    left(encode(sha256(convert_to(c.client_id,'UTF8')),'hex'),12) AS client_hash,
    c.owner_id=cl.owner_id AS owner_matches
    FROM campaigns c INNER JOIN clients cl ON cl.id=c.client_id WHERE c.id=$1`, ['36493a43-accd-4360-8ff2-de62f5a19b6e'])).rows;
  const tables = (await client.query(`SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t
    ON c.table_schema=t.table_schema AND c.table_name=t.table_name WHERE c.table_schema='public' AND c.column_name='campaign_id' AND t.table_type='BASE TABLE' ORDER BY c.table_name`)).rows;
  result.knownCampaignChildren = [];
  for (const { table_name } of tables) {
    assert.match(table_name, /^[a-z_][a-z0-9_]*$/);
    const row = (await client.query(`SELECT count(*)::int AS count FROM "${table_name}"
      WHERE left(encode(sha256(convert_to(campaign_id,'UTF8')),'hex'),12)=ANY($1::text[])`, [campaignHashes])).rows[0];
    result.knownCampaignChildren.push({ table: table_name, retainedHistory: retainedTables.has(table_name), ...row });
  }
  result.orphanWorkAndSchedules = {};
  for (const table of ['ga4_refresh_work', 'ga4_connections', 'linkedin_reports', 'kpi_reports']) {
    result.orphanWorkAndSchedules[table] = (await client.query(`SELECT count(*)::int AS count FROM "${table}" t
      WHERE NULLIF(t.campaign_id,'') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id=t.campaign_id)`)).rows[0].count;
  }
  result.knownCampaignVisibleNotifications = (await client.query(`SELECT count(*)::int AS count FROM notifications
    WHERE left(encode(sha256(convert_to(campaign_id,'UTF8')),'hex'),12)=ANY($1::text[])
    AND COALESCE(NULLIF(metadata,'')::jsonb->>'dismissedAt','')=''`, [campaignHashes])).rows[0].count;
  result.orphanReportScheduleStates = (await client.query(`SELECT r.platform_type,r.status,r.schedule_enabled,count(*)::int AS count
    FROM linkedin_reports r WHERE NULLIF(r.campaign_id,'') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id=r.campaign_id)
    GROUP BY r.platform_type,r.status,r.schedule_enabled`)).rows;
  result.orphanGA4ConnectionStates = (await client.query(`SELECT g.is_active,g.method,count(*)::int AS count
    FROM ga4_connections g WHERE NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id=g.campaign_id)
    GROUP BY g.is_active,g.method`)).rows;
  result.checks = {
    eightNamedClientsAbsent: result.remainingNamedClients.length===0,
    sevenKnownCampaignsAbsent: result.remainingKnownCampaigns.length===0,
    knownCampaignOperationalChildrenAbsent: result.knownCampaignChildren.every(row => row.retainedHistory || row.count===0),
    knownCampaignNotificationsHidden: result.knownCampaignVisibleNotifications===0,
    noOrphanGA4RefreshWork: result.orphanWorkAndSchedules.ga4_refresh_work===0,
    noOrphanGA4Connections: result.orphanWorkAndSchedules.ga4_connections===0,
    abnCampaignPresentAndOwned: result.abn.length===1 && result.abn[0].status==='active' && result.abn[0].client_name==='ABN' && result.abn[0].owner_matches
  };
  await client.query('ROLLBACK');
})().catch(error => { result.error = { code: error.code || error.name, message: 'Read-only deletion verification failed; connection details redacted' }; process.exitCode = 1; })
  .finally(async () => {
    if (client) await client.end().catch(() => {});
    fs.writeFileSync(__dirname + `/deletion-verification-${result.at.replace(/[:.]/g, '-')}.json`, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ at: result.at, error: result.error, remainingNamedClients: result.remainingNamedClients, remainingKnownCampaigns: result.remainingKnownCampaigns,
      abn: result.abn, tablesChecked: result.knownCampaignChildren?.length, remainingChildren: result.knownCampaignChildren?.filter(row => row.count),
      orphanWorkAndSchedules: result.orphanWorkAndSchedules, orphanReportScheduleStates: result.orphanReportScheduleStates,
      orphanGA4ConnectionStates: result.orphanGA4ConnectionStates, checks: result.checks }, null, 2));
  });
