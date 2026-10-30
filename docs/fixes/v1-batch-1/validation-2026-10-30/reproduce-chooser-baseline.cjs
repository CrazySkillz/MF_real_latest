// Replays the exact reported transition against the previous component in isolation.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const temp = path.resolve('server/revenue-source-chooser-baseline.test.ts');
assert.ok(!fs.existsSync(temp));
const before = execFileSync('git', ['show', '62a38e0e^:client/src/components/AddRevenueWizardModal.tsx'], { encoding: 'utf8', windowsHide: true });
const test = fs.readFileSync('server/revenue-source-chooser-loading-browser.test.ts','utf8');
const marker = 'const result = await build({';
assert.equal(test.split(marker).length, 2);
const overridden = test.replace(marker, marker + '\nplugins: [{name:"baseline",setup(builder){builder.onLoad({filter:/AddRevenueWizardModal\\.tsx$/},()=>({contents:' + JSON.stringify(before) + ',loader:"tsx"}));}}],');
try {
  fs.writeFileSync(temp, overridden, { flag: 'wx' });
  const run = spawnSync(process.execPath, [path.resolve('node_modules/vitest/vitest.mjs'), 'run', temp, '-t', 'does not report a failure', '--maxWorkers=1', '--no-file-parallelism'], { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  const output = (run.stdout || '') + (run.stderr || '');
  const reproduced = run.status === 1 && output.includes('2 failed | 8 skipped') && output.includes('Expected: 0') && output.includes('Received: 1') && !output.includes('Test timed out');
  const receipt = { at:new Date().toISOString(), baseline:'62a38e0e^', result:reproduced ? 'REPRODUCED' : 'NOT_VERIFIED', exitCode:run.status, output,
    boundary:'Previous chooser component only, with synthetic delayed responses. No production/provider requests or live writes.' };
  fs.writeFileSync(path.join(__dirname,'chooser-baseline.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({result:receipt.result,exitCode:run.status,output}));
  assert.ok(reproduced);
} finally { fs.unlinkSync(temp); }
