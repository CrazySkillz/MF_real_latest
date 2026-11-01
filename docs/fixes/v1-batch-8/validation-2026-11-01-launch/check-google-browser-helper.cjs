// Execute the actual helper against synthetic API contracts only. No network/real credentials.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'manual-google-alternative.js'), 'utf8');
const id = '8798ff85-8850-473f-b8ff-6c6b43d5726a', reference = '36631f9f-5f32-4ae6-8d20-d8430abb364c';
const owner = 'user_3LTqgGDCOcbqrzLRaynqvRWRtMl', clientId = 'e3ec20ad-89ea-450d-8caf-8c0ab7abd220';
const propertyId = '542352127', spreadsheetId = '1VMN6f089lsPISQ80pxT8Sq4awNU71-jQh5OgyFTXSeU', sheetName = 'Client_ROI_Summary';
async function run(mode) {
  let draft, prints = [], calls = []; const saved = new Map();
  const window = { Clerk: { user: { id: mode === 'wrong_owner' ? 'different-user' : owner }, session: { getToken: async () => 'synthetic-token' } } };
  const context = vm.createContext({ window, Date: class extends Date { static now() { return Date.parse('2026-11-01T17:00:00Z'); } },
    location: { origin: mode === 'wrong_origin' ? 'https://example.invalid' : 'https://app.mimosaas.app' },
    sessionStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    AbortSignal: { timeout: () => undefined }, console: { log: value => prints.push(JSON.parse(value)) },
    fetch: async (url, options) => {
      const method = options.method, body = options.body ? JSON.parse(options.body) : undefined;
      calls.push({ url, method, body }); let status = 200, data;
      assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, 'Bearer synthetic-token');
      if (url === '/api/campaigns/' + reference && method === 'GET') data = { id: reference, ownerId: owner, clientId, name: 'Batch 1 Provider Check', status: 'active' };
      else if (url === '/api/campaigns/' + reference + '/ga4-connection-status' && method === 'GET') data = { connected: true, propertyId };
      else if (url === '/api/campaigns/' + reference + '/google-sheets-connections?purpose=revenue' && method === 'GET') data = { success: true, connections: mode === 'reference_changed' ? [] : [{ spreadsheetId, sheetName }] };
      else if (url === '/api/campaigns' && method === 'POST') {
        assert.equal(body.creationRequestId, id); assert.equal(body.clientId, clientId); assert.equal(body.status, 'draft'); assert.equal(body.industry, undefined);
        draft = { ...body, id, ownerId: owner }; data = draft;
      } else if (url === '/api/campaigns/' + id && method === 'GET') data = { ...draft, status: mode === 'draft_changed' ? 'active' : 'draft' };
      else if (['ga4-service-account', 'google-sheets-service-account'].some(route => url === '/api/campaigns/' + id + '/' + route + '/status') && method === 'GET') data = { enabled: mode !== 'unavailable' };
      else if (url === '/api/campaigns/' + id + '/ga4-service-account/connect' && method === 'POST') {
        assert.deepEqual(body, { propertyId, lookbackDays: 30 });
        if (mode === 'ga4_denied') { status = 403; data = { error: 'GA4_SERVICE_ACCOUNT_PROPERTY_NOT_ALLOWED' }; }
        else data = { success: true, property: { id: propertyId }, method: 'service_account' };
        if (mode === 'account_changed') window.Clerk.user.id = 'different-user';
      } else if (url === '/api/campaigns/' + id + '/ga4-connection-status' && method === 'GET') data = { connected: true, propertyId, isRealOAuth: false, pending: false, properties: [{ id: propertyId }] };
      else if (url === '/api/campaigns/' + id + '/ga4-property' && method === 'POST') { assert.deepEqual(body, { propertyId, lookbackDays: 30 }); data = { success: true, selectedProperty: { id: propertyId } }; }
      else if (url === '/api/campaigns/' + id + '/google-sheets-service-account/connect' && method === 'POST') {
        assert.deepEqual(body, { spreadsheetId, purpose: 'revenue' });
        if (mode === 'sheets_denied') { status = 403; data = { error: 'Share this spreadsheet with synthetic@example.invalid as Viewer, then try again.' }; }
        else data = { success: true, spreadsheet: { id: spreadsheetId }, sheets: [{ title: sheetName }] };
      } else if (url === '/api/google-sheets/select-spreadsheet-multiple' && method === 'POST') {
        assert.deepEqual(body, { campaignId: id, spreadsheetId, sheetNames: [sheetName], selectionMode: 'replace', purpose: 'revenue' });
        data = { success: true, selectedSpreadsheet: { id: spreadsheetId }, sheetsConnected: 1, sheetNames: [mode === 'wrong_tab' ? 'other' : sheetName], connectionIds: ['synthetic-connection'] };
      } else if (url === '/api/campaigns/' + id + '/google-sheets-connections?purpose=revenue' && method === 'GET') data = { success: true, connections: [{ id: 'synthetic-connection', spreadsheetId, sheetName, isActive: true }] };
      else if (url === '/api/campaigns/' + id + '/revenue/sheets/preview' && method === 'POST') {
        assert.deepEqual(body, { connectionId: 'synthetic-connection', platformContext: 'ga4' });
        data = { success: true, connectionId: mode === 'foreign_preview' ? 'foreign-connection' : 'synthetic-connection', spreadsheetId, sheetName, headers: ['Revenue', 'Date'], rowCount: 2, sampleRows: [{ Revenue: 'private-row-value' }] };
      } else if (url === '/api/campaigns/' + id + '?draftCleanup=1&clientId=' + clientId && method === 'DELETE') {
        if (mode === 'cleanup_denied') { status = 409; data = {}; } else { draft = null; data = { success: true }; }
      } else throw Error('UNEXPECTED_ROUTE_OR_METHOD');
      return { ok: status < 400, status, json: async () => data };
    } });
  await vm.runInContext(source, context); const result = prints.at(-1), count = calls.length;
  assert.ok(!JSON.stringify(prints).includes('synthetic-token')); assert.ok(!JSON.stringify(prints).includes('private-row-value'));
  if (mode === 'success') { assert.equal(result.googleAlternative, 'PASS_GOOGLE_ALTERNATIVE'); assert.equal(result.cleanup, true); assert.equal(draft, null); }
  else { assert.equal(result.googleAlternative, 'CHECK_REQUIRED'); assert.equal(result.cleanup, false); }
  if (['wrong_origin', 'wrong_owner', 'reference_changed'].includes(mode)) assert.equal(calls.filter(c => c.method !== 'GET').length, 0);
  if (mode === 'draft_changed') assert.equal(calls.some(c => c.url.endsWith('/connect')), false);
  if (mode === 'ga4_denied') assert.equal(result.checks.find(c => c.provider === 'google_sheets').passed, true);
  if (mode === 'account_changed') assert.equal(calls.some(c => c.url.endsWith('/google-sheets-service-account/connect')), false);
  if (mode === 'sheets_denied') assert.equal(calls.some(c => c.url.endsWith('/select-spreadsheet-multiple')), false);
  if (mode === 'wrong_tab') assert.equal(calls.some(c => c.url.endsWith('/revenue/sheets/preview')), false);
  if (mode !== 'success' && mode !== 'cleanup_denied') assert.equal(calls.some(c => c.method === 'DELETE'), false);
  await vm.runInContext(source, context); assert.equal(calls.length, count);
  return { case: mode, passed: true, requests: count };
}
(async () => {
  const results = [];
  for (const mode of ['success', 'wrong_origin', 'wrong_owner', 'reference_changed', 'draft_changed', 'unavailable', 'ga4_denied', 'sheets_denied', 'wrong_tab', 'foreign_preview', 'account_changed', 'cleanup_denied']) results.push(await run(mode));
  const receipt = { at: new Date().toISOString(), result: 'PASS', tests: results, liveCalls: 0 };
  fs.writeFileSync(path.join(__dirname, 'google-browser-helper-tests.json'), JSON.stringify(receipt, null, 2) + '\n'); console.log(JSON.stringify(receipt));
})().catch(error => { console.error(error); process.exitCode = 1; });
