// One-time operator procedure; never loaded by the application. No provider calls.
const assert = require('node:assert/strict');
const tables = ['clients', 'campaigns', 'campaign_creation_requests', 'service_account_resource_grants'];
const identityColumns = ['ab_test_events.user_id', 'attribution_models.owner_id',
  'campaign_creation_requests.owner_id', 'campaigns.owner_id', 'clients.owner_id',
  'customer_journeys.owner_id', 'customer_journeys.user_id', 'integrations.owner_id',
  'mapping_templates.created_by', 'metrics.owner_id', 'mimosaas_website_connections.owner_id',
  'performance_data.owner_id', 'service_account_resource_grants.owner_id'];

function validateMappings(mappings) {
  assert.equal(mappings.length, 2, 'Exactly two separate accounts required');
  const ids = mappings.flatMap(m => [m.from, m.to]);
  ids.forEach(id => assert.match(id, /^user_[A-Za-z0-9]{10,80}$/));
  assert.equal(new Set(ids).size, 4, 'Account identities must be distinct');
}

async function capture(client, mappings, excludedCampaigns = []) {
  validateMappings(mappings);
  const owners = mappings.map(m => m.from), destinations = mappings.map(m => m.to);
  const refs = (await client.query(`SELECT table_name,column_name FROM information_schema.columns
    WHERE table_schema=current_schema() AND column_name IN ('owner_id','user_id','created_by','actor_id')
    ORDER BY table_name,column_name`)).rows;
  assert.deepEqual(refs.map(r => `${r.table_name}.${r.column_name}`), identityColumns, 'Identity schema changed');
  const sideEffects = await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=current_schema() AND c.relname=ANY($1::text[]) AND
    (c.relrowsecurity OR EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)
      OR EXISTS(SELECT 1 FROM pg_rewrite r WHERE r.ev_class=c.oid))`, [tables]);
  assert.equal(sideEffects.rowCount, 0, 'Unexpected trigger, rule or row security');
  const external = [];
  for (const { table_name: table, column_name: column } of refs) {
    // Names have already matched the fixed inventory; only values are parameters.
    const counts = (await client.query(`SELECT
      count(*) FILTER(WHERE "${column}"=ANY($1::text[]))::int AS source,
      count(*) FILTER(WHERE "${column}"=ANY($2::text[]))::int AS destination
      FROM "${table}" ${table === 'campaigns' ? 'WHERE NOT(id=ANY($3::text[]))' : ''}`,
    table === 'campaigns' ? [owners, destinations, excludedCampaigns] : [owners, destinations])).rows[0];
    if (table === 'mimosaas_website_connections') {
      // Separate website ownership stays exactly as it is, including on rollback.
      external.push({ table, ...counts });
    } else {
      assert.equal(counts.destination, 0, `Destination already owns rows in ${table}`);
      if (!tables.includes(table)) assert.equal(counts.source, 0, `Unplanned identity references in ${table}`);
    }
  }
  const rows = {}, unchanged = {};
  const excluded = await client.query('SELECT id FROM campaigns WHERE id=ANY($1::text[]) AND client_id IS NULL ORDER BY id', [excludedCampaigns]);
  assert.deepEqual(excluded.rows.map(r => r.id), [...excludedCampaigns].sort(), 'Historical exclusion boundary changed');
  for (const table of tables) {
    const exclusions = table === 'campaigns' ? excludedCampaigns : [];
    rows[table] = (await client.query(`SELECT id,owner_id,
      ${table === 'clients' ? 'NULL::text' : 'client_id'} AS client_id,
      ${['clients', 'campaigns'].includes(table) ? 'name' : 'NULL::text'} AS name,
      md5((to_jsonb(t)-'owner_id')::text) AS non_owner_hash
      FROM "${table}" t WHERE owner_id=ANY($1::text[]) AND NOT(id=ANY($2::text[])) ORDER BY id`, [owners, exclusions])).rows;
    unchanged[table] = (await client.query(`SELECT id,md5(to_jsonb(t)::text) AS hash
      FROM "${table}" t WHERE owner_id IS NULL OR NOT(owner_id=ANY($1::text[])) OR id=ANY($2::text[]) ORDER BY id`, [owners, exclusions])).rows;
  }
  for (const table of tables.slice(1)) {
    const inconsistent = await client.query(`SELECT t.id FROM "${table}" t LEFT JOIN clients c ON c.id=t.client_id
      WHERE (t.owner_id=ANY($1::text[]) OR c.owner_id=ANY($1::text[]))
      AND (c.id IS NULL OR t.owner_id IS DISTINCT FROM c.owner_id) AND NOT(t.id=ANY($2::text[]))`,
    [owners, table === 'campaigns' ? excludedCampaigns : []]);
    assert.equal(inconsistent.rowCount, 0, `Ownership/parent mismatch in ${table}: ${JSON.stringify(inconsistent.rows)}`);
  }
  const campaigns = rows.campaigns.map(r => r.id);
  const work = (await client.query(`SELECT id,md5(to_jsonb(w)::text) AS hash FROM ga4_refresh_work w
    WHERE campaign_id=ANY($1::text[]) ORDER BY id`, [campaigns])).rows;
  const busy = await client.query(`SELECT id FROM ga4_refresh_work WHERE campaign_id=ANY($1::text[])
    AND (status='running' OR lease_token IS NOT NULL OR
      (status<>'completed' AND scope_hash NOT LIKE 'invalidated:%'))`, [campaigns]);
  assert.equal(busy.rowCount, 0, 'Unfinished refresh work; postpone cutover');
  return { mappings, excludedCampaigns, rows, unchanged, external, work };
}

async function transfer(client, plan, { commit = false, beforeCommit } = {}) {
  validateMappings(plan.mappings);
  if (commit) assert.equal(typeof beforeCommit, 'function', 'Durable rollback receipt required');
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  let commitAttempted = false;
  try {
    await client.query("SET LOCAL lock_timeout='3s'");
    await client.query("SET LOCAL statement_timeout='15s'");
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    // Briefly freeze only the four ownership tables and work queue. Reads continue.
    // Conflict/timeout aborts; there is no retry that could bypass the preflight.
    await client.query('LOCK TABLE clients,campaigns,campaign_creation_requests,service_account_resource_grants,ga4_refresh_work IN SHARE ROW EXCLUSIVE MODE');
    const before = await capture(client, plan.mappings, plan.excludedCampaigns);
    assert.deepEqual(before, plan, 'Reviewed ownership scope or saved data changed');
    let changed = 0;
    for (const table of tables) {
      for (const row of plan.rows[table]) {
        const mapping = plan.mappings.find(m => m.from === row.owner_id);
        const update = await client.query(`UPDATE "${table}" SET owner_id=$1 WHERE id=$2 AND owner_id=$3 RETURNING id`,
          [mapping.to, row.id, mapping.from]);
        assert.equal(update.rowCount, 1, `Exact update failed in ${table}`);
        changed++;
      }
    }
    const reverseMappings = plan.mappings.map(m => ({ from: m.to, to: m.from }));
    const rollbackPlan = await capture(client, reverseMappings, plan.excludedCampaigns);
    for (const table of tables) {
      assert.deepEqual(rollbackPlan.rows[table], plan.rows[table].map(row => ({ ...row,
        owner_id: plan.mappings.find(m => m.from === row.owner_id).to })), 'Non-owner data changed');
    }
    assert.deepEqual(rollbackPlan.unchanged, plan.unchanged, 'Unrelated rows changed');
    assert.deepEqual(rollbackPlan.work, plan.work, 'Refresh history changed');
    assert.deepEqual(rollbackPlan.external, plan.external.map(r => ({ ...r, source: r.destination, destination: r.source })),
      'External website ownership changed');
    const receipt = { at: new Date().toISOString(), changed, rollbackPlan };
    if (commit) {
      await beforeCommit(receipt); // Disk failure prevents COMMIT, rather than losing rollback instructions.
      commitAttempted = true;
      await client.query('COMMIT');
    } else await client.query('ROLLBACK');
    return { ...receipt, result: commit ? 'COMMITTED' : 'REHEARSAL_ROLLED_BACK' };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (commitAttempted) throw new Error('COMMIT_OUTCOME_UNCERTAIN: inspect exact owners before any retry');
    throw error;
  }
}
module.exports = { capture, transfer, tables };
