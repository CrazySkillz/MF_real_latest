// Run the two pre-existing neighboring suites against the exact deployed source.
// Temporary siblings preserve relative imports; application files are never replaced.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const root = process.cwd();
const files = [];
function baseline(original, destination, transform = text => text) {
  const contents = execFileSync('git', ['show', `2c3097bc:${original}`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  const target = path.resolve(root, destination);
  if (!target.startsWith(path.resolve(root, 'server') + path.sep)) throw Error('Invalid fixture target');
  fs.writeFileSync(target, transform(contents), { flag: 'wx' });
  files.push(target);
}
try {
  baseline('server/routes-oauth.ts', 'server/v1-batch6-baseline-routes.ts');
  const adsOnly = process.argv.includes('--google-ads');
  let suites;
  if (adsOnly) {
    baseline('server/google-ads-scheduler.ts', 'server/v1-batch6-baseline-google-ads.ts');
    baseline('server/google-ads-production-regression.test.ts', 'server/v1-batch6-baseline-google-ads.test.ts', text => text
      .replaceAll('"routes-oauth.ts"', '"v1-batch6-baseline-routes.ts"').replaceAll('"google-ads-scheduler.ts"', '"v1-batch6-baseline-google-ads.ts"'));
    suites = ['server/v1-batch6-baseline-google-ads.test.ts'];
  } else {
    baseline('server/scheduler.ts', 'server/v1-batch6-baseline-scheduler.ts');
    baseline('server/ga4-aggregate-saved-overview.test.ts', 'server/v1-batch6-baseline-aggregate.test.ts', text => text.replace('from "./scheduler"', 'from "./v1-batch6-baseline-scheduler"'));
    baseline('server/v1-batch1-access-regression.test.ts', 'server/v1-batch6-baseline-access.test.ts', text => text.replace('readFileSync("server/routes-oauth.ts"', 'readFileSync("server/v1-batch6-baseline-routes.ts"'));
    suites = ['server/v1-batch6-baseline-aggregate.test.ts', 'server/v1-batch6-baseline-access.test.ts'];
  }
  const result = spawnSync(process.execPath, [path.join(__dirname, 'run-tests.cjs'), adsOnly ? 'deployed-google-ads-baseline' : 'deployed-neighbor-baseline',
    ...suites], { stdio: 'inherit', windowsHide: true, timeout: 600000 });
  process.exitCode = result.status ?? 1;
} finally {
  for (const file of files) fs.unlinkSync(file);
}
