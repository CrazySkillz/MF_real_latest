// Public GETs only: no login, provider request, credential or database access.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const commit = process.argv[2];
assert.match(commit || '', /^[a-f0-9]{40}$/);
const origin = 'https://marketforensics.onrender.com';
const api = 'https://api.github.com/repos/CrazySkillz/MF_real_latest';
const normalize = text => text.replace(/([\w.-]+)-[A-Za-z0-9_-]{8,}\.(js|css)(?=["'])/g, '$1-HASH.$2').replace(/pk_(test|live)_[A-Za-z0-9]+/g, 'PUBLIC_CLERK_KEY');
async function get(url, json = true) {
  const r = await fetch(url, { headers: { 'User-Agent': 'batch1-revenue-status-publication' }, redirect: 'error', signal: AbortSignal.timeout(20000) });
  assert.equal(r.status, 200, `Public GET ${url}: HTTP ${r.status}`);
  return json ? r.json() : r.text();
}
(async () => {
  const [health, runs] = await Promise.all([get(origin + '/api/health'), get(api + '/actions/runs?head_sha=' + commit)]);
  const run = runs.workflow_runs.filter(r => r.head_sha === commit && r.event === 'push').sort((a,b) => b.id-a.id)[0];
  const receipt = { at: new Date().toISOString(), commit, runtime: { commit: health.commit, healthy: health.ok, expectedCommit: health.commit === commit },
    hosted: run ? { id: run.id, url: run.html_url, status: run.status, conclusion: run.conclusion } : null };
  if (run) {
    const jobs = await get(api + '/actions/runs/' + run.id + '/jobs');
    receipt.jobs = jobs.jobs.map(j => ({ conclusion: j.conclusion, steps: j.steps.map(s => ({ name: s.name, status: s.status, conclusion: s.conclusion })) }));
  }
  if (health.commit === commit && health.ok) {
    const html = await get(origin + '/', false);
    const entry = html.match(/src="(\/assets\/index-[A-Za-z0-9_-]+\.js)"/)?.[1]; assert.ok(entry);
    const code = await get(origin + entry, false);
    const page = code.match(/(?:\.\/|\/assets\/|assets\/)?(ga4-metrics-[A-Za-z0-9_-]+\.js)/)?.[1]; assert.ok(page);
    const remote = await get(origin + '/assets/' + page, false);
    const localDir = path.resolve('dist/public/assets');
    const files = fs.readdirSync(localDir).filter(n => /^ga4-metrics-[A-Za-z0-9_-]+\.js$/.test(n)); assert.equal(files.length, 1);
    const local = fs.readFileSync(path.join(localDir, files[0]), 'utf8');
    receipt.asset = { path: '/assets/' + page, normalizedBuildMatches: normalize(remote) === normalize(local),
      sha256: crypto.createHash('sha256').update(normalize(remote)).digest('hex') };
    assert.ok(receipt.asset.normalizedBuildMatches);
  }
  receipt.published = receipt.runtime.expectedCommit && receipt.runtime.healthy && receipt.asset?.normalizedBuildMatches === true;
  const steps = receipt.jobs?.flatMap(j => j.steps) || [];
  const required = ['Run npm run check:ga4-kpi-certification', 'Run npm run test:current-version', 'Retained deferred-source evidence (non-blocking)'];
  receipt.result = receipt.published && run?.conclusion === 'success' && required.every(name => steps.some(s => s.name === name && s.conclusion === 'success')) ? 'PASS' : 'PENDING_OR_FAILED';
  receipt.boundary = 'Exact deployed runtime, compiled GA4 page and hosted check metadata; authenticated customer-browser acceptance remains manual.';
  const file = 'publication-' + receipt.at.replace(/[:.]/g, '-') + '.json';
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(receipt,null,2)+'\n', { flag: 'wx' });
  console.log(JSON.stringify({ file, ...receipt }));
})().catch(error => { console.error(JSON.stringify({ result: 'NOT_VERIFIED', code: error.code || error.name, message: error.message })); process.exitCode=1; });
