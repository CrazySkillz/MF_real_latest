import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

describe("GA4 KPI deployed read-only validator", () => {
  it("fails closed on revision, authorization, mutation, refresh, and persistence boundaries", () => {
    const validator = read("scripts", "ga4-kpi-live-readonly.ts");

    expect(validator).toContain("GA4_KPI_VALIDATION_EXPECTED_SHA must be a full Git SHA");
    expect(validator).toContain("GA4_KPI_VALIDATION_CAMPAIGN_ID must be an exact campaign UUID");
    expect(validator).toContain('await client.query("BEGIN TRANSACTION READ ONLY")');
    expect(validator).toContain("Campaign client scope is missing or belongs to another tenant");
    expect(validator).toContain('if (request.method() !== "GET")');
    expect(validator).toContain("blockedApplicationMutations");
    expect(validator).toContain("blockedUnsafeGets");
    expect(validator).toContain('/\\/api\\/notifications$/');
    expect(validator).toContain('/\\/api\\/report-snapshots\\/[^/]+\\/pdf$/');
    expect(validator).toContain('url.searchParams.set("readOnly", "1")');
    expect(validator).toContain('inputs[name]?.body?.validationReadOnly !== true');
    expect(validator).toContain('inputs.daily?.body?.providerRefreshAttempted !== false');
    expect(validator).toContain("readPersistenceFingerprint");
    expect(validator).toContain("persistenceFingerprintBefore");
    expect(validator).toContain("persistenceFingerprintAfter");
    expect(validator).toContain("changedPersistenceComponents");
    expect(validator).toContain("persistenceSemanticStateUnchanged");
    expect(validator).toContain('/sessions/${encodeURIComponent(auth.sessionId)}/revoke');
  });

  it("checks exact KPI cards, Tracker, alerts, Insights, and browser PDF consumers", () => {
    const validator = read("scripts", "ga4-kpi-live-readonly.ts");

    expect(validator).toContain("resolveGA4KpiLiveValue");
    expect(validator).toContain("resolveGA4KpiConsumerState");
    expect(validator).toContain("getGA4KpiReportingWindowLabel");
    expect(validator).toContain("Authenticated KPI API inventory does not match");
    expect(validator).toContain('page.locator(`#ga4-kpi-${expected.kpi.id}`)');
    expect(validator).toContain("deployed KPI card/input/state/alert parity failed");
    expect(validator).toContain("Deployed KPI Tracker does not match");
    expect(validator).toContain("persistedKpiNotifications");
    expect(validator).toContain("Notifications consumer parity is unverified");
    expect(validator).toContain('getByRole("tab", { name: "Insights", exact: true }).click()');
    expect(validator).toContain('getByTestId("insights-finding")');
    expect(validator).toContain("KPI-derived Insights context parity failed");
    expect(validator).toContain('getByRole("tab", { name: "Reports", exact: true }).click()');
    expect(validator).toContain('getByRole("button", { name: "Download" })');
    expect(validator).toContain("await pdfText(await downloadBuffer(download))");
    expect(validator).toContain("downloaded browser KPI PDF does not match the exact page inputs and states");
    expect(validator).not.toContain("/api/report-snapshots/${");
  });

  it("adds evidence-only files outside the protected Insights and Reports dependency boundaries", () => {
    const changedPaths = new Set([
      "scripts/ga4-kpi-live-readonly.ts",
      "server/ga4-kpi-live-readonly-regression.test.ts",
    ]);
    for (const recordPath of ["GA4/certifications/ga4-insights.json", "GA4/certifications/ga4-reports.json"]) {
      const record = JSON.parse(read(recordPath));
      const dependencies = new Set((record.dependencies || []).map((dependency: any) => String(dependency.path || "")));
      expect([...changedPaths].filter((path) => dependencies.has(path))).toEqual([]);
    }

    const validator = read("scripts", "ga4-kpi-live-readonly.ts");
    expect(validator).not.toContain("UPDATE ");
    expect(validator).not.toContain("INSERT INTO ");
    expect(validator).not.toContain("DELETE FROM ");
    expect(validator).not.toContain("runGA4DailyKPIAndBenchmarkJobs");
    expect(validator).not.toContain("preflightGA4ReportKPIConsumers");
  });
});
