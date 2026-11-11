// Standalone operator monitor. Do not import application startup or schedule it in a request handler.
import { readFileSync, writeSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { checkStoredNumbers, snapshotFingerprint, summarizeNumberChecks, type NumberCheck } from "../server/live-number-checks";
import { normalizeReportingTimeZone } from "../server/utils/reporting-timezone";

const outputApplicationSchema = z.object({
  baseUrl: z.string().url().refine(value => { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && ["", "/"].includes(url.pathname); }),
  expectedCommit: z.string().regex(/^[a-f0-9]{40}$/),
  comparisonRateDefinition: z.literal("conversions_per_session").optional(),
  usersDefinition: z.literal("ga4_totalUsers_distinct_v1").optional(),
  reportingMode: z.enum(["completed_days", "current_day"]).optional(),
}).strict();

export const liveNumberConfigSchema = z.object({
  databaseEnvironmentVariable: z.string().regex(/^[A-Z][A-Z0-9_]+$/),
  databaseFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  credentialsEnvironmentPrefix: z.string().regex(/^[A-Z][A-Z0-9_]*_$/).optional(),
  application: outputApplicationSchema.optional(),
  enrollmentResolved: z.literal(true).optional(),
  campaigns: z.array(z.object({ campaignIdHash: z.string().regex(/^[a-f0-9]{12}$/),
    historicalReports: z.array(z.object({ snapshotHash: z.string().regex(/^[a-f0-9]{12}$/), payloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
      replacementHash: z.string().regex(/^[a-f0-9]{12}$/), replacementPdfSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).max(100)
      .refine(rows => new Set(rows.map(row => row.snapshotHash)).size === rows.length).optional(),
    reportingTimeZone: z.string().min(1).refine(value => normalizeReportingTimeZone(value) === value) }).strict()).max(100)
    .refine(rows => new Set(rows.map(row => row.campaignIdHash)).size === rows.length),
}).strict().refine(config => config.campaigns.length > 0 || config.enrollmentResolved === true);

export function liveNumberCheckIsDue(timeZone: string, now = new Date()): boolean {
  if (normalizeReportingTimeZone(timeZone) !== timeZone) return false;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find(part => part.type === "hour")?.value), minute = Number(parts.find(part => part.type === "minute")?.value);
  return [8, 14, 20].includes(hour) && minute >= 20 && minute < 30;
}

export function readOnlyMonitorDatabaseUrl(raw: string, expectedFingerprint: string): string {
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("MONITOR_DATABASE_INVALID");
  const fingerprint = createHash("sha256").update(JSON.stringify([url.hostname, url.port || "5432", url.pathname])).digest("hex");
  if (fingerprint !== expectedFingerprint) throw new Error("MONITOR_DATABASE_IDENTITY_MISMATCH");
  url.searchParams.set("options", "-c default_transaction_read_only=on -c statement_timeout=30000 -c lock_timeout=3000");
  return url.toString();
}

export function readOnlyMonitorFetch(request: typeof fetch): typeof fetch {
  let requests = 0;
  return async (input, options = {}) => {
    if (++requests > 300) throw new Error("MONITOR_PROVIDER_REQUEST_LIMIT");
    if (input instanceof Request) throw new Error("MONITOR_REQUEST_UNVERIFIED");
    const url = new URL(String(input)), method = String(options.method || "GET").toUpperCase();
    const host = url.hostname, path = url.pathname;
    let allowed = method === "GET" && ((host === "sheets.googleapis.com" && path.startsWith("/v4/spreadsheets/"))
      || (host === "api.hubapi.com" && path === "/account-info/v3/details")
      || (/\.(salesforce\.com|force\.com)$/.test(host) && /^\/services\/data\/v\d+\.\d+\/query(?:\/|$)/.test(path))
      || (/^[a-z0-9-]+\.myshopify\.com$/.test(host) && (path === "/admin/oauth/access_scopes.json" || /^\/admin\/api\/\d{4}-\d{2}\/orders.json$/.test(path))));
    if (method === "POST") {
      allowed = (host === "analyticsdata.googleapis.com" && /^\/v1beta\/properties\/\d+:runReport$/.test(path))
        || (host === "api.hubapi.com" && path === "/crm/v3/objects/deals/search")
        || (host === "oauth2.googleapis.com" && path === "/token" && new URLSearchParams(String(options.body)).get("grant_type") === "refresh_token");
      if (host === "iamcredentials.googleapis.com" && /^\/v1\/projects\/-\/serviceAccounts\/\d+:generateAccessToken$/.test(path)) {
        try {
          allowed = z.object({ scope: z.tuple([z.enum(["https://www.googleapis.com/auth/analytics.readonly", "https://www.googleapis.com/auth/adwords", "https://www.googleapis.com/auth/spreadsheets.readonly"])]),
            lifetime: z.literal("3600s") }).strict().safeParse(JSON.parse(String(options.body))).success;
        } catch { allowed = false; }
      }
      if (host === "googleads.googleapis.com" && /^\/v25\/customers\/\d{10}\/googleAds:searchStream$/.test(path)) {
        try {
          const body = JSON.parse(String(options.body));
          allowed = Object.keys(body).length === 1 && typeof body.query === "string"
            && (body.query === "SELECT customer.id, customer.manager, customer.currency_code, customer.time_zone FROM customer LIMIT 1"
              || /^SELECT campaign\.id, segments\.date, metrics\.cost_micros FROM campaign WHERE segments\.date BETWEEN '\d{4}-\d{2}-\d{2}' AND '\d{4}-\d{2}-\d{2}' AND campaign\.status != 'REMOVED' AND campaign\.id IN \(\d+(?:, \d+)*\) ORDER BY segments\.date$/.test(body.query));
        } catch { allowed = false; }
      }
      if (/\.(salesforce\.com|force\.com)$/.test(host) && /^\/services\/Soap\/u\/\d+\.\d+$/.test(path)) {
        // Permit only the existing utility's exact read-only getUserInfo envelope.
        allowed = /^<\?xml version="1\.0" encoding="UTF-8"\?><env:Envelope xmlns:xsd="http:\/\/www\.w3\.org\/2001\/XMLSchema" xmlns:xsi="http:\/\/www\.w3\.org\/2001\/XMLSchema-instance" xmlns:env="http:\/\/schemas\.xmlsoap\.org\/soap\/envelope\/">\s*<env:Header><SessionHeader xmlns="urn:partner\.soap\.sforce\.com"><sessionId>[^<>&]+<\/sessionId><\/SessionHeader><\/env:Header><env:Body><getUserInfo xmlns="urn:partner\.soap\.sforce\.com" \/><\/env:Body><\/env:Envelope>$/.test(String(options.body));
      }
      if (/^[a-z0-9-]+\.myshopify\.com$/.test(host) && /^\/admin\/api\/\d{4}-\d{2}\/graphql.json$/.test(path)) {
        const query = JSON.parse(String(options.body))?.query;
        allowed = typeof query === "string" && /^\s*query\s/.test(query) && !/\bmutation\b/.test(query);
      }
    }
    if (!allowed || url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("MONITOR_PROVIDER_WRITE_OR_HOST_BLOCKED");
    return request(url, { ...options, redirect: "error", signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000) });
  };
}

export async function runLiveNumberMonitor(configInput: unknown, scheduledOnly = false) {
  const config = liveNumberConfigSchema.parse(configInput);
  process.env.GA4_INCLUDE_CURRENT_DAY = config.application?.reportingMode === "current_day" ? "true" : "false";
  const dueCampaigns = config.campaigns.filter(campaign => !scheduledOnly || liveNumberCheckIsDue(campaign.reportingTimeZone));
  if (!dueCampaigns.length) return [{ campaignIdHash: "none", checkedAt: new Date().toISOString(), status: "not_due", checks: [] as NumberCheck[],
    scope: "No accuracy check scheduled for this slot; no database or provider queries made." }];
  if (config.credentialsEnvironmentPrefix) {
    for (const key of ["TOKEN_ENCRYPTION_KEY", "ENCRYPTION_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GA4_SERVICE_ACCOUNT_JSON", "GA4_CLIENT_SERVICE_ACCOUNT_JSON",
      "GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS", "GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON", "SERVICE_ACCOUNT_RESOURCE_GRANTS", "SHOPIFY_API_VERSION", "SALESFORCE_API_VERSION",
      "GOOGLE_ADS_SERVICE_ACCOUNT_JSON", "GOOGLE_ADS_SERVICE_ACCOUNT_ALLOWED_CUSTOMER_IDS", "GOOGLE_ADS_SERVICE_ACCOUNT_LOGIN_CUSTOMER_ID",
      "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN"]) {
      const value = process.env[config.credentialsEnvironmentPrefix + key];
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  const raw = process.env[config.databaseEnvironmentVariable];
  if (!raw) throw new Error("MONITOR_DATABASE_NOT_CONFIGURED");
  // Must precede the first import of storage/db. All helper connections inherit PostgreSQL read-only defaults.
  process.env.DATABASE_URL = readOnlyMonitorDatabaseUrl(raw, config.databaseFingerprint);
  const { pool } = await import("../server/db");
  if (!pool) throw new Error("MONITOR_DATABASE_NOT_CONFIGURED");
  const results: Array<ReturnType<typeof summarizeNumberChecks> & { inputFingerprint?: string; historicalChecks?: NumberCheck[] }> = [];
  try {
    const guard = await pool.query("SELECT current_setting('default_transaction_read_only') AS read_only");
    if (guard.rows[0]?.read_only !== "on") throw new Error("MONITOR_READ_ONLY_GUARD_FAILED");
    const { storage } = await import("../server/storage");
    const { checkGA4ProviderNumbers, checkFinancialProviderNumbers, checkPipelineProviderNumbers } = await import("../server/live-number-provider-checks");
    const { checkSavedReportNumbers, separateReviewedReportHistory, restoreLegacyReportInputOrder } = await import("../server/live-number-report-checks");
    for (const { campaignIdHash, reportingTimeZone, historicalReports } of dueCampaigns) {
      const now = new Date();
      try {
        const before = await storage.getLiveNumberCheckSnapshot(campaignIdHash);
        if (before.campaign.reportingTimeZone !== reportingTimeZone) throw new Error("MONITOR_TIMEZONE_CHANGED");
        const reportRead = { ...restoreLegacyReportInputOrder(before), usersDefinition: config.application?.usersDefinition };
        const checks = checkStoredNumbers(reportRead, now);
        checks.push(...await checkSavedReportNumbers(reportRead));
        if (!checks.some(check => check.section === "scope")) {
          try { checks.push(...await checkGA4ProviderNumbers(before, now)); }
          catch { checks.push({ section: "GA4 provider", code: "GA4_SOURCE_COMPARISON_UNVERIFIED", status: "unverified" }); }
          checks.push(...await checkFinancialProviderNumbers(before, now));
          checks.push(...await checkPipelineProviderNumbers(before));
        }
        const after = await storage.getLiveNumberCheckSnapshot(campaignIdHash);
        // Re-reading is essential: add/edit/delete/refresh during the provider query invalidates the comparison.
        const fingerprint = snapshotFingerprint(before), stable = fingerprint === snapshotFingerprint(after);
        const reviewed = stable ? separateReviewedReportHistory(before, checks, historicalReports) : { checks, historicalChecks: [] };
        const summary = summarizeNumberChecks(campaignIdHash, reviewed.checks, stable);
        results.push({ ...summary, ...(reviewed.historicalChecks.length ? { historicalChecks: reviewed.historicalChecks,
          ...(summary.status === "passed" ? { status: "historical_limitations" } : {}),
          scope: "Current checks are separate from reviewed immutable historical evidence gaps. Historical checks remain unverified, not passed." } : {}),
          ...(stable ? { inputFingerprint: fingerprint } : {}) });
      } catch {
        results.push(summarizeNumberChecks(campaignIdHash, [{ section: "scope", code: "CAMPAIGN_READ_UNVERIFIED", status: "unverified" }], true));
      }
    }
  } finally { await pool.end(); }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // Bound even provider-library auth calls that do not use the fetch deadline.
  const deadline = setTimeout(() => {
    writeSync(1, JSON.stringify({ status: "unverified", code: "MONITOR_DEADLINE_EXCEEDED" }) + "\n");
    process.exit(1);
  }, 10 * 60_000).unref();
  // Existing provider helpers log raw report samples. Suppress those in this isolated process, never in the app.
  const original = { log: console.log, warn: console.warn, error: console.error };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = readOnlyMonitorFetch(originalFetch);
  console.log = console.warn = console.error = () => {};
  try {
    if (process.argv.length !== 3 && !(process.argv.length === 4 && process.argv[3] === "--scheduled")) throw new Error("MONITOR_CONFIGURATION_INVALID");
    const results = await runLiveNumberMonitor(JSON.parse(readFileSync(process.argv[2], "utf8")), process.argv[3] === "--scheduled");
    // Bounded, redacted receipts: no tokens, customer names, URLs, source rows or raw provider errors.
    for (const result of results) {
      const groups = new Map<string, NumberCheck & { count: number }>();
      for (const check of result.checks) {
        const key = JSON.stringify(check);
        groups.set(key, { ...check, count: (groups.get(key)?.count || 0) + 1 });
      }
      process.stdout.write(JSON.stringify({ ...result, checks: Array.from(groups.values()) }) + "\n");
    }
    if (results.some(result => !["passed", "not_due", "historical_limitations"].includes(result.status))) process.exitCode = 1;
  } catch {
    process.stdout.write(JSON.stringify({ status: "unverified", code: "MONITOR_CONFIGURATION_OR_DATABASE_UNVERIFIED" }) + "\n");
    process.exitCode = 1;
  } finally { clearTimeout(deadline); Object.assign(console, original); globalThis.fetch = originalFetch; }
}
