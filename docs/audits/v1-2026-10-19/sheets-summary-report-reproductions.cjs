const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const out = 'docs/audits/v1-2026-10-19/';
function source(file) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const named = new Map();
  function visit(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && !named.has(n.name.text)) named.set(n.name.text, `const ${n.getText(sf)};`);
    if (ts.isFunctionDeclaration(n) && n.name && !named.has(n.name.text)) named.set(n.name.text, n.getText(sf).replace(/^export /, ''));
    ts.forEachChild(n, visit);
  } visit(sf);
  return (name, env = {}) => { assert.ok(named.has(name), name); return new Function(...Object.keys(env), ts.transpileModule(named.get(name), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText + `\nreturn ${name};`)(...Object.values(env)); };
}
const api = source('server/routes-oauth.ts'), client = source('client/src/pages/google-sheets-data.tsx'), report = source('server/report-scheduler.ts');
const summaryEnv = {};
for (const name of ['normalizeGoogleSheetsSummaryHeader', 'googleSheetsMetricTotal', 'getGoogleSheetsSummaryDisplayValue']) summaryEnv[name] = api(name, summaryEnv);
const pageEnv = { useCallback: fn => fn };
for (const name of ['GOOGLE_SHEETS_KPI_DATE_COLUMN_PATTERN', 'GOOGLE_SHEETS_KPI_CURRENCY_COLUMN_PATTERN', 'parseSheetMetricNumber', 'buildGoogleSheetsMetricOptions', 'getSummaryMetricDisplayValue']) pageEnv[name] = client(name, pageEnv);
const reportEnv = {};
for (const name of ['GOOGLE_SHEETS_REPORT_DATE_COLUMN_PATTERN', 'GOOGLE_SHEETS_REPORT_CURRENCY_PATTERN', 'parseGoogleSheetsReportNumber', 'normalizeGoogleSheetsReportKey', 'parseReportConfiguration', 'getGoogleSheetsReportSourceScope', 'isGoogleSheetsConfirmedFinancialMetric', 'googleSheetsConnectionMatchesSavedScope', 'buildGoogleSheetsCachedMetricSummary', 'formatGoogleSheetsReportValue']) reportEnv[name] = report(name, reportEnv);
(async () => {
  const results = [];
  const raw = { Spend: 190, Clicks: 110, CPC: 10 };
  const col = { name: 'CPC', index: 2, type: 'currency', total: 10, count: 2, ...summaryEnv.getGoogleSheetsSummaryDisplayValue({ name: 'CPC', total: 10, count: 2 }, raw) };
  const metricOptions = pageEnv.buildGoogleSheetsMetricOptions({ summary: { metrics: raw, detectedColumns: [col] } }, 'Fixture');
  assert.equal(col.summaryValue, 190 / 110); assert.equal(pageEnv.getSummaryMetricDisplayValue(col), 190 / 110); assert.equal(metricOptions[0].currentValue, 10);
  results.push({ case: 'Sheets Summary CPC1.72727 versus KPI/Benchmark option10 from the same response', summary: col, option: metricOptions[0], input: 'Rows: Spend100/Clicks100/CPC1 and Spend90/Clicks10/CPC9' });
  const ctr = summaryEnv.getGoogleSheetsSummaryDisplayValue({ name: 'CTR', total: 101, count: 2 }, { Impressions: 1010, Clicks: 20, CTR: 101 });
  assert.equal(ctr.summaryValue, 50.5);
  results.push({ case: 'Sheets Summary CTR averages1% and100% despite unequal impressions', actual: ctr, countDerivedPercent: 20 / 1010 * 100 });
  const aliasA = summaryEnv.getGoogleSheetsSummaryDisplayValue({ name: 'ROAS', total: 1, count: 1 }, { Budget: 1000, Spend: 100, Revenue: 200 });
  const aliasB = summaryEnv.getGoogleSheetsSummaryDisplayValue({ name: 'ROAS', total: 1, count: 1 }, { Spend: 100, Budget: 1000, Revenue: 200 });
  assert.equal(aliasA.summaryValue, .2); assert.equal(aliasB.summaryValue, 2);
  results.push({ case: 'Summary ROAS denominator chooses first matching Budget or Spend column', budgetFirst: aliasA, spendFirst: aliasB, boundary: 'Same labelled actual Spend100 and planned Budget1000; insertion/header order changes result' });
  const conn = { id: 'conn-a', spreadsheetId: 'sheet-a', sheetName: 'Data', isActive: true, purpose: 'general', lastDataRefreshAt: '2026-10-19', columnMappings: JSON.stringify([{ targetFieldId: 'campaign_name', sourceColumnIndex: 0, selectedValues: ['A'] }]), cachedData: { headers: ['Campaign Name', 'Date', 'Spend', 'Campaign ID'], rows: [['A', '2026-10-18', '10', '123'], ['B', '2020-01-01', '90', '456']] } };
  const scope = { platform: 'google_sheets', activeSpreadsheetId: 'sheet-a:conn-a', connectionId: 'conn-a', displayName: 'Data' };
  const cache = reportEnv.buildGoogleSheetsCachedMetricSummary([conn], scope);
  assert.equal(cache.metrics.get('spend').total, 100); assert.equal(cache.rowCount, 2); assert.equal(cache.metrics.get('campaign id').total, 579);
  results.push({ case: 'Scheduled cached summary ignores selected campaign values and sums identifiers', selectedCampaign: 'A', selectedCampaignSpend: 10, actualSpend: cache.metrics.get('spend').total, rows: cache.rowCount, identifierMetric: cache.metrics.get('campaign id') });
  const rejectedScope = reportEnv.buildGoogleSheetsCachedMetricSummary([conn], { platform: 'google_sheets', activeSpreadsheetId: 'other:other', connectionId: 'other' });
  assert.equal(rejectedScope.metrics.size, 0); results.push({ case: 'Control: scheduled summary rejects a different connection scope', metricCount: rejectedScope.metrics.size });
  const pdfTexts = []; const { jsPDF } = require('jspdf');
  function AuditPdf() { const doc = new jsPDF(); const text = doc.text.bind(doc); doc.text = (value, ...args) => { pdfTexts.push(value); return text(value, ...args); }; return doc; }
  const storage = { getGoogleSheetsConnections: async () => [conn], getRevenueTotalForRange: async () => ({ totalRevenue: 0 }), getSpendSources: async () => [], getSpendBreakdownBySource: async () => [] };
  const env = { ...reportEnv, storage, require: name => { assert.equal(name, 'jspdf'); return { jsPDF: AuditPdf }; }, coercePdfBufferFromDoc: doc => Buffer.from(doc.output('arraybuffer')) };
  env.buildGoogleSheetsConfirmedFinancialMetricSummary = report('buildGoogleSheetsConfirmedFinancialMetricSummary', env);
  const pdf = await report('buildGoogleSheetsScheduledPdfAttachment', env)({ report: { campaignId: 'fixture', name: 'Sheets selected A audit', reportType: 'overview', configuration: { sourceScope: scope } }, windowStart: '2026-10-01', windowEnd: '2026-10-19', campaignName: 'A' });
  assert.ok(pdf.length > 1000); assert.ok(pdfTexts.some(text => String(text).includes('Window: 2026-10-01 to 2026-10-19'))); assert.ok(pdfTexts.some(text => String(text).includes('Spend: $100.00')));
  fs.writeFileSync(out + 'sheets-selected-scope-fixture.pdf', pdf);
  results.push({ case: 'Actual scheduled PDF labels October2026 but prints100 including campaignB from2020', text: pdfTexts, bytes: pdf.length, boundary: 'Real jsPDF, actual builder and helpers; serialization shim only. No send or saved snapshot. Connection storage fixtures, not live Sheets.' });
  const browserTexts = [];
  function BrowserPdf() { const doc = new jsPDF(); const text = doc.text.bind(doc); doc.text = (value, ...args) => { browserTexts.push(value); return text(value, ...args); }; doc.save = filename => fs.writeFileSync(out + filename, Buffer.from(doc.output('arraybuffer'))); return doc; }
  await client('downloadGoogleSheetsReport', { require: name => { assert.equal(name, 'jspdf'); return { jsPDF: BrowserPdf }; }, parseSheetMetricNumber: pageEnv.parseSheetMetricNumber, parseGoogleSheetsReportConfiguration: x => x, customReportConfig: {}, getGoogleSheetsMetricOptionsForSavedScope: () => ({ scope, options: metricOptions }), reportForm: { name: 'sheets-cpc-browser-fixture' }, activeGoogleSheetsSourceScope: scope, sheetsData: { filteredRows: 2, totalRows: 2 } })({ reportType: 'overview', configuration: {} });
  assert.ok(browserTexts.includes('CPC')); assert.ok(browserTexts.includes('$10.00'));
  results.push({ case: 'Actual browser report function propagates summed CPC10 into PDF', text: browserTexts, boundary: 'Real jsPDF with save redirected to evidence file. Source-option resolver fixture supplies exact current options constructed above; no browser interaction.' });
  const zeroFinancial = await env.buildGoogleSheetsConfirmedFinancialMetricSummary('fixture'); assert.equal(zeroFinancial.size, 0);
  results.push({ case: 'Scheduled Sheets financial helper omits measured zero totals', metricCount: zeroFinancial.size, boundary: 'Zero Revenue returned, no Spend sources; does not prove all-zero configured-source behavior independently' });
  fs.writeFileSync(out + 'sheets-summary-report-reproductions.json', JSON.stringify({ head: '777aae6f6353e998d60b635d3e66b413093117c2', executedAt: new Date().toISOString(), boundary: 'Actual extracted server/client helpers and report builders, real jsPDF, fixture storage/source-option resolution. No provider, application database, message or runtime change. PDF visual review tracked separately.', results }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: results.length, passed: results.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
