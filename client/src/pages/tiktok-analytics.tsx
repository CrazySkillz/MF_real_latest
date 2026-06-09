import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, AlertCircle, BarChart3, DollarSign, Eye, MousePointer, Percent, Target, TrendingUp, Trophy, Video } from "lucide-react";
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

function metricCard(label: string, value: string, Icon: any, helper?: string) {
  return (
    <Card key={label}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            {helper && <p className="text-xs text-muted-foreground mt-1">{helper}</p>}
          </div>
          <Icon className="w-5 h-5 text-muted-foreground" />
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
                  <TabsTrigger value="campaigns">Campaign Breakdown</TabsTrigger>
                  <TabsTrigger value="ads">Ad Comparison</TabsTrigger>
                  <TabsTrigger value="kpis">KPIs</TabsTrigger>
                  <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
                  <TabsTrigger value="insights">Insights</TabsTrigger>
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

                <TabsContent value="campaigns" className="space-y-4">
                  {hasRows ? (
                    <div className="rounded-md border overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3">Campaign</th>
                            <th className="text-right p-3">Impressions</th>
                            <th className="text-right p-3">Clicks</th>
                            <th className="text-right p-3">Spend</th>
                            <th className="text-right p-3">Conversions</th>
                            <th className="text-right p-3">CTR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaignRows.map((row: any) => (
                            <tr key={row.id} className="border-t">
                              <td className="p-3">
                                <div className="font-medium">{row.name}</div>
                                <div className="text-xs text-muted-foreground">{row.id}</div>
                              </td>
                              <td className="p-3 text-right">{formatNumber(row.impressions)}</td>
                              <td className="p-3 text-right">{formatNumber(row.clicks)}</td>
                              <td className="p-3 text-right">{formatCurrency(row.spend)}</td>
                              <td className="p-3 text-right">{formatNumber(row.conversions)}</td>
                              <td className="p-3 text-right">{formatPct(row.ctr)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Card><CardContent className="p-4 text-sm text-muted-foreground">{unavailableReason}</CardContent></Card>
                  )}
                </TabsContent>

                <TabsContent value="ads" className="space-y-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">
                        TikTok ad-level comparison is unavailable until persisted TikTok rows include ad-level source identifiers. Campaign-level selected rows are shown in Campaign Breakdown.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="kpis" className="space-y-4">
                  {kpisLoading ? (
                    <div className="min-h-[120px]" aria-hidden="true" />
                  ) : Array.isArray(kpisData) && kpisData.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {kpisData.map((kpi: any) => {
                        const current = formatGoalValue(kpi, hasAttributedRevenue);
                        return metricCard(String(kpi?.name || kpi?.metric || "TikTok KPI"), current.value, Target, current.helper || `Target: ${kpi?.targetValue ?? "Not set"}`);
                      })}
                    </div>
                  ) : (
                    <Card><CardContent className="p-4 text-sm text-muted-foreground">No TikTok KPIs configured yet.</CardContent></Card>
                  )}
                </TabsContent>

                <TabsContent value="benchmarks" className="space-y-4">
                  {benchmarksLoading ? (
                    <div className="min-h-[120px]" aria-hidden="true" />
                  ) : Array.isArray(benchmarksData) && benchmarksData.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {benchmarksData.map((benchmark: any) => {
                        const current = formatGoalValue(benchmark, hasAttributedRevenue);
                        return metricCard(String(benchmark?.name || benchmark?.metric || "TikTok Benchmark"), current.value, Trophy, current.helper || `Benchmark: ${benchmark?.benchmarkValue ?? benchmark?.targetValue ?? "Not set"}`);
                      })}
                    </div>
                  ) : (
                    <Card><CardContent className="p-4 text-sm text-muted-foreground">No TikTok Benchmarks configured yet.</CardContent></Card>
                  )}
                </TabsContent>

                <TabsContent value="insights" className="space-y-4">
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Insights are limited to selected persisted TikTok rows. Revenue, ROI, and ROAS remain unavailable until TikTok-scoped attributed revenue exists.
                      </p>
                      {hasRows && (
                        <p className="text-sm text-muted-foreground">
                          {campaignRows.length} selected TikTok campaign{campaignRows.length === 1 ? "" : "s"} have persisted metric rows in this date range.
                        </p>
                      )}
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
