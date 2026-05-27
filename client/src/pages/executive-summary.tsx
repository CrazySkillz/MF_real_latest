import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, TrendingUp, TrendingDown, Target, Users, DollarSign, Award, AlertTriangle, CheckCircle, Zap, Eye, BarChart3, Clock, ArrowUpRight, ArrowDownRight, Brain, Activity, Info, FlaskConical, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar } from "recharts";
import { format } from "date-fns";
import { formatPct } from "@shared/metric-math";

export default function ExecutiveSummary() {
  const { id: campaignId } = useParams();
  const [demoMode, setDemoMode] = useState(false);

  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: executiveSummary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "executive-summary", demoMode ? "demo" : "live"],
    enabled: !!campaignId,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (demoMode) params.set("demo", "1");
      const url = `/api/campaigns/${campaignId}/executive-summary${params.toString() ? "?" + params.toString() : ""}`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const executiveOutcomeDateRange = "90days";
  const { data: outcomeTotals, isLoading: outcomeTotalsLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/outcome-totals`, executiveOutcomeDateRange, demoMode ? "demo" : "live", "executive-summary"],
    enabled: !!campaignId,
    queryFn: async () => {
      const url = `/api/campaigns/${campaignId}/outcome-totals?dateRange=${executiveOutcomeDateRange}${demoMode ? "&demo=1" : ""}`;
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  if (campaignLoading || summaryLoading || outcomeTotalsLoading) {
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

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatCurrency = (amount: number, showCents: boolean = false) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    }).format(amount);
  };

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

  const performanceSummary = (outcomeTotals as any)?.performanceSummary || (executiveSummary as any).performanceSummary;
  const aggregateMetric = (metricName: string) => (performanceSummary as any)?.totals?.[metricName];
  const aggregateMetricAvailable = (metricName: string) => aggregateMetric(metricName)?.available === true;
  const aggregateMetricValue = (metricName: string): number => {
    const metric = aggregateMetric(metricName);
    return metric?.available === true && metric?.value !== null ? Number(metric.value) || 0 : 0;
  };
  const aggregateMetricReason = (metricName: string): string => {
    const reasons = aggregateMetric(metricName)?.unavailableReasons;
    return Array.isArray(reasons) && reasons.length > 0 ? reasons[0] : "Not available from connected sources";
  };
  const aggregateMetricSourceLabel = (metricName: string): string => {
    const sources = aggregateMetric(metricName)?.sources;
    return Array.isArray(sources) && sources.length > 0 ? `Sources: ${sources.join(", ")}` : aggregateMetricReason(metricName);
  };
  const formatAggregateNumber = (metricName: string) =>
    aggregateMetricAvailable(metricName) ? formatNumber(aggregateMetricValue(metricName)) : "Unavailable";
  const formatAggregateInteger = (metricName: string) =>
    aggregateMetricAvailable(metricName) ? Math.round(aggregateMetricValue(metricName)).toLocaleString() : "Unavailable";
  const formatAggregateCurrency = (metricName: string, showCents: boolean = false) =>
    aggregateMetricAvailable(metricName) ? formatCurrency(aggregateMetricValue(metricName), showCents) : "Unavailable";
  const formatAggregatePercent = (metricName: string) =>
    aggregateMetricAvailable(metricName) ? formatPct(aggregateMetricValue(metricName)) : "Unavailable";
  const formatAggregateRatio = (metricName: string) =>
    aggregateMetricAvailable(metricName) ? `${aggregateMetricValue(metricName).toFixed(1)}x` : "Unavailable";
  const formatRecommendationExpectedImpact = (rec: any): string => {
    if (rec?.category !== "Website Outcomes") return formatRecommendationText(rec?.expectedImpact || "");
    const webMetrics: string[] = [];
    if (aggregateMetricAvailable("users")) webMetrics.push(`${Math.round(aggregateMetricValue("users")).toLocaleString()} users`);
    if (aggregateMetricAvailable("sessions")) webMetrics.push(`${Math.round(aggregateMetricValue("sessions")).toLocaleString()} sessions`);
    if (aggregateMetricAvailable("conversions")) webMetrics.push(`${Math.round(aggregateMetricValue("conversions")).toLocaleString()} conversions`);
    if (aggregateMetricAvailable("revenue")) webMetrics.push(formatAggregateCurrency("revenue"));
    if (aggregateMetricAvailable("cvr")) webMetrics.push(`${aggregateMetricValue("cvr").toFixed(1)}% conversion rate`);
    const expectedImpact = String(rec?.expectedImpact || "");
    const unavailableTargetText = "No KPI or Benchmark target is available for conversion rate, revenue, or conversions, so quality cannot be judged yet.";
    const targetText = expectedImpact.includes(unavailableTargetText)
      ? unavailableTargetText
      : (expectedImpact.match(/KPI or Benchmark targets exist for [^.]+; compare against those targets before judging quality\./)?.[0] || "");
    const metricText = webMetrics.length > 0 ? `Available data: ${webMetrics.join(", ")}. ` : "";
    return formatRecommendationText(`${metricText}${targetText ? `${targetText} ` : ""}Shows whether available users or sessions are turning into conversions and revenue before spend changes are considered`);
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
    ? `Current connected-source metrics show ${executiveMetricParts.join(" and ")}.`
    : "Current connected-source metrics do not include enough spend and revenue to calculate ROI or ROAS.";
  const executiveTrajectory = (executiveSummary as any)?.health?.trajectory;
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
  const lowerIsBetterKpiMetrics = new Set(["cpa", "cpc", "cpm"]);
  const executiveKpiProgress = Array.isArray((executiveSummary as any).kpiProgress)
    ? (executiveSummary as any).kpiProgress.filter((kpi: any) => resolveKpiAggregateMetric(kpi))
    : [];
  const executiveBenchmarkComparison = Array.isArray((executiveSummary as any).benchmarkComparison)
    ? (executiveSummary as any).benchmarkComparison
      .map((bm: any) => {
        const aggregateBenchmarkMetric = resolveKpiAggregateMetric(bm);
        if (!aggregateBenchmarkMetric) return null;
        const yours = aggregateMetricValue(aggregateBenchmarkMetric);
        const benchmark = Number(bm.benchmark) || 0;
        const lowerIsBetter = lowerIsBetterKpiMetrics.has(aggregateBenchmarkMetric);
        const deltaPct = benchmark > 0
          ? lowerIsBetter
            ? ((benchmark - yours) / benchmark) * 100
            : ((yours - benchmark) / benchmark) * 100
          : 0;
        const progressRatio = benchmark > 0
          ? lowerIsBetter
            ? (yours > 0 ? benchmark / yours : 0)
            : yours / benchmark
          : 0;
        const progressPct = progressRatio * 100;
        return {
          ...bm,
          aggregateMetric: aggregateBenchmarkMetric,
          yours,
          delta: `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`,
          status: progressPct >= 90 ? 'on_track' : progressPct >= 70 ? 'needs_attention' : 'behind',
        };
      })
      .filter(Boolean)
    : [];
  const kpiProgressPct = (kpi: any): number => {
    const aggregateKpiMetric = resolveKpiAggregateMetric(kpi);
    if (!aggregateKpiMetric) return 0;
    const current = aggregateMetricValue(aggregateKpiMetric);
    const target = Number(kpi.target) || 0;
    const lowerIsBetter = lowerIsBetterKpiMetrics.has(aggregateKpiMetric);
    const progressRatio = target > 0
      ? lowerIsBetter
        ? (current > 0 ? target / current : 1)
        : current / target
      : 0;
    return progressRatio * 100;
  };
  const riskKpiMissCount = executiveKpiProgress.filter((kpi: any) => kpiProgressPct(kpi) < 70).length;
  const riskBenchmarkMissCount = executiveBenchmarkComparison.filter((bm: any) => bm.status === "behind").length;
  const riskFreshnessWarnings = Array.isArray((executiveSummary as any)?.dataFreshness?.warnings) ? (executiveSummary as any).dataFreshness.warnings : [];
  const trendPercentage = Number((executiveSummary as any)?.health?.trendPercentage) || 0;
  const aggregateSources = Array.isArray((performanceSummary as any)?.sources) ? (performanceSummary as any).sources : [];
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
    ...(riskKpiMissCount > 0 ? [{ type: "kpi", message: `${riskKpiMissCount} KPI${riskKpiMissCount === 1 ? " is" : "s are"} below 70% of target` }] : []),
    ...(riskBenchmarkMissCount > 0 ? [{ type: "benchmark", message: `${riskBenchmarkMissCount} benchmark${riskBenchmarkMissCount === 1 ? " is" : "s are"} below 70% of benchmark` }] : []),
    ...riskFreshnessWarnings.map((warning: any) => ({ type: "freshness", message: warning.message })),
  ];
  const displayedRiskLevel = (aggregateMetricAvailable("roi") && aggregateMetricValue("roi") < 0) || riskFreshnessWarnings.some((warning: any) => warning.severity === "high")
    ? "high"
    : displayedRiskFactors.length > 0 ? "medium" : "low";
  const displayedRiskExplanation = displayedRiskLevel === "low"
    ? "No configured risk factors identified from available connected-source inputs."
    : "Risk factors are based on the same connected-source inputs used by the visible Executive Summary metrics.";
  const executiveSummaryNarrative = `${(campaign as any)?.name}: ${executiveMetricSummary} Risk level is ${displayedRiskLevel}. ${executiveTrajectorySummary}`;
  const riskInputRows = [
    { label: "KPI Risk", status: riskKpiMissCount > 0 ? "Risk" : executiveKpiProgress.length > 0 ? "No Risk" : "Not Applicable", detail: riskKpiMissCount > 0 ? `${riskKpiMissCount} KPI${riskKpiMissCount === 1 ? " is" : "s are"} below 70% of target` : executiveKpiProgress.length > 0 ? "Mapped KPIs are at or above 70% of target" : "No mapped campaign KPIs available" },
    { label: "Benchmark Risk", status: riskBenchmarkMissCount > 0 ? "Risk" : executiveBenchmarkComparison.length > 0 ? "No Risk" : "Not Applicable", detail: riskBenchmarkMissCount > 0 ? `${riskBenchmarkMissCount} benchmark${riskBenchmarkMissCount === 1 ? " is" : "s are"} below 70% of benchmark` : executiveBenchmarkComparison.length > 0 ? "Mapped benchmarks are at or above 70% of benchmark" : "No mapped campaign benchmarks available" },
    { label: "Data Freshness", status: riskFreshnessWarnings.length > 0 ? "Risk" : "No Risk", detail: riskFreshnessWarnings.length > 0 ? `${riskFreshnessWarnings.length} stale source warning${riskFreshnessWarnings.length === 1 ? "" : "s"}` : "No stale connected-source warnings" },
    { label: "ROI / ROAS Risk", status: roiRoasRisk ? "Risk" : aggregateMetricAvailable("roi") || aggregateMetricAvailable("roas") ? "No Risk" : "Not Applicable", detail: aggregateMetricAvailable("roi") || aggregateMetricAvailable("roas") ? [aggregateMetricAvailable("roi") ? `ROI ${formatAggregatePercent("roi")}` : null, aggregateMetricAvailable("roas") ? `ROAS ${formatAggregateRatio("roas")}` : null].filter(Boolean).join(", ") : "ROI and ROAS unavailable from connected sources" },
    { label: "7-Day Trend Risk", status: trendRisk ? "Risk" : executiveTrajectory ? "No Risk" : "Not Enough History", detail: executiveTrajectory ? `${executiveTrajectory}${trendPercentage ? ` (${trendPercentage.toFixed(1)}%)` : ""}` : "Not enough compatible aggregate snapshot history" },
    { label: "Paid Platform Concentration Risk", status: paidRiskSources.length === 0 ? "Not Applicable" : paidConcentrationRisk ? "Risk" : "No Risk", detail: paidRiskSources.length === 0 ? "No connected paid-media source" : paidConcentrationRisk ? (paidRiskSources.length === 1 ? "Only one paid platform connected" : `${paidTopSpendShare.toFixed(0)}% of paid spend is concentrated`) : "Paid source mix is not concentrated" },
  ];
  const formatKpiValue = (metricName: string | null, value: number, unit: string = "") => {
    if (metricName && ["revenue", "spend", "cpa", "cpc", "cpm"].includes(metricName)) return formatCurrency(value, metricName !== "revenue" && metricName !== "spend");
    if (metricName && ["roi", "ctr", "cvr"].includes(metricName)) return formatPct(value);
    if (metricName === "roas") return `${value.toFixed(1)}x`;
    if (metricName && ["users", "sessions", "conversions", "clicks", "impressions"].includes(metricName)) return Math.round(value).toLocaleString();
    if (unit === "$") return formatCurrency(value);
    if (unit === "%") return `${value.toFixed(1)}%`;
    if (unit === "ratio") return `${value.toFixed(1)}x`;
    if (unit === "count") return Math.round(value).toLocaleString();
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
              <div className="flex items-center space-x-4">
                <Button
                  variant={demoMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDemoMode(!demoMode)}
                >
                  <FlaskConical className="w-4 h-4 mr-1" />
                  {demoMode ? "Demo On" : "Demo Data"}
                </Button>
              </div>
            </div>
          </div>

          {demoMode && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <FlaskConical className="w-4 h-4 inline mr-1" />
                Showing demo data for testing. Toggle off to see real executive summary data.
              </p>
            </div>
          )}

          {/* Executive Summary Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Executive Overview</TabsTrigger>
              <TabsTrigger value="recommendations">Strategic Recommendations</TabsTrigger>
            </TabsList>

            {/* Executive Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Campaign Trajectory & Risk */}
              <Card className="mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                      <div>
                        <div className="text-sm text-muted-foreground/70 mb-1">7-Day Snapshot Trajectory</div>
                        {(executiveSummary as any).health.trajectory ? (
                          <div className="flex items-center space-x-2">
                            {(executiveSummary as any).health.trajectory === 'accelerating' && <TrendingUp className="w-5 h-5 text-green-600" />}
                            {(executiveSummary as any).health.trajectory === 'declining' && <TrendingDown className="w-5 h-5 text-red-600" />}
                            {(executiveSummary as any).health.trajectory === 'stable' && <Activity className="w-5 h-5 text-blue-600" />}
                            <span className="text-lg font-medium text-foreground capitalize">
                              {(executiveSummary as any).health.trajectory}
                            </span>
                          </div>
                        ) : (
                          <div className="text-lg font-medium text-muted-foreground">Not enough history</div>
                        )}
                        <p className="text-xs text-muted-foreground/70 mt-1">Based on compatible aggregate snapshots, not the removed date selector.</p>
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
                              {formatAggregateNumber(reachMetricKey)} {reachMetricLabels[reachMetricKey]}
                            </div>
                            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
                              {aggregateMetricSourceLabel(reachMetricKey)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-orange-700 dark:text-orange-400">Click-Through Rate</div>
                          <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">{formatAggregatePercent("ctr")}</div>
                          {!aggregateMetricAvailable("ctr") && (
                            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 max-w-48">
                              {aggregateMetricReason("ctr")}
                            </div>
                          )}
                        </div>
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
                              {formatAggregateNumber(engagementMetricKey)} {engagementMetricLabels[engagementMetricKey]}
                            </div>
                            <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                              {aggregateMetricSourceLabel(engagementMetricKey)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="space-y-2">
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
                            {(executiveSummary as any).metrics.totalCvr > 100 && (
                              <div className="pt-1 border-t border-indigo-200 dark:border-indigo-700">
                                <div className="text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                                  Total CVR (w/ view-through)
                                </div>
                                <div className="text-xl font-semibold text-indigo-700 dark:text-indigo-300">
                                  {formatPct((executiveSummary as any).metrics.totalCvr)}
                                </div>
                              </div>
                            )}
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
                      {formatAggregateNumber(engagementMetricKey)}
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
                      {formatAggregateNumber(reachMetricKey)}
                    </div>
                    <div className="flex items-center text-muted-foreground/70">
                      <span className="text-sm font-medium">
                        {aggregateMetricAvailable("ctr") ? `CTR: ${formatAggregatePercent("ctr")}` : aggregateMetricSourceLabel(reachMetricKey)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* KPI Progress */}
              {executiveKpiProgress.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="w-5 h-5" />
                      <span>KPI Progress</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {executiveKpiProgress.map((kpi: any, index: number) => {
                        const aggregateKpiMetric = resolveKpiAggregateMetric(kpi);
                        if (!aggregateKpiMetric) return null;
                        const current = aggregateMetricValue(aggregateKpiMetric);
                        const target = Number(kpi.target) || 0;
                        const lowerIsBetter = lowerIsBetterKpiMetrics.has(aggregateKpiMetric);
                        const targetDeltaPct = target > 0
                          ? lowerIsBetter
                            ? ((target - current) / target) * 100
                            : ((current - target) / target) * 100
                          : 0;
                        const progressRatio = target > 0
                          ? lowerIsBetter
                            ? (current > 0 ? target / current : 1)
                            : current / target
                          : 0;
                        const pct = Math.max(0, Math.min(progressRatio * 100, 100));
                        const statusLabel = targetDeltaPct > 5 ? 'Above Target' :
                          targetDeltaPct >= -5 ? 'On Track' : 'Below Target';
                        const statusColor = targetDeltaPct > 5 ? 'text-green-600 dark:text-green-400' :
                          targetDeltaPct >= -5 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400';
                        const barColor = targetDeltaPct > 5 ? 'bg-green-500' :
                          targetDeltaPct >= -5 ? 'bg-blue-500' : 'bg-red-500';
                        return (
                          <div key={index} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-foreground">{kpi.name}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-muted-foreground/70">
                                  {formatKpiValue(aggregateKpiMetric, current, kpi.unit)}
                                  {' / '}
                                  {formatKpiValue(aggregateKpiMetric, target, kpi.unit)}
                                </span>
                                <span className={`text-xs font-medium ${statusColor}`}>
                                  {statusLabel}
                                </span>
                              </div>
                            </div>
                            <Progress value={pct} className="h-2" indicatorClassName={barColor} />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Benchmark Comparison */}
              {executiveBenchmarkComparison.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Award className="w-5 h-5" />
                      <span>Benchmark Comparison</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {executiveBenchmarkComparison.map((bm: any, index: number) => (
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
                      <p className="font-medium">No configured risk factors identified</p>
                      <p className="text-sm">Based on available connected-source inputs checked below.</p>
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

            </TabsContent>

            {/* Strategic Recommendations Tab */}
            <TabsContent value="recommendations" className="space-y-6">
              {/* Data Accuracy Notice */}
              {(executiveSummary as any).metadata?.dataAccuracy?.platformsExcludedFromRecommendations?.length > 0 && (
                <Card className="border-border bg-muted">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Info className="w-5 h-5 text-muted-foreground/70 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-foreground/80/60">
                        <strong>Note:</strong> {(executiveSummary as any).metadata.dataAccuracy.platformsExcludedFromRecommendations.join(', ')} {(executiveSummary as any).metadata.dataAccuracy.platformsExcludedFromRecommendations.length === 1 ? 'is' : 'are'} not a connected paid-media source, so paid-media recommendations are unavailable. Available web analytics and outcome metrics can still feed website recommendations and risk inputs.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Freshness Warnings */}
              {(executiveSummary as any).dataFreshness?.warnings?.length > 0 && (
                <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <div className="font-semibold text-yellow-900 dark:text-yellow-100">
                          Data Freshness Alert
                        </div>
                        {(executiveSummary as any).dataFreshness.warnings.map((warning: any, idx: number) => (
                          <div key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>{warning.source}:</strong> {warning.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Enterprise Disclaimer */}
              {(executiveSummary as any).metadata?.disclaimer && (
                <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-900 dark:text-blue-100">
                        {(executiveSummary as any).metadata.disclaimer}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {(executiveSummary as any).recommendations.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground/70">
                    <div className="mb-4">
                      <Zap className="w-12 h-12 mx-auto text-muted-foreground/70" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No Recommendations Available
                    </h3>
                    <p>Campaign is performing well. Continue monitoring for optimization opportunities.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {(executiveSummary as any).recommendations.map((rec: any, index: number) => (
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
                        <div className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Expected Impact</div>
                              <div className="text-sm text-green-700 dark:text-green-300">{formatRecommendationExpectedImpact(rec)}</div>
                            </div>
                            
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Timeframe</div>
                              <div className="text-sm text-blue-700 dark:text-blue-300">{rec.timeline}</div>
                            </div>
                            
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                              <div className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">Investment Required</div>
                              <div className="text-sm text-purple-700 dark:text-purple-300">{formatRecommendationText(rec.investmentRequired)}</div>
                            </div>
                          </div>

                          {/* Scenario Planning */}
                          {rec.scenarios && (
                            <div className="border-t pt-4">
                              <div className="text-sm font-semibold text-foreground mb-3">Projected Scenarios</div>
                              <div className="grid gap-3 md:grid-cols-3">
                                <div className="p-3 bg-muted rounded border border-border">
                                  <div className="text-xs font-medium text-muted-foreground/70 mb-1">Best Case</div>
                                  <div className="text-sm font-semibold text-foreground">{formatRecommendationText(rec.scenarios.bestCase)}</div>
                                </div>
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-700">
                                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Expected</div>
                                  <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">{formatRecommendationText(rec.scenarios.expected)}</div>
                                </div>
                                <div className="p-3 bg-muted rounded border border-border">
                                  <div className="text-xs font-medium text-muted-foreground/70 mb-1">Worst Case</div>
                                  <div className="text-sm font-semibold text-foreground">{formatRecommendationText(rec.scenarios.worstCase)}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Assumptions */}
                          {rec.assumptions && rec.assumptions.length > 0 && (
                            <div className="border-t pt-4">
                              <div className="text-sm font-semibold text-foreground mb-2">Key Assumptions</div>
                              <ul className="space-y-1">
                                {rec.assumptions.map((assumption: string, idx: number) => (
                                  <li key={idx} className="text-sm text-muted-foreground/70 flex items-start">
                                    <span className="mr-2">•</span>
                                    <span>{assumption}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Recommendation-specific disclaimer */}
                          {rec.disclaimer && (
                            <div className="border-t pt-4">
                              <div className="text-xs italic text-muted-foreground/70 bg-muted p-3 rounded">
                                {rec.disclaimer}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
