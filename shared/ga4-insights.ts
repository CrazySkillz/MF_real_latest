export type GA4InsightsDailyRow = {
  date: string;
  sessions?: number;
  users?: number;
  conversions?: number;
  revenue?: number;
  pageviews?: number;
  engagementRate?: number;
  engagedSessions?: number;
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

export const addGA4InsightsDateDays = (value: string, days: number): string | null => {
  if (!DATE_ONLY.test(String(value || ""))) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
    byDate.set(date, {
      ...row,
      date,
      sessions: Number(row.sessions || 0) || 0,
      users: Number(row.users || 0) || 0,
      conversions: Number(row.conversions || 0) || 0,
      revenue: Number(row.revenue || 0) || 0,
      pageviews: Number(row.pageviews || 0) || 0,
      engagementRate: Number(row.engagementRate || 0) || 0,
      engagedSessions: Number(row.engagedSessions || 0) || 0,
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
      acc.engagedSessions += Number.isFinite(explicitEngaged) && explicitEngaged > 0
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
  const deltaPct = (current: number, previous: number) =>
    previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
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
      sessions3: deltaPct(last3.sessions, prior3.sessions),
      conversions3: deltaPct(last3.conversions, prior3.conversions),
      revenue3: deltaPct(last3.revenue, prior3.revenue),
      cr3: deltaPct(last3.cr, prior3.cr),
      pvps3: deltaPct(last3.pvps, prior3.pvps),
      sessions7: deltaPct(last7.sessions, prior7.sessions),
      conversions7: deltaPct(last7.conversions, prior7.conversions),
      revenue7: deltaPct(last7.revenue, prior7.revenue),
      cr7: deltaPct(last7.cr, prior7.cr),
      pvps7: deltaPct(last7.pvps, prior7.pvps),
      users7: deltaPct(last7.users, prior7.users),
      engRate7: deltaPct(last7.engagementRate, prior7.engagementRate),
      sessions30: deltaPct(last30.sessions, prior30.sessions),
      conversions30: deltaPct(last30.conversions, prior30.conversions),
      revenue30: deltaPct(last30.revenue, prior30.revenue),
      cr30: deltaPct(last30.cr, prior30.cr),
      pvps30: deltaPct(last30.pvps, prior30.pvps),
      users30: deltaPct(last30.users, prior30.users),
      engRate30: deltaPct(last30.engagementRate, prior30.engagementRate),
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
      return sum + (Number.isFinite(explicit) && explicit > 0
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
