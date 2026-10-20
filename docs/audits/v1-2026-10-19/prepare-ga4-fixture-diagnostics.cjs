// Audit-only fixture copies: add the missing publication-version reader; assertions unchanged.
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto'), ts = require('typescript');
const dir = 'docs/audits/v1-2026-10-19';
const acceptance = process.argv.includes('--acceptance');
const files = [
  'ga4-aggregate-saved-overview',
  'ga4-kpi-custom-preservation-regression',
  'ga4-kpi-financial-window-regression',
  'ga4-kpi-reporting-window-regression',
  'ga4-kpi-real-path-parity-regression',
  'shopify-downstream-content-regression',
];
const records = [];
for (const name of files) {
  const file = `server/${name}.test.ts`, source = fs.readFileSync(file, 'utf8');
  let updated = source.replace(/(["'])\.\/([^"']+)\1/g, (_m, quote, target) => `${quote}../../../server/${target}${quote}`)
    .replace(/(["'])\.\.\/shared\/([^"']+)\1/g, (_m, quote, target) => `${quote}../../../shared/${target}${quote}`);
  if (name === 'ga4-aggregate-saved-overview') {
    assert.ok(updated.indexOf('"getCampaign", "getPrimaryGA4Connection"') < 300);
    updated = updated.replace('"getCampaign", "getPrimaryGA4Connection"', '"getGA4PublicationVersion", "getCampaign", "getPrimaryGA4Connection"');
  } else {
    const marker = '  getCampaign: vi.fn(),';
    assert.equal(updated.split(marker).length, 2, name);
    updated = updated.replace(marker, '  getGA4PublicationVersion: vi.fn(),\n' + marker);
  }
  const setup = 'storageMock.getCampaign.mockResolvedValue(';
  assert.ok(updated.includes(setup), `${name}: setup`);
  updated = updated.replace(setup, 'storageMock.getGA4PublicationVersion.mockResolvedValue(0);\n  ' + setup);
  let expectationsUpdated = 0;
  if (acceptance) {
    const sf = ts.createSourceFile(file, updated, ts.ScriptTarget.Latest, true);
    const positions = [];
    const walk = n => {
      if (ts.isCallExpression(n) && /^expect\(storageMock\.(updateKPI|updateBenchmark)\)\.toHaveBeenCalledWith$/.test(n.expression.getText(sf))) {
        const object = n.arguments[1];
        if (object && ts.isObjectLiteralExpression(object) && object.properties.length === 1 && object.properties[0].name?.getText(sf) === 'currentValue') positions.push(object.end - 1);
      }
      ts.forEachChild(n, walk);
    };
    walk(sf);
    for (const position of positions.sort((a,b) => b-a)) updated = updated.slice(0, position) + `, publicationVersion: { campaignId: ${name.startsWith('shopify') ? 'campaign.id' : '"campaign-1"'}, version: 0 } ` + updated.slice(position);
    expectationsUpdated = positions.length;
  }
  const target = `${dir}/${name}.fixture-${acceptance ? 'acceptance' : 'diagnostic'}.test.ts`;
  fs.writeFileSync(target, '// Audit-only copy; production module and original test unchanged. Publication version is a fixture.\n' + updated);
  records.push({ source: file, sha256: crypto.createHash('sha256').update(source).digest('hex'), target, expectationsUpdated, changes: ['Resolve existing imports relative to the audit directory.', 'Supply missing getGA4PublicationVersion fixture returning zero.', acceptance ? 'Preserve every current-value assertion and additionally require the exact campaign/version write fence.' : 'No assertion change.'] });
}
fs.writeFileSync(`${dir}/ga4-fixture-${acceptance ? 'acceptance' : 'diagnostics'}-preparation.json`, JSON.stringify({ at: new Date().toISOString(), records }, null, 2) + '\n');
console.log(`Prepared ${records.length} audit-only diagnostic copies`);
