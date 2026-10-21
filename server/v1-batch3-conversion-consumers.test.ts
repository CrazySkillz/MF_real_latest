import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { formatConversionCredit, formatPct } from "../shared/metric-math";
import { formatExactTrendCount } from "../client/src/lib/trend-analysis-cumulative";

// Execute the existing formatter bodies with their actual shared dependencies.
// No application, provider, browser navigation or database is started here.
function formatter(file: string, name: string) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let body = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) body = `return ${node.initializer!.getText(source)}`;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) body = `${node.getText(source)}; return ${name};`;
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === name) body = `return function(${node.parameters.map(p => p.getText(source)).join(",")}) ${node.body!.getText(source)}`;
    ts.forEachChild(node, visit);
  }
  visit(source); if (!body) throw new Error(`Missing ${file}:${name}`);
  const bindings = { formatConversionCredit, formatPct, parseAlertNumber: Number, parseNumSafe: Number,
    stripNumberFormatting: (value: string) => value.replace(/,/g, ""), SELECT_UNIT: "select",
    isIsoCurrencyCode: (value: string) => /^[A-Z]{3}$/.test(value), formatNumber: (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 }) };
  return new Function(...Object.keys(bindings), ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(bindings));
}

describe("V1-079 downstream conversion displays", () => {
  it.each([
    ["client/src/pages/ga4-metrics.tsx", "formatValue"],
    ["client/src/pages/ga4-metrics.tsx", "formatBenchmarkValue"],
    ["client/src/pages/kpis.tsx", "formatValue"],
    ["client/src/pages/campaign-detail.tsx", "formatValueWithUnit"],
    ["client/src/pages/campaign-detail.tsx", "formatBenchmarkDisplayValue"],
    ["server/kpi-notifications.ts", "formatAlertDisplayValue"],
    ["server/benchmark-notifications.ts", "formatAlertDisplayValue"],
    ["server/services/email-service.ts", "formatAlertDisplayValue"],
    ["server/report-scheduler.ts", "formatWithUnit"],
  ])("preserves fractional count in %s:%s", (file, name) => {
    const format = formatter(file, name);
    const suffix = name === "formatWithUnit" ? "count" : "";
    for (const value of [0, 0.75, 0.000075, 2]) expect(format(name === "formatValueWithUnit" ? value : String(value), "count")).toBe(String(value) + suffix);
    expect(format(name === "formatValueWithUnit" ? 2977 : "2977", "count")).toBe(name === "formatWithUnit" ? "2977count" : "2,977");
  });

  it("keeps observed form values precise while retaining whole-number goal normalization", () => {
    for (const [file, name] of [["client/src/pages/ga4-metrics.tsx", "formatNumberByUnit"], ["client/src/pages/campaign-detail.tsx", "formatBenchmarkFormValue"]]) {
      const format = formatter(file, name);
      expect(format("0.000075", "count", true)).toBe("0.000075");
      expect(format("2.75", "count")).toBe("3");
      expect(format("2977", "count")).toBe("2,977");
    }
    expect(formatExactTrendCount(0.000075)).toBe("0.000075");
  });

  it.each([["client/src/pages/reports.tsx", "formatCustomReportMetricValue"], ["server/report-scheduler.ts", "formatCampaignDeepDiveMetricValue"]])("preserves diagnostic report values in %s", (file, name) => {
    const format = formatter(file, name);
    expect(format("conversions", 0.000075)).toBe("0.000075");
    expect(format("sessions", 2977)).toBe("2,977");
    expect(format("cpa", 26.666666)).toBe("$26.67");
  });
});
