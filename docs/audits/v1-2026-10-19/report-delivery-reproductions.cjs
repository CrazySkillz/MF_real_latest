const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const file = 'server/report-scheduler.ts', source = fs.readFileSync(file, 'utf8');
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const names = ['getLatestReportEmailAudit', 'confirmScheduledReportEmailDelivery'];
const selected = ast.statements.filter(s => ts.isFunctionDeclaration(s) && names.includes(s.name?.text));
assert.equal(selected.length, names.length);
const code = ts.transpileModule(selected.map(s => s.getText(ast)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const schema = new Proxy({}, { get: (_, key) => String(key) });
const results = [];
(async () => {
  for (const fixture of [
    { label: 'Missing email audit is treated as sent', rows: [], failRead: false },
    { label: 'Email audit read failure is treated as sent', rows: [], failRead: true },
    { label: 'SMTP acceptance is treated as sent without delivery evidence', rows: [{ id: 'smtp-accepted', provider: 'smtp', deliveryStatus: 'accepted' }], failRead: false },
    { label: 'Mailgun confirmation uses latest report audit without send-slot identity', rows: [{ id: 'old-attempt', provider: 'mailgun-api', providerResponseId: 'older-message', deliveryStatus: 'delivered' }], failRead: false },
  ]) {
    const filters = [], probes = [];
    const chain = { select() { return this; }, from() { return this; }, where(q) { filters.push(q); return this; }, orderBy() { return this; }, limit() { return fixture.failRead ? Promise.reject(new Error('isolated audit read failure')) : Promise.resolve(fixture.rows); }, update() { return this; }, set() { return this; }, catch() { return Promise.resolve([]); } };
    const fn = new Function('db', 'emailAlertEvents', 'eq', 'and', 'desc', 'waitForMailgunDelivery', 'mapMailgunDeliveryToAlertEmailStatus', code + '\nreturn confirmScheduledReportEmailDelivery;')(
      chain, schema, (a,b)=>({field:a,value:b}), (...q)=>q, x=>x,
      async id=>{ probes.push(id); return { status: 'delivered' }; }, x=>x,
    );
    const result = await fn('fixture-report');
    assert.equal(result.sent, true);
    if (fixture.rows[0]?.provider === 'mailgun-api') assert.deepEqual(probes, ['older-message']);
    else assert.equal(probes.length, 0);
    results.push({ case: fixture.label, result, filters, deliveryProbes: probes });
  }
  fs.writeFileSync('docs/audits/v1-2026-10-19/report-delivery-reproductions.json', JSON.stringify({ head: '777aae6f6353e998d60b635d3e66b413093117c2', boundary: 'Exact current confirmation/query helpers with fixture database and provider. No email, provider request or database mutation. Latest-audit fixture proves missing attempt/slot correlation, not a live misattribution.', results }, null, 2) + '\n');
  console.log(`${results.length} report-delivery cases executed`);
})().catch(e=>{ console.error(e); process.exitCode=1; });
