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
import { snapshotFingerprint, resolveMonitorScope, parseMonitorMapping, type NumberCheck } from "../server/live-number-checks";
import { checkApplicationOutputs, checkFinancialComparisonOutputs, monitorComparisonWindows } from "../server/live-number-output-checks";

export function browserReadPath(path: string, campaignId: string, propertyId: string, targetIds: string[]): string | null {
  const url = new URL(path, "http://monitor");
  if (url.origin !== "http://monitor" || url.hash || !path.startsWith("/api/") || path.length > 1500) return null;
  const prefix = `/api/campaigns/${encodeURIComponent(campaignId)}`;
  const name = url.pathname.slice(prefix.length + 1);
  const endpoints = ["ga4-daily", "ga4-to-date", "ga4-breakdown", "ga4-landing-pages", "ga4-conversion-events", "ga4-connections", "ga4-geographic",
    "revenue-to-date", "revenue-breakdown", "revenue-sources", "revenue-daily", "spend-to-date", "spend-breakdown", "spend-sources", "spend-daily",
    "outcome-totals", "executive-summary", "executive-summary/trajectory", "trend-analysis", "financial-daily-snapshot", "snapshots", "snapshots/comparison", "connected-platforms", "google-sheets-data", "linkedin-daily", "daily-financials"];
  const global = ["/api/campaigns", "/api/clients", "/api/notifications", "/api/industry-benchmarks", "/api/reports"];
  const platforms = [...["kpis", "benchmarks", "reports"].map(kind => `/api/platforms/google_analytics/${kind}`), "/api/platforms/campaign_deepdive/reports"];
  const target = targetIds.some(id => ["kpis", "benchmarks"].some(kind => url.pathname === `/api/${kind}/${encodeURIComponent(id)}/analytics`));
  const provider = ["meta", "google-ads", "custom-integration", "hubspot", "salesforce"].some(p => ["analytics", "daily-metrics", "changes", "pipeline-proxy"].some(s => url.pathname === `/api/${p}/${encodeURIComponent(campaignId)}/${s}`));
  if (!(url.pathname === prefix || url.pathname.startsWith(prefix + "/") && endpoints.includes(name) || global.includes(url.pathname) || target || provider
    || url.pathname === `/api/ga4/check-connection/${encodeURIComponent(campaignId)}` || platforms.includes(url.pathname) && url.searchParams.get("campaignId") === campaignId)) return null;
  if (url.searchParams.has("campaignId") && url.searchParams.get("campaignId") !== campaignId || url.searchParams.has("propertyId") && url.searchParams.get("propertyId") !== propertyId) return null;
  const keys = ["campaignId", "propertyId", "days", "readOnly", "persistedOnly", "captureExecutiveSnapshot", "executiveFinancialScope", "includeMonthly", "statusOnly", "insightsScope", "window", "overviewCampaignBreakdown", "adComparisonCampaignBreakdown", "insightsChannelAttribution", "snapshotEndDate", "limit", "dateRange", "platformContext", "startDate", "endDate", "throughDate", "reportingDate", "type", "snapshotType", "comparisonDate", "period", "timeframe", "ga4Scope", "start", "end"];
  if ([...url.searchParams.keys()].some(key => !keys.includes(key))) return null;
  if ((url.searchParams.has("captureExecutiveSnapshot") || url.searchParams.has("executiveFinancialScope"))
    && (name !== "outcome-totals" || url.searchParams.get("captureExecutiveSnapshot") !== "1" || url.searchParams.get("executiveFinancialScope") !== "campaign_to_date")) return null;
  if (url.searchParams.has("days") && !/^(?:[1-9]|[1-9]\d|[12]\d\d|3[0-6]\d)$/.test(url.searchParams.get("days")!)) return null;
  if (name.startsWith("ga4-") || url.pathname.includes("check-connection") || url.pathname === "/api/notifications") url.searchParams.set("readOnly", "1");
  if (name === "outcome-totals") url.searchParams.set("persistedOnly", "1");
  url.searchParams.sort(); return url.pathname + url.search;
}

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

export function outputReportAuthorization(options: RequestInit | undefined, token: string): RequestInit {
  if (!token || !options?.body) throw new Error("OUTPUT_REPORT_CREDENTIAL_UNAVAILABLE");
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...options, headers };
}

export async function runApplicationOutputMonitor(campaignHash: string, databaseFingerprint: string, expectedFingerprint: string) {
  if (!/^[a-f0-9]{12}$/.test(campaignHash) || !/^[a-f0-9]{64}$/.test(expectedFingerprint)) throw new Error("OUTPUT_CONFIGURATION_INVALID");
  process.env.DATABASE_URL = readOnlyMonitorDatabaseUrl(process.env.DATABASE_URL || "", databaseFingerprint);
  const originalFetch = globalThis.fetch, originalHttp = http.request, originalHttps = https.request;
  const originalHttpGet = http.get, originalHttpsGet = https.get;
  let origin = "", campaignScope = "", propertyScope = "", currencyScope = "", reportToken = "", writes = 0, external = 0, reportReads = 0;
  const providerRead = readOnlyMonitorFetch(originalFetch);
  const blocked = () => { external++; throw new Error("OUTPUT_EXTERNAL_REQUEST_BLOCKED"); };
  // Provider SDKs may use node:http instead of fetch. Both are blocked.
  http.request = https.request = http.get = https.get = blocked as any;
  syncBuiltinESMExports();
  const replayFetch: typeof fetch = async (input, options) => {
    if (input instanceof Request) return blocked();
    const url = new URL(String(input));
    if (origin && url.origin === origin && (options?.method || "GET") === "GET") return originalFetch(input, { ...options, redirect: "error", signal: AbortSignal.timeout(45_000) });
    // Ten standard variants, six exact-date comparisons and at most twenty
    // saved report selections. Retain a fixed provider-read ceiling.
    if (propertyScope && outputReportReadAllowed(url, options, propertyScope, currencyScope) && ++reportReads <= 60) return providerRead(input, outputReportAuthorization(options, reportToken));
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
      // The source-list publication read takes a campaign SHARE lock. The
      // read-only replay cannot lock rows; omit only that exact lock, with the
      // same campaign parameter. Stable before/after fingerprints remain required.
      if (/^select "id" from "campaigns" where "campaigns"\."id" = \$1 for share$/i.test(sql)
        && args[1]?.length === 1 && args[1][0] === campaignScope) args[0] = typeof args[0] === "string" ? sql.replace(/ for share$/i, "") : { ...args[0], text: sql.replace(/ for share$/i, "") };
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
    campaignScope = before.campaign.id;
    // Executive's flag also selects its financial calculation scope. Preserve
    // that calculation, but reject its optional snapshot save before storage.
    storage.upsertExecutiveSummaryDailySnapshot = async () => { throw new Error("MONITOR_SNAPSHOT_SAVE_DISABLED"); };
    propertyScope = property; currencyScope = scope.currency;
    if (scope.connection.method === "service_account") {
      // The existing helper requests analytics.readonly only and caches the JWT
      // access token in memory. Warm it before importing any app handlers; their
      // subsequent credential reads must not need external access or persistence.
      const { hydrateGA4ServiceAccountConnection } = await import("../server/utils/ga4-service-account");
      globalThis.fetch = originalFetch; http.request = originalHttp; https.request = originalHttps;
      http.get = originalHttpGet; https.get = originalHttpsGet; syncBuiltinESMExports();
      try { reportToken = (await hydrateGA4ServiceAccountConnection(scope.connection)).accessToken || ""; }
      finally {
        http.request = https.request = http.get = https.get = blocked as any; syncBuiltinESMExports();
        globalThis.fetch = replayFetch;
      }
    } else {
      // Use the same reusable Google token exchange as the source comparison.
      // Only the exact permitted GA4 read's Authorization header changes; query
      // bodies and app calculations stay intact. Never persist the new token.
      const { googleMonitorCredential } = await import("../server/live-number-provider-checks");
      reportToken = await googleMonitorCredential({ ...scope.connection, expiresAt: "1970-01-01T00:00:00Z" }, providerRead);
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
      trajectory: `${prefix}/executive-summary/trajectory?reportingDate=${scope.endDate}`,
      notifications: "/api/notifications?readOnly=1",
    };
    for (const provider of ["hubspot", "salesforce"]) if ((before.rows.revenueSources || []).some(source => {
      if (!source.isActive || source.platformContext !== "ga4" || source.sourceType !== provider) return false;
      try { return parseMonitorMapping(source.mappingConfig).pipelineEnabled === true; } catch { return false; }
    })) paths[provider + "Pipeline"] = `/api/${provider}/${id}/pipeline-proxy?platformContext=ga4`;
    for (const window of monitorComparisonWindows(scope.endDate)) paths[window.key] = `${prefix}/snapshots/comparison?type=${window.type}&snapshotType=financial_daily&comparisonDate=${window.date}`;
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
    checks.push(...checkFinancialComparisonOutputs(before, outputs));
    const { checkNotificationCoverage, checkNotificationEmailContent } = await import("../server/live-number-notification-checks");
    checks.push(...checkNotificationCoverage(before, outputs.notifications));
    checks.push(...await checkNotificationEmailContent(before));
    const { checkGeneratedReportNumbers } = await import("../server/live-number-generated-report-checks");
    checks.push(...await checkGeneratedReportNumbers(before, () => writes + external, outputs.outcome?.performanceSummary?.sources));
    const { runBrowserProcess } = await import("./live-number-browser-process");
    const browserCache = new Map<string, Promise<{ status: number; body: any }>>();
    const ids = [...(before.rows.kpis || []), ...(before.rows.benchmarks || [])].map(row => row.id);
    checks.push(...await runBrowserProcess(before, outputs, async requested => {
      const path = browserReadPath(requested, before.campaign.id, property, ids);
      if (!path) throw new Error("BROWSER_READ_SCOPE_BLOCKED");
      if (!browserCache.has(path)) {
        if (browserCache.size >= 160) throw new Error("BROWSER_READ_LIMIT");
        allowed.add(path);
        browserCache.set(path, (async () => {
          const response = await fetch(origin + path, { headers: { "x-output-monitor": capability } });
          const text = await response.text(); if (text.length > 5_000_000) throw new Error("BROWSER_READ_SIZE");
          let body = JSON.parse(text);
          // The isolated browser only receives this campaign/client, even when
          // the real list route returns other records owned by the same actor.
          if (path.split("?")[0] === "/api/campaigns" && Array.isArray(body)) body = body.filter(row => row.id === before.campaign.id);
          if (path.split("?")[0] === "/api/clients" && Array.isArray(body)) body = body.filter(row => row.id === before.campaign.clientId);
          if (path.startsWith("/api/notifications") && Array.isArray(body)) body = body.filter(row => row.campaignId === before.campaign.id);
          return { status: response.status, body };
        })());
      }
      return browserCache.get(path)!;
    }));
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
  const deadline = setTimeout(() => { writeSync(1, JSON.stringify([{ section: "Application outputs", code: "OUTPUT_DEADLINE", status: "unverified" }])); process.exit(1); }, 300_000).unref();
  try { writeSync(1, JSON.stringify(await runApplicationOutputMonitor(process.argv[2], process.argv[3], process.argv[4]))); }
  catch { writeSync(1, JSON.stringify([{ section: "Application outputs", code: "OUTPUT_REPLAY_UNVERIFIED", status: "unverified" }])); process.exitCode = 1; }
  finally { clearTimeout(deadline); }
}
