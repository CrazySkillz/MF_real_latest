import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const runner = readFileSync(join(process.cwd(), "client", "public", "ga4-overview-validation-runner.js"), "utf8");
const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");

describe("HubSpot H10c lifecycle and scheduler evidence pack", () => {
  it("consolidates the requested evidence areas without production mutation", () => {
    const start = runner.indexOf("async function hubspotH10cLifecycleSchedulerPack(config)");
    const end = runner.indexOf("function help()", start);
    const pack = runner.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(pack).toContain("hubspotH10CollectEvidence(config)");
    expect(pack).toContain("hubspotAlternateMappingMatrixPack");
    expect(pack).toContain("hubspotPipelineProxy");
    expect(pack).toContain("lifecycle:");
    expect(pack).toContain("failureRetention:");
    expect(pack).toContain("schedulerReprocessing:");
    expect(pack).toContain("mapping:");
    expect(pack).toContain("pipelineProxy:");
    expect(pack).toContain("downstreamIsolation:");
    expect(pack).toContain("staleDaily:");
    expect(pack).not.toContain('method: "POST"');
    expect(pack).not.toContain("save-mappings");
    expect(pack).not.toContain("hubspotProxyTransitionAfter");
    expect(pack).not.toContain("hubspotPropagationAfter");
    expect(runner).toContain("hubspotH10cLifecycleSchedulerPack: hubspotH10cLifecycleSchedulerPack");
  });

  it("fails closed where deployed event evidence or audit persistence is unavailable", () => {
    expect(runner).toContain("deployedAddEditDeleteDisconnectEventProven: false");
    expect(runner).toContain("deployedForcedFailureEventProven: false");
    expect(runner).toContain("persistedSchedulerEventAuditAvailable: false");
    expect(runner).toContain("deployedSchedulerEventProven: false");
    expect(runner).toContain("transitionEventProven: false");
    expect(runner).toContain("adComparisonDeployedProven: false");
    expect(runner).toContain("campaignDeepDiveDeployedProven: false");
  });

  it("exposes sanitized source sync evidence from the read-only inventory route", () => {
    expect(routes).toContain("lastSyncedAt: mapping?.lastSyncedAt ? String(mapping.lastSyncedAt) : null");
    expect(routes).toContain("lastTotalRevenue: Number.isFinite(Number(mapping?.lastTotalRevenue))");
    expect(routes).not.toContain("accessToken: hubspotConnectionsTable.accessToken");
    expect(routes).not.toContain("refreshToken: hubspotConnectionsTable.refreshToken");
  });
});
