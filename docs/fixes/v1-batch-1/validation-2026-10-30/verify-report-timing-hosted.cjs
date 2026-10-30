// Public metadata only: no cookies, tokens, credential lookup or mutations.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const commit = '05542b6e31af12a4485c6ce1ef3d8b5d397a0a1f';
const runtimeCommit = '7e413779680901598e07f5ddf84990a78fde0115';
const repository = 'https://api.github.com/repos/CrazySkillz/MF_real_latest';
async function get(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'batch1-public-ci-verification' }, redirect: 'error', signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200); return response.json();
}
(async () => {
  const runs = await get(repository + '/actions/runs?head_sha=' + commit);
  const run = runs.workflow_runs.filter(r => r.head_sha === commit && r.event === 'push').sort((a, b) => b.id - a.id)[0];
  if (!run) { console.log(JSON.stringify({ commit, status: 'AWAITING_RUN' })); return; }
  const jobs = await get(repository + '/actions/runs/' + run.id + '/jobs');
  const result = { commit, runId: run.id, url: run.html_url, status: run.status, conclusion: run.conclusion,
    jobs: jobs.jobs.map(j => ({ id: j.id, conclusion: j.conclusion, steps: j.steps.map(s => ({ name: s.name, status: s.status, conclusion: s.conclusion })) })) };
  console.log(JSON.stringify(result));
  if (run.status !== 'completed') return;
  assert.equal(run.conclusion, 'success'); assert.equal(jobs.total_count, 1);
  const job = jobs.jobs[0]; assert.equal(job.conclusion, 'success');
  for (const name of ['Run npm run check:ga4-kpi-certification', 'Run npm run test:current-version', 'Retained deferred-source evidence (non-blocking)']) {
    const step = job.steps.find(s => s.name === name);
    assert.equal(step?.status, 'completed'); assert.equal(step?.conclusion, 'success');
  }
  const health = await get('https://marketforensics.onrender.com/api/health');
  assert.equal(health.ok, true); assert.equal(health.commit, runtimeCommit);
  const receipt = { at: new Date().toISOString(), result: 'PASS', ...result, runtimeCommit, runtimeHealthy: true,
    credentialsUsed: false, personalBrowserUsed: false, mutationsRequested: false,
    boundary: 'New exact-commit hosted workflow and required steps pass, including the deferred-source step. Test counts were not extracted from hosted logs. Render remains on the unchanged healthy application revision; no signed-in/provider or whole-app readiness claim.' };
  const file = path.join(__dirname, 'report-timing-hosted.json');
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
})().catch(error => { console.error(JSON.stringify({ result: 'NOT_VERIFIED', code: error.code || error.name, message: error.message })); process.exitCode = 1; });
