import { readFileSync } from "fs";
import { join } from "path";
import { runInNewContext } from "vm";
import { describe, expect, it } from "vitest";

const runner = readFileSync(join(process.cwd(), "client", "public", "ga4-overview-validation-runner.js"), "utf8");

function loadValidation() {
  const context: any = {
    console: { log() {}, table() {} },
    localStorage: { getItem() { return null; }, setItem() {} },
    window: {},
  };
  runInNewContext(runner, context);
  return context.window.GA4OverviewValidation;
}

function passingArtifacts() {
  return {
    inventory: {
      overallPass: true,
      readonly: true,
      inventoryPass: true,
      cleanupAssessment: { automaticCleanupAllowed: false },
    },
    mapping: { overallPass: true },
    pipeline: {
      overallPass: true,
      checks: { pipelineNotAddedToConfirmedRevenue: true },
    },
    overview: { overallPass: true },
    report: {
      overallPass: true,
      checks: {
        targetReportRowPresent: true,
        pipelineProxyExcludedFromReportTotal: true,
        snapshotsEndpointPasses: true,
        snapshotAvailableWhenRequired: true,
        pdfAvailableWhenRequired: true,
      },
    },
    kpiBenchmark: {
      overallPass: true,
      checks: {
        hubspotRevenuePresent: true,
        requiredKpiRowsMatchExpected: true,
        requiredBenchmarkRowsMatchExpected: true,
      },
    },
    portability: {
      overallPass: true,
      campaignCount: 2,
      checks: {
        activeHubspotSourceIdsUniqueAcrossCampaigns: true,
        hubspotRevenueSourceIdsUniqueAcrossCampaigns: true,
        allCampaignPacketsPass: true,
      },
    },
  };
}

describe("HubSpot H10a automated evidence collector", () => {
  it("builds only checks proven by retained read-only packets", () => {
    const validation = loadValidation();
    const evidence = validation.hubspotH10BuildCollectedEvidence({
      deploymentCommit: "abc123",
      deploymentId: "production-42",
    }, passingArtifacts());

    expect(evidence.authenticationAndOwnership).toBeUndefined();
    expect(evidence.lifecycle).toBeUndefined();
    expect(evidence.failureRetention).toBeUndefined();
    expect(evidence.schedulerAndReprocessing).toBeUndefined();
    expect(evidence.notifications).toBeUndefined();
    expect(evidence.proxyContract.checks.transitionPass).toBeUndefined();
    expect(evidence.downstreamValues.checks.adComparisonPass).toBeUndefined();
    expect(evidence.downstreamValues.checks.campaignDeepDivePass).toBeUndefined();
    expect(evidence.reportsAndDelivery.checks.emailAcceptedPass).toBeUndefined();
    expect(evidence.reportsAndDelivery.checks.emailDeliveryConfirmed).toBeUndefined();
    expect(evidence.multiCampaignIsolation.checks.concurrentRefreshIsolated).toBeUndefined();
  });

  it("closes only the read-only damaged-data category in the strict H10 gate", () => {
    const validation = loadValidation();
    const config = { deploymentCommit: "abc123", deploymentId: "production-42" };
    const evidence = validation.hubspotH10BuildCollectedEvidence(config, passingArtifacts());
    const gate = validation.hubspotCleanCertificationGate({ ...config, evidence });

    expect(gate.overallPass).toBe(false);
    expect(gate.openCategories).not.toContain("damagedDataInventory");
    expect(gate.openCategories).toContain("authenticationAndOwnership");
    expect(gate.openCategories).toContain("proxyContract");
    expect(gate.openCategories).toContain("reportsAndDelivery");
  });

  it("keeps the orchestrator on existing read-only packet functions", () => {
    const start = runner.indexOf("async function hubspotH10CollectEvidence(config)");
    const end = runner.indexOf("function help()", start);
    const collector = runner.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(collector).toContain("hubspotInventory");
    expect(collector).toContain("hubspotProvenance");
    expect(collector).toContain("overviewPack");
    expect(collector).toContain("hubspotReportValuePack");
    expect(collector).toContain("hubspotKpiBenchmarkValuePack");
    expect(collector).toContain("hubspotPipelineProxy");
    expect(collector).toContain("hubspotAlternateMappingMatrixPack");
    expect(collector).toContain("hubspotOtherCampaignPortabilityPack");
    expect(collector).not.toContain('method: "POST"');
    expect(collector).not.toContain("hubspotProxyTransitionAfter");
    expect(collector).not.toContain("hubspotPropagationAfter");
    expect(runner).toContain("hubspotH10CollectEvidence: hubspotH10CollectEvidence");
  });
});
