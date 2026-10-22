const fs = require('node:fs'), crypto = require('node:crypto');
const files = [
  'server/storage.ts', 'server/routes-oauth.ts', 'server/middleware/rateLimiter.ts', 'server/utils/csv.ts',
  'server/ga4-refresh-input-invalidation-postgres.test.ts', 'server/csv-spend-validation.test.ts',
  'server/csv-revenue-certification.test.ts', 'server/v1-batch4-import-rate-limit.test.ts',
  'server/v1-batch4-csv-input-contract.test.ts',
];
const manifest = { at: new Date().toISOString(), baseHead: 'ff3c511513c5c93b2c236ba92c95a274f97c4973',
  state: 'uncommitted; not pushed or deployed', files: files.map(file => {
    const bytes = fs.readFileSync(file);
    return { file, sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      lfSha256: crypto.createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex') };
  }) };
const path = `${__dirname}/${process.argv.includes('--response-contract') ? 'response-contract-manifest' : 'candidate-manifest'}.json`;
if (process.argv.includes('--verify')) {
  const saved = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (JSON.stringify(saved.files) !== JSON.stringify(manifest.files)) throw new Error('Candidate changed after manifest');
  console.log(`Verified ${files.length} unchanged runtime/test files`);
} else {
  fs.writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  console.log(`Recorded ${files.length} runtime/test files`);
}
