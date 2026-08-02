import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

export const GA4_KPI_CERTIFICATION_RECORD =
  "GA4/certifications/ga4-kpis.json";
export const GA4_KPI_CERTIFICATION_CONTRACT_SHA256 =
  "d935f348e84cb76d8ac7a352afd55bcb4f01b58f83203681fd06c11eb9b90b33";

type CertificationStatus = "UNVERIFIED" | "PRODUCTION_READY";
type EvidenceStatus = "passed" | "failed" | "pending" | "not_applicable";

type DependencyRecord = {
  path: string;
  role: string;
  sha256: string | null;
};

type StatusDocumentRecord = {
  path: string;
  startMarker: string;
  endMarker: string;
};

type EvidenceRecord = {
  id: string;
  command?: string;
  status: EvidenceStatus;
  evidence: string;
};

type CertificationRecord = {
  schemaVersion: number;
  sectionId: string;
  contractSha256: string;
  status: CertificationStatus;
  lastReviewedSha: string;
  certifiedSha: string | null;
  invalidationReason: string | null;
  configurationBoundary: {
    platformType: string;
    scope: string;
    includedSurfaces: string[];
    sourceRules: string[];
    windowRules: string[];
    ownershipRules: string[];
  };
  dependencies: DependencyRecord[];
  statusDocuments: StatusDocumentRecord[];
  requiredTests: EvidenceRecord[];
  externalGates: EvidenceRecord[];
};

export type CertificationGateResult = {
  ok: boolean;
  errors: string[];
};

type GateContext = {
  exists: (path: string) => boolean;
  readText: (path: string) => string;
  sha256: (path: string) => string;
  gitCommitExists: (sha: string) => boolean;
  gitCommitIsAncestor: (sha: string) => boolean;
  expectedContractSha256: string;
};

const fullShaPattern = /^[0-9a-f]{40}$/i;
const fileHashPattern = /^[0-9a-f]{64}$/i;
const positiveGa4KpiClaim =
  /\bGA4\b[^.\n]{0,100}\bKPI(?:s)?\b[^.\n]{0,100}\b(?:is|are)\s+(?!not\b)(?:currently\s+)?(?:production[- ]ready|clean[- ]certified)\b/i;

export function calculateCertificationContractSha256(
  record: CertificationRecord,
): string {
  const payload = {
    configurationBoundary: record.configurationBoundary,
    dependencies: record.dependencies.map(({ path, role }) => ({ path, role })),
    statusDocuments: record.statusDocuments,
    requiredTests: record.requiredTests.map(({ id, command }) => ({
      id,
      command: command ?? null,
    })),
    externalGates: record.externalGates.map(({ id }) => ({ id })),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeRelativePath(path: string): boolean {
  if (!path || isAbsolute(path) || path.includes("\\") || /[*?]/.test(path)) {
    return false;
  }
  const normalized = normalize(path).replace(/\\/g, "/");
  return normalized !== ".." && !normalized.startsWith("../");
}

function extractDocumentScope(
  content: string,
  document: StatusDocumentRecord,
  errors: string[],
): string {
  const start = content.indexOf(document.startMarker);
  if (start < 0) {
    errors.push(
      document.path + ": missing status start marker " + JSON.stringify(document.startMarker),
    );
    return "";
  }
  const scopeStart = start + document.startMarker.length;
  const end = content.indexOf(document.endMarker, scopeStart);
  if (end < 0) {
    errors.push(
      document.path + ": missing status end marker " + JSON.stringify(document.endMarker),
    );
    return "";
  }
  return content.slice(scopeStart, end);
}

function validateEvidence(
  name: string,
  items: EvidenceRecord[],
  requireComplete: boolean,
  errors: string[],
): void {
  if (!Array.isArray(items) || items.length === 0) {
    errors.push(name + " must contain at least one evidence entry");
    return;
  }

  const ids = new Set<string>();
  for (const item of items) {
    if (!item || typeof item.id !== "string" || !item.id.trim()) {
      errors.push(name + " contains an entry without an id");
      continue;
    }
    if (ids.has(item.id)) {
      errors.push(name + " contains duplicate id " + item.id);
    }
    ids.add(item.id);
    if (!["passed", "failed", "pending", "not_applicable"].includes(item.status)) {
      errors.push(name + " " + item.id + " has invalid status");
    }
    if (typeof item.evidence !== "string" || !item.evidence.trim()) {
      errors.push(name + " " + item.id + " has no evidence");
    }
    if (
      requireComplete &&
      item.status !== "passed" &&
      item.status !== "not_applicable"
    ) {
      errors.push(
        name + " " + item.id + " is " + item.status + " while certification claims ready",
      );
    }
  }
}

export function evaluateGA4KpiCertification(
  value: unknown,
  context: GateContext,
): CertificationGateResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ["certification record must be a JSON object"] };
  }
  const record = value as unknown as CertificationRecord;

  if (record.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1");
  }
  if (record.sectionId !== "ga4-kpis") {
    errors.push('sectionId must be "ga4-kpis"');
  }
  if (record.contractSha256 !== context.expectedContractSha256) {
    errors.push("contractSha256 does not match the canonical certification contract");
  }
  try {
    if (calculateCertificationContractSha256(record) !== context.expectedContractSha256) {
      errors.push("configuration, dependency, status, test, or external-gate inventory changed");
    }
  } catch {
    errors.push("certification contract inventory is malformed");
  }
  if (record.status !== "UNVERIFIED" && record.status !== "PRODUCTION_READY") {
    errors.push("status must be UNVERIFIED or PRODUCTION_READY");
  }
  if (!fullShaPattern.test(record.lastReviewedSha || "")) {
    errors.push("lastReviewedSha must be a full 40-character Git SHA");
  } else if (!context.gitCommitExists(record.lastReviewedSha)) {
    errors.push("lastReviewedSha does not identify a repository commit");
  } else if (!context.gitCommitIsAncestor(record.lastReviewedSha)) {
    errors.push("lastReviewedSha is not an ancestor of the checked revision");
  }

  const claimsReady = record.status === "PRODUCTION_READY";
  if (claimsReady) {
    if (!fullShaPattern.test(record.certifiedSha || "")) {
      errors.push("certifiedSha must be a full Git SHA when status is PRODUCTION_READY");
    } else if (!context.gitCommitExists(record.certifiedSha!)) {
      errors.push("certifiedSha does not identify a repository commit");
    } else if (!context.gitCommitIsAncestor(record.certifiedSha!)) {
      errors.push("certifiedSha is not an ancestor of the checked revision");
    } else if (record.certifiedSha !== record.lastReviewedSha) {
      errors.push("certifiedSha must equal lastReviewedSha when status is PRODUCTION_READY");
    }
    if (record.invalidationReason !== null) {
      errors.push("invalidationReason must be null when status is PRODUCTION_READY");
    }
  } else {
    if (record.certifiedSha !== null) {
      errors.push("certifiedSha must be null while status is UNVERIFIED");
    }
    if (
      typeof record.invalidationReason !== "string" ||
      !record.invalidationReason.trim()
    ) {
      errors.push("UNVERIFIED status requires an invalidationReason");
    }
  }

  const boundary = record.configurationBoundary;
  if (!isRecord(boundary)) {
    errors.push("configurationBoundary must be an object");
  } else {
    for (const field of ["platformType", "scope"] as const) {
      if (typeof boundary[field] !== "string" || !boundary[field].trim()) {
        errors.push("configurationBoundary." + field + " must be non-empty");
      }
    }
    for (const field of [
      "includedSurfaces",
      "sourceRules",
      "windowRules",
      "ownershipRules",
    ] as const) {
      if (!Array.isArray(boundary[field]) || boundary[field].length === 0) {
        errors.push("configurationBoundary." + field + " must be non-empty");
      }
    }
  }

  if (!Array.isArray(record.dependencies) || record.dependencies.length === 0) {
    errors.push("dependencies must contain the complete dependency boundary");
  } else {
    const dependencyPaths = new Set<string>();
    for (const dependency of record.dependencies) {
      if (
        !dependency ||
        typeof dependency.path !== "string" ||
        !isSafeRelativePath(dependency.path)
      ) {
        errors.push("dependency paths must be safe, explicit, repository-relative paths");
        continue;
      }
      if (dependencyPaths.has(dependency.path)) {
        errors.push("duplicate dependency path " + dependency.path);
      }
      dependencyPaths.add(dependency.path);
      if (typeof dependency.role !== "string" || !dependency.role.trim()) {
        errors.push(dependency.path + ": dependency role is required");
      }
      if (!context.exists(dependency.path)) {
        errors.push(dependency.path + ": dependency does not exist");
        continue;
      }
      if (claimsReady) {
        if (!fileHashPattern.test(dependency.sha256 || "")) {
          errors.push(dependency.path + ": certified dependency hash is missing");
        } else if (context.sha256(dependency.path) !== dependency.sha256) {
          errors.push(dependency.path + ": changed since the certified dependency snapshot");
        }
      } else if (
        dependency.sha256 !== null &&
        !fileHashPattern.test(dependency.sha256)
      ) {
        errors.push(dependency.path + ": dependency hash must be null or SHA-256");
      }
    }

    if (!Array.isArray(record.statusDocuments) || record.statusDocuments.length === 0) {
      errors.push("statusDocuments must list the controlling KPI status documents");
    } else {
      const expectedMarker =
        "<!-- ga4-kpi-certification-status: " + record.status + " -->";
      for (const document of record.statusDocuments) {
        if (!document || !dependencyPaths.has(document.path)) {
          errors.push("status document must also be listed as a dependency");
          continue;
        }
        if (!context.exists(document.path)) {
          errors.push(document.path + ": status document does not exist");
          continue;
        }
        const scope = extractDocumentScope(
          context.readText(document.path),
          document,
          errors,
        );
        if (!scope.includes(expectedMarker)) {
          errors.push(
            document.path + ": status marker does not match record status " + record.status,
          );
        }
        if (!claimsReady && positiveGa4KpiClaim.test(scope)) {
          errors.push(
            document.path + ": claims GA4 KPI production readiness while record is UNVERIFIED",
          );
        }
      }
    }
  }

  validateEvidence("requiredTests", record.requiredTests, claimsReady, errors);
  validateEvidence("externalGates", record.externalGates, claimsReady, errors);

  return { ok: errors.length === 0, errors };
}

function repositoryContext(root: string): GateContext {
  const resolve = (path: string) => join(root, ...path.split("/"));
  const gitSucceeds = (args: string[]) =>
    spawnSync("git", args, { cwd: root, stdio: "ignore" }).status === 0;
  return {
    exists: (path) => existsSync(resolve(path)),
    readText: (path) => readFileSync(resolve(path), "utf8"),
    sha256: (path) =>
      createHash("sha256").update(readFileSync(resolve(path))).digest("hex"),
    gitCommitExists: (sha) => gitSucceeds(["cat-file", "-e", sha + "^{commit}"]),
    gitCommitIsAncestor: (sha) =>
      gitSucceeds(["merge-base", "--is-ancestor", sha, "HEAD"]),
    expectedContractSha256: GA4_KPI_CERTIFICATION_CONTRACT_SHA256,
  };
}

export function runGA4KpiCertificationGate(
  root = process.cwd(),
  recordPath = GA4_KPI_CERTIFICATION_RECORD,
): CertificationGateResult {
  const context = repositoryContext(root);
  if (!isSafeRelativePath(recordPath) || !context.exists(recordPath)) {
    return {
      ok: false,
      errors: [recordPath + ": certification record is missing"],
    };
  }

  try {
    const record = JSON.parse(context.readText(recordPath));
    return evaluateGA4KpiCertification(record, context);
  } catch (error) {
    return {
      ok: false,
      errors: [
        recordPath +
          ": invalid JSON: " +
          (error instanceof Error ? error.message : String(error)),
      ],
    };
  }
}

function main(): void {
  const result = runGA4KpiCertificationGate();
  if (!result.ok) {
    console.error("[GA4 KPI certification] FAILED");
    for (const error of result.errors) {
      console.error("- " + error);
    }
    process.exitCode = 1;
    return;
  }
  console.log("[GA4 KPI certification] PASS: current status is internally consistent.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
