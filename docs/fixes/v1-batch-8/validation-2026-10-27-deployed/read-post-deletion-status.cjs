// Anonymous GET only; never triggers refreshes or retries.
const fs = require('node:fs');
(async () => {
  const at = new Date().toISOString();
  const response = await fetch('https://marketforensics.onrender.com/health/scheduler', { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Status HTTP ${response.status}`);
  const data = await response.json();
  fs.writeFileSync(__dirname + `/post-deletion-scheduler-${at.replace(/[:.]/g, '-')}.json`, JSON.stringify({ at, data }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ at, auto: data.autoRefreshScheduler, daily: data.ga4DailyScheduler, reports: data.scheduler }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
