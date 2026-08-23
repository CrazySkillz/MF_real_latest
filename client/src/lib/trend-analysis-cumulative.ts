const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const hasNonNegativeMetric = (value: any) => value !== null && typeof value !== "undefined" && value !== ""
  && Number.isFinite(Number(value)) && Number(value) >= 0;

export const resolveTrendComparisonDate = (dataThroughDate: string, comparisonDays: number) => {
  if (!ISO_DATE_PATTERN.test(dataThroughDate) || ![7, 14, 30, 90].includes(comparisonDays)) return "";
  const date = new Date(`${dataThroughDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dataThroughDate) return "";
  date.setUTCDate(date.getUTCDate() - comparisonDays);
  return date.toISOString().slice(0, 10);
};

export const filterTrendRowsToCalendarWindow = (rows: any[], dataThroughDate: string, days: number) => {
  if (!ISO_DATE_PATTERN.test(dataThroughDate) || !Number.isInteger(days) || days < 1) return [];
  const start = new Date(`${dataThroughDate}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const startDate = start.toISOString().slice(0, 10);
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const date = String(row?.date || "").slice(0, 10);
    return ISO_DATE_PATTERN.test(date) && date >= startDate && date <= dataThroughDate;
  });
};

export const deriveExactCumulativeGA4Traffic = (response: any, comparisonDate: string) => {
  const dataThroughDate = String(response?.dataThroughDate || "");
  const overviewStartDate = String(response?.overviewStartDate || "");
  const responseStartDate = String(response?.startDate || "");
  const responseEndDate = String(response?.endDate || "");
  if (!ISO_DATE_PATTERN.test(comparisonDate) || !ISO_DATE_PATTERN.test(dataThroughDate)
    || !ISO_DATE_PATTERN.test(overviewStartDate) || !ISO_DATE_PATTERN.test(responseStartDate)
    || !ISO_DATE_PATTERN.test(responseEndDate) || comparisonDate < overviewStartDate
    || comparisonDate >= dataThroughDate || responseEndDate < dataThroughDate
    || response?.providerRefreshWarning) return null;

  const firstRecentDate = new Date(`${comparisonDate}T00:00:00.000Z`);
  firstRecentDate.setUTCDate(firstRecentDate.getUTCDate() + 1);
  if (responseStartDate > firstRecentDate.toISOString().slice(0, 10)) return null;

  const currentRaw = response?.overviewTotals || {};
  if ([currentRaw.users, currentRaw.sessions, currentRaw.conversions, currentRaw.engagedSessions]
    .some((value) => !hasNonNegativeMetric(value))) return null;
  const current = {
    users: Number(currentRaw.users),
    sessions: Number(currentRaw.sessions),
    conversions: Number(currentRaw.conversions),
    engagedSessions: Number(currentRaw.engagedSessions),
  };
  const recent = { users: 0, sessions: 0, conversions: 0, engagedSessions: 0 };
  const seenDates = new Set<string>();
  for (const row of Array.isArray(response?.data) ? response.data : []) {
    const date = String(row?.date || "").slice(0, 10);
    if (!ISO_DATE_PATTERN.test(date) || date < responseStartDate || date > responseEndDate || seenDates.has(date)) return null;
    seenDates.add(date);
    if (date <= comparisonDate || date > dataThroughDate) continue;
    for (const key of Object.keys(recent) as Array<keyof typeof recent>) {
      if (!hasNonNegativeMetric(row?.[key])) return null;
      recent[key] += Number(row[key]);
    }
  }

  const previous = {
    users: current.users - recent.users,
    sessions: current.sessions - recent.sessions,
    conversions: current.conversions - recent.conversions,
    engagedSessions: current.engagedSessions - recent.engagedSessions,
  };
  if (Object.values(previous).some((value) => !Number.isFinite(value) || value < 0)) return null;
  return {
    current: {
      ...current,
      engagementRate: current.sessions > 0 ? (current.engagedSessions / current.sessions) * 100 : 0,
      cvr: current.sessions > 0 ? (current.conversions / current.sessions) * 100 : 0,
    },
    previous: {
      ...previous,
      engagementRate: previous.sessions > 0 ? (previous.engagedSessions / previous.sessions) * 100 : 0,
      cvr: previous.sessions > 0 ? (previous.conversions / previous.sessions) * 100 : 0,
    },
    comparisonDate,
  };
};

export const resolveCompatibleTrendFinancialDaily = (args: {
  snapshot: any;
  campaignId: string;
  comparisonDate: string;
  campaignCurrency: string;
  currentValueWindow: any;
}) => {
  const { snapshot, campaignId, comparisonDate, campaignCurrency, currentValueWindow } = args;
  const financialDaily = snapshot?.metrics?.financialDaily;
  return snapshot?.campaignId === campaignId
    && snapshot?.snapshotType === "financial_daily"
    && snapshot?.reportingDate === comparisonDate
    && financialDaily?.version === "financial_daily_snapshot_v1"
    && financialDaily?.currency === campaignCurrency
    && financialDaily?.currentValueWindow?.mode === "initial_import_to_latest_completed_day"
    && financialDaily?.currentValueWindow?.startDate === currentValueWindow?.startDate
    && financialDaily?.currentValueWindow?.endDate === comparisonDate
    && financialDaily?.currentValueWindow?.dataThroughDate === comparisonDate
    && financialDaily?.currentValueWindow?.reportingTimeZone === currentValueWindow?.reportingTimeZone
    ? financialDaily
    : null;
};

export const deriveTrendFinancialRatios = (inputs: {
  spend: number | null;
  revenue: number | null;
  conversions: number | null;
}) => ({
  roas: inputs.spend !== null && inputs.revenue !== null && inputs.spend > 0
    ? inputs.revenue / inputs.spend
    : null,
  roi: inputs.spend !== null && inputs.revenue !== null && inputs.spend > 0
    ? ((inputs.revenue - inputs.spend) / inputs.spend) * 100
    : null,
  cpa: inputs.spend !== null && inputs.conversions !== null && inputs.conversions > 0
    ? inputs.spend / inputs.conversions
    : null,
});
