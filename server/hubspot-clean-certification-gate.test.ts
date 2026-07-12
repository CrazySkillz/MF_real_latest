import { readFileSync } from "fs";
import { join } from "path";
import { runInNewContext } from "vm";
import { describe, expect, it } from "vitest";

const runner = readFileSync(join(process.cwd(), "client", "public", "ga4-overview-validation-runner.js"), "utf8");

function loadGate() {
  const context: any = {
    console: { log() {}, table() {} },
    localStorage: { getItem() { return null; }, setItem() {} },
    window: {},
  };
  runInNewContext(runner, context);
  return context.window.GA4OverviewValidation.hubspotCleanCertificationGate;
}

const requiredChecks: Record<string, string[]> = {
  authenticationAndOwnership: ["oauthConnectPass", "tokenRefreshPass", "unauthorizedCampaignRejected"],
  lifecycle: ["addPass", "editPass", "deletePass", "disconnectPass"],
  failureRetention: ["providerFailureRetainsLastGood", "writeFailureRetainsLastGood", "paginationFailureRetainsLastGood", "disconnectFailureRetainsLastGood"],
  dateMappingAndPipelineVariants: ["supportedDateVariantsPass", "mappingVariantsPass", "pipelineVariantsPass"],
  schedulerAndReprocessing: ["normalRefreshPass", "sameSourceReprocessPass", "timeoutRetryPass", "lastGoodRetentionPass"],
  proxyContract: ["transitionPass", "overviewExclusionPass", "reportExclusionPass"],
  downstreamValues: ["overviewPass", "campaignBreakdownPass", "adComparisonPass", "campaignDeepDivePass", "kpiPass", "benchmarkPass"],
  reportsAndDelivery: ["reportPass", "snapshotPass", "pdfPass", "emailAcceptedPass", "emailDeliveryConfirmed"],
  notifications: ["notificationValuePass", "alertValuePass", "campaignIsolationPass"],
  multiCampaignIsolation: ["twoCampaignsPass", "sourceIdsIsolated", "valuesIsolated", "concurrentRefreshIsolated"],
  damagedDataInventory: ["readOnlyInventoryPass", "noUnexpectedDamage", "automaticCleanupBlocked"],
};

function completeEvidence() {
  return Object.fromEntries(Object.entries(requiredChecks).map(([category, checks], index) => [category, {
    evidenceId: `H10-${index + 1}`,
    deploymentCommit: "abc123",
    deploymentId: "production-42",
    capturedAt: "2026-07-12T12:00:00.000Z",
    artifact: { overallPass: true },
    checks: Object.fromEntries(checks.map((check) => [check, true])),
  }]));
}

describe("HubSpot H10 clean-certification gate", () => {
  it("fails closed when any required evidence category is absent", () => {
    const result = loadGate()({
      deploymentCommit: "abc123",
      deploymentId: "production-42",
      evidence: {},
    });

    expect(result.overallPass).toBe(false);
    expect(result.categoryCount).toBe(11);
    expect(result.openCategories).toContain("lifecycle");
    expect(result.checks.allRequiredCategoriesPresent).toBe(false);
  });

  it("rejects failed checks, failed artifacts, and mismatched deployment metadata", () => {
    const evidence = completeEvidence();
    evidence.lifecycle.checks.editPass = false;
    evidence.failureRetention.artifact.overallPass = false;
    evidence.notifications.deploymentCommit = "different";

    const result = loadGate()({ deploymentCommit: "abc123", deploymentId: "production-42", evidence });

    expect(result.overallPass).toBe(false);
    expect(result.openCategories).toEqual(expect.arrayContaining(["lifecycle", "failureRetention", "notifications"]));
  });

  it("passes only a complete same-deployment evidence matrix", () => {
    const result = loadGate()({
      deploymentCommit: "abc123",
      deploymentId: "production-42",
      evidence: completeEvidence(),
    });

    expect(result.overallPass).toBe(true);
    expect(result.passedCategoryCount).toBe(11);
    expect(result.openCategories).toEqual([]);
  });

  it("contains no network or mutation behavior", () => {
    const start = runner.indexOf("var HUBSPOT_H10_REQUIREMENTS");
    const end = runner.indexOf("function help()", start);
    const gate = runner.slice(start, end);

    expect(gate).not.toContain("fetch(");
    expect(gate).not.toContain('method: "POST"');
    expect(gate).not.toContain("localStorage.setItem");
    expect(runner).toContain("hubspotCleanCertificationGate: hubspotCleanCertificationGate");
  });
});
