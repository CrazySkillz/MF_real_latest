// Static baseline reads the deployed Git objects only; app files are never replaced.
const fs = require('node:fs'), path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const target = path.resolve('server/v1-batch6-baseline-source-safety.test.ts');
let created = false;
try {
  let source = execFileSync('git', ['show', '2c3097bc:server/source-safety-regression.test.ts'], { encoding: 'utf8', windowsHide: true });
  const old = 'import fs from "fs";';
  if (!source.includes(old)) throw Error('Baseline reader changed');
  source = source.replace(old, `import { execFileSync } from "node:child_process";
const fs = { readFileSync: (file: string, _encoding: string) => execFileSync('git', ['show', '2c3097bc:' + path.relative(process.cwd(), file).replace(/\\\\/g, '/')], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 }) };`);
  fs.writeFileSync(target, source, { flag: 'wx' }); created = true;
  const result = spawnSync(process.execPath, [path.join(__dirname, 'run-tests.cjs'), 'retained-source-deployed-oct25', target], { stdio: 'inherit', windowsHide: true, timeout: 600000 });
  process.exitCode = result.status ?? 1;
} finally { if (created) fs.unlinkSync(target); }
