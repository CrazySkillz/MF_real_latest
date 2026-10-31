const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'manual-provider-reload.js'), 'utf8');
const campaign = '36631f9f-5f32-4ae6-8d20-d8430abb364c', digest = '1900b95d7361b41cd41b7a23571cb4645a1511a139d4044f04b9937ab86c6096';
async function run(mode) {
  const calls = [], output = [], clerk = { user: { id: 'synthetic-owner' } };
  await vm.runInNewContext(source, {
    location: { origin: mode === 'origin' ? 'https://example.invalid' : 'https://marketforensics.onrender.com' },
    window: { Clerk: clerk }, TextEncoder, Uint8Array, Date, AbortSignal,
    crypto: { subtle: { digest: async () => Buffer.from(mode === 'owner' ? '0'.repeat(64) : digest, 'hex') } },
    console: { log: message => output.push(JSON.parse(message)) },
    fetch: async (url, options) => {
      assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'same-origin'); assert.equal(options.redirect, 'error'); assert.equal(options.body, undefined);
      assert.ok(url.includes(campaign)); assert.ok(!/import|refresh|connect$|process|save|mapping/.test(url)); calls.push(url);
      if (mode === 'timeout' && calls.length === 3) throw Error('SENSITIVE PROVIDER ERROR');
      if (mode === 'switch' && calls.length === 3) clerk.user.id = 'different-owner';
      let data;
      if (calls.length === 1) data = { id: campaign, ownerId: 'synthetic-owner', name: 'Batch 1 Provider Check', status: mode === 'target' ? 'draft' : 'active' };
      else if (url.endsWith('ga4-connection-status')) data = { connected: true, propertyId: '123', properties: [{ id: '123' }] };
      else if (url.includes('/spreadsheets')) data = { spreadsheets: [{ id: 'synthetic-sheet' }] };
      else if (url.includes('/hubspot/')) data = { success: true, properties: [{ name: 'dealname' }] };
      else if (url.includes('/salesforce/')) data = { success: true, fields: [{ name: 'Amount' }] };
      else if (url.includes('/shopify/')) data = { success: true, canReadOrders: mode !== 'shopify-denied', token: 'SENSITIVE MUST NOT EMIT' };
      else throw Error('UNPLANNED_REQUEST');
      if (mode === 'pending' && url.endsWith('ga4-connection-status')) data.pending = true;
      return { status: mode === 'http' && calls.length === 4 ? 500 : 200, json: async () => data };
    },
  });
  assert.equal(output.length, 1); assert.ok(!JSON.stringify(output).includes('SENSITIVE'));
  const expected = { pass: [11, 'PASS_PROVIDER_RELOAD'], origin: [0, 'CHECK_REQUIRED'], owner: [0, 'CHECK_REQUIRED'], target: [1, 'CHECK_REQUIRED'], pending: [2, 'CHECK_REQUIRED'], http: [4, 'CHECK_REQUIRED'], timeout: [3, 'CHECK_REQUIRED'], switch: [3, 'CHECK_REQUIRED'], 'shopify-denied': [6, 'CHECK_REQUIRED'] }[mode];
  assert.equal(calls.length, expected[0], mode); assert.equal(output[0].batch1ProviderReload, expected[1], mode);
  return { check: mode, passed: true, requests: calls.length };
}
(async () => { const checks = []; for (const mode of ['pass', 'origin', 'owner', 'target', 'pending', 'http', 'timeout', 'switch', 'shopify-denied']) checks.push(await run(mode)); const receipt = { at: new Date().toISOString(), result: 'PASS', realProviderCalls: 0, checks }; fs.writeFileSync(path.join(__dirname, 'provider-reload-safety.json'), JSON.stringify(receipt, null, 2) + '\n'); console.log(JSON.stringify(receipt)); })().catch(error => { console.error(error); process.exitCode = 1; });
