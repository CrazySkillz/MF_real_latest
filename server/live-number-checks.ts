import { createHash } from "node:crypto";
import { financialDailySnapshotInputSchema } from "../shared/schema";
import { conversionCreditsMatch } from "../shared/metric-math";
import { resolveGA4KpiMetricIdentity } from "../shared/ga4-kpi-metric-identity";
import { getExpectedScheduledRefreshAt, getLatestCompleteReportingDate, normalizeReportingTimeZone } from "./utils/reporting-timezone";
import { ga4VerificationInputHash } from "./ga4-source-verification";
import { readReportPdfArtifact, readReportVerification } from "./utils/report-pdf-artifact";
import { parseExecutiveSummaryDailySnapshot } from "./utils/executive-summary-daily-snapshot";
import { buildGA4InsightsRollups, buildGA4InsightsMonthlySeries } from "../shared/ga4-insights";
import { resolveGA4KpiLiveValue } from "../shared/ga4-kpi-live-value";
import { computeAttainmentPct, computeBenchmarkThresholdResult, computeEffectiveDeltaPct, isLowerIsBetterKpi } from "../shared/kpi-math";
import { deriveTrendFinancialRatios } from "../client/src/lib/trend-analysis-cumulative";
import { resolveFinancialPacingCalendar } from "../client/src/lib/financial-executive-actions";
import { isAlertDecisionBreached } from "./utils/alert-decision";

export type LiveNumberSnapshot = { campaign: Record<string, any>; rows: Record<string, any[]>; comparisonRateDefinition?: "conversions_per_session" };
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
    const inputValue = (metric: "revenue" | "spend" | "conversions") => parsed.data.inputs[metric].available ? numberOrNull(parsed.data.inputs[metric].value) : null;
    const trend = deriveTrendFinancialRatios({ revenue: inputValue("revenue"), spend: inputValue("spend"), conversions: totals.conversions });
    for (const [metric, expected] of Object.entries({
      roas: spend !== null && spend > 0 && totalRevenue !== null ? totalRevenue / spend : null,
      roi: spend !== null && spend > 0 && totalRevenue !== null ? (totalRevenue - spend) / spend * 100 : null,
      cpa: totals.conversions !== null && totals.conversions > 0 && spend !== null ? spend / totals.conversions : null,
    })) {
      const actual = trend[metric as keyof typeof trend];
      if (expected === null && actual === null) checks.push({ section: "Trend Analysis calculations", code: `${metric}_UNAVAILABLE`, status: "passed" });
      else push("Trend Analysis calculations", metric, expected, actual, 2);
    }
  }
  if (dateIsValid(campaign.pacingStartDate) && dateIsValid(campaign.pacingEndDate) && campaign.pacingStartDate <= campaign.pacingEndDate) {
    const calendar = resolveFinancialPacingCalendar({ startDate: campaign.pacingStartDate, endDate: campaign.pacingEndDate,
      reportingTimeZone, dataThroughDate: endDate, now });
    const periodStart = Date.parse(campaign.pacingStartDate), periodEnd = Date.parse(campaign.pacingEndDate);
    push("Budget & Financial Analysis calculations", "BUDGET_PERIOD_DAYS", (periodEnd - periodStart) / 86400000 + 1, calendar.totalDays);
    push("Budget & Financial Analysis calculations", "BUDGET_ELAPSED_DAYS",
      Math.max(0, (Math.min(Date.parse(endDate), periodEnd) - periodStart) / 86400000 + 1), calendar.elapsedDays);
  }
  const metricValues: Record<string, number | null> = { ...totals, revenue: totalRevenue,
    conversion_rate: totals.sessions! > 0 && totals.conversions !== null ? totals.conversions / totals.sessions! * 100 : null,
    engagement_rate: totals.sessions! > 0 && totals.engagedSessions !== null ? totals.engagedSessions / totals.sessions! * 100 : null,
    roas: spend! > 0 && totalRevenue !== null ? totalRevenue / spend! : null,
    roi: spend! > 0 && totalRevenue !== null ? (totalRevenue - spend!) / spend! * 100 : null,
    cpa: totals.conversions! > 0 && spend !== null ? spend / totals.conversions! : null };
  // Exercise the same pure calculations consumed by cards/Insights/PDFs, using live
  // inputs. These checks do not claim that a browser or an API response was rendered.
  if (complete && Object.values(totals).every(value => value !== null)) {
    const rollups = buildGA4InsightsRollups(daily, endDate);
    const dayAt = (offset: number) => new Date(Date.parse(endDate) + offset * 86400000).toISOString().slice(0, 10);
    for (const [name, length, offset] of [["last3", 3, 0], ["prior3", 3, 3], ["last7", 7, 0], ["prior7", 7, 7], ["last30", 30, 0], ["prior30", 30, 30]] as const) {
      const lower = dayAt(-offset - length + 1), upper = dayAt(-offset);
      const selectedDays = daily.filter(row => row.date >= lower && row.date <= upper);
      const actual = rollups[name];
      checks.push({ section: "Insights calculations", code: `${name}_CALENDAR_SCOPE`, status:
        actual.startDate === lower && actual.endDate === upper && actual.days === selectedDays.length
        && actual.expectedDays === length && actual.complete === (selectedDays.length === length) ? "passed" : "difference" });
      const sums = Object.fromEntries(Object.keys(totals).map(metric => [metric, selectedDays.reduce((sum, row) => sum + Number(row[metric]), 0)]));
      for (const [metric, value] of Object.entries({ ...sums,
        cr: sums.sessions > 0 ? sums.conversions / sums.sessions * 100 : 0,
        pvps: sums.sessions > 0 ? sums.pageviews / sums.sessions : 0,
        engagementRate: sums.sessions > 0 ? sums.engagedSessions / sums.sessions * 100 : 0 })) {
        push("Insights calculations", `${name}_${metric}`, value, actual[metric as keyof typeof actual],
          ["revenue", "cr", "pvps", "engagementRate"].includes(metric) ? 2 : undefined);
      }
    }
    for (const metric of ["sessions", "users", "conversions", "revenue", "pageviews", "engagementRate"]) {
      const monthly = buildGA4InsightsMonthlySeries(daily, endDate, metric);
      const months = Array.from(new Set(daily.map(row => row.date.slice(0, 7)))).sort();
      checks.push({ section: "Insights calculations", code: `${metric}_MONTH_COVERAGE`, status:
        JSON.stringify(monthly.map(row => row.month)) === JSON.stringify(months) ? "passed" : "difference" });
      for (const month of months) {
        const selectedDays = daily.filter(row => row.date.startsWith(month)), actual = monthly.find(row => row.month === month);
        const sessions = selectedDays.reduce((sum, row) => sum + Number(row.sessions), 0);
        const expected = metric === "engagementRate" ? sessions > 0
          ? selectedDays.reduce((sum, row) => sum + Number(row.engagedSessions), 0) / sessions * 100 : 0
          : selectedDays.reduce((sum, row) => sum + Number(row[metric]), 0);
        push("Insights calculations", `MONTH_${metric}`, expected, actual?.value, ["revenue", "engagementRate"].includes(metric) ? 2 : undefined);
      }
    }
  }
  // Initial import publishes source values, not scheduled summary snapshots.
  // Accept their absence only for that verified publication before its first due refresh.
  const initial = (rows.ga4RefreshWork || []).filter(r => r.scope?.kind === "initial_import" && r.status === "completed");
  const work = initial.length === 1 ? initial[0] : null, receipt = work?.scope?.initialImportVerification;
  const proof = receipt?.properties?.length === 1 ? receipt.properties[0] : null;
  const completed = new Date(work?.completedAt).getTime(), created = new Date(campaign.createdAt).getTime();
  const due = getExpectedScheduledRefreshAt(endDate, { reportingTimeZone, hour: 8, hours: [8, 14, 20], minute: 0 }, now)!;
  const awaitingFirstSummary = campaign.status === "active" && work?.campaignId === campaign.id && work.reportingDate === endDate
    && !String(work.scopeHash || "").startsWith("invalidated:") && receipt?.version === 1
    && ["id", "ownerId", "clientId", "currency", "reportingTimeZone", "ga4CampaignFilter"].every(key => work.scope.campaign?.[key] === campaign[key])
    && created <= completed && completed <= now.getTime() && (due > now || completed > due.getTime())
    && proof?.connectionId === connection.id && proof.propertyId === connection.propertyId && proof.startDate === startDate && proof.endDate === endDate
    && proof.comparedValues > 0 && Date.parse(proof.checkedAt) >= created && Date.parse(proof.checkedAt) <= completed
    && proof.inputHash === ga4VerificationInputHash(publication, (rows.ga4DailyMetrics || []).filter(r => r.propertyId === connection.propertyId && r.date >= startDate && r.date <= endDate))
    && !(rows.ga4RefreshWork || []).some(r => r.scope?.kind !== "initial_import" && (r.startedAt || r.status === "completed"));
  const executiveRows = (rows.metricSnapshots || []).filter(r => r.snapshotType === "executive_summary_daily" && r.reportingDate === endDate);
  const executive = executiveRows.length === 1 ? parseExecutiveSummaryDailySnapshot(executiveRows[0] as any) : null;
  if (!executive || executive.campaignId !== campaign.id || executive.currency !== currency || executive.ga4PropertyId !== connection.propertyId
    || executive.ga4CampaignFilter !== String(campaign.ga4CampaignFilter).trim() || executive.currentValueWindow.startDate !== startDate
    || executive.currentValueWindow.reportingTimeZone !== reportingTimeZone) {
    const pending = awaitingFirstSummary && !(rows.metricSnapshots || []).some(r => r.snapshotType === "executive_summary_daily");
    checks.push({ section: "Executive Summary", code: pending ? "FIRST_SCHEDULED_SNAPSHOT_NOT_YET_DUE" : "EXECUTIVE_SNAPSHOT_SCOPE_UNVERIFIED", status: pending ? "passed" : "unverified" });
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
    const verification = sync.metrics.performanceSummaryVerification;
    const rev = available("revenue"), cost = available("spend"), conv = available("conversions"), sessions = available("sessions");
    const cpaConversions = verification?.version === 1 ? (verification.financialConversions?.available === true ? numberOrNull(verification.financialConversions.value) : null) : conv;
    const calculated = { roas: cost! > 0 && rev !== null ? rev / cost! : null,
      roi: cost! > 0 && rev !== null ? (rev - cost!) / cost! * 100 : null,
      cpa: cpaConversions! > 0 && cost !== null ? cost / cpaConversions! : null,
      cvr: sessions! > 0 && conv !== null ? conv / sessions! * 100 : null };
    for (const [metric, expected] of Object.entries(calculated)) {
      if (expected === null && values[metric]?.available === false) continue;
      push("Performance Summary", metric, expected, available(metric), 2);
    }
    const window = summary.currentValueWindow;
    if (verification?.version === 1) {
      const trafficWindow = verification.trafficWindow, financialWindow = verification.nativeFinancialWindow;
      const inputs = verification.trafficRows;
      const valid = verification.campaignId === campaign.id && verification.propertyId === connection.propertyId && verification.currency === currency
        && verification.campaignFilter === campaign.ga4CampaignFilter && dateIsValid(trafficWindow?.startDate) && dateIsValid(trafficWindow?.endDate)
        && trafficWindow.startDate <= trafficWindow.endDate && financialWindow?.startDate === startDate && financialWindow?.endDate === endDate
        && financialWindow?.reportingTimeZone === reportingTimeZone && verification.importedFinancialWindow?.startDate === "1900-01-01"
        && verification.importedFinancialWindow?.endDate === endDate && Array.isArray(inputs) && inputs.length > 0
        && new Set(inputs.map((r: any) => r.date)).size === inputs.length && inputs.every((r: any) => dateIsValid(r.date) && r.date >= trafficWindow.startDate && r.date <= trafficWindow.endDate);
      checks.push({ section: "Performance Summary", code: "SAVED_INPUT_SCOPE", status: valid ? "passed" : "unverified" });
      if (valid) {
        for (const metric of ["sessions", "users", "conversions"]) {
          const numbers = inputs.map((r: any) => numberOrNull(r[metric]));
          push("Performance Summary", `SAVED_INPUT_${metric}`, numbers.every((n: any) => n !== null && n >= 0) ? numbers.reduce<number>((a, b) => a + b!, 0) : null, available(metric));
        }
        const native = numberOrNull(verification.nativeRevenue);
        const amounts: Array<number | null> = Array.isArray(verification.revenueSources) ? verification.revenueSources.map((s: any) => numberOrNull(s.value)) : [null];
        push("Performance Summary", "SAVED_INPUT_revenue", native !== null && amounts.every((n: any) => n !== null) ? native + amounts.reduce<number>((a, b) => a + b!, 0) : null, rev, 2);
        if (cost !== null) push("Performance Summary", "SAVED_INPUT_spend", verification.spendSourceIds?.length ? verification.spend : verification.fallbackSpend, cost, 2);
      }
    } else if (!window || window.mode !== "initial_import_to_latest_completed_day" || window.startDate !== startDate
      || window.endDate !== endDate || window.dataThroughDate !== endDate || window.reportingTimeZone !== reportingTimeZone) {
      checks.push({ section: "Performance Summary", code: "SAVED_SOURCE_WINDOW_UNVERIFIED", status: "unverified" });
    } else {
      for (const metric of ["users", "sessions", "conversions", "revenue", "spend"]) {
        const expected = metric === "spend" ? spend : metricValues[metric];
        if (expected === null && values[metric]?.available === false) continue;
        push("Performance Summary", `INPUT_${metric}`, expected, available(metric), ["revenue", "spend"].includes(metric) ? 2 : undefined);
      }
    }
  } else checks.push({ section: "Performance Summary", code: awaitingFirstSummary && !sync ? "FIRST_SCHEDULED_SNAPSHOT_NOT_YET_DUE" : "SAVED_OUTPUT_UNVERIFIED", status: awaitingFirstSummary && !sync ? "passed" : "unverified" });
  for (const section of ["kpis", "benchmarks"]) for (const row of rows[section] || []) {
    if (row.status === "inactive") continue;
    const identity = resolveGA4KpiMetricIdentity(row.metric, row.name);
    const subject = monitorHash(row.id);
    if (row.platformType !== "google_analytics" || row.applyTo !== "all" || row.calculationConfig || !identity) {
      checks.push({ section, code: "METRIC_DEFINITION_UNVERIFIED", subject, status: "unverified" }); continue;
    }
    push(section, identity, metricValues[identity], row.currentValue,
      ["users", "sessions", "pageviews", "conversions"].includes(identity) ? undefined : 2, subject);
    const expected = metricValues[identity];
    if (expected === null || expected === undefined || !complete) continue;
    const actual = resolveGA4KpiLiveValue({ kpi: row, breakdownTotals: totals,
      overviewEngagementRate: metricValues.engagement_rate === null ? NaN : metricValues.engagement_rate / 100,
      financialRevenue: totalRevenue ?? NaN, financialSpend: spend ?? NaN,
      financialROI: metricValues.roi ?? NaN, financialCPA: metricValues.cpa ?? NaN });
    push(`${section} / PDF calculations`, `CALCULATED_${identity}`, expected, actual,
      ["users", "sessions", "pageviews", "conversions"].includes(identity) ? undefined : 2, subject);
    const target = numberOrNull(section === "kpis" ? row.targetValue : row.benchmarkValue);
    if (target !== null && target > 0) {
      const lowerIsBetter = identity === "cpa";
      checks.push({ section: `${section} / PDF calculations`, code: "TARGET_DIRECTION", subject,
        status: isLowerIsBetterKpi({ metric: row.metric, name: row.name }) === lowerIsBetter ? "passed" : "difference" });
      const expectedDelta = (expected - target) / target * 100 * (lowerIsBetter ? -1 : 1);
      push(`${section} / PDF calculations`, "TARGET_DELTA", expectedDelta,
        computeEffectiveDeltaPct({ current: expected, target, lowerIsBetter }), 2, subject);
      if (section === "kpis") push(`${section} / PDF calculations`, "TARGET_ATTAINMENT",
        Math.max(0, (lowerIsBetter ? expected > 0 ? target / expected : 1 : expected / target) * 100),
        computeAttainmentPct({ current: expected, target, lowerIsBetter }), 2, subject);
      else {
        const threshold = computeBenchmarkThresholdResult({ metric: row.metric, name: row.name, unit: row.unit, current: expected, benchmarkValue: target });
        const ratio = lowerIsBetter ? expected > 0 ? target / expected : null : expected / target;
        if (ratio !== null) push(`${section} / PDF calculations`, "TARGET_PROGRESS", Math.max(0, Math.min(100, ratio * 100)), threshold.pct, 2, subject);
      }
    }
    if (row.alertsEnabled) {
      const threshold = numberOrNull(row.alertThreshold), condition = row.alertCondition || "below";
      if (threshold === null || !["below", "above", "equals"].includes(condition)) {
        checks.push({ section: "Alerts / threshold calculations", code: "ALERT_THRESHOLD_UNVERIFIED", subject, status: "unverified" });
      } else {
        const expectedBreach = condition === "above" ? expected > threshold : condition === "below" ? expected < threshold : Math.abs(expected - threshold) < 0.01;
        const actualBreach = isAlertDecisionBreached({ ...row, currentValue: expected, __alertDecisionEligible: true });
        checks.push({ section: "Alerts / threshold calculations", code: "THRESHOLD_COMPARISON", subject, status: actualBreach === expectedBreach ? "passed" : "difference" });
        checks.push({ section: "Alerts / threshold calculations", code: "UNAVAILABLE_INPUT_BLOCKED", subject,
          status: !isAlertDecisionBreached({ ...row, currentValue: expected, __alertDecisionEligible: false }) ? "passed" : "difference" });
      }
    }
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
      const verification = readReportVerification(payload);
      if (!definition && !verification) checks.push({ section: "Reports", code: "REPORT_DEFINITION_RETIRED", subject, status: "unverified" });
      checks.push({ section: "Reports", code: verification ? "SAVED_VERIFICATION_INPUTS" : "HISTORICAL_SOURCE_SETTINGS_NOT_RECORDED", subject, status: verification ? "passed" : "unverified" });
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
