import { financialDailySnapshotInputSchema, type FinancialDailySnapshotInput } from "../../shared/schema";

type FinancialInputKey = keyof FinancialDailySnapshotInput["inputs"];

export type FinancialDailyRefreshEvidence = {
  campaignId: string;
  reportingDate: string;
  status: "success" | "failed" | "skipped" | "running";
  completedAt: string | null;
  failures: string[];
};

export type FinancialDailySnapshotReadiness = {
  ready: boolean;
  reasons: string[];
};

const validTimestamp = (value: string | null) => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const validCalendarDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value;
};

const dateInTimeZone = (value: string, reportingTimeZone: string): string | null => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: reportingTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(value));
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  } catch {
    return null;
  }
};

export function assessFinancialDailySnapshotReadiness(input: {
  campaignId: string;
  reportingDate: string;
  currency: string;
  requiredInputs: FinancialInputKey[];
  financialSourcesRefresh: FinancialDailyRefreshEvidence;
  ga4DailyRefresh: FinancialDailyRefreshEvidence;
  snapshot: unknown;
}): FinancialDailySnapshotReadiness {
  const reasons: string[] = [];
  const campaignId = String(input.campaignId || "").trim();
  const reportingDate = String(input.reportingDate || "").trim();
  const currency = String(input.currency || "").trim().toUpperCase();
  const parsedSnapshot = financialDailySnapshotInputSchema.safeParse(input.snapshot);

  if (!campaignId) reasons.push("invalid_campaign_id");
  if (!validCalendarDate(reportingDate)) reasons.push("invalid_reporting_date");
  if (!/^[A-Z]{3}$/.test(currency)) reasons.push("invalid_currency");
  if (!parsedSnapshot.success) reasons.push("invalid_snapshot_contract");
  const snapshot = parsedSnapshot.success ? parsedSnapshot.data : null;
  const reportingTimeZone = snapshot?.currentValueWindow.reportingTimeZone || "";
  if (snapshot && dateInTimeZone("2000-01-02T00:00:00.000Z", reportingTimeZone) === null) {
    reasons.push("invalid_snapshot_reporting_time_zone");
  }
  if (snapshot && snapshot.campaignId !== campaignId) reasons.push("snapshot_campaign_mismatch");
  if (snapshot && snapshot.reportingDate !== reportingDate) reasons.push("snapshot_reporting_date_mismatch");
  if (snapshot && snapshot.currency !== currency) reasons.push("snapshot_currency_mismatch");

  const checkRefresh = (name: "financial_sources" | "ga4_daily", evidence: FinancialDailyRefreshEvidence) => {
    if (String(evidence?.campaignId || "").trim() !== campaignId) reasons.push(`${name}_campaign_mismatch`);
    if (String(evidence?.reportingDate || "").trim() !== reportingDate) reasons.push(`${name}_reporting_date_mismatch`);
    if (evidence?.status !== "success") reasons.push(`${name}_not_successful`);
    if (!validTimestamp(evidence?.completedAt || null)) reasons.push(`${name}_completion_missing`);
    else if (snapshot && dateInTimeZone(evidence.completedAt!, reportingTimeZone)! <= reportingDate) {
      reasons.push(`${name}_completed_before_reporting_day_closed`);
    }
    if (!Array.isArray(evidence?.failures) || evidence.failures.length > 0) reasons.push(`${name}_has_failures`);
  };

  checkRefresh("financial_sources", input.financialSourcesRefresh);
  checkRefresh("ga4_daily", input.ga4DailyRefresh);

  const allowedInputs = new Set<FinancialInputKey>(["spend", "revenue", "conversions"]);
  const requiredInputs = Array.from(new Set(Array.isArray(input.requiredInputs) ? input.requiredInputs : []));
  if (requiredInputs.some((metricName) => !allowedInputs.has(metricName))) reasons.push("invalid_required_input");
  if (snapshot) {
    for (const metricName of requiredInputs.filter((name) => allowedInputs.has(name))) {
      if (!snapshot.inputs[metricName].available) reasons.push(`${metricName}_unavailable`);
    }
  }

  return { ready: reasons.length === 0, reasons: Array.from(new Set(reasons)) };
}
