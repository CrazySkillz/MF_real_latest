const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto'), { parseEnv } = require('node:util'), { execFileSync } = require('node:child_process'), { Client } = require('pg');
const { run } = require('./grant-transaction.cjs');
const sha = '5f0ffe96302aad0abee45c1c23f1a38bb77d2dce', hash = x => crypto.createHash('sha256').update(x).digest('hex');
const receipt = { at: new Date().toISOString(), result: 'NOT_VERIFIED', productionDatabase: true, runtimeCommit: sha, realProviderCalls: 0, committedRows: 0, secretValuesEmitted: false }, clients = [];
(async () => {
  try {
    assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname, 'grant-transaction-local.json'), 'utf8')).result, 'PASS');
    receipt.sourceHashes = {};
    for (const file of ['server/storage.ts', 'shared/schema.ts', 'server/utils/ga4-service-account.ts', 'server/utils/google-sheets-service-account.ts', 'server/utils/google-ads-service-account.ts']) {
      const local = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      const released = execFileSync('git', ['show', `${sha}:${file}`], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).replace(/\r\n/g, '\n');
      assert.equal(local, released); receipt.sourceHashes[file] = hash(local);
    }
    const response = await fetch('https://marketforensics.onrender.com/api/health', { redirect: 'error', signal: AbortSignal.timeout(15000) });
    const health = await response.json(); assert.equal(response.status, 200); assert.equal(health.ok, true); assert.equal(health.commit, sha);
    const u = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
    assert.equal(hash(JSON.stringify([u.hostname, u.port || '5432', u.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) u.searchParams.delete(key);
    for (let i = 0; i < 2; i++) { const client = new Client({ connectionString: u.href, ssl: { rejectUnauthorized: true }, application_name: 'batch1-grant-rollback-only', connectionTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 18000 }); clients.push(client); await client.connect(); }
    const triggers = await clients[0].query("SELECT count(*)::int n FROM pg_trigger WHERE NOT tgisinternal AND tgrelid=ANY(ARRAY['public.clients'::regclass,'public.campaigns'::regclass,'public.service_account_resource_grants'::regclass])");
    assert.equal(triggers.rows[0].n, 0, 'Unexpected trigger; no fixture writes allowed');
    receipt.acceptance = await run(...clients);
    receipt.result = 'PASS';
  } catch (error) { receipt.errorCode = error.code || error.name; process.exitCode = 1; }
  finally { for (const client of clients) await client.end().catch(() => {}); const name = 'grant-production-' + receipt.at.replace(/[:.]/g, '-') + '.json'; fs.writeFileSync(path.join(__dirname, name), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ ...receipt, file: name })); }
})();
