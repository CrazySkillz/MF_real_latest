// Preserve original rollback/isolation assertions; supply the new parent-lock fixture.
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const dir = 'docs/audits/v1-2026-10-19', records = [];
const names = ['csv-revenue-transaction', 'ga4-overview-spend-transaction', 'revenue-source-delete-transaction',
  'google-ads-ga4-spend-disconnect-transaction', 'google-sheets-ga4-disconnect-transaction', 'google-sheets-ga4-spend-disconnect-transaction',
  'ga4-kpi-persistence-destructive-safety', 'ga4-benchmark-persistence-destructive-safety', 'ga4-benchmark-history-idempotency'];
for (const name of names) {
  const sourceFile = `server/${name}.test.ts`, source = fs.readFileSync(sourceFile, 'utf8');
  let copy = source.replace(/(["'])\.\/([^"']+)\1/g, (_m,q,t) => `${q}../../../server/${t}${q}`)
    .replace(/(["'])\.\.\/shared\/([^"']+)\1/g, (_m,q,t) => `${q}../../../shared/${t}${q}`);
  const history = name === 'ga4-benchmark-history-idempotency';
  const marker = history ? '    try {\n      return await callback(tx);' : '  const transaction = vi.fn(';
  assert.equal(copy.split(marker).length, 2);
  // Runtime explicitly supports the not-yet-migrated work-table branch. This
  // diagnostic targets the existing rollback assertions, not lease behavior.
  const fixture = `
  const previousSelect = (tx as any).select;
  (tx as any).select = (...args: any[]) => ({
    from: (table: any) => {
      if (table[Symbol.for("drizzle:Name")] === "campaigns") {
        const locked = { for: async () => [{ id: "campaign-1" }] };
        return { where: () => ({ ...locked, orderBy: () => locked }) };
      }
      if (!previousSelect) throw new Error("Unexpected non-campaign select in audit fixture");
      return previousSelect(...args).from(table);
    },
  });
  ${history ? `const previousExecute = tx.execute;
  (tx as any).execute = async (query: any) => {
    if (new PgDialect().sqlToQuery(query).sql.includes("to_regclass")) return { rows: [{ name: null }] };
    return previousExecute(query);
  };` : `(tx as any).execute = vi.fn(async () => ({ rows: [{ name: null }] }));`}
`;
  copy = copy.replace(marker, fixture + marker);
  if (history || name.includes('persistence-destructive')) {
    const dbMarker = 'db: { transaction }';
    assert.equal(copy.split(dbMarker).length, 2);
    const rows = history ? 'state.benchmarkExists ? [{ id: "benchmark-1", campaignId: "campaign-1" }] : []'
      : `state.value.${name.includes('-kpi-') ? 'kpi' : 'benchmark'} ? [{ ...state.value.${name.includes('-kpi-') ? 'kpi' : 'benchmark'} }] : []`;
    copy = copy.replace(dbMarker, `db: { transaction, select: () => ({ from: () => ({ where: async () => (${rows}) }) }) }`);
  }
  const target = `${dir}/${name}.transaction-diagnostic.test.ts`;
  fs.writeFileSync(target, '// Audit fixture only: parent exists; durable work table absent; original assertions unchanged.\n' + copy);
  records.push({ sourceFile, sourceHash: crypto.createHash('sha256').update(source).digest('hex'), target });
}
fs.writeFileSync(`${dir}/transaction-fixture-preparation.json`, JSON.stringify({ at: new Date().toISOString(),
  boundary: 'Existing parent; pre-work-table compatibility branch; no lease/publication proof', records }, null, 2) + '\n');
console.log(JSON.stringify({ copies: records.length, originalAssertionsChanged: 0 }));
