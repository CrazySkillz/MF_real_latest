// Read-only GitHub checks using the existing Git credential; no application login.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
(async () => {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const credential = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } });
  const secret = credential.split(/\r?\n/).find(line => line.startsWith('password='))?.slice(9);
  if (!secret) throw new Error('Existing GitHub credential unavailable');
  const get = async path => {
    const response = await fetch('https://api.github.com/repos/CrazySkillz/MF_real_latest' + path, { headers: { Authorization: `Bearer ${secret}`, 'User-Agent': 'MF-release-verification', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`GitHub read returned HTTP ${response.status}`);
    return response;
  };
  const runs = (await (await get(`/actions/runs?head_sha=${head}&per_page=100`)).json()).workflow_runs;
  const result = { at: new Date().toISOString(), head, boundary: 'Existing GitHub read-only access; no production credentials or mutations', runs: [] };
  for (const run of runs.filter(value => value.name === 'Tests')) {
    const jobs = (await (await get(`/actions/runs/${run.id}/jobs?per_page=100`)).json()).jobs;
    const record = { id: run.id, sha: run.head_sha, status: run.status, conclusion: run.conclusion, url: run.html_url, jobs: [] };
    for (const job of jobs) {
      const item = { id: job.id, name: job.name, status: job.status, conclusion: job.conclusion, steps: job.steps.map(step => ({ name: step.name, status: step.status, conclusion: step.conclusion })) };
      if (job.status === 'completed') {
        const log = (await (await get(`/actions/jobs/${job.id}/logs`)).text()).split(secret).join('[REDACTED]');
        item.log = `hosted-${head.slice(0, 8)}-${job.id}.log`;
        if (!fs.existsSync(__dirname + '/' + item.log)) fs.writeFileSync(__dirname + '/' + item.log, log, { flag: 'wx' });
        item.testSummary = log.split(/\r?\n/).filter(line => /\[current-version\]|\[deferred|Test Files\s|Tests\s+\d|FAIL\s/.test(line));
      }
      record.jobs.push(item);
    }
    result.runs.push(record);
  }
  const receipt = `hosted-ci-${head.slice(0, 8)}-${Date.now()}.json`;
  fs.writeFileSync(__dirname + '/' + receipt, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ receipt, head, runs: result.runs.map(run => ({ id: run.id, status: run.status, conclusion: run.conclusion, url: run.url, jobs: run.jobs.map(job => ({ id: job.id, status: job.status, conclusion: job.conclusion, summaries: job.testSummary?.filter(line => /Full test execution completed|Total \d+;|Blocking current-version|Visible non-blocking/.test(line)) })) })) }, null, 2));
})().catch(error => { console.error(JSON.stringify({ error: 'Read-only GitHub verification failed', detail: error.message.startsWith('GitHub read returned') ? error.message : error.name })); process.exitCode = 1; });
