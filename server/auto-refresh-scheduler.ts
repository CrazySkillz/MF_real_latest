/**
 * Daily Auto-Refresh + Auto-Process Scheduler
 *
 * Goal: after a user completes initial setup (LinkedIn import + revenue mappings),
 * keep data and conversion value up-to-date without manual clicks.
 *
 * What this scheduler does:
 * - Refreshes LinkedIn data (creates a new import session per campaign) using existing scheduler logic
 * - Re-processes revenue metrics for HubSpot / Salesforce / Shopify based on stored mappingConfig
 *
 * Notes:
 * - We intentionally call the existing API endpoints for "save-mappings" so business logic stays in one place.
 * - This avoids duplicating provider token-refresh logic (HubSpot/Salesforce) here.
 */

import { storage } from "./storage";
import { refreshAllLinkedInData } from "./linkedin-scheduler";
import { checkPerformanceAlerts } from "./kpi-scheduler";
import { checkBenchmarkPerformanceAlerts } from "./benchmark-notifications";
import { getInternalAutoRefreshToken } from "./internal-request-auth";
import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { getLatestCompleteReportingDate, getNextDailyRunAt, normalizeReportingTimeZone } from "./utils/reporting-timezone";

type AnyRecord = Record<string, any>;
type AutoRefreshSchedulerConfig = {
  enabled: boolean;
  reportingTimeZone: string;
  hour: number;
  minute: number;
  runOnStartup: boolean;
};
const refreshableRevenueContexts = ["ga4", "linkedin", "meta", "google_ads", "google_sheets"] as const;
const crmRevenueContexts = ["ga4", "meta", "google_ads", "google_sheets"] as const;

const parseBoundedInt = (value: any, fallback: number, min: number, max: number) => {
  const parsed = parseInt(String(value ?? ""), 10);
  const n = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(Math.max(n, min), max);
};

export function getAutoRefreshSchedulerConfig(env: NodeJS.ProcessEnv = process.env): AutoRefreshSchedulerConfig {
  const enabled = String(env.AUTO_REFRESH_ENABLED ?? "true").toLowerCase() !== "false";
  const reportingTimeZone = normalizeReportingTimeZone(env.AUTO_REFRESH_TIME_ZONE || env.GA4_DAILY_REFRESH_TIME_ZONE || "UTC");
  const hour = parseBoundedInt(env.AUTO_REFRESH_DAILY_HOUR, 3, 0, 23);
  const minute = parseBoundedInt(env.AUTO_REFRESH_DAILY_MINUTE, 0, 0, 59);
  const runOnStartup = String(env.AUTO_REFRESH_RUN_ON_STARTUP || "false").toLowerCase() === "true";
  return { enabled, reportingTimeZone, hour, minute, runOnStartup };
}

export function getNextAutoRefreshRunAt(now = new Date(), config: AutoRefreshSchedulerConfig = getAutoRefreshSchedulerConfig()): Date {
  return getNextDailyRunAt(now, config.reportingTimeZone, config.hour, config.minute);
}

const formatSchedulerLocalTime = (date: Date, reportingTimeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: reportingTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);

function getServerBaseUrl(): string {
  // Internal auto-refresh auth is intentionally loopback-only.
  const port = String(process.env.PORT || "5000");
  return `http://127.0.0.1:${port}`;
}

async function postJson(path: string, body: AnyRecord): Promise<{ ok: boolean; status: number; json?: any; text?: string }> {
  const url = `${getServerBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
  const timeoutMs = Math.max(parseInt(String(process.env.AUTO_REFRESH_INTERNAL_TIMEOUT_MS || "120000"), 10) || 120000, 10000);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-auto-refresh-token": getInternalAutoRefreshToken() },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await resp.text().catch(() => "");
  let json: any = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    // ignore
  }
  return { ok: resp.ok, status: resp.status, json, text };
}

function isStaleRevenueSourceReprocess(result: { status: number; json?: any; text?: string }): boolean {
  const message = String(result.json?.error || result.text || "").toLowerCase();
  return result.status === 404 && message.includes("revenue source not found");
}

function safeJsonParse<T = any>(raw: any): T | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return null;
  }
}

function isSourceOutsideCampaign(source: any, campaignId: string): boolean {
  const sourceCampaignId = String(source?.campaignId || "").trim();
  return !!sourceCampaignId && sourceCampaignId !== String(campaignId || "").trim();
}

async function withTimeout<T>(label: string, promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function reprocessHubSpot(campaignId: string, mappingConfig: AnyRecord, sourceId?: string): Promise<boolean> {
  const body: AnyRecord = {
    campaignProperty: mappingConfig.campaignProperty,
    selectedValues: mappingConfig.selectedValues,
    revenueProperty: mappingConfig.revenueProperty,
    conversionValueProperty: mappingConfig.conversionValueProperty,
    valueSource: mappingConfig.valueSource,
    days: mappingConfig.days,
    pipelineEnabled: mappingConfig.pipelineEnabled,
    pipelineStageId: mappingConfig.pipelineStageId,
    pipelineStageLabel: mappingConfig.pipelineStageLabel,
    dateField: mappingConfig.dateField,
    platformContext: mappingConfig.platformContext,
    ...(sourceId ? { sourceId } : {}),
    ...(Array.isArray(mappingConfig.campaignMappings) && mappingConfig.campaignMappings.length > 0
      ? { campaignMappings: mappingConfig.campaignMappings }
      : {}),
  };
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/hubspot/save-mappings`, body);
  if (!result.ok) {
    if (isStaleRevenueSourceReprocess(result)) {
      console.warn(`[Auto Refresh] Skipping stale HubSpot revenue source for campaign ${campaignId}`);
      return false;
    }
    console.error(`[Auto Refresh] HubSpot reprocess failed for campaign ${campaignId}:`, result.status, result.json?.error || result.text);
    return false;
  }
  return true;
}

async function reprocessSalesforce(campaignId: string, mappingConfig: AnyRecord, sourceId?: string): Promise<boolean> {
  const body: AnyRecord = {
    campaignField: mappingConfig.campaignField,
    selectedValues: mappingConfig.selectedValues,
    revenueField: mappingConfig.revenueField,
    conversionValueField: mappingConfig.conversionValueField,
    valueSource: mappingConfig.valueSource,
    days: mappingConfig.days,
    dateField: mappingConfig.dateField,
    pipelineEnabled: mappingConfig.pipelineEnabled,
    pipelineStageName: mappingConfig.pipelineStageName,
    pipelineStageLabel: mappingConfig.pipelineStageLabel,
    platformContext: mappingConfig.platformContext,
    ...(sourceId ? { sourceId } : {}),
    ...(Array.isArray(mappingConfig.campaignMappings) && mappingConfig.campaignMappings.length > 0
      ? { campaignMappings: mappingConfig.campaignMappings }
      : {}),
  };
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/salesforce/save-mappings`, body);
  if (!result.ok) {
    if (isStaleRevenueSourceReprocess(result)) {
      console.warn(`[Auto Refresh] Skipping stale Salesforce revenue source for campaign ${campaignId}`);
      return false;
    }
    console.error(`[Auto Refresh] Salesforce reprocess failed for campaign ${campaignId}:`, result.status, result.json?.error || result.text);
    return false;
  }
  const totalRevenue = Number(result.json?.totalRevenue || 0);
  const materializedRecordCount = Number(result.json?.materializedRecordCount || 0);
  const materializedDates = Array.isArray(result.json?.materializedDates) ? result.json.materializedDates.map(String) : [];
  const unmatchedSelectedValues = Array.isArray(result.json?.unmatchedSelectedValues) ? result.json.unmatchedSelectedValues.map(String) : [];
  const unmatchedSelectedDiagnostics = Array.isArray(result.json?.unmatchedSelectedDiagnostics) ? result.json.unmatchedSelectedDiagnostics : [];
  if (totalRevenue > 0 && materializedRecordCount <= 0) {
    console.error(`[Auto Refresh] Salesforce reprocess produced no materialized revenue records for campaign ${campaignId}`);
    return false;
  }
  console.log(`[Auto Refresh] Salesforce reprocess complete for campaign ${campaignId}: source=${sourceId || "new"}, totalRevenue=${totalRevenue}, materializedRecordCount=${materializedRecordCount}, dateField=${String(mappingConfig.dateField || "CloseDate")}, dates=${materializedDates.join(",") || "none"}, unmatchedSelectedValues=${unmatchedSelectedValues.join(",") || "none"}`);
  if (unmatchedSelectedValues.length > 0) {
    console.log(`[Auto Refresh] Salesforce unmatched diagnostics for campaign ${campaignId}: ${JSON.stringify(unmatchedSelectedDiagnostics)}`);
  }
  return true;
}

async function reprocessShopify(campaignId: string, mappingConfig: AnyRecord, sourceId?: string): Promise<boolean> {
  const body: AnyRecord = {
    campaignField: mappingConfig.campaignField,
    selectedValues: mappingConfig.selectedValues,
    revenueMetric: mappingConfig.revenueMetric,
    revenueClassification: mappingConfig.revenueClassification,
    days: mappingConfig.days,
    platformContext: mappingConfig.platformContext,
    valueSource: mappingConfig.valueSource,
    ...(sourceId ? { sourceId } : {}),
    ...(Array.isArray(mappingConfig.campaignMappings) && mappingConfig.campaignMappings.length > 0
      ? { campaignMappings: mappingConfig.campaignMappings }
      : {}),
  };
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/shopify/save-mappings`, body);
  if (!result.ok) {
    if (isStaleRevenueSourceReprocess(result)) {
      console.warn(`[Auto Refresh] Skipping stale Shopify revenue source for campaign ${campaignId}`);
      return false;
    }
    console.error(`[Auto Refresh] Shopify reprocess failed for campaign ${campaignId}:`, result.status, result.json?.error || result.text);
    return false;
  }
  return true;
}

async function reprocessGoogleSheetsSpend(campaignId: string, source: any, mappingConfig: AnyRecord): Promise<boolean> {
  const connectionId = String(mappingConfig?.connectionId || "").trim();
  if (!connectionId) return false;
  if (isSourceOutsideCampaign(source, campaignId)) {
    console.error(`[Auto Refresh] Refusing Google Sheets spend reprocess for source outside campaign ${campaignId}: source=${String(source?.id || "")}`);
    return false;
  }
  const body = {
    connectionId,
    // The process endpoint tolerates extra keys; we keep the exact mapping that the user configured.
    mapping: { ...(mappingConfig || {}), sourceId: String(source?.id || "") },
  };
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/spend/sheets/process`, body);
  if (!result.ok) {
    console.error(`[Auto Refresh] Google Sheets spend reprocess failed for campaign ${campaignId}:`, result.status, result.json?.error || result.text);
    return false;
  }
  return true;
}

async function reprocessGoogleSheetsRevenue(campaignId: string, source: any, mappingConfig: AnyRecord): Promise<boolean> {
  const connectionId = String(mappingConfig?.connectionId || "").trim();
  if (!connectionId) return false;
  if (isSourceOutsideCampaign(source, campaignId)) {
    console.error(`[Auto Refresh] Refusing Google Sheets revenue reprocess for source outside campaign ${campaignId}: source=${String(source?.id || "")}`);
    return false;
  }
  try {
    // Direct DB operations — avoids auth/rate-limit issues from HTTP self-calls
    const connections = await storage.getGoogleSheetsConnections(campaignId);
    let conn = (connections as any[]).find((c: any) => String(c.id) === connectionId);
    if (!conn) {
      // Try without purpose filter
      const allConns = await storage.getGoogleSheetsConnections(campaignId);
      conn = (allConns as any[]).find((c: any) => String(c.id) === connectionId);
    }
    if (!conn || !conn.accessToken) {
      console.warn(`[Auto Refresh] Google Sheets revenue: connection ${connectionId} not found for campaign ${campaignId}`);
      return false;
    }

    // Read sheet data with token refresh
    let accessToken = conn.accessToken;
    const sheetName = conn.sheetName ? String(conn.sheetName).trim() : "";
    const range = sheetName ? `'${sheetName.replace(/'/g, "''")}'!A1:ZZ5000` : "A1:ZZ5000";
    let resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(conn.spreadsheetId)}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000) }
    );
    if (resp.status === 401 && conn.refreshToken && conn.clientId && conn.clientSecret) {
      try {
        const tr = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refreshToken, client_id: conn.clientId, client_secret: conn.clientSecret }),
          signal: AbortSignal.timeout(15000),
        });
        if (tr.ok) {
          const tokens = await tr.json();
          accessToken = tokens.access_token;
          await storage.updateGoogleSheetsConnection(conn.id, { accessToken, expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000) } as any);
          resp = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(conn.spreadsheetId)}/values/${encodeURIComponent(range)}`,
            { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000) }
          );
        }
      } catch { /* fall through */ }
    }
    if (!resp.ok) {
      console.warn(`[Auto Refresh] Google Sheets revenue fetch failed for campaign ${campaignId}: HTTP ${resp.status}`);
      return false;
    }

    const data = await resp.json();
    const allRows = data.values || [];
    if (allRows.length < 2) return false;
    const headers: string[] = allRows[0];
    const dataRows: string[][] = allRows.slice(1);

    // Parse rows using stored mapping
    const revenueCol = String(mappingConfig.revenueColumn || "");
    const campaignCol = String(mappingConfig.campaignColumn || "");
    const campaignValues: string[] = Array.isArray(mappingConfig.campaignValues) ? mappingConfig.campaignValues : [];
    const campaignValueSet = campaignValues.length > 0 ? new Set(campaignValues) : null;

    const parseNum = (v: any) => { const n = parseFloat(String(v || "0").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : 0; };

    const dateCol = mappingConfig.dateColumn ? String(mappingConfig.dateColumn) : null;
    let totalRevenue = 0;
    let kept = 0;
    const dailyRevenueMap = new Map<string, number>(); // date -> revenue
    for (const row of dataRows) {
      const rowObj: any = {};
      headers.forEach((h, i) => { rowObj[h] = row[i] ?? ""; });
      if (campaignCol && campaignValueSet) {
        const v = String(rowObj[campaignCol] ?? "").trim();
        if (!campaignValueSet.has(v)) continue;
      }
      const rev = parseNum(rowObj[revenueCol]);
      if (rev > 0) {
        totalRevenue += rev;
        kept++;

        // Track daily revenue if date column provided
        if (dateCol) {
          const dateStr = String(rowObj[dateCol] ?? "").trim();
          if (dateStr) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              const normalizedDate = date.toISOString().split('T')[0];
              dailyRevenueMap.set(normalizedDate, (dailyRevenueMap.get(normalizedDate) || 0) + rev);
            }
          }
        }
      }
    }

    const total = Number(totalRevenue.toFixed(2));
    const sourceId = String(source.id);
    const endDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10); // yesterday

    // Delete old records and create new
    await storage.deleteRevenueRecordsBySource(sourceId);
    if (total > 0) {
      const campaign = await storage.getCampaign(campaignId);
      const currency = String(mappingConfig.currency || (campaign as any)?.currency || "USD");

      if (dateCol && dailyRevenueMap.size > 0) {
        const revenueRecordsToInsert = Array.from(dailyRevenueMap.entries())
          .filter(([, rev]) => rev > 0)
          .map(([date, rev]) => ({
            campaignId,
            revenueSourceId: sourceId,
            date,
            revenue: Number(rev.toFixed(2)).toFixed(2) as any,
            currency,
          } as any));
        if (revenueRecordsToInsert.length > 0) {
          await storage.createRevenueRecords(revenueRecordsToInsert);
        }
      } else {
        await storage.createRevenueRecords([{ campaignId, revenueSourceId: sourceId, date: endDate, revenue: total.toFixed(2) as any, currency } as any]);
      }
    }

    // Update lastSyncedAt
    await storage.updateRevenueSource(sourceId, {
      mappingConfig: JSON.stringify({ ...mappingConfig, lastSyncedAt: new Date().toISOString() }),
    } as any);

    console.log(`[Auto Refresh] ✅ Google Sheets revenue synced for campaign ${campaignId}: $${total} from ${kept} rows`);
    return true;
  } catch (err: any) {
    console.error(`[Auto Refresh] Google Sheets revenue reprocess failed for campaign ${campaignId}:`, err?.message || err);
    return false;
  }
}

export async function runGoogleSheetsSpendSourceRefreshForValidation(campaignId: string, sourceId: string): Promise<{ success: boolean; reason?: string; campaignId: string; sourceId: string; platformContext?: string }> {
  const normalizedCampaignId = String(campaignId || "").trim();
  const normalizedSourceId = String(sourceId || "").trim();
  if (!normalizedCampaignId || !normalizedSourceId) {
    return { success: false, reason: "invalid_request", campaignId: normalizedCampaignId, sourceId: normalizedSourceId };
  }

  const sources = await storage.getSpendSources(normalizedCampaignId).catch(() => [] as any[]);
  const source = (Array.isArray(sources) ? sources : []).find((s: any) => {
    if (!s || (s as any).isActive === false) return false;
    if (String((s as any).sourceType || "").toLowerCase() !== "google_sheets") return false;
    return String((s as any).id || "") === normalizedSourceId;
  });
  if (!source) {
    return { success: false, reason: "source_not_found", campaignId: normalizedCampaignId, sourceId: normalizedSourceId };
  }

  const cfgRaw = safeJsonParse(source?.mappingConfig);
  const mappingConfig = cfgRaw ? { ...cfgRaw, platformContext: (cfgRaw as any).platformContext || (source as any).platformContext || undefined } : null;
  if (!mappingConfig?.connectionId || !mappingConfig?.spendColumn) {
    return { success: false, reason: "missing_google_sheets_spend_mapping", campaignId: normalizedCampaignId, sourceId: normalizedSourceId, platformContext: (source as any).platformContext || undefined };
  }

  const success = await reprocessGoogleSheetsSpend(normalizedCampaignId, source, mappingConfig);
  return { success, reason: success ? undefined : "reprocess_failed", campaignId: normalizedCampaignId, sourceId: normalizedSourceId, platformContext: mappingConfig.platformContext || (source as any).platformContext || undefined };
}

export async function runGoogleSheetsRevenueSourceRefreshForValidation(campaignId: string, sourceId: string): Promise<{ success: boolean; reason?: string; campaignId: string; sourceId: string; platformContext?: string }> {
  const normalizedCampaignId = String(campaignId || "").trim();
  const normalizedSourceId = String(sourceId || "").trim();
  if (!normalizedCampaignId || !normalizedSourceId) {
    return { success: false, reason: "invalid_request", campaignId: normalizedCampaignId, sourceId: normalizedSourceId };
  }

  for (const ctx of refreshableRevenueContexts) {
    const sources = await storage.getRevenueSources(normalizedCampaignId, ctx).catch(() => [] as any[]);
    const source = (Array.isArray(sources) ? sources : []).find((s: any) => {
      if (!s || (s as any).isActive === false) return false;
      if (String((s as any).sourceType || "") !== "google_sheets") return false;
      return String((s as any).id || "") === normalizedSourceId;
    });
    if (!source) continue;

    const cfgRaw = safeJsonParse(source?.mappingConfig);
    const mappingConfig = cfgRaw ? { ...cfgRaw, platformContext: (cfgRaw as any).platformContext || (source as any).platformContext || ctx } : null;
    if (!mappingConfig?.connectionId || !mappingConfig?.revenueColumn) {
      return { success: false, reason: "missing_google_sheets_revenue_mapping", campaignId: normalizedCampaignId, sourceId: normalizedSourceId, platformContext: ctx };
    }

    const success = await reprocessGoogleSheetsRevenue(normalizedCampaignId, source, mappingConfig);
    return { success, reason: success ? undefined : "reprocess_failed", campaignId: normalizedCampaignId, sourceId: normalizedSourceId, platformContext: ctx };
  }

  return { success: false, reason: "source_not_found", campaignId: normalizedCampaignId, sourceId: normalizedSourceId };
}

async function reprocessLinkedInSpend(campaignId: string, source: any, mappingConfig: AnyRecord): Promise<boolean> {
  if (isSourceOutsideCampaign(source, campaignId)) {
    console.error(`[Auto Refresh] Refusing LinkedIn spend reprocess for source outside campaign ${campaignId}: source=${String(source?.id || "")}`);
    return false;
  }
  const body: AnyRecord = {
    currency: mappingConfig?.currency || "USD",
    sourceId: String(source?.id || ""),
  };
  // If specific campaigns were selected during initial import, re-use them
  if (Array.isArray(mappingConfig?.selectedCampaignIds) && mappingConfig.selectedCampaignIds.length > 0) {
    body.campaignIds = mappingConfig.selectedCampaignIds;
  }
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/spend/linkedin/process`, body);
  if (!result.ok) {
    console.error(`[Auto Refresh] LinkedIn spend reprocess failed for campaign ${campaignId}:`, result.status, result.json?.error || result.text);
    return false;
  }
  console.log(`[Auto Refresh] ✅ LinkedIn spend refreshed for campaign ${campaignId}: ${result.json?.currency || "USD"} ${result.json?.totalSpend || 0} from ${result.json?.campaignCount || 0} campaigns`);
  return true;
}

/**
 * Refresh Google Sheets raw data for active main/general connections in a campaign.
 * Fetches latest data from Google Sheets API and caches it in the database
 * so page loads can serve cached data instead of making live API calls.
 */
export async function refreshGoogleSheetsDataForCampaign(campaignId: string): Promise<boolean> {
  const campaign = await storage.getCampaign(campaignId);
  const campaignPlatformRaw = String((campaign as any)?.platform || "")
    .split(",")
    .map((platform: string) => platform.trim().toLowerCase())
    .filter(Boolean);
  const campaignWantsGoogleSheets = campaignPlatformRaw.includes("google-sheets") || campaignPlatformRaw.includes("google sheets");
  if (!campaignWantsGoogleSheets) return false;

  const connections = await storage.getGoogleSheetsConnections(campaignId);
  const activeConnections = (Array.isArray(connections) ? connections : []).filter((c: any) => {
    const purpose = String(c?.purpose || "").trim().toLowerCase();
    return c.isActive !== false
      && c.accessToken
      && c.spreadsheetId
      && c.spreadsheetId !== 'pending'
      && (!purpose || purpose === "general");
  });

  if (activeConnections.length === 0) return false;

  let anyUpdated = false;

  for (const conn of activeConnections) {
    try {
      // Build range: sheet-specific or default
      const sheetName = conn.sheetName ? String(conn.sheetName).trim() : '';
      const range = sheetName
        ? `'${sheetName.replace(/'/g, "''")}'!A1:Z1000`
        : 'A1:Z1000';

      let accessToken = conn.accessToken;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(conn.spreadsheetId)}/values/${encodeURIComponent(range)}`;

      let response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(30000),
      });

      // Retry with refreshed token on 401
      if (response.status === 401 && conn.refreshToken && conn.clientId && conn.clientSecret) {
        console.log(`[Auto Refresh] 🔄 Refreshing token for Google Sheets connection ${conn.id}`);
        try {
          const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: conn.refreshToken,
              client_id: conn.clientId,
              client_secret: conn.clientSecret,
            }),
            signal: AbortSignal.timeout(15000),
          });

          if (refreshResponse.ok) {
            const tokens = await refreshResponse.json();
            accessToken = tokens.access_token;
            const expiresAt = new Date(Date.now() + ((tokens.expires_in || 3600) * 1000));
            const tokenUpdate: any = { accessToken: tokens.access_token, expiresAt };
            if (tokens.refresh_token) tokenUpdate.refreshToken = tokens.refresh_token;
            await storage.updateGoogleSheetsConnection(conn.id, tokenUpdate);

            // Retry with new token
            response = await fetch(url, {
              headers: { 'Authorization': `Bearer ${accessToken}` },
              signal: AbortSignal.timeout(30000),
            });
          }
        } catch (refreshErr: any) {
          console.error(`[Auto Refresh] Token refresh failed for connection ${conn.id}:`, refreshErr?.message || refreshErr);
        }
      }

      if (!response.ok) {
        console.warn(`[Auto Refresh] ⚠️ Google Sheets fetch failed for connection ${conn.id} (${conn.spreadsheetName || conn.spreadsheetId}): ${response.status}`);
        continue;
      }

      const data = await response.json();
      const rows = data.values || [];

      if (rows.length === 0) {
        console.log(`[Auto Refresh] ⏭️ Empty sheet for connection ${conn.id} (${conn.spreadsheetName || conn.spreadsheetId})`);
        continue;
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);
      const now = new Date();

      await storage.updateGoogleSheetsConnection(conn.id, {
        cachedData: { headers, rows: dataRows, fetchedAt: now.toISOString(), totalRows: dataRows.length },
        lastDataRefreshAt: now,
      } as any);

      console.log(`[Auto Refresh] ✅ Cached ${dataRows.length} rows for "${conn.spreadsheetName || conn.spreadsheetId}" / "${conn.sheetName || 'default'}"`);
      anyUpdated = true;
    } catch (err: any) {
      console.error(`[Auto Refresh] ❌ Google Sheets data refresh failed for connection ${conn.id}:`, err?.message || err);
    }
  }

  return anyUpdated;
}

export async function runDailyAutoRefreshOnce(): Promise<void> {
  // Prevent overlapping runs (e.g. slow API + interval overlap).
  if ((global as any).__autoRefreshInProgress) {
    console.log("[Auto Refresh] Skipping run (already in progress)");
    return;
  }
  (global as any).__autoRefreshInProgress = true;

  const startedAt = Date.now();
  console.log("\n=== DAILY AUTO-REFRESH + AUTO-PROCESS RUNNING ===");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    // 1) Refresh LinkedIn first (ensures latest conversions are available in latest import session).
    try {
      console.log("[Auto Refresh] Step 1/2: Refreshing LinkedIn data for all campaigns...");
      const linkedInTimeoutMs = Math.max(parseInt(String(process.env.AUTO_REFRESH_LINKEDIN_TIMEOUT_MS || "120000"), 10) || 120000, 10000);
      await withTimeout("LinkedIn auto-refresh", refreshAllLinkedInData(), linkedInTimeoutMs);
      console.log("[Auto Refresh] ✅ LinkedIn refresh complete");
    } catch (e: any) {
      console.error("[Auto Refresh] ⚠️ LinkedIn refresh failed (continuing to revenue reprocess):", e?.message || e);
    }

    // 2) Re-process revenue for providers that have a saved mappingConfig.
    console.log("[Auto Refresh] Step 2/2: Re-processing revenue mappings (HubSpot/Salesforce/Shopify)...");
    const campaigns = await storage.getCampaigns();

    let attempted = 0;
    let succeeded = 0;
    let skipped = 0;
    let anyCampaignUpdated = false;

    for (const campaign of campaigns) {
      const campaignId = campaign.id;
      try {
        let anyUpdated = false;
        // HubSpot revenue sources are the source of truth for saved campaign mappings.
        let hubspotRevenueCount = 0;
        for (const ctx of crmRevenueContexts) {
          const hubspotRevenueSources = (await storage.getRevenueSources(campaignId, ctx).catch(() => [] as any[]))
            .filter((s: any) => s && s.isActive !== false && String(s.sourceType || "").toLowerCase() === "hubspot");
          for (const hubspotSource of hubspotRevenueSources) {
            hubspotRevenueCount++;
            const hubCfgRaw = safeJsonParse(hubspotSource?.mappingConfig);
            const hubCfg = hubCfgRaw ? { ...hubCfgRaw, platformContext: hubCfgRaw.platformContext || hubspotSource.platformContext || ctx } : null;
            if (hubCfg?.selectedValues?.length) {
              attempted++;
              if (await reprocessHubSpot(campaignId, hubCfg, String(hubspotSource.id))) { succeeded++; anyUpdated = true; }
            } else {
              skipped++;
            }
          }
        }
        if (hubspotRevenueCount === 0) skipped++;

        // Salesforce revenue sources are the source of truth for saved campaign mappings.
        let salesforceRevenueCount = 0;
        for (const ctx of crmRevenueContexts) {
          const salesforceRevenueSources = (await storage.getRevenueSources(campaignId, ctx).catch(() => [] as any[]))
            .filter((s: any) => s && s.isActive !== false && String(s.sourceType || "").toLowerCase() === "salesforce");
          for (const salesforceSource of salesforceRevenueSources) {
            salesforceRevenueCount++;
            const sfCfgRaw = safeJsonParse(salesforceSource?.mappingConfig);
            const sfCfg = sfCfgRaw ? { ...sfCfgRaw, platformContext: sfCfgRaw.platformContext || salesforceSource.platformContext || ctx } : null;
            if (sfCfg?.selectedValues?.length) {
              attempted++;
              if (await reprocessSalesforce(campaignId, sfCfg, String(salesforceSource.id))) { succeeded++; anyUpdated = true; }
            } else {
              skipped++;
            }
          }
        }
        if (salesforceRevenueCount === 0) skipped++;

        // Shopify revenue sources are the source of truth for saved campaign mappings.
        let shopifyRevenueCount = 0;
        for (const ctx of refreshableRevenueContexts) {
          const shopifyRevenueSources = (await storage.getRevenueSources(campaignId, ctx).catch(() => [] as any[]))
            .filter((s: any) => s && s.isActive !== false && String(s.sourceType || "").toLowerCase() === "shopify");
          for (const shopifySource of shopifyRevenueSources) {
            shopifyRevenueCount++;
            const shopCfgRaw = safeJsonParse(shopifySource?.mappingConfig);
            const shopCfg = shopCfgRaw ? { ...shopCfgRaw, platformContext: shopCfgRaw.platformContext || shopifySource.platformContext || ctx } : null;
            if (shopCfg?.selectedValues?.length) {
              attempted++;
              if (await reprocessShopify(campaignId, shopCfg, String(shopifySource.id))) { succeeded++; anyUpdated = true; }
            } else {
              skipped++;
            }
          }
        }
        if (shopifyRevenueCount === 0) skipped++;

        // Google Sheets (Spend) — process ALL active Sheets spend sources
        try {
          const spendSources = await storage.getSpendSources(campaignId).catch(() => [] as any[]);
          const sheetSpendSources = (Array.isArray(spendSources) ? spendSources : []).filter((s: any) => {
            return !!s && (s as any).isActive !== false && String((s as any).sourceType || "") === "google_sheets";
          });
          for (const sheetSpend of sheetSpendSources) {
            const spendCfg = safeJsonParse(sheetSpend?.mappingConfig);
            if (spendCfg?.connectionId && spendCfg?.spendColumn) {
              attempted++;
              if (await reprocessGoogleSheetsSpend(campaignId, sheetSpend, spendCfg)) { succeeded++; anyUpdated = true; }
            } else {
              skipped++;
            }
          }
          if (sheetSpendSources.length === 0) skipped++;
        } catch {
          // ignore
        }

        // LinkedIn Ads (Spend)
        try {
          const spendSources = await storage.getSpendSources(campaignId).catch(() => [] as any[]);
          const linkedInSpend = (Array.isArray(spendSources) ? spendSources : []).find((s: any) => {
            return !!s && (s as any).isActive !== false && String((s as any).sourceType || "") === "linkedin_api";
          });
          const liCfg = safeJsonParse(linkedInSpend?.mappingConfig);
          if (linkedInSpend && liCfg?.platform === "linkedin") {
            attempted++;
            if (await reprocessLinkedInSpend(campaignId, linkedInSpend, liCfg)) { succeeded++; anyUpdated = true; }
          } else {
            skipped++;
          }
        } catch {
          // ignore
        }

        // Ad Platform Spend (Google Ads / Meta) — pull from daily metrics tables
        try {
          const spendSrcs = await storage.getSpendSources(campaignId).catch(() => [] as any[]);
          for (const src of (Array.isArray(spendSrcs) ? spendSrcs : [])) {
            if ((src as any).isActive === false) continue;
            if (String((src as any).sourceType || "") !== "ad_platforms") continue;
            if (isSourceOutsideCampaign(src, campaignId)) {
              console.error(`[Auto Refresh] Refusing ad platform spend reprocess for source outside campaign ${campaignId}: source=${String((src as any).id || "")}`);
              skipped++;
              continue;
            }
            const displayName = String((src as any).displayName || "");
            const cfg = safeJsonParse((src as any).mappingConfig);
            const selectedIds = Array.isArray(cfg?.selectedCampaignIds)
              ? new Set(cfg.selectedCampaignIds.map((id: any) => String(id || "").trim()).filter(Boolean))
              : null;
            const startDate = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
            const endDate = new Date().toISOString().slice(0, 10);

            let rows: any[] = [];
            if (displayName.includes("Google Ads")) {
              if (!selectedIds || selectedIds.size === 0) {
                console.error(`[Auto Refresh] Refusing Google Ads spend reprocess for campaign ${campaignId}: missing selected campaign IDs`);
                skipped++;
                continue;
              }
              rows = (await storage.getGoogleAdsDailyMetrics(campaignId, startDate, endDate)) || [];
              rows = rows.filter((r: any) => selectedIds.has(String(r?.googleCampaignId || "").trim()));
            } else if (displayName.includes("Meta")) {
              rows = (await storage.getMetaDailyMetrics(campaignId, startDate, endDate)) || [];
              if (selectedIds && selectedIds.size > 0) rows = rows.filter((r: any) => selectedIds.has(String(r?.metaCampaignId || "").trim()));
            } else {
              continue;
            }

            if (rows.length === 0) continue;

            const spendByDate = new Map<string, number>();
            for (const r of rows) {
              const date = String((r as any).date || "").trim();
              const spend = parseFloat(String((r as any).spend || "0"));
              if (date && !Number.isNaN(spend)) spendByDate.set(date, (spendByDate.get(date) || 0) + spend);
            }

            const records = Array.from(spendByDate.entries()).map(([date, spend]) => ({
              campaignId,
              spendSourceId: String((src as any).id),
              date,
              spend: String(spend.toFixed(2)),
              currency: "USD",
            }));

            if (records.length > 0) {
              attempted++;
              try {
                await storage.deleteSpendRecordsBySource(String((src as any).id));
                await storage.createSpendRecords(records);
                const allSpend = await storage.getSpendTotalForRange(campaignId, "2020-01-01", endDate);
                await storage.updateCampaign(campaignId, { spend: String(allSpend.totalSpend.toFixed(2)) } as any);
                succeeded++;
                anyUpdated = true;
                console.log(`[Auto Refresh] ✅ ${displayName} spend refreshed for campaign ${campaignId}: ${records.length} days`);
              } catch (err: any) {
                const provider = displayName.includes("Google Ads") ? "Google Ads" : displayName.includes("Meta") ? "Meta" : "Ad platform";
                console.error(`[Auto Refresh] ${provider} spend reprocess failed for campaign ${campaignId}:`, err?.message || err);
              }
            }
          }
        } catch (err: any) {
          console.error(`[Auto Refresh] Ad platform spend reprocess failed for campaign ${campaignId}:`, err?.message || err);
        }

        // Google Sheets (Revenue) — process ALL active Sheets revenue sources across all platform contexts
        try {
          let sheetRevCount = 0;
          for (const ctx of refreshableRevenueContexts) {
            const revenueSources = await storage.getRevenueSources(campaignId, ctx).catch(() => [] as any[]);
            const sheetRevSources = (Array.isArray(revenueSources) ? revenueSources : []).filter((s: any) => {
              return !!s && (s as any).isActive !== false && String((s as any).sourceType || "") === "google_sheets";
            });
            for (const sheetRevenue of sheetRevSources) {
              sheetRevCount++;
              const revCfgRaw = safeJsonParse(sheetRevenue?.mappingConfig);
              const revCfg = revCfgRaw ? { ...revCfgRaw, platformContext: revCfgRaw.platformContext || sheetRevenue.platformContext || ctx } : null;
              if (revCfg?.connectionId && revCfg?.revenueColumn) {
                attempted++;
                if (await reprocessGoogleSheetsRevenue(campaignId, sheetRevenue, revCfg)) { succeeded++; anyUpdated = true; }
              } else {
                skipped++;
              }
            }
          }
          if (sheetRevCount === 0) skipped++;
        } catch {
          // ignore
        }

        // Google Sheets (Raw Data Cache — for Overview/Summary/Insights tabs)
        try {
          if (await refreshGoogleSheetsDataForCampaign(campaignId)) { anyUpdated = true; }
        } catch {
          // ignore
        }

        // If any upstream sources changed for this campaign, immediately recompute GA4 KPI/Benchmark series for Insights.
        if (anyUpdated) {
          anyCampaignUpdated = true;
          await runGA4DailyKPIAndBenchmarkJobs({ campaignId }).catch((e: any) => {
            console.warn(`[Auto Refresh] KPI/Benchmark recompute failed for campaign ${campaignId}:`, e?.message || e);
          });
        }
      } catch (e: any) {
        console.error(`[Auto Refresh] Error processing campaign ${campaignId}:`, e?.message || e);
      }
    }

    // Run alert check once per refresh cycle (avoid N-times per campaign).
    if (anyCampaignUpdated) {
      await checkPerformanceAlerts().catch((e) => {
        console.warn("[Auto Refresh] Alert check failed after provider reprocess:", (e as any)?.message || e);
      });
      await checkBenchmarkPerformanceAlerts().catch((e) => {
        console.warn("[Auto Refresh] Benchmark alert check failed after provider reprocess:", (e as any)?.message || e);
      });
    }

    console.log("[Auto Refresh] Summary:");
    console.log(`   Campaigns scanned: ${campaigns.length}`);
    console.log(`   Provider jobs attempted: ${attempted}`);
    console.log(`   Provider jobs succeeded: ${succeeded}`);
    console.log(`   Provider jobs skipped (no mapping/disabled): ${skipped}`);
  } finally {
    (global as any).__autoRefreshInProgress = false;
    const elapsedMs = Date.now() - startedAt;
    console.log(`=== AUTO-REFRESH COMPLETE (${Math.round(elapsedMs / 1000)}s) ===\n`);
  }
}

/**
 * Start the daily scheduler.
 *
 * Defaults:
 * - Enabled by default (AUTO_REFRESH_ENABLED=true unless explicitly set to "false")
 * - Runs daily at 3:00 AM in AUTO_REFRESH_TIME_ZONE or GA4_DAILY_REFRESH_TIME_ZONE, default UTC
 * - Optional: run once on startup if AUTO_REFRESH_RUN_ON_STARTUP=true
 */
export function startDailyAutoRefreshScheduler(): void {
  const config = getAutoRefreshSchedulerConfig();
  if (!config.enabled) {
    console.log("[Auto Refresh] Scheduler disabled via AUTO_REFRESH_ENABLED=false");
    return;
  }

  if ((global as any).__autoRefreshSchedulerTimer || (global as any).__autoRefreshSchedulerInterval) {
    console.log("[Auto Refresh] Scheduler is already running");
    return;
  }

  console.log("\n🔁 Daily Auto-Refresh + Auto-Process Scheduler Started");
  console.log(`   Enabled: ${config.enabled}`);
  console.log(`   Scheduled time: ${config.hour.toString().padStart(2, "0")}:${config.minute.toString().padStart(2, "0")} (${config.reportingTimeZone})`);

  const scheduleNextRun = () => {
    const nextRun = getNextAutoRefreshRunAt(new Date(), config);
    const msUntilNextRun = Math.max(1000, nextRun.getTime() - Date.now());
    console.log(`[Auto Refresh] Next scheduled run at ${nextRun.toISOString()} (${formatSchedulerLocalTime(nextRun, config.reportingTimeZone)}, timezone=${config.reportingTimeZone}, expectedCompleteDay=${getLatestCompleteReportingDate(config.reportingTimeZone, nextRun)})`);
    (global as any).__autoRefreshSchedulerTimer = setTimeout(() => {
      runDailyAutoRefreshOnce()
        .catch((e: any) => console.error("[Auto Refresh] Scheduled run failed:", e?.message || e))
        .finally(scheduleNextRun);
    }, msUntilNextRun);
  };

  if (config.runOnStartup) {
    console.log("[Auto Refresh] Running once on startup (AUTO_REFRESH_RUN_ON_STARTUP=true)...");
    runDailyAutoRefreshOnce();
  }

  scheduleNextRun();
}


