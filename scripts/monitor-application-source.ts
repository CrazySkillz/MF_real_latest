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
function revision(root: string): Revision {
  const value = JSON.parse(readFileSync(join(root, "scripts/monitor-conversion-parity.json"), "utf8"));
  if (!/^[a-f0-9]{40}$/.test(value.expectedCommit) || value.files?.length !== paths.length
    || (value.equivalentCommits !== undefined && (!Array.isArray(value.equivalentCommits) || value.equivalentCommits.some((commit: unknown) => typeof commit !== "string" || !/^[a-f0-9]{40}$/.test(commit))))
    || paths.some(path => value.files.filter((file: any) => file.path === path && /^[a-f0-9]{64}$/.test(file.before) && /^[a-f0-9]{64}$/.test(file.after)).length !== 1)) throw new Error("MONITOR_SOURCE_MANIFEST_INVALID");
  return value;
}
export function monitorApplicationDirectory(application: { expectedCommit: string; comparisonRateDefinition?: string }, root = process.cwd()): string {
  if (application.comparisonRateDefinition === undefined) return root;
  const pinned = revision(root), directory = join(root, ".monitor-applications", pinned.expectedCommit);
  if (application.comparisonRateDefinition !== "conversions_per_session" || ![pinned.expectedCommit, ...(pinned.equivalentCommits || [])].includes(application.expectedCommit)
    || pinned.files.some(file => digest(join(directory, file.path)) !== file.after)) throw new Error("MONITOR_APPLICATION_SOURCE_UNVERIFIED");
  return directory;
}
export function prepareMonitorApplication(root = process.cwd()): string {
  const pinned = revision(root), directory = join(root, ".monitor-applications", pinned.expectedCommit);
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
  execFileSync("git", ["apply", "--no-index", "--whitespace=nowarn", join(root, "scripts/monitor-conversion-parity.patch")],
    { cwd: directory, env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(directory) }, windowsHide: true, stdio: "pipe" });
  return monitorApplicationDirectory({ expectedCommit: pinned.expectedCommit, comparisonRateDefinition: "conversions_per_session" }, root);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  prepareMonitorApplication();
  console.log("Pinned test application replay source verified");
}
