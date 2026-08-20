import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Activity, Users, Target, DollarSign, Clock, FlaskConical } from "lucide-react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { buildPerformanceRecommendedActions, resolvePerformanceAggregateMetricValue, resolvePerformanceHealthCoverage, resolvePerformanceLiveMetricValue, resolvePerformancePriorityRank } from "@/lib/performance-recommended-actions";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatPct } from "@shared/metric-math";
import {
  classifyKpiBandWithPolicy,
  computeBenchmarkThresholdResult,
  computeEffectiveDeltaPct,
  isLowerIsBetterKpi,
  resolveBenchmarkDataSufficiency,
  resolveKpiDataSufficiency,
  resolveKpiThresholdPolicy,
} from "@shared/kpi-math";
import { getGA4KpiMetricDependencies, resolveGA4KpiMetricIdentity } from "@shared/ga4-kpi-metric-identity";
import { resolveGA4KpiConsumerState, type GA4KpiInputState, type GA4KpiListState } from "@shared/ga4-kpi-consumer-state";

interface Campaign {
  id: string;
  name: string;
  budget?: string;
  status: string;
  reportingTimeZone?: string;
}

type PerformanceInsight = {
  type: string;
  priority: number;
  category: string;
  title: string;
  message: string;
};

const PERFORMANCE_SUMMARY_REFRESH_MS = 30000;
const PERFORMANCE_GA4_DAILY_DAYS = 31;
const resolveSpendComparisonEndDate = (dataThroughDate: string, timeRange: '24h' | '7d' | '30d') => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataThroughDate)) return "";
  const completedDate = new Date(`${dataThroughDate}T00:00:00.000Z`);
  if (Number.isNaN(completedDate.getTime()) || completedDate.toISOString().slice(0, 10) !== dataThroughDate) return "";
  if (timeRange !== '30d') {
    completedDate.setUTCDate(completedDate.getUTCDate() - (timeRange === '24h' ? 1 : 7));
    return completedDate.toISOString().slice(0, 10);
  }
  const day = completedDate.getUTCDate();
  completedDate.setUTCDate(1);
  completedDate.setUTCMonth(completedDate.getUTCMonth() - 1);
  const lastDay = new Date(Date.UTC(completedDate.getUTCFullYear(), completedDate.getUTCMonth() + 1, 0)).getUTCDate();
  completedDate.setUTCDate(Math.min(day, lastDay));
  return completedDate.toISOString().slice(0, 10);
};

export default function CampaignPerformanceSummary() {
  const [, params] = useRoute("/campaigns/:id/performance");
  const campaignId = params?.id;
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [demoMode, setDemoMode] = useState(false);
  const { toast } = useToast();

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  // Fetch campaign-scoped GA4 KPIs
  const { data: kpis = [], isLoading: kpisLoading, isError: kpisError } = useQuery<any[]>({
    queryKey: [`/api/platforms/google_analytics/kpis`, campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/google_analytics/kpis?campaignId=${encodeURIComponent(String(campaignId))}`);
      if (!response.ok) throw new Error("Failed to fetch GA4 KPIs");
      return response.json();
    },
  });

  // Fetch campaign-scoped GA4 Benchmarks
  const { data: benchmarks = [], isLoading: benchmarksLoading, isError: benchmarksError } = useQuery<any[]>({
    queryKey: [`/api/platforms/google_analytics/benchmarks`, campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/google_analytics/benchmarks?campaignId=${encodeURIComponent(String(campaignId))}`);
      if (!response.ok) throw new Error("Failed to fetch GA4 Benchmarks");
      return response.json();
    },
  });

  // Fetch LinkedIn metrics
  const { data: linkedinMetrics } = useQuery<any>({
    queryKey: ["/api/linkedin/metrics", campaignId],
    enabled: !!campaignId,
  });

  // Fetch Custom Integration data
  const { data: customIntegration } = useQuery<any>({
    queryKey: ["/api/custom-integration", campaignId],
    enabled: !!campaignId,
  });

  // Fetch Meta analytics
  const { data: metaAnalytics } = useQuery<any>({
    queryKey: ["/api/meta", campaignId, "analytics"],
    queryFn: async () => {
      const response = await fetch(`/api/meta/${campaignId}/analytics`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!campaignId,
  });

  // Fetch GA4 metrics
  const { data: ga4Metrics } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-metrics"],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-metrics`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!campaignId,
  });

  const { data: performanceGA4ConnectionsResponse, isLoading: performanceGA4ConnectionsLoading, isError: performanceGA4ConnectionsError } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-connections", "performance-summary-read-only"],
    enabled: !!campaignId && !demoMode,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-connections?readOnly=1`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data?.success === false) throw new Error(data?.error || "Failed to fetch GA4 connections");
      return data;
    },
  });
  const performanceGA4Connections = Array.isArray(performanceGA4ConnectionsResponse?.connections)
    ? performanceGA4ConnectionsResponse.connections
    : [];
  const performanceGA4PropertyId = String(
    (performanceGA4Connections.find((connection: any) => connection?.isPrimary) || performanceGA4Connections[0])?.propertyId || "",
  );
  const { data: performanceGA4SummaryResponse, isLoading: performanceGA4SummaryLoading, isError: performanceGA4SummaryError, isPlaceholderData: performanceGA4SummaryPlaceholder } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-daily", PERFORMANCE_GA4_DAILY_DAYS, performanceGA4PropertyId, "performance-summary-read-only"],
    enabled: !!campaignId && !!performanceGA4PropertyId && !demoMode,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-daily?days=${PERFORMANCE_GA4_DAILY_DAYS}&propertyId=${encodeURIComponent(performanceGA4PropertyId)}&readOnly=1`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data?.success === false || String(data?.propertyId || "") !== performanceGA4PropertyId) {
        throw new Error(data?.error || "Failed to fetch GA4 Summary metrics");
      }
      return data;
    },
  });
  const { data: performanceGA4ScoringTrafficResponse, isLoading: performanceGA4ScoringTrafficLoading, isError: performanceGA4ScoringTrafficError, isPlaceholderData: performanceGA4ScoringTrafficPlaceholder } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-breakdown", "30days", performanceGA4PropertyId, "performance-summary-scoring-read-only"],
    enabled: !!campaignId && !!performanceGA4PropertyId && !demoMode,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-breakdown?dateRange=30days&propertyId=${encodeURIComponent(performanceGA4PropertyId)}&readOnly=1`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data?.success === false || String(data?.propertyId || "") !== performanceGA4PropertyId || data?.endDate !== data?.dataThroughDate) {
        throw new Error(data?.error || "Failed to fetch live GA4 scoring metrics");
      }
      return data;
    },
  });
  const performanceGA4FinancialEndDate = performanceGA4ScoringTrafficPlaceholder ? "" : String(performanceGA4ScoringTrafficResponse?.dataThroughDate || "");
  const { data: performanceGA4RevenueResponse, isLoading: performanceGA4RevenueLoading, isError: performanceGA4RevenueError, isPlaceholderData: performanceGA4RevenuePlaceholder } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-total-revenue", performanceGA4PropertyId, performanceGA4FinancialEndDate, "performance-summary-read-only"],
    enabled: !!campaignId && !!performanceGA4PropertyId && !!performanceGA4FinancialEndDate && !demoMode,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const [nativeResponse, importedResponse] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}/ga4-to-date?propertyId=${encodeURIComponent(performanceGA4PropertyId)}&insightsScope=1&readOnly=1&endDate=${encodeURIComponent(performanceGA4FinancialEndDate)}`),
        fetch(`/api/campaigns/${campaignId}/revenue-to-date?platformContext=ga4&endDate=${encodeURIComponent(performanceGA4FinancialEndDate)}`),
      ]);
      const [native, imported] = await Promise.all([
        nativeResponse.json().catch(() => null),
        importedResponse.json().catch(() => null),
      ]);
      if (!nativeResponse.ok || !native || native?.success === false || String(native?.propertyId || "") !== performanceGA4PropertyId || native?.endDate !== performanceGA4FinancialEndDate) {
        throw new Error(native?.error || "Failed to fetch GA4 revenue");
      }
      if (!importedResponse.ok || !imported || imported?.success === false || imported?.platformContext !== "ga4" || imported?.endDate !== performanceGA4FinancialEndDate) {
        throw new Error(imported?.error || "Failed to fetch imported GA4 revenue");
      }
      return { native, imported };
    },
  });

  const { data: outcomeTotals, isLoading: outcomeTotalsLoading, isError: outcomeTotalsError } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/outcome-totals`, "90days", demoMode ? "demo" : "live"],
    queryFn: async () => {
      const url = `/api/campaigns/${campaignId}/outcome-totals?dateRange=90days${demoMode ? "&demo=1" : ""}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!campaignId,
    refetchInterval: PERFORMANCE_SUMMARY_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // Fetch real-time metric changes
  const { data: metricChanges } = useQuery<any>({
    queryKey: [`/api/custom-integration/${campaignId}/changes`],
    enabled: !!campaignId,
  });

  // Derive API params from unified time range
  const comparisonType = timeRange === '24h' ? 'yesterday' : timeRange === '7d' ? 'last_week' : 'last_month';
  const trendPeriod = timeRange === '24h' ? 'daily' : timeRange === '7d' ? 'weekly' : 'monthly';
  const spendComparisonEndDate = resolveSpendComparisonEndDate(String(performanceGA4SummaryResponse?.dataThroughDate || ""), timeRange);
  const revenueComparisonEndDate = resolveSpendComparisonEndDate(String(performanceGA4SummaryResponse?.dataThroughDate || ""), timeRange);
  const { data: historicalRevenueResponse } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-total-revenue-comparison", performanceGA4PropertyId, revenueComparisonEndDate],
    enabled: !!campaignId && !!performanceGA4PropertyId && !!revenueComparisonEndDate && !demoMode,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const [nativeResponse, importedResponse] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}/ga4-to-date?propertyId=${encodeURIComponent(performanceGA4PropertyId)}&insightsScope=1&readOnly=1&endDate=${encodeURIComponent(revenueComparisonEndDate)}`),
        fetch(`/api/campaigns/${campaignId}/revenue-to-date?platformContext=ga4&endDate=${encodeURIComponent(revenueComparisonEndDate)}`),
      ]);
      const [native, imported] = await Promise.all([
        nativeResponse.json().catch(() => null),
        importedResponse.json().catch(() => null),
      ]);
      if (!nativeResponse.ok || !native || native?.success === false || String(native?.propertyId || "") !== performanceGA4PropertyId || native?.endDate !== revenueComparisonEndDate) {
        throw new Error(native?.error || "Failed to fetch exact-date GA4 revenue");
      }
      if (!importedResponse.ok || !imported || imported?.success === false || imported?.platformContext !== "ga4" || imported?.endDate !== revenueComparisonEndDate) {
        throw new Error(imported?.error || "Failed to fetch exact-date imported GA4 revenue");
      }
      return { native, imported };
    },
  });
  const { data: performanceGA4SpendResponse, isLoading: performanceGA4SpendLoading, isError: performanceGA4SpendError, isPlaceholderData: performanceGA4SpendPlaceholder } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-spend-to-date", performanceGA4FinancialEndDate, "performance-summary-read-only"],
    enabled: !!campaignId && !!performanceGA4PropertyId && !!performanceGA4FinancialEndDate && !demoMode,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/spend-to-date?platformContext=ga4&endDate=${encodeURIComponent(performanceGA4FinancialEndDate)}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data?.success === false || data?.endDate !== performanceGA4FinancialEndDate) throw new Error(data?.error || "Failed to fetch exact-date GA4 spend");
      return data;
    },
  });
  const { data: historicalSpendComparison } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "snapshots", "spend-comparison", comparisonType, spendComparisonEndDate],
    enabled: !!campaignId && !!performanceGA4PropertyId && !!spendComparisonEndDate && !demoMode,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/snapshots/comparison?type=${comparisonType}&comparisonDate=${encodeURIComponent(spendComparisonEndDate)}`, { credentials: "include" });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.comparisonDate !== spendComparisonEndDate) throw new Error(data?.message || "Failed to fetch historical Spend");
      return data;
    },
  });

  // Fetch comparison data — keepPreviousData prevents UI flash when switching filters
  const { data: comparisonData } = useQuery<{
    current: any | null;
    previous: any | null;
  }>({
    queryKey: [`/api/campaigns/${campaignId}/snapshots/comparison?type=${comparisonType}`],
    enabled: !!campaignId,
    placeholderData: keepPreviousData,
    refetchInterval: PERFORMANCE_SUMMARY_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // Retain the existing compatible trend data for the non-rendered legacy chart path.
  const { data: trendSnapshots = [] } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaignId}/snapshots?period=${trendPeriod}`],
    enabled: !!campaignId,
    placeholderData: keepPreviousData,
    refetchInterval: PERFORMANCE_SUMMARY_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

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

  // Demo mode mock data
  const demoLinkedin = demoMode ? {
    impressions: 12500, clicks: 890, engagement: 1240, spend: 4250,
    conversions: 45, leads: 18, reach: 8200, engagements: 1240,
  } : null;
  const demoCI = demoMode ? {
    metrics: {
      impressions: 8500, clicks: 420, engagements: 580, spend: '1800',
      conversions: 28, leads: 12, pageviews: 15200, sessions: 3400,
      reach: 0,
    }
  } : null;
  const demoMeta = demoMode ? {
    summary: { totalImpressions: 28000, totalClicks: 1450, totalSpend: 3100, totalConversions: 62 }
  } : null;
  const demoGA4 = demoMode ? {
    metrics: { sessions: 4200, users: 2800, pageviews: 18500, conversions: 95, revenue: 12400 }
  } : null;
  const demoKpis = demoMode ? [
    { name: 'Monthly Conversions', metric: 'conversions', currentValue: 73, targetValue: 100, unit: '', alertsEnabled: false, priority: 'high' },
    { name: 'Cost Per Acquisition', metric: 'cpa', currentValue: 82.88, targetValue: 60, unit: '$', alertsEnabled: true, priority: 'high' },
    { name: 'Click-Through Rate', metric: 'ctr', currentValue: 4.2, targetValue: 3.5, unit: '%', alertsEnabled: false, priority: 'medium' },
  ] : null;
  const demoBenchmarks = demoMode ? [
    { metricName: 'CTR', currentValue: 4.2, industryAverage: 2.8, benchmarkValue: 2.8, category: 'Engagement' },
    { metricName: 'CPC', currentValue: 6.85, industryAverage: 8.50, benchmarkValue: 8.50, category: 'Cost' },
  ] : null;

  const effectiveLinkedin = demoLinkedin || linkedinMetrics;
  const effectiveCI = demoCI || customIntegration;
  const effectiveMeta = demoMeta || metaAnalytics;
  const effectiveGA4 = demoGA4 || ga4Metrics;
  const effectiveKpis = demoKpis || kpis;
  const effectiveBenchmarks = demoBenchmarks || benchmarks;
  const performanceSummary = outcomeTotals?.performanceSummary;
  const performanceSummaryPending = !!campaignId && !performanceSummary && outcomeTotalsLoading;
  const performanceSources = Array.isArray(performanceSummary?.sources) ? performanceSummary.sources : [];

  // Helper function to safely parse numbers
  const parseNum = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    const num = typeof val === 'string' ? parseFloat(val) : Number(val);
    return isNaN(num) || !isFinite(num) ? 0 : num;
  };
  const formatMetricValue = (value: any, unit: string) => {
    const normalizedUnit = String(unit || '').toLowerCase();
    if (unit === '$') return `$${parseNum(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (unit === '%') {
      const rounded = Math.round(parseNum(value) * 100) / 100;
      return `${rounded.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}%`;
    }
    if (!unit || normalizedUnit === 'count') return parseNum(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (normalizedUnit === 'ratio') return parseNum(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
    return `${parseNum(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}${unit}`;
  };

  // Calculate aggregated metrics
  const linkedinImpressions = parseNum(effectiveLinkedin?.impressions);
  const linkedinClicks = parseNum(effectiveLinkedin?.clicks);
  const linkedinEngagements = parseNum(effectiveLinkedin?.engagement);
  const linkedinSpend = parseNum(effectiveLinkedin?.spend);
  const linkedinConversions = parseNum(effectiveLinkedin?.conversions);
  const linkedinLeads = parseNum(effectiveLinkedin?.leads);

  // Custom Integration advertising metrics
  const ciImpressions = parseNum(effectiveCI?.metrics?.impressions);
  const ciClicks = parseNum(effectiveCI?.metrics?.clicks);
  const ciEngagements = parseNum(effectiveCI?.metrics?.engagements);
  const ciSpend = parseNum(effectiveCI?.metrics?.spend);
  const ciConversions = parseNum(effectiveCI?.metrics?.conversions);
  const ciLeads = parseNum(effectiveCI?.metrics?.leads);

  // Custom Integration website analytics (for funnel visualization)
  const ciPageviews = parseNum(effectiveCI?.metrics?.pageviews);
  const ciSessions = parseNum(effectiveCI?.metrics?.sessions);

  // Meta advertising metrics
  const metaImpressions = parseNum(effectiveMeta?.summary?.totalImpressions);
  const metaClicks = parseNum(effectiveMeta?.summary?.totalClicks);
  const metaSpend = parseNum(effectiveMeta?.summary?.totalSpend);
  const metaConversions = parseNum(effectiveMeta?.summary?.totalConversions);

  // GA4 website analytics
  const ga4Sessions = parseNum(effectiveGA4?.metrics?.sessions);
  const ga4Pageviews = parseNum(effectiveGA4?.metrics?.pageviews);
  const ga4Connected = !!(effectiveGA4?.metrics);

  // Double-counting prevention: GA4 and CI both track website analytics.
  // When GA4 is connected, prefer GA4 for web metrics; otherwise use CI.
  const webPageviews = ga4Connected ? ga4Pageviews : ciPageviews;
  const webSessions = ga4Connected ? ga4Sessions : ciSessions;

  // Advertising metrics: LinkedIn + CI(ads) + Meta — no overlap
  const advertisingImpressions = linkedinImpressions + ciImpressions + metaImpressions;
  const totalImpressions = advertisingImpressions + webPageviews;
  const advertisingEngagements = linkedinClicks + linkedinEngagements + ciClicks + ciEngagements + metaClicks;
  const totalEngagements = advertisingEngagements + webSessions;
  const totalClicks = linkedinClicks + ciClicks + metaClicks;
  const totalConversions = linkedinConversions + ciConversions + metaConversions;
  const totalLeads = linkedinLeads + ciLeads;
  const totalSpend = linkedinSpend + ciSpend + metaSpend;

  const parseScoringNumber = (value: any): number | null => {
    const raw = String(value ?? '').replace(/,/g, '').trim();
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const kpiListState: GA4KpiListState = demoMode ? "ready" : kpisLoading ? "loading" : kpisError ? (kpis.length > 0 ? "stale" : "failed") : "ready";
  const benchmarkListState: GA4KpiListState = demoMode ? "ready" : benchmarksLoading ? "loading" : benchmarksError ? (benchmarks.length > 0 ? "stale" : "failed") : "ready";
  const trafficInputState: GA4KpiInputState = demoMode
    ? "ready"
    : performanceGA4ConnectionsLoading || (!!performanceGA4PropertyId && (performanceGA4ScoringTrafficLoading || performanceGA4ScoringTrafficPlaceholder))
      ? "loading"
      : performanceGA4ScoringTrafficError && performanceGA4ScoringTrafficResponse
        ? "stale"
        : performanceGA4ConnectionsError || performanceGA4ScoringTrafficError || !performanceGA4PropertyId || !performanceGA4ScoringTrafficResponse
        ? "unavailable"
        : "ready";
  const nativeRevenue = Number(performanceGA4RevenueResponse?.native?.totals?.revenue);
  const importedRevenue = Number(performanceGA4RevenueResponse?.imported?.totalRevenue);
  const hasNativeRevenue = !!String(performanceGA4RevenueResponse?.native?.revenueMetric || '').trim() || (Number.isFinite(nativeRevenue) && nativeRevenue !== 0);
  const hasImportedRevenue = Array.isArray(performanceGA4RevenueResponse?.imported?.sourceIds) && performanceGA4RevenueResponse.imported.sourceIds.length > 0;
  const revenueInputState: GA4KpiInputState = demoMode
    ? "ready"
    : performanceGA4ConnectionsLoading || performanceGA4ScoringTrafficLoading || performanceGA4ScoringTrafficPlaceholder || (!!performanceGA4PropertyId && (performanceGA4RevenueLoading || performanceGA4RevenuePlaceholder))
      ? "loading"
      : performanceGA4RevenueError && performanceGA4RevenueResponse
        ? "stale"
      : performanceGA4ConnectionsError || performanceGA4ScoringTrafficError || performanceGA4RevenueError || !performanceGA4PropertyId || !performanceGA4RevenueResponse || performanceGA4RevenueResponse?.native?.endDate !== performanceGA4FinancialEndDate || performanceGA4RevenueResponse?.imported?.endDate !== performanceGA4FinancialEndDate || !Number.isFinite(nativeRevenue) || !Number.isFinite(importedRevenue) || (!hasNativeRevenue && !hasImportedRevenue)
        ? "unavailable"
        : "ready";
  const financialConversionsInputState: GA4KpiInputState = demoMode
    ? "ready"
    : performanceGA4ConnectionsLoading || performanceGA4ScoringTrafficLoading || performanceGA4ScoringTrafficPlaceholder || (!!performanceGA4PropertyId && (performanceGA4RevenueLoading || performanceGA4RevenuePlaceholder))
      ? "loading"
      : performanceGA4RevenueError && performanceGA4RevenueResponse
        ? "stale"
        : performanceGA4ConnectionsError || performanceGA4ScoringTrafficError || performanceGA4RevenueError || !performanceGA4PropertyId || performanceGA4RevenueResponse?.native?.endDate !== performanceGA4FinancialEndDate || !Number.isFinite(Number(performanceGA4RevenueResponse?.native?.totals?.conversions))
          ? "unavailable"
          : "ready";
  const spendSummaryMetric = performanceSummary?.totals?.spend;
  const scoringSpendToDate = Number(performanceGA4SpendResponse?.spendToDate);
  const spendInputState: GA4KpiInputState = demoMode
    ? "ready"
    : performanceGA4ConnectionsLoading || performanceGA4ScoringTrafficLoading || performanceGA4ScoringTrafficPlaceholder || performanceGA4SpendLoading || performanceGA4SpendPlaceholder
      ? "loading"
      : performanceGA4SpendError && performanceGA4SpendResponse
        ? "stale"
        : performanceGA4ConnectionsError || performanceGA4ScoringTrafficError || performanceGA4SpendError || !performanceGA4PropertyId || !performanceGA4SpendResponse || performanceGA4SpendResponse?.endDate !== performanceGA4FinancialEndDate || !Number.isFinite(scoringSpendToDate) || !Array.isArray(performanceGA4SpendResponse?.sourceIds) || performanceGA4SpendResponse.sourceIds.length === 0
        ? "unavailable"
        : "ready";
  const liveScoringTrafficTotals = performanceGA4ScoringTrafficResponse?.totals || {};
  const scoringTrafficTotals = demoMode
    ? {
        sessions: parseNum(effectiveGA4?.metrics?.sessions),
        users: parseNum(effectiveGA4?.metrics?.users),
        conversions: parseNum(effectiveGA4?.metrics?.conversions),
        pageviews: parseNum(effectiveGA4?.metrics?.pageviews),
        engagedSessions: 0,
      }
    : {
        sessions: Number(liveScoringTrafficTotals.sessions),
        users: Number(liveScoringTrafficTotals.users),
        conversions: Number(liveScoringTrafficTotals.conversions),
        pageviews: Number(liveScoringTrafficTotals.pageviews),
        engagedSessions: Number(liveScoringTrafficTotals.engagedSessions),
      };
  const scoringTrafficMetricAvailability: Record<string, boolean> = demoMode
    ? { sessions: true, users: true, conversions: true, pageviews: true, conversion_rate: true, engagement_rate: true }
    : {
        sessions: Number.isFinite(scoringTrafficTotals.sessions),
        users: Number.isFinite(scoringTrafficTotals.users),
        conversions: Number.isFinite(scoringTrafficTotals.conversions),
        pageviews: Number.isFinite(scoringTrafficTotals.pageviews),
        conversion_rate: Number.isFinite(scoringTrafficTotals.sessions) && Number.isFinite(scoringTrafficTotals.conversions),
        engagement_rate: Number.isFinite(scoringTrafficTotals.sessions) && Number.isFinite(scoringTrafficTotals.engagedSessions),
      };
  const scoringSessions = demoMode
    ? parseNum(effectiveGA4?.metrics?.sessions)
    : scoringTrafficTotals.sessions;
  const scoringFinancialConversions = demoMode
    ? parseNum(effectiveGA4?.metrics?.conversions)
    : parseNum(performanceGA4RevenueResponse?.native?.totals?.conversions);
  const scoringSpend = demoMode ? totalSpend : scoringSpendToDate;
  const scoringRevenue = demoMode ? parseNum(effectiveGA4?.metrics?.revenue) : nativeRevenue + importedRevenue;
  const getLiveScoringValue = (item: any) => resolvePerformanceLiveMetricValue({
    item,
    trafficTotals: scoringTrafficTotals,
    financialRevenue: scoringRevenue,
    financialSpend: scoringSpend,
    financialConversions: scoringFinancialConversions,
  });
  const getScoringTrafficInputState = (item: any): GA4KpiInputState => {
    const identity = resolveGA4KpiMetricIdentity(item?.metric, item?.metricName, item?.name);
    if (identity === "cpa") return financialConversionsInputState;
    return identity && scoringTrafficMetricAvailability[identity] === false ? "unavailable" : trafficInputState;
  };
  const recommendedActions = buildPerformanceRecommendedActions({
    kpis: effectiveKpis,
    benchmarks: effectiveBenchmarks,
    kpiListState,
    benchmarkListState,
    trafficState: trafficInputState,
    revenueState: revenueInputState,
    spendState: spendInputState,
    financialConversionsState: financialConversionsInputState,
    trafficTotals: scoringTrafficTotals,
    trafficMetricAvailability: scoringTrafficMetricAvailability,
    financialRevenue: scoringRevenue,
    financialSpend: scoringSpend,
    financialConversions: scoringFinancialConversions,
  });
  const getScoringMissingDependencies = (item: any) => {
    const dependencies = getGA4KpiMetricDependencies(item?.metric, item?.metricName, item?.name);
    const missing: string[] = [];
    if (dependencies.requiresRevenue && revenueInputState === "unavailable") missing.push("Revenue");
    if (dependencies.requiresSpend && spendInputState === "unavailable") missing.push("Spend");
    return missing;
  };
  const getKpiScore = (kpi: any, currentOverride?: number | null) => {
    const identity = resolveGA4KpiMetricIdentity(kpi?.metric, kpi?.metricName, kpi?.name);
    const sufficiency = resolveKpiDataSufficiency({
      metric: kpi?.metric,
      name: kpi?.name,
      sessions: scoringSessions,
      conversions: identity === "cpa" ? scoringFinancialConversions : scoringTrafficTotals.conversions,
      spend: scoringSpend,
    });
    const consumerState = resolveGA4KpiConsumerState({
      metric: kpi?.metric,
      name: kpi?.name,
      listState: kpiListState,
      trafficState: getScoringTrafficInputState(kpi),
      revenueState: revenueInputState,
      spendState: spendInputState,
      missingDependencies: getScoringMissingDependencies(kpi),
      sufficiencyReason: sufficiency.sufficient ? null : sufficiency.reason || "Required denominator data is not available.",
    });
    const current = currentOverride === undefined ? getLiveScoringValue(kpi) : currentOverride;
    const target = parseScoringNumber(kpi?.targetValue);
    if (!consumerState.eligible || current === null || target === null || target <= 0) return null;
    const lowerIsBetter = isLowerIsBetterKpi({ metric: kpi?.metric, name: kpi?.name });
    const policy = resolveKpiThresholdPolicy({ metric: kpi?.metric, name: kpi?.name, unit: kpi?.unit, current, target, lowerIsBetter });
    const band = classifyKpiBandWithPolicy({ current, target, lowerIsBetter, policy });
    const effectiveDeltaPct = computeEffectiveDeltaPct({ current, target, lowerIsBetter });
    return band && effectiveDeltaPct !== null ? { band, effectiveDeltaPct, current, target } : null;
  };
  const getBenchmarkScore = (benchmark: any, currentOverride?: number | null) => {
    const metric = benchmark?.metric || benchmark?.metricName || benchmark?.name;
    const name = benchmark?.name || benchmark?.metricName;
    const identity = resolveGA4KpiMetricIdentity(metric, name);
    const sufficiency = resolveBenchmarkDataSufficiency({
      metric,
      name,
      sessions: scoringSessions,
      conversions: identity === "cpa" ? scoringFinancialConversions : scoringTrafficTotals.conversions,
      spend: scoringSpend,
    });
    const consumerState = resolveGA4KpiConsumerState({
      metric,
      name,
      listState: benchmarkListState,
      trafficState: getScoringTrafficInputState(benchmark),
      revenueState: revenueInputState,
      spendState: spendInputState,
      missingDependencies: getScoringMissingDependencies(benchmark),
      sufficiencyReason: sufficiency.sufficient ? null : sufficiency.reason || "Required denominator data is not available.",
      entityLabel: "Benchmark",
    });
    const current = currentOverride === undefined ? getLiveScoringValue(benchmark) : currentOverride;
    const benchmarkValue = parseScoringNumber(benchmark?.benchmarkValue ?? benchmark?.industryAverage);
    if (!consumerState.eligible || current === null || benchmarkValue === null || benchmarkValue <= 0) return null;
    const result = computeBenchmarkThresholdResult({ metric, name, unit: benchmark?.unit, current, benchmarkValue });
    return result.status ? { ...result, current, target: benchmarkValue } : null;
  };

  // Score only verified GA4 records using the same immutable policies as the GA4 trackers.
  const scoredKpis = effectiveKpis.map((item: any) => ({ item, score: getKpiScore(item) })).filter((entry: any) => entry.score !== null);
  const scoredBenchmarks = effectiveBenchmarks.map((item: any) => ({ item, score: getBenchmarkScore(item) })).filter((entry: any) => entry.score !== null);
  const kpisOnTrackOrAbove = scoredKpis.filter((entry: any) => entry.score.band === "above" || entry.score.band === "near").length;
  const benchmarksOnTrack = scoredBenchmarks.filter((entry: any) => entry.score.status === "on_track").length;
  const healthCoverage = resolvePerformanceHealthCoverage({
    configuredKpiCount: effectiveKpis.length,
    configuredBenchmarkCount: effectiveBenchmarks.length,
    scoredKpiCount: scoredKpis.length,
    scoredBenchmarkCount: scoredBenchmarks.length,
    kpisOnTrack: kpisOnTrackOrAbove,
    benchmarksOnTrack,
  });
  const configuredMetricCount = healthCoverage.configuredMetricCount;
  const totalMetrics = healthCoverage.verifiedMetricCount;
  const excludedMetricCount = healthCoverage.excludedMetricCount;
  const scoringListsUnavailable = !demoMode && (kpisLoading || benchmarksLoading || kpisError || benchmarksError);
  const totalOnTrackMetrics = healthCoverage.totalOnTrackMetrics;
  const healthScore = healthCoverage.healthScore ?? 0;

  const getHealthStatus = () => {
    if (excludedMetricCount > 0) return { label: "Verification Needed", color: "bg-amber-500", icon: AlertTriangle };
    if (healthScore >= 80) return { label: "Excellent", color: "bg-green-500", icon: CheckCircle2 };
    if (healthScore >= 60) return { label: "Good", color: "bg-blue-500", icon: Activity };
    if (healthScore >= 40) return { label: "Needs Attention", color: "bg-yellow-500", icon: AlertTriangle };
    return { label: "Critical", color: "bg-red-500", icon: AlertTriangle };
  };

  const healthStatus = getHealthStatus();
  const HealthIcon = healthStatus.icon;
  const aggregateMetric = (metricName: string) => performanceSummary?.totals?.[metricName];
  const aggregateMetricAvailable = (metricName: string) => {
    const metric = aggregateMetric(metricName);
    return metric?.available && metric?.value !== null;
  };
  const aggregateMetricValue = (metricName: string) => {
    const metric = aggregateMetric(metricName);
    return metric?.available && metric?.value !== null ? parseNum(metric.value) : 0;
  };
  const sourceHasMetric = (source: any, metricName: string) =>
    Array.isArray(source?.includedMetrics) && source.includedMetrics.includes(metricName);
  const sourceMetricValue = (source: any, metricName: string) => parseNum(source?.metrics?.[metricName]);
  const formatCurrencyValue = (value: number) =>
    `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatNumberValue = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const exactDateWindowKey = (startValue: any, endValue: any) => {
    const start = String(startValue || '').trim().slice(0, 10);
    const end = String(endValue || '').trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)
      ? `${start}:${end}`
      : null;
  };
  const targetRecords = [
    ...effectiveKpis.map((target: any) => ({
      metric: resolveGA4KpiMetricIdentity(target?.metric, target?.name),
      value: parseScoringNumber(target?.targetValue),
      window: exactDateWindowKey(target?.periodStart ?? target?.windowStart, target?.periodEnd ?? target?.windowEnd),
    })),
    ...effectiveBenchmarks.map((target: any) => ({
      metric: resolveGA4KpiMetricIdentity(target?.metric, target?.name),
      value: parseScoringNumber(target?.benchmarkValue),
      window: exactDateWindowKey(target?.periodStart ?? target?.windowStart, target?.periodEnd ?? target?.windowEnd),
    })),
  ].filter((target) => target.metric && target.value !== null && target.value > 0);
  const resolveTargetComparison = (metricIdentity: string, aggregateMetricName: string, label: string) => {
    if (!demoMode && (kpisLoading || benchmarksLoading || kpisError || benchmarksError)) {
      return { comparable: false as const, reason: `target data for ${label} is not fully available.` };
    }
    const targets = targetRecords.filter((target) => target.metric === metricIdentity);
    if (targets.length === 0) return { comparable: false as const, reason: `no target is configured for ${label}.` };
    if (targets.length > 1) return { comparable: false as const, reason: `${targets.length} targets are configured for ${label}, so no single target can be applied.` };
    const aggregate = aggregateMetric(aggregateMetricName);
    const aggregateWindow = exactDateWindowKey(aggregate?.periodStart ?? aggregate?.windowStart, aggregate?.periodEnd ?? aggregate?.windowEnd);
    const targetWindow = targets[0].window;
    if (!aggregateWindow || !targetWindow) {
      return { comparable: false as const, reason: `the current aggregate and target do not expose the same exact date window for ${label}.` };
    }
    if (aggregateWindow !== targetWindow) {
      return { comparable: false as const, reason: `the ${label} target and current aggregate use different periods.` };
    }
    return { comparable: true as const, targetValue: targets[0].value! };
  };
  const buildPerformanceInsights = () => {
    const insights: PerformanceInsight[] = [];
    const pushInsight = (insight: PerformanceInsight) => insights.push(insight);
    const finalizeInsights = () => {
      const byCategory = new Map<string, PerformanceInsight>();
      for (const insight of insights) {
        const existing = byCategory.get(insight.category);
        if (!existing || insight.priority < existing.priority) {
          byCategory.set(insight.category, insight);
        }
      }
      return Array.from(byCategory.values())
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 5);
    };

    if (!performanceSummary) {
      pushInsight({
        type: 'info',
        priority: 5,
        category: 'summary',
        title: 'Campaign Summary',
        message: `Tracking ${totalImpressions.toLocaleString()} total impressions, ${totalEngagements.toLocaleString()} engagements, and ${totalConversions.toLocaleString()} conversions from $${totalSpend.toLocaleString()} spend across connected platforms.`
      });
      return finalizeInsights();
    }

    const paidSources = performanceSources
      .filter((source: any) => source?.category === 'paid_media' || source?.category === 'custom')
      .filter((source: any) => ['impressions', 'clicks', 'spend', 'conversions', 'leads'].some((metric) => sourceHasMetric(source, metric)))
      .map((source: any) => {
        const spend = sourceMetricValue(source, 'spend');
        const clicks = sourceMetricValue(source, 'clicks');
        const impressions = sourceMetricValue(source, 'impressions');
        const conversions = sourceMetricValue(source, 'conversions');
        return {
          id: source.id,
          label: source.label || source.id || 'Paid source',
          spend,
          clicks,
          impressions,
          conversions,
          cpa: spend > 0 && conversions > 0 ? spend / conversions : null,
          cvr: clicks > 0 && conversions > 0 ? (conversions / clicks) * 100 : null,
          ctr: impressions > 0 && clicks > 0 ? (clicks / impressions) * 100 : null,
        };
      });

    const webSources = performanceSources.filter((source: any) =>
      source?.category === 'web_analytics' || sourceHasMetric(source, 'sessions') || sourceHasMetric(source, 'users')
    );

    const efficiencySources = paidSources.filter((source: any) => source.cpa !== null);
    if (efficiencySources.length >= 2) {
      const ranked = [...efficiencySources].sort((a: any, b: any) => (a.cpa || 0) - (b.cpa || 0));
      const best = ranked[0];
      const worst = ranked[ranked.length - 1];
      pushInsight({
        type: best.cpa! < worst.cpa! * 0.85 ? 'success' : 'info',
        priority: best.cpa! < worst.cpa! * 0.85 ? 2 : 4,
        category: 'paid-efficiency',
        title: best.cpa! < worst.cpa! * 0.85 ? 'Paid Source Efficiency Gap' : 'Paid Sources Performing Similarly',
        message: `${best.label} has the lowest CPA at ${formatCurrencyValue(best.cpa!)}. Compare spend efficiency before shifting budget: ${ranked.map((source: any) => `${source.label} ${formatCurrencyValue(source.cpa!)}`).join(', ')}.`
      });
    } else if (efficiencySources.length === 1) {
      const source = efficiencySources[0];
      pushInsight({
        type: 'info',
        priority: 4,
        category: 'paid-efficiency',
        title: `${source.label} Paid Performance`,
        message: `${source.label} generated ${formatNumberValue(source.conversions)} conversions from ${formatCurrencyValue(source.spend)} spend at ${formatCurrencyValue(source.cpa!)} CPA. Use this as the current paid-source efficiency baseline.`
      });
    }

    if (aggregateMetricAvailable('ctr')) {
      const ctr = aggregateMetricValue('ctr');
      pushInsight({
        type: ctr >= 2 ? 'success' : ctr < 1 ? 'warning' : 'info',
        priority: ctr < 1 ? 1 : ctr >= 2 ? 4 : 3,
        category: 'paid-engagement',
        title: ctr >= 2 ? 'Strong Click-Through Rate' : ctr < 1 ? 'Low Click-Through Rate' : 'Click-Through Rate',
        message: `Aggregate CTR is ${formatPct(ctr)} from ${formatNumberValue(aggregateMetricValue('clicks'))} clicks and ${formatNumberValue(aggregateMetricValue('impressions'))} impressions across eligible paid sources. ${ctr < 1 ? 'Review creative, targeting, and offer clarity first.' : 'Use this as paid engagement context.'}`
      });
    }

    if (aggregateMetricAvailable('cvr')) {
      const cvr = aggregateMetricValue('cvr');
      const cvrSources = Array.isArray(aggregateMetric('cvr')?.sources) ? aggregateMetric('cvr').sources : [];
      const usesSessions = cvrSources.includes('sessions') && !cvrSources.includes('clicks');
      if (usesSessions) {
        const targetComparison = resolveTargetComparison('conversion_rate', 'cvr', 'Key Events per Session');
        const targetGuidance = targetComparison.comparable
          ? cvr >= targetComparison.targetValue
            ? `This meets the verified ${formatPct(targetComparison.targetValue)} target for the same period.`
            : `This is below the verified ${formatPct(targetComparison.targetValue)} target for the same period; review the conversion path before changing spend.`
          : `No action recommended: ${targetComparison.reason}`;
        pushInsight({
          type: 'info',
          priority: 3,
          category: 'conversion-efficiency',
          title: 'Key Events per Session',
          message: `${formatPct(cvr)}: ${formatNumberValue(aggregateMetricValue('conversions'))} key events across ${formatNumberValue(aggregateMetricValue('sessions'))} sessions. ${targetGuidance}`
        });
      }
    }

    if (aggregateMetricAvailable('cpa')) {
      pushInsight({
        type: 'info',
        priority: 3,
        category: 'conversion-efficiency',
        title: 'Cost Per Acquisition',
        message: `Aggregate CPA is ${formatCurrencyValue(aggregateMetricValue('cpa'))} from ${formatCurrencyValue(aggregateMetricValue('spend'))} spend and ${formatNumberValue(aggregateMetricValue('conversions'))} conversions. Track this against your GA4 KPI or Benchmark before scaling spend.`
      });
    }

    if (aggregateMetricAvailable('roas') || aggregateMetricAvailable('roi')) {
      const parts = [];
      const targetComparisons = [];
      if (aggregateMetricAvailable('roas')) parts.push(`ROAS ${aggregateMetricValue('roas').toLocaleString('en-US', { maximumFractionDigits: 2 })}x`);
      if (aggregateMetricAvailable('roi')) parts.push(`ROI ${formatPct(aggregateMetricValue('roi'))}`);
      if (aggregateMetricAvailable('roas')) targetComparisons.push(resolveTargetComparison('roas', 'roas', 'ROAS'));
      if (aggregateMetricAvailable('roi')) targetComparisons.push(resolveTargetComparison('roi', 'roi', 'ROI'));
      const blockedTarget = targetComparisons.find((comparison) => !comparison.comparable);
      pushInsight({
        type: 'info',
        priority: 2,
        category: 'revenue-efficiency',
        title: 'Revenue Efficiency',
        message: `${parts.join(' and ')} based on available revenue and spend inputs. ${blockedTarget ? `No action recommended: ${blockedTarget.reason}` : 'The configured targets use the same verified period and can be evaluated safely.'}`
      });
    } else if (aggregateMetricAvailable('revenue')) {
      pushInsight({
        type: 'info',
        priority: 3,
        category: 'revenue-efficiency',
        title: 'Revenue Tracked',
        message: `${formatCurrencyValue(aggregateMetricValue('revenue'))} revenue is available. ROAS and ROI are not shown unless both revenue and spend are available, so connect spend before judging revenue efficiency.`
      });
    }

    const paidSpendSources = paidSources.filter((source: any) => source.spend > 0);
    if (paidSpendSources.length > 0 && aggregateMetricAvailable('spend')) {
      const spend = aggregateMetricValue('spend');
      pushInsight({
        type: 'info',
        priority: 4,
        category: 'budget-allocation',
        title: 'Budget Allocation',
        message: `${paidSpendSources.map((source: any) => `${source.label}: ${formatCurrencyValue(source.spend)} (${spend > 0 ? ((source.spend / spend) * 100).toFixed(1) : '0.0'}%)`).join(', ')}. Total spend: ${formatCurrencyValue(spend)}. Use this to confirm budget concentration across connected paid sources.`
      });
    }

    if (webSources.length > 0 && aggregateMetricAvailable('sessions')) {
      const sourceLabels = webSources.map((source: any) => source?.label || source?.id).filter(Boolean).join(', ');
      const sessionText = `${formatNumberValue(aggregateMetricValue('sessions'))} sessions`;
      const userText = aggregateMetricAvailable('users') ? ` and ${formatNumberValue(aggregateMetricValue('users'))} users` : '';
      const conversionText = aggregateMetricAvailable('conversions') ? ` with ${formatNumberValue(aggregateMetricValue('conversions'))} conversions` : '';
      pushInsight({
        type: 'info',
        priority: 3,
        category: 'web-outcomes',
        title: 'Web Analytics Outcomes',
        message: `${sourceLabels} contributed ${sessionText}${userText}${conversionText}. Use this as the campaign outcome context from connected web analytics.`
      });
    }

    if (healthScore >= 80) {
      pushInsight({
        type: 'success',
        priority: 4,
        category: 'campaign-health',
        title: 'Campaign Health Excellent',
        message: `${healthScore}% health score with ${totalOnTrackMetrics} of ${totalMetrics} metrics on track. Campaign performing above expectations.`
      });
    } else if (healthScore < 60) {
      pushInsight({
        type: 'warning',
        priority: 1,
        category: 'campaign-health',
        title: 'Campaign Requires Attention',
        message: `${healthScore}% health score - only ${totalOnTrackMetrics} of ${totalMetrics} metrics on track. Focus on underperforming GA4 KPIs to improve results.`
      });
    }

    if (insights.length === 0) {
      const availableMetrics = ['impressions', 'sessions', 'conversions', 'spend', 'revenue']
        .filter(aggregateMetricAvailable)
        .map((metricName) => `${metricName}: ${formatNumberValue(aggregateMetricValue(metricName))}`);
      pushInsight({
        type: 'info',
        priority: 5,
        category: 'summary',
        title: 'Campaign Summary',
        message: availableMetrics.length > 0
          ? `Available aggregate metrics: ${availableMetrics.join(', ')}.`
          : 'No eligible connected-source metrics are available for insight generation yet.'
      });
    }

    return finalizeInsights();
  };

  // Get top priority action
  const getPriorityAction = () => {
    const hasPriorityActionMetrics = performanceSummary
      ? Object.values(performanceSummary?.totals || {}).some((metric: any) => metric?.available === true && metric?.value !== null)
      : true;

    if (!hasPriorityActionMetrics) {
      return {
        type: 'info',
        message: 'No connected-source metrics available. Connect a source to generate a priority action.'
      };
    }

    if (!scoringListsUnavailable && configuredMetricCount === 0) {
      return {
        type: 'info',
        message: 'No GA4 KPI or Benchmark targets configured. Add them in View Detailed Analytics to generate a priority action.'
      };
    }

    if (scoringListsUnavailable || totalMetrics === 0) {
      return {
        type: 'info',
        message: 'Configured GA4 KPI and Benchmark targets are currently unavailable or unscorable.'
      };
    }

    if (excludedMetricCount > 0) {
      return {
        type: 'info',
        message: `Verify ${excludedMetricCount} configured metric${excludedMetricCount === 1 ? '' : 's'} before acting - only ${totalMetrics} of ${configuredMetricCount} currently have verified inputs.`
      };
    }

    const targetSetupAction = recommendedActions.find((action) => action.category === "invalid-targets");
    if (targetSetupAction) {
      return {
        type: 'info',
        message: `${targetSetupAction.title}: ${targetSetupAction.message}`
      };
    }

    const priorityScoredKpis = effectiveKpis
      .map((item: any) => ({
        item,
        score: getKpiScore(item, resolvePerformanceAggregateMetricValue(item, performanceSummary?.totals) ?? getLiveScoringValue(item)),
      }))
      .filter((entry: any) => entry.score !== null);
    const priorityScoredBenchmarks = effectiveBenchmarks
      .map((item: any) => ({
        item,
        score: getBenchmarkScore(item, resolvePerformanceAggregateMetricValue(item, performanceSummary?.totals) ?? getLiveScoringValue(item)),
      }))
      .filter((entry: any) => entry.score !== null);
    const laggingKPIs = priorityScoredKpis
      .filter((entry: any) => entry.score.band === "below")
      .map((entry: any) => ({ type: 'kpi', item: entry.item, score: entry.score, priorityRank: resolvePerformancePriorityRank(entry.item?.priority), severity: Math.abs(entry.score.effectiveDeltaPct) }));

    const laggingBenchmarks = priorityScoredBenchmarks
      .filter((entry: any) => entry.score.status !== "on_track")
      .map((entry: any) => ({ type: 'benchmark', item: entry.item, severity: Math.abs(entry.score.effectiveDeltaPct || 0), status: entry.score.status }));

    const topLaggingKPI = laggingKPIs.sort((a: any, b: any) => a.priorityRank - b.priorityRank || b.severity - a.severity)[0];

    if (topLaggingKPI) {
      const topKPI = topLaggingKPI.item;
      
      return {
        type: 'kpi',
        name: topKPI.name,
        metric: topKPI.metric || topKPI.name,
        currentValue: formatMetricValue(topLaggingKPI.score.current, topKPI.unit),
        targetValue: formatMetricValue(topLaggingKPI.score.target, topKPI.unit),
        action: 'Improve'
      };
    }

    const topCandidate: any = laggingBenchmarks.sort((a: any, b: any) => b.severity - a.severity)[0];
    if (topCandidate) {
      const topBenchmark = topCandidate.item;
      return {
        type: 'benchmark',
        name: topBenchmark.metricName || topBenchmark.name,
        action: 'Address',
        message: topCandidate.status === 'behind' ? 'behind benchmark' : 'needs attention'
      };
    }

    return {
      type: 'success',
      message: 'Maintain current performance - all metrics on track'
    };
  };

  const sourceLabelForId = (sourceId: string) => {
    if (sourceId === "canonical_spend_sources") return "Campaign spend sources";
    if (sourceId === "paid_platform_spend") return "Paid platform spend";
    const match = performanceSources.find((source: any) => source?.id === sourceId);
    return match?.label || sourceId;
  };
  const changeMetricConfigs = [
    { key: "impressions", label: "Impressions" },
    { key: "clicks", label: "Clicks" },
    { key: "sessions", label: "Sessions" },
    { key: "users", label: "Users" },
    { key: "conversions", label: "Conversions" },
    { key: "leads", label: "Leads" },
    { key: "revenue", label: "Total Revenue", isCurrency: true },
    { key: "spend", label: "Spend", isCurrency: true, isCostMetric: true },
  ];
  const aggregateSnapshotMetricAvailable = (aggregate: any, metricName: string) => {
    const metric = aggregate?.totals?.[metricName];
    return metric?.available === true && metric?.value !== null && typeof metric?.value !== "undefined";
  };
  const aggregateSnapshotMetricValue = (aggregate: any, metricName: string) => parseNum(aggregate?.totals?.[metricName]?.value);
  const aggregateMetricSourceIds = (aggregate: any, metricName: string) => {
    const sources = aggregate?.totals?.[metricName]?.sources;
    return Array.isArray(sources)
      ? sources.map((sourceId: any) => String(sourceId || "").trim()).filter(Boolean).sort()
      : [];
  };
  const aggregateMetricSources = (aggregate: any, metricName: string) => {
    return Array.from(new Set(aggregateMetricSourceIds(aggregate, metricName).map((sourceId) => sourceLabelForId(sourceId))));
  };
  const revenueResponseSourceIds = (response: any) => {
    const nativeRevenue = Number(response?.native?.totals?.revenue);
    const nativeRevenueMetric = String(response?.native?.revenueMetric || "").trim();
    const nativeSource = nativeRevenueMetric || nativeRevenue !== 0
      ? [`ga4:${String(response?.native?.propertyId || "")}:${nativeRevenueMetric}:${String(response?.native?.currencyCode || "")}`]
      : [];
    const importedSources = Array.isArray(response?.imported?.sourceIds)
      ? response.imported.sourceIds.map((sourceId: any) => `imported:${String(sourceId || "").trim()}`).filter((sourceId: string) => sourceId !== "imported:")
      : [];
    return Array.from(new Set([...nativeSource, ...importedSources])).sort();
  };
  const revenueResponseTotal = (response: any): number | null => {
    const nativeRevenue = Number(response?.native?.totals?.revenue);
    const importedRevenue = Number(response?.imported?.totalRevenue);
    if (!Number.isFinite(nativeRevenue) || !Number.isFinite(importedRevenue) || revenueResponseSourceIds(response).length === 0) return null;
    return Number((nativeRevenue + importedRevenue).toFixed(2));
  };

  const ga4MovementMetricKeys = new Set(["sessions", "users", "conversions"]);
  const getGA4MovementComparison = (metricName: string) => {
    const dataThroughDate = String(performanceGA4SummaryResponse?.dataThroughDate || "");
    const current = Number(performanceGA4SummaryResponse?.overviewTotals?.[metricName]);
    const dailyRows = Array.isArray(performanceGA4SummaryResponse?.data) ? performanceGA4SummaryResponse.data : [];
    if (!Number.isFinite(current) || !/^\d{4}-\d{2}-\d{2}$/.test(dataThroughDate)) return null;

    const dateWithOffset = (offset: number) => {
      const date = new Date(`${dataThroughDate}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    };
    const baselineDate = resolveSpendComparisonEndDate(dataThroughDate, timeRange);
    if (!baselineDate) return null;
    const comparisonDays = Math.round((
      new Date(`${dataThroughDate}T00:00:00.000Z`).getTime()
      - new Date(`${baselineDate}T00:00:00.000Z`).getTime()
    ) / 86_400_000);
    if (!Number.isInteger(comparisonDays) || comparisonDays < 1) return null;
    const requiredStartDate = dateWithOffset(-(comparisonDays - 1));
    const responseStartDate = String(performanceGA4SummaryResponse?.startDate || "");
    const responseEndDate = String(performanceGA4SummaryResponse?.endDate || "");
    const responseWindowCoversComparison = /^\d{4}-\d{2}-\d{2}$/.test(responseStartDate)
      && /^\d{4}-\d{2}-\d{2}$/.test(responseEndDate)
      && responseStartDate <= requiredStartDate
      && responseEndDate >= dataThroughDate;
    if (!responseWindowCoversComparison || performanceGA4SummaryResponse?.providerRefreshWarning) return null;
    const rowsByDate = new Map<string, any>();
    for (const row of dailyRows) {
      const date = String(row?.date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < responseStartDate || date > responseEndDate) return null;
      if (rowsByDate.has(date)) return null;
      rowsByDate.set(date, row);
    }

    let recentTotal = 0;
    for (let offset = 0; offset < comparisonDays; offset += 1) {
      const row = rowsByDate.get(dateWithOffset(-offset));
      if (!row) {
        continue;
      }
      const value = Number(row?.[metricName]);
      if (!Number.isFinite(value)) return null;
      recentTotal += value;
    }
    const previous = current - recentTotal;
    if (!Number.isFinite(previous) || previous < 0) return null;
    return { current, previous, baselineDate };
  };

  // Calculate what's changed from compatible aggregate snapshots only.
  const getChanges = () => {
    const baseline = comparisonData?.previous;
    const ga4Changes: { metric: string; current: number; previous: number; change: number; pctChange: number | null; direction: string; isCurrency?: boolean; isCostMetric?: boolean; comparisonUnavailable?: boolean; comparisonUnavailableLabel?: string; sourceLabel: string }[] = [];
    let ga4BaselineTimestamp: string | null = null;
    const addGA4Change = (config: any) => {
      if (!demoMode && performanceGA4PropertyId && ga4MovementMetricKeys.has(config.key)) {
        const comparison = getGA4MovementComparison(config.key);
        if (!comparison) {
          const current = Number(performanceGA4SummaryResponse?.overviewTotals?.[config.key]);
          if (!Number.isFinite(current)) return;
          ga4Changes.push({ metric: config.label, current, previous: current, change: 0, pctChange: null, direction: "flat", comparisonUnavailable: true, sourceLabel: "Sources: Google Analytics" });
          return;
        }
        const change = comparison.current - comparison.previous;
        ga4Changes.push({
          metric: config.label,
          current: comparison.current,
          previous: comparison.previous,
          change,
          pctChange: comparison.previous > 0 ? (change / comparison.previous) * 100 : null,
          direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
          sourceLabel: "Sources: Google Analytics",
        });
        ga4BaselineTimestamp = `${comparison.baselineDate}T00:00:00.000Z`;
      }
    };
    changeMetricConfigs.forEach(addGA4Change);
    const historicalSpendSummary = historicalSpendComparison?.previous?.metrics?.performanceSummary;
    const currentSpendSourceIds = aggregateMetricSourceIds(performanceSummary, "spend");
    const historicalSpendSourceIds = aggregateMetricSourceIds(historicalSpendSummary, "spend");
    const spendSourcesCompatible = currentSpendSourceIds.length > 0
      && JSON.stringify(currentSpendSourceIds) === JSON.stringify(historicalSpendSourceIds);
    if (!demoMode && performanceGA4PropertyId && spendComparisonEndDate
      && historicalSpendComparison?.comparisonDate === spendComparisonEndDate
      && aggregateSnapshotMetricAvailable(performanceSummary, "spend")
      && aggregateSnapshotMetricAvailable(historicalSpendSummary, "spend")
      && spendSourcesCompatible) {
      const current = aggregateSnapshotMetricValue(performanceSummary, "spend");
      const previous = aggregateSnapshotMetricValue(historicalSpendSummary, "spend");
      if (Number.isFinite(current) && Number.isFinite(previous) && current >= 0 && previous >= 0) {
        const change = current - previous;
        const sourceLabels = aggregateMetricSources(performanceSummary, "spend");
        ga4Changes.push({
          metric: "Spend", current, previous, change,
          pctChange: previous > 0 ? (change / previous) * 100 : null,
          direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
          isCurrency: true, isCostMetric: true,
          sourceLabel: sourceLabels.length > 0 ? `Sources: ${sourceLabels.join(", ")}` : "Sources unavailable",
        });
        ga4BaselineTimestamp ||= `${spendComparisonEndDate}T00:00:00.000Z`;
      }
    }

    const currentRevenue = revenueResponseTotal(performanceGA4RevenueResponse);
    const historicalRevenue = revenueResponseTotal(historicalRevenueResponse);
    const currentRevenueSourceIds = revenueResponseSourceIds(performanceGA4RevenueResponse);
    const historicalRevenueSourceIds = revenueResponseSourceIds(historicalRevenueResponse);
    const currentRevenueDate = String(performanceGA4SummaryResponse?.dataThroughDate || "");
    const currentRevenueDatesMatch = performanceGA4RevenueResponse?.native?.endDate === currentRevenueDate
      && performanceGA4RevenueResponse?.imported?.endDate === currentRevenueDate;
    const historicalRevenueDatesMatch = historicalRevenueResponse?.native?.endDate === revenueComparisonEndDate
      && historicalRevenueResponse?.imported?.endDate === revenueComparisonEndDate;
    const revenueSourcesCompatible = currentRevenueSourceIds.length > 0
      && currentRevenueSourceIds.join("\u0000") === historicalRevenueSourceIds.join("\u0000");
    if (!demoMode && performanceGA4PropertyId && currentRevenue !== null && currentRevenueDatesMatch) {
      const sourceLabels = [
        ...(String(performanceGA4RevenueResponse?.native?.revenueMetric || "").trim() || Number(performanceGA4RevenueResponse?.native?.totals?.revenue) !== 0 ? ["GA4 native revenue"] : []),
        ...(Array.isArray(performanceGA4RevenueResponse?.imported?.sourceIds) && performanceGA4RevenueResponse.imported.sourceIds.length > 0 ? ["Imported revenue"] : []),
      ];
      if (historicalRevenue !== null && historicalRevenueDatesMatch && revenueSourcesCompatible) {
        const change = currentRevenue - historicalRevenue;
        ga4Changes.push({
          metric: "Total Revenue", current: currentRevenue, previous: historicalRevenue, change,
          pctChange: historicalRevenue > 0 ? (change / historicalRevenue) * 100 : null,
          direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
          isCurrency: true,
          sourceLabel: sourceLabels.length > 0 ? `Sources: ${sourceLabels.join(", ")}` : "Sources unavailable",
        });
      } else {
        ga4Changes.push({
          metric: "Total Revenue", current: currentRevenue, previous: currentRevenue, change: 0,
          pctChange: null, direction: "flat", isCurrency: true, comparisonUnavailable: true,
          comparisonUnavailableLabel: "Comparison unavailable — exact-date Revenue unavailable",
          sourceLabel: sourceLabels.length > 0 ? `Sources: ${sourceLabels.join(", ")}` : "Sources unavailable",
        });
      }
      ga4BaselineTimestamp ||= revenueComparisonEndDate ? `${revenueComparisonEndDate}T00:00:00.000Z` : null;
    }

    if (!performanceSummary?.version || !baseline) {
      if (ga4Changes.length > 0) return { changes: ga4Changes, baselineTimestamp: ga4BaselineTimestamp, emptyReason: null };
      return { changes: [], baselineTimestamp: null, emptyReason: "not_enough_history" };
    }
    const baselineAggregate = baseline?.metrics?.performanceSummary;
    if (baselineAggregate?.version !== performanceSummary.version) {
      if (ga4Changes.length > 0) return { changes: ga4Changes, baselineTimestamp: ga4BaselineTimestamp, emptyReason: null };
      return { changes: [], baselineTimestamp: baseline.recordedAt, emptyReason: "incompatible_history" };
    }

    const changes: { metric: string; current: number; previous: number; change: number; pctChange: number | null; direction: string; isCurrency?: boolean; isCostMetric?: boolean; comparisonUnavailable?: boolean; comparisonUnavailableLabel?: string; sourceLabel: string }[] = [...ga4Changes];
    const addChange = (config: any) => {
      if (!demoMode && performanceGA4PropertyId && (ga4MovementMetricKeys.has(config.key) || config.key === "spend" || config.key === "revenue")) return;
      if (!aggregateSnapshotMetricAvailable(performanceSummary, config.key) || !aggregateSnapshotMetricAvailable(baselineAggregate, config.key)) return;
      const currentSourceIds = aggregateMetricSourceIds(performanceSummary, config.key);
      const baselineSourceIds = aggregateMetricSourceIds(baselineAggregate, config.key);
      if (currentSourceIds.length === 0 || currentSourceIds.join("\u0000") !== baselineSourceIds.join("\u0000")) return;
      const currVal = aggregateSnapshotMetricValue(performanceSummary, config.key);
      const prevVal = aggregateSnapshotMetricValue(baselineAggregate, config.key);
      const change = currVal - prevVal;
      const pctChange = prevVal > 0 ? ((change / prevVal) * 100) : null;
      if (Math.abs(change) > 0 || currVal > 0 || prevVal > 0) {
        const sourceLabels = aggregateMetricSources(performanceSummary, config.key);
        changes.push({
          metric: config.label,
          current: currVal,
          previous: prevVal,
          change,
          pctChange,
          direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
          isCurrency: config.isCurrency === true,
          isCostMetric: config.isCostMetric === true,
          sourceLabel: sourceLabels.length > 0 ? `Sources: ${sourceLabels.join(", ")}` : "Sources unavailable",
        });
      }
    };

    changeMetricConfigs.forEach(addChange);

    return {
      changes,
      baselineTimestamp: ga4BaselineTimestamp || baseline.recordedAt,
      emptyReason: changes.length > 0 ? null : "no_metric_changes",
    };
  };

  const changeData = getChanges();
  const recentMovementMetricOrder = ["Sessions", "Conversions", "Spend", "Total Revenue"];
  const recentMovementChanges = recentMovementMetricOrder.flatMap((metric) => {
    const change = changeData.changes.find((item) => item.metric === metric);
    return change ? [change] : [];
  });

  const getOverviewMetric = (metricName: string, fallbackValue: number) => {
    const metric = performanceSummary?.totals?.[metricName];
    if (performanceSummaryPending) {
      return { available: true, value: null, sources: [], unavailableReasons: [], pending: true };
    }
    if (!performanceSummary || !metric) {
      return { available: true, value: fallbackValue, sources: [], unavailableReasons: [] };
    }
    return metric;
  };
  const getGA4SummaryMetric = (metricName: string, demoFallbackValue: number) => {
    if (demoMode) return getOverviewMetric(metricName, demoFallbackValue);
    if (performanceGA4ConnectionsLoading || (!!performanceGA4PropertyId && performanceGA4SummaryLoading)) {
      return { available: true, value: null, sources: [], unavailableReasons: [], pending: true };
    }
    const value = Number(performanceGA4SummaryResponse?.overviewTotals?.[metricName]);
    if (!Number.isFinite(value)) {
      return { available: false, value: null, sources: [], unavailableReasons: ["GA4 Summary metric unavailable"] };
    }
    return { available: true, value, sources: ["Google Analytics"], unavailableReasons: [] };
  };
  const getGA4TotalRevenueMetric = () => {
    if (demoMode) return getOverviewMetric("revenue", parseNum(effectiveGA4?.metrics?.revenue));
    if (performanceGA4ConnectionsLoading || performanceGA4RevenueLoading) {
      return { available: true, value: null, sources: [], unavailableReasons: [], pending: true };
    }
    const nativeRevenue = Number(performanceGA4RevenueResponse?.native?.totals?.revenue);
    const importedRevenue = Number(performanceGA4RevenueResponse?.imported?.totalRevenue);
    const hasNativeRevenue = !!String(performanceGA4RevenueResponse?.native?.revenueMetric || "").trim() || nativeRevenue !== 0;
    const hasImportedRevenue = Array.isArray(performanceGA4RevenueResponse?.imported?.sourceIds) && performanceGA4RevenueResponse.imported.sourceIds.length > 0;
    if (!Number.isFinite(nativeRevenue) || !Number.isFinite(importedRevenue) || (!hasNativeRevenue && !hasImportedRevenue)) {
      return { available: false, value: null, sources: [], unavailableReasons: ["GA4 revenue unavailable"] };
    }
    return {
      available: true,
      value: nativeRevenue + importedRevenue,
      sources: [...(hasNativeRevenue ? ["GA4 native revenue"] : []), ...(hasImportedRevenue ? ["Imported revenue"] : [])],
      unavailableReasons: [],
    };
  };
  const formatOverviewValue = (metric: any, formatter: (value: number) => string) => {
    if (metric?.pending) return "";
    if (!metric?.available) return "Unavailable";
    return formatter(parseNum(metric?.value));
  };
  const overviewSourceLabel = (metric: any, fallbackLabel: string) => {
    if (metric?.pending) return "";
    if (!metric?.available) {
      return metric?.unavailableReasons?.[0] || "No connected source provides this metric";
    }
    if (!performanceSummary && (!Array.isArray(metric?.sources) || metric.sources.length === 0)) return fallbackLabel;
    const labels = (metric.sources || []).map((sourceId: string) => sourceLabelForId(sourceId));
    return labels.length > 0 ? `Sources: ${labels.join(", ")}` : "Sources unavailable";
  };
  const overviewSessions = getGA4SummaryMetric("sessions", webSessions);
  const overviewUsers = getGA4SummaryMetric("users", parseNum(effectiveGA4?.metrics?.users));
  const overviewConversions = getGA4SummaryMetric("conversions", totalConversions);
  const overviewRevenue = getGA4TotalRevenueMetric();
  const overviewSpend = getOverviewMetric("spend", totalSpend);

  return (
    <div className="min-h-screen bg-background">
      <style>{`body[data-scroll-locked]:has([data-performance-movement-select]) { margin-right: 0 !important; }`}</style>
      <Navigation />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <Link href={`/campaigns/${campaign.id}`}>
                  <Button variant="ghost" size="sm" data-testid="button-back">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">
                    Performance Summary
                  </h1>
                  <p className="text-muted-foreground/70 mt-1">
                    {campaign.name} - Comprehensive overview & insights
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button
                  variant={demoMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDemoMode(!demoMode)}
                  className="shrink-0"
                >
                  <FlaskConical className="w-4 h-4 mr-1" />
                  {demoMode ? "Demo On" : "Demo Data"}
                </Button>

              </div>
            </div>
          </div>

          {demoMode && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
              Showing demo data for testing. Toggle off to see real platform data.
            </div>
          )}

          <div className="space-y-6">
            {!performanceSummaryPending && (
              <>
              <section className="space-y-4" data-testid="performance-key-outcomes">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Key Outcomes</h2>
                  <p className="text-sm text-muted-foreground mt-1">Current outcomes from the campaign's connected sources</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatOverviewValue(overviewUsers, (value) => value.toLocaleString())}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {overviewSourceLabel(overviewUsers, "Sources unavailable")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatOverviewValue(overviewSessions, (value) => value.toLocaleString())}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {overviewSourceLabel(overviewSessions, `Web: ${webSessions.toLocaleString()}`)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatOverviewValue(overviewConversions, (value) => value.toLocaleString())}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {overviewSourceLabel(overviewConversions, `LinkedIn: ${linkedinConversions.toLocaleString()} | CI: ${ciConversions.toLocaleString()}`)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatOverviewValue(overviewRevenue, (value) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {overviewSourceLabel(overviewRevenue, "Sources unavailable")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatOverviewValue(overviewSpend, (value) => `$${value.toLocaleString()}`)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {overviewSourceLabel(overviewSpend, `LinkedIn: $${linkedinSpend.toLocaleString()} | CI: $${ciSpend.toLocaleString()}`)}
                    </p>
                  </CardContent>
                </Card>
                </div>
              </section>

                <div className="grid gap-6 lg:grid-cols-2">
                {/* Campaign Health */}
                <Card data-testid="performance-campaign-health">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <HealthIcon className="w-5 h-5" />
                      <span>Campaign Health</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {scoringListsUnavailable ? (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground/70">GA4 KPI and Benchmark status is currently unavailable.</p>
                      </div>
                    ) : configuredMetricCount === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground/70">Set up KPIs and Benchmarks to see your campaign health score.</p>
                      </div>
                    ) : totalMetrics === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground/70">Configured KPIs and Benchmarks are currently unavailable or unscorable.</p>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-4">
                        <div className={`w-16 h-16 rounded-full ${healthStatus.color} flex items-center justify-center text-white text-2xl font-bold`}>
                          {excludedMetricCount > 0 ? "—" : `${healthScore}%`}
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-foreground">{healthStatus.label}</div>
                          <div className="text-sm text-muted-foreground/70">
                            {excludedMetricCount > 0
                              ? `${totalMetrics} of ${configuredMetricCount} configured metrics verified`
                              : `${totalOnTrackMetrics} of ${configuredMetricCount} configured metrics on track`}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {kpisOnTrackOrAbove}/{effectiveKpis.length} KPIs on track • {benchmarksOnTrack}/{effectiveBenchmarks.length} Benchmarks on track
                          </div>
                          {excludedMetricCount > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {excludedMetricCount} configured metric{excludedMetricCount === 1 ? '' : 's'} awaiting verification
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top Priority Action */}
                <Card className="border-l-4 border-l-blue-500" data-testid="performance-top-priority">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="w-5 h-5" />
                      <span>Top Priority Action</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const priority = getPriorityAction();

                      if (priority.type === 'kpi') {
                        return (
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center space-x-2 mb-2">
                                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                                  KPI Below Target
                                </Badge>
                              </div>
                              <div className="text-xl font-bold text-foreground">
                                {priority.name}
                              </div>
                              <div className="text-sm text-muted-foreground/70 mt-1">
                                KPI: {priority.metric}
                              </div>
                            </div>
                            <div className="flex items-center space-x-6">
                              <div>
                                <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-1">Current</div>
                                <div className="text-xl font-bold text-red-600 dark:text-red-400">{priority.currentValue}</div>
                              </div>
                              <div className="text-2xl text-muted-foreground/60">→</div>
                              <div>
                                <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-1">Target</div>
                                <div className="text-xl font-bold text-green-600 dark:text-green-400">{priority.targetValue}</div>
                              </div>
                            </div>
                          </div>
                        );
                      } else if (priority.type === 'benchmark') {
                        return (
                          <div className="flex items-center space-x-3">
                            <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700">
                              Benchmark
                            </Badge>
                            <p className="text-foreground font-medium">
                              {priority.action} "{priority.name}" - {priority.message}
                            </p>
                          </div>
                        );
                      } else {
                        return (
                          <p className={`${priority.type === 'success' ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'} font-medium`}>{priority.message}</p>
                        );
                      }
                    })()}
                  </CardContent>
                </Card>
                </div>

              {/* Recent Movement */}
              <Card data-testid="performance-recent-movement">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      <Activity className="w-5 h-5" />
                      <div>
                        <CardTitle>Recent Movement</CardTitle>
                        <CardDescription className="mt-1.5">
                          Meaningful changes in connected-source metrics
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={`/campaigns/${campaign.id}/trend-analysis`}>
                        <Button variant="outline" size="sm">
                          <TrendingUp className="w-4 h-4 mr-2" />
                          View Trend Analysis
                        </Button>
                      </Link>
                      <Select value={timeRange} onValueChange={(value: '24h' | '7d' | '30d') => setTimeRange(value)}>
                      <SelectTrigger className="w-[230px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent data-performance-movement-select>
                        <SelectItem value="24h">Compare with yesterday</SelectItem>
                        <SelectItem value="7d">Compare with 7 days ago</SelectItem>
                        <SelectItem value="30d">Compare with one month ago</SelectItem>
                      </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {recentMovementChanges.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="w-8 h-8 text-muted-foreground/70 mx-auto mb-3" />
                      <p className="text-muted-foreground/70 font-medium">
                        {changeData.emptyReason === "incompatible_history" ? "No compatible historical data yet" : "Not enough historical data yet"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Compatible aggregate snapshots are recorded as your connected platforms sync.
                        Changes will appear here once a previous aggregate snapshot is available to compare.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {recentMovementChanges.map((item, idx) => {
                          const isUp = item.direction === "up";
                          const isDown = item.direction === "down";
                          const isFlat = item.direction === "flat";
                          // Spend movement is contextual; do not mark higher spend as bad without ROI/ROAS context.
                          const isPositive = !item.isCostMetric && isUp;
                          const isNegative = !item.isCostMetric && isDown;
                          const movementColor = isPositive ? 'text-green-600 dark:text-green-400' : isNegative ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground/70';

                          return (
                            <div key={idx} className={`p-4 rounded-lg border transition-all duration-300 ease-in-out ${
                              isPositive ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' :
                              isNegative ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' :
                              'border-border bg-muted'
                            }`}>
                              <div className="text-sm font-medium text-muted-foreground/70 mb-1">{item.metric}</div>
                              <div className="flex items-baseline space-x-2">
                                <span className="text-2xl font-bold text-foreground">
                                  {item.isCurrency ? `$${item.current.toLocaleString()}` : item.current.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center mt-2 space-x-2">
                                {isUp && <TrendingUp className={`w-4 h-4 ${movementColor}`} />}
                                {isDown && <TrendingDown className={`w-4 h-4 ${movementColor}`} />}
                                <span className={`text-sm font-semibold ${
                                  isPositive ? 'text-green-700 dark:text-green-400' :
                                  isNegative ? 'text-red-700 dark:text-red-400' :
                                  'text-muted-foreground/70'
                                }`}>
                                  {item.comparisonUnavailable ? item.comparisonUnavailableLabel || 'Comparison unavailable — incomplete GA4 daily history' : isFlat ? 'No change' :
                                    `${isUp ? '+' : ''}${item.isCurrency ? '$' + item.change.toLocaleString() : item.change.toLocaleString()}${item.pctChange === null ? '' : ` (${isUp ? '+' : ''}${item.pctChange.toFixed(1)}%)`}`
                                  }
                                </span>
                              </div>
                              {!item.comparisonUnavailable && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Previous: {item.isCurrency ? `$${item.previous.toLocaleString()}` : item.previous.toLocaleString()}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground mt-1">
                                {item.sourceLabel}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Trend Charts — only show compatible aggregate snapshots */}
              {false && (() => {
                const compatibleSnapshots = performanceSummary?.version
                  ? trendSnapshots.filter((snapshot: any) => snapshot?.metrics?.performanceSummary?.version === performanceSummary.version)
                  : [];
                const trendMetrics = changeMetricConfigs.filter((config: any) => aggregateSnapshotMetricAvailable(performanceSummary, config.key));
                const allPoints = compatibleSnapshots.map((snapshot: any) => {
                  const d = new Date(snapshot.recordedAt);
                  const aggregate = snapshot?.metrics?.performanceSummary;
                  const point: any = {
                    date: d.toLocaleString('en-US', { month: 'short', day: 'numeric', ...(trendPeriod === 'daily' ? { hour: 'numeric', minute: '2-digit' } : {}) }),
                  };
                  trendMetrics.forEach((config: any) => {
                    point[config.key] = aggregateSnapshotMetricAvailable(aggregate, config.key) ? aggregateSnapshotMetricValue(aggregate, config.key) : null;
                  });
                  return point;
                });
                const chartData = allPoints.filter((pt, i) => {
                  if (i === 0) return true;
                  const prev = allPoints[i - 1];
                  return trendMetrics.some((config: any) => pt[config.key] !== null && prev[config.key] !== null && pt[config.key] !== prev[config.key]);
                });
                const chartMetrics = trendMetrics.filter((config: any) => chartData.filter((pt: any) => pt[config.key] !== null).length >= 2);
                const hasChartData = chartData.length >= 2 && chartMetrics.length > 0;
                const xAxisInterval = chartData.length <= 8 ? 0 : Math.ceil(chartData.length / 8) - 1;
                return (
              <Card>
                  <CardHeader>
                    <CardTitle>Metric Trends</CardTitle>
                    <CardDescription className="mt-1.5">How your metrics have changed over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!hasChartData ? (
                      <div className="text-center py-8">
                        <Clock className="w-8 h-8 text-muted-foreground/70 mx-auto mb-3" />
                        <p className="text-muted-foreground/70 font-medium">Not enough compatible trend data yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Metric trends will appear after at least two compatible aggregate snapshots are available.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-6 md:grid-cols-2">
                        {chartMetrics.map((config: any) => {
                          const sourceLabels = aggregateMetricSources(performanceSummary, config.key);
                          return (
                            <div key={config.key}>
                              <h4 className="text-sm font-semibold text-foreground/80/60">{config.label}</h4>
                              <p className="text-xs text-muted-foreground mb-3">
                                {sourceLabels.length > 0 ? `Sources: ${sourceLabels.join(", ")}` : "Sources unavailable"}
                              </p>
                              <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                                  <XAxis dataKey="date" className="text-xs" interval={xAxisInterval} angle={-30} textAnchor="end" height={50} tick={{ fontSize: 11 }} />
                                  <YAxis className="text-xs" tickFormatter={(v) => config.isCurrency ? `$${Number(v).toLocaleString()}` : Number(v).toLocaleString()} />
                                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0' }} formatter={(v: any) => config.isCurrency ? `$${parseFloat(v).toLocaleString()}` : parseFloat(v).toLocaleString()} />
                                  <Line type="monotone" dataKey={config.key} name={config.label} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
                );
              })()}

              {/* Insights Tab */}
              <Card data-testid="performance-recommended-actions">
                <CardHeader>
                  <CardTitle>Recommended Actions</CardTitle>
                  <CardDescription>Prioritized actions based on {campaign.name} actual metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Performance Analysis */}
                    {(() => {
                      const recommendedInsights = recommendedActions;
                      
                      return recommendedInsights.map((insight, idx) => {
                        const bgColors: Record<string, string> = {
                          success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
                          warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
                          info: 'bg-muted border-border'
                        };
                        const textColors: Record<string, string> = {
                          success: 'text-green-900 dark:text-green-100',
                          warning: 'text-yellow-900 dark:text-yellow-100',
                          info: 'text-foreground dark:text-slate-100'
                        };
                        const bodyColors: Record<string, string> = {
                          success: 'text-green-800 dark:text-green-200',
                          warning: 'text-yellow-800 dark:text-yellow-200',
                          info: 'text-foreground/80/60'
                        };
                        
                        return (
                          <div key={idx} className={`p-4 rounded-lg border ${bgColors[insight.type]}`}>
                            <h4 className={`font-semibold mb-2 ${textColors[insight.type]}`}>{insight.title}</h4>
                            <p className={`text-sm ${bodyColors[insight.type]}`}>{insight.message}</p>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </CardContent>
              </Card>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
