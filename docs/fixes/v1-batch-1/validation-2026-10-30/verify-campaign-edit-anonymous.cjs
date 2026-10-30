const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const origin = 'https://marketforensics.onrender.com';
const commit = '02bb9ad28ad8101fd5e47248028a57b5475427b5';
(async () => {
  const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(15000) });
  const health = await response.json();
  assert.equal(response.status, 200); assert.equal(health.ok, true);
  assert.equal(health.commit, commit); assert.equal(health.nodeEnv, 'production');
  const denied = await fetch(origin + '/api/campaigns/b74f98af-ede9-47af-9b19-0720ebb4d2c0', {
    method: 'PATCH', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: { batch1AccessCheck: true } }),
  });
  const body = await denied.json();
  assert.equal(denied.status, 401);
  assert.deepEqual(body, { success: false, message: 'Your session expired. Please refresh and try again.' });
  const result = { at: new Date().toISOString(), result: 'PASS', commit, status: denied.status,
    bodyMatched: true, authenticationUsed: false, validEditSupplied: false,
    boundary: 'Anonymous deployed PATCH denial only. The malformed name also fails owner validation before every writer in the exact-route local HTTP tests. No actual provider/session or signed-in mutation acceptance inferred.' };
  fs.writeFileSync(path.join(__dirname, 'campaign-edit-anonymous.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
})().catch(error => { console.error(JSON.stringify({ result: 'NOT_VERIFIED', code: error.code || error.name })); process.exitCode = 1; });
