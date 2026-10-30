const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const commit = '7e413779680901598e07f5ddf84990a78fde0115';
const origin = 'https://marketforensics.onrender.com';
const repository = 'https://api.github.com/repos/CrazySkillz/MF_real_latest';
async function get(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'batch1-verification' }, redirect: 'error', signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200);
  return response.json();
}
function saveOnce(name, receipt) {
  const filename = path.join(__dirname, name);
  if (!fs.existsSync(filename)) fs.writeFileSync(filename, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
}
(async () => {
  const [health, runs] = await Promise.all([get(origin + '/api/health'), get(repository + '/actions/runs?head_sha=' + commit)]);
  const deployed = health.ok === true && health.commit === commit && health.nodeEnv === 'production';
  if (deployed && !fs.existsSync(path.join(__dirname, 'report-cache-deployed.json'))) {
    const checks = [];
    for (const route of ['/api/clients', '/api/campaigns', '/api/campaigns/b74f98af-ede9-47af-9b19-0720ebb4d2c0']) {
      const response = await fetch(origin + route, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, 401); await response.text();
      checks.push({ route: route.replace('b74f98af-ede9-47af-9b19-0720ebb4d2c0', ':promoId'), status: 401 });
    }
    saveOnce('report-cache-deployed.json', { at: new Date().toISOString(), result: 'PASS', commit, healthy: true, checks,
      credentialsUsed: false, mutationsRequested: false,
      boundary: 'Exact deployed commit/health and three anonymous GET denials. Does not independently validate signed-in Reports rendering, other browser storage, provider behavior or whole-app readiness.' });
  }
  const run = runs.workflow_runs.filter(r => r.head_sha === commit && r.event === 'push').sort((a, b) => b.id - a.id)[0];
  if (run?.status === 'completed' && run.conclusion === 'success') {
    const jobs = await get(repository + '/actions/runs/' + run.id + '/jobs');
    assert.equal(jobs.total_count, 1);
    const job = jobs.jobs[0]; assert.equal(job.conclusion, 'success');
    for (const name of ['Run npm run check:ga4-kpi-certification', 'Run npm run test:current-version', 'Retained deferred-source evidence (non-blocking)']) {
      const step = job.steps.find(s => s.name === name);
      assert.equal(step?.status, 'completed'); assert.equal(step?.conclusion, 'success');
    }
    saveOnce('report-cache-hosted.json', { at: new Date().toISOString(), result: 'PASS', commit,
      run: { id: run.id, url: run.html_url, conclusion: run.conclusion },
      jobs: [{ id: job.id, conclusion: job.conclusion, steps: job.steps.map(s => ({ name: s.name, conclusion: s.conclusion })) }],
      boundary: 'Exact-commit hosted workflow and required steps pass; hosted test counts not extracted. No signed-in or provider acceptance inferred.' });
  }
  console.log(JSON.stringify({ commit, deployed, currentHealthy: health.ok === true, currentCommit: health.commit,
    hostedRunId: run?.id, hostedStatus: run?.status, hostedConclusion: run?.conclusion }));
  if (run?.status === 'completed' && run.conclusion !== 'success') process.exitCode = 1;
})().catch(error => { console.error(JSON.stringify({ result: 'NOT_VERIFIED', code: error.code || error.name })); process.exitCode = 1; });
