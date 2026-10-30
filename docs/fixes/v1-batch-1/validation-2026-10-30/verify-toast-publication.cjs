// Public GETs only. No browser profiles, session credentials or credential-store access.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const runtimeCommit = '9a8853fc664629c02b15b899e689d613ebf9b1ac';
const commit = process.argv[2] || runtimeCommit;
assert.match(commit, /^[a-f0-9]{40}$/);
if (commit !== runtimeCommit) {
  const {execFileSync} = require('node:child_process');
  const changed = execFileSync('git', ['diff', '--name-only', runtimeCommit, commit], {encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean);
  assert.ok(changed.length && changed.every(file => file === 'server/shopify-sale-date-window-browser.test.ts' || file.startsWith('docs/')));
}
const origin = 'https://marketforensics.onrender.com';
const api = 'https://api.github.com/repos/CrazySkillz/MF_real_latest';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const normalize = text => text.replace(/([\w.-]+)-[A-Za-z0-9_-]{8,}\.(js|css)(?=["'])/g, '$1-HASH.$2').replace(/pk_(test|live)_[A-Za-z0-9]+/g, 'PUBLIC_CLERK_KEY');
async function get(url, json = true) {
  const r = await fetch(url, { headers: { 'User-Agent': 'batch1-public-verification' }, redirect: 'error', signal: AbortSignal.timeout(20000) });
  assert.equal(r.status, 200); return json ? r.json() : r.text();
}
(async () => {
  const runs = await get(api + '/actions/runs?head_sha=' + commit);
  const run = runs.workflow_runs.filter(r => r.head_sha === commit && r.event === 'push').sort((a,b) => b.id-a.id)[0];
  const health = await get(origin + '/api/health');
  const receipt = { at: new Date().toISOString(), commit, runtimeCommit, hosted: run ? { id: run.id, url: run.html_url, status: run.status, conclusion: run.conclusion } : null, runtime: { commit: health.commit, healthy: health.ok, expectedCommit: health.commit === runtimeCommit } };
  if (run?.status === 'completed') {
    const jobs = await get(api + '/actions/runs/' + run.id + '/jobs');
    receipt.jobs = jobs.jobs.map(j => ({ conclusion: j.conclusion, steps: j.steps.map(s => ({ name: s.name, status: s.status, conclusion: s.conclusion })) }));
  }
  if (health.commit === runtimeCommit && health.ok) {
    const html = await get(origin + '/', false);
    const entry = html.match(/src="(\/assets\/index-[A-Za-z0-9_-]+\.js)"/)?.[1]; assert.ok(entry);
    const code = await get(origin + entry, false);
    const localDir = path.resolve('dist/public/assets');
    const files = fs.readdirSync(localDir).filter(n => /^index-[A-Za-z0-9_-]+\.js$/.test(n)); assert.equal(files.length,1);
    const local = fs.readFileSync(path.join(localDir,files[0]),'utf8');
    receipt.toastAsset = { asset: entry, normalizedBuildMatches: normalize(code) === normalize(local), normalizedSha256: hash(normalize(code)), normalization: 'Only quoted hashed JS/CSS filenames and the public Clerk publishable key; all other entry-bundle bytes must match.' };
    assert.ok(receipt.toastAsset.normalizedBuildMatches);
  }
  const requiredSteps = ['Run npm run check:ga4-kpi-certification','Run npm run test:current-version','Retained deferred-source evidence (non-blocking)'];
  const stepsPassed = receipt.jobs?.length === 1 && requiredSteps.every(name => receipt.jobs[0].steps.some(s => s.name === name && s.status === 'completed' && s.conclusion === 'success'));
  receipt.result = receipt.hosted?.conclusion === 'success' && stepsPassed && receipt.runtime.expectedCommit && receipt.runtime.healthy && receipt.toastAsset?.normalizedBuildMatches ? 'PASS' : 'PENDING_OR_FAILED';
  receipt.boundary = 'Exact-commit public CI metadata, runtime health and built toast-module publication only; no signed-in live user/provider acceptance.';
  const filename = receipt.result === 'PASS' ? 'toast-publication.json' : 'toast-publication-progress.json';
  fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt));
})().catch(error => { console.error(JSON.stringify({ result: 'NOT_VERIFIED', code: error.code || error.name, message: error.message })); process.exitCode=1; });
