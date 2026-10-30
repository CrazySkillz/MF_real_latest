const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const commit = '02bb9ad28ad8101fd5e47248028a57b5475427b5';
const runId = 41053676789;
async function get(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'batch1-verification' }, signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200);
  return response.json();
}
(async () => {
  const [run, jobs, health] = await Promise.all([
    get(`https://api.github.com/repos/CrazySkillz/MF_real_latest/actions/runs/${runId}`),
    get(`https://api.github.com/repos/CrazySkillz/MF_real_latest/actions/runs/${runId}/jobs`),
    get('https://marketforensics.onrender.com/api/health'),
  ]);
  assert.equal(run.head_sha, commit); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
  assert.equal(jobs.total_count, 1);
  const job = jobs.jobs[0]; assert.equal(job.conclusion, 'success');
  for (const name of ['Run npm run check:ga4-kpi-certification', 'Run npm run test:current-version', 'Retained deferred-source evidence (non-blocking)']) {
    const step = job.steps.find(s => s.name === name);
    assert.equal(step?.status, 'completed'); assert.equal(step?.conclusion, 'success');
  }
  assert.equal(health.commit, commit); assert.equal(health.ok, true); assert.equal(health.nodeEnv, 'production');
  const result = {
    at: new Date().toISOString(), result: 'PASS', commit,
    hostedRun: { id: runId, url: run.html_url, status: run.status, conclusion: run.conclusion,
      jobs: [{ id: job.id, status: job.status, conclusion: job.conclusion,
        steps: job.steps.map(s => ({ name: s.name, status: s.status, conclusion: s.conclusion })) }] },
    deployment: { healthy: health.ok, nodeEnv: health.nodeEnv, commit: health.commit },
    boundary: 'Hosted workflow and every required test step passed on the exact deployed commit. Test counts were not extracted from hosted logs. No authenticated/provider journey or whole-app release certification is inferred.'
  };
  fs.writeFileSync(path.join(__dirname, 'email-exclusion-hosted.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ result: result.result, commit, runId, hostedConclusion: run.conclusion, deploymentHealthy: health.ok }));
})().catch(error => { console.error(JSON.stringify({ result: 'NOT_VERIFIED', code: error.code || error.name })); process.exitCode = 1; });
