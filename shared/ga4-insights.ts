import { getGA4KpiMetricDependencies, resolveGA4KpiMetricIdentity } from "./ga4-kpi-metric-identity";

export type GA4InsightsDailyRow = {
  date: string;
  sessions?: number;
  users?: number;
  conversions?: number;
  revenue?: number;
  pageviews?: number;
  engagementRate?: number;
  engagedSessions?: number | null;
  [key: string]: unknown;
};

export type GA4InsightsRollup = {
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
  pageviews: number;
  engagedSessions: number;
  cr: number;
  pvps: number;
  engagementRate: number;
  startDate: string | null;
  endDate: string | null;
  days: number;
  expectedDays: number;
  complete: boolean;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const toGA4InsightsDateOnly = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const normalized = String(value || "").trim().slice(0, 10);
  return DATE_ONLY.test(normalized) ? normalized : null;
};

export const countGA4InsightsConsecutiveDays = <T>(
  rows: T[],
  getRecordedAt: (row: T) => unknown,
  matches: (row: T) => boolean,
): number => {
  let previousDate: string | null = null;
  let count = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = toGA4InsightsDateOnly(getRecordedAt(row));
    if (!date || !matches(row)) break;
    if (previousDate && addGA4InsightsDateDays(previousDate, -1) !== date) break;
    previousDate = date;
    count += 1;
  }
  return count;
};

export const buildGA4InsightsSpendSourceLabels = (
  persistedSpend: number,
  sourceIds: unknown,
  sources: unknown,
): string[] => {
  const definitions = Array.isArray(sources) ? sources : [];
  const ids = Array.isArray(sourceIds) ? sourceIds.map(String) : [];
  const selected = ids.length > 0
    ? ids.map((id) => definitions.find((source: any) => String(source?.id) === id)).filter(Boolean)
    : Number(persistedSpend || 0) === 0 ? definitions.filter((source: any) => source?.isActive !== false) : [];
  return Array.from(new Set(selected.map((source: any) =>
    String(source?.displayName || source?.sourceType || "").trim(),
  ).filter(Boolean)));
};

export const hasGA4InsightsAnalyticsHistory = (analytics: unknown, field: "progress" | "history") =>
  Array.isArray((analytics as any)?.[field]) && (analytics as any)[field].length > 0;

export const buildGA4InsightsHistoryScopeMarker = (
  propertyId: unknown,
  campaignFilter: unknown,
  reportingTimeZone: unknown = "UTC",
  currency: unknown = "USD",
) => {
  const property = String(propertyId || "").trim().replace(/^properties\//i, "");
  const timeZone = String(reportingTimeZone || "UTC").trim() || "UTC";
  const currencyCode = String(currency || "USD").trim().toUpperCase() || "USD";
  const rawFilters = Array.isArray(campaignFilter)
    ? campaignFilter
    : campaignFilter == null || String(campaignFilter).trim() === ""
      ? []
      : [campaignFilter];
  const filters = Array.from(new Set(rawFilters.map((value) => String(value || "").trim()).filter(Boolean))).sort();
  return `ga4_scope_v1:${encodeURIComponent(property)}:${encodeURIComponent(timeZone)}:${encodeURIComponent(currencyCode)}:${encodeURIComponent(JSON.stringify(filters))}`;
};

export const filterGA4InsightsHistoryByScope = <T extends { notes?: unknown }>(rows: T[], marker: string): T[] =>
  (Array.isArray(rows) ? rows : []).filter((row) =>
    String(row?.notes || "").split(";").some((part) => part === marker),
  );

export const assertGA4InsightsFinancialCurrencyScope = (
  campaign: any,
  sources: any[],
  observedCurrency: unknown,
  label: string,
  requireObserved = false,
) => {
  const activeSources = (Array.isArray(sources) ? sources : []).filter((source: any) => source?.isActive !== false);
  if (label === "Spend") {
    for (const source of activeSources) {
      const sourceType = String(source?.sourceType || "").trim().toLowerCase();
      let mapping: any = {};
      try { mapping = typeof source?.mappingConfig === "string" ? JSON.parse(source.mappingConfig) : source?.mappingConfig || {}; } catch { mapping = {}; }
      const googleAds = sourceType === "ad_platforms" && String(mapping?.platform || "").trim().toLowerCase() === "google_ads";
      if (sourceType !== "csv" && sourceType !== "google_sheets" && !googleAds) {
        throw new Error("Spend source is outside the current GA4 Insights release scope");
      }
    }
  }
  if (label === "Imported revenue") {
    const excluded = new Set(["linkedin", "linkedin_api", "meta", "facebook", "instagram", "instagram_api"]);
    if (activeSources.some((source: any) => excluded.has(String(source?.sourceType || "").trim().toLowerCase()))) {
      throw new Error("Imported revenue source is outside the current GA4 Insights release scope");
    }
  }
  const expected = String(campaign?.currency || "USD").trim().toUpperCase();
  const observed = String(observedCurrency || "").trim().toUpperCase();
  const configured = activeSources
    .map((source: any) => String(source?.currency || "").trim().toUpperCase());
  if (requireObserved && !observed) throw new Error(`${label} currency is unavailable`);
  if (configured.some((currency) => !currency)) throw new Error(`${label} source currency is unavailable`);
  const currencies = new Set([...configured, observed].filter(Boolean));
  if (currencies.size > 1 || (currencies.size === 1 && !currencies.has(expected))) {
    throw new Error(`${label} currency does not match campaign currency ${expected}`);
  }
};

const normalizeGA4InsightsPropertyId = (value: unknown) =>
  String(value || "").trim().replace(/^properties\//i, "");

export const isGA4InsightsAnalyticsHistoryInSelectedPropertyScope = (
  selectedPropertyId: unknown,
  primaryPropertyId: unknown,
) => {
  const selected = normalizeGA4InsightsPropertyId(selectedPropertyId);
  const primary = normalizeGA4InsightsPropertyId(primaryPropertyId);
  return selected.length > 0 && primary.length > 0 && selected === primary;
};

export const calculateGA4InsightsDeltaPct = (current: number, previous: number) =>
  previous !== 0
    ? ((current - previous) / Math.abs(previous)) * 100
    : current > 0 ? 100 : current < 0 ? -100 : 0;

export const addGA4InsightsDateDays = (value: string, days: number): string | null => {
  if (!DATE_ONLY.test(String(value || ""))) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const areGA4InsightsMonthsAdjacent = (currentMonth: string, previousMonth: string) => {
  if (!/^\d{4}-\d{2}$/.test(currentMonth) || !/^\d{4}-\d{2}$/.test(previousMonth)) return false;
  const [currentYear, currentNumber] = currentMonth.split("-").map(Number);
  const [previousYear, previousNumber] = previousMonth.split("-").map(Number);
  return currentYear * 12 + currentNumber === previousYear * 12 + previousNumber + 1;
};

export const normalizeGA4InsightsDailyMetricValues = (row: any): GA4InsightsDailyRow | null => {
  const number = (value: unknown, options: { allowNegative?: boolean; missing?: number | null } = {}) => {
    if (value === null || typeof value === "undefined" || value === "") return Object.prototype.hasOwnProperty.call(options, "missing") ? options.missing! : 0;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || (!options.allowNegative && parsed < 0)) return null;
    return parsed;
  };
  const sessions = number(row?.sessions);
  const users = number(row?.users);
  const conversions = number(row?.conversions);
  const revenue = number(row?.revenue, { allowNegative: true });
  const pageviews = number(row?.pageviews);
  const engagementRate = number(row?.engagementRate);
  const engagedSessions = number(row?.engagedSessions, { missing: null });
  if ([sessions, users, conversions, revenue, pageviews, engagementRate].some((value) => value === null)) return null;
  if (engagedSessions !== null && (engagedSessions as number) > (sessions as number)) return null;
  if ((engagementRate as number) > 100) return null;
  return { ...row, sessions: sessions as number, users: users as number, conversions: conversions as number, revenue: revenue as number, pageviews: pageviews as number, engagementRate: engagementRate as number, engagedSessions };
};

export const normalizeGA4InsightsDailyRows = (
  rows: unknown,
  dataThroughDate?: string | null,
): GA4InsightsDailyRow[] => {
  const cutoff = DATE_ONLY.test(String(dataThroughDate || "")) ? String(dataThroughDate) : null;
  const byDate = new Map<string, GA4InsightsDailyRow>();
  for (const raw of Array.isArray(rows) ? rows : []) {
    const row = (raw || {}) as GA4InsightsDailyRow;
    const date = String(row.date || "").trim();
    if (!DATE_ONLY.test(date) || (cutoff && date > cutoff)) continue;
    const normalized = normalizeGA4InsightsDailyMetricValues(row);
    if (!normalized) continue;
    byDate.set(date, {
      ...normalized,
      date,
    });
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export const buildGA4InsightsCalendarRollup = (
  rows: GA4InsightsDailyRow[],
  endDate: string | null,
  expectedDays: number,
): GA4InsightsRollup => {
  const safeDays = Math.max(1, Math.floor(expectedDays || 1));
  const startDate = endDate ? addGA4InsightsDateDays(endDate, -(safeDays - 1)) : null;
  const slice = startDate && endDate
    ? rows.filter((row) => row.date >= startDate && row.date <= endDate)
    : [];
  const sums = slice.reduce(
    (acc, row) => {
      const sessions = Number(row.sessions || 0) || 0;
      const explicitEngaged = Number(row.engagedSessions);
      const rate = Number(row.engagementRate || 0) || 0;
      acc.sessions += sessions;
      acc.users += Number(row.users || 0) || 0;
      acc.conversions += Number(row.conversions || 0) || 0;
      acc.revenue += Number(row.revenue || 0) || 0;
      acc.pageviews += Number(row.pageviews || 0) || 0;
      acc.engagedSessions += row.engagedSessions != null && Number.isFinite(explicitEngaged) && explicitEngaged >= 0
        ? explicitEngaged
        : sessions * (rate <= 1 ? rate : rate / 100);
      return acc;
    },
    { sessions: 0, users: 0, conversions: 0, revenue: 0, pageviews: 0, engagedSessions: 0 },
  );
  return {
    ...sums,
    cr: sums.sessions > 0 ? (sums.conversions / sums.sessions) * 100 : 0,
    pvps: sums.sessions > 0 ? sums.pageviews / sums.sessions : 0,
    engagementRate: sums.sessions > 0 ? (sums.engagedSessions / sums.sessions) * 100 : 0,
    startDate,
    endDate,
    days: slice.length,
    expectedDays: safeDays,
    complete: slice.length === safeDays,
  };
};

export const buildGA4InsightsRollups = (
  rawRows: unknown,
  dataThroughDate?: string | null,
) => {
  const rows = normalizeGA4InsightsDailyRows(rawRows, dataThroughDate);
  const cutoff = DATE_ONLY.test(String(dataThroughDate || ""))
    ? String(dataThroughDate)
    : rows[rows.length - 1]?.date || null;
  const rollup = (days: number, offset: number) =>
    buildGA4InsightsCalendarRollup(rows, cutoff ? addGA4InsightsDateDays(cutoff, -offset) : null, days);
  const last3 = rollup(3, 0);
  const prior3 = rollup(3, 3);
  const last7 = rollup(7, 0);
  const prior7 = rollup(7, 7);
  const last30 = rollup(30, 0);
  const prior30 = rollup(30, 30);
  return {
    rows,
    cutoff,
    availableDays: rows.length,
    last3,
    prior3,
    last7,
    prior7,
    last30,
    prior30,
    deltas: {
      sessions3: calculateGA4InsightsDeltaPct(last3.sessions, prior3.sessions),
      conversions3: calculateGA4InsightsDeltaPct(last3.conversions, prior3.conversions),
      revenue3: calculateGA4InsightsDeltaPct(last3.revenue, prior3.revenue),
      cr3: calculateGA4InsightsDeltaPct(last3.cr, prior3.cr),
      pvps3: calculateGA4InsightsDeltaPct(last3.pvps, prior3.pvps),
      sessions7: calculateGA4InsightsDeltaPct(last7.sessions, prior7.sessions),
      conversions7: calculateGA4InsightsDeltaPct(last7.conversions, prior7.conversions),
      revenue7: calculateGA4InsightsDeltaPct(last7.revenue, prior7.revenue),
      cr7: calculateGA4InsightsDeltaPct(last7.cr, prior7.cr),
      pvps7: calculateGA4InsightsDeltaPct(last7.pvps, prior7.pvps),
      users7: calculateGA4InsightsDeltaPct(last7.users, prior7.users),
      engRate7: calculateGA4InsightsDeltaPct(last7.engagementRate, prior7.engagementRate),
      sessions30: calculateGA4InsightsDeltaPct(last30.sessions, prior30.sessions),
      conversions30: calculateGA4InsightsDeltaPct(last30.conversions, prior30.conversions),
      revenue30: calculateGA4InsightsDeltaPct(last30.revenue, prior30.revenue),
      cr30: calculateGA4InsightsDeltaPct(last30.cr, prior30.cr),
      pvps30: calculateGA4InsightsDeltaPct(last30.pvps, prior30.pvps),
      users30: calculateGA4InsightsDeltaPct(last30.users, prior30.users),
      engRate30: calculateGA4InsightsDeltaPct(last30.engagementRate, prior30.engagementRate),
    },
  };
};

export const buildGA4InsightsMonthlySeries = (
  rawRows: unknown,
  dataThroughDate: string | null,
  metric: string,
) => {
  const rows = normalizeGA4InsightsDailyRows(rawRows, dataThroughDate);
  const cutoff = DATE_ONLY.test(String(dataThroughDate || "")) ? String(dataThroughDate) : rows.at(-1)?.date || "";
  const cutoffMonth = cutoff.slice(0, 7);
  const byMonth = new Map<string, GA4InsightsDailyRow[]>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) || []), row]);
  }
  return Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, monthRows]) => {
    const [year, monthNumber] = month.split("-").map(Number);
    const calendarDays = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const expectedDays = month === cutoffMonth ? Number(cutoff.slice(8, 10)) : calendarDays;
    const sessions = monthRows.reduce((sum, row) => sum + (Number(row.sessions || 0) || 0), 0);
    const engagedSessions = monthRows.reduce((sum, row) => {
      const explicit = Number(row.engagedSessions);
      const rate = Number(row.engagementRate || 0) || 0;
      return sum + (row.engagedSessions != null && Number.isFinite(explicit) && explicit >= 0
        ? explicit
        : (Number(row.sessions || 0) || 0) * (rate <= 1 ? rate : rate / 100));
    }, 0);
    const value = metric === "engagementRate"
      ? (sessions > 0 ? (engagedSessions / sessions) * 100 : 0)
      : monthRows.reduce((sum, row) => sum + (Number(row[metric] || 0) || 0), 0);
    return {
      month,
      value,
      days: monthRows.length,
      expectedDays,
      calendarDays,
      partial: monthRows.length < expectedDays || expectedDays < calendarDays,
    };
  });
};

export const resolveGA4InsightsRevenueWindowState = (input: {
  noCompletedWindow: boolean;
  hasImportedRevenueSource: boolean;
  revenueMetricAvailable: boolean;
}) => {
  const awaitingFirstCompletedDay = input.noCompletedWindow && !input.hasImportedRevenueSource;
  return {
    awaitingFirstCompletedDay,
    missingRevenueDependency: !input.revenueMetricAvailable && !input.noCompletedWindow,
    sufficiencyReason: awaitingFirstCompletedDay
      ? "No completed GA4 reporting day is available for native revenue yet."
      : null,
    unavailableLabel: awaitingFirstCompletedDay ? "No completed GA4 day" : "Unavailable",
  };
};

export const resolveGA4InsightsCampaignToDateSufficiencyReason = (input: {
  noCompletedWindow: boolean;
  hasImportedRevenueSource: boolean;
  metric: unknown;
  name?: unknown;
}) => {
  if (!input.noCompletedWindow) return null;
  const identity = resolveGA4KpiMetricIdentity(input.metric, input.name);
  const dependencies = getGA4KpiMetricDependencies(input.metric, input.name);
  return identity === "cpa" || dependencies.requiresRevenue && !input.hasImportedRevenueSource
    ? "No completed GA4 reporting day is available for this campaign-to-date value yet."
    : null;
};
