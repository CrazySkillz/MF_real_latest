import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("GA4 Insights finding eligibility on daily-history failure", () => {
  it("withholds the insufficient-history finding until a daily response exists", () => {
    const content = readFileSync(join(process.cwd(), "client/src/pages/ga4-metrics.tsx"), "utf8");
    const source = ts.createSourceFile("ga4-metrics.tsx", content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let condition = "";
    const visit = (node: ts.Node) => {
      if (ts.isIfStatement(node) && node.thenStatement.getText(source).includes('id: "anomaly:not-enough-history"')) {
        condition = node.expression.getText(source);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(condition).toBeTruthy();
    const eligible = new Function("trendsRefreshIsStale", "ga4InsightsDailyResp", `return (${condition});`) as
      (stale: boolean, response: unknown) => boolean;

    expect(eligible(false, undefined)).toBe(false); // Initial failed or absent response.
    expect(eligible(true, { data: [] })).toBe(false); // Last-good response marked stale.
    expect(eligible(false, { data: [] })).toBe(true); // Genuine, sparse history.
    expect(eligible(false, { data: [{ sessions: 0 }] })).toBe(true); // Valid zero remains eligible.
  });
});
