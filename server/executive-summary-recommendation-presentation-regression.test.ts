import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const page = readFileSync(join(process.cwd(), "client", "src", "pages", "executive-summary.tsx"), "utf-8");

describe("Executive Summary recommendation presentation", () => {
  it("deduplicates and orders target evidence before rendering it", () => {
    expect(page).toContain("targetComparisons.splice(0, targetComparisons.length, ...Array.from(new Set(targetComparisons)).sort");
    expect(page).toContain("const orderedExceptionMetricLabels = Array.from(new Set(exceptionMetricLabels)).sort");
    expect(page).toContain('Target check: ${targetComparisons.join("; ")}.');
    expect(page).toContain("const nextActionText = targetComparisons.length === 0");
    expect(page).toContain('Next action: investigate ${formatMetricLabelList(orderedExceptionMetricLabels)}, then inspect the relevant measurement and reporting inputs.');
    expect(page).not.toContain("investigate the below-target outcome metrics");
  });

  it("names only the eligible website outcome exceptions in the action", () => {
    expect(page).toContain("const websiteOutcomeExceptionMetricKeys = Array.from(new Set([...executiveKpiExceptions, ...executiveBenchmarkExceptions]");
    expect(page).toContain(".filter((metric) => Object.prototype.hasOwnProperty.call(websiteOutcomeMetricLabels, metric))");
    expect(page).toContain(".sort((left, right) => websiteOutcomeMetricLabels[left].localeCompare(websiteOutcomeMetricLabels[right]));");
    expect(page).toContain('action: `Investigate ${formatMetricLabelList(websiteOutcomeExceptionMetricKeys.map((metric) => websiteOutcomeMetricLabels[metric]))}`');
  });

  it("deduplicates and orders freshness warnings used by Recommended Actions", () => {
    expect(page).toContain("const orderedFreshnessWarnings = Array.from(new Map(riskFreshnessWarnings.map");
    expect(page).toContain('Number(right?.severity === "high") - Number(left?.severity === "high")');
    expect(page).toContain("riskFreshnessWarnings.splice(0, riskFreshnessWarnings.length, ...orderedFreshnessWarnings);");
    expect(page).toContain("{riskFreshnessWarnings.map((warning: any, idx: number) => (");
  });
});
