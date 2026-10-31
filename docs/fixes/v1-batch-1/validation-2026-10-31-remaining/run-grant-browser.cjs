const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto'), { parseEnv } = require('node:util'), { Client } = require('pg');
const fixture = require('./grant-browser-fixture.cjs'), hash = x => crypto.createHash('sha256').update(x).digest('hex');
const action = process.argv[2], privateFile = 'audit-temp/batch1-grant-browser-20261031.json';
const receipt = { at: new Date().toISOString(), action, result: 'NOT_VERIFIED', secretValuesEmitted: false }, clients = [];
(async () => {
  try {
    assert.ok(['seed', 'dry-cleanup', 'cleanup', 'verify'].includes(action));
    assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname, 'grant-browser-rehearsal.json'), 'utf8')).result, 'PASS');
    const u = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
    assert.equal(hash(JSON.stringify([u.hostname, u.port || '5432', u.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) u.searchParams.delete(key);
    const client = new Client({ connectionString: u.href, ssl: { rejectUnauthorized: true }, application_name: 'batch1-exact-grant-browser-fixture', connectionTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 18000 }); clients.push(client); await client.connect();
    const owner = (await client.query("SELECT c.owner_id FROM campaigns c JOIN clients cl ON cl.id=c.client_id AND cl.owner_id=c.owner_id WHERE c.id='36631f9f-5f32-4ae6-8d20-d8430abb364c' AND c.status='active' AND cl.id='e3ec20ad-89ea-450d-8caf-8c0ab7abd220'")).rows;
    assert.equal(owner.length, 1); assert.equal(hash(owner[0].owner_id), '1900b95d7361b41cd41b7a23571cb4645a1511a139d4044f04b9937ab86c6096');
    let m;
    if (action === 'seed') {
      assert.equal(fs.existsSync(privateFile), false, 'Existing fixture must be handled first');
      const ga4 = (await client.query("SELECT g.resource_id FROM service_account_resource_grants g JOIN campaigns c ON c.client_id=g.client_id AND c.owner_id=g.owner_id WHERE c.id='b74f98af-ede9-47af-9b19-0720ebb4d2c0' AND g.provider='ga4'")).rows;
      const sheets = (await client.query("SELECT spreadsheet_id FROM google_sheets_connections WHERE campaign_id='36631f9f-5f32-4ae6-8d20-d8430abb364c' AND is_active=true AND spreadsheet_id<>'pending'")).rows;
      assert.equal(ga4.length, 1); assert.equal(sheets.length, 1);
      m = fixture.plan(owner[0].owner_id, { ga4: ga4[0].resource_id, google_sheets: sheets[0].spreadsheet_id });
      fs.writeFileSync(privateFile, JSON.stringify(m, null, 2) + '\n', { flag: 'wx' });
      receipt.rehearsal = await fixture.seed(client, m);
      receipt.operation = await fixture.seed(client, m, true);
      const manual = fs.readFileSync(path.join(__dirname, 'manual-grant-template.js'), 'utf8').replace('/* GRANT_FIXTURE */ null', JSON.stringify(m));
      fs.writeFileSync('audit-temp/batch1-grant-browser-20261031.js', manual, { flag: 'wx' });
      await client.query('BEGIN'); await fixture.inspect(client, m); await client.query('ROLLBACK');
    } else {
      m = JSON.parse(fs.readFileSync(privateFile, 'utf8')); fixture.validate(m); assert.equal(m.ownerId, owner[0].owner_id);
      if (action === 'verify') {
        await client.query('BEGIN READ ONLY');
        for (const [table, id] of [['clients', m.clientId], ['campaigns', m.campaignId]]) assert.equal((await client.query(`SELECT id FROM ${table} WHERE id=$1`, [id])).rowCount, 0);
        await client.query('COMMIT');
        receipt.independentAbsence = true;
      } else receipt.operation = await fixture.cleanup(client, m, action === 'cleanup');
    }
    receipt.run = m.run; receipt.clientId = m.clientId; receipt.campaignId = m.campaignId; receipt.result = 'PASS';
  } catch (error) { receipt.errorCode = error.code || error.name; process.exitCode = 1; }
  finally { for (const client of clients) await client.end().catch(() => {}); const filename = `grant-browser-${action}-` + receipt.at.replace(/[:.]/g, '-') + '.json'; fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ ...receipt, filename })); }
})();
