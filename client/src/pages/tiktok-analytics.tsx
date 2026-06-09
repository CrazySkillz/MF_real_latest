import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, AlertCircle, AlertTriangle, BarChart3, CheckCircle2, DollarSign, Eye, MousePointer, Percent, Target, TrendingUp, Trophy, Video } from "lucide-react";
import { SiTiktok } from "react-icons/si";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function formatCurrency(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString();
}

function formatPct(value: number | null) {
  return value === null || value === undefined ? "Unavailable" : `${value.toFixed(2)}%`;
}

const REVENUE_DEPENDENT_METRICS = new Set(["totalrevenue", "revenue", "roi", "roas", "profit"]);

function normalizeMetricKey(value: any) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatGoalValue(row: any, hasAttributedRevenue: boolean) {
  const metricKey = normalizeMetricKey(row?.metric);
  if (REVENUE_DEPENDENT_METRICS.has(metricKey) && !hasAttributedRevenue) {
    return { value: "Unavailable", helper: "Requires TikTok-scoped attributed revenue." };
  }
  const raw = row?.currentValue;
  if (raw === null || raw === undefined || raw === "") return { value: "Unavailable", helper: undefined };
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return { value: String(raw), helper: undefined };
  const unit = String(row?.unit || "").toLowerCase();
  if (unit === "$" || unit === "currency") return { value: formatCurrency(numeric), helper: undefined };
  if (unit === "%" || unit === "percent") return { value: `${numeric.toFixed(2)}%`, helper: undefined };
  if (unit === "ratio" || metricKey === "roas") return { value: `${numeric.toFixed(2)}x`, helper: undefined };
  return { value: numeric.toLocaleString(), helper: undefined };
}

function getGoalNumericValue(row: any, hasAttributedRevenue: boolean) {
  const metricKey = normalizeMetricKey(row?.metric);
  if (REVENUE_DEPENDENT_METRICS.has(metricKey) && !hasAttributedRevenue) return null;
  const value = Number(row?.currentValue);
  return Number.isFinite(value) ? value : null;
}

function getTargetNumericValue(row: any) {
  const value = Number(row?.targetValue);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getGoalProgress(row: any, hasAttributedRevenue: boolean) {
  const current = getGoalNumericValue(row, hasAttributedRevenue);
  const target = getTargetNumericValue(row);
  if (current === null || target === null) return null;
  return (current / target) * 100;
}

function buildGoalTracker(rows: any[], hasAttributedRevenue: boolean) {
  const progress = rows
    .map((row) => getGoalProgress(row, hasAttributedRevenue))
    .filter((value): value is number => Number.isFinite(value));
  return {
    total: rows.length,
    above: progress.filter((value) => value > 105).length,
    near: progress.filter((value) => value >= 95 && value <= 105).length,
    below: progress.filter((value) => value < 95).length,
    avgPct: progress.length > 0 ? progress.reduce((sum, value) => sum + value, 0) / progress.length : 0,
  };
}

function getBenchmarkNumericValue(row: any, hasAttributedRevenue: boolean) {
  const metricKey = normalizeMetricKey(row?.metric);
  if (REVENUE_DEPENDENT_METRICS.has(metricKey) && !hasAttributedRevenue) return null;
  const value = Number(row?.currentValue);
  return Number.isFinite(value) ? value : null;
}

function getBenchmarkTargetValue(row: any) {
  const value = Number(row?.benchmarkValue ?? row?.targetValue);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getBenchmarkProgress(row: any, hasAttributedRevenue: boolean) {
  const current = getBenchmarkNumericValue(row, hasAttributedRevenue);
  const benchmark = getBenchmarkTargetValue(row);
  if (current === null || benchmark === null) return null;
  return (current / benchmark) * 100;
}

function buildBenchmarkTracker(rows: any[], hasAttributedRevenue: boolean) {
  const progress = rows
    .map((row) => getBenchmarkProgress(row, hasAttributedRevenue))
    .filter((value): value is number => Number.isFinite(value));
  return {
    total: rows.length,
    onTrack: progress.filter((value) => value >= 90).length,
    needsAttention: progress.filter((value) => value >= 70 && value < 90).length,
    behind: progress.filter((value) => value < 70).length,
    avgPct: progress.length > 0 ? progress.reduce((sum, value) => sum + value, 0) / progress.length : 0,
  };
}

function metricCard(label: string, value: string, Icon: any, helper?: string, valueClass = "text-foreground", iconClass = "text-muted-foreground") {
  return (
    <Card key={label}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-2xl font-semibold ${valueClass}`}>{value}</p>
            {helper && <p className="text-xs text-muted-foreground mt-1">{helper}</p>}
          </div>
          <Icon className={`w-5 h-5 ${iconClass}`} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function TikTokAnalytics() {
  const [, params] = useRoute("/campaigns/:id/tiktok-analytics");
  const campaignId = params?.id;
  const queryClient = useQueryClient();

  const { data: connection, isLoading: connectionLoading, error: connectionError } = useQuery<any>({
    queryKey: [`/api/tiktok/${campaignId}/connection`],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/tiktok/${campaignId}/connection`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load TikTok connection");
      }
      return response.json();
    },
  });

  const connected = connection?.connected === true && Array.isArray(connection?.selectedCampaignIds) && connection.selectedCampaignIds.length > 0;
  const { data: dailyMetrics, isLoading: metricsLoading, error: metricsError } = useQuery<any>({
    queryKey: [`/api/tiktok/${campaignId}/daily-metrics`, "30days"],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/tiktok/${campaignId}/daily-metrics?dateRange=30days`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load TikTok metrics");
      }
      return response.json();
    },
  });

  const { data: kpisData, isLoading: kpisLoading } = useQuery<any[]>({
    queryKey: [`/api/platforms/tiktok/kpis`, campaignId],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/tiktok/kpis?campaignId=${campaignId}`);
      if (!response.ok) throw new Error("Failed to load TikTok KPIs");
      return response.json();
    },
  });

  const { data: benchmarksData, isLoading: benchmarksLoading } = useQuery<any[]>({
    queryKey: [`/api/platforms/tiktok/benchmarks`, campaignId],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/tiktok/benchmarks?campaignId=${campaignId}`);
      if (!response.ok) throw new Error("Failed to load TikTok Benchmarks");
      return response.json();
    },
  });

  const rows = Array.isArray(dailyMetrics?.rows) ? dailyMetrics.rows : [];
  const hasRows = rows.length > 0;
  const refreshTestMetrics = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/tiktok/${campaignId}/refresh-test`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to refresh TikTok test metrics");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/tiktok/${campaignId}/daily-metrics`], exact: false });
      await queryClient.invalidateQueries({ queryKey: [`/api/tiktok/${campaignId}/connection`], exact: false });
    },
  });
  const shouldAutoRefreshTestMetrics =
    connection?.method === "test_mode" &&
    !!dailyMetrics &&
    !metricsLoading &&
    !metricsError &&
    !hasRows &&
    !refreshTestMetrics.isPending &&
    !refreshTestMetrics.isSuccess &&
    !refreshTestMetrics.error;
  useEffect(() => {
    if (shouldAutoRefreshTestMetrics) {
      refreshTestMetrics.mutate();
    }
  }, [shouldAutoRefreshTestMetrics, refreshTestMetrics]);
  const totals = useMemo(() => {
    const summed = rows.reduce((acc: any, row: any) => {
      acc.impressions += Number(row.impressions || 0);
      acc.clicks += Number(row.clicks || 0);
      acc.spend += Number(row.spend || 0);
      acc.conversions += Number(row.conversions || 0);
      acc.videoViews += Number(row.videoViews || 0);
      acc.engagements += Number(row.engagements || 0);
      return acc;
    }, { impressions: 0, clicks: 0, spend: 0, conversions: 0, videoViews: 0, engagements: 0 });
    return {
      ...summed,
      ctr: summed.impressions > 0 ? (summed.clicks / summed.impressions) * 100 : null,
      cpc: summed.clicks > 0 ? summed.spend / summed.clicks : null,
      cpm: summed.impressions > 0 ? (summed.spend / summed.impressions) * 1000 : null,
      costPerConversion: summed.conversions > 0 ? summed.spend / summed.conversions : null,
      conversionRate: summed.clicks > 0 ? (summed.conversions / summed.clicks) * 100 : null,
    };
  }, [rows]);

  const campaignRows = useMemo(() => {
    const grouped = new Map<string, any>();
    rows.forEach((row: any) => {
      const id = String(row.tiktokCampaignId || "").trim();
      if (!id) return;
      const existing = grouped.get(id) || {
        id,
        name: String(row.tiktokCampaignName || id),
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        videoViews: 0,
        engagements: 0,
      };
      existing.impressions += Number(row.impressions || 0);
      existing.clicks += Number(row.clicks || 0);
      existing.spend += Number(row.spend || 0);
      existing.conversions += Number(row.conversions || 0);
      existing.videoViews += Number(row.videoViews || 0);
      existing.engagements += Number(row.engagements || 0);
      grouped.set(id, existing);
    });
    return Array.from(grouped.values()).map((row: any) => ({
      ...row,
      ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : null,
      cpc: row.clicks > 0 ? row.spend / row.clicks : null,
      costPerConversion: row.conversions > 0 ? row.spend / row.conversions : null,
    })).sort((a: any, b: any) => b.spend - a.spend);
  }, [rows]);

  const financialSummary = dailyMetrics?.financialSummary || {};
  const hasAttributedRevenue = financialSummary?.hasAttributedRevenue === true && Number(financialSummary?.attributedRevenue || 0) > 0;
  const attributedRevenue = hasAttributedRevenue ? Number(financialSummary.attributedRevenue || 0) : null;
  const roi = hasAttributedRevenue && attributedRevenue !== null && totals.spend > 0 ? ((attributedRevenue - totals.spend) / totals.spend) * 100 : null;
  const roas = hasAttributedRevenue && attributedRevenue !== null && totals.spend > 0 ? attributedRevenue / totals.spend : null;
  const unavailableReason = dailyMetrics?.unavailableReason || "No persisted TikTok metric rows exist for the selected campaigns yet.";
  const platformKPIs = Array.isArray(kpisData) ? kpisData : [];
  const kpiTracker = buildGoalTracker(platformKPIs, hasAttributedRevenue);
  const platformBenchmarks = Array.isArray(benchmarksData) ? benchmarksData : [];
  const benchmarkTracker = buildBenchmarkTracker(platformBenchmarks, hasAttributedRevenue);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="space-y-6">
            <div>
              <Link href={`/campaigns/${campaignId}`}>
                <Button variant="ghost" size="sm" data-testid="button-back-to-campaign">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Campaign
                </Button>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center">
                <SiTiktok className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">TikTok Ads Analytics</h1>
                <p className="text-muted-foreground">Campaign-scoped TikTok source analytics</p>
              </div>
            </div>

            {connectionLoading && <div className="min-h-[220px]" aria-hidden="true" />}

            {!connectionLoading && (connectionError || !connected) && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-muted-foreground">
                      {connectionError ? (connectionError as Error).message : "Connect TikTok Ads from the campaign Connected Platforms section before opening TikTok analytics."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!connectionLoading && connected && (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="kpis">KPIs</TabsTrigger>
                  <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
                  <TabsTrigger value="ads">Ad Comparison</TabsTrigger>
                  <TabsTrigger value="insights">Insights</TabsTrigger>
                  <TabsTrigger value="reports">Reports</TabsTrigger>
                </TabsList>

                {metricsError && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2 text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-red-700 dark:text-red-300">{(metricsError as Error).message}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <TabsContent value="overview" className="space-y-4">
                  {metricsLoading ? (
                    <div className="min-h-[140px]" aria-hidden="true" />
                  ) : !hasRows && (shouldAutoRefreshTestMetrics || refreshTestMetrics.isPending || refreshTestMetrics.isSuccess) ? (
                    <div className="min-h-[140px]" aria-hidden="true" />
                  ) : !hasRows ? (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-muted-foreground">{refreshTestMetrics.error ? (refreshTestMetrics.error as Error).message : unavailableReason}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {metricCard("Impressions", formatNumber(totals.impressions), Eye)}
                      {metricCard("Clicks", formatNumber(totals.clicks), MousePointer)}
                      {metricCard("Spend", formatCurrency(totals.spend), DollarSign)}
                      {metricCard("Conversions", formatNumber(totals.conversions), Target)}
                      {metricCard("Video Views", formatNumber(totals.videoViews), Video)}
                      {metricCard("Engagements", formatNumber(totals.engagements), BarChart3)}
                      {metricCard("CTR", formatPct(totals.ctr), Percent)}
                      {metricCard("CPC", totals.cpc === null ? "Unavailable" : formatCurrency(totals.cpc), DollarSign)}
                      {metricCard("CPM", totals.cpm === null ? "Unavailable" : formatCurrency(totals.cpm), BarChart3)}
                      {metricCard("Cost / Conversion", totals.costPerConversion === null ? "Unavailable" : formatCurrency(totals.costPerConversion), Target)}
                      {metricCard("Conversion Rate", formatPct(totals.conversionRate), Percent)}
                      {metricCard("Total Revenue", attributedRevenue === null ? "Unavailable" : formatCurrency(attributedRevenue), DollarSign, attributedRevenue === null ? "Requires TikTok-scoped attributed revenue." : undefined)}
                      {metricCard("ROI", roi === null ? "Unavailable" : `${roi.toFixed(2)}%`, Percent, roi === null ? "Requires TikTok-scoped attributed revenue." : undefined)}
                      {metricCard("ROAS", roas === null ? "Unavailable" : `${roas.toFixed(2)}x`, TrendingUp, roas === null ? "Requires TikTok-scoped attributed revenue." : undefined)}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="ads" className="space-y-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">
                        TikTok ad-level comparison is unavailable until persisted TikTok rows include ad-level source identifiers.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="kpis" className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Key Performance Indicators</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Track daily TikTok KPIs and progress toward targets.
                      </p>
                    </div>
                  </div>

                  {kpisLoading ? (
                    <div className="min-h-[180px]" aria-hidden="true" />
                  ) : (
                    <>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                        {metricCard("Total KPIs", formatNumber(kpiTracker.total), Target, undefined, "text-foreground", "text-purple-500")}
                        {metricCard("Above Target", formatNumber(kpiTracker.above), TrendingUp, "more than +5% above target", "text-green-600", "text-green-500")}
                        {metricCard("On Track", formatNumber(kpiTracker.near), CheckCircle2, "within +/-5% of target", "text-blue-600", "text-blue-500")}
                        {metricCard("Below Target", formatNumber(kpiTracker.below), AlertCircle, "more than -5% below target", "text-red-600", "text-red-500")}
                        {metricCard("Avg. Progress", `${kpiTracker.avgPct.toFixed(1)}%`, TrendingUp, undefined, "text-foreground", "text-violet-600")}
                      </div>

                      {platformKPIs.length === 0 ? (
                        <Card>
                          <CardContent className="py-8 text-center text-muted-foreground">
                            <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold text-foreground mb-2">No KPIs yet</h3>
                            <p>Create your first KPI to track TikTok performance for this campaign.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {platformKPIs.map((kpi: any) => {
                            const current = formatGoalValue(kpi, hasAttributedRevenue);
                            const target = formatGoalValue({ ...kpi, currentValue: kpi?.targetValue }, true);
                            const progress = getGoalProgress(kpi, hasAttributedRevenue);
                            const boundedProgress = progress === null ? 0 : Math.min(Math.max(progress, 0), 100);
                            const statusText = progress === null
                              ? current.helper || "Current value unavailable."
                              : progress > 105
                                ? `${(progress - 100).toFixed(1)}% above target`
                                : progress < 95
                                  ? `${(100 - progress).toFixed(1)}% below target`
                                  : "within +/-5% of target";
                            const progressColor = progress === null
                              ? "bg-muted"
                              : progress > 105
                                ? "bg-green-500"
                                : progress < 95
                                  ? "bg-red-500"
                                  : "bg-blue-500";

                            return (
                              <Card key={kpi.id || kpi.name || kpi.metric}>
                                <CardContent className="p-5 space-y-5">
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                      <Target className="w-5 h-5 text-orange-500" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-base font-semibold text-foreground">{kpi?.name || "TikTok KPI"}</h4>
                                        <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-foreground">{kpi?.metric || "KPI"}</span>
                                      </div>
                                      {kpi?.description && <p className="text-sm text-muted-foreground mt-1">{kpi.description}</p>}
                                    </div>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-lg bg-muted p-4">
                                      <p className="text-sm text-foreground">Current</p>
                                      <p className="text-2xl font-semibold text-foreground">{current.value}</p>
                                    </div>
                                    <div className="rounded-lg bg-muted p-4">
                                      <p className="text-sm text-foreground">Target</p>
                                      <p className="text-2xl font-semibold text-foreground">{target.value}</p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                      <span>Progress</span>
                                      <span>{progress === null ? "Unavailable" : `${progress.toFixed(1)}%`}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                      <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${boundedProgress}%` }} />
                                    </div>
                                    <p className="text-sm text-muted-foreground">{statusText}</p>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="benchmarks" className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Performance Benchmarks</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Track and measure TikTok performance against industry standards and custom targets.
                      </p>
                    </div>
                  </div>

                  {benchmarksLoading ? (
                    <div className="min-h-[180px]" aria-hidden="true" />
                  ) : (
                    <>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                        {metricCard("Total Benchmarks", formatNumber(benchmarkTracker.total), Target, undefined, "text-foreground", "text-purple-500")}
                        {metricCard("On Track", formatNumber(benchmarkTracker.onTrack), CheckCircle2, "90% or more of benchmark", "text-green-600", "text-green-500")}
                        {metricCard("Needs Attention", formatNumber(benchmarkTracker.needsAttention), AlertCircle, "70% to under 90% of benchmark", "text-amber-600", "text-amber-500")}
                        {metricCard("Behind", formatNumber(benchmarkTracker.behind), AlertTriangle, "below 70% of benchmark", "text-red-600", "text-red-500")}
                        {metricCard("Avg. Progress", `${benchmarkTracker.avgPct.toFixed(1)}%`, TrendingUp, undefined, "text-foreground", "text-violet-600")}
                      </div>

                      {platformBenchmarks.length === 0 ? (
                        <Card>
                          <CardContent className="py-12 text-center text-muted-foreground">
                            <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold text-foreground mb-2">No Benchmarks Yet</h3>
                            <p>Create your first benchmark to start tracking performance against industry standards.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {platformBenchmarks.map((benchmark: any) => {
                            const current = formatGoalValue(benchmark, hasAttributedRevenue);
                            const target = formatGoalValue({ ...benchmark, currentValue: benchmark?.benchmarkValue ?? benchmark?.targetValue }, true);
                            const progress = getBenchmarkProgress(benchmark, hasAttributedRevenue);
                            const boundedProgress = progress === null ? 0 : Math.min(Math.max(progress, 0), 100);
                            const statusLabel = progress === null
                              ? "Unavailable"
                              : progress >= 90
                                ? "On Track"
                                : progress >= 70
                                  ? "Needs Attention"
                                  : "Behind";
                            const statusText = progress === null
                              ? current.helper || "Current value unavailable."
                              : `${(progress - 100).toFixed(1)}% vs benchmark`;
                            const progressColor = progress === null
                              ? "bg-muted"
                              : progress >= 90
                                ? "bg-green-500"
                                : progress >= 70
                                  ? "bg-amber-500"
                                  : "bg-red-500";

                            return (
                              <Card key={benchmark.id || benchmark.name || benchmark.metric}>
                                <CardContent className="p-5 space-y-5">
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                      <TrendingUp className="w-5 h-5 text-orange-500" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-base font-semibold text-foreground">{benchmark?.name || "TikTok Benchmark"}</h4>
                                        <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-foreground">{benchmark?.metric || "Benchmark"}</span>
                                      </div>
                                      {benchmark?.description && <p className="text-sm text-muted-foreground mt-1">{benchmark.description}</p>}
                                      {benchmark?.industry && <p className="text-xs text-muted-foreground mt-1">Industry: {benchmark.industry}</p>}
                                    </div>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-lg bg-muted p-4">
                                      <p className="text-sm text-foreground">Current Value</p>
                                      <p className="text-2xl font-semibold text-foreground">{current.value}</p>
                                    </div>
                                    <div className="rounded-lg bg-muted p-4">
                                      <p className="text-sm text-foreground">Benchmark Value</p>
                                      <p className="text-2xl font-semibold text-foreground">{target.value}</p>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                      <span>Progress</span>
                                      <span>{progress === null ? "Unavailable" : `${progress.toFixed(1)}%`}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                      <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${boundedProgress}%` }} />
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">Performance</span>
                                      <span className="font-medium text-foreground">{statusLabel}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{statusText}</p>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="insights" className="space-y-4">
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Insights are limited to selected persisted TikTok rows. Revenue, ROI, and ROAS remain unavailable until TikTok-scoped attributed revenue exists.
                      </p>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {metricCard("Selected Campaign Rows", hasRows ? formatNumber(campaignRows.length) : "Unavailable", Target, hasRows ? "Persisted TikTok metric rows only." : unavailableReason)}
                        {metricCard("Spend", hasRows ? formatCurrency(totals.spend) : "Unavailable", DollarSign, hasRows ? "From selected TikTok rows." : unavailableReason)}
                        {metricCard("Attributed Revenue", attributedRevenue === null ? "Unavailable" : formatCurrency(attributedRevenue), DollarSign, attributedRevenue === null ? "Requires TikTok-scoped attributed revenue." : "From TikTok-scoped revenue source.")}
                        {metricCard("ROAS", roas === null ? "Unavailable" : `${roas.toFixed(2)}x`, TrendingUp, roas === null ? "Requires TikTok-scoped attributed revenue." : "Spend and revenue are TikTok-scoped.")}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="reports" className="space-y-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">
                        TikTok Reports are unavailable until the campaign-scoped TikTok source-backed reports contract is implemented. Snapshot, PDF, test-send, and scheduled-send output are blocked rather than generated from generic report data.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
