import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("GA4 Insights revenue finding spend advice", () => {
  it("uses ROAS only with verified positive spend and suggests adding spend only when no source exists", () => {
    const content = readFileSync(join(process.cwd(), "client/src/pages/ga4-metrics.tsx"), "utf8");
    const source = ts.createSourceFile("ga4-metrics.tsx", content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let spendCheck = "";
    let description = "";
    let recommendation = "";
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === "verifiedPositiveSpend") {
        spendCheck = node.initializer?.getText(source) || "";
      }
      if (ts.isObjectLiteralExpression(node) && node.properties.some((property) =>
        ts.isPropertyAssignment(property) && property.name.getText(source) === "id" &&
        property.initializer.getText(source) === '"info:revenue_summary"')) {
        for (const property of node.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          if (property.name.getText(source) === "description") description = property.initializer.getText(source);
          if (property.name.getText(source) === "recommendation") recommendation = property.initializer.getText(source);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(spendCheck && description && recommendation).toBeTruthy();
    const finding = new Function("spendKpiInputState", "spendMetricAvailable", "financialSpend", "financialROAS",
      `const verifiedPositiveSpend = ${spendCheck}; return { description: ${description}, recommendation: ${recommendation} };`) as
      (state: string, configured: boolean, spend: number, roas: number) => { description: string; recommendation?: string };

    expect(finding("unavailable", true, 0, 0).recommendation).toBeUndefined();
    expect(finding("stale", true, 100, 0.7)).toEqual({
      description: "Revenue-to-date uses GA4 native revenue plus imported revenue sources.",
      recommendation: undefined,
    });
    expect(finding("ready", true, 0, 0).recommendation).toBeUndefined();
    expect(finding("ready", false, 0, 0).recommendation).toBe("Add spend data to calculate ROAS and ROI.");
    expect(finding("ready", true, 100, 0.7)).toEqual({
      description: "Revenue-to-date uses GA4 native revenue plus imported revenue sources. ROAS: 0.70x.",
      recommendation: "Review spend allocation and conversion paths before acting on ROAS.",
    });
  });
});
