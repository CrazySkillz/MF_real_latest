import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, AlertCircle, BarChart3, DollarSign, Eye, MousePointer, Percent, Target, Video } from "lucide-react";
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

  const rows = Array.isArray(dailyMetrics?.rows) ? dailyMetrics.rows : [];
  const hasRows = rows.length > 0;
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
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="campaigns">Campaign Breakdown</TabsTrigger>
                  <TabsTrigger value="ads">Ad Comparison</TabsTrigger>
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
                  ) : !hasRows ? (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2 text-sm bg-muted/60 border border-border rounded-lg p-3">
                          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="text-muted-foreground">{unavailableReason}</p>
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
                      {metricCard("Revenue / ROI / ROAS", "Unavailable", DollarSign, "Requires TikTok-scoped attributed revenue.")}
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
