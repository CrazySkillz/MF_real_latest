const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const environment = {};
for (const [key, value] of Object.entries(process.env)) {
  if (/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS)$/i.test(key)) environment[key] = value;
}
Object.assign(environment, { NODE_ENV: 'production', DATABASE_URL: '' });
const directory = 'docs/fixes/v1-batch-3/validation-2026-10-21-goal-precision';
fs.mkdirSync(directory, { recursive: true });
const checks = [];
for (const [name, args] of [
  ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['client-build', ['node_modules/vite/bin/vite.js', 'build']],
  ['server-build', ['node_modules/esbuild/bin/esbuild', 'server/index.ts', '--platform=node', '--packages=external', '--bundle', '--format=esm', '--outdir=dist']],
]) {
  const fd = fs.openSync(`${directory}/${name}.log`, 'w');
  const executable = name === 'server-build' ? 'node_modules/@esbuild/win32-x64/esbuild.exe' : process.execPath;
  const result = spawnSync(executable, name === 'server-build' ? args.slice(1) : args,
    { env: environment, stdio: ['ignore', fd, fd], windowsHide: true, timeout: 300000 });
  fs.closeSync(fd);
  console.log(JSON.stringify({ name, exitCode: result.status, error: result.error?.code || null }));
  checks.push({ name, exitCode: result.status, error: result.error?.code || null, log: `${name}.log` });
  if (result.status !== 0) process.exitCode = 1;
}
fs.writeFileSync(`${directory}/build-checks.json`, JSON.stringify({ at: new Date().toISOString(), nodeEnv: environment.NODE_ENV, checks }, null, 2) + '\n');
