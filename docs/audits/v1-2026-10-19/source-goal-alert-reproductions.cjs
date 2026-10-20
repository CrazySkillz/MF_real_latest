const fs = require('node:fs'), ts = require('typescript'), assert = require('node:assert/strict');
const out = 'docs/audits/v1-2026-10-19/';
function source(file) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS), named = new Map();
  function visit(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && !named.has(n.name.text)) named.set(n.name.text, `const ${n.getText(sf)};`);
    if (ts.isFunctionDeclaration(n) && n.name && !named.has(n.name.text)) named.set(n.name.text, n.getText(sf).replace(/^export /, ''));
    ts.forEachChild(n, visit);
  } visit(sf);
  return (name, env = {}) => { assert.ok(named.has(name), name); return new Function(...Object.keys(env), ts.transpileModule(named.get(name), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText + `\nreturn ${name};`)(...Object.values(env)); };
}
const campaign = source('server/utils/campaign-current-values.ts'), ga4 = source('server/utils/ga4-alert-current-value.ts'), decision = source('server/utils/alert-decision.ts'), evaluation = source('server/utils/alert-evaluation.ts');
let unexpectedSourceReads = 0;
const resolveCampaignCurrentValueForAlert = campaign('resolveCampaignCurrentValueForAlert', { isCampaignLevel: campaign('isCampaignLevel'), getCampaignMetricTotals: () => { unexpectedSourceReads++; throw Error('Unexpected campaign totals query'); } });
const resolveAlert = ga4('resolveAlertCurrentValueForDecision', { resolveCampaignCurrentValueForAlert, isGA4Platform: ga4('isGA4Platform') });
const evalEnv = {};
for (const name of ['parseAlertNumber', 'normalizeAlertCondition', 'evaluateAlertCondition', 'evaluateAlertThreshold']) evalEnv[name] = evaluation(name, evalEnv);
const breached = decision('isAlertDecisionBreached', evalEnv);
const custom = source('client/src/pages/custom-integration-analytics.tsx'), sheets = source('client/src/pages/google-sheets-data.tsx');
const customEnv = {};
for (const name of ['CUSTOM_INTEGRATION_METRIC_OPTIONS', 'parseCustomIntegrationMetricNumber', 'normalizeCustomIntegrationFinancialMetricKey', 'getCustomIntegrationMetricOption', 'getCustomIntegrationRawMetric', 'getCustomIntegrationSourceLabel', 'resolveCustomIntegrationMetric', 'parseCustomIntegrationSavedConfig', 'getSavedCustomIntegrationSourceScope']) customEnv[name] = custom(name, customEnv);
(async () => {
  const results = [];
  for (const platform of ['custom_integration', 'google_sheets']) {
    for (const goalKind of ['kpi', 'benchmark']) {
      for (const scenario of ['latest-lower', 'latest-higher', 'latest-zero', 'source-unavailable']) {
        const current = scenario === 'latest-higher' ? 100 : scenario === 'latest-zero' ? 0 : 10;
        const stored = scenario === 'latest-higher' ? 10 : 100;
        const row = { id: 'goal-a', campaignId: 'fixture-campaign', platformType: platform, metric: 'clicks', currentValue: String(stored), alertsEnabled: true, alertCondition: 'above', alertThreshold: '50', calculationConfig: JSON.stringify({ sourceScope: { platform, integrationId: 'integration-a', scopeType: 'latest_validated_import', displayName: 'Saved source' } }) };
        let ui;
        if (platform === 'custom_integration') {
          const resolveUi = custom('resolveCustomIntegrationCurrentValue', { ...customEnv, customIntegration: scenario === 'source-unavailable' ? null : { id: 'integration-a' }, resolveCustomIntegrationOverviewMetric: key => customEnv.resolveCustomIntegrationMetric({ clicks: current }, key) });
          ui = resolveUi(row);
        } else {
          const resolveUi = sheets(goalKind === 'kpi' ? 'resolveGoogleSheetsKpiMetric' : 'resolveGoogleSheetsBenchmarkMetric', { useCallback: fn => fn,
            getGoogleSheetsMetricOptionsForSavedScope: () => ({ scope: { displayName: 'Saved source' }, options: scenario === 'source-unavailable' ? [] : [{ key: 'clicks', available: true, currentValue: current }], reason: scenario === 'source-unavailable' ? 'Saved Google Sheets source could not be loaded' : '' }) });
          ui = resolveUi(row);
        }
        const server = await resolveAlert(row, new Map(), { useSavedOverview: true, requireCurrentTrafficFreshness: true });
        assert.equal(server, row); assert.equal(Number(server.currentValue), stored);
        assert.equal(ui.available, scenario !== 'source-unavailable');
        if (ui.available) assert.equal(ui.currentValue, current);
        const serverBreach = breached(server), currentBreach = ui.available ? breached({ ...row, currentValue: ui.currentValue }) : null;
        assert.equal(serverBreach, stored > 50);
        if (ui.available) assert.notEqual(serverBreach, currentBreach);
        results.push({ case: `${platform}/${goalKind}/${scenario}`, storedValue: stored, currentUiValue: ui.currentValue, currentUiAvailable: ui.available, serverDecisionValue: Number(server.currentValue), serverBreached: serverBreach, currentUiBreached: currentBreach, serverEligibilityBlocked: server.__alertDecisionEligible === false,
          boundary: platform === 'google_sheets' ? 'Actual page goal resolver with pre-resolved saved-source options fixture; upstream Sheets query/scope matching separately audited.' : 'Actual page source-identity guard and native metric resolver; current import and connection are fixtures.' });
      }
    }
  }
  const manual = { platformType: 'custom_integration', metric: 'custom', currentValue: '100', alertsEnabled: true, alertCondition: 'above', alertThreshold: '50' };
  const manualUi = custom('resolveCustomIntegrationCurrentValue', customEnv)(manual);
  assert.equal(manualUi.currentValue, 100); assert.equal(breached(await resolveAlert(manual)), true);
  results.push({ case: 'Manual custom-value control intentionally uses persisted100', currentUiValue: manualUi.currentValue, serverBreached: true });
  const disabled = { ...manual, alertsEnabled: false }; assert.equal(breached(await resolveAlert(disabled)), false);
  results.push({ case: 'Alerts-disabled control does not breach', serverBreached: false });
  assert.equal(unexpectedSourceReads, 0);
  fs.writeFileSync(out + 'source-goal-alert-reproductions.json', JSON.stringify({ head: '777aae6f6353e998d60b635d3e66b413093117c2', executedAt: new Date().toISOString(), boundary: 'Actual current page resolvers, server campaign/GA4 decision functions and threshold evaluator. Fixture current source/storage values; no database mutation, scheduler execution, notification insertion or email. No claim that a real recipient received an incorrect message.', unexpectedSourceReads, results }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: results.length, passed: results.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
