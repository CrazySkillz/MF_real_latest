const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto'), assert = require('node:assert/strict'), { Client } = require('pg');
const fixture = require('./grant-browser-fixture.cjs');
const receipt = { at: new Date().toISOString(), result: 'NOT_VERIFIED', productionAccess: false, checks: [] }, schema = 'b1_grant_browser_' + crypto.randomUUID().replaceAll('-', '');
const m = fixture.plan('synthetic-owner', { ga4: '123456789', google_sheets: 'synthetic_sheet_123' });
const script = fs.readFileSync(path.join(__dirname, 'manual-grant-template.js'), 'utf8').replace('/* GRANT_FIXTURE */ null', JSON.stringify(m));
async function browser(mode) {
  const calls = [], output = [], actor = mode === 'owner' ? 'foreign' : m.ownerId;
  let limited = 0;
  const headers = { get: () => mode === 'quota' ? '2' : String(10 - limited) };
  await vm.runInNewContext(script, { location: { origin: mode === 'origin' ? 'https://example.invalid' : 'https://marketforensics.onrender.com' }, window: { Clerk: { user: { id: actor } } }, AbortSignal, URL,
    console: { log: text => output.push(JSON.parse(text)) }, fetch: async (url, options) => {
      calls.push(url); assert.equal(options.redirect, 'error');
      if (url.startsWith('/api/auth/')) {
        const provider = url.split('/')[3], callback = url.includes('/callback?');
        if (!callback || ['linkedin', 'meta'].includes(provider)) limited++;
        assert.ok(limited <= 8);
        if (callback) {
          assert.equal(options.credentials, 'omit'); assert.equal(options.method, 'GET');
          const google = provider === 'google-sheets', ga4 = url.includes('ga4-state');
          return { status: mode === 'callback' ? 200 : google ? 200 : 401, headers, text: async () => mode === 'callback' ? 'auth_success SECRET' : ga4 ? 'ga4_auth_error Campaign not found.' : google ? 'You must be signed in.' : '{"message":"Your session expired"}' };
        }
        assert.equal(options.credentials, 'same-origin'); assert.equal(options.method, 'POST');
        assert.equal(JSON.parse(options.body).campaignId, m.campaignId);
        if (mode === 'unconfigured' && ['linkedin', 'meta'].includes(provider)) return { status: 500, headers, json: async () => ({ setupRequired: true }) };
        return { status: mode === '429' ? 429 : 200, headers, json: async () => ({ authUrl: `https://example.invalid/?state=${provider}-state-SECRET` }) };
      }
      assert.ok(url.startsWith(`/api/campaigns/${m.campaignId}`)); assert.equal(options.credentials, 'same-origin');
      if (calls.length === 1) return { status: 200, json: async () => ({ id: m.campaignId, clientId: m.clientId, ownerId: m.ownerId, name: mode === 'target' ? 'Other' : m.tag, status: 'draft', spend: 0 }) };
      assert.equal(options.method, 'POST');
      if (mode === 'timeout') throw Error('SECRET_DO_NOT_PRINT');
      const ga4 = url.endsWith('/ga4-service-account/connect'); if (ga4) limited++;
      assert.deepEqual(JSON.parse(options.body), ga4 ? { propertyId: m.resources.ga4, lookbackDays: 30 } : { spreadsheetId: m.resources.google_sheets, purpose: 'revenue' });
      return { status: mode === 'ga4' && ga4 ? 200 : mode === 'sheets' && !ga4 ? 500 : 403, headers, json: async () => ({ error: ga4 ? 'SERVICE_ACCOUNT_RESOURCE_NOT_GRANTED' : 'This provider resource is not approved for this customer' }) };
    } });
  assert.equal(output.length, 1); assert.ok(!JSON.stringify(output).includes('SECRET'));
  assert.equal(output[0].batch1ResourceCheck, ['pass', 'unconfigured'].includes(mode) ? 'PASS_RESOURCE_DENIAL' : 'CHECK_REQUIRED');
  assert.equal(calls.length, { pass: 13, unconfigured: 11, owner: 0, origin: 0, target: 1, ga4: 2, sheets: 3, timeout: 2, quota: 3, '429': 4, callback: 5 }[mode]);
  receipt.checks.push({ check: `browser ${mode}`, passed: true });
}
(async () => {
  let admin, client;
  try {
    assert.equal(process.env.DATABASE_URL || '', '');
    admin = new Client({ connectionString: 'postgresql://v1_audit@127.0.0.1:55444/ga4_alignment_test' }); await admin.connect(); await admin.query(`CREATE SCHEMA "${schema}"`);
    client = new Client({ connectionString: 'postgresql://v1_audit@127.0.0.1:55444/ga4_alignment_test', options: `-c search_path=${schema}` }); await client.connect();
    await client.query("CREATE TABLE clients(id text PRIMARY KEY,owner_id text NOT NULL,name text NOT NULL); CREATE TABLE campaigns(id text PRIMARY KEY,owner_id text,client_id text REFERENCES clients(id),name text NOT NULL,platform text,status text,currency text,reporting_time_zone text,spend numeric DEFAULT 0,impressions integer DEFAULT 0,clicks integer DEFAULT 0); CREATE TABLE unexpected_child(id text PRIMARY KEY,campaign_id text)");
    await fixture.seed(client, m); assert.equal((await client.query('SELECT id FROM campaigns')).rowCount, 0); receipt.checks.push({ check: 'seed rehearsal rolls back', passed: true });
    await fixture.seed(client, m, true); await fixture.cleanup(client, m); assert.equal((await client.query('SELECT id FROM campaigns')).rowCount, 1); receipt.checks.push({ check: 'cleanup rehearsal rolls back', passed: true });
    await client.query("UPDATE campaigns SET name='changed' WHERE id=$1", [m.campaignId]); await assert.rejects(fixture.cleanup(client, m, true)); assert.equal((await client.query('SELECT id FROM campaigns')).rowCount, 1); await client.query('UPDATE campaigns SET name=$1 WHERE id=$2', [m.tag, m.campaignId]); receipt.checks.push({ check: 'changed target refuses deletion', passed: true });
    await client.query("INSERT INTO unexpected_child VALUES('unexpected',$1)", [m.campaignId]); await assert.rejects(fixture.cleanup(client, m, true)); assert.equal((await client.query('SELECT id FROM campaigns')).rowCount, 1); await client.query("DELETE FROM unexpected_child WHERE id='unexpected'"); receipt.checks.push({ check: 'unexpected child refuses deletion', passed: true });
    await client.query("INSERT INTO clients VALUES('unrelated','unrelated','unrelated')"); await fixture.cleanup(client, m, true); assert.equal((await client.query('SELECT id FROM campaigns')).rowCount, 0); assert.deepEqual((await client.query('SELECT id FROM clients')).rows, [{ id: 'unrelated' }]); receipt.checks.push({ check: 'exact cleanup preserves unrelated rows', passed: true });
    for (const mode of ['pass', 'owner', 'origin', 'target', 'ga4', 'sheets', 'timeout', 'unconfigured', 'quota', '429', 'callback']) await browser(mode);
    receipt.result = 'PASS';
  } catch (error) { receipt.errorCode = error.code || error.name; console.error(error); process.exitCode = 1; }
  finally { await client?.end().catch(() => {}); if (admin) { await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end(); } fs.writeFileSync(path.join(__dirname, 'grant-browser-rehearsal.json'), JSON.stringify(receipt, null, 2) + '\n'); console.log(JSON.stringify(receipt)); }
})();
