// Read all static-test inputs directly from the deployed revision; never replace app files.
const fs = require('node:fs'), path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const files = [];
try {
  for (const [name, helper] of [['google-ads-revenue-wizard-context', 'readSource'], ['google-ads-spend-lifecycle-downstream', 'read']]) {
    let source = execFileSync('git', ['show', `2c3097bc:server/${name}.test.ts`], { encoding: 'utf8', windowsHide: true });
    const old = `const ${helper} = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");`;
    if (!source.includes(old)) throw Error('Baseline reader changed');
    source = 'import { execFileSync } from "node:child_process";\n' + source.replace(old,
      `const ${helper} = (...parts: string[]) => execFileSync('git', ['show', '2c3097bc:' + parts.join('/')], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });`);
    const target = path.resolve('server', `v1-batch6-baseline-${name}.test.ts`);
    fs.writeFileSync(target, source, { flag: 'wx' }); files.push(target);
  }
  const result = spawnSync(process.execPath, [path.join(__dirname, 'run-tests.cjs'), 'values-neighbor-deployed-oct25', ...files], { stdio: 'inherit', windowsHide: true, timeout: 600000 });
  process.exitCode = result.status ?? 1;
} finally { for (const file of files) fs.unlinkSync(file); }
