// Isolated, read-only discovery. Generated configs contain hashes, never credentials.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { liveNumberConfigSchema, readOnlyMonitorDatabaseUrl } from "./check-live-numbers";
import { configSchema } from "./check-hosted-health";

export function resolveMonitorEnrollment(numberInput: unknown, healthInput: unknown, campaigns: Array<{
  campaignIdHash: string; reportingTimeZone: string; monitorFrom: string;
}>, now = new Date(), initialImportVerificationFailures: string[] = []) {
  const numbers = liveNumberConfigSchema.parse(numberInput), health = configSchema.parse(healthInput);
  if (!numbers.application || new URL(numbers.application.baseUrl).origin !== new URL(health.baseUrl).origin
    || numbers.application.expectedCommit !== health.expectedCommit) throw new Error("MONITOR_APPLICATION_IDENTITY_MISMATCH");
  if (campaigns.some(c => !Number.isFinite(Date.parse(c.monitorFrom)) || Date.parse(c.monitorFrom) > now.getTime())) throw new Error("MONITOR_ENROLLMENT_DATE_INVALID");
  return {
    numbers: liveNumberConfigSchema.parse({ ...numbers, enrollmentResolved: true,
      campaigns: campaigns.map(({ campaignIdHash, reportingTimeZone }) => ({ campaignIdHash, reportingTimeZone,
        ...(numbers.campaigns.find(c => c.campaignIdHash === campaignIdHash)?.historicalReports
          ? { historicalReports: numbers.campaigns.find(c => c.campaignIdHash === campaignIdHash)!.historicalReports } : {}) })) }),
    health: configSchema.parse({ ...health, enrollmentResolved: true, campaigns, initialImportVerificationFailures }),
  };
}

export async function discoverMonitorEnrollment(numberInput: unknown, healthInput: unknown) {
  const config = liveNumberConfigSchema.parse(numberInput);
  process.env.DATABASE_URL = readOnlyMonitorDatabaseUrl(process.env[config.databaseEnvironmentVariable] || "", config.databaseFingerprint);
  const { pool } = await import("../server/db");
  if (!pool) throw new Error("MONITOR_DATABASE_NOT_CONFIGURED");
  try {
    const guard = await pool.query("SELECT current_setting('default_transaction_read_only') AS read_only");
    if (guard.rows[0]?.read_only !== "on") throw new Error("MONITOR_READ_ONLY_GUARD_FAILED");
    const { storage } = await import("../server/storage");
    return resolveMonitorEnrollment(config, healthInput, await storage.getMonitorCampaigns(), new Date(), await storage.getInitialImportVerificationFailures());
  } finally { await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const deadline = setTimeout(() => { console.error("MONITOR_ENROLLMENT_TIMEOUT"); process.exit(1); }, 60_000).unref();
  try {
    if (process.argv.length !== 6) throw new Error("MONITOR_ENROLLMENT_ARGUMENTS");
    const result = await discoverMonitorEnrollment(JSON.parse(readFileSync(process.argv[2], "utf8")), JSON.parse(readFileSync(process.argv[3], "utf8")));
    writeFileSync(process.argv[4], JSON.stringify(result.numbers));
    writeFileSync(process.argv[5], JSON.stringify(result.health));
    console.log(JSON.stringify({ phase: "automatic_enrollment", status: "passed", origin: new URL(result.health.baseUrl).origin,
      campaigns: result.health.campaigns, readOnly: true }));
  } catch { console.error("MONITOR_AUTOMATIC_ENROLLMENT_FAILED"); process.exitCode = 1; }
  finally { clearTimeout(deadline); }
}
