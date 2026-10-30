const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const origin = 'https://marketforensics.onrender.com';
const commit = '7e413779680901598e07f5ddf84990a78fde0115';
async function get(route) {
  assert.ok(route === '/' || route === '/api/health' || /^\/assets\/[A-Za-z0-9_.-]+\.js$/.test(route));
  const response = await fetch(origin + route, { redirect: 'error', signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200); return response.text();
}
const normalize = text => text.replace(/([\w.-]+)-[A-Za-z0-9_-]{8,}\.(js|css)(?=["'])/g, '$1-HASH.$2');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
(async () => {
  const health = JSON.parse(await get('/api/health'));
  assert.equal(health.commit, commit); assert.equal(health.ok, true);
  const html = await get('/');
  const entry = html.match(/src="(\/assets\/index-[A-Za-z0-9_-]+\.js)"/)?.[1];
  assert.ok(entry);
  const entryCode = await get(entry);
  const reportFile = entryCode.match(/(?:\.\/|\/assets\/|assets\/)(reports-[A-Za-z0-9_-]+\.js)/)?.[1];
  assert.ok(reportFile);
  const remote = await get('/assets/' + reportFile);
  const assets = path.join(process.cwd(), 'dist/public/assets');
  const localFiles = fs.readdirSync(assets).filter(name => /^reports-[A-Za-z0-9_-]+\.js$/.test(name));
  assert.equal(localFiles.length, 1);
  const local = fs.readFileSync(path.join(assets, localFiles[0]), 'utf8');
  const matched = normalize(local) === normalize(remote);
  const result = { at: new Date().toISOString(), result: matched ? 'PASS' : 'NOT_MATCHED', commit,
    entry, reportAsset: '/assets/' + reportFile, localBuildAsset: localFiles[0],
    sourceSha256: hash(fs.readFileSync('client/src/pages/reports.tsx', 'utf8').replace(/\r\n/g, '\n')),
    normalizedLocalSha256: hash(normalize(local)), normalizedRemoteSha256: hash(normalize(remote)),
    normalization: 'Only quoted hashed JS/CSS asset filenames; report logic and all other bytes must match.',
    boundary: 'Public static Reports chunk matches the locally built/tested correction. No JavaScript evaluated, personal browser/session used, or signed-in rendering/provider behavior inferred.' };
  if (matched) fs.writeFileSync(path.join(__dirname, 'report-cache-client.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
  if (!matched) process.exitCode = 1;
})().catch(error => { console.error(JSON.stringify({ result: 'NOT_VERIFIED', code: error.code || error.name })); process.exitCode = 1; });
