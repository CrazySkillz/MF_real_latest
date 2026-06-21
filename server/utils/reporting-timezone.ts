export const DEFAULT_REPORTING_TIME_ZONE = "UTC";

export function normalizeReportingTimeZone(value: any): string {
  const tz = String(value || "").trim();
  if (!tz) return DEFAULT_REPORTING_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date(0));
    return tz;
  } catch {
    return DEFAULT_REPORTING_TIME_ZONE;
  }
}

function formatDateOnlyUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function addDaysToDateOnly(value: string, days: number): string {
  const d = new Date(`${value}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateOnlyUTC(d);
}

function currentDateOnlyInTimeZone(now: Date, reportingTimeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: reportingTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function getLatestCompleteReportingDate(reportingTimeZone: any, now = new Date()): string {
  const tz = normalizeReportingTimeZone(reportingTimeZone);
  return addDaysToDateOnly(currentDateOnlyInTimeZone(now, tz), -1);
}

export function getReportingDateWindow(days: number, reportingTimeZone: any, now = new Date()) {
  const boundedDays = Math.max(1, Math.floor(Number(days) || 1));
  const normalizedTimeZone = normalizeReportingTimeZone(reportingTimeZone);
  const dataThroughDate = getLatestCompleteReportingDate(normalizedTimeZone, now);
  return {
    reportingTimeZone: normalizedTimeZone,
    dataThroughDate,
    endDate: dataThroughDate,
    startDate: addDaysToDateOnly(dataThroughDate, -(boundedDays - 1)),
  };
}
