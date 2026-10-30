const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const origin = 'https://marketforensics.onrender.com';
const commit = '02bb9ad28ad8101fd5e47248028a57b5475427b5';
(async () => {
  const health = await fetch(origin + '/api/health', { redirect: 'error', signal: AbortSignal.timeout(15000) });
  const data = await health.json();
  if (data.commit !== commit) { console.log(JSON.stringify({ result: 'AWAITING_DEPLOYMENT', healthy: health.status === 200 && data.ok === true, commit: data.commit })); return; }
  assert.equal(health.status, 200); assert.equal(data.ok, true);
  const checks = [];
  for (const route of ['/api/email/inbound/batch1-invalid-token', '/api/sendgrid/inbound', '/api/mailgun/inbound', '/api/custom-integration/batch1-check-nonexistent/connect']) {
    const response = await fetch(origin + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', redirect: 'error', signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    assert.equal(response.status, 404); assert.deepEqual(body, { error: 'Automatic email imports are disabled for this release' });
    checks.push({ route, status: response.status, expectedBodyMatched: true });
  }
  for (const route of ['/api/campaigns', '/api/clients']) {
    const response = await fetch(origin + route, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 401); await response.text();
    checks.push({ route, status: response.status, expectedStatusMatched: true });
  }
  const receipt = { at: new Date().toISOString(), result: 'PASS', commit, healthy: true, checks, credentialsUsed: false, validPayloadsSupplied: false, boundary: 'Exact deployed route exclusion and adjacent signed-out guards. No valid token, account session, provider, report delivery or database mutation used; frontend exclusion is covered by local rendering/build checks, not a live signed-in UI observation.' };
  fs.writeFileSync(path.join(__dirname, 'email-exclusion-deployed.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(receipt));
})().catch(error => { console.error(JSON.stringify({ result: 'NOT_VERIFIED', code: error.code || error.name })); process.exitCode = 1; });
