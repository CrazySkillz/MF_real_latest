import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateCertificationContractSha256,
  evaluateGA4KpiCertification,
  runGA4KpiCertificationGate,
} from "./ga4-kpi-certification-gate";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const statusDocument = [
  "## Current Status",
  "<!-- ga4-kpi-certification-status: UNVERIFIED -->",
  "GA4 KPIs are not production-ready.",
  "## Historical Status",
].join("\n");

const dependencyContent: Record<string, string> = {
  "GA4/KPIS_PRODUCTION_READINESS.md": statusDocument,
  "server/ga4-kpi-benchmark-jobs.ts": "export const value = 1;",
};

const baseRecord = () => {
  const record = {
  schemaVersion: 1,
  sectionId: "ga4-kpis",
  contractSha256: "",
  status: "UNVERIFIED",
  lastReviewedSha: "a".repeat(40),
  certifiedSha: null as string | null,
  invalidationReason: "Current value parity is not yet proven." as string | null,
  configurationBoundary: {
    platformType: "google_analytics",
    scope: "campaign and selected GA4 property",
    includedSurfaces: ["KPI cards", "reports"],
    sourceRules: ["selected property only"],
    windowRules: ["30 completed reporting days"],
    ownershipRules: ["campaign access required"],
  },
  dependencies: Object.keys(dependencyContent).map((path) => ({
    path,
    role: "test dependency",
    sha256: null as string | null,
  })),
  statusDocuments: [
    {
      path: "GA4/KPIS_PRODUCTION_READINESS.md",
      startMarker: "## Current Status",
      endMarker: "## Historical Status",
    },
  ],
  requiredTests: [
    {
      id: "focused",
      command: "npm test -- focused.test.ts",
      status: "pending",
      evidence: "Required before certification.",
    },
  ],
  externalGates: [
    {
      id: "deployed",
      status: "pending",
      evidence: "Requires deployed validation.",
    },
  ],
  };
  record.contractSha256 = calculateCertificationContractSha256(record as never);
  return record;
};

const context = (content = dependencyContent) => ({
  exists: (path: string) => Object.hasOwn(content, path),
  readText: (path: string) => content[path],
  sha256: (path: string) => hash(content[path]),
  gitCommitExists: () => true,
  gitCommitIsAncestor: () => true,
  expectedContractSha256: baseRecord().contractSha256,
});

describe("GA4 KPI certification integrity gate", () => {
  it("keeps secondary KPI summaries aligned to the current production certification", () => {
    const readme = readFileSync(resolve(process.cwd(), "GA4/README.md"), "utf8");
    const thresholds = readFileSync(resolve(process.cwd(), "GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md"), "utf8");
    const readmeKpiEntry = readme.slice(
      readme.indexOf("- `GA4/KPIS_PRODUCTION_READINESS.md`"),
      readme.indexOf("- `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md`"),
    );
    const thresholdStatus = thresholds.slice(0, thresholds.indexOf("## Purpose"));

    expect(readmeKpiEntry).toContain("Current status: **PRODUCTION_READY**");
    expect(readmeKpiEntry).toContain("94f1096f3d08c1443f27a032bc5a44c8468c1a7e");
    expect(thresholdStatus).toContain("Current durable whole-tab answer: GA4 KPIs are **PRODUCTION_READY**");
    expect(thresholdStatus).toContain("94f1096f3d08c1443f27a032bc5a44c8468c1a7e");
    expect(thresholdStatus).not.toContain("machine record remains `UNVERIFIED`");
  });

  it("accepts a complete UNVERIFIED record with pending evidence", () => {
    const result = evaluateGA4KpiCertification(baseRecord(), context());
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("rejects a readiness claim while the record is UNVERIFIED", () => {
    const content = {
      ...dependencyContent,
      "GA4/KPIS_PRODUCTION_READINESS.md": statusDocument.replace(
        "GA4 KPIs are not production-ready.",
        "GA4 KPIs are production-ready.",
      ),
    };
    const result = evaluateGA4KpiCertification(baseRecord(), context(content));
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain(
      "claims GA4 KPI production readiness while record is UNVERIFIED",
    );
  });

  it("rejects missing certification records", () => {
    const result = runGA4KpiCertificationGate(
      process.cwd(),
      "GA4/certifications/does-not-exist.json",
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        "GA4/certifications/does-not-exist.json: certification record is missing",
      ],
    });
  });

  it("rejects a reviewed SHA that is not a repository commit", () => {
    const record = baseRecord();
    const result = evaluateGA4KpiCertification(record, {
      ...context(),
      gitCommitExists: () => false,
    });
    expect(result.errors).toContain(
      "lastReviewedSha does not identify a repository commit",
    );
  });

  it("rejects a reduced canonical dependency inventory", () => {
    const record = baseRecord();
    record.dependencies.pop();
    record.contractSha256 = calculateCertificationContractSha256(record as never);
    const result = evaluateGA4KpiCertification(record, context());
    expect(result.errors).toContain(
      "contractSha256 does not match the canonical certification contract",
    );
  });

  it("rejects stale dependency hashes for a ready claim", () => {
    const record = baseRecord();
    record.status = "PRODUCTION_READY";
    record.certifiedSha = "b".repeat(40);
    record.lastReviewedSha = record.certifiedSha;
    record.invalidationReason = null;
    record.dependencies = record.dependencies.map((dependency) => ({
      ...dependency,
      sha256: "0".repeat(64),
    }));
    const content = {
      ...dependencyContent,
      "GA4/KPIS_PRODUCTION_READINESS.md": statusDocument
        .replace("UNVERIFIED", "PRODUCTION_READY")
        .replace("not production-ready", "production-ready"),
    };
    record.requiredTests[0].status = "passed";
    record.requiredTests[0].evidence = "Passed in CI.";
    record.externalGates[0].status = "passed";
    record.externalGates[0].evidence = "Validated in the deployed environment.";

    const result = evaluateGA4KpiCertification(record, context(content));
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain(
      "changed since the certified dependency snapshot",
    );
  });

  it("rejects pending test or external evidence for a ready claim", () => {
    const record = baseRecord();
    record.status = "PRODUCTION_READY";
    record.certifiedSha = "b".repeat(40);
    record.lastReviewedSha = record.certifiedSha;
    record.invalidationReason = null;
    record.dependencies = record.dependencies.map((dependency) => ({
      ...dependency,
      sha256: hash(dependencyContent[dependency.path]),
    }));
    const content = {
      ...dependencyContent,
      "GA4/KPIS_PRODUCTION_READINESS.md": statusDocument
        .replace("UNVERIFIED", "PRODUCTION_READY")
        .replace("not production-ready", "production-ready"),
    };
    record.dependencies[0].sha256 = hash(
      content["GA4/KPIS_PRODUCTION_READINESS.md"],
    );

    const result = evaluateGA4KpiCertification(record, context(content));
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "requiredTests focused is pending while certification claims ready",
    );
    expect(result.errors).toContain(
      "externalGates deployed is pending while certification claims ready",
    );
  });

  it("accepts a ready claim only with matching hashes and complete evidence", () => {
    const content = {
      ...dependencyContent,
      "GA4/KPIS_PRODUCTION_READINESS.md": statusDocument
        .replace("UNVERIFIED", "PRODUCTION_READY")
        .replace("not production-ready", "production-ready"),
    };
    const record = baseRecord();
    record.status = "PRODUCTION_READY";
    record.certifiedSha = "b".repeat(40);
    record.lastReviewedSha = record.certifiedSha;
    record.invalidationReason = null;
    record.dependencies = record.dependencies.map((dependency) => ({
      ...dependency,
      sha256: hash(content[dependency.path]),
    }));
    record.requiredTests[0].status = "passed";
    record.requiredTests[0].evidence = "Passed in CI.";
    record.externalGates[0].status = "passed";
    record.externalGates[0].evidence = "Validated in the deployed environment.";

    const result = evaluateGA4KpiCertification(record, context(content));
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("accepts the repository's current fail-closed record", () => {
    expect(runGA4KpiCertificationGate()).toEqual({ ok: true, errors: [] });
  });
});
