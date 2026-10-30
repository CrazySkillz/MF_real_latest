const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const environment = {};
for (const [key, value] of Object.entries(process.env)) {
  if (/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS)$/i.test(key)) environment[key] = value;
}
Object.assign(environment, { NODE_ENV: 'production', DATABASE_URL: '', VITE_ENABLE_SALESFORCE_REVENUE_SOURCE: 'true' });
const directory = __dirname;
const label = process.argv[2] || '';
if (label && !/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid build label');
const prefix = label ? `${label}-` : '';
fs.mkdirSync(directory, { recursive: true });
const checks = [];
for (const [name, args] of [
  ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['client-build', ['node_modules/vite/bin/vite.js', 'build']],
  ['server-build', ['node_modules/esbuild/bin/esbuild', 'server/index.ts', '--platform=node', '--packages=external', '--bundle', '--format=esm', '--outdir=dist']],
]) {
  if (process.argv.includes('--typecheck-only') && name !== 'typecheck') continue;
  if (label && name === 'client-build' && !process.argv.includes('--with-client')) continue;
  const fd = fs.openSync(`${directory}/${prefix}${name}.log`, 'wx');
  const executable = name === 'server-build' ? 'node_modules/@esbuild/win32-x64/esbuild.exe' : process.execPath;
  const result = spawnSync(executable, name === 'server-build' ? args.slice(1) : args,
    { env: environment, stdio: ['ignore', fd, fd], windowsHide: true, timeout: 300000 });
  fs.closeSync(fd);
  console.log(JSON.stringify({ name, exitCode: result.status, error: result.error?.code || null }));
  checks.push({ name, exitCode: result.status, error: result.error?.code || null, log: `${prefix}${name}.log` });
  if (result.status !== 0) process.exitCode = 1;
}
fs.writeFileSync(`${directory}/${prefix}build-checks.json`, JSON.stringify({ at: new Date().toISOString(), nodeEnv: environment.NODE_ENV, checks }, null, 2) + '\n', { flag: 'wx' });
