// Shared read-only GA4 comparison used by onboarding and the independent monitor.
import { GoogleAnalytics4Service, type GA4DailyTrafficCapture } from './analytics';
import { conversionCreditsMatch } from '../shared/metric-math';
import { createHash } from 'node:crypto';
import type { IStorage, GA4RefreshWriteInput } from './storage';
import { normalizeReportingTimeZone } from './utils/reporting-timezone';
export type NumberCheck = { section: string; code: string; status: "passed" | "difference" | "unverified"; subject?: string };
export const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || typeof value === "boolean" || (typeof value === "string" && !value.trim())) return null;
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && Math.abs(parsed) <= Number.MAX_SAFE_INTEGER ? parsed : null;
};
export const dateIsValid = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value + "T00:00:00Z")) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
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

export function compareProviderRows(section: string, expected: any[], actual: any[], keys: string[], metrics: string[], subject?: string): NumberCheck[] {
  const key = (row: any) => JSON.stringify(keys.map(k => row[k]));
  const expectedMap = new Map(expected.map(row => [key(row), row])), actualMap = new Map(actual.map(row => [key(row), row]));
  if (expectedMap.size !== expected.length || actualMap.size !== actual.length) return [{ section, code: "DUPLICATE_COMPARISON_KEY", subject, status: "unverified" }];
  const checks: NumberCheck[] = [];
  for (const identity of Array.from(new Set([...Array.from(expectedMap.keys()), ...Array.from(actualMap.keys())]))) {
    const left = expectedMap.get(identity), right = actualMap.get(identity);
    if (!left || !right) { checks.push({ section, code: "SOURCE_ROW_DIFFERENCE", subject, status: "difference" }); continue; }
    for (const metric of metrics) checks.push(compareNumber(section, `SOURCE_${metric}`, left[metric], right[metric], {
      subject, decimals: metric === "revenue" || metric === "spend" || metric === "value" ? 2 : metric === "engagementRate" ? 4 : undefined,
      conversions: metric === "conversions", operations: expected.length,
    }));
  }
  if (!checks.length) checks.push({ section, code: "SOURCE_EMPTY_RESULT_MATCH", subject, status: "passed" });
  return checks;
}

export type GA4InitialVerificationReceipt = {
  connectionId: string; propertyId: string; inputHash: string; checkedAt: string;
  startDate: string; endDate: string; comparedValues: number; unavailable: string[];
};

export function ga4VerificationInputHash(overview: any, daily: any[]): string {
  return createHash('sha256').update(JSON.stringify([
    overview?.windowStart, overview?.windowEnd, overview?.campaignBreakdown, overview?.landingPages, overview?.conversionEvents,
    [...daily].sort((a, b) => a.date.localeCompare(b.date)).map(row =>
      ['campaignId', 'propertyId', 'date', 'sessions', 'users', 'pageviews', 'conversions', 'revenue', 'engagedSessions', 'engagementRate', 'isSimulated'].map(key => row[key])),
  ])).digest('hex');
}

export async function verifyGA4InitialImport(
  storage: Pick<IStorage, 'getCampaign' | 'getGA4Connections' | 'getGA4DailyMetrics' | 'getGA4OverviewSnapshot' | 'recordGA4InitialImportVerification'>,
  scope: NonNullable<GA4RefreshWriteInput['refreshScope']>, assertOwnership: () => Promise<void>, signal?: AbortSignal,
): Promise<void> {
  await assertOwnership();
  const campaign = await storage.getCampaign(scope.campaignId);
  if (!campaign || campaign.ownerId !== scope.ownerId || campaign.status !== 'draft'
    || !campaign.clientId || !/^[A-Z]{3}$/.test(campaign.currency || '')
    || normalizeReportingTimeZone(campaign.reportingTimeZone) !== campaign.reportingTimeZone) throw new Error('GA4_REFRESH_TARGET_SCOPE_CHANGED');
  const raw = String(campaign.ga4CampaignFilter || '').trim();
  const parsed = raw.startsWith('[') ? JSON.parse(raw) : [raw];
  if (!Array.isArray(parsed) || !parsed.length || parsed.some(name => typeof name !== 'string' || !name.trim())
    || new Set(parsed).size !== parsed.length) throw new Error('GA4_REFRESH_TARGET_SCOPE_CHANGED');
  const filter = parsed.map(name => name.trim());
  const connections = (await storage.getGA4Connections(scope.campaignId, { migrateLegacyTokens: false })).filter(c => c.isActive);
  if (!connections.length || new Set(connections.map(c => c.propertyId)).size !== connections.length) throw new Error('GA4_REFRESH_TARGET_SCOPE_CHANGED');
  const receipts: GA4InitialVerificationReceipt[] = [];
  for (const connection of connections) {
    await assertOwnership();
    if (connection.campaignId !== scope.campaignId || !/^\d+$/.test(connection.propertyId) || !connection.accessToken) throw new Error('GA4_INITIAL_VERIFICATION_UNVERIFIED');
    const publication = await storage.getGA4OverviewSnapshot(scope.campaignId, connection.propertyId);
    if (!publication || publication.windowStart !== connection.importStartDate || publication.windowEnd !== scope.reportingDate
      || !dateIsValid(publication.windowStart) || !dateIsValid(publication.windowEnd) || publication.windowStart > publication.windowEnd
      || (publication.campaignBreakdown as any)?.meta?.propertyId !== connection.propertyId
      || (publication.campaignBreakdown as any)?.meta?.currencyCode !== campaign.currency) throw new Error('GA4_INITIAL_VERIFICATION_UNVERIFIED');
    const daily = await storage.getGA4DailyMetrics(scope.campaignId, connection.propertyId, publication.windowStart, publication.windowEnd);
    if (daily.some(row => row.campaignId !== scope.campaignId || row.propertyId !== connection.propertyId || row.isSimulated)) throw new Error('GA4_INITIAL_VERIFICATION_UNVERIFIED');
    const inputHash = ga4VerificationInputHash(publication, daily);
    let checks: NumberCheck[];
    try {
      checks = await checkGA4SourceNumbers({ campaignId: scope.campaignId, connection, publication, filter,
        startDate: publication.windowStart, endDate: publication.windowEnd, currency: campaign.currency! }, daily, signal, 10000);
    } catch {
      signal?.throwIfAborted();
      throw new Error('GA4_INITIAL_VERIFICATION_UNVERIFIED');
    }
    if (!checks.length || checks.some(check => check.status === 'unverified')) throw new Error('GA4_INITIAL_VERIFICATION_UNVERIFIED');
    if (checks.some(check => check.status === 'difference')) throw new Error('GA4_INITIAL_VERIFICATION_DIFFERENCE');
    // Unavailable provider fields are not certified numeric values, even when the saved null correctly matches.
    const unavailable = checks.filter(check => check.code.endsWith('_UNAVAILABLE')).map(check => `${check.section}:${check.code}`);
    receipts.push({ connectionId: connection.id, propertyId: connection.propertyId, inputHash, checkedAt: new Date().toISOString(),
      startDate: publication.windowStart, endDate: publication.windowEnd, comparedValues: checks.length - unavailable.length, unavailable });
  }
  await assertOwnership();
  await storage.recordGA4InitialImportVerification(scope, receipts);
}

export async function checkGA4SourceNumbers(scope: { campaignId: string; connection: any; publication: any; filter: string[]; startDate: string; endDate: string; currency: string }, savedDaily: any[], signal?: AbortSignal, breakdownLimit = 2000): Promise<NumberCheck[]> {
  const { campaignId, connection } = scope;
  const facade = { getGA4Connection: async (id: string, property: string) => {
    if (id !== campaignId || property !== connection.propertyId) throw new Error('PROVIDER_SCOPE_CHANGED');
    return { ...connection, refreshToken: null, serviceAccountKey: null };
  } };
  const service = new GoogleAnalytics4Service(signal ? AbortSignal.any([signal, AbortSignal.timeout(240_000)]) : AbortSignal.timeout(240_000));
  const capture: GA4DailyTrafficCapture = { campaignId };
  const daily = await service.getTimeSeriesWithToken(connection.propertyId, connection.accessToken, scope.startDate,
    scope.filter, scope.endDate, scope.currency, capture);
  const byDate = new Map(daily.map(row => [row.date, row]));
  if (byDate.size !== daily.length || daily.some(row => !dateIsValid(row.date) || row.date < scope.startDate || row.date > scope.endDate)) throw new Error("PROVIDER_DATE_SCOPE_UNVERIFIED");
  // Complete GA4 reports omit zero-activity dates. The API helper rejects partial/thresholded/sampled reports first.
  const expectedDaily: any[] = [];
  for (let date = scope.startDate; date <= scope.endDate; date = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10)) {
    expectedDaily.push(byDate.get(date) || { date, sessions: 0, users: 0, pageviews: 0, conversions: 0, revenue: 0, engagedSessions: 0, engagementRate: 0 });
  }
  const checks = compareProviderRows("GA4 daily inputs / Insights / Trend Analysis", expectedDaily, savedDaily, ["date"],
    ["sessions", "users", "pageviews", "conversions", "revenue", "engagedSessions", "engagementRate"]);
  const provider = await service.getAcquisitionBreakdown(campaignId, facade, scope.startDate, connection.propertyId,
    breakdownLimit, scope.filter, scope.endDate, true, false, scope.currency, true, capture);
  const saved = scope.publication.campaignBreakdown;
  if (provider.meta.currencyCode !== scope.currency || provider.meta.revenueMetric !== saved.meta.revenueMetric
    || JSON.stringify(provider.meta.dimensions) !== JSON.stringify(saved.meta.dimensions)) {
    checks.push({ section: "Overview / Campaign Comparison", code: "PROVIDER_METRIC_DEFINITION_CHANGED", status: "unverified" });
  } else {
    for (const metric of ["sessions", "sessionsRaw", "users", "conversions", "revenue", "engagedSessions", "engagementRate"]) {
      checks.push(compareNumber("Overview / Campaign Comparison", `SOURCE_TOTAL_${metric}`, (provider.totals as any)[metric], saved.totals?.[metric],
        { decimals: metric === "revenue" ? 2 : metric === "engagementRate" ? 4 : undefined, conversions: metric === "conversions" }));
    }
    checks.push(...compareProviderRows("Campaign Comparison", provider.rows, saved.rows, ["campaign", "source", "medium", "channel", "device", "country", "date"],
      ["sessions", "users", "conversions", "revenue", "engagedSessions", "sessionKeyEventRate"]));
  }
  for (const part of ["landingPages", "conversionEvents"] as const) {
    try {
      const result = part === "landingPages" ? await service.getLandingPagesReport(campaignId, facade, scope.startDate, connection.propertyId, 50, scope.filter, scope.endDate, true)
        : await service.getConversionEventsReport(campaignId, facade, scope.startDate, connection.propertyId, 50, scope.filter, scope.endDate, true,
          Object.fromEntries(expectedDaily.map(row => [row.date, row.conversions])));
      const stored = scope.publication[part];
      // The current UI and Overview PDFs display counts/rates from these tables,
      // not their internal revenue field (which has no saved currency metadata).
      if (!stored || stored.propertyId !== result.propertyId || stored.revenueMetric !== result.revenueMetric) throw new Error("SOURCE_DETAIL_SCOPE_UNVERIFIED");
      if (part === "landingPages" && ["historyLimited", "requestedStartDate", "startDate", "endDate"]
        .some(key => ((result as any).meta?.[key] ?? null) !== (stored.meta?.[key] ?? null))) {
        throw new Error("SOURCE_DETAIL_DATE_SCOPE_UNVERIFIED");
      }
      checks.push(...compareProviderRows(`Overview / ${part}`, result.rows, stored.rows,
        part === "landingPages" ? ["landingPage", "source", "medium"] : ["eventName"],
        part === "landingPages" ? ["sessions", "users", "conversions"] : ["conversions"]));
      if (part === "conversionEvents") {
        for (const metric of ["eventCount", "users"]) {
          if (result.rows.every((row: any) => row[metric] == null) && stored.rows.every((row: any) => row[metric] == null)) {
            checks.push({ section: "Overview / conversionEvents", code: `${metric}_UNAVAILABLE`, status: "passed" });
          } else checks.push(...compareProviderRows("Overview / conversionEvents", result.rows, stored.rows, ["eventName"], [metric]));
        }
      }
    } catch { checks.push({ section: `Overview / ${part}`, code: "SOURCE_DETAIL_UNVERIFIED", status: "unverified" }); }
  }
  return checks;
}
