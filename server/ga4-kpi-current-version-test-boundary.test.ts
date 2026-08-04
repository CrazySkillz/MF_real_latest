import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyCurrentVersionResults,
  readCurrentVersionManifest,
  type CurrentVersionTestManifest,
  type VitestJsonResult,
} from "../scripts/ga4-kpi-current-version-test-boundary";

const root = process.cwd();

function report(
  assertions: Array<{ file: string; fullName: string; status: string }>,
): VitestJsonResult {
  const files = new Map<string, Array<{ fullName: string; status: string }>>();
  for (const assertion of assertions) {
    const values = files.get(assertion.file) ?? [];
    values.push({ fullName: assertion.fullName, status: assertion.status });
    files.set(assertion.file, values);
  }
  return {
    numTotalTests: assertions.length,
    numPassedTests: assertions.filter((value) => value.status === "passed").length,
    numFailedTests: assertions.filter((value) => value.status === "failed").length,
    testResults: [...files].map(([file, assertionResults]) => ({
      name: resolve(root, file),
      assertionResults,
    })),
  };
}

describe("GA4 KPI current-version test boundary", () => {
  it("keeps the exact documented deferred inventory visible and unique", () => {
    const manifest = readCurrentVersionManifest(root);
    expect(manifest.tests).toHaveLength(41);
    expect(manifest.tests.filter((test) => test.group === "future-platforms")).toHaveLength(21);
    expect(manifest.tests.filter((test) => test.group === "google-ads")).toHaveLength(19);
    expect(manifest.tests.filter((test) => test.group === "ga4-ad-comparison")).toHaveLength(1);
    expect(
      new Set(manifest.tests.map((test) => `${test.file}\u0000${test.fullName}`)).size,
    ).toBe(41);
  });

  it("wires the blocking current-version gate and non-blocking deferred evidence into CI", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    const workflow = readFileSync(resolve(root, ".github/workflows/test.yml"), "utf8");
    expect(packageJson.scripts["test:current-version"]).toBe(
      "tsx scripts/ga4-kpi-current-version-test-boundary.ts current",
    );
    expect(packageJson.scripts["test:deferred"]).toBe(
      "tsx scripts/ga4-kpi-current-version-test-boundary.ts deferred",
    );
    expect(workflow).toContain("- run: npm run test:current-version");
    expect(workflow).toContain("continue-on-error: true");
    expect(workflow).toContain("run: npm run test:deferred");
  });
  it("classifies only exact deferred identities as non-blocking", () => {
    const deferred = {
      group: "google-ads",
      file: "server/google-ads.test.ts",
      fullName: "deferred Google Ads behavior",
    } as const;
    const manifest = {
      schemaVersion: 1,
      scope: "fixture",
      groups: {
        "future-platforms": { blocking: false, reason: "fixture" },
        "google-ads": { blocking: false, reason: "fixture" },
        "ga4-ad-comparison": { blocking: false, reason: "fixture" },
      },
      tests: [deferred],
    } satisfies CurrentVersionTestManifest;
    const result = classifyCurrentVersionResults(
      report([
        { ...deferred, status: "failed" },
        {
          file: "server/ga4-kpi.test.ts",
          fullName: "current KPI behavior",
          status: "failed",
        },
      ]),
      manifest,
      root,
    );

    expect(result.deferredResults.map((test) => test.fullName)).toEqual([
      deferred.fullName,
    ]);
    expect(result.currentFailures.map((test) => test.fullName)).toEqual([
      "current KPI behavior",
    ]);
    expect(result.missingDeferred).toEqual([]);
  });

  it("fails closed when a deferred identity is renamed or not executed", () => {
    const manifest = readCurrentVersionManifest(root);
    const result = classifyCurrentVersionResults(report([]), manifest, root);
    expect(result.missingDeferred).toHaveLength(41);
    expect(result.currentFailures).toEqual([]);
  });

  it("fails closed when a deferred test is skipped instead of executed", () => {
    const manifest = readCurrentVersionManifest(root);
    const deferred = manifest.tests[0];
    const result = classifyCurrentVersionResults(
      report([{ ...deferred, status: "skipped" }]),
      { ...manifest, tests: [deferred] },
      root,
    );
    expect(result.deferredResults).toMatchObject([
      { fullName: deferred.fullName, status: "skipped" },
    ]);
    expect(result.missingDeferred).toEqual([deferred]);
  });
  it("reports a passing deferred test without promoting it into current scope", () => {
    const manifest = readCurrentVersionManifest(root);
    const deferred = manifest.tests[0];
    const result = classifyCurrentVersionResults(
      report([{ ...deferred, status: "passed" }]),
      { ...manifest, tests: [deferred] },
      root,
    );
    expect(result.deferredResults).toMatchObject([
      { fullName: deferred.fullName, status: "passed" },
    ]);
    expect(result.currentFailures).toEqual([]);
    expect(result.missingDeferred).toEqual([]);
  });
});
