// @ts-nocheck
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import fs from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";
import { describe, expect, it, vi } from "vitest";
function loadFunctions(file: string, names: string[], dependencies: any, declarations: string[] = []) {
  const ast = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  const extracted = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) extracted.set(node.name.text, node.getText(ast).replace(/^export /, ""));
    if (ts.isVariableDeclaration(node) && [...names, ...declarations].includes(node.name.getText(ast))) extracted.set(node.name.getText(ast), `const ${node.getText(ast)};`);
    ts.forEachChild(node, visit);
  }; visit(ast);
  for (const name of [...names, ...declarations]) if (!extracted.has(name)) throw new Error(`Missing actual implementation: ${name}`);
  const code = ts.transpileModule([...extracted.values(), `return { ${names.join(",")} };`].join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const { require: moduleLoader, ...bindings } = dependencies;
  return new Function("require", ...Object.keys(bindings), code)(moduleLoader || createRequire(import.meta.url), ...Object.values(bindings));
}
function page(file) {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const vars = new Map(), funcs = new Map(), queries = new Map();
  function visit(n) {
    if (ts.isVariableDeclaration(n) && n.initializer) {
      if (ts.isIdentifier(n.name) && !vars.has(n.name.text)) vars.set(n.name.text, n.initializer.getText(sf));
      if (ts.isObjectBindingPattern(n.name) && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(sf) === 'useQuery') {
        const data = n.name.elements.find(e => e.propertyName?.getText(sf) === 'data');
        const fn = n.initializer.arguments[0]?.properties?.find(p => p.name?.getText(sf) === 'queryFn');
        if (data && fn) queries.set(data.name.getText(sf), fn.initializer.getText(sf));
      }
    }
    if (ts.isFunctionDeclaration(n) && n.name) funcs.set(n.name.text, n.getText(sf));
    ts.forEachChild(n, visit);
  } visit(sf);
  function evalCode(code, env) { return new Function(...Object.keys(env), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText)(...Object.values(env)); }
  return { vars, value: (name, env = {}) => { assert.ok(vars.has(name), name); return evalCode(`return (${vars.get(name)});`, env); }, fn: (name, env = {}) => { assert.ok(funcs.has(name), name); return evalCode(`${funcs.get(name)}\nreturn ${name};`, env); }, query: (name, response, extra = {}) => { assert.ok(queries.has(name), name); return evalCode(`return (${queries.get(name)})();`, { ...extra, campaignId: 'fixture', fetch: async () => response }); } };
}

const custom = page('client/src/pages/custom-integration-analytics.tsx');
const validation = {validationVersion:2,confidence:100,extractedFields:1,requiresReview:false,warnings:[],currency:"EUR"};
function values(revenue, spend, overrides = {}) {
 const env = { metricsData:{spend:100,parserMetadata:validation}, customIntegrationRevenueSourcesData:{success:true,sources:[{id:"r",isActive:true}]},customIntegrationRevenueTotalsData:revenue,customIntegrationSpendTotalsData:spend,
 metricsError:null,rawMetricsData:null,customIntegrationRevenueSourcesError:false,customIntegrationRevenueTotalsError:false,customIntegrationSpendTotalsError:false,
 parseCustomIntegrationMetricNumber:custom.fn('parseCustomIntegrationMetricNumber'),campaign:{currency:"EUR"},...overrides };
 for(const name of ['activeCustomIntegrationRevenueSources','customIntegrationImportedRevenue','customIntegrationImportedSpend','customIntegrationExternalRevenue','customIntegrationTotalRevenue','customIntegrationRevenueReadSuccessful','hasCustomIntegrationConfirmedRevenue','customIntegrationExternalSpend','customIntegrationTotalSpend','customIntegrationSpendSourceIds','activeCustomIntegrationSpendSources','customIntegrationSpendReadSuccessful','hasCustomIntegrationConfirmedSpend','hasCustomIntegrationDerivedFinancials','customIntegrationRoas','customIntegrationRoi']) env[name]=custom.value(name,env);
 return env;
}
const goodSpend = {success:true,totalSpend:0,sourceIds:[],sources:[]};
function reports(overrides = {}) {
 const storage={getRevenueSources:async()=>[{id:"r",isActive:true}],getRevenueTotalForRange:async()=>({totalRevenue:0}),getSpendSources:async()=>[],getSpendBreakdownBySource:async()=>[],getCustomIntegration:async()=>({id:"connection"}),getLatestCustomIntegrationMetrics:async()=>({spend:"100",clicks:0,parserMetadata:validation}),getPlatformKPIs:async()=>[],getPlatformBenchmarks:async()=>[],...overrides};
 return loadFunctions("./report-scheduler.ts", ["buildCustomIntegrationFinancialReportMetrics","parseCustomIntegrationMetricNumber","buildCustomIntegrationScheduledPdfAttachment","resolveCustomIntegrationReportMetric","normalizeCustomIntegrationFinancialReportMetricKey","isCustomIntegrationFinancialReportMetric","formatCustomIntegrationReportMetric","getCustomIntegrationSourceLabel"], {storage,
 getCustomIntegrationReportSourceScope:configuration=>configuration.sourceScope,
 parseReportConfiguration:value=>value,
 coercePdfBufferFromDoc:doc=>Buffer.from(doc.output("arraybuffer")),formatNumberLike:value=>Number(value).toFixed(2),customIntegrationSourceScopeMatchesReport:()=>true},["CUSTOM_INTEGRATION_REPORT_METRICS"]);
}
const report={campaignId:"a",name:"Fixture",reportType:"overview",configuration:{sourceScope:{platform:"custom_integration",integrationId:"connection",scopeType:"latest_validated_import"}}};
describe("Batch 4 Custom financial failure and publication propagation",()=>{
 it.each([{ok:false},{ok:true,json:async()=>{throw Error("malformed");}},{ok:true,json:async()=>({success:true,totalRevenue:"100junk"})},{ok:true,json:async()=>({success:true,totalRevenue:null})},{ok:true,json:async()=>({success:true,totalRevenue:true})}])("keeps failed or malformed revenue unavailable",async response=>{
  const total=await custom.query('customIntegrationRevenueTotalsData',response);
  const v=values(total,goodSpend);expect(v.hasCustomIntegrationConfirmedRevenue).toBe(false);expect(v.customIntegrationRoi).toBeNull();expect(v.customIntegrationRoas).toBeNull();
 });
 it("keeps partial spend unavailable despite an imported amount",async()=>{
  const total=await custom.query('customIntegrationSpendTotalsData',{ok:false});
  const v=values({success:true,totalRevenue:200},total);expect(v.hasCustomIntegrationConfirmedSpend).toBe(false);expect(v.customIntegrationRoas).toBeNull();
 });
 it.each(['customIntegrationRevenueSourcesError','customIntegrationRevenueTotalsError','customIntegrationSpendTotalsError'])("invalidates stale success when %s is set",key=>{
  expect(values({success:true,totalRevenue:200},goodSpend,{[key]:true}).customIntegrationRoas).toBeNull();
 });
 it("preserves measured zero, loss, positive ratios and zero denominator semantics",()=>{
  expect(values({success:true,totalRevenue:0},goodSpend).customIntegrationRoi).toBe(-100);
  expect(values({success:true,totalRevenue:200},goodSpend).customIntegrationRoas).toBe(2);
  expect(values({success:true,totalRevenue:200},goodSpend,{metricsData:{spend:0}}).customIntegrationRoi).toBeNull();
 });
 it.each(['getRevenueSources','getRevenueTotalForRange','getSpendSources','getSpendBreakdownBySource'])("does not fabricate report ratios after %s fails",async name=>{
  const f=reports({[name]:async()=>{throw Error('fixture failure');}});
  const result=await f.buildCustomIntegrationFinancialReportMetrics('a',{spend:100});expect(result.get('overview.roi').available).toBe(false);expect(result.get('overview.roas').value).toBeNull();
 });
 it("keeps genuine report zero revenue and correct EUR formatting",async()=>{
  const f=reports();const result=await f.buildCustomIntegrationFinancialReportMetrics('a',{spend:100});expect(result.get('overview.roi').value).toBe(-100);
  expect(f.formatCustomIntegrationReportMetric(100,'$','currency','EUR')).toBe('EUR 100.00');
  expect(custom.fn('formatCustomIntegrationMetricValue')(100,'$','currency','EUR')).toBe('\u20ac100.00');
 });
 it.each([null,{...validation,requiresReview:true},{...validation,validationVersion:1}])("refuses scheduled PDFs from unvalidated data %j",async parserMetadata=>{
  const f=reports({getLatestCustomIntegrationMetrics:async()=>({spend:100,parserMetadata})});
  expect(await f.buildCustomIntegrationScheduledPdfAttachment({report,windowStart:'2026-10-01',windowEnd:'2026-10-07',campaignName:'Fixture'})).toBeNull();
 });
 it("generates a real PDF with truthful latest-import scope and unavailable financials after a failed total read",async()=>{
  const f=reports({getRevenueTotalForRange:async()=>{throw Error('fixture');}});
  const pdf=await f.buildCustomIntegrationScheduledPdfAttachment({report,windowStart:'2026-10-01',windowEnd:'2026-10-07',campaignName:'Fixture'});
  const text=pdf.toString('latin1');expect(text.startsWith('%PDF')).toBe(true);expect(text).toContain('Delivery schedule window');expect(text).toContain('source report period unspecified');expect(text).toContain('Unavailable');expect(text).not.toContain('ROI: -100');
 });
});
