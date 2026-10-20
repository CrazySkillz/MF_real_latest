// One-off reviewed deployment operation, not an application route or startup hook.
// Reads only the named campaign's ownership and active connection identity.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto'), { parseEnv } = require('node:util');
const { Client } = require('pg');
const migration = 'migrations/0023_service_account_resource_grants.sql';
const migrationSql = fs.readFileSync(migration, 'utf8');

async function applyReviewedGrant(client, grant, { campaignName = 'Ptomo', apply = false } = {}) {
  assert.deepEqual(Object.keys(grant).sort(), ['clientId', 'ownerId', 'provider', 'resourceId']);
  for (const value of Object.values(grant)) assert.ok(typeof value === 'string' && value.length > 0);
  assert.equal(grant.provider, 'ga4'); assert.match(grant.resourceId, /^\d+$/);
  assert.equal((migrationSql.match(/^BEGIN;\r?$/gm) || []).length, 1);
  assert.equal((migrationSql.match(/^COMMIT;\r?$/gm) || []).length, 1);
  const result = { committed: false, dryRun: !apply, migration,
    migrationSha256: createHash('sha256').update(migrationSql).digest('hex') };
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try {
    await client.query("SET LOCAL lock_timeout TO '2s'; SET LOCAL statement_timeout TO '15s'");
    const campaigns = (await client.query(`SELECT c.id, c.owner_id, c.client_id, cl.owner_id AS client_owner_id
      FROM campaigns c JOIN clients cl ON cl.id=c.client_id
      WHERE c.name=$1 AND c.client_id=$2 AND c.status<>'deleted' FOR UPDATE OF c,cl`, [campaignName, grant.clientId])).rows;
    assert.equal(campaigns.length, 1, 'Exactly one reviewed campaign is required');
    assert.equal(campaigns[0].owner_id, grant.ownerId);
    assert.equal(campaigns[0].client_owner_id, grant.ownerId);
    const connections = (await client.query(`SELECT method,property_id FROM ga4_connections
      WHERE campaign_id=$1 AND is_active=true FOR UPDATE`, [campaigns[0].id])).rows;
    assert.equal(connections.length, 1, 'Exactly one active reviewed connection is required');
    assert.equal(connections[0].method, 'service_account');
    assert.equal(connections[0].property_id, grant.resourceId);
    result.campaignMatches = 1; result.activeConnectionMatches = 1;
    await client.query(migrationSql.replace(/^BEGIN;\r?$/m, '').replace(/^COMMIT;\r?$/m, ''));
    const columns = (await client.query(`SELECT column_name,data_type,is_nullable,column_default
      FROM information_schema.columns WHERE table_schema=current_schema()
      AND table_name='service_account_resource_grants' ORDER BY ordinal_position`)).rows;
    assert.deepEqual(columns.map(c => [c.column_name,c.data_type,c.is_nullable]), [
      ['id','character varying','NO'], ['owner_id','text','NO'], ['client_id','text','NO'],
      ['provider','text','NO'], ['resource_id','text','NO'], ['created_at','timestamp without time zone','NO'],
    ]);
    assert.match(columns[0].column_default, /gen_random_uuid\(\)/);
    assert.equal(columns[5].column_default, 'CURRENT_TIMESTAMP');
    const constraints = (await client.query(`SELECT contype, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid='service_account_resource_grants'::regclass AND contype IN ('f','p') ORDER BY contype`)).rows;
    assert.deepEqual(constraints, [
      { contype: 'f', definition: 'FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE' },
      { contype: 'p', definition: 'PRIMARY KEY (id)' },
    ]);
    const index = (await client.query(`SELECT i.indisvalid,i.indisready,i.indisunique,pg_get_indexdef(i.indexrelid) AS definition
      FROM pg_index i WHERE i.indexrelid='service_account_resource_grants_scope_idx'::regclass`)).rows[0];
    assert.ok(index?.indisvalid && index.indisready && index.indisunique);
    assert.ok(index.definition.endsWith(' USING btree (owner_id, client_id, provider, resource_id)'));
    const values = [grant.ownerId, grant.clientId, grant.provider, grant.resourceId];
    const written = await client.query(`INSERT INTO service_account_resource_grants(owner_id,client_id,provider,resource_id)
      VALUES($1,$2,$3,$4) ON CONFLICT(owner_id,client_id,provider,resource_id) DO NOTHING`, values);
    result.grantsInserted = written.rowCount;
    const match = await client.query(`SELECT count(*)::int AS n FROM service_account_resource_grants
      WHERE owner_id=$1 AND client_id=$2 AND provider=$3 AND resource_id=$4`, values);
    assert.equal(match.rows[0].n, 1);
    result.exactGrantMatches = 1; result.schemaVerified = true;
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    result.committed = apply; result.rolledBack = !apply;
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

module.exports = { applyReviewedGrant };

if (require.main === module) (async () => {
  const apply = process.argv.includes('--apply');
  const verifyOnly = process.argv.includes('--verify-only');
  assert.ok(!(apply && verifyOnly));
  const output = `docs/fixes/v1-batch-1/database-grants-${verifyOnly ? 'deployed-verification' : apply ? 'deployment' : 'preflight'}.json`;
  const result = { at: new Date().toISOString(), targetBinding: 'User confirmed Render uses repository DATABASE_URL.',
    boundary: 'Exact reviewed Ptomo permission only; no analytics, credential or connection writes; no provider calls.', committed: false };
  let client;
  try {
    const raw = fs.readFileSync('audit-temp/ptomo-service-account-grants.json');
    assert.equal(createHash('sha256').update(raw).digest('hex'), '200b7e1555382583204e1ef3b1b2005603849530b8ef327d79d1ce0c9f44b658');
    const grants = JSON.parse(raw); assert.equal(grants.length, 1);
    const env = parseEnv(fs.readFileSync('.env', 'utf8'));
    const url = new URL(env.DATABASE_URL);
    for (const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options']) url.searchParams.delete(key);
    client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: true },
      application_name: 'mf-reviewed-ptomo-resource-grant', connectionTimeoutMillis: 5000,
      statement_timeout: 15000, query_timeout: 20000, idle_in_transaction_session_timeout: 15000 });
    await client.connect(); result.verifiedTlsConnection = true;
    await client.query('SET search_path TO public');
    if (verifyOnly) {
      await client.query('BEGIN READ ONLY');
      const grant = grants[0];
      const matches = (await client.query(`SELECT count(*)::int AS n FROM service_account_resource_grants g
        JOIN campaigns c ON c.client_id=g.client_id AND c.owner_id=g.owner_id
        JOIN clients cl ON cl.id=c.client_id AND cl.owner_id=c.owner_id
        JOIN ga4_connections ga ON ga.campaign_id=c.id AND ga.property_id=g.resource_id
        WHERE c.name='Ptomo' AND c.status<>'deleted' AND ga.is_active=true AND ga.method='service_account'
        AND g.owner_id=$1 AND g.client_id=$2 AND g.provider=$3 AND g.resource_id=$4`,
        [grant.ownerId,grant.clientId,grant.provider,grant.resourceId])).rows[0].n;
      assert.equal(matches, 1); result.exactGrantMatches = matches; result.readOnly = true;
      await client.query('ROLLBACK');
    } else Object.assign(result, await applyReviewedGrant(client, grants[0], { apply }));
  } catch (error) { result.errorCode = error.code || error.name; process.exitCode = 1; }
  finally {
    if (client) await client.end().catch(() => {});
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ ...result, evidence: output }));
  }
})();
