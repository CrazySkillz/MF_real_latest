import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

export const GA4_OVERVIEW_CERTIFICATION_RECORD =
  "GA4/certifications/ga4-overview.json";

export const GA4_OVERVIEW_REQUIRED_DEPENDENCIES = [
  "AGENTS.md",
  "ARCHITECTURE_USER_JOURNEY.md",
  "PRODUCTION_READINESS.md",
  "GA4_DEVELOPMENT_WORKFLOW.md",
  "GA4/README.md",
  "GA4/OVERVIEW.md",
  "GA4/OVERVIEW_PRODUCTION_READINESS.md",
  "GA4/OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md",
  "GA4/OVERVIEW_PRODUCTION_READINESS_HISTORY.md",
  "GA4/FINANCIAL_SOURCES.md",
  "GA4/REFRESH_AND_PROCESSING.md",
  "client/public/ga4-overview-validation-runner.js",
  "client/src/pages/ga4-metrics.tsx",
  "client/src/components/AddRevenueWizardModal.tsx",
  "client/src/components/AddSpendWizardModal.tsx",
  "client/src/components/HubSpotRevenueWizard.tsx",
  "client/src/components/ShopifyRevenueWizard.tsx",
  "shared/schema.ts",
  "shared/ga4-financial-source.ts",
  "server/routes-oauth.ts",
  "server/storage.ts",
  "server/analytics.ts",
  "server/ga4-daily-scheduler.ts",
  "server/auto-refresh-scheduler.ts",
  "server/ga4-kpi-benchmark-jobs.ts",
  "server/utils/reporting-timezone.ts",
  "server/utils/revenue-record-total.ts",
  "server/utils/hubspot-currency.ts",
  "server/utils/shopify-provider.ts",
  "server/utils/shopify-revenue.ts",
  "server/ga4-30-day-production-scope-regression.test.ts",
  "server/ga4-overview-initial-import-window-regression.test.ts",
  "server/ga4-daily-scheduler-regression.test.ts",
  "server/ga4-scheduler-observability-regression.test.ts",
  "server/ga4-filter.test.ts",
  "server/ga4-ui-regression.test.ts",
  "server/ga4-financial-rules.test.ts",
  "server/ga4-financial-source-parity.test.ts",
  "server/ga4-spend-scope-regression.test.ts",
  "server/overview-revenue-currency-total-regression.test.ts",
  "server/overview-revenue-materialization-regression.test.ts",
  "server/revenue-additivity.test.ts",
  "server/spend-source-additivity.test.ts",
  "server/ga4-primary-connection-scope-regression.test.ts",
  "server/ga4-reconnect-classification.test.ts",
  "server/ga4-reporting-day-cutoff-regression.test.ts",
  "server/ga4-overview-retained-source-reconciliation.test.ts",
  "server/ga4-source-lifecycle-recompute-regression.test.ts",
  "server/latest-day-revenue-regression.test.ts",
  "server/latest-day-spend-regression.test.ts",
  "server/campaign-current-value-financial-source-regression.test.ts",
  "server/outcome-totals-ga4-fallback-regression.test.ts",
  "server/performance-summary-scheduler-regression.test.ts",
  "server/trend-analysis-overview-regression.test.ts",
  "server/ga4-insights-report-parity-regression.test.ts",
  "server/hubspot-revenue-ga4-overview-regression.test.ts",
  "server/shopify-revenue-regression.test.ts",
  "server/google-sheets-revenue-validation.test.ts",
  "server/ga4-benchmark-safety-regression.test.ts",
  "server/ga4-benchmark-regression.test.ts",
  "server/campaign-scheduler-current-value-regression.test.ts",
  "server/ga4-kpi-custom-preservation-regression.test.ts",
  "server/ga4-kpi-financial-window-regression.test.ts",
  "server/ga4-kpi-reporting-window-regression.test.ts",
  "server/notification-visibility-regression.test.ts",
  "server/endpoint-auth-audit.test.ts",
  "server/ga4-overview-certification-gate.ts",
  "server/ga4-overview-certification-gate.test.ts",
  "package.json",
  "render.yaml",
] as const;

export const GA4_OVERVIEW_REQUIRED_TESTS = [
  "certification_integrity",
  "focused_overview_regressions",
  "affected_shared_dependencies",
  "typescript",
  "production_build",
] as const;

export const GA4_OVERVIEW_REQUIRED_EXTERNAL_GATES = [
  "exact_sha_deployment",
  "authenticated_ui_api_source_parity",
  "natural_daily_scheduler_target_persistence",
  "production_data_integrity",
] as const;

const GA4_OVERVIEW_REQUIRED_STATUS_DOCUMENTS = [
  "GA4/README.md",
  "GA4/OVERVIEW.md",
  "GA4/OVERVIEW_PRODUCTION_READINESS.md",
] as const;

type Context = {
  exists: (path: string) => boolean;
  readText: (path: string) => string;
  sha256: (path: string) => string;
  commitExists: (sha: string) => boolean;
  commitIsAncestor: (sha: string) => boolean;
};

export type GA4OverviewCertificationGateResult = {
  ok: boolean;
  errors: string[];
};

const fullSha = /^[0-9a-f]{40}$/i;
const fileHash = /^[0-9a-f]{64}$/i;
const isObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isSafePath = (path: string) => {
  if (
    !path ||
    isAbsolute(path) ||
    path.includes(String.fromCharCode(92)) ||
    /[*?]/.test(path)
  ) {
    return false;
  }
  const resolved = normalize(path).replace(/\\/g, "/");
  return resolved !== ".." && !resolved.startsWith("../");
};

export const hashGA4OverviewCertificationText = (value: string) =>
  createHash("sha256")
    .update(value.replace(/\r\n?/g, "\n"))
    .digest("hex");

function checkEvidence(
  label: string,
  evidence: any,
  requiredIds: readonly string[],
  ready: boolean,
  errors: string[],
) {
  if (!Array.isArray(evidence)) {
    errors.push(`${label} must be an array`);
    return;
  }
  const byId = new Map(evidence.map((item: any) => [item?.id, item]));
  for (const id of requiredIds) {
    if (!byId.has(id)) errors.push(`missing required ${label} entry ${id}`);
  }
  if (byId.size !== evidence.length) errors.push(`${label} contains duplicate ids`);
  if (evidence.length !== requiredIds.length) {
    errors.push(`${label} must contain the exact required inventory`);
  }
  for (const item of evidence) {
    if (!item || typeof item.id !== "string" || !item.id.trim()) {
      errors.push(`${label} contains an entry without an id`);
      continue;
    }
    if (!["passed", "failed", "pending", "not_applicable"].includes(item.status)) {
      errors.push(`${label} ${item.id} has invalid status`);
    }
    if (typeof item.evidence !== "string" || !item.evidence.trim()) {
      errors.push(`${label} ${item.id} has no evidence`);
    }
    if (ready && !["passed", "not_applicable"].includes(item.status)) {
      errors.push(
        `${label} ${item.id} is ${item.status} while status claims ready`,
      );
    }
  }
}

export function evaluateGA4OverviewCertification(
  value: unknown,
  context: Context,
): GA4OverviewCertificationGateResult {
  const errors: string[] = [];
  if (!isObject(value)) {
    return { ok: false, errors: ["record must be a JSON object"] };
  }
  if (value.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (value.sectionId !== "ga4-overview") errors.push("invalid sectionId");
  if (!["UNVERIFIED", "PRODUCTION_READY"].includes(value.status)) {
    errors.push("invalid status");
  }
  const ready = value.status === "PRODUCTION_READY";

  if (!fullSha.test(value.lastReviewedSha || "")) {
    errors.push("lastReviewedSha must be a full Git SHA");
  } else if (!context.commitExists(value.lastReviewedSha)) {
    errors.push("lastReviewedSha is not a commit");
  } else if (!context.commitIsAncestor(value.lastReviewedSha)) {
    errors.push("lastReviewedSha is not an ancestor of HEAD");
  }

  if (ready) {
    if (!fullSha.test(value.certifiedSha || "")) {
      errors.push("certifiedSha must be a full Git SHA");
    }
    if (value.certifiedSha !== value.lastReviewedSha) {
      errors.push("certifiedSha must equal lastReviewedSha");
    }
    if (value.deployedSha !== value.certifiedSha) {
      errors.push("deployedSha must equal certifiedSha");
    }
    if (value.invalidationReason !== null) {
      errors.push("ready status requires null invalidationReason");
    }
  } else {
    if (value.certifiedSha !== null) {
      errors.push("UNVERIFIED cannot carry a certified SHA");
    }
    if (typeof value.invalidationReason !== "string" || !value.invalidationReason.trim()) {
      errors.push("UNVERIFIED requires invalidationReason");
    }
  }
  if (
    value.deployedSha !== null &&
    !fullSha.test(value.deployedSha || "")
  ) {
    errors.push("deployedSha must be null or a full Git SHA");
  }

  const boundary = value.configurationBoundary;
  if (!isObject(boundary)) {
    errors.push("configurationBoundary must be an object");
  } else {
    if (boundary.platformType !== "google_analytics") {
      errors.push("invalid platformType");
    }
    for (const field of [
      "scope",
      "includedSurfaces",
      "sourceRules",
      "windowRules",
      "ownershipRules",
      "excludedSurfaces",
    ]) {
      const content = boundary[field];
      if (
        (field === "scope" && (typeof content !== "string" || !content.trim())) ||
        (field !== "scope" && (!Array.isArray(content) || content.length === 0))
      ) {
        errors.push(`empty boundary ${field}`);
      }
    }
  }

  const dependencies = Array.isArray(value.dependencies) ? value.dependencies : [];
  const byPath = new Map(dependencies.map((item: any) => [item?.path, item]));
  for (const required of GA4_OVERVIEW_REQUIRED_DEPENDENCIES) {
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
    else if (ready && !fileHash.test(dependency.sha256 || "")) {
      errors.push(`${path}: certified hash missing`);
    } else if (ready && context.sha256(path) !== dependency.sha256) {
      errors.push(`${path}: changed since certification`);
    } else if (
      !ready &&
      dependency.sha256 !== null &&
      !fileHash.test(dependency.sha256 || "")
    ) {
      errors.push(`${path}: invalid hash`);
    }
  }

  const documents = Array.isArray(value.statusDocuments)
    ? value.statusDocuments
    : [];
  const documentsByPath = new Map(
    documents.map((document: any) => [document?.path, document]),
  );
  for (const required of GA4_OVERVIEW_REQUIRED_STATUS_DOCUMENTS) {
    const document = documentsByPath.get(required);
    if (
      !document ||
      document.startMarker !== "<!-- ga4-overview-current-status -->" ||
      document.endMarker !== "<!-- /ga4-overview-current-status -->"
    ) {
      errors.push(`missing required status document ${required}`);
    }
  }
  for (const document of documents) {
    if (!document || !byPath.has(document.path) || !context.exists(document.path)) {
      errors.push("status document must be an existing dependency");
      continue;
    }
    const content = context.readText(document.path);
    const start = content.indexOf(document.startMarker);
    const end =
      start < 0
        ? -1
        : content.indexOf(
            document.endMarker,
            start + document.startMarker.length,
          );
    if (start < 0 || end < 0) {
      errors.push(`${document.path}: status markers are missing`);
      continue;
    }
    const current = content.slice(start, end);
    if (
      !current.includes(
        `<!-- ga4-overview-certification-status: ${value.status} -->`,
      )
    ) {
      errors.push(`${document.path}: status marker does not match record`);
    }
    if (
      !ready &&
      /GA4 Overview is (?:clean-certified|production-ready)/i.test(current)
    ) {
      errors.push(`${document.path}: current status contradicts UNVERIFIED record`);
    }
  }
  if (documents.length !== 3) {
    errors.push("exactly three Overview status documents are required");
  }

  if (
    context.exists("package.json") &&
    !context
      .readText("package.json")
      .includes('"check:ga4-overview-certification"')
  ) {
    errors.push("package.json is missing the Overview certification command");
  }
  checkEvidence(
    "requiredTests",
    value.requiredTests,
    GA4_OVERVIEW_REQUIRED_TESTS,
    ready,
    errors,
  );
  checkEvidence(
    "externalGates",
    value.externalGates,
    GA4_OVERVIEW_REQUIRED_EXTERNAL_GATES,
    ready,
    errors,
  );

  return { ok: errors.length === 0, errors };
}

function repositoryContext(root: string): Context {
  const resolve = (path: string) => join(root, ...path.split("/"));
  const gitOk = (args: string[]) =>
    spawnSync("git", args, { cwd: root, stdio: "ignore" }).status === 0;
  return {
    exists: (path) => existsSync(resolve(path)),
    readText: (path) => readFileSync(resolve(path), "utf8"),
    sha256: (path) =>
      hashGA4OverviewCertificationText(readFileSync(resolve(path), "utf8")),
    commitExists: (sha) => gitOk(["cat-file", "-e", `${sha}^{commit}`]),
    commitIsAncestor: (sha) =>
      gitOk(["merge-base", "--is-ancestor", sha, "HEAD"]),
  };
}

export function runGA4OverviewCertificationGate(root = process.cwd()) {
  const context = repositoryContext(root);
  if (!context.exists(GA4_OVERVIEW_CERTIFICATION_RECORD)) {
    return {
      ok: false,
      errors: [
        `${GA4_OVERVIEW_CERTIFICATION_RECORD}: certification record is missing`,
      ],
    };
  }
  try {
    return evaluateGA4OverviewCertification(
      JSON.parse(context.readText(GA4_OVERVIEW_CERTIFICATION_RECORD)),
      context,
    );
  } catch (error) {
    return {
      ok: false,
      errors: [`invalid certification JSON: ${String(error)}`],
    };
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = runGA4OverviewCertificationGate();
  if (!result.ok) {
    console.error("[GA4 Overview certification] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(
      "[GA4 Overview certification] PASS: current status is internally consistent.",
    );
  }
}
