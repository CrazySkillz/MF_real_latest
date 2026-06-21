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

function getZonedParts(date: Date, reportingTimeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: reportingTimeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour),
    minute: Number(byType.minute),
    second: Number(byType.second),
  };
}

function getTimeZoneOffsetMs(date: Date, reportingTimeZone: string) {
  const p = getZonedParts(date, reportingTimeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

function zonedDateTimeToUTC(reportingTimeZone: string, year: number, month: number, day: number, hour: number, minute: number) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const first = new Date(utcGuess.getTime() - getTimeZoneOffsetMs(utcGuess, reportingTimeZone));
  return new Date(utcGuess.getTime() - getTimeZoneOffsetMs(first, reportingTimeZone));
}

function addCalendarDaysFromParts(year: number, month: number, day: number, days: number) {
  const d = new Date(Date.UTC(year, month - 1, day + days, 0, 0, 0, 0));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
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

export function getNextDailyRunAt(now: Date, reportingTimeZone: any, hour: number, minute: number): Date {
  const tz = normalizeReportingTimeZone(reportingTimeZone);
  const nowParts = getZonedParts(now, tz);
  let target = zonedDateTimeToUTC(tz, nowParts.year, nowParts.month, nowParts.day, hour, minute);
  if (target.getTime() <= now.getTime()) {
    const nextDay = addCalendarDaysFromParts(nowParts.year, nowParts.month, nowParts.day, 1);
    target = zonedDateTimeToUTC(tz, nextDay.year, nextDay.month, nextDay.day, hour, minute);
  }
  return target;
}
