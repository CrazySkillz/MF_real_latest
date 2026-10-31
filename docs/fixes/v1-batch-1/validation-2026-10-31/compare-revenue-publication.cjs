// Compare saved, scoped read-only observations; no network or database access.
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict'), { isDeepStrictEqual } = require('node:util');
const names = process.argv.slice(2);
assert.equal(names.length, 2);
const observations = names.map(name => {
  assert.match(name, /^revenue-publication-[\dTZ-]+\.json$/);
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
  assert.equal(data.result, 'PASS_READ_ONLY_OBSERVATION');
  assert.equal(data.databaseReadOnly, true);
  assert.equal(data.databaseWritesAttempted, false);
  assert.equal(data.secretValuesReturned, false);
  return data;
});
const [before, after] = observations;
assert.equal(before.campaign.id, '36631f9f-5f32-4ae6-8d20-d8430abb364c');
assert.equal(after.campaign.id, before.campaign.id);
const fields = ['campaign', 'sources', 'records', 'snapshots', 'work', 'overview'];
const unchanged = Object.fromEntries(fields.map(key => [key, isDeepStrictEqual(before[key], after[key])]));
const receipt = { at: new Date().toISOString(), before: names[0], after: names[1], unchanged,
  totalRevenue: after.snapshots[0]?.financial?.inputs?.revenue,
  result: Object.values(unchanged).every(Boolean) ? 'PASS_UNCHANGED_SCOPED_DATA' : 'REVIEW_DIFFERENCES',
  scope: 'Exact disposable campaign only; no provider mutation or authenticated browser acceptance.' };
const file = 'revenue-consistency-data-comparison.json';
fs.writeFileSync(path.join(__dirname, file), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ file, ...receipt }));
