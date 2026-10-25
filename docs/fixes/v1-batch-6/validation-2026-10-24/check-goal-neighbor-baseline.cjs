// Execute the unchanged static checks against deployed Git objects, without replacing app files.
const fs = require('node:fs'), path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const revision = '9f7a40db5be72b89d256c44d94db730ae279d399';
const created = [];
try {
  for (const name of ['google-ads-revenue-platform-context', 'google-ads-revenue-scheduler-flow']) {
    let source = execFileSync('git', ['show', `${revision}:server/${name}.test.ts`], { encoding: 'utf8', windowsHide: true });
    const old = 'import { readFileSync } from "fs";';
    if (!source.includes(old)) throw Error('Baseline reader changed');
    source = source.replace(old, `import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
const readFileSync = (file: string, _encoding: string) => execFileSync('git', ['show', '${revision}:' + relative(process.cwd(), file).replace(/\\\\/g, '/')], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });`);
    const target = path.resolve(`server/v1-batch6-goal-baseline-${name}.test.ts`);
    fs.writeFileSync(target, source, { flag: 'wx' }); created.push(target);
  }
  const result = spawnSync(process.execPath, [path.join(__dirname, 'run-tests.cjs'), 'goal-neighbor-baseline-oct25', ...created],
    { stdio: 'inherit', windowsHide: true, timeout: 600000 });
  process.exitCode = result.status ?? 1;
} finally { for (const target of created) fs.unlinkSync(target); }
