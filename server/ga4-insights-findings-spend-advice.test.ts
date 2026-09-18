import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("GA4 Insights findings financial checks", () => {
  it("flags verified zero values without presenting a generic revenue summary as advice", () => {
    const content = readFileSync(join(process.cwd(), "client/src/pages/ga4-metrics.tsx"), "utf8");
    const source = ts.createSourceFile("ga4-metrics.tsx", content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const conditions = new Map<string, string>();
    const visit = (node: ts.Node) => {
      if (ts.isIfStatement(node)) {
        for (const id of ["financial:spend_no_revenue", "financial:revenue_no_spend"]) {
          if (node.thenStatement.getText(source).includes(`id: "${id}"`)) conditions.set(id, node.expression.getText(source));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(conditions.size).toBe(2);
    expect(content).not.toContain('id: "info:revenue_summary"');
    const eligible = new Function("spendKpiInputState", "revenueKpiInputState", "spendMetricAvailable", "revenueMetricAvailable", "financialSpend", "financialRevenue",
      `return { noRevenue: ${conditions.get("financial:spend_no_revenue")}, noSpend: ${conditions.get("financial:revenue_no_spend")} };`) as
      (spendState: string, revenueState: string, spendAvailable: boolean, revenueAvailable: boolean, spend: number, revenue: number) =>
        { noRevenue: boolean; noSpend: boolean };
    expect(eligible("ready", "ready", true, true, 100, 0)).toEqual({ noRevenue: true, noSpend: false });
    expect(eligible("ready", "ready", true, true, 0, 100)).toEqual({ noRevenue: false, noSpend: true });
    expect(eligible("ready", "ready", true, true, 100, 100)).toEqual({ noRevenue: false, noSpend: false });
    expect(eligible("stale", "ready", true, true, 100, 0)).toEqual({ noRevenue: false, noSpend: false });
    expect(eligible("ready", "ready", false, true, 0, 100)).toEqual({ noRevenue: false, noSpend: false });
  });
});
