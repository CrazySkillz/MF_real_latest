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

import { storage, type GA4RefreshWriteInput } from "./storage";
import { refreshAllLinkedInData } from "./linkedin-scheduler";
import { checkPerformanceAlerts } from "./kpi-scheduler";
import { checkBenchmarkPerformanceAlerts } from "./benchmark-notifications";
import { getInternalAutoRefreshToken } from "./internal-request-auth";
import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { getLatestCompleteReportingDate, getNextDailyRunAt, getReportingDateEndAt, normalizeReportingTimeZone } from "./utils/reporting-timezone";
import { aggregateCsvRevenueRows, normalizeFinancialSourceDateKey } from "./utils/csv";
import { buildGoogleSheetsRevenueRowRanges, resolveGoogleSheetsRevenueGrid } from "./utils/google-sheets-revenue-ranges";
import { findInvalidGoogleSheetsRevenueAmountRows } from "./utils/google-sheets-revenue-amount";
import { beginFinancialDailySnapshotRefreshObservation, recordFinancialDailySnapshotRefreshEvidence } from "./utils/financial-daily-snapshot-observation";
import { writeFinancialDailySnapshotIfReady } from "./utils/financial-daily-snapshot-writer";
import { randomUUID } from "crypto";
import { isSupportedGoogleAdsSpendConnectionMethod } from "./utils/google-ads-service-account";
import { filterActiveSchedulerCampaigns } from "./utils/campaign-scheduler-eligibility";

type AnyRecord = Record<string, any>;
type ReprocessResult = { success: boolean; status?: number; error?: string };
type AutoRefreshSchedulerConfig = {
  enabled: boolean;
  reportingTimeZone: string;
  hour: number;
  minute: number;
  runOnStartup: boolean;
  googleSheetsSpendIntervalMinutes: number;
  salesforcePipelineIntervalMinutes: number;
};
type AutoRefreshRunTrigger = "startup" | "scheduled" | "manual";
export type AutoRefreshRunOptions = GA4RefreshWriteInput & {
  financialSourcesOnly?: boolean;
  deferDownstream?: boolean;
  campaignId?: string;
  campaignConcurrency?: 1 | 2;
  excludeCampaignIds?: string[];
  onCampaignRefreshed?: (campaignId: string) => Promise<void>;
};
type AutoRefreshRunStatus = "idle" | "running" | "success" | "failed" | "skipped";
export type AutoRefreshRunSummary = {
  campaignsScanned: number;
  providerJobsAttempted: number;
  providerJobsSucceeded: number;
  providerJobsRetained?: number;
  providerJobsSkipped: number;
  campaignErrors: number;
  recomputeFailed: boolean;
  linkedInRefreshFailed: boolean;
};

const autoRefreshSchedulerStatus = {
  startedAt: null as Date | null,
  config: null as AutoRefreshSchedulerConfig | null,
  nextRunAt: null as Date | null,
  lastRunStartedAt: null as Date | null,
  lastRunFinishedAt: null as Date | null,
  lastRunTrigger: null as AutoRefreshRunTrigger | null,
  lastRunStatus: "idle" as AutoRefreshRunStatus,
  lastSkippedAt: null as Date | null,
  lastErrorTime: null as Date | null,
  lastError: null as string | null,
  lastRunSummary: null as AutoRefreshRunSummary | null,
  totalRuns: 0,
  totalStartupRuns: 0,
  totalScheduledRuns: 0,
  totalManualRuns: 0,
  totalSkippedRuns: 0,
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
  const googleSheetsSpendIntervalMinutes = parseBoundedInt(env.GOOGLE_SHEETS_SPEND_REFRESH_INTERVAL_MINUTES, 1, 1, 60);
  const salesforcePipelineIntervalMinutes = parseBoundedInt(env.SALESFORCE_PIPELINE_REFRESH_INTERVAL_MINUTES, 5, 1, 60);
  return { enabled, reportingTimeZone, hour, minute, runOnStartup, googleSheetsSpendIntervalMinutes, salesforcePipelineIntervalMinutes };
}

export function getNextAutoRefreshRunAt(now = new Date(), config: AutoRefreshSchedulerConfig = getAutoRefreshSchedulerConfig()): Date {
  return getNextDailyRunAt(now, config.reportingTimeZone, config.hour, config.minute);
}

const toIsoOrNull = (value: Date | null) => value ? value.toISOString() : null;

export function getAutoRefreshRunFailure(summary: Pick<
  AutoRefreshRunSummary,
  "providerJobsAttempted" | "providerJobsSucceeded" | "providerJobsRetained" | "campaignErrors" | "recomputeFailed" | "linkedInRefreshFailed"
>): string | null {
  const failures: string[] = [];
  const providerFailures = Math.max(0, summary.providerJobsAttempted - summary.providerJobsSucceeded - Number(summary.providerJobsRetained || 0));
  if (providerFailures > 0) failures.push(`${providerFailures} provider job${providerFailures === 1 ? "" : "s"} failed`);
  if (summary.campaignErrors > 0) failures.push(`${summary.campaignErrors} campaign error${summary.campaignErrors === 1 ? "" : "s"}`);
  if (summary.recomputeFailed) failures.push("KPI/Benchmark recompute failed");
  if (summary.linkedInRefreshFailed) failures.push("LinkedIn refresh failed");
  return failures.length > 0 ? `Auto-refresh incomplete (${failures.join("; ")})` : null;
}

export function getCampaignAutoRefreshFailures(input: {
  providerJobsAttempted: number;
  providerJobsSucceeded: number;
  providerJobsRetained?: number;
  campaignError: boolean;
  recomputeFailed: boolean;
  linkedInRequired: boolean;
  linkedInLastRefreshAt: unknown;
  runStartedAt: Date;
}): string[] {
  const failures: string[] = [];
  const providerFailures = Math.max(0, input.providerJobsAttempted - input.providerJobsSucceeded - Number(input.providerJobsRetained || 0));
  if (providerFailures > 0) failures.push(`${providerFailures}_provider_jobs_failed`);
  if (input.campaignError) failures.push("campaign_refresh_failed");
  if (input.recomputeFailed) failures.push("campaign_recompute_failed");
  if (input.linkedInRequired) {
    const refreshedAt = new Date(input.linkedInLastRefreshAt as any).getTime();
    if (!Number.isFinite(refreshedAt) || refreshedAt < input.runStartedAt.getTime()) {
      failures.push("linkedin_refresh_incomplete");
    }
  }
  return failures;
}

export function getAutoRefreshSchedulerStatus() {
  return {
    started: Boolean(autoRefreshSchedulerStatus.startedAt),
    timerScheduled: Boolean((global as any).__autoRefreshSchedulerTimer),
    inProgress: Boolean((global as any).__autoRefreshInProgress),
    config: autoRefreshSchedulerStatus.config || getAutoRefreshSchedulerConfig(),
    startedAt: toIsoOrNull(autoRefreshSchedulerStatus.startedAt),
    nextRunAt: toIsoOrNull(autoRefreshSchedulerStatus.nextRunAt),
    lastRunStartedAt: toIsoOrNull(autoRefreshSchedulerStatus.lastRunStartedAt),
    lastRunFinishedAt: toIsoOrNull(autoRefreshSchedulerStatus.lastRunFinishedAt),
    lastRunTrigger: autoRefreshSchedulerStatus.lastRunTrigger,
    lastRunStatus: autoRefreshSchedulerStatus.lastRunStatus,
    lastSkippedAt: toIsoOrNull(autoRefreshSchedulerStatus.lastSkippedAt),
    lastErrorTime: toIsoOrNull(autoRefreshSchedulerStatus.lastErrorTime),
    lastError: autoRefreshSchedulerStatus.lastError,
    lastRunSummary: autoRefreshSchedulerStatus.lastRunSummary,
    totalRuns: autoRefreshSchedulerStatus.totalRuns,
    totalStartupRuns: autoRefreshSchedulerStatus.totalStartupRuns,
    totalScheduledRuns: autoRefreshSchedulerStatus.totalScheduledRuns,
    totalManualRuns: autoRefreshSchedulerStatus.totalManualRuns,
    totalSkippedRuns: autoRefreshSchedulerStatus.totalSkippedRuns,
  };
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

async function postJson(path: string, body: AnyRecord, refreshWriteInput: GA4RefreshWriteInput = {}): Promise<{ ok: boolean; status: number; json?: any; text?: string }> {
  if ("refreshScope" in refreshWriteInput) await storage.writeWithGA4RefreshOwnership(refreshWriteInput.refreshScope, async () => {});
  const url = `${getServerBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
  const timeoutMs = Math.max(parseInt(String(process.env.AUTO_REFRESH_INTERNAL_TIMEOUT_MS || "120000"), 10) || 120000, 10000);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-auto-refresh-token": getInternalAutoRefreshToken(),
      ...(refreshWriteInput.refreshScope ? { "x-internal-ga4-refresh-scope": JSON.stringify(refreshWriteInput.refreshScope) } : {}) },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await resp.text();
  let json: any = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    // ignore
  }
  if (refreshWriteInput.refreshScope) {
    await storage.writeWithGA4RefreshOwnership(refreshWriteInput.refreshScope, async () => {});
    if (!resp.ok) throw Object.assign(new Error(`GA4 financial refresh request failed (${resp.status})`), {
      code: resp.status === 429 || resp.status >= 500 ? "GA4_TRANSIENT_ERROR" : "GA4_FINANCIAL_REFRESH_REJECTED",
    });
    if (json?.success !== true) throw Object.assign(new Error("GA4 financial refresh success was not confirmed"), {
      code: "GA4_FINANCIAL_REFRESH_INCOMPLETE",
    });
  }
  return { ok: resp.ok, status: resp.status, json, text };
}

function isStaleRevenueSourceReprocess(result: { status: number; json?: any; text?: string }): boolean {
  const message = String(result.json?.error || result.text || "").toLowerCase();
  return (result.status === 404 && message.includes("revenue source not found"))
    || (result.status === 409 && message.includes("revenue source changed"));
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

async function withTimeout<T>(label: string, operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  try {
    // Keep the shared stage occupied until in-flight work settles; never detach writes.
    const result = await operation(controller.signal);
    controller.signal.throwIfAborted();
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function reprocessHubSpot(campaignId: string, mappingConfig: AnyRecord, sourceId?: string, refreshWriteInput: GA4RefreshWriteInput = {}): Promise<boolean> {
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
    ...(mappingConfig.expectedSourceMappingConfig ? { expectedSourceMappingConfig: mappingConfig.expectedSourceMappingConfig } : {}),
    ...(Array.isArray(mappingConfig.campaignMappings) && mappingConfig.campaignMappings.length > 0
      ? { campaignMappings: mappingConfig.campaignMappings }
      : {}),
  };
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/hubspot/save-mappings`, body, refreshWriteInput);
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

async function reprocessSalesforce(campaignId: string, mappingConfig: AnyRecord, sourceId?: string, refreshWriteInput: GA4RefreshWriteInput = {}): Promise<boolean> {
  return (await reprocessSalesforceWithDetails(campaignId, mappingConfig, sourceId, refreshWriteInput)).success;
}

async function reprocessSalesforceWithDetails(campaignId: string, mappingConfig: AnyRecord, sourceId?: string, refreshWriteInput: GA4RefreshWriteInput = {}): Promise<ReprocessResult> {
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
    ...(mappingConfig.expectedSourceMappingConfig ? { expectedSourceMappingConfig: mappingConfig.expectedSourceMappingConfig } : {}),
    ...(Array.isArray(mappingConfig.campaignMappings) && mappingConfig.campaignMappings.length > 0
      ? { campaignMappings: mappingConfig.campaignMappings }
      : {}),
  };
  let result: Awaited<ReturnType<typeof postJson>>;
  try {
    result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/salesforce/save-mappings`, body, refreshWriteInput);
  } catch (error: any) {
    if (refreshWriteInput.refreshScope) throw error;
    console.error(`[Auto Refresh] Salesforce reprocess failed for campaign ${campaignId}:`, error?.message || error);
    return { success: false, error: String(error?.message || error || "Salesforce request failed") };
  }
  if (!result.ok) {
    if (isStaleRevenueSourceReprocess(result)) {
      console.warn(`[Auto Refresh] Skipping stale Salesforce revenue source for campaign ${campaignId}`);
      return { success: false, status: result.status, error: "stale_revenue_source" };
    }
    console.error(`[Auto Refresh] Salesforce reprocess failed for campaign ${campaignId}:`, result.status, result.json?.error || result.text);
    return { success: false, status: result.status, error: String(result.json?.code || result.json?.error || result.text || "Salesforce request failed") };
  }
  const totalRevenue = Number(result.json?.totalRevenue || 0);
  const materializedRecordCount = Number(result.json?.materializedRecordCount || 0);
  const materializedDates = Array.isArray(result.json?.materializedDates) ? result.json.materializedDates.map(String) : [];
  const unmatchedSelectedValues = Array.isArray(result.json?.unmatchedSelectedValues) ? result.json.unmatchedSelectedValues.map(String) : [];
  const unmatchedSelectedDiagnostics = Array.isArray(result.json?.unmatchedSelectedDiagnostics) ? result.json.unmatchedSelectedDiagnostics : [];
  const isGa4RevenueSource = String(mappingConfig.platformContext || 'ga4').trim().toLowerCase() === 'ga4';
  if (isGa4RevenueSource && materializedRecordCount <= 0) {
    console.error(`[Auto Refresh] Salesforce reprocess produced no materialized revenue records for campaign ${campaignId}`);
    return { success: false, status: 422, error: "missing_materialized_revenue" };
  }
  console.log(`[Auto Refresh] Salesforce reprocess complete for campaign ${campaignId}: source=${sourceId || "new"}, totalRevenue=${totalRevenue}, materializedRecordCount=${materializedRecordCount}, dateField=${String(mappingConfig.dateField || "CloseDate")}, dates=${materializedDates.join(",") || "none"}, unmatchedSelectedValues=${unmatchedSelectedValues.join(",") || "none"}`);
  if (unmatchedSelectedValues.length > 0) {
    console.log(`[Auto Refresh] Salesforce unmatched diagnostics for campaign ${campaignId}: ${JSON.stringify(unmatchedSelectedDiagnostics)}`);
  }
  return { success: true, status: result.status };
}

export function isRetryableSalesforceRefreshFailure(result: ReprocessResult): boolean {
  const status = Number(result.status || 0);
  return !result.success && (status === 0 || status === 408 || status === 429 || status >= 500);
}

export async function hasCompletedDaySalesforceEvidence(
  source: any,
  campaign: any,
  now: Date,
  loadBreakdown = (campaignId: string, endDate: string) => storage.getRevenueBreakdownBySource(campaignId, "1900-01-01", endDate, "ga4"),
): Promise<boolean> {
  const mapping = safeJsonParse(source?.mappingConfig);
  const reportingDate = getLatestCompleteReportingDate(campaign?.reportingTimeZone, now);
  const completedDayEnd = getReportingDateEndAt(reportingDate, campaign?.reportingTimeZone);
  const lastSyncedAt = new Date(mapping?.lastSyncedAt || "");
  const currency = String(source?.currency || "").trim().toUpperCase();
  const campaignCurrency = String(campaign?.currency || "USD").trim().toUpperCase();
  const lastTotalRevenue = Number(mapping?.lastTotalRevenue);
  if (!source?.id || !campaign?.id || !completedDayEnd
    || Number.isNaN(lastSyncedAt.getTime())
    || lastSyncedAt.getTime() <= completedDayEnd.getTime()
    || mapping?.dailyMaterialization !== "selected_date_field_v1"
    || !Number.isFinite(lastTotalRevenue)
    || currency !== campaignCurrency) return false;
  try {
    const breakdown = await loadBreakdown(String(campaign.id), reportingDate);
    const persistedSource = breakdown.find((item) => String(item.sourceId) === String(source.id));
    return Boolean(persistedSource)
      && String(persistedSource?.currency || currency).trim().toUpperCase() === campaignCurrency
      && Math.abs(Number(persistedSource?.revenue) - lastTotalRevenue) < 0.005;
  } catch {
    return false;
  }
}

async function reprocessShopify(campaignId: string, mappingConfig: AnyRecord, sourceId?: string, refreshWriteInput: GA4RefreshWriteInput = {}): Promise<boolean> {
  const body: AnyRecord = {
    campaignField: mappingConfig.campaignField,
    selectedValues: mappingConfig.selectedValues,
    revenueMetric: mappingConfig.revenueMetric,
    revenueClassification: mappingConfig.revenueClassification,
    days: mappingConfig.days,
    platformContext: mappingConfig.platformContext,
    valueSource: mappingConfig.valueSource,
    ...(mappingConfig.refreshRunId ? { refreshRunId: mappingConfig.refreshRunId } : {}),
    ...(sourceId ? { sourceId } : {}),
    ...(refreshWriteInput.refreshScope ? { expectedSourceMappingConfig: mappingConfig.expectedSourceMappingConfig } : {}),
    ...(Array.isArray(mappingConfig.campaignMappings) && mappingConfig.campaignMappings.length > 0
      ? { campaignMappings: mappingConfig.campaignMappings }
      : {}),
  };
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/shopify/save-mappings`, body, refreshWriteInput);
  if (!result.ok) {
    if (isStaleRevenueSourceReprocess(result)) {
      console.warn(`[Auto Refresh] Skipping stale Shopify revenue source for campaign ${campaignId}`);
      return false;
    }
    console.error(`[Auto Refresh] Shopify reprocess failed for campaign ${campaignId} (run ${String(mappingConfig.refreshRunId || "unknown")}):`, result.status, result.json?.error || result.text);
    return false;
  }
  console.log(`[Auto Refresh] Shopify reprocess complete for campaign ${campaignId} (run ${String(mappingConfig.refreshRunId || "unknown")})`);
  return true;
}

type RevenueSourceRefreshValidationResult = {
  success: boolean;
  reason?: string;
  campaignId: string;
  sourceId: string;
  platformContext?: string;
};

export async function runHubSpotRevenueSourceRefreshForValidation(campaignId: string, sourceId: string): Promise<RevenueSourceRefreshValidationResult> {
  const normalizedCampaignId = String(campaignId || "").trim();
  const normalizedSourceId = String(sourceId || "").trim();
  if (!normalizedCampaignId || !normalizedSourceId) {
    return { success: false, reason: "invalid_request", campaignId: normalizedCampaignId, sourceId: normalizedSourceId };
  }

  const sources = await storage.getRevenueSources(normalizedCampaignId, "ga4").catch(() => [] as any[]);
  const source = (Array.isArray(sources) ? sources : []).find((s: any) =>
    s && s.isActive !== false && String(s.sourceType || "").toLowerCase() === "hubspot" && String(s.id || "") === normalizedSourceId
  );
  if (!source) {
    return { success: false, reason: "source_not_found", campaignId: normalizedCampaignId, sourceId: normalizedSourceId };
  }

  const cfgRaw = safeJsonParse(source?.mappingConfig);
  const savedPlatformContext = String(cfgRaw?.platformContext || source.platformContext || "ga4").trim().toLowerCase();
  if (savedPlatformContext !== "ga4") {
    return { success: false, reason: "source_not_found", campaignId: normalizedCampaignId, sourceId: normalizedSourceId };
  }
  const mappingConfig = cfgRaw ? { ...cfgRaw, platformContext: "ga4", expectedSourceMappingConfig: String(source.mappingConfig) } : null;
  if (!mappingConfig?.selectedValues?.length) {
    return { success: false, reason: "missing_hubspot_revenue_mapping", campaignId: normalizedCampaignId, sourceId: normalizedSourceId, platformContext: "ga4" };
  }

  const success = await reprocessHubSpot(normalizedCampaignId, mappingConfig, normalizedSourceId);
  return { success, reason: success ? undefined : "reprocess_failed", campaignId: normalizedCampaignId, sourceId: normalizedSourceId, platformContext: "ga4" };
}

export async function runShopifyRevenueSourceRefreshForValidation(campaignId: string, sourceId: string): Promise<RevenueSourceRefreshValidationResult> {
  const normalizedCampaignId = String(campaignId || "").trim();
  const normalizedSourceId = String(sourceId || "").trim();
  if (!normalizedCampaignId || !normalizedSourceId) {
    return { success: false, reason: "invalid_request", campaignId: normalizedCampaignId, sourceId: normalizedSourceId };
  }

  const sources = await storage.getRevenueSources(normalizedCampaignId, "ga4").catch(() => [] as any[]);
  const source = (Array.isArray(sources) ? sources : []).find((s: any) =>
    s && s.isActive !== false && String(s.sourceType || "").toLowerCase() === "shopify" && String(s.id || "") === normalizedSourceId
  );
  if (!source) {
    return { success: false, reason: "source_not_found", campaignId: normalizedCampaignId, sourceId: normalizedSourceId };
  }

  const cfgRaw = safeJsonParse(source?.mappingConfig);
  const savedPlatformContext = String(cfgRaw?.platformContext || source.platformContext || "ga4").trim().toLowerCase();
  if (savedPlatformContext !== "ga4") {
    return { success: false, reason: "source_not_found", campaignId: normalizedCampaignId, sourceId: normalizedSourceId };
  }
  const mappingConfig = cfgRaw ? { ...cfgRaw, platformContext: "ga4", refreshRunId: randomUUID() } : null;
  if (!mappingConfig?.selectedValues?.length) {
    return { success: false, reason: "missing_shopify_revenue_mapping", campaignId: normalizedCampaignId, sourceId: normalizedSourceId, platformContext: "ga4" };
  }

  const success = await reprocessShopify(normalizedCampaignId, mappingConfig, normalizedSourceId);
  return { success, reason: success ? undefined : "reprocess_failed", campaignId: normalizedCampaignId, sourceId: normalizedSourceId, platformContext: "ga4" };
}

async function reprocessGoogleSheetsSpendWithDetails(campaignId: string, source: any, mappingConfig: AnyRecord, refreshWriteInput: GA4RefreshWriteInput = {}): Promise<ReprocessResult> {
  const connectionId = String(mappingConfig?.connectionId || "").trim();
  if (!connectionId) return { success: false, error: "missing_connection_id" };
  if (isSourceOutsideCampaign(source, campaignId)) {
    console.error(`[Auto Refresh] Refusing Google Sheets spend reprocess for source outside campaign ${campaignId}: source=${String(source?.id || "")}`);
    return { success: false, error: "source_outside_campaign" };
  }
  const body = {
    connectionId,
    // The process endpoint tolerates extra keys; we keep the exact mapping that the user configured.
    mapping: { ...(mappingConfig || {}), sourceId: String(source?.id || "") },
    platformContext: mappingConfig?.platformContext || source?.platformContext || "ga4",
    expectedSourceMappingConfig: source.mappingConfig ?? null,
  };
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/spend/sheets/process`, body, refreshWriteInput);
  if (!result.ok) {
    const error = result.json?.error || result.json?.message || result.text || `HTTP ${result.status}`;
    console.error(`[Auto Refresh] Google Sheets spend reprocess failed for campaign ${campaignId}:`, result.status, error);
    return { success: false, status: result.status, error };
  }
  return { success: true, status: result.status };
}

async function reprocessGoogleSheetsSpend(campaignId: string, source: any, mappingConfig: AnyRecord, refreshWriteInput: GA4RefreshWriteInput = {}): Promise<boolean> {
  return (await reprocessGoogleSheetsSpendWithDetails(campaignId, source, mappingConfig, refreshWriteInput)).success;
}
async function reprocessGoogleSheetsRevenue(campaignId: string, source: any, mappingConfig: AnyRecord, refreshWriteInput: GA4RefreshWriteInput = {}): Promise<boolean> {
  const connectionId = String(mappingConfig?.connectionId || "").trim();
  if (!connectionId) return false;
  if (isSourceOutsideCampaign(source, campaignId)) {
    console.error(`[Auto Refresh] Refusing Google Sheets revenue reprocess for source outside campaign ${campaignId}: source=${String(source?.id || "")}`);
    return false;
  }
  try {
    if ("refreshScope" in refreshWriteInput) {
      if (refreshWriteInput.refreshScope?.campaignId !== campaignId || String(mappingConfig.platformContext || source?.platformContext || "ga4") !== "ga4") throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      await storage.writeWithGA4RefreshOwnership(refreshWriteInput.refreshScope, async () => {});
    }
    // Direct DB operations — avoids auth/rate-limit issues from HTTP self-calls
    const connections = await storage.getGoogleSheetsConnections(campaignId, undefined, refreshWriteInput);
    let conn = (connections as any[]).find((c: any) => String(c.id) === connectionId);
    if (!conn) {
      // Try without purpose filter
      const allConns = await storage.getGoogleSheetsConnections(campaignId, undefined, refreshWriteInput);
      conn = (allConns as any[]).find((c: any) => String(c.id) === connectionId);
    }
    if (!conn) {
      console.warn(`[Auto Refresh] Google Sheets revenue: connection ${connectionId} not found for campaign ${campaignId}`);
      return false;
    }

    // Read sheet data with token refresh
    let accessToken = String(conn.accessToken || "");
    const refreshAccessToken = async (): Promise<string | null> => {
      if (!conn.refreshToken || !conn.clientId || !conn.clientSecret) return null;
      const tr = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refreshToken, client_id: conn.clientId, client_secret: conn.clientSecret }),
        signal: AbortSignal.timeout(15000),
      });
      if (!tr.ok) return null;
      const tokens = await tr.json();
      const nextAccessToken = String(tokens.access_token || "");
      if (!nextAccessToken) return null;
      const renewed = await storage.updateGoogleSheetsConnection(conn.id, {
        accessToken: nextAccessToken,
        expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      } as any, { ...refreshWriteInput, expectedConnection: conn });
      if (refreshWriteInput.refreshScope && renewed) Object.assign(conn, renewed);
      if (tokens.refresh_token) conn.refreshToken = tokens.refresh_token;
      return nextAccessToken;
    };
    if (!accessToken) {
      accessToken = await refreshAccessToken().catch(() => null) || "";
      if (!accessToken) return false;
    }
    const fetchAuthorized = async (url: string): Promise<Response> => {
      let response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000) });
      if (response.status === 401) {
        const refreshedAccessToken = await refreshAccessToken().catch(() => null);
        if (refreshedAccessToken) {
          accessToken = refreshedAccessToken;
          response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000) });
        }
      }
      return response;
    };
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(conn.spreadsheetId)}?fields=sheets(properties(title,index,hidden,gridProperties(rowCount)))`;
    const metadataResponse = await fetchAuthorized(metadataUrl);
    if (!metadataResponse.ok) {
      console.warn(`[Auto Refresh] Google Sheets revenue metadata fetch failed for campaign ${campaignId}: HTTP ${metadataResponse.status}`);
      return false;
    }
    const metadata = await metadataResponse.json().catch(() => null);
    const grid = resolveGoogleSheetsRevenueGrid(metadata?.sheets, conn.sheetName);
    if (!grid) return false;
    let ranges: string[];
    try {
      ranges = buildGoogleSheetsRevenueRowRanges(grid.sheetName, grid.rowCount);
    } catch (error: any) {
      console.warn(`[Auto Refresh] Google Sheets revenue range rejected for campaign ${campaignId}: ${error?.message || error}`);
      return false;
    }
    const allRows: any[][] = [];
    for (const range of ranges) {
      const response = await fetchAuthorized(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(conn.spreadsheetId)}/values/${encodeURIComponent(range)}`
      );
      if (!response.ok) {
        console.warn(`[Auto Refresh] Google Sheets revenue chunk fetch failed for campaign ${campaignId}: HTTP ${response.status}`);
        return false;
      }
      const data = await response.json().catch(() => null);
      if (!data || (data.values != null && !Array.isArray(data.values))) return false;
      if (Array.isArray(data.values)) allRows.push(...data.values);
    }
    if (allRows.length < 2) return false;
    const headers: string[] = allRows[0];
    const dataRows: string[][] = allRows.slice(1);

    // Parse rows using stored mapping
    const revenueCol = String(mappingConfig.revenueColumn || "");
    const campaignCol = String(mappingConfig.campaignColumn || "");
    const campaignValues: string[] = Array.isArray(mappingConfig.campaignValues) ? mappingConfig.campaignValues : [];
    const campaignValueSet = campaignValues.length > 0 ? new Set(campaignValues) : null;
    const mappedRows = dataRows.map((row) => {
      const rowObj: AnyRecord = {};
      headers.forEach((header, index) => { rowObj[header] = row[index] ?? ""; });
      return rowObj;
    });

    const parseNum = (v: any) => { const n = parseFloat(String(v || "0").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : 0; };

    const dateCol = mappingConfig.dateColumn ? String(mappingConfig.dateColumn) : null;
    const platformContext = String(mappingConfig.platformContext || source?.platformContext || "ga4") as any;
    if (platformContext === "ga4") {
      if (campaignCol === revenueCol || (dateCol && (dateCol === revenueCol || dateCol === campaignCol))) return false;
      const invalidAmountRows = findInvalidGoogleSheetsRevenueAmountRows(mappedRows, {
        revenueColumn: revenueCol,
        campaignColumn: campaignCol || null,
        campaignValues,
      });
      if (invalidAmountRows.length > 0) {
        console.warn(`[Auto Refresh] Google Sheets revenue has ${invalidAmountRows.length} selected row(s) with unsupported amount formatting for campaign ${campaignId}; preserving last-good data`);
        return false;
      }
      const validation = aggregateCsvRevenueRows(mappedRows.map((row) => ({
        ...row,
        [revenueCol]: parseNum(row[revenueCol]),
      })), {
        revenueColumn: revenueCol,
        dateColumn: dateCol,
        campaignColumn: campaignCol || null,
        campaignValues,
      });
      if (validation.keptRows === 0 || (dateCol && validation.undatedRevenue > 0)) return false;
    }
    let totalRevenue = 0;
    let kept = 0;
    const dailyRevenueMap = new Map<string, number>(); // date -> revenue
    const campaignValueRevenueTotals = new Map<string, number>();
    for (const rowObj of mappedRows) {
      if (campaignCol && campaignValueSet) {
        const v = String(rowObj[campaignCol] ?? "").trim();
        if (!campaignValueSet.has(v)) continue;
      }
      const rev = parseNum(rowObj[revenueCol]);
      if (rev > 0) {
        totalRevenue += rev;
        kept++;
        const campaignKey = campaignCol ? String(rowObj[campaignCol] ?? "").trim() : "";
        if (platformContext === "ga4" && campaignKey) {
          campaignValueRevenueTotals.set(campaignKey, (campaignValueRevenueTotals.get(campaignKey) || 0) + rev);
        }

        // Track daily revenue if date column provided
        if (dateCol) {
          const dateStr = String(rowObj[dateCol] ?? "").trim();
          if (dateStr) {
            const normalizedDate = platformContext === "ga4"
              ? normalizeFinancialSourceDateKey(dateStr)
              : (!isNaN(new Date(dateStr).getTime()) ? new Date(dateStr).toISOString().split('T')[0] : null);
            if (normalizedDate) {
              dailyRevenueMap.set(normalizedDate, (dailyRevenueMap.get(normalizedDate) || 0) + rev);
            }
          }
        }
      }
    }

    const total = Number(totalRevenue.toFixed(2));
    const sourceId = String(source.id);
    const campaign = await storage.getCampaign(campaignId);
    const endDate = platformContext === "ga4"
      ? getLatestCompleteReportingDate((campaign as any)?.reportingTimeZone)
      : new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const campaignCurrency = String((campaign as any)?.currency || "USD").trim().toUpperCase();
    const requestedCurrency = String(mappingConfig.currency || source?.currency || campaignCurrency).trim().toUpperCase();
    if (platformContext === "ga4" && requestedCurrency !== campaignCurrency) return false;
    const currency = platformContext === "ga4" ? campaignCurrency : requestedCurrency;
    const records = total > 0
      ? dateCol && dailyRevenueMap.size > 0
        ? Array.from(dailyRevenueMap.entries()).filter(([, rev]) => rev > 0).map(([date, rev]) => ({ campaignId, date, revenue: Number(rev.toFixed(2)).toFixed(2) as any, currency }))
        : [{ campaignId, date: endDate, revenue: total.toFixed(2) as any, currency }]
      : [];
    await storage.replaceRevenueSourceWithRecords(campaignId, sourceId, "google_sheets", platformContext, {
      campaignId,
      sourceType: "google_sheets",
      platformContext,
      displayName: source?.displayName || "Google Sheets revenue",
      currency,
      mappingConfig: JSON.stringify({
        ...mappingConfig,
        ...(platformContext === "ga4" ? {
          campaignValueRevenueTotals: campaignCol
            ? Array.from(campaignValueRevenueTotals.entries()).map(([campaignValue, revenue]) => ({ campaignValue, revenue: Number(revenue.toFixed(2)) }))
            : null,
        } : {}),
        lastSyncedAt: new Date().toISOString(),
      }),
      isActive: true,
    } as any, records as any, source.mappingConfig ?? null, refreshWriteInput);

    console.log(`[Auto Refresh] ✅ Google Sheets revenue synced for campaign ${campaignId}: $${total} from ${kept} rows`);
    return true;
  } catch (err: any) {
    if (refreshWriteInput.refreshScope) throw err;
    console.error(`[Auto Refresh] Google Sheets revenue reprocess failed for campaign ${campaignId}:`, err?.message || err);
    return false;
  }
}

export async function runGoogleSheetsSpendSourceRefreshForValidation(campaignId: string, sourceId: string): Promise<{ success: boolean; reason?: string; campaignId: string; sourceId: string; platformContext?: string; processStatus?: number; processError?: string }> {
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
  const mappingConfig = cfgRaw ? { ...cfgRaw, platformContext: (cfgRaw as any).platformContext || (source as any).platformContext || "ga4" } : null;
  if (!mappingConfig?.connectionId || !mappingConfig?.spendColumn) {
    return { success: false, reason: "missing_google_sheets_spend_mapping", campaignId: normalizedCampaignId, sourceId: normalizedSourceId, platformContext: (source as any).platformContext || undefined };
  }

  const result = await reprocessGoogleSheetsSpendWithDetails(normalizedCampaignId, source, mappingConfig);
  return {
    success: result.success,
    reason: result.success ? undefined : "reprocess_failed",
    campaignId: normalizedCampaignId,
    sourceId: normalizedSourceId,
    platformContext: mappingConfig.platformContext || (source as any).platformContext || undefined,
    processStatus: result.status,
    processError: result.error,
  };
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

export async function runGoogleSheetsSpendAutoRefreshOnce(): Promise<void> {
  if ((global as any).__autoRefreshInProgress || (global as any).__googleSheetsSpendRefreshInProgress || (global as any).__salesforcePipelineRefreshInProgress) {
    console.log("[Google Sheets Spend Refresh] Skipping run (refresh already in progress)");
    return;
  }
  (global as any).__googleSheetsSpendRefreshInProgress = true;

  try {
    const campaigns = filterActiveSchedulerCampaigns(await storage.getCampaigns());
    for (const campaign of campaigns) {
      const campaignId = String(campaign.id);
      try {
        const spendSources = await storage.getSpendSources(campaignId).catch(() => [] as any[]);
        const sheetSpendSources = (Array.isArray(spendSources) ? spendSources : []).filter((source: any) =>
          source && source.isActive !== false && String(source.sourceType || "") === "google_sheets"
        );
        for (const source of sheetSpendSources) {
          const mappingConfig = safeJsonParse(source?.mappingConfig);
          if (!mappingConfig?.connectionId || !mappingConfig?.spendColumn) continue;
          mappingConfig.platformContext = String(mappingConfig?.platformContext || source?.platformContext || "ga4").trim().toLowerCase();
          await reprocessGoogleSheetsSpend(campaignId, source, mappingConfig);
        }
      } catch (e: any) {
        console.error(`[Google Sheets Spend Refresh] Error processing campaign ${campaignId}:`, e?.message || e);
      }
    }
  } finally {
    (global as any).__googleSheetsSpendRefreshInProgress = false;
  }
}

export async function runGoogleSheetsRevenueAutoRefreshOnce(): Promise<void> {
  if ((global as any).__autoRefreshInProgress || (global as any).__googleSheetsSpendRefreshInProgress || (global as any).__salesforcePipelineRefreshInProgress) {
    console.log("[Google Sheets Revenue Refresh] Skipping run (refresh already in progress)");
    return;
  }
  (global as any).__googleSheetsSpendRefreshInProgress = true;

  try {
    const campaigns = filterActiveSchedulerCampaigns(await storage.getCampaigns());
    for (const campaign of campaigns) {
      const campaignId = String(campaign.id);
      try {
        const revenueSources = await storage.getRevenueSources(campaignId, "ga4").catch(() => [] as any[]);
        const sheetRevenueSources = (Array.isArray(revenueSources) ? revenueSources : []).filter((source: any) =>
          source
          && source.isActive !== false
          && String(source.sourceType || "").trim().toLowerCase() === "google_sheets"
          && String(source.platformContext || "ga4").trim().toLowerCase() === "ga4"
          && !isSourceOutsideCampaign(source, campaignId)
        );
        for (const source of sheetRevenueSources) {
          const parsedMappingConfig = safeJsonParse(source?.mappingConfig);
          const mappingContext = String(parsedMappingConfig?.platformContext || source?.platformContext || "ga4").trim().toLowerCase();
          if (mappingContext !== "ga4" || !parsedMappingConfig?.connectionId || !parsedMappingConfig?.revenueColumn) continue;
          await reprocessGoogleSheetsRevenue(campaignId, source, { ...parsedMappingConfig, platformContext: "ga4" });
        }
      } catch (e: any) {
        console.error(`[Google Sheets Revenue Refresh] Error processing campaign ${campaignId}:`, e?.message || e);
      }
    }
  } finally {
    (global as any).__googleSheetsSpendRefreshInProgress = false;
  }
}

export async function runHubSpotPipelineAutoRefreshOnce(): Promise<void> {
  if ((global as any).__autoRefreshInProgress || (global as any).__googleSheetsSpendRefreshInProgress || (global as any).__salesforcePipelineRefreshInProgress) {
    console.log("[HubSpot Pipeline Refresh] Skipping run (refresh already in progress)");
    return;
  }
  (global as any).__salesforcePipelineRefreshInProgress = true;

  try {
    const campaigns = filterActiveSchedulerCampaigns(await storage.getCampaigns());
    for (const campaign of campaigns) {
      const campaignId = String(campaign.id);
      try {
        const sources = await storage.getRevenueSources(campaignId, "ga4").catch(() => [] as any[]);
        const hubspotSources = (Array.isArray(sources) ? sources : []).filter((source: any) =>
          source?.isActive !== false
          && String(source?.sourceType || "").trim().toLowerCase() === "hubspot"
          && String(source?.platformContext || "").trim().toLowerCase() === "ga4"
        );
        for (const source of hubspotSources) {
          if (isSourceOutsideCampaign(source, campaignId)) continue;
          const parsedMappingConfig = safeJsonParse(source?.mappingConfig);
          const mappingConfig = parsedMappingConfig ? { ...parsedMappingConfig, expectedSourceMappingConfig: String(source.mappingConfig) } : null;
          const mappingContext = String(mappingConfig?.platformContext || mappingConfig?.platform || "").trim().toLowerCase();
          if (
            mappingContext !== "ga4"
            || (mappingConfig?.pipelineEnabled === true && !mappingConfig?.pipelineStageId)
            || !Array.isArray(mappingConfig?.selectedValues)
            || mappingConfig.selectedValues.length === 0
          ) continue;
          await reprocessHubSpot(campaignId, mappingConfig, String(source.id));
        }
      } catch (e: any) {
        console.error(`[HubSpot Pipeline Refresh] Error processing campaign ${campaignId}:`, e?.message || e);
      }
    }
  } finally {
    (global as any).__salesforcePipelineRefreshInProgress = false;
  }
}

export async function runSalesforcePipelineAutoRefreshOnce(): Promise<void> {
  if ((global as any).__autoRefreshInProgress || (global as any).__googleSheetsSpendRefreshInProgress || (global as any).__salesforcePipelineRefreshInProgress) {
    console.log("[Salesforce Pipeline Refresh] Skipping run (refresh already in progress)");
    return;
  }
  (global as any).__salesforcePipelineRefreshInProgress = true;

  try {
    const campaigns = filterActiveSchedulerCampaigns(await storage.getCampaigns());
    for (const campaign of campaigns) {
      const campaignId = String(campaign.id);
      try {
        const sources = await storage.getRevenueSources(campaignId, "ga4").catch(() => [] as any[]);
        const salesforceSources = (Array.isArray(sources) ? sources : []).filter((source: any) =>
          source?.isActive !== false
          && String(source?.sourceType || "").trim().toLowerCase() === "salesforce"
          && String(source?.platformContext || "").trim().toLowerCase() === "ga4"
        );
        for (const source of salesforceSources) {
          if (isSourceOutsideCampaign(source, campaignId)) continue;
          const parsedMappingConfig = safeJsonParse(source?.mappingConfig);
          const mappingConfig = parsedMappingConfig ? { ...parsedMappingConfig, expectedSourceMappingConfig: String(source.mappingConfig) } : null;
          const mappingContext = String(mappingConfig?.platformContext || mappingConfig?.platform || "").trim().toLowerCase();
          if (
            mappingContext !== "ga4"
            || !Array.isArray(mappingConfig?.selectedValues)
            || mappingConfig.selectedValues.length === 0
          ) continue;
          await reprocessSalesforce(campaignId, mappingConfig, String(source.id));
        }
      } catch (e: any) {
        console.error(`[Salesforce Pipeline Refresh] Error processing campaign ${campaignId}:`, e?.message || e);
      }
    }
  } finally {
    (global as any).__salesforcePipelineRefreshInProgress = false;
  }
}

export async function runDailyAutoRefreshOnce(
  trigger: AutoRefreshRunTrigger = "manual",
  opts: AutoRefreshRunOptions = {},
): Promise<AutoRefreshRunSummary | null> {
  const guarded = "refreshScope" in opts;
  const refreshWriteInput: GA4RefreshWriteInput = guarded ? { refreshScope: opts.refreshScope } : {};
  const assertOwnership = async () => {
    if (guarded) await storage.writeWithGA4RefreshOwnership(opts.refreshScope, async () => {});
  };
  if (guarded) {
    if (!opts.campaignId || opts.refreshScope?.campaignId !== opts.campaignId || !opts.financialSourcesOnly || !opts.deferDownstream || opts.onCampaignRefreshed) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    await assertOwnership();
    const waitStartedAt = Date.now();
    while ((global as any).__autoRefreshInProgress) {
      if (Date.now() - waitStartedAt >= 120_000) throw new Error("FINANCIAL_REFRESH_WAIT_TIMEOUT");
      await new Promise(resolve => setTimeout(resolve, 100));
      await assertOwnership();
    }
  }
  // Give the daily job priority without overlapping an interval financial refresh.
  if ((global as any).__autoRefreshInProgress) {
    autoRefreshSchedulerStatus.totalSkippedRuns += 1;
    autoRefreshSchedulerStatus.lastRunTrigger = trigger;
    autoRefreshSchedulerStatus.lastRunStatus = "skipped";
    autoRefreshSchedulerStatus.lastSkippedAt = new Date();
    console.log("[Auto Refresh] Skipping run (daily refresh already in progress)");
    return null;
  }
  // Claim priority before waiting so another interval financial refresh cannot start.
  (global as any).__autoRefreshInProgress = true;
  beginFinancialDailySnapshotRefreshObservation("financial_sources", guarded ? opts.campaignId : undefined);
  const startedAtDate = new Date();
  const startedAt = Date.now();
  autoRefreshSchedulerStatus.totalRuns += 1;
  if (trigger === "startup") autoRefreshSchedulerStatus.totalStartupRuns += 1;
  else if (trigger === "scheduled") autoRefreshSchedulerStatus.totalScheduledRuns += 1;
  else autoRefreshSchedulerStatus.totalManualRuns += 1;
  autoRefreshSchedulerStatus.lastRunStartedAt = startedAtDate;
  autoRefreshSchedulerStatus.lastRunFinishedAt = null;
  autoRefreshSchedulerStatus.lastRunTrigger = trigger;
  autoRefreshSchedulerStatus.lastRunStatus = "running";
  autoRefreshSchedulerStatus.lastError = null;
  autoRefreshSchedulerStatus.lastRunSummary = null;
  const refreshRunId = randomUUID();
  let campaignsScanned = 0;
  const totals = { attempted: 0, succeeded: 0, retained: 0, skipped: 0, campaignErrors: 0 };
  let anyCampaignRecomputeFailed = false;
  let linkedInRefreshFailed = false;
  let completedSummary: AutoRefreshRunSummary | null = null;
  console.log("\n=== DAILY AUTO-REFRESH + AUTO-PROCESS RUNNING ===");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Run ID: ${refreshRunId}`);

  try {
    while ((global as any).__googleSheetsSpendRefreshInProgress || (global as any).__salesforcePipelineRefreshInProgress) {
      await assertOwnership();
      if (Date.now() - startedAt >= 120_000) throw new Error("FINANCIAL_REFRESH_WAIT_TIMEOUT");
      console.log("[Auto Refresh] Waiting for an interval financial refresh to finish");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    // 1) Refresh LinkedIn first (ensures latest conversions are available in latest import session).
    try {
      if (!opts.financialSourcesOnly) {
        linkedInRefreshFailed = true;
        console.log("[Auto Refresh] Step 1/2: Refreshing LinkedIn data for all campaigns...");
        const linkedInTimeoutMs = Math.max(parseInt(String(process.env.AUTO_REFRESH_LINKEDIN_TIMEOUT_MS || "120000"), 10) || 120000, 10000);
        await withTimeout("LinkedIn auto-refresh", signal => refreshAllLinkedInData(signal), linkedInTimeoutMs);
        linkedInRefreshFailed = false;
        console.log("[Auto Refresh] ✅ LinkedIn refresh complete");
      }
    } catch (e: any) {
      console.error("[Auto Refresh] ⚠️ LinkedIn refresh failed (continuing to revenue reprocess):", e?.message || e);
    }

    // 2) Re-process revenue for providers that have a saved mappingConfig.
    console.log("[Auto Refresh] Step 2/2: Re-processing revenue mappings (HubSpot/Salesforce/Shopify)...");
    const requestedCampaignId = String(opts.campaignId || "").trim();
    const requestedCampaign = requestedCampaignId ? await storage.getCampaign(requestedCampaignId) : undefined;
    const campaigns = filterActiveSchedulerCampaigns(requestedCampaignId
      ? (requestedCampaign ? [requestedCampaign] : [])
      : await storage.getCampaigns()).filter(campaign => !opts.excludeCampaignIds?.includes(campaign.id));
    if (guarded && campaigns.length !== 1) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    campaignsScanned = campaigns.length;

    let anyCampaignUpdated = false;

    const refreshCampaign = async (campaign: (typeof campaigns)[number]) => {
      const campaignId = String(campaign.id);
      let attempted = 0;
      let succeeded = 0;
      let retained = 0;
      let skipped = 0;
      let campaignErrors = 0;
      let campaignError = false;
      let campaignRecomputeFailed = false;
      let deferCampaignDownstream = Boolean(opts.deferDownstream);
      try {
        await assertOwnership();
        let anyUpdated = false;
        if (guarded) {
          const [revenueSources, spendSources] = await Promise.all([storage.getRevenueSources(campaignId, "ga4"), storage.getSpendSources(campaignId, "ga4")]);
          if (revenueSources.some(source => source.isActive !== false && !["hubspot", "salesforce", "shopify", "google_sheets", "csv", "manual", "custom"].includes(source.sourceType))
            || spendSources.some(source => source.isActive !== false && !["google_sheets", "ad_platforms", "csv", "manual", "custom"].includes(source.sourceType))) throw new Error("GA4_REFRESH_UNSUPPORTED_FINANCIAL_SOURCE");
          if (spendSources.some(source => source.isActive !== false && source.sourceType === "ad_platforms" && safeJsonParse(source.mappingConfig)?.platform !== "google_ads")) throw new Error("GA4_REFRESH_UNSUPPORTED_FINANCIAL_SOURCE");
          for (const source of [...revenueSources, ...spendSources].filter(source => source.isActive !== false)) {
            const mapping = safeJsonParse(source.mappingConfig);
            if (["hubspot", "salesforce", "shopify"].includes(source.sourceType) && !mapping?.selectedValues?.length) throw new Error("GA4_REFRESH_FINANCIAL_MAPPING_INCOMPLETE");
            if (source.sourceType === "google_sheets" && (!mapping?.connectionId || !mapping?.[revenueSources.includes(source as any) ? "revenueColumn" : "spendColumn"])) throw new Error("GA4_REFRESH_FINANCIAL_MAPPING_INCOMPLETE");
          }
        }
        // HubSpot revenue sources are the source of truth for saved campaign mappings.
        let hubspotRevenueCount = 0;
        for (const ctx of (guarded ? ["ga4"] as const : crmRevenueContexts)) {
          const hubspotRevenueSources = (await storage.getRevenueSources(campaignId, ctx))
            .filter((s: any) => s && s.isActive !== false && String(s.sourceType || "").toLowerCase() === "hubspot");
          for (const hubspotSource of hubspotRevenueSources) {
            hubspotRevenueCount++;
            const hubCfgRaw = safeJsonParse(hubspotSource?.mappingConfig);
            const hubCfg = hubCfgRaw ? { ...hubCfgRaw, platformContext: hubCfgRaw.platformContext || hubspotSource.platformContext || ctx, expectedSourceMappingConfig: String(hubspotSource.mappingConfig) } : null;
            if (hubCfg?.selectedValues?.length) {
              attempted++;
              if (await reprocessHubSpot(campaignId, hubCfg, String(hubspotSource.id), refreshWriteInput)) { succeeded++; anyUpdated = true; }
            } else {
              skipped++;
            }
          }
        }
        if (hubspotRevenueCount === 0) skipped++;

        // Salesforce revenue sources are the source of truth for saved campaign mappings.
        let salesforceRevenueCount = 0;
        for (const ctx of (guarded ? ["ga4"] as const : crmRevenueContexts)) {
          const salesforceRevenueSources = (await storage.getRevenueSources(campaignId, ctx))
            .filter((s: any) => s && s.isActive !== false && String(s.sourceType || "").toLowerCase() === "salesforce");
          for (const salesforceSource of salesforceRevenueSources) {
            salesforceRevenueCount++;
            const sfCfgRaw = safeJsonParse(salesforceSource?.mappingConfig);
            const sfCfg = sfCfgRaw ? { ...sfCfgRaw, platformContext: sfCfgRaw.platformContext || salesforceSource.platformContext || ctx, expectedSourceMappingConfig: String(salesforceSource.mappingConfig) } : null;
            if (sfCfg?.selectedValues?.length) {
              attempted++;
              const salesforceResult = await reprocessSalesforceWithDetails(campaignId, sfCfg, String(salesforceSource.id), refreshWriteInput);
              if (salesforceResult.success) { succeeded++; anyUpdated = true; }
              else if (isRetryableSalesforceRefreshFailure(salesforceResult) && await hasCompletedDaySalesforceEvidence(salesforceSource, campaign, startedAtDate)) {
                retained++;
                console.warn(`[Auto Refresh] Retaining completed-day Salesforce evidence for campaign ${campaignId} after a retryable provider failure`);
              }
            } else {
              skipped++;
            }
          }
        }
        if (salesforceRevenueCount === 0) skipped++;

        // Shopify revenue sources are the source of truth for saved campaign mappings.
        let shopifyRevenueCount = 0;
        for (const ctx of (guarded ? ["ga4"] as const : refreshableRevenueContexts)) {
          const shopifyRevenueSources = (await storage.getRevenueSources(campaignId, ctx))
            .filter((s: any) => s && s.isActive !== false && String(s.sourceType || "").toLowerCase() === "shopify");
          for (const shopifySource of shopifyRevenueSources) {
            shopifyRevenueCount++;
            const shopCfgRaw = safeJsonParse(shopifySource?.mappingConfig);
            const shopCfg = shopCfgRaw ? { ...shopCfgRaw, platformContext: shopCfgRaw.platformContext || shopifySource.platformContext || ctx } : null;
            if (shopCfg) { shopCfg.refreshRunId = refreshRunId; if (guarded) shopCfg.expectedSourceMappingConfig = shopifySource.mappingConfig; }
            if (shopCfg?.selectedValues?.length) {
              attempted++;
              if (await reprocessShopify(campaignId, shopCfg, String(shopifySource.id), refreshWriteInput)) { succeeded++; anyUpdated = true; }
            } else {
              skipped++;
            }
          }
        }
        if (shopifyRevenueCount === 0) skipped++;

        // Google Sheets (Spend) — process ALL active Sheets spend sources
        try {
          const spendSources = await storage.getSpendSources(campaignId, guarded ? "ga4" : undefined);
          const sheetSpendSources = (Array.isArray(spendSources) ? spendSources : []).filter((s: any) => {
            return !!s && (s as any).isActive !== false && String((s as any).sourceType || "") === "google_sheets";
          });
          for (const sheetSpend of sheetSpendSources) {
            const spendCfg = safeJsonParse(sheetSpend?.mappingConfig);
            if (spendCfg?.connectionId && spendCfg?.spendColumn) {
              attempted++;
              if (await reprocessGoogleSheetsSpend(campaignId, sheetSpend, spendCfg, refreshWriteInput)) { succeeded++; anyUpdated = true; }
            } else {
              skipped++;
            }
          }
          if (sheetSpendSources.length === 0) skipped++;
        } catch (error) {
          throw error; // Let the campaign handler block publication when source discovery fails.
        }

        // LinkedIn Ads (Spend)
        try {
          const spendSources = await storage.getSpendSources(campaignId, guarded ? "ga4" : undefined);
          const linkedInSpend = (Array.isArray(spendSources) ? spendSources : []).find((s: any) => {
            return !!s && (s as any).isActive !== false && String((s as any).sourceType || "") === "linkedin_api";
          });
          const liCfg = safeJsonParse(linkedInSpend?.mappingConfig);
          if (linkedInSpend && String((linkedInSpend as any)?.platformContext || "ga4") === "ga4") {
            skipped++;
          } else if (linkedInSpend && liCfg?.platform === "linkedin") {
            attempted++;
            if (await reprocessLinkedInSpend(campaignId, linkedInSpend, liCfg)) { succeeded++; anyUpdated = true; }
          } else {
            skipped++;
          }
        } catch (error) {
          throw error;
        }

        // Ad Platform Spend (Google Ads / Meta) — pull from daily metrics tables
        try {
          const spendSrcs = await storage.getSpendSources(campaignId, guarded ? "ga4" : undefined);
          let ga4GoogleAdsRefreshAttempted = false;
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
            const platformContext = String((src as any).platformContext || cfg?.platformContext || "ga4") as any;
            if (platformContext === "ga4") {
              const mappedPlatform = String(cfg?.platform || "").trim().toLowerCase();
              const namedGoogleAdsSource = displayName.trim().toLowerCase() === "google ads";
              if (mappedPlatform !== "google_ads") {
                if (namedGoogleAdsSource) attempted++;
                else skipped++;
                continue;
              }
              if (ga4GoogleAdsRefreshAttempted) {
                skipped++;
                continue;
              }
              ga4GoogleAdsRefreshAttempted = true;
              attempted++;
              try {
                const dedicatedConnection = await storage.getGA4GoogleAdsSpendConnection(campaignId).catch(error => { if (guarded) throw error; return null; });
                const legacyConnection = dedicatedConnection ? null : await storage.getGoogleAdsConnection(campaignId, ...("refreshScope" in refreshWriteInput ? [refreshWriteInput] : [])).catch(error => { if (guarded) throw error; return null; });
                const connection = dedicatedConnection || (legacyConnection?.spendOnly ? legacyConnection : null);
                if (!connection || !isSupportedGoogleAdsSpendConnectionMethod(connection.method)) throw new Error("live spend connection is unavailable");
                const { refreshGoogleAdsForCampaign } = await import("./google-ads-scheduler");
                const refresh = await refreshGoogleAdsForCampaign(campaignId, connection, {
                  ga4SpendConnection: Boolean(dedicatedConnection),
                  deferDownstream: true,
                  ...refreshWriteInput,
                });
                if (!refresh.providerRefreshed || refresh.spendMaterialization?.updated !== true) throw new Error("spend materialization was incomplete");
                succeeded++;
                anyUpdated = true;
              } catch (error: any) {
                if (guarded) throw error;
                console.error(`[Auto Refresh] Google Ads spend alignment failed for campaign ${campaignId}:`, error?.message || error);
              }
              continue;
            }
            const selectedIds = Array.isArray(cfg?.selectedCampaignIds)
              ? new Set(cfg.selectedCampaignIds.map((id: any) => String(id || "").trim()).filter(Boolean))
              : null;
            const campaignStart = new Date((campaign as any)?.startDate || "1900-01-01");
            const startDate = Number.isNaN(campaignStart.getTime()) ? "1900-01-01" : campaignStart.toISOString().slice(0, 10);
            const endDate = getLatestCompleteReportingDate((campaign as any)?.reportingTimeZone);

            let rows: any[] = [];
            let providerFresh = false;
            if (displayName.includes("Google Ads")) {
              if (!selectedIds || selectedIds.size === 0) {
                console.error(`[Auto Refresh] Refusing Google Ads spend reprocess for campaign ${campaignId}: missing selected campaign IDs`);
                skipped++;
                continue;
              }
              const connection: any = await storage.getGoogleAdsConnection(campaignId, ...("refreshScope" in refreshWriteInput ? [refreshWriteInput] : [])).catch(() => null);
              if (!connection || !connection.spendOnly || !isSupportedGoogleAdsSpendConnectionMethod(connection.method)) {
                console.error(`[Auto Refresh] Refusing unsupported Google Ads spend connection for campaign ${campaignId}`);
                skipped++;
                continue;
              }
              const lastRefreshAt = connection?.lastRefreshAt ? new Date(connection.lastRefreshAt).getTime() : 0;
              providerFresh = Number.isFinite(lastRefreshAt) && Date.now() - lastRefreshAt <= 6 * 60 * 60 * 1000;
              rows = (await storage.getGoogleAdsDailyMetrics(campaignId, startDate, endDate)) || [];
              rows = rows.filter((r: any) => selectedIds.has(String(r?.googleCampaignId || "").trim()));
            } else if (displayName.includes("Meta")) {
              rows = (await storage.getMetaDailyMetrics(campaignId, startDate, endDate)) || [];
              if (selectedIds && selectedIds.size > 0) rows = rows.filter((r: any) => selectedIds.has(String(r?.metaCampaignId || "").trim()));
            } else {
              continue;
            }

            if (rows.length === 0 && !providerFresh) continue;

            const spendByDate = new Map<string, number>();
            for (const r of rows) {
              const date = String((r as any).date || "").trim();
              const spend = parseFloat(String((r as any).spend || "0"));
              if (date && !Number.isNaN(spend)) spendByDate.set(date, (spendByDate.get(date) || 0) + spend);
            }

            const records = Array.from(spendByDate.entries()).map(([date, spend]) => ({
              campaignId,
              date,
              spend: String(spend.toFixed(2)),
              currency: String((src as any)?.currency || (campaign as any)?.currency || "USD"),
            }));

            if (records.length > 0 || providerFresh) {
              attempted++;
              try {
                await storage.replaceSpendRecordsForSource(campaignId, String((src as any).id), "ad_platforms", platformContext, records);
                const allSpend = await storage.getSpendTotalForRange(campaignId, "1900-01-01", endDate);
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
          throw err;
        }

        // Google Sheets (Revenue) — process ALL active Sheets revenue sources across all platform contexts
        try {
          let sheetRevCount = 0;
          for (const ctx of (guarded ? ["ga4"] as const : refreshableRevenueContexts)) {
            const revenueSources = await storage.getRevenueSources(campaignId, ctx);
            const sheetRevSources = (Array.isArray(revenueSources) ? revenueSources : []).filter((s: any) => {
              return !!s && (s as any).isActive !== false && String((s as any).sourceType || "") === "google_sheets";
            });
            for (const sheetRevenue of sheetRevSources) {
              sheetRevCount++;
              const revCfgRaw = safeJsonParse(sheetRevenue?.mappingConfig);
              const revCfg = revCfgRaw ? { ...revCfgRaw, platformContext: revCfgRaw.platformContext || sheetRevenue.platformContext || ctx } : null;
              if (revCfg?.connectionId && revCfg?.revenueColumn) {
                attempted++;
                if (await reprocessGoogleSheetsRevenue(campaignId, sheetRevenue, revCfg, refreshWriteInput)) { succeeded++; anyUpdated = true; }
              } else {
                skipped++;
              }
            }
          }
          if (sheetRevCount === 0) skipped++;
        } catch (error) {
          throw error;
        }

        // Google Sheets (Raw Data Cache — for Overview/Summary/Insights tabs)
        try {
          if (!guarded && await refreshGoogleSheetsDataForCampaign(campaignId)) { anyUpdated = true; }
        } catch {
          // ignore
        }

        // Active GA4 campaigns publish their downstream state only after the ordered GA4 daily pipeline completes.
        const activeGA4Connections = await storage.getGA4Connections(campaignId).catch(() => [{ propertyId: "unverified", isActive: true }] as any[]);
        deferCampaignDownstream = deferCampaignDownstream || activeGA4Connections.some((connection: any) => {
          const propertyId = String(connection?.propertyId || "").trim();
          return connection?.isActive !== false && propertyId && propertyId.toLowerCase() !== "yesop";
        });
        if (anyUpdated && !deferCampaignDownstream) {
          anyCampaignUpdated = true;
          const recomputeResult = await runGA4DailyKPIAndBenchmarkJobs({ campaignId }).catch((e: any) => {
            console.warn(`[Auto Refresh] KPI/Benchmark recompute failed for campaign ${campaignId}:`, e?.message || e);
            return null;
          });
          if (!recomputeResult || Number(recomputeResult.campaignsProcessed || 0) <= 0 || recomputeResult.campaignIdsSkipped.length > 0 || recomputeResult.campaignIdsFailed.length > 0 || recomputeResult.kpiIdsSkipped.length > 0 || recomputeResult.kpiIdsFailed.length > 0 || recomputeResult.alertReconciliationFailures.length > 0) {
            anyCampaignRecomputeFailed = true;
            campaignRecomputeFailed = true;
          }
        }
      } catch (e: any) {
        campaignErrors++;
        campaignError = true;
        if (guarded) throw e;
        console.error(`[Auto Refresh] Error processing campaign ${campaignId}:`, e?.message || e);
      } finally {
        await assertOwnership();
        let linkedInConnection: any = null;
        let linkedInConnectionCheckFailed = false;
        if (!opts.financialSourcesOnly) {
          try {
            linkedInConnection = await storage.getLinkedInConnection(campaignId);
          } catch {
            linkedInConnectionCheckFailed = true;
          }
        }
        const failures = getCampaignAutoRefreshFailures({
          providerJobsAttempted: attempted,
          providerJobsSucceeded: succeeded,
          providerJobsRetained: retained,
          campaignError,
          recomputeFailed: campaignRecomputeFailed,
          linkedInRequired: !opts.financialSourcesOnly && Boolean(linkedInConnection),
          linkedInLastRefreshAt: linkedInConnection?.lastRefreshAt,
          runStartedAt: startedAtDate,
        });
        if (linkedInConnectionCheckFailed) failures.push("linkedin_connection_check_failed");
        const reportingDate = getLatestCompleteReportingDate((campaign as any)?.reportingTimeZone, startedAtDate);
        recordFinancialDailySnapshotRefreshEvidence("financial_sources", {
          campaignId,
          reportingDate,
          status: failures.length > 0 ? "failed" : "success",
          completedAt: new Date().toISOString(),
          failures,
        });
        if (!deferCampaignDownstream) {
          try {
            const writeResult = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate });
            console.log(`[Auto Refresh] Financial snapshot ${writeResult.status} for campaign ${campaignId}${writeResult.reasons.length > 0 ? ` (${writeResult.reasons.join(", ")})` : ""}`);
          } catch (error: any) {
            campaignErrors++;
            console.warn(`[Auto Refresh] Financial snapshot write failed for campaign ${campaignId}:`, error?.message || error);
          }
        }
      }
      totals.attempted += attempted;
      totals.succeeded += succeeded;
      totals.retained += retained;
      totals.skipped += skipped;
      totals.campaignErrors += campaignErrors;
      // Keep downstream publication inside this campaign's worker slot.
      if (opts.financialSourcesOnly && opts.deferDownstream && opts.onCampaignRefreshed) {
        await opts.onCampaignRefreshed(campaignId);
      }
    };
    if (trigger === "scheduled" && !requestedCampaignId && opts.financialSourcesOnly && opts.deferDownstream
        && opts.onCampaignRefreshed && opts.campaignConcurrency === 2) {
      let nextCampaignIndex = 0;
      const claimedCampaignIds = new Set<string>();
      const campaignRunErrors: unknown[] = [];
      await Promise.all(Array.from({ length: 2 }, async () => {
        while (nextCampaignIndex < campaigns.length) {
          const campaign = campaigns[nextCampaignIndex++];
          if (claimedCampaignIds.has(campaign.id)) continue;
          claimedCampaignIds.add(campaign.id);
          try { await refreshCampaign(campaign); } catch (error) { campaignRunErrors.push(error); }
        }
      }));
      // Retain the overlap lock until both workers settle, even after a failure.
      if (campaignRunErrors.length > 0) throw campaignRunErrors[0];
    } else {
      for (const campaign of campaigns) await refreshCampaign(campaign);
    }
    const { attempted, succeeded, retained, skipped, campaignErrors } = totals;

    // Run alert check once per refresh cycle (avoid N-times per campaign).
    if (!opts.deferDownstream && anyCampaignUpdated && !anyCampaignRecomputeFailed) {
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
    console.log(`   Provider jobs retained from completed-day evidence: ${retained}`);
    console.log(`   Provider jobs skipped (no mapping/disabled): ${skipped}`);
    console.log(`   Run ID: ${refreshRunId}`);
    const summary: AutoRefreshRunSummary = {
      campaignsScanned,
      providerJobsAttempted: attempted,
      providerJobsSucceeded: succeeded,
      providerJobsRetained: retained,
      providerJobsSkipped: skipped,
      campaignErrors,
      recomputeFailed: anyCampaignRecomputeFailed,
      linkedInRefreshFailed,
    };
    completedSummary = summary;
    autoRefreshSchedulerStatus.lastRunSummary = summary;
    const failure = getAutoRefreshRunFailure(summary);
    if (failure) {
      autoRefreshSchedulerStatus.lastRunStatus = "failed";
      autoRefreshSchedulerStatus.lastErrorTime = new Date();
      autoRefreshSchedulerStatus.lastError = failure;
    } else {
      autoRefreshSchedulerStatus.lastRunStatus = "success";
    }
  } catch (e: any) {
    autoRefreshSchedulerStatus.lastRunStatus = "failed";
    autoRefreshSchedulerStatus.lastErrorTime = new Date();
    autoRefreshSchedulerStatus.lastError = e?.message || String(e);
    throw e;
  } finally {
    (global as any).__autoRefreshInProgress = false;
    autoRefreshSchedulerStatus.lastRunFinishedAt = new Date();
    const elapsedMs = Date.now() - startedAt;
    console.log(`=== AUTO-REFRESH COMPLETE (${Math.round(elapsedMs / 1000)}s) ===\n`);
  }
  return completedSummary;
}

/**
 * Start the daily scheduler.
 *
 * Defaults:
 * - Enabled by default (AUTO_REFRESH_ENABLED=true unless explicitly set to "false")
 * - Runs daily at 3:00 AM in AUTO_REFRESH_TIME_ZONE or GA4_DAILY_REFRESH_TIME_ZONE, default UTC
 * - Polls active Google Sheets spend and GA4 revenue sources every minute by default
 * - Polls active GA4 Salesforce and HubSpot Pipeline sources every 5 minutes by default
 * - Optional: run once on startup if AUTO_REFRESH_RUN_ON_STARTUP=true
 */
export function startDailyAutoRefreshScheduler(): void {
  const config = getAutoRefreshSchedulerConfig();
  const ga4DailyPipelineOwnsRefresh = String(process.env.GA4_DAILY_PIPELINE_OWNS_REFRESH || "true").toLowerCase() === "true";
  autoRefreshSchedulerStatus.config = config;
  if (!config.enabled) {
    console.log("[Auto Refresh] Scheduler disabled via AUTO_REFRESH_ENABLED=false");
    return;
  }

  if ((global as any).__autoRefreshSchedulerTimer || (global as any).__autoRefreshSchedulerInterval || (global as any).__salesforcePipelineRefreshSchedulerInterval) {
    console.log("[Auto Refresh] Scheduler is already running");
    return;
  }

  console.log("\n🔁 Daily Auto-Refresh + Auto-Process Scheduler Started");
  console.log(`   Enabled: ${config.enabled}`);
  console.log(`   Scheduled time: ${config.hour.toString().padStart(2, "0")}:${config.minute.toString().padStart(2, "0")} (${config.reportingTimeZone})`);
  console.log(`   Google Sheets financial interval: ${config.googleSheetsSpendIntervalMinutes} minute(s)`);
  console.log(`   Salesforce + HubSpot Pipeline interval: ${config.salesforcePipelineIntervalMinutes} minute(s)`);

  autoRefreshSchedulerStatus.startedAt = new Date();
  const googleSheetsSpendIntervalMs = config.googleSheetsSpendIntervalMinutes * 60 * 1000;
  const runGoogleSheetsFinancialRefresh = async () => {
    await runGoogleSheetsSpendAutoRefreshOnce().catch((e: any) => {
      console.error("[Google Sheets Spend Refresh] Interval run failed:", e?.message || e);
    });
    await runGoogleSheetsRevenueAutoRefreshOnce().catch((e: any) => {
      console.error("[Google Sheets Revenue Refresh] Interval run failed:", e?.message || e);
    });
  };
  (global as any).__autoRefreshSchedulerInterval = setInterval(runGoogleSheetsFinancialRefresh, googleSheetsSpendIntervalMs);
  const salesforcePipelineIntervalMs = config.salesforcePipelineIntervalMinutes * 60 * 1000;
  const runSalesforcePipelineRefresh = () => {
    void runSalesforcePipelineAutoRefreshOnce()
      .catch((e: any) => console.error("[Salesforce Pipeline Refresh] Interval run failed:", e?.message || e))
      .then(() => runHubSpotPipelineAutoRefreshOnce())
      .catch((e: any) => console.error("[HubSpot Pipeline Refresh] Interval run failed:", e?.message || e));
  };
  (global as any).__salesforcePipelineRefreshSchedulerInterval = setInterval(runSalesforcePipelineRefresh, salesforcePipelineIntervalMs);

  const scheduleNextRun = () => {
    const nextRun = getNextAutoRefreshRunAt(new Date(), config);
    const msUntilNextRun = Math.max(1000, nextRun.getTime() - Date.now());
    autoRefreshSchedulerStatus.nextRunAt = nextRun;
    console.log(`[Auto Refresh] Next scheduled run at ${nextRun.toISOString()} (${formatSchedulerLocalTime(nextRun, config.reportingTimeZone)}, timezone=${config.reportingTimeZone}, expectedCompleteDay=${getLatestCompleteReportingDate(config.reportingTimeZone, nextRun)})`);
    (global as any).__autoRefreshSchedulerTimer = setTimeout(() => {
      runDailyAutoRefreshOnce("scheduled")
        .catch((e: any) => console.error("[Auto Refresh] Scheduled run failed:", e?.message || e))
        .finally(scheduleNextRun);
    }, msUntilNextRun);
  };

  if (config.runOnStartup && !ga4DailyPipelineOwnsRefresh) {
    console.log("[Auto Refresh] Running once on startup (AUTO_REFRESH_RUN_ON_STARTUP=true)...");
    runDailyAutoRefreshOnce("startup");
  }

  if (ga4DailyPipelineOwnsRefresh) {
    autoRefreshSchedulerStatus.nextRunAt = null;
    console.log("[Auto Refresh] Daily financial cycle is owned by the ordered GA4 daily pipeline");
  } else {
    scheduleNextRun();
  }
}


