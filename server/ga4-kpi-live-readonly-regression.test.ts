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
    const unsafeGetPatterns = validator.slice(validator.indexOf("const unsafeGetPatterns"), validator.indexOf("const readOnlyGetPatterns"));
    const readOnlyGetPatterns = validator.slice(validator.indexOf("const readOnlyGetPatterns"), validator.indexOf("await page.route"));
    expect(unsafeGetPatterns).not.toContain('/\\/api\\/notifications$/');
    expect(readOnlyGetPatterns).toContain('/\\/api\\/notifications$/');
    expect(validator).toContain('/\\/api\\/report-snapshots\\/[^/]+\\/pdf$/');
    expect(validator).toContain('url.searchParams.set("readOnly", "1")');
    expect(validator).toContain('inputs[name]?.body?.validationReadOnly !== true');
    expect(validator).toContain('inputs.notifications?.headers?.["x-ga4-validation-read-only"] !== "1"');
    expect(validator).toContain('inputs.notifications?.headers?.["x-ga4-credential-refresh-allowed"] !== "0"');
    expect(validator).toContain('inputs.daily?.body?.providerRefreshAttempted !== false');
    expect(validator).toContain("readPersistenceFingerprint");
    expect(validator).toContain("persistenceFingerprintBefore");
    expect(validator).toContain("persistenceFingerprintAfter");
    expect(validator).toContain("changedPersistenceComponents");
    expect(validator).toContain("persistenceSemanticStateUnchanged");
    expect(validator).toContain('/sessions/${encodeURIComponent(auth.sessionId)}/revoke');
  });

  it("ignores only minute-refresh metadata in persistence fingerprints", () => {
    const validator = read("scripts", "ga4-kpi-live-readonly.ts");

    expect(validator).toContain("mapping_config::jsonb - 'lastSyncedAt'");
    expect(validator).toContain("to_jsonb(x) - 'id' - 'created_at'");
    expect(validator).toContain("to_jsonb(x) - 'updated_at'");
    expect(validator).not.toContain("to_jsonb(x) - 'spend'");
    expect(validator).not.toContain("to_jsonb(x) - 'current_value'");
  });

  it("checks exact KPI cards, Tracker, alerts, Insights, and browser PDF consumers", () => {
    const validator = read("scripts", "ga4-kpi-live-readonly.ts");

    expect(validator).toContain("resolveGA4KpiLiveValue");
    expect(validator).toContain("resolveGA4KpiConsumerState");
    expect(validator).toContain('Object.prototype.hasOwnProperty.call(inputs.daily?.body || {}, "overviewTotals")');
    expect(validator).toContain("breakdownTotals: overviewTotals");
    expect(validator).toContain("sessions: Number(overviewTotals?.sessions || 0)");
    expect(validator).not.toContain("breakdownTotals: dailyTotals");
    expect(validator).not.toContain("overviewEngagementRate: dailyTotals.engagementRate");
    expect(validator).toContain('inputs.daily?.body?.refreshIsStale === true ? "stale" : "ready"');
    expect(validator).toContain("getGA4KpiReportingWindowLabel");
    expect(validator).toContain("Authenticated KPI API inventory does not match");
    expect(validator).toContain('page.locator(`#ga4-kpi-${expected.kpi.id}`)');
    expect(validator).toContain("deployed KPI card/input/state/alert parity failed");
    expect(validator).toContain("Deployed KPI Tracker does not match");
    expect(validator).toContain("persistedKpiNotifications");
    expect(validator).toContain("Deployed Notifications do not match exact breached, persisted, latest-KPI card values");
    expect(validator).toContain('deployedNotificationsApi: "read_only_no_credential_refresh_confirmed"');
    expect(validator).toContain('getByRole("tab", { name: "Insights", exact: true }).click()');
    expect(validator).toContain('getByTestId("insights-finding")');
    expect(validator).toContain('expectedMode = "consolidated_unverified"');
    expect(validator).toContain("!directFinding && !periodMismatchFinding");
    expect(validator).toContain("KPI-derived Insights context parity failed");
    expect(validator).toContain('getByRole("tab", { name: "Reports", exact: true }).click()');
    expect(validator).toContain('getByRole("button", { name: "Download" })');
    expect(validator).toContain("await pdfText(await downloadBuffer(download))");
    expect(validator).toContain("downloaded browser KPI PDF does not match the exact page inputs and states");
    expect(validator).not.toContain("/api/report-snapshots/${");
  });

  it("loads the Reports inventory only after the read-only page activates Reports", () => {
    const validator = read("scripts", "ga4-kpi-live-readonly.ts");
    const initialInputs = validator.indexOf("Object.entries(initialPaths)");
    const reportsWait = validator.indexOf("const reportsResponsePromise = expectedResponse(page, reportsPath)");
    const reportsClick = validator.indexOf('getByRole("tab", { name: "Reports", exact: true }).click()');
    const reportsResult = validator.indexOf("inputs.reports = await reportsResponsePromise");

    expect(validator).toContain("const { reports: reportsPath, ...initialPaths } = corePaths(propertyId);");
    expect(initialInputs).toBeGreaterThan(-1);
    expect(reportsWait).toBeGreaterThan(initialInputs);
    expect(reportsClick).toBeGreaterThan(reportsWait);
    expect(reportsResult).toBeGreaterThan(reportsClick);
  });

  it("waits for Insights to finish loading before reading KPI-derived findings", () => {
    const validator = read("scripts", "ga4-kpi-live-readonly.ts");
    const insightsClick = validator.indexOf('getByRole("tab", { name: "Insights", exact: true }).click()');
    const insightsReady = validator.indexOf('getByTestId("insights-trackers").waitFor');
    const findingsRead = validator.indexOf('getByTestId("insights-finding").evaluateAll');

    expect(insightsClick).toBeGreaterThan(-1);
    expect(insightsReady).toBeGreaterThan(insightsClick);
    expect(findingsRead).toBeGreaterThan(insightsReady);
    expect(validator).toContain('getAttribute("data-findings")');
  });

  it("isolates the no-refresh validation contract from default Notifications behavior", () => {
    const validator = read("scripts", "ga4-kpi-live-readonly.ts");
    const routes = read("server", "routes-oauth.ts");
    const resolver = read("server", "utils", "ga4-alert-current-value.ts");

    expect(routes).toContain("const resolveNotificationAlertRow = async (row: any): Promise<any> =>");
    expect(routes).toContain("const resolveNotificationAlertRowForRequest = async (row: any, validationReadOnly: boolean)");
    expect(routes).toContain("? resolveAlertCurrentValueForDecision(row, undefined, { allowCredentialRefresh: false })");
    expect(routes).toContain(": resolveNotificationAlertRow(row);");
    expect(routes).toContain('res.setHeader("X-GA4-Validation-Read-Only", "1")');
    expect(routes).toContain('res.setHeader("X-GA4-Credential-Refresh-Allowed", "0")');
    expect(resolver).toContain("options.allowCredentialRefresh !== false");
    expect(resolver).toContain("options.allowCredentialRefresh === false");
    expect(validator).not.toContain("UPDATE ");
    expect(validator).not.toContain("INSERT INTO ");
    expect(validator).not.toContain("DELETE FROM ");
    expect(validator).not.toContain("runGA4DailyKPIAndBenchmarkJobs");
    expect(validator).not.toContain("preflightGA4ReportKPIConsumers");
  });
});
