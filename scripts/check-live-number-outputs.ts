// Private replay of existing application handlers. Never imported by app startup.
// Authentication below exists only on loopback with an ephemeral capability.
import { randomBytes } from "node:crypto";
import { writeSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import http from "node:http";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import express from "express";
import { readOnlyMonitorDatabaseUrl, readOnlyMonitorFetch } from "./check-live-numbers";
import { snapshotFingerprint, resolveMonitorScope, type NumberCheck } from "../server/live-number-checks";
import { checkApplicationOutputs } from "../server/live-number-output-checks";

export function monitorReadQueryAllowed(sql: string): boolean {
  // Reject multiple statements, SQL comments, setting changes and explicit write
  // transactions. PostgreSQL read-only is the second, authoritative barrier.
  const text = sql.trim().replace(/;$/, "");
  // Existing publication-version reads use these bounded, transaction-local
  // timeouts. They do not change PostgreSQL's read-only setting.
  if (/^set local (?:lock_timeout = '10s'|statement_timeout = '30s'|idle_in_transaction_session_timeout = '30s')$/i.test(text)) return true;
  return !/;|--|\/\*|\bread\s+write\b|\bset_config\s*\(|\b(?:set|reset)\s+(?:session|local|all|default_transaction_read_only|transaction_read_only)\b/i.test(text)
    && /^(?:select\b|with\b|show\b|begin(?:\s+isolation\s+level\s+repeatable\s+read)?(?:\s+read\s+only)?$|commit$|rollback$|savepoint\s+\w+$|release\s+savepoint\s+\w+$|set\s+transaction\s+isolation\s+level\s+repeatable\s+read\s+read\s+only$)/i.test(text);
}

export function outputReportReadAllowed(url: URL, options: RequestInit | undefined, propertyId: string, currency: string): boolean {
  if (url.href !== `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport` || options?.method !== "POST") return false;
  try {
    const body = JSON.parse(String(options.body));
    return body.currencyCode === currency && Array.isArray(body.dateRanges) && body.dateRanges.length === 1
      && body.dateRanges.every((range: any) => /^\d{4}-\d{2}-\d{2}$/.test(range.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(range.endDate) && range.startDate <= range.endDate);
  } catch { return false; }
}

export async function runApplicationOutputMonitor(campaignHash: string, databaseFingerprint: string, expectedFingerprint: string) {
  if (!/^[a-f0-9]{12}$/.test(campaignHash) || !/^[a-f0-9]{64}$/.test(expectedFingerprint)) throw new Error("OUTPUT_CONFIGURATION_INVALID");
  process.env.DATABASE_URL = readOnlyMonitorDatabaseUrl(process.env.DATABASE_URL || "", databaseFingerprint);
  const originalFetch = globalThis.fetch, originalHttp = http.request, originalHttps = https.request;
  const originalHttpGet = http.get, originalHttpsGet = https.get;
  let origin = "", propertyScope = "", currencyScope = "", writes = 0, external = 0, reportReads = 0;
  const providerRead = readOnlyMonitorFetch(originalFetch);
  const blocked = () => { external++; throw new Error("OUTPUT_EXTERNAL_REQUEST_BLOCKED"); };
  // Provider SDKs may use node:http instead of fetch. Both are blocked.
  http.request = https.request = http.get = https.get = blocked as any;
  syncBuiltinESMExports();
  const replayFetch: typeof fetch = async (input, options) => {
    if (input instanceof Request) return blocked();
    const url = new URL(String(input));
    if (origin && url.origin === origin && (options?.method || "GET") === "GET") return originalFetch(input, { ...options, redirect: "error", signal: AbortSignal.timeout(45_000) });
    if (propertyScope && outputReportReadAllowed(url, options, propertyScope, currencyScope) && ++reportReads <= 10) return providerRead(input, options);
    return blocked();
  };
  globalThis.fetch = replayFetch;
  const { pool } = await import("../server/db");
  if (!pool) throw new Error("OUTPUT_DATABASE_MISSING");
  pool.on("connect", client => {
    const query = client.query.bind(client);
    client.query = ((...args: any[]) => {
      const sql = typeof args[0] === "string" ? args[0] : args[0]?.text || "";
      if (!monitorReadQueryAllowed(sql)) {
        writes++; const error = new Error("OUTPUT_WRITE_BLOCKED"), callback = args.at(-1);
        if (typeof callback === "function") { queueMicrotask(() => callback(error)); return; }
        return Promise.reject(error);
      }
      return (query as any)(...args);
    }) as any;
  });
  let server: http.Server | undefined;
  try {
    const guard = await pool.query("SELECT current_setting('default_transaction_read_only') AS value");
    if (guard.rows[0]?.value !== "on") throw new Error("OUTPUT_READ_ONLY_REQUIRED");
    const { storage } = await import("../server/storage");
    const before = await storage.getLiveNumberCheckSnapshot(campaignHash);
    if (snapshotFingerprint(before) !== expectedFingerprint) throw new Error("OUTPUT_INPUTS_CHANGED");
    const scope = resolveMonitorScope(before), id = encodeURIComponent(before.campaign.id), property = scope.connection.propertyId;
    propertyScope = property; currencyScope = scope.currency;
    if (scope.connection.method === "service_account") {
      // The existing helper requests analytics.readonly only and caches the JWT
      // access token in memory. Warm it before importing any app handlers; their
      // subsequent credential reads must not need external access or persistence.
      const { hydrateGA4ServiceAccountConnection } = await import("../server/utils/ga4-service-account");
      globalThis.fetch = originalFetch; http.request = originalHttp; https.request = originalHttps;
      http.get = originalHttpGet; https.get = originalHttpsGet; syncBuiltinESMExports();
      try { await hydrateGA4ServiceAccountConnection(scope.connection); }
      finally {
        http.request = https.request = http.get = https.get = blocked as any; syncBuiltinESMExports();
        globalThis.fetch = replayFetch;
      }
    }
    const prefix = `/api/campaigns/${id}`;
    const paths: Record<string, string> = {
      daily: `${prefix}/ga4-daily?days=60&propertyId=${property}&readOnly=1`,
      native: `${prefix}/ga4-to-date?propertyId=${property}&insightsScope=1&readOnly=1`,
      breakdown: `${prefix}/ga4-breakdown?window=import-to-date&propertyId=${property}&overviewCampaignBreakdown=1&readOnly=1`,
      landing: `${prefix}/ga4-landing-pages?window=import-to-date&propertyId=${property}&readOnly=1`,
      events: `${prefix}/ga4-conversion-events?window=import-to-date&propertyId=${property}&readOnly=1`,
      revenue: `${prefix}/revenue-to-date`, revenueBreakdown: `${prefix}/revenue-breakdown`,
      spend: `${prefix}/spend-to-date?platformContext=ga4`, spendBreakdown: `${prefix}/spend-breakdown?platformContext=ga4`,
      kpis: `/api/platforms/google_analytics/kpis?campaignId=${id}`,
      benchmarks: `/api/platforms/google_analytics/benchmarks?campaignId=${id}`,
      reports: `/api/platforms/google_analytics/reports?campaignId=${id}`,
      outcome: `${prefix}/outcome-totals?dateRange=90days&persistedOnly=1`,
      executive: `${prefix}/executive-summary`, trend: `${prefix}/trend-analysis?dateRange=30days&days=60`,
      financial: `${prefix}/financial-daily-snapshot?throughDate=${scope.endDate}`,
      notifications: "/api/notifications?readOnly=1",
    };
    const capability = randomBytes(32).toString("hex"), allowed = new Set(Object.values(paths));
    const app = express();
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.headers["x-output-monitor"] !== capability || !allowed.has(req.originalUrl)) return res.sendStatus(403);
      (req as any).auth = () => ({ userId: before.campaign.ownerId, sessionId: "isolated-monitor", tokenType: "session_token" });
      next();
    });
    const { registerRoutes } = await import("../server/routes-oauth");
    server = await registerRoutes(app);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(server.address() as any).port}`;
    const outputs: Record<string, any> = {}, checks: NumberCheck[] = [];
    for (const [name, path] of Object.entries(paths)) {
      const writesBefore = writes, externalBefore = external;
      try {
        const response = await fetch(origin + path, { headers: { "x-output-monitor": capability } });
        if (!response.ok) throw new Error();
        const body = await response.text();
        if (body.length > 5_000_000) throw new Error();
        if (writes !== writesBefore || external !== externalBefore) throw new Error();
        outputs[name] = JSON.parse(body);
      } catch { checks.push({ section: "Application output safety", code: `READ_${name}_UNVERIFIED`, status: "unverified" }); }
    }
    checks.push(...checkApplicationOutputs(before, outputs));
    const { checkGeneratedReportNumbers } = await import("../server/live-number-generated-report-checks");
    checks.push(...await checkGeneratedReportNumbers(before, () => writes + external, outputs.outcome?.performanceSummary?.sources));
    const after = await storage.getLiveNumberCheckSnapshot(campaignHash);
    if (snapshotFingerprint(after) !== expectedFingerprint) return [{ section: "scope", code: "OUTPUT_INPUTS_CHANGED", status: "unverified" as const }];
    checks.push({ section: "Application output safety", code: "DATABASE_READ_ONLY_ENFORCED", status: "passed" });
    if (writes) checks.push({ section: "Application output safety", code: "ATTEMPTED_WRITE_BLOCKED", status: "unverified" });
    if (external) checks.push({ section: "Application output safety", code: "ATTEMPTED_EXTERNAL_REQUEST_BLOCKED", status: "unverified" });
    return checks;
  } finally {
    if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); }
    await pool.end(); globalThis.fetch = originalFetch;
    http.request = originalHttp; https.request = originalHttps; http.get = originalHttpGet; https.get = originalHttpsGet;
    syncBuiltinESMExports();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log = console.warn = console.error = () => {};
  const deadline = setTimeout(() => { writeSync(1, JSON.stringify([{ section: "Application outputs", code: "OUTPUT_DEADLINE", status: "unverified" }])); process.exit(1); }, 180_000).unref();
  try { writeSync(1, JSON.stringify(await runApplicationOutputMonitor(process.argv[2], process.argv[3], process.argv[4]))); }
  catch { writeSync(1, JSON.stringify([{ section: "Application outputs", code: "OUTPUT_REPLAY_UNVERIFIED", status: "unverified" }])); process.exitCode = 1; }
  finally { clearTimeout(deadline); }
}
