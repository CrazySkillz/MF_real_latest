const fs = require('node:fs'), crypto = require('node:crypto'), path = require('node:path');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name + '.json'), 'utf8'));
const packets = ['values-combined-oct25', 'values-neighbors-final-oct25', 'values-ga4-publication-oct25', 'values-disconnect-final-oct25', 'retained-boundaries-final-oct25'];
const latest = new Map();
for (const packet of packets) for (const file of read(packet).testResults) latest.set(path.relative(process.cwd(), file.name).replace(/\\/g, '/'), { packet, cases: file.assertionResults });
const files = [...latest].map(([file, entry]) => ({ file, packet: entry.packet,
  passed: entry.cases.filter(test => test.status === 'passed').length,
  failed: entry.cases.filter(test => test.status === 'failed').map(test => test.title),
  skipped: entry.cases.filter(test => !['passed', 'failed'].includes(test.status)).length,
}));
const baselineFailures = read('retained-source-deployed-oct25').testResults.flatMap(file => file.assertionResults.filter(test => test.status === 'failed').map(test => test.title)).sort();
const failures = files.flatMap(file => file.failed).sort();
if (JSON.stringify(failures) !== JSON.stringify(baselineFailures)) throw Error('The current failed assertions must match the independently reproduced baseline');
const prior = read('values-evidence-oct25');
const runtime = [...prior.hashes.map(row => row.file), 'server/storage.ts', 'server/utils/ga4RevenueEnrichment.ts', ...files.map(row => row.file)];
const hashes = [...new Set(runtime)].map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }));
const totals = files.reduce((sum, file) => ({ passed: sum.passed + file.passed, failed: sum.failed + file.failed.length, skipped: sum.skipped + file.skipped }), { passed: 0, failed: 0, skipped: 0 });
const record = { at: new Date().toISOString(), baseline: prior.baseline,
  scope: 'Google Ads unverified name/spend-weighted enrichment exclusion and retained ad-platform spend import guards/atomic replacement. Synthetic providers plus isolated PostgreSQL; no live account, browser or production data.',
  files, totals, hashes, build: read('retained-boundaries-verified-oct25-build-checks'),
  before: { enrichment: { passed: read('enrichment-before-oct25').numPassedTests, failed: read('enrichment-before-oct25').numFailedTests }, spend: { passed: read('retained-spend-before-oct25').numPassedTests, failed: read('retained-spend-before-oct25').numFailedTests } },
  baselineFailures, cleanup: { remainingOwnedFixtureSchemas: 0, fixturePostgresStopped: true },
  limits: ['All nine Batch 6 release acceptances remain open.',
    'Six pre-existing static assertions remain failed; baseline independently reproduced using deployed Git objects.',
    'Unverified Google Ads enrichment is excluded, not replaced by a new attribution model; persisted historical enrichment and report snapshots are not rewritten.',
    'The retained Google Ads/Meta/LinkedIn import refuses facts without persisted currency; this is not positive acceptance of those legacy imports.',
    'TikTok positive controls are synthetic; no deferred provider has been enabled or certified.',
    'No production external-caller or historical-data inventory; no in-flight owner/connection race certification.',
    'Other retained schedulers/readers, impression-share, raw chart denominators, goals/alerts/reports and live-provider acceptance remain incomplete.'],
};
fs.writeFileSync(path.join(__dirname, 'retained-boundaries-evidence-oct25.json'), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ files: files.length, ...totals, builds: record.build.checks.map(check => ({ name: check.name, exitCode: check.exitCode })) }));
