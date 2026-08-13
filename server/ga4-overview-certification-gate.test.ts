import { describe, expect, it } from "vitest";
import {
  evaluateGA4OverviewCertification,
  GA4_OVERVIEW_REQUIRED_DEPENDENCIES,
  GA4_OVERVIEW_REQUIRED_EXTERNAL_GATES,
  GA4_OVERVIEW_REQUIRED_TESTS,
  runGA4OverviewCertificationGate,
} from "./ga4-overview-certification-gate";

const sha = "a".repeat(40);
const hash = "b".repeat(64);
const statusDocuments = [
  "GA4/README.md",
  "GA4/OVERVIEW.md",
  "GA4/OVERVIEW_PRODUCTION_READINESS.md",
].map((path) => ({
  path,
  startMarker: "<!-- ga4-overview-current-status -->",
  endMarker: "<!-- /ga4-overview-current-status -->",
}));

const record = (
  status: "UNVERIFIED" | "PRODUCTION_READY" = "UNVERIFIED",
): any => ({
  schemaVersion: 1,
  sectionId: "ga4-overview",
  status,
  lastReviewedSha: sha,
  certifiedSha: status === "PRODUCTION_READY" ? sha : null,
  deployedSha: sha,
  invalidationReason:
    status === "PRODUCTION_READY"
      ? null
      : "exact-current external validation is incomplete",
  configurationBoundary: {
    platformType: "google_analytics",
    scope: "GA4 Overview tab for one authorized campaign and active property",
    includedSurfaces: ["Overview cards, tables, and source lists"],
    excludedSurfaces: ["other GA4 tabs and deferred connected platforms"],
    sourceRules: ["exact campaign, property, currency, and active source set"],
    windowRules: ["30 completed reporting days plus appended completed days"],
    ownershipRules: ["actor and campaign access must be proven"],
  },
  dependencies: GA4_OVERVIEW_REQUIRED_DEPENDENCIES.map((path) => ({
    path,
    role: "Overview certification boundary",
    sha256: status === "PRODUCTION_READY" ? hash : null,
  })),
  statusDocuments,
  requiredTests: GA4_OVERVIEW_REQUIRED_TESTS.map((id) => ({
    id,
    status: "passed",
    evidence: "passed",
  })),
  externalGates: GA4_OVERVIEW_REQUIRED_EXTERNAL_GATES.map((id) => ({
    id,
    status: status === "PRODUCTION_READY" ? "passed" : "pending",
    evidence: "exact-current evidence is required",
  })),
});

const context = (
  status: "UNVERIFIED" | "PRODUCTION_READY" = "UNVERIFIED",
) => ({
  exists: () => true,
  readText: (path: string) => {
    if (path === "package.json") {
      return '"check:ga4-overview-certification"';
    }
    if (path.startsWith("GA4/")) {
      return [
        "<!-- ga4-overview-current-status -->",
        `<!-- ga4-overview-certification-status: ${status} -->`,
        status === "PRODUCTION_READY"
          ? "GA4 Overview is production-ready"
          : "GA4 Overview is not currently production-ready",
        "<!-- /ga4-overview-current-status -->",
      ].join("\n");
    }
    return "content";
  },
  sha256: () => hash,
  commitExists: () => true,
  commitIsAncestor: () => true,
});

describe("GA4 Overview machine certification gate", () => {
  it("accepts a consistent UNVERIFIED record with pending external gates", () => {
    expect(evaluateGA4OverviewCertification(record(), context())).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("accepts readiness only with current hashes and complete evidence", () => {
    expect(
      evaluateGA4OverviewCertification(
        record("PRODUCTION_READY"),
        context("PRODUCTION_READY"),
      ),
    ).toEqual({ ok: true, errors: [] });
  });

  it("rejects readiness while an external gate is pending", () => {
    const value = record("PRODUCTION_READY");
    value.externalGates[0].status = "pending";
    expect(
      evaluateGA4OverviewCertification(
        value,
        context("PRODUCTION_READY"),
      ).errors,
    ).toContain(
      "externalGates exact_sha_deployment is pending while status claims ready",
    );
  });

  it("rejects a missing required dependency", () => {
    const value = record();
    value.dependencies = value.dependencies.filter(
      (dependency: any) => dependency.path !== "server/ga4-daily-scheduler.ts",
    );
    expect(evaluateGA4OverviewCertification(value, context()).errors).toContain(
      "missing required dependency server/ga4-daily-scheduler.ts",
    );
  });

  it("rejects a changed certified dependency", () => {
    const changed = {
      ...context("PRODUCTION_READY"),
      sha256: () => "c".repeat(64),
    };
    expect(
      evaluateGA4OverviewCertification(
        record("PRODUCTION_READY"),
        changed,
      ).errors.some((error) => error.includes("changed since certification")),
    ).toBe(true);
  });

  it("rejects an invalid reviewed revision", () => {
    expect(
      evaluateGA4OverviewCertification(record(), {
        ...context(),
        commitExists: () => false,
      }).errors,
    ).toContain("lastReviewedSha is not a commit");
  });

  it("rejects a contradictory current readiness claim", () => {
    const contradictory = {
      ...context(),
      readText: (path: string) =>
        path === "package.json"
          ? '"check:ga4-overview-certification"'
          : [
              "<!-- ga4-overview-current-status -->",
              "<!-- ga4-overview-certification-status: UNVERIFIED -->",
              "GA4 Overview is clean-certified",
              "<!-- /ga4-overview-current-status -->",
            ].join("\n"),
    };
    expect(
      evaluateGA4OverviewCertification(record(), contradictory).errors.some(
        (error) => error.includes("contradicts UNVERIFIED"),
      ),
    ).toBe(true);
  });

  it("accepts the repository fail-closed record", () => {
    expect(runGA4OverviewCertificationGate()).toEqual({
      ok: true,
      errors: [],
    });
  });
});
