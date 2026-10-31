// Exact disposable draft records. Called only with an explicitly verified connection.
const assert = require('node:assert/strict');
const tables = { a: 'campaigns', b: 'campaigns', foreign: 'campaigns', linkedin: 'linkedin_connections', kpi: 'meta_kpis', benchmark: 'meta_benchmarks', custom: 'custom_integrations' };
const uuid = value => /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value || '');
function validate(m) {
  assert.equal(m.version, 1); assert.ok(uuid(m.run)); assert.equal(m.tag, `B1_SOURCE_${m.run}`);
  assert.deepEqual(Object.keys(m.ids).sort(), Object.keys(tables).sort());
  assert.equal(new Set(Object.values(m.ids)).size, 7); for (const id of Object.values(m.ids)) assert.ok(uuid(id));
  for (const id of Object.values(m.ids)) assert.ok(!['b74f98af-ede9-47af-9b19-0720ebb4d2c0','36493a43-accd-4360-8ff2-de62f5a19b6e','36631f9f-5f32-4ae6-8d20-d8430abb364c'].includes(id));
}
async function snapshot(client, m) {
  const result = {};
  for (const table of new Set(Object.values(tables))) {
    const ids = Object.entries(tables).filter(([, t]) => t === table).map(([key]) => m.ids[key]);
    result[table] = (await client.query(`SELECT count(*)::int n,md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) hash FROM ${table} t WHERE NOT (id=ANY($1::text[]))`, [ids])).rows[0];
  }
  return result;
}
async function inspect(client, m, owners, edited = false) {
  validate(m); assert.ok([false,true,'partial'].includes(edited)); const rows = {};
  const names = (edited === 'partial' ? ['original','edited'] : [edited ? 'edited' : 'original']).map(x=>`${m.tag}:${x}`);
  for (const key of ['a','b','foreign','linkedin','kpi','benchmark','custom']) {
    const found = await client.query(`SELECT * FROM ${tables[key]} WHERE id=$1 FOR UPDATE`, [m.ids[key]]);
    assert.equal(found.rowCount, 1, `Missing ${key}`); rows[key] = found.rows[0];
  }
  for (const key of ['a','b','foreign']) {
    const row = rows[key], scope = key === 'foreign' ? owners.primary : owners.secondary;
    assert.equal(row.owner_id, scope.ownerId); assert.equal(row.client_id, scope.clientId);
    assert.equal(row.name, `${m.tag}:${key}`); assert.equal(row.status, 'draft'); assert.equal(row.platform, 'custom');
    assert.equal(row.currency, 'EUR'); assert.equal(row.reporting_time_zone, 'Europe/Amsterdam');
    for (const field of ['impressions','clicks','spend']) assert.equal(Number(row[field]), 0);
    assert.equal(row.conversion_value, null); assert.equal(row.ga4_campaign_filter, null);
  }
  assert.equal(rows.linkedin.campaign_id, m.ids.a); assert.equal(rows.linkedin.ad_account_id, m.tag);
  assert.ok(names.includes(rows.linkedin.ad_account_name));
  assert.equal(rows.linkedin.method, 'manual_token');
  for (const field of ['access_token','refresh_token','client_secret','encrypted_tokens','client_id']) assert.equal(rows.linkedin[field], null);
  for (const key of ['kpi','benchmark']) {
    const row = rows[key]; assert.equal(row.campaign_id, m.ids.a); assert.ok(names.includes(row.name));
    assert.equal(row.metric_type, 'ctr'); assert.equal(Number(row.current_value), 0);
  }
  assert.equal(Number(rows.kpi.target_value), 0); assert.equal(rows.kpi.alert_enabled, false); assert.equal(rows.kpi.status, 'pending');
  assert.equal(Number(rows.benchmark.benchmark_value), 0); assert.equal(rows.benchmark.source, 'custom');
  assert.ok((edited === 'partial' ? [m.ids.a,m.ids.b] : [edited ? m.ids.b : m.ids.a]).includes(rows.custom.campaign_id)); assert.equal(rows.custom.email, null);
  assert.equal(rows.custom.webhook_token, `disabled-fixture:${m.run}`); assert.deepEqual(rows.custom.allowed_email_addresses, []);
  // Fail closed if any scheduler/user created an unplanned dependent, including on an unexpected table.
  const columns = (await client.query("SELECT table_name FROM information_schema.columns WHERE table_schema=current_schema() AND column_name='campaign_id' ORDER BY table_name")).rows;
  const allowed = { linkedin_connections: m.ids.linkedin, meta_kpis: m.ids.kpi, meta_benchmarks: m.ids.benchmark, custom_integrations: m.ids.custom };
  for (const { table_name: table } of columns) {
    assert.match(table, /^[a-z_][a-z0-9_]*$/);
    if (allowed[table]) {
      const ids = (await client.query(`SELECT id FROM "${table}" WHERE campaign_id=ANY($1::text[]) ORDER BY id`, [[m.ids.a,m.ids.b,m.ids.foreign]])).rows.map(x => x.id);
      assert.deepEqual(ids,[allowed[table]],`Unexpected dependent in ${table}`);
    } else assert.equal((await client.query(`SELECT count(*)::int n FROM "${table}" WHERE campaign_id=ANY($1::text[])`, [[m.ids.a,m.ids.b,m.ids.foreign]])).rows[0].n,0,`Unexpected dependent in ${table}`);
  }
  return { exactRows: 7, draftOnly: true, credentialsAbsent: true, unplannedDependents: 0, edited };
}
async function seed(client, m, owners, commit = false) {
  validate(m); await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  try {
    await client.query("SET LOCAL lock_timeout='3s'"); await client.query("SET LOCAL statement_timeout='15s'");
    const before = await snapshot(client, m);
    for (const key of Object.keys(tables)) assert.equal((await client.query(`SELECT id FROM ${tables[key]} WHERE id=$1`, [m.ids[key]])).rowCount, 0);
    for (const key of ['a','b','foreign']) {
      const scope = key === 'foreign' ? owners.primary : owners.secondary;
      assert.equal((await client.query('SELECT id FROM clients WHERE id=$1 AND owner_id=$2 FOR SHARE', [scope.clientId,scope.ownerId])).rowCount, 1);
      await client.query("INSERT INTO campaigns(id,owner_id,client_id,name,currency,reporting_time_zone,platform,status) VALUES($1,$2,$3,$4,'EUR','Europe/Amsterdam','custom','draft')", [m.ids[key],scope.ownerId,scope.clientId,`${m.tag}:${key}`]);
    }
    await client.query("INSERT INTO linkedin_connections(id,campaign_id,ad_account_id,ad_account_name,method) VALUES($1,$2,$3,$4,'manual_token')", [m.ids.linkedin,m.ids.a,m.tag,`${m.tag}:original`]);
    await client.query("INSERT INTO meta_kpis(id,campaign_id,name,metric_type,target_value,current_value,start_date,alert_enabled) VALUES($1,$2,$3,'ctr',0,0,now(),false)", [m.ids.kpi,m.ids.a,`${m.tag}:original`]);
    await client.query("INSERT INTO meta_benchmarks(id,campaign_id,name,metric_type,benchmark_value,current_value) VALUES($1,$2,$3,'ctr',0,0)", [m.ids.benchmark,m.ids.a,`${m.tag}:original`]);
    await client.query('INSERT INTO custom_integrations(id,campaign_id,webhook_token,allowed_email_addresses) VALUES($1,$2,$3,$4)', [m.ids.custom,m.ids.a,`disabled-fixture:${m.run}`,[]]);
    const verified = await inspect(client,m,owners); assert.deepEqual(await snapshot(client,m),before);
    await client.query(commit ? 'COMMIT' : 'ROLLBACK'); return { ...verified, committed: commit, outsideRowsUnchanged: true };
  } catch (error) { await client.query('ROLLBACK').catch(()=>{}); throw error; }
}
async function cleanup(client, m, owners, commit = false, edited = true) {
  validate(m); await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  try {
    await client.query("SET LOCAL lock_timeout='3s'"); await client.query("SET LOCAL statement_timeout='15s'");
    const checked = await inspect(client,m,owners,edited), before = await snapshot(client,m);
    for (const key of ['custom','benchmark','kpi','linkedin','foreign','b','a']) assert.equal((await client.query(`DELETE FROM ${tables[key]} WHERE id=$1 RETURNING id`, [m.ids[key]])).rowCount,1);
    assert.deepEqual(await snapshot(client,m),before);
    await client.query(commit ? 'COMMIT' : 'ROLLBACK'); return { ...checked, committed: commit, outsideRowsUnchanged: true };
  } catch (error) { await client.query('ROLLBACK').catch(()=>{}); throw error; }
}
module.exports = { tables, validate, seed, inspect, cleanup };
