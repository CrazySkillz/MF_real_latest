import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

export const GA4_REPORTS_CERTIFICATION_RECORD = "GA4/certifications/ga4-reports.json";
export const GA4_REPORTS_REQUIRED_DEPENDENCIES = [
  "AGENTS.md",
  "ARCHITECTURE_USER_JOURNEY.md",
  "PRODUCTION_READINESS.md",
  "GA4/README.md",
  "GA4/REPORTS.md",
  "GA4/REPORTS_PRODUCTION_READINESS.md",
  "GA4/REFRESH_AND_PROCESSING.md",
  "client/src/pages/ga4-metrics.tsx",
  "client/src/pages/reports.tsx",
  "client/src/lib/reportStorage.ts",
  "shared/schema.ts",
  "shared/ga4-financial-source.ts",
  "shared/ga4-kpi-consumer-state.ts",
  "server/routes-oauth.ts",
  "server/storage.ts",
  "server/report-scheduler.ts",
  "server/ga4-scheduled-report-pdf.ts",
  "server/ga4-kpi-benchmark-jobs.ts",
  "server/analytics.ts",
  "server/services/email-service.ts",
  "server/utils/mailgun-delivery.ts",
  "server/utils/reporting-timezone.ts",
  "server/report-email-regression.test.ts",
  "server/custom-report-regression.test.ts",
  "server/ga4-kpi-real-path-parity-regression.test.ts",
  "server/ga4-kpi-report-consumer-regression.test.ts",
  "server/ga4-insights-report-parity-regression.test.ts",
  "server/ga4-reports-certification-gate.ts",
  "server/ga4-reports-certification-gate.test.ts",
  "package.json",
  "render.yaml",
] as const;
export const GA4_REPORTS_REQUIRED_EXTERNAL_GATES = [
  "exact_sha_deployment",
  "upstream_section_certifications",
  "browser_server_pdf_value_parity",
  "report_crud_tenant_isolation",
  "deployed_scheduled_visibility",
  "scheduler_snapshot_truthfulness",
  "provider_confirmed_delivery",
  "recipient_inbox_receipt",
  "production_database_integrity",
  "dependency_hashes",
] as const;

type Context = {
  exists: (path: string) => boolean;
  readText: (path: string) => string;
  sha256: (path: string) => string;
  commitExists: (sha: string) => boolean;
  commitIsAncestor: (sha: string) => boolean;
};
export type GA4ReportsCertificationGateResult = { ok: boolean; errors: string[] };

const fullSha = /^[0-9a-f]{40}$/i;
const fileHash = /^[0-9a-f]{64}$/i;
const isObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isSafePath = (path: string) => {
  if (!path || isAbsolute(path) || path.includes("\\") || /[*?]/.test(path)) return false;
  const resolved = normalize(path).replace(/\\/g, "/");
  return resolved !== ".." && !resolved.startsWith("../");
};
export const hashGA4ReportsCertificationText = (value: string) =>
  createHash("sha256").update(value.replace(/\r\n?/g, "\n")).digest("hex");

const checkEvidence = (label: string, evidence: any, ready: boolean, errors: string[]) => {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    errors.push(`${label} must contain evidence`);
    return;
  }
  const ids = new Set<string>();
  for (const item of evidence) {
    if (!item || typeof item.id !== "string" || !item.id.trim()) {
      errors.push(`${label} contains an entry without an id`);
      continue;
    }
    if (ids.has(item.id)) errors.push(`${label} contains duplicate id ${item.id}`);
    ids.add(item.id);
    if (!["passed", "failed", "pending", "not_applicable"].includes(item.status)) {
      errors.push(`${label} ${item.id} has invalid status`);
    }
    if (typeof item.evidence !== "string" || !item.evidence.trim()) {
      errors.push(`${label} ${item.id} has no evidence`);
    }
    if (ready && !["passed", "not_applicable"].includes(item.status)) {
      errors.push(`${label} ${item.id} is ${item.status} while status claims ready`);
    }
  }
};

export function evaluateGA4ReportsCertification(
  value: unknown,
  context: Context,
): GA4ReportsCertificationGateResult {
  const errors: string[] = [];
  if (!isObject(value)) return { ok: false, errors: ["record must be a JSON object"] };
  if (value.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (value.sectionId !== "ga4-reports") errors.push("invalid sectionId");
  if (!["UNVERIFIED", "PRODUCTION_READY"].includes(value.status)) errors.push("invalid status");
  const ready = value.status === "PRODUCTION_READY";

  if (!fullSha.test(value.lastReviewedSha || "")) errors.push("lastReviewedSha must be a full Git SHA");
  else if (!context.commitExists(value.lastReviewedSha)) errors.push("lastReviewedSha is not a commit");
  else if (!context.commitIsAncestor(value.lastReviewedSha)) errors.push("lastReviewedSha is not an ancestor of HEAD");
  if (ready) {
    if (!fullSha.test(value.certifiedSha || "")) errors.push("certifiedSha must be a full Git SHA");
    if (value.certifiedSha !== value.lastReviewedSha) errors.push("certifiedSha must equal lastReviewedSha");
    if (value.deployedSha !== value.certifiedSha) errors.push("deployedSha must equal certifiedSha");
    if (value.invalidationReason !== null) errors.push("ready status requires null invalidationReason");
  } else {
    if (value.certifiedSha !== null || value.deployedSha !== null) errors.push("UNVERIFIED cannot carry certified/deployed SHAs");
    if (typeof value.invalidationReason !== "string" || !value.invalidationReason.trim()) {
      errors.push("UNVERIFIED requires invalidationReason");
    }
  }

  const boundary = value.configurationBoundary;
  if (!isObject(boundary)) errors.push("configurationBoundary must be an object");
  else {
    if (boundary.scope !== "GA4 Reports and Campaign DeepDive report surfaces") errors.push("invalid Reports scope");
    for (const field of ["includedSurfaces", "sourceRules", "windowRules", "ownershipRules", "deliveryRules", "excludedSurfaces"]) {
      if (!Array.isArray(boundary[field]) || boundary[field].length === 0) errors.push(`empty boundary ${field}`);
    }
  }

  const dependencies = Array.isArray(value.dependencies) ? value.dependencies : [];
  const byPath = new Map(dependencies.map((item: any) => [item?.path, item]));
  for (const required of GA4_REPORTS_REQUIRED_DEPENDENCIES) {
    if (!byPath.has(required)) errors.push(`missing required dependency ${required}`);
  }
  const seen = new Set<string>();
  for (const dependency of dependencies) {
    const path = dependency?.path;
    if (typeof path !== "string" || !isSafePath(path)) {
      errors.push("unsafe dependency path");
      continue;
    }
    if (seen.has(path)) errors.push(`duplicate dependency ${path}`);
    seen.add(path);
    if (!context.exists(path)) errors.push(`${path}: missing`);
    else if (ready && !fileHash.test(dependency.sha256 || "")) errors.push(`${path}: certified hash missing`);
    else if (ready && context.sha256(path) !== dependency.sha256) errors.push(`${path}: changed since certification`);
    else if (!ready && dependency.sha256 !== null && !fileHash.test(dependency.sha256 || "")) errors.push(`${path}: invalid hash`);
  }

  const doc = value.statusDocument;
  if (!doc || !byPath.has(doc.path) || !context.exists(doc.path)) errors.push("statusDocument must be an existing dependency");
  else {
    const content = context.readText(doc.path);
    const start = content.indexOf(doc.startMarker);
    const end = start < 0 ? -1 : content.indexOf(doc.endMarker, start + doc.startMarker.length);
    if (start < 0 || end < 0) errors.push("statusDocument markers are missing");
    else {
      const current = content.slice(start, end);
      if (!current.includes(`<!-- ga4-reports-certification-status: ${value.status} -->`)) errors.push("status marker does not match record");
      if (!ready && /GA4 Reports is (?:clean-certified|production-ready)/i.test(current)) errors.push("current status contradicts UNVERIFIED record");
    }
  }

  if (context.exists("package.json") && !context.readText("package.json").includes('"check:ga4-reports-certification"')) {
    errors.push("package.json is missing the Reports certification command");
  }
  checkEvidence("requiredTests", value.requiredTests, ready, errors);
  checkEvidence("externalGates", value.externalGates, ready, errors);
  const externalIds = new Set(Array.isArray(value.externalGates) ? value.externalGates.map((item: any) => item?.id) : []);
  for (const required of GA4_REPORTS_REQUIRED_EXTERNAL_GATES) {
    if (!externalIds.has(required)) errors.push(`missing required external gate ${required}`);
  }
  return { ok: errors.length === 0, errors };
}

function repositoryContext(root: string): Context {
  const resolve = (path: string) => join(root, ...path.split("/"));
  const gitOk = (args: string[]) => spawnSync("git", args, { cwd: root, stdio: "ignore" }).status === 0;
  return {
    exists: (path) => existsSync(resolve(path)),
    readText: (path) => readFileSync(resolve(path), "utf8"),
    sha256: (path) => hashGA4ReportsCertificationText(readFileSync(resolve(path), "utf8")),
    commitExists: (sha) => gitOk(["cat-file", "-e", `${sha}^{commit}`]),
    commitIsAncestor: (sha) => gitOk(["merge-base", "--is-ancestor", sha, "HEAD"]),
  };
}

export function runGA4ReportsCertificationGate(root = process.cwd()) {
  const context = repositoryContext(root);
  if (!context.exists(GA4_REPORTS_CERTIFICATION_RECORD)) {
    return { ok: false, errors: [`${GA4_REPORTS_CERTIFICATION_RECORD}: certification record is missing`] };
  }
  try {
    return evaluateGA4ReportsCertification(
      JSON.parse(context.readText(GA4_REPORTS_CERTIFICATION_RECORD)),
      context,
    );
  } catch (error) {
    return { ok: false, errors: [`invalid certification JSON: ${String(error)}`] };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runGA4ReportsCertificationGate();
  if (!result.ok) {
    console.error("[GA4 Reports certification] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("[GA4 Reports certification] PASS: current status is internally consistent.");
  }
}
