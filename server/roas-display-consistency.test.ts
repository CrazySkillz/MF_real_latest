import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { formatRoasRatio } from "../shared/metric-math";

describe("ROAS decimal display contract", () => {
  it.each([[285.015,"285.02"],[258.825,"258.83"],[258.8249999999,"258.82"],[1.005,"1.01"],[-1.005,"-1.01"],[0,"0.00"]] as const)("formats %s without changing source precision", (value, expected) => {
    expect(formatRoasRatio(value)).toBe(expected);
  });
  it.each([
    ["client/src/pages/ga4-metrics.tsx", "overviewFinancialROAS"],
    ["client/src/pages/ga4-metrics.tsx", "financialROAS"],
    ["server/ga4-scheduled-report-pdf.ts", "Number(payload.financialROAS || 0)"],
    ["client/src/pages/trend-analysis.tsx", "authoritativeHeadlineCurrent.roas"],
    ["client/src/pages/financial-analysis.tsx", "financialRoasMetric.value"],
    ["client/src/pages/executive-summary.tsx", "value"],
    ["server/report-scheduler.ts", 'metricNumber("roas")'],
  ])("executes the real rounded display in %s for %s", (path, expression) => {
    const file=ts.createSourceFile(path,readFileSync(path,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const calls:string[]=[];
    const visit=(node:ts.Node)=>{
      if(ts.isCallExpression(node)&&node.expression.getText(file)==="formatRoasRatio"&&node.arguments[0]?.getText(file)===expression)calls.push(node.getText(file));
      ts.forEachChild(node,visit);
    };visit(file);
    expect(calls.length).toBeGreaterThan(0);
    for(const call of calls)expect(new Function("formatRoasRatio","overviewFinancialROAS","financialROAS","payload","authoritativeHeadlineCurrent","financialRoasMetric","value","metricNumber",`return ${call}`)(
      formatRoasRatio,285.015,285.015,{financialROAS:285.015},{roas:285.015},{value:285.015},285.015,()=>285.015)).toBe("285.02");
  });
});
