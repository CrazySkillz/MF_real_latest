// Offline installed-tree inventory only. No advisory lookup/upload or installation.
const fs = require('node:fs'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const environment = {};
for (const [key, value] of Object.entries(process.env)) if (/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT)$/i.test(key)) environment[key] = value;
environment.NODE_OPTIONS = `--require=${path.resolve('docs/fixes/v1-batch-3/deployment-2026-10-22/local-network-only.cjs').replace(/\\/g, '/')}`;
const npm = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const result = spawnSync(process.execPath, [npm, 'ls', '--omit=dev', '--all', '--json', '--offline', '--ignore-scripts', '--cache', path.resolve('audit-temp/v1-batch8-npm-cache')], { env: environment, windowsHide: true, encoding: 'utf8', timeout: 60000, maxBuffer: 20 * 1024 * 1024 });
fs.writeFileSync(path.join(__dirname, 'installed-production-tree.json'), result.stdout || '', { flag: 'wx' });
fs.writeFileSync(path.join(__dirname, 'installed-production-tree.log'), result.stderr || '', { flag: 'wx' });
const tree = JSON.parse(result.stdout);
const output = { at: new Date().toISOString(), exitCode: result.status, directDependencies: Object.keys(tree.dependencies || {}).length, problems: tree.problems || [], advisoryLookup: false, dependencyChanges: false };
fs.writeFileSync(path.join(__dirname, 'dependency-inventory.json'), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(output));
