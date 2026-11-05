import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const overview = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
const pdf = readFileSync("server/ga4-scheduled-report-pdf.ts", "utf8");
function section(source: string, start: string, end: string) {
  const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error("Overview performance section missing");
  return source.slice(from, to);
}
function roasExpression(text: string, card = false) {
  const source = ts.createSourceFile("display.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression: string | undefined;
  function visit(node: ts.Node) {
    if (card && ts.isConditionalExpression(node) && node.condition.getText(source) === "overviewFinancialSpend > 0"
      && node.whenTrue.getText(source).includes("overviewFinancialROAS")) expression = node.getText(source);
    if (!card && ts.isArrayLiteralExpression(node) && ts.isStringLiteral(node.elements[0])
      && node.elements[0].text === "ROAS") expression = node.elements[1].getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!expression) throw new Error("Actual Overview ROAS expression missing");
  return expression;
}
const displays = [
  ["card", roasExpression(overview, true)],
  ["browser PDF", roasExpression(section(overview, "if (includeOverviewPerformance)", "if (includeOverviewCampaignBreakdown)"))],
  ["scheduled PDF", roasExpression(section(pdf, "if (includePerformance)", "if (includeCampaignBreakdown)"))],
] as const;
function render(expression: string, revenue: number, spend: number, available = true) {
  const ratio = spend > 0 ? revenue / spend : 0;
  const values = { overviewFinancialROAS: ratio, overviewFinancialSpend: spend,
    financialROAS: ratio, financialSpendAvailable: available, spend,
    payload: { financialROAS: ratio, financialSpend: spend } };
  return new Function(...Object.keys(values), `return (${expression});`)(...Object.values(values));
}

describe.each(displays)("GA4 Overview ROAS rounding: %s", (_name, expression) => {
  it.each([
    [25882.50, 100, "258.83x"],
    [25882.49, 100, "258.82x"],
    [25882.51, 100, "258.83x"],
    [1.005, 1, "1.01x"],
    [2.675, 1, "2.68x"],
    [-1.005, 1, "-1.01x"],
    [1234.565, 1, "1234.57x"],
    [258.8249999999, 1, "258.82x"],
    [0, 100, "0.00x"],
    [200, 100, "2.00x"],
  ])("formats revenue %s / spend %s as %s", (revenue, spend, expected) => {
    expect(render(expression, Number(revenue), Number(spend))).toBe(expected);
  });
  it.each([0, -100])("retains the unavailable denominator state for spend %s", spend => {
    expect(render(expression, 25882.50, spend)).toBe("—");
  });
});

it("retains the browser PDF's missing spend state", () => {
  expect(render(displays[1][1], 25882.50, 100, false)).toBe("Unavailable");
});
