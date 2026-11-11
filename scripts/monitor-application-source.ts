// Operator-only replay preparation. The production services and databases are untouched.
// The small patch is taken from the pinned test release; hashes require exact source.
import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type Revision = { expectedCommit: string; equivalentCommits?: string[]; files: { path: string; before: string; after: string }[] };
const digest = (path: string) => createHash("sha256").update(readFileSync(path, "utf8").replaceAll("\r\n", "\n")).digest("hex");
const paths = ["client/src/pages/ga4-metrics.tsx", "client/src/pages/ga4-ad-comparison.tsx", "server/ga4-scheduled-report-pdf.ts"];
function revision(root: string, distinctUsers = false, currentDay = false, variant = ""): Revision {
  const value = JSON.parse(readFileSync(join(root, currentDay ? `scripts/monitor-current-day${variant}.json` : distinctUsers ? "scripts/monitor-distinct-users.json" : "scripts/monitor-conversion-parity.json"), "utf8"));
  if (!/^[a-f0-9]{40}$/.test(value.expectedCommit) || !Array.isArray(value.files)
    || (distinctUsers ? value.files.length < paths.length || value.files.length > 60 : value.files.length !== paths.length)
    || new Set(value.files.map((file: any) => file.path)).size !== value.files.length
    || value.files.some((file: any) => !/^(client\/src|server|shared)\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.tsx?$/.test(file.path) || !/^[a-f0-9]{64}$/.test(file.before) || !/^[a-f0-9]{64}$/.test(file.after))
    || (value.equivalentCommits !== undefined && (!Array.isArray(value.equivalentCommits) || value.equivalentCommits.some((commit: unknown) => typeof commit !== "string" || !/^[a-f0-9]{40}$/.test(commit))))
    || paths.some(path => value.files.filter((file: any) => file.path === path && /^[a-f0-9]{64}$/.test(file.before) && /^[a-f0-9]{64}$/.test(file.after)).length !== 1)) throw new Error("MONITOR_SOURCE_MANIFEST_INVALID");
  return value;
}
export function monitorApplicationDirectory(application: { expectedCommit: string; comparisonRateDefinition?: string; usersDefinition?: string; reportingMode?: string }, root = process.cwd()): string {
  if (application.reportingMode !== undefined && !["completed_days", "current_day"].includes(application.reportingMode)) throw new Error("MONITOR_APPLICATION_SOURCE_UNVERIFIED");
  if (application.reportingMode === "current_day" && !application.usersDefinition) throw new Error("MONITOR_APPLICATION_SOURCE_UNVERIFIED");
  if (application.usersDefinition !== undefined && application.usersDefinition !== "ga4_totalUsers_distinct_v1") throw new Error("MONITOR_APPLICATION_SOURCE_UNVERIFIED");
  if (application.usersDefinition && application.comparisonRateDefinition === undefined) throw new Error("MONITOR_APPLICATION_SOURCE_UNVERIFIED");
  if (application.comparisonRateDefinition === undefined) return root;
  const editPath = join(root, "scripts/monitor-current-day-revenue-source-edit.json");
  const sourceEdit = application.reportingMode === "current_day" && existsSync(editPath)
    && revision(root, true, true, "-revenue-source-edit").expectedCommit === application.expectedCommit;
  const wordingPath = join(root, "scripts/monitor-current-day-revenue-wording.json");
  const wording = application.reportingMode === "current_day" && existsSync(wordingPath)
    && (() => { const value = revision(root, true, true, "-revenue-wording"); return [value.expectedCommit, ...(value.equivalentCommits || [])].includes(application.expectedCommit); })();
  const pinned = revision(root, !!application.usersDefinition, application.reportingMode === "current_day", sourceEdit ? "-revenue-source-edit" : wording ? "-revenue-wording" : ""), directory = join(root, ".monitor-applications", pinned.expectedCommit);
  if (application.comparisonRateDefinition !== "conversions_per_session" || ![pinned.expectedCommit, ...(pinned.equivalentCommits || [])].includes(application.expectedCommit)
    || pinned.files.some(file => digest(join(directory, file.path)) !== file.after)) throw new Error("MONITOR_APPLICATION_SOURCE_UNVERIFIED");
  return directory;
}
export function prepareMonitorApplication(root = process.cwd(), distinctUsers = false, currentDay = false, variant = ""): string {
  const pinned = revision(root, distinctUsers, currentDay, variant), directory = join(root, ".monitor-applications", pinned.expectedCommit);
  if (pinned.files.some(file => digest(join(root, file.path)) !== file.before)) throw new Error("MONITOR_SOURCE_BASE_CHANGED");
  mkdirSync(directory, { recursive: true });
  for (const name of ["client", "server", "shared", "scripts"]) cpSync(join(root, name), join(directory, name), { recursive: true, filter: source => !/\.test\.[jt]sx?$/.test(source) });
  for (const name of ["package.json", "tsconfig.json", "tailwind.config.ts", "postcss.config.js"]) {
    if (existsSync(join(root, name))) cpSync(join(root, name), join(directory, name));
  }
  for (const name of ["node_modules", "attached_assets"]) {
    if (existsSync(join(root, name)) && !existsSync(join(directory, name))) symlinkSync(join(root, name), join(directory, name), process.platform === "win32" ? "junction" : "dir");
  }
  for (const file of pinned.files) {
    const path = join(directory, file.path);
    writeFileSync(path, readFileSync(path, "utf8").replaceAll("\r\n", "\n"));
  }
  execFileSync("git", ["apply", "--no-index", "--whitespace=nowarn", "-"],
    { cwd: directory, env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(directory) }, windowsHide: true, stdio: "pipe",
      input: readFileSync(join(root, currentDay ? `scripts/monitor-current-day${variant}.patch` : distinctUsers ? "scripts/monitor-distinct-users.patch" : "scripts/monitor-conversion-parity.patch"), "utf8").replaceAll("\r\n", "\n") });
  return monitorApplicationDirectory({ expectedCommit: pinned.expectedCommit, comparisonRateDefinition: "conversions_per_session", ...(distinctUsers ? { usersDefinition: "ga4_totalUsers_distinct_v1" } : {}), ...(currentDay ? { reportingMode: "current_day" } : {}) }, root);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  prepareMonitorApplication();
  if (existsSync("scripts/monitor-distinct-users.json")) prepareMonitorApplication(process.cwd(), true);
  if (existsSync("scripts/monitor-current-day.json")) prepareMonitorApplication(process.cwd(), true, true);
  if (existsSync("scripts/monitor-current-day-revenue-wording.json")) prepareMonitorApplication(process.cwd(), true, true, "-revenue-wording");
  if (existsSync("scripts/monitor-current-day-revenue-source-edit.json")) prepareMonitorApplication(process.cwd(), true, true, "-revenue-source-edit");
  console.log("Pinned test application replay source verified");
}
