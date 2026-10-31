// Exact synthetic fixtures only. No connection setup or environment loading here.
const assert = require('node:assert/strict');
const tables = { metric: 'metrics', performance: 'performance_data', integration: 'integrations', model: 'attribution_models', journey: 'customer_journeys', touchpoint: 'touchpoints', result: 'attribution_results' };
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
async function cleanup(client, manifest, ownerId, baseline, commit = false) {
  assert.equal(manifest.phase, 'awaiting_database_cleanup');
  assert.ok(uuid(manifest.run)); assert.equal(manifest.tag, `B1_ACCESS_${manifest.run}`);
  assert.match(manifest.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(Object.keys(manifest.ids).length, 7);
  assert.equal(new Set(Object.values(manifest.ids)).size, 7);
  for (const name of Object.keys(tables)) {
    assert.ok(uuid(manifest.ids[name]), name);
    assert.ok(Array.isArray(baseline[name]), 'Independent baseline required');
    assert.ok(!baseline[name].includes(manifest.ids[name]), 'Pre-existing record is protected');
  }
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  try {
    await client.query("SET LOCAL lock_timeout='3s'");
    await client.query("SET LOCAL statement_timeout='15s'");
    const saved = {};
    // Same parent-lock order as attribution calculation.
    for (const name of ['model','journey','metric','performance','integration','touchpoint','result']) {
      const result = await client.query(`SELECT * FROM ${tables[name]} WHERE id=$1 FOR UPDATE`, [manifest.ids[name]]);
      assert.equal(result.rowCount, 1, `Missing exact ${name}`); saved[name] = result.rows[0];
    }
    for (const name of ['metric','performance','integration','model','journey']) assert.equal(saved[name].owner_id, ownerId, `${name} owner`);
    assert.equal(saved.metric.name, manifest.tag); assert.equal(saved.metric.value, '0'); assert.equal(saved.metric.change, '0');
    assert.equal(saved.performance.date, manifest.date);
    for (const field of ['impressions','clicks','conversions']) assert.equal(saved.performance[field], 0);
    assert.equal(saved.integration.name, manifest.tag); assert.equal(saved.integration.platform, 'batch1_access_check');
    assert.equal(saved.integration.connected, false);
    const encrypted = JSON.parse(saved.integration.credentials);
    assert.equal(encrypted.v, 1); for (const field of ['iv','tag','data']) assert.ok(typeof encrypted[field] === 'string' && encrypted[field].length > 0);
    assert.ok(!saved.integration.credentials.includes(manifest.tag), 'Synthetic credential must be encrypted');
    assert.equal(saved.model.name, manifest.tag); assert.equal(saved.model.description, `${manifest.tag}:edited`);
    assert.equal(saved.model.type, 'first_touch'); assert.equal(saved.model.is_default, false); assert.equal(saved.model.is_active, false);
    assert.equal(saved.journey.customer_id, manifest.tag); assert.equal(saved.journey.session_id, manifest.tag);
    assert.equal(saved.journey.status, 'abandoned'); assert.equal(saved.journey.conversion_type, 'custom');
    assert.equal(saved.journey.total_touchpoints, 1); assert.equal(Number(saved.journey.conversion_value), 0);
    assert.equal(saved.touchpoint.journey_id, manifest.ids.journey); assert.equal(saved.touchpoint.metadata, manifest.tag);
    assert.equal(saved.touchpoint.campaign_id, null); assert.equal(saved.touchpoint.position, 1);
    assert.equal(saved.result.journey_id, manifest.ids.journey); assert.equal(saved.result.attribution_model_id, manifest.ids.model);
    assert.equal(saved.result.touchpoint_id, manifest.ids.touchpoint); assert.equal(saved.result.campaign_id, null);
    assert.equal(Number(saved.result.attributed_value), 0); assert.equal(Number(saved.result.attribution_credit), 1);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM touchpoints WHERE journey_id=$1', [manifest.ids.journey])).rows[0].n, 1);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM attribution_results WHERE journey_id=$1 OR attribution_model_id=$2 OR touchpoint_id=$3', [manifest.ids.journey,manifest.ids.model,manifest.ids.touchpoint])).rows[0].n, 1);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM attribution_insights WHERE attribution_model_id=$1', [manifest.ids.model])).rows[0].n, 0);
    const fingerprints = async () => {
      const result = {};
      for (const name of Object.keys(tables)) result[name] = (await client.query(`SELECT count(*)::int AS n,md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS hash FROM ${tables[name]} t WHERE id<>$1`, [manifest.ids[name]])).rows[0];
      return result;
    };
    const outsideBefore = await fingerprints();
    for (const name of ['result','touchpoint','journey','model','integration','performance','metric']) {
      const removed = await client.query(`DELETE FROM ${tables[name]} WHERE id=$1 RETURNING id`, [manifest.ids[name]]);
      assert.equal(removed.rowCount, 1, `Exact ${name} deletion`);
    }
    assert.deepEqual(await fingerprints(), outsideBefore, 'Outside-scope rows changed');
    await client.query(commit ? 'COMMIT' : 'ROLLBACK');
    return { result: 'PASS', exactSyntheticRows: 7, committed: commit, outsideRowsUnchanged: true };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
}
module.exports = { tables, cleanup };
