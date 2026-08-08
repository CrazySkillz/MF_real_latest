import { storage } from "../storage";
import { ga4Service } from "../analytics";
import {
  computeKpiValue,
  getGA4KPIFinancialSourceWindow,
  getGA4KPIReportingWindow,
  getYesopMockBaselineTotals,
  isNoRevenueFilter,
  isYesopMockProperty,
  parseGA4CampaignFilter,
} from "../ga4-kpi-benchmark-jobs";
import {
  getGA4KpiMetricDependencies,
  isGA4FinancialKpiMetricIdentity,
  resolveGA4KpiMetricIdentity,
} from "../../shared/ga4-kpi-metric-identity";
import {
  isGA4FinancialTotalsCandidate,
  parseGA4FinancialNumber,
  selectGA4FinancialTotalsSource,
} from "../../shared/ga4-financial-source";
import { summarizeGA4TrafficRows } from "../../shared/ga4-traffic-window";
import { applyAlertDataSufficiency, blockAlertDecision } from "./alert-decision";
import { resolveCampaignCurrentValueForAlert } from "./campaign-current-values";

const isGA4Platform = (value: unknown) => {
  const platform = String(value || "").trim().toLowerCase();
  return platform === "google_analytics" || platform === "ga4";
};

const campaignStartDate = (campaign: any) => {
  const raw = campaign?.startDate || campaign?.createdAt || null;
  if (!raw) return "2000-01-01";
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return "2000-01-01";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

const toInputs = (totals: ReturnType<typeof summarizeGA4TrafficRows>) => ({
  users: Math.round(totals.users || 0),
  sessions: Math.round(totals.sessions || 0),
  pageviews: Math.round(totals.pageviews || 0),
  conversions: Math.round(totals.conversions || 0),
  ga4Revenue: Number((totals.revenue || 0).toFixed(2)),
  engagementRate: Number(totals.engagementRate || 0) || 0,
});

export async function resolveAlertCurrentValueForDecision<T extends {
  campaignId?: string | null;
  calculationConfig?: unknown;
  currentValue?: unknown;
  metric?: unknown;
  name?: unknown;
  platformType?: unknown;
}>(row: T, cache?: Map<string, Promise<any>>): Promise<T & Record<string, any>> {
  const resolved = await resolveCampaignCurrentValueForAlert(row, cache);
  if (!isGA4Platform((resolved as any)?.platformType)) return resolved as T & Record<string, any>;

  const campaignId = String((resolved as any)?.campaignId || "").trim();
  const metric = resolveGA4KpiMetricIdentity((resolved as any)?.metric, (resolved as any)?.name);
  if (!campaignId) return blockAlertDecision(resolved, "blocked");
  if (!metric) return resolved as T & Record<string, any>;

  try {
    const campaign = await storage.getCampaign(campaignId).catch(() => undefined as any);
    const connections = await storage.getGA4Connections(campaignId).catch(() => null as any);
    const primary = (Array.isArray(connections) ? connections : []).find((connection: any) => connection?.isPrimary)
      || (Array.isArray(connections) ? connections : [])[0];
    const propertyId = String(primary?.propertyId || "").trim();
    if (!campaign || !propertyId) return blockAlertDecision(resolved, "unavailable");

    const reportingWindow = getGA4KPIReportingWindow((campaign as any)?.reportingTimeZone);
    const startDate = reportingWindow.startDate;
    const endDate = reportingWindow.endDate;
    const financialStartDate = campaignStartDate(campaign);
    const rows = await storage.getGA4DailyMetrics(campaignId, propertyId, financialStartDate, endDate).catch(() => null as any);
    const sourceRows = Array.isArray(rows) ? rows : [];
    const trafficRows = sourceRows.filter((sourceRow: any) => {
      const date = String(sourceRow?.date || "");
      return date >= startDate && date <= endDate;
    });
    let trafficTotals = summarizeGA4TrafficRows(trafficRows);
    const financialTotals = summarizeGA4TrafficRows(sourceRows);
    let ga4Inputs = toInputs(trafficTotals);
    let hasGA4SourceInput = trafficRows.length > 0;
    let hasAuthoritativeEngagementInput = trafficRows.length > 0;
    const usesFinancialSource = isGA4FinancialKpiMetricIdentity(metric);
    const storedFinancialCandidate = sourceRows.length > 0 ? {
      ...toInputs(financialTotals),
      revenue: Number((financialTotals.revenue || 0).toFixed(2)),
    } : null;
    let providerFinancialCandidate: any = null;
    let breakdownFinancialCandidate: any = null;
    let mockFinancialCandidate: any = null;

    if (isYesopMockProperty(propertyId)) {
      const noRevenue = isNoRevenueFilter((campaign as any)?.ga4CampaignFilter);
      const trafficBaseline = getYesopMockBaselineTotals(campaignId, (campaign as any)?.ga4CampaignFilter, noRevenue, 30);
      const baselineEngagedSessions = Math.round(trafficBaseline.sessions * trafficBaseline.engagementRate);
      const sessions = trafficTotals.sessions + trafficBaseline.sessions;
      trafficTotals = {
        users: trafficTotals.users + trafficBaseline.users,
        sessions,
        pageviews: trafficTotals.pageviews + trafficBaseline.pageviews,
        conversions: trafficTotals.conversions + trafficBaseline.conversions,
        revenue: trafficTotals.revenue + trafficBaseline.revenue,
        engagedSessions: trafficTotals.engagedSessions + baselineEngagedSessions,
        engagementRate: sessions > 0 ? (trafficTotals.engagedSessions + baselineEngagedSessions) / sessions : 0,
      };
      ga4Inputs = toInputs(trafficTotals);
      const financialBaseline = getYesopMockBaselineTotals(campaignId, (campaign as any)?.ga4CampaignFilter, noRevenue);
      mockFinancialCandidate = {
        users: financialTotals.users + financialBaseline.users,
        sessions: financialTotals.sessions + financialBaseline.sessions,
        pageviews: financialTotals.pageviews + financialBaseline.pageviews,
        conversions: financialTotals.conversions + financialBaseline.conversions,
        revenue: financialTotals.revenue + financialBaseline.revenue,
      };
      hasGA4SourceInput = true;
      hasAuthoritativeEngagementInput = true;
    } else {
      const connection = await storage.getGA4Connection(campaignId, propertyId).catch(() => null as any) || primary;
      if (connection?.method === "access_token" && connection?.accessToken) {
        const assignLiveTotals = (live: any) => {
          ga4Inputs = {
            users: Math.round(Number(live?.totals?.users || 0) || 0),
            sessions: Math.round(Number(live?.totals?.sessions || 0) || 0),
            pageviews: Math.round(Number(live?.totals?.pageviews || 0) || 0),
            conversions: Math.round(Number(live?.totals?.conversions || 0) || 0),
            ga4Revenue: Number((Number(live?.totals?.revenue || 0) || 0).toFixed(2)),
            // KPI Engagement Rate is defined by the exact completed-day rows. A
            // dimensionless GA4 aggregate can differ and must not overwrite it.
            engagementRate: ga4Inputs.engagementRate,
          };
          hasGA4SourceInput = true;
        };
        const attempt = (token: string, fromDate: string) =>
          ga4Service.getTotalsWithRevenue(
            String(connection.propertyId || propertyId),
            token,
            fromDate,
            endDate,
            parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter),
          );
        const assignProviderInputs = async (token: string) => {
          assignLiveTotals(await attempt(token, startDate));
          if (usesFinancialSource) {
            const candidate = (await attempt(token, financialStartDate))?.totals;
            providerFinancialCandidate = isGA4FinancialTotalsCandidate(candidate) ? candidate : null;
          }
        };
        try {
          await assignProviderInputs(String(connection.accessToken));
        } catch (error: any) {
          const message = String(error?.message || "");
          const isAuth = message.includes("401")
            || message.includes("403")
            || message.toLowerCase().includes("unauthenticated")
            || message.toLowerCase().includes("invalid authentication credentials")
            || message.toLowerCase().includes("request had invalid authentication credentials")
            || message.toLowerCase().includes("invalid_grant");
          if (isAuth && connection?.refreshToken && connection?.id) {
            const refresh = await ga4Service.refreshAccessToken(
              String(connection.refreshToken),
              connection.clientId || undefined,
              connection.clientSecret || undefined,
            );
            await storage.updateGA4ConnectionTokens(connection.id, {
              accessToken: refresh.access_token,
              refreshToken: String(connection.refreshToken),
              expiresAt: new Date(Date.now() + refresh.expires_in * 1000),
            });
            await assignProviderInputs(String(refresh.access_token));
          }
        }
      }

      const earlierCandidate = selectGA4FinancialTotalsSource(
        [providerFinancialCandidate, storedFinancialCandidate],
        {} as any,
      );
      if (usesFinancialSource && !isGA4FinancialTotalsCandidate(earlierCandidate)) {
        try {
          const lookbackDays = [30, 60, 90].includes(Number((primary as any)?.lookbackDays))
            ? Number((primary as any).lookbackDays)
            : 90;
          const breakdown = await ga4Service.getAcquisitionBreakdown(
            campaignId,
            storage,
            `${lookbackDays}daysAgo`,
            propertyId,
            2000,
            parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter),
          );
          const candidate = (breakdown as any)?.totals;
          breakdownFinancialCandidate = isGA4FinancialTotalsCandidate(candidate) ? candidate : null;
        } catch {
          // A required financial source remains unavailable when no earlier candidate exists.
        }
      }
    }

    const selectedFinancialCandidate = selectGA4FinancialTotalsSource(
      [mockFinancialCandidate, providerFinancialCandidate, storedFinancialCandidate, breakdownFinancialCandidate],
      {} as any,
    );
    const financialCandidateAvailable = isGA4FinancialTotalsCandidate(selectedFinancialCandidate);
    const financialInputs = financialCandidateAvailable ? {
      users: Math.round(parseGA4FinancialNumber((selectedFinancialCandidate as any)?.users) ?? ga4Inputs.users),
      sessions: Math.round(parseGA4FinancialNumber((selectedFinancialCandidate as any)?.sessions ?? (selectedFinancialCandidate as any)?.sessionsRaw) ?? ga4Inputs.sessions),
      pageviews: Math.round(parseGA4FinancialNumber((selectedFinancialCandidate as any)?.pageviews) ?? ga4Inputs.pageviews),
      conversions: Math.round(parseGA4FinancialNumber((selectedFinancialCandidate as any)?.conversions) ?? 0),
      ga4Revenue: Number((parseGA4FinancialNumber((selectedFinancialCandidate as any)?.revenue) ?? 0).toFixed(2)),
      engagementRate: parseGA4FinancialNumber((selectedFinancialCandidate as any)?.engagementRate) ?? ga4Inputs.engagementRate,
    } : null;

    const financialWindow = getGA4KPIFinancialSourceWindow((campaign as any)?.reportingTimeZone);
    const [importedRevenueResult, spendResult] = await Promise.allSettled([
      storage.getRevenueTotalForRange(campaignId, financialWindow.startDate, financialWindow.endDate, "ga4"),
      storage.getSpendTotalForRange(campaignId, financialWindow.startDate, financialWindow.endDate, "ga4"),
    ]);
    const importedRevenueValue = importedRevenueResult.status === "fulfilled"
      ? parseGA4FinancialNumber((importedRevenueResult.value as any)?.totalRevenue)
      : null;
    const spendValue = spendResult.status === "fulfilled"
      ? parseGA4FinancialNumber((spendResult.value as any)?.totalSpend)
      : null;

    if (usesFinancialSource) {
      const dependencies = getGA4KpiMetricDependencies(metric);
      const sourceVerified = !!financialInputs
        && (!dependencies.requiresRevenue || importedRevenueValue !== null)
        && (!dependencies.requiresSpend || spendValue !== null);
      if (!sourceVerified) return blockAlertDecision(resolved, "unavailable");
    } else if (!hasGA4SourceInput || (metric === "engagement_rate" && !hasAuthoritativeEngagementInput)) {
      return blockAlertDecision(resolved, "unavailable");
    }

    const inputs = usesFinancialSource ? financialInputs! : ga4Inputs;
    const currentValue = computeKpiValue(metric, {
      users: inputs.users,
      sessions: inputs.sessions,
      pageviews: inputs.pageviews,
      conversions: inputs.conversions,
      ga4Revenue: inputs.ga4Revenue,
      importedRevenue: importedRevenueValue ?? 0,
      spend: spendValue ?? 0,
      engagementRate: inputs.engagementRate,
    });
    return applyAlertDataSufficiency(
      { ...resolved, currentValue: String(currentValue) },
      {
        metric,
        name: String((resolved as any)?.name || ""),
        sessions: inputs.sessions,
        conversions: inputs.conversions,
        spend: spendValue,
      },
    );
  } catch {
    return blockAlertDecision(resolved, "unavailable");
  }
}
