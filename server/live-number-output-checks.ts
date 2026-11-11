import { compareNumber, dateIsValid, monitorHash, monitoredUsers, monitorWindowMode, numberOrNull, parseMonitorMapping, resolveMonitorScope, type LiveNumberSnapshot, type NumberCheck } from "./live-number-checks";
import { resolveGA4KpiMetricIdentity } from "../shared/ga4-kpi-metric-identity";
import { buildExecutiveSummaryFinancialSourceIdentity } from "./utils/executive-summary-daily-snapshot";
import { resolveCompatibleTrendFinancialDaily } from "../client/src/lib/trend-analysis-cumulative";

export type MonitorOutputs = Record<string, any>;
const numericMetrics = ["users", "sessions", "conversions", "revenue", "pageviews", "engagedSessions"];

// Exact selectors used by Financial Analysis and Trend Analysis. A calendar
// month is intentionally different from Trend's fixed thirty-day interval.
export function monitorComparisonWindows(endDate: string) {
  if (!dateIsValid(endDate)) throw new Error("COMPARISON_DATE_INVALID");
  const day = new Date(endDate + "T00:00:00Z"), month = new Date(day);
  month.setUTCDate(1); month.setUTCMonth(month.getUTCMonth() - 1);
  month.setUTCDate(Math.min(day.getUTCDate(), new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()));
  return [...[1, 7, 14, 30, 90].map(days => ({ key: `comparison${days}d`, type: days === 1 ? "yesterday" : "last_week",
    date: new Date(day.getTime() - days * 86400000).toISOString().slice(0, 10) })),
  { key: "comparisonMonth", type: "last_month", date: month.toISOString().slice(0, 10) }];
}

export function checkFinancialComparisonOutputs(snapshot: LiveNumberSnapshot, outputs: MonitorOutputs, now = new Date()): NumberCheck[] {
  const e = expectedOutputNumbers(snapshot, now), checks: NumberCheck[] = [], { scope } = e;
  for (const window of monitorComparisonWindows(scope.endDate)) {
    const section = `Financial comparison / ${window.key}`, actual = outputs[window.key];
    const flag = (code: string, valid: boolean) => checks.push({ section, code, status: valid ? "passed" : "difference" });
    if (!actual) { checks.push({ section, code: "COMPARISON_RESPONSE_UNVERIFIED", status: "unverified" }); continue; }
    flag("EXACT_COMPARISON_DATE", actual.comparisonDate === window.date);
    for (const side of ["current", "previous"] as const) {
      const date = side === "current" ? scope.endDate : window.date;
      const retained = (snapshot.rows.metricSnapshots || []).filter(row => row.snapshotType === "financial_daily" && row.reportingDate === date);
      const returned = actual[side], financial = returned?.metrics?.financialDaily;
      if (retained.length > 1) { checks.push({ section, code: `${side}_DUPLICATE_SNAPSHOTS`, status: "unverified" }); continue; }
      if (!returned) {
        // Do not manufacture missing history. Retained valid inputs must not
        // disappear from a response; an absent derived basis remains unverified.
        checks.push({ section, code: `${side}_HISTORY_UNVERIFIED`, status: "unverified" }); continue;
      }
      const expectedStart = date < scope.startDate ? "1900-01-01" : scope.startDate;
      const reference = retained[0]?.metrics?.financialDaily;
      flag(`${side}_SCOPE`, returned.campaignId === snapshot.campaign.id && returned.snapshotType === "financial_daily"
        && returned.reportingDate === date && financial?.version === "financial_daily_snapshot_v1" && financial?.currency === (reference?.currency || scope.currency)
        && financial?.currentValueWindow?.mode === (reference?.currentValueWindow?.mode || monitorWindowMode())
        && financial?.currentValueWindow?.startDate === (reference?.currentValueWindow?.startDate || expectedStart) && financial?.currentValueWindow?.endDate === date
        && financial?.currentValueWindow?.dataThroughDate === date && financial?.currentValueWindow?.reportingTimeZone === (reference?.currentValueWindow?.reportingTimeZone || scope.reportingTimeZone));
      const compatible = returned.campaignId === snapshot.campaign.id && returned.snapshotType === "financial_daily" && returned.reportingDate === date
        && financial?.version === "financial_daily_snapshot_v1" && financial?.currency === scope.currency
        && ["initial_import_to_latest_completed_day", "initial_import_to_latest_available_day"].includes(financial?.currentValueWindow?.mode) && financial?.currentValueWindow?.startDate === expectedStart
        && financial?.currentValueWindow?.endDate === date && financial?.currentValueWindow?.dataThroughDate === date
        && financial?.currentValueWindow?.reportingTimeZone === scope.reportingTimeZone;
      const consumer = resolveCompatibleTrendFinancialDaily({ snapshot: returned, campaignId: snapshot.campaign.id, comparisonDate: date,
        campaignCurrency: scope.currency, currentValueWindow: { startDate: scope.startDate, reportingTimeZone: scope.reportingTimeZone } });
      flag(`${side}_DISPLAY_COMPATIBILITY`, compatible ? consumer === financial : consumer === null);
      let inputs = retained[0]?.metrics?.financialDaily?.inputs;
      if (retained.length) flag(`${side}_STORED_IDENTITY`, returned.id === retained[0].id);
      if (!inputs) {
        const days = e.daily.filter(row => row.date <= date), count = Math.max(0, (Date.parse(date) - Date.parse(scope.startDate)) / 86400000 + 1);
        const complete = days.length === count && new Set(days.map(row => row.date)).size === count
          && days.every(row => row.campaignId === snapshot.campaign.id && !row.isSimulated && dateIsValid(row.date)
            && numberOrNull(row.revenue) !== null && numberOrNull(row.conversions) !== null);
        if (!complete || e.revenueSources.some(source => source.value === null) || e.spendSources.some(source => source.value === null)) {
          checks.push({ section, code: `${side}_DATED_INPUTS_UNVERIFIED`, status: "unverified" }); continue;
        }
        const atDate = (kind: "revenue" | "spend") => (kind === "revenue" ? e.revenueSources : e.spendSources).reduce((sum, source) => {
          const selected = (snapshot.rows[kind + "Records"] || []).filter(row => row[kind + "SourceId"] === source.id && row.date <= date);
          const aggregate = selected.filter(row => !row.subCampaignUrn);
          return sum + (kind === "revenue" && aggregate.length ? aggregate : selected).reduce((total, row) => total + Number(row[kind]), 0);
        }, 0);
        const sourcesAtDate = (kind: "revenue" | "spend") => (kind === "revenue" ? e.revenueSources : e.spendSources)
          .filter(source => (snapshot.rows[kind + "Records"] || []).some(row => row[kind + "SourceId"] === source.id && row.date <= date));
        const hasSpend = sourcesAtDate("spend").length > 0;
        inputs = {
          revenue: { available: true, value: days.reduce((sum, row) => sum + Number(row.revenue), 0) + atDate("revenue"), sources: ["ga4", ...sourcesAtDate("revenue").map(source => `revenue-source:${source.id}`)] },
          conversions: { available: true, value: days.reduce((sum, row) => sum + Number(row.conversions), 0), sources: ["ga4"] },
          spend: { available: hasSpend, value: hasSpend ? atDate("spend") : null, sources: hasSpend ? ["canonical_spend_sources"] : [] },
        };
      }
      for (const metric of ["revenue", "spend", "conversions"]) {
        const wanted = inputs[metric], value = financial?.inputs?.[metric];
        flag(`${side}_${metric}_AVAILABILITY`, typeof wanted?.available === "boolean" && value?.available === wanted.available
          && (wanted.available || value?.value === null));
        flag(`${side}_${metric}_SOURCE_IDENTITIES`, Array.isArray(wanted?.sources) && Array.isArray(value?.sources)
          && JSON.stringify([...wanted.sources].sort()) === JSON.stringify([...value.sources].sort()));
        if (wanted?.available) checks.push(compareNumber(section, `${side}_${metric}`, wanted.value, value?.value,
          { decimals: metric === "conversions" ? undefined : 2, conversions: metric === "conversions", operations: 10000 }));
      }
    }
  }
  return checks;
}

// Independent target bands for the currently supported GA4 metric definitions.
// Unsupported/custom definitions remain explicit gaps, never guessed targets.
export function expectedTargetNumbers(snapshot: LiveNumberSnapshot, now = new Date()) {
  const e = expectedOutputNumbers(snapshot, now);
  const numbers: Record<string, number | null> = { ...e.totals, revenue: e.revenue, roas: e.roas, roi: e.roi, cpa: e.cpa,
    conversion_rate: e.cvr, engagement_rate: e.engagementRate === null ? null : e.engagementRate * 100 };
  return ["kpis", "benchmarks"].flatMap(kind => (snapshot.rows[kind] || []).filter(row => row.platformType === "google_analytics" && row.status !== "inactive").map(row => {
    const identity = resolveGA4KpiMetricIdentity(row.metric, row.name), current = identity ? numbers[identity] : null;
    const target = numberOrNull(kind === "kpis" ? row.targetValue : row.benchmarkValue);
    if (!identity || row.applyTo !== "all" || row.calculationConfig || current == null || target === null || target <= 0) return { kind, row, verified: false as const };
    const lower = identity === "cpa", delta = (current - target) / target * 100 * (lower ? -1 : 1);
    const rate = ["conversion_rate", "engagement_rate"].includes(identity);
    const count = ["users", "sessions", "conversions", "pageviews"].includes(identity);
    const absolute = rate && target >= 2 ? 0.25 : count && target >= 5 ? target < 20 ? 1 : Math.max(1, target * 0.05) : 0;
    const tolerance = Math.max(target * 0.05, absolute);
    const band = Math.abs(current - target) <= tolerance + 1e-9 ? "near" : delta > 0 ? "above" : "below";
    const ratio = lower ? current > 0 ? target / current : 0 : current / target;
    const benchmarkStatus = ratio <= 1e-9 ? "behind" : delta >= -5 - 1e-9 || Math.abs(current - target) <= absolute + 1e-9
      ? "on_track" : ratio + 1e-9 < 0.7 ? "behind" : "needs_attention";
    return { kind, row, verified: true as const, identity, current, target, delta, band, benchmarkStatus, attainment: kind === "benchmarks" ? Math.max(0, Math.min(ratio * 100, 100)) : Math.min(ratio * 100, 100) };
  }));
}

// Independent expected values. This module never calls a production calculation,
// writes a value, or equates whole-window unique users with summed daily users.
export function expectedOutputNumbers(snapshot: LiveNumberSnapshot, now = new Date()) {
  const scope = resolveMonitorScope(snapshot, now), { rows, campaign } = snapshot;
  const daily = (rows.ga4DailyMetrics || []).filter(r => r.propertyId === scope.connection.propertyId && r.date >= scope.startDate && r.date <= scope.endDate);
  const totals: Record<string, number | null> = {};
  for (const metric of numericMetrics) {
    const values = daily.map(row => numberOrNull(row[metric]));
    totals[metric] = values.length && values.every(value => value !== null) ? values.reduce<number>((sum, value) => sum + value!, 0) : null;
  }
  totals.users = monitoredUsers(snapshot, scope);
  const sourceValues = (kind: "revenue" | "spend") => (rows[kind + "Sources"] || [])
    .filter(source => source.isActive && (!source.platformContext || source.platformContext === "ga4"))
    .map(source => {
      const all = (rows[kind + "Records"] || []).filter(row => row[kind + "SourceId"] === source.id);
      const eligible = all.filter(row => row.date <= scope.endDate);
      const aggregate = eligible.filter(row => !row.subCampaignUrn), selected = aggregate.length ? aggregate : eligible;
      const valid = source.campaignId === campaign.id && source.currency === scope.currency && all.length > 0
        && all.every(row => row.campaignId === campaign.id && row.currency === scope.currency && dateIsValid(row.date) && numberOrNull(row[kind]) !== null);
      return { id: source.id, value: valid ? selected.reduce((sum, row) => sum + Number(row[kind]), 0) : null };
    });
  const revenueSources = sourceValues("revenue"), spendSources = sourceValues("spend");
  const sum = (sources: { value: number | null }[]) => sources.some(row => row.value === null) ? null : sources.reduce((sum, row) => sum + row.value!, 0);
  const imported = sum(revenueSources), spend = spendSources.length ? sum(spendSources) : null;
  const native = numberOrNull(scope.publication.campaignBreakdown?.totals?.revenue);
  const revenue = native !== null && imported !== null ? native + imported : null;
  const conversions = numberOrNull(scope.publication.campaignBreakdown?.totals?.conversions);
  const start = campaign.pacingStartDate, end = campaign.pacingEndDate;
  const periodValid = dateIsValid(start) && dateIsValid(end) && start <= end;
  const through = periodValid && end < scope.endDate ? end : scope.endDate;
  const periodSpend = !periodValid || spend === null ? null : spendSources.reduce((sum, source) => {
    const eligible = (rows.spendRecords || []).filter(row => row.spendSourceId === source.id && row.date >= start && row.date <= through);
    const aggregate = eligible.filter(row => !row.subCampaignUrn);
    return sum + (aggregate.length ? aggregate : eligible).reduce((total, row) => total + Number(row.spend), 0);
  }, 0);
  const budgetValue = numberOrNull(typeof campaign.budget === "string" ? campaign.budget.replaceAll(",", "") : campaign.budget);
  const budget = budgetValue !== null && budgetValue > 0 ? budgetValue : null;
  const days = periodValid ? (Date.parse(end) - Date.parse(start)) / 86400000 + 1 : 0;
  const elapsed = dateIsValid(start) ? Math.max(0, (Date.parse(through) - Date.parse(start)) / 86400000 + 1) : 0;
  const burn = periodSpend !== null && elapsed > 0 ? periodSpend / elapsed : null;
  const target = budget !== null && days > 0 ? budget / days : null;
  const pacing = { budget, periodSpend, remaining: budget !== null && periodSpend !== null ? budget - periodSpend : null,
    utilization: budget !== null && periodSpend !== null ? periodSpend / budget * 100 : null, burn, target,
    percentage: burn !== null && target !== null && target > 0 ? burn / target * 100 : null };
  return { scope, daily, totals, revenueSources, spendSources, imported, native, revenue, spend, conversions,
    pacing,
    profit: revenue !== null && spend !== null ? revenue - spend : null,
    roas: revenue !== null && spend !== null && spend > 0 ? revenue / spend : null,
    roi: revenue !== null && spend !== null && spend > 0 ? (revenue - spend) / spend * 100 : null,
    cpa: spend !== null && conversions !== null && conversions > 0 ? spend / conversions : null,
    cvr: totals.sessions !== null && totals.sessions > 0 && totals.conversions !== null ? totals.conversions / totals.sessions * 100 : null,
    engagementRate: totals.sessions !== null && totals.sessions > 0 && totals.engagedSessions !== null ? totals.engagedSessions / totals.sessions : null };
}

// Check the response of the real route, not a fixture or a reimplemented route.
export function checkApplicationOutputs(snapshot: LiveNumberSnapshot, outputs: MonitorOutputs, now = new Date()): NumberCheck[] {
  const checks: NumberCheck[] = [];
  let expected: ReturnType<typeof expectedOutputNumbers>;
  try { expected = expectedOutputNumbers(snapshot, now); }
  catch { return [{ section: "Application outputs", code: "OUTPUT_SCOPE_UNVERIFIED", status: "unverified" }]; }
  const { scope, totals } = expected, { campaign, rows } = snapshot;
  const flag = (section: string, code: string, valid: boolean, subject?: string) => checks.push({ section, code, status: valid ? "passed" : "difference", ...(subject ? { subject } : {}) });
  const value = (section: string, code: string, wanted: unknown, actual: unknown, decimals?: number, subject?: string) => {
    if (wanted === null && actual === null) checks.push({ section, code: code + "_UNAVAILABLE", status: "passed", ...(subject ? { subject } : {}) });
    else checks.push(compareNumber(section, code, wanted, actual, { decimals, subject, conversions: code.toLowerCase().includes("conversions"), operations: 10000 }));
  };
  const table = (section: string, saved: any[], returned: any, key: string | string[], metrics: string[]) => {
    if (!Array.isArray(returned)) { checks.push({ section, code: "OUTPUT_ROWS_UNVERIFIED", status: "unverified" }); return; }
    const identity = (row: any) => Array.isArray(key) ? JSON.stringify(key.map(field => String(row[field] ?? ""))) : String(row[key]);
    const keys = saved.map(identity), actualKeys = returned.map(identity);
    flag(section, "ROW_IDENTITIES", new Set(keys).size === keys.length && new Set(actualKeys).size === actualKeys.length
      && JSON.stringify([...keys].sort()) === JSON.stringify([...actualKeys].sort()));
    for (const row of saved) {
      const actual = returned.find(item => identity(item) === identity(row)), subject = monitorHash(identity(row));
      for (const metric of metrics) if (row[metric] !== undefined) value(section, metric, row[metric], actual?.[metric], ["revenue", "spend"].includes(metric) ? 2 : undefined, subject);
    }
  };
  for (const key of ["daily", "native", "breakdown", "landing", "events", "revenue", "revenueBreakdown", "spend", "spendBreakdown", "kpis", "benchmarks", "outcome", "executive", "trend", "financial", "trajectory", "reports", "notifications"]) {
    if (outputs[key] === undefined) checks.push({ section: "Application outputs", code: `RESPONSE_${key}_UNVERIFIED`, status: "unverified" });
  }
  if (outputs.daily) {
    flag("Overview response", "DATE_PROPERTY_TIMEZONE", outputs.daily.propertyId === scope.connection.propertyId && outputs.daily.overviewStartDate === scope.startDate
      && outputs.daily.endDate === scope.endDate && outputs.daily.reportingTimeZone === scope.reportingTimeZone);
    for (const metric of numericMetrics) value("Overview response", metric, totals[metric], outputs.daily.overviewTotals?.[metric], metric === "revenue" ? 2 : undefined);
    value("Overview response", "engagementRate", expected.totals.sessions === 0 ? 0 : expected.engagementRate, outputs.daily.overviewTotals?.engagementRate, 8);
    const selected = (rows.ga4DailyMetrics || []).filter(row => row.propertyId === scope.connection.propertyId && row.date >= outputs.daily.startDate && row.date <= scope.endDate);
    table("Insights daily response", selected, outputs.daily.data, "date", [...numericMetrics, "engagementRate"]);
  }
  for (const key of ["native", "breakdown", "landing", "events"]) if (outputs[key]) {
    const actual = outputs[key], publicationKey = key === "landing" ? "landingPages" : key === "events" ? "conversionEvents" : "campaignBreakdown";
    const saved = scope.publication[publicationKey];
    flag(key + " response", "PUBLICATION_SCOPE", actual.propertyId === scope.connection.propertyId && actual.startDate === scope.startDate && actual.endDate === scope.endDate);
    if (key === "native" || key === "breakdown") for (const metric of ["users", "sessions", "conversions", "revenue", "engagedSessions", "engagementRate"]) {
      value(key + " response", metric, saved?.totals?.[metric], actual.totals?.[metric], ["revenue", "engagementRate"].includes(metric) ? 8 : undefined);
    }
    if (key !== "native") table(key + " response", saved?.rows || [], actual.rows, key === "breakdown" ? ["date", "campaign", "source", "medium", "channel", "device", "country"] : key === "landing" ? "landingPage" : "eventName",
      [...numericMetrics, "eventCount", "sessionKeyEventRate", "engagementRate"]);
  }
  for (const kind of ["revenue", "spend"] as const) {
    const sources = kind === "revenue" ? expected.revenueSources : expected.spendSources;
    // Source-list endpoints return zero and an empty identity list when no spend
    // source exists. Visible availability is checked on the diagnostic contract.
    const total = kind === "revenue" ? expected.imported : sources.length ? expected.spend : 0;
    if (outputs[kind]) {
      flag(kind + " response", "SOURCE_TO_DATE_WINDOW", outputs[kind].startDate === "1900-01-01" && outputs[kind].endDate === scope.endDate && outputs[kind].currency === scope.currency);
      value(kind + " response", "TOTAL", total, outputs[kind][kind === "revenue" ? "totalRevenue" : "spendToDate"], 2);
    }
    const breakdown = outputs[kind + "Breakdown"];
    if (breakdown) {
      value(kind + " source list", "TOTAL", total, breakdown[kind === "revenue" ? "totalRevenue" : "totalSpend"], 2);
      table(kind + " source list", sources.map(source => ({ sourceId: source.id, [kind]: source.value })), breakdown.sources, "sourceId", [kind]);
      flag(kind + " source list", "CURRENCY", Array.isArray(breakdown.sources) && breakdown.sources.every((source: any) => source.currency === scope.currency));
    }
  }
  for (const kind of ["kpis", "benchmarks"]) if (outputs[kind]) {
    const saved = (rows[kind] || []).filter(row => row.platformType === "google_analytics");
    table(kind + " response", saved, outputs[kind], "id", ["currentValue", kind === "kpis" ? "targetValue" : "benchmarkValue"]);
    flag(kind + " response", "CAMPAIGN_BOUNDARY", Array.isArray(outputs[kind]) && outputs[kind].every((row: any) => row.campaignId === campaign.id && row.platformType === "google_analytics"));
  }
  if (outputs.outcome) {
    const outcome = outputs.outcome;
    flag("Diagnostic responses", "CAMPAIGN_BOUNDARY", outcome.campaignId === campaign.id);
    for (const metric of ["revenue", "sessions", "users", "conversions"]) value("Diagnostic GA4 inputs", metric,
      metric === "revenue" ? expected.native : totals[metric], outcome.ga4?.[metric], metric === "revenue" ? 2 : undefined);
    for (const [metric, wanted] of Object.entries({ nativeRevenue: expected.native, importedRevenue: expected.imported, totalRevenue: expected.revenue,
      spend: expected.spend, conversions: expected.conversions, profit: expected.profit, roas: expected.roas, roi: expected.roi, cpa: expected.cpa })) {
      if (wanted === null && ["spend", "profit", "roas", "roi", "cpa"].includes(metric)) {
        const inputs = outcome.performanceSummary?.totals;
        flag("Budget & Financial Analysis response", metric + "_DISPLAY_UNAVAILABLE", metric === "profit"
          ? inputs?.spend?.available === false || inputs?.revenue?.available === false : inputs?.[metric]?.available === false);
      } else value("Budget & Financial Analysis response", metric, wanted, outcome.financials?.[metric], 2);
    }
    const pacing = outcome.budgetPacing, start = campaign.pacingStartDate, end = campaign.pacingEndDate;
    const validPeriod = dateIsValid(start) && dateIsValid(end) && start <= end;
    flag("Budget period response", "CAMPAIGN_CURRENCY", pacing?.campaignId === campaign.id && pacing?.currency === scope.currency);
    if (!validPeriod || expected.spend === null) flag("Budget period response", "UNCONFIGURED_UNAVAILABLE", pacing?.spend?.available === false);
    else {
      const through = end < scope.endDate ? end : scope.endDate;
      flag("Budget period response", "PERIOD", pacing?.periodStartDate === start && pacing?.periodEndDate === end && pacing?.dataThroughDate === through);
      let periodSpend = 0;
      for (const source of expected.spendSources) {
        const selected = (rows.spendRecords || []).filter(row => row.spendSourceId === source.id && row.date >= start && row.date <= through);
        const aggregate = selected.filter(row => !row.subCampaignUrn);
        periodSpend += (aggregate.length ? aggregate : selected).reduce((sum, row) => sum + Number(row.spend), 0);
      }
      value("Budget period response", "PERIOD_SPEND", periodSpend, pacing?.spend?.available ? pacing.spend.value : undefined, 2);
    }
  }
  for (const [section, summary] of [["Performance Summary response", outputs.outcome?.performanceSummary], ["Executive Summary response", outputs.executive?.performanceSummary]] as const) if (summary) {
    // The Executive page renders the outcome endpoint's aggregate/window; the
    // legacy executive response retains totals but has no window field.
    const screenSummary = section === "Executive Summary response" ? outputs.outcome?.performanceSummary : summary;
    const window = screenSummary?.currentValueWindow;
    if (!window) checks.push({ section, code: "SOURCE_WINDOW_UNVERIFIED", status: "unverified" });
    else flag(section, "SOURCE_WINDOW", summary.campaignId === campaign.id && screenSummary.campaignId === campaign.id && window.startDate === scope.startDate && window.endDate === scope.endDate && window.reportingTimeZone === scope.reportingTimeZone);
    const unsupportedSources = summary.sources?.some((source: any) => source.connected && source.id !== "ga4" && source.category !== "financial");
    if (unsupportedSources) { checks.push({ section, code: "ADDITIONAL_PLATFORM_OUTPUT_UNVERIFIED", status: "unverified" }); continue; }
    for (const [metric, wanted] of Object.entries({ users: totals.users, sessions: totals.sessions, conversions: totals.conversions,
      revenue: expected.revenue, spend: expected.spend, roas: expected.roas, roi: expected.roi, cpa: expected.cpa, cvr: expected.cvr })) {
      const actual = summary.totals?.[metric];
      if (wanted === null) flag(section, metric + "_UNAVAILABLE", actual?.available === false);
      else { flag(section, metric + "_AVAILABLE", actual?.available === true); value(section, metric, wanted, actual?.value, 2); }
    }
  }
  if (outputs.financial) {
    const saved = (rows.metricSnapshots || []).filter(row => row.snapshotType === "financial_daily" && row.reportingDate === scope.endDate);
    const actual = outputs.financial.snapshot;
    flag("Published financial response", "SNAPSHOT_IDENTITY", saved.length === 1 && actual?.id === saved[0].id && actual?.campaignId === campaign.id && actual?.reportingDate === scope.endDate);
    for (const [metric, wanted] of Object.entries({ revenue: expected.revenue, spend: expected.spend, conversions: expected.conversions })) {
      const input = actual?.metrics?.financialDaily?.inputs?.[metric];
      if (wanted === null) flag("Published financial response", metric + "_UNAVAILABLE", input?.available === false);
      else value("Published financial response", metric, wanted, input?.available ? input.value : undefined, 2);
    }
  }
  if (outputs.trajectory) {
    const section = "Executive trajectory response", actual = outputs.trajectory;
    const previousDate = new Date(Date.parse(scope.endDate) - 7 * 86400000).toISOString().slice(0, 10);
    flag(section, "COMPARISON_DATES", actual.reportingDate === scope.endDate && actual.comparisonDate === previousDate);
    const currentRows = (rows.metricSnapshots || []).filter(row => row.snapshotType === "executive_summary_daily" && row.reportingDate === scope.endDate);
    const previousRows = (rows.metricSnapshots || []).filter(row => row.snapshotType === "executive_summary_daily" && row.reportingDate === previousDate);
    const current = currentRows.length === 1 ? currentRows[0].metrics?.executiveSummaryDaily : null;
    const previous = previousRows.length === 1 ? previousRows[0].metrics?.executiveSummaryDaily : null;
    if (!current || !previous) {
      const daily = expected.daily;
      const fallbackVerified = current && !previous && expected.revenueSources.length === 0 && previousDate >= scope.startDate
        && currentRows[0].campaignId === campaign.id && current.currency === scope.currency && current.ga4PropertyId === scope.connection.propertyId
        && current.ga4CampaignFilter === String(campaign.ga4CampaignFilter).trim()
        && ["initial_import_to_latest_completed_day", "initial_import_to_latest_available_day"].includes(current.currentValueWindow?.mode)
        && current.currentValueWindow?.startDate === scope.startDate && current.currentValueWindow?.endDate === scope.endDate
        && current.currentValueWindow?.reportingTimeZone === scope.reportingTimeZone && current.totals?.revenue?.available === true
        && JSON.stringify(current.totals.revenue.sources) === '["ga4"]' && !current.sourceSignature?.some((id: string) => id.startsWith("revenue_source:"))
        && daily.length === (Date.parse(scope.endDate) - Date.parse(scope.startDate)) / 86400000 + 1 && new Set(daily.map(day => day.date)).size === daily.length
        && daily.every(day => day.campaignId === campaign.id && !day.isSimulated && dateIsValid(day.date) && numberOrNull(day.revenue) !== null)
        && expected.native !== null && Math.abs(Number(current.totals.revenue.value) - expected.native) < 0.005
        && Math.abs(daily.reduce((sum, day) => sum + Number(day.revenue), 0) - expected.native) < 0.005;
      const prior = daily.filter(day => day.date <= previousDate).reduce((sum, day) => sum + Number(day.revenue), 0);
      if (fallbackVerified && prior > 0) {
        const percentage = (expected.native! - prior) / prior * 100;
        value(section, "FALLBACK_REVENUE_CHANGE_PERCENT", percentage, actual.trendPercentage, 8);
        flag(section, "FALLBACK_TRAJECTORY_BAND", actual.available === true && actual.reason === null && actual.source === "financial_daily_fallback"
          && actual.trajectory === (percentage > 10 ? "accelerating" : percentage < -10 ? "declining" : "stable"));
      }
      else if (actual.available === false) flag(section, "MISSING_HISTORY_UNAVAILABLE", actual.trajectory === null && actual.trendPercentage === null && actual.reason === "not_enough_history");
      else checks.push({ section, code: "FALLBACK_HISTORY_UNVERIFIED", status: "unverified" });
    } else {
      flag(section, "HISTORY_CAMPAIGN_SCOPE", [currentRows[0], previousRows[0]].every(row => row.campaignId === campaign.id)
        && current.currency === scope.currency && current.ga4PropertyId === scope.connection.propertyId
        && current.ga4CampaignFilter === String(campaign.ga4CampaignFilter).trim()
        && current.currentValueWindow?.startDate === scope.startDate
        && current.currentValueWindow?.endDate === scope.endDate && previous.currentValueWindow?.endDate === previousDate);
      const compatible = ["version", "currency", "ga4PropertyId", "ga4CampaignFilter", "performanceSummaryVersion"].every(key => current[key] === previous[key])
        && ["mode", "startDate", "reportingTimeZone"].every(key => current.currentValueWindow?.[key] === previous.currentValueWindow?.[key]);
      const sameSources = JSON.stringify(current.sourceSignature) === JSON.stringify(previous.sourceSignature);
      let oldValue = numberOrNull(previous.totals?.revenue?.value), previousAvailable = previous.totals?.revenue?.available === true, reconstructed = false;
      const newValue = numberOrNull(current.totals?.revenue?.value);
      if (compatible && !sameSources) {
        const nonFinancial = (item: any) => item.sourceSignature.filter((id: string) => !/^(revenue|spend)_source:/.test(id));
        const sources = (rows.revenueSources || []).filter(source => source.isActive && (!source.platformContext || source.platformContext === "ga4"));
        // Reuse only the canonical identity serializer. Both dated amounts are
        // independently summed here, never read from a production calculator.
        const identities = sources.map(source => {
          const identity = buildExecutiveSummaryFinancialSourceIdentity(source);
          return `revenue_source:${identity.id}:configuration_sha256:${identity.configurationFingerprint}`;
        }).sort();
        const historyValid = expected.revenueSources.every(source => source.value !== null)
          && nonFinancial(current).length === 1 && nonFinancial(current)[0].startsWith("ga4:web_analytics:")
          && JSON.stringify(nonFinancial(current)) === JSON.stringify(nonFinancial(previous))
          && JSON.stringify(identities) === JSON.stringify(current.sourceSignature.filter((id: string) => id.startsWith("revenue_source:")).sort())
          && expected.daily.length === (Date.parse(scope.endDate) - Date.parse(scope.startDate)) / 86400000 + 1
          && new Set(expected.daily.map(day => day.date)).size === expected.daily.length
          && expected.daily.every(day => day.campaignId === campaign.id && !day.isSimulated && dateIsValid(day.date) && numberOrNull(day.revenue) !== null);
        const revenueAt = (date: string) => expected.daily.filter(day => day.date <= date).reduce((sum, day) => sum + Number(day.revenue), 0)
          + sources.reduce((sum, source) => {
            const eligible = (rows.revenueRecords || []).filter(record => record.revenueSourceId === source.id && record.date <= date);
            const aggregate = eligible.filter(record => !record.subCampaignUrn);
            return sum + (aggregate.length ? aggregate : eligible).reduce((total, record) => total + Number(record.revenue), 0);
          }, 0);
        if (historyValid && newValue !== null && Math.abs(revenueAt(scope.endDate) - newValue) < 0.005) {
          oldValue = Number(revenueAt(previousDate).toFixed(2)); previousAvailable = true; reconstructed = true;
          flag(section, "DATED_HISTORY_SOURCE", actual.source === "dated_revenue_history");
        }
      }
      if (!compatible) flag(section, "INCOMPATIBLE_HISTORY_UNAVAILABLE", actual.available === false && actual.trajectory === null && actual.trendPercentage === null && actual.reason === "incompatible_history");
      else if (!sameSources && !reconstructed) checks.push({ section, code: "CHANGED_SOURCE_HISTORY_UNVERIFIED", status: "unverified" });
      else if (!previousAvailable || current.totals?.revenue?.available !== true || oldValue === null || oldValue <= 0 || newValue === null) {
        flag(section, "REVENUE_HISTORY_UNAVAILABLE", actual.available === false && actual.trajectory === null && actual.trendPercentage === null && actual.reason === "revenue_history_unavailable");
      } else {
        const percentage = (newValue - oldValue) / oldValue * 100;
        value(section, "REVENUE_CHANGE_PERCENT", percentage, actual.trendPercentage, 8);
        flag(section, "TRAJECTORY_BAND", actual.available === true && actual.reason === null && actual.trajectory === (percentage > 10 ? "accelerating" : percentage < -10 ? "declining" : "stable"));
      }
    }
  }
  if (outputs.executive?.metrics && !outputs.executive.performanceSummary?.sources?.some((source: any) => source.connected && source.id !== "ga4" && source.category !== "financial")) {
    for (const [metric, wanted] of Object.entries({ totalRevenue: expected.revenue, totalSpend: expected.spend, totalConversions: totals.conversions,
      roas: expected.roas, roi: expected.roi, cpa: expected.cpa, cvr: expected.cvr, websitePageviews: totals.pageviews })) {
      if (wanted === null) {
        const displayMetric = metric === "totalSpend" ? "spend" : metric;
        // This legacy transport uses zero for missing metrics. The current page
        // reads availability from outcome totals, never from that sentinel.
        flag("Executive metric response", `${metric}_UNAVAILABLE_DISPLAY_GUARD`, outputs.executive.metrics[metric] === 0
          && outputs.executive.performanceSummary?.totals?.[displayMetric]?.available === false
          && outputs.outcome?.performanceSummary?.totals?.[displayMetric]?.available === false);
      }
      else value("Executive metric response", metric, wanted, outputs.executive.metrics[metric], 2);
    }
  }
  if (outputs.executive) {
    const targets = expectedTargetNumbers(snapshot, now);
    for (const kind of ["kpis", "benchmarks"]) {
      const section = "Executive " + kind + " response", wanted = targets.filter(item => item.kind === kind);
      const returned = kind === "kpis" ? outputs.executive.kpiProgress : outputs.executive.benchmarkComparison;
      if (!Array.isArray(returned)) { checks.push({ section, code: "TARGET_LIST_UNVERIFIED", status: "unverified" }); continue; }
      if (wanted.every(item => item.verified)) value(section, "TARGET_COUNT", wanted.length, returned.length);
      for (const item of wanted) {
        const subject = monitorHash(String(item.row.id));
        if (!item.verified) { checks.push({ section, code: "TARGET_DEFINITION_UNVERIFIED", subject, status: "unverified" }); continue; }
        const matches = returned.filter((row: any) => kind === "kpis" ? row.kpiId === item.row.id : row.metric === item.row.name);
        if (matches.length !== 1) { checks.push({ section, code: "TARGET_IDENTITY_UNVERIFIED", subject, status: "unverified" }); continue; }
        const row = matches[0];
        value(section, "CURRENT_VALUE", item.current, kind === "kpis" ? row.current : row.yours, 2, subject);
        value(section, "TARGET_VALUE", item.target, kind === "kpis" ? row.target : row.benchmark, 2, subject);
        flag(section, "TARGET_STATUS", row.status === (kind === "kpis" ? item.band : item.benchmarkStatus), subject);
        if (kind === "kpis") value(section, "ATTAINMENT_FILL", item.attainment, row.pctComplete, 6, subject);
        else value(section, "TARGET_DELTA", item.delta, typeof row.delta === "string" && /^[+-]?\d+(\.\d+)?%$/.test(row.delta) ? Number(row.delta.slice(0, -1)) : null, 1, subject);
      }
    }
  }
  if (outputs.trend?.trendAnalysis) {
    const trend = outputs.trend.trendAnalysis, source = trend.sources?.find((source: any) => source.id === "ga4");
    flag("Trend response", "CAMPAIGN_PROPERTY_WINDOW", trend.campaignId === campaign.id && trend.endDate === scope.endDate && source?.freshness?.propertyId === scope.connection.propertyId);
    const selected = (rows.ga4DailyMetrics || []).filter(row => row.propertyId === scope.connection.propertyId && row.date >= trend.startDate && row.date <= scope.endDate);
    table("Trend GA4 series response", selected, source?.dailyRows?.map((row: any) => ({ date: row.date, ...row.metrics })), "date", ["users", "sessions", "conversions", "revenue", "engagementRate"]);
    for (const row of trend.dailyTotals || []) {
      // Trend's total defaults revenue to zero even on dates with only spend.
      // A measured zero requires a native or eligible imported revenue record.
      const revenue = numberOrNull(row.metrics?.revenue), revenueKnown = revenue !== null && (revenue !== 0
        || selected.some(item => item.date === row.date && numberOrNull(item.revenue) !== null)
        || (rows.revenueRecords || []).some(item => item.date === row.date && item.campaignId === campaign.id && item.currency === scope.currency
          && expected.revenueSources.some(source => source.id === item.revenueSourceId) && numberOrNull(item.revenue) !== null));
      for (const [metric, wanted] of Object.entries({
      roas: row.metrics?.spend > 0 && revenueKnown ? revenue! / row.metrics.spend : null,
      roi: row.metrics?.spend > 0 && revenueKnown ? (revenue! - row.metrics.spend) / row.metrics.spend * 100 : null,
      cpa: row.metrics?.conversions > 0 && (row.metrics?.spend > 0 || (row.metrics?.spend === 0 && (rows.spendRecords || []).some(record => record.date === row.date && expected.spendSources.some(source => source.id === record.spendSourceId)))) ? row.metrics.spend / row.metrics.conversions : null,
      cvr: row.metrics?.sessions > 0 && numberOrNull(row.metrics?.conversions) !== null ? row.metrics.conversions / row.metrics.sessions * 100 : null,
    })) value("Trend daily ratio response", metric, wanted, row.metrics?.[metric], 2, monitorHash(String(row.date)));
    }
  }
  if (outputs.reports) {
    const saved = (rows.linkedinReports || []).filter(row => row.platformType === "google_analytics");
    table("Report library response", saved, outputs.reports, "id", []);
    flag("Report library response", "CAMPAIGN_BOUNDARY", Array.isArray(outputs.reports) && outputs.reports.every((row: any) => row.campaignId === campaign.id));
  }
  for (const provider of ["hubspot", "salesforce"]) {
    const section = `Pipeline Proxy / ${provider} response`;
    const configured = (rows.revenueSources || []).filter(source => source.isActive && source.platformContext === "ga4" && source.sourceType === provider)
      .map(source => { try { return { source, cfg: parseMonitorMapping(source.mappingConfig) }; } catch { return { source, cfg: {} as Record<string, any> }; } })
      .filter(item => item.cfg.pipelineEnabled === true);
    if (!configured.length) continue;
    const actual = outputs[provider + "Pipeline"], chosen = configured.filter(item => item.source.id === actual?.sourceId);
    if (!actual || chosen.length !== 1) { checks.push({ section, code: "PIPELINE_SOURCE_UNVERIFIED", status: "unverified" }); continue; }
    const { source, cfg } = chosen[0];
    flag(section, "PIPELINE_DEFINITION", actual.success === true && actual.pipelineEnabled === true && actual.mode === "current_stage" && cfg.pipelineProxyMode === "current_stage"
      && actual.lastUpdatedAt === cfg.pipelineLastUpdatedAt && !actual.warning && (actual.currency === scope.currency || cfg.pipelineTotalToDate === 0 && !actual.currency));
    flag(section, "CAMPAIGN_CURRENCY_BOUNDARY", source.campaignId === campaign.id && source.currency === scope.currency);
    value(section, "EXPECTED_REVENUE", cfg.pipelineTotalToDate, actual.totalToDate, 2);
    table(section, cfg.pipelineValueRevenueTotals || [], actual.pipelineValueRevenueTotals, "campaignValue", ["revenue"]);
  }
  if (outputs.notifications) {
    const items = Array.isArray(outputs.notifications) ? outputs.notifications : outputs.notifications.notifications;
    if (!Array.isArray(items)) checks.push({ section: "Notification response", code: "ALERT_LIST_UNVERIFIED", status: "unverified" });
    else for (const item of items.filter((item: any) => item.campaignId === campaign.id)) {
      let meta: any;
      try { meta = typeof item.metadata === "string" ? JSON.parse(item.metadata) : item.metadata; }
      catch { checks.push({ section: "Notification response", code: "ALERT_METADATA_UNVERIFIED", status: "unverified" }); continue; }
      if (!(meta?.kpiId || meta?.benchmarkId) || !(item.type === "performance-alert" || meta.alertType === "performance-alert" || /\b(kpi|benchmark)\s+alert\b/i.test(item.title))) continue;
      const kind = meta.kpiId ? "kpis" : "benchmarks", id = meta.kpiId || meta.benchmarkId, subject = monitorHash(String(item.id));
      const target = (rows[kind] || []).find(row => row.id === id && row.campaignId === campaign.id), identity = target && resolveGA4KpiMetricIdentity(target.metric, target.name);
      if (!identity || target.applyTo !== "all" || target.calculationConfig || target.platformType !== "google_analytics") {
        checks.push({ section: "Notification response", code: "ALERT_DEFINITION_UNVERIFIED", status: "unverified", subject }); continue;
      }
      const wanted = ({ ...totals, revenue: expected.revenue, roi: expected.roi, roas: expected.roas, cpa: expected.cpa,
        conversion_rate: expected.cvr, engagement_rate: expected.engagementRate === null ? null : expected.engagementRate * 100 } as Record<string, number | null>)[identity];
      value("Notification response", "CURRENT_VALUE", wanted, meta.currentValue, 2, subject);
      value("Notification response", "THRESHOLD", target.alertThreshold, meta.thresholdValue, 2, subject);
      const threshold = numberOrNull(target.alertThreshold), condition = target.alertCondition || "below";
      if (wanted == null || threshold === null || !["below", "above", "equals"].includes(condition)) checks.push({ section: "Notification response", code: "ALERT_BREACH_UNVERIFIED", status: "unverified", subject });
      else flag("Notification response", "VISIBLE_ALERT_BREACHED", target.alertsEnabled === true && !meta.dismissedAt && !meta.resolved
        && (condition === "above" ? wanted > threshold : condition === "below" ? wanted < threshold : Math.abs(wanted - threshold) < 0.01), subject);
      flag("Notification response", "TARGET_AND_LINK", meta.itemName === target.name && meta.platformType === target.platformType && meta.alertCondition === condition
        && typeof meta.actionUrl === "string" && meta.actionUrl.startsWith(`/campaigns/${campaign.id}/ga4-metrics`) && meta.actionUrl.includes(encodeURIComponent(id)), subject);
    }
  }
  return checks;
}
