// Lightweight coordinator: never imports db, storage, PDF or application code.
// A source process must exit before an output process is started.
import { readFileSync, writeSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { NumberCheck } from "../server/live-number-checks";

type Application = { baseUrl: string; expectedCommit: string };
const activeChildren = new Set<ReturnType<typeof spawn>>();
const unverified = (code: string): NumberCheck[] => [{ section: "Application outputs", code, status: "unverified" }];
export function validOutputChecks(value: unknown): value is NumberCheck[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 20000 && value.every(check => check && typeof check === "object"
    && Object.keys(check).every(key => ["section", "code", "status", "subject"].includes(key))
    && typeof check.section === "string" && check.section.length <= 100 && typeof check.code === "string" && check.code.length <= 100
    && ["passed", "difference", "unverified"].includes(check.status) && (check.subject === undefined || (typeof check.subject === "string" && /^[a-f0-9]{12}$/.test(check.subject))));
}
export async function checkApplicationOutputProcess(campaignHash: string, databaseFingerprint: string, fingerprint: string, application?: Application,
  environment: NodeJS.ProcessEnv = process.env): Promise<NumberCheck[]> {
  const revisionMatches = async () => {
    if (!application || !/^[a-f0-9]{40}$/.test(application.expectedCommit)) return false;
    try {
      const url = new URL(application.baseUrl);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) return false;
      const response = await fetch(new URL("/api/health", url), { method: "GET", redirect: "error", signal: AbortSignal.timeout(10_000) });
      const body = await response.json(); return response.ok && body.ok === true && body.commit === application.expectedCommit;
    } catch { return false; }
  };
  if (!await revisionMatches()) return unverified("DEPLOYED_APPLICATION_REVISION_UNVERIFIED");
  const checks: NumberCheck[] = await new Promise(resolve => {
    const child = spawn(process.execPath, ["--max-old-space-size=512", "--import", "tsx", "scripts/check-live-number-outputs.ts", campaignHash, databaseFingerprint, fingerprint],
      { stdio: ["ignore", "pipe", "ignore"], windowsHide: true, env: environment });
    activeChildren.add(child); child.once("close", () => activeChildren.delete(child)); child.once("error", () => activeChildren.delete(child));
    let output = "", tooLarge = false;
    const timer = setTimeout(() => child.kill(), 310_000).unref();
    child.stdout.on("data", chunk => { if (output.length + chunk.length > 2_000_000) { tooLarge = true; child.kill(); } else output += chunk; });
    child.once("error", () => { clearTimeout(timer); resolve(unverified("OUTPUT_PROCESS_UNVERIFIED")); });
    child.once("close", code => {
      clearTimeout(timer);
      try {
        const checks = JSON.parse(output);
        resolve(tooLarge || code !== 0 || !validOutputChecks(checks) ? unverified("OUTPUT_PROCESS_UNVERIFIED") : checks);
      } catch { resolve(unverified("OUTPUT_PROCESS_UNVERIFIED")); }
    });
  });
  return await revisionMatches() ? checks : unverified("DEPLOYED_APPLICATION_REVISION_CHANGED");
}

export async function runNumberMonitorPhases(configPath: string, scheduledOnly = false): Promise<number> {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  // The source CLI validates the complete config and database identity before it
  // can issue a fingerprint. Keep this process free of its large dependencies.
  const source = await new Promise<{ code: number; output: string }>(resolve => {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/check-live-numbers.ts", configPath, ...(scheduledOnly ? ["--scheduled"] : [])],
      { stdio: ["ignore", "pipe", "inherit"], windowsHide: true });
    activeChildren.add(child); child.once("close", () => activeChildren.delete(child)); child.once("error", () => activeChildren.delete(child));
    let output = "", tooLarge = false;
    const timer = setTimeout(() => child.kill(), 610_000).unref();
    child.stdout.on("data", chunk => {
      if (output.length + chunk.length > 2_000_000) { tooLarge = true; child.kill(); }
      else { output += chunk; writeSync(1, chunk); }
    });
    child.once("error", () => { clearTimeout(timer); resolve({ code: 1, output: "" }); });
    child.once("close", code => { clearTimeout(timer); resolve({ code: tooLarge ? 1 : code ?? 1, output: tooLarge ? "" : output }); });
  });
  let code = source.code === 0 ? 0 : 1;
  const records = source.output.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  if (!records.length) return 1;
  const environment = { ...process.env };
  environment.DATABASE_URL = environment[config.databaseEnvironmentVariable];
  if (config.credentialsEnvironmentPrefix) for (const key of ["TOKEN_ENCRYPTION_KEY", "ENCRYPTION_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GA4_SERVICE_ACCOUNT_JSON",
    "GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS", "GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON", "SERVICE_ACCOUNT_RESOURCE_GRANTS", "SHOPIFY_API_VERSION", "SALESFORCE_API_VERSION"]) {
    const value = environment[config.credentialsEnvironmentPrefix + key];
    if (value === undefined) delete environment[key]; else environment[key] = value;
  }
  for (const record of records) {
    if (record.status === "not_due") continue;
    const enrolled = config.campaigns?.some((campaign: any) => campaign.campaignIdHash === record.campaignIdHash);
    const checks = enrolled && /^[a-f0-9]{64}$/.test(record.inputFingerprint || "")
      ? await checkApplicationOutputProcess(record.campaignIdHash, config.databaseFingerprint, record.inputFingerprint, config.application, environment)
      : unverified("SOURCE_INPUT_FINGERPRINT_UNVERIFIED");
    const groups = new Map<string, NumberCheck & { count: number }>();
    for (const check of checks) {
      const item = check.status === "passed" ? { section: check.section, code: check.code, status: check.status } : check;
      const key = JSON.stringify(item); groups.set(key, { ...item, count: (groups.get(key)?.count || 0) + 1 });
    }
    const status = checks.some(check => check.status === "difference") ? "difference" : checks.some(check => check.status === "unverified") ? "unverified" : "passed";
    if (status !== "passed") code = 1;
    // Render truncates a log line at 64 KiB. Preserve every finding in bounded
    // chunks, aggregating passing row identities while retaining their count.
    const grouped = Array.from(groups.values()), parts = Math.ceil(grouped.length / 64);
    for (let part = 0; part < parts; part++) writeSync(1, JSON.stringify({ campaignIdHash: record.campaignIdHash, checkedAt: new Date().toISOString(), phase: "application_outputs", status,
      part: part + 1, parts, checks: grouped.slice(part * 64, (part + 1) * 64), scope: "Actual handler and generated PDF comparisons; unverified paths are not passing." }) + "\n");
  }
  return code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const deadline = setTimeout(() => {
    for (const child of activeChildren) child.kill();
    writeSync(1, JSON.stringify({ status: "unverified", code: "MONITOR_PHASE_DEADLINE_EXCEEDED" }) + "\n"); process.exit(1);
  }, 18 * 60_000).unref();
  try {
    if (process.argv.length !== 3 && !(process.argv.length === 4 && process.argv[3] === "--scheduled")) throw new Error();
    process.exitCode = await runNumberMonitorPhases(process.argv[2], process.argv[3] === "--scheduled");
  } catch { writeSync(1, JSON.stringify({ status: "unverified", code: "MONITOR_PHASE_COORDINATION_UNVERIFIED" }) + "\n"); process.exitCode = 1; }
  finally { clearTimeout(deadline); }
}
