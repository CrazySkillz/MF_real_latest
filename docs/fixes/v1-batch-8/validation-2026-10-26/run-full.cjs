// Local-only Batch 8 release baseline. No application credentials or server startup.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { Client } = require('pg');
const root = process.cwd();
const directory = __dirname;
const cluster = path.resolve('audit-temp/v1-batch8-20261026-pg');
const bin = 'C:/Program Files/PostgreSQL/18/bin';
const legacyPrecision = process.argv.includes('--legacy-precision-port');
const files = process.argv.slice(3).filter(value => value !== '--legacy-precision-port');
if (legacyPrecision && (files.length !== 1 || files[0] !== 'server/v1-batch3-conversion-postgres.test.ts')) throw Error('Legacy port is restricted to the exact precision fixture');
const port = legacyPrecision ? 55443 : 55444;
const label = process.argv[2] || 'baseline';
if (!/^[a-z0-9-]+$/.test(label)) throw Error('Invalid label');
if (cluster !== path.join(root, 'audit-temp', 'v1-batch8-20261026-pg')) throw Error('Unexpected fixture path');
const environment = {};
for (const [key, value] of Object.entries(process.env)) {
  if (/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS)$/i.test(key)) environment[key] = value;
}
Object.assign(environment, { NODE_ENV: 'test', DATABASE_URL: '', V1_BATCH7_PRESERVE_ARTIFACTS: '1',
  CURRENT_VERSION_TEST_ERRORS_FILE: path.join(directory, `${label}-run-errors.json`),
  NODE_OPTIONS: `--require=${path.resolve('docs/fixes/v1-batch-3/deployment-2026-10-22/local-network-only.cjs').replace(/\\/g, '/')}`,
  GA4_TEST_DATABASE_URL: `postgresql://v1_audit@127.0.0.1:${port}/ga4_alignment_test`,
  NOTIFICATION_TEST_DATABASE_URL: `postgresql://v1_audit@127.0.0.1:${port}/notifications_test`,
  V1_BATCH2_TEST_DATABASE_URL: `postgresql://v1_audit@127.0.0.1:${port}/notifications_test`,
});
const manifest = { at: new Date().toISOString(), label, cluster, port, checks: [], databases: [] };
function command(executable, args, name, timeout = 60000) {
  const fd = fs.openSync(path.join(directory, `${label}-${name}.log`), 'wx');
  const result = spawnSync(executable, args, { env: environment, stdio: ['ignore', fd, fd], windowsHide: true, timeout });
  fs.closeSync(fd);
  const check = { name, exitCode: result.status, error: result.error?.code || null };
  manifest.checks.push(check); console.log(JSON.stringify(check));
  return result.status;
}
function trackedHashes() {
  const result = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw Error(`Cannot inventory tracked files: ${result.error?.code || result.status}`);
  const files = result.stdout.split('\0').filter(file => file && fs.statSync(file).isFile());
  return Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
}
async function inspect(database) {
  const client = new Client({ host: '127.0.0.1', port, user: 'v1_audit', database, ssl: false });
  await client.connect();
  try {
    const state = (await client.query("SELECT current_setting('data_directory') AS directory, current_setting('listen_addresses') AS listen, current_database() AS database, (SELECT count(*)::int FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()) AS other_sessions")).rows[0];
    if (path.resolve(state.directory).toLowerCase() !== cluster.toLowerCase() || state.listen !== '127.0.0.1') throw Error('Wrong local database identity');
    state.schemas = (await client.query("SELECT nspname FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname NOT LIKE 'pg_%' ORDER BY nspname")).rows.map(row => row.nspname);
    state.publicTables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(row => row.tablename);
    return state;
  } finally { await client.end(); }
}
(async () => {
  const before = trackedHashes();
  manifest.head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).stdout.trim();
  manifest.beforeHashes = before;
  let started = false;
  try {
    if (!fs.existsSync(cluster)) {
      if (command(`${bin}/initdb.exe`, ['-D', cluster, '-U', 'v1_audit', '-A', 'trust', '--encoding=UTF8', '--no-locale'], 'init') !== 0) throw Error('Fixture initialization failed');
    }
    const status = spawnSync(`${bin}/pg_ctl.exe`, ['-D', cluster, 'status'], { env: environment, windowsHide: true, encoding: 'utf8' });
    if (status.status !== 3) throw Error('Fixture already running or inaccessible');
    if (command(`${bin}/pg_ctl.exe`, ['-D', cluster, '-l', path.join(directory, `${label}-postgres.log`), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start'], 'start') !== 0) throw Error('Fixture startup failed');
    started = true;
    const admin = new Client({ host: '127.0.0.1', port, user: 'v1_audit', database: 'postgres', ssl: false });
    await admin.connect();
    try {
      for (const database of ['ga4_alignment_test', 'notifications_test']) {
        const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database]);
        if (!exists.rowCount) await admin.query(`CREATE DATABASE ${database}`);
      }
    } finally { await admin.end(); }
    manifest.beforeDatabases = await Promise.all(['ga4_alignment_test', 'notifications_test'].map(inspect));
    if (manifest.beforeDatabases.some(state => state.schemas.length || state.publicTables.length || state.other_sessions)) throw Error('Fixture is not empty');
    const testsStatus = command(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...files, '--maxWorkers=2', '--reporter=default', '--reporter=json', `--reporter=${path.resolve('scripts/ga4-test-run-errors.cjs')}`, `--outputFile=${path.join(directory, `${label}.json`)}`], 'tests', 1800000);
    if (testsStatus !== 0) process.exitCode = 1;
  } finally {
    if (started) {
      try { manifest.databases = await Promise.all(['ga4_alignment_test', 'notifications_test'].map(inspect)); }
      finally {
        const stop = command(`${bin}/pg_ctl.exe`, ['-D', cluster, '-m', 'fast', '-w', 'stop'], 'stop');
        const status = spawnSync(`${bin}/pg_ctl.exe`, ['-D', cluster, 'status'], { env: environment, windowsHide: true, encoding: 'utf8' });
        manifest.stopped = stop === 0 && status.status === 3;
        if (!manifest.stopped || manifest.databases.some(state => state.schemas.length || state.publicTables.length || state.other_sessions)) process.exitCode = 1;
      }
    }
    const after = trackedHashes();
    manifest.changedTrackedFiles = Object.keys(before).filter(file => before[file] !== after[file]);
    if (manifest.changedTrackedFiles.length) process.exitCode = 1;
    manifest.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(directory, `${label}-execution.json`), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ stopped: manifest.stopped, changedTrackedFiles: manifest.changedTrackedFiles, databaseCleanup: manifest.databases }));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
