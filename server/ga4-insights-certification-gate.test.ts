import { describe, expect, it } from "vitest";
import {
  evaluateGA4InsightsCertification,
  GA4_INSIGHTS_REQUIRED_DEPENDENCIES,
  GA4_INSIGHTS_REQUIRED_EXTERNAL_GATES,
} from "./ga4-insights-certification-gate";

const sha = "a".repeat(40);
const hash = "b".repeat(64);
const record = (status: "UNVERIFIED" | "PRODUCTION_READY" = "UNVERIFIED") => ({
  schemaVersion: 1,
  sectionId: "ga4-insights-live",
  status,
  lastReviewedSha: sha,
  certifiedSha: status === "PRODUCTION_READY" ? sha : null,
  deployedSha: status === "PRODUCTION_READY" ? sha : null,
  invalidationReason: status === "PRODUCTION_READY" ? null : "deployment evidence pending",
  configurationBoundary: {
    scope: "live GA4 Insights tab only",
    includedSurfaces: ["live tab"],
    excludedSurfaces: ["Reports, PDF, scheduled reports, and email delivery"],
    sourceRules: ["selected property and saved filter"],
    windowRules: ["completed campaign-reporting days"],
    ownershipRules: ["campaign access"],
  },
  dependencies: GA4_INSIGHTS_REQUIRED_DEPENDENCIES.map((path) => ({ path, role: "boundary", sha256: status === "PRODUCTION_READY" ? hash : null })),
  statusDocument: {
    path: "GA4/INSIGHTS_PRODUCTION_READINESS.md",
    startMarker: "<!-- ga4-insights-current-status -->",
    endMarker: "<!-- /ga4-insights-current-status -->",
  },
  requiredTests: [{ id: "tests", status: "passed", evidence: "passed" }],
  externalGates: GA4_INSIGHTS_REQUIRED_EXTERNAL_GATES.map((id) => ({
    id,
    status: status === "PRODUCTION_READY" ? "passed" : "pending",
    evidence: "exact SHA",
  })),
});
const context = (status: "UNVERIFIED" | "PRODUCTION_READY" = "UNVERIFIED") => ({
  exists: () => true,
  readText: (path: string) => path === "GA4/INSIGHTS_PRODUCTION_READINESS.md"
    ? `<!-- ga4-insights-current-status -->\n<!-- ga4-insights-certification-status: ${status} -->\nStatus: **${status}**\n<!-- /ga4-insights-current-status -->`
    : "content",
  sha256: () => hash,
  commitExists: () => true,
  commitIsAncestor: () => true,
});

describe("GA4 Insights machine certification gate", () => {
  it("accepts a consistent UNVERIFIED record with pending external evidence", () => {
    expect(evaluateGA4InsightsCertification(record(), context())).toEqual({ ok: true, errors: [] });
  });

  it("accepts a complete exact-SHA ready record", () => {
    expect(evaluateGA4InsightsCertification(record("PRODUCTION_READY"), context("PRODUCTION_READY"))).toEqual({ ok: true, errors: [] });
  });

  it("rejects readiness while an external gate is pending", () => {
    const value = record("PRODUCTION_READY");
    value.externalGates[0].status = "pending";
    expect(evaluateGA4InsightsCertification(value, context("PRODUCTION_READY")).errors).toContain(
      "externalGates exact_sha_deployment is pending while status claims ready",
    );
  });

  it("rejects ready evidence that says the machine status is UNVERIFIED", () => {
    const value = record("PRODUCTION_READY");
    value.requiredTests[0].evidence = "The machine checker passed while the machine status remained UNVERIFIED.";
    expect(evaluateGA4InsightsCertification(value, context("PRODUCTION_READY")).errors).toContain(
      "requiredTests tests evidence contradicts ready status",
    );
  });

  it("rejects a ready document with a contradictory status outside the controlling marker", () => {
    const contradictory = {
      ...context("PRODUCTION_READY"),
      readText: (path: string) => path === "GA4/INSIGHTS_PRODUCTION_READINESS.md"
        ? `<!-- ga4-insights-current-status -->\n<!-- ga4-insights-certification-status: PRODUCTION_READY -->\nStatus: **PRODUCTION_READY**\n<!-- /ga4-insights-current-status -->\n\nThe machine record remains UNVERIFIED.`
        : "content",
    };
    expect(evaluateGA4InsightsCertification(record("PRODUCTION_READY"), contradictory).errors).toContain(
      "statusDocument contradicts ready status outside the controlling marker",
    );
  });

  it("rejects a record that omits live per-surface value parity", () => {
    const value = record();
    value.externalGates = value.externalGates.filter((item) => item.id !== "live_surface_value_parity");
    expect(evaluateGA4InsightsCertification(value, context()).errors).toContain(
      "missing required external gate live_surface_value_parity",
    );
  });

  it("rejects a Reports-owned dependency", () => {
    const value = record();
    value.dependencies.push({ path: "server/ga4-scheduled-report-pdf.ts", role: "outside", sha256: null });
    expect(evaluateGA4InsightsCertification(value, context()).errors.some((error) => error.includes("Reports-owned dependency"))).toBe(true);
  });

  it("rejects a changed certified dependency", () => {
    const changed = { ...context("PRODUCTION_READY"), sha256: () => "c".repeat(64) };
    expect(evaluateGA4InsightsCertification(record("PRODUCTION_READY"), changed).errors.some((error) => error.includes("changed since certification"))).toBe(true);
  });
});
