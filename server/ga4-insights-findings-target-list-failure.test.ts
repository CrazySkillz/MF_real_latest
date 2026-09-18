import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("GA4 Insights target-list failure finding", () => {
  it("discloses failed or unverified empty lists once without changing verified or cached-row paths", () => {
    const content = readFileSync(join(process.cwd(), "client/src/pages/ga4-metrics.tsx"), "utf8");
    const source = ts.createSourceFile("ga4-metrics.tsx", content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let listInitializer = "";
    let findingBlock = "";
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === "unverifiedTargetLists") {
        listInitializer = node.initializer?.getText(source) || "";
      }
      if (ts.isIfStatement(node) && node.expression.getText(source) === "unverifiedTargetLists.length > 0") {
        findingBlock = node.getText(source);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(listInitializer && findingBlock).toBeTruthy();
    const findings = new Function("kpiListState", "benchmarkListState", "platformKPIs", "benchmarks",
      `const unverifiedTargetLists = ${listInitializer}; const out = []; ${findingBlock} return out;`) as
      (kpiState: string, benchmarkState: string, kpis: unknown[], benchmarks: unknown[]) =>
        Array<{ id: string; severity: string; title: string; description: string }>;

    expect(findings("ready", "ready", [], [])).toEqual([]);
    expect(findings("loading", "ready", [], [])).toEqual([]);
    expect(findings("stale", "ready", [{ id: "cached" }], [])).toEqual([]);
    expect(findings("failed", "ready", [], [{ id: "verified" }])).toMatchObject([
      { id: "integrity:target_lists_unverified", severity: "high", title: "KPI list could not be verified" },
    ]);
    expect(findings("ready", "stale", [], [])).toMatchObject([
      { id: "integrity:target_lists_unverified", title: "Benchmark list could not be verified" },
    ]);
    const bothFailed = findings("failed", "failed", [], []);
    expect(bothFailed).toHaveLength(1);
    expect(bothFailed[0]).toMatchObject({
      id: "integrity:target_lists_unverified",
      title: "KPI and Benchmark lists could not be verified",
    });
    expect(bothFailed[0].description).toContain("Saved targets may exist");
    expect(content).toContain('if (id === "integrity:target_lists_unverified") return "Campaign-scoped KPI/Benchmark list requests";');
  });
});
