import { createHash } from "node:crypto";
import { financialDailySnapshotInputSchema } from "../shared/schema";
import { conversionCreditsMatch } from "../shared/metric-math";
import { resolveGA4KpiMetricIdentity } from "../shared/ga4-kpi-metric-identity";
import { getLatestCompleteReportingDate, normalizeReportingTimeZone } from "./utils/reporting-timezone";
import { readReportPdfArtifact } from "./utils/report-pdf-artifact";
import { parseExecutiveSummaryDailySnapshot } from "./utils/executive-summary-daily-snapshot";

export type LiveNumberSnapshot = { campaign: Record<string, any>; rows: Record<string, any[]> };
export type NumberCheck = { section: string; code: string; status: "passed" | "difference" | "unverified"; subject?: string };
export const monitorHash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 12);
export const snapshotFingerprint = (snapshot: LiveNumberSnapshot) => createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
export const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || typeof value === "boolean" || (typeof value === "string" && !value.trim())) return null;
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && Math.abs(parsed) <= Number.MAX_SAFE_INTEGER ? parsed : null;
};
export const dateIsValid = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value + "T00:00:00Z")) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
export function parseMonitorMapping(value: unknown): Record<string, any> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("SOURCE_MAPPING_UNVERIFIED");
  return parsed as Record<string, any>;
}
export function monitorCampaignFilter(value: unknown): string[] {
  const parsed = typeof value === "string" && value.trim().startsWith("[") ? JSON.parse(value) : value;
  const names = (Array.isArray(parsed) ? parsed : [parsed]).map(v => typeof v === "string" ? v.trim() : "");
  if (!names.length || names.some(v => !v) || new Set(names).size !== names.length) throw new Error("CAMPAIGN_FILTER_UNVERIFIED");
  return names;
}
export function compareNumber(section: string, code: string, expected: unknown, actual: unknown,
  options: { decimals?: number; conversions?: boolean; operations?: number; subject?: string } = {}): NumberCheck {
  const a = numberOrNull(expected), b = numberOrNull(actual);
  if (options.decimals !== undefined && [a, b].some(value => value !== null && Math.abs(value) * 10 ** options.decimals! > Number.MAX_SAFE_INTEGER)) {
    return { section, code, status: "unverified", ...(options.subject ? { subject: options.subject } : {}) };
  }
  const equal = a !== null && b !== null && (options.conversions ? conversionCreditsMatch(a, b, options.operations || 1)
    : options.decimals !== undefined ? new Intl.NumberFormat("en-US", { maximumFractionDigits: options.decimals, minimumFractionDigits: options.decimals, useGrouping: false }).format(a)
        === new Intl.NumberFormat("en-US", { maximumFractionDigits: options.decimals, minimumFractionDigits: options.decimals, useGrouping: false }).format(b) : a === b);
  return { section, code, status: a === null || b === null ? "unverified" : equal ? "passed" : "difference",
    ...(options.subject ? { subject: options.subject } : {}) };
}

export function resolveMonitorScope(snapshot: LiveNumberSnapshot, now = new Date()) {
  const { campaign, rows } = snapshot;
  const connections = (rows.ga4Connections || []).filter(r => r.isActive);
  const primary = connections.filter(r => r.isPrimary);
  const connection = primary.length === 1 ? primary[0] : connections.length === 1 ? connections[0] : null;
  if (!campaign.id || !campaign.ownerId || !campaign.clientId || campaign.status === "deleted" || !connection
    || connection.campaignId !== campaign.id || !/^\d+$/.test(connection.propertyId)) throw new Error("CAMPAIGN_SCOPE_UNVERIFIED");
  if (!/^[A-Z]{3}$/.test(campaign.currency) || !campaign.reportingTimeZone
    || normalizeReportingTimeZone(campaign.reportingTimeZone) !== campaign.reportingTimeZone) throw new Error("CURRENCY_OR_TIMEZONE_UNVERIFIED");
  const filter = monitorCampaignFilter(campaign.ga4CampaignFilter);
  const publications = (rows.ga4OverviewSnapshots || []).filter(r => r.propertyId === connection.propertyId);
  if (publications.length !== 1) throw new Error("PUBLICATION_UNVERIFIED");
  const publication = publications[0];
  if (publication.campaignId !== campaign.id || publication.windowStart !== connection.importStartDate
    || !dateIsValid(publication.windowStart) || !dateIsValid(publication.windowEnd) || publication.windowStart > publication.windowEnd
    || publication.windowEnd !== getLatestCompleteReportingDate(campaign.reportingTimeZone, now)
    || publication.campaignBreakdown?.meta?.propertyId !== connection.propertyId
    || publication.campaignBreakdown?.meta?.currencyCode !== campaign.currency) throw new Error("PUBLICATION_SCOPE_UNVERIFIED");
  if ((rows.ga4RefreshWork || []).some(r => r.status === "running")) throw new Error("PUBLICATION_IN_PROGRESS");
  return { connection, publication, filter, startDate: publication.windowStart as string, endDate: publication.windowEnd as string,
    currency: campaign.currency as string, reportingTimeZone: campaign.reportingTimeZone as string };
}

// Independent arithmetic over saved inputs. Never recomputes/persists application values.
export function checkStoredNumbers(snapshot: LiveNumberSnapshot, now = new Date()): NumberCheck[] {
  const checks: NumberCheck[] = [];
  let scope: ReturnType<typeof resolveMonitorScope>;
  try { scope = resolveMonitorScope(snapshot, now); }
  catch (error) { return [{ section: "scope", code: error instanceof Error ? error.message : "SCOPE_UNVERIFIED", status: "unverified" }]; }
  const { campaign, rows } = snapshot;
  const { connection, publication, startDate, endDate, currency, reportingTimeZone } = scope;
  const push = (section: string, code: string, expected: unknown, actual: unknown, decimals?: number, subject?: string) =>
    checks.push(compareNumber(section, code, expected, actual, { decimals, subject, conversions: code.includes("conversions"), operations: 10000 }));
  const daily = (rows.ga4DailyMetrics || []).filter(r => r.propertyId === connection.propertyId && r.date >= startDate && r.date <= endDate);
  const days = (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1;
  const complete = daily.length === days && new Set(daily.map(r => r.date)).size === days
    && daily.every(r => r.campaignId === campaign.id && dateIsValid(r.date) && !r.isSimulated);
  checks.push({ section: "Overview / Insights / Trend Analysis", code: "DAILY_DATE_COVERAGE", status: complete ? "passed" : "difference" });
  const totals: Record<string, number | null> = {};
  for (const metric of ["sessions", "users", "pageviews", "conversions", "revenue", "engagedSessions"]) {
    const values = daily.map(r => numberOrNull(r[metric]));
    totals[metric] = complete && values.every(v => v !== null && (metric === "revenue" || v >= 0))
      ? values.reduce<number>((sum, v) => sum + v!, 0) : null;
    checks.push({ section: "Overview / Insights / Trend Analysis", code: `DAILY_${metric}_VALID`, status: totals[metric] === null ? "unverified" : "passed" });
  }
  const saved = publication.campaignBreakdown.totals;
  push("Overview / Campaign Comparison", "sessions", totals.sessions, saved?.sessions);
  push("Overview / Campaign Comparison", "conversions", totals.conversions, saved?.conversions);
  // Daily revenue is stored to cents. The documented bound is half a cent per day, not a percentage tolerance.
  const revenue = numberOrNull(saved?.revenue);
  checks.push({ section: "Overview / Campaign Comparison", code: "DAILY_REVENUE_ROUNDING_BOUND",
    status: revenue === null || totals.revenue === null ? "unverified" : Math.abs(revenue - totals.revenue) <= days * 0.005 + 1e-9 ? "passed" : "difference" });
  const selected = new Set(scope.filter);
  checks.push({ section: "Campaign Comparison", code: "CAMPAIGN_ROW_SCOPE", status: Array.isArray(publication.campaignBreakdown.rows)
    && publication.campaignBreakdown.rows.every((r: any) => selected.has(String(r.campaign))) ? "passed" : "difference" });
  const sumSources = (kind: "revenue" | "spend"): number | null => {
    const sources = (rows[kind + "Sources"] || []).filter(s => s.isActive && (!s.platformContext || s.platformContext === "ga4"));
    if (!sources.length) return kind === "revenue" ? 0 : null;
    let sum = 0;
    for (const source of sources) {
      const subject = monitorHash(String(source.id));
      const records = (rows[kind + "Records"] || []).filter(r => r[kind + "SourceId"] === source.id && r.date <= endDate);
      const valid = source.campaignId === campaign.id && source.currency === currency && records.length > 0
        && records.every(r => r.campaignId === campaign.id && r.currency === currency && dateIsValid(r.date) && numberOrNull(r[kind]) !== null);
      checks.push({ section: "Financial sources", code: `${kind.toUpperCase()}_SOURCE_SCOPE`, subject, status: valid ? "passed" : "unverified" });
      if (!valid) return null;
      // Aggregate and attributed rows are alternative grains, never additive to each other.
      const aggregate = records.filter(r => !r.subCampaignUrn);
      const selectedRecords = aggregate.length ? aggregate : records;
      const keys = selectedRecords.map(r => source.sourceType === "shopify" ? `order:${r.externalId || "MISSING"}` : `${r.date}:${r.subCampaignUrn || ""}`);
      if (new Set(keys).size !== keys.length || (source.sourceType === "shopify" && selectedRecords.some(r => !r.externalId))) {
        checks.push({ section: "Financial sources", code: "DUPLICATE_MATERIALIZED_GRAIN", subject, status: "difference" });
        return null;
      }
      sum += selectedRecords.reduce((total, r) => total + Number(r[kind]), 0);
    }
    return sum;
  };
  const imported = sumSources("revenue"), spend = sumSources("spend");
  const totalRevenue = revenue !== null && imported !== null ? revenue + imported : null;
  const financials = (rows.metricSnapshots || []).filter(r => r.snapshotType === "financial_daily" && r.reportingDate === endDate);
  const parsed = financialDailySnapshotInputSchema.safeParse(financials.length === 1 ? { ...financials[0].metrics?.financialDaily,
    campaignId: financials[0].campaignId, reportingDate: financials[0].reportingDate } : null);
  if (!parsed.success || parsed.data.campaignId !== campaign.id || parsed.data.currency !== currency
    || parsed.data.currentValueWindow.startDate !== startDate || parsed.data.currentValueWindow.reportingTimeZone !== reportingTimeZone) {
    checks.push({ section: "Budget & Financial Analysis / Executive Summary", code: "FINANCIAL_SNAPSHOT_SCOPE", status: "unverified" });
  } else {
    for (const [metric, expected] of Object.entries({ revenue: totalRevenue, spend, conversions: saved?.conversions })) {
      const input = parsed.data.inputs[metric as "revenue" | "spend" | "conversions"];
      if (expected === null && !input.available) checks.push({ section: "Budget & Financial Analysis / Executive Summary", code: `${metric}_UNAVAILABLE`, status: "passed" });
      else push("Budget & Financial Analysis / Executive Summary", metric, expected, input.available ? input.value : null, metric === "conversions" ? undefined : 2);
    }
  }
  const metricValues: Record<string, number | null> = { ...totals, revenue: totalRevenue,
    conversion_rate: totals.sessions! > 0 && totals.conversions !== null ? totals.conversions / totals.sessions! * 100 : null,
    engagement_rate: totals.sessions! > 0 && totals.engagedSessions !== null ? totals.engagedSessions / totals.sessions! * 100 : null,
    roas: spend! > 0 && totalRevenue !== null ? totalRevenue / spend! : null,
    roi: spend! > 0 && totalRevenue !== null ? (totalRevenue - spend!) / spend! * 100 : null,
    cpa: totals.conversions! > 0 && spend !== null ? spend / totals.conversions! : null };
  const executiveRows = (rows.metricSnapshots || []).filter(r => r.snapshotType === "executive_summary_daily" && r.reportingDate === endDate);
  const executive = executiveRows.length === 1 ? parseExecutiveSummaryDailySnapshot(executiveRows[0] as any) : null;
  if (!executive || executive.campaignId !== campaign.id || executive.currency !== currency || executive.ga4PropertyId !== connection.propertyId
    || executive.ga4CampaignFilter !== String(campaign.ga4CampaignFilter).trim() || executive.currentValueWindow.startDate !== startDate
    || executive.currentValueWindow.reportingTimeZone !== reportingTimeZone) {
    checks.push({ section: "Executive Summary", code: "EXECUTIVE_SNAPSHOT_SCOPE_UNVERIFIED", status: "unverified" });
  } else {
    for (const [metric, input] of Object.entries(executive.totals)) {
      const expected = metric === "spend" ? spend : metric === "cvr" ? metricValues.conversion_rate : metricValues[metric];
      if (expected === null && input.available === false) checks.push({ section: "Executive Summary", code: `${metric}_UNAVAILABLE`, status: "passed" });
      else push("Executive Summary", metric, expected, input.available ? input.value : null,
        ["users", "sessions", "conversions"].includes(metric) ? undefined : 2);
    }
  }
  const sync = (rows.metricSnapshots || []).filter(r => r.snapshotType === "platform_sync")
    .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))[0];
  if (sync?.metrics?.performanceSummary?.totals) {
    const summary = sync.metrics.performanceSummary, values = summary.totals;
    // Arithmetic is independently checkable even when a legacy snapshot omitted its source-window metadata.
    const available = (key: string) => values[key]?.available === true ? numberOrNull(values[key].value) : null;
    const rev = available("revenue"), cost = available("spend"), conv = available("conversions"), sessions = available("sessions");
    const calculated = { roas: cost! > 0 && rev !== null ? rev / cost! : null,
      roi: cost! > 0 && rev !== null ? (rev - cost!) / cost! * 100 : null,
      cpa: conv! > 0 && cost !== null ? cost / conv! : null,
      cvr: sessions! > 0 && conv !== null ? conv / sessions! * 100 : null };
    for (const [metric, expected] of Object.entries(calculated)) {
      if (expected === null && values[metric]?.available === false) continue;
      push("Performance Summary", metric, expected, available(metric), 2);
    }
    const window = summary.currentValueWindow;
    if (!window || window.mode !== "initial_import_to_latest_completed_day" || window.startDate !== startDate
      || window.endDate !== endDate || window.dataThroughDate !== endDate || window.reportingTimeZone !== reportingTimeZone) {
      checks.push({ section: "Performance Summary", code: "SAVED_SOURCE_WINDOW_UNVERIFIED", status: "unverified" });
    } else {
      for (const metric of ["users", "sessions", "conversions", "revenue", "spend"]) {
        const expected = metric === "spend" ? spend : metricValues[metric];
        if (expected === null && values[metric]?.available === false) continue;
        push("Performance Summary", `INPUT_${metric}`, expected, available(metric), ["revenue", "spend"].includes(metric) ? 2 : undefined);
      }
    }
  } else checks.push({ section: "Performance Summary", code: "SAVED_OUTPUT_UNVERIFIED", status: "unverified" });
  for (const section of ["kpis", "benchmarks"]) for (const row of rows[section] || []) {
    if (row.status === "inactive") continue;
    const identity = resolveGA4KpiMetricIdentity(row.metric, row.name);
    const subject = monitorHash(row.id);
    if (row.platformType !== "google_analytics" || row.applyTo !== "all" || row.calculationConfig || !identity) {
      checks.push({ section, code: "METRIC_DEFINITION_UNVERIFIED", subject, status: "unverified" }); continue;
    }
    push(section, identity, metricValues[identity], row.currentValue,
      ["users", "sessions", "pageviews", "conversions"].includes(identity) ? undefined : 2, subject);
  }
  for (const report of rows.reportSnapshots || []) {
    if (!["google_analytics", "campaign_deepdive"].includes(report.platformType)) continue;
    const subject = monitorHash(report.id);
    try {
      const payload = parseMonitorMapping(report.snapshotJson);
      const definition = (rows.linkedinReports || []).find(r => r.id === report.reportId);
      const valid = (!definition || (definition.campaignId === campaign.id && definition.platformType === report.platformType))
        && payload.campaignId === campaign.id && payload.reportId === report.reportId && payload.platformType === report.platformType
        && payload.windowStart === report.windowStart && payload.windowEnd === report.windowEnd && readReportPdfArtifact(payload);
      checks.push({ section: "Reports", code: "SAVED_ARTIFACT_SCOPE", subject, status: valid ? "passed" : "difference" });
      if (!definition) checks.push({ section: "Reports", code: "REPORT_DEFINITION_RETIRED", subject, status: "unverified" });
      checks.push({ section: "Reports", code: "HISTORICAL_SOURCE_SETTINGS_NOT_RECORDED", subject, status: "unverified" });
    } catch { checks.push({ section: "Reports", code: "SAVED_ARTIFACT_INVALID", subject, status: "difference" }); }
  }
  return checks;
}

export function summarizeNumberChecks(campaignIdHash: string, checks: NumberCheck[], stable: boolean, checkedAt = new Date()) {
  const safeChecks = stable ? checks : [{ section: "scope", code: "PUBLICATION_CHANGED_DURING_CHECK", status: "unverified" as const }];
  return { campaignIdHash, checkedAt: checkedAt.toISOString(), status: safeChecks.some(c => c.status === "difference") ? "difference"
    : !safeChecks.length || safeChecks.some(c => c.status === "unverified") ? "unverified" : "passed", checks: safeChecks,
    scope: "Source and persisted-value checks. Unverified coverage is not a pass; this is not a production-readiness certification." };
}
