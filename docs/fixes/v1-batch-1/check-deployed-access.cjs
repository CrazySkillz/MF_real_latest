// Public health and anonymous GET denials only. No cookies, credentials or provider requests.
const fs = require('node:fs'), assert = require('node:assert/strict');
const origin = 'https://marketforensics.onrender.com';
const expected = '4522f83486a28ebbf1fe6152f1053fdc83565223';
const result = { at: new Date().toISOString(), expectedCommit: expected,
  boundary: 'Anonymous read-only health/API checks; does not prove owner/foreign-owner isolation, Google consent, analytics or scheduler acceptance.', results: [] };
(async () => {
  const health = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(15000) });
  const body = await health.json(); result.observedCommit = body.commit;
  assert.equal(health.status, 200); assert.equal(body.ok, true); assert.equal(body.commit, expected);
  for (const route of ['/api/clients','/api/campaigns','/api/metrics','/api/integrations','/api/attribution/models']) {
    const response = await fetch(origin + route, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const denied = response.status === 401 || response.status === 403;
    result.results.push({ method: 'GET', route, status: response.status, result: denied ? 'PASS' : 'FAIL' });
    await response.body?.cancel();
    assert.ok(denied, 'Protected API must deny anonymous access: ' + route);
  }
})().catch(error => { result.error = error.name; process.exitCode = 1; }).finally(() => {
  fs.writeFileSync('docs/fixes/v1-batch-1/database-grants-deployed-access.json', JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
});
