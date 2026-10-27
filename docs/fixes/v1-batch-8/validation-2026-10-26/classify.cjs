// Mechanical failure inventory, not an automatic claim about application correctness.
const fs = require('node:fs'), path = require('node:path');
const label = process.argv[2] || 'consolidated';
if (!/^[a-z0-9-]+$/.test(label)) throw Error('Invalid label');
const result = JSON.parse(fs.readFileSync(path.join(__dirname, `${label}-reconciliation.json`), 'utf8'));
const classifications = result.failures.map(row => {
  const first = row.error?.split('\n')[0] || '';
  let mechanism = 'VALUE_OR_FLOW_ASSERTION_REQUIRES_TRACE';
  if (/is not a function|tx\.select.*is not a function/.test(first)) mechanism = 'TEST_DOUBLE_QUERY_OR_METHOD_MISSING';
  else if (/is not defined/.test(first)) mechanism = 'EXTRACTED_HANDLER_BINDING_MISSING';
  else if (/not valid JSON/.test(first)) mechanism = 'TEST_ASSERTION_JSON_PARSE_FAILED';
  else if (/to contain|expected -1 to be|to be less than -1/.test(first)) mechanism = 'SOURCE_TEXT_OR_EXTRACTION_ASSERTION';
  return { id: row.id, file: row.file, name: row.name, firstFailure: first, mechanism, previouslyFailed: row.previouslyFailed, status: 'OPEN', waived: false,
    limit: 'This records the observed failure mechanism. Runtime cause and intended safety requirement must be traced before any correction; no failure is waived.' };
});
const counts = classifications.reduce((out, row) => { out[row.mechanism] = (out[row.mechanism] || 0) + 1; return out; }, {});
fs.writeFileSync(path.join(__dirname, `${label}-failure-inventory.json`), JSON.stringify({ at: new Date().toISOString(), counts, classifications }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(counts, null, 2));
