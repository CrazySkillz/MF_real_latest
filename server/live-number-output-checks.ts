import { compareNumber, dateIsValid, monitorHash, numberOrNull, resolveMonitorScope, type LiveNumberSnapshot, type NumberCheck } from "./live-number-checks";
import { resolveGA4KpiMetricIdentity } from "../shared/ga4-kpi-metric-identity";

export type MonitorOutputs = Record<string, any>;
const numericMetrics = ["users", "sessions", "conversions", "revenue", "pageviews", "engagedSessions"];

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
  return { scope, daily, totals, revenueSources, spendSources, imported, native, revenue, spend, conversions,
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
  const table = (section: string, saved: any[], returned: any, key: string, metrics: string[]) => {
    if (!Array.isArray(returned)) { checks.push({ section, code: "OUTPUT_ROWS_UNVERIFIED", status: "unverified" }); return; }
    const keys = saved.map(row => String(row[key])), actualKeys = returned.map(row => String(row[key]));
    flag(section, "ROW_IDENTITIES", new Set(keys).size === keys.length && new Set(actualKeys).size === actualKeys.length
      && JSON.stringify([...keys].sort()) === JSON.stringify([...actualKeys].sort()));
    for (const row of saved) {
      const actual = returned.find(item => String(item[key]) === String(row[key])), subject = monitorHash(String(row[key]));
      for (const metric of metrics) if (row[metric] !== undefined) value(section, metric, row[metric], actual?.[metric], ["revenue", "spend"].includes(metric) ? 2 : undefined, subject);
    }
  };
  for (const key of ["daily", "native", "breakdown", "landing", "events", "revenue", "revenueBreakdown", "spend", "spendBreakdown", "kpis", "benchmarks", "outcome", "executive", "trend", "financial", "reports", "notifications"]) {
    if (outputs[key] === undefined) checks.push({ section: "Application outputs", code: `RESPONSE_${key}_UNVERIFIED`, status: "unverified" });
  }
  if (outputs.daily) {
    flag("Overview response", "DATE_PROPERTY_TIMEZONE", outputs.daily.propertyId === scope.connection.propertyId && outputs.daily.overviewStartDate === scope.startDate
      && outputs.daily.endDate === scope.endDate && outputs.daily.reportingTimeZone === scope.reportingTimeZone);
    for (const metric of numericMetrics) value("Overview response", metric, totals[metric], outputs.daily.overviewTotals?.[metric], metric === "revenue" ? 2 : undefined);
    value("Overview response", "engagementRate", expected.engagementRate, outputs.daily.overviewTotals?.engagementRate, 8);
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
    if (key !== "native") table(key + " response", saved?.rows || [], actual.rows, key === "breakdown" ? "campaign" : key === "landing" ? "landingPage" : "eventName",
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
    const window = summary.currentValueWindow;
    if (!window) checks.push({ section, code: "SOURCE_WINDOW_UNVERIFIED", status: "unverified" });
    else flag(section, "SOURCE_WINDOW", summary.campaignId === campaign.id && window.startDate === scope.startDate && window.endDate === scope.endDate && window.reportingTimeZone === scope.reportingTimeZone);
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
  if (outputs.executive?.metrics && !outputs.executive.performanceSummary?.sources?.some((source: any) => source.connected && source.id !== "ga4" && source.category !== "financial")) {
    for (const [metric, wanted] of Object.entries({ totalRevenue: expected.revenue, totalSpend: expected.spend, totalConversions: totals.conversions,
      roas: expected.roas, roi: expected.roi, cpa: expected.cpa, cvr: expected.cvr, websitePageviews: totals.pageviews })) {
      if (wanted === null) checks.push({ section: "Executive metric response", code: `${metric}_UNAVAILABLE_BASIS_UNVERIFIED`, status: "unverified" });
      else value("Executive metric response", metric, wanted, outputs.executive.metrics[metric], 2);
    }
  }
  if (outputs.trend?.trendAnalysis) {
    const trend = outputs.trend.trendAnalysis, source = trend.sources?.find((source: any) => source.id === "ga4");
    flag("Trend response", "CAMPAIGN_PROPERTY_WINDOW", trend.campaignId === campaign.id && trend.endDate === scope.endDate && source?.freshness?.propertyId === scope.connection.propertyId);
    const selected = (rows.ga4DailyMetrics || []).filter(row => row.propertyId === scope.connection.propertyId && row.date >= trend.startDate && row.date <= scope.endDate);
    table("Trend GA4 series response", selected, source?.dailyRows?.map((row: any) => ({ date: row.date, ...row.metrics })), "date", ["users", "sessions", "conversions", "revenue", "engagementRate"]);
    for (const row of trend.dailyTotals || []) for (const [metric, wanted] of Object.entries({
      roas: row.metrics?.spend > 0 && numberOrNull(row.metrics?.revenue) !== null ? row.metrics.revenue / row.metrics.spend : null,
      roi: row.metrics?.spend > 0 && numberOrNull(row.metrics?.revenue) !== null ? (row.metrics.revenue - row.metrics.spend) / row.metrics.spend * 100 : null,
      cpa: row.metrics?.conversions > 0 && (row.metrics?.spend > 0 || (row.metrics?.spend === 0 && (rows.spendRecords || []).some(record => record.date === row.date && expected.spendSources.some(source => source.id === record.spendSourceId)))) ? row.metrics.spend / row.metrics.conversions : null,
      cvr: row.metrics?.sessions > 0 && numberOrNull(row.metrics?.conversions) !== null ? row.metrics.conversions / row.metrics.sessions * 100 : null,
    })) value("Trend daily ratio response", metric, wanted, row.metrics?.[metric], 2, monitorHash(String(row.date)));
  }
  if (outputs.reports) {
    const saved = (rows.linkedinReports || []).filter(row => row.platformType === "google_analytics");
    table("Report library response", saved, outputs.reports, "id", []);
    flag("Report library response", "CAMPAIGN_BOUNDARY", Array.isArray(outputs.reports) && outputs.reports.every((row: any) => row.campaignId === campaign.id));
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
