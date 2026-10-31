// Verify saved observations only; no network, credentials or database writes.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const names = process.argv.slice(2);
assert.equal(names.length, 2);
const [before, after] = names.map(name => {
  assert.match(name, /^revenue-publication-[\dTZ-]+\.json$/);
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
  assert.equal(data.result, 'PASS_READ_ONLY_OBSERVATION');
  assert.equal(data.databaseReadOnly, true);
  assert.equal(data.databaseWritesAttempted, false);
  assert.equal(data.secretValuesReturned, false);
  return data;
});
assert.equal(after.campaign.id, '36631f9f-5f32-4ae6-8d20-d8430abb364c');
assert.deepEqual(after.campaign, before.campaign);
assert.deepEqual(after.records, before.records);
const definitions = observation => observation.sources.map(({ connected_at, ...source }) => source);
assert.deepEqual(definitions(after), definitions(before));
const snapshot = after.snapshots[0], display = snapshot.publication.display;
const total = Number(snapshot.financial.inputs.revenue.value);
assert.equal(snapshot.financial.currency, 'EUR');
assert.equal(snapshot.financial.inputs.revenue.available, true);
assert.equal(snapshot.publication.reportingDate, snapshot.reporting_date);
assert.deepEqual(snapshot.financial.inputs.spend, before.snapshots[0].financial.inputs.spend);
assert.ok(Object.values(snapshot.sourceMatches).every(source => source.matches));
assert.deepEqual(Object.keys(snapshot.publication.sources).sort(), display.sources.map(source => source.sourceId).sort());
assert.equal(display.nativeRevenue, after.overview[0].totals.revenue);
const imported = Object.fromEntries(display.sources.map(source => [source.sourceType, source.revenue]));
assert.deepEqual(imported, { hubspot: 0, salesforce: 0, shopify: 785.95, google_sheets: 31000 });
assert.ok(Math.abs(display.nativeRevenue + display.sources.reduce((sum, source) => sum + source.revenue, 0) - total) < 0.005);
const nativeChange = display.nativeRevenue - before.overview[0].totals.revenue;
assert.ok(Math.abs(total - Number(before.snapshots[0].financial.inputs.revenue.value) - nativeChange) < 0.005);
const work = after.work.find(item => item.id === snapshot.publication.workId);
assert.equal(work.status, 'completed');
assert.equal(work.has_error, false);
assert.equal(work.invalidated, false);
const receipt = { at: new Date().toISOString(), result: 'PASS_LIVE_SAVED_BREAKDOWN', before: names[0], after: names[1],
  campaignAndSourceIdentityUnchanged: true, importedRecordsUnchanged: true, imported,
  nativeRevenue: display.nativeRevenue, totalRevenue: total, nativeRevenueChange: Math.round(nativeChange * 100) / 100,
  displayReconcilesWithTotal: true, sourceHashesMatch: true, workId: work.id, workStatus: work.status, workHasError: work.has_error,
  explanation: 'An existing background refresh advanced native GA4 data and publication bookkeeping. The complete revenue change matches the native GA4 change; imported records are unchanged.',
  scope: 'Saved production result for the exact disposable campaign. Personal browser not operated; no manual import or provider request triggered.' };
const file = 'revenue-consistency-live-data-verification.json';
fs.writeFileSync(path.join(__dirname, file), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ file, ...receipt }));
