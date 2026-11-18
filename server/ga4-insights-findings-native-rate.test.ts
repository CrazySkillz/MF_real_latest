import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { filterGA4InsightsBreakdownRowsToImportedDates, getGA4InsightsSessionConversionRate } from '../shared/ga4-insights';

const period = {startDate:'2026-11-12',endDate:'2026-11-18',complete:true};
const row = {startDate:period.startDate,endDate:period.endDate,sessionKeyEventRate:0.096,sessions:100,conversions:44};
describe('Insights findings require the saved native session rate for the exact window',()=>{
  it('uses the GA4 ratio once, independently of conversion event counts',()=>{
    expect(getGA4InsightsSessionConversionRate([row],period)).toBeCloseTo(9.6);
    expect(getGA4InsightsSessionConversionRate([{...row,conversions:999}],period)).toBeCloseTo(9.6);
    expect(getGA4InsightsSessionConversionRate([{...row,sessionKeyEventRate:0}],period)).toBe(0);
    expect(getGA4InsightsSessionConversionRate([{...row,sessionKeyEventRate:1}],period)).toBe(100);
  });
  it.each([undefined,null,'0.096',-0.1,1.1,NaN,Infinity])('withholds a missing or invalid native rate: %s',rate=>{
    expect(getGA4InsightsSessionConversionRate([{...row,sessionKeyEventRate:rate}],period)).toBeNull();
  });
  it('withholds missing, duplicate, wrong-window and incomplete periods',()=>{
    expect(getGA4InsightsSessionConversionRate([],period)).toBeNull();
    expect(getGA4InsightsSessionConversionRate([row,row],period)).toBeNull();
    expect(getGA4InsightsSessionConversionRate([{...row,startDate:'2026-11-11'}],period)).toBeNull();
    expect(getGA4InsightsSessionConversionRate([row],{...period,complete:false})).toBeNull();
    expect(getGA4InsightsSessionConversionRate([row],{...period,startDate:null})).toBeNull();
  });
  it('withholds unverified channel rates while preserving other scoped channel recommendations',()=>{
    const content=readFileSync('client/src/pages/ga4-metrics.tsx','utf8');
    const source=ts.createSourceFile('page.tsx',content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    let expression='';
    const visit=(node:ts.Node)=>{if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='channelAnalysis')expression=node.initializer!.getText(source);ts.forEachChild(node,visit);};
    visit(source);
    const evaluate=new Function('useMemo','activeTab','insightsChannelBreakdown','insightsChannelPlaceholder','ga4InsightsTimeSeries','insightsDataSummaryTotals','filterGA4InsightsBreakdownRowsToImportedDates',ts.transpileModule(`return ${expression};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText);
    const rows=[{date:'2026-11-12',source:'a',medium:'email',sessions:80,conversions:40,revenue:800},{date:'2026-11-12',source:'b',medium:'cpc',sessions:20,conversions:1,revenue:100},{date:'2026-11-11',source:'outside',medium:'cpc',sessions:900,revenue:9000}];
    const result=evaluate((f:any)=>f(),'insights',{rows},false,[{date:'2026-11-12'}],period,filterGA4InsightsBreakdownRowsToImportedDates);
    expect(result.lowestCRChannel).toBeNull(); // Event rates of 50% and 5% are not native session rates.
    expect(result.totalSessions).toBe(100);
    expect(result.totalConversions).toBe(41);
    expect(result.totalRevenue).toBe(900);
    expect(result.topSessionChannel.label).toBe('a / email');
    expect(result.topSessionShare).toBe(80);
    expect(result.channelCount).toBe(2);
  });
});
