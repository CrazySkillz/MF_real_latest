import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

export type DeferredTestGroup =
  | "future-platforms"
  | "google-ads"
  | "ga4-ad-comparison"
  | "external-certifications";

export type DeferredTest = {
  group: DeferredTestGroup;
  file: string;
  fullName: string;
};

export type CurrentVersionTestManifest = {
  schemaVersion: number;
  scope: string;
  groups: Record<DeferredTestGroup, { blocking: false; reason: string }>;
  tests: DeferredTest[];
};

type AssertionResult = {
  fullName: string;
  status: string;
};

type TestFileResult = {
  name: string;
  status?: string;
  message?: string;
  assertionResults: AssertionResult[];
};

export type VitestJsonResult = {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  testResults: TestFileResult[];
  unhandledErrors?: string[];
  shardFiles?: string[];
};

type ShardReceipt = {
  shard: string;
  commit: string;
  run: string;
  attempt: string;
  files: string[];
  tests: number;
};

export function validateShardReceipts(
  receipts: ShardReceipt[], expectedFiles: string[],
  context: { count: number; commit: string; run: string; attempt: string; deferredFiles: string[] },
): void {
  if (!Number.isInteger(context.count) || context.count < 2 || !context.commit || !context.run || !context.attempt
    || !/^[1-9]\d*$/.test(context.attempt) || !Number.isSafeInteger(Number(context.attempt))
    || receipts.length !== context.count || expectedFiles.length === 0) throw new Error("Missing shard results or run identity.");
  const shards = new Set<string>(), files = new Set<string>();
  for (const receipt of receipts) {
    const [index, count] = String(receipt.shard).split("/").map(Number);
    const attempt = Number(receipt.attempt);
    if (receipt.shard !== `${index}/${count}` || !Number.isInteger(index) || index < 1 || index > context.count
      || count !== context.count || shards.has(receipt.shard) || receipt.commit !== context.commit
      || receipt.run !== context.run || !Number.isInteger(attempt) || attempt < 1 || String(attempt) !== receipt.attempt
      || attempt > Number(context.attempt) || !Array.isArray(receipt.files)
      || !receipt.files.length || !Number.isInteger(receipt.tests) || receipt.tests < 1) throw new Error("Invalid or duplicate shard result.");
    shards.add(receipt.shard);
    for (const file of receipt.files) {
      if (typeof file !== "string" || files.has(file)) throw new Error("Test file executed by multiple shards.");
      files.add(file);
    }
  }
  if (files.size !== expectedFiles.length || expectedFiles.some(file => !files.has(file))) {
    throw new Error("Shard coverage differs from the full test-file inventory.");
  }
  if (context.deferredFiles.some(file => !files.has(file))) throw new Error("Stale deferred test-file inventory.");
}

type LocatedAssertion = AssertionResult & { file: string };

export type CurrentVersionClassification = {
  currentFailures: LocatedAssertion[];
  deferredResults: LocatedAssertion[];
  missingDeferred: DeferredTest[];
};

const MANIFEST_PATH = "scripts/ga4-kpi-current-version-test-boundary.json";
const EXPECTED_GROUP_COUNTS: Record<DeferredTestGroup, number> = {
  "future-platforms": 21,
  "google-ads": 20,
  "ga4-ad-comparison": 1,
  "external-certifications": 3,
};

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function testIdentity(file: string, fullName: string): string {
  return normalizePath(file) + "\u0000" + fullName;
}

function repositoryRelativeFile(root: string, file: string): string {
  const relativeFile = normalizePath(relative(root, file));
  if (!relativeFile.startsWith("../") && relativeFile !== "..") {
    return relativeFile;
  }
  const normalized = normalizePath(file);
  const serverIndex = normalized.lastIndexOf("/server/");
  return serverIndex >= 0 ? normalized.slice(serverIndex + 1) : normalized;
}

export function readCurrentVersionManifest(
  root = process.cwd(),
): CurrentVersionTestManifest {
  const manifest = JSON.parse(
    readFileSync(resolve(root, MANIFEST_PATH), "utf8"),
  ) as CurrentVersionTestManifest;

  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.tests)) {
    throw new Error("Current-version test manifest is malformed.");
  }

  const identities = new Set<string>();
  const counts: Record<DeferredTestGroup, number> = {
    "future-platforms": 0,
    "google-ads": 0,
    "ga4-ad-comparison": 0,
    "external-certifications": 0,
  };
  for (const test of manifest.tests) {
    if (!Object.hasOwn(EXPECTED_GROUP_COUNTS, test.group)) {
      throw new Error("Unknown deferred test group: " + String(test.group));
    }
    if (!test.file.startsWith("server/") || !test.fullName.trim()) {
      throw new Error("Deferred test entries require a server file and full test name.");
    }
    const identity = testIdentity(test.file, test.fullName);
    if (identities.has(identity)) {
      throw new Error("Duplicate deferred test identity: " + test.fullName);
    }
    identities.add(identity);
    counts[test.group] += 1;
  }

  for (const [group, expected] of Object.entries(EXPECTED_GROUP_COUNTS)) {
    if (counts[group as DeferredTestGroup] !== expected) {
      throw new Error(
        `${group} must contain exactly ${expected} deferred tests; found ${counts[group as DeferredTestGroup]}.`,
      );
    }
    if (manifest.groups[group as DeferredTestGroup]?.blocking !== false) {
      throw new Error(group + " must remain explicitly non-blocking.");
    }
  }

  return manifest;
}

export function classifyCurrentVersionResults(
  report: VitestJsonResult,
  manifest: CurrentVersionTestManifest,
  root = process.cwd(),
): CurrentVersionClassification {
  const deferredByIdentity = new Map(
    manifest.tests.map((test) => [testIdentity(test.file, test.fullName), test]),
  );
  const observedDeferred = new Set<string>();
  const currentFailures: LocatedAssertion[] = [];
  const deferredResults: LocatedAssertion[] = [];

  for (const fileResult of report.testResults ?? []) {
    const file = repositoryRelativeFile(root, fileResult.name);
    for (const assertion of fileResult.assertionResults ?? []) {
      const identity = testIdentity(file, assertion.fullName);
      if (deferredByIdentity.has(identity)) {
        deferredResults.push({ ...assertion, file });
        if (assertion.status === "passed" || assertion.status === "failed") {
          observedDeferred.add(identity);
        }
      } else if (assertion.status !== "passed") {
        currentFailures.push({ ...assertion, file });
      }
    }
  }

  return {
    currentFailures,
    deferredResults,
    missingDeferred: manifest.tests.filter(
      (test) => !observedDeferred.has(testIdentity(test.file, test.fullName)),
    ),
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function listTestFiles(root: string): string[] {
  const directory = mkdtempSync(join(tmpdir(), "ga4-test-inventory-"));
  try {
    const output = join(directory, "files.json");
    const result = spawnSync(process.execPath, [resolve(root, "node_modules/vitest/vitest.mjs"), "list", "--filesOnly",
      `--json=${output}`], { cwd: root, stdio: "inherit", shell: false });
    if (result.error || result.status !== 0) throw result.error || new Error("Test-file discovery failed.");
    const entries = JSON.parse(readFileSync(output, "utf8"));
    if (!Array.isArray(entries) || !entries.length || entries.some(entry => typeof entry.file !== "string")) throw new Error("Invalid test-file inventory.");
    const files = entries.map(entry => repositoryRelativeFile(root, entry.file));
    if (new Set(files).size !== files.length) throw new Error("Duplicate test-file inventory.");
    return files;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function runVitest(
  root: string,
  selectedTests: DeferredTest[] | null,
): { report: VitestJsonResult; status: number | null } {
  const tempDirectory = mkdtempSync(join(tmpdir(), "ga4-kpi-test-boundary-"));
  const outputFile = join(tempDirectory, "vitest.json");
  const errorFile = join(tempDirectory, "run-errors.json");
  const vitestCli = resolve(root, "node_modules/vitest/vitest.mjs");
  const shard = process.env.CURRENT_VERSION_TEST_SHARD;
  if (shard && (!/^[1-9]\d*\/[1-9]\d*$/.test(shard) || Number(shard.split("/")[0]) > Number(shard.split("/")[1]) || selectedTests)) {
    throw new Error("Invalid current-version shard.");
  }
  const args = [
    vitestCli,
    "run",
    "--pool",
    "forks",
    "--maxWorkers=2",
    "--reporter=default",
    "--reporter=json",
    `--reporter=${resolve(root, "scripts/ga4-test-run-errors.cjs")}`,
    `--outputFile=${outputFile}`,
  ];
  if (shard) args.push(`--shard=${shard}`);

  if (selectedTests) {
    const files = [...new Set(selectedTests.map((test) => test.file))];
    const names = selectedTests.map((test) => escapeRegex(test.fullName));
    args.push(...files, "--testNamePattern", `^(?:${names.join("|")})$`);
  }

  try {
    const result = spawnSync(process.execPath, args, {
      cwd: root,
      env: { ...process.env, CURRENT_VERSION_TEST_ERRORS_FILE: errorFile },
      stdio: "inherit",
      shell: false,
    });
    if (result.error) {
      throw result.error;
    }
    const report = JSON.parse(readFileSync(outputFile, "utf8")) as VitestJsonResult;
    const runErrors = JSON.parse(readFileSync(errorFile, "utf8"));
    if (!Array.isArray(runErrors.errors) || !["passed", "failed", "interrupted"].includes(runErrors.reason)) throw new Error("Incomplete test-run error receipt.");
    report.unhandledErrors = [...runErrors.errors, ...(runErrors.reason === "interrupted" ? ["Test run interrupted"] : [])];
    if (shard) {
      const actualFiles = report.testResults.map(file => repositoryRelativeFile(root, file.name));
      if (!actualFiles.length || new Set(actualFiles).size !== actualFiles.length) throw new Error("Invalid shard test-file execution.");
      report.shardFiles = actualFiles;
    }
    return { report, status: result.status };
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

function printFailures(label: string, failures: LocatedAssertion[]): void {
  console.log(`${label}: ${failures.length}`);
  for (const failure of failures) {
    console.log(`- ${failure.file}: ${failure.fullName}`);
  }
}

function runCurrentVersion(root: string, manifest: CurrentVersionTestManifest): number {
  const { report, status } = runVitest(root, null);
  if (report.shardFiles) manifest = { ...manifest, tests: manifest.tests.filter(test => report.shardFiles!.includes(test.file)) };
  const classification = classifyCurrentVersionResults(report, manifest, root);
  const deferredFailures = classification.deferredResults.filter(
    (result) => result.status === "failed",
  );

  console.log("[current-version] Full test execution completed.");
  console.log(
    `[current-version] Total ${report.numTotalTests}; passed ${report.numPassedTests}; failed ${report.numFailedTests}.`,
  );
  printFailures("[current-version] Blocking current-version failures", classification.currentFailures);
  printFailures("[current-version] Visible non-blocking deferred failures", deferredFailures);
  if (classification.missingDeferred.length > 0) {
    console.error(
      `[current-version] Stale boundary: ${classification.missingDeferred.length} deferred test identities were not executed.`,
    );
  }

  const incompleteRun = ![0, 1].includes(status ?? -1) || (status !== 0 && report.numFailedTests === 0)
    || Boolean(report.unhandledErrors?.length) || report.numTotalTests === 0
    || report.testResults.some(file => Boolean(file.message) || (file.status === "failed" && !file.assertionResults.some(test => test.status === "failed")));
  if (incompleteRun) console.error("[current-version] Test run failed to complete cleanly; release gate blocked.");
  const passed = !incompleteRun && classification.currentFailures.length === 0 &&
    classification.missingDeferred.length === 0;
  if (passed && report.shardFiles) {
    const directory = resolve(root, ".ci-test-results");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, `shard-${process.env.CURRENT_VERSION_TEST_SHARD!.replace("/", "-")}.json`), JSON.stringify({
      shard: process.env.CURRENT_VERSION_TEST_SHARD, commit: process.env.GITHUB_SHA,
      run: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT,
      files: report.shardFiles, tests: report.numTotalTests,
    }), { flag: "wx" });
  }
  return passed ? 0 : 1;
}

function runDeferred(
  root: string,
  manifest: CurrentVersionTestManifest,
  group?: DeferredTestGroup,
): number {
  const selectedTests = group
    ? manifest.tests.filter((test) => test.group === group)
    : manifest.tests;
  const { report, status } = runVitest(root, selectedTests);
  const classification = classifyCurrentVersionResults(report, manifest, root);
  const selectedIdentities = new Set(
    selectedTests.map((test) => testIdentity(test.file, test.fullName)),
  );
  const observed = classification.deferredResults.filter(
    (test) =>
      selectedIdentities.has(testIdentity(test.file, test.fullName)) &&
      (test.status === "passed" || test.status === "failed"),
  );
  const observedIdentities = new Set(
    observed.map((test) => testIdentity(test.file, test.fullName)),
  );
  const missing = selectedTests.filter(
    (test) => !observedIdentities.has(testIdentity(test.file, test.fullName)),
  );
  const failed = observed.filter((test) => test.status === "failed");

  console.log(`[deferred:${group ?? "all"}] Executed ${observed.length}/${selectedTests.length} retained tests.`);
  printFailures(`[deferred:${group ?? "all"}] Failures remain unverified`, failed);
  if (missing.length > 0) {
    console.error(`[deferred:${group ?? "all"}] Missing test identities: ${missing.length}.`);
  }

  return status === 0 && failed.length === 0 && missing.length === 0 ? 0 : 1;
}

function main(): void {
  const root = process.cwd();
  const manifest = readCurrentVersionManifest(root);
  const mode = process.argv[2] ?? "current";
  if (mode === "verify-shards") {
    const directory = resolve(root, ".ci-test-results");
    const receipts = readdirSync(directory).filter(file => file.endsWith(".json")).map(file => JSON.parse(readFileSync(join(directory, file), "utf8")));
    const files = listTestFiles(root);
    validateShardReceipts(receipts, files, { count: Number(process.env.CURRENT_VERSION_TEST_SHARD_COUNT),
      commit: process.env.GITHUB_SHA || "", run: process.env.GITHUB_RUN_ID || "", attempt: process.env.GITHUB_RUN_ATTEMPT || "",
      deferredFiles: manifest.tests.map(test => test.file) });
    console.log(`[current-version] Verified ${receipts.length} isolated shards, ${files.length} files, ${receipts.reduce((sum, receipt) => sum + receipt.tests, 0)} tests; no missing or duplicate files.`);
    return;
  }
  if (mode === "current") {
    process.exitCode = runCurrentVersion(root, manifest);
    return;
  }
  if (mode === "deferred") {
    const group = process.argv[3] as DeferredTestGroup | undefined;
    if (group && !Object.hasOwn(manifest.groups, group)) {
      throw new Error("Unknown deferred group: " + group);
    }
    process.exitCode = runDeferred(root, manifest, group);
    return;
  }
  throw new Error("Usage: current | deferred [future-platforms|google-ads|ga4-ad-comparison]");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
