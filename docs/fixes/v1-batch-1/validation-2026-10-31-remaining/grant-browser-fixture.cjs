const assert = require('node:assert/strict'), crypto = require('node:crypto');
function plan(ownerId, resources) { const run = crypto.randomUUID(); return { version: 1, run, tag: `B1_GRANT_${run}`, ownerId, clientId: crypto.randomUUID(), campaignId: crypto.randomUUID(), resources }; }
function validate(m) {
  assert.equal(m.version, 1); assert.equal(m.tag, `B1_GRANT_${m.run}`);
  for (const value of [m.run, m.clientId, m.campaignId]) assert.match(value, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/);
  assert.equal(new Set([m.run, m.clientId, m.campaignId]).size, 3);
  assert.ok(m.ownerId); assert.match(m.resources.ga4, /^\d+$/); assert.match(m.resources.google_sheets, /^[A-Za-z0-9_-]{10,}$/);
  assert.ok(!['b74f98af-ede9-47af-9b19-0720ebb4d2c0', '36493a43-accd-4360-8ff2-de62f5a19b6e', '36631f9f-5f32-4ae6-8d20-d8430abb364c'].includes(m.campaignId));
}
async function inspect(client, m) {
  validate(m);
  const c = (await client.query('SELECT * FROM campaigns WHERE id=$1 FOR UPDATE', [m.campaignId])).rows;
  const cl = (await client.query('SELECT * FROM clients WHERE id=$1 FOR UPDATE', [m.clientId])).rows;
  assert.equal(c.length, 1); assert.equal(cl.length, 1);
  assert.equal(cl[0].owner_id, m.ownerId); assert.equal(cl[0].name, m.tag);
  for (const [key, value] of Object.entries({ owner_id: m.ownerId, client_id: m.clientId, name: m.tag, status: 'draft', platform: 'custom', currency: 'EUR', reporting_time_zone: 'Europe/Amsterdam' })) assert.equal(c[0][key], value);
  for (const field of ['spend', 'impressions', 'clicks']) assert.equal(Number(c[0][field]), 0);
  for (const field of ['conversion_value', 'ga4_campaign_filter', 'budget', 'start_date', 'end_date']) assert.equal(c[0][field] ?? null, null);
  assert.equal((await client.query('SELECT id FROM campaigns WHERE client_id=$1', [m.clientId])).rowCount, 1);
  // Refuse cleanup if any endpoint unexpectedly attached data or credentials.
  const columns = (await client.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema() AND column_name IN ('campaign_id','client_id') ORDER BY table_name,column_name")).rows;
  for (const { table_name: table, column_name: column } of columns) {
    assert.match(table, /^[a-z_][a-z0-9_]*$/);
    if (table === 'campaigns' && column === 'client_id') continue;
    const q = await client.query(`SELECT count(*)::int n FROM "${table}" WHERE "${column}"=$1`, [column === 'campaign_id' ? m.campaignId : m.clientId]);
    assert.equal(q.rows[0].n, 0, `Unplanned dependent: ${table}`);
  }
}
async function seed(client, m, commit = false) {
  validate(m); await client.query('BEGIN');
  try {
    await client.query("SET LOCAL statement_timeout='15s'"); await client.query("SET LOCAL lock_timeout='3s'");
    await client.query('INSERT INTO clients(id,owner_id,name) VALUES($1,$2,$3)', [m.clientId, m.ownerId, m.tag]);
    await client.query("INSERT INTO campaigns(id,owner_id,client_id,name,status,platform,currency,reporting_time_zone) VALUES($1,$2,$3,$4,'draft','custom','EUR','Europe/Amsterdam')", [m.campaignId, m.ownerId, m.clientId, m.tag]);
    await inspect(client, m); await client.query(commit ? 'COMMIT' : 'ROLLBACK'); return { result: 'PASS', rows: 2, committed: commit };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
async function cleanup(client, m, commit = false) {
  validate(m); await client.query('BEGIN');
  try {
    await client.query("SET LOCAL statement_timeout='15s'"); await client.query("SET LOCAL lock_timeout='3s'"); await inspect(client, m);
    assert.equal((await client.query('DELETE FROM campaigns WHERE id=$1 AND client_id=$2 AND owner_id=$3 AND name=$4 AND status=\'draft\'', [m.campaignId, m.clientId, m.ownerId, m.tag])).rowCount, 1);
    assert.equal((await client.query('DELETE FROM clients WHERE id=$1 AND owner_id=$2 AND name=$3', [m.clientId, m.ownerId, m.tag])).rowCount, 1);
    await client.query(commit ? 'COMMIT' : 'ROLLBACK'); return { result: 'PASS', rows: 2, committed: commit };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
module.exports = { plan, validate, inspect, seed, cleanup };
