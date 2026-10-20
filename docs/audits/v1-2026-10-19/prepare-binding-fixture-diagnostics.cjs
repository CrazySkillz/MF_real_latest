// Audit-only copies: preserve all assertions and load the current security helper.
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const dir = 'docs/audits/v1-2026-10-19', records = [];
for (const name of ['ga4-published-reader', 'hubspot-pipeline-automation-ui', 'salesforce-pipeline-automation-ui']) {
  const sourceFile = `server/${name}.test.ts`, source = fs.readFileSync(sourceFile, 'utf8');
  let copy = source.replace(/(["'])\.\/([^"']+)\1/g, (_m,q,t) => `${q}../../../server/${t}${q}`)
    .replace(/(["'])\.\.\/shared\/([^"']+)\1/g, (_m,q,t) => `${q}../../../shared/${t}${q}`);
  let change;
  if (name === 'ga4-published-reader') {
    copy = 'import { getInternalGA4RefreshWriteInput } from "../../../server/internal-request-auth";\n' + copy;
    const marker = 'bindings = { storage, ga4Service: provider,';
    assert.equal(copy.split(marker).length, 2);
    copy = copy.replace(marker, 'bindings = { storage, getInternalGA4RefreshWriteInput, ga4Service: provider,');
    change = 'Bind the actual internal-request authentication helper missing from the extracted-handler test.';
  } else {
    const marker = 'mockResolvedValue([{ id: "campaign-1" }] as any)';
    assert.equal(copy.split(marker).length, 2);
    copy = copy.replace(marker, 'mockResolvedValue([{ id: "campaign-1", status: "active" }] as any)');
    change = 'Give the intended eligible synthetic campaign its required active status.';
  }
  const target = `${dir}/${name}.binding-diagnostic.test.ts`;
  fs.writeFileSync(target, '// Audit-only fixture copy. All assertions unchanged.\n' + copy);
  records.push({ sourceFile, sourceHash: crypto.createHash('sha256').update(source).digest('hex'), target, change });
}
fs.writeFileSync(`${dir}/binding-fixture-preparation.json`, JSON.stringify({ at: new Date().toISOString(), records }, null, 2) + '\n');
console.log(JSON.stringify({ copies: records.length, originalAssertionsChanged: 0 }));
