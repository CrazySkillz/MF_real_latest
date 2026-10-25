const fs = require('node:fs'), crypto = require('node:crypto'), path = require('node:path');
const packets = ['values-combined-oct25', 'values-neighbors-final-oct25', 'values-ga4-publication-oct25', 'values-disconnect-final-oct25'];
const latest = new Map();
for (const packet of packets) {
  const result = JSON.parse(fs.readFileSync(path.join(__dirname, packet + '.json'), 'utf8'));
  for (const file of result.testResults) latest.set(path.relative(process.cwd(), file.name).replace(/\\/g, '/'), { packet, cases: file.assertionResults });
}
const files = [...latest].map(([file, entry]) => ({ file, packet: entry.packet,
  passed: entry.cases.filter(test => test.status === 'passed').length,
  failed: entry.cases.filter(test => test.status === 'failed').length,
  skipped: entry.cases.filter(test => !['passed', 'failed'].includes(test.status)).length }));
const runtime = ['client/src/pages/google-ads-analytics.tsx', 'client/src/pages/google-ads-analytics/GoogleAdsKpiModal.tsx',
  'client/src/pages/google-ads-analytics/GoogleAdsBenchmarkModal.tsx', 'server/routes-oauth.ts',
  'server/google-ads-scheduler.ts', 'server/instagram-scheduler.ts', 'server/linkedin-scheduler.ts',
  'server/meta-scheduler.ts', 'server/tiktok-scheduler.ts', 'server/scheduler.ts'];
const hashes = [...new Set([...runtime, ...files.map(row => row.file)])].map(file => ({ file,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }));
const totals = files.reduce((acc, row) => ({ passed: acc.passed + row.passed, failed: acc.failed + row.failed, skipped: acc.skipped + row.skipped }), { passed: 0, failed: 0, skipped: 0 });
const build = JSON.parse(fs.readFileSync(path.join(__dirname, 'values-verified-oct25-build-checks.json'), 'utf8'));
const record = { at: new Date().toISOString(), baseline: '2c3097bc13dc5206ae158a5ef505eee2b30d2ba0', boundary: 'Actual current page/helper/route bodies with synthetic inputs; actual isolated PostgreSQL reads; no live browser, provider, production database, delivery or full report acceptance.',
  files, totals, hashes, build, cleanup: { remainingOwnedFixtureSchemas: 0, fixturePostgresStopped: true },
  remaining: ['V1-024 in-flight worker/ownership and recovery paths', 'V1-046 exact GA4 attribution', 'V1-055 retained Spend import',
    'V1-104/106 complete save/refresh/report/export and historical-data propagation', 'V1-107 Search Impression Share eligibility and censoring',
    'V1-121 retained direct reads/shared writers/historical simulated outputs', 'V1-127 provider zero-row coverage, report parity, midpoint refresh',
    'V1-128 raw card/chart cost availability, scheduled goal/alert/report calculations, saved/manual provenance'],
};
fs.writeFileSync(path.join(__dirname, 'values-evidence-oct25.json'), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ files: files.length, ...totals, builds: build.checks.map(check => ({ name: check.name, exitCode: check.exitCode })) }));
