import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useRoute, Link } from "wouter";
import { ArrowLeft, AlertCircle, Loader2, Eye, MousePointer, DollarSign, Target, BarChart3, Percent, Video } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function InstagramAnalytics() {
  const [, params] = useRoute("/campaigns/:id/instagram-analytics");
  const campaignId = params?.id;

  const { data: connection, isLoading, error } = useQuery<any>({
    queryKey: [`/api/instagram/${campaignId}/connection`],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/instagram/${campaignId}/connection`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load Instagram connection");
      }
      return response.json();
    },
  });

  const connected = connection?.connected === true && Array.isArray(connection?.selectedCampaignIds) && connection.selectedCampaignIds.length > 0;
  const { data: dailyMetrics, isLoading: metricsLoading, error: metricsError } = useQuery<any>({
    queryKey: [`/api/instagram/${campaignId}/daily-metrics`, "30days"],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/instagram/${campaignId}/daily-metrics?dateRange=30days`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to load Instagram metrics");
      }
      return response.json();
    },
  });
  const { data: kpis = [], isLoading: kpisLoading, error: kpisError } = useQuery<any[]>({
    queryKey: ["/api/platforms/instagram/kpis", campaignId],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/instagram/kpis?campaignId=${encodeURIComponent(String(campaignId))}`);
      if (!response.ok) throw new Error("Failed to load Instagram KPIs");
      const json = await response.json();
      return Array.isArray(json) ? json : [];
    },
  });
  const { data: benchmarks = [], isLoading: benchmarksLoading, error: benchmarksError } = useQuery<any[]>({
    queryKey: ["/api/platforms/instagram/benchmarks", campaignId],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/instagram/benchmarks?campaignId=${encodeURIComponent(String(campaignId))}`);
      if (!response.ok) throw new Error("Failed to load Instagram Benchmarks");
      const json = await response.json();
      return Array.isArray(json) ? json : [];
    },
  });
  const { data: reports = [], isLoading: reportsLoading, error: reportsError } = useQuery<any[]>({
    queryKey: ["/api/platforms/instagram/reports", campaignId],
    enabled: !!campaignId && connected,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/instagram/reports?campaignId=${encodeURIComponent(String(campaignId))}`);
      if (!response.ok) throw new Error("Failed to load Instagram Reports");
      const json = await response.json();
      return Array.isArray(json) ? json : [];
    },
  });
  const overviewTotals = useMemo(() => {
    const rows = Array.isArray(dailyMetrics?.rows) ? dailyMetrics.rows : [];
    const totals = rows.reduce((acc: any, row: any) => {
      acc.impressions += Number(row.impressions || 0);
      acc.clicks += Number(row.clicks || 0);
      acc.spend += Number(row.spend || 0);
      acc.conversions += Number(row.conversions || 0);
      acc.videoViews += Number(row.videoViews || 0);
      return acc;
    }, { impressions: 0, clicks: 0, spend: 0, conversions: 0, videoViews: 0 });
    return {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
      cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : null,
      costPerConversion: totals.conversions > 0 ? totals.spend / totals.conversions : null,
      conversionRate: totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : null,
    };
  }, [dailyMetrics]);
  const latestImportedAt = useMemo(() => {
    const rows = Array.isArray(dailyMetrics?.rows) ? dailyMetrics.rows : [];
    const latest = rows
      .map((row: any) => row.importedAt ? new Date(row.importedAt).getTime() : 0)
      .filter((value: number) => Number.isFinite(value) && value > 0)
      .sort((a: number, b: number) => b - a)[0];
    return latest ? new Date(latest).toLocaleString() : null;
  }, [dailyMetrics]);
  const hasRows = connected && Array.isArray(dailyMetrics?.rows) && dailyMetrics.rows.length > 0;
  const renderSimpleRows = (rows: any[], loading: boolean, rowError: unknown, emptyText: string, renderRow: (row: any) => any) => {
    if (rowError) {
      return (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2 text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-700 dark:text-red-300">{(rowError as Error).message}</p>
            </div>
          </CardContent>
        </Card>
      );
    }
    if (loading) {
      return (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading Instagram rows...
            </div>
          </CardContent>
        </Card>
      );
    }
    if (rows.length === 0) {
      return (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground">{emptyText}</p>
            </div>
          </CardContent>
        </Card>
      );
    }
    return <div className="space-y-3">{rows.map(renderRow)}</div>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Link href={`/campaigns/${campaignId}`}>
                <Button variant="ghost" size="sm" data-testid="button-back-to-campaign">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Campaign
                </Button>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                <SiInstagram className="w-6 h-6 text-pink-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Instagram Ads Analytics</h1>
                <p className="text-muted-foreground">Campaign-scoped Instagram source analytics</p>
              </div>
            </div>

            {(isLoading || error || !connected) && (
              <Card>
                <CardContent className="p-4">
                  {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading Instagram analytics...
                    </div>
                  ) : error ? (
                    <div className="flex items-start gap-2 text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-red-700 dark:text-red-300">{(error as Error).message}</p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                      <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-muted-foreground">
                        Connect Instagram Ads from the campaign Connected Platforms section before opening Instagram analytics.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {connected && (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="kpis">KPIs</TabsTrigger>
                  <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
                  <TabsTrigger value="ads">Ad Comparison</TabsTrigger>
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
                {latestImportedAt && (
                  <p className="text-xs text-muted-foreground">Latest Instagram row import: {latestImportedAt}</p>
                )}
                <TabsContent value="overview" className="space-y-4">
                  {metricsError ? null : metricsLoading ? (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading source-backed Instagram metrics...
                        </div>
                      </CardContent>
                    </Card>
                  ) : hasRows ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: "Impressions", value: overviewTotals.impressions.toLocaleString(), Icon: Eye },
                        { label: "Clicks", value: overviewTotals.clicks.toLocaleString(), Icon: MousePointer },
                        { label: "Spend", value: `$${overviewTotals.spend.toFixed(2)}`, Icon: DollarSign },
                        { label: "Conversions", value: overviewTotals.conversions.toLocaleString(), Icon: Target },
                        { label: "CTR", value: overviewTotals.ctr === null ? "Unavailable" : `${overviewTotals.ctr.toFixed(2)}%`, Icon: Percent },
                        { label: "CPC", value: overviewTotals.cpc === null ? "Unavailable" : `$${overviewTotals.cpc.toFixed(2)}`, Icon: DollarSign },
                        { label: "CPM", value: overviewTotals.cpm === null ? "Unavailable" : `$${overviewTotals.cpm.toFixed(2)}`, Icon: BarChart3 },
                        { label: "Cost / Conversion", value: overviewTotals.costPerConversion === null ? "Unavailable" : `$${overviewTotals.costPerConversion.toFixed(2)}`, Icon: Target },
                        { label: "Conversion Rate", value: overviewTotals.conversionRate === null ? "Unavailable" : `${overviewTotals.conversionRate.toFixed(2)}%`, Icon: Percent },
                        { label: "Video Views", value: overviewTotals.videoViews.toLocaleString(), Icon: Video },
                      ].map(({ label, value, Icon }) => (
                        <Card key={label}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">{label}</p>
                                <p className="text-2xl font-semibold text-foreground">{value}</p>
                              </div>
                              <Icon className="w-5 h-5 text-muted-foreground" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="text-muted-foreground">No selected source-backed Instagram metric rows are available yet.</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                <TabsContent value="kpis" className="space-y-4">
                  {renderSimpleRows(kpis, kpisLoading, kpisError, "No Instagram KPIs have been created yet.", (kpi: any) => (
                    <Card key={kpi.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium text-foreground">{kpi.name || kpi.metric || "Instagram KPI"}</p>
                            <p className="text-xs text-muted-foreground">{kpi.metric || "Metric"} target: {kpi.targetValue ?? "Not set"}</p>
                          </div>
                          <div className="text-sm md:text-right">
                            <p className="text-muted-foreground">Current Value</p>
                            <p className="font-medium">{kpi.currentValue ?? "Unavailable"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
                <TabsContent value="benchmarks" className="space-y-4">
                  {renderSimpleRows(benchmarks, benchmarksLoading, benchmarksError, "No Instagram Benchmarks have been created yet.", (benchmark: any) => (
                    <Card key={benchmark.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium text-foreground">{benchmark.name || benchmark.metric || "Instagram Benchmark"}</p>
                            <p className="text-xs text-muted-foreground">{benchmark.metric || "Metric"} benchmark: {benchmark.benchmarkValue ?? "Not set"}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-6 text-sm md:text-right">
                            <div>
                              <p className="text-muted-foreground">Current Value</p>
                              <p className="font-medium">{benchmark.currentValue ?? "Unavailable"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Variance</p>
                              <p className="font-medium">{benchmark.variance ?? "Unavailable"}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
                <TabsContent value="ads" className="space-y-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                        <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-muted-foreground">No source-backed Instagram ad comparison rows are available yet.</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="reports" className="space-y-4">
                  {renderSimpleRows(reports, reportsLoading, reportsError, "No Instagram Reports have been created yet.", (report: any) => (
                    <Card key={report.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium text-foreground">{report.name || "Instagram Report"}</p>
                            <p className="text-xs text-muted-foreground">{report.reportType || "report"}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">{report.scheduleEnabled ? "Scheduled" : "Standard"}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
