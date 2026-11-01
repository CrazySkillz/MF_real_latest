// Anonymous GETs only. No app session, provider calls, imports or configuration changes.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
(async () => {
  const expected = process.argv[2]; assert.match(expected, /^[a-f0-9]{40}$/);
  const base = 'https://app.mimosaas.app';
  const get = route => fetch(base + route, { headers: { 'Cache-Control': 'no-cache' }, redirect: 'error', signal: AbortSignal.timeout(25000) });
  const healthResponse = await get('/api/health'), health = await healthResponse.json();
  const receipt = { at: new Date().toISOString(), expected, health: { status: healthResponse.status, commit: health.commit, ok: health.ok, nodeEnv: health.nodeEnv }, complete: false };
  if (healthResponse.status === 200 && health.ok === true && health.commit === expected) {
    const htmlResponse = await get('/'), html = await htmlResponse.text(); assert.equal(htmlResponse.status, 200);
    const asset = html.match(/src="(\/assets\/index-[A-Za-z0-9_-]+\.js)"/)?.[1]; assert.ok(asset);
    const scriptResponse = await get(asset), script = await scriptResponse.text(); assert.equal(scriptResponse.status, 200);
    receipt.client = { asset, serviceAccountChoice: script.includes('Use service-account access'), oauthReturn: script.includes('Use Google sign-in'), clientApprovalCopy: script.includes('approved for this client by MimoSaaS') };
    const campaignId = '36631f9f-5f32-4ae6-8d20-d8430abb364c';
    receipt.anonymousDenials = await Promise.all(['ga4', 'google-sheets', 'google-ads'].map(async provider => {
      const response = await get(`/api/campaigns/${campaignId}/${provider}-service-account/status`);
      await response.body?.cancel(); return { provider, status: response.status };
    }));
    receipt.complete = receipt.client.serviceAccountChoice && receipt.client.oauthReturn && receipt.client.clientApprovalCopy && receipt.anonymousDenials.every(value => value.status === 401);
  }
  const file = 'onboarding-deployed-' + receipt.at.replace(/[:.]/g, '-') + '.json';
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ file, ...receipt }));
})().catch(error => { console.error(JSON.stringify({ check: 'ONBOARDING_DEPLOYMENT_CHECK_FAILED', type: error.name })); process.exitCode = 1; });
