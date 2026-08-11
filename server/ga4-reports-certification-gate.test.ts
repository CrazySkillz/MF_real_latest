import { describe, expect, it } from "vitest";
import {
  evaluateGA4ReportsCertification,
  GA4_REPORTS_REQUIRED_DEPENDENCIES,
  GA4_REPORTS_REQUIRED_EXTERNAL_GATES,
} from "./ga4-reports-certification-gate";

const sha = "a".repeat(40);
const hash = "b".repeat(64);
const record = (status: "UNVERIFIED" | "PRODUCTION_READY" = "UNVERIFIED") => ({
  schemaVersion: 1,
  sectionId: "ga4-reports",
  status,
  lastReviewedSha: sha,
  certifiedSha: status === "PRODUCTION_READY" ? sha : null,
  deployedSha: status === "PRODUCTION_READY" ? sha : null,
  invalidationReason: status === "PRODUCTION_READY" ? null : "current exact-SHA evidence is incomplete",
  configurationBoundary: {
    scope: "GA4 Reports tab and GA4 report delivery surfaces",
    includedSurfaces: ["Reports tab and server-generated report artifacts"],
    excludedSurfaces: ["Campaign DeepDive and other connected-platform certification"],
    sourceRules: ["saved campaign source configuration"],
    windowRules: ["report-type time-window parity"],
    ownershipRules: ["campaign and platform access"],
    deliveryRules: ["provider acceptance is not confirmed delivery"],
  },
  dependencies: GA4_REPORTS_REQUIRED_DEPENDENCIES.map((path) => ({
    path,
    role: "Reports certification boundary",
    sha256: status === "PRODUCTION_READY" ? hash : null,
  })),
  statusDocument: {
    path: "GA4/REPORTS_PRODUCTION_READINESS.md",
    startMarker: "<!-- ga4-reports-current-status -->",
    endMarker: "<!-- /ga4-reports-current-status -->",
  },
  requiredTests: [{ id: "focused_regression", status: "passed", evidence: "passed" }],
  externalGates: GA4_REPORTS_REQUIRED_EXTERNAL_GATES.map((id) => ({
    id,
    status: status === "PRODUCTION_READY" ? "passed" : "pending",
    evidence: "exact-SHA evidence is required",
  })),
});

const context = (status: "UNVERIFIED" | "PRODUCTION_READY" = "UNVERIFIED") => ({
  exists: () => true,
  readText: (path: string) => {
    if (path === "GA4/REPORTS_PRODUCTION_READINESS.md") {
      return [
        "<!-- ga4-reports-current-status -->",
        `<!-- ga4-reports-certification-status: ${status} -->`,
        status === "PRODUCTION_READY"
          ? "GA4 Reports is production-ready"
          : "GA4 Reports is not currently clean-certified",
        "<!-- /ga4-reports-current-status -->",
      ].join("\n");
    }
    if (path === "package.json") return '"check:ga4-reports-certification"';
    return "content";
  },
  sha256: () => hash,
  commitExists: () => true,
  commitIsAncestor: () => true,
});

describe("GA4 Reports machine certification gate", () => {
  it("accepts a consistent UNVERIFIED record with pending external evidence", () => {
    expect(evaluateGA4ReportsCertification(record(), context())).toEqual({ ok: true, errors: [] });
  });

  it("accepts a complete exact-SHA ready record", () => {
    expect(evaluateGA4ReportsCertification(record("PRODUCTION_READY"), context("PRODUCTION_READY"))).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("rejects readiness while an external gate is pending", () => {
    const value = record("PRODUCTION_READY");
    value.externalGates[0].status = "pending";
    expect(evaluateGA4ReportsCertification(value, context("PRODUCTION_READY")).errors).toContain(
      "externalGates exact_sha_deployment is pending while status claims ready",
    );
  });

  it("rejects a missing required dependency", () => {
    const value = record();
    value.dependencies = value.dependencies.filter(
      (dependency) => dependency.path !== "server/report-scheduler.ts",
    );
    expect(evaluateGA4ReportsCertification(value, context()).errors).toContain(
      "missing required dependency server/report-scheduler.ts",
    );
  });

  it("rejects a changed certified dependency", () => {
    const changed = { ...context("PRODUCTION_READY"), sha256: () => "c".repeat(64) };
    expect(
      evaluateGA4ReportsCertification(record("PRODUCTION_READY"), changed).errors.some((error) =>
        error.includes("changed since certification"),
      ),
    ).toBe(true);
  });

  it("rejects a contradictory reusable readiness claim while status is UNVERIFIED", () => {
    const contradictory = {
      ...context(),
      readText: (path: string) =>
        path === "GA4/REPORTS_PRODUCTION_READINESS.md"
          ? "<!-- ga4-reports-current-status -->\n<!-- ga4-reports-certification-status: UNVERIFIED -->\nGA4 Reports is clean-certified\n<!-- /ga4-reports-current-status -->"
          : path === "package.json"
            ? '"check:ga4-reports-certification"'
            : "content",
    };
    expect(evaluateGA4ReportsCertification(record(), contradictory).errors).toContain(
      "current status contradicts UNVERIFIED record",
    );
  });
});
