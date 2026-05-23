import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Calculator, PieChart, BarChart3, AlertTriangle, Target, Zap, Activity, Eye, Info } from "lucide-react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { formatPct } from "@shared/metric-math";

interface Campaign {
  id: string;
  name: string;
  budget?: string;
  status: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
}

type FinancialSourceBreakdown = {
  id: string;
  label: string;
  revenue: number;
  spend: number;
  conversions: number;
  roas: number | null;
  roi: number | null;
};

type FinancialChildSourceBreakdown = {
  id: string;
  label: string;
  sourceType?: string;
  revenue: number;
};

type FinancialSpendInputBreakdown = {
  id: string;
  label: string;
  sourceType?: string;
  spend: number;
};

type InsightTone = "success" | "warning" | "info";

const FINANCIAL_ANALYSIS_REFRESH_MS = 30000;

export default function FinancialAnalysis() {
  const [, params] = useRoute("/campaigns/:id/financial-analysis");
  const campaignId = params?.id;
  const queryClient = useQueryClient();
  const [comparisonPeriod, setComparisonPeriod] = useState<string>("7d");
  const [demoMode] = useState(false);
  const [pacingBudgetInput, setPacingBudgetInput] = useState("");
  const [pacingStartDateInput, setPacingStartDateInput] = useState("");
  const [pacingEndDateInput, setPacingEndDateInput] = useState("");
  const [pacingInputError, setPacingInputError] = useState<string | null>(null);
  const [isEditingPacingInputs, setIsEditingPacingInputs] = useState(false);

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
    refetchInterval: FINANCIAL_ANALYSIS_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const formatDateInputValue = (value?: string | Date | null) => {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  };

  const formatBudgetInputValue = (value?: string | number | null) => {
    const raw = String(value ?? "").replace(/,/g, "").trim().replace(/[^\d.]/g, "");
    if (!raw) return "";
    const [integerPart, ...decimalParts] = raw.split(".");
    const decimalPart = decimalParts.join("");
    const integerValue = Number(integerPart || "0");
    if (!Number.isFinite(integerValue)) return "";
    const formattedInteger = new Intl.NumberFormat("en-US").format(integerValue);
    return decimalParts.length > 0 ? `${formattedInteger}.${decimalPart.slice(0, 2)}` : formattedInteger;
  };

  useEffect(() => {
    if (!campaign) return;
    setPacingBudgetInput(formatBudgetInputValue(campaign.budget));
    setPacingStartDateInput(formatDateInputValue(campaign.startDate));
    setPacingEndDateInput(formatDateInputValue(campaign.endDate));
    setPacingInputError(null);
  }, [campaign?.budget, campaign?.startDate, campaign?.endDate]);

  const updatePacingInputsMutation = useMutation({
    mutationFn: async (data: { budget: string; startDate: string; endDate: string }) => {
      const response = await apiRequest("PATCH", `/api/campaigns/${campaignId}`, {
        budget: data.budget ? data.budget.replace(/,/g, "") : null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
      });
      return response.json();
    },
    onSuccess: (updatedCampaign) => {
      setPacingInputError(null);
      setIsEditingPacingInputs(false);
      queryClient.setQueryData(["/api/campaigns", campaignId], updatedCampaign);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/outcome-totals`] });
    },
    onError: (error: any) => {
      setPacingInputError(error?.message || "Unable to save pacing inputs.");
    },
  });

  const comparisonType = comparisonPeriod === "1d" ? "yesterday" : comparisonPeriod === "7d" ? "last_week" : "last_month";

  // Get compatible historical snapshots for comparison
  const { data: comparisonData } = useQuery<{ current: any | null; previous: any | null }>({
    queryKey: [`/api/campaigns/${campaignId}/snapshots/comparison?type=${comparisonType}`],
    enabled: !!campaignId,
    placeholderData: (previousData: any) => previousData,
    refetchInterval: FINANCIAL_ANALYSIS_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // Get LinkedIn metrics
  const { data: linkedInData, isLoading: linkedInLoading } = useQuery({
    queryKey: ["/api/linkedin/metrics", campaignId],
    enabled: !!campaignId,
  });

  // Get Custom Integration data
  const { data: customIntegrationData, isLoading: ciLoading } = useQuery({
    queryKey: ["/api/custom-integration", campaignId],
    enabled: !!campaignId,
  });

  // Get Google Sheets financial data
  const { data: sheetsData } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "google-sheets-data"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/google-sheets-data`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  // Get GA4 data for additional metrics
  const { data: ga4Data, isLoading: ga4Loading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-metrics`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  // Get Meta analytics data
  const { data: metaData, isLoading: metaLoading } = useQuery({
    queryKey: ["/api/meta", campaignId, "analytics"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/meta/${campaignId}/analytics`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  const { data: outcomeTotals, isLoading: outcomeTotalsLoading } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/outcome-totals`, "90days", demoMode ? "demo" : "live"],
    enabled: !!campaignId,
    queryFn: async () => {
      const url = `/api/campaigns/${campaignId}/outcome-totals?dateRange=90days${demoMode ? "&demo=1" : ""}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load aggregate financial totals");
      return response.json();
    },
    placeholderData: (previousData: any) => previousData,
    refetchInterval: FINANCIAL_ANALYSIS_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // Demo mode mock data
  const demoLinkedIn = demoMode ? {
    spend: 4250, impressions: 12500, engagements: 1240, clicks: 890,
    conversions: 45, leads: 18, conversionValue: 182,
    revenue: 8190, roas: 1.93, roi: 92.7,
  } : null;
  const demoCI = demoMode ? {
    metrics: { spend: '1800', pageviews: 15200, sessions: 3400, clicks: 420,
      conversions: 28, leads: 12, impressions: 8500, engagements: 580 }
  } : null;
  const demoSheets = demoMode ? {
    summary: { totalSpend: 950, totalImpressions: 6200, totalEngagements: 310,
      totalClicks: 280, totalConversions: 14 }
  } : null;
  const demoGA4 = demoMode ? { averageOrderValue: 145 } : null;
  const demoMeta = demoMode ? {
    summary: { totalImpressions: 28000, totalClicks: 1450, totalSpend: 3100, totalConversions: 62 }
  } : null;
  const demoSnapshot = demoMode ? {
    totalSpend: 5800, totalConversions: 68,
  } : null;

  const effectiveLinkedIn: any = demoLinkedIn || linkedInData;
  const effectiveCI: any = demoCI || customIntegrationData;
  const effectiveSheets: any = demoSheets || sheetsData;
  const effectiveGA4: any = demoGA4 || ga4Data;
  const effectiveMeta: any = demoMeta || metaData;
  const effectiveSnapshot: any = demoMode ? demoSnapshot : comparisonData?.previous;

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatPercentage = (value: number) => {
    return `${formatPct(value)}`;
  };

  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="space-y-6">
              <div className="h-8 bg-muted rounded animate-pulse"></div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-muted rounded animate-pulse"></div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-foreground mb-4">Campaign not found</h2>
              <Link href="/campaigns">
                <Button>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Campaigns
                </Button>
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Data loading state — prevent flash of stale/zero metrics on refresh
  const dataLoading = !demoMode && (linkedInLoading || ciLoading || metaLoading || ga4Loading || outcomeTotalsLoading);
  const performanceSummary = outcomeTotals?.performanceSummary;
  const performanceSources = Array.isArray(performanceSummary?.sources) ? performanceSummary.sources : [];
  const aggregateMetric = (metricName: string) => performanceSummary?.totals?.[metricName];
  const aggregateMetricAvailable = (metricName: string) => aggregateMetric(metricName)?.available === true;
  const aggregateMetricValue = (metricName: string): number | null => {
    const value = aggregateMetric(metricName)?.value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const aggregateMetricSources = (metricName: string): string[] => {
    const sources = aggregateMetric(metricName)?.sources;
    if (!Array.isArray(sources)) return [];
    return sources.map((source: any) => String(source)).filter(Boolean);
  };
  const aggregateMetricUnavailableReasons = (metricName: string): string[] => {
    const reasons = aggregateMetric(metricName)?.unavailableReasons;
    if (!Array.isArray(reasons)) return [];
    return reasons.map((reason: any) => String(reason)).filter(Boolean);
  };
  const budgetFinancialAggregate = {
    performanceSummary,
    performanceSources,
    aggregateMetricAvailable,
    aggregateMetricValue,
    aggregateMetricSources,
    aggregateMetricUnavailableReasons,
  };
  void budgetFinancialAggregate;

  const snapshotPerformanceSummary = effectiveSnapshot?.metrics?.performanceSummary;
  const compatibleHistoricalSummary = performanceSummary?.version && snapshotPerformanceSummary?.version === performanceSummary.version
    ? snapshotPerformanceSummary
    : null;
  const aggregateSnapshotMetricValue = (summary: any, metricName: string): number | null => {
    const metric = summary?.totals?.[metricName];
    const value = Number(metric?.value);
    return metric?.available === true && Number.isFinite(value) ? value : null;
  };

  // Aggregate metrics from all platforms
  // Custom Integration: Map pageviews→impressions, sessions→engagements (consistent with Performance Summary)
  const platformMetrics = {
    linkedIn: {
      spend: effectiveLinkedIn?.spend || 0,
      impressions: effectiveLinkedIn?.impressions || 0,
      engagements: effectiveLinkedIn?.engagements || 0,
      clicks: effectiveLinkedIn?.clicks || 0,
      conversions: effectiveLinkedIn?.conversions || 0,
    },
    customIntegration: {
      spend: parseFloat(effectiveCI?.metrics?.spend || '0'),
      impressions: effectiveCI?.metrics?.pageviews || 0,
      engagements: effectiveCI?.metrics?.sessions || 0,
      clicks: effectiveCI?.metrics?.clicks || 0,
      conversions: effectiveCI?.metrics?.conversions || 0,
    },
    sheets: {
      spend: effectiveSheets?.summary?.totalSpend || 0,
      impressions: effectiveSheets?.summary?.totalImpressions || 0,
      engagements: effectiveSheets?.summary?.totalEngagements || 0,
      clicks: effectiveSheets?.summary?.totalClicks || 0,
      conversions: effectiveSheets?.summary?.totalConversions || 0,
    },
    meta: {
      spend: effectiveMeta?.summary?.totalSpend || 0,
      impressions: effectiveMeta?.summary?.totalImpressions || 0,
      engagements: 0,
      clicks: effectiveMeta?.summary?.totalClicks || 0,
      conversions: effectiveMeta?.summary?.totalConversions || 0,
    },
  };

  // Calculate totals across all platforms
  const totalSpend = platformMetrics.linkedIn.spend + platformMetrics.customIntegration.spend + platformMetrics.sheets.spend + platformMetrics.meta.spend;
  const totalImpressions = platformMetrics.linkedIn.impressions + platformMetrics.customIntegration.impressions + platformMetrics.sheets.impressions + platformMetrics.meta.impressions;
  const totalEngagements = platformMetrics.linkedIn.engagements + platformMetrics.customIntegration.engagements + platformMetrics.sheets.engagements + platformMetrics.meta.engagements;
  const totalClicks = platformMetrics.linkedIn.clicks + platformMetrics.customIntegration.clicks + platformMetrics.sheets.clicks + platformMetrics.meta.clicks;
  const totalConversions = platformMetrics.linkedIn.conversions + platformMetrics.customIntegration.conversions + platformMetrics.sheets.conversions + platformMetrics.meta.conversions;
  
  // Get campaign budget and currency
  const campaignBudget = campaign.budget ? (parseFloat(campaign.budget) || 0) : 0;
  const hasCampaignBudget = campaignBudget > 0;
  const campaignStartDate = campaign.startDate ? new Date(campaign.startDate) : null;
  const campaignEndDate = campaign.endDate ? new Date(campaign.endDate) : null;
  const hasCampaignStartDate = Boolean(campaignStartDate && !Number.isNaN(campaignStartDate.getTime()));
  const hasCampaignEndDate = Boolean(campaignEndDate && !Number.isNaN(campaignEndDate.getTime()));
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayPacingDate = startOfDay(new Date());
  const campaignStartDay = hasCampaignStartDate ? startOfDay(campaignStartDate!) : null;
  const campaignEndDay = hasCampaignEndDate ? startOfDay(campaignEndDate!) : null;
  const hasCampaignDateRange = Boolean(campaignStartDay && campaignEndDay && campaignEndDay.getTime() >= campaignStartDay.getTime());
  // Active campaigns pace through today; completed campaigns stop elapsed days at the campaign end date.
  const campaignElapsedEndDay = campaignEndDay && todayPacingDate.getTime() > campaignEndDay.getTime() ? campaignEndDay : todayPacingDate;
  const campaignElapsedDays = campaignStartDay && campaignElapsedEndDay.getTime() >= campaignStartDay.getTime()
    ? Math.max(1, Math.floor((campaignElapsedEndDay.getTime() - campaignStartDay.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 0;
  const campaignTotalDays = hasCampaignDateRange
    ? Math.max(1, Math.floor((campaignEndDay!.getTime() - campaignStartDay!.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 0;
  const campaignCurrency = (campaign as any).currency || 'USD';
  
  // Format currency with campaign's currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: campaignCurrency,
      minimumFractionDigits: 2
    }).format(value);
  };
  
  // Get conversion value from LinkedIn (configured during connection setup)
  // This is the primary source for revenue calculations per system design
  const linkedInConversionValue = effectiveLinkedIn?.conversionValue || 0;
  const linkedInRevenueFromBackend = Number.isFinite(Number((effectiveLinkedIn as any)?.revenue))
    ? Number((effectiveLinkedIn as any).revenue)
    : null;
  const linkedInROASFromBackend = Number.isFinite(Number((effectiveLinkedIn as any)?.roas))
    ? Number((effectiveLinkedIn as any).roas)
    : null;
  const linkedInROIFromBackend = Number.isFinite(Number((effectiveLinkedIn as any)?.roi))
    ? Number((effectiveLinkedIn as any).roi)
    : null;

  // Get AOV from GA4 or Custom Integration as fallback
  const fallbackAOV = effectiveGA4?.averageOrderValue ||
                      effectiveCI?.averageOrderValue ||
                      0;
  
  // Use LinkedIn conversion value if available, otherwise fallback to GA4/Custom Integration AOV
  const estimatedAOV = linkedInConversionValue > 0 ? linkedInConversionValue : fallbackAOV;
  
  // Financial calculations
  const budgetUtilization = campaignBudget > 0 ? (totalSpend / campaignBudget) * 100 : 0;
  const remainingBudget = campaignBudget - totalSpend;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  
  // Calculate platform-specific ROAS
  const calculatePlatformROAS = (spend: number, conversions: number, platformConversionValue?: number) => {
    const aov = platformConversionValue || estimatedAOV;
    const revenue = conversions * aov;
    return spend > 0 ? revenue / spend : 0;
  };
  
  const linkedInROAS =
    linkedInROASFromBackend !== null
      ? linkedInROASFromBackend
      : calculatePlatformROAS(platformMetrics.linkedIn.spend, platformMetrics.linkedIn.conversions, linkedInConversionValue);
  const customIntegrationROAS = calculatePlatformROAS(platformMetrics.customIntegration.spend, platformMetrics.customIntegration.conversions);
  const metaROAS = calculatePlatformROAS(platformMetrics.meta.spend, platformMetrics.meta.conversions);

  // Calculate revenue/ROI using LinkedIn conversion value for LinkedIn conversions
  // and fallback AOV for other platforms (CI, Sheets, Meta)
  // IMPORTANT: Prefer backend-computed LinkedIn revenue. This remains correct even when revenue-to-date is imported
  // (e.g. conversions=0, conversionValue=0, but revenue still exists).
  const linkedInRevenue =
    linkedInRevenueFromBackend !== null
      ? linkedInRevenueFromBackend
      : (platformMetrics.linkedIn.conversions * linkedInConversionValue);
  const metaRevenue = platformMetrics.meta.conversions * estimatedAOV;
  const otherRevenue = (platformMetrics.customIntegration.conversions + platformMetrics.sheets.conversions) * fallbackAOV;
  const estimatedRevenue = linkedInRevenue + otherRevenue + metaRevenue;
  const roas = totalSpend > 0 ? estimatedRevenue / totalSpend : 0;
  const roi =
    // If this campaign is effectively LinkedIn-only, prefer backend ROI (it accounts for revenue-to-date vs derived revenue).
    (linkedInROIFromBackend !== null && otherRevenue === 0 && metaRevenue === 0 && totalSpend === platformMetrics.linkedIn.spend)
      ? linkedInROIFromBackend
      : (totalSpend > 0 ? ((estimatedRevenue - totalSpend) / totalSpend) * 100 : 0);

  const getOverviewMetric = (metricName: string, fallbackValue: number) => {
    const metric = aggregateMetric(metricName);
    if (performanceSummary && metric) {
      const value = aggregateMetricValue(metricName);
      return {
        available: metric.available === true && value !== null,
        value: value ?? 0,
        unavailableReasons: aggregateMetricUnavailableReasons(metricName),
      };
    }
    if (!demoMode && outcomeTotals !== undefined && !performanceSummary) {
      return {
        available: false,
        value: 0,
        unavailableReasons: ["Aggregate financial totals are unavailable"],
      };
    }
    return { available: true, value: fallbackValue, unavailableReasons: [] };
  };
  const overviewSpendMetric = getOverviewMetric("spend", totalSpend);
  const overviewRevenueMetric = getOverviewMetric("revenue", estimatedRevenue);
  const overviewConversionsMetric = getOverviewMetric("conversions", totalConversions);
  const overviewCpcMetric = getOverviewMetric("cpc", cpc);
  const overviewCpaMetric = getOverviewMetric("cpa", cpa);
  const overviewCpmMetric = getOverviewMetric("cpm", cpm);
  const overviewCtrMetric = getOverviewMetric("ctr", ctr);
  const overviewCvrMetric = getOverviewMetric("cvr", conversionRate);
  const overviewRoiMetric = getOverviewMetric("roi", roi);
  const overviewRoasMetric = getOverviewMetric("roas", roas);
  const overviewSpend = overviewSpendMetric.available ? overviewSpendMetric.value : 0;
  const overviewBudgetUtilization = hasCampaignBudget && overviewSpendMetric.available ? (overviewSpend / campaignBudget) * 100 : 0;
  const overviewRemainingBudget = campaignBudget - overviewSpend;
  const overviewMetricUnavailableText = (metric: { unavailableReasons: string[] }, fallback: string) =>
    metric.unavailableReasons[0] || fallback;
  const hasSavedPacingMetadata = hasCampaignBudget || hasCampaignStartDate || hasCampaignEndDate;
  const hasPacingInputDraft = Boolean(pacingBudgetInput.trim() || pacingStartDateInput || pacingEndDateInput);
  const handleSavePacingInputs = () => {
    const normalizedBudget = pacingBudgetInput.replace(/,/g, "").trim();
    const budgetValue = Number(normalizedBudget);
    const startDateValue = pacingStartDateInput;
    const endDateValue = pacingEndDateInput;

    if (normalizedBudget && (!Number.isFinite(budgetValue) || budgetValue <= 0)) {
      setPacingInputError("Campaign budget must be greater than 0.");
      return;
    }

    if (startDateValue && endDateValue && new Date(endDateValue).getTime() < new Date(startDateValue).getTime()) {
      setPacingInputError("Campaign end date must be on or after the start date.");
      return;
    }

    updatePacingInputsMutation.mutate({
      budget: normalizedBudget,
      startDate: startDateValue,
      endDate: endDateValue,
    });
  };
  const handleDeletePacingInputs = () => {
    updatePacingInputsMutation.mutate({
      budget: "",
      startDate: "",
      endDate: "",
    });
  };
  const formatOverviewCurrency = (metric: { available: boolean; value: number; unavailableReasons: string[] }) =>
    metric.available ? formatCurrency(metric.value) : "Unavailable";
  const formatOverviewNumber = (metric: { available: boolean; value: number; unavailableReasons: string[] }) =>
    metric.available ? formatNumber(metric.value) : "Unavailable";
  const formatOverviewPercentage = (metric: { available: boolean; value: number; unavailableReasons: string[] }) =>
    metric.available ? formatPercentage(metric.value) : "Unavailable";
  const financialSpendMetric = getOverviewMetric("spend", totalSpend);
  const financialRevenueMetric = getOverviewMetric("revenue", estimatedRevenue);
  const financialRoiMetric = getOverviewMetric("roi", roi);
  const financialRoasMetric = getOverviewMetric("roas", roas);
  const parseSourceMetric = (source: any, metricName: string) => {
    const parsed = Number(source?.metrics?.[metricName]);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const parseInputValue = (source: any) => {
    const parsed = Number(source?.value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const sourceIncludesMetric = (source: any, metricName: string) =>
    Array.isArray(source?.includedMetrics) && source.includedMetrics.includes(metricName);
  const financialMainSources = performanceSources
    .filter((source: any) => source?.connected === true && source?.category !== "financial");
  const useAggregateSourceTotals = financialMainSources.length === 1;
  const financialSourceBreakdowns: FinancialSourceBreakdown[] = financialMainSources
    .map((source: any) => {
      const sourceRevenue = sourceIncludesMetric(source, "attributedRevenue")
        ? parseSourceMetric(source, "attributedRevenue")
        : parseSourceMetric(source, "revenue");
      const sourceSpend = sourceIncludesMetric(source, "spend") ? parseSourceMetric(source, "spend") : 0;
      const revenue = useAggregateSourceTotals && financialRevenueMetric.available ? financialRevenueMetric.value : sourceRevenue;
      const spend = useAggregateSourceTotals && financialSpendMetric.available ? financialSpendMetric.value : sourceSpend;
      const conversions = sourceIncludesMetric(source, "conversions") ? parseSourceMetric(source, "conversions") : 0;
      return {
        id: String(source.id || source.label || "source"),
        label: String(source.label || source.id || "Connected Source"),
        revenue,
        spend,
        conversions,
        roas: spend > 0 && revenue > 0 ? revenue / spend : null,
        roi: spend > 0 && revenue > 0 ? ((revenue - spend) / spend) * 100 : null,
      };
    })
    .filter((source: FinancialSourceBreakdown) => source.revenue > 0 || source.spend > 0 || source.conversions > 0);
  const financialRevenueInputs = Array.isArray(outcomeTotals?.financialInputs?.revenue) ? outcomeTotals.financialInputs.revenue : [];
  const financialSpendInputs = Array.isArray(outcomeTotals?.financialInputs?.spend) ? outcomeTotals.financialInputs.spend : [];
  const aggregateRevenueInputBreakdowns: FinancialChildSourceBreakdown[] = performanceSources
    .filter((source: any) => source?.connected === true && source?.category === "financial")
    .map((source: any, index: number) => ({
      id: `${String(source.id || source.label || "financial")}-${index}`,
      label: String(source.label || source.id || "Financial input"),
      sourceType: String(source.sourceType || ""),
      revenue: parseSourceMetric(source, "revenue"),
    }))
    .filter((source: FinancialChildSourceBreakdown) => source.revenue > 0);
  const financialChildSourceBreakdowns: FinancialChildSourceBreakdown[] = financialRevenueInputs.length > 0
    ? financialRevenueInputs
        .map((source: any) => ({
          id: String(source?.id || source?.label || "revenue_input"),
          label: String(source?.label || "Revenue input"),
          sourceType: String(source?.sourceType || ""),
          revenue: parseInputValue(source),
        }))
        .filter((source: FinancialChildSourceBreakdown) => source.revenue > 0)
    : aggregateRevenueInputBreakdowns;
  const financialSpendInputBreakdowns: FinancialSpendInputBreakdown[] = financialSpendInputs
    .map((source: any) => ({
      id: String(source?.id || source?.label || "spend_input"),
      label: String(source?.label || "Spend input"),
      sourceType: String(source?.sourceType || ""),
      spend: parseInputValue(source),
    }))
    .filter((source: FinancialSpendInputBreakdown) => source.spend > 0);
  const budgetAllocationSources: FinancialSourceBreakdown[] = financialMainSources
    .filter((source: any) => sourceIncludesMetric(source, "spend"))
    .map((source: any) => {
      const revenue = sourceIncludesMetric(source, "attributedRevenue")
        ? parseSourceMetric(source, "attributedRevenue")
        : sourceIncludesMetric(source, "revenue")
          ? parseSourceMetric(source, "revenue")
          : 0;
      const spend = parseSourceMetric(source, "spend");
      const conversions = sourceIncludesMetric(source, "conversions") ? parseSourceMetric(source, "conversions") : 0;
      return {
        id: String(source.id || source.label || "source"),
        label: String(source.label || source.id || "Connected Source"),
        revenue,
        spend,
        conversions,
        roas: spend > 0 && revenue > 0 ? revenue / spend : null,
        roi: spend > 0 && revenue > 0 ? ((revenue - spend) / spend) * 100 : null,
      };
    })
    .filter((source: FinancialSourceBreakdown) => source.spend > 0);
  const costAnalysisSourceLabels: string[] = Array.from(new Set<string>(
    performanceSources
      .filter((source: any) =>
        source?.connected === true &&
        source?.category !== "financial" &&
        Array.isArray(source?.includedMetrics) &&
        source.includedMetrics.some((metric: string) => ["clicks", "impressions", "conversions", "sessions", "spend"].includes(metric))
      )
      .map((source: any) => String(source?.label || source?.id || "").trim())
      .filter(Boolean)
  ));

  // Calculate comparison metrics
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const renderTrendIndicator = (change: number) => {
    if (Math.abs(change) < 0.01) return null;
    const isPositive = change > 0;
    return (
      <div className={`flex items-center text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
        {Math.abs(change).toFixed(1)}%
      </div>
    );
  };

  const historicalMetrics = demoMode && effectiveSnapshot ? {
    spend: effectiveSnapshot.totalSpend || 0,
    conversions: effectiveSnapshot.totalConversions || 0,
    revenue: (effectiveSnapshot.totalConversions || 0) * estimatedAOV,
    roas: effectiveSnapshot.totalSpend > 0 ? ((effectiveSnapshot.totalConversions || 0) * estimatedAOV) / effectiveSnapshot.totalSpend : 0,
    roi: effectiveSnapshot.totalSpend > 0 ? (((effectiveSnapshot.totalConversions || 0) * estimatedAOV - effectiveSnapshot.totalSpend) / effectiveSnapshot.totalSpend) * 100 : 0,
  } : compatibleHistoricalSummary ? {
    spend: aggregateSnapshotMetricValue(compatibleHistoricalSummary, "spend"),
    conversions: aggregateSnapshotMetricValue(compatibleHistoricalSummary, "conversions"),
    revenue: aggregateSnapshotMetricValue(compatibleHistoricalSummary, "revenue"),
    roas: aggregateSnapshotMetricValue(compatibleHistoricalSummary, "roas"),
    roi: aggregateSnapshotMetricValue(compatibleHistoricalSummary, "roi"),
  } : null;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <Link href={`/campaigns/${campaign.id}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">
                    Budget & Financial Analysis
                  </h1>
                  <p className="text-muted-foreground/70 mt-1">
                    {campaign.name} - Comprehensive financial performance overview
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="roi-roas">ROI & ROAS</TabsTrigger>
              <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
              <TabsTrigger value="budget">Budget Allocation</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {dataLoading ? (
                <div className="space-y-6">
                  <div className="h-48 bg-muted rounded-lg animate-pulse"></div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="h-24 bg-muted rounded-lg animate-pulse"></div>
                    <div className="h-24 bg-muted rounded-lg animate-pulse"></div>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="h-40 bg-muted rounded-lg animate-pulse"></div>
                    <div className="h-40 bg-muted rounded-lg animate-pulse"></div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="h-24 bg-muted rounded-lg animate-pulse"></div>
                    <div className="h-24 bg-muted rounded-lg animate-pulse"></div>
                    <div className="h-24 bg-muted rounded-lg animate-pulse"></div>
                  </div>
                </div>
              ) : <>
              {/* AOV Warning (only when we have no usable revenue source AND data has loaded) */}
              {!overviewRevenueMetric.available && estimatedAOV === 0 && !(linkedInRevenueFromBackend !== null && linkedInRevenueFromBackend > 0) && (
                <Card className="border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      <div>
                        <p className="font-medium text-yellow-900 dark:text-yellow-200">
                          Conversion Value Not Configured
                        </p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          Revenue, ROI, and ROAS calculations require conversion value configuration. Set this during LinkedIn connection setup, or configure AOV in GA4 or Custom Integration.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Budget Health Score Dashboard */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="w-5 h-5" />
                    <span>Campaign Health Score</span>
                  </CardTitle>
                  <CardDescription>
                    Real-time health assessment across key financial metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const hasBudgetHealthInputs = hasCampaignBudget && overviewSpendMetric.available;
                    const hasPacingHealthInputs = hasBudgetHealthInputs && hasCampaignDateRange && campaignElapsedDays > 0;
                    const calculateHealthScore = () => {
                      let score = 0;
                      
                      const budgetScore = hasBudgetHealthInputs ? (overviewBudgetUtilization <= 80 ? 25 : overviewBudgetUtilization <= 95 ? 15 : overviewBudgetUtilization <= 100 ? 10 : 0) : 0;
                      
                      const dailyBurnRate = campaignElapsedDays > 0 ? overviewSpend / campaignElapsedDays : 0;
                      const targetDailySpend = campaignTotalDays > 0 ? campaignBudget / campaignTotalDays : 0;
                      const pacingPercentage = targetDailySpend > 0 ? (dailyBurnRate / targetDailySpend) * 100 : 100;
                      const pacingDeviation = Math.abs(pacingPercentage - 100);
                      const pacingScore = hasPacingHealthInputs ? (pacingDeviation <= 15 ? 25 : pacingDeviation <= 30 ? 15 : pacingDeviation <= 50 ? 10 : 0) : 0;

                      const overviewRoi = overviewRoiMetric.available ? overviewRoiMetric.value : -Infinity;
                      const roiScore = overviewRoi >= 100 ? 25 : overviewRoi >= 50 ? 15 : overviewRoi >= 0 ? 10 : 0;

                      const overviewRoas = overviewRoasMetric.available ? overviewRoasMetric.value : -Infinity;
                      const roasScore = overviewRoas >= 3 ? 25 : overviewRoas >= 1.5 ? 15 : overviewRoas >= 1 ? 10 : 0;
                      
                      score = budgetScore + pacingScore + roiScore + roasScore;
                      
                      return {
                        total: score,
                        budget: { score: budgetScore, status: hasBudgetHealthInputs ? (overviewBudgetUtilization <= 80 ? 'excellent' : overviewBudgetUtilization <= 95 ? 'good' : overviewBudgetUtilization <= 100 ? 'warning' : 'critical') : 'unavailable' },
                        pacing: { score: pacingScore, status: hasPacingHealthInputs ? (pacingDeviation <= 15 ? 'excellent' : pacingDeviation <= 30 ? 'good' : pacingDeviation <= 50 ? 'warning' : 'critical') : 'unavailable' },
                        roi: { score: roiScore, status: overviewRoiMetric.available ? (overviewRoi >= 100 ? 'excellent' : overviewRoi >= 50 ? 'good' : overviewRoi >= 0 ? 'warning' : 'critical') : 'unavailable' },
                        roas: { score: roasScore, status: overviewRoasMetric.available ? (overviewRoas >= 3 ? 'excellent' : overviewRoas >= 1.5 ? 'good' : overviewRoas >= 1 ? 'warning' : 'critical') : 'unavailable' }
                      };
                    };
                    
                    const healthData = calculateHealthScore();
                    const availableHealthMetricCount = [
                      hasBudgetHealthInputs,
                      hasPacingHealthInputs,
                      overviewRoiMetric.available,
                      overviewRoasMetric.available,
                    ].filter(Boolean).length;
                    const hasAnyHealthInputs = availableHealthMetricCount > 0;
                    const displayHealthScore = hasAnyHealthInputs ? Math.round((healthData.total / (availableHealthMetricCount * 25)) * 100) : null;
                    const healthRating = displayHealthScore === null ? "Unavailable" : displayHealthScore >= 80 ? 'Excellent' : displayHealthScore >= 60 ? 'Good' : displayHealthScore >= 40 ? 'Fair' : 'Needs Attention';
                    const healthScoreColor = displayHealthScore === null ? 'text-gray-600' : displayHealthScore >= 80 ? 'text-green-600' : displayHealthScore >= 60 ? 'text-yellow-600' : 'text-red-600';
                    const healthIconBg = displayHealthScore === null ? 'bg-gray-100' : displayHealthScore >= 80 ? 'bg-green-100' : displayHealthScore >= 60 ? 'bg-yellow-100' : 'bg-red-100';
                    const healthIconColor = displayHealthScore === null ? 'text-gray-600' : displayHealthScore >= 80 ? 'text-green-600' : displayHealthScore >= 60 ? 'text-yellow-600' : 'text-red-600';
                    const formatHealthStatus = (status: string) => status === 'unavailable' ? 'Unavailable' : status;
                    const getStatusColor = (status: string) => {
                      switch (status) {
                        case 'excellent': return 'bg-green-500';
                        case 'good': return 'bg-green-400';
                        case 'warning': return 'bg-yellow-500';
                        case 'critical': return 'bg-red-500';
                        default: return 'bg-gray-400';
                      }
                    };
                    
                    const getStatusBadgeColor = (status: string) => {
                      switch (status) {
                        case 'excellent': return 'bg-green-100 text-green-700';
                        case 'good': return 'bg-green-100 text-green-600';
                        case 'warning': return 'bg-yellow-100 text-yellow-700';
                        case 'critical': return 'bg-red-100 text-red-700';
                        default: return 'bg-gray-100 text-gray-700';
                      }
                    };
                    
                    return (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center space-x-3">
                              <div className={`text-5xl font-bold ${healthScoreColor}`}>
                                {displayHealthScore ?? "Unavailable"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <div>{displayHealthScore !== null ? `out of 100 (${availableHealthMetricCount}/4 inputs)` : "No score"}</div>
                                <div className="font-semibold">
                                  {healthRating}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className={`w-24 h-24 rounded-full flex items-center justify-center ${healthIconBg}`}>
                            <Zap className={`w-12 h-12 ${healthIconColor}`} />
                          </div>
                        </div>
                        
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                          <div className="p-4 border rounded-lg" data-testid="health-budget-utilization">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Budget Utilization</span>
                              <div className={`w-3 h-3 rounded-full ${getStatusColor(healthData.budget.status)}`} />
                            </div>
                            <div className="text-2xl font-bold">{hasBudgetHealthInputs ? formatPercentage(overviewBudgetUtilization) : "Unavailable"}</div>
                            {!hasBudgetHealthInputs && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {hasCampaignBudget ? overviewMetricUnavailableText(overviewSpendMetric, "Budget utilization requires available spend") : "Campaign budget is required for budget health"}
                              </p>
                            )}
                            <Badge className={`mt-2 ${getStatusBadgeColor(healthData.budget.status)}`}>
                              {formatHealthStatus(healthData.budget.status)}
                            </Badge>
                          </div>
                          
                          <div className="p-4 border rounded-lg" data-testid="health-pacing">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Pacing Status</span>
                              <div className={`w-3 h-3 rounded-full ${getStatusColor(healthData.pacing.status)}`} />
                            </div>
                            <div className="text-2xl font-bold">{(() => {
                              const dailyBurnRate = campaignElapsedDays > 0 ? overviewSpend / campaignElapsedDays : 0;
                              const targetDailySpend = campaignTotalDays > 0 ? campaignBudget / campaignTotalDays : 0;
                              const pacingPercentage = targetDailySpend > 0 ? (dailyBurnRate / targetDailySpend) * 100 : 100;
                              return hasPacingHealthInputs ? formatPercentage(pacingPercentage) : "Unavailable";
                            })()}</div>
                            {!hasPacingHealthInputs && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {!hasCampaignBudget ? "Campaign budget is required for pacing" : !hasCampaignStartDate ? "Campaign start date is required for pacing" : !hasCampaignEndDate ? "Campaign end date is required for pacing" : !hasCampaignDateRange ? "Campaign end date must be on or after the start date for pacing" : overviewMetricUnavailableText(overviewSpendMetric, "Pacing requires available spend")}
                              </p>
                            )}
                            <Badge className={`mt-2 ${getStatusBadgeColor(healthData.pacing.status)}`}>
                              {formatHealthStatus(healthData.pacing.status)}
                            </Badge>
                          </div>
                          
                          <div className="p-4 border rounded-lg" data-testid="health-roi">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">ROI Performance</span>
                              <div className={`w-3 h-3 rounded-full ${getStatusColor(healthData.roi.status)}`} />
                            </div>
                            <div className="text-2xl font-bold">{formatOverviewPercentage(overviewRoiMetric)}</div>
                            {!overviewRoiMetric.available && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {overviewMetricUnavailableText(overviewRoiMetric, "ROI requires available revenue and spend")}
                              </p>
                            )}
                            <Badge className={`mt-2 ${getStatusBadgeColor(healthData.roi.status)}`}>
                              {formatHealthStatus(healthData.roi.status)}
                            </Badge>
                          </div>
                          
                          <div className="p-4 border rounded-lg" data-testid="health-roas">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">ROAS Performance</span>
                              <div className={`w-3 h-3 rounded-full ${getStatusColor(healthData.roas.status)}`} />
                            </div>
                            <div className="text-2xl font-bold">{overviewRoasMetric.available ? `${overviewRoasMetric.value.toFixed(2)}x` : "Unavailable"}</div>
                            {!overviewRoasMetric.available && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {overviewMetricUnavailableText(overviewRoasMetric, "ROAS requires available revenue and spend")}
                              </p>
                            )}
                            <Badge className={`mt-2 ${getStatusBadgeColor(healthData.roas.status)}`}>
                              {formatHealthStatus(healthData.roas.status)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Key Financial Metrics */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground/70">Total Spend</p>
                        <div className="flex items-center justify-between">
                          <p className="text-2xl font-bold text-foreground">
                            {formatOverviewCurrency(overviewSpendMetric)}
                          </p>
                          {overviewSpendMetric.available && historicalMetrics?.spend !== null && historicalMetrics?.spend !== undefined && renderTrendIndicator(calculateChange(overviewSpend, historicalMetrics.spend))}
                          {!overviewSpendMetric.available && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {overviewMetricUnavailableText(overviewSpendMetric, "No connected spend source is available")}
                            </p>
                          )}
                        </div>
                      </div>
                      <DollarSign className="w-8 h-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground/70">Conversions</p>
                        <div className="flex items-center justify-between">
                          <p className="text-2xl font-bold text-foreground">
                            {formatOverviewNumber(overviewConversionsMetric)}
                          </p>
                          {overviewConversionsMetric.available && historicalMetrics?.conversions !== null && historicalMetrics?.conversions !== undefined && renderTrendIndicator(calculateChange(overviewConversionsMetric.value, historicalMetrics.conversions))}
                          {!overviewConversionsMetric.available && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {overviewMetricUnavailableText(overviewConversionsMetric, "No connected source provides conversions")}
                            </p>
                          )}
                        </div>
                      </div>
                      <Activity className="w-8 h-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Budget Utilization & Pacing */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="w-5 h-5" />
                      <span>Budget Utilization</span>
                    </CardTitle>
                    <CardDescription>
                      Campaign budget usage and remaining allocation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Budget Used</span>
                        <span className="text-sm text-muted-foreground">
                          {formatOverviewCurrency(overviewSpendMetric)} of {formatCurrency(campaignBudget)}
                        </span>
                      </div>
                      <Progress value={Math.min(overviewBudgetUtilization, 100)} className="h-2" />
                      <div className="flex items-center justify-between text-sm">
                        <span className={overviewBudgetUtilization > 90 ? "text-red-600" : "text-green-600"}>
                          {overviewSpendMetric.available ? `${formatPercentage(overviewBudgetUtilization)} utilized` : overviewMetricUnavailableText(overviewSpendMetric, "Spend unavailable")}
                        </span>
                        <span className="text-muted-foreground">
                          {overviewSpendMetric.available ? `${formatCurrency(overviewRemainingBudget)} remaining` : "Remaining unavailable"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Activity className="w-5 h-5" />
                      <span>Budget Pacing & Burn Rate</span>
                    </CardTitle>
                    <CardDescription>
                      Daily spend rate and budget projection
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(() => {
                        const today = new Date();
                        const dailyBurnRate = campaignElapsedDays > 0 ? overviewSpend / campaignElapsedDays : 0;
                        const isOverBudget = hasCampaignBudget && overviewSpendMetric.available && overviewRemainingBudget < 0;
                        const daysRemaining = (!isOverBudget && dailyBurnRate > 0) ? overviewRemainingBudget / dailyBurnRate : 0;
                        const projectedEndDate = (!isOverBudget && dailyBurnRate > 0) ? new Date(today.getTime() + daysRemaining * 24 * 60 * 60 * 1000) : null;
                        
                        const hasPacingInputs = hasCampaignBudget && overviewSpendMetric.available && hasCampaignDateRange && campaignElapsedDays > 0;
                        const targetDailySpend = campaignTotalDays > 0 ? campaignBudget / campaignTotalDays : 0;
                        
                        const pacingPercentage = targetDailySpend > 0 ? (dailyBurnRate / targetDailySpend) * 100 : 100;
                        const pacingStatus = !hasPacingInputs ? 'unavailable' : pacingPercentage > 115 ? 'ahead' : pacingPercentage < 85 ? 'behind' : 'on-track';
                        const shouldShowPacingInputForm = isEditingPacingInputs || !hasCampaignBudget || !hasCampaignStartDate || !hasCampaignEndDate || !hasCampaignDateRange;
                        
                        return (
                          <>
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <span className="text-sm font-medium">Daily Burn Rate</span>
                                <p className="text-xs text-muted-foreground">Requires campaign spend and start date</p>
                                {overviewSpendMetric.available && campaignElapsedDays > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Based on {campaignElapsedDays} elapsed campaign {campaignElapsedDays === 1 ? "day" : "days"}
                                  </p>
                                )}
                              </div>
                              <span className="text-sm font-bold">{overviewSpendMetric.available && campaignElapsedDays > 0 ? formatCurrency(dailyBurnRate) : "Unavailable"}</span>
                            </div>
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <span className="text-sm font-medium">Target Daily Spend</span>
                                <p className="text-xs text-muted-foreground">Requires campaign budget, start date, and end date</p>
                              </div>
                              <span className="text-sm text-muted-foreground">{hasPacingInputs ? formatCurrency(targetDailySpend) : "Unavailable"}</span>
                            </div>
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <span className="text-sm font-medium">Pacing Status</span>
                                <p className="text-xs text-muted-foreground">Requires campaign spend, budget, start date, and end date</p>
                              </div>
                              <Badge className={
                                pacingStatus === 'unavailable' ? 'bg-gray-100 text-gray-700' :
                                pacingStatus === 'ahead' ? 'bg-red-100 text-red-700' : 
                                pacingStatus === 'behind' ? 'bg-yellow-100 text-yellow-700' : 
                                'bg-green-100 text-green-700'
                              }>
                                {pacingStatus === 'unavailable' ? 'Unavailable' :
                                 pacingStatus === 'ahead' ? `${formatPercentage(pacingPercentage - 100)} Over` :
                                 pacingStatus === 'behind' ? `${formatPercentage(100 - pacingPercentage)} Under` : 
                                 'On Track'}
                              </Badge>
                            </div>
                            {isOverBudget && (
                              <div className="pt-3 border-t">
                                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                                  Budget exceeded by {formatCurrency(Math.abs(overviewRemainingBudget))}
                                </p>
                              </div>
                            )}
                            {shouldShowPacingInputForm && (
                              <div className="pt-3 border-t space-y-3">
                                <p className="text-xs text-muted-foreground">
                                  Edit campaign pacing inputs here or in campaign settings.
                                </p>
                                <div className="grid gap-3 md:grid-cols-3">
                                  <div className="space-y-1">
                                    <span className="text-xs font-medium">Campaign Budget</span>
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={pacingBudgetInput}
                                      onChange={(event) => setPacingBudgetInput(formatBudgetInputValue(event.target.value))}
                                      onBlur={() => setPacingBudgetInput(formatBudgetInputValue(pacingBudgetInput))}
                                      placeholder="Budget"
                                      data-testid="input-pacing-budget"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-xs font-medium">Start Date</span>
                                    <Input
                                      type="date"
                                      value={pacingStartDateInput}
                                      onChange={(event) => setPacingStartDateInput(event.target.value)}
                                      data-testid="input-pacing-start-date"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-xs font-medium">End Date</span>
                                    <Input
                                      type="date"
                                      value={pacingEndDateInput}
                                      onChange={(event) => setPacingEndDateInput(event.target.value)}
                                      data-testid="input-pacing-end-date"
                                    />
                                  </div>
                                </div>
                                {pacingInputError && (
                                  <p className="text-xs text-red-600 dark:text-red-400">{pacingInputError}</p>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={handleSavePacingInputs}
                                  disabled={!hasPacingInputDraft || updatePacingInputsMutation.isPending}
                                >
                                  {updatePacingInputsMutation.isPending ? "Saving..." : "Save"}
                                </Button>
                                {hasSavedPacingMetadata && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleDeletePacingInputs}
                                    disabled={updatePacingInputsMutation.isPending}
                                  >
                                    Delete inputs
                                  </Button>
                                )}
                              </div>
                            )}
                            {!shouldShowPacingInputForm && (
                              <div className="pt-3 border-t">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setIsEditingPacingInputs(true)}
                                >
                                  Edit inputs
                                </Button>
                              </div>
                            )}
                            {overviewSpendMetric.available && !isOverBudget && projectedEndDate && daysRemaining > 0 && (
                              <div className="pt-3 border-t">
                                <p className="text-xs text-muted-foreground">
                                  At current rate, budget will be exhausted in <strong>{Math.ceil(daysRemaining)} days</strong>
                                  {campaignEndDate && (
                                    <span> ({projectedEndDate > campaignEndDate ? 'after' : 'before'} campaign end date)</span>
                                  )}
                                </p>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Cost Efficiency Metrics */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground/70">Cost Per Click</p>
                        <p className="text-xl font-bold text-foreground">
                          {formatOverviewCurrency(overviewCpcMetric)}
                        </p>
                        {!overviewCpcMetric.available && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {overviewMetricUnavailableText(overviewCpcMetric, "CPC requires available spend and clicks")}
                          </p>
                        )}
                      </div>
                      <BarChart3 className="w-6 h-6 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground/70">Cost Per Acquisition</p>
                        <p className="text-xl font-bold text-foreground">
                          {formatOverviewCurrency(overviewCpaMetric)}
                        </p>
                        {!overviewCpaMetric.available && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {overviewMetricUnavailableText(overviewCpaMetric, "CPA requires available spend and conversions")}
                          </p>
                        )}
                      </div>
                      <Target className="w-6 h-6 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground/70">Conversion Rate</p>
                        <p className="text-xl font-bold text-foreground">
                          {formatOverviewPercentage(overviewCvrMetric)}
                        </p>
                        {!overviewCvrMetric.available && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {overviewMetricUnavailableText(overviewCvrMetric, "Conversion rate requires available conversions and clicks")}
                          </p>
                        )}
                        {overviewCvrMetric.available && overviewCvrMetric.value > 100 && (
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            * Exceeds 100% due to view-through conversions from ad impressions
                          </p>
                        )}
                      </div>
                      <PieChart className="w-6 h-6 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>
              </>}
            </TabsContent>

            <TabsContent value="roi-roas" className="space-y-6">
              {dataLoading ? (
                <div className="space-y-6">
                  <div className="h-64 bg-muted rounded-lg animate-pulse"></div>
                  <div className="h-48 bg-muted rounded-lg animate-pulse"></div>
                </div>
              ) : <Card>
                <CardHeader>
                  <CardTitle>ROI & ROAS Analysis</CardTitle>
                  <CardDescription>
                    Return on investment and return on ad spend detailed breakdown
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="font-semibold">Return on Ad Spend (ROAS)</h4>
                      <div className="text-3xl font-bold text-blue-600">
                        {financialRoasMetric.available ? `${financialRoasMetric.value.toFixed(2)}x` : "Unavailable"}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {financialRoasMetric.available
                          ? `For every $1 spent on advertising, you generated $${financialRoasMetric.value.toFixed(2)} in revenue.`
                          : overviewMetricUnavailableText(financialRoasMetric, "ROAS requires available revenue and spend")}
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Total Ad Spend:</span>
                          <span className="font-medium">{formatOverviewCurrency(financialSpendMetric)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Revenue:</span>
                          <span className="font-medium">{formatOverviewCurrency(financialRevenueMetric)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold">Return on Investment (ROI)</h4>
                      <div className={`text-3xl font-bold ${financialRoiMetric.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatOverviewPercentage(financialRoiMetric)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {financialRoiMetric.available
                          ? `${financialRoiMetric.value >= 0 ? 'Positive' : 'Negative'} return on your advertising investment.`
                          : overviewMetricUnavailableText(financialRoiMetric, "ROI requires available revenue and spend")}
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Net Profit:</span>
                          <span className={`font-medium ${financialRevenueMetric.value - financialSpendMetric.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {financialRevenueMetric.available && financialSpendMetric.available
                              ? formatCurrency(financialRevenueMetric.value - financialSpendMetric.value)
                              : "Unavailable"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Investment:</span>
                          <span className="font-medium">{formatOverviewCurrency(financialSpendMetric)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Source-Specific ROAS Breakdown */}
                  <div className="mt-6">
                    <h4 className="font-semibold mb-4">Source ROAS Performance</h4>
                    <div className="space-y-3">
                      {performanceSummary && financialSourceBreakdowns.map((source) => (
                        <div key={`${source.id}-roas`} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">{source.label}</span>
                            <Badge className={source.roas === null ? "bg-muted text-muted-foreground" : source.roas >= 3 ? "bg-green-100 text-green-700" : source.roas >= 1.5 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                              {source.roas === null ? "ROAS unavailable" : `${source.roas.toFixed(2)}x ROAS`}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Spend: {formatCurrency(source.spend)} | Conversions: {formatNumber(source.conversions)} | Revenue: {formatCurrency(source.revenue)}
                          </div>
                        </div>
                      ))}
                      {!performanceSummary && (
                      <>
                      {/* LinkedIn Ads */}
                      {platformMetrics.linkedIn.spend > 0 && (
                        <div className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">LinkedIn Ads</span>
                            <Badge className={linkedInROAS >= 3 ? "bg-green-100 text-green-700" : linkedInROAS >= 1.5 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                              {linkedInROAS.toFixed(2)}x ROAS
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Spend: {formatCurrency(platformMetrics.linkedIn.spend)} • Conversions: {formatNumber(platformMetrics.linkedIn.conversions)} • Revenue: {formatCurrency(linkedInRevenue)}
                          </div>
                        </div>
                      )}

                      {/* Custom Integration */}
                      {(platformMetrics.customIntegration.spend > 0 || platformMetrics.customIntegration.conversions > 0) && (
                        <div className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">Custom Integration</span>
                            <Badge className={customIntegrationROAS >= 3 ? "bg-green-100 text-green-700" : customIntegrationROAS >= 1.5 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                              {customIntegrationROAS.toFixed(2)}x ROAS
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Spend: {formatCurrency(platformMetrics.customIntegration.spend)} • Conversions: {formatNumber(platformMetrics.customIntegration.conversions)} • Revenue: {formatCurrency(platformMetrics.customIntegration.conversions * fallbackAOV)}
                          </div>
                        </div>
                      )}

                      {/* Meta Ads */}
                      {platformMetrics.meta.spend > 0 && (
                        <div className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">Meta Ads</span>
                            <Badge className={metaROAS >= 3 ? "bg-green-100 text-green-700" : metaROAS >= 1.5 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                              {metaROAS.toFixed(2)}x ROAS
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Spend: {formatCurrency(platformMetrics.meta.spend)} • Conversions: {formatNumber(platformMetrics.meta.conversions)} • Revenue: {formatCurrency(metaRevenue)}
                          </div>
                        </div>
                      )}
                      </>
                      )}

                      {/* No data message */}
                      {((performanceSummary && financialSourceBreakdowns.length === 0) || (!performanceSummary && totalSpend === 0)) && (
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <p className="text-sm text-muted-foreground">
                            No connected source has revenue, spend, or conversion data available yet.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Source-Specific ROI Breakdown */}
                  <div className="mt-6">
                    <h4 className="font-semibold mb-4">Source ROI Performance</h4>
                    <div className="space-y-3">
                      {performanceSummary && financialSourceBreakdowns.map((source) => {
                        const netProfit = source.revenue - source.spend;
                        return (
                          <div key={`${source.id}-roi`} className="p-3 border rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">{source.label}</span>
                              <Badge className={source.roi === null ? "bg-muted text-muted-foreground" : source.roi >= 100 ? "bg-green-100 text-green-700" : source.roi >= 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                                {source.roi === null ? "ROI unavailable" : `${formatPercentage(source.roi)} ROI`}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Spend: {formatCurrency(source.spend)} | Net Profit: <span className={netProfit >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(netProfit)}</span>
                            </div>
                          </div>
                        );
                      })}
                      {!performanceSummary && (
                      <>
                      {/* LinkedIn Ads */}
                      {platformMetrics.linkedIn.spend > 0 && (() => {
                        const linkedInROI = platformMetrics.linkedIn.spend > 0
                          ? ((linkedInRevenue - platformMetrics.linkedIn.spend) / platformMetrics.linkedIn.spend) * 100
                          : 0;
                        const linkedInNetProfit = linkedInRevenue - platformMetrics.linkedIn.spend;

                        return (
                          <div className="p-3 border rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">LinkedIn Ads</span>
                              <Badge className={linkedInROI >= 100 ? "bg-green-100 text-green-700" : linkedInROI >= 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                                {formatPercentage(linkedInROI)} ROI
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Spend: {formatCurrency(platformMetrics.linkedIn.spend)} • Net Profit: <span className={linkedInNetProfit >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(linkedInNetProfit)}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Custom Integration */}
                      {(platformMetrics.customIntegration.spend > 0 || platformMetrics.customIntegration.conversions > 0) && (() => {
                        const customIntegrationRevenue = platformMetrics.customIntegration.conversions * fallbackAOV;
                        const customIntegrationROI = platformMetrics.customIntegration.spend > 0
                          ? ((customIntegrationRevenue - platformMetrics.customIntegration.spend) / platformMetrics.customIntegration.spend) * 100
                          : 0;
                        const customIntegrationNetProfit = customIntegrationRevenue - platformMetrics.customIntegration.spend;

                        return (
                          <div className="p-3 border rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">Custom Integration</span>
                              <Badge className={customIntegrationROI >= 100 ? "bg-green-100 text-green-700" : customIntegrationROI >= 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                                {formatPercentage(customIntegrationROI)} ROI
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Spend: {formatCurrency(platformMetrics.customIntegration.spend)} • Net Profit: <span className={customIntegrationNetProfit >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(customIntegrationNetProfit)}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Meta Ads */}
                      {platformMetrics.meta.spend > 0 && (() => {
                        const metaROI = platformMetrics.meta.spend > 0
                          ? ((metaRevenue - platformMetrics.meta.spend) / platformMetrics.meta.spend) * 100
                          : 0;
                        const metaNetProfit = metaRevenue - platformMetrics.meta.spend;

                        return (
                          <div className="p-3 border rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium">Meta Ads</span>
                              <Badge className={metaROI >= 100 ? "bg-green-100 text-green-700" : metaROI >= 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                                {formatPercentage(metaROI)} ROI
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Spend: {formatCurrency(platformMetrics.meta.spend)} • Net Profit: <span className={metaNetProfit >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(metaNetProfit)}</span>
                            </div>
                          </div>
                        );
                      })()}
                      </>
                      )}

                      {/* No data message */}
                      {((performanceSummary && financialSourceBreakdowns.length === 0) || (!performanceSummary && totalSpend === 0)) && (
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <p className="text-sm text-muted-foreground">
                            No connected source has revenue, spend, or conversion data available yet.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {(financialChildSourceBreakdowns.length > 0 || financialSpendInputBreakdowns.length > 0) && (
                    <div className="mt-6">
                      <h4 className="font-semibold mb-2">Financial Inputs</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        These child inputs feed aggregate revenue and spend through their parent connected platform and are not separate main Connected Platforms.
                      </p>
                      {financialChildSourceBreakdowns.length > 0 && (
                        <div className="space-y-3">
                          <h5 className="text-sm font-semibold">Revenue</h5>
                          {financialChildSourceBreakdowns.map((source) => (
                            <div key={source.id} className="p-3 border rounded-lg">
                              <div className="flex justify-between items-center gap-4">
                                <div>
                                  <span className="font-medium">{source.label}</span>
                                </div>
                                <span className="text-sm font-medium">{formatCurrency(source.revenue)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {financialSpendInputBreakdowns.length > 0 && (
                        <div className="space-y-3 mt-4">
                          <h5 className="text-sm font-semibold">Spend</h5>
                          {financialSpendInputBreakdowns.map((source) => (
                            <div key={source.id} className="p-3 border rounded-lg">
                              <div className="flex justify-between items-center gap-4">
                                <div>
                                  <span className="font-medium">{source.label}</span>
                                </div>
                                <span className="text-sm font-medium">{formatCurrency(source.spend)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>}
            </TabsContent>

            <TabsContent value="costs" className="space-y-6">
              {dataLoading ? (
                <div className="space-y-6">
                  <div className="h-64 bg-muted rounded-lg animate-pulse"></div>
                </div>
              ) : <Card>
                <CardHeader>
                  <CardTitle>Cost Analysis Breakdown</CardTitle>
                  <CardDescription>
                    Detailed cost efficiency and optimization opportunities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h4 className="font-semibold">Cost Metrics</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 border rounded">
                          <span>Cost Per Click (CPC)</span>
                          <span className="font-medium">{formatOverviewCurrency(overviewCpcMetric)}</span>
                        </div>
                        {!overviewCpcMetric.available && (
                          <p className="text-xs text-muted-foreground">
                            {overviewMetricUnavailableText(overviewCpcMetric, "CPC requires available spend and clicks")}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between p-3 border rounded">
                          <span>Cost Per Acquisition (CPA)</span>
                          <span className="font-medium">{formatOverviewCurrency(overviewCpaMetric)}</span>
                        </div>
                        {!overviewCpaMetric.available && (
                          <p className="text-xs text-muted-foreground">
                            {overviewMetricUnavailableText(overviewCpaMetric, "CPA requires available spend and conversions")}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between p-3 border rounded">
                          <span>Cost Per Thousand Impressions (CPM)</span>
                          <span className="font-medium">{formatOverviewCurrency(overviewCpmMetric)}</span>
                        </div>
                        {!overviewCpmMetric.available && (
                          <p className="text-xs text-muted-foreground">
                            {overviewMetricUnavailableText(overviewCpmMetric, "CPM requires available spend and impressions")}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold">Efficiency Indicators</h4>
                      <div className="space-y-3">
                        <div className="p-3 border rounded">
                          <div className="flex items-center justify-between mb-2">
                            <span>Click-through Rate (CTR)</span>
                            <span className="font-medium">{formatOverviewPercentage(overviewCtrMetric)}</span>
                          </div>
                          {overviewCtrMetric.available ? (
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${Math.min(overviewCtrMetric.value / 15 * 100, 100)}%` }}
                              ></div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {overviewMetricUnavailableText(overviewCtrMetric, "CTR requires available clicks and impressions")}
                            </p>
                          )}
                        </div>
                        
                        <div className="p-3 border rounded">
                          <div className="flex items-center justify-between mb-2">
                            <span>Conversion Rate (CVR)</span>
                            <span className="font-medium">{formatOverviewPercentage(overviewCvrMetric)}</span>
                          </div>
                          {overviewCvrMetric.available ? (
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-600 h-2 rounded-full"
                                style={{ width: `${Math.min(overviewCvrMetric.value / 20 * 100, 100)}%` }}
                              ></div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {overviewMetricUnavailableText(overviewCvrMetric, "CVR requires available conversions and clicks or web sessions")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t">
                    <h4 className="font-semibold mb-2">Sources</h4>
                    {costAnalysisSourceLabels.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {costAnalysisSourceLabels.map((source) => (
                          <Badge key={source} variant="outline">{source}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No connected source provides cost-analysis metrics yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>}
            </TabsContent>

            <TabsContent value="budget" className="space-y-6">
              {dataLoading ? (
                <div className="space-y-6">
                  <div className="h-64 bg-muted rounded-lg animate-pulse"></div>
                </div>
              ) : <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="w-5 h-5" />
                    <span>Performance-Based Budget Allocation</span>
                  </CardTitle>
                  <CardDescription>
                    Spend-capable connected source distribution and performance tiers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const allocationSpend = budgetAllocationSources.reduce((sum, source) => sum + source.spend, 0);
                    const highPerformance = budgetAllocationSources.filter(source => source.roas !== null && source.roas >= 3);
                    const mediumPerformance = budgetAllocationSources.filter(source => source.roas !== null && source.roas >= 1 && source.roas < 3);
                    const lowPerformance = budgetAllocationSources.filter(source => source.roas !== null && source.roas < 1);
                    
                    const highSpend = highPerformance.reduce((sum, p) => sum + p.spend, 0);
                    const mediumSpend = mediumPerformance.reduce((sum, p) => sum + p.spend, 0);
                    const lowSpend = lowPerformance.reduce((sum, p) => sum + p.spend, 0);
                    
                    return (
                      <div className="space-y-6">
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            Imported spend labels inside GA4, such as Google Sheets or LinkedIn spend imports, feed total spend, ROI, and ROAS but are not connected ad platforms. Budget Allocation only shows sources after a spend-capable ad platform is connected in Connected Platforms.
                          </p>
                        </div>

                        {/* Performance Tiers */}
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="p-4 border rounded-lg">
                            <h4 className="font-semibold text-green-600 mb-2">High Performance</h4>
                            <p className="text-2xl font-bold">{formatCurrency(highSpend)}</p>
                            <p className="text-sm text-muted-foreground">
                              {allocationSpend > 0 ? ((highSpend / allocationSpend) * 100).toFixed(0) : 0}% of spend-capable source spend
                            </p>
                            <p className="text-xs mt-2">Sources with ROAS &ge; 3.0x</p>
                          </div>
                          <div className="p-4 border rounded-lg">
                            <h4 className="font-semibold text-yellow-600 mb-2">Medium Performance</h4>
                            <p className="text-2xl font-bold">{formatCurrency(mediumSpend)}</p>
                            <p className="text-sm text-muted-foreground">
                              {allocationSpend > 0 ? ((mediumSpend / allocationSpend) * 100).toFixed(0) : 0}% of spend-capable source spend
                            </p>
                            <p className="text-xs mt-2">Sources with ROAS 1.0-3.0x</p>
                          </div>
                          <div className="p-4 border rounded-lg">
                            <h4 className="font-semibold text-red-600 mb-2">Low Performance</h4>
                            <p className="text-2xl font-bold">{formatCurrency(lowSpend)}</p>
                            <p className="text-sm text-muted-foreground">
                              {allocationSpend > 0 ? ((lowSpend / allocationSpend) * 100).toFixed(0) : 0}% of spend-capable source spend
                            </p>
                            <p className="text-xs mt-2">Sources with ROAS &lt; 1.0x</p>
                          </div>
                        </div>
                        
                        {/* Source Budget Breakdown */}
                        <div className="mt-6">
                          <h4 className="font-semibold mb-4">Source Budget Analysis</h4>
                          <div className="space-y-4">
                            {budgetAllocationSources.length === 0 && (
                              <div className="p-4 bg-muted rounded-lg text-center">
                                <p className="text-sm text-muted-foreground">
                                  No spend-capable connected source is available for budget allocation yet.
                                </p>
                              </div>
                            )}
                            {budgetAllocationSources.length === 1 && (
                              <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground">
                                  One spend-capable connected source is available. Budget reallocation recommendations require at least two spend-capable sources.
                                </p>
                              </div>
                            )}
                            {budgetAllocationSources.map((platform) => {
                              const currentPercent = allocationSpend > 0 ? (platform.spend / allocationSpend) * 100 : 0;
                              const performanceColor = platform.roas === null ? 'muted' : platform.roas >= 3 ? 'green' : platform.roas >= 1 ? 'yellow' : 'red';

                              return (
                                <div key={platform.id} className="p-4 border rounded-lg">
                                  <div className="flex justify-between items-center mb-3">
                                    <span className="font-medium">{platform.label}</span>
                                    <div className="flex items-center space-x-2">
                                      <Badge className={
                                        performanceColor === 'green' ? "bg-green-100 text-green-700" :
                                        performanceColor === 'yellow' ? "bg-yellow-100 text-yellow-700" :
                                        performanceColor === 'red' ? "bg-red-100 text-red-700" :
                                        "bg-muted text-muted-foreground"
                                      }>
                                        {platform.roas === null ? "ROAS unavailable" : `${platform.roas.toFixed(2)}x ROAS`}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                                    <div>
                                      <span className="text-muted-foreground">Spend:</span>
                                      <p className="font-medium">{formatCurrency(platform.spend)}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Conversions:</span>
                                      <p className="font-medium">{formatNumber(platform.conversions)}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Revenue:</span>
                                      <p className="font-medium">{formatCurrency(platform.revenue)}</p>
                                    </div>
                                  </div>
                                  <div className="flex justify-between text-sm mb-2">
                                    <span>Budget Share:</span>
                                    <span>{currentPercent.toFixed(1)}%</span>
                                  </div>
                                  <Progress value={currentPercent} className="h-2" />
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {budgetAllocationSources.length > 1 && (
                          <div className="mt-6 p-4 border rounded-lg">
                            <h4 className="font-semibold mb-2">Allocation Guidance</h4>
                            {lowPerformance.length > 0 && highPerformance.length > 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Review spend from lower-performing sources for possible reallocation to higher-performing spend-capable sources.
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Spend-capable source performance is available. Reallocation guidance will become stronger as multiple sources show clear ROAS differences.
                              </p>
                            )}
                          </div>
                        )}
                        
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>}
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              {dataLoading ? (
                <div className="space-y-6">
                  <div className="h-64 bg-muted rounded-lg animate-pulse"></div>
                </div>
              ) : <Card>
                <CardHeader>
                  <CardTitle>Financial Performance Insights</CardTitle>
                  <CardDescription>
                    Key insights and recommendations for financial optimization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const platforms = budgetAllocationSources.map((source) => ({
                      name: source.label,
                      spend: source.spend,
                      roas: source.roas,
                      conversions: source.conversions,
                      revenue: source.revenue,
                    }));

                    const platformsWithSpend = platforms.filter(p => p.spend > 0);
                    const platformsWithRoas = platformsWithSpend.filter(p => p.roas !== null);
                    const topPerformer = platformsWithRoas.length > 0 ? platformsWithRoas.reduce((a, b) => (a.roas ?? 0) > (b.roas ?? 0) ? a : b) : null;
                    const bottomPerformer = platformsWithRoas.length > 1 ? platformsWithRoas.reduce((a, b) => (a.roas ?? 0) < (b.roas ?? 0) ? a : b) : null;
                    const highPerformance = platformsWithRoas.filter(p => (p.roas ?? 0) >= 3);
                    const lowPerformance = platformsWithRoas.filter(p => (p.roas ?? 0) < 1);
                    const hasMultiplePlatforms = platformsWithSpend.length > 1;
                    const insightCardClass: Record<InsightTone, string> = {
                      success: "p-4 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
                      warning: "p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
                      info: "p-4 rounded-lg border bg-muted border-border",
                    };
                    const insightTitleClass: Record<InsightTone, string> = {
                      success: "font-semibold mb-2 text-green-900 dark:text-green-100",
                      warning: "font-semibold mb-2 text-yellow-900 dark:text-yellow-100",
                      info: "font-semibold mb-2 text-foreground dark:text-slate-100",
                    };
                    const insightBodyClass: Record<InsightTone, string> = {
                      success: "text-sm text-green-800 dark:text-green-200",
                      warning: "text-sm text-yellow-800 dark:text-yellow-200",
                      info: "text-sm text-foreground/80",
                    };
                    const isBudgetUnderutilized = overviewSpendMetric.available && overviewBudgetUtilization < 50;
                    const hasStrongRoas = financialRoasMetric.available && financialRoasMetric.value > 2;
                    const hasBudgetCapacity = overviewSpendMetric.available && overviewBudgetUtilization > 85 && overviewBudgetUtilization <= 100;
                    const financialPerformanceTone: InsightTone = !financialRoasMetric.available || !financialRoiMetric.available
                      ? "info"
                      : financialRoasMetric.value < 1 || financialRoiMetric.value < 0
                        ? "warning"
                        : "success";
                    const topPerformerTone: InsightTone = !topPerformer
                      ? "info"
                      : (topPerformer.roas ?? 0) >= 3
                        ? "success"
                        : "warning";
                    const topPerformerLabel = hasMultiplePlatforms ? "Strongest Source" : "Source Performance";
                    const costEfficiencyTone: InsightTone = !overviewCpaMetric.available
                      ? "info"
                      : overviewCpaMetric.value < 25
                        ? "success"
                        : "warning";
                    const budgetManagementTone: InsightTone = !overviewSpendMetric.available
                      ? "info"
                      : overviewBudgetUtilization > 100 || isBudgetUnderutilized
                        ? "warning"
                        : "info";
                    
                    return (
                      <div className="space-y-6">
                        {/* Quick Summary Cards */}
                        <div className="space-y-4">
                          <div className={insightCardClass[financialPerformanceTone]}>
                            <h4 className={insightTitleClass[financialPerformanceTone]}>Performance Summary</h4>
                            <p className={insightBodyClass[financialPerformanceTone]}>
                              {financialRoasMetric.available && financialRoiMetric.available
                                ? `Your campaign is generating a ${financialRoasMetric.value.toFixed(2)}x ROAS with ${formatPercentage(financialRoiMetric.value)} ROI.`
                                : overviewMetricUnavailableText(financialRoasMetric.available ? financialRoiMetric : financialRoasMetric, "ROAS and ROI require available revenue and spend.")}
                            </p>
                          </div>
                          
                          <div className={insightCardClass[costEfficiencyTone]}>
                            <h4 className={insightTitleClass[costEfficiencyTone]}>Cost Efficiency</h4>
                            <p className={insightBodyClass[costEfficiencyTone]}>
                              {overviewCpaMetric.available
                                ? `Your CPA is ${formatCurrency(overviewCpaMetric.value)}. ${overviewCpaMetric.value < 25 ? "Acquisition costs are well controlled." : "Review conversion efficiency before increasing spend."}`
                                : overviewMetricUnavailableText(overviewCpaMetric, "CPA requires available spend and conversions.")}
                            </p>
                          </div>
                          
                          <div className={insightCardClass[budgetManagementTone]}>
                            <h4 className={insightTitleClass[budgetManagementTone]}>Budget Management</h4>
                            <p className={insightBodyClass[budgetManagementTone]}>
                              {overviewSpendMetric.available
                                ? `You have utilized ${formatPercentage(overviewBudgetUtilization)} of your budget. ${overviewBudgetUtilization > 100 ? "Campaign spend is over budget." : isBudgetUnderutilized ? "Budget is underutilized relative to the total campaign budget." : overviewBudgetUtilization > 85 ? "Monitor remaining budget closely." : "Budget usage is currently within range."}`
                                : overviewMetricUnavailableText(overviewSpendMetric, "Budget management requires available spend.")}
                            </p>
                          </div>
                        </div>
                        
                        {/* Source Performance Insights */}
                        {platformsWithSpend.length > 0 && (
                          <div className="mt-6">
                            <h4 className="font-semibold mb-4">Source Performance Insights</h4>
                            <div className="space-y-3">
                              {topPerformer && (
                                <div className={insightCardClass[topPerformerTone]}>
                                  <div className="flex items-center space-x-2 mb-2">
                                    <TrendingUp className={`w-5 h-5 ${topPerformerTone === "success" ? "text-green-600" : "text-yellow-600"}`} />
                                    <h5 className={insightTitleClass[topPerformerTone]}>{topPerformerLabel}: {topPerformer.name}</h5>
                                  </div>
                                  <div className="text-sm space-y-1">
                                    <p>Generating {topPerformer.roas?.toFixed(2)}x ROAS with {formatCurrency(topPerformer.spend)} spend</p>
                                    {(topPerformer.roas ?? 0) >= 3 && (
                                      <p className="text-green-700 dark:text-green-200 font-medium">
                                        Strong performance. Consider scaling only if budget and capacity allow.
                                      </p>
                                    )}
                                    {(topPerformer.roas ?? 0) < 3 && (
                                      <p className="text-yellow-700 dark:text-yellow-200 font-medium">
                                        This is the strongest available source, but performance is not high enough to recommend scaling.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {bottomPerformer && bottomPerformer !== topPerformer && (
                                <div className={`p-4 rounded-lg ${(bottomPerformer.roas ?? 0) < 1 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
                                  <div className="flex items-center space-x-2 mb-2">
                                    <AlertTriangle className={`w-5 h-5 ${(bottomPerformer.roas ?? 0) < 1 ? 'text-red-600' : 'text-yellow-600'}`} />
                                    <h5 className={`font-medium ${(bottomPerformer.roas ?? 0) < 1 ? 'text-red-800 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
                                      Needs Attention: {bottomPerformer.name}
                                    </h5>
                                  </div>
                                  <div className="text-sm space-y-1">
                                    <p>Generating {bottomPerformer.roas?.toFixed(2)}x ROAS with {formatCurrency(bottomPerformer.spend)} spend</p>
                                    {(bottomPerformer.roas ?? 0) < 1 && (
                                      <p className="text-red-700 dark:text-red-200 font-medium">
                                        Below break-even. Review this source before increasing budget.
                                      </p>
                                    )}
                                    {(bottomPerformer.roas ?? 0) >= 1 && (bottomPerformer.roas ?? 0) < 3 && (
                                      <p className="text-yellow-700 dark:text-yellow-200 font-medium">
                                        Moderate performance. Test optimizations before shifting more spend here.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {platformsWithSpend.length === 1 && (
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <Target className="w-5 h-5 text-blue-600" />
                                    <h5 className="font-medium text-blue-800 dark:text-blue-300">Source Data Status</h5>
                                  </div>
                                  <p className="text-sm">
                                    {platformsWithSpend[0].name} is the only spend-capable connected source. Reallocation insights require at least two spend-capable sources.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Key Opportunities */}
                        <div className="mt-6">
                          <h4 className="font-semibold mb-4">Key Opportunities</h4>
                          <div className="space-y-3">
                            {isBudgetUnderutilized && hasStrongRoas && (
                              <div className="flex items-start space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                <DollarSign className="w-5 h-5 text-green-600 mt-0.5" />
                                <div>
                                  <p className="font-medium text-yellow-900 dark:text-yellow-100">Budget Underutilized</p>
                                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                    Only {formatPercentage(overviewBudgetUtilization)} of budget is utilized while ROAS is {financialRoasMetric.value.toFixed(2)}x. Review pacing and consider increasing spend only if campaign goals and source capacity support it.
                                  </p>
                                </div>
                              </div>
                            )}

                            {overviewCvrMetric.available && overviewCvrMetric.value < 5 && overviewConversionsMetric.available && overviewConversionsMetric.value > 10 && (
                              <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                                <Target className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div>
                                  <p className="font-medium">Conversion Rate Optimization</p>
                                  <p className="text-sm text-muted-foreground">
                                    Current CVR of {formatPercentage(overviewCvrMetric.value)} has room for improvement. Review landing page experience and offer relevance.
                                  </p>
                                </div>
                              </div>
                            )}

                            {overviewCtrMetric.available && overviewCtrMetric.value < 2 && (
                              <div className="flex items-start space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                                <Eye className="w-5 h-5 text-yellow-600 mt-0.5" />
                                <div>
                                  <p className="font-medium">Improve Ad Engagement</p>
                                  <p className="text-sm text-muted-foreground">
                                    CTR of {formatPercentage(overviewCtrMetric.value)} is low. Test new ad creative and messaging on connected paid-media sources.
                                  </p>
                                </div>
                              </div>
                            )}

                            {hasBudgetCapacity && financialRoasMetric.available && financialRoasMetric.value > 2 && (
                              <div className="flex items-start space-x-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
                                <TrendingUp className="w-5 h-5 text-purple-600 mt-0.5" />
                                <div>
                                  <p className="font-medium">Budget Capacity</p>
                                  <p className="text-sm text-muted-foreground">
                                    {formatPercentage(overviewBudgetUtilization)} budget utilized with positive ROAS. Check remaining budget before increasing allocation.
                                  </p>
                                </div>
                              </div>
                            )}

                            {platformsWithSpend.length === 0 && (
                              <div className="p-4 bg-muted rounded-lg text-center">
                                <p className="text-sm text-muted-foreground">
                                  No spend-capable connected ad platform is available. Financial totals can still use GA4 child spend inputs, but paid-media optimization insights require a connected ad platform.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Budget Optimization Recommendations */}
                        {hasMultiplePlatforms && (highPerformance.length > 0 || lowPerformance.length > 0) && (
                          <div className="mt-6">
                            <h4 className="font-semibold mb-4">Budget Optimization Recommendations</h4>
                            <div className="space-y-3">
                              {highPerformance.length > 0 && (
                                <div className="flex items-start space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded">
                                  <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
                                  <div>
                                    <p className="font-medium">Scale High-Performing Sources</p>
                                    <p className="text-sm text-muted-foreground">
                                      {highPerformance.map(p => p.name).join(', ')} {highPerformance.length === 1 ? 'is' : 'are'} generating ROAS &ge; 3.0x. Consider increasing allocation only if budget and capacity allow.
                                    </p>
                                  </div>
                                </div>
                              )}
                              {lowPerformance.length > 0 && (
                                <div className="flex items-start space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                                  <div>
                                    <p className="font-medium">Optimize Underperforming Sources</p>
                                    <p className="text-sm text-muted-foreground">
                                      {lowPerformance.map(p => p.name).join(', ')} showing ROAS below 1.0x. Review targeting, creative, and source setup before adding spend.
                                    </p>
                                  </div>
                                </div>
                              )}
                              {highPerformance.length > 0 && lowPerformance.length > 0 && (
                                <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                                  <Calculator className="w-5 h-5 text-blue-600 mt-0.5" />
                                  <div>
                                    <p className="font-medium">Budget Reallocation Opportunity</p>
                                    <p className="text-sm text-muted-foreground">
                                      Reallocating budget from lower-performing to higher-performing spend-capable sources could improve campaign ROAS.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Cost Optimization Insights */}
                        {(() => {
                          const costInsights: string[] = [];

                          if (overviewCtrMetric.available && overviewCtrMetric.value < 1) {
                            costInsights.push(`Click-through rate below 1% - test new ad creative and messaging on connected paid-media sources`);
                          } else if (overviewCtrMetric.available && overviewCtrMetric.value >= 3) {
                            costInsights.push(`Strong click-through rate of ${formatPercentage(overviewCtrMetric.value)} - paid-media engagement is performing well`);
                          }

                          if (overviewCvrMetric.available && overviewCvrMetric.value < 2) {
                            costInsights.push(`Conversion rate below 2% - review landing page experience and offer relevance`);
                          } else if (overviewCvrMetric.available && overviewCvrMetric.value >= 10) {
                            costInsights.push(`Excellent conversion rate of ${formatPercentage(overviewCvrMetric.value)} - landing page appears effective`);
                          }

                          if (overviewCpcMetric.available && overviewCpcMetric.value > 10) {
                            costInsights.push(`CPC of ${formatCurrency(overviewCpcMetric.value)} above average - refine audience targeting to reduce costs`);
                          } else if (overviewCpcMetric.available && overviewCpcMetric.value < 2) {
                            costInsights.push(`Low CPC of ${formatCurrency(overviewCpcMetric.value)} indicates efficient paid-media targeting`);
                          }

                          if (overviewCpmMetric.available && overviewCpmMetric.value < 5) {
                            costInsights.push(`CPM of ${formatCurrency(overviewCpmMetric.value)} is cost-efficient - strong reach per dollar spent`);
                          } else if (overviewCpmMetric.available && overviewCpmMetric.value > 30) {
                            costInsights.push(`CPM of ${formatCurrency(overviewCpmMetric.value)} above average - consider broadening paid-media audiences`);
                          }

                          if (overviewCpaMetric.available && overviewCpaMetric.value > 100) {
                            costInsights.push(`CPA of ${formatCurrency(overviewCpaMetric.value)} is high - review conversion funnel for drop-off points`);
                          } else if (overviewCpaMetric.available && overviewCpaMetric.value < 15) {
                            costInsights.push(`CPA of ${formatCurrency(overviewCpaMetric.value)} is excellent - acquisition costs are well controlled`);
                          }

                          return costInsights.length > 0 ? (
                            <div className="mt-6">
                              <h4 className="font-semibold mb-4">Cost Optimization Insights</h4>
                              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <ul className="space-y-2 text-sm">
                                  {costInsights.map((insight, index) => (
                                    <li key={index} className="flex items-start space-x-2">
                                      <Calculator className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                                      <span>{insight}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
