// Compare the two failed source-text assertions with committed code, without running the app.
const fs = require('node:fs'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const baselineCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
const baseline = execFileSync('git', ['show', `${baselineCommit}:server/ga4-daily-scheduler.ts`], { encoding: 'utf8', windowsHide: true });
const current = fs.readFileSync('server/ga4-daily-scheduler.ts', 'utf8');
const inspect = source => ({
  financialRefreshIndex: source.indexOf('await runDailyAutoRefreshOnce(trigger === "scheduled" ? "scheduled" : "manual", {'),
  expectedPublicationIndex: source.indexOf('if (!finishEachCampaign) await publishRefresh(await refreshAllGA4DailyMetrics({ campaignId, ...refreshWriteInput,'),
  expectedStorageStartPresent: source.includes('const storageStartDate ='),
});
const before = inspect(baseline), after = inspect(current);
assert.ok(before.financialRefreshIndex >= 0 && after.financialRefreshIndex >= 0);
assert.equal(before.expectedPublicationIndex, -1); assert.equal(after.expectedPublicationIndex, -1);
assert.equal(before.expectedStorageStartPresent, false); assert.equal(after.expectedStorageStartPresent, false);
const result = { at: new Date().toISOString(), baselineCommit, before, after,
  result: 'BOTH_FAILED_SOURCE_TEXT_ASSERTIONS_ALSO_FAIL_ON_COMMITTED_CODE',
  limit: 'Exact failed assertions inspected; this is not a rerun or waiver of the full baseline suite.' };
fs.writeFileSync(`${__dirname}/revenue-stage-timing-baseline.json`, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result));
