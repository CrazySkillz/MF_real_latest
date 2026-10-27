// Anonymous status GETs only. Does not start, retry, or mutate any refresh.
const fs = require('node:fs');
const due = Date.parse('2026-10-27T07:00:00.000Z');
const deadline = due + 15 * 60000;
const observations = [];
(async () => {
  while (Date.now() < deadline) {
    const at = new Date().toISOString();
    const response = await fetch('https://marketforensics.onrender.com/health/scheduler', { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Status HTTP ${response.status}`);
    const data = await response.json();
    observations.push({ at, data });
    fs.writeFileSync(__dirname + '/natural-run-observations.json', JSON.stringify(observations, null, 2) + '\n');
    const daily = data.ga4DailyScheduler;
    console.log(JSON.stringify({ at, scheduledRuns: daily?.totalScheduledRuns, trigger: daily?.lastRunTrigger, status: daily?.lastRunStatus, running: daily?.inProgress,
      finishedAt: daily?.lastRunFinishedAt, aligned: daily?.alignedRefreshCampaigns?.find(row => row.campaignIdHash === 'de4775c3b435'),
      failures: daily?.lastAlignedRefreshFailures }));
    if (daily?.totalScheduledRuns > 0 && Date.parse(daily.lastRunFinishedAt) >= due) return;
    await new Promise(resolve => setTimeout(resolve, 45000));
  }
  console.log(JSON.stringify({ result: 'Scheduled completion was not observed within the bounded window' }));
})().catch(error => { console.log(JSON.stringify({ error: error.message })); process.exitCode = 1; });
