const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const out = 'docs/audits/v1-2026-10-19/';
function moduleFrom(file, mocks) { const exports = {}; new Function('exports', 'require', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(exports, name => Object.hasOwn(mocks, name) ? mocks[name] : require(name)); return exports; }
const csv = moduleFrom('server/utils/csv.ts', { './data-transformation': { normalizeStrictUtcDateKey() { throw Error('Unexpected date conversion'); } } });
const parser = moduleFrom('server/services/custom-integration-file-parser.ts', { '../utils/csv': csv, './pdf-parser': { parsePDFMetrics() { throw Error('Unexpected PDF input'); } } });
function source(file) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS); const names = new Map();
  function visit(n) { if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && !names.has(n.name.text)) names.set(n.name.text, `const ${n.getText(sf)};`); if (ts.isFunctionDeclaration(n) && n.name && !names.has(n.name.text)) names.set(n.name.text, n.getText(sf).replace(/^export /, '')); ts.forEachChild(n, visit); } visit(sf);
  return (name, env = {}) => { assert.ok(names.has(name), name); return new Function(...Object.keys(env), ts.transpileModule(names.get(name), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText + `\nreturn ${name};`)(...Object.values(env)); };
}
const definitions = source('server/services/custom-integration-file-parser.ts')('METRIC_DEFINITIONS');
const normalize = source('server/routes-oauth.ts')('normalizeCustomIntegrationMetrics');
const client = source('client/src/pages/custom-integration-analytics.tsx'), report = source('server/report-scheduler.ts');
const clientEnv = {}, reportEnv = {};
for (const name of ['CUSTOM_INTEGRATION_METRIC_OPTIONS', 'parseCustomIntegrationMetricNumber', 'normalizeCustomIntegrationFinancialMetricKey', 'getCustomIntegrationMetricOption', 'getCustomIntegrationRawMetric', 'getCustomIntegrationSourceLabel', 'resolveCustomIntegrationMetric', 'formatCustomIntegrationMetricValue']) clientEnv[name] = client(name, clientEnv);
for (const name of ['CUSTOM_INTEGRATION_REPORT_METRICS', 'parseCustomIntegrationMetricNumber', 'normalizeCustomIntegrationFinancialReportMetricKey', 'isCustomIntegrationFinancialReportMetric', 'resolveCustomIntegrationReportMetric']) reportEnv[name] = report(name, reportEnv);
async function parse(rows) { return parser.parseCustomIntegrationFile(Buffer.from(rows.map(row => row.join(',')).join('\n')), 'fixture.csv'); }
(async () => {
  const results = [], headers = definitions.map(d => d.labels[0]);
  assert.equal(definitions.length, 28);
  const values = definitions.map(d => d.kind === 'duration' ? '00:02:38' : d.kind === 'single' ? '12.5' : '100');
  const parsed = await parse([headers, values]), normalized = normalize(parsed);
  const inventory = definitions.map((definition, index) => {
    assert.ok(Object.hasOwn(parsed, definition.key), definition.key); assert.ok(Object.hasOwn(normalized, definition.key), definition.key);
    const ui = clientEnv.resolveCustomIntegrationMetric(normalized, definition.key), scheduled = reportEnv.resolveCustomIntegrationReportMetric(normalized, definition.key);
    assert.equal(ui.available, scheduled.available, definition.key);
    if (ui.available) assert.equal(ui.currentValue, scheduled.value, definition.key);
    return { field: definition.key, parserKind: definition.kind, input: values[index], parsed: parsed[definition.key], normalized: normalized[definition.key], currentOptionSupported: ui.available, label: ui.option?.label ?? null, unit: ui.unit, displayed: ui.available ? clientEnv.formatCustomIntegrationMetricValue(ui.currentValue, ui.unit, ui.option?.type) : null, scheduledValue: scheduled.value, aliases: definition.labels };
  });
  results.push({ case: 'All28 canonical CSV fields pass through actual normalization and client/server option resolution', fields: inventory.length, supportedOptions: inventory.filter(i => i.currentOptionSupported).length, boundary: 'No database insert; normalized DTO and resolver parity only. Current financial source overlay tested separately.' });
  const zeros = normalize(await parse([headers, definitions.map(d => d.kind === 'duration' ? '00:00:00' : '0')]));
  for (const d of definitions) { assert.notEqual(zeros[d.key], null); if (d.kind !== 'duration') assert.equal(Number(zeros[d.key]), 0); }
  results.push({ case: 'All28 explicit zero inputs remain present through normalization', values: zeros });
  const missing = normalize(await parse([['Unrecognized'], ['text']]));
  for (const d of definitions) assert.equal(missing[d.key], null);
  results.push({ case: 'All28 absent inputs normalize to null rather than schema defaults', values: missing, boundary: 'Current normalized DTO contains explicit nulls; this is not an isolated PostgreSQL precision/default test' });
  const unsupported = inventory.filter(i => !i.currentOptionSupported).map(i => i.field);
  assert.deepEqual(unsupported, ['reach', 'engagements', 'videoViews', 'viralImpressions', 'avgSessionDuration', 'hardBounces', 'spamComplaints']);
  results.push({ case: 'Seven parsed/persisted fields are not offered in current metric option catalogs', fields: unsupported, boundary: 'Not a finding by itself. Current option-based Overview/Summary/KPI/Benchmark/report coverage differs from parser/schema; raw API still returns fields.' });
  const aliases = await parse([['emails sent', 'opens', 'exit rate', 'new subscribers'], ['1000', '50', '20', '30']]);
  assert.equal(aliases.emailsDelivered, 1000); assert.equal(aliases.openRate, 50); assert.equal(aliases.bounceRate, 20); assert.equal(aliases.listGrowth, 30); assert.equal(aliases._requiresReview, false); assert.equal(aliases._confidence, 100);
  const opened = clientEnv.resolveCustomIntegrationMetric(normalize(aliases), 'openRate'); assert.equal(clientEnv.formatCustomIntegrationMetricValue(opened.currentValue, opened.unit, opened.option.type), '50.00%');
  results.push({ case: 'Different source meanings are silently relabelled delivered/open-rate/bounce-rate/net-growth', input: { emailsSent: 1000, opensCount: 50, exitRate: 20, newSubscribers: 30 }, actual: aliases, displayedOpenRate: '50.00%', boundary: 'Header aliases do not establish delivery, rate denominator, bounce definition or net subscriber delta. No provider-specific definition is assumed equivalent.' });
  const zeroUi = clientEnv.resolveCustomIntegrationMetric(zeros, 'openRate'), missingUi = clientEnv.resolveCustomIntegrationMetric(missing, 'openRate');
  assert.equal(zeroUi.available, true); assert.equal(zeroUi.currentValue, 0); assert.equal(missingUi.available, false);
  results.push({ case: 'Control: native metric resolver distinguishes measured0 from absent value', zero: zeroUi, missing: missingUi });
  const reportStorage = { getRevenueSources: async () => [{ id: 'revenue-a', isActive: true }], getRevenueTotalForRange: async () => { throw Error('AUDIT revenue unavailable'); }, getSpendSources: async () => [], getSpendBreakdownBySource: async () => [] };
  const financial = await report('buildCustomIntegrationFinancialReportMetrics', { ...reportEnv, storage: reportStorage })('fixture', { spend: 100 });
  assert.equal(financial.get('overview.total_revenue').available, true); assert.equal(financial.get('overview.total_revenue').value, 0); assert.equal(financial.get('overview.roi').value, -100);
  results.push({ case: 'Actual scheduled Custom financial helper repeats failed Revenue0/Spend100/ROI−100', metrics: [...financial.entries()], boundary: 'Actual report value builder only; no generated/sent PDF in this case' });
  fs.writeFileSync(out + 'custom-value-inventory.json', JSON.stringify({ head: '777aae6f6353e998d60b635d3e66b413093117c2', inventory, boundary: 'All28 parser fields mapped individually through canonical CSV parse, normalized DTO, current option resolver/formatter and scheduled resolver. PDF/XLSX/provider/database/lifecycle acceptance not inherited.' }, null, 2) + '\n');
  fs.writeFileSync(out + 'custom-value-inventory-reproductions.json', JSON.stringify({ head: '777aae6f6353e998d60b635d3e66b413093117c2', executedAt: new Date().toISOString(), boundary: 'Actual CSV/parser/normalization/client/server functions; all28-field state checks grouped by scenario. No real import, database, provider, message or runtime change.', results }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: results.length, passed: results.length, fields: inventory.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
