// This executable can only READ production. No application imports or secret output.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { parseEnv } = require('node:util');
const { Client } = require('pg');
const { capture } = require('./ownership-transfer.cjs');
const hash = value => createHash('sha256').update(value).digest('hex');
const expectedTarget = '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0';
let client;
(async () => {
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), expectedTarget);
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options']) url.searchParams.delete(key);
  client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true },
    options: '-c default_transaction_read_only=on', application_name: 'clerk-two-owner-read-only',
    connectionTimeoutMillis: 10000, statement_timeout: 15000, idle_in_transaction_session_timeout: 30000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL TIME ZONE 'UTC'");
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  assert.equal((await client.query('SELECT current_schema() AS schema')).rows[0].schema, 'public');
  const second = (await client.query('SELECT owner_id FROM campaigns WHERE id=$1', ['36631f9f-5f32-4ae6-8d20-d8430abb364c'])).rows;
  assert.equal(second.length, 1);
  assert.equal(hash(second[0].owner_id), '1900b95d7361b41cd41b7a23571cb4645a1511a139d4044f04b9937ab86c6096');
  const plan = await capture(client, [
    { from: 'user_3K7q6o5pF0aykjIQSHy5O7mVi2U', to: 'user_3LTouyBkb8CfKyfoAk2L4nw7QKN' },
    { from: second[0].owner_id, to: 'user_3LTqgGDCOcbqrzLRaynqvRWRtMl' },
  ], [
    '0343ecc7-c128-4b16-b7b6-6351d26643c1', '11343ae5-f59b-4e67-ba93-8db72b2d62d9',
    '2512143f-8424-434d-b820-7976804a3848', '3bcaaa27-d8e0-4d3d-922e-e4a9d5800a49',
    '3e1d005e-f24a-4129-8d7b-4ceb4656e11d', '49068f7f-c13a-4466-a0ef-41b12289c7bc',
    '4d262520-407b-47f2-9b52-e8d3e8c8855a', '6ac0e38b-a5ec-4269-ade2-08d2855c94e4',
    '9ff240b2-b396-4f91-8b30-db57b888bb9e', 'a9b045f6-12a8-49c3-982f-57c202ea741e',
    'cdf08584-9665-45e4-bcd6-2ff63e310d96', 'd1b3acce-daa0-4224-bd36-19cb9dbf09f0',
    'e0c1ed25-8854-40c4-b9ea-78726d659b8f', 'e98dfd78-2a21-40be-a33d-d5c1c0283480',
    'ef2faae7-bf02-487c-b2b8-6baf439e2b15',
  ]);
  assert.deepEqual(plan.rows.clients.map(r => [r.id, r.name, r.owner_id]), [
    ['4d8d826b-bb16-41b7-97a4-6de8fa20fe9c', 'Tracker', plan.mappings[0].from],
    ['861d3921-1903-491c-8ec3-57c0f6d05e92', 'ABN', plan.mappings[0].from],
    ['e3ec20ad-89ea-450d-8caf-8c0ab7abd220', 'Batch 1 Validation', plan.mappings[1].from],
  ]);
  assert.deepEqual(plan.rows.campaigns.map(r => [r.id, r.name, r.client_id]), [
    ['36493a43-accd-4360-8ff2-de62f5a19b6e', 'V1 Batch 5 Test', '861d3921-1903-491c-8ec3-57c0f6d05e92'],
    ['36631f9f-5f32-4ae6-8d20-d8430abb364c', 'Batch 1 Provider Check', 'e3ec20ad-89ea-450d-8caf-8c0ab7abd220'],
    ['b74f98af-ede9-47af-9b19-0720ebb4d2c0', 'Promo', '861d3921-1903-491c-8ec3-57c0f6d05e92'],
  ]);
  assert.equal(plan.rows.campaign_creation_requests.length, 5);
  assert.deepEqual(plan.rows.service_account_resource_grants.map(r => [r.id, r.client_id, r.owner_id]), [
    ['dd7ce6e7-8ecc-4b07-9c13-e4a4005fde21', '861d3921-1903-491c-8ec3-57c0f6d05e92', plan.mappings[0].from],
  ]);
  assert.deepEqual(plan.external, [{ table: 'mimosaas_website_connections', source: 2, destination: 0 }]);
  await client.query('ROLLBACK');
  const packet = { at: new Date().toISOString(), targetSha256: expectedTarget,
    result: 'PASS_TWO_ACCOUNT_READ_ONLY_PLAN', databaseWritesAttempted: false, plan };
  const text = JSON.stringify(packet, null, 2) + '\n';
  const filename = `ownership-plan-${packet.at.replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(__dirname, filename), text, { flag: 'wx' });
  console.log(JSON.stringify({ result: packet.result, filename, sha256: hash(text),
    rows: Object.fromEntries(Object.entries(plan.rows).map(([k, v]) => [k, v.length])),
    runnableRefreshWork: 0, productionIdentityCollisions: 0, databaseWritesAttempted: false }, null, 2));
})().catch(error => { console.error(JSON.stringify({ result: 'STOP', error: error.code || error.name,
  reason: error.code === 'ERR_ASSERTION' ? String(error.message).split('\n')[0] : 'Read-only preparation failed' })); process.exitCode = 1; })
  .finally(async () => { if (client) await client.end().catch(() => {}); });
