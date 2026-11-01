// Operator-only CLI. Defaults to an enforced READ ONLY verification.
// Writes require an exact file digest, explicit mode and deployed frontend proof.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { parseEnv } = require('node:util');
const { Client } = require('pg');
const { capture, transfer, tables } = require('./ownership-transfer.cjs');
const hash = value => createHash('sha256').update(value).digest('hex');
const target = '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0';
const forward = [
  { from: 'user_3K7q6o5pF0aykjIQSHy5O7mVi2U', to: 'user_3LTouyBkb8CfKyfoAk2L4nw7QKN' },
  { from: 'user_39kDsb8uIT6shhq2vixKnqplwy6', to: 'user_3LTqgGDCOcbqrzLRaynqvRWRtMl' },
];
function readPacket(filename, digest, mode) {
  assert.ok(['check', 'apply', 'rollback'].includes(mode), 'Unknown mode');
  assert.match(filename || '', /^ownership-(?:plan|rollback)-[0-9TZ.-]+\.json$/);
  assert.match(digest || '', /^[a-f0-9]{64}$/);
  const text = fs.readFileSync(path.join(__dirname, filename), 'utf8');
  assert.equal(hash(text), digest, 'Reviewed packet digest changed');
  const packet = JSON.parse(text);
  assert.equal(packet.targetSha256, target, 'Wrong reviewed database target');
  const plan = packet.plan || packet.rollbackPlan;
  assert.ok(plan, 'Missing plan');
  const isRollback = !packet.plan;
  if (mode !== 'check') assert.equal(isRollback, mode === 'rollback', 'Wrong direction');
  assert.deepEqual(plan.mappings, isRollback ? forward.map(m => ({ from: m.to, to: m.from })) : forward);
  assert.deepEqual(Object.keys(plan.rows), tables);
  assert.deepEqual(tables.map(table => plan.rows[table].length), [3, 3, 5, 1]);
  assert.deepEqual(plan.rows.clients.map(r => r.id), ['4d8d826b-bb16-41b7-97a4-6de8fa20fe9c',
    '861d3921-1903-491c-8ec3-57c0f6d05e92', 'e3ec20ad-89ea-450d-8caf-8c0ab7abd220']);
  assert.deepEqual(plan.rows.campaigns.map(r => r.id), ['36493a43-accd-4360-8ff2-de62f5a19b6e',
    '36631f9f-5f32-4ae6-8d20-d8430abb364c', 'b74f98af-ede9-47af-9b19-0720ebb4d2c0']);
  return plan;
}
async function publicMode(expectedCommit) {
  assert.match(expectedCommit || '', /^[a-f0-9]{40}$/);
  const origin = 'https://app.mimosaas.app';
  const read = async pathname => {
    const url = new URL(pathname, origin);
    assert.equal(url.origin, origin);
    const response = await fetch(url, { redirect: 'error', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(25000) });
    assert.equal(response.status, 200, 'Public app entry is not healthy');
    return response.text();
  };
  const health = JSON.parse(await read('/api/health'));
  assert.equal(health.ok, true); assert.equal(health.commit, expectedCommit, 'Unexpected deployed revision');
  const html = await read('/');
  const asset = html.match(/src=["']([^"']*\/assets\/index-[^"']+\.js)["']/)?.[1];
  assert.ok(asset, 'Compiled frontend entry not found');
  const bundle = await read(asset);
  const keys = [...new Set(bundle.match(/pk_(?:test|live)_[A-Za-z0-9+/]+={0,2}/g) || [])]
    .map(value => ({ mode: value.startsWith('pk_live_') ? 'live' : 'test', host: Buffer.from(value.slice(8), 'base64').toString('utf8') }))
    .filter(value => /^[a-z0-9.-]+\$$/i.test(value.host));
  assert.equal(keys.length, 1, 'Ambiguous compiled Clerk instance');
  return keys[0];
}
function saveReceipt(receipt) {
  const filename = `ownership-rollback-${receipt.at.replace(/[:.]/g, '-')}.json`;
  const text = JSON.stringify({ ...receipt, targetSha256: target, commitAttemptPending: true }, null, 2) + '\n';
  const fd = fs.openSync(path.join(__dirname, filename), 'wx', 0o600);
  try { fs.writeFileSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  return { filename, sha256: hash(text) };
}
async function main(args) {
  const [filename, digest, mode = 'check', expectedCommit] = args;
  assert.ok(args.length >= 2 && args.length <= 4, 'Packet filename and SHA-256 are required');
  const plan = readPacket(filename, digest, mode);
  if (mode !== 'check') {
    const publicKey = await publicMode(expectedCommit);
    if (mode === 'apply') assert.deepEqual(publicKey, { mode: 'live', host: 'clerk.mimosaas.app$' }, 'Production keys are not deployed');
    else assert.deepEqual(publicKey, { mode: 'test', host: 'frank-peacock-20.clerk.accounts.dev$' },
      'Restore the reviewed development-key deployment before rollback');
  }
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), target);
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options']) url.searchParams.delete(key);
  const client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true },
    options: mode === 'check' ? '-c default_transaction_read_only=on' : '',
    application_name: `reviewed-clerk-ownership-${mode}`, connectionTimeoutMillis: 10000,
    statement_timeout: 15000, idle_in_transaction_session_timeout: 30000 });
  try {
    await client.connect();
    assert.equal((await client.query('SELECT current_schema() AS name')).rows[0].name, 'public');
    if (mode === 'check') {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SET LOCAL TIME ZONE 'UTC'");
      assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
      assert.deepEqual(await capture(client, plan.mappings, plan.excludedCampaigns), plan, 'Reviewed scope changed');
      await client.query('ROLLBACK');
      return { result: 'PASS_REVIEWED_READ_ONLY_SCOPE', rows: 12, databaseWritesAttempted: false };
    }
    let rollback;
    const result = await transfer(client, plan, { commit: true, beforeCommit: receipt => { rollback = saveReceipt(receipt); } });
    return { result: result.result, rows: result.changed, mode, rollback };
  } finally { await client.end().catch(() => {}); }
}
module.exports = { readPacket, publicMode, saveReceipt, main };
if (require.main === module) main(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => { console.error(JSON.stringify({ result: 'STOP', code: error.code || error.name,
    reason: error.code === 'ERR_ASSERTION' || String(error.message).startsWith('COMMIT_OUTCOME_UNCERTAIN')
      ? String(error.message).split('\n')[0] : 'Operation failed; inspect before retrying' })); process.exitCode = 1; });
