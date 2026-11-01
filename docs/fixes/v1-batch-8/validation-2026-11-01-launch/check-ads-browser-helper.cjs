// Synthetic execution of the actual browser helper; no network or production credentials.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'manual-ads-service-account.js'), 'utf8');
const id = 'b89ead82-29a3-4671-b281-66756051f966', owner = 'user_3LTqgGDCOcbqrzLRaynqvRWRtMl';
const client = 'e3ec20ad-89ea-450d-8caf-8c0ab7abd220', reference = '36631f9f-5f32-4ae6-8d20-d8430abb364c';
async function run(mode) {
  let draft, connected = false, prints = [], calls = [];
  const saved = new Map(), context = vm.createContext({ Date: class extends Date { static now() { return Date.parse('2026-11-01T17:00:00Z'); } },
    location: { origin: mode === 'wrong_origin' ? 'https://example.invalid' : 'https://app.mimosaas.app' },
    window: { Clerk: { user: { id: mode === 'wrong_owner' ? 'different-user' : owner }, session: { getToken: async () => 'synthetic-token' } } },
    sessionStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    AbortSignal: { timeout: () => undefined }, console: { log: value => prints.push(JSON.parse(value)) },
    fetch: async (url, options) => {
      const method = options.method, body = options.body ? JSON.parse(options.body) : undefined;
      calls.push({ url, method, body }); let status = 200, data;
      assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, 'Bearer synthetic-token');
      if (url === '/api/campaigns/' + reference && method === 'GET') data = { id: reference, ownerId: owner, clientId: client, name: 'Batch 1 Provider Check', status: 'active', currency: 'EUR', reportingTimeZone: 'Europe/Amsterdam' };
      else if (url === '/api/campaigns/' + reference + '/google-ads-service-account/status' && method === 'GET') data = { success: true, enabled: mode !== 'unavailable' };
      else if (url === '/api/campaigns' && method === 'POST') {
        assert.equal(body.creationRequestId, id); assert.equal(body.clientId, client); assert.equal(body.status, 'draft');
        assert.equal(body.industry, undefined); draft = { ...body, id, ownerId: owner }; data = draft;
      } else if (url === '/api/campaigns/' + id && method === 'GET') data = { ...draft, status: mode === 'changed_draft' ? 'active' : 'draft' };
      else if (url === '/api/google-ads/' + id + '/connection?spendPreview=1' && method === 'GET') data = connected
        ? { connected: true, customerId: '4951281615', method: 'service_account', currency: 'EUR' } : { connected: false };
      else if (url === '/api/campaigns/' + id + '/google-ads-service-account/connect' && method === 'POST') {
        assert.deepEqual(body, { customerId: '4951281615' });
        if (mode === 'provider_denied') { status = 403; data = { error: 'GOOGLE_ADS_SERVICE_ACCOUNT_CONNECT_FAILED', message: 'private-provider-detail' }; }
        else { connected = true; data = { success: true, customer: { id: '4951281615' }, method: 'service_account' }; }
      } else if (url === '/api/google-ads/' + id + '/daily-metrics?startDate=2026-10-25&endDate=2026-10-31&spendPreview=1' && method === 'GET') {
        data = { success: true, currency: 'EUR', metrics: mode === 'empty' ? [] : [{ campaignId: mode === 'foreign_preview' ? reference : id, date: '2026-10-31', spend: '1.25' }] };
      } else if (url === '/api/google-ads/' + id + '/refresh?spendPreview=1' && method === 'POST') {
        data = { success: true, providerRefreshed: mode !== 'refresh_skipped', spendMaterialization: { updated: false, sourceId: null, records: 0, totalSpend: null } };
      } else if (url === '/api/campaigns/' + id + '?draftCleanup=1&clientId=' + client && method === 'DELETE') {
        if (mode === 'cleanup_denied') { status = 409; data = {}; } else { draft = null; data = { success: true }; }
      } else throw Error('UNEXPECTED_ROUTE_OR_METHOD');
      return { ok: status < 400, status, json: async () => data };
    } });
  await vm.runInContext(source, context); const result = prints.at(-1), beforeRepeat = calls.length;
  assert.ok(!JSON.stringify(prints).includes('synthetic-token')); assert.ok(!JSON.stringify(prints).includes('private-provider-detail'));
  if (['success', 'empty'].includes(mode)) {
    assert.equal(result.googleAdsServiceAccount, 'PASS_ADS_SERVICE_ACCOUNT'); assert.equal(result.cleanup, true); assert.equal(draft, null);
    assert.equal(result.previewRows, mode === 'empty' ? 0 : 1);
  } else {
    assert.equal(result.googleAdsServiceAccount, 'CHECK_REQUIRED'); assert.equal(result.cleanup, false);
    if (['wrong_origin', 'wrong_owner', 'unavailable'].includes(mode)) assert.equal(calls.filter(c => c.method !== 'GET').length, 0);
    if (mode === 'changed_draft') assert.equal(calls.some(c => c.url.endsWith('/connect')), false);
    if (['provider_denied', 'foreign_preview'].includes(mode)) assert.equal(calls.some(c => c.url.includes('/refresh')), false);
    if (mode === 'provider_denied') assert.equal(result.providerCode, 'GOOGLE_ADS_SERVICE_ACCOUNT_CONNECT_FAILED');
    if (mode === 'refresh_skipped') assert.equal(calls.some(c => c.method === 'DELETE'), false);
  }
  await vm.runInContext(source, context); assert.equal(calls.length, beforeRepeat);
  if (saved.size && mode !== 'unavailable') assert.deepEqual(prints.at(-1), result);
  return { case: mode, passed: true, requests: beforeRepeat };
}
(async () => {
  const results = [];
  for (const mode of ['success', 'empty', 'wrong_origin', 'wrong_owner', 'unavailable', 'changed_draft', 'provider_denied', 'foreign_preview', 'refresh_skipped', 'cleanup_denied']) results.push(await run(mode));
  const receipt = { at: new Date().toISOString(), result: 'PASS', tests: results, liveCalls: 0 };
  fs.writeFileSync(path.join(__dirname, 'ads-browser-helper-tests.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
})().catch(error => { console.error(error); process.exitCode = 1; });
