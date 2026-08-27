import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, TrendingUp, TrendingDown, Target, Users, DollarSign, Award, AlertTriangle, CheckCircle, Zap, Eye, BarChart3, Clock, ArrowUpRight, ArrowDownRight, Brain, Activity, Info, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar } from "recharts";
import { format } from "date-fns";
import { classifyKpiBandWithPolicy, computeAttainmentFillPct, computeAttainmentPct, computeBenchmarkThresholdResult, isLowerIsBetterKpi, resolveKpiThresholdPolicy } from "@shared/kpi-math";

function formatExecutiveCurrency(amount: number, currencyCode: unknown, showCents: boolean = false): string {
  const normalizedCurrency = String(currencyCode || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) return "Unavailable";
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalizedCurrency,
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    }).format(amount);
  } catch {
    return "Unavailable";
  }
}

export default function ExecutiveSummary() {
  const { id: campaignId } = useParams();

  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: executiveSummary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "executive-summary", "live"],
    enabled: !!campaignId,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/executive-summary`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const executiveOutcomeDateRange = "90days";
  const { data: outcomeTotals, isLoading: outcomeTotalsLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/outcome-totals`, executiveOutcomeDateRange, "live", "executive-summary"],
    enabled: !!campaignId,
    queryFn: async () => {
      const url = `/api/campaigns/${campaignId}/outcome-totals?dateRange=${executiveOutcomeDateRange}&captureExecutiveSnapshot=1&executiveFinancialScope=campaign_to_date`;
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const executiveTrajectoryReportingDate = String((outcomeTotals as any)?.performanceSummary?.currentValueWindow?.endDate || "");
  const { data: executiveTrajectoryData, isLoading: executiveTrajectoryLoading } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "executive-summary", "trajectory", executiveTrajectoryReportingDate],
    enabled: !!campaignId && /^\d{4}-\d{2}-\d{2}$/.test(executiveTrajectoryReportingDate),
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/executive-summary/trajectory?reportingDate=${encodeURIComponent(executiveTrajectoryReportingDate)}`, { credentials: "include" });
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  if (campaignLoading || summaryLoading || outcomeTotalsLoading || (executiveTrajectoryReportingDate && executiveTrajectoryLoading)) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-muted rounded w-1/3"></div>
              <div className="grid gap-4 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 bg-muted rounded"></div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (campaignError || !campaign || summaryError || !executiveSummary) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-8">
              <h1 className="text-xl font-semibold text-foreground mb-2">
                {!campaign ? 'Campaign Not Found' : 'Unable to Load Executive Summary'}
              </h1>
              <p className="text-muted-foreground/70">
                {!campaign ? 'Unable to load campaign data for executive summary.' : 'Please ensure at least one platform (LinkedIn Ads, Meta/Facebook, Google Analytics, or Custom Integration) is connected to this campaign.'}
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const executiveCurrency = String((campaign as any)?.currency || "").trim().toUpperCase();
  const formatCurrency = (amount: number, showCents: boolean = false) =>
    formatExecutiveCurrency(amount, executiveCurrency, showCents);

  // Format text strings that contain dollar amounts with commas
  const formatRecommendationText = (text: string): string => {
    if (!text) return text;
    // Match dollar amounts like $123456 or -$123456 and format them with commas
    return text.replace(/([+-]?)\$(\d+)(?!\.\d)/g, (match, sign, number) => {
      const formatted = parseInt(number).toLocaleString('en-US');
      return `${sign}$${formatted}`;
    });
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">High Priority</Badge>;
      case 'medium':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Medium Priority</Badge>;
      case 'low':
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">Low Priority</Badge>;
      default:
        return null;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'opportunity':
        return <Target className="w-5 h-5 text-blue-600" />;
      case 'risk':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'trend':
        return <TrendingUp className="w-5 h-5 text-purple-600" />;
      default:
        return <Eye className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const performanceSummary = (outcomeTotals as any)?.performanceSummary;
  const currentValueWindow = (performanceSummary as any)?.currentValueWindow;
  const aggregateSources = Array.isArray((performanceSummary as any)?.sources) ? (performanceSummary as any).sources : [];
  const ga4AggregateSource = aggregateSources.find((source: any) => source?.id === "ga4" && source?.connected === true);
  const hasAuthoritativeGA4Window = (performanceSummary as any)?.version === "performance_summary_aggregate_v3"
    && currentValueWindow?.mode === "initial_import_to_latest_completed_day"
    && currentValueWindow?.dataThroughDate === currentValueWindow?.endDate
    && Array.isArray(ga4AggregateSource?.includedMetrics)
    && ["users", "sessions", "conversions", "revenue"].every((metricName) => ga4AggregateSource.includedMetrics.includes(metricName));
  const executiveWindowDescription = currentValueWindow?.mode === "initial_import_to_latest_completed_day"
    && /^\d{4}-\d{2}-\d{2}$/.test(String(currentValueWindow?.startDate || ""))
    && /^\d{4}-\d{2}-\d{2}$/.test(String(currentValueWindow?.endDate || ""))
    && currentValueWindow.startDate <= currentValueWindow.endDate
    ? `the ${currentValueWindow.startDate} to ${currentValueWindow.endDate} reporting window`
    : "this 90-day view";
  const aggregateMetric = (metricName: string) => (performanceSummary as any)?.totals?.[metricName];
  const aggregateMetricAvailable = (metricName: string) => aggregateMetric(metricName)?.available === true;
  const aggregateMetricValue = (metricName: string): number => {
    const metric = aggregateMetric(metricName);
    return metric?.available === true && metric?.value !== null ? Number(metric.value) || 0 : 0;
  };
  const sourceToDateFinancialKinds = [
    aggregateSources.some((source: any) => source?.connected === true && source?.category === "financial" && source?.includedMetrics?.includes("revenue")) ? "revenue" : null,
    aggregateMetric("spend")?.sources?.includes("canonical_spend_sources") ? "spend" : null,
  ].filter(Boolean) as string[];
  const sourceToDateFinancialLabel = sourceToDateFinancialKinds.join(" and ");
  const aggregateMetricReason = (metricName: string): string => {
    if ((metricName === "clicks" || metricName === "impressions") && !aggregateMetricAvailable(metricName)) {
      return "Unavailable from connected sources";
    }
    const reasons = aggregateMetric(metricName)?.unavailableReasons;
    return Array.isArray(reasons) && reasons.length > 0 ? reasons[0] : "Not available from connected sources";
  };
  const aggregateMetricSourceLabel = (metricName: string): string => {
    const sources = aggregateMetric(metricName)?.sources;
    return Array.isArray(sources) && sources.length > 0 ? `Sources: ${sources.join(", ")}` : aggregateMetricReason(metricName);
  };
  const formatAggregateInteger = (metricName: string) =>
    aggregateMetricAvailable(metricName) ? Math.trunc(aggregateMetricValue(metricName)).toLocaleString() : "Unavailable";
  const formatAggregateCurrency = (metricName: string, showCents: boolean = true) =>
    aggregateMetricAvailable(metricName) ? formatCurrency(aggregateMetricValue(metricName), showCents) : "Unavailable";
  const formatAggregatePercent = (metricName: string) =>
    aggregateMetricAvailable(metricName) ? `${aggregateMetricValue(metricName).toFixed(2)}%` : "Unavailable";
  const formatAggregateRatio = (metricName: string) => {
    if (!aggregateMetricAvailable(metricName)) return "Unavailable";
    return `${aggregateMetricValue(metricName).toFixed(2)}x`;
  };
  const getRecommendationExpectedImpactItems = (rec: any): string[] => {
    if (rec?.category !== "Website Outcomes") return [];
    const webMetrics: string[] = [];
    if (aggregateMetricAvailable("users")) webMetrics.push(`${formatAggregateInteger("users")} users`);
    if (aggregateMetricAvailable("sessions")) webMetrics.push(`${formatAggregateInteger("sessions")} sessions`);
    if (aggregateMetricAvailable("conversions")) webMetrics.push(`${formatAggregateInteger("conversions")} conversions`);
    if (aggregateMetricAvailable("revenue")) webMetrics.push(formatAggregateCurrency("revenue"));
    if (aggregateMetricAvailable("cvr")) webMetrics.push(`${formatAggregatePercent("cvr")} conversion rate`);
    const expectedImpact = String(rec?.expectedImpact || "");
    const unavailableTargetText = "No KPI or Benchmark target is available for conversion rate, revenue, or conversions, so quality cannot be judged yet.";
    const targetText = expectedImpact.includes(unavailableTargetText)
      ? unavailableTargetText
      : (expectedImpact.match(/KPI or Benchmark targets exist for [^.]+; compare against those targets before judging quality\./)?.[0] || "");
    const metricText = webMetrics.length > 0 ? `Available data: ${webMetrics.join(", ")}.` : "";
    const interpretationText = [
      aggregateMetricAvailable("revenue") && aggregateMetricAvailable("conversions")
        ? `Revenue is ${formatAggregateCurrency("revenue")} from ${formatAggregateInteger("conversions")} conversions.`
        : "",
      aggregateMetricAvailable("cvr")
        ? `Conversion rate is ${formatAggregatePercent("cvr")}.`
        : "",
    ].filter(Boolean).join(" ");
    const targetMetricLabels: Record<string, string> = { cvr: "Conversion rate", revenue: "Revenue", conversions: "Conversions" };
    const targetMetrics = new Set(Object.keys(targetMetricLabels));
    const targetComparisons: string[] = [];
    let hasBelowTarget = false;
    executiveKpiProgress.forEach((kpi: any) => {
      const metric = resolveExecutiveKpiMetric(kpi);
      if (!metric || !targetMetrics.has(metric)) return;
      const target = Number(kpi.target) || 0;
      if (target <= 0) return;
      const targetState = resolveExecutiveKpiTargetState(kpi);
      if (!targetState) return;
      const isBelow = targetState?.band === "below";
      if (isBelow) hasBelowTarget = true;
      targetComparisons.push(`${targetMetricLabels[metric]} KPI is ${isBelow ? "below target" : "on track"}`);
    });
    executiveBenchmarkComparison.forEach((bm: any) => {
      const metric = bm.aggregateMetric || resolveKpiAggregateMetric(bm);
      if (!metric || !targetMetrics.has(metric)) return;
      const benchmark = Number(bm.benchmark) || 0;
      if (benchmark <= 0) return;
      const isBelow = bm.status !== "on_track";
      if (isBelow) hasBelowTarget = true;
      targetComparisons.push(`${targetMetricLabels[metric]} Benchmark is ${isBelow ? "below benchmark" : "on track"}`);
    });
    const targetComparisonText = targetComparisons.length > 0
      ? `Target check: ${targetComparisons.join("; ")}.`
      : targetText
        ? targetText
        : "";
    const nextActionText = targetComparisons.length === 0
      ? "Next action: create or confirm KPI/Benchmark targets for conversion rate, revenue, and conversions before judging quality."
      : hasBelowTarget
        ? "Next action: inspect landing pages or conversion paths for metrics below target before increasing spend."
        : "Next action: keep monitoring these outcome targets and connect a paid-media source before making budget or channel decisions.";
    return [metricText, interpretationText, targetComparisonText, nextActionText]
      .filter(Boolean)
      .map((item) => formatRecommendationText(item));
  };
  const pickFirstAvailableMetric = (metricNames: string[]) =>
    metricNames.find((metricName) => aggregateMetricAvailable(metricName)) || metricNames[0];
  const reachMetricKey = pickFirstAvailableMetric(["impressions", "users", "sessions"]);
  const reachMetricLabels: Record<string, string> = {
    impressions: "Impressions",
    users: "Users",
    sessions: "Sessions",
  };
  const engagementMetricKey = pickFirstAvailableMetric(["clicks", "sessions", "users"]);
  const engagementMetricLabels: Record<string, string> = {
    clicks: "Clicks",
    sessions: "Sessions",
    users: "Users",
  };
  const conversionRateLabel = aggregateMetricAvailable("clicks") ? "Click-Through CVR" : "Conversion Rate";
  const roiAvailable = aggregateMetricAvailable("roi");
  const roiValue = aggregateMetricValue("roi");
  const executiveMetricParts: string[] = [];
  if (aggregateMetricAvailable("roi")) executiveMetricParts.push(`ROI is ${formatAggregatePercent("roi")}`);
  if (aggregateMetricAvailable("roas")) executiveMetricParts.push(`ROAS is ${formatAggregateRatio("roas")}`);
  const executiveMetricSummary = executiveMetricParts.length > 0
    ? hasAuthoritativeGA4Window && sourceToDateFinancialKinds.length > 0
      ? `GA4 property traffic and conversion metrics cover ${currentValueWindow.startDate} to ${currentValueWindow.endDate}; connected ${sourceToDateFinancialLabel} ${sourceToDateFinancialKinds.length === 1 ? "input is" : "inputs are"} source-to-date through ${currentValueWindow.endDate}. Combined connected-source financial metrics show ${executiveMetricParts.join(" and ")}.`
      : `For ${executiveWindowDescription}, connected-source metrics show ${executiveMetricParts.join(" and ")}.`
    : `For ${executiveWindowDescription}, connected-source metrics do not include enough spend and revenue to calculate ROI or ROAS.`;
  const executiveTrajectory = hasAuthoritativeGA4Window
    ? (executiveTrajectoryData as any)?.available === true ? (executiveTrajectoryData as any).trajectory : null
    : (executiveSummary as any)?.health?.trajectory;
  const executiveTrajectoryUnavailableDetail = hasAuthoritativeGA4Window
    ? (executiveTrajectoryData as any)?.reason === "incompatible_history"
      ? "Earlier readings used different sources or reporting settings, so they cannot be compared safely."
      : (executiveTrajectoryData as any)?.reason === "revenue_history_unavailable"
        ? "Revenue was unavailable in one of the two readings."
        : "No matching Executive Summary reading exists for seven days earlier yet."
    : "Based on compatible aggregate snapshots, not the removed date selector.";
  const executiveTrajectorySummary = executiveTrajectory
    ? `7-day snapshot trajectory is ${executiveTrajectory}.`
    : "7-day snapshot trajectory does not have enough compatible history yet.";
  const kpiMetricAliases: Record<string, string> = {
    totalusers: "users",
    users: "users",
    user: "users",
    totalsessions: "sessions",
    sessions: "sessions",
    totalrevenue: "revenue",
    revenue: "revenue",
    totalconversions: "conversions",
    conversions: "conversions",
    totalspend: "spend",
    spend: "spend",
    totalclicks: "clicks",
    clicks: "clicks",
    totalimpressions: "impressions",
    impressions: "impressions",
    roas: "roas",
    roi: "roi",
    ctr: "ctr",
    cvr: "cvr",
    conversionrate: "cvr",
    cpa: "cpa",
    cpc: "cpc",
    cpm: "cpm",
  };
  const resolveKpiAggregateMetric = (kpi: any): string | null => {
    for (const candidate of [kpi?.metricKey, kpi?.metric, kpi?.name]) {
      const normalized = String(candidate || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const metricName = kpiMetricAliases[normalized];
      if (metricName && aggregateMetricAvailable(metricName)) return metricName;
    }
    return null;
  };
  const resolveExecutiveKpiMetric = (kpi: any): string =>
    String(kpi?.metricKey || kpi?.metric || "__custom__");
  const resolveExecutiveKpiTargetState = (kpi: any) => {
    const executiveKpiMetric = resolveExecutiveKpiMetric(kpi);
    const current = Number(kpi.current) || 0;
    const target = Number(kpi.target ?? kpi.targetValue) || 0;
    const lowerIsBetter = isLowerIsBetterKpi({ metric: executiveKpiMetric, name: kpi?.name || kpi?.metric });
    const policy = resolveKpiThresholdPolicy({
      metric: executiveKpiMetric,
      name: kpi?.name || kpi?.metric,
      unit: kpi?.unit,
      current,
      target,
      lowerIsBetter,
    });
    const band = target > 0
      ? classifyKpiBandWithPolicy({ current, target, lowerIsBetter, policy }) ?? "below"
      : "near";
    const attainmentPct = computeAttainmentPct({ current, target, lowerIsBetter }) ?? 0;
    return {
      executiveKpiMetric,
      current,
      target,
      band,
      fillPct: computeAttainmentFillPct(attainmentPct),
    };
  };
  const executiveKpiProgress = Array.isArray((executiveSummary as any).kpiProgress)
    ? (executiveSummary as any).kpiProgress.filter((kpi: any) =>
      Number.isFinite(Number(kpi.current)) && Number(kpi.target ?? kpi.targetValue) > 0
    )
    : [];
  const executiveBenchmarkComparison = Array.isArray((executiveSummary as any).benchmarkComparison)
    ? (executiveSummary as any).benchmarkComparison
      .map((bm: any) => {
        const aggregateBenchmarkMetric = String(bm.metricKey || bm.metric || "");
        const yours = Number(bm.yours);
        const benchmark = Number(bm.benchmark);
        if (!aggregateBenchmarkMetric || !Number.isFinite(yours) || !Number.isFinite(benchmark) || benchmark <= 0) return null;
        const threshold = computeBenchmarkThresholdResult({
          metric: aggregateBenchmarkMetric,
          name: bm?.name || bm?.metric,
          unit: bm?.unit,
          current: yours,
          benchmarkValue: benchmark,
        });
        const deltaPct = threshold.effectiveDeltaPct ?? 0;
        return {
          ...bm,
          aggregateMetric: aggregateBenchmarkMetric,
          yours,
          delta: `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`,
          status: threshold.status || 'behind',
        };
      })
      .filter(Boolean)
    : [];
  const executiveKpiExceptions = executiveKpiProgress.filter((kpi: any) =>
    resolveExecutiveKpiTargetState(kpi).band === "below"
  );
  const executiveBenchmarkExceptions = executiveBenchmarkComparison.filter((bm: any) => bm.status !== "on_track");
  const hasWebAnalyticsOutcomeEvidence = aggregateSources.some((source: any) =>
    source?.connected === true && source?.category === "web_analytics"
  ) && (aggregateMetricAvailable("users") || aggregateMetricAvailable("sessions"))
    && (aggregateMetricAvailable("conversions") || aggregateMetricAvailable("revenue"));
  const hasConnectedPaidMediaSource = aggregateSources.some((source: any) =>
    source?.connected === true && source?.category === "paid_media"
  );
  const hasWebsiteOutcomeTargetException = [...executiveKpiExceptions, ...executiveBenchmarkExceptions]
    .some((record: any) => ["cvr", "conversions", "revenue"].includes(String(record?.metricKey || record?.aggregateMetric || record?.metric || "")));
  const sourceBackedRecommendations = hasWebAnalyticsOutcomeEvidence && hasWebsiteOutcomeTargetException ? [{
    priority: "medium",
    category: "Website Outcomes",
    action: "Review website conversion path before making paid-media budget decisions",
    confidence: aggregateMetricAvailable("cvr") ? "medium" : "low",
  }] : [];
  const riskKpiMissCount = executiveKpiExceptions.length;
  const riskBenchmarkMissCount = executiveBenchmarkComparison.filter((bm: any) => bm.status === "behind").length;
  const benchmarkMonitorCount = executiveBenchmarkComparison.filter((bm: any) => bm.status === "needs_attention").length;
  const hasMonitorConditions = benchmarkMonitorCount > 0;
  const riskFreshnessWarnings = (Array.isArray((executiveSummary as any)?.dataFreshness?.warnings) ? (executiveSummary as any).dataFreshness.warnings : [])
    .filter((warning: any) => !(hasAuthoritativeGA4Window && warning?.source === "Google Analytics"));
  const trendPercentage = hasAuthoritativeGA4Window
    ? (executiveTrajectoryData as any)?.available === true ? Number((executiveTrajectoryData as any).trendPercentage) || 0 : 0
    : Number((executiveSummary as any)?.health?.trendPercentage) || 0;
  const paidRiskSources = aggregateSources.filter((source: any) =>
    source?.connected === true &&
    source?.category !== "financial" &&
    source?.category !== "web_analytics" &&
    Array.isArray(source?.includedMetrics) &&
    ["spend", "revenue", "conversions"].some((metricName) => source.includedMetrics.includes(metricName))
  );
  const paidSpendTotal = paidRiskSources.reduce((sum: number, source: any) => sum + (Number(source?.metrics?.spend) || 0), 0);
  const paidTopSpendShare = paidSpendTotal > 0
    ? Math.max(...paidRiskSources.map((source: any) => ((Number(source?.metrics?.spend) || 0) / paidSpendTotal) * 100))
    : 0;
  const paidConcentrationRisk = paidRiskSources.length === 1 || paidTopSpendShare > 70;
  const roiRoasRisk = (aggregateMetricAvailable("roi") && aggregateMetricValue("roi") < 0) || (aggregateMetricAvailable("roas") && aggregateMetricValue("roas") < 1);
  const trendRisk = executiveTrajectory === "declining" && trendPercentage < -15;
  const displayedRiskFactors = [
    ...(paidConcentrationRisk && paidRiskSources.length > 0 ? [{ type: "concentration", message: paidRiskSources.length === 1 ? "Single paid platform connected" : `${paidTopSpendShare.toFixed(0)}% paid spend concentration` }] : []),
    ...(trendRisk ? [{ type: "trend", message: `Performance declining ${Math.abs(trendPercentage).toFixed(0)}% - intervention needed` }] : []),
    ...(aggregateMetricAvailable("roi") && aggregateMetricValue("roi") < 0 ? [{ type: "performance", message: "Negative ROI - immediate optimization required" }] : []),
    ...(aggregateMetricAvailable("roas") && aggregateMetricValue("roas") < 1 ? [{ type: "performance", message: "ROAS below breakeven - review campaign strategy" }] : []),
    ...(riskKpiMissCount > 0 ? [{ type: "kpi", message: `${riskKpiMissCount} KPI${riskKpiMissCount === 1 ? " is" : "s are"} below target` }] : []),
    ...(riskBenchmarkMissCount > 0 ? [{ type: "benchmark", message: `${riskBenchmarkMissCount} benchmark${riskBenchmarkMissCount === 1 ? " is" : "s are"} classified behind benchmark` }] : []),
    ...riskFreshnessWarnings.map((warning: any) => ({ type: "freshness", message: warning.message })),
  ];
  const displayedRiskLevel = (aggregateMetricAvailable("roi") && aggregateMetricValue("roi") < 0) || riskFreshnessWarnings.some((warning: any) => warning.severity === "high")
    ? "high"
    : displayedRiskFactors.length > 0 ? "medium" : "low";
  const displayedRiskExplanation = displayedRiskLevel === "low"
    ? hasMonitorConditions
      ? "No configured risk factor meets the risk threshold; lower-severity exceptions require monitoring."
      : "No configured risk factors identified from available connected-source inputs."
    : "Risk factors include configured KPI and Benchmark evaluations from their connected-source reporting contracts.";
  const executiveSummaryNarrative = `${(campaign as any)?.name}: ${executiveMetricSummary} Risk level is ${displayedRiskLevel}. ${executiveTrajectorySummary}`;
  const kpiRiskStatus = riskKpiMissCount > 0 ? "Risk" : executiveKpiProgress.length > 0 ? "No Risk" : "Not Applicable";
  const kpiRiskDetail = riskKpiMissCount > 0
    ? `${riskKpiMissCount} KPI${riskKpiMissCount === 1 ? " is" : "s are"} classified below target`
    : executiveKpiProgress.length > 0 ? "Mapped KPIs meet the configured target policy" : "No evaluable campaign KPIs available";
  const benchmarkRiskStatus = riskBenchmarkMissCount > 0 ? "Risk" : benchmarkMonitorCount > 0 ? "Monitor" : executiveBenchmarkComparison.length > 0 ? "No Risk" : "Not Applicable";
  const benchmarkRiskDetail = riskBenchmarkMissCount > 0
    ? `${riskBenchmarkMissCount} benchmark${riskBenchmarkMissCount === 1 ? " is" : "s are"} classified behind${benchmarkMonitorCount > 0 ? `; ${benchmarkMonitorCount} additional benchmark${benchmarkMonitorCount === 1 ? " is" : "s are"} classified needs attention` : ""}`
    : benchmarkMonitorCount > 0
      ? `${benchmarkMonitorCount} benchmark${benchmarkMonitorCount === 1 ? " is" : "s are"} classified needs attention; none is classified behind`
      : executiveBenchmarkComparison.length > 0 ? "Mapped benchmarks are on track" : "No evaluable campaign benchmarks available";
  const riskInputRows = [
    { label: "KPI Risk", status: kpiRiskStatus, detail: kpiRiskDetail },
    { label: "Benchmark Risk", status: benchmarkRiskStatus, detail: benchmarkRiskDetail },
    { label: "Data Freshness", status: riskFreshnessWarnings.length > 0 ? "Risk" : "No Risk", detail: riskFreshnessWarnings.length > 0 ? `${riskFreshnessWarnings.length} stale source warning${riskFreshnessWarnings.length === 1 ? "" : "s"}` : hasAuthoritativeGA4Window ? `GA4 outcome metrics cover through ${currentValueWindow.endDate}` : "No stale connected-source warnings" },
    { label: "ROI / ROAS Risk", status: roiRoasRisk ? "Risk" : aggregateMetricAvailable("roi") || aggregateMetricAvailable("roas") ? "No Risk" : "Not Applicable", detail: aggregateMetricAvailable("roi") || aggregateMetricAvailable("roas") ? [aggregateMetricAvailable("roi") ? `ROI ${formatAggregatePercent("roi")}` : null, aggregateMetricAvailable("roas") ? `ROAS ${formatAggregateRatio("roas")}` : null].filter(Boolean).join(", ") : "ROI and ROAS unavailable from connected sources" },
    { label: "7-Day Trend Risk", status: trendRisk ? "Risk" : executiveTrajectory ? "No Risk" : "Not Enough History", detail: executiveTrajectory ? `${executiveTrajectory}${trendPercentage ? ` (${trendPercentage.toFixed(1)}%)` : ""}` : executiveTrajectoryUnavailableDetail },
    { label: "Paid Platform Concentration Risk", status: paidRiskSources.length === 0 ? "Not Applicable" : paidConcentrationRisk ? "Risk" : "No Risk", detail: paidRiskSources.length === 0 ? "No connected paid-media source" : paidConcentrationRisk ? (paidRiskSources.length === 1 ? "Only one paid platform connected" : `${paidTopSpendShare.toFixed(0)}% of paid spend is concentrated`) : "Paid source mix is not concentrated" },
  ];
  const formatKpiValue = (metricName: string | null, value: number, unit: string = "") => {
    if (metricName && ["revenue", "spend", "cpa", "cpc", "cpm"].includes(metricName)) return formatCurrency(value, true);
    if (metricName && ["roi", "ctr", "cvr"].includes(metricName)) return `${value.toFixed(2)}%`;
    if (metricName === "roas") return `${value.toFixed(2)}x`;
    if (metricName && ["users", "sessions", "conversions", "clicks", "impressions"].includes(metricName)) return Math.trunc(value).toLocaleString();
    if (unit === "$" || /^[A-Z]{3}$/.test(unit)) return formatCurrency(value, true);
    if (unit === "%") return `${value.toFixed(2)}%`;
    if (unit === "ratio") return `${value.toFixed(2)}x`;
    if (unit === "count") return Math.trunc(value).toLocaleString();
    return `${value}${unit}`;
  };
  const funnelPathLabel = `${reachMetricLabels[reachMetricKey]} -> ${engagementMetricLabels[engagementMetricKey]} -> Conversions -> Revenue`;
  const reachStageQuestion = reachMetricKey === "impressions" ? "Are enough people seeing the campaign?" : "Are enough people reaching the site?";
  const engagementStageQuestion = engagementMetricKey === "clicks" ? "Are people clicking through?" : "Are people starting sessions?";

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
                <Link href={`/campaigns/${(campaign as any)?.id}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Campaign
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Executive Summary</h1>
                  <p className="text-muted-foreground/70 mt-1">{(campaign as any)?.name}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="space-y-6">
              {/* Campaign Trajectory & Risk */}
              <Card className="mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                      <div>
                        <div className="text-sm text-muted-foreground/70 mb-1">7-Day Snapshot Trajectory</div>
                        {executiveTrajectory ? (
                          <div className="flex items-center space-x-2">
                            {executiveTrajectory === 'accelerating' && <TrendingUp className="w-5 h-5 text-green-600" />}
                            {executiveTrajectory === 'declining' && <TrendingDown className="w-5 h-5 text-red-600" />}
                            {executiveTrajectory === 'stable' && <Activity className="w-5 h-5 text-blue-600" />}
                            <span className="text-lg font-medium text-foreground capitalize">
                              {executiveTrajectory}
                            </span>
                          </div>
                        ) : (
                          <div className="text-lg font-medium text-muted-foreground">Not enough history</div>
                        )}
                        <p className="text-xs text-muted-foreground/70 mt-1">{executiveTrajectoryUnavailableDetail}</p>
                      </div>
                      <div className="border-l border-border pl-6">
                        <div className="text-sm text-muted-foreground/70 mb-1">Risk Level</div>
                        <Badge className={
                          displayedRiskLevel === 'low' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          displayedRiskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                          'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        }>
                          {displayedRiskLevel.toUpperCase()}
                        </Badge>
                        <p className="text-xs text-muted-foreground/70 mt-2 max-w-xs">
                          {displayedRiskExplanation}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* CEO Summary */}
                  <div className="mt-6 p-4 bg-muted rounded-lg border border-border">
                    <div className="flex items-start space-x-3">
                      <Briefcase className="w-5 h-5 text-muted-foreground/70 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-foreground mb-1">Executive Summary</div>
                        <p className="text-sm text-foreground/80/60 leading-relaxed">
                          {executiveSummaryNarrative}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Marketing Funnel Visualization */}
              <Card className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900/20">
                <CardHeader>
                  <div className="space-y-1">
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5" />
                      <span>Marketing Funnel Performance</span>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground/70">{funnelPathLabel}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Top of Funnel - Audience Reach */}
                    <div className="relative">
                      <div className="flex items-center justify-between bg-orange-100 dark:bg-orange-900/30 rounded-lg p-6 border-2 border-orange-300 dark:border-orange-700">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                            <Eye className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-orange-900 dark:text-orange-300 uppercase tracking-wide">Top of Funnel</div>
                            <div className="text-xs text-orange-700 dark:text-orange-400 mt-1">{reachStageQuestion}</div>
                            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100 mt-1">
                              {formatAggregateInteger(reachMetricKey)} {reachMetricLabels[reachMetricKey]}
                            </div>
                            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
                              {aggregateMetricSourceLabel(reachMetricKey)}
                            </div>
                          </div>
                        </div>
                        {aggregateMetricAvailable("ctr") && (
                          <div className="text-right">
                            <div className="text-sm text-orange-700 dark:text-orange-400">Click-Through Rate</div>
                            <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">{formatAggregatePercent("ctr")}</div>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-center my-2">
                        <ArrowDownRight className="w-8 h-8 text-muted-foreground/70" />
                      </div>
                    </div>

                    {/* Mid Funnel - Clicks */}
                    <div className="relative ml-8 mr-8">
                      <div className="flex items-center justify-between bg-indigo-100 dark:bg-indigo-900/30 rounded-lg p-6 border-2 border-indigo-300 dark:border-indigo-700">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center">
                            <Target className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wide">Mid Funnel</div>
                            <div className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">{engagementStageQuestion}</div>
                            <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 mt-1">
                              {formatAggregateInteger(engagementMetricKey)} {engagementMetricLabels[engagementMetricKey]}
                            </div>
                            <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                              {aggregateMetricSourceLabel(engagementMetricKey)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="space-y-2">
                            {aggregateMetricAvailable("engagementRate") && (
                              <div>
                                <div className="text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                                  Engagement Rate
                                </div>
                                <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                                  {formatAggregatePercent("engagementRate")}
                                </div>
                              </div>
                            )}
                            <div>
                              <div className="text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                                {conversionRateLabel}
                              </div>
                              <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                                {formatAggregatePercent("cvr")}
                              </div>
                              {!aggregateMetricAvailable("cvr") && (
                                <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 max-w-48">
                                  {aggregateMetricReason("cvr")}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-center my-2">
                        <ArrowDownRight className="w-8 h-8 text-muted-foreground/70" />
                      </div>
                    </div>

                    {/* Bottom of Funnel - Conversions & Revenue */}
                    <div className="relative ml-16 mr-16">
                      <div className="bg-gradient-to-r from-purple-100 to-green-100 dark:from-purple-900/30 dark:to-green-900/30 rounded-lg p-6 border-2 border-purple-300 dark:border-purple-700">
                        <div className="text-center mb-4">
                          <div className="text-sm font-semibold text-purple-900 dark:text-purple-300 uppercase tracking-wide">Bottom of Funnel</div>
                          <div className="text-xs text-purple-700 dark:text-purple-400 mt-1">Are visits becoming conversions and revenue?</div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="flex justify-center mb-2">
                              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                                <Zap className="w-5 h-5 text-white" />
                              </div>
                            </div>
                            <div className="text-sm text-purple-700 dark:text-purple-400">Conversions</div>
                            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                              {formatAggregateInteger("conversions")}
                            </div>
                          </div>
                          <div className="text-center border-l border-r border-border dark:border-slate-600">
                            <div className="flex justify-center mb-2">
                              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                <DollarSign className="w-5 h-5 text-white" />
                              </div>
                            </div>
                            <div className="text-sm text-green-700 dark:text-green-400">Revenue</div>
                            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                              {formatAggregateCurrency("revenue")}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="flex justify-center mb-2">
                              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-white" />
                              </div>
                            </div>
                            <div className="text-sm text-blue-700 dark:text-blue-400">ROAS</div>
                            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                              {formatAggregateRatio("roas")}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-border dark:border-slate-600 text-center">
                          <div className="text-sm text-muted-foreground/70">Return on Investment</div>
                          <div className={`text-2xl font-bold ${!roiAvailable ? 'text-muted-foreground' : roiValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatAggregatePercent("roi")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Key Metrics Dashboard - Complete Funnel Flow */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card className="border-l-4 border-green-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground/70">Total Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground mb-1">
                      {formatAggregateCurrency("revenue")}
                    </div>
                    <div className="flex items-center text-muted-foreground/70">
                      <span className="text-sm font-medium">ROI: {formatAggregatePercent("roi")}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-blue-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground/70">Return on Ad Spend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground mb-1">
                      {formatAggregateRatio("roas")}
                    </div>
                    <div className="flex items-center text-muted-foreground/70">
                      <span className="text-sm font-medium">Spend: {formatAggregateCurrency("spend")}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-purple-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground/70">Total Conversions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground mb-1">
                      {formatAggregateInteger("conversions")}
                    </div>
                    <div className="flex items-center text-muted-foreground/70">
                      <span className="text-sm font-medium">CVR: {formatAggregatePercent("cvr")}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-indigo-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground/70">{engagementMetricLabels[engagementMetricKey]}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground mb-1">
                      {formatAggregateInteger(engagementMetricKey)}
                    </div>
                    <div className="flex items-center text-muted-foreground/70">
                      <span className="text-sm font-medium">
                        {aggregateMetricAvailable("cpc") ? `CPC: ${formatAggregateCurrency("cpc", true)}` : aggregateMetricSourceLabel(engagementMetricKey)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-orange-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground/70">{reachMetricLabels[reachMetricKey]}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground mb-1">
                      {formatAggregateInteger(reachMetricKey)}
                    </div>
                    <div className="flex items-center text-muted-foreground/70">
                      <span className="text-sm font-medium">
                        {aggregateMetricAvailable("ctr") ? `CTR: ${formatAggregatePercent("ctr")}` : aggregateMetricSourceLabel(reachMetricKey)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* KPI Exceptions */}
              {executiveKpiProgress.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="w-5 h-5" />
                      <span>KPI Status Unavailable</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      No campaign KPI has both an available value and a positive target in its configured connected-source reporting window.
                    </p>
                  </CardContent>
                </Card>
              )}
              {executiveKpiProgress.length > 0 && executiveKpiExceptions.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span>No KPI Exceptions</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      No below-target KPI was found among campaign KPIs evaluated in their configured connected-source reporting windows.
                    </p>
                  </CardContent>
                </Card>
              )}
              {executiveKpiExceptions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="w-5 h-5" />
                      <span>KPIs Needing Attention</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {executiveKpiExceptions.map((kpi: any, index: number) => {
                        const targetState = resolveExecutiveKpiTargetState(kpi);
                        const { executiveKpiMetric, current, target, band, fillPct } = targetState;
                        const statusLabel = band === "above" ? 'Above Target' :
                          band === "near" ? 'On Track' : 'Below Target';
                        const statusColor = band === "above" ? 'text-green-600 dark:text-green-400' :
                          band === "near" ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400';
                        const barColor = band === "above" ? 'bg-green-500' :
                          band === "near" ? 'bg-blue-500' : 'bg-red-500';
                        return (
                          <div key={index} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-foreground">{kpi.name}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-muted-foreground/70">
                                  {formatKpiValue(executiveKpiMetric, current, kpi.unit)}
                                  {' / '}
                                  {formatKpiValue(executiveKpiMetric, target, kpi.unit)}
                                </span>
                                <span className={`text-xs font-medium ${statusColor}`}>
                                  {statusLabel}
                                </span>
                              </div>
                            </div>
                            <Progress value={fillPct} className="h-2" indicatorClassName={barColor} />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Benchmark Exceptions */}
              {executiveBenchmarkComparison.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Award className="w-5 h-5" />
                      <span>Benchmark Status Unavailable</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      No campaign benchmark has both an available value and a positive target in its configured connected-source reporting window.
                    </p>
                  </CardContent>
                </Card>
              )}
              {executiveBenchmarkComparison.length > 0 && executiveBenchmarkExceptions.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span>No Benchmark Exceptions</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      No benchmark requiring attention was found among campaign benchmarks evaluated in their configured connected-source reporting windows.
                    </p>
                  </CardContent>
                </Card>
              )}
              {executiveBenchmarkExceptions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Award className="w-5 h-5" />
                      <span>Benchmarks Needing Attention</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {executiveBenchmarkExceptions.map((bm: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-border">
                          <div className="flex items-center space-x-3">
                            <div className={`w-2 h-8 rounded-full ${bm.status === 'on_track' ? 'bg-green-500' : bm.status === 'needs_attention' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                            <div>
                              <div className="text-sm font-medium text-foreground">{bm.metric}</div>
                              {bm.category && <div className="text-xs text-muted-foreground">{bm.category}</div>}
                            </div>
                          </div>
                          <div className="flex items-center space-x-6">
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Yours</div>
                              <div className="text-sm font-semibold text-foreground">
                                {formatKpiValue(bm.aggregateMetric, bm.yours, bm.unit)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Benchmark</div>
                              <div className="text-sm font-semibold text-muted-foreground/70">
                                {formatKpiValue(bm.aggregateMetric, bm.benchmark, bm.unit)}
                              </div>
                            </div>
                            <Badge className={bm.status === 'on_track' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : bm.status === 'needs_attention' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}>
                              {bm.delta}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Risk Assessment */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Risk Assessment</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {displayedRiskFactors.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground/70">
                      <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-2" />
                      <p className="font-medium">No configured risk factors meet the risk thresholds</p>
                      <p className="text-sm">{hasMonitorConditions ? "Lower-severity exceptions are identified as Monitor in the inputs below." : "Based on available connected-source inputs checked below."}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayedRiskFactors.map((risk: any, index: number) => (
                        <div key={index} className={`p-4 rounded-lg border ${
                          risk.type === 'performance' ? 'border-red-200 bg-red-50 dark:bg-red-900/20' :
                          risk.type === 'concentration' ? 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20' :
                          'border-orange-200 bg-orange-50 dark:bg-orange-900/20'
                        }`}>
                          <div className="flex items-start space-x-3">
                            <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                              risk.type === 'performance' ? 'text-red-600' :
                              risk.type === 'concentration' ? 'text-yellow-600' :
                              'text-orange-600'
                            }`} />
                            <div>
                              <div className="font-medium text-foreground capitalize mb-1">{risk.type} Risk</div>
                              <p className="text-sm text-foreground/80/60">{risk.message}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {riskInputRows.length > 0 && (
                    <div className="mt-5 border-t pt-4">
                      <div className="mb-3 text-sm font-medium text-foreground">Risk inputs</div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {riskInputRows.map((input: any, index: number) => (
                          <div key={index} className="rounded-md border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{input.label}</span>
                              <Badge variant="outline" className="capitalize">{String(input.status || "").replace(/_/g, " ")}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{input.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recommended Actions */}
              <div className="pt-2">
                <h2 className="text-2xl font-semibold text-foreground">Recommended Actions</h2>
              </div>
              {/* Data Accuracy Notice */}
              {!hasConnectedPaidMediaSource && hasWebAnalyticsOutcomeEvidence && (
                <Card className="border-border bg-muted">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Info className="w-5 h-5 text-muted-foreground/70 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-foreground/80/60">
                        <strong>Note:</strong> No connected paid-media source is available, so paid-media recommendations are unavailable. Available web analytics and outcome metrics can still feed website recommendations and risk inputs.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Freshness Warnings */}
              {riskFreshnessWarnings.length > 0 && (
                <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <div className="font-semibold text-yellow-900 dark:text-yellow-100">
                          Data Freshness Alert
                        </div>
                        {riskFreshnessWarnings.map((warning: any, idx: number) => (
                          <div key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>{warning.source}:</strong> {warning.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {sourceBackedRecommendations.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground/70">
                    <div className="mb-4">
                      <Zap className="w-12 h-12 mx-auto text-muted-foreground/70" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No Evidence-Backed Actions Available
                    </h3>
                    <p>Available campaign data and configured targets do not support a reliable recommendation yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {sourceBackedRecommendations.map((rec: any, index: number) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <CardTitle className="text-lg">{formatRecommendationText(rec.action)}</CardTitle>
                              {getPriorityBadge(rec.priority)}
                              {rec.confidence && (
                                <Badge variant="outline" className={
                                  rec.confidence === 'high' ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300' :
                                  rec.confidence === 'medium' ? 'border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-300' :
                                  'border-border text-foreground/80/60'
                                }>
                                  {rec.confidence} confidence
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground/70 mt-1">{rec.category}</div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Current Evidence and Next Step</div>
                          <ul className="list-disc pl-4 space-y-1 text-sm text-green-700 dark:text-green-300">
                            {getRecommendationExpectedImpactItems(rec).map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>

                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
          </div>
        </main>
      </div>
    </div>
  );
}
