// Evidence reconciliation only: no application startup, database or provider access.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const before = read('provider-publication-2026-10-31T15-42-19-933Z.json');
const after = read('provider-publication-2026-10-31T15-49-53-808Z.json');
const reload = read('user-provider-reload.json'), grants = read('grant-production-2026-10-31T15-45-50-358Z.json');
const user = read('user-resource-denial.json'), checks = [];
const check = (name, fn) => { fn(); checks.push({ check: name, passed: true }); };
check('ten real provider reads', () => {
  assert.equal(reload.batch1ProviderReload, 'PASS_PROVIDER_RELOAD'); assert.equal(reload.checks.length, 10);
  for (const provider of ['GA4', 'Google Sheets', 'HubSpot', 'Salesforce', 'Shopify']) for (const pass of [1, 2]) {
    const selected = reload.checks.filter(c => c.provider === provider && c.pass === pass);
    assert.equal(selected.length, 1); assert.equal(selected[0].status, 200); assert.equal(selected[0].passed, true);
  }
});
check('five exact connections retain active encrypted state', () => {
  const stable = groups => groups.map(g => ({ ...g, rows: g.rows.map(({ expires_at, ...row }) => row) }));
  assert.deepEqual(stable(before.connectionMetadata), stable(after.connectionMetadata)); assert.equal(after.connectionMetadata.length, 5);
  for (const group of after.connectionMetadata) { assert.equal(group.rows.length, 1); assert.equal(group.rows[0].is_active, true); assert.equal(group.rows[0].encrypted_present, true); assert.equal(group.rows[0].plaintext_present, false); }
});
for (const field of ['sources', 'work', 'snapshots']) check(field + ' selected metadata unchanged', () => assert.deepEqual(before[field], after[field]));
check('three credential expiry advancements', () => {
  const advanced = after.connectionMetadata.filter(g => g.rows[0].expires_at > before.connectionMetadata.find(old => old.table === g.table).rows[0].expires_at).map(g => g.table);
  assert.deepEqual(advanced, ['ga4_connections', 'hubspot_connections', 'salesforce_connections']);
});
check('21 policy/hydration checks against production PostgreSQL rolled back', () => {
  assert.equal(grants.result, 'PASS'); assert.equal(grants.productionDatabase, true); assert.equal(grants.acceptance.checks.length, 21);
  assert.ok(grants.acceptance.checks.every(c => c.passed)); assert.equal(grants.committedRows, 0); assert.equal(grants.realProviderCalls, 0);
  for (const [file, expected] of Object.entries(grants.sourceHashes)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex'), expected);
});
check('live exact resource denials and five fresh-state session denials', () => {
  assert.equal(user.batch1ResourceCheck, 'PASS_RESOURCE_DENIAL'); assert.equal(user.run, 'aff80984-46a4-4216-8668-5c69c75e51b7');
  assert.equal(user.checks.length, 3); assert.ok(user.checks.every(c => c.passed));
  assert.deepEqual(user.callbacks.map(c => c.provider), ['ga4', 'google-sheets', 'hubspot', 'linkedin', 'meta']);
  assert.ok(user.callbacks.every(c => c.result === 'PASS_VALID_STATE_WITHOUT_SESSION_DENIED'));
});
check('local procedure and cleanup safeguards passed', () => {
  const browser = read('grant-browser-rehearsal.json'), safety = read('provider-reload-safety.json');
  assert.equal(browser.result, 'PASS'); assert.equal(browser.checks.length, 16); assert.ok(browser.checks.every(c => c.passed));
  assert.equal(safety.result, 'PASS'); assert.equal(safety.checks.length, 9); assert.ok(safety.checks.every(c => c.passed));
  assert.equal(read('grant-transaction-local.json').result, 'PASS');
});
check('exact two-row cleanup independently verified', () => {
  for (const [file, committed] of [['grant-browser-dry-cleanup-2026-10-31T16-02-44-221Z.json', false], ['grant-browser-cleanup-2026-10-31T16-03-38-795Z.json', true]]) {
    const receipt = read(file); assert.equal(receipt.result, 'PASS'); assert.equal(receipt.run, user.run); assert.equal(receipt.campaignId, user.campaignId); assert.equal(receipt.clientId, user.clientId);
    assert.equal(receipt.operation.rows, 2); assert.equal(receipt.operation.committed, committed);
  }
  const verified = read('grant-browser-verify-2026-10-31T16-04-46-600Z.json');
  assert.equal(verified.result, 'PASS'); assert.equal(verified.run, user.run); assert.equal(verified.independentAbsence, true);
});
const result = { at: new Date().toISOString(), result: 'PASS', checks, databaseAccess: false, providerCalls: 0, limits: 'Reconciles recorded user observations, selected metadata and exact fixture receipts; not full mappings/snapshot-payload comparison, reconnect, authorization-code replay or live worker revocation.' };
fs.writeFileSync(path.join(__dirname, 'provider-permission-verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
